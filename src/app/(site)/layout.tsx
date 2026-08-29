import { CartProvider } from "@/lib/cart";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { JsonLd } from "@/components/JsonLd";
import { graph, organizationNode, websiteNode } from "@/lib/seo/schema";
import { AnalyticsScript } from "@/components/AnalyticsScript";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      {/* Kanoniska entiteter (Organization + WebSite) — EN gång, på alla
          publika sidor. Sidorna refererar dem via @id, aldrig egna kopior. */}
      <JsonLd data={graph(organizationNode(), websiteNode())} />
      <AnalyticsScript />
      <SiteHeader />
      <main id="innehall">{children}</main>
      <SiteFooter />
    </CartProvider>
  );
}
