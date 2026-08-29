import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { breadcrumbNode, graph, webPageNode } from "@/lib/seo/schema";

// Standardpaket för informationssidor: WebPage + BreadcrumbList i grafen
// och en synlig brödsmulerad som speglar schemat exakt.
export function InfoPageSeo({
  path,
  name,
  title,
  description,
  dateModified,
}: {
  path: string;
  /** Namn i brödsmuleraden, t.ex. "Om Sockerbagaren". */
  name: string;
  title: string;
  description?: string;
  /** ISO-datum — sätts ENDAST vid verklig innehållsändring, aldrig per deploy. */
  dateModified?: string;
}) {
  const crumbs = [
    { name: "Sockerbagaren", path: "/" },
    { name, path },
  ];
  return (
    <>
      <JsonLd
        data={graph(
          webPageNode({ path, title, description, breadcrumbs: crumbs, dateModified }),
          breadcrumbNode(path, crumbs)
        )}
      />
      <Breadcrumbs crumbs={crumbs} container="container-narrow" />
    </>
  );
}
