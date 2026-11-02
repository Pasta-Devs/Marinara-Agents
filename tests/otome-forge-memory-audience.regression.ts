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
import assert from "node:assert/strict";
import test from "node:test";
import { forgeKnowledgeBoundary } from "@forge-kit/story-memory-integration.mjs";
import type { ForgeMemorySource } from "@forge-kit/story-memory.mjs";
import type {
  Bible,
  ChapterNode,
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
  OVERVIEW_WORDING,
  SUMMARY_WORDING,
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
import {
  beatMessages,
  chapterPlanMessages,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/prompts.ts";
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
  // A side story of the kit's own kind, as Otome's dates and Character Stories are (S/story/canon.ts): in the overview,
  // recalled in detail only for its love interest; otome-forge-beats.regression.ts checks them with memory ready.
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

/** The fake summarizer: a detail echoes its source, an overview joins the previous one with its records. */
function summarizer(messages: Array<{ content: string }>) {
  const input = JSON.parse(messages.at(-1)!.content);
  if (input.source) return JSON.stringify({ summary: `${input.source.title}: ${input.source.content}` });
  const records = input.records.map((record: { content: string }) => record.content).join(" ");
  return JSON.stringify({ summary: [input.previousOverview, records].filter(Boolean).join(" ") });
}

async function setup(
  connections: Record<string, string> = { narration: "conn-story", compress: "conn-memory" },
  options: Pick<FakeRuntimeOptions, "replies" | "admissionRun" | "maxContext" | "maxOutputTokens"> & {
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

test("summaries run on the background lane with the summary wording; a private chat never reaches the overview", async () => {
  const { fake, memory, calls, admissions, logs } = await setup();
  assert.equal(await memory.maintain({ runId: RUN, debugMode: true }), true);
  const status = await settle(memory);
  assert.equal(status.phase, "ready");

  // Two detail summaries and two overview folds; the chat is its own record, so it is never summarized.
  assert.equal(calls.length, 4);
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
  assert.deepEqual(new Set(logged.map((entry) => entry.args[0])), new Set(["memory-detail", "memory-overview"]));

  const saved = fake.rows.get(memoryId(RUN))!.data as {
    overview: { content: string; sources: Array<[string, string]> };
    records: Array<{ kind: string; content: string }>;
  };
  assert.ok(saved.overview.content.includes("forged ledger"), "a Character Story is shared canon");
  assert.ok(!saved.overview.content.includes(PRIVATE));
  assert.ok(saved.overview.sources.every(([key]) => JSON.parse(key)[0] !== "chat"));
  assert.ok(saved.records.some((record) => record.kind === "chat" && record.content.includes(PRIVATE)));
});

test("an overview fold is told the overview is the story's timeline; a detail summary is not", async () => {
  const { memory, calls } = await setup();
  assert.equal(await memory.maintain({ runId: RUN }), true);
  assert.equal((await settle(memory)).phase, "ready");
  const kinds = calls.map((call) => (JSON.parse(call.messages.at(-1)!.content).source ? "detail" : "overview"));
  assert.deepEqual(kinds, ["detail", "detail", "overview", "overview"]);
  for (const [index, call] of calls.entries()) {
    const system = call.messages[0]!.content;
    assert.equal(system.includes(OVERVIEW_WORDING), kinds[index] === "overview", `${kinds[index]} ${index}`);
    assert.ok(system.includes(SUMMARY_WORDING), "every summary keeps the summary wording");
  }
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
  assert.deepEqual(
    before.recent?.map((entry) => [entry.id, entry.content]),
    [
      [main.id, MAIN],
      [route.id, ROUTE],
    ],
  );
  assert.ok(!before.text.includes("OLD-OVERVIEW"));
  // The story's own recall queues it, with no Retry.
  await recallText({ store, memory }, RUN, { job: "narration", cast: [MIR] });
  for (let turn = 0; turn < 2000 && !calls.length; turn += 1) await new Promise((resolve) => setImmediate(resolve));
  assert.equal((await settle(memory)).phase, "ready");

  // Folded from the records alone, one at a time, starting from nothing: no detail summary again, the old one unread.
  const folded = (previousOverview: string, source: ForgeMemorySource, content: string) => ({
    previousOverview,
    records: [
      { id: source.id, kind: source.kind, title: source.title, order: source.order, content, range: rangeOf(content) },
    ],
  });
  assert.deepEqual(
    calls.map((call) => JSON.parse(call.messages.at(-1)!.content)),
    [folded("", main, MAIN), folded(MAIN, route, ROUTE)],
  );
  assert.ok(calls.every((call) => call.messages[0]!.content.includes(OVERVIEW_WORDING)));
  assert.ok(!JSON.stringify(calls).includes("OLD-OVERVIEW"), "the old overview is never folded in");
  assert.deepEqual(saved().records, old.records, "records and detail summaries are kept as they were");
  assert.equal(saved().overviewStyle, 2, "the new overview carries its form");
  assert.equal(saved().overview.content, `${MAIN} ${ROUTE}`);
  const after = await memory.recall({ runId: RUN, job: "narration", cast: [MIR] });
  assert.equal(after.overview, saved().overview.content);
  assert.equal(after.lagging, false);

  // Nothing is owed any more: another maintenance folds nothing, and the overview stays.
  assert.equal(await memory.maintain({ runId: RUN }), true);
  assert.equal((await settle(memory)).phase, "ready");
  assert.equal(calls.length, 2, "no second rebuild");
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
    assert.equal(result.text.includes(PRIVATE), sees, JSON.stringify(who));
    assert.ok(!result.overview.includes(PRIVATE), "never in the overview");
    // The latest chapter is the caller's to send in full: marked, and never ranked as a detail.
    assert.ok(result.recent?.some((entry) => entry.id === "main-1" && entry.latest));
    assert.ok(result.details.every((detail) => detail.id !== "main-1"));
  }
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
      ["detail", "detail", "overview", "overview"],
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
  assert.equal(calls.length, 4);
});

const shown = ({ phase, retryable }: { phase: string; retryable: boolean }) => ({ phase, retryable });

test("a request in the queue's release gap never leaves the status pending, so a failed summary offers Retry", async () => {
  // The host still holds the admission slot a moment after the job body ends, and the overview's last fold fails.
  let failing = true;
  let overviews = 0;
  let held = true;
  let bodyDone!: () => void;
  const ended = new Promise<void>((resolve) => (bodyDone = resolve));
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const gap = await setup(undefined, {
    replies: Array.from({ length: 12 }, () => (messages: Array<{ content: string }>) => {
      const overview = !JSON.parse(messages.at(-1)!.content).source;
      if (failing && overview && (overviews += 1) > 1) throw new Error("The summary failed");
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
  assert.ok(text.includes("The Observatory") && text.includes("forged ledger"), text);
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
    storySoFar: "",
    memory: "",
  });
  for (const [name, messages] of [
    ["P5", plan],
    ["P6", beat],
  ] as const) {
    assert.ok(messages[0]!.content.includes(forgeKnowledgeBoundary), `${name} carries the knowledge boundary`);
  }
});
