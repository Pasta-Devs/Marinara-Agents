// Otome Forge's private memory (M2a): each love interest knows only what he saw or was told. A `chat` source (a date)
// with audience [A] is recalled only for reader A or a scene whose cast includes A, never into the shared overview and
// never by a call that names nobody; the latest chapter is left to the caller, who sends it in full. Summaries run on
// the background lane with the `summary` contract and its neutral wording, never with the knowledge boundary, which
// the story's own writers (P5, P6) carry. The Debug routes report the status and queue a Retry. A request in the
// queue's release gap, or a job admission refuses before it starts, never leaves the status pending.
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
  unitId,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import {
  SUMMARY_WORDING,
  createOtomeMemory,
  type OtomeMemory,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/memory.ts";
import { registerMemoryRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/memory.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import { normalizeState } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import {
  normalizeBible,
  normalizeUnit,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { createOtomeStore } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/store.ts";
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
  // A shared side record of the kit's own kind. Otome's route and repair chapters are `chat` sources, held to their
  // love interest (S/story/canon.ts); otome-forge-beats.regression.ts checks them with memory ready.
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
  options: Pick<FakeRuntimeOptions, "replies" | "admissionRun"> = {},
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
  const memory = createOtomeMemory({ runtime: runtime.runtime, store, readSources: async () => SOURCES });
  return { fake, store, memory, ...runtime };
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

test("the Debug routes report the memory and queue a Retry", async () => {
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
  const before = await call("GET", "/runs/:run/memory/status", "r-memory-abcdef");
  assert.deepEqual((before.payload as { status: { phase: string; reason: string } }).status.phase, "stale");
  const retry = await call("POST", "/runs/:run/memory/retry", "r-memory-abcdef");
  assert.equal((retry.payload as { status: { phase: string } }).status.phase, "pending");
  assert.equal((await settle(memory)).phase, "ready");

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
