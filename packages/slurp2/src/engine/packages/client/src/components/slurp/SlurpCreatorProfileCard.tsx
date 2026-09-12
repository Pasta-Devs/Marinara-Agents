import { useTranslation as useUiTranslation } from "react-i18next";
import type { AvatarCrop } from "@marinara-engine/shared";
import { cn } from "../../lib/utils";
import { useNearViewportSlurpMediaSrc } from "../../hooks/use-slurp-media-src";
import { ProfileInitial } from "./SlurpShell";
import { SlurpEmptyArtwork } from "./SlurpEmptyArtwork";

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
  onOpenProfile,
  className,
}: {
  creator: SlurpCreatorProfileCardCreator;
  onOpenProfile?: (accountId: string) => void;
  className?: string;
}) {
  const { t: localizeUi } = useUiTranslation();
  const openProfile = onOpenProfile ? () => onOpenProfile(creator.profile.id) : undefined;
  const { src: bannerSrc, observe: observeBanner } = useNearViewportSlurpMediaSrc(creator.profile.bannerUrl ?? null, {
    width: 640,
  });

  return (
    <article
      className={cn(
        "group @container flex min-w-0 flex-col overflow-hidden rounded-2xl bg-[var(--slurp-surface)] shadow-[0_1px_0_var(--noodle-divider),0_18px_38px_-28px_rgba(0,0,0,0.9)] ring-1 ring-inset ring-[var(--noodle-divider)] transition-[background-color,box-shadow,transform] hover:-translate-y-0.5 hover:bg-[var(--slurp-surface-raised)] hover:shadow-[0_1px_0_color-mix(in_srgb,var(--noodle-accent)_62%,transparent),0_22px_42px_-26px_rgba(0,0,0,0.92)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className,
      )}
    >
      <div
        ref={observeBanner}
        className="relative h-28 w-full overflow-hidden bg-[var(--noodle-accent)]/15 @min-[22rem]:h-32"
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
      <div className="relative z-10 -mt-8 flex flex-1 flex-col px-4 pb-3">
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
        <div className="mt-auto flex min-h-14 items-end justify-end border-t border-[var(--noodle-divider)] pt-3">
          <button
            type="button"
            onClick={openProfile}
            disabled={!openProfile}
            className="min-h-10 rounded-full border border-[color-mix(in_srgb,var(--noodle-accent)_54%,var(--noodle-divider))] bg-[color-mix(in_srgb,var(--noodle-accent)_8%,transparent)] px-4 text-xs font-bold text-[var(--noodle-accent-foreground)] transition-[background-color,border-color,transform] hover:border-[var(--noodle-accent)] hover:bg-[color-mix(in_srgb,var(--noodle-accent)_16%,transparent)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--slurp-surface)] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:cursor-default disabled:opacity-50"
          >
            {localizeUi("ui.slurp.settings.creators.viewProfile")}
          </button>
        </div>
      </div>
    </article>
  );
}
