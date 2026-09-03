// Flat config (ESLint 9) med eslint-config-next 16:s inbyggda flat-exporter.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  {
    // design/ är det levererade designpaketet (referensmaterial, ingen appkod)
    ignores: [".next/**", "node_modules/**", "prisma/generated/**", "next-env.d.ts", "design/**"],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      // React Compiler-lintern (react-hooks 7) flaggar setState i effekter.
      // Våra fall är medvetna hydreringssäkra återställningar från
      // localStorage/sessionStorage (korg, kassaflöde, samtycke) — de kan inte
      // göras som lazy initializers utan att server- och klient-HTML skiljer sig.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  {
    // E2E-skriptet talar med Playwrights löst typade sid-API — any är avsiktligt.
    files: ["scripts/e2e/**"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
];

export default config;
