import { useState } from "react";
import type { SLURP_AUDIENCE_PRESETS } from "../../../../../shared/src/slp/slp-tuning.js";
import type { SlpBackstageSection, SlpBackstageTarget } from "../../base/navigation/slp-backstage-target";
import type { SlurpSettings } from "../settings/slp-settings-contract";
import type { SlurpAudienceCharacterSummary } from "./slp-audience-contract";
import { useSlurpAudienceCharacterGroups, useSlurpAudienceCharacters } from "./slp-audience-hooks";
import { useCreatorFanActivityStatus, useRefreshCreatorFanActivityNow } from "./slp-fan-activity-hooks";

/** Ambient audience status, the invited-character library and the audience wizard draft. */
export function useSlpAudienceBackstageState({
  section,
  target,
}: {
  section: SlpBackstageSection;
  target: SlpBackstageTarget;
}) {
  const fanStatusQuery = useCreatorFanActivityStatus(
    section === "overview" || target === "audience" || target === "basic",
  );
  const refreshFans = useRefreshCreatorFanActivityNow();
  // Only the Audience page lists characters (0.3.6: every Backstage page used to load them).
  const audienceCharactersQuery = useSlurpAudienceCharacters(target === "audience");
  const audienceCharacterGroupsQuery = useSlurpAudienceCharacterGroups(target === "audience");
  const [audienceWizardOpen, setAudienceWizardOpen] = useState(false);
  const [audienceDraft, setAudienceDraft] = useState<{
    preset: (typeof SLURP_AUDIENCE_PRESETS)[number];
    platformScale: SlurpSettings["platformScale"];
    audienceTone: SlurpSettings["audienceTone"];
  } | null>(null);
  const [reactionBankDraft, setReactionBankDraft] = useState<string | null>(null);

  const audienceCharacters =
    audienceCharactersQuery.data?.pages.flatMap(
      (page: { characters: SlurpAudienceCharacterSummary[] }) => page.characters,
    ) ?? [];
  const audienceCharacterGroups = audienceCharacterGroupsQuery.data?.groups ?? [];

  return {
    fanStatusQuery,
    refreshFans,
    audienceCharactersQuery,
    audienceCharacterGroupsQuery,
    audienceCharacters,
    audienceCharacterGroups,
    audienceWizardOpen,
    setAudienceWizardOpen,
    audienceDraft,
    setAudienceDraft,
    reactionBankDraft,
    setReactionBankDraft,
  };
}

export type SlpAudienceBackstageState = ReturnType<typeof useSlpAudienceBackstageState>;
