/**
 * The messaging and relationship system, and whether any of it reaches the player.
 *
 * Every check here stands for a thing that was silently doing nothing: a comment layer that was
 * off, a reply that was written and never displayed, a relationship score fed by the wrong table.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  slurpCommissionChancePerDay,
  slurpMessageChancePerDay,
  slurpQuestionChancePerDay,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-world.js";
import {
  scoreSlurpRapport,
  emptySlurpRapportFacts,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-rapport.js";
import {
  slurpCreatorReplyChance,
  slurpCreatorOpenerKind,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-world.js";
import { slurpAudienceReaction } from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-world-copy.js";

const root = join(import.meta.dirname, "..", "packages/slurp/src/engine/packages");
const read = (path: string) => readFileSync(join(root, path), "utf8");

// ── The world must not be silent for a Creator nobody has grown yet ──────────
// `MIN_BASE_REACH` is 240, and the floors used to be 50 / 100 / 250. A brand-new Creator sat
// below the message floor outright: no unprompted message was reachable at any point, ever.
const NEW_CREATOR_REACH = 240;
assert.ok(slurpQuestionChancePerDay(NEW_CREATOR_REACH) > 0.25, "a new Creator must get comments in its first days");
assert.ok(slurpMessageChancePerDay(NEW_CREATOR_REACH) > 0, "a new Creator must be able to receive an unprompted DM");
assert.ok(slurpCommissionChancePerDay(NEW_CREATOR_REACH) > 0, "a new Creator must be able to be asked for something");
// Still bounded. The readable-handful rule caps notable events, and these are the notable ones.
assert.ok(slurpMessageChancePerDay(500_000) <= 0.3);
assert.ok(slurpCommissionChancePerDay(500_000) <= 0.5);
// Lowering the floors must not reorder the rates. An unprompted message is the strongest signal
// the world can send, so it stays the rarest thing it does — at every audience size, not on average.
for (let reach = 61; reach < 200_000; reach = Math.round(reach * 1.1)) {
  assert.ok(
    slurpMessageChancePerDay(reach) < slurpCommissionChancePerDay(reach),
    `a cold message outranked a commission at ${reach}`,
  );
  assert.ok(
    slurpCommissionChancePerDay(reach) < slurpQuestionChancePerDay(reach),
    `a commission outranked a comment at ${reach}`,
  );
}
// Growth must still mean something, or the dial is decoration.
assert.ok(slurpQuestionChancePerDay(4_000) > slurpQuestionChancePerDay(NEW_CREATOR_REACH));

// ── The comment layer has to be on ───────────────────────────────────────────
const slurpStorage = read("server/src/services/storage/slurp.storage.ts");
assert.match(slurpStorage, /fanActivityEnabled: true/u, "generated comments were off by default");
// One reply per run across up to twelve Creators is about one comment each per three days.
const replies = /fanRepliesPerRefresh: (\d+)/u.exec(slurpStorage);
assert.ok(replies && Number(replies[1]) >= 3, "one reply per run is not a comment section");
// Likes must outnumber comments by a wide margin, as they do on any real creator platform, and
// `slurp-reach.ts` already claims roughly that ratio in the counts it displays. Likes come from
// the free pulse rather than from a generated batch, so this asserts where they come from.
const likes = /fanLikesPerRefresh: (\d+)/u.exec(slurpStorage);
assert.ok(likes && Number(likes[1]) <= Number(replies![1]), "generated likes should not compete with the pulse");

// ── Likes have to arrive while the player is watching ────────────────────────
// The tick runs on every notifications read, which the client polls every 30s. The pulse saw
// ~0.5 elapsed minutes, floored its budget to zero at every audience size, and the tick mark
// consumed the time anyway — so the layer built for "likes arrive while you watch" produced
// nothing for exactly as long as anybody was watching.
const worldOp = read("server/src/services/slurp/slurp-world.operation.ts");
assert.match(worldOp, /PULSE_KEY/u, "the pulse needs its own mark or short ticks discard its time");
assert.match(worldOp, /elapsedMinutes: \(until\.getTime\(\) - pulseSince\.getTime\(\)\) \/ 60_000/u);
assert.match(worldOp, /if \(pulse\.length > 0 \|\| !\(await readPulseMark\(db\)\)\)/u);

// ── Rapport reads the pair, not the wallet ledger ────────────────────────────
// The ledger is capped at 60 entries across every creator, was matched by `note.includes(handle)`
// so `mia` collected `miamoon`'s tips, and double-counted a tip sent inside a thread.
const messagesStorage = read("server/src/services/storage/slurp-messages.storage.ts");
assert.doesNotMatch(messagesStorage, /entry\.note\.includes\(creatorHandle\)/u, "rapport still scans the ledger");
assert.match(messagesStorage, /facts\.tippedCoins = tie\.tipped/u);
assert.match(messagesStorage, /facts\.unlockedCoins = tie\.unlocked/u);
// A broadcast went to everybody, so it must not buy the reciprocity score.
assert.match(messagesStorage, /message\.kind !== "broadcast"/u);
// Money spent inside a thread has to reach the funnel like money spent anywhere else.
assert.match(messagesStorage, /unlocked: price/u);

// The score itself still behaves: silence costs, and it cannot leave the 0-100 band.
const whale = scoreSlurpRapport({ ...emptySlurpRapportFacts(), subscribed: true, tippedCoins: 400 });
const ghost = scoreSlurpRapport({
  ...emptySlurpRapportFacts(),
  subscribed: true,
  tippedCoins: 400,
  viewerMessages: 3,
  creatorMessages: 3,
  daysSinceViewerMessage: 60,
});
assert.ok(ghost.score < whale.score, "going quiet must cost something");
assert.ok(whale.score <= 100 && ghost.score >= 0);

// ── Writing to somebody must count as engagement ─────────────────────────────
// Every other action advanced the tie. A fan who wrote daily kept a `lastSeenAt` that never moved
// and was marked `cooling`, then `burnout`, for doing the most engaged thing available.
assert.match(messagesStorage, /advanceAudienceTie\(viewerAccountId, creatorAccountId, \{ stage: "viewer"/u);

// ── A message request gets exactly one answer ────────────────────────────────
const messageOperation = read("server/src/services/slurp/slurp-message.operation.ts");
assert.match(messageOperation, /thread\.state !== "active" && thread\.state !== "request"/u);
assert.match(messageOperation, /isRequest && history\.some\(\(message\) => message\.role === "creator"\)/u);
assert.doesNotMatch(messageOperation, /isRequest: false/u, "the cautious-first-reply branch was unreachable");

// ── A queued reply has to become visible ─────────────────────────────────────
// The scheduler wrote offline replies every 60s and neither message query polled, so the whole
// off-hours pacing model was invisible unless some unrelated mutation invalidated the cache.
const hooks = read("client/src/hooks/use-slurp.ts");
const threadsQuery = hooks.slice(hooks.indexOf("export function useSlurpThreads"));
assert.match(threadsQuery.slice(0, 1200), /refetchInterval: personaId \? 30_000 : false/u);
const threadQuery = hooks.slice(hooks.indexOf("export function useSlurpThread("));
assert.match(threadQuery.slice(0, 1400), /refetchInterval: threadId && personaId \? 30_000 : false/u);

// ── Comments must be a conversation, not parallel monologues ─────────────────
const fanService = read("server/src/services/slurp/slurp-fan-activity.service.ts");
assert.match(fanService, /comments\?: \{ id: string; from: string; text: string \}\[\]/u);
assert.match(fanService, /Each post lists the comments already under it/u);
assert.match(fanService, /parentInteractionId/u);
// A fan may only answer a real comment on the same post, and never themselves.
assert.match(slurpStorage, /parent\.actorAccountId !== input\.actorId/u);

// ── A fan's history must belong to the Creator they are commenting on ────────
// A run covers up to twelve Creators, and the ties were resolved once, for the first of them.
const fanOperation = read("server/src/services/slurp/slurp-fan-activity.operation.ts");
assert.doesNotMatch(fanOperation, /relationshipCreatorId/u);
assert.match(fanOperation, /run\.creatorIds\.map\(/u);

// ── The audience has to be able to pay ───────────────────────────────────────
// The world opened commissions from generated fans, and the accept route wants the player's
// persona, so the only path by which the audience ever paid the Creator dead-ended at `quoted`.
assert.match(messagesStorage, /settleAudienceCommission/u);
const worldOperation = read("server/src/services/slurp/slurp-world.operation.ts");
assert.match(worldOperation, /listQuotedCommissions/u);
assert.match(worldOperation, /member\.spendTier/u, "appetite decides, so the answer is about a person");
// Never the instant the price is named.
assert.match(worldOperation, /quotedFor < 1/u);

// ── Creators answer their audience, and who they answer means something ──────
// A creator answered only the player, and only when the player ticked a box. Everyone else wrote
// into a void. The rate is decided by what somebody is to this creator, so being a particular fan
// changes something visible rather than only changing a prompt nobody sees.
assert.ok(
  slurpCreatorReplyChance({ stage: "whale", spent: 900, interactions: 40 }) >
    slurpCreatorReplyChance({ stage: "liker", spent: 0, interactions: 2 }) * 3,
  "a whale and a passer-by must not be answered alike",
);
// Nobody is at zero. A stranger's first comment sometimes landing a reply is what makes them
// comment again; gating entirely on history means only people with history ever get anything.
assert.ok(slurpCreatorReplyChance(null) > 0.02, "a stranger must have some chance");
assert.ok(slurpCreatorReplyChance(null) < 0.15, "but not enough to make it meaningless");
// A creator who answers everything is a bot.
assert.ok(slurpCreatorReplyChance({ stage: "whale", spent: 99_999, interactions: 9_999 }) <= 0.8);

const worldRules = read("server/src/services/slurp/slurp-world.ts");
assert.match(worldRules, /SLURP_MAX_CREATOR_REPLIES_PER_TICK/u, "a wall of answers at once reads as a script");
// Deterministic, or a comment flips between answered and ignored across two ticks.
assert.match(worldOp, /slurpDeterministicUnit\(`\$\{account\.id\}:\$\{comment\.id\}`\)/u);
assert.match(worldOp, /comment\.actorAccountId === account\.id \|\| answered\.has\(comment\.id\)/u);

// ── The noise floor costs nothing ────────────────────────────────────────────
// Most comments on a real post are three words. Paying a model for the highest-volume and least
// readable text on the platform is the worst trade available, so it comes from a bank.
const bank = new Set<string>();
for (let index = 0; index < 5_000; index += 1) bank.add(slurpAudienceReaction(`post${index}:actor${index % 37}`));
assert.ok(bank.size > 300, `the reaction bank is too small to hide repetition (${bank.size})`);

// ── Tier 2 creator replies must not weaken the player-facing gate ────────────
// `claimNoodlerCreatorReply`'s access checks exist because the player is asking about their own
// comment; without them the endpoint hands back text about a locked post they never paid for.
// Audience replies get a second, narrower door rather than a hole in that one.
assert.match(slurpStorage, /async claimNoodlerAudienceReply\(/u);
assert.match(slurpStorage, /canViewNoodlerPost\(\{/u, "the player-facing access check must survive");
const audienceClaim = slurpStorage.slice(
  slurpStorage.indexOf("async claimNoodlerAudienceReply("),
  slurpStorage.indexOf("Release a claim whose generation never produced a reply"),
);
// Only somebody the world invented. A real persona's comment belongs to the checked path.
assert.match(audienceClaim, /from\(slurpPopulation\)/u);
assert.match(audienceClaim, /if \(!commenterRow\) return \{ status: "ineligible" \}/u);
// One reply per comment whichever tier wrote it, and a shared 24-hour spend ceiling.
assert.match(audienceClaim, /if \(strandedReply\) return \{ status: "duplicate" \}/u);
assert.match(audienceClaim, /recentClaims\.length >= ceiling/u);

// Unattended work never calls the model, so Tier 2 runs from a read, beside the pending-text drain.
const routes = read("server/src/routes/slurp.routes.ts");
assert.match(routes, /drainSlurpAudienceReplies\(app\.db\)/u);
const audienceOp = read("server/src/services/slurp/slurp-audience-reply.operation.ts");
assert.doesNotMatch(audienceOp, /startSlurp|scheduler|setTimeout/u, "a written reply must not run unattended");
// A failed generation must release the claim, or the comment is marked answered forever.
assert.match(audienceOp, /releaseNoodlerCreatorReplyClaim/u);

// ── Creators writing first has to stay rare ──────────────────────────────────
// The rapport model has measured silence since it shipped and nothing ever read the number.
const quietRegular = { tie: { stage: "follower", spent: 40, interactions: 20 }, daysSinceSeen: 21, hasThread: false };
assert.equal(slurpCreatorOpenerKind({ ...quietRegular, roll: 0.1 }), "missed");
assert.equal(slurpCreatorOpenerKind({ ...quietRegular, roll: 0.9 }), null, "even a missed regular is not certain");
// A conversation already open is not one a creator "opens".
assert.equal(slurpCreatorOpenerKind({ ...quietRegular, hasThread: true, roll: 0.01 }), null);
// A stranger with no history is not somebody who went quiet.
assert.equal(
  slurpCreatorOpenerKind({ tie: null, daysSinceSeen: 30, hasThread: false, roll: 0.01 }),
  null,
  "a creator does not miss somebody they never met",
);
// But an ordinary fan still has a real, small chance — otherwise only whales hear from anybody.
assert.equal(
  slurpCreatorOpenerKind({
    tie: { stage: "liker", spent: 0, interactions: 2 },
    daysSinceSeen: 3,
    hasThread: false,
    roll: 0.005,
  }),
  "cold",
);
// And it must stay small. Rolled once per pair per day, so this is the monthly rate too.
let cold = 0;
for (let index = 0; index < 10_000; index += 1) {
  if (
    slurpCreatorOpenerKind({
      tie: { stage: "liker", spent: 0, interactions: 2 },
      daysSinceSeen: 3,
      hasThread: false,
      roll: index / 10_000,
    }) !== null
  )
    cold += 1;
}
assert.ok(cold / 10_000 < 0.03, `an unprompted message stops meaning anything in bulk (${cold / 100}%)`);

console.log("slurp alive regression passed");
