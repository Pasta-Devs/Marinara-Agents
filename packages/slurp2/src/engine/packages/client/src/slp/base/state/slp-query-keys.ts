export const slpKeys = {
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
  notificationsRoot: () => [...slpKeys.noodlerRoot(), "notifications"] as const,
  notifications: (personaId: string) => [...slpKeys.notificationsRoot(), "stream", personaId] as const,
  notificationUnseenCount: (personaId: string) => [...slpKeys.notificationsRoot(), "unseen-count", personaId] as const,
  // contextTags belongs in the key: it is part of the request, so leaving it
  // out meant switching tab or crossing into evening never refetched.
  ads: (personaId: string, creatorId?: string | null, contextTags: string[] = []) =>
    [...slpKeys.slpCreatorViewers(), "ads", personaId, creatorId ?? "none", contextTags] as const,
  adPool: () => [...slpKeys.noodlerRoot(), "ad-pool"] as const,
  adState: (personaId: string) => [...slpKeys.slpCreatorViewers(), "ad-state", personaId] as const,
};
