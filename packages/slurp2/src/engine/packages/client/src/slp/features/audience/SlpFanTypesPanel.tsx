import { Copy, Plus, RotateCcw, Trash2, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  slurpFanTypeSchema,
  slurpFanTypesDefault,
  type SlurpFanType,
} from "../../../../../shared/src/slp/slp-fan-types.js";
import { api } from "../../../lib/api-client";
import {
  Field,
  NumberSetting,
  SectionTitle,
  SettingsGroup,
  Toggle,
} from "../../modules/settings/SlpSettingsControls";

type RebalancePreview = { changed: number; counts: Record<string, { before: number; after: number }> };

const input =
  "min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--slurp-canvas,var(--background))] px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]/35 sm:text-sm";
const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold hover:bg-[var(--accent)]/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--noodle-accent)] disabled:opacity-50";

const clone = <T,>(value: T): T => structuredClone(value);
const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 48) || "fan";

function freshType(source?: SlurpFanType): SlurpFanType {
  const base = clone(source ?? slurpFanTypesDefault()[0]!);
  return slurpFanTypeSchema.parse({
    ...base,
    id: `custom-${slug(base.name)}-${Date.now().toString(36)}`,
    name: source ? `${source.name} copy` : "New fan type",
    builtIn: false,
  });
}

export function SlurpFanTypesSettings({
  fanTypes,
  bankCounts,
  crowdTone,
  onSave,
}: {
  fanTypes: readonly SlurpFanType[];
  bankCounts: Readonly<Record<string, string[]>>;
  /** The Audience tone a type without an override inherits. */
  crowdTone: "warm" | "mixed" | "unfiltered";
  onSave: (fanTypes: SlurpFanType[]) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState(fanTypes[0]?.id ?? "");
  const selected = fanTypes.find((type) => type.id === selectedId);
  const [draft, setDraft] = useState<SlurpFanType | null>(fanTypes[0] ? clone(fanTypes[0]) : null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState<RebalancePreview | null>(null);
  const [rebalanceBusy, setRebalanceBusy] = useState(false);
  const totalShare = useMemo(
    () => fanTypes.filter((type) => type.enabled).reduce((sum, type) => sum + type.share, 0),
    [fanTypes],
  );

  useEffect(() => {
    if (!selected) return;
    setDraft(clone(selected));
  }, [selected]);

  const replace = (next: SlurpFanType) => fanTypes.map((type) => (type.id === selected?.id ? next : type));
  const saveDraft = async () => {
    if (!draft) return;
    setSaving(true);
    const parsed = slurpFanTypeSchema.safeParse(draft);
    const ok = parsed.success && (await onSave(replace(parsed.data)));
    setStatus(
      ok
        ? t("ui.slurp.settings.fanTypes.saved", { defaultValue: "Fan type saved." })
        : t("ui.slurp.settings.fanTypes.saveError", { defaultValue: "Unable to save this fan type." }),
    );
    setSaving(false);
  };
  const add = (source?: SlurpFanType) => {
    const next = freshType(source);
    setSelectedId(next.id);
    setDraft(next);
    setPreview(null);
  };
  const addDraft = async () => {
    if (!draft || fanTypes.some((type) => type.id === draft.id)) return saveDraft();
    setSaving(true);
    try {
      const parsed = slurpFanTypeSchema.safeParse(draft);
      const ok = parsed.success && (await onSave([...fanTypes, parsed.data]));
      setStatus(
        ok
          ? t("ui.slurp.settings.fanTypes.saved", { defaultValue: "Fan type saved." })
          : t("ui.slurp.settings.fanTypes.saveError", { defaultValue: "Unable to save this fan type." }),
      );
    } catch {
      setStatus(t("ui.slurp.settings.fanTypes.saveError", { defaultValue: "Unable to save this fan type." }));
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!selected || fanTypes.length <= 1) return;
    if (
      !window.confirm(
        t("ui.slurp.settings.fanTypes.deleteConfirm", {
          defaultValue: "Delete {{name}}? Existing fans will use a compatible type until you rebalance the audience.",
          name: selected.name,
        }),
      )
    )
      return;
    const next = fanTypes.filter((type) => type.id !== selected.id);
    if (await onSave(next)) {
      setSelectedId(next[0]?.id ?? "");
      setPreview(null);
    }
  };
  const reset = async () => {
    if (!selected?.builtIn) return;
    const original = slurpFanTypesDefault().find((type) => type.id === selected.id);
    if (original && (await onSave(replace(original)))) setDraft(clone(original));
  };
  const previewRebalance = async () => {
    setRebalanceBusy(true);
    try {
      setPreview(await api.get<RebalancePreview>("/slurp2/fan-types/rebalance/preview"));
    } finally {
      setRebalanceBusy(false);
    }
  };
  const applyRebalance = async () => {
    setRebalanceBusy(true);
    try {
      const result = await api.post<RebalancePreview>("/slurp2/fan-types/rebalance", {});
      setPreview(result);
      setStatus(
        t("ui.slurp.settings.fanTypes.rebalanced", {
          defaultValue: "Reassigned {{count}} audience members.",
          count: result.changed,
        }),
      );
    } finally {
      setRebalanceBusy(false);
    }
  };

  if (!draft) return null;
  const set = <K extends keyof SlurpFanType>(key: K, value: SlurpFanType[K]) => setDraft({ ...draft, [key]: value });
  const setBehavior = (key: keyof SlurpFanType["behavior"], value: number) =>
    set("behavior", { ...draft.behavior, [key]: value });
  const setSpend = (key: keyof SlurpFanType["spend"], value: SlurpFanType["spend"][typeof key]) =>
    set("spend", { ...draft.spend, [key]: value });
  const setFunnel = (key: keyof SlurpFanType["funnel"], value: number) =>
    set("funnel", { ...draft.funnel, [key]: value });

  return (
    <div className="space-y-6">
      <SectionTitle
        title={t("ui.slurp.settings.fanTypes.title", { defaultValue: "Fan types" })}
        detail={t("ui.slurp.settings.fanTypes.detail", {
          defaultValue: "Shape who joins the audience, how they behave, what they spend, and how they write.",
        })}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(15rem,0.7fr)_minmax(0,1.3fr)]">
        <SettingsGroup title={t("ui.slurp.settings.fanTypes.audienceMix", { defaultValue: "Audience mix" })}>
          <div className="space-y-2">
            {fanTypes.map((type) => {
              const share = type.enabled && totalShare > 0 ? (type.share / totalShare) * 100 : 0;
              return (
                <button
                  key={type.id}
                  type="button"
                  aria-pressed={type.id === selectedId}
                  onClick={() => setSelectedId(type.id)}
                  className={`relative min-h-14 w-full overflow-hidden rounded-lg border px-3 py-2 text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--noodle-accent)] ${
                    type.id === selectedId
                      ? "border-[var(--noodle-accent)] bg-[var(--noodle-accent)]/10"
                      : "border-[var(--border)] hover:bg-[var(--accent)]/40"
                  }`}
                >
                  <span
                    className="absolute inset-y-0 start-0 bg-[var(--noodle-accent)]/10"
                    style={{ width: `${Math.max(0, Math.min(100, share))}%` }}
                    aria-hidden="true"
                  />
                  <span className="relative flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{type.name}</span>
                      <span className="block text-xs text-[var(--muted-foreground)]">
                        {type.enabled
                          ? t("ui.slurp.settings.fanTypes.share", {
                              defaultValue: "{{share}}% of new fans",
                              share: share.toFixed(1),
                            })
                          : t("ui.slurp.settings.fanTypes.disabled", { defaultValue: "Disabled" })}
                      </span>
                    </span>
                    {type.builtIn && (
                      <span className="rounded-full bg-[var(--background)]/75 px-2 py-1 text-[0.625rem] font-bold uppercase tracking-wide">
                        {t("ui.slurp.settings.fanTypes.builtIn", { defaultValue: "Built-in" })}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <button type="button" className={button} onClick={() => add()}>
              <Plus size={16} aria-hidden="true" />
              {t("ui.slurp.settings.fanTypes.add", { defaultValue: "Add fan type" })}
            </button>
            <button type="button" className={button} onClick={() => add(draft)}>
              <Copy size={16} aria-hidden="true" />
              {t("ui.slurp.settings.fanTypes.duplicate", { defaultValue: "Duplicate type" })}
            </button>
          </div>
          <div className="space-y-3 pt-3">
            <p className="text-xs leading-5 text-[var(--muted-foreground)]">
              {t("ui.slurp.settings.fanTypes.rebalanceDetail", {
                defaultValue:
                  "Share changes affect new fans. Preview a rebalance to update people already in the audience.",
              })}
            </p>
            <button type="button" className={button} disabled={rebalanceBusy} onClick={() => void previewRebalance()}>
              <UsersRound size={16} aria-hidden="true" />
              {t("ui.slurp.settings.fanTypes.previewRebalance", { defaultValue: "Preview rebalance" })}
            </button>
            {preview && (
              <div className="space-y-3 rounded-lg bg-[var(--accent)]/35 p-3" role="status">
                <p className="text-sm font-semibold">
                  {t("ui.slurp.settings.fanTypes.previewCount", {
                    defaultValue: "{{count}} people would change type.",
                    count: preview.changed,
                  })}
                </p>
                <button
                  type="button"
                  className={button}
                  disabled={rebalanceBusy || preview.changed === 0}
                  onClick={() => void applyRebalance()}
                >
                  {t("ui.slurp.settings.fanTypes.applyRebalance", { defaultValue: "Rebalance audience" })}
                </button>
              </div>
            )}
          </div>
        </SettingsGroup>

        <div className="space-y-6">
          <SettingsGroup title={t("ui.slurp.settings.fanTypes.identity", { defaultValue: "Identity and voice" })}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("ui.slurp.settings.fanTypes.name", { defaultValue: "Name" })}>
                <input
                  className={input}
                  value={draft.name}
                  maxLength={48}
                  onChange={(event) => set("name", event.target.value)}
                />
              </Field>
              <Field label={t("ui.slurp.settings.fanTypes.archetype", { defaultValue: "Engine archetype" })}>
                <select
                  className={input}
                  value={draft.engineArchetype}
                  onChange={(event) => set("engineArchetype", event.target.value as SlurpFanType["engineArchetype"])}
                >
                  {(
                    ["ordinary", "eccentric", "crossFandom", "raider", "organicDiscovery", "freeResource"] as const
                  ).map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("ui.slurp.settings.fanTypes.shareWeight", { defaultValue: "Population weight" })}>
                <NumberSetting
                  value={draft.share}
                  min={0}
                  max={1000}
                  integer={false}
                  onSave={(value) => set("share", value)}
                />
              </Field>
              <Field label={t("ui.slurp.settings.fanTypes.tone", { defaultValue: "Tone override" })}>
                <select
                  className={input}
                  value={draft.tone ?? ""}
                  onChange={(event) => set("tone", event.target.value || undefined)}
                >
                  <option value="">
                    {t("ui.slurp.settings.fanTypes.crowdTone", {
                      tone: t(`ui.slurp.settings.audience.tone.${crowdTone}`),
                    })}
                  </option>
                  <option value="warm">{t("ui.slurp.settings.audience.tone.warm")}</option>
                  <option value="mixed">{t("ui.slurp.settings.audience.tone.mixed")}</option>
                  <option value="unfiltered">{t("ui.slurp.settings.audience.tone.unfiltered")}</option>
                </select>
              </Field>
            </div>
            <Field
              label={t("ui.slurp.settings.fanTypes.voice", { defaultValue: "Writing voice" })}
              detail={t("ui.slurp.settings.fanTypes.voiceDetail", {
                defaultValue: "Prompt guidance used for comments, rewrites, and direct messages.",
              })}
            >
              <textarea
                className={`${input} min-h-28 py-3`}
                value={draft.voice}
                maxLength={600}
                onChange={(event) => set("voice", event.target.value)}
              />
            </Field>
            <Field
              label={t("ui.slurp.settings.fanTypes.traits", { defaultValue: "Traits" })}
              detail={t("ui.slurp.settings.fanTypes.traitsDetail", {
                defaultValue: "Separate traits with commas. Up to 12.",
              })}
            >
              <input
                className={input}
                value={draft.traits.join(", ")}
                onChange={(event) =>
                  set(
                    "traits",
                    event.target.value
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean)
                      .slice(0, 12),
                  )
                }
              />
            </Field>
            <Toggle
              label={t("ui.slurp.settings.fanTypes.enabled", { defaultValue: "Use this fan type" })}
              value={draft.enabled}
              onChange={(value) => set("enabled", value)}
              compact
            />
          </SettingsGroup>

          <SettingsGroup title={t("ui.slurp.settings.fanTypes.behavior", { defaultValue: "Behavior" })}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(Object.keys(draft.behavior) as Array<keyof SlurpFanType["behavior"]>).map((key) => (
                <Field key={key} label={t(`ui.slurp.settings.fanTypes.behavior.${key}`, { defaultValue: key })}>
                  <NumberSetting
                    value={draft.behavior[key]}
                    min={0}
                    max={5}
                    integer={false}
                    onSave={(value) => setBehavior(key, value)}
                  />
                </Field>
              ))}
            </div>
          </SettingsGroup>

          <SettingsGroup title={t("ui.slurp.settings.fanTypes.schedule", { defaultValue: "Schedule and spending" })}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label={t("ui.slurp.settings.fanTypes.peakHour", { defaultValue: "Peak hour" })}>
                <NumberSetting
                  value={draft.activeHours.peak}
                  min={0}
                  max={23}
                  onSave={(value) => set("activeHours", { ...draft.activeHours, peak: value })}
                />
              </Field>
              <Field label={t("ui.slurp.settings.fanTypes.hourSpread", { defaultValue: "Active-hour spread" })}>
                <NumberSetting
                  value={draft.activeHours.spread}
                  min={1}
                  max={12}
                  onSave={(value) => set("activeHours", { ...draft.activeHours, spread: value })}
                />
              </Field>
              <Field label={t("ui.slurp.settings.fanTypes.tipChance", { defaultValue: "Daily tip chance" })}>
                <NumberSetting
                  value={draft.spend.tipChance}
                  min={0}
                  max={1}
                  integer={false}
                  onSave={(value) => setSpend("tipChance", value)}
                />
              </Field>
              {(["weeklyBudget", "commissionBudget"] as const).flatMap((key) =>
                ([0, 1] as const).map((index) => (
                  <Field
                    key={`${key}-${index}`}
                    label={t(`ui.slurp.settings.fanTypes.${key}.${index}`, {
                      defaultValue: `${key === "weeklyBudget" ? "Weekly" : "Commission"} budget ${index === 0 ? "minimum" : "maximum"}`,
                    })}
                  >
                    <NumberSetting
                      value={draft.spend[key][index]}
                      min={0}
                      max={99999}
                      onSave={(value) => {
                        const range = [...draft.spend[key]] as [number, number];
                        range[index] = value;
                        setSpend(key, range);
                      }}
                    />
                  </Field>
                )),
              )}
            </div>
          </SettingsGroup>

          <SettingsGroup
            title={t("ui.slurp.settings.fanTypes.funnel", { defaultValue: "Follow and subscription funnel" })}
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(Object.keys(draft.funnel) as Array<keyof SlurpFanType["funnel"]>).map((key) => (
                <Field key={key} label={t(`ui.slurp.settings.fanTypes.funnel.${key}`, { defaultValue: key })}>
                  <NumberSetting
                    value={draft.funnel[key]}
                    min={key === "loyaltyDays" ? 1 : 0}
                    max={key === "loyaltyDays" ? 3650 : 1}
                    integer={key === "loyaltyDays"}
                    onSave={(value) => setFunnel(key, value)}
                  />
                </Field>
              ))}
              <Field
                label={t("ui.slurp.settings.fanTypes.bankTarget", { defaultValue: "Comment bank target" })}
                detail={t("ui.slurp.settings.fanTypes.bankCount", {
                  defaultValue: "{{count}} comments stored now.",
                  count: bankCounts[draft.id]?.length ?? 0,
                })}
              >
                <NumberSetting
                  value={draft.bank.targetSize}
                  min={0}
                  max={500}
                  onSave={(value) => set("bank", { targetSize: value })}
                />
              </Field>
            </div>
          </SettingsGroup>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className={button}
                disabled={!selected?.builtIn || saving}
                onClick={() => void reset()}
              >
                <RotateCcw size={16} aria-hidden="true" />
                {t("ui.slurp.settings.fanTypes.reset", { defaultValue: "Reset built-in" })}
              </button>
              <button
                type="button"
                className={button}
                disabled={fanTypes.length <= 1 || saving}
                onClick={() => void remove()}
              >
                <Trash2 size={16} aria-hidden="true" />
                {t("ui.slurp.settings.fanTypes.delete", { defaultValue: "Delete type" })}
              </button>
            </div>
            <button
              type="button"
              className={`${button} border-[var(--noodle-accent)] bg-[var(--noodle-accent)] text-white`}
              disabled={saving || !draft.name.trim()}
              onClick={() => void addDraft()}
            >
              {saving
                ? t("ui.slurp.settings.fanTypes.saving", { defaultValue: "Saving…" })
                : t("ui.slurp.settings.fanTypes.save", { defaultValue: "Save fan type" })}
            </button>
          </div>
          <p className="min-h-5 text-sm text-[var(--muted-foreground)]" role="status" aria-live="polite">
            {status}
          </p>
        </div>
      </div>
    </div>
  );
}
