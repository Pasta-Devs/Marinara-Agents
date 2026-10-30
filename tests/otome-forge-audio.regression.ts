// Otome Forge M2b: music briefs (P14), generated tracks, the audio settings (S/audio/music.ts, S/routes/audio.ts), the
// stock cue each story cue falls back on, and whose voice reads each line (C/lib/audio.ts with the kit's
// forgeSpeakerVoice).
import assert from "node:assert/strict";
import test from "node:test";
import { forgeSoundtrackContextKey } from "@forge-kit/audio-settings.mjs";
import {
  musicAssetFolders,
  musicAssetsInFolder,
  normalizeOtomeAudio,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/audio.ts";
import { forgeKnowledgeBoundary } from "@forge-kit/story-memory-integration.mjs";
import { forgeSpeakerVoice } from "@forge-kit/voice-picking.mjs";
import {
  ENGINE_MUSIC_CUE,
  lineSpeaker,
  runIdOf,
  wouldVoice,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/lib/audio.ts";
import { playsHomeCue } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/screens/screens.ts";
import type { RunLiView } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import {
  MUSIC_MEDIUM,
  MUSIC_SCENES,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/cues.ts";
import { MUSIC_MOODS } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/faces.ts";
import { musicBriefMessages } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/audio/music.ts";
import { worldId } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { registerAudioRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/audio.ts";
import {
  normalizeWorld,
  normalizeWorldAudio,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { routesOf } from "./fixtures/otome-forge-art.ts";
import { HE, KAI, MIR, SHE, json, storyWorld } from "./fixtures/otome-forge-story.ts";

async function audioWorld(runKey: string, replies: Parameters<typeof storyWorld>[0]["replies"] = []) {
  const t = await storyWorld({ runKey, replies });
  const call = routesOf(registerAudioRoutes, t.deps, runKey);
  const world = async () => (await t.store.readDoc(worldId(t.runId), normalizeWorld))!;
  return { ...t, call, world };
}

test("each story cue has a stock stand-in, and P14 writes an English brief for every cue from the premise alone", () => {
  assert.deepEqual(ENGINE_MUSIC_CUE, {
    home: "home",
    date: "happy",
    tender: "bond",
    confession: "bond",
    tense: "tense",
    angst: "sad",
  });
  assert.deepEqual(Object.keys(MUSIC_SCENES).sort(), [...MUSIC_MOODS].sort());
  const world = { premise: "Someone is putting out the harbour's lanterns.", setting: "A harbour city." };
  for (const cue of MUSIC_MOODS) {
    const messages = musicBriefMessages(world, cue);
    assert.match(messages[0]!.content, /original instrumental romance visual novel brief in English/);
    const user = JSON.parse(messages[1]!.content);
    assert.equal(user.soundtrackContext, MUSIC_SCENES[cue]);
    assert.match(user.world, /harbour's lanterns[\s\S]*A harbour city/);
    assert.ok(!messages.some((message) => message.content.includes(forgeKnowledgeBoundary)));
    // The scenes assume nobody's gender.
    assert.doesNotMatch(MUSIC_SCENES[cue], /\b(?:he|him|his|she|her)\b/i);
  }
  assert.equal(MUSIC_MEDIUM, "romance visual novel");
});

test("the home cue plays on in the reader until its first scene's cue arrives, and only inside a run", () => {
  for (const screen of ["home", "story", "phone", "album", "reader"] as const) {
    assert.equal(playsHomeCue(screen, "picker"), true, screen);
  }
  for (const screen of ["picker", "setup", "forge", "bible"] as const)
    assert.equal(playsHomeCue(screen, "home"), false);
  assert.equal(playsHomeCue("settings", "home"), true, "Settings opened from inside a run");
  assert.equal(playsHomeCue("settings", "picker"), false);
});

test("a cue's brief is one model call, kept for the next request, and never written while music is off", async () => {
  const t = await audioWorld("r-m2baud01-aaaaaa", [json({ prompt: "Solo cello motif over harbour bells, 60s loop." })]);
  const off = await t.call("POST", "/runs/:run/audio/brief", { cue: "tender" });
  assert.deepEqual([off.status, off.body.code], [409, "conflict"]);
  assert.equal(t.calls.length, 0, "no brief is paid for while the world generates no music");

  await t.call("POST", "/runs/:run/audio/settings", { audio: { generate: true, musicVolume: 3 } });
  const [first, second] = await Promise.all([
    t.call("POST", "/runs/:run/audio/brief", { cue: "tender" }),
    t.call("POST", "/runs/:run/audio/brief", { cue: "tender" }),
  ]);
  assert.equal(first.body.prompt, "Solo cello motif over harbour bells, 60s loop.");
  assert.equal(second.body.prompt, first.body.prompt);
  assert.equal(t.calls.length, 1, "two requests for one cue share one call");
  assert.equal(t.calls[0]!.connectionId, "conn-text", "the structured job falls back to narration");
  const again = await t.call("POST", "/runs/:run/audio/brief", { cue: "tender" });
  assert.equal(again.body.prompt, first.body.prompt);
  assert.equal(t.calls.length, 1, "kept in world.audio.briefs");
  assert.ok((await t.world()).audio.briefs.tender?.fingerprint);
  assert.ok(
    t.logs.some((entry) => entry.level === "debugOverride" && entry.override === true),
    "the prompt is logged in debug mode",
  );
  assert.equal((await t.call("POST", "/runs/:run/audio/brief", { cue: "boss" })).status, 400);
});

test("a generated track is kept only when the Engine filed it for this run under otome-forge", async () => {
  const t = await audioWorld("r-m2baud02-bbbbbb");
  const key = forgeSoundtrackContextKey(runIdOf("r-m2baud02-bbbbbb"), "conn-audio", "date");
  assert.equal(runIdOf("r-m2baud02-bbbbbb"), t.runId, "the client and the server key the context alike");
  const track = {
    cue: "date",
    connectionId: "conn-audio",
    tag: `music:contexts:otome-forge:${key}:take-1`,
    path: `music/contexts/otome-forge/${key}/take-1.mp3`,
  };
  const kept = await t.call("POST", "/runs/:run/audio/track", track);
  assert.equal(kept.status, 200);
  assert.deepEqual(kept.body.tracks, [track]);
  // The same tag again replaces it.
  assert.equal((await t.call("POST", "/runs/:run/audio/track", track)).body.tracks.length, 1);

  const refused = [
    { ...track, tag: `music:contexts:gacha-forge:${key}:take-1`, path: `music/contexts/gacha-forge/${key}/take-1.mp3` },
    { ...track, cue: "tender" },
    { ...track, connectionId: "conn-other" },
    { ...track, path: `music/contexts/otome-forge/${key}/../take-1.mp3` },
    { ...track, tag: `music:contexts:otome-forge:${key}:take-2` },
  ];
  for (const body of refused) {
    const result = await t.call("POST", "/runs/:run/audio/track", body);
    assert.deepEqual([result.status, result.body.code], [400, "bad-request"], JSON.stringify(body));
  }
  const otherRun = forgeSoundtrackContextKey(runIdOf("r-m2baud99-zzzzzz"), "conn-audio", "date");
  const elsewhere = await t.call("POST", "/runs/:run/audio/track", {
    ...track,
    tag: `music:contexts:otome-forge:${otherRun}:take-1`,
    path: `music/contexts/otome-forge/${otherRun}/take-1.mp3`,
  });
  assert.equal(elsewhere.status, 400, "another run's track");
  assert.equal((await t.world()).audio.tracks.length, 1);
});

test("the audio settings are bounded, keep the briefs and tracks, and never show the briefs", async () => {
  const t = await audioWorld("r-m2baud03-cccccc", [json({ prompt: "Harp and rain." })]);
  await t.call("POST", "/runs/:run/audio/settings", { audio: { generate: true } });
  await t.call("POST", "/runs/:run/audio/brief", { cue: "home" });
  const saved = await t.call("POST", "/runs/:run/audio/settings", {
    audio: {
      tts: true,
      otherVoices: "yes",
      musicVolume: 7,
      dialogueVolume: -1,
      audioConnectionId: " conn-audio ",
      apiKey: "x",
    },
  });
  assert.equal(saved.status, 200);
  const { audio } = saved.body;
  assert.equal(audio.tts, true);
  assert.equal(audio.otherVoices, false);
  assert.equal(audio.generate, true, "settings not sent stay as they were");
  assert.deepEqual([audio.musicVolume, audio.dialogueVolume], [1, 0]);
  assert.equal(audio.audioConnectionId, "conn-audio");
  assert.equal(audio.briefs, undefined);
  assert.equal(audio.apiKey, undefined);
  assert.deepEqual(audio.tracks, []);
  assert.equal((await t.world()).audio.briefs.home?.prompt, "Harp and rain.");
  assert.equal((await t.call("POST", "/runs/:run/audio/settings", { audio: "loud" })).status, 400);
});

test("an uploaded music folder is saved without generation and survives unrelated audio saves", async () => {
  assert.equal(normalizeOtomeAudio(undefined).musicFolder, "");
  const t = await audioWorld("r-foldermusic1-dddddd");
  const saved = await t.call("POST", "/runs/:run/audio/settings", {
    audio: { generate: false, musicFolder: "music/My uploaded songs/Romance" },
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.audio.musicFolder, "music/My uploaded songs/Romance");
  assert.equal((await t.world()).audio.musicFolder, "music/My uploaded songs/Romance");
  const next = await t.call("POST", "/runs/:run/audio/settings", { audio: { muted: true } });
  assert.equal(next.body.audio.musicFolder, "music/My uploaded songs/Romance");
  assert.equal(t.calls.length, 0, "saving uploaded music never asks a model for a brief or track");
  for (const invalid of [
    null,
    true,
    "/music/songs",
    "music/../private",
    "music//songs",
    "music/songs\\other",
    "sfx/ui",
    "music/line\nfeed",
  ]) {
    assert.equal(normalizeOtomeAudio({ musicFolder: invalid }).musicFolder, "");
  }
});

test("music folder identifiers are bounded through saved worlds, settings and manifest selection", async () => {
  const oversized = `music/${"a".repeat(2000)}`;
  assert.equal(normalizeOtomeAudio({ musicFolder: oversized }).musicFolder, "");
  const limit = `music/${"a".repeat(994)}`;
  const overflow = `${limit}a`;
  const nested = "music/My uploaded songs/Romance";
  assert.equal(limit.length, 1000);
  assert.equal(overflow.length, 1001);
  const t = await audioWorld("r-folderbound-eeeeee");
  for (const [musicFolder, expected] of [
    [limit, limit],
    [overflow, ""],
    [oversized, ""],
    [nested, nested],
  ]) {
    assert.equal(normalizeOtomeAudio({ musicFolder }).musicFolder, expected);
    assert.equal(normalizeWorldAudio({ musicFolder }).musicFolder, expected);
    assert.equal(normalizeWorld({ audio: { musicFolder } }).audio.musicFolder, expected);
    const saved = await t.call("POST", "/runs/:run/audio/settings", { audio: { musicFolder } });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.audio.musicFolder, expected);
    assert.equal((await t.world()).audio.musicFolder, expected);
  }
  assert.equal(t.calls.length, 0, "normalizing a folder never generates a brief or track");
  const entry = (path: string) => [path.replace(/\.[^.]+$/u, "").replaceAll("/", ":"), { path }];
  const valid = entry(`${nested}/song.mp3`);
  const assets = Object.fromEntries([valid, entry(`${overflow}/song.mp3`), entry(`${oversized}/song.mp3`)]);
  assert.deepEqual(musicAssetsInFolder(assets, "music"), Object.fromEntries([valid]));
  assert.deepEqual(musicAssetsInFolder(assets, overflow), {});
  assert.deepEqual(musicAssetFolders(assets), ["music", "music/My uploaded songs", nested]);
});

test("music folders contain only manifest-listed audio under that exact folder or its descendants", () => {
  const entry = (path: string) => [path.replace(/\.[^.]+$/u, "").replaceAll("/", ":"), { path }];
  const assets = Object.fromEntries([
    entry("music/My songs/Polskie/miłość.MP3"),
    entry("music/My songs/piano.ogg"),
    entry("music/My songs elsewhere/other.wav"),
    entry("sfx/ui/tap.wav"),
    entry("music/My songs/cover.png"),
    entry("music/My songs/../private.mp3"),
    entry("music/My songs/line\nfeed.mp3"),
    ["music:malformed", { path: "music/My songs/spoof.mp3" }],
    ["music:bad-entry", null],
  ]);
  assert.deepEqual(
    musicAssetFolders(assets),
    ["music", "music/My songs", "music/My songs elsewhere", "music/My songs/Polskie"].sort((a, b) =>
      a.localeCompare(b),
    ),
  );
  const picked = musicAssetsInFolder(assets, "music/My songs");
  assert.deepEqual(
    Object.values(picked)
      .map((value) => value.path)
      .sort(),
    ["music/My songs/Polskie/miłość.MP3", "music/My songs/piano.ogg"].sort(),
  );
  assert.deepEqual(musicAssetsInFolder(assets, "music/My songs/Polskie"), {
    "music:My songs:Polskie:miłość": { path: "music/My songs/Polskie/miłość.MP3" },
  });
  assert.deepEqual(musicAssetsInFolder(assets, "music/deleted"), {});
  assert.deepEqual(musicAssetFolders(null), []);
  assert.deepEqual(musicAssetsInFolder(assets, "music/.."), {});
});

test("voices: a card's own Engine voice, the pool for an archetype love interest, the persona's voice, NPCs only on request", async () => {
  const config = {
    connectionId: "tts-1",
    connectionProfiles: {
      "tts-1": {
        voiceAssignments: [
          { characterId: "card-kai", voice: "kai-voice" },
          { characterId: "card-mireille", voice: "mireille-card-voice" },
          { characterId: "persona-ines", voice: "ines-voice" },
        ],
        npcDefaultMaleVoices: ["m1", "m2", "m3"],
        npcDefaultFemaleVoices: ["f1", "f2"],
      },
    },
  };
  const lis: RunLiView[] = [
    {
      id: KAI,
      name: "Kai",
      pronouns: HE,
      source: "card",
      cardId: "card-kai",
      voiceGender: "",
      accent: "#E7A6B8",
      level: 1,
      stage: 1,
    },
    {
      id: MIR,
      name: "Mireille",
      pronouns: SHE,
      source: "archetype",
      voiceGender: "",
      accent: "#E7A6B8",
      level: 1,
      stage: 1,
    },
  ];
  const player = { name: "Ines", personaId: "persona-ines" };
  const listVoices = async () => ["any-1"];
  const settings = { tts: true, otherVoices: false, muted: false, dialogueVolume: 1 } as Parameters<
    typeof wouldVoice
  >[0];
  const voice = async (speaker: string, text = "A line.", extra: Record<string, unknown> = {}) => {
    const who = lineSpeaker({ speaker, text, ...extra }, lis, player);
    if (!wouldVoice(settings, who)) return null;
    return forgeSpeakerVoice(config, who, who.cast || settings.otherVoices, listVoices);
  };

  assert.equal(await voice("Kai"), "kai-voice", "his card's Engine voice");
  const mireille = await voice("Mireille");
  assert.ok(["f1", "f2"].includes(mireille!), "an archetype love interest gets the pool for her voice");
  assert.equal(await voice("Mireille"), mireille, "and always the same one");
  lis[1]!.cardId = "card-mireille";
  assert.equal(
    await voice("Mireille"),
    "mireille-card-voice",
    "a linked generated love interest uses the selected card",
  );
  assert.equal(lis[1]!.source, "archetype", "linking retains the love interest's creation source");
  delete lis[1]!.cardId;
  assert.equal(await voice("Mireille"), mireille, "unlinking restores the same generated voice fallback");
  assert.equal(await voice("Ines"), "ines-voice", "the protagonist uses her persona's voice");
  assert.equal(await voice("you"), "ines-voice");
  assert.equal(
    await voice("The Harbour Master", "Move along.", { gender: "male" }),
    null,
    "NPCs wait for 'voice others'",
  );
  settings.otherVoices = true;
  assert.ok(["m1", "m2", "m3"].includes((await voice("The Harbour Master", "Move along.", { gender: "male" }))!));
  assert.equal(await voice(""), null, "narration is never voiced");
  assert.equal(await voice("Kai", "...don't leave again.", { thought: true }), null, "nor a thought");
  settings.tts = false;
  assert.equal(await voice("Kai"), null, "voices off: nothing is spoken");
});
