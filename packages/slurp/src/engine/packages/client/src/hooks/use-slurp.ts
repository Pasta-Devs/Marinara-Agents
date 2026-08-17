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
  NoodleAmbientProfileRerollInput,
  NoodleAmbientProfileRerollOutcome,
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
  NoodlerReserveStatus,
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
};

export type SlurpSettings = {
  refreshesPerDay: number;
  generationGuidance: string;
  postsPerDay: number;
  autoPostingScheduleEnabled: boolean;
  fanActivityEnabled: boolean;
  generationConnectionId: string | null;
  imageGenerationConnectionId: string | null;
  imageGenerationPrompt: string;
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

export function useRerollAmbientNoodleProfiles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NoodleAmbientProfileRerollInput) =>
      api.post<{
        accounts: NoodleAccount[];
        outcomes: NoodleAmbientProfileRerollOutcome[];
      }>("/slurp/ambient-profiles/reroll", input),
    onSuccess: ({ accounts }) => {
      qc.setQueryData<NoodleBootstrap | undefined>(noodleKeys.bootstrap(), (current) => {
        if (!current) return current;
        const updatedById = new Map(accounts.map((account) => [account.id, account]));
        return {
          ...current,
          accounts: current.accounts.map((account) => updatedById.get(account.id) ?? account),
        };
      });
      return qc.invalidateQueries({ queryKey: noodleKeys.bootstrap() });
    },
  });
}

export function useNoodlerAccounts(enabled = true) {
  return useQuery({
    queryKey: noodleKeys.noodlerAccounts(),
    queryFn: () => api.get<NoodlerManagedStageProfile[]>("/slurp/noodler/accounts"),
    enabled,
    staleTime: 10_000,
    // Autonomous reserve work changes operator state without a client mutation.
    refetchInterval: enabled ? 30_000 : false,
    refetchIntervalInBackground: false,
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
  | { managed: NoodlerManagedPost; viewerPost: NoodlerPostView | null }
  | { viewerPost: NoodlerPostView };

export function useNoodlerPosts(accountId: string | null, personaId: string | null) {
  return useQuery({
    queryKey: [...noodleKeys.noodlerPosts(accountId ?? "none"), personaId ?? "none"],
    queryFn: () =>
      api
        .get<{
          items: SlurpProfilePost[];
        }>(
          `/slurp/noodler/accounts/${encodeURIComponent(accountId!)}/posts${personaId ? `?personaId=${encodeURIComponent(personaId)}` : ""}`,
        )
        .then((page) => page.items),
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

export function useGenerateNoodlePostDraft() {
  return useMutation({
    mutationFn: ({ accountId, ...input }: NoodlePostDraftRequest) =>
      api.post<NoodlePostDraft>(`/slurp/accounts/${encodeURIComponent(accountId)}/post-draft`, {
        ...input,
        debugMode: useSlurpUIStore.getState().debugMode,
      }),
  });
}

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
      type FeedPage = {
        items: Array<{
          creatorAccountId: string;
          post: NoodlerViewerScope["creators"][number]["posts"][number];
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
  });
}

/**
 * Unseen-post count for the public Noodle entry point. Reads the bootstrap query both Noodle
 * surfaces already hold, so the badge is the same number whether it is rendered from Noodle or
 * from NoodleR.
 */
/** Poll the badge without downloading the complete viewer feed or historical media metadata. */
export function useNoodlerUnseenCount(personaId: string | null, enabled = true) {
  const { data } = useQuery({
    queryKey: noodleKeys.noodlerUnseenCount(personaId ?? "none"),
    queryFn: () =>
      api.get<{ count: number }>(`/slurp/noodler/viewer/unseen-count?personaId=${encodeURIComponent(personaId!)}`),
    enabled: enabled && Boolean(personaId),
    staleTime: 10_000,
    refetchInterval: enabled && personaId ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
  return Math.max(0, Math.floor(data?.count ?? 0));
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
        qc.invalidateQueries({ queryKey: noodleKeys.viewer(input.personaId) }),
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
    mutationFn: ({ postId, ...input }: { postId: string } & NoodlerCreateInteractionInput) =>
      api.post<NoodleInteraction>(`/slurp/noodler/posts/${encodeURIComponent(postId)}/interactions`, input),
    onSuccess: (_result, input) => qc.invalidateQueries({ queryKey: noodleKeys.viewer(input.personaId) }),
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
    mutationFn: ({ postId, ...input }: { postId: string } & NoodlerRemoveInteractionInput) => {
      const params = new URLSearchParams({
        personaId: input.personaId,
        type: input.type,
      });
      if (input.parentInteractionId) params.set("parentInteractionId", input.parentInteractionId);
      return api.delete<NoodleInteraction>(`/slurp/noodler/posts/${encodeURIComponent(postId)}/interactions?${params}`);
    },
    onSuccess: (_result, input) => qc.invalidateQueries({ queryKey: noodleKeys.viewer(input.personaId) }),
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
    queryFn: () => api.get<NoodlerReserveStatus>("/slurp/noodler/auto-post/status"),
    enabled,
    // The scheduler prepares posts on its own timer, so nothing here invalidates this key when
    // the counts change. Same 30s cadence the creator list already uses.
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
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

export function useRefreshAllNoodlerCreatorsNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ outcomes: NoodlerRefreshNowOutcome[] }>("/slurp/noodler/auto-post/refresh-now"),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerAccounts() }),
        qc.invalidateQueries({
          queryKey: [...noodleKeys.noodlerRoot(), "posts"],
        }),
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
