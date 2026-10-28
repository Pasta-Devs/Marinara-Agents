import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Opening a chapter whose plan is already shown reloads that plan in the background. When the reload
// finishes while a beat is playing, the beat's choices must still appear, and a story start must still open.
const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("Set MARINARA_ENGINE_ROOT to a compatible Engine checkout");
const appVersion = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version;

const run = {
  runId: "choice-plan-reload",
  name: "Choice reload proof",
  scenario: "Synthetic choices in a fictional garden.",
  protagonist: { name: "Mari" },
  story: { preforge: "off" },
  progress: {},
};
const plan = {
  title: "Two paths",
  nodes: [
    { index: 1, type: "story", title: "The garden" },
    { index: 2, type: "story", title: "The fountain" },
  ],
};
const options = [
  {
    id: "option-1",
    text: "Pull your hoodie up.",
    selection: { kind: "action", text: "You pull your hoodie up against the cold." },
    segments: [{ speaker: "", text: "ARDEN_SELECTED_BRANCH" }],
  },
  {
    id: "option-2",
    text: "Apologize.",
    selection: { kind: "dialogue", text: "I am sorry I kept you waiting." },
    segments: [{ speaker: "", text: "BRIN_ALTERNATE_BRANCH" }],
  },
];
const beat = {
  ok: true,
  segments: [
    { speaker: "", text: "OPENING_LINE" },
    { speaker: "", text: "CHOICE_POINT_LINE" },
    { speaker: "", text: "COMMON_REJOIN" },
  ],
  choices: [{ id: "choice-1", kind: "small", at: 1, options }],
  choiceCanon: {},
  cast: [],
  places: [],
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
  await page.route("**/api/gacha-forge/preforge*", (route) =>
    route.fulfill({ json: { ok: true, allowed: false, preforge: { mode: "off", locked: false, canAuto: false } } }),
  );
  await page.route("**/api/gacha-forge/locations", (route) => route.fulfill({ json: { ok: true, places: [] } }));
  await page.route("**/api/gacha-forge/beat/mark", (route) => route.fulfill({ json: { ok: true } }));
  await page.route("**/api/gacha-forge/story/start", (route) => route.fulfill({ json: { ok: true } }));
  await page.route("**/api/gacha-forge/beat", (route) => route.fulfill({ json: beat }));
  await page.route("**/api/gacha-forge/setup/draft", (route) =>
    route.fulfill({ json: route.request().method() === "POST" ? { ok: true } : { ok: true, draft: null } }),
  );
  await page.goto("/");
  await page.getByRole("tab", { name: "Open Gacha Forge" }).click();
  const forge = page.locator("marinara-capability-gacha-forge");
  await expect(forge.locator("textarea").first()).toBeVisible();
  return forge;
}

async function seedChapterList(forge: Locator) {
  await forge.evaluate(
    (node, fixture) => {
      const game = node as any;
      game._clearBeat();
      game._boot = "ready";
      game._welcomeBegun = true;
      game._guidesSeen = new Set(["welcome", "home", "chapters", "chapter", "beat", "settings", "continuity"]);
      game._run = { ...fixture.run };
      game._bannerReady = true;
      game._artReady = true;
      game._artState = "idle";
      game._artBlocking = false;
      game._planChapter = 1;
      game._chapterProgress = { normal: 0 };
      // The plan the player already saw (boot, an earlier visit, or the plan cache).
      game._plan = structuredClone(fixture.plan);
      game.__seededPlan = game._plan;
      game._planState = "idle";
      game._hudView = "chapters";
      game._renderBrowser();
    },
    { run, plan },
  );
}

// An identical reload keeps the shown plan object; a revised one replaces it. Choices survive both.
for (const [reloadLandsAfterBeat, revised] of [
  [true, false],
  [true, true],
  [false, false],
] as const) {
  test(`choices appear when ${revised ? "a revised" : "an identical"} chapter plan reload lands ${reloadLandsAfterBeat ? "after" : "before"} the beat loads`, async ({
    page,
  }, testInfo) => {
    let releasePlan!: () => void;
    const planHeld = new Promise<void>((resolvePromise) => (releasePlan = resolvePromise));
    let planRequests = 0;
    await page.route("**/api/gacha-forge/chapter-plan", async (route) => {
      planRequests += 1;
      await planHeld;
      await route.fulfill({
        json: {
          ok: true,
          plan: revised ? { ...plan, title: "Two paths, revised" } : plan,
          progress: { "1": { normal: 0 } },
        },
      });
    });
    const forge = await openForge(page, testInfo);
    await seedChapterList(forge);
    // Real entry path: the chapter list opens chapter 1 while its plan is still displayed, which
    // shows the chapter immediately and reloads that plan in the background.
    await forge.evaluate((node) => (node as any)._openChapter(1));
    await expect.poll(() => planRequests).toBe(1);
    if (!reloadLandsAfterBeat) {
      releasePlan();
      await expect.poll(() => forge.evaluate((node) => (node as any)._planState)).toBe("idle");
    }
    // Tap the first story node in the chapter view (falls back to the same handler).
    await forge.evaluate((node) => {
      const game = node as any;
      game._playStoryNode({ ...game._plan.nodes[0], type: "story", storyIndex: 0 });
    });
    const text = forge.locator("[data-text]");
    await expect(text).toHaveText("OPENING_LINE");
    if (reloadLandsAfterBeat) {
      releasePlan();
      await expect.poll(() => forge.evaluate((node) => (node as any)._planState)).toBe("idle");
    }
    expect(await forge.evaluate((node) => (node as any)._plan === (node as any).__seededPlan)).toBe(!revised);
    // Arrive at the choice point.
    await forge.locator("[data-box]").click();
    await expect(text).toHaveText("CHOICE_POINT_LINE");
    // The choices appear on the first play, without leaving and returning.
    const choices = forge.locator("[data-forge-choices]");
    await expect(choices).toBeVisible();
    await expect(choices).toContainText("Pull your hoodie up.");
    await expect(choices).toContainText("Apologize.");
  });
}

test("a story start still opens when the plan reload lands while it is pending", async ({ page }, testInfo) => {
  let releasePlan!: () => void;
  const planHeld = new Promise<void>((resolvePromise) => (releasePlan = resolvePromise));
  let releaseStart!: () => void;
  const startHeld = new Promise<void>((resolvePromise) => (releaseStart = resolvePromise));
  let starts = 0;
  await page.route("**/api/gacha-forge/chapter-plan", async (route) => {
    await planHeld;
    await route.fulfill({ json: { ok: true, plan, progress: { "1": { normal: 0 } } } });
  });
  const forge = await openForge(page, testInfo);
  await page.route("**/api/gacha-forge/story/start", async (route) => {
    starts += 1;
    await startHeld;
    await route.fulfill({ json: { ok: true } });
  });
  await seedChapterList(forge);
  await forge.evaluate((node) => (node as any)._openChapter(1));
  await forge.evaluate((node) => {
    const game = node as any;
    game._playStoryNode({ ...game._plan.nodes[0], type: "story", storyIndex: 0 });
  });
  await expect.poll(() => starts).toBe(1);
  releasePlan();
  await expect.poll(() => forge.evaluate((node) => (node as any)._planState)).toBe("idle");
  releaseStart();
  await expect(forge.locator("[data-text]")).toHaveText("OPENING_LINE");
});
