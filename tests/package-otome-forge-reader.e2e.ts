// Otome Forge's Story screen and reader (M2a) in the Engine's Home tab, with /api/otome-forge/** stubbed: the Lead
// dialog, a dark chapter's content tags, faces line by line, her thoughts and his, a choice and "{name} will remember
// that.", the keys after a click on the dialogue box or the stage, the backlog star, an end of a beat that was not
// saved (Next sends it again, nothing loops, Ease off comes back), → from the Next button, the declined panel and
// Retry, Ease off with "Veil this from now on" (neither closes while its request runs), a big choice, Ease off gone
// once the scene's end is saved, the chapter's Starlight and affection with focus on its heading; then a replay at
// reduced motion that changes nothing, whose Ease off on a branch puts no line it skips in the backlog, and a chapter
// with no title in the reader and on the Story screen.
// Run: node scripts/run-package-browser-tests.mjs otome-forge tests/package-otome-forge-reader.e2e.ts
import { expect, test, type Locator, type Page } from "@playwright/test";
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

/** The M2a story routes, answered in memory by the server's rules (S/story/beats.ts). */
function createStoryStub({ done = false, title = CHAPTER.title } = {}) {
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
  if (done) {
    for (const stored of BEATS) {
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
    const match = /^\/runs\/[^/]+\/chapters\/main-1\/beats\/(\d+)(?:\/(choose|read|ease-off))?$/u.exec(path);
    if (match) {
      const i = Number(match[1]);
      if (!match[2]) {
        if (!beats.has(i)) {
          if (i === 1 && !declined) {
            declined = true;
            return { status: 422, json: { error: "Refused twice.", code: "declined" } };
          }
          beats.set(i, structuredClone(BEATS[i]!));
        }
        return { status: 200, json: { beat: beats.get(i) } };
      }
      const beat = beats.get(i)!;
      if (match[2] === "choose") {
        const remembered = !beat.choiceCanon[call.body!.choice];
        beat.choiceCanon[call.body!.choice] ??= call.body!.option;
        return { status: 200, json: { beat, remembered, rememberedBy: remembered ? [ILVAR] : [] } };
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
  return { calls, answer };
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
  const button = root.locator(".of-next");
  await expect(button).toHaveAttribute("data-done", "true");
  await button.click();
}

const line = (root: Locator) => root.locator(".of-dialogue .of-line");

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
  const stub = createStoryStub();
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
  await root.getByRole("button", { name: "Ease off" }).click();
  const ease = page.getByRole("dialog", { name: "Ease off?" });
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
  const easeOff = root.getByRole("button", { name: "Ease off" });
  await expect(easeOff).toBeVisible();
  await big.getByRole("button", { name: "Stay with him." }).click();
  await expect(line(root)).toContainText("I’m still here.");
  await expect.poll(() => posts(stub, "/beats/2/read").length).toBeGreaterThan(0);
  await expect(easeOff).toHaveCount(0);
  await next(root);
  await expect(root.getByRole("heading", { name: "Chapter complete" })).toBeFocused();
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
  await root.getByRole("button", { name: "Skip what you’ve read" }).click();
  const choice = root.getByRole("group", { name: "What do you do?" });
  await expect(choice).toContainText("Your first choice");
  await choice.getByRole("button", { name: /Shrug it off/ }).click();
  await expect(line(root)).toContainText("You lift one shoulder");
  expect(posts(stub, "/choose")).toHaveLength(0);
  expect(posts(stub, "/read")).toHaveLength(0);
  await page.screenshot({ path: testInfo.outputPath("06-replay.png") });

  // Eased off on the pick's line, the scene jumps to its aftermath: the backlog has the lines read, never the rest of
  // the branch the jump skipped.
  await root.getByRole("button", { name: "Ease off" }).click();
  await page.getByRole("dialog", { name: "Ease off?" }).getByRole("button", { name: "Ease off" }).click();
  await page.getByRole("dialog", { name: "Veil this from now on?" }).getByRole("button", { name: "Not now" }).click();
  await expect(line(root)).toContainText("The moment passes.");
  await root.getByRole("button", { name: "Backlog" }).click();
  const backlog = page.getByRole("dialog", { name: "Backlog" });
  await expect(backlog).toContainText("You lift one shoulder");
  await expect(backlog).toContainText("The moment passes.");
  await expect(backlog).not.toContainText("Of course. Curiosity.");
  expect(posts(stub, "/ease-off"), "a replay's Ease off changes no canon").toHaveLength(0);
});

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
