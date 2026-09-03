import { addDays, toISODate, todayInStockholm } from "@/lib/dates";

// Bokföringsexport (CSV) — serverkomponent, ren GET-länk till exportrouten.
export function ExportForm() {
  const today = todayInStockholm();
  const thisMonthFrom = toISODate(new Date(today.getFullYear(), today.getMonth(), 1));
  const prevMonthFrom = toISODate(new Date(today.getFullYear(), today.getMonth() - 1, 1));
  const prevMonthTo = toISODate(addDays(new Date(today.getFullYear(), today.getMonth(), 1), -1));
  return (
    <div className="card" style={{ padding: "14px 18px", marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", fontSize: 13.5 }}>
      <strong>Bokföringsexport (CSV)</strong>
      <a className="btn btn-outline" style={{ padding: "7px 12px", fontSize: 13 }} href={`/admin/fakturor/export?from=${thisMonthFrom}&to=${toISODate(today)}`}>
        Denna månad
      </a>
      <a className="btn btn-outline" style={{ padding: "7px 12px", fontSize: 13 }} href={`/admin/fakturor/export?from=${prevMonthFrom}&to=${prevMonthTo}`}>
        Föregående månad
      </a>
      <form action="/admin/fakturor/export" method="get" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
        <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          Från
          <input type="date" name="from" defaultValue={thisMonthFrom} required style={{ border: "1.5px solid var(--input-border)", borderRadius: 6, padding: "6px 8px", fontSize: 13, background: "var(--surface)" }} />
        </label>
        <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          Till
          <input type="date" name="to" defaultValue={toISODate(today)} required style={{ border: "1.5px solid var(--input-border)", borderRadius: 6, padding: "6px 8px", fontSize: 13, background: "var(--surface)" }} />
        </label>
        <button type="submit" className="btn btn-primary" style={{ padding: "7px 12px", fontSize: 13 }}>
          Exportera
        </button>
      </form>
      <span style={{ color: "var(--text-2)" }}>Fakturor och kreditfakturor per momssats, semikolonavgränsat för Excel.</span>
    </div>
  );
}
