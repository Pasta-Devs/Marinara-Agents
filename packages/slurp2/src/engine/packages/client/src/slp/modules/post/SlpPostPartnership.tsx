import { Flame, TrendingUp, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SlpPostPartnership as Partnership } from "../../../../../shared/src/slp/slp-social.types.js";
import { slpTagClass } from "../chrome/SlpButton";
import { SlpHeartGlyph } from "../../base/chrome/SlpGlyphs";

/**
 * The line under a post's name: "with @mira" on a joint collab post (it shows on both pages), "Collab
 * soon with @mira" on its announcement (U), a heart and "with @kai" on an old joint couple post, "by
 * @mira" on a couple's shared page, or "Paid partnership · PeakFuel" on a sponsored one. Nothing on
 * any other post: a couple's everyday post has no tag (U: couple = life).
 */
export function SlpPostPartnership({
  partnership,
  onOpenProfile,
}: {
  partnership?: Partnership | null;
  onOpenProfile?: (accountId: string) => void;
}) {
  const { t } = useTranslation();
  if (!partnership) return null;
  if (partnership.brand)
    return (
      <p data-slurp-partnership="sponsor" className="mt-1 flex min-w-0 items-center gap-1.5 text-xs leading-4">
        <span className={slpTagClass()}>{t("ui.slurp.post.paidPartnership")}</span>
        <span className="min-w-0 truncate font-semibold text-[var(--slurp-muted)]">{partnership.brand}</span>
      </p>
    );
  const couple = partnership.couple === true;
  // On a couple's shared page: who of the two wrote it.
  const byId = couple && !partnership.withAccountId ? partnership.host?.id : null;
  if (!partnership.withAccountId && !byId) return null;
  const partnerId = partnership.withAccountId ?? byId!;
  const handle = partnership.withAccountId
    ? (partnership.withHandle ?? partnership.withName)
    : (partnership.host?.handle ?? partnership.host?.name);
  return (
    <p
      data-slurp-partnership={couple ? "couple" : "collab"}
      className="mt-1 flex min-w-0 items-center gap-1 text-xs font-medium leading-4 text-[var(--slurp-muted)] [&_svg]:!text-current"
    >
      {couple ? (
        <SlpHeartGlyph size={12} filled color="var(--noodle-accent)" aria-hidden="true" className="shrink-0" />
      ) : (
        <Users size={12} aria-hidden="true" className="shrink-0" />
      )}
      <span className="shrink-0">
        {t(
          byId
            ? "ui.slurp.post.coupleBy"
            : partnership.announce
              ? "ui.slurp.post.collabSoon"
              : "ui.slurp.post.collabWith",
        )}
      </span>
      <button
        type="button"
        disabled={!onOpenProfile}
        onClick={() => onOpenProfile?.(partnerId)}
        className="min-w-0 truncate rounded font-semibold text-[var(--noodle-accent-foreground)] enabled:hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:cursor-default"
      >
        @{handle}
      </button>
    </p>
  );
}

/** "Went viral" / "Featured" beside the time, from the post's reach. */
export function SlpReachBadge({ badge }: { badge: "viral" | "featured" }) {
  const { t: localizeUi } = useTranslation();
  return (
    <span className="ms-1.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--noodle-accent)]/15 px-1.5 py-px text-[11px] font-bold text-[var(--noodle-accent-foreground)]">
      {badge === "viral" ? <Flame size={10} aria-hidden="true" /> : <TrendingUp size={10} aria-hidden="true" />}
      {badge === "viral"
        ? localizeUi("ui.slurp.post.viral", { defaultValue: "Went viral" })
        : localizeUi("ui.slurp.post.featured", { defaultValue: "Featured" })}
    </span>
  );
}
