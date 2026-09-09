import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { siteConfig } from "@/lib/config";
import { addDays, formatDeliveryDateWithYear, nextCadenceDate, snapToDeliveryWeekday, snapToWeekday, toISODate, todayInStockholm, upcomingDeliveryDates, type DeliveryDayConfig } from "@/lib/dates";
import { safeBlockedDates, safeWeekdays } from "@/lib/products";
import { SUBSCRIPTION_FREQUENCY, type SubscriptionFrequency } from "@/lib/status";
import { sendSubscriptionChangeEmail } from "@/lib/subscriptions/emails";

// Självservice för prenumeranter utan inloggning: en personlig länk i mejlen.
// Token är hemligheten (48 hex, 192 bitar) – samma modell som fakturalänken.
// Varje åtgärd bekräftas med samma mejl som när verksamheten gör den i admin.

export type ManageResult = { ok: true; message: string } | { ok: false; error: string };

const TOKEN_RE = /^[a-f0-9]{48}$/;

export function manageUrl(token: string): string {
  return `${siteConfig.url}/prenumeration/hantera/${token}`;
}

/** Returnerar prenumerationens hanteringstoken, skapar en om den saknas. */
export async function ensureManageToken(subscriptionId: string): Promise<string> {
  const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId }, select: { manageToken: true } });
  if (sub?.manageToken) return sub.manageToken;
  const token = newManageToken();
  await prisma.subscription.update({ where: { id: subscriptionId }, data: { manageToken: token } });
  return token;
}

export function newManageToken(): string {
  return randomBytes(24).toString("hex");
}

export async function manageUrlFor(subscriptionId: string): Promise<string> {
  return manageUrl(await ensureManageToken(subscriptionId));
}

export async function getSubscriptionByToken(token: string) {
  if (!TOKEN_RE.test(token)) return null;
  return prisma.subscription.findUnique({
    where: { manageToken: token },
    include: {
      items: { include: { product: true } },
      deliveryArea: true,
      orders: {
        where: { status: { not: "CANCELLED" }, deliveryStatus: { not: "DELIVERED" } },
        select: { orderNumber: true, deliveryDate: true, subscriptionPeriod: true },
        orderBy: { deliveryDate: "asc" },
      },
    },
  });
}

function areaConfig(area: { weekdaysJson: string; leadTimeDays: number; blockedDatesJson: string }): DeliveryDayConfig {
  return { weekdays: safeWeekdays(area.weekdaysJson), leadTimeDays: area.leadTimeDays, blockedDates: safeBlockedDates(area.blockedDatesJson) };
}

/**
 * Nästa leveransdatum när en paus släpps: aldrig tidigare än den dag kassan
 * skulle erbjuda (framförhållning + helgdagar), på prenumerationens veckodag.
 */
export function resumedNextDate(current: Date, area: { weekdaysJson: string; leadTimeDays: number; blockedDatesJson: string }): Date {
  const config = areaConfig(area);
  const earliest = upcomingDeliveryDates(config, 1)[0];
  if (!earliest || current.getTime() >= earliest.getTime()) return current;
  return snapToWeekday(earliest, config.weekdays);
}

type Loaded = NonNullable<Awaited<ReturnType<typeof getSubscriptionByToken>>>;

async function load(token: string): Promise<Loaded | ManageResult> {
  const sub = await getSubscriptionByToken(token);
  if (!sub) return { ok: false, error: "Länken är ogiltig eller hör till en prenumeration som inte finns." };
  if (sub.status === "CANCELLED") return { ok: false, error: "Prenumerationen är avslutad. Starta en ny på /bestall om ni vill ha fika igen." };
  return sub;
}

const isResult = (x: unknown): x is ManageResult => typeof x === "object" && x !== null && "ok" in x;

export async function pauseByToken(token: string): Promise<ManageResult> {
  const sub = await load(token);
  if (isResult(sub)) return sub;
  if (sub.status === "PAUSED") return { ok: true, message: "Prenumerationen är redan pausad." };
  await prisma.subscription.update({ where: { id: sub.id }, data: { status: "PAUSED" } });
  await sendSubscriptionChangeEmail(sub.id, "PAUSED").catch(() => false);
  const pending = sub.orders.filter((o) => o.deliveryDate.getTime() >= todayInStockholm().getTime());
  return {
    ok: true,
    message: pending.length > 0
      ? `Pausad. Leveransen ${formatDeliveryDateWithYear(pending[0].deliveryDate)} (${pending[0].orderNumber}) är redan bekräftad och kommer som planerat – svara på orderbekräftelsen om ni vill avboka den.`
      : "Pausad. Inga nya leveranser eller fakturor skapas förrän ni startar igen.",
  };
}

export async function resumeByToken(token: string): Promise<ManageResult> {
  const sub = await load(token);
  if (isResult(sub)) return sub;
  if (sub.status === "ACTIVE") return { ok: true, message: "Prenumerationen är redan igång." };
  if (!sub.deliveryArea?.active) return { ok: false, error: "Leveransområdet är inte öppet just nu – svara på bekräftelsemejlet så hjälper vi till." };
  const next = resumedNextDate(sub.nextDeliveryDate, sub.deliveryArea);
  await prisma.subscription.update({ where: { id: sub.id }, data: { status: "ACTIVE", nextDeliveryDate: next } });
  await sendSubscriptionChangeEmail(sub.id, "RESUMED").catch(() => false);
  return { ok: true, message: `Igång igen. Nästa leverans planeras ${formatDeliveryDateWithYear(next)}.` };
}

/** Hoppa över nästa planerade leverans: kadensankaret flyttas ett steg. */
export async function skipNextByToken(token: string): Promise<ManageResult> {
  const sub = await load(token);
  if (isResult(sub)) return sub;
  if (sub.status !== "ACTIVE") return { ok: false, error: "Prenumerationen är pausad – starta den igen först." };
  if (!sub.deliveryArea) return { ok: false, error: "Leveransområde saknas – svara på bekräftelsemejlet så hjälper vi till." };
  const config = areaConfig(sub.deliveryArea);
  const period = toISODate(snapToDeliveryWeekday(sub.nextDeliveryDate, config));
  const created = sub.orders.find((o) => o.subscriptionPeriod === period);
  if (created) {
    return {
      ok: false,
      error: `Leveransen ${formatDeliveryDateWithYear(created.deliveryDate)} är redan bekräftad (order ${created.orderNumber}) och kan inte hoppas över här – svara på orderbekräftelsen om ni vill avboka den. Nästa leverans därefter kan hoppas över när den här har levererats.`,
    };
  }
  const next = nextCadenceDate(sub.nextDeliveryDate, sub.frequency as SubscriptionFrequency, config.weekdays);
  await prisma.subscription.update({ where: { id: sub.id }, data: { nextDeliveryDate: next } });
  await sendSubscriptionChangeEmail(sub.id, "DATE_CHANGED").catch(() => false);
  return { ok: true, message: `Leveransen ${formatDeliveryDateWithYear(snapToDeliveryWeekday(sub.nextDeliveryDate, config))} hoppas över. Nästa leverans planeras ${formatDeliveryDateWithYear(snapToDeliveryWeekday(next, config))}.` };
}

export async function updateByToken(
  token: string,
  frequency: string,
  items: { productId: string; weightKg: number }[]
): Promise<ManageResult> {
  const sub = await load(token);
  if (isResult(sub)) return sub;
  if (!(SUBSCRIPTION_FREQUENCY as readonly string[]).includes(frequency)) return { ok: false, error: "Välj ett intervall." };
  const clean = items
    .filter((i) => typeof i.productId === "string" && Number.isInteger(i.weightKg))
    .map((i) => ({ productId: i.productId, weightKg: Math.min(100, Math.max(0, i.weightKg)) }))
    .filter((i) => i.weightKg > 0);
  if (clean.length === 0) return { ok: false, error: "Välj minst en sort med mängd över noll – eller avsluta prenumerationen." };
  if (new Set(clean.map((i) => i.productId)).size !== clean.length) return { ok: false, error: "Samma sort får bara förekomma en gång." };
  const products = await prisma.product.findMany({ where: { id: { in: clean.map((i) => i.productId) }, active: true } });
  if (products.length !== clean.length) return { ok: false, error: "En vald sort finns inte längre – ladda om sidan." };
  await prisma.$transaction([
    prisma.subscriptionItem.deleteMany({ where: { subscriptionId: sub.id } }),
    prisma.subscriptionItem.createMany({ data: clean.map((i) => ({ subscriptionId: sub.id, productId: i.productId, weightKg: i.weightKg })) }),
    prisma.subscription.update({ where: { id: sub.id }, data: { frequency } }),
  ]);
  const summary = clean.map((i) => {
    const p = products.find((x) => x.id === i.productId)!;
    return `${i.weightKg} ${p.unit} ${p.name}`;
  }).join(", ");
  await sendSubscriptionChangeEmail(sub.id, "UPDATED", summary).catch(() => false);
  return { ok: true, message: `Sparat – gäller från nästa leverans: ${summary}.` };
}

export async function cancelByToken(token: string): Promise<ManageResult> {
  const sub = await load(token);
  if (isResult(sub)) return sub;
  await prisma.subscription.update({ where: { id: sub.id }, data: { status: "CANCELLED", idempotencyKey: null } });
  await sendSubscriptionChangeEmail(sub.id, "CANCELLED").catch(() => false);
  const pending = sub.orders.filter((o) => o.deliveryDate.getTime() >= todayInStockholm().getTime());
  return {
    ok: true,
    message: pending.length > 0
      ? `Avslutad. Leveransen ${formatDeliveryDateWithYear(pending[0].deliveryDate)} (${pending[0].orderNumber}) är redan bekräftad och kommer som planerat – svara på orderbekräftelsen om ni vill avboka den.`
      : "Avslutad. Inga fler leveranser eller fakturor skapas.",
  };
}

/** Dagen efter i dag – används i vyn för att visa vilka leveranser som ligger framåt. */
export function tomorrowInStockholm(): Date {
  return addDays(todayInStockholm(), 1);
}
