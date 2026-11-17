import assert from "node:assert/strict";
import {
  slpHashFmix,
  slpHashMix,
  slpStringHash,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-hash.ts";
import { slpDate, slpIntOrNull, slpRecord } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-coerce.ts";

// Picks, rotations and seeds come from these hashes, so their output is frozen at what the copies they replaced gave.
for (const [input, mix, fmix, javaStyle] of [
  ["", 1572119809, 2872998923, 0],
  ["creator-1:post:3", 2424076587, 1510348257, 1130131395],
  ["Zoë ✨", 1420553070, 1880682974, 86660542],
] as [string, number, number, number][]) {
  assert.equal(slpHashMix(input), mix, `slpHashMix(${JSON.stringify(input)})`);
  assert.equal(slpHashFmix(input), fmix, `slpHashFmix(${JSON.stringify(input)})`);
  assert.equal(slpStringHash(input), javaStyle, `slpStringHash(${JSON.stringify(input)})`);
}

assert.deepEqual(slpRecord({ a: 1 }), { a: 1 });
for (const value of [null, [], "x", 0]) assert.equal(slpRecord(value), null);
assert.equal(slpDate("2026-11-17T10:00:00Z"), "2026-11-17T10:00:00Z");
assert.equal(slpDate("not a date"), null);
assert.equal(slpIntOrNull(3), 3);
assert.equal(slpIntOrNull(3.5), null);

console.log("slurp2 shared helpers regression checks passed");
