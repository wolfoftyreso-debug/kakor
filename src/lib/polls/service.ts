import { Prisma } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

// Folkets nästa småkaka. All status räknas på servern från riktiga
// tidsstämplar – klienten får aldrig avgöra om en omgång är öppen. Siffror
// kommer alltid från databasen, aldrig från konstanter.

export type PollState = "DRAFT" | "UPCOMING" | "OPEN" | "CLOSED" | "WINNER" | "LAUNCHED";

export interface CandidateResult {
  id: string;
  slug: string;
  name: string;
  votes: number;
  /** Heltalsprocent som summerar till 100 (största rest). 0 när ingen röstat. */
  percent: number;
}

export interface PollResults {
  total: number;
  candidates: CandidateResult[];
  /** Kandidaten med flest röster (null vid 0 röster eller delad ledning). */
  leaderId: string | null;
}

export const pollInclude = {
  candidates: { orderBy: { displayOrder: "asc" as const }, include: { product: { select: { slug: true, name: true, active: true } } } },
} satisfies Prisma.PollInclude;

export type PollWithCandidates = Prisma.PollGetPayload<{ include: typeof pollInclude }>;

/** Serverstyrt tillstånd. Vinnare/lanserad går före CLOSED när de är satta. */
export function pollState(poll: PollWithCandidates, now = new Date()): PollState {
  if (poll.status === "DRAFT") return "DRAFT";
  if (poll.winnerCandidateId) {
    const winner = poll.candidates.find((c) => c.id === poll.winnerCandidateId);
    if (winner?.product?.active) return "LAUNCHED";
    return "WINNER";
  }
  if (poll.status === "CLOSED") return "CLOSED";
  if (now.getTime() < poll.startsAt.getTime()) return "UPCOMING";
  if (now.getTime() > poll.endsAt.getTime()) return "CLOSED";
  return "OPEN";
}

export function isOpen(poll: PollWithCandidates, now = new Date()): boolean {
  return pollState(poll, now) === "OPEN";
}

/** Hela dagar kvar till slutet, räknat i svensk tid. 0 = sista dagen. */
export function daysLeft(endsAt: Date, now = new Date()): number {
  const dayOf = (d: Date) => {
    const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
    return Date.UTC(Number(parts.slice(0, 4)), Number(parts.slice(5, 7)) - 1, Number(parts.slice(8, 10)));
  };
  return Math.max(0, Math.round((dayOf(endsAt) - dayOf(now)) / 86_400_000));
}

/** Största-rest-avrundning: procenten summerar alltid till exakt 100. */
export function percentages(counts: number[]): number[] {
  const total = counts.reduce((s, n) => s + n, 0);
  if (total === 0) return counts.map(() => 0);
  const raw = counts.map((n) => (n * 100) / total);
  const floors = raw.map((x) => Math.floor(x));
  let rest = 100 - floors.reduce((s, n) => s + n, 0);
  const order = raw.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (rest <= 0) break;
    floors[i] += 1;
    rest -= 1;
  }
  return floors;
}

export async function getResults(poll: PollWithCandidates): Promise<PollResults> {
  const grouped = await prisma.pollVote.groupBy({ by: ["candidateId"], where: { pollId: poll.id }, _count: { _all: true } });
  const countFor = new Map(grouped.map((g) => [g.candidateId, g._count._all]));
  const counts = poll.candidates.map((c) => countFor.get(c.id) ?? 0);
  const pct = percentages(counts);
  const total = counts.reduce((s, n) => s + n, 0);
  const max = Math.max(0, ...counts);
  const leaders = poll.candidates.filter((_, i) => counts[i] === max && max > 0);
  return {
    total,
    candidates: poll.candidates.map((c, i) => ({ id: c.id, slug: c.slug, name: c.name, votes: counts[i], percent: pct[i] })),
    leaderId: leaders.length === 1 ? leaders[0].id : null,
  };
}

/**
 * Omgången som ska visas publikt: en öppen omgång först, annars den senast
 * avslutade (med eller utan utsedd vinnare). Utkast och kommande visas aldrig.
 */
export async function getCurrentPoll(now = new Date()): Promise<PollWithCandidates | null> {
  const polls = await prisma.poll.findMany({ where: { status: { not: "DRAFT" } }, include: pollInclude, orderBy: { sequence: "desc" } });
  const open = polls.find((p) => pollState(p, now) === "OPEN");
  if (open) return open;
  const upcoming = polls.filter((p) => pollState(p, now) === "UPCOMING");
  const finished = polls.filter((p) => ["CLOSED", "WINNER", "LAUNCHED"].includes(pollState(p, now)));
  return finished[0] ?? upcoming[0] ?? null;
}

export async function getPollBySlug(slug: string): Promise<PollWithCandidates | null> {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  return prisma.poll.findUnique({ where: { slug }, include: pollInclude });
}

/** Alla avslutade omgångar med vinnare – sortimentsberättelsen. */
export async function getPollHistory(now = new Date()) {
  const polls = await prisma.poll.findMany({ where: { status: { not: "DRAFT" } }, include: pollInclude, orderBy: { sequence: "asc" } });
  return Promise.all(
    polls.map(async (p) => {
      const state = pollState(p, now);
      const results = await getResults(p);
      return { poll: p, state, results, winner: p.candidates.find((c) => c.id === p.winnerCandidateId) ?? null };
    })
  );
}

export async function getVisitorVote(pollId: string, visitorId: string | undefined) {
  if (!visitorId || !/^[a-f0-9]{32}$/.test(visitorId)) return null;
  return prisma.pollVote.findUnique({ where: { pollId_visitorId: { pollId, visitorId } }, select: { candidateId: true, createdAt: true } });
}

export function newVisitorId(): string {
  return randomBytes(16).toString("hex");
}

export function hashIp(ip: string): string {
  // Salt måste vara en serverhemlighet. Hårdkodad fallback gör hashen
  // rainbow-tablebar (IPv4 är litet). Utan hemlighet lagras inget – samma
  // som grundrösterna i seed.
  const salt = process.env.POLL_IP_SALT || process.env.CRON_SECRET || "";
  if (!salt) return "";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export class PollError extends Error {
  constructor(message: string, public code: "NOT_FOUND" | "CLOSED" | "NOT_STARTED" | "BAD_CANDIDATE") {
    super(message);
    this.name = "PollError";
  }
}

export interface VoteOutcome {
  /** true när besökaren redan röstat – den ursprungliga rösten står. */
  already: boolean;
  candidateId: string;
  results: PollResults;
  poll: PollWithCandidates;
}

/**
 * Registrerar en röst. Servern avgör om omgången är öppen; unikt villkor
 * (poll, besökare) gör dubbla anrop ofarliga och returnerar den första rösten.
 */
export async function castVote(input: { slug: string; candidateId: string; visitorId: string; ipHash: string; now?: Date }): Promise<VoteOutcome> {
  const now = input.now ?? new Date();
  const poll = await getPollBySlug(input.slug);
  if (!poll) throw new PollError("Omröstningen finns inte.", "NOT_FOUND");
  const state = pollState(poll, now);
  if (state === "UPCOMING") throw new PollError("Omröstningen har inte öppnat än.", "NOT_STARTED");
  if (state !== "OPEN") throw new PollError("Omröstningen är avslutad – inga fler röster tas emot.", "CLOSED");
  const candidate = poll.candidates.find((c) => c.id === input.candidateId);
  if (!candidate) throw new PollError("Välj en av kandidaterna.", "BAD_CANDIDATE");
  try {
    await prisma.pollVote.create({ data: { pollId: poll.id, candidateId: candidate.id, visitorId: input.visitorId, ipHash: input.ipHash } });
    return { already: false, candidateId: candidate.id, results: await getResults(poll), poll };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await prisma.pollVote.findUnique({ where: { pollId_visitorId: { pollId: poll.id, visitorId: input.visitorId } } });
      return { already: true, candidateId: existing?.candidateId ?? candidate.id, results: await getResults(poll), poll };
    }
    throw e;
  }
}

/** Frivillig avisering när vinnaren går att beställa. Idempotent per e-post och omgång. */
export async function signupForWinner(pollId: string, email: string): Promise<{ created: boolean }> {
  const normalized = email.trim().toLowerCase();
  try {
    await prisma.pollWinnerSignup.create({ data: { pollId, email: normalized } });
    return { created: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { created: false };
    throw e;
  }
}

/** Misstänkt aktivitet: IP-hashar med ovanligt många röster i en omgång. */
export async function suspiciousActivity(pollId: string, threshold = 3) {
  const grouped = await prisma.pollVote.groupBy({ by: ["ipHash"], where: { pollId, ipHash: { not: "" } }, _count: { _all: true }, orderBy: { _count: { ipHash: "desc" } }, take: 20 });
  return grouped.filter((g) => g._count._all >= threshold).map((g) => ({ ipHash: g.ipHash, votes: g._count._all }));
}
