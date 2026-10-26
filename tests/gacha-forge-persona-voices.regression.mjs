import assert from "node:assert/strict";
import { after, test } from "node:test";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { ForgeAudioController } from "../packages/gacha-forge/src/audio-client.mjs";
import { forgeVoiceCharacter } from "../packages/gacha-forge/src/audio-story.mjs";
import { normalizeForgeAudio, forgeSoundtrackContextKey } from "../packages/gacha-forge/src/audio-settings.mjs";

import { createChatRuntime } from "./fixtures/gacha-forge-chat-runtime.mjs";

const chat = await import(
  process.env.GACHA_PERSONA_CHAT_UNDER_TEST
    ? pathToFileURL(process.env.GACHA_PERSONA_CHAT_UNDER_TEST).href
    : "../packages/gacha-forge/src/chat-continuity-client.mjs"
);
const previousGlobals = Object.fromEntries(
  ["normalizeForgeAudio", "forgeSoundtrackContextKey", "Ze"].map((key) => [key, globalThis[key]]),
);
Object.assign(globalThis, { normalizeForgeAudio, forgeSoundtrackContextKey });
after(() => {
  for (const [key, value] of Object.entries(previousGlobals)) {
    if (value === undefined) delete globalThis[key];
    else globalThis[key] = value;
  }
});
const settle = async () => {
  for (let index = 0; index < 20; index += 1) await Promise.resolve();
};
const savedPlayer = (values = {}) => ({ id: "canonical-player", who: "player", text: "Hello from Mari.", ...values });
const attempt = (values = {}, host) => ({
  runId: "world",
  unitId: "unit",
  previous: [],
  text: "Hello from Mari.",
  intent: {},
  optimistic: [{ id: "local-1", who: "player", text: "Hello from Mari." }],
  voiceSession: host ? chat.forgeChatVoiceSession?.(host) : undefined,
  ...values,
});
const snapshot = (row = savedPlayer()) => ({
  ok: true,
  unit: { id: "unit" },
  messages: [row],
  activeCount: 1,
  retry: false,
});
function fixture() {
  const calls = [];
  const config = {
    enabled: true,
    source: "openai",
    voice: "default-voice",
    voiceAssignments: [
      { characterId: "persona", characterName: "Mari", voice: "persona-voice" },
      { characterId: "character", characterName: "Mari", voice: "character-voice" },
    ],
  };
  globalThis.Ze = async (path) => {
    assert.equal(path, "/api/tts/config");
    return { ok: true, json: async () => structuredClone(config) };
  };
  const host = {
    _run: { runId: "world", protagonist: { personaId: "persona", name: "Mari" }, audio: { tts: true } },
    _root: { addEventListener() {}, removeEventListener() {} },
    _chat: { open: true, unit: { id: "unit" }, messages: [], page: 1 },
    _chatRev: 0,
    _renderBrowser() {},
  };
  const controller = new ForgeAudioController(host, {
    tts: {
      ttsService: {
        getActiveId: () => null,
        async speakSequence(requests, id, options) {
          calls.push({ requests, id, options });
        },
      },
    },
  });
  host._forgeAudio = controller;
  return { host, config, controller, calls };
}
function confirm(host, row = savedPlayer(), values = {}) {
  chat.retainForgeChatSuccess(host, attempt(values, host), { ok: true, playerMessageId: row.id });
  chat.adoptForgeChatSnapshot(host, snapshot(row), { runId: "world", unitId: "unit" });
}

async function actualOutgoingClient(host) {
  let source = await readFile(new URL("../packages/gacha-forge/client.js", import.meta.url), "utf8");
  if (!process.env.GACHA_PERSONA_CHAT_UNDER_TEST) {
    const ledger = JSON.parse(await readFile(new URL("../packages/gacha-forge/bundle-patches.json", import.meta.url)));
    for (const edit of ledger.files["client.js"].patches.find((patch) => patch.version === "1.24.1").edits) {
      if (!/forgeChatVoiceSession|stopForgeChatVoice|voiceSession:forgeChatVoiceAtSend/.test(edit.replace || ""))
        continue;
      if (!source.includes(edit.replace)) {
        assert.equal(source.split(edit.find).length, 2, "unique actual send-admission edit");
        source = source.replace(edit.find, edit.replace);
      }
    }
  }
  const methods = [];
  for (const [start, end] of [
    ["_chatWith(e){", "_closeChat(){"],
    ["_closeChat(){", "_chatSay(e){"],
    ["_chatSay(e){", "_chatEnd(){"],
    ["_chatReload(){", "_chatWatchPhoto(){"],
  ]) {
    const first = source.indexOf(start);
    const last = source.indexOf(end, first + start.length);
    assert.ok(first >= 0 && last > first, `actual outgoing method ${start}`);
    methods.push(source.slice(first, last));
  }
  const Client = new Function(...Object.keys(chat), `return class {${methods.join("\n")}}`)(...Object.values(chat));
  Object.setPrototypeOf(host, Client.prototype);
  host._chatWatchPhoto = () => {};
  host._adoptFromResponse = () => {};
  return host;
}

for (const outcome of ["success", "failed-reply"]) {
  for (const reopen of [true, false]) {
    test(`a ${outcome} send finishing after ${reopen ? "close and same-unit reopen stays silent" : "a normal refresh speaks once"}`, async () => {
      const { host, controller, calls } = fixture();
      let finish;
      let committed = false;
      const pending = new Promise((resolve) => (finish = resolve));
      try {
        await actualOutgoingClient(host);
        host._postJson = async (path) => {
          if (path === "/chat/send") return pending;
          assert.equal(path, "/chat/open");
          return { ...snapshot(), messages: committed ? [savedPlayer()] : [] };
        };
        host._chatSay({ text: savedPlayer().text });
        if (reopen) {
          host._closeChat();
          host._chatWith("unit");
        } else host._chatReload();
        await settle();
        committed = true;
        finish(
          outcome === "success"
            ? { ok: true, playerMessageId: savedPlayer().id }
            : { ok: false, error: "generation-failed", playerMessageId: savedPlayer().id },
        );
        await settle();
        assert.equal(calls.length, reopen ? 0 : 1, "voice belongs only to the session that admitted Send");
      } finally {
        finish?.({ ok: false });
        controller.dispose();
      }
    });
  }
}

test("actual story cast projects the persona ID and the existing controller chooses its exact assigned voice", async () => {
  let source = await readFile(
    process.env.GACHA_PERSONA_SERVER_UNDER_TEST || new URL("../packages/gacha-forge/server.mjs", import.meta.url),
    "utf8",
  );
  // Before the official build, exercise the exact candidate ledger edit in memory. After building,
  // the same test uses the generated projection directly. The baseline seam deliberately skips it.
  if (!process.env.GACHA_PERSONA_SERVER_UNDER_TEST) {
    const ledger = JSON.parse(await readFile(new URL("../packages/gacha-forge/bundle-patches.json", import.meta.url)));
    const edit = ledger.files["server.mjs"].patches
      .find((patch) => patch.version === "1.24.1")
      .edits.find((entry) => entry.find.includes("v.push({name:k.name,art:E||null,prota:!0})"));
    if (source.includes(edit.find)) source = source.replace(edit.find, edit.replace);
    else assert.ok(source.includes(edit.replace), "the built persona cast projection is present");
  }
  const start = source.indexOf("async function dh(s,c){");
  const end = source.indexOf("async function il(s){", start);
  assert.ok(start >= 0 && end > start, "actual server story-cast function");
  const project = new Function("a", "n", "kt", "sn", "l", "Le", "r", `return (${source.slice(start, end)})`)(
    { list: async () => [] },
    { id: "gacha-forge" },
    "units",
    () => null,
    (value) => String(value || "").trim(),
    () => ({ personaAvatar: async () => "/persona.webp" }),
    { logger: { warn() {} } },
  );
  const { host, controller, calls } = fixture();
  try {
    const cast = await project("world", host._run);
    const persona = forgeVoiceCharacter(cast, "Mari", () => null);
    assert.equal(persona.characterId, "persona");
    await controller.speak({ speaker: "Mari", text: "Authored protagonist dialogue." }, persona);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].requests[0].voice, "persona-voice");
    assert.equal(calls[0].requests[0].characterId, "persona");
  } finally {
    controller.dispose();
  }
});

test("a successful sent message speaks its canonical player row once across duplicate reconciliations", async () => {
  const { host, controller, calls } = fixture();
  try {
    confirm(host);
    await settle();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].requests[0].text, savedPlayer().text);
    assert.equal(calls[0].requests[0].voice, "persona-voice");
    assert.equal(calls[0].requests[0].characterId, "persona");
    confirm(host);
    await settle();
    assert.equal(calls.length, 1);
    assert.ok(calls[0].requests[0].cacheKey.startsWith("gacha-voice-v1:"));
  } finally {
    controller.dispose();
  }
});

for (const outcome of ["success", "failed-reply"]) {
  test(`a stale unresolved same-text attempt cannot claim the ${outcome} current send`, async () => {
    const { host, controller, calls } = fixture();
    const old = attempt({ response: { error: "generation-failed" } }, host);
    try {
      host._postJson = async () => ({ ...snapshot(), messages: [] });
      await chat.reconcileForgeChatFailure(host, old);
      chat.stopForgeChatVoice(host);
      chat.adoptForgeChatSnapshot(
        host,
        { ...snapshot(), messages: [] },
        { runId: "world", unitId: "unit", opening: true },
      );
      const current = savedPlayer({ id: "current-saved" });
      if (outcome === "success") confirm(host, current);
      else {
        host._postJson = async () => snapshot(current);
        await chat.reconcileForgeChatFailure(
          host,
          attempt({ response: { error: "generation-failed", playerMessageId: current.id } }, host),
        );
      }
      await settle();
      assert.equal(calls.length, 1, "the current session's committed send is voiced");
      assert.equal(host._chatStash.unknowns.length, 1, "unproven older delivery remains recoverable");
      chat.adoptForgeChatSnapshot(host, snapshot(current), { runId: "world", unitId: "unit" });
      assert.equal(
        host._chatStash.unknowns.length,
        1,
        "the current canonical ID cannot be claimed on the next refresh",
      );
      const historical = savedPlayer({ id: "older-saved" });
      chat.adoptForgeChatSnapshot(
        host,
        { ...snapshot(), messages: [historical, current] },
        { runId: "world", unitId: "unit" },
      );
      await settle();
      assert.equal(host._chatStash, null);
      assert.equal(calls.length, 1, "late historical delivery is recovered without replaying the old session");
      assert.ok(host._chat.messages.some((row) => row.id === historical.id));
      assert.ok(host._chat.messages.some((row) => row.id === current.id));
    } finally {
      controller.dispose();
    }
  });
}

test("an ambiguous current failure cannot voice an identical late row from an older chat session", async () => {
  const { host, controller, calls } = fixture();
  try {
    host._postJson = async () => ({ ...snapshot(), messages: [] });
    await chat.reconcileForgeChatFailure(host, attempt({ response: { error: "network" } }, host));
    chat.stopForgeChatVoice(host);
    chat.adoptForgeChatSnapshot(
      host,
      { ...snapshot(), messages: [] },
      { runId: "world", unitId: "unit", opening: true },
    );
    const older = savedPlayer({ id: "late-old-player" });
    host._postJson = async () => snapshot(older);
    await chat.reconcileForgeChatFailure(host, attempt({ response: { error: "network" } }, host));
    await settle();
    assert.equal(calls.length, 0, "text and a current voice session do not prove this send owns the saved row");
    assert.equal(host._chatStash.unknowns.length, 1, "the current unproven attempt remains recoverable");
    assert.equal(host._chatStash.unknowns[0].voiceSession, chat.forgeChatVoiceSession(host));
    assert.ok(host._chat.messages.some((row) => row.id === older.id));
  } finally {
    controller.dispose();
  }
});

test("a response-proven player ID cannot fall back to an identical historical row", async () => {
  const { host, controller, calls } = fixture();
  try {
    const actual = savedPlayer({ id: "this-send-player" });
    const historical = savedPlayer({ id: "same-text-historical" });
    host._postJson = async () => snapshot(historical);
    await chat.reconcileForgeChatFailure(
      host,
      attempt({ response: { error: "generation-failed", playerMessageId: actual.id } }, host),
    );
    await settle();
    assert.equal(calls.length, 0);
    assert.equal(host._chatStash.unknowns.length, 1);
    chat.adoptForgeChatSnapshot(
      host,
      { ...snapshot(), messages: [historical, actual] },
      { runId: "world", unitId: "unit" },
    );
    await settle();
    assert.equal(calls.length, 1, "only the acknowledged row is spoken when it becomes visible");
    assert.equal(host._chatStash, null);
  } finally {
    controller.dispose();
  }
});

test("a legacy success without canonical response identity recovers text without authorizing speech", async () => {
  const { host, controller, calls } = fixture();
  try {
    chat.retainForgeChatSuccess(host, attempt({}, host), { ok: true });
    chat.adoptForgeChatSnapshot(host, snapshot(), { runId: "world", unitId: "unit" });
    await settle();
    assert.equal(calls.length, 0);
    assert.ok(host._chat.messages.some((row) => row.id === savedPlayer().id));
    assert.equal(host._chatStash, null);
  } finally {
    controller.dispose();
  }
});

test("a failed reply adopts older unresolved player speech before the current committed line", async () => {
  const { host, controller, calls } = fixture();
  try {
    host._postJson = async () => ({ ...snapshot(), messages: [] });
    await chat.reconcileForgeChatFailure(
      host,
      attempt({ response: { error: "generation-failed", playerMessageId: savedPlayer().id } }, host),
    );
    const current = savedPlayer({ id: "later-player", text: "Later saved text." });
    host._postJson = async () => ({ ...snapshot(), messages: [savedPlayer(), current] });
    await chat.reconcileForgeChatFailure(
      host,
      attempt({ text: current.text, response: { error: "generation-failed", playerMessageId: current.id } }, host),
    );
    await settle();
    assert.deepEqual(
      calls.map((call) => call.requests[0].text),
      [savedPlayer().text, current.text],
    );
    chat.adoptForgeChatSnapshot(
      host,
      { ...snapshot(), messages: [savedPlayer(), current] },
      { runId: "world", unitId: "unit" },
    );
    await settle();
    assert.equal(calls.length, 2);
  } finally {
    controller.dispose();
  }
});

test("a rejected same-text send keeps its error when an older session's reply arrives", async () => {
  const { host, controller, calls } = fixture();
  try {
    host._postJson = async () => ({ ...snapshot(), messages: [] });
    await chat.reconcileForgeChatFailure(host, attempt({ response: { error: "generation-failed" } }, host));
    chat.stopForgeChatVoice(host);
    chat.adoptForgeChatSnapshot(
      host,
      { ...snapshot(), messages: [] },
      { runId: "world", unitId: "unit", opening: true },
    );
    host._postJson = async () => ({
      ...snapshot(),
      messages: [savedPlayer(), { id: "old-answer", who: "unit", text: "Earlier reply." }],
    });
    await chat.reconcileForgeChatFailure(
      host,
      attempt({ response: { error: "no-vigor" }, error: "Not enough Vigor." }, host),
    );
    await settle();
    assert.equal(host._chat.error, "Not enough Vigor.");
    assert.equal(host._chatDraft, savedPlayer().text);
    assert.equal(calls.length, 0);
  } finally {
    controller.dispose();
  }
});

test("a failed model reply voices only the matching newly committed player row, never rejected or unknown sends", async () => {
  for (const outcome of ["saved", "unknown", "rejected"]) {
    const { host, controller, calls } = fixture();
    try {
      host._postJson = async () =>
        snapshot(outcome === "saved" ? savedPlayer() : savedPlayer({ id: "other", text: "Other text." }));
      await chat.reconcileForgeChatFailure(
        host,
        attempt(
          {
            response: {
              error: outcome === "rejected" ? "no-vigor" : "generation-failed",
              ...(outcome === "saved" ? { playerMessageId: savedPlayer().id } : {}),
            },
          },
          host,
        ),
      );
      await settle();
      assert.equal(calls.length, outcome === "saved" ? 1 : 0, outcome);
    } finally {
      controller.dispose();
    }
  }
});

test("two newly confirmed messages queue without cancelling each other's speech", async () => {
  const { host, controller, calls } = fixture();
  try {
    confirm(host);
    confirm(host, savedPlayer({ id: "second-player", text: "Another saved line." }), { text: "Another saved line." });
    await settle();
    assert.equal(calls.length, 2);
    assert.deepEqual(
      calls.map((call) => call.requests[0].text),
      ["Hello from Mari.", "Another saved line."],
    );
  } finally {
    controller.dispose();
  }
});

test("history open, old rows, retry, photo, hidden and report rows never trigger persona speech", async () => {
  for (const scenario of ["open", "old", "retry", "photo", "hidden", "report", "archived", "optimistic"]) {
    const { host, controller, calls } = fixture();
    try {
      const row = savedPlayer({
        ...(scenario === "photo" ? { ask: "photo" } : {}),
        ...(scenario === "hidden" ? { hiddenFromUser: true } : {}),
        ...(scenario === "report" ? { who: "report" } : {}),
        ...(scenario === "archived" ? { archived: true } : {}),
        ...(scenario === "optimistic" ? { id: "local-only" } : {}),
      });
      chat.retainForgeChatSuccess(
        host,
        attempt(
          {
            ...(scenario === "old" ? { previous: [row] } : {}),
            intent: {
              ...(scenario === "retry" ? { retry: true } : {}),
              ...(scenario === "photo" ? { ask: "photo" } : {}),
            },
          },
          host,
        ),
        { ok: true, playerMessageId: row.id },
      );
      chat.adoptForgeChatSnapshot(host, snapshot(row), {
        runId: "world",
        unitId: "unit",
        opening: scenario === "open",
      });
      await settle();
      assert.equal(calls.length, 0, scenario);
    } finally {
      controller.dispose();
    }
  }
});

test("existing narration, mute, volume and explicit voice gates preserve silence", async () => {
  for (const setting of ["off", "mute", "zero", "unassigned"]) {
    const { host, config, controller, calls } = fixture();
    try {
      if (setting === "off") host._run.audio.tts = false;
      if (setting === "mute") host._run.audio.muted = true;
      if (setting === "zero") host._run.audio.dialogueVolume = 0;
      if (setting === "unassigned")
        config.voiceAssignments = config.voiceAssignments.filter((row) => row.characterId !== "persona");
      controller.configure(host._run.audio);
      confirm(host);
      await settle();
      assert.equal(calls.length, 0, setting);
    } finally {
      controller.dispose();
    }
  }
});

test("closing the chat cancels pending voice config and later worlds cannot receive a stale message", async () => {
  const { host, controller, calls } = fixture();
  let resolve;
  globalThis.Ze = () => new Promise((done) => (resolve = done));
  try {
    confirm(host);
    await settle();
    assert.equal(typeof resolve, "function");
    chat.stopForgeChatVoice(host);
    host._chat = null;
    resolve({
      ok: true,
      json: async () => ({ enabled: true, voiceAssignments: [{ characterId: "persona", voice: "persona-voice" }] }),
    });
    await settle();
    assert.equal(calls.length, 0);
    host._run = { ...host._run, runId: "another-world" };
    chat.adoptForgeChatSnapshot(host, snapshot(), { runId: "world", unitId: "unit" });
    await settle();
    assert.equal(calls.length, 0);
  } finally {
    controller.dispose();
  }
});

for (const outcome of ["success", "failed-reply", "reply-write-conflict", "player-write-conflict", "rejected"]) {
  test(`actual SDK ${outcome} response exposes only this request's persisted player identity`, async () => {
    const runtime = await createChatRuntime();
    try {
      if (outcome === "failed-reply") runtime.transport.mode = "fail";
      if (outcome === "rejected") runtime.session().wallet.vigor = 0;
      if (outcome.endsWith("write-conflict")) {
        for (const method of ["create", "update"]) {
          const persist = runtime.persistence.documents[method];
          runtime.persistence.documents[method] = async (document) => {
            const messages = document.data?.messages;
            const blocks =
              Array.isArray(messages) &&
              messages.some((row) => row.who === (outcome === "player-write-conflict" ? "player" : "unit"));
            return blocks ? null : persist(document);
          };
        }
      }
      const result = (await runtime.post("/chat/send", { text: "The acknowledged player message." })).body;
      assert.equal(result.ok, outcome === "success", JSON.stringify(result));
      const persisted = runtime.chatDoc()?.data?.messages?.find((row) => row.who === "player");
      if (outcome === "rejected" || outcome === "player-write-conflict") {
        assert.equal(result.error, outcome === "rejected" ? "no-vigor" : "write-conflict");
        assert.equal(persisted, undefined);
        assert.equal(Object.hasOwn(result, "playerMessageId"), false, "no row was committed for this request");
      } else {
        assert.equal(typeof persisted?.id, "string");
        assert.equal(result.playerMessageId, persisted.id, "the response identifies the exact committed row");
        if (outcome === "failed-reply") {
          runtime.transport.mode = "reply";
          const retry = (await runtime.post("/chat/send", { retry: true })).body;
          assert.equal(retry.ok, true, JSON.stringify(retry));
          assert.equal(Object.hasOwn(retry, "playerMessageId"), false, "retry did not create another player row");
          assert.equal(runtime.chatDoc().data.messages.filter((row) => row.who === "player").length, 1);
        }
      }
    } finally {
      await runtime.close();
    }
  });
}
