import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  SLP_REPLY_DELAY_KEYS,
  SLP_NORMAL_REPLY_DELAYS,
  slpReplySpeedFor,
  slpReplySpeedPatch,
} from "../packages/slurp2/src/engine/packages/client/src/slp/modules/settings/slp-reply-speed";
import {
  SLP_BACKSTAGE_EXTENSION_SECTIONS,
  SLP_BACKSTAGE_SECTIONS,
  SLP_BACKSTAGE_TARGETS_BY_SECTION,
} from "../packages/slurp2/src/engine/packages/client/src/slp/base/navigation/slp-backstage-target";
import { SLURP_DEFAULT_REPLY_DELAYS } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-messaging";

// Configurator slice 1 (docs/CONFIGURATOR.md): Basic page, one page per extension, no switches yet.

// --- "How fast they answer" writes the ten wait fields, and Normal is the server's shipped waits.
const { messagesUnscheduledAlwaysReachable: _reachable, ...serverWaits } = SLURP_DEFAULT_REPLY_DELAYS;
assert.deepEqual(SLP_NORMAL_REPLY_DELAYS, serverWaits, "Normal must stay the server's default waits");
assert.deepEqual(slpReplySpeedPatch("normal"), SLP_NORMAL_REPLY_DELAYS);
assert.equal(slpReplySpeedPatch("instant").messagesMaxReplyDelayMinutes, 0, "At once is a zero ceiling");
for (const speed of ["instant", "quick", "normal", "slow"] as const) {
  const patch = slpReplySpeedPatch(speed);
  assert.deepEqual(Object.keys(patch).sort(), [...SLP_REPLY_DELAY_KEYS].sort(), `${speed} writes every wait`);
  for (const key of SLP_REPLY_DELAY_KEYS) {
    assert.ok(Number.isInteger(patch[key]) && patch[key] >= 0 && patch[key] <= 1440, `${speed} ${key} fits the schema`);
  }
  assert.equal(slpReplySpeedFor(patch), speed, `${speed} reads back as itself`);
}
// A minimum above its maximum would be a broken range on the Messages page.
for (const speed of ["quick", "normal", "slow"] as const) {
  const patch = slpReplySpeedPatch(speed);
  assert.ok(patch.messagesHighRapportDelayMinMinutes <= patch.messagesHighRapportDelayMaxMinutes);
  assert.ok(patch.messagesStalePostAwayMinMinutes <= patch.messagesStalePostAwayMaxMinutes);
}
assert.equal(
  slpReplySpeedFor({ ...SLP_NORMAL_REPLY_DELAYS, messagesCoolOff: 1, messagesMaxReplyDelayMinutes: 91 } as never),
  null,
  "waits set one by one show no speed",
);

// --- Sections: Basic first, the extensions after it, each with its own page.
assert.equal(SLP_BACKSTAGE_SECTIONS[1], "basic");
assert.deepEqual(SLP_BACKSTAGE_EXTENSION_SECTIONS, ["ads", "content", "world", "stir", "live", "engine"]);
assert.deepEqual(SLP_BACKSTAGE_SECTIONS.slice(-SLP_BACKSTAGE_EXTENSION_SECTIONS.length), [
  ...SLP_BACKSTAGE_EXTENSION_SECTIONS,
]);
assert.equal(SLP_BACKSTAGE_TARGETS_BY_SECTION.basic[0], "basic", "Basic opens on its short page");
assert.ok(SLP_BACKSTAGE_TARGETS_BY_SECTION.content.includes("drama"), "drama and polyamory are Storylines");

// --- Pages: no switches before a gate, Basic saves at once, the Messages copy says what still arrives.
const slp = join(import.meta.dirname, "../packages/slurp2/src/engine/packages/client/src/slp");
const read = (file: string) => readFileSync(join(slp, file), "utf8");
const overview = read("features/backstage/SlpBackstageOverviewPanel.tsx");
assert.doesNotMatch(overview, /<Toggle\b/u, "the Overview quick switches are gone");
assert.match(overview, /ui\.slurp\.settings\.overview\.yours\./u, "Overview lists Basic and every extension");
const basic = read("features/backstage/SlpBasicPanel.tsx");
for (const target of ["connections", "general", "audience", "images", "messaging", "wallet", "autopurge"]) {
  assert.match(basic, new RegExp(`more\\("${target}"`, "u"), `Basic leads to the full ${target} page`);
}
assert.match(basic, /not about writing first/u, "away replies are not about writing first");
assert.match(basic, /Subscribers and chats already running always get through/u, "closed is not nobody");
assert.match(basic, /promises, reminders and finished commissions still arrive/u, "what still arrives when off");
assert.match(basic, /noText/u, "Basic speaks up when there is no text connection");
assert.match(
  read("features/settings/slp-settings-backstage-contract.ts"),
  /section !== "overview" && target !== "basic"/u,
  "the Basic page saves at once, like Overview",
);
assert.match(
  read("features/settings/slp-settings-backstage-contract.ts"),
  /!\(key in patch\)/u,
  "a save at once drops staged edits of the same keys",
);

console.log("slurp2 configurator Basic regression passed");
