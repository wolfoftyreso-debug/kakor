// Design 2.0: en FAQ-komponent för alla sidor (native details/summary —
// fungerar utan JS, rubriknivå bevaras för skärmläsare). Samma markup som
// matas till FAQPage-schemat så att synligt innehåll och schema aldrig glider isär.
export function FaqList({
  items,
  heading,
  headingLevel = "h2",
}: {
  items: { q: string; a: string }[];
  heading?: string;
  headingLevel?: "h2" | "h3";
}) {
  const H = headingLevel;
  return (
    <section className="faq-list">
      {heading && <H className="h-sub faq-heading">{heading}</H>}
      <div>
        {items.map((f) => (
          <details key={f.q} className="faq-item">
            <summary>
              <span>{f.q}</span>
            </summary>
            <div className="faq-answer">{f.a}</div>
          </details>
        ))}
      </div>
    </section>
  );
}
