import { CartProvider } from "@/lib/cart";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { JsonLd } from "@/components/JsonLd";
import { graph, merchantReturnPolicyNode, organizationNode, serviceNode, websiteNode } from "@/lib/seo/schema";
import { AnalyticsScript } from "@/components/AnalyticsScript";
import { AcquisitionCapture } from "@/components/AcquisitionCapture";

// Footern hämtar leveransdagar (cachade 300 s via unstable_cache, tagg
// delivery-days). Layouten förblir force-dynamic: demo-bygget har SQLite
// bara under seed, inte under next build:s statiska generering.
export const dynamic = "force-dynamic";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={graph(organizationNode(), websiteNode(), merchantReturnPolicyNode(), serviceNode())} />
      <AcquisitionCapture />
      <AnalyticsScript />
      <CartProvider>
        <SiteHeader />
        <main id="innehall">{children}</main>
      </CartProvider>
      <SiteFooter />
    </>
  );
}
