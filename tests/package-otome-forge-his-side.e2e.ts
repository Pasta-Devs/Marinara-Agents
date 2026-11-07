// Otome Hearth's his side (#2155) in the Engine's Home tab, with /api/otome-forge/** stubbed by the server's rules
// (S/story/his-side.ts): the chapter whose Closer opened Kai up ends with "Kai Ardent’s side of this now waits in
// Routes"; Routes shows his side under his route (its arc, the moment and the chapter, Read at 44 px or more and its
// one call); a slow Read shows no dialog but is busy and says it is opening, and a second tap claims nothing more; a
// failed claim opens the dialog, whose Try again keeps it open (showing the wait, focus inside) until the reader opens;
// the scene is titled as his side, with his thoughts and no choice; read, it leaves Routes and stays in the chapter
// list. At phone width (mobile-chromium, touch, 390 × 844, and 375 wide) and on the desktop, with no horizontal scroll.
// Run: node scripts/run-package-browser-tests.mjs otome-forge tests/package-otome-forge-his-side.e2e.ts
import { expect, test, type Locator, type Page } from "./fixtures/package-browser.ts";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("Set MARINARA_ENGINE_ROOT to a compatible Engine checkout");
const appVersion = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version;

type Json = Record<string, any>;
interface Call {
  method: string;
  path: string;
  body: Json | undefined;
}

const RUN = "r-e2e-side01";
const KAI = "li-kai-0001";
const MIR = "li-mireille-0002";
const SIDE = `side-${KAI}-1`;
const written = { at: "2026-11-07T10:00:00.000Z", connectionId: "conn-text", model: "fixture" };
const seg = (speaker: string, text: string, extra: Json = {}) => ({ speaker, text, ...extra });

const CHAPTERS: Record<string, Json> = {
  "main-1": {
    key: "main-1",
    kind: "main",
    number: 1,
    arc: 1,
    lead: KAI,
    title: "The Observatory",
    tags: [],
    summary: "A night under the dome.",
    nodes: [{ i: 0, kind: "closer" }],
    plannedAt: "2026-11-07T09:00:00.000Z",
  },
  [SIDE]: {
    key: SIDE,
    kind: "story",
    li: KAI,
    lead: KAI,
    title: "The Observatory",
    tags: [],
    summary: "",
    nodes: [{ i: 0, kind: "beat" }],
    plannedAt: "2026-11-07T10:05:00.000Z",
  },
};
const BEATS: Record<string, Json> = {
  "main-1": {
    key: "main-1",
    i: 0,
    kind: "beat",
    places: [{ name: "The Observation Room", tags: "glass dome, night" }],
    segments: [
      seg("", "Rain needles the glass dome.", { place: "The Observation Room" }),
      seg("Kai Ardent", "I’ve never told anyone that.", { expression: "tender" }),
    ],
    choices: [],
    choiceCanon: {},
    musicMood: "tender",
    readThrough: 0,
    written,
    rewrites: 0,
  },
  [SIDE]: {
    key: SIDE,
    i: 0,
    kind: "beat",
    places: [{ name: "The Observation Room", tags: "glass dome, night" }],
    segments: [
      seg("", "She came back. The dome is louder with her in it.", { place: "The Observation Room" }),
      seg("Kai Ardent", "Don’t look at her. Look at the lens.", { thought: true, expression: "flustered" }),
      seg("Kai Ardent", "I’ve never told anyone that.", { expression: "tender" }),
    ],
    choices: [],
    choiceCanon: {},
    musicMood: "tender",
    readThrough: 0,
    written,
    rewrites: 0,
  },
};

function createSideStub() {
  const calls: Call[] = [];
  const now = () => new Date().toISOString();
  // The first claim fails, as a dropped connection would.
  let claimFails = 1;
  const he = { subject: "he", object: "him", possessive: "his" };
  const she = { subject: "she", object: "her", possessive: "her" };
  const view: Json = {
    runKey: RUN,
    world: {
      version: 1,
      title: "The Clockwork Masquerade",
      premise: "A city of clockwork canals.",
      language: "English",
      createdAt: now(),
      setting: "",
      mystery: { question: "Who stopped the clocks?" },
      web: [],
      openingSituation: "",
      content: { heat: "sfw", darkness: "angst", limits: {}, custom: [] },
      // Ask before painting: the place cost says its picture waits for a tap.
      images: { connectionId: "conn-image", rating: "sfw", ask: true, expressions: true },
      connections: { narration: "conn-text" },
      forge: { phase: "ready", steps: [] },
      audio: { tts: false },
    },
    player: {
      personaId: "persona-mira",
      name: "Mira Vale",
      pronouns: she,
      traits: [],
      goal: "",
      look: { identityLine: "", outfitLine: "" },
    },
    lis: [
      { id: KAI, name: "Kai Ardent", pronouns: he, source: "archetype", accent: "#9DB8F0", level: 4, stage: 2 },
      { id: MIR, name: "Mireille", pronouns: she, source: "archetype", accent: "#E7A6B8", level: 1, stage: 1 },
    ],
    forge: { phase: "ready", steps: [] },
    starlight: 2000,
  };
  const index = {
    version: 1,
    runs: [{ runKey: RUN, title: "The Clockwork Masquerade", createdAt: now(), lastPlayedAt: null }],
    activeRun: RUN,
    ageGate: null,
    lastOpenedAt: null,
  };
  const planned = new Set(["main-1"]);
  const progress: Record<string, { beatsRead: number; completed: string | null }> = {
    "main-1": { beatsRead: 0, completed: null },
  };
  const served = new Set<string>();

  const entry = (key: string) => {
    const chapter = CHAPTERS[key]!;
    const read = progress[key] ?? { beatsRead: 0, completed: null };
    return {
      key,
      kind: chapter.kind,
      title: chapter.title,
      ...(chapter.li ? { li: chapter.li } : {}),
      lead: chapter.lead,
      state: read.completed ? "done" : "in-progress",
      beatsRead: read.beatsRead,
      nodes: chapter.nodes.length,
      ...(chapter.arc ? { arc: chapter.arc } : {}),
    };
  };
  // S/story/his-side.ts hisSideOffers: once the chapter is finished, until his side is read.
  const hisSides = () =>
    progress["main-1"]!.completed && !progress[SIDE]?.completed
      ? [
          {
            li: KAI,
            arc: 1,
            key: SIDE,
            moment: "opened",
            stage: 2,
            title: "The Observatory",
            reading: planned.has(SIDE),
          },
        ]
      : [];

  const answer = (call: Call): { status: number; json: unknown } => {
    calls.push(call);
    const path = call.path.replace(/^\/api\/otome-forge/u, "");
    const base = `/runs/${RUN}`;
    if (path === "/index" || path === "/index/opened") return { status: 200, json: { index } };
    if (path === base) return { status: 200, json: { view: structuredClone(view) } };
    if (path === `${base}/story`) {
      return {
        status: 200,
        json: {
          chapters: [...planned].map(entry),
          next: null,
          routes: [
            {
              li: KAI,
              stage: 2,
              next: { stage: 3, key: `route-${KAI}-3`, unlocked: false, requires: { level: 5 }, blockedBy: null },
            },
            {
              li: MIR,
              stage: 1,
              next: { stage: 2, key: `route-${MIR}-2`, unlocked: false, requires: { level: 3 }, blockedBy: null },
            },
          ],
          repairs: [],
          arc: null,
          arcChoice: null,
          prestige: [],
          hisSides: hisSides(),
        },
      };
    }
    if (path === `${base}/sides/${KAI}`) {
      if (call.body?.arc !== 1 || !progress["main-1"]!.completed) {
        return { status: 409, json: { error: "This side is not ready to read yet.", code: "locked" } };
      }
      if (claimFails > 0) {
        claimFails -= 1;
        return { status: 500, json: { error: "The connection dropped." } };
      }
      planned.add(SIDE);
      progress[SIDE] ??= { beatsRead: 0, completed: null };
      return { status: 200, json: { chapter: CHAPTERS[SIDE] } };
    }
    const chapterMatch = /^\/runs\/[^/]+\/chapters\/([^/]+)$/u.exec(path);
    if (chapterMatch && planned.has(decodeURIComponent(chapterMatch[1]!))) {
      const key = decodeURIComponent(chapterMatch[1]!);
      const read = progress[key]!;
      return {
        status: 200,
        json: {
          chapter: CHAPTERS[key],
          beats: [{ i: 0, state: read.beatsRead > 0 ? "read" : served.has(key) ? "ready" : "unwritten" }],
        },
      };
    }
    const beatMatch = /^\/runs\/[^/]+\/chapters\/([^/]+)\/beats\/0(?:\/(read))?$/u.exec(path);
    if (beatMatch && planned.has(decodeURIComponent(beatMatch[1]!))) {
      const key = decodeURIComponent(beatMatch[1]!);
      const beat = BEATS[key]!;
      if (!beatMatch[2]) {
        served.add(key);
        return { status: 200, json: { beat } };
      }
      const read = progress[key]!;
      const end = beat.segments.length - 1;
      beat.readThrough = Math.max(beat.readThrough, Math.min(end, call.body!.segment));
      if (call.body!.segment < end || read.completed) {
        return { status: 200, json: { grants: [], starlight: view.starlight, chapterDone: !!read.completed } };
      }
      read.beatsRead = 1;
      read.completed = now();
      view.starlight += 30;
      // The Closer opened him up: his side of arc 1 waits (S/story/beats.ts finishBeat).
      return {
        status: 200,
        json: {
          grants: [{ source: "beat", starlight: 30 }],
          starlight: view.starlight,
          chapterDone: true,
          ...(key === "main-1" ? { hisSide: KAI } : {}),
        },
      };
    }
    if (path === `${base}/cancel`) return { status: 200, json: { ok: true } };
    return { status: 404, json: { error: `No stub for ${call.method} ${call.path}`, code: "not-found" } };
  };
  return { calls, answer };
}

type Stub = ReturnType<typeof createSideStub>;

async function openStory(page: Page, stub: Stub): Promise<Locator> {
  await page.route("**/api/otome-forge/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { status, json } = stub.answer({
      method: request.method(),
      path: url.pathname,
      body: request.method() === "POST" ? request.postDataJSON() : undefined,
    });
    await route.fulfill({ status, json });
  });
  await page.addLocatorHandler(
    page
      .getByRole("dialog", { name: "Happy Halloween!", exact: true })
      .filter({ has: page.getByRole("button", { name: "Keep it", exact: true }) }),
    async (dialog) => {
      await dialog.getByRole("button", { name: "Keep it", exact: true }).click();
    },
  );
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await page.addInitScript((version) => {
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
  await page.getByRole("tab", { name: "Open Otome Hearth" }).click();
  const root = page.locator("marinara-capability-otome-forge .of-root");
  await expect(root).toBeVisible({ timeout: 60_000 });
  await root.getByRole("navigation", { name: "Game menu" }).getByRole("button", { name: "Story" }).click();
  await expect(root.getByRole("heading", { name: "Story", exact: true })).toBeVisible();
  return root;
}

/** Holds every request to `url` until the returned function is called. */
async function hold(page: Page, url: string) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route(url, async (route) => {
    await gate;
    await route.fallback();
  });
  return release;
}

const noWider = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );

/** Taps (or clicks) Next until the reader shows the chapter's end. */
async function readToEnd(root: Locator, press: (target: Locator) => Promise<void>) {
  const end = root.getByRole("heading", { name: "Chapter complete" });
  for (let step = 0; step < 12 && !(await end.isVisible()); step += 1) {
    const next = root.locator(".of-next");
    if (await next.isVisible()) {
      await expect(next).toHaveAttribute("data-done", "true");
      await press(next);
    } else await root.page().waitForTimeout(100);
  }
  await expect(end).toBeVisible();
}

test("Otome Hearth his side: announced at the chapter's end, waiting in Routes, read with no dialog, then in the list", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const mobile = testInfo.project.name.includes("mobile");
  await page.emulateMedia({ colorScheme: mobile ? "light" : "dark", reducedMotion: "reduce" });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const stub = createSideStub();
  const root = await openStory(page, stub);
  const press = (target: Locator) => (mobile ? target.tap() : target.click());

  // Nothing waits before the chapter is finished.
  const routes = root.getByRole("region", { name: "Routes" });
  await expect(routes).toBeVisible();
  await expect(routes.getByRole("group", { name: "Kai Ardent’s side" })).toHaveCount(0);

  // The chapter whose Closer opened him up ends with the news, in one line.
  await press(root.getByRole("button", { name: "Continue" }).first());
  await readToEnd(root, press);
  const news = root.locator(".of-arc-news").filter({ hasText: "Kai Ardent’s side of this now waits in Routes" });
  await expect(news).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("01-chapter-end.png") });
  await press(root.getByRole("button", { name: "Back to the story" }));

  // Routes: his side under his route, with its arc, the moment and the chapter, Read and its one call.
  const side = routes.getByRole("group", { name: "Kai Ardent’s side" });
  await expect(side).toBeVisible();
  await expect(side).toContainText("Arc 1");
  await expect(side).toContainText("Kai Ardent lets you in · “The Observatory”");
  await expect(side).toContainText("1 model call to write it · free to play");
  await expect(side).toContainText(
    "Paints its place only if it has no picture yet, once · each waits for you to tap Paint",
  );
  await expect(routes.getByRole("group", { name: "Mireille’s side" })).toHaveCount(0);
  const read = side.getByRole("button", { name: "Read Kai Ardent’s side of “The Observatory”" });
  const box = (await read.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  await side.scrollIntoViewIfNeeded();
  await noWider(page);
  await page.screenshot({ path: testInfo.outputPath("02-routes.png") });
  if (mobile) {
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(side).toBeVisible();
    await noWider(page);
    expect((await read.boundingBox())!.width).toBeLessThanOrEqual(375);
    await page.screenshot({ path: testInfo.outputPath("03-routes-375.png") });
  }

  // Read writes its chapter with no model call: no planning dialog shows while the request is slow, but Read is busy,
  // its status says it is opening, and a second tap claims nothing more.
  const claimUrl = `**/api/otome-forge/runs/${RUN}/sides/${KAI}`;
  const claims = () => stub.calls.filter((call) => call.method === "POST" && call.path.endsWith(`/sides/${KAI}`));
  const release = await hold(page, claimUrl);
  await press(read);
  await expect(read).toHaveAttribute("aria-busy", "true");
  await expect(read).toHaveAttribute("aria-disabled", "true");
  await expect(side.getByRole("status")).toHaveText("Opening Kai Ardent’s side…");
  // Forced, as a quick second tap lands whatever the button says.
  await (mobile ? read.tap({ force: true }) : read.click({ force: true }));
  await page.waitForTimeout(400);
  await expect(root.getByRole("dialog")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("04-opening.png") });
  release();

  // That claim fails: the dialog says so; Try again keeps it open, showing the wait with focus inside, until it opens.
  const dialog = root.getByRole("dialog", { name: "Kai Ardent’s side" });
  await expect(dialog.getByText("Something went wrong. Try again.")).toBeVisible();
  await expect.poll(() => claims().length).toBe(1);
  await expect(read).not.toHaveAttribute("aria-busy", "true");
  const releaseRetry = await hold(page, claimUrl);
  await press(dialog.getByRole("button", { name: "Try again" }));
  await expect(dialog.getByText("Opening Kai Ardent’s side…")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await noWider(page);
  await page.screenshot({ path: testInfo.outputPath("05-retrying.png") });
  releaseRetry();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => claims().length).toBe(2);
  expect(claims().map((call) => call.body?.arc)).toEqual([1, 1]);

  // The reader names it as his side, his thought shows, and it offers no choice.
  await expect(root.getByText("Kai Ardent’s side of “The Observatory”").first()).toBeVisible();
  await expect(root.getByText("Character story").first()).toBeVisible();
  await readToEnd(root, press);
  expect(stub.calls.some((call) => call.path.endsWith("/choose"))).toBe(false);
  await expect(root.locator(".of-arc-news")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("06-side-end.png") });
  await press(root.getByRole("button", { name: "Back to the story" }));

  // Read, it leaves Routes and stays in the chapter list, to replay.
  await expect(routes).toBeVisible();
  await expect(routes.getByRole("group", { name: "Kai Ardent’s side" })).toHaveCount(0);
  const list = root.locator(".of-chapters");
  await expect(list.getByRole("heading", { name: "Kai Ardent’s side of “The Observatory”" })).toBeVisible();
  await expect(list).toContainText("Character story · with Kai Ardent");
  await noWider(page);
  expect(pageErrors).toEqual([]);
});
