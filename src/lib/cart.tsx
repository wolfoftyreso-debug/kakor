"use client";

// Varukorg — klientbaserad fram till checkout, sparas i localStorage så att
// den överlever navigation och refresh. Priserna här är endast visning;
// servern räknar alltid om från databasen vid beställning.

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

interface CartContextValue {
  lines: CartLine[];
  totalKg: number;
  subtotalOre: number;
  addKg: (product: Omit<CartLine, "kg">, kg: number) => void;
  setKg: (productId: string, kg: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  toast: string | null;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "sb_cart_v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartLine[];
        if (Array.isArray(parsed))
          setLines(parsed.filter((l) => l && l.kg > 0).map((l) => ({ ...l, unit: l.unit ?? "kg" })));
      }
    } catch {
      // korrupt lagring — börja om med tom korg
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // t.ex. privat läge — korgen funkar ändå under sessionen
    }
  }, [lines, hydrated]);

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

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(() => {
    const totalKg = lines.reduce((s, l) => s + l.kg, 0);
    const subtotalOre = lines.reduce((s, l) => s + l.kg * l.pricePerKgOre, 0);
    return { lines, totalKg, subtotalOre, addKg, setKg, remove, clear, toast };
  }, [lines, addKg, setKg, remove, clear, toast]);

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
