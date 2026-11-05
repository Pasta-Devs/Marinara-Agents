// ──────────────────────────────────────────────
// BlackjackBoard — live, interactive blackjack table (conversation mode)
// ──────────────────────────────────────────────
// A React component driven by the blackjack-game store (fed by the turn-game
// state query, which package server events refetch). Renders the dealer's
// hand, every seat's hands and bets, a betting/playing action bar for the
// viewer, and each round's results. Cards are pure CSS (no image assets),
// matching the visual language of PokerBoard.
import { type ReactNode, useEffect, useState } from "react";
import { X } from "lucide-react";
import type {
  BlackjackMove,
  BlackjackOutcome,
  BlackjackPublicHand,
} from "../../../../shared/src/features/turn-games/blackjack/types";
import { useChatStore } from "../../stores/chat.store";
import { useBlackjackGameStore } from "../../stores/blackjack-game.store";
import { useBlackjackMove, useBlackjackState, useResignBlackjack } from "../../hooks/use-blackjack";

interface Props {
  chatId: string;
}

const SUIT_SYMBOL: Record<string, string> = { c: "♣", d: "♦", h: "♥", s: "♠" };
const SUIT_NAME: Record<string, string> = { c: "clubs", d: "diamonds", h: "hearts", s: "spades" };
const RED_SUITS = new Set(["h", "d"]);
const RANK_GLYPH: Record<string, string> = { T: "10" };
const RANK_NAME: Record<string, string> = {
  "2": "Two",
  "3": "Three",
  "4": "Four",
  "5": "Five",
  "6": "Six",
  "7": "Seven",
  "8": "Eight",
  "9": "Nine",
  T: "Ten",
  J: "Jack",
  Q: "Queen",
  K: "King",
  A: "Ace",
};

const OUTCOME_LABEL: Record<BlackjackOutcome, string> = {
  blackjack: "Blackjack",
  win: "Win",
  push: "Push",
  lose: "Lose",
};

function cardLabelFromCode(code: string): string {
  const rank = code.slice(0, -1);
  const suit = code.slice(-1);
  return `${RANK_NAME[rank] ?? rank} of ${SUIT_NAME[suit] ?? suit}`;
}

// ── cards ─────────────────────────────────────────────────────────────────────

function CardFace({ code, size = "md" }: { code: string | null; size?: "sm" | "md" | "lg" }) {
  const dims = {
    sm: "h-9 w-6 text-[0.6rem]",
    md: "h-12 w-8 text-xs",
    lg: "h-16 w-11 text-base",
  }[size];

  if (!code) {
    return (
      <div
        className={`${dims} shrink-0 rounded-md bg-[repeating-linear-gradient(45deg,#7f1d1d_0,#7f1d1d_3px,#991b1b_3px,#991b1b_6px)] shadow-sm ring-1 ring-black/30`}
        role="img"
        aria-label="Face-down card"
      />
    );
  }

  const rank = code.slice(0, -1);
  const suit = code.slice(-1);
  const color = RED_SUITS.has(suit) ? "#c81e3a" : "#1c1c1c";
  return (
    <div
      className={`relative flex ${dims} shrink-0 flex-col items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-black/20`}
      role="img"
      aria-label={cardLabelFromCode(code)}
    >
      <span className="font-extrabold leading-none" style={{ color }}>
        {RANK_GLYPH[rank] ?? rank}
      </span>
      <span className="leading-none" style={{ color }}>
        {SUIT_SYMBOL[suit] ?? suit}
      </span>
    </div>
  );
}

function handTotalLabel(hand: BlackjackPublicHand): string {
  if (hand.status === "blackjack") return "Blackjack";
  if (hand.status === "busted") return `Bust (${hand.total})`;
  return `${hand.soft && hand.total < 21 ? "Soft " : ""}${hand.total}`;
}

function OutcomeBadge({ hand }: { hand: BlackjackPublicHand }) {
  if (!hand.outcome) return null;
  const tone =
    hand.net > 0
      ? "bg-emerald-500/15 text-emerald-600"
      : hand.net < 0
        ? "bg-red-500/15 text-red-600"
        : "bg-[var(--muted)] text-[var(--muted-foreground)]";
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[0.6rem] font-semibold ${tone}`}>
      {OUTCOME_LABEL[hand.outcome]} {hand.net > 0 ? `+${hand.net}` : hand.net < 0 ? hand.net : ""}
    </span>
  );
}

function ActionButton({
  children,
  onClick,
  highlight,
}: {
  children: ReactNode;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1 text-sm font-medium transition-transform active:scale-95 ${
        highlight
          ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
          : "border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--muted)]"
      }`}
    >
      {children}
    </button>
  );
}

// ── component ─────────────────────────────────────────────────────────────────

export function BlackjackBoard({ chatId }: Props) {
  const view = useBlackjackGameStore((s) => s.byChat[chatId] ?? null);
  const streaming = useChatStore((s) => s.isStreaming);
  const streamingChatId = useChatStore((s) => s.streamingChatId);
  const isStreaming = streaming && streamingChatId === chatId;
  const move = useBlackjackMove(chatId);
  const resign = useResignBlackjack(chatId);

  // Keep the table query active so package server events refetch bot moves.
  useBlackjackState(chatId);

  const disabled = isStreaming || move.isPending || resign.isPending;
  const actions = view?.yourActions ?? null;
  const minBet = actions?.minBet ?? 0;
  const maxBet = actions?.maxBet ?? 0;

  // A raw string so partial entries survive typing; clamped only on blur, quick-pick and submit.
  const [betInput, setBetInput] = useState("0");
  // Reset the bet field when a new betting turn arrives, not on unrelated state patches.
  useEffect(() => {
    if (actions?.canBet) setBetInput(String(minBet));
  }, [view?.roundNumber, view?.currentSeatId, actions?.canBet, minBet]);

  if (!view) return null;

  const clampBet = (n: number) => Math.max(minBet, Math.min(maxBet, Math.floor(Number.isFinite(n) ? n : minBet)));
  const betAmount = clampBet(Number(betInput));
  const submit = (m: BlackjackMove) => {
    if (!disabled) move.mutate({ move: m });
  };

  const isMyTurn = view.status !== "finished" && view.currentSeatId === view.yourSeatId;
  const currentSeat = view.seats.find((s) => s.seatId === view.currentSeatId) ?? null;
  const winnerSeat = view.winnerSeatId ? view.seats.find((s) => s.seatId === view.winnerSeatId) : null;
  const dealerSeat = view.seats.find((s) => s.isDealer) ?? null;
  const players = view.seats.filter((s) => !s.isDealer);
  const statusText =
    view.status === "betting"
      ? "Betting"
      : view.status === "playing"
        ? "Playing"
        : view.status === "round_over"
          ? "Round over"
          : "Game over";

  return (
    <div className="mx-2 mb-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-sm">
      {/* Header: round, minimum bet, turn indicator, end control */}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
        <span className="font-semibold text-[var(--foreground)]">
          Blackjack · Round {view.roundNumber}
          {view.roundLimit > 0 ? ` of ${view.roundLimit}` : ""} · {statusText}
        </span>
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[0.7rem] font-semibold text-emerald-600">
          Min bet {view.config.minBet}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {(view.status === "betting" || view.status === "playing") && (
            <span className={isMyTurn ? "animate-pulse font-semibold text-[var(--primary)]" : ""}>
              {isMyTurn ? "Your turn" : `${currentSeat?.displayName ?? "…"} is thinking…`}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              if (view.status === "finished" || window.confirm("End this blackjack game?")) resign.mutate();
            }}
            className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)] active:scale-90"
            title={view.status === "finished" ? "Close" : "End game"}
            aria-label={view.status === "finished" ? "Close game" : "End game"}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Finished banner + final chips */}
      {view.status === "finished" && (
        <>
          <div className="mb-1.5 rounded-lg bg-[var(--primary)]/10 px-3 py-2 text-center text-sm font-semibold text-[var(--primary)]">
            {winnerSeat
              ? `🏆 ${winnerSeat.displayName} leaves the table richest!`
              : players.every((s) => s.out)
                ? "The house wins."
                : "Game over"}
          </div>
          <div className="mb-2 flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[0.7rem] text-[var(--muted-foreground)]">
            {players.map((s) => (
              <span key={s.seatId}>
                {s.displayName}: {s.bankroll}
              </span>
            ))}
          </div>
        </>
      )}

      {/* Dealer */}
      <div className="mb-2 flex flex-col items-center gap-1 rounded-lg bg-emerald-900/10 p-2">
        <div className="text-[0.7rem] font-medium text-[var(--muted-foreground)]">
          {dealerSeat ? `${dealerSeat.displayName} (dealer)` : "Dealer"}
          {view.dealerTotal !== null && (
            <span className="ml-1 font-semibold text-[var(--foreground)]">
              · {view.dealerTotal > 21 ? `Bust (${view.dealerTotal})` : view.dealerTotal}
              {!view.dealerRevealed && " showing"}
            </span>
          )}
        </div>
        <div className="flex min-h-16 items-center gap-1.5">
          {view.dealerCards.length === 0 ? (
            <span className="text-xs text-[var(--muted-foreground)]">Waiting for bets…</span>
          ) : (
            view.dealerCards.map((code, i) => <CardFace key={i} code={code} size="lg" />)
          )}
        </div>
      </div>

      {/* Players, in table order */}
      <div className="mb-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {players.map((seat) => {
          const isYou = seat.seatId === view.yourSeatId;
          return (
            <div
              key={seat.seatId}
              className={`rounded-lg px-2 py-1.5 ${seat.out ? "opacity-40" : ""} ${
                seat.isCurrent
                  ? "animate-pulse ring-2 ring-[var(--primary)]"
                  : isYou
                    ? "ring-1 ring-[var(--border)]"
                    : "ring-1 ring-transparent"
              }`}
            >
              <div className="flex items-center gap-1 text-xs font-medium text-[var(--foreground)]">
                <span className="truncate">{seat.displayName}</span>
                {isYou && <span className="text-[0.6rem] font-semibold text-[var(--muted-foreground)]">(you)</span>}
                <span className="ml-auto text-[0.7rem] font-normal text-[var(--muted-foreground)]">
                  {seat.out ? "out of chips" : `${seat.bankroll} chips`}
                  {seat.bet !== null && seat.hands.length === 0 && ` · bet ${seat.bet}`}
                </span>
              </div>
              {seat.hands.map((hand, index) => (
                <div
                  key={index}
                  className={`mt-1 flex flex-wrap items-center gap-1.5 rounded-md p-0.5 ${
                    seat.isCurrent && seat.hands.length > 1 && index === seat.activeHandIndex
                      ? "bg-[var(--primary)]/10"
                      : ""
                  }`}
                >
                  <div className="flex gap-1">
                    {hand.cards.map((code, i) => (
                      <CardFace key={i} code={code} size={isYou ? "md" : "sm"} />
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-[var(--foreground)]">{handTotalLabel(hand)}</span>
                  <span className="text-[0.65rem] text-[var(--muted-foreground)]">
                    bet {hand.bet}
                    {hand.doubled ? " (doubled)" : ""}
                  </span>
                  <OutcomeBadge hand={hand} />
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Action bar */}
      {isMyTurn && !disabled && actions?.canBet && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[var(--border)] p-1.5">
          <input
            type="number"
            min={minBet}
            max={maxBet}
            value={betInput}
            onChange={(e) => setBetInput(e.target.value)}
            onBlur={() => setBetInput(String(betAmount))}
            aria-label="Bet amount"
            className="w-20 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm text-[var(--foreground)]"
          />
          {[
            ["Min", minBet],
            ["×2", minBet * 2],
            ["×5", minBet * 5],
            ["Max", maxBet],
          ].map(([label, amount]) => (
            <button
              key={label}
              type="button"
              onClick={() => setBetInput(String(clampBet(Number(amount))))}
              className="rounded px-1.5 py-1 text-xs text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
            >
              {label}
            </button>
          ))}
          <ActionButton highlight onClick={() => submit({ type: "bet", amount: betAmount })}>
            Bet {betAmount}
          </ActionButton>
        </div>
      )}
      {isMyTurn && !disabled && view.status === "playing" && (
        <div className="flex flex-wrap items-center gap-2">
          {actions?.canHit && (
            <ActionButton highlight onClick={() => submit({ type: "hit" })}>
              Hit
            </ActionButton>
          )}
          {actions?.canStand && <ActionButton onClick={() => submit({ type: "stand" })}>Stand</ActionButton>}
          {actions?.canDouble && <ActionButton onClick={() => submit({ type: "double" })}>Double</ActionButton>}
          {actions?.canSplit && <ActionButton onClick={() => submit({ type: "split" })}>Split</ActionButton>}
        </div>
      )}
      {actions?.canNextRound && !disabled && (
        <ActionButton highlight onClick={() => submit({ type: "next_round" })}>
          Next round
        </ActionButton>
      )}

      {/* Last action ticker + recent log */}
      {view.status !== "finished" && (view.lastAction || view.recentLog.length > 0) && (
        <div className="mt-1.5 space-y-0.5 text-[0.7rem] text-[var(--muted-foreground)]">
          {view.lastAction && (
            <div className="truncate">
              {view.seats.find((s) => s.seatId === view.lastAction!.seatId)?.displayName ?? "—"}{" "}
              {view.lastAction.summary}
            </div>
          )}
          {view.recentLog.length > 0 && (
            <ul className="space-y-0.5">
              {view.recentLog.slice(-4).map((entry, i) => (
                <li key={i} className="truncate opacity-70">
                  {entry.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
