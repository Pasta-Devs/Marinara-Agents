import assert from "node:assert/strict";
import { resolveSlurpMediaOffer } from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-media-offer.js";
import { resolveSlurpStance } from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-stance.js";

assert.deepEqual(
  resolveSlurpMediaOffer({ intent: "friendly", rapportTier: "regular", subscribed: false, configuredPrice: 20 }),
  { visibility: "free", price: 0, reason: "relationship_reward" },
);
assert.deepEqual(
  resolveSlurpMediaOffer({ intent: "premium", rapportTier: "stranger", subscribed: false, configuredPrice: 20 }),
  { visibility: "locked", price: 20, reason: "premium_content" },
);
assert.deepEqual(
  resolveSlurpMediaOffer({ intent: "hostile", rapportTier: "stranger", subscribed: false, configuredPrice: 20 }),
  { visibility: "free", price: 0, reason: "hostile_free" },
);
assert.equal(
  resolveSlurpStance({
    rapportTier: "regular",
    rapportScore: 50,
    moodTone: "cold",
    audienceArc: null,
    dayVibe: null,
    availability: { online: true, activity: null },
    subscribed: false,
    isRequest: false,
    tone: "warm",
    coolingOff: false,
    strikes: 0,
  }).canSendImage,
  true,
);

console.log("slurp media offer regression passed");
