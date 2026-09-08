import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { castVote, daysLeft, getResults, percentages, pollState, PollError, signupForWinner, suspiciousActivity, hashIp, newVisitorId, pollInclude } from "@/lib/polls/service";

// Folkets nästa småkaka: servern avgör öppet/stängt, en röst per besökare,
// procent som summerar till 100, vinnare och lansering.

let pollId = "";
const slug = `test-omgang-${Date.now()}`;
let candidateIds: string[] = [];
const load = () => prisma.poll.findUniqueOrThrow({ where: { id: pollId }, include: pollInclude });

beforeAll(async () => {
  const poll = await prisma.poll.create({
    data: {
      slug,
      sequence: 999,
      title: "Testomgång",
      startsAt: new Date(Date.now() - 86_400_000),
      endsAt: new Date(Date.now() + 7 * 86_400_000),
      status: "ACTIVE",
      candidates: { create: [
        { name: "A-kakan", slug: "a", displayOrder: 1 },
        { name: "B-kakan", slug: "b", displayOrder: 2 },
        { name: "C-kakan", slug: "c", displayOrder: 3 },
      ] },
    },
    include: { candidates: { orderBy: { displayOrder: "asc" } } },
  });
  pollId = poll.id;
  candidateIds = poll.candidates.map((c) => c.id);
});

describe("procent och tillstånd", () => {
  it("största rest: procenten summerar alltid till 100", () => {
    expect(percentages([1, 1, 1])).toEqual([34, 33, 33]);
    expect(percentages([0, 0, 0])).toEqual([0, 0, 0]);
    expect(percentages([532, 384, 291]).reduce((s, n) => s + n, 0)).toBe(100);
    expect(percentages([5, 0])).toEqual([100, 0]);
  });

  it("tillståndet räknas från serverns tid och status", async () => {
    const poll = await load();
    expect(pollState(poll)).toBe("OPEN");
    expect(pollState(poll, new Date(poll.startsAt.getTime() - 1000))).toBe("UPCOMING");
    expect(pollState(poll, new Date(poll.endsAt.getTime() + 1000))).toBe("CLOSED");
    expect(pollState({ ...poll, status: "DRAFT" })).toBe("DRAFT");
    expect(pollState({ ...poll, status: "CLOSED" })).toBe("CLOSED");
    expect(pollState({ ...poll, winnerCandidateId: candidateIds[0] })).toBe("WINNER");
  });

  it("dagar kvar räknas i hela svenska dagar", () => {
    const ends = new Date("2026-12-13T22:59:59.000Z"); // Lucia 23:59 CET
    expect(daysLeft(ends, new Date("2026-12-06T10:00:00.000Z"))).toBe(7);
    expect(daysLeft(ends, new Date("2026-12-13T10:00:00.000Z"))).toBe(0);
    expect(daysLeft(ends, new Date("2026-12-20T10:00:00.000Z"))).toBe(0);
  });
});

describe("röstning", () => {
  it("en röst per besökare; dubbelröst returnerar den första; resultatet räknas ur databasen", async () => {
    const v1 = newVisitorId();
    const first = await castVote({ slug, candidateId: candidateIds[0], visitorId: v1, ipHash: hashIp("10.0.0.1") });
    expect(first.already).toBe(false);
    const again = await castVote({ slug, candidateId: candidateIds[1], visitorId: v1, ipHash: hashIp("10.0.0.1") });
    expect(again.already).toBe(true);
    expect(again.candidateId).toBe(candidateIds[0]);
    await castVote({ slug, candidateId: candidateIds[1], visitorId: newVisitorId(), ipHash: hashIp("10.0.0.2") });
    await castVote({ slug, candidateId: candidateIds[0], visitorId: newVisitorId(), ipHash: hashIp("10.0.0.3") });
    const results = await getResults(await load());
    expect(results.total).toBe(3);
    expect(results.candidates.map((c) => c.votes)).toEqual([2, 1, 0]);
    expect(results.candidates.map((c) => c.percent)).toEqual([67, 33, 0]);
    expect(results.leaderId).toBe(candidateIds[0]);
  });

  it("avvisar fel kandidat, stängd omgång och omgång som inte öppnat – på servern", async () => {
    await expect(castVote({ slug, candidateId: "clzzzzzzzzzzzzzzzzzzzzzzz", visitorId: newVisitorId(), ipHash: "" })).rejects.toMatchObject({ code: "BAD_CANDIDATE" });
    const poll = await load();
    await expect(castVote({ slug, candidateId: candidateIds[0], visitorId: newVisitorId(), ipHash: "", now: new Date(poll.endsAt.getTime() + 1) })).rejects.toMatchObject({ code: "CLOSED" });
    await expect(castVote({ slug, candidateId: candidateIds[0], visitorId: newVisitorId(), ipHash: "", now: new Date(poll.startsAt.getTime() - 1) })).rejects.toMatchObject({ code: "NOT_STARTED" });
    await prisma.poll.update({ where: { id: pollId }, data: { status: "CLOSED" } });
    await expect(castVote({ slug, candidateId: candidateIds[0], visitorId: newVisitorId(), ipHash: "" })).rejects.toBeInstanceOf(PollError);
    await prisma.poll.update({ where: { id: pollId }, data: { status: "ACTIVE" } });
    await expect(castVote({ slug: "finns-inte", candidateId: candidateIds[0], visitorId: newVisitorId(), ipHash: "" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("misstänkt aktivitet: samma IP-hash med många röster syns, olika IP syns inte", async () => {
    const ip = hashIp("10.0.0.99");
    for (let i = 0; i < 3; i++) await castVote({ slug, candidateId: candidateIds[2], visitorId: newVisitorId(), ipHash: ip });
    const flagged = await suspiciousActivity(pollId, 3);
    expect(flagged.some((f) => f.ipHash === ip && f.votes === 3)).toBe(true);
    expect(flagged.some((f) => f.ipHash === hashIp("10.0.0.1"))).toBe(false);
  });

  it("avisering är frivillig och idempotent per e-post", async () => {
    expect((await signupForWinner(pollId, "Fika@Testbolaget.se")).created).toBe(true);
    expect((await signupForWinner(pollId, "fika@testbolaget.se ")).created).toBe(false);
    expect(await prisma.pollWinnerSignup.count({ where: { pollId } })).toBe(1);
  });

  it("vinnare och lanserad produkt ger rätt tillstånd", async () => {
    const product = await prisma.product.findFirstOrThrow({ where: { active: true } });
    await prisma.poll.update({ where: { id: pollId }, data: { status: "CLOSED", winnerCandidateId: candidateIds[0], winnerAnnouncedAt: new Date() } });
    expect(pollState(await load())).toBe("WINNER");
    await prisma.pollCandidate.update({ where: { id: candidateIds[0] }, data: { productId: product.id } });
    expect(pollState(await load())).toBe("LAUNCHED");
    await prisma.poll.delete({ where: { id: pollId } });
  });
});
