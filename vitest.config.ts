import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Live tests hit public APIs, so they only run on request: TIDELINE_LIVE=1 pnpm test:live
    testTimeout: 60_000,
  },
});
