import { useSlpAdsBackstageState } from "../../features/ads/slp-ads-backstage-contract";
import { useSlpAudienceBackstageState } from "../../features/audience/slp-audience-backstage-contract";
import {
  useSlpBackstageHostState,
  type SlpBackstagePageProps,
  type SlpBackstageShellProps,
} from "../../features/backstage/slp-backstage-contract";
import { useSlpCreatorsBackstageState } from "../../features/creators/slp-creators-backstage-contract";
import { useSlpEconomyBackstageState } from "../../features/economy/slp-economy-backstage-contract";
import { useSlpFeedBackstageState } from "../../features/feed/slp-feed-backstage-contract";
import { useSlpMaintenanceBackstageState } from "../../features/maintenance/slp-maintenance-backstage-contract";
import { useSlpMediaBackstageState } from "../../features/media/slp-media-backstage-contract";
import { useSlpMessagesBackstageState } from "../../features/messages/slp-messages-backstage-contract";
import { useSlpPromptsBackstageState } from "../../features/settings/slp-prompts-backstage-contract";
import { useSlpSettingsDraft } from "../../features/settings/slp-settings-backstage-contract";
import type { SlurpSettings } from "../../features/settings/slp-settings-contract";

/**
 * Composition only. Each feature owns its own Backstage queries, mutations and drafts; this hook
 * wires them together and hands panels one flat context. It must not gain feature logic: a new
 * Backstage need belongs in that feature's `slp-<feature>-backstage-contract.ts`.
 */
export function useSlpBackstageController(
  props: SlpBackstageShellProps,
): Omit<SlpBackstagePageProps, "settings" | "audiencePreset"> & { settings: SlurpSettings | undefined } {
  const host = useSlpBackstageHostState(props);
  const { section, target } = host;
  const draft = useSlpSettingsDraft({ section });
  const { settings, save, restore } = draft;

  const creators = useSlpCreatorsBackstageState({
    section,
    personaSourceIds: props.personaSourceIds,
    setRefreshRemaining: host.setRefreshRemaining,
  });
  const feed = useSlpFeedBackstageState({
    section,
    scheduleCreatorId: creators.scheduleCreatorId,
    automationCreators: creators.automationCreators,
    settings,
  });
  const media = useSlpMediaBackstageState({ section, target, creators: creators.creators });
  const ads = useSlpAdsBackstageState(target, props.viewerPersonaId);
  const audience = useSlpAudienceBackstageState({ section, target });
  const messages = useSlpMessagesBackstageState();
  const economy = useSlpEconomyBackstageState();
  const maintenance = useSlpMaintenanceBackstageState({ section, target, settings, save });
  const prompts = useSlpPromptsBackstageState({ settings, save, restore });

  return {
    ...host,
    ...draft,
    ...creators,
    ...feed,
    ...media,
    ...ads,
    ...audience,
    ...messages,
    ...economy,
    ...maintenance,
    ...prompts,
    settings,
    openRefresh: () => host.openRefreshFor(feed.autoPostingCreators, creators.automationCreators),
  };
}
