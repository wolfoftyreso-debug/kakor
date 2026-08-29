// Renderar en JSON-LD-graf. All schema-generering sker i src/lib/seo/schema.ts
// (schema-motorn) — komponenter bygger aldrig egna lösa JSON-objekt.

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify av serverdata; "<" escapas för säker inbäddning.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
