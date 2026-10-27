import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Keep playing leaves a main chapter that is still forging: the request keeps running, the game stays
// playable, and an Engine notice says when the chapter is ready. Nothing is cancelled or asked twice.
const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("Set MARINARA_ENGINE_ROOT to a compatible Engine checkout");
const appVersion = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version;

const run = {
  runId: "keep-playing",
  name: "Keep playing proof",
  scenario: "A fictional road between two towns.",
  protagonist: { name: "Mari" },
  story: { preforge: "story" },
  progress: { "1": { normal: 4 } },
};
const plan = {
  title: "The Second Road",
  nodes: [
    { index: 1, type: "story", title: "The gate" },
    { index: 2, type: "combat", title: "Gate fight" },
  ],
};

async function openForge(page: Page, testInfo: TestInfo) {
  await page.setViewportSize(
    testInfo.project.name.includes("mobile") ? { width: 874, height: 402 } : { width: 1440, height: 900 },
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await page.addInitScript(
    ({ version }) => {
      localStorage.removeItem("marinara-active-chat-id");
      localStorage.setItem("marinara:whats-new:seen-version", version);
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: {
            theme: "dark",
            hasCompletedOnboarding: true,
            sidebarOpen: false,
            rightPanelOpen: false,
            appAccentPulseMode: false,
          },
          version: 65,
        }),
      );
    },
    { version: appVersion },
  );
  await page.route("**/api/gacha-forge/state*", (route) =>
    route.fulfill({ json: { runs: [], guidesSeen: ["welcome"] } }),
  );
  await page.route("**/api/gacha-forge/continuity", (route) => route.fulfill({ json: { ok: true, chapters: [] } }));
  await page.route("**/api/gacha-forge/preforge", (route) =>
    route.fulfill({ json: { ok: true, preforge: { mode: "story", chapter: 2, locked: false, canAuto: false } } }),
  );
  await page.route("**/api/gacha-forge/locations", (route) => route.fulfill({ json: { ok: true, places: [] } }));
  await page.route("**/api/gacha-forge/setup/draft", (route) =>
    route.fulfill({ json: route.request().method() === "POST" ? { ok: true } : { ok: true, draft: null } }),
  );
  await page.goto("/");
  await page.getByRole("tab", { name: "Open Gacha Forge" }).click();
  const forge = page.locator("marinara-capability-gacha-forge");
  await expect(forge.locator("textarea").first()).toBeVisible();
  return forge;
}

async function seedHome(forge: Locator) {
  await forge.evaluate(
    (node, fixture) => {
      const game = node as any;
      game._clearBeat();
      game._boot = "ready";
      game._welcomeBegun = true;
      game._guidesSeen = new Set(["welcome", "home", "chapters", "chapter", "beat", "settings", "continuity", "modes"]);
      game._run = structuredClone(fixture.run);
      game._bannerReady = true;
      game._artReady = true;
      game._artState = "idle";
      game._artBlocking = false;
      game._planChapter = 1;
      game._plan = null;
      game._planState = "idle";
      game._planEscaped = true;
      game._hudView = "home";
      game._renderBrowser();
    },
    { run },
  );
}

test("Keep playing leaves a forging chapter running and reports it ready", async ({ page }, testInfo) => {
  let releasePlan!: () => void;
  const planHeld = new Promise<void>((resolvePromise) => (releasePlan = resolvePromise));
  const planRequests: unknown[] = [],
    guideRequests: unknown[] = [],
    preforgeStarts: unknown[] = [],
    cancels: unknown[] = [];
  await page.route("**/api/gacha-forge/chapter-plan", async (route) => {
    planRequests.push(route.request().postDataJSON());
    if (planRequests.length === 1) await planHeld;
    await route.fulfill({ json: { ok: true, plan, progress: run.progress, storyRevision: 0 } });
  });
  await page.route("**/api/gacha-forge/combat-guide", (route) => {
    guideRequests.push(route.request().postDataJSON());
    return route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/gacha-forge/preforge/start", (route) => {
    preforgeStarts.push(route.request().postDataJSON());
    return route.fulfill({
      json: { ok: true, allowed: true, preforge: { mode: "story", chapter: 2, running: true, locked: true } },
    });
  });
  await page.route("**/api/gacha-forge/story/cancel", (route) => {
    cancels.push(route.request().postDataJSON());
    return route.fulfill({ json: { ok: true } });
  });
  const forge = await openForge(page, testInfo);
  await seedHome(forge);

  await forge.evaluate((node) => (node as any)._openChapter(2));
  const keep = forge.getByRole("button", { name: "Keep playing" });
  const hint = forge.getByText("This chapter keeps forging while you play. You'll be told when it's ready.");
  const cancel = forge.locator("[data-forge-story-cancel]");
  await expect(keep).toBeVisible();
  await expect(hint).toBeVisible();
  await expect(cancel).toBeVisible();
  await expect.poll(() => planRequests.length).toBe(1);
  // Keep playing, its hint and Cancel stack in that order without overlapping, inside the viewport.
  const [keepBox, hintBox, cancelBox] = await Promise.all([keep, hint, cancel].map((item) => item.boundingBox()));
  expect(keepBox!.y + keepBox!.height).toBeLessThanOrEqual(hintBox!.y + 1);
  expect(hintBox!.y + hintBox!.height).toBeLessThanOrEqual(cancelBox!.y + 1);
  expect(cancelBox!.y + cancelBox!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await expect(keep).toHaveAttribute("aria-describedby", "forge-keep-playing-hint");
  await page.screenshot({ path: testInfo.outputPath("keep-playing-loader.png") });

  await keep.click();
  const battle = forge.locator("[data-open-modes]");
  await expect(battle).toBeVisible();
  await expect(battle).toBeFocused();
  await expect(forge.locator("[data-busy]")).toContainText("Forging the chapter");
  await page.screenshot({ path: testInfo.outputPath("keep-playing-home.png") });
  // The game stays playable: the Battle menu opens while the chapter forges.
  await battle.click();
  await expect.poll(() => forge.evaluate((node) => (node as any)._state())).toBe("modes");
  await forge.evaluate((node) => {
    (node as any)._hudView = "home";
    (node as any)._renderBrowser();
  });

  releasePlan();
  await expect(page.getByText("Chapter Two is ready.")).toBeVisible();
  await expect.poll(() => preforgeStarts.length).toBe(1);
  expect(preforgeStarts[0]).toMatchObject({ runId: run.runId, chapter: 2 });
  expect(guideRequests).toEqual([expect.objectContaining({ runId: run.runId, chapter: 2, combatIndex: 0 })]);
  expect(cancels).toEqual([]);
  expect(planRequests).toHaveLength(1);
  expect(await forge.evaluate((node) => (node as any)._plan)).toBeNull();

  // Opening the chapter now is a quick read of the saved plan, with no second pre-forge start.
  await forge.evaluate((node) => (node as any)._openChapter(2));
  await expect.poll(() => forge.evaluate((node) => (node as any)._state())).toBe("chapter");
  expect(await forge.evaluate((node) => (node as any)._plan?.title)).toBe(plan.title);
  expect(planRequests).toHaveLength(2);
  expect(preforgeStarts).toHaveLength(1);
});

test("Cancel on another loader stops the chapter left forging, and the notice says so", async ({ page }, testInfo) => {
  const cancels: unknown[] = [];
  await page.route("**/api/gacha-forge/chapter-plan", () => new Promise<void>(() => {}));
  await page.route("**/api/gacha-forge/story/cancel", (route) => {
    cancels.push(route.request().postDataJSON());
    return route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/gacha-forge/story/start", (route) => route.fulfill({ json: { ok: true } }));
  await page.route("**/api/gacha-forge/beat", () => new Promise<void>(() => {}));
  const forge = await openForge(page, testInfo);
  await seedHome(forge);
  await forge.evaluate((node) => (node as any)._openChapter(2));
  await forge.getByRole("button", { name: "Keep playing" }).click();
  // Replay a written scene of chapter 1; its loader offers Cancel but not Keep playing.
  await forge.evaluate((node) => {
    const game = node as any;
    game._planChapter = 1;
    game._plan = { title: "The First Road", nodes: [{ index: 1, type: "story", title: "The well" }] };
    game._hudView = "chapter";
    game._playStoryNode({ ...game._plan.nodes[0], type: "story", storyIndex: 0 });
  });
  await expect(forge.locator("[data-forge-story-cancel]")).toBeVisible();
  await expect(forge.getByRole("button", { name: "Keep playing" })).toHaveCount(0);
  await forge.locator("[data-forge-story-cancel]").click();
  await expect(page.getByText("Chapter Two was interrupted. Open it to continue.")).toBeVisible();
  expect(cancels).toEqual([expect.objectContaining({ runId: run.runId, chapter: 1 })]);
});
