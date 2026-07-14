// ──────────────────────────────────────────────
// Hook: Turn-Game (8-Ball Pool) API
// ──────────────────────────────────────────────
// Mirrors use-poker.ts against the same game-agnostic /turn-games REST surface.
// Reuses turnGameKeys' query-key root (one chat has at most one active turn-game,
// so every board shares the /state resource and invalidation stays coherent).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, api } from "../lib/api-client";
import { requestTurnGameBotGeneration } from "../lib/capability-turn-game-events";
import { useEightBallGameStore } from "../stores/eightball-game.store";
import { turnGameKeys } from "./turn-game-keys";
import type { EightBallConfig, EightBallMove, EightBallPublicView } from "@marinara-engine/shared";

interface StateResponse {
  view: EightBallPublicView | { gameType?: string };
}

interface OutcomeResponse {
  ok: boolean;
  view?: EightBallPublicView;
  error?: string;
  finished?: boolean;
  winnerSeatId?: string | null;
  currentSeatId?: string | null;
  legalMoves?: unknown[];
}

export interface StartEightBallBody {
  gameType: "eightball";
  config?: Partial<EightBallConfig>;
  botCharacterIds: string[];
  humanFirst?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isEightBallView(view: unknown): view is EightBallPublicView {
  return isRecord(view) && view.gameType === "eightball";
}

/**
 * Open a generate request to drive the bot seat, but only when the resulting
 * turn belongs to the bot (not the human, and not a finished game) — OR when
 * the announcer has queued narration that still needs draining (poker
 * precedent: a human shot can end the rack and queue a "rack over" or
 * "great shot" announcement with nobody's move pending). The server loop
 * no-ops harmlessly if there's nothing to do, so firing it speculatively here
 * is safe.
 */
function maybeFireBotTurns(
  chatId: string,
  res: OutcomeResponse | undefined,
): void {
  const view = res?.view;
  if (!view) return;
  // A finished game can STILL owe narration: the match-winning shot queues a
  // "game_over" announcement on the same response that carries finished=true
  // (with the default raceTo:1 that's the very first clean 8-pot). The server's
  // drain path serves finished games too, so fire for the drain — just never
  // for a bot turn once the match is over.
  const pendingAnnouncements = isEightBallView(view) && view.hasPendingAnnouncements === true;
  const botTurn = !res?.finished && !!res?.currentSeatId && res.currentSeatId !== view.yourSeatId;
  if (!botTurn && !pendingAnnouncements) return;
  requestTurnGameBotGeneration(chatId);
}

/** Fetch the current table for a chat (404 = no active game). Feeds the 8-ball store
 * only when the active turn-game IS eightball; other game types are left alone. */
export function useEightBallState(chatId: string | null) {
  return useQuery({
    queryKey: chatId ? [...turnGameKeys.state(chatId), "eightball"] : [...turnGameKeys.all, "state", "none", "eightball"],
    enabled: !!chatId,
    staleTime: 30_000,
    retry: false,
    queryFn: async () => {
      if (!chatId) return null;
      try {
        const res = await api.get<StateResponse>(`/turn-games/${chatId}/state`);
        if (isEightBallView(res?.view)) useEightBallGameStore.getState().setEightBall(res.view, chatId);
        else if (res?.view) useEightBallGameStore.getState().clearEightBall(chatId); // another game type is active
        return res;
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          useEightBallGameStore.getState().clearEightBall(chatId);
          return null;
        }
        throw err;
      }
    },
  });
}

export function useStartEightBall(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: StartEightBallBody) => api.post<OutcomeResponse>(`/turn-games/${chatId}/start`, body),
    onSuccess: (res) => {
      if (isEightBallView(res?.view)) useEightBallGameStore.getState().setEightBall(res.view, chatId);
      qc.invalidateQueries({ queryKey: turnGameKeys.state(chatId) });
      // If the break-order draw hands the opening break to the bot, kick off the bot loop.
      maybeFireBotTurns(chatId, res);
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Failed to start the game"),
  });
}

export function useEightBallMove(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { move: EightBallMove }) => api.post<OutcomeResponse>(`/turn-games/${chatId}/move`, vars),
    onSuccess: (res) => {
      if (isEightBallView(res?.view)) useEightBallGameStore.getState().setEightBall(res.view, chatId);
      // Open a generate request so the server drives the bot seat over SSE.
      maybeFireBotTurns(chatId, res);
    },
    onError: (err: unknown) => {
      // The server returns 409 with { error, legalMoves, view } for an illegal move.
      if (err instanceof ApiError && isRecord(err.payload) && isEightBallView(err.payload.view)) {
        useEightBallGameStore.getState().setEightBall(err.payload.view, chatId);
      }
      toast.error(err instanceof Error ? err.message : "Illegal shot");
    },
  });
}

export function useResignEightBall(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/turn-games/${chatId}/resign`, {}),
    onSuccess: () => {
      useEightBallGameStore.getState().clearEightBall(chatId);
      qc.invalidateQueries({ queryKey: turnGameKeys.state(chatId) });
    },
  });
}
