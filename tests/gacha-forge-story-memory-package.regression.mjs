// Exercise the shipped completion/status/retry routes with isolated, revision-checked
// saves and a local model fixture. No provider request or personal world is permitted.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { pathToFileURL } from "node:url";
import { estimateTextTokens } from "../sources/forge-kit/shared-token-estimator.mjs";

const packageId = "gacha-forge";
const runId = "story-memory-package-proof";
const sessionId = `${runId}:session`;
const memoryId = `${runId}:summary:memory`;
const clone = (value) => structuredClone(value);
const directory = await mkdtemp(join(tmpdir(), "marinara-forge-story-memory-"));
const modulePath = join(directory, "server.mjs");
await writeFile(modulePath, await readFile(new URL("../packages/gacha-forge/server.mjs", import.meta.url)));
const originalFetch = globalThis.fetch;
let metadataAvailable = true;
let metadataContext = 10000;
after(async () => {
  globalThis.fetch = originalFetch;
  await rm(directory, { recursive: true, force: true });
});
globalThis.fetch = async (input) => {
  const url = new URL(input);
  assert.equal(url.hostname, "127.0.0.1", "Only local connection metadata may be fetched");
  assert.equal(url.pathname, "/api/connections");
  if (!metadataAvailable) return Response.json({}, { status: 403 });
  return Response.json([
    { id: "fixture-memory", provider: "custom", model: "fixture-only", maxContext: metadataContext },
  ]);
};
let sequence = 0;

async function harness({
  progress = 0,
  stored,
  failSessionWrite = false,
  failGeneration = false,
  summarizeReply,
  denyMetadata = false,
  planChapter = 2,
  maxContext = 40000,
} = {}) {
  metadataAvailable = !denyMetadata;
  metadataContext = maxContext;
  const docs = new Map(stored ? clone(stored) : []);
  const routes = new Map();
  const calls = [];
  const requests = [];
  const replies = [];
  const warnings = [];
  const faults = { session: failSessionWrite, generation: failGeneration };
  const seed = (id, kind, data) => {
    docs.set(id, { id, packageId, kind, name: id, revision: 1, data: clone(data) });
  };
  if (!stored) {
    seed("index", "index", {
      activeRunId: runId,
      runs: [
        {
          runId,
          name: "Continuity fixture",
          scenario: "Mari recovers the lighthouse key.",
          connectionId: "fixture-memory",
          protagonist: { name: "Mari" },
          story: { choices: false, preforge: "off" },
          images: { enabled: false },
        },
      ],
    });
    seed(sessionId, "session", {
      progress: { 1: { normal: progress } },
      roster: {},
      account: { level: 100, xp: 0 },
      wallet: { funds: 12345, aether: 42, vigor: 1000 },
    });
    seed(`${runId}:chapter:1`, "chapter-plan", {
      chapter: 1,
      title: "The lighthouse key",
      premise: "UNPLAYED-PLAN-OUTCOME: Mari abandons the keeper. This intended route never happened.",
      nodes: Array.from({ length: 10 }, (_, index) => ({
        index: index + 1,
        type: "story",
        title: `Scene ${index + 1}`,
        goal: "Recover the lighthouse key.",
        guide: "The keeper helps Mari.",
      })),
    });
    for (let index = 0; index < 10; index += 1) {
      seed(`${runId}:beat:1:${index}`, "beat", {
        chapter: 1,
        storyIndex: index,
        segments: [{ speaker: "", text: `Canonical scene ${index + 1}: Mari recovers the lighthouse key.` }],
      });
    }
  }
  const documents = {
    async getById(id, documentId) {
      assert.equal(id, packageId);
      return clone(docs.get(documentId) ?? null);
    },
    async list(id, kind) {
      assert.equal(id, packageId);
      return clone([...docs.values()].filter((doc) => !kind || doc.kind === kind));
    },
    async create(document) {
      assert.equal(document.packageId, packageId);
      if (docs.has(document.id)) return null;
      const saved = { ...clone(document), revision: 1 };
      docs.set(document.id, saved);
      return clone(saved);
    },
    async update(document) {
      assert.equal(document.packageId, packageId);
      if (document.id === sessionId && faults.session) return null;
      const previous = docs.get(document.id);
      if (!previous || previous.revision !== document.expectedRevision) return null;
      const saved = { ...previous, ...clone(document), revision: previous.revision + 1 };
      delete saved.expectedRevision;
      docs.set(document.id, saved);
      return clone(saved);
    },
    async remove(id, documentId, revision) {
      assert.equal(id, packageId);
      return docs.get(documentId)?.revision === revision && docs.delete(documentId);
    },
  };
  const bundled = await import(`${pathToFileURL(modulePath).href}?proof=${sequence++}`);
  await bundled.activate({
    package: { id: packageId, version: "fixture" },
    api: {
      runtime: {
        persistence: { documents },
        logger: {
          info() {},
          warn(...args) {
            warnings.push(args.map(String).join(" "));
          },
          error() {},
          debug() {},
        },
        json: { parseJsonish: JSON.parse },
        languageModels: {
          async resolveForRequest({ connectionId }) {
            assert.equal(connectionId, "fixture-memory");
            return {
              connectionId,
              model: "fixture-only",
              maxContext,
              async chatComplete(messages, options = {}) {
                calls.push(clone(messages));
                requests.push({ messages: clone(messages), maxTokens: options.maxTokens });
                if (faults.generation) throw new Error("Fixture provider failure");
                const memory = messages[0].content.includes("Summarize only the supplied canonical story history");
                const plan = {
                  chapter: planChapter,
                  title: "The keeper's next request",
                  premise: "Return to the keeper after recovering the key.",
                  nodes: Array.from({ length: 10 }, (_, index) =>
                    [1, 4, 8].includes(index)
                      ? {
                          index: index + 1,
                          type: "combat",
                          title: "Guard",
                          setup: "Face a guard.",
                          tier: index === 8 ? "boss" : index === 4 ? "elite" : "soldier",
                        }
                      : {
                          index: index + 1,
                          type: "story",
                          title: "Scene",
                          goal: "Meet the keeper.",
                          guide: "Continue.",
                        },
                  ),
                };
                return {
                  content: JSON.stringify(
                    memory
                      ? { summary: summarizeReply?.(messages) ?? "Mari recovered the lighthouse key with the keeper." }
                      : replies.length
                        ? replies.shift()
                        : plan,
                  ),
                  finishReason: "stop",
                };
              },
            };
          },
        },
      },
      async registerPrivilegedRoutes(register) {
        await register({
          get(path, handler) {
            routes.set(`GET ${path}`, handler);
          },
          post(path, handler) {
            routes.set(`POST ${path}`, handler);
          },
        });
      },
    },
  });
  return {
    calls,
    requests,
    replies,
    warnings,
    faults,
    seed,
    snapshot: () => clone([...docs]),
    data: (id) => clone(docs.get(id)?.data),
    async state() {
      const route = routes.get("GET /state");
      assert.ok(route, "The shipped package registers GET /state");
      return route({ query: { timeZone: "Europe/Warsaw" } });
    },
    async post(path, body = {}) {
      const route = routes.get(`POST ${path}`);
      assert.ok(route, `The shipped package registers POST ${path}`);
      return route({ body: { runId, ...clone(body) } });
    },
  };
}

const ok = (response) => assert.equal(response.ok, true, JSON.stringify(response));
async function settled(host) {
  // Completion/retry intentionally enqueue background work after committing gameplay.
  // Let that queued operation begin before inspecting a previously saved ready/error state.
  await new Promise((resolve) => setImmediate(resolve));
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const response = await host.post("/story-memory/status");
    ok(response);
    if (!["pending", "stale"].includes(response.memory.phase)) return response.memory;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail("Fixture memory work did not settle");
}

test("cached but unplayed chapters and status inspection do not become canonical memories", async () => {
  const host = await harness();
  ok(await host.post("/continuity"));
  ok(await host.post("/story-memory/status"));
  assert.equal(host.calls.length, 0, "Viewing settings must not cause paid generation");
  ok(await host.post("/story-memory/retry"));
  const status = await settled(host);
  assert.equal(status.recordCount, 0);
  assert.equal(host.calls.length, 0, "Generated beats alone are not completed canon");
});

test("successful final normal completion automatically remembers canon within its context budget", async () => {
  const host = await harness({ progress: 9 });
  const beats = host.snapshot().filter(([id]) => id.startsWith(`${runId}:beat:`));
  ok(await host.post("/complete", { chapter: 1, nodeIndex: 9, difficulty: "normal" }));
  const status = await settled(host);
  assert.equal(status.phase, "ready", JSON.stringify(host.warnings));
  assert.equal(status.recordCount, 1);
  assert.ok(status.overviewTokens > 0);
  assert.ok(status.overviewTokens <= status.overviewBudget);
  assert.equal(status.overviewBudget, 4000);
  assert.ok(host.calls.some((messages) => JSON.stringify(messages).includes("Canonical scene 10")));
  assert.ok(
    host.calls.every((messages) => !JSON.stringify(messages).includes("UNPLAYED-PLAN-OUTCOME")),
    "Writer plans are not played canon",
  );
  assert.deepEqual(
    host.snapshot().filter(([id]) => id.startsWith(`${runId}:beat:`)),
    beats,
  );
});

test("opening an existing world automatically compresses and combines completed chapter backlog", async () => {
  const host = await harness({ progress: 10 });
  const session = host.data(sessionId);
  session.progress[2] = { normal: 10 };
  host.seed(sessionId, "session", session);
  const plan = host.data(`${runId}:chapter:1`);
  host.seed(`${runId}:chapter:2`, "chapter-plan", { ...plan, chapter: 2, title: "The keeper's promise" });
  for (let index = 0; index < 10; index += 1)
    host.seed(`${runId}:beat:2:${index}`, "beat", {
      chapter: 2,
      storyIndex: index,
      segments: [{ speaker: "", text: `Second canonical chapter scene ${index + 1}: the keeper promises to return.` }],
    });
  const originals = host.snapshot().filter(([id]) => id.includes(":beat:") || id.includes(":chapter:"));
  ok(await host.state());
  const status = await settled(host);
  assert.equal(status.phase, "ready", JSON.stringify(host.warnings));
  assert.equal(status.chapters, 2);
  assert.equal(status.combinedRecords, 2);
  assert.equal(host.data(memoryId).records.length, 2);
  assert.deepEqual(
    host.snapshot().filter(([id]) => id.includes(":beat:") || id.includes(":chapter:")),
    originals,
  );
  const summaries = () =>
    host.calls.filter((messages) =>
      messages[0]?.content.includes("Summarize only the supplied canonical story history"),
    ).length;
  const calls = summaries();
  ok(await host.state());
  assert.equal((await settled(host)).phase, "ready");
  assert.equal(summaries(), calls, "Routine world refresh does not regenerate unchanged memory");
  const manual = await host.post("/continuity");
  ok(manual);
  assert.equal(manual.chapters.length, 2, "Manual chapter compression remains available alongside automatic memory");
});

test("a failed completion write does not schedule an archive or consume model calls", async () => {
  const host = await harness({ progress: 9, failSessionWrite: true });
  const response = await host.post("/complete", { chapter: 1, nodeIndex: 9, difficulty: "normal" });
  assert.equal(response.error, "write-conflict");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(host.calls.length, 0);
  assert.equal(host.data(memoryId), undefined);
  assert.equal(host.data(sessionId).progress[1].normal, 9);
});

test("replay and a fresh package activation reuse saved memories without regenerating them", async () => {
  const host = await harness({ progress: 9 });
  ok(await host.post("/complete", { chapter: 1, nodeIndex: 9, difficulty: "normal" }));
  assert.equal((await settled(host)).phase, "ready", JSON.stringify(host.warnings));
  const calls = host.calls.length;
  const memory = host.data(memoryId);
  ok(await host.post("/complete", { chapter: 1, nodeIndex: 9, difficulty: "normal" }));
  assert.equal((await settled(host)).phase, "ready", JSON.stringify(host.warnings));
  assert.equal(host.calls.length, calls);
  assert.deepEqual(host.data(memoryId), memory);
  const restarted = await harness({ stored: host.snapshot() });
  ok(await restarted.post("/story-memory/retry"));
  assert.equal((await settled(restarted)).phase, "ready");
  assert.equal(restarted.calls.length, 0, "Restart must retain completed archive and overview");
});

test("a summary provider failure leaves completed gameplay intact and can be retried", async () => {
  const host = await harness({ progress: 9, failGeneration: true });
  ok(await host.post("/complete", { chapter: 1, nodeIndex: 9, difficulty: "normal" }));
  const failure = await settled(host);
  assert.equal(failure.phase, "error");
  assert.equal(failure.retryable, true);
  assert.equal(host.data(sessionId).progress[1].normal, 10);
  host.faults.generation = false;
  ok(await host.post("/story-memory/retry"));
  assert.equal((await settled(host)).phase, "ready", JSON.stringify(host.warnings));
  assert.equal(host.data(sessionId).progress[1].normal, 10);
});

test("automatic continuity retains every saved conversation, beyond the old latest-six slice", async () => {
  const host = await harness({ progress: 10 });
  host.seed(`${runId}:chat:keeper`, "chat", {
    name: "Keeper",
    sessions: Array.from({ length: 9 }, (_, index) => ({
      at: 1000 + index,
      count: 2,
      chapter: 2,
      memory: `Conversation memory ${index + 1}: the keeper gave Mari clue ${index + 1}.`,
      quote: `Remember clue ${index + 1}.`,
    })),
  });
  ok(await host.post("/story-memory/retry"));
  const status = await settled(host);
  assert.equal(status.phase, "ready", JSON.stringify(host.warnings));
  assert.equal(status.recordCount, 10);
  const chats = host.data(memoryId).records.filter((record) => record.kind === "chat");
  assert.equal(chats.length, 9);
  assert.ok(chats.some((record) => record.content.includes("Conversation memory 1:")));
  assert.ok(chats.some((record) => record.content.includes("Conversation memory 9:")));
  // A conversation is private to its unit: it stays its own record, never summarized again or folded into the
  // shared overview.
  assert.doesNotMatch(JSON.stringify(host.calls), /Conversation memory/u);
  assert.equal(host.data(`${runId}:chat:keeper`).sessions.length, 9);
});

test("an opened Character Story is excluded until its final completion commits", async () => {
  const host = await harness({ progress: 10 });
  const unitId = `${runId}:unit:keeper`;
  const session = host.data(sessionId);
  session.roster[unitId] = { level: 20, bondFights: 100 };
  session.bondChapters = { [unitId]: { after: 1, beats: 2, opened: 123456 } };
  host.seed(sessionId, "session", session);
  host.seed(unitId, "unit", { unitId, kind: "character", name: "Keeper", role: "Warrior", affinity: "fire" });
  host.seed(`${runId}:chapter:bond-keeper`, "chapter-plan", {
    chapter: "bond-keeper",
    bondUnitId: unitId,
    title: "The keeper's promise",
    premise: "Keep a promise at the lighthouse.",
    nodes: Array.from({ length: 3 }, (_, index) => ({ index: index + 1, type: "story", title: "Promise" })),
  });
  for (let index = 0; index < 3; index += 1)
    host.seed(`${runId}:beat:bond-keeper:${index}`, "beat", {
      segments: [{ speaker: "Keeper", text: `Promise scene ${index + 1}.` }],
    });
  ok(await host.post("/story-memory/retry"));
  assert.equal((await settled(host)).recordCount, 1, "Cached final beats are not completed Character Story canon");
  assert.ok(!JSON.stringify(host.calls).includes("Promise scene"));
  ok(await host.post("/bond-chapter/complete", { unitId, part: 1, storyIndex: 2 }));
  const complete = await settled(host);
  assert.equal(complete.phase, "ready");
  assert.equal(complete.recordCount, 2);
  assert.equal(host.data(memoryId).records.filter((record) => record.kind === "character-story").length, 1);
  assert.ok(JSON.stringify(host.calls).includes("Promise scene 3."));
});

test("a covered Character Story that reads differently keeps its first memory, and later chapters are still remembered", async () => {
  const host = await harness({
    progress: 10,
    planChapter: 4,
    summarizeReply(messages) {
      const input = JSON.parse(messages[1].content);
      return input.source ? `SUMMARY ${input.source.id}: ${input.source.content.slice(0, 40)}` : "OVERVIEW so far.";
    },
  });
  const unitId = `${runId}:unit:keeper`;
  const session = host.data(sessionId);
  session.roster[unitId] = { level: 20, bondFights: 100 };
  session.bondChapters = { [unitId]: { after: 1, beats: 3, opened: 123456 } };
  host.seed(sessionId, "session", session);
  host.seed(unitId, "unit", { unitId, kind: "character", name: "Keeper", role: "Warrior", affinity: "fire" });
  host.seed(`${runId}:chapter:bond-keeper`, "chapter-plan", {
    chapter: "bond-keeper",
    bondUnitId: unitId,
    title: "The keeper's promise",
    nodes: Array.from({ length: 3 }, (_, index) => ({ index: index + 1, type: "story", title: "Promise" })),
  });
  const promise = (text) => {
    for (let index = 0; index < 3; index += 1)
      host.seed(`${runId}:beat:bond-keeper:${index}`, "beat", {
        segments: [{ speaker: "Keeper", text: `${text} ${index + 1}.` }],
      });
  };
  promise("Promise scene");
  ok(await host.post("/story-memory/retry"));
  assert.equal((await settled(host)).recordCount, 2);
  const first = host.data(memoryId).records;
  // Stored data edited, or rendered differently by an update; then two more chapters are played.
  promise("DRIFTED promise scene");
  const plan = host.data(`${runId}:chapter:1`);
  for (const chapter of [2, 3]) {
    session.progress[chapter] = { normal: 10 };
    host.seed(`${runId}:chapter:${chapter}`, "chapter-plan", { ...plan, chapter, title: `Chapter ${chapter}` });
    for (let index = 0; index < 10; index += 1)
      host.seed(`${runId}:beat:${chapter}:${index}`, "beat", {
        segments: [{ speaker: "", text: `Chapter ${chapter} scene ${index + 1}: Mari keeps the key.` }],
      });
  }
  host.seed(sessionId, "session", session);
  ok(await host.post("/story-memory/retry"));
  const status = await settled(host);
  assert.equal(status.phase, "ready", JSON.stringify(host.warnings));
  assert.equal(status.recordCount, 4, "later chapters are summarized");
  const memory = host.data(memoryId);
  assert.deepEqual(memory.records.slice(0, 2), first, "first canon is kept");
  assert.equal(memory.overview.sources.length, 4);
  // The next chapter is planned from memory, never from the changed text or the full history.
  const start = host.requests.length;
  ok(await host.post("/chapter-plan", { chapter: 4 }));
  const planner = host.requests
    .slice(start)
    .find(({ messages }) => messages[0].content.startsWith("You are the chapter planner"));
  const prompt = planner.messages.map((message) => message.content).join("\n");
  assert.match(prompt, /# Canon to date\nOVERVIEW so far\./u);
  assert.doesNotMatch(prompt, /Chapter 2 scene 10: Mari keeps the key/u, "chapter 2 is not sent in full");
  assert.doesNotMatch(JSON.stringify(host.requests), /DRIFTED/u);
});

test("new chapter generation includes current legacy chats even when pre-forging gave them a later coarse chapter", async () => {
  // Keep this successful canon-generation request within its explicitly ample configured window.
  const configuredWindow = 262144;
  const host = await harness({
    maxContext: configuredWindow,
    progress: 10,
    summarizeReply(messages) {
      const data = JSON.parse(messages[1].content);
      return (
        data.source?.content ??
        [data.previousOverview, ...(data.records || []).map((row) => row.content)].filter(Boolean).join(" ")
      );
    },
  });
  host.seed(`${runId}:chat:keeper`, "chat", {
    name: "Keeper",
    sessions: Array.from({ length: 9 }, (_, index) => ({
      at: 123 + index,
      count: 2,
      chapter: 6,
      memory:
        index === 0 ? "CURRENT-CHAT-MARKER: Keeper asked Mari to bring a silver bell." : `Later conversation ${index}.`,
    })),
  });
  // Summaries are written in the background; writing uses them once they are saved.
  ok(await host.post("/story-memory/retry"));
  assert.equal((await settled(host)).phase, "ready", JSON.stringify(host.warnings));
  ok(await host.post("/chapter-plan", { chapter: 2 }));
  const planner = host.calls.find(
    (messages) => !messages[0].content.includes("Summarize only the supplied canonical story history"),
  );
  assert.ok(planner, "The actual chapter planner ran");
  assert.ok(
    JSON.stringify(planner).includes("CURRENT-CHAT-MARKER"),
    "Current closed chats must contribute despite legacy coarse labels",
  );
  const request = host.requests.find(
    ({ messages }) => !messages[0].content.includes("Summarize only the supplied canonical story history"),
  );
  const inputTokens = request.messages.reduce((sum, message) => sum + estimateTextTokens(message.content) + 4, 0);
  assert.ok(
    inputTokens + request.maxTokens + 512 <= configuredWindow,
    "The actual provider request reserves its real output within the model context",
  );
  assert.equal((await settled(host)).recordCount, 10);
});

test("protected loopback metadata falls back to the public model facade without reading authentication secrets", async () => {
  const host = await harness({ progress: 9, denyMetadata: true });
  ok(await host.post("/story-memory/status"));
  assert.equal(host.calls.length, 0, "Status inspection must not generate text");
  ok(await host.post("/complete", { chapter: 1, nodeIndex: 9, difficulty: "normal" }));
  const status = await settled(host);
  assert.equal(status.phase, "ready", JSON.stringify(host.warnings));
  assert.equal(status.overviewBudget, 4000);
  assert.equal(status.recordCount, 1);
});

test("next-chapter and scene prompts keep three older chapters plus separate character memories and full recent canon", async () => {
  const host = await harness({
    planChapter: 6,
    maxContext: 100000,
    summarizeReply(messages) {
      const input = JSON.parse(messages[1].content);
      // Overview deliberately has no detail markers: only actual recalls can satisfy the assertions.
      return input.source?.content ?? "Mari recovered the lighthouse key with the keeper.";
    },
  });
  const lastChapter =
    "LAST-CHAPTER-BEGIN: Mari recovers the lighthouse key. " +
    "The keeper checked every silver hinge before the travellers left. ".repeat(24) +
    "LAST-CHAPTER-TAIL: The western door remains locked.";
  const session = host.data(sessionId);
  for (let chapter = 1; chapter <= 5; chapter += 1) {
    session.progress[chapter] = { normal: 1 };
    host.seed(`${runId}:chapter:${chapter}`, "chapter-plan", {
      chapter,
      title: `Lighthouse key chapter ${chapter}`,
      nodes: [{ index: 1, type: "story", title: "The lighthouse", goal: "Recover the lighthouse key." }],
    });
    host.seed(`${runId}:beat:${chapter}:0`, "beat", {
      segments: [
        {
          speaker: "",
          text: chapter === 5 ? lastChapter : `MAIN-DETAIL-${chapter}: Mari recovers the lighthouse key.`,
        },
      ],
      ...(chapter === 5
        ? {
            choices: [
              {
                id: "choice-1",
                kind: "small",
                at: 0,
                options: [
                  {
                    id: "option-1",
                    text: "Help the keeper.",
                    selection: { kind: "action", text: "CANON-LAST-CHOICE: Mari helps the keeper." },
                    segments: [{ speaker: "", text: "CANON-LAST-BRANCH: The keeper accepts the lighthouse key." }],
                  },
                  {
                    id: "option-2",
                    text: "Leave the keeper.",
                    selection: { kind: "action", text: "UNPLAYED-ALTERNATIVE: Mari leaves alone." },
                    segments: [{ speaker: "", text: "UNPLAYED-ALTERNATIVE: The keeper waits." }],
                  },
                ],
              },
            ],
            choiceCanon: { "choice-1": "option-1" },
            choiceProtagonist: "Mari",
          }
        : {}),
    });
  }
  const unitId = `${runId}:unit:keeper`;
  session.roster[unitId] = { level: 20, bondFights: 100 };
  session.bondChapters = { [unitId]: { after: 2, beats: 3, opened: 123456 } };
  host.seed(sessionId, "session", session);
  host.seed(unitId, "unit", {
    unitId,
    kind: "character",
    name: "Keeper",
    identitySex: "male",
    role: "Warrior",
    affinity: "fire",
  });
  host.seed(`${runId}:chapter:bond-keeper`, "chapter-plan", {
    chapter: "bond-keeper",
    bondUnitId: unitId,
    title: "The lighthouse promise",
    nodes: Array.from({ length: 3 }, (_, index) => ({ index: index + 1, type: "story", title: "Promise" })),
  });
  for (let index = 0; index < 3; index += 1)
    host.seed(`${runId}:beat:bond-keeper:${index}`, "beat", {
      segments: [
        { speaker: "Keeper", text: `CHARACTER-STORY-MARKER: Mari recovers the lighthouse key, promise ${index}.` },
      ],
    });
  host.seed(`${runId}:chat:keeper`, "chat", {
    name: "Keeper",
    sessions: [
      {
        at: 123,
        count: 2,
        chapter: 5,
        memoryPosition: { chapter: 5, nodeIndex: 1 },
        memory: "CHAT-MEMORY-MARKER: Mari recovers the lighthouse key after consulting the keeper.",
      },
    ],
  });
  const requestAfter = (start, kind = "chapter planner") => {
    const request = host.requests
      .slice(start)
      .find(({ messages }) => messages[0].content.startsWith(`You are the ${kind}`));
    assert.ok(request, "The actual shipped writer calls the fixture provider");
    return request.messages.map((message) => message.content).join("\n");
  };
  const checkRecallPools = (prompt, { chat = true } = {}) => {
    const sections = [
      ...prompt.matchAll(/# Recalled (chapter|character-story|chat): ([^\n]+)\n([\s\S]*?)(?=\n# |$)/gu),
    ];
    const chapters = sections.filter((section) => section[1] === "chapter");
    assert.equal(chapters.length, 3, "Three chapter recalls remain available alongside both character-memory kinds");
    assert.ok(
      sections.some((section) => section[1] === "character-story" && section[3].includes("CHARACTER-STORY-MARKER")),
      "Character Story recall has its own quota",
    );
    assert.equal(
      prompt.match(/CHAT-MEMORY-MARKER/gu)?.length ?? 0,
      chat ? 1 : 0,
      chat
        ? "The writer lists the conversation itself, so recall neither repeats it nor spends a side slot on it"
        : "A unit's private chat stays out of scenes without it",
    );
    assert.ok(
      chapters.every((section) => /^Lighthouse key chapter [1-4]$/u.test(section[2])),
      "The full last chapter does not consume an older-chapter recall slot",
    );
    assert.equal(new Set(chapters.map((section) => section[2])).size, 3);
    assert.ok(
      prompt.includes(lastChapter),
      "The entire last completed chapter, including its tail, reaches the provider",
    );
    assert.ok(prompt.includes("CANON-LAST-CHOICE") && prompt.includes("CANON-LAST-BRANCH"));
    assert.ok(!prompt.includes("UNPLAYED-ALTERNATIVE"), "Only the saved first-choice branch enters recent canon");
    assert.match(prompt, /KNOWLEDGE BOUNDARY: a character knows only what they saw/u);
  };
  const summaries = () =>
    host.requests.filter(({ messages }) =>
      messages[0].content.includes("Summarize only the supplied canonical story history"),
    ).length;
  // Summaries are written in the background; writing uses them once they are saved and never pays for them.
  ok(await host.post("/story-memory/retry"));
  assert.equal((await settled(host)).phase, "ready", JSON.stringify(host.warnings));
  const summarized = summaries();
  ok(await host.post("/chapter-plan", { chapter: 6 }));
  checkRecallPools(requestAfter(0));
  assert.equal(summaries(), summarized, "the chapter plan neither waits for nor pays for a summary");
  assert.equal((await settled(host)).recordCount, 7, "All five chapters and both character sources remain archived");

  session.progress[6] = { normal: 1 };
  host.seed(sessionId, "session", session);
  host.seed(`${runId}:chapter:6`, "chapter-plan", {
    chapter: 6,
    title: "The current lighthouse chapter",
    nodes: [
      { index: 1, type: "story", title: "Arrive", goal: "Recover the lighthouse key." },
      // A scene recalls a unit's private conversations only when that unit is in it.
      { index: 2, type: "story", title: "Continue", goal: "Mari recovers the lighthouse key with the keeper." },
      { index: 3, type: "story", title: "Alone", goal: "Mari walks alone to the western door." },
    ],
  });
  const currentPrefix = "CURRENT-CHAPTER-PREFIX: Mari raises the lighthouse key above the silver lock.";
  host.seed(`${runId}:beat:6:0`, "beat", { segments: [{ speaker: "", text: currentPrefix }] });
  host.replies.push({ places: [], segments: [{ speaker: "", text: "The next door opens." }] });
  const start = host.requests.length;
  ok(await host.post("/beat", { chapter: 6, storyIndex: 1 }));
  const scenePrompt = requestAfter(start, "narrator");
  checkRecallPools(scenePrompt);
  assert.ok(scenePrompt.includes(currentPrefix), "The played current chapter stays in addition to recalled history");
  host.replies.push({ places: [], segments: [{ speaker: "", text: "The western door is cold." }] });
  const alone = host.requests.length;
  ok(await host.post("/beat", { chapter: 6, storyIndex: 2 }));
  checkRecallPools(requestAfter(alone, "narrator"), { chat: false });
});

test("memory waiting for Retry trims legacy history oldest first, so a long world still writes its scene", async () => {
  const scene = async (maxContext) => {
    const host = await harness({ maxContext });
    const session = host.data(sessionId);
    for (let chapter = 1; chapter <= 30; chapter += 1) {
      session.progress[chapter] = { normal: 1 };
      host.seed(`${runId}:chapter:${chapter}`, "chapter-plan", {
        chapter,
        title: `Chapter ${chapter}`,
        nodes: [{ index: 1, type: "story", title: "Scene", goal: "Tend the lamp." }],
      });
      host.seed(`${runId}:beat:${chapter}:0`, "beat", {
        segments: [
          {
            speaker: "",
            text: `CHAPTER-${chapter}-START ${"The keeper tends the lamp. ".repeat(800)}CHAPTER-${chapter}-END`,
          },
        ],
      });
    }
    session.progress[31] = { normal: 1 };
    host.seed(sessionId, "session", session);
    host.seed(`${runId}:chapter:31`, "chapter-plan", {
      chapter: 31,
      title: "Now",
      nodes: [0, 1].map((index) => ({ index: index + 1, type: "story", title: "Scene", goal: "Tend the lamp." })),
    });
    host.seed(`${runId}:beat:31:0`, "beat", { segments: [{ speaker: "", text: "CURRENT-SCENE-MARKER" }] });
    host.seed(memoryId, "summary", { status: { phase: "error", retryable: true, reason: "memory-unavailable" } });
    host.replies.push({ places: [], segments: [{ speaker: "", text: "The lamp holds." }] });
    const response = await host.post("/beat", { chapter: 31, storyIndex: 1 });
    const request = host.requests.find(({ messages }) => messages[0].content.startsWith("You are the narrator"));
    return { response, request, prompt: request?.messages.map((message) => message.content).join("\n") ?? "" };
  };
  const tight = await scene(32768);
  ok(tight.response);
  for (const kept of ["CHAPTER-30-START", "CHAPTER-30-END", "CURRENT-SCENE-MARKER"])
    assert.ok(tight.prompt.includes(kept), kept);
  assert.ok(!tight.prompt.includes("CHAPTER-1-START"), "the oldest chapter goes first");
  const size = tight.request.messages.reduce((sum, message) => sum + estimateTextTokens(message.content) + 4, 0);
  assert.ok(tight.request.maxTokens >= 8192 && size + tight.request.maxTokens + 512 <= 32768);
  const roomy = await scene(400000);
  ok(roomy.response);
  assert.ok(roomy.prompt.includes("CHAPTER-1-START"), "a world that fits keeps all of its history");
});
