import type { SlpCreatorPostView } from "../../../../../shared/src/slp/slp-social.types.js";
import { isSlurpStory, type SlurpViewerCreator } from "./SlpHomeHelpers";
import type { SlpLiveStory } from "../../modules/story/slp-story-rings";

export type SlurpMoment = {
  creator: SlurpViewerCreator;
  post: SlpCreatorPostView;
};

/**
 * What the Hub shows, derived from one viewer scope: the moment reel, the feed, the search hits,
 * everyone discoverable and the three creators it suggests. Story rings come from `slurpLiveStories`.
 *
 * It is pure so the Hub can memoise it on the five inputs below and so a test can run it without
 * a render.
 */
export function deriveSlurpHubView({
  creators,
  tab,
  momentCutoff,
  searchTerm,
  authorProfileId,
}: {
  creators: readonly SlurpViewerCreator[];
  tab: "following" | "all";
  momentCutoff: number;
  searchTerm: string;
  authorProfileId: string | undefined;
}) {
  const searchable = (value: unknown) => (typeof value === "string" ? value.toLowerCase() : "");
  // Keep a Creator's active Stories together. This makes one shelf tile a sequence rather than
  // making the next tap jump to an unrelated Creator.
  const nextMoments = creators
    .filter((creator) => tab === "all" || creator.followed)
    .map((creator) => ({
      creator,
      posts: creator.posts
        .filter((post) => isSlurpStory(post) && new Date(post.createdAt).getTime() >= momentCutoff)
        .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()),
    }))
    .filter(({ posts }) => posts.length > 0)
    .sort(
      (left, right) =>
        new Date(right.posts[right.posts.length - 1]!.createdAt).getTime() -
        new Date(left.posts[left.posts.length - 1]!.createdAt).getTime(),
    )
    .flatMap(({ creator, posts }) => posts.map((post) => ({ creator, post })));
  const allPosts = creators.flatMap((creator) =>
    creator.posts.filter((post) => !isSlurpStory(post)).map((post) => ({ post, creator })),
  );
  const matchesSearch = ({ post, creator }: (typeof allPosts)[number]) =>
    !searchTerm ||
    (post.title ?? "").toLowerCase().includes(searchTerm) ||
    (post.content ?? "").toLowerCase().includes(searchTerm) ||
    // A trend's label finds the posts that joined it (docs/TRENDS.md).
    String((post.metadata?.slurpTrend as { label?: unknown } | undefined)?.label ?? "")
      .toLowerCase()
      .includes(searchTerm) ||
    searchable(creator.profile.handle).includes(searchTerm) ||
    searchable(creator.profile.displayName).includes(searchTerm);
  const newestFirst = (left: (typeof allPosts)[number], right: (typeof allPosts)[number]) =>
    new Date(right.post.createdAt).getTime() - new Date(left.post.createdAt).getTime();
  return {
    moments: nextMoments,
    feed: allPosts
      .filter(({ creator }) => tab === "all" || creator.followed)
      .filter(matchesSearch)
      .sort(newestFirst),
    searchResults: searchTerm ? allPosts.filter(matchesSearch).sort(newestFirst) : [],
    discoveredCreators: creators.filter((creator) => creator.profile.id !== authorProfileId),
    suggestedCreators: creators
      .filter((creator) => creator.profile.id !== authorProfileId && !creator.followed)
      .slice(0, 3),
  };
}

/** Every Story newer than `cutoff` (ms), with whether this persona watched it (the shelf's signal, R1-024). */
export function slurpLiveStories(
  creators: readonly Pick<SlurpViewerCreator, "profile" | "posts">[],
  cutoff: number,
): SlpLiveStory[] {
  return creators.flatMap((creator) =>
    creator.posts
      .filter((post) => isSlurpStory(post) && new Date(post.createdAt).getTime() >= cutoff)
      .map((post) => ({
        creatorId: creator.profile.id,
        postId: post.id,
        createdAt: post.createdAt,
        watched: (post as { watched?: boolean }).watched === true,
      })),
  );
}
