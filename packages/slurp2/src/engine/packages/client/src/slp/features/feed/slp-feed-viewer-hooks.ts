import type {
  SlpCreatorCreateInteractionInput,
  SlpCreatorRemoveInteractionInput,
} from "../../../../../shared/src/slp/slp-social-generation.schema.js";
import type {
  SlpAccount,
  SlpCreatorReplyResult,
  SlpCreatorViewerScope,
  SlpInteraction,
} from "../../../../../shared/src/slp/slp-social.types.js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { api } from "../../../lib/api-client.js";
import { useSlurpUIStore } from "../../base/state/slp-package-store.js";
import type { SlurpPageCursor } from "../../base/state/slp-page-cursor.js";
import { cursorQuery } from "../../base/state/slp-page-cursor.js";
import { slpKeys } from "../../base/state/slp-query-keys.js";
import type { SlurpViewerScope } from "../../base/state/slp-state-types.js";

function mergeSlurpViewerShell(
  current: SlpCreatorViewerScope | undefined,
  shell: SlpCreatorViewerScope,
): SlpCreatorViewerScope {
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
export function useCreatorViewer(personaId: string | null, enabled = true) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: slpKeys.viewer(personaId ?? "none"),
    queryFn: async ({ signal }) => {
      const encodedPersonaId = encodeURIComponent(personaId!);
      type ViewerPost = SlurpViewerScope["creators"][number]["posts"][number] & { story?: boolean };
      type FeedResponse = SlurpViewerScope & {
        items: Array<{
          creatorAccountId: string;
          post: ViewerPost;
        }>;
        total: number;
        nextCursor: SlurpPageCursor | null;
      };
      const page = await api.get<FeedResponse>(
        `/slurp2/slurp/viewer/feed?personaId=${encodedPersonaId}&tab=all&limit=20`,
        { signal },
      );
      const postsByCreator = new Map<string, SlurpViewerScope["creators"][number]["posts"]>();
      for (const item of page.items) {
        const posts = postsByCreator.get(item.creatorAccountId) ?? [];
        posts.push(item.post);
        postsByCreator.set(item.creatorAccountId, posts);
      }
      return {
        ...page,
        creators: page.creators.map((creator) => ({
          ...creator,
          posts: postsByCreator.get(creator.profile.id) ?? [],
        })),
      };
    },
    enabled: enabled && Boolean(personaId),
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    // The unseen-count poll already announces new posts; the full page only needs a slow refresh.
    // ponytail: fixed 2-minute poll; refetch on a count change if that feels stale.
    refetchInterval: enabled && personaId ? 120_000 : false,
    refetchIntervalInBackground: false,
  });
  const loadMore = async () => {
    const current = qc.getQueryData<SlurpViewerScope & { nextCursor?: SlurpPageCursor | null }>(
      slpKeys.viewer(personaId ?? "none"),
    );
    if (!personaId || !current?.nextCursor) return false;
    type FeedResponse = SlurpViewerScope & {
      items: Array<{ creatorAccountId: string; post: SlurpViewerScope["creators"][number]["posts"][number] }>;
      nextCursor: SlurpPageCursor | null;
    };
    const page = await api.get<FeedResponse>(
      `/slurp2/slurp/viewer/feed?personaId=${encodeURIComponent(personaId)}&tab=all&limit=20${cursorQuery(current.nextCursor)}`,
    );
    qc.setQueryData(slpKeys.viewer(personaId), (value: typeof current | undefined) => {
      if (!value) return value;
      return {
        ...value,
        nextCursor: page.nextCursor,
        creators: value.creators.map((creator) => ({
          ...creator,
          posts: [
            ...creator.posts,
            ...page.items
              .filter((item) => item.creatorAccountId === creator.profile.id)
              .map((item) => item.post)
              .filter((post) => !creator.posts.some((existing) => existing.id === post.id)),
          ],
        })),
      };
    });
    return true;
  };
  return { ...query, loadMore };
}
/**
 * Unseen-post count for the public Noodle entry point. Reads the bootstrap query both Noodle
 * surfaces already hold, so the badge is the same number whether it is rendered from Noodle or
 * from NoodleR.
 */
/** Poll the badge without downloading the complete viewer feed or historical media metadata. */
export function useCreatorUnseenCount(personaId: string | null, enabled = true) {
  const qc = useQueryClient();
  const previousCount = useRef<number | null>(null);
  const { data } = useQuery({
    queryKey: slpKeys.noodlerUnseenCount(personaId ?? "none"),
    queryFn: () =>
      api.get<{ count: number }>(`/slurp2/slurp/viewer/unseen-count?personaId=${encodeURIComponent(personaId!)}`),
    enabled: enabled && Boolean(personaId),
    staleTime: 10_000,
    // The unseen-count poll already announces new posts; the full page only needs a slow refresh.
    // ponytail: fixed 2-minute poll; refetch on a count change if that feels stale.
    refetchInterval: enabled && personaId ? 120_000 : false,
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
    if (count > previousCount.current) void qc.invalidateQueries({ queryKey: slpKeys.viewer(personaId) });
    previousCount.current = count;
  }, [count, enabled, personaId, qc]);
  return count;
}
export function useMarkCreatorFeedSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (personaId: string) => api.post<SlpAccount>("/slurp2/slurp/viewer/mark-seen", { personaId }),
    onSuccess: (viewer, personaId) => {
      qc.setQueryData<SlpCreatorViewerScope | undefined>(slpKeys.viewer(personaId), (current) =>
        current ? { ...current, viewer: { ...current.viewer, ...viewer } } : current,
      );
      qc.setQueryData(slpKeys.noodlerUnseenCount(personaId), { count: 0 });
    },
  });
}
export function useToggleCreatorSubscription() {
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
        ? api.delete<SlpCreatorViewerScope>(
            `/slurp2/slurp/accounts/${encodeURIComponent(creatorAccountId)}/subscribe?personaId=${encodeURIComponent(personaId)}`,
          )
        : api.post<SlpCreatorViewerScope>(`/slurp2/slurp/accounts/${encodeURIComponent(creatorAccountId)}/subscribe`, {
            personaId,
          }),
    // The mutation returns a shell without posts. Keep the current feed visible until refetch.
    onSuccess: async (scope, input) => {
      // Cancel any in-flight viewer poll first, or it can land after us and restore the stale scope.
      await qc.cancelQueries({ queryKey: slpKeys.viewer(input.personaId) });
      qc.setQueryData<SlpCreatorViewerScope | undefined>(slpKeys.viewer(input.personaId), (current) =>
        mergeSlurpViewerShell(current, scope),
      );
      void qc.invalidateQueries({ queryKey: slpKeys.viewer(input.personaId) });
      void qc.invalidateQueries({ queryKey: slpKeys.noodlerPosts(input.creatorAccountId) });
      void qc.invalidateQueries({ queryKey: slpKeys.noodlerSubscribers(input.creatorAccountId) });
      void qc.invalidateQueries({ queryKey: [...slpKeys.noodlerRoot(), "wallet", input.personaId] });
      void qc.invalidateQueries({ queryKey: [...slpKeys.noodlerRoot(), "viewer-wallets"] });
    },
  });
}
export function useToggleCreatorFollow() {
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
      api.patch<SlpCreatorViewerScope>(`/slurp2/slurp/accounts/${encodeURIComponent(creatorAccountId)}/follow`, {
        personaId,
        followed,
      }),
    onSuccess: async (scope, input) => {
      await qc.cancelQueries({ queryKey: slpKeys.viewer(input.personaId) });
      qc.setQueryData<SlpCreatorViewerScope | undefined>(slpKeys.viewer(input.personaId), (current) =>
        mergeSlurpViewerShell(current, scope),
      );
      void qc.invalidateQueries({ queryKey: slpKeys.viewer(input.personaId) });
    },
  });
}
export function useUnlockCreatorPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, personaId }: { postId: string; personaId: string }) =>
      api.post<SlpCreatorViewerScope>(`/slurp2/slurp/posts/${encodeURIComponent(postId)}/unlock`, { personaId }),
    onSuccess: async (scope, input) => {
      // Cancel any in-flight viewer poll first, or it can land after us and restore the locked scope.
      await qc.cancelQueries({ queryKey: slpKeys.viewer(input.personaId) });
      qc.setQueryData<SlpCreatorViewerScope | undefined>(slpKeys.viewer(input.personaId), (current) =>
        mergeSlurpViewerShell(current, scope),
      );
      void qc.invalidateQueries({ queryKey: slpKeys.viewer(input.personaId) });
      void qc.invalidateQueries({ queryKey: [...slpKeys.noodlerRoot(), "wallet", input.personaId] });
      void qc.invalidateQueries({ queryKey: [...slpKeys.noodlerRoot(), "viewer-wallets"] });
    },
  });
}
export function useCreateCreatorInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      postId,
      actorAccountId: _actorAccountId,
      ...input
    }: { postId: string; actorAccountId?: string } & SlpCreatorCreateInteractionInput) =>
      api.post<SlpInteraction>(`/slurp2/slurp/posts/${encodeURIComponent(postId)}/interactions`, input),
    onMutate: async (input) => {
      if (input.type !== "like") return undefined;
      await qc.cancelQueries({ queryKey: slpKeys.viewer(input.personaId) });
      const previous = qc.getQueryData<SlpCreatorViewerScope>(slpKeys.viewer(input.personaId));
      qc.setQueryData<SlpCreatorViewerScope | undefined>(slpKeys.viewer(input.personaId), (current) => {
        if (!current) return current;
        return {
          ...current,
          creators: current.creators.map((creator) => ({
            ...creator,
            posts: creator.posts.map((post) => {
              if (post.id !== input.postId) return post;
              const interaction: SlpInteraction = {
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
      if (context?.previous) qc.setQueryData(slpKeys.viewer(input.personaId), context.previous);
    },
    onSettled: (_result, _error, input) => qc.invalidateQueries({ queryKey: slpKeys.viewer(input.personaId) }),
  });
}
export function useTriggerCreatorReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, interactionId, personaId }: { postId: string; interactionId: string; personaId: string }) =>
      api.post<SlpCreatorReplyResult>(
        `/slurp2/slurp/posts/${encodeURIComponent(postId)}/interactions/${encodeURIComponent(interactionId)}/creator-reply`,
        { personaId, debugMode: useSlurpUIStore.getState().debugMode },
      ),
    onSettled: (_result, _error, input) => qc.invalidateQueries({ queryKey: slpKeys.viewer(input.personaId) }),
  });
}
export function useRemoveCreatorInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      postId,
      actorAccountId: _actorAccountId,
      ...input
    }: { postId: string; actorAccountId?: string } & SlpCreatorRemoveInteractionInput) => {
      const params = new URLSearchParams({
        personaId: input.personaId,
        type: input.type,
      });
      if (input.parentInteractionId) params.set("parentInteractionId", input.parentInteractionId);
      return api.delete<SlpInteraction>(`/slurp2/slurp/posts/${encodeURIComponent(postId)}/interactions?${params}`);
    },
    onMutate: async (input) => {
      if (input.type !== "like") return undefined;
      await qc.cancelQueries({ queryKey: slpKeys.viewer(input.personaId) });
      const previous = qc.getQueryData<SlpCreatorViewerScope>(slpKeys.viewer(input.personaId));
      qc.setQueryData<SlpCreatorViewerScope | undefined>(slpKeys.viewer(input.personaId), (current) => {
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
      if (context?.previous) qc.setQueryData(slpKeys.viewer(input.personaId), context.previous);
    },
    onSettled: (_result, _error, input) => qc.invalidateQueries({ queryKey: slpKeys.viewer(input.personaId) }),
  });
}
export function useUpdateCreatorInteraction() {
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
      api.patch<SlpInteraction>(
        `/slurp2/slurp/posts/${encodeURIComponent(postId)}/interactions/${encodeURIComponent(interactionId)}`,
        { personaId, ...input },
      ),
    onSuccess: (_interaction, input) => qc.invalidateQueries({ queryKey: slpKeys.viewer(input.personaId) }),
  });
}
export function useDeleteCreatorInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, interactionId, personaId }: { postId: string; interactionId: string; personaId: string }) =>
      api.delete<SlpInteraction[]>(
        `/slurp2/slurp/posts/${encodeURIComponent(postId)}/interactions/${encodeURIComponent(interactionId)}?personaId=${encodeURIComponent(personaId)}`,
      ),
    onSuccess: (_deleted, input) => qc.invalidateQueries({ queryKey: slpKeys.viewer(input.personaId) }),
  });
}
