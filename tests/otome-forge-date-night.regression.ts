// Otome Forge's dates (M5; #2303, won from Wish and played with whoever the player takes): a date of three scenes is
// one plan call and three beats (4 model calls); each date beat has one choice scored by option index, the scores
// never reach the client before the date ends, and a date never ends on a big choice; the outcome follows the total of
// the first-play picks; every outcome pays within the day's caps, once (a replay pays nothing); a date is written once
// per love interest: the same company again is refused, and a company with someone new writes a new playthrough whose
// affection is split among its first-timers; a date taken with several has them in every scene, is scored for them
// together and is remembered by each of them; a pulled date goes to its item's place with its item's scenes, and a 5★
// date's scene before its last holds its key image; a Date Night evening saved before #2303 still plays, mends a
// rupture on a good or great outcome when it was Make it right, and pays; a pulled date is never Make it right; a date
// is its love interest's own memory (a `character-story` source, titled private) that another love interest's prompts
// never see beyond the overview; P26 and the date's scenes see the state as its love interest may know it (M3's
// ownView); starting twice plans once; and the keepsake paints only on request, once, through the image client.
// #2128: a gift from the Shop is spent once, by the write that saves a new date (never by a resumed one, a refused one
// or a failed plan), refused before anything is asked of the model when she has none (or for the aphrodisiac under
// SFW Heat), given in the date's first scene as P26 plans it and each scene's own task says, never written on the
// relationship ledger (where Home, Read Him and Read Me would read it), and pays its own affection once, uncapped; a
// date without one keeps every prompt as it was.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { CapabilityLanguageModelMessage } from "@marinara-engine/shared";
import { forgeKnowledgeBoundary } from "@forge-kit/story-memory-integration.mjs";
import { forgeDayKey } from "@forge-kit/time-zone-server.mjs";
import type {
  ChapterNode,
  Grievance,
  LiState,
  RunState,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import {
  defaultContent,
  type ContentSettings,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/content.ts";
import {
  dateOutcome,
  type DatePlan,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/dates.ts";
import { ACTIVITY_STARLIGHT_DAILY_CAP } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/economy.ts";
import type { GiftId } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/shop.ts";
import type { Item } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/wish.ts";
import type {
  ImageClient,
  PortraitRequest,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/image-client.ts";
import type {
  OtomeReply,
  RouteDeps,
  RouteHandler,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/http.ts";
import {
  chapterId,
  itemId,
  playerId,
  runDocTarget,
  stateId,
  unitId,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { placeKey } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/places.ts";
import {
  beatMessages,
  datePlanMessages,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/prompts.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import { normalizeItem } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/wish.ts";
import { registerClawRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/claw.ts";
import { registerDateRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/dates.ts";
import { registerStoryRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/story.ts";
import {
  defaultLiState,
  normalizeState,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizeChapter } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import {
  effectsOf,
  normalizeBeatReply,
  scoresOf,
  type BeatContext,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/beats.ts";
import {
  readStorySources,
  recallText,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/canon.ts";
import type { BeatReply } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/replies.ts";
import {
  CAST,
  HE,
  KAI,
  MIR,
  MIREILLE_ONLY,
  SHE,
  SOL,
  at,
  bible,
  json,
  storyWorld,
  withMireillesPrivateRows,
} from "./fixtures/otome-forge-story.ts";

// #2066: a story prompt opens with the shared story context, then its own instructions: both are system messages.
const system = (messages: CapabilityLanguageModelMessage[]) =>
  messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
const isDatePlanner = (messages: CapabilityLanguageModelMessage[]) => /You plan one DATE/.test(system(messages));
const nodeOf = (messages: CapabilityLanguageModelMessage[]) =>
  Number(/Narrate node (\d+) of/.exec(messages.at(-1)!.content)?.[1] ?? 1) - 1;

function datePlan(changes: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: "Jellyfish Hour",
    place: "The Lantern Aquarium",
    tags: [],
    goesWrong: false,
    beats: [
      { guide: "They slip in after closing; Kai pretends not to know the night guard." },
      { guide: "At the great tank Kai wants to talk about anything but the north light." },
      { guide: "Walking out, Kai decides how much of tonight to keep." },
    ],
    keepsake: { brief: "The two of them in silhouette before the jellyfish tank, blue light, from behind." },
    ...changes,
  };
}

/** A date beat: three lines and one choice whose options score 1, 0 and −1 (option-1, -2, -3). */
function dateBeat(node: number, changes: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    musicMood: "date",
    places: [{ name: "The Lantern Aquarium", tags: "aquarium, blue light, no humans" }],
    segments: [
      { speaker: "", text: `Scene ${node + 1}: the tanks glow.`, place: "The Lantern Aquarium" },
      { speaker: "Kai", text: `Line ${node + 1} from Kai.`, expression: "tender" },
      { speaker: "Ines", text: "I'm glad we came." },
    ],
    choices: [
      {
        kind: "small",
        at: 1,
        options: [
          {
            text: "Ask about the old harbour maps",
            selection: { kind: "dialogue", text: "Show me where the old harbour was." },
            segments: [{ speaker: "Kai", text: `It never goes out (${node + 1}).` }],
            score: 1,
          },
          {
            text: "Talk about the weather",
            selection: { kind: "dialogue", text: "Cold tonight." },
            segments: [{ speaker: "Kai", text: "Hm." }],
            score: 0,
          },
          {
            text: "Pity him",
            selection: { kind: "dialogue", text: "You must be so lonely." },
            segments: [{ speaker: "Kai", text: "Don't." }],
            score: -1,
          },
        ],
      },
    ],
    ...changes,
  };
}

/** Answers every call: the date plan for P26, `beat(node)` for the narrator. */
function router(
  plan: () => Record<string, unknown> = () => datePlan(),
  beat: (node: number) => Record<string, unknown> = (node) => dateBeat(node),
) {
  return Array.from(
    { length: 60 },
    () => (messages: CapabilityLanguageModelMessage[]) =>
      json(isDatePlanner(messages) ? plan() : beat(nodeOf(messages))),
  );
}

/** An image client that counts paid calls; `hold` makes the next paint wait, `fail` makes it throw. */
function fakeImages() {
  const paid: PortraitRequest[] = [];
  const deleted: string[] = [];
  const control = { fail: false, hold: null as Promise<void> | null };
  const paint = async (request: PortraitRequest) => {
    paid.push(request);
    if (control.hold) await control.hold;
    if (control.fail) throw new Error("the image provider is down");
    return { url: `/api/global-gallery/file/keepsake-${paid.length}.png`, id: `keepsake${paid.length}` };
  };
  const client: ImageClient = {
    generatePortrait: paint,
    // The keepsake is a scene of the two of them (2026-11-03), painted as a story CG is.
    generateBannerArt: (request) => paint(request as unknown as PortraitRequest),
    async styleProfile() {
      return { styleText: "", positiveTags: "", negativeTags: "" };
    },
    async deleteGalleryImage(id) {
      deleted.push(id);
      return true;
    },
    async characterCard() {
      return null;
    },
    async personaAvatar() {
      return "";
    },
    // Only an outfit's cut-out (the fake cutter's) loads, so a keepsake sends it (0.36.5).
    async cardAvatarImage(path) {
      return path.endsWith(".cut.png") ? { mime: "image/png", base64: "iVBORw0KGgo=" } : null;
    },
  };
  return { client, paid, deleted, control };
}

/** The story, date and play routes on a fake router; `call` answers like Fastify ({status, body}). */
function routes(deps: RouteDeps, runKey: string) {
  const table = new Map<string, RouteHandler>();
  const router = {
    get: (path: string, handler: RouteHandler) => void table.set(`GET ${path}`, handler),
    post: (path: string, handler: RouteHandler) => void table.set(`POST ${path}`, handler),
  };
  registerStoryRoutes(router, deps);
  registerDateRoutes(router, deps);
  registerClawRoutes(router, deps);
  return async (method: "GET" | "POST", path: string, body: object = {}, params: Record<string, string> = {}) => {
    const handler = table.get(`${method} ${path}`);
    assert.ok(handler, `${method} ${path} is registered`);
    let status = 200;
    let payload: unknown;
    const reply: OtomeReply = {
      status(code) {
        status = code;
        return reply;
      },
      send(value) {
        payload = value;
        return reply;
      },
    };
    const fields = { timeZone: "UTC", debugMode: true };
    const result = await handler(
      {
        method,
        url: path,
        body: method === "POST" ? { ...fields, ...body } : undefined,
        params: { run: runKey, ...params },
        query: method === "GET" ? { ...fields, ...body } : {},
      },
      reply,
    );
    return { status, body: (result === reply ? payload : result) as Record<string, any> };
  };
}

async function dateWorld(
  runKey: string,
  {
    lis = {},
    plan,
    beat,
    images = false,
    content,
  }: {
    lis?: Record<string, Partial<LiState>>;
    plan?: () => Record<string, unknown>;
    beat?: (node: number) => Record<string, unknown>;
    images?: boolean;
    content?: ContentSettings;
  } = {},
) {
  const t = await storyWorld({
    runKey,
    lis,
    replies: router(plan, beat),
    cancellation: true,
    ...(content ? { content } : {}),
  });
  await t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    identityLine: "tall man, salt-white hair, grey eyes",
    outfitLine: "dark keeper's coat",
    bible: {
      ...unit.bible!,
      likes: ["old harbour maps", "quiet company"],
      dislikes: ["being pitied"],
      look: { ...unit.bible!.look, presentation: "man" },
    },
  }));
  if (images) {
    await t.store.mutateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
      ...world,
      images: { ...world.images, connectionId: "conn-image" },
    }));
  }
  const art = fakeImages();
  // A free cut-out as the Engine's sprite cleanup makes it: a keepsake sends each person's outfit cut out (0.36.5).
  const cutouts: CutoutClient = {
    cutOut: async (url) => ({ url: `${url}.cut.png`, id: `cut-${url}` }),
    deleteGalleryImage: async () => true,
  };
  const deps: RouteDeps = { ...t.deps, images: art.client, cutouts };
  // #2303: a date won from Wish, owned: three scenes at the aquarium, as Date Night's evenings were.
  await giveDate(t, DATE_ITEM);
  return { ...t, deps, art, call: routes(deps, runKey) };
}

type DateWorld = Awaited<ReturnType<typeof dateWorld>>;

/** The Dates banner's first 4★, won: three scenes at the aquarium. */
const DATE_ITEM = "dates-0-a3";

/** Writes a date won from Wish and owns it: a 4★ place by default, `changes` for a 5★ scenario or more scenes. */
async function giveDate(
  t: { store: Awaited<ReturnType<typeof storyWorld>>["store"]; runId: string },
  id: string,
  changes: Partial<Item> = {},
) {
  const item: Item = {
    id,
    kind: "date4",
    banner: id.replace(/-(?:f|a[1-3])$/, ""),
    li: null,
    title: "Jellyfish Hour",
    premise: "An evening at the night aquarium after closing, among the jellyfish.",
    place: { name: "The Lantern Aquarium", tags: "night aquarium, blue light, jellyfish, no people" },
    scenes: 3,
    art: null,
    story: null,
    createdAt: at,
    ...changes,
  };
  await t.store.mutateDoc(runDocTarget("item", itemId(t.runId, id)), normalizeItem, () => item);
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    owned: { ...state.owned, items: [...new Set([...state.owned.items, id])] },
  }));
  return item;
}

const START = { item: DATE_ITEM, cast: [KAI], herLook: "base" };
const beatPath = "/runs/:run/chapters/:key/beats/:i";

async function startDate(t: DateWorld, body: Record<string, unknown> = START) {
  const started = await t.call("POST", "/runs/:run/dates/pulled", body);
  assert.equal(started.status, 200, JSON.stringify(started.body));
  return started.body;
}

/** Reads the date's beats in order from `from`, picking `option-<pick>` in each, then lets the lookahead settle. */
async function playDate(t: DateWorld, key: string, picks: number[], from = 0) {
  for (const [index, pick] of picks.entries()) {
    const params = { key, i: String(from + index) };
    const served = await t.call("POST", beatPath, {}, params);
    assert.equal(served.status, 200, JSON.stringify(served.body));
    assert.equal("scores" in served.body.beat, false, "a date beat's scores never reach the client");
    assert.equal(JSON.stringify(served.body).includes('"score"'), false);
    const chosen = await t.call("POST", `${beatPath}/choose`, { choice: "choice-1", option: `option-${pick}` }, params);
    assert.equal(chosen.status, 200, JSON.stringify(chosen.body));
    assert.equal(JSON.stringify(chosen.body).includes('"score"'), false);
    const read = await t.call("POST", `${beatPath}/read`, { segment: 99 }, params);
    assert.equal(read.status, 200, JSON.stringify(read.body));
    // A date's beats pay nothing on their own: the date pays once, when it is finished.
    assert.deepEqual(read.body.grants, []);
  }
  await t.settle();
}

const finish = (t: DateWorld, key: string) => t.call("POST", "/runs/:run/dates/:key/finish", {}, { key });

/**
 * A rupture the protagonist holds (from before #2156): Make it right dates are hers alone now, since one he holds keeps
 * every date with him waiting.
 */
const rupture = (): Partial<LiState> => {
  const grievance: Grievance = {
    id: "g-main-1-4-0",
    li: KAI,
    by: "protagonist",
    text: "She read the letters he burned.",
    severity: "rupture",
    opened: "main-1/4",
    status: "open",
  };
  return { grievances: [grievance], rupture: { grievanceId: grievance.id, since: at } };
};

// ── Scoring ──

const context = (date?: { goesWrong: boolean }, last = false): BeatContext => ({
  node: { i: 0, kind: "beat", guide: "", cast: [KAI] },
  units: [{ id: KAI, name: "Kai" }],
  state: normalizeState({ lis: { [KAI]: {} } }),
  last,
  ...(date ? { date } : {}),
});

test("a date beat's scores are read by option index, and its choice follows the date's rules", () => {
  const reply = dateBeat(0) as unknown as BeatReply;
  const beat = normalizeBeatReply(reply, context({ goesWrong: false }));
  assert.ok(typeof beat !== "string", String(beat));
  assert.deepEqual(scoresOf(reply, beat.choices), { "choice-1": { "option-1": 1, "option-2": 0, "option-3": -1 } });
  // A score written as text still reads; one out of range makes the reply go back for its repair turn.
  const texty = dateBeat(0) as any;
  texty.choices[0].options[0].score = "1";
  const read = normalizeBeatReply(texty, context({ goesWrong: false }));
  assert.ok(typeof read !== "string");
  assert.equal(scoresOf(texty, read.choices)["choice-1"]!["option-1"], 1);

  const refused = (changes: (raw: any) => void, last = false) => {
    const raw = dateBeat(0) as any;
    changes(raw);
    return normalizeBeatReply(raw, context({ goesWrong: false }, last));
  };
  assert.match(String(refused((raw) => delete raw.choices)), /exactly ONE small choice/);
  assert.match(
    String(refused((raw) => raw.choices.push({ ...structuredClone(raw.choices[0]), at: 2 }))),
    /exactly ONE small choice/,
  );
  assert.match(String(refused((raw) => delete raw.choices[0].options[1].score)), /needs a "score"/);
  assert.match(String(refused((raw) => (raw.choices[0].options[2].score = 2))), /needs a "score"/);
  assert.match(String(refused((raw) => (raw.choices[0].options[0].score = 0))), /must score 1/);
  // A date's last scene never ends on a big choice (the kit's terminal is off for dates).
  const big = refused((raw) => {
    raw.choices = [
      {
        kind: "big",
        at: 2,
        options: [
          { text: "Stay", selection: { kind: "action", text: "You stay." }, segments: [], score: 1 },
          { text: "Go", selection: { kind: "action", text: "You go." }, segments: [], score: 0 },
        ],
      },
    ];
  }, true);
  assert.equal(typeof big, "string");
  // Outside a date nothing of this applies: no choice at all is fine.
  const plain = dateBeat(0) as any;
  delete plain.choices;
  assert.notEqual(typeof normalizeBeatReply(plain, context()), "string");
});

test("a date opens a grievance only when it was planned to go wrong, and then only a minor one", () => {
  const reply = dateBeat(0) as any;
  reply.choices[0].options[2].effects = [
    { li: KAI, trust: -1, grievance: { by: "li", text: "She pitied him.", severity: "rupture" } },
  ];
  for (const [date, expected] of [
    [{ goesWrong: false }, undefined],
    [{ goesWrong: true }, "minor"],
    [undefined, "rupture"],
  ] as const) {
    const beat = normalizeBeatReply(reply, context(date));
    assert.ok(typeof beat !== "string");
    const effect = effectsOf(reply, beat.choices, context(date))["choice-1"]!["option-3"]![0]!;
    assert.equal(effect.trust, -1);
    assert.equal(effect.grievance?.severity, expected);
  }
});

test("the outcome follows the total of the picks: 2 or more is great, 0 or 1 good, below 0 awkward", () => {
  assert.deepEqual(
    [3, 2, 1, 0, -1, -3].map((total) => dateOutcome(total)),
    ["great", "great", "good", "good", "awkward", "awkward"],
  );
  // #2303: a won date has 1 to 6 scenes; great takes the same share of its best total, so a one-scene date can be great.
  const lowestGreat = [1, 2, 3, 4, 5, 6].map((scenes) => {
    const great = [-1, 0, 1, 2, 3, 4, 5, 6].find((total) => dateOutcome(total, scenes) === "great")!;
    assert.equal(dateOutcome(great - 1, scenes), great - 1 >= 0 ? "good" : "awkward");
    return great;
  });
  assert.deepEqual(lowestGreat, [1, 2, 2, 3, 4, 4]);
  assert.equal(dateOutcome(-1, 1), "awkward");
});

// ── A whole date ──

test("a date is 4 model calls, pays once whatever the outcome, and keeps its answers until it ends", async () => {
  const t = await dateWorld("r-mg5date-aa0001");
  const started = await startDate(t);
  const key = started.date.key;
  assert.equal(key, "date-1");
  assert.equal(started.resumed, false);
  assert.equal(started.date.state, "reading");
  // The chapter view carries no plan (no guides, no goesWrong, no keepsake brief) and no scores.
  assert.equal(started.chapter.kind, "date");
  assert.equal("date" in started.chapter, false);
  assert.equal(JSON.stringify(started).includes("goesWrong"), false);
  assert.equal(JSON.stringify(started).includes("silhouette"), false);
  assert.equal(JSON.stringify(started).includes("pretends not to know"), false);
  assert.equal(started.date.placeName, "The Lantern Aquarium");

  // P26 carries the planner contract, the boundary, the full bible and the place's spirit.
  const plan = t.calls[0]!.messages;
  assert.ok(system(plan).includes("CONTENT CONTRACT"));
  assert.ok(system(plan).includes(forgeKnowledgeBoundary));
  assert.ok(plan.at(-1)!.content.includes("night aquarium"));
  assert.ok(plan.at(-1)!.content.includes("old harbour maps"));
  assert.equal(plan.at(-1)!.content.includes("MAKE IT RIGHT"), false);

  // Finishing before the last scene is read is refused, and counts nothing.
  assert.equal((await finish(t, key)).status, 409);

  await playDate(t, key, [1, 1, 2]);
  // One plan and three beats (the lookahead wrote each next beat once).
  assert.equal(t.calls.length, 4);
  const beatPrompt = t.calls[1]!.messages;
  // A date's own choice rules go with the node's task (#2066).
  assert.ok(beatPrompt.at(-1)!.content.includes("DATE CHOICE"));
  assert.ok(beatPrompt.at(-1)!.content.includes("old harbour maps"));
  assert.ok(beatPrompt.at(-1)!.content.includes("being pitied"));
  assert.ok(beatPrompt.at(-1)!.content.includes("This chapter is a DATE"));
  // The last scene is never offered a big choice.
  const lastPrompt = t.calls.find((call) => nodeOf(call.messages) === 2 && !isDatePlanner(call.messages))!;
  assert.equal(
    lastPrompt.messages.some((message) => message.content.includes("This is the LAST story beat")),
    false,
  );
  assert.equal(system(lastPrompt.messages).includes("This is the chapter's last node"), false, "nor #1949's rule");

  // The date is not in the story's chapter list.
  const story = await t.call("GET", "/runs/:run/story");
  assert.equal(
    story.body.chapters.some((entry: { key: string }) => entry.key === key),
    false,
  );

  const before = (await t.state()).wallet.starlight;
  const done = await finish(t, key);
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.equal(done.body.outcome, "great");
  assert.deepEqual(
    done.body.picks.map((pick: { score: number }) => pick.score),
    [1, 1, 0],
  );
  assert.equal(done.body.picks[0].text, "Ask about the old harbour maps.");
  assert.equal(done.body.line, "Hm.");
  assert.deepEqual(done.body.grants, [
    { source: "date", starlight: 120 },
    { source: "date", li: KAI, affection: 100 },
  ]);
  assert.equal(done.body.counted, true);
  assert.equal(done.body.starlight, before + 120);
  assert.equal(done.body.date.state, "finished");
  assert.equal(done.body.keepsake.offer, false, "no keepsake is offered without an image connection");
  const state = await t.state();
  assert.equal(state.lis[KAI]!.points, 100);
  assert.equal(state.timeline.filter((entry) => entry.kind === "first-date").length, 1);
  assert.ok(state.lis[KAI]!.firsts.date);

  // A replay (a lost response, a second tap) answers the same outcome and pays nothing more.
  const again = await finish(t, key);
  assert.equal(again.status, 200);
  assert.equal(again.body.outcome, "great");
  assert.deepEqual(again.body.grants, []);
  assert.equal(again.body.counted, false);
  assert.equal((await t.state()).wallet.starlight, before + 120);
  assert.equal((await t.state()).lis[KAI]!.points, 100);

  const view = await t.call("GET", "/runs/:run/dates");
  assert.equal(view.body.dates.length, 1);
  assert.equal(view.body.dates[0].outcome, "great");
  assert.deepEqual(view.body.open, []);

  // #2303: Kai has been on this date, so it only replays for him: the same company again is refused before any call.
  const played = await t.call("POST", "/runs/:run/dates/pulled", START);
  assert.deepEqual([played.status, played.body.code], [409, "conflict"]);
  assert.equal(t.calls.length, 4);
  // Another date won is a new chapter; the first date is on the timeline once.
  await giveDate(t, "dates-0-a2", { title: "Lantern Walk" });
  const second = await startDate(t, { ...START, item: "dates-0-a2" });
  assert.equal(second.date.key, "date-2");
  await playDate(t, "date-2", [3, 3, 3]);
  const awkward = await finish(t, "date-2");
  assert.equal(awkward.body.outcome, "awkward");
  // An awkward evening still pays (failure pays; caps limit rewards, never play).
  assert.equal(awkward.body.grants.length, 2);
  assert.equal((await t.state()).timeline.filter((entry) => entry.kind === "first-date").length, 1);
});

test("#2303: a date taken with several has them all in every scene, scores for them together, and pays its first-timers", async () => {
  // No level gate: whoever she has met may come, from affection level 1.
  const t = await dateWorld("r-dategrp-aaaaaa");
  const started = await startDate(t, { ...START, cast: [KAI, MIR] });
  assert.deepEqual([started.date.li, started.date.cast, started.date.item], [KAI, [KAI, MIR], DATE_ITEM]);
  const stored = (await t.store.readDoc(`${t.runId}:chapter:${started.date.key}`, normalizeChapter))!;
  assert.deepEqual(
    stored.nodes.map((node: ChapterNode) => node.cast),
    [
      [KAI, MIR],
      [KAI, MIR],
      [KAI, MIR],
    ],
  );
  assert.deepEqual([stored.date!.newcomers, stored.title], [[KAI, MIR], "Jellyfish Hour"]);
  const plan = t.calls[0]!.messages;
  assert.ok(system(plan).includes("time the protagonist spends with Kai and Mireille, all of them love interests"));
  const all = plan.map((message) => message.content).join("\n");
  // The Heat is the content contract's alone: no softer rule for a date with several.
  assert.ok(all.includes("it may turn intimate between them, as far as the content contract's Heat allows"));
  assert.equal(all.includes("non-sexual"), false);
  // The stumble's conflict is the lead's, and the keepsake stages the three people it draws.
  assert.ok(all.includes("the conflict the stumble plants for Kai (it becomes Kai's, whoever else it touches)"));
  assert.ok(
    all.includes("what the protagonist, Kai and Mireille are doing), never anyone's looks. It shows only those three."),
  );
  assert.ok(
    plan.at(-1)!.content.includes('THE DATE (won from Wish; plan it as written)\n"Jellyfish Hour": An evening'),
  );
  assert.ok(plan.at(-1)!.content.includes("Plan the date with Kai (id"), "both are named with their ids");
  await playDate(t, started.date.key, [1, 1, 2]);
  const scene = t.calls[1]!.messages.at(-1)!.content;
  assert.ok(scene.includes("time the protagonist spends with Kai and Mireille together"));
  assert.ok(scene.includes("DATE CHOICE (this node is one scene of a date with Kai and Mireille)"));
  assert.ok(scene.includes("1 when the group would love it as a whole"));

  const done = await finish(t, started.date.key);
  assert.equal(done.status, 200, JSON.stringify(done.body));
  // 100 affection split evenly between the first-timers, each paid on its own; the Starlight is the date's, once.
  const affection = (grants: Array<{ li?: string; affection?: number }>) =>
    grants.filter((grant) => grant.affection).map((grant) => [grant.li, grant.affection]);
  assert.deepEqual(affection(done.body.grants), [
    [KAI, 50],
    [MIR, 50],
  ]);
  assert.deepEqual(
    done.body.grants.filter((grant: { starlight?: number }) => grant.starlight),
    [{ source: "date", starlight: 120 }],
  );
  // Both remember it, the first named as its owner and the other as there too.
  const source = (await readStorySources(t.store, t.runId, await t.state(), "Ines")).find(
    (item) => item.id === started.date.key,
  )!;
  assert.deepEqual(source.audience, [KAI, MIR]);
  assert.match(source.title, /Mireille also appears in it/);

  // With someone new (Sol) a new playthrough is written; only Sol is new to it, so the affection is Sol's alone.
  const third = await startDate(t, { ...START, cast: [KAI, SOL] });
  assert.equal(third.resumed, false);
  await playDate(t, third.date.key, [1, 1, 1]);
  assert.deepEqual(affection((await finish(t, third.date.key)).body.grants), [[SOL, 100]]);
  const view = (await t.call("GET", "/runs/:run/dates")).body;
  const won = view.pulled.find((entry: { item: { id: string } }) => entry.item.id === DATE_ITEM);
  assert.deepEqual([[...won.playedBy].sort(), won.plays.length], [[KAI, MIR, SOL].sort(), 2]);
  // Everyone has been on it: any company only replays it.
  const replay = await t.call("POST", "/runs/:run/dates/pulled", { ...START, cast: [SOL, MIR] });
  assert.deepEqual([replay.status, replay.body.code], [409, "conflict"]);
});

test("the day's caps limit what a date pays, never whether it is played and counted", async () => {
  const t = await dateWorld("r-mg5date-aa0002");
  await t.store.mutateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    // 50 short of the day's activity Starlight: the date pays only that.
    daily: { dayKey: forgeDayKey(Date.now()), starlight: ACTIVITY_STARLIGHT_DAILY_CAP - 50, affection: { [KAI]: 300 } },
  }));
  const { date } = await startDate(t);
  await playDate(t, date.key, [2, 2, 2]);
  const done = await finish(t, date.key);
  assert.equal(done.body.outcome, "good");
  assert.equal(done.body.counted, true);
  assert.deepEqual(done.body.grants, [{ source: "date", starlight: 50 }]);
  assert.equal(done.body.date.state, "finished");
});

test("a date is planned with the Story connection, even when the story has its own Planning connection", async () => {
  // The maintainer's, 2026-11-05: dates, banner scenes and Character Stories are written with the Story connection.
  const t = await dateWorld("r-mg5date-story1");
  await t.store.mutateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
    ...world,
    connections: { ...world.connections, narration: "conn-story", structured: "conn-plan" },
  }));
  await startDate(t);
  const plans = t.calls.filter((call) => isDatePlanner(call.messages));
  assert.equal(plans.length, 1);
  assert.equal(plans[0]!.connectionId, "conn-story");
  assert.equal(
    t.calls.some((call) => call.connectionId === "conn-plan"),
    false,
    "nothing of the date on Planning",
  );
});

test("starting twice plans one date, and an open date is resumed rather than planned again", async () => {
  const t = await dateWorld("r-mg5date-aa0003");
  const [one, two] = await Promise.all([
    t.call("POST", "/runs/:run/dates/pulled", START),
    t.call("POST", "/runs/:run/dates/pulled", START),
  ]);
  assert.equal(one.status, 200, JSON.stringify(one.body));
  assert.equal(two.status, 200, JSON.stringify(two.body));
  assert.equal(one.body.date.key, two.body.date.key);
  assert.deepEqual([one.body.resumed, two.body.resumed].sort(), [false, true]);
  assert.equal(t.calls.length, 1);
  const later = await startDate(t);
  assert.equal(later.resumed, true);
  assert.equal(t.calls.length, 1);
  const view = await t.call("GET", "/runs/:run/dates");
  assert.deepEqual(
    view.body.open.map((entry: { key: string }) => entry.key),
    ["date-1"],
  );

  for (const [body, status] of [
    [{ ...START, item: "dates-0-a1" }, 404],
    [{ ...START, item: "memories-0-f" }, 404],
    [{ ...START, cast: [] }, 400],
    [{ ...START, cast: [KAI, KAI] }, 400],
    [{ ...START, cast: ["li-nobody-zz99"] }, 404],
    [{ ...START, herLook: "gown" }, 404],
  ] as const) {
    assert.equal((await t.call("POST", "/runs/:run/dates/pulled", body)).status, status, JSON.stringify(body));
  }
  assert.equal((await finish(t, "date-9")).status, 404);
  assert.equal((await finish(t, "main-1")).status, 404);
});

test("a date wears the owned looks picked for it, a 4★ included, and its plan and keepsake dress them in it", async () => {
  const t = await dateWorld("r-datelook-aaaaaa", { images: true });
  const look = (id: string, kind: Item["kind"], li: string, name: string, outfitLine: string): Item => ({
    id,
    kind,
    banner: id.replace(/-(?:f|a[1-3])$/, ""),
    li,
    title: name,
    look: { name, outfitLine },
    art: { state: "ready", at, url: `/api/global-gallery/file/${id}.png`, ref: id },
    story: null,
    createdAt: at,
  });
  const his = look("his-wardrobe-0-a1", "his-look4", KAI, "Harbour Night", "HIS-LOOK: navy greatcoat, brass buttons");
  const hers = look("my-wardrobe-0-a2", "her-look4", KAI, "Lantern Dress", "HER-LOOK: amber silk dress");
  const unowned = look("his-wardrobe-0-a2", "his-look4", KAI, "Pier Shirt", "linen shirt");
  for (const value of [his, hers, unowned]) {
    await t.store.mutateDoc(runDocTarget("item", itemId(t.runId, value.id)), normalizeItem, () => value);
  }
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    owned: { ...state.owned, items: [DATE_ITEM, his.id, hers.id] },
  }));
  // A look of someone else's is refused before anything is planned.
  assert.equal((await t.call("POST", "/runs/:run/dates/pulled", { ...START, herLook: his.id })).status, 400);
  assert.equal(t.calls.length, 0, "no plan for a refused look");
  // #2303: she picks her look; he comes in the look he wears at home.
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    outfits: [
      { id: his.id, name: his.look!.name, outfitLine: his.look!.outfitLine, url: his.art!.url!, ref: his.id, at },
    ],
    wornOutfit: his.id,
  }));
  await startDate(t, { ...START, herLook: hers.id });
  // Worn now, as Wear at home wears them: Home, the faces and every image dress them in it.
  const unit = (await t.store.readDoc(unitId(t.runId, KAI), normalizeUnit))!;
  assert.equal(unit.wornOutfit, his.id);
  const player = (await t.store.readDoc(playerId(t.runId), normalizePlayer))!;
  assert.equal(player.wornOutfit, hers.id);
  const plan = t.calls
    .find((call) => isDatePlanner(call.messages))!
    .messages.map((message) => message.content)
    .join("\n");
  // Each look once, in how each of them looks now (the bible's appearanceLine and the protagonist block).
  assert.match(plan, /How Kai looks now [^\n]*; wearing HIS-LOOK: navy greatcoat, brass buttons\.\n/);
  assert.match(plan, /looks now [^\n]*: wearing HER-LOOK: amber silk dress\.\n/);
  for (const look of ["HIS-LOOK", "HER-LOOK"]) assert.equal(plan.split(look).length, 2, `${look} once`);
  // The keepsake draws them in their looks, their pictures and their outfit lines alike.
  await playDate(t, "date-1", [1, 2, 1]);
  assert.equal((await finish(t, "date-1")).status, 200);
  const keepsake = (await t.call("POST", "/runs/:run/art/keepsake/prompt", { key: "date-1" })).body.prompt as string;
  assert.match(keepsake, /Kai: tall man, salt-white hair, grey eyes; HIS-LOOK: navy greatcoat, brass buttons/);
  assert.match(keepsake, /HER-LOOK: amber silk dress/);
  assert.doesNotMatch(keepsake, /dark keeper's coat/, "never his everyday coat over the date look");
  // 0.36.5: each reference is the look they wear, so it dresses them too.
  assert.match(keepsake, /face, hair, build and clothing, never/);
});

/**
 * A Date Night evening saved before #2303 (`date-<n>` with no item), as a story in progress may hold one: not counted
 * yet, its scenes still to read.
 */
async function savedEvening(t: DateWorld, key: string, plan: Partial<DatePlan> = {}) {
  const guides = (datePlan().beats as Array<{ guide: string }>).map((beat) => beat.guide);
  await t.store.mutateDoc(runDocTarget("chapter", chapterId(t.runId, key)), normalizeChapter, () => ({
    key,
    kind: "date",
    li: KAI,
    lead: KAI,
    title: "Jellyfish Hour",
    tags: [],
    summary: "",
    nodes: guides.map((guide, i) => ({
      i,
      kind: "beat" as const,
      guide,
      cast: [KAI],
      ...(i === 0 ? { place: "The Lantern Aquarium" } : {}),
    })),
    ledger: { relationship: [], conflict: [], offscreen: [] },
    plannedAt: at,
    connectionId: "conn-text",
    date: {
      li: KAI,
      place: "aquarium",
      placeName: "The Lantern Aquarium",
      herLook: "base",
      hisLook: "base",
      goesWrong: false,
      makeItRight: null,
      keepsake: { brief: "The two of them in silhouette before the jellyfish tank." },
      ...plan,
    },
  }));
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    chapters: { ...state.chapters, [key]: { beatsRead: 0, completed: null, applied: [] } },
  }));
}

test("#2303: a Make it right evening saved before still plays and mends; a pulled date is never Make it right", async () => {
  for (const [picks, mended] of [
    [[1, 2, 2], true],
    [[3, 3, 2], false],
  ] as const) {
    const t = await dateWorld(`r-mg5date-mir${mended ? "001" : "002"}`, { lis: { [KAI]: rupture() } });
    await savedEvening(t, "date-1", { makeItRight: "g-main-1-4-0" });
    // The Album lists it among the earlier evenings, to go on with.
    const listed = (await t.call("GET", "/runs/:run/dates")).body.open;
    assert.deepEqual(
      listed.map((entry: { key: string; makeItRight: boolean; item?: string }) => [
        entry.key,
        entry.makeItRight,
        entry.item,
      ]),
      [["date-1", true, undefined]],
    );
    await playDate(t, "date-1", [...picks]);
    assert.ok(t.calls[0]!.messages.at(-1)!.content.includes("MAKE IT RIGHT date"));
    // The rupture stands until the date is finished: no scene resolves it in passing.
    assert.ok((await t.state()).lis[KAI]!.rupture);
    const done = await finish(t, "date-1");
    assert.equal(done.status, 200, JSON.stringify(done.body));
    assert.deepEqual([done.body.repaired, done.body.mends], [mended, mended]);
    assert.equal(done.body.grants.length, 2, "it pays as it would have");
    const kai = (await t.state()).lis[KAI]!;
    assert.equal(kai.rupture === null, mended);
    assert.equal(kai.grievances[0]!.status, mended ? "addressed" : "open");
    const replay = await finish(t, "date-1");
    assert.deepEqual([replay.body.repaired, replay.body.mends], [false, mended]);
  }
  // With the rupture standing, a date won from Wish is an ordinary date: nothing of Make it right in its plan.
  const u = await dateWorld("r-mg5date-mir003", { lis: { [KAI]: rupture() } });
  const pulled = await startDate(u);
  assert.equal(pulled.date.makeItRight, false);
  assert.equal(system(u.calls[0]!.messages).includes("MAKE IT RIGHT"), false);
});

test("#2303: dates won and played later never push Date Night's earlier evenings out of the list", async () => {
  const t = await dateWorld("r-mg5date-cap001");
  // One evening from before the update, then 24 playthroughs of won dates, every one of them finished.
  await savedEvening(t, "date-1");
  for (let n = 2; n <= 25; n += 1) await savedEvening(t, `date-${n}`, { item: DATE_ITEM, cast: [KAI] });
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    chapters: Object.fromEntries(
      Object.entries(state.chapters).map(([key, read]) => [key, { ...read, applied: ["3/finish"] }]),
    ),
  }));
  const listed = (await t.call("GET", "/runs/:run/dates")).body.dates as Array<{ key: string; item?: string }>;
  assert.equal(listed.filter((entry) => entry.item).length, 24);
  assert.deepEqual(
    listed.filter((entry) => !entry.item).map((entry) => entry.key),
    ["date-1"],
  );
  assert.equal(listed[0]!.key, "date-25", "newest first");
});

test("#2303: an earlier Date Night double date is remembered by both who went on it, and keeps its keepsake of two", async () => {
  const t = await dateWorld("r-mg5date-dbl001", { images: true });
  await savedEvening(t, "date-1", { second: MIR });
  await playDate(t, "date-1", [1, 1, 1]);
  assert.equal((await finish(t, "date-1")).status, 200);
  const source = (await readStorySources(t.store, t.runId, await t.state(), "Ines")).find(
    (item) => item.id === "date-1",
  )!;
  assert.deepEqual(source.audience, [KAI, MIR]);
  // Its keepsake brief was written for two, so the picture still draws its first love interest with her, as before.
  const keepsake = (await t.call("POST", "/runs/:run/art/keepsake/prompt", { key: "date-1" })).body.prompt as string;
  assert.match(keepsake, /two people, romantic date/);
  assert.match(keepsake, /Kai: /);
  assert.doesNotMatch(keepsake, /Mireille: /);
});

test("a date is his own memory: a Character Story source for its love interest, in no one else's prompt", async () => {
  const t = await dateWorld("r-mg5date-aa0004");
  const { date } = await startDate(t);
  await playDate(t, date.key, [1, 1, 1]);
  await finish(t, date.key);

  const sources = await readStorySources(t.store, t.runId, await t.state(), "Ines");
  const source = sources.find((item) => item.id === date.key);
  assert.ok(source);
  // GF's bond chapter (0.6.17): summarized and folded into the overview, recalled in detail only by its love interest.
  assert.equal(source.kind, "character-story");
  // Private, as M3 titles a love interest's own chapter: a scene with others in it knows nobody else was there.
  assert.equal(
    source.title,
    'Kai\'s own date chapter "Jellyfish Hour" (private: only the people in its scenes know what happened in it)',
  );
  assert.deepEqual(source.audience, [KAI]);
  assert.ok(source.content.includes("Line 1 from Kai."));

  const recall = async (cast: string[]) => (await recallText(t.deps, t.runId, { job: "narration", cast })).text;
  assert.ok((await recall([KAI])).includes("Line 2 from Kai."));
  assert.equal((await recall([MIR])).includes("Line 2 from Kai."), false);
  assert.equal((await recall([])).includes("Line 2 from Kai."), false);

  // Mireille's own date never reads Kai's.
  const calls = t.calls.length;
  await startDate(t, { ...START, cast: [MIR] });
  const plan = t.calls[calls]!.messages;
  assert.equal(
    plan.some((message) => message.content.includes("from Kai.")),
    false,
  );
});

test("a date sees the state as its love interest may know it: nothing another love interest's own chapter left", async () => {
  const t = await dateWorld("r-mg5date-aa0008");
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) =>
    // One the protagonist holds (from before #2156): his own grievance would keep his dates waiting.
    withMireillesPrivateRows(state, { rupture: true, holder: "protagonist" }),
  );
  const { date } = await startDate(t);
  assert.equal(date.makeItRight, false, "#2303: a pulled date is never Make it right");
  await playDate(t, date.key, [1, 1, 1]);
  assert.equal(t.calls.length, 4);
  const text = (index: number) => t.calls[index]!.messages.map((message) => message.content).join("\n");
  for (const [index, prompt] of [text(0), text(1), text(2), text(3)].entries()) {
    assert.deepEqual(
      MIREILLE_ONLY.filter((marker) => prompt.includes(marker)),
      [],
      `${index ? "scene" : "plan"} ${index}: nothing of Mireille's own chapters`,
    );
  }
  // P26 and the scenes see what the shared story left between them, and name the rupture without its grievance.
  for (const marker of ["KAI-MAIN-GRIEVANCE", "KAI-MAIN-DISCLOSURE"]) {
    assert.ok(text(0).includes(marker), `the plan sees ${marker}`);
    assert.ok(text(1).includes(marker), `the scene sees ${marker}`);
  }
  assert.equal(text(0).includes("MAKE IT RIGHT"), false);
  assert.equal(text(1).includes("MAKE IT RIGHT"), false);
});

test("#2303: a pulled date goes to its own place, has its scenes, and a 5★ date's scene before its last holds its key image", async () => {
  const t = await dateWorld("r-mg5date-aa0009", {
    plan: () => datePlan({ place: "Somewhere Else", beats: [1, 2, 3, 4, 5].map((n) => ({ guide: `Guide ${n}.` })) }),
  });
  await giveDate(t, "dates-0-f", {
    kind: "date5",
    title: "Lantern Regatta",
    premise: "The harbour races paper lanterns at dusk, and a gust capsizes theirs before the first buoy.",
    place: { name: "The Regatta Pier", tags: "harbour pier, paper lanterns, dusk, no people" },
    scenes: 5,
  });
  const started = await startDate(t, { ...START, item: "dates-0-f" });
  // The plan named it otherwise; the date keeps its item's place, so its scenes open there.
  assert.equal(started.date.placeName, "The Regatta Pier");
  assert.equal(started.date.title, "Lantern Regatta");
  const plan = t.calls[0]!.messages;
  assert.ok(plan.at(-1)!.content.includes('"The Regatta Pier" (harbour pier, paper lanterns, dusk, no people).'));
  assert.ok(system(plan).includes("writes it later as 5 scenes"));
  assert.ok(system(plan).includes("Scene 4's guide holds the date's most memorable moment"));
  assert.ok(
    system(plan).includes(
      '"beats": [{"guide": "..."}, {"guide": "..."}, {"guide": "..."}, {"guide": "..."}, {"guide": "..."}]',
    ),
  );
  const stored = (await t.store.readDoc(`${t.runId}:chapter:${started.date.key}`, normalizeChapter))!;
  assert.deepEqual(
    stored.nodes.map((node) => [node.place ?? null, node.cg ?? null]),
    [
      ["The Regatta Pier", null],
      [null, null],
      [null, null],
      [null, true],
      [null, null],
    ],
  );
  assert.deepEqual([stored.date!.place, stored.date!.grand], ["pulled", true]);
  // Its item's picture (the Dates banner's art, its place with nobody in it) is the story's place once it is planned, so
  // the first scene opens on it and paints nothing; a 4★ date, which has no picture, leaves the place to its scene.
  const places = async (u: DateWorld) => (await u.store.readDoc(worldId(u.runId), normalizeWorld))!.places;
  assert.equal((await places(t))[placeKey("The Regatta Pier")], undefined, "no picture: nothing is kept");
  const art = { state: "ready" as const, at, url: "/api/global-gallery/file/pier.png", ref: "global-gallery:pier" };
  const w = await dateWorld("r-mg5date-place1", {
    plan: () => datePlan({ beats: [1, 2, 3, 4, 5].map((n) => ({ guide: `G${n}.` })) }),
  });
  await giveDate(w, "dates-0-f", {
    kind: "date5",
    place: { name: "The Regatta Pier", tags: "harbour pier, paper lanterns, dusk, no people" },
    scenes: 5,
    art,
  });
  await startDate(w, { ...START, item: "dates-0-f" });
  assert.deepEqual((await places(w))[placeKey("The Regatta Pier")], {
    name: "The Regatta Pier",
    tags: "harbour pier, paper lanterns, dusk, no people",
    art,
  });
  // A place the story painted itself keeps its own picture.
  const own = { ...art, url: "/api/global-gallery/file/own.png", ref: "global-gallery:own" };
  const x = await dateWorld("r-mg5date-place2", {
    plan: () => datePlan({ beats: [1, 2, 3, 4, 5].map((n) => ({ guide: `G${n}.` })) }),
  });
  await x.store.updateDoc(runDocTarget("world", worldId(x.runId)), normalizeWorld, (world) => ({
    ...world,
    places: { [placeKey("The Regatta Pier")]: { name: "The Regatta Pier", tags: "a pier", art: own } },
  }));
  await giveDate(x, "dates-0-f", { kind: "date5", place: { name: "The Regatta Pier", tags: "pier" }, scenes: 5, art });
  await startDate(x, { ...START, item: "dates-0-f" });
  assert.deepEqual((await places(x))[placeKey("The Regatta Pier")]?.art, own);
  // A reply with the wrong number of scenes is sent back.
  const v = await dateWorld("r-mg5date-aa0010");
  await giveDate(v, "dates-0-f", { kind: "date5", scenes: 5 });
  const short = await v.call("POST", "/runs/:run/dates/pulled", { ...START, item: "dates-0-f" });
  assert.notEqual(short.status, 200);
  assert.match(JSON.stringify(v.calls.at(-1)!.messages), /exactly 5 beats/);
});

test("the keepsake paints only when asked, once the date is over, and never twice", async () => {
  const t = await dateWorld("r-mg5date-aa0005", { images: true });
  const appearance = `DATE-APPEARANCE-START ${"auburn braid, amber eyes, freckles, ".repeat(50)}DATE-APPEARANCE-END`;
  t.runtime.resources.listPersonas = async () => [{ id: "persona-ines", data: { appearance } }];
  const { date } = await startDate(t);
  const key = date.key;
  const paint = (body: Record<string, unknown> = {}) => t.call("POST", "/runs/:run/art/keepsake", { key, ...body });
  assert.equal((await paint()).status, 409, "no keepsake before the date is over");
  await playDate(t, key, [1, 2, 1]);
  const done = await finish(t, key);
  assert.equal(done.body.keepsake.offer, true);
  // Finishing offers the keepsake; it paints nothing by itself.
  assert.equal(t.art.paid.length, 0);
  assert.equal(done.body.date.keepsake, null);

  const prompt = await t.call("POST", "/runs/:run/art/keepsake/prompt", { key });
  assert.equal(prompt.status, 200);
  assert.ok(prompt.body.prompt.includes(appearance), "the entire current Appearance reaches a keepsake too");
  assert.ok(prompt.body.prompt.includes("silhouette before the jellyfish tank"));
  assert.ok(prompt.body.prompt.includes("Kai: tall man, salt-white hair"));
  assert.ok(prompt.body.prompt.includes("safe for work"));
  assert.ok(prompt.body.prompt.includes("adult man"));
  assert.ok(prompt.body.prompt.includes("adult person"), "the protagonist is drawn as an adult too");
  assert.ok(prompt.body.negativePrompt.includes("underage"));
  assert.equal(prompt.body.negativePrompt.includes("extra people"), false);
  assert.equal(t.art.paid.length, 0);

  // A failed paint is saved as failed and waits for another tap.
  t.art.control.fail = true;
  const failed = await paint();
  assert.equal(failed.body.paint.state, "failed");
  assert.equal(t.art.paid.length, 1);
  assert.ok(t.art.paid[0]!.prompt.includes(appearance), "the actual image request keeps its tail as well as its start");
  // Both of them are drawn, from the pictures there are, each named: before, it sent two pictures of him and none of
  // her. This world's Kai has no card or portrait, so only her persona is sent, and only she is named.
  const units = (t.art.paid[0] as unknown as { units: Array<{ personaId?: string }> }).units;
  assert.deepEqual(
    units.map((unit) => unit.personaId),
    ["persona-ines"],
    JSON.stringify(units),
  );
  assert.match(t.art.paid[0]!.prompt, /Reference images, in order: Ines\. Use them only for each person's face/u);
  assert.match(t.art.paid[0]!.prompt, /Draw exactly two people, each appearing once/u);
  t.art.control.fail = false;

  // An edited prompt keeps its safety tags; two taps at once paint once.
  let release!: () => void;
  t.art.control.hold = new Promise<void>((resolve) => (release = resolve));
  const first = paint({ prompt: "two figures by a blue tank" });
  for (let round = 0; round < 50 && t.art.paid.length < 2; round += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.equal(t.art.paid.length, 2, "the first tap is painting");
  const second = await paint();
  assert.equal(second.status, 409);
  assert.equal(second.body.code, "busy");
  release();
  const ready = await first;
  t.art.control.hold = null;
  assert.equal(ready.body.paint.state, "ready");
  assert.equal(t.art.paid.length, 2);
  const sent = t.art.paid[1]!;
  assert.ok(sent.prompt.startsWith("two figures by a blue tank"));
  assert.ok(sent.prompt.includes("adult man"));
  assert.equal(sent.debugMode, true);
  assert.deepEqual([sent.width, sent.height], [768, 1344]);

  // Ready is final: another tap returns it without painting.
  const repeat = await paint();
  assert.equal(repeat.body.paint.url, ready.body.paint.url);
  assert.equal(t.art.paid.length, 2);
  const view = await t.call("GET", "/runs/:run/dates");
  assert.equal(view.body.dates[0].keepsake.state, "ready");

  // Without an image connection there is nothing to paint with.
  const t2 = await dateWorld("r-mg5date-aa0006");
  const other = await startDate(t2);
  await playDate(t2, other.date.key, [1, 1, 1]);
  await finish(t2, other.date.key);
  const none = await t2.call("POST", "/runs/:run/art/keepsake", { key: other.date.key });
  assert.equal(none.status, 503);
  assert.equal(none.body.code, "no-connection");
  assert.equal(t2.art.paid.length, 0);
});

test("a keepsake still draws a protagonist with no name, from her persona (#2145)", async () => {
  const t = await dateWorld("r-mg5date-aa0011", { images: true });
  const { date } = await startDate(t);
  await playDate(t, date.key, [1, 2, 1]);
  await finish(t, date.key);
  await t.store.updateDoc(runDocTarget("player", playerId(t.runId)), normalizePlayer, (player) => ({
    ...player,
    name: "",
  }));
  const painted = await t.call("POST", "/runs/:run/art/keepsake", { key: date.key });
  assert.equal(painted.body.paint.state, "ready");
  const units = (t.art.paid[0] as unknown as { units: Array<{ personaId?: string; who?: string }> }).units;
  assert.deepEqual(units, [{ kind: "character", personaId: "persona-ines", avatarOnly: true, who: "Protagonist" }]);
  assert.match(t.art.paid[0]!.prompt, /Reference images, in order: Protagonist\./u);
});

test("a run deleted while its date is planned keeps no date", async () => {
  let runId = "";
  const t = await dateWorld("r-mg5date-aa0007", {
    plan: () => {
      // The run's delete removes its state (and world) while the plan is being written.
      t.fake.rows.delete(stateId(runId));
      return datePlan();
    },
  });
  runId = t.runId;
  const started = await t.call("POST", "/runs/:run/dates/pulled", START);
  assert.equal(started.status, 404);
  assert.equal(t.fake.rows.has(`${t.runId}:chapter:date-1`), false);
});

// ── Gifts (#2128) ──

const GIFTED = { ...START, gift: "flowers" };

/** Puts these gifts in her Wardrobe, as the Shop would. */
async function giveGifts(t: DateWorld, gifts: Partial<Record<GiftId, number>>) {
  await t.store.mutateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    owned: { ...state.owned, gifts },
  }));
}

/** The narrator's call for node `node` (the first one, when two dates were played). */
const beatCall = (t: DateWorld, node: number) =>
  t.calls.find((call) => !isDatePlanner(call.messages) && nodeOf(call.messages) === node)!;

test("a gift is spent once, given in the date's first scene, remembered, and pays its own affection once, uncapped", async () => {
  const t = await dateWorld("r-dategift-aa0001");
  await giveGifts(t, { flowers: 2, wine: 1 });
  const started = await startDate(t, GIFTED);
  assert.equal(started.resumed, false);
  assert.equal(started.date.gift, "flowers");
  assert.equal("date" in started.chapter, false, "the plan stays hidden");
  assert.deepEqual((await t.state()).owned.gifts, { flowers: 1, wine: 1 });
  // Asking again while it is open resumes it, and gives nothing.
  const again = await startDate(t, { ...START, gift: "wine" });
  assert.equal(again.resumed, true);
  assert.equal(again.date.gift, "flowers");
  assert.deepEqual((await t.state()).owned.gifts, { flowers: 1, wine: 1 });

  // P26 gives the first scene the giving, as the evening's special moment.
  const plan = t.calls[0]!.messages;
  assert.ok(isDatePlanner(plan));
  assert.match(
    system(plan),
    /\n- THE GIFT: the protagonist brings a bouquet of flowers and gives it to Kai during the evening\. Scene 1's guide holds the giving as the evening's special moment: Kai's reaction in their own voice, a real exchange of dialogue between them\. The gift may change how the date goes, as Kai would take it\.\n/,
  );
  assert.ok(
    plan
      .at(-1)!
      .content.includes("\n\nTHE GIFT\nThe protagonist brings Kai a bouquet of flowers, given in scene 1.\n\n"),
  );

  await playDate(t, started.date.key, [1, 1, 2]);
  // Each scene's own task says it, in the uncached last turn: given now in the first, earlier in the others.
  for (const node of [0, 1, 2]) {
    const messages = beatCall(t, node).messages;
    const task = messages.at(-1)!.content;
    if (node === 0) {
      assert.match(
        task,
        /\nTHE GIFT: in this scene the protagonist gives Kai a bouquet of flowers\. Write it as the evening's special moment: Kai's reaction in their own voice and a real exchange of dialogue between them\./,
      );
    } else {
      assert.match(
        task,
        /\nEarlier tonight the protagonist gave Kai a bouquet of flowers; it may still colour the evening\.\n/,
      );
    }
    assert.equal(
      messages.slice(0, -1).some((message) => message.content.includes("bouquet")),
      false,
      `node ${node}: never in the cached story context or instructions`,
    );
  }
  // No ledger line: the date's played text carries the gift into memory, and a ledger line, as Kai's newest, would
  // reach the Home note, Read Him and Read Me.
  assert.deepEqual(
    (await t.state()).ledgers.relationship.filter((row) => row.key === started.date.key),
    [],
  );

  const done = await finish(t, started.date.key);
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.deepEqual(done.body.grants, [
    { source: "date", starlight: 120 },
    { source: "date", li: KAI, affection: 100 },
    { source: "gift", li: KAI, affection: 40 },
  ]);
  assert.equal(done.body.date.gift, "flowers");
  assert.equal((await t.state()).lis[KAI]!.points, 140);
  const replay = await finish(t, started.date.key);
  assert.deepEqual(replay.body.grants, []);
  assert.equal((await t.state()).lis[KAI]!.points, 140, "a replay pays nothing more");
  const view = await t.call("GET", "/runs/:run/dates");
  assert.equal(view.body.dates[0].gift, "flowers");

  // At the day's caps the date pays nothing more, and the gift still pays all of its own.
  await t.store.mutateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    daily: { dayKey: forgeDayKey(Date.now()), starlight: 400, affection: { [KAI]: 300 } },
  }));
  // #2303: Kai has been on this date: the next is another won date.
  await giveDate(t, "dates-0-a2", { title: "Lantern Walk" });
  const second = await startDate(t, { ...GIFTED, item: "dates-0-a2" });
  assert.deepEqual((await t.state()).owned.gifts, { wine: 1 }, "the last bouquet is given");
  await playDate(t, second.date.key, [2, 2, 2]);
  const capped = await finish(t, second.date.key);
  assert.equal(capped.body.counted, true);
  assert.deepEqual(capped.body.grants, [{ source: "gift", li: KAI, affection: 40 }]);
  assert.equal((await t.state()).lis[KAI]!.points, 180);
});

test("a gift she does not have is refused before anything is asked of the model, and a failed plan spends nothing", async () => {
  // A plan that never has the three scenes the date needs fails after its repair turn.
  const t = await dateWorld("r-dategift-aa0002", { plan: () => datePlan({ beats: [{ guide: "Only one scene." }] }) });
  const none = await t.call("POST", "/runs/:run/dates/pulled", GIFTED);
  assert.equal(none.status, 409);
  assert.equal(none.body.code, "conflict");
  assert.equal(t.calls.length, 0, "no model call for a gift she does not have");
  assert.equal(t.fake.rows.has(`${t.runId}:chapter:date-1`), false);
  assert.equal((await t.call("POST", "/runs/:run/dates/pulled", { ...START, gift: "diamonds" })).status, 400);

  await giveGifts(t, { flowers: 1 });
  const failed = await t.call("POST", "/runs/:run/dates/pulled", GIFTED);
  assert.equal(failed.status, 502, JSON.stringify(failed.body));
  assert.ok(t.calls.length > 0);
  assert.deepEqual((await t.state()).owned.gifts, { flowers: 1 }, "a plan that failed gives nothing");
  assert.equal(t.fake.rows.has(`${t.runId}:chapter:date-1`), false);
});

test("a gift given elsewhere while the date is planned: the date is not kept, and nothing is spent twice", async () => {
  const t: DateWorld = await dateWorld("r-dategift-aa0003", {
    plan: () => {
      // Another request gives the last bouquet while this plan is written.
      ((t.fake.rows.get(stateId(t.runId))!.data as RunState).owned.gifts as Record<string, number>).flowers = 0;
      return datePlan();
    },
  });
  await giveGifts(t, { flowers: 1 });
  const started = await t.call("POST", "/runs/:run/dates/pulled", GIFTED);
  assert.equal(started.status, 409);
  assert.equal(started.body.code, "conflict");
  assert.equal(t.fake.rows.has(`${t.runId}:chapter:date-1`), false);
  const state = await t.state();
  assert.equal("date-1" in state.chapters, false);
  assert.deepEqual(state.owned.gifts, {});
});

test("the aphrodisiac is refused under SFW Heat; under Fade or Explicit desire builds as the content contract allows", async () => {
  const sfw = await dateWorld("r-dategift-aa0004");
  await giveGifts(sfw, { aphrodisiac: 1 });
  const locked = await sfw.call("POST", "/runs/:run/dates/pulled", { ...START, gift: "aphrodisiac" });
  assert.equal(locked.status, 409);
  assert.equal(locked.body.code, "locked");
  assert.equal(sfw.calls.length, 0);
  assert.deepEqual((await sfw.state()).owned.gifts, { aphrodisiac: 1 }, "kept for when Heat is raised");

  for (const heat of ["fade", "explicit"] as const) {
    const t = await dateWorld(`r-dategift-${heat.slice(0, 4)}01`, { content: { ...defaultContent(), heat } });
    await giveGifts(t, { aphrodisiac: 1 });
    const started = await startDate(t, { ...START, gift: "aphrodisiac" });
    const plan = system(t.calls[0]!.messages);
    const rule = plan.split("\n").find((line) => line.startsWith("- THE GIFT:"))!;
    assert.ok(
      rule.endsWith(
        " It is an aphrodisiac, and it works: desire builds between them through the evening, and where it leads follows the CONTENT CONTRACT below.",
      ),
      rule,
    );
    // The gift adds no limit of its own (no consent line, softening or "non-graphic"): the contract's Heat decides.
    assert.doesNotMatch(rule, /consent|graphic|tasteful|fade|tease|imply|implied/i);
    assert.ok(
      plan.indexOf("\nCONTENT CONTRACT", plan.indexOf(rule) + rule.length) > 0,
      `${heat}: the contract's own block follows it`,
    );
    await playDate(t, started.date.key, [1, 1, 1]);
    const first = beatCall(t, 0).messages.at(-1)!.content;
    const later = beatCall(t, 2).messages.at(-1)!.content;
    assert.ok(
      first.includes(
        " It is an aphrodisiac, and it works: desire builds between them from here, as far as the content contract allows.",
      ),
    );
    assert.ok(
      later.includes(
        " It was an aphrodisiac, and its effect is still building: desire between them rises, as far as the content contract allows.",
      ),
    );
    assert.deepEqual((await t.state()).owned.gifts, {});
  }
});

// What a date's prompts sent before #2128 (staging 0.8.10, sha256 of the messages as JSON), for datePrompts() below
// with no gift: a date without one is planned and written exactly as before.
// 0.18.1: the canon writing rule now names an existing world's characters, so every date prompt's bytes moved.
// 2026-11-10: betweenYou's slow burn holds back love, not attraction, and carries the affection level, so these moved.
// 2026-11-11: a chapter's last scene hands an open decision to the player, and no scene assumes a choice never made.
// 0.23.0: the affection line reads "of 20" (the bond ranks), so these moved again.
// 0.26.0: the writing rules ask for plain prose and dialogue in each speaker's own register, so these moved.
// 0.33.3: the writing rules add the maintainer's lines on narration, spoken dialogue and echoing, so these moved.
// 0.36.3: the writing rules no longer ask for what the protagonist feels in their body, so these moved.
// 0.36.4 (#2384): the writing rules drop the dialogue rule, and scenes ask for spoken lines in its place, so these moved.
// 0.36.9: the writing rules ask not to fall into patterns, so every prompt that carries them moved.
const BEFORE_GIFTS: Record<string, string> = {
  plan: "2bb5f83e09a955ff",
  scene1: "b1d958052a139b4b",
  scene2: "3c221c6e499f477a",
  scene3: "aba6e95a4af60fba",
};

/** P26 and the three scenes of one date, from fixed documents, with or without a gift. */
function datePrompts(gift?: GiftId) {
  const world = normalizeWorld({
    title: "The Lantern Court",
    setting: "A harbour city lit by lanterns that must never go out.",
    mystery: { question: "Who puts out the lanterns?", truth: "The harbour master.", pieces: {} },
    connections: { narration: "conn-text" },
  });
  const units = CAST.map((li) => ({ ...normalizeUnit({}), id: li.id, name: li.name, pronouns: HE, bible: bible() }));
  const player = { ...normalizePlayer({}), name: "Ines", pronouns: SHE };
  const state = normalizeState({ lis: Object.fromEntries(CAST.map((li) => [li.id, defaultLiState()])) });
  const kai = units.find((unit) => unit.id === KAI)!;
  const date: DatePlan = {
    li: KAI,
    place: "aquarium",
    placeName: "The Lantern Aquarium",
    herLook: "base",
    hisLook: "base",
    goesWrong: false,
    makeItRight: null,
    keepsake: { brief: "The two of them before the jellyfish tank." },
    ...(gift ? { gift } : {}),
  };
  const nodes: ChapterNode[] = [0, 1, 2].map((i) => ({
    i,
    kind: "beat",
    guide: `Scene ${i + 1} of the date.`,
    cast: [KAI],
  }));
  const chapter = { kind: "date" as const, title: "Jellyfish Hour", lead: KAI, li: KAI, nodes, date };
  const scene = (node: ChapterNode) =>
    beatMessages({ world, player, units, state, chapter, node, storySoFar: [], memory: "" });
  return {
    plan: datePlanMessages({ world, player, unit: kai, state, place: "aquarium", makeItRight: null, memory: "", gift }),
    scene1: scene(nodes[0]!),
    scene2: scene(nodes[1]!),
    scene3: scene(nodes[2]!),
  };
}

test("a date without a gift keeps every prompt as it was, and a gift adds only its own lines, to the uncached task", () => {
  const digest = (messages: unknown) =>
    createHash("sha256").update(JSON.stringify(messages)).digest("hex").slice(0, 16);
  const without = datePrompts();
  assert.deepEqual(
    Object.fromEntries(Object.entries(without).map(([kind, messages]) => [kind, digest(messages)])),
    BEFORE_GIFTS,
  );
  const gifted = datePrompts("flowers");
  // P26: one RULES line in its instructions, and THE GIFT after THE PLACE.
  const rule = gifted.plan[0]!.content.split("\n").find((line) => line.startsWith("- THE GIFT:"))!;
  assert.equal(gifted.plan[0]!.content.replace(`${rule}\n`, ""), without.plan[0]!.content);
  assert.equal(
    gifted.plan[1]!.content.replace(
      "\n\nTHE GIFT\nThe protagonist brings Kai a bouquet of flowers, given in scene 1.",
      "",
    ),
    without.plan[1]!.content,
  );
  // Each scene: every message but its own task as before (so a chapter's scenes still share one cached prompt), and
  // the task with one line more, after the date's framing.
  for (const kind of ["scene1", "scene2", "scene3"] as const) {
    assert.deepEqual(gifted[kind].slice(0, -1), without[kind].slice(0, -1), kind);
    const task = gifted[kind].at(-1)!.content;
    const line = task.split("\n").find((entry) => /^(?:THE GIFT: in this scene|Earlier tonight)/.test(entry))!;
    assert.ok(line, kind);
    assert.ok(task.includes(`Keep it to the two of them; anyone else passes at the edges.\n${line}\n`), kind);
    assert.equal(task.replace(`\n${line}`, ""), without[kind].at(-1)!.content, kind);
  }
});
