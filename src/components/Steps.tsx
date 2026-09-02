// Numrerade steg ("Så fungerar det") — samma komponent på startsidan och
// prenumerationssidan så att rytm, typografi och mobilvy alltid är identiska.
export interface StepItem {
  title: string;
  text: string;
}

export function Steps({ items }: { items: StepItem[] }) {
  return (
    <ol className="steps">
      {items.map((s, i) => (
        <li key={s.title} className="step">
          <div className="step-num-row">
            <span className="step-num" aria-hidden="true">
              {i + 1}
            </span>
          </div>
          <div>
            <div className="step-title">{s.title}</div>
            <p className="step-text">{s.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
