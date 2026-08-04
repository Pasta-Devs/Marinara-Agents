import type {
  Lorebook,
  LorebookEntry,
  LorebookFolder,
  SpatialContextDefinition,
} from "@marinara-engine/shared";

export type PortableLoreExportMode =
  | "map-only"
  | "linked-entries"
  | "complete-lorebooks";
export type PortableLoreImportStrategy = "reuse" | "separate";

export interface PortableLoreReference {
  locationId: string;
  locationName: string;
  entryKey: string | null;
  originalLorebookId: string | null;
  originalLorebookName: string;
  originalEntryId: string;
  originalEntryName: string;
}

export interface PortableLoreFolder {
  key: string;
  originalId: string;
  parentKey: string | null;
  data: {
    name: string;
    enabled: boolean;
    order: number;
  };
}

export interface PortableLoreEntry {
  key: string;
  originalId: string;
  name: string;
  folderKey: string | null;
  fingerprint: string;
  data: Record<string, unknown>;
}

export interface PortableLoreBook {
  key: string;
  originalId: string;
  name: string;
  settings: Record<string, unknown>;
  folders: PortableLoreFolder[];
  entries: PortableLoreEntry[];
}

export interface PortableLoreBundle {
  schemaVersion: 1;
  mode: PortableLoreExportMode;
  books: PortableLoreBook[];
  references: PortableLoreReference[];
}

export interface PortableLoreCandidate {
  entryId: string;
  entryName: string;
  lorebookId: string;
  lorebookName: string;
  reason: "exact-id" | "content";
}

export interface PortableLoreImportPlanEntry {
  bookKey: string;
  entryKey: string;
  originalEntryId: string;
  entryName: string;
  originalLorebookName: string;
  candidates: PortableLoreCandidate[];
}

export interface PortableLoreImportPlanBook {
  bookKey: string;
  originalName: string;
  createdName: string;
  entryKeys: string[];
}

export interface PortableLoreImportPlan {
  mapName: string;
  books: PortableLoreImportPlanBook[];
  entries: PortableLoreImportPlanEntry[];
  exactMatches: number;
  uniqueContentMatches: number;
  ambiguousMatches: number;
  newEntries: number;
}

export interface PortableLoreImportOutcome {
  reusedEntries: number;
  importedEntries: number;
  reusedLorebooks: Array<{ id: string; name: string }>;
  createdLorebooks: Array<{ name: string; originalName: string }>;
  unresolvedEntries: number;
}

export interface PortableLorebookImportSummary {
  id: string;
  name: string;
}

export interface PortableLoreImportResult {
  entryIdMap: Map<string, string>;
  reusedEntries: number;
  importedEntries: number;
  importedLorebooks: number;
  createdLorebookIds: string[];
  createdLorebooks: PortableLorebookImportSummary[];
  reusedLorebooks: PortableLorebookImportSummary[];
}

export interface PortableLoreApi {
  post<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  delete<T>(path: string, body?: unknown): Promise<T>;
}

const LOREBOOK_SETTING_KEYS = [
  "description",
  "category",
  "scanDepth",
  "tokenBudget",
  "entryLimit",
  "recursiveScanning",
  "maxRecursionDepth",
  "excludeFromVectorization",
  "vectorQueryDepth",
  "vectorScoreThreshold",
  "vectorMaxResults",
  "enabled",
  "tags",
  "generatedBy",
  "sourceAgentId",
] as const;

const ENTRY_SETTING_KEYS = [
  "content",
  "description",
  "keys",
  "secondaryKeys",
  "enabled",
  "constant",
  "selective",
  "selectiveLogic",
  "probability",
  "scanDepth",
  "matchWholeWords",
  "caseSensitive",
  "useRegex",
  "characterFilterMode",
  "characterFilterIds",
  "characterTagFilterMode",
  "characterTagFilters",
  "generationTriggerFilterMode",
  "generationTriggerFilters",
  "additionalMatchingSources",
  "position",
  "outletName",
  "depth",
  "order",
  "role",
  "sticky",
  "cooldown",
  "delay",
  "ephemeral",
  "group",
  "groupWeight",
  "preventRecursion",
  "excludeRecursion",
  "delayUntilRecursion",
  "locked",
  "tag",
  "relationships",
  "dynamicState",
  "activationConditions",
  "schedule",
  "excludeFromVectorization",
] as const;

const LOREBOOK_NAME_MAX_LENGTH = 200;
const WORLD_MAPS_SOURCE_AGENT_ID = "hierarchical-maps";

function fitNameSuffix(stem: string, suffix: string): string {
  const available = Math.max(1, LOREBOOK_NAME_MAX_LENGTH - suffix.length);
  const fitted = stem.trim().slice(0, available).trimEnd() || "Lorebook";
  return `${fitted}${suffix}`;
}

export function nextPortableLorebookName(
  originalName: string,
  mapName: string,
  reservedNames: ReadonlySet<string>,
): string {
  const normalizedOriginalName = originalName.trim() || "Untitled lorebook";
  const normalizedMapName = mapName.trim() || "Imported Map";
  const nameStem = `${normalizedOriginalName} - ${normalizedMapName}`;
  const worldMapSuffix = " (World Map)";
  const baseName = fitNameSuffix(nameStem, worldMapSuffix);
  const reserved = new Set(
    [...reservedNames].map((name) => name.trim().toLocaleLowerCase()),
  );
  if (!reserved.has(baseName.toLocaleLowerCase())) return baseName;
  for (let copy = 1; copy < 10_000; copy += 1) {
    const copySuffix = copy === 1 ? " (copy)" : ` (copy ${copy})`;
    const candidate = fitNameSuffix(nameStem, `${worldMapSuffix}${copySuffix}`);
    if (!reserved.has(candidate.toLocaleLowerCase())) return candidate;
  }
  throw new Error("A collision-safe World Map lorebook name could not be created.");
}

function pickRecord(
  source: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  return Object.fromEntries(
    keys
      .filter((key) => source[key] !== undefined)
      .map((key) => [key, source[key]]),
  );
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((key) => [key, stableValue(record[key])]),
  );
}

function stableStringify(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function shortHash(value: string): string {
  let left = 2166136261;
  let right = 2246822519;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    left = Math.imul(left ^ code, 16777619);
    right = Math.imul(right ^ code, 3266489917);
  }
  return `${(left >>> 0).toString(16).padStart(8, "0")}${(right >>> 0).toString(16).padStart(8, "0")}`;
}

export function portableEntryData(
  entry: LorebookEntry,
): Record<string, unknown> {
  return {
    name: entry.name,
    ...pickRecord(
      entry as unknown as Record<string, unknown>,
      ENTRY_SETTING_KEYS,
    ),
  };
}

export function portableEntryFingerprint(
  data: Record<string, unknown>,
): string {
  return `entry-v1:${shortHash(stableStringify(data))}`;
}

function samePortableEntry(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): boolean {
  return stableStringify(left) === stableStringify(right);
}

function requiredFolderIds(
  entries: LorebookEntry[],
  folders: LorebookFolder[],
): Set<string> {
  const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
  const required = new Set<string>();
  for (const entry of entries) {
    let folderId = entry.folderId;
    while (folderId && !required.has(folderId)) {
      required.add(folderId);
      folderId = foldersById.get(folderId)?.parentFolderId ?? null;
    }
  }
  return required;
}

export function buildPortableLoreBundle(options: {
  definition: SpatialContextDefinition;
  mode: PortableLoreExportMode;
  lorebooks: Lorebook[];
  entries: LorebookEntry[];
  foldersByLorebookId: ReadonlyMap<string, LorebookFolder[]>;
}): PortableLoreBundle {
  const lorebooksById = new Map(
    options.lorebooks.map((book) => [book.id, book]),
  );
  const entriesById = new Map(
    options.entries.map((entry) => [entry.id, entry]),
  );
  const linkedEntries = Array.from(
    new Set(
      options.definition.locations.flatMap(
        (location) => location.lorebookEntryIds,
      ),
    ),
  )
    .map((entryId) => entriesById.get(entryId))
    .filter((entry): entry is LorebookEntry => Boolean(entry));
  const linkedBookIds = new Set(linkedEntries.map((entry) => entry.lorebookId));
  const linkedEntryIds = new Set(linkedEntries.map((entry) => entry.id));
  const selectedBooks = options.lorebooks
    .filter((book) => linkedBookIds.has(book.id))
    .sort((left, right) => left.id.localeCompare(right.id));
  const bookKeyById = new Map(
    selectedBooks.map((book, index) => [book.id, `book-${index + 1}`]),
  );
  const selectedEntries = selectedBooks.flatMap((book) => {
    const bookEntries = options.entries.filter(
      (entry) => entry.lorebookId === book.id,
    );
    return (
      options.mode === "complete-lorebooks"
        ? bookEntries
        : bookEntries.filter((entry) => linkedEntryIds.has(entry.id))
    ).sort((left, right) => left.id.localeCompare(right.id));
  });
  const entryKeyById = new Map(
    selectedEntries.map((entry, index) => [entry.id, `entry-${index + 1}`]),
  );

  const books =
    options.mode === "map-only"
      ? []
      : selectedBooks.map((book): PortableLoreBook => {
          const bookEntries = selectedEntries.filter(
            (entry) => entry.lorebookId === book.id,
          );
          const allFolders = options.foldersByLorebookId.get(book.id) ?? [];
          const includedFolderIds =
            options.mode === "complete-lorebooks"
              ? new Set(allFolders.map((folder) => folder.id))
              : requiredFolderIds(bookEntries, allFolders);
          const includedFolders = allFolders
            .filter((folder) => includedFolderIds.has(folder.id))
            .sort((left, right) => left.id.localeCompare(right.id));
          const folderKeyById = new Map(
            includedFolders.map((folder, index) => [
              folder.id,
              `folder-${index + 1}`,
            ]),
          );
          return {
            key: bookKeyById.get(book.id)!,
            originalId: book.id,
            name: book.name,
            settings: pickRecord(
              book as unknown as Record<string, unknown>,
              LOREBOOK_SETTING_KEYS,
            ),
            folders: includedFolders.map((folder) => ({
              key: folderKeyById.get(folder.id)!,
              originalId: folder.id,
              parentKey: folder.parentFolderId
                ? (folderKeyById.get(folder.parentFolderId) ?? null)
                : null,
              data: {
                name: folder.name,
                enabled: folder.enabled,
                order: folder.order,
              },
            })),
            entries: bookEntries.map((entry) => {
              const data = portableEntryData(entry);
              return {
                key: entryKeyById.get(entry.id)!,
                originalId: entry.id,
                name: entry.name,
                folderKey: entry.folderId
                  ? (folderKeyById.get(entry.folderId) ?? null)
                  : null,
                fingerprint: portableEntryFingerprint(data),
                data,
              };
            }),
          };
        });

  const references = options.definition.locations.flatMap((location) =>
    location.lorebookEntryIds.map((entryId): PortableLoreReference => {
      const entry = entriesById.get(entryId);
      const book = entry ? lorebooksById.get(entry.lorebookId) : null;
      return {
        locationId: location.id,
        locationName: location.name,
        entryKey:
          options.mode === "map-only" || !entry
            ? null
            : (entryKeyById.get(entry.id) ?? null),
        originalLorebookId: book?.id ?? null,
        originalLorebookName: book?.name ?? "Unknown lorebook",
        originalEntryId: entryId,
        originalEntryName: entry?.name ?? "Missing lore entry",
      };
    }),
  );

  return { schemaVersion: 1, mode: options.mode, books, references };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parsePortableLoreBundle(
  value: unknown,
): PortableLoreBundle | null {
  if (!isRecord(value) || value.schemaVersion !== 1) return null;
  if (
    value.mode !== "map-only" &&
    value.mode !== "linked-entries" &&
    value.mode !== "complete-lorebooks"
  ) {
    return null;
  }
  if (!Array.isArray(value.books) || !Array.isArray(value.references))
    return null;
  if (value.books.length > 100 || value.references.length > 10_000) return null;
  if (value.mode === "map-only" && value.books.length > 0) return null;
  const books = value.books as PortableLoreBook[];
  const references = value.references as PortableLoreReference[];
  const bookKeys = new Set<string>();
  const originalBookIds = new Set<string>();
  const entryKeys = new Set<string>();
  const originalEntryIds = new Set<string>();
  for (const book of books) {
    if (
      !isRecord(book) ||
      typeof book.key !== "string" ||
      typeof book.originalId !== "string" ||
      typeof book.name !== "string" ||
      !book.key ||
      !book.originalId ||
      !book.name.trim()
    )
      return null;
    if (
      !isRecord(book.settings) ||
      !Array.isArray(book.folders) ||
      !Array.isArray(book.entries)
    )
      return null;
    if (
      bookKeys.has(book.key) ||
      originalBookIds.has(book.originalId) ||
      book.entries.length > 20_000 ||
      book.folders.length > 5_000
    )
      return null;
    bookKeys.add(book.key);
    originalBookIds.add(book.originalId);
    const folderKeys = new Set<string>();
    for (const folder of book.folders) {
      if (
        !isRecord(folder) ||
        typeof folder.key !== "string" ||
        typeof folder.originalId !== "string" ||
        (folder.parentKey !== null && typeof folder.parentKey !== "string") ||
        !isRecord(folder.data) ||
        typeof folder.data.name !== "string" ||
        typeof folder.data.enabled !== "boolean" ||
        typeof folder.data.order !== "number" ||
        !folder.key ||
        folderKeys.has(folder.key)
      ) {
        return null;
      }
      folderKeys.add(folder.key);
    }
    if (
      book.folders.some(
        (folder) => folder.parentKey && !folderKeys.has(folder.parentKey),
      )
    ) {
      return null;
    }
    for (const entry of book.entries) {
      if (
        !isRecord(entry) ||
        typeof entry.key !== "string" ||
        typeof entry.originalId !== "string" ||
        typeof entry.name !== "string" ||
        typeof entry.fingerprint !== "string" ||
        (entry.folderKey !== null && typeof entry.folderKey !== "string") ||
        !isRecord(entry.data) ||
        entryKeys.has(entry.key) ||
        originalEntryIds.has(entry.originalId) ||
        (entry.folderKey !== null && !folderKeys.has(entry.folderKey))
      ) {
        return null;
      }
      entryKeys.add(entry.key);
      originalEntryIds.add(entry.originalId);
    }
  }
  for (const reference of references) {
    if (
      !isRecord(reference) ||
      typeof reference.locationId !== "string" ||
      typeof reference.locationName !== "string" ||
      typeof reference.originalEntryId !== "string" ||
      typeof reference.originalEntryName !== "string" ||
      typeof reference.originalLorebookName !== "string" ||
      (reference.originalLorebookId !== null &&
        typeof reference.originalLorebookId !== "string") ||
      (reference.entryKey !== null && typeof reference.entryKey !== "string")
    ) {
      return null;
    }
    if (reference.entryKey !== null && !entryKeys.has(reference.entryKey))
      return null;
  }
  return {
    schemaVersion: 1,
    mode: value.mode,
    books: books.map((book) => ({
      key: book.key,
      originalId: book.originalId,
      name: book.name,
      settings: pickRecord(book.settings, LOREBOOK_SETTING_KEYS),
      folders: book.folders.map((folder) => ({
        key: folder.key,
        originalId: folder.originalId,
        parentKey: folder.parentKey,
        data: {
          name: folder.data.name,
          enabled: folder.data.enabled,
          order: folder.data.order,
        },
      })),
      entries: book.entries.map((entry) => ({
        key: entry.key,
        originalId: entry.originalId,
        name: entry.name,
        folderKey: entry.folderKey,
        fingerprint: entry.fingerprint,
        data: {
          name: entry.name,
          ...pickRecord(entry.data, ENTRY_SETTING_KEYS),
        },
      })),
    })),
    references: references.map((reference) => ({
      locationId: reference.locationId,
      locationName: reference.locationName,
      entryKey: reference.entryKey,
      originalLorebookId: reference.originalLorebookId,
      originalLorebookName: reference.originalLorebookName,
      originalEntryId: reference.originalEntryId,
      originalEntryName: reference.originalEntryName,
    })),
  };
}

export function planPortableLoreImport(
  bundle: PortableLoreBundle,
  lorebooks: Lorebook[],
  entries: LorebookEntry[],
  mapName = "Imported Map",
): PortableLoreImportPlan {
  const lorebookNames = new Map(lorebooks.map((book) => [book.id, book.name]));
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  const entriesByFingerprint = new Map<string, LorebookEntry[]>();
  for (const entry of entries) {
    const fingerprint = portableEntryFingerprint(portableEntryData(entry));
    const matches = entriesByFingerprint.get(fingerprint);
    if (matches) matches.push(entry);
    else entriesByFingerprint.set(fingerprint, [entry]);
  }
  const planEntries = bundle.books.flatMap((book) =>
    book.entries.map((entry): PortableLoreImportPlanEntry => {
      const exact = entriesById.get(entry.originalId);
      const contentMatches = (
        entriesByFingerprint.get(entry.fingerprint) ?? []
      ).filter((candidate) =>
        samePortableEntry(portableEntryData(candidate), entry.data),
      );
      const matched = exact ? [exact] : contentMatches;
      return {
        bookKey: book.key,
        entryKey: entry.key,
        originalEntryId: entry.originalId,
        entryName: entry.name,
        originalLorebookName: book.name,
        candidates: matched.map((candidate) => ({
          entryId: candidate.id,
          entryName: candidate.name,
          lorebookId: candidate.lorebookId,
          lorebookName:
            lorebookNames.get(candidate.lorebookId) ?? "Unknown lorebook",
          reason: exact ? "exact-id" : "content",
        })),
      };
    }),
  );
  const reservedNames = new Set(lorebooks.map((book) => book.name));
  const planBooks = bundle.books.map((book) => {
    const createdName = nextPortableLorebookName(
      book.name,
      mapName,
      reservedNames,
    );
    reservedNames.add(createdName);
    return {
      bookKey: book.key,
      originalName: book.name,
      createdName,
      entryKeys: book.entries.map((entry) => entry.key),
    };
  });
  return {
    mapName: mapName.trim() || "Imported Map",
    books: planBooks,
    entries: planEntries,
    exactMatches: planEntries.filter(
      (entry) => entry.candidates[0]?.reason === "exact-id",
    ).length,
    uniqueContentMatches: planEntries.filter(
      (entry) =>
        entry.candidates.length === 1 &&
        entry.candidates[0]?.reason === "content",
    ).length,
    ambiguousMatches: planEntries.filter((entry) => entry.candidates.length > 1)
      .length,
    newEntries: planEntries.filter((entry) => entry.candidates.length === 0)
      .length,
  };
}

export function portableLoreImportOutcome(
  plan: PortableLoreImportPlan,
  strategy: PortableLoreImportStrategy,
  ambiguousSelections: ReadonlyMap<string, string | null> = new Map(),
): PortableLoreImportOutcome {
  const reusedLorebooks = new Map<string, { id: string; name: string }>();
  const importedEntryKeys = new Set<string>();
  let reusedEntries = 0;
  let unresolvedEntries = 0;

  for (const entry of plan.entries) {
    if (strategy === "separate") {
      importedEntryKeys.add(entry.entryKey);
      continue;
    }
    const selectedId =
      entry.candidates.length <= 1
        ? (entry.candidates[0]?.entryId ?? null)
        : ambiguousSelections.has(entry.entryKey)
          ? (ambiguousSelections.get(entry.entryKey) ?? null)
          : undefined;
    if (selectedId === undefined) {
      unresolvedEntries += 1;
      continue;
    }
    if (selectedId === null) {
      importedEntryKeys.add(entry.entryKey);
      continue;
    }
    const candidate = entry.candidates.find(
      (item) => item.entryId === selectedId,
    );
    if (!candidate) {
      unresolvedEntries += 1;
      continue;
    }
    reusedEntries += 1;
    reusedLorebooks.set(candidate.lorebookId, {
      id: candidate.lorebookId,
      name: candidate.lorebookName,
    });
  }

  const createdLorebooks = plan.books
    .filter((book) =>
      book.entryKeys.some((entryKey) => importedEntryKeys.has(entryKey)),
    )
    .map((book) => ({
      name: book.createdName,
      originalName: book.originalName,
    }));

  return {
    reusedEntries,
    importedEntries: importedEntryKeys.size,
    reusedLorebooks: [...reusedLorebooks.values()].sort((left, right) =>
      left.name.localeCompare(right.name),
    ),
    createdLorebooks,
    unresolvedEntries,
  };
}

export function portableLoreImportResultMessage(
  result: PortableLoreImportResult,
): string {
  const reusedLorebookNames =
    result.reusedLorebooks.map((book) => `“${book.name}”`).join(", ") ||
    "none";
  const createdLorebookNames =
    result.createdLorebooks.map((book) => `“${book.name}”`).join(", ") ||
    "none";
  return `${result.reusedEntries} lore link${result.reusedEntries === 1 ? " was" : "s were"} reused; ${result.importedEntries} entr${result.importedEntries === 1 ? "y was" : "ies were"} imported. Reused lorebooks: ${reusedLorebookNames}. Created lorebooks: ${createdLorebookNames}. Created copies retain World Map provenance and remain in your library if this map is later deleted.`;
}

function foldersInParentOrder(
  folders: PortableLoreFolder[],
): PortableLoreFolder[] {
  const pending = new Map(folders.map((folder) => [folder.key, folder]));
  const ordered: PortableLoreFolder[] = [];
  while (pending.size > 0) {
    const next = [...pending.values()].filter(
      (folder) => !folder.parentKey || !pending.has(folder.parentKey),
    );
    if (next.length === 0)
      throw new Error("The portable lore bundle contains a folder cycle.");
    for (const folder of next) {
      pending.delete(folder.key);
      ordered.push(folder);
    }
  }
  return ordered;
}

export async function importPortableLoreBundle(options: {
  api: PortableLoreApi;
  bundle: PortableLoreBundle;
  plan: PortableLoreImportPlan;
  strategy: PortableLoreImportStrategy;
  ambiguousSelections?: ReadonlyMap<string, string | null>;
}): Promise<PortableLoreImportResult> {
  const entryIdMap = new Map<string, string>();
  const createdLorebookIds: string[] = [];
  const createdLorebooks: PortableLorebookImportSummary[] = [];
  const importedDestinations = new Map<
    string,
    { lorebookId: string; entryId: string }
  >();
  let reusedEntries = 0;
  let importedEntries = 0;
  try {
    if (options.strategy === "reuse") {
      for (const entry of options.plan.entries) {
        const selectedId =
          entry.candidates.length <= 1
            ? (entry.candidates[0]?.entryId ?? null)
            : options.ambiguousSelections?.has(entry.entryKey)
              ? (options.ambiguousSelections.get(entry.entryKey) ?? null)
              : undefined;
        if (selectedId === undefined) {
          throw new Error(
            `Choose how to resolve the duplicate match for “${entry.entryName}”.`,
          );
        }
        if (selectedId !== null) {
          if (
            !entry.candidates.some(
              (candidate) => candidate.entryId === selectedId,
            )
          ) {
            throw new Error(
              `The selected lore match for “${entry.entryName}” is no longer available.`,
            );
          }
          entryIdMap.set(entry.entryKey, selectedId);
          reusedEntries += 1;
        }
      }
    }

    for (const book of options.bundle.books) {
      const entriesToImport = book.entries.filter(
        (entry) => !entryIdMap.has(entry.key),
      );
      if (entriesToImport.length === 0) continue;
      const plannedBook = options.plan.books.find(
        (candidate) => candidate.bookKey === book.key,
      );
      if (!plannedBook) {
        throw new Error(
          `The import plan is missing the destination for “${book.name}”.`,
        );
      }
      const existingDescription =
        typeof book.settings.description === "string"
          ? book.settings.description.trim()
          : "";
      const provenanceDescription = `Imported from World Map “${options.plan.mapName}”. Original lorebook: “${book.name}”.`;
      const existingTags = Array.isArray(book.settings.tags)
        ? book.settings.tags.filter(
            (tag): tag is string => typeof tag === "string" && tag.trim().length > 0,
          )
        : [];
      const createdBook = await options.api.post<{ id: string }>("/lorebooks", {
        ...pickRecord(book.settings, LOREBOOK_SETTING_KEYS),
        name: plannedBook.createdName,
        description: existingDescription
          ? `${existingDescription}\n\n${provenanceDescription}`
          : provenanceDescription,
        tags: Array.from(
          new Set([
            ...existingTags,
            "World Map",
            `World Map: ${options.plan.mapName}`,
          ]),
        ),
        generatedBy: "import",
        sourceAgentId: WORLD_MAPS_SOURCE_AGENT_ID,
        imagePath: null,
      });
      createdLorebookIds.push(createdBook.id);
      createdLorebooks.push({
        id: createdBook.id,
        name: plannedBook.createdName,
      });
      const folderIdMap = new Map<string, string>();
      const requiredFolderKeys = new Set(
        entriesToImport
          .map((entry) => entry.folderKey)
          .filter((key): key is string => Boolean(key)),
      );
      const foldersByKey = new Map(
        book.folders.map((folder) => [folder.key, folder]),
      );
      for (const folderKey of [...requiredFolderKeys]) {
        let parentKey = foldersByKey.get(folderKey)?.parentKey ?? null;
        while (parentKey && !requiredFolderKeys.has(parentKey)) {
          requiredFolderKeys.add(parentKey);
          parentKey = foldersByKey.get(parentKey)?.parentKey ?? null;
        }
      }
      for (const folder of foldersInParentOrder(
        book.folders.filter((item) => requiredFolderKeys.has(item.key)),
      )) {
        const createdFolder = await options.api.post<{ id: string }>(
          `/lorebooks/${createdBook.id}/folders`,
          {
            ...folder.data,
            parentFolderId: folder.parentKey
              ? (folderIdMap.get(folder.parentKey) ?? null)
              : null,
          },
        );
        folderIdMap.set(folder.key, createdFolder.id);
      }
      const createdEntries = await options.api.post<Array<{ id: string }>>(
        `/lorebooks/${createdBook.id}/entries/bulk`,
        {
          entries: entriesToImport.map((entry) => ({
            ...entry.data,
            relationships: {},
            folderId: entry.folderKey
              ? (folderIdMap.get(entry.folderKey) ?? null)
              : null,
          })),
        },
      );
      if (createdEntries.length !== entriesToImport.length) {
        throw new Error(
          `Only ${createdEntries.length} of ${entriesToImport.length} lore entries were imported.`,
        );
      }
      entriesToImport.forEach((entry, index) => {
        const entryId = createdEntries[index]!.id;
        entryIdMap.set(entry.key, entryId);
        importedDestinations.set(entry.key, {
          lorebookId: createdBook.id,
          entryId,
        });
      });
      importedEntries += createdEntries.length;
    }
    const entryKeyByOriginalId = new Map(
      options.bundle.books.flatMap((book) =>
        book.entries.map((entry) => [entry.originalId, entry.key] as const),
      ),
    );
    const relationshipPatches = options.bundle.books.flatMap((book) =>
      book.entries.flatMap((entry) => {
        const destination = importedDestinations.get(entry.key);
        if (!destination || !isRecord(entry.data.relationships)) return [];
        const relationships = Object.fromEntries(
          Object.entries(entry.data.relationships).map(
            ([relatedEntryId, relationship]) => {
              const relatedKey = entryKeyByOriginalId.get(relatedEntryId);
              return [
                relatedKey
                  ? (entryIdMap.get(relatedKey) ?? relatedEntryId)
                  : relatedEntryId,
                relationship,
              ];
            },
          ),
        );
        if (Object.keys(relationships).length === 0) return [];
        return [
          {
            path: `/lorebooks/${destination.lorebookId}/entries/${destination.entryId}`,
            body: { relationships },
          },
        ];
      }),
    );
    const relationshipPatchChunkSize = 10;
    for (
      let index = 0;
      index < relationshipPatches.length;
      index += relationshipPatchChunkSize
    ) {
      const results = await Promise.allSettled(
        relationshipPatches
          .slice(index, index + relationshipPatchChunkSize)
          .map((request) => options.api.patch(request.path, request.body)),
      );
      const failure = results.find((result) => result.status === "rejected");
      if (failure?.status === "rejected") throw failure.reason;
    }
    return {
      entryIdMap,
      reusedEntries,
      importedEntries,
      importedLorebooks: createdLorebookIds.length,
      createdLorebookIds,
      createdLorebooks,
      reusedLorebooks: portableLoreImportOutcome(
        options.plan,
        options.strategy,
        options.ambiguousSelections,
      ).reusedLorebooks,
    };
  } catch (error) {
    const cleanupResults = await Promise.allSettled(
      createdLorebookIds.map((lorebookId) =>
        options.api.delete(`/lorebooks/${lorebookId}`),
      ),
    );
    const orphanedLorebookIds = createdLorebookIds.filter(
      (_lorebookId, index) => cleanupResults[index]?.status === "rejected",
    );
    if (orphanedLorebookIds.length > 0) {
      const importError =
        error instanceof Error
          ? error
          : new Error("The portable lore import failed.");
      Object.assign(importError, { orphanedLorebookIds });
      importError.message = `${importError.message} Cleanup also failed for lorebook ID${orphanedLorebookIds.length === 1 ? "" : "s"} ${orphanedLorebookIds.join(", ")}; remove ${orphanedLorebookIds.length === 1 ? "it" : "them"} manually.`;
      throw importError;
    }
    throw error;
  }
}

export function remapPortableLoreReferences(
  definition: SpatialContextDefinition,
  bundle: PortableLoreBundle,
  entryIdMap: ReadonlyMap<string, string>,
): SpatialContextDefinition {
  const referencesByLocation = new Map<string, PortableLoreReference[]>();
  for (const reference of bundle.references) {
    const locationReferences = referencesByLocation.get(reference.locationId);
    if (locationReferences) locationReferences.push(reference);
    else referencesByLocation.set(reference.locationId, [reference]);
  }
  return {
    ...definition,
    locations: definition.locations.map((location) => {
      const references = referencesByLocation.get(location.id) ?? [];
      return {
        ...location,
        lorebookEntryIds: Array.from(
          new Set(
            location.lorebookEntryIds.map((entryId) => {
              const reference = references.find(
                (candidate) => candidate.originalEntryId === entryId,
              );
              return reference?.entryKey
                ? (entryIdMap.get(reference.entryKey) ?? entryId)
                : entryId;
            }),
          ),
        ),
      };
    }),
  };
}

export function unresolvedPortableLoreReferences(
  bundle: PortableLoreBundle,
  entryIdMap: ReadonlyMap<string, string>,
): PortableLoreReference[] {
  return bundle.references.filter(
    (reference) => !reference.entryKey || !entryIdMap.has(reference.entryKey),
  );
}

export function portableLoreApproximateBytes(
  bundle: PortableLoreBundle,
): number {
  return new TextEncoder().encode(JSON.stringify(bundle)).byteLength;
}
