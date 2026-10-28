import { BackstagePageHeader, SettingAnchor } from "../../modules/settings/SlpSettingsKit";
import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";
import { SlpContentPacksSection } from "./SlpContentPacksSection";
import { SlpStoryPacksPanel } from "./SlpStoryPacksPanel";

export function SlpPacksPanel({ settings, update }: SlpBackstagePageProps) {
  return (
    <div className="space-y-8">
      <BackstagePageHeader detail="Turn on what your Slurp should have. Each Creator only joins what fits them." />
      <SettingAnchor settingKey="contentPacks">
        <SlpContentPacksSection
          toggles={settings.contentPacks ?? {}}
          onChange={(next) => update("contentPacks", next)}
        />
      </SettingAnchor>
      <SlpStoryPacksPanel arcs={settings.arcLibrary} events={settings.platformEvents} />
    </div>
  );
}
