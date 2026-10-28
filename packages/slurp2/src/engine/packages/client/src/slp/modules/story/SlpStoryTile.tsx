import { SlpLockGlyph } from "../../base/chrome/SlpGlyphs";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";
import { Avatar, SLP_IMG_FRAME_CLASS, slpImgFade } from "../../base/chrome/SlpChrome";
import { SlpRingGlint } from "../sparkle/SlpSparkle";
import type { SlpCreatorPostView } from "../../../../../shared/src/slp/slp-social.types.js";
import type { AvatarCrop } from "@marinara-engine/shared";

type StoryCreator = {
  profile: {
    id: string;
    displayName: string;
    handle: string;
    avatarUrl?: string | null;
    avatarCrop?: AvatarCrop | null;
  };
};

/** One size for Story tiles, their skeleton and the Add Story tile (tall photo tiles, design step 2). */
export const SLP_STORY_TILE_SIZE_CLASS = "h-[8.25rem] w-[5.5rem] @min-[1024px]:h-[9rem] @min-[1024px]:w-[6rem]";

export type SlpStoryTileProps = {
  creator: StoryCreator;
  post: Pick<SlpCreatorPostView, "id" | "imageUrl" | "locked"> & { content?: string | null };
  mediaSrc: string | null;
  fallback: ReactNode;
  isNew: boolean;
  onOpen: () => void;
};

/**
 * A tall photo tile with the Creator's avatar on it. Unseen = hero ring with a travelling glint;
 * seen = no ring, 80 % opacity and slightly muted, so the new ones lead without a label.
 */
export function SlpStoryTile({ creator, post, mediaSrc, fallback, isNew, onOpen }: SlpStoryTileProps) {
  const { t: localizeUi } = useUiTranslation();
  const text = post.content?.trim();
  return (
    <button
      type="button"
      onClick={onOpen}
      data-slp-no-crop-mark=""
      className={cn(
        SLP_STORY_TILE_SIZE_CLASS,
        "group relative shrink-0 snap-start overflow-hidden rounded-2xl bg-[var(--slurp-surface-raised)] text-start transition-transform active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] motion-reduce:transition-none motion-reduce:active:scale-100",
        isNew
          ? "shadow-[0_10px_24px_-14px_color-mix(in_srgb,var(--noodle-accent)_75%,transparent)]"
          : "shadow-[var(--slurp-shadow-raised)]",
      )}
      aria-label={
        localizeUi("ui.slurp.moments.open", { name: creator.profile.displayName }) +
        (isNew ? `, ${localizeUi("ui.slurp.moments.new")}` : "")
      }
    >
      <span
        className={cn(
          "absolute inset-0 transition-[filter,opacity] duration-[var(--slurp-motion-base)]",
          !isNew && "opacity-80 saturate-[0.8] group-hover:opacity-100",
        )}
        aria-hidden="true"
      >
        {post.imageUrl ? (
          // The picture's frame shimmers while it is fetched, then the picture fades in (no text or
          // avatar flashing first).
          <span className={cn("relative block h-full w-full", SLP_IMG_FRAME_CLASS)}>
            {mediaSrc && (
              <img
                key={mediaSrc}
                src={mediaSrc}
                alt=""
                decoding="async"
                {...slpImgFade}
                className="slp-crop h-full w-full object-cover transition-[transform,opacity,filter] duration-[360ms] group-hover:scale-[1.03] motion-reduce:transition-opacity motion-reduce:group-hover:scale-100"
              />
            )}
          </span>
        ) : text ? (
          // A text Story shows its words on the hero gradient, like the viewer does.
          <span className="flex h-full w-full items-center bg-[image:var(--slurp-hero)] px-2 pb-6 pt-9 text-[11px] font-extrabold leading-[14px] text-[var(--slurp-on-hero)] [overflow-wrap:anywhere]">
            <span className="line-clamp-4">{text}</span>
          </span>
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-[linear-gradient(145deg,color-mix(in_srgb,var(--noodle-accent)_14%,var(--slurp-surface-raised)),var(--slurp-surface))]">
            {fallback}
          </span>
        )}
      </span>
      <span
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(to_top,rgba(9,5,12,0.9),rgba(9,5,12,0.3)_60%,transparent)]"
        aria-hidden="true"
      />
      <span
        // Seen: no ring at all, so only new Stories carry the hero ring (step 2 follow-up).
        className={cn("absolute start-1.5 top-1.5 rounded-full", isNew && "bg-[image:var(--slurp-hero)] p-[2px]")}
        aria-hidden="true"
      >
        <span className={cn("block rounded-full", isNew && "bg-[var(--slurp-surface)] p-[1.5px]")}>
          <Avatar account={creator.profile} size="sm" />
        </span>
      </span>
      {post.locked && (
        <span className="absolute end-1.5 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-inset ring-white/15 backdrop-blur-sm">
          <SlpLockGlyph size={12} aria-hidden="true" />
        </span>
      )}
      <span className="absolute inset-x-2 bottom-2 truncate text-xs font-semibold text-white drop-shadow-sm">
        {creator.profile.displayName}
      </span>
      {isNew && <SlpRingGlint />}
    </button>
  );
}
