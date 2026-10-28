import { TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { slpShowPostInPlace } from "./SlpPostPurposeNote";
import { slpTagClass } from "../chrome/SlpButton";

/** The trend a post joined or started (`metadata.slurpTrend`, docs/TRENDS.md): "Trend · Mirror selfies". */
export function SlpPostTrendChip({
  metadata,
  onOpenProfile,
}: {
  metadata?: Record<string, unknown> | null;
  /** Where a tap goes when the origin post is not on screen: the trend starter's page. */
  onOpenProfile?: (accountId: string) => void;
}) {
  const { t } = useTranslation();
  const stamp = metadata?.slurpTrend as { label?: unknown; originPostId?: unknown; starterId?: unknown } | undefined;
  const label = typeof stamp?.label === "string" ? stamp.label : "";
  if (!label) return null;
  const origin = typeof stamp?.originPostId === "string" ? stamp.originPostId : null;
  const starter = typeof stamp?.starterId === "string" ? stamp.starterId : null;
  return (
    <p data-slurp-trend className="mt-1 flex min-w-0 items-center gap-1.5 text-xs leading-4">
      <button
        type="button"
        disabled={!origin && !(starter && onOpenProfile)}
        onClick={() => {
          if (!(origin && slpShowPostInPlace(origin)) && starter) onOpenProfile?.(starter);
        }}
        className={`${slpTagClass()} inline-flex min-w-0 items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:cursor-default`}
      >
        <TrendingUp size={11} aria-hidden="true" className="shrink-0" />
        <span className="min-w-0 truncate">{t("ui.slurp.post.trendChip", { label })}</span>
      </button>
    </p>
  );
}
