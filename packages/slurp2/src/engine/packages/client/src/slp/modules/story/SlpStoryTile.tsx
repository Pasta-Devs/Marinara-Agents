import { Lock } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { ReactNode } from "react";
import type { SlpCreatorPostView } from "../../../../../shared/src/slp/slp-social.types.js";

type StoryCreator = {
  profile: {
    id: string;
    displayName: string;
    handle: string;
  };
};

export type SlpStoryTileProps = {
  creator: StoryCreator;
  post: Pick<SlpCreatorPostView, "id" | "imageUrl" | "locked">;
  mediaSrc: string | null;
  fallback: ReactNode;
  isNew: boolean;
  onOpen: () => void;
};

export function SlpStoryTile({ creator, post, mediaSrc, fallback, isNew, onOpen }: SlpStoryTileProps) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative aspect-[3/4] w-[4.75rem] shrink-0 snap-start overflow-hidden rounded-xl bg-[var(--slurp-surface-raised)] text-start shadow-[0_10px_24px_-18px_rgba(0,0,0,0.95)] outline outline-1 -outline-offset-1 outline-white/10 transition-transform active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--noodle-accent)] @min-[1024px]:w-[5.25rem] motion-reduce:transition-none motion-reduce:active:scale-100"
      aria-label={localizeUi("ui.slurp.moments.open", { name: creator.profile.displayName })}
    >
      {mediaSrc ? (
        <img
          src={mediaSrc}
          alt=""
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(145deg,color-mix(in_srgb,var(--noodle-accent)_14%,var(--slurp-surface-raised)),var(--slurp-surface))]">
          {fallback}
        </span>
      )}
      <span
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-[linear-gradient(to_top,rgba(9,5,12,0.92),rgba(9,5,12,0.26)_58%,transparent)]"
        aria-hidden="true"
      />
      <span
        className={`absolute inset-x-2 top-2 h-0.5 rounded-full ${isNew ? "bg-[var(--noodle-accent)] shadow-[0_0_10px_var(--noodle-accent)]" : "bg-white/45"}`}
        aria-hidden="true"
      />
      {post.locked && (
        <span className="absolute end-1.5 top-3.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur-sm ring-1 ring-inset ring-white/15">
          <Lock size={11} aria-hidden="true" />
        </span>
      )}
      <span className="absolute inset-x-2 bottom-2 truncate text-xs font-bold text-white drop-shadow-sm">
        {creator.profile.displayName}
      </span>
    </button>
  );
}
