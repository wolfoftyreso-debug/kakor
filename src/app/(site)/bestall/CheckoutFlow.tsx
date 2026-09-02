"use client";

// Sajtens ENDA beställningsflöde: Kakor -> Leverans -> Uppgifter ->
// Kontrollera -> Tack. Engångsköp och återkommande leverans är samma
// funnel och samma varukorg — köpläget väljs i leveranssteget
// (produkt först, leveranssätt sedan), och submit grenar mot
// /api/orders respektive /api/subscriptions.
//
// Steg 1 är varukorgen: kvantiteter synkas mot cart-context (localStorage).
// Vald plats i flödet + formulärdata sparas i sessionStorage så att
// tillbaka-navigering, reload eller en avstickare till en produktsida
// aldrig kastar bort kundens arbete.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MAX_UNITS, useCart, type PurchaseMode, type RecurrenceInterval } from "@/lib/cart";
import type { ProductCardData } from "@/components/ProductCard";
import type { AreaWithDates } from "@/lib/products";
import { ImageSlot } from "@/components/ImageSlot";
import { formatOre, calculateTotals } from "@/lib/money";
import { formatWeightKg, lineWeightGrams, priceSuffix, qtyLabel } from "@/lib/units";
import { capitalizeFirst, formatDeliveryDate, fromISODate, toISODate, upcomingDeliveryDates } from "@/lib/dates";
import { LogoSigill } from "@/components/Logo";
import { PreferredSourceCTA } from "@/components/preferred-source/PreferredSourceCTA";
import { newIdempotencyKey } from "@/lib/idempotency";
import { track } from "@/lib/analytics";

interface FormState {
  companyName: string;
  orgNumber: string;
  contactName: string;
  phone: string;
  email: string;
  invoiceEmail: string;
  deliveryAddress: string;
  deliveryPostalCode: string;
  deliveryCity: string;
  reference: string;
  deliveryInstruction: string;
}

const EMPTY_FORM: FormState = {
  companyName: "",
  orgNumber: "",
  contactName: "",
  phone: "",
  email: "",
  invoiceEmail: "",
  deliveryAddress: "",
  deliveryPostalCode: "",
  deliveryCity: "",
  reference: "",
  deliveryInstruction: "",
};

const STEP_LABELS = ["Kakor", "Leverans", "Uppgifter", "Kontrollera"];

const INTERVALS: { value: RecurrenceInterval; label: string; sub: string }[] = [
  { value: "WEEKLY", label: "Varje vecka", sub: "För arbetsplatser som fikar ofta" },
  { value: "BIWEEKLY", label: "Varannan vecka", sub: "Lagom påfyllning" },
  { value: "MONTHLY", label: "Var fjärde vecka", sub: "Till möten och fredagsfika" },
];

function intervalLabel(value: RecurrenceInterval): string {
  return INTERVALS.find((i) => i.value === value)?.label ?? value;
}

type SubmitResult =
  | { kind: "order"; orderNumber: string; invoiceUrl: string; deliveryDate: string; totalOre: number }
  | { kind: "subscription"; number: string; nextDate: string; interval: RecurrenceInterval; totalOre: number };

// Pågående flödesdata (steg, leveransval, formulär) — sessionStorage så att
// reload/back/avstickare inte kastar bort något. Korgen bor i localStorage.
const FLOW_STORAGE_KEY = "sb_checkout_v1";

interface StoredFlow {
  step: number;
  areaSlug: string | null;
  deliveryDate: string | null;
  form: FormState;
  sameEmail: boolean;
  /** Idempotensnyckel + fingeravtryck av payloaden den gäller för. */
  idempotencyKey?: string;
  idempotencyFingerprint?: string;
}

export function CheckoutFlow({
  products,
  areas,
}: {
  products: ProductCardData[];
  areas: AreaWithDates[];
}) {
  const cart = useCart();
  const [step, setStep] = useState(1);
  const [areaSlug, setAreaSlug] = useState<string | null>(null);
  const [deliveryDate, setDeliveryDate] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [sameEmail, setSameEmail] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [flowRestored, setFlowRestored] = useState(false);
  const headingRef = useRef<HTMLDivElement>(null);
  // EN nyckel per beställningsförsök — behålls även om kunden går tillbaka
  // och fram igen, så att ett tappat svar + nytt "Skicka" aldrig ger två
  // ordrar/prenumerationer. Nollställs först när ett försök lyckats.
  const idempotencyKey = useRef<string>("");
  // Nyckeln gäller EN payload: ändras korg/läge/datum/uppgifter roteras den,
  // annars skulle servern kunna svara med en gammal order för en ny beställning.
  const idempotencyFingerprint = useRef<string>("");
  const presetApplied = useRef(false);
  const router = useRouter();
  // Honeypot: dolt fält som riktiga kunder aldrig ser eller fyller i.
  const [honeypot, setHoneypot] = useState("");
  // Klockan tickar var 60:e sekund så att leveransdagarna räknas om om fliken
  // ligger öppen över midnatt/framförhållningsgränsen.
  const [clockTick, setClockTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setClockTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const mode: PurchaseMode = cart.purchaseMode;
  const interval: RecurrenceInterval = cart.recurrenceInterval;

  // Återställ pågående flöde (reload, browser back, avstickare till annan sida).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(FLOW_STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as StoredFlow;
        if (s && typeof s.step === "number") {
          setStep(Math.min(4, Math.max(1, s.step)));
          setAreaSlug(typeof s.areaSlug === "string" ? s.areaSlug : null);
          setDeliveryDate(typeof s.deliveryDate === "string" ? s.deliveryDate : null);
          if (s.form && typeof s.form === "object") {
            // Bara kända fält med strängvärden — sessionStorage är opålitlig input.
            const safe = Object.fromEntries(
              Object.entries(s.form).filter(([k, v]) => k in EMPTY_FORM && typeof v === "string")
            ) as Partial<FormState>;
            setForm({ ...EMPTY_FORM, ...safe });
          }
          setSameEmail(s.sameEmail !== false);
          if (typeof s.idempotencyKey === "string") idempotencyKey.current = s.idempotencyKey;
          if (typeof s.idempotencyFingerprint === "string")
            idempotencyFingerprint.current = s.idempotencyFingerprint;
        }
      }
    } catch {
      // korrupt lagring — starta från steg 1
    }
    setFlowRestored(true);
  }, []);

  const saveFlow = () => {
    try {
      const stored: StoredFlow = {
        step,
        areaSlug,
        deliveryDate,
        form,
        sameEmail,
        idempotencyKey: idempotencyKey.current,
        idempotencyFingerprint: idempotencyFingerprint.current,
      };
      sessionStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // privat läge — flödet funkar ändå under sessionen
    }
  };
  useEffect(() => {
    if (!flowRestored || result) return;
    saveFlow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowRestored, result, step, areaSlug, deliveryDate, form, sameEmail]);

  // /bestall?typ=aterkommande (från prenumerations-CTA:er) förväljer
  // återkommande leverans — appliceras efter att korgen hydrerats så att
  // lagrat läge inte skriver över kundens avsikt.
  useEffect(() => {
    if (!cart.hydrated || presetApplied.current) return;
    presetApplied.current = true;
    const typ = new URLSearchParams(window.location.search).get("typ");
    if (typ === "aterkommande") cart.setPurchaseMode("RECURRING");
    if (typ === "engang") cart.setPurchaseMode("ONE_TIME");
    if (typ) window.history.replaceState(null, "", window.location.pathname);
  }, [cart]);

  // Produkter som inte längre finns i sortimentet (inaktiverade i admin)
  // rensas ur korgen — annars räknar headerns badge något kunden inte ser.
  const removeLine = cart.remove;
  useEffect(() => {
    if (!cart.hydrated) return;
    const stale = cart.lines.filter((l) => !products.some((p) => p.id === l.productId));
    if (stale.length === 0) return;
    stale.forEach((l) => removeLine(l.productId));
    setNotice(
      `${stale.map((l) => l.name).join(", ")} finns inte längre i sortimentet och har tagits bort ur korgen.`
    );
  }, [cart.hydrated, cart.lines, products, removeLine]);

  const qtyFor = (productId: string) => cart.lines.find((l) => l.productId === productId)?.kg ?? 0;

  const setQty = (product: ProductCardData, kg: number) => {
    if (kg > 0 && qtyFor(product.id) === 0) {
      cart.addKg(
        {
          productId: product.id,
          slug: product.slug,
          name: product.name,
          pricePerKgOre: product.pricePerKgOre,
          unit: product.unit,
        },
        kg
      );
    } else {
      cart.setKg(product.id, kg);
    }
  };

  const activeLines = products
    .map((p) => ({ product: p, kg: qtyFor(p.id) }))
    .filter((l) => l.kg > 0);
  const totalKg = activeLines.reduce((s, l) => s + l.kg, 0);
  // Sann totalvikt: lösvikt räknas per kilo, paket via sin paketvikt (1 paket = 1,5 kg).
  const totalWeightGrams = activeLines.reduce(
    (s, l) => s + lineWeightGrams(l.kg, l.product.unit, l.product.packageWeightGrams),
    0
  );
  const totals = useMemo(
    () =>
      calculateTotals(
        activeLines.map((l) => ({ netOre: l.kg * l.product.pricePerKgOre, vatRateBp: l.product.vatRateBp ?? 1200 }))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(activeLines.map((l) => [l.product.id, l.kg]))]
  );

  const selectedArea = areas.find((a) => a.slug === areaSlug) ?? null;

  // Leveransdagarna räknas om på klienten (från områdets veckodagar +
  // framförhållning) i stället för att lita på listan från sidladdningen —
  // annars visar steg 2 samma passerade datum som servern just avvisade.
  const upcomingDates = useMemo(
    () =>
      selectedArea
        ? upcomingDeliveryDates(
            { weekdays: selectedArea.weekdays, leadTimeDays: selectedArea.leadTimeDays },
            Math.max(4, selectedArea.upcomingDates.length)
          ).map(toISODate)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedArea, clockTick]
  );

  useEffect(() => {
    // Återställt flöde med ett område som inte längre erbjuds (inaktiverat i
    // admin): nollställ valet i stället för att visa "undefined" i steg 4.
    if (flowRestored && areaSlug && !areas.some((a) => a.slug === areaSlug)) {
      setAreaSlug(null);
      setDeliveryDate(null);
      if (step >= 3) {
        setStep(2);
        setGlobalError("Leveransområdet är inte längre tillgängligt — välj område igen.");
      }
    }
  }, [flowRestored, areaSlug, areas, step]);

  useEffect(() => {
    // Rensa valt datum om området byts eller datumet inte längre erbjuds
    // (t.ex. fliken låg öppen över framförhållningsgränsen). Står kunden
    // längre fram i flödet leds hen tillbaka till dagvalet — aldrig en död Skicka-knapp.
    if (selectedArea && deliveryDate && !upcomingDates.includes(deliveryDate)) {
      setDeliveryDate(null);
      if (step >= 3) {
        setStep(2);
        setGlobalError("Leveransdagen är inte längre tillgänglig — välj en ny dag.");
      }
    }
  }, [selectedArea, upcomingDates, deliveryDate, step]);

  // Tomkorgsvakt: hamnar kunden i steg 2–4 utan varor (korgen tömd i en
  // annan flik, eller återställt flöde med utgången korg) renderas en
  // åtgärdsbar empty state i stället för döda knappar. Deriverad direkt
  // från korgen — kan inte försvinna i någon effekt-race.
  const cartEmptiedMidFlow =
    flowRestored && cart.hydrated && !result && step >= 2 && step <= 4 && activeLines.length === 0;

  const goTo = (s: number) => {
    setStep(s);
    setGlobalError(null);
    setNotice(null);
    requestAnimationFrame(() => {
      headingRef.current?.scrollIntoView({ block: "start" });
      headingRef.current?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
    });
  };

  const setField = (k: keyof FormState, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => {
      const key = k === "invoiceEmail" ? "invoiceEmail" : k;
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  const validateStep3 = (): boolean => {
    const e: Record<string, string> = {};
    if (form.companyName.trim().length < 2) e.companyName = "Ange företagsnamn";
    if (!/^\d{6}-?\d{4}$/.test(form.orgNumber.trim()))
      e.orgNumber = "Ange organisationsnummer i formatet 556677-8899";
    if (form.contactName.trim().length < 2) e.contactName = "Ange kontaktperson";
    if (!/^[0-9+\-() ]{6,25}$/.test(form.phone.trim())) e.phone = "Ange ett telefonnummer";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = "Ange en giltig e-postadress";
    if (!sameEmail && !/^\S+@\S+\.\S+$/.test(form.invoiceEmail.trim()))
      e.invoiceEmail = "Ange en giltig faktura-e-post";
    if (form.deliveryAddress.trim().length < 3) e.deliveryAddress = "Ange leveransadress";
    if (!/^\d{3}\s?\d{2}$/.test(form.deliveryPostalCode.trim()))
      e.deliveryPostalCode = "Ange postnummer i formatet 135 48";
    if (form.deliveryCity.trim().length < 2) e.deliveryCity = "Ange ort";
    if (form.deliveryInstruction.length > 500) e.deliveryInstruction = "Max 500 tecken";
    setErrors(e);
    if (Object.keys(e).length > 0) {
      requestAnimationFrame(() =>
        headingRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      );
    }
    return Object.keys(e).length === 0;
  };

  // Servern kan returnera fältfel — visa dem i det steg där felet hör hemma.
  const stepForFields = (fields: Record<string, string>): number => {
    if (Object.keys(fields).some((k) => k === "items" || k.startsWith("items."))) return 1;
    if (fields.areaSlug || fields.deliveryDate || fields.firstDeliveryDate || fields.frequency)
      return 2;
    return 3;
  };

  const submit = async () => {
    if (!areaSlug || !deliveryDate || activeLines.length === 0 || submitting) return;
    setSubmitting(true);
    setGlobalError(null);
    track("order_submitted", { mode });
    const fingerprint = JSON.stringify({
      mode,
      interval: mode === "RECURRING" ? interval : null,
      areaSlug,
      deliveryDate,
      items: activeLines.map((l) => [l.product.id, l.kg]),
      form,
      sameEmail,
    });
    if (!idempotencyKey.current || idempotencyFingerprint.current !== fingerprint) {
      idempotencyKey.current = newIdempotencyKey();
      idempotencyFingerprint.current = fingerprint;
      saveFlow();
    }
    const common = {
      idempotencyKey: idempotencyKey.current,
      items: activeLines.map((l) => ({ productId: l.product.id, weightKg: l.kg })),
      areaSlug,
      companyName: form.companyName.trim(),
      orgNumber: form.orgNumber.trim(),
      contactName: form.contactName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      deliveryAddress: form.deliveryAddress.trim(),
      deliveryPostalCode: form.deliveryPostalCode.trim(),
      deliveryCity: form.deliveryCity.trim(),
      deliveryInstruction: form.deliveryInstruction.trim(),
      invoiceEmail: (sameEmail ? form.email : form.invoiceEmail).trim(),
      reference: form.reference.trim(),
      // Beloppet kunden bekräftade — servern avvisar om priset hunnit ändras.
      expectedTotalOre: totals.totalOre,
      ...(honeypot ? { website: honeypot } : {}),
    };
    try {
      const res =
        mode === "RECURRING"
          ? await fetch("/api/subscriptions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...common, frequency: interval, firstDeliveryDate: deliveryDate }),
            })
          : await fetch("/api/orders", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...common, deliveryDate, billingAddress: "" }),
            });
      // Ett HTML-svar (gateway-timeout, för stor body) är inte ett nätverksfel —
      // säg vad som hände i stället för "kontrollera uppkopplingen".
      const isJson = (res.headers.get("content-type") ?? "").includes("application/json");
      const data = isJson
        ? await res.json()
        : { ok: false, error: `Servern svarade med fel ${res.status} — försök igen om en liten stund.` };
      if (data.ok) {
        idempotencyKey.current = "";
        idempotencyFingerprint.current = "";
        track("order_completed", { mode });
        setResult(
          mode === "RECURRING"
            ? {
                kind: "subscription",
                number: data.subscriptionNumber,
                nextDate: data.nextDeliveryDate,
                interval,
                totalOre: typeof data.totalOre === "number" ? data.totalOre : totals.totalOre,
              }
            : {
                kind: "order",
                orderNumber: data.orderNumber,
                invoiceUrl: data.invoiceUrl,
                deliveryDate: data.deliveryDate,
                totalOre: data.totalOre,
              }
        );
        try {
          sessionStorage.removeItem(FLOW_STORAGE_KEY);
        } catch {
          // lagring otillgänglig — inget att rensa
        }
        cart.clear();
        goTo(5);
      } else {
        track("order_failed", { mode, reason: data.code ?? "validation" });
        setGlobalError(data.error ?? "Något gick fel");
        if (data.code === "IDEMPOTENCY_MISMATCH") {
          // Nyckeln bär en annan payload — rotera så nästa försök går igenom.
          idempotencyKey.current = newIdempotencyKey();
          idempotencyFingerprint.current = fingerprint;
          saveFlow();
        }
        if (data.code === "PRICE_CHANGED" || data.fields?.items) {
          // Priser/sortiment har ändrats sedan sidladdningen — hämta färska
          // produkter så att summan och stale-rensningen speglar servern.
          router.refresh();
        }
        if (data.fields) {
          const fields: Record<string, string> = { ...data.fields };
          const itemKey = Object.keys(fields).find((k) => k.startsWith("items."));
          if (itemKey && !fields.items) fields.items = fields[itemKey];
          setErrors(fields);
          goTo(stepForFields(fields));
          // Fokus till det felaktiga fältet (samma beteende som klientvalideringen).
          requestAnimationFrame(() =>
            requestAnimationFrame(() =>
              headingRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
            )
          );
        }
      }
    } catch {
      track("order_failed", { mode, reason: "network" });
      setGlobalError("Kunde inte skicka beställningen — kontrollera uppkopplingen och försök igen.");
    } finally {
      setSubmitting(false);
    }
  };

  const summaryLines = result
    ? []
    : activeLines.map((l) => ({
        name: l.product.name,
        kg: l.kg,
        unit: l.product.unit,
        ore: l.kg * l.product.pricePerKgOre,
      }));

  const modeSummary =
    mode === "RECURRING" ? `Återkommande · ${intervalLabel(interval).toLowerCase()}` : undefined;
  const hasPackageProducts = products.some((p) => p.unit === "paket");


  return (
    <div
      className="container-narrow"
      // Steg 1 SSR-renderas alltid (SEO, utan JS). Ett lagrat flöde återställs
      // direkt efter hydration — övergången döljs med opacity, HTML:en töms aldrig.
      style={{ padding: "40px 24px 100px", opacity: flowRestored ? 1 : 0, transition: "opacity 120ms" }}
      ref={headingRef}
    >
      {step <= 4 && (
        <div className="progress-steps" role="list" aria-label="Beställningssteg">
          {STEP_LABELS.map((label, i) => (
            <div
              key={label}
              role="listitem"
              aria-current={step === i + 1 ? "step" : undefined}
              className={`progress-step${step > i ? " done" : ""}`}
            >
              <div className="progress-bar" />
              <div className="progress-step-label">{label}</div>
            </div>
          ))}
        </div>
      )}

      {globalError && (
        <div
          role="alert"
          style={{
            background: "var(--red)",
            color: "var(--bg)",
            borderRadius: 6,
            padding: "12px 16px",
            marginBottom: 20,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {globalError}
        </div>
      )}
      {notice && (
        <div role="status" className="info-box" style={{ marginBottom: 20 }}>
          {notice}
        </div>
      )}

      {/* Åtgärdsbar empty state: korgen tömdes mitt i flödet. */}
      {cartEmptiedMidFlow && (
        <div className="card" style={{ padding: "36px 28px", textAlign: "center", display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
          <h1 tabIndex={-1} style={{ outline: "none", fontSize: 26, margin: 0 }}>Er varukorg är tom.</h1>
          <p style={{ fontSize: 15, color: "var(--text-2)", margin: 0, maxWidth: "44ch" }}>
            Välj era favoriter så ordnar vi resten — allt ni redan fyllt i finns kvar.
          </p>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => goTo(1)}>
            Välj kakor
          </button>
        </div>
      )}

      {/* STEG 1: KAKOR */}
      {step === 1 && (
        <>
          <h1 tabIndex={-1} style={{ outline: "none", fontSize: 32, marginBottom: 6 }}>Välj kakor</h1>
          <p style={{ fontSize: 15, color: "var(--text-2)", margin: "0 0 28px" }}>
            {hasPackageProducts
              ? "Lösvikt säljs per kilo och paket per styck. Blanda fritt."
              : "Sorterna säljs per kilo. Blanda fritt."}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {products.map((p) => (
              <div
                key={p.id}
                className="card checkout-product-row"
                style={{ display: "flex", alignItems: "center", gap: 18, padding: "16px 20px" }}
              >
                <div style={{ width: 72, height: 72, borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
                  <ImageSlot label={p.name} src={p.imageRef || undefined} />
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: 19, fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: "13.5px", color: "var(--text-2)", marginTop: 2 }}>{p.description}</div>
                  <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
                    {formatOre(p.pricePerKgOre)}
                    {priceSuffix(p.unit)} exkl. moms · {p.allergens}
                  </div>
                </div>
                <div className="stepper">
                  <button
                    type="button"
                    aria-label={`Minska ${p.name}`}
                    onClick={() => setQty(p, Math.max(0, qtyFor(p.id) - 1))}
                  >
                    −
                  </button>
                  <div className="stepper-value" aria-live="polite">
                    {qtyLabel(qtyFor(p.id), p.unit)}
                  </div>
                  <button
                    type="button"
                    aria-label={`Öka ${p.name}`}
                    disabled={qtyFor(p.id) >= MAX_UNITS}
                    onClick={() => setQty(p, Math.min(MAX_UNITS, qtyFor(p.id) + 1))}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
          {errors.items && <p className="error-text" style={{ marginTop: 12 }}>{errors.items}</p>}
          {/* Sticky i botten på mobil — nästa steg är alltid ett tumtryck bort. */}
          <div className="checkout-total-bar">
            <div>
              <div style={{ fontSize: 13, color: "var(--text-2)" }}>Totalt inkl. moms</div>
              <div className="total-amount" style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 700 }}>
                {formatWeightKg(totalWeightGrams)} · {formatOre(totals.totalOre)}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={totalKg === 0}
              onClick={() => {
                track("checkout_started", { items: activeLines.length, total_ore: totals.totalOre });
                goTo(2);
              }}
            >
              Fortsätt till leverans
            </button>
          </div>
        </>
      )}

      {/* STEG 2: LEVERANS (köpläge -> område -> dag) */}
      {step === 2 && !cartEmptiedMidFlow && (
        <>
          <h1 tabIndex={-1} style={{ outline: "none", fontSize: 32, marginBottom: 6 }}>Leverans</h1>
          <p style={{ fontSize: 15, color: "var(--text-2)", margin: "0 0 20px" }}>
            Vi kör själva, på fasta leveransdagar per område.
          </p>
          <MiniSummary
            lines={summaryLines}
            totalOre={totals.totalOre}
            mode={modeSummary}
            onEdit={() => goTo(1)}
          />

          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>En gång eller återkommande?</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <button
              type="button"
              className={`choice-btn${mode === "ONE_TIME" ? " selected" : ""}`}
              aria-pressed={mode === "ONE_TIME"}
              onClick={() => {
                cart.setPurchaseMode("ONE_TIME");
                track("purchase_mode_selected", { mode: "ONE_TIME" });
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 15 }}>Engångsbeställning</div>
              <div className="choice-sub">En leverans, en faktura — klart.</div>
            </button>
            <button
              type="button"
              className={`choice-btn${mode === "RECURRING" ? " selected" : ""}`}
              aria-pressed={mode === "RECURRING"}
              onClick={() => {
                cart.setPurchaseMode("RECURRING");
                track("purchase_mode_selected", { mode: "RECURRING" });
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 15 }}>Återkommande leverans</div>
              <div className="choice-sub">Samma beställning kommer automatiskt — ingen bindningstid.</div>
            </button>
          </div>

          {mode === "RECURRING" && (
            <>
              <div style={{ fontWeight: 700, fontSize: 15, margin: "18px 0 12px" }}>Hur ofta?</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                {INTERVALS.map((iv) => (
                  <button
                    key={iv.value}
                    type="button"
                    className={`choice-btn${interval === iv.value ? " selected" : ""}`}
                    aria-pressed={interval === iv.value}
                    style={{ textAlign: "center", padding: "16px 14px" }}
                    onClick={() => cart.setRecurrenceInterval(iv.value)}
                  >
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{iv.label}</div>
                    <div className="choice-sub" style={{ marginTop: 3 }}>{iv.sub}</div>
                  </button>
                ))}
              </div>
              <div className="info-box-muted" style={{ marginBottom: 14, fontSize: "13.5px" }}>
                Inför varje leverans skapas en vanlig order med faktura som mejlas till er. Ingen
                bindningstid — pausa eller avsluta när ni vill.
              </div>
            </>
          )}

          <div style={{ fontWeight: 700, fontSize: 15, margin: "18px 0 12px" }}>Vilket område?</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: 10,
              marginBottom: 28,
            }}
          >
            {areas.map((a) => (
              <button
                key={a.slug}
                type="button"
                className={`choice-btn${areaSlug === a.slug ? " selected" : ""}`}
                aria-pressed={areaSlug === a.slug}
                style={{ textAlign: "center" }}
                onClick={() => setAreaSlug(a.slug)}
              >
                {a.name}
              </button>
            ))}
          </div>
          {errors.areaSlug && <p className="error-text">{errors.areaSlug}</p>}

          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
            {mode === "RECURRING" ? "När vill ni ha första leveransen?" : "När vill ni ha leveransen?"}
          </div>
          {!selectedArea && (
            <p style={{ fontSize: 14, color: "var(--text-2)", margin: "0 0 16px" }}>
              Välj område först så visar vi tillgängliga leveransdagar.
            </p>
          )}
          {selectedArea && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 10,
                marginBottom: 16,
              }}
            >
              {upcomingDates.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`choice-btn${deliveryDate === d ? " selected" : ""}`}
                  aria-pressed={deliveryDate === d}
                  onClick={() => setDeliveryDate(d)}
                >
                  <div style={{ fontWeight: 700, fontSize: 15 }}>
                    {capitalizeFirst(formatDeliveryDate(fromISODate(d)))}
                  </div>
                  <div className="choice-sub">
                    {mode === "RECURRING" ? "Första leverans · sedan " + intervalLabel(interval).toLowerCase() : "Leverans under dagen"}
                  </div>
                </button>
              ))}
            </div>
          )}
          {(errors.deliveryDate || errors.firstDeliveryDate) && (
            <p className="error-text">{errors.deliveryDate ?? errors.firstDeliveryDate}</p>
          )}
          <div className="info-box" style={{ marginBottom: 28 }}>
            Vi levererar under dagen till bemannade företagsadresser. Se därför till att någon kan
            ta emot leveransen.
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <button type="button" className="btn btn-outline" onClick={() => goTo(1)}>
              Tillbaka
            </button>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={!areaSlug || !deliveryDate}
              onClick={() => goTo(3)}
            >
              Fortsätt till företagsuppgifter
            </button>
          </div>
        </>
      )}

      {/* STEG 3: UPPGIFTER */}
      {step === 3 && !cartEmptiedMidFlow && (
        <>
          <h1 tabIndex={-1} style={{ outline: "none", fontSize: 32, marginBottom: 6 }}>Företagsuppgifter</h1>
          <p style={{ fontSize: 15, color: "var(--text-2)", margin: "0 0 20px" }}>
            Vi behöver bara det som krävs för leverans och faktura.
          </p>
          <MiniSummary
            lines={summaryLines}
            totalOre={totals.totalOre}
            mode={modeSummary}
            delivery={
              selectedArea && deliveryDate
                ? `${selectedArea.name} · ${formatDeliveryDate(fromISODate(deliveryDate))}`
                : undefined
            }
            onEdit={() => goTo(1)}
          />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (validateStep3()) {
                track("customer_details_completed", { mode });
                goTo(4);
              }
            }}
            noValidate
          >
            <div className="form-grid">
              <Field label="Företagsnamn" value={form.companyName} error={errors.companyName} onChange={(v) => setField("companyName", v)} placeholder="Företaget AB" autoComplete="organization" />
              <Field label="Organisationsnummer" value={form.orgNumber} error={errors.orgNumber} onChange={(v) => setField("orgNumber", v)} placeholder="556677-8899" />
              <Field label="Kontaktperson" value={form.contactName} error={errors.contactName} onChange={(v) => setField("contactName", v)} placeholder="För- och efternamn" autoComplete="name" />
              <Field label="Telefon" value={form.phone} error={errors.phone} onChange={(v) => setField("phone", v)} placeholder="07X-XXX XX XX" type="tel" autoComplete="tel" />
              <Field label="E-post" value={form.email} error={errors.email} onChange={(v) => setField("email", v)} placeholder="namn@foretaget.se" type="email" autoComplete="email" />
              <div style={{ display: "flex", flexDirection: "column", gap: 10, justifyContent: "flex-end" }}>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={sameEmail}
                    onChange={(e) => setSameEmail(e.target.checked)}
                  />
                  Använd samma e-post för faktura
                </label>
                {!sameEmail && (
                  <Field label="Faktura-e-post" value={form.invoiceEmail} error={errors.invoiceEmail} onChange={(v) => setField("invoiceEmail", v)} placeholder="faktura@foretaget.se" type="email" />
                )}
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Leveransadress" value={form.deliveryAddress} error={errors.deliveryAddress} onChange={(v) => setField("deliveryAddress", v)} placeholder="Gatuadress" autoComplete="street-address" />
              </div>
              <Field label="Postnummer" value={form.deliveryPostalCode} error={errors.deliveryPostalCode} onChange={(v) => setField("deliveryPostalCode", v)} placeholder="135 48" autoComplete="postal-code" />
              <Field label="Ort" value={form.deliveryCity} error={errors.deliveryCity} onChange={(v) => setField("deliveryCity", v)} placeholder="Tyresö" autoComplete="address-level2" />
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Referens / märkning (frivilligt)" value={form.reference} error={errors.reference} onChange={(v) => setField("reference", v)} placeholder="T.ex. kostnadsställe" />
              </div>
              <label className="field" style={{ gridColumn: "1 / -1" }} htmlFor="falt-kommentar">
                Kommentar till leveransen (frivilligt)
                <textarea
                  id="falt-kommentar"
                  rows={2}
                  maxLength={500}
                  placeholder="T.ex. portkod, lastkaj, våning"
                  value={form.deliveryInstruction}
                  onChange={(e) => setField("deliveryInstruction", e.target.value)}
                  aria-invalid={!!errors.deliveryInstruction}
                  aria-describedby={errors.deliveryInstruction ? "falt-kommentar-fel" : undefined}
                  style={{ resize: "vertical" }}
                />
                {errors.deliveryInstruction && (
                  <span id="falt-kommentar-fel" className="error-text">
                    {errors.deliveryInstruction}
                  </span>
                )}
              </label>
              {/* Honeypot — osynligt för människor, autofylls av botar. */}
              <div className="hp-field" aria-hidden="true">
                <label htmlFor="falt-webbplats">Webbplats</label>
                <input
                  id="falt-webbplats"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>
            </div>
            <div className="info-box-muted" style={{ margin: "20px 0 28px" }}>
              <strong>Betalning sker mot faktura.</strong> Ingen kortbetalning behövs — fakturan
              skickas till er faktura-e-post{mode === "RECURRING" ? " inför varje leverans" : ""}.
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <button type="button" className="btn btn-outline" onClick={() => goTo(2)}>
                Tillbaka
              </button>
              <button type="submit" className="btn btn-primary btn-lg">
                Kontrollera order
              </button>
            </div>
          </form>
        </>
      )}

      {/* STEG 4: KONTROLLERA */}
      {step === 4 && !cartEmptiedMidFlow && (
        <>
          <h1 tabIndex={-1} style={{ outline: "none", fontSize: 32, marginBottom: 28 }}>Kontrollera er order</h1>
          <div className="card" style={{ padding: "24px 26px", display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div className="section-label">KAKOR</div>
              <EditStepLink onClick={() => goTo(1)} />
            </div>
            {summaryLines.map((l) => (
              <div
                key={l.name}
                className="divider-row"
                style={{ display: "flex", justifyContent: "space-between", fontSize: 15, paddingBottom: 10 }}
              >
                <span style={{ fontWeight: 600 }}>{l.name}</span>
                <span>
                  {qtyLabel(l.kg, l.unit)} · {formatOre(l.ore)}
                </span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "var(--text-2)" }}>
              <span>Moms</span>
              <span>{formatOre(totals.vatOre)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 16 }}>
              <span>{mode === "RECURRING" ? "Totalt per leverans inkl. moms" : "Totalt inkl. moms"}</span>
              <span>
                {formatWeightKg(totalWeightGrams)} · {formatOre(totals.totalOre)}
              </span>
            </div>
          </div>
          <div className="card" style={{ padding: "24px 26px", display: "flex", flexDirection: "column", gap: 8, marginBottom: 20, fontSize: "14.5px", lineHeight: 1.6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div className="section-label">LEVERANS</div>
              <EditStepLink onClick={() => goTo(2)} />
            </div>
            <div>
              {mode === "RECURRING"
                ? `Återkommande — ${intervalLabel(interval).toLowerCase()}`
                : "Engångsbeställning"}
            </div>
            <div>
              {selectedArea?.name} ·{" "}
              {deliveryDate
                ? `${mode === "RECURRING" ? "första leverans " : ""}${formatDeliveryDate(fromISODate(deliveryDate))}`
                : "—"}
            </div>
            <div style={{ color: "var(--text-2)" }}>Leverans under dagen till bemannad företagsadress.</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 10 }}>
              <div className="section-label">FÖRETAG</div>
              <EditStepLink onClick={() => goTo(3)} />
            </div>
            <div>
              {form.companyName} · {form.orgNumber} · {form.deliveryAddress}, {form.deliveryPostalCode}{" "}
              {form.deliveryCity}
            </div>
            <div style={{ color: "var(--text-2)" }}>
              {form.contactName} · {form.email} · Faktura till {sameEmail ? form.email : form.invoiceEmail}
            </div>
          </div>
          <div className="info-box" style={{ marginBottom: 28 }}>
            {mode === "RECURRING"
              ? "Betalning sker mot faktura — en faktura per leverans. Ingen bindningstid."
              : "Betalning sker mot faktura."}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <button type="button" className="btn btn-outline" onClick={() => goTo(3)}>
              Tillbaka
            </button>
            <button
              type="button"
              className="btn btn-send btn-lg"
              disabled={submitting || !areaSlug || !deliveryDate || activeLines.length === 0}
              onClick={submit}
            >
              {submitting
                ? "Skickar…"
                : mode === "RECURRING"
                  ? `Skicka beställning · ${formatOre(totals.totalOre)} per leverans`
                  : `Skicka beställning · ${formatOre(totals.totalOre)}`}
            </button>
          </div>
        </>
      )}

      {/* STEG 5: TACK */}
      {step === 5 && result?.kind === "order" && (
        <>
          <div style={{ textAlign: "center", padding: "24px 0 8px" }}>
            <div style={{ marginBottom: 16, display: "inline-block" }}>
              <LogoSigill size={110} />
            </div>
            <h1 tabIndex={-1} style={{ outline: "none", fontSize: 34, marginBottom: 10 }}>Tack! Vi har tagit emot er beställning.</h1>
            <div className="mono" style={{ fontSize: 13, letterSpacing: 1, color: "var(--text-2)", marginBottom: 28 }}>
              ORDER {result.orderNumber}
            </div>
          </div>
          <div className="card" style={{ padding: "24px 26px", display: "flex", flexDirection: "column", gap: 12, marginBottom: 20, fontSize: "14.5px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
              <span>Totalt</span>
              <span>{formatOre(result.totalOre)}</span>
            </div>
            <div style={{ color: "var(--text-2)" }}>
              Leverans {formatDeliveryDate(fromISODate(result.deliveryDate))} · under dagen
            </div>
          </div>
          <div className="info-box-muted" style={{ padding: "22px 24px", fontSize: "14.5px", lineHeight: 1.8 }}>
            <strong>Vad händer nu?</strong>
            <br />
            1. Ni får en orderbekräftelse till er e-post.
            <br />
            2. Vi packar och levererar på vald leveransdag.
            <br />
            3. Fakturan skickas till er faktura-e-post.
          </div>
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <a href={result.invoiceUrl} className="btn btn-outline" target="_blank" rel="noopener">
              Ladda ner faktura (PDF)
            </a>
          </div>
          <PreferredSourceCTA placement="result_success" />
          <div style={{ textAlign: "center", marginTop: 28 }}>
            <Link href="/" style={{ fontWeight: 700, fontSize: 15 }}>
              ← Till startsidan
            </Link>
          </div>
        </>
      )}

      {step === 5 && result?.kind === "subscription" && (
        <>
          <div style={{ textAlign: "center", padding: "24px 0 8px" }}>
            <div style={{ marginBottom: 16, display: "inline-block" }}>
              <LogoSigill size={110} />
            </div>
            <h1 tabIndex={-1} style={{ outline: "none", fontSize: 34, marginBottom: 10 }}>Tack! Er återkommande leverans är igång.</h1>
            <div className="mono" style={{ fontSize: 13, letterSpacing: 1, color: "var(--text-2)", marginBottom: 28 }}>
              PRENUMERATION {result.number}
            </div>
          </div>
          <div className="card" style={{ padding: "24px 26px", display: "flex", flexDirection: "column", gap: 12, marginBottom: 20, fontSize: "14.5px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
              <span>Per leverans</span>
              <span>{formatOre(result.totalOre)}</span>
            </div>
            <div style={{ color: "var(--text-2)" }}>
              {intervalLabel(result.interval)} ·{" "}
              <span>första leverans {formatDeliveryDate(fromISODate(result.nextDate))}</span>
            </div>
          </div>
          <div className="info-box-muted" style={{ padding: "22px 24px", fontSize: "14.5px", lineHeight: 1.8 }}>
            <strong>Vad händer nu?</strong>
            <br />
            1. Ni får en bekräftelse till er e-post.
            <br />
            2. Inför varje leverans skapas en order med faktura som mejlas till er.
            <br />
            3. Ingen bindningstid — svara på bekräftelsemejlet så pausar eller avslutar vi.
          </div>
          <PreferredSourceCTA placement="subscription_success" />
          <div style={{ textAlign: "center", marginTop: 28 }}>
            <Link href="/" style={{ fontWeight: 700, fontSize: 15 }}>
              ← Till startsidan
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  placeholder,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
}) {
  const id = "falt-" + label.toLowerCase().replace(/[^a-z0-9åäö]+/g, "-");
  return (
    <label className={`field${error ? " field-error" : ""}`} htmlFor={id}>
      {label}
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-fel` : undefined}
      />
      {error && (
        <span id={`${id}-fel`} className="error-text">
          {error}
        </span>
      )}
    </label>
  );
}

function EditStepLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        // ≥ 44 px träffyta utan att layouten växer.
        padding: "10px 8px",
        margin: "-10px -8px",
        cursor: "pointer",
        color: "var(--red)",
        fontWeight: 700,
        fontSize: "12.5px",
        fontFamily: "var(--font-sans)",
        textDecoration: "underline",
      }}
    >
      Ändra
    </button>
  );
}

// Kompakt ordersammanfattning i steg 2–3: beställningen ska vara synlig
// genom hela flödet, inte bara i granskningssteget.
function MiniSummary({
  lines,
  totalOre,
  delivery,
  mode,
  onEdit,
}: {
  lines: { name: string; kg: number; unit: string; ore: number }[];
  totalOre: number;
  delivery?: string;
  mode?: string;
  onEdit: () => void;
}) {
  if (lines.length === 0) return null;
  return (
    <div
      className="card"
      style={{
        padding: "14px 18px",
        marginBottom: 24,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "baseline",
        gap: "6px 14px",
        fontSize: "13.5px",
      }}
    >
      <span className="section-label" style={{ fontSize: 11 }}>ER BESTÄLLNING</span>
      <span style={{ color: "var(--text-2)", flex: "1 1 auto" }}>
        {lines.map((l) => `${l.name} ${qtyLabel(l.kg, l.unit)}`).join(" · ")}
        {mode ? ` · ${mode}` : null}
        {delivery ? (
          <span> · {delivery}</span>
        ) : null}
      </span>
      <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{formatOre(totalOre)} inkl. moms</span>
      <EditStepLink onClick={onEdit} />
    </div>
  );
}
