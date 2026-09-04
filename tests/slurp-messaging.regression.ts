import assert from "node:assert/strict";
import {
  admitSlurpThread,
  readSlurpCreatorMessaging,
  slurpMessagePreview,
  slurpReplyPacing,
  SLURP_DEFAULT_CREATOR_MESSAGING,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-messaging";
import {
  emptySlurpRapportFacts,
  scoreSlurpRapport,
  slurpRapportTier,
  SLURP_DEFAULT_RAPPORT_WEIGHTS,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-rapport";
import { slurpCreatorAvailability } from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-creator-schedule-context";

// ── Rapport ──────────────────────────────────────────────

const cold = scoreSlurpRapport(emptySlurpRapportFacts());
assert.equal(cold.score, 0, "A pair with no history must score zero");
assert.equal(cold.tier, "stranger");

const whale = scoreSlurpRapport({
  subscribed: true,
  subscribedDays: 200,
  lapsed: false,
  tippedCoins: 400,
  unlockedCoins: 300,
  commissionsDelivered: 6,
  viewerMessages: 120,
  creatorMessages: 120,
  averageViewerMessageLength: 400,
  daysSinceViewerMessage: 0,
});
assert.equal(whale.score, 100, "Maxing every positive signal must reach exactly 100");
assert.equal(whale.tier, "whale");

assert.ok(
  scoreSlurpRapport({ ...emptySlurpRapportFacts(), tippedCoins: 30 }).score >
    scoreSlurpRapport({ ...emptySlurpRapportFacts(), tippedCoins: 15 }).score,
  "More tipping must score higher",
);

// Diminishing returns: the first coins must move the score more than the last.
const first = scoreSlurpRapport({ ...emptySlurpRapportFacts(), tippedCoins: 20 }).score;
const later = scoreSlurpRapport({ ...emptySlurpRapportFacts(), tippedCoins: 120 }).score;
assert.ok(first / 20 > (later - first) / 100, "Tips must have diminishing returns, not a linear ramp");

// A brand-new thread must not be charged the silence penalty, or every first contact opens cold.
assert.equal(
  scoreSlurpRapport({ ...emptySlurpRapportFacts(), subscribed: true, daysSinceViewerMessage: null }).score,
  scoreSlurpRapport({ ...emptySlurpRapportFacts(), subscribed: true, daysSinceViewerMessage: 0 }).score,
  "Never having written must cost the same as having just written",
);

const silent = scoreSlurpRapport({
  ...emptySlurpRapportFacts(),
  subscribed: true,
  subscribedDays: 90,
  tippedCoins: 120,
  viewerMessages: 10,
  creatorMessages: 10,
  daysSinceViewerMessage: 60,
});
assert.ok(silent.score < whale.score, "Long silence must decay the score");

// Talking into a void must not buy warmth.
const ignored = scoreSlurpRapport({ ...emptySlurpRapportFacts(), viewerMessages: 60, creatorMessages: 0 });
const answered = scoreSlurpRapport({ ...emptySlurpRapportFacts(), viewerMessages: 60, creatorMessages: 60 });
assert.ok(answered.score > ignored.score, "An answered thread must outrank an ignored one");

assert.equal(slurpRapportTier(0), "stranger");
assert.equal(slurpRapportTier(100), "whale");

// Weights are editable per creator; zeroing one must remove exactly its contribution.
const noTips = scoreSlurpRapport(
  { ...emptySlurpRapportFacts(), subscribed: true, tippedCoins: 120 },
  { ...SLURP_DEFAULT_RAPPORT_WEIGHTS, tips: 0 },
);
assert.equal(noTips.score, SLURP_DEFAULT_RAPPORT_WEIGHTS.subscription, "A zero weight must contribute nothing");

// ── Admission ────────────────────────────────────────────

const subscribersOnly = SLURP_DEFAULT_CREATOR_MESSAGING;
assert.deepEqual(admitSlurpThread(subscribersOnly, { subscribed: true, existingState: null }), {
  allowed: true,
  state: "active",
  fee: 0,
});
assert.deepEqual(admitSlurpThread(subscribersOnly, { subscribed: false, existingState: null }), {
  allowed: true,
  state: "request",
  fee: 0,
});

const paid = readSlurpCreatorMessaging({ dmPolicy: "paid", requestFee: 12 });
assert.deepEqual(admitSlurpThread(paid, { subscribed: false, existingState: null }), {
  allowed: true,
  state: "active",
  fee: 12,
});
assert.deepEqual(admitSlurpThread(paid, { subscribed: true, existingState: null }), {
  allowed: true,
  state: "active",
  fee: 0,
});

const closed = readSlurpCreatorMessaging({ dmPolicy: "closed" });
assert.equal(admitSlurpThread(closed, { subscribed: false, existingState: null }).allowed, false);
assert.deepEqual(
  admitSlurpThread(closed, { subscribed: false, existingState: "active" }),
  { allowed: true, state: "active", fee: 0 },
  "Closing DMs must never strand a conversation already running",
);
assert.equal(
  admitSlurpThread(readSlurpCreatorMessaging({ dmPolicy: "open" }), { subscribed: false, existingState: "declined" })
    .allowed,
  false,
  "A declined thread must not reopen itself",
);
assert.equal(
  admitSlurpThread(paid, { subscribed: false, existingState: "declined" }).allowed,
  false,
  "Paying must not reopen a declined thread",
);

// A hand-edited settings blob must cost nothing.
assert.deepEqual(readSlurpCreatorMessaging({ dmPolicy: "nonsense", requestFee: -4 }), SLURP_DEFAULT_CREATOR_MESSAGING);
assert.deepEqual(readSlurpCreatorMessaging(null), SLURP_DEFAULT_CREATOR_MESSAGING);

// ── Pacing ───────────────────────────────────────────────

const stranger = scoreSlurpRapport(emptySlurpRapportFacts());
const online = slurpReplyPacing({
  online: true,
  rapport: stranger,
  subscribed: false,
  messageLength: 20,
  minutesUntilOnline: 0,
});
assert.equal(online.mode, "instant", "An online creator must answer without a queue");
assert.ok(online.typingMs >= 1200 && online.typingMs <= 4000, "The typing hold must stay short");

const offlineStranger = slurpReplyPacing({
  online: false,
  rapport: stranger,
  subscribed: false,
  messageLength: 20,
  minutesUntilOnline: 120,
});
assert.equal(offlineStranger.mode, "queued", "An offline creator must queue a stranger");
assert.ok(offlineStranger.notBeforeMs > 0);

const offlineWhale = slurpReplyPacing({
  online: false,
  rapport: whale,
  subscribed: true,
  messageLength: 200,
  minutesUntilOnline: 120,
});
assert.equal(offlineWhale.mode, "instant", "High rapport must buy an off-hours reply");

const offlineRegular = slurpReplyPacing({
  online: false,
  rapport: scoreSlurpRapport({ ...emptySlurpRapportFacts(), subscribed: true, tippedCoins: 10 }),
  subscribed: true,
  messageLength: 50,
  minutesUntilOnline: 120,
});
assert.ok(
  offlineRegular.mode === "queued" && offlineRegular.notBeforeMs < offlineStranger.notBeforeMs,
  "Warmth must shorten the wait without erasing it",
);

// ── Availability ─────────────────────────────────────────

const weekday = new Date(2026, 8, 2, 14, 0, 0); // A Wednesday.
const schedule = {
  weekStart: "2026-08-31T00:00:00.000Z",
  days: {
    Wednesday: [
      { time: "08:00", activity: "Waking up" },
      { time: "10:00", activity: "Filming a set" },
      { time: "16:00", activity: "Answering fans" },
      { time: "23:00", activity: "Sleeping" },
    ],
  },
};

const busy = slurpCreatorAvailability(schedule as never, weekday);
assert.equal(busy.online, false, "A creator on set is not reachable");
assert.equal(busy.minutesUntilOnline, 120, "The wait must run to the next reachable block");

assert.equal(slurpCreatorAvailability(schedule as never, new Date(2026, 8, 2, 17, 0, 0)).online, true);
assert.equal(
  slurpCreatorAvailability(schedule as never, new Date(2026, 8, 2, 3, 0, 0)).online,
  false,
  "Before the first block the previous night's activity still applies",
);
assert.equal(
  slurpCreatorAvailability(schedule as never, new Date(2026, 8, 2, 23, 30, 0)).minutesUntilOnline,
  null,
  "Nothing reachable left today must report an unknown wait, not a negative one",
);
assert.equal(slurpCreatorAvailability(null, weekday).online, true, "No schedule must mean always reachable");
assert.equal(
  slurpCreatorAvailability({ weekStart: schedule.weekStart, days: {} } as never, weekday).online,
  true,
  "An empty day must not read as permanently away",
);

// ── Previews ─────────────────────────────────────────────

assert.equal(slurpMessagePreview("tip", "", 25), "Tipped 25 coins");
assert.equal(slurpMessagePreview("ppv", "  something   new ", 8), "Locked: something new");
assert.equal(slurpMessagePreview("text", "hi ".repeat(80), 0).length <= 80, true, "Previews must stay on one row");

console.info("Slurp messaging regression passed.");
