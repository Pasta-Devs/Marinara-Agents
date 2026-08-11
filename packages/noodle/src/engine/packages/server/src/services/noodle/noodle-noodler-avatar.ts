import { basename } from "node:path";
import type { NoodlerPostMediaUpload } from "./noodle-noodler-media.js";
import {
  NOODLER_MEDIA_PREFIX,
  resolveNoodlerMediaAbsolutePath,
  unlinkNoodlerMedia,
} from "./noodle-noodler-media.js";
import { stageImageToDisk } from "../image/image-generation.js";

const NOODLER_AVATAR_URL_PREFIX = "/api/noodle/noodler/accounts/";

export function noodlerAvatarUrl(accountId: string, mediaPath: string): string {
  return `${NOODLER_AVATAR_URL_PREFIX}${encodeURIComponent(accountId)}/avatar/${encodeURIComponent(basename(mediaPath))}`;
}

export function readNoodlerAvatarMediaPath(accountId: string, avatarUrl: string | null): string | null {
  if (!avatarUrl) return null;
  const prefix = `${NOODLER_AVATAR_URL_PREFIX}${encodeURIComponent(accountId)}/avatar/`;
  if (!avatarUrl.startsWith(prefix)) return null;
  const encodedName = avatarUrl.slice(prefix.length);
  let fileName: string;
  try {
    fileName = decodeURIComponent(encodedName);
  } catch {
    return null;
  }
  if (!fileName || basename(fileName) !== fileName || /[\\/]/u.test(fileName)) return null;
  return `${NOODLER_MEDIA_PREFIX}${accountId}/${fileName}`;
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

export function unlinkNoodlerAvatar(accountId: string, avatarUrl: string | null): void {
  unlinkNoodlerMedia(readNoodlerAvatarMediaPath(accountId, avatarUrl));
}
