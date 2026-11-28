import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const base = "packages/noodle/src/engine/packages/";
const hooks = readFileSync(`${base}client/src/hooks/use-noodle.ts`, "utf8");
const home = readFileSync(`${base}client/src/components/noodle/NoodleHome.tsx`, "utf8");
const routes = readFileSync(`${base}server/src/routes/noodle.routes.ts`, "utf8");
const storage = readFileSync(`${base}server/src/services/storage/noodle.storage.ts`, "utf8");

// Profiles page their own author-filtered feed instead of filtering the timeline cache.
assert.match(hooks, /authorAccountId=\$\{encodeURIComponent\(authorAccountId\)\}/u);
// Optimistic interaction edits must reach every feed query, the profile feed included.
assert.match(hooks, /setQueriesData<InfiniteData<NoodlePostPage>>\(\{ queryKey: noodleKeys\.feed\(\) \}/u);
assert.match(routes, /authorAccountId\?: string/u);
assert.match(storage, /filter\(\(id\) => !options\.authorAccountId \|\| id === options\.authorAccountId\)/u);
assert.match(home, /useNoodleFeed\(Boolean\(profileQueryAccountId\), profileQueryAccountId, null, Infinity\)/u);
assert.doesNotMatch(home, /posts\.filter\(\(post\) => post\.authorAccountId === viewedProfileAccount\.id\)/u);

// Notification targets that are not rendered get fetched; a miss shows an error.
assert.match(home, /notificationFetchRef/u);
assert.match(home, /\/noodle\/posts\/\$\{encodeURIComponent\(postId\)\}/u);

// Notifications also cover older posts that received recent interactions.
assert.match(storage, /orderBy\(desc\(noodleInteractions\.createdAt\)\)\s*\.limit\(300\)/u);

// Likes tab: server-side liked-by filter, own query, Load more on every profile tab.
assert.match(hooks, /likedByAccountId=\$\{encodeURIComponent\(likedByAccountId\)\}/u);
assert.match(storage, /options\.likedByAccountId/u);
assert.match(routes, /likedByAccountId\?: string/u);
assert.match(home, /useNoodleFeed\(\s*profileTab === "likes"/u);
assert.match(home, /profileLikesQuery\.data\?\.pages\.flatMap\(\(page\) => page\.interactions\)/u);
assert.doesNotMatch(home, /profileTab !== "likes" && profileListQuery/u);

// Mentions of the viewer's handle in older posts come from a bounded text query.
assert.match(storage, /like\(noodlePosts\.content, `%@\$\{handle/u);
assert.match(storage, /\.limit\(100\)/u);
assert.match(hooks, /\/noodle\/notifications\?handle=/u);

// Own profile has no navigation accountId: queries fall back to the persona account.
assert.match(home, /viewedProfileAccountId \?\? personaAccount\?\.id/u);

// Profile lists keep every page, and an empty Media tab still offers Load more.
assert.match(hooks, /maxPages = 20/);
assert.match(home, /profileVisiblePosts\.length > 0 \|\| profileListQuery\.hasNextPage/);

// Likes order and cursor follow the like itself, and the profile queries' interactions refresh with their data.
assert.match(storage, /orderBy\(desc\(noodleInteractions\.createdAt\), desc\(noodleInteractions\.id\)\)/u);
assert.match(storage, /lt\(noodleInteractions\.createdAt, options\.cursorAt\)/u);
assert.match(storage, /createdAt: lastLike\.likedAt, id: lastLike\.likeId/u);
assert.match(home, /profileFeedQuery\.data,\s*profileLikesQuery\.data,\s*\]\);/u);

assert.doesNotMatch(storage, /noodlePosts\.authorId\b/u);

console.log("Noodle profile and notification unloaded-post regressions passed.");
