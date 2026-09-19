import { SlurpTagsSettings } from "./SlpTagsPanel";

import { SettingAnchor } from "../../modules/settings/SlpSettingsKit";

import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";

/** Discovery tags: the categories a Creator's posts can be found under. */
export function SlpDiscoveryPanel(page: SlpBackstagePageProps) {
  const { updateSettings, settings, update } = page;

  return (
    <SettingAnchor settingKey="discoveryTags">
      <SlurpTagsSettings
        tags={settings.discoveryTags}
        saving={updateSettings.isPending}
        onSave={(tags) => update("discoveryTags", tags)}
      />
    </SettingAnchor>
  );
}
