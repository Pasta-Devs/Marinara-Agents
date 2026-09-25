import { useTranslation } from "react-i18next";
import { formatDateTime } from "../../base/ui/slp-date-time";
import { noteClass } from "./slp-creator-classes";
import { useSlurpCreatorSignals } from "./slp-signal-hooks";

/**
 * Everything around this Creator in the last two weeks, from every source, in one list: posts,
 * notes, DMs, promises, schedule, platform events, and what other Creators posted. Read-only, for
 * seeing what the planner can know. A private thread shows as its kind, never its words.
 */
export function SlpCreatorSignalsList({ creatorId }: { creatorId: string }) {
  const { t, i18n } = useTranslation();
  const query = useSlurpCreatorSignals(creatorId);
  const signals = query.data?.signals;
  return (
    <section className="space-y-3" aria-labelledby={`signals-${creatorId}`}>
      <h3 id={`signals-${creatorId}`} className="text-sm font-bold">
        {t("ui.slurp.signals.title")}
      </h3>
      <p className={noteClass}>{t("ui.slurp.signals.detail")}</p>
      {query.isError ? (
        <p className={noteClass}>{t("ui.slurp.signals.loadFailed")}</p>
      ) : !signals ? (
        <p className={noteClass}>{t("ui.slurp.settings.loading", { defaultValue: "Loading…" })}</p>
      ) : signals.length === 0 ? (
        <p className={noteClass}>{t("ui.slurp.signals.empty")}</p>
      ) : (
        <ol className="space-y-2">
          {signals.map((signal) => (
            <li
              key={signal.id}
              className="rounded-lg bg-[var(--slurp-canvas)] p-3 ring-1 ring-inset ring-[var(--slurp-outline)]"
            >
              <p className="text-xs leading-5 text-pretty">{signal.summary}</p>
              <p className="text-[0.7rem] leading-5 text-[var(--slurp-muted)]">
                {[
                  t(`ui.slurp.signals.source.${signal.source}`, { defaultValue: signal.source }),
                  signal.audienceScope.replace(/_/gu, " "),
                  formatDateTime(signal.at, i18n.language),
                ].join(" · ")}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
