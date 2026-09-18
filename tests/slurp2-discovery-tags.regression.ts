/**
 * Arcs v2 phase 1: tags are a setting, renames and deletes reach every Creator profile, and a new
 * Creator needs a gender and at least 3 tags.
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import {
  normalizeSlurpDiscoveryTags,
  replaceSlurpDiscoveryTag,
  slurpDiscoveryProfileComplete,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-discovery-profile.ts";
import { slurp2Source } from "./slurp2-source";

// Rename is case-insensitive, merges into an existing tag, and keeps order.
assert.deepEqual(replaceSlurpDiscoveryTag(["Art", "gaming", "music"], "art", "painting"), [
  "painting",
  "gaming",
  "music",
]);
assert.deepEqual(replaceSlurpDiscoveryTag(["art", "gaming"], "art", "gaming"), ["gaming"]);
// Delete removes only that tag; custom tags survive.
assert.deepEqual(replaceSlurpDiscoveryTag(["art", "my custom", "music"], "ART", null), ["my custom", "music"]);
// The setting, not the seed, decides which tags a generated draft may keep.
assert.deepEqual(normalizeSlurpDiscoveryTags(["Art", "new-tag", "gaming"], ["new-tag", "art"]), ["art", "new-tag"]);

assert.equal(slurpDiscoveryProfileComplete({ gender: null, tags: ["a", "b", "c"] }), false);
assert.equal(slurpDiscoveryProfileComplete({ gender: "female", tags: ["a", "b"] }), false);
assert.equal(slurpDiscoveryProfileComplete({ gender: "other", tags: ["a", "b", "c"] }), true);

const pkg = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages");
const storage = slurp2Source(join(pkg, "server/src/services/storage/slurp.storage.ts"));
const replaceBody = storage.slice(storage.indexOf("async replaceDiscoveryTag("));
assert.match(
  replaceBody.slice(0, replaceBody.indexOf("return settings;")),
  /tags: replaceSlurpDiscoveryTag\(tags, from, to\)/u,
  "rename and delete must rewrite every Creator profile",
);
const routes = slurp2Source(join(pkg, "server/src/routes/slurp.routes.ts"));
assert.match(
  routes,
  /stageProfile: slurpStageProfileSchema\.refine\(slurpDiscoveryProfileComplete/u,
  "the create route must reject a missing gender or fewer than 3 tags",
);

console.log("slurp2 discovery tags regression passed");
