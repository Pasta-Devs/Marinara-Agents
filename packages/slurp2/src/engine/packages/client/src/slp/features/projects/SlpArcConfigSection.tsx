// Arc configuration section, split out of components/slurp/SlurpProjectsPanel.tsx in Slice 10.

import { useTranslation as useUiTranslation } from "react-i18next";
import type { SlurpArcType, SlurpCreatorArcConfig } from "./slp-projects-contract";
import { useSlurpArcConfig, useUpdateSlurpArcConfig } from "./slp-projects-hooks";

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
  const globalLabel = (value: string | number) =>
    localizeUi("ui.slurp.projects.config.global", { defaultValue: "Global ({{value}})", value });
  const field = "w-full rounded border border-[var(--noodle-divider)] bg-transparent px-2 py-1 text-xs";

  const select = <K extends keyof SlurpCreatorArcConfig>(
    key: K,
    label: string,
    globalValue: string | number,
    options: { value: string; label: string }[],
    parse: (value: string) => SlurpCreatorArcConfig[K],
  ) => (
    <label className="flex flex-col gap-1 text-[0.7rem] font-semibold">
      {label}
      <select
        value={config[key] === undefined ? "" : String(config[key])}
        disabled={busy}
        onChange={(event) => setField(key, event.target.value === "" ? undefined : parse(event.target.value))}
        className={field}
      >
        <option value="">{globalLabel(globalValue)}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );

  const autoModes = [
    { value: "off", label: localizeUi("ui.slurp.settings.arcAutoModeOff", { defaultValue: "Off" }) },
    { value: "suggest", label: localizeUi("ui.slurp.settings.arcAutoModeSuggest", { defaultValue: "Suggest" }) },
    { value: "auto", label: localizeUi("ui.slurp.settings.arcAutoModeAuto", { defaultValue: "Automatic" }) },
  ];
  const paces = [
    { value: "slow", label: localizeUi("ui.slurp.settings.arcPaceSlow", { defaultValue: "Slow" }) },
    { value: "normal", label: localizeUi("ui.slurp.settings.arcPaceNormal", { defaultValue: "Normal" }) },
    { value: "fast", label: localizeUi("ui.slurp.settings.arcPaceFast", { defaultValue: "Fast" }) },
  ];
  const numbers = (max: number) =>
    Array.from({ length: max }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }));
  const sources = [
    { value: "library", label: localizeUi("ui.slurp.projects.config.sourceLibrary", { defaultValue: "Library" }) },
    {
      value: "generated",
      label: localizeUi("ui.slurp.projects.config.sourceGenerated", { defaultValue: "Generated" }),
    },
    { value: "mixed", label: localizeUi("ui.slurp.projects.config.sourceMixed", { defaultValue: "Mixed" }) },
  ];
  const allowed = config.allowedTypeIds;

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-[var(--noodle-divider)] pt-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
          {localizeUi("ui.slurp.projects.config.heading", { defaultValue: "Arc settings" })}
        </h3>
        <button
          type="button"
          onClick={() => save({})}
          className="text-[0.7rem] font-semibold underline disabled:opacity-50"
          disabled={busy || Object.keys(config).length === 0}
        >
          {localizeUi("ui.slurp.projects.config.reset", { defaultValue: "Reset to global" })}
        </button>
      </div>
      {select(
        "autoMode",
        localizeUi("ui.slurp.projects.config.autoMode", { defaultValue: "Automatic arcs" }),
        autoModes.find((mode) => mode.value === global.arcAutoMode)?.label ?? global.arcAutoMode,
        autoModes,
        (value) => value as SlurpCreatorArcConfig["autoMode"],
      )}
      {select(
        "source",
        localizeUi("ui.slurp.projects.config.source", { defaultValue: "Source" }),
        sources.find((source) => source.value === global.arcSource)?.label ?? global.arcSource,
        sources,
        (value) => value as SlurpCreatorArcConfig["source"],
      )}
      {select(
        "cooldownWeeks",
        localizeUi("ui.slurp.projects.config.cooldownWeeks", { defaultValue: "Weeks between automatic arcs" }),
        global.arcCooldownWeeks,
        numbers(8),
        Number,
      )}
      {select(
        "pace",
        localizeUi("ui.slurp.projects.config.pace", { defaultValue: "Arc speed" }),
        paces.find((pace) => pace.value === global.arcPace)?.label ?? global.arcPace,
        paces,
        (value) => value as SlurpCreatorArcConfig["pace"],
      )}
      {select(
        "maxActive",
        localizeUi("ui.slurp.projects.config.maxActive", { defaultValue: "Arcs running at once" }),
        3,
        numbers(3),
        Number,
      )}
      {(() => {
        const toggles = [
          { value: "true", label: localizeUi("ui.slurp.projects.config.on", { defaultValue: "On" }) },
          { value: "false", label: localizeUi("ui.slurp.projects.config.off", { defaultValue: "Off" }) },
        ];
        return select(
          "crossovers",
          localizeUi("ui.slurp.projects.config.crossovers", { defaultValue: "Automatic crossovers" }),
          toggles[global.arcCrossovers ? 0 : 1]!.label,
          toggles,
          (value) => value === "true",
        );
      })()}
      <label className="flex flex-col gap-1 text-[0.7rem] font-semibold">
        {localizeUi("ui.slurp.projects.config.types", { defaultValue: "Types" })}
        <select
          value={allowed ? "chosen" : ""}
          disabled={busy}
          onChange={(event) =>
            setField(
              "allowedTypeIds",
              event.target.value ? library.filter((type) => type.enabled).map((type) => type.id) : undefined,
            )
          }
          className={field}
        >
          <option value="">
            {globalLabel(localizeUi("ui.slurp.projects.config.allTypes", { defaultValue: "All enabled types" }))}
          </option>
          <option value="chosen">
            {localizeUi("ui.slurp.projects.config.chosenTypes", { defaultValue: "Chosen types" })}
          </option>
        </select>
      </label>
      {allowed && (
        <div className="flex flex-col gap-1">
          {library.map((type) => (
            <label key={type.id} className="flex items-center gap-2 text-[0.7rem]">
              <input
                type="checkbox"
                checked={allowed.includes(type.id)}
                disabled={busy}
                onChange={(event) =>
                  setField(
                    "allowedTypeIds",
                    event.target.checked ? [...allowed, type.id] : allowed.filter((id) => id !== type.id),
                  )
                }
              />
              {type.name}
            </label>
          ))}
        </div>
      )}
      {mutation.error && <p className="text-[0.7rem] text-[var(--destructive)]">{mutation.error.message}</p>}
    </div>
  );
}

/** A library type brings its own title, so only a custom arc needs one typed in. */
