import {
  AtSign,
  ChevronDown,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Share2,
  Trash2,
} from "lucide-react";
import { Fragment, useRef, useState } from "react";
import { readSlpPollFromMetadata } from "../../../../../shared/src/slp/slp-polls.js";
import { readSlpPostImageCrop } from "../../../../../shared/src/slp/slp-post-images.js";
import { slpPollInputSchema } from "../../../../../shared/src/slp/slp-social.schema.js";
import { type SlpAccount, type SlpInteraction } from "../../../../../shared/src/slp/slp-social.types.js";
import { toast } from "sonner";
import { api } from "../../../lib/api-client";
import { cn } from "../../../lib/utils";
import type { ChatImage } from "../../../hooks/use-gallery";
import { SlpPostReplyRow } from "./SlpPostReplyRow";
import { SlpPostReplyComposer } from "./SlpPostReplyComposer";
import { Avatar } from "../../base/chrome/SlpChrome";
import { formatTime } from "../../base/ui/slp-date-time";
import { SlpPollComposer } from "../poll/SlpPollComposer";
import { SlurpLikedBy } from "../audience/SlpFanCard";
import { PostImageFrame } from "../../base/media/SlpPostImageCropEditor";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  slpIconButtonClass,
  slurpReplyThreads,
  SlurpClampedText,
  SlpPollCard,
  countInteractions,
  createSlpLightboxImage,
  PostImageEditControls,
} from "./SlpPostHelpers";
import type { SlpPostCardModel, SlpPostCardCtx } from "./SlpPostHelpers";

export function SlpPostCard({ post, ctx }: { post: SlpPostCardModel; ctx: SlpPostCardCtx }) {
  const { t: localizeUi, i18n } = useUiTranslation();
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [expandedThreadIds, setExpandedThreadIds] = useState<ReadonlySet<string>>(new Set());
  // null while the stored prompt is only shown; a string while it is being rewritten for a retry.
  const [promptDraft, setPromptDraft] = useState<string | null>(null);
  const promptEditor = promptDraft !== null && (
    <>
      <textarea
        value={promptDraft}
        onChange={(event) => setPromptDraft(event.target.value)}
        rows={4}
        maxLength={2000}
        aria-label={localizeUi("ui.noodle.noodlepostcard.imagePrompt")}
        className="w-full rounded-lg border border-[var(--noodle-divider)] bg-[var(--background)] p-2 text-xs leading-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={!promptDraft.trim() || ctx.generatingPostImageId === post.id}
          onClick={() => {
            ctx.generatePostImage?.(post, promptDraft.trim());
            setPromptDraft(null);
          }}
          className="min-h-9 rounded-lg bg-[var(--noodle-accent)] px-3 font-semibold text-zinc-950 disabled:opacity-50"
        >
          {localizeUi("ui.slurp.image.generate")}
        </button>
        <button
          type="button"
          onClick={() => setPromptDraft(null)}
          className="min-h-9 rounded-lg px-3 font-semibold text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
        >
          {localizeUi("ui.slurp.actions.cancel")}
        </button>
      </div>
    </>
  );
  const {
    personaAccount,
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
    highlightedInteractionId,
    mediaPickerTab,
    setMediaPickerTab,
    replyComposerRef,
    replyValueRef,
    replyMediaToolRef,
    startEditingPost,
    deleteNoodlePost,
    cancelEditingPost,
    saveEditedPost,
    reactToPost,
    reactToReply,
    openReplyComposer,
    handleReplyChange,
    clearReplyComposer,
    submitReply,
    appendToReply,
    reactionPendingFor,
    createInteractionPendingFor,
    updatePostPending,
    titleEditing,
    pollEditing,
    imageEditing,
    media,
    replyManagement,
    mentions,
  } = ctx;
  const accountById = ctx.accountById ?? new Map<string, SlpAccount>();
  const accountByHandle = ctx.accountByHandle ?? new Map<string, SlpAccount>();
  const authorAccount = accountById.get(post.authorAccountId) ?? null;
  const author = authorAccount ?? post.authorSnapshot;
  const imageCrop = readSlpPostImageCrop(post.metadata);

  // Card-owned defaults for absent capability groups. Hosts pass only the capabilities they
  // support; the card fills the
  // rest with no-ops and empty state, and gates the corresponding UI on group presence — so
  // no host has to hand over discarded setters, dangling refs, or fake mutations. Annotations
  // keep the () => {} fallbacks callable with their real signatures.
  const fallbackDivRef = useRef<HTMLDivElement | null>(null);
  const fallbackFileRef = useRef<HTMLInputElement | null>(null);
  const openProfile: (account: SlpAccount | null) => void = ctx.openProfile ?? (() => {});
  const canOpenAuthorProfile = Boolean(authorAccount || ctx.openAuthorProfile);
  const openPostAuthor = () => {
    if (authorAccount) openProfile(authorAccount);
    else ctx.openAuthorProfile?.(post.authorAccountId);
  };
  const handleReplyKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void =
    ctx.handleReplyKeyDown ?? (() => {});
  const voteInPoll: (post: SlpPostCardModel, optionId: string, selectedOptionId: string | null) => void =
    ctx.voteInPoll ?? (() => {});
  const disableReplyImage = !media;
  const setImageLightbox: React.Dispatch<React.SetStateAction<ChatImage | null>> =
    ctx.setImageLightbox ?? media?.setImageLightbox ?? (() => {});
  const replyImageUrl = media?.replyImageUrl ?? "";
  const setReplyImageUrl: React.Dispatch<React.SetStateAction<string>> = media?.setReplyImageUrl ?? (() => {});
  const replyImageUrlDraft = media?.replyImageUrlDraft ?? "";
  const setReplyImageUrlDraft: React.Dispatch<React.SetStateAction<string>> =
    media?.setReplyImageUrlDraft ?? (() => {});
  const replyImageToolRef = media?.replyImageToolRef ?? fallbackDivRef;
  const replyImageFileRef = media?.replyImageFileRef ?? fallbackFileRef;
  const applyReplyImageUrl: () => void = media?.applyReplyImageUrl ?? (() => {});
  const uploadGlobalImages = media?.uploadGlobalImages ?? { isPending: false };
  const editingReplyId = replyManagement?.editingReplyId ?? null;
  const editingReplyContent = replyManagement?.editingReplyContent ?? "";
  const setEditingReplyContent: React.Dispatch<React.SetStateAction<string>> =
    replyManagement?.setEditingReplyContent ?? (() => {});
  const startEditingReply: (reply: SlpInteraction) => void = replyManagement?.startEditingReply ?? (() => {});
  const cancelEditingReply: () => void = replyManagement?.cancelEditingReply ?? (() => {});
  const saveEditedReply: (post: SlpPostCardModel, reply: SlpInteraction) => void =
    replyManagement?.saveEditedReply ?? (() => {});
  const deleteNoodleReply: (post: SlpPostCardModel, reply: SlpInteraction) => void =
    replyManagement?.deleteNoodleReply ?? (() => {});
  const updateInteraction = replyManagement?.updateInteraction ?? {
    isPending: false,
  };
  const deleteInteraction = replyManagement?.deleteInteraction ?? {
    isPending: false,
  };
  const canManageReplyOverride = replyManagement?.canManageReply;
  const activeReplyMention = mentions?.activeReplyMention ?? null;
  const activeReplyMentionIndex = mentions?.activeReplyMentionIndex ?? 0;
  const replyMentionSuggestions = mentions?.replyMentionSuggestions ?? [];
  const selectReplyMention: (account: SlpAccount) => void = mentions?.selectReplyMention ?? (() => {});

  const postInteractions = post.interactions;
  const rootPostInteractions = postInteractions.filter((interaction) => !interaction.parentInteractionId);
  const poll = readSlpPollFromMetadata(post.metadata);
  const pollVotes = poll
    ? rootPostInteractions.filter(
        (interaction) =>
          interaction.type === "vote" && poll.options.some((option) => option.id === interaction.content),
      )
    : [];
  const personaPollVote = personaAccount
    ? (pollVotes.find((interaction) => interaction.actorAccountId === personaAccount.id)?.content ?? null)
    : null;
  const likedByPersona = personaAccount
    ? rootPostInteractions.some(
        (interaction) => interaction.type === "like" && interaction.actorAccountId === personaAccount.id,
      )
    : false;
  const replies = postInteractions.filter((interaction) => interaction.type === "reply");
  const replyById = new Map(replies.map((reply) => [reply.id, reply]));
  const orderedReplies: SlpInteraction[] = [];
  const visitedReplyIds = new Set<string>();
  const appendReplyBranch = (reply: SlpInteraction) => {
    if (visitedReplyIds.has(reply.id)) return;
    visitedReplyIds.add(reply.id);
    orderedReplies.push(reply);
    for (const child of replies) {
      if (child.parentInteractionId === reply.id) appendReplyBranch(child);
    }
  };
  for (const reply of replies) {
    if (!reply.parentInteractionId || !replyById.has(reply.parentInteractionId)) appendReplyBranch(reply);
  }
  for (const reply of replies) appendReplyBranch(reply);
  const replyThreads = slurpReplyThreads(orderedReplies, replyById);
  // An older thread stays on screen while it holds the open reply composer or a linked comment.
  const threadIsActive = (thread: (typeof replyThreads)[number]) =>
    [thread.root, ...thread.children].some(
      (reply) => reply.id === highlightedInteractionId || reply.id === replyParentInteractionId,
    );
  const visibleThreads = commentsExpanded
    ? replyThreads
    : replyThreads.filter((thread, index) => index >= replyThreads.length - 2 || threadIsActive(thread));
  const hiddenReplyCount = replyThreads
    .filter((thread) => !visibleThreads.includes(thread))
    .reduce((sum, thread) => sum + 1 + thread.children.length, 0);
  const toggleThread = (rootId: string) =>
    setExpandedThreadIds((current) => {
      const next = new Set(current);
      if (!next.delete(rootId)) next.add(rootId);
      return next;
    });
  const replyTarget = replyParentInteractionId ? (replyById.get(replyParentInteractionId) ?? null) : null;
  const replyTargetActor = replyTarget
    ? (accountById.get(replyTarget.actorAccountId) ?? replyTarget.actorSnapshot)
    : author;
  const postLikePending = reactionPendingFor(post.id, "like");
  const postReplyPending = createInteractionPendingFor(post.id, "reply", replyParentInteractionId);
  const pollVotePending = createInteractionPendingFor(post.id, "vote");
  const renderReplyComposer = (nested: boolean) => (
    <SlpPostReplyComposer
      nested={nested}
      post={post}
      replyParentInteractionId={replyParentInteractionId}
      replyTargetActor={replyTargetActor}
      replyText={replyText}
      replyHasText={replyHasText}
      replyComposerRef={replyComposerRef}
      replyValueRef={replyValueRef}
      handleReplyChange={handleReplyChange}
      handleReplyKeyDown={handleReplyKeyDown}
      setReplyText={setReplyText}
      activeReplyMention={activeReplyMention}
      activeReplyMentionIndex={activeReplyMentionIndex}
      replyMentionSuggestions={replyMentionSuggestions}
      selectReplyMention={selectReplyMention}
      replyImageUrl={replyImageUrl}
      setReplyImageUrl={setReplyImageUrl}
      setImageLightbox={setImageLightbox}
      disableReplyImage={disableReplyImage}
      activeReplyComposerTool={activeReplyComposerTool}
      setActiveReplyComposerTool={setActiveReplyComposerTool}
      replyImageToolRef={replyImageToolRef}
      replyMediaToolRef={replyMediaToolRef}
      replyImageFileRef={replyImageFileRef}
      replyImageUrlDraft={replyImageUrlDraft}
      setReplyImageUrlDraft={setReplyImageUrlDraft}
      applyReplyImageUrl={applyReplyImageUrl}
      uploadGlobalImages={uploadGlobalImages}
      clearReplyComposer={clearReplyComposer}
      postReplyPending={postReplyPending}
      submitReply={submitReply}
      appendToReply={appendToReply}
      mediaPickerTab={mediaPickerTab}
      setMediaPickerTab={setMediaPickerTab}
      personaAccount={personaAccount}
      creatorReplyRequest={ctx.creatorReplyRequest}
    />
  );
  const editingExistingPoll = Boolean(poll && pollEditing);
  const editingPollIsValid = !editingExistingPoll || slpPollInputSchema.safeParse(pollEditing?.value).success;
  const postEditActions = (
    <>
      <button
        type="button"
        onClick={cancelEditingPost}
        className="h-8 rounded-full border border-[var(--noodle-divider)] px-4 text-xs font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--accent)]"
      >
        {localizeUi("chat.delete.dialog.cancel")}
      </button>
      <button
        type="button"
        onClick={() => saveEditedPost(post)}
        disabled={
          (!editingPostContent.trim() && !(ctx.allowPollOnlyEdits && editingPollIsValid && editingExistingPoll)) ||
          !editingPollIsValid ||
          updatePostPending ||
          imageEditing?.loading ||
          Boolean(imageEditing?.cropSource)
        }
        className="h-8 rounded-full bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {updatePostPending ? localizeUi("ui.noodle.noodlehome.saving") : localizeUi("ui.noodle.noodlehome.save")}
      </button>
    </>
  );
  const renderReplyRow = (reply: SlpInteraction, nested: boolean) => (
    <SlpPostReplyRow
      reply={reply}
      nested={nested}
      post={post}
      accountById={accountById}
      accountByHandle={accountByHandle}
      personaAccount={personaAccount}
      highlightedInteractionId={highlightedInteractionId}
      openProfile={openProfile}
      replyPostId={replyPostId}
      replyParentInteractionId={replyParentInteractionId}
      replyById={replyById}
      postInteractions={postInteractions}
      editingReplyId={editingReplyId}
      editingReplyContent={editingReplyContent}
      setEditingReplyContent={setEditingReplyContent}
      cancelEditingReply={cancelEditingReply}
      updateInteraction={updateInteraction}
      deleteInteraction={deleteInteraction}
      startEditingReply={startEditingReply}
      saveEditedReply={saveEditedReply}
      deleteNoodleReply={deleteNoodleReply}
      canManageReplyOverride={canManageReplyOverride}
      reactToReply={reactToReply}
      reactionPendingFor={reactionPendingFor}
      openReplyComposer={openReplyComposer}
      setImageLightbox={setImageLightbox}
      renderReplyComposer={renderReplyComposer}
    />
  );

  return (
    <article
      key={post.id}
      data-noodle-post-id={post.id}
      tabIndex={-1}
      className="rounded-lg border border-[var(--noodle-divider)] bg-[var(--slurp-surface)] px-4 py-4 shadow-sm shadow-black/5 transition-colors hover:bg-[var(--slurp-surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
    >
      <div className="flex gap-3">
        {author ? (
          <button
            type="button"
            onClick={openPostAuthor}
            disabled={!canOpenAuthorProfile}
            className="h-fit rounded-full text-left transition-opacity enabled:hover:opacity-80 disabled:cursor-default"
            title={
              canOpenAuthorProfile
                ? localizeUi("ui.noodle.noodlehome.viewValue1", {
                    value1: author.handle,
                  })
                : undefined
            }
          >
            <Avatar account={author} />
          </button>
        ) : (
          <AtSign size={28} className="text-[var(--noodle-accent)]" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
              <button
                type="button"
                onClick={openPostAuthor}
                disabled={!canOpenAuthorProfile}
                className="font-semibold transition-colors enabled:hover:text-[var(--noodle-accent)] disabled:cursor-default"
              >
                {author?.displayName ?? localizeUi("ui.slurp.profile.fallbackUser")}
              </button>
              <span className="text-xs text-[var(--muted-foreground)]">
                @{author?.handle ?? localizeUi("ui.slurp.profile.fallbackHandle")}
              </span>
              <span className="text-xs text-[var(--muted-foreground)]">
                {formatTime(post.createdAt, i18n.language)}
              </span>
            </div>
            {/*
              The menu is on every post now, not only the ones you can manage: sharing is
              something any reader does. Edit and delete stay behind `postManagement`, so a
              viewer-only projection sees a menu with just Share in it.
            */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setPostMenuId((current) => (current === post.id ? null : post.id))}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10"
                title={localizeUi("ui.noodle.noodlepostcard.postActions")}
                aria-label={localizeUi("ui.noodle.noodlepostcard.postActions")}
              >
                <MoreHorizontal size={18} />
              </button>
              {postMenuId === post.id && (
                <div className="absolute right-0 top-[calc(100%+0.25rem)] z-30 min-w-32 overflow-hidden rounded-lg border border-[var(--noodle-divider)] bg-[var(--background)] py-1 text-xs shadow-2xl shadow-black/30">
                  {ctx.postManagement && (
                    <>
                      <button
                        type="button"
                        onClick={() => startEditingPost(post)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--accent)]"
                      >
                        <Pencil size={14} className="text-[var(--noodle-accent)]" />
                        {localizeUi("ui.noodle.noodlepostcard.edit")}
                      </button>
                      {post.imageUrl && ctx.generatePostImage && (
                        <button
                          type="button"
                          onClick={() => {
                            setPostMenuId(null);
                            setPromptDraft(post.imagePrompt ?? "");
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--accent)]"
                        >
                          <RefreshCw size={14} className="text-[var(--noodle-accent)]" />
                          {localizeUi("ui.slurp.image.regenerate", { defaultValue: "Regenerate image" })}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteNoodlePost(post)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--accent)]"
                      >
                        <Trash2 size={14} className="text-[var(--noodle-accent)]" />
                        {localizeUi("lorebook.editor.batch.delete")}
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setPostMenuId(null);
                      const persona = ctx.personaAccount?.entityId;
                      void api
                        .download(
                          `/slurp2/slurp/posts/${encodeURIComponent(post.id)}/share-card${
                            persona ? `?personaId=${encodeURIComponent(persona)}` : ""
                          }`,
                          `slurp-${post.id}.png`,
                        )
                        .catch((error: unknown) =>
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : localizeUi("ui.slurp.post.shareFailed", {
                                  defaultValue: "Could not build the share image.",
                                }),
                          ),
                        );
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--accent)]"
                  >
                    <Share2 size={14} className="text-[var(--noodle-accent)]" />
                    {localizeUi("ui.slurp.post.share", { defaultValue: "Share as image" })}
                  </button>
                </div>
              )}
            </div>
          </div>
          {ctx.postManagement && editingPostId === post.id ? (
            <div className="mt-2 space-y-2">
              {titleEditing && (
                <label className="block">
                  <span className="sr-only">{localizeUi("ui.noodle.noodlepostcard.titleOptional")}</span>
                  <input
                    value={titleEditing.editingPostTitle}
                    onChange={(event) => titleEditing.setEditingPostTitle(event.target.value)}
                    maxLength={titleEditing.maxLength}
                    className="h-9 w-full rounded-lg border-0 bg-[var(--noodle-accent)]/5 px-3 text-base font-bold text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] focus:bg-[var(--noodle-accent)]/10"
                    placeholder={localizeUi("ui.noodle.noodlepostcard.titleOptional")}
                  />
                </label>
              )}
              <textarea
                value={editingPostContent}
                onChange={(event) => setEditingPostContent(event.target.value)}
                className="min-h-20 w-full resize-none rounded-lg border-0 bg-[var(--noodle-accent)]/5 px-3 py-2 text-[1rem] leading-6 text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] focus:bg-[var(--noodle-accent)]/10"
                placeholder={localizeUi("ui.noodle.noodlerpostcomposer.whatSSimmering")}
              />
              {imageEditing && (
                <PostImageEditControls
                  post={post}
                  editing={imageEditing}
                  disabled={updatePostPending}
                  footer={editingExistingPoll ? null : postEditActions}
                />
              )}
              {editingExistingPoll && pollEditing && (
                <SlpPollComposer
                  value={pollEditing.value}
                  onChange={pollEditing.setValue}
                  onClose={cancelEditingPost}
                  onSubmit={() => saveEditedPost(post)}
                  submitLabel={
                    updatePostPending
                      ? localizeUi("ui.noodle.noodlehome.saving")
                      : localizeUi("ui.noodle.noodlehome.save")
                  }
                  submitDisabled={
                    !editingPollIsValid ||
                    (!editingPostContent.trim() && !pollEditing.value) ||
                    updatePostPending ||
                    Boolean(imageEditing?.loading) ||
                    Boolean(imageEditing?.cropSource)
                  }
                  disabled={updatePostPending}
                  title={localizeUi("ui.noodle.noodlehome.editPoll")}
                  closeLabel={localizeUi("ui.noodle.noodlepostcard.cancelPostEditing")}
                  action={postEditActions}
                />
              )}
              {!imageEditing && !editingExistingPoll && (
                <div className="flex flex-wrap justify-end gap-2">{postEditActions}</div>
              )}
            </div>
          ) : (
            <>
              {post.title && <h3 className="mt-2 break-words text-base font-bold leading-6">{post.title}</h3>}
              {post.content.trim() &&
                (!poll || ctx.deduplicatePollBody === false || post.content.trim() !== poll.question) && (
                  <SlurpClampedText
                    content={post.content}
                    accountByHandle={accountByHandle}
                    onOpenProfile={openProfile}
                    className={cn("leading-6", post.title ? "mt-1" : "mt-2")}
                    clampLength={ctx.postShowMoreLength}
                  />
                )}
            </>
          )}
          {poll && editingPostId !== post.id && (
            <SlpPollCard
              poll={poll}
              votes={pollVotes}
              accountById={accountById}
              selectedOptionId={personaPollVote}
              disabled={!personaAccount}
              pending={pollVotePending}
              onVote={(optionId) => voteInPoll(post, optionId, personaPollVote)}
              onOpenProfile={openProfile}
            />
          )}
          {ctx.postManagement && editingPostId === post.id && imageEditing ? null : post.imageUrl ? (
            media ? (
              <button
                type="button"
                onClick={() =>
                  setImageLightbox(createSlpLightboxImage(post.id, post.imageUrl!, post.imagePrompt ?? ""))
                }
                className="mt-3 block w-full overflow-hidden rounded-xl text-left ring-offset-[var(--background)] transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] focus-visible:ring-offset-2"
                title={localizeUi("ui.noodle.noodlepostcard.openImage")}
                aria-label={localizeUi("ui.noodle.noodlepostcard.openPostImage")}
              >
                <PostImageFrame
                  src={post.imageUrl}
                  crop={imageCrop}
                  alt={localizeUi("ui.noodle.noodlepostcard.imagePostedByValue1", {
                    value1: author?.displayName ?? localizeUi("ui.slurp.profile.fallbackUser"),
                  })}
                />
              </button>
            ) : (
              <div className="mt-3 overflow-hidden rounded-xl">
                <PostImageFrame
                  src={post.imageUrl}
                  crop={imageCrop}
                  alt={localizeUi("ui.noodle.noodlepostcard.imagePostedByValue1", {
                    value1: author?.displayName ?? localizeUi("ui.slurp.profile.fallbackUser"),
                  })}
                />
              </div>
            )
          ) : null}
          {post.imageUrl && promptEditor && (
            <div className="mt-3 rounded-xl border border-[var(--noodle-accent)]/35 bg-[var(--noodle-accent)]/10 p-3 text-xs leading-5">
              <span className="mb-1 flex items-center gap-1.5 font-semibold text-[var(--noodle-accent)]">
                <ImageIcon size={13} />
                {localizeUi("ui.noodle.noodlepostcard.imagePrompt")}
              </span>
              {promptEditor}
            </div>
          )}
          {ctx.postManagement &&
          editingPostId === post.id &&
          imageEditing ? null : post.imageUrl ? null : post.imagePrompt ? (
            <div className="relative mt-3 rounded-xl border border-[var(--noodle-accent)]/35 bg-[var(--noodle-accent)]/10 p-3 pr-14 text-xs leading-5">
              <span className="mb-1 flex items-center gap-1.5 font-semibold text-[var(--noodle-accent)]">
                <ImageIcon size={13} />
                {localizeUi("ui.noodle.noodlepostcard.imagePrompt")}
              </span>
              {/* A picture that failed usually failed on its words, so the retry can carry new ones. */}
              {promptDraft === null ? post.imagePrompt : promptEditor}
              {ctx.postManagement && ctx.generatePostImage && promptDraft === null && (
                <button
                  type="button"
                  onClick={() => setPromptDraft(post.imagePrompt ?? "")}
                  className="absolute right-11 top-2 flex h-10 w-10 items-center justify-center rounded-full text-[var(--noodle-accent)] transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/15 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:active:scale-100"
                  title={localizeUi("ui.slurp.image.editPrompt", { defaultValue: "Edit the image prompt" })}
                  aria-label={localizeUi("ui.slurp.image.editPrompt", { defaultValue: "Edit the image prompt" })}
                >
                  <Pencil size={17} />
                </button>
              )}
              {ctx.postManagement && ctx.generatePostImage && promptDraft === null && (
                <button
                  type="button"
                  onClick={() => ctx.generatePostImage?.(post)}
                  disabled={ctx.generatingPostImageId === post.id}
                  className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full text-[var(--noodle-accent)] transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/15 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
                  title={localizeUi("ui.slurp.image.generate")}
                  aria-label={localizeUi("ui.slurp.image.generate")}
                  aria-busy={ctx.generatingPostImageId === post.id}
                >
                  <RefreshCw
                    size={17}
                    className={ctx.generatingPostImageId === post.id ? "animate-spin motion-reduce:animate-none" : ""}
                  />
                </button>
              )}
            </div>
          ) : null}

          <div className="-ml-3 mt-2 flex items-center gap-2 tabular-nums">
            <button
              type="button"
              className={cn(slpIconButtonClass, "rounded-full", likedByPersona && "bg-[var(--noodle-accent)]/10")}
              disabled={!personaAccount || postLikePending}
              onClick={() => reactToPost(post, "like", likedByPersona)}
              title={
                likedByPersona
                  ? localizeUi("ui.noodle.noodlepostcard.unlike")
                  : localizeUi("ui.noodle.noodlepostcard.like")
              }
              aria-label={localizeUi("ui.noodle.noodlepostcard.value1Post", {
                value1: likedByPersona
                  ? localizeUi("ui.noodle.noodlepostcard.unlike")
                  : localizeUi("ui.noodle.noodlepostcard.like"),
              })}
              aria-busy={postLikePending}
              data-noodle-reaction="like"
            >
              <Heart
                size={18}
                fill={likedByPersona ? "currentColor" : "none"}
                strokeWidth={likedByPersona ? 2.4 : 2}
                className={cn(
                  "transition-[fill,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  likedByPersona && "scale-110",
                )}
              />
              {countInteractions(rootPostInteractions, "like")}
            </button>
            <button
              type="button"
              className={cn(slpIconButtonClass, "rounded-full hover:text-[var(--noodle-accent)]")}
              disabled={!personaAccount}
              onClick={() => openReplyComposer(post.id)}
              title={localizeUi("ui.noodle.noodlepostcard.reply")}
              aria-label={localizeUi("ui.noodle.noodlepostcard.reply")}
            >
              <MessageCircle size={18} />
              {replies.length}
            </button>
          </div>

          <SlurpLikedBy
            likes={rootPostInteractions.filter((interaction) => interaction.type === "like")}
            total={Math.max(post.likeCount ?? 0, countInteractions(rootPostInteractions, "like"))}
            creatorAccountId={post.authorAccountId}
          />

          {replyPostId === post.id && !replyParentInteractionId && renderReplyComposer(false)}

          {replies.length > 0 && (
            <div className="mt-3 border-t border-[var(--noodle-divider)]">
              {replyThreads.length > 2 && (
                <button
                  type="button"
                  onClick={() => setCommentsExpanded((expanded) => !expanded)}
                  className="flex min-h-10 w-full items-center justify-between gap-2 px-2 text-start text-xs font-semibold text-[var(--noodle-accent)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)]"
                  aria-expanded={commentsExpanded}
                >
                  <span>
                    {commentsExpanded
                      ? localizeUi("ui.noodle.noodlepostcard.hideComments", { defaultValue: "Hide comments" })
                      : localizeUi("ui.noodle.noodlepostcard.showMoreComments", {
                          defaultValue: "Show {{count}} more comments",
                          count: hiddenReplyCount,
                        })}
                  </span>
                  <ChevronDown
                    size={16}
                    className={cn("transition-transform", commentsExpanded && "rotate-180")}
                    aria-hidden="true"
                  />
                </button>
              )}
              {visibleThreads.map((thread) => {
                const threadOpen =
                  expandedThreadIds.has(thread.root.id) ||
                  thread.children.some(
                    (child) => child.id === highlightedInteractionId || child.id === replyParentInteractionId,
                  );
                const shownChildren = threadOpen ? thread.children : thread.children.slice(0, 1);
                return (
                  <Fragment key={thread.root.id}>
                    {renderReplyRow(thread.root, false)}
                    {shownChildren.length > 0 && (
                      <div className="ml-10 border-l-2 border-[var(--noodle-divider)] pl-3">
                        {shownChildren.map((child) => renderReplyRow(child, true))}
                        {thread.children.length > 1 && (
                          <button
                            type="button"
                            onClick={() => toggleThread(thread.root.id)}
                            aria-expanded={threadOpen}
                            className="mb-2 min-h-8 rounded px-1 text-xs font-semibold text-[var(--noodle-accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
                          >
                            {threadOpen
                              ? localizeUi("ui.noodle.noodlepostcard.hideReplies", { defaultValue: "Hide replies" })
                              : localizeUi("ui.noodle.noodlepostcard.viewMoreReplies", {
                                  defaultValue: "View {{count}} more replies",
                                  count: thread.children.length - 1,
                                })}
                          </button>
                        )}
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

// The card is the module's face: callers that need its model, its context or the pieces it is
// assembled from import them here rather than from the fragments the split produced.
export type { SlpPostCardCtx, SlpPostCardModel, SlpPostImageUpdate } from "./SlpPostTypes";
export { useSlpPostCardController } from "./SlpPostHooks";
export { SlpComposerToolRow, SlpToolButton, SlurpToolPopover } from "./SlpPostComposerTools";
export { SlpComposerShell } from "./SlpPostComposerShell";
export {
  countInteractions,
  createSlpLightboxImage,
  fieldClass,
  labelClass,
  SLP_MEDIA_PICKER_TABS,
  SLP_TEXT_MEDIA_PICKER_TABS,
  slpCommentActionClass,
  slpIconButtonClass,
  SlpMentionSuggestions,
  SlurpClampedText,
  slurpReplyThreads,
  textareaClass,
} from "./SlpPostHelpers";
