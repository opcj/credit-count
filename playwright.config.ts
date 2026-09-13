import { defineConfig, devices } from "@playwright/test";
import { loadEnvFile } from "node:process";
loadEnvFile(".env.local");
const production = process.env.E2E_PRODUCTION === "true";
const baseURL = `http://127.0.0.1:${production ? 3001 : 3000}`;
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
      testMatch: /(?:app|reliability)\.spec\.ts/,
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
  webServer: {
    command: production ? "npm run start -- --port 3001" : "npm run dev",
    url: baseURL,
    reuseExistingServer: !production,
    timeout: 120_000,
  },
});
