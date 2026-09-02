import { todayInStockholm } from "@/lib/dates";

// Separata statusmodeller — en order kan t.ex. vara CONFIRMED + UNPAID + DELIVERED.

export const ORDER_STATUS = ["NEW", "CONFIRMED", "CANCELLED"] as const;
export type OrderStatus = (typeof ORDER_STATUS)[number];

export const PAYMENT_STATUS = ["UNPAID", "PAID"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[number];

export const DELIVERY_STATUS = ["PENDING", "DELIVERED"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUS)[number];

export const INVOICE_STATUS = ["UNPAID", "PAID", "CREDITED"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUS)[number];

export const SUBSCRIPTION_STATUS = ["ACTIVE", "PAUSED", "CANCELLED"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[number];

export const SUBSCRIPTION_FREQUENCY = ["WEEKLY", "BIWEEKLY", "MONTHLY"] as const;
export type SubscriptionFrequency = (typeof SUBSCRIPTION_FREQUENCY)[number];

// MONTHLY = var 28:e dag (fast leveransveckodag) — etiketten ska inte lova kalendermånad.
export const FREQUENCY_LABELS: Record<SubscriptionFrequency, string> = {
  WEEKLY: "Varje vecka",
  BIWEEKLY: "Varannan vecka",
  MONTHLY: "Var fjärde vecka",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: "Ny",
  CONFIRMED: "Bekräftad",
  CANCELLED: "Avbruten",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: "Obetald",
  PAID: "Betald",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  UNPAID: "Obetald",
  PAID: "Betald",
  CREDITED: "Krediterad",
};

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  PENDING: "Ej levererad",
  DELIVERED: "Levererad",
};

/**
 * OVERDUE lagras aldrig — den beräknas alltid från förfallodatum + status.
 * "Idag" räknas i svensk tid (inte serverns lokala tidszon); förfallen först
 * dagen EFTER förfallodatumet.
 */
export function isInvoiceOverdue(invoice: { status: string; dueDate: Date }, now = new Date()): boolean {
  return invoice.status === "UNPAID" && invoice.dueDate.getTime() < todayInStockholm(now).getTime();
}

/** En avbruten order är aldrig "förfallen" — fakturan drivs inte in. */
export function isOrderOverdue(
  order: { status: string; invoice: { status: string; dueDate: Date } | null },
  now = new Date()
): boolean {
  return order.status !== "CANCELLED" && !!order.invoice && isInvoiceOverdue(order.invoice, now);
}

/**
 * Servervakt för orderövergångar — UI:t döljer knappar, men server actions är
 * anropbara endpoints och får aldrig lita på klienten.
 */
export function canTransitionOrder(
  order: { status: string; paymentStatus: string; deliveryStatus: string },
  action: "pay" | "deliver" | "confirm" | "cancel"
): boolean {
  switch (action) {
    case "pay":
    case "deliver":
    case "confirm":
      return order.status !== "CANCELLED";
    case "cancel":
      // Betald eller levererad order avbryts inte — den krediteras/hanteras manuellt.
      return order.status !== "CANCELLED" && order.paymentStatus !== "PAID" && order.deliveryStatus !== "DELIVERED";
  }
}
