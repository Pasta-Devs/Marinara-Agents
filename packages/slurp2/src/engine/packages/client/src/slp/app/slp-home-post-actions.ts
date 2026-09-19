import { useState } from "react";
import { toast } from "sonner";
import type { SlpPollInput } from "../../../../shared/src/slp/slp-social-generation.schema.js";
import type { SlpAccount, SlpInteraction } from "../../../../shared/src/slp/slp-social.types.js";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { errorMessage } from "./screens/SlpHomeHelpers";
import type { NoodlePostCardModel, NoodlePostImageUpdate } from "../modules/post/SlpPostCard";
import type {
  useCreateNoodlerInteraction,
  useDeleteNoodlerInteraction,
  useRemoveNoodlerInteraction,
  useTriggerNoodlerCreatorReply,
  useUpdateNoodlerInteraction,
} from "../features/feed/slp-feed-viewer-hooks";
import type {
  useDeleteNoodlerPost,
  useReplaceNoodlerPostImage,
  useUpdateNoodlerPost,
} from "../features/feed/slp-feed-post-hooks";

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
}: {
  localizeUi: (key: string, options?: Record<string, unknown>) => string;
  viewerPersonaId: string | null;
  viewerActorAccount: SlpAccount | null;
  confirmProviderDisclosure: () => Promise<boolean>;
  createInteraction: ReturnType<typeof useCreateNoodlerInteraction>;
  removeInteraction: ReturnType<typeof useRemoveNoodlerInteraction>;
  updateInteraction: ReturnType<typeof useUpdateNoodlerInteraction>;
  deleteInteraction: ReturnType<typeof useDeleteNoodlerInteraction>;
  triggerCreatorReply: ReturnType<typeof useTriggerNoodlerCreatorReply>;
  replacePostImage: ReturnType<typeof useReplaceNoodlerPostImage>;
  updatePost: ReturnType<typeof useUpdateNoodlerPost>;
  deletePost: ReturnType<typeof useDeleteNoodlerPost>;
}) {
  const reactToPost = (post: NoodlePostCardModel, type: "like", active = false) => {
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
  const reactToReply = (post: NoodlePostCardModel, reply: SlpInteraction, active: boolean) => {
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
  const voteInPoll = (post: NoodlePostCardModel, optionId: string, selectedOptionId: string | null) => {
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
    post: NoodlePostCardModel,
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
    post: NoodlePostCardModel,
    input: {
      title: string | null;
      content: string;
      image: NoodlePostImageUpdate | null;
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
  const deleteNoodlePost = async (post: NoodlePostCardModel) => {
    const confirmed = await showConfirmDialog({
      title: localizeUi("ui.noodle.noodlerhome.deleteNoodlerPost"),
      message: localizeUi("ui.slurp.posts.deleteDetail"),
      confirmLabel: localizeUi("ui.noodle.noodlehome.deletePost"),
      tone: "destructive",
    });
    if (!confirmed) return;
    deletePost.mutate(
      { id: post.id, accountId: post.authorAccountId },
      {
        onError: (error) =>
          toast.error(errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotDeleteThisPost"))),
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
  const saveEditedReply = (post: NoodlePostCardModel, reply: SlpInteraction) => {
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
  const deleteNoodleReply = async (post: NoodlePostCardModel, reply: SlpInteraction) => {
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
