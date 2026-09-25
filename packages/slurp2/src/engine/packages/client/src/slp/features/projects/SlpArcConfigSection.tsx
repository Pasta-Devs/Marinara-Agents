// Arc configuration section, split out of components/slurp/SlurpProjectsPanel.tsx in Slice 10.

import type { ReactNode } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { NumberSetting } from "../../modules/settings/SlpSettingsControls";
import { ChoiceSetting, OverrideField, type ChoiceOption } from "../../modules/settings/SlpSettingsInputs";
import type { SlurpArcType, SlurpCreatorArcConfig } from "./slp-projects-contract";
import { useSlurpArcConfig, useUpdateSlurpArcConfig } from "./slp-projects-hooks";

/** Mirrors the server default in `resolveSlurpArcConfig`. */
const GLOBAL_MAX_ACTIVE = 3;

/**
 * Per-Creator storyline overrides. Every field follows the Slurp-wide setting until "Own value" is
 * on; turning it off deletes the stored field, so the Creator follows later Slurp-wide changes.
 */
export function ArcConfigSection({
  personaId,
  creatorAccountId,
  global,
  library,
}: {
  personaId: string;
  creatorAccountId: string;
  global: { arcAutoMode: string; arcCooldownWeeks: number; arcPace: string; arcSource: string; arcCrossovers: boolean };
  library: SlurpArcType[];
}) {
  const { t: localizeUi } = useUiTranslation();
  const query = useSlurpArcConfig(personaId, creatorAccountId);
  const mutation = useUpdateSlurpArcConfig();
  const config = query.data?.config ?? {};
  const busy = query.isPending || mutation.isPending;

  const save = (next: SlurpCreatorArcConfig) => mutation.mutate({ creatorAccountId, personaId, config: next });
  const setField = <K extends keyof SlurpCreatorArcConfig>(key: K, value: SlurpCreatorArcConfig[K] | undefined) => {
    const next = { ...config };
    if (value === undefined) delete next[key];
    else next[key] = value;
    save(next);
  };

  const autoModes: ChoiceOption<NonNullable<SlurpCreatorArcConfig["autoMode"]>>[] = [
    { value: "off", label: localizeUi("ui.slurp.settings.arcAutoModeOff", { defaultValue: "Off" }) },
    { value: "suggest", label: localizeUi("ui.slurp.settings.arcAutoModeSuggest", { defaultValue: "Suggest" }) },
    { value: "auto", label: localizeUi("ui.slurp.settings.arcAutoModeAuto", { defaultValue: "Automatic" }) },
  ];
  const paces: ChoiceOption<NonNullable<SlurpCreatorArcConfig["pace"]>>[] = [
    { value: "slow", label: localizeUi("ui.slurp.settings.arcPaceSlow", { defaultValue: "Slow" }) },
    { value: "normal", label: localizeUi("ui.slurp.settings.arcPaceNormal", { defaultValue: "Normal" }) },
    { value: "fast", label: localizeUi("ui.slurp.settings.arcPaceFast", { defaultValue: "Fast" }) },
  ];
  const sources: ChoiceOption<NonNullable<SlurpCreatorArcConfig["source"]>>[] = [
    { value: "library", label: localizeUi("ui.slurp.projects.config.sourceLibrary", { defaultValue: "Library" }) },
    {
      value: "generated",
      label: localizeUi("ui.slurp.projects.config.sourceGenerated", { defaultValue: "Generated" }),
    },
    { value: "mixed", label: localizeUi("ui.slurp.projects.config.sourceMixed", { defaultValue: "Mixed" }) },
  ];
  const maxActive: ChoiceOption<"1" | "2" | "3">[] = [
    { value: "1", label: "1" },
    { value: "2", label: "2" },
    { value: "3", label: "3" },
  ];
  const onOff: ChoiceOption<"true" | "false">[] = [
    { value: "true", label: localizeUi("ui.slurp.projects.config.on", { defaultValue: "On" }) },
    { value: "false", label: localizeUi("ui.slurp.projects.config.off", { defaultValue: "Off" }) },
  ];
  const labelOf = (options: readonly ChoiceOption<string>[], value: string) =>
    options.find((option) => option.value === value)?.label ?? value;
  const enabledTypeIds = library.filter((type) => type.enabled).map((type) => type.id);
  const allowed = config.allowedTypeIds;

  /** One override row: the stored field, or the Slurp-wide value when there is none. */
  const override = <K extends keyof SlurpCreatorArcConfig>(
    key: K,
    label: string,
    inherited: SlurpCreatorArcConfig[K],
    inheritedLabel: string,
    control: (value: NonNullable<SlurpCreatorArcConfig[K]>) => ReactNode,
  ) => (
    <OverrideField
      label={label}
      inheritedValue={inheritedLabel}
      overridden={config[key] !== undefined}
      disabled={busy}
      onOverride={() => setField(key, inherited)}
      onReset={() => setField(key, undefined)}
    >
      {config[key] !== undefined && control(config[key] as NonNullable<SlurpCreatorArcConfig[K]>)}
    </OverrideField>
  );

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-[var(--noodle-divider)] pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
          {localizeUi("ui.slurp.projects.config.heading", { defaultValue: "Storyline settings" })}
        </h3>
        <button
          type="button"
          onClick={() => save({})}
          className="min-h-11 text-sm font-semibold underline disabled:opacity-50"
          disabled={busy || Object.keys(config).length === 0}
        >
          {localizeUi("ui.slurp.projects.config.reset", { defaultValue: "Use Slurp settings for all" })}
        </button>
      </div>
      {override(
        "autoMode",
        localizeUi("ui.slurp.projects.config.autoMode", { defaultValue: "Automatic storylines" }),
        global.arcAutoMode as SlurpCreatorArcConfig["autoMode"],
        labelOf(autoModes, global.arcAutoMode),
        (value) => (
          <ChoiceSetting
            labelHidden
            label={localizeUi("ui.slurp.projects.config.autoMode")}
            options={autoModes}
            value={value}
            disabled={busy}
            onChange={(next) => setField("autoMode", next)}
          />
        ),
      )}
      {override(
        "source",
        localizeUi("ui.slurp.projects.config.source", { defaultValue: "Source" }),
        global.arcSource as SlurpCreatorArcConfig["source"],
        labelOf(sources, global.arcSource),
        (value) => (
          <ChoiceSetting
            labelHidden
            label={localizeUi("ui.slurp.projects.config.source")}
            options={sources}
            value={value}
            disabled={busy}
            onChange={(next) => setField("source", next)}
          />
        ),
      )}
      {override(
        "cooldownWeeks",
        localizeUi("ui.slurp.projects.config.cooldownWeeks", { defaultValue: "Weeks between automatic storylines" }),
        global.arcCooldownWeeks,
        String(global.arcCooldownWeeks),
        (value) => (
          <label className="block">
            <span className="sr-only">{localizeUi("ui.slurp.projects.config.cooldownWeeks")}</span>
            <NumberSetting
              value={value}
              min={1}
              max={8}
              disabled={busy}
              onSave={(next) => setField("cooldownWeeks", next)}
            />
          </label>
        ),
      )}
      {override(
        "pace",
        localizeUi("ui.slurp.projects.config.pace", { defaultValue: "Storyline speed" }),
        global.arcPace as SlurpCreatorArcConfig["pace"],
        labelOf(paces, global.arcPace),
        (value) => (
          <ChoiceSetting
            labelHidden
            label={localizeUi("ui.slurp.projects.config.pace")}
            options={paces}
            value={value}
            disabled={busy}
            onChange={(next) => setField("pace", next)}
          />
        ),
      )}
      {override(
        "maxActive",
        localizeUi("ui.slurp.projects.config.maxActive", { defaultValue: "Storylines running at once" }),
        GLOBAL_MAX_ACTIVE,
        String(GLOBAL_MAX_ACTIVE),
        (value) => (
          <ChoiceSetting
            labelHidden
            label={localizeUi("ui.slurp.projects.config.maxActive")}
            options={maxActive}
            value={String(value) as "1" | "2" | "3"}
            disabled={busy}
            onChange={(next) => setField("maxActive", Number(next))}
          />
        ),
      )}
      {override(
        "crossovers",
        localizeUi("ui.slurp.projects.config.crossovers", { defaultValue: "Automatic crossovers" }),
        global.arcCrossovers,
        labelOf(onOff, String(global.arcCrossovers)),
        (value) => (
          <ChoiceSetting
            labelHidden
            label={localizeUi("ui.slurp.projects.config.crossovers")}
            options={onOff}
            value={value ? "true" : "false"}
            disabled={busy}
            onChange={(next) => setField("crossovers", next === "true")}
          />
        ),
      )}
      {override(
        "allowedTypeIds",
        localizeUi("ui.slurp.projects.config.types", { defaultValue: "Types" }),
        enabledTypeIds,
        localizeUi("ui.slurp.projects.config.allTypes", { defaultValue: "All enabled types" }),
        () => (
          <div className="flex flex-wrap gap-2">
            {library.map((type) => {
              const on = Boolean(allowed?.includes(type.id));
              return (
                <label
                  key={type.id}
                  className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-3 text-sm ring-1 ring-inset focus-within:ring-2 focus-within:ring-[var(--slurp-focus,var(--noodle-accent))] ${on ? "bg-[var(--slurp-nav-active)] font-semibold ring-[var(--noodle-accent)]/45" : "text-[var(--slurp-muted,var(--muted-foreground))] ring-[var(--slurp-outline,var(--border))]"}`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={on}
                    disabled={busy}
                    onChange={(event) =>
                      setField(
                        "allowedTypeIds",
                        event.target.checked
                          ? [...(allowed ?? []), type.id]
                          : (allowed ?? []).filter((id) => id !== type.id),
                      )
                    }
                  />
                  {type.name}
                </label>
              );
            })}
          </div>
        ),
      )}
      {mutation.error && <p className="text-sm text-[var(--destructive)]">{mutation.error.message}</p>}
    </div>
  );
}

/** A library type brings its own title, so only a custom arc needs one typed in. */
