// Otome Forge's Story screen and reader (M2a) in the Engine's Home tab, with /api/otome-forge/** stubbed: the Lead
// dialog, a dark chapter's content tags, faces line by line, her thoughts and his, a choice and "{name} will remember
// that.", the keys after a click on the dialogue box or the stage, the backlog star, an end of a beat that was not
// saved (Next sends it again, nothing loops, Ease off comes back), → from the Next button, the declined panel and
// Retry, Ease off with "Veil this from now on" (neither closes while its request runs), a big choice, Ease off gone
// once the scene's end is saved, the chapter's Starlight and affection with focus on its heading; then a replay at
// reduced motion that changes nothing, whose Ease off on a branch puts no line it skips in the backlog, and a chapter
// with no title in the reader and on the Story screen; and the waits (#2040, #2041): "What happened so far…" while a
// chapter is planned, and Who said what? while a scene is written, on a phone and a desktop; and a side-with choice
// (#2046), marked as one, each option naming whom it backs, with the affection it moved for each love interest.
// Run: node scripts/run-package-browser-tests.mjs otome-forge tests/package-otome-forge-reader.e2e.ts
import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeForgeAudio } from "../sources/forge-kit/audio-settings.mjs";

const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("Set MARINARA_ENGINE_ROOT to a compatible Engine checkout");
const appVersion = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version;

type Json = Record<string, any>;
interface Call {
  method: string;
  path: string;
  body: Json | undefined;
}

const RUN = "r-e2e-abc123";
const ILVAR = "li-ilvar-0001";
const CASSIAN = "li-cassian-0002";
const seg = (speaker: string, text: string, extra: Json = {}) => ({ speaker, text, ...extra });
const written = { at: "2026-10-28T10:00:00.000Z", connectionId: "conn-text", model: "fixture" };

/** Three nodes: a beat with a small choice, a call the model declines once, and a Confrontation ending on a big choice. */
const BEATS: Json[] = [
  {
    key: "main-1",
    i: 0,
    kind: "beat",
    places: [{ name: "The Observation Room", tags: "glass dome, night" }],
    segments: [
      seg("", "Rain needles the glass dome.", { place: "The Observation Room" }),
      seg("Ilvar Thorne", "You came back. How inefficient of you.", { expression: "cold" }),
      seg("Mira Vale", "I should have stayed away. I didn’t.", { thought: true }),
      seg("Ilvar", "…don’t leave again.", { thought: true, expression: "tender" }),
      seg("Ilvar", "Stay, then. The data can wait.", { expression: "tender" }),
    ],
    choices: [
      {
        id: "choice-1",
        kind: "small",
        at: 2,
        options: [
          {
            id: "option-1",
            text: "Tell him the truth.",
            selection: { kind: "dialogue", text: "I came because you were alone up here." },
            segments: [seg("Ilvar", "That is— an unscientific reason.", { expression: "flustered" })],
          },
          {
            id: "option-2",
            text: "Shrug it off.",
            selection: { kind: "action", text: "You lift one shoulder, as if it hardly matters." },
            segments: [seg("Ilvar", "Of course. Curiosity.", { expression: "hurt" })],
          },
        ],
      },
    ],
    choiceCanon: {},
    musicMood: "tense",
    readThrough: 0,
    written,
    rewrites: 0,
  },
  {
    key: "main-1",
    i: 1,
    kind: "moment",
    places: [{ name: "Your room", tags: "night" }],
    segments: [
      seg("", "Past midnight, your phone lights up.", { place: "Your room" }),
      seg("Ilvar Thorne", "Who was he?", { expression: "angry" }),
      seg("Mira Vale", "You don’t get to ask me that."),
    ],
    choices: [],
    choiceCanon: {},
    musicMood: "angst",
    readThrough: 0,
    written,
    rewrites: 0,
  },
  {
    key: "main-1",
    i: 2,
    kind: "confrontation",
    places: [{ name: "The Observation Room", tags: "dawn" }],
    segments: [
      seg("", "The dome again. He hasn’t slept."),
      seg("Ilvar Thorne", "I would rather hear it from you than guess.", { expression: "hurt" }),
    ],
    choices: [
      {
        id: "choice-1",
        kind: "big",
        at: 1,
        options: [
          {
            id: "option-1",
            text: "Stay with him.",
            selection: { kind: "dialogue", text: "I’m still here." },
            segments: [],
          },
          {
            id: "option-2",
            text: "Walk away.",
            selection: { kind: "action", text: "You leave the key." },
            segments: [],
          },
        ],
      },
    ],
    choiceCanon: {},
    musicMood: "confession",
    readThrough: 0,
    written,
    rewrites: 0,
  },
];

const CHAPTER = {
  key: "main-1",
  kind: "main",
  number: 1,
  lead: ILVAR,
  foil: CASSIAN,
  title: "The Observation Room",
  tags: ["possessiveness", "threats"],
  summary: "A night under the dome.",
  nodes: [
    { i: 0, kind: "beat" },
    { i: 1, kind: "moment", moment: "call" },
    { i: 2, kind: "confrontation" },
  ],
  plannedAt: "2026-10-28T09:59:00.000Z",
};

/** The story so far (#2040): long enough to scroll on any screen. */
const SO_FAR = Array.from(
  { length: 24 },
  (_, i) =>
    `SO-FAR-${i + 1}: Mira climbed to the observatory again, and Ilvar Thorne pretended not to have waited for her while the clockwork canals turned below.`,
);
/** Who said what? (#2041): the server's shuffled batch. */
const WSW_LINES = [
  { li: ILVAR, text: "You came back. How inefficient of you." },
  { li: CASSIAN, text: "The canal ices over every winter, without fail." },
  { li: ILVAR, text: "Stay, then. The data can wait until morning." },
  { li: CASSIAN, text: "I kept your letters in the clock tower drawer." },
];
/** Story memory statuses (GET /runs/:run/memory/status): a summary that failed at its provider, and memory at rest. */
const failedMemory = (message: string): Json => ({
  phase: "error",
  retryable: true,
  reason: "generation-failed",
  recordCount: 1,
  message,
  noConnection: false,
  unsummarized: 1,
});
const MEMORY_READY: Json = { phase: "ready", retryable: false, recordCount: 2, noConnection: false, unsummarized: 0 };
const CONTEXT_ERROR =
  "This model's maximum context length is 8192 tokens. However, your messages resulted in 12034 tokens.";
/** A failed summary's banner text, and a Retry request that fails itself (503 no-connection) in the player's words. */
const MEMORY_FAILED = "A story summary failed, so the cast may not remember everything yet.";
const RETRY_REFUSED = "No connection is set for this. Choose one in Settings.";

/** Makes every Retry request (POST .../memory/retry) fail itself while `refuse()` says so; the stub answers it again after. */
async function refuseRetry(page: Page, refuse: () => boolean = () => true) {
  await page.route("**/api/otome-forge/runs/*/memory/retry", (route) =>
    refuse()
      ? route.fulfill({
          status: 503,
          json: { error: "No connection is set to summarize the story with.", code: "no-connection" },
        })
      : route.fallback(),
  );
}

/**
 * The M2a story routes, answered in memory by the server's rules (S/story/beats.ts). `waits` answers the story so far
 * and Who said what?; without it they are 404s, as on a run with nothing to show, and the waits look as before.
 * `memory` is the story memory's status (GET .../memory/status), which Retry turns pending until `setMemory` settles
 * it, and which a saved connection (POST .../settings) takes out of waiting for one; without it the status is a 404
 * and no banner shows.
 */
function createStoryStub({
  done = false,
  title = CHAPTER.title,
  pendingCutouts = false,
  storyBeats = BEATS,
  waits = false,
  memory = null as Json | null,
} = {}) {
  const calls: Call[] = [];
  const now = () => new Date().toISOString();
  const limits: Json = {
    "violence-others": "allow",
    gore: "veil",
    threats: "allow",
    captivity: "veil",
    manipulation: "allow",
    stalking: "veil",
    "violence-to-protagonist": "line",
    torture: "veil",
    "self-harm": "veil",
    "dubious-consent": "line",
    "non-consent": "line",
    pregnancy: "line",
  };
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
      content: { heat: "sfw", darkness: "angst", limits, custom: [] },
      images: { connectionId: null, rating: "sfw", ask: false, expressions: true },
      connections: { narration: "conn-text" },
      forge: { phase: "ready", steps: [] },
      audio: { ...normalizeForgeAudio({}), chapterThemes: false, tracks: [] },
    },
    player: {
      personaId: "persona-mira",
      name: "Mira Vale",
      pronouns: { subject: "she", object: "her", possessive: "her" },
      traits: [],
      goal: "",
      look: { identityLine: "", outfitLine: "" },
    },
    lis: [
      {
        id: ILVAR,
        name: "Ilvar Thorne",
        pronouns: { subject: "he", object: "him", possessive: "his" },
        source: "card",
        accent: "#9DB8F0",
        level: 2,
        stage: 2,
      },
      {
        id: CASSIAN,
        name: "Cassian",
        pronouns: { subject: "he", object: "him", possessive: "his" },
        source: "archetype",
        accent: "#E7A6B8",
        level: 1,
        stage: 1,
      },
    ],
    forge: { phase: "ready", steps: [] },
    starlight: 2000,
  };
  const image = (colour: string) =>
    `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="64"><rect width="32" height="64" fill="${colour}"/></svg>`)}`;
  const previousCutout = image("#9DB8F0");
  const correctedCutout = image("#E7A6B8");
  if (pendingCutouts) {
    view.cutoutsPending = true;
    view.lis[0].portrait = previousCutout;
    view.lis[0].cut = [previousCutout];
  }
  const index = {
    version: 1,
    runs: [{ runKey: RUN, title: "The Clockwork Masquerade", createdAt: now(), lastPlayedAt: null }],
    activeRun: RUN,
    ageGate: null,
    lastOpenedAt: null,
  };
  let chapter: Json | null = done ? { ...structuredClone(CHAPTER), title } : null;
  const beats = new Map<number, Json>();
  const progress = { beatsRead: done ? 3 : 0, completed: done ? now() : (null as string | null) };
  let declined = done;
  // The first report of beat 0's end fails, as when the Engine restarts.
  let endFails = !done;
  let favorites: Json[] = [];
  let memoryStatus = memory;
  if (done) {
    for (const stored of storyBeats) {
      const copy = structuredClone(stored);
      copy.readThrough = copy.segments.length - 1;
      for (const choice of copy.choices) copy.choiceCanon[choice.id] = "option-1";
      beats.set(copy.i, copy);
    }
  }

  const finish = (i: number) => {
    if (i !== progress.beatsRead || progress.completed)
      return { grants: [], starlight: view.starlight, chapterDone: !!progress.completed };
    progress.beatsRead += 1;
    const grants: Json[] = [{ source: "beat", starlight: 30 }];
    view.starlight += 30;
    if (progress.beatsRead === CHAPTER.nodes.length) {
      progress.completed = now();
      grants.push(
        { source: "chapter", starlight: 160 },
        { source: "lead", li: ILVAR, affection: 150 },
        { source: "foil", li: CASSIAN, affection: 60 },
      );
      view.starlight += 160;
      view.lis[0].level = 3;
    }
    return { grants, starlight: view.starlight, chapterDone: !!progress.completed };
  };

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
          chapters: chapter
            ? [
                {
                  key: "main-1",
                  kind: "main",
                  title,
                  lead: ILVAR,
                  state: progress.completed ? "done" : "in-progress",
                  beatsRead: progress.beatsRead,
                  nodes: 3,
                },
              ]
            : [],
          next:
            chapter && !progress.completed
              ? null
              : {
                  kind: "main",
                  number: chapter ? 2 : 1,
                  candidates: [
                    { li: CASSIAN, reason: "least-recent" },
                    { li: ILVAR, reason: "ripe-conflict" },
                  ],
                },
        },
      };
    }
    if (path === `${base}/chapters/next`) {
      chapter = { ...structuredClone(CHAPTER), title, lead: call.body!.lead };
      return { status: 200, json: { chapter } };
    }
    if (path === `${base}/chapters/main-1`) {
      return {
        status: 200,
        json: {
          chapter,
          beats: CHAPTER.nodes.map(({ i }) => ({
            i,
            state: i < progress.beatsRead ? "read" : beats.has(i) ? "ready" : "unwritten",
          })),
        },
      };
    }
    if (path === `${base}/veil`) {
      for (const id of call.body!.limits) if (limits[id] === "allow") limits[id] = "veil";
      return { status: 200, json: { world: structuredClone(view.world) } };
    }
    if (path === `${base}/favorites`) {
      const { keep = true, ...favorite } = call.body!;
      const kept = favorites.some((item) => item.ref === favorite.ref);
      if (kept !== keep) {
        favorites = keep
          ? [...favorites, { at: now(), ...favorite }]
          : favorites.filter((item) => item.ref !== favorite.ref);
      }
      return { status: 200, json: { favorites } };
    }
    if (path === `${base}/cancel`) return { status: 200, json: { ok: true } };
    if (memoryStatus && path === `${base}/memory/status`) return { status: 200, json: { status: memoryStatus } };
    if (memoryStatus && path === `${base}/memory/retry`) {
      memoryStatus = { ...memoryStatus, phase: "pending", retryable: false };
      delete memoryStatus.message;
      return { status: 200, json: { status: memoryStatus } };
    }
    if (memoryStatus && path === `${base}/settings` && call.method === "POST") {
      view.world.connections = call.body!.connections;
      memoryStatus = { ...memoryStatus, noConnection: false };
      return { status: 200, json: { world: structuredClone(view.world) } };
    }
    if (waits && path === `${base}/memory/overview`) return { status: 200, json: { paragraphs: SO_FAR } };
    if (waits && path === `${base}/who-said-what`) {
      return { status: 200, json: { choices: [ILVAR, CASSIAN], lines: WSW_LINES } };
    }
    const match = /^\/runs\/[^/]+\/chapters\/main-1\/beats\/(\d+)(?:\/(choose|read|ease-off))?$/u.exec(path);
    if (match) {
      const i = Number(match[1]);
      if (!match[2]) {
        if (!beats.has(i)) {
          if (i === 1 && !declined) {
            declined = true;
            return { status: 422, json: { error: "Refused twice.", code: "declined" } };
          }
          beats.set(i, structuredClone(storyBeats[i]!));
        }
        return { status: 200, json: { beat: beats.get(i) } };
      }
      const beat = beats.get(i)!;
      if (match[2] === "choose") {
        const remembered = !beat.choiceCanon[call.body!.choice];
        beat.choiceCanon[call.body!.choice] ??= call.body!.option;
        // #2046: a side-with pick moves affection (S/state/relationship.ts): +30 for the one backed, −10 for the others.
        const side = remembered && beat.sideWith?.choice === call.body!.choice ? beat.sideWith : null;
        const backed = side?.backs[call.body!.option];
        const affection = side
          ? Object.values(side.backs as Record<string, string>).map((li) => ({ li, amount: li === backed ? 30 : -10 }))
          : [];
        const rememberedBy = side ? Object.values(side.backs) : remembered ? [ILVAR] : [];
        return { status: 200, json: { beat, remembered, rememberedBy, affection } };
      }
      if (match[2] === "read") {
        const end = beat.easedOff?.at ?? beat.segments.length - 1;
        const reached = Math.min(end, call.body!.segment);
        beat.readThrough = Math.max(beat.readThrough, reached);
        const settled = beat.choices.every((choice: Json) => choice.at > end || beat.choiceCanon[choice.id]);
        if (reached < end || (!beat.easedOff && !settled))
          return { status: 200, json: { grants: [], starlight: view.starlight, chapterDone: false } };
        if (i === 0 && endFails) {
          endFails = false;
          return { status: 500, json: { error: "The Engine is restarting." } };
        }
        return { status: 200, json: finish(i) };
      }
      const at = Math.min(beat.segments.length - 1, call.body!.segment);
      beat.easedOff = { at };
      const read = finish(i);
      return {
        status: 200,
        json: { beat, veilSuggestions: CHAPTER.tags.filter((tag) => limits[tag] === "allow"), ...read },
      };
    }
    return { status: 404, json: { error: `No stub for ${call.method} ${call.path}`, code: "not-found" } };
  };
  return {
    calls,
    answer,
    previousCutout,
    correctedCutout,
    finishCutouts() {
      delete view.cutoutsPending;
      view.lis[0].portrait = correctedCutout;
      view.lis[0].cut = [correctedCutout];
    },
    setMemory(next: Json) {
      memoryStatus = next;
    },
  };
}

async function stubRoutes(page: Page, stub: ReturnType<typeof createStoryStub>) {
  await page.route("**/api/connections", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          json: [
            { id: "conn-text", name: "Story fixture", provider: "custom", model: "fixture", isDefault: "true" },
            { id: "conn-other", name: "Other fixture", provider: "custom", model: "fixture-2" },
          ],
        })
      : route.continue(),
  );
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
}

async function openStory(page: Page): Promise<Locator> {
  // Engine's calendar greeting can appear after startup. Keep its theme through the normal, specific dialog action.
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

const posts = (stub: ReturnType<typeof createStoryStub>, suffix: string) =>
  stub.calls.filter((call) => call.method === "POST" && call.path.endsWith(suffix));

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

/**
 * Goes on once the line has typed itself out. It waits rather than reading data-done once and pressing to show the
 * line whole: a line that finished between that read and the press made the press go on, and the second one a step
 * too far (CI's real-Engine runner).
 */
async function next(root: Locator) {
  await setReaderControlsExpanded(root, false);
  const button = root.locator(".of-next");
  await expect(button).toHaveAttribute("data-done", "true");
  await button.click();
}

const line = (root: Locator) => root.locator(".of-dialogue .of-line");

async function setReaderControlsExpanded(root: Locator, expanded = true) {
  const more = root.getByRole("button", { name: "More reader controls" });
  if ((await more.isVisible()) && (await more.getAttribute("aria-expanded")) !== String(expanded)) await more.click();
}

/** The same with the keyboard (→), from the focused Next button (or wherever focus is). */
async function nextByKey(page: Page, root: Locator, fromNext = true) {
  const button = root.locator(".of-next");
  if (fromNext) await button.focus();
  await expect(button).toHaveAttribute("data-done", "true");
  await page.keyboard.press("ArrowRight");
}

test("Otome Forge reader: a stubbed chapter with faces, thoughts, a remembered choice, the backlog, a refusal, Ease off and a big choice", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const stub = createStoryStub({ memory: MEMORY_READY });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubRoutes(page, stub);
  const root = await openStory(page);
  await expect(root.getByRole("img", { name: "Ilvar Thorne: affection level 2 of 10" })).toBeVisible();

  // Who walks with you: the two candidates and why each is offered.
  await root.getByRole("button", { name: "Choose who leads" }).click();
  const lead = page.getByRole("dialog", { name: "Who walks with you this chapter?" });
  await expect(lead).toContainText("You haven’t walked with Cassian in a while.");
  await expect(lead).toContainText("Something between you and Ilvar Thorne is still unresolved.");
  // No arc covers chapter 1 yet: the server plans the arc before the chapter.
  await expect(lead).toContainText("2 model calls on your planning connection");
  await page.screenshot({ path: testInfo.outputPath("01-lead.png") });
  await lead.getByRole("button", { name: /Ilvar Thorne/ }).click();
  expect(posts(stub, "/chapters/next")[0]!.body).toMatchObject({ lead: ILVAR });

  // A dark chapter opens with its tags; nothing is written before Begin.
  await expect(root.getByRole("heading", { name: "Before you begin" })).toBeVisible();
  await expect(root.getByRole("list", { name: "In this chapter" })).toContainText("Possessiveness");
  expect(posts(stub, "/beats/0")).toHaveLength(0);
  await root.getByRole("button", { name: "Begin" }).click();

  // Faces line by line (initials and a labelled face without art); her thought in pale italics; his rare thought.
  await expect(line(root)).toContainText("Rain needles the glass dome.");
  await expect(root.getByRole("heading", { level: 1 })).toContainText("The Observation Room");
  // A press while the line types shows it whole and goes no further. Pressed and read back in one task (React applies a
  // press in microtasks, before any timer can type on), so it never races the typing; a runner too slow to catch the
  // line typing skips it.
  const pressed = await root.locator(".of-next").evaluate(async (button: HTMLElement) => {
    if (button.dataset.done === "true") return null;
    button.click();
    for (let turn = 0; turn < 5; turn += 1) await Promise.resolve();
    const rest = button.closest(".of-dialogue")?.querySelector(".of-line-rest");
    return { done: button.dataset.done, typing: !!rest };
  });
  if (pressed) expect(pressed).toEqual({ done: "true", typing: false });
  await expect(line(root)).toContainText("Rain needles the glass dome.");
  // A click on the dialogue box goes on, and the keys still work after it: focus stays in the reader.
  await expect(root.locator(".of-next")).toHaveAttribute("data-done", "true");
  await line(root).click();
  await expect(root.getByRole("img", { name: "Ilvar Thorne, cold" })).toBeVisible();
  await expect(root.locator(".of-nameplate")).toHaveText("Ilvar Thorne");
  await expect(root.locator(".of-reader")).toBeFocused();
  await nextByKey(page, root, false);
  await expect(root.locator(".of-line--thought")).toContainText("I should have stayed away.");
  await page.screenshot({ path: testInfo.outputPath("02-thought.png") });

  // A first-play choice is saved, and "Ilvar Thorne will remember that." rises over the scene.
  const choice = root.getByRole("group", { name: "What do you do?" });
  await choice.getByRole("button", { name: "Tell him the truth." }).click();
  await expect(root.getByText("Ilvar Thorne will remember that.")).toBeVisible();
  expect(posts(stub, "/choose")[0]!.body).toMatchObject({ choice: "choice-1", option: "option-1" });
  await expect(line(root)).toContainText("I came because you were alone up here.");
  await page.screenshot({ path: testInfo.outputPath("03-remembered.png") });
  await nextByKey(page, root);
  await expect(root.getByRole("img", { name: "Ilvar Thorne, flustered" })).toBeVisible();
  // So does a click on the stage.
  await expect(root.locator(".of-next")).toHaveAttribute("data-done", "true");
  await root.locator(".of-reader-stage").click();
  await expect(root.locator(".of-line--his-thought")).toContainText("don’t leave again");
  await nextByKey(page, root, false);
  // The end of the beat is not saved: the reader says so, stays, and sends it again only when Next is pressed.
  await expect(root.getByRole("alert")).toContainText("The end of this scene wasn’t saved. Press Next to try again.");
  const endReports = () => posts(stub, "/beats/0/read").filter((call) => call.body?.segment === 4).length;
  await page.waitForTimeout(300);
  expect(endReports()).toBe(1);
  await expect(line(root)).toContainText("Stay, then.");
  await setReaderControlsExpanded(root);
  await expect(root.getByRole("button", { name: "Ease off" }), "the scene is not counted as read yet").toBeVisible();

  // The backlog keeps a favourite line.
  await root.getByRole("button", { name: "Backlog" }).click();
  const backlog = page.getByRole("dialog", { name: "Backlog" });
  await backlog.getByRole("button", { name: "Keep this line" }).first().click();
  await expect(backlog.getByRole("button", { name: "Keep this line" }).first()).toHaveAttribute("aria-pressed", "true");
  expect(posts(stub, "/favorites")[0]!.body).toMatchObject({
    ref: "main-1/0r0/0",
    text: "Rain needles the glass dome.",
    keep: true,
  });
  await backlog.getByRole("button", { name: "Close" }).click();

  // Next sends the end again; once it is saved, the next scene opens. The model declines the call once: the honest
  // panel, then Retry.
  await next(root);
  await expect(root.getByText("+30 Starlight")).toBeVisible();
  expect(endReports()).toBe(2);
  await expect(root.getByRole("heading", { name: "Your model declined this scene" })).toBeVisible();
  await expect(root.getByRole("button", { name: "Switch connection" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("04-declined.png") });
  await root.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(line(root)).toContainText("Past midnight");
  await expect(root.getByText("A call", { exact: true })).toBeVisible();

  // Ease off: no model call, then "Veil this from now on" for the tags still allowed. While either request runs, Keep
  // reading and Not now leave the dialog open.
  const writes = posts(stub, "/beats/1").length;
  const easing = await hold(page, "**/beats/1/ease-off");
  await setReaderControlsExpanded(root);
  await root.getByRole("button", { name: "Ease off" }).click();
  const ease = page.getByRole("dialog", { name: "Ease off?" });
  // The scene written ahead followed the uncut one, so it is written again: the cost note says so.
  await expect(ease).toContainText("If the model already wrote the next scene ahead, it writes that scene again");
  await ease.getByRole("button", { name: "Ease off" }).click();
  await ease.getByRole("button", { name: "Keep reading" }).click({ force: true });
  await expect(ease).toBeVisible();
  await expect(line(root)).toContainText("Past midnight");
  easing();
  const veil = page.getByRole("dialog", { name: "Veil this from now on?" });
  await veil.getByRole("checkbox", { name: "Threats" }).check();
  const veiling = await hold(page, "**/veil");
  await veil.getByRole("button", { name: "Veil it" }).click();
  await veil.getByRole("button", { name: "Not now" }).click({ force: true });
  await expect(veil).toBeVisible();
  veiling();
  await expect(veil).toBeHidden();
  expect(posts(stub, "/veil")[0]!.body).toMatchObject({ limits: ["threats"] });
  expect(posts(stub, "/beats/1").length).toBe(writes);
  await expect(line(root)).toContainText("The moment passes.");

  // The Confrontation ends on a big choice; the chapter's end shows its Starlight and affection.
  await next(root);
  await expect(line(root)).toContainText("The dome again.");
  // Enter on the Next button still goes on.
  await expect(root.locator(".of-next")).toHaveAttribute("data-done", "true");
  await root.locator(".of-next").focus();
  await page.keyboard.press("Enter");
  await expect(line(root)).toContainText("I would rather hear it from you than guess.");
  const big = root.getByRole("group", { name: "A choice that lasts" });
  await expect(big).toContainText("It can’t be undone.");
  // A choice waiting at the last line keeps Ease off; once the scene's end is saved, the server would refuse it.
  await setReaderControlsExpanded(root);
  const easeOff = root.getByRole("button", { name: "Ease off" });
  await expect(easeOff).toBeVisible();
  await setReaderControlsExpanded(root, false);
  await big.getByRole("button", { name: "Stay with him." }).click();
  await expect(line(root)).toContainText("I’m still here.");
  await expect.poll(() => posts(stub, "/beats/2/read").length).toBeGreaterThan(0);
  await expect(easeOff).toHaveCount(0);
  await expect(root.getByRole("button", { name: "Ease off", includeHidden: true })).toHaveCount(0);
  // A finished chapter queues its summary: the memory banner asks for the status at once, not at its 30 s poll.
  const memoryReads = () => stub.calls.filter((call) => call.method === "GET" && call.path.endsWith("/memory/status"));
  const readsBefore = memoryReads().length;
  await next(root);
  await expect(root.getByRole("heading", { name: "Chapter complete" })).toBeFocused();
  await expect.poll(() => memoryReads().length, { timeout: 2_000 }).toBeGreaterThan(readsBefore);
  await expect(root.getByText("+160 Starlight")).toBeVisible();
  await expect(root.getByText("Ilvar Thorne · +150 affection")).toBeVisible();
  await expect(root.getByText("Level 3!")).toBeVisible();
  // No click or focus scrolled the stage out of place: the frame and the reader clip, they are not scroll containers.
  const scrolled = await root.evaluate((element) =>
    [element, ...element.querySelectorAll(".of-frame, .of-stage, .of-stage-body, .of-reader, .of-reader-stage")]
      .filter((box) => box.scrollTop || box.scrollLeft)
      .map((box) => box.className),
  );
  expect(scrolled).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("05-chapter-end.png") });
  await root.getByRole("button", { name: "Back to the story" }).click();
  await expect(root.getByText("2,250")).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("Otome Hearth waits: What happened so far… while a chapter is planned, Who said what? while a scene is written", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const mobile = testInfo.project.name.includes("mobile");
  await page.emulateMedia({ colorScheme: mobile ? "light" : "dark", reducedMotion: "reduce" });
  const stub = createStoryStub({ waits: true });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubRoutes(page, stub);
  const root = await openStory(page);
  const size = page.viewportSize()!;
  const noSideways = async (width: number) =>
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  const press = (target: Locator) => (mobile ? target.tap() : target.click());
  const tall = async (target: Locator) => expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  // Planning the chapter: the status and Cancel, with the story so far in its own labelled scroll region.
  const planning = await hold(page, "**/chapters/next");
  await root.getByRole("button", { name: "Choose who leads" }).click();
  const lead = page.getByRole("dialog", { name: "Who walks with you this chapter?" });
  await lead.getByRole("button", { name: /Ilvar Thorne/ }).click();
  const status = lead.getByRole("status");
  await expect(status).toContainText("Planning chapter 1 with Ilvar Thorne…");
  const cancel = lead.getByRole("button", { name: "Cancel" });
  await expect(cancel).toBeFocused();
  const soFar = lead.getByRole("region", { name: "What happened so far…" });
  await expect(soFar).toContainText(SO_FAR[0]!);
  await expect(soFar.locator("p")).toHaveCount(SO_FAR.length);
  await expect(lead.getByRole("heading", { name: "What happened so far…" })).toBeVisible();
  await expect(status, "the summary is never announced as status").not.toContainText("SO-FAR");
  // By keyboard: it is the stop before Cancel, and End scrolls it.
  await page.keyboard.press("Shift+Tab");
  await expect(soFar).toBeFocused();
  await page.keyboard.press("End");
  await expect.poll(() => soFar.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await page.keyboard.press("Home");
  await expect.poll(() => soFar.evaluate((element) => element.scrollTop)).toBe(0);
  if (!mobile) {
    await soFar.hover();
    await page.mouse.wheel(0, 400);
    await expect.poll(() => soFar.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  }
  await expect(status).toBeInViewport({ ratio: 1 });
  await expect(cancel).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: testInfo.outputPath("01-so-far.png") });
  // A narrow phone: the status and Cancel stay on screen, nothing scrolls sideways.
  await page.setViewportSize({ width: 320, height: 568 });
  await expect(status).toBeInViewport({ ratio: 1 });
  await expect(cancel).toBeInViewport({ ratio: 1 });
  await noSideways(320);
  await page.screenshot({ path: testInfo.outputPath("02-so-far-320.png") });
  await page.setViewportSize(size);

  // The scene is written: Who said what? waits under the panel, and takes no focus.
  const writing = await hold(page, "**/chapters/main-1/beats/0");
  planning();
  await root.getByRole("button", { name: "Begin" }).click();
  const panel = root.locator(".of-writing");
  await expect(panel).toContainText("Writing the next scene…");
  const play = root.getByRole("button", { name: "Play Who said what?" });
  await expect(play).toBeVisible();
  // Focus stays where the reader put it (its title, as before this game existed).
  await expect(root.locator(".of-reader-title")).toBeFocused();
  await expect(play).not.toBeFocused();
  await tall(play);
  await page.screenshot({ path: testInfo.outputPath("03-play.png") });

  // By keyboard: the line takes focus, a love interest is picked with Enter, the answer is read out, Next goes on.
  await play.click();
  const game = root.getByRole("region", { name: "Who said what?" });
  const quote = game.locator(".of-wsw-line");
  await expect(quote).toBeFocused();
  await expect(quote).toContainText(WSW_LINES[0]!.text);
  // The quote shows a focus ring only to a keyboard player (Play was a pointer press).
  const ring = () => quote.evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(await ring()).toBe("none");
  const choices = game.getByRole("list", { name: "Who said what?" }).getByRole("button");
  await expect(choices).toHaveText(["Ilvar Thorne", "Cassian"]);
  for (const choice of await choices.all()) await tall(choice);
  await page.keyboard.press("Tab");
  await expect(choices.first()).toBeFocused();
  await page.keyboard.press("Enter");
  const verdict = game.getByRole("status");
  await expect(verdict).toHaveText("Right! Ilvar Thorne said it.");
  const nextLine = game.getByRole("button", { name: "Next line" });
  await expect(nextLine).toBeFocused();
  await tall(nextLine);
  expect(await game.locator(".of-rh-verdict").evaluate((element) => getComputedStyle(element).animationName)).toBe(
    "none",
  );
  expect(posts(stub, "/who-said-what"), "nothing is sent").toHaveLength(0);
  await page.keyboard.press("Enter");
  await expect(quote).toBeFocused();
  expect(await ring(), "a keyboard player sees where focus went").toBe("solid");
  await expect(quote).toContainText(WSW_LINES[1]!.text);
  await expect(verdict).toHaveText("");

  // By pointer (a tap on a phone): a wrong pick says who really said it, and keeps the tally.
  await press(choices.first());
  await expect(verdict).toHaveText("Not quite. Cassian said it.");
  await expect(game).toContainText("1 of 2 right");
  await expect(choices.first()).toHaveAttribute("data-state", "wrong");
  await expect(choices.last()).toHaveAttribute("data-state", "true");
  await page.screenshot({ path: testInfo.outputPath("04-wrong.png") });

  // A narrow phone: no sideways scroll, Cancel stays on screen, every choice can be reached.
  await page.setViewportSize({ width: 320, height: 568 });
  await press(nextLine);
  await expect(quote).toContainText(WSW_LINES[2]!.text);
  await noSideways(320);
  expect(await game.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(panel.getByRole("button", { name: "Cancel" })).toBeInViewport({ ratio: 1 });
  await press(choices.last());
  await expect(verdict).toHaveText("Not quite. Ilvar Thorne said it.");
  for (const choice of await choices.all()) {
    await choice.scrollIntoViewIfNeeded();
    await expect(choice).toBeInViewport({ ratio: 1 });
  }
  await page.screenshot({ path: testInfo.outputPath("05-game-320.png") });
  await page.setViewportSize(size);

  // The scene arrives: the game goes at once, and focus lands on the story.
  writing();
  await expect(line(root)).toContainText("Rain needles the glass dome.");
  await expect(root.locator(".of-wsw")).toHaveCount(0);
  await expect(play).toHaveCount(0);
  await expect(root.locator(".of-next")).toBeFocused();
  expect(stub.calls.filter((call) => call.path.endsWith("/who-said-what"))).toHaveLength(1);
  expect(pageErrors).toEqual([]);
});

// Meaningful alpha silhouettes replace the old 2x2 any-transparent-pixel fixture.
const SPEAKER_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAACAAAAAwCAYAAABwrHhvAAAAdElEQVR4nO3UwQ3AIAxDUYZlWLaiE5DGoVGg+gefkOwnhGij91aZ0vGvALMCMI2kA6xxGZExLiEAZI27EVfdAAAF4e6LAN4QUlcUsELIPQCOBkR+PvlxAgAAAAAAABZgF+TqBQBgF+A5AwAAAID/AFJSDngAseuGfqFuDUUAAAAASUVORK5CYII=";
const BUST_SPEAKER_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAARElEQVR4nO3OsQkAIAwAQUdzGId1LMFCSKxDmiu+/ht7rZGaxYVfngNUzz8EQMc8IAC65g8B0Dm/AQAAAAAAAAAAtAMO2xYxamYZDbgAAAAASUVORK5CYII=";
const CORNER_SPEAKER_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAOElEQVR4nO3XsREAIBACQYr9Yu1KHZvAYIOL2ZSsmdx2qTTHXwAAAAAAAAAAAAAAAAAAXwCq9/wAQGM4m/KQm6AAAAAASUVORK5CYII=";
const MARGIN_SPEAKER_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAOUlEQVR4nO3OwQkAIAwEwRSbYu1KWxAkHMI89r1Tq7uSRecAAAC3gP0YAAAAAAAAwP+A0QAAAOKAA55OP2qkAtg9AAAAAElFTkSuQmCC";
const FAINT_MARGIN_SPEAKER_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAO0lEQVR4nO3OwQkAIAwAsbprh3UrdYUiUoQ87n2JmTlO0VXbGAAAoAJYlwEAAAAAAAD8D3gaAABAO2ADrmo/axi39IwAAAAASUVORK5CYII=";
const OPAQUE_SPEAKER_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAADklEQVR4nGNg+A+FMAYAQ84H+fei4u8AAAAASUVORK5CYII=";
const LI_SPEAKER_PORTRAIT = `data:image/png;base64,${SPEAKER_PNG}`;

function namedSpeakerStub(segments: Json[]) {
  const fixture = createStoryStub({
    done: true,
    storyBeats: [{ ...BEATS[0], segments, choices: [] }, ...BEATS.slice(1)],
  });
  return {
    ...fixture,
    answer(call: Call) {
      const reply = fixture.answer(call);
      if (call.path === `/api/otome-forge/runs/${RUN}`) {
        const data = reply.json as Json;
        data.view.lis[0].portrait = LI_SPEAKER_PORTRAIT;
        data.view.lis[0].cut = [LI_SPEAKER_PORTRAIT];
      }
      return reply;
    },
  };
}

async function speakerRoutes(
  page: Page,
  { opaque = false, revision = 2, broken = false, source = opaque ? OPAQUE_SPEAKER_PNG : SPEAKER_PNG } = {},
) {
  const cleanup: Json[] = [];
  const paid: string[] = [];
  let deleted = false;
  page.on("request", (request) => {
    if (/\/api\/(?:characters\/avatar-generation|audio\/generate|generate\/raw)/u.test(request.url()))
      paid.push(request.url());
  });
  await page.route("**/api/characters/catalog?**", (route) => {
    const items = [
      { id: "card-arin", name: "Arin Vale" },
      { id: "card-one", name: "Duplicated Name" },
      { id: "card-two", name: "Duplicated Name" },
    ];
    return route.fulfill({ json: { items, hasMore: false } });
  });
  await page.route("**/api/characters/card-arin", (route) =>
    route.fulfill({
      status: deleted ? 404 : 200,
      json: deleted ? { error: "Deleted card" } : { id: "card-arin", data: JSON.stringify({ name: "Arin Vale" }) },
    }),
  );
  await page.route("**/api/sprites/card-arin", (route) =>
    route.fulfill({
      json: [
        { expression: "neutral", filename: "neutral.png" },
        { expression: "full_angry", filename: "full_angry.png", url: "https://untrusted.test/ignored" },
        {
          expression: "full_neutral",
          filename: "full_neutral.png",
          url: "/api/sprites/card-arin/file/full_neutral.png?v=1",
        },
      ],
    }),
  );
  await page.route("**/api/sprites/card-arin/file/*", (route) =>
    route.fulfill({
      status: broken ? 404 : 200,
      contentType: "image/png",
      body: broken ? "Missing sprite" : Buffer.from(source, "base64"),
    }),
  );
  await page.route("**/api/sprites/cleanup/status", (route) => route.fulfill({ json: { cleanupRevision: revision } }));
  await page.route("**/api/sprites/cleanup", (route) => {
    cleanup.push(route.request().postDataJSON());
    return route.fulfill({ json: { cells: [{ base64: SPEAKER_PNG }] } });
  });
  return {
    cleanup,
    paid,
    removeCard: () => {
      deleted = true;
    },
  };
}

test("Otome Hearth narration does not preview a love interest before his first reached turn", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const opening = [
    seg("", "You wrench your left wrist against Maukie's brass tension pick."),
    seg("", "Three tumblers click. The pick has sheared."),
    seg("Maukie Escher", "Scratch one Fontainian lockpick. Did the Doctor wire my pulse?", { thought: true }),
    seg("", "Overhead klaxons sound as a fire-bulkhead closes in front of Dottore's outstretched glass."),
    seg("", "Beneath satin slippers, the platform rises up the shaft."),
    seg("", "Cold axle grease streaks the platform as it passes the lower wards."),
    seg("", "With a heavy clang, the platform locks into a stone bay. Amber lamps. Sweet clove smoke through a grate."),
    seg("", "Beyond the bars, Pantalone waits beside black-liveried guards and an armored sleigh, cigarette in hand."),
    seg("", "The gate slides back, and you pitch into his coat."),
    seg("", "Pantalone's gloved hands catch you."),
  ];
  const fixture = namedSpeakerStub([
    ...opening,
    seg("Pantalone", "There you are. Let me see your wrist."),
    seg("", "He keeps his coat around your shoulders."),
  ]);
  await stubRoutes(page, {
    ...fixture,
    answer(call: Call) {
      const reply = fixture.answer(call);
      if (call.path === `/api/otome-forge/runs/${RUN}`) {
        const data = reply.json as Json;
        data.view.player.name = "Maukie Escher";
        data.view.lis[0].name = "Pantalone";
        data.view.lis[1].name = "Dottore";
      }
      return reply;
    },
  });
  const assets = await speakerRoutes(page);
  const root = await openStory(page);
  await root.getByRole("button", { name: "Replay: The Observation Room" }).click();
  await root.getByRole("button", { name: "Begin" }).click();
  for (const [index, segment] of opening.entries()) {
    if (index) await next(root);
    await expect(line(root)).toContainText(segment.text);
    await expect(root.locator(".of-reader-stage .of-face")).toHaveCount(0);
  }
  await next(root);
  await expect(root.getByRole("img", { name: "Pantalone", exact: true })).toBeVisible();
  await expect(root.locator('.of-face-img[data-front="true"]')).toHaveAttribute("src", LI_SPEAKER_PORTRAIT);
  await next(root);
  await expect(line(root)).toContainText("He keeps his coat around your shoulders.");
  await expect(root.getByRole("img", { name: "Pantalone", exact: true })).toBeVisible();
  expect(assets.paid).toEqual([]);
});

test("Otome Hearth named speakers hide unrelated sprites, require unique cards and preserve narration, persona and thoughts", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const fixture = namedSpeakerStub([
    seg("Ilvar Thorne", "The love interest speaks."),
    seg("No Matching Card", "A stranger speaks."),
    seg("Arin Vale", "An existing character speaks."),
    seg("Duplicated Name", "A duplicate name speaks."),
    seg("", "The narrator continues."),
    seg("Mira Vale", "The protagonist answers."),
    seg("No Matching Card", "A private thought.", { thought: true }),
    seg("Ilvar Thorne", "The love interest speaks again."),
    seg("Arin Vale", "The same card was deleted meanwhile."),
  ]);
  await stubRoutes(page, fixture);
  const assets = await speakerRoutes(page);
  const catalogFinished = () =>
    page
      .waitForResponse((response) => {
        const url = new URL(response.url());
        return url.pathname === "/api/characters/catalog" && url.searchParams.get("limit") === "200";
      })
      .then((response) => response.finished());
  const root = await openStory(page);
  await root.getByRole("button", { name: "Replay: The Observation Room" }).click();
  await root.getByRole("button", { name: "Begin" }).click();
  await expect(root.locator('.of-face-img[data-front="true"]')).toHaveAttribute("src", LI_SPEAKER_PORTRAIT);
  const stranger = catalogFinished();
  await next(root);
  await stranger;
  await expect(line(root)).toContainText("A stranger speaks.");
  await expect(root.locator(".of-reader-stage .of-face")).toHaveCount(0);
  await next(root);
  await expect(root.getByRole("img", { name: "Arin Vale", exact: true })).toBeVisible();
  await expect(root.locator('.of-face-img[data-front="true"]')).toHaveAttribute(
    "src",
    "/api/sprites/card-arin/file/full_neutral.png?v=1",
  );
  await expect(root.locator('.of-face-img[data-front="true"]')).toHaveAttribute("data-cut", "true");
  await page.screenshot({ path: testInfo.outputPath("named-speaker.png") });
  const duplicate = catalogFinished();
  await next(root);
  await duplicate;
  await expect(line(root)).toContainText("A duplicate name speaks.");
  await expect(root.locator(".of-reader-stage .of-face")).toHaveCount(0);
  for (const text of [
    "The narrator continues.",
    "The protagonist answers.",
    "A private thought.",
    "The love interest speaks again.",
  ]) {
    await next(root);
    await expect(line(root)).toContainText(text);
    await expect(root.locator('.of-face-img[data-front="true"]')).toHaveAttribute("src", LI_SPEAKER_PORTRAIT);
  }
  assets.removeCard();
  const deleted = page
    .waitForResponse((response) => response.url().endsWith("/api/characters/card-arin") && response.status() === 404)
    .then((response) => response.finished());
  await next(root);
  await deleted;
  await expect(line(root)).toContainText("The same card was deleted meanwhile.");
  await expect(root.locator(".of-reader-stage .of-face")).toHaveCount(0);
  expect(assets.cleanup, "already transparent card sprites stay untouched").toEqual([]);
  expect(assets.paid).toEqual([]);
});

for (const colorScheme of ["dark", "light"] as const) {
  test(`Otome Hearth story header describes scenes only while no character sprite is in use (${colorScheme})`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme });
    const segments = [
      seg("", "Rain reaches the empty observation room.", { place: "The Observation Room" }),
      seg("Ilvar Thorne", "The love interest arrives.", { expression: "cold" }),
      seg("", "The narrator keeps him on stage."),
      seg("Mira Vale", "The protagonist thinks.", { thought: true }),
      seg("Ilvar", "His own private thought.", { thought: true }),
      seg("Arin Vale", "A matching character speaks."),
      seg("No Matching Card", "A stranger has no sprite."),
      seg("Cassian", "An unpainted love interest speaks."),
      seg("Ilvar", "The painted love interest returns."),
      seg("Ilvar", "The key moment replaces the character."),
    ];
    const fixture = createStoryStub({
      done: true,
      storyBeats: [
        {
          ...BEATS[0],
          segments,
          choices: [],
          cg: {
            at: 9,
            brief: "Two figures under the glass dome.",
            cast: ["Ilvar Thorne"],
            art: { state: "ready", at: written.at, url: LI_SPEAKER_PORTRAIT },
          },
        },
        ...BEATS.slice(1),
      ],
    });
    await stubRoutes(page, {
      ...fixture,
      answer(call: Call) {
        const reply = fixture.answer(call);
        if (call.path === `/api/otome-forge/runs/${RUN}`) {
          const view = (reply.json as Json).view;
          // Neither image-generation availability nor the expression toggle disables retained sprites.
          view.world.images.expressions = false;
          view.world.places = {
            "the-observation-room": { name: "The Observation Room", tags: "glass dome, night" },
          };
          view.lis[0].portrait = LI_SPEAKER_PORTRAIT;
          view.lis[0].worn = { id: "his-wardrobe-0-f", url: LI_SPEAKER_PORTRAIT };
          view.lis[0].cut = [LI_SPEAKER_PORTRAIT];
        }
        return reply;
      },
    });
    const assets = await speakerRoutes(page);
    const root = await openStory(page);
    await expect(root).toHaveAttribute("data-look", colorScheme === "dark" ? "midnight" : "pearl");
    await root.getByRole("button", { name: "Replay: The Observation Room" }).click();
    await root.getByRole("button", { name: "Begin" }).click();
    const description = root.locator(".of-reader-head .of-image-description");
    await expect(line(root)).toContainText(segments[0]!.text);
    await expect(root.locator(".of-reader-stage .of-face")).toHaveCount(0);
    await expect(description).toContainText("glass dome, night");
    for (const segment of segments.slice(1, 5)) {
      await next(root);
      await expect(line(root)).toContainText(segment.text);
      await expect(root.locator('.of-face-img[data-front="true"]')).toHaveAttribute("src", LI_SPEAKER_PORTRAIT);
      await expect(description).toHaveCount(0);
    }
    await page.screenshot({ path: testInfo.outputPath(`story-header-sprite-${colorScheme}.png`) });
    const release = await hold(page, "**/api/characters/catalog?**");
    try {
      await next(root);
      await expect(line(root)).toContainText(segments[5]!.text);
      await expect(root.locator(".of-reader-stage .of-face")).toHaveCount(0);
      await expect(description).toContainText("glass dome, night");
    } finally {
      release();
    }
    await expect(root.getByRole("img", { name: "Arin Vale", exact: true })).toBeVisible();
    await expect(description).toHaveCount(0);
    for (const segment of segments.slice(6, 8)) {
      await next(root);
      await expect(line(root)).toContainText(segment.text);
      await expect(root.locator(".of-reader-stage .of-face-img")).toHaveCount(0);
      await expect(description).toContainText("glass dome, night");
    }
    await next(root);
    await expect(root.locator('.of-face-img[data-front="true"]')).toHaveAttribute("src", LI_SPEAKER_PORTRAIT);
    await expect(description).toHaveCount(0);
    await next(root);
    await expect(root.getByRole("img", { name: "An illustration: Ilvar Thorne", exact: true })).toBeVisible();
    await expect(root.locator(".of-reader-stage .of-face")).toHaveCount(0);
    // The key image is painted: no description stands in for it (#1941).
    await expect(description).toHaveCount(0);
    expect(assets.paid).toEqual([]);
    expect(assets.cleanup).toEqual([]);
  });
}

test("Otome Hearth a line under a story CG types only after the art has loaded and its pan has ended (#2051)", async ({
  page,
}, testInfo) => {
  // Motion on: the pan and the typing are what this checks.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const long = Array.from({ length: 12 }, (_, i) => `The dome hums over the two of them, sentence ${i + 1}.`).join(" ");
  const cgUrl = "/__otome-test/cg-2051.png";
  const fixture = createStoryStub({
    done: true,
    storyBeats: [
      {
        ...BEATS[0],
        segments: [seg("Ilvar Thorne", long)],
        choices: [],
        cg: {
          at: 0,
          brief: "Two figures under the glass dome.",
          cast: ["Ilvar Thorne"],
          art: { state: "ready", at: written.at, url: cgUrl },
        },
      },
      ...BEATS.slice(1),
    ],
  });
  await stubRoutes(page, fixture);
  await page.route(`**/api/otome-forge/runs/${RUN}/art/cg/seen`, (route) => route.fulfill({ json: { ok: true } }));
  // The picture is held: neither the pan nor the line may start before it arrives.
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route(`**${cgUrl}`, async (route) => {
    await gate;
    await route.fulfill({ contentType: "image/png", body: Buffer.from(SPEAKER_PNG, "base64") });
  });
  const root = await openStory(page);
  await root.getByRole("button", { name: "Replay: The Observation Room" }).click();
  await root.getByRole("button", { name: "Begin" }).click();
  const reader = root.locator(".of-reader");
  const typed = root.locator('.of-dialogue .of-line > span[aria-hidden="true"]');
  await expect(reader).toHaveAttribute("data-cg", "intro");
  await expect(root.locator(".of-cg")).toHaveAttribute("data-loaded", "false");
  // The untyped rest is laid out hidden in .of-line-rest, so what has typed is the whole minus the rest.
  const untyped = async () => ((await typed.locator(".of-line-rest").textContent()) ?? "").length;
  // Well past what the whole line takes to type: it must still be waiting behind the pan.
  await page.waitForTimeout(1500);
  expect(await untyped(), "nothing types behind an unloaded CG").toBe(long.length);
  release();
  await expect(root.locator(".of-cg")).toHaveAttribute("data-loaded", "true");
  await expect(reader).toHaveAttribute("data-cg", "intro");
  await page.waitForTimeout(1500);
  expect(await untyped(), "the line still waits while the pan plays").toBe(long.length);
  // A tap on the stage ends the pan; the line then types from its first word, scrolled to the top.
  await root.locator(".of-reader-stage").click();
  await expect(reader).toHaveAttribute("data-cg", "shown");
  await expect(typed).toHaveAttribute("data-done", "false");
  expect(await root.locator(".of-dialogue .of-line").evaluate((element) => element.scrollTop)).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("cg-line-starts-after-pan.png") });
  // Next shows the rest whole, as after any line, without waiting out the typing.
  await setReaderControlsExpanded(root, false);
  await root.locator(".of-next").click();
  await expect(typed).toHaveAttribute("data-done", "true");
  await expect(line(root)).toContainText("sentence 12.");
});

test("Otome Hearth a story CG whose picture fails ends its pan at once and the line types (#2051)", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const cgUrl = "/__otome-test/cg-2051-broken.png";
  const fixture = createStoryStub({
    done: true,
    storyBeats: [
      {
        ...BEATS[0],
        cg: {
          at: 0,
          brief: "Two figures under the glass dome.",
          cast: ["Ilvar Thorne"],
          art: { state: "ready", at: written.at, url: cgUrl },
        },
      },
      ...BEATS.slice(1),
    ],
  });
  await stubRoutes(page, fixture);
  await page.route(`**/api/otome-forge/runs/${RUN}/art/cg/seen`, (route) => route.fulfill({ json: { ok: true } }));
  await page.route(`**${cgUrl}`, (route) => route.fulfill({ status: 404, body: "" }));
  const root = await openStory(page);
  await root.getByRole("button", { name: "Replay: The Observation Room" }).click();
  await root.getByRole("button", { name: "Begin" }).click();
  // Well inside the 6 s pan: a broken picture never holds the box hidden.
  await expect(root.locator(".of-reader")).toHaveAttribute("data-cg", "shown", { timeout: 2000 });
  await expect(root.locator(".of-cg")).toHaveAttribute("data-loaded", "false");
  await expect(root.locator('.of-dialogue .of-line > span[aria-hidden="true"]')).toHaveAttribute("data-done", "true");
});

test("Otome Hearth under reduced motion a story CG never holds the box while its picture loads (#2051)", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const cgUrl = "/__otome-test/cg-2051-slow.png";
  const fixture = createStoryStub({
    done: true,
    storyBeats: [
      {
        ...BEATS[0],
        cg: {
          at: 0,
          brief: "Two figures under the glass dome.",
          cast: ["Ilvar Thorne"],
          art: { state: "ready", at: written.at, url: cgUrl },
        },
      },
      ...BEATS.slice(1),
    ],
  });
  await stubRoutes(page, fixture);
  await page.route(`**/api/otome-forge/runs/${RUN}/art/cg/seen`, (route) => route.fulfill({ json: { ok: true } }));
  // The picture never arrives during the test: with no pan there is nothing for the box to wait on.
  const gate = new Promise<void>(() => undefined);
  await page.route(`**${cgUrl}`, async () => {
    await gate;
  });
  const root = await openStory(page);
  await root.getByRole("button", { name: "Replay: The Observation Room" }).click();
  await root.getByRole("button", { name: "Begin" }).click();
  await expect(root.locator(".of-reader")).toHaveAttribute("data-cg", "shown", { timeout: 2000 });
  await expect(root.locator(".of-cg")).toHaveAttribute("data-loaded", "false");
  await expect(root.locator('.of-dialogue .of-line > span[aria-hidden="true"]')).toHaveAttribute("data-done", "true");
});

// The maintainer's narration line, too long for the box.
const LONG_LINE =
  "Before you can move, he lifts the fox hood up over your left ear and presses the felt seam flat to the stone, the way you'd cap a pen. Then he draws the coat off your left shoulder and works the hoodie down after it. Air finds bare skin and raises gooseflesh to the elbow. Your bra strap sits right there in the lamplight, grey from two days' wear, and under it, across the collarbone, runs a raw red band where the rope sawed in, weeping at the edges. Heat climbs from your chest into your throat.";
// Opens the long line's beat on a frozen clock, at Before you begin.
async function openLongLine(page: Page) {
  const stub = createStoryStub({
    done: true,
    storyBeats: [
      { ...BEATS[0], segments: [seg("", LONG_LINE, { place: "The Observation Room" })], choices: [] },
      ...BEATS.slice(1),
    ],
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.install();
  await stubRoutes(page, stub);
  const root = await openStory(page);
  await root.getByRole("button", { name: "Replay: The Observation Room" }).click();
  await expect(root.getByRole("heading", { name: "Before you begin" })).toBeVisible();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 60_000));
  return root;
}

test("Otome Hearth a long line types as new text at every step, never text changed in place", async ({ page }) => {
  // On an iPhone the rows the long line typed while scrolled out of the box's view came back blank, all but the final
  // "." (WebKit repaints text changed in place only where the box shows it, and a removed element whole), so the box
  // must never change its text in place.
  const root = await openLongLine(page);
  // Every change to the dialogue box's line from Begin to the line's end: a step that replaced the typed span, or text
  // changed inside it.
  await root.evaluate((element) => {
    const changes = { replaced: 0, inPlace: 0 };
    Object.assign(window, { lineChanges: changes });
    new MutationObserver((records) => {
      for (const { target, removedNodes } of records) {
        const node = target instanceof Element ? target : target.parentElement;
        if (node?.matches(".of-line")) changes.replaced += removedNodes.length;
        else if (node?.closest(".of-line > [aria-hidden='true']")) changes.inPlace += 1;
      }
    }).observe(element, { subtree: true, childList: true, characterData: true });
  });
  await root.getByRole("button", { name: "Begin" }).click();
  const typed = line(root).locator(":scope > [aria-hidden='true']");
  await expect(typed).toHaveAttribute("data-done", "false");
  for (let step = 0; step < 100 && (await typed.getAttribute("data-done")) !== "true"; step += 1) {
    await page.clock.runFor(200);
  }
  await expect(typed).toHaveAttribute("data-done", "true");
  await expect(typed).toHaveText(LONG_LINE);
  await expect(typed.locator(".of-line-rest")).toHaveCount(0);
  const changes = await page.evaluate(() => (window as unknown as { lineChanges: Record<string, number> }).lineChanges);
  expect(changes.inPlace, "no text in the box changed in place").toBe(0);
  expect(changes.replaced, "the line typed in steps").toBeGreaterThan(5);
});

test("Otome Hearth a click held on a typing line still shows it whole", async ({ page }) => {
  // The reveal replaces its span at every step; a button held across a step must still click (a click whose pressed
  // element is gone by the release never fires).
  const root = await openLongLine(page);
  await root.getByRole("button", { name: "Begin" }).click();
  const typed = line(root).locator(":scope > [aria-hidden='true']");
  const untyped = async () => (await typed.locator(".of-line-rest").textContent())!.length;
  await page.clock.runFor(400);
  await expect(typed).toHaveAttribute("data-done", "false");
  const box = (await line(root).boundingBox())!;
  await page.mouse.move(box.x + 24, box.y + 12);
  await page.mouse.down();
  const before = await untyped();
  await page.clock.runFor(200);
  await expect.poll(untyped, "the reveal stepped while the button was held").toBeLessThan(before);
  await page.mouse.up();
  await expect(typed).toHaveAttribute("data-done", "true");
  await expect(typed).toHaveText(LONG_LINE);
});

/**
 * The maintainer's iPhone: a box scrolled as its text changed shook and fell back short of the end. Here every scroll
 * of the box is undone once its text changes, which 0.7.1's box fails.
 */
async function undoScrollsOnTextChange(root: Locator) {
  await line(root).evaluate((box) =>
    new MutationObserver(() => (box.scrollTop = 0)).observe(box, {
      subtree: true,
      childList: true,
      characterData: true,
    }),
  );
}

/** Where the row being typed, the line's first row and its end are drawn, from the box's top edge. */
const lineView = (root: Locator) =>
  line(root).evaluate((box) => {
    const typed = box.querySelector<HTMLElement>(":scope > [aria-hidden='true']")!;
    const top = box.getBoundingClientRect().top;
    const at = typed.querySelector(".of-line-rest")?.getClientRects()[0];
    return {
      done: typed.dataset.done === "true",
      lifting: box.dataset.lifting,
      scrollTop: box.scrollTop,
      height: box.clientHeight,
      row: Number.parseFloat(getComputedStyle(box).lineHeight),
      rowTop: at ? at.top - top : null,
      first: typed.getBoundingClientRect().top - top,
      end: typed.getBoundingClientRect().bottom - top,
    };
  });

test("Otome Hearth a long line follows its typing without scrolling the box, and ends on its last row", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const root = await openLongLine(page);
  await root.getByRole("button", { name: "Begin" }).click();
  await undoScrollsOnTextChange(root);
  // About 8 s of typing, well past the rows the box shows at once; halfway the box widens (a phone turned).
  let lifted = 0;
  for (let step = 0; step < 40; step += 1) {
    if (step === 20) await page.setViewportSize({ width: 600, height: 844 });
    await page.clock.runFor(200);
    const now = await lineView(root);
    expect(now.done).toBe(false);
    expect(now.lifting).toBe("true");
    expect(now.scrollTop, "the box never scrolls while it types").toBe(0);
    expect(now.rowTop! + now.row, "the row being typed is in view").toBeLessThanOrEqual(now.height + 1);
    expect(now.rowTop!, "and not above it").toBeGreaterThanOrEqual(-1);
    lifted = Math.max(lifted, -now.first);
  }
  expect(lifted, "the line ran past the box, so it had to follow").toBeGreaterThan(0);
  // A slow frame types the last rows at once; a frame later the box scrolls again, from its last row.
  await page.clock.runFor(20_000);
  await page.clock.runFor(100);
  const end = await lineView(root);
  expect(end.done).toBe(true);
  expect(end.lifting).toBe("false");
  expect(end.scrollTop, "it scrolls from where the lift left it").toBeGreaterThan(0);
  expect(end.end, "the line ends on its last row").toBeLessThanOrEqual(end.height + 1);
  expect(end.end).toBeGreaterThan(end.height - end.row);
});

test("Otome Hearth Next on a long typing line shows it whole where it was, then the box scrolls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const root = await openLongLine(page);
  await root.getByRole("button", { name: "Begin" }).click();
  await undoScrollsOnTextChange(root);
  // Past the rows the box shows at once, short of the line's end.
  await page.clock.runFor(6_000);
  const before = await lineView(root);
  expect(before.first, "the line is lifted").toBeLessThan(0);
  await root.locator(".of-next").click();
  await page.clock.runFor(100);
  const whole = await lineView(root);
  expect(whole.done).toBe(true);
  expect(whole.lifting).toBe("false");
  expect(Math.abs(whole.first - before.first), "its first row stays where it was").toBeLessThanOrEqual(1);
  expect(whole.end, "the rest is below, to scroll to").toBeGreaterThan(whole.height + whole.row);
});

for (const failure of ["missing sprite", "failed cleanup"] as const) {
  test(`Otome Hearth story header restores its description when NPC display fails (${failure})`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
    const fixture = namedSpeakerStub([
      seg("Arin Vale", "The speaker's artwork cannot be displayed.", { place: "The Observation Room" }),
    ]);
    await stubRoutes(page, {
      ...fixture,
      answer(call: Call) {
        const reply = fixture.answer(call);
        if (call.path === `/api/otome-forge/runs/${RUN}`)
          (reply.json as Json).view.world.places = {
            "the-observation-room": { name: "The Observation Room", tags: "glass dome, night" },
          };
        return reply;
      },
    });
    const assets = await speakerRoutes(page, {
      broken: failure === "missing sprite",
      opaque: failure === "failed cleanup",
    });
    if (failure === "failed cleanup")
      await page.route("**/api/sprites/cleanup", (route) =>
        route.fulfill({ status: 502, json: { error: "Free cleanup is unavailable." } }),
      );
    const failed = page.waitForResponse((response) =>
      failure === "missing sprite"
        ? response.url().includes("/sprites/card-arin/file/") && response.status() === 404
        : response.url().endsWith("/sprites/cleanup") && response.status() === 502,
    );
    const root = await openStory(page);
    await root.getByRole("button", { name: "Replay: The Observation Room" }).click();
    await root.getByRole("button", { name: "Begin" }).click();
    await (await failed).finished();
    await expect(line(root)).toContainText("The speaker's artwork cannot be displayed.");
    await expect(root.locator(".of-reader-stage .of-face")).toHaveCount(0);
    await expect(root.locator(".of-reader-head .of-image-description")).toContainText("glass dome, night");
    expect(assets.paid).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`story-header-${failure.replace(" ", "-")}.png`) });
  });
}

for (const firstFailure of ["portrait", "expression"] as const) {
  test(`Otome Hearth LI image failures retain prose across lines and recover without stale layers (${firstFailure})`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
    const good = "/api/global-gallery/file/otome-li-working.png";
    const portrait = "/api/global-gallery/file/otome-li-missing-portrait.png";
    const expression = "/api/global-gallery/file/otome-li-missing-expression.png";
    const firstFace = firstFailure === "portrait" ? "" : "cold";
    const secondFace = firstFailure === "portrait" ? "cold" : "";
    const firstUrl = firstFailure === "portrait" ? portrait : expression;
    const secondUrl = firstFailure === "portrait" ? expression : portrait;
    const fixture = createStoryStub({
      done: true,
      storyBeats: [
        {
          ...BEATS[0],
          choices: [],
          segments: [
            seg("Cassian", "An available portrait starts the scene.", { place: "The Observation Room" }),
            seg("Ilvar", "His requested image cannot load.", { expression: firstFace }),
            seg("", "He remains on stage with the same requested image."),
            seg("Ilvar", "His next image also fails.", { expression: secondFace }),
            seg("", "That failed image stays on the following line."),
            seg("Ilvar", "An already failed image is requested again.", { expression: firstFace }),
            seg("Ilvar", "An available expression returns.", { expression: "tender" }),
            seg("", "His restored sprite remains."),
            seg("Ilvar", "The recovered original image returns.", { expression: firstFace }),
            seg("", "The recovered original remains on stage."),
          ],
        },
        ...BEATS.slice(1),
      ],
    });
    await stubRoutes(page, {
      ...fixture,
      answer(call: Call) {
        const reply = fixture.answer(call);
        if (call.path === `/api/otome-forge/runs/${RUN}`) {
          const view = (reply.json as Json).view;
          view.world.places = {
            "the-observation-room": { name: "The Observation Room", tags: "glass dome, night" },
          };
          Object.assign(view.lis[0], {
            portrait,
            expressions: { cold: expression, tender: good },
            cut: [portrait, expression, good],
          });
          Object.assign(view.lis[1], { portrait: good, cut: [good] });
        }
        return reply;
      },
    });
    await page.route(`**${good}`, (route) =>
      route.fulfill({ contentType: "image/png", body: Buffer.from(SPEAKER_PNG, "base64") }),
    );
    for (const missing of [portrait, expression])
      await page.route(`**${missing}`, (route) => route.fulfill({ status: 404, body: "Missing LI art" }));
    const root = await openStory(page);
    await root.getByRole("button", { name: "Replay: The Observation Room" }).click();
    await root.getByRole("button", { name: "Begin" }).click();
    const front = root.locator('.of-face-img[data-front="true"]');
    const description = root.locator(".of-reader-head .of-image-description");
    await expect(front).toHaveAttribute("src", good);
    await expect.poll(() => front.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(description).toHaveCount(0);
    const failed = page.waitForResponse((response) => response.url().endsWith(firstUrl) && response.status() === 404);
    for (const url of [firstUrl, firstUrl, secondUrl, secondUrl, firstUrl]) {
      await next(root);
      await expect(front).toHaveAttribute("src", url);
      await expect
        .poll(() => front.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth === 0))
        .toBe(true);
      await expect(description).toBeVisible();
      await expect(description).toContainText("glass dome, night");
    }
    await (await failed).finished();
    // A successful load of the same URL clears its recorded failure, without changing the story line.
    await page.unroute(`**${firstUrl}`);
    await page.route(`**${firstUrl}`, (route) =>
      route.fulfill({ contentType: "image/png", body: Buffer.from(SPEAKER_PNG, "base64") }),
    );
    const repaired = page.waitForResponse((response) => response.url().endsWith(firstUrl) && response.status() === 200);
    await front.evaluate((img: HTMLImageElement) => {
      img.src = img.src;
    });
    await (await repaired).finished();
    await expect.poll(() => front.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(description).toHaveCount(0);
    await next(root);
    await expect(front).toHaveAttribute("src", good);
    await expect.poll(() => front.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(description).toHaveCount(0);
    await root.locator('.of-face-img[data-front="false"]').evaluate((img) => {
      img.dispatchEvent(new Event("error", { bubbles: true }));
    });
    await expect(front).toHaveAttribute("src", good);
    await expect.poll(() => front.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(description).toHaveCount(0);
    await next(root);
    await expect(line(root)).toContainText("His restored sprite remains.");
    await expect(front).toHaveAttribute("src", good);
    await expect(description).toHaveCount(0);
    await next(root);
    await expect(line(root)).toContainText("The recovered original image returns.");
    await expect(front).toHaveJSProperty("src", new URL(firstUrl, page.url()).href);
    await expect.poll(() => front.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(description).toHaveCount(0);
    await next(root);
    await expect(line(root)).toContainText("The recovered original remains on stage.");
    await expect(description).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`li-${firstFailure}-recovered.png`) });
  });
}

for (const revision of [2, 0]) {
  test(`Otome Hearth opaque speaker sprites wait for free cleanup and reuse it (revision ${revision})`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const fixture = namedSpeakerStub([
      seg("Ilvar Thorne", "Known speaker."),
      seg("Arin Vale", "Clean my sprite."),
      seg("Ilvar Thorne", "Known speaker again."),
      seg("Arin Vale", "Reuse my cleaned sprite."),
    ]);
    await stubRoutes(page, fixture);
    const assets = await speakerRoutes(page, { opaque: true, revision });
    let release!: () => void;
    const gate = new Promise<void>((done) => {
      release = done;
    });
    await page.route("**/api/sprites/cleanup", async (route) => {
      await gate;
      await route.fallback();
    });
    const root = await openStory(page);
    await root.getByRole("button", { name: "Replay: The Observation Room" }).click();
    await root.getByRole("button", { name: "Begin" }).click();
    const started = page.waitForRequest((request) => request.url().endsWith("/api/sprites/cleanup"));
    await next(root);
    const request = await started;
    await expect(root.locator(".of-reader-stage .of-face")).toHaveCount(0);
    expect(request.postDataJSON()).toMatchObject({ cleanupStrength: 35, engine: revision >= 2 ? "builtin" : "auto" });
    release();
    await expect(root.getByRole("img", { name: "Arin Vale", exact: true })).toBeVisible();
    await expect(root.locator('.of-face-img[data-front="true"]')).toHaveAttribute(
      "src",
      `data:image/png;base64,${SPEAKER_PNG}`,
    );
    await next(root);
    await next(root);
    await expect(root.getByRole("img", { name: "Arin Vale", exact: true })).toBeVisible();
    expect(assets.cleanup).toHaveLength(1);
    expect(assets.paid).toEqual([]);
  });
}

test("Otome Hearth discards a slow speaker asset after the line changes and hides missing images", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const fixture = namedSpeakerStub([
    seg("Ilvar Thorne", "Known speaker."),
    seg("Arin Vale", "A slow image."),
    seg("Ilvar Thorne", "Still the current speaker."),
    seg("Arin Vale", "Now the image is missing."),
  ]);
  await stubRoutes(page, fixture);
  const assets = await speakerRoutes(page, { broken: true });
  let release!: () => void;
  const gate = new Promise<void>((done) => {
    release = done;
  });
  let settle!: () => void;
  const settled = new Promise<void>((done) => {
    settle = done;
  });
  await page.route("**/api/sprites/card-arin/file/*", async (route) => {
    await gate;
    // A browser may finish the held response after the component has already discarded it.
    await route.fulfill({ contentType: "image/png", body: Buffer.from(SPEAKER_PNG, "base64") }).catch(() => undefined);
    settle();
  });
  const root = await openStory(page);
  await root.getByRole("button", { name: "Replay: The Observation Room" }).click();
  await root.getByRole("button", { name: "Begin" }).click();
  const started = page.waitForRequest((request) => request.url().includes("/sprites/card-arin/file/"));
  await next(root);
  await started;
  await expect(root.locator(".of-reader-stage .of-face")).toHaveCount(0);
  await next(root);
  await expect(root.locator('.of-face-img[data-front="true"]')).toHaveAttribute("src", LI_SPEAKER_PORTRAIT);
  release();
  await settled;
  await expect(root.locator('.of-face-img[data-front="true"]')).toHaveAttribute("src", LI_SPEAKER_PORTRAIT);
  await page.unroute("**/api/sprites/card-arin/file/*");
  await page.route("**/api/sprites/card-arin/file/*", (route) =>
    route.fulfill({ status: 404, body: "Missing sprite" }),
  );
  await page.route("**/api/sprites/card-arin", (route) =>
    route.fulfill({
      json: [
        {
          expression: "full_neutral",
          filename: "full_neutral.png",
          url: "/api/sprites/card-arin/file/full_neutral.png?v=2",
        },
      ],
    }),
  );
  const missing = page.waitForResponse(
    (response) => response.url().includes("/sprites/card-arin/file/") && response.status() === 404,
  );
  await next(root);
  await (await missing).finished();
  await expect(line(root)).toContainText("Now the image is missing.");
  await expect(root.locator(".of-reader-stage .of-face")).toHaveCount(0);
  expect(assets.paid).toEqual([]);
});

test("Otome Hearth never displays an opaque speaker original when free cleanup fails", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const fixture = namedSpeakerStub([seg("Ilvar Thorne", "Known speaker."), seg("Arin Vale", "Cleanup fails here.")]);
  await stubRoutes(page, fixture);
  const assets = await speakerRoutes(page, { opaque: true });
  await page.route("**/api/sprites/cleanup", (route) =>
    route.fulfill({ status: 502, json: { error: "Fixture cleanup failed" } }),
  );
  const root = await openStory(page);
  await root.getByRole("button", { name: "Replay: The Observation Room" }).click();
  await root.getByRole("button", { name: "Begin" }).click();
  const failed = page.waitForResponse(
    (response) => response.url().endsWith("/api/sprites/cleanup") && response.status() === 502,
  );
  await next(root);
  await (await failed).finished();
  await expect(line(root)).toContainText("Cleanup fails here.");
  await expect(root.locator(".of-reader-stage .of-face")).toHaveCount(0);
  expect(assets.paid).toEqual([]);
});

for (const [kind, source] of [
  ["corners", CORNER_SPEAKER_PNG],
  ["margin", MARGIN_SPEAKER_PNG],
  ["faint margin", FAINT_MARGIN_SPEAKER_PNG],
] as const) {
  test(`Otome Hearth partial transparency waits for cleanup (${kind})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await stubRoutes(
      page,
      namedSpeakerStub([seg("Ilvar Thorne", "Known speaker."), seg("Arin Vale", "A partial mask.")]),
    );
    const assets = await speakerRoutes(page, { source });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/sprites/cleanup", async (route) => {
      await gate;
      await route.fallback();
    });
    const root = await openStory(page);
    await root.getByRole("button", { name: "Replay: The Observation Room" }).click();
    await root.getByRole("button", { name: "Begin" }).click();
    const started = page.waitForRequest((request) => request.url().endsWith("/api/sprites/cleanup"));
    await next(root);
    await started;
    await expect(root.locator(".of-reader-stage .of-face")).toHaveCount(0);
    release();
    await expect(root.getByRole("img", { name: "Arin Vale", exact: true })).toBeVisible();
    await expect(root.locator('.of-face-img[data-front="true"]')).toHaveAttribute(
      "src",
      `data:image/png;base64,${SPEAKER_PNG}`,
    );
    expect(assets.cleanup).toHaveLength(1);
    expect(assets.paid).toEqual([]);
  });
}

test("Otome Hearth a genuine edge-touching bust displays without cleanup", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await stubRoutes(
    page,
    namedSpeakerStub([seg("Ilvar Thorne", "Known speaker."), seg("Arin Vale", "A genuine bust.")]),
  );
  const assets = await speakerRoutes(page, { source: BUST_SPEAKER_PNG });
  const root = await openStory(page);
  await root.getByRole("button", { name: "Replay: The Observation Room" }).click();
  await root.getByRole("button", { name: "Begin" }).click();
  await next(root);
  await expect(root.getByRole("img", { name: "Arin Vale", exact: true })).toBeVisible();
  await expect(root.locator('.of-face-img[data-front="true"]')).toHaveAttribute(
    "src",
    "/api/sprites/card-arin/file/full_neutral.png?v=1",
  );
  expect(assets.cleanup).toEqual([]);
  expect(assets.paid).toEqual([]);
});

test("Otome Hearth rejects cleanup that only clears corner pixels", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await stubRoutes(
    page,
    namedSpeakerStub([seg("Ilvar Thorne", "Known speaker."), seg("Arin Vale", "An incomplete cleanup.")]),
  );
  const assets = await speakerRoutes(page, { opaque: true });
  await page.route("**/api/sprites/cleanup", (route) =>
    route.fulfill({ json: { cells: [{ base64: CORNER_SPEAKER_PNG }] } }),
  );
  const root = await openStory(page);
  await root.getByRole("button", { name: "Replay: The Observation Room" }).click();
  await root.getByRole("button", { name: "Begin" }).click();
  const reply = page.waitForResponse((response) => response.url().endsWith("/api/sprites/cleanup"));
  await next(root);
  await (await reply).finished();
  // Decode the returned bytes and allow the app's matching detached image and React commit to settle.
  await page.evaluate(async (png) => {
    const image = new Image();
    image.src = `data:image/png;base64,${png}`;
    await image.decode();
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }, CORNER_SPEAKER_PNG);
  await expect(root.locator(".of-reader-stage .of-face")).toHaveCount(0);
  expect(assets.paid).toEqual([]);
});

test("Otome Hearth real Engine card supplies its existing neutral speaker sprite", async ({
  page,
  request,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const name = `Otome Contract NPC ${testInfo.project.name}`;
  const created = await request.post("/api/characters", { data: { data: { name, creator: "Otome package E2E" } } });
  await expect(created).toBeOK();
  const card = await created.json();
  expect(card.id).toMatch(/^[a-z0-9_-]{1,200}$/iu);
  const id = encodeURIComponent(card.id);
  try {
    const uploaded = await request.post(`/api/sprites/${id}`, {
      data: { expression: "full_neutral", image: `data:image/png;base64,${SPEAKER_PNG}` },
    });
    await expect(uploaded).toBeOK();
    const sprite = await uploaded.json();
    const paid: string[] = [];
    const cleanup: string[] = [];
    page.on("request", (call) => {
      if (/\/api\/(?:characters\/avatar-generation|audio\/generate|generate\/raw)/u.test(call.url()))
        paid.push(call.url());
      if (new URL(call.url()).pathname === "/api/sprites/cleanup") cleanup.push(call.url());
    });
    await stubRoutes(
      page,
      namedSpeakerStub([seg("Ilvar Thorne", "Known speaker."), seg(name, "The actual card speaks.")]),
    );
    const root = await openStory(page);
    await root.getByRole("button", { name: "Replay: The Observation Room" }).click();
    await root.getByRole("button", { name: "Begin" }).click();
    await expect(root.locator('.of-face-img[data-front="true"]')).toHaveAttribute("src", LI_SPEAKER_PORTRAIT);
    const catalog = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === "/api/characters/catalog" && url.searchParams.get("limit") === "200";
    });
    const currentCard = page.waitForResponse(
      (response) => new URL(response.url()).pathname === `/api/characters/${id}`,
    );
    const image = page.waitForResponse(
      (response) => new URL(response.url()).pathname === `/api/sprites/${id}/file/full_neutral.png`,
    );
    await next(root);
    const rows = await (await catalog).json();
    expect(rows.items.some((row: Json) => row.id === card.id && row.name === name)).toBe(true);
    const live = await (await currentCard).json();
    expect(live.id).toBe(card.id);
    expect(JSON.parse(live.data).name).toBe(name);
    expect(await (await image).body()).toEqual(Buffer.from(SPEAKER_PNG, "base64"));
    await expect(root.getByRole("img", { name, exact: true })).toBeVisible();
    await expect(root.locator('.of-face-img[data-front="true"]')).toHaveAttribute("src", sprite.url);
    await expect(root.locator('.of-face-img[data-front="true"]')).toHaveAttribute("data-cut", "true");
    await page.screenshot({ path: testInfo.outputPath("real-engine-npc.png") });
    expect(cleanup).toEqual([]);
    expect(paid).toEqual([]);
  } finally {
    await request.delete(`/api/sprites/${id}/full_neutral`);
    await expect(await request.delete(`/api/characters/${id}`)).toBeOK();
  }
});

test("Otome Hearth thoughts close only after typing, finishing the line, or reduced motion", async ({
  page,
}, testInfo) => {
  const thoughts = [
    "They dress me up like an auction lot. " + "I keep my own counsel while the room waits for an answer. ".repeat(8),
    "Every word is mine.",
    "I am still here.",
  ];
  const stub = createStoryStub({
    done: true,
    storyBeats: [
      { ...BEATS[0], segments: thoughts.map((text) => seg("Mira Vale", text, { thought: true })), choices: [] },
      ...BEATS.slice(1),
    ],
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.install();
  await stubRoutes(page, stub);
  const root = await openStory(page);
  await root.getByRole("button", { name: "Replay: The Observation Room" }).click();
  await expect(root.getByRole("heading", { name: "Before you begin" })).toBeVisible();
  // Freeze against the installed browser clock; the Node wall clock can already be behind it.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 60_000));
  await root.getByRole("button", { name: "Begin" }).click();
  const thought = root.locator(".of-line--thought");
  const visual = thought.locator(":scope > [aria-hidden='true']");
  const closingVisibility = () => visual.evaluate((element) => getComputedStyle(element, "::after").visibility);
  await expect(thought).toBeVisible();
  await page.clock.runFor(120);
  await expect(root.locator(".of-next")).toHaveAttribute("data-done", "false");
  await expect(visual.locator(".of-line-rest")).toBeAttached();
  expect(await closingVisibility()).toBe("hidden");
  expect(await visual.evaluate((element) => getComputedStyle(element, "::before").visibility)).toBe("visible");
  await expect(thought.locator(".of-visually-hidden")).toContainText(thoughts[0]!);
  const reservedHeight = await thought.evaluate((element) => element.scrollHeight);
  await page.screenshot({ path: testInfo.outputPath("thought-typing.png") });

  // The existing Show line action completes this line without advancing or changing its reserved layout.
  await root.getByRole("button", { name: "Show the whole line" }).click();
  await expect(root.locator(".of-next")).toHaveAttribute("data-done", "true");
  await expect(visual.locator(".of-line-rest")).toHaveCount(0);
  expect(await closingVisibility()).toBe("visible");
  expect(await thought.evaluate((element) => element.scrollHeight)).toBe(reservedHeight);
  await expect(visual).toHaveText(thoughts[0]!);

  await root.locator(".of-next").click();
  await expect(visual).toHaveText(thoughts[1]!);
  await expect(root.locator(".of-next")).toHaveAttribute("data-done", "false");
  expect(await closingVisibility()).toBe("hidden");
  await page.clock.runFor(thoughts[1]!.length * 22 + 40);
  await expect(root.locator(".of-next")).toHaveAttribute("data-done", "true");
  expect(await closingVisibility()).toBe("visible");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await root.locator(".of-next").click();
  await expect(visual).toHaveText(thoughts[2]!);
  await expect(root.locator(".of-next")).toHaveAttribute("data-done", "true");
  await expect(visual.locator(".of-line-rest")).toHaveCount(0);
  expect(await closingVisibility()).toBe("visible");
  expect(posts(stub, "/read")).toHaveLength(0);
});

test("Otome Forge reader: a replay at reduced motion offers the first choice again, changes nothing, and logs no line an Ease off skips", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const stub = createStoryStub({ done: true });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await stubRoutes(page, stub);
  const root = await openStory(page);
  await root.getByRole("button", { name: "Replay: The Observation Room" }).click();
  await root.getByRole("button", { name: "Begin" }).click();
  await expect(line(root)).toContainText("Rain needles the glass dome.");
  await expect(root.getByText("Replay · nothing changes")).toBeVisible();
  // Whole lines at once, and no animation.
  await expect(root.locator(".of-line-rest")).toHaveCount(0);
  expect(
    await root
      .locator(".of-mood")
      .first()
      .evaluate((element) => getComputedStyle(element).transitionDuration),
  ).toBe("0s");
  await setReaderControlsExpanded(root);
  await root.getByRole("button", { name: "Skip what you’ve read" }).click();
  const choice = root.getByRole("group", { name: "What do you do?" });
  await expect(choice).toContainText("Your first choice");
  await setReaderControlsExpanded(root, false);
  await choice.getByRole("button", { name: /Shrug it off/ }).click();
  await expect(line(root)).toContainText("You lift one shoulder");
  expect(posts(stub, "/choose")).toHaveLength(0);
  expect(posts(stub, "/read")).toHaveLength(0);
  await page.screenshot({ path: testInfo.outputPath("06-replay.png") });

  // Eased off on the pick's line, the scene jumps to its aftermath: the backlog has the lines read, never the rest of
  // the branch the jump skipped.
  await setReaderControlsExpanded(root);
  await root.getByRole("button", { name: "Ease off" }).click();
  await page.getByRole("dialog", { name: "Ease off?" }).getByRole("button", { name: "Ease off" }).click();
  await page.getByRole("dialog", { name: "Veil this from now on?" }).getByRole("button", { name: "Not now" }).click();
  await expect(line(root)).toContainText("The moment passes.");
  await setReaderControlsExpanded(root);
  await root.getByRole("button", { name: "Backlog" }).click();
  const backlog = page.getByRole("dialog", { name: "Backlog" });
  await expect(backlog).toContainText("You lift one shoulder");
  await expect(backlog).toContainText("The moment passes.");
  await expect(backlog).not.toContainText("Of course. Curiosity.");
  expect(posts(stub, "/ease-off"), "a replay's Ease off changes no canon").toHaveLength(0);
});

for (const ended of [false, true]) {
  test(`Otome Hearth's planning cost counts what is planned ${ended ? "at an arc's end" : "inside an arc"}`, async ({
    page,
  }) => {
    const arc = { number: 1, kind: "story", label: "The drowned bell", from: 1, endsAt: 10, read: 0, done: false };
    await stubRoutes(page, createStoryStub());
    await page.route(
      (url) => url.pathname.endsWith(`/runs/${RUN}/story`),
      (route) =>
        route.fulfill({
          json: {
            chapters: [],
            routes: [],
            repairs: [],
            arc: ended ? { ...arc, read: 10, done: true } : arc,
            next: ended
              ? null
              : {
                  kind: "main",
                  number: 1,
                  candidates: [
                    { li: CASSIAN, reason: "least-recent" },
                    { li: ILVAR, reason: "ripe-conflict" },
                  ],
                },
            arcChoice: ended ? { options: ["breathe", "continue", "newcomer"], castFull: false } : null,
          },
        }),
    );
    const root = await openStory(page);
    if (ended) {
      // Someone new is two calls: their bible, then the arc.
      await expect(root.getByRole("region", { name: "How does the story go on?" })).toContainText(
        "1 model call to plan, 2 to meet someone new",
      );
    } else {
      // The arc already covers chapter 1: planning it is the chapter's call alone.
      await root.getByRole("button", { name: "Choose who leads" }).click();
      await expect(page.getByRole("dialog", { name: "Who walks with you this chapter?" })).toContainText(
        "Plans the chapter · 1 model call on your planning connection",
      );
    }
  });
}

test("Otome Forge reader: a chapter with no title is named as untitled, never as loading or blank", async ({
  page,
}) => {
  const stub = createStoryStub({ title: "" });
  await stubRoutes(page, stub);
  const root = await openStory(page);
  await root.getByRole("button", { name: "Choose who leads" }).click();
  await page
    .getByRole("dialog", { name: "Who walks with you this chapter?" })
    .getByRole("button", { name: /Ilvar Thorne/ })
    .click();
  await expect(root.getByRole("heading", { name: "Before you begin" })).toBeVisible();
  await expect(root.getByRole("heading", { level: 1 })).toContainText("Untitled chapter");
  // Back on the Story screen, the chapter in progress: its Continue card and its row in the list.
  await root.getByRole("button", { name: "Leave the chapter" }).click();
  await expect(root.getByRole("heading", { name: "Story", exact: true })).toBeVisible();
  await expect(root.locator("#of-story-continue")).toHaveText("Untitled chapter");
  await expect(root.getByRole("region", { name: "Untitled chapter" })).toBeVisible();
  await expect(root.getByRole("button", { name: "Continue: Untitled chapter" })).toBeVisible();
});

test("Otome Hearth polls a free cut-out replacement while keeping its previous image, stops when ready, and uses its heart tab icon", async ({
  page,
}, testInfo) => {
  const stub = createStoryStub({ pendingCutouts: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await stubRoutes(page, stub);
  const root = await openStory(page);
  const avatar = root.locator(`img[src="${stub.previousCutout}"]`).first();
  await expect(avatar).toBeVisible();
  await expect(page.getByRole("tab", { name: "Open Otome Hearth" }).locator("img")).toHaveAttribute(
    "src",
    /otome-hearth-tab-heart\.png/,
  );
  await page.screenshot({ path: testInfo.outputPath("heart-tab-and-pending-cutout.png") });
  await page.clock.pauseAt(new Date(Date.now() + 60_000));
  const reads = () =>
    stub.calls.filter((call) => call.method === "GET" && call.path === `/api/otome-forge/runs/${RUN}`).length;
  const before = reads();
  const deadline = Date.now() + 10_000;
  const remaining = () => Math.max(1, deadline - Date.now());
  const correctedResponse = page.waitForResponse(
    async (response) => {
      if (
        response.request().method() !== "GET" ||
        new URL(response.url()).pathname !== `/api/otome-forge/runs/${RUN}` ||
        response.status() !== 200
      )
        return false;
      const { view } = await response.json();
      return !view?.cutoutsPending && view?.lis?.some((li: Json) => li.portrait === stub.correctedCutout);
    },
    { timeout: remaining() },
  );
  stub.finishCutouts();
  await page.clock.runFor(2500);
  await (await correctedResponse).finished();
  const readyReads = reads();
  const corrected = root.locator(`img[src="${stub.correctedCutout}"]`).first();
  let drained = 0;
  // The response can finish after runFor has paused again. Drain its queued query notification without another poll.
  await expect
    .poll(
      async () => {
        if (drained < 100) {
          await page.clock.runFor(1);
          drained += 1;
        }
        return corrected.isVisible();
      },
      { intervals: [100], timeout: remaining() },
    )
    .toBe(true);
  await expect(corrected).toBeVisible({ timeout: remaining() });
  expect(reads(), "flushing the ready response does not start another run read").toBe(readyReads);
  expect(reads()).toBeGreaterThan(before);
  const completed = reads();
  await page.clock.runFor(10_000);
  expect(reads(), "ready cleanup stops polling without a model or paid image request").toBe(completed);
  expect(stub.calls.filter((call) => call.method === "POST" && !call.path.endsWith("/index/opened"))).toHaveLength(0);
});

for (const outcome of ["ready", "uncut"] as const) {
  test(`Otome Hearth stage expressions keep the clean neutral until cleanup is ${outcome}`, async ({
    page,
  }, testInfo) => {
    const sprite = (colour: string, green = false) =>
      `data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="320">${green ? '<rect width="160" height="320" fill="#00ff00"/>' : ""}<circle cx="80" cy="40" r="26" fill="${colour}"/><path d="M52 72H108L120 190H100V310H85V190H75V310H60V190H40Z" fill="${colour}"/></svg>`,
      )}`;
    const neutral = sprite("#9db8f0");
    const raw = sprite("#e7a6b8", true);
    const clean = sprite("#e7a6b8");
    let phase: "pending" | "ready" | "uncut" = "pending";
    const stub = createStoryStub({
      done: true,
      storyBeats: [
        {
          ...BEATS[0],
          segments: [seg("Ilvar Thorne", "The same person, a different expression.", { expression: "cold" })],
          choices: [],
        },
        ...BEATS.slice(1),
      ],
    });
    const answer = stub.answer;
    stub.answer = (call) => {
      const response = answer(call);
      if (call.path === `/api/otome-forge/runs/${RUN}`) {
        const view = (response.json as Json).view;
        view.world.images.connectionId = "conn-image";
        view.cutoutsPending = phase === "pending";
        Object.assign(view.lis[0], {
          portrait: neutral,
          // Stickers still receive the original while cleanup waits or fails; the reader must filter it by `cut`.
          expressions: { cold: phase === "ready" ? clean : raw },
          cut: phase === "ready" ? [neutral, clean] : [neutral],
        });
      }
      if (call.path.endsWith("/art/scene")) {
        // The offending scene response stays raw in every phase; only RunView may authorize its cleaned face.
        return {
          status: 200,
          json: { faces: { [ILVAR]: { cold: raw } }, facesComing: phase === "pending" ? [ILVAR] : [], places: [] },
        };
      }
      return response;
    };
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
    await page.clock.install();
    await stubRoutes(page, stub);
    const root = await openStory(page);
    await root.getByRole("button", { name: "Replay: The Observation Room" }).click();
    const scene = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/art/scene"));
    await root.getByRole("button", { name: "Begin" }).click();
    await (await scene).finished();
    const front = root.locator('.of-face-img[data-front="true"]');
    await expect(front).toHaveAttribute("src", neutral);
    await expect(front).toHaveAttribute("data-cut", "true");
    await expect(root.locator(`.of-face-img[src="${raw}"]`)).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("expression-pending-neutral.png") });
    // Replay opens its stored beat with the normal POST; cleanup must add no mutation or regeneration request.
    const packagePosts = () =>
      stub.calls.filter((call) => call.method === "POST" && !call.path.endsWith("/index/opened"));
    const opened = packagePosts();
    expect(opened).toHaveLength(1);
    expect(opened[0]!.path).toBe(`/api/otome-forge/runs/${RUN}/chapters/main-1/beats/0`);
    expect(Object.keys(opened[0]!.body!).sort()).toEqual(["debugMode", "timeZone"]);
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 60_000));
    const reads = () =>
      stub.calls.filter(
        (call) =>
          call.method === "GET" && (call.path === `/api/otome-forge/runs/${RUN}` || call.path.endsWith("/art/scene")),
      ).length;
    const before = reads();
    const viewReady = page.waitForResponse(async (response) => {
      if (new URL(response.url()).pathname !== `/api/otome-forge/runs/${RUN}` || response.status() !== 200)
        return false;
      return !(await response.json()).view.cutoutsPending;
    });
    const sceneReady = page.waitForResponse(async (response) => {
      if (!new URL(response.url()).pathname.endsWith("/art/scene") || response.status() !== 200) return false;
      return !(await response.json()).facesComing.length;
    });
    phase = outcome;
    await page.clock.runFor(5500);
    await Promise.all([(await viewReady).finished(), (await sceneReady).finished()]);
    let drained = 0;
    await expect
      .poll(
        async () => {
          if (drained++ < 100) await page.clock.runFor(1);
          return front.getAttribute("src");
        },
        { intervals: [100], timeout: 10_000 },
      )
      .toBe(outcome === "ready" ? clean : neutral);
    await expect(front).toHaveAttribute("data-cut", "true");
    await expect(root.locator(`.of-face-img[src="${raw}"]`)).toHaveCount(0);
    expect(reads()).toBeGreaterThan(before);
    await page.screenshot({ path: testInfo.outputPath(`expression-${outcome}.png`) });
    const completed = reads();
    await page.clock.runFor(10_000);
    expect(reads(), "completed or failed free cleanup stops both polls").toBe(completed);
    expect(packagePosts(), "cleanup adds no POST beyond the single stored-beat open").toEqual(opened);
  });
}

test("Otome Hearth stands him in a first-wear scene's look, not the look he wears on Home", async ({ page }) => {
  const sprite = (colour: string) =>
    `data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="320"><circle cx="80" cy="40" r="26" fill="${colour}"/><path d="M52 72H108L120 190H100V310H85V190H75V310H60V190H40Z" fill="${colour}"/></svg>`,
    )}`;
  const coat = sprite("#9db8f0");
  const coatCold = sprite("#6f8fd0");
  const suit = sprite("#3b3b48");
  const suitCold = sprite("#5a5a6e");
  const stub = createStoryStub({
    done: true,
    storyBeats: [
      { ...BEATS[0], segments: [seg("Ilvar Thorne", "You came to see it.", { expression: "cold" })], choices: [] },
      ...BEATS.slice(1),
    ],
  });
  const answer = stub.answer;
  stub.answer = (call) => {
    const response = answer(call);
    if (call.path === `/api/otome-forge/runs/${RUN}`) {
      const view = (response.json as Json).view;
      view.world.images.connectionId = "conn-image";
      // On Home he still wears the coat, with its own faces.
      Object.assign(view.lis[0], {
        portrait: coat,
        worn: { id: "his-wardrobe-0-a1", url: coat },
        expressions: { cold: coatCold },
        cut: [coat, coatCold],
      });
    }
    if (call.path.endsWith("/art/scene")) {
      // S/routes/art.ts: the scene is a look's first-wear scene, so he stands in that look with its faces.
      return {
        status: 200,
        json: {
          places: [],
          cg: null,
          faces: { [ILVAR]: { cold: suitCold } },
          facesComing: [],
          looks: {
            [ILVAR]: {
              worn: { id: "his-wardrobe-0-f", url: suit },
              expressions: { cold: suitCold },
              cut: [suit, suitCold],
            },
          },
        },
      };
    }
    return response;
  };
  await page.emulateMedia({ reducedMotion: "reduce" });
  await stubRoutes(page, stub);
  const root = await openStory(page);
  await root.getByRole("button", { name: "Replay: The Observation Room" }).click();
  const scene = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/art/scene"));
  await root.getByRole("button", { name: "Begin" }).click();
  await (await scene).finished();
  const front = root.locator('.of-face-img[data-front="true"]');
  await expect(front).toHaveAttribute("src", suitCold);
  await expect(front).toHaveAttribute("data-cut", "true");
  expect(stub.calls.filter((call) => call.method === "POST" && !call.path.endsWith("/index/opened"))).toHaveLength(1);
});

test("Otome Hearth waits for a first-wear scene's look while it paints, with expressions off, then stands him in it", async ({
  page,
}) => {
  const sprite = (colour: string) =>
    `data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="320"><circle cx="80" cy="40" r="26" fill="${colour}"/><path d="M52 72H108L120 190H100V310H85V190H75V310H60V190H40Z" fill="${colour}"/></svg>`,
    )}`;
  const coat = sprite("#9db8f0");
  const suit = sprite("#3b3b48");
  let painted = false;
  const stub = createStoryStub({
    done: true,
    storyBeats: [
      { ...BEATS[0], segments: [seg("Ilvar Thorne", "You came to see it.", { expression: "cold" })], choices: [] },
      ...BEATS.slice(1),
    ],
  });
  const answer = stub.answer;
  stub.answer = (call) => {
    const response = answer(call);
    if (call.path === `/api/otome-forge/runs/${RUN}`) {
      const view = (response.json as Json).view;
      view.world.images.connectionId = "conn-image";
      view.world.images.expressions = false;
      Object.assign(view.lis[0], {
        portrait: coat,
        worn: { id: "his-wardrobe-0-a1", url: coat },
        expressions: {},
        cut: [coat],
      });
    }
    if (call.path.endsWith("/art/scene")) {
      // S/routes/art.ts: the scene's look still paints (lookComing), then lands as his stage look.
      const look = { worn: { id: "his-wardrobe-0-f", url: suit }, expressions: {}, cut: [suit] };
      return {
        status: 200,
        json: {
          places: [],
          cg: null,
          faces: {},
          facesComing: [],
          ...(painted ? { looks: { [ILVAR]: look } } : { lookComing: true }),
        },
      };
    }
    return response;
  };
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await stubRoutes(page, stub);
  const root = await openStory(page);
  await root.getByRole("button", { name: "Replay: The Observation Room" }).click();
  const scene = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/art/scene"));
  await root.getByRole("button", { name: "Begin" }).click();
  await (await scene).finished();
  const front = root.locator('.of-face-img[data-front="true"]');
  // No picture of the new look exists yet: his worn look stands in.
  await expect(front).toHaveAttribute("src", coat);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 60_000));
  const sceneReads = () =>
    stub.calls.filter((call) => call.method === "GET" && call.path.endsWith("/art/scene")).length;
  const landed = page.waitForResponse(async (response) => {
    if (!new URL(response.url()).pathname.endsWith("/art/scene") || response.status() !== 200) return false;
    return !!(await response.json()).looks;
  });
  painted = true;
  await page.clock.runFor(5500);
  await (await landed).finished();
  let drained = 0;
  await expect
    .poll(
      async () => {
        if (drained++ < 100) await page.clock.runFor(1);
        return front.getAttribute("src");
      },
      { intervals: [100], timeout: 10_000 },
    )
    .toBe(suit);
  await expect(front).toHaveAttribute("data-cut", "true");
  const settled = sceneReads();
  await page.clock.runFor(10_000);
  expect(sceneReads(), "the look in place, the scene's art is not read again").toBe(settled);
});

/** #2046: the first beat as a side-with scene: Ilvar and Cassian disagree, and one small choice backs each. */
const SIDE_BEAT: Json = {
  ...BEATS[0],
  segments: [
    seg("", "The canal map is pinned to the dome's glass.", { place: "The Observation Room" }),
    seg("Ilvar Thorne", "We open the locks tonight.", { expression: "angry" }),
    seg("Cassian", "And flood the lower town? We wait for the thaw.", { expression: "cold" }),
  ],
  choices: [
    {
      id: "choice-1",
      kind: "small",
      at: 2,
      options: [
        {
          id: "option-1",
          text: "Back the plan to open the locks tonight, whatever the lower town says.",
          selection: { kind: "dialogue", text: "We open them tonight." },
          segments: [seg("Ilvar Thorne", "Finally, someone with nerve.", { expression: "tender" })],
        },
        {
          id: "option-2",
          text: "Side with waiting.",
          selection: { kind: "action", text: "You fold the map along its creases." },
          segments: [seg("Cassian", "Thank you.")],
        },
      ],
    },
  ],
  sideWith: { choice: "choice-1", backs: { "option-1": ILVAR, "option-2": CASSIAN } },
};

test("Otome Hearth Side with: the choice says so, names whom each option backs, and shows the affection it moved", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const mobile = testInfo.project.name.includes("mobile");
  // A phone in the light look, a desktop in the dark one; both with reduced motion.
  await page.emulateMedia({ colorScheme: mobile ? "light" : "dark", reducedMotion: "reduce" });
  const stub = createStoryStub({ storyBeats: [SIDE_BEAT, ...BEATS.slice(1)] });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubRoutes(page, stub);
  const root = await openStory(page);
  await expect(root).toHaveAttribute("data-look", mobile ? "pearl" : "midnight");
  await root.getByRole("button", { name: "Choose who leads" }).click();
  await page
    .getByRole("dialog", { name: "Who walks with you this chapter?" })
    .getByRole("button", { name: /Ilvar Thorne/ })
    .click();
  await root.getByRole("button", { name: "Begin" }).click();
  await expect(line(root)).toContainText("The canal map is pinned");
  await next(root);
  await next(root);
  await expect(line(root)).toContainText("We wait for the thaw.");

  const choice = root.getByRole("group", { name: "What do you do?" });
  await expect(choice).toHaveAttribute("data-side", "true");
  await expect(choice.locator(".of-choices-note")).toHaveText("Side with one of them");
  // Focus lands on an option, so the marker is in the group's name for a screen reader.
  await expect(choice).toHaveAccessibleName("What do you do? Side with one of them");
  const pills = choice.getByRole("button");
  // Each option names whom it backs, as part of its accessible name.
  await expect(pills).toHaveText([/Back the plan to open the locks.*Ilvar Thorne$/, /Side with waiting\.Cassian$/]);
  await expect(pills.first()).toHaveAccessibleName(/Back the plan to open the locks.*Ilvar Thorne/);
  for (const pill of await pills.all()) {
    const [box, badge] = [await pill.boundingBox(), await pill.locator(".of-choice-backs").boundingBox()];
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(badge!.x + badge!.width).toBeLessThanOrEqual(box!.x + box!.width);
  }
  const noSideways = async (width: number) =>
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await noSideways(page.viewportSize()!.width);
  await page.screenshot({ path: testInfo.outputPath("side-with-choice.png") });

  // Picked by touch on a phone, by keyboard (Enter on the focused first option) on a desktop.
  if (mobile) await pills.first().tap();
  else {
    await pills.first().focus();
    await page.keyboard.press("Enter");
  }
  const gained = root.locator(".of-toast--affection").filter({ hasText: "+30 affection with Ilvar Thorne" });
  const lost = root.locator(".of-toast--affection").filter({ hasText: "−10 affection with Cassian" });
  await expect(gained).toBeVisible();
  await expect(lost).toBeVisible();
  // The toast follows the answer, so the pick is recorded by now.
  expect(posts(stub, "/choose")[0]!.body).toMatchObject({ choice: "choice-1", option: "option-1" });
  // The reader's own toasts, not the app-wide sticker notice (.of-toasts--app, #2044).
  await expect(root.locator(".of-toasts:not(.of-toasts--app)")).toHaveAttribute("aria-live", "polite");
  await expect(root.getByText("They’ll remember that.")).toHaveCount(0);
  // Reduced motion: the toasts appear without animating.
  expect(await gained.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  await expect(line(root)).toContainText("We open them tonight.");
  await page.screenshot({ path: testInfo.outputPath("side-with-toasts.png") });
  // The levels follow from it: the run is read again.
  await expect
    .poll(() => stub.calls.filter((call) => call.method === "GET" && call.path.endsWith(`/runs/${RUN}`)).length)
    .toBeGreaterThan(1);
  if (mobile) {
    await page.setViewportSize({ width: 320, height: 568 });
    await noSideways(320);
  }
  expect(pageErrors).toEqual([]);
});

test("Otome Hearth Side with on a replay: the first pick's label keeps its room beside both badges", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const mobile = testInfo.project.name.includes("mobile");
  await page.emulateMedia({ colorScheme: mobile ? "dark" : "light", reducedMotion: "reduce" });
  // The long option is the first pick: it carries "Ilvar Thorne" and "Your first choice".
  const firstPicked = { ...SIDE_BEAT, choiceCanon: { "choice-1": "option-1" } };
  const stub = createStoryStub({ done: true, storyBeats: [firstPicked, ...BEATS.slice(1)] });
  await stubRoutes(page, stub);
  const root = await openStory(page);
  await root.getByRole("button", { name: "Replay: The Observation Room" }).click();
  await root.getByRole("button", { name: "Begin" }).click();
  await expect(line(root)).toContainText("The canal map is pinned");
  await next(root);
  await next(root);
  const choice = root.getByRole("group", { name: "What do you do? Side with one of them" });
  const pill = choice.getByRole("button").first();
  await expect(pill.locator(".of-choice-first")).toHaveText(/Your first choice/i);
  for (const width of mobile ? [320, 390] : [page.viewportSize()!.width]) {
    if (mobile) await page.setViewportSize({ width, height: 700 });
    const label = await pill.locator(".of-choice-pill-text").boundingBox();
    // Squeezed by both badges, the label went one word (or letter) a line and the pill grew over the reader's header.
    expect(label!.width, `the label keeps room for a few words at ${width}px`).toBeGreaterThanOrEqual(100);
    // Every badge corner lies inside the pill's rounded outline (a tall capsule's curve cut into a wrapped badge).
    const outside = await pill.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const radius = Math.min(parseFloat(getComputedStyle(element).borderTopLeftRadius), box.width / 2, box.height / 2);
      return [...element.querySelectorAll(".of-choice-backs, .of-choice-first")].flatMap((badge) => {
        const b = badge.getBoundingClientRect();
        const corners: Array<[number, number]> = [
          [b.left, b.top],
          [b.right, b.top],
          [b.left, b.bottom],
          [b.right, b.bottom],
        ];
        return corners.some(([x, y]) => {
          const nearX = Math.min(Math.max(x, box.left + radius), box.right - radius);
          const nearY = Math.min(Math.max(y, box.top + radius), box.bottom - radius);
          return Math.hypot(x - nearX, y - nearY) > radius + 0.5;
        })
          ? [badge.textContent]
          : [];
      });
    });
    expect(outside, `badges cut by the pill's outline at ${width}px`).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      page.viewportSize()!.width,
    );
    await page.screenshot({ path: testInfo.outputPath(`side-with-replay-${width}.png`) });
  }
});

test("Otome Hearth a failed summary is never silent: every screen of the story shows it, with Retry and the Memory connection", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const mobile = testInfo.project.name.includes("mobile");
  const stub = createStoryStub({ done: true, memory: failedMemory(CONTEXT_ERROR) });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubRoutes(page, stub);
  const root = await openStory(page);
  const banner = root.locator(".of-memory-banner");
  const retry = banner.getByRole("button", { name: "Retry the summary" });
  const connection = banner.getByRole("button", { name: "Change connection" });
  const failed = "A story summary failed, so the cast may not remember everything yet.";
  await expect(banner.getByRole("alert")).toHaveText(`${failed} The connection said: ${CONTEXT_ERROR}`);
  await expect(retry).toBeVisible();
  await expect(connection).toBeVisible();

  // The same banner on Home and on each of the dock's screens.
  const dock = root.getByRole("navigation", { name: "Game menu" });
  for (const name of ["Dates", "Wish", "Wardrobe", "Album"]) {
    await dock.getByRole("button", { name, exact: true }).click();
    await expect(dock.getByRole("button", { name, exact: true })).toHaveAttribute("aria-current", "page");
    await expect(banner.getByRole("alert")).toContainText(CONTEXT_ERROR);
  }
  await root.getByRole("button", { name: "Home with Ilvar Thorne" }).click();
  await expect(dock).toBeVisible();
  await expect(dock.getByRole("button", { name: "Album", exact: true })).not.toHaveAttribute("aria-current", "page");
  await expect(banner.getByRole("alert")).toContainText(CONTEXT_ERROR);

  // In the reader, full-stage: above its header, in the stage's flow, so it covers none of the reader's controls.
  await dock.getByRole("button", { name: "Story", exact: true }).click();
  await root.getByRole("button", { name: "Replay: The Observation Room" }).click();
  await root.getByRole("button", { name: "Begin" }).click();
  await expect(line(root)).toContainText("Rain needles the glass dome.");
  await expect(banner.getByRole("alert")).toContainText(CONTEXT_ERROR);
  await setReaderControlsExpanded(root);
  const bannerBox = (await banner.boundingBox())!;
  const stageBox = (await root.locator(".of-stage").boundingBox())!;
  const controls = root.locator(".of-reader-head button:visible, .of-dialogue, .of-next");
  expect(await controls.count()).toBeGreaterThan(2);
  for (const control of await controls.all()) {
    const box = (await control.boundingBox())!;
    expect(box.y, "below the banner").toBeGreaterThanOrEqual(bannerBox.y + bannerBox.height);
    expect(box.y + box.height, "inside the stage").toBeLessThanOrEqual(stageBox.y + stageBox.height + 1);
  }
  // First on the full stage, the banner has taken the safe area: the reader's header does not take it again.
  await expect(root.locator(".of-reader-head")).toHaveCSS("padding-top", "6px");
  await page.screenshot({ path: testInfo.outputPath(`memory-banner-reader-${mobile ? "phone" : "desktop"}.png`) });
  await setReaderControlsExpanded(root, false);

  // Retry: the banner goes at once and stays gone while the retry runs (the maintainer's, 2026-11-05), giving its
  // focus to the screen's heading; only the status line says the summary is being tried again.
  await retry.click();
  await expect(banner).toHaveCount(0);
  await expect(root.locator(".of-reader-title")).toBeFocused();
  await expect(root.getByRole("status").filter({ hasText: "Trying the summary again…" })).toHaveCount(1);
  await expect.poll(() => posts(stub, "/memory/retry").length).toBe(1);
  await expect(banner).toHaveCount(0);

  // It fails again: the banner comes back with the new error and its buttons.
  const again = "Upstream 413: the request is larger than this model's 8192-token context.";
  stub.setMemory(failedMemory(again));
  await expect(banner.getByRole("alert")).toHaveText(`${failed} The connection said: ${again}`);
  await expect(retry).toBeVisible();
  await expect(connection).toBeVisible();

  // The Memory connection: Settings → Connections with More connections open and Memory focused, and the provider's
  // whole message beside it; from Settings too.
  await connection.click();
  const connectionsTab = root.getByRole("tab", { name: "Connections", exact: true });
  await expect(connectionsTab).toHaveAttribute("aria-selected", "true");
  const memoryConnection = root.getByRole("combobox", { name: "Memory", exact: true });
  await expect(memoryConnection).toBeFocused();
  await expect(root.locator("details.of-details", { hasText: "More connections" })).toHaveJSProperty("open", true);
  const section = root.getByRole("tabpanel").getByRole("region", { name: "Story memory" });
  await expect(section).toContainText("The connection said");
  await expect(section).toContainText(again);
  await expect(banner.getByRole("alert")).toContainText(again);
  // Pressed again on Connections, it keeps a pick not saved yet.
  const storyConnection = root.getByRole("combobox", { name: "Story", exact: true });
  await storyConnection.selectOption("conn-other");
  await connection.click();
  await expect(memoryConnection).toBeFocused();
  await expect(storyConnection).toHaveValue("conn-other");
  await root.getByRole("tab", { name: "Debug", exact: true }).click();
  await connection.click();
  await expect(connectionsTab).toHaveAttribute("aria-selected", "true");
  await expect(memoryConnection).toBeFocused();
  // Back to the reader, which opens on the chapter's content tags again.
  await root.getByRole("button", { name: "Back", exact: true }).click();
  await expect(root.getByRole("button", { name: "Begin" })).toBeVisible();

  // Retry writes the summary: the banner goes at once, gives its focus to the screen's heading, stays gone, and the
  // status line says memory is working again.
  await retry.click();
  await expect(banner).toHaveCount(0);
  await expect(root.locator(".of-reader-title")).toBeFocused();
  await expect.poll(() => posts(stub, "/memory/retry").length).toBe(2);
  stub.setMemory(MEMORY_READY);
  await expect(root.getByRole("status").filter({ hasText: "Story memory is working again." })).toHaveCount(1);
  await expect(banner).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("Otome Hearth a memory model too small for any summary says so in Otome's own words, not as the connection's", async ({
  page,
}) => {
  const tooSmall =
    "The Memory connection's model (8,192 tokens of context) is too small to write a summary. Choose a connection with a larger context.";
  const stub = createStoryStub({ done: true, memory: { ...failedMemory(tooSmall), reason: "context-too-small" } });
  await stubRoutes(page, stub);
  const root = await openStory(page);
  const banner = root.locator(".of-memory-banner");
  await expect(banner.getByRole("alert")).toHaveText(
    `A story summary failed, so the cast may not remember everything yet. ${tooSmall}`,
  );
  // A Retry request that fails itself says so on its own line: Otome's words stay as they were, never "The connection
  // said".
  await refuseRetry(page);
  await banner.getByRole("button", { name: "Retry the summary" }).click();
  await expect(banner.getByRole("alert")).toHaveText([`${MEMORY_FAILED} ${tooSmall}`, RETRY_REFUSED]);
  await expect(banner).not.toContainText("The connection said");
  // Settings → Connections and Debug show it on its own too, not under "The connection said".
  await banner.getByRole("button", { name: "Change connection" }).click();
  for (const tab of ["Connections", "Debug"]) {
    await root.getByRole("tab", { name: tab, exact: true }).click();
    const section = root.getByRole("tabpanel").getByRole("region", { name: "Story memory" });
    await expect(section).toContainText(tooSmall);
    await expect(section).not.toContainText("The connection said");
  }
});

test("Otome Hearth a Retry request that fails itself says so on its own line, not as the connection's words, until memory moves on", async ({
  page,
}) => {
  const stub = createStoryStub({ done: true, memory: failedMemory(CONTEXT_ERROR) });
  await stubRoutes(page, stub);
  let refuse = true;
  await refuseRetry(page, () => refuse);
  const root = await openStory(page);
  const banner = root.locator(".of-memory-banner");
  const said = `${MEMORY_FAILED} The connection said: ${CONTEXT_ERROR}`;
  await expect(banner.getByRole("alert")).toHaveText([said]);

  // The summary's own failure stays as it was, and the request's error is a line of its own, which the status read
  // that follows (the same failure, as every 30 s poll reads it) keeps.
  const read = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/memory/status"));
  await banner.getByRole("button", { name: "Retry the summary" }).click();
  await read;
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  await expect(banner.getByRole("alert")).toHaveText([said, RETRY_REFUSED]);

  // Settings' memory section reads the same status with its own Retry: refused too, it says so on its own line, beside
  // the provider's words.
  await banner.getByRole("button", { name: "Change connection" }).click();
  const section = root.getByRole("tabpanel").getByRole("region", { name: "Story memory" });
  const sectionRetry = section.getByRole("button", { name: "Retry memory upkeep" });
  await expect(section).toContainText(CONTEXT_ERROR);
  await expect(section.getByRole("alert")).toHaveCount(0);
  await sectionRetry.click();
  await expect(section.getByRole("alert")).toHaveText(RETRY_REFUSED);
  await expect(section).toContainText(CONTEXT_ERROR);

  // A Retry from Settings goes through: the banner beside it goes at once, before the request answers (both share
  // it, so neither offers a second Retry meanwhile), and its earlier request error with it.
  refuse = false;
  let answer!: () => void;
  const held = new Promise<void>((resolve) => (answer = resolve));
  let sent = 0;
  await page.route("**/api/otome-forge/runs/*/memory/retry", async (route) => {
    sent += 1;
    await held;
    await route.fallback();
  });
  await sectionRetry.click();
  await expect.poll(() => sent).toBe(1);
  await expect(banner).toHaveCount(0);
  await expect(root.getByRole("status").filter({ hasText: "Trying the summary again…" })).toHaveCount(1);
  // Playwright waits for an aria-disabled button to be enabled; the press itself must send nothing.
  await sectionRetry.click({ force: true });
  answer();
  await expect(section.getByRole("alert")).toHaveCount(0);
  await expect(banner).toHaveCount(0);
  // It fails anew: the banner shows the new failure's own words, with no earlier request error.
  const again = "Upstream 413: the request is larger than this model's 8192-token context.";
  stub.setMemory(failedMemory(again));
  await expect(banner.getByRole("alert")).toHaveText([`${MEMORY_FAILED} The connection said: ${again}`]);
  await expect(section).toContainText(again);
  await expect(section.getByRole("alert")).toHaveCount(0);
  expect(sent).toBe(1);
});

test("Otome Hearth Change connection with no connection listed yet opens More connections at Memory once one is", async ({
  page,
}) => {
  const stub = createStoryStub({ done: true, memory: failedMemory(CONTEXT_ERROR) });
  await stubRoutes(page, stub);
  // The Engine lists no text connection until the player adds one there and checks again.
  let listed = false;
  await page.route("**/api/connections", (route) =>
    route.request().method() === "GET" && !listed ? route.fulfill({ json: [] }) : route.fallback(),
  );
  const root = await openStory(page);
  const banner = root.locator(".of-memory-banner");
  await banner.getByRole("button", { name: "Change connection" }).click();
  await expect(root.getByRole("tab", { name: "Connections", exact: true })).toHaveAttribute("aria-selected", "true");
  const panel = root.getByRole("tabpanel");
  await expect(panel).toContainText("No text connections yet.");

  listed = true;
  await panel.getByRole("button", { name: "Check again" }).click();
  const more = panel.locator("details.of-details", { hasText: "More connections" });
  const memoryConnection = panel.getByRole("combobox", { name: "Memory", exact: true });
  await expect(more).toHaveJSProperty("open", true);
  await expect(memoryConnection).toBeFocused();

  // Shown once: a More connections the player closes stays closed as the screen renders again, and the banner's way
  // there (asked again) opens it again, which it could not if the first ask were still pending.
  await more.locator("summary").click();
  await expect(more).toHaveJSProperty("open", false);
  await panel.getByRole("combobox", { name: "Story", exact: true }).selectOption("conn-other");
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  await expect(more).toHaveJSProperty("open", false);
  await banner.getByRole("button", { name: "Change connection" }).click();
  await expect(more).toHaveJSProperty("open", true);
  await expect(memoryConnection).toBeFocused();
});

test("Otome Hearth memory with no connection to write summaries asks for one, without Retry, and never on the story list", async ({
  page,
}) => {
  const stub = createStoryStub({
    done: true,
    memory: {
      phase: "stale",
      retryable: true,
      reason: "not-prepared",
      recordCount: 0,
      noConnection: true,
      unsummarized: 1,
    },
  });
  await stubRoutes(page, stub);
  const root = await openStory(page);
  const banner = root.locator(".of-memory-banner");
  await expect(banner.getByRole("alert")).toHaveText(
    "No connection is set to write the story’s summaries, so finished chapters wait to be remembered.",
  );
  await expect(banner.getByRole("button")).toHaveText(["Change connection"]);
  await banner.getByRole("button", { name: "Change connection" }).click();
  await expect(root.getByRole("tab", { name: "Connections", exact: true })).toHaveAttribute("aria-selected", "true");
  // The story's own connection is the one missing: Settings opens as it does, not at Memory.
  await expect(root.getByRole("heading", { name: "Settings", level: 1 })).toBeFocused();
  const section = root.getByRole("tabpanel").getByRole("region", { name: "Story memory" });
  await expect(section).toContainText("No connection is set to write the story’s summaries");
  await expect(root.getByRole("tabpanel").getByRole("button", { name: "Retry memory upkeep" })).toHaveCount(0);
  // A connection saved here ends the wait at once, not at the next 30 s read.
  await root.getByRole("combobox", { name: "Story", exact: true }).selectOption("conn-other");
  await root.getByRole("button", { name: "Save changes" }).click();
  await expect.poll(() => posts(stub, "/settings").length).toBe(1);
  await expect(banner).toHaveCount(0, { timeout: 5_000 });
  await expect(section).not.toContainText("No connection is set to write the story’s summaries", { timeout: 5_000 });
  // The story list belongs to no one story: it shows no banner.
  await root.getByRole("tab", { name: "Stories", exact: true }).click();
  await root.getByRole("button", { name: "Open your stories" }).click();
  await expect(root.getByRole("heading", { name: "Your stories", level: 1 })).toBeVisible();
  await expect(banner).toHaveCount(0);
  expect(posts(stub, "/memory/retry")).toHaveLength(0);
});
