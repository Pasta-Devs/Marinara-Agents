// ──────────────────────────────────────────────
// RockPaperScissorsBoard — live, interactive rock-paper-scissors match
// (conversation mode)
// ──────────────────────────────────────────────
// A real React component driven by the rock-paper-scissors-game store (fed
// by turn_game_state_patch SSE + an initial fetch). Renders a throw picker
// when it's your turn, a "waiting" state once you've thrown, and a strip of
// resolved rounds. Your own pending throw is safe to show (only the
// opponent's is ever hidden — see the engine's hidden-information contract).
import { useEffect, useRef, useState } from "react";
import { MessageCircle, RotateCcw, X } from "lucide-react";
import type { RpsChoice } from "@marinara-engine/shared";
import { useChatStore } from "../../stores/chat.store";
import { useRockPaperScissorsGameStore } from "../../stores/rock-paper-scissors-game.store";
import {
  useRockPaperScissorsThrow,
  useRockPaperScissorsState,
  useResignRockPaperScissors,
} from "../../hooks/use-rock-paper-scissors";

interface Props {
  chatId: string;
}

const CHOICE_EMOJI: Record<RpsChoice, string> = { rock: "🪨", paper: "📄", scissors: "✂️" };
const CHOICE_LABEL: Record<RpsChoice, string> = { rock: "Rock", paper: "Paper", scissors: "Scissors" };

type CastClash = {
  yourChoice: RpsChoice;
  opponentChoice: RpsChoice | null;
  outcome: "win" | "loss" | "tie" | null;
  phase: "casting" | "reveal";
};

export function RockPaperScissorsBoard({ chatId }: Props) {
  const current = useRockPaperScissorsGameStore((s) => s.current);
  const openSetup = useRockPaperScissorsGameStore((s) => s.openSetup);
  const streaming = useChatStore((s) => s.isStreaming);
  const streamingChatId = useChatStore((s) => s.streamingChatId);
  const isStreaming = streaming && streamingChatId === chatId;
  const rpsThrow = useRockPaperScissorsThrow(chatId);
  const resign = useResignRockPaperScissors(chatId);
  const [castClash, setCastClash] = useState<CastClash | null>(null);
  const castRevealTimer = useRef<number | null>(null);
  const lastAnimatedRound = useRef<number | null>(null);

  // Keep the match query active so package SSE invalidations refetch bot moves.
  const active = !!current && current.chatId === chatId;
  useRockPaperScissorsState(chatId);

  const view = active ? current : null;
  const latestRound = view?.rounds[view.rounds.length - 1] ?? null;
  const you = view?.seats.find((s) => s.seatId === view.yourSeatId) ?? null;
  const opponent = view?.seats.find((s) => s.seatId !== view.yourSeatId) ?? null;
  const winner = view?.winnerSeatId ? view.seats.find((s) => s.seatId === view.winnerSeatId) : null;

  useEffect(() => {
    return () => {
      if (castRevealTimer.current != null) window.clearTimeout(castRevealTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!view || !castClash?.yourChoice || !latestRound || latestRound.round === lastAnimatedRound.current) return;
    const yourThrow = view.yourSeatId ? latestRound.throws[view.yourSeatId] : null;
    const opponentThrow = opponent ? latestRound.throws[opponent.seatId] : null;
    if (!yourThrow || !opponentThrow) return;

    lastAnimatedRound.current = latestRound.round;
    const nextClash: CastClash = {
      yourChoice: yourThrow,
      opponentChoice: opponentThrow,
      outcome: !latestRound.winnerSeatId ? "tie" : latestRound.winnerSeatId === view.yourSeatId ? "win" : "loss",
      phase: "reveal",
    };
    if (castRevealTimer.current != null) window.clearTimeout(castRevealTimer.current);
    castRevealTimer.current = window.setTimeout(() => setCastClash(nextClash), 650);
  }, [castClash?.yourChoice, latestRound, opponent, view]);

  if (!view) return null;

  const disabled = isStreaming || rpsThrow.isPending || resign.isPending;
  const isMyTurn = view.status !== "finished" && view.currentSeatId === view.yourSeatId;

  const onThrow = (choice: RpsChoice) => {
    if (!isMyTurn || disabled) return;
    if (castRevealTimer.current != null) window.clearTimeout(castRevealTimer.current);
    setCastClash({ yourChoice: choice, opponentChoice: null, outcome: null, phase: "casting" });
    rpsThrow.mutate({ move: { type: "throw", choice } }, { onError: () => setCastClash(null) });
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
        <div className="flex items-center gap-1 text-xs font-medium text-[var(--foreground)]">
          {seat.displayName}
          {seat.seatId === view.yourSeatId && (
            <span className="text-[0.6rem] font-semibold text-[var(--muted-foreground)]">(you)</span>
          )}
        </div>
        <span className="text-[0.65rem] font-semibold text-[var(--muted-foreground)]">{seat.score}</span>
      </div>
    );

  const castSideClass = (side: "you" | "opponent") => {
    if (!castClash) return "";
    if (castClash.phase === "casting") {
      return side === "you"
        ? "animate-[rps-clank-left_650ms_cubic-bezier(0.22,1,0.36,1)_both]"
        : "animate-[rps-clank-right_650ms_cubic-bezier(0.22,1,0.36,1)_both]";
    }
    if (castClash.outcome === "tie") return "translate-y-0 opacity-100";
    const won = side === "you" ? castClash.outcome === "win" : castClash.outcome === "loss";
    return won ? "-translate-y-1 opacity-100" : "translate-y-4 opacity-60 grayscale";
  };

  return (
    <div className="mx-2 mb-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-sm">
      {/* Header: seats + status + resign */}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
        <span className="font-semibold text-[var(--foreground)]">Rock-Paper-Scissors</span>
        {seatChip(opponent)}
        {seatChip(you)}
        <div className="ml-auto flex items-center gap-2">
          {view.status !== "finished" && (
            <span className="font-medium">
              Round {view.roundNumber} · first to {view.roundsToWin}
            </span>
          )}
          {view.status !== "finished" && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Resign and end this match?")) resign.mutate();
              }}
              className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)] active:scale-90"
              title="Resign"
              aria-label="Resign and end match"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Finished banner */}
      {view.status === "finished" && (
        <div className="mb-2 rounded-lg bg-[var(--primary)]/10 px-3 py-2 text-center text-sm font-semibold text-[var(--primary)]">
          <div>{winner ? `${winner.displayName} wins the match! 🏆` : "Match over."}</div>
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

      {castClash && view.status !== "finished" && (
        <div
          className="relative mb-2 overflow-hidden rounded-lg bg-[var(--muted)]/30 px-3 py-3 ring-1 ring-[var(--primary)]/25 animate-[scale-in_160ms_ease-out]"
          aria-live="polite"
        >
          {castClash.phase === "reveal" && <div className="game-combat-impact-flash pointer-events-none absolute inset-0" />}
          <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
            <div className={`min-w-0 text-left transition-all duration-300 ease-out ${castSideClass("you")}`}>
              <div className="truncate text-[0.65rem] font-semibold text-[var(--muted-foreground)]">You</div>
              <div className="mt-1 flex min-h-14 items-center justify-end gap-2 px-1 py-2 text-right">
                <span className="truncate text-xs font-semibold text-[var(--foreground)]">
                  {castClash.phase === "reveal" ? CHOICE_LABEL[castClash.yourChoice] : "Casting"}
                </span>
                <span className="text-3xl leading-none">
                  {castClash.phase === "reveal" ? CHOICE_EMOJI[castClash.yourChoice] : "?"}
                </span>
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary)] text-[0.65rem] font-black text-[var(--primary-foreground)] shadow-[0_0_18px_color-mix(in_oklch,var(--primary)_35%,transparent)] animate-[rps-vs-pulse_650ms_cubic-bezier(0.22,1,0.36,1)_both]">
              VS
            </div>
            <div className={`min-w-0 text-right transition-all duration-300 ease-out ${castSideClass("opponent")}`}>
              <div className="truncate text-[0.65rem] font-semibold text-[var(--muted-foreground)]">
                {opponent?.displayName ?? "Opponent"}
              </div>
              <div className="mt-1 flex min-h-14 items-center justify-start gap-2 px-1 py-2 text-left">
                <span className="text-3xl leading-none">
                  {castClash.phase === "reveal" && castClash.opponentChoice ? CHOICE_EMOJI[castClash.opponentChoice] : "?"}
                </span>
                <span className="truncate text-xs font-semibold text-[var(--foreground)]">
                  {castClash.phase === "reveal" && castClash.opponentChoice ? CHOICE_LABEL[castClash.opponentChoice] : "Casting"}
                </span>
              </div>
            </div>
          </div>
          <div className="relative mt-1 text-center text-[0.68rem] font-semibold text-[var(--muted-foreground)]">
            {castClash.phase === "casting"
              ? "Casting..."
              : castClash.outcome === "win"
              ? "Round won"
              : castClash.outcome === "loss"
                ? "Round lost"
                : castClash.outcome === "tie"
                  ? "Tie, replaying"
                  : "Throws locked"}
          </div>
        </div>
      )}

      {/* Throw picker / waiting state */}
      {view.status !== "finished" && (
        <div className="mb-2">
          {isMyTurn ? (
            <div className="flex justify-center gap-2">
              {(["rock", "paper", "scissors"] as RpsChoice[]).map((choice) => (
                <button
                  key={choice}
                  type="button"
                  disabled={disabled}
                  onClick={() => onThrow(choice)}
                  className="flex h-16 w-20 flex-col items-center justify-center gap-1 rounded-lg bg-[var(--muted)]/40 px-2 py-2 ring-1 ring-[var(--border)] transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
                  aria-label={`Throw ${CHOICE_LABEL[choice]}`}
                >
                  <span className="text-2xl">{CHOICE_EMOJI[choice]}</span>
                  <span className="text-[0.65rem] text-[var(--muted-foreground)]">{CHOICE_LABEL[choice]}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-[var(--muted-foreground)]">
              {view.yourPendingChoice
                ? `You threw ${CHOICE_LABEL[view.yourPendingChoice]}. Waiting for ${opponent?.displayName ?? "opponent"}…`
                : `${opponent?.displayName ?? "Opponent"} is choosing…`}
            </p>
          )}
        </div>
      )}

      {/* Round history */}
      {view.rounds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {view.rounds
            .slice(-8)
            .map((r) => {
              const yourThrow = view.yourSeatId ? r.throws[view.yourSeatId] : undefined;
              const oppThrow = opponent ? r.throws[opponent.seatId] : undefined;
              const outcome = !r.winnerSeatId ? "tie" : r.winnerSeatId === view.yourSeatId ? "win" : "loss";
              return (
                <div
                  key={r.round}
                  className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs ring-1 ${
                    outcome === "win"
                      ? "bg-green-500/10 ring-green-500/30"
                      : outcome === "loss"
                        ? "bg-red-500/10 ring-red-500/30"
                        : "bg-[var(--muted)]/30 ring-[var(--border)]"
                  }`}
                  title={`Round ${r.round}`}
                >
                  <span>{yourThrow ? CHOICE_EMOJI[yourThrow] : "?"}</span>
                  <span className="text-[var(--muted-foreground)]">vs</span>
                  <span>{oppThrow ? CHOICE_EMOJI[oppThrow] : "?"}</span>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
