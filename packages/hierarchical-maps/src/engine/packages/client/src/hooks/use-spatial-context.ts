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
  SpatialMapTemplateRecord,
  SpatialSharedWorldRecord,
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
  gameMapReconciliation: (chatId: string) => [...spatialContextKeys.detail(chatId), "game-map-reconciliation"] as const,
  agentConfiguration: ["spatial-context", "agent-configuration"] as const,
  connections: ["spatial-context", "connections"] as const,
  generationPromptLibraries: ["spatial-context", "generation-prompt-libraries"] as const,
  turnPromptTemplates: ["spatial-context", "turn-prompt-templates"] as const,
  templates: ["spatial-context", "templates"] as const,
  sharedWorlds: ["spatial-context", "shared-worlds"] as const,
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

export interface MapsAgentConfigRecord {
  id: string;
  type: string;
  name: string;
  description: string;
  phase: "pre_generation" | "parallel" | "post_processing";
  connectionId: string | null;
  settings: unknown;
}

export interface MapsConnectionRecord {
  id: string;
  name: string;
  provider: string;
}

export function parseAgentSettings(value: unknown): Record<string, unknown> {
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
    libraries: parseSpatialGenerationPromptLibraries(settings[SPATIAL_GENERATION_PROMPT_LIBRARIES_SETTINGS_KEY]),
    turnPromptTemplates: normalizeSpatialTurnPromptTemplates(settings[SPATIAL_TURN_PROMPT_TEMPLATES_SETTINGS_KEY]),
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
      message: error instanceof Error ? error.message : "The world map could not be saved.",
      issues: [],
      conflict: false,
    };
  }

  const payload = isRecord(error.payload) ? error.payload : {};
  const code = typeof payload.code === "string" ? payload.code : null;
  return {
    status: error.status,
    code,
    message: error.message || "The world map could not be saved.",
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

export function useSpatialAgentConfiguration() {
  return useQuery({
    queryKey: spatialContextKeys.agentConfiguration,
    queryFn: async () => {
      const configs = await packageApi.get<MapsAgentConfigRecord[]>("/agents");
      return configs.find((candidate) => candidate.type === "hierarchical-maps") ?? null;
    },
    staleTime: 30_000,
  });
}

export function useSpatialConnections() {
  return useQuery({
    queryKey: spatialContextKeys.connections,
    queryFn: () => packageApi.get<MapsConnectionRecord[]>("/connections"),
    staleTime: 5 * 60_000,
  });
}

export function useUpdateSpatialAgentConfiguration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: {
      description: string;
      phase: "pre_generation";
      connectionId: string | null;
      settings: Record<string, unknown>;
    }) => packageApi.patch<MapsAgentConfigRecord>("/chats/spatial-context/agent-configuration", patch),
    onSuccess: (configuration) => {
      queryClient.setQueryData(spatialContextKeys.agentConfiguration, configuration);
      void queryClient.invalidateQueries({
        queryKey: spatialContextKeys.generationPromptLibraries,
      });
      void queryClient.invalidateQueries({
        queryKey: spatialContextKeys.turnPromptTemplates,
      });
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
        void queryClient.invalidateQueries({
          queryKey: spatialContextKeys.detail(variables.chatId),
        });
      }
    },
  });
}

export function useReplaceWithIndependentSpatialWorld() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, ...request }: UpdateSpatialContextInput) =>
      packageApi.post<MapsSpatialContextResponse>(
        `/chats/${chatId}/spatial-context/shared-world/independent-copy`,
        request,
      ),
    onSuccess: (response, variables) => {
      queryClient.setQueryData(spatialContextKeys.detail(variables.chatId), response);
      void queryClient.invalidateQueries({
        queryKey: spatialContextKeys.sharedWorlds,
      });
    },
    onError: (error, variables) => {
      if (getSpatialContextProblem(error).conflict) {
        void queryClient.invalidateQueries({
          queryKey: spatialContextKeys.detail(variables.chatId),
        });
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
      void queryClient.invalidateQueries({
        queryKey: spatialResourceKeys.chat(variables.chatId),
      });
    },
    onError: (_error, variables) => {
      setPendingSpatialTransitionStatus(variables.chatId, "needs_review");
      void queryClient.invalidateQueries({
        queryKey: spatialContextKeys.detail(variables.chatId),
      });
    },
  });
}

export function useGenerateSpatialMapDraft() {
  return useMutation({
    mutationFn: ({ chatId, ...request }: GenerateSpatialMapDraftInput) =>
      packageApi.post<MapsGenerateSpatialMapDraftResponse>(`/chats/${chatId}/spatial-context/generate`, request),
  });
}

export function useGenerateSpatialMapTemplateDraft() {
  return useMutation({
    mutationFn: (request: Omit<GenerateSpatialMapDraftInput, "chatId">) =>
      packageApi.post<MapsGenerateSpatialMapDraftResponse>("/chats/spatial-context/templates/generate", request),
  });
}

export function usePreviewSpatialMapPrompt() {
  return useMutation({
    mutationFn: ({ chatId, ...request }: PreviewSpatialMapPromptInput) =>
      packageApi.post<SpatialMapPromptPreview>(`/chats/${chatId}/spatial-context/generation-prompt/preview`, request),
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
    mutationFn: ({ ownerMode, library }: { ownerMode: SpatialOwnerMode; library: SpatialGenerationPromptLibrary }) =>
      packageApi.put<SpatialGenerationPromptLibraries>(
        `/chats/spatial-context/global-generation-prompt-libraries/${ownerMode}`,
        library,
      ),
    onSuccess: (libraries) => {
      queryClient.setQueryData(spatialContextKeys.generationPromptLibraries, libraries);
      void queryClient.invalidateQueries({
        queryKey: spatialContextKeys.agentConfiguration,
      });
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
      queryClient.setQueryData<MapsSpatialContextResponse>(spatialContextKeys.detail(variables.chatId), (current) =>
        current ? { ...current, generationPreferences: preferences } : current,
      );
    },
  });
}

export function useUpdateSpatialTurnPromptTemplates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (templates: SpatialTurnPromptTemplates) =>
      packageApi.put<SpatialTurnPromptTemplates>("/chats/spatial-context/global-turn-prompt-templates", templates),
    onSuccess: (templates) => {
      queryClient.setQueryData(spatialContextKeys.turnPromptTemplates, templates);
      void queryClient.invalidateQueries({
        queryKey: spatialContextKeys.agentConfiguration,
      });
    },
  });
}

export function useSpatialMapTemplates() {
  return useQuery({
    queryKey: spatialContextKeys.templates,
    queryFn: () => packageApi.get<SpatialMapTemplateRecord[]>("/chats/spatial-context/templates"),
    staleTime: 30_000,
  });
}

export function useCreateSpatialMapTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      description: string;
      definition: SpatialContextDefinition;
      hierarchyProfile: SpatialHierarchyProfile;
    }) => packageApi.post<SpatialMapTemplateRecord>("/chats/spatial-context/templates", input),
    onSuccess: (template) => {
      queryClient.setQueryData<SpatialMapTemplateRecord[]>(spatialContextKeys.templates, (current = []) => [
        template,
        ...current.filter((candidate) => candidate.id !== template.id),
      ]);
    },
  });
}

export function useUpdateSpatialMapTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      expectedRevision: number;
      name: string;
      description: string;
      definition: SpatialContextDefinition;
      hierarchyProfile: SpatialHierarchyProfile;
    }) => {
      const { id, ...body } = input;
      return packageApi.put<SpatialMapTemplateRecord>(
        `/chats/spatial-context/templates/${encodeURIComponent(id)}`,
        body,
      );
    },
    onSuccess: (template) => {
      queryClient.setQueryData<SpatialMapTemplateRecord[]>(spatialContextKeys.templates, (current = []) =>
        current.map((candidate) => (candidate.id === template.id ? template : candidate)),
      );
    },
    onError: (error) => {
      if (error instanceof PackageApiError && error.status === 409) {
        void queryClient.invalidateQueries({
          queryKey: spatialContextKeys.templates,
        });
      }
    },
  });
}

export function useDeleteSpatialMapTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, expectedRevision }: { id: string; expectedRevision: number }) =>
      packageApi.delete<void>(`/chats/spatial-context/templates/${encodeURIComponent(id)}`, { expectedRevision }),
    onSuccess: (_result, variables) => {
      queryClient.setQueryData<SpatialMapTemplateRecord[]>(spatialContextKeys.templates, (current = []) =>
        current.filter((candidate) => candidate.id !== variables.id),
      );
    },
    onError: (error) => {
      if (error instanceof PackageApiError && error.status === 409) {
        void queryClient.invalidateQueries({
          queryKey: spatialContextKeys.templates,
        });
      }
    },
  });
}

export function useSpatialSharedWorlds(enabled = true) {
  return useQuery({
    queryKey: spatialContextKeys.sharedWorlds,
    queryFn: () => packageApi.get<SpatialSharedWorldRecord[]>("/chats/spatial-context/shared-worlds"),
    staleTime: 30_000,
    enabled,
  });
}

export function useCreateSpatialSharedWorld() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      description: string;
      definition: SpatialContextDefinition;
      hierarchyProfile: SpatialHierarchyProfile;
    }) => packageApi.post<SpatialSharedWorldRecord>("/chats/spatial-context/shared-worlds", input),
    onSuccess: (world) => {
      queryClient.setQueryData<SpatialSharedWorldRecord[]>(spatialContextKeys.sharedWorlds, (current = []) => [
        world,
        ...current.filter((candidate) => candidate.id !== world.id),
      ]);
    },
  });
}

export function useUpdateSpatialSharedWorld() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      expectedRevision: number;
      name: string;
      description: string;
      definition: SpatialContextDefinition;
      hierarchyProfile: SpatialHierarchyProfile;
    }) => {
      const { id, ...body } = input;
      return packageApi.put<SpatialSharedWorldRecord>(
        `/chats/spatial-context/shared-worlds/${encodeURIComponent(id)}`,
        body,
      );
    },
    onSuccess: (world) => {
      queryClient.setQueryData<SpatialSharedWorldRecord[]>(spatialContextKeys.sharedWorlds, (current = []) =>
        current.map((candidate) => (candidate.id === world.id ? world : candidate)),
      );
      void queryClient.invalidateQueries({ queryKey: spatialContextKeys.all });
    },
    onError: (error) => {
      if (error instanceof PackageApiError && error.status === 409) {
        void queryClient.invalidateQueries({
          queryKey: spatialContextKeys.sharedWorlds,
        });
      }
    },
  });
}

export function useDeleteSpatialSharedWorld() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, expectedRevision }: { id: string; expectedRevision: number }) =>
      packageApi.delete<void>(`/chats/spatial-context/shared-worlds/${encodeURIComponent(id)}`, {
        expectedRevision,
      }),
    onSuccess: (_result, variables) => {
      queryClient.setQueryData<SpatialSharedWorldRecord[]>(spatialContextKeys.sharedWorlds, (current = []) =>
        current.filter((candidate) => candidate.id !== variables.id),
      );
    },
    onError: (error) => {
      if (error instanceof PackageApiError && error.status === 409) {
        void queryClient.invalidateQueries({
          queryKey: spatialContextKeys.sharedWorlds,
        });
      }
    },
  });
}

export function useLinkSpatialSharedWorld() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      chatId: string;
      worldId: string;
      expectedWorldRevision: number;
      expectedRevision: number;
      expectedCurrentLocationId: string | null;
    }) => {
      const { chatId, ...body } = input;
      return packageApi.post<MapsSpatialContextResponse>(`/chats/${chatId}/spatial-context/shared-world/link`, body);
    },
    onSuccess: (spatial, variables) => {
      queryClient.setQueryData(spatialContextKeys.detail(variables.chatId), spatial);
      void queryClient.invalidateQueries({
        queryKey: spatialContextKeys.sharedWorlds,
      });
    },
  });
}

export function useForkSpatialSharedWorld() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { chatId: string; expectedRevision: number; expectedCurrentLocationId: string | null }) => {
      const { chatId, ...body } = input;
      return packageApi.post<MapsSpatialContextResponse>(`/chats/${chatId}/spatial-context/shared-world/fork`, body);
    },
    onSuccess: (spatial, variables) => {
      queryClient.setQueryData(spatialContextKeys.detail(variables.chatId), spatial);
      void queryClient.invalidateQueries({
        queryKey: spatialContextKeys.sharedWorlds,
      });
    },
  });
}

export function useDiscardSpatialSharedWorldDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { chatId: string; expectedRevision: number; expectedCurrentLocationId: string | null }) => {
      const { chatId, ...body } = input;
      return packageApi.post<MapsSpatialContextResponse>(`/chats/${chatId}/spatial-context/shared-world/discard`, body);
    },
    onSuccess: (spatial, variables) => {
      queryClient.setQueryData(spatialContextKeys.detail(variables.chatId), spatial);
    },
  });
}

export function usePublishSpatialSharedWorldDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      chatId: string;
      expectedWorldRevision: number;
      definition: SpatialContextDefinition;
      hierarchyProfile: SpatialHierarchyProfile;
    }) => {
      const { chatId, ...body } = input;
      return packageApi.post<{
        world: SpatialSharedWorldRecord;
        spatial: MapsSpatialContextResponse;
      }>(`/chats/${chatId}/spatial-context/shared-world/publish`, body);
    },
    onSuccess: async ({ world, spatial }, variables) => {
      queryClient.setQueryData(spatialContextKeys.detail(variables.chatId), spatial);
      queryClient.setQueryData<SpatialSharedWorldRecord[]>(spatialContextKeys.sharedWorlds, (current = []) =>
        current.map((candidate) => (candidate.id === world.id ? world : candidate)),
      );
      try {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: spatialContextKeys.sharedWorlds }),
          queryClient.invalidateQueries({
            predicate: (query) => {
              const [scope, chatId] = query.queryKey;
              if (scope !== spatialContextKeys.all[0] || typeof chatId !== "string") return false;
              const cached = query.state.data as MapsSpatialContextResponse | undefined;
              return chatId === variables.chatId || cached?.sharedWorld?.worldId === world.id;
            },
          }),
        ]);
      } catch {
        // The publish already succeeded and the canonical records above are current.
        // A rejected cache refresh must not turn that durable success into an error.
      }
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
      void queryClient.invalidateQueries({
        queryKey: spatialResourceKeys.chat(variables.chatId),
      });
    },
    onError: (_error, variables) => {
      void queryClient.invalidateQueries({
        queryKey: spatialContextKeys.gameMapReconciliation(variables.chatId),
      });
    },
  });
}
