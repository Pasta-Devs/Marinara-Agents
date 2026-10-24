import { defineConfig, devices } from "@playwright/test";
import config from "./playwright.package.config.js";

const webServer =
  config.webServer && !Array.isArray(config.webServer)
    ? { ...config.webServer, env: { ...config.webServer.env, TTS_LOCAL_URLS_ENABLED: "true" } }
    : config.webServer;

export default defineConfig({
  ...config,
  webServer,
  testMatch: [
    "package-gacha-forge.e2e.ts",
    "package-gacha-forge-home.e2e.ts",
    "package-gacha-forge-editors.e2e.ts",
    "package-gacha-forge-units.e2e.ts",
    "package-gacha-forge-choices.e2e.ts",
    "package-gacha-forge-welcome-gift.e2e.ts",
    "package-gacha-forge-audio.e2e.ts",
    "package-gacha-forge-boss-dialogue.e2e.ts",
    "package-gacha-forge-story-memory.e2e.ts",
  ],
  projects: [
    ...config.projects!,
    {
      name: "hybrid-chromium",
      testMatch: "package-gacha-forge-welcome-gift.e2e.ts",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: config.projects![0]!.use!.baseURL,
        // Native Blink inputs: a fine primary pointer plus both fine and coarse available pointers.
        launchOptions: { args: ["--blink-settings=primaryPointerType=4,availablePointerTypes=6"] },
      },
    },
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
