import { expect, test, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("Set MARINARA_ENGINE_ROOT to the validated Engine checkout");
const version = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version;
const nativeImport = new Function("url", "return import(url)");
async function optionsGeometry(forge: Locator) {
  const result = await forge.locator(".gf-story-options").evaluate((group) => {
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
          path === "/beat/mark" ||
          path === "/story/cancel" ||
          path === "/run/sources" ||
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
              : path === "/preforge"
                ? { ok: true, preforge: { mode: "off", locked: false } }
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
        await optionsGeometry(forge);
        await page.screenshot({ path: testInfo.outputPath(`seasonal-continuity-portrait-${theme}.png`) });
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
      await expect(forge.locator("[data-play]").first()).toBeVisible();
      await forge.locator("[data-play]").first().click();
      await expect.poll(() => requests.filter((row) => row.path === "/story-event/beat").length).toBeGreaterThan(0);
      await expect(forge.getByText("We keep the promise together.", { exact: true })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`seasonal-story-${theme}.png`) });
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
      const archive = forge.locator("[data-story-event-archive]");
      await expect(
        archive
          .locator('[data-story-event-card="event-1"]')
          .getByRole("heading", { name: "The Lantern Crossing", exact: true }),
      ).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`seasonal-archive-${theme}.png`) });
      await archive.locator('[data-story-event-open="event-1"]').click();
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
    } finally {
      await f.close();
    }
  });
}
