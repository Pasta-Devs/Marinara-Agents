import assert from "node:assert/strict";
import { after, test } from "node:test";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { ForgeAudioController, forgeConnectionVoices } from "../packages/gacha-forge/src/audio-client.mjs";
import { forgeVoiceCharacter } from "../packages/gacha-forge/src/audio-story.mjs";
import { normalizeForgeAudio, forgeSoundtrackContextKey } from "../sources/forge-kit/audio-settings.mjs";
import { forgeSpeakerVoice, forgeStoryPersona } from "../sources/forge-kit/voice-picking.mjs";

import { createChatRuntime } from "./fixtures/gacha-forge-chat-runtime.mjs";

const chat = await import(
  process.env.GACHA_PERSONA_CHAT_UNDER_TEST
    ? pathToFileURL(process.env.GACHA_PERSONA_CHAT_UNDER_TEST).href
    : "../packages/gacha-forge/src/chat-continuity-client.mjs"
);
const previousGlobals = Object.fromEntries(
  [
    "normalizeForgeAudio",
    "forgeSoundtrackContextKey",
    "forgeSpeakerVoice",
    "forgeStoryPersona",
    "forgeConnectionVoices",
    "Ze",
  ].map((key) => [key, globalThis[key]]),
);
Object.assign(globalThis, {
  normalizeForgeAudio,
  forgeSoundtrackContextKey,
  forgeSpeakerVoice,
  forgeStoryPersona,
  forgeConnectionVoices,
});
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
const attempt = (values = {}) => ({
  runId: "world",
  unitId: "unit",
  previous: [],
  text: "Hello from Mari.",
  intent: {},
  optimistic: [{ id: "local-1", who: "player", text: "Hello from Mari." }],
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
  const speaks = [];
  const speak = controller.speak.bind(controller);
  controller.speak = (...args) => (speaks.push(args), speak(...args));
  host._forgeAudio = controller;
  return { host, config, controller, calls, speaks };
}
// Dialogue audio is on and the persona has an assigned voice (the story-cast test proves this fixture speaks),
// yet a sent message reaches neither the audio controller nor the TTS service.
function assertSilent({ calls, speaks }, message) {
  assert.equal(speaks.length, 0, message);
  assert.equal(calls.length, 0, message);
}
const playerIds = (host) => host._chat.messages.filter((row) => row?.who === "player").map((row) => row.id);
function confirm(host, row = savedPlayer(), values = {}) {
  chat.retainForgeChatSuccess(host, attempt(values), { ok: true, playerMessageId: row.id });
  chat.adoptForgeChatSnapshot(host, snapshot(row), { runId: "world", unitId: "unit" });
}

async function actualOutgoingClient(host) {
  let source = await readFile(new URL("../packages/gacha-forge/client.js", import.meta.url), "utf8");
  // Before the official build, replay the newest client.js ledger entry in memory; once built, its finds are gone.
  if (!process.env.GACHA_PERSONA_CHAT_UNDER_TEST) {
    const ledger = JSON.parse(await readFile(new URL("../packages/gacha-forge/bundle-patches.json", import.meta.url)));
    for (const edit of ledger.files["client.js"].patches.at(-1).edits) {
      if (source.split(edit.find).length === 2) source = source.replace(edit.find, () => edit.replace);
    }
  }
  assert.ok(
    source.includes(".finally(()=>finishForgeChatSend(this,forgeChatSendAtAdmission))"),
    "Send stays held through failure reconciliation",
  );
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

async function actualComposer(host) {
  const source = await readFile(new URL("../packages/gacha-forge/client.js", import.meta.url), "utf8");
  const render = new Function(
    "u",
    "forgeChatHasCurrentMessages",
    "jn",
    "Un",
    source.slice(source.indexOf("var qd="), source.indexOf("function Vv(")) + ";return Gv;",
  )((value) => String(value ?? ""), chat.forgeChatHasCurrentMessages, 600, 2);
  const bind = new Function(source.slice(source.indexOf("function Wd("), source.indexOf("var jd=")) + ";return Wd;")();
  const Refresh = new Function(
    "Ze",
    "Ia",
    "forgeUserTimeZone",
    "return class {" +
      source.slice(
        source.indexOf("_refreshState(){"),
        source.indexOf("_reconcileGenerating(", source.indexOf("_refreshState(){")),
      ) +
      "}",
  )(
    async () => ({ json: async () => ({}) }),
    "fixture",
    () => "UTC",
  );
  let html = "",
    input;
  host._root = {
    addEventListener(name, callback) {
      if (name === "click") this.click = callback;
    },
    removeEventListener() {},
    querySelector(selector) {
      if (selector === ".root") return this;
      return selector === "[data-chat-text]" && html.includes("data-chat-text") ? input : null;
    },
  };
  host._adoptGlobals = () => {};
  host._refreshState = Refresh.prototype._refreshState;
  host._renderBrowser = () => {
    html = render({
      ...host._chat,
      cost: 3,
      hold: host._chatSending ? "mine" : "",
      vigor: 100,
      draft: host._chatDraft,
    });
    input = {
      value: "",
      addEventListener(name, callback) {
        this[name] = callback;
      },
      focus() {},
    };
    bind(host._root, { onSend: (text) => host._chatSay({ text }) });
  };
  return {
    canType: () => html.includes("data-chat-text") && !/data-chat-send disabled/.test(html),
    send(text) {
      assert.ok(html.includes("data-chat-text"), "native composer is available");
      input.value = text;
      assert.equal(input.keydown, undefined, "Enter adds a line instead of sending");
      host._root.click({ target: { closest: (selector) => (selector === "[data-chat-send]" ? {} : null) } });
    },
  };
}

test("native Vigor refresh keeps Send held through failure reconciliation, then Send sends in order", async () => {
  const fx = fixture();
  const { host, controller } = fx;
  let release;
  const read = new Promise((resolve) => {
    release = resolve;
  });
  const first = savedPlayer({ id: "first-player", text: "First committed line." });
  const second = savedPlayer({ id: "second-player", text: "Second committed line." });
  let sends = 0,
    reads = 0;
  try {
    await actualOutgoingClient(host);
    const composer = await actualComposer(host);
    host._postJson = async (path) => {
      if (path === "/chat/send") {
        sends += 1;
        return sends === 1
          ? { ok: false, error: "generation-failed", playerMessageId: first.id }
          : { ok: true, playerMessageId: second.id };
      }
      assert.equal(path, "/chat/open");
      reads += 1;
      return reads === 1 ? read : { ...snapshot(), messages: [first, second] };
    };
    host._chatSay({ text: first.text });
    await settle();
    assert.equal(reads, 1);
    // The production Vigor clock invokes this exact state-refresh method when a point lands.
    host._refreshState();
    await settle();
    assert.equal(composer.canType(), false, "an ordinary refresh cannot expose Send during recovery");
    host._chatSay({ text: second.text });
    assert.equal(sends, 1, "the native admission guard also rejects a second attempt");
    release(snapshot(first));
    await settle();
    assert.equal(host._chatSending, "");
    assert.equal(composer.canType(), true);
    composer.send(second.text);
    await settle();
    assert.equal(sends, 2);
    assert.deepEqual(playerIds(host), [first.id, second.id]);
    assert.equal(host._chatStash, null);
    assertSilent(fx);
  } finally {
    release?.({ ...snapshot(), messages: [] });
    controller.dispose();
  }
});

for (const finish of ["read-rejection", "closed", "other-contact"]) {
  test(`failure reconciliation releases its own Send hold after ${finish}`, async () => {
    const { host, controller } = fixture();
    let release, reject;
    const read = new Promise((resolve, fail) => {
      release = resolve;
      reject = fail;
    });
    try {
      await actualOutgoingClient(host);
      host._postJson = async (path) => (path === "/chat/send" ? { ok: false } : read);
      host._chatSay({ text: "Keep this unconfirmed line." });
      await settle();
      assert.equal(host._chatSending, "unit");
      if (finish === "closed") host._closeChat();
      if (finish === "other-contact") host._chatWith("other-unit");
      if (finish === "read-rejection") reject(new Error("Controlled canonical-read network failure"));
      else release({ ...snapshot(), messages: [] });
      await settle();
      assert.equal(host._chatSending, "", "navigation must not strand the global busy flag");
      assert.equal(host._chatStash.unknowns.length, 1, "unconfirmed text is preserved without resending");
    } finally {
      release?.({ ...snapshot(), messages: [] });
      controller.dispose();
    }
  });
}

test("stale same-unit reconciliation cleanup cannot clear a newer Send operation", async () => {
  const fx = fixture();
  const { host, controller } = fx;
  let releaseOld, releaseNew;
  const oldRead = new Promise((resolve) => {
    releaseOld = resolve;
  });
  const newSend = new Promise((resolve) => {
    releaseNew = resolve;
  });
  let sends = 0,
    reads = 0;
  try {
    await actualOutgoingClient(host);
    host._postJson = async (path) => {
      if (path === "/chat/send") return ++sends === 1 ? { ok: false } : newSend;
      return ++reads === 1 ? oldRead : snapshot();
    };
    host._chatSay({ text: "Old unresolved line." });
    await settle();
    // _adoptRun initializes these fields; a switch away and back may reuse the same run/unit IDs.
    host._chatSending = "";
    host._chatStash = null;
    host._chat = { open: true, unit: { id: "unit" }, messages: [], page: 1 };
    host._chatSay({ text: savedPlayer().text });
    assert.equal(sends, 2);
    releaseOld({ ...snapshot(), messages: [] });
    await settle();
    assert.equal(host._chatSending, "unit", "old finally does not own the newer busy flag");
    releaseNew({ ok: true, playerMessageId: savedPlayer().id });
    await settle();
    assert.equal(host._chatSending, "");
    assert.ok(playerIds(host).includes(savedPlayer().id), "the newer send's canonical row is adopted");
    assertSilent(fx);
  } finally {
    releaseOld?.({ ...snapshot(), messages: [] });
    releaseNew?.({ ok: false });
    controller.dispose();
  }
});

for (const outcome of ["success", "failed-reply"]) {
  for (const reopen of [true, false]) {
    test(`a ${outcome} send finishing after ${reopen ? "close and same-unit reopen" : "a normal refresh"} keeps its saved row silent`, async () => {
      const fx = fixture();
      const { host, controller } = fx;
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
        host._chatReload();
        await settle();
        assert.deepEqual(playerIds(host), [savedPlayer().id]);
        assertSilent(fx);
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
    const edits = ledger.files["server.mjs"].patches
      .flatMap((patch) => patch.edits)
      .filter(
        (edit) =>
          edit.find === "v.push({name:k.name,art:E||null,prota:!0})" &&
          edit.replace?.includes("characterId:l(k.personaId)||null"),
      );
    assert.equal(edits.length, 1, "unique persona story-cast projection edit");
    const [edit] = edits;
    if (source.includes(edit.find)) source = source.replace(edit.find, edit.replace);
    else assert.ok(source.includes(edit.replace), "the built persona cast projection is present");
  }
  const start = source.indexOf("async function dh(s,c){");
  const end = source.indexOf("async function il(s){", start);
  assert.ok(start >= 0 && end > start, "actual server story-cast function");
  const project = new Function(
    "a",
    "n",
    "kt",
    "sn",
    "l",
    "Le",
    "r",
    "nt",
    "forgeStoryExpressionCast",
    `return (${source.slice(start, end)})`,
  )(
    { list: async () => [] },
    { id: "gacha-forge" },
    "units",
    () => null,
    (value) => String(value || "").trim(),
    () => ({ personaAvatar: async () => "/persona.webp" }),
    { logger: { warn() {} } },
    () => ({}),
    () => ({}),
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

test("an ambiguous persona name still speaks only in the persona's own voice, never the NPC pool", async () => {
  const { host, config, controller, calls } = fixture();
  try {
    config.npcDefaultFemaleVoices = ["pool-voice"];
    config.npcDefaultMaleVoices = ["pool-voice"];
    controller.configure({ tts: true, otherVoices: true });
    // Two cast entries share the persona's name, so the cast resolver cannot settle the speaker.
    const cast = [
      { name: "Mari", prota: true, characterId: "persona" },
      { name: "Mari", prota: false, characterId: "card-mari" },
    ];
    assert.equal(
      forgeVoiceCharacter(cast, "Mari", () => null),
      null,
    );
    for (const speaker of ["Mari", "MARI!", "you"]) {
      await controller.speak(
        { speaker, text: "Protagonist line." },
        forgeVoiceCharacter(cast, speaker, () => null),
      );
    }
    assert.deepEqual(
      calls.map((call) => [call.requests[0].voice, call.requests[0].characterId]),
      [
        ["persona-voice", "persona"],
        ["persona-voice", "persona"],
        ["persona-voice", "persona"],
      ],
    );
    host._run.protagonist = { personaId: "persona", name: "Mari Rossi" };
    await controller.speak({ speaker: "Mari", text: "First name only." }, null);
    assert.equal(calls.at(-1).requests[0].voice, "persona-voice");
    // The bundle's own cast resolver ties on a shared surname or first word, yet either could be the persona.
    const source = await readFile(new URL("../packages/gacha-forge/client.js", import.meta.url), "utf8");
    const resolve = new Function(
      source.slice(source.indexOf("function Kl("), source.indexOf("function Vo(")) + ";return Xl;",
    )();
    host._run.protagonist = { personaId: "persona", name: "Alex Rivera" };
    const ties = [
      ["Rivera", { name: "Maria Rivera", prota: false }],
      ["Alex R.", { name: "Alex Chen", prota: false, characterId: "card-alex" }],
    ];
    for (const [speaker, other] of ties) {
      const tie = forgeVoiceCharacter(
        [other, { name: "Alex Rivera", prota: true, characterId: "persona" }],
        speaker,
        resolve,
      );
      assert.equal(tie, null, `${speaker} ties in the cast`);
      await controller.speak({ speaker, text: "Possibly the protagonist." }, tie);
      assert.equal(calls.at(-1).requests[0].voice, "persona-voice", speaker);
    }
    config.voiceAssignments = [];
    calls.length = 0;
    for (const speaker of ["Mari", "Rivera", "Alex R."]) {
      host._run.protagonist = { personaId: "persona", name: speaker === "Mari" ? "Mari Rossi" : "Alex Rivera" };
      await controller.speak({ speaker, text: "No persona voice." }, null);
    }
    assert.equal(calls.length, 0, "a persona without its own voice stays silent");
    await controller.speak({ speaker: "Bryn", text: "An NPC." }, null);
    assert.equal(calls[0]?.requests[0].voice, "pool-voice", "other unresolved speakers still use the pool");
  } finally {
    controller.dispose();
  }
});

for (const outcome of ["success", "failed-reply"]) {
  test(`a confirmed ${outcome} send adopts its canonical player row once and is never read aloud`, async () => {
    const fx = fixture();
    const { host, controller } = fx;
    try {
      if (outcome === "success") confirm(host);
      else {
        host._postJson = async () => snapshot();
        await chat.reconcileForgeChatFailure(
          host,
          attempt({ response: { error: "generation-failed", playerMessageId: savedPlayer().id } }),
        );
      }
      await settle();
      assert.deepEqual(playerIds(host), [savedPlayer().id], "the optimistic row became the canonical row");
      assert.equal(host._chatStash, null);
      // Later refreshes, including a duplicate confirmation, adopt the same row again.
      confirm(host);
      chat.adoptForgeChatSnapshot(host, snapshot(), { runId: "world", unitId: "unit" });
      await settle();
      assert.deepEqual(playerIds(host), [savedPlayer().id]);
      assertSilent(fx, outcome);
    } finally {
      controller.dispose();
    }
  });
}

for (const outcome of ["success", "failed-reply"]) {
  test(`a stale unresolved same-text attempt cannot claim the ${outcome} current send`, async () => {
    const fx = fixture();
    const { host, controller } = fx;
    const old = attempt({ response: { error: "generation-failed" } });
    try {
      host._postJson = async () => ({ ...snapshot(), messages: [] });
      await chat.reconcileForgeChatFailure(host, old);
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
          attempt({ response: { error: "generation-failed", playerMessageId: current.id } }),
        );
      }
      await settle();
      assert.deepEqual(
        playerIds(host),
        [current.id, "local-1"],
        "the current send owns its committed row; the older attempt keeps its local text",
      );
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
      assert.ok(host._chat.messages.some((row) => row.id === historical.id));
      assert.ok(host._chat.messages.some((row) => row.id === current.id));
      assertSilent(fx);
    } finally {
      controller.dispose();
    }
  });
}

test("an ambiguous current failure cannot claim an identical late row from an older chat session", async () => {
  const fx = fixture();
  const { host, controller } = fx;
  try {
    host._postJson = async () => ({ ...snapshot(), messages: [] });
    await chat.reconcileForgeChatFailure(host, attempt({ response: { error: "network" } }));
    chat.adoptForgeChatSnapshot(
      host,
      { ...snapshot(), messages: [] },
      { runId: "world", unitId: "unit", opening: true },
    );
    const older = savedPlayer({ id: "late-old-player" });
    host._postJson = async () => snapshot(older);
    await chat.reconcileForgeChatFailure(host, attempt({ response: { error: "network" } }));
    await settle();
    assert.equal(host._chatStash.unknowns.length, 1, "the current unproven attempt remains recoverable");
    assert.ok(host._chat.messages.some((row) => row.id === older.id));
    assertSilent(fx);
  } finally {
    controller.dispose();
  }
});

test("a response-proven player ID cannot fall back to an identical historical row", async () => {
  const fx = fixture();
  const { host, controller } = fx;
  try {
    const actual = savedPlayer({ id: "this-send-player" });
    const historical = savedPlayer({ id: "same-text-historical" });
    host._postJson = async () => snapshot(historical);
    await chat.reconcileForgeChatFailure(
      host,
      attempt({ response: { error: "generation-failed", playerMessageId: actual.id } }),
    );
    await settle();
    assert.equal(host._chatStash.unknowns.length, 1, "the same-text historical row is not this send's row");
    chat.adoptForgeChatSnapshot(
      host,
      { ...snapshot(), messages: [historical, actual] },
      { runId: "world", unitId: "unit" },
    );
    await settle();
    assert.equal(host._chatStash, null, "only the acknowledged row resolves the send");
    assert.ok(host._chat.messages.some((row) => row.id === actual.id));
    assertSilent(fx);
  } finally {
    controller.dispose();
  }
});

test("a legacy success without canonical response identity recovers its text", async () => {
  const fx = fixture();
  const { host, controller } = fx;
  try {
    chat.retainForgeChatSuccess(host, attempt(), { ok: true });
    chat.adoptForgeChatSnapshot(host, snapshot(), { runId: "world", unitId: "unit" });
    await settle();
    assert.ok(host._chat.messages.some((row) => row.id === savedPlayer().id));
    assert.equal(host._chatStash, null);
    assertSilent(fx);
  } finally {
    controller.dispose();
  }
});

test("a failed reply adopts an older unresolved player row before the current committed line", async () => {
  const fx = fixture();
  const { host, controller } = fx;
  try {
    host._postJson = async () => ({ ...snapshot(), messages: [] });
    await chat.reconcileForgeChatFailure(
      host,
      attempt({ response: { error: "generation-failed", playerMessageId: savedPlayer().id } }),
    );
    const current = savedPlayer({ id: "later-player", text: "Later saved text." });
    host._postJson = async () => ({ ...snapshot(), messages: [savedPlayer(), current] });
    await chat.reconcileForgeChatFailure(
      host,
      attempt({ text: current.text, response: { error: "generation-failed", playerMessageId: current.id } }),
    );
    await settle();
    assert.deepEqual(playerIds(host), [savedPlayer().id, current.id]);
    assert.equal(host._chatStash, null);
    chat.adoptForgeChatSnapshot(
      host,
      { ...snapshot(), messages: [savedPlayer(), current] },
      { runId: "world", unitId: "unit" },
    );
    await settle();
    assert.deepEqual(playerIds(host), [savedPlayer().id, current.id]);
    assertSilent(fx);
  } finally {
    controller.dispose();
  }
});

test("a rejected same-text send keeps its error when an older session's reply arrives", async () => {
  const fx = fixture();
  const { host, controller } = fx;
  try {
    host._postJson = async () => ({ ...snapshot(), messages: [] });
    await chat.reconcileForgeChatFailure(host, attempt({ response: { error: "generation-failed" } }));
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
      attempt({ response: { error: "no-vigor" }, error: "Not enough Vigor." }),
    );
    await settle();
    assert.equal(host._chat.error, "Not enough Vigor.");
    assert.equal(host._chatDraft, savedPlayer().text);
    assertSilent(fx);
  } finally {
    controller.dispose();
  }
});

test("a failed model reply adopts only the matching newly committed player row, never rejected or unknown sends", async () => {
  for (const outcome of ["saved", "unknown", "rejected"]) {
    const fx = fixture();
    const { host, controller } = fx;
    try {
      host._postJson = async () =>
        snapshot(outcome === "saved" ? savedPlayer() : savedPlayer({ id: "other", text: "Other text." }));
      await chat.reconcileForgeChatFailure(
        host,
        attempt({
          response: {
            error: outcome === "rejected" ? "no-vigor" : "generation-failed",
            ...(outcome === "saved" ? { playerMessageId: savedPlayer().id } : {}),
          },
        }),
      );
      await settle();
      assert.equal(host._chatStash?.unknowns?.length ?? 0, outcome === "unknown" ? 1 : 0, outcome);
      assert.equal(host._chatDraft, outcome === "rejected" ? savedPlayer().text : "", outcome);
      assertSilent(fx, outcome);
    } finally {
      controller.dispose();
    }
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
