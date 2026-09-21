import { useTranslation } from "react-i18next";
import { useSlurpContinuityOverview } from "./slp-continuity-hooks";
import { quietButton } from "./slp-creator-classes";

/** Cross-Creator review queue in Backstage; private text stays inside each Creator's editor. */
export function SlpContinuityOverview({ onOpen }: { onOpen: (creatorAccountId: string) => void }) {
  const { t } = useTranslation();
  const query = useSlurpContinuityOverview();
  const rows = query.data ?? [];
  if (query.isLoading || rows.every((row) => row.proposals.length === 0)) return null;
  return (
    <section className="space-y-3 rounded-xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset ring-[var(--slurp-outline)]">
      <div>
        <h2 className="font-bold">{t("ui.slurp.continuity.allCreators", { defaultValue: "Continuity review" })}</h2>
        <p className="text-xs text-[var(--slurp-muted)]">
          {t("ui.slurp.continuity.allCreatorsHint", { defaultValue: "Pending memories across every Creator." })}
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {rows
          .filter((row) => row.proposals.length > 0)
          .map((row) => (
            <li
              key={row.creator.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-[var(--slurp-surface)] p-3"
            >
              <span className="min-w-0">
                <strong className="block truncate text-sm">{row.creator.displayName}</strong>
                <span className="text-xs text-[var(--slurp-muted)]">
                  {t("ui.slurp.continuity.pendingCount", {
                    count: row.proposals.length,
                    defaultValue: "{{count}} pending",
                  })}
                </span>
              </span>
              <button type="button" className={quietButton} onClick={() => onOpen(row.creator.id)}>
                {t("ui.slurp.continuity.review", { defaultValue: "Review" })}
              </button>
            </li>
          ))}
      </ul>
    </section>
  );
}
