import { useTranslation } from "react-i18next";

import { ArcConfigSection } from "../../projects/slp-projects-contract";
import { useSlurpSettings } from "../../settings/slp-settings-contract";
import { useSlpViewerPersonaId } from "../slp-creators-hooks";
import { noteClass } from "../slp-creator-classes";
import type { SlpCreatorSettingsSectionProps } from "./slp-creator-settings-contract";

/**
 * This Creator's storyline overrides: how their storylines start and move, against the global
 * rules. They lived only on the Studio board, outside the Creator's own settings.
 */
export function SlpCreatorStorylinesSection({ creator }: SlpCreatorSettingsSectionProps) {
  const { t } = useTranslation();
  const settings = useSlurpSettings().data;
  const personaId = useSlpViewerPersonaId();
  if (!settings || !personaId)
    return <p className={noteClass}>{t("ui.slurp.settings.loading", { defaultValue: "Loading…" })}</p>;
  return (
    <div className="space-y-3">
      <p className={noteClass}>{t("ui.slurp.settings.creators.storylinesDetail")}</p>
      <ArcConfigSection
        personaId={personaId}
        creatorAccountId={creator.id}
        global={settings}
        library={settings.arcLibrary}
      />
    </div>
  );
}
