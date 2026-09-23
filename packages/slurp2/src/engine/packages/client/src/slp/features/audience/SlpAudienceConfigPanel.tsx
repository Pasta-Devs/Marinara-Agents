import { Download, RefreshCw, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { slurpFanTypesSchema, type SlurpFanType } from "../../../../../shared/src/slp/slp-fan-types.js";
import {
  SLURP_MODEL_JOB_KINDS,
  slurpModelBudgetSchema,
  type SlurpModelBudget,
  type SlurpModelBudgetLedger,
} from "../../../../../shared/src/slp/slp-model-budget.js";
import { slurpSimulationTuningSchema, type SlurpSimulationTuning } from "../../../../../shared/src/slp/slp-tuning.js";
import { api } from "../../../lib/api-client";
import { Field, NumberSetting, SectionTitle, SettingsGroup, Toggle } from "../../modules/settings/SlpSettingsControls";

type Connection = { id: string; name?: string; model?: string; provider?: string };
type PortableAudienceConfig = {
  version: 1;
  tuning: SlurpSimulationTuning;
  fanTypes: SlurpFanType[];
  budget: SlurpModelBudget;
};

const inputClass =
  "min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--slurp-canvas,var(--background))] px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]/35 sm:text-sm";
const buttonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold hover:bg-[var(--accent)]/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--noodle-accent)] disabled:opacity-50";

function downloadConfig(config: PortableAudienceConfig) {
  const href = URL.createObjectURL(new Blob([JSON.stringify(config, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = "slurp-audience-config.json";
  anchor.click();
  URL.revokeObjectURL(href);
}

function PromptTextArea({ value, onSave, label }: { value: string; onSave: (value: string) => void; label: string }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <textarea
      className={`${inputClass} min-h-28 py-3`}
      maxLength={4000}
      value={draft}
      aria-label={label}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => draft !== value && onSave(draft)}
    />
  );
}

export function SlurpAudienceConfigSettings({
  tuning,
  fanTypes,
  budget,
  connections,
  onSave,
}: {
  tuning: SlurpSimulationTuning;
  fanTypes: SlurpFanType[];
  budget: SlurpModelBudget;
  connections: Connection[];
  onSave: (patch: {
    simulationTuning?: SlurpSimulationTuning;
    fanTypes?: SlurpFanType[];
    modelBudget?: SlurpModelBudget;
  }) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [usage, setUsage] = useState<SlurpModelBudgetLedger | null>(null);
  const [status, setStatus] = useState("");

  const refreshUsage = async () => {
    try {
      setUsage(await api.get<SlurpModelBudgetLedger>("/slurp2/model-budget/usage"));
    } catch {
      setUsage(null);
    }
  };
  useEffect(() => void refreshUsage(), []);

  const saveBudget = (next: SlurpModelBudget) => onSave({ modelBudget: slurpModelBudgetSchema.parse(next) });
  const importConfig = async (file?: File) => {
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text()) as Record<string, unknown>;
      if (raw.version !== 1) throw new Error("Unsupported audience configuration version.");
      const parsed = {
        simulationTuning: slurpSimulationTuningSchema.parse(raw.tuning),
        fanTypes: slurpFanTypesSchema.parse(raw.fanTypes),
        modelBudget: slurpModelBudgetSchema.parse(raw.budget),
      };
      const saved = await onSave(parsed);
      setStatus(
        saved
          ? t("ui.slurp.settings.audienceConfig.imported", { defaultValue: "Audience configuration imported." })
          : t("ui.slurp.settings.audienceConfig.importError", { defaultValue: "Could not import that configuration." }),
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not import that configuration.");
    } finally {
      if (uploadRef.current) uploadRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        title={t("ui.slurp.settings.aiBudget.title", { defaultValue: "AI budget" })}
        detail={t("ui.slurp.settings.aiBudget.detail", {
          defaultValue: "The free simulation always runs. These limits only control model-written text.",
        })}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <SettingsGroup title={t("ui.slurp.settings.aiBudget.worker", { defaultValue: "Model worker" })}>
          <Field
            label={t("ui.slurp.settings.aiBudget.mode", { defaultValue: "When models may run" })}
            detail={t("ui.slurp.settings.aiBudget.modeDetail", {
              defaultValue: "Present runs only while Slurp is open. Background is opt-in.",
            })}
          >
            <select
              className={inputClass}
              value={budget.mode}
              onChange={(event) => void saveBudget({ ...budget, mode: event.target.value as SlurpModelBudget["mode"] })}
            >
              <option value="off">
                {t("ui.slurp.settings.aiBudget.modes.off", { defaultValue: "Off — banks only" })}
              </option>
              <option value="present">
                {t("ui.slurp.settings.aiBudget.modes.present", { defaultValue: "Replies and activity you turned on" })}
              </option>
              <option value="background">
                {t("ui.slurp.settings.aiBudget.modes.background", { defaultValue: "Also background upkeep" })}
              </option>
            </select>
          </Field>
          <Field label={t("ui.slurp.settings.aiBudget.connection", { defaultValue: "Model connection" })}>
            <select
              className={inputClass}
              value={budget.connectionId ?? ""}
              onChange={(event) => void saveBudget({ ...budget, connectionId: event.target.value || null })}
            >
              <option value="">
                {t("ui.slurp.settings.connections.engineDefault", { defaultValue: "Engine default" })}
              </option>
              {connections
                .filter((connection) => connection.provider !== "image_generation")
                .map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.name ?? connection.model ?? connection.id}
                  </option>
                ))}
            </select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("ui.slurp.settings.aiBudget.hourly", { defaultValue: "Calls per hour" })}>
              <NumberSetting
                value={budget.callsPerHour}
                min={0}
                max={100}
                onSave={(callsPerHour) => saveBudget({ ...budget, callsPerHour })}
              />
            </Field>
            <Field label={t("ui.slurp.settings.aiBudget.daily", { defaultValue: "Calls per day" })}>
              <NumberSetting
                value={budget.callsPerDay}
                min={0}
                max={500}
                onSave={(callsPerDay) => saveBudget({ ...budget, callsPerDay })}
              />
            </Field>
          </div>
          <div className="rounded-lg bg-[var(--accent)]/35 p-3 text-sm" aria-live="polite">
            {usage
              ? t("ui.slurp.settings.aiBudget.usage", {
                  defaultValue: "Used {{hour}} this hour and {{day}} today.",
                  hour: usage.callsThisHour,
                  day: usage.callsToday,
                })
              : t("ui.slurp.settings.aiBudget.usageUnavailable", { defaultValue: "Usage is unavailable." })}
            <button type="button" className="ms-2 underline" onClick={() => void refreshUsage()}>
              <RefreshCw className="me-1 inline" size={14} aria-hidden="true" />
              {t("ui.slurp.settings.aiBudget.refresh", { defaultValue: "Refresh" })}
            </button>
          </div>
        </SettingsGroup>

        <SettingsGroup title={t("ui.slurp.settings.aiBudget.jobs", { defaultValue: "Text jobs" })}>
          <div className="space-y-3">
            {SLURP_MODEL_JOB_KINDS.map((kind) => {
              const policy = budget.jobs[kind];
              return (
                <div key={kind} className="rounded-lg border border-[var(--border)] p-3">
                  <Toggle
                    compact
                    label={t(`ui.slurp.settings.aiBudget.job.${kind}`, { defaultValue: kind.replaceAll("_", " ") })}
                    value={policy.enabled}
                    onChange={(enabled) =>
                      void saveBudget({ ...budget, jobs: { ...budget.jobs, [kind]: { ...policy, enabled } } })
                    }
                  />
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label={t("ui.slurp.settings.aiBudget.priority", { defaultValue: "Priority" })}>
                      <NumberSetting
                        value={policy.priority}
                        min={1}
                        max={10}
                        onSave={(priority) =>
                          saveBudget({ ...budget, jobs: { ...budget.jobs, [kind]: { ...policy, priority } } })
                        }
                      />
                    </Field>
                    <Field label={t("ui.slurp.settings.aiBudget.jobDaily", { defaultValue: "Daily limit" })}>
                      <NumberSetting
                        value={policy.maxPerDay}
                        min={0}
                        max={500}
                        onSave={(maxPerDay) =>
                          saveBudget({ ...budget, jobs: { ...budget.jobs, [kind]: { ...policy, maxPerDay } } })
                        }
                      />
                    </Field>
                  </div>
                </div>
              );
            })}
          </div>
        </SettingsGroup>
      </div>

      <SettingsGroup title={t("ui.slurp.settings.prompts.audienceTitle", { defaultValue: "Audience prompts" })}>
        <Field
          label={t("ui.slurp.settings.prompts.fanActivityExtra", { defaultValue: "Fan activity instructions" })}
          detail={t("ui.slurp.settings.prompts.fanActivityExtraDetail", {
            defaultValue: "Added to generated comment threads.",
          })}
        >
          <PromptTextArea
            label={t("ui.slurp.settings.prompts.fanActivityExtra", { defaultValue: "Fan activity instructions" })}
            value={tuning.prompts.fanActivityExtra}
            onSave={(value) =>
              void onSave({
                simulationTuning: {
                  ...tuning,
                  preset: "custom",
                  prompts: { ...tuning.prompts, fanActivityExtra: value },
                },
              })
            }
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("ui.slurp.settings.prompts.replyMaxChars", { defaultValue: "Reply character target" })}>
            <NumberSetting
              value={tuning.prompts.replyMaxChars}
              min={20}
              max={2000}
              onSave={(replyMaxChars) =>
                onSave({
                  simulationTuning: {
                    ...tuning,
                    preset: "custom",
                    prompts: { ...tuning.prompts, replyMaxChars },
                  },
                })
              }
            />
          </Field>
        </div>
        <Field
          label={t("ui.slurp.settings.prompts.scheduleExtra", { defaultValue: "Schedule instructions" })}
          detail={t("ui.slurp.settings.prompts.scheduleExtraDetail", {
            defaultValue: "Added when creator schedules are generated.",
          })}
        >
          <PromptTextArea
            label={t("ui.slurp.settings.prompts.scheduleExtra", { defaultValue: "Schedule instructions" })}
            value={tuning.prompts.scheduleExtra}
            onSave={(value) =>
              void onSave({
                simulationTuning: {
                  ...tuning,
                  preset: "custom",
                  prompts: { ...tuning.prompts, scheduleExtra: value },
                },
              })
            }
          />
        </Field>
        <div className="grid gap-4 lg:grid-cols-3">
          {(["warm", "mixed", "unfiltered"] as const).map((tone) => (
            <Field
              key={tone}
              label={t(`ui.slurp.settings.prompts.tone.${tone}`, {
                defaultValue: `${tone[0]!.toUpperCase()}${tone.slice(1)} tone`,
              })}
            >
              <PromptTextArea
                label={tone}
                value={tuning.prompts.tones[tone]}
                onSave={(value) =>
                  void onSave({
                    simulationTuning: {
                      ...tuning,
                      preset: "custom",
                      prompts: { ...tuning.prompts, tones: { ...tuning.prompts.tones, [tone]: value } },
                    },
                  })
                }
              />
            </Field>
          ))}
        </div>
      </SettingsGroup>

      <SettingsGroup title={t("ui.slurp.settings.audienceConfig.title", { defaultValue: "Share configuration" })}>
        <p className="text-sm leading-6 text-[var(--muted-foreground)]">
          {t("ui.slurp.settings.audienceConfig.detail", {
            defaultValue: "Export tuning, fan types and AI limits as one portable JSON file.",
          })}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={buttonClass}
            onClick={() => downloadConfig({ version: 1, tuning, fanTypes, budget })}
          >
            <Download size={16} aria-hidden="true" />
            {t("ui.slurp.settings.audienceConfig.export", { defaultValue: "Export configuration" })}
          </button>
          <button type="button" className={buttonClass} onClick={() => uploadRef.current?.click()}>
            <Upload size={16} aria-hidden="true" />
            {t("ui.slurp.settings.audienceConfig.import", { defaultValue: "Import configuration" })}
          </button>
          <input
            ref={uploadRef}
            type="file"
            className="sr-only"
            accept="application/json,.json"
            aria-label={t("ui.slurp.settings.audienceConfig.import", { defaultValue: "Import configuration" })}
            onChange={(event) => void importConfig(event.target.files?.[0])}
          />
        </div>
        {status && (
          <p className="text-sm" role="status">
            {status}
          </p>
        )}
      </SettingsGroup>
    </div>
  );
}
