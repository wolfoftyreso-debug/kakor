"use client";

import { useEffect } from "react";
import { captureAcquisition } from "@/lib/seo/acquisition";

/** Sparar första landning i sessionen. Renderar ingenting. */
export function AcquisitionCapture() {
  useEffect(() => {
    captureAcquisition();
  }, []);
  return null;
}
