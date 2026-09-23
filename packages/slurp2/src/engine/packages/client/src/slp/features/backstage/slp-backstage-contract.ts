import { useState, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import type { SlpCreatorManagedStageProfile } from "../../../../../shared/src/slp/slp-social.types.js";
import type { SlurpNavigationState } from "../../base/navigation/slp-navigation.types";
import type { slurpAudiencePresetFor } from "../../../../../shared/src/slp/slp-tuning.js";
import type { SlpAdsBackstageState } from "../ads/slp-ads-backstage-contract";
import type { SlpAudienceBackstageState } from "../audience/slp-audience-backstage-contract";
import type { SlpCreatorsBackstageState } from "../creators/slp-creators-backstage-contract";
import type { SlpEconomyBackstageState } from "../economy/slp-economy-backstage-contract";
import type { SlpFeedBackstageState } from "../feed/slp-feed-backstage-contract";
import type { SlpMaintenanceBackstageState } from "../maintenance/slp-maintenance-backstage-contract";
import type { SlpMediaBackstageState } from "../media/slp-media-backstage-contract";
import type { SlpMessagesBackstageState } from "../messages/slp-messages-backstage-contract";
import type { SlpPromptsBackstageState } from "../settings/slp-prompts-backstage-contract";
import type { SlpSettingsDraftState } from "../settings/slp-settings-backstage-contract";
import type { SlpProjectsBackstageState } from "../projects/slp-projects-backstage-contract";
import type { SlurpSettings } from "../settings/slp-settings-contract";
import {
  SLP_BACKSTAGE_DEFAULT_TARGET,
  SLP_BACKSTAGE_TARGETS_BY_SECTION,
  type SlpBackstageTarget,
} from "../../base/navigation/slp-backstage-target";

export type SlpBackstageShellProps = {
  navigation: Extract<SlurpNavigationState, { mode: "creator-settings" }>;
  onNavigate: (navigation: SlurpNavigationState) => void;
  onAddCreators: () => void;
  personaSourceIds: ReadonlySet<string>;
  onRestartOnboarding: () => void;
  viewerPersonaId: string | null;
};

/**
 * What the Backstage host itself owns: which area is open, the callbacks into the surrounding app,
 * and the "create posts now" modal the Automation and Creators panels open. Everything else on the
 * page context is composed from a feature's own Backstage contract.
 */
export function useSlpBackstageHostState(props: SlpBackstageShellProps) {
  const { t, i18n } = useTranslation();
  const section = props.navigation.section ?? "overview";
  const target =
    props.navigation.target && SLP_BACKSTAGE_TARGETS_BY_SECTION[section].includes(props.navigation.target)
      ? props.navigation.target
      : SLP_BACKSTAGE_DEFAULT_TARGET[section];
  const [refreshModalOpen, setRefreshModalOpen] = useState(false);
  const [refreshAccountIds, setRefreshAccountIds] = useState<Set<string>>(new Set());
  const [refreshRemaining, setRefreshRemaining] = useState(0);
  const [refreshAccess, setRefreshAccess] = useState<"public" | "locked">("locked");

  const openRefreshFor = (
    autoPostingCreators: SlpCreatorManagedStageProfile[],
    automationCreators: SlpCreatorManagedStageProfile[],
  ) => {
    setRefreshAccountIds(
      new Set((autoPostingCreators.length > 0 ? autoPostingCreators : automationCreators).map((creator) => creator.id)),
    );
    setRefreshAccess("locked");
    setRefreshModalOpen(true);
  };

  return {
    ...props,
    t,
    i18n,
    section,
    target,
    refreshModalOpen,
    setRefreshModalOpen,
    refreshAccountIds,
    setRefreshAccountIds,
    refreshRemaining,
    setRefreshRemaining,
    refreshAccess,
    setRefreshAccess,
    openRefreshFor,
  };
}

export type SlpBackstageHostState = ReturnType<typeof useSlpBackstageHostState>;

/**
 * The single host contract every Backstage panel receives. Panels read it; they never reach into
 * the host's internals or into another feature's files.
 */
export type SlpBackstagePageProps = SlpBackstageHostState &
  SlpSettingsDraftState &
  SlpAdsBackstageState &
  SlpAudienceBackstageState &
  SlpCreatorsBackstageState &
  SlpEconomyBackstageState &
  SlpFeedBackstageState &
  SlpMaintenanceBackstageState &
  SlpMediaBackstageState &
  SlpMessagesBackstageState &
  SlpPromptsBackstageState &
  SlpProjectsBackstageState & {
    settings: SlurpSettings;
    audiencePreset: ReturnType<typeof slurpAudiencePresetFor>;
    openRefresh: () => void;
  };

/** One Backstage area and the panel that renders it. The registry is a list of these and nothing else. */
export type SlpBackstagePanelEntry = {
  target: SlpBackstageTarget;
  Component: ComponentType<SlpBackstagePageProps>;
};
