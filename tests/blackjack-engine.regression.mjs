// Blackjack rules, run against the engine the package actually ships: packages/blackjack/server.mjs registers it
// through api.registerTurnGameEngine, so this test catches a rebuild that drifted from the source as well as a rule bug.
// Run: node tests/blackjack-engine.regression.mjs
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const server = resolve(import.meta.dirname, "../packages/blackjack/server.mjs");
const { activate } = await import(pathToFileURL(server).href);

let engine = null;
let command = null;
const cleanup = await activate({
  api: {
    registerTurnGameEngine: (registered) => ((engine = registered), () => {}),
    registerConversationCommand: (registration) => ((command = registration), () => {}),
  },
});
assert.equal(typeof cleanup, "function");
assert.equal(engine?.gameType, "blackjack");
assert.deepEqual(
  { commandType: command?.commandType, tags: command?.tags },
  { commandType: "blackjack", tags: ["blackjack"] },
);

const SEATS = [
  { seatId: "you", kind: "human", displayName: "You" },
  { seatId: "bo", kind: "bot", characterId: "bo", displayName: "Bo" },
  { seatId: "mari", kind: "bot", characterId: "mari", displayName: "Mari" },
];
const RANKS = "23456789TJQKA";
const card = (code) => ({ rank: RANKS.indexOf(code[0]) + 2, suit: code[1] });
const play = (state, seatId, move) => {
  const result = engine.applyMove(state, seatId, move);
  assert.ok(result.ok, `${seatId} ${JSON.stringify(move)} failed: ${result.error}`);
  return result.state;
};
const fresh = (config = {}, seed = 7) =>
  engine.setup(engine.normalizeConfig({ dealerCharacterId: "mari", ...config }), SEATS, seed);

/** A round mid-play with exact cards: every player has bet `bet`, the dealer holds `dealer` face down. */
function table(base, hands, dealer, bet = 100) {
  const state = structuredClone(base);
  Object.assign(state, { status: "playing", bets: {}, hands: {}, activeHandIndex: {}, dealerRevealed: false });
  for (const [id, codes] of Object.entries(hands)) {
    const cards = codes.map(card);
    const natural = codes.length === 2 && codes.some((c) => c[0] === "A") && codes.some((c) => "TJQK".includes(c[0]));
    state.bets[id] = bet;
    state.bankrolls[id] -= bet;
    state.hands[id] = [
      {
        cards,
        bet,
        doubled: false,
        fromSplit: false,
        status: natural ? "blackjack" : "playing",
        outcome: null,
        net: 0,
      },
    ];
    state.activeHandIndex[id] = 0;
  }
  state.dealerCards = dealer.map(card);
  state.currentSeatId = state.playerSeatIds.find((id) => state.hands[id]?.[0]?.status === "playing") ?? null;
  return state;
}

// ── setup, config and the seated dealer ──────────────────────────────────────
{
  const config = engine.normalizeConfig({ startingBankroll: 5, minBet: 0, decks: 20, roundLimit: -3, extra: true });
  assert.deepEqual(config, {
    startingBankroll: 100,
    minBet: 1,
    decks: 8,
    dealerHitsSoft17: false,
    roundLimit: 0,
    dealerCharacterId: null,
  });
  assert.equal(
    engine.normalizeConfig({ startingBankroll: 400, minBet: 1000 }).minBet,
    100,
    "min bet caps at a quarter",
  );

  const state = fresh();
  assert.deepEqual(state.playerSeatIds, ["you", "bo"], "the dealer character sits out of the betting");
  assert.deepEqual(state.bankrolls, { you: 1000, bo: 1000 });
  assert.equal(state.status, "betting");
  assert.equal(engine.currentSeat(state), "you");
  assert.equal(engine.announcerCharacterId(state), "mari");
  const view = engine.publicView(state, "you");
  assert.equal(view.seats.find((seat) => seat.seatId === "mari").isDealer, true);
  assert.equal(view.yourActions.canBet, true);
  assert.match(engine.participantSummary(state, "mari"), /You are dealing for the house/);

  const housePlayers = engine.setup(engine.normalizeConfig({}), SEATS, 1).playerSeatIds;
  assert.deepEqual(housePlayers, ["you", "bo", "mari"], "with a house dealer every seat plays");
}

// ── betting: turn order, clamping, the deal, and the hidden hole card ────────
{
  let state = fresh();
  assert.equal(engine.applyMove(state, "bo", { type: "bet", amount: 50 }).ok, false, "out of turn");
  assert.equal(engine.applyMove(state, "you", { type: "hit" }).ok, false, "no play before betting");
  state = play(state, "you", { type: "bet", amount: 5 });
  assert.equal(state.bets.you, 10, "a bet below the minimum is raised to it");
  state = play(state, "bo", { type: "bet", amount: 999_999 });
  assert.equal(state.bets.bo, 1000, "a bet above the bankroll is capped at it");
  assert.deepEqual(state.bankrolls, { you: 990, bo: 0 });
  assert.equal(state.dealerCards.length >= 2, true);
  assert.equal(state.hands.you[0].cards.length, 2);
  assert.equal(state.hands.bo[0].cards.length, 2);
  if (!state.dealerRevealed) assert.equal(engine.publicView(state, "you").dealerCards[1], null, "hole card face down");

  // Same seed, same moves, same cards: a rewind redeals identically.
  let again = fresh();
  again = play(again, "you", { type: "bet", amount: 5 });
  again = play(again, "bo", { type: "bet", amount: 999_999 });
  assert.deepEqual(again, state);
}

// ── settlement ───────────────────────────────────────────────────────────────
const base = fresh();
{
  // 20 beats 18, 16 loses to it, and the dealer stands on a hard 18 without drawing.
  let state = table(base, { you: ["Ks", "Qh"], bo: ["9c", "7d"] }, ["Kd", "8s"]);
  state = play(state, "you", { type: "stand" });
  assert.equal(engine.currentSeat(state), "bo");
  state = play(state, "bo", { type: "stand" });
  assert.equal(state.dealerCards.length, 2);
  assert.deepEqual(state.bankrolls, { you: 1100, bo: 900 });
  assert.equal(state.hands.you[0].outcome, "win");
  assert.equal(state.hands.bo[0].outcome, "lose");
  assert.equal(state.status, "round_over");
  assert.equal(engine.currentSeat(state), "you", "the human paces the next round");
  assert.deepEqual(engine.legalMoves(state, "bo"), []);
  assert.deepEqual(engine.legalMoves(state, "you"), [{ type: "next_round" }]);

  state = play(state, "you", { type: "next_round" });
  assert.equal(state.status, "betting");
  assert.equal(state.roundNumber, 2);
  assert.deepEqual(state.hands, {});
}
{
  // A natural pays 3 to 2; a push returns the stake.
  let state = table(base, { you: ["As", "Kh"], bo: ["Tc", "8d"] }, ["Td", "8s"]);
  assert.equal(engine.currentSeat(state), "bo", "a natural has nothing to play");
  state = play(state, "bo", { type: "stand" });
  assert.equal(state.hands.you[0].outcome, "blackjack");
  assert.equal(state.bankrolls.you, 1150);
  assert.equal(state.hands.bo[0].outcome, "push");
  assert.equal(state.bankrolls.bo, 1000);
}
{
  // A dealer over 21 pays every standing hand.
  let state = table(base, { you: ["Ts", "2h"], bo: ["9c", "4d"] }, ["Kd", "6s", "Qc"]);
  state = play(state, "you", { type: "stand" });
  state = play(state, "bo", { type: "stand" });
  assert.deepEqual(state.bankrolls, { you: 1100, bo: 1100 });
}
{
  // Soft 17: the dealer stands under S17 and draws under H17.
  const s17 = play(table(base, { you: ["Ts", "8h"] }, ["Ad", "6s"]), "you", { type: "stand" });
  assert.equal(s17.dealerCards.length, 2);
  const h17Base = fresh({ dealerHitsSoft17: true });
  const h17 = play(table(h17Base, { you: ["Ts", "8h"] }, ["Ad", "6s"]), "you", { type: "stand" });
  assert.ok(h17.dealerCards.length >= 3);
}
{
  // Busting ends the hand at once; with every hand bust the dealer draws nothing.
  let busted = null;
  for (let cursor = 0; cursor < 20 && !busted; cursor++) {
    const state = { ...table(base, { you: ["Ts", "Qh"] }, ["5d", "6s"]), shoeCursor: cursor };
    const next = play(state, "you", { type: "hit" });
    if (next.hands.you[0].status === "busted") busted = next;
  }
  assert.ok(busted, "found a busting hit");
  assert.equal(busted.dealerCards.length, 2);
  assert.equal(busted.bankrolls.you, 900);
  assert.equal(busted.hands.you[0].outcome, "lose");
}

// ── doubling and splitting ───────────────────────────────────────────────────
{
  let state = table(base, { you: ["6s", "5h"], bo: ["Tc", "8d"] }, ["Kd", "8s"]);
  assert.ok(engine.legalMoves(state, "you").some((move) => move.type === "double"));
  state = play(state, "you", { type: "double" });
  assert.equal(state.hands.you[0].bet, 200);
  assert.equal(state.hands.you[0].cards.length, 3);
  assert.equal(state.bankrolls.you, 800);
  assert.equal(engine.currentSeat(state), "bo", "a double takes one card and stands");

  const three = table(base, { you: ["2s", "3h", "4d"] }, ["Kd", "8s"]);
  assert.equal(engine.applyMove(three, "you", { type: "double" }).ok, false);
}
{
  let state = table(base, { you: ["8s", "8h"], bo: ["Tc", "8d"] }, ["Kd", "8s"]);
  assert.ok(engine.legalMoves(state, "you").some((move) => move.type === "split"));
  state = play(state, "you", { type: "split" });
  assert.equal(state.hands.you.length, 2);
  assert.equal(state.bankrolls.you, 800);
  assert.deepEqual(
    state.hands.you.map((hand) => hand.cards[0]),
    [card("8s"), card("8h")],
  );
  assert.ok(!engine.legalMoves(state, "you").some((move) => move.type === "split"), "one split per round");

  // Split aces take one card each and stand, and a split 21 is paid as a plain win.
  let aces = table(base, { you: ["As", "Ah"], bo: ["Tc", "8d"] }, ["Kd", "9s"]);
  aces = play(aces, "you", { type: "split" });
  assert.deepEqual(
    aces.hands.you.map((hand) => hand.status === "stood" || hand.status === "busted"),
    [true, true],
  );
  assert.equal(engine.currentSeat(aces), "bo");
  aces.hands.you = aces.hands.you.map((hand) => ({ ...hand, cards: [hand.cards[0], card("Kc")] }));
  aces = play(aces, "bo", { type: "stand" });
  assert.deepEqual(
    aces.hands.you.map((hand) => [hand.outcome, hand.net]),
    [
      ["win", 100],
      ["win", 100],
    ],
  );
}

// ── the dealer peeks for blackjack before anyone acts ────────────────────────
{
  let found = false;
  for (let seed = 1; seed < 5000 && !found; seed++) {
    let state = fresh({}, seed);
    state = play(state, "you", { type: "bet", amount: 10 });
    state = play(state, "bo", { type: "bet", amount: 10 });
    const [up, hole] = state.dealerCards;
    const value = (c) => (c.rank === 14 ? 11 : Math.min(c.rank, 10));
    if (value(up) + value(hole) !== 21) continue;
    found = true;
    assert.equal(state.dealerRevealed, true);
    assert.equal(state.status, "round_over");
    for (const id of ["you", "bo"]) {
      const hand = state.hands[id][0];
      assert.equal(hand.cards.length, 2, "nobody acted");
      assert.equal(hand.outcome, hand.status === "blackjack" ? "push" : "lose");
    }
  }
  assert.ok(found, "found a dealer blackjack to check the peek");
}

// ── the session ends ─────────────────────────────────────────────────────────
{
  const broke = fresh({ startingBankroll: 100, minBet: 25 });
  let state = table(broke, { you: ["Ts", "6h"], bo: ["Tc", "9d"] }, ["Kd", "8s"]);
  state.bets.you = 100;
  state.hands.you[0].bet = 100;
  state.bankrolls.you = 0;
  state = play(state, "you", { type: "stand" });
  state = play(state, "bo", { type: "stand" });
  assert.equal(state.status, "finished", "the session ends when you are out of chips");
  assert.deepEqual(state.outSeatIds, ["you"]);
  assert.equal(state.winnerSeatId, "bo");
  assert.deepEqual(engine.isTerminal(state), { done: true, winnerSeatId: "bo" });
  assert.equal(engine.currentSeat(state), null);

  const limited = table(fresh({ roundLimit: 1 }), { you: ["Ks", "Qh"], bo: ["9c", "7d"] }, ["Kd", "8s"]);
  const done = play(play(limited, "you", { type: "stand" }), "bo", { type: "stand" });
  assert.equal(done.status, "finished", "the round limit ends the session");
  assert.equal(done.winnerSeatId, "you");
}

// ── model surface: the hole card never leaks, tools parse, bots never stall ──
{
  const state = table(base, { you: ["Ks", "2h"], bo: ["9c", "3d"] }, ["Kd", "9h"]);
  for (const text of [
    engine.spectatorSummary(state),
    engine.participantSummary(state, "bo"),
    engine.participantSummary(state, "mari"),
    engine.describeForModel(state, "you").boardSummary,
  ]) {
    assert.match(text, /K♦/);
    assert.doesNotMatch(text, /9♥/, "the hole card is hidden until the dealer turns it over");
  }
  assert.deepEqual(engine.pickFallbackMove(state, "you"), { type: "hit" });
  assert.deepEqual(engine.pickFallbackMove(table(base, { you: ["Ks", "8h"] }, ["Kd", "9h"]), "you"), { type: "stand" });
  assert.deepEqual(engine.pickFallbackMove(base, "you"), { type: "bet", amount: 10 });

  assert.deepEqual(engine.parseToolCall("blackjack_action", { action: "BET", amount: 55.9 }), {
    type: "bet",
    amount: 55,
  });
  assert.deepEqual(engine.parseToolCall("blackjack_action", { action: "Double" }), { type: "double" });
  assert.deepEqual(engine.parseToolCall("blackjack_action", { action: "fold" }), { type: "stand" });
  assert.equal(engine.parseToolCall("poker_action", { action: "call" }), null);
  assert.deepEqual(
    engine.toolManifests().map((tool) => tool.name),
    ["blackjack_action"],
  );
}

// ── dealer announcements drain once ──────────────────────────────────────────
{
  const drained = engine.drainAnnouncements(base);
  assert.ok(drained && drained.announcements.length > 0);
  assert.equal(drained.state.pendingAnnouncements.length, 0);
  assert.equal(base.pendingAnnouncements.length > 0, true, "draining does not mutate the input");
  assert.equal(engine.drainAnnouncements(drained.state), null);
}
{
  // Many rounds that nothing drains: a house table queues nothing, a character dealer's queue stays capped.
  const playRounds = (config) => {
    let state = engine.setup(engine.normalizeConfig(config), SEATS, 3);
    for (let round = 0; round < 25 && state.status !== "finished"; round++) {
      for (let move = 0; move < 40 && state.status !== "round_over" && state.status !== "finished"; move++) {
        const seat = engine.currentSeat(state);
        state = play(state, seat, engine.pickFallbackMove(state, seat));
      }
      if (state.status === "round_over") state = play(state, "you", { type: "next_round" });
    }
    return state;
  };
  const house = playRounds({});
  assert.ok(house.roundNumber > 3, "several rounds were played");
  assert.deepEqual(house.pendingAnnouncements, []);
  assert.equal(engine.publicView(house, "you").hasPendingAnnouncements, false);
  assert.equal(engine.drainAnnouncements(house), null);
  const dealt = playRounds({ dealerCharacterId: "mari" });
  assert.ok(dealt.pendingAnnouncements.length > 0 && dealt.pendingAnnouncements.length <= 30);
}

console.log("blackjack engine: OK");
