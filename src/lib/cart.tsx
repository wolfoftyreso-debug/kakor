"use client";

// Varukorg — klientbaserad fram till checkout, sparas i localStorage så att
// den överlever navigation och refresh. Priserna här är endast visning;
// servern räknar alltid om från databasen vid beställning.
//
// EN korg för hela sajten: engångsköp och återkommande leverans är inte två
// flöden utan ett köpläge (purchaseMode) på samma varukorg — kunden väljer
// först VAD, sedan HUR (Mobbin-mönstret från t.ex. Hims/Walmart där
// prenumeration är ett attribut på ordern, inte en egen butik).

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { qtyLabel } from "@/lib/units";

export interface CartLine {
  productId: string;
  slug: string;
  name: string;
  pricePerKgOre: number; // á-pris per enhet (kg eller paket)
  unit: string; // "kg" | "paket"
  kg: number; // antal enheter
}

export type PurchaseMode = "ONE_TIME" | "RECURRING";
export type RecurrenceInterval = "WEEKLY" | "BIWEEKLY" | "MONTHLY";

interface CartContextValue {
  lines: CartLine[];
  totalKg: number;
  subtotalOre: number;
  purchaseMode: PurchaseMode;
  recurrenceInterval: RecurrenceInterval;
  /** true när localStorage lästs — guards ska inte agera på o-hydrerat state. */
  hydrated: boolean;
  addKg: (product: Omit<CartLine, "kg">, kg: number) => void;
  setKg: (productId: string, kg: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  setPurchaseMode: (mode: PurchaseMode) => void;
  setRecurrenceInterval: (interval: RecurrenceInterval) => void;
  toast: string | null;
}

const CartContext = createContext<CartContextValue | null>(null);

// v1 lagrade bara raderna (en array). v2 lagrar hela korgen inkl. köpläge.
const STORAGE_KEY_V1 = "sb_cart_v1";
const STORAGE_KEY = "sb_cart_v2";

const INTERVALS: RecurrenceInterval[] = ["WEEKLY", "BIWEEKLY", "MONTHLY"];

/** Serverns tak per orderrad (validation.ts) — korgen får aldrig överskrida det. */
export const MAX_UNITS = 100;

// localStorage är opålitlig input (manipulerad/korrupt): varje fält
// typkontrolleras och antalet klampas till serverns tak, annars kan
// headerns badge visa 1,5 eller 500 och delsumman bli NaN.
function sanitizeLines(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  const out: CartLine[] = [];
  for (const l of raw as Partial<CartLine>[]) {
    if (!l || typeof l !== "object") continue;
    if (typeof l.productId !== "string" || !l.productId) continue;
    if (typeof l.slug !== "string" || typeof l.name !== "string") continue;
    if (typeof l.pricePerKgOre !== "number" || !Number.isFinite(l.pricePerKgOre) || l.pricePerKgOre < 0) continue;
    if (typeof l.kg !== "number" || !Number.isInteger(l.kg) || l.kg < 1) continue;
    if (out.some((o) => o.productId === l.productId)) continue;
    out.push({
      productId: l.productId,
      slug: l.slug,
      name: l.name.slice(0, 80),
      pricePerKgOre: Math.round(l.pricePerKgOre),
      kg: Math.min(MAX_UNITS, l.kg),
      unit: l.unit === "paket" ? "paket" : "kg",
    });
  }
  return out;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [purchaseMode, setPurchaseModeState] = useState<PurchaseMode>("ONE_TIME");
  const [recurrenceInterval, setRecurrenceIntervalState] = useState<RecurrenceInterval>("BIWEEKLY");
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          lines?: unknown;
          purchaseMode?: unknown;
          recurrenceInterval?: unknown;
        };
        setLines(sanitizeLines(parsed.lines));
        if (parsed.purchaseMode === "RECURRING") setPurchaseModeState("RECURRING");
        if (INTERVALS.includes(parsed.recurrenceInterval as RecurrenceInterval))
          setRecurrenceIntervalState(parsed.recurrenceInterval as RecurrenceInterval);
      } else {
        // Migrera en äldre korg (bara rader) så att ingen kund tappar sitt val.
        const v1 = localStorage.getItem(STORAGE_KEY_V1);
        if (v1) {
          setLines(sanitizeLines(JSON.parse(v1)));
          localStorage.removeItem(STORAGE_KEY_V1);
        }
      }
    } catch {
      // korrupt lagring — börja om med tom korg
    }
    setHydrated(true);

    // Två flikar: korgen ändrad i en annan flik slår igenom här också
    // (annars vinner den flik som råkar spara sist).
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      try {
        lastWritten.current = e.newValue;
        const parsed = e.newValue ? (JSON.parse(e.newValue) as { lines?: unknown; purchaseMode?: unknown; recurrenceInterval?: unknown }) : {};
        setLines(sanitizeLines(parsed.lines));
        setPurchaseModeState(parsed.purchaseMode === "RECURRING" ? "RECURRING" : "ONE_TIME");
        if (INTERVALS.includes(parsed.recurrenceInterval as RecurrenceInterval))
          setRecurrenceIntervalState(parsed.recurrenceInterval as RecurrenceInterval);
      } catch {
        // korrupt — behåll nuvarande
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const lastWritten = useRef<string | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    try {
      const serialized = JSON.stringify({ lines, purchaseMode, recurrenceInterval });
      // Skriv bara när något ändrats — annars triggar varje flikstart ett
      // storage-event (och en re-render) i alla andra flikar.
      if (serialized === lastWritten.current) return;
      lastWritten.current = serialized;
      localStorage.setItem(STORAGE_KEY, serialized);
    } catch {
      // t.ex. privat läge — korgen funkar ändå under sessionen
    }
  }, [lines, purchaseMode, recurrenceInterval, hydrated]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const addKg = useCallback(
    (product: Omit<CartLine, "kg">, kg: number) => {
      setLines((prev) => {
        const existing = prev.find((l) => l.productId === product.productId);
        if (existing) {
          return prev.map((l) =>
            l.productId === product.productId ? { ...l, ...product, kg: Math.min(MAX_UNITS, l.kg + kg) } : l
          );
        }
        // Explicit fältordning = samma serialisering i alla flikar (ingen ping-pong via storage-event).
        return [
          ...prev,
          { productId: product.productId, slug: product.slug, name: product.name, pricePerKgOre: product.pricePerKgOre, kg: Math.min(MAX_UNITS, kg), unit: product.unit },
        ];
      });
      showToast(`${product.name} ${qtyLabel(kg, product.unit)} lades i korgen`);
    },
    [showToast]
  );

  const setKg = useCallback((productId: string, kg: number) => {
    setLines((prev) =>
      kg <= 0
        ? prev.filter((l) => l.productId !== productId)
        : prev.map((l) => (l.productId === productId ? { ...l, kg: Math.min(MAX_UNITS, kg) } : l))
    );
  }, []);

  const remove = useCallback((productId: string) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  }, []);

  const clear = useCallback(() => {
    setLines([]);
    setPurchaseModeState("ONE_TIME");
    setRecurrenceIntervalState("BIWEEKLY");
  }, []);

  const setPurchaseMode = useCallback((mode: PurchaseMode) => setPurchaseModeState(mode), []);
  const setRecurrenceInterval = useCallback(
    (interval: RecurrenceInterval) => setRecurrenceIntervalState(interval),
    []
  );

  const value = useMemo<CartContextValue>(() => {
    const totalKg = lines.reduce((s, l) => s + l.kg, 0);
    const subtotalOre = lines.reduce((s, l) => s + l.kg * l.pricePerKgOre, 0);
    return {
      lines,
      totalKg,
      subtotalOre,
      purchaseMode,
      recurrenceInterval,
      hydrated,
      addKg,
      setKg,
      remove,
      clear,
      setPurchaseMode,
      setRecurrenceInterval,
      toast,
    };
  }, [
    lines,
    purchaseMode,
    recurrenceInterval,
    hydrated,
    addKg,
    setKg,
    remove,
    clear,
    setPurchaseMode,
    setRecurrenceInterval,
    toast,
  ]);

  return (
    <CartContext.Provider value={value}>
      {children}
      {toast && (
        <div className="toast" role="status">
          <span className="toast-check">✓</span> {toast}
        </div>
      )}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart måste användas inom CartProvider");
  return ctx;
}
