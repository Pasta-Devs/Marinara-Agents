import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Fix phase 1, batch D (REVIEW-1 stale UI after actions): R1-021, R1-022, R1-023, R1-032, R1-033, R1-041,
// R1-042, R1-065, R1-072, R1-084, R1-093, R1-098. The hooks import the Engine api client, so these are
// source pins of the shared refresh paths, not a render.
const pkg = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages");
const read = (path: string) => readFileSync(join(pkg, path), "utf8");
const viewerHooks = read("client/src/slp/features/feed/slp-feed-viewer-hooks.ts");
const postHooks = read("client/src/slp/features/feed/slp-feed-post-hooks.ts");
const hub = read("client/src/slp/app/screens/SlpScreenHub.tsx");

// ── R1-022 / R1-023 / R1-093: one refresh after every post action: feed (all loaded pages once),
// profile queries, wallets ──
const refresh = viewerHooks.slice(viewerHooks.indexOf("export function refreshSlpPostViews"));
assert.match(refresh, /slpFeedDeepReload\.add\(personaId\);\s*markSlpProfilePostsStale\(\);/u);
assert.match(refresh, /queryKey: \[\.\.\.slpKeys\.noodlerRoot\(\), "posts"\]/u);
assert.match(refresh, /queryKey: \[\.\.\.slpKeys\.noodlerRoot\(\), "viewer-wallets"\]/u);
assert.match(viewerHooks, /const deep = slpFeedDeepReload\.delete\(personaId!\);/u);
assert.match(viewerHooks, /return deep \? fresh : mergeSlpFeedFirstPage\(/u);
// Every post action uses it: unlock, gamble, like, unlike, reply, creator reply, edit, delete.
assert.ok((viewerHooks.match(/refreshSlpPostViews\(qc, input\.personaId\)/gu) ?? []).length >= 7);
assert.doesNotMatch(
  viewerHooks,
  /onSettled: \(_result, _error, input\) => qc\.invalidateQueries\(\{ queryKey: slpKeys\.viewer\(input\.personaId\) \}\)/u,
);
// Edit and delete match a profile card by either copy of the post.
assert.match(postHooks, /export const slpProfilePostId = \(item: SlurpProfilePost\) =>/u);
assert.match(postHooks, /current\?\.filter\(\(item\) => slpProfilePostId\(item\) !== input\.id\)/u);
assert.equal(
  (
    postHooks.match(
      /markSlpProfilePostsStale\(\);\s*void qc\.invalidateQueries\(\{ queryKey: slpKeys\.noodlerPosts\(input\.accountId\) \}\)/gu,
    ) ?? []
  ).length,
  2,
);

// ── R1-041: the profile poll reads page one and keeps older posts ──
assert.match(postHooks, /const firstPageOnly = Boolean\(cached\) && !slpProfilePostsStale;/u);
assert.match(
  postHooks,
  /if \(firstPageOnly\) return mergeSlpProfileFirstPage\(cached!, first\.items, Boolean\(first\.nextCursor\)\);/u,
);
// A cold profile answers with page one and fills older pages in the background; a post action
// meanwhile (delete, edit) bumps the generation, so the stale fill is dropped, not merged.
assert.match(postHooks, /if \(generation !== slpProfilePostsGeneration\) return;/u);
assert.match(postHooks, /qc\.setQueryData<SlurpProfilePost\[\]>\(queryKey,[\s\S]{0,200}?\.\.\.rest\.filter/u);

// ── R1-084 / R1-032 / R1-042: search and Following are server-paged; Load more and totals follow ──
assert.match(
  viewerHooks,
  /export function useSlurpViewerFeedSlice\(personaId: string \| null, tab: "following" \| "all", search: string\)/u,
);
assert.match(viewerHooks, /&tab=\$\{tab\}&limit=20\$\{\s*term \? `&search=\$\{encodeURIComponent\(term\)\}` : ""/u);
assert.match(hub, /const fullFeed = !searchTerm && sliceItems \? sliceItems : derivedFeed;/u);
assert.match(hub, /const searchResults = searchTerm && sliceItems \? sliceItems : derivedSearchResults;/u);
assert.match(hub, /if \(await loadMoreFeed\(\)\)/u);
assert.match(hub, /total=\{Math\.max\(feed\.length, serverTotal \?\? 0\)\}/u);
assert.doesNotMatch(hub, /Math\.max\(feed\.length \+ 1, visibleFeed\.length \+ 1\)/u, "no invented total");

// ── R1-021 / R1-033: own Creator without the source id; no Report on own posts ──
assert.match(
  read("server/src/slp/features/viewer/slp-viewer-context.ts"),
  /ownedByViewer: creatorBelongsToViewer\(account, context\.viewer\),/u,
);
assert.equal((hub.match(/ownedByViewer === true/gu) ?? []).length, 3);
assert.doesNotMatch(hub, /profile\.sourceAccountId [!=]== scope\?\.viewer/u);
assert.match(
  read("client/src/slp/modules/post/SlpPostMenu.tsx"),
  /!slpIsOwnActor\(ctx\.personaAccount, post\.authorAccountId\)/u,
);

// ── R1-065: only the Studio's first read of a visit moves the mark; the rest compare to its baseline ──
const studio = read("server/src/slp/features/economy/slp-studio-routes.ts");
assert.match(studio, /const visit = markVisit === "1";/u);
assert.match(studio, /const snapshot = visit \? stored : \(stored\?\.baseline \?\? stored\);/u);
assert.match(studio, /if \(!visit\) return \{ since: snapshot\?\.at \?\? null, creators \};/u);
assert.match(
  studio,
  /baseline: stored\s*\?\s*\{ at: stored\.at, platformScale: stored\.platformScale, creators: stored\.creators(?:, platform: true)? \}\s*: null,/u,
);
const economyHooks = read("client/src/slp/features/economy/slp-economy-hooks.ts");
assert.match(economyHooks, /const mark = markVisit && !marked\.current;/u);
// W: the Studio page became the own profile's Dashboard sheet (same read, one visit per opening).
assert.match(read("client/src/slp/app/screens/SlpDashboard.tsx"), /useSlurpStudio\(personaId, true, true\)/u);
assert.match(read("client/src/slp/app/screens/SlpScreenWallet.tsx"), /useSlurpStudio\(personaId\)/u);

// ── R1-072: following moves the profile's follower count and list ──
assert.match(
  viewerHooks,
  /slpKeys\.noodlerConnectionCounts\(\) \}\);\s*void qc\.invalidateQueries\(\{ queryKey: slpKeys\.noodlerFollowers\(input\.creatorAccountId\) \}\)/u,
);

// ── R1-093 / R1-098: an ad tap and a Wallet read refresh the balance chip ──
assert.match(
  read("client/src/slp/features/ads/slp-ads-hooks.ts"),
  /useRecordSlurpAdAction[\s\S]{0,900}"viewer-wallets"/u,
);
assert.match(economyHooks, /Reading the wallet renews due subscriptions[\s\S]{0,120}"viewer-wallets"/u);

console.log("slurp2 fix1 stale UI regression passed");
