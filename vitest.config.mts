import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    // Mirrors the "@/*" -> "./*" mapping from tsconfig.json
    alias: { "@": import.meta.dirname },
  },
});
