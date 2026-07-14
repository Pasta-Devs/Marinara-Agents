// ──────────────────────────────────────────────
// Hook: Turn-Game (Rock-Paper-Scissors) API
// ──────────────────────────────────────────────
// Mirrors use-chess.ts against the same game-agnostic /turn-games REST surface.
// Reuses unoKeys' query-key root (one chat has at most one active turn-game,
// so every board shares the /state resource and invalidation stays coherent).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, api } from "../lib/api-client";
import { requestTurnGameBotGeneration } from "../lib/capability-turn-game-events";
import { useRockPaperScissorsGameStore } from "../stores/rock-paper-scissors-game.store";
import { unoKeys } from "./use-uno";
import type {
  RockPaperScissorsConfig,
  RockPaperScissorsMove,
  RockPaperScissorsPublicView,
} from "@marinara-engine/shared";

interface StateResponse {
  view: RockPaperScissorsPublicView | { gameType?: string };
}

interface OutcomeResponse {
  ok: boolean;
  view?: RockPaperScissorsPublicView;
  error?: string;
  finished?: boolean;
  winnerSeatId?: string | null;
  currentSeatId?: string | null;
  legalMoves?: unknown[];
}

export interface StartRockPaperScissorsBody {
  gameType: "rock-paper-scissors";
  config?: Partial<RockPaperScissorsConfig>;
  botCharacterIds: string[];
  humanFirst?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isRpsView(view: unknown): view is RockPaperScissorsPublicView {
  return isRecord(view) && view.gameType === "rock-paper-scissors";
}

/**
 * Open a generate request to drive the bot seat, but only when the resulting
 * turn belongs to the bot (not the human, and not a finished match).
 */
function maybeFireBotTurns(
  chatId: string,
  res: OutcomeResponse | undefined,
): void {
  const view = res?.view;
  if (!view || res?.finished || !res?.currentSeatId || res.currentSeatId === view.yourSeatId) return;
  requestTurnGameBotGeneration(chatId);
}

/** Fetch the current match for a chat (404 = no active game). Feeds the RPS store
 * only when the active turn-game IS rock-paper-scissors; other game types are left alone. */
export function useRockPaperScissorsState(chatId: string | null) {
  return useQuery({
    queryKey: chatId
      ? [...unoKeys.state(chatId), "rock-paper-scissors"]
      : [...unoKeys.all, "state", "none", "rock-paper-scissors"],
    enabled: !!chatId,
    staleTime: 30_000,
    retry: false,
    queryFn: async () => {
      if (!chatId) return null;
      try {
        const res = await api.get<StateResponse>(`/turn-games/${chatId}/state`);
        if (isRpsView(res?.view)) useRockPaperScissorsGameStore.getState().setRockPaperScissors(res.view, chatId);
        else if (res?.view) useRockPaperScissorsGameStore.getState().clearRockPaperScissors(chatId); // another game type is active
        return res;
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          useRockPaperScissorsGameStore.getState().clearRockPaperScissors(chatId);
          return null;
        }
        throw err;
      }
    },
  });
}

export function useStartRockPaperScissors(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: StartRockPaperScissorsBody) => api.post<OutcomeResponse>(`/turn-games/${chatId}/start`, body),
    onSuccess: (res) => {
      if (isRpsView(res?.view)) useRockPaperScissorsGameStore.getState().setRockPaperScissors(res.view, chatId);
      qc.invalidateQueries({ queryKey: unoKeys.state(chatId) });
      maybeFireBotTurns(chatId, res);
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Failed to start the match"),
  });
}

export function useRockPaperScissorsThrow(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { move: RockPaperScissorsMove }) =>
      api.post<OutcomeResponse>(`/turn-games/${chatId}/move`, vars),
    onSuccess: (res) => {
      if (isRpsView(res?.view)) useRockPaperScissorsGameStore.getState().setRockPaperScissors(res.view, chatId);
      maybeFireBotTurns(chatId, res);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && isRecord(err.payload) && isRpsView(err.payload.view)) {
        useRockPaperScissorsGameStore.getState().setRockPaperScissors(err.payload.view, chatId);
      }
      toast.error(err instanceof Error ? err.message : "Illegal throw");
    },
  });
}

export function useResignRockPaperScissors(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/turn-games/${chatId}/resign`, {}),
    onSuccess: () => {
      useRockPaperScissorsGameStore.getState().clearRockPaperScissors(chatId);
      qc.invalidateQueries({ queryKey: unoKeys.state(chatId) });
    },
  });
}
