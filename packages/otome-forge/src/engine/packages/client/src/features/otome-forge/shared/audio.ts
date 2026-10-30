import { normalizeForgeAudio } from "@forge-kit/audio-settings.mjs";
import type { AudioSettings } from "./api-types";

/** Otome's optional chapter themes leave the other games' audio settings unchanged. */
export function normalizeOtomeAudio(value: unknown): AudioSettings {
  return {
    ...normalizeForgeAudio(value),
    chapterThemes: !!value && typeof value === "object" && "chapterThemes" in value && value.chapterThemes === true,
  };
}

/** Chapter keys are validated by the server; even the longest remains within the existing cue/context limits. */
export const chapterMusicCue = (chapterKey: string) => `chapter-${chapterKey}`;
