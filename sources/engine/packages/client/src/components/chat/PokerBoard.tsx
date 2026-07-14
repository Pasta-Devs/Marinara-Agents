// ──────────────────────────────────────────────
// PokerBoard — live, interactive Texas Hold'em table (conversation mode)
// ──────────────────────────────────────────────
// A real React component driven by the poker-game store (fed by
// turn_game_state_patch SSE + an initial fetch). Renders the community cards,
// every seat around the table, the viewer's own hole cards, a betting action
// bar, and a showdown recap. Cards are pure CSS (no image assets), matching
// the visual language of ChessBoard / UnoBoard.
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import type { PokerMove, PokerStreet } from "@marinara-engine/shared";
import { useChatStore } from "../../stores/chat.store";
import { usePokerGameStore } from "../../stores/poker-game.store";
import { usePokerMove, usePokerState, useResignPoker } from "../../hooks/use-poker";

interface Props {
  chatId: string;
}

interface CardLike {
  rank: number;
  suit: string;
}

const SUIT_SYMBOL: Record<string, string> = { c: "♣", d: "♦", h: "♥", s: "♠" };
const SUIT_NAME: Record<string, string> = { c: "clubs", d: "diamonds", h: "hearts", s: "spades" };
const RED_SUITS = new Set(["h", "d"]);

const RANK_CODE: Record<number, string> = {
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "T",
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
};

// Slightly friendlier than the raw "T" notation used in compact card codes.
const RANK_GLYPH: Record<string, string> = { T: "10" };

const RANK_NAME: Record<string, string> = {
  "2": "two",
  "3": "three",
  "4": "four",
  "5": "five",
  "6": "six",
  "7": "seven",
  "8": "eight",
  "9": "nine",
  T: "ten",
  J: "jack",
  Q: "queen",
  K: "king",
  A: "ace",
};

const STREET_LABEL: Record<PokerStreet, string> = {
  preflop: "Preflop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
};

/** Compact two-character code, e.g. "Ah", matching the server's `cardCode()`. */
function codeFromCard(card: CardLike): string {
  return `${RANK_CODE[card.rank] ?? "?"}${card.suit}`;
}

function cardLabelFromCode(code: string): string {
  const rank = code.slice(0, -1);
  const suit = code.slice(-1);
  const rankName = RANK_NAME[rank] ?? rank;
  const capitalized = rankName.charAt(0).toUpperCase() + rankName.slice(1);
  return `${capitalized} of ${SUIT_NAME[suit] ?? suit}`;
}

// ── card face ────────────────────────────────────────────────────────────────

function CardFace({
  code,
  size = "md",
  highlight = false,
}: {
  code?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  highlight?: boolean;
}) {
  const dims = {
    sm: "h-9 w-6 text-[0.6rem]",
    md: "h-12 w-8 text-xs",
    lg: "h-16 w-11 text-base",
    xl: "h-20 w-14 text-xl",
  }[size];

  if (!code) {
    return (
      <div
        className={`${dims} shrink-0 rounded-md border-2 border-dashed border-[var(--border)] bg-[var(--muted)]/20`}
        aria-hidden="true"
      />
    );
  }

  const rank = code.slice(0, -1);
  const suit = code.slice(-1);
  const isRed = RED_SUITS.has(suit);
  const ring = highlight ? "ring-2 ring-amber-400" : "ring-1 ring-black/20";

  return (
    <div
      className={`relative flex ${dims} shrink-0 flex-col items-center justify-center gap-0 rounded-md bg-white shadow-sm ${ring}`}
      role="img"
      aria-label={cardLabelFromCode(code)}
    >
      <span className="font-extrabold leading-none" style={{ color: isRed ? "#c81e3a" : "#1c1c1c" }}>
        {RANK_GLYPH[rank] ?? rank}
      </span>
      <span className="leading-none" style={{ color: isRed ? "#c81e3a" : "#1c1c1c" }}>
        {SUIT_SYMBOL[suit] ?? suit}
      </span>
    </div>
  );
}

// ── action button ────────────────────────────────────────────────────────────

function ActionButton({
  children,
  onClick,
  disabled,
  highlight,
  ariaLabel,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  highlight?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      className={`rounded-lg px-3 py-1 text-sm font-medium transition-transform active:scale-95 disabled:opacity-40 ${
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

export function PokerBoard({ chatId }: Props) {
  const current = usePokerGameStore((s) => s.current);
  const streaming = useChatStore((s) => s.isStreaming);
  const streamingChatId = useChatStore((s) => s.streamingChatId);
  const isStreaming = streaming && streamingChatId === chatId;
  const move = usePokerMove(chatId);
  const resign = useResignPoker(chatId);

  // Hydrate the table on mount / chat switch (no-op if no active game).
  const active = !!current && current.chatId === chatId;
  usePokerState(active ? null : chatId);

  const view = active ? current : null;
  const disabled = isStreaming || move.isPending || resign.isPending;
  const isMyTurn = !!view && view.status === "active" && view.currentSeatId === view.yourSeatId;

  const yourActions = view?.yourActions ?? null;
  const minFloor = yourActions ? (yourActions.canBet ? yourActions.minBet : yourActions.minRaiseTo) : 0;
  const maxTo = yourActions?.maxTo ?? 0;

  // The field holds a RAW string so partial entries survive typing (clamping on
  // every keystroke would snap "1" up to the minimum before "150" can be typed);
  // it is clamped into the legal range only on blur, quick-pick, and submit.
  const [betInput, setBetInput] = useState("0");
  // Reset the bet/raise field only when a fresh DECISION POINT arrives (a new
  // hand, a new street, turn passing, or the legal bet/raise window moving) —
  // a stale amount from a prior street could exceed the new maxTo. Keyed off
  // those fields rather than the whole `view` so an unrelated state patch
  // (e.g. a dealer-announcement drain) can't wipe a partially typed amount
  // mid-turn.
  useEffect(() => {
    if (!yourActions) return;
    setBetInput(String(minFloor));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.handNumber, view?.street, view?.currentSeatId, yourActions?.canBet, minFloor]);

  const clampBet = useMemo(
    () => (n: number) => Math.max(minFloor, Math.min(maxTo, Math.floor(Number.isFinite(n) ? n : minFloor))),
    [minFloor, maxTo],
  );
  const betAmount = clampBet(Number(betInput));

  if (!view) return null;

  const submit = (m: PokerMove) => {
    if (disabled) return;
    move.mutate({ move: m });
  };

  const submitBetOrRaise = () => {
    if (disabled || !yourActions) return;
    if (yourActions.canBet) submit({ type: "bet", amount: betAmount });
    else if (yourActions.canRaise) submit({ type: "raise", toAmount: betAmount });
  };

  const currentSeat = view.seats.find((s) => s.seatId === view.currentSeatId) ?? null;
  const winnerSeat = view.winnerSeatId ? view.seats.find((s) => s.seatId === view.winnerSeatId) : null;
  const potHalf = Math.floor(view.potTotal / 2);

  return (
    <div className="mx-2 mb-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-sm">
      {/* Header: hand/street/blinds + pot chip + turn indicator + end control */}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
        <span className="font-semibold text-[var(--foreground)]">
          Poker — Hand #{view.handNumber} · {STREET_LABEL[view.street]} · Blinds {view.blinds.smallBlind}/{view.blinds.bigBlind}
        </span>
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[0.7rem] font-semibold text-amber-600">
          Pot {view.potTotal}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {view.status === "active" && (
            <span className={isMyTurn ? "font-semibold text-[var(--primary)] animate-pulse" : ""}>
              {isMyTurn ? "Your turn" : `${currentSeat?.displayName ?? "…"} is thinking…`}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              if (view.status === "finished" || window.confirm("End this poker game?")) resign.mutate();
            }}
            className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)] active:scale-90"
            title={view.status === "finished" ? "Close" : "End game"}
            aria-label={view.status === "finished" ? "Close game" : "End game"}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Finished banner + final stacks */}
      {view.status === "finished" && (
        <>
          <div className="mb-1.5 rounded-lg bg-[var(--primary)]/10 px-3 py-2 text-center text-sm font-semibold text-[var(--primary)]">
            {winnerSeat ? `🏆 ${winnerSeat.displayName} wins the session!` : "Game over"}
          </div>
          <div className="mb-2 flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[0.7rem] text-[var(--muted-foreground)]">
            {view.seats.map((s) => (
              <span key={s.seatId}>
                {s.displayName}: {s.stack}
              </span>
            ))}
          </div>
        </>
      )}

      {/* Community cards */}
      <div className="mx-auto mb-2 flex items-center justify-center gap-1.5">
        {Array.from({ length: 5 }, (_, i) => (
          <CardFace key={i} code={view.communityCodes[i]} size="lg" />
        ))}
      </div>

      {/* Seats, in table order */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {view.seats.map((seat) => {
          const isYou = seat.seatId === view.yourSeatId;
          const isDealingChar = !!view.dealerCharacterId && seat.seatId === view.dealerCharacterId;
          const dim = seat.busted ? "opacity-35" : seat.folded ? "opacity-50" : "";
          return (
            <div
              key={seat.seatId}
              className={`rounded-lg px-1.5 py-1 ${dim} ${
                seat.isCurrent
                  ? "ring-2 ring-[var(--primary)] animate-pulse"
                  : isYou
                    ? "ring-1 ring-[var(--border)]"
                    : "ring-1 ring-transparent"
              }`}
            >
              <div className="flex items-center gap-1 text-xs font-medium text-[var(--foreground)]">
                <span className="truncate">{seat.displayName}</span>
                {isYou && <span className="text-[0.6rem] font-semibold text-[var(--muted-foreground)]">(you)</span>}
                {seat.isButton && (
                  <span
                    className="rounded-full bg-[var(--foreground)]/10 px-1 text-[0.6rem] font-bold text-[var(--foreground)]"
                    title="Dealer button"
                    aria-label="Dealer button"
                  >
                    D
                  </span>
                )}
                {seat.isSmallBlind && (
                  <span className="text-[0.6rem] font-semibold text-[var(--muted-foreground)]" title="Small blind">
                    SB
                  </span>
                )}
                {seat.isBigBlind && (
                  <span className="text-[0.6rem] font-semibold text-[var(--muted-foreground)]" title="Big blind">
                    BB
                  </span>
                )}
                {isDealingChar && (
                  <span className="text-[0.65rem]" title={`${seat.displayName} is dealing`} aria-label={`${seat.displayName} is dealing`}>
                    🎴
                  </span>
                )}
              </div>
              <div className="text-[0.7rem] text-[var(--muted-foreground)]">
                {seat.stack} chips
                {seat.streetBet > 0 && <span> · bet {seat.streetBet}</span>}
                {seat.folded && <span> · folded</span>}
                {seat.allIn && <span> · all in</span>}
                {seat.busted && <span> · busted</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Your hole cards + hand label */}
      {view.yourSeatId && (
        <div className="mb-2 flex items-center gap-3 rounded-lg bg-[var(--muted)]/25 p-2">
          <div className="flex gap-1.5">
            <CardFace code={view.yourHoleCards[0]?.code} size="xl" />
            <CardFace code={view.yourHoleCards[1]?.code} size="xl" />
          </div>
          <div className="leading-tight">
            <div className="text-[0.7rem] text-[var(--muted-foreground)]">Your hand</div>
            {view.yourHandLabel && (
              <div className="text-sm font-semibold text-[var(--foreground)]">{view.yourHandLabel}</div>
            )}
          </div>
        </div>
      )}

      {/* Action bar */}
      {isMyTurn && !disabled && (
        <div className="flex flex-wrap items-center gap-2">
          {yourActions?.canFold && <ActionButton onClick={() => submit({ type: "fold" })}>Fold</ActionButton>}
          {yourActions?.canCheck && <ActionButton onClick={() => submit({ type: "check" })}>Check</ActionButton>}
          {yourActions?.canCall && (
            <ActionButton onClick={() => submit({ type: "call" })}>Call {yourActions.callAmount}</ActionButton>
          )}
          {yourActions?.canAllIn && (
            <ActionButton highlight ariaLabel="Go all in" onClick={() => submit({ type: "all_in" })}>
              All in
            </ActionButton>
          )}
          {(yourActions?.canBet || yourActions?.canRaise) && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[var(--border)] p-1.5">
              <input
                type="number"
                min={minFloor}
                max={maxTo}
                value={betInput}
                onChange={(e) => setBetInput(e.target.value)}
                onBlur={() => setBetInput(String(betAmount))}
                aria-label={yourActions?.canBet ? "Bet amount" : "Raise amount"}
                className="w-20 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm text-[var(--foreground)]"
              />
              <button
                type="button"
                onClick={() => setBetInput(String(clampBet(minFloor)))}
                className="rounded px-1.5 py-1 text-xs text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              >
                Min
              </button>
              <button
                type="button"
                onClick={() => setBetInput(String(clampBet(potHalf)))}
                className="rounded px-1.5 py-1 text-xs text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              >
                ½ pot
              </button>
              <button
                type="button"
                onClick={() => setBetInput(String(clampBet(view.potTotal)))}
                className="rounded px-1.5 py-1 text-xs text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              >
                Pot
              </button>
              <button
                type="button"
                onClick={() => setBetInput(String(clampBet(maxTo)))}
                className="rounded px-1.5 py-1 text-xs text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              >
                All-in
              </button>
              <ActionButton highlight onClick={submitBetOrRaise}>
                {yourActions?.canBet ? `Bet ${betAmount}` : `Raise to ${betAmount}`}
              </ActionButton>
            </div>
          )}
        </div>
      )}

      {/* Showdown recap */}
      {view.status === "hand_over" && view.handResults && (
        <div className="mt-2 space-y-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/25 p-2">
          <div className="text-xs font-semibold text-[var(--foreground)]">Showdown</div>
          {view.handResults.reveals.length > 0 && (
            <div className="space-y-1.5">
              {view.handResults.reveals.map((reveal) => {
                const seat = view.seats.find((s) => s.seatId === reveal.seatId);
                return (
                  <div key={reveal.seatId} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="w-24 shrink-0 truncate font-medium text-[var(--foreground)]">
                      {seat?.displayName ?? reveal.seatId}
                    </span>
                    <div className="flex gap-1">
                      {reveal.holeCards.map((card, i) => {
                        const code = codeFromCard(card);
                        return <CardFace key={i} code={code} size="sm" highlight={reveal.bestFiveCodes.includes(code)} />;
                      })}
                    </div>
                    <span className="text-[var(--muted-foreground)]">{reveal.label}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="space-y-0.5">
            {view.handResults.potAwards.map((award, i) => {
              const seat = view.seats.find((s) => s.seatId === award.seatId);
              return (
                <div key={i} className="text-xs text-[var(--foreground)]">
                  {seat?.displayName ?? award.seatId} wins {award.amount} ({award.label})
                </div>
              );
            })}
          </div>
          {yourActions?.canNextHand && (
            <ActionButton highlight onClick={() => submit({ type: "next_hand" })}>
              Next hand
            </ActionButton>
          )}
        </div>
      )}

      {/* Last action ticker + recent log */}
      {view.status !== "finished" && (view.lastAction || view.recentLog.length > 0) && (
        <div className="mt-1.5 space-y-0.5 text-[0.7rem] text-[var(--muted-foreground)]">
          {view.lastAction && (
            <div className="truncate">
              {view.seats.find((s) => s.seatId === view.lastAction!.seatId)?.displayName ?? "—"} {view.lastAction.summary}
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
