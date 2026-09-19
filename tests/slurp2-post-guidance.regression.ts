/**
 * Public and locked posts are written from different directions, that direction is editable at two
 * levels, and the wizard can pick the image workflow the very first post uses.
 *
 * The precedence chain is the part worth running: a Creator override beats the global field, the
 * global field beats the shipped text, and a field that only holds whitespace is not an override.
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import {
  cleanSlurpPostGuidanceDraft,
  sanitizeSlurpPostGuidance,
  selectSlurpPostGuidance,
  SLURP_BUILT_IN_POST_GUIDANCE,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-guidance.js";
import { slurp2Source } from "./slurp2-source";

const pkg = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages");
const read = (path: string) => slurp2Source(join(pkg, path));

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
assert.match(
  SLURP_BUILT_IN_POST_GUIDANCE.public,
  /complete and worthwhile on its own/u,
  "public posts must offer real standalone value rather than being empty ads",
);
assert.match(
  SLURP_BUILT_IN_POST_GUIDANCE.public,
  /do not .* repetitive subscription pitch/u,
  "public direction must prevent every post from becoming a sales pitch",
);
assert.match(
  SLURP_BUILT_IN_POST_GUIDANCE.locked,
  /already subscribed or paid to unlock/u,
  "locked direction must account for subscriptions and one-time unlocks",
);
assert.match(
  SLURP_BUILT_IN_POST_GUIDANCE.locked,
  /Premium does not have to mean sexual/u,
  "premium value must not be reduced to sexual content",
);
assert.match(
  SLURP_BUILT_IN_POST_GUIDANCE.locked,
  /satisfying payoff rather than a preview/u,
  "a paid post must deliver instead of selling another layer",
);

// --- the editor behaves like the other Backstage prompt fields ----------------------------
const guidanceField = read("client/src/components/slurp/SlurpPostGuidanceField.tsx");
assert.match(guidanceField, /<PromptCard/u);
assert.match(guidanceField, /<PromptEditor/u);
assert.doesNotMatch(guidanceField, /onBlur=/u, "post directions must not save implicitly on blur");
assert.match(
  guidanceField,
  /onSuccess: \(result\) => \{\s*setDraft\(result\.guidance\);\s*setOpen\(true\);/u,
  "AI output must open as a reviewable draft instead of saving immediately",
);

// --- draft cleanup ------------------------------------------------------------------------
assert.equal(cleanSlurpPostGuidanceDraft("```text\nTease them.\n```"), "Tease them.");
assert.equal(cleanSlurpPostGuidanceDraft('"Tease them."'), "Tease them.");
assert.equal(cleanSlurpPostGuidanceDraft("  Tease them.  "), "Tease them.");

// --- the prompt actually carries it -------------------------------------------------------
const generation = read("server/src/services/slurp/slurp-generation.service.ts");
assert.match(
  generation,
  /accessInstruction: \[\s*await resolveSlurpPostGuidance\(db, account\.id, input\.request\.access\)/u,
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
const routes = slurp2Source(join(pkg, "server/src/routes/slurp.routes.ts"));
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

// --- a failed image keeps its prompt, so it can be redrawn by hand later ------------------
const images = slurp2Source(join(pkg, "server/src/services/slurp/slurp-images.service.ts"));
assert.doesNotMatch(
  images,
  /imagePrompt: attempts >= SLP_CREATOR_POST_IMAGE_RETRY_LIMIT \? null : undefined/u,
  "spending the automatic retry budget must not delete the prompt the user redraws from",
);
const storage = slurp2Source(join(pkg, "server/src/services/storage/slurp.storage.ts"));
assert.match(
  storage,
  /slpCreatorPostImageRetryAttempts\(metadata\) >= SLP_CREATOR_POST_IMAGE_RETRY_LIMIT\) continue;/u,
  "the automatic pass must stop on the attempt counter, which is what makes deleting the prompt unnecessary",
);

// --- clearing a conversation uses the host file-query API -------------------------------
const messageStorage = read("server/src/services/storage/slurp-messages.storage.ts");
const resetThread = messageStorage.slice(
  messageStorage.indexOf("async resetThread"),
  messageStorage.indexOf("async setThreadNotes"),
);
assert.match(resetThread, /const \[thread\] = await tx\.select\(\)/u);
assert.doesNotMatch(
  resetThread,
  /\.get\(\)/u,
  "the file-backed select builder is awaitable but has no Drizzle-style get() method",
);

// --- image-less posts can generate even when they did not start with an image prompt ----------
const creatorPostCard = slurp2Source(join(pkg, "client/src/components/slurp/SlurpCreatorPostCard.tsx"));
assert.match(
  creatorPostCard,
  /ctx\.generatePostImage && \(\s*<button[\s\S]*?setPromptDraft\(post\.imagePrompt \?\? ""\)/u,
  "the post menu opens the image prompt editor for a new image or a redraw",
);
assert.match(
  routes,
  /if \(post\.imageUrl && parsed\.data\.replace !== true\)/u,
  "the server only redraws an existing image when the client asks to replace it",
);
assert.match(
  routes,
  /if \(previousImageUrl && updated && !updated\.imageUrl\) \{\s*await noodle\.restorePostImageIfUnclaimed\(post\.id, previousImageUrl\);/u,
  "a failed redraw restores the previous image",
);
assert.match(
  routes,
  /if \(imagePrompt !== post\.imagePrompt \|\| previousImageUrl\) \{\s*await noodle\.updatePostMedia\(post\.id, \{ imagePrompt,/u,
  "a missing or rewritten prompt is persisted before generation",
);
assert.match(
  routes,
  /A new social media image for \$\{account\?\.displayName \|\| "the creator"\}/u,
  "a textless or poll-only post still needs a usable fallback prompt when the button is shown",
);

console.log("slurp2 post guidance regression passed");
