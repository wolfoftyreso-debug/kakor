// Separata statusmodeller — en order kan t.ex. vara CONFIRMED + UNPAID + DELIVERED.

export const ORDER_STATUS = ["NEW", "CONFIRMED", "CANCELLED"] as const;
export type OrderStatus = (typeof ORDER_STATUS)[number];

export const PAYMENT_STATUS = ["UNPAID", "PAID"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[number];

export const DELIVERY_STATUS = ["PENDING", "DELIVERED"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUS)[number];

export const INVOICE_STATUS = ["UNPAID", "PAID"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUS)[number];

export const SUBSCRIPTION_STATUS = ["ACTIVE", "PAUSED", "CANCELLED"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[number];

export const SUBSCRIPTION_FREQUENCY = ["WEEKLY", "BIWEEKLY", "MONTHLY"] as const;
export type SubscriptionFrequency = (typeof SUBSCRIPTION_FREQUENCY)[number];

export const FREQUENCY_LABELS: Record<SubscriptionFrequency, string> = {
  WEEKLY: "Varje vecka",
  BIWEEKLY: "Varannan vecka",
  MONTHLY: "En gång i månaden",
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

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  PENDING: "Ej levererad",
  DELIVERED: "Levererad",
};

/** OVERDUE lagras aldrig — den beräknas alltid från förfallodatum + status. */
export function isInvoiceOverdue(invoice: { status: string; dueDate: Date }, now = new Date()): boolean {
  return invoice.status === "UNPAID" && invoice.dueDate.getTime() < startOfDay(now).getTime();
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
