import { defineConfig, devices } from "@playwright/test";

function parsePort(name: string, fallback: number) {
  const value = process.env[name];
  return value && /^\d+$/.test(value) ? Number(value) : fallback;
}

const clientPort = parsePort("PLAYWRIGHT_CLIENT_PORT", 5188);
const mobileClientPort = parsePort("PLAYWRIGHT_MOBILE_CLIENT_PORT", 5189);
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${clientPort}`;
const mobileBaseURL =
  process.env.PLAYWRIGHT_MOBILE_BASE_URL ??
  `http://127.0.0.1:${mobileClientPort}`;
const packageId = process.env.MARINARA_PACKAGE_ID ?? "noodle";

export default defineConfig({
  testDir: ".",
  testMatch: "**/package-*.e2e.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer:
    process.env.PLAYWRIGHT_SKIP_WEBSERVER === "true"
      ? undefined
      : {
          command: "node ../scripts/start-package-browser-servers.mjs",
          env: { MARINARA_PACKAGE_ID: packageId },
          url: baseURL,
          reuseExistingServer: false,
          timeout: 180_000,
        },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        baseURL,
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
        baseURL: mobileBaseURL,
        viewport: { width: 390, height: 844 },
      },
    },
  ],
});
