import assert from "node:assert/strict";
import test from "node:test";

import {
  activate,
  buildPromptText,
  currentFacts,
  emptyState,
  liveLog,
  parseResult,
  privacyFilter,
  storyLookSubjects,
} from "../packages/sentinel/src/server.mjs";

function fakeHost({ messages = [], modelReplies = [] } = {}) {
  const docs = new Map();
  const routes = {};
  const calls = [];
  let promptContext = null;
  const runtime = {
    logger: { warn() {} },
    json: { parseJsonish: (raw) => JSON.parse(raw) },
    getAgentConfig: async () => ({ connectionId: null }),
    languageModels: {
      resolveForRequest: async () => ({
        chatComplete: async (input) => {
          calls.push(input);
          return { content: modelReplies.shift() ?? "" };
        },
      }),
    },
    persistence: {
      withChatLock: async (_chatId, fn) => fn(),
      getChat: async () => ({ connectionId: null }),
      listMessages: async () => messages,
      documents: {
        getById: async (_pkg, id) => docs.get(id) ?? null,
        create: async (doc) => docs.set(doc.id, { ...doc, revision: 1 }),
        update: async (doc) => docs.set(doc.id, { ...docs.get(doc.id), ...doc, revision: doc.expectedRevision + 1 }),
      },
    },
  };
  const api = {
    runtime,
    registerPrivilegedRoutes: async (register) => {
      const add = (method) => (path, handler) => (routes[`${method} ${path}`] = handler);
      await register({ get: add("GET"), post: add("POST"), put: add("PUT"), delete: add("DELETE") });
      return () => {};
    },
    registerPromptContext: (fn) => {
      promptContext = fn;
      return () => {};
    },
  };
  const reply = () => {
    const r = { code: 200, body: null, status: (code) => ((r.code = code), r), send: (body) => ((r.body = body), r) };
    return r;
  };
  const call = async (key, params, body) => {
    const r = reply();
    const out = await routes[key]({ params, body }, r);
    return r.body ? { status: r.code, ...r.body } : out;
  };
  return { api, call, calls, messages, prompt: (args) => promptContext(args) };
}

const active = { enableAgents: true, activeAgentIds: ["sentinel"] };

test("look stores facts and the narrator gets them", async () => {
  const host = fakeHost({
    messages: [
      { id: "m1", role: "assistant", content: "You are in the kitchen." },
      { id: "m2", role: "user", content: "I make tea." },
      { id: "m3", role: "assistant", content: "The kettle boils." },
    ],
    modelReplies: [
      JSON.stringify({
        text: "The room is dark. The window is open.",
        facts: [{ thing: "Lily's window", value: "open" }],
      }),
    ],
  });
  await activate({ api: host.api });
  const added = await host.call(
    "POST /chats/:chatId/subjects",
    { chatId: "c1" },
    { name: "Lily's room", privacy: "private" },
  );
  const subjectId = added.state.subjects[0].id;
  const look = await host.call("POST /chats/:chatId/look", { chatId: "c1" }, { subjectId, sense: "look" });
  assert.equal(look.entry.text, "The room is dark. The window is open.");
  assert.equal(look.entry.messageId, "m3");
  assert.match(host.calls[0][1].content, /"privacy":"private"/);

  const context = await host.prompt({ chatId: "c1", mode: "roleplay", chatMeta: active });
  assert.match(context.text, /checked Lily's room: The room is dark/);
  assert.match(context.text, /Lily's window: open/);

  assert.equal(
    await host.prompt({ chatId: "c1", mode: "roleplay", chatMeta: { enableAgents: true, activeAgentIds: [] } }),
    null,
  );
  assert.equal(await host.prompt({ chatId: "c1", mode: "conversation", chatMeta: active }), null);
});

test("off-limits subjects get no model call", async () => {
  const host = fakeHost();
  await activate({ api: host.api });
  const added = await host.call(
    "POST /chats/:chatId/subjects",
    { chatId: "c1" },
    { name: "Bathroom", privacy: "off-limits" },
  );
  const result = await host.call(
    "POST /chats/:chatId/look",
    { chatId: "c1" },
    { subjectId: added.state.subjects[0].id, sense: "look" },
  );
  assert.equal(result.status, 403);
  const act = await host.call(
    "POST /chats/:chatId/act",
    { chatId: "c1" },
    { order: "open the door", subjectId: added.state.subjects[0].id },
  );
  assert.equal(act.status, 403);
  assert.equal(host.calls.length, 0);
});

test("butler orders change facts; later values win", async () => {
  const host = fakeHost({
    messages: [{ id: "m1", role: "assistant", content: "Hi." }],
    modelReplies: [
      JSON.stringify({
        outcome: "done",
        text: "Heating set to 24 °C.",
        facts: [{ thing: "Office heating", value: "24 °C" }],
      }),
      JSON.stringify({
        outcome: "partly",
        text: "Only to 26 °C.",
        facts: [{ thing: "office heating", value: "26 °C" }],
      }),
    ],
  });
  await activate({ api: host.api });
  await host.call("POST /chats/:chatId/act", { chatId: "c1" }, { order: "Turn up the heat" });
  const second = await host.call("POST /chats/:chatId/act", { chatId: "c1" }, { order: "More heat" });
  assert.equal(second.entry.outcome, "partly");
  assert.deepEqual(currentFacts(second.state.log), [{ thing: "office heating", value: "26 °C" }]);
  await host.call("PUT /chats/:chatId/settings", { chatId: "c1" }, { acting: false });
  const off = await host.call("POST /chats/:chatId/act", { chatId: "c1" }, { order: "Lock up" });
  assert.equal(off.status, 403);
});

test("entries of deleted messages are dropped", () => {
  const log = [
    { messageId: "m1", facts: [{ thing: "door", value: "open" }] },
    { messageId: "gone", facts: [{ thing: "door", value: "locked" }] },
  ];
  assert.equal(liveLog(log, ["m1"]).length, 1);
  assert.deepEqual(currentFacts(liveLog(log, ["m1"])), [{ thing: "door", value: "open" }]);
  assert.equal(liveLog(log, null).length, 2);
});

test("private output with intimate words is replaced", () => {
  assert.equal(
    privacyFilter("She is in the shower.", "private", "Lily"),
    "Lily: someone is there. You keep it to presence and activity.",
  );
  assert.equal(privacyFilter("She is reading.", "private", "Lily"), "She is reading.");
  assert.equal(privacyFilter("Someone is in the shower.", "open", "Gym"), "Someone is in the shower.");
});

test("model output parsing", () => {
  assert.equal(parseResult("not json", JSON.parse, "look"), null);
  assert.equal(parseResult('{"text":""}', JSON.parse, "look"), null);
  const act = parseResult(
    '{"text":"Ok","outcome":"maybe","facts":[{"thing":"a","value":"b"},{"thing":""}]}',
    JSON.parse,
    "act",
  );
  assert.deepEqual(act, { text: "Ok", facts: [{ thing: "a", value: "b" }], outcome: "done" });
});

test("story looks pick named subjects with a looking word", () => {
  const subjects = [
    { id: "a", name: "Lily", privacy: "private" },
    { id: "b", name: "Bathroom", privacy: "off-limits" },
  ];
  assert.deepEqual(
    storyLookSubjects("I quietly open Lily's door", subjects).map((s) => s.id),
    ["a"],
  );
  assert.deepEqual(storyLookSubjects("I think about Lily", subjects), []);
  assert.deepEqual(storyLookSubjects("I check the bathroom", subjects), []);

  const state = { ...emptyState(), subjects, log: [] };
  const text = buildPromptText(state, [
    { id: "m1", role: "assistant", content: "..." },
    { id: "m2", role: "user", content: "I peek into Lily's room." },
  ]);
  assert.match(text, /checks on Lily.*Presence and activity only/);
  assert.equal(
    buildPromptText({ ...state, storyLooks: false }, [{ id: "m2", role: "user", content: "I peek at Lily" }]),
    "",
  );
});

test("private facts are filtered and unnamed orders respect named subjects", async () => {
  const { privacyFilterFacts, orderPrivacy } = await import("../packages/sentinel/src/server.mjs");
  const facts = [
    { thing: "Mia", value: "in the shower" },
    { thing: "Mia", value: "reading" },
  ];
  assert.deepEqual(privacyFilterFacts(facts, "private"), [{ thing: "Mia", value: "reading" }]);
  assert.equal(privacyFilterFacts(facts, "open").length, 2);

  const subjects = [
    { id: "a", name: "Lily", privacy: "open", minor: true },
    { id: "b", name: "Bathroom", privacy: "off-limits" },
    { id: "c", name: "Till", privacy: "open" },
  ];
  assert.equal(orderPrivacy("What is Lily doing?", null, subjects), "private");
  assert.equal(orderPrivacy("Show me the bathroom", null, subjects), "off-limits");
  assert.equal(orderPrivacy("Is it still raining?", null, subjects), "open");
});

test("act without a target is blocked when it names an off-limits place", async () => {
  const host = fakeHost();
  await activate({ api: host.api });
  await host.call("POST /chats/:chatId/subjects", { chatId: "c1" }, { name: "Bathroom", privacy: "off-limits" });
  const act = await host.call("POST /chats/:chatId/act", { chatId: "c1" }, { order: "Show me the bathroom" });
  assert.equal(act.status, 403);
  assert.equal(host.calls.length, 0);
});

test("a regenerated reply still sees the result as new", () => {
  const state = {
    ...emptyState(),
    log: [{ kind: "look", subjectName: "Shop", text: "Empty.", facts: [], messageId: "m2" }],
  };
  const text = buildPromptText(state, [
    { id: "m1", role: "assistant", content: "..." },
    { id: "m2", role: "user", content: "I wait." },
    { id: "m3", role: "assistant", content: "reply being regenerated" },
  ]);
  assert.match(text, /New:/);
});

test("hidden messages do not reach the model", async () => {
  const { recentChat } = await import("../packages/sentinel/src/server.mjs");
  const out = recentChat([
    { role: "user", content: "secret", extra: { hiddenFromAI: true } },
    { role: "user", content: "visible", extra: "{}" },
  ]);
  assert.deepEqual(out, [{ role: "user", text: "visible" }]);
});
