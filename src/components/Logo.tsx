// Logotyp enligt designsystemet: kompakt wordmark med S-ring.

export function LogoMark({ size = 34, inverted = false }: { size?: number; inverted?: boolean }) {
  const stroke = inverted ? "#FAF5EA" : "#3B281B";
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" aria-hidden="true">
      <circle cx="90" cy="90" r="82" fill="none" stroke={stroke} strokeWidth="9" />
      <text
        x="90"
        y="122"
        textAnchor="middle"
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 96,
          fontWeight: 700,
          fill: stroke,
        }}
      >
        S
      </text>
    </svg>
  );
}

export function LogoSolid({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" aria-hidden="true">
      <circle cx="90" cy="90" r="82" fill="#FAF5EA" />
      <text
        x="90"
        y="122"
        textAnchor="middle"
        style={{ fontFamily: "var(--font-serif)", fontSize: 96, fontWeight: 700, fill: "#3B281B" }}
      >
        S
      </text>
    </svg>
  );
}
