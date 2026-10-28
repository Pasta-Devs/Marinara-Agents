import { useTranslation as useUiTranslation } from "react-i18next";
import type { AvatarCrop } from "@marinara-engine/shared";
import { cn } from "../../../lib/utils";
import { useNearViewportSlurpMediaSrc } from "../../base/media/slp-media-src";
import { Avatar, SLP_IMG_FRAME_CLASS, slpImgFade } from "../../base/chrome/SlpChrome";
import { SlurpEmptyArtwork } from "../../base/chrome/SlpEmptyArtwork";
import { Check, ChevronRight, Loader2 } from "lucide-react";
import { DEFAULT_SLURP_SUBSCRIPTION_PRICE, SlurpCoinAmount } from "../coin/SlpCoin";
import type { SlurpDiscoveryGender } from "../../base/state/slp-state-types";
import { toast } from "sonner";
import { formatUpcomingDay } from "../../base/ui/slp-date-time";
import { SlpButton, SlpPrimaryButton } from "../chrome/SlpButton";
import { showSlpSubscriptionCancelledToast } from "../chrome/slp-subscription-toast";
import { playSlpSpendMoment, SlpGlint } from "../sparkle/SlpSparkle";
import { SlpStoryRingAvatar } from "../story/SlpStoryRing";
import { slurpCreatorCoverUrl } from "./slp-creator-cover";

export type SlurpCreatorProfileCardCreator = {
  profile: {
    id: string;
    displayName: string;
    handle: string;
    bio?: string | null;
    avatarUrl?: string | null;
    avatarCrop?: AvatarCrop | null;
    bannerUrl?: string | null;
    gender?: SlurpDiscoveryGender | null;
    tags?: string[];
  };
  followed: boolean;
  subscribed: boolean;
  subscriptionPrice?: number | null;
  /** The paid period, when the wallet knows it: "ends Thu" in the cancel toast, Resume while cancelled. */
  subscription?: { until: string; cancelled: boolean } | null;
  /** Their posts, when known: a Creator with no banner shows their newest free picture as the cover. */
  posts?: Parameters<typeof slurpCreatorCoverUrl>[0]["posts"];
};

type SubscriptionProps = {
  subscriptionPending?: boolean;
  /** One tap subscribes (the spend moment is the feedback); one tap cancels, with Undo. */
  onToggleSubscription?: (accountId: string, subscribed: boolean) => unknown;
};

/**
 * A Creator avatar with the canvas gap. While they have a live Story it wears the Story ring in the
 * gap (glint = not watched yet, muted = watched) and a tap opens their Stories (T).
 */
export function SlpCreatorAvatar({
  profile,
  className,
  gapClassName = "bg-[var(--slurp-surface-raised)]",
}: {
  profile: SlurpCreatorProfileCardCreator["profile"];
  /** Avatar size (defaults to 40 px). */
  className?: string;
  /** The gap colour: the surface the avatar sits on. */
  gapClassName?: string;
}) {
  return (
    <SlpStoryRingAvatar creatorId={profile.id} name={profile.displayName} outset={0}>
      <span className={cn("relative isolate block w-fit shrink-0 rounded-full p-[3px]", gapClassName)}>
        <Avatar account={profile} className={cn("h-10 w-10 border-0", className)} />
      </span>
    </SlpStoryRingAvatar>
  );
}

/** Subscribe with the price on the button, or "Subscribed" (one tap cancels, with Undo in the toast). */
function SlpCreatorSubscribeButton({
  creator,
  subscriptionPending = false,
  onToggleSubscription,
  primary = false,
}: SubscriptionProps & { creator: SlurpCreatorProfileCardCreator; primary?: boolean }) {
  const { t: localizeUi, i18n } = useUiTranslation();
  const price = creator.subscriptionPrice ?? DEFAULT_SLURP_SUBSCRIPTION_PRICE;
  const perWeek = localizeUi("ui.slurp.unlocksheet.perWeek", { defaultValue: "/ week" });
  const subscribeLabel = localizeUi("ui.slurp.discover.subscribe", { defaultValue: "Subscribe" });
  if (!onToggleSubscription) return null;
  if (creator.subscribed) {
    const until = creator.subscription?.until ?? null;
    const endsDay = until && Date.parse(until) > Date.now() ? formatUpcomingDay(until, i18n.language) : null;
    // Resuming inside the paid week charges nothing.
    const resume = () =>
      Promise.resolve(onToggleSubscription(creator.profile.id, false)).then(
        () =>
          toast.success(localizeUi("ui.slurp.profile.subscriptionResumed", { defaultValue: "Subscription resumed" })),
        () => undefined,
      );
    // Cancelled but still paid: the card says when it ends and offers Resume, like the profile.
    if (creator.subscription?.cancelled && endsDay) {
      return (
        <SlpButton
          variant="secondary"
          disabled={subscriptionPending}
          onClick={() => void resume()}
          className="w-full gap-1.5 px-3 text-[13px]"
        >
          <span>{localizeUi("ui.slurp.discover.resume", { defaultValue: "Resume" })}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate text-xs font-semibold text-[var(--slurp-warning)]">
            {localizeUi("ui.slurp.profile.endsDay", { defaultValue: "ends {{day}}", day: endsDay })}
          </span>
        </SlpButton>
      );
    }
    // One tap cancels (design step 6); the toast offers Undo, which resumes inside the paid week.
    const cancel = () =>
      void Promise.resolve(onToggleSubscription(creator.profile.id, true)).then(
        () => showSlpSubscriptionCancelledToast({ localizeUi, endsDay, onUndo: resume }),
        () => undefined,
      );
    return (
      <SlpButton variant="quiet" aria-pressed disabled={subscriptionPending} onClick={cancel} className="w-full px-3">
        <Check size={16} aria-hidden="true" />
        {localizeUi("ui.slurp.discover.subscribed", { defaultValue: "Subscribed" })}
      </SlpButton>
    );
  }
  const subscribe = (event: React.MouseEvent<HTMLButtonElement>) => {
    // One tap, no confirmation: the spend moment is the feedback (design language §7).
    const origin = event.currentTarget.getBoundingClientRect();
    void Promise.resolve(onToggleSubscription(creator.profile.id, false)).then(
      () => playSlpSpendMoment(origin),
      () => undefined,
    );
  };
  const pending = subscriptionPending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />;
  if (primary) {
    return (
      <SlpPrimaryButton disabled={subscriptionPending} onClick={subscribe} className="whitespace-nowrap px-4">
        {pending}
        {subscribeLabel}
        <span aria-hidden="true">·</span>
        <SlurpCoinAmount amount={price} suffix={perWeek} />
      </SlpPrimaryButton>
    );
  }
  // A narrow grid card has no room for "/ week" beside the word, so the price rides in a chip inside
  // the button and gains "/ week" once the card is wide enough.
  return (
    <SlpButton
      variant="secondary"
      disabled={subscriptionPending}
      onClick={subscribe}
      className="w-full justify-between gap-1 pe-1.5 ps-3 text-[13px]"
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {pending}
        {subscribeLabel}
      </span>
      <span className="inline-flex h-8 shrink-0 items-center rounded-full bg-[var(--slurp-surface-raised)] px-2 text-xs font-bold tabular-nums shadow-[var(--slurp-highlight)]">
        <SlurpCoinAmount amount={price} />
        <span className="ms-1 hidden font-semibold text-[var(--slurp-muted)] @min-[13rem]:inline">{perWeek}</span>
      </span>
    </SlpButton>
  );
}

/** The cover picture (banner or newest free photo); with none, the avatar blurred into a pink wash. */
function SlpCreatorCover({ creator, className }: { creator: SlurpCreatorProfileCardCreator; className?: string }) {
  const coverUrl = slurpCreatorCoverUrl(creator);
  const { src, observe } = useNearViewportSlurpMediaSrc(coverUrl ?? creator.profile.avatarUrl ?? null, {
    width: coverUrl ? 640 : 96,
  });
  return (
    <div
      ref={observe}
      className={cn(
        "relative overflow-hidden bg-[linear-gradient(135deg,color-mix(in_srgb,var(--noodle-accent)_30%,var(--slurp-surface)),color-mix(in_srgb,#8b5cf6_24%,var(--slurp-surface)))]",
        src && SLP_IMG_FRAME_CLASS,
        className,
      )}
    >
      {src ? (
        <img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          {...slpImgFade}
          className={cn(
            "slp-crop-top h-full w-full object-cover transition-[transform,opacity,filter] duration-[360ms] group-hover:scale-[1.015] motion-reduce:transition-opacity motion-reduce:group-hover:scale-100",
            !coverUrl && "scale-150 opacity-60 blur-2xl group-hover:scale-150",
          )}
        />
      ) : (
        <SlurpEmptyArtwork className="absolute inset-0 opacity-90" />
      )}
    </div>
  );
}

/**
 * The Creator card (Discover grid, suggested row): cover, avatar with the Story ring, name, one line,
 * and Subscribe with its price. Tapping anywhere else opens the profile. `row` is the compact line
 * for rails, `featured` the big banner card of Discover's carousel.
 */
export function SlurpCreatorProfileCard({
  creator,
  onOpenProfile,
  layout = "grid",
  showDiscoveryActions = false,
  subscriptionPending = false,
  onToggleSubscription,
  className,
}: SubscriptionProps & {
  creator: SlurpCreatorProfileCardCreator;
  onOpenProfile?: (accountId: string) => void;
  layout?: "grid" | "row" | "featured";
  showDiscoveryActions?: boolean;
  className?: string;
}) {
  const { t: localizeUi } = useUiTranslation();
  const openProfile = onOpenProfile ? () => onOpenProfile(creator.profile.id) : undefined;
  const line = creator.profile.bio?.trim() || `@${creator.profile.handle}`;
  const subscribe = showDiscoveryActions && (
    <SlpCreatorSubscribeButton
      creator={creator}
      subscriptionPending={subscriptionPending}
      onToggleSubscription={onToggleSubscription}
      primary={layout === "featured"}
    />
  );
  // The whole card opens the profile; the Subscribe button sits above this cover-all button.
  const openButton = (
    <button
      type="button"
      onClick={openProfile}
      disabled={!openProfile}
      aria-label={`${localizeUi("ui.slurp.settings.creators.viewProfile")}: ${creator.profile.displayName}`}
      className="absolute inset-0 z-[1] rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] disabled:cursor-default"
    />
  );

  if (layout === "row") {
    return (
      <button
        type="button"
        onClick={openProfile}
        disabled={!openProfile}
        className={cn(
          "flex min-h-14 w-full min-w-0 items-center gap-3 rounded-xl px-2.5 py-2 text-start transition-[background-color,transform] duration-[var(--slurp-motion-fast)] hover:bg-[var(--accent)] active:scale-[0.96] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] disabled:cursor-default",
          className,
        )}
      >
        <SlpCreatorAvatar profile={creator.profile} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-bold leading-5">{creator.profile.displayName}</span>
          <span className="block truncate text-xs leading-4 text-[var(--slurp-muted)]">{line}</span>
        </span>
        {creator.subscribed ? (
          <Check size={16} aria-hidden="true" className="shrink-0 text-[var(--slurp-ink)]" />
        ) : (
          <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-[var(--slurp-muted)]" />
        )}
      </button>
    );
  }

  if (layout === "featured") {
    return (
      <article
        className={cn(
          "group relative isolate flex aspect-[4/3] min-w-0 flex-col justify-end overflow-hidden rounded-3xl bg-[var(--slurp-surface-raised)] shadow-[var(--slurp-shadow-floating),var(--slurp-highlight)] @min-[36rem]:aspect-[16/9]",
          className,
        )}
      >
        <SlpCreatorCover creator={creator} className="absolute inset-0 -z-10" />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(12_6_14/0.9)_0%,rgb(12_6_14/0.55)_38%,transparent_70%)]"
        />
        {/* The glint sweeps over the picture once on appear and again on hover. */}
        <span className="pointer-events-none absolute inset-0 isolate rounded-[inherit]" aria-hidden="true">
          <SlpGlint />
        </span>
        {openButton}
        <div className="pointer-events-none relative flex items-end gap-3 p-4 text-white">
          <SlpCreatorAvatar
            profile={creator.profile}

            className="h-14 w-14"
            gapClassName="bg-black/30 backdrop-blur-sm"
          />
          <div className="min-w-0 flex-1 pb-0.5">
            <h3 className="truncate text-xl font-extrabold leading-[26px] tracking-[-0.01em] [text-shadow:0_1px_12px_rgb(0_0_0/0.5)]">
              {creator.profile.displayName}
            </h3>
            <p className="truncate text-xs leading-4 text-white/80">{line}</p>
          </div>
        </div>
        {subscribe && <div className="relative z-[2] w-fit max-w-full px-4 pb-4 [&_button]:w-auto">{subscribe}</div>}
      </article>
    );
  }

  return (
    <article
      className={cn(
        "group @container relative isolate flex min-w-0 flex-col overflow-hidden rounded-2xl bg-[var(--slurp-surface-raised)] shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)] transition-shadow duration-[var(--slurp-motion-base)] hover:shadow-[var(--slurp-shadow-floating),var(--slurp-highlight)] motion-reduce:transition-none",
        className,
      )}
    >
      {openButton}
      <SlpCreatorCover creator={creator} className="aspect-[16/10] w-full" />
      <div className="pointer-events-none relative flex flex-1 flex-col px-3 pb-3">
        {/* The avatar sits half over the cover. */}
        <div className="-mt-7">
          <SlpCreatorAvatar profile={creator.profile} className="h-12 w-12" />
        </div>
        <div className="min-w-0 pt-1.5">
          <h3 className="truncate text-[15px] font-bold leading-5">{creator.profile.displayName}</h3>
          <p className="truncate text-xs leading-4 text-[var(--slurp-muted)]">{line}</p>
        </div>
        {subscribe && <div className="pointer-events-auto relative z-[2] mt-auto pt-3">{subscribe}</div>}
      </div>
    </article>
  );
}
