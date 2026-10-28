import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Pins the staging 0.2.41 tick fixes (merged in 4b): the world tick froze the Engine for seconds
// because every getSettings() ran a full zod parse and the storage calls never gave the event loop a
// turn. Source pins: both modules import the Engine logger, which tests cannot load.
const server = (path: string) =>
  readFileSync(join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages/server/src/slp", path), "utf8");

// ── Settings: the stored JSON string (or null) is the cache key; callers get a clone ──
const settings = server("modules/settings/slp-settings.ts");
assert.match(
  settings,
  /export function normalizeSlurpSettings\(raw: unknown\): SlurpSettings \{\s+if \(typeof raw !== "string" && raw !== null\) return normalizeSlurpSettingsUncached\(raw\);/u,
  "object inputs (updateSettings) still parse every time",
);
assert.match(
  settings,
  /if \(raw !== cachedSettingsRaw \|\| !cachedSettings\) \{\s+cachedSettings = normalizeSlurpSettingsUncached\(raw\);\s+cachedSettingsRaw = raw;\s+\}\s+return structuredClone\(cachedSettings\);/u,
  "a changed string re-parses; an unchanged one returns a clone of the cached parse",
);

// ── World tick: every per-creator, per-commission and per-action loop yields first ──
const world = server("features/world/slp-world-operation.ts");
assert.match(world, /const yieldToEngine = \(\) => new Promise<void>\(\(resolve\) => setImmediate\(resolve\)\);/u);
const loops = [...world.matchAll(/for \(const (?:account|commission|action) of [^\n]*\{\n([^\n]*)/gu)];
assert.ok(loops.length >= 12, `expected the tick's 12 step loops, found ${loops.length}`);
for (const [loop, firstLine] of loops) {
  assert.equal(
    firstLine.trim(),
    "await yieldToEngine();",
    `loop must yield before its step: ${loop.split("\n")[0].trim()}`,
  );
}

console.log("slurp2 world tick yield regression passed");
