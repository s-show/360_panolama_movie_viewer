import { defineConfig, devices } from "@playwright/test";

// 配布される単一 HTML 成果物（dist/index.html）に対してテストする。
const PORT = 4173;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  // WebGL をソフトウェアレンダリング（SwiftShader）するため並列度は 1 に固定。
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: undefined }
    }
  ],

  webServer: {
    command: `pnpm build && pnpm preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
