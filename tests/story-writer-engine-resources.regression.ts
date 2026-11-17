import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import {
  engineResourceKeys,
  followEngineLibrary,
} from "../packages/story-writer/src/engine/packages/client/src/lib/story-writer/engine-library.ts";

// Story Writer's Cast keeps its own copies of the Engine's characters, personas and lorebooks, under keys that start
// with its package id. These run the cache operations the Engine's create, edit and delete mutations run on the
// Engine's React Query, and check that the copies go stale (Pasta-Devs/Marinara-Agents#2355). Needs an Engine checkout
// with node_modules for React Query (MARINARA_ENGINE_ROOT, or ../Marinara-Engine).
const repoRoot = resolve(import.meta.dirname, "..");
const engineRoot = resolve(process.env.MARINARA_ENGINE_ROOT || join(repoRoot, "../Marinara-Engine"));
const engineClient = join(engineRoot, "packages/client");
if (!existsSync(join(engineClient, "node_modules/@tanstack/react-query/package.json"))) {
  console.log("Story Writer engine-resources regression skipped: set MARINARA_ENGINE_ROOT to an Engine checkout");
  process.exit(0);
}

const { QueryClient, QueryObserver } = createRequire(join(engineClient, "package.json"))("@tanstack/react-query");

// The Engine's defaults (packages/client/src/lib/query-client.ts).
function engineQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } });
}

const settle = () => new Promise((done) => setTimeout(done, 0));

function seedStoryWriter(qc: any) {
  qc.setQueryData(engineResourceKeys.characters, [{ id: "c1", name: "Ada", avatarUrl: null, detail: "" }]);
  qc.setQueryData(engineResourceKeys.character("c1"), { id: "c1", name: "Ada", data: "{}" });
  qc.setQueryData(engineResourceKeys.personas, [{ id: "p1", name: "Reader" }]);
  qc.setQueryData(engineResourceKeys.lorebooks, [{ id: "l1", name: "World" }]);
}

function staleCopies(qc: any): string[] {
  const keys = {
    characters: engineResourceKeys.characters,
    character: engineResourceKeys.character("c1"),
    personas: engineResourceKeys.personas,
    lorebooks: engineResourceKeys.lorebooks,
  };
  return Object.entries(keys)
    .filter(([, queryKey]) => qc.getQueryState(queryKey)?.isInvalidated)
    .map(([name]) => name);
}

test("a character the Engine creates marks the Cast's characters and prompt cards stale", async () => {
  const qc = engineQueryClient();
  // The Engine's Characters panel has its catalog pages and the chat list's summaries cached.
  qc.setQueryData(["characters", "list", "catalog", 0, "name-asc"], { items: [], hasMore: false });
  qc.setQueryData(["characters", "summaries", "c1"], []);
  seedStoryWriter(qc);
  const stop = followEngineLibrary(qc);

  // useCreateCharacter's onSuccess (packages/client/src/hooks/use-characters.ts).
  void qc.invalidateQueries({ queryKey: ["characters", "list"] });
  void qc.invalidateQueries({ queryKey: ["characters", "summaries"] });
  await settle();

  assert.deepEqual(staleCopies(qc), ["characters", "character"]);
  stop();
  qc.clear();
});

test("a persona the Engine creates marks the Cast's personas stale, with no Engine persona list loaded", async () => {
  const { syncCachedPersona } = await import(pathToFileURL(join(engineClient, "src/lib/persona-cache.ts")).href);
  const qc = engineQueryClient();
  seedStoryWriter(qc);
  const stop = followEngineLibrary(qc);

  // useCreatePersona's onSuccess: the Engine's own syncCachedPersona only writes the new persona's detail here.
  await syncCachedPersona(qc, { id: "p2", name: "Narrator" });
  void qc.invalidateQueries({ queryKey: ["personas", "page"] });
  await settle();

  assert.deepEqual(staleCopies(qc), ["personas"]);
  stop();
  qc.clear();
});

test("a lorebook the Engine creates marks the Cast's lorebooks stale; a chat's active lorebooks do not", async () => {
  const qc = engineQueryClient();
  qc.setQueryData(["lorebooks", "list", "page", "all", "", "name-asc", ""], { items: [], hasMore: false });
  qc.setQueryData(["lorebooks", "active", "chat-1"], []);
  seedStoryWriter(qc);
  const stop = followEngineLibrary(qc);

  // Every generation re-reads the chat's active lorebooks (packages/client/src/hooks/use-generate.ts).
  void qc.invalidateQueries({ queryKey: ["lorebooks", "active", "chat-1"] });
  await settle();
  assert.deepEqual(staleCopies(qc), []);

  // useCreateLorebook's onSuccess (packages/client/src/hooks/use-lorebooks.ts).
  void qc.invalidateQueries({ queryKey: ["lorebooks"] });
  await settle();
  assert.deepEqual(staleCopies(qc), ["lorebooks"]);
  stop();
  qc.clear();
});

test("an open Cast refetches once per Engine change, never for fetches, its own keys or after unsubscribing", async () => {
  const qc = engineQueryClient();
  qc.setQueryData(["characters", "list", "catalog", 0, "name-asc"], { items: [], hasMore: false });
  qc.setQueryData(["characters", "list", "page", false, "", "name-asc", "all", {}], { items: [], hasMore: false });
  qc.setQueryData(["characters", "summaries", "c1"], []);
  let fetches = 0;
  const observer = new QueryObserver(qc, {
    queryKey: engineResourceKeys.characters,
    queryFn: async () => {
      fetches += 1;
      return [];
    },
  });
  const unobserve = observer.subscribe(() => {});
  await settle();
  assert.equal(fetches, 1, "the open Cast loads its characters");
  const stop = followEngineLibrary(qc);

  // The Engine reading its own lists changes nothing in the library.
  await qc.fetchQuery({ queryKey: ["characters", "detail", "c1"], queryFn: async () => ({ id: "c1" }) });
  await settle();
  assert.equal(fetches, 1, "an Engine fetch refetched the Cast");

  // Story Writer refreshing its own copy is not followed back.
  await qc.invalidateQueries({ queryKey: engineResourceKeys.characters });
  await settle();
  assert.equal(fetches, 2);

  // One create touches three cached Engine queries; the Cast refetches once.
  void qc.invalidateQueries({ queryKey: ["characters", "list"] });
  void qc.invalidateQueries({ queryKey: ["characters", "summaries"] });
  await settle();
  assert.equal(fetches, 3, "one Engine create refetches the open Cast exactly once");

  stop();
  // useUpdateCharacter's detail write, after Story Writer closed.
  qc.setQueryData(["characters", "detail", "c1"], { id: "c1", name: "Ada Lovelace" });
  await settle();
  assert.equal(fetches, 3, "an unsubscribed Story Writer still followed the Engine");
  unobserve();
  qc.clear();
});
