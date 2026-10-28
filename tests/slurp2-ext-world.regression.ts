/**
 * Living world (docs/CONFIGURATOR.md, slice 3 PR 2): off, no platform event or trend runs or shows,
 * while the saved events and trends stay. Both tick lists run the same systems.
 */
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  slpActionAllowed,
  slpLiveEvents,
  slpTrendsOn,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-extensions.ts";
import {
  SLP_BACKSTAGE_SETTING_PLACEMENT,
  slpPlacementSwitchedOff,
  slpTargetSwitchedOff,
} from "../packages/slurp2/src/engine/packages/client/src/slp/features/backstage/slp-backstage-placement";
import { slurp2Source } from "./slurp2-source.ts";

const root = "packages/slurp2/src/engine/packages";
const source = (side: "client" | "server" | "shared", path: string) => slurp2Source(`${root}/${side}/src/slp/${path}`);

// The helpers: off empties the effects, never the saved list.
const events = [{ id: "e1" }];
assert.deepEqual(slpLiveEvents({ extWorld: true, platformEvents: events }), events);
assert.deepEqual(slpLiveEvents({ extWorld: false, platformEvents: events }), []);
// An imported pack switched off keeps its events saved, but they have no effect (PR 5b).
const packed = [{ id: "bread", provenance: { packId: "bakery-pack" } }, { id: "core" }];
assert.deepEqual(
  slpLiveEvents({ extWorld: true, platformEvents: packed, contentPacks: { "bakery-pack": false } }).map(
    (event) => event.id,
  ),
  ["core"],
);
assert.equal(slpTrendsOn({ extWorld: true, trendsEnabled: true }), true);
assert.equal(slpTrendsOn({ extWorld: true, trendsEnabled: false }), false);
assert.equal(slpTrendsOn({ extWorld: false, trendsEnabled: true }), false);
for (const name of ["start-event", "invent-event", "start-trend", "steer-trend", "list-world"] as const) {
  assert.equal(slpActionAllowed({ extWorld: false }, name), false, name);
}
const settings = source("server", "modules/settings/slp-settings.ts");
assert.match(settings, /trendsEnabled: z\.boolean\(\)/u);
assert.match(settings, /trendsEnabled: true,/u, "trends stay on inside a switched-on Living world");

// Every server reader of `.platformEvents` is an editor (writes or lists the saved events) or reads
// through `slpLiveEvents`. A new effect reader must use the helper.
const EDITORS = new Set([
  "modules/settings/slp-settings.ts",
  "features/world/slp-story-routes.ts",
  "features/assist/slp-stir-levers.ts",
  "features/assist/slp-action-preview.ts",
  "features/feed/slp-shared-preseed-service.ts",
  "data/world/slp-story-engine-storage.ts",
  "features/messages/slp-message-generation-service.ts",
  "features/messages/slp-reply-generation-service.ts",
  // Fills a missing list before slpLiveEvents (its settings are a Pick); pinned below.
  "features/audience/slp-fan-activity-operation.ts",
]);
const serverRoot = `${root}/server/src/slp`;
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith(".ts") ? [path] : [];
  });
const readers = walk(serverRoot)
  .map((path) => path.slice(serverRoot.length + 1))
  .filter((path) => /settings\w*\.platformEvents\b/u.test(slurp2Source(`${serverRoot}/${path}`)));
assert.deepEqual(
  readers.filter((path) => !EDITORS.has(path)),
  [],
  "an effect reads settings.platformEvents directly; read slpLiveEvents(settings)",
);
const storyStorage = source("server", "data/world/slp-story-engine-storage.ts");
assert.match(
  storyStorage,
  /const events = slurpInfluenceMultiplier\(\s+slpLiveEvents\(settings\),/u,
  "reach and rates",
);
for (const path of [
  "data/economy/slp-economy-storage-1.ts",
  "data/economy/slp-economy-storage-2.ts",
  "data/host/slp-storage-context.ts",
  "features/audience/slp-fan-activity-operation.ts",
  "features/creators/slp-signals-service.ts",
  "features/feed/slp-occasion-service.ts",
  "features/messages/slp-thread-stance.ts",
  "features/maintenance/slp-maintenance-routes.ts",
]) {
  assert.match(source("server", path), /slpLiveEvents\(/u, path);
}
const context = source("server", "features/world/slp-story-context.ts");
assert.match(context, /slpLiveEvents\(settings\),/u);
assert.match(context, /\{ occurrences: world \? occurrences : \[\], facts \}/u, "started occasions too; facts stay");
assert.match(
  storyStorage,
  /async reconcileStoryEvents[\s\S]*?if \(!slpExtensionOn\(settings, "world"\)\) return existing;/u,
  "occurrences wait while Living world is off",
);
assert.match(
  source("server", "features/feed/slp-generation-service.ts"),
  /worldEvents: settings\.sharedWorldEvents && slpExtensionOn\(settings, "world"\)/u,
);
assert.match(
  source("server", "features/world/slp-story-routes.ts"),
  /if \(!slpExtensionOn\(await noodle\.getSettings\(\), "world"\)\)\s+return reply\.code\(409\)/u,
);

// Trends: no trend starts (every starter goes through startSlurpTrend), is scanned, joined or listed.
const trends = source("server", "features/discovery/slp-trends-service.ts");
assert.match(
  trends,
  /const trendsOn = async \(db: DB\) => slpTrendsOn\(await createSlurpStorage\(db\)\.getSettings\(\)\);/u,
);
assert.equal((trends.match(/!\(await trendsOn\(db\)\)/gu) ?? []).length, 4, "start, scan, join, list");

// Both tick lists name the same systems (the scheduler and the catch-up on open).
const SYSTEM = /\b((?:advance|textSlurp|topUpSlurp|drainSlurp)\w*)\(app\.db/gu;
const systems = (text: string) => new Set([...text.matchAll(SYSTEM)].map((match) => match[1]));
const scheduler = systems(source("server", "features/world/slp-world-scheduler-service.ts"));
const catchUp = systems(source("server", "workflows/slp-world-tick-workflow.ts"));
assert.ok(scheduler.has("advanceSlurpTrends") && scheduler.size >= 9, [...scheduler].join());
assert.deepEqual([...catchUp].sort(), [...scheduler].sort(), "the two tick lists run the same systems");

// Client: the pages, Overview, search and the post chip follow the switch.
const off = { extAds: true, extWorld: false } as Parameters<typeof slpPlacementSwitchedOff>[2];
const P = SLP_BACKSTAGE_SETTING_PLACEMENT;
assert.equal(slpPlacementSwitchedOff("platformEvents", P.platformEvents, off), true);
assert.equal(slpPlacementSwitchedOff("trendsEnabled", P.trendsEnabled, off), true);
assert.equal(slpPlacementSwitchedOff("sharedWorldEvents", P.sharedWorldEvents, off), true, "lives on Storylines");
assert.equal(slpPlacementSwitchedOff("extWorld", P.extWorld, off), false, "its switch stays findable");
assert.equal(P.extWorld.internal, undefined, "the switch is a real setting now");
assert.equal(slpPlacementSwitchedOff("platformEvents", P.platformEvents, { ...off, extWorld: true }), false);
const eventsPanel = source("client", "features/world/SlpWorldEventsPanel.tsx");
assert.match(eventsPanel, /settingKey="extWorld"/u);
assert.match(eventsPanel, /settingKey="trendsEnabled"/u);
assert.match(eventsPanel, /if \(!slpExtensionOn\(settings, "world"\)\)\s+return \(/u);
assert.match(
  source("client", "features/world/SlpCalendarPanel.tsx"),
  /if \(!slpExtensionOn\(page\.settings, "world"\)\)/u,
);
assert.match(source("client", "features/backstage/SlpBackstageOverviewPanel.tsx"), /update\("extWorld", on\)/u);
assert.match(
  source("client", "app/slp-home-state.ts"),
  /trendsShown: Boolean\(slurpSettingsQuery\.data && slpTrendsOn\(slurpSettingsQuery\.data\)\)/u,
);
assert.match(source("client", "modules/post/SlpPostCard.tsx"), /ctx\.trendsShown !== false && \(/u);
// The ads page uses the same switch component.
assert.match(source("client", "features/ads/SlpAdsPanel.tsx"), /<SlpExtensionSwitch\s+settingKey="extAds"/u);
// Page switches save at once like the Overview row; a staged Off was lost on leaving the page.
assert.match(
  source("client", "features/settings/slp-settings-backstage-contract.ts"),
  /if \(!now && section !== "overview"/u,
);
assert.match(source("client", "features/ads/SlpAdsPanel.tsx"), /updateNow\("extAds", value\)/u);
for (const key of ["extWorld", "trendsEnabled"]) {
  assert.match(eventsPanel, new RegExp(`updateNow\\("${key}", value\\)`, "u"), key);
}

// Live check: Stir suggested "Start <event> now?" with Living world off. Its one event list is gated,
// so the live list, suggestions and planner lose events together; owed #ad posts follow Brands & ads.
assert.match(source("server", "features/assist/slp-stir-levers.ts"), /events: slpLiveEvents\(settings\)/u);
assert.match(
  source("server", "features/assist/slp-stir-service.ts"),
  /owed: document\.deals\s+\.filter\(\s*\(deal\) => slpExtensionOn\(settings, "ads"\)/u,
);
// A switched-off page holds only its instant switch, so the header must not say "wait for Apply".
assert.equal(slpTargetSwitchedOff("calendar", { extAds: true, extWorld: false } as never), true);
assert.equal(slpTargetSwitchedOff("calendar", { extAds: true, extWorld: true } as never), false);
assert.equal(slpTargetSwitchedOff("basic", { extAds: false, extWorld: false } as never), false);
assert.match(source("client", "app/backstage/SlpBackstageShell.tsx"), /slpTargetSwitchedOff\(target, settings\)/u);
// The Calendar page keeps its switch while Living world is on, like the Events page.
assert.match(
  source("client", "features/world/SlpCalendarPanel.tsx"),
  /<SlpWorldSwitch \{\.\.\.page\} \/>\s+<SlpCalendarBody/u,
);

// Review: Viral trends off inside a switched-on Living world takes the trend actions too.
for (const name of ["start-trend", "steer-trend"] as const) {
  assert.equal(slpActionAllowed({ extWorld: true, trendsEnabled: false }, name), false, name);
  assert.equal(slpActionAllowed({ extWorld: true, trendsEnabled: true }, name), true, name);
}
assert.equal(slpActionAllowed({ extWorld: true, trendsEnabled: false }, "start-event"), true);
// Review: a started occasion makes its own window, so the occasion service drops occurrences too.
assert.match(
  source("server", "features/feed/slp-occasion-service.ts"),
  /slpExtensionOn\(settings, "world"\) \? occurrences : \[\]/u,
);
// Review: activating an occurrence is the world running; ending or dismissing stays open.
assert.match(
  source("server", "features/world/slp-story-routes.ts"),
  /const starting = body\.data\.status === "active";\s+if \(starting && !slpExtensionOn\(await noodle\.getSettings\(\), "world"\)\)/u,
);
// Review: a switch drops cached trends and Stir reads at once.
assert.match(
  source("client", "features/settings/slp-settings-hooks.ts"),
  /key\.startsWith\("ext"\) \|\| key === "trendsEnabled"[\s\S]*?invalidateQueries\(\{ queryKey: slpKeys\.noodlerRoot\(\) \}\)/u,
);

console.log("slurp2 Living world regression passed");
