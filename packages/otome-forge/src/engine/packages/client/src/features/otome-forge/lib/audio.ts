// ──────────────────────────────────────────────
// Otome Forge: the pure half of music and voices. Which stock cue stands in for each story cue, who speaks a line (and
// whether anyone would voice it), and the keys a line's audio is cached and generated under.
// ──────────────────────────────────────────────
// hooks/use-otome-audio.ts plays them through the Engine's player and voice service; this file has no host access, so
// the regressions run it as it is.
import { forgeStoryPersona, type ForgeVoiceSpeaker } from "@forge-kit/voice-picking.mjs";
import type {
  AudioSettings,
  Player,
  Pronouns,
  RunLiView,
  Segment,
  SoundtrackTrack,
  WorldView,
} from "../shared/api-types";
import type { MusicMood } from "../shared/faces";
import { voiceOf } from "./reader-state";

/** The Engine's stock cues (lib/audio-service.ts AudioMusicCue) Otome falls back on. */
export type EngineMusicCue = "home" | "happy" | "bond" | "tense" | "sad";

/**
 * The stock cue for each story cue, while no generated track is ready (plan M2b): roughly one calm and one tense
 * track, from the Engine's own library.
 */
export const ENGINE_MUSIC_CUE: Record<MusicMood, EngineMusicCue> = {
  home: "home",
  date: "happy",
  tender: "bond",
  confession: "bond",
  tense: "tense",
  angst: "sad",
};

/** The package scope the Engine files Otome's generated music under (`music/contexts/otome-forge/...`). */
export const MUSIC_SCOPE = "otome-forge";
/** A generated cue's length. */
export const MUSIC_LENGTH_MS = 60_000;

/** The server's run id for a run key (S/ids.ts): the soundtrack's context key is made from it, on both sides. */
export const runIdOf = (runKey: string) => `otome-forge:${runKey}`;

/** A speaker as the kit's voice picker reads it, plus whether "voice everyone else" must be on to voice them. */
export interface LineSpeaker extends ForgeVoiceSpeaker {
  /** A love interest or the protagonist: voiced whenever voices are on. Anyone else needs "voice everyone else". */
  cast: boolean;
}

/** "male" or "female" from a love interest's pronouns, for the voice pool; "" when they say neither. */
export function pronounGender(pronouns: Pronouns | undefined): "male" | "female" | "" {
  const subject = pronouns?.subject?.trim().toLocaleLowerCase();
  return subject === "he" ? "male" : subject === "she" ? "female" : "";
}

/**
 * Who speaks a line, for the voice picker: a love interest (his Engine card's own voice when he has one, otherwise the
 * pool for his voice), the protagonist (her persona's voice, or silence), or anyone else (the pool for the line's
 * gender). Narration and thoughts are never voiced: null.
 */
export function lineSpeaker(
  segment: Segment,
  lis: readonly RunLiView[],
  player: Pick<Player, "name" | "personaId">,
): LineSpeaker | null {
  if (segment.thought || !segment.text.trim()) return null;
  const voice = voiceOf(segment, lis, player.name);
  if (voice.kind === "narration") return null;
  if (voice.kind === "protagonist") {
    return { name: player.name, characterId: player.personaId || null, persona: true, cast: true };
  }
  if (voice.kind === "li") {
    const li = voice.li;
    const gender = li.voiceGender || segment.gender || pronounGender(li.pronouns);
    return {
      name: li.name,
      characterId: li.source === "card" && li.cardId ? li.cardId : null,
      ...(gender ? { gender } : {}),
      cast: true,
    };
  }
  // "You", "me", or her first name where the cast could not settle it: her own voice, never the pool.
  const persona = forgeStoryPersona({ name: player.name, personaId: player.personaId }, voice.name);
  if (persona) return { name: persona.name, characterId: persona.characterId, persona: true, cast: true };
  return { name: voice.name, ...(segment.gender ? { gender: segment.gender } : {}), cast: false };
}

/** True when the settings would voice this speaker at all (the Engine may still have no voice for them). */
export function wouldVoice(settings: AudioSettings, speaker: LineSpeaker | null): speaker is LineSpeaker {
  if (!speaker || !settings.tts || settings.muted || settings.dialogueVolume <= 0) return false;
  return speaker.cast || settings.otherVoices;
}

/**
 * The Engine's voice cache key for a line: one per line of each version of a beat (the backlog's favourite ref), so a
 * rewritten beat never replays the old clip. The Engine adds the connection, voice and speaker to it.
 */
export const voiceCacheKey = (runKey: string, ref: string) => `otome-forge:${runKey}:${ref}`;

/**
 * The ref a Home tap line is voiced under (M3): his id and a hash of the line, since the Engine keys a clip by its ref,
 * voice and speaker but never its text, and a new stage's pack may put other words in the same place. `kind` names
 * the screen's lines (M5's Claw Machine voices its pack lines as "claw").
 */
export function tapLineRef(li: string, text: string, kind = "tap"): string {
  // FNV-1a, 32 bits: plenty for a love interest's few dozen lines.
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193);
  return `${kind}:${li}:${(hash >>> 0).toString(36)}`;
}

/** The tracks generated for this story (`world.audio.tracks`), as the server keeps them. */
export function worldTracks(world: WorldView): SoundtrackTrack[] {
  const tracks = world.audio?.tracks;
  return Array.isArray(tracks)
    ? tracks.filter(
        (track) =>
          !!track &&
          typeof track.cue === "string" &&
          typeof track.tag === "string" &&
          typeof track.path === "string" &&
          typeof track.connectionId === "string",
      )
    : [];
}
