import { Loader2, Save, Trash2 } from "lucide-react";

import { nextSlurpAutopurgeRunAt } from "../../../../../shared/src/slp/slp-autopurge-time.js";
import { Field, GuidanceBox, NumberSetting, SettingsGroup, Toggle } from "../../modules/settings/SlpSettingsControls";

import { BackstagePageHeader, SettingAnchor } from "../../modules/settings/SlpSettingsKit";

import type { SlurpSettings } from "../settings/slp-settings-contract";

import { SlurpMaintenanceHealth } from "../../../components/slurp/SlurpMaintenanceHealth";
import { MaintenanceTask, focusRing, quietButton } from "./SlpMaintenanceTask";
import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";
import { formatBytes, localDateTimeValue } from "../../../components/slurp/SlurpBackstageWorkflow";


/** Storage and cleanup: retention, what is removed and when the next run happens. */
export function SlpAutopurgePanel(page: SlpBackstagePageProps) {
  const {
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
    autopurgeNextTime,
    runAutopurgeNow,
  } = page;
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
    </>
  );
}
