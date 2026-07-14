// ──────────────────────────────────────────────
// UnoBoard — live, interactive UNO board (conversation mode)
// ──────────────────────────────────────────────
// A real React component driven by the turn-game store (fed by turn_game_state_patch
// SSE + an initial fetch). Renders the discard, active color, direction, each
// seat's count, and the player's own hand with legal-move gating. Cards are
// pure CSS/SVG (no image assets), so they scale crisply and theme cleanly.
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, RotateCw, X } from "lucide-react";
import type { UnoCard, UnoColor } from "@marinara-engine/shared";
import { useChatStore } from "../../stores/chat.store";
import { useUnoGameStore } from "../../stores/uno-game.store";
import { useResignUno, useUnoMove, useUnoState } from "../../hooks/use-uno";

interface Props {
  chatId: string;
}

const CARD_FILL: Record<UnoColor, string> = {
  red: "#e0322b",
  yellow: "#e6ad1c",
  green: "#3aa856",
  blue: "#2b6fd6",
};

const WILD_GRADIENT =
  "conic-gradient(from 45deg, #e0322b 0deg 90deg, #e6ad1c 90deg 180deg, #3aa856 180deg 270deg, #2b6fd6 270deg 360deg)";

const VALUE_LABEL: Record<string, string> = {
  skip: "⦸",
  reverse: "⟲",
  draw2: "+2",
  wild: "W",
  wild4: "+4",
};

function cardGlyph(card: UnoCard): string {
  return VALUE_LABEL[card.value] ?? card.value;
}

// Spoken card names for screen readers (the glyphs above aren't announced well).
const VALUE_NAME: Record<string, string> = {
  skip: "Skip",
  reverse: "Reverse",
  draw2: "Draw Two",
  wild: "Wild",
  wild4: "Wild Draw Four",
};

function cardName(card: UnoCard): string {
  const value = VALUE_NAME[card.value] ?? card.value;
  if (card.color === "wild") return value;
  const color = card.color.charAt(0).toUpperCase() + card.color.slice(1);
  return `${color} ${value}`;
}

function cardFill(card: UnoCard): string {
  return card.color === "wild" ? WILD_GRADIENT : CARD_FILL[card.color as UnoColor];
}

function CardFace({ card, size = "md" }: { card: UnoCard; size?: "sm" | "md" | "lg" }) {
  const dims = size === "lg" ? "h-20 w-14 text-2xl" : size === "sm" ? "h-10 w-7 text-sm" : "h-16 w-11 text-xl";
  return (
    <div
      className={`relative ${dims} shrink-0 rounded-md shadow-sm ring-1 ring-black/20`}
      style={{ background: cardFill(card) }}
    >
      <div className="absolute inset-1 flex items-center justify-center rounded-[40%] bg-white/90">
        <span className="font-extrabold text-black/80">{cardGlyph(card)}</span>
      </div>
    </div>
  );
}

function CardBack({ size = "sm" }: { size?: "sm" | "md" }) {
  const dims = size === "md" ? "h-16 w-11" : "h-10 w-7";
  return (
    <div className={`${dims} shrink-0 rounded-md bg-zinc-800 shadow-sm ring-1 ring-black/30`}>
      <div className="flex h-full w-full -rotate-12 items-center justify-center">
        <span className="text-[0.55rem] font-black tracking-tight text-red-500">UNO</span>
      </div>
    </div>
  );
}

export function UnoBoard({ chatId }: Props) {
  const current = useUnoGameStore((s) => s.current);
  const streaming = useChatStore((s) => s.isStreaming);
  const streamingChatId = useChatStore((s) => s.streamingChatId);
  const isStreaming = streaming && streamingChatId === chatId;
  const move = useUnoMove(chatId);
  const resign = useResignUno(chatId);

  // Hydrate the board on mount / chat switch (no-op if no active game).
  const active = !!current && current.chatId === chatId;
  useUnoState(active ? null : chatId);

  const [pending, setPending] = useState<{ card: UnoCard; kind: "color" | "swap" } | null>(null);
  useEffect(() => setPending(null), [chatId]);

  const view = active ? current : null;
  const disabled = isStreaming || move.isPending || resign.isPending;

  const isMyTurn = !!view && view.currentSeatId === view.yourSeatId;
  const jumpInSet = useMemo(() => new Set(view?.jumpInCardIds ?? []), [view]);

  // Seats arranged in ACTUAL turn order: the current player first, then each
  // following seat in the live play direction. A Reverse flips `direction`, so
  // the queue visibly re-orders; the human appears in their real slot rather
  // than pinned aside. Falls back to the natural seating order once the game is
  // finished (no current seat).
  const turnOrderedSeats = useMemo(() => {
    if (!view) return [];
    const seats = view.seats;
    const n = seats.length;
    const curIdx = seats.findIndex((s) => s.seatId === view.currentSeatId);
    if (n === 0 || curIdx < 0) return seats;
    const dir = view.direction === -1 ? -1 : 1;
    return Array.from({ length: n }, (_, k) => seats[(((curIdx + dir * k) % n) + n) % n]!);
  }, [view]);

  // No active game: render nothing. The setup modal is mounted once in
  // ConversationView (a stable position), so it never double-renders here.
  if (!view) return null;

  const submit = (m: Record<string, unknown>) => {
    if (disabled) return;
    setPending(null);
    move.mutate({ move: m });
  };

  // Playing one of your two cards leaves you at one: declare UNO on that play so a
  // bot can't catch you in the instant before you could click "Call UNO!" (bots
  // already auto-declare for themselves, so this just makes the human symmetric).
  const goingToOne = view.yourHand.length === 2;

  const onCardClick = (entry: { card: UnoCard; playable: boolean }) => {
    if (disabled) return;
    const { card } = entry;
    if (isMyTurn) {
      if (!entry.playable) return;
      if (card.color === "wild") return setPending({ card, kind: "color" });
      if (card.value === "7" && view.config.sevenZero && view.seats.length > 1) {
        return setPending({ card, kind: "swap" });
      }
      submit({ type: "play", cardId: card.id, ...(goingToOne ? { sayUno: true } : {}) });
    } else if (jumpInSet.has(card.id)) {
      submit({ type: "jump_in", cardId: card.id, ...(goingToOne ? { sayUno: true } : {}) });
    }
  };

  const winner = view.winnerSeatId ? view.seats.find((s) => s.seatId === view.winnerSeatId) : null;
  const opponents = view.seats.filter((s) => s.seatId !== view.yourSeatId);

  return (
    <div className="mx-2 mb-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-sm">
      {/* Header: status + controls */}
      <div className="mb-2 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
        <span className="font-semibold text-[var(--foreground)]">UNO</span>
        <span
          className="inline-block h-3 w-3 rounded-full ring-1 ring-black/20"
          style={{ background: CARD_FILL[view.activeColor] }}
          title={`Active color: ${view.activeColor}`}
        />
        <span className="capitalize">{view.activeColor}</span>
        <RotateCw className={`h-3.5 w-3.5 ${view.direction === -1 ? "-scale-x-100" : ""}`} />
        <span>Draw pile: {view.drawPileCount}</span>
        {view.pendingDraw > 0 && (
          <span className="rounded bg-[var(--destructive)]/15 px-1.5 py-0.5 font-semibold text-[var(--destructive)]">
            +{view.pendingDraw}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {view.status !== "finished" && (
            <span className={isMyTurn ? "font-semibold text-[var(--primary)] animate-pulse" : ""}>
              {isMyTurn
                ? "Your turn"
                : `${view.seats.find((s) => s.seatId === view.currentSeatId)?.displayName ?? "…"}'s turn`}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              if (window.confirm("End this game?")) resign.mutate();
            }}
            className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)] active:scale-90"
            title="End game"
            aria-label="End game"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Last action ticker (the literal board move; narration messages stay in-character) */}
      {view.lastAction && view.status !== "finished" && (
        <div className="mb-1.5 truncate text-[0.7rem] text-[var(--muted-foreground)]">
          {view.seats.find((s) => s.seatId === view.lastAction!.seatId)?.displayName ?? "—"} {view.lastAction.summary}
        </div>
      )}

      {/* Seats in live turn order (current first, play-direction), including you + discard */}
      <div className="mb-2 flex items-center gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          {turnOrderedSeats.map((seat, idx) => {
            const isYou = seat.seatId === view.yourSeatId;
            const catchable = !isYou && view.catchableSeatIds.includes(seat.seatId);
            const isNext = view.status !== "finished" && idx === 1 && turnOrderedSeats.length > 1;
            return (
              <div
                key={seat.seatId}
                className={`flex items-center gap-1.5 rounded-lg px-1.5 py-1 ${
                  seat.isCurrent
                    ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/40"
                    : isYou
                      ? "ring-1 ring-[var(--border)]"
                      : ""
                }`}
              >
                <CardBack />
                <div className="leading-tight">
                  <div className="flex items-center gap-1 text-xs font-medium text-[var(--foreground)]">
                    {seat.displayName}
                    {isYou && <span className="text-[0.6rem] font-semibold text-[var(--muted-foreground)]">(you)</span>}
                    {isNext && (
                      <span className="text-[0.6rem] font-semibold uppercase tracking-wide text-[var(--primary)]/70">
                        next
                      </span>
                    )}
                    {seat.vulnerable && <span className="text-[0.6rem] font-bold text-amber-500">UNO?</span>}
                  </div>
                  <div className="text-[0.7rem] text-[var(--muted-foreground)]">
                    {seat.handCount} {seat.handCount === 1 ? "card" : "cards"}
                  </div>
                </div>
                {catchable && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => submit({ type: "call_out", targetSeatId: seat.seatId })}
                    className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[0.65rem] font-semibold text-amber-600 hover:bg-amber-500/30 disabled:opacity-40"
                  >
                    Catch!
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex flex-col items-center">
          {view.topCard ? <CardFace card={view.topCard} size="lg" /> : <CardBack size="md" />}
          <span className="mt-0.5 text-[0.6rem] text-[var(--muted-foreground)]">discard</span>
        </div>
      </div>

      {/* Win banner */}
      {view.status === "finished" && (
        <div className="mb-2 rounded-lg bg-[var(--primary)]/10 px-3 py-2 text-center text-sm font-semibold text-[var(--primary)]">
          {winner ? `${winner.displayName} wins! 🎉` : "Game over"}
        </div>
      )}

      {/* Your hand */}
      {view.status !== "finished" && (
        <>
          <div className="flex items-end gap-1 overflow-x-auto pb-1">
            {view.yourHand.map((entry) => {
              const actionable = disabled
                ? false
                : isMyTurn
                  ? entry.playable
                  : jumpInSet.has(entry.card.id);
              return (
                <button
                  key={entry.card.id}
                  type="button"
                  disabled={!actionable}
                  onClick={() => onCardClick(entry)}
                  className={`transition-transform ${
                    actionable
                      ? "cursor-pointer hover:-translate-y-1.5"
                      : "cursor-default opacity-45 saturate-50"
                  }`}
                  title={actionable ? "Play" : ""}
                  aria-label={`${cardName(entry.card)}${actionable ? ", playable" : ""}`}
                >
                  <CardFace card={entry.card} />
                </button>
              );
            })}
            {view.yourHand.length === 0 && (
              <span className="text-xs text-[var(--muted-foreground)]">(no cards)</span>
            )}
          </div>

          {/* Actions */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {view.yourActions.canDrawPenalty && (
              <ActionButton disabled={disabled} onClick={() => submit({ type: "draw_penalty" })}>
                Draw +{view.pendingDraw}
              </ActionButton>
            )}
            {view.yourActions.canDraw && (
              <ActionButton disabled={disabled} onClick={() => submit({ type: "draw" })}>
                Draw
              </ActionButton>
            )}
            {view.yourActions.canPass && (
              <ActionButton disabled={disabled} onClick={() => submit({ type: "pass" })}>
                Pass
              </ActionButton>
            )}
            {view.yourActions.mustDeclareUno && (
              <ActionButton disabled={disabled} highlight onClick={() => submit({ type: "declare_uno" })}>
                Call UNO!
              </ActionButton>
            )}
          </div>
        </>
      )}

      {/* Wild color / 7-swap chooser */}
      {pending && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-2">
          {pending.kind === "color" ? (
            <>
              <span className="text-xs text-[var(--muted-foreground)]">Pick a color:</span>
              {(["red", "yellow", "green", "blue"] as UnoColor[]).map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() =>
                    submit({
                      type: "play",
                      cardId: pending.card.id,
                      declaredColor: color,
                      ...(goingToOne ? { sayUno: true } : {}),
                    })
                  }
                  className="h-6 w-6 rounded-full ring-1 ring-black/20 transition-transform hover:scale-110"
                  style={{ background: CARD_FILL[color] }}
                  title={color}
                  aria-label={`Choose ${color}`}
                />
              ))}
            </>
          ) : (
            <>
              <ArrowRightLeft className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
              <span className="text-xs text-[var(--muted-foreground)]">Swap hands with:</span>
              {opponents.map((seat) => (
                <button
                  key={seat.seatId}
                  type="button"
                  onClick={() =>
                    submit({
                      type: "play",
                      cardId: pending.card.id,
                      swapTargetSeatId: seat.seatId,
                      ...(goingToOne ? { sayUno: true } : {}),
                    })
                  }
                  className="rounded bg-[var(--primary)]/15 px-2 py-0.5 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary)]/25"
                >
                  {seat.displayName}
                </button>
              ))}
            </>
          )}
          <button
            type="button"
            onClick={() => setPending(null)}
            className="ml-auto text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            aria-label="Close chooser"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  highlight,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
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
