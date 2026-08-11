import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.{ts,tsx}"],
    exclude: ["tests/e2e/**"],
    // Integration tests hit a real MySQL connection; the first test in each
    // freshly-forked worker pays a one-time connection-pool warmup cost that
    // can exceed Vitest's 5000ms default, especially on Windows (observed:
    // consistent ~5030ms timeouts on exactly the first test per file, with
    // every subsequent test in the same warm worker passing quickly). Raised
    // globally rather than per-file — unit tests finish in milliseconds
    // regardless of the ceiling, so this costs nothing there.
    testTimeout: 15000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
