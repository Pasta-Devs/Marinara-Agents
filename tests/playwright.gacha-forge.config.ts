import { defineConfig, devices } from "@playwright/test";
import config from "./playwright.package.config.js";

export default defineConfig({
  ...config,
  testMatch: "package-gacha-forge.e2e.ts",
  projects: [
    ...config.projects!,
    {
      name: "mobile-webkit",
      use: {
        ...devices["iPhone 13"],
        baseURL:
          process.env.PLAYWRIGHT_MOBILE_BASE_URL ??
          `http://127.0.0.1:${process.env.PLAYWRIGHT_MOBILE_CLIENT_PORT ?? 5189}`,
      },
    },
  ],
});
