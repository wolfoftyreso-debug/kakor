import { describe, expect, it } from "vitest";
import { computeSeoStatus, seoSummary } from "@/lib/seo/status";
import { SEO_ALIASES } from "@/lib/seo/aliases";
import { CRAWLER_POLICY, PRIVATE_PATHS } from "@/lib/seo/crawlers";
import { classifySource, landingCluster } from "@/lib/seo/acquisition";

describe("SEO-status", () => {
  it("säger UNKNOWN när GSC-data saknas – aldrig GREEN på gissning", () => {
    const checks = computeSeoStatus({
      siteUrl: "http://localhost:8080",
      googleVerification: "",
      bingVerification: "",
      ga4: "",
      sameAs: "",
    });
    const byId = Object.fromEntries(checks.map((c) => [c.id, c]));
    expect(byId["gsc-property"].level).toBe("UNKNOWN");
    expect(byId["broken-links"].level).toBe("UNKNOWN");
    expect(byId["gbp"].level).toBe("UNKNOWN");
    expect(byId["analytics"].level).toBe("UNKNOWN");
    expect(byId["gsc-tag"].level).toBe("WARNING");
    expect(byId["bing"].level).toBe("WARNING");
    expect(byId["domain"].level).toBe("WARNING");
    expect(byId["robots"].level).toBe("GREEN");
    expect(byId["sitemap"].level).toBe("GREEN");
    expect(byId["schema"].level).toBe("GREEN");
    expect(seoSummary(checks).critical).toBe(0);
    expect(seoSummary(checks).unknown).toBeGreaterThan(0);
  });

  it("blir GREEN på verifieringskod och produktionsdomän när de faktiskt finns", () => {
    const checks = computeSeoStatus({
      siteUrl: "https://sockerbagaren.se",
      vercelEnv: "production",
      googleVerification: "abc123",
      bingVerification: "bing-token",
      ga4: "G-ABCDEFGHIJ",
      sameAs: "https://maps.google.com/?cid=1",
    });
    const byId = Object.fromEntries(checks.map((c) => [c.id, c]));
    expect(byId.domain.level).toBe("GREEN");
    expect(byId["gsc-tag"].level).toBe("GREEN");
    expect(byId.bing.level).toBe("GREEN");
    expect(byId.analytics.level).toBe("GREEN");
    expect(byId.gbp.level).toBe("GREEN");
    expect(byId["gsc-property"].level).toBe("UNKNOWN");
  });

  it("markerar preview som noindex utan att kalla det kritiskt", () => {
    const checks = computeSeoStatus({
      siteUrl: "https://sockerbagaren-git-demo.vercel.app",
      vercelEnv: "preview",
    });
    expect(checks.find((c) => c.id === "indexability")?.level).toBe("WARNING");
  });
});

describe("SEO-alias", () => {
  it("pekar bara på befintliga kanoniska sidor, inga dubbletter", () => {
    const destinations = SEO_ALIASES.map((a) => a.destination);
    expect(destinations).toContain("/fika-till-jobbet");
    expect(destinations).toContain("/kakor");
    expect(destinations).toContain("/vanliga-fragor");
    expect(destinations).toContain("/prenumeration");
    expect(destinations).toContain("/kakor/kolasnittar");
    expect(destinations).toContain("/tyreso");
    expect(SEO_ALIASES.some((a) => a.source === "/kolakex")).toBe(true);
    expect(SEO_ALIASES.some((a) => a.source === "/sirapssnittar")).toBe(true);
    expect(SEO_ALIASES.some((a) => a.source === "/fika-till-kontoret")).toBe(true);
    expect(SEO_ALIASES.some((a) => a.source === "/kakor-till-kontoret")).toBe(true);
    expect(SEO_ALIASES.some((a) => a.source === a.destination)).toBe(false);
  });
});

describe("crawlerpolicy", () => {
  it("spärrar privata vägar och blandar inte ihop sök med träning", () => {
    expect(PRIVATE_PATHS).toEqual(expect.arrayContaining(["/admin", "/api", "/faktura", "/prenumeration/hantera", "/demo-underlag"]));
    const training = CRAWLER_POLICY.filter((r) => r.group === "ai-training");
    expect(training.length).toBeGreaterThan(0);
    expect(training.every((r) => r.policy === "allow")).toBe(true);
    expect(CRAWLER_POLICY.filter((r) => r.group === "search").every((r) => r.policy === "allow")).toBe(true);
  });
});

describe("förvärvsklassning", () => {
  it("mappar landning till kluster utan att spara URL", () => {
    expect(landingCluster("/")).toBe("branded");
    expect(landingCluster("/tyreso")).toBe("local");
    expect(landingCluster("/kakor/kolasnittar")).toBe("product");
    expect(landingCluster("/prenumeration")).toBe("subscription");
    expect(landingCluster("/fika-till-jobbet")).toBe("info");
    expect(landingCluster("/vanliga-fragor")).toBe("info");
    expect(landingCluster("/bestall")).toBe("transactional");
  });

  it("klassar källa från utm och referrer", () => {
    expect(
      classifySource({
        referrer: "https://www.google.se/search?q=fika",
        href: "https://sockerbagaren.se/kakor",
        selfHost: "sockerbagaren.se",
      })
    ).toBe("google");
    expect(
      classifySource({
        referrer: "",
        href: "https://sockerbagaren.se/?utm_source=bing",
        selfHost: "sockerbagaren.se",
      })
    ).toBe("bing");
    expect(
      classifySource({
        referrer: "",
        href: "https://sockerbagaren.se/",
        selfHost: "sockerbagaren.se",
      })
    ).toBe("none");
  });
});
