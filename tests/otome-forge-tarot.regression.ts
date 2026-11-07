// Otome Hearth's Tarot night (#2151): the draw takes the cards at the picked places of a fresh crypto shuffle, each
// upright or reversed, and bad picks or a question over its cap are a 400 with nothing written; one reading per start
// (an unfinished one is returned as it is, whatever was asked, and two starts together make one call); a failed call
// saves nothing and claims nothing, and a run deleted meanwhile keeps neither reading nor deck; the prompt carries the
// `chat` contract (it follows the Heat, with no rule added), the knowledge boundary, the love interest's own reader's
// story memory, THE ROAD AHEAD (an arc's goal and next purposes, never its reveals, ending, antagonist, judgment or
// newcomer; roadAhead is the only Tarot code that reads arcs) and its fallbacks, one system message for both modes and
// every reading, THE SPREAD last and no cache mark; the reply's checks; a reaction never reaches the client before its
// card is answered, and the first answer is final; finishing pays once within the shared caps, writes the first Tarot
// night once and queues memory upkeep once; a finished reading is a private `chat` source only its love interest
// recalls; the deck casts a card of the love interest per love interest and the rest once per story, claims each card
// once, holds it under Ask before painting or prompt review, paints it once (a double tap pays once, a failure waits
// for Retry, a card never drawn is locked), at a CG's size with the card's iconography and no lettering; the client's
// emblems and card names are complete.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { CapabilityLanguageModelMessage } from "@marinara-engine/shared";
import { forgeKnowledgeBoundary } from "@forge-kit/story-memory-integration.mjs";
import { forgeTimeZoneRoutes } from "@forge-kit/time-zone-server.mjs";
import type {
  Beat,
  Chapter,
  StoryArc,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import { defaultContent } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/content.ts";
import {
  ARCANA,
  ARCANA_FIGURES,
  TAROT_QUESTION_MAX,
  deckKey,
  type TarotReadingView,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/tarot.ts";
import {
  TAROT_EMBLEMS,
  arcanaNumeral,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/lib/tarot-emblems.ts";
import {
  claimDeckCards,
  deckId,
  normalizeDeck,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/tarot-deck.ts";
import {
  createHandle,
  type OtomeReply,
  type RouteDeps,
  type RouteHandler,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/http.ts";
import {
  RUN_DOC_KINDS,
  arcId,
  beatId,
  chapterId,
  runDocTarget,
  stateId,
  unitId,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { createOtomeMemory } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/memory.ts";
import { readMemorySources } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/sources.ts";
import {
  TarotReplySchema,
  checkTarotReply,
  checkPicks,
  drawCards,
  finishTarot,
  normalizeReading,
  roadAhead,
  tarotTarget,
  type TarotReply,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/minigames/tarot.ts";
import {
  ARCANA_BRIEFS,
  SCENE_SIZE,
  stageGoal,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/prompts.ts";
import { registerTarotRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/tarot.ts";
import { normalizeState } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizeArc } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story-arc.ts";
import {
  normalizeBeat,
  normalizeChapter,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { fakeImages, setImages, until, type PaidCall } from "./fixtures/otome-forge-art.ts";
import type { FakeReply } from "./fixtures/otome-forge-fakes.ts";
import {
  KAI,
  KAI_SHARED,
  MIR,
  MIREILLE_ONLY,
  SOL,
  at,
  json,
  storyWorld,
  withMireillesPrivateRows,
} from "./fixtures/otome-forge-story.ts";

type Messages = CapabilityLanguageModelMessage[];
type Mode = "reads-you" | "you-read";
const isTarotPrompt = (messages: Messages) => messages.some((message) => message.content.includes('one "Tarot night"'));
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const server = join(root, "packages/otome-forge/src/engine/packages/server/src/services/otome-forge");
const client = join(root, "packages/otome-forge/src/engine/packages/client/src/features/otome-forge");

/** A valid reply, every field tagged so the tests can tell where it went. */
function reply(mode: Mode = "reads-you", tag = "A", changes: Partial<TarotReply> = {}): TarotReply {
  return {
    context: `CONTEXT-${tag}: Kai lays three cards on the sea wall.`,
    opening: { line: `OPENING-${tag}: Ask them, then.`, face: "tender" },
    cards: [0, 1, 2].map((card) => ({
      line: `CARD-${tag}${card}: This one remembers the quay.`,
      face: card === 1 ? "smug" : "cold",
      ...(mode === "you-read"
        ? {
            readings: [0, 1, 2].map((option) => ({
              text: `READING-${tag}${card}${option}: You hide it well.`,
              reaction: `REACTION-${tag}${card}${option}: Do I?`,
              face: "flustered",
            })),
          }
        : {}),
    })),
    closing: { line: `CLOSING-${tag}: That is your answer.`, face: "tender" },
    ...changes,
  };
}

/** Answers the Tarot prompt with `replies` in turn (the last one repeats). */
function model(...replies: unknown[]): FakeReply[] {
  const queue = [...replies];
  return Array.from({ length: 30 }, () => (messages: Messages) => {
    if (!isTarotPrompt(messages)) throw new Error(`Unexpected prompt: ${messages[0]!.content.slice(0, 80)}`);
    const next = queue.length > 1 ? queue.shift() : queue[0];
    return typeof next === "string" ? next : json(next);
  });
}

const VIEW = "/runs/:run/lis/:li/tarot";
const START = "/runs/:run/tarot";
const ANSWER = "/runs/:run/tarot/:reading/answer";
const FINISH = "/runs/:run/tarot/:reading/finish";
const ART = "/runs/:run/art/tarot";

/** The Tarot routes on a fake router wrapped by the kit's forgeTimeZoneRoutes; `call` answers like Fastify. */
function tarotRoutes(deps: RouteDeps, runKey: string) {
  const routes = new Map<string, RouteHandler>();
  registerTarotRoutes(
    forgeTimeZoneRoutes({
      get: (path: string, handler: RouteHandler) => void routes.set(`GET ${path}`, handler),
      post: (path: string, handler: RouteHandler) => void routes.set(`POST ${path}`, handler),
    }),
    deps,
  );
  return async (method: "GET" | "POST", path: string, body: object = {}, params: Record<string, string> = {}) => {
    const handler = routes.get(`${method} ${path}`);
    assert.ok(handler, `${method} ${path} is registered`);
    let status = 200;
    let payload: unknown;
    const answer: OtomeReply = {
      status(code) {
        status = code;
        return answer;
      },
      send(value) {
        payload = value;
        return answer;
      },
    };
    const fields = { timeZone: "UTC", debugMode: true };
    const result = await handler(
      {
        method,
        url: path,
        body: method === "POST" ? { ...fields, ...body } : undefined,
        query: method === "GET" ? fields : {},
        params: { run: runKey, ...params },
      },
      answer,
    );
    return { status, body: (result === answer ? payload : result) as Record<string, any> };
  };
}

async function tarotWorld(
  runKey: string,
  replies: FakeReply[] = model(reply()),
  {
    content,
    images,
    before,
    personas,
    memory,
  }: {
    content?: ReturnType<typeof defaultContent>;
    images?: { ask?: boolean };
    before?: (call: PaidCall, n: number) => void | Promise<void>;
    personas?: Array<{ id: string; data: unknown }>;
    memory?: RouteDeps["memory"];
  } = {},
) {
  const base = await storyWorld({
    runKey,
    replies,
    ...(content ? { content } : {}),
    ...(personas ? { personas } : {}),
  });
  if (images) await setImages(base.store, base.runId, { connectionId: "conn-image", ...images });
  const fake = fakeImages({ before });
  const deps: RouteDeps = {
    ...base.deps,
    images: fake.images,
    handle: createHandle(base.runtime.logger),
    ...(memory ? { memory } : {}),
  };
  const call = tarotRoutes(deps, runKey);
  const start = (body: object = {}) => call("POST", START, { li: KAI, mode: "reads-you", picks: [0, 7, 21], ...body });
  const answer = (reading: string, card: number, pick: number) => call("POST", ANSWER, { card, pick }, { reading });
  const finish = (reading: string) => call("POST", FINISH, {}, { reading });
  const view = (li = KAI) => call("GET", VIEW, {}, { li });
  const tarotCalls = () => base.calls.filter((entry) => isTarotPrompt(entry.messages));
  const readings = () => base.fake.documents.list("otome-forge", "tarot");
  const deck = () => base.store.readDoc(deckId(base.runId), normalizeDeck);
  return { ...base, ...fake, deps, call, start, answer, finish, view, tarotCalls, readings, deck };
}

/** Holds the next model call until `release`; `reached` resolves once it is waiting. */
function holdModel(t: Awaited<ReturnType<typeof tarotWorld>>) {
  let release!: () => void;
  let reached!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const waiting = new Promise<void>((resolve) => (reached = resolve));
  const models = t.runtime.languageModels as { resolveForRequest: typeof t.runtime.languageModels.resolveForRequest };
  const resolve = models.resolveForRequest.bind(models);
  models.resolveForRequest = async (request) => {
    const resolved = await resolve(request);
    return {
      ...resolved,
      async chatComplete(messages, options) {
        reached();
        await gate;
        return resolved.chatComplete(messages, options);
      },
    };
  };
  return { release: () => release(), waiting };
}

/** Completes a chapter whose single node reads `line`. */
async function complete(
  t: Awaited<ReturnType<typeof tarotWorld>>,
  chapter: Pick<Chapter, "key" | "kind" | "lead"> & Partial<Chapter>,
  line: string,
  completedAt = at,
) {
  await t.store.mutateDoc(runDocTarget("chapter", chapterId(t.runId, chapter.key)), normalizeChapter, () => ({
    title: chapter.key,
    tags: [],
    summary: "",
    ledger: { relationship: [], conflict: [], offscreen: [] },
    connectionId: "conn-text",
    plannedAt: completedAt,
    nodes: [{ i: 0, kind: "beat" as const, guide: "The scene.", cast: [chapter.lead] }],
    ...chapter,
  }));
  const beat: Beat = {
    key: chapter.key,
    i: 0,
    kind: "beat",
    places: [],
    segments: [{ speaker: "", text: line }],
    choices: [],
    choiceCanon: {},
    effects: {},
    applied: {},
    musicMood: "tense",
    readThrough: 0,
    written: { at: completedAt, connectionId: "conn-text", model: "fake" },
    rewrites: 0,
  };
  await t.store.mutateDoc(runDocTarget("beat", beatId(t.runId, chapter.key, 0)), normalizeBeat, () => beat);
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    chapters: { ...state.chapters, [chapter.key]: { beatsRead: 1, completed: completedAt, applied: [] } },
  }));
}

/** An arc covering main chapters 1–10, every hidden field marked. */
function arc(changes: Partial<StoryArc> = {}): StoryArc {
  return normalizeArc({
    version: 1,
    number: 1,
    kind: "story",
    label: "The Dark Quay",
    theme: "trust",
    goal: "ARC-GOAL: Ines learns who she can trust in the harbour.",
    from: 1,
    endsAt: 10,
    plan: Array.from({ length: 10 }, (_, i) => ({ n: i + 1, purpose: `PURPOSE-${i + 1}: a small step.` })),
    endsWith: { n: 10, what: "ENDS-WITH-SECRET: the harbour master falls." },
    reveals: [{ n: 3, kind: "piece", li: KAI, what: "REVEAL-SECRET: the north light." }],
    antagonist: { name: "ANTAGONIST-NAME", want: "ANTAGONIST-WANT", whyNow: "ANTAGONIST-WHY" },
    newcomer: { li: SOL, how: "NEWCOMER-HOW: Sol arrives by sea." },
    choice: { kind: "continue" },
    judgment: { question: "JUDGMENT-QUESTION?", answers: ["JUDGMENT-A", "JUDGMENT-B"], chapters: [5] },
    plannedAt: at,
    connectionId: "conn-text",
    ...changes,
  })!;
}

const systemOf = (messages: Messages) => messages.find((message) => message.content.includes('one "Tarot night"'))!;
const userOf = (messages: Messages) => messages.at(-1)!.content;

test("the draw takes the picked places of a fresh shuffle, each upright or reversed; picks are checked", () => {
  // A shuffle that swaps nothing leaves the Arcana in order: the picks name the cards, and every coin comes up 1.
  assert.deepEqual(
    drawCards([0, 6, 21], (max) => max - 1),
    [
      { card: "fool", reversed: true },
      { card: "lovers", reversed: true },
      { card: "world", reversed: true },
    ],
  );
  let seed = 11;
  const seeded = (max: number) => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed % max;
  };
  const drawn = drawCards([3, 9, 15], seeded);
  assert.equal(new Set(drawn.map((card) => card.card)).size, 3, "three different cards");
  assert.ok(drawn.every((card) => ARCANA.includes(card.card) && typeof card.reversed === "boolean"));
  // The crypto RNG: both orientations and many cards come up over forty draws.
  const many = Array.from({ length: 40 }, () => drawCards([1, 2, 3])[0]!);
  assert.equal(new Set(many.map((card) => card.reversed)).size, 2);
  assert.ok(new Set(many.map((card) => card.card)).size > 5);
  assert.deepEqual(checkPicks([21, 0, 4]), [21, 0, 4]);
  for (const bad of [
    [1, 1, 2],
    [0, 1, 22],
    [0, 1],
    [0, 1, 2, 3],
    [-1, 0, 1],
    [0.5, 1, 2],
  ]) {
    assert.throws(() => checkPicks(bad), /pick 3 different cards/u, JSON.stringify(bad));
  }
});

test("bad picks, an unknown mode and a question over its cap are a 400, with nothing written or asked", async () => {
  const t = await tarotWorld("r-tarot1-aaaaaa", model(reply()), { images: {} });
  for (const body of [
    { picks: [1, 1, 2] },
    { picks: [0, 1, 22] },
    { picks: [0, 1] },
    { picks: [0, 1, 2, 3] },
    { mode: "sideways" },
    { question: { own: "x".repeat(TAROT_QUESTION_MAX + 1) } },
    { question: { chip: "money" } },
  ]) {
    const response = await t.start(body);
    assert.deepEqual([response.status, response.body.code], [400, "bad-request"], JSON.stringify(body));
  }
  assert.equal((await t.start({ li: "li-nobody-zz99" })).status, 404);
  assert.equal(t.tarotCalls().length, 0);
  assert.equal((await t.readings()).length, 0);
  assert.equal(await t.deck(), null);
  // A question at its cap is fine.
  assert.equal((await t.start({ question: { own: "y".repeat(TAROT_QUESTION_MAX) } })).status, 200);
});

test("one reading per start: an unfinished one is returned as it is, and two starts together make one call", async () => {
  const t = await tarotWorld("r-tarot2-aaaaaa", model(reply("reads-you", "A"), reply("you-read", "B")));
  const [one, two] = await Promise.all([t.start({ question: { chip: "us" } }), t.start({ picks: [3, 4, 5] })]);
  assert.equal(one.status, 200, JSON.stringify(one.body));
  assert.equal(two.body.id, one.body.id);
  assert.equal(t.tarotCalls().length, 1);
  assert.equal((await t.readings()).length, 1);
  const view = one.body as TarotReadingView;
  assert.equal(view.mode, "reads-you");
  assert.deepEqual(view.question, { chip: "us" });
  assert.equal(view.cards.length, 3);
  assert.equal(view.context, "CONTEXT-A: Kai lays three cards on the sea wall.");
  assert.equal(view.cards[1]!.face, "", "an unknown face is a plain look");
  assert.equal(view.grants, null);
  // Whatever is asked for next, the open reading comes back with no call, and Tarot night opens straight at it.
  const again = await t.start({ mode: "you-read", picks: [9, 10, 11] });
  assert.deepEqual([again.body.id, again.body.mode], [view.id, "reads-you"]);
  assert.equal(t.tarotCalls().length, 1);
  const opened = await t.view();
  assert.equal(opened.status, 200);
  assert.equal(opened.body.open.id, view.id);
  // Another love interest gets a reading of their own.
  assert.notEqual((await t.start({ li: MIR })).body.id, view.id);
  assert.equal(t.tarotCalls().length, 2);
});

test("a failed call saves and claims nothing; a run deleted during the call keeps no reading and no deck", async () => {
  const cases: Array<[number, string, FakeReply[], boolean]> = [
    [502, "bad-format", model("not json at all"), true],
    [422, "declined", model(""), true],
    [503, "no-connection", model(reply()), false],
  ];
  for (const [index, [status, code, replies, connected]] of cases.entries()) {
    const t = await tarotWorld(`r-tarot3-aaaaa${index}`, replies, { images: {} });
    if (!connected) {
      await t.store.updateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
        ...world,
        connections: {},
      }));
    }
    const failed = await t.start();
    assert.deepEqual([failed.status, failed.body.code], [status, code]);
    assert.equal((await t.readings()).length, 0, code);
    assert.equal(await t.deck(), null, `${code}: no card claimed`);
    assert.equal(t.paid.length, 0);
  }

  const u = await tarotWorld("r-tarot3-bbbbbb", model(reply()), { images: {} });
  const held = holdModel(u);
  const starting = u.start();
  await held.waiting;
  await u.store.removeDoc(worldId(u.runId));
  held.release();
  const done = await starting;
  assert.deepEqual([done.status, done.body.code], [404, "not-found"]);
  assert.equal((await u.readings()).length, 0, "the late reading did not stay");
  assert.equal(await u.deck(), null, "and nothing was claimed");
  assert.equal(u.paid.length, 0);
  for (const kind of ["tarot", "deck"]) assert.ok((RUN_DOC_KINDS as readonly string[]).includes(kind), kind);
});

test("the prompt: the chat contract follows the Heat with nothing added, the boundary, the stored protagonist", async () => {
  const t = await tarotWorld("r-tarot4-aaaaaa", model(reply()), {
    personas: [{ id: "persona-ines", data: { name: "Ines", description: "PERSONA-REFRESHED: never read here." } }],
  });
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) =>
    withMireillesPrivateRows(state),
  );
  assert.equal((await t.start({ question: { own: "Will the lights hold?" } })).status, 200);
  const [call] = t.tarotCalls();
  const system = systemOf(call!.messages).content;
  const user = userOf(call!.messages);
  assert.ok(system.includes(forgeKnowledgeBoundary));
  assert.ok(system.includes("CONTENT CONTRACT") && system.includes("Heat: SFW"));
  assert.ok(system.includes("Kai is an adult"));
  assert.ok(system.includes("Write every field in English."));
  // The Tarot rules add no content rule of their own: the toggles decide.
  const rules = system.slice(system.indexOf("RULES\n"), system.indexOf("WRITING RULES"));
  assert.doesNotMatch(rules, /consent|non-graphic|safe for work|SFW|keep it clean/iu);
  assert.ok(user.includes("Ines (") && user.includes("Their own goal: Find out why the lights die."), "as stored");
  assert.ok(!JSON.stringify(call!.messages).includes("PERSONA-REFRESHED"), "no persona refresh");
  const sent = JSON.stringify(call!.messages);
  assert.ok(!sent.includes("HIDDEN-TRUTH") && !sent.includes("MYSTERY-TRUTH"), "never an unrevealed truth");
  assert.deepEqual(
    MIREILLE_ONLY.filter((marker) => sent.includes(marker)),
    [],
    "nothing of Mireille's own chapters",
  );
  for (const marker of KAI_SHARED) assert.ok(sent.includes(marker), `his own ${marker}`);
  assert.ok(t.logs.some((entry) => entry.level === "debugOverride" && entry.args[0] === `tarot/${KAI}`));

  const nsfw = await tarotWorld("r-tarot4-bbbbbb", model(reply()), {
    content: { ...defaultContent(), heat: "explicit" },
  });
  assert.equal((await nsfw.start()).status, 200);
  assert.match(systemOf(nsfw.tarotCalls()[0]!.messages).content, /Heat: NSFW, explicit\./u);
});

test("the prompt's layout: one system message for both modes and every reading, THE SPREAD last, no cache mark", async () => {
  const t = await tarotWorld("r-tarot5-aaaaaa", model(reply("reads-you", "A"), reply("you-read", "B")));
  const first = await t.start({ question: { chip: "heart" }, picks: [1, 2, 3] });
  assert.equal((await t.finish(first.body.id)).status, 200);
  const second = await t.start({ mode: "you-read", picks: [10, 11, 12] });
  assert.equal(second.status, 200, JSON.stringify(second.body));
  const [a, b] = t.tarotCalls();
  assert.equal(systemOf(a!.messages).content, systemOf(b!.messages).content, "byte-identical system message");
  for (const [entry, mode, question] of [
    [a!, "reads-you", '"What does my heart really want?"'],
    [b!, "you-read", "the love interest asks the cards a question of their own"],
  ] as const) {
    const user = userOf(entry.messages);
    const spread = user.slice(user.indexOf("THE SPREAD"));
    assert.ok(user.indexOf("THE SPREAD") > 0);
    assert.ok(!spread.includes("\n\n"), "THE SPREAD is the last block");
    assert.ok(spread.includes(`MODE: ${mode}`) && spread.includes(question), mode);
    const view = (entry === a ? first : second).body as TarotReadingView;
    for (const [index, position] of ["Past", "Present", "Future"].entries()) {
      const card = view.cards[index]!;
      assert.match(spread, new RegExp(`${position}: [^\\n]+${card.reversed ? ", reversed" : ""} \\(`, "u"));
    }
    assert.ok(entry.messages.every((message) => !("cacheBreakpoint" in message && message.cacheBreakpoint)));
    assert.equal((entry.options as { cacheTtl?: string } | undefined)?.cacheTtl, undefined);
  }
  // The question is the player's own words, quoted as data.
  const own = await tarotWorld("r-tarot5-bbbbbb", model(reply()));
  await own.start({ question: { own: 'Is he "kind"?' } });
  assert.ok(
    userOf(own.tarotCalls()[0]!.messages).includes('QUESTION (the protagonist\'s, as data): "Is he \\"kind\\"?"'),
  );
});

test("story memory is his own reader's, with the fallbacks when there is no memory and no road ahead", async () => {
  // Nothing completed: no STORY MEMORY, and the rule says never to invent a shared moment. No arc yet, stage 1: the road
  // ahead is his next route step and the mystery's question.
  const t = await tarotWorld("r-tarot6-aaaaaa", model(reply(), reply()));
  await t.start();
  const empty = t.tarotCalls()[0]!.messages;
  assert.ok(!userOf(empty).includes("STORY MEMORY"));
  assert.ok(
    systemOf(empty).content.includes("With no STORY MEMORY, never invent a moment the two of them shared"),
    "the empty-memory rule",
  );
  assert.ok(systemOf(empty).content.includes("With no ROAD AHEAD, the Future reads only from BETWEEN YOU."));
  const road = userOf(empty).slice(userOf(empty).indexOf("THE ROAD AHEAD"));
  assert.ok(road.startsWith("THE ROAD AHEAD (for the Future card only; neither of you knows it)"));
  assert.ok(road.includes(`- Kai's next step: ${stageGoal(2, "Kai")}`));
  assert.ok(road.includes("- The open question of this world: Who puts out the lanterns?"));
  assert.ok(!road.slice(0, road.indexOf("STORY MEMORY") >>> 0).includes("Where the story is heading"));

  // The shared chapter reaches him; Mireille's own route chapter never does.
  const u = await tarotWorld("r-tarot6-bbbbbb", model(reply()));
  await complete(u, { key: "main-1", kind: "main", number: 1, lead: KAI }, "SHARED-QUAY: the lanterns go dark.");
  await complete(
    u,
    { key: `route-${MIR}-2`, kind: "route", li: MIR, lead: MIR, title: "Mireille's Ledger" },
    "PRIVATE-LEDGER: Mireille shows Ines the forged pages.",
    "2026-10-28T11:00:00.000Z",
  );
  await u.start();
  const user = userOf(u.tarotCalls()[0]!.messages);
  const memory = user.slice(user.indexOf("STORY MEMORY"), user.indexOf("THE SPREAD"));
  assert.ok(memory.includes("SHARED-QUAY"), memory);
  assert.ok(!user.includes("PRIVATE-LEDGER") && !user.includes("Mireille's Ledger"), "his own reader's memory only");
  assert.ok(user.indexOf("THE ROAD AHEAD") < user.indexOf("STORY MEMORY"), "the stable parts first");
});

test("story memory's stable part goes first, then the recalls the question cues, then THE SPREAD", async () => {
  // A recall pool that answers to the question (its first cue), as the real one ranks by the cues.
  const memory = {
    recall: async (options: { query?: { cues?: string[] } }) => ({
      overview: "",
      details: [],
      text: "",
      maxContext: null,
      status: { phase: "ready" },
      lagging: false,
      recalls: [{ id: "recall-1", title: "Lanterns", content: `RECALL-FOR: ${options.query?.cues?.[0]}`, order: 0 }],
    }),
    maintain: async () => false,
  } as unknown as RouteDeps["memory"];
  const users: string[] = [];
  for (const [runKey, chip] of [
    ["r-tarotm-aaaaaa", "heart"],
    ["r-tarotm-bbbbbb", "us"],
  ] as const) {
    const t = await tarotWorld(runKey, model(reply()), { memory });
    await complete(t, { key: "main-1", kind: "main", number: 1, lead: KAI }, "SHARED-QUAY: the lanterns go dark.");
    assert.equal((await t.start({ question: { chip } })).status, 200);
    users.push(userOf(t.tarotCalls()[0]!.messages));
  }
  for (const user of users) {
    const previous = user.indexOf("# Previous chapter in full");
    const recalled = user.indexOf("# Recalled memory: Lanterns");
    assert.ok(user.indexOf("STORY MEMORY") < previous, user);
    assert.ok(previous > 0 && previous < recalled && recalled < user.indexOf("THE SPREAD"), user);
  }
  // Everything before the recalls is the same whatever the question, so a provider's prefix cache reuses it.
  const [a, b] = users.map((user) => user.indexOf("# Recalled memory"));
  assert.equal(users[0]!.slice(0, a), users[1]!.slice(0, b));
  assert.match(users[0]!.slice(a), /RECALL-FOR: What does my heart really want\?/u);
  assert.ok(!users[1]!.slice(b).includes("my heart"));
});

test("THE ROAD AHEAD: the covering arc's goal, the next two purposes and his next step, never what the arc hides", async () => {
  const t = await tarotWorld("r-tarot7-aaaaaa", model(reply()));
  await t.store.mutateDoc(runDocTarget("arc", arcId(t.runId, 1)), normalizeArc, () => arc());
  await complete(t, { key: "main-1", kind: "main", number: 1, lead: KAI }, "SHARED-QUAY: the lanterns go dark.");
  await t.start();
  const sent = JSON.stringify(t.tarotCalls()[0]!.messages);
  const user = userOf(t.tarotCalls()[0]!.messages);
  const road = user.slice(user.indexOf("THE ROAD AHEAD"), user.indexOf("STORY MEMORY"));
  for (const shown of [
    "Where the story is heading: ARC-GOAL",
    "What comes next in the story: PURPOSE-2",
    "What comes next in the story: PURPOSE-3",
    `Kai's next step: ${stageGoal(2, "Kai")}`,
    "Who puts out the lanterns?",
  ]) {
    assert.ok(road.includes(shown), shown);
  }
  for (const hidden of [
    "PURPOSE-4",
    "PURPOSE-1:",
    "REVEAL-SECRET",
    "ENDS-WITH-SECRET",
    "ANTAGONIST-NAME",
    "ANTAGONIST-WANT",
    "ANTAGONIST-WHY",
    "NEWCOMER-HOW",
    "JUDGMENT-QUESTION",
    "JUDGMENT-A",
    "MYSTERY-TRUTH",
  ]) {
    assert.ok(!sent.includes(hidden), `never ${hidden}`);
  }

  // Without a covering arc only his step and the question remain; at his last stage with no arc there is no road.
  const runId = t.runId;
  const state = (await t.state())!;
  const lines = (stage: number, arcs = false) =>
    roadAhead(
      { listRun: async (kind, id) => (arcs ? t.store.listRun(kind, id) : []) },
      runId,
      { state, world: { mystery: { question: "Who puts out the lanterns?", truth: "", pieces: {} } } },
      { name: "Kai" },
      { stage },
    );
  assert.deepEqual(await lines(1), [
    `- Kai's next step: ${stageGoal(2, "Kai")}`,
    "- The open question of this world: Who puts out the lanterns?",
  ]);
  assert.deepEqual(await lines(6), []);
  assert.equal((await lines(6, true)).length, 4, "the arc alone still gives a road at the last stage");

  // roadAhead is the only Tarot code that reads arcs.
  const tarot = readFileSync(join(server, "minigames/tarot.ts"), "utf8");
  const body = tarot.slice(
    tarot.indexOf("export async function roadAhead"),
    tarot.indexOf("// ── Start, answer, finish"),
  );
  assert.equal(tarot.split("listArcs(").length - 1, 1);
  assert.ok(body.includes("listArcs("));
  assert.equal(tarot.split("arcCovering(").length - 1, body.split("arcCovering(").length - 1);
  for (const file of ["art/tarot-deck.ts", "routes/tarot.ts", "screens"]) {
    if (file === "screens") continue;
    assert.doesNotMatch(readFileSync(join(server, file), "utf8"), /listArcs|arcId|normalizeArc|story-arc/u, file);
  }
  const header = readFileSync(join(server, "schemas/story-arc.ts"), "utf8").slice(0, 900);
  assert.ok(header.includes("only Tarot night's roadAhead"), "the arc document's header says who reads it");

  // A world with no road and no memory: the Future reads only what stands between them.
  const u = await tarotWorld("r-tarot7-bbbbbb", model(reply()));
  await u.store.updateDoc(runDocTarget("state", stateId(u.runId)), normalizeState, (current) => ({
    ...current,
    lis: { ...current.lis, [KAI]: { ...current.lis[KAI]!, stage: 6 } },
  }));
  await u.start();
  assert.ok(!userOf(u.tarotCalls()[0]!.messages).includes("THE ROAD AHEAD"));
});

test("the reply's checks: three cards, no empty or long field, three different readings per card in you-read", () => {
  assert.equal(TarotReplySchema.safeParse({ ...reply(), cards: reply().cards.slice(0, 2) }).success, false);
  const extra = reply("reads-you", "A", { cards: [...reply().cards, { line: "EXTRA", face: "" }] });
  const kept = checkTarotReply(extra, "reads-you");
  assert.ok(typeof kept !== "string");
  assert.equal(kept.cards.length, 3, "extra cards are dropped");
  assert.equal(kept.cards[1]!.face, "", "an unknown face is a plain look");
  const long = (words: number) => Array.from({ length: words }, () => "word").join(" ");
  for (const [bad, problem] of [
    [reply("reads-you", "A", { context: "  " }), /must not be empty/u],
    [reply("reads-you", "A", { context: long(61) }), /context must be 60 words/u],
    [reply("reads-you", "A", { opening: { line: long(41) } }), /opening.line must be 40 words/u],
    [reply("reads-you", "A", { closing: { line: long(51) } }), /closing.line must be 50 words/u],
    [
      { ...reply(), cards: reply().cards.map((card, i) => (i ? card : { ...card, line: long(61) })) },
      /line must be 60/u,
    ],
    [{ ...reply(), cards: reply().cards.map((card, i) => (i ? card : { ...card, line: "" })) }, /must not be empty/u],
  ] as const) {
    assert.match(String(checkTarotReply(bad as TarotReply, "reads-you")), problem);
  }
  const yours = reply("you-read");
  assert.ok(typeof checkTarotReply(yours, "you-read") !== "string");
  const withReadings = (readings: Array<{ text: string; reaction: string }>) => ({
    ...yours,
    cards: yours.cards.map((card, i) => (i === 2 ? { ...card, readings } : card)),
  });
  const choice = (text: string, reaction = "Do I?") => ({ text, reaction });
  assert.match(
    String(checkTarotReply(withReadings([choice("A"), choice("B")]), "you-read")),
    /cards\[2\]\.readings must hold exactly 3/u,
  );
  assert.match(
    String(checkTarotReply(withReadings([choice("Same"), choice("same"), choice("C")]), "you-read")),
    /every reading must be different/u,
  );
  assert.match(
    String(checkTarotReply(withReadings([choice(long(31)), choice("B"), choice("C")]), "you-read")),
    /readings\[0\]\.text must be 30 words/u,
  );
  assert.match(
    String(checkTarotReply(withReadings([choice("A", long(41)), choice("B"), choice("C")]), "you-read")),
    /readings\[0\]\.reaction must be 40 words/u,
  );
  assert.match(String(checkTarotReply(reply("reads-you"), "you-read")), /readings must hold exactly 3/u);
});

test("you-read: no reaction before its card is answered, the first answer is final; reads-you takes no answer", async () => {
  const t = await tarotWorld("r-tarot8-aaaaaa", model(reply("you-read"), reply("reads-you", "R")));
  const started = await t.start({ mode: "you-read", question: { chip: "us" } });
  const view = started.body as TarotReadingView;
  assert.equal(view.question, null, "in you-read the love interest asks");
  assert.deepEqual(view.cards[0]!.readings, [
    "READING-A00: You hide it well.",
    "READING-A01: You hide it well.",
    "READING-A02: You hide it well.",
  ]);
  assert.ok(!JSON.stringify(started.body).includes("REACTION-"), "no reaction before an answer");
  assert.ok(!JSON.stringify((await t.view()).body).includes("REACTION-"));
  const first = await t.answer(view.id, 0, 1);
  assert.deepEqual(first.body, {
    pick: 1,
    reading: "READING-A01: You hide it well.",
    reaction: "REACTION-A01: Do I?",
    face: "flustered",
  });
  const version = t.store.version();
  assert.deepEqual((await t.answer(view.id, 0, 2)).body, first.body, "the first answer is final");
  assert.equal(t.store.version(), version, "an answer sent again writes nothing");
  const reopened = (await t.view()).body.open as TarotReadingView;
  assert.deepEqual(reopened.cards[0]!.answer, first.body);
  assert.ok(!JSON.stringify(reopened).includes("REACTION-A1"), "only the answered card's reaction");
  for (const [card, pick] of [
    [3, 0],
    [0, 3],
    [-1, 0],
  ]) {
    assert.equal((await t.answer(view.id, card!, pick!)).status, 400, `${card}/${pick}`);
  }
  assert.equal((await t.call("POST", ANSWER, { card: 0, pick: 0 }, { reading: "tr-nope" })).status, 404);

  const r = await tarotWorld("r-tarot8-bbbbbb", model(reply("reads-you", "R")));
  const readsYou = (await r.start()).body as TarotReadingView;
  const refused = await r.answer(readsYou.id, 0, 0);
  assert.deepEqual([refused.status, refused.body.code], [400, "bad-request"]);
});

test("finish pays once within the shared caps, writes the first Tarot night once, and queues memory upkeep once", async () => {
  const t = await tarotWorld("r-tarot9-aaaaaa", model(reply("you-read", "A"), reply("reads-you", "B")));
  const view = (await t.start({ mode: "you-read" })).body as TarotReadingView;
  const early = await t.finish(view.id);
  assert.deepEqual([early.status, early.body.code], [409, "conflict"]);
  for (const card of [0, 1, 2]) assert.equal((await t.answer(view.id, card, card)).status, 200);
  const before = (await t.state()).wallet.starlight;
  let maintained = 0;
  const memory = { recall: async () => assert.fail("no recall"), maintain: async () => void (maintained += 1) };
  const finished = await finishTarot({ store: t.store, memory: memory as never }, t.runId, view.id, {
    debugMode: false,
  });
  assert.deepEqual(finished.grants, [
    { source: "tarot", starlight: 40 },
    { source: "tarot", li: KAI, affection: 40 },
  ]);
  assert.equal(finished.starlight, before + 40);
  const replay = await finishTarot({ store: t.store, memory: memory as never }, t.runId, view.id, {
    debugMode: false,
  });
  assert.deepEqual(replay, finished, "a finish sent again returns what was paid");
  assert.equal(maintained, 1, "memory upkeep is queued once");
  // A finish whose state write landed but whose mark on the reading did not: the next one writes only that mark.
  await t.store.updateDoc(tarotTarget(t.runId, view.id), normalizeReading, (current) => ({
    ...current!,
    finished: null,
  }));
  const marked = t.store.version();
  const recovered = await finishTarot({ store: t.store, memory: memory as never }, t.runId, view.id, {
    debugMode: false,
  });
  assert.deepEqual(recovered.grants, finished.grants, "nothing paid again");
  assert.equal(t.store.version(), marked + 1, "the state is not written again");
  assert.equal(maintained, 2, "the reading is new canon once it is marked");
  const state = await t.state();
  assert.equal(state.wallet.starlight, before + 40);
  assert.equal(state.lis[KAI]!.points, 40);
  assert.equal(state.daily.starlight, 40);
  assert.ok(state.lis[KAI]!.firsts.tarot);
  assert.deepEqual(
    state.timeline.filter((entry) => entry.kind === "first-tarot"),
    [
      {
        at: state.lis[KAI]!.firsts.tarot!,
        li: KAI,
        kind: "first-tarot",
        text: "CONTEXT-A: Kai lays three cards on the sea wall.",
        ref: view.id,
      },
    ],
  );
  assert.equal(state.tarot.paid.length, 1);
  assert.equal((await t.view()).body.open, null);
  // Nothing in a reading moves trust, tension or a grievance.
  assert.deepEqual([state.lis[KAI]!.trust, state.lis[KAI]!.tension, state.lis[KAI]!.grievances.length], [0, 0, 0]);

  // A second reading pays again (a reads-you one finishes at once) but writes no second first.
  const next = (await t.start()).body as TarotReadingView;
  const paid = await t.finish(next.id);
  assert.equal(paid.status, 200);
  assert.equal(paid.body.grants.length, 2);
  const after = await t.state();
  assert.equal(after.timeline.filter((entry) => entry.kind === "first-tarot").length, 1);
  assert.equal(after.lis[KAI]!.firsts.tarot, state.lis[KAI]!.firsts.tarot);
});

test("a finished reading is a private chat source: its own love interest recalls it, no other does", async () => {
  const t = await tarotWorld("r-tarota-aaaaaa", model(reply("you-read"), reply("reads-you", "Z")));
  const view = (await t.start({ mode: "you-read" })).body as TarotReadingView;
  for (const card of [0, 1, 2]) await t.answer(view.id, card, 2);
  assert.ok(!JSON.stringify(await readMemorySources(t.store, t.runId)).includes("Tarot night"), "unfinished: none");
  assert.equal((await t.finish(view.id)).status, 200);
  const sources = await readMemorySources(t.store, t.runId);
  const source = sources.find((entry) => entry.id === `tarot-${view.id}`);
  assert.ok(source, "a source");
  assert.equal(source.kind, "chat");
  assert.deepEqual(source.audience, [KAI]);
  assert.match(source.title, /Tarot night with Kai \(private: only Kai and the protagonist know/u);
  for (const part of [
    'Ines read Kai\'s tarot cards. Kai asked the cards: "OPENING-A: Ask them, then."',
    "- Past: ",
    "- Present: ",
    "- Future: ",
    'Ines read it: "READING-A02: You hide it well." Kai: "REACTION-A02: Do I?"',
    'Kai closed: "CLOSING-A: That is your answer."',
  ]) {
    assert.ok(source.content.includes(part), part);
  }
  const cardName = (index: number) => {
    const meaning = view.cards[index]!;
    return `${meaning.reversed ? ", reversed" : ""}. Kai: "CARD-A${index}`;
  };
  for (const index of [0, 1, 2]) assert.ok(source.content.includes(cardName(index)), source.content);

  // Recalled only by his own readers and scenes he is in.
  const memory = createOtomeMemory({ runtime: t.runtime, store: t.store });
  try {
    for (const [who, sees] of [
      [{ reader: KAI }, true],
      [{ cast: [KAI, MIR] }, true],
      [{ reader: MIR }, false],
      [{ cast: [MIR] }, false],
      [{}, false],
    ] as const) {
      const result = await memory.recall({ runId: t.runId, job: "narration", query: { cues: ["tarot"] }, ...who });
      const recalled = (result.recalls ?? []).map((item) => item.content).join("\n");
      assert.equal(recalled.includes("READING-A02"), sees, JSON.stringify(who));
      assert.ok(!result.overview.includes("READING-A02"), "never in the overview");
    }
  } finally {
    memory.dispose();
  }

  // A love interest the run no longer has leaves no source.
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => {
    const { [KAI]: _gone, ...lis } = state.lis;
    return { ...state, lis };
  });
  assert.ok(!(await readMemorySources(t.store, t.runId)).some((entry) => entry.id.startsWith("tarot-")));
});

test("the deck: his cards are cast for him, the rest once per story; each card is claimed once and painted once", async () => {
  const t = await tarotWorld("r-tarotb-aaaaaa", model(reply()), { images: {} });
  const claim = (li: string, cards: Parameters<typeof claimDeckCards>[3], review = false) =>
    claimDeckCards(t.deps, t.runId, li, cards, { debugMode: false, review });
  assert.deepEqual((await claim(KAI, ["lovers", "fool"])).sort(), ["fool", `lovers@${KAI}`]);
  assert.deepEqual(await claim(MIR, ["lovers", "fool"]), [`lovers@${MIR}`], "his own Lovers; the Fool is shared");
  await until(async () => t.paid.length === 3, "three paints");
  await until(
    async () => Object.values((await t.deck())!.cards).every((entry) => entry.art.state === "ready"),
    "every card ready",
  );
  const deck = (await t.deck())!;
  assert.deepEqual(Object.keys(deck.cards).sort(), ["fool", `lovers@${KAI}`, `lovers@${MIR}`]);
  assert.equal(deck.cards[`lovers@${KAI}`]!.li, KAI);
  assert.equal(deck.cards.fool!.li, undefined);
  assert.deepEqual(await claim(SOL, ["fool"]), [], "a cast card is never claimed again");
  // Two readings drawing the same card at once claim it once.
  const both = await Promise.all([claim(KAI, ["star"]), claim(MIR, ["star"])]);
  assert.deepEqual(both.flat(), ["star"]);
  await until(async () => t.paid.length === 4, "the star painted once");
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(t.paid.length, 4);

  // A start claims exactly the cards it drew.
  const view = (await t.start({ li: SOL })).body as TarotReadingView;
  const keys = view.cards.map((card) => deckKey(card.card, SOL));
  await until(async () => keys.every((key) => (async () => !!(await t.deck())!.cards[key])()), "the drawn cards");
  const shown = (await t.view(SOL)).body.deck as Record<string, { card: string; art: { state: string } }>;
  for (const key of keys) assert.ok(shown[key], key);
  assert.ok(!shown[`lovers@${KAI}`] && !shown[`lovers@${MIR}`], "another love interest's own card is not his");
  assert.ok(shown.fool, "a shared card is everyone's");
});

test("the deck waits under Ask or prompt review, and claims nothing without an image connection", async () => {
  const ask = await tarotWorld("r-tarotc-aaaaaa", model(reply()), { images: { ask: true } });
  await claimDeckCards(ask.deps, ask.runId, KAI, ["emperor"], { debugMode: false });
  const review = await tarotWorld("r-tarotc-bbbbbb", model(reply()), { images: {} });
  const started = await review.start({ reviewImagePrompts: true });
  await new Promise((resolve) => setTimeout(resolve, 20));
  for (const t of [ask, review]) {
    const entries = Object.values((await t.deck())!.cards);
    assert.ok(entries.length > 0);
    assert.ok(entries.every((entry) => entry.art.state === "waiting-consent"));
    assert.equal(t.paid.length, 0, "nothing paid before the tap");
  }
  assert.equal(started.status, 200);
  const none = await tarotWorld("r-tarotc-cccccc", model(reply()));
  assert.equal((await none.start()).status, 200);
  assert.deepEqual(await claimDeckCards(none.deps, none.runId, KAI, ["sun"], { debugMode: false }), []);
  assert.equal(await none.deck(), null, "no image connection: no claim");
});

test("a card's tap pays once, a failure waits for Retry, a ready card stays, a card never drawn is locked", async () => {
  let fail = true;
  const t = await tarotWorld("r-tarotd-aaaaaa", model(reply()), {
    images: { ask: true },
    before: () => {
      if (fail) {
        fail = false;
        throw new Error("The provider refused the image.");
      }
    },
  });
  await claimDeckCards(t.deps, t.runId, KAI, ["hermit"], { debugMode: false });
  const failed = await t.call("POST", ART, { li: KAI, card: "hermit" });
  assert.equal(failed.status, 200, JSON.stringify(failed.body));
  assert.equal(failed.body.art.state, "failed");
  assert.match(failed.body.art.error, /refused/u);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(t.paid.length, 1, "a failure is never retried by itself");
  const [one, two] = await Promise.all([
    t.call("POST", ART, { li: KAI, card: "hermit" }),
    t.call("POST", ART, { li: KAI, card: "hermit" }),
  ]);
  assert.equal(t.paid.length, 2, "a double tap pays once");
  assert.equal(one.body.art.state, "ready");
  assert.deepEqual(two.body.art, one.body.art);
  assert.deepEqual((await t.call("POST", ART, { li: KAI, card: "hermit" })).body.art, one.body.art, "kept");
  assert.equal(t.paid.length, 2);
  for (const [li, card] of [
    [SOL, "hermit"],
    [KAI, "magician"],
  ]) {
    const locked = await t.call("POST", ART, { li, card });
    assert.deepEqual([locked.status, locked.body.code], [409, "locked"], `${li} ${card}`);
  }
  assert.equal((await t.call("POST", ART, { li: KAI, card: "not-a-card" })).status, 400);
  const prompt = await t.call("POST", `${ART}/prompt`, { li: KAI, card: "hermit" });
  assert.equal(prompt.status, 200);
  assert.match(prompt.body.negativePrompt, /border/u);
});

test("a card's picture: a CG's size, by id and role, clothed at most, no lettering; a card of nobody is scenery", async () => {
  const t = await tarotWorld("r-tarote-aaaaaa", model(reply()), {
    images: {},
    content: { ...defaultContent(), heat: "explicit" },
  });
  await setImages(t.store, t.runId, { connectionId: "conn-image", rating: "explicit" });
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    portrait: "/api/global-gallery/file/kai.png",
    bible: { ...unit.bible!, look: { ...unit.bible!.look, presentation: "man" } },
  }));
  await claimDeckCards(t.deps, t.runId, KAI, ["lovers", "tower", "star"], { debugMode: false });
  await until(async () => t.paid.length === 3, "three paints");
  const byName = (pattern: RegExp) => t.paid.find((call) => pattern.test(call.request.prompt))!;
  const lovers = byName(/beneath a radiant sun with wings of light/u);
  const tower = byName(/struck by lightning/u);
  const star = byName(/one great star and seven small ones/u);
  for (const call of [lovers, tower, star]) {
    assert.deepEqual([call.request.width, call.request.height], [SCENE_SIZE.width, SCENE_SIZE.height]);
    assert.match(call.request.negativePrompt, /\btext\b.*\bletters\b.*\bnumbers\b|letters/u);
    assert.match(call.request.negativePrompt, /\bborder\b/u);
    assert.match(call.request.negativePrompt, /\bframe\b/u);
    assert.doesNotMatch(call.request.prompt, /\bborder\b|\bframe\b|lettering/u);
    assert.match(call.request.prompt, /full-bleed/u);
  }
  // The two of them, by id and role: his likeness first, then hers.
  assert.equal(lovers.method, "generateBannerArt");
  assert.deepEqual(
    lovers.request.units!.map((unit) => [unit.who, unit.personaId ?? unit.portrait]),
    [
      ["Kai", "/api/global-gallery/file/kai.png"],
      ["Ines", "persona-ines"],
    ],
  );
  assert.match(lovers.request.prompt, /\bclothed\b/u, "kept outside the story: clothed, at most Suggestive");
  assert.match(lovers.request.prompt, /adult man/u);
  assert.match(lovers.request.negativePrompt, /nudity, explicit sexual activity/u);
  assert.equal(star.method, "generateBannerArt");
  assert.deepEqual(
    star.request.units!.map((unit) => unit.personaId),
    ["persona-ines"],
    "the protagonist alone",
  );
  // Nobody in it: a place's rules.
  assert.equal(tower.method, "generateImage");
  assert.match(tower.request.prompt, /scenery, no humans/u);
  assert.match(tower.request.negativePrompt, /\bpeople\b/u);

  // The briefs: classical iconography with no gender words, one per card; a card of nobody shows nobody.
  const gendered =
    /\b(he|she|his|her|hers|him|man|men|woman|women|king|queen|lady|lord|girl|boy|maiden|priestess|empress|emperor|male|female|mother|father)\b/iu;
  for (const card of ARCANA) {
    assert.ok(ARCANA_BRIEFS[card], card);
    assert.doesNotMatch(ARCANA_BRIEFS[card], gendered, card);
    if (ARCANA_FIGURES[card] === "none") assert.doesNotMatch(ARCANA_BRIEFS[card], /\b(figure|people|person)\b/u, card);
    if (ARCANA_FIGURES[card] === "both") assert.match(ARCANA_BRIEFS[card], /\btwo people\b/u, card);
  }
  assert.deepEqual(
    Object.values(ARCANA_FIGURES).reduce<Record<string, number>>((counts, figure) => {
      counts[figure] = (counts[figure] ?? 0) + 1;
      return counts;
    }, {}),
    { you: 7, him: 7, both: 4, none: 4 },
  );
});

test("GET shows the deck's paint for this love interest's cards after the reading is finished", async () => {
  const t = await tarotWorld("r-tarotf-aaaaaa", model(reply()), { images: { ask: true } });
  const view = (await t.start()).body as TarotReadingView;
  assert.equal((await t.finish(view.id)).status, 200);
  const card = view.cards[0]!.card;
  const key = deckKey(card, KAI);
  assert.equal((await t.view()).body.deck[key].art.state, "waiting-consent");
  assert.equal((await t.call("POST", ART, { li: KAI, card })).body.art.state, "ready");
  const after = (await t.view()).body;
  assert.equal(after.open, null);
  assert.equal(after.deck[key].art.state, "ready");
  assert.match(after.deck[key].art.url, /^\/api\/global-gallery\/file\//u);
});

test("the client's deck: one distinct emblem per card, the numerals, and every card name in the catalog", () => {
  assert.deepEqual(Object.keys(TAROT_EMBLEMS).sort(), [...ARCANA].sort());
  const paths = Object.values(TAROT_EMBLEMS);
  assert.equal(new Set(paths).size, paths.length, "no two cards share an emblem");
  assert.ok(paths.every((path) => /^M[\d.\s-]/u.test(path) && !/NaN|undefined/u.test(path)));
  assert.ok(paths.join("").length < 16_000, "small enough to ship in the bundle");
  assert.deepEqual([0, 1, 4, 9, 14, 19, 21].map(arcanaNumeral), ["0", "I", "IV", "IX", "XIV", "XIX", "XXI"]);
  const catalog = JSON.parse(readFileSync(join(client, "locales/en.json"), "utf8")) as Record<string, string>;
  const card = readFileSync(join(client, "components/TarotCard.tsx"), "utf8");
  const names = [...card.matchAll(/^ {2}"?([a-z-]+)"?: "(ui\.otomeForge\.tarot\.card[A-Za-z]+)",$/gmu)];
  assert.deepEqual(names.map((match) => match[1]).sort(), [...ARCANA].sort(), "a literal key for each card");
  for (const [, , key] of names) assert.ok(catalog[key!], key);
  // The reduced-motion rules stop every animation and transition, the flip, the hover lift and the crossfade among them.
  const night = readFileSync(join(client, "screens/dates/TarotNight.tsx"), "utf8");
  for (const rule of ["transition: transform 400ms", "translateY(-4px)", "animation: of-fade-in"]) {
    assert.ok(night.includes(rule), rule);
  }
  const styles = readFileSync(join(client, "theme/styles.ts"), "utf8");
  assert.match(styles, /TAROT_RULES,\n\s+CLAW_RULES/u);
  assert.match(styles, /animation: none !important; transition: none !important;/u);
});
