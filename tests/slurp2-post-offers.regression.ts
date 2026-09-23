import assert from "node:assert/strict";
import {
  slpGambleUnlockPrice,
  slpHasGambleOffer,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-post-offers.ts";
import { slurp2Source } from "./slurp2-source";

const ids = Array.from({ length: 1200 }, (_, index) => `post-${index}`);
const eligible = ids.filter(slpHasGambleOffer);
assert.ok(eligible.length > 300 && eligible.length < 500, `expected about one third eligible, got ${eligible.length}`);
for (const id of ids) assert.equal(slpHasGambleOffer(id), slpHasGambleOffer(id), "eligibility must stay stable");
assert.equal(slpGambleUnlockPrice(12, true), 0);
assert.equal(slpGambleUnlockPrice(12, false), 36);

const routes = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/economy/slp-wallet-routes.ts");
const gamble = routes.slice(routes.indexOf('app.post("/slurp/posts/:id/gamble-unlock"'));
assert.match(gamble, /randomInt\(2\)/u);
assert.match(gamble, /slpGambleUnlockPrice\(basePrice, free\)/u);
assert.match(gamble, /noodle\.unlockPost\(viewer\.id, post\.id, price, true\)/u);
assert.match(gamble, /!slpHasGambleOffer\(post\.id\)/u);
assert.match(gamble, /result\.created && result\.chargedAmount > 0/u, "repeat requests must not charge twice");
assert.match(gamble, /!result\.created[\s\S]*?"already-unlocked"/u);

const lockedCard = slurp2Source(
  "packages/slurp2/src/engine/packages/client/src/slp/modules/post/SlpLockedPostCard.tsx",
);
assert.match(lockedCard, /onGambleUnlock && slpHasGambleOffer\(post\.id\)/u);
assert.match(lockedCard, /data-slurp-gamble-unlock/u);
assert.match(lockedCard, /unlockOffer &&/u);
assert.match(lockedCard, /subscriptionOffer &&/u);
assert.match(lockedCard, /newPrice >= oldPrice/u);
assert.match(
  lockedCard,
  /ui\.noodle\.lockednoodlerpostcard\.unlock/u,
  "the post unlock action must not depend on an image",
);
assert.ok(
  lockedCard.indexOf("ui.slurp.locked.teaser") < lockedCard.indexOf("ui.noodle.lockednoodlerpostcard.unlock"),
  "a text-only locked post must show its unlock control after its teaser",
);

const postCard = slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/modules/post/SlpPostCard.tsx");
assert.match(postCard, /postMenuOpen && "relative z-40"/u);
const hub = slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/app/screens/SlpScreenHub.tsx");
assert.match(hub, /postMenuId === item\.post\.id \? "relative z-40 overflow-visible"/u);

console.log("slurp2 post offers regression passed");
