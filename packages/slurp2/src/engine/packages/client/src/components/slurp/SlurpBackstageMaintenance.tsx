import { Download, Loader2, RefreshCw, Save, Trash2, Upload } from "lucide-react";
import { nextSlurpAutopurgeRunAt } from "../../../../shared/src/slurp-autopurge-time.js";
import { Field, GuidanceBox, NumberSetting, SectionTitle, SettingsGroup, Toggle } from "./SlurpSettingsControls";
import { toast } from "sonner";
import {
  startSlurpBackup,
  inspectSlurpRestore,
  applySlurpRestoreInspection,
  discardSlurpRestoreInspection,
  downloadSlurpBackup,
  type SlurpSettings,
} from "../../hooks/use-slurp";
import { showConfirmDialog, showPromptDialog } from "../../lib/app-dialogs";
import { SlurpMaintenanceHealth } from "./SlurpMaintenanceHealth";
import type { SlurpBackstagePageProps } from "./SlurpSettings";
import { errorMessage, formatBytes, localDateTimeValue } from "./SlurpBackstageWorkflow";

/** Maintenance: health, storage cleanup, backup, and data. */
export function SlurpBackstageMaintenance(page: SlurpBackstagePageProps) {
  const {
    onRestartOnboarding,
    t,
    updateSettings,
    runAutopurge,
    section,
    target,
    settings,
    maintenanceSummary,
    autopurgePreview,
    autopurgeNextDraft,
    setAutopurgeNextDraft,
    save,
    update,
    saveRetention,
    deleteAllData,
    deleteUnusedData,
    backupJob,
    backupPending,
    setBackupPending,
    restorePending,
    setRestorePending,
    restoreImportSettings,
    setRestoreImportSettings,
    restoreInspection,
    setRestoreInspection,
    restoreFileName,
    setRestoreFileName,
    restoreInputRef,
    followBackupJob,
    autopurgeNextTime,
    creators,
    restore,
    runAutopurgeNow,
  } = page;
  return (
    <>
      {section === "maintenance" && (
        <div className="mb-5">
          <SlurpMaintenanceHealth
            summary={maintenanceSummary.data}
            loading={maintenanceSummary.isLoading}
            error={maintenanceSummary.isError}
            preview={autopurgePreview.data}
          />
        </div>
      )}

      {target === "autopurge" && (
        <div className="space-y-5">
          <SectionTitle
            title={t("ui.slurp.settings.autopurge.title")}
            detail={t("ui.slurp.settings.autopurge.detail")}
          />
          <GuidanceBox
            title={t("ui.slurp.settings.autopurge.localOnly")}
            detail={t("ui.slurp.settings.autopurge.localOnlyDetail")}
          />

          <SettingsGroup title={t("ui.slurp.settings.autopurge.retentionGroup")}>
            <Field
              label={t("ui.slurp.settings.autopurge.olderThan")}
              detail={t("ui.slurp.settings.autopurge.olderThanDetail")}
            >
              <div className="grid gap-2 sm:grid-cols-[minmax(8rem,1fr)_minmax(9rem,1fr)]">
                <NumberSetting
                  value={settings.autopurgeRetentionValue}
                  min={1}
                  max={365}
                  onSave={(value) => saveRetention({ autopurgeRetentionValue: value })}
                />
                <select
                  aria-label={t("ui.slurp.settings.autopurge.unit")}
                  value={settings.autopurgeRetentionUnit}
                  disabled={updateSettings.isPending}
                  onChange={(event) =>
                    void saveRetention({
                      autopurgeRetentionUnit: event.target.value as SlurpSettings["autopurgeRetentionUnit"],
                    })
                  }
                  className="h-11 min-w-0 rounded-lg border border-[var(--border)] bg-[var(--slurp-canvas,var(--background))] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
                >
                  {(["days", "weeks", "months"] as const).map((unit) => (
                    <option key={unit} value={unit}>
                      {t(`ui.slurp.settings.autopurge.units.${unit}`)}
                    </option>
                  ))}
                </select>
              </div>
            </Field>
            <Toggle
              label={t("ui.slurp.settings.autopurge.keepPosts")}
              detail={t("ui.slurp.settings.autopurge.keepPostsDetail")}
              value={settings.autopurgeKeepPosts}
              onChange={(value) => void update("autopurgeKeepPosts", value)}
            />
            <Toggle
              label={t("ui.slurp.settings.autopurge.includeMessageMedia")}
              detail={t("ui.slurp.settings.autopurge.includeMessageMediaDetail")}
              value={settings.autopurgeIncludeMessageMedia}
              onChange={(value) => void update("autopurgeIncludeMessageMedia", value)}
            />
          </SettingsGroup>

          <SettingsGroup title={t("ui.slurp.settings.autopurge.scheduleGroup")}>
            <Toggle
              label={t("ui.slurp.settings.autopurge.schedule")}
              detail={t("ui.slurp.settings.autopurge.scheduleDetail")}
              value={settings.autopurgeEnabled}
              onChange={(enabled) => {
                const existing = settings.autopurgeNextRunAt;
                const nextRunAt =
                  enabled && (!existing || Date.parse(existing) <= Date.now())
                    ? nextSlurpAutopurgeRunAt(settings)
                    : existing;
                void save({ autopurgeEnabled: enabled, autopurgeNextRunAt: enabled ? nextRunAt : null });
              }}
            />
            {settings.autopurgeEnabled && (
              <Field
                label={t("ui.slurp.settings.autopurge.nextRun")}
                detail={t("ui.slurp.settings.autopurge.nextRunDetail")}
              >
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="datetime-local"
                    value={autopurgeNextDraft}
                    min={localDateTimeValue(new Date(Date.now() + 60_000).toISOString())}
                    onChange={(event) => setAutopurgeNextDraft(event.target.value)}
                    className="min-h-11 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--slurp-canvas,var(--background))] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-sm"
                  />
                  <button
                    type="button"
                    disabled={
                      updateSettings.isPending ||
                      !autopurgeNextDraft ||
                      !Number.isFinite(autopurgeNextTime) ||
                      autopurgeNextTime <= Date.now()
                    }
                    onClick={() => void save({ autopurgeNextRunAt: new Date(autopurgeNextTime).toISOString() })}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--slurp-outline)] px-4 text-sm font-bold transition-[background-color,transform] hover:bg-[var(--accent)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-50"
                  >
                    <Save size={15} aria-hidden="true" />
                    {t("ui.slurp.settings.autopurge.saveNextRun")}
                  </button>
                </div>
              </Field>
            )}
          </SettingsGroup>

          <section className="flex flex-col gap-4 rounded-xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset ring-[var(--slurp-warning)]/35 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h3 className="text-sm font-bold">{t("ui.slurp.settings.autopurge.runNowTitle")}</h3>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--slurp-muted)]">
                {t("ui.slurp.settings.autopurge.runNowDetail")}
              </p>
            </div>
            <button
              type="button"
              disabled={runAutopurge.isPending}
              onClick={() => void runAutopurgeNow()}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-4 text-sm font-bold text-[var(--noodle-accent-foreground)] transition-[opacity,transform] hover:opacity-90 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-50"
            >
              {runAutopurge.isPending ? (
                <Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <Trash2 size={15} aria-hidden="true" />
              )}
              {t("ui.slurp.settings.autopurge.runNow")}
            </button>
          </section>
        </div>
      )}

      {target === "advanced" && (
        <div className="space-y-5">
          <SectionTitle title={t("ui.slurp.settings.advanced.title")} detail={t("ui.slurp.settings.advanced.detail")} />
          <div className="rounded-lg border border-[var(--border)] p-4">
            <h2 className="text-sm font-semibold">{t("ui.slurp.settings.advanced.backupTitle")}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
              {t("ui.slurp.settings.advanced.backupDetail")}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={backupPending || restorePending}
                onClick={() => {
                  setBackupPending(true);
                  void startSlurpBackup()
                    .then(async (job) => {
                      await followBackupJob(job);
                      await downloadSlurpBackup(job.id);
                      toast.success(t("ui.slurp.settings.advanced.backupSuccess"));
                    })
                    .catch((error) => toast.error(errorMessage(error)))
                    .finally(() => setBackupPending(false));
                }}
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-xs font-semibold hover:bg-[var(--accent)] disabled:opacity-50"
              >
                {backupPending ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                {t("ui.slurp.settings.advanced.backupButton")}
              </button>
              <button
                type="button"
                disabled={backupPending || restorePending}
                onClick={() => restoreInputRef.current?.click()}
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-xs font-semibold hover:bg-[var(--accent)] disabled:opacity-50"
              >
                {restorePending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {t("ui.slurp.settings.advanced.restoreButton")}
              </button>
            </div>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-[var(--muted-foreground)]">
              {t("ui.slurp.settings.advanced.restoreDetail")}
            </p>
            <label className="mt-2 flex max-w-2xl items-start gap-2 text-xs leading-5">
              <input
                type="checkbox"
                className="mt-1"
                checked={restoreImportSettings}
                disabled={restorePending}
                onChange={(event) => setRestoreImportSettings(event.target.checked)}
              />
              <span>
                <span className="font-semibold">{t("ui.slurp.settings.advanced.restoreImportSettings")}</span>
                {restoreImportSettings && (
                  <span className="block text-[var(--muted-foreground)]">
                    {t("ui.slurp.settings.advanced.restoreImportSettingsWarning")}
                  </span>
                )}
              </span>
            </label>
            <input
              ref={restoreInputRef}
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                setRestorePending(true);
                void Promise.resolve(restoreInspection?.id)
                  .then(async (previousId) => {
                    if (previousId) await discardSlurpRestoreInspection(previousId);
                    return inspectSlurpRestore(file);
                  })
                  .then((inspection) => {
                    setRestoreFileName(file.name);
                    setRestoreInspection(inspection);
                  })
                  .catch((error) => toast.error(errorMessage(error)))
                  .finally(() => setRestorePending(false));
              }}
            />
            {restoreInspection && (
              <section
                className="mt-4 overflow-hidden rounded-xl bg-[var(--slurp-canvas)] ring-1 ring-inset ring-[var(--noodle-accent)]/30"
                aria-labelledby="slurp-restore-preview-title"
              >
                <div className="bg-[color-mix(in_srgb,var(--noodle-accent)_10%,var(--slurp-surface-raised))] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.13em] text-[var(--noodle-accent)]">
                    Restore preview
                  </p>
                  <h3
                    id="slurp-restore-preview-title"
                    className="mt-1 truncate text-base font-black"
                    title={restoreFileName}
                  >
                    {restoreFileName}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted)]">
                    This replaces current Slurp content only after you press Restore this backup.
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-px bg-[var(--slurp-outline)] sm:grid-cols-4">
                  {[
                    [restoreInspection.creators, "Creators"],
                    [restoreInspection.posts, "Posts"],
                    [restoreInspection.interactions, "Interactions"],
                    [formatBytes(restoreInspection.mediaBytes), `${restoreInspection.mediaFiles} media files`],
                  ].map(([value, label]) => (
                    <div key={String(label)} className="bg-[var(--slurp-surface-raised)] p-3">
                      <dt className="text-xs text-[var(--slurp-muted)]">{String(label)}</dt>
                      <dd className="mt-1 text-base font-black tabular-nums">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex flex-wrap items-center gap-3 p-4">
                  <p className="me-auto text-xs leading-5 text-[var(--slurp-muted)]">
                    {restoreImportSettings
                      ? restoreInspection.hasSlurp2Settings
                        ? "The archive’s Slurp2 settings will replace the current settings."
                        : "No Slurp2 settings were found, so current settings will stay unchanged."
                      : "Current settings will stay unchanged."}
                  </p>
                  <button
                    type="button"
                    disabled={restorePending}
                    onClick={() => {
                      const inspection = restoreInspection;
                      setRestoreInspection(null);
                      setRestoreFileName("");
                      void discardSlurpRestoreInspection(inspection.id);
                    }}
                    className="min-h-11 rounded-lg px-3 text-xs font-bold text-[var(--slurp-muted)] hover:bg-[var(--slurp-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={restorePending}
                    onClick={() => {
                      if (!window.confirm(t("ui.slurp.settings.advanced.restoreConfirm"))) return;
                      setRestorePending(true);
                      void applySlurpRestoreInspection(restoreInspection.id, restoreImportSettings)
                        .then(async (job) => {
                          setRestoreInspection(null);
                          setRestoreFileName("");
                          const done = await followBackupJob(job);
                          toast.success(
                            t("ui.slurp.settings.advanced.restoreSuccess", {
                              creators: done.creators,
                              posts: done.posts,
                            }),
                          );
                        })
                        .catch((error) => toast.error(errorMessage(error)))
                        .finally(() => setRestorePending(false));
                    }}
                    className="min-h-11 rounded-lg bg-[var(--slurp-danger)] px-4 text-xs font-black text-white hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50"
                  >
                    Restore this backup
                  </button>
                </div>
              </section>
            )}
            {backupJob && (
              <div
                role="status"
                aria-live="polite"
                className="mt-3 rounded-md bg-[var(--accent)] px-3 py-2 text-xs leading-5 text-[var(--muted-foreground)]"
              >
                <p className="font-semibold">{backupJob.stage}</p>
                <p>{backupJob.detail}</p>
                <p className="mt-1">
                  {backupJob.creators} creators · {backupJob.posts} posts · {backupJob.interactions} interactions ·{" "}
                  {backupJob.mediaCompleted}/{backupJob.mediaFiles} media files · {backupJob.mediaBytes} bytes
                </p>
                {backupJob.skipped.length > 0 && (
                  <p className="mt-1">
                    {t("ui.slurp.settings.advanced.restoreSkipped", { count: backupJob.skipped.length })}
                  </p>
                )}
                {backupJob.error && <p className="mt-1 text-red-300">{backupJob.error}</p>}
              </div>
            )}
          </div>
          <div className="rounded-lg border border-[var(--border)] p-4">
            <h2 className="text-sm font-semibold">{t("ui.slurp.settings.advanced.setupAgain")}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
              {t("ui.slurp.settings.advanced.setupAgainDetail")}
            </p>
            <button
              type="button"
              onClick={onRestartOnboarding}
              className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold hover:bg-[var(--accent)]"
            >
              <RefreshCw size={14} />
              {t("ui.slurp.settings.advanced.restartSetup")}
            </button>
          </div>
          <div className="rounded-lg border border-red-400/30 p-4">
            <h2 className="text-sm font-semibold">{t("ui.slurp.settings.advanced.deleteAllTitle")}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
              {t("ui.slurp.settings.advanced.deleteAllDetail")}
            </p>
            <button
              type="button"
              disabled={deleteAllData.isPending}
              onClick={() =>
                // Nothing here can be undone, so a stray click on a default button is not enough.
                void showPromptDialog({
                  title: t("ui.slurp.settings.advanced.deleteAllConfirmTitle"),
                  message: `${t("ui.slurp.settings.advanced.deleteAllConfirmDetail")}\n\n${t("ui.slurp.settings.advanced.deleteAllTypeToConfirm")}`,
                  placeholder: "DELETE",
                  confirmLabel: t("ui.slurp.settings.advanced.deleteAllButton"),
                })
                  .then((typed) => {
                    if (typed?.trim() !== "DELETE") return;
                    deleteAllData.mutate(undefined, {
                      onSuccess: () => toast.success(t("ui.slurp.settings.advanced.deleteAllSuccess")),
                      onError: (error) => toast.error(errorMessage(error)),
                    });
                  })
                  .catch((error) => toast.error(errorMessage(error)))
              }
              className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-400/50 px-3 text-xs font-semibold text-red-300 hover:bg-red-400/10 disabled:opacity-50"
            >
              <Trash2 size={14} />
              {t("ui.slurp.settings.advanced.deleteAllButton")}
            </button>
          </div>
          <div className="rounded-lg border border-[var(--border)] p-4">
            <h2 className="text-sm font-semibold">{t("ui.slurp.settings.advanced.deleteUnusedTitle")}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
              {t("ui.slurp.settings.advanced.deleteUnusedDetail")}
            </p>
            <button
              type="button"
              disabled={deleteUnusedData.isPending || deleteAllData.isPending}
              onClick={() =>
                void showConfirmDialog({
                  title: t("ui.slurp.settings.advanced.deleteUnusedConfirmTitle"),
                  message: t("ui.slurp.settings.advanced.deleteUnusedConfirmDetail"),
                  confirmLabel: t("ui.slurp.settings.advanced.deleteUnusedButton"),
                })
                  .then((confirmed) => {
                    if (!confirmed) return;
                    deleteUnusedData.mutate(undefined, {
                      onSuccess: () => toast.success(t("ui.slurp.settings.advanced.deleteUnusedSuccess")),
                      onError: (error) => toast.error(errorMessage(error)),
                    });
                  })
                  .catch((error) => toast.error(errorMessage(error)))
              }
              className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold hover:bg-[var(--accent)] disabled:opacity-50"
            >
              <Trash2 size={14} />
              {t("ui.slurp.settings.advanced.deleteUnusedButton")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
