import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readSync,
  realpathSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { basename, dirname, extname, join } from "path";
import type { FastifyReply } from "fastify";
import type { SlpCreatorManagedPost } from "../../../../../shared/src/slp/slp-social.types.js";
import { logger } from "../../../lib/logger.js";
import { DATA_DIR } from "../../../utils/data-dir.js";
import { assertInsideDir, isAllowedImageBuffer } from "../../../utils/security.js";
import { getSharp } from "../../../utils/sharp.js";
import { stageImageToDisk } from "../../../services/image/image-generation.js";
import { slpImageSizeOfFile, type SlpImageSize } from "./slp-image-size.js";
import { slurpImageExtension } from "./slp-image-format.js";

/**
 * A generated PNG (or BMP) stored as a WebP at quality 90, same size (0.3.6): about a fifth of the
 * bytes on disk and in the full-screen view, with no visible change in a generated picture. Other
 * formats, and hosts without `sharp`, keep the provider's bytes.
 */
export async function slpCompactGeneratedImage(image: {
  base64: string;
  ext: string;
}): Promise<{ base64: string; ext: string }> {
  const ext = slurpImageExtension(image.base64, image.ext);
  if (ext !== "png" && ext !== "bmp") return { base64: image.base64, ext };
  const sharp = await getSharp();
  if (!sharp) return { base64: image.base64, ext };
  try {
    const webp = await sharp(Buffer.from(image.base64, "base64")).webp({ quality: 90 }).toBuffer();
    return { base64: webp.toString("base64"), ext: "webp" };
  } catch (error) {
    logger.warn(error, "[slurp] Could not store a generated picture as WebP; keeping the original");
    return { base64: image.base64, ext };
  }
}

export { isAllowedImageBuffer } from "../../../utils/security.js";

// NoodleR-owned media lives under the gallery data dir but in a namespace whose
// path contains a slash, so the public gallery serve routes (which reject slashes in the
// chatId segment) can never reach it. Only the access-checked media endpoint serves it.
const GALLERY_DIR = join(DATA_DIR, "gallery");
// Renaming this orphans NoodleR media already on disk in existing installations. Accepted
// while NoodleR is in alpha; if that stops being true, migrate rather than rename again.
export const NOODLER_MEDIA_PREFIX = "slurp2-media/";

export type SlpCreatorPostMediaUpload = {
  buffer: Buffer;
  extension: string;
};

/** Access-checked serving URL for a NoodleR post's generated image. */
export function slpCreatorPostMediaUrl(postId: string): string {
  return `/api/slurp2/noodler/posts/${encodeURIComponent(postId)}/media`;
}

export function slpCreatorPostAttachmentUrl(postId: string, position: number): string {
  return `/api/slurp2/noodler/posts/${encodeURIComponent(postId)}/media/${position}`;
}

export const NOODLER_MEDIA_URL_PREFIX = "/api/slurp2/noodler/posts/";

/** Access-checked serving URL for a generated direct-message image. */
export function slurpMessageMediaUrl(messageId: string): string {
  return `/api/slurp2/messages/${encodeURIComponent(messageId)}/media`;
}

export type SlurpMessageMediaUpload = { buffer: Buffer; extension: string };

/** Stage a validated fan upload. The caller promotes it only after the message row exists. */
export function stageSlurpMessageMedia(upload: SlurpMessageMediaUpload) {
  return stageImageToDisk(`${NOODLER_MEDIA_PREFIX}messages`, upload.buffer.toString("base64"), upload.extension);
}

/**
 * Bind a stored NoodleR media URL to the persona it is being served to. The media route
 * gates on the persona, so audience-facing projections must carry it; unrelated (uploaded
 * or external) image URLs are returned untouched.
 */
export function slpCreatorPostMediaUrlForPersona(
  imageUrl: string | null,
  personaId: string,
  variant: "locked" | "original",
  version?: string,
): string | null {
  if (!imageUrl?.startsWith(NOODLER_MEDIA_URL_PREFIX)) return imageUrl;
  // `variant` partitions the browser cache only. The media route derives access from the
  // persona on every request and never trusts this caller-provided label for authorization.
  // `version` changes when a picture is redrawn under the same URL, so the browser drops the old one.
  const versionQuery = version ? `&v=${encodeURIComponent(version)}` : "";
  return `${imageUrl}?personaId=${encodeURIComponent(personaId)}&variant=${variant}${versionQuery}`;
}

/**
 * Promote uploaded NoodleR media and persist its stable post-owned references as one
 * compensating operation. A null result means the target disappeared before persistence.
 */
export async function persistCreatorPostWithUploadedMedia<T>(
  accountId: string,
  postId: string,
  upload: SlpCreatorPostMediaUpload,
  persist: (media: { imageUrl: string; noodlerMediaPath: string }) => Promise<T | null>,
): Promise<T | null> {
  const stagedMedia = stageImageToDisk(
    `${NOODLER_MEDIA_PREFIX}${accountId}`,
    upload.buffer.toString("base64"),
    upload.extension,
  );
  try {
    stagedMedia.promote();
    const result = await persist({
      imageUrl: slpCreatorPostMediaUrl(postId),
      noodlerMediaPath: stagedMedia.filePath,
    });
    if (result === null) stagedMedia.compensate();
    return result;
  } catch (error) {
    stagedMedia.compensate();
    throw error;
  }
}

// A locked post shows a blurred teaser, not a grey frame — that is what the onboarding
// wizard teaches users to recognise. The blur has to happen server-side: shipping the
// original bytes and blurring in CSS discloses the image to anyone who opens devtools.
// Downscaling to a handful of pixels before blurring makes the original unrecoverable
// rather than merely hidden.
const TEASER_WIDTH = 64;
const TEASER_SUFFIX = ".teaser-v4.jpg";
// 160: a thumbnail asked for it and, not listed, got the full original (about 2 MB) instead (0.3.6).
export const SLP_CREATOR_MEDIA_WIDTHS = [96, 160, 320, 480, 640, 960, 1280, 1600] as const;

export async function resolveCreatorMediaVariant(
  absolutePath: string,
  width: number | undefined,
  variantBase = absolutePath,
): Promise<string> {
  if (!width || !SLP_CREATOR_MEDIA_WIDTHS.includes(width as (typeof SLP_CREATOR_MEDIA_WIDTHS)[number]))
    return absolutePath;
  const variantPath = `${variantBase}.w${width}.webp`;
  if (existsSync(variantPath)) return variantPath;
  const sharp = await getSharp();
  if (!sharp) return absolutePath;
  const stagingPath = `${variantPath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  try {
    await sharp(absolutePath)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: width <= 320 ? 78 : 84 })
      .toFile(stagingPath);
    try {
      renameSync(stagingPath, variantPath);
    } catch (error) {
      if (!existsSync(variantPath)) throw error;
    }
    return variantPath;
  } catch (error) {
    logger.warn(error, "[slurp] Failed to build %spx media variant for %s", width, absolutePath);
    return absolutePath;
  } finally {
    if (existsSync(stagingPath)) unlinkSync(stagingPath);
  }
}

/** The first bytes of a file: enough for every image signature, AVIF brands included. */
function readFileHeader(path: string): Buffer {
  const header = Buffer.alloc(256);
  const fd = openSync(path, "r");
  try {
    return header.subarray(0, readSync(fd, header, 0, header.length, 0));
  } finally {
    closeSync(fd);
  }
}

/**
 * The image type these bytes show. The ".avif" hint only turns on AVIF brand sniffing; every other
 * type is read from its own header. A generated BMP stays a BMP where sharp is missing
 * (`slpCompactGeneratedImage`), so it is recognised here too.
 */
function slpImageTypeOfBytes(bytes: Buffer): { ext: string; mimeType: string } | null {
  const image = isAllowedImageBuffer(bytes, ".avif");
  if (image) return image;
  return bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d ? { ext: "bmp", mimeType: "image/bmp" } : null;
}

/**
 * Send a stored Slurp picture as the image type its own bytes show, with `nosniff`, never as the type
 * its file name suggests. A file that is not a picture is not sent at all.
 */
export function sendSlurpImageFile(reply: FastifyReply, absolutePath: string) {
  let type: { ext: string; mimeType: string } | null = null;
  try {
    type = slpImageTypeOfBytes(readFileHeader(absolutePath));
  } catch {
    type = null;
  }
  if (!type) {
    // Drop the headers the caller set for the picture, so the 404 is neither cached nor named as one.
    return reply
      .removeHeader("Content-Disposition")
      .header("Cache-Control", "no-store")
      .code(404)
      .send({ error: "Not Found" });
  }
  // A file left by an older restore can carry another type's extension; a saved copy takes the bytes' one.
  const disposition = reply.getHeader("Content-Disposition");
  if (typeof disposition === "string") {
    reply.header("Content-Disposition", disposition.replace(/\.[a-z0-9]+"$/iu, `.${type.ext}"`));
  }
  return (
    reply
      .header("X-Content-Type-Options", "nosniff")
      .type(type.mimeType)
      // `contentType: false` keeps the verified type above; sendFile would name one from the extension.
      // ponytail: sendFile still writes its own Cache-Control ("public, max-age=0", revalidated by ETag)
      // over the caller's, as it always has on these routes. Pass `cacheControl: false` once the
      // callers' longer cache lifetimes are wanted.
      .sendFile(basename(absolutePath), dirname(absolutePath), { contentType: false })
  );
}

const ENGINE_AVATAR_DIR = join(DATA_DIR, "avatars");
const ENGINE_AVATAR_EXTENSION = /\.(?:png|jpe?g|webp|gif|avif)$/iu;

/**
 * The Engine avatar file behind `/api/avatars/file/<name>`, held to the checks the Engine's own route
 * makes: a plain name, a regular file whose real path stays in the avatar folder (no symlink out), and
 * image bytes. Null otherwise.
 */
function engineAvatarSource(fileName: string): string | null {
  if (
    !fileName ||
    fileName.startsWith(".") ||
    /[\\/\0]/u.test(fileName) ||
    fileName.includes("..") ||
    !ENGINE_AVATAR_EXTENSION.test(fileName)
  )
    return null;
  try {
    const source = assertInsideDir(ENGINE_AVATAR_DIR, join(ENGINE_AVATAR_DIR, fileName));
    assertInsideDir(realpathSync(ENGINE_AVATAR_DIR), realpathSync(source));
    if (!statSync(source).isFile()) return null;
    return isAllowedImageBuffer(readFileHeader(source), extname(fileName)) ? source : null;
  } catch {
    return null;
  }
}

/**
 * A width variant of an Engine avatar (`/api/avatars/file/<name>`). The Engine serves only the original,
 * often a 1-2.5 MB card PNG, and a feed of 44 px avatars pulled 16 MB on open (0.3.41). The variant is
 * cached in Slurp's own media namespace, never in the Engine's avatar folder; the `.w<width>.webp`
 * suffix keeps it out of backups. Null when the name is not an avatar picture the Engine would serve.
 */
export async function resolveEngineAvatarVariant(fileName: string, width: number | undefined): Promise<string | null> {
  const source = engineAvatarSource(fileName);
  if (!source) return null;
  const marker = resolveCreatorMediaAbsolutePath(`${NOODLER_MEDIA_PREFIX}engine-avatars/${fileName}`);
  if (!marker) return null;
  mkdirSync(dirname(marker), { recursive: true });
  // The Engine may write a new picture under the same name, so the cache key carries its mtime.
  // ponytail: replaced pictures leave their old variants behind (a few kB each); sweep them if that ever adds up.
  return resolveCreatorMediaVariant(source, width, `${marker}.${Math.trunc(statSync(source).mtimeMs)}`);
}

/**
 * Blurred, unrecoverable teaser bytes for a locked post's media, cached next to the
 * original. Null where `sharp` is unavailable (no Android prebuild) or the source cannot be
 * decoded — callers must fail closed and serve nothing rather than the original.
 */
export async function readCreatorLockedTeaser(absolutePath: string): Promise<Buffer | null> {
  const teaserPath = `${absolutePath}${TEASER_SUFFIX}`;
  if (existsSync(teaserPath)) return readFileSync(teaserPath);
  const sharp = await getSharp();
  if (!sharp) return null;
  try {
    const teaser: Buffer = await sharp(absolutePath)
      .resize({ width: TEASER_WIDTH, withoutEnlargement: true })
      .blur(1.6)
      .jpeg({ quality: 60 })
      .toBuffer();
    const stagingPath = `${teaserPath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    try {
      writeFileSync(stagingPath, teaser);
      try {
        renameSync(stagingPath, teaserPath);
      } catch (error) {
        // Another request may have won the race on platforms that do not replace an
        // existing destination. Its complete file is just as valid as ours.
        if (!existsSync(teaserPath)) throw error;
      }
    } finally {
      if (existsSync(stagingPath)) unlinkSync(stagingPath);
    }
    return teaser;
  } catch (error) {
    logger.warn(error, "[slurp] Failed to build locked teaser for %s", absolutePath);
    return null;
  }
}

export function readCreatorMediaPath(post: Pick<SlpCreatorManagedPost, "metadata">): string | null {
  const value = (post.metadata as Record<string, unknown> | null | undefined)?.noodlerMediaPath;
  return typeof value === "string" && value.startsWith(NOODLER_MEDIA_PREFIX) ? value : null;
}

/** Resolve a stored relative NoodleR-media path to an absolute path inside the gallery dir. */
/** The pixel size of a stored post picture (V: the client reserves its frame from it). */
export function slpStoredMediaSize(mediaPath: unknown): SlpImageSize | null {
  const absolute = typeof mediaPath === "string" ? resolveCreatorMediaAbsolutePath(mediaPath) : null;
  return absolute ? slpImageSizeOfFile(absolute) : null;
}

export function resolveCreatorMediaAbsolutePath(relativePath: string): string | null {
  if (!relativePath.startsWith(NOODLER_MEDIA_PREFIX)) return null;
  const segments = relativePath.slice(NOODLER_MEDIA_PREFIX.length).split(/[\\/]/u);
  if (segments.length === 0 || segments.some((segment) => !segment || segment === "." || segment === "..")) {
    return null;
  }
  try {
    return assertInsideDir(GALLERY_DIR, join(GALLERY_DIR, relativePath));
  } catch {
    return null;
  }
}

/** Best-effort removal of an owned NoodleR-media file when its post is deleted. */
export function unlinkCreatorMedia(relativePath: string | null): boolean {
  if (!relativePath) return true;
  const absolute = resolveCreatorMediaAbsolutePath(relativePath);
  if (!absolute) return false;
  try {
    if (existsSync(absolute)) unlinkSync(absolute);
    // The cached teaser is a derivative of the same bytes and must not outlive them.
    if (existsSync(`${absolute}${TEASER_SUFFIX}`)) unlinkSync(`${absolute}${TEASER_SUFFIX}`);
    const fileName = basename(absolute);
    const parent = dirname(absolute);
    if (existsSync(parent)) {
      for (const entry of readdirSync(parent)) {
        if (entry.startsWith(`${fileName}.w`) && entry.endsWith(".webp")) unlinkSync(join(parent, entry));
      }
    }
    return true;
  } catch (error) {
    logger.warn(error, "[slurp] Failed to remove Slurp media file %s", relativePath);
    return false;
  }
}

/** Bytes that deleting one original will reclaim, including its cached teaser and width variants. */
export function estimateCreatorMediaRemovalBytes(relativePath: string): number {
  const absolute = resolveCreatorMediaAbsolutePath(relativePath);
  if (!absolute) return 0;
  try {
    let bytes = existsSync(absolute) ? statSync(absolute).size : 0;
    const teaser = `${absolute}${TEASER_SUFFIX}`;
    if (existsSync(teaser)) bytes += statSync(teaser).size;
    const fileName = basename(absolute);
    const parent = dirname(absolute);
    if (existsSync(parent)) {
      for (const entry of readdirSync(parent)) {
        if (entry.startsWith(`${fileName}.w`) && entry.endsWith(".webp")) {
          bytes += statSync(join(parent, entry)).size;
        }
      }
    }
    return bytes;
  } catch {
    // A preview is advisory and files can disappear between directory reads. Execution still
    // resolves and unlinks each path through the guarded helper above.
    return 0;
  }
}

/** Current size of the complete Slurp-owned media namespace, derivatives included. */
export function summarizeCreatorMedia(): { files: number; bytes: number } {
  const marker = resolveCreatorMediaAbsolutePath(`${NOODLER_MEDIA_PREFIX}__slurp_summary_root__`);
  const root = marker ? dirname(marker) : null;
  if (!root || !existsSync(root)) return { files: 0, bytes: 0 };
  let files = 0;
  let bytes = 0;
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) {
        files += 1;
        try {
          bytes += statSync(absolute).size;
        } catch {
          // The summary remains useful if a concurrent request removes one cached derivative.
        }
      }
    }
  };
  visit(root);
  return { files, bytes };
}

/** Best-effort removal of a creator's whole owned NoodleR media namespace on account deletion. */
export function removeCreatorAccountMedia(accountId: string): void {
  if (!accountId || accountId === "." || accountId === ".." || /[\\/]/u.test(accountId)) return;
  const dir = resolveCreatorMediaAbsolutePath(`${NOODLER_MEDIA_PREFIX}${accountId}`);
  if (!dir) return;
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch (error) {
    logger.warn(error, "[slurp] Failed to remove Slurp media dir for account %s", accountId);
  }
}

/** Remove only the Slurp media namespace. Engine and Noodle media stay outside this path. */
export function removeAllCreatorMedia(): void {
  const dir = resolveCreatorMediaAbsolutePath("slurp2-media");
  if (!dir) return;
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch (error) {
    logger.warn(error, "[slurp] Failed to remove all Slurp media");
  }
}

/** Every owned media file, as archive-relative paths, for a backup export. */
export async function listCreatorMediaFiles(): Promise<Array<{ relativePath: string; absolutePath: string }>> {
  const marker = resolveCreatorMediaAbsolutePath(`${NOODLER_MEDIA_PREFIX}__slurp_backup_root__`);
  const root = marker ? dirname(marker) : null;
  if (!root || !existsSync(root)) return [];
  const files: Array<{ relativePath: string; absolutePath: string }> = [];
  const visit = (directory: string, relativeDirectory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, entry.name);
      const relativePath = `${relativeDirectory}/${entry.name}`;
      // Teasers and width variants are derived from the original bytes, so the archive carries
      // only the originals and the derivatives are regenerated on demand after a restore.
      if (entry.isDirectory()) visit(absolutePath, relativePath);
      else if (entry.isFile() && !entry.name.endsWith(TEASER_SUFFIX) && !/\.w\d+\.webp$/u.test(entry.name)) {
        files.push({ relativePath, absolutePath });
      }
    }
  };
  visit(root, "media");
  return files;
}

/** The extensions a restored picture may carry, each with the type its bytes must show. */
const RESTORABLE_IMAGE_TYPES: Readonly<Record<string, string>> = {
  ".png": "png",
  ".jpg": "jpg",
  ".jpeg": "jpg",
  ".webp": "webp",
  ".gif": "gif",
  ".avif": "avif",
};

/**
 * Write one media file back from a backup archive.
 *
 * The archive stores media under `media/<accountId>/<file>`, which maps to the owned namespace
 * `<NOODLER_MEDIA_PREFIX><accountId>/<file>`. Anything that escapes that namespace, is not a PNG,
 * JPEG, WebP, GIF or AVIF picture, or whose extension names another type than its bytes show, is
 * refused: a backup archive is untrusted input even when this package wrote it. Slurp itself always
 * names a picture by its bytes, so a refused file is not one it wrote; rows that name it point at no
 * file, as they do for a picture missing from the archive.
 */
export function restoreCreatorMediaFile(archivePath: string, data: Buffer): boolean {
  if (!archivePath.startsWith("media/")) return false;
  const absolute = resolveCreatorMediaAbsolutePath(`${NOODLER_MEDIA_PREFIX}${archivePath.slice("media/".length)}`);
  if (!absolute) return false;
  const expected = RESTORABLE_IMAGE_TYPES[extname(absolute).toLowerCase()];
  if (!expected || isAllowedImageBuffer(data, ".avif")?.ext !== expected) return false;
  try {
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, data);
    return true;
  } catch (error) {
    logger.warn(error, "[slurp2] Failed to restore media file %s", archivePath);
    return false;
  }
}
