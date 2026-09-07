import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const postCard = readFileSync(
  "packages/slurp/src/engine/packages/client/src/components/slurp/SlurpCreatorPostCard.tsx",
  "utf8",
);
const home = readFileSync("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpHome.tsx", "utf8");

assert.match(postCard, /blur-\[14px\]/u, "locked media keeps the stronger privacy blur");
assert.match(postCard, /slurp-privacy-noise/u, "locked media keeps its moving privacy grain");
assert.equal(
  (postCard.match(/setUnlockSheetOpen\(true\)/gu) ?? []).length,
  1,
  "the locked card exposes one primary unlock entry point",
);
assert.match(home, /variant="story"/u, "stories use the dedicated media-first dialog layout");
assert.match(home, /sm:h-\[min\(84vh,48rem\)\] sm:flex-row/u, "post previews keep the wide image-and-details layout");

console.log("slurp media surfaces regression passed");
