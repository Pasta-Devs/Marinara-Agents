// Otome Forge's Date Night (M5): a date is one plan call and three beats (4 model calls); each date beat has one
// choice scored by option index, the scores never reach the client before the date ends, and a date never ends on a
// big choice; the outcome follows the total of the first-play picks; every outcome pays within the day's caps, once
// (a replay pays nothing); Make it right mends the rupture on a good or great outcome with every scene's choice made
// only (easing off a scene before its choice never mends it), and a date open before a rupture keeps its kind (the hub
// says so); a date is private memory (a `chat` source with audience [li]) that another love interest's prompts never
// see; starting twice plans once; and the keepsake paints only on request, once, through the image client.
import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityLanguageModelMessage } from "@marinara-engine/shared";
import { forgeKnowledgeBoundary } from "@forge-kit/story-memory-integration.mjs";
import { forgeDayKey } from "@forge-kit/time-zone-server.mjs";
import type {
  Grievance,
  LiState,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import { dateOutcome } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/dates.ts";
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
  runDocTarget,
  stateId,
  unitId,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { registerClawRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/claw.ts";
import { registerDateRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/dates.ts";
import { registerStoryRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/story.ts";
import { normalizeState } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
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
import type { BeatReply } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/prompts.ts";
import { KAI, MIR, at, json, storyWorld } from "./fixtures/otome-forge-story.ts";

const system = (messages: CapabilityLanguageModelMessage[]) => messages[0]!.content;
const isDatePlanner = (messages: CapabilityLanguageModelMessage[]) => system(messages).includes("You plan one DATE");
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
  const client: ImageClient = {
    async generatePortrait(request) {
      paid.push(request);
      if (control.hold) await control.hold;
      if (control.fail) throw new Error("the image provider is down");
      return { url: `/api/global-gallery/file/keepsake-${paid.length}.png`, id: `keepsake${paid.length}` };
    },
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
  }: {
    lis?: Record<string, Partial<LiState>>;
    plan?: () => Record<string, unknown>;
    beat?: (node: number) => Record<string, unknown>;
    images?: boolean;
  } = {},
) {
  const t = await storyWorld({ runKey, lis, replies: router(plan, beat), cancellation: true });
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

/** Reads the date's beats in order, picking `option-<pick>` in each, then lets the lookahead settle. */
async function playDate(t: DateWorld, key: string, picks: number[]) {
  for (const [i, pick] of picks.entries()) {
    const params = { key, i: String(i) };
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

const rupture = (): Partial<LiState> => {
  const grievance: Grievance = {
    id: "g-main-1-4-0",
    li: KAI,
    by: "li",
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
  assert.ok(system(beatPrompt).includes("DATE CHOICE"));
  assert.ok(system(beatPrompt).includes("old harbour maps"));
  assert.ok(system(beatPrompt).includes("being pitied"));
  assert.ok(beatPrompt.at(-1)!.content.includes("This chapter is a DATE"));
  // The last scene is never offered a big choice.
  const lastPrompt = t.calls.find((call) => nodeOf(call.messages) === 2 && !isDatePlanner(call.messages))!;
  assert.equal(system(lastPrompt.messages).includes("This is the LAST story beat"), false);

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
    [{ ...START, hisLook: "tuxedo" }, 400],
    [{ ...START, li: "li-nobody-zz99" }, 404],
  ] as const) {
    assert.equal((await t.call("POST", "/runs/:run/dates", body)).status, status);
  }
  assert.equal((await finish(t, "date-9")).status, 404);
  assert.equal((await finish(t, "main-1")).status, 404);
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

test("a date is private memory: a chat source for its love interest that no one else's prompt sees", async () => {
  const t = await dateWorld("r-mg5date-aa0004");
  const { date } = await startDate(t);
  await playDate(t, date.key, [1, 1, 1]);
  await finish(t, date.key);

  const sources = await readStorySources(t.store, t.runId, await t.state(), "Ines");
  const source = sources.find((item) => item.id === date.key);
  assert.ok(source);
  assert.equal(source.kind, "chat");
  assert.equal(source.title, "A date: Jellyfish Hour");
  assert.deepEqual(source.audience, [KAI]);
  assert.ok(source.content.includes("Line 1 from Kai."));

  const recall = (cast: string[]) => recallText(t.deps, t.runId, { job: "narration", cast });
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

test("the keepsake paints only when asked, once the date is over, and never twice", async () => {
  const t = await dateWorld("r-mg5date-aa0005", { images: true });
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
