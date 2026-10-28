import { expect, test, type Locator } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("Set MARINARA_ENGINE_ROOT to the validated Engine checkout");
const version = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version;
const nativeImport = new Function("url", "return import(url)");
async function optionsGeometry(forge: Locator) {
  // A state refresh can replace the inner group; resolve it in the same browser task as its layout read.
  const result = await forge.evaluate((node) => {
    const group = (node as any)._root.querySelector(".gf-story-options") as HTMLElement | null;
    if (!group?.isConnected) throw new Error("Paired story settings are not attached");
    const boxes = [...group.querySelectorAll(".ob-bx")].map((button) => {
      const box = button.getBoundingClientRect();
      return {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        visual: getComputedStyle(button, "::before").width,
      };
    });
    return { boxes, width: group.getBoundingClientRect().width, scrollWidth: group.scrollWidth };
  });
  expect(result.boxes).toHaveLength(2);
  for (const box of result.boxes) {
    expect(Math.round(box.width)).toBeGreaterThanOrEqual(44);
    expect(Math.round(box.height)).toBeGreaterThanOrEqual(44);
    expect(box.visual).toBe("24px");
  }
  expect(Math.abs(result.boxes[0]!.y - result.boxes[1]!.y)).toBeLessThan(2);
  expect(result.boxes[1]!.x).toBeGreaterThan(result.boxes[0]!.x + 44);
  expect(result.scrollWidth).toBeLessThanOrEqual(result.width + 1);
  return result;
}
for (const theme of ["dark", "light"]) {
  test(`Story events setup, Continuity, opt-in and archived reread in ${theme}`, async ({ page }, testInfo) => {
    const {
      createChapterRuntime,
      chapterRunId: runId,
      chapterUnitId: unitId,
      freshMainPlan,
    } = await nativeImport(pathToFileURL(resolve(__dirname, "fixtures/gacha-forge-chapter-runtime.mjs")).href);
    const f = await createChapterRuntime();
    // This successful-generation fixture leaves room for the required 8192-token output window.
    f.transport.maxContext = 262144;
    try {
      for (const [id] of f.docs)
        if (id.startsWith(`${runId}:chapter:2`) || id.startsWith(`${runId}:beat:2:`)) f.docs.delete(id);
      const run = f.docs.get("index").data.runs[0];
      run.story.seasonalEvents = true;
      f.session().progress = { 1: { normal: 10 } };
      delete f.session().reading;
      const overview = {
        title: "The Lantern Crossing",
        theme: "A winter festival of promises.",
        premise: "Friends keep the coast's old promise.",
        cast: [unitId],
        special: "character",
        rewards: { funds: 5000, aether: 320, insight: 6 },
      };
      f.transport.reply = (body: any) => {
        const system = String(body.messages?.[0]?.content || "");
        if (system.includes("substantial, self-contained seasonal story event")) return JSON.stringify(overview);
        if (system.includes("You are the chapter planner"))
          return JSON.stringify({ ...freshMainPlan, title: "The crossing begins" });
        return JSON.stringify({
          segments: [{ speaker: "Arden", text: "We keep the promise together.", place: "Lighthouse" }],
          places: [],
          choices: [],
        });
      };
      const prepared = await f.post("/story-events", { runId });
      expect(prepared.body.ok).toBe(true);
      // Controlled prepainted media exercises the real banner view without image-provider credits.
      f.docs.get(`${runId}:story-event:1`).data.art =
        "data:image/svg+xml," +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect width="960" height="540" fill="#162438"/><circle cx="480" cy="220" r="100" fill="#e9c879"/></svg>',
        );
      const requests: { path: string; body: any }[] = [];
      const actualState = await (await fetch(f.origin + "/state")).json();
      const saved = {
        ...run,
        events: actualState.activeRun.events,
        name: "Seasonal UI proof",
        hudStyle: "vanguard",
        hasStandardBanner: true,
        storyUnwritten: false,
        storyDeferred: false,
        progress: structuredClone(f.session().progress),
        audio: { tts: false, generate: false, muted: true },
      };
      await page.setViewportSize(
        testInfo.project.name.includes("mobile") ? { width: 874, height: 402 } : { width: 1440, height: 900 },
      );
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.addInitScript(
        ({ version, theme }) => {
          localStorage.setItem("marinara:whats-new:seen-version", version);
          localStorage.setItem(
            "marinara-engine-ui",
            JSON.stringify({
              state: {
                theme,
                hasCompletedOnboarding: true,
                sidebarOpen: false,
                rightPanelOpen: false,
                chibiProfessorMariEnabled: false,
              },
              version: 65,
            }),
          );
        },
        { version, theme },
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
              activeRunId: runId,
              activeRun: saved,
              guidesSeen: ["welcome", "home", "settings", "continuity", "chapter", "beat", "events", "chapters"],
            },
          });
        if (
          path.startsWith("/story-event") ||
          path.startsWith("/preforge") ||
          path === "/beat/mark" ||
          path === "/story/cancel" ||
          path === "/run/sources" ||
          path === "/formation" ||
          path === "/login"
        ) {
          const body = route.request().postDataJSON();
          requests.push({ path, body });
          const result = await f.post(path, body);
          return route.fulfill({ status: result.status, json: result.body });
        }
        return route.fulfill({
          json:
            path === "/setup/draft"
              ? { ok: true, draft: null }
              : { ok: true, chapters: [], locations: [], memory: { phase: "ready", retryable: false } },
        });
      });
      await page.goto("/");
      const later = page.getByRole("button", { name: "Not now", exact: true });
      if (await later.isVisible()) await later.click();
      await page.getByRole("tab", { name: "Open Gacha Forge" }).click();
      const forge = page.locator("marinara-capability-gacha-forge");
      await expect.poll(() => forge.evaluate((node) => (node as any)._boot)).toBe("ready");
      await forge.evaluate((node, saved) => {
        const game = node as any;
        game._clearBeat();
        game._run = saved;
        game._bannerReady = true;
        game._artReady = true;
        game._guidesSeen = new Set([
          "welcome",
          "home",
          "settings",
          "continuity",
          "chapter",
          "beat",
          "events",
          "chapters",
        ]);
        game._guide = "";
        game._hudView = "settings";
        game._settingsCategory = "continuity";
        game._continuity = [];
        game._continuityState = "ready";
        game._renderBrowser();
      }, saved);
      await expect(forge.locator("[data-forge-seasonal-events]")).toHaveAttribute("aria-checked", "true");
      await optionsGeometry(forge);
      const seasonalToggle = forge.locator("[data-forge-seasonal-events]");
      await seasonalToggle.click();
      await expect(seasonalToggle).toHaveAttribute("aria-checked", "false");
      await seasonalToggle.click();
      await expect(seasonalToggle).toHaveAttribute("aria-checked", "true");
      expect(f.docs.get("index").data.runs[0].story.choices).toBe(false);
      await page.screenshot({ path: testInfo.outputPath(`seasonal-continuity-${theme}.png`) });
      if (testInfo.project.name.includes("mobile")) {
        await page.setViewportSize({ width: 390, height: 844 });
        const portraitGeometry = await optionsGeometry(forge);
        await page.screenshot({ path: testInfo.outputPath(`seasonal-continuity-portrait-${theme}.png`) });
        // A wider platform font can wrap only one heading; the paired controls must stay aligned.
        await forge.evaluate((node) => {
          const style = document.createElement("style");
          style.dataset.seasonalFontFallback = "";
          style.textContent = ".gf-story-options h3 {font-family:Arial,sans-serif;font-stretch:normal;}";
          (node as any)._root.append(style);
        });
        const headingText = await forge.locator(".gf-story-options .hd h3").evaluateAll((nodes) =>
          nodes.map((node) => {
            const range = document.createRange();
            range.selectNodeContents(node);
            return { height: range.getBoundingClientRect().height, lines: range.getClientRects().length };
          }),
        );
        expect(headingText[1]!.height).toBeGreaterThan(headingText[0]!.height);
        expect(headingText[1]!.lines).toBeGreaterThan(headingText[0]!.lines);
        const fallbackGeometry = await optionsGeometry(forge);
        const geometryPath = testInfo.outputPath("paired-settings-portrait-geometry.json");
        writeFileSync(geometryPath, JSON.stringify({ portraitGeometry, headingText, fallbackGeometry }, null, 2));
        await testInfo.attach("paired-settings-portrait-geometry", {
          path: geometryPath,
          contentType: "application/json",
        });
        await page.screenshot({ path: testInfo.outputPath(`seasonal-continuity-fallback-font-${theme}.png`) });
        await forge.evaluate((node) => (node as any)._root.querySelector("[data-seasonal-font-fallback]")?.remove());
        await page.setViewportSize({ width: 874, height: 402 });
      }
      // Worlds → New, using the normal saved setup-draft contract.
      await forge.evaluate((node) => {
        const game = node as any;
        game._run = null;
        game._activeRunId = null;
        game._creatingNew = true;
        game._setupDraftAsked = true;
        game._setupDraftSettled = true;
        game._setupDraft = {
          step: 4,
          furthest: 7,
          personaId: "fixture-persona",
          values: {
            scenario: "A synthetic coast.",
            connectionId: "fixture-text",
            "story.choices": true,
            "story.seasonalEvents": false,
          },
        };
        game._renderKey = null;
        game._renderBrowser();
      });
      await expect(forge.locator('[data-field="story.seasonalEvents"]')).toBeVisible();
      await optionsGeometry(forge);
      await forge.locator('[data-field="story.seasonalEvents"]').scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`seasonal-setup-${theme}.png`) });
      if (testInfo.project.name.includes("mobile")) {
        await page.setViewportSize({ width: 390, height: 844 });
        await optionsGeometry(forge);
        await forge.locator('[data-field="story.seasonalEvents"]').scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath(`seasonal-setup-portrait-${theme}.png`) });
        await page.setViewportSize({ width: 874, height: 402 });
      }
      await forge.evaluate((node, saved) => {
        const game = node as any;
        game._run = saved;
        game._activeRunId = saved.runId;
        game._creatingNew = false;
        game._hudView = "events";
        game._eventId = "login";
        game._renderKey = null;
        game._renderBrowser();
      }, saved);
      const rail = forge.locator('[data-event="story-events"]');
      await expect(rail).toBeVisible();
      await rail.click();
      await expect(rail).toHaveAttribute("aria-pressed", "true");
      const card = forge.locator('[data-story-event-card="event-1"]');
      await expect(card.getByRole("heading", { name: "The Lantern Crossing" })).toBeVisible();
      expect(
        f.calls.filter((call: any) => String(call.body.messages?.[0]?.content).includes("SEASONAL EVENT:")).length,
      ).toBe(0);
      await expect(card.locator("[data-story-event-banner] img")).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`seasonal-events-${theme}.png`) });
      await card.locator("[data-story-event-open]").click();
      await expect.poll(() => requests.filter((row) => row.path === "/story-event/plan").length).toBeGreaterThan(0);
      // The event's pre-forge asks the main route with its event key (pre-forge is Off in this fixture).
      await expect.poll(() => requests.find((row) => row.path === "/preforge/start")?.body.chapter).toBe("event-1");
      expect(requests.some((row) => row.path === "/story-event/preforge")).toBe(false);
      await expect(forge.locator("[data-play]").first()).toBeVisible();
      await forge.locator("[data-play]").first().click();
      await expect.poll(() => requests.filter((row) => row.path === "/story-event/beat").length).toBeGreaterThan(0);
      await expect(forge.getByText("We keep the promise together.", { exact: true })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`seasonal-story-${theme}.png`) });
      // 1.27.0: a finished, live event opens its fights on Hard. It is seeded as a played world holds it: every node
      // played, each fight designed on Normal, a team and the protagonist's signature weapon, so a Hard fight makes
      // no provider request.
      const skill = {
        name: "Lighthouse strike",
        effect: "damage",
        power: 100,
        target: "enemy",
        description: "A strike.",
      };
      const hero = {
        ...f.docs.get(unitId).data,
        name: "Arden",
        role: "Mage",
        affinity: "Water",
        position: "front",
        stats: { hp: 100, atk: 100, def: 100, spd: 100 },
        skill,
      };
      f.docs.get(unitId).data = hero;
      const leader = `${runId}:unit:protagonist`,
        weapon = `${runId}:unit:protagonist-weapon`;
      f.seed(leader, "unit", { ...hero, name: "Mari", cardId: "", isProtagonist: true });
      f.seed(weapon, "unit", {
        kind: "weapon",
        name: "Kept blade",
        rarity: 5,
        weaponType: "blade",
        mainStat: { key: "atk", value: 1 },
        subStat: { key: "crit", value: 0 },
      });
      const session = f.session();
      Object.assign(session.roster, {
        [unitId]: { ...session.roster[unitId], level: 100 },
        [leader]: { level: 100, bondFights: 0, weapon },
        [weapon]: { level: 1, bondFights: 0 },
      });
      session.presets = [{ name: "Fixture team", board: { front: [unitId, null, null], back: [null, null, null] } }];
      session.activePreset = 0;
      session.progress["event-1"] = { normal: 10 };
      for (const combatIndex of [0, 1, 2])
        f.seed(`${runId}:combat:event-1:${combatIndex}`, "combat", {
          chapter: "event-1",
          combatIndex,
          enemy: "Clockwork sentinel",
          tier: "soldier",
          opening: "The festival's practice guard awakens.",
          objective: "Win the friendly trial.",
          outcomeOnWin: "The lantern procession continues.",
          formation: [
            {
              name: "Clockwork sentinel",
              role: "Warrior",
              affinity: "Fire",
              position: "front",
              stats: { hp: 10, atk: 10, def: 10, spd: 10 },
              skill,
              tier: "soldier",
              anonymous: true,
            },
          ],
        });
      const hardCalls = f.calls.length;
      await forge.evaluate((node) => {
        const game = node as any;
        game._clearBeat();
        game._forgeSeasonalState = null;
        game._forgeSeasonalLoading = false;
        game._hudView = "chapters";
        game._renderKey = null;
        game._renderBrowser();
      });
      const done = forge.locator('[data-chapters-list] > [data-story-event-open="event-1"]');
      await expect(done).toContainText("Story event · Done");
      await expect(done.locator(".diffs span")).toHaveText(["N", "H", "V"]);
      await page.screenshot({ path: testInfo.outputPath(`seasonal-done-hard-${theme}.png`) });
      await done.getByRole("button", { name: /Enter event/u }).click();
      await expect.poll(() => forge.evaluate((node) => (node as any)._planChapter)).toBe("event-1");
      await expect(forge.locator('[data-diff="hard"]')).toBeEnabled();
      await expect(forge.locator('[data-diff="veryhard"]')).toBeDisabled();
      await forge.locator('[data-diff="hard"]').click();
      await expect(forge.locator(".node-row")).toHaveCount(3);
      await expect(forge.locator(".diff-hint")).toContainText("Recommended BP 3,000");
      await page.screenshot({ path: testInfo.outputPath(`seasonal-hard-map-${theme}.png`) });
      await forge.locator(".node-row.current [data-start]").click();
      await forge.locator("[data-into-battle]").click();
      await expect
        .poll(() => requests.findLast((row) => row.path === "/story-event/battle")?.body)
        .toMatchObject({ chapter: "event-1", combatIndex: 0, difficulty: "hard" });
      const hardStart = forge.locator("button.fstart[data-start]");
      await expect(hardStart).toBeEnabled();
      await hardStart.click();
      await expect
        .poll(() => requests.findLast((row) => row.path === "/story-event/battle/start")?.body)
        .toMatchObject({ chapter: "event-1", combatIndex: 0, difficulty: "hard" });
      await expect
        .poll(() => f.session().progress["event-1"].hard || f.session().combatPending?.difficulty)
        .toBeTruthy();
      expect(f.calls.length).toBe(hardCalls);
      await page.screenshot({ path: testInfo.outputPath(`seasonal-hard-fight-${theme}.png`) });
      await forge.evaluate((node) => (node as any)._stopCombat?.());
      // Archive is the actual played beat. Expire only its immutable event deadline; no fabricated story text.
      const eventDoc = f.docs.get(`${runId}:story-event:1`);
      eventDoc.data.endsAt = Date.now() - 1000;
      f.session().progress["event-1"] = { normal: 1 };
      await forge.evaluate((node) => {
        const game = node as any;
        game._clearBeat();
        game._forgeSeasonalState = null;
        game._forgeSeasonalLoading = false;
        game._hudView = "chapters";
        game._renderKey = null;
        game._renderBrowser();
      });
      // Since 1.26.3 a played event sits in the chapter timeline after the chapter it followed, not below it.
      const played = forge.locator('[data-chapters-list] > [data-story-event-open="event-1"]');
      await expect(played.getByRole("heading", { name: "The Lantern Crossing", exact: true })).toBeVisible();
      await expect(played).toContainText("Story event · Ended");
      await page.screenshot({ path: testInfo.outputPath(`seasonal-archive-${theme}.png`) });
      await played.getByRole("button").click();
      await expect.poll(() => forge.evaluate((node) => (node as any)._planChapter)).toBe("event-1");
      await expect(forge.locator("[data-start]").first()).toBeDisabled();
      await forge.locator('[data-replay="0"]').click();
      await expect(forge.getByText("We keep the promise together.", { exact: true })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`seasonal-archive-reread-${theme}.png`) });
      const replay = await f.post("/story-event/beat", { runId, chapter: "event-1", storyIndex: 0 });
      expect(replay.body.ok).toBe(true);
      await testInfo.attach("seasonal-route-proof", {
        body: JSON.stringify(
          {
            requests,
            engineCommit: (await (await page.request.get("/api/health")).json()).commit,
            provider: "controlled SDK transport only",
          },
          null,
          2,
        ),
        contentType: "application/json",
      });
      // UI frame probe only: inject a controlled failure after every real event assertion.
      // The SDK capacity boundary is covered separately; this must generate no new provider request.
      const providerCalls = f.calls.length;
      await forge.evaluate((node) => {
        const game = node as any;
        game._clearBeat();
        game._hudView = "chapter";
        game._plan = null;
        game._planState = "error";
        game._planEscaped = false;
        game._storyUnwritten = false;
        game._forgeFailure = {
          error: "generation-output-capacity",
          detail: JSON.stringify({
            minimumOutputTokens: 8192,
            availableContextTokens: 7343,
            configuredMaxOutputTokens: 4096,
          }),
        };
        game._renderKey = null;
        game._renderBrowser();
      });
      await expect(forge.locator(".forge-status")).toHaveText("Generation needs more output space.");
      const capacity = forge.locator(".forge-error");
      await expect(capacity).toBeVisible();
      for (const expected of ["This generation", "8192", "7343", "4096", "context size", "Max Output Tokens Override"])
        await expect(capacity).toContainText(expected);
      await expect(capacity).not.toContainText(/couldn't be read|availableContextTokens|configuredMaxOutputTokens/i);
      await expect(forge.locator(".forge-why")).toBeHidden();
      await expect(forge.locator(".forge-why")).toHaveText("");
      await expect(forge.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`generation-capacity-frame-${theme}.png`) });
      expect(f.calls.length).toBe(providerCalls);
      await testInfo.attach("generation-capacity-ui-frame-proof", {
        body: JSON.stringify({ scope: "Controlled installed UI frame only", newSdkProviderCalls: 0 }),
        contentType: "application/json",
      });
    } finally {
      await f.close();
    }
  });
}
