import type {
  SlpCreatorGenerationRequest,
  SlpCreatorPostCreateInput,
  SlpCreatorPostUpdateInput,
} from "../../../../../shared/src/slp/slp-social-generation.schema.js";
import type { SlpCreatorManagedPost, SlpPostImageCrop } from "../../../../../shared/src/slp/slp-social.types.js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ImagePromptOverride } from "../../../components/ui/ImagePromptReviewModal.js";
import { api } from "../../../lib/api-client.js";
import { useSlurpUIStore } from "../../base/state/slp-package-store.js";
import type { SlurpPageCursor } from "../../base/state/slp-page-cursor.js";
import { noodleKeys } from "../../base/state/slp-query-keys.js";
import type {
  GeneratedNoodlerNoodlePost,
  NoodlePostDraft,
  NoodlePostDraftRequest,
  NoodlerContentFormat,
  NoodlerPostDraftImage,
  SlurpProfilePost,
} from "./slp-feed-contract.js";

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
type NoodlerFormatRequest = {
  format?: NoodlerContentFormat;
};
type NoodlerCreatePostRequest = Omit<SlpCreatorPostCreateInput, "uploadedImageUrl" | "imageCrop"> & {
  image?: NoodlerPostDraftImage | null;
  postType?: "post" | "story";
  linkedPostId?: string | null;
  /** Price for this locked post. Null uses the Creator's price. */
  unlockPrice?: number | null;
  /** Image directions to keep on the post, so its image can be rendered afterwards. */
  imagePrompt?: string | null;
} & NoodlerFormatRequest;
type NoodlerGeneratePostRequest = Omit<SlpCreatorGenerationRequest, "uploadedImageUrl" | "imageCrop"> & {
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
      postNoodlerRequestWithImage<SlpCreatorManagedPost>("/slurp2/noodler/posts", input, image),
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
export function useUpdateNoodlerPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, accountId, ...input }: { id: string; accountId: string } & SlpCreatorPostUpdateInput) =>
      api.patch<SlpCreatorManagedPost>(`/slurp2/noodler/posts/${encodeURIComponent(id)}`, { ...input, accountId }),
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
      crop: SlpPostImageCrop;
    } & Omit<SlpCreatorPostUpdateInput, "imageCrop" | "removeImage">) => {
      const form = new FormData();
      form.append("payload", JSON.stringify({ ...input, imageCrop: crop, accountId }));
      form.append("file", file);
      return api.upload<SlpCreatorManagedPost>(`/slurp2/noodler/posts/${encodeURIComponent(id)}/media`, form);
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
      api.post<SlpCreatorManagedPost>(`/slurp2/noodler/posts/${encodeURIComponent(id)}/image/generate`, {
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
      api.delete<SlpCreatorManagedPost>(
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
