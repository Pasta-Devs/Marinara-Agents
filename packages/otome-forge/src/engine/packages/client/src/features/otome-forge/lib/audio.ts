// ──────────────────────────────────────────────
// Otome Forge: the pure half of music and voices. Which stock cue stands in for each story cue, who speaks a line (and
// whether anyone would voice it), and the keys a line's audio is cached and generated under.
// ──────────────────────────────────────────────
// hooks/use-otome-audio.ts plays them through the Engine's player and voice service; this file has no host access, so
// the regressions run it as it is.
import { forgeSpeakerVoice, forgeStoryPersona, type ForgeVoiceSpeaker } from "@forge-kit/voice-picking.mjs";
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
      characterId: li.cardId || null,
      ...(gender ? { gender } : {}),
      cast: true,
    };
  }
  // "You", "me", or her first name where the cast could not settle it: her own voice, never the pool.
  const persona = forgeStoryPersona({ name: player.name, personaId: player.personaId }, voice.name);
  if (persona) return { name: persona.name, characterId: persona.characterId, persona: true, cast: true };
  return { name: voice.name, ...(segment.gender ? { gender: segment.gender } : {}), cast: false };
}

// The Engine's speaker-name normalizers (packages/client/src/lib/tts-dialogue.ts normalizeTTSCharacterName and
// normalizeTTSCharacterBaseName), which the host contract does not expose to packages.
const ttsName = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
function ttsBaseName(value: unknown): string {
  let name = ttsName(value);
  let previous = "";
  while (name && name !== previous) {
    previous = name;
    name = name
      .replace(/^[`*"'“”‘’]+|[`*"'“”‘’:]+$/g, "")
      .replace(/\s*(?:\([^()]*\)|\[[^\]]*\]|\{[^{}]*})\s*$/g, "")
      .trim();
  }
  return name.match(/^(.+?)\s+(?:[-–—:|])\s+[^-–—:|]+$/)?.[1]?.trim() || name;
}

/**
 * The voice an Engine voice row gives a speaker by name, as the Engine's resolveTTSVoiceForSpeaker does for one with no
 * card of its own: the row with the same name, else the rows with the same base name ("Pulcinella (Fatui)") when they
 * all name one voice. Rows are read from the same place the kit reads them (the connection's profile, or the config).
 * ponytail: no short-form match ("Junpei" for a card called "Junpei Iori", Engine #8638); move this into the kit's
 * forgeSpeakerVoice (and rebuild Gacha Forge) or use the Engine's resolver once the host contract exposes it.
 */
export function namedVoice(config: unknown, name: string): string | null {
  const settings = config as {
    enabled?: boolean;
    connectionId?: string;
    voiceAssignments?: unknown;
    connectionProfiles?: Record<string, { voiceAssignments?: unknown } | undefined>;
  } | null;
  if (!settings || (!settings.connectionId && settings.enabled === false)) return null;
  const assignments = settings.connectionId
    ? settings.connectionProfiles?.[settings.connectionId]?.voiceAssignments
    : settings.voiceAssignments;
  const rows = (Array.isArray(assignments) ? assignments : []).flatMap((row) =>
    row && typeof row.voice === "string" && row.voice.trim() && typeof row.characterName === "string"
      ? [{ name: row.characterName, voice: row.voice.trim() }]
      : [],
  );
  const exact = ttsName(name);
  const same = exact ? rows.find((row) => ttsName(row.name) === exact) : undefined;
  if (same) return same.voice;
  const base = ttsBaseName(name);
  const voices = new Set(base ? rows.filter((row) => ttsBaseName(row.name) === base).map((row) => row.voice) : []);
  return voices.size === 1 ? [...voices][0]! : null;
}

/**
 * The voice that reads a speaker's line: the kit's pick (a card's own row, the protagonist's persona, the NPC pool),
 * except that someone outside the cast with no card first takes the voice the Engine assigned to their name.
 */
export async function lineVoice(
  config: unknown,
  speaker: LineSpeaker,
  others: boolean,
  listVoices: (config: unknown) => Promise<string[]>,
): Promise<string | null> {
  const named = !speaker.cast && !speaker.characterId ? namedVoice(config, speaker.name) : null;
  return named ?? forgeSpeakerVoice(config, speaker, others, listVoices);
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

/** A line as the Engine voices it: playing it and making it ahead send the same, so the clip made ahead is the one played. */
export interface LineVoiceRequest {
  text: string;
  speaker: string;
  voice: string;
  characterId?: string;
  cacheKey?: string;
}

/**
 * What a line is voiced with. 0.34.0: with Emotion cues on, the line as written, cues and all, kept apart from the
 * plain clip. `cache` false voices it with no cache key.
 */
export function lineVoiceRequest(
  runKey: string,
  ref: string,
  segment: Segment,
  speaker: LineSpeaker,
  voice: string,
  settings: Pick<AudioSettings, "emotionCues">,
  cache = true,
): LineVoiceRequest {
  const voiced = settings.emotionCues ? segment.voiced : undefined;
  return {
    text: voiced ?? segment.text,
    speaker: segment.speaker,
    voice,
    ...(speaker.characterId ? { characterId: speaker.characterId } : {}),
    ...(cache ? { cacheKey: voiceCacheKey(runKey, voiced ? `${ref}~cues` : ref) } : {}),
  };
}

/** A line whose voice may be made ahead, with its ref (lib/reader-state.ts lineRef). */
export interface PrepLine {
  segment: Segment;
  ref: string;
}

/**
 * Makes lines' voices ahead, one at a time and in order, so each plays as its text appears. The newest list replaces
 * the lines still waiting, and a line is asked for once. A failure stops it until `reset` (the voice settings
 * changed), so the lines are then voiced as they appear, as before; a stopped wait (AbortError) is no failure, and
 * neither is one from a line asked for before the last reset.
 */
export class VoicePrep {
  private waiting: PrepLine[] = [];
  private readonly asked = new Set<string>();
  private running = false;
  private failed = false;
  /** Counts resets, so a line asked for before one cannot stop the lines after it. */
  private settings = 0;

  constructor(
    private readonly make: (line: PrepLine) => Promise<void>,
    private readonly key: (line: PrepLine) => string,
  ) {}

  set(lines: readonly PrepLine[]) {
    this.waiting = this.failed ? [] : lines.filter((line) => !this.asked.has(this.key(line)));
    if (!this.running) void this.run();
  }

  reset() {
    this.waiting = [];
    this.asked.clear();
    this.failed = false;
    this.settings += 1;
  }

  private async run() {
    this.running = true;
    try {
      for (let line = this.waiting.shift(); line; line = this.waiting.shift()) {
        const key = this.key(line);
        if (this.asked.has(key)) continue;
        this.asked.add(key);
        const settings = this.settings;
        try {
          await this.make(line);
        } catch (error) {
          if ((error as { name?: string })?.name === "AbortError" || settings !== this.settings) continue;
          console.warn("Otome Hearth could not voice a line ahead", error);
          this.failed = true;
          this.waiting = [];
        }
      }
    } finally {
      this.running = false;
    }
  }
}

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
