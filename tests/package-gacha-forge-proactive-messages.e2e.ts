import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("Set MARINARA_ENGINE_ROOT to the validated Engine checkout");
const appVersion = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version;
const nativeImport = new Function("url", "return import(url)");
const countSelector = '[data-field="story.dailyUnitMessages"] input';
const guideKeys = ["welcome", "home", "settings", "continuity", "chapter", "beat", "combat", "chat"];

async function openForge(page: Page, testInfo: TestInfo, theme: string) {
  const {
    createChapterRuntime,
    chapterRunId: runId,
    chapterUnitId: unitId,
  } = await nativeImport(pathToFileURL(resolve(__dirname, "fixtures/gacha-forge-chapter-runtime.mjs")).href);
  const runtime = await createChapterRuntime({ port: 7866 + testInfo.parallelIndex });
  const originalTransaction = runtime.persistence.transaction;
  let transactionTail = Promise.resolve();
  runtime.persistence.transaction = (operation: any) => {
    const next = transactionTail.then(() => originalTransaction(operation));
    transactionTail = next.catch(() => {});
    return next;
  };
  const run = () => runtime.docs.get("index").data.runs[0];
  delete run().story.dailyUnitMessages;
  run().audio = { tts: false, generate: false, muted: true, combatVoices: false };
  runtime.docs.set(`${runId}:combat-art`, {
    id: `${runId}:combat-art`,
    packageId: "gacha-forge",
    kind: "combat-art",
    revision: 1,
    data: { effigies: { byKey: {}, hasArt: false } },
  });
  const history = Array.from({ length: 30 }, (_, index) => ({
    id: `saved-history-${index}`,
    who: index % 2 ? "unit" : "player",
    text: `SAVED_LIGHTHOUSE_HISTORY_${String(index).padStart(2, "0")}: a remembered conversation between friends.`,
    at: index + 100,
  }));
  runtime.chatDoc().data.messages.push(...history);
  const saved = () => ({
    ...run(),
    name: "Unit message UI proof",
    hudStyle: "vanguard",
    hasStandardBanner: true,
    storyUnwritten: false,
    storyDeferred: false,
    progress: structuredClone(runtime.session().progress),
  });
  const requests: { path: string; body: any; intercepted?: boolean }[] = [];
  const deliveries: { id: string; text: string }[] = [];
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
        json: { runs: [saved()], activeRunId: runId, activeRun: saved(), guidesSeen: guideKeys },
      });
    const body = route.request().method() === "POST" ? route.request().postDataJSON() : {};
    if (path === "/chat/proactive/due") {
      // Deliberately intercepted delivery. Generation/quota correctness has separate actual SDK proof.
      requests.push({ path, body, intercepted: true });
      const queued = deliveries.shift();
      if (!queued) return route.fulfill({ json: { ok: true, status: "waiting" } });
      const said = { ...queued, who: "unit", at: Date.now(), proactive: true };
      const chat = runtime.chatDoc();
      if (!chat.data.messages.some((row: any) => row.id === said.id)) {
        chat.data.messages.push(said);
        chat.revision++;
      }
      return route.fulfill({ json: { ok: true, status: "sent", unitId, unitName: "Arden", said } });
    }
    if (
      path === "/run/sources" ||
      path === "/chat/open" ||
      path === "/chat/list" ||
      path === "/chat/past" ||
      (path === "/setup/draft" && route.request().method() === "POST")
    ) {
      requests.push({ path, body });
      const response = await runtime.post(path, body);
      return route.fulfill({ status: response.status, json: response.body });
    }
    return route.fulfill({
      json:
        path === "/setup/draft"
          ? { ok: true, draft: null }
          : path === "/preforge"
            ? { ok: true, preforge: { mode: "off", locked: false, canAuto: false } }
            : { ok: true, chapters: [], locations: [], memory: { phase: "ready", retryable: false } },
    });
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "Open Gacha Forge" }).click();
  const forge = page.locator("marinara-capability-gacha-forge");
  await expect.poll(() => forge.evaluate((node) => (node as any)._boot)).toBe("ready");
  await forge.evaluate(
    (node, { saved, guides }) => {
      const game = node as any;
      game._clearBeat();
      game._run = saved;
      game._activeRunId = saved.runId;
      game._bannerReady = true;
      game._artReady = true;
      game._planEscaped = true;
      game._storyUnwritten = false;
      game._storyWriteAsked = false;
      game._guidesSeen = new Set(guides);
      game._guide = "";
      game._hudView = "settings";
      game._settingsCategory = "continuity";
      game._continuity = [];
      game._continuityState = "ready";
      game._renderKey = null;
      game._renderBrowser();
    },
    { saved: saved(), guides: guideKeys },
  );
  return { runtime, forge, requests, deliveries, saved, run, runId, unitId };
}

async function countInput(forge: Locator) {
  const input = forge.locator(countSelector);
  await input.scrollIntoViewIfNeeded();
  await expect(input).toBeVisible();
  await expect(input).toHaveAccessibleName("Daily unit messages");
  await expect(input).toHaveAttribute("type", "number");
  await expect(input).toHaveAttribute("min", "0");
  await expect(input).toHaveAttribute("step", "1");
  expect(await input.getAttribute("max")).toBeNull();
  return input;
}

async function settledChatGeometry(page: Page, forge: Locator, editing: boolean) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  let previous = "";
  let geometry!: {
    top: number;
    scrollHeight: number;
    clientHeight: number;
    stageHeight: number;
    editorHeight: number;
    editing: boolean;
  };
  // Focus schedules a viewport/ResizeObserver pass. Flush its frames before attributing any
  // later scroll change to delivery, without weakening the delivery-position assertion.
  await expect
    .poll(async () => {
      await page.clock.runFor(32);
      geometry = await forge.evaluate((node) => {
        const root = (node as any)._root;
        const log = root.querySelector("[data-chat-log]") as HTMLElement;
        const stage = root.querySelector(".gf-stage") as HTMLElement;
        return {
          top: log.scrollTop,
          scrollHeight: log.scrollHeight,
          clientHeight: log.clientHeight,
          stageHeight: stage.clientHeight,
          editorHeight: parseFloat(stage.style.getPropertyValue("--forge-editor-height")),
          editing: stage.hasAttribute("data-forge-editing"),
        };
      });
      const next = JSON.stringify(geometry);
      const stable = next === previous;
      previous = next;
      return (
        stable &&
        geometry.editing === editing &&
        Math.abs(geometry.editorHeight - Math.max(44, geometry.stageHeight - 16)) < 1
      );
    })
    .toBe(true);
  return geometry;
}

for (const theme of ["dark", "light"]) {
  test(`daily message count defaults off in setup and persists through actual Sources · ${theme}`, async ({
    page,
  }, testInfo) => {
    const f = await openForge(page, testInfo, theme);
    try {
      const initial = await countInput(f.forge);
      await expect(initial).toHaveValue("0");
      await f.forge.evaluate((node) => {
        const game = node as any;
        game._run = null;
        game._activeRunId = null;
        game._creatingNew = true;
        game._showRuns = false;
        game._setupDraftAsked = true;
        game._setupDraftSettled = true;
        game._setupDraft = {
          step: 4,
          furthest: 7,
          personaId: "fixture-persona",
          values: { scenario: "A synthetic lighthouse coast.", connectionId: "fixture-text" },
        };
        game._renderKey = null;
        game._renderBrowser();
      });
      const setup = await countInput(f.forge);
      await expect(setup).toHaveValue("0");
      await setup.fill("10000");
      await setup.press("Tab");
      await expect(setup).toHaveValue("10000");
      await page.screenshot({ path: testInfo.outputPath(`unit-messages-setup-${theme}.png`) });
      await f.forge.locator("[data-cancel]").click();
      await expect
        .poll(() =>
          f.requests
            .filter((request) => request.path === "/setup/draft")
            .some((request) => request.body.snapshot?.values?.["story.dailyUnitMessages"] === 10000),
        )
        .toBe(true);
      expect(f.run().story.dailyUnitMessages || 0, "editing setup must not change the existing world").toBe(0);
      await f.forge.evaluate((node, saved) => {
        const game = node as any;
        game._run = saved;
        game._activeRunId = saved.runId;
        game._creatingNew = false;
        game._hudView = "settings";
        game._settingsCategory = "continuity";
        game._renderKey = null;
        game._renderBrowser();
      }, f.saved());
      const setting = await countInput(f.forge);
      await expect(setting).toHaveValue("0");
      await setting.fill("10000");
      await setting.press("Tab");
      await expect.poll(() => f.run().story.dailyUnitMessages).toBe(10000);
      expect(f.run().story.choices).toBe(false);
      expect(f.run().story.preforge).toBe("off");
      await expect.poll(() => f.forge.evaluate((node) => (node as any)._forgeUnitMessagesSettingsPending)).toBe(0);
      await f.forge.locator('[data-view="advanced"]').click();
      await f.forge.locator('[data-view="continuity"]').click();
      await expect(await countInput(f.forge)).toHaveValue("10000");
      await page.screenshot({ path: testInfo.outputPath(`unit-messages-continuity-${theme}.png`) });
      await testInfo.attach("unit-message-setting-proof", {
        body: JSON.stringify(
          {
            requests: f.requests,
            savedStory: f.run().story,
            boundary: "Actual Sources/setup SDK; synthetic saved world.",
          },
          null,
          2,
        ),
        contentType: "application/json",
      });
    } finally {
      await f.runtime.close();
    }
  });

  test(`incoming messages preserve drafts, focus and scrollable history · ${theme}`, async ({ page }, testInfo) => {
    const f = await openForge(page, testInfo, theme);
    try {
      await page.clock.install();
      await page.clock.fastForward(130_000);
      expect(f.requests.filter((request) => request.path === "/chat/proactive/due")).toHaveLength(0);
      const setting = await countInput(f.forge);
      await setting.fill("3");
      await setting.press("Tab");
      await expect.poll(() => f.run().story.dailyUnitMessages).toBe(3);
      await expect.poll(() => f.forge.evaluate((node) => (node as any)._forgeUnitMessagesSettingsPending)).toBe(0);
      await f.forge.evaluate((node, unitId) => {
        const game = node as any;
        game._hudView = "home";
        game._renderBrowser();
        game._chatWith(unitId);
      }, f.unitId);
      const composer = f.forge.locator("[data-chat-text]");
      await expect(composer).toBeVisible();
      await composer.fill("A draft I am still writing.");
      const log = f.forge.locator("[data-chat-log]");
      const before = await settledChatGeometry(page, f.forge, true);
      expect(before.scrollHeight).toBeGreaterThan(before.clientHeight + 100);
      f.deliveries.push({ id: "controlled-incoming-1", text: "A saved spontaneous lighthouse check-in." });
      await page.clock.fastForward(60_001);
      await expect.poll(() => f.requests.filter((request) => request.path === "/chat/proactive/due").length).toBe(1);
      const notice = f.forge.locator(".gf-unit-message-notice");
      await expect(notice.getByText("Arden sent you a message.", { exact: true })).toBeVisible();
      await expect(composer).toHaveValue("A draft I am still writing.");
      await expect(composer).toBeFocused();
      expect(await log.evaluate((node) => node.scrollTop)).toBeCloseTo(before.top, 0);
      // The card previews the letter, but it stays out of the open conversation until the player reads it.
      await expect(notice.getByText("A saved spontaneous lighthouse check-in.", { exact: true })).toBeVisible();
      await expect(log.getByText("A saved spontaneous lighthouse check-in.", { exact: true })).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath(`unit-message-draft-notice-${theme}.png`) });
      await notice.getByRole("button", { name: "Read message", exact: true }).click();
      await expect(log.getByText("A saved spontaneous lighthouse check-in.", { exact: true })).toBeVisible();
      await expect(composer).toHaveValue("A draft I am still writing.");
      await composer.fill("");
      await composer.evaluate((node: HTMLTextAreaElement) => node.blur());
      await settledChatGeometry(page, f.forge, false);
      const older = await log.evaluate((node) => {
        node.scrollTop = 25;
        return node.scrollTop;
      });
      expect(older).toBeGreaterThan(0);
      f.deliveries.push({ id: "controlled-incoming-2", text: "The second saved spontaneous check-in." });
      await page.clock.fastForward(60_001);
      await expect
        .poll(() =>
          f.forge.evaluate(
            (node) =>
              ((node as any)._chat?.messages || []).filter((row: any) => row.id === "controlled-incoming-2").length,
          ),
        )
        .toBe(1);
      expect(await log.evaluate((node) => node.scrollTop)).toBeCloseTo(older, 0);
      await expect(composer).toHaveValue("");
      await expect(composer).not.toBeFocused();
      await expect(f.forge.getByText(/SAVED_LIGHTHOUSE_HISTORY_00/u)).toHaveCount(1);
      await log.evaluate((node) => (node.scrollTop = node.scrollHeight));
      await expect(f.forge.getByText("The second saved spontaneous check-in.", { exact: true })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`unit-message-history-${theme}.png`) });
      await testInfo.attach("unit-message-client-delivery-proof", {
        body: JSON.stringify(
          {
            requests: f.requests,
            before,
            older,
            boundary:
              "Installed client with fake browser clock and intercepted due responses. Incoming rows are seeded into the actual activated SDK fixture; Read uses its real chat/Open route. No real provider or physical device.",
          },
          null,
          2,
        ),
        contentType: "application/json",
      });
    } finally {
      await f.runtime.close();
    }
  });
}
