import { useTranslation as useUiTranslation } from "react-i18next";
import type { AvatarCrop } from "@marinara-engine/shared";
import { cn } from "../../../lib/utils";
import { useNearViewportSlurpMediaSrc } from "../../base/media/slp-media-src";
import { ProfileInitial } from "../../base/chrome/SlpChrome";
import { SlurpEmptyArtwork } from "../../base/chrome/SlpEmptyArtwork";
import { Check, Loader2 } from "lucide-react";
import { DEFAULT_SLURP_SUBSCRIPTION_PRICE, SlurpCoinAmount } from "../coin/SlpCoin";
import type { SlurpDiscoverLayout } from "../../base/state/slp-state-types";
import type { SlurpDiscoveryGender } from "../../base/state/slp-state-types";
import { showConfirmDialog } from "../../../lib/app-dialogs";

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
};

export function SlurpCreatorProfileCard({
  creator,
  onOpenProfile,
  layout = "grid",
  showDiscoveryActions = false,
  subscriptionPending = false,
  onToggleSubscription,
  className,
}: {
  creator: SlurpCreatorProfileCardCreator;
  onOpenProfile?: (accountId: string) => void;
  layout?: SlurpDiscoverLayout;
  showDiscoveryActions?: boolean;
  subscriptionPending?: boolean;
  onToggleSubscription?: (accountId: string, subscribed: boolean) => void;
  className?: string;
}) {
  const { t: localizeUi } = useUiTranslation();
  const openProfile = onOpenProfile ? () => onOpenProfile(creator.profile.id) : undefined;
  const { src: bannerSrc, observe: observeBanner } = useNearViewportSlurpMediaSrc(creator.profile.bannerUrl ?? null, {
    width: 640,
  });
  const tags = creator.profile.tags ?? [];
  const visibleTagCount = layout === "list" ? 6 : 3;
  const visibleTags = tags.slice(0, visibleTagCount);
  const hiddenTagCount = Math.max(0, tags.length - visibleTags.length);
  const toggleSubscription = async () => {
    if (!onToggleSubscription) return;
    if (
      creator.subscribed &&
      !(await showConfirmDialog({
        title: localizeUi("ui.slurp.subscription.cancelTitle", { defaultValue: "Cancel subscription?" }),
        detail: localizeUi("ui.slurp.subscription.cancelDetail", {
          defaultValue:
            "You keep subscriber access until the week you already paid for ends. It will not renew after that.",
        }),
        confirmLabel: localizeUi("ui.slurp.subscription.cancelAction", { defaultValue: "Cancel subscription" }),
        destructive: true,
      }))
    )
      return;
    onToggleSubscription(creator.profile.id, creator.subscribed);
  };

  return (
    <article
      className={cn(
        "group @container flex min-w-0 overflow-hidden rounded-2xl bg-[var(--slurp-surface)] shadow-[0_1px_0_var(--noodle-divider),0_18px_38px_-28px_rgba(0,0,0,0.9)] ring-1 ring-inset ring-[var(--noodle-divider)] transition-[background-color,box-shadow,transform] hover:-translate-y-0.5 hover:bg-[var(--slurp-surface-raised)] hover:shadow-[0_1px_0_color-mix(in_srgb,var(--noodle-accent)_62%,transparent),0_22px_42px_-26px_rgba(0,0,0,0.92)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        layout === "list" ? "flex-col sm:flex-row" : "flex-col",
        className,
      )}
    >
      <div
        ref={observeBanner}
        className={cn(
          "relative h-28 w-full shrink-0 overflow-hidden bg-[var(--noodle-accent)]/15 @min-[22rem]:h-32",
          layout === "list" && "sm:h-auto sm:w-52 sm:self-stretch",
        )}
      >
        {bannerSrc ? (
          <img
            src={bannerSrc}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover outline -outline-offset-1 outline-white/10 transition-transform duration-300 group-hover:scale-[1.015] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <SlurpEmptyArtwork className="absolute inset-0 opacity-90" />
        )}
        <span
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,var(--slurp-surface)_0%,color-mix(in_srgb,var(--slurp-surface)_82%,transparent)_30%,rgba(8,4,10,0.24)_58%,transparent_82%)] transition-[opacity] group-hover:opacity-90"
          aria-hidden="true"
        />
      </div>
      <div
        className={cn(
          "relative z-10 flex flex-1 flex-col px-4 pb-3",
          layout === "list" ? "-mt-8 sm:mt-0 sm:py-4" : "-mt-8",
        )}
      >
        <div className="flex min-w-0 items-end gap-3">
          <span className="shrink-0 rounded-full bg-[var(--slurp-canvas)] p-0.5 shadow-[0_8px_20px_-10px_rgba(0,0,0,0.95)] ring-1 ring-white/10">
            <ProfileInitial profile={creator.profile} />
          </span>
          <div className="min-w-0 pb-0.5">
            <h3 className="truncate text-base font-black tracking-tight">{creator.profile.displayName}</h3>
            <p className="truncate text-xs text-[var(--muted-foreground)]">@{creator.profile.handle}</p>
          </div>
        </div>
        {creator.profile.bio && (
          <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-[var(--muted-foreground)]">
            {creator.profile.bio}
          </p>
        )}
        {(visibleTags.length > 0 || creator.profile.gender) && (
          <div
            className="mt-3 flex flex-wrap gap-1.5"
            aria-label={localizeUi("ui.slurp.discover.creatorTags", { defaultValue: "Creator tags" })}
          >
            {creator.profile.gender && (
              <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-bold capitalize text-[var(--muted-foreground)]">
                {localizeUi(`ui.slurp.discover.gender.${creator.profile.gender}`, {
                  defaultValue: creator.profile.gender,
                })}
              </span>
            )}
            {visibleTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[color-mix(in_srgb,var(--noodle-accent)_12%,var(--accent))] px-2.5 py-1 text-[11px] font-bold text-[var(--noodle-accent-foreground)]"
              >
                {localizeUi(`ui.slurp.tags.${tag}`, { defaultValue: tag })}
              </span>
            ))}
            {hiddenTagCount > 0 && (
              <span className="px-1 py-1 text-[11px] font-bold text-[var(--muted-foreground)]">+{hiddenTagCount}</span>
            )}
          </div>
        )}
        <div
          className={cn(
            "mt-auto flex min-h-14 items-end gap-2 border-t border-[var(--noodle-divider)] pt-3",
            showDiscoveryActions ? "justify-between" : "justify-end",
          )}
        >
          <button
            type="button"
            onClick={openProfile}
            disabled={!openProfile}
            className="min-h-10 rounded-full border border-[color-mix(in_srgb,var(--noodle-accent)_54%,var(--noodle-divider))] bg-[color-mix(in_srgb,var(--noodle-accent)_8%,transparent)] px-4 text-xs font-bold text-[var(--noodle-accent-foreground)] transition-[background-color,border-color,transform] hover:border-[var(--noodle-accent)] hover:bg-[color-mix(in_srgb,var(--noodle-accent)_16%,transparent)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--slurp-surface)] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:cursor-default disabled:opacity-50"
          >
            {localizeUi("ui.slurp.settings.creators.viewProfile")}
          </button>
          {showDiscoveryActions && (
            <button
              type="button"
              onClick={() => void toggleSubscription()}
              disabled={!onToggleSubscription || subscriptionPending}
              aria-pressed={creator.subscribed}
              className={cn(
                "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-black transition-[background-color,transform] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--slurp-surface)] disabled:opacity-60 motion-reduce:transition-none",
                creator.subscribed
                  ? "bg-[var(--accent)] text-[var(--foreground)]"
                  : "bg-[var(--noodle-accent)] text-white shadow-[0_10px_24px_-12px_var(--noodle-accent)]",
              )}
            >
              {subscriptionPending ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : creator.subscribed ? (
                <Check size={14} aria-hidden="true" />
              ) : null}
              {creator.subscribed ? (
                localizeUi("ui.slurp.discover.subscribed", { defaultValue: "Subscribed" })
              ) : (
                <>
                  {localizeUi("ui.slurp.discover.subscribe", { defaultValue: "Subscribe" })} ·{" "}
                  <SlurpCoinAmount
                    amount={`${creator.subscriptionPrice ?? DEFAULT_SLURP_SUBSCRIPTION_PRICE}/week`}
                    size={13}
                  />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
