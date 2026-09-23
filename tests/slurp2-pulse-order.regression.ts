import assert from "node:assert/strict";
import { sortSlpPulseScheduled } from "../packages/slurp2/src/engine/packages/client/src/slp/modules/chrome/slp-pulse-order.ts";
import { slurp2Source } from "./slurp2-source";

const items = [
  { id: "late", publishAt: "2026-09-25T09:00:00.000Z", createdAt: "2026-09-20T09:00:00.000Z" },
  { id: "soon", publishAt: "2026-09-23T09:00:00.000Z", createdAt: "2026-09-22T09:00:00.000Z" },
  { id: "middle", publishAt: "2026-09-24T09:00:00.000Z", createdAt: "2026-09-21T09:00:00.000Z" },
];
assert.deepEqual(
  sortSlpPulseScheduled(items).map((item) => item.id),
  ["soon", "middle", "late"],
);
assert.deepEqual(sortSlpPulseScheduled(items), sortSlpPulseScheduled(items));

const pulse = slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/modules/chrome/SlpPulse.tsx");
assert.match(pulse, /sortSlpPulseScheduled\(combined\.filter\(\(task\) => task\.status === "scheduled"\)\)/u);
assert.match(pulse, /aria-expanded=\{showAllTasks\}/u);
assert.match(pulse, /group\.tasks\.length - 6/u);

console.log("slurp2 Pulse order regression passed");
