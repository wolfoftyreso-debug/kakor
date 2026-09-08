"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { cancelByToken, pauseByToken, resumeByToken, skipNextByToken, updateByToken, type ManageResult } from "@/lib/subscriptions/manage";

// Server actions för självservice. Token är hemligheten; ingen session.
// Spärr per IP så att en läckt länk inte kan hamras.

async function guard(): Promise<ManageResult | null> {
  const limit = await rateLimit(clientKey(await headers(), "manage"), { limit: 20, windowMs: 60_000 });
  if (!limit.ok) return { ok: false, error: "För många försök – vänta en stund och försök igen." };
  return null;
}

const TOKEN_RE = /^[a-f0-9]{48}$/;

async function run(token: string, fn: () => Promise<ManageResult>): Promise<ManageResult> {
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return { ok: false, error: "Ogiltig länk." };
  const denied = await guard();
  if (denied) return denied;
  const result = await fn();
  revalidatePath(`/prenumeration/hantera/${token}`);
  return result;
}

export async function pauseSubscriptionAction(token: string): Promise<ManageResult> {
  return run(token, () => pauseByToken(token));
}
export async function resumeSubscriptionAction(token: string): Promise<ManageResult> {
  return run(token, () => resumeByToken(token));
}
export async function skipNextDeliveryAction(token: string): Promise<ManageResult> {
  return run(token, () => skipNextByToken(token));
}
export async function updateSubscriptionAction(
  token: string,
  frequency: string,
  items: { productId: string; weightKg: number }[]
): Promise<ManageResult> {
  return run(token, () => updateByToken(token, String(frequency), Array.isArray(items) ? items : []));
}
export async function cancelSubscriptionAction(token: string): Promise<ManageResult> {
  return run(token, () => cancelByToken(token));
}
