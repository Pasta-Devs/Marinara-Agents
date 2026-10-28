import { useTranslation } from "react-i18next";
import { SettingsGroup, Toggle } from "../../modules/settings/SlpSettingsControls";
import { BackstagePageHeader } from "../../modules/settings/SlpSettingsKit";
import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";
import { SlpDramaSettings } from "./SlpDramaSettings";
import { SlpStorylinesSwitch } from "../projects/slp-projects-contract";
import { slpExtensionOn } from "../../../../../shared/src/slp/slp-extensions.js";

/** Storylines › Drama & love: who may pair up, and the drama between Creators. */
export function SlpDramaLovePanel(page: SlpBackstagePageProps) {
  const { settings, update } = page;
  const { t } = useTranslation();
  const tx = (key: string, defaultValue: string) => t(`ui.slurp.stir.settings.${key}`, { defaultValue });
  const header = (
    <BackstagePageHeader
      detail={t("ui.slurp.settings.dramaLove.detail", {
        defaultValue: "Couples, crushes and fights between Creators, and how far love may go.",
      })}
    />
  );
  if (!slpExtensionOn(settings, "storylines"))
    return (
      <div className="space-y-5">
        {header}
        <SlpStorylinesSwitch {...page} />
      </div>
    );
  return (
    <div className="space-y-5">
      {header}
      <SlpStorylinesSwitch {...page} />
      <SettingsGroup title={tx("groupLove", "Love")}>
        <Toggle
          settingKey="polyamory"
          label={tx("polyamory", "Polyamory")}
          detail={tx(
            "polyamoryDetail",
            "A couple can grow to three or four, and a polyamorous Creator can be in more than one couple. Each Creator's style is in their steering: from their card, monogamous or polyamorous.",
          )}
          value={settings.polyamory}
          onChange={(value) => update("polyamory", value)}
        />
      </SettingsGroup>
      <SlpDramaSettings {...page} settingKey="drama" />
    </div>
  );
}
