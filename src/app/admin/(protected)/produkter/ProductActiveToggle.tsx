"use client";

import { useTransition } from "react";
import { setProductActive } from "@/app/admin/actions";

export function ProductActiveToggle({ productId, active }: { productId: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      className="btn btn-outline"
      style={{ padding: "6px 12px", fontSize: 12.5 }}
      disabled={pending}
      onClick={() => startTransition(async () => void (await setProductActive(productId, !active)))}
    >
      {active ? "Inaktivera" : "Aktivera"}
    </button>
  );
}
