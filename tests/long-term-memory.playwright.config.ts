import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const testDir = resolve(import.meta.dirname);
const engineRoot = resolve(
  process.env.MARINARA_ENGINE_ROOT ?? join(testDir, "../../Marinara-Engine"),
);
const playwright = await import(
  pathToFileURL(join(engineRoot, "node_modules/@playwright/test/index.js")).href
);
const { defineConfig } = playwright.default;

export default defineConfig({
  testDir,
  testMatch: "long-term-memory.e2e.ts",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5178",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile-chromium",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
