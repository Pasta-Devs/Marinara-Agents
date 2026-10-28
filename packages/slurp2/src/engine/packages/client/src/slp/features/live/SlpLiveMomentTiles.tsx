import { useTranslation as useUiTranslation } from "react-i18next";
import { Eye } from "lucide-react";
import { cn } from "../../../lib/utils";
import { SlurpMediaImg } from "../../base/chrome/SlpChrome";
import { useSlurpUIStore } from "../../base/state/slp-package-store";
import { SLP_STORY_TILE_SIZE_CLASS } from "../../modules/story/SlpStoryTile";
import { useCreatorAccounts } from "../creators/slp-creators-contract";
import type { SlpLiveListEntry } from "./slp-live-hooks";

/** A live Creator's Moments tile, first in the shelf: it opens the show instead of their Stories. */
export function SlpLiveMomentTiles({ shows }: { shows: readonly SlpLiveListEntry[] }) {
  const { t } = useUiTranslation();
  const accounts = useCreatorAccounts(shows.length > 0).data ?? [];
  const navigation = useSlurpUIStore((state) => state.navigation);
  const setNavigation = useSlurpUIStore((state) => state.setNavigation);
  return shows.flatMap((show) => {
    const host = accounts.find((account) => account.id === show.hostId);
    if (!host) return [];
    return [
      <button
        key={show.id}
        type="button"
        onClick={() => setNavigation({ mode: "creator", view: "live", showId: show.id, returnTo: navigation })}
        aria-label={t("ui.slurp.live.watch", { name: host.displayName })}
        className={cn(
          SLP_STORY_TILE_SIZE_CLASS,
          "relative shrink-0 snap-start overflow-hidden rounded-2xl bg-[var(--slurp-surface-raised)] text-start ring-2 ring-red-500 transition-transform active:scale-[0.96] focus-visible:outline-none focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none",
        )}
      >
        {host.avatarUrl ? (
          <SlurpMediaImg src={host.avatarUrl} mediaWidth={320} alt="" className="slp-crop h-full w-full object-cover" />
        ) : (
          <span className="block h-full w-full bg-[radial-gradient(circle_at_40%_30%,var(--noodle-accent),transparent_60%),radial-gradient(circle_at_70%_80%,var(--slurp-violet),transparent_55%)]" />
        )}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent"
        />
        <span className="absolute start-1.5 top-1.5 rounded bg-red-600 px-1.5 text-[10px] font-black leading-4 tracking-wide text-white">
          {t("ui.slurp.live.badge")}
        </span>
        <span className="absolute inset-x-2 bottom-2 space-y-0.5 text-white drop-shadow-sm">
          <span className="block truncate text-xs font-semibold">{host.displayName}</span>
          <span className="flex items-center gap-1 text-[11px]">
            <Eye size={12} aria-hidden="true" />
            {show.viewers}
          </span>
        </span>
      </button>,
    ];
  });
}
