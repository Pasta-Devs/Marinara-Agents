import { createHash, randomUUID } from "node:crypto";
import {
  type LtmImportSourceNotesRequest,
  type LtmImportSourceNotesResponse,
  type LtmInteropPreviewRequest,
  type LtmInteropPreviewFreshness,
  type LtmInteropPreviewResponse,
  type LtmLorebookPreviewRequest,
  type LtmLorebookPreviewResponse,
  type LtmMode,
  type LtmNote,
  type LtmScope,
  type LtmSourceProvenance,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import {
  getLtmScopeChatIds,
  withMergedLtmScopeLinks,
} from "../../../../shared/src/features/agents/long-term-memory/scope.js";
import { ltmModeForChatMode, resolveChatLtmScope } from "./chat-scope.js";
import { nowIso } from "./ltm-utils.js";
import {
  getPackageLanguageModels,
  getPackagePersistence,
  getPackageResources,
} from "./package-runtime.js";
import { processLongTermMemorySourceBatch } from "./source-processing.js";
import { getLtmExtractionConfig } from "./extraction-config.js";
import { extractionFingerprintForLtmSourceMaterial } from "./source-hash.js";
import {
  inferSourceProvenance,
  sourceNoteIdForProvenance,
} from "./source-identity.js";
import { LongTermMemoryStorage } from "./storage.js";
import { LtmServiceError } from "./service-error.js";

type Candidate = {
  sourceId: string;
  title: string;
  sourceText: string;
  sourceNoteId: string;
  legacySourceNoteIds: string[];
  sourceTag: string;
  importTags: string[];
  evidence: string[];
  provenance: LtmSourceProvenance;
  scope: LtmScope;
  modes: LtmMode[];
  extractionMode: LtmMode;
  mutationCount: number;
  summary: string;
  deterministicSourceText?: string;
  lorebookEntryId?: string;
  lorebookEntryName?: string;
};
type Lorebook = {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  scope: LtmScope;
  candidates: Candidate[];
};
function object(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value))
    return value as Record<string, unknown>;
  if (typeof value === "string")
    try {
      return object(JSON.parse(value));
    } catch {}
  return {};
}
function throwIfAborted(signal: AbortSignal) {
  if (!signal.aborted) return;
  const error = new Error("Long-term memory import was cancelled.");
  error.name = "AbortError";
  throw error;
}
function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
function hash(value: string, length = 10) {
  return createHash("sha256").update(value).digest("hex").slice(0, length);
}
function identifier(value: string, fallback: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_+/g, "_")
      .slice(0, 72) || fallback
  );
}
function stringArray(value: unknown) {
  if (Array.isArray(value))
    return value.filter(
      (item): item is string =>
        typeof item === "string" && Boolean(item.trim()),
    );
  if (typeof value === "string")
    try {
      return stringArray(JSON.parse(value));
    } catch {
      return value.trim() ? [value.trim()] : [];
    }
  return [];
}
function compact(data: Record<string, unknown>, comment = "") {
  const extensions = object(data.extensions),
    greetings = stringArray(data.alternate_greetings).join("\n\n");
  return [
    ["Description", data.description],
    ["Personality", data.personality],
    ["Scenario", data.scenario],
    ["First message", data.first_mes],
    ["Example messages", data.mes_example],
    ["Creator notes", data.creator_notes],
    ["System prompt", data.system_prompt],
    ["Post-history instructions", data.post_history_instructions],
    ["Alternate greetings", greetings],
    ["Backstory", extensions.backstory ?? data.backstory],
    ["Appearance", extensions.appearance ?? data.appearance],
    ["Library note", comment],
  ]
    .flatMap(([label, value]) =>
      text(value) ? [`${label}:\n${text(value)}`] : [],
    )
    .join("\n\n");
}
function chunks(value: string) {
  const result: string[] = [];
  let remaining = value.trim();
  while (remaining.length > 24_000) {
    const window = remaining.slice(0, 24_001),
      boundary = Math.max(
        window.lastIndexOf("\n\n"),
        window.lastIndexOf("\n"),
        window.lastIndexOf(". "),
        window.lastIndexOf(" "),
      ),
      end = boundary > 12_000 ? boundary : 24_000;
    result.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trim();
  }
  if (remaining) result.push(remaining);
  return result;
}
function summaries(metadata: Record<string, unknown>) {
  const raw = Array.isArray(metadata.summaryEntries)
      ? metadata.summaryEntries.map(object)
      : [],
    entries = raw.flatMap((entry, index) => {
      const content = text(entry.content);
      if (!content || entry.enabled === false) return [];
      const start =
          typeof entry.rangeStartIndex === "number"
            ? entry.rangeStartIndex
            : null,
        end =
          typeof entry.rangeEndIndex === "number" ? entry.rangeEndIndex : null;
      return [
        {
          id: text(entry.id) || `summary-${hash(`${index}:${content}`)}`,
          content,
          range:
            start && end
              ? `${start}-${end}`
              : typeof entry.messageCount === "number"
                ? `last ${entry.messageCount}`
                : text(entry.sourceMode) === "agent"
                  ? "agent summary"
                  : "last messages",
          origin: text(entry.origin),
        },
      ];
    }),
    legacy = text(metadata.summary),
    ordinary = entries.length
      ? entries
      : legacy
        ? [
            {
              id: `summary-legacy-${hash(legacy)}`,
              content: legacy,
              range: "last messages",
              origin: "legacy",
            },
          ]
        : [],
    sessions = Array.isArray(metadata.gamePreviousSessionSummaries)
      ? metadata.gamePreviousSessionSummaries
          .map(object)
          .flatMap((session, index) => {
            const sessionNumber = Number(session.sessionNumber),
              id = Number.isFinite(sessionNumber)
                ? `game-session-${sessionNumber}`
                : `game-session-${hash(JSON.stringify(session))}`,
              fields: Array<[string, unknown]> = [
                ["Summary", session.summary],
                ["Resume point", session.resumePoint],
                ["Party dynamics", session.partyDynamics],
                ["Party state", session.partyState],
                [
                  "Key discoveries",
                  stringArray(session.keyDiscoveries).join("\n"),
                ],
                [
                  "Character moments",
                  stringArray(session.characterMoments).join("\n"),
                ],
                [
                  "Little details",
                  stringArray(session.littleDetails).join("\n"),
                ],
                ["NPC updates", stringArray(session.npcUpdates).join("\n")],
                ["Next session request", session.nextSessionRequest],
              ],
              content = fields
                .flatMap(([label, value]) =>
                  text(value) ? [`${label}:\n${text(value)}`] : [],
                )
                .join("\n\n"),
              deterministicSourceText = [
                text(session.summary)
                  ? `## timeline_event\nSummary: ${text(session.summary)}`
                  : "",
                text(session.resumePoint)
                  ? `## world_fact\nResume point: ${text(session.resumePoint)}`
                  : "",
                text(session.nextSessionRequest)
                  ? `## thread\nNext session request: ${text(session.nextSessionRequest)}`
                  : "",
                text(session.partyDynamics)
                  ? `## world_fact\nParty dynamics: ${text(session.partyDynamics)}`
                  : "",
                text(session.partyState)
                  ? `## world_fact\nParty state: ${text(session.partyState)}`
                  : "",
                ...stringArray(session.keyDiscoveries).map(
                  (value) => `## world_fact\nKey discovery: ${value}`,
                ),
                ...stringArray(session.characterMoments).map(
                  (value) => `## timeline_event\nCharacter moment: ${value}`,
                ),
                ...stringArray(session.littleDetails).map(
                  (value) => `## world_fact\nLittle detail: ${value}`,
                ),
                ...stringArray(session.npcUpdates).map(
                  (value) => `## world_fact\nNPC update: ${value}`,
                ),
              ]
                .filter(Boolean)
                .join("\n\n");
            return content
              ? [
                  {
                    id,
                    content,
                    deterministicSourceText,
                    range: `game session ${Number.isFinite(sessionNumber) ? sessionNumber : index + 1}`,
                    origin: "game_session",
                  },
                ]
              : [];
          })
      : [];
  return [...ordinary, ...sessions];
}
function scoped(candidate: Candidate, override?: LtmScope) {
  return withMergedLtmScopeLinks({ ...candidate.scope, ...override }, {});
}
function mode(candidate: Candidate, value?: LtmMode) {
  return !value
    ? candidate
    : { ...candidate, modes: [value], extractionMode: value };
}
function fingerprint(candidate: Candidate, scope: LtmScope) {
  return extractionFingerprintForLtmSourceMaterial({
    noteId: candidate.sourceNoteId,
    sourceTitle: candidate.title,
    sourceText: candidate.sourceText,
    evidence: candidate.evidence,
    provenance: candidate.provenance,
    scope,
    modes: candidate.modes,
    extractionMode: candidate.extractionMode,
  });
}

function matchesScope(candidate: Candidate, scope?: LtmScope) {
  if (!scope) return true;
  if (candidate.provenance.kind === "character") {
    return Boolean(
      candidate.scope.characterIds?.some((id) =>
        scope.characterIds?.includes(id),
      ),
    );
  }
  return matchesImportScope(candidate.scope, scope);
}

function matchesImportScope(candidateScope: LtmScope, scope?: LtmScope) {
  if (!scope) return true;
  const scopeIds = new Set(getLtmScopeChatIds(scope));
  if (scope.groupId) {
    if (candidateScope.groupId !== scope.groupId) return false;
  } else if (scopeIds.size) {
    const candidateIds = new Set(getLtmScopeChatIds(candidateScope));
    if (![...candidateIds].some((id) => scopeIds.has(id))) return false;
  }
  if (scope.characterIds?.length) {
    const candidateIds = new Set(candidateScope.characterIds ?? []);
    if (![...candidateIds].some((id) => scope.characterIds?.includes(id)))
      return false;
  }
  return true;
}

function lorebookScope(data: Record<string, unknown>) {
  return withMergedLtmScopeLinks(
    {
      ...(text(data.chatId) ? { chatId: text(data.chatId) } : {}),
      ...(stringArray(data.characterIds).length
        ? { characterIds: stringArray(data.characterIds) }
        : {}),
    },
    { chatIds: text(data.chatId) ? [text(data.chatId)] : [] },
  );
}

function normalizeLorebooks(
  books: Array<{ id: string; data: unknown; entries: unknown[] }>,
) {
  return books.map((book): Lorebook => {
    const data = object(book.data),
      name = text(data.name) || "Lorebook",
      description = text(data.description),
      category = text(data.category) || "Lore",
      normalizedCategory = identifier(category, "lore"),
      tags = stringArray(data.tags)
        .map((tag) => tag.trim().slice(0, 120))
        .filter(Boolean)
        .slice(0, 100),
      importTags = tags.map((tag) => identifier(tag, "tag")).slice(0, 12),
      scope = lorebookScope(data),
      entries = [
        ...(description
          ? [{ id: "description", name: "Description", content: description }]
          : []),
        ...book.entries.map(object),
      ],
      normalized: Candidate[] = [],
      usedEntryIds = new Set<string>();
    for (const [index, entry] of entries.entries()) {
      const content = text(entry.content);
      if (!content) continue;
      const rawBase =
          text(entry.id) ||
          text(entry.uid) ||
          text(entry.key) ||
          `position_${index + 1}`,
        initialBase =
          rawBase.length <= 120
            ? rawBase
            : `entry_${hash(`${rawBase}\0${index}`, 16)}`,
        base = usedEntryIds.has(initialBase)
          ? `entry_${hash(`${rawBase}\0${index}`, 16)}`
          : initialBase,
        entryName = text(entry.name) || "Entry";
      usedEntryIds.add(base);
      for (const [part, sourceText] of chunks(content).entries()) {
        const rawEntryId = part ? `${base}:part:${part + 1}` : base,
          entryId =
            rawEntryId.length <= 120
              ? rawEntryId
              : `entry_${hash(`${base}\0${part}`, 16)}`,
          sourceId = `lorebook_entry_${hash(`${book.id}\0${entryId}`)}`,
          title = `Lorebook - ${name}: ${entryName}${part ? ` (${part + 1})` : ""}`,
          provenance = {
            kind: "lorebook" as const,
            sourceId: book.id,
            entryId,
          };
        normalized.push({
          sourceId,
          title,
          sourceText: `Category: ${normalizedCategory}\n\n${sourceText}`,
          sourceNoteId: sourceNoteIdForProvenance(provenance),
          legacySourceNoteIds: [],
          sourceTag: "imported_lorebook",
          importTags: [...importTags, `lorebook_${normalizedCategory}`],
          evidence: [`lorebook:${book.id}`, `lorebook_entry:${entryId}`],
          provenance,
          scope,
          modes: ["roleplay", "conversation", "game"],
          extractionMode: "roleplay",
          mutationCount: 1,
          summary: `Import ${title}`,
          lorebookEntryId: base,
          lorebookEntryName: entryName,
        });
      }
    }
    return {
      id: book.id,
      name,
      description,
      category,
      tags,
      scope,
      candidates: normalized,
    };
  });
}

async function candidates(
  request: {
    source: "characters" | "lorebooks" | "chats";
    limit: number;
    scope?: LtmScope;
    mode?: LtmMode;
    chatId?: string;
  },
  selected?: Set<string>,
) {
  const result: Candidate[] = [];
  if (request.source === "characters")
    for (const row of await getPackageResources().listCharacters()) {
      const data = object(row.data),
        name = text(data.name) || "Character",
        sourceText = compact(data, row.comment);
      if (!sourceText) continue;
      const provenance = { kind: "character" as const, sourceId: row.id },
        suffix = `${identifier(name, "character")}_${hash(row.id)}`;
      result.push({
        sourceId: row.id,
        title: name,
        sourceText,
        sourceNoteId: sourceNoteIdForProvenance(provenance),
        legacySourceNoteIds: [
          `source_import_character_${suffix}`,
          `scene_import_character_${suffix}`,
        ],
        sourceTag: "imported_character",
        importTags: [],
        evidence: [`character:${row.id}`],
        provenance,
        scope: { characterIds: [row.id] },
        modes: ["roleplay", "conversation", "game"],
        extractionMode: "roleplay",
        mutationCount: 1,
        summary: `Import ${name}`,
      });
    }
  if (request.source === "lorebooks")
    for (const book of normalizeLorebooks(
      await getPackageResources().listLorebooks(),
    ))
      result.push(...book.candidates);
  if (request.source === "chats") {
    const scopeIds = new Set(getLtmScopeChatIds(request.scope));
    for (const chat of await getPackagePersistence().listChats()) {
      if (request.chatId && chat.id !== request.chatId) continue;
      if (
        request.scope?.groupId
          ? chat.groupId !== request.scope.groupId
          : scopeIds.size && !scopeIds.has(chat.id)
      )
        continue;
      const metadata = object(chat.metadata),
        chatMode = ltmModeForChatMode(chat.mode);
      for (const entry of summaries(metadata)) {
        const sourceId = `${chat.id}:${entry.id}`,
          provenance = {
            kind: "chat_summary" as const,
            sourceId: chat.id,
            entryId: entry.id,
          },
          title = `${chat.name || "Chat"}, msgs ${entry.range}`,
          seed = `${chat.id}:${entry.id}`,
          legacy =
            entry.origin === "legacy"
              ? [
                  `source_import_chat_${identifier(chat.name, "chat")}_${hash(seed)}`,
                  `scene_import_chat_${identifier(chat.name, "chat")}_${hash(chat.id)}`,
                ]
              : [
                  `source_import_chat_${identifier(chat.name, "chat")}_${hash(seed)}`,
                ];
        result.push({
          sourceId,
          title,
          sourceText: entry.content,
          sourceNoteId: sourceNoteIdForProvenance(provenance),
          legacySourceNoteIds: legacy,
          sourceTag: "imported_chat",
          importTags: [],
          evidence: [
            `chat:${chat.id}`,
            `chat_name:${chat.name || "Chat"}`,
            `summary_entry:${entry.id}`,
            `message_range:${entry.range}`,
          ],
          provenance,
          scope: resolveChatLtmScope(chat),
          modes: [chatMode],
          extractionMode: chatMode,
          mutationCount: 1,
          summary: `Import ${title}`,
          ...(entry.deterministicSourceText
            ? { deterministicSourceText: entry.deterministicSourceText }
            : {}),
        });
      }
    }
  }
  const filtered = result.filter(
      (item) =>
        matchesScope(item, request.scope) &&
        (!request.mode || item.modes.includes(request.mode)) &&
        (!selected || selected.has(item.sourceId)),
    ),
    ordered = selected
      ? [...selected].flatMap((id) =>
          filtered.filter((item) => item.sourceId === id),
        )
      : filtered;
  return ordered
    .slice(0, Math.max(request.limit, selected?.size ?? 0))
    .map((item) => mode(item, request.mode));
}

function provenanceKey(provenance: LtmSourceProvenance) {
  return `${provenance.kind}\0${provenance.sourceId}\0${provenance.entryId ?? ""}`;
}

async function existingMatcher(storage: LongTermMemoryStorage) {
  const notes = await storage.listNotes(),
    byId = new Map(notes.map((note) => [note.id, note])),
    byProvenance = new Map<string, LtmNote>();
  for (const note of notes) {
    if (note.type !== "source") continue;
    const provenance = inferSourceProvenance(note);
    if (provenance && !byProvenance.has(provenanceKey(provenance)))
      byProvenance.set(provenanceKey(provenance), note);
  }
  return (row: Candidate) =>
    [row.sourceNoteId, ...row.legacySourceNoteIds]
      .map((id) => byId.get(id))
      .find((note): note is LtmNote => Boolean(note)) ??
    byProvenance.get(provenanceKey(row.provenance));
}

function previewFreshness(
  note: LtmNote,
  candidateFingerprint: ReturnType<typeof fingerprint>,
): LtmInteropPreviewFreshness {
  const existingFingerprint = note.extractionFingerprint;
  if (!existingFingerprint) return "extraction_incomplete";
  if (existingFingerprint.sourceHash !== candidateFingerprint.sourceHash)
    return "source_updated";
  const { sourceHash: _existingSourceHash, ...existingContext } =
      existingFingerprint,
    { sourceHash: _candidateSourceHash, ...candidateContext } =
      candidateFingerprint;
  return JSON.stringify(existingContext) === JSON.stringify(candidateContext)
    ? "current"
    : "context_updated";
}

function previewSample(
  row: Candidate,
  note: LtmNote | undefined,
  scope?: LtmScope,
) {
  const base = {
    sourceId: row.sourceId,
    title: row.title,
    mutationCount: row.mutationCount,
    summary: row.summary,
    snippet:
      row.sourceText.length > 200
        ? `${row.sourceText.slice(0, 200)}...`
        : row.sourceText,
  };
  return note
    ? {
        ...base,
        status: "imported" as const,
        freshness: previewFreshness(note, fingerprint(row, scoped(row, scope))),
        existingNoteId: note.id,
        existingNoteTitle: note.title || row.title,
      }
    : { ...base, status: "pending" as const, freshness: "new" as const };
}
export async function previewPackageInterop(
  request: LtmInteropPreviewRequest,
  root: string,
): Promise<LtmInteropPreviewResponse> {
  const rows = await candidates(request),
    storage = new LongTermMemoryStorage(root),
    matchExisting = await existingMatcher(storage),
    samples = rows.map((row) =>
      previewSample(row, matchExisting(row), request.scope),
    );
  return {
    source: request.source,
    scanned: samples.length,
    draftable: samples.filter((item) => item.status === "pending").length,
    importedCount: samples.filter((item) => item.status === "imported").length,
    samples,
  };
}

export async function previewPackageLorebooks(
  request: LtmLorebookPreviewRequest,
  root: string,
): Promise<LtmLorebookPreviewResponse> {
  const storage = new LongTermMemoryStorage(root),
    matchExisting = await existingMatcher(storage),
    resources = (await getPackageResources().listLorebooks())
      .filter((book) =>
        matchesImportScope(lorebookScope(object(book.data)), request.scope),
      )
      .slice(0, request.limit),
    books = normalizeLorebooks(resources).map((book) => {
      const rows = book.candidates
          .filter(
            (row) =>
              (!request.mode || row.modes.includes(request.mode)) &&
              matchesScope(row, request.scope),
          )
          .map((row) => mode(row, request.mode)),
        grouped = new Map<
          string,
          {
            id: string;
            name: string;
            candidates: ReturnType<typeof previewSample>[];
          }
        >();
      for (const row of rows) {
        const id = row.lorebookEntryId!,
          entry = grouped.get(id) ?? {
            id,
            name: row.lorebookEntryName!,
            candidates: [],
          };
        entry.candidates.push(
          previewSample(row, matchExisting(row), request.scope),
        );
        grouped.set(id, entry);
      }
      const entries = [...grouped.values()].map((entry) => ({
          ...entry,
          candidateCount: entry.candidates.length,
        })),
        samples = entries.flatMap((entry) => entry.candidates),
        imported = samples.filter(
          (sample) => sample.status === "imported",
        ).length;
      return {
        id: book.id,
        name: book.name,
        description:
          book.description.length > 600
            ? `${book.description.slice(0, 597)}...`
            : book.description,
        category: book.category,
        tags: book.tags,
        scope: book.scope,
        counts: {
          entries: entries.length,
          candidates: samples.length,
          pending: samples.length - imported,
          imported,
        },
        entries,
      };
    }),
    entries = books.reduce((count, book) => count + book.counts.entries, 0),
    candidatesCount = books.reduce(
      (count, book) => count + book.counts.candidates,
      0,
    ),
    imported = books.reduce((count, book) => count + book.counts.imported, 0);
  return {
    counts: {
      books: books.length,
      entries,
      candidates: candidatesCount,
      pending: candidatesCount - imported,
      imported,
    },
    books,
  };
}
export async function importPackageInterop(
  request: LtmImportSourceNotesRequest,
  root: string,
  signal: AbortSignal,
): Promise<LtmImportSourceNotesResponse> {
  const chat = request.chatId
    ? await getPackagePersistence().getChat(request.chatId)
    : null;
  if (request.chatId && !chat)
    throw new LtmServiceError("Chat not found", 404, "ltm_chat_not_found");
  const operationId = randomUUID(),
    selected = new Set(request.sourceIds),
    rows = await candidates(request, selected),
    resolvedIds = new Set(rows.map((item) => item.sourceId)),
    missingSourceIds = request.sourceIds.filter((id) => !resolvedIds.has(id));
  throwIfAborted(signal);
  const extractionConfig = await getLtmExtractionConfig(root, request.mode);
  const useExtractionAgent = rows.some(
    (row) =>
      row.extractionMode !== "game" ||
      !row.sourceId.includes(":game-session-") ||
      extractionConfig.useExtractionAgentOnGameMode,
  );
  let resolved = null;
  if (request.extract && useExtractionAgent) {
    try {
      resolved = await getPackageLanguageModels().resolveForRequest({
        connectionId: request.connectionId ?? extractionConfig.connectionId,
        chatConnectionId: chat?.connectionId ?? null,
        model: request.model,
      });
    } catch (error) {
      throw new LtmServiceError(
        error instanceof Error
          ? error.message
          : "Language model configuration is invalid",
        400,
        "ltm_model_configuration",
      );
    }
  }
  throwIfAborted(signal);
  const storage = new LongTermMemoryStorage(root),
    matchExisting = await existingMatcher(storage),
    written: Array<{
      sourceId: string;
      title: string;
      note: LtmNote;
      created: boolean;
      deterministicSourceText?: string;
    }> = [],
    writeFailures: LtmImportSourceNotesResponse["writeFailures"] = [];
  for (const row of rows) {
    try {
      const scope = scoped(row, request.scope),
        input = {
          id: row.sourceNoteId,
          title: row.title,
          type: "source" as const,
          status: "active" as const,
          modes: row.modes,
          scope,
          tags: ["source_summary", row.sourceTag, ...row.importTags],
          keywords: [],
          links: [],
          provenance: row.provenance,
          sections: {
            source: {
              text: row.sourceText,
              updatedAt: nowIso(),
              confidence: 0.8,
              evidence: row.evidence,
            },
          },
        },
        found = matchExisting(row),
        existing =
          found && found.id !== row.sourceNoteId
            ? await storage.renameNoteId(found.id, row.sourceNoteId)
            : found,
        note = existing
          ? await storage.updateNote(existing.id, {
              title: row.title,
              status: "active",
              modes: row.modes,
              scope,
              tags: Array.from(new Set([...existing.tags, ...input.tags])),
              provenance: row.provenance,
              sections: { ...existing.sections, source: input.sections.source },
            })
          : await storage.createNote(input);
      written.push({
        sourceId: row.sourceId,
        title: row.title,
        note,
        created: !existing,
        ...(row.deterministicSourceText
          ? { deterministicSourceText: row.deterministicSourceText }
          : {}),
      });
    } catch (error) {
      writeFailures.push({
        sourceId: row.sourceId,
        title: row.title,
        sourceWriteStatus: "failed",
        extractionStatus: "not_started",
        retryable: true,
        error: {
          code: "source_write_failed",
          message:
            error instanceof Error
              ? error.message
              : "Failed to write imported source note",
        },
      });
    }
  }
  const results = request.extract
      ? await processLongTermMemorySourceBatch({
          items: written,
          languageModel: resolved,
          mode: request.mode,
          instruction: request.instruction,
          operationId,
          chatId: request.chatId,
          signal,
          applyLowRisk: request.applyLowRisk,
          concurrency: request.importConcurrency ?? 3,
          root,
          directGameMode: !extractionConfig.useExtractionAgentOnGameMode,
        })
      : written.map((item) => ({
          sourceId: item.sourceId,
          title: item.title,
          note: item.note,
          created: item.created,
          sourceWriteStatus: item.created
            ? ("created" as const)
            : ("refreshed" as const),
          extractionStatus: "not_started" as const,
          extractionMethod: "none" as const,
          retryable: false as const,
          draft: null,
          diagnostics: [],
          outcome: {
            state: "no_suggestions_created" as const,
            totalCandidates: 0,
            keptUnits: 0,
            droppedUnits: 0,
            droppedCandidates: [],
            droppedCandidateDetailsTruncated: false,
          },
          accounting: {
            providerCandidates: 0,
            normalizedAdditions: 0,
            parserRejections: 0,
            validationRejections: 0,
            deduplications: 0,
            keptUnits: 0,
          },
          appliedMutationIds: [],
          skippedMutationIds: [],
        })),
    cancelled = results.filter(
      (item) => item.extractionStatus === "cancelled",
    ).length,
    failed = results.filter(
      (item) => item.extractionStatus === "failed",
    ).length,
    succeeded = results.filter(
      (item) => item.extractionStatus === "succeeded",
    ).length;
  const counts = {
      requested: request.sourceIds.length,
      sourceNotesWritten: written.length,
      succeeded,
      failed,
      cancelled,
      missing: missingSourceIds.length,
      sourceWriteFailed: writeFailures.length,
    },
    incomplete =
      counts.failed +
      counts.cancelled +
      counts.missing +
      counts.sourceWriteFailed,
    batchStatus =
      incomplete === 0
        ? ("success" as const)
        : counts.succeeded
          ? ("partial_success" as const)
          : counts.cancelled &&
              !counts.failed &&
              !counts.missing &&
              !counts.sourceWriteFailed
            ? ("cancelled" as const)
            : ("failed" as const);
  return {
    operationId,
    batchStatus,
    source: request.source,
    imported: results,
    writeFailures,
    missingSourceIds,
    counts,
  };
}
