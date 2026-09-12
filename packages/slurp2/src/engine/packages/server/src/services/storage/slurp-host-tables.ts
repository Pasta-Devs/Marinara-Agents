/**
 * Slurp declares its own file tables, but a host that predates the Engine's `registerTables`
 * API cannot accept them. On such a host every read or write of a package-owned table throws
 * `[file-storage] Unsupported table`, which turned into a 500 on surfaces that predate those
 * tables — the feed included, because follower counts now read the funnel.
 *
 * Degrade instead: the features that need the missing table behave as if it were empty, and
 * everything else keeps working. `server-entry` already warns once when the host is too old.
 *
 * ponytail: writes are dropped on such a host, which is correct only because the data has
 * nowhere to go. Delete this whole file once the minimum Engine has `registerTables`.
 */
const UNSUPPORTED = "[file-storage] Unsupported table";

export function isUnsupportedTableError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith(UNSUPPORTED);
}

/**
 * Wrap a storage object so each method falls back instead of throwing when the host rejects
 * the table. A method with no entry in `fallbacks` resolves to `undefined`, which is what the
 * void methods want.
 */
export function tolerateMissingTables<T extends object>(
  storage: T,
  fallbacks: Partial<Record<keyof T, (...args: never[]) => unknown>>,
): T {
  return new Proxy(storage, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        const fallback = () => (fallbacks[key as keyof T] as ((...a: unknown[]) => unknown) | undefined)?.(...args);
        try {
          const result = (value as (...a: unknown[]) => unknown).apply(target, args);
          return result instanceof Promise
            ? result.catch((error: unknown) => {
                if (isUnsupportedTableError(error)) return fallback();
                throw error;
              })
            : result;
        } catch (error) {
          if (isUnsupportedTableError(error)) return fallback();
          throw error;
        }
      };
    },
  });
}
