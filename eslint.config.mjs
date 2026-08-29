import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // design/ är det levererade designpaketet (referensmaterial, ingen appkod)
    ignores: [".next/**", "node_modules/**", "prisma/generated/**", "next-env.d.ts", "design/**"],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
];

export default config;
