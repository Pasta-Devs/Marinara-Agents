import { BackstagePageHeader, SettingAnchor } from "../../modules/settings/SlpSettingsKit";
import { ArcLibraryEditor } from "./SlpArcLibraryEditor";
import { SlpStorylinesSwitch } from "./SlpStorylinesPanel";
import { slpExtensionOn } from "../../../../../shared/src/slp/slp-extensions.js";
import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";

/** Reusable Storyline types. Runtime behavior is configured under Posting. */
export function SlpProjectsPanel(page: SlpBackstagePageProps) {
  const { viewerPersonaId, t, updateSettings, settings, selectedCreatorId, update } = page;
  const header = (
    <BackstagePageHeader
      detail={t("ui.slurp.settings.planTemplates.detail", {
        defaultValue: "Reusable story structures. Each new Plan gets its own copy of a template.",
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
    <div className="space-y-6">
      {header}
      <SlpStorylinesSwitch {...page} />
      <SettingAnchor settingKey="arcLibrary">
        <ArcLibraryEditor
          library={settings.arcLibrary}
          tags={settings.discoveryTags.map((entry) => entry.tag)}
          busy={updateSettings.isPending}
          creatorAccountId={selectedCreatorId}
          personaId={viewerPersonaId}
          onChange={(arcLibrary) => update("arcLibrary", arcLibrary)}
        />
      </SettingAnchor>
    </div>
  );
}
