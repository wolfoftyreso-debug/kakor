import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { breadcrumbNode, faqNode, graph, webPageNode } from "@/lib/seo/schema";

// Standardpaket för informationssidor: WebPage + BreadcrumbList i grafen
// och en synlig brödsmulerad som speglar schemat exakt.
export function InfoPageSeo({
  path,
  name,
  title,
  description,
  dateModified,
  faqs,
  pageType,
}: {
  path: string;
  /** Namn i brödsmuleraden, t.ex. "Om Sockerbagaren". */
  name: string;
  title: string;
  description?: string;
  /** ISO-datum – sätts ENDAST vid verklig innehållsändring, aldrig per deploy. */
  dateModified?: string;
  /** Synliga FAQ:er på sidan – samma text som FAQPage-schemat. */
  faqs?: { q: string; a: string }[];
  pageType?: "WebPage" | "AboutPage";
}) {
  const crumbs = [
    { name: "Sockerbagaren", path: "/" },
    { name, path },
  ];
  return (
    <>
      <JsonLd
        data={graph(
          webPageNode({ path, title, description, breadcrumbs: crumbs, dateModified, pageType }),
          breadcrumbNode(path, crumbs),
          faqs?.length ? faqNode(path, faqs) : null
        )}
      />
      <Breadcrumbs crumbs={crumbs} container="container-narrow" />
    </>
  );
}
