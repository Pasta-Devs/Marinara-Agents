/** A Creator card's cover: the banner, else the newest free picture they posted (Stories excluded). */
export function slurpCreatorCoverUrl(creator: {
  profile: { bannerUrl?: string | null };
  posts?: ReadonlyArray<{
    imageUrl?: string | null;
    locked?: boolean;
    story?: boolean;
    createdAt?: string;
    metadata?: { noodlerPostType?: unknown } | null;
  }>;
}): string | null {
  if (creator.profile.bannerUrl) return creator.profile.bannerUrl;
  let newest: { url: string; at: number } | null = null;
  for (const post of creator.posts ?? []) {
    if (!post.imageUrl || post.locked || post.story || post.metadata?.noodlerPostType === "story") continue;
    const at = Date.parse(post.createdAt ?? "") || 0;
    if (!newest || at > newest.at) newest = { url: post.imageUrl, at };
  }
  return newest?.url ?? null;
}
