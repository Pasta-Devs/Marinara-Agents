import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("Set MARINARA_ENGINE_ROOT to the validated Engine checkout");
const appVersion = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version;
// Keep the SDK fixture as native ESM; Playwright otherwise transforms import.meta into its CJS test wrapper.
const nativeImport = new Function("url", "return import(url)");

async function visibleInsideScroll(item: Locator) {
  await item.scrollIntoViewIfNeeded();
  const proof = await item.evaluate((node) => {
    const box = node.getBoundingClientRect();
    const scroll = node.closest(".cap-scroll")!.getBoundingClientRect();
    return {
      text: node.textContent,
      top: box.top,
      bottom: box.bottom,
      left: box.left,
      right: box.right,
      clipTop: Math.max(0, scroll.top),
      clipBottom: Math.min(innerHeight, scroll.bottom),
      clipLeft: Math.max(0, scroll.left),
      clipRight: Math.min(innerWidth, scroll.right),
    };
  });
  expect(proof.top).toBeGreaterThanOrEqual(proof.clipTop - 1);
  expect(proof.bottom).toBeLessThanOrEqual(proof.clipBottom + 1);
  expect(proof.left).toBeGreaterThanOrEqual(proof.clipLeft - 1);
  expect(proof.right).toBeLessThanOrEqual(proof.clipRight + 1);
  return proof;
}

async function openChapter(page: Page, testInfo: TestInfo, theme: string, bond = false) {
  const { chapterRunId, chapterUnitId, createChapterRuntime, freshMainPlan } = await nativeImport(
    pathToFileURL(resolve(__dirname, "fixtures/gacha-forge-chapter-runtime.mjs")).href,
  );
  const runtime = await createChapterRuntime({ bond });
  const title = bond ? "Arden’s promise · a new beginning" : "The lighthouse · a new beginning";
  const chapter = bond ? "bond-arden-2" : 2;
  const plan = runtime.docs.get(`${chapterRunId}:chapter:${chapter}`)!.data;
  plan.title = title;
  const saved = {
    ...runtime.docs.get("index")!.data.runs[0],
    name: "Chapter reset proof",
    hudStyle: "vanguard",
    hasStandardBanner: true,
    storyUnwritten: false,
    storyDeferred: false,
    progress: structuredClone(runtime.session().progress),
    bondChapters: structuredClone(runtime.session().bondChapters || {}),
    reading: structuredClone(runtime.session().reading),
    audio: { tts: false, generate: false, muted: true },
  };
  const requests: { path: string; body: any }[] = [];
  await page.setViewportSize(
    testInfo.project.name.includes("mobile") ? { width: 874, height: 402 } : { width: 1440, height: 900 },
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(
    ({ version, theme }) => {
      localStorage.removeItem("marinara-active-chat-id");
      localStorage.setItem("marinara:whats-new:seen-version", version);
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: { theme, hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false },
          version: 65,
        }),
      );
    },
    { version: appVersion, theme },
  );
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await page.route("**/api/gacha-forge/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/gacha-forge", "");
    if (path === "/state")
      return route.fulfill({
        json: {
          runs: [saved],
          activeRunId: chapterRunId,
          activeRun: saved,
          guidesSeen: ["welcome", "home", "chapter", "beat"],
        },
      });
    if (["/chapter/regenerate", "/chapter-plan", "/bond-chapter/plan", "/story/cancel", "/beat/mark"].includes(path)) {
      const body = route.request().postDataJSON();
      requests.push({ path, body });
      const response = await runtime.post(path, body);
      return route.fulfill({ status: response.status, json: response.body });
    }
    return route.fulfill({
      json:
        path === "/preforge"
          ? { ok: true, preforge: { mode: "off", locked: false, canAuto: false } }
          : path === "/setup/draft"
            ? { ok: true, draft: null }
            : { ok: true, chapters: [], locations: [], memory: { phase: "ready", retryable: false } },
    });
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "Open Gacha Forge" }).click();
  const forge = page.locator("marinara-capability-gacha-forge");
  await expect.poll(() => forge.evaluate((node) => (node as any)._boot)).toBe("ready");
  await forge.evaluate(
    (node, input) => {
      const game = node as any;
      game._clearBeat();
      game._bannerReady = true;
      game._artReady = true;
      game._planEscaped = true;
      game._storyUnwritten = false;
      game._storyWriteAsked = false;
      game._hudView = "chapter";
      game._planChapter = input.bond ? "bond-arden-2" : 2;
      game._bondUnit = input.bond ? input.unitId : "";
      game._bondPart = 2;
      game._bondNameValue = input.bond ? "Arden" : "";
      game._plan = input.plan;
      game._planState = "ready";
      game._chapterProgress = { normal: input.bond ? 1 : 3, hard: 0, veryhard: 0 };
      game._difficulty = "normal";
      game._guidesSeen.add("chapter");
      game._guide = "";
      // This proof owns reset/plan SDK traffic. Combat prewarming has separate regressions.
      game._prewarmCombats = async () => {};
      game._preforgeCheck = async () => {};
      sessionStorage.setItem(`gf-beat-line:${input.runId}:2:1`, "2");
      game._renderBrowser();
    },
    { plan, bond, unitId: chapterUnitId, runId: chapterRunId },
  );
  return { runtime, forge, title, requests, chapter, chapterRunId, chapterUnitId, freshMainPlan };
}

async function snapshot(forge: Locator) {
  return forge.evaluate((node) => {
    const game = node as any;
    return JSON.stringify({
      run: game._run,
      plan: game._plan,
      progress: game._chapterProgress,
      beat: game._beat,
      at: game._beatAt,
      active: game._activeStoryNode,
      reading: Object.entries(sessionStorage).filter(([key]) => key.startsWith("gf-beat-line:")),
    });
  });
}

for (const theme of ["dark", "light"]) {
  test(`named reset confirmation preserves Cancel state and regenerates only on Confirm · ${theme}`, async ({
    page,
  }, testInfo) => {
    const { runtime, forge, title, requests, chapterRunId, freshMainPlan } = await openChapter(page, testInfo, theme);
    try {
      const before = await snapshot(forge);
      const serverBefore = structuredClone(runtime.docs);
      const ask = forge.locator("[data-forge-reset-ask]");
      await ask.scrollIntoViewIfNeeded();
      await ask.click();
      const section = forge.locator("[data-forge-chapter-reset]");
      await expect(section.getByRole("heading", { name: "Are you sure?" })).toBeVisible();
      await expect(section).toContainText(title);
      await expect
        .poll(() => forge.evaluate((node) => (node.shadowRoot!.activeElement as HTMLElement)?.dataset.forgeResetCancel))
        .toBe("");
      const initial = await section.evaluate((node) => ({
        text: node.textContent,
        top: node.getBoundingClientRect().top,
        scrollTop: node.closest(".cap-scroll")!.scrollTop,
      }));
      const readable = [];
      for (const paragraph of await section.locator("h3,p").all()) readable.push(await visibleInsideScroll(paragraph));
      const geometryPath = testInfo.outputPath(`chapter-reset-geometry-${theme}.json`);
      writeFileSync(geometryPath, JSON.stringify({ initial, readable }, null, 2));
      await testInfo.attach("confirmation-reading-geometry", {
        path: geometryPath,
        contentType: "application/json",
      });
      await section.getByRole("heading").scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`chapter-reset-warning-${theme}.png`) });
      await section.getByRole("button", { name: "Keep chapter", exact: true }).click();
      await expect(ask).toBeFocused();
      // Boot may finish its cached plan read. Ask/Keep must not send either destructive reset or cancellation.
      expect(requests.filter((request) => ["/chapter/regenerate", "/story/cancel"].includes(request.path))).toEqual([]);
      expect(await snapshot(forge)).toBe(before);
      expect(runtime.docs).toEqual(serverBefore);
      await ask.click();
      await section.locator("[data-forge-reset-confirm]").click();
      await expect.poll(() => forge.evaluate((node) => (node as any)._plan?.title)).toBe(freshMainPlan.title);
      expect(requests.filter((request) => request.path === "/chapter/regenerate")).toHaveLength(1);
      expect(runtime.session().progress[2].normal).toBe(0);
      expect(runtime.session().storyRewardProgress[2]).toBe(3);
      expect(runtime.docs.get(`${chapterRunId}:beat:1:0`)).toEqual(serverBefore.get(`${chapterRunId}:beat:1:0`));
      expect(runtime.docs.get(`${chapterRunId}:chat:arden`)).toEqual(serverBefore.get(`${chapterRunId}:chat:arden`));
      await page.screenshot({ path: testInfo.outputPath(`chapter-reset-fresh-${theme}.png`) });
    } finally {
      await runtime.close();
    }
  });
}

test("current Character Story confirmation resets its open part and completed chapters have no action", async ({
  page,
}, testInfo) => {
  const { runtime, forge, title, requests, chapterRunId, chapterUnitId } = await openChapter(
    page,
    testInfo,
    "dark",
    true,
  );
  try {
    const completed = structuredClone(runtime.docs.get(`${chapterRunId}:chapter:bond-arden`));
    await forge.locator("[data-forge-reset-ask]").click();
    await expect(forge.locator("[data-forge-chapter-reset]")).toContainText(title);
    await forge.locator("[data-forge-reset-confirm]").click();
    await expect.poll(() => runtime.session().bondChapters[chapterUnitId].beats2).toBe(0);
    await expect.poll(() => forge.evaluate((node) => (node as any)._planState)).toBe("idle");
    expect(requests.find((request) => request.path === "/chapter/regenerate")!.body).toMatchObject({
      unitId: chapterUnitId,
      part: 2,
    });
    expect(runtime.docs.get(`${chapterRunId}:chapter:bond-arden`)).toEqual(completed);
    await forge.evaluate((node) => {
      const game = node as any;
      game._chapterProgress.normal = game._plan.nodes.length;
      game._renderBrowser();
    });
    await expect(forge.locator("[data-forge-reset-ask]")).toHaveCount(0);
    expect((await runtime.post("/chapter/regenerate", { chapter: 1, storyRevision: 1 })).body.error).toBe(
      "chapter-completed",
    );
  } finally {
    await runtime.close();
  }
});

test("a stale displayed chapter requires an explicit Reopen before adopting the new story", async ({
  page,
}, testInfo) => {
  const { runtime, forge, requests } = await openChapter(page, testInfo, "dark");
  try {
    expect((await runtime.post("/chapter/regenerate", { chapter: 2 })).body.ok).toBe(true);
    expect((await runtime.post("/chapter-plan", { chapter: 2, storyRevision: 1 })).body.ok).toBe(true);
    const mark = () =>
      forge.evaluate((node) => {
        const game = node as any;
        return game._postJson("/beat/mark", { runId: game._run.runId, chapter: 2, storyIndex: 0, at: 2 });
      });
    expect((await mark()).error).toBe("story-changed");
    await expect(forge.getByRole("button", { name: "Reopen chapter", exact: true })).toBeVisible();
    await expect(forge.locator("[data-forge-chapter-reset]")).toContainText("The story changed");
    await expect(forge.locator("[data-forge-reset-ask]")).toHaveCount(0);
    expect((await mark()).error).toBe("story-changed");
    expect(
      requests.filter((request) => request.path === "/beat/mark").map((request) => request.body.storyRevision),
    ).toEqual([0, 0]);
    expect(runtime.session().reading).toBeUndefined();
    const reads = requests.filter((request) => request.path === "/chapter-plan").length;
    await forge.getByRole("button", { name: "Reopen chapter", exact: true }).click();
    await expect.poll(() => forge.evaluate((node) => (node as any)._plan?.title)).toBe("Fresh lighthouse chapter");
    expect(requests.filter((request) => request.path === "/chapter-plan")).toHaveLength(reads + 1);
    await expect(forge.getByRole("button", { name: "Reopen chapter", exact: true })).toHaveCount(0);
    await expect(forge.locator("[data-forge-reset-ask]")).toBeVisible();
  } finally {
    await runtime.close();
  }
});
