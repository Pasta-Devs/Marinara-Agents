// ──────────────────────────────────────────────
// WordleBoard — live Wordle race (conversation mode)
// ──────────────────────────────────────────────
// A React component driven by the wordle-game store (fed by the turn-game state
// query, which package server events refetch). Renders the viewer's own board
// with letters, every other seat's board as colors only, a guess field with an
// on-screen keyboard, and the result once the day's game is over.
import { useState } from "react";
import { Delete, X } from "lucide-react";
import type { WordleMark, WordlePublicRow } from "../../../../shared/src/features/turn-games/wordle/types";
import { useChatStore } from "../../stores/chat.store";
import { useWordleGameStore } from "../../stores/wordle-game.store";
import { useResignWordle, useWordleMove, useWordleState } from "../../hooks/use-wordle";

interface Props {
  chatId: string;
}

const MARK_CLASS: Record<WordleMark, string> = {
  correct: "border-emerald-600 bg-emerald-600 text-white",
  present: "border-amber-500 bg-amber-500 text-white",
  absent: "border-zinc-500 bg-zinc-500 text-white",
};
const MARK_LABEL: Record<WordleMark, string> = {
  correct: "right spot",
  present: "wrong spot",
  absent: "not in the word",
};
const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

function Tile({ letter, mark, size }: { letter: string | null; mark: WordleMark | null; size: "lg" | "sm" }) {
  const dims = size === "lg" ? "h-10 w-10 text-lg" : "h-3.5 w-3.5 text-[0.5rem]";
  const tone = mark ? MARK_CLASS[mark] : letter ? "border-[var(--foreground)]/50" : "border-[var(--border)]";
  return (
    <div
      className={`flex ${dims} items-center justify-center rounded-sm border-2 font-bold uppercase ${tone}`}
      aria-label={mark ? `${letter ? `${letter.toUpperCase()}, ` : ""}${MARK_LABEL[mark]}` : (letter ?? "empty")}
      role="img"
    >
      {size === "lg" || letter ? letter : null}
    </div>
  );
}

function Grid({
  rows,
  maxGuesses,
  wordLength,
  draft,
  size,
}: {
  rows: WordlePublicRow[];
  maxGuesses: number;
  wordLength: number;
  draft: string | null;
  size: "lg" | "sm";
}) {
  const gap = size === "lg" ? "gap-1" : "gap-0.5";
  return (
    <div className={`flex flex-col ${gap}`}>
      {Array.from({ length: maxGuesses }, (_, r) => {
        const row = rows[r];
        const typing = !row && draft !== null && r === rows.length;
        return (
          <div key={r} className={`flex ${gap}`}>
            {Array.from({ length: wordLength }, (_, c) => (
              <Tile
                key={c}
                letter={row ? (row.word?.[c] ?? null) : typing ? (draft[c] ?? null) : null}
                mark={row ? (row.marks[c] ?? null) : null}
                size={size}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function WordleBoard({ chatId }: Props) {
  const view = useWordleGameStore((s) => s.byChat[chatId] ?? null);
  const streaming = useChatStore((s) => s.isStreaming);
  const streamingChatId = useChatStore((s) => s.streamingChatId);
  const isStreaming = streaming && streamingChatId === chatId;
  const move = useWordleMove(chatId);
  const resign = useResignWordle(chatId);
  const [draft, setDraft] = useState("");

  // Keep the table query active so package server events refetch bot guesses.
  useWordleState(chatId);

  if (!view) return null;

  const you = view.seats.find((seat) => seat.seatId === view.yourSeatId) ?? null;
  const others = view.seats.filter((seat) => seat.seatId !== view.yourSeatId);
  const isMyTurn = view.status !== "finished" && view.currentSeatId === view.yourSeatId;
  const disabled = isStreaming || move.isPending || resign.isPending;
  const current = view.seats.find((seat) => seat.seatId === view.currentSeatId) ?? null;
  const winners = view.seats.filter((seat) => view.winnerSeatIds.includes(seat.seatId));

  const type = (value: string) =>
    setDraft(
      value
        .toLowerCase()
        .replace(/[^a-z]/g, "")
        .slice(0, view.wordLength),
    );
  const submit = () => {
    if (!isMyTurn || disabled || draft.length !== view.wordLength) return;
    move.mutate({ move: { type: "guess", word: draft } }, { onSuccess: () => setDraft("") });
  };

  const statusLine =
    view.status === "finished"
      ? winners.length
        ? `🏆 ${winners.map((seat) => (seat.seatId === view.yourSeatId ? "You" : seat.displayName)).join(" & ")} ${
            winners.length > 1 || winners[0]?.seatId === view.yourSeatId ? "win" : "wins"
          } with ${winners[0]?.rows.length} guesses!`
        : "Nobody found it today."
      : you?.status === "solved"
        ? `You got it in ${you.rows.length}! Waiting for the others…`
        : you?.status === "failed"
          ? "Out of guesses. Waiting for the others…"
          : null;

  return (
    <div className="mx-2 mb-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-sm">
      {/* Header: day, turn indicator, end control */}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
        <span className="font-semibold text-[var(--foreground)]">Wordle · {view.day}</span>
        <div className="ml-auto flex items-center gap-2">
          {view.status !== "finished" && (
            <span className={isMyTurn ? "animate-pulse font-semibold text-[var(--primary)]" : ""}>
              {isMyTurn ? "Your guess" : `${current?.displayName ?? "…"} is guessing…`}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              if (view.status === "finished" || window.confirm("End today's Wordle? Your go for today still counts."))
                resign.mutate();
            }}
            className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)] active:scale-90"
            title={view.status === "finished" ? "Close" : "End game"}
            aria-label={view.status === "finished" ? "Close game" : "End game"}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {(statusLine || view.answer) && (
        <div className="mb-2 rounded-lg bg-[var(--primary)]/10 px-3 py-2 text-center text-sm font-semibold text-[var(--primary)]">
          {statusLine}
          {view.answer && (
            <span className="block text-xs font-medium text-[var(--muted-foreground)]">
              The word {view.status === "finished" ? "was" : "is"}{" "}
              <span className="font-bold uppercase tracking-widest text-[var(--foreground)]">{view.answer}</span>
              {view.status !== "finished" && " (keep it to yourself)"}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-center gap-4">
        {/* Your board */}
        {you && (
          <div className="flex flex-col items-center gap-1">
            <Grid
              rows={you.rows}
              maxGuesses={view.maxGuesses}
              wordLength={view.wordLength}
              draft={isMyTurn ? draft : null}
              size="lg"
            />
          </div>
        )}

        {/* Everyone else: colors only until the game is over */}
        {others.length > 0 && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
            {others.map((seat) => (
              <div
                key={seat.seatId}
                className={`flex flex-col items-center gap-1 rounded-lg p-1 ${
                  seat.isCurrent ? "animate-pulse ring-2 ring-[var(--primary)]" : ""
                }`}
              >
                <span className="max-w-24 truncate text-[0.7rem] font-medium text-[var(--foreground)]">
                  {seat.displayName}
                </span>
                <Grid
                  rows={seat.rows}
                  maxGuesses={view.maxGuesses}
                  wordLength={view.wordLength}
                  draft={null}
                  size="sm"
                />
                <span className="text-[0.6rem] text-[var(--muted-foreground)]">
                  {seat.status === "solved"
                    ? `got it in ${seat.rows.length}`
                    : seat.status === "failed"
                      ? "missed it"
                      : `${seat.rows.length}/${view.maxGuesses}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Guess field and keyboard */}
      {isMyTurn && (
        <div className="mt-2 flex flex-col items-center gap-1.5">
          <form
            className="flex items-center gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <input
              value={draft}
              onChange={(event) => type(event.target.value)}
              disabled={disabled}
              maxLength={view.wordLength}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              aria-label="Your guess"
              placeholder="guess"
              className="w-28 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-center text-sm font-bold uppercase tracking-widest text-[var(--foreground)]"
            />
            <button
              type="submit"
              disabled={disabled || draft.length !== view.wordLength}
              className="rounded-lg bg-[var(--primary)] px-3 py-1 text-sm font-semibold text-[var(--primary-foreground)] transition-transform active:scale-95 disabled:opacity-50"
            >
              {move.isPending ? "Checking…" : "Guess"}
            </button>
          </form>
          <div className="flex flex-col items-center gap-1">
            {KEY_ROWS.map((row, index) => (
              <div key={row} className="flex gap-0.5">
                {row.split("").map((letter) => {
                  const mark = view.yourLetters[letter];
                  return (
                    <button
                      key={letter}
                      type="button"
                      onClick={() => type(draft + letter)}
                      disabled={disabled}
                      className={`h-8 w-6 rounded text-xs font-semibold uppercase disabled:opacity-50 sm:w-7 ${
                        mark ? MARK_CLASS[mark] : "bg-[var(--muted)] text-[var(--foreground)]"
                      }`}
                    >
                      {letter}
                    </button>
                  );
                })}
                {index === KEY_ROWS.length - 1 && (
                  <button
                    type="button"
                    onClick={() => setDraft(draft.slice(0, -1))}
                    disabled={disabled}
                    className="flex h-8 w-9 items-center justify-center rounded bg-[var(--muted)] text-[var(--foreground)] disabled:opacity-50"
                    aria-label="Delete letter"
                  >
                    <Delete className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent log */}
      {view.recentLog.length > 0 && view.status !== "finished" && (
        <ul className="mt-1.5 space-y-0.5 text-[0.7rem] text-[var(--muted-foreground)]">
          {view.recentLog.slice(-3).map((entry, i) => (
            <li key={i} className="truncate opacity-70">
              {entry.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
