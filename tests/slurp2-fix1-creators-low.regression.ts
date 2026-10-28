import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Fix phase 1, batch J (REVIEW-1 creators, storylines low + polish): R1-071, R1-074, R1-075, R1-076,
// R1-077, R1-078, R1-079, R1-080, R1-081, R1-082.
const pkg = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages");
const read = (path: string) => readFileSync(join(pkg, path), "utf8");

// R1-071: a storyline that starts gets its first chapter's mood.
const projects1 = read("server/src/slp/data/projects/slp-projects-storage-1.ts");
assert.match(projects1, /const started = after\.status === "active" && before\.status !== "active";/u);
assert.match(projects1, /\(after\.chapter !== before\.chapter \|\| started\) && after\.status !== "complete"/u);
assert.match(
  projects1,
  /this\.recordArcChange\(creatorAccountId, \{ \.\.\.project, status: "suggested" \}, project\);/u,
);
const projects2 = read("server/src/slp/data/projects/slp-projects-storage-2.ts");
assert.match(projects2, /if \(project\.status === "active"\)\s*await this\.recordArcChange/u);
// R1-080: only a started storyline is announced.
assert.match(projects2, /if \(project\.status === "active"\)\s*await this\.recordCreatorEvent\(id, "arc_started"/u);
// R1-074: a persona Creator gets the note, not a switch that fails.
assert.match(
  read("client/src/slp/features/creators/settings/SlpCreatorOverviewSection.tsx"),
  /personaBacked \? \(\s*<p className=\{noteClass\}>/u,
);
// R1-075: a new character Creator is asked about automatic posting.
assert.match(
  read("client/src/slp/app/slp-home-actions.ts"),
  /setAutoPostSetupId\(profile\.id\);\s*setCreationStep\("automatic"\);/u,
);
// R1-076: the day mood is cached per four hours.
assert.match(read("server/src/slp/features/world/slp-day-vibe-service.ts"), /Math\.floor\(at\.getUTCHours\(\) \/ 4\)/u);
// R1-077: SlurpCoins off → price 0, no price on the button, no coin moment.
assert.match(
  read("server/src/slp/data/economy/slp-economy-storage-2.ts"),
  /if \(!settings\.walletEnabled\) return 0;/u,
);
const leading = read("client/src/slp/app/screens/SlpProfileLeadingActions.tsx");
assert.match(leading, /slurpSubscriptionPriceOf\(viewerCreator\) > 0 \? playSlpSpendMoment\(origin\) : undefined/u);
// R1-078: Run now says the source is gone.
assert.equal(
  (read("server/src/slp/features/feed/slp-feed-publishing-routes.ts").match(/Engine character is gone/gu) ?? []).length,
  2,
);
// R1-079: the effects heading comes with its rows.
assert.match(read("client/src/slp/features/projects/SlpArcTimelineCard.tsx"), /\{heading && <p/u);
// R1-081 / R1-082: no English literals left in these spots.
assert.doesNotMatch(read("client/src/slp/features/creators/SlpStageProfileForm.tsx"), /label: "Linked identity"/u);
assert.match(
  read("client/src/slp/features/creators/SlpCreatorRefreshModal.tsx"),
  /t\(`ui\.slurp\.composer\.audience\.\$\{access\}`\)/u,
);
assert.doesNotMatch(
  read("client/src/slp/features/creators/settings/SlpCreatorSettingsSections.tsx"),
  />Loading\.\.\.</u,
);

console.log("slurp2 fix1 creators low regression passed");
