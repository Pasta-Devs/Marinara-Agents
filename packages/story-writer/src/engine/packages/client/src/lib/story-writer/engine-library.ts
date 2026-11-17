// ──────────────────────────────────────────────
// Story Writer: its cached copies of the Engine's library, and what keeps them current
// ──────────────────────────────────────────────
// A package's query keys start with its id (the Engine's docs/development/optional-agent-packages.md), so the
// Engine's own invalidations of ["characters"], ["personas"] and ["lorebooks"] never reach these copies. Story Writer
// follows those Engine keys in the shared cache instead (Pasta-Devs/Marinara-Agents#2355).
import type { QueryClient, QueryKey } from "@tanstack/react-query";

export const engineResourceKeys = {
  connections: ["story-writer", "engine", "connections"] as const,
  characters: ["story-writer", "engine", "characters"] as const,
  characterCards: ["story-writer", "engine", "character"] as const,
  character: (id: string) => [...engineResourceKeys.characterCards, id] as const,
  personas: ["story-writer", "engine", "personas"] as const,
  lorebooks: ["story-writer", "engine", "lorebooks"] as const,
  fonts: ["story-writer", "engine", "fonts"] as const,
};

// The first part of an Engine key (characterKeys, personaCacheKeys and lorebookKeys in the Engine client) and the
// Story Writer copies it feeds.
// ponytail: these Engine key names are not a host contract (the host overlay's use-characters.ts mirrors them too);
// switch to a library-change event if the Engine ever publishes one.
const FOLLOWED = new Map<unknown, readonly QueryKey[]>([
  ["characters", [engineResourceKeys.characters, engineResourceKeys.characterCards]],
  ["personas", [engineResourceKeys.personas]],
  ["lorebooks", [engineResourceKeys.lorebooks]],
]);

/**
 * Marks Story Writer's copies stale whenever the Engine invalidates or writes (`setQueryData`) a query under the key it
 * copies, and a list on screen refetches. Fetches never count, and the many events of one Engine mutation refetch each
 * copy once. Returns the unsubscribe function.
 */
export function followEngineLibrary(queryClient: QueryClient): () => void {
  const changed = new Set<readonly QueryKey[]>();
  const flush = () => {
    for (const keys of changed) for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
    changed.clear();
  };
  return queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "updated") return;
    const { action } = event;
    if (action.type !== "invalidate" && !(action.type === "success" && action.manual)) return;
    const [family, part] = event.query.queryKey;
    // Every chat generation re-reads which lorebooks that chat has active: not a library change.
    if (family === "lorebooks" && part === "active") return;
    const keys = FOLLOWED.get(family);
    if (!keys) return;
    if (changed.size === 0) queueMicrotask(flush);
    changed.add(keys);
  });
}
