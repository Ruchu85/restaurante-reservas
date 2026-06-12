import { defineConfig, devices } from "@playwright/test";

// Config dedicada SOLO a generar capturas de marketing.
// No interfiere con los e2e normales (testDir aislado en demo/).
export default defineConfig({
  testDir: ".",
  testMatch: "capture.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 60_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    viewport: { width: 1366, height: 900 },
    deviceScaleFactor: 2, // capturas nítidas (retina)
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 900 }, deviceScaleFactor: 2 } },
  ],
});
