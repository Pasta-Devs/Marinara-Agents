import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The artwork backfill called artworkPrompt without its options, so every backfill for a hinted or
// secret Creator threw "Cannot read properties of undefined (reading 'creatorDetails')" once a
// minute and those Creators never got an avatar or banner. Every call must pass the options.
const source = readFileSync(
  join(
    import.meta.dirname,
    "..",
    "packages/slurp2/src/engine/packages/server/src/slp/features/creators/slp-artwork-operation.ts",
  ),
  "utf8",
);
const calls = [...source.matchAll(/artworkPrompt\(\s*(?:input\.)?kind,/gu)].map((match) => {
  let depth = 0;
  let end = match.index!;
  for (; end < source.length; end += 1) {
    if (source[end] === "(") depth += 1;
    if (source[end] === ")" && --depth === 0) break;
  }
  return source.slice(match.index!, end + 1);
});
assert.equal(calls.length, 2, "both artwork paths build a prompt");
for (const call of calls) {
  assert.match(
    call,
    /\},\s*(?:options|\{ creatorDetails: true[^}]*\})\s*,?\s*\)$/u,
    `artworkPrompt call without options: ${call}`,
  );
}

console.log("slurp2 artwork backfill regression checks passed");
