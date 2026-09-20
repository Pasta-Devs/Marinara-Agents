import type { FastifyRequest, FastifyReply } from "fastify";
import type { SlpCreatorPostMediaUpload } from "../media/slp-media.js";
import { trySlurpWrite } from "../locking/slp-operation-lock.js";
import { isAllowedImageBuffer, safeFetch } from "../../../utils/security.js";
import { logger } from "../../../lib/logger.js";
import { z } from "zod";

const SLP_CREATOR_MEDIA_MAX_BYTES = 20 * 1024 * 1024;

class SlpCreatorMediaRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
  }
}

export async function readCreatorMultipart(
  req: FastifyRequest,
): Promise<{ payload: unknown; media: SlpCreatorPostMediaUpload }> {
  let payload: unknown;
  let media: SlpCreatorPostMediaUpload | null = null;
  for await (const part of req.parts({
    limits: { fileSize: SLP_CREATOR_MEDIA_MAX_BYTES, files: 1 },
  })) {
    if (part.type === "field") {
      if (part.fieldname === "payload") {
        try {
          payload = JSON.parse(String(part.value));
        } catch {
          throw new SlpCreatorMediaRequestError("The image request payload is invalid.", 400);
        }
      }
      continue;
    }
    if (part.fieldname !== "file" || media) {
      part.file.resume();
      throw new SlpCreatorMediaRequestError("Upload one image in the file field.", 400);
    }
    const write = await trySlurpWrite(async () => {
      try {
        return await part.toBuffer();
      } catch (error) {
        const truncated = (part.file as typeof part.file & { truncated?: boolean }).truncated === true;
        const tooLarge = truncated || (error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE";
        throw new SlpCreatorMediaRequestError(
          tooLarge ? "Slurp image is too large." : "Failed to read the uploaded image.",
          tooLarge ? 413 : 400,
        );
      }
    });
    if (!write.acquired) {
      part.file.resume();
      throw new SlpCreatorMediaRequestError("Slurp data cleanup is in progress.", 409);
    }
    const buffer = write.value;
    // The magic bytes decide the type, not the filename. An image saved straight from a post
    // (/slurp/posts/:id/media) has no extension at all, and browsers rename a JPEG to .jfif, so
    // gating on the name rejected valid images. The ".avif" hint only enables AVIF brand sniffing,
    // which has no signature of its own; every other format is detected from its own header.
    const detected = isAllowedImageBuffer(buffer, ".avif");
    if (!detected) {
      throw new SlpCreatorMediaRequestError(
        "That file is not a PNG, JPEG, WebP, GIF or AVIF image. Its contents are read to decide, so renaming it does not help.",
        400,
      );
    }
    media = { buffer, extension: detected.ext };
  }
  if (payload === undefined) {
    throw new SlpCreatorMediaRequestError("The image request payload is required.", 400);
  }
  if (!media) throw new SlpCreatorMediaRequestError("Upload one image in the file field.", 400);
  return { payload, media };
}

async function importCreatorMedia(imageUrl: string): Promise<SlpCreatorPostMediaUpload> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await safeFetch(imageUrl, {
      signal: controller.signal,
      policy: {
        allowLocal: false,
        allowLoopback: false,
        allowedProtocols: ["http:", "https:"],
        maxRedirects: 3,
      },
      maxResponseBytes: SLP_CREATOR_MEDIA_MAX_BYTES,
      allowedContentTypes: ["image/"],
      allowMissingContentType: true,
      headers: { Accept: "image/*" },
    });
    if (!response.ok) {
      throw new SlpCreatorMediaRequestError(`Image URL returned HTTP ${response.status}.`, 400);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const detected = isAllowedImageBuffer(buffer);
    if (!detected) {
      throw new SlpCreatorMediaRequestError("The URL did not return a supported image.", 415);
    }
    return { buffer, extension: detected.ext };
  } catch (error) {
    if (error instanceof SlpCreatorMediaRequestError) throw error;
    logger.warn(error, "[slurp] Could not import image URL");
    const tooLarge = error instanceof Error && /exceeded \d+ bytes/iu.test(error.message);
    throw new SlpCreatorMediaRequestError(
      tooLarge
        ? "Slurp image is too large."
        : "Could not download that image URL. Check that it is public and points directly to an image.",
      tooLarge ? 413 : 400,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export type DecodedCreatorMediaRequest<T> =
  { success: true; data: T; media: SlpCreatorPostMediaUpload | undefined } | { success: false; error: z.ZodError };

export async function decodeCreatorMediaRequest<
  WithMediaSchema extends z.ZodTypeAny,
  WithoutMediaSchema extends z.ZodTypeAny,
>(
  req: FastifyRequest,
  schemas: { withMedia: WithMediaSchema; withoutMedia: WithoutMediaSchema },
): Promise<DecodedCreatorMediaRequest<z.output<WithMediaSchema> | z.output<WithoutMediaSchema>>> {
  let payload: unknown = req.body;
  let media: SlpCreatorPostMediaUpload | undefined;
  if (req.headers["content-type"]?.startsWith("multipart/form-data")) {
    const multipart = await readCreatorMultipart(req);
    payload = multipart.payload;
    media = multipart.media;
  }

  const parsedForUrl = schemas.withMedia.safeParse(payload);
  const uploadedImageUrl =
    parsedForUrl.success && typeof (parsedForUrl.data as { uploadedImageUrl?: unknown }).uploadedImageUrl === "string"
      ? (parsedForUrl.data as { uploadedImageUrl: string }).uploadedImageUrl
      : undefined;
  if (uploadedImageUrl) {
    if (media) {
      throw new SlpCreatorMediaRequestError("Choose either an uploaded file or an image URL.", 400);
    }
    media = await importCreatorMedia(uploadedImageUrl);
  }

  const parsed = (media ? schemas.withMedia : schemas.withoutMedia).safeParse(payload);
  return parsed.success ? { success: true, data: parsed.data, media } : { success: false, error: parsed.error };
}

export function sendCreatorMediaError(reply: FastifyReply, error: unknown) {
  const tooLarge = (error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE";
  const statusCode = tooLarge ? 413 : error instanceof SlpCreatorMediaRequestError ? error.statusCode : 500;
  if (statusCode === 500) logger.error(error, "[slurp] Image request failed");
  return reply.code(statusCode).send({
    error:
      statusCode === 500 ? "Image request failed." : tooLarge ? "Slurp image is too large." : (error as Error).message,
  });
}
