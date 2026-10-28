/**
 * Storylines (docs/CONFIGURATOR.md, slice 3 PR 4): one switch for arcs, collabs, rivalries, couples,
 * drama and polyamory. Off: nothing starts or moves on (world tick, catch-up, the drama clock), no
 * arc, collab, rivalry, couple or drama takes a post on either planner, the start routes answer
 * 409, and the Backstage pages and Creator blocks hide. Bonds, brand deals and owed posts are not
 * Storylines' and carry on.
 */
import assert from "node:assert/strict";
import {
  SLP_STORYLINES_OFF,
  slpActionAllowed,
  slpExtensionOn,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-extensions.ts";
import {
  SLP_BACKSTAGE_SETTING_PLACEMENT,
  slpPlacementSwitchedOff,
  slpTargetSwitchedOff,
} from "../packages/slurp2/src/engine/packages/client/src/slp/features/backstage/slp-backstage-placement";
import { slurp2Source } from "./slurp2-source.ts";

const root = "packages/slurp2/src/engine/packages";
const source = (side: "client" | "server" | "shared", path: string) => slurp2Source(`${root}/${side}/src/slp/${path}`);

// The switch and its actions.
assert.equal(slpExtensionOn({ extStorylines: false }, "storylines"), false);
for (const name of ["start-storyline", "start-drama", "set-up-couple", "suggest-collab", "start-rivalry"] as const)
  assert.equal(slpActionAllowed({ extStorylines: false }, name), false, name);
assert.equal(slpActionAllowed({ extStorylines: false }, "set-bond"), true, "bonds are Basic");

// Backstage: the switch is findable; the arc settings hide, shared ideas stay, event automation is Living world's.
assert.equal(SLP_BACKSTAGE_SETTING_PLACEMENT.extStorylines.internal, undefined);
const off = { extStorylines: false, extWorld: true } as never;
const hidden = (key: keyof typeof SLP_BACKSTAGE_SETTING_PLACEMENT, settings = off) =>
  slpPlacementSwitchedOff(key, SLP_BACKSTAGE_SETTING_PLACEMENT[key], settings);
assert.equal(hidden("extStorylines"), false);
for (const key of ["projectRate", "arcAutoMode", "arcLibrary", "drama", "polyamory", "creatorCollabs"] as const)
  assert.equal(hidden(key), true, key);
assert.equal(hidden("sharedPreseed"), false, "shared ideas are Basic");
assert.equal(hidden("storyAutomation"), false);
assert.equal(hidden("storyAutomation", { extStorylines: true, extWorld: false } as never), true);
assert.equal(slpTargetSwitchedOff("arcs", off), true);
assert.equal(slpTargetSwitchedOff("drama", off), true);
assert.equal(slpTargetSwitchedOff("storylines", off), false, "the Storylines page keeps shared ideas");

// Server: the world tick, the ties clock, the drama clock.
const world = source("server", "features/world/slp-world-operation.ts");
assert.match(world, /slpExtensionOn\(settings, "storylines"\) \? await noodle\.listNoodlerAccounts\(\) : \[\]/u);
assert.match(world, /maintenanceDue && slpExtensionOn\(settings, "storylines"\) \? accounts : \[\]/u);
const ties = source("server", "features/projects/slp-creator-ties-service.ts");
assert.match(ties, /const ties = storylinesOn\s*\? slurpAdvanceCreatorTies\(/u);
assert.match(ties, /const couples = storylinesOn\s*\? slurpAdvanceCouples\(/u);
assert.match(
  ties,
  /\{ \.\.\.document\.ties, advancedAt: at\.toISOString\(\) \}/u,
  "bonds and deals keep their 6-hour look",
);
assert.match(ties, /bonds: slurpAdvanceBonds\(/u, "bonds still move");
assert.match(ties, /deals: slurpAdvanceBrandDeals\(/u, "brand deals are Brands & ads'");
assert.match(
  ties,
  /const ties = storylinesOn \? stored\.ties : \{ \.\.\.stored\.ties, collabs: \[\], rivalries: \[\] \};\s*const couples = storylinesOn \? stored\.couples : \[\];/u,
  "the tie beat keeps only deals",
);
const drama = source("server", "features/world/slp-drama-service.ts");
assert.match(drama, /if \(settings\.paused \|\| !slpExtensionOn\(settings, "storylines"\)\) return;/u);
assert.match(
  drama,
  /if \(!slpExtensionOn\(await createSlurpStorage\(db\)\.getSettings\(\), "storylines"\)\) return null;/u,
);
assert.match(
  source("server", "features/world/slp-drama-levers.ts"),
  /"storylines"\)\)\s*return \{ ok: false, status: 409, error: SLP_STORYLINES_OFF \};/u,
);

// Frozen arcs have no effect: earnings, growth, the DM life line, thread mood, fan comments.
for (const [side, path] of [
  ["server", "data/host/slp-storage-context.ts"],
  ["server", "data/projects/slp-projects-storage-1.ts"],
  ["server", "features/creators/slp-chat-context.ts"],
  ["server", "features/messages/slp-thread-stance.ts"],
  ["server", "features/audience/slp-fan-activity-service.ts"],
] as const)
  assert.match(source(side, path), /slpArcsLive\(/u, path);
assert.match(
  source("client", "app/screens/slp-profile-view-model.ts"),
  /!slpExtensionOn\(slurpSettings, "storylines"\) \? null/u,
  "no storyline card or effects on the profile",
);

// Both planners: no arc takes the post.
assert.match(
  source("server", "features/feed/slp-generation-service.ts"),
  /directed \|\| nudge \|\| !slpExtensionOn\(settings, "storylines"\)\s*\? null/u,
);

// Start routes answer 409; ending, declining and editing are not gated.
const gate = /if \(await storylinesOff\(\)\) return reply\.code\(409\)\.send\(\{ error: SLP_STORYLINES_OFF \}\);/gu;
const projects = source("server", "features/projects/slp-projects-routes.ts");
assert.equal(projects.match(gate)?.length, 4, "create, director, generate, template generate");
const tieRoutes = source("server", "features/projects/slp-creator-ties-routes.ts");
assert.equal(tieRoutes.match(gate)?.length, 3, "collab, couple, post-now");
assert.match(
  tieRoutes,
  /\["date", "drama", "patchUp", "reunite"\]\.includes\(parsed\.data\.steer\) && \(await storylinesOff\(\)\)/u,
);
assert.match(tieRoutes, /if \(parsed\.data\.open && \(await storylinesOff\(\)\)\)/u, "a shared page can still close");
assert.match(tieRoutes, /collabs\/:id\/push", async \(req, reply\) =>\s*\(await storylinesOff\(\)\)/u);
assert.match(
  source("server", "features/world/slp-drama-routes.ts"),
  /"storylines"\)\)\s*return reply\.code\(409\)\.send\(\{ error: SLP_STORYLINES_OFF \}\);/u,
);
assert.equal(SLP_STORYLINES_OFF, "Storylines is switched off in Backstage.");

// Client.
const overview = source("client", "features/backstage/SlpBackstageOverviewPanel.tsx");
assert.match(overview, /set: \(on\) => void update\("extStorylines", on\)/u);
const page = source("client", "features/projects/SlpStorylinesPanel.tsx");
assert.match(page, /onChange=\{\(value\) => void updateNow\("extStorylines", value\)\}/u);
assert.match(page, /if \(!slpExtensionOn\(settings, "storylines"\)\)/u);
assert.match(source("client", "features/projects/SlpProjectsPanel.tsx"), /<SlpStorylinesSwitch \{\.\.\.page\} \/>/u);
assert.match(source("client", "features/stir/SlpDramaLovePanel.tsx"), /<SlpStorylinesSwitch \{\.\.\.page\} \/>/u);
const sections = source("client", "features/creators/settings/slp-creator-settings-sections.ts");
assert.equal(sections.match(/extension: "storylines"/gu)?.length, 2, "Storylines and Collaborations blocks");
assert.match(
  source("client", "features/creators/settings/SlpCreatorSettingsTab.tsx"),
  /\(!block\.extension \|\| !settings \|\| slpExtensionOn\(settings, block\.extension\)\)/u,
);
assert.match(
  source("client", "features/messages/SlpThreadView.tsx"),
  /\{storylinesOn && readSlpDramaChoice\(entry\.message\)/u,
);
assert.match(
  source("client", "features/assist/SlpPostGuide.tsx"),
  /\.filter\(\(group\) => storylinesOn \|\| group\.kind !== "storyline"\)/u,
);

console.log("slurp2 ext storylines: ok");
