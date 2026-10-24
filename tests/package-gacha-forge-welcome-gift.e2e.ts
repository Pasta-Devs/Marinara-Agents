import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("Set MARINARA_ENGINE_ROOT to a compatible Engine checkout");
const appVersion = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version;

test("Welcome Gift rewards leave Claim reachable on short touch screens", async ({ page }, testInfo) => {
  const mobile = testInfo.project.name.includes("mobile");
  const hybrid = testInfo.project.name === "hybrid-chromium";
  await page.setViewportSize(
    mobile ? { width: 375, height: 667 } : hybrid ? { width: 667, height: 320 } : { width: 1440, height: 900 },
  );
  const pointers = await page.evaluate(() => ({
    primaryFine: matchMedia("(pointer: fine)").matches,
    primaryCoarse: matchMedia("(pointer: coarse)").matches,
    anyCoarse: matchMedia("(any-pointer: coarse)").matches,
  }));
  if (hybrid) expect(pointers).toEqual({ primaryFine: true, primaryCoarse: false, anyCoarse: true });
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await page.route("**/api/gacha-forge/state", (route) =>
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
  let claims = 0;
  await page.route("**/api/gacha-forge/newworld/claim", (route) => {
    expect(route.request().postDataJSON()).toEqual({ runId: "welcome-layout" });
    claims += 1;
    return route.fulfill({ json: { ok: true, gained: [{ kind: "aether", qty: 1600, material: "Aether" }] } });
  });
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
  await page.goto("/");
  await page.getByRole("tab", { name: "Open Gacha Forge" }).click();
  const forge = page.locator("marinara-capability-gacha-forge");
  await expect(forge.locator("textarea").first()).toBeVisible();
  // Use the shipped renderer and event handler, with no generated world or paid model request.
  await forge.evaluate((node) => {
    const game = node as any;
    game._initState();
    game._boot = "ready";
    game._guidesSeen = new Set(["welcome", "events"]);
    game._welcomeBegun = true;
    game._run = { runId: "welcome-layout", name: "Welcome fixture", hasStandardBanner: true, progress: {} };
    game._activeRunId = "welcome-layout";
    game._bannerReady = true;
    game._artReady = true;
    game._planEscaped = true;
    game._creatingNew = false;
    game._hudView = "events";
    game._eventId = "newworld";
    game._eventSlots = [
      { id: "newworld", kind: "newworld", label: "Journey to a New World", note: "Your first 7 days", live: true },
    ];
    game._newWorld = {
      claimed: 0,
      ready: true,
      days: 7,
      perDay: 1600,
      rungs: Array.from({ length: 7 }, (_, index) => ({
        day: index + 1,
        aether: 1600,
        extra: { kind: "aether", qty: 1600, name: "Aether", itemId: "aether" },
      })),
    };
    game._eventsRev += 1;
    game._renderBrowser();
  });
  if (mobile) {
    await expect(forge.getByText("Landscape only", { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("welcome-portrait.png"), animations: "disabled" });
    await page.setViewportSize({ width: 667, height: 320 });
    await expect(forge.locator(".gf-rot")).toBeHidden();
  }
  for (const scale of [1, 1.75]) {
    await forge.evaluate((node, scale) => {
      const game = node as any;
      game._run.textScale = scale;
      game._eventsRev += 1;
      game._renderBrowser();
    }, scale);
    const claim = forge.getByRole("button", { name: "Claim today", exact: true });
    await expect(
      page.locator(".mari-home-browser-chrome"),
      "ordinary Home mode, without entering fullscreen",
    ).toBeVisible();
    await claim.scrollIntoViewIfNeeded();
    const layout = await claim.evaluate((button) => {
      const root = button.getRootNode() as ShadowRoot;
      const box = button.getBoundingClientRect();
      const pane = root.querySelector(".ev-pane.nw")!.getBoundingClientRect();
      const rewardBottom = Math.max(
        ...Array.from(
          root.querySelectorAll(".nw-track .ev-slot, .nw-track .ev-day, .nw-track .ev-n"),
          (reward) => reward.getBoundingClientRect().bottom,
        ),
      );
      const hit = root.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return {
        rewardBottom,
        top: box.top,
        bottom: box.bottom,
        paneBottom: pane.bottom,
        height: box.height,
        hit: button === hit || button.contains(hit),
      };
    });
    await page.screenshot({ path: testInfo.outputPath(`welcome-${scale}.png`), animations: "disabled" });
    expect(layout.rewardBottom, "rewards must not overflow into the Claim footer").toBeLessThanOrEqual(layout.top);
    expect(layout.bottom, "the full Claim button stays inside the scroll viewport").toBeLessThanOrEqual(
      layout.paneBottom,
    );
    if (pointers.anyCoarse || pointers.primaryCoarse) {
      expect(layout.height, "Claim has a touch target even when the primary pointer is fine").toBeGreaterThanOrEqual(
        44,
      );
    }
    expect(layout.hit, "the Claim center is not covered").toBe(true);
    const before = claims;
    if (mobile) await claim.tap();
    else await claim.click();
    await expect.poll(() => claims).toBe(before + 1);
    await expect(forge.locator(".ev-gained")).toContainText("1,600");
  }
  await forge.evaluate((node) => {
    const game = node as any;
    game._hudView = "settings";
    game._settingsCategory = "changelog";
    game._renderBrowser();
  });
  const welcomeNote = forge.getByText(
    "Welcome Gift rewards no longer overlap Claim on short mobile screens; scroll when needed and use its full touch target.",
    { exact: true },
  );
  const previousVersions = forge.getByRole("button", { name: "Show previous version changelog", exact: true });
  while ((await welcomeNote.count()) === 0 && (await previousVersions.isVisible())) {
    await previousVersions.click();
  }
  await expect(welcomeNote).toBeVisible();
});
