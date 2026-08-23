export function normalizeNoodleHandle(value: string): string {
  return value.trim().replace(/^@/u, "").toLowerCase();
}

/**
 * Lookup keys for one generated handle. Local models answer with the display
 * name, or with the handle stripped of its punctuation, far more often than
 * they answer with the exact handle. Both forms name a real account, so both
 * must resolve instead of silently dropping the post.
 */
export function noodleHandleLookupKeys(value: string): string[] {
  const normalized = normalizeNoodleHandle(value);
  const compact = normalized.replace(/[^\p{L}\p{N}]+/gu, "");
  return compact && compact !== normalized ? [normalized, compact] : [normalized];
}

type HandleBearer = { handle: string; displayName: string };

export function noodleAccountHandleKeys(account: HandleBearer): string[] {
  return [...new Set([...noodleHandleLookupKeys(account.handle), ...noodleHandleLookupKeys(account.displayName)])];
}

export function noodleHandleKeySet(accounts: readonly HandleBearer[]): Set<string> {
  return new Set(accounts.flatMap((account) => noodleAccountHandleKeys(account)));
}

export function noodleHandleKeySetHas(keys: ReadonlySet<string>, value: string): boolean {
  return noodleHandleLookupKeys(value).some((key) => keys.has(key));
}

/**
 * Resolve a generated handle to an account. Exact handles are registered
 * first so a display name can never steal another account's post.
 */
export function createNoodleHandleResolver<T extends HandleBearer>(accounts: readonly T[]) {
  const byKey = new Map<string, T>();
  const add = (key: string, account: T) => {
    if (key && !byKey.has(key)) byKey.set(key, account);
  };
  for (const account of accounts) add(normalizeNoodleHandle(account.handle), account);
  for (const account of accounts) for (const key of noodleAccountHandleKeys(account)) add(key, account);
  return (value: string | null | undefined): T | undefined => {
    if (!value) return undefined;
    for (const key of noodleHandleLookupKeys(value)) {
      const account = byKey.get(key);
      if (account) return account;
    }
    return undefined;
  };
}
