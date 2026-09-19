import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { SLURP2_SOURCE_MODULES } from "./slurp2-source";

// Slice 7 proof: the client state layer moved into `slp/` without changing what it exposes, which
// endpoints it calls, or how the query cache is keyed. The frozen inventories below were taken from
// `hooks/use-slurp.ts` at `26a80fe7`, the commit the split started from.

const engine = join(import.meta.dirname, "../packages/slurp2/src/engine");
const clientSrc = join(engine, "packages/client/src");
const slpRoot = join(clientSrc, "slp");

function walk(dir: string, base = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    return entry.isDirectory() ? walk(join(dir, entry.name), rel) : [rel];
  });
}

// Slice 9 moved Backstage into `slp/`, and Slice 10 moved the rest of `components/slurp/`. This
// proof is about the state layer that came out of `hooks/use-slurp.ts`, the package store and the
// `lib/` helpers, so every file the source map attributes to a *component* key is excluded.
// Otherwise each component moved into the namespace inflates these counts and the proof decays into
// a number that gets rebaselined every slice instead of catching real state-layer drift.
const componentFiles = new Set(
  Object.entries(SLURP2_SOURCE_MODULES)
    .filter(([key]) => key.startsWith("packages/client/src/components/slurp/"))
    .flatMap(([, files]) => files)
    .filter((file) => file.startsWith("packages/client/src/slp/"))
    .map((file) => file.replace("packages/client/src/slp/", "")),
);
const paths = walk(slpRoot)
  .filter((path) => /\.tsx?$/u.test(path))
  .filter((path) => !componentFiles.has(path));
const sources = new Map(paths.map((path) => [path, readFileSync(join(slpRoot, path), "utf8")]));
const combined = [...sources.values()].join("\n");

// The monolith is gone and nothing re-introduces it or a compatibility shim.
assert.ok(!existsSync(join(clientSrc, "hooks/use-slurp.ts")), "hooks/use-slurp.ts must not come back");
for (const legacy of [
  "stores/slurp-package.store.ts",
  "hooks/use-slurp-media-src.ts",
  "lib/slurp-discovery.ts",
  "lib/slurp-refresh-batch.ts",
]) {
  assert.ok(!existsSync(join(clientSrc, legacy)), `${legacy} must not survive the move`);
}

// 1. Complete hook coverage: every name the monolith exported still exists, exactly once.
const EXPORTED_BEFORE = [
  "GeneratedNoodlerNoodlePost",
  "NoodleAmbientProfileRerollResult",
  "NoodlePostDraft",
  "NoodlePostDraftRequest",
  "NoodleRefreshResult",
  "NoodlerConnectionCounts",
  "NoodlerContentFormat",
  "NoodlerFirstPostJob",
  "NoodlerPostDraftImage",
  "NoodlerViewerWallets",
  "SlurpAdInput",
  "SlurpAmbientProfile",
  "SlurpArcChapterReach",
  "SlurpArcChoice",
  "SlurpArcEffects",
  "SlurpArcHistoryEntry",
  "SlurpArcTimeline",
  "SlurpArcType",
  "SlurpAudienceCharacterGroup",
  "SlurpAudienceCharacterSummary",
  "SlurpAudienceMember",
  "SlurpAutopurgePreview",
  "SlurpAutopurgeResult",
  "SlurpBackupJob",
  "SlurpCommission",
  "SlurpComposeTarget",
  "SlurpContentRating",
  "SlurpCreatorArcConfig",
  "SlurpCreatorBulkPatch",
  "SlurpCreatorMessaging",
  "SlurpCreatorMetrics",
  "SlurpDiscoveryGender",
  "SlurpDmPolicy",
  "SlurpEventGroup",
  "SlurpEventItem",
  "SlurpEventKind",
  "SlurpFollowerEntry",
  "SlurpGoalProgress",
  "SlurpImageConnections",
  "SlurpImprovementJob",
  "SlurpImprovementProposal",
  "SlurpMaintenanceSummary",
  "SlurpManagedStageProfile",
  "SlurpMessage",
  "SlurpPostAccess",
  "SlurpPostGuidance",
  "SlurpPostGuidanceEntry",
  "SlurpProfilePost",
  "SlurpProject",
  "SlurpPromotion",
  "SlurpPromptBlockDefinition",
  "SlurpPromptBlockOverride",
  "SlurpPromptDebug",
  "SlurpPromptDefinition",
  "SlurpPromptErrorKind",
  "SlurpRapport",
  "SlurpRapportContribution",
  "SlurpReserveStatus",
  "SlurpRestoreInspection",
  "SlurpScheduleSlot",
  "SlurpScheduleStatus",
  "SlurpSendResponse",
  "SlurpSettings",
  "SlurpSettingsUpdate",
  "SlurpStageProfileInput",
  "SlurpStudioCreator",
  "SlurpStudioPost",
  "SlurpSubscriberEntry",
  "SlurpThread",
  "SlurpThreadRelationship",
  "SlurpTopFan",
  "SlurpViewerScope",
  "SlurpWallet",
  "SlurpWalletEntry",
  "applySlurpRestoreInspection",
  "discardSlurpRestoreInspection",
  "downloadSlurpBackup",
  "getSlurpBackupJob",
  "getSlurpPromptErrorKind",
  "inspectSlurpRestore",
  "noodleKeys",
  "startSlurpBackup",
  "startSlurpRestore",
  "useAcceptSlurpCommission",
  "useAdoptNoodlerSourceIdentity",
  "useApplySlurpImprovementProposals",
  "useBroadcastSlurpMessage",
  "useBulkCreateNoodlerStageProfiles",
  "useBulkUpdateSlurpCreators",
  "useCancelSlurpFollowUp",
  "useClaimSlurpDailyRefill",
  "useConfirmNoodlerImagePrompts",
  "useCounterSlurpCommission",
  "useCreateNoodlerInteraction",
  "useCreateNoodlerPost",
  "useCreateNoodlerStageProfile",
  "useCreateSlurpAd",
  "useCreateSlurpCommission",
  "useCreateSlurpImprovementJob",
  "useCreateSlurpProject",
  "useDeclineSlurpCommission",
  "useDeleteAllSlurpData",
  "useDeleteNoodlerInteraction",
  "useDeleteNoodlerPost",
  "useDeleteNoodlerStageProfile",
  "useDeleteSlurpAd",
  "useDeleteSlurpProject",
  "useDeleteUnusedSlurpData",
  "useDeliverSlurpCommission",
  "useDirectSlurpProject",
  "useDismissNoodlerSourceChanges",
  "useDismissSlurpImprovementProposals",
  "useDraftSlurpCreatorReply",
  "useEnqueueNoodlerFirstPosts",
  "useForceSlurpReply",
  "useGenerateNoodlePostDraft",
  "useGenerateNoodlerArtwork",
  "useGenerateNoodlerNoodlePost",
  "useGenerateNoodlerPostImage",
  "useGenerateNoodlerStageProfileDraft",
  "useGenerateSlurpAdImage",
  "useGenerateSlurpAds",
  "useGenerateSlurpArcType",
  "useGenerateSlurpPostGuidance",
  "useGenerateSlurpProject",
  "useGenerateSlurpViewerImage",
  "useHideSlurpAd",
  "useHideSlurpAdBrand",
  "useImportSlurpAds",
  "useLoadNoodlerPostImage",
  "useMarkNoodlerFeedSeen",
  "useMarkSlurpNotificationsSeen",
  "useNoodlerAccounts",
  "useNoodlerConnectionCounts",
  "useNoodlerEligibleAccounts",
  "useNoodlerFanActivityStatus",
  "useNoodlerFirstPostStatus",
  "useNoodlerFollowers",
  "useNoodlerPosts",
  "useNoodlerReserveStatus",
  "useNoodlerSubscribers",
  "useNoodlerUnseenCount",
  "useNoodlerViewer",
  "useNoodlerViewerWallets",
  "useOpenSlurpCreatorThread",
  "useQuoteSlurpCommission",
  "useReactToSlurpMessage",
  "useRecordSlurpAdAction",
  "useRecordSlurpStoryView",
  "useRefreshNoodlerConversationSchedule",
  "useRefreshNoodlerFanActivityNow",
  "useRefreshTargetedNoodlerCreatorsNow",
  "useRemoveNoodlerAvatar",
  "useRemoveNoodlerInteraction",
  "useReplaceNoodlerPostImage",
  "useReplaceSlurpDiscoveryTag",
  "useRequestSlurpReply",
  "useRerollAmbientProfiles",
  "useResetSlurpAds",
  "useResetSlurpArcType",
  "useResetSlurpThread",
  "useResolveSlurpArcProfile",
  "useResolveSlurpMessageRequest",
  "useRunNoodlerAutoPostNow",
  "useRunSlurpAutopurge",
  "useSaveSlurpProjectToLibrary",
  "useSendSlurpCreatorImage",
  "useSendSlurpCreatorPpv",
  "useSendSlurpCreatorReply",
  "useSendSlurpMessage",
  "useSendSlurpViewerImage",
  "useSetSlurpCreatorMessaging",
  "useSetSlurpCreatorPrice",
  "useSetSlurpGoal",
  "useSetSlurpImprovementJobState",
  "useSetSlurpThreadNotes",
  "useSetSlurpWalletCoinsForDevelopment",
  "useSlurpAdLorebooks",
  "useSlurpAdPool",
  "useSlurpAdState",
  "useSlurpAmbientProfiles",
  "useSlurpArcConfig",
  "useSlurpArcs",
  "useSlurpAudienceCharacterGroups",
  "useSlurpAudienceCharacters",
  "useSlurpAudienceMember",
  "useSlurpAutopurgePreview",
  "useSlurpCheatDirective",
  "useSlurpCompose",
  "useSlurpComposeTargets",
  "useSlurpConnections",
  "useSlurpCreatorMessagingSettings",
  "useSlurpCreatorMetrics",
  "useSlurpDiscoveryTagUsage",
  "useSlurpImageConnections",
  "useSlurpImprovementJobs",
  "useSlurpInlineAds",
  "useSlurpMaintenanceSummary",
  "useSlurpMessagePrompt",
  "useSlurpNotifications",
  "useSlurpOlderMessages",
  "useSlurpPayout",
  "useSlurpPostGuidance",
  "useSlurpProjects",
  "useSlurpPromptBlocks",
  "useSlurpRapport",
  "useSlurpSettings",
  "useSlurpSettingsDefaults",
  "useSlurpStoryViews",
  "useSlurpStudio",
  "useSlurpThread",
  "useSlurpThreads",
  "useSlurpWallet",
  "useSyncSlurpAdLorebook",
  "useTipInSlurpThread",
  "useTipSlurpCreator",
  "useToggleNoodlerFollow",
  "useToggleNoodlerSubscription",
  "useTriggerNoodlerCreatorReply",
  "useUnhideSlurpAdBrand",
  "useUnlockNoodlerPost",
  "useUnlockSlurpMessage",
  "useUpdateAmbientProfile",
  "useUpdateNoodlerAccess",
  "useUpdateNoodlerAutoPosting",
  "useUpdateNoodlerFanActivity",
  "useUpdateNoodlerInteraction",
  "useUpdateNoodlerPost",
  "useUpdateNoodlerProfileLocation",
  "useUpdateNoodlerScheduleSlot",
  "useUpdateNoodlerStageProfile",
  "useUpdateSlurpAd",
  "useUpdateSlurpArcConfig",
  "useUpdateSlurpConnectionsForCreators",
  "useUpdateSlurpImageConnections",
  "useUpdateSlurpPostGuidance",
  "useUpdateSlurpProject",
  "useUpdateSlurpSettings",
  "useUploadNoodlerAvatar",
  "useUploadNoodlerBanner",
  "useUseNoodlerSourceAvatar",
];
const exported = new Map<string, string[]>();
for (const [path, source] of sources) {
  for (const match of source.matchAll(/^export\s+(?:async\s+)?(?:function|const|type)\s+([A-Za-z0-9_]+)/gmu)) {
    exported.set(match[1], [...(exported.get(match[1]) ?? []), path]);
  }
}
for (const name of EXPORTED_BEFORE) {
  const where = exported.get(name) ?? [];
  assert.equal(where.length, 1, `${name} must have exactly one definition, found ${where.length}: ${where}`);
}

// 2. One query-key factory per cache, and the key values themselves are untouched.
const factories = [...combined.matchAll(/^export const ([A-Za-z0-9_]+Keys) = \{/gmu)].map((m) => m[1]).sort();
assert.deepEqual(factories, ["messageKeys", "noodleKeys"], "exactly two query-key factories may exist");
const NOODLE_KEYS_BEFORE = `export const noodleKeys = {
  all: ["noodle"] as const,
  bootstrap: () => [...noodleKeys.all, "bootstrap"] as const,
  settings: () => ["slurp", "settings"] as const,
  refreshIndicator: () => [...noodleKeys.all, "refresh-indicator"] as const,
  noodlerRoot: () => [...noodleKeys.all, "noodler"] as const,
  noodlerAccounts: () => [...noodleKeys.noodlerRoot(), "accounts"] as const,
  noodlerConnectionCounts: () => [...noodleKeys.noodlerRoot(), "connection-counts"] as const,
  noodlerEligibleAccountsRoot: () => [...noodleKeys.noodlerRoot(), "eligible"] as const,
  noodlerEligibleAccounts: (search: string, kind: string) =>
    [...noodleKeys.noodlerEligibleAccountsRoot(), search, kind] as const,
  noodlerPosts: (accountId: string) => [...noodleKeys.noodlerRoot(), "posts", accountId] as const,
  noodlerSubscribers: (accountId: string) => [...noodleKeys.noodlerRoot(), "subscribers", accountId] as const,
  noodlerFollowers: (accountId: string) => [...noodleKeys.noodlerRoot(), "followers", accountId] as const,
  audienceMember: (memberId: string, creatorAccountId: string) =>
    [...noodleKeys.noodlerRoot(), "audience", memberId, creatorAccountId] as const,
  noodlerViewers: () => [...noodleKeys.noodlerRoot(), "viewers"] as const,
  viewer: (personaId: string) => [...noodleKeys.noodlerViewers(), personaId] as const,
  noodlerUnseenCount: (personaId: string) => [...noodleKeys.noodlerViewers(), "unseen-count", personaId] as const,
  noodlerReserveStatus: () => [...noodleKeys.noodlerRoot(), "reserve-status"] as const,
  noodlerImageConnections: () => [...noodleKeys.noodlerRoot(), "image-connections"] as const,
  noodlerPostGuidance: () => [...noodleKeys.noodlerRoot(), "post-guidance"] as const,
  noodlerFanStatus: () => [...noodleKeys.noodlerRoot(), "fan-status"] as const,
  // contextTags belongs in the key: it is part of the request, so leaving it
  // out meant switching tab or crossing into evening never refetched.
  ads: (personaId: string, creatorId?: string | null, contextTags: string[] = []) =>
    [...noodleKeys.noodlerViewers(), "ads", personaId, creatorId ?? "none", contextTags] as const,
  adPool: () => [...noodleKeys.noodlerRoot(), "ad-pool"] as const,
  adState: (personaId: string) => [...noodleKeys.noodlerViewers(), "ad-state", personaId] as const,
};`;
assert.equal(
  readFileSync(join(slpRoot, "base/state/slp-query-keys.ts"), "utf8").match(
    /export const noodleKeys = \{[\s\S]*?\n\};/u,
  )?.[0],
  NOODLE_KEYS_BEFORE,
  "noodleKeys values and ordering must be preserved exactly",
);
// `messageKeys` still hangs off the same root, so messaging invalidation still matches.
assert.match(
  readFileSync(join(slpRoot, "features/messages/slp-message-keys.ts"), "utf8"),
  /root: \(\) => \[\.\.\.noodleKeys\.noodlerRoot\(\), "messages"\]/u,
);

// 3. Endpoint and HTTP-method preservation: the same request multiset, nothing added or dropped.
const CALLS_BEFORE = [
  "delete /slurp2/noodler/accounts/${encodeURIComponent(accountId)}",
  "delete /slurp2/noodler/accounts/${encodeURIComponent(accountId)}/avatar",
  "delete /slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId)}/projects/${encodeURIComponent(projectId)}?personaId=${encodeURIComponent(personaId)}",
  "delete /slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId)}/subscribe?personaId=${encodeURIComponent(personaId)}",
  "delete /slurp2/noodler/ads/pool/${encodeURIComponent(promotionId)}",
  "delete /slurp2/noodler/posts/${encodeURIComponent(id)}?accountId=${encodeURIComponent(accountId)}",
  "delete /slurp2/noodler/posts/${encodeURIComponent(postId)}/interactions/${encodeURIComponent(interactionId)}?personaId=${encodeURIComponent(personaId)}",
  "delete /slurp2/noodler/posts/${encodeURIComponent(postId)}/interactions?${params}",
  "get /slurp2/backstage/improvement-jobs",
  "get /slurp2/maintenance/summary",
  "get /slurp2/messages/compose-targets?personaId=${encodeURIComponent(personaId!)}",
  "get /slurp2/messages/threads/${encodeURIComponent(threadId!)}/prompt?personaId=${encodeURIComponent(personaId!)}",
  "get /slurp2/noodler/account-connection-counts",
  "get /slurp2/noodler/accounts",
  "get /slurp2/noodler/accounts/${encodeURIComponent(accountId!)}/posts?${query.toString()}",
  "get /slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId!)}/arc-config?personaId=${encodeURIComponent(personaId!)}",
  "get /slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId!)}/arcs?personaId=${encodeURIComponent(personaId!)}",
  "get /slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId!)}/projects?personaId=${encodeURIComponent(personaId!)}",
  "get /slurp2/noodler/ads/pool",
  "get /slurp2/noodler/audience/${encodeURIComponent(memberId!)}?creatorAccountId=${encodeURIComponent(creatorAccountId ?? ",
  "get /slurp2/noodler/auto-post/status",
  "get /slurp2/noodler/creator-metrics",
  "get /slurp2/noodler/image-connections",
  "get /slurp2/noodler/post-guidance",
  "get /slurp2/noodler/viewer-wallets",
  "get /slurp2/noodler/viewer/ads?personaId=${encodeURIComponent(personaId!)}${creatorId ? ",
  "get /slurp2/noodler/viewer/unseen-count?personaId=${encodeURIComponent(personaId!)}",
  "get /slurp2/noodler/viewer/wallet?personaId=${encodeURIComponent(personaId!)}",
  "get /slurp2/noodler/viewer?personaId=${encodedPersonaId}",
  "get /slurp2/settings",
  "get /slurp2/settings/audience-characters/groups",
  "get /slurp2/settings/defaults",
  "get /slurp2/settings/prompt-blocks",
  "patch /slurp2/accounts/${encodeURIComponent(accountId)}/settings",
  "patch /slurp2/accounts/${encodeURIComponent(accountId)}/settings",
  "patch /slurp2/accounts/${encodeURIComponent(accountId)}/settings",
  "patch /slurp2/accounts/${encodeURIComponent(input.accountId)}/profile",
  "patch /slurp2/ambient-profiles/${encodeURIComponent(id)}",
  "patch /slurp2/messages/creators/${encodeURIComponent(creatorAccountId)}/settings",
  "patch /slurp2/noodler/accounts/${encodeURIComponent(accountId)}/avatar/source",
  "patch /slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId)}/follow",
  "patch /slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId)}/projects/${encodeURIComponent(projectId)}",
  "patch /slurp2/noodler/ads/pool/${encodeURIComponent(id)}",
  "patch /slurp2/noodler/auto-post/schedule/${encodeURIComponent(slotId)}",
  "patch /slurp2/noodler/image-connections",
  "patch /slurp2/noodler/image-connections",
  "patch /slurp2/noodler/post-guidance",
  "patch /slurp2/noodler/posts/${encodeURIComponent(id)}",
  "patch /slurp2/noodler/posts/${encodeURIComponent(postId)}/interactions/${encodeURIComponent(interactionId)}",
  "patch /slurp2/settings",
  "post /slurp2/accounts/${encodeURIComponent(accountId)}/post-draft",
  "post /slurp2/accounts/${encodeURIComponent(sourceAccountId)}/noodler",
  "post /slurp2/ambient-profiles/reroll",
  "post /slurp2/arc-library/${encodeURIComponent(id)}/reset",
  "post /slurp2/autopurge/preview",
  "post /slurp2/autopurge/run",
  "post /slurp2/backstage/improvement-jobs",
  "post /slurp2/backstage/improvement-jobs/${encodeURIComponent(jobId)}/${action}",
  "post /slurp2/backstage/improvement-jobs/${encodeURIComponent(jobId)}/dismiss",
  "post /slurp2/discovery-tags/delete",
  "post /slurp2/discovery-tags/rename",
  "post /slurp2/messages/${encodeURIComponent(input.messageId)}/reaction",
  "post /slurp2/messages/commissions",
  "post /slurp2/messages/commissions/${encodeURIComponent(input.commissionId)}/accept",
  "post /slurp2/messages/commissions/${encodeURIComponent(input.commissionId)}/counter",
  "post /slurp2/messages/commissions/${encodeURIComponent(input.commissionId)}/decline",
  "post /slurp2/messages/commissions/${encodeURIComponent(input.commissionId)}/deliver",
  "post /slurp2/messages/commissions/${encodeURIComponent(input.commissionId)}/quote",
  "post /slurp2/messages/compose",
  "post /slurp2/messages/creators/${encodeURIComponent(input.creatorAccountId)}/broadcast",
  "post /slurp2/messages/creators/${encodeURIComponent(input.creatorAccountId)}/ppv",
  "post /slurp2/messages/send",
  "post /slurp2/messages/threads/${encodeURIComponent(input.threadId)}/cancel-follow-up",
  "post /slurp2/messages/threads/${encodeURIComponent(input.threadId)}/force-reply",
  "post /slurp2/messages/threads/${encodeURIComponent(input.threadId)}/image",
  "post /slurp2/messages/threads/${encodeURIComponent(input.threadId)}/request",
  "post /slurp2/messages/threads/${encodeURIComponent(input.threadId)}/reset",
  "post /slurp2/messages/tip",
  "post /slurp2/noodler/accounts/${encodeURIComponent(accountId)}/artwork/generate",
  "post /slurp2/noodler/accounts/${encodeURIComponent(accountId)}/auto-post/run-now",
  "post /slurp2/noodler/accounts/${encodeURIComponent(accountId)}/source/${action}",
  "post /slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId)}/arc-library/generate",
  "post /slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId)}/payout",
  "post /slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId)}/projects",
  "post /slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId)}/projects/${encodeURIComponent(projectId)}/director",
  "post /slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId)}/projects/${encodeURIComponent(projectId)}/library",
  "post /slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId)}/projects/${encodeURIComponent(projectId)}/profile",
  "post /slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId)}/projects/generate",
  "post /slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId)}/subscribe",
  "post /slurp2/noodler/accounts/${encodeURIComponent(input.accountId)}/tip",
  "post /slurp2/noodler/ads/${encodeURIComponent(promotionId)}/image",
  "post /slurp2/noodler/ads/lorebook/sync",
  "post /slurp2/noodler/ads/pool",
  "post /slurp2/noodler/auto-post/refresh-targeted",
  "post /slurp2/noodler/first-posts/enqueue",
  "post /slurp2/noodler/notifications/seen",
  "post /slurp2/noodler/post-guidance-draft",
  "post /slurp2/noodler/posts/${encodeURIComponent(id)}/image/generate",
  "post /slurp2/noodler/posts/${encodeURIComponent(postId)}/interactions",
  "post /slurp2/noodler/posts/${encodeURIComponent(postId)}/interactions/${encodeURIComponent(interactionId)}/creator-reply",
  "post /slurp2/noodler/posts/${encodeURIComponent(postId)}/unlock",
  "post /slurp2/noodler/refresh/images",
  "post /slurp2/noodler/viewer/ads/${encodeURIComponent(promotionId)}/action",
  "post /slurp2/noodler/viewer/ads/${encodeURIComponent(promotionId)}/hide",
  "post /slurp2/noodler/viewer/ads/brand/hide",
  "post /slurp2/noodler/viewer/ads/brand/unhide",
  "post /slurp2/noodler/viewer/ads/reset",
  "post /slurp2/noodler/viewer/mark-seen",
  "post /slurp2/noodler/viewer/wallet/daily-refill",
  "post /slurp2/noodler/viewer/wallet/dev-set",
  "put /slurp2/noodler/accounts/${encodeURIComponent(accountId)}/stage-profile",
  "put /slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId)}/arc-config",
  "put /slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId)}/goal",
  "put /slurp2/noodler/accounts/${encodeURIComponent(input.accountId)}/subscription-price",
  "raw ${url.pathname.slice(4)}${url.search}",
  "raw /slurp2/backup/jobs",
  "raw /slurp2/backup/jobs/${encodeURIComponent(id)}",
  "raw /slurp2/backup/jobs/${encodeURIComponent(id)}/download",
  "raw /slurp2/restore/inspections",
  "raw /slurp2/restore/inspections/${encodeURIComponent(inspectionId)}",
  "raw /slurp2/restore/inspections/${encodeURIComponent(inspectionId)}/apply${importSettings ? ",
  "raw /slurp2/restore/jobs${importSettings ? ",
  "upload /slurp2/noodler/accounts/${encodeURIComponent(accountId)}/avatar",
  "upload /slurp2/noodler/accounts/${encodeURIComponent(accountId)}/banner",
  "upload /slurp2/noodler/posts/${encodeURIComponent(id)}/media",
];
const calls = [
  ...combined.matchAll(/api\.(get|post|put|patch|delete|upload|raw)\s*(?:<[^;]*?>)?\s*\(\s*[`"]([^`"]*)/gu),
]
  .map((m) => `${m[1]} ${m[2]}`)
  .sort();
assert.deepEqual(calls, [...CALLS_BEFORE].sort(), "client request paths and HTTP methods must be unchanged");

// 4. Mutation and invalidation behaviour: the cache-touching call counts did not drift.
const counts = Object.fromEntries(
  [
    "useMutation",
    "useQuery",
    "useInfiniteQuery",
    "invalidateQueries",
    "setQueryData",
    "cancelQueries",
    "removeQueries",
    "refetchQueries",
    "onMutate",
    "onError",
    "onSettled",
  ].map((name) => [name, combined.split(name).length - 1]),
);
assert.deepEqual(
  counts,
  {
    useMutation: 130,
    useQuery: 186,
    useInfiniteQuery: 5,
    invalidateQueries: 124,
    setQueryData: 15,
    cancelQueries: 5,
    removeQueries: 1,
    refetchQueries: 1,
    onMutate: 2,
    onError: 3,
    onSettled: 3,
  },
  "query and mutation wiring counts must match the monolith",
);

// The shared invalidators are still called directly from the mutation callbacks that owned them.
const invalidatorCalls = {
  invalidateSlurpMessages: [...combined.matchAll(/=>\s*invalidateSlurpMessages\(/gu)].length,
  invalidateSlurpProjects: [...combined.matchAll(/=>\s*invalidateSlurpProjects\(/gu)].length,
  mergeSlurpViewerShell: [...combined.matchAll(/=>\s*mergeSlurpViewerShell\(/gu)].length,
};
assert.deepEqual(
  invalidatorCalls,
  { invalidateSlurpMessages: 21, invalidateSlurpProjects: 5, mergeSlurpViewerShell: 3 },
  "shared invalidation helpers must stay wired to the same call sites",
);

// 5. Feature ownership: a sample hook from every owning module lives where it belongs.
for (const [name, path] of [
  ["noodleKeys", "base/state/slp-query-keys.ts"],
  ["cursorQuery", "base/state/slp-page-cursor.ts"],
  ["useSlurpUIStore", "base/state/slp-package-store.ts"],
  ["useSlurpMediaSrc", "base/media/slp-media-src.ts"],
  ["useSlurpConnections", "base/state/slp-host-connections.ts"],
  ["useSlurpInlineAds", "features/ads/slp-ads-hooks.ts"],
  ["useSlurpSettings", "features/settings/slp-settings-hooks.ts"],
  ["useSlurpImageConnections", "features/media/slp-image-connection-hooks.ts"],
  ["useSlurpPostGuidance", "features/settings/slp-post-guidance-contract.ts"],
  ["startSlurpBackup", "features/maintenance/slp-backup.ts"],
  ["useRunSlurpAutopurge", "features/maintenance/slp-maintenance-hooks.ts"],
  ["useSlurpImprovementJobs", "features/maintenance/slp-improvement-hooks.ts"],
  ["useSlurpDiscoveryTagUsage", "features/discovery/slp-discovery-tag-hooks.ts"],
  ["filterAndSortSlurpCreators", "features/discovery/slp-discovery.ts"],
  ["useNoodlerAccounts", "features/creators/slp-creators-hooks.ts"],
  ["useUpdateNoodlerStageProfile", "features/creators/slp-creator-profile-hooks.ts"],
  ["useRefreshTargetedNoodlerCreatorsNow", "features/creators/slp-creator-refresh-hooks.ts"],
  ["refreshSlurpCreatorBatch", "features/creators/slp-refresh-batch.ts"],
  ["useNoodlerSubscribers", "features/audience/slp-audience-hooks.ts"],
  ["useSlurpAmbientProfiles", "features/audience/slp-ambient-profile-hooks.ts"],
  ["useNoodlerFanActivityStatus", "features/audience/slp-fan-activity-hooks.ts"],
  ["useSlurpWallet", "features/economy/slp-economy-hooks.ts"],
  ["useSlurpNotifications", "features/notifications/slp-notification-hooks.ts"],
  ["useSlurpProjects", "features/projects/slp-projects-hooks.ts"],
  ["useNoodlerPosts", "features/feed/slp-feed-post-hooks.ts"],
  ["useNoodlerViewer", "features/feed/slp-feed-viewer-hooks.ts"],
  ["useNoodlerReserveStatus", "features/feed/slp-feed-schedule-hooks.ts"],
  ["useEnqueueNoodlerFirstPosts", "features/onboarding/slp-first-post-hooks.ts"],
  ["messageKeys", "features/messages/slp-message-keys.ts"],
  ["useSlurpThread", "features/messages/slp-messages-hooks.ts"],
  ["useSendSlurpMessage", "features/messages/slp-message-action-hooks.ts"],
  ["useCreateSlurpCommission", "features/messages/commissions/slp-commission-hooks.ts"],
] as const) {
  assert.deepEqual(exported.get(name), [path], `${name} must live in ${path}`);
}

// 6. The generic Engine persona hook stays outside Slurp and keeps the package API-client override.
const generic = join(clientSrc, "hooks/use-creator-personas.ts");
assert.ok(existsSync(generic), "the generic persona hook must stay outside the slp roots");
assert.doesNotMatch(readFileSync(generic, "utf8"), /\/slp\//u, "the generic hook must not reach into Slurp");
assert.ok(!paths.some((path) => /creator-personas/u.test(path)), "Slurp must not fork the generic persona hook");
const apiClient = join(clientSrc, "lib/api-client.ts");
assert.ok(existsSync(apiClient), "the package-owned API client must stay at lib/api-client.ts");
assert.match(
  readFileSync(apiClient, "utf8"),
  /apiBaseUrl|API_BASE|host/iu,
  "the API-client host override must survive",
);

// 7. No client `slp` file reaches into server `slp`; the shared rules are the only crossing point.
for (const [path, source] of sources) {
  for (const match of source.matchAll(/from\s*"([^"]+)"/gu)) {
    assert.ok(!/server\/src\/slp/u.test(match[1]), `${path} must not import server slp code: ${match[1]}`);
  }
}

// 8. Nothing in the new namespace is a barrel or an oversized file.
for (const path of paths) {
  assert.ok(!/(^|\/)index\.tsx?$/u.test(path), `${path} must not be a generic barrel`);
  assert.ok((sources.get(path) ?? "").split("\n").length <= 800, `${path} must stay under 800 lines`);
}

console.log("Slurp2 client hook split regressions passed.");
