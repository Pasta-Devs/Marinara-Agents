import { readFile, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { DATA_DIR } from "../../../utils/data-dir.js";
import { assertInsideDir, isAllowedImageBuffer } from "../../../utils/security.js";
import { getSharp } from "../../../utils/sharp.js";
import { logger } from "../../../lib/logger.js";
import { llmFetch } from "../../../services/llm/base-provider.js";
import { decodeSafePathSegment, resolveOwnedGalleryPath } from "../../../services/image/gallery-file-lifecycle.js";
import { resolveNoodlerMediaAbsolutePath } from "./slp-media.js";

export const NOODLE_VISION_MAX_IMAGES = 8;
const NOODLE_VISION_MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const NOODLE_VISION_MAX_DIMENSION = 1568;

export interface NoodlePromptImageCandidate {
  key: string;
  imageUrl: string;
  postId: string;
  interactionId: string | null;
  createdAt: string;
}

export interface NoodleVisionAttachment extends NoodlePromptImageCandidate {
  dataUrl: string;
}

export function resolveNoodleImagePath(imageUrl: string): string | null {
  if (!imageUrl.startsWith("/")) return null;
  let pathname: string;
  try {
    pathname = new URL(imageUrl, "http://marinara.local").pathname;
  } catch {
    return null;
  }
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "api") return null;
  const galleryRoot = join(DATA_DIR, "gallery");

  if (parts[1] === "global-gallery" && parts[2] === "file") {
    const filename = decodeSafePathSegment(parts[3]);
    if (!filename) return null;
    const root = join(galleryRoot, "global");
    return assertInsideDir(root, join(root, filename));
  }
  if (parts[1] === "gallery" && parts[2] === "file") {
    const chatId = decodeSafePathSegment(parts[3]);
    const filename = decodeSafePathSegment(parts[4]);
    if (!chatId || !filename) return null;
    const root = join(galleryRoot, chatId);
    return resolveOwnedGalleryPath(galleryRoot, root, filename);
  }
  if (parts[1] === "characters" && parts[2] === "personas" && parts[4] === "gallery" && parts[5] === "file") {
    const personaId = decodeSafePathSegment(parts[3]);
    const filename = decodeSafePathSegment(parts[6]);
    if (!personaId || !filename) return null;
    const root = join(galleryRoot, "personas", personaId);
    return resolveOwnedGalleryPath(galleryRoot, root, filename);
  }
  if (parts[1] === "characters" && parts[3] === "gallery" && parts[4] === "file") {
    const characterId = decodeSafePathSegment(parts[2]);
    const filename = decodeSafePathSegment(parts[5]);
    if (!characterId || !filename) return null;
    const root = join(galleryRoot, "characters", characterId);
    return resolveOwnedGalleryPath(galleryRoot, root, filename);
  }
  return null;
}

function decodeImageDataUrl(imageUrl: string): { buffer: Buffer; expectedExt: string } | null {
  const match = imageUrl.match(/^data:image\/(png|jpe?g|webp|gif|avif);base64,([\s\S]+)$/i);
  if (!match?.[1] || !match[2]) return null;
  const buffer = Buffer.from(match[2].replace(/\s+/g, ""), "base64");
  if (buffer.length > NOODLE_VISION_MAX_SOURCE_BYTES) return null;
  const subtype = match[1].toLowerCase();
  return { buffer, expectedExt: `.${subtype === "jpeg" ? "jpg" : subtype}` };
}

async function optimizeNoodleVisionImage(buffer: Buffer, expectedExt?: string): Promise<string | null> {
  if (!isAllowedImageBuffer(buffer, expectedExt)) return null;
  const sharp = await getSharp();
  if (!sharp) return null;
  try {
    const optimized = await sharp(buffer, {
      animated: false,
      limitInputPixels: 268_402_689,
    })
      .rotate()
      .resize({
        width: NOODLE_VISION_MAX_DIMENSION,
        height: NOODLE_VISION_MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${optimized.toString("base64")}`;
  } catch (error) {
    logger.warn(error, "[noodle/vision] Failed to optimize a timeline image");
    return null;
  }
}

async function readNoodleVisionImage(imageUrl: string, mediaPath?: string): Promise<string | null> {
  const dataUrlImage = decodeImageDataUrl(imageUrl);
  if (dataUrlImage) return optimizeNoodleVisionImage(dataUrlImage.buffer, dataUrlImage.expectedExt);

  const filePath = mediaPath ? resolveNoodlerMediaAbsolutePath(mediaPath) : resolveNoodleImagePath(imageUrl);
  if (!filePath) return null;
  const fileStat = await stat(filePath);
  if (!fileStat.isFile() || fileStat.size > NOODLE_VISION_MAX_SOURCE_BYTES) return null;
  return optimizeNoodleVisionImage(await readFile(filePath), extname(filePath));
}

export async function prepareNoodleVisionAttachments(
  candidates: Array<NoodlePromptImageCandidate & { mediaPath?: string }>,
): Promise<NoodleVisionAttachment[]> {
  const ordered = candidates.slice().sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  const attachments: NoodleVisionAttachment[] = [];
  const seenKeys = new Set<string>();

  for (const candidate of ordered) {
    if (attachments.length >= NOODLE_VISION_MAX_IMAGES) break;
    if (seenKeys.has(candidate.key)) continue;
    seenKeys.add(candidate.key);
    try {
      const dataUrl = await readNoodleVisionImage(candidate.imageUrl, candidate.mediaPath);
      if (dataUrl) attachments.push({ ...candidate, dataUrl });
    } catch (error) {
      logger.warn(error, "[noodle/vision] Could not attach timeline image %s", candidate.key);
    }
  }
  return attachments;
}

export function formatNoodleVisionManifest(attachments: NoodleVisionAttachment[]): string {
  if (attachments.length === 0) return "";
  return [
    "# Attached Slurp Images",
    "The image inputs are attached in the same order as this list. Use each key to associate pixels with the correct post or reply.",
    ...attachments.map((attachment, index) =>
      attachment.interactionId
        ? `- image ${index + 1}: ${attachment.key}, reply ${attachment.interactionId} on post ${attachment.postId}`
        : `- image ${index + 1}: ${attachment.key}, post ${attachment.postId}`,
    ),
  ].join("\n");
}

// A model that refuses image input refuses it every time, so the first refusal is remembered and
// later descriptions skip that model instead of paying for another failed call.
// ponytail: in-memory, so each server start pays for one refusal. Persist it if that is still too many.
const modelsRejectingVision = new Set<string>();

type SlurpVisionConnection = { id?: string; provider: string; model: string };

// Two connections can share a provider and model but point at different endpoints, so the
// connection is part of the key: one connection's answer must not decide another's.
function slurpVisionModelKey(connection: SlurpVisionConnection): string {
  return JSON.stringify([connection.id ?? "", connection.provider, connection.model]);
}

export function slurpModelRejectsVisionInput(connection: SlurpVisionConnection): boolean {
  return modelsRejectingVision.has(slurpVisionModelKey(connection));
}

export function rememberSlurpVisionRejection(connection: SlurpVisionConnection): void {
  modelsRejectingVision.add(slurpVisionModelKey(connection));
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** A provider model list's `capabilities.vision` for one model, or null when it does not say. */
export function readSlurpVisionSupport(catalog: unknown, modelId: string): boolean | null {
  const data = readRecord(catalog)?.data;
  if (!Array.isArray(data)) return null;
  const vision = readRecord(
    readRecord(data.map(readRecord).find((entry) => entry?.id === modelId)?.capabilities),
  )?.vision;
  return typeof vision === "boolean" ? vision : null;
}

// ponytail: cached until restart, and only NanoGPT publishes vision support. Add providers as they do.
const visionSupportByModel = new Map<string, boolean | null>();

/**
 * True when this model is known not to read images: it refused one already, or its provider's model
 * list says so. Checked before a description is requested, so a text-only model is never sent one.
 */
export async function slurpModelLacksVision(
  connection: SlurpVisionConnection & { apiKey?: string | null },
  baseUrl: string,
): Promise<boolean> {
  if (slurpModelRejectsVisionInput(connection)) return true;
  if (connection.provider !== "nanogpt" || !baseUrl || !connection.model) return false;
  const key = slurpVisionModelKey(connection);
  if (!visionSupportByModel.has(key)) {
    let support: boolean | null = null;
    try {
      const url = new URL(`${baseUrl.replace(/\/+$/u, "")}/models`);
      if (url.protocol === "https:") {
        url.searchParams.set("detailed", "true");
        const response = await llmFetch(url, {
          headers: connection.apiKey ? { Authorization: `Bearer ${connection.apiKey}` } : undefined,
          signal: AbortSignal.timeout(10_000),
        });
        if (response.ok) support = readSlurpVisionSupport(await response.json(), connection.model);
      }
    } catch (error) {
      logger.debug(error, "[slurp/vision] Could not check the model's vision support");
    }
    visionSupportByModel.set(key, support);
  }
  return visionSupportByModel.get(key) === false;
}

export function isUnsupportedNoodleVisionInputError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    /(?:image|vision|multimodal|image_url).{0,100}(?:not supported|unsupported|does not support|invalid content type)/i.test(
      message,
    ) ||
    /(?:not supported|unsupported|does not support|invalid content type).{0,100}(?:image|vision|multimodal|image_url)/i.test(
      message,
    ) ||
    /no (?:available )?endpoints? found.{0,80}(?:image|vision|multimodal|image_url)/i.test(message) ||
    /(?:expected|must be).{0,60}(?:content|message).{0,60}(?:string|text)|(?:expected|must be).{0,60}(?:string|text).{0,60}(?:content|message)|(?:content|message).{0,60}(?:expected|must be).{0,60}(?:string|text)/i.test(
      message,
    )
  );
}
