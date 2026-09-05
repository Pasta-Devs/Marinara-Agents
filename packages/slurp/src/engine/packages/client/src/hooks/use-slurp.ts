// ──────────────────────────────────────────────
// React Query: Noodle hooks
// ──────────────────────────────────────────────
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTranslation as useUiTranslation } from "react-i18next";
import { api } from "../lib/api-client";
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
  noodlerViewers: () => [...noodleKeys.noodlerRoot(), "viewers"] as const,
  viewer: (personaId: string) => [...noodleKeys.noodlerViewers(), personaId] as const,
  noodlerUnseenCount: (personaId: string) => [...noodleKeys.noodlerViewers(), "unseen-count", personaId] as const,
  noodlerReserveStatus: () => [...noodleKeys.noodlerRoot(), "reserve-status"] as const,
  noodlerImageConnections: () => [...noodleKeys.noodlerRoot(), "image-connections"] as const,
  noodlerFanStatus: () => [...noodleKeys.noodlerRoot(), "fan-status"] as const,
  // contextTags belongs in the key: it is part of the request, so leaving it
  // out meant switching tab or crossing into evening never refetched.
  ads: (personaId: string, creatorId?: string | null, contextTags: string[] = []) =>
    [...noodleKeys.noodlerViewers(), "ads", personaId, creatorId ?? "none", contextTags.join(",")] as const,
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
        `/slurp/noodler/viewer/ads?personaId=${encodeURIComponent(personaId!)}${creatorId ? `&creatorId=${encodeURIComponent(creatorId)}` : ""}${contextTags.length ? `&contextTags=${encodeURIComponent(contextTags.join(","))}` : ""}`,
      ),
    enabled: Boolean(personaId),
    staleTime: 60_000,
  });
}

export function useHideSlurpAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ personaId, promotionId }: { personaId: string; promotionId: string }) =>
      api.post(`/slurp/noodler/viewer/ads/${encodeURIComponent(promotionId)}/hide`, { personaId }),
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
      api.post(`/slurp/noodler/viewer/ads/${encodeURIComponent(promotionId)}/action`, { personaId }),
  });
}

export function useHideSlurpAdBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ personaId, brand }: { personaId: string; brand: string }) =>
      api.post(`/slurp/noodler/viewer/ads/brand/hide`, { personaId, brand }),
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
      api.post(`/slurp/noodler/viewer/ads/brand/unhide`, { personaId, brand }),
    onSuccess: (_state, input) => qc.invalidateQueries({ queryKey: noodleKeys.adState(input.personaId) }),
  });
}

export function useSlurpAdState(personaId: string | null) {
  return useQuery({
    queryKey: noodleKeys.adState(personaId ?? "none"),
    queryFn: () =>
      api.get<{ hiddenBrands: string[]; hidden: SlurpPromotion[]; seen: SlurpPromotion[] }>(
        `/slurp/noodler/viewer/ads/state?personaId=${encodeURIComponent(personaId!)}`,
      ),
    enabled: Boolean(personaId),
  });
}

export function useSlurpAdPool() {
  return useQuery({
    queryKey: noodleKeys.adPool(),
    queryFn: () => api.get<{ items: SlurpPromotion[] }>(`/slurp/noodler/ads/pool`),
  });
}

export function useGenerateSlurpAds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (count?: number) =>
      api.post<{ items: SlurpPromotion[]; retired: string[]; images: number }>(`/slurp/noodler/ads/generate`, {
        count,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: noodleKeys.adPool() });
      void qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() });
    },
  });
}

export function useDeleteSlurpAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (promotionId: string) => api.delete(`/slurp/noodler/ads/pool/${encodeURIComponent(promotionId)}`),
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
      api.post<{ ad: SlurpPromotion }>(`/slurp/noodler/ads/${encodeURIComponent(promotionId)}/image`, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: noodleKeys.adPool() });
      void qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() });
    },
  });
}

export function useSlurpAdLorebooks(enabled: boolean) {
  return useQuery({
    queryKey: [...noodleKeys.adPool(), "lorebooks"],
    queryFn: () => api.get<{ items: { id: string; name: string }[] }>(`/slurp/noodler/ads/lorebooks`),
    enabled,
  });
}

export function useSyncSlurpAdLorebook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (force?: boolean) =>
      api.post<{ outcome: "disabled" | "unchanged" | "missing" | "synced" }>(`/slurp/noodler/ads/lorebook/sync`, {
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
      api.post<{ imported: number; events: number }>(`/slurp/noodler/ads/import`, { mode: "merge", payload }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: noodleKeys.adPool() });
      void qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() });
    },
  });
}

export function useResetSlurpAds() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (personaId: string) => api.post(`/slurp/noodler/viewer/ads/reset`, { personaId }),
    onSuccess: (_state, personaId) => queryClient.invalidateQueries({ queryKey: noodleKeys.ads(personaId) }),
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
  inlineAdsLorebookId: string | null;
  inlineAdsLorebookRevision: string | null;
  walletEnabled: boolean;
  walletUnlockCost: number;
  walletSubscriptionCost: number;
  walletStipendFloor: number;
  walletAdReward: number;
  walletAdDailyCap: number;
  walletEngagementReward: number;
  walletEngagementDailyCap: number;
  walletCreatorRevenueSharePercent: number;
  imageWidth: number;
  imageHeight: number;
  refreshesPerDay: number;
  generationGuidance: string;
  audienceTone: "warm" | "mixed" | "unfiltered";
  postsPerDay: number;
  autoPostingScheduleEnabled: boolean;
  autoPostGenerationMode: "pre_generate" | "on_demand";
  fanActivityEnabled: boolean;
  generationConnectionId: string | null;
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
  carryoverModes: Array<"conversation" | "roleplay" | "game">;
  carryoverHours: number;
  carryoverMaxItems: number;
  enableEnhancedTimelineWriting: boolean;
  includeCharacterSchedules: boolean;
  enableLorebookContext: boolean;
  enableImagePrompts: boolean;
  maxImagesPerRefresh: number;
  maxGeneratedPostsPerRefresh: number;
  maxLikesPerRefresh: number;
  maxRepostsPerRefresh: number;
  maxRepliesPerRefresh: number;
  allowGalleryImageAttachments: boolean;
  fanActivityRunsPerDay: number;
  fanLikesPerRefresh: number;
  fanRepliesPerRefresh: number;
  fanRepostsPerRefresh: number;
  fanArchetypeWeights: Record<string, number>;
  nightQuiet: boolean;
  onboarding: "not_started" | "in_progress" | "completed";
};

export type SlurpSettingsUpdate = Partial<SlurpSettings>;

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
    queryFn: () => api.get<SlurpSettings>("/slurp/settings"),
    staleTime: 10_000,
  });
}

export function useUpdateSlurpSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: SlurpSettingsUpdate) => api.patch<SlurpSettings>("/slurp/settings", patch),
    onSuccess: (settings) => {
      queryClient.setQueryData(noodleKeys.settings(), settings);
      return queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerFanStatus() });
    },
  });
}

export function useDeleteAllSlurpData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<{ deletedCreators: number; deletedPosts: number }>("/slurp/data"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noodleKeys.all }),
  });
}

export function useDeleteUnusedSlurpData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.delete<{ deletedPreparedPosts: number; deletedAttempts: number; deletedRuns: number }>("/slurp/data/unused"),
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
    queryFn: () => api.get<SlurpImageConnections>("/slurp/noodler/image-connections"),
    enabled,
    staleTime: 10_000,
  });
}

export function useUpdateSlurpImageConnections() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: { defaultConnectionId?: string | null; creatorId?: string; connectionId?: string | null }) =>
      api.patch<SlurpImageConnections>("/slurp/noodler/image-connections", patch),
    onSuccess: (value) => qc.setQueryData(noodleKeys.noodlerImageConnections(), value),
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
      api.get<Array<NoodlerManagedStageProfile & { scheduleStatus?: SlurpScheduleStatus }>>("/slurp/noodler/accounts"),
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
  | "milestone";

export type SlurpEventItem = {
  id: string;
  kind: SlurpEventKind;
  creatorAccountId: string | null;
  subjectId: string | null;
  actorLabel: string | null;
  amount: number;
  weight: number;
  createdAt: string;
  seenAt: string | null;
};

export type SlurpEventGroup =
  | { type: "single"; event: SlurpEventItem }
  | { type: "group"; kind: SlurpEventKind; count: number; total: number; latestAt: string; ids: string[] };

/** The notification stream. `unseen` is what happened while you were away. */
export function useSlurpNotifications(personaId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...noodleKeys.noodlerRoot(), "notifications", personaId ?? "none"],
    queryFn: () =>
      api.get<{ items: SlurpEventGroup[]; unseen: SlurpEventGroup[]; unseenCount: number }>(
        `/slurp/noodler/notifications?personaId=${encodeURIComponent(personaId!)}`,
      ),
    enabled: Boolean(personaId) && enabled,
    staleTime: 15_000,
  });
}

export function useMarkSlurpNotificationsSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (personaId: string) => api.post<{ ok: boolean }>("/slurp/noodler/notifications/seen", { personaId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...noodleKeys.noodlerRoot(), "notifications"] }),
  });
}

/** Withdraw earnings into spending money. This is what connects the two seats you play. */
export function useSlurpPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ creatorAccountId, ...body }: { creatorAccountId: string; personaId: string; amount: number }) =>
      api.post<{ allowance: number }>(`/slurp/noodler/accounts/${encodeURIComponent(creatorAccountId)}/payout`, body),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: [...noodleKeys.noodlerRoot(), "studio"] }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
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
        `/slurp/noodler/accounts/${encodeURIComponent(creatorAccountId)}/goal`,
        body,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...noodleKeys.noodlerRoot(), "studio"] }),
  });
}

/** The Creator home. Reading it also re-marks the point future deltas are measured from. */
export function useSlurpStudio(personaId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...noodleKeys.noodlerRoot(), "studio", personaId ?? "none"],
    queryFn: () =>
      api.get<{ since: string | null; creators: SlurpStudioCreator[] }>(
        `/slurp/noodler/studio?personaId=${encodeURIComponent(personaId!)}`,
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
    queryFn: () => api.get<SlurpWallet>(`/slurp/noodler/viewer/wallet?personaId=${encodeURIComponent(personaId!)}`),
    enabled: Boolean(personaId),
  });
}

export function useClaimSlurpDailyRefill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { personaId: string }) =>
      api.post<SlurpWallet>("/slurp/noodler/viewer/wallet/daily-refill", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerRoot() }),
  });
}

export function useTipSlurpCreator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { accountId: string; personaId: string; amount: number }) =>
      api.post<SlurpWallet>(`/slurp/noodler/accounts/${encodeURIComponent(input.accountId)}/tip`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerRoot() }),
  });
}

/** Set a creator's own weekly price, or clear it back to the default with `null`. */
export function useSetSlurpCreatorPrice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { accountId: string; price: number | null }) =>
      api.put<{ price: number }>(`/slurp/noodler/accounts/${encodeURIComponent(input.accountId)}/subscription-price`, {
        price: input.price,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerRoot() }),
  });
}

export function useNoodlerViewerWallets(enabled = true) {
  return useQuery({
    queryKey: [...noodleKeys.noodlerRoot(), "viewer-wallets"],
    queryFn: () => api.get<NoodlerViewerWallets>("/slurp/noodler/viewer-wallets"),
    enabled,
    staleTime: 30_000,
  });
}

/** Fan and follower totals keyed by creator account id. */
export type NoodlerConnectionCounts = Record<string, { fans: number; followers: number }>;

export function useNoodlerConnectionCounts(enabled = true) {
  return useQuery({
    queryKey: noodleKeys.noodlerConnectionCounts(),
    queryFn: () => api.get<NoodlerConnectionCounts>("/slurp/noodler/account-connection-counts"),
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
        `/slurp/noodler/eligible-accounts?limit=100&offset=${pageParam}&search=${encodeURIComponent(normalizedSearch)}${kind === "all" ? "" : `&kind=${kind}`}${includeAccountId ? `&includeAccountId=${encodeURIComponent(includeAccountId)}` : ""}`,
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
    queryFn: async () => {
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
        } = await api.get(`/slurp/noodler/accounts/${encodeURIComponent(accountId!)}/posts?${query.toString()}`);
        items.push(...page.items);
        cursor = page.nextCursor;
      } while (cursor);
      return items;
    },
    enabled: Boolean(accountId),
    staleTime: 10_000,
    // Automatic posts are written server-side without a client mutation; poll while visible.
    refetchInterval: accountId ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
}

export function useNoodlerSubscribers(accountId: string | null) {
  return useInfiniteQuery({
    queryKey: noodleKeys.noodlerSubscribers(accountId ?? "none"),
    initialPageParam: null as SlurpPageCursor | null,
    queryFn: ({ pageParam }) =>
      api.get<{
        items: NoodlerSubscriber[];
        total: number;
        nextCursor: SlurpPageCursor | null;
      }>(`/slurp/noodler/accounts/${encodeURIComponent(accountId!)}/subscribers?limit=20${cursorQuery(pageParam)}`),
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
      stageProfile: NoodleStageProfileInput;
    }) =>
      api.post<NoodlerStageProfile>(`/slurp/accounts/${encodeURIComponent(sourceAccountId)}/noodler`, {
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
        created: NoodlerManagedStageProfile[];
        skipped: string[];
        failed?: string[];
        reasons?: { accountId: string; reason: string }[];
      }>("/slurp/noodler/accounts/bulk", input),
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
    } & NoodleStageProfileInput) =>
      api.put<NoodlerStageProfile>(`/slurp/noodler/accounts/${encodeURIComponent(accountId)}/stage-profile`, {
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
    return api.upload<NoodlerStageProfile>(`/slurp/noodler/accounts/${encodeURIComponent(accountId)}/avatar`, form);
  });
}

export function useUploadNoodlerBanner() {
  return useNoodlerAvatarMutation(({ accountId, file }: { accountId: string; file: File }) => {
    const form = new FormData();
    form.append("payload", "{}");
    form.append("file", file);
    return api.upload<NoodlerStageProfile>(`/slurp/noodler/accounts/${encodeURIComponent(accountId)}/banner`, form);
  });
}

export function useGenerateNoodlerArtwork() {
  return useNoodlerAvatarMutation(
    ({ accountId, kind, guidance }: { accountId: string; kind: "avatar" | "banner"; guidance?: string }) =>
      api.post<NoodlerStageProfile>(`/slurp/noodler/accounts/${encodeURIComponent(accountId)}/artwork/generate`, {
        kind,
        guidance,
      }),
  );
}

export function useUseNoodlerSourceAvatar() {
  return useNoodlerAvatarMutation(({ accountId }) =>
    api.patch<NoodlerStageProfile>(`/slurp/noodler/accounts/${encodeURIComponent(accountId)}/avatar/source`, {}),
  );
}

export function useRemoveNoodlerAvatar() {
  return useNoodlerAvatarMutation(({ accountId }) =>
    api.delete<NoodlerStageProfile>(`/slurp/noodler/accounts/${encodeURIComponent(accountId)}/avatar`),
  );
}

function useNoodlerSourceAction(action: "dismiss" | "adopt-identity") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) =>
      api.post<NoodlerManagedStageProfile>(
        `/slurp/noodler/accounts/${encodeURIComponent(accountId)}/source/${action}`,
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
      api.delete<NoodleAccount>(`/slurp/noodler/accounts/${encodeURIComponent(accountId)}`),
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
          NoodleStageProfileInput & {
            sourceSnapshot?: NoodlerSourceSnapshot;
            sourceRevisionToken?: string;
          }
        >("/slurp/noodler/stage-profile-draft", input, {
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
      api.post<NoodlePostDraft>(`/slurp/accounts/${encodeURIComponent(accountId)}/post-draft`, body),
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
    queryFn: () => api.get<{ allowRandomUsers: boolean; items: SlurpAmbientProfile[] }>("/slurp/ambient-profiles"),
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
      api.post<NoodleAmbientProfileRerollResult>("/slurp/ambient-profiles/reroll", { accountIds }),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerAccounts() }),
        qc.invalidateQueries({ queryKey: [...noodleKeys.noodlerRoot(), "ambient-profiles"] }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerEligibleAccountsRoot() }),
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

export type NoodlerContentFormat = "caption" | "teaser" | "announcement" | "long_form";

type NoodlerFormatRequest = {
  format?: NoodlerContentFormat;
  lockedFollowUpPostId?: string;
  lockedFollowUp?: { title: string; content: string };
};

type NoodlerCreatePostRequest = Omit<NoodlerPostCreateInput, "uploadedImageUrl" | "imageCrop"> & {
  image?: NoodlerPostDraftImage | null;
  postType?: "post" | "story";
  linkedPostId?: string | null;
} & NoodlerFormatRequest;

type NoodlerGeneratePostRequest = Omit<NoodlerGenerationRequest, "uploadedImageUrl" | "imageCrop"> & {
  image?: NoodlerPostDraftImage | null;
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
        "/slurp/refresh",
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
      api.post<{ finalized: number }>("/slurp/noodler/refresh/images", {
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
      postNoodlerRequestWithImage<NoodlerManagedPost>("/slurp/noodler/posts", input, image),
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
    queryFn: async () => {
      const encodedPersonaId = encodeURIComponent(personaId!);
      type ViewerPost = NoodlerViewerScope["creators"][number]["posts"][number] & { story?: boolean };
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
            post: NoodlerViewerScope["creators"][number]["posts"][number];
          }>;
          total: number;
          nextCursor: SlurpPageCursor | null;
        }>(`/slurp/noodler/viewer/feed?personaId=${encodedPersonaId}&tab=all&limit=20${cursorQuery(cursor)}`);
        feedItems.push(...page.items);
        cursor = page.nextCursor;
      } while (cursor);
      // Read the shell after the feed. A newly-created Creator account and its first post can
      // otherwise be observed from different file-store snapshots when these requests start
      // together, leaving the client with a post whose Creator is absent from the shell.
      const scope = await api.get<NoodlerViewerScope>(`/slurp/noodler/viewer?personaId=${encodedPersonaId}`);
      const postsByCreator = new Map<string, NoodlerViewerScope["creators"][number]["posts"]>();
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
    staleTime: 10_000,
    refetchOnMount: "always",
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
      api.get<{ count: number }>(`/slurp/noodler/viewer/unseen-count?personaId=${encodeURIComponent(personaId!)}`),
    enabled: enabled && Boolean(personaId),
    staleTime: 10_000,
    refetchInterval: enabled && personaId ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
  const count = Math.max(0, Math.floor(data?.count ?? 0));
  useEffect(() => {
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
    mutationFn: (personaId: string) => api.post<NoodleAccount>("/slurp/noodler/viewer/mark-seen", { personaId }),
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
            `/slurp/noodler/accounts/${encodeURIComponent(creatorAccountId)}/subscribe?personaId=${encodeURIComponent(personaId)}`,
          )
        : api.post<NoodlerViewerScope>(`/slurp/noodler/accounts/${encodeURIComponent(creatorAccountId)}/subscribe`, {
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
      api.patch<NoodlerViewerScope>(`/slurp/noodler/accounts/${encodeURIComponent(creatorAccountId)}/follow`, {
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
      api.post<NoodlerViewerScope>(`/slurp/noodler/posts/${encodeURIComponent(postId)}/unlock`, { personaId }),
    onSuccess: async (scope, input) => {
      // Cancel any in-flight viewer poll first, or it can land after us and restore the locked scope.
      await qc.cancelQueries({ queryKey: noodleKeys.viewer(input.personaId) });
      qc.setQueryData<NoodlerViewerScope | undefined>(noodleKeys.viewer(input.personaId), (current) =>
        mergeSlurpViewerShell(current, scope),
      );
      await qc.invalidateQueries({ queryKey: noodleKeys.viewer(input.personaId) });
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
      api.post<NoodleInteraction>(`/slurp/noodler/posts/${encodeURIComponent(postId)}/interactions`, input),
    onMutate: async (input) => {
      if (input.type !== "like" && input.type !== "repost") return undefined;
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
        `/slurp/noodler/posts/${encodeURIComponent(postId)}/interactions/${encodeURIComponent(interactionId)}/creator-reply`,
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
      return api.delete<NoodleInteraction>(`/slurp/noodler/posts/${encodeURIComponent(postId)}/interactions?${params}`);
    },
    onMutate: async (input) => {
      if (input.type !== "like" && input.type !== "repost") return undefined;
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
      api.patch<NoodlerManagedPost>(`/slurp/noodler/posts/${encodeURIComponent(id)}`, { ...input, accountId }),
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
      return api.upload<NoodlerManagedPost>(`/slurp/noodler/posts/${encodeURIComponent(id)}/media`, form);
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
    mutationFn: ({ id, accountId }: { id: string; accountId: string }) =>
      api.post<NoodlerManagedPost>(`/slurp/noodler/posts/${encodeURIComponent(id)}/image/generate`, {
        accountId,
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
        `/slurp/noodler/posts/${encodeURIComponent(id)}?accountId=${encodeURIComponent(accountId)}`,
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
        `/slurp/noodler/posts/${encodeURIComponent(postId)}/interactions/${encodeURIComponent(interactionId)}`,
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
        `/slurp/noodler/posts/${encodeURIComponent(postId)}/interactions/${encodeURIComponent(interactionId)}?personaId=${encodeURIComponent(personaId)}`,
      ),
    onSuccess: (_deleted, input) => qc.invalidateQueries({ queryKey: noodleKeys.viewer(input.personaId) }),
  });
}

export function useUpdateNoodlerAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, ...access }: { accountId: string; hiddenFromAccountIds: string[] }) =>
      api.patch<NoodleAccount>(`/slurp/accounts/${encodeURIComponent(accountId)}/settings`, {
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
      api.patch<NoodleAccount>(`/slurp/accounts/${encodeURIComponent(accountId)}/settings`, {
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
      api.patch<NoodleAccount>(`/slurp/accounts/${encodeURIComponent(accountId)}/settings`, {
        subtree: "scheduler",
        patch: { fanActivity },
      } satisfies NoodleAccountSettingsPatchInput),
    onSuccess: () => qc.invalidateQueries({ queryKey: noodleKeys.noodlerAccounts() }),
  });
}

export function useNoodlerReserveStatus(enabled = true) {
  return useQuery({
    queryKey: noodleKeys.noodlerReserveStatus(),
    queryFn: () => api.get<SlurpReserveStatus>("/slurp/noodler/auto-post/status"),
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
      api.patch<SlurpReserveStatus>(`/slurp/noodler/auto-post/schedule/${encodeURIComponent(slotId)}`, {
        publishAt,
      }),
    onSuccess: (status) => qc.setQueryData(noodleKeys.noodlerReserveStatus(), status),
  });
}

export function useRunNoodlerAutoPostNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) =>
      api.post<NoodlerManagedPost>(`/slurp/noodler/accounts/${encodeURIComponent(accountId)}/auto-post/run-now`),
    onSuccess: (_post, accountId) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerPosts(accountId) }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
      ]),
  });
}

export function useRefreshTargetedNoodlerCreatorsNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { accountIds: string[]; executionId?: string; access?: "public" | "locked" }) =>
      api.post<{ outcomes: NoodlerRefreshNowOutcome[] }>("/slurp/noodler/auto-post/refresh-targeted", {
        ...input,
      }),
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

export function useRefreshNoodlerFanActivityNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ status: string; created: number }>("/slurp/noodler/fan-activity/refresh-now", {
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
      }>("/slurp/noodler/fan-activity/status"),
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
};

export type SlurpMessage = {
  id: string;
  threadId: string;
  senderAccountId: string;
  role: "viewer" | "creator";
  kind:
    "text" | "tip" | "ppv" | "system" | "broadcast" | "commission_brief" | "commission_quote" | "commission_delivery";
  content: string;
  imageUrl: string | null;
  price: number;
  unlockedAt: string | null;
  readAt: string | null;
  createdAt: string;
};

export type SlurpThread = {
  id: string;
  viewerAccountId: string;
  creatorAccountId: string;
  state: "request" | "active" | "declined";
  openedBy: "viewer" | "creator";
  requestFeePaid: number;
  lastMessageAt: string;
  lastMessagePreview: string;
  viewerUnread: number;
  creatorUnread: number;
  rapport: SlurpRapport;
  createdAt: string;
  updatedAt: string;
  creatorHandle: string;
  creatorDisplayName: string;
  creatorAvatarUrl: string | null;
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
  createdAt: string;
  updatedAt: string;
};

export type SlurpSendResponse = {
  thread: SlurpThread;
  message: SlurpMessage;
  reply: SlurpMessage | null;
  replyStatus: string;
  typingMs?: number;
};

const messageKeys = {
  threads: (personaId: string | null) => [...noodleKeys.noodlerRoot(), "messages", "threads", personaId ?? "none"],
  thread: (threadId: string, personaId: string | null) => [
    ...noodleKeys.noodlerRoot(),
    "messages",
    "thread",
    threadId,
    personaId ?? "none",
  ],
};

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
      }>(`/slurp/messages/threads?personaId=${encodeURIComponent(personaId!)}`),
    enabled: Boolean(personaId),
  });
}

export function useSlurpThread(threadId: string | null, personaId: string | null) {
  return useQuery({
    queryKey: messageKeys.thread(threadId ?? "none", personaId),
    queryFn: () =>
      api.get<{
        thread: SlurpThread;
        messages: SlurpMessage[];
        creator: { id: string; handle: string; displayName: string; avatarUrl: string | null } | null;
        messaging: SlurpCreatorMessaging;
        commissions: SlurpCommission[];
        subscribed?: boolean;
      }>(`/slurp/messages/threads/${encodeURIComponent(threadId!)}?personaId=${encodeURIComponent(personaId!)}`),
    enabled: Boolean(threadId && personaId),
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
        creator: { id: string; handle: string; displayName: string; avatarUrl: string | null } | null;
        messaging: SlurpCreatorMessaging;
        commissions: SlurpCommission[];
        subscribed?: boolean;
      }>(
        `/slurp/messages/compose?personaId=${encodeURIComponent(personaId!)}&creatorAccountId=${encodeURIComponent(creatorAccountId!)}`,
      ),
    enabled: Boolean(creatorAccountId && personaId),
  });
}

export function useSendSlurpMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { personaId: string; creatorAccountId: string; content: string }) =>
      api.post<SlurpSendResponse>("/slurp/messages/send", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerRoot() }),
  });
}

export function useTipInSlurpThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { personaId: string; creatorAccountId: string; amount: number; note?: string }) =>
      api.post<SlurpSendResponse & { wallet: SlurpWallet }>("/slurp/messages/tip", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerRoot() }),
  });
}

export function useUnlockSlurpMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { personaId: string; messageId: string }) =>
      api.post<{ message: SlurpMessage; wallet: SlurpWallet }>("/slurp/messages/ppv/unlock", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerRoot() }),
  });
}

/** Write as the Creator, in your own words. */
export function useSendSlurpCreatorReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { creatorAccountId: string; personaId: string; viewerAccountId: string; content: string }) =>
      api.post<{ message: SlurpMessage; thread: SlurpThread | null }>(
        `/slurp/messages/creators/${encodeURIComponent(input.creatorAccountId)}/reply`,
        input,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerRoot() }),
  });
}

/** Have the Creator draft a reply. The model is the fallback, not the default. */
export function useDraftSlurpCreatorReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { creatorAccountId: string; personaId: string; threadId: string }) =>
      api.post<{ message: SlurpMessage; thread: SlurpThread | null }>(
        `/slurp/messages/creators/${encodeURIComponent(input.creatorAccountId)}/draft-reply`,
        input,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerRoot() }),
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
        `/slurp/messages/creators/${encodeURIComponent(input.creatorAccountId)}/ppv`,
        input,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerRoot() }),
  });
}

export function useBroadcastSlurpMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { creatorAccountId: string; personaId: string; content: string }) =>
      api.post<{ sent: number }>(
        `/slurp/messages/creators/${encodeURIComponent(input.creatorAccountId)}/broadcast`,
        input,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerRoot() }),
  });
}

export function useCreateSlurpCommission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { personaId: string; creatorAccountId: string; brief: string }) =>
      api.post<{ commission: SlurpCommission }>("/slurp/messages/commissions", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerRoot() }),
  });
}

export function useQuoteSlurpCommission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { commissionId: string; personaId: string; price: number }) =>
      api.post<{ commission: SlurpCommission }>(
        `/slurp/messages/commissions/${encodeURIComponent(input.commissionId)}/quote`,
        input,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerRoot() }),
  });
}

export function useAcceptSlurpCommission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { commissionId: string; personaId: string }) =>
      api.post<{ commission: SlurpCommission }>(
        `/slurp/messages/commissions/${encodeURIComponent(input.commissionId)}/accept`,
        input,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerRoot() }),
  });
}

export function useDeliverSlurpCommission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { commissionId: string; personaId: string; content: string }) =>
      api.post<{ commission: SlurpCommission }>(
        `/slurp/messages/commissions/${encodeURIComponent(input.commissionId)}/deliver`,
        input,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerRoot() }),
  });
}

export function useResolveSlurpMessageRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { threadId: string; personaId: string; decision: "accept" | "decline" }) =>
      api.post<{ thread: SlurpThread }>(`/slurp/messages/threads/${encodeURIComponent(input.threadId)}/request`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerRoot() }),
  });
}

/** The rapport breakdown, read only by the Creator edit panel. */
export function useSlurpRapport(creatorAccountId: string | null, personaId: string | null) {
  return useQuery({
    queryKey: [...noodleKeys.noodlerRoot(), "messages", "rapport", creatorAccountId ?? "none", personaId ?? "none"],
    queryFn: () =>
      api.get<{ messaging: SlurpCreatorMessaging; rapport: SlurpRapport; facts: Record<string, unknown> }>(
        `/slurp/messages/creators/${encodeURIComponent(creatorAccountId!)}/rapport?personaId=${encodeURIComponent(personaId!)}`,
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
        `/slurp/messages/creators/${encodeURIComponent(creatorAccountId)}/settings`,
        patch,
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerRoot() }),
  });
}
