import { prisma } from "@/lib/db";
import { emailConfig } from "@/lib/config";
import { DEFAULT_OPS_SETTINGS, type OpsSettings } from "./types";
import { clampHour, clampWeekday } from "./cutoff";

const SETTINGS_ID = "default";

export async function getOpsSettings(): Promise<OpsSettings> {
  const row = await prisma.deliveryOpsSettings.findUnique({ where: { id: SETTINGS_ID } });
  if (!row) return { ...DEFAULT_OPS_SETTINGS };
  return {
    cutoffWeekday: clampWeekday(row.cutoffWeekday),
    cutoffHour: clampHour(row.cutoffHour),
    opsEmail: row.opsEmail.trim(),
  };
}

export async function saveOpsSettings(input: OpsSettings): Promise<OpsSettings> {
  const data = {
    cutoffWeekday: clampWeekday(input.cutoffWeekday),
    cutoffHour: clampHour(input.cutoffHour),
    opsEmail: input.opsEmail.trim(),
  };
  await prisma.deliveryOpsSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...data },
    update: data,
  });
  return data;
}

/** Mottagare för driftmejl: inställningen, annars ADMIN_NOTIFY_EMAIL. */
export function resolveOpsRecipients(settings: OpsSettings): string[] {
  const raw = settings.opsEmail || emailConfig.adminNotify;
  return raw
    .split(/[,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.includes("@"));
}
