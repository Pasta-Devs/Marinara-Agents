// Host overlay for services/image/gallery-file-lifecycle.ts (Pasta-Devs/Marinara-Agents#1487). Only the pure
// path helpers stay: the gallery file locks are the Engine's, and package code that writes gallery rows goes
// through api.runtime.integrations.images instead of taking a second set of locks.
import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { DATA_DIR } from "../../utils/data-dir.js";
import { assertInsideDir } from "../../utils/security.js";

export type StoredGalleryFile = {
  absolutePath: string;
  directory: string;
  filename: string;
};

function normalizedGalleryPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

/** Decode one URL path segment while rejecting separators and traversal names. */
export function decodeSafePathSegment(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const decoded = decodeURIComponent(value);
    return decoded &&
      !decoded.includes("/") &&
      !decoded.includes("\\") &&
      !decoded.includes("\0") &&
      decoded !== "." &&
      decoded !== ".."
      ? decoded
      : null;
  } catch {
    return null;
  }
}

/** Return the filename portion of a platform-neutral stored gallery path. */
export function storedGalleryFilename(filePath: string): string {
  return basename(normalizedGalleryPath(filePath));
}

/** Resolve a stored gallery-relative path without permitting root escape. */
export function resolveStoredGalleryFile(
  filePath: string,
  galleryRoot = join(DATA_DIR, "gallery"),
): StoredGalleryFile | null {
  if (!filePath || filePath.includes("\0")) return null;
  try {
    const absolutePath = assertInsideDir(galleryRoot, join(galleryRoot, normalizedGalleryPath(filePath)));
    return { absolutePath, directory: dirname(absolutePath), filename: basename(absolutePath) };
  } catch {
    return null;
  }
}

/** Prefer an owner-local gallery file while supporting canonical shared files referenced by owner-scoped URLs. */
export function resolveOwnedGalleryPath(galleryRoot: string, ownerRoot: string, filename: string): string {
  const ownedPath = assertInsideDir(ownerRoot, join(ownerRoot, filename));
  if (existsSync(ownedPath)) return ownedPath;
  const sharedRoot = assertInsideDir(galleryRoot, join(galleryRoot, "shared"));
  const sharedPath = assertInsideDir(sharedRoot, join(sharedRoot, filename));
  return existsSync(sharedPath) ? sharedPath : ownedPath;
}
