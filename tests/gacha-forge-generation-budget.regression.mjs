// Activated package routes observe the real SDK completion options with local controlled transport.
// Private-dispatch cases import an unchanged temporary payload with an added export only; they
// prove the shared boundary separately from route registration and Engine/provider enforcement.
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createChatRuntime, chatRunId, chatUnitId, chatConnectionId } from "./fixtures/gacha-forge-chat-runtime.mjs";

const answerFloor = 8192;
const normalBudget = answerFloor + 16000;
const model = "controlled-same-main-model";
const directory = await mkdtemp(join(tmpdir(), "forge-generation-budget-"));
const payload = join(directory, "server.mjs");
const source = await readFile(
  process.env.GACHA_CHAT_SERVER_UNDER_TEST || new URL("../packages/gacha-forge/server.mjs", import.meta.url),
  "utf8",
);
await writeFile(payload, source + "\nexport { dS as budgetDispatcher };\n");
const { budgetDispatcher } = await import(pathToFileURL(payload).href);
after(() => rm(directory, { recursive: true, force: true }));

async function routeFixture({ maxContext = 262144, maxOutputTokens = null } = {}) {
  const stored = new Map();
  const seed = (id, kind, data) => stored.set(id, { id, kind, packageId: "gacha-forge", revision: 1, data });
  seed("index", "index", {
    activeRunId: chatRunId,
    runs: [
      {
        runId: chatRunId,
        name: "Budget proof",
        scenario: "A lighthouse garden.",
        connectionId: chatConnectionId,
        protagonist: { name: "Mari" },
        images: { off: true },
        story: { choices: false, preforge: "off", dailyUnitMessages: 1 },
      },
    ],
  });
  seed(`${chatRunId}:session`, "session", {
    roster: { [chatUnitId]: { level: 20, bondFights: 100000, bondCurve: 2 } },
    wallet: { vigor: 100, funds: 10000, aether: 1000 },
    account: { level: 100, xp: 0 },
    progress: {},
    chatChannel: { name: "Lantern Line", blurb: "A saved lighthouse channel." },
  });
  seed(chatUnitId, "unit", { unitId: chatUnitId, kind: "character", name: "Arden", rarity: 5 });
  seed(`${chatRunId}:chat:arden`, "chat", {
    unitId: chatUnitId,
    name: "Arden",
    messages: [{ id: "prior", who: "unit", text: "A saved earlier message." }],
    sessions: [],
  });
  const oldPayload = process.env.GACHA_CHAT_SERVER_UNDER_TEST;
  process.env.GACHA_CHAT_SERVER_UNDER_TEST = payload;
  let f;
  try {
    f = await createChatRuntime({ stored });
  } finally {
    if (oldPayload === undefined) delete process.env.GACHA_CHAT_SERVER_UNDER_TEST;
    else process.env.GACHA_CHAT_SERVER_UNDER_TEST = oldPayload;
  }
  assert.equal(f.calls.length, 0, "Saved channel setup makes no unrelated model request");
  f.transport.maxContext = maxContext;
  f.transport.maxOutputTokens = maxOutputTokens;
  f.transport.completionOptions = [];
  f.transport.reply = () => "Arden: A patient reply from the lighthouse.";
  const fetchBefore = globalThis.fetch;
  const parameters = {
    reasoningEffort: "max",
    verbosity: "high",
    enabledParameters: { reasoningEffort: true, verbosity: true },
  };
  globalThis.fetch = (input, options) =>
    new URL(input).pathname === "/api/connections"
      ? Promise.resolve(
          Response.json([
            { id: chatConnectionId, provider: "custom", model, maxContext, defaultParameters: parameters },
          ]),
        )
      : fetchBefore(input, options);
  let tail = Promise.resolve();
  f.persistence.transaction = (work) => {
    const pending = tail.then(async () => {
      const before = structuredClone(f.docs);
      try {
        return await work({ documents: f.persistence.documents });
      } catch (error) {
        f.docs.clear();
        for (const entry of before) f.docs.set(...entry);
        throw error;
      }
    });
    tail = pending.catch(() => {});
    return pending;
  };
  const due = () => f.post("/chat/proactive/due", { timeZone: "UTC" });
  const makeDue = () => {
    const state = f.session().proactiveMessages;
    state.days[new Date().toISOString().slice(0, 10)].nextAt = Date.now() - 1;
    state.lastSeenAt = Date.now();
  };
  const assertSelected = (requests, effort = parameters.reasoningEffort) => {
    assert.ok(requests.length);
    for (const request of requests) {
      assert.equal(request.maxTokens, normalBudget, "8192 answer tokens plus the existing16000 reasoning reserve");
      assert.equal(request.reasoningEffort, effort);
      assert.equal(request.verbosity, "high");
    }
    assert.ok(f.resolved.every((request) => request.connectionId === chatConnectionId));
    assert.ok(f.calls.every((call) => call.body.model === model));
  };
  return { ...f, parameters, due, makeDue, assertSelected };
}

async function dispatch({
  options = { maxTokens: 16700 },
  omitted = false,
  maxContext = 262144,
  maxOutputTokens = null,
  starved = false,
} = {}) {
  const calls = [];
  const fetchBefore = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json([
      {
        id: chatConnectionId,
        provider: "custom",
        model,
        maxContext,
        defaultParameters: { reasoningEffort: "max", verbosity: "high" },
      },
    ]);
  const runtime = {
    logger: { warn() {}, info() {}, debug() {} },
    languageModels: {
      async resolveForRequest(request) {
        assert.equal(request.connectionId, chatConnectionId);
        return {
          connectionId: chatConnectionId,
          model,
          maxContext,
          maxOutputTokens,
          async chatComplete(messages, requestOptions) {
            calls.push({ messages, options: requestOptions });
            if (starved && calls.length === 1)
              return {
                content: "",
                finishReason: "length",
                usage: {
                  completionTokens: requestOptions.maxTokens,
                  completionReasoningTokens: requestOptions.maxTokens,
                },
              };
            return { content: "Accepted.", finishReason: "stop" };
          },
        };
      },
    },
  };
  try {
    const result = await budgetDispatcher({
      runtime,
      runId: "private-budget-proof",
      connectionId: chatConnectionId,
      messages: [{ role: "user", content: "A short controlled request." }],
      ...(omitted ? {} : { options }),
      parse: (value) => ({ value }),
      label: "private-budget-boundary",
    });
    return { result, calls };
  } finally {
    globalThis.fetch = fetchBefore;
  }
}

test("actual normal character replies reserve8192 answer tokens and preserve model/reasoning", async () => {
  const f = await routeFixture();
  try {
    const reply = await f.post("/chat/send", { text: "How is the lighthouse?" });
    assert.equal(reply.body.ok, true, JSON.stringify(reply));
    assert.equal(f.transport.completionOptions.length, 1);
    f.assertSelected(f.transport.completionOptions);
  } finally {
    await f.close();
  }
});

test("actual proactive character messages share the full answer budget", async () => {
  const f = await routeFixture();
  try {
    assert.equal((await f.due()).body.status, "scheduled");
    f.makeDue();
    const reply = await f.due();
    assert.equal(reply.body.status, "sent", JSON.stringify(reply));
    assert.equal(f.transport.completionOptions.length, 1);
    f.assertSelected(f.transport.completionOptions);
  } finally {
    await f.close();
  }
});

test("actual automatic and explicit message retries retain the budget and current reasoning setting", async () => {
  const f = await routeFixture();
  try {
    f.transport.reply = () => "";
    assert.equal((await f.post("/chat/send", { text: "Please answer this." })).body.ok, false);
    assert.equal(f.transport.completionOptions.length, 2, "Existing bounded empty-response repair");
    f.assertSelected(f.transport.completionOptions);
    assert.deepEqual(
      f.transport.completionOptions.map((request) => request.temperature),
      [0.95, 0.35],
    );
    f.parameters.reasoningEffort = "high";
    f.transport.reply = () => "Arden: I heard you.";
    assert.equal((await f.post("/chat/send", { retry: true })).body.ok, true);
    assert.equal(f.transport.completionOptions.length, 3);
    f.assertSelected(f.transport.completionOptions.slice(2), "high");
  } finally {
    await f.close();
  }
});

for (const [name, options] of [
  ["omitted", undefined],
  ["empty", {}],
  ["zero", { maxTokens: 0 }],
  ["legacy4096", { maxTokens: 4096 }],
]) {
  test(`private shared dispatcher supplies an explicit safe budget for ${name} options`, async () => {
    const f = await dispatch({ options, omitted: name === "omitted" });
    assert.equal(f.result.ok, true);
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].options.maxTokens, normalBudget);
    assert.equal(f.calls[0].options.reasoningEffort, "max");
  });
}

test("private dispatcher keeps the total8192 minimum when context cannot fit all reasoning headroom", async () => {
  const f = await dispatch({ maxContext: 10000 });
  assert.equal(f.result.ok, true);
  assert.equal(f.calls.length, 1);
  assert.ok(f.calls[0].options.maxTokens >= answerFloor);
  assert.ok(f.calls[0].options.maxTokens <= 10000 - 512);
});

for (const [name, limits, field, expected] of [
  ["context", { maxContext: 8191 }, "availableContextTokens", null],
  ["configured output override", { maxOutputTokens: 4096 }, "configuredMaxOutputTokens", 4096],
]) {
  test(`private dispatcher explains an insufficient ${name} capacity before any SDK completion`, async () => {
    const f = await dispatch(limits);
    assert.equal(f.result.ok, false);
    assert.equal(f.result.error, "generation-output-capacity");
    const detail = JSON.parse(f.result.detail);
    assert.equal(detail.minimumOutputTokens, answerFloor);
    if (expected === null) assert.ok(detail[field] < answerFloor);
    else assert.equal(detail[field], expected);
    assert.equal(f.calls.length, 0);
  });
}

test("private reasoning-starved retry expands rather than lowering the answer budget", async () => {
  const f = await dispatch({ starved: true });
  assert.equal(f.result.ok, true);
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[0].options.maxTokens, normalBudget);
  assert.ok(f.calls[1].options.maxTokens > f.calls[0].options.maxTokens);
  assert.ok(f.calls.every((call) => call.options.reasoningEffort === "max"));
});

for (const proactive of [false, true]) {
  test(`actual ${proactive ? "proactive" : "normal"} message capacity failure never calls the provider`, async () => {
    const f = await routeFixture({ maxContext: 8191 });
    try {
      let reply;
      if (proactive) {
        assert.equal((await f.due()).body.status, "scheduled");
        f.makeDue();
        reply = await f.due();
      } else reply = await f.post("/chat/send", { text: "A short question." });
      assert.equal(reply.body.ok, false);
      assert.equal(reply.body.error, "generation-failed");
      assert.equal(reply.body.detail, "generation-output-capacity");
      assert.equal(reply.body.capacity.minimumOutputTokens, answerFloor);
      assert.equal(f.calls.length, 0);
    } finally {
      await f.close();
    }
  });
}
