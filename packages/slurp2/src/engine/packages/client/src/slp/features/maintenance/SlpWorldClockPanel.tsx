import { FastForward, History, Loader2, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { slurpWorldNowMs } from "../../../../../shared/src/slp/slp-world-clock.js";
import { showConfirmDialog } from "../../../lib/app-dialogs";
import { formatFullTime, slpDayKey } from "../../base/ui/slp-date-time";
import { AdvancedGroup, Field, NumberSetting } from "../../modules/settings/SlpSettingsControls";
import { BackstagePageHeader } from "../../modules/settings/SlpSettingsKit";
import { errorMessage, formatBytes } from "../../modules/settings/slp-backstage-format";
import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";
import type { SlurpBackupJob } from "./slp-backup";
import { MaintenanceTask, focusRing, quietButton } from "./SlpMaintenanceTask";
import {
  type SlpCheckpoint,
  useCreateSlpCheckpoint,
  useDeleteSlpCheckpoint,
  useRestoreSlpCheckpoint,
  useSetSlpAutoCheckpointKeep,
  useSkipSlpWorldDays,
  useSlpWorldClock,
} from "./slp-timeline";

/**
 * A failed timeline job is a plain Error carrying the server's reason. `errorMessage` only reads API errors
 * (it returns nothing usable for a plain Error), so the reason is read here first.
 */
const failText = (cause: unknown): string =>
  cause instanceof Error && cause.message && typeof (cause as { status?: unknown }).status !== "number"
    ? cause.message
    : errorMessage(cause);

const DAY = 24 * 60 * 60_000;
const dayStart = (key: string) => new Date(`${key}T00:00`).getTime();
const inputClass = `h-11 min-w-0 flex-1 rounded-lg bg-[var(--slurp-canvas)] px-3 text-base ring-1 ring-inset ring-[var(--slurp-outline)] sm:text-sm ${focusRing}`;

/** The world date: skip forward by whole days, or go back by restoring a checkpoint. */
export function SlpWorldClockPanel(page: SlpBackstagePageProps) {
  const { t, i18n, setDraftPatch } = page;
  const clock = useSlpWorldClock();
  const skip = useSkipSlpWorldDays();
  const create = useCreateSlpCheckpoint();
  const restore = useRestoreSlpCheckpoint();
  const remove = useDeleteSlpCheckpoint();
  const setKeep = useSetSlpAutoCheckpointKeep();
  const [job, setJob] = useState<SlurpBackupJob | null>(null);
  const [error, setError] = useState("");
  const [skipTo, setSkipTo] = useState("");
  const [label, setLabel] = useState("");
  const busy = skip.isPending || create.isPending || restore.isPending || remove.isPending;

  if (!clock.data) {
    return (
      <p role="status" className="text-sm text-[var(--slurp-muted)]">
        {clock.isError ? errorMessage(clock.error) : t("ui.slurp.worldClock.loading")}
      </p>
    );
  }

  const { worldNow, maxSkipDays, autoCheckpointKeep, autoCheckpointKeepMax, checkpoints } = clock.data;
  const locale = i18n.language;
  const worldMs = Date.parse(worldNow);
  const today = slpDayKey(worldNow);
  const minDay = slpDayKey(worldMs + DAY);
  const maxDay = slpDayKey(worldMs + maxSkipDays * DAY);
  const target = skipTo || minDay;
  const days = Math.round((dayStart(target) - dayStart(today)) / DAY);
  const daysValid = Number.isInteger(days) && days >= 1 && days <= maxSkipDays;
  const landing = daysValid ? formatFullTime(new Date(worldMs + days * DAY).toISOString(), locale) : "";

  const run = async (work: (onProgress: (job: SlurpBackupJob) => void) => Promise<unknown>, success: string) => {
    setError("");
    setJob(null);
    try {
      await work(setJob);
      toast.success(success);
      return true;
    } catch (cause) {
      setError(failText(cause));
      return false;
    } finally {
      setJob(null);
    }
  };

  const runSkip = async () => {
    // The page's snapshot can be minutes old: work out the day count again from the live world time.
    const liveMs = slurpWorldNowMs();
    const liveDays = Math.round((dayStart(target) - dayStart(slpDayKey(liveMs))) / DAY);
    if (!(liveDays >= 1 && liveDays <= maxSkipDays)) return;
    const liveLanding = formatFullTime(new Date(liveMs + liveDays * DAY).toISOString(), locale);
    const confirmed = await showConfirmDialog({
      title: t("ui.slurp.worldClock.skipConfirmTitle", { date: liveLanding }),
      message: t("ui.slurp.worldClock.skipConfirm"),
      confirmLabel: t("ui.slurp.worldClock.skipButton"),
    });
    if (!confirmed) return;
    if (await run((onProgress) => skip.mutateAsync({ days: liveDays, onProgress }), t("ui.slurp.worldClock.skipDone")))
      setSkipTo("");
  };

  const runRestore = async (checkpoint: SlpCheckpoint) => {
    const confirmed = await showConfirmDialog({
      title: t("ui.slurp.worldClock.restoreConfirmTitle"),
      message: t("ui.slurp.worldClock.restoreConfirm", { date: formatFullTime(checkpoint.worldDate, locale) }),
      confirmLabel: t("ui.slurp.worldClock.restore"),
    });
    if (!confirmed) return;
    await run(async (onProgress) => {
      await restore.mutateAsync({ id: checkpoint.id, onProgress });
      // The restore can replace settings, so staged edits are stale.
      setDraftPatch({});
    }, t("ui.slurp.worldClock.restoreDone"));
  };

  const runDelete = async (checkpoint: SlpCheckpoint) => {
    const confirmed = await showConfirmDialog({
      title: t("ui.slurp.worldClock.deleteConfirmTitle"),
      message: t("ui.slurp.worldClock.deleteConfirm", { date: formatFullTime(checkpoint.worldDate, locale) }),
      confirmLabel: t("ui.slurp.worldClock.delete"),
    });
    if (!confirmed) return;
    setError("");
    remove.mutate(checkpoint.id, { onError: (cause) => setError(failText(cause)) });
  };

  return (
    <div className="space-y-5">
      <BackstagePageHeader detail={t("ui.slurp.worldClock.detail")} />

      <section className="rounded-xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset ring-[var(--slurp-outline)] sm:p-5">
        <p className="text-xs font-semibold text-[var(--slurp-muted)]">{t("ui.slurp.worldClock.worldDate")}</p>
        <p className="mt-1 text-2xl font-black tabular-nums">{formatFullTime(worldNow, locale)}</p>
      </section>

      {(job || busy) && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-lg bg-[var(--slurp-canvas)] px-3 py-2 text-xs leading-5 text-[var(--slurp-muted)] ring-1 ring-inset ring-[var(--slurp-outline)]"
        >
          <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          <span>{job?.detail || t("ui.slurp.worldClock.working")}</span>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-[var(--slurp-danger)]">
          {error}
        </p>
      )}

      <MaintenanceTask
        title={t("ui.slurp.worldClock.skipTitle")}
        detail={t("ui.slurp.worldClock.skipDetail")}
        preview={daysValid ? t("ui.slurp.worldClock.skipPreview", { date: landing }) : undefined}
      >
        <label className="flex w-full flex-col gap-1 text-xs font-semibold sm:w-auto">
          {t("ui.slurp.worldClock.skipTo")}
          <input
            type="date"
            className={inputClass}
            style={{ minHeight: 44 }}
            value={target}
            min={minDay}
            max={maxDay}
            disabled={busy}
            onChange={(event) => setSkipTo(event.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={busy || !daysValid}
          onClick={() => void runSkip()}
          className={`${quietButton} self-end`}
        >
          <FastForward size={14} aria-hidden="true" />
          {t("ui.slurp.worldClock.skipButton")}
        </button>
      </MaintenanceTask>

      <MaintenanceTask title={t("ui.slurp.worldClock.saveTitle")} detail={t("ui.slurp.worldClock.saveDetail")}>
        <input
          type="text"
          className={inputClass}
          style={{ minHeight: 44 }}
          value={label}
          maxLength={80}
          disabled={busy}
          placeholder={t("ui.slurp.worldClock.labelPlaceholder")}
          aria-label={t("ui.slurp.worldClock.label")}
          onChange={(event) => setLabel(event.target.value)}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void run(
              (onProgress) => create.mutateAsync({ label: label.trim() || undefined, onProgress }),
              t("ui.slurp.worldClock.saveDone"),
            ).then((done) => done && setLabel(""))
          }
          className={quietButton}
        >
          <Save size={14} aria-hidden="true" />
          {t("ui.slurp.worldClock.saveButton")}
        </button>
      </MaintenanceTask>

      {checkpoints.length > 0 && (
        <section aria-labelledby="slp-world-checkpoints" className="space-y-2">
          <h3 id="slp-world-checkpoints" className="text-sm font-bold">
            {t("ui.slurp.worldClock.checkpoints")}
          </h3>
          <p className="text-xs leading-5 text-[var(--slurp-muted)]">{t("ui.slurp.worldClock.restoreDetail")}</p>
          <ul className="space-y-2">
            {checkpoints.map((checkpoint) => (
              <li
                key={checkpoint.id}
                className="flex flex-wrap items-center gap-3 rounded-xl bg-[var(--slurp-surface-raised)] p-3 ring-1 ring-inset ring-[var(--slurp-outline)]"
              >
                <div className="min-w-0 flex-1 basis-56">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[var(--slurp-canvas)] px-2 text-xs font-semibold text-[var(--slurp-muted)]">
                      {t(`ui.slurp.worldClock.kind.${checkpoint.kind}`)}
                    </span>
                    <span className="text-sm font-bold tabular-nums">
                      {formatFullTime(checkpoint.worldDate, locale)}
                    </span>
                  </p>
                  <p className="mt-1 break-words text-xs text-[var(--slurp-muted)]">
                    {[
                      checkpoint.label,
                      t("ui.slurp.worldClock.counts", { creators: checkpoint.creators, posts: checkpoint.posts }),
                      formatBytes(checkpoint.bytes),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runRestore(checkpoint)}
                    className={quietButton}
                  >
                    <History size={14} aria-hidden="true" />
                    {t("ui.slurp.worldClock.restore")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runDelete(checkpoint)}
                    aria-label={t("ui.slurp.worldClock.deleteLabel", {
                      date: formatFullTime(checkpoint.worldDate, locale),
                    })}
                    className={`${quietButton} min-w-11 justify-center text-[var(--slurp-danger)]`}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <AdvancedGroup title={t("ui.slurp.settings.advanced.group")} count={1}>
        <Field label={t("ui.slurp.worldClock.keep")} detail={t("ui.slurp.worldClock.keepDetail")}>
          <NumberSetting
            value={autoCheckpointKeep}
            min={1}
            max={autoCheckpointKeepMax}
            stepper
            disabled={busy || setKeep.isPending}
            label={t("ui.slurp.worldClock.keep")}
            onSave={async (value) => {
              try {
                await setKeep.mutateAsync(value);
                setError("");
                return true;
              } catch (cause) {
                setError(failText(cause));
                return false;
              }
            }}
          />
        </Field>
      </AdvancedGroup>
    </div>
  );
}
