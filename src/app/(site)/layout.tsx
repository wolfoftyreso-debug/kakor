import { CartProvider } from "@/lib/cart";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { JsonLd } from "@/components/JsonLd";
import { graph, merchantReturnPolicyNode, organizationNode, websiteNode } from "@/lib/seo/schema";
import { AnalyticsScript } from "@/components/AnalyticsScript";

// Footern hämtar leveransdagar (cachade 300 s via unstable_cache, tagg
// delivery-days). Layouten förblir force-dynamic: demo-bygget har SQLite
// bara under seed, inte under next build:s statiska generering.
export const dynamic = "force-dynamic";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      {/* Kanoniska entiteter (Organization + WebSite + returpolicy) – EN gång,
          på alla publika sidor. Sidorna refererar dem via @id, aldrig egna kopior. */}
      <JsonLd data={graph(organizationNode(), websiteNode(), merchantReturnPolicyNode())} />
      <AnalyticsScript />
      <SiteHeader />
      <main id="innehall">{children}</main>
      <SiteFooter />
    </CartProvider>
  );
}
