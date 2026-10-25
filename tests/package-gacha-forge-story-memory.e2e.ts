import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("Set MARINARA_ENGINE_ROOT to a compatible Engine checkout");
const appVersion = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version;
type Memory = { phase: string; retryable: boolean; reason?: string };

async function openMemory(
  page: Page,
  testInfo: TestInfo,
  initial: Memory,
  reducedMotion: "reduce" | "no-preference" = "reduce",
) {
  await page.setViewportSize(
    testInfo.project.name.includes("mobile") ? { width: 874, height: 402 } : { width: 1440, height: 900 },
  );
  await page.emulateMedia({ reducedMotion });
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
    const original = window.fetch;
    (window as any).__forgeMemoryAborts = [];
    window.fetch = (input, options) => {
      // Engine's CSRF shim forwards a Request; observe its cloned body and signal too.
      if ((input instanceof Request ? input.url : String(input)).includes("/story-memory/status")) {
        const body = options?.body
          ? Promise.resolve(JSON.parse(String(options.body)))
          : input instanceof Request
            ? input.clone().json()
            : Promise.resolve({});
        const signal = options?.signal ?? (input instanceof Request ? input.signal : null);
        signal?.addEventListener("abort", () => {
          void body.then((value) => (window as any).__forgeMemoryAborts.push(value.runId));
        });
      }
      return original(input, options);
    };
  }, appVersion);
  const saved = {
    runId: "memory-world-one",
    name: "Memory proof",
    scenario: "A synthetic world with saved story records.",
    hudStyle: "aurora",
    hasStandardBanner: true,
    storyUnwritten: true,
    storyDeferred: true,
    protagonist: { name: "Mari" },
    story: { preforge: "off", choices: true },
    progress: {},
    audio: { tts: false, generate: false, muted: true },
  };
  const fixture = {
    memory: initial,
    chapters: [
      { chapter: 1, title: "The first evening", complete: true, compressed: false, storyBeats: 5 },
      { chapter: 2, title: "The return", complete: true, compressed: true, storyBeats: 5 },
    ],
    compress: [] as unknown[],
    retry: [] as string[],
    status: [] as string[],
    statusReply: async (_runId: string): Promise<Memory> => fixture.memory,
    retryReply: async (): Promise<Memory> => fixture.memory,
  };
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await page.route("**/api/gacha-forge/state*", (route) =>
    route.fulfill({
      json: {
        runs: [saved],
        activeRunId: saved.runId,
        activeRun: saved,
        guidesSeen: ["welcome", "home", "settings", "continuity"],
      },
    }),
  );
  await page.route("**/api/gacha-forge/setup/draft", (route) => route.fulfill({ json: { ok: true, draft: null } }));
  await page.route("**/api/gacha-forge/preforge", (route) =>
    route.fulfill({ json: { ok: true, preforge: { mode: "off", locked: false, canAuto: false } } }),
  );
  await page.route("**/api/gacha-forge/continuity", (route) =>
    route.fulfill({ json: { ok: true, chapters: fixture.chapters, memory: fixture.memory } }),
  );
  await page.route("**/api/gacha-forge/story-memory/status", async (route) => {
    const runId = route.request().postDataJSON().runId;
    fixture.status.push(runId);
    const memory = await fixture.statusReply(runId);
    // A deliberately delayed reply may outlive its aborted request.
    await route.fulfill({ json: { ok: true, memory } }).catch(() => {});
  });
  await page.route("**/api/gacha-forge/story-memory/retry", async (route) => {
    fixture.retry.push(route.request().postDataJSON().runId);
    const memory = await fixture.retryReply();
    await route.fulfill({ json: { ok: true, memory } }).catch(() => {});
  });
  await page.route("**/api/gacha-forge/compress", (route) => {
    const input = route.request().postDataJSON();
    fixture.compress.push(input);
    fixture.chapters.find((chapter) => chapter.chapter === input.chapter)!.compressed = true;
    return route.fulfill({ json: { ok: true, contextTokens: 100 } });
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "Open Gacha Forge" }).click();
  const forge = page.locator("marinara-capability-gacha-forge");
  await expect(forge.getByRole("button", { name: "Game settings", exact: true })).toBeVisible();
  await forge.getByRole("button", { name: "Game settings", exact: true }).click();
  await forge.locator('[role="tab"][data-view="continuity"]').click();
  const status = forge.locator('[data-forge-story-memory] [role="status"]');
  await expect(status).toBeVisible();
  return { forge, fixture, saved, status };
}

test("Unknown context explains Engine configuration without hiding optional manual controls", async ({
  page,
}, testInfo) => {
  const { forge, fixture, status } = await openMemory(page, testInfo, {
    phase: "context-unknown",
    retryable: false,
    reason: "untrusted provider detail must not appear",
  });
  await expect(status).toContainText("Engine Connections");
  await expect(status).toContainText("You can keep playing.");
  await expect(forge.locator("[data-forge-story-memory]")).not.toContainText("untrusted provider detail");
  const check = forge.getByRole("button", { name: "Check context", exact: true });
  await expect(check).toBeVisible();
  await check.scrollIntoViewIfNeeded();
  const touch = await check.boundingBox();
  expect(touch!.height).toBeGreaterThanOrEqual(44);
  await expect(forge.locator('[data-compress="1"]')).toBeVisible();
  await expect(forge.locator("[data-forge-allow-choices]")).toHaveAttribute("aria-checked", "true");
  await page.clock.install();
  const reads = fixture.status.length;
  await page.clock.runFor(8_000);
  expect(fixture.status).toHaveLength(reads);
  expect(fixture.retry).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath(`memory-context-${testInfo.project.name}.png`) });
  fixture.retryReply = async () => (fixture.memory = { phase: "ready", retryable: false });
  await check.click();
  await expect(status).toHaveText("Story memory is up to date.");
  expect(fixture.retry).toEqual(["memory-world-one"]);
});

test("Continuity keeps its original context threshold controls visible across viewport changes", async ({
  page,
}, testInfo) => {
  const { forge } = await openMemory(page, testInfo, { phase: "ready", retryable: false }, "no-preference");
  await forge.locator(".gf-fs-bar").click();
  await expect(page.locator(".mari-home-browser-chrome")).toBeHidden();
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 874, height: 402 },
  ]) {
    await page.setViewportSize(viewport);
    const controls = forge.locator("[data-warn-custom]");
    const evidence = await controls.evaluate((input) => {
      const plate = input.closest(".st-plate")!;
      const panel = input.closest(".st-pane")!;
      const bounds = panel.getBoundingClientRect();
      const heading = [...plate.querySelectorAll("h2,h3,h4")].find((node) => node.textContent === "Model context")!;
      const visibleIntersection = (node: Element) => {
        const box = node.getBoundingClientRect();
        return {
          width: Math.min(box.right, bounds.right, innerWidth) - Math.max(box.left, bounds.left, 0),
          height: Math.min(box.bottom, bounds.bottom, innerHeight) - Math.max(box.top, bounds.top, 0),
        };
      };
      return {
        visible: [input, heading].map(visibleIntersection),
        input: input.outerHTML,
        plate: plate.outerHTML,
        dimensions: [
          input.getBoundingClientRect().x,
          input.getBoundingClientRect().y,
          input.getBoundingClientRect().width,
          input.getBoundingClientRect().height,
        ],
        panel: [
          panel.getBoundingClientRect().y,
          panel.getBoundingClientRect().height,
          panel.scrollTop,
          panel.scrollHeight,
        ],
        styles: [input, plate, panel].map((node) => ({
          display: getComputedStyle(node).display,
          visibility: getComputedStyle(node).visibility,
          opacity: getComputedStyle(node).opacity,
          overflow: getComputedStyle(node).overflow,
        })),
      };
    });
    await testInfo.attach(`context-${viewport.width}x${viewport.height}.json`, {
      body: JSON.stringify(evidence, null, 2),
      contentType: "application/json",
    });
    await page.screenshot({ path: testInfo.outputPath(`context-${viewport.width}x${viewport.height}.png`) });
    await expect(controls).toBeVisible();
    await expect(forge.getByRole("heading", { name: "Model context", exact: true })).toBeVisible();
    for (const intersection of evidence.visible) {
      expect(intersection.width).toBeGreaterThan(0);
      expect(intersection.height).toBeGreaterThan(0);
    }
  }
});

test("Explicit retry settles to ready and manual compression and combining remain available", async ({
  page,
}, testInfo) => {
  const { forge, fixture, status } = await openMemory(page, testInfo, { phase: "stale", retryable: true });
  await expect(status).toContainText("needs an update");
  expect(fixture.retry).toEqual([]);
  let finishRetry!: () => void;
  fixture.retryReply = async () => {
    await new Promise<void>((resolve) => (finishRetry = resolve));
    return { phase: "pending", retryable: false };
  };
  const finishReads: (() => void)[] = [];
  fixture.statusReply = async () => {
    await new Promise<void>((resolve) => finishReads.push(resolve));
    return (fixture.memory = { phase: "ready", retryable: false });
  };
  const retry = forge.getByRole("button", { name: "Retry memory update", exact: true });
  const originalStatus = await status.elementHandle();
  const originalAction = await retry.elementHandle();
  await retry.focus();
  await forge.evaluate((node) => {
    const game = node as any;
    game._fillContinuity();
    game._settingsRev += 1;
    game._renderBrowser();
  });
  await expect(retry).toBeFocused();
  expect(await status.evaluate((node, original) => node === original, originalStatus)).toBe(true);
  expect(await retry.evaluate((node, original) => node === original, originalAction)).toBe(true);
  await retry.press("Enter");
  await expect.poll(() => fixture.retry).toEqual(["memory-world-one"]);
  await expect(retry).toBeDisabled();
  await expect(status).toHaveText("Retrying memory update…");
  await expect(status).toBeFocused();
  const reads = fixture.status.length;
  await forge.evaluate((node) => (node as any)._fillContinuity());
  await expect.poll(() => fixture.status.length).toBe(reads + 1);
  await forge.evaluate((node) => {
    const game = node as any;
    game._settingsRev += 1;
    game._renderBrowser();
  });
  await expect.poll(() => fixture.status.length).toBe(reads + 2);
  expect(fixture.retry).toEqual(["memory-world-one"]);
  await expect(status).toBeFocused();
  for (const finish of finishReads) finish();
  finishRetry();
  await expect(status).toHaveText("Story memory is up to date.");
  await expect(forge.locator("[data-forge-memory-retry]")).toBeHidden();
  expect(await status.evaluate((node, original) => node === original, originalStatus)).toBe(true);
  expect(
    await forge.locator("[data-forge-memory-retry]").evaluate((node, original) => node === original, originalAction),
  ).toBe(true);
  await expect(status).toBeFocused();
  await forge.locator('[data-compress="1"]').click();
  await expect.poll(() => fixture.compress).toEqual([{ runId: "memory-world-one", chapter: 1 }]);
  await expect(forge.locator('[data-compress="1"]')).toHaveCount(0);
  await forge.getByRole("button", { name: "Combine compressed chapters", exact: true }).click();
  await expect(forge.locator("[data-fold-go]")).toBeDisabled();
  await forge.locator('[data-pick="1"]').click();
  await forge.locator('[data-pick="2"]').click();
  await expect(forge.locator("[data-fold-go]")).toHaveText("Merge 2 entries");
  await expect(forge.locator("[data-fold-go]")).toBeEnabled();
  await forge.locator("[data-fold-cancel]").click();
  await expect(status).toHaveText("Story memory is up to date.");
  await page.screenshot({ path: testInfo.outputPath(`memory-ready-${testInfo.project.name}.png`) });
  await originalStatus?.dispose();
  await originalAction?.dispose();
});

test("Leaving Continuity aborts pending reads and an old world's reply cannot replace current status", async ({
  page,
}, testInfo) => {
  const { forge, fixture, status } = await openMemory(page, testInfo, { phase: "pending", retryable: false });
  await expect(status).toHaveText("Updating story memory. You can keep playing.");
  const initialReads = fixture.status.length;
  const originalStatus = await status.elementHandle();
  let releaseOld!: () => void;
  fixture.statusReply = async (runId) => {
    if (runId !== "memory-world-one") return fixture.memory;
    await new Promise<void>((resolve) => (releaseOld = resolve));
    return { phase: "error", retryable: true };
  };
  await expect.poll(() => fixture.status.length).toBeGreaterThan(initialReads);
  await expect(status).toHaveText("Updating story memory. You can keep playing.");
  expect(await status.evaluate((node, original) => node === original, originalStatus)).toBe(true);
  await forge.locator('[role="tab"][data-view="visual"]').click();
  await expect(status).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as any).__forgeMemoryAborts)).toContain("memory-world-one");
  fixture.memory = { phase: "context-unknown", retryable: false };
  await forge.evaluate((node) => {
    const game = node as any;
    game._run = { ...game._run, runId: "memory-world-two", name: "Another world" };
    game._continuity = null;
    game._renderKey = null;
    game._openSettings("continuity");
  });
  await expect(status).toContainText("Engine Connections");
  releaseOld();
  await expect(status).toContainText("Engine Connections");
  await expect(forge.getByRole("button", { name: "Check context", exact: true })).toBeVisible();
  expect(await forge.evaluate((node) => (node as any)._storyMemoryRunId)).toBe("memory-world-two");
  expect(fixture.retry).toEqual([]);
  await originalStatus?.dispose();
});
