import { basename } from "node:path";
import type { SlpCreatorPostMediaUpload } from "../media/slp-media.js";
import { NOODLER_MEDIA_PREFIX, resolveCreatorMediaAbsolutePath, unlinkCreatorMedia } from "../media/slp-media.js";
import { stageImageToDisk } from "../../../services/image/image-generation.js";

const NOODLER_AVATAR_URL_PREFIX = "/api/slurp2/noodler/accounts/";

function slpCreatorAccountMediaUrl(accountId: string, kind: "avatar" | "banner", mediaPath: string): string {
  return `${NOODLER_AVATAR_URL_PREFIX}${encodeURIComponent(accountId)}/${kind}/${encodeURIComponent(basename(mediaPath))}`;
}

export function slpCreatorAvatarUrl(accountId: string, mediaPath: string): string {
  return slpCreatorAccountMediaUrl(accountId, "avatar", mediaPath);
}

export function slpCreatorBannerUrl(accountId: string, mediaPath: string): string {
  return slpCreatorAccountMediaUrl(accountId, "banner", mediaPath);
}

/**
 * Accepts either the avatar or the banner prefix: both files live in the same account media
 * folder, and early generated banners were stored under the avatar prefix.
 */
export function readCreatorAccountMediaPath(accountId: string, url: string | null): string | null {
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

export function readCreatorAvatarMediaPath(accountId: string, avatarUrl: string | null): string | null {
  return readCreatorAccountMediaPath(accountId, avatarUrl);
}

export function resolveCreatorBannerAbsolutePath(accountId: string, bannerUrl: string | null): string | null {
  const mediaPath = readCreatorAccountMediaPath(accountId, bannerUrl);
  return mediaPath ? resolveCreatorMediaAbsolutePath(mediaPath) : null;
}

export function resolveCreatorAvatarAbsolutePath(accountId: string, avatarUrl: string | null): string | null {
  const mediaPath = readCreatorAvatarMediaPath(accountId, avatarUrl);
  return mediaPath ? resolveCreatorMediaAbsolutePath(mediaPath) : null;
}

export function stageCreatorAvatar(accountId: string, upload: SlpCreatorPostMediaUpload) {
  const staged = stageImageToDisk(
    `${NOODLER_MEDIA_PREFIX}${accountId}`,
    upload.buffer.toString("base64"),
    upload.extension,
  );
  return {
    avatarUrl: slpCreatorAvatarUrl(accountId, staged.filePath),
    promote: staged.promote,
    compensate: staged.compensate,
  };
}

export function stageCreatorBanner(accountId: string, upload: SlpCreatorPostMediaUpload) {
  const staged = stageImageToDisk(
    `${NOODLER_MEDIA_PREFIX}${accountId}`,
    upload.buffer.toString("base64"),
    upload.extension,
  );
  return {
    bannerUrl: slpCreatorBannerUrl(accountId, staged.filePath),
    promote: staged.promote,
    compensate: staged.compensate,
  };
}

export function unlinkCreatorAvatar(accountId: string, avatarUrl: string | null): void {
  unlinkCreatorMedia(readCreatorAvatarMediaPath(accountId, avatarUrl));
}

export function unlinkCreatorBanner(accountId: string, bannerUrl: string | null): void {
  unlinkCreatorMedia(readCreatorAccountMediaPath(accountId, bannerUrl));
}
