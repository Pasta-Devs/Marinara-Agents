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
  "GeneratedCreatorSlpPost",
  "SlpAmbientProfileRerollResult",
  "SlpPostDraft",
  "SlpPostDraftRequest",
  "SlpRefreshResult",
  "SlpCreatorConnectionCounts",
  "SlpCreatorContentFormat",
  "SlpCreatorFirstPostJob",
  "SlpCreatorPostDraftImage",
  "SlpCreatorViewerWallets",
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
  "slpKeys",
  "startSlurpBackup",
  "startSlurpRestore",
  "useAcceptSlurpCommission",
  "useAdoptCreatorSourceIdentity",
  "useApplySlurpImprovementProposals",
  "useBroadcastSlurpMessage",
  "useBulkCreateCreatorStageProfiles",
  "useBulkUpdateSlurpCreators",
  "useCancelSlurpFollowUp",
  "useClaimSlurpDailyRefill",
  "useConfirmCreatorImagePrompts",
  "useCounterSlurpCommission",
  "useCreateCreatorInteraction",
  "useCreateCreatorPost",
  "useCreateCreatorStageProfile",
  "useCreateSlurpAd",
  "useCreateSlurpCommission",
  "useCreateSlurpImprovementJob",
  "useCreateSlurpProject",
  "useDeclineSlurpCommission",
  "useDeleteAllSlurpData",
  "useDeleteCreatorInteraction",
  "useDeleteCreatorPost",
  "useDeleteCreatorStageProfile",
  "useDeleteSlurpAd",
  "useDeleteSlurpProject",
  "useDeleteUnusedSlurpData",
  "useDeliverSlurpCommission",
  "useDirectSlurpProject",
  "useDismissCreatorSourceChanges",
  "useDismissSlurpImprovementProposals",
  "useDraftSlurpCreatorReply",
  "useEnqueueCreatorFirstPosts",
  "useForceSlurpReply",
  "useGenerateSlpPostDraft",
  "useGenerateCreatorArtwork",
  "useGenerateCreatorSlpPost",
  "useGenerateCreatorPostImage",
  "useGenerateCreatorStageProfileDraft",
  "useGenerateSlurpAdImage",
  "useGenerateSlurpAds",
  "useGenerateSlurpArcType",
  "useGenerateSlurpPostGuidance",
  "useGenerateSlurpProject",
  "useGenerateSlurpViewerImage",
  "useHideSlurpAd",
  "useHideSlurpAdBrand",
  "useImportSlurpAds",
  "useLoadCreatorPostImage",
  "useMarkCreatorFeedSeen",
  "useMarkSlurpNotificationsSeen",
  "useCreatorAccounts",
  "useCreatorConnectionCounts",
  "useCreatorEligibleAccounts",
  "useCreatorFanActivityStatus",
  "useCreatorFirstPostStatus",
  "useCreatorFollowers",
  "useCreatorPosts",
  "useCreatorReserveStatus",
  "useCreatorSubscribers",
  "useCreatorUnseenCount",
  "useCreatorViewer",
  "useCreatorViewerWallets",
  "useOpenSlurpCreatorThread",
  "useQuoteSlurpCommission",
  "useReactToSlurpMessage",
  "useRecordSlurpAdAction",
  "useRecordSlurpStoryView",
  "useRefreshCreatorConversationSchedule",
  "useRefreshCreatorFanActivityNow",
  "useRefreshTargetedCreatorsNow",
  "useRemoveCreatorAvatar",
  "useRemoveCreatorInteraction",
  "useReplaceCreatorPostImage",
  "useReplaceSlurpDiscoveryTag",
  "useRequestSlurpReply",
  "useRerollAmbientProfiles",
  "useResetSlurpAds",
  "useResetSlurpArcType",
  "useResetSlurpThread",
  "useResolveSlurpArcProfile",
  "useResolveSlurpMessageRequest",
  "useRunCreatorAutoPostNow",
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
  "useToggleCreatorFollow",
  "useToggleCreatorSubscription",
  "useTriggerCreatorReply",
  "useUnhideSlurpAdBrand",
  "useUnlockCreatorPost",
  "useUnlockSlurpMessage",
  "useUpdateAmbientProfile",
  "useUpdateCreatorAccess",
  "useUpdateCreatorAutoPosting",
  "useUpdateCreatorFanActivity",
  "useUpdateCreatorInteraction",
  "useUpdateCreatorPost",
  "useUpdateCreatorProfileLocation",
  "useUpdateCreatorScheduleSlot",
  "useUpdateCreatorStageProfile",
  "useUpdateSlurpAd",
  "useUpdateSlurpArcConfig",
  "useUpdateSlurpConnectionsForCreators",
  "useUpdateSlurpImageConnections",
  "useUpdateSlurpPostGuidance",
  "useUpdateSlurpProject",
  "useUpdateSlurpSettings",
  "useUploadCreatorAvatar",
  "useUploadCreatorBanner",
  "useUseCreatorSourceAvatar",
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
assert.deepEqual(factories, ["messageKeys", "slpKeys"], "exactly two query-key factories may exist");
const NOODLE_KEYS_BEFORE = `export const slpKeys = {
  all: ["noodle"] as const,
  bootstrap: () => [...slpKeys.all, "bootstrap"] as const,
  settings: () => ["slurp", "settings"] as const,
  refreshIndicator: () => [...slpKeys.all, "refresh-indicator"] as const,
  noodlerRoot: () => [...slpKeys.all, "noodler"] as const,
  noodlerAccounts: () => [...slpKeys.noodlerRoot(), "accounts"] as const,
  noodlerConnectionCounts: () => [...slpKeys.noodlerRoot(), "connection-counts"] as const,
  noodlerEligibleAccountsRoot: () => [...slpKeys.noodlerRoot(), "eligible"] as const,
  noodlerEligibleAccounts: (search: string, kind: string) =>
    [...slpKeys.noodlerEligibleAccountsRoot(), search, kind] as const,
  noodlerPosts: (accountId: string) => [...slpKeys.noodlerRoot(), "posts", accountId] as const,
  noodlerSubscribers: (accountId: string) => [...slpKeys.noodlerRoot(), "subscribers", accountId] as const,
  noodlerFollowers: (accountId: string) => [...slpKeys.noodlerRoot(), "followers", accountId] as const,
  audienceMember: (memberId: string, creatorAccountId: string) =>
    [...slpKeys.noodlerRoot(), "audience", memberId, creatorAccountId] as const,
  slpCreatorViewers: () => [...slpKeys.noodlerRoot(), "viewers"] as const,
  viewer: (personaId: string) => [...slpKeys.slpCreatorViewers(), personaId] as const,
  noodlerUnseenCount: (personaId: string) => [...slpKeys.slpCreatorViewers(), "unseen-count", personaId] as const,
  noodlerReserveStatus: () => [...slpKeys.noodlerRoot(), "reserve-status"] as const,
  noodlerImageConnections: () => [...slpKeys.noodlerRoot(), "image-connections"] as const,
  noodlerPostGuidance: () => [...slpKeys.noodlerRoot(), "post-guidance"] as const,
  noodlerFanStatus: () => [...slpKeys.noodlerRoot(), "fan-status"] as const,
  // contextTags belongs in the key: it is part of the request, so leaving it
  // out meant switching tab or crossing into evening never refetched.
  ads: (personaId: string, creatorId?: string | null, contextTags: string[] = []) =>
    [...slpKeys.slpCreatorViewers(), "ads", personaId, creatorId ?? "none", contextTags] as const,
  adPool: () => [...slpKeys.noodlerRoot(), "ad-pool"] as const,
  adState: (personaId: string) => [...slpKeys.slpCreatorViewers(), "ad-state", personaId] as const,
};`;
assert.equal(
  readFileSync(join(slpRoot, "base/state/slp-query-keys.ts"), "utf8").match(
    /export const slpKeys = \{[\s\S]*?\n\};/u,
  )?.[0],
  NOODLE_KEYS_BEFORE,
  "slpKeys values and ordering must be preserved exactly",
);
// `messageKeys` still hangs off the same root, so messaging invalidation still matches.
assert.match(
  readFileSync(join(slpRoot, "features/messages/slp-message-keys.ts"), "utf8"),
  /root: \(\) => \[\.\.\.slpKeys\.noodlerRoot\(\), "messages"\]/u,
);

// 3. Endpoint and HTTP-method preservation: the same request multiset, nothing added or dropped.
const callsBefore = readFileSync(join(import.meta.dirname, "fixtures/slurp2-client-hooks.staging.txt"), "utf8")
  .split("\n")
  .map((call) => call.replaceAll("\\u0020", " "))
  .filter(Boolean);
const mapStagingCall = (call: string) => call.replace("/slurp2/noodler/", "/slurp2/slurp/");
const calls = [
  ...combined.matchAll(/api\.(get|post|put|patch|delete|upload|raw)\s*(?:<[^;]*?>)?\s*\(\s*[`"]([^`"]*)/gu),
]
  .map((m) => `${m[1]} ${m[2]}`)
  .sort();
assert.deepEqual(calls, callsBefore.map(mapStagingCall).sort(), "client request paths and HTTP methods must match");

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
    useMutation: 131,
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
  ["slpKeys", "base/state/slp-query-keys.ts"],
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
  ["useCreatorAccounts", "features/creators/slp-creators-hooks.ts"],
  ["useUpdateCreatorStageProfile", "features/creators/slp-creator-profile-hooks.ts"],
  ["useRefreshTargetedCreatorsNow", "features/creators/slp-creator-refresh-hooks.ts"],
  ["refreshSlurpCreatorBatch", "features/creators/slp-refresh-batch.ts"],
  ["useCreatorSubscribers", "features/audience/slp-audience-hooks.ts"],
  ["useSlurpAmbientProfiles", "features/audience/slp-ambient-profile-hooks.ts"],
  ["useCreatorFanActivityStatus", "features/audience/slp-fan-activity-hooks.ts"],
  ["useSlurpWallet", "features/economy/slp-economy-hooks.ts"],
  ["useSlurpNotifications", "features/notifications/slp-notification-hooks.ts"],
  ["useSlurpProjects", "features/projects/slp-projects-hooks.ts"],
  ["useCreatorPosts", "features/feed/slp-feed-post-hooks.ts"],
  ["useCreatorViewer", "features/feed/slp-feed-viewer-hooks.ts"],
  ["useCreatorReserveStatus", "features/feed/slp-feed-schedule-hooks.ts"],
  ["useEnqueueCreatorFirstPosts", "features/onboarding/slp-first-post-hooks.ts"],
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

// 7. The Creators panel must consume the setter names returned by its Backstage state contract.
const creatorsPanel = readFileSync(join(slpRoot, "features/creators/SlpCreatorsPanel.tsx"), "utf8");
assert.match(creatorsPanel, /setCreatorFilter:\s*setFilter/u);
assert.match(creatorsPanel, /setCreatorTab:\s*setTab/u);
assert.doesNotMatch(creatorsPanel, /setSlpCreator(?:Filter|Tab)/u);

// 8. No client `slp` file reaches into server `slp`; the shared rules are the only crossing point.
for (const [path, source] of sources) {
  for (const match of source.matchAll(/from\s*"([^"]+)"/gu)) {
    assert.ok(!/server\/src\/slp/u.test(match[1]), `${path} must not import server slp code: ${match[1]}`);
  }
}

// 9. Nothing in the new namespace is a barrel or an oversized file.
for (const path of paths) {
  assert.ok(!/(^|\/)index\.tsx?$/u.test(path), `${path} must not be a generic barrel`);
  assert.ok((sources.get(path) ?? "").split("\n").length <= 800, `${path} must stay under 800 lines`);
}

console.log("Slurp2 client hook split regressions passed.");
