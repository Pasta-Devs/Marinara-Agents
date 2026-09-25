import { useTranslation } from "react-i18next";

import { SlurpPlatformEventsSettings } from "./SlpPlatformEventsPanel";

import { SettingAnchor } from "../../modules/settings/SlpSettingsKit";

import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";

/** Platform events and holidays that change the world for a date range. */
export function SlpWorldEventsPanel(page: SlpBackstagePageProps) {
  const { updateSettings, settings, update } = page;
  const { t } = useTranslation();

  return (
    <div className="space-y-10">
      <p className="text-xs leading-5 text-[var(--muted-foreground)]">{t("ui.slurp.settings.events.startMovedNote")}</p>
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
