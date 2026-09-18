/**
 * Settings → Audience → Simulation.
 *
 * Every number the audience simulation runs on, plus what a week of them would produce. Its own
 * file because `SlurpSettings.tsx` is already about five thousand lines; that file only mounts it.
 *
 * The panel never invents a bound. Minimums, maximums and whether a field is a whole number are
 * read off `slurpSimulationTuningSchema`, so a range changed on the server changes the input here
 * with no second list to keep in step. Editing any value stores the whole tuning object — the
 * server fills anything missing from Realistic — and moves the preset to `custom`.
 */
import { RotateCcw } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  SLURP_REALISTIC_TUNING,
  slurpSimulationTuningSchema,
  type SlurpSimulationTuning,
} from "../../../../shared/src/slp/slp-tuning.js";
import { estimateSlurpSimulation, SLURP_ESTIMATE_SAMPLE } from "./slurp-simulation-estimate";
import { Field, NumberSetting, SectionTitle, SettingsGroup, Toggle } from "./SlurpSettingsControls";

type Path = readonly string[];

type NumberField = { path: Path; label: string; detail: string; advanced?: boolean };

/** The groups, in the order the plan lays them out. Everything not listed here is `advanced`. */
const GROUPS = ["clock", "rhythm", "reach", "pulse", "world", "funnel", "economy"] as const;
type Group = (typeof GROUPS)[number];

const FIELDS: Record<Group, NumberField[]> = {
  clock: [
    { path: ["clock", "tickMinutes"], label: "Tick length", detail: "Minutes of world time one tick covers." },
    {
      path: ["clock", "catchUpHours"],
      label: "Catch-up limit",
      detail: "Longest absence one tick simulates.",
      advanced: true,
    },
    {
      path: ["clock", "maxEventsPerTick"],
      label: "Events per tick",
      detail: "Most notifications one tick writes.",
      advanced: true,
    },
  ],
  rhythm: [
    { path: ["rhythm", "nightLow"], label: "Deep night", detail: "How busy four in the morning is." },
    { path: ["rhythm", "eveningHigh"], label: "Evening peak", detail: "How busy nine in the evening is." },
    { path: ["rhythm", "weekendBoost"], label: "Weekend boost", detail: "Extra activity on Saturday and Sunday." },
  ],
  reach: [
    { path: ["reach", "floor"], label: "Starting followers", detail: "What a brand-new creator appears to have." },
    {
      path: ["reach", "ceiling"],
      label: "Follower ceiling",
      detail: "The largest invented audience a creator grows into.",
    },
    {
      path: ["reach", "growthDays"],
      label: "Growth days",
      detail: "Days a creator takes to settle near their ceiling.",
      advanced: true,
    },
    {
      path: ["reach", "realFollowerWeight"],
      label: "Real follower weight",
      detail: "How much one real follower counts for.",
      advanced: true,
    },
  ],
  pulse: [
    {
      path: ["pulse", "minutesPerReaction"],
      label: "Minutes per reaction",
      detail: "Time one like, follow or comment costs.",
    },
    { path: ["pulse", "maxPerTick"], label: "Reactions per tick", detail: "Most reactions one tick may deliver." },
    {
      path: ["pulse", "likeBudgetScale"],
      label: "Like budget",
      detail: "Likes on top of the shared plan. 1 keeps them shared.",
    },
    {
      path: ["pulse", "referenceReach"],
      label: "Reference reach",
      detail: "The audience size the rates above are quoted at.",
      advanced: true,
    },
    {
      path: ["pulse", "postMaxAgeHours"],
      label: "Post lifetime",
      detail: "Hours a post keeps attracting reactions.",
      advanced: true,
    },
    {
      path: ["pulse", "oldPostTrickle"],
      label: "Old post trickle",
      detail: "Share of reactions older posts still get.",
      advanced: true,
    },
    {
      path: ["pulse", "wordOfMouth"],
      label: "Word of mouth",
      detail: "Share of followers who bring somebody new each day.",
    },
    {
      path: ["pulse", "viralChance"],
      label: "Viral chance",
      detail: "Chance a post is seen far past its usual reach.",
      advanced: true,
    },
    {
      path: ["pulse", "viralMultiplier"],
      label: "Viral reach",
      detail: "How much a lucky post outdraws the others.",
      advanced: true,
    },
    {
      path: ["pulse", "viralHours"],
      label: "Viral window",
      detail: "Hours a lucky post keeps its luck.",
      advanced: true,
    },
    {
      path: ["pulse", "poolSize"],
      label: "Audience pool",
      detail: "People the world keeps on hand to act.",
      advanced: true,
    },
  ],
  world: [
    {
      path: ["world", "maxActionsPerTick"],
      label: "Requests per tick",
      detail: "Most commissions, messages and questions per tick.",
    },
    {
      path: ["world", "maxOpenRequests"],
      label: "Open requests",
      detail: "Requests one creator may have waiting.",
      advanced: true,
    },
    {
      path: ["world", "commission", "floor"],
      label: "Commission floor",
      detail: "Followers before commissions start.",
      advanced: true,
    },
    {
      path: ["world", "commission", "curve"],
      label: "Commission rate",
      detail: "Chance per day at ten times the floor.",
      advanced: true,
    },
    {
      path: ["world", "commission", "cap"],
      label: "Commission cap",
      detail: "Highest chance per day.",
      advanced: true,
    },
    {
      path: ["world", "message", "floor"],
      label: "Message floor",
      detail: "Followers before unprompted messages start.",
      advanced: true,
    },
    {
      path: ["world", "message", "curve"],
      label: "Message rate",
      detail: "Chance per day at ten times the floor.",
      advanced: true,
    },
    { path: ["world", "message", "cap"], label: "Message cap", detail: "Highest chance per day.", advanced: true },
    {
      path: ["world", "question", "floor"],
      label: "Question floor",
      detail: "Followers before questions start.",
      advanced: true,
    },
    {
      path: ["world", "question", "curve"],
      label: "Question rate",
      detail: "Chance per day at ten times the floor.",
      advanced: true,
    },
    { path: ["world", "question", "cap"], label: "Question cap", detail: "Highest chance per day.", advanced: true },
    {
      path: ["world", "unlockChancePerDay"],
      label: "Unlock chance",
      detail: "Daily chance an eligible fan buys a locked post.",
      advanced: true,
    },
  ],
  funnel: [
    {
      path: ["funnel", "conversionGrowth"],
      label: "Conversion growth",
      detail: "How much engagement raises the chance of subscribing.",
    },
    {
      path: ["funnel", "churnDays"],
      label: "Churn cadence",
      detail: "Days between relationship passes.",
      advanced: true,
    },
  ],
  economy: [
    {
      path: ["economy", "audienceCommissionPrice"],
      label: "Commission price",
      detail: "Coins an audience commission pays.",
    },
    {
      path: ["economy", "audienceTipShare"],
      label: "Tip size",
      detail: "Share of a fan's weekly budget paid by one tip.",
      advanced: true,
    },
  ],
};

/** The switches and choices, by group. */
const TOGGLES: Record<string, { path: Path; label: string; detail: string; advanced?: boolean }[]> = {
  rhythm: [
    {
      path: ["rhythm", "enabled"],
      label: "Daily and weekly rhythm",
      detail: "Quiet overnight, busy in the evening, busier at the weekend.",
    },
  ],
  clock: [
    {
      path: ["clock", "backgroundTimer"],
      label: "Run in the background",
      detail: "Keep the world moving while Slurp is closed.",
    },
  ],
  world: [
    {
      path: ["world", "questionNeedsRecentPost"],
      label: "Questions need a recent post",
      detail: "Off lets somebody ask under an older post.",
      advanced: true,
    },
  ],
  funnel: [
    {
      path: ["funnel", "ambientCanPay"],
      label: "Ambient profiles can pay",
      detail: "Let profiles without a population row subscribe.",
    },
  ],
};

type ZodLike = {
  _def?: { innerType?: ZodLike; schema?: ZodLike };
  shape?: Record<string, ZodLike>;
  minValue?: number | null;
  maxValue?: number | null;
  isInt?: boolean;
};

function unwrap(schema: ZodLike): ZodLike {
  let current = schema;
  while (current._def?.innerType || current._def?.schema) current = (current._def.innerType ?? current._def.schema)!;
  return current;
}

/** The input's range, straight off the stored schema, so the two can never disagree. */
function boundsFor(path: Path): { min: number; max: number; integer: boolean } {
  let node = slurpSimulationTuningSchema as unknown as ZodLike;
  for (const key of path) node = unwrap(node).shape?.[key] ?? node;
  const leaf = unwrap(node);
  return { min: leaf.minValue ?? 0, max: leaf.maxValue ?? Number.MAX_SAFE_INTEGER, integer: leaf.isInt === true };
}

function readPath(tuning: SlurpSimulationTuning, path: Path): number | boolean {
  return path.reduce<unknown>((value, key) => (value as Record<string, unknown>)[key], tuning) as number | boolean;
}

/** A copy with one value replaced, and the preset moved to `custom` unless it still matches one. */
function writePath(tuning: SlurpSimulationTuning, path: Path, value: number | boolean): SlurpSimulationTuning {
  const next = structuredClone(tuning) as unknown as Record<string, unknown>;
  let node = next;
  for (const key of path.slice(0, -1)) node = node[key] as Record<string, unknown>;
  node[path[path.length - 1]!] = value;
  next.preset = "custom";
  return next as unknown as SlurpSimulationTuning;
}

export function SlurpSimulationSettings({
  tuning,
  onSave,
}: {
  tuning: SlurpSimulationTuning;
  onSave: (next: SlurpSimulationTuning) => void;
}) {
  const { t } = useTranslation();
  const [advanced, setAdvanced] = useState(false);
  // The panel edits its own copy so a field keeps the value that was typed while the save is in
  // flight; the stored object arrives back identical.
  const [draft, setDraft] = useState(tuning);
  const apply = (next: SlurpSimulationTuning) => {
    setDraft(next);
    onSave(next);
  };
  const setValue = (path: Path, value: number | boolean) => apply(writePath(draft, path, value));
  // Estimating is a few milliseconds of arithmetic, but it has no business running on every
  // keystroke. The deferred copy keeps typing responsive and the memo keeps it to one run.
  const deferred = useDeferredValue(draft);
  const estimate = useMemo(() => estimateSlurpSimulation(deferred), [deferred]);

  const fieldLabel = (path: Path, label: string) =>
    t(`ui.slurp.settings.simulation.fields.${path.join(".")}`, { defaultValue: label });
  const fieldDetail = (path: Path, detail: string) =>
    t(`ui.slurp.settings.simulation.fields.${path.join(".")}.detail`, { defaultValue: detail });
  const isDefault = (path: Path) => readPath(draft, path) === readPath(SLURP_REALISTIC_TUNING, path);
  /** A whole group back to Realistic. The stored groups are flat objects, so this is one swap. */
  const resetGroup = (group: Group) =>
    apply({ ...draft, [group]: structuredClone(SLURP_REALISTIC_TUNING[group]), preset: "custom" });

  return (
    <div className="space-y-6">
      <SectionTitle title={t("ui.slurp.settings.simulation.title")} detail={t("ui.slurp.settings.simulation.detail")} />

      <SettingsGroup title={t("ui.slurp.settings.simulation.estimate.title")}>
        <p className="text-xs leading-5 text-[var(--muted-foreground)]">
          {t("ui.slurp.settings.simulation.estimate.detail", {
            followers: SLURP_ESTIMATE_SAMPLE.realFollowers,
            price: SLURP_ESTIMATE_SAMPLE.price,
          })}
        </p>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ["likes", estimate.likes],
              ["follows", estimate.follows],
              ["comments", estimate.comments],
              ["subscriptions", estimate.subscriptions],
              ["income", estimate.income],
              ["commissions", estimate.commissions],
              ["messages", estimate.messages],
              ["questions", estimate.questions],
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="rounded-lg bg-[var(--slurp-surface,var(--background))] px-3 py-2">
              <dt className="text-xs font-semibold text-[var(--muted-foreground)]">
                {t(`ui.slurp.settings.simulation.estimate.${key}`)}
              </dt>
              <dd className="text-lg font-black tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </SettingsGroup>

      <Toggle
        label={t("ui.slurp.settings.simulation.advanced")}
        detail={t("ui.slurp.settings.simulation.advancedDetail")}
        value={advanced}
        onChange={setAdvanced}
        compact
      />

      {GROUPS.map((group) => {
        const fields = FIELDS[group].filter((field) => advanced || !field.advanced);
        const toggles = (TOGGLES[group] ?? []).filter((field) => advanced || !field.advanced);
        if (fields.length === 0 && toggles.length === 0) return null;
        return (
          <SettingsGroup key={group} title={t(`ui.slurp.settings.simulation.groups.${group}`)}>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => resetGroup(group)}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-[var(--slurp-muted)] hover:bg-[var(--accent)]/40"
              >
                <RotateCcw size={14} aria-hidden="true" />
                {t("ui.slurp.settings.simulation.resetGroup")}
              </button>
            </div>
            {toggles.map((field) => (
              <Toggle
                key={field.path.join(".")}
                label={fieldLabel(field.path, field.label)}
                detail={fieldDetail(field.path, field.detail)}
                value={readPath(draft, field.path) as boolean}
                onChange={(value) => setValue(field.path, value)}
              />
            ))}
            {group === "funnel" && advanced && (
              <Field
                label={t("ui.slurp.settings.simulation.fields.funnel.rollCadence", { defaultValue: "Roll cadence" })}
                detail={t("ui.slurp.settings.simulation.fields.funnel.rollCadence.detail", {
                  defaultValue: "How often somebody may decide to subscribe.",
                })}
              >
                <select
                  value={draft.funnel.rollCadence}
                  onChange={(event) =>
                    apply({
                      ...draft,
                      funnel: { ...draft.funnel, rollCadence: event.target.value as "daily" | "hourly" },
                      preset: "custom",
                    })
                  }
                  className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--slurp-canvas,var(--background))] px-3 text-base outline-none sm:text-sm"
                >
                  <option value="daily">{t("ui.slurp.settings.simulation.cadence.daily")}</option>
                  <option value="hourly">{t("ui.slurp.settings.simulation.cadence.hourly")}</option>
                </select>
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((field) => {
                const { min, max, integer } = boundsFor(field.path);
                return (
                  <div key={field.path.join(".")} className="space-y-1">
                    <Field label={fieldLabel(field.path, field.label)} detail={fieldDetail(field.path, field.detail)}>
                      <NumberSetting
                        value={readPath(draft, field.path) as number}
                        min={min}
                        max={max}
                        integer={integer}
                        onSave={(value) => setValue(field.path, value)}
                      />
                    </Field>
                    {!isDefault(field.path) && (
                      <button
                        type="button"
                        onClick={() => setValue(field.path, readPath(SLURP_REALISTIC_TUNING, field.path))}
                        className="inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-[var(--slurp-muted)] hover:text-[var(--noodle-accent-foreground)]"
                      >
                        <RotateCcw size={12} aria-hidden="true" />
                        {t("ui.slurp.settings.simulation.reset")}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </SettingsGroup>
        );
      })}
    </div>
  );
}
