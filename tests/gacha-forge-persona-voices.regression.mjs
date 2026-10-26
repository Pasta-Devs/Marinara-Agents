import assert from "node:assert/strict";
import { after, test } from "node:test";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { ForgeAudioController } from "../packages/gacha-forge/src/audio-client.mjs";
import { forgeVoiceCharacter } from "../packages/gacha-forge/src/audio-story.mjs";
import { normalizeForgeAudio, forgeSoundtrackContextKey } from "../packages/gacha-forge/src/audio-settings.mjs";

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
  chat.retainForgeChatSuccess(host, attempt(values, host), { ok: true });
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
        finish(outcome === "success" ? { ok: true } : { ok: false, error: "generation-failed" });
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

test("a failed model reply voices only the matching newly committed player row, never rejected or unknown sends", async () => {
  for (const outcome of ["saved", "unknown", "rejected"]) {
    const { host, controller, calls } = fixture();
    try {
      host._postJson = async () =>
        snapshot(outcome === "saved" ? savedPlayer() : savedPlayer({ id: "other", text: "Other text." }));
      await chat.reconcileForgeChatFailure(
        host,
        attempt({ response: { error: outcome === "rejected" ? "no-vigor" : "generation-failed" } }, host),
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
        { ok: true },
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
