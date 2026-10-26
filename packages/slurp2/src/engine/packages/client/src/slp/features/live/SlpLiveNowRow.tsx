import { useTranslation as useUiTranslation } from "react-i18next";
import { Eye } from "lucide-react";
import { Avatar } from "../../base/chrome/SlpChrome";
import { useSlurpUIStore } from "../../base/state/slp-package-store";
import { useCreatorAccounts } from "../creators/slp-creators-contract";
import { useSlpLiveNow } from "./slp-live-hooks";

/** Who is live right now, on top of the feed. Hidden when nobody is, or when Live is off. */
export function SlpLiveNowRow() {
  const { t } = useUiTranslation();
  const shows = useSlpLiveNow().data ?? [];
  const accounts = useCreatorAccounts(shows.length > 0).data ?? [];
  const navigation = useSlurpUIStore((state) => state.navigation);
  const setNavigation = useSlurpUIStore((state) => state.setNavigation);
  const live = shows.flatMap((show) => {
    const host = accounts.find((account) => account.id === show.hostId);
    return host ? [{ show, host }] : [];
  });
  if (!live.length) return null;
  return (
    <section aria-label={t("ui.slurp.live.liveNow")} className="mx-4 mt-3 sm:mx-5">
      <ul className="flex gap-3 overflow-x-auto p-1">
        {live.map(({ show, host }) => (
          <li key={show.id} className="shrink-0">
            <button
              type="button"
              onClick={() => setNavigation({ mode: "creator", view: "live", showId: show.id, returnTo: navigation })}
              aria-label={t("ui.slurp.live.watch", { name: host.displayName })}
              className="flex w-20 flex-col items-center gap-1 text-center"
            >
              <span className="relative rounded-full p-0.5 ring-2 ring-red-500">
                <Avatar account={host} size="md" />
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded bg-red-600 px-1.5 text-[10px] font-black leading-4 tracking-wide text-white">
                  {t("ui.slurp.live.badge")}
                </span>
              </span>
              <span className="mt-1 w-full truncate text-xs font-semibold">{host.displayName}</span>
              <span className="flex items-center gap-1 text-[11px] text-[var(--slurp-muted)]">
                <Eye size={12} aria-hidden="true" />
                {show.viewers}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
