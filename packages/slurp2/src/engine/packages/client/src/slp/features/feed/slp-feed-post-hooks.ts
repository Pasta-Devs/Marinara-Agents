import type {
  SlpCreatorGenerationRequest,
  SlpCreatorPostCreateInput,
  SlpCreatorPostUpdateInput,
} from "../../../../../shared/src/slp/slp-social-generation.schema.js";
import type {
  SlpCreatorManagedPost,
  SlpPostImageCrop,
  SlpCreatorViewerScope,
} from "../../../../../shared/src/slp/slp-social.types.js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ImagePromptOverride } from "../../../components/ui/ImagePromptReviewModal.js";
import { api } from "../../../lib/api-client.js";
import { useSlurpUIStore } from "../../base/state/slp-package-store.js";
import type { SlurpPageCursor } from "../../base/state/slp-page-cursor.js";
import { slpKeys } from "../../base/state/slp-query-keys.js";
import type {
  GeneratedCreatorSlpPost,
  SlpPostDraft,
  SlpPostDraftRequest,
  SlpCreatorContentFormat,
  SlpCreatorPostDraftImage,
  SlurpProfilePost,
} from "./slp-feed-contract.js";

/** Set by a post action: the next profile fetch reads every page once, so older posts refresh too. */
let slpProfilePostsStale = false;
/** Bumped by every post action: a background page fill started before one is dropped, not merged. */
let slpProfilePostsGeneration = 0;
export function markSlpProfilePostsStale() {
  slpProfilePostsStale = true;
  slpProfilePostsGeneration += 1;
}

const profilePostTime = (item: SlurpProfilePost) =>
  Date.parse(("managed" in item ? item.managed : item.viewerPost).createdAt);

/**
 * A background poll reads page one only and keeps the older posts it already has (R1-041: an open
 * profile re-downloaded the whole history every 30 s). Page one decides everything newer than its
 * oldest post, so a post that left it is gone; older cached posts stay.
 */
export function mergeSlpProfileFirstPage(
  cached: readonly SlurpProfilePost[],
  page: readonly SlurpProfilePost[],
  hasMore: boolean,
): SlurpProfilePost[] {
  if (!hasMore || page.length === 0) return [...page];
  const oldest = Math.min(...page.map(profilePostTime));
  const ids = new Set(page.map(slpProfilePostId));
  return [...page, ...cached.filter((item) => !ids.has(slpProfilePostId(item)) && profilePostTime(item) < oldest)];
}

export function useCreatorPosts(accountId: string | null, personaId: string | null) {
  const qc = useQueryClient();
  const queryKey = [...slpKeys.noodlerPosts(accountId ?? "none"), personaId ?? "none"];
  return useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const cached = qc.getQueryData<SlurpProfilePost[]>(queryKey);
      const firstPageOnly = Boolean(cached) && !slpProfilePostsStale;
      const refreshAll = Boolean(cached) && slpProfilePostsStale;
      slpProfilePostsStale = false;
      const fetchPage = (cursor: SlurpPageCursor | null, pageSignal?: AbortSignal) => {
        const query = new URLSearchParams({ limit: "20" });
        if (personaId) query.set("personaId", personaId);
        if (cursor) {
          query.set("cursorAt", cursor.createdAt);
          query.set("cursorId", cursor.id);
        }
        return api.get<{ items: SlurpProfilePost[]; nextCursor: SlurpPageCursor | null }>(
          `/slurp2/slurp/accounts/${encodeURIComponent(accountId!)}/posts?${query.toString()}`,
          { signal: pageSignal },
        );
      };
      const first = await fetchPage(null, signal);
      if (firstPageOnly) return mergeSlpProfileFirstPage(cached!, first.items, Boolean(first.nextCursor));
      if (refreshAll) {
        // A post action changed older posts too: read every page once before answering.
        const items = [...first.items];
        for (let cursor = first.nextCursor; cursor;) {
          const page = await fetchPage(cursor, signal);
          items.push(...page.items);
          cursor = page.nextCursor;
        }
        return items;
      }
      // A cold profile shows page one at once; older pages follow in the background. It used to
      // walk every page in sequence first, 15 round trips for 300 posts before anything showed.
      const generation = slpProfilePostsGeneration;
      if (first.nextCursor)
        void (async () => {
          const rest: SlurpProfilePost[] = [];
          // Stops once nobody shows this profile any more, so leaving it costs no further requests.
          const watched = () => (qc.getQueryCache().find({ queryKey })?.getObserversCount() ?? 0) > 0;
          for (let cursor: SlurpPageCursor | null = first.nextCursor; cursor;) {
            if (!watched()) return;
            const page = await fetchPage(cursor);
            rest.push(...page.items);
            cursor = page.nextCursor;
          }
          // A post was deleted or changed meanwhile: its full refresh is the truth, not this fill.
          if (generation !== slpProfilePostsGeneration) return;
          qc.setQueryData<SlurpProfilePost[]>(queryKey, (current) => {
            const shown = current ?? first.items;
            const ids = new Set(shown.map(slpProfilePostId));
            return [...shown, ...rest.filter((item) => !ids.has(slpProfilePostId(item)))];
          });
        })().catch(() => {
          slpProfilePostsStale = true;
        });
      return first.items;
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
 * Draft one post for a directly invited character, steered by the user's guidance.
 *
 * Pairs with `POST /accounts/:id/post-draft`, which the standalone Noodle/Slurp split dropped
 * while keeping the generator behind it.
 */
export function useGenerateSlpPostDraft() {
  return useMutation({
    mutationFn: ({ accountId, ...body }: SlpPostDraftRequest) =>
      api.post<SlpPostDraft>(`/slurp2/accounts/${encodeURIComponent(accountId)}/post-draft`, body),
  });
}
type SlpCreatorFormatRequest = {
  format?: SlpCreatorContentFormat;
};
type SlpCreatorCreatePostRequest = Omit<SlpCreatorPostCreateInput, "uploadedImageUrl" | "imageCrop"> & {
  image?: SlpCreatorPostDraftImage | null;
  postType?: "post" | "story";
  linkedPostId?: string | null;
  /** Price for this locked post. Null uses the Creator's price. */
  unlockPrice?: number | null;
  /** Image directions to keep on the post, so its image can be rendered afterwards. */
  imagePrompt?: string | null;
} & SlpCreatorFormatRequest;
type SlpCreatorGeneratePostRequest = Omit<SlpCreatorGenerationRequest, "uploadedImageUrl" | "imageCrop"> & {
  image?: SlpCreatorPostDraftImage | null;
  /** Ask generation for a Story instead of waiting for the rotation to pick one. */
  postType?: "post" | "story";
} & SlpCreatorFormatRequest;
function postCreatorRequestWithImage<T>(
  path: string,
  input: Record<string, unknown>,
  image?: SlpCreatorPostDraftImage | null,
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
export function useGenerateCreatorSlpPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["slurp", "generate-post"],
    mutationFn: ({ image, ...input }: SlpCreatorGeneratePostRequest) =>
      postCreatorRequestWithImage<GeneratedCreatorSlpPost>(
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
          queryKey: slpKeys.noodlerPosts(input.targetAccountId),
        }),
        qc.invalidateQueries({ queryKey: slpKeys.slpCreatorViewers() }),
      ]),
  });
}
export function useConfirmCreatorImagePrompts() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["slurp", "generate-post-images"],
    mutationFn: (input: { targetAccountId: string; prompts: ImagePromptOverride[] }) =>
      api.post<{ finalized: number }>("/slurp2/slurp/refresh/images", {
        prompts: input.prompts,
        debugMode: useSlurpUIStore.getState().debugMode,
      }),
    onSuccess: (_result, input) =>
      Promise.all([
        qc.invalidateQueries({
          queryKey: slpKeys.noodlerPosts(input.targetAccountId),
        }),
        qc.invalidateQueries({ queryKey: slpKeys.slpCreatorViewers() }),
      ]),
  });
}
/** Closing the picture review without drawing ends the wait on the server (R1-047). */
export function useCancelCreatorImagePrompts() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["slurp", "cancel-post-images"],
    mutationFn: (input: { targetAccountId: string; ids: string[] }) =>
      api.post<{ cancelled: number }>("/slurp2/slurp/refresh/images/cancel", { ids: input.ids }),
    onSettled: (_result, _error, input) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: slpKeys.noodlerPosts(input.targetAccountId) }),
        qc.invalidateQueries({ queryKey: slpKeys.slpCreatorViewers() }),
      ]),
  });
}
export function useCreateCreatorPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["slurp", "create-post"],
    mutationFn: ({ image, ...input }: SlpCreatorCreatePostRequest) =>
      postCreatorRequestWithImage<SlpCreatorManagedPost>("/slurp2/slurp/posts", input, image),
    onSuccess: (_post, input) =>
      Promise.all([
        qc.invalidateQueries({
          queryKey: slpKeys.noodlerPosts(input.targetAccountId),
        }),
        qc.invalidateQueries({ queryKey: slpKeys.slpCreatorViewers() }),
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
export function useLoadCreatorPostImage() {
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
/** A profile card holds the owner copy of a post, the fan copy, or both; either id is the post (R1-022). */
export const slpProfilePostId = (item: SlurpProfilePost) => ("managed" in item ? item.managed.id : item.viewerPost.id);
export function useUpdateCreatorPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, accountId, ...input }: { id: string; accountId: string } & SlpCreatorPostUpdateInput) =>
      api.patch<SlpCreatorManagedPost>(`/slurp2/slurp/posts/${encodeURIComponent(id)}`, { ...input, accountId }),
    onSuccess: (post, input) => {
      qc.setQueriesData<SlurpProfilePost[]>({ queryKey: slpKeys.noodlerPosts(input.accountId) }, (current) =>
        current?.map((item) => ("managed" in item && item.managed.id === post.id ? { ...item, managed: post } : item)),
      );
      // A card that holds only the fan copy is refetched instead (R1-022).
      markSlpProfilePostsStale();
      void qc.invalidateQueries({ queryKey: slpKeys.noodlerPosts(input.accountId) });
      return qc.invalidateQueries({ queryKey: slpKeys.slpCreatorViewers() });
    },
  });
}
export function useReplaceCreatorPostImage() {
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
      crop: SlpPostImageCrop;
    } & Omit<SlpCreatorPostUpdateInput, "imageCrop" | "removeImage">) => {
      const form = new FormData();
      form.append("payload", JSON.stringify({ ...input, imageCrop: crop, accountId }));
      form.append("file", file);
      return api.upload<SlpCreatorManagedPost>(`/slurp2/slurp/posts/${encodeURIComponent(id)}/media`, form);
    },
    onSuccess: (post, input) => {
      qc.setQueriesData<SlurpProfilePost[]>({ queryKey: slpKeys.noodlerPosts(input.accountId) }, (current) =>
        current?.map((item) => ("managed" in item && item.managed.id === post.id ? { ...item, managed: post } : item)),
      );
      // A card that holds only the fan copy is refetched instead (R1-022).
      markSlpProfilePostsStale();
      void qc.invalidateQueries({ queryKey: slpKeys.noodlerPosts(input.accountId) });
      return qc.invalidateQueries({ queryKey: slpKeys.slpCreatorViewers() });
    },
  });
}
export function useGenerateCreatorPostImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["slurp", "generate-post-image"],
    mutationFn: ({
      id,
      accountId,
      imagePrompt,
      asWritten,
    }: {
      id: string;
      accountId: string;
      imagePrompt?: string;
      /** The prompt came from the redraw box and goes to the provider as written. */
      asWritten?: boolean;
    }) =>
      api.post<SlpCreatorManagedPost>(`/slurp2/slurp/posts/${encodeURIComponent(id)}/image/generate`, {
        accountId,
        ...(imagePrompt ? { imagePrompt } : {}),
        ...(imagePrompt && asWritten ? { asWritten: true } : {}),
        replace: true,
        debugMode: useSlurpUIStore.getState().debugMode,
      }),
    onSuccess: (restored, input) => {
      qc.setQueriesData<SlpCreatorViewerScope | undefined>({ queryKey: slpKeys.slpCreatorViewers() }, (current) =>
        current
          ? {
              ...current,
              creators: current.creators.map((creator) => ({
                ...creator,
                posts: creator.posts.map((post) =>
                  post.id === restored.id
                    ? {
                        ...post,
                        access: restored.access,
                        locked: false,
                        title: restored.title,
                        content: restored.content,
                        hasImage: Boolean(restored.imageUrl || restored.images.length > 0),
                        imageUrl: restored.imageUrl,
                        imagePrompt: restored.imagePrompt,
                        images: restored.images,
                        metadata: restored.metadata,
                      }
                    : post,
                ),
              })),
            }
          : current,
      );
      return Promise.all([
        qc.invalidateQueries({ queryKey: slpKeys.noodlerPosts(input.accountId) }),
        qc.invalidateQueries({ queryKey: slpKeys.slpCreatorViewers() }),
      ]);
    },
  });
}
export function useDeleteCreatorPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, accountId }: { id: string; accountId: string }) =>
      api.delete<SlpCreatorManagedPost>(
        `/slurp2/slurp/posts/${encodeURIComponent(id)}?accountId=${encodeURIComponent(accountId)}`,
      ),
    onSuccess: (_post, input) => {
      qc.setQueriesData<SlurpProfilePost[]>({ queryKey: slpKeys.noodlerPosts(input.accountId) }, (current) =>
        current?.filter((item) => slpProfilePostId(item) !== input.id),
      );
      qc.setQueriesData<SlpCreatorViewerScope | undefined>({ queryKey: slpKeys.slpCreatorViewers() }, (current) =>
        current
          ? {
              ...current,
              creators: current.creators.map((creator) => ({
                ...creator,
                posts: creator.posts.filter((post) => post.id !== input.id),
              })),
            }
          : current,
      );
    },
  });
}
