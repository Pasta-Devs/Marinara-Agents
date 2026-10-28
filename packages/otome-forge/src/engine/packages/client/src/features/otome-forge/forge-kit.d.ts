// Types for the forge-kit modules the client imports as `@forge-kit/<module>.mjs` (the server's own are in
// S/forge-kit.d.ts; the client's strict typecheck reads only client files). Only the surface the client uses.

declare module "@forge-kit/story-expressions.mjs" {
  /**
   * The plate's character for one line: with the line's face (one of `names`) painted, a copy whose `art` is that
   * face and whose `neutral` is the plain portrait; otherwise `character` unchanged.
   */
  export function forgeStoryExpressionArt<C extends { art?: string; expressions?: Record<string, unknown> }>(
    character: C,
    segment: { expression?: string } | null | undefined,
    names?: readonly string[],
  ): C & { neutral?: string };
}

declare module "@forge-kit/audio-settings.mjs" {
  /** Bounded audio settings: every field present, volumes 0–1 (forge-kit audio-settings.mjs). */
  export function normalizeForgeAudio(value: unknown): {
    tts: boolean;
    otherVoices: boolean;
    combatVoices: boolean;
    generate: boolean;
    homeMusic: string;
    audioConnectionId: string;
    muted: boolean;
    musicVolume: number;
    dialogueVolume: number;
    sfxVolume: number;
    autoplayPauseSeconds: number;
  };
  /** The context key the Engine files a generated track under: `world-<hash>-<cue>`. */
  export function forgeSoundtrackContextKey(runId: string, connectionId: string, cue: string): string;
}

declare module "@forge-kit/voice-picking.mjs" {
  /** Who is speaking, as the voice picker reads it. */
  export interface ForgeVoiceSpeaker {
    characterId?: string | null;
    name: string;
    gender?: string;
    /** The protagonist: her persona's own voice, or silence (never the pool). */
    persona?: boolean;
  }
  /**
   * The voice for a speaker: an explicit Engine assignment wins; with `others`, everyone but the persona gets the
   * Engine's NPC pool voice for their gender (stable by name), or any voice of the connection while that pool is empty.
   */
  export function forgeSpeakerVoice(
    config: unknown,
    speaker: ForgeVoiceSpeaker,
    others: boolean,
    listVoices: (config: unknown) => Promise<string[]>,
  ): Promise<string | null>;
  /** The persona when a speaker the cast cannot settle names the protagonist ("you", her first name), else null. */
  export function forgeStoryPersona(
    protagonist: { name?: string; personaId?: string } | null | undefined,
    speaker: string,
  ): { name: string; characterId: string | null; prota: true } | null;
}
