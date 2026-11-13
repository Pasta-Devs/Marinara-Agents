// Otome Forge's Date Night (M5): a date is one plan call and three beats (4 model calls); each date beat has one
// choice scored by option index, the scores never reach the client before the date ends, and a date never ends on a
// big choice; the outcome follows the total of the first-play picks; every outcome pays within the day's caps, once
// (a replay pays nothing); Make it right mends the rupture on a good or great outcome with every scene's choice made
// only (easing off a scene before its choice never mends it), and says it mended only when no rupture is left (another
// one still owed keeps it standing, as M2b's repair does); a date open before a rupture keeps its kind (the hub says
// so), and one whose rupture is mended elsewhere goes on as an ordinary date (its later scenes, the hub, its finish);
// the plan and scenes say who holds the rupture (the love interest's hurt, or the protagonist's); a date is his own
// memory (a `character-story` source with audience [li], titled private) that another love interest's prompts never
// see beyond the overview; P26 and the date's scenes see the state as its love interest may know it (M3's
// ownView); a date can go to a place the story painted (M2b's world.places), under its own name; starting twice plans
// once; and the keepsake paints only on request, once, through the image client.
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
  itemId,
  playerId,
  runDocTarget,
  stateId,
  unitId,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
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
import { healRupture } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/state/stages.ts";
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
  RUPTURE_ID,
  SHE,
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
const isDatePlanner = (messages: CapabilityLanguageModelMessage[]) =>
  /You plan one (?:DOUBLE )?DATE/.test(system(messages));
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
    async cardAvatarImage() {
      return null;
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
  const deps: RouteDeps = { ...t.deps, images: art.client };
  return { ...t, deps, art, call: routes(deps, runKey) };
}

type DateWorld = Awaited<ReturnType<typeof dateWorld>>;

const START = { li: KAI, place: "aquarium", herLook: "base", hisLook: "base" };
const beatPath = "/runs/:run/chapters/:key/beats/:i";

async function startDate(t: DateWorld, body: Record<string, unknown> = START) {
  const started = await t.call("POST", "/runs/:run/dates", body);
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
  assert.deepEqual([3, 2, 1, 0, -1, -3].map(dateOutcome), ["great", "great", "good", "good", "awkward", "awkward"]);
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
  assert.equal(view.body.lis.find((entry: { li: string }) => entry.li === KAI).open, null);

  // A second date is a new chapter; the first date is on the timeline once.
  const second = await startDate(t);
  assert.equal(second.date.key, "date-2");
  await playDate(t, "date-2", [3, 3, 3]);
  const awkward = await finish(t, "date-2");
  assert.equal(awkward.body.outcome, "awkward");
  // An awkward evening still pays (failure pays; caps limit rewards, never play).
  assert.equal(awkward.body.grants.length, 2);
  assert.equal((await t.state()).timeline.filter((entry) => entry.kind === "first-date").length, 1);
});

test("#2283: a double date invites a second love interest at level 10 and splits its affection evenly", async () => {
  // Below affection level 10 the invitation is refused before anything is planned.
  const low = await dateWorld("r-dublol-aaaaaa");
  const refused = await low.call("POST", "/runs/:run/dates", { ...START, second: MIR });
  assert.equal(refused.status, 409, JSON.stringify(refused.body));
  assert.equal(refused.body.code, "locked");
  assert.equal(low.calls.length, 0, "nothing is asked of the model");
  assert.equal((await low.call("POST", "/runs/:run/dates", { ...START, second: KAI })).status, 400, "not the lead");

  // At level 10 (3600 points) each of them the invited love interest joins: the plan is written for the three of them.
  const t = await dateWorld("r-double-aaaaaa", {
    lis: { [KAI]: { points: 3600, stage: 6 }, [MIR]: { points: 3600, stage: 6 } },
  });
  const started = await startDate(t, { ...START, second: MIR });
  assert.equal(started.date.second, MIR);
  const stored = await t.store.readDoc(`${t.runId}:chapter:${started.date.key}`, normalizeChapter);
  assert.deepEqual(
    stored!.nodes.map((node: ChapterNode) => node.cast),
    [
      [KAI, MIR],
      [KAI, MIR],
      [KAI, MIR],
    ],
  );
  const plan = t.calls[0]!.messages;
  assert.ok(system(plan).includes("DOUBLE DATE"), "the plan knows it is a double date");
  assert.ok(plan.at(-1)!.content.includes("Mireille"), "the invited love interest is named in the plan");

  await playDate(t, started.date.key, [1, 1, 2]);
  const done = await finish(t, started.date.key);
  assert.equal(done.status, 200, JSON.stringify(done.body));
  // 100 affection split evenly, each paid on its own; the Starlight is the evening's, paid once.
  const affection = done.body.grants.filter((grant: { affection?: number }) => grant.affection);
  assert.deepEqual(
    affection.map((grant: { li: string; affection: number }) => ({ li: grant.li, affection: grant.affection })),
    [
      { li: KAI, affection: 50 },
      { li: MIR, affection: 50 },
    ],
  );
  const starlight = done.body.grants.filter((grant: { starlight?: number }) => grant.starlight);
  assert.deepEqual(starlight, [{ source: "date", starlight: 120 }]);
  const state = await t.state();
  // Both stand at 3,600 (level 10): each gains the same 50.
  assert.deepEqual([state.lis[KAI]!.points, state.lis[MIR]!.points], [3650, 3650]);
  // Both have had their first date with her.
  assert.ok(state.lis[KAI]!.firsts.date);
  assert.ok(state.lis[MIR]!.firsts.date);
  // The entry names the second, and the dates list carries it.
  assert.equal(done.body.date.second, MIR);
  const list = await t.call("GET", "/runs/:run/dates");
  assert.equal(list.body.dates.find((entry: { key: string }) => entry.key === started.date.key).second, MIR);

  // The invited love interest's own evening that waits keeps him from joining.
  const busy = await dateWorld("r-dublbz-aaaaaa", {
    lis: { [KAI]: { points: 3600, stage: 6 }, [MIR]: { points: 3600, stage: 6 } },
  });
  await busy.call("POST", "/runs/:run/dates", { ...START, li: MIR });
  const clash = await busy.call("POST", "/runs/:run/dates", { ...START, second: MIR });
  assert.equal(clash.status, 409, JSON.stringify(clash.body));
});

test("the day's caps limit what a date pays, never whether it is played and counted", async () => {
  const t = await dateWorld("r-mg5date-aa0002");
  await t.store.mutateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    daily: { dayKey: forgeDayKey(Date.now()), starlight: 350, affection: { [KAI]: 300 } },
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
    t.call("POST", "/runs/:run/dates", START),
    t.call("POST", "/runs/:run/dates", { ...START, place: "rooftop" }),
  ]);
  assert.equal(one.status, 200, JSON.stringify(one.body));
  assert.equal(two.status, 200, JSON.stringify(two.body));
  assert.equal(one.body.date.key, two.body.date.key);
  assert.deepEqual([one.body.resumed, two.body.resumed].sort(), [false, true]);
  assert.equal(t.calls.length, 1);
  const later = await startDate(t, { ...START, place: "cafe" });
  assert.equal(later.resumed, true);
  assert.equal(later.date.place, "aquarium");
  assert.equal(t.calls.length, 1);
  const view = await t.call("GET", "/runs/:run/dates");
  assert.equal(view.body.lis.find((entry: { li: string }) => entry.li === KAI).open.key, "date-1");

  for (const [body, status] of [
    [{ ...START, place: "the moon" }, 400],
    [{ ...START, hisLook: "tuxedo" }, 404],
    [{ ...START, li: "li-nobody-zz99" }, 404],
  ] as const) {
    assert.equal((await t.call("POST", "/runs/:run/dates", body)).status, status);
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
    owned: { ...state.owned, items: [his.id, hers.id] },
  }));
  // A look nobody owns, or someone else's, is refused before anything is planned.
  assert.equal((await t.call("POST", "/runs/:run/dates", { ...START, hisLook: unowned.id })).status, 409);
  assert.equal((await t.call("POST", "/runs/:run/dates", { ...START, herLook: his.id })).status, 400);
  assert.equal(t.calls.length, 0, "no plan for a refused look");
  await startDate(t, { ...START, hisLook: his.id, herLook: hers.id });
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
  // The keepsake draws them in their looks, on top of who they are.
  await playDate(t, "date-1", [1, 2, 1]);
  assert.equal((await finish(t, "date-1")).status, 200);
  const keepsake = (await t.call("POST", "/runs/:run/art/keepsake/prompt", { key: "date-1" })).body.prompt as string;
  assert.match(keepsake, /Kai: tall man, salt-white hair, grey eyes; HIS-LOOK: navy greatcoat, brass buttons/);
  assert.match(keepsake, /HER-LOOK: amber silk dress/);
  assert.doesNotMatch(keepsake, /dark keeper's coat/, "never his everyday coat over the date look");
  assert.match(keepsake, /face, hair and build, never/);
});

test("during a rupture the date is Make it right: a good or great outcome mends it, an awkward one does not", async () => {
  for (const [picks, mended] of [
    [[1, 2, 2], true],
    [[3, 3, 2], false],
  ] as const) {
    const t = await dateWorld(`r-mg5date-mir${mended ? "001" : "002"}`, { lis: { [KAI]: rupture() } });
    const started = await startDate(t);
    assert.equal(started.date.makeItRight, true);
    const plan = t.calls[0]!.messages;
    assert.ok(system(plan).includes("MAKE IT RIGHT"));
    // She holds it: the evening is Kai's attempt to earn back her trust.
    assert.ok(system(plan).includes("Plan the evening as Kai's attempt to earn back the protagonist's trust"));
    assert.ok(plan.at(-1)!.content.includes("She read the letters he burned."));
    await playDate(t, started.date.key, [...picks]);
    assert.ok(t.calls[1]!.messages.at(-1)!.content.includes("MAKE IT RIGHT date"));
    // The rupture stands until the date is finished: no scene resolves it in passing.
    assert.ok((await t.state()).lis[KAI]!.rupture);
    const done = await finish(t, started.date.key);
    assert.equal(done.body.repaired, mended);
    assert.equal(done.body.mends, mended);
    const kai = (await t.state()).lis[KAI]!;
    assert.equal(kai.rupture === null, mended);
    assert.equal(kai.grievances[0]!.status, mended ? "addressed" : "open");
    // A replay changes nothing either way, and says the same of the evening.
    const replay = await finish(t, started.date.key);
    assert.deepEqual([replay.body.repaired, replay.body.mends], [false, mended]);
    assert.equal((await t.state()).lis[KAI]!.rupture === null, mended);
  }
});

test("easing off a Make it right date's scenes before their choices never mends the rupture, and still pays", async () => {
  const ease = (t: DateWorld, key: string, i: number) =>
    t.call("POST", `${beatPath}/ease-off`, { segment: 0 }, { key, i: String(i) });
  // Every scene eased off before a word of it was written: no choice made, a total of 0, which alone reads "good".
  const t = await dateWorld("r-mg5date-ease01", { lis: { [KAI]: rupture() } });
  const started = await startDate(t);
  assert.equal(started.date.makeItRight, true);
  for (const i of [0, 1, 2]) assert.equal((await ease(t, started.date.key, i)).status, 200);
  assert.equal(t.calls.length, 1, "only the plan was written");
  const before = (await t.state()).wallet.starlight;
  const done = await finish(t, started.date.key);
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.deepEqual(done.body.picks, []);
  assert.deepEqual([done.body.repaired, done.body.mends], [false, false]);
  assert.equal(done.body.counted, true);
  assert.deepEqual(done.body.grants, [
    { source: "date", starlight: 120 },
    { source: "date", li: KAI, affection: 100 },
  ]);
  assert.equal((await t.state()).wallet.starlight, before + 120, "it still pays");
  const kai = (await t.state()).lis[KAI]!;
  assert.ok(kai.rupture, "the rupture still stands");
  assert.equal(kai.grievances[0]!.status, "open");

  // One loving choice, then the other two scenes eased off: still not the player's whole evening, so not mended.
  const part = await dateWorld("r-mg5date-ease02", { lis: { [KAI]: rupture() } });
  const date = (await startDate(part)).date;
  await playDate(part, date.key, [1]);
  for (const i of [1, 2]) assert.equal((await ease(part, date.key, i)).status, 200);
  const partly = await finish(part, date.key);
  assert.equal(partly.body.outcome, "good");
  assert.deepEqual([partly.body.repaired, partly.body.mends], [false, false]);
  assert.ok((await part.state()).lis[KAI]!.rupture);
});

/** A second rupture-severity grievance Kai holds (a later Confrontation's walkout at low trust). */
const secondRupture: Grievance = {
  id: "g-main-2-5-0",
  li: KAI,
  by: "protagonist",
  text: "She walked out on him at the pier.",
  severity: "rupture",
  opened: "main-2/5",
  status: "open",
};

test("Make it right with another rupture still owed addresses its grievance, and says the rupture still stands", async () => {
  const first = rupture();
  const t = await dateWorld("r-mg5date-two001", {
    lis: { [KAI]: { ...first, grievances: [...first.grievances!, secondRupture] } },
  });
  const started = await startDate(t);
  assert.equal(started.date.makeItRight, true);
  await playDate(t, started.date.key, [1, 1, 1]);
  const done = await finish(t, started.date.key);
  assert.equal(done.body.outcome, "great");
  // Its grievance is addressed, and the rupture stands on the next one owed, as M2b's repair would leave it.
  const kai = (await t.state()).lis[KAI]!;
  assert.deepEqual(
    kai.grievances.map((grievance) => grievance.status),
    ["addressed", "open"],
  );
  assert.equal(kai.rupture?.grievanceId, secondRupture.id);
  // So the ending says it is not mended yet, and a replay says the same.
  assert.deepEqual([done.body.date.makeItRight, done.body.repaired, done.body.mends], [true, false, false]);
  const replay = await finish(t, started.date.key);
  assert.deepEqual([replay.body.date.makeItRight, replay.body.repaired, replay.body.mends], [true, false, false]);
  // Date Night is Make it right again, for the rupture that still stands.
  assert.equal((await t.call("GET", "/runs/:run/play")).body.lis[KAI].makeItRight, true);
  const next = await startDate(t);
  assert.deepEqual([next.resumed, next.date.makeItRight], [false, true]);
  const plan = t.calls.filter((call) => isDatePlanner(call.messages)).at(-1)!.messages;
  assert.ok(plan.at(-1)!.content.includes(`The rupture (${secondRupture.id}): ${secondRupture.text}`));

  // With the last rupture mended, it says so.
  await playDate(t, next.date.key, [1, 1, 1]);
  const mended = await finish(t, next.date.key);
  assert.deepEqual([mended.body.date.makeItRight, mended.body.repaired, mended.body.mends], [true, true, true]);
  assert.equal((await t.state()).lis[KAI]!.rupture, null);
});

test("a rupture mended elsewhere while a Make it right date is open: the rest of it is an ordinary date", async () => {
  const t = await dateWorld("r-mg5date-heal01", { lis: { [KAI]: rupture() } });
  const started = await startDate(t);
  const key = started.date.key;
  assert.equal(started.date.makeItRight, true);
  await playDate(t, key, [1]);
  const sceneOne = t.calls.find((call) => !isDatePlanner(call.messages) && nodeOf(call.messages) === 0)!;
  assert.ok(sceneOne.messages.at(-1)!.content.includes("It is a MAKE IT RIGHT date"));
  // M2b's repair chapter, read to its end from the Story screen, mends it meanwhile (S/state/stages.ts healRupture).
  const id = "g-main-1-4-0";
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => {
    const repair = {
      kind: "repair" as const,
      li: KAI,
      grievance: id,
      nodes: [{ i: 0, kind: "beat" as const, guide: "", cast: [KAI], resolves: [id] }],
    };
    return healRupture(state, repair, 0, at).state;
  });
  assert.equal((await t.state()).lis[KAI]!.rupture, null);
  // The hub and the open date are Date Night again.
  assert.equal((await t.call("GET", "/runs/:run/play")).body.lis[KAI].makeItRight, false);
  const view = (await t.call("GET", "/runs/:run/dates")).body;
  assert.equal(view.lis.find((entry: { li: string }) => entry.li === KAI).open.makeItRight, false);
  // Scenes written from now on are an ordinary date's.
  const written = t.calls.length;
  await playDate(t, key, [1, 1], 1);
  const later = t.calls.slice(written);
  assert.ok(
    later.some((call) => nodeOf(call.messages) === 2),
    "the last scene was written after the repair",
  );
  for (const call of later) assert.equal(call.messages.at(-1)!.content.includes("MAKE IT RIGHT"), false);
  // Its finish mends nothing and says nothing of mending: the ending is an ordinary date's.
  const done = await finish(t, key);
  assert.equal(done.body.outcome, "great");
  assert.deepEqual([done.body.date.makeItRight, done.body.repaired, done.body.mends], [false, false, false]);
  const replay = await finish(t, key);
  assert.deepEqual([replay.body.date.makeItRight, replay.body.repaired, replay.body.mends], [false, false, false]);
  assert.equal((await t.state()).lis[KAI]!.grievances[0]!.status, "addressed");
  assert.equal((await t.call("GET", "/runs/:run/dates")).body.dates[0].makeItRight, false);
});

test("a rupture the protagonist holds: the plan and its scenes have the love interest earn back the protagonist's trust", async () => {
  const held = rupture();
  const grievance: Grievance = {
    ...held.grievances![0]!,
    by: "protagonist",
    text: "Kai sold her secret to the guild.",
  };
  const t = await dateWorld("r-mg5date-hers01", { lis: { [KAI]: { ...held, grievances: [grievance] } } });
  const started = await startDate(t);
  assert.equal(started.date.makeItRight, true);
  const plan = system(t.calls[0]!.messages);
  assert.ok(
    plan.includes(
      "it is the protagonist who was hurt. Plan the evening as Kai's attempt to earn back the protagonist's trust: each scene gives Kai a real chance to make amends",
    ),
  );
  assert.equal(plan.includes("the protagonist's attempt to mend it"), false);
  await playDate(t, started.date.key, [1, 1, 1]);
  const scenes = t.calls.slice(1).map((call) => call.messages.at(-1)!.content);
  assert.equal(scenes.length, 3);
  for (const scene of scenes) {
    assert.ok(
      scene.includes(
        "It is a MAKE IT RIGHT date: a rupture stands between them (Kai sold her secret to the guild.). The protagonist is the one hurt, and Kai is trying to earn back the protagonist's trust. The protagonist's hurt is honest",
      ),
    );
    assert.equal(scene.includes("The protagonist is trying to mend it"), false);
  }
  const done = await finish(t, started.date.key);
  assert.deepEqual([done.body.repaired, done.body.mends], [true, true]);
});

test("a date open when a rupture starts keeps its kind, and the hub says so until the next one", async () => {
  const t = await dateWorld("r-mg5date-stale1");
  const makeItRight = async () => (await t.call("GET", "/runs/:run/play")).body.lis[KAI].makeItRight;
  assert.equal(await makeItRight(), false);
  const { date } = await startDate(t);
  assert.equal(date.makeItRight, false);
  // A main chapter opens a rupture with Kai while the date is still open.
  await t.store.mutateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    lis: { ...state.lis, [KAI]: { ...state.lis[KAI]!, ...rupture() } },
  }));
  const play = (await t.call("GET", "/runs/:run/play")).body;
  assert.equal(play.lis[KAI].rupture, true);
  assert.equal(play.lis[KAI].makeItRight, false, "the open date is an ordinary one, and the hub calls it Date Night");
  assert.equal(play.lis[MIR].makeItRight, false);
  const resumed = await startDate(t);
  assert.deepEqual([resumed.resumed, resumed.date.makeItRight], [true, false]);
  await playDate(t, date.key, [1, 1, 1]);
  const done = await finish(t, date.key);
  assert.deepEqual([done.body.outcome, done.body.mends, done.body.repaired], ["great", false, false]);
  assert.ok((await t.state()).lis[KAI]!.rupture, "an ordinary date never mends a rupture");
  // With no date open, the next one is Make it right.
  assert.equal(await makeItRight(), true);
  const next = await startDate(t);
  assert.deepEqual([next.resumed, next.date.makeItRight], [false, true]);
  assert.equal(await makeItRight(), true);
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
  await startDate(t, { ...START, li: MIR });
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
  assert.equal(date.makeItRight, true, "the rupture still makes it Make it right");
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
  assert.ok(text(0).includes(`MAKE IT RIGHT\nThe rupture (${RUPTURE_ID})\n`));
  assert.ok(text(1).includes("It is a MAKE IT RIGHT date: a rupture stands between them. The protagonist"));
});

test("a date can go to a place the story painted, under the name the story gave it", async () => {
  const t = await dateWorld("r-mg5date-aa0009");
  const art = {
    state: "ready" as const,
    at,
    url: "/api/global-gallery/file/conservatory.png",
    ref: "global-gallery:c1",
  };
  await t.store.mutateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
    ...world,
    places: {
      "the-glass-conservatory": { name: "The Glass Conservatory", tags: "glasshouse, ferns, rain, no humans", art },
    },
  }));
  // A place the story does not have is refused before anything is planned.
  for (const storyPlace of [undefined, "the-moon", "constructor", "__proto__"]) {
    const refused = await t.call("POST", "/runs/:run/dates", { ...START, place: "story", storyPlace });
    assert.deepEqual([refused.status, refused.body.code], [400, "bad-request"], String(storyPlace));
  }
  assert.equal(t.calls.length, 0);

  const started = await startDate(t, { ...START, place: "story", storyPlace: "the-glass-conservatory" });
  assert.equal(started.date.place, "story");
  // The plan named it otherwise (the aquarium's reply); the date keeps the story's name, so its art shows.
  assert.equal(started.date.placeName, "The Glass Conservatory");
  const plan = t.calls[0]!.messages;
  assert.ok(
    plan
      .at(-1)!
      .content.includes('"The Glass Conservatory", a place in this world (glasshouse, ferns, rain, no humans).'),
  );
  assert.ok(system(plan).includes("- place: the name of the place given below, exactly as written there."));
  assert.equal(plan.at(-1)!.content.includes("night aquarium"), false);
  const stored = (await t.store.readDoc(`${t.runId}:chapter:${started.date.key}`, normalizeChapter))!;
  assert.equal(stored.nodes[0]!.place, "The Glass Conservatory");
  assert.equal(stored.date!.place, "story");
  await playDate(t, started.date.key, [1]);
  assert.ok(t.calls[1]!.messages.at(-1)!.content.includes("spend together at The Glass Conservatory"));
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
  assert.deepEqual(units, [{ kind: "character", personaId: "persona-ines", outfits: [], who: "Protagonist" }]);
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
  const started = await t.call("POST", "/runs/:run/dates", START);
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
  const second = await startDate(t, GIFTED);
  assert.deepEqual((await t.state()).owned.gifts, { wine: 1 }, "the last bouquet is given");
  await playDate(t, second.date.key, [2, 2, 2]);
  const capped = await finish(t, second.date.key);
  assert.equal(capped.body.counted, true);
  assert.deepEqual(capped.body.grants, [{ source: "gift", li: KAI, affection: 40 }]);
  assert.equal((await t.state()).lis[KAI]!.points, 180);
});

test("a gift she does not have is refused before anything is asked of the model, and a failed plan spends nothing", async () => {
  // A plan that never has the three scenes a date needs fails after its repair turn.
  const t = await dateWorld("r-dategift-aa0002", { plan: () => datePlan({ beats: [{ guide: "Only one scene." }] }) });
  const none = await t.call("POST", "/runs/:run/dates", GIFTED);
  assert.equal(none.status, 409);
  assert.equal(none.body.code, "conflict");
  assert.equal(t.calls.length, 0, "no model call for a gift she does not have");
  assert.equal(t.fake.rows.has(`${t.runId}:chapter:date-1`), false);
  assert.equal((await t.call("POST", "/runs/:run/dates", { ...START, gift: "diamonds" })).status, 400);

  await giveGifts(t, { flowers: 1 });
  const failed = await t.call("POST", "/runs/:run/dates", GIFTED);
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
  const started = await t.call("POST", "/runs/:run/dates", GIFTED);
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
  const locked = await sfw.call("POST", "/runs/:run/dates", { ...START, gift: "aphrodisiac" });
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
const BEFORE_GIFTS: Record<string, string> = {
  plan: "c02a6f0f50ad3958",
  scene1: "a8a5b77002572ee6",
  scene2: "a6bc1996ec0154f3",
  scene3: "c10d89ad4607db8b",
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
