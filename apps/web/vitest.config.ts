import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    restoreMocks: true,
    unstubGlobals: true,
    css: false,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      // main.tsx はマウントするだけ。components/ui と lib/utils.ts は shadcn/ui の生成物。
      // game/phaser は Phaser で描くだけのコード（jsdom では動かない）。理由と範囲は coding-standards 0章
      exclude: [
        "src/main.tsx",
        "src/test-utils/**",
        "src/components/ui/**",
        "src/lib/utils.ts",
        "src/game/phaser/**",
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
