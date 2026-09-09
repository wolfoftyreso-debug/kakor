import { todayInStockholm } from "@/lib/dates";

// Separata statusmodeller – en order kan t.ex. vara CONFIRMED + UNPAID + DELIVERED.

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

export const PICK_STATUS = ["UNPICKED", "PICKED", "LOADED", "DELIVERED", "PROBLEM"] as const;
export type PickStatus = (typeof PICK_STATUS)[number];

export const DELIVERY_WEEK_STATUS = ["OPEN", "LOCKING", "LOCKED", "PICKING", "OUT_FOR_DELIVERY", "COMPLETED"] as const;
export type DeliveryWeekStatus = (typeof DELIVERY_WEEK_STATUS)[number];

export const MOVEMENT_KIND = ["INCOMING", "OUTGOING", "ADJUSTMENT", "PICK", "UNPICK"] as const;
export type MovementKind = (typeof MOVEMENT_KIND)[number];

export const ADJUST_REASONS = [
  { id: "produktion", label: "Nybakad produktion", kind: "INCOMING" },
  { id: "svinn", label: "Svinn", kind: "OUTGOING" },
  { id: "kassation", label: "Kassation", kind: "OUTGOING" },
  { id: "inventering", label: "Inventeringskorrigering", kind: "ADJUSTMENT" },
  { id: "provsmakning", label: "Provsmakning/internt bruk", kind: "OUTGOING" },
  { id: "felregistrering", label: "Felregistrering", kind: "ADJUSTMENT" },
  { id: "annan", label: "Annan anledning", kind: "ADJUSTMENT" },
] as const;
export type AdjustReasonId = (typeof ADJUST_REASONS)[number]["id"];

// MONTHLY = var 28:e dag (fast leveransveckodag) – etiketten ska inte lova kalendermånad.
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

export const PICK_STATUS_LABELS: Record<PickStatus, string> = {
  UNPICKED: "Ej plockad",
  PICKED: "Plockad",
  LOADED: "Lastad",
  DELIVERED: "Levererad",
  PROBLEM: "Problem",
};

export const DELIVERY_WEEK_STATUS_LABELS: Record<DeliveryWeekStatus, string> = {
  OPEN: "Öppen",
  LOCKING: "Låses…",
  LOCKED: "Låst",
  PICKING: "Plockas",
  OUT_FOR_DELIVERY: "Ute på leverans",
  COMPLETED: "Klar",
};

/** Låst eller längre – checkout och snapshot får inte mutera den ursprungliga listan. */
export function isWeekLockedStatus(status: string): boolean {
  return status === "LOCKED" || status === "PICKING" || status === "OUT_FOR_DELIVERY" || status === "COMPLETED";
}

/** Ordern reserverar fortfarande fysiskt lager (inte plockad ur frysen, inte avbruten/levererad). */
export function orderReservesStock(order: { status: string; deliveryStatus: string; pickStatus: string }): boolean {
  if (order.status === "CANCELLED") return false;
  if (order.deliveryStatus === "DELIVERED") return false;
  if (order.pickStatus === "PICKED" || order.pickStatus === "LOADED" || order.pickStatus === "DELIVERED") return false;
  return true;
}

/**
 * OVERDUE lagras aldrig – den beräknas alltid från förfallodatum + status.
 * "Idag" räknas i svensk tid (inte serverns lokala tidszon); förfallen först
 * dagen EFTER förfallodatumet.
 */
export function isInvoiceOverdue(invoice: { status: string; dueDate: Date }, now = new Date()): boolean {
  return invoice.status === "UNPAID" && invoice.dueDate.getTime() < todayInStockholm(now).getTime();
}

/** En avbruten order är aldrig "förfallen" – fakturan drivs inte in. */
export function isOrderOverdue(
  order: { status: string; invoice: { status: string; dueDate: Date } | null },
  now = new Date()
): boolean {
  return order.status !== "CANCELLED" && !!order.invoice && isInvoiceOverdue(order.invoice, now);
}

/**
 * Servervakt för orderövergångar – UI:t döljer knappar, men server actions är
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
      // Betald eller levererad order avbryts inte – den krediteras/hanteras manuellt.
      return order.status !== "CANCELLED" && order.paymentStatus !== "PAID" && order.deliveryStatus !== "DELIVERED";
  }
}

const PICK_TRANSITIONS: Record<PickStatus, PickStatus[]> = {
  UNPICKED: ["PICKED", "PROBLEM"],
  PICKED: ["LOADED", "UNPICKED", "PROBLEM"],
  LOADED: ["DELIVERED", "PICKED", "PROBLEM"],
  PROBLEM: ["UNPICKED", "PICKED"],
  DELIVERED: [],
};

export function canTransitionPick(from: string, to: string): boolean {
  const allowed = PICK_TRANSITIONS[from as PickStatus];
  if (!allowed) return false;
  return allowed.includes(to as PickStatus);
}
