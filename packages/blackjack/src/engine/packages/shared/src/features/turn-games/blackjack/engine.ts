// ──────────────────────────────────────────────
// Blackjack — deterministic engine (server-authoritative)
// ──────────────────────────────────────────────
// Pure functions over BlackjackState. Each round: every player bets in seat
// order, the cards are dealt, each player plays their hands in seat order,
// then the engine plays the dealer and settles. The shoe is reshuffled from
// (seed, round) before every round, so rewinding a message redeals the same
// cards. Player hands are face up; only the dealer's hole card is hidden, and
// it stays out of every prompt and view until the dealer turns it over.

import type { GameEvent, ModelTurnView, MoveResult, Seat, TerminalResult, TurnGameEngine } from "../engine.types.js";
import { cloneState, nameOfSeat, recordEvent, setLastAction } from "../engine-utils.js";
import { buildDeck, cardCode, cardShort, type Card } from "../poker/deck.js";
import { deterministicShuffle } from "../poker/rng.js";
import { BLACKJACK_TOOL_MANIFESTS, parseBlackjackToolCall } from "./tools.js";
import {
  BLACKJACK_LOG_CAP,
  BLACKJACK_MAX_PLAYERS,
  BLACKJACK_MIN_PLAYERS,
  DEFAULT_BLACKJACK_CONFIG,
  clampBlackjackConfig,
  type BlackjackConfig,
  type BlackjackHand,
  type BlackjackMove,
  type BlackjackPublicSeat,
  type BlackjackPublicView,
  type BlackjackState,
  type BlackjackYourActions,
} from "./types.js";

// ── small helpers ───────────────────────────────────────────────────────────

const clone = cloneState<BlackjackState>;
const nameOf = nameOfSeat;

/**
 * Log an event, return it with the move, and optionally queue it for the dealer to voice. Only a character dealer
 * voices anything, so a house table queues nothing; the queue is capped like the log in case nothing drains it.
 */
function emit(state: BlackjackState, events: GameEvent[], event: GameEvent, announce = false): void {
  events.push(event);
  recordEvent(state, event, BLACKJACK_LOG_CAP);
  if (!announce || !state.config.dealerCharacterId) return;
  state.pendingAnnouncements.push(event);
  if (state.pendingAnnouncements.length > BLACKJACK_LOG_CAP) {
    state.pendingAnnouncements.splice(0, state.pendingAnnouncements.length - BLACKJACK_LOG_CAP);
  }
}

function cardValue(card: Card): number {
  return card.rank === 14 ? 11 : Math.min(card.rank, 10);
}

/** Best total for a hand, counting aces as 11 while that does not bust. `soft` = an ace still counts 11. */
export function handTotal(cards: readonly Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    total += cardValue(card);
    if (card.rank === 14) aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

function isNatural(cards: readonly Card[]): boolean {
  return cards.length === 2 && handTotal(cards).total === 21;
}

function showCards(cards: readonly Card[]): string {
  return cards.map(cardShort).join(" ");
}

/** Next card of this round's shoe. A shoe that runs dry mid-round continues into a fresh shuffle. */
function drawCard(state: BlackjackState): Card {
  const shoe: Card[] = [];
  for (let deck = 0; deck < state.config.decks; deck++) shoe.push(...buildDeck());
  const pass = Math.floor(state.shoeCursor / shoe.length);
  const card = deterministicShuffle(shoe, state.seed, state.roundNumber * 1000 + pass)[state.shoeCursor % shoe.length]!;
  state.shoeCursor += 1;
  return card;
}

function humanSeatId(state: BlackjackState): string {
  return state.seats.find((seat) => seat.kind === "human")?.seatId ?? state.seatOrder[0]!;
}

/** Players still in the session. */
function activePlayers(state: BlackjackState): string[] {
  return state.playerSeatIds.filter((id) => !state.outSeatIds.includes(id));
}

function isDealerSeat(state: BlackjackState, seatId: string): boolean {
  return (
    !!state.config.dealerCharacterId &&
    seatId === state.config.dealerCharacterId &&
    !state.playerSeatIds.includes(seatId)
  );
}

function currentHand(state: BlackjackState, seatId: string): BlackjackHand | null {
  return state.hands[seatId]?.[state.activeHandIndex[seatId] ?? 0] ?? null;
}

function canDouble(state: BlackjackState, seatId: string): boolean {
  const hand = currentHand(state, seatId);
  return !!hand && hand.status === "playing" && hand.cards.length === 2 && (state.bankrolls[seatId] ?? 0) >= hand.bet;
}

function canSplit(state: BlackjackState, seatId: string): boolean {
  const hands = state.hands[seatId] ?? [];
  const hand = hands[0];
  return (
    hands.length === 1 &&
    !!hand &&
    hand.status === "playing" &&
    hand.cards.length === 2 &&
    cardValue(hand.cards[0]!) === cardValue(hand.cards[1]!) &&
    (state.bankrolls[seatId] ?? 0) >= hand.bet
  );
}

function betRange(state: BlackjackState, seatId: string): { min: number; max: number } {
  return { min: state.config.minBet, max: state.bankrolls[seatId] ?? 0 };
}

function handLine(hand: BlackjackHand): string {
  const { total, soft } = handTotal(hand.cards);
  const tags = [
    hand.status === "blackjack" ? "blackjack" : hand.status === "busted" ? "bust" : `${soft ? "soft " : ""}${total}`,
    hand.doubled ? "doubled" : null,
  ].filter(Boolean);
  return `${showCards(hand.cards)} (${tags.join(", ")})`;
}

function dealerLine(state: BlackjackState): string {
  const [up] = state.dealerCards;
  if (!up) return "The dealer has no cards yet.";
  if (!state.dealerRevealed) return `Dealer shows ${cardShort(up)} (hole card face down).`;
  const { total } = handTotal(state.dealerCards);
  return `Dealer has ${showCards(state.dealerCards)} (${total > 21 ? `bust, ${total}` : total}).`;
}

// ── round flow ────────────────────────────────────────────────────────────────

function startRound(state: BlackjackState, events: GameEvent[]): void {
  state.status = "betting";
  state.bets = {};
  state.hands = {};
  state.activeHandIndex = {};
  state.dealerCards = [];
  state.dealerRevealed = false;
  state.shoeCursor = 0;
  state.currentSeatId = activePlayers(state)[0] ?? null;
  const of = state.config.roundLimit > 0 ? ` of ${state.config.roundLimit}` : "";
  emit(
    state,
    events,
    {
      type: "round_started",
      message: `Round ${state.roundNumber}${of}: place your bets (minimum ${state.config.minBet}).`,
      data: { round: state.roundNumber },
    },
    true,
  );
}

function deal(state: BlackjackState, events: GameEvent[]): void {
  const players = activePlayers(state).filter((id) => state.bets[id] !== undefined);
  for (const id of players) {
    state.hands[id] = [
      { cards: [], bet: state.bets[id]!, doubled: false, fromSplit: false, status: "playing", outcome: null, net: 0 },
    ];
    state.activeHandIndex[id] = 0;
  }
  for (let pass = 0; pass < 2; pass++) {
    for (const id of players) state.hands[id]![0]!.cards.push(drawCard(state));
    state.dealerCards.push(drawCard(state));
  }
  const naturals: string[] = [];
  for (const id of players) {
    const hand = state.hands[id]![0]!;
    if (isNatural(hand.cards)) {
      hand.status = "blackjack";
      naturals.push(nameOf(state, id));
    }
  }

  const up = state.dealerCards[0]!;
  const dealt = players.map((id) => `${nameOf(state, id)} ${handLine(state.hands[id]![0]!)}`).join("; ");
  emit(
    state,
    events,
    {
      type: "cards_dealt",
      message:
        `Cards are out. Dealer shows ${cardShort(up)}. ${dealt}.` +
        (naturals.length ? ` Blackjack for ${naturals.join(" and ")}!` : ""),
      data: { dealerUp: cardCode(up) },
    },
    true,
  );

  // The dealer peeks under an ace or a ten-value card, so a dealer blackjack ends the round before anyone acts.
  if ((up.rank === 14 || cardValue(up) === 10) && isNatural(state.dealerCards)) {
    state.dealerRevealed = true;
    emit(
      state,
      events,
      {
        type: "dealer_blackjack",
        message: `Dealer peeks and turns over ${cardShort(state.dealerCards[1]!)}: blackjack.`,
      },
      true,
    );
    settle(state, events);
    return;
  }
  state.status = "playing";
  advance(state, events);
}

/** Point the turn at the first unfinished hand at the table, or play the dealer when there is none. */
function advance(state: BlackjackState, events: GameEvent[]): void {
  for (const id of state.playerSeatIds) {
    const index = (state.hands[id] ?? []).findIndex((hand) => hand.status === "playing");
    if (index >= 0) {
      state.currentSeatId = id;
      state.activeHandIndex[id] = index;
      return;
    }
  }
  playDealer(state, events);
}

function playDealer(state: BlackjackState, events: GameEvent[]): void {
  state.currentSeatId = null;
  state.dealerRevealed = true;
  const hole = state.dealerCards[1]!;
  // With every hand busted or paid as a blackjack, the dealer has nothing to play for.
  const contested = Object.values(state.hands).some((hands) =>
    hands.some((hand) => hand.status === "stood" || hand.status === "playing"),
  );
  const drawn: Card[] = [];
  while (contested) {
    const { total, soft } = handTotal(state.dealerCards);
    if (total > 17 || (total === 17 && !(soft && state.config.dealerHitsSoft17))) break;
    const card = drawCard(state);
    state.dealerCards.push(card);
    drawn.push(card);
  }
  const { total } = handTotal(state.dealerCards);
  const ending = !contested ? "" : total > 21 ? ` and busts with ${total}` : ` and stands on ${total}`;
  emit(
    state,
    events,
    {
      type: "dealer_played",
      message:
        `Dealer turns over ${cardShort(hole)} for ${handTotal(state.dealerCards.slice(0, 2)).total}` +
        (drawn.length ? `, draws ${showCards(drawn)}` : "") +
        `${ending}.`,
      data: { dealerCards: state.dealerCards.map(cardCode) },
    },
    true,
  );
  settle(state, events);
}

function settle(state: BlackjackState, events: GameEvent[]): void {
  state.currentSeatId = null;
  const dealer = handTotal(state.dealerCards).total;
  const dealerNatural = isNatural(state.dealerCards);
  const results: string[] = [];
  for (const id of state.playerSeatIds) {
    const hands = state.hands[id];
    if (!hands) continue;
    let net = 0;
    for (const hand of hands) {
      const player = handTotal(hand.cards).total;
      let returned = 0;
      if (dealerNatural) {
        hand.outcome = hand.status === "blackjack" ? "push" : "lose";
        returned = hand.status === "blackjack" ? hand.bet : 0;
      } else if (hand.status === "busted") {
        hand.outcome = "lose";
      } else if (hand.status === "blackjack") {
        hand.outcome = "blackjack";
        returned = hand.bet + Math.floor((hand.bet * 3) / 2);
      } else if (dealer > 21 || player > dealer) {
        hand.outcome = "win";
        returned = hand.bet * 2;
      } else if (player === dealer) {
        hand.outcome = "push";
        returned = hand.bet;
      } else {
        hand.outcome = "lose";
      }
      hand.net = returned - hand.bet;
      state.bankrolls[id] = (state.bankrolls[id] ?? 0) + returned;
      net += hand.net;
    }
    results.push(`${nameOf(state, id)} ${net > 0 ? `wins ${net}` : net < 0 ? `loses ${-net}` : "pushes"}`);
  }
  state.roundsCompleted += 1;
  emit(
    state,
    events,
    { type: "round_settled", message: `${results.join(", ")}.`, data: { round: state.roundNumber } },
    true,
  );

  for (const id of activePlayers(state)) {
    if ((state.bankrolls[id] ?? 0) < state.config.minBet) {
      state.outSeatIds.push(id);
      emit(state, events, { type: "player_out", seatId: id, message: `${nameOf(state, id)} is out of chips.` }, true);
    }
  }

  const human = humanSeatId(state);
  const limitReached = state.config.roundLimit > 0 && state.roundsCompleted >= state.config.roundLimit;
  if (limitReached || activePlayers(state).length === 0 || state.outSeatIds.includes(human)) {
    finish(state, events);
    return;
  }
  state.status = "round_over";
  state.currentSeatId = human;
}

function finish(state: BlackjackState, events: GameEvent[]): void {
  state.status = "finished";
  state.currentSeatId = null;
  const ranked = [...state.playerSeatIds].sort((a, b) => (state.bankrolls[b] ?? 0) - (state.bankrolls[a] ?? 0));
  const top = ranked[0];
  const topChips = top ? (state.bankrolls[top] ?? 0) : 0;
  const tied = ranked.filter((id) => (state.bankrolls[id] ?? 0) === topChips).length > 1;
  state.winnerSeatId = top && topChips > 0 && !tied ? top : null;
  const standings = ranked.map((id) => `${nameOf(state, id)} ${state.bankrolls[id] ?? 0}`).join(", ");
  emit(
    state,
    events,
    {
      type: "game_over",
      ...(state.winnerSeatId ? { seatId: state.winnerSeatId } : {}),
      message: state.winnerSeatId
        ? `The session is over. ${nameOf(state, state.winnerSeatId)} leaves the table richest. Final chips: ${standings}.`
        : topChips > 0
          ? `The session is over in a tie. Final chips: ${standings}.`
          : "The house wins: everyone is out of chips.",
    },
    true,
  );
}

// ── moves ─────────────────────────────────────────────────────────────────────

function legalMovesFor(state: BlackjackState, seatId: string): BlackjackMove[] {
  if (state.status === "round_over") return state.currentSeatId === seatId ? [{ type: "next_round" }] : [];
  if (state.status === "finished" || state.currentSeatId !== seatId) return [];
  if (state.status === "betting") {
    const { min, max } = betRange(state, seatId);
    return max > min
      ? [
          { type: "bet", amount: min },
          { type: "bet", amount: max },
        ]
      : [{ type: "bet", amount: min }];
  }
  const moves: BlackjackMove[] = [{ type: "hit" }, { type: "stand" }];
  if (canDouble(state, seatId)) moves.push({ type: "double" });
  if (canSplit(state, seatId)) moves.push({ type: "split" });
  return moves;
}

function finishHand(hand: BlackjackHand): void {
  const { total } = handTotal(hand.cards);
  if (total > 21) hand.status = "busted";
  else if (total === 21 && hand.status === "playing") hand.status = "stood";
}

// ── prompt builders ─────────────────────────────────────────────────────────

function seatLine(state: BlackjackState, id: string): string {
  const chips = `${state.bankrolls[id] ?? 0} chips`;
  if (state.outSeatIds.includes(id)) return `${nameOf(state, id)}: out of chips`;
  const hands = state.hands[id];
  if (hands?.length)
    return `${nameOf(state, id)}: ${hands.map(handLine).join(" | ")}, bet ${hands.reduce((sum, hand) => sum + hand.bet, 0)}, ${chips} behind`;
  const bet = state.bets[id];
  return `${nameOf(state, id)}: ${chips}${bet !== undefined ? `, bet ${bet}` : ""}`;
}

function buildSpectatorSummary(state: BlackjackState): string {
  if (state.status === "finished") {
    const last = [...state.log].reverse().find((event) => event.type === "game_over");
    return `The blackjack session just ended after ${state.roundsCompleted} round${state.roundsCompleted === 1 ? "" : "s"}. ${last?.message ?? ""}`.trim();
  }
  const dealer = state.config.dealerCharacterId ? (state.seatNames[state.config.dealerCharacterId] ?? null) : null;
  const lines = [
    `A game of blackjack is in progress at the table, round ${state.roundNumber} (minimum bet ${state.config.minBet})${dealer ? `, with ${dealer} dealing` : ""}.`,
    dealerLine(state),
    ...state.playerSeatIds.map((id) => seatLine(state, id)),
  ];
  if (state.status === "round_over") {
    const last = [...state.log].reverse().find((event) => event.type === "round_settled");
    if (last) lines.push(`Last round: ${last.message}`);
  }
  return lines.join("\n");
}

function buildParticipantSummary(state: BlackjackState, seatId: string): string {
  const base = buildSpectatorSummary(state);
  if (isDealerSeat(state, seatId)) {
    return `${base}\nYou are dealing for the house: you play no hand, and you never look at your hole card before it is turned over.`;
  }
  if (!state.playerSeatIds.includes(seatId)) return base;
  const lines = [base, `You are ${nameOf(state, seatId)}, with ${state.bankrolls[seatId] ?? 0} chips.`];
  if (state.status !== "finished" && state.currentSeatId === seatId) {
    lines.push(
      state.status === "betting"
        ? "It is YOUR turn to bet."
        : state.status === "playing"
          ? "It is YOUR turn to play your hand."
          : "",
    );
  }
  return lines.filter(Boolean).join("\n");
}

function buildBoardSummary(state: BlackjackState, seatId: string): string {
  const lines = [
    `Blackjack, round ${state.roundNumber}. You are ${nameOf(state, seatId)}. Blackjack pays 3 to 2; the dealer ${state.config.dealerHitsSoft17 ? "hits" : "stands on"} soft 17.`,
    dealerLine(state),
    "Table:",
    ...state.playerSeatIds.map((id) => `- ${seatLine(state, id)}`),
  ];
  const hand = currentHand(state, seatId);
  if (state.status === "playing" && hand) {
    const count = state.hands[seatId]?.length ?? 1;
    lines.push(
      `Your hand${count > 1 ? ` (${(state.activeHandIndex[seatId] ?? 0) + 1} of ${count})` : ""}: ${handLine(hand)}, bet ${hand.bet}.`,
    );
  }
  return lines.join("\n");
}

function buildInstructions(state: BlackjackState, seatId: string): string {
  if (state.status === "betting") {
    const { min, max } = betRange(state, seatId);
    return (
      `Legal actions: bet: min ${min} max ${max}. ` +
      "Bet like YOUR character: a cautious one bets small and steady, a bold or reckless one swings big, a superstitious " +
      'one rides a hot streak or chases a loss. Call blackjack_action with action "bet" and an amount.'
    );
  }
  const actions = ["hit", "stand"];
  if (canDouble(state, seatId)) actions.push("double");
  if (canSplit(state, seatId)) actions.push("split");
  return (
    `Legal actions: ${actions.join(" | ")}. ` +
    "The dealer must draw to 17. Play like YOUR character, not like a strategy chart: a careful one stands early, a " +
    "gambler doubles on a hunch, a proud one refuses to stand on a weak total. Never invent cards. Call " +
    "blackjack_action with exactly one action."
  );
}

/** A deterministic legal move, so a misbehaving bot can never stall the table. */
function pickFallback(state: BlackjackState, seatId: string): BlackjackMove {
  if (state.status === "round_over") return { type: "next_round" };
  if (state.status === "betting") return { type: "bet", amount: state.config.minBet };
  const hand = currentHand(state, seatId);
  return hand && handTotal(hand.cards).total < 17 ? { type: "hit" } : { type: "stand" };
}

// ── the engine object ───────────────────────────────────────────────────────

export const blackjackEngine: TurnGameEngine<BlackjackState, BlackjackMove, BlackjackConfig, BlackjackPublicView> = {
  gameType: "blackjack",
  schemaVersion: 1,
  label: "Blackjack",
  minPlayers: BLACKJACK_MIN_PLAYERS,
  maxPlayers: BLACKJACK_MAX_PLAYERS,
  // Player hands are dealt face up; the only secret is the dealer's hole card, which no seat sees.
  hiddenInformation: false,

  defaultConfig() {
    return { ...DEFAULT_BLACKJACK_CONFIG };
  },

  normalizeConfig(config) {
    return clampBlackjackConfig(config && typeof config === "object" ? (config as Record<string, unknown>) : null);
  },

  setup(config, seats: Seat[], seed) {
    const seatNames: Record<string, string> = {};
    for (const seat of seats) seatNames[seat.seatId] = seat.displayName;
    // A seated dealer character is the house: they voice the table but never bet.
    const players = seats.filter((seat) => seat.seatId !== config.dealerCharacterId).map((seat) => seat.seatId);
    const playerSeatIds = players.length > 0 ? players : seats.map((seat) => seat.seatId);
    const bankrolls: Record<string, number> = {};
    for (const id of playerSeatIds) bankrolls[id] = config.startingBankroll;

    const state: BlackjackState = {
      config,
      seed,
      seats: seats.map((seat) => ({ seatId: seat.seatId, displayName: seat.displayName, kind: seat.kind })),
      seatOrder: seats.map((seat) => seat.seatId),
      seatNames,
      playerSeatIds,
      bankrolls,
      outSeatIds: [],
      status: "betting",
      roundNumber: 1,
      roundsCompleted: 0,
      shoeCursor: 0,
      bets: {},
      hands: {},
      activeHandIndex: {},
      dealerCards: [],
      dealerRevealed: false,
      currentSeatId: null,
      winnerSeatId: null,
      pendingAnnouncements: [],
      lastAction: null,
      log: [],
    };
    const events: GameEvent[] = [];
    emit(state, events, {
      type: "game_started",
      message: `${playerSeatIds.map((id) => seatNames[id]).join(", ")} sit down at the blackjack table with ${config.startingBankroll} chips each.`,
    });
    startRound(state, events);
    return state;
  },

  currentSeat(state) {
    return state.status === "finished" ? null : state.currentSeatId;
  },

  interruptibleSeats() {
    return [];
  },

  legalMoves(state, seatId) {
    return legalMovesFor(state, seatId);
  },

  applyMove(state, seatId, move): MoveResult<BlackjackState, BlackjackMove> {
    const fail = (error: string): MoveResult<BlackjackState, BlackjackMove> => ({
      ok: false,
      error,
      legalMoves: legalMovesFor(state, seatId),
    });
    if (state.status === "finished") return fail("The game is already over.");
    if (state.currentSeatId !== seatId) return fail("It's not your turn.");

    const s = clone(state);
    const events: GameEvent[] = [];
    const name = nameOf(s, seatId);

    if (move?.type === "next_round") {
      if (s.status !== "round_over") return fail("It's not time for the next round yet.");
      s.roundNumber += 1;
      startRound(s, events);
      return { ok: true, state: s, events };
    }
    if (s.status === "round_over") return fail("The round is over. Deal the next round first.");

    if (s.status === "betting") {
      if (move?.type !== "bet") return fail("Place your bet first.");
      const { min, max } = betRange(s, seatId);
      const raw = Number.isFinite(move.amount) ? Math.floor(move.amount) : min;
      const amount = Math.min(max, Math.max(min, raw));
      s.bankrolls[seatId] = (s.bankrolls[seatId] ?? 0) - amount;
      s.bets[seatId] = amount;
      setLastAction(s, seatId, `bets ${amount}`);
      emit(s, events, { type: "bet_placed", seatId, message: `${name} bets ${amount}.`, data: { amount } });
      const next = activePlayers(s).find((id) => s.bets[id] === undefined);
      if (next) s.currentSeatId = next;
      else deal(s, events);
      return { ok: true, state: s, events };
    }

    const hand = currentHand(s, seatId);
    if (!hand || hand.status !== "playing") return fail("You have no hand to play.");

    switch (move?.type) {
      case "hit": {
        const card = drawCard(s);
        hand.cards.push(card);
        finishHand(hand);
        const { total } = handTotal(hand.cards);
        setLastAction(s, seatId, `hits: ${cardShort(card)}`);
        emit(s, events, {
          type: total > 21 ? "busted" : "hit",
          seatId,
          message:
            total > 21
              ? `${name} hits, draws ${cardShort(card)} and busts with ${total}.`
              : `${name} hits and draws ${cardShort(card)} for ${total}.`,
          data: { card: cardCode(card), total },
        });
        break;
      }
      case "stand": {
        hand.status = "stood";
        setLastAction(s, seatId, `stands on ${handTotal(hand.cards).total}`);
        emit(s, events, { type: "stand", seatId, message: `${name} stands on ${handTotal(hand.cards).total}.` });
        break;
      }
      case "double": {
        if (!canDouble(s, seatId)) return fail("You can only double a two-card hand you can cover.");
        s.bankrolls[seatId] = (s.bankrolls[seatId] ?? 0) - hand.bet;
        hand.bet *= 2;
        hand.doubled = true;
        const card = drawCard(s);
        hand.cards.push(card);
        const { total } = handTotal(hand.cards);
        hand.status = total > 21 ? "busted" : "stood";
        setLastAction(s, seatId, `doubles: ${cardShort(card)}`);
        emit(s, events, {
          type: "double",
          seatId,
          message: `${name} doubles to ${hand.bet}, draws ${cardShort(card)} and ${total > 21 ? `busts with ${total}` : `has ${total}`}.`,
          data: { card: cardCode(card), total },
        });
        break;
      }
      case "split": {
        if (!canSplit(s, seatId))
          return fail("You can only split a pair once, and only if you can cover the second bet.");
        s.bankrolls[seatId] = (s.bankrolls[seatId] ?? 0) - hand.bet;
        const aces = hand.cards[0]!.rank === 14;
        const split: BlackjackHand[] = hand.cards.map((card) => ({
          cards: [card, drawCard(s)],
          bet: hand.bet,
          doubled: false,
          fromSplit: true,
          // Split aces take one card each and stand.
          status: aces ? "stood" : "playing",
          outcome: null,
          net: 0,
        }));
        for (const part of split) finishHand(part);
        s.hands[seatId] = split;
        s.activeHandIndex[seatId] = 0;
        setLastAction(s, seatId, "splits");
        emit(s, events, {
          type: "split",
          seatId,
          message: `${name} splits into ${split.map(handLine).join(" and ")}.`,
        });
        break;
      }
      default:
        return fail("Unknown move. Choose hit, stand, double, or split.");
    }

    advance(s, events);
    return { ok: true, state: s, events };
  },

  isTerminal(state): TerminalResult {
    return state.status === "finished"
      ? { done: true, ...(state.winnerSeatId ? { winnerSeatId: state.winnerSeatId } : {}) }
      : { done: false };
  },

  describeForModel(state, seatId): ModelTurnView<BlackjackMove> {
    return {
      boardSummary: buildBoardSummary(state, seatId),
      legalMoves: legalMovesFor(state, seatId),
      instructions: buildInstructions(state, seatId),
    };
  },

  spectatorSummary(state) {
    return buildSpectatorSummary(state);
  },

  participantSummary(state, seatId) {
    return buildParticipantSummary(state, seatId);
  },

  publicView(state, viewerSeatId): BlackjackPublicView {
    const currentSeatId = state.status === "finished" ? null : state.currentSeatId;
    const seats: BlackjackPublicSeat[] = state.seats.map((seat) => ({
      seatId: seat.seatId,
      displayName: seat.displayName,
      kind: seat.kind,
      isDealer: isDealerSeat(state, seat.seatId),
      bankroll: state.bankrolls[seat.seatId] ?? 0,
      bet: state.bets[seat.seatId] ?? null,
      out: state.outSeatIds.includes(seat.seatId),
      isCurrent: currentSeatId === seat.seatId,
      hands: (state.hands[seat.seatId] ?? []).map((hand) => {
        const { total, soft } = handTotal(hand.cards);
        return {
          cards: hand.cards.map(cardCode),
          total,
          soft,
          bet: hand.bet,
          doubled: hand.doubled,
          status: hand.status,
          outcome: hand.outcome,
          net: hand.net,
        };
      }),
      activeHandIndex: state.activeHandIndex[seat.seatId] ?? 0,
    }));
    const visibleDealer = state.dealerRevealed ? state.dealerCards : state.dealerCards.slice(0, 1);
    const yourTurn = !!viewerSeatId && viewerSeatId === currentSeatId;
    const range = viewerSeatId ? betRange(state, viewerSeatId) : { min: 0, max: 0 };
    const yourActions: BlackjackYourActions = {
      canBet: yourTurn && state.status === "betting",
      minBet: range.min,
      maxBet: range.max,
      canHit: yourTurn && state.status === "playing",
      canStand: yourTurn && state.status === "playing",
      canDouble: yourTurn && state.status === "playing" && canDouble(state, viewerSeatId!),
      canSplit: yourTurn && state.status === "playing" && canSplit(state, viewerSeatId!),
      canNextRound: yourTurn && state.status === "round_over",
    };

    return {
      gameType: "blackjack",
      status: state.status,
      roundNumber: state.roundNumber,
      roundLimit: state.config.roundLimit,
      dealerCards: state.dealerCards.map((card, index) =>
        state.dealerRevealed || index === 0 ? cardCode(card) : null,
      ),
      dealerTotal: visibleDealer.length ? handTotal(visibleDealer).total : null,
      dealerRevealed: state.dealerRevealed,
      seats,
      currentSeatId,
      yourSeatId: viewerSeatId,
      yourActions,
      winnerSeatId: state.winnerSeatId,
      lastAction: state.lastAction,
      recentLog: state.log.slice(-8),
      config: state.config,
      dealerCharacterId: state.config.dealerCharacterId,
      hasPendingAnnouncements: state.pendingAnnouncements.length > 0,
    };
  },

  pickFallbackMove(state, seatId) {
    return pickFallback(state, seatId);
  },

  toolManifests() {
    return [...BLACKJACK_TOOL_MANIFESTS];
  },

  parseToolCall(name, args) {
    return parseBlackjackToolCall(name, args);
  },

  announcerCharacterId(state) {
    return state.config.dealerCharacterId;
  },

  drainAnnouncements(state) {
    if (state.pendingAnnouncements.length === 0) return null;
    const s = clone(state);
    const announcements = s.pendingAnnouncements;
    s.pendingAnnouncements = [];
    return { state: s, announcements };
  },
};
