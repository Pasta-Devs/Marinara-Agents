import { useState, useRef, type ChangeEvent } from "react";
import {
  noodlePollInputSchema,
  readNoodlePostImageCrop,
  readNoodlePollFromMetadata,
  type NoodlePostImageCrop,
  type NoodlePollInput,
} from "@marinara-engine/shared";
import type { ConversationMediaPickerTabId } from "../../../components/chat/ConversationMediaPickerPanel";
import type { ChatImage } from "../../../hooks/use-gallery";
import type {
  ActiveComposerMention,
  NoodlePostCardCtx,
  NoodlePostCardControllerOptions,
  NoodlePostCardModel,
  NoodlePostImageCropSource,
  NoodlePostImageUpdate,
  ReplyComposerTool,
} from "./SlpPostTypes";

export function useNoodlePostImageEditor(loadPostImage?: (post: NoodlePostCardModel) => Promise<File | string>) {
  const [update, setUpdate] = useState<NoodlePostImageUpdate | null>(null);
  const [cropSource, setCropSource] = useState<NoodlePostImageCropSource | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const revisionRef = useRef(0);

  const reset = () => {
    revisionRef.current += 1;
    setUpdate(null);
    setCropSource(null);
    setLoading(false);
    setError(null);
  };
  const beginCrop = (post: NoodlePostCardModel) => {
    if (!loadPostImage || loading) return;
    if (update?.kind === "replace") {
      setCropSource({
        source: update.file,
        crop: update.crop,
        mode: "replace",
      });
      setError(null);
      return;
    }
    if (!post.imageUrl) return;
    const revision = ++revisionRef.current;
    setLoading(true);
    setError(null);
    void loadPostImage(post)
      .then((source) => {
        if (revisionRef.current === revision) {
          setCropSource({
            source,
            crop: update?.kind === "crop" ? update.crop : readNoodlePostImageCrop(post.metadata),
            mode: "existing",
          });
        }
      })
      .catch((caught) => {
        if (revisionRef.current === revision) {
          setError(caught instanceof Error ? caught.message : "Could not load this image.");
        }
      })
      .finally(() => {
        if (revisionRef.current === revision) setLoading(false);
      });
  };
  const selectReplacement = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    setCropSource({ source: file, crop: null, mode: "replace" });
    setError(null);
  };
  const applyCrop = async (crop: NoodlePostImageCrop) => {
    if (!cropSource) return;
    setUpdate(
      cropSource.mode === "replace" ? { kind: "replace", file: cropSource.source, crop } : { kind: "crop", crop },
    );
    setCropSource(null);
    setError(null);
  };

  return {
    update,
    reset,
    cap: loadPostImage
      ? {
          update,
          cropSource,
          loading,
          error,
          fileInputRef,
          beginCrop,
          selectReplacement,
          applyCrop,
          cancelCrop: () => setCropSource(null),
          remove: () => {
            setUpdate({ kind: "remove" });
            setCropSource(null);
            setError(null);
          },
          restore: () => {
            setUpdate(null);
            setCropSource(null);
            setError(null);
          },
        }
      : undefined,
  };
}

export function useNoodlePostCardController(options: NoodlePostCardControllerOptions) {
  const [postMenuId, setPostMenuId] = useState<string | null>(null);
  const [imageLightbox, setImageLightbox] = useState<ChatImage | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostContent, setEditingPostContent] = useState("");
  const [editingPostTitle, setEditingPostTitle] = useState("");
  const [editingPostPoll, setEditingPostPoll] = useState<NoodlePollInput | null>(null);
  const [replyPostId, setReplyPostId] = useState<string | null>(null);
  const [replyParentInteractionId, setReplyParentInteractionId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyHasText, setReplyHasText] = useState(false);
  // Defaults on: an unanswered comment is the dull case, so opting out is the deliberate act.
  const [askForReply, setAskForReply] = useState(true);
  const [activeReplyComposerTool, setActiveReplyComposerTool] = useState<ReplyComposerTool | null>(null);
  const [mediaPickerTab, setMediaPickerTab] = useState<ConversationMediaPickerTabId>("emoji");
  const replyComposerRef = useRef<HTMLTextAreaElement | null>(null);
  const replyValueRef = useRef("");
  const replyMediaToolRef = useRef<HTMLDivElement | null>(null);
  const imageEditor = useNoodlePostImageEditor(options.imageEditing?.loadPostImage);

  const clearReplyComposer = () => {
    setReplyPostId(null);
    setReplyParentInteractionId(null);
    setReplyText("");
    replyValueRef.current = "";
    setReplyHasText(false);
    setActiveReplyComposerTool(null);
    setAskForReply(true);
    if (replyComposerRef.current) replyComposerRef.current.value = "";
  };
  const cancelEditingPost = () => {
    setEditingPostId(null);
    setEditingPostContent("");
    setEditingPostTitle("");
    setEditingPostPoll(null);
    imageEditor.reset();
  };
  const reset = () => {
    clearReplyComposer();
    setPostMenuId(null);
    cancelEditingPost();
  };
  const openReplyComposer = (postId: string, parentInteractionId: string | null = null) => {
    clearReplyComposer();
    setReplyPostId(postId);
    setReplyParentInteractionId(parentInteractionId);
  };
  const handleReplyChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    replyValueRef.current = event.target.value;
    setReplyHasText(event.target.value.trim().length > 0);
  };
  const appendToReply = (text: string) => {
    const next = replyValueRef.current + text;
    replyValueRef.current = next;
    setReplyText(next);
    setReplyHasText(next.trim().length > 0);
    if (replyComposerRef.current) replyComposerRef.current.value = next;
  };
  const startEditingPost = (post: NoodlePostCardModel) => {
    setPostMenuId(null);
    setEditingPostId(post.id);
    setEditingPostTitle(post.title ?? "");
    setEditingPostContent(post.content);
    const poll = readNoodlePollFromMetadata(post.metadata);
    setEditingPostPoll(
      poll
        ? {
            question: poll.question,
            options: poll.options.map((option) => option.label),
          }
        : null,
    );
    imageEditor.reset();
  };
  const saveEditedPost = (post: NoodlePostCardModel) => {
    const content = editingPostContent.trim();
    const existingPoll = readNoodlePollFromMetadata(post.metadata);
    const validPoll = existingPoll ? noodlePollInputSchema.safeParse(editingPostPoll).success : false;
    if (!content && !(options.allowPollOnlyEdits && validPoll)) return;
    void options
      .savePost(post, {
        title: editingPostTitle.trim() || null,
        content,
        image: imageEditor.update,
        ...(existingPoll && { poll: editingPostPoll }),
      })
      .then(cancelEditingPost)
      .catch(() => {});
  };
  const submitReply = (post: NoodlePostCardModel) => {
    const content = replyValueRef.current.trim();
    if (!content) return;
    void options
      .submitReply(post, {
        content,
        parentInteractionId: replyParentInteractionId,
        askForReply:
          options.creatorReplyRequest && options.personaAccount?.id !== post.authorAccountId ? askForReply : false,
      })
      .then(clearReplyComposer)
      .catch(() => {});
  };
  const deletePost = (post: NoodlePostCardModel) => {
    setPostMenuId(null);
    options.deletePost(post);
  };

  const ctx: NoodlePostCardCtx = {
    setImageLightbox,
    personaAccount: options.personaAccount,
    postManagement: options.postManagement,
    postShowMoreLength: options.postShowMoreLength,
    postMenuId,
    setPostMenuId,
    editingPostId,
    editingPostContent,
    setEditingPostContent,
    replyPostId,
    replyParentInteractionId,
    replyText,
    replyHasText,
    setReplyText,
    activeReplyComposerTool,
    setActiveReplyComposerTool,
    highlightedInteractionId: null,
    mediaPickerTab,
    setMediaPickerTab,
    replyComposerRef,
    replyValueRef,
    replyMediaToolRef,
    startEditingPost,
    deleteNoodlePost: deletePost,
    cancelEditingPost,
    saveEditedPost,
    reactToPost: options.reactToPost,
    reactToReply: options.reactToReply,
    openReplyComposer,
    handleReplyChange,
    clearReplyComposer,
    submitReply,
    creatorReplyRequest: options.creatorReplyRequest ? { asked: askForReply, setAsked: setAskForReply } : undefined,
    appendToReply,
    reactionPendingFor: options.reactionPendingFor,
    createInteractionPendingFor: options.createInteractionPendingFor,
    updatePostPending: options.updatePostPending,
    openAuthorProfile: options.openAuthorProfile,
    voteInPoll: options.voteInPoll,
    deduplicatePollBody: options.deduplicatePollBody ?? true,
    imageEditing: imageEditor.cap,
    titleEditing: options.titleMaxLength
      ? {
          editingPostTitle,
          setEditingPostTitle,
          maxLength: options.titleMaxLength,
        }
      : undefined,
    pollEditing: {
      value: editingPostPoll,
      setValue: setEditingPostPoll,
    },
    allowPollOnlyEdits: options.allowPollOnlyEdits,
  };
  return { ctx, reset, imageLightbox, setImageLightbox };
}
