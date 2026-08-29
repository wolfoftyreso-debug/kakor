"use client";

// Fikaprenumeration enligt Fikaprenumeration.dc.html: en sida med
// kakor + intervall + leveransdag + uppgifter och sticky sammanställning.
// Prenumeration = återkommande order mot faktura, ingen kortdebitering.

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ProductCardData } from "@/components/ProductCard";
import type { AreaWithDates } from "@/lib/products";
import { ImageSlot } from "@/components/ImageSlot";
import { calculateTotals, formatOre } from "@/lib/money";
import { formatDeliveryDate, fromISODate } from "@/lib/dates";

const INTERVALS = [
  { value: "WEEKLY", label: "Varje vecka", sub: "För arbetsplatser som fikar ofta" },
  { value: "BIWEEKLY", label: "Varannan vecka", sub: "Vanligast — lagom påfyllning" },
  { value: "MONTHLY", label: "En gång i månaden", sub: "Till möten och fredagsfika" },
] as const;

export function SubscriptionFlow({
  products,
  areas,
}: {
  products: ProductCardData[];
  areas: AreaWithDates[];
}) {
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(products.map((p, i) => [p.id, i < 2 ? 1 : 0]))
  );
  const [frequency, setFrequency] = useState<string>("BIWEEKLY");
  const [areaSlug, setAreaSlug] = useState<string | null>(null);
  const [firstDate, setFirstDate] = useState<string | null>(null);
  const [form, setForm] = useState({
    companyName: "",
    orgNumber: "",
    contactName: "",
    email: "",
    phone: "",
    deliveryAddress: "",
    deliveryPostalCode: "",
    deliveryCity: "",
    invoiceEmail: "",
    reference: "",
    deliveryInstruction: "",
  });
  const [sameEmail, setSameEmail] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ number: string; nextDate: string } | null>(null);

  const selectedArea = areas.find((a) => a.slug === areaSlug) ?? null;
  const lines = products.map((p) => ({ product: p, kg: qty[p.id] ?? 0 })).filter((l) => l.kg > 0);
  const totalKg = lines.reduce((s, l) => s + l.kg, 0);
  const totals = useMemo(
    () =>
      calculateTotals(lines.map((l) => ({ netOre: l.kg * l.product.pricePerKgOre, vatRateBp: 1200 }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(lines.map((l) => [l.product.id, l.kg]))]
  );

  const setField = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => {
      if (!e[k]) return e;
      const n = { ...e };
      delete n[k];
      return n;
    });
  };

  const bump = (productId: string, delta: number) =>
    setQty((q) => ({ ...q, [productId]: Math.max(0, (q[productId] ?? 0) + delta) }));

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (totalKg === 0) e.items = "Välj minst en kaka";
    if (!areaSlug) e.areaSlug = "Välj leveransområde";
    if (!firstDate) e.firstDeliveryDate = "Välj första leveransdag";
    if (form.companyName.trim().length < 2) e.companyName = "Ange företagsnamn";
    if (!/^\d{6}-?\d{4}$/.test(form.orgNumber.trim()))
      e.orgNumber = "Ange organisationsnummer i formatet 556677-8899";
    if (form.contactName.trim().length < 2) e.contactName = "Ange kontaktperson";
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
    if (!validate()) {
      setGlobalError("Kontrollera uppgifterna ovan.");
      return;
    }
    setSubmitting(true);
    setGlobalError(null);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({ productId: l.product.id, weightKg: l.kg })),
          frequency,
          areaSlug,
          firstDeliveryDate: firstDate,
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
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setDone({ number: data.subscriptionNumber, nextDate: data.nextDeliveryDate });
        window.scrollTo({ top: 0 });
      } else {
        setGlobalError(data.error ?? "Något gick fel");
        if (data.fields) setErrors(data.fields);
      }
    } catch {
      setGlobalError("Kunde inte starta prenumerationen — försök igen.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="container-narrow" style={{ padding: "48px 24px 100px", textAlign: "center" }}>
        <h2 style={{ fontSize: 30, marginBottom: 10 }}>Er fikaprenumeration är igång!</h2>
        <div className="mono" style={{ fontSize: 13, letterSpacing: 1, color: "var(--text-2)", marginBottom: 24 }}>
          PRENUMERATION {done.number}
        </div>
        <div className="info-box-muted" style={{ textAlign: "left", lineHeight: 1.8 }}>
          <strong>Vad händer nu?</strong>
          <br />
          1. Ni får en bekräftelse till er e-post.
          <br />
          2. Första leveransen kommer{" "}
          <strong style={{ textTransform: "capitalize" }}>
            {formatDeliveryDate(fromISODate(done.nextDate))}
          </strong>
          .
          <br />
          3. Inför varje leverans skapas en order med faktura — pausa eller avsluta när ni vill
          genom att kontakta oss.
        </div>
        <div style={{ marginTop: 28 }}>
          <Link href="/" style={{ fontWeight: 700 }}>
            ← Till startsidan
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-medium sub-grid" style={{ padding: "48px 24px 100px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
        {/* 1. Kakor */}
        <div>
          <h2 style={{ fontSize: 22, marginBottom: 4 }}>1. Vilka kakor?</h2>
          <p style={{ fontSize: 14, color: "var(--text-2)", margin: "0 0 16px" }}>
            Blanda fritt — ändra när som helst.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {products.map((p) => (
              <div
                key={p.id}
                className="card"
                style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 18px" }}
              >
                <div style={{ width: 56, height: 56, borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
                  <ImageSlot label={p.name} src={p.imageRef || undefined} />
                </div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: 17, fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: "12.5px", color: "var(--text-2)" }}>
                    {p.description} · {formatOre(p.pricePerKgOre)}/kg
                  </div>
                </div>
                <div className="stepper">
                  <button type="button" aria-label={`Minska ${p.name}`} onClick={() => bump(p.id, -1)}>
                    −
                  </button>
                  <div className="stepper-value">{qty[p.id] ?? 0} kg</div>
                  <button type="button" aria-label={`Öka ${p.name}`} onClick={() => bump(p.id, 1)}>
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
          {errors.items && <p className="error-text" style={{ marginTop: 8 }}>{errors.items}</p>}
        </div>

        {/* 2. Intervall */}
        <div>
          <h2 style={{ fontSize: 22, marginBottom: 16 }}>2. Hur ofta?</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            {INTERVALS.map((iv) => (
              <button
                key={iv.value}
                type="button"
                className={`choice-btn${frequency === iv.value ? " selected" : ""}`}
                aria-pressed={frequency === iv.value}
                style={{ textAlign: "center", padding: "18px 14px" }}
                onClick={() => setFrequency(iv.value)}
              >
                <div style={{ fontWeight: 700, fontSize: 15 }}>{iv.label}</div>
                <div className="choice-sub" style={{ marginTop: 3 }}>{iv.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 3. Leveransdag */}
        <div>
          <h2 style={{ fontSize: 22, marginBottom: 16 }}>3. Var och när?</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
              gap: 10,
              marginBottom: 12,
            }}
          >
            {areas.map((a) => (
              <button
                key={a.slug}
                type="button"
                className={`choice-btn${areaSlug === a.slug ? " selected" : ""}`}
                aria-pressed={areaSlug === a.slug}
                style={{ textAlign: "center" }}
                onClick={() => {
                  setAreaSlug(a.slug);
                  setFirstDate(null);
                }}
              >
                {a.name}
              </button>
            ))}
          </div>
          {errors.areaSlug && <p className="error-text">{errors.areaSlug}</p>}
          {selectedArea && (
            <>
              <div style={{ fontWeight: 700, fontSize: 14, margin: "12px 0 8px" }}>Första leverans:</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                {selectedArea.upcomingDates.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`choice-btn${firstDate === d ? " selected" : ""}`}
                    aria-pressed={firstDate === d}
                    onClick={() => setFirstDate(d)}
                  >
                    <div style={{ fontWeight: 700, fontSize: 15, textTransform: "capitalize" }}>
                      {formatDeliveryDate(fromISODate(d))}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
          {errors.firstDeliveryDate && <p className="error-text">{errors.firstDeliveryDate}</p>}
          <div className="info-box" style={{ fontSize: "13.5px" }}>
            Vi levererar under dagen till bemannade företagsadresser. Se till att någon kan ta emot
            leveransen.
          </div>
        </div>

        {/* 4. Uppgifter */}
        <div>
          <h2 style={{ fontSize: 22, marginBottom: 16 }}>4. Företagsuppgifter</h2>
          <div className="form-grid">
            <SubField label="Företagsnamn" k="companyName" form={form} errors={errors} set={setField} placeholder="Företaget AB" />
            <SubField label="Organisationsnummer" k="orgNumber" form={form} errors={errors} set={setField} placeholder="556677-8899" />
            <SubField label="Kontaktperson" k="contactName" form={form} errors={errors} set={setField} placeholder="För- och efternamn" />
            <SubField label="Telefon (frivilligt)" k="phone" form={form} errors={errors} set={setField} placeholder="07X-XXX XX XX" />
            <SubField label="E-post" k="email" form={form} errors={errors} set={setField} placeholder="namn@foretaget.se" type="email" />
            <div style={{ display: "flex", flexDirection: "column", gap: 10, justifyContent: "flex-end" }}>
              <label className="checkbox-label">
                <input type="checkbox" checked={sameEmail} onChange={(e) => setSameEmail(e.target.checked)} />
                Använd samma e-post för faktura
              </label>
              {!sameEmail && (
                <SubField label="Faktura-e-post" k="invoiceEmail" form={form} errors={errors} set={setField} placeholder="faktura@foretaget.se" type="email" />
              )}
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <SubField label="Leveransadress" k="deliveryAddress" form={form} errors={errors} set={setField} placeholder="Gatuadress" />
            </div>
            <SubField label="Postnummer" k="deliveryPostalCode" form={form} errors={errors} set={setField} placeholder="135 48" />
            <SubField label="Ort" k="deliveryCity" form={form} errors={errors} set={setField} placeholder="Tyresö" />
            <div style={{ gridColumn: "1 / -1" }}>
              <SubField label="Referens / märkning (frivilligt)" k="reference" form={form} errors={errors} set={setField} placeholder="T.ex. kostnadsställe" />
            </div>
          </div>
        </div>
      </div>

      {/* Sticky sammanställning */}
      <aside
        className="card sub-aside"
        style={{
          position: "sticky",
          top: 24,
          padding: 26,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          alignSelf: "start",
        }}
      >
        <div className="section-label">ER FIKAPRENUMERATION</div>
        {lines.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "14.5px" }}>
            {lines.map((l) => (
              <div key={l.product.id} style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600 }}>{l.product.name}</span>
                <span>{l.kg} kg</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: "13.5px", color: "var(--text-2)" }}>Välj minst en kaka ovan.</div>
        )}
        <div
          style={{
            borderTop: "1px solid var(--divider)",
            paddingTop: 12,
            fontSize: "14.5px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
            <span>Totalt per leverans</span>
            <span>{totalKg} kg</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-2)" }}>
            <span>Intervall</span>
            <span>{INTERVALS.find((i) => i.value === frequency)?.label}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-2)" }}>
            <span>Första leverans</span>
            <span style={{ textTransform: "capitalize" }}>
              {firstDate ? formatDeliveryDate(fromISODate(firstDate)) : "—"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-2)" }}>
            <span>Pris per leverans</span>
            <span>{formatOre(totals.totalOre)}</span>
          </div>
        </div>
        {globalError && (
          <div role="alert" className="error-text">
            {globalError}
          </div>
        )}
        <button
          type="button"
          className="btn btn-send"
          style={{ padding: 16, fontSize: "15.5px" }}
          disabled={totalKg === 0 || !firstDate || submitting}
          onClick={submit}
        >
          {submitting ? "Startar…" : "Starta prenumeration"}
        </button>
        <div style={{ fontSize: "12.5px", color: "var(--text-2)", lineHeight: 1.6, textAlign: "center" }}>
          Ingen bindningstid.
          <br />
          <strong style={{ color: "var(--text)" }}>Pausa eller avsluta enkelt.</strong>
        </div>
      </aside>
    </div>
  );
}

function SubField({
  label,
  k,
  form,
  errors,
  set,
  placeholder,
  type = "text",
}: {
  label: string;
  k: string;
  form: Record<string, string>;
  errors: Record<string, string>;
  set: (k: never, v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  const error = errors[k];
  return (
    <label className={`field${error ? " field-error" : ""}`}>
      {label}
      <input
        type={type}
        value={form[k] ?? ""}
        placeholder={placeholder}
        onChange={(e) => set(k as never, e.target.value)}
        aria-invalid={!!error}
      />
      {error && <span className="error-text">{error}</span>}
    </label>
  );
}
