import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    // The first test to touch the dataset pays the one-time cost of
    // loading ~98k entries and building the search index.
    testTimeout: 30000,
  },
});
