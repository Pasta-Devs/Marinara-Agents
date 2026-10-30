import { normalizeForgeAudio } from "@forge-kit/audio-settings.mjs";
import type { AudioSettings } from "./api-types";

/** Otome's optional chapter themes leave the other games' audio settings unchanged. */
export function normalizeOtomeAudio(value: unknown): AudioSettings {
  return {
    ...normalizeForgeAudio(value),
    chapterThemes: !!value && typeof value === "object" && "chapterThemes" in value && value.chapterThemes === true,
    musicFolder:
      value && typeof value === "object" && "musicFolder" in value && isMusicFolder(value.musicFolder)
        ? value.musicFolder
        : "",
  };
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
