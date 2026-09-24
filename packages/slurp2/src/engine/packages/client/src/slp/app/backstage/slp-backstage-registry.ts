import type { SlpBackstagePanelEntry } from "../../features/backstage/slp-backstage-contract";
import { SlpAdsPanel } from "../../features/ads/SlpAdsPanel";
import { SlpAudiencePanel } from "../../features/audience/SlpAudiencePanel";
import { SlpBackstageAutomationPanel } from "../../features/backstage/SlpBackstageAutomationPanel";
import { SlpBackstageOverviewPanel } from "../../features/backstage/SlpBackstageOverviewPanel";
import { SlpBackstageWorldPanel } from "../../features/backstage/SlpBackstageWorldPanel";
import { SlpBackstageContentPanel } from "../../features/backstage/SlpBackstageContentPanel";
import { SlpCreatorImprovePanel } from "../../features/creators/SlpCreatorImprovePanel";
import { SlpCreatorsPanel } from "../../features/creators/SlpCreatorsPanel";
import { SlpDiscoveryPanel } from "../../features/discovery/SlpDiscoveryPanel";
import { SlpWalletPanel } from "../../features/economy/SlpWalletPanel";
import { SlpPublishingPanel } from "../../features/feed/SlpPublishingPanel";
import { SlpAutopurgePanel } from "../../features/maintenance/SlpAutopurgePanel";
import { SlpBackupPanel } from "../../features/maintenance/SlpBackupPanel";
import { SlpImagesPanel } from "../../features/media/SlpImagesPanel";
import { SlpConnectionsPanel } from "../../features/settings/SlpConnectionsPanel";
import { SlpMessagingPanel } from "../../features/messages/SlpMessagingPanel";
import { SlpProjectsPanel } from "../../features/projects/SlpProjectsPanel";
import { SlpPromptsPanel } from "../../features/settings/SlpPromptsPanel";
import { SlpWorldEventsPanel } from "../../features/world/SlpWorldEventsPanel";
import { SlpPacksPanel } from "../../features/world/SlpPacksPanel";
import { SlpCalendarPanel } from "../../features/world/SlpCalendarPanel";
import type { SlpBackstageTarget } from "../../base/navigation/slp-backstage-target";

/**
 * Every Backstage area and the panel that draws it, written out once.
 *
 * This list is the only way a target becomes a rendered page. There is no glob, no filesystem
 * discovery and no side-effect registration: a panel that is not named here does not exist, and a
 * target that is not named here fails the Backstage anchor regression. The registry lives in `app`
 * because naming every feature's panel is composition, which is what the app layer is for.
 */
export const SLP_BACKSTAGE_PANELS: readonly SlpBackstagePanelEntry[] = [
  { target: "overview", Component: SlpBackstageOverviewPanel },
  { target: "creators", Component: SlpCreatorsPanel },
  { target: "improve", Component: SlpCreatorImprovePanel },
  { target: "world", Component: SlpBackstageWorldPanel },
  { target: "content", Component: SlpBackstageContentPanel },
  { target: "tags", Component: SlpDiscoveryPanel },
  { target: "events", Component: SlpWorldEventsPanel },
  { target: "packs", Component: SlpPacksPanel },
  { target: "calendar", Component: SlpCalendarPanel },
  { target: "arcs", Component: SlpProjectsPanel },
  { target: "messaging", Component: SlpMessagingPanel },
  { target: "audience", Component: SlpAudiencePanel },
  { target: "ads", Component: SlpAdsPanel },
  { target: "wallet", Component: SlpWalletPanel },
  { target: "automation", Component: SlpBackstageAutomationPanel },
  { target: "general", Component: SlpPublishingPanel },
  { target: "images", Component: SlpImagesPanel },
  { target: "connections", Component: SlpConnectionsPanel },
  { target: "prompts", Component: SlpPromptsPanel },
  { target: "autopurge", Component: SlpAutopurgePanel },
  { target: "advanced", Component: SlpBackupPanel },
];

const byTarget = new Map(SLP_BACKSTAGE_PANELS.map((entry) => [entry.target, entry]));

/** The one lookup Backstage uses. An unknown target has no panel and the host falls back. */
export function slpBackstagePanelFor(target: SlpBackstageTarget): SlpBackstagePanelEntry | undefined {
  return byTarget.get(target);
}
