import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { slurp2Source } from "./slurp2-source";

// Sharing a post, and reporting one. Share used to go straight back to the post's own author —
// the one chat a reader never means — and the report menu offered six reasons and no icon.

const homeState = slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/app/slp-home-state.ts");
assert.match(
  homeState,
  /sharePost: viewerPersonaId \? \(post: SlpPostCardModel\) => setSharingPost\(post\)/u,
  "Share must open the chat picker",
);
assert.doesNotMatch(
  homeState,
  /creatorAccountId: post\.authorAccountId/u,
  "Share must not post straight to the post's author",
);

const picker = slurp2Source(
  "packages/slurp2/src/engine/packages/client/src/slp/features/messages/SlpSharePostModal.tsx",
);
assert.match(picker, /shareSearch/u, "the picker needs a search field");
assert.match(picker, /shareNewChat/u, "the picker needs a New chat button");

// A locked post travels as a teaser. Its body used to ride along in the metadata, where the
// bubble hides it but a reader of the response does not.
const shareRoute = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/features/messages/slp-messages-send-routes.ts",
);
assert.match(
  shareRoute,
  /content: locked \? "" : post\.content/u,
  "a locked post must not carry its body into a share",
);
assert.doesNotMatch(
  shareRoute,
  /post\.authorAccountId !== creator\.id\)?\s*\n?\s*return reply\.code\(404\)/u,
  "a post must be shareable into a chat other than its author's",
);

// Every reason the modal offers has to be one the route accepts.
const hooks = slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/modules/post/slp-post-action-hooks.ts");
const postRoutes = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-feed-post-routes.ts",
);
const listed = [...hooks.matchAll(/^\s*"([a-z_]+)",$/gmu)].map((match) => match[1]!);
assert.ok(listed.length >= 12, "the report modal must offer a real social network's range of reasons");
const accepted = postRoutes.slice(postRoutes.indexOf("reason: z.enum("));
for (const reason of listed) {
  assert.ok(accepted.includes(`"${reason}"`), `the report route must accept "${reason}"`);
}
for (const slurpSpecific of ["impersonation", "leaked_paid", "underage"]) {
  assert.ok(listed.includes(slurpSpecific), `the reasons must include the Slurp-specific "${slurpSpecific}"`);
}

const menu = slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/modules/post/SlpPostMenu.tsx");
assert.match(
  menu,
  /<Flag size=\{14\} \/>\s*\n\s*\{localizeUi\("ui\.slurp\.post\.report"/u,
  "the report item needs its icon",
);

// Every string the new surfaces ask for has to exist in the shipped locale.
const locale = JSON.parse(
  readFileSync("packages/slurp2/src/engine/packages/client/src/slp/locales/en.json", "utf8"),
) as Record<string, string>;
for (const key of [
  ...listed.map((reason) => `ui.slurp.post.reportReasons.${reason}`),
  "ui.slurp.post.shareNewChat",
  "ui.slurp.messages.requestFanReply",
]) {
  assert.ok(locale[key], `en.json is missing ${key}`);
}

// "Request a reply" exists on both sides of a chat now: the fan asks the Creator, and the player
// playing the Creator asks the fan.
const composer = slurp2Source(
  "packages/slurp2/src/engine/packages/client/src/slp/features/messages/SlpThreadComposer.tsx",
);
assert.match(composer, /toolTab === "request" && ownsCreator/u, "the Creator side needs the request tool");
assert.match(composer, /toolTab === "request" && !ownsCreator/u, "the fan side keeps the request tool");
const creatorRoutes = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/features/messages/slp-messages-creator-routes.ts",
);
assert.match(creatorRoutes, /request-fan-reply/u, "the fan-reply route must exist");
assert.match(
  creatorRoutes,
  /ownsCreator\(parsed\.data\.personaId, creatorAccountId\)/u,
  "only the Creator's owner may ask the fan for a reply",
);

// A Creator has to look like herself. With both image-identity switches off, no avatar reached
// the image model and the linked card's appearance was never read, so likeness rested on one text
// field that is empty for any Creator drafted from a card without an Appearance.
const settings = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/modules/settings/slp-settings.ts");
assert.match(settings, /imageGenerationUseAvatarReferences: true,/u, "avatar references must be on by default");
assert.match(settings, /imageGenerationIncludeDescriptions: true,/u, "source descriptions must be on by default");

console.log("slurp2-share-report regression passed");
