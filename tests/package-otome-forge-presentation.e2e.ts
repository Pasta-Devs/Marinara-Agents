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

type Answer = { status: number; json?: unknown; body?: Buffer; contentType?: string; delay?: number };

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
    if (reply.delay) await new Promise((done) => setTimeout(done, reply.delay));
    if (reply.body) await route.fulfill({ status: reply.status, body: reply.body, contentType: reply.contentType });
    else await route.fulfill({ status: reply.status, json: reply.json });
  };
  for (const pattern of ["**/api/otome-forge/**", "**/api/tts/**", "**/api/audio/**", "**/api/game-assets/**"]) {
    await page.route(pattern, handle);
  }
}

/** `reviewPrompts`: the Engine's "Review image prompts before sending" is on. */
async function openOtome(page: Page, { reviewPrompts = false }: { reviewPrompts?: boolean } = {}): Promise<Locator> {
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

async function setReaderControlsExpanded(root: Locator, expanded = true) {
  const more = root.getByRole("button", { name: "More reader controls" });
  if ((await more.isVisible()) && (await more.getAttribute("aria-expanded")) !== String(expanded)) await more.click();
}

/** The cues music was generated for, in order of their names; a cue made twice shows twice. */
const generatedCues = (calls: Call[]) =>
  posts(calls, "/api/audio/generate")
    .map((call) => /-([a-z]+)$/u.exec(call.body!.context.key)?.[1] ?? "")
    .sort();

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
}: { ask?: boolean; images?: boolean; audio?: boolean | Json } = {}) {
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
  const ROUNDS: Json[] = [
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
  const ENDING = {
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
    kind: "confrontation",
    li: ILVAR,
    places: [],
    musicMood: "angst",
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
      { i: 1, kind: "confrontation" },
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
      await root.locator(".of-reader-stage").click({ position: { x: 20, y: 20 } });
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
  const { answer } = createSceneStub();
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
