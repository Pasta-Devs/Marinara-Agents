import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { SlpPollInput } from "../../../../shared/src/slp/slp-social-generation.schema.js";
import type { SlpAccount, SlpInteraction } from "../../../../shared/src/slp/slp-social.types.js";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { errorMessage } from "./screens/SlpHomeHelpers";
import type { SlpPostCardModel, SlpPostImageUpdate } from "../modules/post/SlpPostTypes";
import type {
  useCreateCreatorInteraction,
  useDeleteCreatorInteraction,
  useRemoveCreatorInteraction,
  useTriggerCreatorReply,
  useUpdateCreatorInteraction,
} from "../features/feed/slp-feed-viewer-hooks";
import type {
  useDeleteCreatorPost,
  useReplaceCreatorPostImage,
  useUpdateCreatorPost,
  useRestoreCreatorPost,
} from "../features/feed/slp-feed-post-hooks";
import { slpKeys } from "../base/state/slp-query-keys";
import type { SlpCreatorViewerScope } from "../../../../shared/src/slp/slp-social.types";

/**
 * Everything the viewer does to a post or a comment: react, vote, reply, edit, delete.
 *
 * It came out of the Home hook whole, so the mutations it drives stay the ones the host already
 * holds; they arrive as dependencies instead of being called again here, because calling a
 * mutation hook twice would give the host and this hook two separate mutation states.
 */
export function useSlurpHomePostActions({
  localizeUi,
  viewerPersonaId,
  viewerActorAccount,
  confirmProviderDisclosure,
  createInteraction,
  removeInteraction,
  updateInteraction,
  deleteInteraction,
  triggerCreatorReply,
  replacePostImage,
  updatePost,
  deletePost,
  restorePost,
}: {
  localizeUi: (key: string, options?: Record<string, unknown>) => string;
  viewerPersonaId: string | null;
  viewerActorAccount: SlpAccount | null;
  confirmProviderDisclosure: () => Promise<boolean>;
  createInteraction: ReturnType<typeof useCreateCreatorInteraction>;
  removeInteraction: ReturnType<typeof useRemoveCreatorInteraction>;
  updateInteraction: ReturnType<typeof useUpdateCreatorInteraction>;
  deleteInteraction: ReturnType<typeof useDeleteCreatorInteraction>;
  triggerCreatorReply: ReturnType<typeof useTriggerCreatorReply>;
  replacePostImage: ReturnType<typeof useReplaceCreatorPostImage>;
  updatePost: ReturnType<typeof useUpdateCreatorPost>;
  deletePost: ReturnType<typeof useDeleteCreatorPost>;
  restorePost: ReturnType<typeof useRestoreCreatorPost>;
}) {
  const queryClient = useQueryClient();
  const [deletingPostIds, setDeletingPostIds] = useState<Set<string>>(() => new Set());
  const [deletedPostIds, setDeletedPostIds] = useState<Map<string, number>>(() => new Map());
  const [restoringPostIds, setRestoringPostIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const timers = [...deletedPostIds.entries()]
      .filter(([postId]) => !restoringPostIds.has(postId))
      .map(([postId, expiresAt]) =>
        window.setTimeout(
          () => {
            queryClient.setQueriesData<SlpCreatorViewerScope | undefined>(slpKeys.slpCreatorViewers(), (current) =>
              current
                ? {
                    ...current,
                    creators: current.creators.map((creator) => ({
                      ...creator,
                      posts: creator.posts.filter((post) => post.id !== postId),
                    })),
                  }
                : current,
            );
            setDeletedPostIds((current) => {
              const next = new Map(current);
              next.delete(postId);
              return next;
            });
          },
          Math.max(0, expiresAt - Date.now()),
        ),
      );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [deletedPostIds, restoringPostIds, queryClient]);
  const reactToPost = (post: SlpPostCardModel, type: "like", active = false) => {
    if (!viewerPersonaId) return;
    const onError = (error: unknown) =>
      toast.error(
        errorMessage(
          error,
          active
            ? localizeUi("ui.noodle.noodlerhome.couldNotUndoThatReaction")
            : localizeUi("ui.noodle.noodlerhome.couldNotReactToThisPost"),
        ),
      );
    const actorAccountId = viewerActorAccount?.id;
    if (active)
      removeInteraction.mutate({ postId: post.id, personaId: viewerPersonaId, actorAccountId, type }, { onError });
    else createInteraction.mutate({ postId: post.id, personaId: viewerPersonaId, actorAccountId, type }, { onError });
  };
  const reactToReply = (post: SlpPostCardModel, reply: SlpInteraction, active: boolean) => {
    if (!viewerPersonaId) return;
    const payload = {
      postId: post.id,
      personaId: viewerPersonaId,
      actorAccountId: viewerActorAccount?.id,
      type: "like" as const,
      parentInteractionId: reply.id,
    };
    const onError = (error: unknown) =>
      toast.error(errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotReactToThisReply")));
    if (active) removeInteraction.mutate(payload, { onError });
    else createInteraction.mutate(payload, { onError });
  };
  const voteInPoll = (post: SlpPostCardModel, optionId: string, selectedOptionId: string | null) => {
    if (!viewerPersonaId || optionId === selectedOptionId) return;
    createInteraction.mutate(
      {
        postId: post.id,
        personaId: viewerPersonaId,
        actorAccountId: viewerActorAccount?.id,
        type: "vote",
        content: optionId,
      },
      {
        onError: (error) =>
          toast.error(errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotVoteInThisPoll"))),
      },
    );
  };
  const submitReply = async (
    post: SlpPostCardModel,
    input: {
      content: string;
      parentInteractionId: string | null;
      askForReply: boolean;
    },
  ) => {
    if (!viewerPersonaId) return;
    if (input.askForReply && !(await confirmProviderDisclosure())) return;
    const viewerReply = await createInteraction.mutateAsync(
      {
        postId: post.id,
        personaId: viewerPersonaId,
        type: "reply",
        content: input.content,
        ...(input.parentInteractionId ? { parentInteractionId: input.parentInteractionId } : {}),
      },
      {
        onError: (error) => toast.error(errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotPostThisReply"))),
      },
    );
    if (!input.askForReply) return;
    try {
      await triggerCreatorReply.mutateAsync({
        postId: post.id,
        interactionId: viewerReply.id,
        personaId: viewerPersonaId,
      });
    } catch (error) {
      toast.error(errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotGenerateCreatorReply")));
    }
  };
  const savePost = async (
    post: SlpPostCardModel,
    input: {
      title: string | null;
      content: string;
      image: SlpPostImageUpdate | null;
      poll?: SlpPollInput | null;
    },
  ) => {
    try {
      if (input.image?.kind === "replace") {
        await replacePostImage.mutateAsync({
          id: post.id,
          accountId: post.authorAccountId,
          file: input.image.file,
          crop: input.image.crop,
          title: input.title,
          ...(input.content !== post.content.trim() && { content: input.content }),
          ...(input.poll !== undefined && { poll: input.poll }),
        });
      } else {
        await updatePost.mutateAsync({
          id: post.id,
          accountId: post.authorAccountId,
          title: input.title,
          ...(input.content !== post.content.trim() && { content: input.content }),
          ...(input.poll !== undefined && { poll: input.poll }),
          ...(input.image?.kind === "crop" && { imageCrop: input.image.crop }),
          ...(input.image?.kind === "remove" && { removeImage: true }),
        });
      }
    } catch (error) {
      toast.error(errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotUpdateThisPost")));
      throw error;
    }
  };
  const deleteNoodlePost = async (post: SlpPostCardModel) => {
    const confirmed = await showConfirmDialog({
      title: localizeUi("ui.noodle.noodlerhome.deleteNoodlerPost"),
      message: localizeUi("ui.slurp.posts.deleteDetail"),
      confirmLabel: localizeUi("ui.noodle.noodlehome.deletePost"),
      tone: "destructive",
    });
    if (!confirmed) return;
    setDeletingPostIds((current) => new Set(current).add(post.id));
    deletePost.mutate(
      { id: post.id, accountId: post.authorAccountId },
      {
        onError: (error) => {
          setDeletingPostIds((current) => {
            const next = new Set(current);
            next.delete(post.id);
            return next;
          });
          toast.error(errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotDeleteThisPost")));
        },
        onSuccess: () => {
          setDeletingPostIds((current) => {
            const next = new Set(current);
            next.delete(post.id);
            return next;
          });
          setDeletedPostIds((current) => new Map(current).set(post.id, Date.now() + 60_000));
        },
      },
    );
  };
  const restoreNoodlePost = (post: SlpPostCardModel) => {
    if (restoringPostIds.has(post.id)) return;
    setRestoringPostIds((current) => new Set(current).add(post.id));
    restorePost.mutate(
      { id: post.id, accountId: post.authorAccountId },
      {
        onError: (error) => {
          setRestoringPostIds((current) => {
            const next = new Set(current);
            next.delete(post.id);
            return next;
          });
          toast.error(
            errorMessage(
              error,
              localizeUi("ui.slurp.feed.restoreFailed", { defaultValue: "Could not restore this post." }),
            ),
          );
        },
        onSuccess: () => {
          setRestoringPostIds((current) => {
            const next = new Set(current);
            next.delete(post.id);
            return next;
          });
          setDeletedPostIds((current) => {
            const next = new Map(current);
            next.delete(post.id);
            return next;
          });
        },
      },
    );
  };
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editingReplyContent, setEditingReplyContent] = useState("");
  const startEditingReply = (reply: SlpInteraction) => {
    setEditingReplyId(reply.id);
    setEditingReplyContent(reply.content ?? "");
  };
  const cancelEditingReply = () => {
    setEditingReplyId(null);
    setEditingReplyContent("");
  };
  const saveEditedReply = (post: SlpPostCardModel, reply: SlpInteraction) => {
    if (!viewerPersonaId) return;
    const content = editingReplyContent.trim();
    if (!content && !reply.imageUrl) {
      toast.error(localizeUi("ui.noodle.noodlehome.commentsNeedTextOrAnImage"));
      return;
    }
    updateInteraction.mutate(
      {
        postId: post.id,
        interactionId: reply.id,
        personaId: viewerPersonaId,
        content,
      },
      {
        onSuccess: cancelEditingReply,
        onError: (error) => toast.error(errorMessage(error, localizeUi("ui.slurp.comment.editError"))),
      },
    );
  };
  const deleteNoodleReply = async (post: SlpPostCardModel, reply: SlpInteraction) => {
    const confirmed = await showConfirmDialog({
      title: localizeUi("ui.slurp.comment.deleteTitle"),
      message: localizeUi("ui.noodle.noodlehome.thisRemovesTheCommentAndAnyRepliesOrLikes"),
      confirmLabel: localizeUi("ui.noodle.noodlepostcard.deleteComment"),
      tone: "destructive",
    });
    if (!confirmed || !viewerPersonaId) return;
    deleteInteraction.mutate(
      { postId: post.id, interactionId: reply.id, personaId: viewerPersonaId },
      {
        onError: (error) => toast.error(errorMessage(error, localizeUi("ui.slurp.comment.deleteError"))),
      },
    );
  };
  return {
    reactToPost,
    reactToReply,
    voteInPoll,
    submitReply,
    savePost,
    deleteNoodlePost,
    deletingPostIds,
    restoreNoodlePost,
    deletedPostIds,
    restoringPostIds,
    editingReplyId,
    editingReplyContent,
    setEditingReplyContent,
    startEditingReply,
    cancelEditingReply,
    setEditingReplyId,
    saveEditedReply,
    deleteNoodleReply,
  };
}
