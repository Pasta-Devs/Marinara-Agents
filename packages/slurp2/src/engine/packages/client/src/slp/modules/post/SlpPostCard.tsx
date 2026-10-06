import { slpIsOwnActor } from "../../../../../shared/src/slp/slp-interactions.js";
import { SlpStoryRingAvatar } from "../story/SlpStoryRing";
import { SlpTimestamp } from "../../base/ui/SlpTimestamp";
import { AtSign, ChevronDown, ChevronRight, Info, MessageCircle, RefreshCw, X } from "lucide-react";
import { SlpHeartGlyph } from "../../base/chrome/SlpGlyphs";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { slurpPostWentViral, slurpReachWeek } from "../../../../../shared/src/slp/slp-reach.js";
import { readSlpPollFromMetadata } from "../../../../../shared/src/slp/slp-polls.js";
import { readSlpPostImageCrop } from "../../../../../shared/src/slp/slp-post-images.js";
import { slpPollInputSchema } from "../../../../../shared/src/slp/slp-social.schema.js";
import { type SlpAccount, type SlpInteraction } from "../../../../../shared/src/slp/slp-social.types.js";
import { cn } from "../../../lib/utils";
import type { ChatImage } from "../../../hooks/use-gallery";
import { useNearViewportSlurpMediaSrc } from "../../base/media/slp-media-src";
import { Avatar } from "../../base/chrome/SlpChrome";
import { playSlpPop } from "../sparkle/SlpSparkle";
import { slpTagClass } from "../chrome/SlpButton";
import { SlpPostPartnership, SlpReachBadge } from "./SlpPostPartnership";
import { SlpPostPurposeNote, slpShowPostInPlace } from "./SlpPostPurposeNote";
import { SlpPostEditSheet } from "./SlpPostEditSheet";
import { useTranslation as useUiTranslation } from "react-i18next";
import { Image as ImageIcon } from "lucide-react";
import { slpPostImagePrompt } from "./SlpPostHelpers";
import {
  createSlpLightboxImage,
  SLP_FEED_MEDIA_FRAME_CLASS,
  SlpPostImageSlot,
  slpPostImageSlotState,
  slpPostLikeCount,
  slpIconButtonClass,
  SlurpClampedText,
  slurpReplyThreads,
} from "./SlpPostHelpers";
import type { SlpPostCardCtx, SlpPostCardModel } from "./SlpPostTypes";
import { SlurpLikedBy } from "../audience/SlpFanCard";
import { PostImageFrame } from "../../base/media/SlpPostImageCropEditor";
import { SlpPollCard } from "./SlpPollCard";
import { SlpPostImageNav } from "./SlpPostImageNav";
import { SlpPostMediaFrame } from "./SlpPostMediaFrame";
import { SlpPostMenu } from "./SlpPostMenu";
import { SlpReplyRow } from "./SlpReplyRow";
import { SlpReplyComposer } from "./SlpReplyComposer";
// ponytail: one edit sheet app-wide (only one post is edited at a time); if its owner card unmounts
// mid-edit the other copy does not take over. Move the sheet to the controller if that matters.
let slpEditSheetOwned = false;

// A fresh Map per render is a new useMemo dependency for the Markdown renderer below.
const EMPTY_ACCOUNTS = new Map<string, SlpAccount>();

export function SlpPostCard({
  post,
  ctx,
  surface = "feed",
  hideImage = false,
}: {
  post: SlpPostCardModel;
  ctx: SlpPostCardCtx;
  surface?: "feed" | "profile" | "dialog"; // dialog: the post dialog's side panel, flat (the dialog is the card)
  /**
   * Draw the card without its picture, for a surface that already shows the picture itself.
   *
   * The caller used to blank `imageUrl` and `images` on the model instead. That hid the picture
   * and everything else that reads those fields with it: "Download post card" from this card's
   * menu built a card with no image in it.
   */
  hideImage?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const {
    personaAccount,
    editingPostId,
    editingPostContent,
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
    media,
    replyManagement,
    mentions,
  } = ctx;
  const accountById = ctx.accountById ?? EMPTY_ACCOUNTS;
  const accountByHandle = ctx.accountByHandle ?? EMPTY_ACCOUNTS;
  const authorAccount = accountById.get(post.authorAccountId) ?? null;
  const author = authorAccount ?? post.authorSnapshot;
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
  const { imageEditing, pollEditing } = ctx;
  const isEditingPost = Boolean(ctx.postManagement) && editingPostId === post.id;
  // One card owns the edit sheet: the same post can be on screen twice (the list and its dialog),
  // and a second sheet would close the first, which cancels the edit.
  const [ownsEditSheet, setOwnsEditSheet] = useState(false);
  useEffect(() => {
    if (!isEditingPost || slpEditSheetOwned) return;
    slpEditSheetOwned = true;
    setOwnsEditSheet(true);
    return () => {
      slpEditSheetOwned = false;
      setOwnsEditSheet(false);
    };
  }, [isEditingPost]);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const activeImage = post.images[activeImageIndex] ?? post.images[0] ?? null;
  const activeCrop =
    activeImage && activeImage.position > 0 ? (activeImage.crop ?? null) : readSlpPostImageCrop(post.metadata);
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [expandedThreadIds, setExpandedThreadIds] = useState<ReadonlySet<string>>(new Set());
  const {
    src: postImageSrc,
    observe: observePostImage,
    loading: postImageLoading,
  } = useNearViewportSlurpMediaSrc(activeImage?.imageUrl ?? post.imageUrl, { width: 960 });
  const displayedImageUrl = !hideImage && postImageSrc && postImageSrc !== failedImageUrl ? postImageSrc : null;
  const imageGenerationPending = ctx.generatingPostImageIds?.includes(post.id) === true;
  const imageSlot = hideImage ? null : slpPostImageSlotState(post, imageGenerationPending, ctx.postManagement);
  // The post dialog shows the same post as the card behind it; its own key keeps the ⋯ menu and
  // the composer in one card instead of both (R1-029).
  const surfaceKey = hideImage ? `dialog:${post.id}` : post.id;
  const postMenuOpen = ctx.postMenuId === surfaceKey;
  const reachBadge = slurpPostWentViral({ accountId: post.authorAccountId, postId: post.id, createdAt: post.createdAt })
    ? "viral"
    : slurpReachWeek(post.authorAccountId, post.createdAt) === "featured"
      ? "featured"
      : null;
  const [imageContextOpen, setImageContextOpenState] = useState(false);
  const [imageContextExpanded, setImageContextExpanded] = useState(true);
  // Opening it from the menu shows the details at once; the header folds them away.
  const setImageContextOpen: typeof setImageContextOpenState = (next) => {
    setImageContextExpanded(true);
    setImageContextOpenState(next);
  };
  const [promptDraft, setPromptDraft] = useState<string | null>(null);
  const imageDescription =
    typeof post.metadata?.imageDescription === "string" ? post.metadata.imageDescription.trim() : "";
  // Once a picture exists, show and edit what the provider drew it from, not the draft.
  const shownImagePrompt = post.imageUrl ? slpPostImagePrompt(post) : post.imagePrompt;
  // The context panel describes the picture on screen, which in a set may not be the first one.
  const contextImagePrompt = activeImage?.imagePrompt ?? shownImagePrompt;
  const hasImageContext = Boolean(post.imageUrl && (contextImagePrompt?.trim() || imageDescription));
  const editablePost =
    post.imageUrl && (postImageSrc === null || postImageSrc !== failedImageUrl) ? post : { ...post, imageUrl: null };
  const postInteractions = post.interactions;
  const rootPostInteractions = postInteractions.filter((interaction) => !interaction.parentInteractionId);
  const poll = readSlpPollFromMetadata(post.metadata);
  const postKind = post.imageUrl ? "media" : poll ? "poll" : "text";
  const pollVotes = poll
    ? rootPostInteractions.filter(
        (interaction) =>
          interaction.type === "vote" && poll.options.some((option) => option.id === interaction.content),
      )
    : [];
  const personaPollVote = personaAccount
    ? (pollVotes.find((interaction) => slpIsOwnActor(personaAccount, interaction.actorAccountId))?.content ?? null)
    : null;
  const likedByPersona = personaAccount
    ? rootPostInteractions.some(
        (interaction) => interaction.type === "like" && slpIsOwnActor(personaAccount, interaction.actorAccountId),
      )
    : false;
  const { replies, replyById, orderedReplies, replyLikesByParentId } = useMemo(() => {
    const nextReplies = postInteractions.filter((interaction) => interaction.type === "reply");
    const nextReplyById = new Map(nextReplies.map((reply) => [reply.id, reply]));
    const childrenByParentId = new Map<string, SlpInteraction[]>();
    const nextReplyLikesByParentId = new Map<string, SlpInteraction[]>();
    for (const interaction of postInteractions) {
      if (interaction.type === "reply" && interaction.parentInteractionId) {
        const children = childrenByParentId.get(interaction.parentInteractionId) ?? [];
        children.push(interaction);
        childrenByParentId.set(interaction.parentInteractionId, children);
      }
      if (interaction.type === "like" && interaction.parentInteractionId) {
        const likes = nextReplyLikesByParentId.get(interaction.parentInteractionId) ?? [];
        likes.push(interaction);
        nextReplyLikesByParentId.set(interaction.parentInteractionId, likes);
      }
    }
    const nextOrderedReplies: SlpInteraction[] = [];
    const visitedReplyIds = new Set<string>();
    const appendReplyBranch = (reply: SlpInteraction) => {
      if (visitedReplyIds.has(reply.id)) return;
      visitedReplyIds.add(reply.id);
      nextOrderedReplies.push(reply);
      for (const child of childrenByParentId.get(reply.id) ?? []) appendReplyBranch(child);
    };
    for (const reply of nextReplies) {
      if (!reply.parentInteractionId || !nextReplyById.has(reply.parentInteractionId)) appendReplyBranch(reply);
    }
    for (const reply of nextReplies) appendReplyBranch(reply);
    return {
      replies: nextReplies,
      replyById: nextReplyById,
      orderedReplies: nextOrderedReplies,
      replyLikesByParentId: nextReplyLikesByParentId,
    };
  }, [postInteractions]);
  const replyThreads = slurpReplyThreads(orderedReplies, replyById);
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
  const likeCount = slpPostLikeCount(post, rootPostInteractions);
  const imageAlt = localizeUi("ui.noodle.post.imageBy", {
    name: author?.displayName ?? localizeUi("ui.slurp.profile.fallbackUser"),
  });
  const actionClass = cn(
    slpIconButtonClass,
    "rounded-full text-[13px] !text-[var(--slurp-muted)] hover:!text-[var(--slurp-text)] [&_svg]:!text-current",
  );
  const postReplyPending = createInteractionPendingFor(post.id, "reply", replyParentInteractionId);
  const pollVotePending = createInteractionPendingFor(post.id, "vote");
  const editingExistingPoll = Boolean(poll && pollEditing);
  const editingPollIsValid = !editingExistingPoll || slpPollInputSchema.safeParse(pollEditing?.value).success;
  const saveEditDisabled =
    (!editingPostContent.trim() && !(ctx.allowPollOnlyEdits && editingPollIsValid && editingExistingPoll)) ||
    !editingPollIsValid ||
    updatePostPending ||
    Boolean(imageEditing?.loading) ||
    Boolean(imageEditing?.cropSource);
  const renderReplyComposer = (nested: boolean) => (
    <SlpReplyComposer
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
      askForReply={
        ctx.creatorReplyRequest && !slpIsOwnActor(personaAccount, post.authorAccountId)
          ? ctx.creatorReplyRequest
          : undefined
      }
    />
  );
  const renderReplyRow = (reply: SlpInteraction, nested: boolean) => (
    <SlpReplyRow
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
      replyLikesByParentId={replyLikesByParentId}
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
      data-slurp-post-kind={postKind}
      tabIndex={-1}
      className={cn(
        surface === "dialog"
          ? "px-4 py-5"
          : // Glossy raised card (feed and profile list, T): no border, soft shadow, 1 px top highlight.
            "rounded-2xl bg-[var(--slurp-surface-raised)] px-4 py-4 shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)] transition-shadow duration-[var(--slurp-motion-base)] hover:shadow-[var(--slurp-shadow-floating),var(--slurp-highlight)] motion-reduce:transition-none",
        surface !== "dialog" &&
          postKind === "poll" &&
          "bg-[linear-gradient(145deg,var(--slurp-surface-raised),color-mix(in_srgb,var(--noodle-accent)_6%,var(--slurp-surface-raised)))]",
        postMenuOpen && "relative z-40",
      )}
    >
      <div className="flex items-center gap-3">
        {author ? (
          <button
            type="button"
            onClick={openPostAuthor}
            disabled={!canOpenAuthorProfile}
            className="h-fit shrink-0 rounded-full text-left transition-opacity enabled:hover:opacity-80 disabled:cursor-default"
            title={
              canOpenAuthorProfile
                ? localizeUi("ui.noodle.noodlehome.viewValue1", {
                    value1: author.handle,
                  })
                : undefined
            }
          >
            <SlpStoryRingAvatar creatorId={post.authorAccountId} name={author.displayName}>
              <Avatar account={author} />
            </SlpStoryRingAvatar>
          </button>
        ) : (
          <AtSign size={28} className="text-[var(--noodle-accent-foreground)]" />
        )}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="min-w-0 flex-1">
            {/* One line whatever the name (B17): the name truncates, the chip keeps its size. */}
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={openPostAuthor}
                disabled={!canOpenAuthorProfile}
                className="min-w-0 truncate rounded-lg text-[15px] font-bold leading-5 transition-colors enabled:hover:text-[var(--noodle-accent-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:cursor-default"
              >
                {author?.displayName ?? localizeUi("ui.slurp.profile.fallbackUser")}
              </button>
              {/* Locked cards reach this component only after access is granted; pre-unlock teasers use LockedSlurpPostCard. */}
              <span
                title={localizeUi(
                  post.access === "locked" ? "ui.noodle.postaccess.unlocked.hint" : "ui.noodle.postaccess.public.hint",
                )}
                className={slpTagClass(post.access === "locked")}
              >
                {localizeUi(post.access === "locked" ? "ui.noodle.postaccess.unlocked" : "ui.noodle.postaccess.public")}
              </span>
            </div>
            <p className="mt-0.5 flex min-w-0 items-center text-xs font-medium leading-4 text-[var(--slurp-muted)]">
              <span className="min-w-0 truncate">
                @{author?.handle ?? localizeUi("ui.slurp.profile.fallbackHandle")}
              </span>
              <span className="shrink-0 whitespace-pre"> · </span>
              <span className="shrink-0">
                <SlpTimestamp value={post.createdAt} tappable />
              </span>
              {reachBadge && <SlpReachBadge badge={reachBadge} />}
            </p>
            <SlpPostPartnership partnership={post.partnership} onOpenProfile={ctx.openAuthorProfile} />
            <SlpPostPurposeNote
              metadata={post.metadata}
              onShowPost={(id) => slpShowPostInPlace(id) || ctx.openAuthorProfile?.(post.authorAccountId)}
            />
          </div>
          <SlpPostMenu
            post={post}
            ctx={ctx}
            menuKey={surfaceKey}
            postMenuOpen={postMenuOpen}
            editablePost={editablePost}
            startEditingPost={startEditingPost}
            deleteNoodlePost={deleteNoodlePost}
            imageGenerationPending={imageGenerationPending}
            hasImageContext={hasImageContext}
            imageContextOpen={imageContextOpen}
            setImageContextOpen={setImageContextOpen}
            setPromptDraft={setPromptDraft}
            openCreator={canOpenAuthorProfile ? openPostAuthor : undefined}
            onShare={ctx.sharePost ? () => ctx.sharePost?.(post) : undefined}
          />
        </div>
      </div>
      <div>
        {hideImage ? null : displayedImageUrl || postImageLoading ? (
          <div
            ref={observePostImage}
            className={cn(
              "relative mt-3 flex justify-center overflow-hidden bg-black/20 text-left",
              surface !== "feed" ? "w-full rounded-xl ring-1 ring-inset ring-white/10" : "-mx-4 w-[calc(100%+2rem)]",
            )}
          >
            {displayedImageUrl && (
              <button
                type="button"
                onClick={() => {
                  if (ctx.openPost) ctx.openPost(post.id);
                  else
                    setImageLightbox(
                      createSlpLightboxImage(
                        `${post.id}:${activeImageIndex}`,
                        displayedImageUrl,
                        activeImage?.imagePrompt ?? shownImagePrompt ?? "",
                      ),
                    );
                }}
                className="absolute inset-0 z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)]"
                title={localizeUi("ui.noodle.noodlepostcard.openImage")}
                aria-label={localizeUi("ui.noodle.noodlepostcard.openPostImage")}
              />
            )}
            {displayedImageUrl && activeCrop ? (
              <PostImageFrame
                src={displayedImageUrl}
                onError={() => setFailedImageUrl(displayedImageUrl)}
                crop={activeCrop}
                alt={imageAlt}
              />
            ) : (
              // V: the frame takes the first picture's own ratio (4:5 to 1.91:1), reserved before it loads.
              <SlpPostMediaFrame
                src={displayedImageUrl}
                size={post.images[0]}
                alt={imageAlt}
                onError={() => displayedImageUrl && setFailedImageUrl(displayedImageUrl)}
                className={cn(SLP_FEED_MEDIA_FRAME_CLASS, surface !== "feed" && "rounded-xl")}
              />
            )}
            {displayedImageUrl && (
              <SlpPostImageNav total={post.images.length} index={activeImageIndex} onSelect={setActiveImageIndex} />
            )}
          </div>
        ) : imageSlot && (imageSlot === "pending" || promptDraft === null) ? (
          <SlpPostImageSlot
            state={imageSlot}
            countFromMount={imageGenerationPending}
            size={post.images[0]}
            error={typeof post.metadata?.imageGenerationError === "string" ? post.metadata.imageGenerationError : null}
            onRetry={
              ctx.generatePostImage && shownImagePrompt?.trim()
                ? () => ctx.generatePostImage?.(post, shownImagePrompt.trim())
                : undefined
            }
            onEditPrompt={ctx.generatePostImage ? () => setPromptDraft(shownImagePrompt ?? "") : undefined}
            className={surface !== "feed" ? "mt-3 rounded-xl" : "-mx-4 mt-3 w-[calc(100%+2rem)]"}
          />
        ) : post.imagePrompt && ctx.postManagement && promptDraft === null ? (
          // Managers only. The draft is working material, and viewers were shown a block of prompt
          // text under every post whose picture had not been drawn yet.
          <div className="relative mt-3 rounded-xl border border-[var(--noodle-accent)]/35 bg-[var(--noodle-accent)]/10 p-3 pr-14 text-xs leading-5">
            <span className="mb-1 flex items-center gap-1.5 font-semibold text-[var(--noodle-accent-foreground)]">
              <ImageIcon size={13} aria-hidden="true" />
              {localizeUi("ui.noodle.noodlepostcard.imagePrompt")}
            </span>
            {post.imagePrompt}
            {ctx.postManagement && ctx.generatePostImage && promptDraft === null && (
              <button
                type="button"
                onClick={() => setPromptDraft(shownImagePrompt ?? "")}
                disabled={imageGenerationPending}
                className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full text-[var(--noodle-accent-foreground)] transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/15 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
                title={localizeUi("ui.slurp.image.generate")}
                aria-label={localizeUi("ui.slurp.image.generate")}
                aria-busy={imageGenerationPending}
              >
                <RefreshCw
                  size={17}
                  className={imageGenerationPending ? "animate-spin motion-reduce:animate-none" : ""}
                />
              </button>
            )}
          </div>
        ) : null}
        {promptDraft !== null && (
          <div className="mt-3 rounded-xl border border-[var(--noodle-accent)]/35 bg-[var(--noodle-accent)]/10 p-3 text-xs leading-5">
            <span className="mb-1 flex items-center gap-1.5 font-semibold text-[var(--noodle-accent-foreground)]">
              <ImageIcon size={13} aria-hidden="true" />
              {localizeUi("ui.noodle.noodlepostcard.imagePrompt")}
            </span>
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
                disabled={!promptDraft.trim() || imageGenerationPending}
                onClick={() => {
                  ctx.generatePostImage?.(post, promptDraft.trim(), true);
                  setPromptDraft(null);
                }}
                className="min-h-9 rounded-lg bg-[var(--noodle-accent)] px-3 font-semibold text-[var(--slurp-on-accent)] disabled:opacity-50"
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
          </div>
        )}
        {imageContextOpen && hasImageContext && (
          // Info, not an alert: a neutral surface (the tint belongs to "Picture failed"), its own close.
          <div className="mt-3 rounded-xl bg-[color-mix(in_srgb,var(--slurp-text)_6%,transparent)] text-xs leading-5">
            <div className="flex items-center">
              <button
                type="button"
                aria-expanded={imageContextExpanded}
                onClick={() => setImageContextExpanded((value) => !value)}
                className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl ps-3 text-start font-semibold text-[var(--slurp-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] [&_svg]:!text-current"
              >
                <Info size={14} aria-hidden="true" className="shrink-0" />
                <span className="truncate">
                  {localizeUi("ui.slurp.post.imageContextTitle", { defaultValue: "How this picture was made" })}
                </span>
                <ChevronRight
                  size={14}
                  aria-hidden="true"
                  className={cn(
                    "shrink-0 transition-transform duration-[var(--slurp-motion-base)] motion-reduce:transition-none",
                    imageContextExpanded && "rotate-90",
                  )}
                />
              </button>
              <button
                type="button"
                onClick={() => setImageContextOpen(false)}
                aria-label={localizeUi("ui.slurp.post.imageContextClose", { defaultValue: "Close picture details" })}
                className="grid size-11 shrink-0 place-items-center rounded-xl text-[var(--slurp-muted)] hover:text-[var(--slurp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] [&_svg]:!text-current"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            {imageContextExpanded && (
              <dl className="space-y-2 px-3 pb-3">
                {contextImagePrompt?.trim() && (
                  <div>
                    <dt className="font-semibold">{localizeUi("ui.noodle.noodlepostcard.imagePrompt")}</dt>
                    <dd className="whitespace-pre-wrap break-words text-[var(--slurp-muted)]">{contextImagePrompt}</dd>
                  </div>
                )}
                {imageDescription && (
                  <div>
                    <dt className="font-semibold">
                      {localizeUi("ui.slurp.post.imageDescription", { defaultValue: "What the picture shows" })}
                    </dt>
                    <dd className="whitespace-pre-wrap break-words text-[var(--slurp-muted)]">{imageDescription}</dd>
                  </div>
                )}
              </dl>
            )}
          </div>
        )}
        <>
          {post.title && <h3 className="mt-2 break-words text-lg font-bold leading-snug">{post.title}</h3>}
          {!poll || ctx.deduplicatePollBody === false || post.content.trim() !== poll.question ? (
            <SlurpClampedText
              content={post.content}
              accountByHandle={accountByHandle}
              onOpenProfile={openProfile}
              className={cn("leading-6", post.title ? "mt-1" : "mt-2")}
              clampLength={ctx.postShowMoreLength}
            />
          ) : null}
        </>
        {poll && (
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
        <div className="-ms-3 mt-2 flex items-center gap-1 tabular-nums">
          <button
            type="button"
            className={cn(
              actionClass,
              likedByPersona && "!text-[var(--slurp-ink)] [&_svg]:!text-[var(--noodle-accent)]",
            )}
            disabled={!personaAccount || postLikePending}
            onClick={(event) => {
              if (!likedByPersona) playSlpPop(event.currentTarget.querySelector("svg") ?? event.currentTarget);
              reactToPost(post, "like", likedByPersona);
            }}
            title={
              likedByPersona
                ? localizeUi("ui.noodle.noodlepostcard.unlike")
                : localizeUi("ui.noodle.noodlepostcard.like")
            }
            aria-label={localizeUi(likedByPersona ? "ui.noodle.post.unlikeLabel" : "ui.noodle.post.likeLabel")}
            aria-busy={postLikePending}
            data-noodle-reaction="like"
          >
            <SlpHeartGlyph
              size={18}
              filled={likedByPersona}
              className={cn(
                "transition-[fill,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                likedByPersona && "scale-110",
              )}
            />
            {likeCount}
          </button>
          <button
            type="button"
            className={actionClass}
            disabled={!personaAccount}
            onClick={() => openReplyComposer(post.id, null, surfaceKey)}
            title={localizeUi("ui.noodle.noodlepostcard.reply")}
            aria-label={localizeUi("ui.noodle.noodlepostcard.reply")}
          >
            <MessageCircle size={18} />
            {Math.max((post as { replyCount?: number }).replyCount ?? 0, replies.length)}
          </button>
        </div>
        <SlurpLikedBy
          likes={rootPostInteractions.filter((interaction) => interaction.type === "like")}
          total={likeCount}
          creatorAccountId={post.authorAccountId}
        />
        {replyPostId === post.id &&
          (ctx.replyKey ?? post.id) === surfaceKey &&
          !replyParentInteractionId &&
          renderReplyComposer(false)}
        {replies.length > 0 && (
          <div className="mt-3 border-t border-[var(--noodle-divider)]">
            {replyThreads.length > 2 && (
              <button
                type="button"
                onClick={() => setCommentsExpanded((expanded) => !expanded)}
                className="flex min-h-10 w-full items-center justify-between gap-2 px-2 text-start text-xs font-semibold text-[var(--noodle-accent-foreground)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)]"
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
                          className="mb-2 min-h-8 rounded px-1 text-xs font-semibold text-[var(--noodle-accent-foreground)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
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
      {ownsEditSheet && (
        <SlpPostEditSheet
          open={isEditingPost}
          post={post}
          editablePost={editablePost}
          ctx={ctx}
          editingExistingPoll={editingExistingPoll}
          saveEditDisabled={saveEditDisabled}
        />
      )}
    </article>
  );
}
