// ──────────────────────────────────────────────
// Hook: Turn-Game (Tic-Tac-Toe) API
// ──────────────────────────────────────────────
// Mirrors use-chess.ts against the same game-agnostic /turn-games REST surface.
// Reuses unoKeys' query-key root (one chat has at most one active turn-game,
// so every board shares the /state resource and invalidation stays coherent).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, api } from "../lib/api-client";
import { requestTurnGameBotGeneration } from "../lib/capability-turn-game-events";
import { useTicTacToeGameStore } from "../stores/tic-tac-toe-game.store";
import { unoKeys } from "./use-uno";
import type { TicTacToeConfig, TicTacToeMove, TicTacToePublicView } from "@marinara-engine/shared";

interface StateResponse {
  view: TicTacToePublicView | { gameType?: string };
}

interface OutcomeResponse {
  ok: boolean;
  view?: TicTacToePublicView;
  error?: string;
  finished?: boolean;
  winnerSeatId?: string | null;
  currentSeatId?: string | null;
  legalMoves?: unknown[];
}

export interface StartTicTacToeBody {
  gameType: "tic-tac-toe";
  config?: Partial<TicTacToeConfig>;
  botCharacterIds: string[];
  humanFirst?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isTicTacToeView(view: unknown): view is TicTacToePublicView {
  return isRecord(view) && view.gameType === "tic-tac-toe";
}

/**
 * Open a generate request to drive the bot seat, but only when the resulting
 * turn belongs to the bot (not the human, and not a finished game).
 */
function maybeFireBotTurns(
  chatId: string,
  res: OutcomeResponse | undefined,
): void {
  const view = res?.view;
  if (!view || res?.finished || !res?.currentSeatId || res.currentSeatId === view.yourSeatId) return;
  requestTurnGameBotGeneration(chatId);
}

/** Fetch the current board for a chat (404 = no active game). Feeds the tic-tac-toe store
 * only when the active turn-game IS tic-tac-toe; other game types are left alone. */
export function useTicTacToeState(chatId: string | null) {
  return useQuery({
    queryKey: chatId ? [...unoKeys.state(chatId), "tic-tac-toe"] : [...unoKeys.all, "state", "none", "tic-tac-toe"],
    enabled: !!chatId,
    staleTime: 30_000,
    retry: false,
    queryFn: async () => {
      if (!chatId) return null;
      try {
        const res = await api.get<StateResponse>(`/turn-games/${chatId}/state`);
        if (isTicTacToeView(res?.view)) useTicTacToeGameStore.getState().setTicTacToe(res.view, chatId);
        else if (res?.view) useTicTacToeGameStore.getState().clearTicTacToe(chatId); // another game type is active
        return res;
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          useTicTacToeGameStore.getState().clearTicTacToe(chatId);
          return null;
        }
        throw err;
      }
    },
  });
}

export function useStartTicTacToe(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: StartTicTacToeBody) => api.post<OutcomeResponse>(`/turn-games/${chatId}/start`, body),
    onSuccess: (res) => {
      if (isTicTacToeView(res?.view)) useTicTacToeGameStore.getState().setTicTacToe(res.view, chatId);
      qc.invalidateQueries({ queryKey: unoKeys.state(chatId) });
      maybeFireBotTurns(chatId, res);
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Failed to start the game"),
  });
}

export function useTicTacToeMove(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { move: TicTacToeMove }) => api.post<OutcomeResponse>(`/turn-games/${chatId}/move`, vars),
    onSuccess: (res) => {
      if (isTicTacToeView(res?.view)) useTicTacToeGameStore.getState().setTicTacToe(res.view, chatId);
      maybeFireBotTurns(chatId, res);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && isRecord(err.payload) && isTicTacToeView(err.payload.view)) {
        useTicTacToeGameStore.getState().setTicTacToe(err.payload.view, chatId);
      }
      toast.error(err instanceof Error ? err.message : "Illegal move");
    },
  });
}

export function useResignTicTacToe(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/turn-games/${chatId}/resign`, {}),
    onSuccess: () => {
      useTicTacToeGameStore.getState().clearTicTacToe(chatId);
      qc.invalidateQueries({ queryKey: unoKeys.state(chatId) });
    },
  });
}
