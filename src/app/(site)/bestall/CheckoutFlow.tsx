"use client";

// Snabbeställning/checkout enligt Bestallning.dc.html:
// Kakor -> Leverans -> Uppgifter -> Kontrollera -> Tack.
// Steg 1 är varukorgen: kvantiteter synkas mot cart-context (localStorage).

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import type { ProductCardData } from "@/components/ProductCard";
import type { AreaWithDates } from "@/lib/products";
import { ImageSlot } from "@/components/ImageSlot";
import { formatOre, calculateTotals } from "@/lib/money";
import { formatDeliveryDate, fromISODate } from "@/lib/dates";
import { LogoMark } from "@/components/Logo";
import { PreferredSourceCTA } from "@/components/preferred-source/PreferredSourceCTA";

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

interface OrderResult {
  orderNumber: string;
  invoiceUrl: string;
  deliveryDate: string;
  totalOre: number;
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
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<OrderResult | null>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  // Ny nyckel varje gång kunden når granskningssteget; återanvänds vid retry
  // så att dubbelklick/nätverksfel aldrig ger två ordrar.
  const idempotencyKey = useRef<string>("");

  const qtyFor = (productId: string) => cart.lines.find((l) => l.productId === productId)?.kg ?? 0;

  const setQty = (product: ProductCardData, kg: number) => {
    if (kg > 0 && qtyFor(product.id) === 0) {
      cart.addKg(
        {
          productId: product.id,
          slug: product.slug,
          name: product.name,
          pricePerKgOre: product.pricePerKgOre,
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
  const totals = useMemo(
    () =>
      calculateTotals(
        activeLines.map((l) => ({ netOre: l.kg * l.product.pricePerKgOre, vatRateBp: 1200 }))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(activeLines.map((l) => [l.product.id, l.kg]))]
  );

  const selectedArea = areas.find((a) => a.slug === areaSlug) ?? null;

  useEffect(() => {
    // Rensa valt datum om området byts och datumet inte finns där.
    if (selectedArea && deliveryDate && !selectedArea.upcomingDates.includes(deliveryDate)) {
      setDeliveryDate(null);
    }
  }, [selectedArea, deliveryDate]);

  const goTo = (s: number) => {
    if (s === 4) {
      idempotencyKey.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    }
    setStep(s);
    setGlobalError(null);
    requestAnimationFrame(() => headingRef.current?.scrollIntoView({ block: "start" }));
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
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!areaSlug || !deliveryDate || activeLines.length === 0) return;
    setSubmitting(true);
    setGlobalError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: idempotencyKey.current || undefined,
          items: activeLines.map((l) => ({ productId: l.product.id, weightKg: l.kg })),
          areaSlug,
          deliveryDate,
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
          billingAddress: "",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setResult({
          orderNumber: data.orderNumber,
          invoiceUrl: data.invoiceUrl,
          deliveryDate: data.deliveryDate,
          totalOre: data.totalOre,
        });
        cart.clear();
        goTo(5);
      } else {
        setGlobalError(data.error ?? "Något gick fel");
        if (data.fields) {
          setErrors(data.fields);
          if (data.fields.deliveryDate || data.fields.areaSlug) goTo(2);
          else if (data.fields.items) goTo(1);
          else goTo(3);
        }
      }
    } catch {
      setGlobalError("Kunde inte skicka beställningen — kontrollera uppkopplingen och försök igen.");
    } finally {
      setSubmitting(false);
    }
  };

  const summaryLines = result
    ? []
    : activeLines.map((l) => ({ name: l.product.name, kg: l.kg, ore: l.kg * l.product.pricePerKgOre }));

  return (
    <div className="container-narrow" style={{ padding: "40px 24px 100px" }} ref={headingRef}>
      {step <= 4 && (
        <div className="progress-steps" role="list" aria-label="Beställningssteg">
          {STEP_LABELS.map((label, i) => (
            <div key={label} role="listitem" className={`progress-step${step > i ? " done" : ""}`}>
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

      {/* STEG 1: KAKOR */}
      {step === 1 && (
        <>
          <h1 style={{ fontSize: 32, marginBottom: 6 }}>Välj kakor</h1>
          <p style={{ fontSize: 15, color: "var(--text-2)", margin: "0 0 28px" }}>
            Alla sorter säljs per kilo. Blanda fritt.
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
                    {formatOre(p.pricePerKgOre)}/kg · {p.allergens.replace("Innehåller ", "").replace(".", "")}
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
                    {qtyFor(p.id)} kg
                  </div>
                  <button type="button" aria-label={`Öka ${p.name}`} onClick={() => setQty(p, qtyFor(p.id) + 1)}>
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
          {errors.items && <p className="error-text" style={{ marginTop: 12 }}>{errors.items}</p>}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 28,
              background: "var(--section-tint)",
              borderRadius: 8,
              padding: "18px 22px",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontSize: 13, color: "var(--text-2)" }}>Totalt</div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 700 }}>
                {totalKg} kg · {formatOre(totals.totalOre)}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={totalKg === 0}
              onClick={() => goTo(2)}
            >
              Fortsätt till leverans
            </button>
          </div>
        </>
      )}

      {/* STEG 2: LEVERANS */}
      {step === 2 && (
        <>
          <h1 style={{ fontSize: 32, marginBottom: 6 }}>Leverans</h1>
          <p style={{ fontSize: 15, color: "var(--text-2)", margin: "0 0 28px" }}>
            Vi kör själva, på fasta leveransdagar per område.
          </p>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Vilket område?</div>
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

          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>När vill ni ha leveransen?</div>
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
              {selectedArea.upcomingDates.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`choice-btn${deliveryDate === d ? " selected" : ""}`}
                  aria-pressed={deliveryDate === d}
                  onClick={() => setDeliveryDate(d)}
                >
                  <div style={{ fontWeight: 700, fontSize: 15, textTransform: "capitalize" }}>
                    {formatDeliveryDate(fromISODate(d))}
                  </div>
                  <div className="choice-sub">Leverans under dagen</div>
                </button>
              ))}
            </div>
          )}
          {errors.deliveryDate && <p className="error-text">{errors.deliveryDate}</p>}
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
      {step === 3 && (
        <>
          <h1 style={{ fontSize: 32, marginBottom: 6 }}>Företagsuppgifter</h1>
          <p style={{ fontSize: 15, color: "var(--text-2)", margin: "0 0 28px" }}>
            Vi behöver bara det som krävs för leverans och faktura.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (validateStep3()) goTo(4);
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
              <label className="field" style={{ gridColumn: "1 / -1" }}>
                Kommentar till leveransen (frivilligt)
                <textarea
                  rows={2}
                  placeholder="T.ex. portkod, lastkaj, våning"
                  value={form.deliveryInstruction}
                  onChange={(e) => setField("deliveryInstruction", e.target.value)}
                  style={{ resize: "vertical" }}
                />
              </label>
            </div>
            <div className="info-box-muted" style={{ margin: "20px 0 28px" }}>
              <strong>Betalning sker mot faktura.</strong> Ingen kortbetalning behövs — fakturan
              skickas till er faktura-e-post.
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
      {step === 4 && (
        <>
          <h1 style={{ fontSize: 32, marginBottom: 28 }}>Kontrollera er order</h1>
          <div className="card" style={{ padding: "24px 26px", display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
            <div className="section-label">KAKOR</div>
            {summaryLines.map((l) => (
              <div
                key={l.name}
                className="divider-row"
                style={{ display: "flex", justifyContent: "space-between", fontSize: 15, paddingBottom: 10 }}
              >
                <span style={{ fontWeight: 600 }}>{l.name}</span>
                <span>
                  {l.kg} kg · {formatOre(l.ore)}
                </span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "var(--text-2)" }}>
              <span>Moms (12 %)</span>
              <span>{formatOre(totals.vatOre)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 16 }}>
              <span>Totalt</span>
              <span>
                {totalKg} kg · {formatOre(totals.totalOre)}
              </span>
            </div>
          </div>
          <div className="card" style={{ padding: "24px 26px", display: "flex", flexDirection: "column", gap: 8, marginBottom: 20, fontSize: "14.5px", lineHeight: 1.6 }}>
            <div className="section-label">LEVERANS</div>
            <div style={{ textTransform: "capitalize" }}>
              {selectedArea?.name} · {deliveryDate ? formatDeliveryDate(fromISODate(deliveryDate)) : "—"}
            </div>
            <div style={{ color: "var(--text-2)" }}>Leverans under dagen till bemannad företagsadress.</div>
            <div className="section-label" style={{ marginTop: 10 }}>FÖRETAG</div>
            <div>
              {form.companyName} · {form.orgNumber} · {form.deliveryAddress}, {form.deliveryPostalCode}{" "}
              {form.deliveryCity}
            </div>
            <div style={{ color: "var(--text-2)" }}>
              {form.contactName} · {form.email} · Faktura till {sameEmail ? form.email : form.invoiceEmail}
            </div>
          </div>
          <div className="info-box" style={{ marginBottom: 28 }}>Betalning sker mot faktura.</div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <button type="button" className="btn btn-outline" onClick={() => goTo(3)}>
              Tillbaka
            </button>
            <button type="button" className="btn btn-send btn-lg" disabled={submitting} onClick={submit}>
              {submitting ? "Skickar…" : "Skicka beställning"}
            </button>
          </div>
        </>
      )}

      {/* STEG 5: TACK */}
      {step === 5 && result && (
        <>
          <div style={{ textAlign: "center", padding: "24px 0 8px" }}>
            <div style={{ marginBottom: 16, display: "inline-block" }}>
              <LogoMark size={72} />
            </div>
            <h1 style={{ fontSize: 34, marginBottom: 10 }}>Tack! Vi har tagit emot er beställning.</h1>
            <div className="mono" style={{ fontSize: 13, letterSpacing: 1, color: "var(--text-2)", marginBottom: 28 }}>
              ORDER {result.orderNumber}
            </div>
          </div>
          <div className="card" style={{ padding: "24px 26px", display: "flex", flexDirection: "column", gap: 12, marginBottom: 20, fontSize: "14.5px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
              <span>Totalt</span>
              <span>{formatOre(result.totalOre)}</span>
            </div>
            <div style={{ color: "var(--text-2)", textTransform: "capitalize" }}>
              Leverans {formatDeliveryDate(fromISODate(result.deliveryDate))} · under dagen
            </div>
          </div>
          <div className="info-box-muted" style={{ padding: "22px 24px", fontSize: "14.5px", lineHeight: 1.8 }}>
            <strong>Vad händer nu?</strong>
            <br />
            1. Ni får en orderbekräftelse till er e-post.
            <br />
            2. Vi bakar och levererar på vald leveransdag.
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
  return (
    <label className={`field${error ? " field-error" : ""}`}>
      {label}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
      />
      {error && <span className="error-text">{error}</span>}
    </label>
  );
}
