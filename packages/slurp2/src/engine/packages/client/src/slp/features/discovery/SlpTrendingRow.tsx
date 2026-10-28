import { TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SLP_TYPE } from "../../base/chrome/SlpChrome";
import { cn } from "../../../lib/utils";
import { slpTagClass } from "../../modules/chrome/SlpButton";
import { useSlurpTrends } from "./slp-trends-hooks";

/**
 * "Trending on Slurp": a row of small cards, one per live trend, above Discover's Featured. Tapping one
 * searches its label, which finds the posts that joined it. Nothing is drawn while no trend is live.
 */
export function SlpTrendingRow({ onPick }: { onPick: (label: string) => void }) {
  const { t } = useTranslation();
  const trends = useSlurpTrends().data ?? [];
  if (!trends.length) return null;
  return (
    <section aria-labelledby="slurp-discover-trending" className="pb-1 pt-3">
      <div className="flex items-baseline justify-between gap-3 px-1 pb-2.5">
        <h2 id="slurp-discover-trending" className={SLP_TYPE.title}>
          {t("ui.slurp.discover.trending")}
        </h2>
      </div>
      <ul className="-mx-3 flex snap-x gap-2.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {trends.map((trend) => (
          <li key={trend.id} className="w-[11.5rem] shrink-0 snap-start">
            <button
              type="button"
              onClick={() => onPick(trend.label)}
              className="flex h-full w-full flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--slurp-canvas,var(--background))] p-3 text-start transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
            >
              <span className="flex items-center justify-between gap-2">
                <TrendingUp size={16} aria-hidden="true" className="shrink-0 text-[var(--noodle-accent)]" />
                <span className={slpTagClass()}>{t(`ui.slurp.discover.trendStage.${trend.stage}`)}</span>
              </span>
              <span className="line-clamp-2 break-words text-sm font-semibold leading-5">{trend.label}</span>
              <span className={cn(SLP_TYPE.meta, "mt-auto text-[var(--slurp-muted)]")}>
                {trend.starter
                  ? t("ui.slurp.discover.trendBy", { name: trend.starter.name, count: trend.joined })
                  : t("ui.slurp.discover.trendJoined", { count: trend.joined })}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
