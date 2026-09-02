// Små linjeikoner (currentColor) för trust strip och listor. Inga ikonbibliotek —
// tre streckikoner i varumärkets stil räcker och väger ingenting.

const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** Faktura/dokument. */
export function IconInvoice() {
  return (
    <svg {...base}>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4" />
      <path d="M9 12h7M9 16h7" />
    </svg>
  );
}

/** Leveransbil. */
export function IconTruck() {
  return (
    <svg {...base}>
      <path d="M3 7h11v9H3z" />
      <path d="M14 10h4l3 3v3h-7z" />
      <circle cx="7" cy="18" r="1.8" />
      <circle cx="17" cy="18" r="1.8" />
    </svg>
  );
}

/** Smör/råvara — ett blad. */
export function IconLeaf() {
  return (
    <svg {...base}>
      <path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z" />
      <path d="M5 19c3-4 6-7 10-10" />
    </svg>
  );
}

/** Bock i cirkel. */
export function IconCheck() {
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </svg>
  );
}
