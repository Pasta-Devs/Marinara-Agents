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
assert.match(home, /useNoodleFeed\(Boolean\(viewedProfileAccountId\), viewedProfileAccountId\)/u);
assert.doesNotMatch(home, /posts\.filter\(\(post\) => post\.authorAccountId === viewedProfileAccount\.id\)/u);

// Notification targets that are not rendered get fetched; a miss shows an error.
assert.match(home, /notificationFetchRef/u);
assert.match(home, /\/noodle\/posts\/\$\{encodeURIComponent\(postId\)\}/u);

// Notifications also cover older posts that received recent interactions.
assert.match(storage, /orderBy\(desc\(noodleInteractions\.createdAt\)\)\s*\.limit\(300\)/u);

console.log("Noodle profile and notification unloaded-post regressions passed.");
