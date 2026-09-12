import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const src = join(root, "packages/slurp2/src/engine/packages/server/src");

// Every table this package added after the host image was cut lives only in the bundle. The file
// store rejects such a table with "Unsupported table" unless the package registers it, which is
// how the world, messaging, and population features silently failed in production.
const entry = readFileSync(join(src, "services/slurp/server-entry.ts"), "utf8");
assert.match(entry, /import \* as slurpSchema from "\.\.\/\.\.\/db\/schema\/slurp\.js"/u);
assert.match(entry, /registerTables\(Object\.values\(slurpSchema\)\)/u);

// Registration has to happen before anything reads or writes, or the first storage call still
// throws. The legacy-snapshot migration is the earliest storage touch in activate().
const register = entry.indexOf("registerTables(Object.values(slurpSchema))");
const firstStorage = entry.indexOf("migrateLegacyNoodlerSourceSnapshots");
assert.ok(register > 0 && register < firstStorage, "tables must be registered before storage use");

// Hosts older than the Engine's registerTables API must keep working instead of failing to
// activate. Anything that shipped with the host stays available there.
assert.match(entry, /registerTables\?\./u, "the call must tolerate a host without the API");
assert.match(entry, /else app\.log\?\.warn\(/u, "an unsupported host must be reported, not silent");

// The schema module is the single source of truth: no hand-maintained list to drift.
const schema = readFileSync(join(src, "db/schema/slurp.ts"), "utf8");
const declared = [...schema.matchAll(/fileTable\(\s*"?([a-z_]*)/gu)].length;
assert.ok(declared > 15, `expected the full Slurp table set, saw ${declared}`);

// A host that cannot hold the new tables must degrade, not fail. The feed reads follower counts
// from the funnel, so an unsupported table there took down a surface that predates the funnel.
const store = join(src, "services/storage");
const helper = readFileSync(join(store, "slurp-host-tables.ts"), "utf8");
assert.match(helper, /\[file-storage\] Unsupported table/u, "only the host's own error may be swallowed");
for (const file of ["slurp-population.storage.ts", "slurp-events.storage.ts", "slurp-messages.storage.ts"]) {
  const text = readFileSync(join(store, file), "utf8");
  assert.match(text, /return tolerateMissingTables\(storage, \{/u, `${file} must degrade`);
}

// Counting must still answer for every creator asked about, or a caller reading the map by id
// gets undefined where it expects a number.
const population = readFileSync(join(store, "slurp-population.storage.ts"), "utf8");
assert.match(
  population,
  /countFollowersForCreators: \(creatorAccountIds[\s\S]*?new Map\(creatorAccountIds\.map\(\(id\) => \[id, 0\]\)\)/u,
  "the empty-audience fallback must still key every requested creator",
);

console.log("slurp table registration regression passed");
