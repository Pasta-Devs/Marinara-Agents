// Otome Forge's reads on a long story (M7 playtest): the Engine's documents.list returns every world's documents of a
// kind, so a route reads its own run's units and threads by id; and the memory's sources (every chapter's beats) are
// read once per store write, not once per summary piece, so a first summary pass on a long story stays bounded.
import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityLanguageModelMessage } from "@marinara-engine/shared";
import type {
  Beat,
  Chapter,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import {
  createHandle,
  type OtomeReply,
  type RouteHandler,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/http.ts";
import {
  beatId,
  chapterId,
  chatId,
  runDocTarget,
  runIdOf,
  stateId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import {
  createOtomeMemory,
  keptSources,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/memory.ts";
import { registerHomeRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/home.ts";
import { registerRunRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/runs.ts";
import {
  normalizeState,
  readRun,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import {
  normalizeBeat,
  normalizeChapter,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story.ts";
import { KAI, MIR, SOL, json, storyWorld } from "./fixtures/otome-forge-story.ts";
import type { FakeDocuments } from "./fixtures/otome-forge-fakes.ts";

const OTHER_RUN = "r-other0-bbbbbb";

/** Copies every document of `from` to the run `to`: a second world in the same profile. */
function copyWorld(fake: FakeDocuments, from: string, to: string) {
  for (const row of [...fake.rows.values()]) {
    if (!row.id.startsWith(`${from}:`)) continue;
    const id = row.id.replace(from, to);
    fake.rows.set(id, { ...structuredClone(row), id });
  }
}

/** Every documents.list call by kind, and every getById by id, from now on. */
function watchReads(fake: FakeDocuments) {
  const lists: string[] = [];
  const gets: string[] = [];
  const { list, getById } = fake.documents;
  fake.documents.list = (packageId, kind) => {
    lists.push(kind);
    return list(packageId, kind);
  };
  fake.documents.getById = (packageId, id) => {
    gets.push(id);
    return getById(packageId, id);
  };
  return { lists, gets };
}

/** GET routes of `register` on a fake router, answered like Fastify, with debug off. */
function getRoutes(register: Array<(router: any, deps: any) => void>, deps: object, runKey: string) {
  const routes = new Map<string, RouteHandler>();
  const router = {
    get: (path: string, handler: RouteHandler) => routes.set(path, handler),
    post: () => undefined,
  };
  for (const add of register) add(router, deps);
  return async (path: string) => {
    const handler = routes.get(path);
    assert.ok(handler, `GET ${path} is registered`);
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
    const result = await handler(
      { method: "GET", url: path, params: { run: runKey }, query: { timeZone: "UTC", debugMode: false } },
      reply,
    );
    return { status, body: (result === reply ? payload : result) as Record<string, any> };
  };
}

/** One unread message from `li` in their thread of run `runId`. */
function unreadThread(fake: FakeDocuments, runId: string, li: string) {
  const id = chatId(runId, li);
  fake.rows.set(id, {
    id,
    packageId: "otome-forge",
    kind: "chat",
    name: "Otome Forge chat",
    description: "",
    data: {
      version: 1,
      li,
      messages: [{ id: "m-1", who: "li", text: "Awake?", at: "2026-10-28T09:00:00.000Z" }],
      sessions: [],
      seenAt: null,
      suggestions: [],
    },
    revision: 1,
    createdAt: "2026-10-28T09:00:00.000Z",
    updatedAt: "2026-10-28T09:00:00.000Z",
  });
}

test("a run's units and Home's threads are read by id: another world's are never loaded", async () => {
  const t = await storyWorld({ runKey: "r-reads1-aaaaaa" });
  const other = runIdOf(OTHER_RUN);
  copyWorld(t.fake, t.runId, other);
  unreadThread(t.fake, t.runId, KAI);
  unreadThread(t.fake, other, KAI);
  unreadThread(t.fake, other, MIR);
  const { lists, gets } = watchReads(t.fake);

  const run = await readRun(t.store, t.runId);
  assert.deepEqual(
    run?.units.map((unit) => unit.id),
    [KAI, MIR, SOL],
    "its own units, in cast order",
  );
  assert.deepEqual(lists, [], "no list: the Engine's would return every world's units");
  assert.ok(!gets.some((id) => id.startsWith(`${other}:`)), "nothing of the other world is read");

  const get = getRoutes(
    [registerRunRoutes, registerHomeRoutes],
    { ...t.deps, handle: createHandle(t.runtime.logger) },
    "r-reads1-aaaaaa",
  );
  lists.length = 0;
  gets.length = 0;
  const view = await get("/runs/:run");
  assert.equal(view.status, 200);
  assert.deepEqual(
    view.body.view.lis.map((li: { id: string }) => li.id),
    [KAI, MIR, SOL],
  );
  const home = await get("/runs/:run/home");
  assert.equal(home.status, 200, JSON.stringify(home.body));
  assert.equal(home.body.unread, 1, "only this world's unread message counts");
  assert.ok(!lists.includes("unit") && !lists.includes("chat"), `lists: ${lists.join(", ")}`);
  assert.ok(!gets.some((id) => id.startsWith(`${other}:`)), "nothing of the other world is read");
});

// ── Memory sources ──

const AT = "2026-10-28T10:00:00.000Z";

/** A completed main chapter `n` led by Kai, with `beats` beats of one line each. */
async function completeChapter(t: Awaited<ReturnType<typeof storyWorld>>, n: number, beats: number) {
  const key = `main-${n}`;
  const chapter: Chapter = {
    key,
    kind: "main",
    number: n,
    lead: KAI,
    title: `Night ${n}`,
    tags: [],
    summary: "",
    nodes: Array.from({ length: beats }, (_, i) => ({ i, kind: "beat" as const, guide: "The scene.", cast: [KAI] })),
    ledger: { relationship: [], conflict: [], offscreen: [] },
    plannedAt: AT,
    connectionId: "conn-text",
  };
  await t.store.mutateDoc(runDocTarget("chapter", chapterId(t.runId, key)), normalizeChapter, () => chapter);
  for (let i = 0; i < beats; i += 1) {
    const beat: Beat = {
      key,
      i,
      kind: "beat",
      places: [],
      segments: [{ speaker: "", text: `CANON-${n}-${i}: the lanterns along the quay.` }],
      choices: [],
      choiceCanon: {},
      effects: {},
      applied: {},
      musicMood: "tense",
      readThrough: 0,
      written: { at: AT, connectionId: "conn-text", model: "fake" },
      rewrites: 0,
    };
    await t.store.mutateDoc(runDocTarget("beat", beatId(t.runId, key, i)), normalizeBeat, () => beat);
  }
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    chapters: { ...state.chapters, [key]: { beatsRead: beats, completed: AT, applied: [] } },
  }));
}

test("the memory's sources are read once until the store writes, and a write shows in the next read", async () => {
  const t = await storyWorld({ runKey: "r-reads2-aaaaaa" });
  await completeChapter(t, 1, 2);
  const read = keptSources(t.store);
  const { gets } = watchReads(t.fake);
  const beatReads = () => gets.filter((id) => id.includes(":beat:")).length;

  const first = await read(t.runId);
  assert.ok(first.some((source) => source.content.includes("CANON-1-0")));
  const once = beatReads();
  assert.equal(once, 2, "each beat once");
  assert.equal(await read(t.runId), first, "nothing written: the same sources, read again from nothing");
  assert.equal(beatReads(), once);

  await t.store.mutateDoc(runDocTarget("beat", beatId(t.runId, "main-1", 1)), normalizeBeat, (beat) => ({
    ...beat!,
    segments: [{ speaker: "", text: "CHANGED: the north light is out." }],
  }));
  const written = beatReads();
  const after = await read(t.runId);
  assert.ok(
    after.some((source) => source.content.includes("CHANGED")),
    "a write through the store is seen",
  );
  assert.equal(beatReads(), written + once, "read afresh, once");
});

test("a first summary pass on a long story reads each beat a bounded number of times", async () => {
  // The fake summarizer: a detail echoes its source, an overview joins the previous one with its records.
  const summarizer = (messages: CapabilityLanguageModelMessage[]) => {
    const input = JSON.parse(messages.at(-1)!.content);
    if (input.source) return json({ summary: `${input.source.title}: ${input.source.content}` });
    const records = input.records.map((record: { content: string }) => record.content).join(" ");
    return json({ summary: [input.previousOverview, records].filter(Boolean).join(" ") });
  };
  const t = await storyWorld({ runKey: "r-reads3-aaaaaa", replies: Array.from({ length: 80 }, () => summarizer) });
  const CHAPTERS = 6;
  const BEATS = 3;
  for (let n = 1; n <= CHAPTERS; n += 1) await completeChapter(t, n, BEATS);
  const { gets } = watchReads(t.fake);
  const memory = createOtomeMemory({ runtime: t.runtime, store: t.store });
  try {
    assert.equal(await memory.maintain({ runId: t.runId }), true);
    for (let turn = 0; turn < 5000 && (await memory.status(t.runId)).phase === "pending"; turn += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    assert.equal((await memory.status(t.runId)).phase, "ready");
  } finally {
    memory.dispose();
  }
  const perBeat = gets.filter((id) => id.includes(":beat:")).length / (CHAPTERS * BEATS);
  // The kit checks the sources before every paid piece; read afresh each time, that was once per piece per beat (M7
  // probe on 20 chapters: ~300 reads of every beat). Nothing is written to them during the pass.
  assert.ok(perBeat <= 2, `each beat read ${perBeat} times`);
});
