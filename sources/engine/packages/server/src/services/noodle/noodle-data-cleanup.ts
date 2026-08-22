export type NoodleCleanupAccount = {
  id: string;
  kind: string;
  entityId: string;
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
          (account.kind === "persona" && !personaIds.has(account.entityId)),
      )
      .map((account) => account.id),
  );
}
