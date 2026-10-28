// ──────────────────────────────────────────────
// Hook: Turn-Game (Blackjack) API
// ──────────────────────────────────────────────
// Mirrors use-poker.ts against the same game-agnostic /turn-games REST surface.
// Reuses turnGameKeys' query-key root (one chat has at most one active turn-game,
// so every board shares the /state resource and invalidation stays coherent).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, api } from "../lib/api-client";
import { requestTurnGameBotGeneration } from "../lib/capability-turn-game-events";
import { useBlackjackGameStore } from "../stores/blackjack-game.store";
import { turnGameKeys } from "./turn-game-keys";
import type {
  BlackjackConfig,
  BlackjackMove,
  BlackjackPublicView,
} from "../../../shared/src/features/turn-games/blackjack/types";

interface StateResponse {
  view: BlackjackPublicView | { gameType?: string };
}

interface OutcomeResponse {
  ok: boolean;
  view?: BlackjackPublicView;
  error?: string;
  finished?: boolean;
  winnerSeatId?: string | null;
  currentSeatId?: string | null;
  legalMoves?: unknown[];
}

export interface StartBlackjackBody {
  gameType: "blackjack";
  config?: Partial<BlackjackConfig>;
  botCharacterIds: string[];
  humanFirst?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isBlackjackView(view: unknown): view is BlackjackPublicView {
  return isRecord(view) && view.gameType === "blackjack";
}

/**
 * Open a generate request to drive the bot seats when the turn belongs to a bot,
 * or when the dealer has queued announcements to voice. The human's own last
 * move of a round makes the engine play the dealer and settle, which queues
 * announcements with the turn already back on the human. The server loop
 * no-ops when there is nothing to do, so firing it speculatively is safe.
 */
function maybeFireBotTurns(chatId: string, res: OutcomeResponse | undefined): void {
  const view = res?.view;
  if (!view || res?.finished) return;
  const botTurn = !!res?.currentSeatId && res.currentSeatId !== view.yourSeatId;
  const pendingAnnouncements = isBlackjackView(view) && view.hasPendingAnnouncements === true;
  if (!botTurn && !pendingAnnouncements) return;
  requestTurnGameBotGeneration(chatId);
}

/** Fetch the current table for a chat (404 = no active game). Feeds the blackjack store
 * only when the active turn-game IS blackjack; other game types are left alone. */
export function useBlackjackState(chatId: string | null) {
  return useQuery({
    queryKey: chatId
      ? [...turnGameKeys.state(chatId), "blackjack"]
      : [...turnGameKeys.all, "state", "none", "blackjack"],
    enabled: !!chatId,
    staleTime: 30_000,
    retry: false,
    queryFn: async () => {
      if (!chatId) return null;
      try {
        const res = await api.get<StateResponse>(`/turn-games/${chatId}/state`);
        if (isBlackjackView(res?.view)) useBlackjackGameStore.getState().setBlackjack(res.view, chatId);
        else if (res?.view) useBlackjackGameStore.getState().clearBlackjack(chatId); // another game type is active
        return res;
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          useBlackjackGameStore.getState().clearBlackjack(chatId);
          return null;
        }
        throw err;
      }
    },
  });
}

export function useStartBlackjack(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: StartBlackjackBody) => api.post<OutcomeResponse>(`/turn-games/${chatId}/start`, body),
    onSuccess: (res) => {
      if (isBlackjackView(res?.view)) useBlackjackGameStore.getState().setBlackjack(res.view, chatId);
      qc.invalidateQueries({ queryKey: turnGameKeys.state(chatId) });
      // The opening "place your bets" announcement is queued at setup.
      maybeFireBotTurns(chatId, res);
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Failed to start the game"),
  });
}

export function useBlackjackMove(chatId: string) {
  return useMutation({
    mutationFn: (vars: { move: BlackjackMove }) => api.post<OutcomeResponse>(`/turn-games/${chatId}/move`, vars),
    onSuccess: (res) => {
      if (isBlackjackView(res?.view)) useBlackjackGameStore.getState().setBlackjack(res.view, chatId);
      // Open a generate request so the server drives the bot seats over SSE.
      maybeFireBotTurns(chatId, res);
    },
    onError: (err: unknown) => {
      // The server returns 409 with { error, legalMoves, view } for an illegal move.
      if (err instanceof ApiError && isRecord(err.payload) && isBlackjackView(err.payload.view)) {
        useBlackjackGameStore.getState().setBlackjack(err.payload.view, chatId);
      }
      toast.error(err instanceof Error ? err.message : "Illegal move");
    },
  });
}

export function useResignBlackjack(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/turn-games/${chatId}/resign`, {}),
    onSuccess: () => {
      useBlackjackGameStore.getState().clearBlackjack(chatId);
      qc.invalidateQueries({ queryKey: turnGameKeys.state(chatId) });
    },
    onError: (err: unknown) => {
      // 404 = no game left to end (as in useBlackjackState): drop the stale table instead of reporting a failure.
      if (err instanceof ApiError && err.status === 404) {
        useBlackjackGameStore.getState().clearBlackjack(chatId);
        qc.invalidateQueries({ queryKey: turnGameKeys.state(chatId) });
        return;
      }
      toast.error(err instanceof Error ? err.message : "Failed to end the game");
    },
  });
}
