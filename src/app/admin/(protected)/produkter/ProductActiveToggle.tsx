"use client";

import { useState, useTransition } from "react";
import { setProductActive, type ActionResult } from "@/app/admin/actions";

export function ProductActiveToggle({ productId, active, name }: { productId: string; active: boolean; name: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <button
        className="btn btn-outline"
        style={{ padding: "8px 12px", fontSize: 12.5, minHeight: 36 }}
        disabled={pending}
        onClick={() => {
          // Inaktivering rensar produkten ur kunders varukorgar — bekräfta.
          if (active && !window.confirm(`Inaktivera ${name}? Den försvinner från sajten och ur pågående varukorgar.`)) return;
          startTransition(async () => setResult(await setProductActive(productId, !active)));
        }}
      >
        {pending ? "Sparar…" : active ? "Inaktivera" : "Aktivera"}
      </button>
      {result && !result.ok && (
        <span role="alert" className="error-text" style={{ fontSize: 12 }}>
          {result.error}
        </span>
      )}
    </span>
  );
}
