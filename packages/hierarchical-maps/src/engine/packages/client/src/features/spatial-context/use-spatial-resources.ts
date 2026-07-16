import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Chat, GameMap, Lorebook, LorebookEntry } from "@marinara-engine/shared";
import { PackageApiError, packageApi } from "./package-api";

export const spatialResourceKeys = {
  chat: (chatId: string) => ["hierarchical-maps", "chat", chatId] as const,
  lorebooks: ["hierarchical-maps", "lorebooks"] as const,
  lorebookEntries: (lorebookId: string) => ["hierarchical-maps", "lorebooks", lorebookId, "entries"] as const,
};

export function useSpatialChat(chatId: string | null) {
  return useQuery({
    queryKey: spatialResourceKeys.chat(chatId ?? ""),
    queryFn: () => packageApi.get<Chat>(`/chats/${chatId}`),
    enabled: !!chatId,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      if (error instanceof PackageApiError && error.status >= 400 && error.status < 500) return false;
      return failureCount < 3;
    },
  });
}

export function useSpatialLorebooks() {
  return useQuery({
    queryKey: spatialResourceKeys.lorebooks,
    queryFn: () => packageApi.get<Lorebook[]>("/lorebooks"),
    staleTime: 5 * 60_000,
  });
}

export function useSpatialLorebookEntries(lorebookIds: string[]): {
  entries: LorebookEntry[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
} {
  const uniqueIds = Array.from(new Set(lorebookIds));
  const queries = useQueries({
    queries: uniqueIds.map((lorebookId) => ({
      queryKey: spatialResourceKeys.lorebookEntries(lorebookId),
      queryFn: () => packageApi.get<LorebookEntry[]>(`/lorebooks/${lorebookId}/entries`),
    })),
  });
  const isLoading = queries.some((query) => query.isLoading);
  const isError = queries.some((query) => query.isError);
  const error = queries.find((query) => query.isError)?.error ?? null;
  const allSucceeded = queries.length === 0 || queries.every((query) => query.isSuccess);
  return {
    entries: allSucceeded ? queries.flatMap((query) => query.data ?? []) : undefined,
    isLoading,
    isError,
    error,
  };
}

function parseMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function getSpatialExcludedLorebookIds(chat: Pick<Chat, "metadata">): string[] {
  const value = parseMetadata(chat.metadata).excludedLorebookIds;
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

export type UpdateGameMapBindingInput =
  | { target: "map"; chatId: string; mapId: string; spatialLocationId: string | null }
  | {
      target: "cell";
      chatId: string;
      mapId: string;
      x: number;
      y: number;
      spatialLocationId: string | null;
    }
  | {
      target: "node";
      chatId: string;
      mapId: string;
      nodeId: string;
      spatialLocationId: string | null;
    };

interface UpdateGameMapBindingResponse {
  map: GameMap;
  maps?: GameMap[];
  activeGameMapId?: string | null;
  sessionChat: Chat;
}

export function useUpdateSpatialGameMapBinding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateGameMapBindingInput) =>
      packageApi.put<UpdateGameMapBindingResponse>("/game/map/binding", input),
    onSuccess: (response, variables) => {
      queryClient.setQueryData(spatialResourceKeys.chat(variables.chatId), response.sessionChat);
      void queryClient.invalidateQueries({
        queryKey: ["spatial-context", variables.chatId, "game-map-reconciliation"],
      });
    },
  });
}
