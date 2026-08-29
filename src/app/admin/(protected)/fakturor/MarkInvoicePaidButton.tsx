"use client";

import { useTransition } from "react";
import { markOrderPaid } from "@/app/admin/actions";

export function MarkInvoicePaidButton({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      className="btn btn-outline"
      style={{ padding: "6px 12px", fontSize: 12.5 }}
      disabled={pending}
      onClick={() => startTransition(async () => void (await markOrderPaid(orderId, "")))}
    >
      Markera betald
    </button>
  );
}
