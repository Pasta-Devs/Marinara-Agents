import { Download, RefreshCw, Upload } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { slurpFanTypesSchema, type SlurpFanType } from "../../../../../shared/src/slp/slp-fan-types.js";
import {
  resolveSlurpModelBudget,
  setSlurpModelBudgetLimit,
  SLURP_MODEL_BUDGET_SIZING,
  SLURP_WORLD_JOB_KINDS,
  slurpModelBudgetOutlook,
  slurpModelBudgetSchema,
  type SlurpModelBudget,
  type SlurpModelBudgetLedger,
  type SlurpModelBudgetLimit,
} from "../../../../../shared/src/slp/slp-model-budget.js";
import { slurpSimulationTuningSchema, type SlurpSimulationTuning } from "../../../../../shared/src/slp/slp-tuning.js";
import { api } from "../../../lib/api-client";
import { SlpSegment } from "../../modules/chrome/SlpButton";
import {
  AdvancedGroup,
  Field,
  NumberSetting,
  RangeSetting,
  SectionTitle,
  SettingsGroup,
  Toggle,
} from "../../modules/settings/SlpSettingsControls";

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

type SlurpModelBudgetUsage = SlurpModelBudgetLedger & {
  activeCreators?: number;
  /** Fan messages and requests still written from the built-in lines, waiting for a rewrite. */
  pendingRewrites?: number;
  /** A "Rewrite all now" run is still going. */
  rewritingAll?: boolean;
};

/** Today's usage and the active Creator count that sizes every limit the player did not set (task F). */
export function useSlurpModelBudgetUsage() {
  return useQuery({
    queryKey: ["slurp", "model-budget", "usage"],
    queryFn: () => api.get<SlurpModelBudgetUsage>("/slurp2/model-budget/usage"),
    staleTime: 30_000,
    // Follow a "Rewrite all now" run until it ends, so the count goes down while the player watches.
    refetchInterval: (query) => (query.state.data?.rewritingAll ? 3000 : false),
  });
}

/** The saved budget sized for today's Creators; the saved one until the count is known. */
export function useSlurpEffectiveModelBudget(budget: SlurpModelBudget): SlurpModelBudget {
  const creators = useSlurpModelBudgetUsage().data?.activeCreators;
  return creators === undefined ? budget : resolveSlurpModelBudget(budget, creators);
}

function BudgetStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-[var(--slurp-surface-raised,var(--background))] px-3 py-2 ring-1 ring-inset ring-[var(--slurp-outline,var(--border))]">
      <div className="text-lg font-bold tabular-nums leading-6">{value.toLocaleString()}</div>
      <div className="text-xs leading-4 text-[var(--muted-foreground)]">{label}</div>
    </div>
  );
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
  postsPerDay,
  onSave,
}: {
  tuning: SlurpSimulationTuning;
  fanTypes: SlurpFanType[];
  budget: SlurpModelBudget;
  /** Posts and Stories a day ("Posts per day"): outside the budget, but part of what the day costs. */
  postsPerDay: number;
  onSave: (patch: {
    simulationTuning?: SlurpSimulationTuning;
    fanTypes?: SlurpFanType[];
    modelBudget?: SlurpModelBudget;
  }) => Promise<boolean>;
}) {
  const { t, i18n } = useTranslation();
  const uploadRef = useRef<HTMLInputElement>(null);
  const usageQuery = useSlurpModelBudgetUsage();
  const usage = usageQuery.data ?? null;
  const refreshUsage = () => void usageQuery.refetch();
  const [rewriteStarting, setRewriteStarting] = useState(false);
  const rewriteAll = async () => {
    setRewriteStarting(true);
    try {
      await api.post<{ started: boolean }>("/slurp2/model-budget/rewrite-pending", {});
    } finally {
      setRewriteStarting(false);
      refreshUsage();
    }
  };
  const rewriting = rewriteStarting || Boolean(usage?.rewritingAll);
  const [status, setStatus] = useState("");
  const creators = usage?.activeCreators ?? 0;
  // Shown sized for today's Creators; saved as the player's own budget (only limits they set carry numbers).
  const shown = useSlurpEffectiveModelBudget(budget);
  const recommended = resolveSlurpModelBudget({ ...budget, customLimits: [] }, creators);
  const outlook = slurpModelBudgetOutlook(shown, postsPerDay);
  const compact = new Intl.NumberFormat(i18n.language, { notation: "compact", maximumFractionDigits: 1 });

  const saveBudget = (next: SlurpModelBudget) => onSave({ modelBudget: slurpModelBudgetSchema.parse(next) });
  const saveLimit = (limit: SlurpModelBudgetLimit, value: number) =>
    saveBudget(setSlurpModelBudgetLimit(budget, limit, value));
  const limitDetail = (limit: SlurpModelBudgetLimit) => {
    const value =
      limit === "callsPerHour" || limit === "callsPerDay" ? recommended[limit] : recommended.jobs[limit].maxPerDay;
    if (budget.customLimits.includes(limit))
      return t("ui.slurp.settings.aiBudget.setByYou", { defaultValue: "Set by you · recommended {{value}}", value });
    const sizing =
      limit === "callsPerHour" || limit === "callsPerDay"
        ? SLURP_MODEL_BUDGET_SIZING[limit]
        : SLURP_MODEL_BUDGET_SIZING.jobs[limit];
    return sizing && sizing.perCreator > 0
      ? t("ui.slurp.settings.aiBudget.grows", { defaultValue: "Grows with your Creators" })
      : undefined;
  };
  const importConfig = async (file?: File) => {
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text()) as Record<string, unknown>;
      if (raw.version !== 1) throw new Error("Unsupported audience configuration version.");
      const parsed = {
        simulationTuning: slurpSimulationTuningSchema.parse(raw.tuning),
        fanTypes: slurpFanTypesSchema.parse(raw.fanTypes),
        modelBudget: { ...slurpModelBudgetSchema.parse(raw.budget), raisedNotice: false },
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
        detail={t("ui.slurp.settings.aiBudget.worldDetail", {
          defaultValue:
            "Only what the world writes on its own counts. What you ask for (Write, Stir plans, replies to your messages, pictures you request) is never limited.",
        })}
      />

      {/* Task F: what the budget means today, in plain words, before any raw number. */}
      <section
        aria-labelledby="slurp-ai-budget-outlook"
        aria-live="polite"
        className="space-y-3 rounded-xl bg-[color-mix(in_srgb,var(--noodle-accent)_9%,var(--slurp-surface-raised))] p-4 ring-1 ring-inset ring-[var(--noodle-accent)]/18 sm:p-5"
      >
        <h3 id="slurp-ai-budget-outlook" className="text-sm font-bold">
          {budget.mode === "off"
            ? t("ui.slurp.settings.aiBudget.outlook.off", {
                defaultValue: "The AI budget is off. Creators still post, but write nothing else on their own.",
              })
            : creators === 0
              ? t("ui.slurp.settings.aiBudget.outlook.none", {
                  defaultValue: "No Creator posts on their own yet. Each day, the base budget allows about:",
                })
              : t("ui.slurp.settings.aiBudget.outlook.title", {
                  count: creators,
                  defaultValue: "Each day, for your {{count}} Creators, about:",
                })}
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <BudgetStat
            value={outlook.posts}
            label={t("ui.slurp.settings.aiBudget.outlook.posts", { defaultValue: "posts and Stories" })}
          />
          <BudgetStat
            value={outlook.creatorMessages}
            label={t("ui.slurp.settings.aiBudget.outlook.messages", { defaultValue: "Creator messages on their own" })}
          />
          <BudgetStat
            value={outlook.threads}
            label={t("ui.slurp.settings.aiBudget.outlook.threads", { defaultValue: "comment threads" })}
          />
          <BudgetStat
            value={outlook.fanMessages}
            label={t("ui.slurp.settings.aiBudget.outlook.fans", { defaultValue: "fan DMs and requests" })}
          />
        </div>
        <p className="text-sm leading-6">
          {t("ui.slurp.settings.aiBudget.outlook.cost", {
            defaultValue:
              "At most about {{calls}} text calls and {{pictures}} pictures a day, roughly {{tokens}} tokens.",
            calls: outlook.textCalls.toLocaleString(i18n.language),
            pictures: outlook.pictures.toLocaleString(i18n.language),
            tokens: compact.format(outlook.tokens),
          })}
        </p>
        <p className="text-sm leading-6 text-[var(--muted-foreground)]">
          {t("ui.slurp.settings.aiBudget.outlook.worldHow", {
            defaultValue:
              "Each Creator you add raises the limits a little. To spend less, lower World calls per day, or turn the world off.",
          })}
        </p>
        {budget.customLimits.length > 0 && (
          <div className="space-y-3 border-t border-[var(--slurp-outline,var(--border))] pt-3 text-sm">
            <p>
              {t("ui.slurp.settings.aiBudget.custom", {
                count: budget.customLimits.length,
                defaultValue: "You set {{count}} limits yourself. They stay as they are.",
              })}
            </p>
            <button
              type="button"
              className={buttonClass}
              onClick={() => void saveBudget({ ...budget, customLimits: [] })}
            >
              {t("ui.slurp.settings.aiBudget.useRecommended", { defaultValue: "Use recommended limits" })}
            </button>
          </div>
        )}
      </section>

      {/* 0.3.6: one switch, one slider, one toggle per area. What the player asks for never counts. */}
      <SettingsGroup title={t("ui.slurp.settings.aiBudget.worldTitle", { defaultValue: "World AI" })}>
        <Field
          label={t("ui.slurp.settings.aiBudget.mode", { defaultValue: "When models may run" })}
          detail={t("ui.slurp.settings.aiBudget.worldModeDetail", {
            defaultValue:
              "Off: the world writes nothing on its own. On: Creators and fans write on their own. On + upkeep: also memory notes, reply banks and rewrites while Slurp is closed. While you are away, this runs about four times a day unless Run in the background is on.",
          })}
        >
          <SlpSegment
            label={t("ui.slurp.settings.aiBudget.mode", { defaultValue: "When models may run" })}
            value={budget.mode}
            onChange={(mode) => void saveBudget({ ...budget, mode })}
            options={[
              { value: "off", label: t("ui.slurp.settings.aiBudget.worldMode.off", { defaultValue: "Off" }) },
              { value: "present", label: t("ui.slurp.settings.aiBudget.worldMode.on", { defaultValue: "On" }) },
              {
                value: "background",
                label: t("ui.slurp.settings.aiBudget.worldMode.upkeep", { defaultValue: "On + upkeep" }),
              },
            ]}
          />
        </Field>
        <Field
          label={t("ui.slurp.settings.aiBudget.worldDaily", { defaultValue: "World calls per day" })}
          detail={limitDetail("callsPerDay")}
        >
          <RangeSetting
            label={t("ui.slurp.settings.aiBudget.worldDaily", { defaultValue: "World calls per day" })}
            value={shown.callsPerDay}
            min={0}
            max={500}
            disabled={budget.mode === "off"}
            onSave={(value) => saveLimit("callsPerDay", value)}
          />
        </Field>
        <p className="rounded-lg bg-[var(--accent)]/35 p-3 text-sm" aria-live="polite">
          {usage
            ? t("ui.slurp.settings.aiBudget.worldUsage", {
                defaultValue: "The world used {{day}} of {{cap}} calls today.",
                day: usage.callsToday,
                cap: shown.callsPerDay,
              })
            : t("ui.slurp.settings.aiBudget.usageUnavailable", { defaultValue: "Usage is unavailable." })}
          <button type="button" className="ms-2 min-h-11 underline" onClick={refreshUsage}>
            <RefreshCw className="me-1 inline" size={14} aria-hidden="true" />
            {t("ui.slurp.settings.aiBudget.refresh", { defaultValue: "Refresh" })}
          </button>
        </p>
        {usage && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[var(--accent)]/35 p-3 text-sm">
            <div className="min-w-0" aria-live="polite">
              <p className="font-semibold">
                {rewriting
                  ? t("ui.slurp.settings.aiBudget.rewriting", {
                      defaultValue: "Rewriting. Waiting now: {{count}}",
                      count: usage.pendingRewrites ?? 0,
                    })
                  : t("ui.slurp.settings.aiBudget.pendingRewrites", {
                      defaultValue: "Fan messages and requests waiting for a rewrite: {{count}}",
                      count: usage.pendingRewrites ?? 0,
                    })}
              </p>
              <p className="mt-0.5 text-xs leading-5 text-[var(--muted-foreground)]">
                {t("ui.slurp.settings.aiBudget.rewriteAllDetail", {
                  defaultValue:
                    "Until the model rewrites them, they show the built-in lines. Rewrite all now does not wait for the day's pace, but it stops at the daily limit.",
                })}
              </p>
            </div>
            <button
              type="button"
              className={buttonClass}
              disabled={rewriting || budget.mode === "off" || !usage.pendingRewrites}
              onClick={() => void rewriteAll()}
            >
              <RefreshCw
                className={rewriting ? "animate-spin motion-reduce:animate-none" : undefined}
                size={14}
                aria-hidden="true"
              />
              {t("ui.slurp.settings.aiBudget.rewriteAll", { defaultValue: "Rewrite all now" })}
            </button>
          </div>
        )}
      </SettingsGroup>

      <SettingsGroup title={t("ui.slurp.settings.aiBudget.areas", { defaultValue: "What the world may write" })}>
        {SLURP_WORLD_JOB_KINDS.map((kind) => {
          const policy = budget.jobs[kind];
          return (
            <Toggle
              key={kind}
              compact
              label={t(`ui.slurp.settings.aiBudget.job.${kind}`, { defaultValue: kind.replaceAll("_", " ") })}
              value={policy.enabled}
              onChange={(enabled) =>
                void saveBudget({ ...budget, jobs: { ...budget.jobs, [kind]: { ...policy, enabled } } })
              }
            />
          );
        })}
      </SettingsGroup>

      <AdvancedGroup
        title={t("ui.slurp.settings.aiBudget.advanced", { defaultValue: "Advanced limits" })}
        count={SLURP_WORLD_JOB_KINDS.length + 1}
      >
        <Field
          label={t("ui.slurp.settings.aiBudget.hourly", { defaultValue: "Calls per hour" })}
          detail={limitDetail("callsPerHour")}
        >
          <NumberSetting
            value={shown.callsPerHour}
            min={0}
            max={100}
            onSave={(value) => saveLimit("callsPerHour", value)}
          />
        </Field>
        {SLURP_WORLD_JOB_KINDS.map((kind) => (
          <Field
            key={kind}
            label={t("ui.slurp.settings.aiBudget.jobDailyOf", {
              defaultValue: "{{job}}: daily limit",
              job: t(`ui.slurp.settings.aiBudget.job.${kind}`, { defaultValue: kind.replaceAll("_", " ") }),
            })}
            detail={limitDetail(kind)}
          >
            <NumberSetting
              value={shown.jobs[kind].maxPerDay}
              min={0}
              max={500}
              onSave={(value) => saveLimit(kind, value)}
            />
          </Field>
        ))}
      </AdvancedGroup>

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
