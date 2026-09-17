// ──────────────────────────────────────────────
// React Query: Noodle hooks
// ──────────────────────────────────────────────
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTranslation as useUiTranslation } from "react-i18next";
import { api } from "../lib/api-client";
import type { SlurpSimulationTuning } from "../../../server/src/services/slurp/slurp-tuning.js";
import type { SlurpFanType } from "../../../server/src/services/slurp/slurp-fan-types.js";
import type { SlurpPlatformEvent } from "../../../server/src/services/slurp/slurp-platform-events.js";
import type { SlurpModelBudget } from "../../../server/src/services/slurp/slurp-model-budget.js";
import { refreshSlurpCreatorBatch } from "../lib/slurp-refresh-batch";
import { useSlurpUIStore } from "../stores/slurp-package.store";
import type {
  NoodleAccount,
  NoodleAccountFollowUpdateInput,
  NoodleAccountKind,
  NoodleAccountProfileUpdateInput,
  NoodleAccountSettingsPatchInput,
  NoodleBootstrap,
  NoodleBulkNoodlerAccountCreateInput,
  NoodleCreateInteractionInput,
  NoodleCreatePostInput,
  NoodleInteraction,
  NoodleInteractionUpdateInput,
  NoodlePost,
  NoodlePostImageCrop,
  NoodlePostUpdateInput,
  NoodlerPostCreateInput,
  NoodlerPostUpdateInput,
  NoodleRemoveInteractionInput,
  NoodleRescheduleRefreshInput,
  NoodleRefreshSchedulerStatus,
  NoodleSettings,
  NoodleSettingsUpdateInput,
  NoodleStageProfileInput,
  NoodlerSourceSnapshot,
  NoodlerGenerationRequest,
  NoodleStageProfileDraftRequest,
  NoodlerManagedPost,
  NoodlerPostView,
  NoodlerRefreshNowOutcome,
  NoodlerStageProfile,
  NoodlerManagedStageProfile,
  NoodlerSubscriber,
  NoodlerViewerScope,
  NoodlerCreateInteractionInput,
  NoodlerCreatorReplyResult,
  NoodlerFanActivitySettings,
  NoodlerRemoveInteractionInput,
} from "@marinara-engine/shared";
import { mergeNoodlePollVoteInteractions } from "@marinara-engine/shared";
import type { ImagePromptOverride, ImagePromptReviewItem } from "../components/ui/ImagePromptReviewModal";
import type { SlurpPromptPreset } from "../components/slurp/slurp-prompt-presets";

export type SlurpPromptBlockOverride = {
  id: string;
  enabled?: boolean;
  text?: string;
};

export type SlurpDiscoveryGender = "male" | "female" | "other";
export type SlurpStageProfileInput = NoodleStageProfileInput & {
  gender: SlurpDiscoveryGender | null;
  tags: string[];
};
export type SlurpManagedStageProfile = NoodlerManagedStageProfile & {
  gender: SlurpDiscoveryGender | null;
  tags: string[];
};
export type SlurpViewerScope = Omit<NoodlerViewerScope, "creators"> & {
  creators: Array<
    Omit<NoodlerViewerScope["creators"][number], "profile"> & {
      profile: NoodlerViewerScope["creators"][number]["profile"] & {
        gender: SlurpDiscoveryGender | null;
        tags: string[];
      };
    }
  >;
};

export type NoodleRefreshResult = {
  bootstrap: NoodleBootstrap;
  imagePromptReviewItems: ImagePromptReviewItem[];
};

export const noodleKeys = {
  all: ["noodle"] as const,
  bootstrap: () => [...noodleKeys.all, "bootstrap"] as const,
  settings: () => ["slurp", "settings"] as const,
  refreshIndicator: () => [...noodleKeys.all, "refresh-indicator"] as const,
  noodlerRoot: () => [...noodleKeys.all, "noodler"] as const,
  noodlerAccounts: () => [...noodleKeys.noodlerRoot(), "accounts"] as const,
  noodlerConnectionCounts: () => [...noodleKeys.noodlerRoot(), "connection-counts"] as const,
  noodlerEligibleAccountsRoot: () => [...noodleKeys.noodlerRoot(), "eligible"] as const,
  noodlerEligibleAccounts: (search: string, kind: string) =>
    [...noodleKeys.noodlerEligibleAccountsRoot(), search, kind] as const,
  noodlerPosts: (accountId: string) => [...noodleKeys.noodlerRoot(), "posts", accountId] as const,
  noodlerSubscribers: (accountId: string) => [...noodleKeys.noodlerRoot(), "subscribers", accountId] as const,
  noodlerFollowers: (accountId: string) => [...noodleKeys.noodlerRoot(), "followers", accountId] as const,
  audienceMember: (memberId: string, creatorAccountId: string) =>
    [...noodleKeys.noodlerRoot(), "audience", memberId, creatorAccountId] as const,
  noodlerViewers: () => [...noodleKeys.noodlerRoot(), "viewers"] as const,
  viewer: (personaId: string) => [...noodleKeys.noodlerViewers(), personaId] as const,
  noodlerUnseenCount: (personaId: string) => [...noodleKeys.noodlerViewers(), "unseen-count", personaId] as const,
  noodlerReserveStatus: () => [...noodleKeys.noodlerRoot(), "reserve-status"] as const,
  noodlerImageConnections: () => [...noodleKeys.noodlerRoot(), "image-connections"] as const,
  noodlerPostGuidance: () => [...noodleKeys.noodlerRoot(), "post-guidance"] as const,
  noodlerFanStatus: () => [...noodleKeys.noodlerRoot(), "fan-status"] as const,
  // contextTags belongs in the key: it is part of the request, so leaving it
  // out meant switching tab or crossing into evening never refetched.
  ads: (personaId: string, creatorId?: string | null, contextTags: string[] = []) =>
    [...noodleKeys.noodlerViewers(), "ads", personaId, creatorId ?? "none", contextTags] as const,
  adPool: () => [...noodleKeys.noodlerRoot(), "ad-pool"] as const,
  adState: (personaId: string) => [...noodleKeys.noodlerViewers(), "ad-state", personaId] as const,
};

export type SlurpContentRating = "tame" | "suggestive" | "explicit";

export type SlurpPromotion = {
  id: string;
  platform?: "slurp" | "noodle";
  kind: "creator" | "inline";
  contentRating?: SlurpContentRating;
  origin?: "builtin" | "user" | "generated";
  retiredAt?: string | null;
  brand: string;
  product: string;
  copy: string;
  categories: string[];
  contextTags: string[];
  creatorAccountId?: string;
  creatorHandle?: string;
  imageUrl?: string | null;
  actionLabel?: string;
};

export function useSlurpInlineAds(personaId: string | null, creatorId?: string | null, contextTags: string[] = []) {
  return useQuery({
    queryKey: noodleKeys.ads(personaId ?? "none", creatorId, contextTags),
    queryFn: () =>
      api.get<{ items: SlurpPromotion[] }>(
        `/slurp2/noodler/viewer/ads?personaId=${encodeURIComponent(personaId!)}${creatorId ? `&creatorId=${encodeURIComponent(creatorId)}` : ""}${contextTags.length ? `&contextTags=${encodeURIComponent(contextTags.join(","))}` : ""}`,
      ),
    enabled: Boolean(personaId),
    staleTime: 60_000,
  });
}

export function useHideSlurpAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ personaId, promotionId }: { personaId: string; promotionId: string }) =>
      api.post(`/slurp2/noodler/viewer/ads/${encodeURIComponent(promotionId)}/hide`, { personaId }),
    onSuccess: (_state, input) =>
      qc.invalidateQueries({
        queryKey: noodleKeys.noodlerViewers(),
        predicate: (query) => query.queryKey.includes(input.personaId),
      }),
  });
}

export function useRecordSlurpAdAction() {
  return useMutation({
    mutationFn: ({ personaId, promotionId }: { personaId: string; promotionId: string }) =>
      api.post(`/slurp2/noodler/viewer/ads/${encodeURIComponent(promotionId)}/action`, { personaId }),
  });
}

export function useHideSlurpAdBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ personaId, brand }: { personaId: string; brand: string }) =>
      api.post(`/slurp2/noodler/viewer/ads/brand/hide`, { personaId, brand }),
    onSuccess: (_state, input) => {
      void qc.invalidateQueries({ queryKey: noodleKeys.adState(input.personaId) });
      void qc.invalidateQueries({
        queryKey: noodleKeys.noodlerViewers(),
        predicate: (query) => query.queryKey.includes(input.personaId),
      });
    },
  });
}

export function useUnhideSlurpAdBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ personaId, brand }: { personaId: string; brand: string }) =>
      api.post(`/slurp2/noodler/viewer/ads/brand/unhide`, { personaId, brand }),
    onSuccess: (_state, input) => qc.invalidateQueries({ queryKey: noodleKeys.adState(input.personaId) }),
  });
}

export function useSlurpAdState(personaId: string | null) {
  return useQuery({
    queryKey: noodleKeys.adState(personaId ?? "none"),
    queryFn: () =>
      api.get<{ hiddenBrands: string[]; hidden: SlurpPromotion[]; seen: SlurpPromotion[] }>(
        `/slurp2/noodler/viewer/ads/state?personaId=${encodeURIComponent(personaId!)}`,
      ),
    enabled: Boolean(personaId),
  });
}

export function useSlurpAdPool() {
  return useQuery({
    queryKey: noodleKeys.adPool(),
    queryFn: () => api.get<{ items: SlurpPromotion[] }>(`/slurp2/noodler/ads/pool`),
  });
}

export function useGenerateSlurpAds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (count?: number) =>
      api.post<{ items: SlurpPromotion[]; retired: string[]; images: number }>(`/slurp2/noodler/ads/generate`, {
        count,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: noodleKeys.adPool() });
      void qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() });
    },
  });
}

export type SlurpAdInput = {
  brand: string;
  product: string;
  copy: string;
  contentRating: SlurpContentRating;
};

export function useCreateSlurpAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SlurpAdInput) => api.post<SlurpPromotion>(`/slurp2/noodler/ads/pool`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: noodleKeys.adPool() });
      void qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() });
    },
  });
}

export function useUpdateSlurpAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<SlurpAdInput> & { id: string; retiredAt?: null }) =>
      api.patch<SlurpPromotion>(`/slurp2/noodler/ads/pool/${encodeURIComponent(id)}`, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: noodleKeys.adPool() });
      void qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() });
    },
  });
}

export function useDeleteSlurpAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (promotionId: string) => api.delete(`/slurp2/noodler/ads/pool/${encodeURIComponent(promotionId)}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: noodleKeys.adPool() });
      void qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() });
    },
  });
}

export function useGenerateSlurpAdImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (promotionId: string) =>
      api.post<{ ad: SlurpPromotion }>(`/slurp2/noodler/ads/${encodeURIComponent(promotionId)}/image`, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: noodleKeys.adPool() });
      void qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() });
    },
  });
}

export function useSlurpAdLorebooks(enabled: boolean) {
  return useQuery({
    queryKey: [...noodleKeys.adPool(), "lorebooks"],
    queryFn: () => api.get<{ items: { id: string; name: string }[] }>(`/slurp2/noodler/ads/lorebooks`),
    enabled,
  });
}

export function useSyncSlurpAdLorebook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (force?: boolean) =>
      api.post<{ outcome: "disabled" | "unchanged" | "missing" | "synced" }>(`/slurp2/noodler/ads/lorebook/sync`, {
        force,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: noodleKeys.adPool() });
      void qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() });
    },
  });
}

export function useImportSlurpAds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: unknown) =>
      api.post<{ imported: number; events: number }>(`/slurp2/noodler/ads/import`, { mode: "merge", payload }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: noodleKeys.adPool() });
      void qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() });
    },
  });
}

export function useResetSlurpAds() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (personaId: string) => api.post(`/slurp2/noodler/viewer/ads/reset`, { personaId }),
    // Ad queries are keyed by creator and context tags too, so the bare `ads(personaId)` key only
    // ever matched the contextless variant and left every visible feed showing reset ads.
    onSuccess: (_state, personaId) =>
      queryClient.invalidateQueries({
        queryKey: noodleKeys.noodlerViewers(),
        predicate: (query) => query.queryKey.includes("ads") && query.queryKey.includes(personaId),
      }),
  });
}

export type SlurpSettings = {
  inlineAdsEnabled: boolean;
  inlineAdsFrequency: "light" | "standard" | "frequent";
  inlineAdsSteering: "balanced" | "personalized" | "random";
  inlineAdsPreferredTags: string[];
  inlineAdsContentCeiling: SlurpContentRating;
  inlineAdsTone: "corporate" | "scammy" | "local" | "luxury" | "unhinged";
  inlineAdsEra: "present" | "nineties" | "cyberpunk" | "retrofuture";
  inlineAdsWorldContext: string;
  inlineAdsImagesEnabled: boolean;
  inlineAdsImageConnectionId: string | null;
  inlineAdsLorebookId: string | null;
  inlineAdsLorebookRevision: string | null;
  walletEnabled: boolean;
  walletUnlockCost: number;
  walletSubscriptionCost: number;
  pricingDynamicCharacters: boolean;
  pricingMaxWeeklyChangePercent: number;
  walletStipendFloor: number;
  walletDayStartHour: number;
  walletAdReward: number;
  walletAdDailyCap: number;
  walletEngagementReward: number;
  walletEngagementDailyCap: number;
  walletCreatorRevenueSharePercent: number;
  imageWidth: number;
  imageHeight: number;
  storyRate: "off" | "rare" | "regular" | "often";
  teaserRate: "off" | "rare" | "regular" | "often";
  projectRate: "off" | "rare" | "regular" | "often";
  arcPace: "slow" | "normal" | "fast";
  arcAffectsMood: boolean;
  arcFanReactions: boolean;
  arcAutoMode: "off" | "suggest" | "auto";
  arcCooldownWeeks: number;
  arcSource: "library" | "generated" | "mixed";
  arcMaxConcurrentAuto: number;
  arcDirectorMode: boolean;
  arcPollHours: number;
  arcStatEffects: "off" | "small" | "big";
  arcCrossovers: boolean;
  arcLibrary: SlurpArcType[];
  discoveryTags: Array<{ tag: string; group: string }>;
  storyImageWidth: number;
  storyImageHeight: number;
  refreshesPerDay: number;
  generationGuidance: string;
  audienceTone: "warm" | "mixed" | "unfiltered";
  worldActivity: "off" | "quiet" | "normal" | "busy";
  platformScale: "intimate" | "normal" | "large";
  postsPerDay: number;
  autoPostingScheduleEnabled: boolean;
  autoPostGenerationMode: "pre_generate" | "on_demand";
  fanActivityEnabled: boolean;
  generationConnectionId: string | null;
  imageContextMode: "auto" | "imagePrompt" | "vision";
  imageContextConnectionId: string | null;
  imageGenerationConnectionId: string | null;
  imageGenerationPrompt: string;
  imagePromptInterpretation: string;
  enableImageInterpretation: boolean;
  imageGenerationUseAvatarReferences: boolean;
  imageGenerationIncludeDescriptions: boolean;
  autoPostingImagesEnabled: boolean;
  allowRandomUsers: boolean;
  allowProfessorMari: boolean;
  participantSelectionMode: "all" | "random" | "exact";
  participantMin: number;
  participantMax: number;
  invitedCharacterGroupIds: string[];
  /** Characters the user put in the audience. Value is a Fan Type id, or true to derive one. */
  audienceCharacters: Record<string, string | boolean>;
  /** Character groups whose members join the audience. Per-character entries win. */
  audienceCharacterGroupIds: string[];
  /** Most character fans that may act at once. Each one costs prompt space in every fan run. */
  audienceCharacterLimit: number;
  carryoverModes: Array<"conversation" | "roleplay" | "game">;
  carryoverHours: number;
  carryoverMaxItems: number;
  postMaxLength: number;
  postShowMoreLength: number;
  characterImageInstructions: Record<string, boolean>;
  promptPresets: SlurpPromptPreset[];
  promptBlocks: Record<string, SlurpPromptBlockOverride[]>;
  professorMariCreatorSource: boolean;
  enableEnhancedTimelineWriting: boolean;
  includeCharacterSchedules: boolean;
  enableLorebookContext: boolean;
  enableImagePrompts: boolean;
  maxImagesPerRefresh: number;
  maxGeneratedPostsPerRefresh: number;
  maxLikesPerRefresh: number;
  maxRepliesPerRefresh: number;
  allowGalleryImageAttachments: boolean;
  fanActivityRunsPerDay: number;
  audienceReactionBank: { shared: string[]; byType: Record<string, string[]> };
  fanLikesPerRefresh: number;
  fanRepliesPerRefresh: number;
  fanArchetypeWeights: Record<string, number>;
  /** Editable audience personas and their numeric behavior. */
  fanTypes: SlurpFanType[];
  platformEvents: SlurpPlatformEvent[];
  creatorCollabs: { creatorIds: [string, string]; content: string }[];
  /** Creators answer while you are away. Off leaves the background reply loop asleep. */
  messagesAwayRepliesEnabled: boolean;
  messagesReplyBubbleLimit: number;
  messagesDefaultDmPolicy: "open" | "subscribers" | "paid" | "closed";
  messagesDefaultRequestFee: number;
  messagesDefaultPpvPrice: number;
  /** Reply timing, in minutes. */
  messagesUnscheduledAlwaysReachable: boolean;
  messagesHighRapportDelayMinMinutes: number;
  messagesHighRapportDelayMaxMinutes: number;
  messagesMediumRapportDelayMinMinutes: number;
  messagesMediumRapportDelayMaxMinutes: number;
  messagesUnknownReturnDelayMinutes: number;
  messagesMaxReplyDelayMinutes: number;
  messagesRecentPostAwayMinMinutes: number;
  messagesRecentPostAwayMaxMinutes: number;
  messagesStalePostAwayMinMinutes: number;
  messagesStalePostAwayMaxMinutes: number;
  autopurgeEnabled: boolean;
  autopurgeRetentionValue: number;
  autopurgeRetentionUnit: "days" | "weeks" | "months";
  autopurgeKeepPosts: boolean;
  autopurgeIncludeMessageMedia: boolean;
  autopurgeNextRunAt: string | null;
  nightQuiet: boolean;
  /** Every number the audience simulation runs on. The server fills anything missing from Realistic. */
  simulationTuning: SlurpSimulationTuning;
  /** When model-written audience text may run and how many calls it may spend. */
  modelBudget: SlurpModelBudget;
  onboarding: "not_started" | "in_progress" | "completed";
};

export type SlurpSettingsUpdate = Partial<SlurpSettings>;

export type SlurpAutopurgeResult = {
  cutoff: string;
  deletedPosts: number;
  removedPostMedia: number;
  removedMessageMedia: number;
  nextRunAt: string | null;
};

export type SlurpAutopurgePreview = {
  cutoff: string;
  affectedPosts: number;
  postsToDelete: number;
  postMediaFiles: number;
  messageMediaFiles: number;
  estimatedReclaimableBytes: number;
};

export type SlurpMaintenanceSummary = {
  generatedAt: string;
  operations: { backup: boolean; deletion: boolean; account: boolean; mutation: boolean };
  content: { creators: number; posts: number; interactions: number; messages: number };
  media: { files: number; bytes: number };
  unused: {
    preparedPosts: number;
    attempts: number;
    runs: number;
    improvementJobs: number;
    improvementProposals: number;
  };
};

export type SlurpImprovementProposal = {
  id: string;
  accountId: string;
  field: string;
  before: unknown;
  after: unknown;
  status: "pending" | "applied" | "dismissed" | "stale" | "error";
  error: string | null;
};

export type SlurpImprovementJob = {
  id: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  mode: "missing" | "refresh" | "prefill";
  rebrand: boolean;
  accountIds: string[];
  modules: string[];
  completed: number;
  total: number;
  expectedModelCalls: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  proposals: SlurpImprovementProposal[];
};

export type SlurpScheduleSlot = {
  id: string;
  publishAt: string;
  state: "scheduled" | "prepared";
};

export type SlurpReserveStatus = {
  preparedCount: number;
  preparedThrough: string | null;
  textAttemptsUsed: number;
  imageAttemptsUsed: number;
  postsPerDay: number;
  preparationNotBefore: string;
  creators: Array<{
    accountId: string;
    nextPreparedAt: string | null;
    preparedCount: number;
    slots: SlurpScheduleSlot[];
  }>;
};

export function useSlurpSettings() {
  return useQuery({
    queryKey: noodleKeys.settings(),
    queryFn: () => api.get<SlurpSettings>("/slurp2/settings"),
    staleTime: 10_000,
  });
}

export function useSlurpSettingsDefaults() {
  return useQuery({
    queryKey: [...noodleKeys.settings(), "defaults"] as const,
    queryFn: () => api.get<SlurpSettings>("/slurp2/settings/defaults"),
    staleTime: Infinity,
  });
}

export type SlurpPromptBlockDefinition = {
  id: string;
  kind: "editable" | "required" | "context";
  optional: boolean;
  defaultText: string;
};

export type SlurpPromptDefinition = {
  id: string;
  group: "writing" | "messages" | "images" | "profiles" | "world" | "audience";
  blocks: SlurpPromptBlockDefinition[];
};

export function useSlurpPromptBlocks() {
  return useQuery({
    queryKey: [...noodleKeys.settings(), "prompt-blocks"] as const,
    queryFn: () => api.get<{ prompts: SlurpPromptDefinition[] }>("/slurp2/settings/prompt-blocks"),
    staleTime: Infinity,
  });
}

export type SlurpBackupJob = {
  id: string;
  kind: "export" | "restore";
  state: "queued" | "preparing" | "writing" | "completed" | "error";
  stage: string;
  detail: string;
  creators: number;
  posts: number;
  interactions: number;
  mediaFiles: number;
  mediaCompleted: number;
  mediaBytes: number;
  archiveBytes: number;
  skipped: string[];
  error: string | null;
};

export type SlurpRestoreInspection = {
  id: string;
  expiresAt: string;
  sourcePackage: "slurp" | "slurp2";
  exportedAt: string | null;
  creators: number;
  posts: number;
  interactions: number;
  mediaFiles: number;
  mediaBytes: number;
  hasSlurp2Settings: boolean;
};

const backupError = async (response: Response, fallback: string): Promise<never> => {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  throw new Error(body?.error ?? fallback);
};

export async function startSlurpBackup(): Promise<SlurpBackupJob> {
  const response = await api.raw("/slurp2/backup/jobs", { method: "POST" });
  if (!response.ok) return backupError(response, "Could not start the Slurp backup.");
  return response.json() as Promise<SlurpBackupJob>;
}

export async function getSlurpBackupJob(id: string): Promise<SlurpBackupJob> {
  const response = await api.raw(`/slurp2/backup/jobs/${encodeURIComponent(id)}`);
  if (!response.ok) return backupError(response, "Could not read the backup status.");
  return response.json() as Promise<SlurpBackupJob>;
}

export async function downloadSlurpBackup(id: string): Promise<void> {
  const response = await api.raw(`/slurp2/backup/jobs/${encodeURIComponent(id)}/download`);
  if (!response.ok) return backupError(response, "Could not download the Slurp backup.");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "slurp2-backup.zip";
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Upload an archive and start the restore. The reply is the job to poll, not the result. */
export async function startSlurpRestore(archive: File | Blob, importSettings = false): Promise<SlurpBackupJob> {
  const response = await api.raw(`/slurp2/restore/jobs${importSettings ? "?importSettings=1" : ""}`, {
    method: "POST",
    headers: { "Content-Type": "application/zip" },
    body: archive,
  });
  if (!response.ok) return backupError(response, "Could not start the Slurp restore.");
  return response.json() as Promise<SlurpBackupJob>;
}

export async function inspectSlurpRestore(archive: File | Blob): Promise<SlurpRestoreInspection> {
  const response = await api.raw("/slurp2/restore/inspections", {
    method: "POST",
    headers: { "Content-Type": "application/zip" },
    body: archive,
  });
  if (!response.ok) return backupError(response, "Could not inspect the Slurp restore.");
  return response.json() as Promise<SlurpRestoreInspection>;
}

export async function applySlurpRestoreInspection(
  inspectionId: string,
  importSettings = false,
): Promise<SlurpBackupJob> {
  const response = await api.raw(
    `/slurp2/restore/inspections/${encodeURIComponent(inspectionId)}/apply${importSettings ? "?importSettings=1" : ""}`,
    { method: "POST" },
  );
  if (!response.ok) return backupError(response, "Could not start the inspected Slurp restore.");
  return response.json() as Promise<SlurpBackupJob>;
}

export async function discardSlurpRestoreInspection(inspectionId: string): Promise<void> {
  await api.raw(`/slurp2/restore/inspections/${encodeURIComponent(inspectionId)}`, { method: "DELETE" });
}

export function useUpdateSlurpSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: SlurpSettingsUpdate) => api.patch<SlurpSettings>("/slurp2/settings", patch),
    onSuccess: (settings) => {
      queryClient.setQueryData(noodleKeys.settings(), settings);
      return queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerFanStatus() });
    },
  });
}

export function useRunSlurpAutopurge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<SlurpAutopurgeResult>("/slurp2/autopurge/run", {}),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: noodleKeys.settings() });
      void queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerRoot() });
      return result;
    },
  });
}

export function useSlurpMaintenanceSummary(enabled: boolean) {
  return useQuery({
    queryKey: [...noodleKeys.settings(), "maintenance-summary"] as const,
    queryFn: () => api.get<SlurpMaintenanceSummary>("/slurp2/maintenance/summary"),
    enabled,
    staleTime: 15_000,
  });
}

export function useSlurpAutopurgePreview(settings: SlurpSettings | undefined, enabled: boolean) {
  const input = settings
    ? {
        autopurgeRetentionValue: settings.autopurgeRetentionValue,
        autopurgeRetentionUnit: settings.autopurgeRetentionUnit,
        autopurgeKeepPosts: settings.autopurgeKeepPosts,
        autopurgeIncludeMessageMedia: settings.autopurgeIncludeMessageMedia,
      }
    : null;
  return useQuery({
    queryKey: [...noodleKeys.settings(), "autopurge-preview", input] as const,
    queryFn: () => api.post<SlurpAutopurgePreview>("/slurp2/autopurge/preview", input!),
    enabled: enabled && Boolean(input),
    staleTime: 10_000,
  });
}

export function useSlurpImprovementJobs(enabled: boolean) {
  return useQuery({
    queryKey: [...noodleKeys.settings(), "improvement-jobs"] as const,
    queryFn: () => api.get<{ items: SlurpImprovementJob[] }>("/slurp2/backstage/improvement-jobs"),
    enabled,
    refetchInterval: (query) =>
      query.state.data?.items.some((job) => job.status === "queued" || job.status === "running") ? 1000 : false,
  });
}

export function useCreateSlurpImprovementJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      accountIds: string[];
      mode: "missing" | "refresh" | "prefill";
      rebrand: boolean;
      modules: string[];
      connectionId?: string;
    }) => api.post<SlurpImprovementJob>("/slurp2/backstage/improvement-jobs", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...noodleKeys.settings(), "improvement-jobs"] }),
  });
}

export function useApplySlurpImprovementProposals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, proposalIds }: { jobId: string; proposalIds: string[] }) =>
      api.post<{ applied: number; rejected: number; creators: number; createdTags: string[] }>(
        `/slurp2/backstage/improvement-jobs/${encodeURIComponent(jobId)}/apply`,
        { proposalIds },
      ),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: [...noodleKeys.settings(), "improvement-jobs"] }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerAccounts() }),
        qc.invalidateQueries({ queryKey: noodleKeys.settings() }),
      ]),
  });
}

export function useSetSlurpImprovementJobState() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, action }: { jobId: string; action: "cancel" | "resume" | "retry" }) =>
      api.post<SlurpImprovementJob>(`/slurp2/backstage/improvement-jobs/${encodeURIComponent(jobId)}/${action}`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...noodleKeys.settings(), "improvement-jobs"] }),
  });
}

export function useDismissSlurpImprovementProposals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, proposalIds }: { jobId: string; proposalIds: string[] }) =>
      api.post<{ dismissed: number }>(`/slurp2/backstage/improvement-jobs/${encodeURIComponent(jobId)}/dismiss`, {
        proposalIds,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...noodleKeys.settings(), "improvement-jobs"] }),
  });
}

/** Put a built-in arc type back to its shipped state. */
export function useResetSlurpArcType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<SlurpSettings>(`/slurp2/arc-library/${encodeURIComponent(id)}/reset`, {}),
    onSuccess: (settings) => queryClient.setQueryData(noodleKeys.settings(), settings),
  });
}

/** Creators and arc types per tag, keyed by lower-cased tag. */
export function useSlurpDiscoveryTagUsage(enabled: boolean) {
  return useQuery({
    queryKey: [...noodleKeys.settings(), "discovery-tag-usage"],
    queryFn: () =>
      api.get<{ creators: Record<string, number>; arcTypes: Record<string, number> }>("/slurp2/discovery-tags/usage"),
    enabled,
  });
}

/** Rename (`to` set) or delete (`to` null) a tag everywhere, Creator profiles included. */
export function useReplaceSlurpDiscoveryTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ from, to }: { from: string; to: string | null }) =>
      to === null
        ? api.post<SlurpSettings>("/slurp2/discovery-tags/delete", { tag: from })
        : api.post<SlurpSettings>("/slurp2/discovery-tags/rename", { from, to }),
    onSuccess: (settings) => {
      queryClient.setQueryData(noodleKeys.settings(), settings);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: [...noodleKeys.settings(), "discovery-tag-usage"] }),
        queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerRoot() }),
      ]);
    },
  });
}

export type SlurpCreatorBulkPatch = {
  gender?: SlurpDiscoveryGender | null;
  tags?: string[];
  addTags?: string[];
  removeTags?: string[];
  autoPosting?: boolean;
  imagesEnabled?: boolean;
};

/** One edit applied to many Creators at once; a single Creator's quick edit uses it too. */
export function useBulkUpdateSlurpCreators() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { ids: string[]; patch: SlurpCreatorBulkPatch }) =>
      api.post<{ updated: number; skipped: number; tagLimitReached: number }>(
        "/slurp2/noodler/accounts/bulk-update",
        input,
      ),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerAccounts() }),
        queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerReserveStatus() }),
        queryClient.invalidateQueries({ queryKey: [...noodleKeys.settings(), "discovery-tag-usage"] }),
        queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerRoot() }),
      ]),
  });
}

export function useDeleteAllSlurpData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<{ deletedCreators: number; deletedPosts: number }>("/slurp2/data"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noodleKeys.all }),
  });
}

export function useDeleteUnusedSlurpData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.delete<{ deletedPreparedPosts: number; deletedAttempts: number; deletedRuns: number }>("/slurp2/data/unused"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noodleKeys.all }),
  });
}

export function useSlurpConnections(enabled = true) {
  return useQuery({
    queryKey: ["slurp", "connections"],
    queryFn: () =>
      api.get<
        Array<{
          id: string;
          name?: string;
          model?: string;
          provider?: string;
          defaultForAgents?: string | boolean;
          isDefault?: string | boolean;
        }>
      >("/connections"),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export type SlurpImageConnections = {
  defaultConnectionId: string | null;
  creatorConnectionIds: Record<string, string>;
};

type SlurpPageCursor = { createdAt: string; id: string };

function cursorQuery(cursor: SlurpPageCursor | null): string {
  return cursor ? `&cursorAt=${encodeURIComponent(cursor.createdAt)}&cursorId=${encodeURIComponent(cursor.id)}` : "";
}

function mergeSlurpViewerShell(current: NoodlerViewerScope | undefined, shell: NoodlerViewerScope): NoodlerViewerScope {
  if (!current) return shell;
  const currentByCreator = new Map(current.creators.map((creator) => [creator.profile.id, creator]));
  return {
    ...shell,
    creators: shell.creators.map((creator) => ({
      ...creator,
      posts: currentByCreator.get(creator.profile.id)?.posts ?? [],
    })),
  };
}

export function useSlurpImageConnections(enabled = true) {
  return useQuery({
    queryKey: noodleKeys.noodlerImageConnections(),
    queryFn: () => api.get<SlurpImageConnections>("/slurp2/noodler/image-connections"),
    enabled,
    staleTime: 10_000,
  });
}

/**
 * What public posts and locked posts are each for, globally and per Creator.
 *
 * An empty string means "inherit": a Creator falls back to the global field, and the global field
 * falls back to the built-in text on the server. Nothing here is resolved on the client, so the
 * fields show what was actually written rather than the value in force.
 */
export type SlurpPostGuidanceEntry = { public: string; locked: string; menu: string };
export type SlurpPostGuidance = {
  defaults: SlurpPostGuidanceEntry;
  creators: Record<string, SlurpPostGuidanceEntry>;
  /** The shipped wording, sent by the server so the client never keeps a second copy of it. */
  builtIn: SlurpPostGuidanceEntry;
};
export type SlurpPostAccess = "public" | "locked";

export function useSlurpPostGuidance(enabled = true) {
  return useQuery({
    queryKey: noodleKeys.noodlerPostGuidance(),
    queryFn: () => api.get<SlurpPostGuidance>("/slurp2/noodler/post-guidance"),
    enabled,
    staleTime: 10_000,
  });
}

export function useUpdateSlurpPostGuidance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: { creatorId?: string | null; public?: string; locked?: string; menu?: string }) =>
      api.patch<SlurpPostGuidance>("/slurp2/noodler/post-guidance", patch),
    onSuccess: (value) => qc.setQueryData(noodleKeys.noodlerPostGuidance(), value),
  });
}

export function useGenerateSlurpPostGuidance() {
  return useMutation({
    mutationFn: (input: {
      access: SlurpPostAccess;
      creatorId?: string | null;
      currentDraft?: string;
      guidance?: string;
    }) => api.post<{ guidance: string }>("/slurp2/noodler/post-guidance-draft", input),
  });
}

export function useUpdateSlurpImageConnections() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: { defaultConnectionId?: string | null; creatorId?: string; connectionId?: string | null }) =>
      api.patch<SlurpImageConnections>("/slurp2/noodler/image-connections", patch),
    onSuccess: (value) => qc.setQueryData(noodleKeys.noodlerImageConnections(), value),
  });
}

/**
 * Point several new Creators at one image connection.
 *
 * The PATCH route maps one Creator at a time and the server serializes the blob write, so these
 * run in sequence; the wizard only ever creates a handful at once.
 */
export function useUpdateSlurpConnectionsForCreators() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { creatorIds: string[]; connectionId: string }) => {
      let latest: SlurpImageConnections | undefined;
      for (const creatorId of input.creatorIds) {
        latest = await api.patch<SlurpImageConnections>("/slurp2/noodler/image-connections", {
          creatorId,
          connectionId: input.connectionId,
        });
      }
      return latest;
    },
    onSuccess: (value) => {
      if (value) qc.setQueryData(noodleKeys.noodlerImageConnections(), value);
    },
  });
}

function preservePollVotes(current: NoodleBootstrap | undefined, next: NoodleBootstrap): NoodleBootstrap {
  if (!current) return next;
  const interactions = mergeNoodlePollVoteInteractions(current.interactions, next.posts, next.interactions);
  return interactions === next.interactions ? next : { ...next, interactions };
}

export function useNoodlerAccounts(enabled = true) {
  return useQuery({
    queryKey: noodleKeys.noodlerAccounts(),
    // The server sends `scheduleStatus` alongside the shared type, which has no such field — the
    // same arrangement `subscriptionPrice` and the tip goal already use.
    queryFn: () =>
      api.get<Array<SlurpManagedStageProfile & { scheduleStatus?: SlurpScheduleStatus }>>("/slurp2/noodler/accounts"),
    enabled,
    staleTime: 10_000,
    // Autonomous reserve work changes operator state without a client mutation.
    refetchInterval: enabled ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
}

export type NoodlerViewerWallets = Record<string, { coins: number }>;

/** One wallet's ledger line. `amount` is signed: negative spends, positive earns. */
export type SlurpWalletEntry = {
  kind:
    | "unlock"
    | "subscribe"
    | "renew"
    | "tip"
    | "topUp"
    | "stipend"
    | "ad"
    | "engagement"
    | "income"
    // Direct-message economy kinds. The server has emitted these since messaging landed; the
    // client union had not caught up, so a PPV or commission line was typed as impossible.
    | "messageRequest"
    | "ppv"
    | "commission";
  amount: number;
  at: string;
  note?: string;
};

export type SlurpWallet = {
  coins: number;
  cheatsEnabled?: boolean;
  stipendOn?: string;
  refillFloor?: number;
  refillAvailable?: boolean;
  nextRefillAt?: string;
  ledger: SlurpWalletEntry[];
  earnedToday: { ad: number; engagement: number };
  subscriptions: Record<string, { paidThroughAt: string; price: number }>;
};

/**
 * The viewer's wallet. Fetching it is what pays the daily stipend and charges due renewals on the
 * server, so the wallet page opening is also what moves the economy forward.
 */
/**
 * Why a Creator does or does not have an Engine Conversation Schedule today.
 *
 * `stale` is the one that matters: Engine schedules are keyed to a Monday, so one that was not
 * regenerated this week stops applying with no signal anywhere.
 */
export type SlurpScheduleStatus =
  | { state: "not-applicable" }
  | { state: "disabled" }
  | { state: "missing" }
  | { state: "stale" }
  | { state: "empty-today" }
  | { state: "active"; blocks: number };

export type SlurpTopFan = {
  id: string;
  displayName: string | null;
  handle: string | null;
  traits: string[];
  stage: string;
  audienceArc?: string;
  spent: number;
  interactions: number;
  firstSeenAt: string;
};

export type SlurpGoalProgress = {
  label: string;
  target: number;
  raised: number;
  progress: number;
  remaining: number;
  met: boolean;
  startedAt: string;
};

export type SlurpStudioPost = {
  id: string;
  title: string | null;
  createdAt: string;
  locked: boolean;
  hasImage: boolean;
  reach: number;
  likeCount: number;
  replyCount: number;
  unlockCount: number | null;
};

export type SlurpStudioCreator = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  followers: number;
  subscribers: number;
  earnings: {
    coins: number;
    lifetime: number;
    ledger: Array<{ kind: string; amount: number; at: string; note?: string }>;
  };
  milestone: { reached: number | null; next: number | null; progress: number; remaining: number };
  goal: SlurpGoalProgress | null;
  /** Coins this Creator may still withdraw today. */
  payoutAllowance: number;
  topFans: SlurpTopFan[];
  /** Null on a first visit: "no change yet" and "measured no change" are different. */
  followersDelta: number | null;
  earningsDelta: number | null;
  milestonesCrossed: number[];
  posts: SlurpStudioPost[];
};

export type SlurpEventKind =
  | "subscribed"
  | "lapsed"
  | "tip"
  | "unlock"
  | "ppv_unlock"
  | "commission_requested"
  | "commission_accepted"
  | "comment"
  | "message"
  | "milestone"
  | "audience_arc"
  | "returned"
  | "arc_phase"
  | "arc_complete"
  | "arc_started";

export type SlurpEventItem = {
  id: string;
  kind: SlurpEventKind;
  creatorAccountId: string | null;
  subjectId: string | null;
  actorLabel: string | null;
  actorAvatarUrl: string | null;
  /** One readable line about the event, from the free bank. Null for events that need none. */
  note: string | null;
  amount: number;
  weight: number;
  createdAt: string;
  seenAt: string | null;
};

export type SlurpEventGroup =
  | { type: "single"; event: SlurpEventItem }
  | {
      type: "group";
      kind: SlurpEventKind;
      count: number;
      total: number;
      latestAt: string;
      ids: string[];
      events: SlurpEventItem[];
    };

/** The notification stream. `unseen` is what happened while you were away. */
export function useSlurpNotifications(personaId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...noodleKeys.noodlerRoot(), "notifications", personaId ?? "none"],
    queryFn: () =>
      api.get<{ items: SlurpEventGroup[]; unseen: SlurpEventGroup[]; unseenCount: number }>(
        `/slurp2/noodler/notifications?personaId=${encodeURIComponent(personaId!)}`,
      ),
    enabled: Boolean(personaId) && enabled,
    staleTime: 15_000,
  });
}

export function useMarkSlurpNotificationsSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (personaId: string) => api.post<{ ok: boolean }>("/slurp2/noodler/notifications/seen", { personaId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...noodleKeys.noodlerRoot(), "notifications"] }),
  });
}

/** Withdraw earnings into spending money. This is what connects the two seats you play. */
export function useSlurpPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ creatorAccountId, ...body }: { creatorAccountId: string; personaId: string; amount: number }) =>
      api.post<{ allowance: number }>(`/slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId)}/payout`, body),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: [...noodleKeys.noodlerRoot(), "studio"] }),
        qc.invalidateQueries({ queryKey: [...noodleKeys.noodlerRoot(), "wallet"] }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
        qc.invalidateQueries({ queryKey: [...noodleKeys.noodlerRoot(), "viewer-wallets"] }),
      ]),
  });
}

/** Open, replace, or clear a Creator's tip goal. Passing a null label clears it. */
export function useSetSlurpGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      creatorAccountId,
      ...body
    }: {
      creatorAccountId: string;
      personaId: string;
      label: string | null;
      target: number;
    }) =>
      api.put<{ goal: SlurpGoalProgress | null }>(
        `/slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId)}/goal`,
        body,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...noodleKeys.noodlerRoot(), "studio"] }),
  });
}

export type SlurpProject = {
  id: string;
  title: string;
  direction: string;
  chapters: string[];
  chapter: number;
  status: "active" | "paused" | "complete" | "suggested";
  posts: number;
  startedAt: string;
  updatedAt: string;
  typeId: string | null;
  tone: string;
  durationDays: number | null;
  phaseDays: ({ min: number; max: number } | null)[];
  chapterStartedAt: string;
  intensity: "background" | "focus";
  origin: "manual" | "auto";
  generated: boolean;
  history: SlurpArcHistoryEntry[];
  completedAt: string | null;
  twist: string;
  choices: (SlurpArcChoice | null)[];
  pollPostId: string | null;
  pollClosesAt: string | null;
  reach: (SlurpArcChapterReach | null)[];
  revertProfileAtEnd: boolean;
  pendingProfile: { chapter: number; bio?: string; location?: string; proposedAt: string; revert: boolean } | null;
  previousProfile: { bio?: string; location?: string } | null;
  /** A crossover's Creators; empty for a single-Creator arc. */
  creatorIds: string[];
  /** The other participants' display names. */
  partnerNames?: string[];
};

/** Mirrors `SlurpArcChapterReach` on the server: what one chapter changes beyond its posts. */
export type SlurpArcChapterReach = {
  mood?: string;
  effects?: SlurpArcEffects;
  profile?: { bio?: string; location?: string };
};

export type SlurpArcEffects = { growth?: number; earnings?: number; loyalty?: number };

/** Mirrors `SlurpArcChoice` on the server: a fan poll at the end of a chapter. */
export type SlurpArcChoice = {
  question: string;
  options: { label: string; chapters: { label: string; minDays: number; maxDays: number }[] }[];
};

/** Mirrors `SlurpArcHistoryEntry` on the server: one chapter visit. */
export type SlurpArcHistoryEntry = {
  chapter: number;
  label: string;
  startedAt: string;
  endedAt: string | null;
  postIds: string[];
  poll?: {
    question: string;
    winner: string;
    votes: { label: string; count: number }[];
    decidedBy: "fans" | "director" | "chance";
  };
  /** Before the `arcStatEffects` cap. */
  effects?: SlurpArcEffects;
};

/** The viewer-safe part of an arc, for the profile timeline. */
export type SlurpArcTimeline = Pick<
  SlurpProject,
  "id" | "title" | "tone" | "chapters" | "chapter" | "status" | "startedAt" | "completedAt" | "history"
> & {
  openChoice: { question: string; closesAt: string | null } | null;
  /** The other Creators in a crossover this viewer may see. */
  partners?: { id: string; handle: string; displayName: string; avatarUrl: string | null }[];
};

/** A Creator's running and past arcs, as any viewer may see them. Empty for a hidden Creator. */
export function useSlurpArcs(personaId: string | null, creatorAccountId: string | null) {
  return useQuery({
    queryKey: [...noodleKeys.noodlerRoot(), "projects", "arcs", creatorAccountId ?? "none", personaId ?? "none"],
    queryFn: () =>
      api.get<{ arcs: SlurpArcTimeline[] }>(
        `/slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId!)}/arcs?personaId=${encodeURIComponent(personaId!)}`,
      ),
    enabled: Boolean(personaId) && Boolean(creatorAccountId),
  });
}

/** One Director mode action. The server refuses it while Director mode is off. */
export function useDirectSlurpProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      creatorAccountId,
      projectId,
      ...body
    }: {
      creatorAccountId: string;
      projectId: string;
      personaId: string;
      action: "pause" | "resume" | "skip" | "back" | "label" | "twist" | "end" | "choose";
      value?: string;
    }) =>
      api.post<{ project: SlurpProject }>(
        `/slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId)}/projects/${encodeURIComponent(projectId)}/director`,
        body,
      ),
    onSuccess: () => invalidateSlurpProjects(qc),
  });
}

/** Apply or reject an arc's pending profile change. Not a Director action. */
export function useResolveSlurpArcProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      creatorAccountId,
      projectId,
      ...body
    }: {
      creatorAccountId: string;
      projectId: string;
      personaId: string;
      apply: boolean;
    }) =>
      api.post<{ project: SlurpProject }>(
        `/slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId)}/projects/${encodeURIComponent(projectId)}/profile`,
        body,
      ),
    // The profile itself changed too, so every Creator view refetches.
    onSuccess: () => qc.invalidateQueries({ queryKey: noodleKeys.noodlerRoot() }),
  });
}

/** Mirrors `SlurpCreatorArcConfig` on the server. A missing field uses the global setting. */
export type SlurpCreatorArcConfig = {
  autoMode?: "off" | "suggest" | "auto";
  source?: "library" | "generated" | "mixed";
  cooldownWeeks?: number;
  pace?: "slow" | "normal" | "fast";
  allowedTypeIds?: string[];
  maxActive?: number;
  crossovers?: boolean;
};

const slurpArcConfigKey = (creatorAccountId: string | null, personaId: string | null) => [
  ...noodleKeys.noodlerRoot(),
  "arc-config",
  creatorAccountId ?? "none",
  personaId ?? "none",
];

export function useSlurpArcConfig(personaId: string | null, creatorAccountId: string | null) {
  return useQuery({
    queryKey: slurpArcConfigKey(creatorAccountId, personaId),
    queryFn: () =>
      api.get<{ config: SlurpCreatorArcConfig }>(
        `/slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId!)}/arc-config?personaId=${encodeURIComponent(personaId!)}`,
      ),
    enabled: Boolean(personaId) && Boolean(creatorAccountId),
  });
}

/** Replaces the whole config: send `{}` to reset every field to global. */
export function useUpdateSlurpArcConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      creatorAccountId,
      personaId,
      config,
    }: {
      creatorAccountId: string;
      personaId: string;
      config: SlurpCreatorArcConfig;
    }) =>
      api.put<{ config: SlurpCreatorArcConfig }>(
        `/slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId)}/arc-config`,
        { personaId, ...config },
      ),
    onSuccess: (data, { creatorAccountId, personaId }) =>
      qc.setQueryData(slurpArcConfigKey(creatorAccountId, personaId), data),
  });
}

/** Mirrors `SlurpArcType` on the server: one entry of the `arcLibrary` setting. */
export type SlurpArcType = {
  id: string;
  name: string;
  description: string;
  chapters: ({ label: string; minDays: number; maxDays: number; choice?: SlurpArcChoice } & SlurpArcChapterReach)[];
  revertProfileAtEnd?: boolean;
  tags: string[];
  tone: string;
  durationDays: number;
  enabled: boolean;
  builtin: boolean;
  hidden: boolean;
};

/**
 * A Creator's projects.
 *
 * Owner-only. A project is production notes, unlike the tip goal beside it, which exists to be
 * shown to the audience.
 */
export function useSlurpProjects(personaId: string | null, creatorAccountId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...noodleKeys.noodlerRoot(), "projects", creatorAccountId ?? "none", personaId ?? "none"],
    queryFn: () =>
      api.get<{ projects: SlurpProject[] }>(
        `/slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId!)}/projects?personaId=${encodeURIComponent(personaId!)}`,
      ),
    enabled: Boolean(personaId) && Boolean(creatorAccountId) && enabled,
  });
}

const invalidateSlurpProjects = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({ queryKey: [...noodleKeys.noodlerRoot(), "projects"] });

export function useCreateSlurpProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      creatorAccountId,
      ...body
    }: {
      creatorAccountId: string;
      personaId: string;
      title: string;
      direction: string;
      chapters: string[];
      typeId: string | null;
      durationDays?: number | null;
      crossoverWith?: string[];
    }) =>
      api.post<{ project: SlurpProject }>(
        `/slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId)}/projects`,
        body,
      ),
    onSuccess: () => invalidateSlurpProjects(qc),
  });
}

/** Ask the model for an arc. It comes back as a suggestion to accept, edit, or dismiss. */
export function useGenerateSlurpProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ creatorAccountId, personaId }: { creatorAccountId: string; personaId: string }) =>
      api.post<{ project: SlurpProject }>(
        `/slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId)}/projects/generate`,
        { personaId },
      ),
    onSuccess: () => invalidateSlurpProjects(qc),
  });
}

/** Generate an unsaved Arc Library draft from a player brief. */
export function useGenerateSlurpArcType() {
  return useMutation({
    mutationFn: ({
      creatorAccountId,
      personaId,
      brief,
    }: {
      creatorAccountId: string;
      personaId: string;
      brief: string;
    }) =>
      api.post<{ type: SlurpArcType }>(
        `/slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId)}/arc-library/generate`,
        { personaId, brief },
      ),
  });
}

/** Copy an arc into the arc library as a custom type. */
export function useSaveSlurpProjectToLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      creatorAccountId,
      projectId,
      personaId,
    }: {
      creatorAccountId: string;
      projectId: string;
      personaId: string;
    }) =>
      api.post<{ type: SlurpArcType }>(
        `/slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId)}/projects/${encodeURIComponent(projectId)}/library`,
        { personaId },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: noodleKeys.settings() }),
  });
}

export function useUpdateSlurpProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      creatorAccountId,
      projectId,
      ...body
    }: {
      creatorAccountId: string;
      projectId: string;
      personaId: string;
      title?: string;
      direction?: string;
      chapters?: string[];
      chapter?: number;
      status?: SlurpProject["status"];
      intensity?: SlurpProject["intensity"];
      durationDays?: number | null;
    }) =>
      api.patch<{ project: SlurpProject }>(
        `/slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId)}/projects/${encodeURIComponent(projectId)}`,
        body,
      ),
    onSuccess: () => invalidateSlurpProjects(qc),
  });
}

export function useDeleteSlurpProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      creatorAccountId,
      projectId,
      personaId,
    }: {
      creatorAccountId: string;
      projectId: string;
      personaId: string;
    }) =>
      api.delete<{ deleted: boolean }>(
        `/slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId)}/projects/${encodeURIComponent(projectId)}?personaId=${encodeURIComponent(personaId)}`,
      ),
    onSuccess: () => invalidateSlurpProjects(qc),
  });
}

export type SlurpCreatorMetrics = {
  id: string;
  posts: number;
  followers: number;
  subscribers: number;
  likes: number;
  replies: number;
  earnings: number;
  unread: number;
  arcs: number;
};

/** Read-only metrics for every Creator. Unlike the studio, reading this changes nothing. */
export function useSlurpCreatorMetrics(enabled = true) {
  return useQuery({
    queryKey: [...noodleKeys.noodlerRoot(), "creator-metrics"],
    queryFn: () => api.get<{ creators: SlurpCreatorMetrics[] }>("/slurp2/noodler/creator-metrics"),
    enabled,
    staleTime: 30_000,
  });
}

/** The Creator home. Reading it also re-marks the point future deltas are measured from. */
export function useSlurpStudio(personaId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...noodleKeys.noodlerRoot(), "studio", personaId ?? "none"],
    queryFn: () =>
      api.get<{ since: string | null; creators: SlurpStudioCreator[] }>(
        `/slurp2/noodler/studio?personaId=${encodeURIComponent(personaId!)}`,
      ),
    enabled: Boolean(personaId) && enabled,
    // The snapshot is rewritten on every read, so refetching would silently zero the deltas the
    // player is looking at. Read once per visit.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useSlurpWallet(personaId: string | null) {
  return useQuery({
    queryKey: [...noodleKeys.noodlerRoot(), "wallet", personaId ?? "none"],
    queryFn: () => api.get<SlurpWallet>(`/slurp2/noodler/viewer/wallet?personaId=${encodeURIComponent(personaId!)}`),
    enabled: Boolean(personaId),
  });
}

export function useClaimSlurpDailyRefill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { personaId: string }) =>
      api.post<SlurpWallet>("/slurp2/noodler/viewer/wallet/daily-refill", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerRoot() }),
  });
}

export function useSetSlurpWalletCoinsForDevelopment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { personaId: string; coins: number }) =>
      api.post<SlurpWallet>("/slurp2/noodler/viewer/wallet/dev-set", input),
    onSuccess: (_wallet, input) =>
      queryClient.invalidateQueries({ queryKey: [...noodleKeys.noodlerRoot(), "wallet", input.personaId] }),
  });
}

export function useTipSlurpCreator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { accountId: string; personaId: string; amount: number; requestId?: string }) =>
      api.post<SlurpWallet>(`/slurp2/noodler/accounts/${encodeURIComponent(input.accountId)}/tip`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerRoot() }),
  });
}

/** Set a creator's own weekly price, or clear it back to the default with `null`. */
export function useSetSlurpCreatorPrice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { accountId: string; personaId: string; price: number | null }) =>
      api.put<{ price: number }>(`/slurp2/noodler/accounts/${encodeURIComponent(input.accountId)}/subscription-price`, {
        personaId: input.personaId,
        price: input.price,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerRoot() }),
  });
}

export function useNoodlerViewerWallets(enabled = true) {
  return useQuery({
    queryKey: [...noodleKeys.noodlerRoot(), "viewer-wallets"],
    queryFn: () => api.get<NoodlerViewerWallets>("/slurp2/noodler/viewer-wallets"),
    enabled,
    staleTime: 30_000,
  });
}

/** Fan and follower totals keyed by creator account id. */
export type NoodlerConnectionCounts = Record<string, { fans: number; followers: number }>;

export function useNoodlerConnectionCounts(enabled = true) {
  return useQuery({
    queryKey: noodleKeys.noodlerConnectionCounts(),
    queryFn: () => api.get<NoodlerConnectionCounts>("/slurp2/noodler/account-connection-counts"),
    enabled,
    staleTime: 30_000,
  });
}

export function useNoodlerEligibleAccounts(
  search: string,
  kind: "all" | "character" | "persona",
  enabled = true,
  includeAccountId?: string | null,
) {
  const normalizedSearch = search.trim();
  return useInfiniteQuery({
    queryKey: [...noodleKeys.noodlerEligibleAccounts(normalizedSearch, kind), includeAccountId ?? "none"],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api.get<{
        items: NoodleAccount[];
        limit: number;
        offset: number;
        hasMore: boolean;
      }>(
        `/slurp2/noodler/eligible-accounts?limit=100&offset=${pageParam}&search=${encodeURIComponent(normalizedSearch)}${kind === "all" ? "" : `&kind=${kind}`}${includeAccountId ? `&includeAccountId=${encodeURIComponent(includeAccountId)}` : ""}`,
      ),
    getNextPageParam: (page) => (page.hasMore ? page.offset + page.items.length : undefined),
    enabled,
    staleTime: 10_000,
  });
}

export type SlurpProfilePost =
  { managed: NoodlerManagedPost; viewerPost: NoodlerPostView | null } | { viewerPost: NoodlerPostView };

export function useNoodlerPosts(accountId: string | null, personaId: string | null) {
  return useQuery({
    queryKey: [...noodleKeys.noodlerPosts(accountId ?? "none"), personaId ?? "none"],
    queryFn: async ({ signal }) => {
      const items: SlurpProfilePost[] = [];
      let cursor: SlurpPageCursor | null = null;
      do {
        const query = new URLSearchParams({ limit: "20" });
        if (personaId) query.set("personaId", personaId);
        if (cursor) {
          query.set("cursorAt", cursor.createdAt);
          query.set("cursorId", cursor.id);
        }
        const page: {
          items: SlurpProfilePost[];
          nextCursor: SlurpPageCursor | null;
        } = await api.get(`/slurp2/noodler/accounts/${encodeURIComponent(accountId!)}/posts?${query.toString()}`, {
          signal,
        });
        items.push(...page.items);
        cursor = page.nextCursor;
      } while (cursor);
      return items;
    },
    enabled: Boolean(accountId),
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    // Automatic posts are written server-side without a client mutation; poll while visible.
    refetchInterval: accountId ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
}

/**
 * A subscriber row, widened for the generated audience.
 *
 * `NoodlerSubscriber` describes an account-backed viewer. Somebody from the population has no
 * account and no profile to open, so the extra fields say which kind of person a row is.
 */
export type SlurpSubscriberEntry = NoodlerSubscriber & {
  audience?: boolean;
  stage?: string;
  spent?: number;
};

/** Somebody in the audience who follows a Creator, by name. */
export type SlurpFollowerEntry = {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  avatarCrop: null;
  stage: string;
  audienceArc: string;
  traits: string[];
  spent: number;
  followedAt: string;
};

/** One audience member's card: who they are, and their history with one Creator. */
export type SlurpAudienceMember = {
  id: string;
  displayName: string;
  handle: string;
  traits: string[];
  spendTier: string;
  activeHour: number;
  joinedAt: string;
  tie: {
    stage: string;
    audienceArc: string;
    spent: number;
    interactions: number;
    firstSeenAt: string;
    subscribed: boolean;
  } | null;
};

/**
 * The named followers of one Creator, plus the total.
 *
 * The list stops at the named cast; `total` is the platform reach. That is the point — these
 * people, and this many more.
 */
export function useNoodlerFollowers(accountId: string | null) {
  return useQuery({
    queryKey: noodleKeys.noodlerFollowers(accountId ?? "none"),
    queryFn: () =>
      api.get<{ items: SlurpFollowerEntry[]; total: number }>(
        `/slurp2/noodler/accounts/${encodeURIComponent(accountId!)}/followers`,
      ),
    enabled: Boolean(accountId),
    staleTime: 10_000,
  });
}

/** The fan card. Fetched only when one is opened, because a feed of them would be a request each. */
export function useSlurpAudienceMember(memberId: string | null, creatorAccountId: string | null) {
  return useQuery({
    queryKey: noodleKeys.audienceMember(memberId ?? "none", creatorAccountId ?? "none"),
    queryFn: () =>
      api.get<SlurpAudienceMember>(
        `/slurp2/noodler/audience/${encodeURIComponent(memberId!)}?creatorAccountId=${encodeURIComponent(creatorAccountId ?? "")}`,
      ),
    enabled: Boolean(memberId),
    staleTime: 60_000,
  });
}

export type SlurpAudienceCharacterSummary = {
  id: string;
  name: string;
  avatarUrl: string | null;
  avatarCrop: unknown;
  conversationStatus?: string;
};

export type SlurpAudienceCharacterGroup = {
  id: string;
  name: string;
  characterIds: string[];
};

export function useSlurpAudienceCharacters() {
  return useQuery({
    queryKey: ["slurp", "audience", "characters"],
    queryFn: () =>
      api.get<{
        groups: SlurpAudienceCharacterGroup[];
        characters: SlurpAudienceCharacterSummary[];
      }>("/slurp2/settings/audience-characters"),
    staleTime: 60_000,
  });
}

export function useNoodlerSubscribers(accountId: string | null) {
  return useInfiniteQuery({
    queryKey: noodleKeys.noodlerSubscribers(accountId ?? "none"),
    initialPageParam: null as SlurpPageCursor | null,
    queryFn: ({ pageParam }) =>
      api.get<{
        items: SlurpSubscriberEntry[];
        total: number;
        nextCursor: SlurpPageCursor | null;
      }>(`/slurp2/noodler/accounts/${encodeURIComponent(accountId!)}/subscribers?limit=20${cursorQuery(pageParam)}`),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: Boolean(accountId),
    staleTime: 10_000,
  });
}

export function useCreateNoodlerStageProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sourceAccountId,
      stageProfile,
    }: {
      sourceAccountId: string;
      stageProfile: SlurpStageProfileInput;
    }) =>
      api.post<SlurpManagedStageProfile>(`/slurp2/accounts/${encodeURIComponent(sourceAccountId)}/noodler`, {
        stageProfile,
      }),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerAccounts() }),
        qc.invalidateQueries({
          queryKey: noodleKeys.noodlerEligibleAccountsRoot(),
        }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
      ]),
  });
}

export function useBulkCreateNoodlerStageProfiles() {
  const qc = useQueryClient();
  const { t: localizeUi } = useUiTranslation();
  return useMutation({
    mutationFn: (
      input: NoodleBulkNoodlerAccountCreateInput & {
        connectionId?: string | null;
      },
    ) =>
      api.post<{
        created: SlurpManagedStageProfile[];
        skipped: string[];
        failed?: string[];
        reasons?: { accountId: string; reason: string }[];
      }>("/slurp2/noodler/accounts/bulk", input),
    onSuccess: (result) => {
      const failed = result.failed?.length ?? 0;
      const counts = {
        value1: result.created.length,
        value2: result.skipped.length,
        value3: failed,
      };
      if (failed) {
        toast.error(localizeUi("ui.noodle.noodlerbulkcreatepanel.createdValue1SkippedValue2FailedValue3", counts));
      } else {
        toast.success(localizeUi("ui.noodle.noodlerbulkcreatepanel.createdValue1SkippedValue2", counts));
      }
      return Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerAccounts() }),
        qc.invalidateQueries({
          queryKey: noodleKeys.noodlerEligibleAccountsRoot(),
        }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
      ]);
    },
  });
}

export function useUpdateNoodlerStageProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      accountId,
      sourceSnapshot,
      ...input
    }: {
      accountId: string;
      acceptSourceChanges?: boolean;
      sourceSnapshot?: NoodlerSourceSnapshot;
      sourceRevisionToken?: string;
      confirmAvatarReview?: boolean;
    } & SlurpStageProfileInput) =>
      api.put<SlurpManagedStageProfile>(`/slurp2/noodler/accounts/${encodeURIComponent(accountId)}/stage-profile`, {
        ...input,
        ...(sourceSnapshot ? { sourceSnapshot } : {}),
      }),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerAccounts() }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerReserveStatus() }),
      ]),
  });
}

export function useUpdateNoodlerProfileLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { accountId: string; personaId: string; location: string }) =>
      api.patch<NoodlerStageProfile>(`/slurp2/accounts/${encodeURIComponent(input.accountId)}/profile`, {
        personaId: input.personaId,
        profile: { location: input.location },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: noodleKeys.noodlerAccounts() }),
  });
}

function useNoodlerAvatarMutation<TInput extends { accountId: string }>(
  mutationFn: (input: TInput) => Promise<NoodlerStageProfile>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerAccounts() }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerReserveStatus() }),
      ]),
  });
}

export function useUploadNoodlerAvatar() {
  return useNoodlerAvatarMutation(({ accountId, file }: { accountId: string; file: File }) => {
    const form = new FormData();
    form.append("payload", "{}");
    form.append("file", file);
    return api.upload<NoodlerStageProfile>(`/slurp2/noodler/accounts/${encodeURIComponent(accountId)}/avatar`, form);
  });
}

export function useUploadNoodlerBanner() {
  return useNoodlerAvatarMutation(({ accountId, file }: { accountId: string; file: File }) => {
    const form = new FormData();
    form.append("payload", "{}");
    form.append("file", file);
    return api.upload<NoodlerStageProfile>(`/slurp2/noodler/accounts/${encodeURIComponent(accountId)}/banner`, form);
  });
}

export function useGenerateNoodlerArtwork() {
  return useNoodlerAvatarMutation(
    ({ accountId, kind, guidance }: { accountId: string; kind: "avatar" | "banner"; guidance?: string }) =>
      api.post<NoodlerStageProfile>(`/slurp2/noodler/accounts/${encodeURIComponent(accountId)}/artwork/generate`, {
        kind,
        guidance,
      }),
  );
}

export function useUseNoodlerSourceAvatar() {
  return useNoodlerAvatarMutation(({ accountId }) =>
    api.patch<NoodlerStageProfile>(`/slurp2/noodler/accounts/${encodeURIComponent(accountId)}/avatar/source`, {}),
  );
}

export function useRemoveNoodlerAvatar() {
  return useNoodlerAvatarMutation(({ accountId }) =>
    api.delete<NoodlerStageProfile>(`/slurp2/noodler/accounts/${encodeURIComponent(accountId)}/avatar`),
  );
}

function useNoodlerSourceAction(action: "dismiss" | "adopt-identity") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) =>
      api.post<NoodlerManagedStageProfile>(
        `/slurp2/noodler/accounts/${encodeURIComponent(accountId)}/source/${action}`,
        {},
      ),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerAccounts() }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerReserveStatus() }),
      ]),
  });
}

export function useDismissNoodlerSourceChanges() {
  return useNoodlerSourceAction("dismiss");
}

export function useAdoptNoodlerSourceIdentity() {
  return useNoodlerSourceAction("adopt-identity");
}

export function useDeleteNoodlerStageProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) =>
      api.delete<NoodleAccount>(`/slurp2/noodler/accounts/${encodeURIComponent(accountId)}`),
    onSuccess: (_account, accountId) => {
      qc.removeQueries({ queryKey: noodleKeys.noodlerPosts(accountId) });
      return Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerAccounts() }),
        qc.invalidateQueries({
          queryKey: noodleKeys.noodlerEligibleAccountsRoot(),
        }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
      ]);
    },
  });
}

export function useGenerateNoodlerStageProfileDraft() {
  return useMutation({
    mutationFn: (input: NoodleStageProfileDraftRequest) => {
      const controller = new AbortController();
      // ponytail: fixed 60s ceiling, no per-provider tuning — raise if real drafts routinely take longer
      const timer = setTimeout(() => controller.abort(), 60_000);
      return api
        .post<
          SlurpStageProfileInput & {
            sourceSnapshot?: NoodlerSourceSnapshot;
            sourceRevisionToken?: string;
            /** What the server repaired or still needs. Shown once, never saved. */
            notes?: string[];
          }
        >("/slurp2/noodler/stage-profile-draft", input, {
          signal: controller.signal,
        })
        .finally(() => clearTimeout(timer));
    },
  });
}

/**
 * Draft one post for a directly invited character, steered by the user's guidance.
 *
 * Pairs with `POST /accounts/:id/post-draft`, which the standalone Noodle/Slurp split dropped
 * while keeping the generator behind it.
 */
export function useGenerateNoodlePostDraft() {
  return useMutation({
    mutationFn: ({ accountId, ...body }: NoodlePostDraftRequest) =>
      api.post<NoodlePostDraft>(`/slurp2/accounts/${encodeURIComponent(accountId)}/post-draft`, body),
  });
}

export type SlurpAmbientProfile = {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
};

/** The managed ambient roster. Seeded server-side on read, so this is also what creates them. */
export function useSlurpAmbientProfiles(enabled = true) {
  return useQuery({
    queryKey: [...noodleKeys.noodlerRoot(), "ambient-profiles"],
    queryFn: () => api.get<{ allowRandomUsers: boolean; items: SlurpAmbientProfile[] }>("/slurp2/ambient-profiles"),
    enabled,
    staleTime: 30_000,
  });
}

export type NoodleAmbientProfileRerollResult = {
  accounts: NoodleAccount[];
  outcomes: Array<{ accountId: string; status: string; reason?: string }>;
};

/** Reroll the generated identities of the managed ambient profiles. */
export function useRerollAmbientProfiles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountIds: string[]) =>
      api.post<NoodleAmbientProfileRerollResult>("/slurp2/ambient-profiles/reroll", { accountIds }),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerAccounts() }),
        qc.invalidateQueries({ queryKey: [...noodleKeys.noodlerRoot(), "ambient-profiles"] }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerEligibleAccountsRoot() }),
      ]),
  });
}

/** Edit an ambient profile's name, handle, and bio. */
export function useUpdateAmbientProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; displayName: string; handle: string; bio: string }) =>
      api.patch<NoodleAccount>(`/slurp2/ambient-profiles/${encodeURIComponent(id)}`, body),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerAccounts() }),
        qc.invalidateQueries({ queryKey: [...noodleKeys.noodlerRoot(), "ambient-profiles"] }),
      ]),
  });
}

export type NoodlePostDraft = {
  title: string | null;
  content: string;
  imagePrompt: string | null;
  access: "public";
  authorAccountId: string;
};

export type NoodlePostDraftRequest = {
  accountId: string;
  guidance?: string;
  connectionId?: string;
};

export type GeneratedNoodlerNoodlePost = NoodlerManagedPost & {
  imagePromptReview?: ImagePromptReviewItem;
};

export type NoodlerPostDraftImage = {
  source: File | string;
  crop: NoodlePostImageCrop | null;
};

export type NoodlerContentFormat = "caption" | "announcement" | "long_form";

type NoodlerFormatRequest = {
  format?: NoodlerContentFormat;
};

type NoodlerCreatePostRequest = Omit<NoodlerPostCreateInput, "uploadedImageUrl" | "imageCrop"> & {
  image?: NoodlerPostDraftImage | null;
  postType?: "post" | "story";
  linkedPostId?: string | null;
  /** Price for this locked post. Null uses the Creator's price. */
  unlockPrice?: number | null;
  /** Image directions to keep on the post, so its image can be rendered afterwards. */
  imagePrompt?: string | null;
} & NoodlerFormatRequest;

type NoodlerGeneratePostRequest = Omit<NoodlerGenerationRequest, "uploadedImageUrl" | "imageCrop"> & {
  image?: NoodlerPostDraftImage | null;
  /** Ask generation for a Story instead of waiting for the rotation to pick one. */
  postType?: "post" | "story";
} & NoodlerFormatRequest;

function postNoodlerRequestWithImage<T>(
  path: string,
  input: Record<string, unknown>,
  image?: NoodlerPostDraftImage | null,
): Promise<T> {
  if (!image) return api.post<T>(path, input);
  const payload = {
    ...input,
    ...(image.crop ? { imageCrop: image.crop } : {}),
  };
  if (image.source instanceof File) {
    const form = new FormData();
    form.append("payload", JSON.stringify(payload));
    form.append("file", image.source);
    return api.upload<T>(path, form);
  }
  return api.post<T>(path, { ...payload, uploadedImageUrl: image.source });
}

export function useGenerateNoodlerNoodlePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ image, ...input }: NoodlerGeneratePostRequest) =>
      postNoodlerRequestWithImage<GeneratedNoodlerNoodlePost>(
        "/slurp2/refresh",
        {
          ...input,
          debugMode: useSlurpUIStore.getState().debugMode,
          reviewImagePromptsBeforeSend: useSlurpUIStore.getState().reviewImagePromptsBeforeSend,
        },
        image,
      ),
    onSuccess: (_post, input) =>
      Promise.all([
        qc.invalidateQueries({
          queryKey: noodleKeys.noodlerPosts(input.targetAccountId),
        }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
      ]),
  });
}

export function useConfirmNoodlerImagePrompts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { targetAccountId: string; prompts: ImagePromptOverride[] }) =>
      api.post<{ finalized: number }>("/slurp2/noodler/refresh/images", {
        prompts: input.prompts,
        debugMode: useSlurpUIStore.getState().debugMode,
      }),
    onSuccess: (_result, input) =>
      Promise.all([
        qc.invalidateQueries({
          queryKey: noodleKeys.noodlerPosts(input.targetAccountId),
        }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
      ]),
  });
}

export function useCreateNoodlerPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ image, ...input }: NoodlerCreatePostRequest) =>
      postNoodlerRequestWithImage<NoodlerManagedPost>("/slurp2/noodler/posts", input, image),
    onSuccess: (_post, input) =>
      Promise.all([
        qc.invalidateQueries({
          queryKey: noodleKeys.noodlerPosts(input.targetAccountId),
        }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
      ]),
  });
}

function imageFileExtension(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/gif") return "gif";
  if (contentType === "image/avif") return "avif";
  return "jpg";
}

export function useLoadNoodlerPostImage() {
  return useMutation({
    mutationFn: async ({ imageUrl }: { imageUrl: string }) => {
      const url = new URL(imageUrl, window.location.origin);
      if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/")) {
        throw new Error("This post image is not stored by Marinara.");
      }
      const response = await api.raw(`${url.pathname.slice(4)}${url.search}`);
      if (!response.ok) throw new Error("Could not load this post image for editing.");
      const blob = await response.blob();
      const extension = imageFileExtension(blob.type);
      return new File([blob], `noodler-post.${extension}`, {
        type: blob.type,
        lastModified: Date.now(),
      });
    },
  });
}

export function useNoodlerViewer(personaId: string | null, enabled = true) {
  return useQuery({
    queryKey: noodleKeys.viewer(personaId ?? "none"),
    queryFn: async ({ signal }) => {
      const encodedPersonaId = encodeURIComponent(personaId!);
      type ViewerPost = SlurpViewerScope["creators"][number]["posts"][number] & { story?: boolean };
      type FeedPage = {
        items: Array<{
          creatorAccountId: string;
          post: ViewerPost;
        }>;
        total: number;
        nextCursor: SlurpPageCursor | null;
      };
      const feedItems: FeedPage["items"] = [];
      let cursor: SlurpPageCursor | null = null;
      do {
        const page: FeedPage = await api.get<{
          items: Array<{
            creatorAccountId: string;
            post: SlurpViewerScope["creators"][number]["posts"][number];
          }>;
          total: number;
          nextCursor: SlurpPageCursor | null;
        }>(`/slurp2/noodler/viewer/feed?personaId=${encodedPersonaId}&tab=all&limit=20${cursorQuery(cursor)}`, {
          signal,
        });
        feedItems.push(...page.items);
        cursor = page.nextCursor;
      } while (cursor);
      // Read the shell after the feed. A newly-created Creator account and its first post can
      // otherwise be observed from different file-store snapshots when these requests start
      // together, leaving the client with a post whose Creator is absent from the shell.
      const scope = await api.get<SlurpViewerScope>(`/slurp2/noodler/viewer?personaId=${encodedPersonaId}`, {
        signal,
      });
      const postsByCreator = new Map<string, SlurpViewerScope["creators"][number]["posts"]>();
      for (const item of feedItems) {
        const posts = postsByCreator.get(item.creatorAccountId) ?? [];
        posts.push(item.post);
        postsByCreator.set(item.creatorAccountId, posts);
      }
      return {
        ...scope,
        creators: scope.creators.map((creator) => ({
          ...creator,
          posts: postsByCreator.get(creator.profile.id) ?? [],
        })),
      };
    },
    enabled: enabled && Boolean(personaId),
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    refetchInterval: enabled && personaId ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
}

/**
 * Unseen-post count for the public Noodle entry point. Reads the bootstrap query both Noodle
 * surfaces already hold, so the badge is the same number whether it is rendered from Noodle or
 * from NoodleR.
 */
/** Poll the badge without downloading the complete viewer feed or historical media metadata. */
export function useNoodlerUnseenCount(personaId: string | null, enabled = true) {
  const qc = useQueryClient();
  const previousCount = useRef<number | null>(null);
  const { data } = useQuery({
    queryKey: noodleKeys.noodlerUnseenCount(personaId ?? "none"),
    queryFn: () =>
      api.get<{ count: number }>(`/slurp2/noodler/viewer/unseen-count?personaId=${encodeURIComponent(personaId!)}`),
    enabled: enabled && Boolean(personaId),
    staleTime: 10_000,
    refetchInterval: enabled && personaId ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
  const count = Math.max(0, Math.floor(data?.count ?? 0));
  // The baseline belongs to one persona. Carrying it across a switch compared the new persona's
  // count against the old one's, so the viewer feed either never refreshed or refreshed spuriously.
  const previousPersonaId = useRef<string | null>(null);
  useEffect(() => {
    if (previousPersonaId.current !== personaId) {
      previousPersonaId.current = personaId;
      previousCount.current = null;
    }
    if (!enabled || !personaId || previousCount.current === null) {
      previousCount.current = count;
      return;
    }
    if (count > previousCount.current) void qc.invalidateQueries({ queryKey: noodleKeys.viewer(personaId) });
    previousCount.current = count;
  }, [count, enabled, personaId, qc]);
  return count;
}

export function useMarkNoodlerFeedSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (personaId: string) => api.post<NoodleAccount>("/slurp2/noodler/viewer/mark-seen", { personaId }),
    onSuccess: (_viewer, personaId) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.viewer(personaId) }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerUnseenCount(personaId) }),
      ]),
  });
}

export function useToggleNoodlerSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      creatorAccountId,
      personaId,
      subscribed,
    }: {
      creatorAccountId: string;
      personaId: string;
      subscribed: boolean;
    }) =>
      subscribed
        ? api.delete<NoodlerViewerScope>(
            `/slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId)}/subscribe?personaId=${encodeURIComponent(personaId)}`,
          )
        : api.post<NoodlerViewerScope>(`/slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId)}/subscribe`, {
            personaId,
          }),
    // The mutation returns a shell without posts. Keep the current feed visible until refetch.
    onSuccess: async (scope, input) => {
      // Cancel any in-flight viewer poll first, or it can land after us and restore the stale scope.
      await qc.cancelQueries({ queryKey: noodleKeys.viewer(input.personaId) });
      qc.setQueryData<NoodlerViewerScope | undefined>(noodleKeys.viewer(input.personaId), (current) =>
        mergeSlurpViewerShell(current, scope),
      );
      return Promise.all([
        qc.refetchQueries({ queryKey: noodleKeys.viewer(input.personaId), type: "active" }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerPosts(input.creatorAccountId) }),
        qc.invalidateQueries({
          queryKey: noodleKeys.noodlerSubscribers(input.creatorAccountId),
        }),
        qc.invalidateQueries({ queryKey: [...noodleKeys.noodlerRoot(), "wallet", input.personaId] }),
        qc.invalidateQueries({ queryKey: [...noodleKeys.noodlerRoot(), "viewer-wallets"] }),
      ]);
    },
  });
}

export function useToggleNoodlerFollow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      creatorAccountId,
      personaId,
      followed,
    }: {
      creatorAccountId: string;
      personaId: string;
      followed: boolean;
    }) =>
      api.patch<NoodlerViewerScope>(`/slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId)}/follow`, {
        personaId,
        followed,
      }),
    onSuccess: async (scope, input) => {
      await qc.cancelQueries({ queryKey: noodleKeys.viewer(input.personaId) });
      qc.setQueryData<NoodlerViewerScope | undefined>(noodleKeys.viewer(input.personaId), (current) =>
        mergeSlurpViewerShell(current, scope),
      );
      await qc.invalidateQueries({ queryKey: noodleKeys.viewer(input.personaId) });
    },
  });
}

export function useUnlockNoodlerPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, personaId }: { postId: string; personaId: string }) =>
      api.post<NoodlerViewerScope>(`/slurp2/noodler/posts/${encodeURIComponent(postId)}/unlock`, { personaId }),
    onSuccess: async (scope, input) => {
      // Cancel any in-flight viewer poll first, or it can land after us and restore the locked scope.
      await qc.cancelQueries({ queryKey: noodleKeys.viewer(input.personaId) });
      qc.setQueryData<NoodlerViewerScope | undefined>(noodleKeys.viewer(input.personaId), (current) =>
        mergeSlurpViewerShell(current, scope),
      );
      await Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.viewer(input.personaId) }),
        qc.invalidateQueries({ queryKey: [...noodleKeys.noodlerRoot(), "wallet", input.personaId] }),
        qc.invalidateQueries({ queryKey: [...noodleKeys.noodlerRoot(), "viewer-wallets"] }),
      ]);
    },
  });
}

export function useCreateNoodlerInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      postId,
      actorAccountId: _actorAccountId,
      ...input
    }: { postId: string; actorAccountId?: string } & NoodlerCreateInteractionInput) =>
      api.post<NoodleInteraction>(`/slurp2/noodler/posts/${encodeURIComponent(postId)}/interactions`, input),
    onMutate: async (input) => {
      if (input.type !== "like") return undefined;
      await qc.cancelQueries({ queryKey: noodleKeys.viewer(input.personaId) });
      const previous = qc.getQueryData<NoodlerViewerScope>(noodleKeys.viewer(input.personaId));
      qc.setQueryData<NoodlerViewerScope | undefined>(noodleKeys.viewer(input.personaId), (current) => {
        if (!current) return current;
        return {
          ...current,
          creators: current.creators.map((creator) => ({
            ...creator,
            posts: creator.posts.map((post) => {
              if (post.id !== input.postId) return post;
              const interaction: NoodleInteraction = {
                id: `pending:${input.postId}:${input.type}:${input.parentInteractionId ?? "root"}`,
                postId: input.postId,
                parentInteractionId: input.parentInteractionId ?? null,
                actorAccountId: input.actorAccountId ?? input.personaId,
                type: input.type,
                content: null,
                imageUrl: null,
                actorSnapshot: null,
                createdAt: new Date().toISOString(),
              };
              if (post.interactions.some((item) => item.id === interaction.id)) return post;
              return { ...post, interactions: [...post.interactions, interaction] };
            }),
          })),
        };
      });
      return { previous };
    },
    onError: (_error, input, context) => {
      if (context?.previous) qc.setQueryData(noodleKeys.viewer(input.personaId), context.previous);
    },
    onSettled: (_result, _error, input) => qc.invalidateQueries({ queryKey: noodleKeys.viewer(input.personaId) }),
  });
}

export function useTriggerNoodlerCreatorReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, interactionId, personaId }: { postId: string; interactionId: string; personaId: string }) =>
      api.post<NoodlerCreatorReplyResult>(
        `/slurp2/noodler/posts/${encodeURIComponent(postId)}/interactions/${encodeURIComponent(interactionId)}/creator-reply`,
        { personaId, debugMode: useSlurpUIStore.getState().debugMode },
      ),
    onSettled: (_result, _error, input) => qc.invalidateQueries({ queryKey: noodleKeys.viewer(input.personaId) }),
  });
}

export function useRemoveNoodlerInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      postId,
      actorAccountId: _actorAccountId,
      ...input
    }: { postId: string; actorAccountId?: string } & NoodlerRemoveInteractionInput) => {
      const params = new URLSearchParams({
        personaId: input.personaId,
        type: input.type,
      });
      if (input.parentInteractionId) params.set("parentInteractionId", input.parentInteractionId);
      return api.delete<NoodleInteraction>(
        `/slurp2/noodler/posts/${encodeURIComponent(postId)}/interactions?${params}`,
      );
    },
    onMutate: async (input) => {
      if (input.type !== "like") return undefined;
      await qc.cancelQueries({ queryKey: noodleKeys.viewer(input.personaId) });
      const previous = qc.getQueryData<NoodlerViewerScope>(noodleKeys.viewer(input.personaId));
      qc.setQueryData<NoodlerViewerScope | undefined>(noodleKeys.viewer(input.personaId), (current) => {
        if (!current) return current;
        return {
          ...current,
          creators: current.creators.map((creator) => ({
            ...creator,
            posts: creator.posts.map((post) =>
              post.id !== input.postId
                ? post
                : {
                    ...post,
                    interactions: post.interactions.filter(
                      (interaction) =>
                        !(
                          interaction.actorAccountId === (input.actorAccountId ?? input.personaId) &&
                          interaction.type === input.type &&
                          (interaction.parentInteractionId ?? null) === (input.parentInteractionId ?? null)
                        ),
                    ),
                  },
            ),
          })),
        };
      });
      return { previous };
    },
    onError: (_error, input, context) => {
      if (context?.previous) qc.setQueryData(noodleKeys.viewer(input.personaId), context.previous);
    },
    onSettled: (_result, _error, input) => qc.invalidateQueries({ queryKey: noodleKeys.viewer(input.personaId) }),
  });
}

export function useUpdateNoodlerPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, accountId, ...input }: { id: string; accountId: string } & NoodlerPostUpdateInput) =>
      api.patch<NoodlerManagedPost>(`/slurp2/noodler/posts/${encodeURIComponent(id)}`, { ...input, accountId }),
    onSuccess: (_post, input) => {
      return Promise.all([
        qc.invalidateQueries({
          queryKey: noodleKeys.noodlerPosts(input.accountId),
        }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
      ]);
    },
  });
}

export function useReplaceNoodlerPostImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      accountId,
      file,
      crop,
      ...input
    }: {
      id: string;
      accountId: string;
      file: File;
      crop: NoodlePostImageCrop;
    } & Omit<NoodlerPostUpdateInput, "imageCrop" | "removeImage">) => {
      const form = new FormData();
      form.append("payload", JSON.stringify({ ...input, imageCrop: crop, accountId }));
      form.append("file", file);
      return api.upload<NoodlerManagedPost>(`/slurp2/noodler/posts/${encodeURIComponent(id)}/media`, form);
    },
    onSuccess: (_post, input) =>
      Promise.all([
        qc.invalidateQueries({
          queryKey: noodleKeys.noodlerPosts(input.accountId),
        }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
      ]),
  });
}

export function useGenerateNoodlerPostImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, accountId, imagePrompt }: { id: string; accountId: string; imagePrompt?: string }) =>
      api.post<NoodlerManagedPost>(`/slurp2/noodler/posts/${encodeURIComponent(id)}/image/generate`, {
        accountId,
        ...(imagePrompt ? { imagePrompt } : {}),
        replace: true,
        debugMode: useSlurpUIStore.getState().debugMode,
      }),
    onSuccess: (_post, input) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerPosts(input.accountId) }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
      ]),
  });
}

export function useDeleteNoodlerPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, accountId }: { id: string; accountId: string }) =>
      api.delete<NoodlerManagedPost>(
        `/slurp2/noodler/posts/${encodeURIComponent(id)}?accountId=${encodeURIComponent(accountId)}`,
      ),
    onSuccess: (_post, input) => {
      return Promise.all([
        qc.invalidateQueries({
          queryKey: noodleKeys.noodlerPosts(input.accountId),
        }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
      ]);
    },
  });
}

export function useUpdateNoodlerInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      postId,
      interactionId,
      personaId,
      ...input
    }: {
      postId: string;
      interactionId: string;
      personaId: string;
      content?: string | null;
      imageUrl?: string | null;
    }) =>
      api.patch<NoodleInteraction>(
        `/slurp2/noodler/posts/${encodeURIComponent(postId)}/interactions/${encodeURIComponent(interactionId)}`,
        { personaId, ...input },
      ),
    onSuccess: (_interaction, input) => qc.invalidateQueries({ queryKey: noodleKeys.viewer(input.personaId) }),
  });
}

export function useDeleteNoodlerInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, interactionId, personaId }: { postId: string; interactionId: string; personaId: string }) =>
      api.delete<NoodleInteraction[]>(
        `/slurp2/noodler/posts/${encodeURIComponent(postId)}/interactions/${encodeURIComponent(interactionId)}?personaId=${encodeURIComponent(personaId)}`,
      ),
    onSuccess: (_deleted, input) => qc.invalidateQueries({ queryKey: noodleKeys.viewer(input.personaId) }),
  });
}

export function useUpdateNoodlerAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, ...access }: { accountId: string; hiddenFromAccountIds: string[] }) =>
      api.patch<NoodleAccount>(`/slurp2/accounts/${encodeURIComponent(accountId)}/settings`, {
        subtree: "privacy",
        patch: { access },
      } satisfies NoodleAccountSettingsPatchInput),
    onSuccess: () => {
      return Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerAccounts() }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
      ]);
    },
  });
}

export function useUpdateNoodlerAutoPosting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, ...autoPosting }: { accountId: string; enabled?: boolean; imagesEnabled?: boolean }) =>
      api.patch<NoodleAccount>(`/slurp2/accounts/${encodeURIComponent(accountId)}/settings`, {
        subtree: "scheduler",
        patch: { autoPosting },
      } satisfies NoodleAccountSettingsPatchInput),
    // Auto-post state lives only under noodlerAccounts(); the /slurp bootstrap has none of it.
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerAccounts() }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerReserveStatus() }),
      ]),
  });
}

export function useUpdateNoodlerFanActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, fanActivity }: { accountId: string; fanActivity: NoodlerFanActivitySettings | null }) =>
      api.patch<NoodleAccount>(`/slurp2/accounts/${encodeURIComponent(accountId)}/settings`, {
        subtree: "scheduler",
        patch: { fanActivity },
      } satisfies NoodleAccountSettingsPatchInput),
    onSuccess: () => qc.invalidateQueries({ queryKey: noodleKeys.noodlerAccounts() }),
  });
}

export function useNoodlerReserveStatus(enabled = true) {
  return useQuery({
    queryKey: noodleKeys.noodlerReserveStatus(),
    queryFn: () => api.get<SlurpReserveStatus>("/slurp2/noodler/auto-post/status"),
    enabled,
    // The scheduler prepares posts on its own timer, so nothing here invalidates this key when
    // the counts change. Same 30s cadence the creator list already uses.
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}

export function useUpdateNoodlerScheduleSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slotId, publishAt }: { slotId: string; publishAt: string }) =>
      api.patch<SlurpReserveStatus>(`/slurp2/noodler/auto-post/schedule/${encodeURIComponent(slotId)}`, {
        publishAt,
      }),
    onSuccess: (status) => qc.setQueryData(noodleKeys.noodlerReserveStatus(), status),
  });
}

export function useRefreshNoodlerConversationSchedule() {
  const qc = useQueryClient();
  const { t: localizeUi } = useUiTranslation();
  // Toasts live here, not in mutate() callbacks: those are dropped if the caller unmounts first.
  return useMutation({
    mutationFn: (accountId: string) =>
      api.post<{ state: "active"; blocks: number }>(
        `/slurp2/noodler/accounts/${encodeURIComponent(accountId)}/conversation-schedule/refresh`,
      ),
    onSuccess: () => {
      toast.success(localizeUi("ui.slurp.settings.creators.scheduleRefreshed"));
      return qc.invalidateQueries({ queryKey: noodleKeys.noodlerAccounts() });
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : localizeUi("ui.slurp.settings.creators.scheduleRefreshFailed"),
      ),
  });
}

export function useRunNoodlerAutoPostNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) =>
      api.post<NoodlerManagedPost>(`/slurp2/noodler/accounts/${encodeURIComponent(accountId)}/auto-post/run-now`),
    onSuccess: (_post, accountId) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerPosts(accountId) }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
      ]),
  });
}

export function useRefreshTargetedNoodlerCreatorsNow(onRemaining?: (remaining: number) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { accountIds: string[]; executionId?: string; access?: "public" | "locked" }) =>
      refreshSlurpCreatorBatch(
        input.accountIds,
        (accountId) =>
          api.post<{ outcomes: NoodlerRefreshNowOutcome[] }>("/slurp2/noodler/auto-post/refresh-targeted", {
            ...input,
            accountIds: [accountId],
          }),
        onRemaining,
      ),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerAccounts() }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerReserveStatus() }),
        qc.invalidateQueries({
          queryKey: [...noodleKeys.noodlerRoot(), "posts"],
        }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
      ]),
  });
}

export type NoodlerFirstPostJob = {
  id: string;
  executionId: string;
  accountId: string;
  status: "queued" | "running" | "generated" | "skipped" | "failed";
  attempts: number;
  postId: string | null;
  error: string | null;
};

export function useEnqueueNoodlerFirstPosts() {
  return useMutation({
    mutationFn: (input: { executionId: string; accountIds: string[] }) =>
      api.post<{ jobs: NoodlerFirstPostJob[] }>("/slurp2/noodler/first-posts/enqueue", input),
  });
}

export function useNoodlerFirstPostStatus(executionId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...noodleKeys.noodlerRoot(), "first-posts", executionId ?? "none"],
    queryFn: () =>
      api.get<{ jobs: NoodlerFirstPostJob[]; complete: boolean }>(
        `/slurp2/noodler/first-posts/status?executionId=${encodeURIComponent(executionId!)}`,
      ),
    enabled: enabled && Boolean(executionId),
    staleTime: 0,
    refetchInterval: enabled && executionId ? 2_000 : false,
    refetchIntervalInBackground: false,
    retry: false,
  });
}

export function useRefreshNoodlerFanActivityNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ status: string; created: number }>("/slurp2/noodler/fan-activity/refresh-now", {
        debugMode: useSlurpUIStore.getState().debugMode,
      }),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({
          queryKey: [...noodleKeys.noodlerRoot(), "posts"],
        }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerFanStatus() }),
      ]),
  });
}

export function useNoodlerFanActivityStatus(enabled = true) {
  return useQuery({
    queryKey: noodleKeys.noodlerFanStatus(),
    queryFn: () =>
      api.get<{
        localDate: string;
        usedRuns: number;
        runLimit: number;
        lastRun: { status: string; finishedAt: string | null } | null;
      }>("/slurp2/noodler/fan-activity/status"),
    enabled,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}

// ──────────────────────────────────────────────
// Direct messages
// ──────────────────────────────────────────────

export type SlurpDmPolicy = "open" | "subscribers" | "paid" | "closed";

export type SlurpRapportContribution = {
  key: string;
  detail: string;
  weight: number;
  points: number;
};

export type SlurpRapport = {
  score: number;
  tier: "stranger" | "acquaintance" | "regular" | "favourite" | "whale";
  contributions: SlurpRapportContribution[];
};

export type SlurpCreatorMessaging = {
  dmPolicy: SlurpDmPolicy;
  requestFee: number;
  ppvPrice: number;
  rapportWeights: Record<string, number>;
  proactiveMessages: boolean;
  unlockPrice: number | null;
  commissionBase: number;
  commissionMin: number;
  commissionMax: number;
  autoQuote: boolean;
  pricedAt: string | null;
};

export type SlurpMessage = {
  id: string;
  threadId: string;
  senderAccountId: string;
  role: "viewer" | "creator";
  kind:
    | "text"
    | "tip"
    | "ppv"
    | "system"
    | "broadcast"
    | "post_preview"
    | "commission_brief"
    | "commission_quote"
    | "commission_delivery";
  content: string;
  imageUrl: string | null;
  price: number;
  unlockedAt: string | null;
  readAt: string | null;
  metadata: Record<string, unknown>;
  senderSnapshot: Record<string, unknown>;
  createdAt: string;
};

export type SlurpThread = {
  id: string;
  viewerAccountId: string;
  creatorAccountId: string;
  state: "request" | "active" | "declined";
  openedBy: "viewer" | "creator";
  requestFeePaid: number;
  /** When this conversation was last emptied. Anything older is hidden from the chat. */
  clearedAt?: string | null;
  lastMessageAt: string;
  lastMessagePreview: string;
  viewerUnread: number;
  creatorUnread: number;
  needsReply: boolean;
  generationEpoch: number;
  rapport: SlurpRapport;
  createdAt: string;
  updatedAt: string;
  creatorHandle: string;
  creatorDisplayName: string;
  creatorAvatarUrl: string | null;
  counterpartName?: string | null;
  counterpartHandle?: string | null;
  subscribed: boolean;
};

export type SlurpCommission = {
  id: string;
  threadId: string;
  viewerAccountId: string;
  creatorAccountId: string;
  state: "brief" | "quoted" | "accepted" | "declined" | "delivered";
  brief: string;
  price: number;
  deliveryMessageId: string | null;
  /** When a character Creator's finished piece is due to arrive. Null when a person delivers it. */
  deliverAt?: string | null;
  /** A fan's pending counter-offer, waiting for the Creator. */
  counterPrice?: number | null;
  haggleRounds?: number;
  /** What the Creator's own pricing would quote for this brief. */
  suggestedPrice?: number;
  createdAt: string;
  updatedAt: string;
};

export type SlurpSendResponse = {
  thread: SlurpThread;
  message: SlurpMessage;
  reply: SlurpMessage | null;
  replyStatus: string;
  typingMs?: number;
  tipError?: string | null;
};

/**
 * What the info panel shows, and it is not the same on both sides.
 *
 * The fan gets words. `slurp-rapport.ts` is explicit that the score never reaches a thread,
 * because a meter invites the player to farm it. The Creator's operator gets every number,
 * because that side is a business rather than a relationship.
 */
export type SlurpThreadRelationship = {
  side: "viewer" | "creator";
  tier: string;
  score: number;
  contributions: { key: string; detail: string; weight: number; points: number }[];
  mood: number;
  strikes: number;
  notes: { id: string; text: string; tier: "working" | "longterm" }[];
  spentCoins: number;
  coolUntil: string | null;
  dayVibe: string | null;
  availability: {
    online: boolean;
    activity: string | null;
    minutesUntilOnline: number | null;
    estimated?: boolean;
  };
  audienceTone: "warm" | "mixed" | "unfiltered";
  imageMode: "friendly" | "hostile" | "none";
  creatorState: {
    emotion: string;
    emotionIntensity: number;
    energy: number;
    arousal: number;
    exposure: number;
    intent: string;
    modifiers: Array<{ kind: string; until: string; source: string }>;
    updatedAt: string;
  };
  threadState: {
    posture: string;
    familiarity: number;
    sexualComfort: number;
    emotionalTrust: number;
    respect: number;
    resentment: number;
    threadDesire: number;
    adultLevel: string;
    updatedAt: string;
  };
  scheduledFollowUps: Array<{
    id: string;
    scheduledAt: string;
    type: string;
    reason: string;
    context: string;
    sequenceNumber?: number;
    totalInSequence?: number;
  }>;
};

export type SlurpPromptDebug = {
  stance: Record<string, unknown>;
  thread: Record<string, unknown>;
  audienceTone: string;
  prompt: Array<{ role: string; content: string }>;
};

const messageKeys = {
  /** Every messaging query hangs off this, so one prefix invalidates the whole surface. */
  root: () => [...noodleKeys.noodlerRoot(), "messages"],
  threads: (personaId: string | null) => [...noodleKeys.noodlerRoot(), "messages", "threads", personaId ?? "none"],
  thread: (threadId: string, personaId: string | null) => [
    ...noodleKeys.noodlerRoot(),
    "messages",
    "thread",
    threadId,
    personaId ?? "none",
  ],
};

/**
 * What a message or commission mutation actually changes.
 *
 * These used to invalidate the whole Slurp root, which re-ran the viewer feed and every profile's
 * post list — and both of those page through the entire history in one request. Sending one chat
 * line refetched the app.
 */
const invalidateSlurpMessages = (qc: ReturnType<typeof useQueryClient>) =>
  Promise.all(
    [
      messageKeys.root(),
      [...noodleKeys.noodlerRoot(), "wallet"],
      [...noodleKeys.noodlerRoot(), "viewer-wallets"],
      [...noodleKeys.noodlerRoot(), "notifications"],
    ].map((queryKey) => qc.invalidateQueries({ queryKey })),
  );

export function useSlurpThreads(personaId: string | null) {
  return useQuery({
    queryKey: messageKeys.threads(personaId),
    queryFn: () =>
      api.get<{
        threads: Array<SlurpThread & { side: "viewer" }>;
        inbound: Array<
          SlurpThread & { side: "creator"; counterpartName: string | null; counterpartHandle: string | null }
        >;
        unread: number;
        inboundUnread: number;
        attentionCommissions: Array<SlurpCommission & { side: "viewer" | "creator" }>;
      }>(`/slurp2/messages/threads?personaId=${encodeURIComponent(personaId!)}`),
    enabled: Boolean(personaId),
    // A creator who is offline answers minutes or hours later, through the scheduler. Without a
    // poll that reply only appeared once some other mutation happened to invalidate the cache,
    // so the whole off-hours pacing model was invisible while the app was open.
    refetchInterval: personaId ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
}

export function useSlurpThread(threadId: string | null, personaId: string | null) {
  return useQuery({
    queryKey: messageKeys.thread(threadId ?? "none", personaId),
    queryFn: () =>
      api.get<{
        thread: SlurpThread;
        messages: SlurpMessage[];
        nextCursor: { createdAt: string; id: string } | null;
        creator: { id: string; handle: string; displayName: string; avatarUrl: string | null } | null;
        counterpart: { id: string; handle: string; displayName: string; avatarUrl: string | null } | null;
        creatorLastActiveAt: string | null;
        creatorLastMessageAt: string | null;
        creatorAutoPosting: boolean;
        creatorAvailability?: {
          online: boolean;
          activity: string | null;
          minutesUntilOnline: number | null;
          estimated?: boolean;
        };
        messaging: SlurpCreatorMessaging;
        commissions: SlurpCommission[];
        subscribed?: boolean;
        relationship?: SlurpThreadRelationship;
      }>(`/slurp2/messages/threads/${encodeURIComponent(threadId!)}?personaId=${encodeURIComponent(personaId!)}`),
    enabled: Boolean(threadId && personaId),
    refetchInterval: threadId && personaId ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
}

export function useSlurpOlderMessages() {
  return useMutation({
    mutationFn: (input: { threadId: string; personaId: string; cursor: { createdAt: string; id: string } }) =>
      api.get<{
        messages: SlurpMessage[];
        nextCursor: { createdAt: string; id: string } | null;
      }>(
        `/slurp2/messages/threads/${encodeURIComponent(input.threadId)}?personaId=${encodeURIComponent(input.personaId)}&cursorAt=${encodeURIComponent(input.cursor.createdAt)}&cursorId=${encodeURIComponent(input.cursor.id)}`,
      ),
  });
}

export function useSlurpMessagePrompt(threadId: string | null, personaId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...messageKeys.thread(threadId ?? "none", personaId), "prompt"],
    queryFn: () =>
      api.get<SlurpPromptDebug>(
        `/slurp2/messages/threads/${encodeURIComponent(threadId!)}/prompt?personaId=${encodeURIComponent(personaId!)}`,
      ),
    enabled: enabled && Boolean(threadId && personaId),
    staleTime: 0,
  });
}

/**
 * The conversation with one creator, started or not. Used when the player opens a chat from a
 * profile, where there may be no thread yet and creating one on sight would charge a fee.
 */
export function useSlurpCompose(creatorAccountId: string | null, personaId: string | null) {
  return useQuery({
    queryKey: [...noodleKeys.noodlerRoot(), "messages", "compose", creatorAccountId ?? "none", personaId ?? "none"],
    queryFn: () =>
      api.get<{
        thread: SlurpThread | null;
        messages: SlurpMessage[];
        nextCursor: { createdAt: string; id: string } | null;
        creator: { id: string; handle: string; displayName: string; avatarUrl: string | null } | null;
        creatorLastActiveAt?: string | null;
        creatorLastMessageAt?: string | null;
        creatorAutoPosting?: boolean;
        creatorAvailability?: {
          online: boolean;
          activity: string | null;
          minutesUntilOnline: number | null;
          estimated?: boolean;
        };
        messaging: SlurpCreatorMessaging;
        commissions: SlurpCommission[];
        subscribed?: boolean;
        relationship?: SlurpThreadRelationship;
      }>(
        `/slurp2/messages/compose?personaId=${encodeURIComponent(personaId!)}&creatorAccountId=${encodeURIComponent(creatorAccountId!)}`,
      ),
    enabled: Boolean(creatorAccountId && personaId),
    // Same poll as `useSlurpThread`. Without it a chat opened from a profile never saw the
    // queued off-hours reply, which is most of what the pacing model exists to produce.
    refetchInterval: creatorAccountId && personaId ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
}

export function useSendSlurpMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      personaId: string;
      creatorAccountId: string;
      content: string;
      requestId?: string;
      tip?: { amount: number; note?: string } | null;
    }) => api.post<SlurpSendResponse>("/slurp2/messages/send", input),
    onSuccess: () => invalidateSlurpMessages(queryClient),
  });
}

/** Answer a queued conversation now. The server still applies every guard a normal send does. */
export function useForceSlurpReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { personaId: string; threadId: string }) =>
      api.post<Omit<SlurpSendResponse, "message" | "tipError">>(
        `/slurp2/messages/threads/${encodeURIComponent(input.threadId)}/force-reply`,
        { personaId: input.personaId },
      ),
    onSuccess: () => invalidateSlurpMessages(queryClient),
  });
}

export function useTipInSlurpThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      personaId: string;
      creatorAccountId: string;
      amount: number;
      note?: string;
      requestId?: string;
    }) => api.post<SlurpSendResponse & { wallet: SlurpWallet }>("/slurp2/messages/tip", input),
    onSuccess: () => invalidateSlurpMessages(queryClient),
  });
}

export function useUnlockSlurpMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { personaId: string; messageId: string }) =>
      api.post<{ message: SlurpMessage; wallet: SlurpWallet }>("/slurp2/messages/ppv/unlock", input),
    onSuccess: () => invalidateSlurpMessages(queryClient),
  });
}

export function useReactToSlurpMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { personaId: string; messageId: string; reaction: "heart" | null }) =>
      api.post<{ message: SlurpMessage }>(`/slurp2/messages/${encodeURIComponent(input.messageId)}/reaction`, input),
    onSuccess: () => invalidateSlurpMessages(queryClient),
  });
}

/** Write as the Creator, in your own words. */
export function useSendSlurpCreatorReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { creatorAccountId: string; personaId: string; viewerAccountId: string; content: string }) =>
      api.post<{ message: SlurpMessage; thread: SlurpThread | null }>(
        `/slurp2/messages/creators/${encodeURIComponent(input.creatorAccountId)}/reply`,
        input,
      ),
    onSuccess: () => invalidateSlurpMessages(queryClient),
  });
}

/** Have the Creator draft a reply. The model is the fallback, not the default. */
export function useDraftSlurpCreatorReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { creatorAccountId: string; personaId: string; threadId: string }) =>
      api.post<{ message: SlurpMessage; thread: SlurpThread | null }>(
        `/slurp2/messages/creators/${encodeURIComponent(input.creatorAccountId)}/draft-reply`,
        input,
      ),
    onSuccess: () => invalidateSlurpMessages(queryClient),
  });
}

export function useSendSlurpCreatorPpv() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      creatorAccountId: string;
      personaId: string;
      viewerAccountId: string;
      content: string;
      price: number;
    }) =>
      api.post<{ message: SlurpMessage }>(
        `/slurp2/messages/creators/${encodeURIComponent(input.creatorAccountId)}/ppv`,
        input,
      ),
    onSuccess: () => invalidateSlurpMessages(queryClient),
  });
}

export function useSendSlurpCreatorImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      threadId: string;
      creatorAccountId: string;
      personaId: string;
      prompt: string;
      content: string;
      intent?: "friendly" | "hostile" | "premium";
    }) =>
      api.post<{ message: SlurpMessage }>(
        `/slurp2/messages/threads/${encodeURIComponent(input.threadId)}/image`,
        input,
      ),
    onSuccess: () => invalidateSlurpMessages(queryClient),
  });
}

export function useSendSlurpViewerImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      threadId: string;
      creatorAccountId: string;
      personaId: string;
      file: File;
      content: string;
    }) => {
      const form = new FormData();
      form.append("personaId", input.personaId);
      form.append("creatorAccountId", input.creatorAccountId);
      form.append("content", input.content);
      form.append("file", input.file);
      return api.upload<{ message: SlurpMessage; replyStatus: string }>(
        `/slurp2/messages/threads/${encodeURIComponent(input.threadId)}/image-upload`,
        form,
      );
    },
    onSuccess: () => invalidateSlurpMessages(queryClient),
  });
}

export function useGenerateSlurpViewerImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      threadId: string;
      creatorAccountId: string;
      personaId: string;
      prompt: string;
      content?: string;
    }) =>
      api.post<{ message: SlurpMessage; replyStatus: string }>(
        `/slurp2/messages/threads/${encodeURIComponent(input.threadId)}/viewer-image`,
        input,
      ),
    onSuccess: () => invalidateSlurpMessages(queryClient),
  });
}

export function useBroadcastSlurpMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { creatorAccountId: string; personaId: string; content: string }) =>
      api.post<{ sent: number }>(
        `/slurp2/messages/creators/${encodeURIComponent(input.creatorAccountId)}/broadcast`,
        input,
      ),
    onSuccess: () => invalidateSlurpMessages(queryClient),
  });
}

export function useCreateSlurpCommission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { personaId: string; creatorAccountId: string; brief: string }) =>
      api.post<{ commission: SlurpCommission }>("/slurp2/messages/commissions", input),
    onSuccess: () => invalidateSlurpMessages(queryClient),
  });
}

export function useQuoteSlurpCommission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { commissionId: string; personaId: string; price: number }) =>
      api.post<{ commission: SlurpCommission }>(
        `/slurp2/messages/commissions/${encodeURIComponent(input.commissionId)}/quote`,
        input,
      ),
    onSuccess: () => invalidateSlurpMessages(queryClient),
  });
}

/** Offer the Creator a lower price than its quote. */
export function useCounterSlurpCommission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { commissionId: string; personaId: string; price: number }) =>
      api.post<{ commission: SlurpCommission }>(
        `/slurp2/messages/commissions/${encodeURIComponent(input.commissionId)}/counter`,
        input,
      ),
    onSuccess: () => invalidateSlurpMessages(queryClient),
  });
}

export function useAcceptSlurpCommission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { commissionId: string; personaId: string }) =>
      api.post<{ commission: SlurpCommission }>(
        `/slurp2/messages/commissions/${encodeURIComponent(input.commissionId)}/accept`,
        input,
      ),
    onSuccess: () => invalidateSlurpMessages(queryClient),
  });
}

/** Either side ends an unpaid commission: the Creator declines, the fan withdraws. */
export function useDeclineSlurpCommission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { commissionId: string; personaId: string }) =>
      api.post<{ commission: SlurpCommission }>(
        `/slurp2/messages/commissions/${encodeURIComponent(input.commissionId)}/decline`,
        input,
      ),
    onSuccess: () => invalidateSlurpMessages(queryClient),
  });
}

export function useDeliverSlurpCommission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { commissionId: string; personaId: string; content: string; generateImage?: boolean }) =>
      api.post<{ commission: SlurpCommission }>(
        `/slurp2/messages/commissions/${encodeURIComponent(input.commissionId)}/deliver`,
        input,
      ),
    onSuccess: () => invalidateSlurpMessages(queryClient),
  });
}

export function useRecordSlurpStoryView() {
  return useMutation({
    mutationFn: (input: { storyId: string; personaId: string }) =>
      api.post<{ viewed: boolean; duplicate: boolean }>(
        `/slurp2/noodler/stories/${encodeURIComponent(input.storyId)}/view`,
        { personaId: input.personaId },
      ),
  });
}

export function useSlurpStoryViews(storyId: string | null, personaId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...noodleKeys.noodlerRoot(), "story-views", storyId ?? "none", personaId ?? "none"],
    queryFn: () =>
      api.get<{ count: number; viewers: Array<{ id: string; displayName: string; handle: string }> }>(
        `/slurp2/noodler/stories/${encodeURIComponent(storyId!)}/views?personaId=${encodeURIComponent(personaId!)}`,
      ),
    enabled: enabled && Boolean(storyId && personaId),
  });
}

export function useResolveSlurpMessageRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { threadId: string; personaId: string; decision: "accept" | "decline" }) =>
      api.post<{ thread: SlurpThread }>(
        `/slurp2/messages/threads/${encodeURIComponent(input.threadId)}/request`,
        input,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerRoot() }),
  });
}

/** Empty one conversation. Every message goes; what the fan paid for does not. */
export function useResetSlurpThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { threadId: string; personaId: string }) =>
      api.post<{ thread: SlurpThread }>(`/slurp2/messages/threads/${encodeURIComponent(input.threadId)}/reset`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerRoot() }),
  });
}

/**
 * Rewrite what the creator remembers about this fan.
 *
 * The whole list goes up, because the panel edits it as a list. The server normalizes and caps it
 * the same way it does the creator's own memory writes.
 */
export function useSetSlurpThreadNotes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      threadId: string;
      personaId: string;
      notes: { id?: string; text: string; tier: "working" | "longterm" }[];
    }) =>
      api.put<{ notes: { id: string; text: string; tier: "working" | "longterm" }[] }>(
        `/slurp2/messages/threads/${encodeURIComponent(input.threadId)}/notes`,
        { personaId: input.personaId, notes: input.notes },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerRoot() }),
  });
}

export function useCancelSlurpFollowUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { threadId: string; followUpId: string; personaId: string }) =>
      api.post<{ success: boolean }>(
        `/slurp2/messages/threads/${encodeURIComponent(input.threadId)}/cancel-follow-up`,
        {
          followUpId: input.followUpId,
          personaId: input.personaId,
        },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerRoot() }),
  });
}

/** The rapport breakdown, read only by the Creator edit panel. */
export function useSlurpRapport(creatorAccountId: string | null, personaId: string | null) {
  return useQuery({
    queryKey: [...noodleKeys.noodlerRoot(), "messages", "rapport", creatorAccountId ?? "none", personaId ?? "none"],
    queryFn: () =>
      api.get<{ messaging: SlurpCreatorMessaging; rapport: SlurpRapport; facts: Record<string, unknown> }>(
        `/slurp2/messages/creators/${encodeURIComponent(creatorAccountId!)}/rapport?personaId=${encodeURIComponent(personaId!)}`,
      ),
    enabled: Boolean(creatorAccountId && personaId),
  });
}

/** A Creator's own message policy and prices, for the panel that edits them. */
export function useSlurpCreatorMessagingSettings(creatorAccountId: string | null, personaId: string | null) {
  return useQuery({
    queryKey: [
      ...noodleKeys.noodlerRoot(),
      "messages",
      "creator-settings",
      creatorAccountId ?? "none",
      personaId ?? "none",
    ],
    queryFn: () =>
      api.get<{
        messaging: SlurpCreatorMessaging;
        subscriptionPrice: number;
        suggested?: { subscriptionPrice: number; unlockPrice: number; commissionBase: number };
      }>(
        `/slurp2/messages/creators/${encodeURIComponent(creatorAccountId!)}/settings?personaId=${encodeURIComponent(personaId!)}`,
      ),
    enabled: Boolean(creatorAccountId && personaId),
  });
}

export function useSetSlurpCreatorMessaging() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { creatorAccountId: string; personaId: string } & Partial<SlurpCreatorMessaging>) => {
      const { creatorAccountId, ...patch } = input;
      return api.patch<{ messaging: SlurpCreatorMessaging }>(
        `/slurp2/messages/creators/${encodeURIComponent(creatorAccountId)}/settings`,
        patch,
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerRoot() }),
  });
}
