"use server";

// Admin server actions. Varje åtgärd (utom login) verifierar sessionen
// server-side — route-skyddet i layouten är bara första linjen.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAdmin, loginAdmin, logoutAdmin } from "@/lib/auth/session";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { sendOrderEmails } from "@/lib/orders/order-emails";
import { sendEmail } from "@/lib/email";
import { parseSnapshot } from "@/lib/invoice/snapshot";
import { renderInvoicePdf } from "@/lib/invoice/pdf";
import { generateDueSubscriptionOrders } from "@/lib/subscriptions/service";
import { formatOre } from "@/lib/money";
import { fromISODate, todayInStockholm } from "@/lib/dates";
import { canTransitionOrder } from "@/lib/status";

async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

// ---------- Auth ----------

export async function loginAction(
  _prev: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const hdrs = await headers();
  const limit = rateLimit(clientKey(hdrs, "admin-login"), { limit: 5, windowMs: 5 * 60_000 });
  if (!limit.ok) {
    return { error: `För många inloggningsförsök — vänta ${limit.retryAfterSeconds} sekunder.` };
  }

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Ange e-post och lösenord." };

  const ok = await loginAdmin(email, password);
  if (!ok) {
    // JSON-encoda: rå formdata i loggrader möjliggör annars loggforgery via radbrytningar.
    console.warn(`[admin] misslyckad inloggning för ${JSON.stringify(email.slice(0, 200))}`);
    return { error: "Fel e-post eller lösenord." };
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

export async function markOrderPaid(orderId: string, note: string) {
  const admin = await requireAdmin();
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { invoice: true } });
  if (!order || !canTransitionOrder(order, "pay")) return;
  const now = new Date();
  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: "PAID", status: order.status === "NEW" ? "CONFIRMED" : order.status },
    }),
    ...(order.invoice
      ? [
          prisma.invoice.update({
            where: { id: order.invoice.id },
            data: { status: "PAID", paidAt: now },
          }),
        ]
      : []),
  ]);
  await logEvent(
    orderId,
    "PAID",
    `Markerad som betald${note ? ` — ${note}` : ""}`,
    admin.email
  );
  revalidatePath("/admin", "layout");
}

export async function markOrderDelivered(orderId: string, note: string) {
  const admin = await requireAdmin();
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || !canTransitionOrder(order, "deliver")) return;
  await prisma.order.update({
    where: { id: orderId },
    data: {
      deliveryStatus: "DELIVERED",
      deliveredAt: new Date(),
      deliveryNote: note || order.deliveryNote,
      status: order.status === "NEW" ? "CONFIRMED" : order.status,
    },
  });
  await logEvent(orderId, "DELIVERED", `Markerad som levererad${note ? ` — ${note}` : ""}`, admin.email);
  revalidatePath("/admin", "layout");
}

export async function confirmOrder(orderId: string) {
  const admin = await requireAdmin();
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || !canTransitionOrder(order, "confirm")) return;
  await prisma.order.update({ where: { id: orderId }, data: { status: "CONFIRMED" } });
  await logEvent(orderId, "CONFIRMED", "Order bekräftad", admin.email);
  revalidatePath("/admin", "layout");
}

export async function cancelOrder(orderId: string, note: string) {
  const admin = await requireAdmin();
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || !canTransitionOrder(order, "cancel")) return;
  await prisma.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
  await logEvent(orderId, "CANCELLED", `Order avbruten${note ? ` — ${note}` : ""}`, admin.email);
  revalidatePath("/admin", "layout");
}

export async function addOrderNote(orderId: string, note: string) {
  const admin = await requireAdmin();
  if (!note.trim()) return;
  await logEvent(orderId, "NOTE", note.trim(), admin.email);
  revalidatePath(`/admin/bestallningar/${orderId}`);
}

export async function resendInvoiceEmail(orderId: string) {
  const admin = await requireAdmin();
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { invoice: true } });
  if (!order?.invoice) return;

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
}

export async function resendOrderEmails(orderId: string) {
  const admin = await requireAdmin();
  await sendOrderEmails(orderId);
  await logEvent(orderId, "EMAIL", "Orderbekräftelse och faktura skickade igen", admin.email);
  revalidatePath(`/admin/bestallningar/${orderId}`);
}

// ---------- Prenumerationer ----------

export async function setSubscriptionStatus(id: string, status: "ACTIVE" | "PAUSED" | "CANCELLED") {
  await requireAdmin();
  await prisma.subscription.update({ where: { id }, data: { status } });
  revalidatePath("/admin/prenumerationer");
}

export async function setSubscriptionNextDate(id: string, isoDate: string) {
  await requireAdmin();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return;
  const date = fromISODate(isoDate);
  // Passerade datum skulle få generatorn att skapa bakdaterade ordrar.
  if (date.getTime() < todayInStockholm().getTime()) return;
  await prisma.subscription.update({
    where: { id },
    data: { nextDeliveryDate: date },
  });
  revalidatePath("/admin/prenumerationer");
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
    .regex(/^[a-z0-9-]{2,60}$/, "Slug: små bokstäver, siffror och bindestreck"),
  description: z.string().trim().min(2).max(500),
  priceKr: z.coerce.number().min(0).max(100000),
  weightOptions: z
    .string()
    .trim()
    .regex(/^\d+(\s*,\s*\d+)*$/, "Ange viktalternativ som t.ex. 1,2,3"),
  ingredients: z.string().trim().max(1000).default(""),
  allergens: z.string().trim().max(500).default(""),
  imageRef: z.string().trim().max(300).default(""),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  active: z.coerce.boolean().default(false),
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
    weightOptions: formData.get("weightOptions"),
    ingredients: formData.get("ingredients") ?? "",
    allergens: formData.get("allergens") ?? "",
    imageRef: formData.get("imageRef") ?? "",
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
    weightOptionsJson: JSON.stringify(
      d.weightOptions.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => n > 0)
    ),
    ingredients: d.ingredients,
    allergens: d.allergens,
    imageRef: d.imageRef,
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

export async function setProductActive(productId: string, active: boolean) {
  await requireAdmin();
  await prisma.product.update({ where: { id: productId }, data: { active } });
  revalidatePath("/admin/produkter");
}

// ---------- Leveransinställningar ----------

const areaSchema = z.object({
  weekdays: z.string().regex(/^[1-7](\s*,\s*[1-7])*$/, "Veckodagar: t.ex. 2,4 (1=mån ... 7=sön)"),
  leadTimeDays: z.coerce.number().int().min(0).max(30),
  postalPrefixes: z
    .string()
    .trim()
    .regex(/^$|^\d{2,5}(\s*,\s*\d{2,5})*$/, "Postnummerprefix: t.ex. 135,136 (tomt = ingen spärr)"),
  active: z.coerce.boolean(),
});

export async function saveArea(
  areaId: string,
  _prev: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  await requireAdmin();
  const parsed = areaSchema.safeParse({
    weekdays: formData.get("weekdays"),
    leadTimeDays: formData.get("leadTimeDays"),
    postalPrefixes: formData.get("postalPrefixes") ?? "",
    active: formData.get("active") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Kontrollera fälten" };
  const d = parsed.data;
  await prisma.deliveryArea.update({
    where: { id: areaId },
    data: {
      weekdaysJson: JSON.stringify([...new Set(d.weekdays.split(",").map((s) => parseInt(s.trim(), 10)))]),
      leadTimeDays: d.leadTimeDays,
      postalCodePrefixesJson: JSON.stringify(
        d.postalPrefixes ? d.postalPrefixes.split(",").map((s) => s.trim()) : []
      ),
      active: d.active,
    },
  });
  revalidatePath("/admin/installningar");
  return null;
}
