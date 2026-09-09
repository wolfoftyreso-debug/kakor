"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { fromISODate } from "@/lib/dates";
import { ADJUST_REASONS, PICK_STATUS, type MovementKind } from "@/lib/status";
import { lineWeightGrams } from "@/lib/units";
import type { ActionResult } from "@/app/admin/actions";
import { adjustInventory, setMinLevel } from "@/lib/warehouse/inventory";
import { lockDeliveryDate, lockDueDeliveryWeeks, resendLockEmail } from "@/lib/warehouse/lock";
import { PickError, setPickStatus } from "@/lib/warehouse/pick";
import { recordLateChange } from "@/lib/warehouse/snapshot";
import { saveOpsSettings } from "@/lib/warehouse/settings";
import { clampHour, clampWeekday } from "@/lib/warehouse/cutoff";

async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

const idSchema = z.string().cuid();
const isoSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function adjustStockAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const productId = String(formData.get("productId") ?? "");
  if (!idSchema.safeParse(productId).success) return { ok: false, error: "Ogiltig produkt" };
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return { ok: false, error: "Produkten finns inte" };

  const reasonId = String(formData.get("reason") ?? "");
  const reasonMeta = ADJUST_REASONS.find((r) => r.id === reasonId);
  if (!reasonMeta) return { ok: false, error: "Välj en anledning" };

  const qty = Number(formData.get("qty"));
  if (!Number.isFinite(qty) || qty === 0 || Math.abs(qty) > 10000) {
    return { ok: false, error: "Ange en mängd skild från noll" };
  }
  const note = String(formData.get("note") ?? "").trim().slice(0, 300);
  const grams =
    product.unit === "paket"
      ? lineWeightGrams(Math.trunc(qty), "paket", product.packageWeightGrams)
      : Math.round(qty * 1000);
  if (grams === 0) return { ok: false, error: "Mängden blev noll gram" };

  const signed = reasonMeta.kind === "OUTGOING" ? -Math.abs(grams) : reasonMeta.kind === "INCOMING" ? Math.abs(grams) : grams;
  try {
    const { afterGrams } = await adjustInventory({
      productId,
      gramsDelta: signed,
      kind: reasonMeta.kind as MovementKind,
      reason: note ? `${reasonMeta.label}: ${note}` : reasonMeta.label,
      actor: admin.email,
    });
    revalidatePath("/admin", "layout");
    return { ok: true, message: `Lagret uppdaterat. Nytt fysiskt saldo: ${(afterGrams / 1000).toLocaleString("sv-SE")} kg.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Kunde inte justera lagret" };
  }
}

export async function setMinLevelAction(productId: string, minKg: number): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(productId).success) return { ok: false, error: "Ogiltig produkt" };
  if (!Number.isFinite(minKg) || minKg < 0 || minKg > 10000) return { ok: false, error: "Ogiltig miniminivå" };
  await setMinLevel(productId, Math.round(minKg * 1000));
  revalidatePath("/admin/lager");
  return { ok: true, message: "Miniminivå sparad" };
}

export async function lockWeekAction(iso: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!isoSchema.safeParse(iso).success) return { ok: false, error: "Ogiltigt datum" };
  const result = await lockDeliveryDate(fromISODate(iso), admin.email);
  revalidatePath("/admin", "layout");
  if (result.error) return { ok: false, error: result.error };
  if (result.alreadyLocked) {
    return { ok: true, message: result.emailed ? "Redan låst – driftmejlet skickades (det saknades)." : "Leveransdagen är redan låst." };
  }
  return {
    ok: true,
    message: result.emailed
      ? "Leveranslistan är låst och driftmejlet är skickat."
      : "Leveranslistan är låst. Driftmejlet kunde inte skickas – skicka igen från veckovyn.",
  };
}

export async function resendWeekEmailAction(iso: string): Promise<ActionResult> {
  await requireAdmin();
  if (!isoSchema.safeParse(iso).success) return { ok: false, error: "Ogiltigt datum" };
  const ok = await resendLockEmail(fromISODate(iso));
  revalidatePath("/admin", "layout");
  return ok
    ? { ok: true, message: "Leveranslista skickad igen." }
    : { ok: false, error: "Mejlet kunde inte skickas – kontrollera driftadressen och e-postloggen." };
}

export async function runLockCronAction(): Promise<ActionResult> {
  const admin = await requireAdmin();
  const result = await lockDueDeliveryWeeks(new Date(), admin.email);
  revalidatePath("/admin", "layout");
  const locked = result.locks.filter((l) => !l.alreadyLocked && !l.error).length;
  return {
    ok: true,
    message: `Prenumerationer: ${result.generated} ordrar. Låsta dagar: ${locked}.`,
  };
}

export async function setPickStatusAction(orderId: string, to: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!idSchema.safeParse(orderId).success) return { ok: false, error: "Ogiltigt order-id" };
  if (!(PICK_STATUS as readonly string[]).includes(to)) return { ok: false, error: "Ogiltig plockstatus" };
  try {
    await setPickStatus(orderId, to, admin.email);
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Plockstatus uppdaterad" };
  } catch (e) {
    if (e instanceof PickError) return { ok: false, error: e.message };
    return { ok: false, error: "Kunde inte uppdatera plockstatus" };
  }
}

export async function addLateNoteAction(iso: string, reason: string, detail: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!isoSchema.safeParse(iso).success) return { ok: false, error: "Ogiltigt datum" };
  const r = reason.trim();
  const d = detail.trim();
  if (r.length < 3) return { ok: false, error: "Ange en anledning (minst tre tecken)" };
  if (d.length < 3) return { ok: false, error: "Beskriv ändringen" };
  await recordLateChange(fromISODate(iso), {
    actor: admin.email,
    reason: r.slice(0, 300),
    type: "NOTE",
    detail: d.slice(0, 1000),
  });
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Efterhandsändring registrerad. Den låsta listan är oförändrad." };
}

export async function saveOpsSettingsAction(
  _prev: { error?: string; saved?: string } | null,
  formData: FormData
): Promise<{ error?: string; saved?: string }> {
  await requireAdmin();
  const weekday = Number(formData.get("cutoffWeekday"));
  const hour = Number(formData.get("cutoffHour"));
  const opsEmail = String(formData.get("opsEmail") ?? "").trim();
  if (clampWeekday(weekday) !== weekday) return { error: "Veckodag ska vara 1–7 (1 = måndag)." };
  if (clampHour(hour) !== hour) return { error: "Klockslag ska vara 0–23." };
  if (opsEmail && !opsEmail.split(/[,;]+/).every((s) => s.trim() === "" || s.includes("@"))) {
    return { error: "Ange giltiga e-postadresser, kommaseparerade." };
  }
  await saveOpsSettings({ cutoffWeekday: weekday, cutoffHour: hour, opsEmail });
  revalidatePath("/admin/installningar");
  revalidatePath("/admin");
  return { saved: "Cutoff och driftmejl sparade." };
}
