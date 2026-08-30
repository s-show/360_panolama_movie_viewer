import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // DOM も WebGL も不要な純粋ロジックだけを対象にする。
    // 描画を伴うものは tests/e2e/ の Playwright で担保する。
    environment: "node",
    include: ["tests/unit/**/*.test.js"]
  }
});
