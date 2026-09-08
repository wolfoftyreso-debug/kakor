"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAdmin } from "@/lib/auth/session";
import { getResults, pollInclude } from "@/lib/polls/service";
import { fromStockholmLocal } from "@/lib/polls/time";

// Admin för Folkets nästa småkaka. Bara inloggad admin; ingen publik API.

async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

export type PollActionResult = { ok: true; message: string } | { ok: false; error: string };

const idSchema = z.string().cuid();
const slugSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,80}$/, "Slug: små bokstäver, siffror och bindestreck");
// datetime-local skickar "2026-12-13T23:59" i svensk tid – tolkas som Europe/Stockholm.
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Ange datum och tid");

const pollSchema = z.object({
  slug: slugSchema,
  sequence: z.coerce.number().int().min(1).max(999),
  title: z.string().trim().min(3, "Ange en rubrik").max(120),
  intro: z.string().trim().max(600).default(""),
  deadlineLabel: z.string().trim().max(80).default(""),
  startsAt: localDateTime,
  endsAt: localDateTime,
  status: z.enum(["DRAFT", "ACTIVE", "CLOSED"]),
});

export async function savePoll(
  pollId: string | null,
  _prev: { error?: string; values?: Record<string, string> } | null,
  formData: FormData
): Promise<{ error?: string; values?: Record<string, string> } | null> {
  await requireAdmin();
  const values = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]));
  if (pollId !== null && !idSchema.safeParse(pollId).success) return { error: "Ogiltigt id", values };
  const parsed = pollSchema.safeParse({
    slug: formData.get("slug"),
    sequence: formData.get("sequence") ?? 1,
    title: formData.get("title"),
    intro: formData.get("intro") ?? "",
    deadlineLabel: formData.get("deadlineLabel") ?? "",
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Kontrollera fälten", values };
  const d = parsed.data;
  const startsAt = fromStockholmLocal(d.startsAt);
  const endsAt = fromStockholmLocal(d.endsAt);
  if (endsAt.getTime() <= startsAt.getTime()) return { error: "Slutet måste ligga efter starten", values };
  const data = { slug: d.slug, sequence: d.sequence, title: d.title, intro: d.intro, deadlineLabel: d.deadlineLabel, startsAt, endsAt, status: d.status };
  let id = pollId;
  try {
    if (pollId) {
      await prisma.poll.update({ where: { id: pollId }, data });
    } else {
      id = (await prisma.poll.create({ data })).id;
    }
  } catch {
    return { error: "Kunde inte spara – kontrollera att slug är unik.", values };
  }
  revalidatePath("/admin/omrostningar");
  revalidatePath("/");
  revalidatePath("/folkets-kaka");
  redirect(`/admin/omrostningar/${id}?sparad=1`);
}

const candidateSchema = z.object({
  name: z.string().trim().min(2, "Ange namn").max(80),
  slug: slugSchema,
  description: z.string().trim().max(300).default(""),
  tradition: z.string().trim().max(200).default(""),
  imageRef: z.string().trim().max(200).default(""),
  displayOrder: z.coerce.number().int().min(0).max(99).default(0),
  sourceReference: z.string().trim().max(120).default(""),
});

export async function saveCandidate(
  pollId: string,
  candidateId: string | null,
  _prev: { error?: string; values?: Record<string, string> } | null,
  formData: FormData
): Promise<{ error?: string; values?: Record<string, string> } | null> {
  await requireAdmin();
  const values = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]));
  if (!idSchema.safeParse(pollId).success || (candidateId !== null && !idSchema.safeParse(candidateId).success)) return { error: "Ogiltigt id", values };
  const parsed = candidateSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") ?? "",
    tradition: formData.get("tradition") ?? "",
    imageRef: formData.get("imageRef") ?? "",
    displayOrder: formData.get("displayOrder") ?? 0,
    sourceReference: formData.get("sourceReference") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Kontrollera fälten", values };
  try {
    if (candidateId) {
      await prisma.pollCandidate.update({ where: { id: candidateId }, data: parsed.data });
    } else {
      await prisma.pollCandidate.create({ data: { pollId, ...parsed.data } });
    }
  } catch {
    return { error: "Kunde inte spara – slug måste vara unik inom omgången.", values };
  }
  revalidatePath(`/admin/omrostningar/${pollId}`);
  revalidatePath("/");
  revalidatePath("/folkets-kaka");
  redirect(`/admin/omrostningar/${pollId}?sparad=1`);
}

export async function deleteCandidate(pollId: string, candidateId: string): Promise<PollActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(pollId).success || !idSchema.safeParse(candidateId).success) return { ok: false, error: "Ogiltigt id" };
  const votes = await prisma.pollVote.count({ where: { candidateId } });
  if (votes > 0) return { ok: false, error: `Kandidaten har ${votes} röster och kan inte tas bort – röster får aldrig försvinna.` };
  await prisma.pollCandidate.delete({ where: { id: candidateId } });
  revalidatePath(`/admin/omrostningar/${pollId}`);
  revalidatePath("/");
  revalidatePath("/folkets-kaka");
  return { ok: true, message: "Kandidaten är borttagen" };
}

export async function setPollStatus(pollId: string, status: "DRAFT" | "ACTIVE" | "CLOSED"): Promise<PollActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(pollId).success) return { ok: false, error: "Ogiltigt id" };
  const parsed = z.enum(["DRAFT", "ACTIVE", "CLOSED"]).safeParse(status);
  if (!parsed.success) return { ok: false, error: "Ogiltig status" };
  const poll = await prisma.poll.findUnique({ where: { id: pollId }, include: { candidates: true } });
  if (!poll) return { ok: false, error: "Omgången finns inte" };
  if (parsed.data === "ACTIVE" && poll.candidates.length < 2) return { ok: false, error: "Lägg till minst två kandidater innan omgången öppnas" };
  await prisma.poll.update({ where: { id: pollId }, data: { status: parsed.data } });
  revalidatePath(`/admin/omrostningar/${pollId}`);
  revalidatePath("/admin/omrostningar");
  revalidatePath("/");
  revalidatePath("/folkets-kaka");
  return { ok: true, message: parsed.data === "ACTIVE" ? "Omgången är öppen" : parsed.data === "CLOSED" ? "Omgången är stängd – inga fler röster tas emot" : "Omgången är ett utkast" };
}

/** Utse vinnaren (förval: ledaren). Stänger omgången samtidigt. */
export async function setWinner(pollId: string, candidateId: string): Promise<PollActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(pollId).success || !idSchema.safeParse(candidateId).success) return { ok: false, error: "Ogiltigt id" };
  const poll = await prisma.poll.findUnique({ where: { id: pollId }, include: pollInclude });
  if (!poll) return { ok: false, error: "Omgången finns inte" };
  const candidate = poll.candidates.find((c) => c.id === candidateId);
  if (!candidate) return { ok: false, error: "Kandidaten hör inte till omgången" };
  const results = await getResults(poll);
  const leader = results.leaderId;
  await prisma.poll.update({ where: { id: pollId }, data: { status: "CLOSED", winnerCandidateId: candidateId, winnerAnnouncedAt: new Date() } });
  revalidatePath(`/admin/omrostningar/${pollId}`);
  revalidatePath("/admin/omrostningar");
  revalidatePath("/");
  revalidatePath("/folkets-kaka");
  return {
    ok: true,
    message: `${candidate.name} är utsedd till vinnare.${leader && leader !== candidateId ? " OBS: en annan kandidat leder i rösterna." : ""}`,
  };
}

export async function clearWinner(pollId: string): Promise<PollActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(pollId).success) return { ok: false, error: "Ogiltigt id" };
  await prisma.poll.update({ where: { id: pollId }, data: { winnerCandidateId: null, winnerAnnouncedAt: null } });
  revalidatePath(`/admin/omrostningar/${pollId}`);
  revalidatePath("/");
  revalidatePath("/folkets-kaka");
  return { ok: true, message: "Vinnaren är återkallad" };
}

/** Koppla vinnaren till en lanserad produkt → "Folkets val" med beställningsknapp. */
export async function linkWinnerProduct(pollId: string, candidateId: string, productId: string | null): Promise<PollActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(pollId).success || !idSchema.safeParse(candidateId).success) return { ok: false, error: "Ogiltigt id" };
  if (productId !== null && !idSchema.safeParse(productId).success) return { ok: false, error: "Ogiltig produkt" };
  if (productId) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return { ok: false, error: "Produkten finns inte" };
  }
  await prisma.pollCandidate.update({ where: { id: candidateId }, data: { productId } });
  revalidatePath(`/admin/omrostningar/${pollId}`);
  revalidatePath("/");
  revalidatePath("/folkets-kaka");
  return { ok: true, message: productId ? "Vinnaren är kopplad till produkten – visas som Folkets val" : "Produktkopplingen är borttagen" };
}
