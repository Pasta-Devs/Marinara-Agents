import assert from "node:assert/strict";
import { slpCutAtBoundary } from "../packages/slurp2/src/engine/packages/server/src/slp/base/prompting/slp-prompt-safety";
import {
  slurpCommissionPriceRange,
  slurpCommissionQuote,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/economy/slp-creator-pricing";
import {
  slurpCoupleFit,
  slurpCoupleKin,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-couple-fit";
import { slurpSetUpCouple } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-creator-couples";
import { slpUnreachableCode } from "../packages/slurp2/src/engine/packages/server/src/slp/base/model/slp-provider-retry";
import { slurp2Source } from "./slurp2-source.ts";

const server = (path: string) => slurp2Source(`packages/slurp2/src/engine/packages/server/src/slp/${path}`);

// Slurp 0.3.43 bug sweep.

// ── Long DMs are not cut mid-word (#101) ──
assert.match(
  server("features/messages/slp-message-generation-service.ts"),
  /SLURP_MESSAGE_CONTENT_MAX_LENGTH = 2400;/u,
);
assert.match(server("features/feed/slp-public-identity.ts"), /return slpCutAtBoundary\(protectedValue, maxLength\);/u);
const reply = `${"I loved the shoot today. ".repeat(40)}Can I ask you a QUESTION about it`;
const cut = slpCutAtBoundary(reply, 1000);
assert.ok(cut.length <= 1000);
assert.match(cut, /today\.$/u, "ends on a sentence");
assert.equal(slpCutAtBoundary("short", 10), "short");
assert.equal(slpCutAtBoundary("one two three four", 12), "one two", "a word boundary when no sentence end");
assert.equal(slpCutAtBoundary("abcdefghijklmnop", 5), "abcde", "a hard cut only without spaces");
assert.equal(slpCutAtBoundary("one two three", 7), "one two", "a cut right before a space keeps the word");

// ── A commission price named in chat matches the quote (#45) ──
const pricing = { commissionBase: 40, commissionMin: 10, commissionMax: 400 };
assert.deepEqual(slurpCommissionPriceRange(pricing), { usual: 40, from: 10, upTo: 400 });
assert.deepEqual(slurpCommissionPriceRange({ commissionBase: 500, commissionMin: 90, commissionMax: 60 }), {
  usual: 60,
  from: 60,
  upTo: 60,
});
for (const brief of ["a quick sketch", "a detailed full-body scene of the two of us together, a set of three"]) {
  const quote = slurpCommissionQuote(brief, pricing);
  const range = slurpCommissionPriceRange(pricing);
  assert.ok(quote >= range.from && quote <= range.upTo, "every quote is inside the range the DM names");
}
const dm = server("features/messages/slp-message-generation-service.ts");
assert.match(dm, /commissionPrices: supportDesk\s*\? undefined/u);
assert.match(dm, /\.\.\.\(input\.commissionPrices \? \{ commissionPrices: input\.commissionPrices \} : \{\}\)/u);

// ── Cancel ends a subscription to a removed Creator at once (#28) ──
assert.match(
  server("data/economy/slp-economy-storage-1.ts"),
  /const gone = !expire && current && !\(await this\.getNoodlerAccountById\(creatorAccountId, \{ includeHidden: true \}\)\);\s*if \(!expire && !gone && current/u,
);

// ── Fans react to what a picture shows, not to its art style (#38) ──
const pictures = server("base/media/slp-post-image-context.ts");
assert.match(pictures, /never to art style/u);
assert.equal(pictures.match(/\$\{PICTURE_SEEN\}/gu)?.length, 3, "prompt, saved caption and new caption all carry it");

// ── Family is never an automatic couple, but the player and the cards may (#43) ──
const tie = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  text: "",
  tags: [],
  automatic: true,
  followers: 0,
  romance: { off: false, only: [] },
  ...extra,
});
const mom = tie("m", "Ruth Vale", { cardPeople: [{ name: "Juniper", relation: "daughter" }] });
const kid = tie("d", "Juniper Vale");
assert.ok(slurpCoupleKin(mom, kid) && slurpCoupleKin(kid, mom), "a card person with a family relation");
assert.equal(slurpCoupleFit(mom, kid).misfit, "family", "never set up on its own");
const ava = (text: string) => tie("a", "Ava", { text });
for (const text of [
  "Ava's older sister Juniper runs a bakery.",
  "Juniper is Ava's stepsister.",
  "Ava and Juniper are sisters.",
  "Juniper, her cousin, visits on Sundays.",
  "Avas Schwester Juniper backt.",
  "Her sister, Juniper, bakes.",
])
  assert.ok(slurpCoupleKin(ava(text), kid), text);
for (const text of [
  "Ava loves Juniper's posts.",
  "Ava steps out with Juniper for the grand opening.",
  "She met Juniper at her brother's wedding.",
  "Juniper is her brother in arms.",
  "Juniper works at her parent company.",
  "Ava is a single mom with a crush on Juniper.",
  "Juniper is her son's teacher.",
  "Mara's sister Juniper sings.",
  "Mara's older sister Juniper runs a bakery.",
  "Leo and Juniper are siblings.",
])
  assert.ok(!slurpCoupleKin(ava(text), kid), text);
assert.ok(!slurpCoupleKin(tie("a", "Ava", { cardPeople: [{ name: "Juniper", relation: "girlfriend" }] }), kid));
const lovers = slurpCoupleFit(ava("Ava and her sister Juniper are lovers."), kid);
assert.ok(lovers.fits && lovers.cards, "cards that say they are lovers make the couple");
for (const text of [
  "My sister Juniper is married to Tom.",
  "Her sister Juniper, who is dating Leo, lives nearby.",
  "My sister Juniper has a boyfriend.",
])
  assert.equal(
    slurpCoupleFit(ava(text), kid).misfit,
    "family",
    `a partner of someone else is no family couple: ${text}`,
  );
const at = new Date("2026-10-15T12:00:00Z");
const forced = slurpSetUpCouple([], mom, kid, { at, id: "c1" });
assert.ok(Array.isArray(forced) && forced[0]?.forced?.misfit === "family", "the player may set them up anyway");
assert.match(server("features/projects/slp-stir-ties.ts"), /family: \[409, /u);

// ── A page the player runs can be set polyamorous (#68) ──
const sheet = slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/features/stir/SlpStirCreatorSheet.tsx");
assert.match(
  sheet,
  /!creator\.automatic && !creator\.couplePage && \(\s*<SlpCreatorSteeringCard creatorId=\{creator\.id\} name=\{creator\.name\} relationshipOnly \/>/u,
);
assert.match(
  slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/features/creators/SlpCreatorSteeringCard.tsx"),
  /if \(relationshipOnly\)\s*return relationships \?/u,
);

// ── A Couples page is not flagged "linked source missing" (#31) ──
assert.match(
  server("data/creators/slp-creators-storage-3.ts"),
  /sourceStatus: slurpIsCouplePage\(account\)\s*\? \{ state: "current" as const \}/u,
);

// ── A model that is off gets a clear sign-up error (#74) ──
const refused = new TypeError("fetch failed", {
  cause: Object.assign(new Error("connect ECONNREFUSED ::1:5001"), { code: "ECONNREFUSED" }),
});
assert.equal(slpUnreachableCode(refused), "ECONNREFUSED");
assert.equal(slpUnreachableCode(new Error("API error 400: bad request")), null);
assert.equal(slpUnreachableCode(Object.assign(new Error("getaddrinfo"), { code: "ENOTFOUND" })), "ENOTFOUND");
assert.equal(
  slpUnreachableCode(Object.assign(new Error("socket hang up"), { code: "ECONNRESET" })),
  null,
  "a dropped line is not 'start the model'",
);
assert.match(server("features/onboarding/slp-scene-routes.ts"), /Slurp could not reach the connection/u);

// #35: one publish pass at a time, and spacing is read on the page that gets the post.
const publish = server("data/feed/reserve/slp-reserve-storage-2.ts");
assert.match(publish, /while \(publishing\) await publishing/u);
assert.match(publish, /eq\(slpPosts\.authorAccountId, author\.id\)/u);
assert.doesNotMatch(publish, /eq\(slpPosts\.authorAccountId, account\.id\)/u);
assert.match(
  publish,
  /author\.id !== account\.id\)[\s\S]{0,200}set\(\{ publishAt: new Date\(nextFree\)/u,
  "a shared-page post waits",
);

// #104: the spice angle sees other Creators' spicy posts, posted or prepared, and the subject list prepared ones.
assert.match(server("features/feed/slp-post-spice.ts"), /await listSlurpFeedSpice\(db, input\.account\.id, input\.at/u);
assert.match(server("data/feed/slp-feed-subjects-storage.ts"), /otherPreparedPosts\(db, creatorIds, at\)\)\.map/u);

console.log("slurp2 bug sweep regression: pass");
