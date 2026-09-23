import { BackstagePageHeader, SettingAnchor } from "../../modules/settings/SlpSettingsKit";
import { ArcLibraryEditor } from "./SlpArcLibraryEditor";
import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";

/** Reusable Plan templates. Runtime behavior is configured under Publishing and automation. */
export function SlpProjectsPanel(page: SlpBackstagePageProps) {
  const { viewerPersonaId, t, updateSettings, settings, selectedCreatorId, update } = page;

  return (
    <div className="space-y-6">
      <BackstagePageHeader
        title={t("ui.slurp.settings.planTemplates.title", { defaultValue: "Plan templates" })}
        detail={t("ui.slurp.settings.planTemplates.detail", {
          defaultValue: "Reusable story structures. Each new Plan gets its own copy of a template.",
        })}
      />
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
