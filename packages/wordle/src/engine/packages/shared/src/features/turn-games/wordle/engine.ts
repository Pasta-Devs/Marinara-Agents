// ──────────────────────────────────────────────
// Wordle — deterministic engine (server-authoritative)
// ──────────────────────────────────────────────
// Pure functions over WordleState. Every seat races to find the same word on
// its own six-row board, one guess per turn. The word comes from the chat and
// the day, so a chat has one word per day and an edit or regenerate replays the
// same game. Seats see each other's colors, never each other's letters.

import type { GameEvent, ModelTurnView, MoveResult, Seat, TerminalResult, TurnGameEngine } from "../engine.types.js";
import { cloneState, nameOfSeat, recordEvent, setLastAction } from "../engine-utils.js";
import { WORDLE_TOOL_MANIFESTS } from "./tools.js";
import {
  WORDLE_LOG_CAP,
  WORDLE_MAX_GUESSES,
  WORDLE_MAX_PLAYERS,
  WORDLE_MIN_PLAYERS,
  WORDLE_WORD_LENGTH,
  wordleConfigSchema,
  type WordleBoard,
  type WordleConfig,
  type WordleMark,
  type WordleMove,
  type WordlePublicSeat,
  type WordlePublicView,
  type WordleState,
} from "./types.js";
import { WORDLE_ANSWERS, isWordleWord } from "./words.js";

const DAY_MS = 86_400_000;
const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TILE: Record<WordleMark, string> = { correct: "🟩", present: "🟨", absent: "⬛" };
const MARK_RANK: Record<WordleMark, number> = { absent: 0, present: 1, correct: 2 };
const ORDINAL = ["1st", "2nd", "3rd", "4th", "5th"];
/** How many example words a rejected human guess gets back as `legalMoves`. */
const LEGAL_SAMPLE = 12;

const clone = cloneState<WordleState>;
const nameOf = nameOfSeat;
const record = (state: WordleState, event: GameEvent): void => recordEvent(state, event, WORDLE_LOG_CAP);

// ── days and the word of the day ────────────────────────────────────────────

/** Days since 1970-01-01 for a YYYY-MM-DD string, or null when it is not a real calendar date. */
export function wordleDayNumber(day: string): number | null {
  const match = DAY_PATTERN.exec(day);
  if (!match) return null;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const time = Date.UTC(y, m - 1, d);
  const date = new Date(time);
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return Math.round(time / DAY_MS);
}

function dayFromNumber(dayNumber: number): string {
  return new Date(dayNumber * DAY_MS).toISOString().slice(0, 10);
}

/** The UTC calendar day of a timestamp. */
export function wordleUtcDay(now: number): string {
  return dayFromNumber(Math.floor(now / DAY_MS));
}

/**
 * A client's local day, accepted only within one day of the server's UTC day (every time zone's local date is), so
 * a player cannot skip ahead to tomorrow's word. Anything else falls back to the server's UTC day.
 */
export function clampWordleDay(day: unknown, now: number): string {
  const today = Math.floor(now / DAY_MS);
  const asked = typeof day === "string" ? wordleDayNumber(day) : null;
  return asked !== null && Math.abs(asked - today) <= 1 ? dayFromNumber(asked) : dayFromNumber(today);
}

function hashText(text: string): number {
  // FNV-1a, 32-bit.
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

/**
 * The chat's word for a day. Each chat starts at its own place in the list and steps through it by a stride that
 * shares no factor with the list length, so a chat sees every answer once before any word comes back.
 */
export function wordleAnswerFor(chatId: string, day: string): string {
  const count = WORDLE_ANSWERS.length;
  let stride = Math.floor(count * 0.618) || 1;
  while (gcd(stride, count) !== 1) stride++;
  const offset = hashText(chatId) % count;
  const dayNumber = wordleDayNumber(day) ?? 0;
  const index = (offset + (((((dayNumber % count) + count) % count) * stride) % count)) % count;
  return WORDLE_ANSWERS[index]!;
}

// ── scoring ─────────────────────────────────────────────────────────────────

/** Standard Wordle marks: exact matches first, then each remaining answer letter can mark one guessed letter present. */
export function scoreWordleGuess(guess: string, answer: string): WordleMark[] {
  const marks: WordleMark[] = Array<WordleMark>(guess.length).fill("absent");
  const remaining = new Map<string, number>();
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) marks[i] = "correct";
    else remaining.set(answer[i]!, (remaining.get(answer[i]!) ?? 0) + 1);
  }
  for (let i = 0; i < guess.length; i++) {
    if (marks[i] === "correct") continue;
    const left = remaining.get(guess[i]!) ?? 0;
    if (left > 0) {
      marks[i] = "present";
      remaining.set(guess[i]!, left - 1);
    }
  }
  return marks;
}

function tiles(marks: WordleMark[]): string {
  return marks.map((mark) => TILE[mark]).join("");
}

function normalizeGuess(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

/** Whether `word` could still be the answer, given every guess on `board`. */
function fitsBoard(word: string, board: WordleBoard): boolean {
  return board.guesses.every((guess) => scoreWordleGuess(guess.word, word).join() === guess.marks.join());
}

function candidatesFor(board: WordleBoard): string[] {
  return WORDLE_ANSWERS.filter((word) => fitsBoard(word, board));
}

// ponytail: every dictionary word is legal, so this is a sample (answer-list words that fit the seat's clues), not
// the full set. The runner never reads it; it only rides along with a rejected guess.
function sampleLegalMoves(state: WordleState, seatId: string): WordleMove[] {
  const board = state.boards[seatId];
  if (!board || currentSeatOf(state) !== seatId) return [];
  return candidatesFor(board)
    .slice(0, LEGAL_SAMPLE)
    .map((word) => ({ type: "guess" as const, word }));
}

// ── turn order ──────────────────────────────────────────────────────────────

function currentSeatOf(state: WordleState): string | null {
  return state.status === "finished" ? null : (state.order[state.turn] ?? null);
}

/** The index of the next seat after `from` that is still playing, or -1 when nobody is. */
function nextPlayingIndex(state: WordleState, from: number): number {
  for (let step = 1; step <= state.order.length; step++) {
    const index = (from + step) % state.order.length;
    if (state.boards[state.order[index]!]?.status === "playing") return index;
  }
  return -1;
}

function bestGuessCount(state: WordleState): number | null {
  const solved = Object.values(state.boards).filter((board) => board.status === "solved");
  return solved.length ? Math.min(...solved.map((board) => board.guesses.length)) : null;
}

function resultText(board: WordleBoard): string {
  if (board.status === "solved") return `solved it in ${board.guesses.length}`;
  if (board.status === "failed") return "ran out of guesses";
  return `${board.guesses.length} of ${WORDLE_MAX_GUESSES} guesses used, still going`;
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// ── prompt builders ─────────────────────────────────────────────────────────

/** What a seat's own clues have established, in plain words. */
function describeClues(board: WordleBoard): string[] {
  const known: Array<string | null> = Array<string | null>(WORDLE_WORD_LENGTH).fill(null);
  const misplaced = new Map<string, Set<number>>();
  const seen = new Set<string>();
  const ruledOut = new Set<string>();
  for (const guess of board.guesses) {
    guess.marks.forEach((mark, i) => {
      const letter = guess.word[i]!;
      if (mark === "correct") {
        known[i] = letter;
        seen.add(letter);
      } else if (mark === "present") {
        seen.add(letter);
        misplaced.set(letter, (misplaced.get(letter) ?? new Set()).add(i));
      } else {
        ruledOut.add(letter);
        // An absent copy of a letter that is in the word elsewhere still rules that spot out.
        misplaced.set(letter, (misplaced.get(letter) ?? new Set()).add(i));
      }
    });
  }
  const lines: string[] = [];
  lines.push(`- Known spots: ${known.map((letter) => (letter ? letter.toUpperCase() : "_")).join(" ")}`);
  const elsewhere = [...seen]
    .filter((letter) => misplaced.has(letter))
    .map((letter) => {
      const spots = [...misplaced.get(letter)!].filter((i) => known[i] !== letter).sort((a, b) => a - b);
      return spots.length ? `${letter.toUpperCase()} (not ${spots.map((i) => ORDINAL[i]).join(" or ")})` : "";
    })
    .filter(Boolean);
  if (elsewhere.length) lines.push(`- In the word, but not where you tried them: ${elsewhere.join(", ")}`);
  const absent = [...ruledOut].filter((letter) => !seen.has(letter)).sort();
  if (absent.length) lines.push(`- Not in the word: ${absent.map((letter) => letter.toUpperCase()).join(", ")}`);
  return lines;
}

function ownRows(board: WordleBoard): string[] {
  return board.guesses.map(
    (guess, i) =>
      `${i + 1}. ${guess.word.toUpperCase()}  ${tiles(guess.marks)}  (` +
      guess.marks.map((mark, j) => `${guess.word[j]!.toUpperCase()}=${mark}`).join(" ") +
      ")",
  );
}

function othersLine(state: WordleState, seatId: string): string | null {
  const others = state.order.filter((id) => id !== seatId);
  if (!others.length) return null;
  return (
    "The others at the table: " +
    others
      .map((id) => {
        const board = state.boards[id]!;
        const last = board.guesses[board.guesses.length - 1];
        return `${nameOf(state, id)} ${resultText(board)}${last ? ` (last row ${tiles(last.marks)})` : ""}`;
      })
      .join("; ") +
    "."
  );
}

function buildBoardSummary(state: WordleState, seatId: string): string {
  const board = state.boards[seatId]!;
  const lines: string[] = [
    `Wordle, the word of the day for ${state.config.day}. You are ${nameOf(state, seatId)}. ` +
      `You have used ${board.guesses.length} of ${WORDLE_MAX_GUESSES} guesses.`,
  ];
  if (board.guesses.length) {
    lines.push("Your guesses so far:", ...ownRows(board), "What your clues say:", ...describeClues(board));
  } else {
    lines.push("No guesses yet: any five-letter word will do to start.");
  }
  const others = othersLine(state, seatId);
  if (others) lines.push(others);
  return lines.join("\n");
}

function buildInstructions(): string {
  return (
    "Call wordle_guess with ONE real five-letter English word. Only the colors of your guess are shown to the table, " +
    "never the letters. A word that is not in the word list, or no call at all, plays a fallback guess for you."
  );
}

function buildSpectatorSummary(state: WordleState): string {
  const lines: string[] = [];
  if (state.status === "finished") {
    lines.push(`Today's Wordle (${state.config.day}) is over. The word was ${state.answer.toUpperCase()}.`);
    const winners = state.winnerSeatIds.map((id) => nameOf(state, id));
    if (winners.length) {
      lines.push(
        `${listNames(winners)} ${winners.length > 1 ? "share the win" : "wins"} with ${bestGuessCount(state)} guesses.`,
      );
    } else {
      lines.push("Nobody found it.");
    }
  } else {
    lines.push(`Today's Wordle (${state.config.day}) is under way at the table. Everyone guesses the same word.`);
  }
  for (const id of state.order) {
    const board = state.boards[id]!;
    const rows = board.guesses.map((guess) => tiles(guess.marks)).join(" ");
    lines.push(`- ${nameOf(state, id)}: ${resultText(board)}${rows ? ` ${rows}` : ""}`);
  }
  const current = currentSeatOf(state);
  if (current) lines.push(`${nameOf(state, current)} is guessing next.`);
  return lines.join("\n");
}

function buildParticipantSummary(state: WordleState, seatId: string): string {
  const board = state.boards[seatId];
  const base = buildSpectatorSummary(state);
  if (!board) return base;
  const lines: string[] = [base, `You are ${nameOf(state, seatId)}.`];
  if (board.guesses.length) lines.push("Your own rows:", ...ownRows(board));
  const streak = state.config.streaks?.[seatId] ?? 0;
  if (board.status === "solved") {
    lines.push(
      `You solved it in ${board.guesses.length}. Your daily streak is now ${streak + 1} day${streak + 1 === 1 ? "" : "s"}.`,
    );
  } else if (board.status === "failed") {
    lines.push(
      `You did not find it today${streak > 0 ? `, which ends your ${streak}-day streak` : ""}.` +
        (state.status === "finished" ? "" : ` The word was ${state.answer.toUpperCase()}.`),
    );
  } else if (streak > 0) {
    lines.push(`You are on a ${streak}-day streak going into today.`);
  }
  if (state.status !== "finished" && board.status !== "playing") {
    lines.push("Others are still guessing: never say today's word or your letters out loud, only how it went for you.");
  } else if (board.status === "playing") {
    lines.push("Keep your letters to yourself; the table only sees your colors.");
  }
  return lines.join("\n");
}

// ── public view ─────────────────────────────────────────────────────────────

function lettersFor(board: WordleBoard | undefined): Record<string, WordleMark> {
  const letters: Record<string, WordleMark> = {};
  for (const guess of board?.guesses ?? []) {
    guess.marks.forEach((mark, i) => {
      const letter = guess.word[i]!;
      const previous = letters[letter];
      if (!previous || MARK_RANK[mark] > MARK_RANK[previous]) letters[letter] = mark;
    });
  }
  return letters;
}

// ── the engine object ───────────────────────────────────────────────────────

export const wordleEngine: TurnGameEngine<WordleState, WordleMove, WordleConfig, WordlePublicView> = {
  gameType: "wordle",
  schemaVersion: 1,
  label: "Wordle",
  minPlayers: WORDLE_MIN_PLAYERS,
  maxPlayers: WORDLE_MAX_PLAYERS,
  hiddenInformation: true,

  defaultConfig() {
    return { day: wordleUtcDay(Date.now()), chatId: "", streaks: {} };
  },

  // ponytail: the only impure method, reading the clock once at game start so a client cannot ask for tomorrow's
  // word. Setup, moves and views never touch the clock, so a replayed game is unchanged.
  normalizeConfig(config) {
    const input = config && typeof config === "object" ? (config as Record<string, unknown>) : {};
    const day = clampWordleDay(input.day, Date.now());
    const chatId = typeof input.chatId === "string" ? input.chatId.slice(0, 200) : "";
    const streaks: Record<string, number> = {};
    if (input.streaks && typeof input.streaks === "object" && !Array.isArray(input.streaks)) {
      for (const [seatId, value] of Object.entries(input.streaks as Record<string, unknown>).slice(0, 32)) {
        if (typeof value === "number" && Number.isFinite(value) && seatId.length <= 200) {
          streaks[seatId] = Math.max(0, Math.min(100_000, Math.floor(value)));
        }
      }
    }
    const parsed = wordleConfigSchema.safeParse({ day, chatId, streaks });
    return parsed.success ? parsed.data : { day, chatId: "", streaks: {} };
  },

  setup(config, seats: Seat[], seed) {
    const human = seats.filter((seat) => seat.kind === "human");
    const ordered = [...human, ...seats.filter((seat) => seat.kind !== "human")];
    const seatNames: Record<string, string> = {};
    const boards: Record<string, WordleBoard> = {};
    for (const seat of ordered) {
      seatNames[seat.seatId] = seat.displayName;
      boards[seat.seatId] = { guesses: [], status: "playing" };
    }
    const state: WordleState = {
      config,
      answer: wordleAnswerFor(config.chatId, config.day),
      order: ordered.map((seat) => seat.seatId),
      turn: 0,
      boards,
      seatNames,
      seats: ordered.map((seat) => ({ seatId: seat.seatId, displayName: seat.displayName, kind: seat.kind })),
      status: "active",
      winnerSeatIds: [],
      seed,
      lastAction: null,
      log: [],
    };
    record(state, {
      type: "game_started",
      message:
        `Today's Wordle (${config.day}) begins for ${listNames(ordered.map((seat) => seat.displayName))}. ` +
        `Everyone gets ${WORDLE_MAX_GUESSES} guesses at the same word.`,
    });
    return state;
  },

  currentSeat(state) {
    return currentSeatOf(state);
  },

  interruptibleSeats() {
    return [];
  },

  legalMoves(state, seatId) {
    return sampleLegalMoves(state, seatId);
  },

  applyMove(state, seatId, move): MoveResult<WordleState, WordleMove> {
    if (state.status === "finished") return { ok: false, error: "Today's game is already over.", legalMoves: [] };
    if (currentSeatOf(state) !== seatId) return { ok: false, error: "It's not your turn.", legalMoves: [] };
    const word = normalizeGuess(move?.type === "guess" ? move.word : "");
    if (!/^[a-z]{5}$/.test(word)) {
      return {
        ok: false,
        error: `Guesses are ${WORDLE_WORD_LENGTH} letters.`,
        legalMoves: sampleLegalMoves(state, seatId),
      };
    }
    if (!isWordleWord(word)) {
      return {
        ok: false,
        error: `${word.toUpperCase()} is not in the word list.`,
        legalMoves: sampleLegalMoves(state, seatId),
      };
    }

    const s = clone(state);
    const board = s.boards[seatId]!;
    const marks = scoreWordleGuess(word, s.answer);
    board.guesses.push({ word, marks });
    const count = board.guesses.length;
    if (marks.every((mark) => mark === "correct")) board.status = "solved";
    else if (count >= WORDLE_MAX_GUESSES) board.status = "failed";

    // Events reach the narration prompt and the chat, so they carry colors only, never letters.
    const name = nameOf(s, seatId);
    const events: GameEvent[] = [
      {
        type: "guess",
        seatId,
        message: `${name} guesses ${tiles(marks)} (${count}/${WORDLE_MAX_GUESSES}).`,
        data: { marks, guessNumber: count },
      },
    ];
    if (board.status === "solved") {
      events.push({
        type: "solved",
        seatId,
        message: `${name} solves today's Wordle in ${count}!`,
        data: { guesses: count },
      });
    } else if (board.status === "failed") {
      events.push({ type: "failed", seatId, message: `${name} runs out of guesses.` });
    }
    setLastAction(s, seatId, `guesses ${tiles(marks)}`);

    const next = nextPlayingIndex(s, s.turn);
    if (next === -1) {
      s.status = "finished";
      const best = bestGuessCount(s);
      s.winnerSeatIds =
        best === null
          ? []
          : s.order.filter((id) => {
              const seatBoard = s.boards[id]!;
              return seatBoard.status === "solved" && seatBoard.guesses.length === best;
            });
      const winners = s.winnerSeatIds.map((id) => nameOf(s, id));
      events.push({
        type: "game_over",
        message: winners.length
          ? `${listNames(winners)} ${winners.length > 1 ? "share the win" : "wins"} with ${best} guesses. ` +
            `The word was ${s.answer.toUpperCase()}.`
          : `Nobody found today's word. It was ${s.answer.toUpperCase()}.`,
      });
    } else {
      s.turn = next;
    }

    for (const event of events) record(s, event);
    return { ok: true, state: s, events };
  },

  isTerminal(state): TerminalResult {
    if (state.status !== "finished") return { done: false };
    return state.winnerSeatIds.length === 1 ? { done: true, winnerSeatId: state.winnerSeatIds[0]! } : { done: true };
  },

  describeForModel(state, seatId): ModelTurnView<WordleMove> {
    return {
      boardSummary: buildBoardSummary(state, seatId),
      legalMoves: sampleLegalMoves(state, seatId),
      instructions: buildInstructions(),
    };
  },

  spectatorSummary(state): string {
    return buildSpectatorSummary(state);
  },

  participantSummary(state, seatId): string {
    return buildParticipantSummary(state, seatId);
  },

  publicView(state, viewerSeatId): WordlePublicView {
    const currentSeatId = currentSeatOf(state);
    const viewerBoard = viewerSeatId ? state.boards[viewerSeatId] : undefined;
    const viewerDone = !!viewerBoard && viewerBoard.status !== "playing";
    const seats: WordlePublicSeat[] = state.seats.map((seat) => {
      const board = state.boards[seat.seatId]!;
      // A viewer sees their own letters always, everyone's once the game is over.
      const showLetters = state.status === "finished" || seat.seatId === viewerSeatId;
      return {
        seatId: seat.seatId,
        displayName: seat.displayName,
        kind: seat.kind,
        isCurrent: currentSeatId === seat.seatId,
        status: board.status,
        rows: board.guesses.map((guess) => ({ word: showLetters ? guess.word : null, marks: [...guess.marks] })),
      };
    });
    return {
      gameType: "wordle",
      status: state.status,
      day: state.config.day,
      wordLength: WORDLE_WORD_LENGTH,
      maxGuesses: WORDLE_MAX_GUESSES,
      seats,
      currentSeatId,
      yourSeatId: viewerSeatId,
      yourLetters: lettersFor(viewerBoard),
      answer: state.status === "finished" || viewerDone ? state.answer : null,
      winnerSeatIds: [...state.winnerSeatIds],
      lastAction: state.lastAction,
      recentLog: state.log.slice(-8),
    };
  },

  // A deterministic guess that fits the seat's own clues, so a misbehaving bot never stalls the table. The answer
  // always fits, so the list is never empty.
  pickFallbackMove(state, seatId) {
    const board = state.boards[seatId];
    if (!board) return { type: "guess", word: "" };
    const candidates = candidatesFor(board);
    const pick = candidates[hashText(`${state.seed}:${seatId}:${board.guesses.length}`) % candidates.length];
    return { type: "guess", word: pick ?? state.answer };
  },

  toolManifests() {
    return [...WORDLE_TOOL_MANIFESTS];
  },

  parseToolCall(name, args) {
    if (name !== "wordle_guess") return null;
    // Best-effort: an invalid word still returns a move that applyMove rejects, so the fallback runs.
    return { type: "guess", word: normalizeGuess(args.word) };
  },
};
