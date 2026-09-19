import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Source-reading tests name Slurp2 files by their historical paths. Those paths are logical module
 * keys: when a monolith is split, its key maps to every file that now holds it, so a negative
 * assertion stays module-wide instead of passing vacuously against one fragment.
 *
 * Keys are relative to `packages/slurp2/src/engine/`. Until a file moves, its key maps to itself.
 * Unmapped paths under a moved directory are not redirected; add a key for each moved file.
 */
export const SLURP2_SOURCE_MODULES: Record<string, readonly string[]> = {
  "packages/client/src/components/slurp/SlurpHome.tsx": [
    "packages/client/src/slp/app/SlpRouter.tsx",
    "packages/client/src/slp/app/SlpApp.tsx",
    // Original order: the Home state and its actions come before the JSX that renders them.
    "packages/client/src/slp/app/slp-home-state.ts",
    "packages/client/src/slp/app/slp-home-post-actions.ts",
    "packages/client/src/slp/app/slp-home-actions.ts",
    "packages/client/src/slp/app/SlpHomeHost.tsx",
    "packages/client/src/slp/app/screens/SlpHomeCreatorFlow.tsx",
    "packages/client/src/slp/app/screens/SlpHomeDestinations.tsx",
    "packages/client/src/slp/app/screens/SlpHomeFeedRail.tsx",
    "packages/client/src/slp/app/screens/SlpScreenComposer.tsx",
    "packages/client/src/slp/app/screens/SlpScreenMoments.tsx",
    "packages/client/src/slp/app/screens/SlpScreenSubscriptions.tsx",
    "packages/client/src/slp/app/screens/SlpScreenSuggestedCreators.tsx",
    "packages/client/src/slp/app/screens/slp-hub-view.ts",
    "packages/client/src/slp/app/screens/slp-hub-discovery-filters.ts",
    "packages/client/src/slp/app/screens/slp-profile-view-model.ts",
    "packages/client/src/slp/app/screens/SlpProfileModals.tsx",
    "packages/client/src/slp/app/screens/SlpProfilePostCards.tsx",
    "packages/client/src/slp/app/screens/SlpHomeHelpers.tsx",
    "packages/client/src/slp/app/screens/SlpScreenCreateProfile.tsx",
    "packages/client/src/slp/app/screens/SlpScreenHub.tsx",
    "packages/client/src/slp/app/screens/SlpHubDiscover.tsx",
    "packages/client/src/slp/app/screens/SlpScreenMessages.tsx",
    "packages/client/src/slp/app/screens/SlpScreenProfile.tsx",
    // The follow toggle sits in the leading actions the profile screen passes to its surface.
    "packages/client/src/slp/app/screens/SlpProfileLeadingActions.tsx",
    "packages/client/src/slp/app/screens/SlpScreenStudio.tsx",
    "packages/client/src/slp/app/screens/SlpScreenWallet.tsx",
    "packages/client/src/slp/modules/story/SlpStoryTile.tsx",
  ],
  // Slice 9 split Backstage into a thin host, an explicit panel registry and feature-owned panels.
  "packages/client/src/components/slurp/SlurpSettings.tsx": [
    "packages/client/src/slp/app/backstage/SlpBackstageShell.tsx",
    "packages/client/src/slp/app/backstage/slp-backstage-controller.ts",
    "packages/client/src/slp/app/backstage/slp-backstage-registry.ts",
    "packages/client/src/slp/features/backstage/slp-backstage-contract.ts",
    "packages/client/src/slp/features/backstage/SlpBackstageSidebar.tsx",
    "packages/client/src/slp/features/settings/slp-settings-backstage-contract.ts",
    "packages/client/src/slp/features/settings/slp-prompts-backstage-contract.ts",
    "packages/client/src/slp/features/settings/SlpPromptEditors.tsx",
    "packages/client/src/slp/features/ads/slp-ads-backstage-contract.ts",
    "packages/client/src/slp/features/audience/slp-audience-backstage-contract.ts",
    "packages/client/src/slp/features/creators/slp-creators-backstage-contract.ts",
    "packages/client/src/slp/features/creators/SlpCreatorRefreshModal.tsx",
    "packages/client/src/slp/features/economy/slp-economy-backstage-contract.ts",
    "packages/client/src/slp/features/feed/slp-feed-backstage-contract.ts",
    "packages/client/src/slp/features/feed/SlpCreatorScheduleModal.tsx",
    "packages/client/src/slp/features/maintenance/slp-maintenance-backstage-contract.ts",
    "packages/client/src/slp/features/media/slp-media-backstage-contract.ts",
    "packages/client/src/slp/features/messages/slp-messages-backstage-contract.ts",
  ],
  "packages/client/src/components/slurp/SlurpBackstageOverview.tsx": [
    "packages/client/src/slp/features/backstage/SlpBackstageOverviewPanel.tsx",
  ],
  "packages/client/src/components/slurp/SlurpBackstageCreators.tsx": [
    "packages/client/src/slp/features/creators/SlpCreatorsPanel.tsx",
    "packages/client/src/slp/features/creators/SlpCreatorMetrics.tsx",
    "packages/client/src/slp/features/creators/SlpCreatorImprovePanel.tsx",
    "packages/client/src/slp/features/creators/slp-creator-classes.ts",
  ],
  "packages/client/src/components/slurp/SlurpBackstageWorld.tsx": [
    "packages/client/src/slp/features/backstage/SlpBackstageWorldPanel.tsx",
    "packages/client/src/slp/features/discovery/SlpDiscoveryPanel.tsx",
    "packages/client/src/slp/features/world/SlpWorldEventsPanel.tsx",
    "packages/client/src/slp/features/projects/SlpProjectsPanel.tsx",
    "packages/client/src/slp/features/messages/SlpMessagingPanel.tsx",
    "packages/client/src/slp/features/economy/SlpWalletPanel.tsx",
    "packages/client/src/slp/features/ads/SlpAdsPanel.tsx",
    "packages/client/src/slp/features/audience/SlpAudiencePanel.tsx",
  ],
  "packages/client/src/components/slurp/SlurpBackstageAutomation.tsx": [
    "packages/client/src/slp/features/backstage/SlpBackstageAutomationPanel.tsx",
    "packages/client/src/slp/features/feed/SlpPublishingPanel.tsx",
    "packages/client/src/slp/features/media/SlpImagesPanel.tsx",
  ],
  "packages/client/src/components/slurp/SlurpBackstagePrompts.tsx": [
    "packages/client/src/slp/features/settings/SlpPromptsPanel.tsx",
  ],
  "packages/client/src/components/slurp/SlurpBackstageMaintenance.tsx": [
    "packages/client/src/slp/features/maintenance/SlpAutopurgePanel.tsx",
    "packages/client/src/slp/features/maintenance/SlpBackupPanel.tsx",
    "packages/client/src/slp/features/maintenance/SlpMaintenanceTask.tsx",
  ],
  "packages/client/src/components/slurp/SlurpBackstageChrome.tsx": [
    "packages/client/src/slp/features/backstage/SlpBackstageNavigation.tsx",
    "packages/client/src/slp/features/backstage/SlpBackstagePreview.tsx",
    "packages/client/src/slp/features/backstage/SlpBackstageControls.tsx",
  ],
  "packages/client/src/components/slurp/SlurpBackstageKit.tsx": [
    "packages/client/src/slp/modules/settings/SlpSettingsKit.tsx",
  ],
  "packages/client/src/components/slurp/SlurpSettingsControls.tsx": [
    "packages/client/src/slp/modules/settings/SlpSettingsControls.tsx",
  ],
  "packages/client/src/components/slurp/slurp-backstage.ts": [
    "packages/client/src/slp/base/navigation/slp-backstage-target.ts",
    "packages/client/src/slp/features/backstage/slp-backstage-placement.ts",
  ],
  "packages/client/src/components/slurp/SlurpMessages.tsx": [
    "packages/client/src/slp/features/messages/SlpMessages.tsx",
    "packages/client/src/slp/features/messages/commissions/SlpCommissions.tsx",
    "packages/client/src/slp/features/messages/SlpMessageInsights.tsx",
    "packages/client/src/slp/features/messages/SlpMessageInsightParts.tsx",
    "packages/client/src/slp/features/messages/SlpThreadView.tsx",
    "packages/client/src/slp/features/messages/slp-thread-view-model.ts",
    "packages/client/src/slp/features/messages/slp-thread-actions.ts",
    "packages/client/src/slp/features/messages/SlpThreadHeader.tsx",
    "packages/client/src/slp/features/messages/SlpThreadComposer.tsx",
    "packages/client/src/slp/features/messages/SlpThreadDrawer.tsx",
    "packages/client/src/slp/features/messages/SlpThreadChrome.tsx",
    "packages/client/src/slp/features/messages/SlpMemoriesPanel.tsx",
    "packages/client/src/slp/features/messages/SlpMessageBubble.tsx",
    "packages/client/src/slp/features/messages/SlpMessageTools.tsx",
  ],
  "packages/client/src/components/slurp/SlurpPostCard.tsx": [
    "packages/client/src/slp/modules/post/SlpPostCard.tsx",
    "packages/client/src/slp/modules/post/SlpPostHelpers.tsx",
    "packages/client/src/slp/modules/post/SlpPostTypes.tsx",
    "packages/client/src/slp/modules/post/SlpPostHooks.tsx",
    "packages/client/src/slp/modules/post/SlpPostComposerTools.tsx",
    "packages/client/src/slp/modules/post/SlpMarkdownRenderer.tsx",
    "packages/client/src/slp/modules/post/SlpPollCard.tsx",
    "packages/client/src/slp/modules/post/SlpPostImageEditControls.tsx",
    "packages/client/src/slp/modules/post/SlpPostReplyRow.tsx",
    "packages/client/src/slp/modules/post/SlpPostReplyComposer.tsx",
    "packages/client/src/slp/modules/post/SlpPostComposerShell.tsx",
  ],
  "packages/client/src/components/slurp/SlurpCreatorPostCard.tsx": [
    "packages/client/src/slp/modules/post/SlpCreatorPostCard.tsx",
    "packages/client/src/slp/modules/post/SlpCreatorPostMenu.tsx",
    "packages/client/src/slp/modules/post/SlpReplyRow.tsx",
    "packages/client/src/slp/modules/post/SlpReplyComposer.tsx",
    "packages/client/src/slp/modules/post/SlpLockedPostCard.tsx",
  ],
  "packages/client/src/components/slurp/SlurpOnboardingPanel.tsx": [
    "packages/client/src/slp/features/onboarding/SlpOnboardingPanel.tsx",
    "packages/client/src/slp/features/onboarding/slp-onboarding-wizard-model.ts",
    "packages/client/src/slp/features/onboarding/SlpOnboardingSteps.tsx",
  ],
  "packages/client/src/components/slurp/SlurpStageProfileForm.tsx": [
    "packages/client/src/slp/features/creators/SlpStageProfileForm.tsx",
  ],
  "packages/client/src/components/slurp/SlurpCreatorProfileEditor.tsx": [
    "packages/client/src/slp/features/creators/SlpCreatorProfileEditor.tsx",
  ],
  "packages/client/src/components/slurp/SlurpCoin.tsx": ["packages/client/src/slp/modules/coin/SlpCoin.tsx"],
  "packages/client/src/components/slurp/SlurpPollComposer.tsx": [
    "packages/client/src/slp/modules/poll/SlpPollComposer.tsx",
  ],
  "packages/client/src/hooks/use-slurp.ts": [
    "packages/client/src/slp/base/state/slp-query-keys.ts",
    "packages/client/src/slp/base/state/slp-state-types.ts",
    "packages/client/src/slp/base/state/slp-page-cursor.ts",
    "packages/client/src/slp/base/state/slp-host-connections.ts",
    "packages/client/src/slp/features/ads/slp-ads-contract.ts",
    "packages/client/src/slp/features/ads/slp-ads-hooks.ts",
    "packages/client/src/slp/features/settings/slp-settings-contract.ts",
    "packages/client/src/slp/features/settings/slp-settings-hooks.ts",
    "packages/client/src/slp/features/media/slp-image-connection-hooks.ts",
    "packages/client/src/slp/features/settings/slp-post-guidance-contract.ts",
    "packages/client/src/slp/features/maintenance/slp-backup.ts",
    "packages/client/src/slp/features/maintenance/slp-maintenance-hooks.ts",
    "packages/client/src/slp/features/maintenance/slp-improvement-hooks.ts",
    "packages/client/src/slp/features/discovery/slp-discovery-tag-hooks.ts",
    "packages/client/src/slp/features/creators/slp-creators-contract.ts",
    "packages/client/src/slp/features/creators/slp-creators-hooks.ts",
    "packages/client/src/slp/features/creators/slp-creator-profile-hooks.ts",
    "packages/client/src/slp/features/creators/slp-creator-refresh-hooks.ts",
    "packages/client/src/slp/features/audience/slp-audience-contract.ts",
    "packages/client/src/slp/features/audience/slp-audience-hooks.ts",
    "packages/client/src/slp/features/audience/slp-ambient-profile-hooks.ts",
    "packages/client/src/slp/features/audience/slp-fan-activity-hooks.ts",
    "packages/client/src/slp/features/economy/slp-economy-contract.ts",
    "packages/client/src/slp/features/economy/slp-economy-hooks.ts",
    "packages/client/src/slp/features/notifications/slp-notifications-contract.ts",
    "packages/client/src/slp/features/notifications/slp-notification-hooks.ts",
    "packages/client/src/slp/features/projects/slp-projects-contract.ts",
    "packages/client/src/slp/features/projects/slp-projects-hooks.ts",
    "packages/client/src/slp/features/feed/slp-feed-contract.ts",
    "packages/client/src/slp/features/feed/slp-feed-post-hooks.ts",
    "packages/client/src/slp/features/feed/slp-feed-viewer-hooks.ts",
    "packages/client/src/slp/features/feed/slp-feed-schedule-hooks.ts",
    "packages/client/src/slp/features/onboarding/slp-first-post-hooks.ts",
    "packages/client/src/slp/features/messages/slp-messages-contract.ts",
    "packages/client/src/slp/features/messages/slp-message-keys.ts",
    "packages/client/src/slp/features/messages/slp-messages-hooks.ts",
    "packages/client/src/slp/features/messages/slp-message-action-hooks.ts",
    "packages/client/src/slp/features/messages/commissions/slp-commission-hooks.ts",
  ],
  "packages/client/src/stores/slurp-package.store.ts": ["packages/client/src/slp/base/state/slp-package-store.ts"],
  "packages/client/src/hooks/use-slurp-media-src.ts": ["packages/client/src/slp/base/media/slp-media-src.ts"],
  "packages/client/src/lib/slurp-discovery.ts": ["packages/client/src/slp/features/discovery/slp-discovery.ts"],
  "packages/client/src/lib/slurp-refresh-batch.ts": ["packages/client/src/slp/features/creators/slp-refresh-batch.ts"],
  "packages/server/src/routes/slurp.routes.ts": [
    "packages/server/src/slp/modules/requests/slp-request-schemas.ts",
    "packages/server/src/slp/base/host/slp-multipart.ts",
    "packages/server/src/slp/features/viewer/slp-route-host.ts",
    "packages/server/src/slp/features/settings/slp-settings-routes.ts",
    "packages/server/src/slp/features/audience/slp-audience-routes.ts",
    "packages/server/src/slp/features/maintenance/slp-maintenance-routes.ts",
    "packages/server/src/slp/features/projects/slp-projects-routes.ts",
    "packages/server/src/slp/features/discovery/slp-discovery-routes.ts",
    "packages/server/src/slp/features/creators/slp-creators-routes.ts",
    "packages/server/src/slp/features/creators/improvement/slp-improvement-jobs.ts",
    "packages/server/src/slp/features/creators/improvement/slp-improvement-routes.ts",
    "packages/server/src/slp/features/maintenance/slp-backup-jobs.ts",
    "packages/server/src/slp/features/maintenance/slp-backup-routes.ts",
    "packages/server/src/slp/features/economy/slp-wallet-routes.ts",
    "packages/server/src/slp/features/media/slp-media-routes.ts",
    "packages/server/src/slp/features/viewer/slp-viewer-context.ts",
    "packages/server/src/slp/features/notifications/slp-notifications-routes.ts",
    "packages/server/src/slp/features/notifications/slp-notification-read-model.ts",
    "packages/server/src/slp/workflows/slp-world-tick-workflow.ts",
    "packages/server/src/slp/features/economy/slp-studio-routes.ts",
    "packages/server/src/slp/features/feed/slp-feed-viewer-routes.ts",
    "packages/server/src/slp/features/ads/slp-ads-routes.ts",
    "packages/server/src/slp/features/feed/slp-feed-post-routes.ts",
    "packages/server/src/slp/features/onboarding/slp-onboarding-routes.ts",
    "packages/server/src/slp/features/feed/slp-feed-publishing-routes.ts",
  ],
  "packages/server/src/routes/slurp-messages.routes.ts": [
    "packages/server/src/slp/modules/messages/slp-messages-schemas.ts",
    "packages/server/src/slp/features/messages/slp-messages-context.ts",
    "packages/server/src/slp/features/messages/slp-messages-thread-routes.ts",
    "packages/server/src/slp/features/messages/slp-messages-send-routes.ts",
    "packages/server/src/slp/features/messages/slp-messages-creator-routes.ts",
    "packages/server/src/slp/features/messages/commissions/slp-commissions-routes.ts",
    "packages/server/src/slp/features/messages/slp-messages-media-routes.ts",
    "packages/server/src/slp/features/messages/slp-messages-routes.ts",
  ],
  "packages/server/src/services/storage/slurp.storage.ts": [
    "packages/server/src/slp/data/host/slp-storage-constants.ts",
    "packages/server/src/slp/modules/records/slp-storage-model.ts",
    "packages/server/src/slp/data/host/slp-storage-queries.ts",
    "packages/server/src/slp/data/host/slp-storage-mappers.ts",
    "packages/server/src/slp/modules/settings/slp-settings.ts",
    "packages/server/src/slp/data/host/slp-storage-context.ts",
    "packages/server/src/slp/data/creators/slp-creators-storage-1.ts",
    "packages/server/src/slp/data/creators/slp-creators-storage-2.ts",
    "packages/server/src/slp/data/creators/slp-creators-storage-3.ts",
    "packages/server/src/slp/data/creators/slp-creators-storage-4.ts",
    "packages/server/src/slp/data/feed/reserve/slp-reserve-storage-1.ts",
    "packages/server/src/slp/data/feed/reserve/slp-reserve-storage-2.ts",
    "packages/server/src/slp/data/audience/slp-audience-storage.ts",
    "packages/server/src/slp/data/feed/slp-feed-post-storage-1.ts",
    "packages/server/src/slp/data/feed/slp-feed-post-storage-2.ts",
    "packages/server/src/slp/data/feed/slp-feed-post-storage-3.ts",
    "packages/server/src/slp/data/feed/slp-feed-interaction-storage-1.ts",
    "packages/server/src/slp/data/feed/slp-feed-interaction-storage-2.ts",
    "packages/server/src/slp/data/feed/slp-feed-interaction-storage-3.ts",
    "packages/server/src/slp/data/feed/slp-feed-interaction-storage-4.ts",
    "packages/server/src/slp/data/feed/slp-feed-refresh-storage.ts",
    "packages/server/src/slp/data/economy/slp-economy-storage-1.ts",
    "packages/server/src/slp/data/economy/slp-economy-storage-2.ts",
    "packages/server/src/slp/data/economy/slp-economy-storage-3.ts",
    "packages/server/src/slp/data/projects/slp-projects-storage-1.ts",
    "packages/server/src/slp/data/projects/slp-projects-storage-2.ts",
    "packages/server/src/slp/data/economy/slp-economy-tail-storage.ts",
    "packages/server/src/slp/data/slp-storage.ts",
  ],
  "packages/server/src/services/storage/slurp-messages.storage.ts": [
    "packages/server/src/slp/data/messages/slp-messages-storage.ts",
    "packages/server/src/slp/data/messages/slp-messages-storage-context.ts",
    "packages/server/src/slp/data/messages/slp-messages-storage-base.ts",
    "packages/server/src/slp/data/messages/slp-messages-storage-conversation.ts",
    "packages/server/src/slp/data/messages/slp-messages-storage-commissions.ts",
    "packages/server/src/slp/data/messages/slp-messages-storage-actions.ts",
    "packages/server/src/slp/data/messages/slp-messages-storage-follow-ups.ts",
    "packages/server/src/slp/data/messages/slp-messages-storage-helpers.ts",
    "packages/server/src/slp/data/messages/slp-reply-storage-methods.ts",
  ],
  "packages/server/src/services/storage/slurp-population.storage.ts": [
    "packages/server/src/slp/data/audience/slp-audience-storage-funnel.ts",
    "packages/server/src/slp/data/audience/slp-audience-storage.ts",
  ],
  "packages/server/src/services/storage/slurp-events.storage.ts": [
    "packages/server/src/slp/data/notifications/slp-notification-storage.ts",
  ],
  "packages/server/src/services/storage/slurp-reply-queue.storage.ts": [
    "packages/server/src/slp/data/messages/slp-reply-queue-storage.ts",
  ],
  "packages/server/src/services/storage/slurp-reply-methods.ts": [
    "packages/server/src/slp/data/messages/slp-reply-storage-methods.ts",
  ],
  "packages/server/src/services/storage/slurp-file-errors.ts": ["packages/server/src/slp/base/host/slp-file-errors.ts"],
  "packages/server/src/services/storage/slurp-host-tables.ts": ["packages/server/src/slp/base/host/slp-host-tables.ts"],
  "packages/server/src/services/storage/slurp-financial-queue.ts": [
    "packages/server/src/slp/base/host/slp-financial-queue.ts",
  ],
  "packages/client/src/slurp-package-entry.tsx": ["packages/client/src/slp/slp-client-entry.tsx"],
  "packages/server/src/services/slurp/server-entry.ts": ["packages/server/src/slp/slp-server-entry.ts"],
  "packages/shared/src/slurp-autopurge-time.ts": ["packages/shared/src/slp/slp-autopurge-time.ts"],
  "packages/client/src/localization/locales/en.json": ["packages/client/src/slp/locales/en.json"],
  "packages/client/src/localization/locales/de.json": ["packages/client/src/slp/locales/de.json"],
  "packages/client/src/localization/locales/ko.json": ["packages/client/src/slp/locales/ko.json"],
  "packages/client/src/localization/locales/pl.json": ["packages/client/src/slp/locales/pl.json"],
  "packages/server/src/services/slurp/slurp-prompt.ts": ["packages/server/src/slp/modules/prompting/slp-prompt.ts"],
  "packages/server/src/services/slurp/slurp-prompt-blocks.ts": [
    "packages/server/src/slp/base/prompting/slp-prompt-blocks.ts",
  ],
  "packages/server/src/services/slurp/slurp-prompt-safety.ts": [
    "packages/server/src/slp/base/prompting/slp-prompt-safety.ts",
  ],
  "packages/server/src/services/slurp/slurp-response-format.ts": [
    "packages/server/src/slp/base/prompting/slp-response-format.ts",
  ],
  "packages/server/src/services/slurp/slurp-tone.ts": ["packages/shared/src/slp/slp-tone.ts"],
  "packages/server/src/services/slurp/slurp-sampling-options.ts": [
    "packages/server/src/slp/base/prompting/slp-sampling-options.ts",
  ],
  "packages/server/src/services/slurp/slurp-content-format.ts": [
    "packages/server/src/slp/base/prompting/slp-content-format.ts",
  ],
  "packages/server/src/services/slurp/slurp-chat-context.ts": [
    "packages/server/src/slp/features/creators/slp-chat-context.ts",
  ],
  "packages/server/src/services/slurp/slurp-image-connections.ts": [
    "packages/server/src/slp/base/media/slp-image-connections.ts",
  ],
  "packages/server/src/services/slurp/slurp-image-format.ts": [
    "packages/server/src/slp/base/media/slp-image-format.ts",
  ],
  "packages/server/src/services/slurp/slurp-image-prompt-rewrite.ts": [
    "packages/server/src/slp/base/media/slp-image-prompt-rewrite.ts",
  ],
  "packages/server/src/services/slurp/slurp-image-prompt.ts": [
    "packages/server/src/slp/base/media/slp-image-prompt.ts",
  ],
  "packages/server/src/services/slurp/slurp-image-retry.ts": ["packages/server/src/slp/base/media/slp-image-retry.ts"],
  "packages/server/src/services/slurp/slurp-images.service.ts": [
    "packages/server/src/slp/features/media/slp-images-service.ts",
  ],
  "packages/server/src/services/slurp/slurp-public-images.service.ts": [
    "packages/server/src/slp/features/media/slp-public-images-service.ts",
  ],
  "packages/server/src/services/slurp/slurp-media.ts": ["packages/server/src/slp/base/media/slp-media.ts"],
  "packages/server/src/services/slurp/slurp-vision.ts": ["packages/server/src/slp/base/media/slp-vision.ts"],
  "packages/server/src/services/slurp/slurp-post-image-context.ts": [
    "packages/server/src/slp/base/media/slp-post-image-context.ts",
  ],
  "packages/server/src/services/slurp/slurp-generated-media-policy.ts": [
    "packages/server/src/slp/base/media/slp-generated-media-policy.ts",
  ],
  "packages/server/src/services/slurp/slurp-source.ts": ["packages/server/src/slp/base/identity/slp-source.ts"],
  "packages/server/src/services/slurp/slurp-source-resolve.ts": [
    "packages/server/src/slp/data/creators/slp-source-resolve.ts",
  ],
  "packages/server/src/services/slurp/slurp-source-revision.ts": [
    "packages/server/src/slp/base/identity/slp-source-revision.ts",
  ],
  "packages/server/src/services/slurp/slurp-handle.ts": ["packages/server/src/slp/base/identity/slp-handle.ts"],
  "packages/server/src/services/slurp/slurp-avatar.ts": ["packages/server/src/slp/base/identity/slp-avatar.ts"],
  "packages/server/src/services/slurp/slurp-disclosure.ts": [
    "packages/server/src/slp/modules/creators/slp-disclosure.ts",
  ],
  "packages/server/src/services/slurp/slurp-identity-protection.ts": [
    "packages/server/src/slp/base/identity/slp-identity-protection.ts",
  ],
  "packages/server/src/services/slurp/slurp-access.ts": ["packages/server/src/slp/base/identity/slp-access.ts"],
  "packages/server/src/services/slurp/slurp-connection.ts": ["packages/server/src/slp/base/identity/slp-connection.ts"],
  "packages/server/src/services/slurp/slurp-operation-lock.ts": [
    "packages/server/src/slp/base/locking/slp-operation-lock.ts",
  ],
  "packages/server/src/services/slurp/slurp-account-operation-lock.ts": [
    "packages/server/src/slp/base/locking/slp-account-operation-lock.ts",
  ],
  "packages/server/src/services/slurp/slurp-activation-lifecycle.ts": [
    "packages/server/src/slp/base/locking/slp-activation-lifecycle.ts",
  ],
  "packages/server/src/services/slurp/slurp-model-budget.ts": ["packages/shared/src/slp/slp-model-budget.ts"],
  "packages/server/src/services/slurp/slurp-model-worker.ts": [
    "packages/server/src/slp/base/model/slp-model-worker.ts",
  ],
  "packages/server/src/services/slurp/slurp-model-answer.ts": [
    "packages/server/src/slp/base/model/slp-model-answer.ts",
  ],
  "packages/server/src/services/slurp/slurp-tuning.ts": ["packages/shared/src/slp/slp-tuning.ts"],
  "packages/server/src/services/slurp/slurp-poll-backoff.ts": [
    "packages/server/src/slp/base/model/slp-poll-backoff.ts",
  ],
  "packages/server/src/services/slurp/slurp-stage-profile-draft.service.ts": [
    "packages/server/src/slp/features/creators/slp-stage-profile-draft-service.ts",
  ],
  "packages/server/src/services/slurp/slurp-stage-profile-normalize.ts": [
    "packages/server/src/slp/modules/creators/slp-stage-profile-normalize.ts",
  ],
  "packages/server/src/services/slurp/slurp-stage-profile-repair.ts": [
    "packages/server/src/slp/modules/creators/slp-stage-profile-repair.ts",
  ],
  "packages/server/src/services/slurp/slurp-creator-state.ts": [
    "packages/server/src/slp/modules/creators/slp-creator-state.ts",
  ],
  "packages/server/src/services/slurp/slurp-creator-schedule.ts": [
    "packages/server/src/slp/features/creators/slp-creator-schedule.ts",
  ],
  "packages/server/src/services/slurp/slurp-creator-schedule-context.ts": [
    "packages/server/src/slp/modules/creators/slp-creator-schedule-context.ts",
  ],
  "packages/server/src/services/slurp/slurp-artwork.operation.ts": [
    "packages/server/src/slp/features/creators/slp-artwork-operation.ts",
  ],
  "packages/server/src/services/slurp/slurp-profile-selection.ts": [
    "packages/server/src/slp/modules/creators/slp-profile-selection.ts",
  ],
  "packages/server/src/services/slurp/slurp-public-profiles.service.ts": [
    "packages/server/src/slp/features/creators/slp-public-profiles-service.ts",
  ],
  "packages/server/src/services/slurp/slurp-public-support.ts": [
    "packages/server/src/slp/modules/creators/slp-public-support.ts",
    "packages/server/src/slp/data/creators/slp-creator-accounts.ts",
  ],
  "packages/server/src/services/slurp/slurp-generated-profiles.ts": [
    "packages/server/src/slp/modules/creators/slp-generated-profiles.ts",
  ],
  "packages/server/src/services/slurp/slurp-improvement.ts": [
    "packages/server/src/slp/modules/creators/improvement/slp-improvement.ts",
  ],
  "packages/server/src/services/slurp/slurp-generation.service.ts": [
    "packages/server/src/slp/features/feed/slp-generation-service.ts",
    "packages/server/src/slp/features/feed/slp-public-identity.ts",
    "packages/server/src/slp/features/feed/slp-post-prompt.ts",
  ],
  "packages/server/src/services/slurp/slurp-post.operation.ts": [
    "packages/server/src/slp/features/feed/slp-post-operation.ts",
  ],
  "packages/server/src/services/slurp/slurp-post-variation.ts": [
    "packages/server/src/slp/modules/feed/slp-post-variation.ts",
  ],
  "packages/server/src/services/slurp/slurp-post-stance.ts": [
    "packages/server/src/slp/modules/feed/slp-post-stance.ts",
  ],
  "packages/server/src/services/slurp/slurp-post-timing.ts": [
    "packages/server/src/slp/modules/feed/slp-post-timing.ts",
  ],
  "packages/server/src/services/slurp/slurp-post-condition.service.ts": [
    "packages/server/src/slp/features/feed/slp-post-condition-service.ts",
  ],
  "packages/server/src/services/slurp/slurp-post-target.ts": [
    "packages/server/src/slp/modules/feed/slp-post-target.ts",
  ],
  "packages/server/src/services/slurp/slurp-post-page.ts": ["packages/server/src/slp/modules/feed/slp-post-page.ts"],
  "packages/server/src/services/slurp/slurp-post-guidance.ts": [
    "packages/server/src/slp/modules/feed/slp-post-guidance.ts",
  ],
  "packages/server/src/services/slurp/slurp-post-guidance-draft.service.ts": [
    "packages/server/src/slp/features/feed/slp-post-guidance-draft-service.ts",
  ],
  "packages/server/src/services/slurp/slurp-autopost-poll.ts": [
    "packages/server/src/slp/modules/feed/slp-autopost-poll.ts",
  ],
  "packages/server/src/services/slurp/slurp-autopost-scheduler.service.ts": [
    "packages/server/src/slp/features/feed/slp-autopost-scheduler-service.ts",
  ],
  "packages/server/src/services/slurp/slurp-refresh-scheduler.service.ts": [
    "packages/server/src/slp/features/feed/slp-refresh-scheduler-service.ts",
  ],
  "packages/server/src/services/slurp/slurp-refresh-schedule.ts": [
    "packages/server/src/slp/modules/feed/slp-refresh-schedule.ts",
  ],
  "packages/server/src/services/slurp/slurp-generated-activity.service.ts": [
    "packages/server/src/slp/features/feed/slp-generated-activity-service.ts",
  ],
  "packages/server/src/services/slurp/slurp-generated-refresh.ts": [
    "packages/server/src/slp/features/feed/slp-generated-refresh.ts",
  ],
  "packages/server/src/services/slurp/slurp-share-card.ts": ["packages/server/src/slp/features/feed/slp-share-card.ts"],
  "packages/server/src/services/slurp/slurp-posting-interval.ts": [
    "packages/server/src/slp/modules/feed/slp-posting-interval.ts",
  ],
  "packages/server/src/services/slurp/slurp-interaction-policy.ts": [
    "packages/server/src/slp/modules/feed/slp-interaction-policy.ts",
  ],
  "packages/server/src/services/slurp/slurp-invited-post-draft-access.ts": [
    "packages/server/src/slp/modules/feed/slp-invited-post-draft-access.ts",
  ],
  "packages/server/src/services/slurp/slurp-invited-post-draft.service.ts": [
    "packages/server/src/slp/features/feed/slp-invited-post-draft-service.ts",
  ],
  "packages/server/src/services/slurp/slurp-viewer-unseen.ts": [
    "packages/server/src/slp/modules/feed/slp-viewer-unseen.ts",
  ],
  "packages/server/src/services/slurp/slurp-participant-selection.ts": [
    "packages/server/src/slp/modules/feed/slp-participant-selection.ts",
  ],
  "packages/server/src/services/slurp/slurp-reserve.operation.ts": [
    "packages/server/src/slp/features/feed/reserve/slp-reserve-operation.ts",
  ],
  "packages/server/src/services/slurp/slurp-messaging.ts": [
    "packages/server/src/slp/modules/messages/slp-messaging.ts",
  ],
  "packages/server/src/services/slurp/slurp-message.operation.ts": [
    "packages/server/src/slp/features/messages/slp-message-operation.ts",
  ],
  "packages/server/src/services/slurp/slurp-message-generation.service.ts": [
    "packages/server/src/slp/features/messages/slp-message-generation-service.ts",
  ],
  "packages/server/src/services/slurp/slurp-message-scheduler.service.ts": [
    "packages/server/src/slp/features/messages/slp-message-scheduler-service.ts",
  ],
  "packages/server/src/services/slurp/slurp-reply-generation.service.ts": [
    "packages/server/src/slp/features/messages/slp-reply-generation-service.ts",
  ],
  "packages/server/src/services/slurp/slurp-dm-response.ts": [
    "packages/server/src/slp/modules/messages/slp-dm-response.ts",
  ],
  "packages/server/src/services/slurp/slurp-follow-up.ts": [
    "packages/server/src/slp/modules/messages/slp-follow-up.ts",
  ],
  "packages/server/src/services/slurp/slurp-follow-up-scheduler.service.ts": [
    "packages/server/src/slp/features/messages/slp-follow-up-scheduler-service.ts",
  ],
  "packages/server/src/services/slurp/slurp-thread-notes.ts": [
    "packages/server/src/slp/modules/messages/slp-thread-notes.ts",
  ],
  "packages/server/src/services/slurp/slurp-conversation-momentum.ts": [
    "packages/server/src/slp/modules/messages/slp-conversation-momentum.ts",
  ],
  "packages/server/src/services/slurp/slurp-conversation-schedule-generation.ts": [
    "packages/server/src/slp/features/messages/slp-conversation-schedule-generation.ts",
  ],
  "packages/server/src/services/slurp/slurp-check-in-intervals.ts": [
    "packages/server/src/slp/modules/messages/slp-check-in-intervals.ts",
  ],
  "packages/server/src/services/slurp/slurp-cheat-directive.ts": [
    "packages/server/src/slp/modules/messages/slp-cheat-directive.ts",
  ],
  "packages/server/src/services/slurp/slurp-rapport.ts": ["packages/server/src/slp/modules/messages/slp-rapport.ts"],
  "packages/server/src/services/slurp/slurp-inbox-attention.ts": [
    "packages/server/src/slp/features/messages/slp-inbox-attention.ts",
  ],
  "packages/server/src/services/slurp/slurp-creator-reply.operation.ts": [
    "packages/server/src/slp/features/messages/slp-creator-reply-operation.ts",
  ],
  "packages/server/src/services/slurp/slurp-commission-delivery.service.ts": [
    "packages/server/src/slp/features/messages/commissions/slp-commission-delivery-service.ts",
  ],
  "packages/server/src/services/slurp/slurp-commission-image.operation.ts": [
    "packages/server/src/slp/features/messages/commissions/slp-commission-image-operation.ts",
  ],
  "packages/server/src/services/slurp/slurp-population.ts": ["packages/shared/src/slp/slp-population.ts"],
  "packages/server/src/services/slurp/slurp-fan-types.ts": ["packages/shared/src/slp/slp-fan-types.ts"],
  "packages/server/src/services/slurp/slurp-fan-activity-day-plan.ts": [
    "packages/server/src/slp/modules/audience/slp-fan-activity-day-plan.ts",
  ],
  "packages/server/src/services/slurp/slurp-fan-activity.operation.ts": [
    "packages/server/src/slp/features/audience/slp-fan-activity-operation.ts",
  ],
  "packages/server/src/services/slurp/slurp-fan-activity-response.ts": [
    "packages/server/src/slp/modules/audience/slp-fan-activity-response.ts",
  ],
  "packages/server/src/services/slurp/slurp-fan-activity-scheduler.service.ts": [
    "packages/server/src/slp/features/audience/slp-fan-activity-scheduler-service.ts",
  ],
  "packages/server/src/services/slurp/slurp-fan-activity.service.ts": [
    "packages/server/src/slp/features/audience/slp-fan-activity-service.ts",
  ],
  "packages/server/src/services/slurp/slurp-fan-identity-provider.ts": [
    "packages/server/src/slp/modules/audience/slp-fan-identity-provider.ts",
  ],
  "packages/server/src/services/slurp/slurp-audience-characters.ts": [
    "packages/shared/src/slp/slp-audience-characters.ts",
  ],
  "packages/server/src/services/slurp/slurp-audience-subscription.ts": [
    "packages/shared/src/slp/slp-audience-subscription.ts",
  ],
  "packages/server/src/services/slurp/slurp-audience-reply.operation.ts": [
    "packages/server/src/slp/features/audience/slp-audience-reply-operation.ts",
  ],
  "packages/server/src/services/slurp/slurp-reach.ts": ["packages/shared/src/slp/slp-reach.ts"],
  "packages/server/src/services/slurp/slurp-scale.ts": ["packages/server/src/slp/modules/audience/slp-scale.ts"],
  "packages/server/src/services/slurp/slurp-ambient-profiles.ts": [
    "packages/server/src/slp/data/audience/slp-ambient-profiles.ts",
  ],
  "packages/server/src/services/slurp/slurp-ambient-profile-generation.service.ts": [
    "packages/server/src/slp/features/audience/slp-ambient-profile-generation-service.ts",
  ],
  "packages/server/src/services/slurp/slurp-world.ts": ["packages/shared/src/slp/slp-world.ts"],
  "packages/server/src/services/slurp/slurp-world.operation.ts": [
    "packages/server/src/slp/features/world/slp-world-operation.ts",
    "packages/server/src/slp/features/world/slp-world-actions.ts",
    "packages/server/src/slp/features/world/slp-world-tick-state.ts",
  ],
  "packages/server/src/services/slurp/slurp-world-copy.ts": ["packages/server/src/slp/modules/world/slp-world-copy.ts"],
  "packages/server/src/services/slurp/slurp-world-pulse.ts": ["packages/shared/src/slp/slp-world-pulse.ts"],
  "packages/server/src/services/slurp/slurp-world-scheduler.service.ts": [
    "packages/server/src/slp/features/world/slp-world-scheduler-service.ts",
  ],
  "packages/server/src/services/slurp/slurp-day-vibe.ts": ["packages/server/src/slp/modules/world/slp-day-vibe.ts"],
  "packages/server/src/services/slurp/slurp-day-vibe.service.ts": [
    "packages/server/src/slp/features/world/slp-day-vibe-service.ts",
  ],
  "packages/server/src/services/slurp/slurp-mood.ts": ["packages/server/src/slp/modules/world/slp-mood.ts"],
  "packages/server/src/services/slurp/slurp-stance.ts": ["packages/server/src/slp/modules/world/slp-stance.ts"],
  "packages/server/src/services/slurp/slurp-talkativeness.ts": [
    "packages/server/src/slp/modules/world/slp-talkativeness.ts",
  ],
  "packages/server/src/services/slurp/slurp-pending-text.service.ts": [
    "packages/server/src/slp/features/world/slp-pending-text-service.ts",
  ],
  "packages/server/src/services/slurp/slurp-reaction-bank.ts": [
    "packages/server/src/slp/modules/world/slp-reaction-bank.ts",
  ],
  "packages/server/src/services/slurp/slurp-reaction-bank.operation.ts": [
    "packages/server/src/slp/features/world/slp-reaction-bank-operation.ts",
  ],
  "packages/server/src/services/slurp/slurp-milestones.ts": ["packages/server/src/slp/modules/world/slp-milestones.ts"],
  "packages/server/src/services/slurp/slurp-platform-events.ts": ["packages/shared/src/slp/slp-platform-events.ts"],
  "packages/server/src/services/slurp/slurp-project.ts": [
    "packages/server/src/slp/modules/projects/slp-project.ts",
    "packages/server/src/slp/modules/projects/slp-arc-crossover.ts",
    "packages/server/src/slp/modules/projects/slp-arc-library.ts",
    "packages/server/src/slp/modules/projects/slp-arc-progress.ts",
  ],
  "packages/server/src/services/slurp/slurp-arc-generation.service.ts": [
    "packages/server/src/slp/features/projects/slp-arc-generation-service.ts",
  ],
  "packages/server/src/services/slurp/slurp-audience-arc.ts": [
    "packages/server/src/slp/modules/projects/slp-audience-arc.ts",
  ],
  "packages/server/src/services/slurp/slurp-goal.ts": ["packages/server/src/slp/modules/projects/slp-goal.ts"],
  "packages/server/src/services/slurp/slurp-wallet.ts": ["packages/server/src/slp/modules/economy/slp-wallet.ts"],
  "packages/server/src/services/slurp/slurp-prices.ts": ["packages/server/src/slp/modules/economy/slp-prices.ts"],
  "packages/server/src/services/slurp/slurp-earnings.ts": ["packages/server/src/slp/modules/economy/slp-earnings.ts"],
  "packages/server/src/services/slurp/slurp-payment-reaction.ts": [
    "packages/server/src/slp/features/economy/slp-payment-reaction.ts",
  ],
  "packages/server/src/services/slurp/slurp-payment-recovery-scheduler.service.ts": [
    "packages/server/src/slp/features/economy/slp-payment-recovery-scheduler-service.ts",
  ],
  "packages/server/src/services/slurp/slurp-media-offer.ts": [
    "packages/server/src/slp/modules/economy/slp-media-offer.ts",
  ],
  "packages/server/src/services/slurp/slurp-creator-pricing.ts": [
    "packages/server/src/slp/modules/economy/slp-creator-pricing.ts",
  ],
  "packages/server/src/services/slurp/slurp-studio-snapshot.ts": [
    "packages/server/src/slp/features/economy/slp-studio-snapshot.ts",
  ],
  "packages/server/src/services/slurp/slurp-event-weight.ts": [
    "packages/server/src/slp/modules/notifications/slp-event-weight.ts",
  ],
  "packages/server/src/services/slurp/slurp-discovery-profile.ts": [
    "packages/server/src/slp/modules/discovery/slp-discovery-profile.ts",
  ],
  "packages/server/src/services/slurp/slurp-first-post-queue.service.ts": [
    "packages/server/src/slp/features/onboarding/slp-first-post-queue-service.ts",
  ],
  "packages/server/src/services/slurp/slurp-autopurge.ts": [
    "packages/server/src/slp/features/maintenance/slp-autopurge.ts",
  ],
  "packages/server/src/services/slurp/slurp-autopurge-plan.ts": [
    "packages/server/src/slp/modules/maintenance/slp-autopurge-plan.ts",
  ],
  "packages/server/src/services/slurp/slurp-autopurge-scheduler.service.ts": [
    "packages/server/src/slp/features/maintenance/slp-autopurge-scheduler-service.ts",
  ],
  "packages/server/src/services/slurp/slurp-backup.ts": ["packages/server/src/slp/modules/maintenance/slp-backup.ts"],
  "packages/server/src/services/slurp/slurp-backup-state.ts": [
    "packages/server/src/slp/base/locking/slp-backup-state.ts",
  ],
  "packages/server/src/services/slurp/slurp-data-deletion-state.ts": [
    "packages/server/src/slp/base/locking/slp-data-deletion-state.ts",
  ],
  "packages/server/src/services/slurp/slurp-garnish-context.ts": [
    "packages/server/src/slp/features/ads/slp-garnish-context.ts",
  ],
  "packages/server/src/services/slurp/slurp-garnish-generation.service.ts": [
    "packages/server/src/slp/features/ads/slp-garnish-generation-service.ts",
  ],
  "packages/server/src/services/slurp/slurp-garnish-image.service.ts": [
    "packages/server/src/slp/features/ads/slp-garnish-image-service.ts",
  ],
  "packages/server/src/services/slurp/slurp-garnish-image.ts": [
    "packages/server/src/slp/features/ads/slp-garnish-image.ts",
  ],
  "packages/server/src/services/slurp/slurp-garnish-lorebook.ts": [
    "packages/server/src/slp/features/ads/slp-garnish-lorebook.ts",
  ],
  "packages/server/src/services/slurp/slurp-garnish-sync.service.ts": [
    "packages/server/src/slp/features/ads/slp-garnish-sync-service.ts",
  ],
  // Slice 10 moved the remaining `components/slurp/` leaf files into the slp roots.
  "packages/client/src/components/slurp/slurp-logo.ts": ["packages/client/src/slp/base/chrome/slp-logo.ts"],
  "packages/client/src/components/slurp/slurp-gunterlie-avatar.ts": [
    "packages/client/src/slp/base/chrome/slp-gunterlie-avatar.ts",
  ],
  "packages/client/src/components/slurp/SlurpEmptyArtwork.tsx": [
    "packages/client/src/slp/base/chrome/SlpEmptyArtwork.tsx",
  ],
  "packages/client/src/components/slurp/SlurpSparkleVeil.tsx": [
    "packages/client/src/slp/base/chrome/SlpSparkleVeil.tsx",
  ],
  "packages/client/src/components/slurp/SlurpDateTime.ts": ["packages/client/src/slp/base/ui/slp-date-time.ts"],
  "packages/client/src/components/slurp/slurp-navigation.types.ts": [
    "packages/client/src/slp/base/navigation/slp-navigation.types.ts",
  ],
  "packages/client/src/components/slurp/SlurpImageComposer.tsx": [
    "packages/client/src/slp/base/media/SlpImageComposer.tsx",
  ],
  "packages/client/src/components/slurp/PostImageCropEditor.tsx": [
    "packages/client/src/slp/base/media/SlpPostImageCropEditor.tsx",
  ],
  "packages/client/src/components/slurp/slurp-creator-status.ts": [
    "packages/client/src/slp/modules/creator/slp-creator-status.ts",
  ],
  "packages/client/src/components/slurp/SlurpTagsSettings.tsx": [
    "packages/client/src/slp/features/discovery/SlpTagsPanel.tsx",
  ],
  "packages/client/src/components/slurp/SlurpDiscoverToolbar.tsx": [
    "packages/client/src/slp/features/discovery/SlpDiscoverToolbar.tsx",
  ],
  "packages/client/src/components/slurp/SlurpDiscoveryProfileEditor.tsx": [
    "packages/client/src/slp/features/discovery/SlpDiscoveryProfileEditor.tsx",
  ],
  "packages/client/src/components/slurp/SlurpFanTypesSettings.tsx": [
    "packages/client/src/slp/features/audience/SlpFanTypesPanel.tsx",
  ],
  "packages/client/src/components/slurp/SlurpAudienceConfigSettings.tsx": [
    "packages/client/src/slp/features/audience/SlpAudienceConfigPanel.tsx",
  ],
  "packages/client/src/components/slurp/SlurpSimulationSettings.tsx": [
    "packages/client/src/slp/features/audience/SlpSimulationPanel.tsx",
  ],
  "packages/client/src/slp/modules/audience/slp-simulation-estimate.ts": [
    "packages/client/src/slp/modules/audience/slp-simulation-estimate.ts",
  ],
  "packages/client/src/components/slurp/SlurpPlatformEventsSettings.tsx": [
    "packages/client/src/slp/features/world/SlpPlatformEventsPanel.tsx",
  ],
  "packages/client/src/components/slurp/slurp-activity-presets.ts": [
    "packages/client/src/slp/modules/creator/slp-activity-presets.ts",
  ],
  "packages/client/src/slp/features/settings/slp-settings-defaults.ts": [
    "packages/client/src/slp/features/settings/slp-settings-defaults.ts",
  ],
  "packages/client/src/slp/features/settings/slp-prompt-presets.ts": [
    "packages/client/src/slp/features/settings/slp-prompt-presets.ts",
  ],
  "packages/client/src/components/slurp/SlurpPromptBlockBuilder.tsx": [
    "packages/client/src/slp/features/settings/SlpPromptBlockBuilder.tsx",
  ],
  // Slice 10 split the shell: domain-neutral chrome to base/, the shell and persona switcher to
  // modules/chrome/ because the shell renders a wallet balance through modules/coin.
  "packages/client/src/components/slurp/SlurpShell.tsx": [
    "packages/client/src/slp/base/chrome/SlpChrome.tsx",
    "packages/client/src/slp/modules/chrome/slp-shell.types.ts",
    "packages/client/src/slp/modules/chrome/SlpPersonaSwitcher.tsx",
    "packages/client/src/slp/modules/chrome/SlpShell.tsx",
  ],
  // Slice 10 split the shared Backstage kit: pure formatting and prop-driven controls into
  // modules/settings/, and the three hook-driven panels into the features that own their settings.
  "packages/client/src/components/slurp/SlurpBackstageWorkflow.tsx": [
    "packages/client/src/slp/modules/settings/slp-backstage-format.ts",
    "packages/client/src/slp/modules/settings/SlpBackstageKit.tsx",
    "packages/client/src/slp/features/projects/SlpArcLibraryEditor.tsx",
    "packages/client/src/slp/features/projects/SlpArcLibraryDraftEditor.tsx",
    "packages/client/src/slp/features/audience/SlpAmbientProfilesPanel.tsx",
    "packages/client/src/slp/features/messages/SlpCreatorMessagingGroup.tsx",
  ],
  "packages/client/src/components/slurp/SlpAnchoredPopover.tsx": [
    "packages/client/src/slp/base/chrome/SlpAnchoredPopover.tsx",
  ],
  "packages/client/src/components/slurp/slurp2-release.ts": [
    "packages/client/src/slp/features/onboarding/slp-release.ts",
  ],
  "packages/client/src/components/slurp/SlurpAgeGate.tsx": [
    "packages/client/src/slp/features/onboarding/SlpAgeGate.tsx",
  ],
  "packages/client/src/components/slurp/SlurpSplash.tsx": ["packages/client/src/slp/features/onboarding/SlpSplash.tsx"],
  "packages/client/src/components/slurp/SlurpCreatorBulkEdit.tsx": [
    "packages/client/src/slp/features/creators/SlpCreatorBulkEdit.tsx",
  ],
  "packages/client/src/components/slurp/SlurpCreatorImprover.tsx": [
    "packages/client/src/slp/features/creators/SlpCreatorImprover.tsx",
  ],
  "packages/client/src/components/slurp/SlurpProfileSurface.tsx": [
    "packages/client/src/slp/features/creators/SlpProfileSurface.tsx",
  ],
  "packages/client/src/components/slurp/SlurpCreatorProfileCard.tsx": [
    "packages/client/src/slp/modules/creator/SlpCreatorProfileCard.tsx",
  ],
  "packages/client/src/components/slurp/SlurpFanCard.tsx": ["packages/client/src/slp/modules/audience/SlpFanCard.tsx"],
  "packages/client/src/components/slurp/SlurpInlineAd.tsx": ["packages/client/src/slp/features/ads/SlpInlineAd.tsx"],
  "packages/client/src/components/slurp/SlurpMaintenanceHealth.tsx": [
    "packages/client/src/slp/features/maintenance/SlpMaintenanceHealth.tsx",
  ],
  "packages/client/src/components/slurp/SlurpPostGuidanceField.tsx": [
    "packages/client/src/slp/features/settings/SlpPostGuidanceField.tsx",
  ],
  "packages/client/src/components/slurp/SlurpProjectsPanel.tsx": [
    "packages/client/src/slp/features/projects/SlpProjectsBoard.tsx",
    "packages/client/src/slp/features/projects/SlpArcTimelineCard.tsx",
    "packages/client/src/slp/features/projects/SlpArcConfigSection.tsx",
    "packages/client/src/slp/features/projects/SlpProjectEditor.tsx",
  ],
  "packages/server/src/services/slurp/slurp-post-guidance.storage.ts": [
    "packages/server/src/slp/data/settings/slp-post-guidance-storage.ts",
  ],
};

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const engineRoot = join(repoRoot, "packages/slurp2/src/engine");
const ENGINE_PREFIX = "packages/slurp2/src/engine/";

/** Reads a Slurp2 source by logical key; any other path is read directly, exactly as given. */
export function slurp2Source(path: string | URL): string {
  const text = path instanceof URL ? fileURLToPath(path) : path;
  const at = text.replaceAll("\\", "/").lastIndexOf(ENGINE_PREFIX);
  const files = at < 0 ? undefined : SLURP2_SOURCE_MODULES[text.slice(at + ENGINE_PREFIX.length)];
  if (!files) return readFileSync(path, "utf8");
  return files.map((file) => readFileSync(join(engineRoot, file), "utf8")).join("\n");
}
