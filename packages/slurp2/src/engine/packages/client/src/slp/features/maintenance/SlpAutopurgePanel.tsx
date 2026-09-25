import { Loader2, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { ChoiceSetting } from "../../modules/settings/SlpSettingsInputs";

import { nextSlurpAutopurgeRunAt } from "../../../../../shared/src/slp/slp-autopurge-time.js";
import { Field, GuidanceBox, NumberSetting, SettingsGroup, Toggle } from "../../modules/settings/SlpSettingsControls";

import { BackstagePageHeader, SettingAnchor } from "../../modules/settings/SlpSettingsKit";

import type { SlurpSettings } from "../settings/slp-settings-contract";

import { SlpBackupPanel } from "./SlpBackupPanel";
import { SlurpMaintenanceHealth } from "./SlpMaintenanceHealth";
import { MaintenanceTask, focusRing, quietButton } from "./SlpMaintenanceTask";
import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";
import { formatBytes, localDateTimeValue } from "../../modules/settings/slp-backstage-format";

const RETENTION_PRESETS = [
  { value: 1, unit: "weeks" },
  { value: 2, unit: "weeks" },
  { value: 4, unit: "weeks" },
  { value: 3, unit: "months" },
] as const;

/** Storage and cleanup: retention, what is removed and when the next run happens. */
export function SlpAutopurgePanel(page: SlpBackstagePageProps) {
  const {
    t,
    updateSettings,
    runAutopurge,
    section,
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
  const retentionValue = `${settings.autopurgeRetentionValue}:${settings.autopurgeRetentionUnit}`;
  // Decided once from the stored window, then only by clicks, so "−" in "Own" cannot close it.
  const [retentionOwn, setRetentionOwn] = useState(
    () => !RETENTION_PRESETS.some((preset) => `${preset.value}:${preset.unit}` === retentionValue),
  );
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
        <BackstagePageHeader detail={t("ui.slurp.settings.autopurge.detail")} />
        <GuidanceBox
          title={t("ui.slurp.settings.autopurge.localOnly")}
          detail={t("ui.slurp.settings.autopurge.localOnlyDetail")}
        />

        <SettingsGroup title={t("ui.slurp.settings.autopurge.retentionGroup")}>
          {/* Four common windows as one choice; "Own" opens the exact number and unit. */}
          <SettingAnchor settingKey="autopurgeRetentionValue">
            <SettingAnchor settingKey="autopurgeRetentionUnit">
              <ChoiceSetting
                label={t("ui.slurp.settings.autopurge.olderThan")}
                detail={t("ui.slurp.settings.autopurge.olderThanDetail")}
                disabled={updateSettings.isPending}
                options={[
                  ...RETENTION_PRESETS.map((preset) => ({
                    value: `${preset.value}:${preset.unit}`,
                    label: t(`ui.slurp.settings.autopurge.preset.${preset.value}${preset.unit}`),
                  })),
                  { value: "own", label: t("ui.slurp.settings.autopurge.preset.own") },
                ]}
                value={retentionOwn ? "own" : retentionValue}
                onChange={(value) => {
                  if (value === "own") return setRetentionOwn(true);
                  setRetentionOwn(false);
                  const [amount, unit] = value.split(":");
                  void saveRetention({
                    autopurgeRetentionValue: Number(amount),
                    autopurgeRetentionUnit: unit as SlurpSettings["autopurgeRetentionUnit"],
                  });
                }}
              />
            </SettingAnchor>
          </SettingAnchor>
          {retentionOwn && (
            <div className="flex flex-wrap items-center gap-2">
              <NumberSetting
                stepper
                label={t("ui.slurp.settings.autopurge.olderThan")}
                value={settings.autopurgeRetentionValue}
                min={1}
                max={365}
                onSave={(value) => saveRetention({ autopurgeRetentionValue: value })}
              />
              <span>
                <select
                  aria-label={t("ui.slurp.settings.autopurge.unit")}
                  value={settings.autopurgeRetentionUnit}
                  disabled={updateSettings.isPending}
                  onChange={(event) =>
                    void saveRetention({
                      autopurgeRetentionUnit: event.target.value as SlurpSettings["autopurgeRetentionUnit"],
                    })
                  }
                  className={`h-11 min-w-32 rounded-lg bg-[var(--slurp-canvas)] px-3 text-base ring-1 ring-inset ring-[var(--slurp-outline)] disabled:opacity-50 sm:text-sm ${focusRing}`}
                >
                  {(["days", "weeks", "months"] as const).map((unit) => (
                    <option key={unit} value={unit}>
                      {t(`ui.slurp.settings.autopurge.units.${unit}`)}
                    </option>
                  ))}
                </select>
              </span>
            </div>
          )}
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
      {/* Backup and the delete actions share the page: Maintenance is one place, health shown once. */}
      <div className="mt-8">
        <SlpBackupPanel {...page} />
      </div>
    </>
  );
}
