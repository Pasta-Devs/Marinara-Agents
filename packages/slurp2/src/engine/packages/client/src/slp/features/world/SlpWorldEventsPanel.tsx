import { useTranslation } from "react-i18next";

import { SlurpPlatformEventsSettings } from "./SlpPlatformEventsPanel";

import { Field } from "../../modules/settings/SlpSettingsControls";
import { SettingAnchor } from "../../modules/settings/SlpSettingsKit";

import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";

const selectClass =
  "min-h-11 w-full min-w-0 rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-sm";

/** Platform events and holidays that change the world for a date range. */
export function SlpWorldEventsPanel(page: SlpBackstagePageProps) {
  const { updateSettings, settings, update } = page;
  const { t } = useTranslation();

  return (
    <div className="space-y-10">
      <SettingAnchor settingKey="storyAutomation">
        <Field
          settingKey="storyAutomation"
          label={t("ui.slurp.settings.events.automationLabel", { defaultValue: "Story automation" })}
          detail={t("ui.slurp.settings.events.automationDetail", {
            defaultValue:
              "When an event's dates come, Slurp can wait for you, suggest it, or start it. This affects events only; storylines have their own setting. Events with their own choice keep it.",
          })}
        >
          <select
            className={selectClass}
            disabled={updateSettings.isPending}
            value={settings.storyAutomation}
            onChange={(event) => void update("storyAutomation", event.target.value as typeof settings.storyAutomation)}
          >
            <option value="manual">
              {t("ui.slurp.settings.events.automationManual", { defaultValue: "Only when I start it" })}
            </option>
            <option value="suggest">
              {t("ui.slurp.settings.events.automationSuggest", { defaultValue: "Suggest it and wait for me" })}
            </option>
            <option value="auto">
              {t("ui.slurp.settings.events.automationAuto", { defaultValue: "Start it for me" })}
            </option>
          </select>
        </Field>
      </SettingAnchor>
      <SettingAnchor settingKey="platformEvents">
        <SlurpPlatformEventsSettings
          events={settings.platformEvents}
          saving={updateSettings.isPending}
          onSave={(events) => update("platformEvents", events)}
        />
      </SettingAnchor>
    </div>
  );
}
