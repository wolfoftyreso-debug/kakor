import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  DELIVERY_STATUS_LABELS,
  type OrderStatus,
  type PaymentStatus,
  type DeliveryStatus,
} from "@/lib/status";

export function OrderStatusPill({ status }: { status: string }) {
  const cls = status === "NEW" ? "pill-new" : status === "CONFIRMED" ? "pill-ok" : "pill-neutral";
  return <span className={`pill ${cls}`}>{ORDER_STATUS_LABELS[status as OrderStatus] ?? status}</span>;
}

export function PaymentStatusPill({ status, overdue }: { status: string; overdue?: boolean }) {
  if (overdue && status === "UNPAID") return <span className="pill pill-warn">Förfallen</span>;
  const cls = status === "PAID" ? "pill-ok" : "pill-new";
  return <span className={`pill ${cls}`}>{PAYMENT_STATUS_LABELS[status as PaymentStatus] ?? status}</span>;
}

export function DeliveryStatusPill({ status }: { status: string }) {
  const cls = status === "DELIVERED" ? "pill-ok" : "pill-outline";
  return (
    <span className={`pill ${cls}`}>{DELIVERY_STATUS_LABELS[status as DeliveryStatus] ?? status}</span>
  );
}
