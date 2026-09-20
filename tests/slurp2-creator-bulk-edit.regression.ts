/**
 * Creator bulk edit and the rebuilt Tags page: one bounded route writes gender, tags, auto-post and
 * images for many Creators, and the Tags page edits in place instead of through browser prompts.
 */
import assert from "node:assert/strict";
import {
  normalizeSlurpDiscoveryTags,
  SLURP_DISCOVERY_TAG_LIMIT,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/discovery/slp-discovery-profile.js";
import { slurp2BackstageSource } from "./slurp2-backstage-source";
import { slurp2Source } from "./slurp2-source";

const root = "packages/slurp2/src/engine/packages/";
const read = (path: string) => slurp2Source(root + path);
const routes = read("server/src/routes/slurp.routes.ts");
const storage = read("server/src/services/storage/slurp.storage.ts");
const settings = slurp2BackstageSource();
const tagsPage = read("client/src/components/slurp/SlurpTagsSettings.tsx");
const bulkEdit = read("client/src/components/slurp/SlurpCreatorBulkEdit.tsx");
const en = JSON.parse(read("client/src/localization/locales/en.json")) as Record<string, string>;

// Route: bounded, strict, and never an empty patch.
const routeStart = routes.indexOf('app.post("/slurp/accounts/bulk-update"');
assert.ok(routeStart >= 0, "bulk-update route exists");
const route = routes.slice(routeStart, routes.indexOf("\n  });", routeStart));
assert.match(route, /\.max\(500\)/u);
assert.match(route, /\.strict\(\)/u);
assert.match(route, /Nothing to change\./u);

// Storage: one transaction, viewer actors untouched, persona Creators never switched to auto-post.
const methodStart = storage.indexOf("async bulkUpdateCreatorProfiles(");
assert.ok(methodStart >= 0, "bulk storage method exists");
const method = storage.slice(methodStart, storage.indexOf("async deleteAllSlurpData(", methodStart));
assert.match(method, /db\.transaction/u);
assert.match(method, /isSlurpViewerActorAccount/u);
assert.match(method, /row\.sourceKind === "persona" && row\.kind === "persona"/u);
assert.match(method, /normalizeSlurpDiscoveryTags\(candidate\)/u);

// Adding tags past the limit keeps the first eight, which the method reports as tagLimitReached.
assert.equal(
  normalizeSlurpDiscoveryTags(Array.from({ length: 10 }, (_, index) => `tag${index}`)).length,
  SLURP_DISCOVERY_TAG_LIMIT,
);

// Tags page: no browser prompts, and the filter label is positioned so Firefox does not scroll on focus.
assert.match(settings, /<SlurpTagsSettings/u);
assert.doesNotMatch(tagsPage, /window\.(prompt|confirm)\(/u);
assert.match(tagsPage, /<label className="relative flex/u);

// Creators tab: select mode, the bulk panel, and a quick edit that uses the same route.
assert.match(settings, /<SlurpCreatorBulkEdit/u);
assert.match(settings, /<SlurpDiscoveryProfileEditor/u);
assert.match(settings, /ids: \[selectedCreator\.id\]/u);
assert.match(read("client/src/hooks/use-slurp.ts"), /"\/slurp2\/slurp\/accounts\/bulk-update"/u);

// Every literal key the new UI uses exists in English (plural keys may only have _one/_other).
for (const source of [tagsPage, bulkEdit, settings]) {
  for (const match of source.matchAll(/t\(\s*"(ui\.slurp\.settings\.(?:tags|creators)\.[\w.]+)"/gu)) {
    const key = match[1]!;
    assert.ok(en[key] ?? en[`${key}_one`], `missing en key ${key}`);
  }
}

console.log("slurp2 creator bulk edit regression passed");
