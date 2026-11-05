// Otome Forge's private memory (M2a): each love interest knows only what he saw or was told. A `chat` source (a phone
// session) with audience [A] is recalled only for reader A or a scene whose cast includes A, never into the shared
// overview and never by a call that names nobody; the latest chapter is left to the caller, who sends it in full.
// Summaries run on the background lane with the `summary` contract and its summary wording, never with the knowledge
// boundary, which the story's own writers (P5, P6) carry, and each leaves a thinking model at least 10240 tokens to
// reply (or the connection's own lower cap), also on a small context (#2039). The memory routes report the status and
// queue a Retry, and give the overview as plain paragraphs for "What happened so far…" (#2040): [] before the first
// one, no heading or source key, never the private chat, 404 for an unknown run. A request in the queue's release gap,
// or a job admission refuses before it starts, never leaves the status pending. An overview fold is told the overview is
// the story's timeline, a recollection in prose (0.6.19); one saved before that is folded again from the records, once,
// in the background; the panel shows no bold label or markdown emphasis.
// #2066: the overview is the story's timeline. A chapter's summary (at most 1000 words, said in its prompt) joins it with
// no model call, and only a timeline past 13k tokens and 1k of leeway is condensed (everything before the newest main
// chapter's entry, #2091, in as few calls as the memory model's context allows; a fold that adds nothing condenses
// nothing); a date is never in it (a Character Story joins it, titled private). Memory never waits for a context size
// (the maintainer's, 2026-11-04): a memory model that reports none writes every summary, each request whole, and
// condenses in one call; a summary its provider refuses is status `error` with the provider's own message, which Retry
// clears, and Retry runs at once even while the player reads (foreground admission), its banner gone until it fails
// again, while upkeep queued by itself meanwhile keeps the failure and its Retry until it is admitted; one that
// reports a context too small for any summary or condensing fails with no call, its message saying so in Otome's own words (reason `context-too-small`, a wording for each); a run with no connection for it says so in its status, with how many chapters wait for a summary; and a status
// the earlier gate saved never waits for setup: it reads as behind and catches up, or as ready. Recall sends no ranked
// details and no recent canon: the small memories this prompt may know come back as `recalls`, newest first within 5k
// tokens and 1k of leeway, never one the caller lists in full; the Home note, Read Him and Read Me take the newest.
import assert from "node:assert/strict";
import test from "node:test";
import { estimateTextTokens } from "@forge-kit/shared-token-estimator.mjs";
import { forgeKnowledgeBoundary } from "@forge-kit/story-memory-integration.mjs";
import type { ForgeMemorySource } from "@forge-kit/story-memory.mjs";
import {
  memoryNotice,
  nextMemoryView,
  type MemoryView,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/lib/memory-notice.ts";
import type {
  Bible,
  ChapterNode,
  MemoryStatus,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import {
  createHandle,
  type OtomeReply,
  type RouteHandler,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/http.ts";
import {
  memoryId,
  runDocTarget,
  runIdOf,
  stateId,
  unitId,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import {
  CHAPTER_SUMMARY_WORDING,
  OVERVIEW_WORDING,
  SUMMARY_WORDING,
  TIMELINE_FOLD_WORDING,
  beatMessages,
  chapterPlanMessages,
  closerMessages,
  confrontationMessages,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/prompts.ts";
import {
  HEADROOM_TOKENS,
  TIMELINE_CEILING,
  foldedPart,
  keptPart,
  parseTimeline,
  renderTimeline,
  savedStory,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/timeline.ts";
import { recalledLine } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/minigames/read-him.ts";
import {
  RECALL_TOKENS,
  createOtomeMemory,
  type OtomeMemory,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/memory.ts";
import {
  overviewParagraphs,
  registerMemoryRoutes,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/memory.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import {
  defaultLiState,
  normalizeState,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import {
  normalizeBible,
  normalizeUnit,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { createOtomeStore } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/store.ts";
import { recallText } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/canon.ts";
import { createFakeDocuments, createFakeRuntime, type FakeRuntimeOptions } from "./fixtures/otome-forge-fakes.ts";

const RUN = runIdOf("r-memory-abcdef");
const KAI = "li-kai-ab12";
const MIR = "li-mireille-cd34";
const PRIVATE = "lighthouse";

const SOURCES: ForgeMemorySource[] = [
  {
    id: "main-1",
    kind: "chapter",
    title: "The Observatory",
    content: "Ava met Kai and Mireille at the observatory. The great telescope had been sabotaged.",
    order: 10000,
  },
  // A side story of the kit's own kind, as Otome's dates are (S/story/canon.ts): summarized, never in the timeline,
  // recalled only for its love interest; otome-forge-beats.regression.ts checks them with memory ready. A Character
  // Story (a `story-` key) joins the timeline instead (0.7.3, checked below).
  {
    id: "route-li-mireille-cd34-2",
    kind: "character-story",
    title: "Mireille's Ledger",
    content: "Mireille showed Ava the forged ledger hidden in the archive.",
    order: 15000,
    audience: [MIR],
  },
  {
    id: "date-1",
    kind: "chat",
    title: "Kai's date",
    content: `On the ${PRIVATE} stairs Kai confessed that he keeps the brass ${PRIVATE} key.`,
    order: 15001,
    audience: [KAI],
  },
];

/** The fake summarizer: a detail echoes its source, a condensing says what it condensed. */
function summarizer(messages: Array<{ content: string }>) {
  const input = JSON.parse(messages.at(-1)!.content);
  if (input.source) return JSON.stringify({ summary: `${input.source.title}: ${input.source.content}` });
  return JSON.stringify({ summary: `CONDENSED ${[...input.timeline].length}` });
}

async function setup(
  connections: Record<string, string> = { narration: "conn-story", compress: "conn-memory" },
  options: Pick<
    FakeRuntimeOptions,
    "replies" | "admissionRun" | "admissionFailures" | "maxContext" | "maxOutputTokens"
  > & {
    sources?: ForgeMemorySource[];
  } = {},
) {
  const fake = createFakeDocuments();
  fake.seedGachaForgeIndex();
  const store = createOtomeStore(fake.documents);
  const runtime = createFakeRuntime({
    documents: fake.documents,
    replies: Array.from({ length: 12 }, () => summarizer),
    ...options,
  });
  await store.mutateDoc(runDocTarget("world", worldId(RUN)), normalizeWorld, (world) => ({
    ...world,
    connections: connections as typeof world.connections,
  }));
  for (const [id, name] of [
    [KAI, "Kai"],
    [MIR, "Mireille"],
  ] as const) {
    await store.mutateDoc(runDocTarget("unit", unitId(RUN, id)), normalizeUnit, (unit) => ({ ...unit, id, name }));
  }
  await store.mutateDoc(runDocTarget("state", stateId(RUN)), normalizeState, (state) => ({
    ...state,
    lis: { [KAI]: defaultLiState(), [MIR]: defaultLiState() },
  }));
  // `failReads` makes the next reads of the wrapper fail while later ones (the kit's own) succeed.
  const reads = { fail: 0 };
  const memory = createOtomeMemory({
    runtime: runtime.runtime,
    store,
    readSources: async () => {
      if (reads.fail > 0) {
        reads.fail -= 1;
        throw new Error("the sources could not be read");
      }
      return options.sources ?? SOURCES;
    },
  });
  return { fake, store, memory, reads, ...runtime };
}

/** Waits for the queued maintenance to finish (status leaves `pending`). */
async function settle(memory: OtomeMemory) {
  for (let turn = 0; turn < 2000; turn += 1) {
    const status = await memory.status(RUN);
    if (status.phase !== "pending") return status;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error("The memory maintenance never finished");
}

test("a Character Story joins the timeline in story order, private to its love interest; a date never does", async () => {
  // The maintainer's (2026-11-03): love interests must know what happened in their Character Stories, and as recalls
  // they were often left out of the 5k.
  const STORY = {
    id: "story-item-mem-0001",
    kind: "character-story" as const,
    title: 'Kai\'s own story chapter "The Brass Key" (private: only the people in its scenes know what happened in it)',
    content: "Kai gave Ava the brass key to the bell tower.",
    order: 10000 + 5000.5,
    audience: [KAI],
  };
  const { fake, memory } = await setup(undefined, { sources: [SOURCES[0]!, SOURCES[1]!, STORY] });
  assert.equal(await memory.maintain({ runId: RUN, debugMode: false }), true);
  assert.equal((await settle(memory)).phase, "ready");
  const saved = fake.rows.get(memoryId(RUN))!.data as { overview: { content: string } };
  const timeline = parseTimeline(saved.overview.content);
  assert.deepEqual(
    timeline.entries.map((entry) => entry.key),
    [JSON.stringify(["chapter", "main-1"]), JSON.stringify(["character-story", STORY.id])],
    "after the main chapter it followed; the date-like side story stays out",
  );
  assert.match(timeline.entries[1]!.title, /private/u, "titled private to him");
  assert.ok(timeline.entries[1]!.text.includes("brass key"));
  // It is the timeline's, so it is no recall any more: his own prompt has it once.
  const recall = await memory.recall({ runId: RUN, job: "narration", cast: [KAI] });
  assert.ok(!(recall.recalls ?? []).some((item) => item.id === STORY.id), "not a recall too");
  const reply = await memory.recall({ runId: RUN, job: "chat", reader: KAI });
  assert.ok(
    !(reply.recalls ?? []).some((item) => item.id === STORY.id),
    "nor in his messages, which carry the timeline",
  );
  // The Home note, Read Him and Read Me carry no timeline: they take it as his newest recall.
  const own = await memory.recall({ runId: RUN, job: "chat", reader: KAI, ownStories: true });
  assert.equal(own.recalls?.at(-1)?.id, STORY.id, "his newest memory, where no timeline goes");
  const hers = await memory.recall({ runId: RUN, job: "chat", reader: MIR, ownStories: true });
  assert.ok(!(hers.recalls ?? []).some((item) => item.id === STORY.id), "and never another love interest's");
});

test("summaries run on the background lane with the summary wording; a private chat never reaches the overview", async () => {
  const { fake, memory, calls, admissions, logs } = await setup();
  assert.equal(await memory.maintain({ runId: RUN, debugMode: true }), true);
  const status = await settle(memory);
  assert.equal(status.phase, "ready");

  // Two detail summaries; each joins the timeline with no call (#2066), and the chat is its own record, so it is never
  // summarized.
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.connectionId === "conn-memory"));
  assert.deepEqual(admissions, [{ connectionId: "conn-memory", mode: { kind: "background" } }]);
  for (const call of calls) {
    const system = call.messages[0]!.content;
    assert.ok(system.includes(SUMMARY_WORDING), "the summary wording");
    assert.ok(system.includes("CONTENT CONTRACT") && system.includes("Heat: SFW"), "the summary contract");
    assert.ok(!system.includes(forgeKnowledgeBoundary), "no knowledge boundary for the summarizer");
    assert.ok(!JSON.stringify(call.messages).includes(PRIVATE), "the private chat reaches no summary prompt");
  }
  const logged = logs.filter((entry) => entry.level === "debugOverride" && entry.override === true);
  assert.deepEqual(new Set(logged.map((entry) => entry.args[0])), new Set(["memory-detail"]));

  const saved = fake.rows.get(memoryId(RUN))!.data as {
    overview: { content: string; sources: Array<[string, string]> };
    records: Array<{ kind: string; content: string }>;
  };
  assert.deepEqual(parseTimeline(saved.overview.content), {
    head: "",
    entries: [
      {
        key: JSON.stringify(["chapter", "main-1"]),
        title: "The Observatory",
        text: `The Observatory: ${SOURCES[0]!.content}`,
      },
    ],
  });
  assert.ok(!saved.overview.content.includes("forged ledger"), "a Character Story is its love interest's own (#2066)");
  assert.ok(!saved.overview.content.includes(PRIVATE));
  assert.ok(saved.overview.sources.every(([key]) => JSON.parse(key)[0] !== "chat"));
  assert.ok(saved.records.some((record) => record.kind === "chat" && record.content.includes(PRIVATE)));
});

/**
 * Filler that estimates to a known size (its made-up words cost about 1.72 estimated tokens each; real prose about
 * 1.35, so 1000 words of a summary are some 1350 tokens).
 */
const filler = (marker: string, words: number) =>
  `${marker} ${Array.from({ length: words }, (_, w) => `tide${w % 89}`).join(" ")}`;

const mainChapters = (count: number): ForgeMemorySource[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `main-${index + 1}`,
    kind: "chapter",
    title: `Night ${index + 1}`,
    content: `NIGHT-${index + 1}: the bell rings.`,
    order: (index + 1) * 10000,
  }));

test("the timeline grows with no call, has 1k of leeway, and is condensed only past it, all but its newest entry (#2066)", async () => {
  // Three summaries of about 6700 estimated tokens: the first two (about 13400) are past the 13k ceiling but within its
  // leeway (14k at most), so nothing is condensed; the third takes it past, and the first two are condensed.
  const long = (n: number) => filler(`CHAPTER-${n}`, 3900);
  const two = renderTimeline({
    head: "",
    entries: [1, 2].map((n) => ({ key: `k${n}`, title: `Night ${n}`, text: long(n) })),
  });
  // The maintainer's sizes: the timeline at most 14k and the recalls at most 6k, leeway included, 20k together.
  assert.deepEqual([TIMELINE_CEILING + HEADROOM_TOKENS, RECALL_TOKENS + HEADROOM_TOKENS], [14_000, 6_000]);
  assert.ok(estimateTextTokens(two) > TIMELINE_CEILING, "past the ceiling");
  assert.ok(estimateTextTokens(two) <= TIMELINE_CEILING + HEADROOM_TOKENS, "within its leeway");
  let condensed = 0;
  const { memory, calls, fake } = await setup(undefined, {
    maxContext: 131_072,
    maxOutputTokens: null,
    sources: mainChapters(3),
    replies: Array.from({ length: 12 }, () => (messages: Array<{ content: string }>) => {
      const input = JSON.parse(messages.at(-1)!.content);
      if (input.source) return JSON.stringify({ summary: long(Number(input.source.id.slice(5))) });
      condensed += 1;
      return JSON.stringify({ summary: `CONDENSED-${condensed}` });
    }),
  });
  assert.equal(await memory.maintain({ runId: RUN }), true);
  assert.equal((await settle(memory)).phase, "ready");
  const input = (call: (typeof calls)[number]) => JSON.parse(call.messages.at(-1)!.content);
  const kinds = calls.map((call) => (input(call).source ? "detail" : "timeline"));
  assert.deepEqual(kinds, ["detail", "detail", "detail", "timeline"]);
  for (const [index, call] of calls.entries()) {
    const system = call.messages[0]!.content;
    const detail = kinds[index] === "detail";
    assert.ok(system.includes(SUMMARY_WORDING), "every summary keeps the summary wording");
    assert.equal(system.includes(CHAPTER_SUMMARY_WORDING), detail, "a chapter summary: at most 1000 words, said");
    assert.match(CHAPTER_SUMMARY_WORDING, /at most 1000 words/u);
    assert.equal(system.includes(TIMELINE_FOLD_WORDING), !detail, "condensing: about 5000 words, said");
    if (!detail) assert.ok(system.includes("to about 5000 words, and no more"), "half the 13–14k it condenses at");
    assert.equal(system.includes(OVERVIEW_WORDING), !detail, "the condensed part reads as a recollection");
    assert.ok(call.options!.maxTokens! >= 10240, "the word limits are the prompt's; the reply room stays 10240");
  }
  // The condensing folds Night 1 and Night 2, never Night 3, which took it past and stays whole after it.
  const folded = input(calls[3]!).timeline as string;
  assert.ok(folded.includes("CHAPTER-1") && folded.includes("CHAPTER-2") && !folded.includes("CHAPTER-3"));
  const saved = fake.rows.get(memoryId(RUN))!.data as { overview: { content: string } };
  const timeline = parseTimeline(saved.overview.content);
  assert.equal(timeline.head, "CONDENSED-1");
  assert.deepEqual(
    timeline.entries.map((entry) => [entry.title, entry.text.slice(0, 10)]),
    [["Night 3", "CHAPTER-3 "]],
  );
});

test("condensing keeps the newest main chapter's entry apart, so a prompt that sends it in full never repeats it (#2091)", async () => {
  // Night 3 is the newest main chapter; a Character Story after it takes the timeline past its ceiling. Before #2091
  // everything but the Character Story was condensed, Night 3 with it, and the main story's next prompts sent Night 3
  // in full beside its summary in the condensed head.
  const long = (tag: string) => filler(tag, 3900);
  const story: ForgeMemorySource = {
    id: "story-lamp",
    kind: "character-story",
    title: "Kai's own Character Story",
    content: "STORY: the lamp.",
    order: 35000,
    audience: [KAI],
  };
  const { memory, calls, fake } = await setup(undefined, {
    maxContext: 131_072,
    maxOutputTokens: null,
    sources: [...mainChapters(2), { ...mainChapters(3)[2]!, content: "NIGHT-3: short." }, story],
    replies: Array.from({ length: 12 }, () => (messages: Array<{ content: string }>) => {
      const input = JSON.parse(messages.at(-1)!.content);
      if (!input.source) return JSON.stringify({ summary: "CONDENSED" });
      const id = String(input.source.id);
      return JSON.stringify({ summary: id === "main-3" ? "SHORT-3" : long(`SUMMARY-${id}`) });
    }),
  });
  assert.equal(await memory.maintain({ runId: RUN }), true);
  assert.equal((await settle(memory)).phase, "ready");
  const folds = calls.filter((call) => !JSON.parse(call.messages.at(-1)!.content).source);
  assert.equal(folds.length, 1, "condensed once");
  const folded = JSON.parse(folds[0]!.messages.at(-1)!.content).timeline as string;
  assert.ok(folded.includes("SUMMARY-main-1") && folded.includes("SUMMARY-main-2"));
  assert.ok(!folded.includes("SHORT-3") && !folded.includes("SUMMARY-story-lamp"), "Night 3 and after stay apart");
  const saved = fake.rows.get(memoryId(RUN))!.data as { overview: { content: string } };
  const timeline = parseTimeline(saved.overview.content);
  assert.equal(timeline.head, "CONDENSED");
  assert.deepEqual(
    timeline.entries.map((entry) => entry.key),
    [JSON.stringify(["chapter", "main-3"]), JSON.stringify(["character-story", "story-lamp"])],
  );
  // The main story's prompt leaves Night 3's entry out: only the head and the Character Story remain.
  assert.equal(
    renderTimeline(timeline, JSON.stringify(["chapter", "main-3"])).includes("SHORT-3"),
    false,
    "its summary never goes in beside it",
  );
});

test("with nothing before the newest main chapter's entry, condensing folds all but the newest entry (#2091)", () => {
  const entry = (kind: string, id: string) => ({ key: JSON.stringify([kind, id]), title: id, text: id });
  const main = entry("chapter", "main-12");
  const route = entry("chapter", `route-${KAI}-2`);
  const story = entry("character-story", "story-lamp");
  const split = (...entries: ReturnType<typeof entry>[]) => [
    foldedPart({ head: "HEAD", entries }).entries.map((item) => item.text),
    keptPart({ head: "HEAD", entries }).map((item) => item.text),
  ];
  assert.deepEqual(split(route, main, story), [[route.text], [main.text, story.text]], "before the newest main one");
  assert.deepEqual(split(main, story, route), [[main.text, story.text], [route.text]], "none before it");
  assert.deepEqual(split(story, route), [[story.text], [route.text]], "no main chapter at all");
  assert.deepEqual(split(main), [[], [main.text]], "a lone entry is never condensed");
});

test("a small memory model condenses the timeline in pieces it can hold, each with its whole reply room (#2066)", async () => {
  // A 16k compress model: about 5500 tokens of prompt fit beside a 10240-token reply. Eight summaries of about 2000
  // tokens each take the timeline past 14k; the first seven are condensed a few at a time, oldest first.
  const summary = (n: number) => filler(`CHAPTER-${n}`, 1150);
  let condensed = 0;
  const { memory, calls, fake } = await setup(undefined, {
    maxContext: 16_384,
    maxOutputTokens: null,
    sources: mainChapters(8),
    replies: Array.from({ length: 20 }, () => (messages: Array<{ content: string }>) => {
      const input = JSON.parse(messages.at(-1)!.content);
      if (input.source) return JSON.stringify({ summary: summary(Number(input.source.id.slice(5))) });
      condensed += 1;
      return JSON.stringify({ summary: `CONDENSED-${condensed}` });
    }),
  });
  assert.equal(await memory.maintain({ runId: RUN }), true);
  assert.equal((await settle(memory)).phase, "ready", "condensed, never failed");
  const pieces = calls
    .map((call) => JSON.parse(call.messages.at(-1)!.content).timeline as string | undefined)
    .filter((timeline): timeline is string => timeline !== undefined);
  assert.ok(pieces.length > 1, `more than one call: ${pieces.length}`);
  for (const call of calls) assert.ok(call.options!.maxTokens! >= 10240, "every call keeps its whole reply room");
  // Oldest first, each piece folding the head the one before wrote; Night 8 is never condensed.
  const order = pieces.map((piece) => (piece.match(/CHAPTER-\d/gu) ?? []).join(","));
  assert.deepEqual(order.join(",").split(",").filter(Boolean), [
    "CHAPTER-1",
    "CHAPTER-2",
    "CHAPTER-3",
    "CHAPTER-4",
    "CHAPTER-5",
    "CHAPTER-6",
    "CHAPTER-7",
  ]);
  for (const [index, piece] of pieces.entries()) {
    if (index) assert.ok(piece.startsWith(`CONDENSED-${index}`), "the head the piece before wrote comes first");
  }
  const timeline = parseTimeline(
    (fake.rows.get(memoryId(RUN))!.data as { overview: { content: string } }).overview.content,
  );
  assert.equal(timeline.head, `CONDENSED-${pieces.length}`);
  assert.deepEqual(
    timeline.entries.map((entry) => entry.title),
    ["Night 8"],
  );
});

test("condensing the timeline has room for its 5000 words and a thinking model's reasoning, unlike a chapter summary", async () => {
  // Claude Opus 5.5 was cut off on every condensing call ("the reply was cut") with a chapter summary's 10240 tokens.
  const summary = (n: number) => filler(`CHAPTER-${n}`, 1150);
  const { memory, calls } = await setup(undefined, {
    maxContext: 1_000_000,
    maxOutputTokens: null,
    sources: mainChapters(8),
    replies: Array.from({ length: 20 }, () => (messages: Array<{ content: string }>) => {
      const input = JSON.parse(messages.at(-1)!.content);
      if (input.source) return JSON.stringify({ summary: summary(Number(input.source.id.slice(5))) });
      return JSON.stringify({ summary: "CONDENSED" });
    }),
  });
  assert.equal(await memory.maintain({ runId: RUN }), true);
  assert.equal((await settle(memory)).phase, "ready", "condensed, never failed");
  const condensing = calls.filter((call) => JSON.parse(call.messages.at(-1)!.content).timeline !== undefined);
  const summaries = calls.filter((call) => JSON.parse(call.messages.at(-1)!.content).source !== undefined);
  assert.equal(condensing.length, 1, "a large model condenses in one call");
  assert.ok(condensing[0]!.options!.maxTokens! >= 24_576 + 16_000, `it may write ${condensing[0]!.options!.maxTokens}`);
  for (const call of summaries)
    assert.ok(call.options!.maxTokens! < 24_576 + 16_000, "chapter summaries keep their room");
});

test("a condensed head that came back long is never condensed again by itself, and a date's fold condenses nothing", async () => {
  // The condensing ignores its 5000 words and returns about 12000 tokens; then a date is folded in, which adds no
  // summary to the timeline. Before #2066's follow-up that fold paid to condense the head again.
  const sources: ForgeMemorySource[] = [
    ...mainChapters(3),
    {
      id: "date-1",
      kind: "character-story",
      title: "Kai's date",
      content: "DATE: tea.",
      order: 35000,
      audience: [KAI],
    },
  ];
  const { memory, calls } = await setup(undefined, {
    maxContext: 131_072,
    maxOutputTokens: null,
    sources,
    replies: Array.from({ length: 12 }, () => (messages: Array<{ content: string }>) => {
      const input = JSON.parse(messages.at(-1)!.content);
      if (input.source) return JSON.stringify({ summary: filler(`SUMMARY-${input.source.id}`, 3000) });
      return JSON.stringify({ summary: filler("LONG-HEAD", 7000) });
    }),
  });
  assert.equal(await memory.maintain({ runId: RUN }), true);
  assert.equal((await settle(memory)).phase, "ready");
  const kinds = calls.map((call) => (JSON.parse(call.messages.at(-1)!.content).source ? "detail" : "timeline"));
  assert.deepEqual(kinds, ["detail", "detail", "detail", "detail", "timeline"], "one condensing, for Night 3");
  // Another maintenance owes nothing: no call at all.
  assert.equal(await memory.maintain({ runId: RUN }), true);
  assert.equal((await settle(memory)).phase, "ready");
  assert.equal(calls.length, 5);
});

test("a memory model that reports no context size writes every summary whole and condenses in one call", async () => {
  // The maintainer's (2026-11-04): memory sends its requests as they are, the summary prompt and the chapter. Before,
  // the kit waited for configuration and never wrote a summary. Night 1 is far longer than any context the fake has;
  // eight summaries of about 2000 tokens take the timeline past 14k, as on the small model above.
  const summary = (n: number) => filler(`CHAPTER-${n}`, 1150);
  const chapters = mainChapters(8);
  chapters[0] = { ...chapters[0]!, content: filler("NIGHT-1", 60_000) };
  let condensed = 0;
  const { memory, calls, fake } = await setup(undefined, {
    maxContext: null,
    maxOutputTokens: null,
    sources: chapters,
    replies: Array.from({ length: 20 }, () => (messages: Array<{ content: string }>) => {
      const input = JSON.parse(messages.at(-1)!.content);
      if (input.source) return JSON.stringify({ summary: summary(Number(input.source.id.slice(5))) });
      condensed += 1;
      return JSON.stringify({ summary: `CONDENSED-${condensed}` });
    }),
  });
  assert.equal(await memory.maintain({ runId: RUN }), true);
  assert.equal((await settle(memory)).phase, "ready");
  const inputs = calls.map((call) => JSON.parse(call.messages.at(-1)!.content));
  assert.deepEqual(
    inputs.map((input) => (input.source ? input.source.id : "timeline")),
    [...chapters.map((chapter) => chapter.id), "timeline"],
    "each chapter in one call, then one condensing",
  );
  const night1 = inputs[0]!.source;
  assert.ok(estimateTextTokens(night1.content) > 60_000, "Night 1 went whole");
  assert.deepEqual(night1.range, { from: 0, to: night1.range.total, total: night1.range.total });
  const folded = (inputs.at(-1)!.timeline as string).match(/CHAPTER-\d/gu);
  assert.deepEqual(
    folded,
    [1, 2, 3, 4, 5, 6, 7].map((n) => `CHAPTER-${n}`),
    "all but Night 8 in the one call",
  );
  const timeline = parseTimeline(
    (fake.rows.get(memoryId(RUN))!.data as { overview: { content: string } }).overview.content,
  );
  assert.deepEqual([timeline.head, timeline.entries.map((entry) => entry.title)], ["CONDENSED-1", ["Night 8"]]);
});

test("a status the earlier context gate saved never waits for setup: it reads as behind, or ready with nothing owed", async () => {
  // A ready memory the gate saved with a reader it knew no context for (the chat job on an on-device model, say): the
  // kit read it as waiting for setup, and with nothing owed no upkeep ever wrote it again.
  const done = await setup();
  assert.equal(await done.memory.maintain({ runId: RUN }), true);
  assert.equal((await settle(done.memory)).phase, "ready");
  const row = done.fake.rows.get(memoryId(RUN))!;
  const data = row.data as { status: object };
  done.fake.rows.set(row.id, { ...row, data: { ...data, status: { ...data.status, unknownReaders: ["chat"] } } });
  const ready = await done.memory.status(RUN);
  assert.deepEqual([ready.phase, ready.reason, "unknownReaders" in ready], ["ready", undefined, false]);

  const { fake, store, memory, calls } = await setup();
  await fake.documents.create({
    ...runDocTarget("memory", memoryId(RUN)),
    packageId: "otome-forge",
    description: "",
    data: {
      version: 1,
      records: [],
      work: [],
      overview: null,
      status: { phase: "context-unknown", retryable: false, reason: "configure-context", operationId: "op-gate" },
    },
    createdAt: "2026-11-03T08:00:00.000Z",
    updatedAt: "2026-11-03T08:00:00.000Z",
  });
  assert.deepEqual((({ phase, retryable }) => ({ phase, retryable }))(await memory.status(RUN)), {
    phase: "stale",
    retryable: true,
  });
  await recallText({ store, memory }, RUN, { job: "narration", cast: [KAI] });
  for (let turn = 0; turn < 2000 && calls.length < 2; turn += 1) await new Promise((resolve) => setImmediate(resolve));
  assert.equal((await settle(memory)).phase, "ready", "queued by the prompt, with no Retry");
  assert.equal(calls.length, 2, "both chapters summarized");
});

test("a newcomer kept out of the cast after a failed arc plan is named in no summary's content contract", async () => {
  const { store, memory, calls } = await setup();
  // As a failed or cancelled arc plan leaves them (S/story/introduce.ts removeLoveInterest): a unit, not in state.lis.
  const wren = "li-wren-ef56";
  await store.mutateDoc(runDocTarget("unit", unitId(RUN, wren)), normalizeUnit, (unit) => ({
    ...unit,
    id: wren,
    name: "Wren",
  }));
  assert.equal(await memory.maintain({ runId: RUN }), true);
  assert.equal((await settle(memory)).phase, "ready");
  assert.ok(calls.length > 0);
  for (const call of calls) {
    const system = call.messages[0]!.content;
    assert.ok(system.includes("Kai, Mireille are adults"), "the cast is named");
    assert.ok(!system.includes("Wren"), "and nobody the story never introduced");
  }
});

test("an overview saved before the timeline is folded again from the records in the background, once", async () => {
  const { fake, store, memory, calls } = await setup();
  const [main, route, chat] = SOURCES as [ForgeMemorySource, ForgeMemorySource, ForgeMemorySource];
  const MAIN = "SUMMARY: the great telescope was sabotaged.";
  const ROUTE = "SUMMARY: the forged ledger in the archive.";
  const rangeOf = (text: string) => ({ from: 0, to: [...text].length, total: [...text].length });
  const record = (source: ForgeMemorySource, content: string) => ({
    id: source.id,
    kind: source.kind,
    title: source.title,
    order: source.order,
    key: JSON.stringify([source.kind, source.id]),
    fingerprint: `fp-${source.id}`,
    content,
  });
  // As 0.6.18 saved it: every record summarized, an overview over the shared ones that reads like notes, memory ready.
  const old = {
    version: 1,
    records: [record(main, MAIN), record(route, ROUTE), record(chat, chat.content)],
    work: [],
    overview: {
      content: "**Persona:** OLD-OVERVIEW Ava, a stargazer.\n**Choices:**\n- She trusted Mireille.",
      sources: [
        [JSON.stringify(["chapter", main.id]), `fp-${main.id}`],
        [JSON.stringify(["character-story", route.id]), `fp-${route.id}`],
      ],
    },
    status: { phase: "ready", retryable: false, operationId: "op-0.6.18" },
  };
  await fake.documents.create({
    ...runDocTarget("memory", memoryId(RUN)),
    packageId: "otome-forge",
    description: "",
    data: structuredClone(old),
    createdAt: "2026-11-02T08:00:00.000Z",
    updatedAt: "2026-11-02T08:00:00.000Z",
  });
  const saved = () =>
    fake.rows.get(memoryId(RUN))!.data as typeof old & { overviewStyle?: number; overview: { content: string } };

  // Until it is rebuilt, recall leaves the old overview out and sends the saved summaries beside the chapter instead.
  const before = await memory.recall({ runId: RUN, job: "narration", cast: [MIR] });
  assert.equal(before.status.phase, "ready");
  assert.equal(before.overview, "");
  assert.equal(before.lagging, true, "the rebuild is owed, so recall queues it");
  assert.ok(!before.text.includes("OLD-OVERVIEW"));
  // What a story prompt reads meanwhile (S/story/canon.ts): no timeline, and every saved summary.
  const read = savedStory(saved());
  assert.equal(read.timeline, "");
  assert.deepEqual(
    [main, route].map((source) => read.summaries.get(JSON.stringify([source.kind, source.id]))),
    [MAIN, ROUTE],
  );
  // The story's own recall queues it, with no Retry.
  await recallText({ store, memory }, RUN, { job: "narration", cast: [MIR] });
  for (let turn = 0; turn < 2000 && saved().overviewStyle !== 4; turn += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.equal((await settle(memory)).phase, "ready");

  // #2066: rebuilt from the saved summaries alone, with no model call at all: nothing is summarized again, the old
  // overview is never read, and the Character Story stays out of the timeline.
  assert.equal(calls.length, 0, "no call: the saved summaries are the timeline");
  assert.deepEqual(saved().records, old.records, "records and detail summaries are kept as they were");
  assert.equal(saved().overviewStyle, 4, "the new overview carries its form");
  assert.deepEqual(parseTimeline(saved().overview.content), {
    head: "",
    entries: [{ key: JSON.stringify(["chapter", main.id]), title: main.title, text: MAIN }],
  });
  assert.ok(!saved().overview.content.includes("OLD-OVERVIEW"), "the old overview is never folded in");
  assert.equal(rangeOf(MAIN).total, [...MAIN].length);
  const after = await memory.recall({ runId: RUN, job: "narration", cast: [MIR] });
  assert.equal(after.overview, saved().overview.content);
  assert.equal(after.lagging, false);
  assert.deepEqual(
    after.recalls?.map((item) => [item.id, item.content]),
    [[route.id, ROUTE]],
    "her Character Story comes back to her as a small memory, by its saved summary",
  );

  // Nothing is owed any more: another maintenance folds nothing, and the overview stays.
  assert.equal(await memory.maintain({ runId: RUN }), true);
  assert.equal((await settle(memory)).phase, "ready");
  assert.equal(calls.length, 0, "no second rebuild");
  assert.equal(saved().overview.content, after.overview);
});

test("while the rebuild has not folded anything yet, What happened so far… keeps the earlier overview, tidied", async () => {
  // Every summary call fails, so the rebuild never writes a new overview.
  const { fake, memory } = await setup(undefined, {
    replies: Array.from({ length: 12 }, () => new Error("the summary model is down")),
  });
  const [main] = SOURCES as [ForgeMemorySource];
  const MAIN = "SUMMARY: the great telescope was sabotaged.";
  await fake.documents.create({
    ...runDocTarget("memory", memoryId(RUN)),
    packageId: "otome-forge",
    description: "",
    data: {
      version: 1,
      records: [
        {
          id: main.id,
          kind: main.kind,
          title: main.title,
          order: main.order,
          key: JSON.stringify([main.kind, main.id]),
          fingerprint: `fp-${main.id}`,
          content: MAIN,
        },
      ],
      work: [],
      overview: {
        content: "**Choices:**\nShe trusted **Mireille** with the key.",
        sources: [[JSON.stringify(["chapter", main.id]), `fp-${main.id}`]],
      },
      status: { phase: "ready", retryable: false, operationId: "op-0.6.18" },
    },
    createdAt: "2026-11-02T08:00:00.000Z",
    updatedAt: "2026-11-02T08:00:00.000Z",
  });
  await memory.maintain({ runId: RUN });
  const status = await settle(memory);
  assert.notEqual(status.phase, "ready", "the fold failed");
  const stored = fake.rows.get(memoryId(RUN))!.data;
  assert.equal((stored as { overviewStyle?: number }).overviewStyle, undefined, "nothing new was written");
  assert.deepEqual(overviewParagraphs(stored), ["She trusted Mireille with the key."], "the earlier one still shows");
});

test("What happened so far… reads as prose: no bold label line or markdown emphasis, every sentence kept", () => {
  const content = [
    "**Choices:**",
    "- **Ava chose** to stay at the observatory with __Kai__.",
    "__Persona__:",
    "She *never* told Mireille about the _forged_ ledger; ***that*** night was hers.",
    "**She left the pier before dawn.**",
    "2 * 3 lanterns, and the snake_case_label on the crate, stay as written.",
    "**Choices:** she kept the brass key.",
  ].join("\n");
  assert.deepEqual(overviewParagraphs({ overview: { content } }), [
    "Ava chose to stay at the observatory with Kai.",
    "She never told Mireille about the forged ledger; that night was hers.",
    "She left the pier before dawn.",
    "2 * 3 lanterns, and the snake_case_label on the crate, stay as written.",
    "Choices: she kept the brass key.",
  ]);
});

test("a private chat is recalled only for its own love interest, or a scene he is in", async () => {
  const { memory } = await setup();
  await memory.maintain({ runId: RUN });
  await settle(memory);
  const recall = (who: { cast?: string[]; reader?: string }) =>
    memory.recall({ runId: RUN, job: "narration", query: { cues: [`the brass ${PRIVATE} key Kai keeps`] }, ...who });

  for (const [who, sees] of [
    [{ cast: [KAI] }, true],
    [{ cast: [MIR, KAI] }, true],
    [{ reader: KAI }, true],
    [{ cast: [MIR] }, false],
    [{ cast: [] }, false],
    [{ reader: MIR }, false],
    [{}, false],
  ] as const) {
    const result = await recall(who);
    assert.equal(result.status.phase, "ready", JSON.stringify(who));
    const recalled = (result.recalls ?? []).map((item) => item.content).join("\n");
    assert.equal(recalled.includes(PRIVATE), sees, JSON.stringify(who));
    assert.ok(!result.overview.includes(PRIVATE), "never in the overview");
    // The story's chapters are the caller's to send (S/story/canon.ts): no recent canon, and never a ranked detail.
    assert.equal("recent" in result, false);
    assert.ok(result.details.every((detail) => detail.id !== "main-1"));
  }
});

test("the recalls are the newest small memories within 5000 tokens and 1k of leeway, the oldest left out (#2066)", async () => {
  // Twelve of Kai's closed conversations of about 600 tokens each, oldest first, one of Mireille's, newest of all, and
  // one of his far too long to ever fit, newer than his twelve.
  const talk = (n: number) => `TALK-${n} ${Array.from({ length: 300 }, (_, w) => `lamp${(n + w) % 83}`).join(" ")}`;
  const sources: ForgeMemorySource[] = [
    ...Array.from({ length: 12 }, (_, n): ForgeMemorySource => ({
      id: `phone-${n}`,
      kind: "chat",
      title: `Kai's talk ${n}`,
      content: talk(n),
      order: 10000 + n,
      audience: [KAI],
    })),
    { id: "phone-mir", kind: "chat", title: "Mireille's talk", content: "TALK-MIR", order: 20000, audience: [MIR] },
    {
      id: "phone-huge",
      kind: "chat",
      title: "Kai's long talk",
      content: filler("TALK-HUGE", 4000),
      order: 15000,
      audience: [KAI],
    },
  ];
  const { memory, calls } = await setup(undefined, { sources });
  assert.equal(await memory.maintain({ runId: RUN }), true);
  assert.equal((await settle(memory)).phase, "ready");
  assert.equal(calls.length, 0, "a conversation is its own record");
  const { recalls = [] } = await memory.recall({ runId: RUN, job: "chat", reader: KAI });
  assert.ok(!recalls.some((item) => item.id === "phone-huge"), "one that could never fit is passed over");
  const kept = recalls.map((item) => Number(item.id.slice(6)));
  assert.ok(kept.length > 3 && kept.length < 12, `some, never all: ${kept}`);
  assert.deepEqual(
    kept,
    Array.from({ length: kept.length }, (_, n) => 12 - kept.length + n),
    "the newest, in order",
  );
  // Counted as the prompt shows them (S/story/canon.ts renderMemory).
  const shown = recalls.map((item) => `\n\n# Recalled memory: ${item.title}\n${item.content}`).join("");
  assert.ok(estimateTextTokens(shown) <= 5000 + HEADROOM_TOKENS, `${estimateTextTokens(shown)} tokens`);
  assert.ok(estimateTextTokens(shown) > 5000, "the leeway is used before the oldest are left out");
  assert.ok(!recalls.some((item) => item.content.includes("TALK-MIR")), "never another love interest's");

  // What the caller lists in full (P17's newest conversations) is never recalled again, so older ones take its room.
  const listed = await memory.recall({ runId: RUN, job: "chat", reader: KAI, listed: ["phone-11", "phone-10"] });
  const without = (listed.recalls ?? []).map((item) => Number(item.id.slice(6)));
  assert.ok(!without.includes(11) && !without.includes(10), `${without}`);
  assert.equal(without.at(-1), 9);
  assert.ok(Math.min(...without) < Math.min(...kept), "older ones take the listed ones' room");
});

test("the Home note, Read Him and Read Me draw on the newest small memory he holds (#2066)", async () => {
  const { memory } = await setup();
  assert.equal(await memory.maintain({ runId: RUN }), true);
  assert.equal((await settle(memory)).phase, "ready");
  // Kai holds his private conversation; Mireille her Character Story, by its summary.
  assert.match(await recalledLine(memory, RUN, { id: KAI, name: "Kai" }, ["the key"], false), /brass lighthouse key/u);
  assert.match(
    await recalledLine(memory, RUN, { id: MIR, name: "Mireille" }, ["the ledger"], false),
    /Mireille's Ledger: Mireille showed Ava the forged ledger/u,
  );
});

test("a failed source read never recalls another love interest's canon: recall rejects and the caller falls back", async () => {
  const { memory, reads } = await setup();
  await memory.maintain({ runId: RUN });
  await settle(memory);
  // Only the wrapper's own read fails; the kit's read a moment later would succeed.
  reads.fail = 1;
  await assert.rejects(
    memory.recall({
      runId: RUN,
      job: "narration",
      query: { cues: [`the brass ${PRIVATE} key Kai keeps`] },
      cast: [MIR],
    }),
    /the sources could not be read/u,
  );
});

test("every summary leaves a thinking model at least 10240 tokens to reply, or the connection's lower cap", async () => {
  for (const [maxOutputTokens, least] of [
    [null, 10240],
    [65536, 10240],
    [4096, 4096],
  ] as const) {
    const { memory, calls } = await setup(undefined, { maxContext: 131_072, maxOutputTokens });
    assert.equal(await memory.maintain({ runId: RUN }), true);
    assert.equal((await settle(memory)).phase, "ready", `cap ${maxOutputTokens}: summarized, never failed`);
    const sent = calls.map((call) => [JSON.parse(call.messages.at(-1)!.content).source ? "detail" : "overview", call]);
    assert.deepEqual(
      sent.map(([kind]) => kind),
      ["detail", "detail"],
    );
    for (const [kind, call] of sent as Array<[string, (typeof calls)[number]]>) {
      const maxTokens = call.options!.maxTokens!;
      assert.ok(maxTokens >= least, `cap ${maxOutputTokens}: a ${kind} summary may write ${maxTokens}`);
      if (maxOutputTokens) assert.ok(maxTokens <= maxOutputTokens, "never past the connection's own cap");
    }
  }
});

test("a small-context summary model still summarizes, with 10240 tokens of reply room, not GF's 24k headroom", async () => {
  // About 2000 tokens of source on a 16k compress model with no output cap: before #2039 every summary asked for
  // outputBudget's 24192, so no piece ever fit and memory stopped at summary-context-too-small.
  const long: ForgeMemorySource = {
    id: "main-1",
    kind: "chapter",
    title: "The Observatory",
    content: `Ava met Kai at the observatory. ${"The great telescope turned through the night. ".repeat(180)}`,
    order: 10000,
  };
  // A summary much shorter than its source, as a real one is (the overview has a tenth of the context).
  const short = (messages: Array<{ content: string }>) => {
    const input = JSON.parse(messages.at(-1)!.content);
    return JSON.stringify({ summary: input.source ? "Ava met Kai at the observatory." : "Ava met Kai." });
  };
  const { memory, calls, logs } = await setup(undefined, {
    maxContext: 16_384,
    maxOutputTokens: null,
    sources: [long],
    replies: Array.from({ length: 4 }, () => short),
  });
  assert.equal(await memory.maintain({ runId: RUN }), true);
  const status = await settle(memory);
  assert.equal(status.phase, "ready", JSON.stringify(logs.filter((entry) => entry.level === "warn")));
  const detail = calls.find((call) => JSON.parse(call.messages.at(-1)!.content).source)!;
  assert.ok(detail.options!.maxTokens! >= 10240, `the detail may write ${detail.options!.maxTokens}`);
});

test("a second request while maintenance waits or runs folds into the same job and summarizes nothing twice", async () => {
  const { memory, calls, admissions } = await setup();
  assert.deepEqual(
    await Promise.all([memory.maintain({ runId: RUN }), memory.maintain({ runId: RUN, debugMode: true })]),
    [true, true],
  );
  assert.equal((await settle(memory)).phase, "ready");
  assert.equal(admissions.length, 1);
  assert.equal(calls.length, 2);
});

const shown = ({ phase, retryable }: { phase: string; retryable: boolean }) => ({ phase, retryable });

test("a request in the queue's release gap never leaves the status pending, so a failed summary offers Retry", async () => {
  // The host still holds the admission slot a moment after the job body ends, and the last detail summary fails.
  let failing = true;
  let details = 0;
  let held = true;
  let bodyDone!: () => void;
  const ended = new Promise<void>((resolve) => (bodyDone = resolve));
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const gap = await setup(undefined, {
    replies: Array.from({ length: 12 }, () => (messages: Array<{ content: string }>) => {
      const detail = !!JSON.parse(messages.at(-1)!.content).source;
      if (failing && detail && (details += 1) > 1) throw new Error("The summary failed");
      return summarizer(messages);
    }),
    admissionRun: async (operation) => {
      const result = await operation();
      if (held) {
        held = false;
        bodyDone();
        await gate;
      }
      return result;
    },
  });
  assert.equal(await gap.memory.maintain({ runId: RUN }), true);
  await ended;
  assert.equal(await gap.memory.maintain({ runId: RUN }), true, "folded into the job whose body just ended");
  release();
  assert.deepEqual(shown(await settle(gap.memory)), { phase: "error", retryable: true }, "Retry is offered");
  assert.equal(gap.admissions.length, 1);
  failing = false;
  assert.equal(await gap.memory.maintain({ runId: RUN }), true);
  assert.equal(gap.admissions.length, 2, "the Retry is a new job");
  assert.equal((await settle(gap.memory)).phase, "ready");
});

test("a job admission refuses before it starts, with an error that is not its own, leaves nothing pending", async () => {
  let refuse = true;
  const refused = await setup(undefined, {
    admissionRun: async (operation) => {
      if (!refuse) return operation();
      refuse = false;
      throw new Error("refused");
    },
  });
  assert.equal(await refused.memory.maintain({ runId: RUN }), true);
  assert.deepEqual(shown(await settle(refused.memory)), { phase: "stale", retryable: true });
  assert.equal(await refused.memory.maintain({ runId: RUN }), true);
  assert.equal(refused.admissions.length, 2);
  assert.equal((await settle(refused.memory)).phase, "ready");
});

test("maintenance needs a world with a connection, and recall before it holds nothing up", async () => {
  const { memory, calls } = await setup({ narration: "" });
  assert.equal(await memory.maintain({ runId: RUN }), false);
  assert.equal(await memory.maintain({ runId: runIdOf("r-nothing-zzzzzz") }), false);
  const result = await memory.recall({ runId: RUN, job: "narration", cast: [KAI] });
  assert.equal(result.text, "");
  assert.equal(calls.length, 0);
});

test("the memory routes report the memory, queue a Retry and give the overview as paragraphs", async () => {
  const { store, memory, runtime } = await setup();
  const routes = new Map<string, RouteHandler>();
  registerMemoryRoutes(
    {
      get: (path, handler) => routes.set(`GET ${path}`, handler),
      post: (path, handler) => routes.set(`POST ${path}`, handler),
    },
    { store, handle: createHandle(runtime.logger), memory },
  );
  const call = async (method: "GET" | "POST", path: string, run: string) => {
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
    const result = await routes.get(`${method} ${path}`)!(
      { params: { run }, body: method === "POST" ? { timeZone: "UTC", debugMode: false } : undefined },
      reply,
    );
    return { status, payload: payload ?? result };
  };

  const missing = await call("GET", "/runs/:run/memory/status", "r-nothing-zzzzzz");
  assert.deepEqual([missing.status, (missing.payload as { code: string }).code], [404, "not-found"]);
  const nowhere = await call("GET", "/runs/:run/memory/overview", "r-nothing-zzzzzz");
  assert.deepEqual([nowhere.status, (nowhere.payload as { code: string }).code], [404, "not-found"]);
  const overview = async () => {
    const result = await call("GET", "/runs/:run/memory/overview", "r-memory-abcdef");
    assert.equal(result.status, 200);
    return result.payload as { paragraphs: string[] };
  };
  assert.deepEqual(await overview(), { paragraphs: [] }, "nothing before the first summary");
  const before = await call("GET", "/runs/:run/memory/status", "r-memory-abcdef");
  assert.deepEqual((before.payload as { status: { phase: string; reason: string } }).status.phase, "stale");
  const retry = await call("POST", "/runs/:run/memory/retry", "r-memory-abcdef");
  assert.equal((retry.payload as { status: { phase: string } }).status.phase, "pending");
  assert.equal((await settle(memory)).phase, "ready");

  // What happened so far: the saved overview as written, with the shared chapters and never the private chat; only the
  // paragraphs leave the server.
  const shown = await overview();
  assert.deepEqual(Object.keys(shown), ["paragraphs"]);
  const text = shown.paragraphs.join("\n");
  assert.ok(text.includes("The Observatory"), text);
  assert.ok(!text.includes("forged ledger"), "a Character Story is never the timeline's (#2066)");
  assert.ok(!text.includes(PRIVATE), "the private chat is never in the overview");
  assert.ok(!text.includes("main-1") && !text.includes("Canon to date"), "no source key or heading");
  // A heading or bullet a model wrote is dropped from its line, and each line is a paragraph.
  await store.mutateDoc(
    runDocTarget("memory", memoryId(RUN)),
    (data) => data as Record<string, any>,
    (data) => ({
      ...data,
      overview: {
        ...data.overview,
        content: "# Canon to date\nFirst.\n\n- Second.\n  ## The pier\nCanon to date:\nThird *as written*.",
      },
    }),
  );
  assert.deepEqual((await overview()).paragraphs, ["First.", "Second.", "The pier", "Third as written."]);

  // No connection to summarize with: the Retry says so.
  const bare = await setup({ narration: "" });
  const bareRoutes = new Map<string, RouteHandler>();
  registerMemoryRoutes(
    {
      get: (path, handler) => bareRoutes.set(`GET ${path}`, handler),
      post: (path, handler) => bareRoutes.set(`POST ${path}`, handler),
    },
    { store: bare.store, handle: createHandle(bare.runtime.logger), memory: bare.memory },
  );
  let code = 0;
  let body: unknown;
  const reply: OtomeReply = {
    status(value) {
      code = value;
      return reply;
    },
    send(value) {
      body = value;
      return reply;
    },
  };
  await bareRoutes.get("POST /runs/:run/memory/retry")!({ params: { run: "r-memory-abcdef" }, body: {} }, reply);
  assert.deepEqual([code, (body as { code: string }).code], [503, "no-connection"]);
  // The status says why it waits, and how many chapters wait for a summary (a chat is its own record).
  const waiting = (await bareRoutes.get("GET /runs/:run/memory/status")!(
    { params: { run: "r-memory-abcdef" } },
    reply,
  )) as {
    status: { noConnection: boolean; unsummarized: number };
  };
  assert.deepEqual([waiting.status.noConnection, waiting.status.unsummarized], [true, 2]);
  const ready = (await call("GET", "/runs/:run/memory/status", "r-memory-abcdef")).payload as {
    status: { noConnection: boolean; unsummarized: number };
  };
  assert.deepEqual([ready.status.noConnection, ready.status.unsummarized], [false, 0]);
});

test("a summary the provider refuses as too long is status error with its own message, and Retry writes it", async () => {
  // A memory model that reports no context size, behind a provider whose window is too small for the chapter.
  const TOO_LONG =
    "400 This model's maximum context length is 8192 tokens. However, your messages resulted in 9100 tokens.";
  let refuse = true;
  const { store, memory, runtime } = await setup(undefined, {
    maxContext: null,
    replies: Array.from({ length: 12 }, () => (messages: Array<{ content: string }>) => {
      if (refuse) throw new Error(TOO_LONG);
      return summarizer(messages);
    }),
  });
  const routes = new Map<string, RouteHandler>();
  registerMemoryRoutes(
    {
      get: (path, handler) => routes.set(`GET ${path}`, handler),
      post: (path, handler) => routes.set(`POST ${path}`, handler),
    },
    { store, handle: createHandle(runtime.logger), memory },
  );
  const reply: OtomeReply = { status: () => reply, send: () => reply };
  type Shown = {
    status: { phase: string; retryable: boolean; reason?: string; message?: string; unsummarized?: number };
  };
  const shown = async (method: "GET" | "POST", path: string) =>
    (await routes.get(`${method} ${path}`)!({ params: { run: "r-memory-abcdef" }, body: {} }, reply)) as Shown;

  assert.equal(await memory.maintain({ runId: RUN }), true);
  await settle(memory);
  const failed = (await shown("GET", "/runs/:run/memory/status")).status;
  assert.deepEqual(
    [failed.phase, failed.retryable, failed.reason, failed.message, failed.unsummarized],
    ["error", true, "generation-failed", TOO_LONG, 2],
    "the provider's own words, retryable",
  );
  // Nothing retries it by itself; Retry does, and the message goes with the failure.
  refuse = false;
  const retried = (await shown("POST", "/runs/:run/memory/retry")).status;
  assert.deepEqual([retried.phase, retried.message], ["pending", undefined]);
  const done = await settle(memory);
  assert.deepEqual([done.phase, done.message, done.unsummarized], ["ready", undefined, 0]);
});

test("Retry runs at once while the player reads: its banner goes until it fails again, in the new words, or is done", async () => {
  // The Engine refuses background work on a connection while the player's own calls run on it and for 30 s after each
  // (connection-admission.ts): here, every time once the player reads on. Before, Retry's job waited for that
  // admission, backing off for as long as the player read, and the status stayed pending ("Trying the summary
  // again…") all that time.
  const TOO_LONG = "400 This model's maximum context length is 8192 tokens. However, your messages resulted in 9100.";
  const AGAIN = "Upstream 413: the request is larger than this model's 8192-token context.";
  const BUSY = new Error("Connection conn-memory is not available for background generation.");
  let failure: string | null = TOO_LONG;
  let reading = false;
  const { store, memory, runtime, admissions, calls } = await setup(undefined, {
    maxContext: null,
    admissionFailures: new Set([BUSY]),
    admissionRun: async (operation, mode) => {
      if (reading && mode.kind === "background") throw BUSY;
      return operation();
    },
    replies: Array.from({ length: 12 }, () => (messages: Array<{ content: string }>) => {
      if (failure) throw new Error(failure);
      return summarizer(messages);
    }),
  });
  const routes = new Map<string, RouteHandler>();
  registerMemoryRoutes(
    {
      get: (path, handler) => routes.set(`GET ${path}`, handler),
      post: (path, handler) => routes.set(`POST ${path}`, handler),
    },
    { store, handle: createHandle(runtime.logger), memory },
  );
  const reply: OtomeReply = { status: () => reply, send: () => reply };
  const answer = async (method: "GET" | "POST", path: string) =>
    (
      (await routes.get(`${method} ${path}`)!({ params: { run: "r-memory-abcdef" }, body: {} }, reply)) as {
        status: MemoryStatus;
      }
    ).status;
  // The client as it caches each answer (Retry's, then every poll) and the banner each one shows, until it settles.
  let view: MemoryView | undefined;
  const retry = async () => {
    // Pressed, Retry hides the banner at once, while its request is on its way.
    assert.equal(memoryNotice(view, true), null);
    view = nextMemoryView(view, await answer("POST", "/runs/:run/memory/retry"));
    const shown = [memoryNotice(view)];
    for (let turn = 0; view.phase === "pending"; turn += 1) {
      if (turn > 2000) throw new Error("The retried summary never ran: its status stayed pending");
      await new Promise((resolve) => setImmediate(resolve));
      view = nextMemoryView(view, await answer("GET", "/runs/:run/memory/status"));
      shown.push(memoryNotice(view));
    }
    return shown;
  };

  try {
    assert.equal(await memory.maintain({ runId: RUN }), true);
    await settle(memory);
    view = nextMemoryView(view, await answer("GET", "/runs/:run/memory/status"));
    assert.deepEqual(memoryNotice(view), { kind: "failed", message: TOO_LONG });

    // The player reads on and presses Retry; the summary fails again. Nothing shows until it has: then the new words.
    reading = true;
    failure = AGAIN;
    const again = await retry();
    assert.deepEqual([view.phase, view.message], ["error", AGAIN], "the retry ran and failed again");
    assert.deepEqual(again.at(-1), { kind: "failed", message: AGAIN });
    assert.ok(again.length > 1 && again.slice(0, -1).every((notice) => notice === null), JSON.stringify(again));

    // A chapter ends as she reads: its upkeep is refused and backs off. Nobody pressed Retry and no summary was tried,
    // so the failed banner stays, with its Retry (before, the status read `pending`: the banner went, the summary never
    // ran, and nothing offered a Retry).
    failure = null;
    const tried = calls.length;
    assert.equal(await memory.maintain({ runId: RUN }), true);
    for (let poll = 0; poll < 50; poll += 1) {
      await new Promise((resolve) => setImmediate(resolve));
      view = nextMemoryView(view, await answer("GET", "/runs/:run/memory/status"));
      assert.deepEqual(
        [view.phase, view.retrying, memoryNotice(view)],
        ["error", undefined, { kind: "failed", message: AGAIN }],
        `poll ${poll}`,
      );
    }
    assert.equal(calls.length, tried, "the waiting upkeep made no summary call");
    // The Retry pressed then runs that job at once, and this one writes the summary: nothing shows, before or after.
    const done = await retry();
    assert.deepEqual([view.phase, view.message, view.unsummarized], ["ready", undefined, 0]);
    assert.ok(
      done.every((notice) => notice === null),
      JSON.stringify(done),
    );
    assert.deepEqual(
      admissions.map(({ mode }) => (mode as { kind: string }).kind),
      ["background", "foreground", "background", "foreground"],
      "each Retry runs as the player's own request; the upkeep waits for an idle connection",
    );
  } finally {
    memory.dispose();
  }
});

test("a memory model too small for any summary or condensing fails with no call, its status saying why", async () => {
  // The maintainer's rule: the player sees an error and switches the connection. An 8k model leaves no piece of a
  // chapter room beside the summary's reply, so the kit stops with no call; before, the status gave no reason.
  const small = await setup(undefined, { maxContext: 8192, maxOutputTokens: null });
  assert.equal(await small.memory.maintain({ runId: RUN }), true);
  const failed = await settle(small.memory);
  // Otome's own words, not the provider's: their own reason, so the client shows them without "The connection said".
  assert.deepEqual(
    [failed.phase, failed.retryable, failed.reason, failed.message],
    [
      "error",
      true,
      "context-too-small",
      "The Memory connection's model (8,192 tokens of context) is too small to write a summary. Choose a connection with a larger context.",
    ],
  );
  assert.equal(small.calls.length, 0, "no provider call");
  // A 16k model writes each summary, but its timeline's oldest entry alone leaves the condensing no reply room.
  const long = (n: number) => filler(`CHAPTER-${n}`, 3900);
  const condensing = await setup(undefined, {
    maxContext: 16_384,
    maxOutputTokens: null,
    sources: mainChapters(3),
    replies: Array.from(
      { length: 12 },
      () => (messages: Array<{ content: string }>) =>
        JSON.stringify({ summary: long(Number(JSON.parse(messages.at(-1)!.content).source.id.slice(5))) }),
    ),
  });
  assert.equal(await condensing.memory.maintain({ runId: RUN }), true);
  const stuck = await settle(condensing.memory);
  // It has just written every summary, so it is too small for the condensing, not for a summary.
  assert.deepEqual(
    [stuck.phase, stuck.retryable, stuck.reason, stuck.message],
    [
      "error",
      true,
      "context-too-small",
      "The Memory connection's model (16,384 tokens of context) is too small to condense the story's timeline. Choose a connection with a larger context.",
    ],
  );
  assert.equal(condensing.calls.length, 3, "the three summaries, and no condensing call");
});

test("the chapter planner (P5) and the beat narrator (P6) carry the knowledge boundary", () => {
  const bible = (): Bible => ({
    ...normalizeBible({})!,
    age: 30,
    pronouns: { subject: "he", object: "him", possessive: "his" },
    mask: { presents: "Courteous", tells: ["taps the rail", "too still", "looks at the door"] },
    secrets: [{ id: "s", truth: "He broke the telescope.", tells: ["avoids the dome"], revealAt: { stage: 4 } }],
  });
  const units = [
    { ...normalizeUnit({}), id: KAI, name: "Kai", bible: bible() },
    { ...normalizeUnit({}), id: MIR, name: "Mireille", bible: bible() },
  ];
  const world = normalizeWorld({ connections: { narration: "conn-story" } });
  const player = { ...normalizePlayer({}), name: "Ava" };
  const state = normalizeState({ lis: { [KAI]: {}, [MIR]: {} } });
  const nodes: ChapterNode[] = [
    { i: 0, kind: "beat", guide: "They meet at the observatory.", cast: [KAI, MIR] },
    { i: 1, kind: "confrontation", guide: "Kai and Ava argue about the telescope.", cast: [KAI] },
  ];
  const plan = chapterPlanMessages({ world, player, units, state, number: 1, lead: KAI, memory: "" });
  const beat = beatMessages({
    world,
    player,
    units,
    state,
    chapter: { kind: "main", number: 1, title: "The Observatory", lead: KAI, foil: MIR, nodes },
    node: nodes[0]!,
    storySoFar: [],
    memory: "",
  });
  for (const [name, messages] of [
    ["P5", plan],
    ["P6", beat],
  ] as const) {
    // In the story context they share (#2066).
    assert.ok(messages[0]!.content.includes(forgeKnowledgeBoundary), `${name} carries the knowledge boundary`);
    assert.equal(messages[0]!.cacheBreakpoint, true);
  }
});

test("only a prompt a later call continues is marked past its story context, and P5 only on the scenes' connection (#2091)", () => {
  const units = [
    { ...normalizeUnit({}), id: KAI, name: "Kai", bible: normalizeBible({})! },
    { ...normalizeUnit({}), id: MIR, name: "Mireille", bible: normalizeBible({})! },
  ];
  const world = normalizeWorld({ connections: { narration: "conn-story" } });
  const player = { ...normalizePlayer({}), name: "Ava" };
  const state = normalizeState({ lis: { [KAI]: {}, [MIR]: {} } });
  const nodes: ChapterNode[] = [
    { i: 0, kind: "beat", guide: "They meet at the observatory.", cast: [KAI] },
    { i: 1, kind: "beat", guide: "The bell.", cast: [KAI] },
    { i: 2, kind: "confrontation", guide: "Kai and Ava argue.", cast: [KAI] },
  ];
  const chapter = { kind: "main" as const, number: 1, title: "The Observatory", lead: KAI, foil: MIR, nodes };
  const input = { world, player, units, state, chapter, storySoFar: ["SCENE-1", "SCENE-2"], memory: "" };
  const marks = (messages: Array<{ cacheBreakpoint?: boolean }>) =>
    messages.map((message) => !!message.cacheBreakpoint);
  const plan = (sharesCache?: boolean) =>
    chapterPlanMessages({
      world,
      player,
      units,
      state,
      number: 1,
      lead: KAI,
      memory: "",
      ...(sharesCache === undefined ? {} : { sharesCache }),
    });
  assert.deepEqual(marks(plan()), [true, false, false]);
  assert.deepEqual(
    marks(plan(false)),
    [false, false, false],
    "nothing reads a plan's cache on a connection of its own",
  );
  // A scene's instructions and settled scenes are continued by the next scene; a Confrontation's and a Closer's are not.
  assert.deepEqual(marks(beatMessages({ ...input, node: nodes[1]! })), [true, true, true, false]);
  for (const build of [confrontationMessages, closerMessages]) {
    assert.deepEqual(marks(build({ ...input, node: nodes[2]!, li: KAI })), [true, false, false, false]);
  }
});
