import type { ReactNode } from "react";

// Design 2.0: gemensamt sidhuvud för innehållssidor (guide, säsong, om,
// leverans, villkor, integritet, ingredienser). Samma rytm överallt:
// eyebrow → rubrik → ingress, med en valfri faktakolumn ("Snabbfakta") som
// bara innehåller verifierbar data (leveransdagar ur admin, priser ur databasen).
export interface Fact {
  label: string;
  value: ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  lede,
  facts,
  children,
}: {
  eyebrow?: string;
  title: string;
  lede?: ReactNode;
  facts?: Fact[];
  children?: ReactNode;
}) {
  return (
    <header className={`page-header${facts && facts.length > 0 ? " page-header--facts" : ""}`}>
      <div className="page-header-copy">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="h-display page-title">{title}</h1>
        {lede && <p className="lede">{lede}</p>}
        {children}
      </div>
      {facts && facts.length > 0 && (
        <dl className="facts" aria-label="Snabbfakta">
          {facts.map((f) => (
            <div key={f.label} className="facts-row">
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </header>
  );
}
