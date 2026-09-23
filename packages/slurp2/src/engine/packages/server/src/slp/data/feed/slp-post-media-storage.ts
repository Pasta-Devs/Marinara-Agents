import type { DB } from "../../../db/connection.js";
import { eq } from "../../../db/file-query.js";
import { slpPostMedia, slpPosts } from "../../../db/schema/slurp.js";
import { newId, now } from "../../../utils/id-generator.js";
import { parseRecord } from "../../modules/records/slp-storage-model.js";
import { slpCreatorPostAttachmentUrl } from "../../base/media/slp-media.js";

export type StoredSlpPostMedia = {
  id: string;
  postId: string;
  position: number;
  imageUrl: string;
  imagePrompt: string | null;
  mediaPath: string;
  shootId: string | null;
};

function map(row: Record<string, unknown>): StoredSlpPostMedia {
  return {
    id: String(row.id),
    postId: String(row.postId),
    position: Number(row.position),
    imageUrl: String(row.imageUrl),
    imagePrompt: typeof row.imagePrompt === "string" ? row.imagePrompt : null,
    mediaPath: String(row.mediaPath),
    shootId: typeof row.shootId === "string" ? row.shootId : null,
  };
}

export async function listSlurpPostMedia(db: DB, postId: string): Promise<StoredSlpPostMedia[]> {
  const rows = await db.select().from(slpPostMedia).where(eq(slpPostMedia.postId, postId));
  return rows.map((row) => map(row as Record<string, unknown>)).sort((left, right) => left.position - right.position);
}

/** Add already-promoted secondary files and mirror their public fields into the post response. */
export async function addSlurpPostMedia(
  db: DB,
  postId: string,
  items: readonly { position: number; imagePrompt: string | null; mediaPath: string; shootId?: string | null }[],
): Promise<StoredSlpPostMedia[]> {
  if (items.length === 0) return [];
  const postRows = await db.select().from(slpPosts).where(eq(slpPosts.id, postId));
  const post = postRows[0];
  if (!post) return [];
  const createdAt = now();
  const rows = items.map((item) => ({
    id: newId(),
    postId,
    position: item.position,
    imageUrl: slpCreatorPostAttachmentUrl(postId, item.position),
    imagePrompt: item.imagePrompt,
    mediaPath: item.mediaPath,
    shootId: item.shootId ?? null,
    createdAt,
  }));
  await db.transaction(async (tx) => {
    for (const row of rows) await tx.insert(slpPostMedia).values(row);
    const metadata = parseRecord(post.metadata);
    await tx
      .update(slpPosts)
      .set({
        metadata: JSON.stringify({
          ...metadata,
          postMedia: rows.map(({ id, position, imageUrl, imagePrompt }) => ({ id, position, imageUrl, imagePrompt })),
        }),
        updatedAt: createdAt,
      })
      .where(eq(slpPosts.id, postId));
    await tx._fileStore.flush();
  });
  return rows.map((row) => map(row));
}

export async function deleteSlurpPostMediaRows(db: DB, postId: string): Promise<StoredSlpPostMedia[]> {
  const rows = await listSlurpPostMedia(db, postId);
  await db.delete(slpPostMedia).where(eq(slpPostMedia.postId, postId));
  return rows;
}
