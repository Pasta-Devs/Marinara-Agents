import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { slurpArcVoteClosed } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-arc-progress";

// Fix phase 1, batch H (REVIEW-1 feed low + polish): R1-030, R1-031, R1-035, R1-036, R1-037, R1-038,
// R1-040, R1-043, R1-044, R1-045.
const pkg = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages");
const read = (path: string) => readFileSync(join(pkg, path), "utf8");
const en = JSON.parse(read("client/src/slp/locales/en.json")) as Record<string, string>;

// R1-030: a heart on a comment is not a like of the post (feed, Studio, Creator metrics).
assert.match(
  read("server/src/slp/features/viewer/slp-viewer-context.ts"),
  /item\.type === "like" && !item\.parentInteractionId/u,
);
const studio = read("server/src/slp/features/economy/slp-studio-routes.ts");
assert.equal((studio.match(/"like" && !(item|interaction)\.parentInteractionId/gu) ?? []).length, 2);
// R1-031: the open card keeps the count the locked card showed.
assert.match(
  read("client/src/slp/modules/post/SlpPostCard.tsx"),
  /Math\.max\(\(post as \{ replyCount\?: number \}\)\.replyCount \?\? 0, replies\.length\)/u,
);
// R1-035: a closed storyline vote refuses new votes.
const past = new Date(Date.now() - 60_000).toISOString();
const future = new Date(Date.now() + 60_000).toISOString();
assert.equal(slurpArcVoteClosed([{ pollPostId: "p1", pollClosesAt: past }], "p1"), true);
assert.equal(slurpArcVoteClosed([{ pollPostId: "p1", pollClosesAt: future }], "p1"), false);
assert.equal(slurpArcVoteClosed([{ pollPostId: "p1", pollClosesAt: past }], "p2"), false);
assert.match(
  read("server/src/slp/features/feed/slp-feed-post-routes.ts"),
  /if \(slurpArcVoteClosed\(projects, id\)\)/u,
);
// R1-036 / R1-038: the copy says what the code does.
assert.match(en["ui.noodle.noodlerwizard.nightQuietHelp"] ?? "", /23:00 to 07:00/u);
assert.match(en["ui.slurp.settings.postShowMoreLengthDetail"] ?? "", /six lines/u);
// R1-037: Purpose and Delivery say they shape Guide drafts.
assert.match(read("client/src/slp/modules/post/SlpComposerPurpose.tsx"), /ui\.slurp\.composer\.purposeGuideOnly/u);
// R1-040: the Story cutoff moves with a minute clock.
// T: the rail's rings now come from the shared Story-ring state the host computes (SlpHomeHost).
assert.match(read("client/src/slp/app/screens/SlpScreenHub.tsx"), /useSlpMinuteClock\(\)/u);
// The host re-checks once a minute but sets state only when the live set changes (no app-wide tick).
assert.match(
  read("client/src/slp/app/SlpHomeHost.tsx"),
  /slurpLiveStories\(creators \?\? \[\], Date\.now\(\) - lifetimeMs\)[\s\S]{0,200}?key\(previous\) === key\(next\) \? previous : next[\s\S]{0,160}?setInterval\(refresh, 60_000\)/u,
);
// R1-043 / R1-044 / R1-045
assert.doesNotMatch(read("client/src/slp/app/screens/SlpScreenComposer.tsx"), /Shared an image\./u);
assert.match(read("client/src/slp/modules/post/SlpPostMenu.tsx"), /ui\.slurp\.post\.saveImageFailed/u);
assert.match(read("client/src/slp/app/screens/SlpScreenMoments.tsx"), /ui\.slurp\.moments\.subscribePrice/u);

console.log("slurp2 fix1 feed low regression passed");
