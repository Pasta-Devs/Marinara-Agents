// Exercise audio behavior with deterministic host boundaries; no provider is contacted.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  normalizeForgeAudio,
  normalizeForgeMusicMood,
  forgeSoundtrackContextKey,
} from "../sources/forge-kit/audio-settings.mjs";
import { forgeAudioEnglish, forgeAudioFields } from "../packages/gacha-forge/src/audio-en.mjs";
import {
  forgeExplicitVoice,
  forgeVoicePool,
  forgeStableVoice,
  forgeSpeakerVoice,
  forgeStoryPersona,
} from "../sources/forge-kit/voice-picking.mjs";
import {
  ForgeAudioController,
  forgeConnectionVoices,
  forgeAudioCue,
  forgeMusicContextKey,
  loadForgeAudioConnections,
  saveForgeAudioSources,
} from "../packages/gacha-forge/src/audio-client.mjs";
import { createForgeVoiceLine, forgeVoiceCharacter } from "../packages/gacha-forge/src/audio-story.mjs";
import {
  forgeChoiceMessages,
  forgeNormalizeChoiceBeat,
  forgeRememberSpeakerGenders,
  forgeRunSpeakerGenders,
} from "../sources/forge-kit/player-choices-server.mjs";
import { forgeChoiceLabel } from "../sources/forge-kit/player-choice-text.mjs";

const before = {
  forgeSoundtrackContextKey: globalThis.forgeSoundtrackContextKey,
  normalizeForgeAudio: globalThis.normalizeForgeAudio,
  normalizeForgeMusicMood: globalThis.normalizeForgeMusicMood,
  forgeAudioEnglish: globalThis.forgeAudioEnglish,
  forgeAudioFields: globalThis.forgeAudioFields,
  Ze: globalThis.Ze,
  fetch: globalThis.fetch,
  Option: globalThis.Option,
  forgeChoiceLabel: globalThis.forgeChoiceLabel,
  forgeSpeakerVoice: globalThis.forgeSpeakerVoice,
  forgeStoryPersona: globalThis.forgeStoryPersona,
  forgeConnectionVoices: globalThis.forgeConnectionVoices,
};
globalThis.forgeChoiceLabel = forgeChoiceLabel;
// The client bundle pastes the kit's voice picking beside the audio client, so both see each other's names.
Object.assign(globalThis, { forgeSpeakerVoice, forgeStoryPersona, forgeConnectionVoices });
globalThis.forgeSoundtrackContextKey = forgeSoundtrackContextKey;
globalThis.normalizeForgeAudio = normalizeForgeAudio;
globalThis.normalizeForgeMusicMood = normalizeForgeMusicMood;
globalThis.forgeAudioEnglish = forgeAudioEnglish;
globalThis.forgeAudioFields = forgeAudioFields;
const tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const generationConfig = (path, values = {}) => ({
  ok: true,
  json: async () => ({
    configured: true,
    connectionId: new URL(path, "https://fixture.invalid").searchParams.get("audioConnectionId") || "current",
    music: true,
    soundEffects: true,
    ...values,
  }),
});
const musicBriefResponse = () => ({
  ok: true,
  json: async () => ({ ok: true, prompt: "Original instrumental fantasy theme with woodwinds and harp." }),
});
// Marinara Engine packages/client/src/lib/tts-dialogue.ts (staging): stableTTSIndex over normalizeTTSCharacterName.
const engineStableIndex = (name, length) => {
  const seed = name.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim() || name;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash) % length;
};
let cases = 0;
async function test(name, callback) {
  await callback();
  process.stdout.write(`ok ${++cases} - ${name}\n`);
}

try {
  await test("audio connection lists accept stored flags and preserve missing or quarantined IDs on failure", async () => {
    globalThis.Option = class {
      constructor(text, value) {
        Object.assign(this, { text, value, disabled: false });
      }
    };
    const rows = [
      { id: "stored", provider: "audio_generation", audioMusic: "true", profileImportReviewRequired: "false" },
      { id: "boolean", provider: "audio_generation", audioSoundEffects: true },
      { id: "quarantined", provider: "audio_generation", audioMusic: "true", profileImportReviewRequired: "true" },
      { id: "quarantined-bool", provider: "audio_generation", audioMusic: true, profileImportReviewRequired: true },
      { id: "off", provider: "audio_generation", audioMusic: "false", audioSoundEffects: false },
      { id: "speech", provider: "audio", audioMusic: true },
    ];
    for (const selected of ["", "stored", "boolean", "missing", "quarantined", "quarantined-bool"]) {
      const select = {
        dataset: {},
        options: [],
        replaceChildren(...options) {
          this.options = options;
        },
        add(option) {
          this.options.push(option);
        },
      };
      const response = deferred();
      globalThis.Ze = () => response.promise;
      const loaded = loadForgeAudioConnections(
        { querySelector: () => select },
        { "audio.audioConnectionId": selected },
      );
      assert.equal(select.value, selected, "restored setup form can read the explicit ID before HTTP completes");
      assert.equal(select.disabled, true);
      response.resolve({ ok: true, json: async () => rows });
      await loaded;
      assert.deepEqual(
        select.options.filter((option) => !option.disabled).map((option) => option.value),
        ["", "stored", "boolean"],
      );
      assert.equal(select.value, selected);
      assert.equal(
        select.options.find((option) => option.value === selected)?.disabled,
        !["", "stored", "boolean"].includes(selected),
      );
      assert.equal(select.disabled, false);
      assert.equal(select.options.find((option) => option.value === "stored").text, "stored (Music only)");
      assert.equal(select.options.find((option) => option.value === "boolean").text, "boolean (Sound effects only)");
    }
    const select = {
      dataset: {},
      options: [],
      replaceChildren(...options) {
        this.options = options;
      },
      add(option) {
        this.options.push(option);
      },
    };
    globalThis.Ze = () => Promise.reject(new Error("offline"));
    await loadForgeAudioConnections({ querySelector: () => select }, { "audio.audioConnectionId": "missing" });
    assert.equal(select.value, "missing");
    assert.equal(select.options.find((option) => option.value === "missing").disabled, true);
    assert.equal(select.options[0].text, forgeAudioEnglish["audio.connectionsFailed"]);
  });

  await test("world audio defaults are opt-in and zero volumes survive normalization", () => {
    const defaults = normalizeForgeAudio();
    assert.equal(defaults.tts, false);
    assert.equal(defaults.generate, false);
    assert.equal(defaults.autoplayPauseSeconds, 3);
    const value = normalizeForgeAudio({
      tts: true,
      generate: "true",
      musicVolume: 0,
      dialogueVolume: "0",
      sfxVolume: -5,
      autoplayPauseSeconds: 900,
      credentials: "not persisted",
    });
    assert.equal(value.musicVolume, 0);
    assert.equal(value.dialogueVolume, 0);
    assert.equal(value.sfxVolume, 0);
    assert.equal(value.generate, false);
    assert.equal(value.autoplayPauseSeconds, 30);
    assert.equal("credentials" in value, false);
    assert.equal(normalizeForgeAudio({ musicVolume: NaN }).musicVolume, 0.5);
    assert.equal(defaults.otherVoices, false, "Voice other characters is opt-in");
    assert.equal(normalizeForgeAudio({ otherVoices: true }).otherVoices, true);
    assert.equal(normalizeForgeAudio({ otherVoices: "true" }).otherVoices, false);
    assert.equal(normalizeForgeAudio({ ...normalizeForgeAudio({ otherVoices: true }), muted: true }).otherVoices, true);
    const fields = forgeAudioFields().map((field) => field.id);
    assert.equal(fields[fields.indexOf("audio.tts") + 1], "audio.otherVoices", "the toggle sits next to dialogue");
    const toggle = forgeAudioFields().find((field) => field.id === "audio.otherVoices");
    assert.equal(toggle.label, "Voice other characters");
    assert.equal(toggle.default, false);
    assert.match(toggle.hint, /Male NPC defaults and Female NPC defaults/u);
    assert.match(
      toggle.hint,
      /turn on Use default voices for random NPCs under Random NPC Voices in Connections → Text to Speech/u,
      "the Engine shows the lists only while its switch is on",
    );
    assert.doesNotMatch(forgeAudioEnglish["audio.settings.combatVoicesHint"], /Formation combat only/u);
  });

  await test("other voices come from the Engine NPC pool by gender, stay stable per name, and never beat explicit", async () => {
    const pools = {
      enabled: true,
      connectionId: "speech",
      npcDefaultMaleVoices: ["legacy-only"],
      connectionProfiles: {
        speech: {
          voiceAssignments: [{ characterId: "card", voice: "assigned" }],
          npcDefaultMaleVoices: ["m1", "m2", "m3"],
          npcDefaultFemaleVoices: ["f1", "f2"],
        },
      },
    };
    assert.deepEqual(forgeVoicePool(pools, "male"), ["m1", "m2", "m3"], "the selected connection's pool is used");
    assert.deepEqual(forgeVoicePool(pools, "female"), ["f1", "f2"]);
    assert.deepEqual(forgeVoicePool(pools, ""), ["f1", "f2", "m1", "m2", "m3"], "unknown gender uses both lists");
    const one = { ...pools, connectionProfiles: { speech: { npcDefaultMaleVoices: ["m1"] } } };
    assert.deepEqual(forgeVoicePool(one, "female"), ["m1"], "a missing gender list borrows the other one");
    const same = { enabled: true, npcDefaultMaleVoices: ["a", "b"], npcDefaultFemaleVoices: ["b", "a"] };
    assert.deepEqual(forgeVoicePool(same, "male"), ["b", "a"], "identical lists are one unpartitioned pool");
    assert.equal(forgeVoicePool({ enabled: false, npcDefaultMaleVoices: ["m"] }, "male"), null, "speech off");
    assert.deepEqual(forgeVoicePool({ enabled: true }, "male"), []);
    for (const name of ["Old Station Keeper", "Bryn", "The_Ferry-Man", "月"]) {
      const pool = forgeVoicePool(pools, "male");
      assert.equal(forgeStableVoice(pool, name), pool[engineStableIndex(name, pool.length)], `Engine parity: ${name}`);
      assert.equal(forgeStableVoice(pool, name), forgeStableVoice(pool, `  ${name.toUpperCase()} `));
    }
    assert.equal(forgeStableVoice([], "Bryn"), null);
    let lists = 0;
    const listVoices = async (config) => {
      lists += 1;
      assert.equal(config.connectionId, "speech");
      return ["v1", "v2", "v3", "v4"];
    };
    const keeper = { name: "Old Station Keeper", gender: "male" };
    assert.equal(
      await forgeSpeakerVoice(pools, keeper, true, listVoices),
      forgeStableVoice(["m1", "m2", "m3"], keeper.name),
    );
    assert.equal(lists, 0, "a filled pool never lists provider voices");
    assert.equal(await forgeSpeakerVoice(pools, { ...keeper, characterId: "card" }, true, listVoices), "assigned");
    assert.equal(await forgeSpeakerVoice(pools, keeper, false, listVoices), null, "the toggle is off");
    assert.equal(await forgeSpeakerVoice(pools, { ...keeper, persona: true }, true, listVoices), null, "persona");
    assert.equal(await forgeSpeakerVoice(pools, { name: " " }, true, listVoices), null);
    const empty = { enabled: true, connectionId: "speech", connectionProfiles: { speech: {} } };
    const fallback = await forgeSpeakerVoice(empty, keeper, true, listVoices);
    assert.equal(fallback, forgeStableVoice(["v1", "v2", "v3", "v4"], keeper.name), "empty pools use any voice");
    assert.equal(await forgeSpeakerVoice(empty, keeper, true, listVoices), fallback, "and stay stable per name");
    assert.equal(lists, 2);
    assert.equal(await forgeSpeakerVoice({ enabled: false }, keeper, true, listVoices), null);
    assert.equal(lists, 2, "disabled speech never lists voices");
    const requests = [];
    globalThis.Ze = async (path) => {
      requests.push(path);
      return { ok: true, json: async () => ({ voices: ["zeta", "alpha", "zeta", "", 3] }) };
    };
    assert.deepEqual(await forgeConnectionVoices({ connectionId: "speech/a" }), ["alpha", "zeta"]);
    assert.deepEqual(await forgeConnectionVoices({ connectionId: "speech/a" }), ["alpha", "zeta"]);
    assert.deepEqual(requests, ["/api/tts/voices?connectionId=speech%2Fa"], "one list per connection");
  });

  await test("the connection voice list is keyed by source and a failed read rejects without being kept", async () => {
    const requests = [];
    let source = "openai";
    let fail = false;
    globalThis.Ze = async (path) => {
      requests.push(path);
      return fail
        ? { ok: false, status: 502, json: async () => ({}) }
        : { ok: true, json: async () => ({ voices: [source === "openai" ? "alloy" : "rachel"] }) };
    };
    const legacy = { connectionId: "", source: "openai", baseUrl: "https://api.openai.com/v1" };
    assert.deepEqual(await forgeConnectionVoices(legacy), ["alloy"]);
    source = "elevenlabs";
    const switched = { ...legacy, source, baseUrl: "https://api.elevenlabs.io/v1" };
    assert.deepEqual(await forgeConnectionVoices(switched), ["rachel"], "a legacy source switch lists its own voices");
    assert.deepEqual(await forgeConnectionVoices(legacy), ["alloy"], "each source keeps its own list");
    assert.equal(requests.length, 2);
    fail = true;
    const other = { connectionId: "speech/b" };
    await assert.rejects(forgeConnectionVoices(other), "an error is not an empty list");
    fail = false;
    source = "openai";
    assert.deepEqual(await forgeConnectionVoices(other), ["alloy"], "a failed read is retried");
    assert.equal(requests.length, 4);
  });

  await test("an NPC keeps the first known gender, and so one voice, across beats of the run", async () => {
    const pools = { enabled: true, npcDefaultMaleVoices: ["m1", "m2", "m3"], npcDefaultFemaleVoices: ["f1", "f2"] };
    let session = { progress: {} };
    let writes = 0;
    const read = async () => ({ data: structuredClone(session) });
    const update = async (change) => {
      writes += 1;
      const next = structuredClone(session);
      change(next);
      session = next;
      return next;
    };
    const voiceOf = (segment) => forgeSpeakerVoice(pools, { name: segment.speaker, gender: segment.gender }, true);
    const first = {
      segments: [
        { speaker: "Gareth", text: "Halt.", gender: "male" },
        { speaker: "", text: "Rain." },
      ],
    };
    await forgeRememberSpeakerGenders(read, update, first);
    assert.deepEqual(session.speakerGenders, { gareth: "male" }, "saved by normalized name when a beat is saved");
    const voice = await voiceOf(first.segments[0]);
    assert.equal(voice, forgeStableVoice(["m1", "m2", "m3"], "Gareth"));
    const omitted = {
      segments: [{ speaker: "  GARETH ", text: "Again." }],
      choices: [{ options: [{ segments: [{ speaker: "Gareth", text: "Branch." }] }] }],
    };
    await forgeRememberSpeakerGenders(read, update, omitted);
    assert.equal(writes, 1, "nothing new, nothing written");
    assert.equal(await voiceOf(omitted.segments[0]), voice, "a later beat that leaves him out keeps his voice");
    assert.equal(omitted.choices[0].options[0].segments[0].gender, "male", "choice branches too");
    const contradicted = { segments: [{ speaker: "Gareth", text: "Hm.", gender: "female" }] };
    await forgeRememberSpeakerGenders(read, update, contradicted);
    assert.equal(contradicted.segments[0].gender, "male", "the first value wins");
    const cached = { segments: [{ speaker: "Gareth", text: "Old beat from before the toggle." }] };
    await forgeRememberSpeakerGenders(read, null, cached);
    assert.equal(await voiceOf(cached.segments[0]), voice, "a stored beat read back uses the run's gender");
    assert.equal(writes, 1, "reading a stored beat never writes");
    const many = Object.fromEntries(Array.from({ length: 205 }, (_, index) => [`npc ${index}`, "female"]));
    assert.equal(Object.keys(forgeRunSpeakerGenders(many, first)).length, 200, "the run map is capped");
    assert.deepEqual(forgeRunSpeakerGenders({ x: "robot", "": "male" }, {}), {}, "only male or female is kept");
    const server = await readFile(new URL("../packages/gacha-forge/server.mjs", import.meta.url), "utf8");
    assert.match(server, /L=async Y=>\(await forgeRememberSpeakerGenders\(\(\)=>pe\(p\),null,Y\.data\),/u);
    assert.match(server, /await forgeRememberSpeakerGenders\(\(\)=>pe\(p\),forgeSave=>xn\(p,forgeSave\),ge\.value\);/u);
  });

  await test("the beat writer names NPC voice genders in the same call and they are saved on each segment", () => {
    const system = [
      { role: "system", content: "Narrate." },
      { role: "user", content: "Beat." },
    ];
    const voiced = forgeChoiceMessages(system, { enabled: false, audio: { tts: true, otherVoices: true } });
    assert.equal(voiced.length, 2, "no extra message or request");
    assert.match(voiced[0].content, /SPEAKER VOICES/u);
    assert.match(voiced[0].content, /"voices":\{"The Old Station Keeper":"male"\}/u);
    assert.equal(system[0].content, "Narrate.", "the caller's messages are not mutated");
    for (const audio of [undefined, { tts: true }, { otherVoices: true }])
      assert.doesNotMatch(
        forgeChoiceMessages(system, { enabled: true, terminal: false, audio })[0].content,
        /SPEAKER/u,
      );
    const normalizeBeat = (raw) => ({
      musicMood: "happy",
      places: [],
      segments: raw.segments.map((segment) => ({ speaker: segment.speaker, text: segment.text })),
    });
    const raw = {
      voices: { "the old  station keeper": "Male", Mira: "female", Ghost: "other", "": "male" },
      segments: [
        { speaker: "The Old Station Keeper", text: "Tickets." },
        { speaker: "Mira", text: "Here." },
        { speaker: "Ghost", text: "Boo." },
        { speaker: "", text: "Steam rises." },
      ],
      choices: [
        {
          kind: "small",
          at: 0,
          options: [
            {
              text: "Pay.",
              selection: { kind: "action", text: "You pay." },
              segments: [{ speaker: "Mira", text: "Thanks." }],
            },
            {
              text: "Refuse.",
              selection: { kind: "action", text: "You refuse." },
              segments: [{ speaker: "The Old Station Keeper", text: "Then walk." }],
            },
          ],
        },
      ],
    };
    const beat = forgeNormalizeChoiceBeat(raw, {}, normalizeBeat, { enabled: true, terminal: false });
    assert.deepEqual(
      beat.segments.map((segment) => segment.gender),
      ["male", "female", undefined, undefined],
    );
    assert.deepEqual(
      beat.choices[0].options.map((option) => option.segments[0].gender),
      ["female", "male"],
    );
    const plain = forgeNormalizeChoiceBeat({ segments: raw.segments }, {}, normalizeBeat, { enabled: false });
    assert(
      plain.segments.every((segment) => !("gender" in segment)),
      "no map, no gender",
    );
    const odd = forgeNormalizeChoiceBeat({ ...raw, voices: ["male"] }, {}, normalizeBeat, { enabled: false });
    assert(odd.segments.every((segment) => !("gender" in segment)));
  });

  await test("explicit voices use the chosen profile and exact ID, never name or default fallback", () => {
    const config = {
      enabled: true,
      connectionId: "current",
      voice: "default",
      voiceAssignments: [{ characterId: "a", voice: "wrong-source" }],
      connectionProfiles: {
        current: { voiceAssignments: [{ characterId: "a", characterName: "Old Name", voice: "assigned" }] },
      },
    };
    assert.equal(forgeExplicitVoice(config, "a"), "assigned");
    assert.equal(forgeExplicitVoice(config, "Old Name"), null);
    assert.equal(forgeExplicitVoice(config, "unknown"), null);
    assert.equal(
      forgeExplicitVoice({ ...config, connectionProfiles: {} }, "a"),
      null,
      "a missing selected profile must not borrow legacy voice assignments",
    );
    assert.equal(
      forgeExplicitVoice({ ...config, enabled: false }, "a"),
      "assigned",
      "an explicit connection is independent of the legacy enabled switch",
    );
    assert.equal(
      forgeExplicitVoice(
        { enabled: false, connectionId: "", voiceAssignments: [{ characterId: "a", voice: "legacy" }] },
        "a",
      ),
      null,
    );
    assert.equal(
      forgeExplicitVoice(
        { enabled: true, connectionId: "", voiceAssignments: [{ characterId: "a", voice: "legacy" }] },
        "a",
      ),
      "legacy",
    );
    assert.equal(
      forgeExplicitVoice(
        {
          voiceAssignments: [
            { characterId: "a", voice: "one" },
            { characterId: "a", voice: "two" },
          ],
        },
        "a",
      ),
      null,
    );
    const cast = [
      { name: "Arden", characterId: "a" },
      { name: "Arden", characterId: "b" },
    ];
    assert.equal(
      forgeVoiceCharacter(cast, "Arden", () => cast[0]),
      null,
    );
    assert.equal(forgeVoiceCharacter([{ name: "月", characterId: "c" }], "月", () => null)?.characterId, "c");
  });

  await test("revealed text waits for playback completion and stale/skip voices cannot advance a later line", async () => {
    let ready = 0;
    const calls = [];
    const audio = {
      speak(_segment, _character, signal) {
        const own = deferred();
        calls.push({ ...own, signal });
        return own.promise;
      },
    };
    const line = createForgeVoiceLine(audio, () => {
      ready += 1;
    });
    line.start({ text: "first" }, {});
    await tick();
    line.reveal();
    assert.equal(line.ready(), false, "text completion alone must not advance");
    calls[0].resolve();
    await tick();
    assert.equal(line.ready(), true);
    assert.equal(ready, 1);
    line.start({ text: "old" }, {});
    await tick();
    line.start({ text: "new" }, {});
    await tick();
    assert.equal(calls[1].signal.aborted, true);
    line.reveal();
    calls[1].resolve();
    await tick();
    assert.equal(line.ready(), false, "old completion cannot release new text");
    calls[2].resolve();
    await tick();
    assert.equal(ready, 2);
    line.start({ text: "skipped" }, {}, true);
    line.reveal();
    await tick();
    assert.equal(calls.length, 3, "Skip never starts another synthesis");
    line.dispose();
    assert.equal(line.ready(), false);
  });

  const fixture = () => {
    const events = [];
    const player = Object.fromEntries(
      ["unlock", "playMusic", "stopMusic", "playSfx", "setVolumes", "setMuted", "dispose"].map((method) => [
        method,
        (...args) => events.push([method, ...args]),
      ]),
    );
    const host = {
      _run: { runId: "audio-world", scenario: "A synthetic garden.", audio: {} },
      _root: {
        addEventListener() {},
        removeEventListener() {},
        querySelector() {
          return null;
        },
      },
      capabilityProps: {},
    };
    const voices = [];
    const services = {
      audio: {
        createPlayer: () => player,
        getAssetManifest: async () => ({ assets: {} }),
        selectDefaultMusic: (cue) => `stock:${cue}`,
      },
      tts: { ttsService: { getActiveId: () => null, speakSequence: async (...args) => voices.push(args) } },
    };
    const controller = new ForgeAudioController(host, services);
    controller.notice = (...message) => events.push(["notice", ...message]);
    return { host, controller, events, voices };
  };

  await test("banner themes use the supported host stock cue while retaining distinct generated identities", async () => {
    const { controller } = fixture();
    const stock = [],
      briefs = [],
      compositions = [];
    // Capability API 1.381's AudioMusicCue contract, also exercised against the real selector in browser proof.
    const hostCues = new Set(["home", "combat", "boss", "happy", "tense", "sad", "bond"]);
    controller.audio.selectDefaultMusic = (cue) => {
      assert(hostCues.has(cue), `Unsupported host stock cue: ${cue}`);
      stock.push(cue);
      return `stock:${cue}`;
    };
    globalThis.Ze = async (path, options) => {
      if (path.startsWith("/api/audio/config")) return generationConfig(path);
      const body = JSON.parse(options.body);
      if (path === "/api/gacha-forge/audio/prompt") {
        briefs.push(body.cue);
        return musicBriefResponse();
      }
      compositions.push(body.context.key);
      return { ok: true, json: async () => ({ tag: `music:${body.context.key}`, path: `${body.context.key}.mp3` }) };
    };
    try {
      controller.configure({ generate: true, audioConnectionId: "banner-source" });
      for (const cue of ["banner-char-featured-f1", "banner-char-featured-f2"]) await controller.cue(cue);
      assert.deepEqual(stock, ["home", "home"]);
      assert.deepEqual(briefs, ["banner-char-featured-f1", "banner-char-featured-f2"]);
      assert.equal(new Set(compositions).size, 2);
      assert(compositions[0].endsWith("banner-char-featured-f1"));
      assert(compositions[1].endsWith("banner-char-featured-f2"));
    } finally {
      controller.dispose();
    }
  });

  await test("banner fallback preserves selected Home music without restarts or stock flashes", async () => {
    const selectedTag = `music:contexts:gacha-forge:${forgeMusicContextKey("audio-world", "source", "home")}:selected`;
    const banner = "banner-char-featured-f1";
    for (const mode of ["off", "failed", "generated", "missing"]) {
      const { controller, events } = fixture();
      const selected = { tag: selectedTag, path: "music/selected.mp3" };
      controller.library = [selected];
      controller.manifest = Promise.resolve({ assets: mode === "missing" ? {} : { [selectedTag]: selected } });
      controller.configure({ generate: ["failed", "generated"].includes(mode), homeMusic: selectedTag });
      const composition = deferred();
      let generations = 0;
      globalThis.Ze = async (path) => {
        if (path.startsWith("/api/audio/config")) return generationConfig(path);
        if (path === "/api/gacha-forge/audio/prompt") return musicBriefResponse();
        generations++;
        return composition.promise;
      };
      const played = () => events.filter(([event]) => event === "playMusic").map(([, tag]) => tag);
      const fallback = mode === "missing" ? "stock:home" : selectedTag;
      try {
        await controller.cue("home");
        const pending = controller.cue(banner);
        await tick();
        assert.deepEqual(played(), [fallback], `${mode}: entering a banner keeps the Home fallback without a restart`);
        if (mode === "failed") composition.resolve({ ok: false, status: 503 });
        if (mode === "generated")
          composition.resolve({ ok: true, json: async () => ({ tag: "music:banner", path: "music/banner.mp3" }) });
        await pending;
        if (mode === "generated") {
          assert.deepEqual(
            played(),
            [selectedTag, "music:banner"],
            "a successful generated theme replaces the fallback",
          );
          const now = Date.now;
          try {
            Date.now = () => now() + 60_001;
            await controller.cue(banner);
          } finally {
            Date.now = now;
          }
          assert.deepEqual(
            played(),
            [selectedTag, "music:banner"],
            "a later render keeps the cached banner theme playing",
          );
        }
        await controller.cue("home");
        assert.deepEqual(
          played(),
          mode === "generated" ? [selectedTag, "music:banner", selectedTag] : [fallback],
          `${mode}: Home returns to its saved track only when a banner theme replaced it`,
        );
        assert.equal(generations, ["failed", "generated"].includes(mode) ? 1 : 0);
        assert.equal(controller.settings.homeMusic, selectedTag, "missing files preserve the saved selection");
      } finally {
        controller.dispose();
      }
    }
  });

  await test("late selected-song reads cannot replace music after leaving a banner", async () => {
    const { controller, events } = fixture();
    const selected = { tag: "music:contexts:gacha-forge:saved:selected", path: "music/selected.mp3" };
    const library = deferred();
    controller.library = [selected];
    controller.libraryRequest = library.promise;
    controller.manifest = Promise.resolve({ assets: { [selected.tag]: selected } });
    controller.configure({ homeMusic: selected.tag });
    try {
      const pending = controller.cue("banner-char-featured-f1");
      await tick();
      await controller.cue("combat");
      library.resolve();
      await pending;
      assert.deepEqual(
        events.filter(([event]) => event === "playMusic").map(([, tag]) => tag),
        ["stock:combat"],
        "the stale banner fallback must not interrupt the current scene",
      );
    } finally {
      controller.dispose();
    }
  });

  const client = await readFile(new URL("../packages/gacha-forge/client.js", import.meta.url), "utf8");
  const stateMethod = client.match(/_state\(\)\{return[^{}]+\}/u)?.[0];
  assert(stateMethod, "extract the shipped string-valued state method, not an invented beat HUD view");
  const actualState = new Function(`return ({${stateMethod}})._state;`)();
  const readyWorld = {
    _state: actualState,
    _boot: "ready",
    _bannerReady: true,
    _artReady: true,
    _hudView: "home",
    _plan: { nodes: [] },
    _beatState: "idle",
    _storyWaits: () => false,
  };

  await test("shipped state routes ready story, bond and combat music without generating during loading", async () => {
    const generated = [];
    globalThis.Ze = async (path, options) => {
      if (path.startsWith("/api/audio/config")) return generationConfig(path);
      if (path === "/api/gacha-forge/audio/prompt") return musicBriefResponse();
      const body = JSON.parse(options.body);
      generated.push(body);
      return { ok: true, json: async () => ({ tag: `music:${body.context.key}`, path: `${body.context.key}.mp3` }) };
    };
    const { host, controller } = fixture();
    Object.assign(host, readyWorld);
    controller.configure({ generate: true, audioConnectionId: "cue-fixture" });
    const step = async (changes, state, cue) => {
      Object.assign(host, changes);
      assert.equal(host._state(), state);
      assert.equal(forgeAudioCue(host), cue);
      await controller.cue(forgeAudioCue(host));
    };
    try {
      await step({}, "hud", "home");
      const homeTag = controller.currentTag;
      await step({ _hudView: "chapter", _beatState: "loading", _forgeMusicMood: "sad" }, "beat", null);
      assert.equal(generated.length, 1);
      assert.equal(controller.currentTag, homeTag, "loading keeps the current track without composing a wrong cue");
      for (const mood of ["happy", "tense", "sad"])
        await step({ _beatState: "ready", _forgeMusicMood: mood }, "beat", mood);
      await step({ _bondUnit: "arden" }, "beat", "bond");
      await step({ _hudView: "combat", _combatPhase: "loading", _combat: null }, "combat", null);
      assert.equal(generated.length, 5);
      await step({ _combatPhase: "prebattle", _combat: { enemies: [{ tier: "common" }] } }, "combat", "combat");
      await step({ _combatPhase: "battle", _combat: { enemies: [{ boss: true }] } }, "combat", "boss");
      await step({ _hudView: "home", _beatState: "idle", _bondUnit: "" }, "hud", "home");
      assert.equal(controller.currentTag, homeTag);
      assert.deepEqual(
        generated.map((body) => body.context.key),
        ["home", "happy", "tense", "sad", "bond", "combat", "boss"].map((cue) =>
          forgeMusicContextKey("audio-world", "cue-fixture", cue),
        ),
      );
      for (const [changes, state] of [
        [{ _boot: "loading" }, "boot"],
        [{ _boot: "ready", _bannerReady: false }, "banner"],
        [{ _bannerReady: true, _artReady: false, _artBlocking: true }, "art"],
        [{ _artReady: true, _plan: null, _planEscaped: false }, "forge"],
      ])
        await step(changes, state, null);
      assert.equal(generated.length, 7);
    } finally {
      controller.dispose();
    }
  });

  await test("leaving a story or muting fences a late readiness result or music brief before composition", async () => {
    for (const stage of ["readiness", "brief"]) {
      for (const destination of ["home", "loading", "muted"]) {
        const held = deferred();
        const generated = [];
        globalThis.Ze = async (path, options) => {
          if (path.startsWith("/api/audio/config"))
            return stage === "readiness" ? held.promise : generationConfig(path);
          const body = JSON.parse(options.body);
          if (path === "/api/gacha-forge/audio/prompt")
            return stage === "brief" && body.cue === "sad" ? held.promise : musicBriefResponse();
          generated.push(body);
          return {
            ok: true,
            json: async () => ({ tag: `music:${body.context.key}`, path: `${body.context.key}.mp3` }),
          };
        };
        const { host, controller } = fixture();
        Object.assign(host, readyWorld, { _hudView: "chapter", _beatState: "ready", _forgeMusicMood: "sad" });
        controller.configure({ generate: true });
        try {
          const old = controller.cue(forgeAudioCue(host));
          await tick();
          let current;
          if (destination === "muted") controller.configure({ generate: true, muted: true });
          else {
            if (destination === "home") Object.assign(host, { _hudView: "home", _beatState: "idle" });
            else host._beatState = "loading";
            current = controller.cue(forgeAudioCue(host));
          }
          held.resolve(stage === "readiness" ? generationConfig("/api/audio/config") : musicBriefResponse());
          await Promise.all([old, current]);
          assert.deepEqual(
            generated.map((body) => body.context.key),
            destination === "home" ? [forgeMusicContextKey("audio-world", "current", "home")] : [],
            `${stage}/${destination}: the old story cannot submit a paid composition after leaving`,
          );
        } finally {
          controller.dispose();
        }
      }
    }
  });

  await test("readiness refreshes after failure or unconfigured state, without probing on each render", async () => {
    const now = Date.now;
    let clock = 1_000_000;
    Date.now = () => clock;
    try {
      for (const initial of ["offline", "unconfigured"]) {
        let ready = false;
        let reads = 0;
        let posts = 0;
        globalThis.Ze = async (path) => {
          if (path === "/api/gacha-forge/audio/prompt") return musicBriefResponse();
          if (path.startsWith("/api/audio/config")) {
            reads += 1;
            if (!ready && initial === "offline") throw new Error("offline");
            return generationConfig(path, { configured: ready });
          }
          posts += 1;
          return { ok: true, json: async () => ({ tag: "music:ready", path: "music/ready.mp3" }) };
        };
        const { controller, events } = fixture();
        controller.configure({ generate: true });
        await controller.cue("home");
        ready = true;
        await controller.cue("home");
        await controller.generate("sfx", "click");
        assert.equal(reads, 1, "all cues share the bounded readiness cache");
        assert.equal(posts, 0);
        clock += 60_000;
        await controller.cue("home");
        assert.equal(reads, 2, "the same scene retries readiness after the retry interval");
        assert.equal(posts, 1);
        assert.equal(events.filter(([event]) => event === "playMusic").at(-1)[1], "music:ready");
        assert.equal(
          events.some(([event]) => event === "notice"),
          false,
        );
        controller.dispose();
      }
    } finally {
      Date.now = now;
    }
  });

  await test("generation toggles and connection changes invalidate readiness and fence stale probes", async () => {
    const first = deferred();
    let reads = 0;
    const posts = [];
    globalThis.Ze = async (path, options) => {
      if (path === "/api/gacha-forge/audio/prompt") return musicBriefResponse();
      if (path.startsWith("/api/audio/config")) {
        reads += 1;
        return reads === 1 ? first.promise : generationConfig(path);
      }
      posts.push(JSON.parse(options.body));
      return { ok: true, json: async () => ({ tag: "music:ready", path: "music/ready.mp3" }) };
    };
    const { controller } = fixture();
    controller.configure({ generate: true, audioConnectionId: "first" });
    const stale = controller.generate("music", "home");
    controller.configure({ generate: false, audioConnectionId: "first" });
    controller.configure({ generate: true, audioConnectionId: "first" });
    await controller.generate("music", "home");
    first.resolve(generationConfig("/api/audio/config?audioConnectionId=first"));
    assert.equal(await stale, null, "an old successful probe cannot follow a disable/re-enable cycle");
    controller.configure({ generate: true, audioConnectionId: "second" });
    await controller.generate("music", "home");
    assert.equal(reads, 3);
    assert.deepEqual(
      posts.map((body) => body.audioConnectionId),
      ["first", "second"],
    );
    controller.dispose();
  });

  await test("explicit restored connections generate only their supported channel and retain stock fallback", async () => {
    for (const supported of ["music", "sfx"]) {
      const paths = [];
      const posts = [];
      const id = `${supported}-only`;
      globalThis.Ze = async (path, options) => {
        if (path === "/api/gacha-forge/audio/prompt") return musicBriefResponse();
        if (path.startsWith("/api/audio/config")) {
          paths.push(path);
          return generationConfig(path, { music: supported === "music", soundEffects: supported === "sfx" });
        }
        posts.push(JSON.parse(options.body));
        return { ok: true, json: async () => ({ tag: `${supported}:ready`, path: `${supported}/ready.mp3` }) };
      };
      const { controller, events } = fixture();
      controller.configure({ generate: true, audioConnectionId: id });
      await controller.cue("home");
      await controller.effect("click");
      await tick();
      await controller.generate("music", "boss");
      await controller.generate("sfx", "hit");
      assert.deepEqual(paths, [`/api/audio/config?audioConnectionId=${id}`]);
      assert.equal(posts.length, 2);
      assert.ok(posts.every((body) => body.kind === supported && body.audioConnectionId === id));
      assert.ok(events.some(([event, tag]) => event === "playMusic" && tag === "stock:home"));
      assert.ok(events.some(([event, tag]) => event === "playSfx" && tag === "sfx:ui:click"));
      assert.equal(
        events.some(([event]) => event === "notice"),
        false,
      );
      controller.dispose();
    }
    const missingRequests = [];
    // API 1.381 rejects unknown explicit IDs rather than borrowing its default connection.
    globalThis.Ze = async (path, options) => {
      if (path === "/api/gacha-forge/audio/prompt") return musicBriefResponse();
      missingRequests.push([path, options?.method || "GET"]);
      return { ok: false, status: 409, json: async () => ({ error: "Selected source unavailable" }) };
    };
    const { controller } = fixture();
    controller.configure({ generate: true, audioConnectionId: "missing" });
    assert.equal(await controller.generate("music", "home"), null, "an explicit selection cannot borrow the default");
    assert.deepEqual(missingRequests, [["/api/audio/config?audioConnectionId=missing", "GET"]]);
    controller.dispose();
  });

  await test("trusted legacy aliases retain the selected ID for requests and repeated effect cache reuse", async () => {
    const posts = [];
    const reads = [];
    globalThis.Ze = async (path, options) => {
      if (path === "/api/gacha-forge/audio/prompt") return musicBriefResponse();
      if (path.startsWith("/api/audio/config")) {
        reads.push(path);
        return generationConfig(path, { connectionId: "canonical-generation" });
      }
      posts.push(JSON.parse(options.body));
      return { ok: true, json: async () => ({ tag: "sfx:legacy", path: "sfx/legacy.mp3" }) };
    };
    const { controller, events } = fixture();
    controller.configure({ generate: true, audioConnectionId: "trusted-legacy" });
    const generated = await controller.generate("sfx", "click");
    assert.equal(generated?.tag, "sfx:legacy");
    await controller.effect("click");
    await tick();
    await controller.effect("click");
    await tick();
    assert.deepEqual(reads, ["/api/audio/config?audioConnectionId=trusted-legacy"]);
    assert.equal(posts.length, 1, "repeated effects reuse the approved explicit source without another POST");
    assert.equal(posts[0].audioConnectionId, "trusted-legacy");
    assert.equal(controller.settings.audioConnectionId, "trusted-legacy");
    assert.deepEqual(
      events.filter(([event]) => event === "playSfx").map(([, tag]) => tag),
      ["sfx:legacy", "sfx:legacy"],
    );
    controller.dispose();
  });

  await test("switching to an unavailable default cannot reuse the previous explicit connection's effects", async () => {
    globalThis.Ze = async (path) =>
      path.startsWith("/api/audio/config")
        ? generationConfig(path, { configured: path.includes("?") })
        : { ok: true, json: async () => ({ tag: "sfx:previous", path: "sfx/previous.mp3" }) };
    const { controller, events } = fixture();
    controller.configure({ generate: true, audioConnectionId: "explicit" });
    await controller.generate("sfx", "click");
    controller.configure({ generate: true, audioConnectionId: "" });
    await controller.effect("click");
    await tick();
    await controller.effect("click");
    assert.deepEqual(
      events.filter(([event]) => event === "playSfx").map(([, tag]) => tag),
      ["sfx:ui:click", "sfx:ui:click"],
    );
    assert.equal(
      events.some(([event]) => event === "notice"),
      false,
    );
    controller.dispose();
  });

  await test("stock audio needs no generation and volume changes do not restart tracks", async () => {
    globalThis.Ze = () => {
      throw new Error("No HTTP expected for stock audio");
    };
    const { controller, events } = fixture();
    await controller.cue("home");
    controller.configure({ musicVolume: 0.17, sfxVolume: 0 });
    await controller.cue("home");
    assert.equal(events.filter(([event]) => event === "playMusic").length, 1);
    assert.deepEqual(events.filter(([event]) => event === "setVolumes").at(-1)[1], { music: 0.17, sfx: 0 });
    await controller.effect("click");
    assert.equal(
      events.some(([event]) => event === "playSfx"),
      false,
    );
    controller.dispose();
    controller.dispose();
    assert.equal(events.filter(([event]) => event === "dispose").length, 1);
  });

  await test("generated cues dedupe, reuse and return to stock when disabled", async () => {
    const requests = [];
    globalThis.Ze = async (path, options) => {
      if (path === "/api/gacha-forge/audio/prompt") return musicBriefResponse();
      if (path.startsWith("/api/audio/config")) return generationConfig(path);
      const body = JSON.parse(options.body);
      requests.push({ path, ...body });
      return {
        ok: true,
        json: async () => ({ tag: `${body.kind}:package:one`, path: `${body.kind}/package/one.mp3` }),
      };
    };
    const { controller, events } = fixture();
    controller.configure({ generate: true, audioConnectionId: "dedicated" });
    await Promise.all([controller.cue("boss"), controller.cue("boss")]);
    await controller.cue("boss");
    assert.equal(requests.length, 1);
    assert.deepEqual(requests[0].context, {
      scope: "gacha-forge",
      key: forgeMusicContextKey("audio-world", "dedicated", "boss"),
      lengthMs: 60000,
    });
    assert.equal(requests[0].audioConnectionId, "dedicated");
    assert.equal(events.filter(([event]) => event === "playMusic").length, 2, "stock then generated");
    await controller.effect("hit");
    await tick();
    await controller.effect("hit");
    assert.equal(events.filter(([event]) => event === "playSfx").at(-1)[1], "sfx:package:one");
    controller.configure({ ...controller.settings, generate: false });
    await controller.cue("boss");
    assert.equal(events.filter(([event]) => event === "playMusic").at(-1)[1], "stock:boss");
    await controller.effect("hit");
    assert.equal(events.filter(([event]) => event === "playSfx").at(-1)[1], "sfx:combat:spell-hit");
    controller.dispose();
  });

  await test("generation errors leave stock music playing and do not retry a cue on every render", async () => {
    let requests = 0;
    globalThis.Ze = async (path) => {
      if (path === "/api/gacha-forge/audio/prompt") return musicBriefResponse();
      if (path.startsWith("/api/audio/config")) return generationConfig(path);
      requests += 1;
      return { ok: false, status: 503 };
    };
    const { controller, events } = fixture();
    controller.configure({ generate: true, audioConnectionId: "unavailable" });
    await controller.cue("home");
    await controller.cue("home");
    assert.equal(requests, 1);
    assert.deepEqual(
      events.filter(([event]) => event === "playMusic").map(([, tag]) => tag),
      ["stock:home"],
    );
    assert.deepEqual(events.filter(([event]) => event === "notice").at(-1), [
      "notice",
      "audio.generationRejected",
      503,
    ]);
    assert.equal(controller.generated.size, 0);
    controller.dispose();
  });

  await test("generation failures retain the provider HTTP status without displaying response bodies", async () => {
    globalThis.Ze = async (path) => {
      if (path === "/api/gacha-forge/audio/prompt") return musicBriefResponse();
      if (path.startsWith("/api/audio/config")) return generationConfig(path);
      return {
        ok: false,
        status: 502,
        json: async () => ({
          error: "Audio generation failed",
          detail: "ElevenLabs audio request returned HTTP 401",
          secret: "must never appear in a notice",
        }),
      };
    };
    const { controller, events } = fixture();
    controller.configure({ generate: true, audioConnectionId: "rejected" });
    await controller.cue("home");
    assert.deepEqual(events.filter(([event]) => event === "notice").at(-1), [
      "notice",
      "audio.generationRejected",
      401,
    ]);
    assert.equal(JSON.stringify(events).includes("secret"), false);
    assert.equal(controller.generated.size, 0);
    controller.dispose();
  });

  await test("new hosts expose their bounded provider reason while old hosts retain numeric fallback", async () => {
    globalThis.Ze = async (path) => {
      if (path.startsWith("/api/audio/config")) return generationConfig(path);
      if (path === "/api/gacha-forge/audio/prompt") return musicBriefResponse();
      return {
        ok: false,
        status: 502,
        json: async () => ({
          error: "Audio generation failed",
          providerStatus: 400,
          reason: "Prompt rejected.\n" + "x".repeat(400),
          secret: "not public",
        }),
      };
    };
    const { controller, events } = fixture();
    controller.configure({ generate: true });
    await controller.cue("home");
    const message = events.filter(([event]) => event === "notice").at(-1);
    assert.equal(message[1], "audio.generationReason");
    assert.equal(message[2], 400);
    assert.equal(message[3].length, 300);
    assert.equal(message[3].includes("\n"), false);
    assert.equal(JSON.stringify(events).includes("not public"), false);
    const previousResizeObserver = globalThis.ResizeObserver;
    const observers = [];
    globalThis.ResizeObserver = class {
      constructor(callback) {
        this.callback = callback;
        observers.push(this);
      }
      observe(node) {
        this.node = node;
      }
      disconnect() {
        this.disconnected = true;
      }
    };
    const status = {
      textContent: "",
      style: {},
      isConnected: true,
      clientHeight: 30,
      scrollHeight: 30,
      remove() {
        this.isConnected = false;
      },
    };
    const rendered = { host: { _root: { querySelector: () => status } } };
    try {
      ForgeAudioController.prototype.notice.call(rendered, "audio.generationReason", 400, "Provider says $&");
      assert.ok(status.textContent.includes("Provider says $&"), "provider text is interpolated literally");
      const observer = observers.at(-1);
      assert.equal(observer.node, status);
      assert.equal(status.tabIndex, -1);
      status.scrollHeight = 80;
      observer.callback();
      assert.equal(status.tabIndex, 0);
      assert.equal(status.style.pointerEvents, "auto");
      rendered.dismissNotice();
      assert.equal(observer.disconnected, true);
      assert.equal(status.onfocus, null);
      assert.equal(status.onblur, null);
      assert.equal(status.isConnected, false);
    } finally {
      rendered.dismissNotice?.();
      if (previousResizeObserver === undefined) delete globalThis.ResizeObserver;
      else globalThis.ResizeObserver = previousResizeObserver;
    }
    controller.dispose();
  });

  await test("music waits for one model brief and submits its exact output before caching the asset", async () => {
    const model = deferred();
    const requests = [];
    globalThis.Ze = async (path, options) => {
      if (path.startsWith("/api/audio/config")) return generationConfig(path);
      requests.push({ path, body: JSON.parse(options.body) });
      if (path === "/api/gacha-forge/audio/prompt") return model.promise;
      return { ok: true, json: async () => ({ tag: "music:model", path: "music/model.mp3" }) };
    };
    const { controller } = fixture();
    controller.configure({ generate: true });
    const first = controller.generate("music", "home");
    const second = controller.generate("music", "home");
    await tick();
    assert.deepEqual(requests, [
      { path: "/api/gacha-forge/audio/prompt", body: { runId: "audio-world", cue: "home", debugMode: false } },
    ]);
    model.resolve(musicBriefResponse());
    assert.equal((await first).tag, "music:model");
    assert.equal((await second).tag, "music:model");
    assert.equal(requests.length, 2);
    assert.equal(requests[1].path, "/api/audio/generate");
    assert.equal(requests[1].body.prompt, (await musicBriefResponse().json()).prompt);
    await controller.generate("music", "home");
    assert.equal(requests.length, 2, "cached music does not pay for another brief or composition");
    controller.dispose();
  });

  await test("failed or cancelled model briefs never submit a paid audio generation", async () => {
    for (const mode of ["failed", "invalid", "cancelled", "muted", "quiet", "world"]) {
      const model = deferred();
      const requests = [];
      globalThis.Ze = async (path, options) => {
        if (path.startsWith("/api/audio/config")) return generationConfig(path);
        requests.push(path);
        assert.equal(path, "/api/gacha-forge/audio/prompt");
        return model.promise;
      };
      const { controller, events } = fixture();
      controller.configure({ generate: true });
      const pending = controller.cue("home");
      await tick();
      if (mode === "cancelled") controller.configure({ generate: false });
      if (mode === "muted") controller.configure({ generate: true, muted: true });
      if (mode === "quiet") controller.configure({ generate: true, musicVolume: 0 });
      if (mode === "world") controller.host._run.runId = "another-world";
      model.resolve({
        ok: true,
        json: async () =>
          mode === "failed"
            ? { ok: false }
            : { ok: true, prompt: mode === "invalid" ? "x".repeat(1001) : "late brief" },
      });
      await pending;
      assert.deepEqual(requests, ["/api/gacha-forge/audio/prompt"]);
      assert.equal(controller.generated.size, 0);
      const notices = events.filter(([event]) => event === "notice");
      if (["cancelled", "muted", "quiet", "world"].includes(mode)) assert.equal(notices.length, 0);
      else assert.equal(notices[0][1], "audio.promptFailed");
      controller.dispose();
    }
  });

  await test("complete provider prompts are bounded and sound effects never use a music context", async () => {
    const requests = [];
    globalThis.Ze = async (path, options) => {
      if (path === "/api/gacha-forge/audio/prompt") return musicBriefResponse();
      if (path.startsWith("/api/audio/config")) return generationConfig(path);
      const body = JSON.parse(options.body);
      requests.push(body);
      return { ok: true, json: async () => ({ tag: `${body.kind}:fixture`, path: `${body.kind}/fixture.mp3` }) };
    };
    const { host, controller } = fixture();
    host._run.scenario = "W".repeat(4000);
    controller.runId = "_world-with-a-valid-NanoID-prefix";
    host._run.runId = controller.runId;
    controller.configure({ generate: true, audioConnectionId: "dedicated" });
    await controller.generate("music", "boss");
    await controller.generate("sfx", "critical");
    assert.equal("context" in requests[1], false, "the real generic route rejects contexts on sound effects");
    assert.ok(requests[0].prompt.length <= 1000, "the entire music style must fit SunoAPI's bound");
    assert.ok(requests[1].prompt.length <= 500, "the entire sound-effects prompt must fit SunoAPI's bound");
    assert.match(requests[0].context.key, /^[a-z0-9][a-z0-9_-]{0,159}$/);
    assert.notEqual(forgeMusicContextKey("_world", "A", "boss"), forgeMusicContextKey("_world", "a", "boss"));
    assert.notEqual(forgeMusicContextKey("_world", "a", "boss"), forgeMusicContextKey("-world", "a", "boss"));
    assert.match(forgeMusicContextKey("W".repeat(200), "C".repeat(200), "happy"), /^world-[a-f0-9]+-happy$/);
    controller.dispose();
  });

  await test("current connection capabilities limit generation and disabling it aborts an in-flight request", async () => {
    const requests = [];
    globalThis.Ze = async (path, options) => {
      if (path === "/api/gacha-forge/audio/prompt") return musicBriefResponse();
      if (path === "/api/audio/config")
        return {
          ok: true,
          json: async () => ({ configured: true, connectionId: "current-music", music: true, soundEffects: false }),
        };
      requests.push({ ...JSON.parse(options.body), signal: options.signal });
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(new DOMException("Cancelled", "AbortError")), {
          once: true,
        });
      });
    };
    const { controller, events } = fixture();
    controller.configure({ generate: true });
    await controller.effect("click");
    await tick();
    assert.equal(requests.length, 0, "music-only connections do not generate sound effects");
    const pending = controller.cue("home");
    await tick();
    assert.equal(requests.length, 1);
    assert.equal(requests[0].audioConnectionId, "current-music");
    assert.equal(requests[0].signal.aborted, false);
    controller.configure({ generate: false });
    await pending;
    assert.equal(requests[0].signal.aborted, true);
    assert.equal(controller.generated.size, 0);
    assert.deepEqual(
      events.filter(([event]) => event === "playMusic").map(([, tag]) => tag),
      ["stock:home"],
    );
    assert.equal(
      events.some(([event]) => event === "notice"),
      false,
      "cancellation is not a provider failure",
    );
    controller.dispose();
  });

  await test("unvoiced and thought lines are silent; assigned dialogue forwards the exact speech connection", async () => {
    let reads = 0;
    globalThis.Ze = async () => {
      reads += 1;
      return {
        ok: true,
        json: async () => ({
          enabled: true,
          connectionId: "speech-source",
          connectionProfiles: {
            "speech-source": { voiceAssignments: [{ characterId: "engine-char", voice: "voice-a" }] },
          },
        }),
      };
    };
    const { controller, voices } = fixture();
    controller.configure({ tts: true });
    await controller.speak({ speaker: "Arden", text: "no card" }, {}, new AbortController().signal);
    await controller.speak(
      { speaker: "Arden", text: "thought", thought: true },
      { characterId: "engine-char" },
      new AbortController().signal,
    );
    await controller.speak(
      { speaker: "", text: "narration" },
      { characterId: "engine-char" },
      new AbortController().signal,
    );
    assert.equal(reads, 0);
    await controller.speak(
      { speaker: "Arden", text: "assigned line" },
      { characterId: "engine-char" },
      new AbortController().signal,
    );
    assert.equal(voices.length, 1);
    assert.equal(voices[0][0][0].voice, "voice-a");
    assert.equal(voices[0][0][0].characterId, "engine-char");
    assert.equal(voices[0][2].audioConnectionId, "speech-source");
    controller.dispose();
    const reopened = fixture();
    reopened.controller.configure({ tts: true });
    await reopened.controller.speak(
      { speaker: "Arden", text: "reopened world" },
      { characterId: "engine-char" },
      new AbortController().signal,
    );
    assert.notEqual(voices[0][1], reopened.voices[0][1], "returning to the same world gets a new playback ID");
    reopened.controller.dispose();
  });

  await test("Voice other characters reads NPCs and voiceless units; explicit voices and the persona keep theirs", async () => {
    const config = {
      enabled: true,
      connectionId: "speech-source",
      connectionProfiles: {
        "speech-source": {
          voiceAssignments: [{ characterId: "engine-char", voice: "voice-a" }],
          npcDefaultMaleVoices: ["m1", "m2"],
          npcDefaultFemaleVoices: ["f1", "f2", "f3"],
        },
      },
    };
    let reads = 0;
    globalThis.Ze = async (path) => {
      assert.equal(path, "/api/tts/config", "filled pools never list provider voices");
      reads += 1;
      return { ok: true, json: async () => structuredClone(config) };
    };
    const npc = { speaker: "The Old Station Keeper", text: "Tickets, please.", gender: "male" };
    const off = fixture();
    off.controller.configure({ tts: true });
    await off.controller.speak(npc, null, new AbortController().signal);
    await off.controller.speak({ speaker: "Bryn", text: "Hi." }, { name: "Bryn", characterId: null }, undefined);
    assert.equal(reads, 0, "off keeps 1.24.5 behaviour: no config read for unassigned speakers");
    assert.equal(off.voices.length, 0);
    off.controller.dispose();
    const { controller, voices } = fixture();
    controller.configure({ tts: true, otherVoices: true });
    await controller.speak(npc, null, new AbortController().signal);
    await controller.speak(
      { speaker: "Bryn", text: "A unit without a card.", gender: "male" },
      { name: "Bryn", characterId: null, gender: "female", prota: false },
      new AbortController().signal,
    );
    await controller.speak({ speaker: "Arden", text: "assigned line" }, { characterId: "engine-char" }, undefined);
    await controller.speak(
      { speaker: "Mari", text: "persona line" },
      { name: "Mari", characterId: "persona", prota: true },
    );
    await controller.speak({ speaker: "Mari", text: "persona thought", thought: true }, null);
    assert.equal(voices.length, 3, "NPC, voiceless unit and explicit character speak; the voiceless persona does not");
    const [keeper, bryn, arden] = voices.map((call) => call[0][0]);
    assert.equal(keeper.voice, ["m1", "m2"][engineStableIndex(npc.speaker, 2)]);
    assert.equal("characterId" in keeper, false);
    assert.match(keeper.cacheKey, /^gacha-voice-v1:world-/u);
    assert.equal(
      bryn.voice,
      ["f1", "f2", "f3"][engineStableIndex("Bryn", 3)],
      "the unit's own sex beats the beat hint",
    );
    assert.equal(arden.voice, "voice-a", "explicit assignments always win");
    assert.equal(arden.characterId, "engine-char");
    assert.equal(voices[0][2].audioConnectionId, "speech-source");
    await controller.speak({ ...npc, text: "Again." }, null, undefined);
    assert.equal(voices[3][0][0].voice, keeper.voice, "a name keeps its voice");
    controller.dispose();
  });

  await test("queued audio writes preserve other fields and never follow the player into another world", async () => {
    const pause = deferred();
    let writes = 0;
    const host = {
      _run: { runId: "first", audio: normalizeForgeAudio({ musicVolume: 0 }) },
      async _setSourcesNow(sources) {
        writes += 1;
        if (writes === 1) await pause.promise;
        this._run.audio = sources.audio;
      },
    };
    // The real queue's completion UI work is irrelevant here; stub the same host method used by it.
    host._root = {
      querySelectorAll: () => [],
      querySelector: () => null,
      addEventListener() {},
      removeEventListener() {},
    };
    host._forgeAudio = { runId: "first", configure() {}, cue() {}, dispose() {} };
    const first = saveForgeAudioSources(host, { audio: { muted: true } });
    const second = saveForgeAudioSources(host, { audio: { tts: true } });
    await tick();
    pause.resolve();
    await Promise.all([first, second]);
    assert.equal(host._run.audio.musicVolume, 0);
    assert.equal(host._run.audio.muted, true);
    assert.equal(host._run.audio.tts, true);
    const old = saveForgeAudioSources(host, { audio: { musicVolume: 1 } });
    host._run = { runId: "second", audio: normalizeForgeAudio() };
    await old;
    assert.equal(writes, 2);
    assert.equal(host._run.audio.musicVolume, 0.5);
  });

  await test("shipped server persists audio, preserves card identity and saves generated music mood", async () => {
    const docs = new Map();
    const routes = new Map();
    const prompts = [];
    const seed = (id, kind, data) => {
      docs.set(id, {
        id,
        kind,
        packageId: "gacha-forge",
        name: id,
        description: "fixture",
        revision: 1,
        data: structuredClone(data),
      });
    };
    const runId = "audio-route-proof";
    const run = {
      runId,
      name: "Audio",
      scenario: "A fictional garden.",
      connectionId: "fixture-model",
      protagonist: { name: "Mari" },
      story: { choices: false },
      images: { connectionId: "" },
      audio: { tts: true, otherVoices: true },
    };
    seed("index", "index", { runs: [run], activeRunId: runId });
    seed(`${runId}:session`, "session", { progress: {} });
    seed(`${runId}:chapter:1`, "chapter-plan", {
      chapter: 1,
      nodes: [0, 1].map((index) => ({
        index: index + 1,
        type: "story",
        title: "Garden",
        guide: "Meet Arden.",
        goal: "Continue.",
      })),
    });
    seed(`${runId}:beat:1:0`, "beat", {
      chapter: 1,
      storyIndex: 0,
      musicMood: "sad",
      segments: [{ speaker: "Arden", text: "A stored line." }],
      places: [],
    });
    seed(`${runId}:unit:arden`, "unit", {
      kind: "character",
      name: "Arden",
      cardId: "engine-arden",
      identitySex: "female",
    });
    seed(`${runId}:unit:generated`, "unit", { kind: "character", name: "Generated", identitySex: "female" });
    globalThis.fetch = async (input) => {
      assert.equal(new URL(input).pathname, "/api/connections");
      return {
        ok: true,
        json: async () => [{ id: "fixture-model", provider: "fixture", model: "fixture", maxContext: 128000 }],
      };
    };
    const { activate } = await import(`../packages/gacha-forge/server.mjs?audio=${Date.now()}`);
    const clone = (value) => structuredClone(value);
    const documents = {
      getById: async (_package, id) => clone(docs.get(id) || null),
      list: async (_package, kind) => clone([...docs.values()].filter((doc) => !kind || doc.kind === kind)),
      create: async (doc) => {
        const stored = { ...clone(doc), revision: 1 };
        assert.equal(docs.has(doc.id), false);
        docs.set(doc.id, stored);
        return clone(stored);
      },
      update: async (doc) => {
        const old = docs.get(doc.id);
        if (old?.revision !== doc.expectedRevision) return null;
        const stored = { ...old, ...clone(doc), revision: old.revision + 1 };
        delete stored.expectedRevision;
        docs.set(doc.id, stored);
        return clone(stored);
      },
      remove: async (_package, id) => docs.delete(id),
    };
    await activate({
      package: { id: "gacha-forge", version: "fixture" },
      api: {
        runtime: {
          persistence: { documents },
          logger: { info() {}, warn() {}, error() {}, debug() {} },
          json: { parseJsonish: JSON.parse },
          languageModels: {
            async resolveForRequest() {
              return {
                model: "fixture",
                async chatComplete(messages) {
                  prompts.push(messages);
                  return {
                    content: JSON.stringify({
                      musicMood: "tense",
                      places: [],
                      voices: { "Gate Warden": "male" },
                      segments: [
                        { speaker: "Arden", text: "A generated line." },
                        { speaker: "Gate Warden", text: "Halt." },
                      ],
                    }),
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
    const post = (path, body) => {
      assert.ok(routes.has(`POST ${path}`));
      return routes.get(`POST ${path}`)({ body });
    };
    const created = await post("/run", {
      scenario: "A second fictional world.",
      connectionId: "fixture-model",
      protagonist: { name: "Mari" },
      images: { connectionId: "" },
      storyNow: false,
      audio: { tts: true, musicVolume: 0, autoplayPauseSeconds: 4.5 },
    });
    assert.equal(created.ok, true, JSON.stringify(created));
    assert.ok(created.run.audio, "The shipped create route must persist audio settings");
    assert.equal(created.run.audio.tts, true);
    assert.equal(created.run.audio.musicVolume, 0);
    assert.equal(created.run.audio.generate, false);
    assert.equal(created.run.audio.autoplayPauseSeconds, 4.5);
    const saved = await post("/run/sources", {
      runId: created.run.runId,
      sources: { audio: { muted: true, generate: true, audioConnectionId: "dedicated" } },
    });
    assert.equal(saved.ok, true);
    assert.equal(saved.run.audio.musicVolume, 0);
    assert.equal(saved.run.audio.tts, true);
    assert.equal(saved.run.audio.muted, true);
    assert.equal(saved.run.audio.audioConnectionId, "dedicated");
    const cached = await post("/beat", { runId, chapter: 1, storyIndex: 0 });
    assert.equal(cached.ok, true, JSON.stringify(cached));
    assert.equal(cached.musicMood, "sad");
    assert.equal(cached.cast.find((character) => character.name === "Arden").characterId, "engine-arden");
    assert.equal(cached.cast.find((character) => character.name === "Generated").characterId, null);
    const generated = await post("/beat", { runId, chapter: 1, storyIndex: 1 });
    assert.equal(generated.ok, true, JSON.stringify(generated));
    assert.equal(generated.musicMood, "tense");
    assert.equal(docs.get(`${runId}:beat:1:1`).data.musicMood, "tense");
    assert.match(prompts.flatMap((messages) => messages.map((message) => message.content)).join("\n"), /musicMood/u);
    const beats = prompts.filter((messages) => /Narrate ONE story beat/u.test(messages[0].content));
    assert.equal(beats.length, 1);
    assert.match(beats[0][0].content, /SPEAKER VOICES/u, "NPC voice genders come from the same beat request");
    assert.equal(prompts.filter((messages) => /SPEAKER VOICES/u.test(messages[0].content)).length, 1);
    assert.deepEqual(
      docs.get(`${runId}:beat:1:1`).data.segments.map((segment) => segment.gender),
      [undefined, "male"],
      "the normalized beat saves each NPC's voice gender",
    );
    assert.equal(generated.segments[1].gender, "male");
    assert.equal(generated.cast.find((character) => character.name === "Arden").gender, "female");
    assert.equal(generated.cast.find((character) => character.name === "Generated").gender, "female");
  });
} finally {
  for (const [key, value] of Object.entries(before)) {
    if (value === undefined) delete globalThis[key];
    else globalThis[key] = value;
  }
}
process.stdout.write(`${cases} Gacha Forge audio regression cases passed.\n`);
