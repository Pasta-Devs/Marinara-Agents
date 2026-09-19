import assert from "node:assert/strict";

import { slurpTeaserPost } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-variation.js";

const count = (rate: Parameters<typeof slurpTeaserPost>[2]) =>
  Array.from({ length: 100 }, (_, step) => slurpTeaserPost("creator-a", step, rate)).filter(Boolean).length;

assert.equal(count("off"), 0);
assert.equal(count("rare"), 10);
assert.equal(count("regular"), 20);
assert.equal(count("often"), 30);
// Never two teasers in a row at the default rate.
for (let step = 0; step < 50; step += 1) {
  assert.ok(!(slurpTeaserPost("creator-a", step) && slurpTeaserPost("creator-a", step + 1)));
}
assert.equal(slurpTeaserPost("creator-a", Number.NaN, "often"), slurpTeaserPost("creator-a", 0, "often"));

console.log("slurp2 teaser post regression passed");
