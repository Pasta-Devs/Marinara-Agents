// Actual activated package routes and controlled local model HTTP; no provider credentials or user worlds.
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  createChapterRuntime,
  chapterRunId,
  chapterUnitId,
  currentCardCanon,
} from "./fixtures/gacha-forge-chapter-runtime.mjs";
import { createForgeCombatVoiceController } from "../packages/gacha-forge/src/combat-voices-client.mjs";
import { forgeExplicitVoice, forgeSpeakerVoice } from "../sources/forge-kit/voice-picking.mjs";
import { forgeVoiceCacheKey } from "../packages/gacha-forge/src/audio-client.mjs";
import { forgeSoundtrackContextKey, normalizeForgeAudio } from "../sources/forge-kit/audio-settings.mjs";

const original = Object.fromEntries(
  [
    "forgeExplicitVoice",
    "forgeSpeakerVoice",
    "forgeConnectionVoices",
    "forgeVoiceCacheKey",
    "forgeSoundtrackContextKey",
  ].map((key) => [key, globalThis[key]]),
);
Object.assign(globalThis, {
  forgeExplicitVoice,
  forgeSpeakerVoice,
  forgeConnectionVoices: async () => [],
  forgeVoiceCacheKey,
  forgeSoundtrackContextKey,
});
const lines = {
  death: "I will return.",
  kill: "The path is clear.",
  ultimateA: "Light the horizon!",
  ultimateB: "For our promise!",
};
const characterId = "chapter-proof-arden-card";
const timeZone = "Europe/Warsaw";
const wav = Buffer.alloc(524);
wav.write("RIFF");
wav.writeUInt32LE(wav.length - 8, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8000, 24);
wav.writeUInt32LE(16000, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(wav.length - 44, 40);
const base64 = wav.toString("base64");
let fixture;
const controllers = [];
let count = 0;
async function test(name, callback) {
  await callback();
  process.stdout.write(`ok ${++count} - ${name}\n`);
}
function prepareWorld(runtime) {
  const run = runtime.docs.get("index").data.runs[0];
  run.combat = { mode: "formation", revision: 1 };
  // A complete world already has its recurring training opponents. Saving Sources may prefetch them.
  runtime.seed(`${chapterRunId}:combat-art`, "combat-art", { effigies: { byKey: {}, hasArt: false } });
  runtime.transport.stage = "combat-voices";
  runtime.transport.reply = () => JSON.stringify(lines);
  runtime.calls.length = 0;
  return run;
}
function client(runtime, run, assigned) {
  const actor = { id: chapterUnitId, characterId, name: "Arden" };
  const config = {
    connectionId: "selected-voice-connection",
    connectionProfiles: {
      "selected-voice-connection": { voiceAssignments: assigned ? [{ characterId, voice: "assigned-voice" }] : [] },
    },
  };
  let synthesized = 0;
  const host = {
    _run: run,
    _state: () => "combat",
    // This is the real Gacha host's request envelope, including timezone metadata.
    _postJson: async (path, body) => (await runtime.post(path, { ...body, timeZone })).body,
  };
  const controller = createForgeCombatVoiceController({
    host,
    audio: { settings: normalizeForgeAudio(run.audio), disposed: false },
    getConfig: async () => config,
    services: {
      tts: {
        ttsService: {
          generateAudio: async (_text, options) => {
            synthesized++;
            assert.equal(options.voice, "assigned-voice");
            assert.equal(options.audioConnectionId, config.connectionId);
            return new Blob([wav], { type: "audio/wav" });
          },
        },
      },
      audio: { createPlayer: () => ({}) },
    },
  });
  controllers.push(controller);
  const voiceIdentity = forgeVoiceCacheKey(
    chapterRunId,
    { speaker: actor.name, text: "fixed-combat-voices-v1" },
    actor,
    config,
    "assigned-voice",
  );
  return {
    actor,
    controller,
    voiceIdentity,
    get synthesized() {
      return synthesized;
    },
  };
}

try {
  fixture = await createChapterRuntime();
  const run = prepareWorld(fixture);
  const post = (path, body = {}) =>
    fixture.post(path, { runId: chapterRunId, unitId: chapterUnitId, timeZone, ...body });
  const context = { characterId, voiceIdentity: "protocol-fixture" };
  await test("actual World Sources route round-trips the opt-in flag and off/unassigned paths generate nothing", async () => {
    const disabled = await post("/combat-voices/prepare", context);
    assert.equal(disabled.body.ok, false);
    assert.equal(fixture.calls.length, 0);
    const saved = await post("/run/sources", { sources: { audio: { combatVoices: true } } });
    assert.equal(saved.body.ok, true, JSON.stringify(saved.body));
    const canonical = fixture.docs.get("index").data.runs.find((item) => item.runId === chapterRunId);
    assert.equal(canonical.audio.combatVoices, true);
    run.audio = canonical.audio;
    const silent = client(fixture, run, false);
    await silent.controller.warm([silent.actor]);
    assert.equal(silent.synthesized, 0);
    assert.equal(fixture.calls.length, 0, "an actor without an explicit voice never requests even the fixed text set");
    for (const extra of [
      { characterId: "" },
      { characterId: "wrong-card" },
      { unitId: "other-world:unit:arden" },
      { extra: "unknown-key" },
    ]) {
      const response = await post("/combat-voices/prepare", { ...context, ...extra });
      assert.equal(response.body.ok, false);
    }
    assert.equal(fixture.calls.length, 0);
  });
  let prepared;
  await test("source controller plus activated SDK saves exactly four clips and reuses them with the timezone envelope", async () => {
    const savedUnit = structuredClone(fixture.docs.get(chapterUnitId));
    const savedSession = structuredClone(fixture.session());
    const voiced = client(fixture, run, true);
    await voiced.controller.warm([voiced.actor]);
    assert.equal(voiced.synthesized, 4);
    assert.equal(fixture.calls.length, 1, JSON.stringify(fixture.calls));
    const prompt = fixture.calls[0].body.messages.map((message) => message.content).join("\n");
    assert.match(prompt, new RegExp(currentCardCanon));
    assert.match(prompt, /They grew up near the lighthouse/u);
    assert.doesNotMatch(prompt, /DISALLOWED_CARD_SCENARIO/u);
    prepared = (await post("/combat-voices/prepare", { characterId, voiceIdentity: voiced.voiceIdentity })).body;
    assert.equal(prepared.ok, true, JSON.stringify(prepared));
    assert.equal(prepared.clips.length, 4);
    assert(prepared.clips.every((clip) => clip.state === "ready"));
    const reopened = client(fixture, run, true);
    await reopened.controller.warm([reopened.actor]);
    assert.equal(reopened.synthesized, 0);
    assert.equal(fixture.calls.length, 1);
    const shiftedTimezone = (
      await post("/combat-voices/prepare", { characterId, voiceIdentity: voiced.voiceIdentity, timeZone: "Asia/Tokyo" })
    ).body;
    assert.deepEqual(shiftedTimezone.clips, prepared.clips);
    assert.deepEqual(fixture.docs.get(chapterUnitId), savedUnit);
    assert.deepEqual(fixture.session(), savedSession);
  });
  await test("actual registered file handler serves saved bytes, HEAD metadata and rejects traversal", async () => {
    const handler = fixture.handlers.get("GET /combat-voices/file/:world/:filename");
    assert.equal(typeof handler, "function");
    const url = new URL(prepared.clips[0].url, fixture.origin);
    const [world, filename] = url.pathname.split("/").slice(-2);
    async function serve(params, method = "GET") {
      const result = { status: 200, headers: {}, body: undefined };
      const reply = {
        code(value) {
          result.status = value;
          return reply;
        },
        header(key, value) {
          result.headers[key] = value;
          return reply;
        },
        send(value) {
          result.body = value;
          return value;
        },
      };
      await handler({ params, method, headers: {} }, reply);
      if (result.body && typeof result.body[Symbol.asyncIterator] === "function") {
        const chunks = [];
        for await (const chunk of result.body) chunks.push(chunk);
        result.body = Buffer.concat(chunks);
      }
      return result;
    }
    const file = await serve({ world, filename });
    assert.equal(file.status, 200);
    assert.equal(file.headers["Content-Type"], "audio/wav");
    assert.equal(file.headers["X-Content-Type-Options"], "nosniff");
    assert.deepEqual(file.body, wav);
    const head = await serve({ world, filename }, "HEAD");
    assert.equal(head.headers["Content-Length"], wav.length);
    assert.equal(head.body, undefined);
    assert.equal((await serve({ world: "..", filename })).status, 404);
    assert.equal((await serve({ world, filename: "../../private.wav" })).status, 404);
  });
  await test("persisted paid reservations reject automatic retry, wrong tokens and invalid audio through actual SDK", async () => {
    const request = { ...context, voiceIdentity: "interrupted-voice-config", slot: "kill" };
    const reserved = (await post("/combat-voices/reserve", request)).body;
    assert.equal(reserved.ok, true);
    assert.equal((await post("/combat-voices/reserve", request)).body.retry, true);
    const retry = (await post("/combat-voices/reserve", { ...request, retry: true })).body;
    assert.equal(retry.ok, true);
    assert.notEqual(retry.token, reserved.token);
    assert.equal(
      (await post("/combat-voices/commit", { ...request, token: reserved.token, base64 })).body.error,
      "stale-combat-voice",
    );
    assert.equal(
      (await post("/combat-voices/commit", { ...request, token: retry.token, base64: "bm90IGF1ZGlv" })).body.error,
      "bad-audio",
    );
    assert.equal((await post("/combat-voices/commit", { ...request, token: retry.token, base64 })).body.ok, true);
    assert.equal(fixture.calls.length, 1, "voice configuration changes reuse the original fixed text set");
    assert.equal(fixture.errors.length, 0, JSON.stringify(fixture.errors));
  });
  await test("actual routes voice the persona by its persona ID and card-less units only with Voice other characters", async () => {
    const world = () => fixture.docs.get("index").data.runs.find((item) => item.runId === chapterRunId);
    const protagonistId = `${chapterRunId}:unit:protagonist`;
    const brynId = `${chapterRunId}:unit:bryn`;
    for (const [id, data] of [
      [protagonistId, { name: "Mari", rarity: 5, isProtagonist: true, personality: "Steady." }],
      [brynId, { name: "Bryn", rarity: 4 }],
    ])
      fixture.docs.set(id, {
        id,
        packageId: "gacha-forge",
        kind: "unit",
        revision: 1,
        name: id,
        description: "Synthetic voice proof",
        data: { unitId: id, kind: "character", ...data },
      });
    world().protagonist = { ...world().protagonist, personaId: "persona-mari" };
    world().combat = { mode: "classic", revision: 1 };
    const calls = fixture.calls.length;
    const prepare = async (unitId, voiceOwner) =>
      (await post("/combat-voices/prepare", { unitId, characterId: voiceOwner, voiceIdentity: "proof" })).body;
    assert.equal((await prepare(protagonistId, protagonistId)).ok, false, "the persona never uses a unit-keyed pool");
    assert.equal((await prepare(brynId, brynId)).error, "combat-voices-off", "card-less units need the toggle");
    assert.equal(fixture.calls.length, calls);
    const persona = await prepare(protagonistId, "persona-mari");
    assert.equal(persona.ok, true, JSON.stringify(persona));
    const saved = await post("/run/sources", { sources: { audio: { combatVoices: true, otherVoices: true } } });
    assert.equal(saved.body.run.audio.otherVoices, true, "the World Sources route keeps the new toggle");
    const bryn = await prepare(brynId, brynId);
    assert.equal(bryn.ok, true, JSON.stringify(bryn));
    assert.equal((await prepare(brynId, characterId)).ok, false, "a unit cannot borrow another card's identity");
    assert.equal(fixture.calls.length, calls + 2, "one fixed line set each, in a Classic world");
  });
  await fixture.close();
  fixture = null;
  // Only this explicit whole-world deletion scenario opts out of the chat fixture's no-delete guard.
  fixture = await createChapterRuntime({ allowWorldDelete: true });
  const abortRun = prepareWorld(fixture);
  abortRun.audio = { combatVoices: true };
  await test("actual world deletion aborts fixed-line work and fences a provider that returns late", async () => {
    const started = Promise.withResolvers();
    const release = Promise.withResolvers();
    fixture.transport.started = started.resolve;
    fixture.transport.release = release.promise;
    fixture.transport.ignoreAbort = true;
    const request = fixture.post("/combat-voices/prepare", { unitId: chapterUnitId, ...context, timeZone });
    await started.promise;
    const removed = await fixture.post("/run/delete", { unitId: "", timeZone });
    release.resolve();
    const late = await request;
    assert.equal(removed.status, 200, JSON.stringify(removed.body));
    assert.equal(removed.body.error, undefined, JSON.stringify(removed.body));
    assert.equal(late.body.ok, false, JSON.stringify({ late: late.body, removed: removed.body }));
    const folders = await readdir(
      join(fixture.directory, "capability-package-data", "gacha-forge", "combat-voices"),
    ).catch((error) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
    assert.deepEqual(folders, []);
    assert.equal(fixture.calls.length, 1);
    assert.equal(fixture.errors.length, 0, JSON.stringify(fixture.errors));
  });
} finally {
  for (const controller of controllers) controller.dispose();
  await fixture?.close();
  Object.assign(globalThis, original);
}
