import { formatWeightKg } from "@/lib/units";
import type { AreaBooked } from "@/lib/warehouse/queries";

export function areaBookingLine(areas: AreaBooked[]): string {
  return areas
    .map((a) =>
      a.maxKg > 0 ? `${a.name} ${formatWeightKg(a.grams)} av ${a.maxKg} kg` : `${a.name} ${formatWeightKg(a.grams)} bokade`
    )
    .join(" · ");
}

export function AreaBookingBars({ areas }: { areas: AreaBooked[] }) {
  if (areas.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {areas.map((a) => {
        const pct = a.maxKg > 0 ? Math.min(100, (a.grams / 1000 / a.maxKg) * 100) : 0;
        const full = a.maxKg > 0 && a.grams / 1000 >= a.maxKg - 1e-6;
        return (
          <div key={a.id}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, gap: 8, flexWrap: "wrap" }}>
              <span>
                <strong>{a.name}</strong>
                <span style={{ color: "var(--text-2)" }}> · {a.orderCount} stopp</span>
              </span>
              <span style={{ fontWeight: 700, color: full ? "var(--red)" : undefined }}>
                {formatWeightKg(a.grams)}
                {a.maxKg > 0 ? ` av ${a.maxKg} kg` : ""}
                {full ? " – FULLT" : ""}
              </span>
            </div>
            {a.maxKg > 0 && (
              <div
                style={{
                  height: 7,
                  background: "var(--input-border)",
                  borderRadius: 99,
                  overflow: "hidden",
                  marginTop: 5,
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: full ? "var(--red)" : "var(--text)",
                    borderRadius: 99,
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
