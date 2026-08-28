export type NoodleCleanupAccount = {
  id: string;
  kind: string;
  entityId: string;
  invited?: boolean | string;
};

export type NoodleDataDeletionCounts = {
  accounts: number;
  posts: number;
  interactions: number;
  digests: number;
  refreshRuns: number;
  subscriptions: number;
  unlocks: number;
};

export function staleNoodleAccountIds(
  accounts: readonly NoodleCleanupAccount[],
  characterIds: ReadonlySet<string>,
  personaIds: ReadonlySet<string>,
): Set<string> {
  return new Set(
    accounts
      .filter(
        (account) =>
          (account.kind === "character" && !characterIds.has(account.entityId)) ||
          (account.kind === "persona" && !personaIds.has(account.entityId)) ||
          ((account.kind === "character" || account.kind === "random_user") &&
            (account.invited === false || account.invited === "false")),
      )
      .map((account) => account.id),
  );
}

export async function applyNoodleCleanupIfStillStale(input: {
  plannedAccountIds: readonly string[];
  currentAccounts: readonly NoodleCleanupAccount[];
  characterIds: ReadonlySet<string>;
  personaIds: ReadonlySet<string>;
  counts: NoodleDataDeletionCounts;
  apply: () => Promise<void>;
}): Promise<NoodleDataDeletionCounts> {
  const currentStaleAccountIds = staleNoodleAccountIds(input.currentAccounts, input.characterIds, input.personaIds);
  if (input.plannedAccountIds.some((accountId) => !currentStaleAccountIds.has(accountId))) {
    return {
      accounts: 0,
      posts: 0,
      interactions: 0,
      digests: 0,
      refreshRuns: 0,
      subscriptions: 0,
      unlocks: 0,
    };
  }
  await input.apply();
  return input.counts;
}
