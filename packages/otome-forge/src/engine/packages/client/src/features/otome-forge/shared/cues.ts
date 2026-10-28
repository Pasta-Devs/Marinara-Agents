// ──────────────────────────────────────────────
// Otome Forge: the six soundtrack cues a beat may ask for, as the music brief (P14) describes each one
// ──────────────────────────────────────────────
// Pure TypeScript shared by both bundles. The cue names live in SH/faces.ts (MUSIC_MOODS); the stock track standing in
// for each cue is the client's (lib/audio.ts ENGINE_MUSIC_CUE). Each scene text goes into the kit's
// forgeMusicBriefMessages as `soundtrackContext`: English prompt text, never localized, and it assumes no one's gender
// (a love interest may be anyone). The client labels cues through its own literal map of ui.otomeForge.* keys.
import type { MusicMood } from "./faces";

/** What kind of soundtrack the brief is written for (the kit's `medium`). */
export const MUSIC_MEDIUM = "romance visual novel";

/** P14's scene for each cue: the moment the 60-second loop has to carry under dialogue. */
export const MUSIC_SCENES: Record<MusicMood, string> = {
  home: "a quiet everyday moment at home with someone you are falling for, unhurried and warm",
  date: "a light, playful date between two people still learning each other",
  tender: "a tender, intimate scene where closeness costs both of them something",
  tense: "a suspenseful scene of mistrust, danger or a secret close to the surface",
  angst: "an aching scene of hurt and distance, with everything important left unsaid",
  confession: "a breathless confession, a feeling finally spoken aloud",
};
