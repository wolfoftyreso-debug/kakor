"use server";

// Admin server actions. Varje åtgärd (utom login) verifierar sessionen
// server-side — route-skyddet i layouten är bara första linjen.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { safeBlockedDates, safeWeekdays } from "@/lib/products";
import { prisma } from "@/lib/db";
import { getAdmin, loginAdmin, logoutAdmin } from "@/lib/auth/session";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { maskEmail } from "@/lib/log";
import { sendDeliveryConfirmationEmail, sendOrderEmails, sendPaymentReminderEmail } from "@/lib/orders/order-emails";
import { issueCreditNoteInTx, sendCreditNoteEmail, CreditError } from "@/lib/invoice/credit";
import { isoDateSchema } from "@/lib/validation";
import { createHash } from "node:crypto";
import { addDays } from "@/lib/dates";
import { sendEmail } from "@/lib/email";
import { parseSnapshot } from "@/lib/invoice/snapshot";
import { renderInvoicePdf } from "@/lib/invoice/pdf";
import { generateDueSubscriptionOrders } from "@/lib/subscriptions/service";
import { formatOre } from "@/lib/money";
import { fromISODate, todayInStockholm, isoWeekday, weekdayName, toISODate, swedishHolidayName } from "@/lib/dates";
import { canTransitionOrder, SUBSCRIPTION_FREQUENCY } from "@/lib/status";

async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

// ---------- Auth ----------

export async function loginAction(
  _prev: { error: string; email?: string } | null,
  formData: FormData
): Promise<{ error: string; email?: string } | null> {
  const hdrs = await headers();
  const rawEmail = String(formData.get("email") ?? "").slice(0, 200);
  // Per IP OCH per konto (delad räknare): distribuerat brute force mot ett
  // känt adminmejl begränsas annars bara av scrypt-kostnaden.
  const ipLimit = await rateLimit(clientKey(hdrs, "admin-login"), { limit: 5, windowMs: 5 * 60_000 });
  if (!ipLimit.ok) {
    return { error: `För många inloggningsförsök — vänta ${ipLimit.retryAfterSeconds} sekunder.`, email: rawEmail };
  }
  // Kontonyckeln hashas: godtyckliga strängar ska inte bli rader i databasen.
  const accountKey = createHash("sha256").update(rawEmail.toLowerCase().trim()).digest("hex").slice(0, 32);
  const accountLimit = await rateLimit(`admin-login-account:${accountKey}`, { limit: 10, windowMs: 15 * 60_000 });
  if (!accountLimit.ok) {
    return { error: `För många inloggningsförsök — vänta ${accountLimit.retryAfterSeconds} sekunder.`, email: rawEmail };
  }

  // Längdgränser innan scrypt: obegränsat lösenord = gratis CPU-förstärkning.
  const parsedLogin = z
    .object({ email: z.string().trim().email().max(200), password: z.string().min(1).max(256) })
    .safeParse({ email: rawEmail, password: formData.get("password") ?? "" });
  if (!parsedLogin.success) return { error: "Ange e-post och lösenord.", email: rawEmail };
  const { email, password } = parsedLogin.data;

  const ok = await loginAdmin(email, password);
  if (!ok) {
    console.warn(`[admin] misslyckad inloggning för ${maskEmail(email)}`);
    return { error: "Fel e-post eller lösenord.", email };
  }
  redirect("/admin");
}

export async function logoutAction() {
  await logoutAdmin();
  redirect("/admin/login");
}

// ---------- Orderåtgärder ----------

async function logEvent(orderId: string, type: string, message: string, actor: string) {
  await prisma.orderEvent.create({ data: { orderId, type, message, actor } });
}

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const noteSchema = z.string().trim().max(500, "Noteringen är för lång (max 500 tecken)").default("");
const idSchema = z.string().cuid();

export async function markOrderPaid(orderId: string, note: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!idSchema.safeParse(orderId).success) return { ok: false, error: "Ogiltigt order-id" };
  const parsedNote = noteSchema.safeParse(note);
  if (!parsedNote.success) return { ok: false, error: parsedNote.error.issues[0].message };
  note = parsedNote.data;
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { invoice: true } });
  if (!order) return { ok: false, error: "Ordern finns inte" };
  if (!canTransitionOrder(order, "pay")) return { ok: false, error: "Ordern kan inte markeras som betald i nuvarande status" };
  const now = new Date();
  // Villkorad uppdatering: två flikar (betala + avbryt samtidigt) får aldrig
  // ge PAID + CANCELLED — övergången gäller bara om tillståndet är oförändrat.
  const changed = await prisma.$transaction(async (tx) => {
    const res = await tx.order.updateMany({
      where: { id: orderId, status: { not: "CANCELLED" }, paymentStatus: "UNPAID" },
      data: { paymentStatus: "PAID", status: order.status === "NEW" ? "CONFIRMED" : order.status },
    });
    if (res.count !== 1) return false;
    if (order.invoice) {
      await tx.invoice.update({ where: { id: order.invoice.id }, data: { status: "PAID", paidAt: now } });
    }
    return true;
  });
  if (!changed) return { ok: false, error: "Ordern ändrades samtidigt av någon annan — ladda om sidan" };
  await logEvent(
    orderId,
    "PAID",
    `Markerad som betald${note ? ` — ${note}` : ""}`,
    admin.email
  );
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Markerad som betald" };
}

export async function markOrderDelivered(orderId: string, note: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!idSchema.safeParse(orderId).success) return { ok: false, error: "Ogiltigt order-id" };
  const parsedNote = noteSchema.safeParse(note);
  if (!parsedNote.success) return { ok: false, error: parsedNote.error.issues[0].message };
  note = parsedNote.data;
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, error: "Ordern finns inte" };
  if (!canTransitionOrder(order, "deliver")) return { ok: false, error: "Ordern kan inte markeras som levererad i nuvarande status" };
  const res = await prisma.order.updateMany({
    where: { id: orderId, status: { not: "CANCELLED" }, deliveryStatus: "PENDING" },
    data: {
      deliveryStatus: "DELIVERED",
      deliveredAt: new Date(),
      deliveryNote: note || order.deliveryNote,
      status: order.status === "NEW" ? "CONFIRMED" : order.status,
    },
  });
  if (res.count !== 1) return { ok: false, error: "Ordern ändrades samtidigt av någon annan — ladda om sidan" };
  await logEvent(orderId, "DELIVERED", `Markerad som levererad${note ? ` — ${note}` : ""}`, admin.email);
  // Kunden får veta att kakorna är framme. Mejlfel stoppar aldrig statusändringen.
  let mailed = false;
  try {
    mailed = await sendDeliveryConfirmationEmail(orderId);
  } catch (e) {
    console.error("Leveransbekräftelse misslyckades:", e instanceof Error ? e.message.slice(0, 300) : e);
  }
  if (mailed) await logEvent(orderId, "EMAIL", "Leveransbekräftelse skickad till kunden", "system");
  revalidatePath("/admin", "layout");
  return { ok: true, message: mailed ? "Markerad som levererad — kunden har fått leveransbekräftelse" : "Markerad som levererad (leveransbekräftelsen kunde inte skickas — se e-postloggen)" };
}

/** Manuell betalningspåminnelse — fakturan bifogas igen. Loggas i historiken. */
export async function sendPaymentReminder(orderId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!idSchema.safeParse(orderId).success) return { ok: false, error: "Ogiltigt order-id" };
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { invoice: true } });
  if (!order || !order.invoice) return { ok: false, error: "Ordern har ingen faktura" };
  if (order.status === "CANCELLED") return { ok: false, error: "Ordern är avbruten — ingen påminnelse" };
  if (order.paymentStatus === "PAID") return { ok: false, error: "Fakturan är redan betald" };
  if (order.invoice.status === "CREDITED") return { ok: false, error: "Fakturan är krediterad i sin helhet" };
  const sent = await sendPaymentReminderEmail(orderId);
  if (!sent) return { ok: false, error: "Påminnelsen kunde inte skickas — se e-postloggen" };
  await logEvent(orderId, "EMAIL", `Betalningspåminnelse skickad till ${order.invoiceEmail}`, admin.email);
  revalidatePath("/admin", "layout");
  return { ok: true, message: `Påminnelse skickad till ${order.invoiceEmail}` };
}

export async function confirmOrder(orderId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!idSchema.safeParse(orderId).success) return { ok: false, error: "Ogiltigt order-id" };
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, error: "Ordern finns inte" };
  if (!canTransitionOrder(order, "confirm")) return { ok: false, error: "Ordern kan inte bekräftas i nuvarande status" };
  const res = await prisma.order.updateMany({
    where: { id: orderId, status: "NEW" },
    data: { status: "CONFIRMED" },
  });
  if (res.count !== 1) return { ok: false, error: "Ordern ändrades samtidigt av någon annan — ladda om sidan" };
  await logEvent(orderId, "CONFIRMED", "Order bekräftad", admin.email);
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Order bekräftad" };
}

export async function cancelOrder(orderId: string, note: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!idSchema.safeParse(orderId).success) return { ok: false, error: "Ogiltigt order-id" };
  const parsedNote = noteSchema.safeParse(note);
  if (!parsedNote.success) return { ok: false, error: parsedNote.error.issues[0].message };
  note = parsedNote.data;
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { invoice: true } });
  if (!order) return { ok: false, error: "Ordern finns inte" };
  if (!canTransitionOrder(order, "cancel")) return { ok: false, error: "Betald eller levererad order kan inte avbrytas — kreditera manuellt" };
  // Avbrytande + kreditering i EN transaktion: en avbruten order utan
  // kreditfaktura får aldrig uppstå (bokföringskrav). Mejlet går efter commit.
  let creditId: string | null = null;
  let creditNumber = "";
  try {
    await prisma.$transaction(
      async (tx) => {
        const res = await tx.order.updateMany({
          where: { id: orderId, status: { not: "CANCELLED" }, paymentStatus: "UNPAID", deliveryStatus: "PENDING" },
          data: { status: "CANCELLED" },
        });
        if (res.count !== 1) throw new Error("CONCURRENT");
        await tx.orderEvent.create({
          data: { orderId, type: "CANCELLED", message: `Order avbruten${note ? ` — ${note}` : ""}`, actor: admin.email },
        });
        if (order.invoice) {
          const credit = await issueCreditNoteInTx(tx, order.invoice.id, admin.email);
          if (credit) {
            creditId = credit.id;
            creditNumber = credit.creditNumber;
          }
        }
      },
      { timeout: 15000 }
    );
  } catch (e) {
    if (e instanceof Error && e.message === "CONCURRENT") {
      return { ok: false, error: "Ordern ändrades samtidigt av någon annan — ladda om sidan" };
    }
    console.error("Avbryt order misslyckades:", e instanceof Error ? e.message.slice(0, 300) : e);
    return { ok: false, error: "Ordern kunde inte avbrytas — ingenting har ändrats. Försök igen." };
  }
  const mailed = creditId ? await sendCreditNoteEmail(creditId) : false;
  revalidatePath("/admin", "layout");
  return {
    ok: true,
    message: creditNumber
      ? `Order avbruten. Kreditfaktura ${creditNumber} utfärdad${mailed ? " och mejlad" : " — mejlet kunde inte skickas, skicka igen från fakturalistan"}.`
      : "Order avbruten.",
  };
}

/** Säkerhetsnät: kreditera en redan avbruten order som saknar kreditfaktura. */
export async function issueCreditNoteForOrder(orderId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!idSchema.safeParse(orderId).success) return { ok: false, error: "Ogiltigt order-id" };
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { invoice: true } });
  if (!order?.invoice) return { ok: false, error: "Ordern saknar faktura" };
  if (order.status !== "CANCELLED") return { ok: false, error: "Bara avbrutna ordrar krediteras här" };
  if (order.invoice.status === "CREDITED") return { ok: false, error: "Fakturan är redan krediterad" };
  const credit = await prisma.$transaction((tx) => issueCreditNoteInTx(tx, order.invoice!.id, admin.email), { timeout: 15000 });
  if (!credit) return { ok: false, error: "Krediteringen misslyckades" };
  const mailed = await sendCreditNoteEmail(credit.id);
  revalidatePath("/admin", "layout");
  return { ok: true, message: `Kreditfaktura ${credit.creditNumber} utfärdad${mailed ? " och mejlad" : ""}.` };
}

const partialCreditSchema = z.object({
  lines: z
    .array(z.object({ lineIndex: z.number().int().min(0).max(99), qty: z.number().int().min(1).max(100) }))
    .min(1, "Välj minst en rad att kreditera")
    .max(30),
  reason: z.string().trim().max(200, "Anledningen är för lång (max 200 tecken)").default(""),
});

/**
 * Delkreditering: valda rader/mängder på en levererad (eller pågående) order —
 * fel sort, saknad vikt, reklamation. Fakturan står kvar; blir allt krediterat
 * stängs den som CREDITED. Kreditfakturan mejlas till fakturamottagaren.
 */
export async function issuePartialCreditNote(
  orderId: string,
  lines: { lineIndex: number; qty: number }[],
  reason: string
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!idSchema.safeParse(orderId).success) return { ok: false, error: "Ogiltigt order-id" };
  const parsed = partialCreditSchema.safeParse({ lines, reason });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Ogiltiga uppgifter" };
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { invoice: true } });
  if (!order?.invoice) return { ok: false, error: "Ordern saknar faktura" };
  if (order.status === "CANCELLED") return { ok: false, error: "Avbrutna ordrar krediteras i sin helhet — använd Avbryt order" };
  if (order.invoice.status === "CREDITED") return { ok: false, error: "Fakturan är redan krediterad i sin helhet" };
  let credit: Awaited<ReturnType<typeof issueCreditNoteInTx>>;
  try {
    credit = await prisma.$transaction(
      (tx) => issueCreditNoteInTx(tx, order.invoice!.id, admin.email, { lines: parsed.data.lines, reason: parsed.data.reason }),
      { timeout: 15000 }
    );
  } catch (e) {
    if (e instanceof CreditError) return { ok: false, error: e.message };
    console.error("Delkreditering misslyckades:", e instanceof Error ? e.message.slice(0, 300) : e);
    return { ok: false, error: "Krediteringen misslyckades — ingenting har ändrats" };
  }
  if (!credit) return { ok: false, error: "Inget återstår att kreditera" };
  const mailed = await sendCreditNoteEmail(credit.id);
  revalidatePath("/admin", "layout");
  return {
    ok: true,
    message: `Kreditfaktura ${credit.creditNumber} (${formatOre(-credit.totalOre)}) utfärdad${mailed ? " och mejlad" : " — mejlet kunde inte skickas"}.${credit.kind === "FULL" ? " Hela fakturan är nu krediterad." : ""}`,
  };
}

export async function addOrderNote(orderId: string, note: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!idSchema.safeParse(orderId).success) return { ok: false, error: "Ogiltigt order-id" };
  const parsedNote = z.string().trim().min(1).max(1000, "Noteringen är för lång (max 1000 tecken)").safeParse(note);
  if (!parsedNote.success) return { ok: false, error: parsedNote.error.issues[0]?.message ?? "Skriv en notering" };
  await logEvent(orderId, "NOTE", parsedNote.data, admin.email);
  revalidatePath(`/admin/bestallningar/${orderId}`);
  return { ok: true, message: "Notering sparad" };
}

export async function resendInvoiceEmail(orderId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!idSchema.safeParse(orderId).success) return { ok: false, error: "Ogiltigt order-id" };
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { invoice: true } });
  if (!order?.invoice) return { ok: false, error: "Ordern saknar faktura" };
  if (order.invoice.status === "CREDITED") return { ok: false, error: "Fakturan är krediterad — skicka inte om den" };
  if (order.invoice.status === "PAID") return { ok: false, error: "Fakturan är registrerad som betald — inget att kräva" };

  let attachments: { filename: string; content: Buffer; contentType: string }[] | undefined;
  try {
    const snapshot = parseSnapshot(order.invoice.snapshotJson);
    const pdf = await renderInvoicePdf(snapshot, order.invoice.invoiceNumber);
    attachments = [
      {
        filename: `faktura-${order.invoice.invoiceNumber}.pdf`,
        content: pdf,
        contentType: "application/pdf",
      },
    ];
  } catch (e) {
    console.error("PDF vid omskick misslyckades:", e);
  }
  const sent = await sendEmail({
    to: order.invoiceEmail,
    subject: `Faktura ${order.invoice.invoiceNumber} — Sockerbagaren`,
    text: `Faktura ${order.invoice.invoiceNumber} från Sockerbagaren (order ${order.orderNumber}).

Belopp att betala: ${formatOre(order.totalOre)}
Förfallodatum: ${order.invoice.dueDate.toISOString().slice(0, 10)}

Vänliga hälsningar
Sockerbagaren`,
    attachments,
    type: "INVOICE_RESEND",
    orderId: order.id,
  });
  await logEvent(
    orderId,
    "EMAIL",
    sent ? "Faktura skickad igen" : "Omskick av faktura misslyckades",
    admin.email
  );
  revalidatePath(`/admin/bestallningar/${orderId}`);
  return sent
    ? { ok: true, message: `Faktura skickad till ${order.invoiceEmail}` }
    : { ok: false, error: "Mejlet kunde inte skickas — se e-postloggen" };
}

export async function resendOrderEmails(orderId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!idSchema.safeParse(orderId).success) return { ok: false, error: "Ogiltigt order-id" };
  const sent = await sendOrderEmails(orderId);
  await logEvent(
    orderId,
    "EMAIL",
    sent ? "Orderbekräftelse och faktura skickade igen" : "Omskick av bekräftelse/faktura misslyckades",
    admin.email
  );
  revalidatePath(`/admin/bestallningar/${orderId}`);
  return sent
    ? { ok: true, message: "Orderbekräftelse och faktura skickade igen" }
    : { ok: false, error: "Minst ett mejl kunde inte skickas — se e-postloggen" };
}

// ---------- Prenumerationer ----------

export async function setSubscriptionStatus(
  id: string,
  status: "ACTIVE" | "PAUSED" | "CANCELLED"
): Promise<{ error: string } | null> {
  await requireAdmin();
  // Server actions är publika endpoints — TS-unionen skyddar inte i runtime.
  const parsed = z.enum(["ACTIVE", "PAUSED", "CANCELLED"]).safeParse(status);
  if (!parsed.success) return { error: "Ogiltig status" };
  const current = await prisma.subscription.findUnique({ where: { id }, select: { status: true } });
  if (!current) return { error: "Prenumerationen finns inte" };
  if (current.status === "CANCELLED") return { error: "En avslutad prenumeration kan inte återaktiveras" };
  await prisma.subscription.update({ where: { id }, data: { status: parsed.data } });
  revalidatePath("/admin/prenumerationer");
  return null;
}

export async function setSubscriptionNextDate(id: string, isoDate: string): Promise<{ error: string } | null> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { error: "Ogiltigt id" };
  const parsedDate = isoDateSchema("Ange datum som ÅÅÅÅ-MM-DD").safeParse(isoDate);
  if (!parsedDate.success) return { error: parsedDate.error.issues[0]?.message ?? "Ogiltigt datum" };
  const date = fromISODate(parsedDate.data);
  const sub = await prisma.subscription.findUnique({ where: { id }, include: { deliveryArea: true } });
  if (!sub) return { error: "Prenumerationen finns inte" };
  if (!sub.deliveryArea?.active) return { error: "Leveransområdet är inaktivt — aktivera det under Inställningar först" };
  // Aldrig idag eller bakåt — generatorn skulle skapa en order som inte hinner packas.
  const earliest = addDays(todayInStockholm(), 1);
  if (date.getTime() < earliest.getTime()) {
    return { error: `Tidigast ${toISODate(earliest)} — leverans samma dag går inte att planera` };
  }
  // Bara områdets leveransdagar — annars skapar generatorn en order på en dag utan leverans.
  const weekdays = safeWeekdays(sub.deliveryArea.weekdaysJson);
  if (weekdays.length > 0 && !weekdays.includes(isoWeekday(date))) {
    return { error: `${sub.deliveryArea.name} levererar bara ${weekdays.map(weekdayName).join(", ")}` };
  }
  const holiday = swedishHolidayName(date);
  if (holiday) return { error: `${toISODate(date)} är ${holiday} — ingen leverans den dagen` };
  if (safeBlockedDates(sub.deliveryArea.blockedDatesJson).includes(toISODate(date))) {
    return { error: `${toISODate(date)} är spärrat under Inställningar` };
  }
  await prisma.subscription.update({
    where: { id },
    data: { nextDeliveryDate: date },
  });
  revalidatePath("/admin/prenumerationer");
  return null;
}

export async function runSubscriptionGeneration(): Promise<{ generated: number; skipped: number }> {
  await requireAdmin();
  const result = await generateDueSubscriptionOrders();
  revalidatePath("/admin", "layout");
  return { generated: result.generated.length, skipped: result.skipped.length };
}

// ---------- Produkter ----------

const productSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{2,60}$/, "Slug: små bokstäver, siffror och bindestreck")
    .refine((v) => !["constructor", "prototype", "__proto__", "tostring", "valueof"].includes(v), "Slug är reserverad"),
  description: z.string().trim().min(2).max(500),
  priceKr: z.coerce.number().min(0.01, "Ange ett pris över 0 kr").max(100000),
  // Momssats i baspunkter. Livsmedel: tillfälligt 6 % t.o.m. 2027-12-31,
  // därefter 12 %. Restaurang/catering 12 %, övrigt 25 %.
  vatRateBp: z.coerce.number().int().refine((v) => [600, 1200, 2500].includes(v), "Momssats: 6, 12 eller 25 %").default(600),
  unit: z.enum(["kg", "paket"]).default("kg"),
  packageWeightGrams: z.coerce.number().int().min(0).max(100000).default(0),
  weightOptions: z
    .string()
    .trim()
    .regex(/^\d+(\s*,\s*\d+)*$/, "Ange viktalternativ som t.ex. 1,2,3"),
  ingredients: z.string().trim().max(1000).default(""),
  allergens: z.string().trim().max(500).default(""),
  // Endast bilder under /public/images — fri sträng gav en existens-orakel
  // för filsystemet (../-traversal i produktsidans existsSync) och externa URL:er.
  imageRef: z
    .string()
    .trim()
    .regex(/^\/images\/[a-z0-9-]+\.(jpe?g|png|webp)$/, "Bildreferens: /images/namn.jpg")
    .or(z.literal(""))
    .default(""),
  badge: z.string().trim().max(30).default(""),
  // Ungefärligt antal kakor per kilo — svar på kundens vanligaste fråga ("räcker 2 kg till 30 personer?").
  piecesPerKgApprox: z
    .union([z.literal(""), z.coerce.number().int().min(1, "Minst 1 kaka per kilo").max(500, "Max 500 kakor per kilo")])
    .default(""),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  active: z.coerce.boolean().default(false),
}).superRefine((d, ctx) => {
  // Styckvara utan paketvikt ger 0 kg i checkoutens viktsummering.
  if (d.unit === "paket" && d.packageWeightGrams <= 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["packageWeightGrams"], message: "Ange paketvikt i gram för styckvaror" });
  }
});

export async function saveProduct(
  productId: string | null,
  _prev: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  await requireAdmin();
  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    priceKr: formData.get("priceKr"),
    vatRateBp: formData.get("vatRateBp") ?? 1200,
    unit: formData.get("unit") ?? "kg",
    packageWeightGrams: formData.get("packageWeightGrams") ?? 0,
    weightOptions: formData.get("weightOptions"),
    ingredients: formData.get("ingredients") ?? "",
    allergens: formData.get("allergens") ?? "",
    imageRef: formData.get("imageRef") ?? "",
    badge: formData.get("badge") ?? "",
    piecesPerKgApprox: String(formData.get("piecesPerKgApprox") ?? "").trim(),
    sortOrder: formData.get("sortOrder") ?? 0,
    active: formData.get("active") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Kontrollera fälten" };
  }
  const d = parsed.data;
  const data = {
    name: d.name,
    slug: d.slug,
    description: d.description,
    pricePerKgOre: Math.round(d.priceKr * 100),
    vatRateBp: d.vatRateBp,
    unit: d.unit,
    packageWeightGrams: d.packageWeightGrams,
    // Förval över serverns tak (100) skulle bara klampas i korgen — filtrera bort.
    weightOptionsJson: JSON.stringify(
      d.weightOptions
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => n > 0 && n <= 100)
    ),
    ingredients: d.ingredients,
    allergens: d.allergens,
    imageRef: d.imageRef,
    badge: d.badge,
    piecesPerKgApprox: d.piecesPerKgApprox === "" ? null : d.piecesPerKgApprox,
    sortOrder: d.sortOrder,
    active: d.active,
  };
  try {
    if (productId) {
      await prisma.product.update({ where: { id: productId }, data });
    } else {
      await prisma.product.create({ data });
    }
  } catch {
    return { error: "Kunde inte spara — kontrollera att slug är unik." };
  }
  revalidatePath("/admin/produkter");
  redirect("/admin/produkter");
}

export async function setProductActive(productId: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(productId).success) return { ok: false, error: "Ogiltigt produkt-id" };
  const parsedActive = z.boolean().safeParse(active);
  if (!parsedActive.success) return { ok: false, error: "Ogiltigt värde" };
  const product = await prisma.product.update({ where: { id: productId }, data: { active: parsedActive.data } });
  revalidatePath("/admin/produkter");
  revalidatePath("/", "layout");
  return { ok: true, message: `${product.name} är nu ${parsedActive.data ? "aktiv" : "inaktiv"}` };
}

// ---------- Leveransinställningar ----------

const areaSchema = z.object({
  weekdays: z.string().regex(/^[1-7](\s*,\s*[1-7])*$/, "Veckodagar: t.ex. 4 för torsdag (1=mån ... 7=sön)"),
  leadTimeDays: z.coerce.number().int().min(0).max(30),
  postalPrefixes: z
    .string()
    .trim()
    .regex(/^$|^\d{2,5}(\s*,\s*\d{2,5})*$/, "Postnummerprefix: t.ex. 135,136 (tomt = ingen spärr)"),
  // Ett ISO-datum per rad eller kommaseparerat. Passerade datum rensas vid sparning.
  blockedDates: z
    .string()
    .trim()
    .transform((raw) =>
      raw
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    )
    .refine((arr) => arr.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(fromISODate(d).getTime())), {
      message: "Spärrade datum skrivs som ÅÅÅÅ-MM-DD, ett per rad (t.ex. 2026-12-17)",
    }),
  maxKgPerDay: z.coerce.number().int().min(0, "Max kg: 0 = ingen gräns").max(100000),
  active: z.coerce.boolean(),
});

export async function saveArea(
  areaId: string,
  _prev: { error?: string; saved?: string } | null,
  formData: FormData
): Promise<{ error?: string; saved?: string } | null> {
  await requireAdmin();
  const parsed = areaSchema.safeParse({
    weekdays: formData.get("weekdays"),
    leadTimeDays: formData.get("leadTimeDays"),
    postalPrefixes: formData.get("postalPrefixes") ?? "",
    blockedDates: formData.get("blockedDates") ?? "",
    maxKgPerDay: formData.get("maxKgPerDay") ?? 0,
    active: formData.get("active") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Kontrollera fälten" };
  const d = parsed.data;
  const today = toISODate(todayInStockholm());
  const blockedDates = [...new Set(d.blockedDates)].filter((iso) => iso >= today).sort();
  await prisma.deliveryArea.update({
    where: { id: areaId },
    data: {
      weekdaysJson: JSON.stringify([...new Set(d.weekdays.split(",").map((s) => parseInt(s.trim(), 10)))]),
      leadTimeDays: d.leadTimeDays,
      postalCodePrefixesJson: JSON.stringify(
        d.postalPrefixes ? d.postalPrefixes.split(",").map((s) => s.trim()) : []
      ),
      blockedDatesJson: JSON.stringify(blockedDates),
      maxKgPerDay: d.maxKgPerDay,
      active: d.active,
    },
  });
  revalidatePath("/admin/installningar");
  revalidatePath("/bestall");
  const days = [...new Set(d.weekdays.split(",").map((s) => parseInt(s.trim(), 10)))].map(weekdayName).join(", ");
  const blockedNote = `${blockedDates.length ? `, ${blockedDates.length} spärrade datum` : ""}${d.maxKgPerDay > 0 ? `, max ${d.maxKgPerDay} kg/dag` : ""}`;
  return { saved: `Sparat — leveransdagar: ${days}${blockedNote}${d.active ? "" : " (området är inaktivt)"}` };
}

// ---------- Ändra befintlig prenumeration ----------

const subscriptionUpdateSchema = z.object({
  frequency: z.enum(SUBSCRIPTION_FREQUENCY),
  items: z
    .array(z.object({ productId: z.string().cuid(), weightKg: z.coerce.number().int().min(1).max(100) }))
    .min(1, "Minst en sort")
    .max(30),
});

/**
 * Byt innehåll eller intervall på en prenumeration. Gäller från nästa leverans:
 * nästa datum rörs inte, och redan genererade ordrar påverkas aldrig.
 */
export async function updateSubscriptionContents(
  id: string,
  frequency: string,
  items: { productId: string; weightKg: number }[]
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Ogiltigt id" };
  const parsed = subscriptionUpdateSchema.safeParse({ frequency, items });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Kontrollera fälten" };
  const d = parsed.data;
  if (new Set(d.items.map((i) => i.productId)).size !== d.items.length) {
    return { ok: false, error: "Samma sort får bara förekomma en gång" };
  }
  const sub = await prisma.subscription.findUnique({ where: { id }, include: { items: true } });
  if (!sub) return { ok: false, error: "Prenumerationen finns inte" };
  if (sub.status === "CANCELLED") return { ok: false, error: "Prenumerationen är avslutad" };
  const products = await prisma.product.findMany({ where: { id: { in: d.items.map((i) => i.productId) }, active: true } });
  if (products.length !== d.items.length) return { ok: false, error: "En vald sort finns inte eller är inaktiv" };

  await prisma.$transaction([
    prisma.subscriptionItem.deleteMany({ where: { subscriptionId: id } }),
    prisma.subscriptionItem.createMany({ data: d.items.map((i) => ({ subscriptionId: id, productId: i.productId, weightKg: i.weightKg })) }),
    prisma.subscription.update({ where: { id }, data: { frequency: d.frequency } }),
  ]);
  const summary = d.items
    .map((i) => {
      const p = products.find((x) => x.id === i.productId)!;
      return `${i.weightKg} ${p.unit} ${p.name}`;
    })
    .join(", ");
  console.log(`[admin] ${maskEmail(admin.email)} ändrade ${sub.number}: ${d.frequency}; ${summary}`);
  revalidatePath("/admin/prenumerationer");
  return { ok: true, message: `Sparat — gäller från nästa leverans: ${summary}` };
}
