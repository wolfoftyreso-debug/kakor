import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit"],
  poweredByHeader: false,
  // public/ finns inte i serverless-funktionens filsystem på Vercel —
  // produktsidans existsSync-val av OG-bildvariant kräver att filerna
  // spåras in i funktionen.
  outputFileTracingIncludes: {
    "/kakor/[slug]": ["./public/images/*-og.jpg"],
    // Testdeploy (demo-grenen): demodatabasen måste följa med i alla funktioner.
    "/**": ["./prisma/demo.db"],
  },
  async redirects() {
    return [
      // Kanonisk host: www → apex (gäller endast produktionsdomänen).
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.sockerbagaren.se" }],
        destination: "https://sockerbagaren.se/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Vercel sätter HSTS själv — explicit här så att self-hosting också får det.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
