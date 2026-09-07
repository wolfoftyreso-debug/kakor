import Link from "next/link";
import type { Crumb } from "@/lib/seo/schema";

// Synlig brödsmulerad. Ska alltid spegla BreadcrumbList-scheman exakt –
// sidor skickar samma Crumb-lista till båda.
export function Breadcrumbs({
  crumbs,
  container = "container-medium",
}: {
  crumbs: Crumb[];
  container?: string;
}) {
  return (
    <nav
      aria-label="Brödsmulor"
      className={container}
      // Horisontell padding ärvs från containerklassen – så att brödsmulan
      // alltid linjerar med sidans innehåll (48/24/20 px beroende på bredd).
      style={{ paddingTop: 16, paddingBottom: 0, fontSize: 13, color: "var(--text-2)" }}
    >
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: "0 6px" }}>
        {crumbs.map((c, i) =>
          i < crumbs.length - 1 ? (
            <li key={c.path}>
              <Link href={c.path}>{c.name}</Link>
              <span aria-hidden="true"> /</span>
            </li>
          ) : (
            <li key={c.path}>
              <strong aria-current="page" style={{ color: "var(--text)" }}>
                {c.name}
              </strong>
            </li>
          )
        )}
      </ol>
    </nav>
  );
}
