import { basename } from "node:path";
import type { NoodlerPostMediaUpload } from "./slurp-media.js";
import { NOODLER_MEDIA_PREFIX, resolveNoodlerMediaAbsolutePath, unlinkNoodlerMedia } from "./slurp-media.js";
import { stageImageToDisk } from "../image/image-generation.js";

const NOODLER_AVATAR_URL_PREFIX = "/api/slurp/noodler/accounts/";

function noodlerAccountMediaUrl(accountId: string, kind: "avatar" | "banner", mediaPath: string): string {
  return `${NOODLER_AVATAR_URL_PREFIX}${encodeURIComponent(accountId)}/${kind}/${encodeURIComponent(basename(mediaPath))}`;
}

export function noodlerAvatarUrl(accountId: string, mediaPath: string): string {
  return noodlerAccountMediaUrl(accountId, "avatar", mediaPath);
}

export function noodlerBannerUrl(accountId: string, mediaPath: string): string {
  return noodlerAccountMediaUrl(accountId, "banner", mediaPath);
}

/**
 * Accepts either the avatar or the banner prefix: both files live in the same account media
 * folder, and early generated banners were stored under the avatar prefix.
 */
export function readNoodlerAccountMediaPath(accountId: string, url: string | null): string | null {
  if (!url) return null;
  const base = `${NOODLER_AVATAR_URL_PREFIX}${encodeURIComponent(accountId)}/`;
  const prefix = ["avatar/", "banner/"].map((kind) => `${base}${kind}`).find((candidate) => url.startsWith(candidate));
  if (!prefix) return null;
  const encodedName = url.slice(prefix.length);
  let fileName: string;
  try {
    fileName = decodeURIComponent(encodedName);
  } catch {
    return null;
  }
  if (!fileName || basename(fileName) !== fileName || /[\\/]/u.test(fileName)) return null;
  return `${NOODLER_MEDIA_PREFIX}${accountId}/${fileName}`;
}

export function readNoodlerAvatarMediaPath(accountId: string, avatarUrl: string | null): string | null {
  return readNoodlerAccountMediaPath(accountId, avatarUrl);
}

export function resolveNoodlerBannerAbsolutePath(accountId: string, bannerUrl: string | null): string | null {
  const mediaPath = readNoodlerAccountMediaPath(accountId, bannerUrl);
  return mediaPath ? resolveNoodlerMediaAbsolutePath(mediaPath) : null;
}

export function resolveNoodlerAvatarAbsolutePath(accountId: string, avatarUrl: string | null): string | null {
  const mediaPath = readNoodlerAvatarMediaPath(accountId, avatarUrl);
  return mediaPath ? resolveNoodlerMediaAbsolutePath(mediaPath) : null;
}

export function stageNoodlerAvatar(accountId: string, upload: NoodlerPostMediaUpload) {
  const staged = stageImageToDisk(
    `${NOODLER_MEDIA_PREFIX}${accountId}`,
    upload.buffer.toString("base64"),
    upload.extension,
  );
  return {
    avatarUrl: noodlerAvatarUrl(accountId, staged.filePath),
    promote: staged.promote,
    compensate: staged.compensate,
  };
}

export function stageNoodlerBanner(accountId: string, upload: NoodlerPostMediaUpload) {
  const staged = stageImageToDisk(
    `${NOODLER_MEDIA_PREFIX}${accountId}`,
    upload.buffer.toString("base64"),
    upload.extension,
  );
  return {
    bannerUrl: noodlerBannerUrl(accountId, staged.filePath),
    promote: staged.promote,
    compensate: staged.compensate,
  };
}

export function unlinkNoodlerAvatar(accountId: string, avatarUrl: string | null): void {
  unlinkNoodlerMedia(readNoodlerAvatarMediaPath(accountId, avatarUrl));
}

export function unlinkNoodlerBanner(accountId: string, bannerUrl: string | null): void {
  unlinkNoodlerMedia(readNoodlerAccountMediaPath(accountId, bannerUrl));
}
