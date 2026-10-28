/**
 * The extension switches (docs/CONFIGURATOR.md, How a real switch works): the one-time migration of
 * older settings, every action's extension, and the gates on server and client. Slice 3 PR 1 wires
 * Brands & ads; the other five switches exist and migrate but have no page yet.
 */
import assert from "node:assert/strict";
import {
  SLP_EXTENSION_KEYS,
  SLP_EXTENSIONS,
  slpBrandDealsPace,
  slpExtensionAllows,
  slpActionAllowed,
  slpActionExtension,
  slpExtensionFromLegacy,
  slpInlineAdsOn,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-extensions.ts";
import { SLP_ACTION_NAMES } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-actions.ts";
import { buildSlpStirPlanMessages } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/assist/slp-stir-plan.ts";
import {
  SLP_BACKSTAGE_SETTING_PLACEMENT,
  slpPlacementSwitchedOff,
} from "../packages/slurp2/src/engine/packages/client/src/slp/features/backstage/slp-backstage-placement";
import { slurp2Source } from "./slurp2-source.ts";

const root = "packages/slurp2/src/engine/packages";
const source = (side: "client" | "server" | "shared", path: string) => slurp2Source(`${root}/${side}/src/slp/${path}`);
const defaults = { inlineAdsEnabled: true, brandDealsPace: "normal" };

// Migration: a fresh install starts on Basic; older settings keep what they had.
for (const id of SLP_EXTENSIONS) assert.equal(slpExtensionFromLegacy(id, {}, defaults), false, `fresh ${id}`);
const legacy = { postsPerDay: 4 };
// Live is new in 0.4.12: an older install keeps it off until the player turns it on.
for (const id of SLP_EXTENSIONS)
  assert.equal(slpExtensionFromLegacy(id, legacy, defaults), id !== "live", `legacy ${id}`);
assert.equal(slpExtensionFromLegacy("ads", { inlineAdsEnabled: false, brandDealsPace: "off" }, defaults), false);
assert.equal(slpExtensionFromLegacy("ads", { inlineAdsEnabled: false }, defaults), true, "deals still on");
assert.equal(slpExtensionFromLegacy("ads", { brandDealsPace: "off" }, defaults), true, "inline ads still on");
const settings = source("server", "modules/settings/slp-settings.ts");
assert.match(
  settings,
  /candidate\[key\] = rawRecord\[key\] \?\? slpExtensionFromLegacy\(id, rawRecord, DEFAULT_SLURP_SETTINGS\)/u,
  "a stored switch wins over the migration",
);
for (const key of Object.values(SLP_EXTENSION_KEYS)) {
  assert.match(settings, new RegExp(`${key}: z\\.boolean\\(\\)`, "u"));
  assert.match(settings, new RegExp(`${key}: false`, "u"), `${key} is off by default`);
}

// Ads: off wins over the ad flags.
const on = { extAds: true, inlineAdsEnabled: true, brandDealsPace: "busy" };
assert.equal(slpInlineAdsOn(on), true);
assert.equal(slpInlineAdsOn({ ...on, extAds: false }), false);
assert.equal(slpInlineAdsOn({ ...on, inlineAdsEnabled: false }), false);
assert.equal(slpBrandDealsPace(on), "busy");
assert.equal(slpBrandDealsPace({ ...on, extAds: false }), "off");

// Every extension action exists; the rest are Basic (null), which is always allowed.
for (const name of SLP_ACTION_NAMES)
  assert.ok(slpActionAllowed({}, name) === (slpActionExtension(name) === null), name);
assert.equal(slpActionExtension("offer-brand-deal"), "ads");
assert.equal(slpActionExtension("write-post"), null);
assert.equal(slpActionAllowed({ extAds: true }, "offer-brand-deal"), true);
assert.equal(slpExtensionAllows({}, null), true);
assert.equal(slpExtensionAllows({}, "ads"), false);
assert.match(
  source("shared", "slp-extensions.ts"),
  /const SLP_EXTENSION_ACTIONS: Partial<Record<SlpExtensionId, readonly SlpActionName\[\]>>/u,
  "the map is typed by action name, so a renamed action fails the typecheck",
);

// Server: the runner, the preview and the Mari list refuse or skip a switched-off action.
const runner = source("server", "features/assist/slp-action-runner.ts");
const refuse =
  /if \(!slpActionAllowed\(await createSlurpStorage\(db\)\.getSettings\(\), name\)\)\s+return \{ ok: false, status: 409, error: "That part of Slurp is switched off in Backstage\." \}/u;
assert.match(runner, refuse, "a run refuses");
assert.match(source("server", "features/assist/slp-action-preview.ts"), refuse, "a preview refuses");
assert.match(runner, /slpActionCatalog\(\)\.filter\(\(action\) => slpActionAllowed\(settings, action\.name\)\)/u);
const routes = source("server", "features/ads/slp-ads-routes.ts");
for (const path of ["/slurp/ads/:id/image", "/slurp/ads/lorebook/sync", "/slurp/ads/generate"]) {
  assert.ok(routes.includes(path), path);
}
assert.ok((routes.match(/adsOff\(/gu) ?? []).length >= 3, "the ad routes refuse while ads is off");

// The planner drops switched-off actions and the brand section with them.
const plan = (extAds: boolean) =>
  buildSlpStirPlanMessages({
    text: "Bepis sponsors Mira",
    creators: [{ id: "mira", name: "Mira", handle: "mira", automatic: true }],
    world: { couples: [], collabs: [], rivalries: [], events: [], storylines: [] },
    extensions: { extAds },
    brands: [{ id: "brand-bepis", name: "Bepis", products: [] }],
  });
const text = (extAds: boolean) =>
  plan(extAds)
    .map((message) => message.content)
    .join("\n");
assert.match(text(true), /- offer-brand-deal:/u);
assert.match(text(true), /# Brands/u);
assert.doesNotMatch(text(false), /offer-brand-deal/u, "no action, no rule line");
assert.doesNotMatch(text(false), /# Brands/u);
assert.match(source("server", "features/assist/slp-stir-service.ts"), /extensions: settings/u);

// Client: the Stir deck, the desk composer and the search follow the switch.
// The deck file pulls in icons, so it is read, not imported.
assert.match(
  source("client", "features/stir/slp-stir-deck.ts"),
  /!settings \|\| slpActionAllowed\(settings, action\)/u,
);
assert.match(source("client", "features/stir/SlpStirScreen.tsx"), /slpStirDeckOn\(/u);
assert.match(source("client", "features/messages/SlpDeskComposer.tsx"), /slpActionAllowed\(settings, action\)/u);
const off = { extAds: false } as Parameters<typeof slpPlacementSwitchedOff>[2];
const ad = SLP_BACKSTAGE_SETTING_PLACEMENT.inlineAdsEnabled;
assert.equal(ad.target, "ads");
assert.equal(slpPlacementSwitchedOff("inlineAdsEnabled", ad, off), true, "ad settings hide from search");
assert.equal(slpPlacementSwitchedOff("extAds", SLP_BACKSTAGE_SETTING_PLACEMENT.extAds, off), false, "its switch stays");
assert.equal(slpPlacementSwitchedOff("inlineAdsEnabled", ad, { ...off, extAds: true }), false);
assert.equal(slpPlacementSwitchedOff("inlineAdsEnabled", ad, undefined), false);
assert.match(source("client", "features/backstage/SlpBackstageNavigation.tsx"), /!slpPlacementSwitchedOff\(/u);
const panel = source("client", "features/ads/SlpAdsPanel.tsx");
assert.match(panel, /settingKey="extAds"/u);
assert.match(source("client", "modules/settings/SlpExtensionSwitch.tsx"), /ui\.slurp\.settings\.ext\.offNote/u);
assert.match(source("client", "features/backstage/SlpBackstageOverviewPanel.tsx"), /update\("extAds", /u);
assert.match(
  source("client", "features/settings/slp-settings-defaults.ts"),
  /"extAds"/u,
  "Reset leaves switches alone",
);

// The page switch saves at once like the Overview row; a staged Off was lost on leaving the page.
assert.match(
  source("client", "features/settings/slp-settings-backstage-contract.ts"),
  /if \(!now && section !== "overview"/u,
);
assert.match(panel, /updateNow\("extAds", value\)/u);

console.log("slurp2 extensions regression passed");
