/** Pure autopurge selection shared by the preview and the locked execution. */
export function selectSlurpAutopurge<
  Post extends { id: string; authorAccountId: string; createdAt: string; metadata: unknown },
  Message extends { id: string; createdAt: string; metadata: unknown },
>(input: {
  cutoff: string;
  creatorIds: readonly string[];
  posts: readonly Post[];
  messages: readonly Message[];
  keepPosts: boolean;
  includeMessageMedia: boolean;
  mediaPathOf: (metadata: unknown) => string | null;
}) {
  const creators = new Set(input.creatorIds);
  const oldPosts = input.posts.filter((post) => creators.has(post.authorAccountId) && post.createdAt < input.cutoff);
  const oldMessages = input.includeMessageMedia
    ? input.messages.filter((message) => message.createdAt < input.cutoff)
    : [];
  const pathsOf = (rows: ReadonlyArray<{ metadata: unknown }>) =>
    rows.flatMap((row) => {
      const path = input.mediaPathOf(row.metadata);
      return path ? [path] : [];
    });
  const postMedia = pathsOf(oldPosts);
  const messageMedia = pathsOf(oldMessages);
  return {
    oldPosts,
    oldMessages,
    postMedia,
    messageMedia,
    postsToDelete: input.keepPosts ? [] : oldPosts,
    mediaPaths: [...new Set([...postMedia, ...messageMedia])],
  };
}
