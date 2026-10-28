import type { SlpCreatorPage } from "../../../../../shared/src/slp/slp-creator-page.js";

/**
 * When an AI Creator updates their own Page: after real news, never on a timer alone.
 *
 * News is a post of theirs that carries a collab, a couple, a rivalry or a brand deal (`slurpTie`),
 * or a beat that changes something (an achievement, a relationship moment, something coming up).
 * The beat's own line is the news, not the caption, because it says plainly what happened.
 *
 * A Page the player edited is theirs and is never refreshed. A Page is refreshed at most once a week.
 * Pure, so the rule is testable without a database.
 */

export const SLP_CREATOR_PAGE_REFRESH_MIN_AGE_MS = 7 * 24 * 60 * 60_000;
export const SLP_CREATOR_PAGE_NEWS_MAX_AGE_MS = 3 * 24 * 60 * 60_000;

const NEWS_BEATS: ReadonlySet<string> = new Set(["achievement", "relationship_moment", "anticipation"]);

export type SlpCreatorPageNewsPost = { createdAt: string; content: string; metadata: Record<string, unknown> | null };

/** Whether this Page may be refreshed at all at `now`: the Creator's own, and a week old. */
export function slpCreatorPageRefreshDue(page: SlpCreatorPage | null | undefined, now: number): page is SlpCreatorPage {
  if (!page || page.composedBy !== "creator") return false;
  const pageAt = Date.parse(page.updatedAt);
  return !Number.isNaN(pageAt) && now - pageAt >= SLP_CREATOR_PAGE_REFRESH_MIN_AGE_MS;
}

/** The news that should refresh this Page at `now`, or null. Newest news wins. */
export function slpCreatorPageNews(
  page: SlpCreatorPage | null | undefined,
  posts: readonly SlpCreatorPageNewsPost[],
  now: number,
): string | null {
  if (!slpCreatorPageRefreshDue(page, now)) return null;
  const pageAt = Date.parse(page.updatedAt);
  const news = posts
    .map((post) => ({ post, at: Date.parse(post.createdAt) }))
    .filter(({ at }) => !Number.isNaN(at) && at > pageAt && now - at <= SLP_CREATOR_PAGE_NEWS_MAX_AGE_MS)
    .sort((a, b) => b.at - a.at)
    .map(({ post }) => newsLine(post))
    .find((line): line is string => Boolean(line));
  return news ?? null;
}

function newsLine(post: SlpCreatorPageNewsPost): string | null {
  const metadata = post.metadata ?? {};
  const beat = metadata.slurpBeat as { type?: unknown; line?: unknown } | undefined;
  const line = typeof beat?.line === "string" ? beat.line.trim() : "";
  const tie = metadata.slurpTie && typeof metadata.slurpTie === "object";
  if (!tie && !(typeof beat?.type === "string" && NEWS_BEATS.has(beat.type))) return null;
  const text = line || post.content.trim();
  return text ? text.slice(0, 300) : null;
}
