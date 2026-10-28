import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, expect, type FullConfig } from "@playwright/test";

// The Engine client runs as a Vite dev server, which compiles each module on first use. A test that
// opens a view for the first time can stall on a cold module graph. Open Home and one package view on
// each viewport before any test runs, so the suites start on a warm server.
export default async function globalSetup(config: FullConfig) {
  // Only Noodle and Slurp open through a Home tab into this view; other packages (Calls) start cold.
  if (!["noodle", "slurp2"].includes(process.env.MARINARA_PACKAGE_ID ?? "")) return;
  const engineRoot = process.env.MARINARA_ENGINE_ROOT;
  if (!engineRoot) throw new Error("MARINARA_ENGINE_ROOT is required");
  const appVersion = (JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")) as { version: string })
    .version;
  const browser = await chromium.launch();
  try {
    for (const project of config.projects) {
      const context = await browser.newContext({
        baseURL: project.use.baseURL,
        viewport: project.use.viewport,
      });
      await context.addInitScript((version) => {
        localStorage.setItem("marinara:whats-new:seen-version", version);
        if (localStorage.getItem("marinara-engine-ui")) return;
        localStorage.setItem(
          "marinara-engine-ui",
          JSON.stringify({
            state: { hasCompletedOnboarding: true, rightPanelOpen: false, sidebarOpen: false },
            version: 65,
          }),
        );
      }, appVersion);
      const page = await context.newPage();
      await page.goto("/");
      await page
        .getByRole("tab", { name: /^Open /u })
        .first()
        .click({ timeout: 120_000 });
      await expect(page.locator('[data-component="NoodleView"]')).toBeVisible({ timeout: 120_000 });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
