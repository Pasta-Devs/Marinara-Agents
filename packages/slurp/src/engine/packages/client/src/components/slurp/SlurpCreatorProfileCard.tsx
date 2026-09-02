import { Plus } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { AvatarCrop } from "@marinara-engine/shared";
import { cn } from "../../lib/utils";
import { useNearViewportSlurpMediaSrc } from "../../hooks/use-slurp-media-src";
import { ProfileInitial } from "./SlurpShell";

export type SlurpCreatorProfileCardCreator = {
  profile: {
    id: string;
    displayName: string;
    handle: string;
    bio?: string | null;
    avatarUrl?: string | null;
    avatarCrop?: AvatarCrop | null;
    bannerUrl?: string | null;
  };
  followed: boolean;
  subscribed: boolean;
};

export function SlurpCreatorProfileCard({
  creator,
  variant = "regular",
  pending = false,
  onOpenProfile,
  onToggleFollow,
  onToggleSubscription,
  showFollow = variant === "regular",
  showSubscription = true,
  showProfileAction = false,
  className,
}: {
  creator: SlurpCreatorProfileCardCreator;
  variant?: "regular" | "compact";
  pending?: boolean;
  onOpenProfile?: (accountId: string) => void;
  onToggleFollow?: (creatorAccountId: string, followed: boolean) => void;
  onToggleSubscription?: (creatorAccountId: string, subscribed: boolean) => void;
  showFollow?: boolean;
  showSubscription?: boolean;
  showProfileAction?: boolean;
  className?: string;
}) {
  const { t: localizeUi } = useUiTranslation();
  const openProfile = onOpenProfile ? () => onOpenProfile(creator.profile.id) : undefined;
  const { src: bannerSrc, observe: observeBanner } = useNearViewportSlurpMediaSrc(creator.profile.bannerUrl ?? null, {
    width: 640,
  });
  const actions =
    (showFollow && onToggleFollow) || (showSubscription && onToggleSubscription) || (showProfileAction && openProfile);

  if (variant === "compact") {
    return (
      <article
        className={cn(
          "flex min-w-0 items-center gap-2.5 rounded-xl bg-[var(--accent)]/35 p-2.5 ring-1 ring-inset ring-[var(--noodle-divider)] transition-colors hover:bg-[var(--accent)]/60",
          className,
        )}
      >
        <button
          type="button"
          onClick={openProfile}
          disabled={!openProfile}
          className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:cursor-default"
          aria-label={localizeUi("ui.noodle.noodlehome.viewValue1", { value1: creator.profile.handle })}
        >
          <ProfileInitial profile={creator.profile} />
        </button>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={openProfile}
            disabled={!openProfile}
            className="block w-full truncate text-left text-sm font-bold disabled:cursor-default"
          >
            {creator.profile.displayName}
          </button>
          <p className="truncate text-xs text-[var(--muted-foreground)]">@{creator.profile.handle}</p>
          {showSubscription && onToggleSubscription && (
            <button
              type="button"
              disabled={pending}
              onClick={() => onToggleSubscription(creator.profile.id, creator.subscribed)}
              className="mt-1 inline-flex min-h-8 items-center gap-1 text-xs font-bold text-[var(--noodle-accent)] disabled:opacity-50"
            >
              {creator.subscribed ? (
                <>{localizeUi("ui.noodle.subscriptionsections.unsubscribe")}</>
              ) : (
                <Plus size={13} />
              )}
              {creator.subscribed ? null : localizeUi("ui.noodle.lockednoodlerpostcard.subscribe")}
            </button>
          )}
        </div>
      </article>
    );
  }

  return (
    <article
      className={cn(
        "group flex min-w-0 flex-col overflow-hidden rounded-xl bg-[var(--slurp-surface)] shadow-[0_1px_0_var(--noodle-divider),0_14px_30px_-24px_rgba(0,0,0,0.75)] ring-1 ring-inset ring-[var(--noodle-divider)] transition-[background-color,box-shadow,transform] hover:-translate-y-0.5 hover:bg-[var(--slurp-surface-raised)] hover:shadow-[0_1px_0_var(--noodle-accent),0_18px_36px_-22px_rgba(0,0,0,0.8)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className,
      )}
    >
      <button
        ref={observeBanner}
        type="button"
        onClick={openProfile}
        disabled={!openProfile}
        className="relative block h-28 w-full overflow-hidden bg-[var(--noodle-accent)]/15 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)] disabled:cursor-default"
        aria-label={localizeUi("ui.noodle.noodlehome.viewValue1", { value1: creator.profile.displayName })}
      >
        {bannerSrc ? (
          <img src={bannerSrc} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : null}
        <span
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(8,4,10,0.82),transparent_72%)]"
          aria-hidden="true"
        />
        <span className="absolute bottom-3 start-3 rounded-full bg-[var(--slurp-canvas)] p-0.5 shadow-lg ring-1 ring-white/10">
          <ProfileInitial profile={creator.profile} />
        </span>
      </button>
      <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
        <button
          type="button"
          onClick={openProfile}
          disabled={!openProfile}
          className="min-w-0 text-left disabled:cursor-default"
        >
          <span className="block truncate text-base font-bold">{creator.profile.displayName}</span>
          <span className="block truncate text-xs text-[var(--muted-foreground)]">@{creator.profile.handle}</span>
        </button>
        {creator.profile.bio && (
          <p className="mt-2 line-clamp-3 min-h-10 text-xs leading-5 text-[var(--muted-foreground)]">
            {creator.profile.bio}
          </p>
        )}
        {actions && (
          <div className="mt-auto flex flex-wrap gap-2 pt-4">
            {showFollow && onToggleFollow && (
              <button
                type="button"
                disabled={pending}
                onClick={() => onToggleFollow(creator.profile.id, creator.followed)}
                className="min-h-11 rounded-lg border border-[var(--noodle-divider)] px-3 text-xs font-bold hover:bg-[var(--accent)] disabled:opacity-50"
              >
                {creator.followed ? localizeUi("ui.slurp.profile.following") : localizeUi("ui.slurp.profile.follow")}
              </button>
            )}
            {showSubscription && onToggleSubscription && (
              <button
                type="button"
                disabled={pending}
                onClick={() => onToggleSubscription(creator.profile.id, creator.subscribed)}
                className="min-h-11 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 hover:opacity-90 disabled:opacity-50"
              >
                {creator.subscribed
                  ? localizeUi("ui.slurp.profile.subscribed")
                  : localizeUi("ui.slurp.profile.subscribe")}
              </button>
            )}
            {showProfileAction && openProfile && (
              <button
                type="button"
                onClick={openProfile}
                className="min-h-11 flex-1 rounded-lg border border-[var(--noodle-divider)] px-3 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
              >
                {localizeUi("ui.noodle.noodlehome.profile")}
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
