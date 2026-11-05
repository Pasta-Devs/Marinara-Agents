// ──────────────────────────────────────────────
// Story Writer: URLs of the files the package ships
// ──────────────────────────────────────────────
import { STORY_WRITER_PACKAGE_ID } from "./model";

export const STORY_WRITER_ASSETS = {
  icon: "story-writer-icon.png",
  mari: "story-writer-mari.webp",
  wood: "wood-desk.webp",
  paperLight: "paper-light.webp",
  paperDark: "paper-dark.webp",
} as const;

export type StoryWriterAsset = (typeof STORY_WRITER_ASSETS)[keyof typeof STORY_WRITER_ASSETS];

/** The Engine serves package assets here; the version busts the browser cache after an update. */
export function storyWriterAssetUrl(file: StoryWriterAsset, packageVersion?: string | null): string {
  const url = `/api/capability-packages/${STORY_WRITER_PACKAGE_ID}/assets/${file}`;
  return packageVersion ? `${url}?v=${encodeURIComponent(packageVersion)}` : url;
}
