// ──────────────────────────────────────────────
// TicTacToeBoard — live, interactive tic-tac-toe board (conversation mode)
// ──────────────────────────────────────────────
// A real React component driven by the tic-tac-toe-game store (fed by
// turn_game_state_patch SSE + an initial fetch). Renders the 3×3 grid with
// click-to-move, a winning-line highlight, and a resign button.
import { MessageCircle, RotateCcw, X, Circle } from "lucide-react";
import { useChatStore } from "../../stores/chat.store";
import { useTicTacToeGameStore } from "../../stores/tic-tac-toe-game.store";
import { useTicTacToeMove, useTicTacToeState, useResignTicTacToe } from "../../hooks/use-tic-tac-toe";

interface Props {
  chatId: string;
}

function MarkIcon({ mark }: { mark: "X" | "O" }) {
  return mark === "X" ? (
    <X className="h-8 w-8 text-[var(--primary)]" strokeWidth={3} />
  ) : (
    <Circle className="h-7 w-7 text-[var(--foreground)]" strokeWidth={3} />
  );
}

export function TicTacToeBoard({ chatId }: Props) {
  const current = useTicTacToeGameStore((s) => s.current);
  const openSetup = useTicTacToeGameStore((s) => s.openSetup);
  const streaming = useChatStore((s) => s.isStreaming);
  const streamingChatId = useChatStore((s) => s.streamingChatId);
  const isStreaming = streaming && streamingChatId === chatId;
  const move = useTicTacToeMove(chatId);
  const resign = useResignTicTacToe(chatId);

  // Keep the board query active so package SSE invalidations refetch bot moves.
  const active = !!current && current.chatId === chatId;
  useTicTacToeState(chatId);

  const view = active ? current : null;
  if (!view) return null;

  const disabled = isStreaming || move.isPending || resign.isPending;
  const isMyTurn = view.status !== "finished" && view.currentSeatId === view.yourSeatId;
  const legalSet = new Set(view.legalMovesForYou);
  const winningSet = new Set(view.winningLine ?? []);

  const you = view.seats.find((s) => s.seatId === view.yourSeatId) ?? null;
  const opponent = view.seats.find((s) => s.seatId !== view.yourSeatId) ?? null;
  const currentSeat = view.seats.find((s) => s.seatId === view.currentSeatId) ?? null;
  const winner = view.winnerSeatId ? view.seats.find((s) => s.seatId === view.winnerSeatId) : null;

  const onCellClick = (cell: number) => {
    if (!isMyTurn || disabled || !legalSet.has(cell)) return;
    move.mutate({ move: { type: "move", cell } });
  };

  const onPlayAgain = () => {
    if (disabled) return;
    resign.mutate(undefined, { onSuccess: () => openSetup(chatId) });
  };

  const seatChip = (seat: typeof you) =>
    seat && (
      <div
        className={`flex items-center gap-1.5 rounded-lg px-1.5 py-1 ${
          seat.isCurrent ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/40" : "ring-1 ring-[var(--border)]"
        }`}
      >
        <MarkIcon mark={seat.mark} />
        <div className="flex items-center gap-1 text-xs font-medium text-[var(--foreground)]">
          {seat.displayName}
          {seat.seatId === view.yourSeatId && (
            <span className="text-[0.6rem] font-semibold text-[var(--muted-foreground)]">(you)</span>
          )}
        </div>
      </div>
    );

  return (
    <div className="mx-2 mb-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-sm">
      {/* Header: seats + status + resign */}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
        <span className="font-semibold text-[var(--foreground)]">Tic-Tac-Toe</span>
        {seatChip(opponent)}
        {seatChip(you)}
        <div className="ml-auto flex items-center gap-2">
          {view.status !== "finished" && (
            <span className={isMyTurn ? "font-semibold text-[var(--primary)] animate-pulse" : ""}>
              {isMyTurn ? "Your turn" : `${currentSeat?.displayName ?? "…"} is thinking…`}
            </span>
          )}
          {view.status !== "finished" && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Resign and end this game?")) resign.mutate();
              }}
              className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)] active:scale-90"
              title="Resign"
              aria-label="Resign and end game"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Finished banner */}
      {view.status === "finished" && (
        <div className="mb-2 rounded-lg bg-[var(--primary)]/10 px-3 py-2 text-center text-sm font-semibold text-[var(--primary)]">
          <div>{winner ? `${winner.displayName} wins! 🏆` : "Draw — the board is full."}</div>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={onPlayAgain}
              disabled={disabled}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--primary-foreground)] transition-transform active:scale-95 disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Play again
            </button>
            <button
              type="button"
              onClick={() => resign.mutate()}
              disabled={disabled}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--background)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] ring-1 ring-[var(--border)] transition-transform active:scale-95 disabled:opacity-50"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Continue chat
            </button>
          </div>
        </div>
      )}

      {/* Board */}
      <div className="mx-auto grid w-full max-w-[16rem] grid-cols-3 gap-1.5">
        {view.cells.map((mark, i) => {
          const isLegal = isMyTurn && !disabled && legalSet.has(i);
          const isWinning = winningSet.has(i);
          const isLastMove = view.lastMove?.cell === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onCellClick(i)}
              disabled={!isLegal}
              className={`flex aspect-square items-center justify-center rounded-lg ring-1 transition-colors ${
                isWinning
                  ? "bg-[var(--primary)]/15 ring-2 ring-[var(--primary)]"
                  : isLastMove
                    ? "bg-yellow-300/20 ring-[var(--border)]"
                    : "bg-[var(--muted)]/30 ring-[var(--border)]"
              } ${isLegal ? "cursor-pointer hover:bg-[var(--muted)]/60" : "cursor-default"}`}
              aria-label={`Cell ${i}${mark ? `, ${mark}` : ", empty"}`}
            >
              {mark && <MarkIcon mark={mark} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
