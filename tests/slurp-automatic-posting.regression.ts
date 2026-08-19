import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const storage = readFileSync("packages/slurp/src/engine/packages/server/src/services/storage/slurp.storage.ts", "utf8");
const refreshScheduler = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-refresh-scheduler.service.ts",
  "utf8",
);
const hooks = readFileSync("packages/slurp/src/engine/packages/client/src/hooks/use-slurp.ts", "utf8");
const serverEntry = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/slurp/server-entry.ts",
  "utf8",
);

assert.match(
  storage,
  /preparationNotBefore: timestamp/u,
  "new reserve state must be immediately eligible for its first prepared post",
);
assert.match(
  storage,
  /storedPreparationMs > observedMs\s*\n\s*\? observed/u,
  "upgraded reserve state must repair the old future startup hold",
);
assert.match(
  refreshScheduler,
  /payload: \{ mode: "noodler" \}/u,
  "the Slurp refresh scheduler must call the supported NoodleR route mode",
);
const viewerHook = hooks.slice(
  hooks.indexOf("export function useNoodlerViewer"),
  hooks.indexOf("/**\n * Unseen-post count"),
);
assert.match(viewerHook, /refetchInterval: enabled && personaId \? 30_000 : false/u);
assert.match(hooks, /invalidateQueries\(\{ queryKey: noodleKeys\.viewer\(personaId\) \}\)/u);
assert.match(
  serverEntry,
  /if \(active\) throw new Error\("Slurp is already active"\);\s*active = true/u,
  "Slurp must claim activation before asynchronous registration can start a second scheduler",
);
assert.match(
  serverEntry,
  /catch \(error\) \{[\s\S]*?active = false;[\s\S]*?throw error;/u,
  "failed Slurp activation must release scheduler ownership",
);

console.log("Slurp automatic posting regressions passed.");
