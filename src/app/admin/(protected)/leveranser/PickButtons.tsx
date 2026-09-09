"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { canTransitionPick, PICK_STATUS_LABELS, type PickStatus } from "@/lib/status";
import { setPickStatusAction } from "@/app/admin/warehouse-actions";
import type { ActionResult } from "@/app/admin/actions";

const NEXT: { to: PickStatus; label: string }[] = [
  { to: "PICKED", label: "Plockad" },
  { to: "LOADED", label: "Lastad" },
  { to: "DELIVERED", label: "Levererad" },
  { to: "UNPICKED", label: "Avplocka" },
  { to: "PROBLEM", label: "Problem" },
];

export function PickButtons({ orderId, pickStatus }: { orderId: string; pickStatus: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [result, setResult] = useState<ActionResult | null>(null);
  const options = NEXT.filter((n) => canTransitionPick(pickStatus, n.to));

  return (
    <span style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      <span className={`pill ${pickStatus === "DELIVERED" || pickStatus === "LOADED" ? "pill-ok" : pickStatus === "PROBLEM" ? "pill-warn" : "pill-outline"}`}>
        {PICK_STATUS_LABELS[pickStatus as PickStatus] ?? pickStatus}
      </span>
      {options.map((o) => (
        <button
          key={o.to}
          type="button"
          className={o.to === "PROBLEM" ? "btn btn-outline" : "btn btn-primary"}
          style={{ padding: "8px 12px", fontSize: 12.5, minHeight: 40 }}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await setPickStatusAction(orderId, o.to);
              setResult(r);
              if (r.ok) router.refresh();
            })
          }
        >
          {o.label}
        </button>
      ))}
      {result && !result.ok && (
        <span role="alert" className="error-text" style={{ fontSize: 12.5, flexBasis: "100%" }}>
          {result.error}
        </span>
      )}
    </span>
  );
}
