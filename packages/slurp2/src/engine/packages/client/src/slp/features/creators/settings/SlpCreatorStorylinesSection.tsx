import { useTranslation } from "react-i18next";

import { SlurpProjectsPanel } from "../../projects/slp-projects-contract";
import { useSlurpSettings } from "../../settings/slp-settings-contract";
import { useCreatorAccounts, useSlpViewerPersonaId } from "../slp-creators-hooks";
import { noteClass } from "../slp-creator-classes";
import type { SlpCreatorSettingsSectionProps } from "./slp-creator-settings-contract";
import { SlpCreatorLifeCard } from "../SlpCreatorLifeCard";

/**
 * This Creator's storylines: the running ones with accept / dismiss / direct / end, a new one, and
 * the overrides for how they start and move. The board used to live only in the Studio, which lists
 * persona Creators, so a character Creator's suggestions waited forever (R1-063).
 */
export function SlpCreatorStorylinesSection({ creator }: SlpCreatorSettingsSectionProps) {
  const { t } = useTranslation();
  const settings = useSlurpSettings().data;
  const personaId = useSlpViewerPersonaId();
  const others = (useCreatorAccounts().data ?? [])
    .filter((other) => other.id !== creator.id)
    .map((other) => ({ id: other.id, displayName: other.displayName }));
  if (!settings || !personaId)
    return <p className={noteClass}>{t("ui.slurp.settings.loading", { defaultValue: "Loading…" })}</p>;
  return (
    <div className="space-y-3">
      <p className={noteClass}>{t("ui.slurp.settings.creators.storylinesDetail")}</p>
      <SlpCreatorLifeCard creatorId={creator.id} name={creator.displayName} />
      <SlurpProjectsPanel personaId={personaId} creatorAccountId={creator.id} otherCreators={others} />
    </div>
  );
}
