/**
 * The per-section changed count and reset. Every shipped setting must belong to exactly one
 * section or be explicitly excluded, so a new setting cannot silently escape the reset.
 */
import assert from "node:assert/strict";
import {
  changedSlurpSettingKeys,
  SLURP_SETTINGS_NOT_RESET,
  SLURP_SETTINGS_SECTION_KEYS,
  slurpSettingsResetPatch,
} from "../packages/slurp2/src/engine/packages/client/src/slp/features/settings/slp-settings-defaults";
import { slurp2BackstageSource } from "./slurp2-backstage-source";
import { slurp2Source } from "./slurp2-source";

// The client type lists every setting by name. The server defaults spread some in (the reply
// delays), so a line scan of them misses keys; the type does not.
const hooks = slurp2Source("packages/slurp2/src/engine/packages/client/src/hooks/use-slurp.ts");
const start = hooks.indexOf("export type SlurpSettings = {");
const shippedKeys = [...hooks.slice(start, hooks.indexOf("\n};", start)).matchAll(/^ {2}([a-zA-Z0-9]+)\??:/gmu)].map(
  (match) => match[1],
);
assert.ok(shippedKeys.length > 50, "the client settings type must be found");
assert.ok(shippedKeys.includes("messagesMaxReplyDelayMinutes"), "spread-in reply delay settings must be checked");

const owners = new Map<string, string[]>();
for (const [section, keys] of Object.entries(SLURP_SETTINGS_SECTION_KEYS)) {
  for (const key of keys) owners.set(key, [...(owners.get(key) ?? []), section]);
}
for (const key of SLURP_SETTINGS_NOT_RESET) owners.set(key, [...(owners.get(key) ?? []), "not-reset"]);
for (const key of shippedKeys) {
  assert.equal(owners.get(key)?.length, 1, `${key} must be in exactly one section or excluded`);
}
for (const key of owners.keys()) assert.ok(shippedKeys.includes(key), `${key} is not a shipped setting`);

const defaults = { storyRate: "rare", fanTypes: [{ id: "regular" }], generationConnectionId: null } as never;
const changed = { storyRate: "often", fanTypes: [{ id: "regular" }], generationConnectionId: "conn" } as never;
assert.deepEqual(changedSlurpSettingKeys(changed, defaults, "general"), ["storyRate"]);
assert.deepEqual(slurpSettingsResetPatch(changed, defaults, "general"), { storyRate: "rare" });
assert.deepEqual(changedSlurpSettingKeys(changed, defaults, "audience"), [], "equal arrays are not a change");

const settingsView = slurp2BackstageSource();
// Fix phase 1 (R1-133): the reset patch is saved, and staged edits of the same keys are dropped first.
assert.match(
  settingsView,
  /const reset = slurpSettingsResetPatch\(settings, defaults, target\);[\s\S]{0,300}!\(key in reset\)[\s\S]{0,120}void save\(reset\);/u,
);
const routes = slurp2Source("packages/slurp2/src/engine/packages/server/src/routes/slurp.routes.ts");
// R1-125: the defaults are normalized like stored settings, so a fresh install differs in nothing.
// Merge F follow-up (on purpose): an untouched "Posts per day" reads sized for today's Creators, so the
// defaults carry the same sizing; otherwise a fresh install differs in it and a reset fixes it at 4.
assert.match(
  routes,
  /app\.get\("\/settings\/defaults", async \(\) => \(\{\s+\.\.\.normalizeSlurpSettings\(null\),\s+postsPerDay: slurpSizedPostsPerDay\(await countSlurpActiveCreators\(app\.db\)\),\s+\}\)\);/u,
);

console.log("slurp2 settings reset regression passed");
