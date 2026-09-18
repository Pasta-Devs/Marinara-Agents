import { AlertTriangle, Download, Loader2, RefreshCw, Save, Trash2, Upload } from "lucide-react";
import type { ReactNode } from "react";
import { nextSlurpAutopurgeRunAt } from "../../../../shared/src/slp/slp-autopurge-time.js";
import { Field, GuidanceBox, NumberSetting, SettingsGroup, Toggle } from "./SlurpSettingsControls";
import { toast } from "sonner";
import { BackstagePageHeader, SettingAnchor } from "./SlurpBackstageKit";
import {
  applySlurpRestoreInspection,
  discardSlurpRestoreInspection,
  downloadSlurpBackup,
  inspectSlurpRestore,
  startSlurpBackup,
} from "../../slp/features/maintenance/slp-backup";
import type { SlurpSettings } from "../../slp/features/settings/slp-settings-contract";
import { showConfirmDialog, showPromptDialog } from "../../lib/app-dialogs";
import { SlurpMaintenanceHealth } from "./SlurpMaintenanceHealth";
import type { SlurpBackstagePageProps } from "./SlurpSettings";
import { errorMessage, formatBytes, localDateTimeValue } from "./SlurpBackstageWorkflow";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]";
const quietButton = `inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-semibold ring-1 ring-inset ring-[var(--slurp-outline)] transition-[background-color,transform] hover:bg-[var(--slurp-canvas)] active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-50 ${focusRing}`;

/** One maintenance job: what it does, what it will touch, and the button that does it. */
function MaintenanceTask({
  title,
  detail,
  preview,
  children,
  danger = false,
}: {
  title: string;
  detail: string;
  preview?: ReactNode;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <section
      className={`rounded-xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset sm:p-5 ${danger ? "ring-[var(--slurp-danger)]/35" : "ring-[var(--slurp-outline)]"}`}
    >
      <h3 className={`text-sm font-bold ${danger ? "text-[var(--slurp-danger)]" : ""}`}>{title}</h3>
      <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--slurp-muted)]">{detail}</p>
      {preview && (
        <p className="mt-3 rounded-lg bg-[var(--slurp-canvas)] p-3 text-xs leading-5 ring-1 ring-inset ring-[var(--slurp-outline)]">
          {preview}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

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
    runAutopurgeNow,
  } = page;
  const unused = maintenanceSummary.data?.unused;
  const unusedCount = unused
    ? unused.preparedPosts + unused.attempts + unused.runs + unused.improvementJobs + unused.improvementProposals
    : null;
  const purge = autopurgePreview.data;

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
          <BackstagePageHeader
            title={t("ui.slurp.settings.autopurge.title")}
            detail={t("ui.slurp.settings.autopurge.detail")}
            scope="all-slurp"
          />
          <GuidanceBox
            title={t("ui.slurp.settings.autopurge.localOnly")}
            detail={t("ui.slurp.settings.autopurge.localOnlyDetail")}
          />

          <SettingsGroup title={t("ui.slurp.settings.autopurge.retentionGroup")}>
            <Field
              settingKey="autopurgeRetentionValue"
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
                <SettingAnchor settingKey="autopurgeRetentionUnit">
                  <select
                    aria-label={t("ui.slurp.settings.autopurge.unit")}
                    value={settings.autopurgeRetentionUnit}
                    disabled={updateSettings.isPending}
                    onChange={(event) =>
                      void saveRetention({
                        autopurgeRetentionUnit: event.target.value as SlurpSettings["autopurgeRetentionUnit"],
                      })
                    }
                    className={`h-11 w-full min-w-0 rounded-lg bg-[var(--slurp-canvas)] px-3 text-base ring-1 ring-inset ring-[var(--slurp-outline)] disabled:opacity-50 sm:text-sm ${focusRing}`}
                  >
                    {(["days", "weeks", "months"] as const).map((unit) => (
                      <option key={unit} value={unit}>
                        {t(`ui.slurp.settings.autopurge.units.${unit}`)}
                      </option>
                    ))}
                  </select>
                </SettingAnchor>
              </div>
            </Field>
            <Toggle
              settingKey="autopurgeKeepPosts"
              label={t("ui.slurp.settings.autopurge.keepPosts")}
              detail={t("ui.slurp.settings.autopurge.keepPostsDetail")}
              value={settings.autopurgeKeepPosts}
              onChange={(value) => void update("autopurgeKeepPosts", value)}
            />
            <Toggle
              settingKey="autopurgeIncludeMessageMedia"
              label={t("ui.slurp.settings.autopurge.includeMessageMedia")}
              detail={t("ui.slurp.settings.autopurge.includeMessageMediaDetail")}
              value={settings.autopurgeIncludeMessageMedia}
              onChange={(value) => void update("autopurgeIncludeMessageMedia", value)}
            />
          </SettingsGroup>

          <SettingsGroup title={t("ui.slurp.settings.autopurge.scheduleGroup")}>
            <Toggle
              settingKey="autopurgeEnabled"
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
                settingKey="autopurgeNextRunAt"
                label={t("ui.slurp.settings.autopurge.nextRun")}
                detail={t("ui.slurp.settings.autopurge.nextRunDetail")}
              >
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="datetime-local"
                    value={autopurgeNextDraft}
                    min={localDateTimeValue(new Date(Date.now() + 60_000).toISOString())}
                    onChange={(event) => setAutopurgeNextDraft(event.target.value)}
                    className={`min-h-11 min-w-0 flex-1 rounded-lg bg-[var(--slurp-canvas)] px-3 text-base ring-1 ring-inset ring-[var(--slurp-outline)] sm:text-sm ${focusRing}`}
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
                    className={quietButton}
                  >
                    <Save size={15} aria-hidden="true" />
                    {t("ui.slurp.settings.autopurge.saveNextRun")}
                  </button>
                </div>
              </Field>
            )}
          </SettingsGroup>

          <MaintenanceTask
            title={t("ui.slurp.settings.autopurge.runNowTitle")}
            detail={t("ui.slurp.settings.autopurge.runNowDetail")}
            preview={
              purge
                ? t("ui.slurp.settings.maintenance.purgePreview", {
                    defaultValue: "This run removes {{posts}} posts and {{files}} media files, about {{size}}.",
                    posts: purge.postsToDelete,
                    files: purge.postMediaFiles + purge.messageMediaFiles,
                    size: formatBytes(purge.estimatedReclaimableBytes),
                  })
                : undefined
            }
          >
            <button
              type="button"
              disabled={runAutopurge.isPending}
              onClick={() => void runAutopurgeNow()}
              className={`inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-4 text-sm font-bold text-[var(--noodle-accent-foreground)] hover:opacity-90 disabled:opacity-50 ${focusRing}`}
            >
              {runAutopurge.isPending ? (
                <Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <Trash2 size={15} aria-hidden="true" />
              )}
              {t("ui.slurp.settings.autopurge.runNow")}
            </button>
          </MaintenanceTask>
        </div>
      )}

      {target === "advanced" && (
        <div className="space-y-4">
          <BackstagePageHeader
            title={t("ui.slurp.settings.advanced.title")}
            detail={t("ui.slurp.settings.advanced.detail")}
            scope="all-slurp"
          />

          <MaintenanceTask
            title={t("ui.slurp.settings.advanced.backupTitle")}
            detail={t("ui.slurp.settings.advanced.backupDetail")}
          >
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
              className={quietButton}
            >
              {backupPending ? (
                <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <Download size={14} aria-hidden="true" />
              )}
              {t("ui.slurp.settings.advanced.backupButton")}
            </button>
            <button
              type="button"
              disabled={backupPending || restorePending}
              onClick={() => restoreInputRef.current?.click()}
              className={quietButton}
            >
              {restorePending ? (
                <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <Upload size={14} aria-hidden="true" />
              )}
              {t("ui.slurp.settings.advanced.restoreButton")}
            </button>
            <p className="basis-full text-xs leading-5 text-[var(--slurp-muted)]">
              {t("ui.slurp.settings.advanced.restoreDetail")}
            </p>
            <label className="flex basis-full items-start gap-2 text-xs leading-5">
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
                  <span className="block text-[var(--slurp-muted)]">
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
                className="basis-full overflow-hidden rounded-xl bg-[var(--slurp-canvas)] ring-1 ring-inset ring-[var(--noodle-accent)]/30"
                aria-labelledby="slurp-restore-preview-title"
              >
                <div className="bg-[color-mix(in_srgb,var(--noodle-accent)_10%,var(--slurp-surface-raised))] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--noodle-accent)]">
                    {t("ui.slurp.settings.maintenance.restore.eyebrow", { defaultValue: "Restore preview" })}
                  </p>
                  <h3
                    id="slurp-restore-preview-title"
                    className="mt-1 truncate text-base font-black"
                    title={restoreFileName}
                  >
                    {restoreFileName}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted)]">
                    {t("ui.slurp.settings.maintenance.restore.detail", {
                      defaultValue: "Nothing changes until you press Restore this backup.",
                    })}
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-px bg-[var(--slurp-outline)] sm:grid-cols-4">
                  {[
                    [
                      restoreInspection.creators,
                      t("ui.slurp.settings.maintenance.creators", { defaultValue: "Creators" }),
                    ],
                    [restoreInspection.posts, t("ui.slurp.settings.maintenance.posts", { defaultValue: "Posts" })],
                    [
                      restoreInspection.interactions,
                      t("ui.slurp.settings.maintenance.interactions", { defaultValue: "Interactions" }),
                    ],
                    [
                      formatBytes(restoreInspection.mediaBytes),
                      t("ui.slurp.settings.maintenance.mediaFiles", {
                        defaultValue: "{{count}} media files",
                        count: restoreInspection.mediaFiles,
                      }),
                    ],
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
                        ? t("ui.slurp.settings.maintenance.restore.settingsReplace", {
                            defaultValue: "The Slurp2 settings in the file will replace your current settings.",
                          })
                        : t("ui.slurp.settings.maintenance.restore.settingsMissing", {
                            defaultValue: "The file has no Slurp2 settings, so your current settings stay.",
                          })
                      : t("ui.slurp.settings.maintenance.restore.settingsKeep", {
                          defaultValue: "Your current settings stay.",
                        })}
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
                    className={`min-h-11 rounded-lg px-3 text-xs font-bold text-[var(--slurp-muted)] hover:bg-[var(--slurp-surface)] ${focusRing}`}
                  >
                    {t("ui.slurp.actions.cancel")}
                  </button>
                  <button
                    type="button"
                    disabled={restorePending}
                    onClick={() => {
                      const inspection = restoreInspection;
                      void showConfirmDialog({
                        title: t("ui.slurp.settings.maintenance.restore.apply", {
                          defaultValue: "Restore this backup",
                        }),
                        message: t("ui.slurp.settings.advanced.restoreConfirm"),
                        confirmLabel: t("ui.slurp.settings.maintenance.restore.apply", {
                          defaultValue: "Restore this backup",
                        }),
                      }).then((confirmed) => {
                        if (!confirmed) return;
                        setRestorePending(true);
                        return applySlurpRestoreInspection(inspection.id, restoreImportSettings)
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
                      });
                    }}
                    className={`min-h-11 rounded-lg bg-[var(--slurp-danger)] px-4 text-xs font-black text-white hover:brightness-105 disabled:opacity-50 ${focusRing}`}
                  >
                    {t("ui.slurp.settings.maintenance.restore.apply", { defaultValue: "Restore this backup" })}
                  </button>
                </div>
              </section>
            )}
            {backupJob && (
              <div
                role="status"
                aria-live="polite"
                className="basis-full rounded-lg bg-[var(--slurp-canvas)] px-3 py-2 text-xs leading-5 text-[var(--slurp-muted)] ring-1 ring-inset ring-[var(--slurp-outline)]"
              >
                <p className="font-semibold text-[var(--slurp-text)]">{backupJob.stage}</p>
                <p>{backupJob.detail}</p>
                <p className="mt-1">
                  {t("ui.slurp.settings.maintenance.backupProgress", {
                    defaultValue:
                      "{{creators}} Creators · {{posts}} posts · {{interactions}} interactions · {{done}}/{{files}} media files · {{size}}",
                    creators: backupJob.creators,
                    posts: backupJob.posts,
                    interactions: backupJob.interactions,
                    done: backupJob.mediaCompleted,
                    files: backupJob.mediaFiles,
                    size: formatBytes(backupJob.mediaBytes),
                  })}
                </p>
                {backupJob.skipped.length > 0 && (
                  <p className="mt-1">
                    {t("ui.slurp.settings.advanced.restoreSkipped", { count: backupJob.skipped.length })}
                  </p>
                )}
                {backupJob.error && <p className="mt-1 text-[var(--slurp-danger)]">{backupJob.error}</p>}
              </div>
            )}
          </MaintenanceTask>

          <MaintenanceTask
            title={t("ui.slurp.settings.advanced.deleteUnusedTitle")}
            detail={t("ui.slurp.settings.advanced.deleteUnusedDetail")}
            preview={
              unusedCount === null
                ? undefined
                : t("ui.slurp.settings.maintenance.unusedPreview", {
                    defaultValue:
                      "{{count}} items will be removed: prepared posts, attempts, finished runs, and old AI suggestions.",
                    count: unusedCount,
                  })
            }
          >
            <button
              type="button"
              disabled={deleteUnusedData.isPending || deleteAllData.isPending || unusedCount === 0}
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
              className={quietButton}
            >
              <Trash2 size={14} aria-hidden="true" />
              {t("ui.slurp.settings.advanced.deleteUnusedButton")}
            </button>
          </MaintenanceTask>

          <MaintenanceTask
            title={t("ui.slurp.settings.advanced.setupAgain")}
            detail={t("ui.slurp.settings.advanced.setupAgainDetail")}
          >
            <button type="button" onClick={onRestartOnboarding} className={quietButton}>
              <RefreshCw size={14} aria-hidden="true" />
              {t("ui.slurp.settings.advanced.restartSetup")}
            </button>
          </MaintenanceTask>

          <div className="space-y-3 border-t border-[var(--slurp-outline)] pt-5">
            <h2 className="flex items-center gap-2 text-sm font-black text-[var(--slurp-danger)]">
              <AlertTriangle size={16} aria-hidden="true" />
              {t("ui.slurp.settings.maintenance.dangerTitle", { defaultValue: "Danger zone" })}
            </h2>
            <MaintenanceTask
              danger
              title={t("ui.slurp.settings.advanced.deleteAllTitle")}
              detail={t("ui.slurp.settings.advanced.deleteAllDetail")}
            >
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
                className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-[var(--slurp-danger)] ring-1 ring-inset ring-[var(--slurp-danger)]/50 hover:bg-[var(--slurp-danger)]/10 disabled:opacity-50 ${focusRing}`}
              >
                <Trash2 size={14} aria-hidden="true" />
                {t("ui.slurp.settings.advanced.deleteAllButton")}
              </button>
            </MaintenanceTask>
          </div>
        </div>
      )}
    </>
  );
}
