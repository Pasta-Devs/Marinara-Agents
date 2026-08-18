import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const view = readFileSync("packages/noodle/src/engine/packages/client/src/components/noodle/NoodleView.tsx", "utf8");
const entry = readFileSync("packages/noodle/src/engine/packages/server/src/services/noodle/server-entry.ts", "utf8");

assert.doesNotMatch(view, /SlurpHome/u);
assert.doesNotMatch(entry, /startNoodleAutoPostScheduler|startNoodlerFanActivityScheduler/u);
assert.match(entry, /startNoodleRefreshScheduler/u);
console.log("Noodle public activation boundary regressions passed.");
