"use client";

import { useState, useTransition } from "react";
import {
  addOrderNote,
  cancelOrder,
  confirmOrder,
  markOrderDelivered,
  markOrderPaid,
  resendInvoiceEmail,
  resendOrderEmails,
  issueCreditNoteForOrder,
  type ActionResult,
} from "@/app/admin/actions";

const inputStyle = {
  width: "100%",
  border: "1.5px solid var(--input-border)",
  borderRadius: 6,
  padding: "9px 12px",
  fontSize: 13.5,
  marginBottom: 10,
  background: "var(--surface)",
} as const;

export function OrderActions({
  orderId,
  status,
  paymentStatus,
  deliveryStatus,
  needsCreditNote = false,
}: {
  orderId: string;
  status: string;
  paymentStatus: string;
  deliveryStatus: string;
  /** Avbruten order med faktura men utan kreditfaktura (t.ex. efter ett avbrutet anrop). */
  needsCreditNote?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [payNote, setPayNote] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [note, setNote] = useState("");
  // Varje åtgärd ger synlig feedback — en knapp som "gör ingenting" är ett fel.
  const [feedback, setFeedback] = useState<ActionResult | null>(null);

  const run = (fn: () => Promise<ActionResult>) =>
    startTransition(async () => {
      setFeedback(null);
      try {
        setFeedback(await fn());
      } catch {
        setFeedback({ ok: false, error: "Åtgärden misslyckades — ladda om sidan och försök igen" });
      }
    });

  return (
    <section aria-label="Orderåtgärder">
      {feedback && (
        <div
          role={feedback.ok ? "status" : "alert"}
          className={feedback.ok ? "info-box" : "error-text"}
          style={{ marginBottom: 16, padding: "10px 14px", fontSize: 14 }}
        >
          {feedback.ok ? feedback.message : feedback.error}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        {paymentStatus === "UNPAID" && status !== "CANCELLED" && (
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Betalning</div>
            <input
              value={payNote}
              onChange={(e) => setPayNote(e.target.value)}
              placeholder="Intern notering (frivilligt)"
              aria-label="Intern notering till betalningen"
              maxLength={500}
              style={inputStyle}
            />
            <button
              className="btn btn-primary btn-block"
              disabled={pending}
              onClick={() => {
                // Irreversibelt: det finns ingen "ångra betald".
                if (!window.confirm("Markera fakturan som betald? Detta går inte att ångra.")) return;
                run(() => markOrderPaid(orderId, payNote));
              }}
            >
              Markera som betald
            </button>
          </div>
        )}

        {deliveryStatus === "PENDING" && status !== "CANCELLED" && (
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Leverans</div>
            <input
              value={deliveryNote}
              onChange={(e) => setDeliveryNote(e.target.value)}
              placeholder="Leveransnotering (frivilligt)"
              aria-label="Leveransnotering"
              maxLength={500}
              style={inputStyle}
            />
            <button
              className="btn btn-primary btn-block"
              disabled={pending}
              onClick={() => run(() => markOrderDelivered(orderId, deliveryNote))}
            >
              Markera som levererad
            </button>
          </div>
        )}

        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>E-post</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button className="btn btn-outline" disabled={pending} onClick={() => run(() => resendInvoiceEmail(orderId))}>
              Skicka faktura igen
            </button>
            <button className="btn btn-outline" disabled={pending} onClick={() => run(() => resendOrderEmails(orderId))}>
              Skicka bekräftelse + faktura igen
            </button>
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Notering</div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Intern notering"
            aria-label="Intern notering"
            maxLength={1000}
            style={inputStyle}
          />
          <button
            className="btn btn-outline btn-block"
            disabled={pending || !note.trim()}
            onClick={() =>
              run(async () => {
                const r = await addOrderNote(orderId, note);
                if (r.ok) setNote("");
                return r;
              })
            }
          >
            Spara notering
          </button>
        </div>

        {needsCreditNote && (
          <div className="card" style={{ padding: 18, borderColor: "var(--red)" }}>
            <div style={{ fontWeight: 700, marginBottom: 10, color: "var(--red)" }}>Kreditfaktura saknas</div>
            <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 10px" }}>
              Ordern är avbruten men fakturan är inte krediterad. Utfärda kreditfakturan så att serien stämmer.
            </p>
            <button className="btn btn-primary btn-block" disabled={pending} onClick={() => run(() => issueCreditNoteForOrder(orderId))}>
              Utfärda kreditfaktura
            </button>
          </div>
        )}

        {status === "NEW" && (
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Orderstatus</div>
            <button className="btn btn-primary btn-block" disabled={pending} onClick={() => run(() => confirmOrder(orderId))}>
              Bekräfta order
            </button>
          </div>
        )}

        {status !== "CANCELLED" && paymentStatus !== "PAID" && deliveryStatus !== "DELIVERED" && (
          <div className="card" style={{ padding: 18, borderColor: "var(--red)" }}>
            <div style={{ fontWeight: 700, marginBottom: 10, color: "var(--red)" }}>Avbryt order</div>
            <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 10px" }}>
              Fakturan krediteras automatiskt och kreditfakturan mejlas till kunden.
            </p>
            <button
              className="btn btn-send btn-block"
              disabled={pending}
              onClick={() => {
                const reason = window.prompt(
                  "Är du säker på att du vill avbryta ordern? Ange gärna en anledning (sparas i historiken):"
                );
                if (reason === null) return;
                run(() => cancelOrder(orderId, reason));
              }}
            >
              Avbryt order
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
