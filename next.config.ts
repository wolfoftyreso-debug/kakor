import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit"],
  poweredByHeader: false,
  // Testdeploy: demodatabasen som byggs av `npm run build:demo` måste följa
  // med in i serverless-bundlen (kopieras till /tmp vid start).
  outputFileTracingIncludes: {
    "/**": ["./prisma/demo.db"],
  },
  async headers() {
    return [
      {
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
