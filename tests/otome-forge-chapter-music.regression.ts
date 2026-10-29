import assert from "node:assert/strict";
import test from "node:test";
import { forgeSoundtrackContextKey } from "@forge-kit/audio-settings.mjs";
import {
  chapterMusicCue,
  normalizeOtomeAudio,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/audio.ts";
import {
  chapterId,
  runDocTarget,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { registerAudioRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/audio.ts";
import {
  normalizeBeat,
  normalizeChapter,
  toBeatView,
  toChapterView,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { routesOf, seedChapter } from "./fixtures/otome-forge-art.ts";
import { json, storyWorld } from "./fixtures/otome-forge-story.ts";

async function fixture(runKey: string, replies: Parameters<typeof storyWorld>[0]["replies"] = []) {
  const t = await storyWorld({ runKey, replies });
  await seedChapter(t.store, t.runId);
  const call = routesOf(registerAudioRoutes, t.deps, runKey);
  const settings = (audio: object) => call("POST", "/runs/:run/audio/settings", { audio });
  const brief = (chapterKey = "main-1") => call("POST", "/runs/:run/audio/brief", { chapterKey });
  const chapter = () => t.store.readDoc(chapterId(t.runId, "main-1"), normalizeChapter);
  return { ...t, call, settings, brief, chapter };
}

test("chapter themes default off, preserve the saved preference, and never pay while off, muted or silent", async () => {
  assert.equal(normalizeOtomeAudio(undefined).chapterThemes, false);
  assert.equal(normalizeOtomeAudio({ chapterThemes: "true" }).chapterThemes, false);
  const legacy = normalizeBeat({ key: "main-1", i: 0, segments: [{ speaker: "", text: "The harbour is quiet." }] });
  assert.ok(legacy);
  assert.equal(toBeatView(legacy).musicMood, "tender", "legacy stored beats supply a mood before chapter playback");
  const t = await fixture("r-chapmusic1-aaaaaa");
  for (const audio of [
    { generate: true, chapterThemes: false },
    { generate: false, chapterThemes: true },
    { generate: true, chapterThemes: true, muted: true },
    { generate: true, chapterThemes: true, muted: false, musicVolume: 0 },
  ]) {
    await t.settings(audio);
    assert.equal((await t.brief()).status, 409);
  }
  assert.equal(t.calls.length, 0);
  const saved = await t.settings({ musicVolume: 0.5 });
  assert.equal(saved.body.audio.chapterThemes, true, "unrelated settings preserve the preference");
  assert.equal((await t.brief("main-99")).status, 404);
  assert.equal((await t.brief("../main-1")).status, 400);
  assert.equal(t.calls.length, 0);
});

test("one concurrent chapter brief is persisted, uses public thematic context, and leaves hidden plans out", async () => {
  const t = await fixture("r-chapmusic2-bbbbbb", [
    json({ prompt: "Harbour bells answer a low cello motif, a seamless instrumental loop." }),
  ]);
  await t.settings({ generate: true, chapterThemes: true });
  const resolve = t.runtime.languageModels.resolveForRequest.bind(t.runtime.languageModels);
  t.runtime.languageModels.resolveForRequest = async (input) => ({ ...(await resolve(input)), maxOutputTokens: null });
  const chapter = (await t.chapter())!;
  await t.store.updateDoc(runDocTarget("chapter", chapterId(t.runId, chapter.key)), normalizeChapter, (current) =>
    current
      ? { ...current, nodes: current.nodes.map((node) => ({ ...node, guide: "HIDDEN-GUIDE: the culprit waits." })) }
      : current,
  );
  const [a, b] = await Promise.all([t.brief(), t.brief()]);
  assert.equal(a.status, 200);
  assert.equal(a.body.prompt, b.body.prompt);
  assert.equal(t.calls.length, 1);
  assert.equal((await t.brief()).body.prompt, a.body.prompt);
  assert.equal(t.calls.length, 1, "replay reuses the persisted chapter brief");
  const messages = JSON.stringify(t.calls[0]!.messages);
  assert.match(messages, /The Dark Quay/);
  assert.match(messages, /The lights fail/);
  assert.match(messages, /harbour/);
  assert.doesNotMatch(messages, /HIDDEN-|MYSTERY-TRUTH|north-light/);
  assert.ok((await t.chapter())!.music?.prompt);
  assert.equal(toChapterView((await t.chapter())!).music, undefined, "private brief never reaches the chapter view");
  assert.ok(t.logs.some((log) => log.level === "debugOverride"));
  assert.ok((t.calls[0]!.options?.maxTokens ?? 0) >= 8192, "the actual brief call retains the output floor");

  await t.store.updateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
    ...world,
    audio: { ...world.audio, briefs: {}, tracks: [] },
  }));
  assert.equal((await t.brief()).body.prompt, a.body.prompt, "global mood-cache changes cannot evict chapter music");
  assert.equal(t.calls.length, 1);
});

test("chapter tracks validate run, chapter and package ownership, keep the first track and survive normalized reads", async () => {
  const t = await fixture("r-chapmusic3-cccccc");
  const cue = chapterMusicCue("main-1");
  const context = forgeSoundtrackContextKey(t.runId, "conn-audio", cue);
  const track = {
    cue,
    connectionId: "conn-audio",
    tag: `music:contexts:otome-forge:${context}:take-1`,
    path: `music/contexts/otome-forge/${context}/take-1.mp3`,
  };
  const record = (value: object, chapterKey = "main-1") =>
    t.call("POST", "/runs/:run/audio/track", { chapterKey, ...value });
  for (const value of [
    { ...track, cue: chapterMusicCue("main-2") },
    { ...track, connectionId: "other" },
    { ...track, path: `music/contexts/otome-forge/${context}/../take-1.mp3` },
    { ...track, tag: track.tag.replace("otome-forge", "gacha-forge") },
  ])
    assert.equal((await record(value)).status, 400);
  assert.equal((await record(track, "main-99")).status, 400, "a different chapter owns a different context");
  const kept = await record(track);
  assert.equal(kept.status, 200);
  assert.deepEqual(kept.body.track, track);
  const next = { ...track, tag: track.tag.replace("take-1", "take-2"), path: track.path.replace("take-1", "take-2") };
  assert.deepEqual((await record(next)).body.track, track, "replay never replaces the saved theme");
  assert.deepEqual(toChapterView((await t.chapter())!).music?.track, track);
  const world = (await t.store.readDoc(worldId(t.runId), normalizeWorld))!;
  assert.deepEqual(world.audio.tracks, [], "chapter tracks do not enter the bounded global mood cache");
});
