// ──────────────────────────────────────────────
// Otome Forge: music briefs (P14) and the generated soundtrack (plan M2b "Music")
// ──────────────────────────────────────────────
// P14 is the kit's forgeMusicBriefMessages with Otome's six cue scenes (SH/cues.ts) and medium "romance visual novel",
// in English. It is written from the world's premise and setting only: never the mystery's truth, nobody's bible and
// no story, so it needs neither the content contract nor the knowledge boundary. The kit's service keeps one brief per
// cue in world.audio.briefs, keyed by its messages' fingerprint (a changed premise writes a new one), and joins
// requests for the same cue into one model call. Briefs are written only while the world generates music.
// The client generates the track itself (POST /api/audio/generate, scope `otome-forge`) and reports it; recordTrack
// keeps it only when its tag and path are the ones the Engine files under this run's context key, which the kit's
// recordForgeSoundtrack checks (so a track another package or run filed is refused).
import {
  createForgeMusicPromptService,
  forgeMusicBriefMessages,
  normalizeForgeMusicPrompt,
} from "@forge-kit/audio-prompts.mjs";
import { availableForgeSoundtracks, recordForgeSoundtrack } from "@forge-kit/audio-settings.mjs";
import { z } from "zod";
import type {
  SoundtrackTrack,
  World,
  WorldAudio,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { MUSIC_MEDIUM, MUSIC_SCENES } from "../../../../../client/src/features/otome-forge/shared/cues.js";
import { MUSIC_MOODS, type MusicMood } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import { generateJson, type GenerationDeps } from "../generation.js";
import { OtomeForgeError } from "../http.js";
import { OTOME_FORGE_PACKAGE_ID, runDocTarget, worldId } from "../ids.js";
import { keepNewest } from "../schemas/state.js";
import { TRACKS_MAX, normalizeWorld } from "../schemas/world.js";
import type { OtomeStore } from "../store.js";

const BRIEF_TOKENS = 600;

const BriefSchema = z.object({ prompt: z.string() });

export interface MusicDeps extends GenerationDeps {
  store: OtomeStore;
}

/** What the brief describes: the premise, then the setting the world plan wrote. */
export const musicScenario = (world: Pick<World, "premise" | "setting">) =>
  [world.premise.trim(), world.setting.trim()].filter(Boolean).join("\n\n");

/** P14: the brief messages for one cue. */
export function musicBriefMessages(world: Pick<World, "premise" | "setting">, cue: MusicMood) {
  return forgeMusicBriefMessages({ scenario: musicScenario(world) }, cue, null, {
    scenes: MUSIC_SCENES,
    medium: MUSIC_MEDIUM,
  });
}

const worldTarget = (runId: string) => runDocTarget("world", worldId(runId));

/** POST .../audio/brief: the cue's brief, written once (one model call per cue and premise) and then kept. */
export function createMusicBriefs(deps: MusicDeps) {
  const brief = createForgeMusicPromptService({
    async readWorld(runId) {
      const world = await deps.store.readDoc(worldId(runId), normalizeWorld);
      return world ? { scenario: musicScenario(world) } : null;
    },
    async readSession(runId) {
      const world = await deps.store.readDoc(worldId(runId), normalizeWorld);
      return world ? { audioPrompts: world.audio.briefs } : null;
    },
    updateSession: (runId, change) =>
      deps.store.updateDoc(worldTarget(runId), normalizeWorld, (current) => {
        const session = { audioPrompts: { ...current.audio.briefs } };
        change(session);
        return { ...current, audio: { ...current.audio, briefs: session.audioPrompts ?? {} } };
      }),
    async generate({ runId, messages, debugMode }) {
      const { value } = await generateJson(deps, {
        runId,
        job: "structured",
        label: "music-brief",
        messages,
        schema: BriefSchema,
        normalize: (reply) =>
          normalizeForgeMusicPrompt(reply) ?? "prompt must be one non-empty string of at most 1000 characters",
        temperature: 0.7,
        maxTokens: BRIEF_TOKENS,
        debugMode,
        lane: "foreground",
      });
      return { ok: true, value };
    },
    scenes: MUSIC_SCENES,
    medium: MUSIC_MEDIUM,
  });

  return async (runId: string, cue: MusicMood, debugMode: boolean): Promise<string> => {
    const world = await deps.store.readDoc(worldId(runId), normalizeWorld);
    if (!world) throw new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
    // No music is generated, so no brief is paid for.
    if (!world.audio.generate) throw new OtomeForgeError(409, "This world does not generate music.", "conflict");
    const result = await brief({ runId, cue, debugMode });
    if (result.ok) return result.prompt;
    switch (result.error) {
      case "bad-request":
        throw new OtomeForgeError(400, `No music cue ${cue}.`, "bad-request");
      case "not-found":
        throw new OtomeForgeError(404, "This world has no premise to write music for.", "not-found");
      case "generation-failed":
        throw new OtomeForgeError(502, "The music brief did not match the format.", "bad-format");
      default:
        throw new OtomeForgeError(409, "The world changed while its music brief was written.", "conflict");
    }
  };
}

/** The kit's view of the world's tracks (its `session`). */
const soundtrackOf = (audio: Pick<WorldAudio, "tracks">) => ({ audioTracks: [...audio.tracks] });

/** The tracks the client may play: each one's cue is one of Otome's six. */
export const playableTracks = (audio: Pick<WorldAudio, "tracks">): SoundtrackTrack[] =>
  availableForgeSoundtracks(soundtrackOf(audio), { cues: MUSIC_MOODS }).map(({ cue, connectionId, tag, path }) => ({
    cue,
    connectionId,
    tag,
    path,
  }));

/**
 * The world's audio with `track` kept (the same tag replaced), or null when the track is not one the Engine filed for
 * this run under scope `otome-forge` and one of the six cues.
 */
export function recordTrack(audio: WorldAudio, runId: string, track: SoundtrackTrack): WorldAudio | null {
  const soundtrack = soundtrackOf(audio);
  if (!recordForgeSoundtrack(soundtrack, runId, track, { scope: OTOME_FORGE_PACKAGE_ID, cues: MUSIC_MOODS })) {
    return null;
  }
  return { ...audio, tracks: keepNewest(soundtrack.audioTracks, TRACKS_MAX) };
}

/** The world's audio as the client sees it: the settings and the tracks, without the briefs. */
export function audioView(audio: WorldAudio): Omit<WorldAudio, "briefs"> {
  const { briefs: _briefs, ...rest } = audio;
  return { ...rest, tracks: playableTracks(audio) };
}
