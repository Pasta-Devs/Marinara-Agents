import { and, eq, inArray, isNotNull, like, lt, ne, or } from "../../../db/file-query.js";
import { slpPosts } from "../../../db/schema/slurp.js";
import { NOODLER_MEDIA_URL_PREFIX } from "../../base/media/slp-media.js";
import type { SlpCreatorPostPageOptions } from "../../modules/records/slp-storage-model.js";

export function slpCreatorReadablePostCondition(options: SlpCreatorPostPageOptions) {
  return or(
    eq(slpPosts.access, "public"),
    inArray(slpPosts.authorAccountId, options.readableContentAccountIds ?? []),
    inArray(slpPosts.id, options.unlockedPostIds ?? []),
  );
}

export function slpCreatorPostPageCondition(options: SlpCreatorPostPageOptions, includeCursor: boolean) {
  const readable = slpCreatorReadablePostCondition(options);
  return and(
    inArray(slpPosts.authorAccountId, options.accountIds),
    ne(slpPosts.access, "draft"),
    options.mediaOnly
      ? and(isNotNull(slpPosts.imageUrl), or(readable, like(slpPosts.imageUrl, `${NOODLER_MEDIA_URL_PREFIX}%`)))
      : undefined,
    options.readableOnly ? readable : undefined,
    includeCursor && options.cursor
      ? or(
          lt(slpPosts.createdAt, options.cursor.createdAt),
          and(eq(slpPosts.createdAt, options.cursor.createdAt), lt(slpPosts.id, options.cursor.id)),
        )
      : undefined,
  );
}
