import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "tests/warehouse.test.ts",
      "tests/seo-status.test.ts",
      "tests/schema.test.ts",
      "tests/dates.test.ts",
      "tests/status.test.ts",
      "tests/units.test.ts",
      "tests/money.test.ts",
      "tests/aging.test.ts",
      "tests/route-sort.test.ts",
      "tests/allergens.test.ts",
      "tests/auth.test.ts",
      "tests/security.test.ts",
    ],
    fileParallelism: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
