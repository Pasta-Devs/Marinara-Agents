import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const postCard = readFileSync(
  "packages/slurp/src/engine/packages/client/src/components/slurp/SlurpCreatorPostCard.tsx",
  "utf8",
);
const home = readFileSync("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpHome.tsx", "utf8");

// Deliberately not pinned to a pixel radius. This class changed three times in two commits and
// each change cost a false failure; the server already blurs the locked bytes, so what matters
// here is only that the locked branch stays visually distinct from the revealed one.
assert.match(postCard, /revealed \? "scale-100" : "saturate-\[[\d.]+\]"/u, "locked media stays desaturated");
assert.equal(
  (postCard.match(/setUnlockSheetOpen\(true\)/gu) ?? []).length,
  1,
  "the locked card exposes one primary unlock entry point",
);
assert.match(home, /variant="story"/u, "stories use the dedicated media-first dialog layout");
assert.match(home, /sm:h-\[min\(84vh,48rem\)\] sm:flex-row/u, "post previews keep the wide image-and-details layout");

console.log("slurp media surfaces regression passed");
