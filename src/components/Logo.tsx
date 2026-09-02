// Logotyp enligt designsystemet. Primärsymbolen är sigillet (LogoSigill);
// ring-S:en (LogoMark/LogoSolid) finns kvar för ytor där sigillet inte
// fungerar tekniskt (favicon/app-ikon enligt designsystemets anvisning).

import { useId } from "react";

export function LogoSigill({ size = 44 }: { size?: number }) {
  // Unika id:n för bågbanorna — sigillet kan förekomma flera gånger per sida.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const top = `arcTop${uid}`;
  const bot = `arcBot${uid}`;
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" aria-hidden="true">
      <circle cx="90" cy="90" r="85" fill="#FFFDF7" stroke="#3B281B" strokeWidth="3" />
      <circle cx="90" cy="90" r="78" fill="none" stroke="#3B281B" strokeWidth="1" />
      <circle cx="90" cy="90" r="50" fill="none" stroke="#3B281B" strokeWidth="1.5" />
      <path id={top} d="M 31 90 A 59 59 0 0 1 149 90" fill="none" />
      <path id={bot} d="M 23 90 A 67 67 0 0 0 157 90" fill="none" />
      <text
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "3.5px",
          fill: "#3B281B",
        }}
      >
        <textPath href={`#${top}`} startOffset="50%" textAnchor="middle">
          SOCKERBAGAREN
        </textPath>
      </text>
      <text
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: "3px",
          fill: "#3B281B",
        }}
      >
        <textPath href={`#${bot}`} startOffset="50%" textAnchor="middle">
          SÖDRA STOCKHOLM
        </textPath>
      </text>
      <text
        x="90"
        y="99"
        textAnchor="middle"
        style={{ fontFamily: "var(--font-serif)", fontSize: 46, fontWeight: 700, fill: "#3B281B" }}
      >
        S
      </text>
      <text
        x="90"
        y="113"
        textAnchor="middle"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 8.5,
          fontWeight: 700,
          letterSpacing: "2px",
          fill: "#A03D2C",
        }}
      >
        RECEPT 1957
      </text>
      <rect x="23" y="86.5" width="7" height="7" transform="rotate(45 26.5 90)" fill="#A03D2C" />
      <rect x="150" y="86.5" width="7" height="7" transform="rotate(45 153.5 90)" fill="#A03D2C" />
    </svg>
  );
}

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
