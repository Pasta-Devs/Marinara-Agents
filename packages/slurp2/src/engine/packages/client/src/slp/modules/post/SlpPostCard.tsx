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
  Smile,
  Trash2,
  X,
} from "lucide-react";
import { Fragment, useRef, useState } from "react";
import {
  canManageNoodleReply,
  noodlePollInputSchema,
  readNoodlePollFromMetadata,
  readNoodlePostImageCrop,
  type NoodleAccount,
  type NoodleInteraction,
  type NoodlePoll,
} from "@marinara-engine/shared";
import { toast } from "sonner";
import { api } from "../../../lib/api-client";
import { cn } from "../../../lib/utils";
import type { ChatImage } from "../../../hooks/use-gallery";
import { ConversationMediaPickerPanel } from "../../../components/chat/ConversationMediaPickerPanel";
import { Avatar, SlurpMediaImg } from "../../base/chrome/SlpChrome";
import { formatTime } from "../../base/ui/slp-date-time";
import { NoodleImageComposer } from "../../base/media/SlpImageComposer";
import { NoodlePollComposer } from "../poll/SlpPollComposer";
import { NoodleAnchoredPopover } from "../../base/chrome/SlpAnchoredPopover";
import { SlurpLikedBy } from "../../features/audience/SlpFanCard";
import { PostImageFrame } from "../../base/media/SlpPostImageCropEditor";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  fieldClass,
  textareaClass,
  labelClass,
  noodleIconButtonClass,
  noodleCommentActionClass,
  slurpReplyThreads,
  SlurpClampedText,
  NOODLE_MEDIA_PICKER_TABS,
  NOODLE_TEXT_MEDIA_PICKER_TABS,
  NoodleCustomEmojiText,
  insertAtSelection,
  NoodleMentionSuggestions,
  NoodleTextContent,
  NoodlePollCard,
  countInteractions,
  createNoodleLightboxImage,
  NoodleToolButton,
  NoodleComposerToolRow,
  SlurpToolPopover,
  PostImageEditControls,
  useNoodlePostImageEditor,
  useNoodlePostCardController,
} from "./SlpPostHelpers";
import type {
  NoodlePostCardModel,
  NoodlePostCardCtx,
  NoodlePostImageUpdate,
} from "./SlpPostHelpers";

export function NoodlePostCard({ post, ctx }: { post: NoodlePostCardModel; ctx: NoodlePostCardCtx }) {
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
  const accountById = ctx.accountById ?? new Map<string, NoodleAccount>();
  const accountByHandle = ctx.accountByHandle ?? new Map<string, NoodleAccount>();
  const authorAccount = accountById.get(post.authorAccountId) ?? null;
  const author = authorAccount ?? post.authorSnapshot;
  const imageCrop = readNoodlePostImageCrop(post.metadata);

  // Card-owned defaults for absent capability groups. Hosts pass only the capabilities they
  // support; the card fills the
  // rest with no-ops and empty state, and gates the corresponding UI on group presence — so
  // no host has to hand over discarded setters, dangling refs, or fake mutations. Annotations
  // keep the () => {} fallbacks callable with their real signatures.
  const fallbackDivRef = useRef<HTMLDivElement | null>(null);
  const fallbackFileRef = useRef<HTMLInputElement | null>(null);
  const openProfile: (account: NoodleAccount | null) => void = ctx.openProfile ?? (() => {});
  const canOpenAuthorProfile = Boolean(authorAccount || ctx.openAuthorProfile);
  const openPostAuthor = () => {
    if (authorAccount) openProfile(authorAccount);
    else ctx.openAuthorProfile?.(post.authorAccountId);
  };
  const handleReplyKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void =
    ctx.handleReplyKeyDown ?? (() => {});
  const voteInPoll: (post: NoodlePostCardModel, optionId: string, selectedOptionId: string | null) => void =
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
  const startEditingReply: (reply: NoodleInteraction) => void = replyManagement?.startEditingReply ?? (() => {});
  const cancelEditingReply: () => void = replyManagement?.cancelEditingReply ?? (() => {});
  const saveEditedReply: (post: NoodlePostCardModel, reply: NoodleInteraction) => void =
    replyManagement?.saveEditedReply ?? (() => {});
  const deleteNoodleReply: (post: NoodlePostCardModel, reply: NoodleInteraction) => void =
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
  const selectReplyMention: (account: NoodleAccount) => void = mentions?.selectReplyMention ?? (() => {});

  const postInteractions = post.interactions;
  const rootPostInteractions = postInteractions.filter((interaction) => !interaction.parentInteractionId);
  const poll = readNoodlePollFromMetadata(post.metadata);
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
  const orderedReplies: NoodleInteraction[] = [];
  const visitedReplyIds = new Set<string>();
  const appendReplyBranch = (reply: NoodleInteraction) => {
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
    <div
      data-component="NoodleView.ReplyComposer"
      data-noodle-reply-parent-id={replyParentInteractionId ?? ""}
      className={cn("border-[var(--noodle-divider)] py-3", nested ? "ml-10 border-b" : "mt-3 border-y")}
    >
      {replyParentInteractionId && replyTargetActor && (
        <p className="mb-2 text-xs text-[var(--muted-foreground)]">
          {localizeUi("ui.noodle.noodlepostcard.replyingTo")}{" "}
          <span className="font-semibold text-[var(--noodle-accent)]">@{replyTargetActor.handle}</span>
        </p>
      )}
      <textarea
        ref={replyComposerRef}
        defaultValue={replyText}
        onChange={handleReplyChange}
        onBlur={() => setReplyText(replyValueRef.current)}
        onKeyDown={handleReplyKeyDown}
        className={cn(textareaClass, "min-h-16 resize-none bg-transparent")}
        placeholder={localizeUi("ui.noodle.noodlepostcard.leaveAComment")}
        aria-autocomplete="list"
        aria-controls={activeReplyMention ? "noodle-reply-mention-list" : undefined}
        aria-expanded={Boolean(activeReplyMention)}
        aria-activedescendant={
          activeReplyMention && replyMentionSuggestions.length > 0
            ? `noodle-reply-mention-list-option-${Math.min(
                activeReplyMentionIndex,
                replyMentionSuggestions.length - 1,
              )}`
            : undefined
        }
      />
      <NoodleMentionSuggestions
        activeMention={activeReplyMention}
        activeIndex={activeReplyMentionIndex}
        accounts={replyMentionSuggestions}
        listboxId="noodle-reply-mention-list"
        onSelect={selectReplyMention}
      />
      {replyImageUrl && (
        <div className="relative mt-2 overflow-hidden rounded-xl border border-[var(--noodle-divider)]">
          <button
            type="button"
            onClick={() => setImageLightbox(createNoodleLightboxImage(`reply-draft-${post.id}`, replyImageUrl))}
            className="block w-full"
            title={localizeUi("ui.noodle.noodlepostcard.openAttachedImage")}
          >
            <img
              src={replyImageUrl}
              alt={localizeUi("ui.noodle.noodlepostcard.attachedReplyPreview")}
              className="max-h-52 w-full object-cover"
            />
          </button>
          <button
            type="button"
            onClick={() => setReplyImageUrl("")}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white [&_svg]:!text-white transition-colors hover:bg-black/80"
            title={localizeUi("ui.noodle.noodlehome.removeImage")}
            aria-label={localizeUi("ui.noodle.noodlepostcard.removeReplyImage")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {!disableReplyImage && (
            <div ref={replyImageToolRef} className="relative">
              <NoodleToolButton
                title={localizeUi("ui.noodle.noodlehome.attachImage")}
                active={activeReplyComposerTool === "image"}
                onClick={() => setActiveReplyComposerTool((current) => (current === "image" ? null : "image"))}
              >
                <ImageIcon size={17} />
              </NoodleToolButton>
            </div>
          )}
          <div ref={replyMediaToolRef} className="relative">
            <NoodleToolButton
              title={localizeUi("ui.noodle.noodlehome.emojiGifsAndStickers")}
              active={activeReplyComposerTool === "media"}
              onClick={() => setActiveReplyComposerTool((current) => (current === "media" ? null : "media"))}
            >
              <Smile size={17} />
            </NoodleToolButton>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {ctx.creatorReplyRequest && personaAccount?.id !== post.authorAccountId && (
            <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]">
              <input
                type="checkbox"
                checked={ctx.creatorReplyRequest.asked}
                onChange={(event) => ctx.creatorReplyRequest?.setAsked(event.target.checked)}
                className="h-3.5 w-3.5 accent-[var(--noodle-accent)]"
              />
              {localizeUi("ui.noodle.noodlepostcard.askForReply")}
            </label>
          )}
          <button
            type="button"
            onClick={clearReplyComposer}
            className="h-8 rounded-full px-3 text-xs font-semibold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          >
            {localizeUi("chat.delete.dialog.cancel")}
          </button>
          <button
            type="button"
            className="h-8 rounded-full bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!replyHasText || postReplyPending}
            onClick={() => submitReply(post)}
          >
            {postReplyPending
              ? localizeUi("ui.noodle.noodlepostcard.replying")
              : localizeUi("ui.noodle.noodlepostcard.reply")}
          </button>
        </div>
      </div>
      {!disableReplyImage && activeReplyComposerTool === "image" && (
        <NoodleAnchoredPopover anchorRef={replyImageToolRef} wide>
          <NoodleImageComposer
            imageUrl={replyImageUrlDraft}
            onImageUrlChange={setReplyImageUrlDraft}
            onChooseFile={() => replyImageFileRef.current?.click()}
            onUseImageUrl={applyReplyImageUrl}
            onClose={() => setActiveReplyComposerTool(null)}
            disabled={uploadGlobalImages.isPending}
            hasImage={Boolean(replyImageUrl)}
            fileActionLabel={
              uploadGlobalImages.isPending ? localizeUi("ui.noodle.noodleprofilesurface.uploading") : undefined
            }
          />
        </NoodleAnchoredPopover>
      )}
      {activeReplyComposerTool === "media" && (
        <NoodleAnchoredPopover anchorRef={replyMediaToolRef} wide>
          <ConversationMediaPickerPanel
            tabs={disableReplyImage ? NOODLE_TEXT_MEDIA_PICKER_TABS : NOODLE_MEDIA_PICKER_TABS}
            activeTab={mediaPickerTab}
            onActiveTabChange={setMediaPickerTab}
            onClose={() => setActiveReplyComposerTool(null)}
            onEmojiSelect={appendToReply}
            onGifSelect={(gifUrl) => {
              setReplyImageUrl(gifUrl);
              setActiveReplyComposerTool(null);
            }}
            onStickerSelect={(name) => {
              appendToReply(`sticker:${name}:`);
              setActiveReplyComposerTool(null);
            }}
            className="w-full !border-[var(--marinara-chat-chrome-panel-border)] !bg-[var(--background)] !text-[var(--foreground)] shadow-2xl shadow-black/35"
          />
        </NoodleAnchoredPopover>
      )}
    </div>
  );
  const editingExistingPoll = Boolean(poll && pollEditing);
  const editingPollIsValid = !editingExistingPoll || noodlePollInputSchema.safeParse(pollEditing?.value).success;
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
  const renderReplyRow = (reply: NoodleInteraction, nested: boolean) => {
    const actorAccount = accountById.get(reply.actorAccountId) ?? null;
    const actor = actorAccount ?? reply.actorSnapshot;
    const parentReply = reply.parentInteractionId ? (replyById.get(reply.parentInteractionId) ?? null) : null;
    const parentActorAccount = parentReply ? (accountById.get(parentReply.actorAccountId) ?? null) : null;
    const parentActor = parentActorAccount ?? parentReply?.actorSnapshot ?? null;
    const replyLikes = postInteractions.filter(
      (interaction) => interaction.type === "like" && interaction.parentInteractionId === reply.id,
    );
    const likedReplyByPersona = personaAccount
      ? replyLikes.some((interaction) => interaction.actorAccountId === personaAccount.id)
      : false;
    const canManageReply = canManageReplyOverride
      ? canManageReplyOverride(reply)
      : Boolean(
          personaAccount &&
          canManageNoodleReply({
            actorKind: actorAccount?.kind ?? reply.actorSnapshot?.kind,
            actorAccountId: reply.actorAccountId,
            personaAccountId: personaAccount.id,
          }),
        );
    return (
      <Fragment key={reply.id}>
        <div
          data-noodle-interaction-id={reply.id}
          tabIndex={-1}
          className={cn(
            "grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-2 border-b border-[var(--noodle-divider)] bg-transparent py-3 text-xs outline-none transition-shadow duration-300 last:border-b-0",
            nested && "border-b-0 py-2",
            highlightedInteractionId === reply.id && "rounded-lg ring-1 ring-inset ring-[var(--noodle-accent)]/70",
          )}
        >
          <button
            type="button"
            onClick={() => openProfile(actorAccount)}
            disabled={!actorAccount}
            className="h-8 w-8 shrink-0 rounded-full text-left transition-opacity enabled:hover:opacity-80 disabled:cursor-default"
            title={
              actorAccount
                ? localizeUi("ui.noodle.noodlehome.viewValue1", {
                    value1: actorAccount.handle,
                  })
                : undefined
            }
          >
            <Avatar
              account={
                actor ?? {
                  displayName: localizeUi("ui.slurp.profile.fallbackUser"),
                  avatarUrl: null,
                }
              }
              size="sm"
            />
          </button>
          <div className="min-w-0 bg-transparent">
            <div
              data-noodle-comment-metadata
              className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[var(--noodle-accent-foreground)]"
            >
              <button
                type="button"
                onClick={() => openProfile(actorAccount)}
                disabled={!actorAccount}
                className="max-w-full truncate font-semibold !text-[var(--foreground)] transition-colors enabled:hover:!text-[var(--noodle-accent)] disabled:cursor-default"
              >
                {actor?.displayName ?? localizeUi("ui.slurp.profile.fallbackUser")}
              </button>
              <span className="truncate !text-[var(--noodle-accent-foreground)]">
                @{actor?.handle ?? localizeUi("ui.slurp.profile.fallbackHandle")}
              </span>
              <span className="!text-[var(--noodle-accent-foreground)] opacity-75">
                · {formatTime(reply.createdAt, i18n.language)}
              </span>
            </div>
            {parentActor && parentReply?.parentInteractionId && (
              <p className="mt-0.5 text-[var(--muted-foreground)]">
                {localizeUi("ui.noodle.noodlepostcard.replyingTo")}{" "}
                {parentActorAccount ? (
                  <button
                    type="button"
                    onClick={() => openProfile(parentActorAccount)}
                    className="font-medium text-[var(--noodle-accent)] hover:underline focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]/70"
                    aria-label={localizeUi("ui.noodle.noodletextcontent.viewValue1Profile", {
                      value1: parentActorAccount.handle,
                    })}
                  >
                    @{parentActorAccount.handle}
                  </button>
                ) : (
                  <span className="text-[var(--noodle-accent)]">@{parentActor.handle}</span>
                )}
              </p>
            )}
            {editingReplyId === reply.id ? (
              <div className="mt-2 space-y-2" data-component="NoodleView.CommentEditor">
                <textarea
                  value={editingReplyContent}
                  onChange={(event) => setEditingReplyContent(event.target.value)}
                  className={cn(textareaClass, "min-h-20 resize-y")}
                  placeholder={localizeUi("ui.noodle.noodlepostcard.editComment")}
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={cancelEditingReply}
                    disabled={updateInteraction.isPending}
                    className="h-8 rounded-full px-3 text-xs font-semibold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--noodle-accent)]/10 hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]/70 disabled:opacity-50"
                  >
                    {localizeUi("chat.delete.dialog.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => saveEditedReply(post, reply)}
                    disabled={(!editingReplyContent.trim() && !reply.imageUrl) || updateInteraction.isPending}
                    className="h-8 rounded-full bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {updateInteraction.isPending
                      ? localizeUi("ui.noodle.noodlehome.saving")
                      : localizeUi("ui.noodle.noodlehome.save")}
                  </button>
                </div>
              </div>
            ) : reply.content ? (
              <NoodleTextContent
                content={reply.content}
                accountByHandle={accountByHandle}
                onOpenProfile={openProfile}
                className="mt-1 leading-5"
              />
            ) : null}
            {reply.imageUrl && (
              <button
                type="button"
                onClick={() =>
                  setImageLightbox(createNoodleLightboxImage(reply.id, reply.imageUrl!, reply.content ?? ""))
                }
                className="mt-2 block w-full overflow-hidden rounded-xl text-left ring-offset-[var(--background)] transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] focus-visible:ring-offset-2"
                title={localizeUi("ui.noodle.noodlepostcard.openImage")}
                aria-label={localizeUi("ui.noodle.noodlepostcard.openCommentImage")}
              >
                <SlurpMediaImg
                  src={reply.imageUrl}
                  alt={localizeUi("ui.noodle.noodlepostcard.imageInValue1SComment", {
                    value1: actor?.displayName ?? localizeUi("ui.slurp.profile.fallbackUser"),
                  })}
                  className="max-h-72 w-full object-cover"
                />
              </button>
            )}
            <div className="mt-1.5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => reactToReply(post, reply, likedReplyByPersona)}
                disabled={!personaAccount || reactionPendingFor(post.id, "like", reply.id)}
                className={cn(
                  noodleCommentActionClass,
                  "px-2 font-medium",
                  likedReplyByPersona && "bg-[var(--noodle-accent)]/10",
                )}
                title={
                  likedReplyByPersona
                    ? localizeUi("ui.noodle.noodlepostcard.unlikeComment")
                    : localizeUi("ui.noodle.noodlepostcard.likeComment")
                }
                aria-busy={reactionPendingFor(post.id, "like", reply.id)}
              >
                <Heart
                  size={14}
                  fill={likedReplyByPersona ? "currentColor" : "none"}
                  strokeWidth={likedReplyByPersona ? 2.4 : 2}
                  className={cn(
                    "transition-[fill,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    likedReplyByPersona && "scale-110",
                  )}
                />
                {replyLikes.length > 0 && replyLikes.length}
              </button>
              <button
                type="button"
                onClick={() => openReplyComposer(post.id, reply.id)}
                disabled={!personaAccount}
                className={cn(noodleCommentActionClass, "w-7")}
                title={localizeUi("ui.noodle.noodlepostcard.reply")}
                aria-label={localizeUi("ui.noodle.noodlepostcard.reply")}
              >
                <MessageCircle size={14} />
              </button>
              {canManageReply && editingReplyId !== reply.id && (
                <>
                  <button
                    type="button"
                    onClick={() => startEditingReply(reply)}
                    disabled={updateInteraction.isPending || deleteInteraction.isPending}
                    className={cn(noodleCommentActionClass, "w-7")}
                    title={localizeUi("ui.noodle.noodlepostcard.editComment")}
                    aria-label={localizeUi("ui.noodle.noodlepostcard.editComment")}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteNoodleReply(post, reply)}
                    disabled={updateInteraction.isPending || deleteInteraction.isPending}
                    className={cn(noodleCommentActionClass, "w-7")}
                    title={localizeUi("ui.noodle.noodlepostcard.deleteComment")}
                    aria-label={localizeUi("ui.noodle.noodlepostcard.deleteComment")}
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
        {replyPostId === post.id && replyParentInteractionId === reply.id && renderReplyComposer(true)}
      </Fragment>
    );
  };

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
                          `/slurp2/noodler/posts/${encodeURIComponent(post.id)}/share-card${
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
                <NoodlePollComposer
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
            <NoodlePollCard
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
                  setImageLightbox(createNoodleLightboxImage(post.id, post.imageUrl!, post.imagePrompt ?? ""))
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
              className={cn(noodleIconButtonClass, "rounded-full", likedByPersona && "bg-[var(--noodle-accent)]/10")}
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
              className={cn(noodleIconButtonClass, "rounded-full hover:text-[var(--noodle-accent)]")}
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

// Shared composer chrome: avatar gutter, borderless body, divider, and the
// tools-left / action-right toolbar row. Noodle fills it with its post composer;
// NoodleR fills it with the guided-generation composer. Keeps both pixel-aligned.
export function NoodleComposerShell({
  header,
  avatar,
  children,
  tools,
  action,
  popovers,
  footer,
  dataComponent,
}: {
  header?: React.ReactNode;
  avatar: React.ReactNode;
  children: React.ReactNode;
  tools?: React.ReactNode;
  action: React.ReactNode;
  popovers?: React.ReactNode;
  footer?: React.ReactNode;
  dataComponent?: string;
}) {
  return (
    <div className="border-b border-[var(--noodle-divider)] px-4 py-3" data-component={dataComponent}>
      {header && <div className="mb-2">{header}</div>}
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-3">
        {avatar}
        <div className="min-w-0">{children}</div>
      </div>
      <div className="mt-1 h-px w-full bg-[var(--noodle-divider)]" />
      {/* Tools and actions are two wrapping groups, not seven buttons in one row: on a
          phone the old single row broke them apart mid-group. The avatar-width indent
          is a wide-layout nicety and costs 3.5rem the narrow layout cannot spare. */}
      <div className="relative mt-3 flex flex-wrap items-center gap-2 @min-[480px]:pl-14">
        <div className="flex min-w-0 flex-wrap items-center gap-1">{tools}</div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{action}</div>
        {popovers}
      </div>
      {footer}
    </div>
  );
}
