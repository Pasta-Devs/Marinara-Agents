import { normalizeForgeAudio } from "@forge-kit/audio-settings.mjs";
import type { AudioSettings, SoundtrackTrack } from "./api-types";
import { MUSIC_MOODS } from "./faces";
import { isHapticsUrl } from "./haptics";

/** Otome's optional chapter themes, emotion cues and haptics leave the other games' audio settings unchanged. */
export function normalizeOtomeAudio(value: unknown): AudioSettings {
  const fields = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    ...normalizeForgeAudio(value),
    ...homeTheme(fields.homeCue, fields.homeTrack),
    haptics: fields.haptics === true,
    hapticsUrl: isHapticsUrl(fields.hapticsUrl) ? fields.hapticsUrl : "",
    chapterThemes: !!value && typeof value === "object" && "chapterThemes" in value && value.chapterThemes === true,
    emotionCues: !!value && typeof value === "object" && "emotionCues" in value && value.emotionCues === true,
    musicFolder:
      value && typeof value === "object" && "musicFolder" in value && isMusicFolder(value.musicFolder)
        ? value.musicFolder
        : "",
  };
}

/**
 * 0.44.0: Home's chosen row. A mood plays as Home's own music would (this world's track, or the Engine's); a chapter's
 * theme only with its own saved track. Anything else plays Home's own music.
 */
function homeTheme(cue: unknown, track: unknown): Pick<AudioSettings, "homeCue" | "homeTrack"> {
  if ((MUSIC_MOODS as readonly unknown[]).includes(cue)) return { homeCue: cue as string, homeTrack: null };
  if (typeof cue === "string" && cue.length <= 200 && cue.startsWith(chapterMusicCue("")) && isTrack(track, cue)) {
    const { connectionId, tag, path } = track;
    return { homeCue: cue, homeTrack: { cue, connectionId, tag, path } };
  }
  return { homeCue: "", homeTrack: null };
}

const isText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max && !/\p{Cc}/u.test(value);

function isTrack(value: unknown, cue: string): value is SoundtrackTrack {
  if (!value || typeof value !== "object") return false;
  const track = value as Record<string, unknown>;
  return (
    track.cue === cue &&
    isText(track.connectionId, 200) &&
    isText(track.tag, 1000) &&
    track.tag.startsWith("music:") &&
    isText(track.path, 1000)
  );
}

function isMusicFolder(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 1000 &&
    (value === "music" || value.startsWith("music/")) &&
    !/[\\\p{Cc}]/u.test(value) &&
    value.split("/").every((part) => part !== "" && part !== "." && part !== "..")
  );
}

/** Only server-listed Music files are playable; paths are never made from the saved folder. */
export function musicAssetsInFolder(assets: unknown, folder: string): Record<string, { path: string }> {
  if (!isMusicFolder(folder) || !assets || typeof assets !== "object" || Array.isArray(assets)) return {};
  const selected: Record<string, { path: string }> = {};
  for (const [tag, value] of Object.entries(assets)) {
    if (!value || typeof value !== "object" || !("path" in value) || typeof value.path !== "string") continue;
    const path = value.path;
    const parent = path.slice(0, path.lastIndexOf("/"));
    if (
      isMusicFolder(parent) &&
      !/[\\\p{Cc}]/u.test(path) &&
      path.startsWith(`${folder}/`) &&
      /\.(?:mp3|ogg|wav|flac|m4a|aac|webm)$/iu.test(path) &&
      tag === path.replace(/\.[^.]+$/u, "").replaceAll("/", ":")
    )
      selected[tag] = { path };
  }
  return selected;
}

/** Nonempty folders, including their ancestors, from the same manifest that Engine plays. */
export function musicAssetFolders(assets: unknown): string[] {
  const folders = new Set<string>();
  for (const { path } of Object.values(musicAssetsInFolder(assets, "music"))) {
    const parts = path.split("/");
    for (let length = 1; length < parts.length; length += 1) folders.add(parts.slice(0, length).join("/"));
  }
  return [...folders].sort((a, b) => a.localeCompare(b));
}

/** Chapter keys are validated by the server; even the longest remains within the existing cue/context limits. */
export const chapterMusicCue = (chapterKey: string) => `chapter-${chapterKey}`;
