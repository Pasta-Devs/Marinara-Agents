import { useTranslation } from "react-i18next";

import { SlurpPlatformEventsSettings } from "./SlpPlatformEventsPanel";
import { SlpWorldTimeline } from "./SlpWorldTimeline";

import { SettingAnchor } from "../../modules/settings/SlpSettingsKit";
import { SlpExtensionSwitch } from "../../modules/settings/SlpExtensionSwitch";
import { Toggle } from "../../modules/settings/SlpSettingsControls";
import { slpExtensionOn } from "../../../../../shared/src/slp/slp-extensions.js";

import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";

/** Living world's switch, on top of each of its pages; the Events page also holds "Viral trends". */
export function SlpWorldSwitch({ settings, updateNow, trends = false }: SlpBackstagePageProps & { trends?: boolean }) {
  const { t } = useTranslation();
  return (
    <SlpExtensionSwitch
      settingKey="extWorld"
      label={t("ui.slurp.settings.ext.world.label", { defaultValue: "Living world" })}
      detail={t("ui.slurp.settings.ext.world.detail", {
        defaultValue: "Holidays and site events, the calendar, Slurp-wide events and viral trends.",
      })}
      on={slpExtensionOn(settings, "world")}
      onChange={(value) => void updateNow("extWorld", value)}
    >
      {trends && (
        <Toggle
          settingKey="trendsEnabled"
          label={t("ui.slurp.settings.ext.world.trends.label", { defaultValue: "Viral trends" })}
          detail={t("ui.slurp.settings.ext.world.trends.detail", {
            defaultValue: "A post that takes off can start a trend that other Creators join.",
          })}
          value={settings.trendsEnabled}
          onChange={(value) => void updateNow("trendsEnabled", value)}
        />
      )}
    </SlpExtensionSwitch>
  );
}

/** Platform events and holidays that change the world for a date range. */
export function SlpWorldEventsPanel(page: SlpBackstagePageProps) {
  const { updateSettings, settings, update } = page;
  const { t } = useTranslation();
  if (!slpExtensionOn(settings, "world"))
    return (
      <div className="space-y-5">
        <SlpWorldSwitch {...page} />
      </div>
    );

  return (
    <div className="space-y-8">
      <SlpWorldSwitch {...page} trends />
      {/* Events start in Stir: with Stir off there is nowhere to start one by hand. */}
      {slpExtensionOn(settings, "stir") && (
        <p className="text-xs leading-5 text-[var(--muted-foreground)]">
          {t("ui.slurp.settings.events.startMovedNote")}
        </p>
      )}
      <SettingAnchor settingKey="platformEvents">
        <SlurpPlatformEventsSettings
          events={settings.platformEvents}
          saving={updateSettings.isPending}
          onSave={(events) => update("platformEvents", events)}
          onStartInStir={
            slpExtensionOn(settings, "stir") ? () => page.onNavigate({ mode: "creator", view: "stir" }) : undefined
          }
        />
      </SettingAnchor>
      <SlpWorldTimeline />
    </div>
  );
}
