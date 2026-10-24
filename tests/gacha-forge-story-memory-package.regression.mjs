// Exercise the shipped completion/status/retry routes with isolated, revision-checked
// saves and a local model fixture. No provider request or personal world is permitted.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { pathToFileURL } from "node:url";
import { estimateTextTokens } from "../sources/engine/packages/shared/dist/utils/token-estimator.js";

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
after(async () => {
  globalThis.fetch = originalFetch;
  await rm(directory, { recursive: true, force: true });
});
globalThis.fetch = async (input) => {
  const url = new URL(input);
  assert.equal(url.hostname, "127.0.0.1", "Only local connection metadata may be fetched");
  assert.equal(url.pathname, "/api/connections");
  if (!metadataAvailable) return Response.json({}, { status: 403 });
  return Response.json([{ id: "fixture-memory", provider: "custom", model: "fixture-only", maxContext: 10000 }]);
};
let sequence = 0;

async function harness({
  progress = 0,
  stored,
  failSessionWrite = false,
  failGeneration = false,
  summarizeReply,
  denyMetadata = false,
} = {}) {
  metadataAvailable = !denyMetadata;
  const docs = new Map(stored ? clone(stored) : []);
  const routes = new Map();
  const calls = [];
  const requests = [];
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
              maxContext: 10000,
              async chatComplete(messages, options = {}) {
                calls.push(clone(messages));
                requests.push({ messages: clone(messages), maxTokens: options.maxTokens });
                if (faults.generation) throw new Error("Fixture provider failure");
                const memory = messages[0].content.includes("Summarize only the supplied canonical story history");
                const plan = {
                  chapter: 2,
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
    warnings,
    faults,
    seed,
    snapshot: () => clone([...docs]),
    data: (id) => clone(docs.get(id)?.data),
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
  assert.equal(status.overviewBudget, 1000);
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
  assert.equal(host.data(memoryId).records.filter((record) => record.kind === "chat").length, 9);
  const prompts = JSON.stringify(host.calls);
  assert.ok(prompts.includes("Conversation memory 1:"));
  assert.ok(prompts.includes("Conversation memory 9:"));
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

test("new chapter generation includes current legacy chats even when pre-forging gave them a later coarse chapter", async () => {
  const host = await harness({
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
    inputTokens + request.maxTokens + 512 <= 10000,
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
  assert.equal(status.overviewBudget, 1000);
  assert.equal(status.recordCount, 1);
});
