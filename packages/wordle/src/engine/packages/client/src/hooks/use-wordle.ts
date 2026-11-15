// ──────────────────────────────────────────────
// Hook: Turn-Game (Wordle) API
// ──────────────────────────────────────────────
// Mirrors use-blackjack.ts against the same game-agnostic /turn-games REST
// surface, plus the package's own daily record at /api/wordle.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, api } from "../lib/api-client";
import { requestTurnGameBotGeneration } from "../lib/capability-turn-game-events";
import { useWordleGameStore } from "../stores/wordle-game.store";
import { turnGameKeys } from "./turn-game-keys";
import type { WordleConfig, WordleMove, WordlePublicView } from "../../../shared/src/features/turn-games/wordle/types";

interface StateResponse {
  view: WordlePublicView | { gameType?: string };
}

interface OutcomeResponse {
  ok: boolean;
  view?: WordlePublicView;
  error?: string;
  finished?: boolean;
  winnerSeatId?: string | null;
  currentSeatId?: string | null;
}

export interface StartWordleBody {
  gameType: "wordle";
  config: WordleConfig;
  botCharacterIds: string[];
  humanFirst?: boolean;
}

/** Mirrors the server's WordleDaily (packages/server/src/services/wordle/daily-store.ts). */
export interface WordleDailyResult {
  name: string;
  status: "playing" | "solved" | "failed";
  guesses: number;
}

export interface WordleDaily {
  day: string;
  results: Record<string, WordleDailyResult>;
  standings: Record<string, { current: number; before: number; best: number; played: number; solved: number }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isWordleView(view: unknown): view is WordlePublicView {
  return isRecord(view) && view.gameType === "wordle";
}

/** Today's date on this device (YYYY-MM-DD): the word rolls over at the player's own midnight. */
export function localWordleDay(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const dailyKey = (chatId: string, day: string) => [...turnGameKeys.all, "wordle-daily", chatId, day] as const;

/** Open a generate request so the server plays the bot seats; it no-ops when it is not a bot's turn. */
function maybeFireBotTurns(chatId: string, res: OutcomeResponse | undefined): void {
  const view = res?.view;
  if (!view || res?.finished) return;
  if (res?.currentSeatId && res.currentSeatId !== view.yourSeatId) requestTurnGameBotGeneration(chatId);
}

/** Fetch the current table for a chat (404 = no active game). Feeds the store only when the active game IS Wordle. */
export function useWordleState(chatId: string | null) {
  return useQuery({
    queryKey: chatId ? [...turnGameKeys.state(chatId), "wordle"] : [...turnGameKeys.all, "state", "none", "wordle"],
    enabled: !!chatId,
    staleTime: 30_000,
    retry: false,
    queryFn: async () => {
      if (!chatId) return null;
      try {
        const res = await api.get<StateResponse>(`/turn-games/${chatId}/state`);
        if (isWordleView(res?.view)) useWordleGameStore.getState().setWordle(res.view, chatId);
        else if (res?.view) useWordleGameStore.getState().clearWordle(chatId); // another game type is active
        return res;
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          useWordleGameStore.getState().clearWordle(chatId);
          return null;
        }
        throw err;
      }
    },
  });
}

/** The chat's results and streaks for a day, from the package's record. */
export function useWordleDaily(chatId: string, day: string, enabled: boolean) {
  return useQuery({
    queryKey: dailyKey(chatId, day),
    enabled: enabled && !!chatId,
    staleTime: 0,
    queryFn: () => api.get<WordleDaily>(`/wordle/${encodeURIComponent(chatId)}/days/${day}`),
  });
}

export function useStartWordle(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: StartWordleBody) => api.post<OutcomeResponse>(`/turn-games/${chatId}/start`, body),
    onSuccess: (res) => {
      if (isWordleView(res?.view)) useWordleGameStore.getState().setWordle(res.view, chatId);
      qc.invalidateQueries({ queryKey: turnGameKeys.state(chatId) });
      maybeFireBotTurns(chatId, res);
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Failed to start the game"),
  });
}

export function useWordleMove(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { move: WordleMove }) => api.post<OutcomeResponse>(`/turn-games/${chatId}/move`, vars),
    onSuccess: (res) => {
      if (isWordleView(res?.view)) {
        useWordleGameStore.getState().setWordle(res.view, chatId);
        qc.invalidateQueries({ queryKey: dailyKey(chatId, res.view.day) });
      }
      maybeFireBotTurns(chatId, res);
    },
    onError: (err: unknown) => {
      // The server returns 409 with { error, legalMoves, view } for a rejected guess.
      if (err instanceof ApiError && isRecord(err.payload) && isWordleView(err.payload.view)) {
        useWordleGameStore.getState().setWordle(err.payload.view, chatId);
      }
      toast.error(err instanceof Error ? err.message : "That guess was not accepted");
    },
  });
}

export function useResignWordle(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/turn-games/${chatId}/resign`, {}),
    onSuccess: () => {
      useWordleGameStore.getState().clearWordle(chatId);
      qc.invalidateQueries({ queryKey: turnGameKeys.state(chatId) });
      qc.invalidateQueries({ queryKey: [...turnGameKeys.all, "wordle-daily", chatId] });
    },
    onError: (err: unknown) => {
      // 404 = no game left to end: drop the stale table instead of reporting a failure.
      if (err instanceof ApiError && err.status === 404) {
        useWordleGameStore.getState().clearWordle(chatId);
        qc.invalidateQueries({ queryKey: turnGameKeys.state(chatId) });
        return;
      }
      toast.error(err instanceof Error ? err.message : "Failed to end the game");
    },
  });
}
