import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import { isAllowedImageBuffer } from "../../../utils/security.js";
import { getSharp } from "../../../utils/sharp.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import {
  readCreatorMediaPath,
  resolveCreatorMediaAbsolutePath,
  type SlpCreatorPostMediaUpload,
} from "../../base/media/slp-media.js";
import {
  slurpPickReuse,
  slurpPreviewCrop,
  slurpReuseCandidates,
  type SlurpReusablePost,
  type SlurpReuseKind,
} from "../../modules/feed/slp-media-reuse.js";

/** How far back reuse looks. A Creator's whole history is not needed to find one old picture. */
const REUSE_LOOKBACK_POSTS = 120;

export type SlurpReuseAvailability = Record<SlurpReuseKind, SlurpReusablePost | null>;

/**
 * The picture each kind of reuse would use for this post, or null where none qualifies.
 *
 * Chosen before the delivery is decided, so the planner only picks a reuse that can happen.
 * A preview also needs `sharp`, because a cropped preview that cannot be cropped would publish a
 * paid picture whole.
 */
export async function findSlurpReuse(
  db: DB,
  input: {
    creatorAccountId: string;
    access: string;
    at: Date;
    sequence: number;
    shootId?: string | null;
    /** A campaign teaser previews its own set when that picture qualifies. */
    previewPostId?: string | null;
  },
): Promise<SlurpReuseAvailability> {
  const posts = await createSlurpStorage(db).listNoodlerPostsByAccount(input.creatorAccountId, REUSE_LOOKBACK_POSTS);
  const pick = (kind: SlurpReuseKind) => {
    const candidates = slurpReuseCandidates(posts, {
      kind,
      access: input.access,
      at: input.at,
      shootId: input.shootId,
    });
    const preferred = kind === "preview" ? candidates.find((post) => post.id === input.previewPostId) : undefined;
    return preferred ?? slurpPickReuse(candidates, input.creatorAccountId, input.sequence);
  };
  return {
    shoot: input.shootId ? pick("shoot") : null,
    archive: pick("archive"),
    preview: (await getSharp()) ? pick("preview") : null,
  };
}

/**
 * The chosen picture's bytes, ready to be stored as the new post's own file.
 *
 * Null when the file is gone or unreadable, and the caller falls back to a new picture. A preview
 * is cropped here, on the bytes; if the crop fails the preview fails with it and nothing is shown.
 */
export async function loadSlurpReuse(
  post: SlurpReusablePost,
  kind: SlurpReuseKind,
): Promise<SlpCreatorPostMediaUpload | null> {
  const relative = readCreatorMediaPath({ metadata: post.metadata ?? {} } as never);
  const absolute = relative ? resolveCreatorMediaAbsolutePath(relative) : null;
  if (!relative || !absolute) return null;
  try {
    const original = await readFile(absolute);
    if (!isAllowedImageBuffer(original)) return null;
    const extension = extname(relative).replace(/^\./u, "") || "png";
    if (kind !== "preview") return { buffer: original, extension };
    const sharp = await getSharp();
    if (!sharp) return null;
    const meta = await sharp(original).metadata();
    if (!meta.width || !meta.height) return null;
    const cropped: Buffer = await sharp(original).extract(slurpPreviewCrop(meta.width, meta.height)).jpeg().toBuffer();
    return { buffer: cropped, extension: "jpg" };
  } catch (error) {
    logger.warn(error, "[slurp] Could not reuse picture from post %s; a new one is drawn instead", post.id);
    return null;
  }
}
