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
} from "@/app/admin/actions";

export function OrderActions({
  orderId,
  status,
  paymentStatus,
  deliveryStatus,
}: {
  orderId: string;
  status: string;
  paymentStatus: string;
  deliveryStatus: string;
}) {
  const [pending, startTransition] = useTransition();
  const [payNote, setPayNote] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [note, setNote] = useState("");

  const run = (fn: () => Promise<unknown>) => startTransition(async () => void (await fn()));

  return (
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
      {paymentStatus === "UNPAID" && status !== "CANCELLED" && (
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Betalning</div>
          <input
            value={payNote}
            onChange={(e) => setPayNote(e.target.value)}
            placeholder="Intern notering (frivilligt)"
            style={{ width: "100%", border: "1.5px solid var(--input-border)", borderRadius: 6, padding: "9px 12px", fontSize: 13.5, marginBottom: 10, background: "var(--surface)" }}
          />
          <button
            className="btn btn-primary btn-block"
            disabled={pending}
            onClick={() => run(() => markOrderPaid(orderId, payNote))}
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
            style={{ width: "100%", border: "1.5px solid var(--input-border)", borderRadius: 6, padding: "9px 12px", fontSize: 13.5, marginBottom: 10, background: "var(--surface)" }}
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
          style={{ width: "100%", border: "1.5px solid var(--input-border)", borderRadius: 6, padding: "9px 12px", fontSize: 13.5, marginBottom: 10, background: "var(--surface)" }}
        />
        <button
          className="btn btn-outline btn-block"
          disabled={pending || !note.trim()}
          onClick={() =>
            run(async () => {
              await addOrderNote(orderId, note);
              setNote("");
            })
          }
        >
          Spara notering
        </button>
      </div>

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
    </section>
  );
}
