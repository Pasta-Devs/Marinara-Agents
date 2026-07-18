import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  GenerateSpatialMapDraftRequest,
  GenerateSpatialMapDraftResponse,
  Message,
  MessageAttachment,
  PendingSpatialTransition,
  SpatialContextDefinition,
  SpatialContextResponse,
  SpatialDefinitionIssue,
  SpatialMapDraftOperation,
  SpatialMapDraftSize,
  SpatialOwnerMode,
} from "@marinara-engine/shared";
import { PackageApiError, packageApi } from "../features/spatial-context/package-api";
import {
  clearPendingSpatialTransition,
  setPendingSpatialTransitionStatus,
} from "../features/spatial-context/pending-spatial-transitions";
import { spatialResourceKeys } from "../features/spatial-context/use-spatial-resources";
import type {
  MapsSpatialContextResponse,
  SpatialGenerationPreferences,
  SpatialGenerationPromptLibraries,
  SpatialGenerationPromptLibrary,
  SpatialHierarchyProfile,
  SpatialTurnPromptTemplates,
} from "../../../maps-shared/src/maps-model";
import {
  SPATIAL_GENERATION_PROMPT_LIBRARIES_SETTINGS_KEY,
  SPATIAL_TURN_PROMPT_TEMPLATES_SETTINGS_KEY,
  normalizeSpatialTurnPromptTemplates,
  parseSpatialGenerationPromptLibraries,
} from "../../../maps-shared/src/maps-model";

export const spatialContextKeys = {
  all: ["spatial-context"] as const,
  detail: (chatId: string) => [...spatialContextKeys.all, chatId] as const,
  gameMapReconciliation: (chatId: string) =>
    [...spatialContextKeys.detail(chatId), "game-map-reconciliation"] as const,
  generationPromptLibraries: ["spatial-context", "generation-prompt-libraries"] as const,
  turnPromptTemplates: ["spatial-context", "turn-prompt-templates"] as const,
};

export type GameMapBindingTarget =
  | { target: "map"; mapId: string }
  | { target: "cell"; mapId: string; x: number; y: number }
  | { target: "node"; mapId: string; nodeId: string };

export type GameMapBindingReference = GameMapBindingTarget & {
  mapName: string;
  targetName: string;
};

export interface GameMapBindingReconciliationPreview {
  suggestions: Array<{
    target: GameMapBindingReference;
    sourceName: string;
    spatialLocationId: string;
    spatialLocationName: string;
  }>;
  conflicts: Array<{
    target: GameMapBindingReference;
    sourceName: string;
    candidateLocations: Array<{ id: string; name: string }>;
  }>;
  unmatched: Array<{
    target: GameMapBindingReference;
    sourceName: string;
  }>;
  alreadyBoundCount: number;
  totalTargetCount: number;
  bindingCount?: number;
}

export interface ApplyGameMapBindingReconciliationInput {
  chatId: string;
  expectedDefinitionRevision: number;
  bindings: Array<{ target: GameMapBindingTarget; spatialLocationId: string }>;
}

export interface UpdateSpatialContextInput {
  chatId: string;
  expectedRevision: number;
  expectedCurrentLocationId: string | null;
  replacementCurrentLocationId?: string | null;
  definition: SpatialContextDefinition;
  hierarchyProfile?: SpatialHierarchyProfile;
}

export interface GenerateSpatialMapDraftInput extends GenerateSpatialMapDraftRequest {
  chatId: string;
  hierarchyMode?: SpatialHierarchyProfile["mode"];
  hierarchyProfile?: SpatialHierarchyProfile;
  generationPreferencesOverride?: SpatialGenerationPreferences;
}

export type PreviewSpatialMapPromptInput = GenerateSpatialMapDraftInput & {
  generationPreferencesOverride?: SpatialGenerationPreferences;
};

export interface SpatialMapPromptPreview {
  ownerMode: SpatialOwnerMode;
  operation: SpatialMapDraftOperation;
  size: SpatialMapDraftSize;
  maxTokens: number;
  containsPrivateContext: true;
  system: string;
  user: string;
}

export type MapsGenerateSpatialMapDraftResponse = GenerateSpatialMapDraftResponse & {
  hierarchyProfile: SpatialHierarchyProfile;
};

export interface CommitSpatialOwnerTurnInput {
  chatId: string;
  content: string;
  transition: PendingSpatialTransition;
  attachments?: MessageAttachment[];
}

interface CommitSpatialOwnerTurnResponse {
  message: Message;
  spatial: SpatialContextResponse;
}

export interface SpatialContextProblem {
  status: number | null;
  code: string | null;
  message: string;
  issues: SpatialDefinitionIssue[];
  conflict: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

interface MapsAgentConfigRecord {
  type: string;
  settings: unknown;
}

function parseAgentSettings(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return isRecord(value) ? value : {};
}

async function readSpatialAgentSettings(): Promise<{
  libraries: SpatialGenerationPromptLibraries | null;
  turnPromptTemplates: SpatialTurnPromptTemplates;
}> {
  const configs = await packageApi.get<MapsAgentConfigRecord[]>("/agents");
  const config = configs.find((candidate) => candidate.type === "hierarchical-maps") ?? null;
  const settings = parseAgentSettings(config?.settings);
  return {
    libraries: parseSpatialGenerationPromptLibraries(
      settings[SPATIAL_GENERATION_PROMPT_LIBRARIES_SETTINGS_KEY],
    ),
    turnPromptTemplates: normalizeSpatialTurnPromptTemplates(
      settings[SPATIAL_TURN_PROMPT_TEMPLATES_SETTINGS_KEY],
    ),
  };
}

function readIssues(value: unknown): SpatialDefinitionIssue[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!isRecord(candidate) || typeof candidate.message !== "string") return [];
    const path = Array.isArray(candidate.path)
      ? candidate.path.filter((part): part is string | number => typeof part === "string" || typeof part === "number")
      : [];
    const spatialCode =
      isRecord(candidate.params) && typeof candidate.params.spatialCode === "string"
        ? candidate.params.spatialCode
        : typeof candidate.code === "string" && candidate.code !== "custom"
          ? candidate.code
          : "stored_definition_invalid";
    const locationId =
      typeof candidate.locationId === "string"
        ? candidate.locationId
        : isRecord(candidate.params) && typeof candidate.params.locationId === "string"
          ? candidate.params.locationId
          : undefined;
    return [
      {
        code: spatialCode as SpatialDefinitionIssue["code"],
        message: candidate.message,
        path,
        ...(locationId ? { locationId } : {}),
      },
    ];
  });
}

export function getSpatialContextProblem(error: unknown): SpatialContextProblem {
  if (!(error instanceof PackageApiError)) {
    return {
      status: null,
      code: null,
      message: error instanceof Error ? error.message : "The hierarchical map could not be saved.",
      issues: [],
      conflict: false,
    };
  }

  const payload = isRecord(error.payload) ? error.payload : {};
  const code = typeof payload.code === "string" ? payload.code : null;
  return {
    status: error.status,
    code,
    message: error.message || "The hierarchical map could not be saved.",
    issues: readIssues(payload.issues),
    conflict: error.status === 409 || code === "spatial_definition_stale" || code === "spatial_current_location_stale",
  };
}

export function useSpatialContext(chatId: string | null) {
  return useQuery({
    queryKey: spatialContextKeys.detail(chatId ?? ""),
    queryFn: () => packageApi.get<MapsSpatialContextResponse>(`/chats/${chatId}/spatial-context`),
    enabled: !!chatId,
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (error instanceof PackageApiError && error.status >= 400 && error.status < 500) return false;
      return failureCount < 3;
    },
  });
}

export function useUpdateSpatialContext() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, ...request }: UpdateSpatialContextInput) =>
      packageApi.put<MapsSpatialContextResponse>(`/chats/${chatId}/spatial-context`, request),
    onSuccess: (response, variables) => {
      queryClient.setQueryData(spatialContextKeys.detail(variables.chatId), response);
    },
    onError: (error, variables) => {
      if (getSpatialContextProblem(error).conflict) {
        void queryClient.invalidateQueries({ queryKey: spatialContextKeys.detail(variables.chatId) });
      }
    },
  });
}

export function useCommitSpatialOwnerTurn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, ...request }: CommitSpatialOwnerTurnInput) =>
      packageApi.post<CommitSpatialOwnerTurnResponse>(`/chats/${chatId}/spatial-context/turn`, request),
    onSuccess: (response, variables) => {
      queryClient.setQueryData(spatialContextKeys.detail(variables.chatId), response.spatial);
      clearPendingSpatialTransition(variables.chatId, variables.transition.commandId);
      void queryClient.invalidateQueries({ queryKey: spatialResourceKeys.chat(variables.chatId) });
    },
    onError: (_error, variables) => {
      setPendingSpatialTransitionStatus(variables.chatId, "needs_review");
      void queryClient.invalidateQueries({ queryKey: spatialContextKeys.detail(variables.chatId) });
    },
  });
}

export function useGenerateSpatialMapDraft() {
  return useMutation({
    mutationFn: ({ chatId, ...request }: GenerateSpatialMapDraftInput) =>
      packageApi.post<MapsGenerateSpatialMapDraftResponse>(`/chats/${chatId}/spatial-context/generate`, request),
  });
}

export function usePreviewSpatialMapPrompt() {
  return useMutation({
    mutationFn: ({ chatId, ...request }: PreviewSpatialMapPromptInput) =>
      packageApi.post<SpatialMapPromptPreview>(
        `/chats/${chatId}/spatial-context/generation-prompt/preview`,
        request,
      ),
  });
}

export function useSpatialGenerationPromptLibraries() {
  return useQuery({
    queryKey: spatialContextKeys.generationPromptLibraries,
    queryFn: async () => (await readSpatialAgentSettings()).libraries,
    staleTime: 30_000,
  });
}

export function useSpatialTurnPromptTemplates() {
  return useQuery({
    queryKey: spatialContextKeys.turnPromptTemplates,
    queryFn: async () => (await readSpatialAgentSettings()).turnPromptTemplates,
    staleTime: 30_000,
  });
}

export function useUpdateSpatialGenerationPromptLibrary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      ownerMode,
      library,
    }: {
      ownerMode: SpatialOwnerMode;
      library: SpatialGenerationPromptLibrary;
    }) =>
      packageApi.put<SpatialGenerationPromptLibraries>(
        `/chats/spatial-context/global-generation-prompt-libraries/${ownerMode}`,
        library,
      ),
    onSuccess: (libraries) => {
      queryClient.setQueryData(spatialContextKeys.generationPromptLibraries, libraries);
    },
  });
}

export function useUpdateSpatialGenerationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, preferences }: { chatId: string; preferences: SpatialGenerationPreferences }) =>
      packageApi.put<SpatialGenerationPreferences>(
        `/chats/${chatId}/spatial-context/generation-preferences`,
        preferences,
      ),
    onSuccess: (preferences, variables) => {
      queryClient.setQueryData<MapsSpatialContextResponse>(
        spatialContextKeys.detail(variables.chatId),
        (current) => (current ? { ...current, generationPreferences: preferences } : current),
      );
    },
  });
}

export function useUpdateSpatialTurnPromptTemplates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (templates: SpatialTurnPromptTemplates) =>
      packageApi.put<SpatialTurnPromptTemplates>(
        "/chats/spatial-context/global-turn-prompt-templates",
        templates,
      ),
    onSuccess: (templates) => {
      queryClient.setQueryData(spatialContextKeys.turnPromptTemplates, templates);
    },
  });
}

export function useGameMapBindingReconciliation(chatId: string | null, enabled = true) {
  return useQuery({
    queryKey: spatialContextKeys.gameMapReconciliation(chatId ?? ""),
    queryFn: () =>
      packageApi.get<GameMapBindingReconciliationPreview>(
        `/chats/${chatId}/spatial-context/game-map-bindings/reconciliation`,
      ),
    enabled: enabled && !!chatId,
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (error instanceof PackageApiError && error.status >= 400 && error.status < 500) return false;
      return failureCount < 3;
    },
  });
}

export function useApplyGameMapBindingReconciliation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, ...request }: ApplyGameMapBindingReconciliationInput) =>
      packageApi.post<GameMapBindingReconciliationPreview>(
        `/chats/${chatId}/spatial-context/game-map-bindings/reconciliation`,
        request,
      ),
    onSuccess: (response, variables) => {
      queryClient.setQueryData(spatialContextKeys.gameMapReconciliation(variables.chatId), response);
      void queryClient.invalidateQueries({ queryKey: spatialResourceKeys.chat(variables.chatId) });
    },
    onError: (_error, variables) => {
      void queryClient.invalidateQueries({
        queryKey: spatialContextKeys.gameMapReconciliation(variables.chatId),
      });
    },
  });
}
