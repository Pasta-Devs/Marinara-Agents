const WEEK = 7 * 24 * 60 * 60_000;

/**
 * Likes on the posts a Creator put up this week and the week before, for the Studio tile "Likes
 * this week" and its small trend. A like counts toward the week its post went up, which is how a
 * creator reads it ("this week's posts did better").
 */
export function slurpLikesByWeek(
  posts: readonly { createdAt: string; likeCount: number }[],
  at: Date,
): { thisWeek: number; lastWeek: number } {
  let thisWeek = 0;
  let lastWeek = 0;
  for (const post of posts) {
    const age = at.getTime() - Date.parse(post.createdAt);
    if (!(age >= 0)) continue;
    if (age < WEEK) thisWeek += post.likeCount;
    else if (age < 2 * WEEK) lastWeek += post.likeCount;
  }
  return { thisWeek, lastWeek };
}
