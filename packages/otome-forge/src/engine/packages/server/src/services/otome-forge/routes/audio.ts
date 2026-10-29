// ──────────────────────────────────────────────
// Otome Forge: the audio routes (plan M2b "Music"): music briefs, generated tracks and the audio settings
// ──────────────────────────────────────────────
// POST /runs/:run/audio/brief {cue}                          → {prompt}; P14, once per cue (409 while music is off)
// POST /runs/:run/audio/track {cue, connectionId, tag, path} → {tracks}; a track the Engine generated for this run
// POST /runs/:run/audio/settings {audio}                     → {audio}; the settings with the tracks, never the briefs
// The client generates music itself (POST /api/audio/generate with scope `otome-forge` and the context key
// forgeSoundtrackContextKey(R, audioConnectionId, cue), R being `otome-forge:<run key>`), so no audio is paid for
// here; the brief is a text call, made only while the world's "generate music" setting is on.
import { normalizeOtomeAudio } from "../../../../../client/src/features/otome-forge/shared/audio.js";
import { z } from "zod";
import { MUSIC_MOODS } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import {
  audioView,
  chapterMusicBrief,
  createMusicBriefs,
  playableTracks,
  recordChapterTrack,
  recordTrack,
} from "../audio/music.js";
import { OtomeForgeError, debugModeOf, parseBody, runParam, type RegisterRoutes } from "../http.js";
import { isChapterKey, runDocTarget, worldId } from "../ids.js";
import { normalizeWorld } from "../schemas/world.js";

const ChapterKey = z.string().refine(isChapterKey);
const BriefBody = z.union([z.object({ cue: z.enum(MUSIC_MOODS) }), z.object({ chapterKey: ChapterKey })]);
const TrackBody = z.object({
  cue: z.string().max(80),
  chapterKey: ChapterKey.optional(),
  connectionId: z.string().min(1).max(200),
  tag: z.string().min(1).max(1000),
  path: z.string().min(1).max(1000),
});
/** Every field optional: the kit bounds and defaults each one (no credentials are ever kept). */
const SettingsBody = z.object({ audio: z.record(z.string(), z.unknown()) });

const runNotFound = () => new OtomeForgeError(404, "No such Otome Forge run.", "not-found");

export const registerAudioRoutes: RegisterRoutes = (router, deps) => {
  const { store, handle } = deps;
  const brief = createMusicBriefs(deps);

  router.post(
    "/runs/:run/audio/brief",
    handle(async (request) => {
      const body = parseBody(BriefBody, request.body);
      const { runId } = runParam(request);
      return {
        prompt:
          "chapterKey" in body
            ? await chapterMusicBrief(deps, runId, body.chapterKey, debugModeOf(request))
            : await brief(runId, body.cue, debugModeOf(request)),
      };
    }),
  );

  router.post(
    "/runs/:run/audio/track",
    handle(async (request) => {
      const { chapterKey, ...track } = parseBody(TrackBody, request.body);
      const { runId } = runParam(request);
      if (chapterKey) return { track: await recordChapterTrack(deps, runId, chapterKey, track) };
      const refused = () => new OtomeForgeError(400, "That track was not generated for this story.", "bad-request");
      const world = await store.updateDoc(runDocTarget("world", worldId(runId)), normalizeWorld, (current) => {
        const audio = recordTrack(current.audio, runId, track);
        if (!audio) throw refused();
        return { ...current, audio };
      });
      if (!world) throw runNotFound();
      return { tracks: playableTracks(world.audio) };
    }),
  );

  router.post(
    "/runs/:run/audio/settings",
    handle(async (request) => {
      const { audio } = parseBody(SettingsBody, request.body);
      const { runId } = runParam(request);
      const world = await store.updateDoc(runDocTarget("world", worldId(runId)), normalizeWorld, (current) => {
        const { briefs, tracks, ...settings } = current.audio;
        return { ...current, audio: { ...normalizeOtomeAudio({ ...settings, ...audio }), briefs, tracks } };
      });
      if (!world) throw runNotFound();
      return { audio: audioView(world.audio) };
    }),
  );
};
