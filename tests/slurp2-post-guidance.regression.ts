/**
 * Public and locked posts are written from different directions, that direction is editable at two
 * levels, and the wizard can pick the image workflow the very first post uses.
 *
 * The precedence chain is the part worth running: a Creator override beats the global field, the
 * global field beats the shipped text, and a field that only holds whitespace is not an override.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  cleanSlurpPostGuidanceDraft,
  sanitizeSlurpPostGuidance,
  selectSlurpPostGuidance,
  SLURP_BUILT_IN_POST_GUIDANCE,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-post-guidance.js";

const pkg = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages");
const read = (path: string) => readFileSync(join(pkg, path), "utf8");

// --- precedence ---------------------------------------------------------------------------
const guidance = sanitizeSlurpPostGuidance({
  defaults: { public: "global public", locked: "global locked" },
  creators: { alice: { public: "alice public", locked: "   " } },
});
assert.equal(selectSlurpPostGuidance(guidance, "alice", "public"), "alice public");
assert.equal(
  selectSlurpPostGuidance(guidance, "alice", "locked"),
  "global locked",
  "a blank override must fall through to the global field, not blank the direction",
);
assert.equal(selectSlurpPostGuidance(guidance, "bob", "public"), "global public");
assert.equal(
  selectSlurpPostGuidance(sanitizeSlurpPostGuidance({}), "bob", "locked"),
  SLURP_BUILT_IN_POST_GUIDANCE.locked,
  "an install that has never been configured still differentiates the two access types",
);
// An override made entirely of whitespace is dropped rather than stored forever.
assert.deepEqual(sanitizeSlurpPostGuidance({ creators: { ghost: { public: " ", locked: "" } } }).creators, {});
assert.notEqual(SLURP_BUILT_IN_POST_GUIDANCE.public, SLURP_BUILT_IN_POST_GUIDANCE.locked);

// --- draft cleanup ------------------------------------------------------------------------
assert.equal(cleanSlurpPostGuidanceDraft("```text\nTease them.\n```"), "Tease them.");
assert.equal(cleanSlurpPostGuidanceDraft('"Tease them."'), "Tease them.");
assert.equal(cleanSlurpPostGuidanceDraft("  Tease them.  "), "Tease them.");

// --- the prompt actually carries it -------------------------------------------------------
const generation = read("server/src/services/slurp/slurp-generation.service.ts");
assert.match(
  generation,
  /accessInstruction: await resolveSlurpPostGuidance\(db, account\.id, input\.request\.access\)/u,
  "the post prompt must resolve guidance for the access this post is being written at",
);
assert.match(
  generation,
  /input\.accessInstruction\?\.trim\(\)[\s\S]{0,200}Who can read this post/u,
  "the resolved direction must reach the system prompt, fenced like the other editable text",
);

// --- the wizard assigns the image workflow before the first post --------------------------
const wizard = read("client/src/components/slurp/SlurpOnboardingPanel.tsx");
const assignAt = wizard.indexOf("assignImageConnections.mutateAsync");
const enqueueAt = wizard.indexOf("enqueueFirstPosts.mutateAsync");
assert.ok(assignAt > 0 && enqueueAt > 0, "the wizard must both assign an image connection and queue first posts");
assert.ok(
  assignAt < enqueueAt,
  "the image connection must be mapped before the first posts are queued, or the first post uses the default",
);
assert.match(
  wizard,
  /connection\.provider === "image_generation"/u,
  "the wizard image picker must list image connections, not text ones",
);

// --- a saved post image carries a name and the right extension ----------------------------
const routes = readFileSync(join(pkg, "server/src/routes/slurp.routes.ts"), "utf8");
const mediaRoute = routes.slice(
  routes.indexOf('app.get("/noodler/posts/:id/media"'),
  routes.indexOf("/**", routes.indexOf('app.get("/noodler/posts/:id/media"')),
);
assert.match(
  mediaRoute,
  /Content-Disposition", `inline; filename="slurp-\$\{id\}\$\{extname/u,
  "saving a post image must produce slurp-<id>.<real extension>, not an extensionless file",
);
assert.equal(
  (mediaRoute.match(/Content-Disposition/gu) ?? []).length,
  2,
  "the locked teaser is served from its own branch and needs the same name",
);

console.log("slurp2 post guidance regression passed");
