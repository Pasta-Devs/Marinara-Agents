import { and, eq, inArray, isNotNull, like, lt, ne, or } from "../../../db/file-query.js";
import { noodlePosts } from "../../../db/schema/slurp.js";
import { NOODLER_MEDIA_URL_PREFIX } from "../../base/media/slp-media.js";
import type { NoodlerPostPageOptions } from "../../modules/records/slp-storage-model.js";

export function noodlerReadablePostCondition(options: NoodlerPostPageOptions) {
  return or(
    eq(noodlePosts.access, "public"),
    inArray(noodlePosts.authorAccountId, options.readableContentAccountIds ?? []),
    inArray(noodlePosts.id, options.unlockedPostIds ?? []),
  );
}

export function noodlerPostPageCondition(options: NoodlerPostPageOptions, includeCursor: boolean) {
  const readable = noodlerReadablePostCondition(options);
  return and(
    inArray(noodlePosts.authorAccountId, options.accountIds),
    ne(noodlePosts.access, "draft"),
    options.mediaOnly
      ? and(isNotNull(noodlePosts.imageUrl), or(readable, like(noodlePosts.imageUrl, `${NOODLER_MEDIA_URL_PREFIX}%`)))
      : undefined,
    options.readableOnly ? readable : undefined,
    includeCursor && options.cursor
      ? or(
          lt(noodlePosts.createdAt, options.cursor.createdAt),
          and(eq(noodlePosts.createdAt, options.cursor.createdAt), lt(noodlePosts.id, options.cursor.id)),
        )
      : undefined,
  );
}
