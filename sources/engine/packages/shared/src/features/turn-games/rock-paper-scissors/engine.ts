// ──────────────────────────────────────────────
// Rock-Paper-Scissors — deterministic engine (server-authoritative)
// ──────────────────────────────────────────────
// Pure functions over RockPaperScissorsState. Hidden information: each round
// is two sequential moves (seatIds[0] throws, then seatIds[1] throws), and
// the engine never reveals a pending throw to the OTHER seat's prompt/view
// until both have thrown — see the doc comment in types.ts. Once a round
// resolves both throws become public (spectatorSummary/publicView/log).

import type {
  GameEvent,
  ModelTurnView,
  MoveResult,
  Seat,
  TerminalResult,
  TurnGameEngine,
} from "../engine.types.js";
import { cloneState, nameOfSeat, recordEvent, setLastAction } from "../engine-utils.js";
import { ROCK_PAPER_SCISSORS_TOOL_MANIFESTS } from "./tools.js";
import {
  DEFAULT_ROCK_PAPER_SCISSORS_CONFIG,
  ROCK_PAPER_SCISSORS_LOG_CAP,
  ROCK_PAPER_SCISSORS_MAX_PLAYERS,
  ROCK_PAPER_SCISSORS_MIN_PLAYERS,
  RPS_BEATS,
  RPS_CHOICES,
  rockPaperScissorsConfigSchema,
  type RockPaperScissorsConfig,
  type RockPaperScissorsMove,
  type RockPaperScissorsPublicSeat,
  type RockPaperScissorsPublicView,
  type RockPaperScissorsState,
  type RpsChoice,
} from "./types.js";

// ── small helpers ───────────────────────────────────────────────────────────

const clone = cloneState<RockPaperScissorsState>;
const nameOf = nameOfSeat;
const record = (state: RockPaperScissorsState, event: GameEvent): void =>
  recordEvent(state, event, ROCK_PAPER_SCISSORS_LOG_CAP);
const setLast = setLastAction;

function opponentOf(state: RockPaperScissorsState, seatId: string): string {
  return state.seatIds[0] === seatId ? state.seatIds[1] : state.seatIds[0];
}

/** The seat that still needs to throw this round, or null once both have (round is resolved immediately, so this is momentary). */
function seatToThrow(state: RockPaperScissorsState): string | null {
  const [a, b] = state.seatIds;
  if (state.pendingThrows[a] == null) return a;
  if (state.pendingThrows[b] == null) return b;
  return null;
}

function roundWinner(a: RpsChoice, b: RpsChoice): "a" | "b" | "tie" {
  if (a === b) return "tie";
  return RPS_BEATS[a] === b ? "a" : "b";
}

// ── prompt builders ─────────────────────────────────────────────────────────

function scoreLine(state: RockPaperScissorsState, seatId: string): string {
  const opp = opponentOf(state, seatId);
  return `Score: ${nameOf(state, seatId)} ${state.scores[seatId] ?? 0} - ${state.scores[opp] ?? 0} ${nameOf(state, opp)} (first to ${state.config.roundsToWin} wins the match).`;
}

function buildBoardSummary(state: RockPaperScissorsState, seatId: string): string {
  const opp = opponentOf(state, seatId);
  const lines: string[] = [
    `Rock-Paper-Scissors. You are ${nameOf(state, seatId)}, facing ${nameOf(state, opp)}. Round ${state.roundNumber}.`,
    scoreLine(state, seatId),
  ];
  if (state.pendingThrows[opp] != null) {
    lines.push(`${nameOf(state, opp)} has already thrown this round — you cannot see their choice. Choose wisely.`);
  }
  const last = state.rounds[state.rounds.length - 1];
  if (last) {
    const you = last.throws[seatId];
    const them = last.throws[opp];
    const outcome = last.winnerSeatId === seatId ? "You won" : last.winnerSeatId === opp ? "You lost" : "Tie";
    lines.push(`Last round: you threw ${you}, they threw ${them} — ${outcome}.`);
  }
  return lines.join("\n");
}

function buildInstructions(): string {
  return `Call rock_paper_scissors_throw with exactly one of "rock", "paper", or "scissors".`;
}

function buildSpectatorSummary(state: RockPaperScissorsState): string {
  const [a, b] = state.seatIds;
  const nameA = nameOf(state, a);
  const nameB = nameOf(state, b);
  if (state.status === "finished") {
    const winner = state.winnerSeatId ? nameOf(state, state.winnerSeatId) : null;
    const loser = state.winnerSeatId ? nameOf(state, opponentOf(state, state.winnerSeatId)) : null;
    return winner
      ? `The rock-paper-scissors match just finished — ${winner} beat ${loser} ${state.scores[state.winnerSeatId!]}-${state.scores[opponentOf(state, state.winnerSeatId!)]}.`
      : `The rock-paper-scissors match between ${nameA} and ${nameB} just ended.`;
  }
  const lines: string[] = [
    `A match of rock-paper-scissors is in progress at the table: ${nameA} vs ${nameB}, round ${state.roundNumber}.`,
    `Score: ${nameA} ${state.scores[a] ?? 0} - ${state.scores[b] ?? 0} ${nameB}.`,
  ];
  const last = state.rounds[state.rounds.length - 1];
  if (last) {
    const outcome = last.winnerSeatId ? `${nameOf(state, last.winnerSeatId)} won the round` : "the round was a tie";
    lines.push(`Last round: ${nameOf(state, a)} threw ${last.throws[a]}, ${nameOf(state, b)} threw ${last.throws[b]} — ${outcome}.`);
  }
  return lines.join("\n");
}

function buildParticipantSummary(state: RockPaperScissorsState, seatId: string): string {
  const base = buildSpectatorSummary(state);
  if (!state.seatIds.includes(seatId)) return base;
  const lines: string[] = [base, scoreLine(state, seatId)];
  if (state.status !== "finished") {
    if (seatToThrow(state) === seatId) lines.push("It is YOUR turn to throw.");
    else if (state.pendingThrows[seatId] != null) lines.push("You have already thrown this round — waiting on your opponent.");
  }
  return lines.join("\n");
}

// ── deterministic fallback ──────────────────────────────────────────────────

/** A deterministic pick so a misbehaving bot can never stall the match. */
function pickFallback(state: RockPaperScissorsState): RockPaperScissorsMove {
  return { type: "throw", choice: RPS_CHOICES[state.roundNumber % RPS_CHOICES.length]! };
}

// ── the engine object ───────────────────────────────────────────────────────

export const rockPaperScissorsEngine: TurnGameEngine<
  RockPaperScissorsState,
  RockPaperScissorsMove,
  RockPaperScissorsConfig,
  RockPaperScissorsPublicView
> = {
  gameType: "rock-paper-scissors",
  schemaVersion: 1,
  label: "Rock-Paper-Scissors",
  minPlayers: ROCK_PAPER_SCISSORS_MIN_PLAYERS,
  maxPlayers: ROCK_PAPER_SCISSORS_MAX_PLAYERS,
  hiddenInformation: true,

  defaultConfig() {
    return { ...DEFAULT_ROCK_PAPER_SCISSORS_CONFIG };
  },

  normalizeConfig(config) {
    const direct = rockPaperScissorsConfigSchema.safeParse(config);
    if (direct.success) return direct.data;
    const merged = {
      ...DEFAULT_ROCK_PAPER_SCISSORS_CONFIG,
      ...(config && typeof config === "object" ? (config as object) : {}),
    };
    const reparsed = rockPaperScissorsConfigSchema.safeParse(merged);
    return reparsed.success ? reparsed.data : { ...DEFAULT_ROCK_PAPER_SCISSORS_CONFIG };
  },

  setup(config, seats: Seat[], seed) {
    // The human always throws first each round — harmless, since a pending
    // throw is never revealed to the other seat before they throw too.
    const humanSeat = seats.find((s) => s.kind === "human") ?? seats[0]!;
    const otherSeat = seats.find((s) => s.seatId !== humanSeat.seatId) ?? seats[seats.length - 1]!;

    const seatNames: Record<string, string> = {};
    for (const s of seats) seatNames[s.seatId] = s.displayName;

    const state: RockPaperScissorsState = {
      config,
      seatIds: [humanSeat.seatId, otherSeat.seatId],
      seatNames,
      seats: seats.map((s) => ({ seatId: s.seatId, displayName: s.displayName, kind: s.kind })),
      status: "active",
      winnerSeatId: null,
      scores: { [humanSeat.seatId]: 0, [otherSeat.seatId]: 0 },
      roundNumber: 1,
      pendingThrows: { [humanSeat.seatId]: null, [otherSeat.seatId]: null },
      rounds: [],
      seed,
      lastAction: null,
      log: [],
    };

    record(state, {
      type: "game_started",
      message: `${humanSeat.displayName} and ${otherSeat.displayName} are playing rock-paper-scissors — first to ${config.roundsToWin} round wins takes the match.`,
    });
    return state;
  },

  currentSeat(state) {
    return state.status === "finished" ? null : seatToThrow(state);
  },

  interruptibleSeats() {
    return [];
  },

  legalMoves(state, seatId) {
    if (state.status === "finished" || seatToThrow(state) !== seatId) return [];
    return RPS_CHOICES.map((choice) => ({ type: "throw" as const, choice }));
  },

  applyMove(state, seatId, move): MoveResult<RockPaperScissorsState, RockPaperScissorsMove> {
    if (state.status === "finished") {
      return { ok: false, error: "The match is already over.", legalMoves: [] };
    }
    if (seatToThrow(state) !== seatId) {
      return { ok: false, error: "It's not your turn to throw.", legalMoves: [] };
    }
    if (!move || move.type !== "throw" || !RPS_CHOICES.includes(move.choice)) {
      return {
        ok: false,
        error: "Unknown throw. Choose rock, paper, or scissors.",
        legalMoves: RPS_CHOICES.map((choice) => ({ type: "throw" as const, choice })),
      };
    }

    const s = clone(state);
    const events: GameEvent[] = [];
    s.pendingThrows[seatId] = move.choice;
    setLast(s, seatId, "makes a choice");

    const [a, b] = s.seatIds;
    const throwA = s.pendingThrows[a];
    const throwB = s.pendingThrows[b];

    if (throwA == null || throwB == null) {
      events.push({ type: "throw_made", seatId, message: `${nameOf(s, seatId)} has made their choice.` });
      for (const e of events) record(s, e);
      return { ok: true, state: s, events };
    }

    // Both seats have thrown — resolve the round.
    const outcome = roundWinner(throwA, throwB);
    const roundWinnerSeatId = outcome === "tie" ? null : outcome === "a" ? a : b;
    s.rounds.push({ round: s.roundNumber, throws: { [a]: throwA, [b]: throwB }, winnerSeatId: roundWinnerSeatId });

    if (roundWinnerSeatId) {
      s.scores[roundWinnerSeatId] = (s.scores[roundWinnerSeatId] ?? 0) + 1;
      const loserSeatId = opponentOf(s, roundWinnerSeatId);
      events.push({
        type: "round_resolved",
        seatId: roundWinnerSeatId,
        message: `${nameOf(s, roundWinnerSeatId)} (${roundWinnerSeatId === a ? throwA : throwB}) beats ${nameOf(s, loserSeatId)} (${roundWinnerSeatId === a ? throwB : throwA}) and takes round ${s.roundNumber}.`,
        data: { round: s.roundNumber, throws: { [a]: throwA, [b]: throwB } },
      });
    } else {
      events.push({
        type: "round_tied",
        message: `Round ${s.roundNumber} is a tie — both threw ${throwA}. Replaying.`,
        data: { round: s.roundNumber, throws: { [a]: throwA, [b]: throwB } },
      });
    }

    s.pendingThrows = { [a]: null, [b]: null };
    s.roundNumber += 1;

    const winnerSeatId = s.seatIds.find((id) => (s.scores[id] ?? 0) >= s.config.roundsToWin) ?? null;
    if (winnerSeatId) {
      s.status = "finished";
      s.winnerSeatId = winnerSeatId;
      const loserSeatId = opponentOf(s, winnerSeatId);
      events.push({
        type: "game_over",
        seatId: winnerSeatId,
        message: `${nameOf(s, winnerSeatId)} wins the match ${s.scores[winnerSeatId]}-${s.scores[loserSeatId]}!`,
      });
    }

    for (const e of events) record(s, e);
    return { ok: true, state: s, events };
  },

  isTerminal(state): TerminalResult {
    return state.status === "finished"
      ? { done: true, ...(state.winnerSeatId ? { winnerSeatId: state.winnerSeatId } : {}) }
      : { done: false };
  },

  describeForModel(state, seatId): ModelTurnView<RockPaperScissorsMove> {
    const legal = seatToThrow(state) === seatId ? RPS_CHOICES.map((choice) => ({ type: "throw" as const, choice })) : [];
    return {
      boardSummary: buildBoardSummary(state, seatId),
      legalMoves: legal,
      instructions: buildInstructions(),
    };
  },

  spectatorSummary(state): string {
    return buildSpectatorSummary(state);
  },

  participantSummary(state, seatId): string {
    return buildParticipantSummary(state, seatId);
  },

  publicView(state, viewerSeatId): RockPaperScissorsPublicView {
    const currentSeatId = state.status === "finished" ? null : seatToThrow(state);
    const seats: RockPaperScissorsPublicSeat[] = state.seats.map((s) => ({
      seatId: s.seatId,
      displayName: s.displayName,
      kind: s.kind,
      isCurrent: currentSeatId === s.seatId,
      score: state.scores[s.seatId] ?? 0,
    }));
    const opponentSeatId = viewerSeatId ? opponentOf(state, viewerSeatId) : null;

    return {
      gameType: "rock-paper-scissors",
      status: state.status,
      seats,
      currentSeatId,
      winnerSeatId: state.winnerSeatId,
      roundNumber: state.roundNumber,
      roundsToWin: state.config.roundsToWin,
      rounds: state.rounds,
      yourSeatId: viewerSeatId,
      yourPendingChoice: viewerSeatId ? (state.pendingThrows[viewerSeatId] ?? null) : null,
      opponentHasThrown: opponentSeatId ? state.pendingThrows[opponentSeatId] != null : false,
      legalMovesForYou: viewerSeatId && viewerSeatId === currentSeatId ? [...RPS_CHOICES] : [],
      lastAction: state.lastAction,
      config: state.config,
      recentLog: state.log.slice(-8),
    };
  },

  pickFallbackMove(state) {
    return pickFallback(state);
  },

  toolManifests() {
    return [...ROCK_PAPER_SCISSORS_TOOL_MANIFESTS];
  },

  parseToolCall(name, args) {
    if (name !== "rock_paper_scissors_throw") return null;
    const raw = typeof args.choice === "string" ? args.choice.trim().toLowerCase() : "";
    const choice = (RPS_CHOICES as readonly string[]).includes(raw) ? (raw as RpsChoice) : (raw as RpsChoice);
    return { type: "throw", choice };
  },
};
