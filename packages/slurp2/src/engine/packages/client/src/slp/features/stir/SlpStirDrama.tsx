import { Play, Square } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { SLP_EYEBROW_CLASS, SLP_TYPE } from "../../base/chrome/SlpChrome";
import { SlpButton, SlpChip, slpTagClass } from "../../modules/chrome/SlpButton";
import { formatRelativeTime } from "../../base/ui/slp-date-time";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import { slpDramaWords, useSlurpDrama, useSlurpDramaMutations, type SlpDramaRunView } from "./slp-drama-hooks";

/**
 * Stir › Drama (docs/DRAMA.md): the situations that stand, the dramas running with their cast and
 * story so far, and the player's hand on them: start a switched-on drama now, or end one.
 */
export function SlpStirDrama({ personaId }: { personaId: string }) {
  const { t, i18n } = useTranslation();
  const { data, isError } = useSlurpDrama();
  const actions = useSlurpDramaMutations(personaId);
  if (isError)
    return <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>{t("ui.slurp.drama.loadFailed")}</p>;
  if (!data) return <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>{t("ui.slurp.settings.loading")}</p>;
  const nameOf = (id: string) => data.catalog.find((entry) => entry.id === id)?.name ?? slpDramaWords(id);
  const when = (at: string) => formatRelativeTime(at, i18n.language);
  const enabled = new Set(data.settings.enabled);
  const running = data.runs.filter((run) => !run.endedAt);
  const past = data.runs.filter((run) => run.endedAt).slice(0, 4);
  const standing = data.situations.filter((run) => !run.endedAt);
  const startable = data.catalog.filter(
    (entry) => entry.kind === "drama" && enabled.has(entry.id) && !running.some((run) => run.dramaId === entry.id),
  );
  const onError = (error: unknown) => toast.error(errorMessage(error));
  const people = (cast: SlpDramaRunView["cast"]) =>
    Object.values(cast)
      .map((entry) => entry.name)
      .filter(Boolean)
      .join(", ");
  const line = (entry: SlpDramaRunView["log"][number]) =>
    t(`ui.slurp.drama.log.${entry.code}`, {
      defaultValue: slpDramaWords(entry.code),
      detail:
        entry.code === "stage" || entry.code === "skipped" ? slpDramaWords(entry.detail ?? "") : (entry.detail ?? ""),
    });

  if (!enabled.size && !data.runs.length)
    return <p className={cn(SLP_TYPE.body, "text-[var(--slurp-muted)]")}>{t("ui.slurp.drama.off")}</p>;

  const Run = ({ run }: { run: SlpDramaRunView }) => (
    <li className="flex flex-col gap-2 py-3" data-slurp-drama-run={run.dramaId}>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <span className="min-w-0">
          <span className={cn(SLP_TYPE.body, "block font-semibold [overflow-wrap:anywhere]")}>
            {nameOf(run.dramaId)}
          </span>
          <span className={cn(SLP_TYPE.meta, "block text-[var(--slurp-muted)] [overflow-wrap:anywhere]")}>
            {people(run.cast)}
          </span>
        </span>
        <span className={slpTagClass(!run.endedAt)}>
          {run.endedAt ? t(`ui.slurp.drama.ending.${run.ending ?? "done"}`) : slpDramaWords(run.stage)}
        </span>
      </div>
      <ol className="space-y-0.5 border-s border-[var(--noodle-divider)] ps-3">
        {run.log.slice(-4).map((entry, index) => (
          <li key={index} className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>
            <span className="text-[var(--slurp-text)]">{line(entry)}</span> · {when(entry.at)}
          </li>
        ))}
      </ol>
      {!run.endedAt && (
        <SlpButton
          variant="quiet"
          disabled={actions.end.isPending}
          onClick={() => actions.end.mutate(run.id, { onError })}
          className="min-h-11 self-start"
        >
          <Square size={14} aria-hidden="true" />
          {t("ui.slurp.drama.end")}
        </SlpButton>
      )}
    </li>
  );

  return (
    <div data-slurp-stir-drama className="flex flex-col gap-5">
      <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>{t("ui.slurp.drama.intro")}</p>
      {standing.length > 0 && (
        <section className="space-y-2" aria-label={t("ui.slurp.drama.standing")}>
          <h4 className={cn(SLP_EYEBROW_CLASS, "px-1")}>{t("ui.slurp.drama.standing")}</h4>
          <ul className="divide-y divide-[var(--noodle-divider)]">
            {standing.map((run) => (
              <li key={run.id} className="py-3">
                <span className={cn(SLP_TYPE.body, "block font-semibold")}>{nameOf(run.situationId)}</span>
                <span className={cn(SLP_TYPE.meta, "block text-[var(--slurp-muted)]")}>
                  {people(run.cast)} · {t("ui.slurp.drama.since", { when: when(run.startedAt) })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="space-y-2" aria-label={t("ui.slurp.drama.running")}>
        <h4 className={cn(SLP_EYEBROW_CLASS, "px-1")}>{t("ui.slurp.drama.running")}</h4>
        {running.length ? (
          <ul className="divide-y divide-[var(--noodle-divider)]">
            {running.map((run) => (
              <Run key={run.id} run={run} />
            ))}
          </ul>
        ) : (
          <p className={cn(SLP_TYPE.meta, "px-1 text-[var(--slurp-muted)]")}>{t("ui.slurp.drama.none")}</p>
        )}
      </section>
      {startable.length > 0 && (
        <section className="space-y-2" aria-label={t("ui.slurp.drama.startTitle")}>
          <h4 className={cn(SLP_EYEBROW_CLASS, "px-1")}>{t("ui.slurp.drama.startTitle")}</h4>
          <div className="flex flex-wrap gap-2">
            {startable.map((entry) => (
              <SlpChip
                key={entry.id}
                disabled={actions.start.isPending}
                onClick={() =>
                  actions.start.mutate(entry.id, {
                    onSuccess: () => toast.success(t("ui.slurp.drama.started", { name: entry.name })),
                    onError,
                  })
                }
              >
                <Play size={14} aria-hidden="true" />
                {entry.name}
              </SlpChip>
            ))}
          </div>
        </section>
      )}
      {past.length > 0 && (
        <section className="space-y-2" aria-label={t("ui.slurp.drama.past")}>
          <h4 className={cn(SLP_EYEBROW_CLASS, "px-1")}>{t("ui.slurp.drama.past")}</h4>
          <ul className="divide-y divide-[var(--noodle-divider)]">
            {past.map((run) => (
              <Run key={run.id} run={run} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
