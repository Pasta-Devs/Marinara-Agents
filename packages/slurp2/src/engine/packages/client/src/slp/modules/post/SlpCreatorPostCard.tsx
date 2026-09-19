// ──────────────────────────────────────────────
// Slurp post card — the membership-style, media-forward variant of the post card
// used by the Slurp creator feed. Shares all leaf helpers, the ctx contract,
// and the reply/edit/poll machinery's building blocks with NoodlePostCard; only the
// layout (two-line header, filled access pill, full-width body, image-on-top) differs.
// The public Noodle feed keeps the original NoodlePostCard.
// ──────────────────────────────────────────────
import {
  AtSign,
  ChevronDown,
  Heart,
  Flame,
  TrendingUp,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Share2,
  Trash2,
} from "lucide-react";
import { Fragment, useMemo, useRef, useState } from "react";
import { slurpPostWentViral, slurpReachWeek } from "../../../../../shared/src/slp/slp-reach.js";
import {
  noodlePollInputSchema,
  readNoodlePollFromMetadata,
  readNoodlePostImageCrop,
  type NoodleAccount,
  type NoodleInteraction,
} from "@marinara-engine/shared";
import { cn } from "../../../lib/utils";
import { api } from "../../../lib/api-client";
import { toast } from "sonner";
import type { ChatImage } from "../../../hooks/use-gallery";
import { useNearViewportSlurpMediaSrc } from "../../base/media/slp-media-src";
import { Avatar } from "../../base/chrome/SlpChrome";
import { useTranslation as useUiTranslation } from "react-i18next";
import { Image as ImageIcon } from "lucide-react";
import { formatTime } from "../../base/ui/slp-date-time";
import { fieldClass, labelClass, textareaClass } from "./SlpPostHelpers";
import {
  countInteractions,
  createNoodleLightboxImage,
  noodleIconButtonClass,
  SlurpClampedText,
  slurpReplyThreads,
  type NoodlePostCardCtx,
  type NoodlePostCardModel,
} from "./SlpPostCard";
import { SlurpLikedBy } from "../audience/SlpFanCard";
import { NoodlePollComposer } from "../poll/SlpPollComposer";
import { PostImageFrame } from "../../base/media/SlpPostImageCropEditor";
import { LockedSlurpPostCard } from "./SlpLockedPostCard";
import { NoodlePollCard } from "./SlpPollCard";
import { NoodleTextContent } from "./SlpMarkdownRenderer";
import { PostImageEditControls } from "./SlpPostImageEditControls";
import { SlpCreatorPostMenu } from "./SlpCreatorPostMenu";
import { SlpReplyRow } from "./SlpReplyRow";
import { SlpReplyComposer } from "./SlpReplyComposer";

const SLURP_FEED_MEDIA_RATIO_CLASS = "aspect-[4/3] sm:aspect-[16/10]";

export function SlurpCreatorPostCard({
  post,
  ctx,
  surface = "feed",
}: {
  post: NoodlePostCardModel;
  ctx: NoodlePostCardCtx;
  surface?: "feed" | "profile";
}) {
  const { t: localizeUi, i18n } = useUiTranslation();
  const {
    personaAccount,
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
    media,
    replyManagement,
    mentions,
  } = ctx;
  const accountById = ctx.accountById ?? new Map<string, NoodleAccount>();
  const accountByHandle = ctx.accountByHandle ?? new Map<string, NoodleAccount>();
  const authorAccount = accountById.get(post.authorAccountId) ?? null;
  const author = authorAccount ?? post.authorSnapshot;
  // Card-owned defaults for absent capability groups. Hosts pass only the capabilities they
  // support (NoodleR omits media/replyManagement/mentions/poll/profile); the card fills the
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

  const { imageEditing, pollEditing } = ctx;
  const isEditingPost = Boolean(ctx.postManagement) && editingPostId === post.id;
  const imageCrop = readNoodlePostImageCrop(post.metadata);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [expandedThreadIds, setExpandedThreadIds] = useState<ReadonlySet<string>>(new Set());
  const {
    src: postImageSrc,
    observe: observePostImage,
    loading: postImageLoading,
  } = useNearViewportSlurpMediaSrc(post.imageUrl, { width: 960 });
  const displayedImageUrl = postImageSrc && postImageSrc !== failedImageUrl ? postImageSrc : null;
  const imageGenerationPending = ctx.generatingPostImageId === post.id;
  const postMenuOpen = ctx.postMenuId === post.id;
  // The algorithm week this post was made in. Derived, like its counts, so every card agrees.
  const reachBadge = slurpPostWentViral({ accountId: post.authorAccountId, postId: post.id, createdAt: post.createdAt })
    ? "viral"
    : slurpReachWeek(post.authorAccountId, post.createdAt) === "featured"
      ? "featured"
      : null;
  // Debug view of what the picture was made from, and what the vision model said it shows.
  const [imageContextOpen, setImageContextOpen] = useState(false);
  // null while closed; a string while the image prompt is being rewritten for a redraw.
  const [promptDraft, setPromptDraft] = useState<string | null>(null);
  const imageDescription =
    typeof post.metadata?.imageDescription === "string" ? post.metadata.imageDescription.trim() : "";
  const hasImageContext = Boolean(post.imageUrl && (post.imagePrompt?.trim() || imageDescription));
  // Distinct from displayedImageUrl: while postImageSrc is still resolving (the authenticated
  // fetch hasn't returned yet) there is no evidence the image is broken, so editing must not
  // drop it. Only a confirmed <img> render failure (postImageSrc resolved and then errored,
  // recorded in failedImageUrl) strips the image from what gets edited/saved.
  const editablePost =
    post.imageUrl && (postImageSrc === null || postImageSrc !== failedImageUrl) ? post : { ...post, imageUrl: null };
  const postInteractions = post.interactions;
  const rootPostInteractions = postInteractions.filter((interaction) => !interaction.parentInteractionId);
  const poll = readNoodlePollFromMetadata(post.metadata);
  const postKind = post.imageUrl ? "media" : poll ? "poll" : "text";
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
  const { replies, replyById, orderedReplies, replyLikesByParentId } = useMemo(() => {
    const nextReplies = postInteractions.filter((interaction) => interaction.type === "reply");
    const nextReplyById = new Map(nextReplies.map((reply) => [reply.id, reply]));
    const childrenByParentId = new Map<string, NoodleInteraction[]>();
    const nextReplyLikesByParentId = new Map<string, NoodleInteraction[]>();
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
    const nextOrderedReplies: NoodleInteraction[] = [];
    const visitedReplyIds = new Set<string>();
    const appendReplyBranch = (reply: NoodleInteraction) => {
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
  const editingExistingPoll = Boolean(poll && pollEditing);
  const editingPollIsValid = !editingExistingPoll || noodlePollInputSchema.safeParse(pollEditing?.value).success;
  const saveEditDisabled =
    (!editingPostContent.trim() && !(ctx.allowPollOnlyEdits && editingPollIsValid && editingExistingPoll)) ||
    !editingPollIsValid ||
    updatePostPending ||
    Boolean(imageEditing?.loading) ||
    Boolean(imageEditing?.cropSource);
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
        disabled={saveEditDisabled}
        className="h-8 rounded-full bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {updatePostPending ? localizeUi("ui.noodle.noodlehome.saving") : localizeUi("ui.noodle.noodlehome.save")}
      </button>
    </>
  );
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
    />
  );
  const renderReplyRow = (reply: NoodleInteraction, nested: boolean) => (
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
        surface === "profile"
          ? "border-b border-[var(--noodle-divider)] px-4 py-5 transition-colors last:border-b-0 hover:bg-[var(--accent)]/20"
          : "rounded-xl bg-[var(--slurp-surface)] px-4 py-5 shadow-[0_1px_0_var(--noodle-divider),0_20px_42px_-36px_rgba(0,0,0,0.95)] ring-1 ring-inset ring-[var(--noodle-divider)] transition-[background-color,box-shadow] hover:bg-[var(--slurp-surface-raised)] hover:shadow-[0_1px_0_color-mix(in_srgb,var(--noodle-accent)_30%,transparent),0_24px_46px_-32px_rgba(0,0,0,0.95)] motion-reduce:transition-none",
        surface !== "profile" &&
          postKind === "poll" &&
          "bg-[linear-gradient(145deg,var(--slurp-surface),color-mix(in_srgb,var(--noodle-accent)_5%,var(--slurp-surface)))]",
      )}
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
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <button
                type="button"
                onClick={openPostAuthor}
                disabled={!canOpenAuthorProfile}
                className="rounded-lg font-semibold transition-colors enabled:hover:text-[var(--noodle-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:cursor-default"
              >
                {author?.displayName ?? localizeUi("ui.slurp.profile.fallbackUser")}
              </button>
              {/* Locked cards reach this component only after access is granted; pre-unlock teasers use LockedSlurpPostCard. */}
              <span
                title={localizeUi(
                  post.access === "locked" ? "ui.noodle.postaccess.unlocked.hint" : "ui.noodle.postaccess.public.hint",
                )}
                className={cn(
                  "rounded-lg px-2 py-1 text-[0.68rem] font-bold ring-1 ring-inset",
                  post.access === "locked"
                    ? "bg-[var(--noodle-accent)]/15 text-[var(--noodle-accent)] ring-[var(--noodle-accent)]/25"
                    : "bg-[var(--accent)] text-[var(--muted-foreground)] ring-[var(--noodle-divider)]",
                )}
              >
                {localizeUi(post.access === "locked" ? "ui.noodle.postaccess.unlocked" : "ui.noodle.postaccess.public")}
              </span>
            </div>
            <p className="text-xs font-medium !text-[var(--noodle-accent-foreground)]">
              @{author?.handle ?? localizeUi("ui.slurp.profile.fallbackHandle")} ·{" "}
              {formatTime(post.createdAt, i18n.language)}
              {reachBadge && (
                <span className="ms-1.5 inline-flex items-center gap-1 rounded-full bg-[var(--noodle-accent)]/15 px-1.5 py-px text-[0.62rem] font-bold text-[var(--noodle-accent)]">
                  {reachBadge === "viral" ? (
                    <Flame size={10} aria-hidden="true" />
                  ) : (
                    <TrendingUp size={10} aria-hidden="true" />
                  )}
                  {reachBadge === "viral"
                    ? localizeUi("ui.slurp.post.viral", { defaultValue: "Went viral" })
                    : localizeUi("ui.slurp.post.featured", { defaultValue: "Featured" })}
                </span>
              )}
            </p>
          </div>
          <SlpCreatorPostMenu
            post={post}
            ctx={ctx}
            postMenuOpen={postMenuOpen}
            editablePost={editablePost}
            startEditingPost={startEditingPost}
            deleteNoodlePost={deleteNoodlePost}
            imageGenerationPending={imageGenerationPending}
            hasImageContext={hasImageContext}
            imageContextOpen={imageContextOpen}
            setImageContextOpen={setImageContextOpen}
            setPromptDraft={setPromptDraft}
          />
        </div>
      </div>
      <div>
        {/* The image editor renders its own preview while editing, so hide the read-only one. */}
        {isEditingPost && imageEditing ? null : displayedImageUrl || postImageLoading ? (
          <button
            ref={observePostImage}
            type="button"
            onClick={() => {
              if (!displayedImageUrl) return;
              if (ctx.openPost) ctx.openPost(post.id);
              else setImageLightbox(createNoodleLightboxImage(post.id, displayedImageUrl, post.imagePrompt ?? ""));
            }}
            disabled={!displayedImageUrl}
            className={cn(
              "mt-4 flex max-h-[32rem] justify-center overflow-hidden bg-black/20 text-left ring-1 ring-inset ring-white/10 ring-offset-[var(--background)] transition-[opacity,transform] hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] focus-visible:ring-offset-2 motion-reduce:transition-none",
              surface === "profile"
                ? "w-full rounded-xl"
                : "-mx-4 w-[calc(100%+2rem)] rounded-none sm:mx-0 sm:w-full sm:rounded-xl",
            )}
            title={localizeUi("ui.noodle.noodlepostcard.openImage")}
            aria-label={localizeUi("ui.noodle.noodlepostcard.openPostImage")}
          >
            {!displayedImageUrl ? (
              <span
                className="block aspect-[4/3] w-full animate-pulse bg-[var(--muted)] motion-reduce:animate-none sm:aspect-[16/10]"
                aria-hidden="true"
              />
            ) : imageCrop ? (
              <PostImageFrame
                src={displayedImageUrl}
                onError={() => setFailedImageUrl(displayedImageUrl)}
                crop={imageCrop}
                alt={localizeUi("ui.noodle.post.imageBy", {
                  name: author?.displayName ?? localizeUi("ui.slurp.profile.fallbackUser"),
                })}
              />
            ) : (
              <div
                className={cn(
                  "relative w-full overflow-hidden rounded-xl bg-[var(--slurp-media-stage,#17131a)]",
                  SLURP_FEED_MEDIA_RATIO_CLASS,
                )}
              >
                <img
                  src={displayedImageUrl}
                  onError={() => setFailedImageUrl(displayedImageUrl)}
                  alt={localizeUi("ui.noodle.post.imageBy", {
                    name: author?.displayName ?? localizeUi("ui.slurp.profile.fallbackUser"),
                  })}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </div>
            )}
          </button>
        ) : post.imagePrompt ? (
          <div className="relative mt-3 rounded-xl border border-[var(--noodle-accent)]/35 bg-[var(--noodle-accent)]/10 p-3 pr-14 text-xs leading-5">
            <span className="mb-1 flex items-center gap-1.5 font-semibold text-[var(--noodle-accent)]">
              <ImageIcon size={13} aria-hidden="true" />
              {localizeUi("ui.noodle.noodlepostcard.imagePrompt")}
            </span>
            {post.imagePrompt}
            {ctx.postManagement && ctx.generatePostImage && promptDraft === null && (
              <button
                type="button"
                onClick={() => setPromptDraft(post.imagePrompt ?? "")}
                disabled={imageGenerationPending}
                className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full text-[var(--noodle-accent)] transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/15 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
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
            <span className="mb-1 flex items-center gap-1.5 font-semibold text-[var(--noodle-accent)]">
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
          </div>
        )}
        {imageContextOpen && hasImageContext && (
          <div className="mt-3 space-y-2 rounded-xl border border-[var(--noodle-accent)]/35 bg-[var(--noodle-accent)]/10 p-3 text-xs leading-5">
            {post.imagePrompt?.trim() && (
              <div>
                <span className="mb-1 flex items-center gap-1.5 font-semibold text-[var(--noodle-accent)]">
                  <ImageIcon size={13} aria-hidden="true" />
                  {localizeUi("ui.noodle.noodlepostcard.imagePrompt")}
                </span>
                <p className="whitespace-pre-wrap break-words">{post.imagePrompt}</p>
              </div>
            )}
            {imageDescription && (
              <div>
                <span className="mb-1 block font-semibold text-[var(--noodle-accent)]">
                  {localizeUi("ui.slurp.post.imageDescription", { defaultValue: "Vision model description" })}
                </span>
                <p className="whitespace-pre-wrap break-words">{imageDescription}</p>
              </div>
            )}
          </div>
        )}
        {isEditingPost ? (
          <div className="mt-2 space-y-2">
            {titleEditing && (
              <label className="block space-y-1">
                <span className={labelClass}>{localizeUi("ui.noodle.noodlepostcard.titleOptional")}</span>
                <input
                  value={titleEditing.editingPostTitle}
                  onChange={(event) => titleEditing.setEditingPostTitle(event.target.value)}
                  maxLength={titleEditing.maxLength}
                  className={fieldClass}
                  placeholder={localizeUi("ui.noodle.noodlepostcard.postTitle")}
                />
              </label>
            )}
            <textarea
              value={editingPostContent}
              onChange={(event) => setEditingPostContent(event.target.value)}
              className={cn(textareaClass, "min-h-28")}
              placeholder={localizeUi("ui.noodle.noodlepostcard.editPost")}
            />
            {imageEditing && (
              <PostImageEditControls
                post={editablePost}
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
                submitDisabled={saveEditDisabled}
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
        )}
        {poll && !isEditingPost && (
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
        <div className="mt-5 flex items-center gap-2 border-t border-[var(--noodle-divider)] pt-3 tabular-nums">
          <button
            type="button"
            className={cn(noodleIconButtonClass, "rounded-lg", likedByPersona && "bg-[var(--noodle-accent)]/10")}
            disabled={!personaAccount || postLikePending}
            onClick={() => reactToPost(post, "like", likedByPersona)}
            title={
              likedByPersona
                ? localizeUi("ui.noodle.noodlepostcard.unlike")
                : localizeUi("ui.noodle.noodlepostcard.like")
            }
            aria-label={localizeUi(likedByPersona ? "ui.noodle.post.unlikeLabel" : "ui.noodle.post.likeLabel")}
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
            className={cn(noodleIconButtonClass, "rounded-lg hover:text-[var(--noodle-accent)]")}
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
          total={countInteractions(rootPostInteractions, "like")}
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
    </article>
  );
}
