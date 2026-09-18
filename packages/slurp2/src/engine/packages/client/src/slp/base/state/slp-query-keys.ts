export const noodleKeys = {
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
};
