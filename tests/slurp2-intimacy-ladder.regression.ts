/**
 * S — the intimacy ladder (docs/SPICY.md, item 1, PR 2): rapport tiers open doors, the highest tier reached
 * stays open per pair, the Creator says it once when the viewer steps up, a favourite gets cheaper customs and
 * now and then a free spicy picture, and a whale's free pictures go to her full level.
 */
import assert from "node:assert/strict";
import {
  describeSlurpRapport,
  describeSlurpRapportForDm,
  slurpRapportDoors,
  slurpRapportDoorTier,
  slurpRapportHigher,
  slurpRapportKeepPeak,
  type SlurpRapport,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-rapport.ts";
import { resolveSlurpMediaOffer } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/economy/slp-media-offer.ts";
import {
  slurpCommissionPricingFor,
  slurpCommissionQuote,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/economy/slp-creator-pricing.ts";
import { slurp2Source } from "./slurp2-source.ts";

const rapport = (tier: SlurpRapport["tier"], extra: Partial<SlurpRapport> = {}): SlurpRapport => ({
  score: 0,
  tier,
  contributions: [],
  ...extra,
});

// Doors by tier, each kept above.
assert.deepEqual(slurpRapportDoors("acquaintance"), []);
assert.deepEqual(slurpRapportDoors("regular"), ["spicierTalk"]);
assert.deepEqual(slurpRapportDoors("favourite"), ["spicierTalk", "gifts", "customDiscount"]);
assert.deepEqual(slurpRapportDoors("whale"), ["spicierTalk", "gifts", "customDiscount", "fullSpice"]);
assert.equal(slurpRapportHigher("regular", undefined, "favourite", "stranger"), "favourite");

// A quiet week drops the band, never the doors; a pair stored before the ladder starts at its tier.
const kept = slurpRapportKeepPeak(rapport("acquaintance"), rapport("favourite", { said: "favourite" }));
assert.equal(kept.tier, "acquaintance");
assert.equal(kept.peak, "favourite");
assert.equal(slurpRapportDoorTier(kept), "favourite");
assert.deepEqual(slurpRapportKeepPeak(rapport("regular"), rapport("whale")), {
  ...rapport("regular"),
  peak: "whale",
  said: "whale",
});
assert.equal(slurpRapportKeepPeak(rapport("regular"), null).said, "stranger");

// She says the step-up once: while `said` is below the peak, never for a partner.
const stepped = slurpRapportKeepPeak(rapport("favourite"), rapport("regular", { peak: "regular", said: "regular" }));
assert.match(describeSlurpRapportForDm(stepped, "Sam"), /Sam just became one of your favourite fans: tell them once/);
assert.doesNotMatch(describeSlurpRapportForDm({ ...stepped, said: "favourite" }, "Sam"), /just became/);
const partner = {
  ...stepped,
  contributions: [{ key: "partner" as const, detail: "you are together", weight: 0, points: 60 }],
};
assert.doesNotMatch(describeSlurpRapportForDm(partner, "Sam"), /just became/);
// Only the DM reply prompt asks for it: comments and scenes never mark it said.
assert.doesNotMatch(describeSlurpRapport(stepped, "Sam"), /just became/);

// A favourite's gift: a spicy friendly picture is free; without the gift a subscriber's spicy one is PPV.
const offer = (gift: boolean) =>
  resolveSlurpMediaOffer({
    intent: "friendly",
    rapportTier: "favourite",
    subscribed: true,
    configuredPrice: 12,
    spicy: true,
    gift,
  });
assert.deepEqual(offer(true), { visibility: "free", price: 0, reason: "relationship_reward" });
assert.equal(offer(false).visibility, "locked");

// Customs: a favourite pays less, a regular the normal price.
const pricing = { commissionBase: 40, commissionMin: 20, commissionMax: 100 };
const brief = "a picture of you in the red set";
assert.equal(slurpCommissionPricingFor(pricing, rapport("regular")), pricing);
assert.deepEqual(slurpCommissionPricingFor(pricing, rapport("acquaintance", { peak: "favourite" })), {
  commissionBase: 34,
  commissionMin: 17,
  commissionMax: 85,
});
assert.ok(
  slurpCommissionQuote(brief, slurpCommissionPricingFor(pricing, rapport("whale"))) <
    slurpCommissionQuote(brief, pricing),
);

// The doors reach the live paths.
const server = (path: string) => slurp2Source(`packages/slurp2/src/engine/packages/server/src/slp/${path}`);
assert.match(server("data/messages/slp-messages-storage-base.ts"), /slurpRapportKeepPeak\(/);
assert.doesNotMatch(
  server("data/messages/slp-messages-storage-conversation.ts"),
  /said:/,
  "openers and quotes never mark it said",
);
assert.match(
  server("features/messages/slp-message-generation-service.ts"),
  /describeSlurpRapportForDm\(input\.rapport/,
);
assert.match(
  server("features/messages/commissions/slp-commissions-routes.ts"),
  /const pricing = await messages\.commissionPricingFor\(commission\)/,
);
assert.match(
  server("features/messages/slp-message-generation-service.ts"),
  /subscribed: input\.subscribed \|\| input\.sexting === true \|\| slurpRapportOpens\(input\.rapport, "spicierTalk"\)/,
);
assert.match(
  server("features/messages/slp-message-generation-service.ts"),
  /\.commissionPricingFor\(\{ viewerAccountId/,
);
const operation = server("features/messages/slp-message-operation.ts");
assert.match(operation, /rapportTier: doorTier/);
assert.match(operation, /gift,\n/);
// The generated reply marks it said, from the same rapport its prompt read.
assert.match(
  operation,
  /appendReplyBatch[\s\S]{0,400}if \(!stored\) return \{ status: "ineligible" \} as const;\n\s*\/\/ Its prompt carried any step-up line[^\n]*\n\s*if \(slurpRapportDoorTier\(thread\.rapport\) !== thread\.rapport\.said\) \{\n\s*await messagesStore\.markRapportSaid\(thread\.id, slurpRapportDoorTier\(thread\.rapport\)\)/,
);
assert.match(
  server("features/messages/slp-follow-up-scheduler-service.ts"),
  /if \(!stored\) \{[\s\S]{0,400}markRapportSaid\(threadRow\.id, slurpRapportDoorTier\(thread\.rapport\)\)/,
  "a follow-up's step-up is marked said too",
);
assert.match(operation, /const gift =\s*reply\.imageMode !== "hostile" &&/, "no gift level for a hostile picture");
assert.match(operation, /slurpRapportDoorTier\(thread\.rapport\) !== "whale"/, "a past whale keeps free post previews");
assert.match(operation, /partner \|\| gift \|\| doors\.includes\("fullSpice"\)/);
assert.match(server("features/messages/slp-messages-thread-routes.ts"), /slurpCommissionPricingFor\(/);
assert.equal(
  server("features/world/slp-world-operation.ts").match(/messages\.commissionPricingFor\(commission\)/g)?.length,
  3,
);
assert.match(server("data/messages/slp-messages-storage-base.ts"), /return slurpCommissionPricingFor\(/);

console.log("slurp2 intimacy ladder: ok");
