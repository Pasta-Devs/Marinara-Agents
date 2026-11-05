import { SlpCoinText } from "../../modules/coin/SlpCoin";
import { slpIsOwnActor } from "../../../../../shared/src/slp/slp-interactions.js";
import { ChevronLeft, ChevronRight, Clock3, Eye, Link, Maximize2, Minimize2, Plus, X } from "lucide-react";
import { SlpHeartGlyph, SlpLockGlyph } from "../../base/chrome/SlpGlyphs";
import { useEffect, useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { SlpCreatorPostView } from "../../../../../shared/src/slp/slp-social.types.js";
import { useRecordSlurpStoryView, useSlurpStoryViews } from "../../features/messages/slp-messages-hooks";
import { cn } from "../../../lib/utils";
import type { SlpPostCardCtx } from "../../modules/post/SlpPostTypes";
import { SlurpCoinAmount } from "../../modules/coin/SlpCoin";
import { SlpStoryTile } from "../../modules/story/SlpStoryTile";
import { playSlpPop, SlpTwinkle } from "../../modules/sparkle/SlpSparkle";
import { SlpButton, SlpPrimaryButton } from "../../modules/chrome/SlpButton";
import { useSlurpMediaSrc } from "../../base/media/slp-media-src";
import { ProfileInitial, slpImgFade } from "../../base/chrome/SlpChrome";
import { SlurpSparkleVeil } from "../../base/chrome/SlpSparkleVeil";
import { SlpSkeleton } from "../../modules/chrome/SlpStateKit";
import { SlpLiveMomentTiles } from "../../features/live/SlpLiveMomentTiles";
import { useCreatorAccounts } from "../../features/creators/slp-creators-contract";
import { useSlpLiveNow } from "../../features/live/slp-live-hooks";
import { SlpPostSurfaceMenu } from "../../modules/post/SlpPostMenu";
import { api } from "../../../lib/api-client";
import { downloadSlpShareCard, toSlpShareCardInput } from "../../modules/post/slp-share-card";
import { toSlpPostCardModel, linkedPostIdForStory, type SlurpViewerCreator, SlurpMediaDialog } from "./SlpHomeHelpers";
import { readSlpPurpose, slpStoryPollTally } from "../../../../../shared/src/slp/slp-post-purpose.js";
import { readSlpPollFromMetadata } from "../../../../../shared/src/slp/slp-polls.js";
import { SlpCommentSticker, SlpCountdownSticker, SlpPollSticker } from "../../modules/story/SlpStoryStickers";

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

type SlurpMoment = {
  creator: SlurpViewerCreator;
  post: SlpCreatorPostView;
};

// ---------------------------------------------------------------------------
// SlurpMomentShelfTile
// ---------------------------------------------------------------------------

export function SlurpMomentShelfTile({
  moment,
  isNew,
  onOpen,
}: {
  moment: SlurpMoment;
  isNew: boolean;
  onOpen: () => void;
}) {
  const mediaSrc = useSlurpMediaSrc(moment.post.imageUrl, { width: 320 });
  return (
    <SlpStoryTile
      creator={moment.creator}
      post={moment.post}
      mediaSrc={mediaSrc}
      fallback={<ProfileInitial profile={moment.creator.profile} />}
      isNew={isNew}
      onOpen={onOpen}
    />
  );
}

// ---------------------------------------------------------------------------
// SlurpMomentsShelf
// ---------------------------------------------------------------------------

export function SlurpMomentsShelf({
  moments,
  onOpenMoment,
  onAddStory,
  embedded = false,
  isLoading = false,
  isError = false,
}: {
  moments: SlurpMoment[];
  newSinceAt: string | null;
  onOpenMoment: (postId: string) => void;
  onAddStory?: () => void;
  embedded?: boolean;
  /** While the feed is loading or failed, "nothing new" would be a lie. The feed below owns Try again. */
  isLoading?: boolean;
  isError?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  // One tile per Creator, on its first Story this persona has not watched (else its first). The ring
  // means "not watched yet", from recorded views, not "posted since your last visit" (R1-024).
  const watched = (moment: (typeof moments)[number]) => (moment.post as { watched?: boolean }).watched === true;
  const tileByCreator = new Map<string, (typeof moments)[number]>();
  for (const moment of moments) {
    const current = tileByCreator.get(moment.creator.profile.id);
    if (!current || (watched(current) && !watched(moment))) tileByCreator.set(moment.creator.profile.id, moment);
  }
  // A live Creator's tile is the show; their Stories wait until it ends.
  const liveNow = useSlpLiveNow().data ?? [];
  // Only a show whose host account resolves gets a tile, so only those hide the host's Stories.
  const accounts = useCreatorAccounts(liveNow.length > 0).data ?? [];
  const live = liveNow.filter((show) => accounts.some((account) => account.id === show.hostId));
  const creatorMoments = [...tileByCreator.values()].filter(
    (moment) => !live.some((show) => show.hostId === moment.creator.profile.id),
  );
  const isUnwatched = (moment: (typeof moments)[number]) => !watched(moment);
  creatorMoments.sort((left, right) => {
    const leftNew = isUnwatched(left);
    const rightNew = isUnwatched(right);
    if (leftNew !== rightNew) return leftNew ? -1 : 1;
    return new Date(right.post.createdAt).getTime() - new Date(left.post.createdAt).getTime();
  });

  return (
    <section
      data-component="SlurpHome.Moments"
      aria-label={localizeUi("ui.slurp.moments.title")}
      className={cn(
        "relative isolate overflow-hidden",
        embedded
          ? "border-b border-[var(--noodle-divider)] bg-[linear-gradient(120deg,color-mix(in_srgb,var(--noodle-accent)_4%,var(--slurp-surface)),color-mix(in_srgb,var(--slurp-violet)_3%,var(--slurp-surface)))] py-3 shadow-[0_12px_28px_-26px_rgba(0,0,0,0.9)]"
          : "mx-3 mt-3 rounded-xl bg-[linear-gradient(145deg,var(--slurp-surface-raised),color-mix(in_srgb,var(--noodle-accent)_7%,var(--slurp-canvas)))] py-4 shadow-[var(--slurp-shadow-floating)] ring-1 ring-inset ring-[var(--noodle-divider)] sm:mx-4",
      )}
    >
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 end-0 z-10 w-8 bg-[linear-gradient(to_left,var(--slurp-surface),transparent)]" />
        <div className="flex snap-x gap-2.5 overflow-x-auto px-4 py-1 pe-10 [scroll-padding-inline-start:1rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden @min-[1024px]:px-5 @min-[1024px]:[scroll-padding-inline-start:1.25rem]">
          {onAddStory && (
            // Smaller than a Story on purpose: it is an action, not content, so it should not compete.
            <button
              type="button"
              onClick={onAddStory}
              className="group flex h-[8.25rem] w-16 shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-2xl bg-[var(--slurp-tint)] px-1 text-[var(--slurp-ink)] shadow-[var(--slurp-highlight)] transition-[background-color,transform] hover:bg-[color-mix(in_srgb,var(--noodle-accent)_22%,var(--slurp-surface-raised))] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] @min-[1024px]:h-[9rem] motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--noodle-accent)] text-[var(--slurp-on-accent)] shadow-[var(--slurp-glow)] transition-transform group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100 [&_svg]:!text-[var(--slurp-on-accent)]">
                <Plus size={18} strokeWidth={2.25} aria-hidden="true" />
              </span>
              <span className="text-center text-[11px] font-semibold leading-[14px]">
                {localizeUi("ui.slurp.moments.add")}
              </span>
            </button>
          )}
          <SlpLiveMomentTiles shows={live} />
          {creatorMoments.length === 0 && live.length > 0 ? null : creatorMoments.length === 0 &&
            isLoading &&
            !isError ? (
            <SlpSkeleton shape="stories" count={4} />
          ) : creatorMoments.length === 0 ? (
            <div
              className="flex min-h-24 min-w-[12rem] max-w-xs items-center gap-2.5 text-[var(--muted-foreground)]"
              role="status"
            >
              <Clock3 size={17} className="shrink-0 text-[var(--noodle-accent-foreground)]" aria-hidden="true" />
              <span className="text-xs leading-5 text-pretty">
                {isError
                  ? localizeUi("ui.slurp.moments.error", { defaultValue: "Could not load Stories." })
                  : localizeUi("ui.slurp.moments.empty")}
              </span>
            </div>
          ) : (
            creatorMoments.map((moment) => {
              const isNew = isUnwatched(moment);
              return (
                <SlurpMomentShelfTile
                  key={moment.creator.profile.id}
                  moment={moment}
                  isNew={isNew}
                  onOpen={() => onOpenMoment(moment.post.id)}
                />
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// SlurpMomentViewer
// ---------------------------------------------------------------------------

export function SlurpMomentViewer({
  moment,
  personaId,
  isOwner,
  index,
  total,
  unlockPending,
  subscriptionPending,
  onClose,
  onPrevious,
  onNext,
  onUnlock,
  onToggleSubscription,
  onOpenProfile,
  onOpenPost,
  ctx,
}: {
  moment: SlurpMoment;
  personaId: string | null;
  isOwner: boolean;
  index: number;
  total: number;
  unlockPending: boolean;
  subscriptionPending: boolean;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onUnlock: (postId: string) => void;
  onToggleSubscription: (creatorAccountId: string, subscribed: boolean) => void;
  onOpenProfile?: (accountId: string) => void;
  /** Close the Story and show this post (the one it announces, its drop, the post a comment was on). */
  onOpenPost?: (postId: string) => void;
  ctx: SlpPostCardCtx;
}) {
  const { t: localizeUi } = useUiTranslation();
  const mediaSrc = useSlurpMediaSrc(moment.post.imageUrl, { width: 1600 });
  // Stories are drawn edge to edge, which crops any image not made in the tall Story format.
  // Fit shows the whole image over a blurred copy of itself instead.
  const [fitImage, setFitImage] = useState(false);
  const rootLikes = moment.post.interactions.filter(
    (interaction) => interaction.type === "like" && !interaction.parentInteractionId,
  );
  const liked = Boolean(rootLikes.some((interaction) => slpIsOwnActor(ctx.personaAccount, interaction.actorAccountId)));
  const likeCount = moment.post.likeCount ?? rootLikes.length;
  const unlockPrice = (moment.post as { unlockPrice?: unknown }).unlockPrice;
  // No picture at all (not one still loading): the Story is its words, drawn big on the canvas.
  const textStory = !moment.post.imageUrl && !moment.post.locked ? moment.post.content?.trim() || null : null;
  const recordView = useRecordSlurpStoryView();
  const recordedStoryViews = useRef(new Set<string>());
  const storyViews = useSlurpStoryViews(moment.post.id, personaId, isOwner);
  const openProfile = () => {
    onClose();
    onOpenProfile?.(moment.creator.profile.id);
  };
  const seePost = (postId: string) => (onOpenPost ? onOpenPost(postId) : openProfile());
  // What this Story is for (3b): a countdown, a poll with its results, or the comment it answers.
  const purpose = moment.post.locked ? null : readSlpPurpose(moment.post.metadata);
  const poll = purpose?.kind === "poll" ? readSlpPollFromMetadata(moment.post.metadata) : null;
  const pollVotes = poll
    ? moment.post.interactions.filter(
        (interaction) =>
          interaction.type === "vote" &&
          !interaction.parentInteractionId &&
          poll.options.some((option) => option.id === interaction.content),
      )
    : [];
  // The tap shows the result at once; the stored vote takes over when the feed comes back with it.
  const [tapped, setTapped] = useState<string | null>(null);
  const storedVote =
    pollVotes.find((interaction) => slpIsOwnActor(ctx.personaAccount, interaction.actorAccountId))?.content ?? null;
  const pollSelected = storedVote ?? tapped;
  const pollTally = poll
    ? slpStoryPollTally(
        { postId: moment.post.id, createdAt: moment.post.createdAt, optionCount: poll.options.length },
        poll.options.map(
          (option) =>
            pollVotes.filter((interaction) => interaction.content === option.id).length +
            (!storedVote && tapped === option.id ? 1 : 0),
        ),
        Date.now(),
      )
    : [];
  const sticker =
    purpose?.kind === "countdown" ? (
      <SlpCountdownSticker
        dropAt={purpose.dropAt}
        linked={Boolean(purpose.postId)}
        onSeePost={purpose.postId ? () => seePost(purpose.postId!) : undefined}
      />
    ) : poll ? (
      <SlpPollSticker
        options={poll.options.map((option, index) => ({ ...option, count: pollTally[index] ?? 0 }))}
        selected={pollSelected}
        showResults={isOwner}
        disabled={!ctx.personaAccount || ctx.createInteractionPendingFor(moment.post.id, "vote")}
        onVote={
          ctx.voteInPoll
            ? (optionId) => {
                setTapped(optionId);
                ctx.voteInPoll?.(toSlpPostCardModel(moment.post, moment.creator.profile), optionId, pollSelected);
              }
            : undefined
        }
      />
    ) : purpose?.kind === "comment_reaction" && purpose.comment ? (
      <SlpCommentSticker handle={purpose.comment.handle} text={purpose.comment.text} />
    ) : null;
  useEffect(() => {
    // View recording is best effort. Opening a Story must remain usable when the write is slow.
    const viewKey = `${personaId ?? ""}:${moment.post.id}`;
    if (!recordedStoryViews.current.has(viewKey)) {
      recordedStoryViews.current.add(viewKey);
      void recordView.mutateAsync({ storyId: moment.post.id, personaId: personaId ?? "" }).catch(() => {
        recordedStoryViews.current.delete(viewKey);
      });
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "ArrowLeft" && onPrevious) {
        event.preventDefault();
        onPrevious();
      } else if (event.key === "ArrowRight" && onNext) {
        event.preventDefault();
        onNext();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [moment.post.id, onNext, onPrevious, personaId, recordView]);

  return (
    <SlurpMediaDialog
      title={localizeUi("ui.slurp.moments.fromCreator", { name: moment.creator.profile.displayName })}
      onClose={onClose}
      variant="story"
      pictured={!textStory}
      media={
        <>
          {mediaSrc && (
            <span aria-hidden="true" className="absolute inset-0 scale-110 opacity-40 blur-2xl">
              <img key={mediaSrc} src={mediaSrc} alt="" {...slpImgFade} className="h-full w-full object-cover" />
            </span>
          )}
          {
            mediaSrc ? (
              <img
                key={mediaSrc}
                src={mediaSrc}
                {...slpImgFade}
                decoding="async"
                fetchPriority="high"
                alt={
                  moment.post.locked
                    ? localizeUi("ui.noodle.lockednoodlerpostcard.lockedImageFrom", {
                        name: moment.creator.profile.displayName,
                      })
                    : localizeUi("ui.noodle.post.imageBy", { name: moment.creator.profile.displayName })
                }
                className={cn(
                  "relative h-full w-full",
                  fitImage ? "object-contain" : "slp-crop-top object-cover",
                  moment.post.locked && "saturate-[0.88]",
                )}
              />
            ) : textStory ? (
              // A text Story is the words themselves: big type on the hero gradient, not an empty canvas.
              <div className="absolute inset-0 isolate flex items-center justify-center overflow-hidden bg-[image:var(--slurp-hero)] px-8 py-28">
                <SlpTwinkle
                  points={[
                    { x: "12%", y: "22%", size: 14 },
                    { x: "84%", y: "18%", size: 10 },
                    { x: "78%", y: "74%", size: 16 },
                    { x: "16%", y: "80%", size: 9 },
                  ]}
                />
                <p
                  className={cn(
                    "text-balance text-center text-[var(--slurp-on-hero)] [overflow-wrap:anywhere] [text-shadow:0_2px_18px_rgb(0_0_0/0.25)]",
                    textStory.length <= 60
                      ? "text-[28px] font-extrabold leading-[32px]"
                      : textStory.length <= 160
                        ? "text-[22px] font-extrabold leading-[28px]"
                        : "text-[17px] font-bold leading-[24px]",
                  )}
                >
                  {textStory}
                </p>
              </div>
            ) : null /* while the picture is fetched, the dialog's frame itself shimmers */
          }
          {moment.post.locked && mediaSrc && <SlurpSparkleVeil />}
          {sticker && (
            <div
              className="pointer-events-none absolute inset-x-0 z-10 flex justify-center px-6"
              style={{ top: "28%" }}
            >
              <div className="pointer-events-auto">{sticker}</div>
            </div>
          )}
          <div
            className="absolute inset-x-3 top-3 z-10 flex gap-1"
            role="progressbar"
            aria-label={localizeUi("ui.slurp.moments.progress")}
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={index + 1}
          >
            {Array.from({ length: total }, (_, storyIndex) => (
              <span key={storyIndex} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/35">
                <span className={cn("block h-full rounded-full", storyIndex <= index && "bg-white")} />
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={openProfile}
            disabled={!onOpenProfile}
            className="absolute left-4 right-16 top-6 z-10 flex min-h-11 items-center gap-2 rounded-xl text-left text-white drop-shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-default"
          >
            <ProfileInitial profile={moment.creator.profile} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-black">{moment.creator.profile.displayName}</span>
              <span className="block truncate text-[0.68rem] text-white/72">@{moment.creator.profile.handle}</span>
            </span>
          </button>
          <span
            className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-28 bg-gradient-to-b from-black/60 to-transparent"
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label={localizeUi("ui.slurp.moments.close", { defaultValue: "Close Story" })}
            title={localizeUi("ui.slurp.moments.close", { defaultValue: "Close Story" })}
            className="absolute right-3 top-6 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white ring-1 ring-white/20 backdrop-blur-md transition-[background-color,transform] hover:bg-black/70 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            <X size={20} strokeWidth={2.5} aria-hidden="true" />
          </button>
          <div className="absolute right-16 top-6 z-20" onClick={(event) => event.stopPropagation()}>
            <SlpPostSurfaceMenu
              onDownload={
                mediaSrc
                  ? () =>
                      void api.download(
                        `/slurp2/noodler/posts/${encodeURIComponent(moment.post.id)}/media`,
                        `slurp-${moment.post.id}-image`,
                      )
                  : undefined
              }
              onShare={
                mediaSrc
                  ? () =>
                      void downloadSlpShareCard(
                        toSlpShareCardInput(toSlpPostCardModel(moment.post, moment.creator.profile)),
                        `slurp-${moment.post.id}.png`,
                      )
                  : undefined
              }
              onOpenCreator={onOpenProfile ? openProfile : undefined}
              deepDetailsPostId={moment.post.id}
            />
          </div>
          {onPrevious && (
            <button
              type="button"
              onClick={onPrevious}
              className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white ring-1 ring-white/15 backdrop-blur-sm hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label={localizeUi("ui.slurp.moments.previous")}
            >
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
          )}
          {onNext && (
            <button
              type="button"
              onClick={onNext}
              className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white ring-1 ring-white/15 backdrop-blur-sm hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label={localizeUi("ui.slurp.moments.next")}
            >
              <ChevronRight size={22} aria-hidden="true" />
            </button>
          )}
        </>
      }
      side={
        <div data-component="SlurpHome.MomentViewer" className="flex flex-col gap-3 p-4 text-shadow-sm">
          {moment.post.locked && (
            <span className="inline-flex h-6 w-fit items-center gap-1 rounded-full bg-white/12 px-2.5 text-[11px] font-semibold ring-1 ring-inset ring-white/20 backdrop-blur-sm">
              <SlpLockGlyph size={12} aria-hidden="true" /> {localizeUi("ui.slurp.locked.blurredPreview")}
            </span>
          )}
          {moment.post.title && <h3 className="text-lg font-bold leading-tight">{moment.post.title}</h3>}
          {!moment.post.locked && moment.post.content && !textStory && (
            <p className="text-sm leading-6 text-white/85">{moment.post.content}</p>
          )}
          {(!moment.post.locked || mediaSrc) && (
            <div className="flex items-center gap-2">
              {!moment.post.locked && (
                <button
                  type="button"
                  disabled={!ctx.personaAccount || ctx.reactionPendingFor(moment.post.id, "like")}
                  onClick={(event) => {
                    if (!liked) playSlpPop(event.currentTarget.querySelector("svg") ?? event.currentTarget);
                    ctx.reactToPost(toSlpPostCardModel(moment.post, moment.creator.profile), "like", liked);
                  }}
                  aria-pressed={liked}
                  aria-label={localizeUi(liked ? "ui.noodle.post.unlikeLabel" : "ui.noodle.post.likeLabel")}
                  className={cn(
                    "inline-flex min-h-10 w-fit items-center gap-2 rounded-full bg-white/10 px-3.5 text-sm font-bold ring-1 ring-inset ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50 motion-reduce:transition-none",
                    liked && "text-[var(--noodle-accent)]",
                  )}
                >
                  <SlpHeartGlyph size={17} filled={liked} aria-hidden="true" />
                  {likeCount}
                </button>
              )}
              {mediaSrc && (
                <button
                  type="button"
                  onClick={() => setFitImage((value) => !value)}
                  aria-pressed={fitImage}
                  aria-label={localizeUi(fitImage ? "ui.slurp.moments.fillImage" : "ui.slurp.moments.fitImage")}
                  title={localizeUi(fitImage ? "ui.slurp.moments.fillImage" : "ui.slurp.moments.fitImage")}
                  className="ms-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-inset ring-white/15 backdrop-blur-sm hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  {fitImage ? <Minimize2 size={18} aria-hidden="true" /> : <Maximize2 size={18} aria-hidden="true" />}
                </button>
              )}
            </div>
          )}
          {isOwner && storyViews.data && (
            <details className="rounded-lg bg-[var(--accent)] p-3 text-xs ring-1 ring-inset ring-[var(--noodle-divider)]">
              <summary className="cursor-pointer font-bold">
                {localizeUi("ui.slurp.moments.views", { count: storyViews.data.count })}
              </summary>
              {storyViews.data.viewers.length > 0 && (
                <ul className="mt-2 space-y-1 text-[var(--muted-foreground)]">
                  {storyViews.data.viewers.map((viewer) => (
                    <li key={viewer.id}>
                      {viewer.displayName}
                      {viewer.handle ? ` @${viewer.handle}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </details>
          )}
          {linkedPostIdForStory(moment.post) && (onOpenPost || onOpenProfile) && (
            <button
              type="button"
              onClick={() => seePost(linkedPostIdForStory(moment.post)!)}
              className="inline-flex min-h-10 w-fit items-center gap-2 rounded-lg bg-[var(--accent)] px-3 text-xs font-bold ring-1 ring-inset ring-[var(--noodle-divider)] hover:bg-[var(--noodle-accent)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
            >
              <Link size={14} aria-hidden="true" /> {localizeUi("ui.slurp.moments.viewLinkedPost")}
            </button>
          )}
          {moment.post.locked && (
            <div className="grid gap-2">
              <SlpPrimaryButton
                disabled={unlockPending}
                onClick={() => void Promise.resolve(onUnlock(moment.post.id)).catch(() => undefined)}
              >
                <Eye size={16} aria-hidden="true" /> {localizeUi("ui.slurp.moments.unlock")}
                {typeof unlockPrice === "number" && (
                  <>
                    <span aria-hidden="true">·</span>
                    <SlurpCoinAmount amount={unlockPrice} />
                  </>
                )}
              </SlpPrimaryButton>
              <SlpButton
                disabled={subscriptionPending}
                className="text-white"
                onClick={() =>
                  void Promise.resolve(
                    onToggleSubscription(moment.creator.profile.id, moment.creator.subscribed),
                  ).catch(() => undefined)
                }
              >
                {/* Every spend shows its price on the button (R1-045). */}
                <SlpCoinText>
                  {localizeUi("ui.slurp.moments.subscribePrice", {
                    price: (moment.creator as { subscriptionPrice?: number }).subscriptionPrice ?? 0,
                    defaultValue: "Subscribe · {{price}} <coin/> / week",
                  })}
                </SlpCoinText>
              </SlpButton>
            </div>
          )}
        </div>
      }
    />
  );
}
