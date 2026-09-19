import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { SlpCreatorManagedStageProfile } from "../../../../../shared/src/slp/slp-social.types.js";
import { SLURP_ACTIVITY_PRESETS, slurpActivityPresetForSettings } from "../../modules/creator/slp-activity-presets";
import type { SlpBackstageSection } from "../../base/navigation/slp-backstage-target";
import type { SlurpSettings } from "../settings/slp-settings-contract";
import {
  useCreatorReserveStatus,
  useUpdateCreatorAutoPosting,
  useUpdateCreatorScheduleSlot,
} from "./slp-feed-schedule-hooks";

/** Publishing schedule, pace and the automation-page wizard state Backstage drives. */
export function useSlpFeedBackstageState({
  section,
  scheduleCreatorId,
  automationCreators,
  settings,
}: {
  section: SlpBackstageSection;
  scheduleCreatorId: string | null;
  automationCreators: SlpCreatorManagedStageProfile[];
  settings: SlurpSettings | undefined;
}) {
  const { t } = useTranslation();
  const reserveStatusQuery = useCreatorReserveStatus(section === "overview" || section === "creators");
  const updateAuto = useUpdateCreatorAutoPosting();
  const updateScheduleSlot = useUpdateCreatorScheduleSlot();
  const [customPaceOpen, setCustomPaceOpen] = useState(false);
  const [paceWizardOpen, setPaceWizardOpen] = useState(false);
  const [schedulesRefreshing, setSchedulesRefreshing] = useState(false);
  const [paceDraft, setPaceDraft] = useState<{
    preset: (typeof SLURP_ACTIVITY_PRESETS)[number] | null;
    postsPerDay: number;
    nightQuiet: boolean;
    storyRate: SlurpSettings["storyRate"];
  } | null>(null);

  const scheduleSlots =
    reserveStatusQuery.data?.creators.find((creator) => creator.accountId === scheduleCreatorId)?.slots ?? [];
  const autoPostingCreators = automationCreators.filter((creator) => creator.autoPosting.enabled);
  const automaticPublishingActive = settings?.autoPostingScheduleEnabled && autoPostingCreators.length > 0;
  const activityPreset = settings && slurpActivityPresetForSettings(settings);
  const paceLabel = activityPreset
    ? t(`ui.slurp.settings.presets.${activityPreset}`)
    : t("ui.slurp.settings.presets.custom");

  return {
    reserveStatusQuery,
    updateAuto,
    updateScheduleSlot,
    customPaceOpen,
    setCustomPaceOpen,
    paceWizardOpen,
    setPaceWizardOpen,
    schedulesRefreshing,
    setSchedulesRefreshing,
    paceDraft,
    setPaceDraft,
    scheduleSlots,
    autoPostingCreators,
    automaticPublishingActive,
    activityPreset,
    paceLabel,
  };
}

export type SlpFeedBackstageState = ReturnType<typeof useSlpFeedBackstageState>;
