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

function sanitizeLines(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  return (raw as CartLine[])
    .filter((l) => l && typeof l.productId === "string" && typeof l.kg === "number" && l.kg > 0)
    .map((l) => ({ ...l, unit: l.unit ?? "kg" }));
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
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ lines, purchaseMode, recurrenceInterval })
      );
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
            l.productId === product.productId ? { ...l, ...product, kg: l.kg + kg } : l
          );
        }
        return [...prev, { ...product, kg }];
      });
      showToast(`${product.name} ${qtyLabel(kg, product.unit)} lades i korgen`);
    },
    [showToast]
  );

  const setKg = useCallback((productId: string, kg: number) => {
    setLines((prev) =>
      kg <= 0
        ? prev.filter((l) => l.productId !== productId)
        : prev.map((l) => (l.productId === productId ? { ...l, kg } : l))
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
