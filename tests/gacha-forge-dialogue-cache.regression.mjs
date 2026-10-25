import assert from "node:assert/strict";
import { test } from "node:test";
import { ForgeAudioController, forgeVoiceCacheKey } from "../packages/gacha-forge/src/audio-client.mjs";
import * as settings from "../packages/gacha-forge/src/audio-settings.mjs";

test("dialogue replays and reopened worlds use a stable cache key while synthesis changes invalidate it", async () => {
  const saved = Object.fromEntries(
    ["normalizeForgeAudio", "forgeSoundtrackContextKey", "Ze"].map((key) => [key, globalThis[key]]),
  );
  Object.assign(globalThis, {
    normalizeForgeAudio: settings.normalizeForgeAudio,
    forgeSoundtrackContextKey: settings.forgeSoundtrackContextKey,
  });
  const config = {
    enabled: true,
    connectionId: "source-a",
    source: "openai",
    baseUrl: "https://fixture.invalid",
    model: "voice-model",
    connectionProfiles: {
      "source-a": { speed: 1, audioFormat: "mp3", voiceAssignments: [{ characterId: "card-a", voice: "voice-a" }] },
    },
  };
  globalThis.Ze = async (path) => {
    assert.equal(path, "/api/tts/config");
    return { ok: true, json: async () => structuredClone(config) };
  };
  const cache = new Map();
  const calls = [];
  let generations = 0;
  const services = {
    tts: {
      ttsService: {
        getActiveId: () => null,
        async speakSequence(requests, id, options) {
          const request = requests[0];
          calls.push({ request, id, options });
          // The host contract generates only for a missing request.cacheKey. No provider is used.
          if (!cache.has(request.cacheKey)) {
            generations += 1;
            cache.set(request.cacheKey, new Blob(["fixture"]));
          }
        },
      },
    },
  };
  const create = () => {
    const host = {
      _run: { runId: "world-a", audio: { tts: true } },
      _root: { addEventListener() {}, removeEventListener() {} },
    };
    return new ForgeAudioController(host, services);
  };
  const line = { speaker: "Arden", text: "A private fixture line." };
  const character = { characterId: "card-a" };
  const first = create();
  let reopened;
  try {
    await first.speak(line, character);
    await first.speak(line, character);
    reopened = create();
    await reopened.speak(line, character);
    assert.equal(generations, 1);
    assert.equal(calls[0].request.cacheKey, calls[2].request.cacheKey);
    assert.notEqual(calls[0].id, calls[1].id, "replay keeps a fresh playback identity");
    assert.notEqual(calls[0].id, calls[2].id, "reopening keeps a fresh playback session");
    assert.equal(calls[0].request.cacheKey.includes(line.text), false);
    const baseline = calls[0].request.cacheKey;
    const key = (segment = line, card = character, value = config, voice = "voice-a") =>
      forgeVoiceCacheKey("world-a", segment, card, value, voice);
    assert.notEqual(key({ ...line, text: "An edited line." }), baseline);
    assert.notEqual(key({ ...line, speaker: "Mira" }), baseline);
    assert.notEqual(key(line, { characterId: "card-b" }), baseline);
    assert.notEqual(key(line, character, config, "voice-b"), baseline);
    for (const change of [{ source: "elevenlabs" }, { baseUrl: "https://other.invalid" }, { model: "new-model" }]) {
      assert.notEqual(key(line, character, { ...config, ...change }), baseline);
    }
    const profile = config.connectionProfiles["source-a"];
    for (const change of [
      { speed: 1.2 },
      { audioFormat: "wav" },
      { elevenLabsStability: 0.2 },
      { elevenLabsLanguageCode: "pl" },
    ]) {
      assert.notEqual(
        key(line, character, { ...config, connectionProfiles: { "source-a": { ...profile, ...change } } }),
        baseline,
      );
    }
    assert.notEqual(
      key(line, character, { ...config, connectionId: "source-b", connectionProfiles: { "source-b": profile } }),
      baseline,
    );
    assert.equal(
      key(line, character, { ...config, autoplayRP: true, dialoguePauseMs: 500 }),
      baseline,
      "playback preferences do not regenerate speech",
    );
    profile.voiceAssignments[0].voice = "voice-b";
    await reopened.speak(line, character);
    assert.equal(generations, 2, "changing the assigned voice synthesizes a distinct clip");
    await reopened.speak({ ...line, text: "An edited line." }, character);
    assert.equal(generations, 3);
    assert.equal(calls.at(-1).options.audioConnectionId, "source-a");
  } finally {
    first.dispose();
    reopened?.dispose();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});
