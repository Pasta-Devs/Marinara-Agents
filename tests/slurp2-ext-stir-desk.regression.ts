/**
 * Stir and Support desk (docs/CONFIGURATOR.md, slice 3 PR 3): two switches on one Backstage page.
 * Stir off: no planner, no Stir tab doors, no box or levers in the ✦ sheet (its steering stays).
 * Support desk off: no tick, no case-file changes, no desk prompt, no desk routes; Support's threads
 * move into the inbox and Support still talks (the sign-up chat is Basic).
 */
import assert from "node:assert/strict";
import {
  slpActionAllowed,
  slpExtensionOn,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-extensions.ts";
import {
  SLP_BACKSTAGE_SETTING_PLACEMENT,
  slpPlacementSwitchedOff,
  slpTargetSwitchedOff,
} from "../packages/slurp2/src/engine/packages/client/src/slp/features/backstage/slp-backstage-placement";
import { slurpDmRoleHeader } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-dm-roles.ts";
import { slurp2Source } from "./slurp2-source.ts";

const root = "packages/slurp2/src/engine/packages";
const source = (side: "client" | "server" | "shared", path: string) => slurp2Source(`${root}/${side}/src/slp/${path}`);

// The switches and the desk's actions.
assert.equal(slpExtensionOn({ extStir: false }, "stir"), false);
assert.equal(slpExtensionOn({ extSupportDesk: true }, "supportDesk"), true);
for (const name of ["grant-perk", "throttle-reach", "plant-rumour"] as const)
  assert.equal(slpActionAllowed({ extSupportDesk: false }, name), false, name);

// Backstage: both switches are findable on the Stir page; the desk settings hide while the desk is off.
assert.equal(SLP_BACKSTAGE_SETTING_PLACEMENT.extStir.internal, undefined);
assert.equal(SLP_BACKSTAGE_SETTING_PLACEMENT.extSupportDesk.internal, undefined);
const off = { extStir: false, extSupportDesk: false } as never;
assert.equal(slpPlacementSwitchedOff("extStir", SLP_BACKSTAGE_SETTING_PLACEMENT.extStir, off), false);
assert.equal(slpPlacementSwitchedOff("extSupportDesk", SLP_BACKSTAGE_SETTING_PLACEMENT.extSupportDesk, off), false);
assert.equal(slpPlacementSwitchedOff("supportDesk", SLP_BACKSTAGE_SETTING_PLACEMENT.supportDesk, off), true);
assert.equal(slpTargetSwitchedOff("stir", off), true, "the Stir page saves at once while it holds only switches");
assert.equal(slpTargetSwitchedOff("stir", { extStir: false, extSupportDesk: true } as never), false);

// The Support role header asks for a "desk" answer only while the desk is on.
const role = (desk: boolean) =>
  slurpDmRoleHeader({
    writer: "creator",
    creator: { name: "Mia", handle: "mia" },
    viewer: { name: "Slurp Support", handle: "support" },
    support: true,
    desk,
    history: [],
  } as never);
assert.match(role(true), /Also add "desk" to your JSON/u);
assert.doesNotMatch(role(false), /Also add "desk"/u);
assert.match(role(false), /add "staff" to your JSON/u, "Support still steers with the desk off");

// Server gates.
assert.match(
  source("server", "features/assist/slp-stir-service.ts"),
  /if \(!slpExtensionOn\(settings, "stir"\)\) return \{ ok: false, status: 409, error: SLP_STIR_OFF \};/u,
  "the planner (the player's and Support's world wishes) refuses with Stir off",
);
assert.match(
  source("server", "features/assist/slp-stir-routes.ts"),
  /if \(!slpExtensionOn\(await settings\(\), "stir"\)\) return reply\.code\(409\)/u,
);
const tick = source("server", "features/messages/desk/slp-desk-tick-operation.ts");
assert.match(
  tick,
  /if \(!slpExtensionOn\(allSettings, "supportDesk"\)\) \{[\s\S]*?return;\n  \}\n[\s\S]*const settings = allSettings\.supportDesk;/u,
);
assert.match(
  source("server", "features/messages/desk/slp-desk-talk-operation.ts"),
  /if \(!slpExtensionOn\(allSettings, "supportDesk"\)\) return;/u,
);
assert.match(
  source("server", "data/world/slp-story-engine-storage.ts"),
  /target === "feed\.reach" && creatorAccountId && slpExtensionOn\(settings, "supportDesk"\)/u,
);
const routes = source("server", "features/messages/desk/slp-desk-routes.ts");
assert.equal(routes.match(/if \(await deskOff\(\)\) return reply\.code\(409\)/gu)?.length, 4, "all four desk routes");
assert.match(
  source("server", "features/messages/slp-messages-send-routes.ts"),
  /if \(parsed\.data\.desk && !slpExtensionOn\(await slurp\.getSettings\(\), "supportDesk"\)\)/u,
);
const generation = source("server", "features/messages/slp-message-generation-service.ts");
assert.match(generation, /supportThread && slpExtensionOn\(settings, "supportDesk"\)\s*\?\s*slurpDeskPromptData/u);
assert.match(generation, /!supportThread &&\s*input\.viewer\.kind === "persona"/u, "no scene invite to Support");
assert.match(generation, /commissionPrices: supportThread\s*\?\s*undefined/u, "staff buy no commissions");
const threads = source("server", "features/messages/slp-messages-thread-routes.ts");
assert.match(threads, /const deskThreads = deskOn \? supportThreads : \[\];/u);
assert.match(threads, /\.\.\.\(deskOn \? \[\] : supportThreads\)/u, "Support's threads sit in the inbox");
assert.match(threads, /unread: own\.unread \+ support\.unread, deskUnread: 0/u);

// Client gates.
const host = source("client", "app/SlpHomeHost.tsx");
assert.match(
  host,
  /onOpenStir:\s*!slurpSettingsQuery\.data \|\|\s*slpExtensionOn\(slurpSettingsQuery\.data, "stir"\) \|\|\s*slpExtensionOn\(slurpSettingsQuery\.data, "supportDesk"\)\s*\?\s*goToStir\s*:\s*undefined/u,
);
assert.match(
  source("client", "app/slp-home-state.ts"),
  /slpExtensionOn\(slurpSettingsQuery\.data, "stir"\)\s*\?\s*\(post\) => openSlpStir/u,
);
assert.match(source("client", "features/projects/SlpProjectsBoard.tsx"), /\{stirOn && \(\s*<button/u);
const screen = source("client", "features/stir/SlpStirScreen.tsx");
assert.match(screen, /const shown = !deskOn \? "stir" : !stirOn \? "desk" : mode;/u);
assert.match(screen, /\{stirOn && deskOn && \(\s*<SlpSegment/u);
assert.match(screen, /deckSettings && !stirOn && !deskOn \?/u);
const sheet = source("client", "features/stir/SlpStirCreatorSheet.tsx");
assert.match(sheet, /\{creator && stirOn && \(\s*<SlpStirBox/u);
assert.match(sheet, /\{view && stirOn && \(\s*<section aria-labelledby="slp-stir-quick"/u);
assert.doesNotMatch(sheet, /stirOn && \(\s*<SlpCreatorSteeringCard/u, "steering stays with Stir off");
const composer = source("client", "features/messages/SlpThreadComposer.tsx");
assert.match(composer, /\(desk \|\| \(tab\.id !== "offer" && tab\.id !== "move" && tab\.id !== "note"\)\)/u);
assert.match(composer, /\{desk && <SlpDeskQuickReplies/u);
assert.match(composer, /\{desk && <SlpDeskPlayHost/u);
assert.match(composer, /\{asSupport && <SlpPhotoDemandChip/u, "the photo check is Support's, not the desk's");
assert.match(
  source("client", "features/messages/SlpThreadHeader.tsx"),
  /relationship\?\.desk && asSupport && deskOn && <SlpDeskTicketBar/u,
);
assert.match(source("client", "features/messages/SlpThreadDrawer.tsx"), /relationship\?\.desk && deskOn && \(/u);
assert.match(source("client", "features/messages/SlpThreadView.tsx"), /deskOn && readSlpDeskOffer\(entry\.message\)/u);
const page = source("client", "features/stir/SlpStirSettingsPanel.tsx");
assert.match(page, /onChange=\{\(value\) => void updateNow\("extStir", value\)\}/u);
assert.match(page, /onChange=\{\(value\) => void updateNow\("extSupportDesk", value\)\}/u);
assert.match(page, /slpExtensionOn\(settings, "supportDesk"\) && <SlpDeskSettings/u);
const overview = source("client", "features/backstage/SlpBackstageOverviewPanel.tsx");
assert.match(overview, /set: \(on\) => void update\("extStir", on\)/u);
assert.match(overview, /set: \(on\) => void update\("extSupportDesk", on\)/u);

// Review fixes: a Creator who left is back with the desk off; no ticket write and no stale desk step.
assert.match(tick, /return \{ \.\.\.desk, pausedAt: null, pausedAutoPosting: false \};/u);
assert.match(
  tick,
  /if \(resume\) await storage\.bulkUpdateCreatorProfiles\(\[account\.id\], \{ autoPosting: true \}\);/u,
);
assert.match(
  source("server", "features/messages/slp-messages-send-routes.ts"),
  /if \(slpExtensionOn\(await slurp\.getSettings\(\), "supportDesk"\)\)\s*await markSlurpDeskSupportTurn/u,
);
assert.match(
  source("client", "features/messages/slp-thread-actions.ts"),
  /composerDesk &&\s*\(!state\.settingsQuery\.data \|\| slpExtensionOn\(state\.settingsQuery\.data, "supportDesk"\)\)/u,
);

console.log("slurp2 Stir and Support desk switches: ok");
