"use client";

// Sajtens ENDA beställningsflöde: Kakor -> Leverans -> Uppgifter ->
// Kontrollera -> Tack. Engångsköp och återkommande leverans är samma
// funnel och samma varukorg – köpläget väljs i leveranssteget
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
import { effectiveVatRateBp } from "@/lib/vat";
import { formatWeightKg, lineWeightGrams, priceSuffix, qtyLabel } from "@/lib/units";
import { capitalizeFirst, formatDeliveryDate, fromISODate, toISODate, upcomingDeliveryDates, changeDeadline, formatDeadline, isoWeekday, weekdayName } from "@/lib/dates";
import { isPastCutoff, leadTimeAllowingNextDelivery } from "@/lib/warehouse/cutoff";
import { PreferredSourceCTA } from "@/components/preferred-source/PreferredSourceCTA";
import { newIdempotencyKey } from "@/lib/idempotency";
import { isValidOrgNumber } from "@/lib/orgnumber";
import { unitLabel } from "@/lib/units";
import { Turnstile, TURNSTILE_SITE_KEY } from "@/components/Turnstile";
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
  /** Tom = fakturaadress samma som leveransadress (servern faller tillbaka). */
  billingAddress: string;
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
  billingAddress: "",
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

interface ResultLine {
  productId: string;
  name: string;
  kg: number;
  unit: string;
  ore: number;
  imageRef: string;
}
interface ResultCommon {
  lines: ResultLine[];
  email: string;
  invoiceEmail: string;
  address: string;
  areaName: string;
}
type SubmitResult =
  | ({ kind: "order"; orderNumber: string; invoiceUrl: string; deliveryDate: string; totalOre: number } & ResultCommon)
  | ({ kind: "subscription"; number: string; nextDate: string; interval: RecurrenceInterval; totalOre: number } & ResultCommon);

// Pågående flödesdata (steg, leveransval, formulär) – sessionStorage så att
// reload/back/avstickare inte kastar bort något. Korgen bor i localStorage.
const FLOW_STORAGE_KEY = "sb_checkout_v1";
// Företagsuppgifter som kunden VALT att spara till nästa beställning (localStorage,
// bara i den här webbläsaren). Aldrig utan kryssrutan.
const SAVED_DETAILS_KEY = "sb_foretag_v1";
const SAVED_FIELDS: (keyof FormState)[] = [
  "companyName", "orgNumber", "contactName", "phone", "email", "invoiceEmail",
  "deliveryAddress", "deliveryPostalCode", "deliveryCity", "reference", "billingAddress", "deliveryInstruction",
];

/** Ungefärligt antal kakor per enhet (kg eller paket) – null när admin inte fyllt i. */
function piecesPerUnit(p: ProductCardData): number | null {
  if (!p.piecesPerKgApprox || p.piecesPerKgApprox <= 0) return null;
  if (p.unit === "paket") return p.packageWeightGrams > 0 ? (p.piecesPerKgApprox * p.packageWeightGrams) / 1000 : null;
  return p.piecesPerKgApprox;
}
// Tumregeln från guiden: 3–5 småkakor per person. Förslaget räknar med fyra.
const PIECES_PER_PERSON_MIN = 3;
const PIECES_PER_PERSON_MAX = 5;
const PIECES_PER_PERSON_SUGGEST = 4;
// Senaste lyckade beställning – så att Tack-sidan överlever en omladdning.
const RESULT_STORAGE_KEY = "sb_last_result_v1";

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
  paymentTermsDays,
  changePolicy,
}: {
  products: ProductCardData[];
  areas: AreaWithDates[];
  paymentTermsDays: number;
  /** Avbokning/ändring senast kl. changeCutoffHour, changeCutoffWorkdays arbetsdagar före leverans. */
  changePolicy: { changeCutoffWorkdays: number; changeCutoffHour: number };
}) {
  const deadlineText = (iso: string | null) =>
    iso ? formatDeadline(changeDeadline(fromISODate(iso), changePolicy.changeCutoffWorkdays, changePolicy.changeCutoffHour)) : null;
  const cart = useCart();
  const [step, setStep] = useState(1);
  const [areaSlug, setAreaSlug] = useState<string | null>(null);
  const [deliveryDate, setDeliveryDate] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [sameEmail, setSameEmail] = useState(true);
  const [saveDetails, setSaveDetails] = useState(false);
  const [restoredFromSaved, setRestoredFromSaved] = useState(false);
  const [persons, setPersons] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Sekunder kvar innan nästa försök tillåts (Retry-After vid 429).
  const [retryAfter, setRetryAfter] = useState(0);
  useEffect(() => {
    if (retryAfter <= 0) return;
    const t = setTimeout(() => setRetryAfter((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [retryAfter]);
  const [result, setResult] = useState<SubmitResult | null>(null);
  // Robotskydd (Cloudflare Turnstile) – bara när sajtnyckel finns i env.
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [flowRestored, setFlowRestored] = useState(false);
  const headingRef = useRef<HTMLDivElement>(null);
  // EN nyckel per beställningsförsök – behålls även om kunden går tillbaka
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
            // Bara kända fält med strängvärden – sessionStorage är opålitlig input.
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
      // korrupt lagring – starta från steg 1
    }
    // Omladdning av Tack-sidan (URL:en bär ?kvitto=1): visa kvittot igen.
    // Ett vanligt besök på /bestall startar alltid en ny beställning.
    try {
      const rawResult = sessionStorage.getItem(RESULT_STORAGE_KEY);
      const wantsReceipt = new URLSearchParams(window.location.search).get("kvitto") === "1";
      if (rawResult && wantsReceipt && !sessionStorage.getItem(FLOW_STORAGE_KEY)) {
        const r = JSON.parse(rawResult) as SubmitResult;
        if (r && (r.kind === "order" || r.kind === "subscription")) {
          setResult(r);
          setStep(5);
        }
      }
    } catch {
      // ingen kvittokopia – inget att visa
    }
    // Sparade företagsuppgifter (kundens eget val vid en tidigare beställning):
    // fyll i när inget pågående flöde redan bär uppgifter.
    try {
      const hasFlow = !!sessionStorage.getItem(FLOW_STORAGE_KEY);
      const rawSaved = localStorage.getItem(SAVED_DETAILS_KEY);
      if (rawSaved && !hasFlow) {
        const saved = JSON.parse(rawSaved) as Partial<FormState> & { sameEmail?: boolean };
        const safe = Object.fromEntries(
          Object.entries(saved).filter(([k, v]) => (SAVED_FIELDS as string[]).includes(k) && typeof v === "string" && v.length <= 500)
        ) as Partial<FormState>;
        if (Object.keys(safe).length > 0) {
          setForm({ ...EMPTY_FORM, ...safe });
          setSameEmail(saved.sameEmail !== false);
          setSaveDetails(true);
          setRestoredFromSaved(true);
        }
      }
    } catch {
      // lagring otillgänglig eller korrupt – tomt formulär
    }
    setFlowRestored(true);
  }, []);

  const clearSavedDetails = () => {
    try {
      localStorage.removeItem(SAVED_DETAILS_KEY);
    } catch {
      // inget att rensa
    }
    setForm(EMPTY_FORM);
    setSameEmail(true);
    setSaveDetails(false);
    setRestoredFromSaved(false);
  };

  // Webbläsarens bakåt/framåt ska gå mellan stegen, inte lämna kassan.
  useEffect(() => {
    if (!flowRestored) return;
    if (typeof window === "undefined") return;
    window.history.replaceState({ ...(window.history.state ?? {}), sbStep: step }, "");
    const onPop = (e: PopStateEvent) => {
      const st = (e.state as { sbStep?: unknown } | null)?.sbStep;
      if (typeof st === "number" && st >= 1 && st <= 4) {
        setStep(st);
        setGlobalError(null);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowRestored]);

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
      sessionStorage.removeItem(RESULT_STORAGE_KEY);
    } catch {
      // privat läge – flödet funkar ändå under sessionen
    }
  };
  useEffect(() => {
    if (!flowRestored || result) return;
    saveFlow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowRestored, result, step, areaSlug, deliveryDate, form, sameEmail]);

  // /bestall?typ=aterkommande (från prenumerations-CTA:er) förväljer
  // återkommande leverans – appliceras efter att korgen hydrerats så att
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
  // rensas ur korgen – annars räknar headerns badge något kunden inte ser.
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
  // Räknas per render (fyra rader – billigt): priset ingår då alltid, så
  // en prisändring som hämtas via router.refresh() slår igenom i summan.
  const totals = calculateTotals(
    activeLines.map((l) => ({
      netOre: l.kg * l.product.pricePerKgOre,
      // Momsen följer leveransdagen (6 % t.o.m. 2027-12-31): samma regel som servern.
      vatRateBp: effectiveVatRateBp(l.product.vatRateBp ?? 1200, deliveryDate ?? ""),
    }))
  );

  // Momssatsen visas i kontrollsteget ("Moms 6 %") när alla rader har samma sats.
  const vatRates = new Set(activeLines.map((l) => effectiveVatRateBp(l.product.vatRateBp ?? 1200, deliveryDate ?? "")));
  const vatRateLabel = vatRates.size === 1 ? `${String([...vatRates][0] / 100).replace(".", ",")}\u00a0%` : "";

  const selectedArea = areas.find((a) => a.slug === areaSlug) ?? null;

  const areaCutoffSettings = selectedArea
    ? { cutoffWeekday: selectedArea.cutoffWeekday ?? 3, cutoffHour: selectedArea.cutoffHour ?? 12, opsEmail: "" }
    : { cutoffWeekday: 3, cutoffHour: 12, opsEmail: "" };
  const effectiveLead = selectedArea
    ? leadTimeAllowingNextDelivery(
        selectedArea.leadTimeDays,
        selectedArea.weekdays,
        areaCutoffSettings,
        new Date(),
        selectedArea.blockedDates
      )
    : 0;

  // Leveransdagarna räknas om på klienten (från områdets veckodagar +
  // cutoff-medveten framförhållning) i stället för att lita på listan från
  // sidladdningen – en öppen flik över midnatt ska inte frysa in gårdagens lead.
  const upcomingDates = useMemo(
    () => {
      if (!selectedArea) return [];
      return upcomingDeliveryDates(
        {
          weekdays: selectedArea.weekdays,
          leadTimeDays: effectiveLead,
          blockedDates: [...selectedArea.blockedDates, ...selectedArea.fullDates],
        },
        Math.max(4, selectedArea.upcomingDates.length)
      )
        .filter((d) => !isPastCutoff(d, areaCutoffSettings))
        .map(toISODate);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedArea, clockTick, effectiveLead]
  );

  useEffect(() => {
    // Återställt flöde med ett område som inte längre erbjuds (inaktiverat i
    // admin): nollställ valet i stället för att visa "undefined" i steg 4.
    if (flowRestored && areaSlug && !areas.some((a) => a.slug === areaSlug)) {
      setAreaSlug(null);
      setDeliveryDate(null);
      if (step >= 3) {
        setStep(2);
        setGlobalError("Leveransområdet är inte längre tillgängligt – välj område igen.");
      }
    }
  }, [flowRestored, areaSlug, areas, step]);

  useEffect(() => {
    // Rensa valt datum om området byts eller datumet inte längre erbjuds
    // (t.ex. fliken låg öppen över framförhållningsgränsen). Står kunden
    // längre fram i flödet leds hen tillbaka till dagvalet – aldrig en död Skicka-knapp.
    if (selectedArea && deliveryDate && !upcomingDates.includes(deliveryDate)) {
      setDeliveryDate(null);
      if (step >= 3) {
        setStep(2);
        setGlobalError("Leveransdagen är inte längre tillgänglig – välj en ny dag.");
      }
    }
  }, [selectedArea, upcomingDates, deliveryDate, step]);

  // Tomkorgsvakt: hamnar kunden i steg 2–4 utan varor (korgen tömd i en
  // annan flik, eller återställt flöde med utgången korg) renderas en
  // åtgärdsbar empty state i stället för döda knappar. Deriverad direkt
  // från korgen – kan inte försvinna i någon effekt-race.
  const cartEmptiedMidFlow =
    flowRestored && cart.hydrated && !result && step >= 2 && step <= 4 && activeLines.length === 0;

  const goTo = (s: number) => {
    if (typeof window !== "undefined" && s >= 1 && s <= 4 && s !== step) {
      window.history.pushState({ ...(window.history.state ?? {}), sbStep: s }, "");
    }
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

  // Fältfel direkt när kunden lämnar fältet (org.nr, postnummer, e-post) –
  // inte först vid inskick efter elva ifyllda fält på en mobil.
  const validateField = (key: string) => {
    const all = computeStep3Errors();
    setErrors((prev) => {
      const next = { ...prev };
      if (all[key]) next[key] = all[key];
      else delete next[key];
      return next;
    });
  };

  const validateStep3 = (): boolean => {
    const e = computeStep3Errors();
    setErrors(e);
    if (Object.keys(e).length > 0) {
      requestAnimationFrame(() =>
        headingRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      );
    }
    return Object.keys(e).length === 0;
  };

  const computeStep3Errors = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (form.companyName.trim().length < 2) e.companyName = "Ange företagsnamn";
    if (!/^\d{6}-?\d{4}$/.test(form.orgNumber.trim()))
      e.orgNumber = "Ange organisationsnummer i formatet 556677-8899";
    else if (!isValidOrgNumber(form.orgNumber.trim()))
      e.orgNumber = "Organisationsnumret verkar inte stämma – kontrollera siffrorna";
    if (form.contactName.trim().length < 2) e.contactName = "Ange kontaktperson";
    if (!/^[0-9+\-() ]{6,25}$/.test(form.phone.trim())) e.phone = "Ange ett telefonnummer";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = "Ange en giltig e-postadress";
    if (!sameEmail && !/^\S+@\S+\.\S+$/.test(form.invoiceEmail.trim()))
      e.invoiceEmail = "Ange en giltig faktura-e-post";
    if (form.deliveryAddress.trim().length < 3) e.deliveryAddress = "Ange leveransadress";
    if (!/^\d{3}\s?\d{2}$/.test(form.deliveryPostalCode.trim()))
      e.deliveryPostalCode = "Ange postnummer i formatet 135 48";
    else if (selectedArea && selectedArea.postalPrefixes.length > 0) {
      const compact = form.deliveryPostalCode.replace(/\s/g, "");
      if (!selectedArea.postalPrefixes.some((pfx) => compact.startsWith(pfx.replace(/\s/g, ""))))
        e.deliveryPostalCode = `Postnumret verkar inte ligga i ${selectedArea.name} – kontrollera adressen eller byt område i steg 2`;
    }
    if (form.deliveryCity.trim().length < 2) e.deliveryCity = "Ange ort";
    if (form.deliveryInstruction.length > 500) e.deliveryInstruction = "Max 500 tecken";
    return e;
  };

  // Servern kan returnera fältfel – visa dem i det steg där felet hör hemma.
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
      // Beloppet kunden bekräftade – servern avvisar om priset hunnit ändras.
      expectedTotalOre: totals.totalOre,
      ...(honeypot ? { sb_extra: honeypot } : {}),
      ...(captchaToken ? { turnstileToken: captchaToken } : {}),
    };
    try {
      const res =
        mode === "RECURRING"
          ? await fetch("/api/subscriptions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...common, frequency: interval, firstDeliveryDate: deliveryDate, billingAddress: form.billingAddress.trim() }),
            })
          : await fetch("/api/orders", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...common, deliveryDate, billingAddress: form.billingAddress.trim() }),
            });
      // Ett HTML-svar (gateway-timeout, för stor body) är inte ett nätverksfel –
      // säg vad som hände i stället för "kontrollera uppkopplingen".
      const isJson = (res.headers.get("content-type") ?? "").includes("application/json");
      const data = isJson
        ? await res.json()
        : { ok: false, error: `Servern svarade med fel ${res.status} – försök igen om en liten stund.` };
      if (data.ok) {
        idempotencyKey.current = "";
        idempotencyFingerprint.current = "";
        track("order_completed", { mode });
        const resultCommon: ResultCommon = {
          lines: activeLines.map((l) => ({
            productId: l.product.id,
            name: l.product.name,
            kg: l.kg,
            unit: l.product.unit,
            ore: l.kg * l.product.pricePerKgOre,
            imageRef: l.product.imageRef,
          })),
          email: common.email,
          invoiceEmail: common.invoiceEmail,
          address: `${common.deliveryAddress}, ${common.deliveryPostalCode} ${common.deliveryCity}`,
          areaName: selectedArea?.name ?? "",
        };
        const newResult: SubmitResult =
          mode === "RECURRING"
            ? {
                kind: "subscription",
                number: data.subscriptionNumber,
                nextDate: data.nextDeliveryDate,
                interval,
                totalOre: typeof data.totalOre === "number" ? data.totalOre : totals.totalOre,
                ...resultCommon,
              }
            : {
                kind: "order",
                orderNumber: data.orderNumber,
                invoiceUrl: data.invoiceUrl,
                deliveryDate: data.deliveryDate,
                totalOre: data.totalOre,
                ...resultCommon,
              };
        setResult(newResult);
        try {
          sessionStorage.removeItem(FLOW_STORAGE_KEY);
        } catch {
          // lagring otillgänglig – inget att rensa
        }
        // Företagsuppgifter till nästa gång – bara när kunden kryssat i det.
        try {
          if (saveDetails) {
            const toSave = Object.fromEntries(SAVED_FIELDS.map((k) => [k, form[k]]));
            localStorage.setItem(SAVED_DETAILS_KEY, JSON.stringify({ ...toSave, sameEmail }));
          } else {
            localStorage.removeItem(SAVED_DETAILS_KEY);
          }
        } catch {
          // lagring otillgänglig – nästa beställning fylls i för hand
        }
        cart.clear();
        goTo(5);
        try {
          sessionStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(newResult));
          window.history.replaceState({ ...(window.history.state ?? {}), sbStep: 5 }, "", "/bestall?kvitto=1");
        } catch {
          // lagring otillgänglig – kvittot finns i mejlet
        }
      } else {
        track("order_failed", { mode, reason: data.code ?? "validation" });
        if (res.status === 429) {
          const wait = Math.min(300, Math.max(5, parseInt(res.headers.get("Retry-After") ?? "30", 10) || 30));
          setRetryAfter(wait);
        }
        setGlobalError(data.error ?? "Något gick fel – försök igen om en stund.");
        if (data.code === "IDEMPOTENCY_MISMATCH") {
          // Nyckeln bär en annan payload – rotera så nästa försök går igenom.
          idempotencyKey.current = newIdempotencyKey();
          idempotencyFingerprint.current = fingerprint;
          saveFlow();
        }
        if (data.code === "PRICE_CHANGED" || data.code === "DAY_FULL" || data.code === "CUTOFF" || data.fields?.items) {
          // Priser, sortiment eller leveransdagar har ändrats – hämta färska
          // produkter/datum så att kunden inte klickar på samma stängda dag igen.
          router.refresh();
        }
        if (data.code === "CAPTCHA_FAILED" || data.fields?.turnstileToken) {
          // Token förbrukad/ogiltig – ny widget så kunden kan försöka igen.
          setCaptchaToken(null);
          setCaptchaReset((n) => n + 1);
        }
        if (data.fields) {
          const fields: Record<string, string> = { ...data.fields };
          const itemKey = Object.keys(fields).find((k) => k.startsWith("items."));
          if (itemKey && !fields.items) fields.items = fields[itemKey];
          setErrors(fields);
          goTo(stepForFields(fields));
          // goTo nollställer globalError – sätt det EFTER, och lyft fält som
          // inte har något synligt formulärfält (t.ex. "_" eller sb_extra) dit,
          // annars blir felet osynligt.
          const knownFields = new Set([...Object.keys(EMPTY_FORM), "items", "areaSlug", "deliveryDate", "firstDeliveryDate", "frequency", "turnstileToken"]);
          const hidden = Object.entries(fields).filter(([k]) => !knownFields.has(k) && !k.startsWith("items."));
          setGlobalError(
            hidden.length > 0
              ? `${data.error ?? "Kontrollera uppgifterna"} (${hidden.map(([, v]) => v).join(", ")}). Ladda om sidan om felet kvarstår.`
              : (data.error ?? "Kontrollera uppgifterna")
          );
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
      setGlobalError("Kunde inte skicka beställningen – kontrollera uppkopplingen och försök igen.");
    } finally {
      setSubmitting(false);
    }
  };

  const summaryLines = result
    ? []
    : activeLines.map((l) => ({
        productId: l.product.id,
        name: l.product.name,
        kg: l.kg,
        unit: l.product.unit,
        ore: l.kg * l.product.pricePerKgOre,
        imageRef: l.product.imageRef,
      }));

  const modeSummary =
    mode === "RECURRING" ? `Fikaprenumeration · ${intervalLabel(interval).toLowerCase()}` : undefined;
  const hasPackageProducts = products.some((p) => p.unit === "paket");
  const hasPieceData = products.some((p) => piecesPerUnit(p) !== null);
  const personCount = /^\d+$/.test(persons) ? Math.min(500, parseInt(persons, 10)) : 0;


  return (
    <div
      // Steg 1 SSR-renderas och är synligt direkt (LCP, utan JS). Ett lagrat
      // flöde (reload på steg 2–4) återställs efter hydration – ett kort
      // blink i det sällsynta fallet är bättre än en tom sida i det vanliga.
      className="container-narrow checkout-root"
      style={{ padding: "40px 24px 100px" }}
      ref={headingRef}
    >
      {step <= 4 && (
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Kassa
        </div>
      )}
      {step <= 4 && (
        <ol className="progress-steps" aria-label="Beställningssteg">
          {STEP_LABELS.map((label, i) => {
            const n = i + 1;
            const state = step > n ? "done" : step === n ? "current" : "todo";
            return (
              <li
                key={label}
                aria-current={state === "current" ? "step" : undefined}
                className={`progress-step ${state}`}
              >
                <span className="progress-dot" aria-hidden="true">
                  {state === "done" ? "✓" : n}
                </span>
                <span className="progress-step-label">
                  {label}
                  {state === "done" && <span className="visually-hidden"> (klart)</span>}
                </span>
              </li>
            );
          })}
        </ol>
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
            Välj era favoriter så ordnar vi resten – allt ni redan fyllt i finns kvar.
          </p>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => goTo(1)}>
            Välj kakor
          </button>
        </div>
      )}

      {/* Inga aktiva områden: säg det i stället för ett tomt val och en död knapp. */}
      {areas.length === 0 && step <= 4 && (
        <div role="status" className="info-box" style={{ marginBottom: 20 }}>
          Vi tar just nu inte emot beställningar – inget leveransområde är öppet. Prova igen om en stund.
        </div>
      )}

      {/* STEG 1: KAKOR */}
      {step === 1 && (
        <>
          <h1 tabIndex={-1} style={{ outline: "none", fontSize: 32, marginBottom: 6 }}>Välj kakor</h1>
          <p style={{ fontSize: 15, color: "var(--text-2)", margin: "0 0 28px" }}>
            {hasPackageProducts
              ? "Lösvikt säljs per helt kilo och paket per styck – blanda fritt. "
              : "Sorterna säljs per helt kilo – blanda fritt. "}
            Räkna 3–5 småkakor per person till fikat.{" "}
            <Link href="/fika-till-jobbet" target="_blank" rel="noopener">Hur mycket behöver ni?</Link>
          </p>
          {hasPieceData && (
            <div className="info-box-muted" style={{ marginBottom: 18, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 16px" }}>
              <label htmlFor="antal-personer" style={{ fontWeight: 700, fontSize: 15 }}>Hur många ska fika?</label>
              <input
                id="antal-personer"
                type="number"
                inputMode="numeric"
                min={1}
                max={500}
                value={persons}
                placeholder="t.ex. 25"
                onChange={(e) => setPersons(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
                style={{ width: 96, padding: "9px 12px", border: "1.5px solid var(--input-border)", borderRadius: "var(--radius)", fontSize: 15, background: "var(--surface)" }}
              />
              <span style={{ fontSize: 13.5, color: "var(--text-2)" }}>
                {personCount ? `Vi föreslår mängd per sort nedan, räknat på ${PIECES_PER_PERSON_SUGGEST} kakor per person.` : "Så föreslår vi en mängd per sort."}
              </span>
            </div>
          )}
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
                  {(() => {
                    const pieces = piecesPerUnit(p);
                    if (!pieces) return null;
                    const qty = qtyFor(p.id);
                    if (qty > 0) {
                      const lo = Math.floor((qty * pieces) / PIECES_PER_PERSON_MAX);
                      const hi = Math.floor((qty * pieces) / PIECES_PER_PERSON_MIN);
                      return (
                        <div className="qty-hint" aria-live="polite">
                          Räcker till ca {lo}–{hi} personer
                        </div>
                      );
                    }
                    if (personCount) {
                      const suggested = Math.min(MAX_UNITS, Math.max(1, Math.ceil((personCount * PIECES_PER_PERSON_SUGGEST) / pieces)));
                      return (
                        <div className="qty-hint">
                          Förslag för {personCount} personer: {qtyLabel(suggested, p.unit)}{" "}
                          <button type="button" className="link-btn" onClick={() => setQty(p, suggested)}>
                            Lägg i korgen
                          </button>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
                <div className="stepper">
                  <button
                    type="button"
                    aria-label={`Minska ${p.name}`}
                    onClick={() => setQty(p, Math.max(0, qtyFor(p.id) - 1))}
                  >
                    −
                  </button>
                  <label className="stepper-value stepper-input">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={MAX_UNITS}
                      value={qtyFor(p.id)}
                      aria-label={`Antal ${unitLabel(p.unit)} ${p.name}`}
                      style={{ width: `${Math.max(1, String(qtyFor(p.id)).length)}ch` }}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        setQty(p, Number.isFinite(n) ? Math.min(MAX_UNITS, Math.max(0, n)) : 0);
                      }}
                    />
                    <span aria-hidden="true">{unitLabel(p.unit)}</span>
                  </label>
                  <button
                    type="button"
                    aria-label={`Öka ${p.name}`}
                    disabled={qtyFor(p.id) >= MAX_UNITS}
                    onClick={() => setQty(p, Math.min(MAX_UNITS, qtyFor(p.id) + 1))}
                  >
                    +
                  </button>
                </div>
                {/* Utanför steppern och med reserverad plats: "+"-knappen får aldrig flytta sig
                    när raden läggs till (ett dubbelklick skulle annars träffa "Ta bort"). */}
                <button
                  type="button"
                  className="stepper-remove"
                  style={{ visibility: qtyFor(p.id) > 0 ? "visible" : "hidden" }}
                  aria-hidden={qtyFor(p.id) === 0 || undefined}
                  tabIndex={qtyFor(p.id) > 0 ? 0 : -1}
                  onClick={() => setQty(p, 0)}
                >
                  Ta bort
                </button>
              </div>
            ))}
          </div>
          {errors.items && <p className="error-text" style={{ marginTop: 12 }}>{errors.items}</p>}
          {/* Sticky i botten på mobil – nästa steg är alltid ett tumtryck bort. */}
          <div className="checkout-total-bar">
            <div className="checkout-total-text" aria-live="polite" aria-atomic="true">
              {totalKg === 0 ? (
                <>
                  <div className="checkout-total-label" style={{ fontWeight: 700, color: "var(--text)" }}>Korgen är tom</div>
                  <div className="checkout-total-label">Välj kakor ovan</div>
                </>
              ) : (
                <>
                  <div className="checkout-total-label">
                    {formatWeightKg(totalWeightGrams)} · inkl. moms
                  </div>
                  <div className="total-amount">{formatOre(totals.totalOre)}</div>
                </>
              )}
            </div>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={totalKg === 0}
              aria-label="Fortsätt till leverans"
              onClick={() => {
                track("checkout_started", { items: activeLines.length, total_ore: totals.totalOre });
                goTo(2);
              }}
            >
              {/* Kort etikett på smala skärmar så att summan aldrig kapas; tillgängligt namn är alltid det fulla. */}
              <span className="checkout-total-cta-long">Fortsätt till leverans</span>
              <span className="checkout-total-cta-short">Fortsätt</span>
            </button>
          </div>
        </>
      )}

      {/* STEG 2: LEVERANS (köpläge -> område -> dag) */}
      {step === 2 && !cartEmptiedMidFlow && (
        <>
          <h1 tabIndex={-1} style={{ outline: "none", fontSize: 32, marginBottom: 6 }}>Leverans</h1>
          <p style={{ fontSize: 15, color: "var(--text-2)", margin: "0 0 20px" }}>
            Fasta leveransdagar per område, leverans under dagen.
          </p>
          <MiniSummary
            lines={summaryLines}
            totalOre={totals.totalOre}
            mode={modeSummary}
            onEdit={() => goTo(1)}
          />

          <div id="grp-lage" style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>En gång eller återkommande?</div>
          <div role="radiogroup" aria-labelledby="grp-lage"
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
              role="radio" aria-checked={mode === "ONE_TIME"}
              onClick={() => {
                cart.setPurchaseMode("ONE_TIME");
                track("purchase_mode_selected", { mode: "ONE_TIME" });
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 15 }}>Engångsbeställning</div>
              <div className="choice-sub">En leverans, en faktura – klart.</div>
            </button>
            <button
              type="button"
              className={`choice-btn${mode === "RECURRING" ? " selected" : ""}`}
              role="radio" aria-checked={mode === "RECURRING"}
              onClick={() => {
                cart.setPurchaseMode("RECURRING");
                track("purchase_mode_selected", { mode: "RECURRING" });
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 15 }}>Fikaprenumeration</div>
              <div className="choice-sub">Samma beställning kommer automatiskt – ingen bindningstid.</div>
            </button>
          </div>

          {mode === "RECURRING" && (
            <>
              <div id="grp-intervall" style={{ fontWeight: 700, fontSize: 15, margin: "18px 0 12px" }}>Hur ofta?</div>
              <div role="radiogroup" aria-labelledby="grp-intervall"
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
                    role="radio" aria-checked={interval === iv.value}
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
                bindningstid – pausa eller avsluta när ni vill.
              </div>
            </>
          )}

          <div id="grp-omrade" style={{ fontWeight: 700, fontSize: 15, margin: "18px 0 12px" }}>Vilket område?</div>
          <div role="radiogroup" aria-labelledby="grp-omrade" className="area-grid">
            {areas.map((a) => (
              <button
                key={a.slug}
                type="button"
                className={`choice-btn${areaSlug === a.slug ? " selected" : ""}`}
                role="radio" aria-checked={areaSlug === a.slug}
                style={{ textAlign: "center" }}
                onClick={() => setAreaSlug(a.slug)}
              >
                <div style={{ fontWeight: 700 }}>{a.name}</div>
                {(a.weekdays.length > 0 || a.postalPrefixes.length > 0) && (
                  <div className="choice-sub" style={{ marginTop: 2 }}>
                    {/* Veckodag och postnummer på var sin rad – samma form på alla fyra kort, ingen slumpmässig radbrytning. */}
                    {a.weekdays.length > 0 && <span style={{ display: "block" }}>{a.weekdays.map((w) => `${capitalizeFirst(weekdayName(w))}ar`).join(", ")}</span>}
                    {a.postalPrefixes.length > 0 && (
                      <span style={{ display: "block" }}>postnr {a.postalPrefixes.slice(0, 3).map((p) => `${p}…`).join(", ")}</span>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
          {errors.areaSlug && <p className="error-text">{errors.areaSlug}</p>}

          <div id="grp-datum" style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
            {mode === "RECURRING" ? "När vill ni ha första leveransen?" : "När vill ni ha leveransen?"}
          </div>
          {!selectedArea && (
            <p style={{ fontSize: 14, color: "var(--text-2)", margin: "0 0 16px" }}>
              Välj område först så visar vi tillgängliga leveransdagar.
            </p>
          )}
          {selectedArea && upcomingDates.length === 0 && (
            <p role="status" className="info-box" style={{ marginBottom: 16, fontSize: 14 }}>
              Just nu finns inga öppna leveransdagar i {selectedArea.name}
              {selectedArea.cutoffNotice ? ` – ${selectedArea.cutoffNotice}` : ". Prova ett annat område eller kom tillbaka efter nästa cutoff."}
            </p>
          )}
          {selectedArea && upcomingDates.length > 0 && (
            <p style={{ fontSize: 14, color: "var(--text-2)", margin: "0 0 12px" }}>
              {effectiveLead > 0
                ? `Vi packar i förväg och behöver ${effectiveLead === 1 ? "en dag" : `${effectiveLead} dagar`} på oss – ${formatDeliveryDate(fromISODate(upcomingDates[0]))} är den tidigaste dagen vi kan lova.`
                : `Tidigaste leverans: ${formatDeliveryDate(fromISODate(upcomingDates[0]))}.`}
              {mode === "RECURRING" ? " Infaller en leverans på en helgdag hör vi av oss – den flyttas eller utgår." : ""}
            </p>
          )}
          {selectedArea?.cutoffNotice && (
            <div role="status" className="info-box" style={{ marginBottom: 12, fontSize: 14 }}>
              {selectedArea.cutoffNotice}
            </div>
          )}
          {selectedArea && (
            <div className="date-grid" role="radiogroup" aria-labelledby="grp-datum" style={{ marginBottom: 16 }}>
              {upcomingDates.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`choice-btn${deliveryDate === d ? " selected" : ""}`}
                  role="radio" aria-checked={deliveryDate === d}
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
              Fortsätt till uppgifter
            </button>
          </div>
        </>
      )}

      {/* STEG 3: UPPGIFTER */}
      {step === 3 && !cartEmptiedMidFlow && (
        <>
          <h1 tabIndex={-1} style={{ outline: "none", fontSize: 32, marginBottom: 6 }}>Era uppgifter</h1>
          <p style={{ fontSize: 15, color: "var(--text-2)", margin: "0 0 20px" }}>
            Vi behöver bara det som krävs för leverans och faktura.
          </p>
          {restoredFromSaved && (
            <div className="info-box-muted" role="status" style={{ marginBottom: 18, fontSize: 14 }}>
              Uppgifterna är ifyllda från er förra beställning i den här webbläsaren.{" "}
              <button type="button" className="link-btn" onClick={clearSavedDetails}>
                Rensa och börja om
              </button>
            </div>
          )}
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
              <Field label="Organisationsnummer" value={form.orgNumber} error={errors.orgNumber} onChange={(v) => setField("orgNumber", v)} onBlur={() => validateField("orgNumber")} placeholder="556677-8899" hint="Tio siffror – står på företagets fakturor och registreringsbevis." inputMode="numeric" />
              <Field label="Kontaktperson" value={form.contactName} error={errors.contactName} onChange={(v) => setField("contactName", v)} placeholder="För- och efternamn" autoComplete="name" />
              <Field label="Telefon" value={form.phone} error={errors.phone} onChange={(v) => setField("phone", v)} onBlur={() => validateField("phone")} placeholder="07X-XXX XX XX" type="tel" autoComplete="tel" hint="Används bara om något krånglar vid leveransen." />
              <Field label="E-post" value={form.email} error={errors.email} onChange={(v) => setField("email", v)} onBlur={() => validateField("email")} placeholder="namn@foretaget.se" type="email" autoComplete="email" hint="Hit går orderbekräftelsen." />
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
                  <Field label="Faktura-e-post" value={form.invoiceEmail} error={errors.invoiceEmail} onChange={(v) => setField("invoiceEmail", v)} onBlur={() => validateField("invoiceEmail")} placeholder="faktura@foretaget.se" type="email" hint="Hit går fakturan som PDF." />
                )}
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Leveransadress" value={form.deliveryAddress} error={errors.deliveryAddress} onChange={(v) => setField("deliveryAddress", v)} placeholder="Gatuadress" autoComplete="street-address" />
              </div>
              <Field label="Postnummer" value={form.deliveryPostalCode} error={errors.deliveryPostalCode} onChange={(v) => setField("deliveryPostalCode", v)} onBlur={() => validateField("deliveryPostalCode")} placeholder="135 48" autoComplete="postal-code" inputMode="numeric" />
              <Field label="Ort" value={form.deliveryCity} error={errors.deliveryCity} onChange={(v) => setField("deliveryCity", v)} placeholder="Tyresö" autoComplete="address-level2" />
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Er referens på fakturan (frivilligt)" value={form.reference} error={errors.reference} onChange={(v) => setField("reference", v)} placeholder="T.ex. kostnadsställe eller beställarens namn" hint="Skrivs ut som ”Er referens” på fakturan. Lämnas fältet tomt står kontaktpersonen som referens." />
              </div>
              {(
                <div className={`field${errors.billingAddress ? " field-error" : ""}`} style={{ gridColumn: "1 / -1" }}>
                  <label htmlFor="falt-fakturaadress">Fakturaadress om annan än leveransadressen (frivilligt)</label>
                  <textarea
                    id="falt-fakturaadress"
                    rows={2}
                    maxLength={300}
                    placeholder="T.ex. Box 123, 135 22 Tyresö – lämna tomt så står leveransadressen på fakturan"
                    value={form.billingAddress}
                    onChange={(e) => setField("billingAddress", e.target.value)}
                    aria-invalid={!!errors.billingAddress}
                    aria-describedby={errors.billingAddress ? "falt-fakturaadress-fel" : undefined}
                  />
                  {errors.billingAddress && (
                    <span id="falt-fakturaadress-fel" className="error-text">
                      {errors.billingAddress}
                    </span>
                  )}
                </div>
              )}
              <div className={`field${errors.deliveryInstruction ? " field-error" : ""}`} style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="falt-kommentar">Kommentar till leveransen (frivilligt)</label>
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
              </div>
              {/* Honeypot – osynligt för människor, autofylls av botar. */}
              <div className="hp-field" aria-hidden="true">
                <label htmlFor="falt-extra">Lämna tomt</label>
                <input
                  id="falt-extra"
                  name="sb_extra"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>
            </div>
            <label className="checkbox-label" style={{ marginTop: 18 }}>
              <input type="checkbox" checked={saveDetails} onChange={(e) => setSaveDetails(e.target.checked)} />
              Spara företagsuppgifterna i den här webbläsaren till nästa beställning
            </label>
            <div className="info-box-muted" style={{ margin: "20px 0 28px" }}>
              <strong>Betalning sker mot faktura.</strong> Ingen kortbetalning behövs – fakturan
              skapas {mode === "RECURRING" ? "inför varje leverans" : "när ni skickar beställningen"} och
              mejlas till er faktura-e-post.
              {mode !== "RECURRING" && deadlineText(deliveryDate) ? (
                <> Ändringar och avbokning senast {deadlineText(deliveryDate)} – därefter faktureras beställningen.</>
              ) : null}{" "}
              Genom att beställa godkänner ni våra{" "}
              <Link href="/villkor" target="_blank" rel="noopener">köpvillkor</Link> (öppnas i ny flik).
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <button type="button" className="btn btn-outline" onClick={() => goTo(2)}>
                Tillbaka
              </button>
              <button type="submit" className="btn btn-primary btn-lg">
                Kontrollera beställningen
              </button>
            </div>
          </form>
        </>
      )}

      {/* STEG 4: KONTROLLERA */}
      {step === 4 && !cartEmptiedMidFlow && (
        <>
          <h1 tabIndex={-1} style={{ outline: "none", fontSize: 32, marginBottom: 28 }}>Kontrollera er beställning</h1>
          <div className="card" style={{ padding: "24px 26px", display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h2 className="section-label" style={{ margin: 0, fontSize: "inherit" }}>KAKOR</h2>
              <EditStepLink onClick={() => goTo(1)} />
            </div>
            {summaryLines.map((l) => (
              <div
                key={l.productId}
                className="divider-row"
                style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 15, paddingBottom: 10 }}
              >
                <span className="review-thumb">
                  <ImageSlot label={l.name} src={l.imageRef || undefined} decorative />
                </span>
                <span style={{ fontWeight: 600, flex: 1 }}>{l.name}</span>
                <span>
                  {qtyLabel(l.kg, l.unit)} · {formatOre(l.ore)}
                </span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "var(--text-2)" }}>
              <span>Summa exkl. moms</span>
              <span>{formatOre(totals.subtotalOre)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "var(--text-2)" }}>
              <span>Leverans</span>
              <span>Ingår · 0{"\u00a0"}kr</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "var(--text-2)" }}>
              <span>Moms{vatRateLabel ? ` ${vatRateLabel}` : ""}</span>
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
              <h2 className="section-label" style={{ margin: 0, fontSize: "inherit" }}>LEVERANS</h2>
              <EditStepLink onClick={() => goTo(2)} />
            </div>
            <div>
              {mode === "RECURRING"
                ? `Fikaprenumeration – ${intervalLabel(interval).toLowerCase()}`
                : "Engångsbeställning"}
            </div>
            <div>
              {selectedArea?.name} ·{" "}
              {deliveryDate
                ? `${mode === "RECURRING" ? "första leverans " : ""}${formatDeliveryDate(fromISODate(deliveryDate))}`
                : "–"}
            </div>
            <div style={{ color: "var(--text-2)" }}>Leverans under dagen till bemannad företagsadress.</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 10 }}>
              <h2 className="section-label" style={{ margin: 0, fontSize: "inherit" }}>FÖRETAG</h2>
              <EditStepLink onClick={() => goTo(3)} />
            </div>
            <div>
              {form.companyName} · {form.orgNumber} · {form.deliveryAddress}, {form.deliveryPostalCode}{" "}
              {form.deliveryCity}
            </div>
            <div style={{ color: "var(--text-2)" }}>
              {form.contactName} · {form.phone} · {form.email}
            </div>
            <div style={{ color: "var(--text-2)" }}>
              Faktura till {sameEmail ? form.email : form.invoiceEmail}
              {form.billingAddress.trim() ? <> · Fakturaadress: {form.billingAddress.trim()}</> : null}
              {form.reference.trim() ? <> · Er referens: {form.reference.trim()}</> : null}
            </div>
            {form.deliveryInstruction.trim() ? (
              <div style={{ color: "var(--text-2)" }}>Leveransanvisning: {form.deliveryInstruction.trim()}</div>
            ) : null}
          </div>
          <div className="info-box" style={{ marginBottom: 28 }}>
            {mode === "RECURRING" ? (
              <>
                <strong>Betalning sker mot faktura</strong> – en faktura per leverans, {paymentTermsDays} dagar efter leveransen. Ingen
                bindningstid. Beloppet gäller dagens priser; priset som gäller vid varje leverans står på fakturan.
              </>
            ) : (
              <>
                <strong>Betalning sker mot faktura</strong> som mejlas till {sameEmail ? form.email : form.invoiceEmail} och förfaller {paymentTermsDays} dagar
                efter leveransen.
                {deadlineText(deliveryDate) ? <> Ändringar och avbokning kostnadsfritt till {deadlineText(deliveryDate)} – svara på orderbekräftelsen.</> : null}
              </>
            )}{" "}
            Genom att skicka beställningen godkänner ni våra{" "}
            <Link href="/villkor" target="_blank" rel="noopener">köpvillkor</Link> (öppnas i ny flik).
          </div>
          {TURNSTILE_SITE_KEY && (
            <div style={{ marginBottom: 20 }}>
              <Turnstile onToken={setCaptchaToken} resetKey={captchaReset} />
              {errors.turnstileToken && (
                <div className="error-text" role="alert" style={{ marginTop: 6 }}>
                  {errors.turnstileToken}
                </div>
              )}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <button type="button" className="btn btn-outline" onClick={() => goTo(3)}>
              Tillbaka
            </button>
            <button
              type="button"
              className="btn btn-send btn-lg"
              disabled={submitting || retryAfter > 0 || !areaSlug || !deliveryDate || activeLines.length === 0 || (!!TURNSTILE_SITE_KEY && !captchaToken)}
              onClick={submit}
            >
              {retryAfter > 0
                ? `Vänta ${retryAfter} s innan nästa försök`
                : submitting
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
            <div className="success-mark" aria-hidden="true">✓</div>
            <h1 tabIndex={-1} style={{ outline: "none", fontSize: 34, marginBottom: 10 }}>Tack! Vi har tagit emot er beställning.</h1>
            <div className="mono" style={{ fontSize: 13, letterSpacing: 1, color: "var(--text-2)", marginBottom: 6 }}>
              ORDERNUMMER {result.orderNumber}
            </div>
            <p style={{ fontSize: 14.5, color: "var(--text-2)", margin: "0 0 28px" }}>
              Orderbekräftelsen skickas till <strong>{result.email}</strong>
              {result.invoiceEmail !== result.email ? <> och fakturan till <strong>{result.invoiceEmail}</strong></> : null}.
            </p>
          </div>
          <ResultSummary
            lines={result.lines}
            totalOre={result.totalOre}
            totalLabel="Totalt inkl. moms"
            delivery={`${result.areaName} · ${result.deliveryDate ? formatDeliveryDate(fromISODate(result.deliveryDate)) : "vald leveransdag"} · under dagen`}
            address={result.address}
          />
          <div className="info-box-muted" style={{ padding: "22px 24px", fontSize: "14.5px", lineHeight: 1.8 }}>
            <strong>Vad händer nu?</strong>
            <ol style={{ margin: "6px 0 0", paddingLeft: 22 }}>
              <li>Orderbekräftelse och faktura mejlas nu – fakturan förfaller {paymentTermsDays} dagar efter leveransen.</li>
              <li>Vi packar och levererar på vald leveransdag.</li>
              <li>Något att ändra? Svara på orderbekräftelsen{result.deliveryDate ? ` senast ${deadlineText(result.deliveryDate)}` : ""}.</li>
            </ol>
          </div>
          <div className="invoice-actions">
            <a href={result.invoiceUrl} className="btn btn-primary" target="_blank" rel="noopener">
              Öppna fakturan
            </a>
            <a href={`${result.invoiceUrl}?download=1`} className="btn btn-outline">
              Spara PDF
            </a>
            <p className="invoice-actions-hint">Öppna för att skriva ut från webbläsaren. Spara PDF lägger filen på datorn eller i Filer.</p>
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
            <div className="success-mark" aria-hidden="true">✓</div>
            <h1 tabIndex={-1} style={{ outline: "none", fontSize: 34, marginBottom: 10 }}>Tack! Er fikaprenumeration är igång.</h1>
            <div className="mono" style={{ fontSize: 13, letterSpacing: 1, color: "var(--text-2)", marginBottom: 6 }}>
              PRENUMERATION {result.number}
            </div>
            <p style={{ fontSize: 14.5, color: "var(--text-2)", margin: "0 0 28px" }}>
              Bekräftelsen skickas till <strong>{result.email}</strong>.
            </p>
          </div>
          <ResultSummary
            lines={result.lines}
            totalOre={result.totalOre}
            totalLabel="Per leverans inkl. moms"
            delivery={`${result.areaName} · ${intervalLabel(result.interval)} · första leverans ${result.nextDate ? formatDeliveryDate(fromISODate(result.nextDate)) : "enligt bekräftelsen"}`}
            address={result.address}
          />
          <div className="info-box-muted" style={{ padding: "22px 24px", fontSize: "14.5px", lineHeight: 1.8 }}>
            <strong>Vad händer nu?</strong>
            <ol style={{ margin: "6px 0 0", paddingLeft: 22 }}>
              <li>Ni får en bekräftelse till er e-post.</li>
              <li>
                {result.nextDate
                  ? `Första leverans ${formatDeliveryDate(fromISODate(result.nextDate))}, sedan ${intervalLabel(result.interval).toLowerCase()} på ${weekdayName(isoWeekday(fromISODate(result.nextDate)))}ar.`
                  : "Leveransdagarna står i bekräftelsen."}{" "}
                Några dagar före varje leverans mejlas en orderbekräftelse med faktura.
              </li>
              <li>Ingen bindningstid – svara på bekräftelsemejlet så pausar, ändrar eller avslutar vi. Ändringar gäller från nästa leverans.</li>
            </ol>
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
  onBlur,
  error,
  hint,
  placeholder,
  type = "text",
  autoComplete,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string;
  /** Kort hjälptext under fältet – varför vi frågar, eller var uppgiften finns. */
  hint?: string;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  inputMode?: "numeric" | "tel" | "email" | "text";
}) {
  // Stabilt id oberoende av etikettens längd/parenteser – E2E och skärmläsare.
  const id = "falt-" + label.toLowerCase().split(" (")[0].split(" på ")[0].split(" / ")[0].replace(/[^a-z0-9åäö]+/g, "-").replace(/-+$/, "");
  const describedBy = [error ? `${id}-fel` : "", hint ? `${id}-hjalp` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`field${error ? " field-error" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={!!error}
        aria-describedby={describedBy}
      />
      {error && (
        <span id={`${id}-fel`} className="error-text">
          {error}
        </span>
      )}
      {hint && !error && (
        <span id={`${id}-hjalp`} className="field-hint">
          {hint}
        </span>
      )}
    </div>
  );
}

// Tack-sidans sammanfattning (mönster: Shopify/adidas orderbekräftelse –
// rader med bild, leverans, adress; kunden ska kunna kontrollera allt utan mejlet).
function ResultSummary({
  lines,
  totalOre,
  totalLabel,
  delivery,
  address,
}: {
  lines: ResultLine[];
  totalOre: number;
  totalLabel: string;
  delivery: string;
  address: string;
}) {
  return (
    <div className="card" style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 12, marginBottom: 20, fontSize: "14.5px" }}>
      {lines.map((l) => (
        <div key={l.productId} className="divider-row" style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 10 }}>
          <span className="review-thumb">
            <ImageSlot label={l.name} src={l.imageRef || undefined} decorative />
          </span>
          <span style={{ fontWeight: 600, flex: 1 }}>{l.name}</span>
          <span>
            {qtyLabel(l.kg, l.unit)} · {formatOre(l.ore)}
          </span>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 16 }}>
        <span>{totalLabel}</span>
        <span>{formatOre(totalOre)}</span>
      </div>
      <div style={{ borderTop: "1px solid var(--divider)", paddingTop: 12, display: "grid", gap: 4, color: "var(--text-2)" }}>
        <div>
          <strong style={{ color: "var(--text)" }}>Leverans:</strong> {delivery}
        </div>
        <div>
          <strong style={{ color: "var(--text)" }}>Adress:</strong> {address}
        </div>
        <div>Betalning mot faktura.</div>
      </div>
    </div>
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
  lines: { productId: string; name: string; kg: number; unit: string; ore: number }[];
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
