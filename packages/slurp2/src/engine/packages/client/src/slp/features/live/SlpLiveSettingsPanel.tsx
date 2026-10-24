import { useTranslation } from "react-i18next";
import { RangeSetting } from "../../modules/settings/SlpSettingsControls";
import { BackstagePageHeader, SettingAnchor } from "../../modules/settings/SlpSettingsKit";
import { ChoiceSetting } from "../../modules/settings/SlpSettingsInputs";
import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";
import { SlpExtensionSwitch } from "../../modules/settings/SlpExtensionSwitch";
import { slpExtensionOn } from "../../../../../shared/src/slp/slp-extensions.js";

/** Settings › Live shows: the switch, then when Creators go live on their own and for how long. */
export function SlpLiveSettingsPanel({ settings, updateNow }: SlpBackstagePageProps) {
  const { t } = useTranslation();
  const tx = (key: string, defaultValue: string, values?: Record<string, unknown>) =>
    t(`ui.slurp.settings.overview.yours.${key}`, { defaultValue, ...values });
  const hour = (value: number) => `${String(value).padStart(2, "0")}:00`;
  const minutes = (count: number) => tx("liveMinutes", "{{count}} min", { count });
  return (
    <div className="space-y-5">
      <BackstagePageHeader
        detail={t("ui.slurp.settings.live.detail", {
          defaultValue: "Cam shows on the fan pages: a moving chat, tips toward a goal, a tip menu and private shows.",
        })}
      />
      <SlpExtensionSwitch
        settingKey="extLive"
        label={t("ui.slurp.settings.ext.live.label", { defaultValue: "Live shows" })}
        detail={t("ui.slurp.settings.ext.live.detail", {
          defaultValue: "Creators go live on their own schedule, from Stir > Go live, and you can host from your page.",
        })}
        on={slpExtensionOn(settings, "live")}
        onChange={(value) => void updateNow("extLive", value)}
      >
        <ChoiceSetting
          settingKey="liveFrequency"
          label={tx("liveFrequency", "Live shows: how often")}
          options={(["rare", "normal", "often"] as const).map((value) => ({
            value,
            label: tx(`liveFrequency${value.charAt(0).toUpperCase()}${value.slice(1)}`, value),
          }))}
          value={settings.liveFrequency}
          onChange={(value) => void updateNow("liveFrequency", value)}
        />
        <SettingAnchor settingKey="liveStartHour">
          <RangeSetting
            label={tx("liveFrom", "From")}
            value={settings.liveStartHour}
            min={0}
            max={settings.liveEndHour - 1}
            format={hour}
            onSave={(value) => void updateNow("liveStartHour", value)}
          />
        </SettingAnchor>
        <SettingAnchor settingKey="liveEndHour">
          <RangeSetting
            label={tx("liveUntil", "Until")}
            value={settings.liveEndHour}
            min={settings.liveStartHour + 1}
            max={24}
            format={hour}
            onSave={(value) => void updateNow("liveEndHour", value)}
          />
        </SettingAnchor>
        <SettingAnchor settingKey="liveMinMinutes">
          <RangeSetting
            label={tx("liveMin", "Minimum")}
            value={settings.liveMinMinutes}
            min={10}
            max={settings.liveMaxMinutes}
            format={minutes}
            onSave={(value) => void updateNow("liveMinMinutes", value)}
          />
        </SettingAnchor>
        <SettingAnchor settingKey="liveMaxMinutes">
          <RangeSetting
            label={tx("liveMax", "Maximum")}
            value={settings.liveMaxMinutes}
            min={settings.liveMinMinutes}
            max={120}
            format={minutes}
            onSave={(value) => void updateNow("liveMaxMinutes", value)}
          />
        </SettingAnchor>
      </SlpExtensionSwitch>
    </div>
  );
}
