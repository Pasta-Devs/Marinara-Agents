import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("Set MARINARA_ENGINE_ROOT to a compatible Engine checkout");
const appVersion = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version;
const portrait = "https://forge.test/unit-portrait.png";
const unit = {
  id: "presentation-unit",
  kind: "character",
  name: "Arden",
  rarity: 5,
  role: "Warrior",
  affinity: "Fire",
  portrait,
  level: 1,
  stats: { hp: 50, atk: 50, def: 40, spd: 50 },
  skills: [],
  story: "A synthetic unit for browser proof.",
};

test("Units keep portraits loaded and center controls, with an affinity card badge", async ({ page }, testInfo) => {
  await page.setViewportSize(
    testInfo.project.name.includes("mobile") ? { width: 874, height: 402 } : { width: 2400, height: 1080 },
  );
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
  await page.route(portrait, (route) =>
    route.fulfill({
      contentType: "image/png",
      headers: { "cache-control": "public, max-age=31536000, immutable" },
      body: readFileSync(resolve("artwork/agent-covers/gacha-forge.png")),
    }),
  );
  await page.route("**/api/gacha-forge/state*", (route) =>
    route.fulfill({ json: { runs: [], guidesSeen: ["welcome"] } }),
  );
  // Keep the setup draft in the same isolated fixture as the mocked world state.
  let setupSnapshot: unknown = null;
  await page.route("**/api/gacha-forge/setup/draft", (route) => {
    if (route.request().method() === "POST") {
      setupSnapshot = route.request().postDataJSON().snapshot;
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ json: { ok: true, draft: setupSnapshot } });
  });
  await page.route("**/api/gacha-forge/unit", async (route) => {
    // Exceed the former 250ms hold and 700ms entrance-reuse limits.
    await new Promise((resolve) => setTimeout(resolve, 850));
    await route.fulfill({
      json: { ok: true, unit, level: 1, bond: 0, favorite: false, gear: { slots: [], totals: {} } },
    });
  });
  await page.route("**/api/gacha-forge/unit/favorite", (route) => route.fulfill({ json: { ok: true } }));
  await page.goto("/");
  await page.getByRole("tab", { name: "Open Gacha Forge" }).click();
  const forge = page.locator("marinara-capability-gacha-forge");
  await expect(forge.locator("textarea").first()).toBeVisible();
  await forge.evaluate((node, unit) => {
    const game = node as any;
    game._boot = "ready";
    game._guidesSeen = new Set(["welcome", "home", "roster", "unit", "unit:stats", "unit:story"]);
    game._welcomeBegun = true;
    game._run = { runId: "unit-proof", name: "Unit proof", scenario: "Synthetic UI proof", progress: {} };
    game._bannerReady = true;
    game._artReady = true;
    game._hudView = "roster";
    game._rosterUnitId = null;
    game._roster = Array.from({ length: 60 }, (_, index) => ({
      ...unit,
      id: index ? `unit-${index}` : unit.id,
      name: index ? `Unit ${String(index).padStart(2, "0")}` : unit.name,
      affinity: ["Fire", "Water", "Wind", "Earth", "Light", "Dark"][index % 6],
    }));
    game._rosterState = "ready";
    game._rosterRev += 1;
    game._renderBrowser();
  }, unit);
  const card = forge.locator(`[data-unit="${unit.id}"]`);
  await expect(card).toBeVisible();
  await card.locator("img").evaluate((image) => (image as HTMLImageElement).decode());
  await forge.evaluate((node) => {
    const sample = { held: false, flight: false, finished: false };
    (window as any).unitOpeningSample = sample;
    const frame = () => {
      const root = node.shadowRoot!;
      sample.held ||= !!root.querySelector(".gf-hold");
      const image = root.querySelector<HTMLImageElement>(".gf-stage > .gf-view .cp-photo");
      if (image) {
        sample.flight ||= !!root.querySelector(".gf-fly");
        sample.finished = true;
      }
      if (!sample.finished) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  await card.click();
  const photo = forge.locator(".cp-photo");
  await expect(photo).toBeVisible();
  await photo.evaluate((image) => (image as HTMLImageElement).decode());
  const opening = await page.evaluate(() => (window as any).unitOpeningSample);
  expect(opening.held).toBe(true);
  expect(opening.flight, "A delayed response starts the complete unit opening instead of snapping into place").toBe(
    true,
  );
  await expect(forge.locator("[data-guide-modal]")).toHaveCount(0);
  await forge.evaluate((node) => {
    const sample = { frames: 0, blankFrames: 0, running: true };
    (window as any).unitPortraitSample = sample;
    const frame = () => {
      // Inspect the active incoming portrait; a loaded outgoing clone must not mask a blank image.
      const image = node.shadowRoot!.querySelector<HTMLImageElement>(
        '.gf-stage > .gf-view > .root > [data-screen="unit"] > .cp-body > .cp-id > .cp-portrait > .cp-photo',
      );
      if (image) {
        sample.frames += 1;
        if (!image.complete || image.naturalWidth === 0) sample.blankFrames += 1;
      }
      if (sample.running) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  const favorite = forge.locator(
    '.gf-stage > .gf-view > .root > [data-screen="unit"] > .cp-body > .cp-id > .cp-id-top > [data-fav]',
  );
  for (const on of [true, false, true]) {
    await favorite.click();
    await expect(favorite).toHaveAttribute("aria-pressed", String(on));
  }
  for (const tab of ["Story", "Stats"]) await forge.getByRole("tab", { name: tab, exact: true }).click();
  const help = forge.locator(
    '.gf-stage > .gf-view > .root > [data-screen="unit"] > .cp-body > .cp-main > .cp-tabs > [data-unit-help]',
  );
  await help.click();
  await expect(forge.locator("[data-unit-help-modal]")).toBeVisible();
  await forge.locator("[data-unit-help-modal]").getByRole("button", { name: "Close", exact: true }).click();
  await expect(forge.locator("[data-unit-help-modal]")).toHaveCount(0);
  await page.waitForTimeout(150);
  const samples = await page.evaluate(() => {
    const sample = (window as any).unitPortraitSample;
    sample.running = false;
    return sample;
  });
  await testInfo.attach("portrait-frames.json", { body: JSON.stringify(samples), contentType: "application/json" });
  expect(samples.frames).toBeGreaterThan(0);
  expect(samples.blankFrames, "loaded portraits do not blank during favorite, tab or help updates").toBe(0);
  await expect(photo).toHaveAttribute("loading", "eager");
  await expect(photo).toHaveAttribute("decoding", "sync");
  for (const button of [favorite, help]) {
    const offset = await button.evaluate((button) => {
      const box = button.getBoundingClientRect();
      const icon = button.querySelector("svg")!.getBoundingClientRect();
      return {
        x: Math.abs(box.x + box.width / 2 - icon.x - icon.width / 2),
        y: Math.abs(box.y + box.height / 2 - icon.y - icon.height / 2),
      };
    });
    expect(offset.x).toBeLessThanOrEqual(0.5);
    expect(offset.y).toBeLessThanOrEqual(0.5);
  }
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath(`unit-controls-${testInfo.project.name}.png`),
  });
  await forge.getByRole("button", { name: "◀ Units", exact: true }).click();
  const badge = card.getByRole("img", { name: "Fire", exact: true });
  await expect(badge).toBeVisible();
  // Measure the resting card, after its finite entrance animations.
  await card.evaluate(async (card) => {
    await Promise.all(
      card
        .getAnimations({ subtree: true })
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => {})),
    );
  });
  const position = await badge.evaluate((badge) => {
    const art = badge.closest(".u-art")!.getBoundingClientRect();
    const icon = badge.getBoundingClientRect();
    const stars = badge.closest(".u-art")!.querySelector(".u-stars")!.getBoundingClientRect();
    return {
      right: art.right - icon.right,
      top: icon.top - art.top,
      cornerGap: Math.abs(icon.top - stars.top),
      width: icon.width,
      height: icon.height,
    };
  });
  expect(position.right).toBeGreaterThanOrEqual(0);
  expect(position.right).toBeLessThan(position.width);
  expect(position.top).toBeGreaterThanOrEqual(0);
  expect(position.top).toBeLessThan(position.height);
  expect(position.cornerGap, "affinity badge aligns with the opposite rarity corner").toBeLessThanOrEqual(1);
  const loads = await forge.evaluate((node) => {
    const viewport = node.shadowRoot!.querySelector(".grid-scroll")!.getBoundingClientRect();
    return Array.from(node.shadowRoot!.querySelectorAll<HTMLImageElement>(".u-photo")).map((image) => {
      const box = image.getBoundingClientRect();
      return {
        visible:
          box.bottom > viewport.top &&
          box.top < viewport.bottom &&
          box.right > viewport.left &&
          box.left < viewport.right,
        loading: image.loading,
      };
    });
  });
  expect(loads.some((image) => !image.visible)).toBe(true);
  expect(loads.filter((image) => image.visible).every((image) => image.loading === "eager")).toBe(true);
  expect(loads.filter((image) => !image.visible).every((image) => image.loading === "lazy")).toBe(true);
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath(`unit-affinity-${testInfo.project.name}.png`),
  });
  const upgrades: unknown[] = [];
  await page.route("**/api/gacha-forge/level-up", (route) => {
    upgrades.push(route.request().postDataJSON());
    return route.fulfill({ json: { ok: true, level: 3, xp: 0, wallet: { funds: 0, insight: { shard: 5 } } } });
  });
  await forge.evaluate((node, unit) => {
    const game = node as any;
    game._rosterUnitId = unit.id;
    game._unit = unit;
    game._unitState = "ready";
    game._unitTab = "growth";
    game._growth = {
      level: 1,
      levelCap: 3,
      xp: 0,
      xpNeeded: 200,
      wallet: { funds: 250, insight: { shard: 10 } },
      tiers: [{ id: "shard", name: "Insight Shard", xp: 100 }],
      ladder: [
        { level: 1, xp: 200, funds: 100, cpAfter: 200 },
        { level: 2, xp: 300, funds: 150, cpAfter: 300 },
      ],
    };
    game._growthRev += 1;
    game._renderBrowser();
  }, unit);
  await forge.locator("[data-forge-auto-insight]").click();
  expect(upgrades).toEqual([]);
  expect(await forge.evaluate((node) => (node as any)._feed)).toEqual({ shard: 5 });
  await expect(forge.locator("[data-gw-lv-to]")).toContainText("3");
  await page.screenshot({ path: testInfo.outputPath("auto-level-preview.png"), animations: "disabled" });
  await page.route("**/api/gacha-forge/farm", (route) =>
    route.fulfill({
      json: {
        ok: true,
        today: 0,
        days: [{ day: "Monday" }],
        vigor: 100,
        locked: [],
        stages: {
          funds: [],
          relic: [],
          xp: [
            {
              difficulty: 1,
              label: "Insight Trial",
              vigor: 10,
              qty: 2,
              material: "Insight Shard",
              itemId: "shard",
              worth: { value: 100, unit: "XP" },
            },
          ],
        },
        families: [],
        formFamilies: [],
        wheel: [],
        formWheel: [],
      },
    }),
  );
  await forge.locator("[data-forge-find-insight]").click();
  await expect(forge.getByRole("heading", { name: "Materials", exact: true })).toBeVisible();
  await expect(forge.locator('[data-farm-run="xp"]')).toBeVisible();
  expect(upgrades).toHaveLength(0);
  await forge.evaluate((node) => {
    const game = node as any;
    game._hudView = "roster";
    game._renderBrowser();
  });
  await forge.locator("[data-feed-go]").click();
  await expect.poll(() => upgrades.length).toBe(1);
  expect(upgrades[0]).toEqual({
    runId: "unit-proof",
    unitId: unit.id,
    spend: { shard: 5 },
    timeZone: expect.any(String),
  });
});
