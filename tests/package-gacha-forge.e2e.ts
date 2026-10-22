import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("Set MARINARA_ENGINE_ROOT to a compatible Engine checkout");
const appVersion = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version;

test("Forge fills every screen, toggles inside the Engine and keeps world drafts", async ({ page }, testInfo) => {
  const mobile = testInfo.project.name.includes("mobile");
  await page.setViewportSize(mobile ? { width: 874, height: 402 } : { width: 2400, height: 1080 });
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await page.addInitScript((version) => {
    localStorage.removeItem("marinara-active-chat-id");
    localStorage.setItem("marinara:whats-new:seen-version", version);
    localStorage.setItem(
      "marinara-engine-ui",
      JSON.stringify({
        state: { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false, appAccentPulseMode: false },
        version: 65,
      }),
    );
  }, appVersion);
  // No model calls or generated game data are needed to exercise the real shipped UI.
  await page.route("**/api/gacha-forge/state", (route) =>
    route.fulfill({ json: { runs: [], guidesSeen: ["welcome"] } }),
  );
  await page.goto("/");
  await page.getByRole("tab", { name: "Open Gacha Forge" }).click();
  const forge = page.locator("marinara-capability-gacha-forge");
  const draft = forge.locator("textarea").first();
  await expect(draft).toBeVisible();
  await draft.fill("An unfinished world with moonlit gardens");
  await draft.evaluate((node) => {
    node.dataset.identity = "original";
  });
  const toggle = () => forge.locator(".gf-fs-bar:visible, .gf-fs-exit:visible, .gf-fs:visible").last();
  await toggle().click();
  await expect(page.locator(".mari-home-browser-chrome")).toBeHidden();
  await expect(page.locator('[data-component="TopBar"]')).toBeVisible();
  await expect(toggle()).toHaveAttribute("aria-label", "Exit fullscreen");
  await expect(draft).toHaveValue("An unfinished world with moonlit gardens");
  await expect(draft).toHaveAttribute("data-identity", "original");
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
  expect(
    await page.locator('[data-component="TopBar"]').evaluate((bar) => {
      const box = bar.getBoundingClientRect();
      return bar.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
    }),
    "Forge overlays cannot cover the Engine topbar",
  ).toBe(true);
  await toggle().click();
  await expect(page.locator(".mari-home-browser-chrome")).toBeVisible();
  await expect(draft).toHaveValue("An unfinished world with moonlit gardens");

  // The layout is shared by all screens, including combat's own toolbar and loading screens.
  // Set deterministic local view state without starting paid generation or changing saved worlds.
  for (const view of [
    "setup",
    "runs",
    "themes",
    "hud",
    "modes",
    "roster",
    "summon",
    "formation",
    "combat",
    "inventory",
    "settings",
    "events",
    "tower",
    "shop",
    "chapters",
    "farm",
    "achievements",
    "forge",
    "beat",
    "banner",
    "art",
  ]) {
    await forge.evaluate((node, view) => {
      const game = node as any;
      game._initState();
      game._boot = "ready";
      game._guidesSeen = new Set([
        "welcome",
        "themes",
        "runs",
        "home",
        "chat",
        "modes",
        "roster",
        "unit",
        "summon",
        "formation",
        "combat",
        "inventory",
        "settings",
        "events",
        "tower",
        "shop",
        "chapters",
        "farm",
        "farm-asc",
        "farm-form",
        "achievements",
        "chapter",
      ]);
      game._welcomeBegun = true;
      game._run = {
        runId: "layout-fixture",
        name: "Layout world",
        scenario: "Layout proof",
        hasStandardBanner: true,
        progress: {},
      };
      game._bannerReady = true;
      game._artReady = true;
      game._planEscaped = true;
      game._showRuns = view === "runs";
      game._showThemes = view === "themes";
      game._creatingNew = view === "setup";
      if (view === "banner") game._bannerReady = false;
      else if (view === "art") {
        game._artReady = false;
        game._artBlocking = true;
        game._artState = "painting";
        game._art = { done: 1, total: 3, name: "Layout unit" };
      } else if (view === "forge") game._planEscaped = false;
      else if (view === "beat") game._beatState = "loading";
      else game._hudView = view === "hud" ? "home" : view === "achievements" ? "missions" : view;
      game._renderBrowser();
    }, view);
    await expect(forge.locator("[data-guide-modal]"), `${view} has no unseen tutorial covering it`).toHaveCount(0);
    const stage = forge.locator(".gf-stage");
    await expect(stage, view).toBeVisible();
    const sizes = await forge.evaluate((node) => {
      const root = node.shadowRoot!;
      const arena = root.querySelector(".gf-arena")!.getBoundingClientRect();
      const stage = root.querySelector(".gf-stage")!.getBoundingClientRect();
      return { widthGap: arena.width - stage.width, heightGap: arena.height - stage.height };
    });
    expect(Math.abs(sizes.widthGap), `${view} width`).toBeLessThanOrEqual(1);
    expect(Math.abs(sizes.heightGap), `${view} height`).toBeLessThanOrEqual(1);
    if (view === "setup") {
      const gap = await forge.locator(".ob-intake").evaluate((intake) => {
        const frame = intake.parentElement!;
        const style = getComputedStyle(frame);
        return (
          frame.clientWidth -
          parseFloat(style.paddingLeft) -
          parseFloat(style.paddingRight) -
          intake.getBoundingClientRect().width
        );
      });
      expect(Math.abs(gap), "world form fills its frame instead of stopping at 900px").toBeLessThanOrEqual(1);
    }
    expect(await forge.evaluate((node) => (node as any)._state()), `${view} actually rendered`).toBe(view);
    const button = toggle();
    await expect(button, `${view} fullscreen control`).toBeVisible();
    await button.click();
    await expect(page.locator(".mari-home-browser-chrome"), view).toBeHidden();
    await expect(toggle()).toHaveAttribute("aria-label", "Exit fullscreen");
    if (["setup", "hud"].includes(view)) {
      await page.screenshot({
        animations: "disabled",
        path: testInfo.outputPath(`${view}-fullscreen-${testInfo.project.name}.png`),
      });
    }
    await toggle().click();
    await expect(page.locator(".mari-home-browser-chrome"), `${view} exits`).toBeVisible();
    if (["setup", "hud", "settings", "combat", "roster"].includes(view)) {
      await testInfo.attach(`${view}-${testInfo.project.name}.png`, {
        body: await page.screenshot({
          animations: "disabled",
          path: testInfo.outputPath(`${view}-${testInfo.project.name}.png`),
        }),
        contentType: "image/png",
      });
    }
  }
  if (mobile) {
    await toggle().click();
    await page.setViewportSize({ width: 390, height: 844 });
    const rotationExit = forge.locator(".gf-rot .gf-fs-portrait");
    await expect(rotationExit).toBeVisible();
    await rotationExit.click();
    await expect(page.locator(".mari-home-browser-chrome")).toBeVisible();
  }
});
