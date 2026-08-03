import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildPortableLoreBundle,
  importPortableLoreBundle,
  parsePortableLoreBundle,
  planPortableLoreImport,
  remapPortableLoreReferences,
  type PortableLoreApi,
} from "../packages/hierarchical-maps/src/engine/packages/client/src/features/spatial-context/portable-lore";

const definition = {
  schemaVersion: 1,
  ownerMode: "roleplay",
  enabled: true,
  revision: 0,
  startingLocationId: "location-harbor",
  locations: [
    {
      id: "location-harbor",
      parentId: null,
      name: "Gloam Harbor",
      lorebookEntryIds: ["entry-harbor"],
    },
  ],
} as never;
const lorebook = {
  id: "book-coast",
  name: "Shrouded Coast",
  description: "Private campaign lore",
  enabled: false,
  tokenBudget: 1234,
} as never;
const folders = [
  {
    id: "folder-coast",
    lorebookId: "book-coast",
    parentFolderId: null,
    name: "Coast",
    enabled: false,
    order: 2,
  },
  {
    id: "folder-harbor",
    lorebookId: "book-coast",
    parentFolderId: "folder-coast",
    name: "Harbor",
    enabled: true,
    order: 3,
  },
] as never[];
const harborEntry = {
  id: "entry-harbor",
  lorebookId: "book-coast",
  folderId: "folder-harbor",
  name: "Harbor secrets",
  content: "The harbor master keeps a smuggling ledger.",
  keys: ["harbor"],
  enabled: false,
  order: 17,
  relationships: { "entry-lighthouse": "supplies" },
} as never;
const lighthouseEntry = {
  id: "entry-lighthouse",
  lorebookId: "book-coast",
  folderId: "folder-coast",
  name: "Lighthouse signals",
  content: "The blackglass lamp reveals hidden ink.",
  keys: ["lighthouse"],
  enabled: true,
  order: 18,
  relationships: { "entry-harbor": "receives supplies" },
} as never;
const foldersByLorebookId = new Map([["book-coast", folders]]);

const mapOnly = buildPortableLoreBundle({
  definition,
  mode: "map-only",
  lorebooks: [lorebook],
  entries: [harborEntry, lighthouseEntry],
  foldersByLorebookId,
});
assert.equal(mapOnly.books.length, 0);
assert.equal(mapOnly.references[0]?.entryKey, null);
assert.deepEqual(parsePortableLoreBundle(mapOnly), mapOnly);
assert.match(
  `${mapOnly.references[0]?.locationName} -> ${mapOnly.references[0]?.originalLorebookName} -> ${mapOnly.references[0]?.originalEntryName} -> ${mapOnly.references[0]?.originalEntryId}`,
  /Gloam Harbor -> Shrouded Coast -> Harbor secrets -> entry-harbor/u,
);

const linked = buildPortableLoreBundle({
  definition,
  mode: "linked-entries",
  lorebooks: [lorebook],
  entries: [harborEntry, lighthouseEntry],
  foldersByLorebookId,
});
assert.equal(linked.books.length, 1);
assert.equal(linked.books[0]?.entries.length, 1);
assert.deepEqual(
  linked.books[0]?.folders.map((folder) => folder.data.name).sort(),
  ["Coast", "Harbor"],
  "Linked export must retain the entry's complete ancestor folder path",
);
assert.equal(linked.books[0]?.settings.enabled, false);
assert.equal(linked.books[0]?.entries[0]?.data.enabled, false);
assert.deepEqual(parsePortableLoreBundle(linked), linked);

const tamperedLinked = structuredClone(linked);
Object.assign(tamperedLinked.books[0]!.settings, {
  id: "injected-book-id",
  characterId: "foreign-character",
  characterIds: ["foreign-character"],
  personaId: "foreign-persona",
  personaIds: ["foreign-persona"],
  chatId: "foreign-chat",
  isGlobal: true,
  hiddenFromLibrary: true,
  scope: "foreign-scope",
});
tamperedLinked.books[0]!.entries[0]!.data.userId = "injected-user-id";
Object.assign(tamperedLinked.books[0]!.folders[0]!.data, {
  lorebookId: "injected-lorebook-id",
});
const sanitizedLinked = parsePortableLoreBundle(tamperedLinked);
assert.ok(sanitizedLinked);
assert.equal("id" in sanitizedLinked.books[0]!.settings, false);
for (const key of [
  "characterId",
  "characterIds",
  "personaId",
  "personaIds",
  "chatId",
  "isGlobal",
  "hiddenFromLibrary",
  "scope",
]) {
  assert.equal(key in sanitizedLinked.books[0]!.settings, false);
}
assert.equal("userId" in sanitizedLinked.books[0]!.entries[0]!.data, false);
assert.equal("lorebookId" in sanitizedLinked.books[0]!.folders[0]!.data, false);

const complete = buildPortableLoreBundle({
  definition,
  mode: "complete-lorebooks",
  lorebooks: [lorebook],
  entries: [harborEntry, lighthouseEntry],
  foldersByLorebookId,
});
assert.equal(complete.books[0]?.entries.length, 2);
assert.deepEqual(parsePortableLoreBundle(complete), complete);

const exactPlan = planPortableLoreImport(complete, [lorebook], [harborEntry]);
assert.equal(exactPlan.exactMatches, 1);
assert.equal(
  exactPlan.entries.find((entry) => entry.originalEntryId === "entry-harbor")
    ?.candidates[0]?.reason,
  "exact-id",
);

const sameContent = {
  ...harborEntry,
  id: "entry-copy",
  lorebookId: "book-destination",
} as never;
const uniquePlan = planPortableLoreImport(
  linked,
  [{ ...lorebook, id: "book-destination" } as never],
  [sameContent],
);
assert.equal(uniquePlan.uniqueContentMatches, 1);
const ambiguousPlan = planPortableLoreImport(
  linked,
  [{ ...lorebook, id: "book-destination" } as never],
  [sameContent, { ...sameContent, id: "entry-copy-2" } as never],
);
assert.equal(ambiguousPlan.ambiguousMatches, 1);
const nameOnlyPlan = planPortableLoreImport(
  linked,
  [{ ...lorebook, id: "book-destination" } as never],
  [
    {
      ...sameContent,
      id: "entry-name-only",
      content: "Different content",
    } as never,
  ],
);
assert.equal(
  nameOnlyPlan.newEntries,
  1,
  "A matching name alone must never attach a map lore link",
);

async function main() {
  const librarySource = await readFile(
    new URL(
      "../packages/hierarchical-maps/src/engine/packages/client/src/features/spatial-context/SpatialMapLibrary.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.doesNotMatch(
    librarySource,
    /on(?:PointerDown|KeyDown)=\{[^}]*setImportEntriesPrimed/u,
    "Canceled pointer and keyboard activation must not prime every lorebook entry query",
  );
  assert.match(
    librarySource,
    /flushSync\(\(\) => setImportEntriesPrimed\(true\)\);[\s\S]{0,800}importInput\.click\(\)/u,
    "Lorebook entry loading must be flushed only when the import picker actually opens",
  );

  const requests: Array<{ method: string; path: string; body?: unknown }> = [];
  let nextFolder = 0;
  const api: PortableLoreApi = {
    async post<T>(path: string, body?: unknown): Promise<T> {
      requests.push({ method: "POST", path, body });
      if (path === "/lorebooks") return { id: "imported-book" } as T;
      if (path.endsWith("/folders")) {
        nextFolder += 1;
        return { id: `imported-folder-${nextFolder}` } as T;
      }
      if (path.endsWith("/entries/bulk")) {
        const entries = (body as { entries: unknown[] }).entries;
        return entries.map((_, index) => ({
          id: `imported-entry-${index + 1}`,
        })) as T;
      }
      throw new Error(`Unexpected POST ${path}`);
    },
    async patch<T>(path: string, body?: unknown): Promise<T> {
      requests.push({ method: "PATCH", path, body });
      return {} as T;
    },
    async delete<T>(path: string, body?: unknown): Promise<T> {
      requests.push({ method: "DELETE", path, body });
      return undefined as T;
    },
  };
  const ambiguousEntry = ambiguousPlan.entries[0]!;
  const reused = await importPortableLoreBundle({
    api,
    bundle: linked,
    plan: ambiguousPlan,
    strategy: "reuse",
    ambiguousSelections: new Map([[ambiguousEntry.entryKey, "entry-copy"]]),
  });
  assert.equal(reused.reusedEntries, 1);
  assert.equal(reused.importedEntries, 0);
  assert.equal(reused.importedLorebooks, 0);
  await assert.rejects(
    importPortableLoreBundle({
      api,
      bundle: linked,
      plan: ambiguousPlan,
      strategy: "reuse",
    }),
    /Choose how to resolve the duplicate match/u,
  );
  await assert.rejects(
    importPortableLoreBundle({
      api,
      bundle: linked,
      plan: ambiguousPlan,
      strategy: "reuse",
      ambiguousSelections: new Map([[ambiguousEntry.entryKey, "missing-entry"]]),
    }),
    /no longer available/u,
  );
  const importBundle = structuredClone(complete);
  Object.assign(importBundle.books[0]!.settings, {
    characterId: "foreign-character",
    characterIds: ["foreign-character"],
    personaId: "foreign-persona",
    personaIds: ["foreign-persona"],
    chatId: "foreign-chat",
    isGlobal: true,
    hiddenFromLibrary: true,
    scope: "foreign-scope",
  });
  const imported = await importPortableLoreBundle({
    api,
    bundle: importBundle,
    plan: planPortableLoreImport(importBundle, [], []),
    strategy: "separate",
  });
  assert.equal(imported.importedLorebooks, 1);
  assert.equal(imported.importedEntries, 2);
  assert.deepEqual(imported.createdLorebookIds, ["imported-book"]);
  assert.equal(
    requests.some((request) => request.method === "DELETE"),
    false,
    "Imported lorebooks remain after success",
  );
  const createdBookBody = requests.find(
    (request) => request.method === "POST" && request.path === "/lorebooks",
  )?.body as Record<string, unknown>;
  for (const key of [
    "characterId",
    "characterIds",
    "personaId",
    "personaIds",
    "chatId",
    "isGlobal",
    "hiddenFromLibrary",
    "scope",
  ]) {
    assert.equal(key in createdBookBody, false);
  }
  const bulkBody = requests.find((request) =>
    request.path.endsWith("/entries/bulk"),
  )?.body as {
    entries: Array<Record<string, unknown>>;
  };
  assert.equal(bulkBody.entries[0]?.enabled, false);
  assert.equal(
    bulkBody.entries[0]?.relationships &&
      Object.keys(bulkBody.entries[0].relationships as object).length,
    0,
  );
  assert.equal(bulkBody.entries[0]?.folderId, "imported-folder-2");
  const relationshipPatch = requests.find(
    (request) =>
      request.method === "PATCH" &&
      request.path === "/lorebooks/imported-book/entries/imported-entry-1",
  )?.body as { relationships: Record<string, string> } | undefined;
  assert.ok(
    relationshipPatch,
    "The harbor entry must receive a relationship patch",
  );
  assert.equal(relationshipPatch.relationships["imported-entry-2"], "supplies");
  const remapped = remapPortableLoreReferences(
    definition,
    complete,
    imported.entryIdMap,
  );
  assert.deepEqual(remapped.locations[0]?.lorebookEntryIds, [
    "imported-entry-1",
  ]);

  const rollbackRequests: string[] = [];
  await assert.rejects(
    importPortableLoreBundle({
      api: {
        async post<T>(path: string): Promise<T> {
          if (path === "/lorebooks") return { id: "rollback-book" } as T;
          if (path.endsWith("/folders")) return { id: "rollback-folder" } as T;
          throw new Error("Synthetic bulk failure");
        },
        async patch<T>(): Promise<T> {
          return {} as T;
        },
        async delete<T>(path: string): Promise<T> {
          rollbackRequests.push(path);
          return undefined as T;
        },
      },
      bundle: linked,
      plan: planPortableLoreImport(linked, [], []),
      strategy: "separate",
    }),
    /Synthetic bulk failure/u,
  );
  assert.deepEqual(rollbackRequests, ["/lorebooks/rollback-book"]);

  let rollbackFailure: unknown;
  try {
    await importPortableLoreBundle({
      api: {
        async post<T>(path: string): Promise<T> {
          if (path === "/lorebooks") return { id: "orphaned-book" } as T;
          if (path.endsWith("/folders")) return { id: "orphaned-folder" } as T;
          throw new Error("Synthetic import failure");
        },
        async patch<T>(): Promise<T> {
          return {} as T;
        },
        async delete<T>(): Promise<T> {
          throw new Error("Synthetic cleanup failure");
        },
      },
      bundle: linked,
      plan: planPortableLoreImport(linked, [], []),
      strategy: "separate",
    });
  } catch (error) {
    rollbackFailure = error;
  }
  assert.ok(rollbackFailure instanceof Error);
  assert.match(rollbackFailure.message, /orphaned-book/u);
  assert.deepEqual(
    (rollbackFailure as Error & { orphanedLorebookIds?: string[] })
      .orphanedLorebookIds,
    ["orphaned-book"],
  );

  console.info(
    "World Maps portable lore regression passed: export scopes, readable provenance, exact/content/ambiguous matching, no name-only attachment, folder/settings preservation, relationship remapping, atomic rollback, and map-link rewrite.",
  );
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
