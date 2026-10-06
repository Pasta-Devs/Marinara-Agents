/**
 * 0.3.5: the Slurp Support desk (packages/slurp2/docs/SUPPORT-DESK.md). Trust and suspicion, the
 * risk of being caught, challenges, contracts, leaving, tickets; the Creator's "desk" answer to an
 * Offer; notes never reach a prompt. Runs the pure rules; wiring pins at the end.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeSlpSupportDesk,
  normalizeSlpSupportDeskSettings,
  slpDeskAdjust,
  slpDeskAsk,
  slpDeskAttitudeFor,
  slpDeskDailyRisk,
  slpDeskGrantPerk,
  slpDeskReachFactor,
  slpDeskRiskFor,
  slpDeskSeed,
  slpDeskTick,
  slpDeskTier,
  SLP_DEFAULT_SUPPORT_DESK,
  SLP_DEFAULT_SUPPORT_DESK_SETTINGS,
  type SlpSupportDesk,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-support-desk.ts";
import {
  findPendingSlurpDeskOffer,
  slurpDeskAcceptedInput,
  readSlurpDeskReply,
  slurpDeskOfferOutcome,
  slurpDeskOfferSummary,
  slurpDeskPromptData,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-support-desk-talk.ts";
import {
  slurpDmTranscript,
  type SlurpDmLine,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-dm-roles.ts";
import { SLP_ACTIONS, SLP_ACTION_META } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-actions.ts";

const root = join(fileURLToPath(new URL("..", import.meta.url)), "packages/slurp2/src/engine/packages");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const DAY = 86_400_000;
const at = new Date("2026-09-29T12:00:00.000Z");
const later = (days: number) => new Date(at.getTime() + days * DAY);
const settings = SLP_DEFAULT_SUPPORT_DESK_SETTINGS;
const desk = (patch: Partial<SlpSupportDesk> = {}): SlpSupportDesk =>
  normalizeSlpSupportDesk({
    ...SLP_DEFAULT_SUPPORT_DESK,
    tickedAt: at.toISOString(),
    seededAt: at.toISOString(),
    ...patch,
  });
const tick = (value: SlpSupportDesk, days: number, patch: Partial<Parameters<typeof slpDeskTick>[1]> = {}) =>
  slpDeskTick(value, {
    at: later(days),
    settings,
    counts: { posts: 0, stories: 0 },
    rolls: [0.99, 0.99, 0],
    ...patch,
  });

// 1. The record reads defensively and keeps its bounds.
{
  const broken = normalizeSlpSupportDesk({
    trust: 900,
    suspicion: -4,
    badges: ["verified", "verified", "nope"],
    log: "x",
  });
  assert.equal(broken.trust, 100);
  assert.equal(broken.suspicion, 0);
  assert.deepEqual(broken.badges, ["verified"]);
  assert.deepEqual(broken.log, []);
  assert.deepEqual(normalizeSlpSupportDesk(null), SLP_DEFAULT_SUPPORT_DESK);
  // Settings: a partial object keeps the defaults, tickets are off unless asked for.
  const partial = normalizeSlpSupportDeskSettings({ tickets: "often", winBackDays: 99 });
  assert.equal(partial.tickets, "often");
  assert.equal(partial.winBackDays, 3, "an out-of-range value falls back to the default");
  assert.equal(normalizeSlpSupportDeskSettings(undefined).tickets, "off");
  assert.equal(normalizeSlpSupportDeskSettings(undefined).gamesWithYourCreators, false);
}

// 2. Tiers, trust and suspicion.
{
  assert.equal(slpDeskTier(-60), "wary");
  assert.equal(slpDeskTier(0), "neutral");
  assert.equal(slpDeskTier(40), "cooperative");
  assert.equal(slpDeskTier(80), "partner");
  const moved = slpDeskAdjust(desk({ trust: -40 }), { trust: -10, suspicion: 10, text: "t" }, settings, at);
  assert.equal(moved.trust, -50);
  assert.equal(moved.suspicion, 15, "suspicion rises faster at low trust");
  assert.equal(moved.log.at(-1)?.suspicion, 15);
  // Four asks inside a day cost trust.
  let asked = desk();
  for (let index = 0; index < 4; index += 1) asked = slpDeskAsk(asked, settings, at);
  assert.equal(asked.trust, -3);
  // Seeding: signed up by Support starts warmer, and only once.
  const seeded = slpDeskSeed(SLP_DEFAULT_SUPPORT_DESK, { signedUpBySupport: true, at });
  assert.equal(seeded.trust, 20);
  assert.equal(slpDeskSeed(seeded, { signedUpBySupport: false, at }).trust, 20);
}

// 3. The risk of being caught: none without suspicion, rising with it, the same odds at any tick pace.
{
  assert.equal(slpDeskDailyRisk(0), 0);
  assert.ok(slpDeskDailyRisk(80) > slpDeskDailyRisk(20));
  const oneDay = slpDeskRiskFor(50, DAY);
  const twoHalves = 1 - (1 - slpDeskRiskFor(50, DAY / 2)) ** 2;
  assert.ok(Math.abs(oneDay - twoHalves) < 1e-9);
  // Caught: trust drops, suspicion resets, the event is out.
  const caught = tick(desk({ suspicion: 90 }), 1, { rolls: [0, 0.99, 0] });
  assert.deepEqual(
    caught.events.map((event) => event.kind),
    ["caught"],
  );
  assert.equal(caught.desk.suspicion, 0);
  assert.ok(caught.desk.trust <= -35);
  // Shady moves off: never caught.
  assert.equal(
    tick(desk({ suspicion: 90 }), 1, { rolls: [0, 0.99, 0], settings: { ...settings, shadyMoves: false } }).events
      .length,
    0,
  );
  // Suspicion fades with time.
  assert.ok(tick(desk({ suspicion: 20 }), 2).desk.suspicion < 20);
}

// 4. Perks, reach, challenges, the contract.
{
  const featured = slpDeskGrantPerk(desk(), { kind: "feature", days: 2 }, settings, at);
  assert.equal(featured.favours, 1, "a perk earns Slurp a favour");
  assert.ok(featured.trust > 0);
  assert.ok(slpDeskReachFactor(featured, later(1)) > 1);
  assert.equal(slpDeskReachFactor(featured, later(3)), 1, "the feature runs out");
  assert.ok(slpDeskReachFactor(desk({ throttle: { until: later(1).toISOString(), factor: 0.3 } }), at) < 1);
  assert.equal(slpDeskReachFactor(desk({ pausedAt: at.toISOString() }), at), 0);

  const challenge = {
    id: "c1",
    metric: "stories" as const,
    count: 3,
    baseline: 2,
    progress: 0,
    until: later(7).toISOString(),
    reward: { kind: "coins" as const, coins: 100 },
    status: "active" as const,
    at: at.toISOString(),
  };
  const won = tick(desk({ challenges: [challenge] }), 1, { counts: { posts: 0, stories: 5 } });
  assert.equal(won.events[0]?.kind, "challenge-won");
  const failed = tick(desk({ challenges: [challenge] }), 8, { counts: { posts: 0, stories: 3 } });
  assert.equal(failed.events[0]?.kind, "challenge-failed");

  const contract = {
    id: "k1",
    postsPerWeek: 3,
    themes: [],
    weeklyBonus: 100,
    status: "active" as const,
    since: at.toISOString(),
    until: later(14).toISOString(),
    weekStart: at.toISOString(),
    weekBaseline: 10,
    broken: 0,
  };
  const weeks = tick(desk({ contract }), 15, { counts: { posts: 12, stories: 0 } });
  assert.deepEqual(
    weeks.events.map((event) => event.kind),
    ["contract-broken", "contract-broken", "contract-ended"],
    "two missed weeks, then the end",
  );
  assert.equal(weeks.desk.contract?.broken, 2);
  const kept = tick(desk({ contract }), 7, { counts: { posts: 14, stories: 0 } });
  assert.equal(kept.events[0]?.kind, "contract-kept");
}

// 5. Leaving: a warning at the bottom, a win-back above the line, paused when time runs out.
{
  const warned = tick(desk({ trust: -90 }), 1);
  assert.equal(warned.events[0]?.kind, "leave-warning");
  assert.ok(warned.desk.leaving);
  const wonBack = tick({ ...warned.desk, trust: -50 }, 2);
  assert.equal(wonBack.events[0]?.kind, "won-back");
  assert.equal(wonBack.desk.leaving, null);
  const left = tick(warned.desk, 5);
  assert.equal(left.events.at(-1)?.kind, "left");
  assert.ok(left.desk.pausedAt);
  assert.equal(tick(left.desk, 6).events.length, 0, "a Creator who left is skipped");
  // Leaving off: never.
  assert.equal(tick(desk({ trust: -90 }), 1, { settings: { ...settings, leaving: false } }).events.length, 0);
}

// 6. Tickets: off by default; on, a Creator writes in about their real situation.
{
  assert.equal(tick(desk(), 3, { rolls: [0.99, 0, 0] }).events.length, 0);
  const on = { ...settings, tickets: "often" as const };
  const throttled = desk({ throttle: { until: later(10).toISOString(), factor: 0.5 } });
  const ticket = tick(throttled, 3, { settings: on, rolls: [0.99, 0, 0.5] });
  assert.deepEqual(ticket.events, [{ kind: "ticket", topic: "views" }], "a throttled Creator asks about views");
  // An open ticket blocks a second one.
  const open = desk({
    ticket: {
      id: "t",
      kind: "help",
      topic: "x",
      status: "open",
      openedBy: "creator",
      openedAt: at.toISOString(),
      resolvedAt: null,
      rating: null,
    },
  });
  assert.equal(tick(open, 3, { settings: on, rolls: [0.99, 0, 0] }).events.length, 0);
  // R1: only topics Support has a lever for, and a topic rests 14 days per Creator.
  const topics = new Set(
    [0, 0.2, 0.4, 0.6, 0.8, 0.99].map(
      (roll) => (tick(desk(), 3, { settings: on, rolls: [0.99, 0, roll] }).events[0] as { topic?: string })?.topic,
    ),
  );
  assert.deepEqual([...topics].sort(), ["collab", "money", "views"], "never badges, a pushy fan or burnout");
  const first = tick(desk(), 3, { settings: on, rolls: [0.99, 0, 0] });
  assert.deepEqual(first.events, [{ kind: "ticket", topic: "views" }]);
  assert.equal(first.desk.ticketTopics.at(-1)?.topic, "views");
  const second = tick(first.desk, 4, { settings: on, rolls: [0.99, 0, 0] });
  assert.deepEqual(second.events, [{ kind: "ticket", topic: "collab" }], "views is resting");
  const third = tick(second.desk, 5, { settings: on, rolls: [0.99, 0, 0] });
  assert.deepEqual(third.events, [{ kind: "ticket", topic: "money" }]);
  assert.equal(tick(third.desk, 6, { settings: on, rolls: [0.99, 0, 0] }).events.length, 0, "every topic rests");
  assert.deepEqual(tick(third.desk, 20, { settings: on, rolls: [0.99, 0, 0] }).events, [
    { kind: "ticket", topic: "views" },
  ]);
  assert.deepEqual(normalizeSlpSupportDesk({}).ticketTopics, [], "older saves read as no history");
}

// 7. The attitude is read from the card, stable per Creator.
{
  assert.equal(slpDeskAttitudeFor("Mira, a jaded sarcastic streamer", "a"), "cynical");
  assert.equal(slpDeskAttitudeFor("Grateful and sweet", "a"), "loyal");
  assert.equal(slpDeskAttitudeFor("Just posts", "same-id"), slpDeskAttitudeFor("Just posts", "same-id"));
}

// 8. The Creator's answer: trust, the offer, intel, a rating.
{
  assert.equal(readSlurpDeskReply(null), null);
  const reply = readSlurpDeskReply({
    trust: "down",
    offer: "counter",
    counter: "  more coins ",
    intel: "null",
    rating: 9,
  });
  assert.deepEqual(reply, { trust: "down", offer: "counter", counter: "more coins", intel: "", rating: null });
  assert.equal(slurpDeskOfferOutcome(reply, true), "countered");
  assert.equal(slurpDeskOfferOutcome(reply, false), "accepted", "refusals off: they go along");
  assert.equal(slurpDeskOfferOutcome(null, true), null, "no answer leaves the offer waiting");
  const summary = slurpDeskOfferSummary("set-challenge", {
    accountId: "secret-id",
    metric: "stories",
    count: 3,
    reward: { perk: "coins", coins: 50 },
  });
  assert.doesNotMatch(summary, /secret-id/u, "ids never reach the model");
  assert.match(summary, /stories/u);
  const history = [
    {
      id: "1",
      role: "viewer",
      metadata: { deskOffer: { action: "add-idea", input: {}, summary: "old", status: "declined" } },
    },
    {
      id: "2",
      role: "viewer",
      metadata: { deskOffer: { action: "add-idea", input: {}, summary: "new", status: "pending" } },
    },
    { id: "3", role: "creator", metadata: {} },
  ];
  assert.equal(findPendingSlurpDeskOffer(history)?.messageId, "2");
  assert.equal(findPendingSlurpDeskOffer(history.slice(0, 1)), null);
  const data = slurpDeskPromptData({
    desk: desk({ trust: 70 }),
    settings: { ...settings, refusals: false },
    supportName: "Slurp Support",
    pendingOffer: findPendingSlurpDeskOffer(history)!.offer,
    ticketResolved: false,
  });
  assert.equal(data.pendingOffer, "new");
  assert.equal(data.youGoAlong, true);
  assert.match(String(data.standing), /trust Slurp Support/u);
}

// 9. A note is the player's own: no transcript carries it. An offer reads as an event with its answer.
{
  const line = (id: string, metadata: Record<string, unknown>, content = "hi"): SlurpDmLine =>
    ({
      id,
      role: "viewer",
      kind: "text",
      content,
      price: 0,
      unlockedAt: null,
      metadata,
      createdAt: at.toISOString(),
    }) as SlurpDmLine;
  const transcript = slurpDmTranscript(
    [
      line("n", { deskNote: true }, "secret plan"),
      line("o", { deskOffer: { summary: "a challenge", status: "accepted" } }, "want a challenge?"),
    ],
    {
      writer: "creator",
      creator: { name: "Mira", handle: "mira" },
      viewer: { name: "Slurp Support", handle: "slurpsupport" },
    },
  );
  assert.equal(transcript.length, 1);
  assert.doesNotMatch(JSON.stringify(transcript), /secret plan/u);
  assert.match(String(transcript[0]!.event), /made an offer: a challenge \(accepted\)/u);
}

// 10. Every desk action is in the action layer, off the deck.
for (const name of [
  "grant-perk",
  "set-challenge",
  "offer-contract",
  "cash-favour",
  "throttle-reach",
  "plant-rumour",
  "seed-trend",
  "warn-creator",
] as const) {
  assert.ok(SLP_ACTIONS[name], name);
  assert.equal(SLP_ACTION_META[name].category, "desk");
  assert.equal(SLP_ACTION_META[name].deck, false);
}

// 11. An accepted Offer is final: a lever that may still refuse is told to happen.
assert.deepEqual(slurpDeskAcceptedInput({ input: { aId: "a", bId: "b", happen: false } }), {
  aId: "a",
  bId: "b",
  happen: true,
});
assert.deepEqual(slurpDeskAcceptedInput({ input: { accountId: "a" } }), { accountId: "a" });

// Wiring pins.
{
  // A desk notice or note asks nobody for an answer, and never stands in for the line to answer.
  assert.match(
    read("server/src/slp/data/messages/slp-messages-storage-conversation.ts"),
    /metadata\?\.deskQuiet === true/u,
  );
  assert.match(read("server/src/slp/data/messages/slp-reply-storage-methods.ts"), /"deskQuiet":true/u);
  assert.match(read("server/src/slp/data/messages/slp-support-desk-thread.ts"), /deskQuiet: true/u);
  // A resend of the same request runs its move once (review 0.3.5).
  assert.match(
    read("server/src/slp/features/messages/slp-messages-send-routes.ts"),
    /!\("replayed" in sent && sent\.replayed\)/u,
  );
  // The desk pass writes the record first, then runs its lines, coins and switches.
  assert.match(read("server/src/slp/features/messages/desk/slp-desk-tick-operation.ts"), /if \(!written\) continue;/u);
  assert.match(
    read("server/src/slp/features/messages/slp-messages-thread-routes.ts"),
    /if \(isSlurpSupportThread\(thread\)\)\s+return \{\s+side,\s+desk:/u,
  );
  assert.match(read("server/src/slp/data/world/slp-story-engine-storage.ts"), /slpDeskReachFactor/u);
  assert.match(read("server/src/slp/features/messages/slp-message-operation.ts"), /applySlurpDeskTalk\(db,/u);
  assert.match(
    read("server/src/slp/features/world/slp-world-scheduler-service.ts"),
    /advanceSlurpSupportDesk\(app\.db\)/u,
  );
  assert.match(read("server/src/slp/workflows/slp-world-tick-workflow.ts"), /advanceSlurpSupportDesk\(app\.db\)/u);
  assert.match(read("server/src/slp/features/assist/slp-action-runner.ts"), /isSlpDeskLever\(name\)/u);
}

console.log("slurp2 support desk: ok");
