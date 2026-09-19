import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Heart,
  Link,
  Lock,
  Maximize2,
  Minimize2,
  Plus,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { NoodlerPostView } from "@marinara-engine/shared";
import {
  useRecordSlurpStoryView,
  useSlurpStoryViews,
} from "../../features/messages/slp-messages-hooks";
import { cn } from "../../../lib/utils";
import type { NoodlePostCardCtx } from "../../modules/post/SlpPostCard";
import { SlurpCoinAmount } from "../../modules/coin/SlpCoin";
import { SlpStoryTile } from "../../modules/story/SlpStoryTile";
import { useSlurpMediaSrc } from "../../base/media/slp-media-src";
import { ProfileInitial } from "../../base/chrome/SlpChrome";
import { SlurpSparkleVeil } from "../../base/chrome/SlpSparkleVeil";
import {
  toNoodlePostCardModel,
  linkedPostIdForStory,
  type SlurpViewerCreator,
  SlurpMediaDialog,
} from "./SlpHomeHelpers";

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

type SlurpMoment = {
  creator: SlurpViewerCreator;
  post: NoodlerPostView;
};

// ---------------------------------------------------------------------------
// SlurpMomentShelfTile
// ---------------------------------------------------------------------------

export function SlurpMomentShelfTile({ moment, isNew, onOpen }: { moment: SlurpMoment; isNew: boolean; onOpen: () => void }) {
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
  newSinceAt,
  onOpenMoment,
  onAddStory,
  embedded = false,
}: {
  moments: SlurpMoment[];
  newSinceAt: string | null;
  onOpenMoment: (postId: string) => void;
  onAddStory?: () => void;
  embedded?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const seenCreators = new Set<string>();
  const creatorMoments = moments.filter((moment) => {
    if (seenCreators.has(moment.creator.profile.id)) return false;
    seenCreators.add(moment.creator.profile.id);
    return true;
  });
  const seenAt = newSinceAt ? new Date(newSinceAt).getTime() : NaN;
  creatorMoments.sort((left, right) => {
    const leftNew = !Number.isNaN(seenAt) && new Date(left.post.createdAt).getTime() > seenAt;
    const rightNew = !Number.isNaN(seenAt) && new Date(right.post.createdAt).getTime() > seenAt;
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
        <div className="flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 pe-10 [scroll-padding-inline-start:1rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden @min-[1024px]:px-5 @min-[1024px]:[scroll-padding-inline-start:1.25rem]">
          {onAddStory && (
            <button
              type="button"
              onClick={onAddStory}
              className="group flex aspect-[3/4] w-[4.75rem] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-xl bg-[color-mix(in_srgb,var(--noodle-accent)_7%,var(--slurp-surface-raised))] text-[var(--noodle-accent)] outline outline-1 -outline-offset-1 outline-[color-mix(in_srgb,var(--noodle-accent)_34%,transparent)] transition-[background-color,transform] hover:bg-[color-mix(in_srgb,var(--noodle-accent)_12%,var(--slurp-surface-raised))] active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--noodle-accent)] @min-[1024px]:w-[5.25rem] motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-current/70 transition-transform group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100">
                <Plus size={17} strokeWidth={2} aria-hidden="true" />
              </span>
              <span className="px-1 text-center text-[0.68rem] font-bold leading-tight">
                {localizeUi("ui.slurp.moments.add")}
              </span>
            </button>
          )}
          {creatorMoments.length === 0 ? (
            <div
              className="flex min-h-24 min-w-[12rem] max-w-xs items-center gap-2.5 text-[var(--muted-foreground)]"
              role="status"
            >
              <Clock3 size={17} className="shrink-0 text-[var(--noodle-accent)]" aria-hidden="true" />
              <span className="text-xs leading-5 text-pretty">{localizeUi("ui.slurp.moments.empty")}</span>
            </div>
          ) : (
            creatorMoments.map((moment) => {
              const isNew = !Number.isNaN(seenAt) && new Date(moment.post.createdAt).getTime() > seenAt;
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
  ctx: NoodlePostCardCtx;
}) {
  const { t: localizeUi } = useUiTranslation();
  const mediaSrc = useSlurpMediaSrc(moment.post.imageUrl, { width: 1600 });
  const [fitImage, setFitImage] = useState(false);
  const rootLikes = moment.post.interactions.filter(
    (interaction) => interaction.type === "like" && !interaction.parentInteractionId,
  );
  const liked = Boolean(
    ctx.personaAccount && rootLikes.some((interaction) => interaction.actorAccountId === ctx.personaAccount!.id),
  );
  const likeCount = moment.post.likeCount ?? rootLikes.length;
  const unlockPrice = (moment.post as { unlockPrice?: unknown }).unlockPrice;
  const recordView = useRecordSlurpStoryView();
  const recordedStoryViews = useRef(new Set<string>());
  const storyViews = useSlurpStoryViews(moment.post.id, personaId, isOwner);
  const openProfile = () => {
    onClose();
    onOpenProfile?.(moment.creator.profile.id);
  };
  useEffect(() => {
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
      media={
        <>
          {mediaSrc && (
            <img src={mediaSrc} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl" />
          )}
          {mediaSrc ? (
            <img
              src={mediaSrc}
              decoding="async"
              fetchPriority="high"
              alt={
                moment.post.locked
                  ? localizeUi("ui.noodle.lockednoodlerpostcard.lockedImageFrom", { name: moment.creator.profile.displayName })
                  : localizeUi("ui.noodle.post.imageBy", { name: moment.creator.profile.displayName })
              }
              className={cn("relative h-full w-full", fitImage ? "object-contain" : "object-cover", moment.post.locked && "saturate-[0.88]")}
            />
          ) : (
            <div className="absolute inset-0 animate-pulse bg-[var(--slurp-surface-raised)] motion-reduce:animate-none" aria-hidden="true" />
          )}
          {moment.post.locked && mediaSrc && <SlurpSparkleVeil />}
          <div className="absolute inset-x-3 top-3 z-10 flex gap-1" role="progressbar" aria-label={localizeUi("ui.slurp.moments.progress")} aria-valuemin={1} aria-valuemax={total} aria-valuenow={index + 1}>
            {Array.from({ length: total }, (_, storyIndex) => (
              <span key={storyIndex} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/35">
                <span className={cn("block h-full rounded-full", storyIndex <= index && "bg-white")} />
              </span>
            ))}
          </div>
          <button type="button" onClick={openProfile} disabled={!onOpenProfile} className="absolute left-4 right-16 top-6 z-10 flex min-h-11 items-center gap-2 rounded-xl text-left text-white drop-shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-default">
            <ProfileInitial profile={moment.creator.profile} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-black">{moment.creator.profile.displayName}</span>
              <span className="block truncate text-[0.68rem] text-white/72">@{moment.creator.profile.handle}</span>
            </span>
          </button>
          <span className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-28 bg-gradient-to-b from-black/60 to-transparent" aria-hidden="true" />
          <button type="button" onClick={onClose} aria-label={localizeUi("ui.slurp.moments.close", { defaultValue: "Close Story" })} title={localizeUi("ui.slurp.moments.close", { defaultValue: "Close Story" })} className="absolute right-3 top-6 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white ring-1 ring-white/20 backdrop-blur-md transition-[background-color,transform] hover:bg-black/70 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white motion-reduce:transition-none motion-reduce:active:scale-100">
            <X size={20} strokeWidth={2.5} aria-hidden="true" />
          </button>
          {onPrevious && (
            <button type="button" onClick={onPrevious} className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white ring-1 ring-white/15 backdrop-blur-sm hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label={localizeUi("ui.slurp.moments.previous")}>
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
          )}
          {onNext && (
            <button type="button" onClick={onNext} className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white ring-1 ring-white/15 backdrop-blur-sm hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label={localizeUi("ui.slurp.moments.next")}>
              <ChevronRight size={22} aria-hidden="true" />
            </button>
          )}
        </>
      }
      side={
        <div data-component="SlurpHome.MomentViewer" className="flex flex-col gap-3 p-4 text-shadow-sm">
          {moment.post.locked && (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--accent)] px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] ring-1 ring-inset ring-[var(--noodle-divider)]">
              <Lock size={11} aria-hidden="true" /> {localizeUi("ui.slurp.locked.blurredPreview")}
            </span>
          )}
          {moment.post.title && <h3 className="text-lg font-bold leading-tight">{moment.post.title}</h3>}
          {!moment.post.locked && moment.post.content && (
            <p className="text-sm leading-6 text-white/80">{moment.post.content}</p>
          )}
          {(!moment.post.locked || mediaSrc) && (
            <div className="flex items-center gap-2">
              {!moment.post.locked && (
                <button
                  type="button"
                  disabled={!ctx.personaAccount || ctx.reactionPendingFor(moment.post.id, "like")}
                  onClick={() => ctx.reactToPost(toNoodlePostCardModel(moment.post, moment.creator.profile), "like", liked)}
                  aria-pressed={liked}
                  aria-label={localizeUi(liked ? "ui.noodle.post.unlikeLabel" : "ui.noodle.post.likeLabel")}
                  className={cn("inline-flex min-h-10 w-fit items-center gap-2 rounded-full bg-white/10 px-3.5 text-sm font-bold ring-1 ring-inset ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50 motion-reduce:transition-none", liked && "text-[var(--noodle-accent)]")}
                >
                  <Heart size={17} fill={liked ? "currentColor" : "none"} aria-hidden="true" />
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
          {linkedPostIdForStory(moment.post) && onOpenProfile && (
            <button type="button" onClick={openProfile} className="inline-flex min-h-10 w-fit items-center gap-2 rounded-lg bg-[var(--accent)] px-3 text-xs font-bold ring-1 ring-inset ring-[var(--noodle-divider)] hover:bg-[var(--noodle-accent)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]">
              <Link size={14} aria-hidden="true" /> {localizeUi("ui.slurp.moments.viewLinkedPost")}
            </button>
          )}
          {moment.post.locked && (
            <div className="grid gap-2">
              <button
                type="button"
                disabled={unlockPending}
                onClick={() => void Promise.resolve(onUnlock(moment.post.id)).catch(() => undefined)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:opacity-50 [&_svg]:!text-zinc-950"
              >
                <Eye size={15} aria-hidden="true" /> {localizeUi("ui.slurp.moments.unlock")}
                {typeof unlockPrice === "number" && <SlurpCoinAmount amount={unlockPrice} />}
              </button>
              <button
                type="button"
                disabled={subscriptionPending}
                onClick={() => void Promise.resolve(onToggleSubscription(moment.creator.profile.id, moment.creator.subscribed)).catch(() => undefined)}
                className="min-h-11 rounded-lg bg-[var(--accent)] px-3 text-xs font-bold ring-1 ring-inset ring-[var(--noodle-divider)] hover:bg-[var(--noodle-accent)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:opacity-50"
              >
                {localizeUi("ui.slurp.profile.subscribe")}
              </button>
            </div>
          )}
        </div>
      }
    />
  );
}
