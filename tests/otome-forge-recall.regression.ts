// Otome Hearth's long-term recall (0.19.0, S/memory/recall-index.ts, S/story/canon.ts recallText): each chapter's
// original summary is indexed by meaning in the background (pieces of about 180 words, best piece scores, the Engine's
// caps per embed call, a fingerprint per summary and the model's spaceId), when a story opens, after memory upkeep and
// when the Memory recall embeddings change (checked on save). A main chapter's plan chooses up to three earlier chapters
// the condensed head holds, that every scene of it may know, at least RECALL_MIN_SIMILARITY alike, and saves them; each
// of its scenes sends exactly those, between the head and the newest entries, so its cached story context stays the
// same. No embeddings: the prompt is as before. A failed index waits for Retry indexing; no prompt ever carries the
// index; a deleted story keeps none.
import {
  embeddingOptions,
  embeddingsChoosable,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/lib/recall-choice.ts";
import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityEmbeddingHost, CapabilityLanguageModelMessage } from "@marinara-engine/shared";
import type {
  Beat,
  Chapter,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import { createBackgroundQueue } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/background-queue.ts";
import {
  RUN_DOC_KINDS,
  beatId,
  chapterId,
  recallId,
  runDocTarget,
  stateId,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { createOtomeMemory } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/memory.ts";
import { readMemorySources } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/sources.ts";
import {
  EMBED_CHARACTERS_MAX,
  EMBED_TEXTS_MAX,
  LOCAL_LANE,
  RECALL_CHUNK_WORDS,
  RECALL_MIN_SIMILARITY,
  chapterScore,
  createRecallIndex,
  normalizeRecallIndex,
  recallChunks,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/recall-index.ts";
import { registerMemoryRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/memory.ts";
import { registerRunRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/runs.ts";
import { normalizeState } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import {
  normalizeBeat,
  normalizeChapter,
  toChapterView,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { recallText } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/canon.ts";
import { routesOf } from "./fixtures/otome-forge-art.ts";
import { createFakeEmbedder } from "./fixtures/otome-forge-fakes.ts";
import {
  KAI,
  MIR,
  SOL,
  beatReply,
  json,
  planReply,
  saveStoryMemory,
  storyWorld,
} from "./fixtures/otome-forge-story.ts";

type World = Awaited<ReturnType<typeof storyWorld>>;

/** The topics the fake topic embedder sees; any other word only counts when a text names none of them. */
const TOPICS = ["lighthouse", "ledger", "festival", "storm", "bell"];
/** A vector of how often a text names each topic, so similarities are exact: one shared topic of two is 0.707. */
function topicVector(text: string): number[] {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const counts = TOPICS.map((topic) => words.filter((word) => word === topic).length);
  return [...counts, counts.some(Boolean) ? 0 : 1];
}

const keyOf = (id: string, kind = "chapter") => JSON.stringify([kind, id]);
const HEAD = "HEAD: the harbour's first nights, condensed.";
/** How the story names Mireille's route chapter "Her First" (S/story/canon.ts titleOf). */
const HER_FIRST =
  'Mireille\'s own route chapter "Her First" (private: only the people in its scenes know what happened in it)';

/** A chapter of one node, completed at `completed`, with `text` as its one line. */
async function complete(
  t: World,
  changes: Partial<Chapter> & Pick<Chapter, "key" | "kind" | "lead" | "title">,
  text: string,
  completed: string,
) {
  const chapter: Chapter = {
    tags: [],
    summary: "",
    nodes: [{ i: 0, kind: "beat", guide: "The scene.", cast: [changes.lead] }],
    ledger: { relationship: [], conflict: [], offscreen: [] },
    plannedAt: completed,
    connectionId: "conn-text",
    ...changes,
  };
  await t.store.mutateDoc(runDocTarget("chapter", chapterId(t.runId, chapter.key)), normalizeChapter, () => chapter);
  const beat: Beat = {
    key: chapter.key,
    i: 0,
    kind: "beat",
    places: [],
    segments: [{ speaker: "", text }],
    choices: [],
    choiceCanon: {},
    effects: {},
    applied: {},
    musicMood: "tense",
    readThrough: 0,
    written: { at: completed, connectionId: "conn-text", model: "fake" },
    rewrites: 0,
  };
  await t.store.mutateDoc(runDocTarget("beat", beatId(t.runId, chapter.key, 0)), normalizeBeat, () => beat);
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    chapters: { ...state.chapters, [chapter.key]: { beatsRead: 1, completed, applied: [] } },
  }));
}

/** Each main chapter's summary in the harbour story: topics chosen so a lighthouse query scores 1, .71, .58, .5. */
const SUMMARIES: Record<string, string> = {
  [keyOf("main-1")]: "NIGHT-ONE-SUMMARY: the lighthouse keeper hides the brass key.",
  [keyOf("main-2")]: "NIGHT-TWO-SUMMARY: the lighthouse ledger goes missing.",
  [keyOf("main-3")]: "NIGHT-THREE-SUMMARY: lighthouse ledger festival on the pier.",
  [keyOf("main-4")]: "NIGHT-FOUR-SUMMARY: lighthouse ledger festival storm at once.",
  [keyOf(`route-${MIR}-2`)]: "HER-FIRST-SUMMARY: the lighthouse from her archive window.",
  [keyOf("date-1", "character-story")]: "KAI-DATE-SUMMARY: the lighthouse at dusk.",
  [keyOf("main-5")]: "NIGHT-FIVE-SUMMARY: the lighthouse goes dark.",
  [keyOf("main-6")]: "NIGHT-SIX-SUMMARY: the lighthouse is lit again.",
  [keyOf(`side-${KAI}-1`)]: "KAI-SIDE-SUMMARY: the lighthouse, as he saw it.",
};
/** His side of Night 6 (#2155), as the story names it (S/story/canon.ts titleOf). */
const KAI_SIDE = 'Kai\'s side of "Night 6"';

/**
 * The harbour story: six main chapters, Mireille's route chapter, Kai's date and his side of Night 6 done. The
 * timeline's head condensed Nights 1–4, her chapter, his date and his side; Night 5 and Night 6 are its entries, and
 * Night 6 is the previous chapter.
 */
async function harbour(
  runKey: string,
  {
    embedder = createFakeEmbedder({ vectorOf: topicVector }),
    older = false,
    thoughts = "lighthouse",
    modes,
  }: {
    embedder?: ReturnType<typeof createFakeEmbedder>;
    older?: boolean;
    thoughts?: string;
    modes?: string[];
  } = {},
) {
  const t = await storyWorld({
    runKey,
    replies: router(),
    model: {
      ...(older
        ? { embeddings: embedder.host }
        : { embeddingsFor: async (id: string | null) => (id === null ? embedder.host : null) }),
      ...(modes
        ? {
            admissionRun: <T>(operation: () => Promise<T>, mode: { kind: string }) => {
              modes.push(mode.kind);
              return operation();
            },
          }
        : {}),
    },
  });
  const hour = (h: number) => `2026-10-28T${String(h).padStart(2, "0")}:00:00.000Z`;
  for (const n of [1, 2, 3, 4]) {
    await complete(
      t,
      { key: `main-${n}`, kind: "main", number: n, lead: KAI, title: `Night ${n}` },
      `NIGHT-${n}`,
      hour(n),
    );
  }
  await complete(
    t,
    { key: `route-${MIR}-2`, kind: "route", li: MIR, lead: MIR, stage: 2, title: "Her First" },
    "HERS",
    hour(4).replace(":00:00", ":30:00"),
  );
  await complete(
    t,
    { key: "date-1", kind: "date", li: KAI, lead: KAI, title: "Jellyfish Hour" },
    "DATE",
    hour(4).replace(":00:00", ":40:00"),
  );
  await complete(t, { key: "main-5", kind: "main", number: 5, lead: KAI, title: "Night 5" }, "NIGHT-5", hour(5));
  await complete(
    t,
    { key: "main-6", kind: "main", number: 6, lead: KAI, title: "Night 6" },
    "NIGHT-6: the quay at last light.",
    hour(6),
  );
  const side = {
    arc: 1,
    ref: "main-6/0",
    moment: "truth" as const,
    stage: 2,
    trust: 1,
    tension: 0,
    open: [],
    rupture: null,
    at: hour(6),
  };
  await complete(
    t,
    { key: `side-${KAI}-1`, kind: "story", li: KAI, lead: KAI, title: "Night 6", hisSide: side },
    "HIS-SIDE",
    hour(6).replace(":00:00", ":30:00"),
  );
  await saveStoryMemory(t.store, t.runId, {
    head: HEAD,
    entries: [
      { key: keyOf("main-5"), title: "Night 5", text: "ENTRY-FIVE: the dark." },
      { key: keyOf("main-6"), title: "Night 6", text: "ENTRY-SIX: lit again." },
    ],
    covered: ["main-1", "main-2", "main-3", "main-4", `route-${MIR}-2`, `side-${KAI}-1`]
      .map((id) => keyOf(id))
      .concat(keyOf("date-1", "character-story")),
    summaries: SUMMARIES,
  });
  if (thoughts) {
    await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
      ...state,
      thoughts: { text: thoughts, at: hour(7) },
    }));
  }
  const background = createBackgroundQueue(t.runtime);
  const recall = createRecallIndex({ runtime: t.runtime, store: t.store, background });
  t.deps.recall = recall;
  return { ...t, embedder, recall, background };
}

/** Waits for the story's indexing, queued in the background by a request just made, to end; its status then. */
async function settled(recall: ReturnType<typeof createRecallIndex>, runId: string) {
  for (let turn = 0; turn < 50; turn += 1) await new Promise((resolve) => setImmediate(resolve));
  for (let turn = 0; turn < 4000 && (await recall.status(runId)).phase === "indexing"; turn += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  return recall.status(runId);
}

/** A story prompt's system messages: the shared story context, then its own instructions (#2066). */
const system = (messages: CapabilityLanguageModelMessage[]) =>
  messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
const isPlanner = (messages: CapabilityLanguageModelMessage[]) =>
  system(messages).includes("chapter planner") && !system(messages).startsWith("You are the arc planner");
const isScene = (messages: CapabilityLanguageModelMessage[]) => /Narrate node \d+ of/u.test(messages.at(-1)!.content);
/** Answers the chapter planner with planReply and every narrator with beatReply. */
const router = () =>
  Array.from(
    { length: 40 },
    () => (messages: CapabilityLanguageModelMessage[]) => json(isPlanner(messages) ? planReply() : beatReply()),
  );

/** The part of a prompt long-term recall shapes: from the timeline to the previous chapter in full. */
function storyPart(messages: CapabilityLanguageModelMessage[]): string {
  const text = messages.map((message) => message.content).join("\n\n");
  const from = text.indexOf("# Canon to date\n");
  const to = text.indexOf("# Previous chapter in full");
  assert.ok(from >= 0 && to > from, text.slice(0, 2000));
  return text.slice(from, to);
}

const words = (n: number, word = (k: number) => `w${k}`) => Array.from({ length: n }, (_, k) => word(k)).join(" ");

test("a summary is embedded in pieces of about 180 words, any language, and a chapter scores its best piece", () => {
  assert.deepEqual(recallChunks("   "), []);
  assert.deepEqual(recallChunks("One short summary."), ["One short summary."]);
  const long = recallChunks(words(400));
  assert.equal(long.length, 3, "400 words: three pieces");
  for (const piece of long) assert.ok(piece.split(" ").length <= RECALL_CHUNK_WORDS && piece.split(" ").length >= 130);
  assert.equal(long.join(" "), words(400), "every word once, in order");
  // A language written without spaces is cut at its words too, never sent whole.
  const japanese = "灯台の守り人は真鍮の鍵を隠した。".repeat(40);
  const pieces = recallChunks(japanese);
  assert.ok(pieces.length > 1, `${pieces.length} pieces`);
  assert.equal(pieces.join(""), japanese);
  // The best piece's similarity; a piece of another model's size is passed over.
  const unit = (values: number[]) => Float32Array.from(values, (v) => v / Math.hypot(...values));
  const query = unit([1, 0, 0]);
  assert.equal(chapterScore(query, [unit([0, 1, 0]), unit([1, 0, 0]), unit([0, 0, 1])]), 1);
  assert.ok(Math.abs(chapterScore(query, [unit([1, 1, 0]), unit([0, 1, 1])]) - Math.SQRT1_2) < 1e-6);
  assert.equal(chapterScore(query, [unit([1, 0])]), -1);
});

test("indexing respects the Engine's caps per call, re-embeds a rewritten summary only, and rebuilds for another model", async () => {
  const embedder = createFakeEmbedder({ vectorOf: topicVector });
  let host: CapabilityEmbeddingHost = embedder.host;
  const t = await storyWorld({
    runKey: "r-recallcap-aaaaaa",
    model: { embeddingsFor: async (id) => (id === null ? host : null) },
  });
  // 30 summaries of 900 long words: 150 pieces of some 2.9k characters, past both caps for one call.
  const summaries = Object.fromEntries(
    Array.from({ length: 30 }, (_, n) => [keyOf(`main-${n + 1}`), words(900, (k) => `chapter${n}word${k}`)]),
  );
  await saveStoryMemory(t.store, t.runId, { summaries });
  const recall = createRecallIndex({
    runtime: t.runtime,
    store: t.store,
    background: createBackgroundQueue(t.runtime),
  });
  assert.equal(await recall.ensure(t.runId), true);
  const ready = await settled(recall, t.runId);
  assert.deepEqual({ ...ready, choosable: true }, { phase: "ready", indexed: 30, total: 30, choosable: true });
  assert.ok(embedder.calls.length >= 2, `${embedder.calls.length} calls`);
  for (const call of embedder.calls) {
    assert.ok(call.texts.length <= EMBED_TEXTS_MAX, `${call.texts.length} texts`);
    assert.ok(call.texts.reduce((n, text) => n + text.length, 0) <= EMBED_CHARACTERS_MAX);
    assert.equal(call.inputType, "document");
  }
  assert.equal(embedder.calls.flatMap((call) => call.texts).length, 150, "each piece once");
  const index = (await t.store.readDoc(recallId(t.runId), normalizeRecallIndex))!;
  assert.equal(index.spaceId, "fake:words:v1");
  assert.equal(index.connectionId, null);
  assert.equal(index.chapters[keyOf("main-1")]!.vectors.length, 5);

  // Nothing new: nothing queued, nothing embedded.
  embedder.calls.length = 0;
  assert.equal(await recall.ensure(t.runId), false);
  // One summary rewritten: only its pieces are embedded again.
  await saveStoryMemory(t.store, t.runId, {
    summaries: { ...summaries, [keyOf("main-2")]: "REWRITTEN: the ledger, in short." },
  });
  assert.equal(await recall.ensure(t.runId), true);
  await settled(recall, t.runId);
  assert.deepEqual(
    embedder.calls.flatMap((call) => call.texts),
    ["REWRITTEN: the ledger, in short."],
    "the rewritten summary only, by its fingerprint",
  );
  // Another model (an Engine update, another connection): every summary again, in the new space.
  const other = createFakeEmbedder({ spaceId: "fake:other:v2", vectorOf: topicVector });
  host = other.host;
  assert.equal(await recall.ensure(t.runId), true);
  await settled(recall, t.runId);
  assert.equal(other.calls.flatMap((call) => call.texts).length, 146);
  assert.equal((await t.store.readDoc(recallId(t.runId), normalizeRecallIndex))!.spaceId, "fake:other:v2");
});

test("opening a story indexes its summaries once, in the background; a story with none queues nothing", async () => {
  const modes: string[] = [];
  const t = await harbour("r-recallopen-aaaaaa", { modes });
  const runs = routesOf(registerRunRoutes, t.deps, "r-recallopen-aaaaaa");
  // Twice at once: one job, and the second open never waits for it.
  const [first, second] = await Promise.all([runs("GET", "/runs/:run"), runs("GET", "/runs/:run")]);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  const status = await settled(t.recall, t.runId);
  assert.equal(status.phase, "ready");
  assert.equal(status.indexed, 8, "every timeline chapter's summary, never the date's");
  assert.equal(status.total, 8);
  assert.deepEqual(modes, ["background"], "one job, under background admission");
  const embedded = t.embedder.calls.flatMap((call) => call.texts);
  assert.equal(embedded.length, 8, "each summary once");
  assert.ok(!embedded.some((text) => text.startsWith("KAI-DATE")), "a date is no timeline chapter");
  // Opened again with everything indexed: nothing.
  await runs("GET", "/runs/:run");
  await settled(t.recall, t.runId);
  assert.equal(modes.length, 1);

  const fresh = await storyWorld({
    runKey: "r-recallnone-aaaaaa",
    model: {
      embeddingsFor: async () => createFakeEmbedder().host,
      admissionRun: <T>(operation: () => Promise<T>, mode: { kind: string }) => {
        modes.push(mode.kind);
        return operation();
      },
    },
  });
  fresh.deps.recall = createRecallIndex({
    runtime: fresh.runtime,
    store: fresh.store,
    background: createBackgroundQueue(fresh.runtime),
  });
  assert.equal((await routesOf(registerRunRoutes, fresh.deps, "r-recallnone-aaaaaa")("GET", "/runs/:run")).status, 200);
  await settled(fresh.deps.recall, fresh.runId);
  assert.equal(modes.length, 1, "no summaries: no job");
  assert.equal(await fresh.store.readDoc(recallId(fresh.runId), normalizeRecallIndex), null, "and no index");
});

test("a failed index says why and waits for Retry indexing, which runs at once; opening the story never retries it", async () => {
  const modes: string[] = [];
  const t = await harbour("r-recallfail-aaaaaa", { modes });
  const memory = { maintain: async () => true, status: async () => ({}) as never };
  const routes = routesOf(
    (router, deps) =>
      registerMemoryRoutes(router, { store: deps.store, handle: deps.handle, memory, recall: t.recall }),
    t.deps,
    "r-recallfail-aaaaaa",
  );
  const runs = routesOf(registerRunRoutes, t.deps, "r-recallfail-aaaaaa");
  t.embedder.fail("throw");
  await runs("GET", "/runs/:run");
  let status = await settled(t.recall, t.runId);
  assert.deepEqual(status, { phase: "failed", indexed: 0, total: 8, message: "FAKE-EMBEDDINGS-DOWN", choosable: true });
  assert.deepEqual((await routes("GET", "/runs/:run/memory/recall")).body, { status });
  // Opened again: it stays failed, with no new job.
  await runs("GET", "/runs/:run");
  await settled(t.recall, t.runId);
  assert.deepEqual(modes, ["background"]);
  // An embedder that answers with no vectors fails too, in its own words.
  t.embedder.fail("null");
  await routes("POST", "/runs/:run/memory/recall/retry");
  status = await settled(t.recall, t.runId);
  assert.equal(status.message, "The embedding model gave no vectors.");
  // Retry, with the embedder back: the player's request, under foreground admission.
  t.embedder.fail(false);
  const retried = await routes("POST", "/runs/:run/memory/recall/retry");
  assert.equal(retried.status, 200);
  assert.deepEqual(modes, ["background", "foreground", "foreground"]);
  status = await settled(t.recall, t.runId);
  assert.deepEqual(status, { phase: "ready", indexed: 8, total: 8, choosable: true });
  assert.equal((await t.store.readDoc(recallId(t.runId), normalizeRecallIndex))!.failure, undefined);
  // A failure on a summary that is then gone: Retry has nothing to embed, and still clears it.
  t.embedder.fail("throw");
  await saveStoryMemory(t.store, t.runId, { summaries: { ...SUMMARIES, [keyOf("main-9")]: "A summary taken back." } });
  await routes("POST", "/runs/:run/memory/recall/retry");
  assert.equal((await settled(t.recall, t.runId)).phase, "failed");
  t.embedder.fail(false);
  await saveStoryMemory(t.store, t.runId, { summaries: SUMMARIES });
  await routes("POST", "/runs/:run/memory/recall/retry");
  assert.deepEqual(await settled(t.recall, t.runId), { phase: "ready", indexed: 8, total: 8, choosable: true });
});

test("only chapters the head condensed, that every scene may know, at least the minimum alike, three at most, in story order", async () => {
  const t = await harbour("r-recallpick-aaaaaa");
  await t.recall.ensure(t.runId);
  await settled(t.recall, t.runId);
  const offered: string[][] = [];
  const spy = {
    choose: async (runId: string, options: Parameters<typeof t.recall.choose>[1]) => {
      offered.push(options.candidates.map((candidate) => candidate.title));
      return t.recall.choose(runId, options);
    },
  };
  const plan = (chooseBy: string[], cast = [KAI]) =>
    recallText({ store: t.store, recall: spy }, t.runId, {
      job: "structured",
      cast,
      continues: "main",
      cached: {},
      lastStory: true,
      chooseBy,
    });
  const lighthouse = await plan(["lighthouse"]);
  // Not Night 5 (an entry), Night 6 (in full), her private route chapter or his date: Nights 1–4 only.
  assert.deepEqual(offered[0], ["Night 1", "Night 2", "Night 3", "Night 4"]);
  // Four alike enough (1, .71, .58, .5): the best three, told in story order.
  assert.deepEqual(lighthouse.recalled, ["main-1", "main-2", "main-3"]);
  // The minimum: Night 2 is one topic of four alike (.35), so only Nights 4 and 3 come back.
  assert.deepEqual((await plan(["ledger festival storm bell"])).recalled, ["main-3", "main-4"]);
  assert.ok(RECALL_MIN_SIMILARITY > 0.36 && RECALL_MIN_SIMILARITY < 0.57);
  // Nothing alike enough: none.
  const none = await plan(["bell"]);
  assert.equal(none.recalled, undefined);
  assert.ok(!none.text.includes("# Earlier, in detail"));
  // Without `cached`, her chapter is hers to know: a prompt for her may recall it, one for Sol never.
  const forHer = await recallText({ store: t.store, recall: spy }, t.runId, {
    job: "structured",
    cast: [MIR],
    continues: "main",
    chooseBy: ["lighthouse"],
  });
  assert.ok(offered.at(-1)!.includes(HER_FIRST));
  assert.ok(forHer.text.includes(`# Earlier, in detail: ${HER_FIRST}\nHER-FIRST-SUMMARY`), forHer.text);
  // His side of the previous chapter goes in full beside it, so it is never recalled, not even for him; nor is his date,
  // which is never in the timeline.
  assert.ok(!offered.at(-1)!.some((title) => title.startsWith(KAI_SIDE)), offered.at(-1)!.join("\n"));
  await recallText({ store: t.store, recall: spy }, t.runId, {
    job: "structured",
    cast: [KAI],
    continues: "main",
    chooseBy: ["lighthouse"],
  });
  assert.deepEqual(offered.at(-1), ["Night 1", "Night 2", "Night 3", "Night 4"]);
  await recallText({ store: t.store, recall: spy }, t.runId, {
    job: "structured",
    cast: [SOL],
    continues: "main",
    chooseBy: ["lighthouse"],
  });
  assert.ok(!offered.at(-1)!.includes(HER_FIRST));
  // The previous chapter condensed into the head too (S/memory/timeline.ts's ponytail): it goes in full, never recalled.
  await saveStoryMemory(t.store, t.runId, {
    head: HEAD,
    covered: Object.keys(SUMMARIES),
    summaries: SUMMARIES,
  });
  await plan(["lighthouse"]);
  assert.deepEqual(offered.at(-1), ["Night 1", "Night 2", "Night 3", "Night 4", "Night 5"]);
  // How the previous chapter ended is part of what the plan is about: its last words alone choose here.
  await complete(
    t,
    { key: "main-6", kind: "main", number: 6, lead: KAI, title: "Night 6" },
    "NIGHT-6: the ledger burned.",
    "2026-10-28T06:00:00.000Z",
  );
  assert.deepEqual((await plan(["Nothing in particular."])).recalled, ["main-2", "main-3", "main-4"]);
});

test("a chapter's plan saves what it recalls, between the head and the newest entries, and its scenes send exactly that", async () => {
  const t = await harbour("r-recallplan-aaaaaa");
  await t.recall.ensure(t.runId);
  await settled(t.recall, t.runId);
  const planned = await t.call("POST", "/runs/:run/chapters/next", { lead: KAI });
  assert.equal(planned.status, 200, JSON.stringify(planned.body));
  const chapter = (await t.store.readDoc(chapterId(t.runId, "main-7"), normalizeChapter))!;
  assert.deepEqual(chapter.recalled, ["main-1", "main-2", "main-3"]);
  assert.ok(!("recalled" in toChapterView(chapter)), "never sent to the client");
  const planPrompt = t.calls.find((call) => isPlanner(call.messages))!.messages;
  const story = storyPart(planPrompt);
  // The head, then each recalled chapter's whole original summary, then the newest entries, as before.
  const at = (text: string) => {
    const index = story.indexOf(text);
    assert.ok(index >= 0, `${text} in\n${story}`);
    return index;
  };
  const order = [
    at(`# Canon to date\n${HEAD}`),
    at(`# Earlier, in detail: Night 1\n${SUMMARIES[keyOf("main-1")]}`),
    at(`# Earlier, in detail: Night 2\n${SUMMARIES[keyOf("main-2")]}`),
    at(`# Earlier, in detail: Night 3\n${SUMMARIES[keyOf("main-3")]}`),
    at("# Canon to date, continued\nNight 5\nENTRY-FIVE: the dark."),
  ];
  assert.deepEqual(
    order,
    [...order].sort((a, b) => a - b),
  );
  assert.ok(!story.includes("ENTRY-SIX"), "the previous chapter's entry stays out, as before");
  // The debug log names each candidate's score and which were recalled.
  const logged = t.logs.find((entry) => entry.level === "debugOverride" && entry.args[0] === "recall");
  assert.ok(logged && logged.override === true, "logged in debug mode");
  assert.deepEqual(JSON.parse(String(logged.args[3])), [
    { title: "Night 1", score: 1, recalled: true },
    { title: "Night 2", score: 0.707, recalled: true },
    { title: "Night 3", score: 0.577, recalled: true },
    { title: "Night 4", score: 0.5, recalled: false },
  ]);

  // The index changes after the plan (the embedder is gone): the scenes still send exactly what the plan chose.
  t.embedder.fail("throw");
  await t.store.removeDoc(recallId(t.runId));
  for (const i of ["0", "1"]) {
    const served = await t.call("POST", "/runs/:run/chapters/:key/beats/:i", {}, { key: "main-7", i });
    assert.equal(served.status, 200, JSON.stringify(served.body));
    await t.call("POST", "/runs/:run/chapters/:key/beats/:i/read", { segment: 99 }, { key: "main-7", i });
  }
  await t.settle();
  const scenes = t.calls.filter((call) => isScene(call.messages));
  assert.ok(scenes.length >= 2, `${scenes.length} scene prompts`);
  for (const scene of scenes) assert.equal(storyPart(scene.messages), story, "byte for byte, as the plan cached it");
  // Two scenes with different casts read the same story context.
  const scene = (cast: string[]) =>
    recallText({ store: t.store }, t.runId, {
      job: "narration",
      cast,
      continues: "main",
      cached: {},
      lastStory: true,
      recalled: chapter.recalled,
    });
  const [kai, sol] = [await scene([KAI]), await scene([SOL, MIR])];
  assert.equal(kai.text, sol.text);
  assert.deepEqual(kai.recalled, ["main-1", "main-2", "main-3"]);

  // No prompt ever carries the index: none of its vectors, nor the document.
  t.embedder.fail(false);
  await t.recall.ensure(t.runId, { retry: true });
  await settled(t.recall, t.runId);
  const index = (await t.store.readDoc(recallId(t.runId), normalizeRecallIndex))!;
  const vectors = Object.values(index.chapters).flatMap((entry) => entry.vectors);
  assert.equal(vectors.length, 8);
  const sent = t.calls.flatMap((call) => call.messages.map((message) => message.content)).join("\n");
  for (const vector of vectors) assert.ok(!sent.includes(vector.slice(0, 24)));
  assert.ok(!sent.includes("spaceId") && !sent.includes("fake:words") && !sent.includes(recallId(t.runId)));
  const sources = JSON.stringify(await readMemorySources(t.store, t.runId));
  assert.ok(!vectors.some((vector) => sources.includes(vector.slice(0, 24))), "and it is no memory source");
});

test("with no embeddings, or no index, the prompt is exactly what it was, and the plan saves nothing", async () => {
  const options = { job: "structured" as const, cast: [KAI], continues: "main" as const, cached: {}, lastStory: true };
  const t = await harbour("r-recallnoemb-aaaaaa");
  const before = await recallText({ store: t.store }, t.runId, options);
  assert.ok(before.text.includes(`# Canon to date\n${HEAD}\n\nNight 5\nENTRY-FIVE`), before.text);
  // No index yet.
  const unindexed = await recallText({ store: t.store, recall: t.recall }, t.runId, {
    ...options,
    chooseBy: ["lighthouse"],
  });
  assert.equal(unindexed.text, before.text);
  assert.equal(unindexed.recalled, undefined);
  // An index, and an embedder that fails, or gives no vectors.
  await t.recall.ensure(t.runId);
  await settled(t.recall, t.runId);
  for (const mode of ["throw", "null"] as const) {
    t.embedder.fail(mode);
    const failed = await recallText({ store: t.store, recall: t.recall }, t.runId, {
      ...options,
      chooseBy: ["lighthouse"],
    });
    assert.equal(failed.text, before.text, mode);
    assert.equal(failed.recalled, undefined);
  }
  const planned = await t.call("POST", "/runs/:run/chapters/next", { lead: KAI });
  assert.equal(planned.status, 200, JSON.stringify(planned.body));
  const chapter = (await t.store.readDoc(chapterId(t.runId, "main-7"), normalizeChapter))!;
  assert.equal(chapter.recalled, undefined, "nothing recalled, nothing saved");
  assert.ok(!storyPart(t.calls.find((call) => isPlanner(call.messages))!.messages).includes("# Earlier, in detail"));
  // An older chapter with no `recalled` sends none.
  const scene = await recallText({ store: t.store }, t.runId, { ...options, job: "narration" });
  assert.equal(scene.text, before.text);
});

test("Memory recall embeddings: a connection is checked on save, and a new one rebuilds the index; an older Engine has only Built-in", async () => {
  const local = createFakeEmbedder({ vectorOf: topicVector });
  const remote = createFakeEmbedder({ spaceId: "remote:multilingual", vectorOf: topicVector });
  const asked: Array<string | null> = [];
  const t = await storyWorld({
    runKey: "r-recallset-aaaaaa",
    model: {
      embeddingsFor: async (id) => {
        asked.push(id);
        return id === null ? local.host : id === "conn-embed" ? remote.host : null;
      },
    },
  });
  await saveStoryMemory(t.store, t.runId, { summaries: { [keyOf("main-1")]: "NIGHT-ONE: the lighthouse." } });
  // Which admission slot each job takes.
  const admitted: string[] = [];
  const background = createBackgroundQueue({
    logger: t.runtime.logger,
    integrations: {
      admission: {
        run: <T>(connectionId: string, _mode: unknown, operation: () => Promise<T>) => {
          admitted.push(connectionId);
          return operation();
        },
        isFailure: () => false,
      },
    } as never,
  });
  const recall = createRecallIndex({ runtime: t.runtime, store: t.store, background });
  t.deps.recall = recall;
  await recall.ensure(t.runId);
  await settled(recall, t.runId);
  assert.deepEqual(admitted, [LOCAL_LANE], "the built-in model's own lane");
  const runs = routesOf(registerRunRoutes, t.deps, "r-recallset-aaaaaa");
  const world = async () => (await t.store.readDoc(worldId(t.runId), normalizeWorld))!;

  const refused = await runs("POST", "/runs/:run/settings", {
    connections: { narration: "conn-text", embeddings: "conn-plain" },
  });
  assert.equal(refused.status, 400);
  assert.equal(refused.body.code, "no-embeddings");
  assert.equal((await world()).connections.embeddings, undefined, "nothing saved");

  const saved = await runs("POST", "/runs/:run/settings", {
    connections: { narration: "conn-text", embeddings: "conn-embed" },
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal(saved.body.world.connections.embeddings, "conn-embed");
  await settled(recall, t.runId);
  const index = (await t.store.readDoc(recallId(t.runId), normalizeRecallIndex))!;
  assert.deepEqual([index.spaceId, index.connectionId], ["remote:multilingual", "conn-embed"], "rebuilt with it");
  assert.deepEqual(
    remote.calls.flatMap((call) => call.texts),
    ["NIGHT-ONE: the lighthouse."],
  );
  assert.equal(admitted.at(-1), "conn-embed", "in that connection's admission slot");
  // A concurrent save between the route's first read and its write: the route read a stale "conn-embed" while the
  // stored choice is Built-in by the time it writes "conn-embed" again. The write replaced Built-in, so it rebuilds.
  await t.store.updateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (current) => ({
    ...current,
    connections: { ...current.connections, embeddings: null },
  }));
  const ensured: string[] = [];
  const ensure = recall.ensure.bind(recall);
  recall.ensure = (runId, options) => {
    ensured.push(runId);
    return ensure(runId, options);
  };
  const realRead = t.store.readDoc.bind(t.store);
  let stale = true;
  t.store.readDoc = (async (id: string, normalize: (value: unknown) => unknown) => {
    const value = await realRead(id, normalize as never);
    if (stale && id === worldId(t.runId) && value) {
      stale = false;
      const world = value as ReturnType<typeof normalizeWorld>;
      return { ...world, connections: { ...world.connections, embeddings: "conn-embed" } };
    }
    return value;
  }) as typeof t.store.readDoc;
  const raced = await runs("POST", "/runs/:run/settings", {
    connections: { narration: "conn-text", embeddings: "conn-embed" },
  });
  t.store.readDoc = realRead;
  assert.equal(raced.status, 200, JSON.stringify(raced.body));
  assert.deepEqual(ensured, [t.runId], "the persisted change rebuilds, whatever the stale read said");
  recall.ensure = ensure;
  await settled(recall, t.runId);
  // Saved again unchanged (another field): not checked again, nothing rebuilt.
  asked.length = 0;
  const again = await runs("POST", "/runs/:run/settings", {
    connections: { narration: "conn-text", embeddings: "conn-embed" },
    dailyMessages: 2,
  });
  assert.equal(again.status, 200);
  assert.deepEqual(asked, []);
  // Back to Built-in: allowed, and rebuilt with it.
  assert.equal((await runs("POST", "/runs/:run/settings", { connections: { narration: "conn-text" } })).status, 200);
  await settled(recall, t.runId);
  assert.equal((await t.store.readDoc(recallId(t.runId), normalizeRecallIndex))!.spaceId, "fake:words:v1");

  // An older Engine (no embeddingsFor): Built-in only, and the status says so.
  const older = await storyWorld({ runKey: "r-recallold-aaaaaa", model: { embeddings: local.host } });
  const oldRecall = createRecallIndex({
    runtime: older.runtime,
    store: older.store,
    background: createBackgroundQueue(older.runtime),
  });
  older.deps.recall = oldRecall;
  const oldRuns = routesOf(registerRunRoutes, older.deps, "r-recallold-aaaaaa");
  const oldRefused = await oldRuns("POST", "/runs/:run/settings", {
    connections: { narration: "conn-text", embeddings: "conn-embed" },
  });
  assert.equal(oldRefused.status, 400);
  assert.equal(oldRefused.body.code, "no-embeddings");
  assert.equal((await oldRecall.status(older.runId)).choosable, false);
  // Its built-in model still indexes.
  await saveStoryMemory(older.store, older.runId, { summaries: { [keyOf("main-1")]: "NIGHT-ONE: the lighthouse." } });
  await oldRecall.ensure(older.runId);
  assert.equal((await settled(oldRecall, older.runId)).indexed, 1);
});

test("a story deleted while it is indexed keeps no index", async () => {
  assert.ok((RUN_DOC_KINDS as readonly string[]).includes("recall"), "deleting a story sweeps its index");
  const embedder = createFakeEmbedder({ vectorOf: topicVector });
  const story: { world?: World } = {};
  const deleting: CapabilityEmbeddingHost = {
    ...embedder.host,
    // The story is deleted while its summaries are embedded.
    async embed(texts, signal, inputType) {
      await story.world!.store.removeDoc(worldId(story.world!.runId));
      return embedder.host.embed(texts, signal, inputType);
    },
  };
  const t = await storyWorld({ runKey: "r-recalldel-aaaaaa", model: { embeddingsFor: async () => deleting } });
  story.world = t;
  await saveStoryMemory(t.store, t.runId, { summaries: { [keyOf("main-1")]: "NIGHT-ONE: the lighthouse." } });
  const recall = createRecallIndex({
    runtime: t.runtime,
    store: t.store,
    background: createBackgroundQueue(t.runtime),
  });
  assert.equal(await recall.ensure(t.runId), true);
  await settled(recall, t.runId);
  assert.equal(embedder.calls.length, 1, "it was embedding");
  assert.equal(await t.store.readDoc(recallId(t.runId), normalizeRecallIndex), null);
});

test("after memory upkeep writes a chapter's summary, it is indexed too", async () => {
  const embedder = createFakeEmbedder({ vectorOf: topicVector });
  const t = await storyWorld({
    runKey: "r-recallkeep-aaaaaa",
    replies: Array.from({ length: 10 }, () => (messages: CapabilityLanguageModelMessage[]) => {
      const input = JSON.parse(messages.at(-1)!.content);
      return json({ summary: input.source ? `SUMMARY-${input.source.id}: the lighthouse.` : "CONDENSED" });
    }),
    model: { embeddingsFor: async () => embedder.host },
  });
  await complete(
    t,
    { key: "main-1", kind: "main", number: 1, lead: KAI, title: "Night 1" },
    "NIGHT-1",
    "2026-10-28T01:00:00.000Z",
  );
  const background = createBackgroundQueue(t.runtime);
  const recall = createRecallIndex({ runtime: t.runtime, store: t.store, background });
  const memory = createOtomeMemory({
    runtime: t.runtime,
    store: t.store,
    background,
    afterUpkeep: (runId) => void recall.ensure(runId),
  });
  try {
    assert.equal(await memory.maintain({ runId: t.runId }), true);
    for (let turn = 0; turn < 4000 && (await memory.status(t.runId)).phase === "pending"; turn += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    const status = await settled(recall, t.runId);
    assert.deepEqual([status.phase, status.indexed, status.total], ["ready", 1, 1]);
    assert.deepEqual(
      embedder.calls.flatMap((call) => call.texts),
      ["SUMMARY-main-1: the lighthouse."],
    );
  } finally {
    memory.dispose();
  }
});

test("Settings offers an embedding connection only once the recall status confirms the Engine lets it choose", () => {
  // Dottore: while the status loads or fails, the picker behaves as on an older Engine (Built-in alone).
  assert.equal(embeddingsChoosable(undefined), false, "loading");
  assert.equal(embeddingsChoosable(null), false, "failed");
  assert.equal(embeddingsChoosable({}), false, "no answer");
  assert.equal(embeddingsChoosable({ choosable: false }), false, "an older Engine");
  assert.equal(embeddingsChoosable({ choosable: true }), true, "capability API 1.818");
  // The options: all once confirmed, none on an older Engine, and while unknown only the saved one (by its name).
  const all = [{ id: "conn-a" }, { id: "conn-b" }];
  assert.deepEqual(embeddingOptions({ choosable: true }, all, "conn-a"), all);
  assert.deepEqual(embeddingOptions({ choosable: false }, all, "conn-a"), []);
  assert.deepEqual(
    embeddingOptions(undefined, all, "conn-a"),
    [{ id: "conn-a" }],
    "loading: the saved one, never Missing",
  );
  assert.deepEqual(embeddingOptions(null, all, ""), [], "failed, with Built-in saved: nothing new offered");
});
