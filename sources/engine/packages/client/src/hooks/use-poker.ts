// ──────────────────────────────────────────────
// Hook: Turn-Game (Poker) API
// ──────────────────────────────────────────────
// Mirrors use-chess.ts against the same game-agnostic /turn-games REST surface.
// Reuses turnGameKeys' query-key root (one chat has at most one active turn-game,
// so every board shares the /state resource and invalidation stays coherent).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, api } from "../lib/api-client";
import { requestTurnGameBotGeneration } from "../lib/capability-turn-game-events";
import { usePokerGameStore } from "../stores/poker-game.store";
import { turnGameKeys } from "./turn-game-keys";
import type { PokerConfig, PokerMove, PokerPublicView } from "@marinara-engine/shared";

interface StateResponse {
  view: PokerPublicView | { gameType?: string };
}

interface OutcomeResponse {
  ok: boolean;
  view?: PokerPublicView;
  error?: string;
  finished?: boolean;
  winnerSeatId?: string | null;
  currentSeatId?: string | null;
  legalMoves?: unknown[];
}

export interface StartPokerBody {
  gameType: "poker";
  config?: Partial<PokerConfig>;
  botCharacterIds: string[];
  humanFirst?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isPokerView(view: unknown): view is PokerPublicView {
  return isRecord(view) && view.gameType === "poker";
}

/**
 * Open a generate request to drive the bot seats, but only when the resulting
 * turn belongs to a bot (not the human, and not a finished game) — OR when the
 * dealer has queued announcements that still need draining. Poker queues
 * dealer narration (hand start, street deals, showdown) that the bot loop is
 * responsible for draining even when it's the human's turn — e.g. the human's
 * own call closes the betting round and reveals the flop, which queues a
 * "flop is dealt" announcement with nobody's move pending. The server loop
 * no-ops harmlessly if there's nothing to do, so firing it speculatively here
 * is safe.
 */
function maybeFireBotTurns(
  chatId: string,
  res: OutcomeResponse | undefined,
): void {
  const view = res?.view;
  if (!view || res?.finished) return;
  const botTurn = !!res?.currentSeatId && res.currentSeatId !== view.yourSeatId;
  const pendingAnnouncements = isPokerView(view) && view.hasPendingAnnouncements === true;
  if (!botTurn && !pendingAnnouncements) return;
  requestTurnGameBotGeneration(chatId);
}

/** Fetch the current table for a chat (404 = no active game). Feeds the poker store
 * only when the active turn-game IS poker; other game types are left alone. */
export function usePokerState(chatId: string | null) {
  return useQuery({
    queryKey: chatId ? [...turnGameKeys.state(chatId), "poker"] : [...turnGameKeys.all, "state", "none", "poker"],
    enabled: !!chatId,
    staleTime: 30_000,
    retry: false,
    queryFn: async () => {
      if (!chatId) return null;
      try {
        const res = await api.get<StateResponse>(`/turn-games/${chatId}/state`);
        if (isPokerView(res?.view)) usePokerGameStore.getState().setPoker(res.view, chatId);
        else if (res?.view) usePokerGameStore.getState().clearPoker(chatId); // another game type is active
        return res;
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          usePokerGameStore.getState().clearPoker(chatId);
          return null;
        }
        throw err;
      }
    },
  });
}

export function useStartPoker(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: StartPokerBody) => api.post<OutcomeResponse>(`/turn-games/${chatId}/start`, body),
    onSuccess: (res) => {
      if (isPokerView(res?.view)) usePokerGameStore.getState().setPoker(res.view, chatId);
      qc.invalidateQueries({ queryKey: turnGameKeys.state(chatId) });
      // Blinds post automatically and hole cards deal on start, so the bot loop
      // (and any dealer announcements) may need to run right away.
      maybeFireBotTurns(chatId, res);
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Failed to start the game"),
  });
}

export function usePokerMove(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { move: PokerMove }) => api.post<OutcomeResponse>(`/turn-games/${chatId}/move`, vars),
    onSuccess: (res) => {
      if (isPokerView(res?.view)) usePokerGameStore.getState().setPoker(res.view, chatId);
      // Open a generate request so the server drives the bot seats over SSE.
      maybeFireBotTurns(chatId, res);
    },
    onError: (err: unknown) => {
      // The server returns 409 with { error, legalMoves, view } for an illegal move.
      if (err instanceof ApiError && isRecord(err.payload) && isPokerView(err.payload.view)) {
        usePokerGameStore.getState().setPoker(err.payload.view, chatId);
      }
      toast.error(err instanceof Error ? err.message : "Illegal move");
    },
  });
}

export function useResignPoker(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/turn-games/${chatId}/resign`, {}),
    onSuccess: () => {
      usePokerGameStore.getState().clearPoker(chatId);
      qc.invalidateQueries({ queryKey: turnGameKeys.state(chatId) });
    },
  });
}
