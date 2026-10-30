// Otome Forge's M2b presentation in the Engine's Home tab, with /api/otome-forge/** and the Engine's audio routes
// stubbed: a rupture's banner plans the repair ("Make it right"), route cards open, wait for affection or stay shut,
// and a route chapter's gate shows the stage it opened; a rupture that opens elsewhere while a gate scene is on screen
// holds it, and the reader says with whom and leads back to the banner's Make it right, also when it refuses a Rewrite
// or an Ease off; a painted CG takes the stage
// and unlocks only once seen (after the read reached it), ready faces swap line by line, the dialogue is voiced
// through the Engine's voice service with the Engine's assignment (and replayed from the backlog with the line's
// cache key), stock music plays and each cue is generated once; the Confrontation plays three rounds of stances (each
// sent once) to its ending's card; then, at reduced motion with "Ask before painting", a CG and a place paint only on
// a tap, and Settings → Audio saves; a reviewed key-image prompt stops Auto and paints the scene it was opened for;
// only saved audio settings generate music (an unsaved Mute or music level never does), an unsaved Mute stays silent
// when a cue's track lands, and a recorded track the Engine no longer lists is made again while stock music plays.
// Run: node scripts/run-package-browser-tests.mjs otome-forge tests/package-otome-forge-presentation.e2e.ts
import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeBible } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit";

const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("Set MARINARA_ENGINE_ROOT to a compatible Engine checkout");
const appVersion = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version;

type Json = Record<string, any>;
interface Call {
  method: string;
  path: string;
  query: URLSearchParams;
  body: Json | undefined;
}

const RUN = "r-e2e-m2b001";
const ILVAR = "li-ilvar-0001";
const CASSIAN = "li-cassian-0002";
const SORA = "li-sora-0003";
const HE = { subject: "he", object: "him", possessive: "his" };
const SHE = { subject: "she", object: "her", possessive: "her" };
const seg = (speaker: string, text: string, extra: Json = {}) => ({ speaker, text, ...extra });
const written = { at: "2026-10-28T10:00:00.000Z", connectionId: "conn-text", model: "fixture" };
const now = () => new Date().toISOString();

/** A one-colour SVG as a data: URL (img-src allows data:). */
const art = (colour: string) =>
  `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="9" height="16"><rect width="9" height="16" fill="${colour}"/></svg>`,
  ).toString("base64")}`;
const FACE_COLD = art("#6f8fd8");
const FACE_TENDER = art("#e7a6b8");
const FACE_ANGRY = art("#d84a4a");
const FACE_HURT = art("#8e74c8");
const CG_ART = art("#2b2236");
const PLACE_ART = art("#3a2a4f");

/** A short silent WAV, for every audio file and voice clip. */
function silentWav(): Buffer {
  const samples = 800;
  const data = Buffer.alloc(samples * 2);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(8000, 24);
  header.writeUInt32LE(16000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}
const WAV = silentWav();

const LIMITS: Json = {
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

interface WorldOptions {
  images?: Json;
  audio?: Json;
  places?: Json;
}

function runView({ images, audio, places }: WorldOptions = {}): Json {
  return {
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
      content: { heat: "sfw", darkness: "angst", limits: LIMITS, custom: [] },
      images: { connectionId: null, rating: "sfw", ask: false, expressions: true, ...images },
      connections: { narration: "conn-text" },
      forge: { phase: "ready", steps: [] },
      audio: {
        tts: false,
        otherVoices: false,
        combatVoices: false,
        generate: false,
        homeMusic: "",
        audioConnectionId: "",
        muted: false,
        musicVolume: 0.5,
        dialogueVolume: 1,
        sfxVolume: 0.5,
        autoplayPauseSeconds: 3,
        tracks: [],
        ...audio,
      },
      places: places ?? {},
    },
    player: {
      personaId: "persona-mira",
      name: "Mira Vale",
      pronouns: SHE,
      traits: [],
      goal: "",
      look: { identityLine: "", outfitLine: "" },
    },
    lis: [
      {
        id: ILVAR,
        name: "Ilvar Thorne",
        pronouns: HE,
        source: "card",
        cardId: "card-ilvar",
        voiceGender: "male",
        accent: "#9DB8F0",
        level: 2,
        stage: 1,
        expressions: { cold: FACE_COLD, tender: FACE_TENDER, angry: FACE_ANGRY, hurt: FACE_HURT },
      },
      {
        id: CASSIAN,
        name: "Cassian",
        pronouns: HE,
        source: "archetype",
        voiceGender: "male",
        accent: "#E6C98A",
        level: 5,
        stage: 2,
      },
      {
        id: SORA,
        name: "Sora",
        pronouns: SHE,
        source: "archetype",
        voiceGender: "female",
        accent: "#B79CF2",
        level: 1,
        stage: 1,
      },
    ],
    forge: { phase: "ready", steps: [] },
    starlight: 2000,
  };
}

const index = () => ({
  version: 1,
  runs: [{ runKey: RUN, title: "The Clockwork Masquerade", createdAt: now(), lastPlayedAt: null }],
  activeRun: RUN,
  ageGate: null,
  lastOpenedAt: null,
});

/** Every POST /read in the stubs: the beat's end is its last mainline segment. */
function readResult(stub: { view: Json }, grants: Json[] = [], extra: Json = {}) {
  for (const grant of grants) stub.view.starlight += grant.starlight ?? 0;
  return { grants, starlight: stub.view.starlight, chapterDone: false, ...extra };
}

type Answer = {
  status: number;
  json?: unknown;
  body?: Buffer;
  contentType?: string;
  delay?: number;
  wait?: Promise<void>;
};

async function stubRoutes(page: Page, answer: (call: Call) => Answer | undefined, calls: Call[]) {
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await page.route("**/api/connections", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          json: [
            { id: "conn-text", name: "Story fixture", provider: "custom", model: "fixture", isDefault: "true" },
            { id: "conn-image", name: "Paint fixture", provider: "image_generation", model: "paint" },
            {
              id: "conn-audio",
              name: "Music fixture",
              provider: "audio_generation",
              model: "tunes",
              audioMusic: "true",
              audioSoundEffects: "false",
            },
          ],
        })
      : route.continue(),
  );
  const handle = async (route: Parameters<Parameters<Page["route"]>[1]>[0]) => {
    const request = route.request();
    const url = new URL(request.url());
    let body: Json | undefined;
    try {
      body = request.method() === "POST" ? (request.postDataJSON() ?? undefined) : undefined;
    } catch {
      body = undefined;
    }
    const call = { method: request.method(), path: url.pathname, query: url.searchParams, body };
    calls.push(call);
    const reply = answer(call) ?? {
      status: 404,
      json: { error: `No stub for ${call.method} ${call.path}`, code: "not-found" },
    };
    if (reply.wait) await reply.wait;
    if (reply.delay) await new Promise((done) => setTimeout(done, reply.delay));
    if (reply.body) await route.fulfill({ status: reply.status, body: reply.body, contentType: reply.contentType });
    else await route.fulfill({ status: reply.status, json: reply.json });
  };
  for (const pattern of ["**/api/otome-forge/**", "**/api/tts/**", "**/api/audio/**", "**/api/game-assets/**"]) {
    await page.route(pattern, handle);
  }
}

/** `reviewPrompts`: the Engine's "Review image prompts before sending" is on. */
async function openOtome(
  page: Page,
  { reviewPrompts = false, recordMusic = false }: { reviewPrompts?: boolean; recordMusic?: boolean } = {},
): Promise<Locator> {
  // Engine's calendar greeting can appear after startup. Keep its theme through the normal, specific dialog action.
  await page.addLocatorHandler(
    page
      .getByRole("dialog", { name: "Happy Halloween!", exact: true })
      .filter({ has: page.getByRole("button", { name: "Keep it", exact: true }) }),
    async (dialog) => {
      await dialog.getByRole("button", { name: "Keep it", exact: true }).click();
    },
  );
  await page.addInitScript(
    ({ version, review }) => {
      localStorage.setItem("marinara:whats-new:seen-version", version);
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: {
            hasCompletedOnboarding: true,
            sidebarOpen: false,
            rightPanelOpen: false,
            appAccentPulseMode: false,
            ...(review ? { reviewImagePromptsBeforeSend: true } : {}),
          },
          version: 65,
        }),
      );
    },
    { version: appVersion, review: reviewPrompts },
  );
  if (recordMusic)
    await page.addInitScript(() => {
      // The host and its players are frozen. Observe their calls through a frozen forwarding facade at publication.
      const events: string[] = [];
      (globalThis as any).__otomeMusicEvents = events;
      const define = Object.defineProperty;
      Object.defineProperty = ((target: object, key: PropertyKey, descriptor: PropertyDescriptor) => {
        if (target === globalThis && key === "__MARINARA_HOST__") {
          Object.defineProperty = define;
          const host = descriptor.value;
          const audio = host.services.audio;
          descriptor = {
            ...descriptor,
            value: Object.freeze({
              ...host,
              services: Object.freeze({
                ...host.services,
                audio: Object.freeze({
                  ...audio,
                  createPlayer: () => {
                    const player = audio.createPlayer();
                    return Object.freeze({
                      ...player,
                      playMusic: (tag: string, assets: unknown) => {
                        events.push(tag);
                        return player.playMusic(tag, assets);
                      },
                      stopMusic: (...args: unknown[]) => {
                        events.push("STOP");
                        return player.stopMusic(...args);
                      },
                    });
                  },
                }),
              }),
            }),
          };
        }
        return define(target, key, descriptor);
      }) as typeof Object.defineProperty;
    });
  await page.goto("/");
  await page.getByRole("tab", { name: "Open Otome Hearth" }).click();
  const root = page.locator("marinara-capability-otome-forge .of-root");
  await expect(root).toBeVisible({ timeout: 60_000 });
  return root;
}

async function openStory(page: Page, options?: Parameters<typeof openOtome>[1]): Promise<Locator> {
  const root = await openOtome(page, options);
  await root.getByRole("navigation", { name: "Game menu" }).getByRole("button", { name: "Story" }).click();
  await expect(root.getByRole("heading", { name: "Story", exact: true })).toBeVisible();
  return root;
}

const posts = (calls: Call[], suffix: string) =>
  calls.filter((call) => call.method === "POST" && call.path.endsWith(suffix));

/** Goes on once the line has typed itself out (waiting, never racing the typing: see the reader spec's next). */
async function next(root: Locator) {
  await setReaderControlsExpanded(root, false);
  const button = root.locator(".of-next");
  await expect(button).toHaveAttribute("data-done", "true");
  await button.click();
}

const line = (root: Locator) => root.locator(".of-dialogue .of-line");
/** DialogueBox keeps a full accessible copy beside this visible, typed copy. */
const displayedLine = (root: Locator) => line(root).locator(':scope > span[aria-hidden="true"]');

async function setReaderControlsExpanded(root: Locator, expanded = true) {
  const more = root.getByRole("button", { name: "More reader controls" });
  if ((await more.isVisible()) && (await more.getAttribute("aria-expanded")) !== String(expanded)) await more.click();
}

/** The cues music was generated for, in order of their names; a cue made twice shows twice. */
const generatedCues = (calls: Call[]) =>
  posts(calls, "/api/audio/generate")
    .map((call) => /-([a-z]+)$/u.exec(call.body!.context.key)?.[1] ?? "")
    .sort();

const REPAINT_FACES = ["tender", "flustered", "cold", "hurt", "angry"];
const REPAINT_ERROR = "The new expressions didn’t finish. Your current artwork stays. Try Repaint expressions again.";

function expressionRepaintFixture({
  failFirst = false,
  conflictFirst = false,
  wait,
}: { failFirst?: boolean; conflictFirst?: boolean; wait?: Promise<void> } = {}) {
  const fixture = createSceneStub({ audio: false });
  const { view } = fixture.stub;
  const forge = { phase: "ready", steps: [{ id: `paint:${ILVAR}`, state: "done" }] };
  view.forge = forge;
  view.world.forge = forge;
  Object.assign(view.lis[0], { portrait: FACE_COLD, cut: [FACE_COLD] });
  const prompts = Object.fromEntries(
    REPAINT_FACES.map((face) => [
      face,
      {
        prompt: `Edit only the ${face} expression. Configured copper etching style.`,
        negativePrompt: "lowres, child, underage",
      },
    ]),
  );
  const home = {
    li: ILVAR,
    show: "him",
    note: {
      li: ILVAR,
      dayKey: now().slice(0, 10),
      text: "Come inside.",
      face: "",
      mood: { word: "Fond", reason: "You came back" },
      curt: false,
      at: now(),
    },
    look: { url: FACE_COLD, source: "look", cutout: FACE_COLD, cutoutState: "ready" },
    faces: {},
    backdrop: null,
    lines: { ready: false },
    rupture: false,
    unread: 0,
    noticed: null,
    noticing: false,
  };
  let attempts = 0;
  const answer = (call: Call): Answer | undefined => {
    if (call.path.endsWith("/art/expressions/prompt")) return { status: 200, json: { base: FACE_COLD, prompts } };
    if (call.path.endsWith("/art/expressions")) {
      attempts += 1;
      if (conflictFirst && attempts === 1)
        return {
          status: 409,
          json: { error: "This character's expressions are already being painted.", code: "conflict" },
        };
      return {
        status: 200,
        json: { paint: { state: failFirst && attempts === 1 ? "failed" : "ready", at: now() } },
        wait,
      };
    }
    if (call.path.endsWith("/home")) return { status: 200, json: home };
    if (call.path.endsWith(`/lis/${ILVAR}/lines`))
      return {
        status: 200,
        json: { ready: false, stage: 1, rupture: false, tap: null, annoyed: [], cold: [], comfort: [], claw: null },
      };
    return fixture.answer(call);
  };
  return { answer, view, prompts };
}

async function openRepaintCast(page: Page, reviewPrompts = false) {
  const root = await openOtome(page, { reviewPrompts });
  await root.getByRole("button", { name: "Who’s home" }).click();
  await page.getByRole("dialog", { name: "Who’s home" }).getByRole("button", { name: "Your cast" }).click();
  await expect(root.getByRole("heading", { name: "Your story is ready", exact: true })).toBeVisible();
  return root;
}

test("Otome Hearth expression repaint labels five images, shares busy controls and preserves the current look", async ({
  page,
}, testInfo) => {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => (release = resolve));
  const fixture = expressionRepaintFixture({ wait });
  const calls: Call[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  await stubRoutes(page, fixture.answer, calls);
  try {
    const root = await openRepaintCast(page);
    const button = root.getByRole("button", { name: "Repaint expressions for Ilvar Thorne", exact: true });
    const look = root.getByRole("button", { name: "Repaint Ilvar Thorne’s look", exact: true });
    const actions = root.locator(".of-forge-retry--paints");
    await expect(button).toBeVisible();
    await expect(look).toBeVisible();
    await expect(actions.getByText("Paints 1 image", { exact: true })).toBeVisible();
    await expect(actions.getByText("Paints 5 images", { exact: true })).toBeVisible();
    const original = await root.locator(".of-cast-card").first().locator("img").getAttribute("src");
    const done = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/art/expressions"));
    await button.click();
    await expect(button).toBeDisabled();
    await expect(look).toBeDisabled();
    await expect.poll(() => posts(calls, "/art/expressions").length).toBe(1);
    expect(posts(calls, "/art/expressions")[0]!.body).toMatchObject({ li: ILVAR });
    expect(posts(calls, "/art/paint")).toEqual([]);
    expect(posts(calls, "/art/expressions/prompt")).toEqual([]);
    await expect(root.locator(".of-cast-card").first().locator("img")).toHaveAttribute("src", original!);
    await page.screenshot({ path: testInfo.outputPath("expression-repaint-busy-midnight.png") });
    release();
    await (await done).finished();
    await expect(button).toBeEnabled();
    await expect(root.locator(".of-cast-card").first().locator("img")).toHaveAttribute("src", original!);
    expect(posts(calls, "/art/expressions")).toHaveLength(1);
    expect(errors).toEqual([]);
  } finally {
    release();
  }
});

test("Otome Hearth expression repaint reviews five prompts before paying, cancels cleanly and retains edits after failure", async ({
  page,
}, testInfo) => {
  const fixture = expressionRepaintFixture({ failFirst: true });
  const calls: Call[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await stubRoutes(page, fixture.answer, calls);
  const root = await openRepaintCast(page, true);
  const repaint = root.getByRole("button", { name: "Repaint expressions for Ilvar Thorne", exact: true });
  await repaint.click();
  let dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading")).toContainText("tender (1 of 5)");
  await dialog.getByRole("button", { name: "Cancel repaint", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(posts(calls, "/art/expressions")).toEqual([]);
  await repaint.click();
  const edited = `${"Keep the copper etching. ".repeat(200)}FINAL REVIEW WORDS`;
  for (const [index, face] of REPAINT_FACES.entries()) {
    dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading")).toContainText(`${face} (${index + 1} of 5)`);
    await expect(dialog.getByText("Paints 5 images", { exact: true })).toBeVisible();
    if (index === 0) {
      await dialog.getByLabel("Prompt", { exact: true }).fill(edited);
      await dialog.getByLabel("Negative prompt", { exact: true }).fill("Keep the edited negative whole.");
    }
    expect(posts(calls, "/art/expressions")).toEqual([]);
    if (index < REPAINT_FACES.length - 1) await dialog.getByRole("button", { name: "Review next expression" }).click();
  }
  await page.screenshot({ path: testInfo.outputPath("expression-repaint-last-review-pearl.png") });
  await dialog.getByRole("button", { name: "Repaint 5 expressions", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText(REPAINT_ERROR);
  const first = posts(calls, "/art/expressions")[0]!.body!;
  expect(first).toMatchObject({ li: ILVAR, base: FACE_COLD });
  expect(Object.keys(first.prompts).sort()).toEqual([...REPAINT_FACES].sort());
  expect(first.prompts.tender).toEqual({ prompt: edited, negativePrompt: "Keep the edited negative whole." });
  expect(first.prompts.angry).toEqual(fixture.prompts.angry);
  await expect(dialog.getByLabel("Prompt", { exact: true })).toHaveValue(fixture.prompts.angry.prompt);
  await page.screenshot({ path: testInfo.outputPath("expression-repaint-failure-pearl.png") });
  await dialog.getByRole("button", { name: "Repaint 5 expressions", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(posts(calls, "/art/expressions")).toHaveLength(2);
  expect(posts(calls, "/art/expressions")[1]!.body).toEqual(first);
  expect(posts(calls, "/art/paint")).toEqual([]);
  expect(posts(calls, "/api/audio/generate")).toEqual([]);
  expect(errors).toEqual([]);
});

test("Otome Hearth expression repaint keeps reviewed edits after a concurrent request conflict", async ({
  page,
}, testInfo) => {
  const fixture = expressionRepaintFixture({ conflictFirst: true });
  const calls: Call[] = [];
  await stubRoutes(page, fixture.answer, calls);
  const root = await openRepaintCast(page, true);
  await root.getByRole("button", { name: "Repaint expressions for Ilvar Thorne", exact: true }).click();
  const dialog = page.getByRole("dialog");
  for (const [index, face] of REPAINT_FACES.entries()) {
    await expect(dialog.getByRole("heading")).toContainText(`${face} (${index + 1} of 5)`);
    if (index < REPAINT_FACES.length - 1) await dialog.getByRole("button", { name: "Review next expression" }).click();
  }
  const edited = "Keep this separately reviewed angry expression.";
  const negative = "Keep this separate reviewed negative.";
  await dialog.getByLabel("Prompt", { exact: true }).fill(edited);
  await dialog.getByLabel("Negative prompt", { exact: true }).fill(negative);
  await dialog.getByRole("button", { name: "Repaint 5 expressions", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText("That changed somewhere else. Try again.");
  await expect(dialog.getByLabel("Prompt", { exact: true })).toHaveValue(edited);
  await expect(dialog.getByLabel("Negative prompt", { exact: true })).toHaveValue(negative);
  const first = posts(calls, "/art/expressions")[0]!.body!;
  expect(first.prompts.angry).toEqual({ prompt: edited, negativePrompt: negative });
  await page.screenshot({ path: testInfo.outputPath("expression-repaint-conflict-edits.png") });
  await dialog.getByRole("button", { name: "Repaint 5 expressions", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(posts(calls, "/art/expressions")).toHaveLength(2);
  expect(posts(calls, "/art/expressions")[1]!.body).toEqual(first);
  expect(posts(calls, "/art/paint")).toEqual([]);
  expect(posts(calls, "/api/audio/generate")).toEqual([]);
});

// ── Intimacy (#1936) ──

/** An NSFW story whose cast is ready: Ilvar's bible has no intimacy block yet, Cassian's and Sora's have one. */
function intimacyFixture({ heat = "explicit", confirmed = true } = {}) {
  const fixture = expressionRepaintFixture();
  const { view } = fixture;
  view.world.content.heat = heat;
  view.lis[1].intimacy = true;
  view.lis[2].intimacy = true;
  const ownIndex: Json = { ...index(), ageGate: confirmed ? { confirmedAt: now() } : null };
  const bibles: Record<string, Json> = {
    // Complete enough for the editor's rules (3 mask tells, a stage-4 secret), so a save goes through.
    [ILVAR]: normalizeBible({
      age: 29,
      pronouns: HE,
      publicFace: "A quiet adult cartographer.",
      mask: { presents: "Unbothered", tells: ["folds maps twice", "counts the bells", "won't sit"] },
      secrets: [
        { id: "north-chart", truth: "He drew the chart that sank the fleet.", tells: [], revealAt: { stage: 4 } },
      ],
    })!,
  };
  const base = `/api/otome-forge/runs/${RUN}`;
  const answer = (call: Call): Answer | undefined => {
    if (call.path === "/api/otome-forge/index" || call.path === "/api/otome-forge/index/opened")
      return { status: 200, json: { index: ownIndex } };
    if (call.path === "/api/otome-forge/age-gate") {
      ownIndex.ageGate = { confirmedAt: now() };
      return { status: 200, json: { ageGate: ownIndex.ageGate } };
    }
    if (call.path === `${base}/settings`) {
      if (call.body?.content) view.world.content = call.body.content;
      return { status: 200, json: { world: view.world } };
    }
    const match = new RegExp(`^${base}/lis/([^/]+)/bible$`, "u").exec(call.path);
    if (match) {
      const id = match[1]!;
      if (call.method === "POST") {
        bibles[id] = call.body!.bible;
        if (bibles[id]!.intimacy) view.lis.find((li: Json) => li.id === id).intimacy = true;
      }
      return { status: 200, json: { bible: bibles[id] ?? null } };
    }
    return fixture.answer(call);
  };
  return { answer, view, ownIndex, bibles, base };
}

/** After a reload, back to Your cast (openRepaintCast's handlers and init scripts are already in place). */
async function reopenCast(page: Page) {
  await page.reload();
  await page.getByRole("tab", { name: "Open Otome Hearth", exact: true }).click();
  const root = page.locator("marinara-capability-otome-forge .of-root");
  await root.getByRole("button", { name: "Who’s home" }).click();
  await page.getByRole("dialog", { name: "Who’s home" }).getByRole("button", { name: "Your cast" }).click();
  await expect(root.getByRole("heading", { name: "Your story is ready", exact: true })).toBeVisible();
  return root;
}

for (const theme of ["dark", "light"] as const) {
  test(`Otome Hearth intimacy: the protagonist's role is optional and only for NSFW Heat (${theme})`, async ({
    page,
  }, testInfo) => {
    const fixture = intimacyFixture({ heat: "sfw", confirmed: false });
    const calls: Call[] = [];
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
    await stubRoutes(page, fixture.answer, calls);
    const root = await openRepaintCast(page);
    await expect(root.getByRole("button", { name: /intimacy preferences$/u })).toHaveCount(0);
    await root.getByRole("button", { name: "Settings", exact: true }).click();
    await root.getByRole("tab", { name: "Content", exact: true }).click();
    const role = root.getByRole("group", { name: "Your role in intimacy", exact: true });
    await expect(role).toHaveCount(0);
    await root.getByText("NSFW: Fade", { exact: true }).click();
    const gate = page.getByRole("dialog", { name: "Before we go further", exact: true });
    await gate.getByRole("button", { name: "Not now", exact: true }).click();
    await expect(role).toHaveCount(0);
    await root.getByText("NSFW: Fade", { exact: true }).click();
    await gate.getByRole("button", { name: "I confirm", exact: true }).click();
    await expect(role.getByRole("radio", { name: "Unspecified", exact: true })).toBeChecked();
    const save = root.getByRole("button", { name: "Save changes", exact: true });
    await save.click();
    await expect(save).toBeDisabled();
    expect(posts(calls, "/settings").at(-1)!.body!.content).not.toHaveProperty("mcRole");
    await role.getByText("Switch", { exact: true }).click();
    await save.click();
    await expect(save).toBeDisabled();
    expect(posts(calls, "/settings").at(-1)!.body!.content.mcRole).toBe("switch");
    await role.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`intimacy-mc-role-${theme}.png`) });
    // Back to SFW: the role goes with it.
    await root.getByRole("group", { name: "Heat", exact: true }).getByText("SFW", { exact: true }).click();
    await expect(role).toHaveCount(0);
    await save.click();
    await expect(save).toBeDisabled();
    expect(posts(calls, "/settings").at(-1)!.body!.content).not.toHaveProperty("mcRole");
    await root.locator(".of-topbar").getByRole("button", { name: "Back", exact: true }).click();
    await expect(root.getByRole("button", { name: /intimacy preferences$/u })).toHaveCount(0);
    expect(posts(calls, "/intimacy")).toEqual([]);
  });

  test(`Otome Hearth intimacy: an older bible gains its block from the cast, retried after a failure (${theme})`, async ({
    page,
  }, testInfo) => {
    const fixture = intimacyFixture();
    const calls: Call[] = [];
    let attempts = 0;
    let release!: () => void;
    const wait = new Promise<void>((resolve) => (release = resolve));
    const path = `${fixture.base}/lis/${ILVAR}/intimacy`;
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
    await stubRoutes(
      page,
      (call) => {
        if (call.path !== path) return fixture.answer(call);
        attempts += 1;
        if (attempts === 1) return { status: 502, json: { error: "The model did not answer." } };
        fixture.bibles[ILVAR]!.intimacy = { preferences: ["Being praised"], attractions: ["Ink-stained hands"] };
        return { status: 200, json: { intimacy: true }, wait };
      },
      calls,
    );
    try {
      const root = await openRepaintCast(page);
      const card = root.locator(".of-cast-card").first();
      const openBible = async () => {
        await card.getByRole("button", { name: "Open Ilvar Thorne’s bible (spoilers)", exact: true }).click();
        await root.getByRole("button", { name: "Show spoilers", exact: true }).click();
        await expect(root.getByText("A quiet adult cartographer.", { exact: true })).toBeVisible();
      };
      // The bible read before the fill: the fill must refresh this copy, not leave it to go stale.
      await openBible();
      await expect(root.getByText("Intimacy", { exact: true })).toHaveCount(0);
      await root.getByRole("button", { name: "Back", exact: true }).click();
      const add = card.getByRole("button", { name: "Add Ilvar Thorne’s intimacy preferences", exact: true });
      await expect(add).toBeVisible();
      await expect(root.getByRole("button", { name: /intimacy preferences$/u })).toHaveCount(1);
      await add.click();
      await expect(card.locator(".of-intimacy-fill .of-notice--error")).toBeVisible();
      await add.click();
      await expect(add).toHaveAttribute("aria-disabled", "true");
      await expect(add).toHaveText("Writing…");
      await page.screenshot({ path: testInfo.outputPath(`intimacy-cast-busy-${theme}.png`) });
      release();
      // The button gives way to a status that takes its focus.
      await expect(
        card.getByText("Intimacy preferences added. Read them in the bible, behind Show spoilers.", { exact: true }),
      ).toBeFocused();
      await expect(add).toHaveCount(0);
      expect(posts(calls, "/intimacy")).toHaveLength(2);
      expect(calls.filter((call) => call.method === "POST" && /\/bible$/u.test(call.path))).toEqual([]);
      // Its text stays behind the spoiler gate.
      await expect(root.getByText("Being praised", { exact: true })).toHaveCount(0);
      await openBible();
      await expect(root.getByText("Being praised", { exact: true })).toBeVisible();
      await expect(root.getByText("Ink-stained hands", { exact: true })).toBeVisible();
      expect(posts(calls, "/art/paint")).toEqual([]);
    } finally {
      release();
    }
  });

  test(`Otome Hearth intimacy: the bible shows and edits the block in NSFW stories only (${theme})`, async ({
    page,
  }, testInfo) => {
    const fixture = intimacyFixture();
    fixture.bibles[ILVAR]!.intimacy = { preferences: ["Slow undressing"], attractions: ["A low voice"] };
    fixture.view.lis[0].intimacy = true;
    const calls: Call[] = [];
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
    await stubRoutes(page, fixture.answer, calls);
    let root = await openRepaintCast(page);
    const openBible = async () => {
      await root.getByRole("button", { name: "Open Ilvar Thorne’s bible (spoilers)", exact: true }).click();
      await root.getByRole("button", { name: "Show spoilers", exact: true }).click();
      await expect(root.getByText("A quiet adult cartographer.", { exact: true })).toBeVisible();
    };
    const saved = root.getByText("Saved. The story follows your edits from now on.", { exact: true });
    await openBible();
    const block = root.locator("details").filter({ has: page.locator("summary", { hasText: /^Intimacy$/u }) });
    await expect(block.getByText("Slow undressing", { exact: true })).toBeVisible();
    await expect(block.getByText("A low voice", { exact: true })).toBeVisible();
    await root.getByRole("button", { name: "Edit", exact: true }).click();
    await root.getByRole("textbox", { name: "Into", exact: true }).fill("  Slow undressing  \n\n  Being tied up  ");
    await root.getByRole("textbox", { name: "Drawn to", exact: true }).fill("A low voice\nRough hands");
    await root.getByRole("button", { name: "Save", exact: true }).click();
    await expect(saved).toBeVisible();
    expect(posts(calls, "/bible").at(-1)!.body!.bible.intimacy).toEqual({
      preferences: ["Slow undressing", "Being tied up"],
      attractions: ["A low voice", "Rough hands"],
    });
    await block.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`intimacy-bible-${theme}.png`) });

    // Heat lowered to SFW: the block stays in the bible, out of sight.
    fixture.view.world.content.heat = "sfw";
    root = await reopenCast(page);
    await openBible();
    await expect(root.getByText("Intimacy", { exact: true })).toHaveCount(0);
    await expect(root.getByText("Being tied up", { exact: true })).toHaveCount(0);
    await root.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(root.getByRole("textbox", { name: "Into", exact: true })).toHaveCount(0);
    await root.getByRole("textbox", { name: "Public face", exact: true }).fill("An unrelated SFW edit.");
    await root.getByRole("button", { name: "Save", exact: true }).click();
    await expect(saved).toBeVisible();
    expect(posts(calls, "/bible").at(-1)!.body!.bible.publicFace).toBe("An unrelated SFW edit.");
    expect(posts(calls, "/intimacy")).toEqual([]);
  });
}

// ── Arcs ──

const ROUTE_KEY = `route-${CASSIAN}-3`;
const REPAIR_KEY = `repair-${ILVAR}-1`;

/** `ruptureAtGate`: a rupture with Cassian opens elsewhere once his gate scene is on screen (its reads are refused). */
function createArcStub({ ruptureAtGate = false }: { ruptureAtGate?: boolean } = {}) {
  const stub = { view: runView() };
  let ruptured = false;
  const chapters: Json[] = [
    { key: "main-1", kind: "main", title: "The Observation Room", lead: ILVAR, state: "done", beatsRead: 3, nodes: 3 },
  ];
  const plans = new Map<string, Json>();
  const read = new Set<string>();
  const routes = () => [
    {
      li: ILVAR,
      stage: 1,
      next: { stage: 2, key: `route-${ILVAR}-2`, unlocked: false, requires: { level: 3 }, blockedBy: "rupture" },
    },
    ruptured
      ? {
          li: CASSIAN,
          stage: 2,
          next: { stage: 3, key: ROUTE_KEY, unlocked: false, requires: { level: 5 }, blockedBy: "rupture" },
        }
      : read.has(ROUTE_KEY)
        ? {
            li: CASSIAN,
            stage: 3,
            next: { stage: 4, key: `route-${CASSIAN}-4`, unlocked: false, requires: { level: 7 }, blockedBy: null },
          }
        : {
            li: CASSIAN,
            stage: 2,
            next: { stage: 3, key: ROUTE_KEY, unlocked: true, requires: { level: 5 }, blockedBy: null },
          },
    {
      li: SORA,
      stage: 1,
      next: { stage: 2, key: `route-${SORA}-2`, unlocked: false, requires: { level: 3 }, blockedBy: null },
    },
  ];
  const chapterOf = (key: string, li: string, kind: string, title: string): Json => ({
    key,
    kind,
    li,
    lead: li,
    ...(kind === "route" ? { stage: 3 } : {}),
    title,
    tags: [],
    summary: "",
    nodes: [{ i: 0, kind: "beat", ...(kind === "route" ? { gate: true } : {}) }],
    plannedAt: now(),
  });
  const beatOf = (key: string, lines: Json[]) => ({
    key,
    i: 0,
    kind: "beat",
    places: [],
    segments: lines,
    choices: [],
    choiceCanon: {},
    musicMood: "tender",
    readThrough: 0,
    written,
    rewrites: 0,
  });
  const beats: Record<string, Json> = {
    [ROUTE_KEY]: beatOf(ROUTE_KEY, [
      seg("", "The workshop smells of oil and rain."),
      seg("Cassian", "Stay. I’ll show you what I never show anyone.", { expression: "tender" }),
    ]),
    [REPAIR_KEY]: beatOf(REPAIR_KEY, [seg("", "He is waiting by the door, as if he never left.")]),
  };
  const answer = (call: Call): Answer | undefined => {
    const path = call.path.replace(/^\/api\/otome-forge/u, "");
    const base = `/runs/${RUN}`;
    if (path === "/index" || path === "/index/opened") return { status: 200, json: { index: index() } };
    if (path === base) return { status: 200, json: { view: stub.view } };
    if (path === `${base}/story`) {
      return {
        status: 200,
        json: {
          chapters: [
            ...chapters,
            ...[...plans.values()].map((plan) => ({
              key: plan.key,
              kind: plan.kind,
              title: plan.title,
              li: plan.li,
              lead: plan.lead,
              state: read.has(plan.key) ? "done" : "in-progress",
              beatsRead: read.has(plan.key) ? 1 : 0,
              nodes: 1,
            })),
          ],
          next: null,
          routes: routes(),
          repairs: [
            ...(read.has(REPAIR_KEY) ? [] : [{ li: ILVAR, key: REPAIR_KEY }]),
            ...(ruptured ? [{ li: CASSIAN, key: `repair-${CASSIAN}-1` }] : []),
          ],
        },
      };
    }
    if (path === `${base}/repairs/${ILVAR}`) {
      if (!plans.has(REPAIR_KEY)) plans.set(REPAIR_KEY, chapterOf(REPAIR_KEY, ILVAR, "repair", "What the rain kept"));
      return { status: 200, json: { chapter: plans.get(REPAIR_KEY) }, delay: 400 };
    }
    if (path === `${base}/routes/${CASSIAN}/next`) {
      if (!plans.has(ROUTE_KEY))
        plans.set(ROUTE_KEY, chapterOf(ROUTE_KEY, CASSIAN, "route", "The Workshop at Midnight"));
      return { status: 200, json: { chapter: plans.get(ROUTE_KEY) }, delay: 200 };
    }
    const chapter = /^\/runs\/[^/]+\/chapters\/([^/]+)$/u.exec(path);
    if (chapter && plans.has(chapter[1]!)) {
      return {
        status: 200,
        json: {
          chapter: plans.get(chapter[1]!),
          beats: [{ i: 0, state: read.has(chapter[1]!) ? "read" : "ready" }],
        },
      };
    }
    const beat = /^\/runs\/[^/]+\/chapters\/([^/]+)\/beats\/0(?:\/(read|ease-off))?$/u.exec(path);
    if (beat && beats[beat[1]!]) {
      const key = beat[1]!;
      // As S/story/beats.ts answers while a rupture holds his route chapter: a rewrite (a new, unseen scene), an Ease
      // off or the gate's end.
      const held = ruptured && key === ROUTE_KEY;
      const refused = {
        status: 409,
        json: { error: "A rupture stands between you: this route chapter waits until it is repaired.", code: "locked" },
      };
      if (!beat[2]) {
        if (held && call.body?.rewrite) return refused;
        ruptured ||= ruptureAtGate && key === ROUTE_KEY;
        return { status: 200, json: { beat: beats[key] } };
      }
      if (held) return refused;
      if (beat[2] === "ease-off") return undefined;
      const end = beats[key]!.segments.length - 1;
      if (call.body!.segment < end || read.has(key)) return { status: 200, json: readResult(stub) };
      read.add(key);
      if (key === ROUTE_KEY) {
        return {
          status: 200,
          json: readResult(
            stub,
            [
              { source: "beat", starlight: 30 },
              { source: "chapter", starlight: 300 },
              { source: "lead", li: CASSIAN, affection: 150 },
            ],
            { chapterDone: true, stageUp: { li: CASSIAN, stage: 3 } },
          ),
        };
      }
      return {
        status: 200,
        json: readResult(stub, [{ source: "beat", starlight: 30 }], { chapterDone: true, repaired: ILVAR }),
      };
    }
    if (path === `${base}/cancel`) return { status: 200, json: { ok: true } };
    return undefined;
  };
  return { stub, answer };
}

test("Otome Forge arcs: a rupture's banner plans the repair, routes open, wait or stay shut, and a gate shows its stage", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  const calls: Call[] = [];
  const { answer } = createArcStub();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubRoutes(page, answer, calls);
  const root = await openStory(page);

  // The rupture, in the pronouns his bible gives him; his route waits behind it, Sora's behind affection.
  const rupture = root.getByRole("region", { name: "Ilvar Thorne is keeping his distance" });
  await expect(rupture).toContainText("Until you do, his route stays shut.");
  const routes = root.getByRole("region", { name: "Routes" });
  const ilvar = routes.getByRole("listitem").filter({ hasText: "Ilvar Thorne" });
  await expect(ilvar).toContainText("Shut while Ilvar Thorne keeps his distance.");
  const sora = routes.getByRole("listitem").filter({ hasText: "Sora" });
  await expect(sora).toContainText("Affection 3 · her next chapter");
  await expect(sora).toContainText("Opens at affection 3 · now 1");
  await expect(sora.getByRole("button")).toHaveCount(0);
  const cassian = routes.getByRole("listitem").filter({ hasText: "Cassian" });
  await expect(cassian).toContainText("Stage 2 · Crack");
  await expect(cassian).toContainText("Next: Pull");
  await page.screenshot({ path: testInfo.outputPath("01-routes.png"), fullPage: false });

  // Make it right: one plan (with Cancel while it runs), then the repair chapter opens with focus on its title.
  const makeItRight = rupture.getByRole("button", { name: "Make it right with Ilvar Thorne" });
  await makeItRight.click();
  const planning = page.getByRole("dialog", { name: "Making it right with Ilvar Thorne" });
  await expect(planning).toContainText("Planning how to make it right with Ilvar Thorne…");
  await expect(planning.getByRole("button", { name: "Cancel" })).toBeFocused();
  await expect(root.getByRole("heading", { level: 1 })).toContainText("What the rain kept");
  await expect(root.getByRole("heading", { level: 1 })).toBeFocused();
  expect(posts(calls, `/repairs/${ILVAR}`)).toHaveLength(1);
  await expect(line(root)).toContainText("He is waiting by the door");
  await next(root);
  await expect(root.getByText("Made right with Ilvar Thorne: the route is open again.")).toBeVisible();
  await root.getByRole("button", { name: "Back to the story" }).click();
  await expect(root.getByRole("region", { name: "Ilvar Thorne is keeping his distance" })).toHaveCount(0);

  // Cassian's route chapter: planned once, read to its gate, and the chapter's end names the stage it opened.
  await root.getByRole("button", { name: "Begin Cassian’s next chapter" }).click();
  await expect(root.getByRole("heading", { level: 1 })).toContainText("The Workshop at Midnight");
  expect(posts(calls, `/routes/${CASSIAN}/next`)).toHaveLength(1);
  await next(root);
  await next(root);
  await expect(root.getByRole("heading", { name: "Chapter complete" })).toBeFocused();
  await expect(root.getByText("Cassian · stage 3, Pull")).toBeVisible();
  await expect(root.getByText("+300 Starlight")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("02-gate.png") });
  await root.getByRole("button", { name: "Back to the story" }).click();
  await expect(
    root.getByRole("region", { name: "Routes" }).getByRole("listitem").filter({ hasText: "Cassian" }),
  ).toContainText("Opens at affection 7");
  expect(pageErrors).toEqual([]);
});

test("Otome Forge arcs: a rupture that opens elsewhere holds a gate scene, says with whom, and leads back to Make it right", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  const calls: Call[] = [];
  const { answer } = createArcStub({ ruptureAtGate: true });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubRoutes(page, answer, calls);
  const root = await openStory(page);
  await root.getByRole("button", { name: "Begin Cassian’s next chapter" }).click();
  await expect(root.getByRole("heading", { level: 1 })).toContainText("The Workshop at Midnight");

  // The gate's end is refused (409 locked): the scene stays, and the notice names him instead of the generic one.
  await next(root);
  const held = root.locator(".of-reader-notice");
  await expect(held).toContainText(
    "Something has come between you and Cassian. This scene waits until you make it right",
  );
  await expect(held).not.toContainText("That isn’t open yet.");
  await expect(held.getByRole("button")).toHaveText(["Back to the story"]);
  await expect(line(root)).toContainText("Stay. I’ll show you");
  // Next sends the end again and is refused again: the same notice, and the chapter does not end.
  await next(root);
  await expect(held).toContainText("between you and Cassian");
  await expect(root.getByRole("heading", { name: "Chapter complete" })).toHaveCount(0);
  expect(posts(calls, `/chapters/${ROUTE_KEY}/beats/0/read`).length).toBeGreaterThanOrEqual(2);
  await page.screenshot({ path: testInfo.outputPath("03-rupture-hold.png") });

  // Back on the story screen, the rupture's banner offers Make it right with him.
  await held.getByRole("button", { name: "Back to the story" }).click();
  const rupture = root.getByRole("region", { name: "Cassian is keeping his distance" });
  await expect(rupture.getByRole("button", { name: "Make it right with Cassian" })).toBeVisible();
  await expect(
    root.getByRole("region", { name: "Routes" }).getByRole("listitem").filter({ hasText: "Cassian" }),
  ).toContainText("Shut while Cassian keeps his distance.");
  expect(pageErrors).toEqual([]);
});

for (const refused of ["Rewrite", "Ease off"] as const) {
  test(`Otome Forge arcs: a rupture that opens elsewhere refuses ${refused} on a route scene, and the reader says with whom`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const calls: Call[] = [];
    const { answer } = createArcStub({ ruptureAtGate: true });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await stubRoutes(page, answer, calls);
    const root = await openStory(page);
    await root.getByRole("button", { name: "Begin Cassian’s next chapter" }).click();
    await expect(line(root)).toContainText("The workshop smells of oil and rain.");

    await setReaderControlsExpanded(root);
    if (refused === "Rewrite") await root.getByRole("button", { name: /Rewrite/u }).click();
    else {
      await root.getByRole("button", { name: "Ease off" }).click();
      const ease = page.getByRole("dialog", { name: "Ease off?" });
      await ease.getByRole("button", { name: "Ease off" }).click();
      await expect(ease, "the dialog closes: the reader says why").toBeHidden();
    }
    const held = root.locator(".of-reader-notice");
    await expect(held).toContainText(
      "Something has come between you and Cassian. This scene waits until you make it right",
    );
    const sent =
      refused === "Rewrite"
        ? posts(calls, `/chapters/${ROUTE_KEY}/beats/0`).filter((call) => call.body?.rewrite)
        : posts(calls, "/ease-off");
    expect(sent).toHaveLength(1);
    await expect(held).not.toContainText("That isn’t open yet.");
    await expect(held.getByRole("button")).toHaveText(["Back to the story"]);
    // The scene stays as it was, and neither Rewrite nor Ease off is offered while it is held.
    await expect(line(root)).toContainText("The workshop smells of oil and rain.");
    await expect(root.getByRole("button", { name: /Rewrite/u })).toHaveCount(0);
    await expect(root.getByRole("button", { name: "Ease off" })).toHaveCount(0);
    // Back on the story screen, the rupture's banner offers Make it right with him.
    await setReaderControlsExpanded(root, false);
    await held.getByRole("button", { name: "Back to the story" }).click();
    const rupture = root.getByRole("region", { name: "Cassian is keeping his distance" });
    await expect(rupture.getByRole("button", { name: "Make it right with Cassian" })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
}

// ── The reader: a CG, faces, voices, music and the Confrontation ──

function createSceneStub({
  ask = false,
  images = true,
  audio = true,
  climax = "confrontation",
}: { ask?: boolean; images?: boolean; audio?: boolean | Json; climax?: "confrontation" | "closer" } = {}) {
  const placeArt = ask ? { state: "waiting-consent", at: now() } : { state: "ready", at: now(), url: PLACE_ART };
  const stub = {
    view: runView({
      images: images ? { connectionId: "conn-image", ask } : {},
      audio: audio
        ? { tts: true, generate: true, audioConnectionId: "conn-audio", ...(audio === true ? {} : audio) }
        : {},
      places: images
        ? { "the-observation-room": { name: "The Observation Room", tags: "glass dome, night", art: placeArt } }
        : {},
    }),
  };
  const cgArt: Json = ask ? { state: "waiting-consent", at: now() } : { state: "ready", at: now(), url: CG_ART };
  const beat0: Json = {
    key: "main-1",
    i: 0,
    kind: "beat",
    places: [{ name: "The Observation Room", tags: "glass dome, night" }],
    segments: [
      seg("", "Rain needles the glass dome.", { place: "The Observation Room" }),
      seg("Ilvar Thorne", "You came back. How inefficient of you.", { expression: "cold" }),
      seg("Mira Vale", "I should have stayed away. I didn’t.", { thought: true }),
      seg("Ilvar", "Stay, then. The data can wait.", { expression: "tender" }),
    ],
    choices: [],
    choiceCanon: {},
    musicMood: "tense",
    cg: { at: 3, brief: "Two figures under a glass dome", cast: ["Ilvar Thorne"], ...(images ? { art: cgArt } : {}) },
    readThrough: 0,
    written,
    rewrites: 0,
  };
  const option = (label: string, text: string) => ({ label, selection: { kind: "dialogue", text } });
  // The Closer (#1938): the warm climax, on the same stance route with its own answers and endings.
  const CLOSER_ROUNDS: Json[] = [
    {
      round: 1,
      his: [seg("Ilvar Thorne", "I used to come up here alone, before the data.", { expression: "tender" })],
      options: {
        reassure: option("Stay close.", "I’m right here."),
        tease: option("Tease him.", "You? Alone with the stars? Shocking."),
        mirror: option("Share your own.", "I had a roof like this, once."),
        ask: option("Ask why.", "Why did you stop coming?"),
      },
      answers: { reassure: [seg("Ilvar Thorne", "…I know you are.", { expression: "tender" })] },
    },
    {
      round: 2,
      his: [seg("Ilvar Thorne", "My father counted stars. I counted him.", { expression: "hurt" })],
      options: {
        reassure: option("Hold his hand.", "You’re not counting alone now."),
        tease: option("Lighten it.", "And who won?"),
        mirror: option("Tell him yours.", "Mine left before I could count."),
        ask: option("Ask more.", "Did he ever look back?"),
      },
      answers: { mirror: [seg("Ilvar Thorne", "…Then we’re the same.", { expression: "flustered" })] },
    },
    {
      round: 3,
      his: [seg("Ilvar Thorne", "Stay until the dome clears.", { expression: "tender" })],
      options: {
        reassure: option("Promise.", "Until morning."),
        tease: option("Bargain.", "Only if you make coffee."),
        mirror: option("Say it back.", "I wanted to ask you the same."),
        ask: option("Ask him.", "Why tonight?"),
      },
      answers: { reassure: [seg("Ilvar Thorne", "Good.", { expression: "tender" })] },
    },
  ];
  const ROUNDS: Json[] =
    climax === "closer"
      ? CLOSER_ROUNDS
      : [
          {
            round: 1,
            his: [seg("Ilvar Thorne", "Say it. Whatever you came to say.", { expression: "cold" })],
            options: {
              press: option("Make him answer.", "Why did you lock me out?"),
              hold: option("Wait him out.", "I’m not leaving until you talk."),
              yield: option("Let it go, for now.", "We don’t have to do this tonight."),
              reveal: option("Tell him you were scared.", "I was scared for you."),
            },
            answers: { press: [seg("Ilvar Thorne", "You want the truth? Fine.", { expression: "angry" })] },
          },
          {
            round: 2,
            his: [seg("Ilvar Thorne", "…It was never about the data.", { expression: "hurt" })],
            options: {
              press: option("Push harder.", "Then what was it about?"),
              hold: option("Stay with him.", "I’m listening."),
              yield: option("Soften.", "You don’t owe me this."),
              reveal: option("Say what you saw.", "I saw your hands shake."),
            },
            answers: { hold: [seg("Ilvar Thorne", "Don’t look at me like that.", { expression: "tender" })] },
          },
          {
            round: 3,
            his: [seg("Ilvar Thorne", "Ask me. Properly.", { expression: "tender" })],
            options: {
              press: option("Demand it.", "Tell me everything."),
              hold: option("Ask him.", "What are you afraid of?"),
              yield: option("Give him room.", "Only if you want to."),
              reveal: option("Go first.", "I’m afraid of losing you."),
            },
            answers: { reveal: [seg("Ilvar Thorne", "…You too?", { expression: "tender" })] },
          },
        ];
  const ENDING =
    climax === "closer"
      ? { kind: "opened", segments: [seg("Ilvar Thorne", "I’ve never shown anyone this.", { expression: "tender" })] }
      : {
          kind: "truth",
          segments: [seg("Ilvar Thorne", "I was afraid you’d leave. So I left first.", { expression: "hurt" })],
        };
  const picks: string[] = [];
  const roundView = (index: number) => {
    const round = ROUNDS[index]!;
    const picked = picks[index];
    return {
      round: round.round,
      his: round.his,
      options: Object.fromEntries(
        Object.entries(round.options).map(([stance, value]) => [
          stance,
          stance === picked ? { ...(value as Json), segments: round.answers[stance] } : value,
        ]),
      ),
      ...(picked ? { picked } : {}),
    };
  };
  const confrontationView = () => ({
    key: "main-1",
    i: 1,
    kind: climax,
    li: ILVAR,
    places: [],
    musicMood: climax === "closer" ? "confession" : "angst",
    readThrough: 0,
    written,
    rewrites: 0,
    opening: [seg("", "The dome again. He hasn’t slept.")],
    rounds: Array.from({ length: Math.min(picks.length + 1, ROUNDS.length) }, (_, index) => roundView(index)),
    ...(picks.length === ROUNDS.length ? { ending: ENDING } : {}),
  });
  const CHAPTER = {
    key: "main-1",
    kind: "main",
    number: 1,
    lead: ILVAR,
    foil: CASSIAN,
    title: "The Observation Room",
    tags: [],
    summary: "",
    nodes: [
      { i: 0, kind: "beat", cg: true },
      { i: 1, kind: climax },
    ],
    plannedAt: now(),
  };
  let beatsRead = 0;
  let unlocked = false;
  let tracks: Json[] = [...stub.view.world.audio.tracks];
  const answer = (call: Call): Answer | undefined => {
    if (call.path.startsWith("/api/tts/")) {
      if (call.path === "/api/tts/config") {
        return {
          status: 200,
          json: {
            enabled: true,
            connectionId: "conn-tts",
            connectionProfiles: {
              "conn-tts": {
                voiceAssignments: [{ characterId: "card-ilvar", voice: "Ilvar Voice" }],
                npcDefaultMaleVoices: ["Pool Male"],
                npcDefaultFemaleVoices: ["Pool Female"],
              },
            },
          },
        };
      }
      if (call.path === "/api/tts/voices") return { status: 200, json: { voices: ["Pool Male", "Pool Female"] } };
      if (call.path === "/api/tts/speak") return { status: 200, body: WAV, contentType: "audio/wav" };
      return undefined;
    }
    if (call.path === "/api/audio/config") {
      return { status: 200, json: { connectionId: "conn-audio", configured: true, music: true, soundEffects: false } };
    }
    if (call.path === "/api/audio/generate") {
      const key = call.body!.context.key;
      return {
        status: 200,
        json: { tag: `music:contexts:otome-forge:${key}:made-1`, path: `music/contexts/otome-forge/${key}/made-1.mp3` },
      };
    }
    if (call.path === "/api/game-assets/manifest") {
      return {
        status: 200,
        json: {
          scannedAt: now(),
          count: 2,
          assets: {
            // The Engine's library layout (music:<state>:<genre>:<intensity>:<name>); selectDefaultMusic reads no other.
            "music:dialogue:slice_of_life:calm:morning-tea": {
              path: "music/dialogue/slice_of_life/calm/morning-tea.mp3",
            },
            "music:exploration:horror:tense:night-walk": { path: "music/exploration/horror/tense/night-walk.mp3" },
          },
          byCategory: {},
        },
      };
    }
    if (call.path.startsWith("/api/game-assets/file/")) return { status: 200, body: WAV, contentType: "audio/wav" };
    const path = call.path.replace(/^\/api\/otome-forge/u, "");
    const base = `/runs/${RUN}`;
    if (path === "/index" || path === "/index/opened") return { status: 200, json: { index: index() } };
    if (path === base) return { status: 200, json: { view: stub.view } };
    if (path === `${base}/story`) {
      return {
        status: 200,
        json: {
          chapters: [
            {
              key: "main-1",
              kind: "main",
              title: CHAPTER.title,
              lead: ILVAR,
              state: beatsRead >= 2 ? "done" : "in-progress",
              beatsRead,
              nodes: 2,
            },
          ],
          next: null,
          routes: [],
          repairs: [],
        },
      };
    }
    if (path === `${base}/chapters/main-1`) {
      return {
        status: 200,
        json: {
          chapter: CHAPTER,
          beats: [
            { i: 0, state: beatsRead > 0 ? "read" : "ready" },
            { i: 1, state: beatsRead > 1 ? "read" : "ready" },
          ],
        },
      };
    }
    if (path === `${base}/art/scene`) {
      const i = Number(call.query.get("i"));
      return {
        status: 200,
        json: {
          places: i === 0 ? [{ ...stub.view.world.places["the-observation-room"] }] : [],
          cg: i === 0 ? beat0.cg : null,
          faces: { [ILVAR]: { cold: FACE_COLD, tender: FACE_TENDER, angry: FACE_ANGRY, hurt: FACE_HURT } },
          facesComing: [],
        },
      };
    }
    if (path === `${base}/art/cg/prompt`) {
      return { status: 200, json: { prompt: "Two figures under a glass dome, rain.", negativePrompt: "text" } };
    }
    if (path === `${base}/art/cg`) {
      beat0.cg.art = { state: "ready", at: now(), url: CG_ART };
      return { status: 200, json: { art: beat0.cg.art }, delay: 300 };
    }
    if (path === `${base}/art/place`) {
      stub.view.world.places["the-observation-room"].art = { state: "ready", at: now(), url: PLACE_ART };
      return { status: 200, json: { place: stub.view.world.places["the-observation-room"], world: stub.view.world } };
    }
    if (path === `${base}/art/cg/seen`) {
      // Unlocked only once the CG is ready and the read has reached its line (S/art/cg.ts).
      if (beat0.cg.art?.state !== "ready" || beat0.readThrough < beat0.cg.at)
        return { status: 409, json: { error: "Not seen yet.", code: "conflict" } };
      const first = !unlocked;
      unlocked = true;
      return { status: 200, json: { unlocked: first, album: { cgs: [] } } };
    }
    if (path === `${base}/audio/brief`) {
      // As the real route does (S/audio/music.ts): a world whose saved settings do not generate music has no brief.
      if (!stub.view.world.audio.generate)
        return { status: 409, json: { error: "This world does not generate music.", code: "conflict" } };
      return { status: 200, json: { prompt: `A ${call.body!.cue} piano loop for a clockwork city.` } };
    }
    if (path === `${base}/audio/track`) {
      const { timeZone: _zone, debugMode: _debug, ...track } = call.body!;
      tracks = [...tracks.filter((item) => item.tag !== track.tag), track];
      return { status: 200, json: { tracks } };
    }
    if (path === `${base}/audio/settings`) {
      stub.view.world.audio = { ...stub.view.world.audio, ...call.body!.audio, tracks };
      return { status: 200, json: { audio: stub.view.world.audio } };
    }
    if (path === `${base}/cancel`) return { status: 200, json: { ok: true } };
    const match = /^\/runs\/[^/]+\/chapters\/main-1\/beats\/(\d+)(?:\/(read|stance))?$/u.exec(path);
    if (match) {
      const i = Number(match[1]);
      if (i === 0) {
        if (!match[2]) return { status: 200, json: { beat: beat0 } };
        beat0.readThrough = Math.max(beat0.readThrough, Math.min(3, call.body!.segment));
        if (call.body!.segment < 3 || beatsRead > 0) return { status: 200, json: readResult(stub) };
        beatsRead = 1;
        return { status: 200, json: readResult(stub, [{ source: "beat", starlight: 30 }]) };
      }
      const view = confrontationView();
      if (!match[2])
        return {
          status: 200,
          json: { beat: { ...view, segments: view.opening, choices: [], choiceCanon: {} }, confrontation: view },
        };
      if (match[2] === "stance") {
        const { round, stance } = call.body!;
        // Idempotent: a stance already taken returns what it did.
        if (round === picks.length + 1) picks.push(stance);
        const played = roundView(round - 1);
        const after = confrontationView();
        return {
          status: 200,
          json: {
            round: played,
            ...(round < ROUNDS.length ? { next: roundView(round) } : { ending: ENDING }),
            confrontation: after,
            remembered: false,
            rememberedBy: [],
          },
        };
      }
      // A read: the whole stance game counts once its ending exists.
      if (picks.length < ROUNDS.length || beatsRead > 1) return { status: 200, json: readResult(stub) };
      beatsRead = 2;
      return {
        status: 200,
        json: readResult(
          stub,
          [
            { source: "beat", starlight: 30 },
            { source: "chapter", starlight: 160 },
            { source: "lead", li: ILVAR, affection: 150 },
          ],
          { chapterDone: true },
        ),
      };
    }
    return undefined;
  };
  return { stub, answer, beat0 };
}

test("Otome Hearth imageless play: intended appearance is readable without Bible spoilers or model calls", async ({
  page,
}, testInfo) => {
  const fixture = expressionRepaintFixture();
  fixture.view.world.images.connectionId = null;
  const appearance = "adult man, silver hair, amber eyes";
  fixture.view.lis[0].look = {
    identityLine: "adult man, silver hair, amber eyes",
    outfitLine: "navy coat, brass buttons",
  };
  delete fixture.view.lis[0].portrait;
  delete fixture.view.lis[0].art;
  const calls: Call[] = [];
  await stubRoutes(page, fixture.answer, calls);
  const root = await openRepaintCast(page);
  const card = root.locator(".of-cast-card").filter({ hasText: "Ilvar Thorne" });
  const field = card.getByRole("textbox", { name: "Image appearance", exact: true });
  await field.focus();
  await expect(field).toBeFocused();
  await expect(field).toHaveValue(appearance);
  expect(calls.filter((call) => /\/bible(?:$|\?)/u.test(call.path))).toEqual([]);
  expect(calls.filter((call) => call.method === "POST" && /\/art\/|\/api\/audio\/generate/u.test(call.path))).toEqual(
    [],
  );
  await page.screenshot({ path: testInfo.outputPath("imageless-appearance.png"), animations: "disabled" });
});

test("Otome Hearth Closer: three answers on their own pills, the guard never shown, and the Opened up card (#1938)", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const calls: Call[] = [];
  const fixture = createSceneStub({ images: false, audio: false, climax: "closer" });
  await stubRoutes(page, fixture.answer, calls);
  const root = await openStory(page);
  await root.getByRole("button", { name: "Continue", exact: true }).first().click();
  await expect(displayedLine(root)).toHaveText("Rain needles the glass dome.");
  for (let k = 0; k < 4; k += 1) await next(root);
  await expect(line(root)).toContainText("The dome again.");
  await expect(root.locator(".of-reader-chip--frame")).toHaveText("Closer");
  await next(root);
  const round1 = root.getByRole("group", { name: /Round 1 of 3/u });
  await expect(round1.getByRole("button")).toHaveCount(4);
  for (const name of ["Reassure", "Tease", "Mirror", "Ask"]) {
    await expect(round1.getByRole("button", { name: new RegExp(`^${name}`, "u") })).toBeVisible();
  }
  await expect(round1.getByRole("button", { name: /Press|Hold|Yield|Reveal/u })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("closer-answers.png") });
  await round1.getByRole("button", { name: /^Reassure/u }).click();
  await expect(line(root)).toContainText("I’m right here.");
  expect(posts(calls, "/stance")[0]!.body).toMatchObject({ round: 1, stance: "reassure" });
  await next(root);
  await next(root);
  await root
    .getByRole("group", { name: /Round 2 of 3/u })
    .getByRole("button", { name: /^Mirror/u })
    .click();
  await next(root);
  await next(root);
  await root
    .getByRole("group", { name: /Round 3 of 3/u })
    .getByRole("button", { name: /^Reassure/u })
    .click();
  await next(root);
  await next(root);
  await expect(line(root)).toContainText("I’ve never shown anyone this.");
  expect(posts(calls, "/stance").map((call) => call.body!.stance)).toEqual(["reassure", "mirror", "reassure"]);
  // The ending's card names it in words, never numbers.
  await next(root);
  await expect(root.getByRole("heading", { name: "Ilvar Thorne lets you in" })).toBeFocused();
  await expect(root.getByText("The moment passes", { exact: true })).toBeVisible();
  await expect(root.locator(".of-outcome")).not.toContainText(/\d/u);
  await page.screenshot({ path: testInfo.outputPath("closer-opened.png") });
  await root.getByRole("button", { name: "Go on" }).click();
  await expect(root.getByRole("heading", { name: "Chapter complete" })).toBeFocused();
});

test("Otome Hearth imageless play: old locations and key moments can be painted explicitly with prompt review", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const fixture = createSceneStub({ ask: true, audio: false });
  delete fixture.stub.view.world.places["the-observation-room"].art;
  delete fixture.beat0.cg.art;
  const calls: Call[] = [];
  await stubRoutes(
    page,
    (call) =>
      call.path.endsWith("/art/place/prompt")
        ? { status: 200, json: { prompt: "Glass dome, night, rain.", negativePrompt: "text" } }
        : fixture.answer(call),
    calls,
  );
  const root = await openStory(page, { reviewPrompts: true });
  await root.getByRole("button", { name: "Continue", exact: true }).first().click();
  await expect(displayedLine(root)).toHaveText("Rain needles the glass dome.");
  expect(posts(calls, "/art/place")).toEqual([]);
  // The description stands in for an unpainted picture, and goes once it is painted (#1941).
  const description = root.locator(".of-reader-head .of-image-description");
  await expect(description).toContainText("glass dome, night");
  const paintPlace = root.getByRole("button", { name: "Paint The Observation Room (1 image)", exact: true });
  await expect(paintPlace).toHaveText("Paint · 1 image");
  await paintPlace.click();
  let review = page.getByRole("dialog");
  await expect(review.getByLabel("Prompt", { exact: true })).toHaveValue("Glass dome, night, rain.");
  await expect(review.getByText("Paints 1 image", { exact: true })).toBeVisible();
  expect(posts(calls, "/art/place")).toEqual([]);
  await review.getByRole("button", { name: "Paint", exact: true }).click();
  await expect(review).toHaveCount(0);
  await expect(paintPlace).toHaveCount(0);
  expect(posts(calls, "/art/place")).toHaveLength(1);
  await expect(description).toHaveCount(0);
  await next(root);
  await next(root);
  await next(root);
  await expect(root.getByRole("button", { name: "Paint this moment", exact: true })).toBeVisible();
  await expect(description).toContainText("Two figures under a glass dome");
  await expect(description).not.toContainText("glass dome, night");
  expect(posts(calls, "/art/cg")).toEqual([]);
  await root.getByRole("button", { name: "Paint this moment", exact: true }).click();
  review = page.getByRole("dialog");
  await expect(review.getByLabel("Prompt", { exact: true })).toHaveValue("Two figures under a glass dome, rain.");
  expect(posts(calls, "/art/cg")).toEqual([]);
  await review.getByRole("button", { name: "Paint", exact: true }).click();
  await expect(review).toHaveCount(0);
  await expect(root.getByRole("img", { name: "An illustration: Ilvar Thorne" })).toBeVisible();
  await expect(description).toHaveCount(0);
  expect(posts(calls, "/art/cg")).toHaveLength(1);
  expect(posts(calls, "/art/paint")).toEqual([]);
  expect(posts(calls, "/api/audio/generate")).toEqual([]);
});

test("Otome Hearth story header: a painted picture whose file fails to load gets its description back (#1941)", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const fixture = createSceneStub({ audio: false });
  const broken = (name: string) => `/api/global-gallery/file/${name}.png`;
  fixture.stub.view.world.places["the-observation-room"].art = { state: "ready", at: now(), url: broken("lost-place") };
  fixture.beat0.cg.art = { state: "ready", at: now(), url: broken("lost-cg") };
  await page.route("**/api/global-gallery/file/lost-*", (route) => route.fulfill({ status: 404, body: "gone" }));
  const calls: Call[] = [];
  await stubRoutes(page, fixture.answer, calls);
  const root = await openStory(page);
  await root.getByRole("button", { name: "Continue", exact: true }).first().click();
  await expect(displayedLine(root)).toHaveText("Rain needles the glass dome.");
  // Painted, but nothing on screen: the description stands in for the background.
  const description = root.locator(".of-reader-head .of-image-description");
  await expect(description).toContainText("glass dome, night");
  // The key image's file is gone too: its brief stands in for it, as for one never painted.
  await next(root);
  await next(root);
  await next(root);
  await expect(description).toContainText("Two figures under a glass dome");
  expect(posts(calls, "/art/place")).toEqual([]);
  expect(posts(calls, "/art/cg")).toEqual([]);
});

test("Otome Hearth imageless play: full visual descriptions keep reading controls reachable and keyboard scroll does not advance", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  const fixture = createSceneStub({ ask: true, audio: false });
  const description = `${"marble floor,\n".repeat(30)}FINAL VISUAL DETAIL`;
  expect(description.length).toBeLessThan(600);
  fixture.stub.view.world.places["the-observation-room"].tags = description;
  const calls: Call[] = [];
  await stubRoutes(page, fixture.answer, calls);
  const root = await openStory(page);
  await root.getByRole("button", { name: "Continue", exact: true }).first().click();
  await expect(displayedLine(root)).toHaveText("Rain needles the glass dome.");
  const disclosure = root.locator(".of-reader-head .of-image-description");
  await disclosure.locator("summary").click();
  await expect(root.locator(".of-next")).toBeInViewport({ ratio: 0.99 });
  const descriptionText = disclosure.getByRole("region", { name: "Image description", exact: true });
  expect(await descriptionText.textContent()).toBe(description);
  await descriptionText.focus();
  await expect(descriptionText).toBeFocused();
  await page.keyboard.press("PageDown");
  await expect.poll(() => descriptionText.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await page.keyboard.press("End");
  await expect
    .poll(() => descriptionText.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop))
    .toBeLessThanOrEqual(1);
  await expect(displayedLine(root)).toHaveText("Rain needles the glass dome.");
  expect(calls.filter((call) => call.method === "POST" && /\/art\/(place|cg)(?:\/prompt)?$/u.test(call.path))).toEqual(
    [],
  );
  await page.screenshot({ path: testInfo.outputPath("imageless-description-midnight.png"), animations: "disabled" });
});

test("Otome Hearth backgrounds: reading waits for the current place paint and image decode", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const calls: Call[] = [];
  const fixture = createSceneStub();
  fixture.stub.view.lis[0].cut = [FACE_COLD];
  let painted = false;
  let decodeRequested = false;
  let releaseImage!: () => void;
  const imageWait = new Promise<void>((resolve) => {
    releaseImage = resolve;
  });
  const imageUrl = "/api/otome-forge/background-preparation.svg";
  const currentPlace = () => ({
    name: "The Observation Room",
    tags: "glass dome, night",
    art: painted ? { state: "ready", at: now(), url: imageUrl } : { state: "pending", at: now() },
  });
  fixture.stub.view.world.places = { "the-observation-room": currentPlace() };
  await stubRoutes(
    page,
    (call) => {
      if (call.path === imageUrl) {
        decodeRequested = true;
        return {
          status: 200,
          body: Buffer.from(
            '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="18"><rect width="32" height="18" fill="#3a2a4f"/></svg>',
          ),
          contentType: "image/svg+xml",
          wait: imageWait,
        };
      }
      const reply = fixture.answer(call);
      if (call.path.endsWith("/beats/0") && call.method === "POST") {
        const result = reply!.json as Json;
        return {
          ...reply!,
          json: {
            ...result,
            beat: {
              ...result.beat,
              cg: null,
              choices: [],
              segments: [
                seg("Ilvar Thorne", "Stay inside the lab until its lights settle.", {
                  place: "The Observation Room",
                  expression: "cold",
                }),
              ],
            },
          },
        };
      }
      if (call.path.endsWith("/art/scene"))
        return {
          status: 200,
          json: {
            places: [
              currentPlace(),
              { name: "A later room", tags: "stone corridor", art: { state: "pending", at: now() } },
            ],
            cg: { at: 0, brief: "The lab's lights", cast: ["Ilvar Thorne"], art: { state: "pending", at: now() } },
            faces: {},
            facesComing: [ILVAR],
          },
        };
      return reply;
    },
    calls,
  );
  const root = await openStory(page);
  await root.getByRole("button", { name: "Continue" }).first().click();
  const preparing = root.getByRole("status").filter({ hasText: "Preparing the background…" });
  await expect(preparing).toBeVisible();
  await expect(line(root)).toHaveCount(0);
  await root.locator(".of-reader").focus();
  await page.keyboard.press("ArrowRight");
  await root.locator(".of-reader-stage").click();
  await setReaderControlsExpanded(root);
  await expect(root.getByRole("button", { name: "Auto", exact: true })).toBeDisabled();
  await expect(root.getByRole("button", { name: "Skip what you’ve read" })).toBeDisabled();
  await root.getByRole("button", { name: "Backlog" }).click();
  await expect(
    page.getByRole("dialog", { name: "Backlog" }).getByText("Stay inside the lab until its lights settle."),
  ).toHaveCount(0);
  await page.getByRole("dialog", { name: "Backlog" }).getByRole("button", { name: "Close" }).click();
  expect(posts(calls, "/read")).toHaveLength(0);
  expect(posts(calls, "/api/tts/speak")).toHaveLength(0);
  painted = true;
  await expect.poll(() => decodeRequested).toBe(true);
  await expect(preparing).toBeVisible();
  await expect(line(root)).toHaveCount(0);
  expect(posts(calls, "/read")).toHaveLength(0);
  releaseImage();
  await expect(displayedLine(root)).toHaveText("Stay inside the lab until its lights settle.");
  await expect(line(root).locator(".of-visually-hidden")).toHaveText("Stay inside the lab until its lights settle.");
  await expect(root.locator('.of-place[data-on="true"]')).toHaveCSS(
    "background-image",
    new RegExp("background-preparation\\.svg"),
  );
  await expect.poll(() => posts(calls, "/read").length).toBe(1);
  await expect.poll(() => posts(calls, "/api/tts/speak").length).toBe(1);
  expect(calls.filter((call) => call.method === "POST" && /\/art\/(place|cg)(?:\/prompt)?$/u.test(call.path))).toEqual(
    [],
  );
  expect(posts(calls, "/cancel")).toEqual([]);
});

for (const scenario of [
  "disabled",
  "ask",
  "review",
  "waiting-consent",
  "failed",
  "stopped",
  "missing",
  "poll failure",
  "image failure",
] as const) {
  test(`Otome Hearth backgrounds: ${scenario} does not hold the story or paint automatically`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const calls: Call[] = [];
    const fixture = createSceneStub({ images: scenario !== "disabled", ask: scenario === "ask", audio: false });
    fixture.beat0.cg = null;
    const savedPlace = fixture.stub.view.world.places["the-observation-room"];
    if (savedPlace)
      savedPlace.art = {
        state:
          scenario === "image failure"
            ? "ready"
            : scenario === "ask" || scenario === "review"
              ? "waiting-consent"
              : ["failed", "stopped", "waiting-consent"].includes(scenario)
                ? scenario
                : "pending",
        at: now(),
        ...(scenario === "image failure" ? { url: "/api/otome-forge/unavailable-background.svg" } : {}),
      };
    if (scenario === "missing") {
      fixture.stub.view.world.places = {};
      fixture.beat0.places = [];
    }
    await stubRoutes(
      page,
      (call) => {
        if (call.path.endsWith("/art/scene") && scenario === "poll failure")
          return { status: 503, json: { error: "Art unavailable", code: "unavailable" } };
        if (call.path.endsWith("/art/scene") && scenario === "missing")
          return { status: 200, json: { places: [], cg: null, faces: {}, facesComing: [] } };
        return fixture.answer(call);
      },
      calls,
    );
    const root = await openStory(page, { reviewPrompts: scenario === "review" });
    await root.getByRole("button", { name: "Continue" }).first().click();
    await expect(displayedLine(root)).toHaveText("Rain needles the glass dome.");
    await expect(root.getByText("Preparing the background…", { exact: true })).toHaveCount(0);
    if (scenario === "waiting-consent")
      await expect(root.getByRole("button", { name: /Paint.*The Observation Room/u })).toBeVisible();
    if (scenario === "failed" || scenario === "stopped")
      await expect(root.getByRole("button", { name: /Try.*The Observation Room/u })).toBeVisible();
    expect(
      calls.filter((call) => call.method === "POST" && /\/art\/(place|cg)(?:\/prompt)?$/u.test(call.path)),
    ).toEqual([]);
    expect(posts(calls, "/cancel")).toEqual([]);
  });
}

test("Otome Hearth backgrounds: continuing without a pending background holds no later line and never cancels or repaints", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const calls: Call[] = [];
  const fixture = createSceneStub({ audio: false });
  fixture.beat0.cg = null;
  fixture.stub.view.world.places["the-observation-room"].art = { state: "pending", at: now() };
  await stubRoutes(page, fixture.answer, calls);
  const root = await openStory(page);
  await root.getByRole("button", { name: "Continue" }).first().click();
  await expect(line(root)).toHaveCount(0);
  await root.getByRole("button", { name: "Continue without background", exact: true }).click();
  await expect(displayedLine(root)).toHaveText("Rain needles the glass dome.");
  await next(root);
  await expect(displayedLine(root)).toHaveText("You came back. How inefficient of you.");
  await expect.poll(() => calls.filter((call) => call.path.endsWith("/art/scene")).length).toBeGreaterThan(1);
  await expect(displayedLine(root)).toHaveText("You came back. How inefficient of you.");
  await expect(root.getByText("Preparing the background…", { exact: true })).toHaveCount(0);
  expect(calls.filter((call) => call.method === "POST" && /\/art\/(place|cg)(?:\/prompt)?$/u.test(call.path))).toEqual(
    [],
  );
  expect(posts(calls, "/cancel")).toEqual([]);
});

test("Otome Hearth backgrounds: a manual retry does not interrupt a scene that already opened", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const calls: Call[] = [];
  const fixture = createSceneStub({ audio: false });
  fixture.beat0.cg = null;
  const place = fixture.stub.view.world.places["the-observation-room"];
  place.art = { state: "failed", at: now(), error: "Paint failed" };
  const imageUrl = "/api/otome-forge/retried-background.svg";
  let releaseImage!: () => void;
  const imageWait = new Promise<void>((resolve) => {
    releaseImage = resolve;
  });
  let decoding = false;
  await stubRoutes(
    page,
    (call) => {
      if (call.path === imageUrl) {
        decoding = true;
        return {
          status: 200,
          body: Buffer.from(
            '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="18"><rect width="32" height="18" fill="#3a2a4f"/></svg>',
          ),
          contentType: "image/svg+xml",
          wait: imageWait,
        };
      }
      if (call.path.endsWith("/art/place") && call.method === "POST") {
        place.art = { state: "ready", at: now(), url: imageUrl };
        return { status: 200, json: { place, world: fixture.stub.view.world } };
      }
      return fixture.answer(call);
    },
    calls,
  );
  const root = await openStory(page);
  await root.getByRole("button", { name: "Continue" }).first().click();
  await expect(displayedLine(root)).toHaveText("Rain needles the glass dome.");
  expect(posts(calls, "/art/place")).toHaveLength(0);
  await root.getByRole("button", { name: "Try painting The Observation Room again (1 image)" }).click();
  await expect.poll(() => decoding).toBe(true);
  await expect(displayedLine(root)).toHaveText("Rain needles the glass dome.");
  await expect(root.getByText("Preparing the background…", { exact: true })).toHaveCount(0);
  await next(root);
  await expect(displayedLine(root)).toHaveText("You came back. How inefficient of you.");
  releaseImage();
  await expect(root.locator('.of-place[data-on="true"]')).toHaveCount(1);
  expect(posts(calls, "/art/place")).toHaveLength(1);
  expect(posts(calls, "/cancel")).toEqual([]);
});

test("Otome Hearth backgrounds: an old image decode cannot release a different scene", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const calls: Call[] = [];
  const fixture = createSceneStub({ audio: false });
  fixture.beat0.cg = null;
  fixture.beat0.segments = [seg("", "The first room waits.", { place: "The Observation Room" })];
  const imageUrl = "/api/otome-forge/old-background.svg";
  fixture.stub.view.world.places["the-observation-room"].art = { state: "ready", at: now(), url: imageUrl };
  const otherPlace = { name: "The second room", tags: "stone lab", art: { state: "pending", at: now() } };
  let releaseImage!: () => void;
  const imageWait = new Promise<void>((resolve) => {
    releaseImage = resolve;
  });
  let decoding = false;
  await stubRoutes(
    page,
    (call) => {
      if (call.path === imageUrl) {
        decoding = true;
        return {
          status: 200,
          body: Buffer.from(
            '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="18"><rect width="32" height="18" fill="#3a2a4f"/></svg>',
          ),
          contentType: "image/svg+xml",
          wait: imageWait,
        };
      }
      if (call.path.endsWith("/beats/1") && call.method === "POST")
        return {
          status: 200,
          json: {
            beat: {
              ...fixture.beat0,
              i: 1,
              places: [otherPlace],
              segments: [seg("", "The second room waits.", { place: otherPlace.name })],
            },
          },
        };
      if (call.path.endsWith("/art/scene") && call.query.get("i") === "1")
        return { status: 200, json: { places: [otherPlace], cg: null, faces: {}, facesComing: [] } };
      return fixture.answer(call);
    },
    calls,
  );
  const root = await openStory(page);
  await root.getByRole("button", { name: "Continue" }).first().click();
  await expect.poll(() => decoding).toBe(true);
  await root.getByRole("button", { name: "Continue without background", exact: true }).click();
  await expect(displayedLine(root)).toHaveText("The first room waits.");
  await next(root);
  await expect(root.getByText("Preparing the background…", { exact: true })).toBeVisible();
  const response = page.waitForResponse((reply) => new URL(reply.url()).pathname === imageUrl);
  releaseImage();
  await (await response).finished();
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
  await expect(line(root)).toHaveCount(0);
  await expect(root.getByText("Preparing the background…", { exact: true })).toBeVisible();
  expect(calls.filter((call) => call.method === "POST" && /\/art\/(place|cg)(?:\/prompt)?$/u.test(call.path))).toEqual(
    [],
  );
});

test("Otome Hearth backgrounds: polling recovery keeps the opened place readable and prepares the next place", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const calls: Call[] = [];
  const fixture = createSceneStub({ audio: false });
  fixture.beat0.cg = null;
  fixture.beat0.segments = [
    seg("", "The first lab stays open.", { place: "The Observation Room" }),
    seg("", "The next lab waits.", { place: "The second room" }),
  ];
  const firstPlace = fixture.stub.view.world.places["the-observation-room"];
  firstPlace.art = { state: "pending", at: now() };
  const otherPlace = { name: "The second room", tags: "stone lab", art: { state: "pending", at: now() } };
  fixture.stub.view.world.places["the-second-room"] = otherPlace;
  fixture.beat0.places.push({ name: otherPlace.name, tags: otherPlace.tags });
  let polls = 0;
  let painted = false;
  let decoding = false;
  let releaseImage!: () => void;
  const imageWait = new Promise<void>((resolve) => {
    releaseImage = resolve;
  });
  const imageUrl = "/api/otome-forge/recovered-background.svg";
  await stubRoutes(
    page,
    (call) => {
      if (call.path === imageUrl) {
        decoding = true;
        return {
          status: 200,
          body: Buffer.from(
            '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="18"><rect width="32" height="18" fill="#3a2a4f"/></svg>',
          ),
          contentType: "image/svg+xml",
          wait: imageWait,
        };
      }
      if (call.path.endsWith("/art/scene")) {
        polls += 1;
        if (polls === 1) return { status: 503, json: { error: "Art unavailable", code: "unavailable" } };
        return {
          status: 200,
          json: {
            places: [
              { ...firstPlace, art: { state: "ready", at: now(), url: PLACE_ART } },
              { ...otherPlace, ...(painted ? { art: { state: "ready", at: now(), url: imageUrl } } : {}) },
            ],
            cg: null,
            faces: {},
            facesComing: [],
          },
        };
      }
      return fixture.answer(call);
    },
    calls,
  );
  const root = await openStory(page);
  await root.getByRole("button", { name: "Continue" }).first().click();
  await expect(displayedLine(root)).toHaveText("The first lab stays open.");
  await expect(root.locator('.of-place[data-on="true"]')).toHaveCount(1);
  await expect(displayedLine(root)).toHaveText("The first lab stays open.");
  await next(root);
  await expect(root.getByText("Preparing the background…", { exact: true })).toBeVisible();
  await expect(line(root)).toHaveCount(0);
  expect(posts(calls, "/read")).toHaveLength(0);
  painted = true;
  await expect.poll(() => decoding).toBe(true);
  await expect(line(root)).toHaveCount(0);
  releaseImage();
  await expect(displayedLine(root)).toHaveText("The next lab waits.");
  await expect.poll(() => posts(calls, "/read").length).toBe(1);
  expect(calls.filter((call) => call.method === "POST" && /\/art\/(place|cg)(?:\/prompt)?$/u.test(call.path))).toEqual(
    [],
  );
});

test("Otome Hearth backgrounds: a failed next-place image clears the previous room and opens the fallback", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const calls: Call[] = [];
  const fixture = createSceneStub({ audio: false });
  fixture.beat0.cg = null;
  const otherPlace = {
    name: "The second room",
    tags: "stone lab",
    art: { state: "ready", at: now(), url: "/api/otome-forge/failed-next-background.svg" },
  };
  fixture.stub.view.world.places["the-second-room"] = otherPlace;
  fixture.beat0.places.push({ name: otherPlace.name, tags: otherPlace.tags });
  fixture.beat0.segments = [
    seg("", "The first lab is lit.", { place: "The Observation Room" }),
    seg("", "The second lab is dark.", { place: otherPlace.name }),
  ];
  await stubRoutes(page, fixture.answer, calls);
  const root = await openStory(page);
  await root.getByRole("button", { name: "Continue" }).first().click();
  await expect(displayedLine(root)).toHaveText("The first lab is lit.");
  await expect(root.locator('.of-place[data-on="true"]')).toHaveCSS("background-image", `url("${PLACE_ART}")`);
  await next(root);
  await expect(displayedLine(root)).toHaveText("The second lab is dark.");
  expect(calls.some((call) => call.path === "/api/otome-forge/failed-next-background.svg")).toBe(true);
  await expect(root.locator('.of-place[data-on="true"]')).toHaveCount(0);
  await expect(root.getByText("Preparing the background…", { exact: true })).toHaveCount(0);
  expect(calls.filter((call) => call.method === "POST" && /\/art\/(place|cg)(?:\/prompt)?$/u.test(call.path))).toEqual(
    [],
  );
  expect(posts(calls, "/cancel")).toEqual([]);
});

test("Otome Hearth backgrounds: exiting a pending location saves only the last visible line", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const calls: Call[] = [];
  const fixture = createSceneStub({ audio: false });
  fixture.beat0.cg = null;
  const firstPlace = fixture.stub.view.world.places["the-observation-room"];
  firstPlace.art = { state: "pending", at: now() };
  const otherPlace = { name: "The second room", tags: "stone lab", art: { state: "pending", at: now() } };
  fixture.stub.view.world.places["the-second-room"] = otherPlace;
  fixture.beat0.places.push({ name: otherPlace.name, tags: otherPlace.tags });
  fixture.beat0.segments = [
    seg("", "The first lab opens.", { place: "The Observation Room" }),
    seg("", "You read the note beside the door."),
    seg("", "The second lab is still unseen.", { place: otherPlace.name }),
  ];
  const starlight = fixture.stub.view.starlight;
  await stubRoutes(page, fixture.answer, calls);
  const root = await openStory(page);
  await root.getByRole("button", { name: "Continue" }).first().click();
  await expect(root.getByText("Preparing the background…", { exact: true })).toBeVisible();
  await root.getByRole("button", { name: "Leave the chapter", exact: true }).click();
  await expect(root.getByRole("heading", { name: "Story", exact: true })).toBeVisible();
  expect(posts(calls, "/read")).toHaveLength(0);
  firstPlace.art = { state: "ready", at: now(), url: PLACE_ART };
  await root.getByRole("button", { name: "Continue" }).first().click();
  await expect(displayedLine(root)).toHaveText("The first lab opens.");
  await next(root);
  await expect(displayedLine(root)).toHaveText("You read the note beside the door.");
  await next(root);
  await expect(root.getByText("Preparing the background…", { exact: true })).toBeVisible();
  await expect(line(root)).toHaveCount(0);
  expect(posts(calls, "/read")).toHaveLength(0);
  await root.getByRole("button", { name: "Leave the chapter", exact: true }).click();
  await expect(root.getByRole("heading", { name: "Story", exact: true })).toBeVisible();
  await expect.poll(() => posts(calls, "/read").map((call) => call.body!.segment)).toEqual([1]);
  expect(posts(calls, "/choose")).toEqual([]);
  expect(fixture.stub.view.starlight).toBe(starlight);
  expect(calls.filter((call) => call.method === "POST" && /\/art\/(place|cg)(?:\/prompt)?$/u.test(call.path))).toEqual(
    [],
  );
});

/** Records every line the Engine's voice service is asked to speak (the Engine's own instance, not a copy). */
async function recordSpeech(page: Page) {
  await page.evaluate(() => {
    const host = (globalThis as any).__MARINARA_HOST__;
    const service = host.services.tts.ttsService;
    const speak = service.speakSequence.bind(service);
    (window as any).__spoken = [];
    service.speakSequence = (requests: any[], id: string, options: any) => {
      (window as any).__spoken.push({ requests, id });
      return speak(requests, id, options);
    };
  });
}
const spoken = (page: Page) => page.evaluate(() => (window as any).__spoken as Array<{ requests: Json[]; id: string }>);

// The reader's phone layout is selected from the available frame, including a coarse-pointer phone in landscape.
// A full-body cut-out with recognizable head, torso, thighs and boots, rather than an opaque portrait rectangle.
const READER_CUTOUT = `data:image/svg+xml;base64,${Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="800" viewBox="0 0 360 800">
    <circle cx="180" cy="76" r="44" fill="#e6c98a"/>
    <path d="M135 128 L225 128 L250 320 L225 380 L135 380 L110 320Z" fill="#9db8f0"/>
    <path d="M135 380 L175 380 L170 600 L125 600Z M185 380 L225 380 L235 600 L190 600Z" fill="#b79cf2"/>
    <path d="M125 600 L170 600 L170 770 L105 770 L105 735Z M190 600 L235 600 L255 770 L190 770Z" fill="#e7a6b8"/>
    <g fill="#1c142e" font-family="sans-serif" font-size="18" text-anchor="middle">
      <text x="180" y="82">HEAD</text><text x="180" y="250">TORSO</text>
      <text x="150" y="450" transform="rotate(90 150 450)">THIGH</text>
      <text x="210" y="450" transform="rotate(90 210 450)">THIGH</text>
      <text x="140" y="735">BOOT</text><text x="215" y="735">BOOT</text>
    </g>
  </svg>`,
).toString("base64")}`;

function readerCutoutStub() {
  const fixture = createSceneStub({ audio: false });
  const faces = { cold: READER_CUTOUT, tender: READER_CUTOUT, angry: READER_CUTOUT, hurt: READER_CUTOUT };
  fixture.stub.view.lis[0].expressions = faces;
  fixture.stub.view.lis[0].cut = [READER_CUTOUT];
  return {
    ...fixture,
    answer: (call: Call): Answer | undefined => {
      const reply = fixture.answer(call);
      if (call.path.endsWith("/art/scene") && reply?.json) {
        const scene = reply.json as Json;
        return { ...reply, json: { ...scene, faces: { ...scene.faces, [ILVAR]: faces } } };
      }
      return reply;
    },
  };
}

test.describe("Otome Forge reader mobile", () => {
  test.use({ hasTouch: true, isMobile: true });

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 320, height: 700 },
    { width: 844, height: 390 },
  ]) {
    test(`chapter controls and cut-out framing at ${viewport.width}×${viewport.height}`, async ({ page }, testInfo) => {
      test.setTimeout(120_000);
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
      const calls: Call[] = [];
      const { answer } = readerCutoutStub();
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await stubRoutes(page, answer, calls);
      const root = await openStory(page);
      if (viewport.width > viewport.height) {
        const frame = (await root.locator(".of-frame").boundingBox())!;
        const stage = (await root.locator(".of-stage").boundingBox())!;
        expect(stage.height).toBeGreaterThan(stage.width);
        expect(stage.width).toBeLessThan(frame.width - 1);
      }
      await root.getByRole("button", { name: "Continue" }).first().click();
      await expect(root.locator(".of-reader")).toBeVisible();
      if (viewport.width > viewport.height) {
        const frame = (await root.locator(".of-frame").boundingBox())!;
        const stage = (await root.locator(".of-stage").boundingBox())!;
        expect(stage.width).toBeCloseTo(frame.width, 0);
      }
      await next(root);
      await expect(line(root)).toContainText("You came back. How inefficient of you.");
      const originalLine = (await line(root).textContent())!;
      const primary = root.locator(".of-reader-primary");
      const more = primary.getByRole("button", { name: "More reader controls" });
      const secondary = root.locator(".of-reader-secondary");
      await expect(primary.getByRole("button")).toHaveCount(3);
      await expect(primary.getByRole("button", { name: "Mute audio" })).toBeVisible();
      await expect(primary.getByRole("button", { name: /fullscreen/iu })).toBeVisible();
      await expect(more).toHaveAttribute("aria-expanded", "false");
      await expect(secondary).toBeHidden();
      expect
        .soft(
          await primary.getByRole("button").evaluateAll((buttons) =>
            buttons
              .map((button) => ({ label: button.getAttribute("aria-label"), x: button.getBoundingClientRect().x }))
              .sort((a, b) => a.x - b.x)
              .map((button) => button.label),
          ),
        )
        .toEqual(["Mute audio", expect.stringMatching(/fullscreen/iu), "More reader controls"]);
      const centeredIcon = async (button: Locator) => {
        const geometry = await button.evaluate((element) => {
          const box = element.getBoundingClientRect();
          const icon = element.querySelector("svg")!.getBoundingClientRect();
          return {
            label: element.getAttribute("aria-label"),
            centerX: box.x + box.width / 2,
            dx: icon.x + icon.width / 2 - (box.x + box.width / 2),
            dy: icon.y + icon.height / 2 - (box.y + box.height / 2),
          };
        });
        expect.soft(Math.abs(geometry.dx), `${geometry.label}: icon horizontal center`).toBeLessThanOrEqual(1);
        expect.soft(Math.abs(geometry.dy), `${geometry.label}: icon vertical center`).toBeLessThanOrEqual(1);
        return geometry.centerX;
      };
      for (const button of await primary.getByRole("button").all()) await centeredIcon(button);
      const moreBox = (await more.boundingBox())!;
      const moreCenter = moreBox.x + moreBox.width / 2;

      const openTools = async () => {
        if ((await more.getAttribute("aria-expanded")) === "false") await more.click();
        await expect(secondary).toBeVisible();
      };
      await openTools();
      const tools = secondary.getByRole("button");
      await expect(tools).toHaveCount(6);
      expect(await tools.evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")))).toEqual([
        "Auto",
        "Skip what you’ve read",
        "Hide the text",
        "Backlog",
        expect.stringMatching(/^Rewrite this scene/u),
        "Ease off",
      ]);
      const boxes = await tools.evaluateAll((buttons) =>
        buttons.map((button) => {
          const box = button.getBoundingClientRect();
          return { x: box.x, y: box.y, width: box.width, height: box.height };
        }),
      );
      for (let i = 0; i < boxes.length; i++) {
        const box = boxes[i]!;
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.x).toBeCloseTo(boxes[0]!.x, 0);
        if (i) expect(box.y).toBeGreaterThanOrEqual(boxes[i - 1]!.y + boxes[i - 1]!.height);
      }
      if (viewport.width > viewport.height) {
        // A notch can move the controls lower than ordinary desktop emulation's zero safe-area inset.
        await root.locator(".of-reader-head").evaluate((element: HTMLElement) => {
          element.style.paddingTop = "47px";
        });
        const menu = await secondary.evaluate((element) => ({
          height: element.clientHeight,
          content: element.scrollHeight,
        }));
        expect(menu.content).toBeGreaterThan(menu.height);
      }
      // A short landscape menu scrolls: every action remains reachable without moving the whole stage.
      for (const tool of await tools.all()) {
        await tool.scrollIntoViewIfNeeded();
        const box = (await tool.boundingBox())!;
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
        const center = await centeredIcon(tool);
        expect.soft(Math.abs(center - moreCenter), "secondary button directly below More").toBeLessThanOrEqual(1);
      }
      await tools.first().scrollIntoViewIfNeeded();
      if (viewport.width > viewport.height) {
        await page.screenshot({ path: testInfo.outputPath("mobile-landscape-safe-area-controls.png") });
        await root.locator(".of-reader-head").evaluate((element: HTMLElement) => {
          element.style.removeProperty("padding-top");
        });
      }
      expect(await secondary.getByRole("button", { name: /^Rewrite this scene/u }).innerText()).toBe("");
      expect(await secondary.getByRole("button", { name: "Ease off" }).innerText()).toBe("");
      await page.screenshot({ path: testInfo.outputPath(`mobile-${viewport.width}-controls.png`) });
      await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
      await expect(root).toHaveAttribute("data-look", "midnight");
      await page.screenshot({ path: testInfo.outputPath(`mobile-${viewport.width}-controls-midnight.png`) });
      await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
      await expect(root).toHaveAttribute("data-look", "pearl");
      await page.keyboard.press("Escape");
      await expect(secondary).toBeHidden();
      await expect(more).toBeFocused();
      await expect(line(root)).toHaveText(originalLine);

      await primary.getByRole("button", { name: /fullscreen/iu }).click();
      await expect(line(root)).toHaveText(originalLine);
      await primary.getByRole("button", { name: /fullscreen/iu }).click();
      await expect(line(root)).toHaveText(originalLine);
      await openTools();
      const auto = secondary.getByRole("button", { name: "Auto", exact: true });
      await auto.click();
      await expect(auto).toHaveAttribute("aria-pressed", "true");
      await auto.click();
      await expect(auto).toHaveAttribute("aria-pressed", "false");
      await expect(line(root)).toHaveText(originalLine);

      // A disabled Skip, opening/closing a dialog and hiding/showing the box never act as a tap on the stage.
      await openTools();
      const skip = secondary.getByRole("button", { name: "Skip what you’ve read" });
      await expect(skip).toHaveAttribute("aria-disabled", "true");
      // aria-disabled keeps this button focusable; a physical tap still reaches its guarded click handler.
      const skipBox = (await skip.boundingBox())!;
      await page.touchscreen.tap(skipBox.x + skipBox.width / 2, skipBox.y + skipBox.height / 2);
      await expect(line(root)).toHaveText(originalLine);
      await openTools();
      await secondary.getByRole("button", { name: "Backlog" }).click();
      const backlog = page.getByRole("dialog", { name: "Backlog" });
      await expect(backlog).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(backlog).toBeHidden();
      await expect(more).toHaveAttribute("aria-expanded", "true");
      await expect(line(root)).toHaveText(originalLine);
      await openTools();
      await secondary.getByRole("button", { name: "Ease off", exact: true }).click();
      await page.getByRole("dialog", { name: "Ease off?" }).getByRole("button", { name: "Keep reading" }).click();
      await expect(line(root)).toHaveText(originalLine);
      await openTools();
      await secondary.getByRole("button", { name: "Hide the text" }).click();
      await root.getByRole("button", { name: "Show the text" }).click();
      await expect(line(root)).toHaveText(originalLine);
      await openTools();
      // Exercise the exposed stage background rather than an overlapping reader control.
      const stage = root.locator(".of-reader-stage");
      const stageTap = await stage.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const reader = element.closest(".of-reader")!;
        const top = Math.max(box.top, reader.querySelector(".of-reader-head")!.getBoundingClientRect().bottom);
        const bottom = Math.min(box.bottom, reader.querySelector(".of-reader-bottom")!.getBoundingClientRect().top);
        const position = { x: 20, y: (top + bottom) / 2 - box.top };
        const scope = element.getRootNode() as Document | ShadowRoot;
        const hit = scope.elementFromPoint(box.left + position.x, box.top + position.y);
        return { position, exposedHeight: bottom - top, hitStage: hit?.closest(".of-reader-stage") === element };
      });
      expect(stageTap.exposedHeight, "space remains between the header and dialogue panel").toBeGreaterThan(0);
      expect(stageTap.hitStage, "the outside-dismiss tap targets exposed stage content").toBe(true);
      await stage.click({ position: stageTap.position });
      await expect(more).toHaveAttribute("aria-expanded", "false");
      await expect(line(root)).toHaveText(originalLine);

      // The full cut-out continues behind the dialogue, with only its upper body exposed above the box.
      const image = root.locator('.of-face-img[data-front="true"][data-cut="true"]');
      await expect(image).toBeVisible();
      const sprite = (await image.boundingBox())!;
      const dialogue = (await root.locator(".of-dialogue").boundingBox())!;
      expect(sprite.y).toBeLessThan(dialogue.y);
      expect(sprite.y + sprite.height).toBeGreaterThan(dialogue.y + 40);
      expect((dialogue.y - sprite.y) / sprite.height).toBeLessThan(0.8);
      // The SVG's marked head (y=32..120) stays visible; its boots (y=600+) are behind the dialogue.
      await expect(image).toHaveCSS("object-fit", "cover");
      const scale = Math.max(sprite.width / 360, sprite.height / 800);
      expect(sprite.y + 120 * scale).toBeLessThan(dialogue.y);
      expect(sprite.y + 600 * scale).toBeGreaterThan(dialogue.y);
      await page.screenshot({ path: testInfo.outputPath(`mobile-${viewport.width}-sprite.png`) });
      expect(pageErrors).toEqual([]);
    });
  }

  test("the first outside tap closes the controls before a pending choice can be selected", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const calls: Call[] = [];
    const fixture = createSceneStub({ images: false, audio: false });
    fixture.beat0.choices = [
      {
        id: "choice-mobile",
        kind: "small",
        at: 1,
        options: [
          {
            id: "option-stay",
            text: "Stay with him.",
            selection: { kind: "action", text: "You stay by the door." },
            segments: [seg("Ilvar", "A sensible decision.")],
          },
        ],
      },
    ];
    await stubRoutes(
      page,
      (call) => {
        if (call.path.endsWith("/choose")) {
          fixture.beat0.choiceCanon[call.body!.choice] = call.body!.option;
          return { status: 200, json: { beat: fixture.beat0, remembered: false, rememberedBy: [] } };
        }
        return fixture.answer(call);
      },
      calls,
    );
    const root = await openStory(page);
    await root.getByRole("button", { name: "Continue" }).first().click();
    await next(root);
    const choice = root.getByRole("group", { name: "What do you do?" });
    const stay = choice.getByRole("button", { name: "Stay with him." });
    await expect(stay).toBeVisible();
    const more = root.getByRole("button", { name: "More reader controls" });
    await more.click();
    await expect(more).toHaveAttribute("aria-expanded", "true");
    // Tab can reach a choice outside the header: Escape still owns the open disclosure, without selecting anything.
    await stay.focus();
    await page.keyboard.press("Escape");
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await expect(more).toBeFocused();
    expect(posts(calls, "/choose")).toHaveLength(0);
    await more.click();
    await stay.click();
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await expect(stay).toBeVisible();
    expect(posts(calls, "/choose")).toHaveLength(0);
    await expect(line(root)).toContainText("You came back. How inefficient of you.");
    await stay.click();
    await expect(line(root)).toContainText("You stay by the door.");
    expect(posts(calls, "/choose")).toHaveLength(1);
  });

  test("mute silences music and aborts the current voice without advancing", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => {
      const gains: Array<{ value: number; connected: boolean }> = [];
      (window as any).__readerGains = gains;
      const create = AudioContext.prototype.createGain;
      AudioContext.prototype.createGain = function (this: AudioContext) {
        const node = create.call(this);
        const state = { value: node.gain.value, connected: false };
        gains.push(state);
        const connect = node.connect.bind(node) as (...args: any[]) => any;
        node.connect = ((...args: any[]) => {
          state.connected = true;
          return connect(...args);
        }) as typeof node.connect;
        const disconnect = node.disconnect.bind(node) as (...args: any[]) => void;
        node.disconnect = ((...args: any[]) => {
          state.connected = false;
          return disconnect(...args);
        }) as typeof node.disconnect;
        const set = node.gain.setValueAtTime.bind(node.gain);
        node.gain.setValueAtTime = (value: number, time: number) => {
          state.value = value;
          return set(value, time);
        };
        return node;
      };
    });
    const calls: Call[] = [];
    const { answer } = createSceneStub({ images: false, audio: { generate: false } });
    await stubRoutes(page, answer, calls);
    const root = await openStory(page);
    await page.evaluate(() => {
      const service = (globalThis as any).__MARINARA_HOST__.services.tts.ttsService;
      const speak = service.speakSequence.bind(service);
      (window as any).__readerVoiceAborted = 0;
      service.speakSequence = (requests: any[], id: string, options: any) => {
        options.signal.addEventListener("abort", () => ((window as any).__readerVoiceAborted += 1), { once: true });
        return speak(requests, id, options);
      };
    });
    // Hold the real voice fetch so a completed 0.1-second fixture clip cannot race the mute tap.
    let release!: () => void;
    const heldVoice = new Promise<void>((resolveHeld) => (release = resolveHeld));
    await page.route("**/api/tts/speak", async (route) => {
      await heldVoice;
      await route.fallback();
    });
    try {
      await root.getByRole("button", { name: "Continue" }).first().click();
      await next(root);
      await expect(line(root)).toContainText("You came back. How inefficient of you.");
      const originalLine = (await line(root).textContent())!;
      // A stopped crossfade disconnects its gain; its historical value no longer contributes any audio.
      const gains = () =>
        page.evaluate(
          () =>
            (window as any).__readerGains
              .filter((gain: { connected: boolean }) => gain.connected)
              .map((gain: { value: number }) => gain.value) as number[],
        );
      const voiceState = () =>
        page.evaluate(() => (globalThis as any).__MARINARA_HOST__.services.tts.ttsService.getState() as string);
      await expect.poll(voiceState).toBe("loading");
      await expect.poll(async () => (await gains()).some((value) => value > 0)).toBe(true);
      await root.locator(".of-reader-primary").getByRole("button", { name: "Mute audio" }).click();
      await expect(root.getByRole("button", { name: "Unmute audio", exact: true })).toBeVisible();
      await expect.poll(() => page.evaluate(() => (window as any).__readerVoiceAborted as number)).toBe(1);
      await expect.poll(voiceState).toBe("idle");
      expect((await gains()).length).toBeGreaterThan(0);
      await expect.poll(async () => (await gains()).every((value) => value === 0)).toBe(true);
      await expect(line(root)).toHaveText(originalLine);
      await root.getByRole("button", { name: "Unmute audio", exact: true }).click();
      await expect.poll(async () => (await gains()).some((value) => value > 0)).toBe(true);
      await expect(line(root)).toHaveText(originalLine);
    } finally {
      release();
    }
  });
});

test.describe("Otome Forge reader desktop", () => {
  test.use({ hasTouch: false, isMobile: false, viewport: { width: 1280, height: 900 } });

  test("a hidden mobile disclosure does not consume the next desktop story action", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const calls: Call[] = [];
    const { answer } = readerCutoutStub();
    await stubRoutes(page, answer, calls);
    const root = await openStory(page);
    await root.getByRole("button", { name: "Continue" }).first().click();
    await next(root);
    await expect(line(root)).toContainText("You came back. How inefficient of you.");
    const more = root.getByRole("button", { name: "More reader controls" });
    await more.click();
    await expect(more).toHaveAttribute("aria-expanded", "true");
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(more).toBeHidden();
    await next(root);
    await expect(line(root)).toContainText("I should have stayed away.");
  });

  test("keeps the existing controls and full cut-out framing", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const calls: Call[] = [];
    const { answer } = readerCutoutStub();
    await stubRoutes(page, answer, calls);
    const root = await openStory(page);
    await root.getByRole("button", { name: "Continue" }).first().click();
    await next(root);
    await expect(root.getByRole("button", { name: "More reader controls" })).toBeHidden();
    await expect(root.getByRole("button", { name: "Auto", exact: true })).toBeVisible();
    await expect(root.getByRole("button", { name: "Skip what you’ve read" })).toBeVisible();
    await expect(root.getByRole("button", { name: "Backlog" })).toBeVisible();
    await expect(root.getByRole("button", { name: "Hide the text" })).toBeVisible();
    await expect(root.getByRole("button", { name: /^Rewrite this scene/u })).toHaveText("Rewrite");
    await expect(root.getByRole("button", { name: "Ease off", exact: true })).toHaveText("Ease off");
    const sprite = (await root.locator('.of-face-img[data-front="true"]').boundingBox())!;
    const dialogue = (await root.locator(".of-dialogue").boundingBox())!;
    expect(sprite.y + sprite.height).toBeLessThanOrEqual(dialogue.y);
    await page.screenshot({ path: testInfo.outputPath("desktop-reader.png") });
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
    await expect(root).toHaveAttribute("data-look", "midnight");
    await page.screenshot({ path: testInfo.outputPath("desktop-reader-midnight.png") });
  });
});

test("Otome Forge reader: a CG unlocks once seen, faces swap, lines are voiced, music plays, and a Confrontation plays to its ending", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const calls: Call[] = [];
  const { answer, stub } = createSceneStub();
  // This positive presentation fixture represents faces whose cleanup is already complete.
  stub.view.lis[0].cut = [FACE_COLD, FACE_TENDER, FACE_ANGRY, FACE_HURT];
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubRoutes(page, answer, calls);
  const root = await openStory(page);
  await recordSpeech(page);
  await root.getByRole("button", { name: "Continue" }).first().click();

  // The painted place is behind the scene; the first line is narration and is never voiced.
  await expect(line(root)).toContainText("Rain needles the glass dome.");
  await expect(root.locator('.of-place[data-on="true"]')).toHaveCount(1);
  await next(root);

  // His cold face is the painted one, and his line is voiced with the Engine's own assignment for his card.
  await expect(root.getByRole("img", { name: "Ilvar Thorne, cold" })).toBeVisible();
  await expect(root.locator('.of-face-img[data-front="true"]')).toHaveAttribute("src", FACE_COLD);
  await expect.poll(async () => (await spoken(page)).length).toBe(1);
  const first = (await spoken(page))[0]!.requests[0]!;
  expect(first).toMatchObject({
    text: "You came back. How inefficient of you.",
    voice: "Ilvar Voice",
    characterId: "card-ilvar",
  });
  expect(first.cacheKey).toBe(`otome-forge:${RUN}:main-1/0r0/1`);
  await expect.poll(() => posts(calls, "/api/tts/speak").length).toBe(1);

  // Stock music plays for the beat's cue, and the cue is generated once on the audio connection.
  await expect
    .poll(() => calls.some((call) => /^\/api\/game-assets\/file\/music\/(dialogue|exploration)\//u.test(call.path)))
    .toBe(true);
  // The Story screen's cue (home) and the beat's (tense), each made once: never a mood that was not played.
  await expect.poll(() => generatedCues(calls)).toEqual(["home", "tense"]);
  const generated = posts(calls, "/api/audio/generate").find((call) =>
    call.body!.context.key.endsWith("-tense"),
  )!.body!;
  expect(generated).toMatchObject({
    kind: "music",
    audioConnectionId: "conn-audio",
    prompt: "A tense piano loop for a clockwork city.",
    debugMode: false,
    context: { scope: "otome-forge", lengthMs: 60_000 },
  });
  expect(generated.context.key).toMatch(/^world-[0-9a-f]+-tense$/u);
  await expect.poll(() => posts(calls, "/audio/track").length).toBe(2);
  await expect
    .poll(() => calls.some((call) => call.path.startsWith("/api/game-assets/file/music/contexts/otome-forge/")))
    .toBe(true);

  // Her thought is silent; the backlog replays his line with its cache key.
  await next(root);
  await expect(root.locator(".of-line--thought")).toContainText("I should have stayed away.");
  await setReaderControlsExpanded(root);
  await root.getByRole("button", { name: "Backlog" }).click();
  const backlog = page.getByRole("dialog", { name: "Backlog" });
  await expect(backlog.getByRole("button", { name: /Play .*line/u })).toHaveCount(1);
  // An action, not a toggle: its name says what a press does (Play, then Stop), so it carries no pressed state.
  await expect(backlog.getByRole("button", { name: "Play Ilvar Thorne’s line" })).not.toHaveAttribute("aria-pressed");
  await backlog.getByRole("button", { name: "Play Ilvar Thorne’s line" }).click();
  await expect.poll(async () => (await spoken(page)).length).toBe(2);
  expect((await spoken(page))[1]!.requests[0]!.cacheKey).toBe(`otome-forge:${RUN}:main-1/0r0/1`);
  await backlog.getByRole("button", { name: "Close" }).click();

  // The CG takes the stage: the UI fades (inert, so nothing unseen can be focused or pressed) and the pan plays,
  // holding focus; a tap where the box was ends it and focus is back on Next. It unlocks only after the read reached
  // its line.
  await next(root);
  await expect(root.locator(".of-reader")).toHaveAttribute("data-cg", "intro");
  const cg = root.getByRole("img", { name: "An illustration: Ilvar Thorne" });
  await expect(cg).toBeVisible();
  await expect(cg).toBeFocused();
  await expect(root.locator(".of-reader-head")).toHaveAttribute("inert", "");
  await expect(root.locator(".of-reader-bottom")).toHaveAttribute("inert", "");
  await page.screenshot({ path: testInfo.outputPath("03-cg.png") });
  const frame = (await cg.boundingBox())!;
  await cg.click({ position: { x: frame.width / 2, y: frame.height - 40 } });
  await expect(root.locator(".of-reader")).toHaveAttribute("data-cg", "shown");
  await expect(root.locator(".of-reader-bottom")).not.toHaveAttribute("inert", "");
  await expect(root.locator(".of-next")).toBeFocused();
  await expect(root.getByText("New CG")).toBeVisible();
  const seen = calls.findIndex((call) => call.path.endsWith("/art/cg/seen"));
  const reached = calls.findIndex((call) => call.path.endsWith("/beats/0/read") && call.body!.segment >= 3);
  expect(reached).toBeGreaterThan(-1);
  expect(reached).toBeLessThan(seen);
  expect(posts(calls, "/art/cg/seen")).toHaveLength(1);
  await expect(line(root)).toContainText("Stay, then.");
  await page.screenshot({ path: testInfo.outputPath("04-cg-box.png") });
  await next(root);

  // The Confrontation: three rounds of stances, each sent once; his face answers each one.
  await expect(line(root)).toContainText("The dome again.");
  await next(root);
  await expect(root.getByRole("img", { name: "Ilvar Thorne, cold" })).toBeVisible();
  const round1 = root.getByRole("group", { name: /Round 1 of 3/u });
  await expect(round1.getByRole("button")).toHaveCount(4);
  await page.screenshot({ path: testInfo.outputPath("05-stances.png") });
  await round1.getByRole("button", { name: /Press/u }).dblclick();
  await expect(line(root)).toContainText("Why did you lock me out?");
  expect(posts(calls, "/stance")).toHaveLength(1);
  expect(posts(calls, "/stance")[0]!.body).toMatchObject({ round: 1, stance: "press" });
  await next(root);
  await expect(root.getByRole("img", { name: "Ilvar Thorne, angry" })).toBeVisible();
  await expect(root.locator('.of-face-img[data-front="true"]')).toHaveAttribute("src", FACE_ANGRY);
  await next(root);
  await expect(root.getByRole("img", { name: "Ilvar Thorne, hurt" })).toBeVisible();
  await root
    .getByRole("group", { name: /Round 2 of 3/u })
    .getByRole("button", { name: /Hold/u })
    .click();
  await next(root);
  await next(root);
  await root
    .getByRole("group", { name: /Round 3 of 3/u })
    .getByRole("button", { name: /Reveal/u })
    .click();
  await expect(line(root)).toContainText("I’m afraid of losing you.");
  await next(root);
  await next(root);
  await expect(line(root)).toContainText("So I left first.");
  expect(posts(calls, "/stance").map((call) => call.body!.stance)).toEqual(["press", "hold", "reveal"]);
  // The ending's card, in words, never numbers; Go on ends the chapter. The angst cue was generated once too.
  await next(root);
  await expect(root.getByRole("heading", { name: "The truth, at last" })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath("06-truth.png") });
  await root.getByRole("button", { name: "Go on" }).click();
  await expect(root.getByRole("heading", { name: "Chapter complete" })).toBeFocused();
  expect(generatedCues(calls)).toEqual(["angst", "home", "tense"]);
  // Only his lines and hers with a persona voice are voiced: she has none, so every voiced line is his.
  expect((await spoken(page)).every((entry) => entry.requests[0]!.voice === "Ilvar Voice")).toBe(true);
  expect(pageErrors).toEqual([]);
});

test("Otome Forge reader: at reduced motion with Ask before painting, a CG and a place paint only on a tap; Settings → Audio saves", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  const calls: Call[] = [];
  const { answer } = createSceneStub({ ask: true, audio: false });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await stubRoutes(page, answer, calls);
  const root = await openStory(page);
  await root.getByRole("button", { name: "Continue" }).first().click();
  await expect(line(root)).toContainText("Rain needles the glass dome.");

  // Nothing paints by itself; the place offers its paint, with its cost.
  await root.getByRole("button", { name: "Paint The Observation Room (1 image)" }).click();
  await expect(root.locator('.of-place[data-on="true"]')).toHaveCount(1);
  expect(posts(calls, "/art/place")[0]!.body).toMatchObject({ place: "The Observation Room" });
  await next(root);
  await next(root);
  await next(root);
  // The CG's quiet card waits for a tap; then, at reduced motion, it shows at once with no pan.
  await expect(root.getByText("Paints 1 image")).toBeVisible();
  expect(posts(calls, "/art/cg")).toHaveLength(0);
  await page.screenshot({ path: testInfo.outputPath("07-ask.png") });
  await root.getByRole("button", { name: "Paint this moment" }).click();
  await expect(root.locator(".of-reader")).toHaveAttribute("data-cg", "shown");
  await expect(root.locator('.of-cg[data-intro="true"]')).toHaveCount(0);
  expect(posts(calls, "/art/cg")).toHaveLength(1);
  await expect.poll(() => posts(calls, "/art/cg/seen").length).toBe(1);
  // No audio was asked for: voices and music are off in this story.
  expect(calls.filter((call) => call.path.startsWith("/api/tts/speak") || call.path === "/api/audio/generate")).toEqual(
    [],
  );

  // Settings → Audio: voices on, the music softer, saved on the story.
  await root.getByRole("button", { name: "Leave the chapter" }).click();
  await root.getByRole("button", { name: "Settings" }).click();
  await root.getByRole("tab", { name: "Audio" }).click();
  await root.getByRole("switch", { name: "Voice the dialogue" }).check();
  await root.getByRole("switch", { name: "Generate music" }).check();
  await expect(root.getByRole("combobox", { name: "Audio connection" })).toContainText("Music fixture");
  await root.getByRole("combobox", { name: "Audio connection" }).selectOption("conn-audio");
  const music = root.getByRole("slider", { name: "Music" });
  await music.focus();
  for (let step = 0; step < 4; step += 1) await page.keyboard.press("ArrowLeft");
  await expect(root.getByText("30%")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("08-audio.png") });
  // Only the levels play while they move: nothing asks for a brief or generates music on settings not yet saved.
  expect(calls.filter((call) => call.path.endsWith("/audio/brief") || call.path === "/api/audio/generate")).toEqual([]);
  const save = root.getByRole("button", { name: "Save changes" });
  await save.click();
  await expect(root.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  // The form starts again from what was saved in place: focus stays on Save, where "Saved." is announced.
  await expect(save).toBeFocused();
  expect(posts(calls, "/audio/settings")[0]!.body!.audio).toMatchObject({
    tts: true,
    generate: true,
    audioConnectionId: "conn-audio",
    musicVolume: 0.3,
  });
  expect(pageErrors).toEqual([]);
});

test("Otome Forge reader: a reviewed key-image prompt stops Auto and paints the scene it was opened for", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const calls: Call[] = [];
  const { answer } = createSceneStub({ ask: true, audio: false });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await stubRoutes(page, answer, calls);
  const root = await openStory(page, { reviewPrompts: true });
  await root.getByRole("button", { name: "Continue" }).first().click();
  await expect(line(root)).toContainText("Rain needles the glass dome.");
  await next(root);
  await next(root);
  await next(root);
  await expect(line(root)).toContainText("Stay, then.");

  // The review is a dialog, so it stops Auto as the Backlog does: the line waits while the prompt is read.
  await setReaderControlsExpanded(root);
  const auto = root.getByRole("button", { name: "Auto", exact: true });
  await auto.click();
  await expect(auto).toHaveAttribute("aria-pressed", "true");
  await setReaderControlsExpanded(root, false);
  await root.getByRole("button", { name: "Paint this moment" }).click();
  const review = page.getByRole("dialog", { name: "Paint: A moment to keep" });
  await expect(review).toBeVisible();
  // Both responsive copies reflect the same stopped Auto state, including the now-collapsed phone disclosure.
  await expect
    .poll(() =>
      root
        .locator('button[aria-label="Auto"]')
        .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-pressed"))),
    )
    .toEqual(["false", "false"]);
  // Longer than Auto's pause on this line (lib/reader-state.ts autoDelay: 1.6 s and 48 ms a character).
  await page.waitForTimeout(3_600);
  await expect(line(root)).toContainText("Stay, then.");
  await review.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(review).toBeHidden();

  // The reader goes on while the prompt is on its way: the prompt it opens with still paints the scene it was for.
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/art/cg/prompt", async (route) => {
    await gate;
    await route.fallback();
  });
  await root.getByRole("button", { name: "Paint this moment" }).click();
  await next(root);
  await expect(line(root)).toContainText("The dome again.");
  release();
  await expect(review).toBeVisible();
  await review.getByRole("button", { name: "Paint", exact: true }).click();
  await expect(review).toBeHidden();
  const prompts = posts(calls, "/art/cg/prompt");
  expect(prompts).toHaveLength(2);
  for (const call of prompts) expect(call.body).toMatchObject({ key: "main-1", i: 0 });
  expect(posts(calls, "/art/cg")).toHaveLength(1);
  expect(posts(calls, "/art/cg")[0]!.body).toMatchObject({
    key: "main-1",
    i: 0,
    prompt: "Two figures under a glass dome, rain.",
  });
  expect(pageErrors).toEqual([]);
});

// Settings → Audio plays an unsaved Mute or music level while it moves; only the saved settings generate (and pay for)
// music.
for (const variant of [
  { saved: "muted", audio: { muted: true }, unmute: true, steps: 4, level: "70" },
  { saved: "with its music at 0", audio: { musicVolume: 0 }, unmute: false, steps: 4, level: "20" },
]) {
  test(`Otome Forge audio: a story saved ${variant.saved} makes no music on the unsaved form, and its cue once saved`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const calls: Call[] = [];
    const { answer } = createSceneStub({ images: false, audio: variant.audio });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await stubRoutes(page, answer, calls);
    const root = await openStory(page);
    await root.getByRole("button", { name: "Settings" }).click();
    await root.getByRole("tab", { name: "Audio" }).click();
    if (variant.unmute) await root.getByRole("switch", { name: "Mute everything" }).uncheck();
    const music = root.getByRole("slider", { name: "Music" });
    await music.focus();
    for (let step = 0; step < variant.steps; step += 1) await page.keyboard.press("ArrowRight");
    await expect(music).toHaveValue(variant.level);
    // The Story screen's cue (home) is held, and Generate music is saved on: still nothing is asked for or paid.
    await page.waitForTimeout(1_500);
    expect(calls.filter((call) => call.path.endsWith("/audio/brief") || call.path === "/api/audio/generate")).toEqual(
      [],
    );
    await root.getByRole("button", { name: "Save changes" }).click();
    await expect(root.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
    await expect.poll(() => generatedCues(calls)).toEqual(["home"]);
    await expect.poll(() => posts(calls, "/audio/track").length).toBe(1);
    expect(generatedCues(calls)).toEqual(["home"]);
    expect(pageErrors).toEqual([]);
  });
}

test("Otome Forge audio: an unsaved Mute stays silent when the cue's track being made lands", async ({ page }) => {
  test.setTimeout(120_000);
  const calls: Call[] = [];
  const { answer } = createSceneStub({ images: false });
  const slow = (call: Call): Answer | undefined => {
    const reply = answer(call);
    return call.path === "/api/audio/generate" && reply ? { ...reply, delay: 4_000 } : reply;
  };
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  // Each gain's last value: the Engine's player silences a music layer by setting its gain to 0.
  await page.addInitScript(() => {
    const gains: number[] = [];
    (window as any).__otomeGains = gains;
    const create = AudioContext.prototype.createGain;
    AudioContext.prototype.createGain = function (this: AudioContext) {
      const node = create.call(this);
      const index = gains.push(node.gain.value) - 1;
      const set = node.gain.setValueAtTime.bind(node.gain);
      node.gain.setValueAtTime = (value: number, time: number) => {
        gains[index] = value;
        return set(value, time);
      };
      return node;
    };
  });
  const gains = () => page.evaluate(() => [...(window as any).__otomeGains] as number[]);
  await stubRoutes(page, slow, calls);
  const root = await openStory(page);
  await root.getByRole("button", { name: "Settings" }).click();
  await root.getByRole("tab", { name: "Audio" }).click();
  // Saved unmuted with Generate music on: the Story screen's cue (home) is being made.
  await expect.poll(() => generatedCues(calls)).toEqual(["home"]);
  const mute = root.getByRole("switch", { name: "Mute everything" });
  await mute.check();
  // The track lands on the story while Mute is previewed: it is recorded, and nothing plays.
  await expect.poll(() => posts(calls, "/audio/track").length, { timeout: 20_000 }).toBe(1);
  await expect
    .poll(() =>
      calls.some((call) =>
        /^\/api\/game-assets\/file\/music\/contexts\/otome-forge\/.+\/made-1\.mp3$/u.test(call.path),
      ),
    )
    .toBe(true);
  await page.waitForTimeout(1_000);
  await expect(mute).toBeChecked();
  const muted = await gains();
  expect(muted.length).toBeGreaterThan(0);
  expect(muted.filter((value) => value !== 0)).toEqual([]);
  // The preview is still live: unmuting plays music again.
  await mute.uncheck();
  await expect.poll(async () => (await gains()).some((value) => value > 0)).toBe(true);
  expect(pageErrors).toEqual([]);
});

test("Otome Forge audio: a recorded track the Engine no longer lists is made again, with stock music meanwhile", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const calls: Call[] = [];
  // Recorded on the story, but its file is gone: the Engine's manifest (the stub's) does not list it.
  const gone = {
    cue: "home",
    connectionId: "conn-audio",
    tag: "music:contexts:otome-forge:world-0-home:gone",
    path: "music/contexts/otome-forge/world-0-home/gone.mp3",
  };
  const { answer } = createSceneStub({ images: false, audio: { tracks: [gone] } });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubRoutes(page, answer, calls);
  await openStory(page);
  await expect
    .poll(() => calls.some((call) => /^\/api\/game-assets\/file\/music\/(dialogue|exploration)\//u.test(call.path)))
    .toBe(true);
  await expect.poll(() => generatedCues(calls)).toEqual(["home"]);
  await expect.poll(() => posts(calls, "/audio/track").length).toBe(1);
  await expect
    .poll(() =>
      calls.some((call) =>
        /^\/api\/game-assets\/file\/music\/contexts\/otome-forge\/.+\/made-1\.mp3$/u.test(call.path),
      ),
    )
    .toBe(true);
  expect(calls.filter((call) => call.path.endsWith("/gone.mp3"))).toEqual([]);
  expect(pageErrors).toEqual([]);
});

/** Two stored chapters with their own track records; every provider request remains stubbed. */
function chapterMusicFixture(audio: Json = {}) {
  const fixture = createSceneStub({
    images: false,
    audio: { tts: false, generate: true, chapterThemes: true, ...audio },
  });
  const tracks = new Map<string, Json>();
  const music = new Map<string, Json>();
  const answer = (call: Call): Answer | undefined => {
    if (call.path.endsWith("/audio/brief") && call.body?.chapterKey)
      return {
        status: 200,
        json: { prompt: `A distinctive instrumental clockwork theme for ${call.body.chapterKey}.` },
      };
    if (call.path.endsWith("/audio/track")) {
      const { chapterKey, timeZone: _zone, debugMode: _debug, ...track } = call.body!;
      tracks.set(track.tag, track);
      if (chapterKey) {
        if (!music.has(chapterKey)) music.set(chapterKey, track);
        return { status: 200, json: { track: music.get(chapterKey) } };
      }
    }
    const reply = fixture.answer({ ...call, path: call.path.replace("/chapters/main-2", "/chapters/main-1") });
    if (call.path === "/api/game-assets/manifest" && reply?.json) {
      const data = reply.json as Json;
      for (const track of tracks.values()) data.assets[track.tag] = { path: track.path };
    }
    if (call.path.endsWith("/story") && reply?.json) {
      const data = reply.json as Json;
      data.chapters.push({ ...data.chapters[0], key: "main-2", title: "The Second Hour", state: "in-progress" });
    }
    const key = /\/chapters\/(main-[12])(?:\/|$)/u.exec(call.path)?.[1];
    if (key && reply?.json) {
      const data = reply.json as Json;
      if (data.chapter)
        data.chapter = {
          ...data.chapter,
          key,
          tags: ["threats"],
          title: key === "main-1" ? "The Observation Room" : "The Second Hour",
          ...(music.has(key) ? { music: { track: music.get(key) } } : {}),
        };
      if (data.beat) data.beat = { ...data.beat, key };
    }
    return reply;
  };
  return { ...fixture, answer, music };
}

const musicEvents = (page: Page) => page.evaluate(() => [...(globalThis as any).__otomeMusicEvents] as string[]);
const chapterGenerations = (calls: Call[]) =>
  posts(calls, "/api/audio/generate").filter((call) => call.body?.context?.key.includes("-chapter-"));

test("Otome Hearth chapter music is optional, saved, starts after Begin and reuses its theme on replay", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const calls: Call[] = [];
  const fixture = chapterMusicFixture({ generate: false, chapterThemes: false });
  await stubRoutes(page, fixture.answer, calls);
  let root = await openStory(page, { recordMusic: true });
  await root.getByRole("button", { name: "Settings" }).click();
  await root.getByRole("tab", { name: "Audio" }).click();
  const option = root.getByRole("switch", { name: "Generate a theme for each chapter" });
  await expect(option).toHaveCount(0);
  await root.getByRole("switch", { name: "Generate music", exact: true }).check();
  await expect(option).not.toBeChecked();
  await option.check();
  expect(chapterGenerations(calls)).toHaveLength(0);
  await page.screenshot({ path: testInfo.outputPath("chapter-music-settings.png") });
  await root.getByRole("button", { name: "Save changes" }).click();
  await expect(root.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  await root.locator(".of-topbar").getByRole("button", { name: "Back", exact: true }).click();
  await expect.poll(() => posts(calls, "/audio/track").filter((call) => call.body?.cue === "home").length).toBe(1);
  await root.getByRole("button", { name: "Continue: The Observation Room", exact: true }).click();
  await expect(root.getByRole("heading", { name: "Before you begin" })).toBeVisible();
  expect(calls.filter((call) => call.body?.chapterKey && call.path.endsWith("/audio/brief"))).toHaveLength(0);
  await root.getByRole("button", { name: "Begin" }).click();
  await expect.poll(() => fixture.music.has("main-1")).toBe(true);
  await expect.poll(async () => (await musicEvents(page)).at(-1)).toContain("-chapter-main-1:");
  await next(root);
  await next(root);
  expect(chapterGenerations(calls)).toHaveLength(1);
  await root.getByRole("button", { name: "Leave the chapter" }).click();
  await root.getByRole("button", { name: "Continue: The Second Hour", exact: true }).click();
  await root.getByRole("button", { name: "Begin" }).click();
  await expect.poll(() => fixture.music.has("main-2")).toBe(true);
  expect(chapterGenerations(calls)).toHaveLength(2);
  expect(fixture.music.get("main-1")!.tag).not.toBe(fixture.music.get("main-2")!.tag);

  root = await openStory(page, { recordMusic: true });
  await root.getByRole("button", { name: "Continue: The Observation Room", exact: true }).click();
  await root.getByRole("button", { name: "Begin" }).click();
  await expect.poll(async () => (await musicEvents(page)).at(-1)).toContain("-chapter-main-1:");
  expect(chapterGenerations(calls)).toHaveLength(2);
});

test("Otome Hearth keeps current music on chapter generation failure without retrying on another line", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const calls: Call[] = [];
  const fixture = chapterMusicFixture();
  await stubRoutes(
    page,
    (call) =>
      call.path === "/api/audio/generate" && call.body?.context?.key.includes("-chapter-")
        ? { status: 502, json: { error: "Fixture chapter generation failed" } }
        : fixture.answer(call),
    calls,
  );
  const root = await openStory(page, { recordMusic: true });
  await expect.poll(async () => (await musicEvents(page)).at(-1)).toContain("-home:");
  await root.getByRole("button", { name: "Continue: The Observation Room", exact: true }).click();
  const before = await musicEvents(page);
  await root.getByRole("button", { name: "Begin" }).click();
  await expect(root).toContainText("Chapter music couldn’t be generated.");
  await next(root);
  await next(root);
  expect(chapterGenerations(calls)).toHaveLength(1);
  expect(await musicEvents(page)).toEqual(before);
});

test("Otome Hearth keeps current music when a saved chapter theme is missing without paying again on replay or reload", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const calls: Call[] = [];
  const fixture = chapterMusicFixture();
  fixture.music.set("main-1", {
    cue: "chapter-main-1",
    connectionId: "conn-audio",
    tag: "music:contexts:otome-forge:world-0-chapter-main-1:gone",
    path: "music/contexts/otome-forge/world-0-chapter-main-1/gone.mp3",
  });
  await stubRoutes(page, fixture.answer, calls);
  for (let visit = 0; visit < 2; visit += 1) {
    const root = await openStory(page, { recordMusic: true });
    await expect.poll(async () => (await musicEvents(page)).at(-1)).toContain("-home:");
    await root.getByRole("button", { name: "Continue: The Observation Room", exact: true }).click();
    const before = await musicEvents(page);
    await root.getByRole("button", { name: "Begin" }).click();
    await expect(root).toContainText("The saved chapter theme isn’t available. Any current music keeps playing.");
    if (visit === 0) {
      await next(root);
      await next(root);
    }
    expect(chapterGenerations(calls)).toHaveLength(0);
    expect(calls.filter((call) => call.path.endsWith("/audio/brief") && call.body?.chapterKey)).toHaveLength(0);
    expect(await musicEvents(page)).toEqual(before);
    await root.getByRole("button", { name: "Leave the chapter" }).click();
    await root.getByRole("button", { name: "Continue: The Observation Room", exact: true }).click();
    await root.getByRole("button", { name: "Begin" }).click();
    await expect(line(root)).toContainText("I should have stayed away. I didn’t.");
    expect(chapterGenerations(calls)).toHaveLength(0);
    expect(calls.filter((call) => call.path.endsWith("/audio/brief") && call.body?.chapterKey)).toHaveLength(0);
  }
  expect(calls.filter((call) => call.path.endsWith("/gone.mp3"))).toHaveLength(0);
});

test("Otome Hearth keeps the server's first chapter theme fresh when the chapter cue returns", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const calls: Call[] = [];
  const fixture = chapterMusicFixture();
  await stubRoutes(
    page,
    (call) => {
      const reply = fixture.answer(call);
      if (call.path.endsWith("/audio/track") && call.body?.chapterKey && reply?.json) {
        const { timeZone: _zone, debugMode: _debug, chapterKey, ...track } = call.body;
        const kept = {
          ...track,
          tag: track.tag.replace(/:[^:]+$/u, ":other-first"),
          path: track.path.replace(/[^/]+$/u, "other-first.mp3"),
        };
        fixture.music.set(chapterKey, kept);
        reply.json = { track: kept };
      }
      return reply;
    },
    calls,
  );
  const root = await openStory(page, { recordMusic: true });
  await expect.poll(async () => (await musicEvents(page)).at(-1)).toContain("-home:");
  await root.getByRole("button", { name: "Continue: The Observation Room", exact: true }).click();
  await root.getByRole("button", { name: "Begin" }).click();
  await expect.poll(async () => (await musicEvents(page)).at(-1)).toContain(":other-first");
  await next(root);
  await next(root);
  await expect(root).not.toContainText("The saved chapter theme isn’t available.");
  await root.getByRole("button", { name: "Leave the chapter" }).click();
  await expect.poll(async () => (await musicEvents(page)).at(-1)).toContain("-home:");
  await root.getByRole("button", { name: "Continue: The Observation Room", exact: true }).click();
  await root.getByRole("button", { name: "Begin" }).click();
  await expect.poll(async () => (await musicEvents(page)).at(-1)).toContain(":other-first");
  await expect(root).not.toContainText("The saved chapter theme isn’t available.");
  expect(chapterGenerations(calls)).toHaveLength(1);
  expect(calls.filter((call) => call.path.endsWith("/audio/brief") && call.body?.chapterKey)).toHaveLength(1);
});

test("Otome Hearth saves a late chapter theme without playing it over the next chapter", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const calls: Call[] = [];
  const fixture = chapterMusicFixture();
  await stubRoutes(page, fixture.answer, calls);
  let release!: () => void;
  const gate = new Promise<void>((done) => {
    release = done;
  });
  await page.route("**/api/audio/generate", async (route) => {
    if (route.request().postDataJSON().context.key.endsWith("-chapter-main-1")) await gate;
    await route.fallback();
  });
  const root = await openStory(page, { recordMusic: true });
  await expect.poll(async () => (await musicEvents(page)).at(-1)).toContain("-home:");
  await root.getByRole("button", { name: "Continue: The Observation Room", exact: true }).click();
  const before = await musicEvents(page);
  const started = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/audio/generate") && request.postDataJSON().context.key.endsWith("-chapter-main-1"),
  );
  await root.getByRole("button", { name: "Begin" }).click();
  await started;
  expect(await musicEvents(page)).toEqual(before);
  await root.getByRole("button", { name: "Leave the chapter" }).click();
  await root.getByRole("button", { name: "Continue: The Second Hour", exact: true }).click();
  await root.getByRole("button", { name: "Begin" }).click();
  await expect.poll(async () => (await musicEvents(page)).at(-1)).toContain("-chapter-main-2:");
  const second = await musicEvents(page);
  release();
  await expect.poll(() => fixture.music.has("main-1")).toBe(true);
  await expect(line(root)).toContainText("Rain needles the glass dome.");
  expect(await musicEvents(page)).toEqual(second);
  expect(chapterGenerations(calls)).toHaveLength(2);
});

test("Otome Hearth card link: a generated LI keeps their story and art while an explicit card supplies their current voice", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  const name = "Maukie Escher";
  const cardId = "card-maukie-escher";
  const calls: Call[] = [];
  const fixture = createSceneStub({ images: false, audio: { generate: false } });
  const li = fixture.stub.view.lis[0];
  Object.assign(li, { name, source: "archetype", portrait: FACE_COLD, expressions: {} });
  delete li.cardId;
  fixture.stub.view.lis[1].cardId = "card-cassian";
  const bible = normalizeBible({ age: 29, pronouns: HE, publicFace: "The generated story still belongs to Maukie." })!;
  const note = {
    li: ILVAR,
    dayKey: "2026-10-29",
    text: "The light is still on. Come inside.",
    face: "",
    mood: { word: "Fond", reason: "You came back" },
    curt: false,
    at: written.at,
  };
  const home = {
    li: ILVAR,
    show: "him",
    note,
    look: { url: FACE_COLD, source: "look", cutoutState: "uncut" },
    faces: {},
    backdrop: null,
    lines: { ready: false },
    rupture: false,
    unread: 0,
    noticed: null,
    noticing: false,
  };
  let cards: Json[] = [];
  let revision = 0;
  const configReadAt: number[] = [];
  const cardPath = `/api/otome-forge/runs/${RUN}/lis/${ILVAR}/card`;
  await stubRoutes(
    page,
    (call) => {
      if (call.path === cardPath && call.method === "POST") {
        revision += 1;
        if (call.body!.cardId) li.cardId = call.body!.cardId;
        else delete li.cardId;
        return { status: 200, json: { cardId: li.cardId ?? null } };
      }
      if (call.path.endsWith(`/lis/${ILVAR}/bible`)) return { status: 200, json: { bible } };
      if (call.path.endsWith("/home")) return { status: 200, json: home };
      if (call.path.endsWith(`/lis/${ILVAR}/lines`)) {
        return {
          status: 200,
          json: {
            ready: false,
            stage: li.stage,
            rupture: false,
            tap: null,
            annoyed: [],
            cold: [],
            comfort: [],
            claw: null,
          },
        };
      }
      if (call.path === "/api/tts/config") {
        configReadAt.push(Date.now());
        return {
          status: 200,
          json: {
            enabled: true,
            connectionId: "conn-tts",
            connectionProfiles: {
              "conn-tts": {
                voiceAssignments: li.cardId ? [{ characterId: cardId, voice: "Maukie card voice" }] : [],
                npcDefaultMaleVoices: [revision ? "Unlinked pool voice" : "Original pool voice"],
                npcDefaultFemaleVoices: ["Pool Female"],
              },
            },
          },
        };
      }
      return fixture.answer(call);
    },
    calls,
  );
  await page.route("**/api/characters/catalog?*", (route) => route.fulfill({ json: { items: cards, hasMore: false } }));
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const root = await openOtome(page);
  await recordSpeech(page);
  const configReads = () => calls.filter((call) => call.path === "/api/tts/config").length;
  const playNote = async (voice: string, expectedCard: string | null, fromBible = false) => {
    if (fromBible) {
      await expect(root.getByRole("heading", { name: `${name}’s bible` })).toBeVisible();
      await root.locator(".of-topbar").getByRole("button", { name: "Back", exact: true }).click();
      await expect(root.getByRole("heading", { name: "Your story is ready", exact: true })).toBeVisible();
      await root.locator(".of-topbar").getByRole("button", { name: "Back", exact: true }).click();
    }
    await root.getByRole("button", { name: `Home with ${name}`, exact: true }).click();
    await expect(root.getByRole("heading", { name, exact: true })).toBeVisible();
    const count = (await spoken(page)).length;
    // The host also reads its own config on startup; isolate this note action's Otome fetch.
    const configsBefore = configReads();
    await root.getByRole("button", { name: `Hear ${name} read the note` }).click();
    await expect.poll(async () => (await spoken(page)).length).toBe(count + 1);
    expect(configReads()).toBe(configsBefore + 1);
    const request = (await spoken(page))[count]!.requests[0]!;
    expect(request).toMatchObject({ speaker: name, text: note.text, voice });
    expect(request.characterId ?? null).toBe(expectedCard);
    await expect
      .poll(() => page.evaluate(() => (globalThis as any).__MARINARA_HOST__.services.tts.ttsService.getState()))
      .toBe("idle");
    return configReadAt.at(-1)!;
  };
  const openLink = async () => {
    await root.getByRole("button", { name: "Who’s home" }).click();
    const picker = page.getByRole("dialog", { name: "Who’s home" });
    await expect(picker.getByText("Affection 2", { exact: true })).toBeVisible();
    await picker.getByRole("button", { name: "Your cast" }).click();
    await root.getByRole("button", { name: `Open ${name}’s bible (spoilers)` }).click();
    await expect(root.getByRole("heading", { name: `${name}’s bible` })).toBeVisible();
    await expect(root.locator(".of-page-head .of-avatar img")).toHaveAttribute("src", FACE_COLD);
    return root.getByRole("form", { name: "Character card", exact: true });
  };

  // A same-name card cannot silently attach itself: the generated LI starts with its own pool voice and no link.
  const originalConfigAt = await playNote("Original pool voice", null);
  let form = await openLink();
  const select = form.getByRole("combobox", { name: "Character card", exact: true });
  await expect(select).toHaveValue("");
  await expect(root.getByRole("button", { name: "Show spoilers" })).toBeVisible();
  cards = [
    { id: cardId, name, avatarPath: "/api/avatars/file/maukie.png" },
    { id: "card-cassian", name: "Cassian card", avatarPath: null },
  ];
  await form.getByRole("button", { name: "Refresh cards" }).click();
  await expect(select.getByRole("option", { name, exact: true })).toHaveCount(1);
  await expect(select.getByRole("option", { name: "Cassian card", exact: true })).toBeDisabled();
  await select.selectOption(cardId);
  await form.getByRole("button", { name: "Save card link" }).click();
  await expect(form.getByRole("status")).toHaveText("Saved.");
  expect(posts(calls, "/card").map((call) => call.body!.cardId)).toEqual([cardId]);
  await page.screenshot({ path: testInfo.outputPath("card-link-saved.png") });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  await expect(root).toHaveAttribute("data-look", "midnight");
  await page.screenshot({ path: testInfo.outputPath("card-link-saved-midnight.png") });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await expect(root).toHaveAttribute("data-look", "pearl");

  // The same controller has a cached config from the unlinked voice: linking must fetch the new assignment now.
  const linkedConfigAt = await playNote("Maukie card voice", cardId, true);
  expect(
    linkedConfigAt - originalConfigAt,
    "the previous config is still inside its 30-second cache window",
  ).toBeLessThan(30_000);
  expect(posts(calls, "/api/tts/speak").some((call) => call.body?.voice === "Maukie card voice")).toBe(true);
  await page.reload();
  await page.getByRole("tab", { name: "Open Otome Hearth" }).click();
  await expect(root.getByRole("heading", { name, exact: true })).toBeVisible();
  await recordSpeech(page);
  form = await openLink();
  await expect(form.getByRole("combobox", { name: "Character card" })).toHaveValue(cardId);
  // Removing a library card does not silently reassign or unlink this LI when the catalogue is refreshed.
  const available = cards;
  cards = [];
  await form.getByRole("button", { name: "Refresh cards" }).click();
  await expect(form.getByRole("option", { name: "Linked card unavailable" })).toHaveCount(1);
  await expect(form.getByRole("combobox", { name: "Character card" })).toHaveValue(cardId);
  cards = available;
  await form.getByRole("button", { name: "Refresh cards" }).click();
  await expect(form.getByRole("option", { name, exact: true })).toHaveCount(1);
  await root.getByRole("button", { name: "Show spoilers" }).click();
  await expect(root.getByText(bible.publicFace, { exact: true })).toBeVisible();
  await expect(root.getByText("Card canon wins.", { exact: true })).toHaveCount(0);
  const reloadedLinkedConfigAt = await playNote("Maukie card voice", cardId, true);
  form = await openLink();
  await form.getByRole("combobox", { name: "Character card" }).selectOption("");
  await form.getByRole("button", { name: "Save card link" }).click();
  await expect(form.getByRole("status")).toHaveText("Saved.");
  await expect(form.getByRole("combobox", { name: "Character card" })).toHaveValue("");
  const unlinkedConfigAt = await playNote("Unlinked pool voice", null, true);
  expect(unlinkedConfigAt - reloadedLinkedConfigAt, "unlink refreshes the still-cached linked config").toBeLessThan(
    30_000,
  );
  form = await openLink();
  await expect(form.getByRole("combobox", { name: "Character card" })).toHaveValue("");
  await root.getByRole("button", { name: "Show spoilers" }).click();
  await expect(root.getByText(bible.publicFace, { exact: true })).toBeVisible();
  await expect(root.getByText("Card canon wins.", { exact: true })).toHaveCount(0);
  expect(posts(calls, "/card").map((call) => call.body!.cardId)).toEqual([cardId, null]);
  for (const call of posts(calls, "/card")) {
    expect(Object.keys(call.body!).sort()).toEqual(["cardId", "debugMode", "timeZone"]);
    expect(call.path).toBe(cardPath);
  }
  expect(
    calls.filter(
      (call) =>
        call.method === "POST" &&
        call.path.startsWith("/api/otome-forge/") &&
        !call.path.endsWith("/index/opened") &&
        call.path !== cardPath,
    ),
  ).toEqual([]);
  expect(posts(calls, "/api/audio/generate")).toEqual([]);
  expect(pageErrors).toEqual([]);
});

// Desktop categories stay visible; phone categories deliberately use one native horizontal strip.
// Prove its scroll before clicking: Playwright would otherwise reveal off-screen tabs for the test.
test("Otome Hearth Settings fills its frame and exposes every tab on desktop and phone", async ({
  page,
  isMobile,
  browserName,
}, testInfo) => {
  const sizes = isMobile
    ? [
        { width: 390, height: 844 },
        { width: 844, height: 390 },
      ]
    : [
        { width: 1280, height: 720 },
        { width: 961, height: 640 },
      ];
  await page.setViewportSize(sizes[0]!);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const calls: Call[] = [];
  const { answer } = createSceneStub({ images: false, audio: false });
  await stubRoutes(page, answer, calls);
  const root = await openStory(page);
  const fullscreen = root.getByRole("button", { name: /fullscreen/iu });
  const initialFullscreen = await fullscreen.getAttribute("aria-label");
  await root.getByRole("button", { name: "Settings", exact: true }).click();
  const settings = root.locator(".of-settings");
  const tabs = settings.getByRole("tablist");
  const names = ["Look", "Content", "Connections", "Images", "Audio", "Tracker", "Privacy & data", "Debug"];
  for (const [index, size] of sizes.entries()) {
    await page.setViewportSize(size);
    await settings.evaluate((element) => element.scrollTo(0, 0));
    await tabs.getByRole("tab", { name: "Look", exact: true }).click();
    const look = index === 0 ? "Midnight" : "Pearl";
    await settings.getByText(look, { exact: true }).click();
    await expect(root).toHaveAttribute("data-look", look.toLowerCase());
    const [frame, stage] = [
      await root.locator(".of-frame").boundingBox(),
      await root.locator(".of-stage").boundingBox(),
    ];
    expect(Math.abs(stage!.x - frame!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(stage!.y - frame!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(stage!.width - frame!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(stage!.height - frame!.height)).toBeLessThanOrEqual(1);
    const bounds = await tabs.evaluate((element) => {
      const strip = element.getBoundingClientRect();
      return {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        tabs: [...element.querySelectorAll('[role="tab"]')].map((tab) => {
          const box = tab.getBoundingClientRect();
          return { left: box.left - strip.left, right: box.right - strip.right, top: box.top };
        }),
      };
    });
    await page.screenshot({ path: testInfo.outputPath(`settings-categories-${size.width}-${look.toLowerCase()}.png`) });
    expect(bounds.tabs).toHaveLength(names.length);
    if (isMobile) {
      expect(
        Math.max(...bounds.tabs.map((tab) => tab.top)) - Math.min(...bounds.tabs.map((tab) => tab.top)),
      ).toBeLessThanOrEqual(1);
      if (index === 0) expect(bounds.scrollWidth).toBeGreaterThan(bounds.clientWidth + 1);
      if (bounds.scrollWidth > bounds.clientWidth + 1) {
        const strip = await tabs.boundingBox();
        if (browserName === "webkit") {
          // Playwright has no mobile WebKit wheel input; CSSOM proves native overflow, not a physical swipe.
          await tabs.evaluate((element) => element.scrollBy({ left: element.scrollWidth }));
        } else {
          await page.mouse.move(strip!.x + strip!.width / 2, strip!.y + strip!.height / 2);
          await page.mouse.wheel(bounds.scrollWidth, 0);
        }
        await expect
          .poll(() => tabs.evaluate((element) => element.scrollWidth - element.clientWidth - element.scrollLeft))
          .toBeLessThanOrEqual(1);
        const debug = await tabs.getByRole("tab", { name: "Debug", exact: true }).boundingBox();
        expect(debug!.x).toBeGreaterThanOrEqual(strip!.x - 1);
        expect(debug!.x + debug!.width).toBeLessThanOrEqual(strip!.x + strip!.width + 1);
      }
    } else {
      expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.clientWidth + 1);
      for (const tab of bounds.tabs) {
        expect(tab.left).toBeGreaterThanOrEqual(-1);
        expect(tab.right).toBeLessThanOrEqual(1);
      }
    }
    for (const name of names) {
      const tab = tabs.getByRole("tab", { name, exact: true });
      await tab.click();
      await expect(tab).toHaveAttribute("aria-selected", "true");
      await expect(settings.getByRole("tabpanel")).toBeVisible();
    }
    await tabs.getByRole("tab", { name: "Debug", exact: true }).focus();
    await page.keyboard.press("Home");
    await expect(tabs.getByRole("tab", { name: "Look", exact: true })).toBeFocused();
    await page.keyboard.press("End");
    await expect(tabs.getByRole("tab", { name: "Debug", exact: true })).toBeFocused();
    await expect(fullscreen).toHaveAttribute("aria-label", initialFullscreen!);
    await page.screenshot({ path: testInfo.outputPath(`settings-${size.width}-${look.toLowerCase()}.png`) });
  }
  await root.getByRole("button", { name: "Back", exact: true }).click();
  await expect(root.getByRole("heading", { name: "Story", exact: true })).toBeVisible();
  const [frame, stage] = [await root.locator(".of-frame").boundingBox(), await root.locator(".of-stage").boundingBox()];
  expect(stage!.width).toBeLessThan(frame!.width);
  await expect(fullscreen).toHaveAttribute("aria-label", initialFullscreen!);
});

test("Otome Hearth Settings scrolls to the last control on long pages", async ({ page, isMobile, browserName }) => {
  // Enter from a normal Story height; only Settings is under test at the short viewport.
  await page.setViewportSize({ width: isMobile ? 390 : 961, height: isMobile ? 844 : 640 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const calls: Call[] = [];
  const { answer } = createSceneStub({ images: false, audio: false });
  await stubRoutes(page, answer, calls);
  const root = await openStory(page);
  await root.getByRole("button", { name: "Settings", exact: true }).click();
  const settings = root.locator(".of-settings");
  await expect(settings).toBeVisible();
  await page.setViewportSize({ width: isMobile ? 390 : 961, height: 480 });
  let scrolledPages = 0;
  for (const name of ["Content", "Audio", "Privacy & data"]) {
    await settings.getByRole("tab", { name, exact: true }).click();
    await settings.evaluate((element) => element.scrollTo(0, 0));
    const [frame, stage] = [
      await root.locator(".of-frame").boundingBox(),
      await root.locator(".of-stage").boundingBox(),
    ];
    expect(stage!.width).toBeLessThanOrEqual(frame!.width + 1);
    expect(stage!.height).toBeLessThanOrEqual(frame!.height + 1);
    const before = await settings.evaluate((element) => ({
      height: element.clientHeight,
      content: element.scrollHeight,
    }));
    const box = await settings.boundingBox();
    if (before.content > before.height + 1) {
      if (browserName === "webkit" && isMobile) {
        // Mobile WebKit has no Playwright wheel API. This native CSSOM probe is not physical touch proof.
        await settings.evaluate((element, distance) => element.scrollBy(0, distance), before.content);
      } else {
        await page.mouse.move(box!.x + 4, box!.y + box!.height / 2);
        await page.mouse.wheel(0, before.content);
      }
      await expect.poll(() => settings.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      await expect
        .poll(() => settings.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop))
        .toBeLessThanOrEqual(1);
      scrolledPages += 1;
    }
    const last = settings.getByRole("tabpanel").getByRole("button").last();
    const control = await last.boundingBox();
    expect(control!.y).toBeGreaterThanOrEqual(box!.y - 1);
    expect(control!.y + control!.height).toBeLessThanOrEqual(box!.y + box!.height + 1);
    await last.focus();
    await expect(last).toBeFocused();
    expect(await root.locator(".of-frame").evaluate((element) => element.scrollTop)).toBe(0);
    expect(await root.locator(".of-stage").evaluate((element) => element.scrollTop)).toBe(0);
  }
  expect(scrolledPages).toBeGreaterThan(0);
  expect(calls.filter((call) => call.method === "POST" && call.path.endsWith("/settings"))).toEqual([]);
});

test("Otome Hearth cast repaint actions share one row with separate image costs", async ({
  page,
  isMobile,
}, testInfo) => {
  const sizes = isMobile
    ? [
        { width: 390, height: 844 },
        { width: 844, height: 390 },
      ]
    : [
        { width: 1280, height: 720 },
        { width: 961, height: 640 },
      ];
  await page.setViewportSize(sizes[0]!);
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  const fixture = expressionRepaintFixture();
  const calls: Call[] = [];
  await stubRoutes(page, fixture.answer, calls);
  const root = await openRepaintCast(page);
  const actions = root.locator(".of-forge-retry--paints");
  const repaint = actions.getByRole("button", { name: "Repaint Ilvar Thorne’s look", exact: true });
  const expressions = actions.getByRole("button", { name: "Repaint expressions for Ilvar Thorne", exact: true });
  for (const [index, size] of sizes.entries()) {
    await page.setViewportSize(size);
    await page.emulateMedia({ colorScheme: index === 0 ? "dark" : "light" });
    const look = index === 0 ? "midnight" : "pearl";
    await expect(root).toHaveAttribute("data-look", look);
    await actions.scrollIntoViewIfNeeded();
    await expect(repaint).toBeVisible();
    await expect(expressions).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`cast-repaint-${size.width}-${look}.png`) });
    const expressionRects = await expressions.evaluate((element) => {
      const text = [...element.childNodes].find(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.includes("expressions"),
      )!;
      const start = text.textContent!.indexOf("expressions");
      const range = document.createRange();
      range.setStart(text, start);
      range.setEnd(text, start + "expressions".length);
      return [...range.getClientRects()].map((rect) => ({ left: rect.left, right: rect.right }));
    });
    expect(expressionRects).toHaveLength(1);
    const [one, five, group] = await Promise.all([
      repaint.boundingBox(),
      expressions.boundingBox(),
      actions.boundingBox(),
    ]);
    expect(Math.abs(one!.y - five!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(one!.width - five!.width)).toBeLessThanOrEqual(1);
    expect(expressionRects[0]!.left).toBeGreaterThanOrEqual(five!.x);
    expect(expressionRects[0]!.right).toBeLessThanOrEqual(five!.x + five!.width);
    for (const [button, box, cost] of [
      [repaint, one!, "Paints 1 image"],
      [expressions, five!, "Paints 5 images"],
    ] as const) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(group!.x - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(group!.x + group!.width + 1);
      const hint = button.locator("..").getByText(cost, { exact: true });
      await expect(hint).toBeVisible();
      const hintBox = await hint.boundingBox();
      expect(hintBox!.y).toBeGreaterThanOrEqual(box.y + box.height);
      expect(hintBox!.x + hintBox!.width).toBeLessThanOrEqual(group!.x + group!.width + 1);
      const costWords = await hint.evaluate((element) => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const words = [];
        for (let text = walker.nextNode(); text; text = walker.nextNode()) {
          for (const match of text.textContent!.matchAll(/\S+/gu)) {
            const range = document.createRange();
            range.setStart(text, match.index);
            range.setEnd(text, match.index + match[0].length);
            words.push([...range.getClientRects()].map((rect) => ({ left: rect.left, right: rect.right })));
          }
        }
        return words;
      });
      expect(costWords.length).toBeGreaterThan(0);
      for (const rects of costWords) {
        expect(rects).toHaveLength(1);
        expect(rects[0]!.left).toBeGreaterThanOrEqual(box.x - 1);
        expect(rects[0]!.right).toBeLessThanOrEqual(box.x + box.width + 1);
      }
    }
  }
  expect(posts(calls, "/art/paint")).toEqual([]);
  expect(posts(calls, "/art/expressions")).toEqual([]);
  expect(posts(calls, "/art/expressions/prompt")).toEqual([]);
});

test("Otome Hearth affection shows per-level progress below Level beside its hearts", async ({
  page,
  isMobile,
}, testInfo) => {
  await page.setViewportSize({ width: isMobile ? 390 : 1280, height: isMobile ? 844 : 720 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  const fixture = createSceneStub({ images: false, audio: false });
  const lis = fixture.stub.view.lis as Json[];
  Object.assign(lis[0]!, { level: 1, affectionProgress: { current: 0, required: 300 } });
  Object.assign(lis[1]!, { level: 1, affectionProgress: { current: 299, required: 300 } });
  Object.assign(lis[2]!, { level: 2, affectionProgress: { current: 0, required: 300 } });
  lis.push({
    ...lis[2]!,
    id: "li-max-0004",
    name: "Marin",
    level: 10,
    affectionProgress: { current: 300, required: 300 },
  });
  lis.push({ ...lis[2]!, id: "li-legacy-0005", name: "Ren", level: 3 });
  delete lis[4]!.affectionProgress;
  const calls: Call[] = [];
  await stubRoutes(page, fixture.answer, calls);
  const root = await openStory(page);
  const section = root.getByRole("region", { name: "Between you", exact: true });
  for (const look of ["midnight", "pearl"] as const) {
    await page.emulateMedia({ colorScheme: look === "midnight" ? "dark" : "light" });
    await expect(root).toHaveAttribute("data-look", look);
    await section.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`affection-progress-${look}.png`) });
    for (const li of lis.slice(0, 4)) {
      const row = section.getByRole("listitem").filter({ hasText: li.name });
      const meter = row.getByRole("meter", { name: `${li.name}: affection progress`, exact: true });
      await expect(meter).toBeVisible();
      await expect(meter).toHaveText(`${li.affectionProgress.current} / ${li.affectionProgress.required}`);
      await expect(meter).toHaveAttribute("aria-valuemin", "0");
      await expect(meter).toHaveAttribute("aria-valuemax", "300");
      await expect(meter).toHaveAttribute("aria-valuenow", String(li.affectionProgress.current));
      await expect(meter).toHaveAttribute(
        "aria-valuetext",
        li.level === 10
          ? "Maximum affection level reached"
          : `${li.affectionProgress.current} of 300 affection toward the next level`,
      );
      const [counter, level, hearts] = await Promise.all([
        meter.boundingBox(),
        row.locator(".of-affection-level").boundingBox(),
        row.locator(".of-hearts").boundingBox(),
      ]);
      expect(counter!.y).toBeGreaterThanOrEqual(level!.y + level!.height);
      expect(Math.abs(counter!.x + counter!.width - level!.x - level!.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(counter!.y + counter!.height / 2 - hearts!.y - hearts!.height / 2)).toBeLessThanOrEqual(2);
    }
    const legacy = section.getByRole("listitem").filter({ hasText: "Ren" });
    await expect(legacy).toBeVisible();
    await expect(legacy.getByRole("meter")).toHaveCount(0);
  }
  expect(
    calls.filter(
      (call) =>
        call.method === "POST" && call.path.startsWith("/api/otome-forge/") && !call.path.endsWith("/index/opened"),
    ),
  ).toEqual([]);
});

test("Otome Hearth edits image appearance above Bible without spoilers or painting", async ({
  page,
  isMobile,
}, testInfo) => {
  await page.setViewportSize({ width: isMobile ? 390 : 1280, height: isMobile ? 844 : 720 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  const fixture = expressionRepaintFixture();
  const identityLine = "An adult cartographer with silver hair and round glasses.";
  fixture.view.lis[0].look = { identityLine, outfitLine: "A navy winter coat." };
  const calls: Call[] = [];
  const path = `/api/otome-forge/runs/${RUN}/lis/${ILVAR}/appearance`;
  let attempts = 0;
  let release!: () => void;
  const wait = new Promise<void>((resolve) => (release = resolve));
  const answer = (call: Call): Answer | undefined => {
    if (call.path !== path || call.method !== "POST") return fixture.answer(call);
    attempts += 1;
    if (attempts === 1) return { status: 400, json: { error: "Controlled save rejection.", code: "bad-request" } };
    const saved = String(call.body!.identityLine).trim() || identityLine;
    fixture.view.lis[0].look.identityLine = saved;
    return { status: 200, json: { identityLine: saved }, ...(attempts === 2 ? { wait } : {}) };
  };
  await stubRoutes(page, answer, calls);
  try {
    const root = await openRepaintCast(page);
    await page.screenshot({ path: testInfo.outputPath("cast-before-appearance-editor.png") });
    const form = root.getByRole("form", { name: "Image appearance for Ilvar Thorne", exact: true });
    await expect(form).toBeVisible();
    const field = form.getByRole("textbox", { name: "Image appearance", exact: true });
    const save = form.getByRole("button");
    await expect(save).toHaveAccessibleName("Save changes");
    await expect(field).toHaveValue(identityLine);
    await expect(save).toBeDisabled();
    const bible = root.getByRole("button", { name: "Open Ilvar Thorne’s bible (spoilers)", exact: true });
    const [editor, bibleBox] = await Promise.all([form.boundingBox(), bible.boundingBox()]);
    expect(editor!.y + editor!.height).toBeLessThanOrEqual(bibleBox!.y);
    const portrait = await root.locator(".of-cast-card").first().locator("img").getAttribute("src");
    const first = "An adult cartographer with dark hair and round glasses.";
    await field.fill(first);
    await save.click();
    await expect(form.locator(".of-notice--error")).toBeVisible();
    await expect(field).toHaveValue(first);
    const pending = page.waitForResponse((response) => new URL(response.url()).pathname === path);
    await save.click();
    await expect(save).toHaveAccessibleName("Saving…");
    await expect(save).toHaveAttribute("aria-disabled", "true");
    await expect(save).toBeDisabled();
    const newer = "An adult cartographer with dark hair, round glasses and freckles.";
    await field.fill(newer);
    release();
    await (await pending).finished();
    await expect(field).toHaveValue(newer);
    await expect(save).toBeEnabled();
    const success = page.waitForResponse((response) => new URL(response.url()).pathname === path);
    await save.click();
    await (await success).finished();
    await expect(form.getByRole("status")).toContainText("Image appearance saved.");
    await expect(save).toBeDisabled();
    await expect(field).toHaveValue(newer);
    await field.fill("");
    const restored = page.waitForResponse((response) => new URL(response.url()).pathname === path);
    await save.click();
    await (await restored).finished();
    await expect(field).toHaveValue(identityLine);
    await expect(root.locator(".of-cast-card").first().locator("img")).toHaveAttribute("src", portrait!);
    expect(fixture.view.lis[0].look.outfitLine).toBe("A navy winter coat.");
    expect(
      calls.filter((call) => call.method === "POST" && call.path === path).map((call) => call.body!.identityLine),
    ).toEqual([first, first, newer, ""]);
    await field.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("cast-appearance-saved-midnight.png") });
    await page.reload();
    const reopened = await openRepaintCast(page);
    await expect(
      reopened
        .getByRole("form", { name: "Image appearance for Ilvar Thorne", exact: true })
        .getByRole("textbox", { name: "Image appearance", exact: true }),
    ).toHaveValue(identityLine);
    expect(calls.filter((call) => /\/bible(?:\/|$)/u.test(call.path))).toEqual([]);
    expect(posts(calls, "/art/paint")).toEqual([]);
    expect(posts(calls, "/art/expressions")).toEqual([]);
  } finally {
    release();
  }
});

test("Otome Hearth selects a saved music folder without generating music", async ({ page, isMobile }, testInfo) => {
  await page.setViewportSize({ width: isMobile ? 390 : 1280, height: isMobile ? 844 : 720 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  const fixture = expressionRepaintFixture();
  Object.assign(fixture.view.world.audio, { tts: false, generate: false, chapterThemes: false, musicFolder: "" });
  fixture.view.world.images.connectionId = null;
  const folder = "music/custom/romance";
  const musicPath = `${folder}/summer.mp3`;
  const assets = {
    "music:dialogue:slice_of_life:calm:morning-tea": { path: "music/dialogue/slice_of_life/calm/morning-tea.mp3" },
    "music:custom:romance:summer": { path: musicPath },
    "backgrounds:room": { path: "backgrounds/room.png" },
  };
  const calls: Call[] = [];
  const answer = (call: Call): Answer | undefined =>
    call.path === "/api/game-assets/manifest"
      ? { status: 200, json: { scannedAt: now(), count: Object.keys(assets).length, assets, byCategory: {} } }
      : fixture.answer(call);
  await stubRoutes(page, answer, calls);
  const root = await openStory(page, { recordMusic: true });
  await root.getByRole("button", { name: "Settings", exact: true }).click();
  await root.getByRole("tab", { name: "Audio", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("audio-before-folder-selector.png") });
  const select = root.getByRole("combobox", { name: "Music folder", exact: true });
  await expect(select).toBeVisible();
  await expect(select).toHaveValue("");
  await expect(select.getByRole("option", { name: folder, exact: true })).toHaveCount(1);
  await expect(select.getByRole("option", { name: "music", exact: true })).toHaveCount(1);
  await expect(select.getByRole("option", { name: "backgrounds", exact: true })).toHaveCount(0);
  await select.selectOption(folder);
  expect(posts(calls, "/audio/settings")).toEqual([]);
  const saved = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/audio/settings"));
  await root.getByRole("button", { name: "Save changes", exact: true }).click();
  await (await saved).finished();
  expect(posts(calls, "/audio/settings")).toHaveLength(1);
  expect(posts(calls, "/audio/settings")[0]!.body!.audio).toMatchObject({ generate: false, musicFolder: folder });
  await root.getByRole("button", { name: "Back", exact: true }).click();
  await root.getByRole("button", { name: "Home with Ilvar Thorne", exact: true }).click();
  await expect
    .poll(
      () =>
        calls.filter(
          (call) =>
            call.method === "GET" && decodeURIComponent(call.path).endsWith(`/api/game-assets/file/${musicPath}`),
        ).length,
    )
    .toBeGreaterThan(0);
  await root.getByRole("button", { name: "Settings", exact: true }).click();
  await root.getByRole("tab", { name: "Audio", exact: true }).click();
  await expect(root.getByRole("combobox", { name: "Music folder", exact: true })).toHaveValue(folder);
  await page.screenshot({ path: testInfo.outputPath("audio-folder-saved-pearl.png") });
  expect(posts(calls, "/api/audio/generate")).toEqual([]);
  expect(posts(calls, "/audio/brief")).toEqual([]);
  expect(posts(calls, "/audio/track")).toEqual([]);
});

test("Otome Hearth retains an unavailable saved music folder and uses stock without paying", async ({
  page,
  isMobile,
}, testInfo) => {
  await page.setViewportSize({ width: isMobile ? 390 : 1280, height: isMobile ? 844 : 720 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  const fixture = expressionRepaintFixture();
  const missing = "music/deleted/romance";
  Object.assign(fixture.view.world.audio, { tts: false, generate: false, chapterThemes: false, musicFolder: missing });
  fixture.view.world.images.connectionId = null;
  const stock = "music/dialogue/slice_of_life/calm/morning-tea.mp3";
  const calls: Call[] = [];
  const answer = (call: Call): Answer | undefined =>
    call.path === "/api/game-assets/manifest"
      ? {
          status: 200,
          json: {
            scannedAt: now(),
            count: 1,
            assets: { "music:dialogue:slice_of_life:calm:morning-tea": { path: stock } },
            byCategory: {},
          },
        }
      : fixture.answer(call);
  await stubRoutes(page, answer, calls);
  const root = await openStory(page, { recordMusic: true });
  await root.getByRole("button", { name: "Settings", exact: true }).click();
  await root.getByRole("tab", { name: "Audio", exact: true }).click();
  const folder = root.getByRole("combobox", { name: "Music folder", exact: true });
  await expect(folder).toHaveValue(missing);
  await expect(folder.getByRole("option", { name: missing, exact: true })).toHaveCount(1);
  await expect(
    root.getByText("The selected folder is unavailable. Engine library music will play instead.", { exact: true }),
  ).toBeVisible();
  await root.getByText("Generate music", { exact: true }).click();
  await expect(root.getByRole("switch", { name: "Generate music", exact: true })).toBeChecked();
  await expect(folder).toHaveCount(0);
  expect(posts(calls, "/audio/settings")).toEqual([]);
  await root.getByRole("button", { name: "Back", exact: true }).click();
  await root.getByRole("button", { name: "Home with Ilvar Thorne", exact: true }).click();
  await expect
    .poll(
      () =>
        calls.filter(
          (call) => call.method === "GET" && decodeURIComponent(call.path).endsWith(`/api/game-assets/file/${stock}`),
        ).length,
    )
    .toBeGreaterThan(0);
  await root.getByRole("button", { name: "Settings", exact: true }).click();
  await root.getByRole("tab", { name: "Audio", exact: true }).click();
  await expect(root.getByRole("switch", { name: "Generate music", exact: true })).not.toBeChecked();
  await expect(root.getByRole("combobox", { name: "Music folder", exact: true })).toHaveValue(missing);
  await page.screenshot({ path: testInfo.outputPath("audio-missing-folder-midnight.png") });
  expect(posts(calls, "/api/audio/generate")).toEqual([]);
  expect(posts(calls, "/audio/brief")).toEqual([]);
  expect(posts(calls, "/audio/track")).toEqual([]);
  expect(calls.filter((call) => decodeURIComponent(call.path).includes(`/api/game-assets/file/${missing}/`))).toEqual(
    [],
  );
});

test("Otome Hearth appearance follows pristine same-LI refreshes and preserves dirty edits", async ({
  page,
  isMobile,
}, testInfo) => {
  await page.setViewportSize({ width: isMobile ? 390 : 1280, height: isMobile ? 844 : 720 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  const fixture = expressionRepaintFixture();
  const original = "An adult cartographer with silver hair.";
  fixture.view.lis[0].look = { identityLine: original, outfitLine: "A navy coat." };
  fixture.view.cutoutsPending = true;
  const calls: Call[] = [];
  await stubRoutes(page, fixture.answer, calls);
  const root = await openRepaintCast(page);
  const form = root.getByRole("form", { name: "Image appearance for Ilvar Thorne", exact: true });
  const field = form.getByRole("textbox", { name: "Image appearance", exact: true });
  const save = form.getByRole("button", { name: "Save changes", exact: true });
  await expect(field).toHaveValue(original);
  await expect(save).toBeDisabled();
  const refresh = (identityLine: string) =>
    page.waitForResponse(
      async (response) =>
        new URL(response.url()).pathname === `/api/otome-forge/runs/${RUN}` &&
        (await response.json()).view?.lis[0]?.look?.identityLine === identityLine,
    );
  const remote = "An adult cartographer with copper hair.";
  const received = refresh(remote);
  fixture.view.lis[0].look.identityLine = remote;
  await (await received).finished();
  await page.screenshot({ path: testInfo.outputPath("appearance-pristine-refetch.png") });
  await expect(field).toHaveValue(remote);
  await expect(save).toBeDisabled();
  const draft = "My unsaved appearance, kept while the run refreshes.";
  await field.fill(draft);
  const latest = "Another saved appearance from the server.";
  const again = refresh(latest);
  fixture.view.lis[0].look.identityLine = latest;
  await (await again).finished();
  await expect(field).toHaveValue(draft);
  await expect(save).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath("appearance-dirty-refetch.png") });
  expect(calls.filter((call) => call.method === "POST" && call.path.endsWith(`/lis/${ILVAR}/appearance`))).toEqual([]);
  expect(posts(calls, "/art/paint")).toEqual([]);
  expect(posts(calls, "/art/expressions")).toEqual([]);
  delete fixture.view.cutoutsPending;
});

test("Otome Hearth fullscreen fills the whole mode across navigation and restores the portrait stage", async ({
  page,
  isMobile,
}, testInfo) => {
  const sizes = isMobile
    ? [
        { width: 390, height: 844 },
        { width: 844, height: 390 },
      ]
    : [
        { width: 1440, height: 900 },
        { width: 961, height: 480 },
      ];
  await page.setViewportSize(sizes[0]!);
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  const fixture = expressionRepaintFixture();
  fixture.view.world.images.connectionId = null;
  const original = JSON.stringify(fixture.view);
  const calls: Call[] = [];
  const answer = (call: Call): Answer | undefined => {
    if (call.path.endsWith("/wish") && call.method === "GET")
      return {
        status: 200,
        json: {
          starlight: fixture.view.starlight,
          banners: [],
          echoes: [],
          pity: Object.fromEntries(
            ["memories", "his-wardrobe", "my-wardrobe"].map((kind) => [kind, { fiveIn: 60, fourIn: 10 }]),
          ),
          creating: false,
          missing: [],
          selectors: [],
          rotation: { number: 1, startsDay: "2026-10-28", endsDay: "2026-11-10" },
        },
      };
    if (call.path.endsWith("/wardrobe"))
      return { status: 200, json: { him: {}, me: [], couples: [], noticed: null, noticing: false } };
    if (call.path.endsWith("/album"))
      return { status: 200, json: { cgs: [], memories: [], timeline: [], favorites: [], soundtrack: [], tells: {} } };
    if (call.path.endsWith("/play"))
      return {
        status: 200,
        json: {
          dayKey: now().slice(0, 10),
          starlight: { earned: 0, cap: 60 },
          affection: { earned: {}, cap: 30 },
          plush: {},
          lis: {},
        },
      };
    return fixture.answer(call);
  };
  await stubRoutes(page, answer, calls);
  const root = await openStory(page);
  const frame = root.locator(".of-frame");
  const stage = root.locator(".of-stage");
  const fullscreenHost = page.locator('[data-component="HomeBrowserHub"] [data-browser-fullscreen]');
  const nativeFullscreen = await page.evaluate(() => document.fullscreenElement !== null);
  if (!isMobile) {
    const initial = await stage.boundingBox();
    expect(Math.abs(initial!.width / initial!.height - 9 / 16)).toBeLessThan(0.01);
  }
  await root.getByRole("button", { name: "Enter fullscreen", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(fullscreenHost).toBeVisible();
  await expect(root.getByRole("button", { name: "Exit fullscreen", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("fullscreen-story.png") });
  const fillsFrame = async () => {
    await expect
      .poll(async () => {
        const [outer, inner] = await Promise.all([frame.boundingBox(), stage.boundingBox()]);
        return Math.max(
          Math.abs(inner!.x - outer!.x),
          Math.abs(inner!.y - outer!.y),
          Math.abs(inner!.width - outer!.width),
          Math.abs(inner!.height - outer!.height),
        );
      })
      .toBeLessThanOrEqual(1);
  };
  await fillsFrame();
  for (const [index, size] of sizes.entries()) {
    await page.setViewportSize(size);
    const look = index === 0 ? "midnight" : "pearl";
    await page.emulateMedia({ colorScheme: index === 0 ? "dark" : "light" });
    await expect(root).toHaveAttribute("data-look", look);
    for (const screen of ["Wish", "Wardrobe", "Album", "Dates", "Story"]) {
      await root
        .getByRole("navigation", { name: "Game menu" })
        .getByRole("button", { name: screen, exact: true })
        .click();
      await expect(root.getByRole("heading", { name: screen, exact: true, level: 1 })).toBeVisible();
      await expect(root.getByRole("alert")).toHaveCount(0);
      await fillsFrame();
      if (screen === "Wish")
        await page.screenshot({ path: testInfo.outputPath(`fullscreen-wish-${size.width}-${look}.png`) });
    }
    await root.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(root.getByRole("heading", { name: "Settings", exact: true, level: 1 })).toBeVisible();
    await fillsFrame();
    await root.getByRole("button", { name: "Back", exact: true }).click();
    await expect(root.getByRole("heading", { name: "Story", exact: true, level: 1 })).toBeVisible();
    await expect(root.getByRole("button", { name: "Exit fullscreen", exact: true })).toBeVisible();
    await fillsFrame();
    await root.getByRole("button", { name: "Home with Ilvar Thorne", exact: true }).click();
    await expect(root.getByRole("heading", { name: "Ilvar Thorne", exact: true, level: 1 })).toBeVisible();
    await expect(root.getByRole("article", { name: "A note from Ilvar Thorne", exact: true })).toContainText(
      "Come inside.",
    );
    await fillsFrame();
    if (index === 1) {
      await root.getByRole("button", { name: "Who’s home", exact: true }).click();
      await page
        .getByRole("dialog", { name: "Who’s home", exact: true })
        .getByRole("button", { name: "Your cast", exact: true })
        .click();
      await expect(root.getByRole("heading", { name: "Your story is ready", exact: true })).toBeVisible();
      await fillsFrame();
      await page.screenshot({ path: testInfo.outputPath(`fullscreen-cast-${size.width}-${look}.png`) });
      await root.getByRole("button", { name: "Back", exact: true }).click();
      await expect(root.getByRole("heading", { name: "Ilvar Thorne", exact: true, level: 1 })).toBeVisible();
      await expect(root.getByRole("article", { name: "A note from Ilvar Thorne", exact: true })).toContainText(
        "Come inside.",
      );
    }
    await root
      .getByRole("navigation", { name: "Game menu" })
      .getByRole("button", { name: "Story", exact: true })
      .click();
  }
  await page.setViewportSize(sizes[0]!);
  await root.getByRole("button", { name: "Exit fullscreen", exact: true }).click();
  await expect(fullscreenHost).toHaveCount(0);
  if (!isMobile) {
    const [outer, inner] = await Promise.all([frame.boundingBox(), stage.boundingBox()]);
    expect(inner!.width).toBeLessThan(outer!.width);
    expect(Math.abs(inner!.width / inner!.height - 9 / 16)).toBeLessThan(0.01);
  }
  await root.getByRole("button", { name: "Enter fullscreen", exact: true }).click();
  await root.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(displayedLine(root)).toHaveText("Rain needles the glass dome.");
  const readerLine = await displayedLine(root).innerText();
  await fillsFrame();
  await root.getByRole("button", { name: "Exit fullscreen", exact: true }).click();
  await expect(displayedLine(root)).toHaveText(readerLine);
  await root.getByRole("button", { name: "Enter fullscreen", exact: true }).click();
  await expect(displayedLine(root)).toHaveText(readerLine);
  await fillsFrame();
  expect(JSON.stringify(fixture.view)).toBe(original);
  expect(await page.evaluate(() => document.fullscreenElement !== null)).toBe(nativeFullscreen);
  expect(
    calls.filter((call) => call.method === "POST" && /\/art\/|\/wish\/pull|\/api\/audio\/generate/u.test(call.path)),
  ).toEqual([]);
});

test("Otome Hearth fullscreen preserves setup drafts and native browser state", async ({
  page,
  isMobile,
}, testInfo) => {
  await page.setViewportSize({ width: isMobile ? 390 : 1440, height: isMobile ? 844 : 900 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  const calls: Call[] = [];
  const fixture = createSceneStub({ images: false, audio: false });
  await stubRoutes(
    page,
    (call) =>
      call.path === "/api/otome-forge/index" || call.path === "/api/otome-forge/index/opened"
        ? { status: 200, json: { index: { ...index(), runs: [], activeRun: null } } }
        : fixture.answer(call),
    calls,
  );
  const root = await openOtome(page);
  await root.getByRole("button", { name: "Begin a new story", exact: true }).click();
  const premise = root.getByRole("textbox", { name: "Premise", exact: true });
  const text = "An adult cartographer follows a map through a city of clockwork canals.";
  await premise.fill(text);
  const draft = () => page.evaluate(() => localStorage.getItem("otome-forge:setup-draft:v1"));
  await expect.poll(draft).toContain(text);
  const before = await draft();
  const nativeFullscreen = await page.evaluate(() => document.fullscreenElement !== null);
  await root.getByRole("button", { name: "Enter fullscreen", exact: true }).click();
  await expect(root.getByRole("button", { name: "Exit fullscreen", exact: true })).toBeVisible();
  await expect(premise).toHaveValue(text);
  expect(await draft()).toBe(before);
  await page.screenshot({ path: testInfo.outputPath("fullscreen-setup-draft-pearl.png") });
  await root.getByRole("button", { name: "Exit fullscreen", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(premise).toHaveValue(text);
  expect(await draft()).toBe(before);
  expect(await page.evaluate(() => document.fullscreenElement !== null)).toBe(nativeFullscreen);
  expect(calls.filter((call) => call.method === "POST" && !call.path.endsWith("/index/opened"))).toEqual([]);
});
