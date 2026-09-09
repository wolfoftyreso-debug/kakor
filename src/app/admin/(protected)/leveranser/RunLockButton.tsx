"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runLockCronAction } from "@/app/admin/warehouse-actions";
import type { ActionResult } from "@/app/admin/actions";

export function RunLockButton() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [result, setResult] = useState<ActionResult | null>(null);
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <button
        type="button"
        className="btn btn-outline"
        style={{ padding: "8px 14px", fontSize: 13, minHeight: 44 }}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await runLockCronAction();
            setResult(r);
            if (r.ok) router.refresh();
          })
        }
      >
        {pending ? "Kör…" : "Kör veckolåsning"}
      </button>
      {result && (
        <span className={result.ok ? "info-box" : "error-text"} style={{ fontSize: 12.5 }}>
          {result.ok ? result.message : result.error}
        </span>
      )}
    </span>
  );
}
