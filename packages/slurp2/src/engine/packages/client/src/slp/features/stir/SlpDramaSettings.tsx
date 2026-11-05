import { useTranslation } from "react-i18next";
import { SettingsGroup, Toggle } from "../../modules/settings/SlpSettingsControls";
import { ChoiceSetting } from "../../modules/settings/SlpSettingsInputs";
import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";
import { SLP_DRAMA_LEVELS, type SlpDramaSettings } from "../../../../../shared/src/slp/slp-drama.js";
import { slpDramaWords, useSlurpDrama } from "./slp-drama-hooks";

/**
 * Settings › Stir › Drama (docs/DRAMA.md): how much drama, which situations and dramas may run, and
 * each standing situation's dials. One stored object, `drama`; nothing runs until something is on.
 */
export function SlpDramaSettings({
  settings,
  update,
  updateSettings,
  settingKey,
}: SlpBackstagePageProps & { settingKey: "drama" }) {
  const { t } = useTranslation();
  const { data } = useSlurpDrama();
  const drama = settings.drama;
  const set = (next: Partial<SlpDramaSettings>) => void update("drama", { ...drama, ...next });
  const tx = (key: string, options?: Record<string, unknown>) => t(`ui.slurp.drama.settings.${key}`, options);
  const on = new Set(drama.enabled);
  const toggle = (id: string, value: boolean) =>
    set({ enabled: value ? [...drama.enabled, id] : drama.enabled.filter((entry) => entry !== id) });
  const catalog = data?.catalog ?? [];
  const nameOf = (id: string) => catalog.find((entry) => entry.id === id)?.name ?? slpDramaWords(id);
  const situations = catalog.filter((entry) => entry.kind === "situation");
  const dramas = catalog.filter((entry) => entry.kind === "drama");
  const dialsOf = (entry: (typeof catalog)[number]) =>
    entry.dials.map((dial) => (
      <ChoiceSetting
        key={dial.key}
        label={slpDramaWords(dial.key)}
        options={dial.options.map((value) => ({ value, label: slpDramaWords(value) }))}
        value={drama.dials[entry.id]?.[dial.key] ?? dial.default}
        disabled={updateSettings.isPending}
        onChange={(value) =>
          set({ dials: { ...drama.dials, [entry.id]: { ...drama.dials[entry.id], [dial.key]: value } } })
        }
      />
    ));
  return (
    <>
      <SettingsGroup title={tx("title")}>
        <ChoiceSetting
          settingKey={settingKey}
          label={tx("level")}
          detail={tx("levelDetail")}
          options={SLP_DRAMA_LEVELS.map((value) => ({ value, label: tx(`levels.${value}`) }))}
          value={drama.level}
          disabled={updateSettings.isPending}
          onChange={(level) => set({ level })}
        />
      </SettingsGroup>
      {situations.length > 0 && (
        <SettingsGroup title={tx("situations")}>
          {situations.map((entry) => (
            <div key={entry.id} className="space-y-3" data-slurp-drama-entry={entry.id}>
              <Toggle
                label={entry.name}
                detail={entry.description || tx("situationDetail")}
                value={on.has(entry.id)}
                onChange={(value) => toggle(entry.id, value)}
              />
              {on.has(entry.id) && dialsOf(entry)}
            </div>
          ))}
        </SettingsGroup>
      )}
      {dramas.length > 0 && (
        <SettingsGroup title={tx("dramas")}>
          {dramas.map((entry) => (
            <div key={entry.id} className="space-y-3" data-slurp-drama-entry={entry.id}>
              <Toggle
                label={entry.name}
                detail={entry.description}
                value={entry.pack ? entry.pack.on : on.has(entry.id)}
                onChange={(value) => toggle(entry.id, value)}
                disabledReason={
                  entry.pack
                    ? tx("fromPack", { name: entry.pack.name })
                    : entry.requires && !on.has(entry.requires)
                      ? tx("needs", { name: nameOf(entry.requires) })
                      : null
                }
              />
              {(entry.pack ? entry.pack.on : on.has(entry.id)) && dialsOf(entry)}
            </div>
          ))}
        </SettingsGroup>
      )}
    </>
  );
}
