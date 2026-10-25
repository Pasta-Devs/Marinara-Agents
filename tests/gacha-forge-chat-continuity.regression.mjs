import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import * as chatClient from "../packages/gacha-forge/src/chat-continuity-client.mjs";
import {
  forgeChatHistoryPage,
  forgeChatReplyBusy,
  withForgeChatSend,
} from "../packages/gacha-forge/src/chat-continuity-server.mjs";
import {
  adoptForgeChatSnapshot,
  forgeChatHasCurrentMessages,
  prependForgeChatHistory,
  reconcileForgeChatFailure,
} from "../packages/gacha-forge/src/chat-continuity-client.mjs";
import { chatRunId, chatUnitId, chatConnectionId, createChatRuntime } from "./fixtures/gacha-forge-chat-runtime.mjs";

const player = (id, text = id) => ({ id, who: "player", text });
const unit = (id, text = id) => ({ id, who: "unit", text });
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

async function actualClient(reply) {
  const source = await readFile(
    process.env.GACHA_CHAT_CLIENT_UNDER_TEST || new URL("../packages/gacha-forge/client.js", import.meta.url),
    "utf8",
  );
  const methods = [];
  for (const [start, end] of [
    ["_chatWith(e){", "_closeChat(){"],
    ["_closeChat(){", "_chatSay(e){"],
    ["_chatSay(e){", "_chatEnd(){"],
    ["_chatEarlier(){", "_chatReload(){"],
    ["_chatReload(){", "_chatWatchPhoto(){"],
  ]) {
    const first = source.indexOf(start);
    const last = source.indexOf(end, first + start.length);
    assert.ok(first >= 0 && last > first, `Actual class method ${start}`);
    methods.push(source.slice(first, last));
  }
  const Client = new Function(...Object.keys(chatClient), `return class {${methods.join("\n")}}`)(
    ...Object.values(chatClient),
  );
  const host = new Client();
  const requests = [];
  Object.assign(host, {
    _run: { runId: "r" },
    _chat: { open: true, unit: { id: "u" }, messages: [], page: 1 },
    _chatDraft: "Hello",
    _chatRev: 0,
    _chatSending: "",
    _renderBrowser() {},
    _chatWatchPhoto() {},
    _adoptFromResponse() {},
    async _postJson(path, body) {
      requests.push({ path, body });
      return reply(path, body);
    },
  });
  return { host, requests };
}

async function settleClient() {
  for (let tick = 0; tick < 12; tick += 1) await Promise.resolve();
}

test("actual client Send adopts canonical success without duplicating its optimistic player row", async () => {
  const { host, requests } = await actualClient((path) =>
    path === "/chat/send"
      ? { ok: true }
      : {
          ok: true,
          unit: { id: "u" },
          messages: [player("saved", "Hello"), unit("answer")],
          activeCount: 2,
          retry: false,
        },
  );
  host._chatSay({ text: "Hello" });
  assert.equal(host._chat.messages[0].who, "player");
  await settleClient();
  assert.deepEqual(
    host._chat.messages.map((row) => row.id),
    ["saved", "answer"],
  );
  assert.equal(host._chatDraft, "");
  assert.equal(requests.filter((request) => request.path === "/chat/send").length, 1);
});

test("successful canonical adoption replaces the local player in place before the already-visible reply", async () => {
  const prior = { ...unit("prior", "Earlier history"), at: 9999 };
  const said = { ...unit("reply", "Hello back"), at: 1 };
  const saved = { ...player("saved", "Hello"), at: 50 };
  const { host, requests } = await actualClient((path) =>
    path === "/chat/send"
      ? { ok: true, said }
      : {
          ok: true,
          unit: { id: "u" },
          messages: [prior, saved, { ...said, photo: { url: "fixture://canonical-photo" } }],
          activeCount: 3,
          retry: false,
        },
  );
  host._chat.messages = [prior];
  host._chatSay({ text: "Hello" });
  await settleClient();
  assert.deepEqual(
    host._chat.messages.map((row) => row.id),
    ["prior", "saved", "reply"],
  );
  assert.equal(host._chat.messages[2].photo.url, "fixture://canonical-photo");
  assert.equal(host._chatStash, null);
  assert.equal(requests.filter((request) => request.path === "/chat/send").length, 1);
});

test("actual successful Send retains both rows during a held or failed canonical read, then deduplicates on reopen", async () => {
  const read = deferred();
  let opening = 0;
  const { host, requests } = await actualClient((path) => {
    if (path === "/chat/send") return { ok: true, said: unit("reply", "Hello back") };
    if (++opening === 1) return read.promise;
    return {
      ok: true,
      unit: { id: "u" },
      messages: [player("saved", "Hello"), { ...unit("reply", "Hello back"), photo: { url: "fixture://fresh-photo" } }],
      activeCount: 2,
      retry: false,
    };
  });
  host._chatSay({ text: "Hello" });
  await settleClient();
  assert.deepEqual(
    host._chat.messages.map((row) => row.text),
    ["Hello", "Hello back"],
  );
  assert.equal(host._chat.error, "");
  read.resolve(null);
  await settleClient();
  assert.deepEqual(
    host._chat.messages.map((row) => row.text),
    ["Hello", "Hello back"],
  );
  assert.equal(host._chatDraft, "");
  assert.equal(host._chat.retry, false);
  host._closeChat();
  host._chatWith("u");
  await settleClient();
  assert.deepEqual(
    host._chat.messages.map((row) => row.id),
    ["saved", "reply"],
  );
  assert.equal(host._chat.messages[1].photo.url, "fixture://fresh-photo");
  assert.equal(host._chatStash, null);
  assert.equal(host._chat.error, "");
  assert.equal(requests.filter((request) => request.path === "/chat/send").length, 1);
});

test("confirmed reply does not become a false failure when a snapshot is temporarily stale", async () => {
  const { host, requests } = await actualClient((path) =>
    path === "/chat/send"
      ? { ok: true, said: unit("reply", "Hello back") }
      : { ok: true, unit: { id: "u" }, messages: [], activeCount: 0, retry: false },
  );
  host._chatSay({ text: "Hello" });
  await settleClient();
  assert.deepEqual(
    host._chat.messages.map((row) => row.text),
    ["Hello", "Hello back"],
  );
  assert.equal(host._chat.error, "");
  assert.equal(host._chat.retry, false);
  host._closeChat();
  host._chatWith("u");
  await settleClient();
  assert.deepEqual(
    host._chat.messages.map((row) => row.text),
    ["Hello", "Hello back"],
  );
  assert.equal(host._chat.error, "");
  assert.equal(requests.filter((request) => request.path === "/chat/send").length, 1);
});

test("a successful reply arriving after Close remains visible when the same contact reopens", async () => {
  const send = deferred();
  const { host, requests } = await actualClient((path) =>
    path === "/chat/send" ? send.promise : { ok: true, unit: { id: "u" }, messages: [], activeCount: 0, retry: false },
  );
  host._chatSay({ text: "Hello" });
  host._closeChat();
  send.resolve({ ok: true, said: unit("reply", "Hello back") });
  await settleClient();
  assert.equal(host._chat, null);
  host._chatWith("u");
  await settleClient();
  assert.deepEqual(
    host._chat.messages.map((row) => row.text),
    ["Hello", "Hello back"],
  );
  assert.equal(host._chat.error, "");
  assert.equal(requests.filter((request) => request.path === "/chat/send").length, 1);
});

test("actual client reopens an unknown delivery without losing text or automatically sending it twice", async () => {
  const { host, requests } = await actualClient((path) =>
    path === "/chat/send" ? null : { ok: true, unit: { id: "u" }, messages: [], activeCount: 0, retry: false },
  );
  host._chatSay({ text: "Hello" });
  await settleClient();
  assert.equal(host._chat.messages[0].text, "Hello");
  host._closeChat();
  host._chatWith("u");
  await settleClient();
  assert.equal(host._chat.messages[0].text, "Hello");
  assert.equal(host._chatDraft, "");
  assert.equal(host._chat.retry, false);
  assert.equal(requests.filter((request) => request.path === "/chat/send").length, 1);
});

test("actual client exposes the existing explicit retry for an old saved failed message", async () => {
  let answered = false;
  const { host, requests } = await actualClient((path) => {
    if (path === "/chat/send") {
      answered = true;
      return { ok: true };
    }
    return {
      ok: true,
      unit: { id: "u" },
      messages: [player("old-failed", "Hello"), ...(answered ? [unit("answer")] : [])],
      activeCount: answered ? 2 : 1,
      retry: !answered,
    };
  });
  host._chatWith("u");
  await settleClient();
  assert.equal(host._chat.retry, true);
  assert.equal(host._chat.error, "They did not answer.");
  host._chatSay({ retry: true });
  await settleClient();
  assert.deepEqual(
    host._chat.messages.map((row) => row.id),
    ["old-failed", "answer"],
  );
  assert.deepEqual(
    requests.filter((request) => request.path === "/chat/send").map((request) => request.body),
    [{ runId: "r", unitId: "u", retry: true }],
  );
});

test("history pages include archived player, character and photo rows without changing the active span", () => {
  const data = {
    messages: Array.from({ length: 170 }, (_, i) => (i % 2 ? unit(String(i)) : player(String(i)))),
    sessions: [{ count: 168 }],
  };
  data.messages[1].photo = { url: "fixture://photo", failed: false };
  const before = structuredClone(data);
  const latest = forgeChatHistoryPage(data, 1, 80);
  assert.equal(latest.pages, 3);
  assert.equal(latest.activeCount, 2);
  assert.equal(latest.messages.filter((row) => !row.archived).length, 2);
  const oldest = forgeChatHistoryPage(data, 3, 80);
  assert.deepEqual(oldest.messages[1].photo, data.messages[1].photo);
  assert.equal(forgeChatHasCurrentMessages(oldest.messages), false);
  assert.deepEqual(data, before, "View markers never modify stored messages or session counts");
  const closed = forgeChatHistoryPage({ ...data, sessions: [{ count: 170 }] }, 1, 80);
  assert.equal(closed.activeCount, 0);
  assert.equal(closed.retry, false);
  assert.equal(forgeChatHasCurrentMessages(closed.messages), false);
});

test("per-unit operation guard rejects a concurrent request and always releases after a thrown failure", async () => {
  const gate = deferred();
  const pending = withForgeChatSend("r", "u", () => gate.promise);
  assert.equal(forgeChatReplyBusy("r", "u"), true);
  let entered = false;
  assert.deepEqual(
    await withForgeChatSend("r", "u", () => {
      entered = true;
    }),
    { ok: false, error: "generation-in-progress", busy: true, retry: false },
  );
  assert.equal(entered, false);
  gate.resolve("done");
  await pending;
  assert.equal(forgeChatReplyBusy("r", "u"), false);
  await assert.rejects(
    withForgeChatSend("r", "u", async () => {
      throw new Error("fixture");
    }),
    /fixture/u,
  );
  assert.equal(forgeChatReplyBusy("r", "u"), false);
});

function client(messages, reply) {
  const requests = [];
  const host = {
    _run: { runId: "r" },
    _chat: { open: true, unit: { id: "u" }, messages, page: 1 },
    _chatDraft: "",
    _chatRev: 0,
    _renderBrowser() {},
    async _postJson(path, body) {
      requests.push({ path, body });
      return typeof reply === "function" ? reply() : reply;
    },
  };
  return { host, requests };
}
const attempt = (extra = {}) => ({
  runId: "r",
  unitId: "u",
  previous: [],
  text: "Hello",
  intent: {},
  optimistic: [player("local-current", "Hello")],
  error: "They did not answer.",
  response: null,
  ...extra,
});

test("actual client explains output capacity while preserving the saved player row and explicit retry", async () => {
  const { host, requests } = await actualClient((path) =>
    path === "/chat/send"
      ? {
          ok: false,
          error: "generation-failed",
          detail: "generation-output-capacity",
          capacity: { minimumOutputTokens: 8192, availableContextTokens: 7000, configuredMaxOutputTokens: 4096 },
          retry: true,
        }
      : { ok: true, unit: { id: "u" }, messages: [player("saved", "Hello")], retry: true, activeCount: 1 },
  );
  host._chatSay({ text: "Hello" });
  await settleClient();
  for (const expected of ["8192", "7000", "4096", "context", "Max Output Tokens Override"])
    assert.ok(host._chat.error.includes(expected), expected);
  assert.deepEqual(
    host._chat.messages.map((row) => row.id),
    ["saved"],
  );
  assert.equal(host._chat.retry, true);
  assert.equal(requests.filter((request) => request.path === "/chat/send").length, 1);
});

test("a failed HTTP response reconciles persisted text and never sends again", async () => {
  const snapshot = { ok: true, unit: { id: "u" }, messages: [player("saved", "Hello")], retry: true, activeCount: 1 };
  const { host, requests } = client([player("local-current", "Hello"), player("local-other", "Other")], snapshot);
  await reconcileForgeChatFailure(host, attempt());
  assert.deepEqual(
    host._chat.messages.map((row) => row.id),
    ["local-other", "saved"],
  );
  assert.equal(host._chatDraft, "");
  assert.equal(host._chat.retry, true);
  assert.deepEqual(
    requests.map((request) => request.path),
    ["/chat/open"],
  );
});

test("unknown network delivery retains visible text through a close/reopen instead of restoring a resendable draft", async () => {
  const { host, requests } = client([player("local-current", "Hello")], () => {
    throw new Error("offline");
  });
  await reconcileForgeChatFailure(host, attempt());
  assert.equal(host._chat.messages[0].text, "Hello");
  assert.equal(host._chatDraft, "");
  assert.equal(host._chat.retry, false);
  host._chat = { open: true, unit: { id: "u" }, messages: [] };
  adoptForgeChatSnapshot(
    host,
    { ok: true, unit: { id: "u" }, messages: [], activeCount: 0, retry: false },
    { runId: "r", unitId: "u", opening: true },
  );
  assert.equal(host._chat.messages[0].text, "Hello");
  assert.equal(forgeChatHasCurrentMessages(host._chat.messages), false);
  assert.deepEqual(
    requests.map((request) => request.path),
    ["/chat/open"],
  );
});

test("a lost success response adopts the canonical reply; a definite rejection restores only the rejected draft", async () => {
  const completed = client([player("local-current", "Hello")], {
    ok: true,
    unit: { id: "u" },
    messages: [player("saved", "Hello"), unit("answer")],
    retry: false,
    activeCount: 2,
  });
  await reconcileForgeChatFailure(completed.host, attempt());
  assert.deepEqual(
    completed.host._chat.messages.map((row) => row.id),
    ["saved", "answer"],
  );
  assert.equal(completed.host._chat.error, "");
  const rejected = client([player("local-other", "Other"), player("local-current", "Hello")], {
    ok: true,
    unit: { id: "u" },
    messages: [],
    retry: false,
    activeCount: 0,
  });
  await reconcileForgeChatFailure(rejected.host, attempt({ response: { error: "no-vigor" } }));
  assert.deepEqual(
    rejected.host._chat.messages.map((row) => row.id),
    ["local-other"],
  );
  assert.equal(rejected.host._chatDraft, "Hello");
});

test("late canonical reads cannot overwrite another run or contact", async () => {
  const gate = deferred();
  const { host } = client([player("local-current", "Hello")], () => gate.promise);
  const pending = reconcileForgeChatFailure(host, attempt());
  host._run = { runId: "other" };
  host._chat = { unit: { id: "other-unit" }, messages: [unit("untouched")] };
  gate.resolve({ ok: true, unit: { id: "u" }, messages: [] });
  await pending;
  assert.equal(host._chat.messages[0].id, "untouched");
  assert.equal(host._chatStash, undefined);
});

test("Earlier preserves the visible scroll anchor and refreshed photos; closing marks all loaded rows archived", () => {
  let log = { scrollHeight: 1000, scrollTop: 120 };
  const { host } = client([unit("last", "Last")]);
  host._root = { querySelector: () => log };
  host._renderBrowser = () => {
    log = { scrollHeight: 1600, scrollTop: 1600 };
  };
  prependForgeChatHistory(
    host,
    { ok: true, messages: [unit("older"), { ...unit("last"), photo: { url: "fixture://fresh" } }], page: 2, pages: 3 },
    { runId: "r", unitId: "u", page: 2 },
  );
  assert.equal(log.scrollTop, 720);
  assert.deepEqual(
    host._chat.messages.map((row) => row.id),
    ["older", "last"],
  );
  assert.equal(host._chat.messages[1].photo.url, "fixture://fresh");
  adoptForgeChatSnapshot(
    host,
    {
      ok: true,
      unit: { id: "u" },
      messages: [{ ...unit("last"), archived: true }],
      activeCount: 0,
      retry: false,
      page: 1,
    },
    { runId: "r", unitId: "u" },
  );
  assert.equal(forgeChatHasCurrentMessages(host._chat.messages), false);
});

test("actual SDK routes generate a first channel and first reply on the main connection exactly once", async () => {
  const fixture = await createChatRuntime();
  try {
    assert.equal(fixture.opened.body.channel, "Lantern Line");
    assert.equal(fixture.calls.filter((call) => call.stage === "channel").length, 1);
    const before = fixture.session().wallet.vigor;
    const sent = await fixture.post("/chat/send", { text: "My first message." });
    assert.equal(sent.status, 200);
    assert.equal(sent.body.ok, true, JSON.stringify(sent.body));
    assert.equal(fixture.calls.filter((call) => call.stage === "reply").length, 1);
    assert.ok(fixture.resolved.every((request) => request.connectionId === chatConnectionId));
    const opened = await fixture.post("/chat/open");
    assert.deepEqual(
      opened.body.messages.map((row) => row.who),
      ["player", "unit"],
    );
    assert.equal(opened.body.messages.at(-1).text, "I heard your first message.");
    assert.equal(fixture.session().wallet.vigor, before - 3);
  } finally {
    await fixture.close();
  }
});

test("an in-flight provider disables retry and rejects a second send/close before spend or generation", async () => {
  const fixture = await createChatRuntime();
  const started = deferred(),
    release = deferred();
  try {
    fixture.transport.started = started.resolve;
    fixture.transport.release = release.promise;
    const before = fixture.session().wallet.vigor;
    const sending = fixture.post("/chat/send", { text: "Wait for the first response." });
    await started.promise;
    const opened = await fixture.post("/chat/open");
    assert.equal(opened.body.busy, true);
    assert.equal(opened.body.retry, false);
    assert.equal((await fixture.post("/chat/send", { retry: true })).body.error, "generation-in-progress");
    assert.equal((await fixture.post("/chat/close")).body.error, "generation-in-progress");
    assert.equal(fixture.calls.filter((call) => call.stage === "reply").length, 1);
    assert.equal(fixture.session().wallet.vigor, before - 3);
    release.resolve();
    assert.equal((await sending).body.ok, true);
    assert.equal((await fixture.post("/chat/open")).body.busy, false);
  } finally {
    release.resolve();
    await fixture.close();
  }
});

for (const mode of ["fail", "empty"]) {
  test(`a ${mode} provider response leaves one paid player row and explicit retry adds only one reply`, async () => {
    const fixture = await createChatRuntime();
    try {
      fixture.transport.mode = mode;
      const before = fixture.session().wallet.vigor;
      const failed = await fixture.post("/chat/send", { text: "Keep my failed message." });
      assert.equal(failed.body.error, "generation-failed");
      const opened = await fixture.post("/chat/open");
      assert.equal(opened.body.retry, true);
      assert.equal(opened.body.busy, false);
      assert.deepEqual(
        opened.body.messages.map((row) => row.who),
        ["player"],
      );
      const calls = fixture.calls.length;
      fixture.transport.mode = "reply";
      const retried = await fixture.post("/chat/send", { retry: true });
      assert.equal(retried.body.ok, true, JSON.stringify(retried.body));
      assert.equal(
        fixture.calls.length,
        calls + 1,
        "Explicit retry performs one reply call, never another player send",
      );
      assert.equal(fixture.session().wallet.vigor, before - 3);
      assert.deepEqual(
        (await fixture.post("/chat/open")).body.messages.map((row) => row.who),
        ["player", "unit"],
      );
    } finally {
      await fixture.close();
    }
  });
}

test("a saved failed world can be reopened after restart and retried without another player row or Vigor charge", async () => {
  const failed = await createChatRuntime();
  let stored;
  let paid;
  try {
    failed.transport.mode = "fail";
    assert.equal(
      (await failed.post("/chat/send", { text: "A message saved by the previous version." })).body.error,
      "generation-failed",
    );
    paid = failed.session().wallet.vigor;
    stored = structuredClone([...failed.docs]);
  } finally {
    await failed.close();
  }
  const recovered = await createChatRuntime({ stored });
  try {
    assert.equal(recovered.opened.body.retry, true);
    assert.equal(recovered.opened.body.busy, false);
    assert.equal(recovered.calls.length, 0, "Opening an old failed exchange never automatically calls a provider");
    assert.equal((await recovered.post("/chat/send", { retry: true })).body.ok, true);
    assert.equal(recovered.calls.length, 1);
    assert.equal(recovered.session().wallet.vigor, paid);
    assert.deepEqual(
      (await recovered.post("/chat/open")).body.messages.map((row) => row.who),
      ["player", "unit"],
    );
  } finally {
    await recovered.close();
  }
});

test("closed history stays paged in the same chat while generation and Close memory see only active rows", async () => {
  const fixture = await createChatRuntime({ archived: 164 });
  try {
    let opened = await fixture.post("/chat/open");
    assert.equal(opened.body.pages, 6);
    assert.equal(opened.body.activeCount, 0);
    assert.equal(forgeChatHasCurrentMessages(opened.body.messages), false);
    assert.equal((await fixture.post("/chat/close")).body.error, "nothing-open");
    assert.equal((await fixture.post("/chat/send", { text: "CURRENT_EXCHANGE_ONLY" })).body.ok, true);
    const replyPrompt = fixture.calls.find((call) => call.kind === "reply");
    assert.match(JSON.stringify(replyPrompt.body.messages), /CURRENT_EXCHANGE_ONLY/u);
    assert.doesNotMatch(JSON.stringify(replyPrompt.body.messages), /ARCHIVE_RAW_/u);
    const afterSend = await fixture.post("/chat/open");
    assert.equal(afterSend.body.activeCount, 2, JSON.stringify({ afterSend, stored: fixture.chatDoc().data }));
    fixture.transport.stage = "memory";
    const closed = await fixture.post("/chat/close");
    assert.equal(closed.body.ok, true, JSON.stringify(closed));
    assert.equal(closed.body.closed.count, 2);
    const memoryPrompt = fixture.calls.find((call) => call.kind === "memory");
    assert.match(JSON.stringify(memoryPrompt.body.messages), /CURRENT_EXCHANGE_ONLY/u);
    assert.doesNotMatch(JSON.stringify(memoryPrompt.body.messages), /ARCHIVE_RAW_/u);
    opened = await fixture.post("/chat/open");
    assert.equal(opened.body.activeCount, 0);
    assert.equal(opened.body.messages.length, 30);
    assert.equal(forgeChatHasCurrentMessages(opened.body.messages), false);
    const oldest = await fixture.post("/chat/open", { page: 6 });
    assert.equal(oldest.body.messages[1].photo.url, "fixture://archived-picture");
    const remembered = await fixture.post("/chat/past");
    assert.equal(remembered.body.past.length, 2);
    assert.equal(fixture.chatDoc().data.messages.length, 166, "No archived or current message is deleted");
    assert.equal(fixture.chatDoc().data.sessions.at(-1).memory, "Mari and Arden agreed to meet at the lighthouse.");
    assert.equal(fixture.docs.get(`${chatRunId}:session`).data.roster[chatUnitId].bondFights, 100000);
  } finally {
    await fixture.close();
  }
});
