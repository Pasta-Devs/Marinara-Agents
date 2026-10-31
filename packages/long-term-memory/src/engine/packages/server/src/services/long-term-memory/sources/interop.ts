import { createHash, randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  type LtmImportSourceNotesRequest,
  type LtmImportSourceNotesResponse,
  type LtmSourceDetailsRequest,
  type LtmSourceDetailsResponse,
  type LtmInteropPreviewRequest,
  type LtmInteropPreviewFreshness,
  type LtmInteropPreviewOutdated,
  type LtmInteropPreviewResponse,
  type LtmLorebookPreviewRequest,
  type LtmLorebookPreviewResponse,
  type LtmMode,
  type LtmNote,
  type LtmScope,
  type LtmSourceProvenance,
} from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import {
  getLtmScopeChatIds,
  getLtmScopeGroupIds,
  getLtmScopePersonaIds,
  isGlobalLtmScope,
  normalizeLtmScope,
  withMergedLtmScopeLinks,
} from "../../../../../shared/src/features/agents/long-term-memory/scope.js";
import {
  ltmModeForChatMode,
  normalizeLtmChatCharacterIds,
  resolveChatLtmScope,
  resolveChatLtmWriteScope,
  getLtmChatDisplayName,
  parseLtmChatMetadata,
} from "../identity/chat-scope.js";
import { DEFAULT_LTM_IMPORTED_SOURCE_MODE } from "../../../../../shared/src/features/agents/long-term-memory/constants.js";
import { nowIso } from "../ltm-utils.js";
import { getPackagePersistence, getPackageResources, logger, resolvePackageLanguageModel } from "../package-runtime.js";
import { processLongTermMemorySourceBatch, type ImportedSourceItem } from "../extraction/source-processing.js";
import { getLtmExtractionConfig } from "../extraction/extraction-config.js";
import { extractionFingerprintForLtmSourceMaterial } from "../extraction/source-hash.js";
import { inferSourceProvenance, sourceNoteIdForProvenance } from "./source-identity.js";
import { LongTermMemoryStorage } from "../persistence/storage.js";
import {
  ltmSetMessagesHiddenFromAI,
  readLtmHiddenMessages,
  writeLtmHiddenMessages,
} from "../persistence/hidden-messages.js";
import { withLtmVaultLock } from "../persistence/vault-lock.js";
import { getLtmGlobalSettings } from "../settings.js";
import { LtmServiceError } from "../service-error.js";

// How much of the previous chat piece the next one sees as context.
const CHAT_PIECE_TAIL_CHARS = 3_000;
// Chat Messages piece size per Chat import detail choice. A chat keeps the size its pieces were first imported with.
const CHAT_PIECE_CHARS = { standard: 24_000, detailed: 12_000 } as const;
const CHAT_PIECE_SIZE_EVIDENCE = "piece_size:";

type Candidate = {
  sourceId: string;
  previewOrder?: string;
  // Chats whose history holds this chat_transcript piece, set when identical branch pieces merge.
  branchChatIds?: string[];
  title: string;
  // Chat Messages pieces only; the title string stays the source note title.
  messageRange?: { chatName: string; first: number; last: number };
  // Chat Messages pieces only: the ids of the messages the piece reads.
  messageIds?: string[];
  // Chat Summaries without a numbered range: the label is the range text from the title.
  summaryRange?: { chatName: string; label: string };
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
  // The chat piece before this one, so its extraction can start from where that one ended.
  previousPiece?: { sourceNoteId: string; tail: string };
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

export const PROFESSOR_MARI_CHARACTER_ID = "__professor_mari__";
function object(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
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
    return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
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
    .flatMap(([label, value]) => (text(value) ? [`${label}:\n${text(value)}`] : []))
    .join("\n\n");
}
function chunks(value: string, cap = 24_000) {
  const result: string[] = [];
  let remaining = value.trim();
  while (remaining.length > cap) {
    const window = remaining.slice(0, cap + 1),
      boundary = Math.max(
        window.lastIndexOf("\n\n"),
        window.lastIndexOf("\n"),
        window.lastIndexOf(". "),
        window.lastIndexOf(" "),
      ),
      end = boundary > cap / 2 ? boundary : cap;
    result.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trim();
  }
  if (remaining) result.push(remaining);
  return result;
}
type TranscriptMessage = Awaited<ReturnType<ReturnType<typeof getPackagePersistence>["listMessages"]>>[number];
type TranscriptPiece = { entryId: string; first: number; last: number; content: string; messageIds: string[] };
// A piece is named by its first message, so new messages only grow or follow the last piece and earlier pieces keep
// their ids and text. Numbers count every message, hidden ones too, so they match the chat's message numbers. Memories
// reach every character, so like the Engine's own memory this reads the public content, never agentContent with its
// whispers, and skips messages hidden from the AI or from some characters. isStart names the first messages of pieces
// already imported: each starts its piece again, so an edit or deletion before it can't re-cut and orphan it. One now
// hidden still names the piece its next visible message starts. A message this package hid (owned) still counts, so
// its piece keeps its text, until the user hides or shows it by hand.
export function transcriptPieces(
  messages: TranscriptMessage[],
  speaker: (message: TranscriptMessage) => string,
  isStart: (messageId: string) => boolean = () => false,
  cap: number = CHAT_PIECE_CHARS.standard,
  owned: ReadonlySet<string> = new Set(),
) {
  const pieces: TranscriptPiece[] = [];
  let current: TranscriptPiece | undefined, start: string | undefined;
  for (const [index, message] of messages.entries()) {
    if (isStart(message.id)) {
      if (current) pieces.push(current);
      current = undefined;
      start = message.id;
    }
    const extra = object(message.extra),
      ownHide = owned.has(message.id) && extra.visibilityManual !== true;
    if ((extra.hiddenFromAI === true && !ownHide) || extra.commandOnly === true) continue;
    if (Array.isArray(extra.hiddenFromAICharacterIds) && extra.hiddenFromAICharacterIds.length) continue;
    const body = text(message.content);
    if (!body) continue;
    const number = index + 1,
      line = `${speaker(message)}: ${body}`;
    if (!start && current && current.content.length + 2 + line.length <= cap) {
      current.content += `\n\n${line}`;
      current.last = number;
      current.messageIds.push(message.id);
      continue;
    }
    if (current) pieces.push(current);
    current = undefined;
    const entryId = start ?? message.id;
    start = undefined;
    if (line.length <= cap) current = { entryId, first: number, last: number, content: line, messageIds: [message.id] };
    else
      for (const [part, content] of chunks(line, cap).entries())
        pieces.push({
          entryId: part ? `${entryId}:part:${part + 1}` : entryId,
          first: number,
          last: number,
          content,
          messageIds: [message.id],
        });
  }
  if (current) pieces.push(current);
  return pieces;
}
function boundedId(value: string, prefix: string) {
  return value.length <= 120 ? value : `${prefix}_${hash(value, 32)}`;
}
function conversationDate(value: string) {
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/u);
  if (!match) return null;
  const [, day, month, year] = match,
    date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.getFullYear() === Number(year) && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day)
    ? date
    : null;
}
function conversationSummaryEntries(raw: unknown, kind: "day" | "week") {
  return Object.entries(object(raw))
    .flatMap(([key, value]) => {
      const entry = object(value),
        summary = typeof value === "string" ? text(value) : text(entry.summary),
        keyDetails = Array.isArray(entry.keyDetails)
          ? entry.keyDetails.filter((detail): detail is string => typeof detail === "string" && Boolean(detail.trim()))
          : [],
        date = conversationDate(key),
        content = [summary, ...keyDetails].filter(Boolean).join("\n\n");
      return date && content
        ? [
            {
              id: `${kind}:${key}`,
              content,
              range: key,
              origin: "conversation_summary",
              date,
            },
          ]
        : [];
    })
    .sort((left, right) => left.date.getTime() - right.date.getTime())
    .map(({ date: _date, ...entry }) => entry);
}
function conversationSummaries(metadata: Record<string, unknown>) {
  return [
    ...conversationSummaryEntries(metadata.daySummaries, "day"),
    ...conversationSummaryEntries(metadata.weekSummaries, "week"),
  ].sort((left, right) => conversationDate(left.range)!.getTime() - conversationDate(right.range)!.getTime());
}
export function summaries(
  metadata: Record<string, unknown>,
  chatMode: LtmMode,
): Array<{
  id: string;
  content: string;
  range: string;
  first?: number;
  last?: number;
  origin: string;
  deterministicSourceText?: string;
}> {
  if (chatMode === "conversation") return conversationSummaries(metadata);
  const raw = Array.isArray(metadata.summaryEntries) ? metadata.summaryEntries.map(object) : [],
    entries = raw.flatMap((entry, index) => {
      const content = text(entry.content);
      if (!content || entry.enabled === false) return [];
      const start = typeof entry.rangeStartIndex === "number" ? entry.rangeStartIndex : null,
        end = typeof entry.rangeEndIndex === "number" ? entry.rangeEndIndex : null;
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
          ...(start && end && Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= start
            ? { first: start, last: end }
            : {}),
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
      ? metadata.gamePreviousSessionSummaries.map(object).flatMap((session, index) => {
          const sessionNumber = Number(session.sessionNumber),
            id = Number.isFinite(sessionNumber)
              ? `game-session-${sessionNumber}`
              : `game-session-${hash(JSON.stringify(session))}`,
            fields: Array<[string, unknown]> = [
              ["Summary", session.summary],
              ["Resume point", session.resumePoint],
              ["Party dynamics", session.partyDynamics],
              ["Party state", session.partyState],
              ["Key discoveries", stringArray(session.keyDiscoveries).join("\n")],
              ["Character moments", stringArray(session.characterMoments).join("\n")],
              ["Little details", stringArray(session.littleDetails).join("\n")],
              ["NPC updates", stringArray(session.npcUpdates).join("\n")],
              ["Next session request", session.nextSessionRequest],
            ],
            content = fields
              .flatMap(([label, value]) => (text(value) ? [`${label}:\n${text(value)}`] : []))
              .join("\n\n"),
            deterministicSourceText = [
              text(session.summary) ? `## timeline_event\nSummary: ${text(session.summary)}` : "",
              text(session.resumePoint) ? `## world_fact\nResume point: ${text(session.resumePoint)}` : "",
              text(session.nextSessionRequest)
                ? `## thread\nNext session request: ${text(session.nextSessionRequest)}`
                : "",
              text(session.partyDynamics) ? `## world_fact\nParty dynamics: ${text(session.partyDynamics)}` : "",
              text(session.partyState) ? `## world_fact\nParty state: ${text(session.partyState)}` : "",
              ...stringArray(session.keyDiscoveries).map((value) => `## world_fact\nKey discovery: ${value}`),
              ...stringArray(session.characterMoments).map((value) => `## timeline_event\nCharacter moment: ${value}`),
              ...stringArray(session.littleDetails).map((value) => `## world_fact\nLittle detail: ${value}`),
              ...stringArray(session.npcUpdates).map((value) => `## world_fact\nNPC update: ${value}`),
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
function mode(candidate: Candidate, value?: LtmMode, availabilityModes?: LtmMode[]) {
  const modes =
    availabilityModes && availabilityModes.length > 0 ? availabilityModes : value ? [value] : candidate.modes;
  const extractionMode = value ?? candidate.extractionMode ?? candidate.modes[0] ?? "roleplay";
  return { ...candidate, modes, extractionMode };
}
function isChatSource(kind: LtmSourceProvenance["kind"]) {
  return kind === "chat_summary" || kind === "chat_transcript";
}
function importedSourceMode(source: Candidate["provenance"]["kind"], requested?: LtmMode) {
  return requested ?? (isChatSource(source) ? undefined : DEFAULT_LTM_IMPORTED_SOURCE_MODE);
}
function candidateFingerprintForNote(candidate: Candidate, note: LtmNote) {
  return extractionFingerprintForLtmSourceMaterial({
    noteId: candidate.sourceNoteId,
    sourceTitle: candidate.title,
    sourceText: candidate.sourceText,
    evidence: candidate.evidence,
    provenance: candidate.provenance,
    scope: note.destinationScope ?? note.scope,
    modes: note.modes,
    extractionMode: note.extractionFingerprint?.extractionMode ?? candidate.extractionMode,
  });
}

function requestedSourceScope(request: { sourceScope?: LtmScope; scope?: LtmScope }) {
  return request.sourceScope ?? request.scope;
}

function scopeKey(scope: LtmScope | undefined) {
  const normalized = normalizeLtmScope(scope);
  const chatIds = normalized.chatIds ? [...normalized.chatIds].sort() : undefined;
  const groupIds = normalized.groupIds ? [...normalized.groupIds].sort() : undefined;
  const personaIds = normalized.personaIds ? [...normalized.personaIds].sort() : undefined;
  return JSON.stringify({
    ...normalized,
    ...(chatIds ? { chatId: chatIds[0], chatIds } : {}),
    ...(groupIds ? { groupId: groupIds[0], groupIds } : {}),
    ...(normalized.characterIds ? { characterIds: [...normalized.characterIds].sort() } : {}),
    ...(personaIds ? { personaId: personaIds[0], personaIds } : {}),
  });
}

function matchesScope(candidate: Candidate, scope?: LtmScope) {
  return !scope || !isChatSource(candidate.provenance.kind) || matchesChatSummaryScope(candidate.scope, scope);
}

function candidateVisibleInScope(candidate: Candidate, scope: LtmScope | undefined) {
  return matchesScope(candidate, scope);
}

function resolvePreviewCandidates(rows: Candidate[], matchExisting: (row: Candidate) => LtmNote | undefined) {
  const resolved = new Map<string, Candidate>();
  const branchChatIds = new Map<string, Set<string>>();
  for (const row of rows) {
    // ponytail: branch chat records share summary entry identity but keep
    // distinct chat ids; keep the first identical chat-summary candidate so
    // shared branch summaries do not repeat in the Sources preview, preferring
    // an already-imported sibling so the row reflects imported state instead of
    // offering a duplicate import. A branch copies messages under new ids, so
    // identical message pieces match by the chat group instead.
    const key =
      row.provenance.kind === "chat_summary"
        ? `chat_summary\0${row.provenance.entryId ?? ""}\0${row.sourceText}`
        : row.provenance.kind === "chat_transcript"
          ? `chat_transcript\0${getLtmScopeGroupIds(row.scope)[0] ?? row.provenance.sourceId}\0${row.sourceText}`
          : row.sourceId;
    const previous = resolved.get(key);
    if (!previous || (!matchExisting(previous) && matchExisting(row))) resolved.set(key, row);
    if (row.provenance.kind === "chat_transcript")
      branchChatIds.set(key, (branchChatIds.get(key) ?? new Set()).add(row.provenance.sourceId));
  }
  return [...resolved].map(([key, row]) => {
    const chatIds = branchChatIds.get(key);
    return chatIds ? { ...row, branchChatIds: [...chatIds] } : row;
  });
}

function resolveImportCandidates(rows: Candidate[]) {
  const resolved = new Map<string, Candidate>();
  const conflicts = new Map<string, Candidate>();
  for (const row of rows) {
    if (conflicts.has(row.sourceId)) continue;
    const previous = resolved.get(row.sourceId);
    if (!previous) {
      resolved.set(row.sourceId, row);
    } else if (!isDeepStrictEqual(previous, row)) {
      conflicts.set(row.sourceId, previous);
      resolved.delete(row.sourceId);
    }
  }
  return { rows: [...resolved.values()], conflicts: [...conflicts.values()] };
}

function matchesChatSummaryScope(candidateScope: LtmScope, scope?: LtmScope) {
  if (!scope) return true;
  const scopeGroupIds = new Set(getLtmScopeGroupIds(scope));
  if (scopeGroupIds.size) {
    const candidateGroupIds = new Set(getLtmScopeGroupIds(candidateScope));
    if (![...candidateGroupIds].some((id) => scopeGroupIds.has(id))) return false;
  } else {
    const scopeChatIds = new Set(getLtmScopeChatIds(scope));
    if (scopeChatIds.size) {
      const candidateChatIds = new Set(getLtmScopeChatIds(candidateScope));
      if (![...candidateChatIds].some((id) => scopeChatIds.has(id))) return false;
    }
  }
  const scopeCharacterIds = new Set(scope.characterIds ?? []);
  if (scopeCharacterIds.size) {
    const candidateCharacterIds = new Set(candidateScope.characterIds ?? []);
    if (![...candidateCharacterIds].some((id) => scopeCharacterIds.has(id))) return false;
  }
  const scopePersonaIds = new Set(getLtmScopePersonaIds(scope));
  if (scopePersonaIds.size) {
    const candidatePersonaIds = new Set(getLtmScopePersonaIds(candidateScope));
    if (![...candidatePersonaIds].some((id) => scopePersonaIds.has(id))) return false;
  }
  return true;
}

function lorebookScope(data: Record<string, unknown>) {
  return withMergedLtmScopeLinks(
    {
      ...(text(data.chatId) ? { chatId: text(data.chatId) } : {}),
      ...(stringArray(data.characterIds).length ? { characterIds: stringArray(data.characterIds) } : {}),
    },
    { chatIds: text(data.chatId) ? [text(data.chatId)] : [] },
  );
}

function normalizeLorebooks(books: Array<{ id: string; data: unknown; entries: unknown[] }>) {
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
        ...(description ? [{ id: "description", name: "Description", content: description }] : []),
        ...book.entries.map(object),
      ],
      normalized: Candidate[] = [],
      usedEntryIds = new Set<string>();
    for (const [index, entry] of entries.entries()) {
      const content = text(entry.content);
      if (!content) continue;
      const rawBase = text(entry.id) || text(entry.uid) || text(entry.key) || `position_${index + 1}`,
        initialBase = rawBase.length <= 120 ? rawBase : `entry_${hash(`${rawBase}\0${index}`, 16)}`,
        base = usedEntryIds.has(initialBase) ? `entry_${hash(`${rawBase}\0${index}`, 16)}` : initialBase,
        entryName = text(entry.name) || "Entry";
      usedEntryIds.add(base);
      for (const [part, sourceText] of chunks(content).entries()) {
        const rawEntryId = part ? `${base}:part:${part + 1}` : base,
          entryId = rawEntryId.length <= 120 ? rawEntryId : `entry_${hash(`${base}\0${part}`, 16)}`,
          sourceId = `lorebook_entry_${hash(`${book.id}\0${entryId}`)}`,
          title = `Lorebook - ${name}: ${entryName}${part ? ` (${part + 1})` : ""}`.slice(0, 240),
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
          extractionMode: DEFAULT_LTM_IMPORTED_SOURCE_MODE,
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

async function requestedChats(request: { sourceScope?: LtmScope; chatId?: string; includeOutOfScope?: boolean }) {
  const scopeIds = new Set(getLtmScopeChatIds(request.sourceScope));
  const scopeGroupIds = new Set<string | null>(getLtmScopeGroupIds(request.sourceScope));
  const broaderScope = scopeGroupIds.size > 0 || scopeIds.size > 1;
  return (await getPackagePersistence().listChats()).filter((chat) => {
    if (normalizeLtmChatCharacterIds(chat.characterIds).includes(PROFESSOR_MARI_CHARACTER_ID)) return false;
    if (request.includeOutOfScope) return true;
    if (!request.sourceScope && request.chatId && !broaderScope && chat.id !== request.chatId) return false;
    return !(scopeGroupIds.size ? !scopeGroupIds.has(chat.groupId) : scopeIds.size && !scopeIds.has(chat.id));
  });
}

async function chatScopesById() {
  return new Map((await getPackagePersistence().listChats()).map((chat) => [chat.id, resolveChatLtmScope(chat)]));
}

async function candidates(
  request: {
    source: "characters" | "lorebooks" | "chats" | "messages";
    sourceScope?: LtmScope;
    mode?: LtmMode;
    modes?: LtmMode[];
    chatId?: string;
    query?: string;
    includeOutOfScope?: boolean;
  },
  selected?: Set<string>,
  pieces?: Awaited<ReturnType<typeof chatPieces>>,
) {
  const result: Candidate[] = [];
  if (request.source === "characters")
    for (const row of await getPackageResources().listCharacters()) {
      if (row.id === PROFESSOR_MARI_CHARACTER_ID) continue;
      const data = object(row.data),
        name = text(data.name) || "Character",
        sourceText = compact(data, row.comment);
      if (!sourceText) continue;
      const provenance = { kind: "character" as const, sourceId: row.id },
        suffix = `${identifier(name, "character")}_${hash(row.id)}`;
      result.push({
        sourceId: row.id,
        title: name.slice(0, 240),
        sourceText,
        sourceNoteId: sourceNoteIdForProvenance(provenance),
        legacySourceNoteIds: [`source_import_character_${suffix}`, `scene_import_character_${suffix}`],
        sourceTag: "imported_character",
        importTags: [],
        evidence: [`character:${row.id}`],
        provenance,
        scope: { characterIds: [row.id] },
        modes: ["roleplay", "conversation", "game"],
        extractionMode: DEFAULT_LTM_IMPORTED_SOURCE_MODE,
        mutationCount: 1,
        summary: `Import ${name}`,
      });
    }
  if (request.source === "lorebooks")
    for (const book of normalizeLorebooks(await getPackageResources().listLorebooks())) result.push(...book.candidates);
  if (request.source === "chats") {
    for (const chat of await requestedChats(request)) {
      const metadata = parseLtmChatMetadata(chat.metadata),
        chatMode = ltmModeForChatMode(chat.mode),
        chatDisplayName = getLtmChatDisplayName(chat) || "Chat";
      for (const entry of summaries(metadata, chatMode)) {
        const sourceId = `${chat.id}:${entry.id}`,
          provenance = {
            kind: "chat_summary" as const,
            sourceId: chat.id,
            entryId: entry.id,
          },
          title = `${chatDisplayName}, msgs ${entry.range}`.slice(0, 240),
          seed = `${chat.id}:${entry.id}`,
          legacy =
            entry.origin === "legacy"
              ? [
                  `source_import_chat_${identifier(chat.name, "chat")}_${hash(seed)}`,
                  `scene_import_chat_${identifier(chat.name, "chat")}_${hash(chat.id)}`,
                ]
              : [`source_import_chat_${identifier(chat.name, "chat")}_${hash(seed)}`];
        result.push({
          sourceId,
          ...(chatMode === "conversation"
            ? { previewOrder: `${chat.id}\0${entry.range.split(".").reverse().join("-")}\0${entry.id}` }
            : {}),
          title,
          ...(entry.first !== undefined && entry.last !== undefined
            ? { messageRange: { chatName: chatDisplayName.slice(0, 240), first: entry.first, last: entry.last } }
            : { summaryRange: { chatName: chatDisplayName.slice(0, 240), label: entry.range.slice(0, 80) } }),
          sourceText: entry.content,
          sourceNoteId: sourceNoteIdForProvenance(provenance),
          legacySourceNoteIds: legacy,
          sourceTag: "imported_chat",
          importTags: [],
          evidence: [
            `chat:${chat.id}`,
            `chat_name:${chatDisplayName}`,
            `summary_entry:${entry.id}`,
            `message_range:${entry.range}`,
          ],
          provenance,
          scope: resolveChatLtmScope(chat),
          modes: [chatMode],
          extractionMode: chatMode,
          mutationCount: 1,
          summary: `Import ${title}`,
          ...(entry.deterministicSourceText ? { deterministicSourceText: entry.deterministicSourceText } : {}),
        });
      }
    }
  }
  if (request.source === "messages") {
    const chats = await requestedChats(request),
      characterIds = [...new Set(chats.flatMap((chat) => normalizeLtmChatCharacterIds(chat.characterIds)))],
      characterNames = new Map(
        (characterIds.length ? await getPackageResources().listCharacters(characterIds) : []).map((row) => [
          row.id,
          text(object(row.data).name),
        ]),
      );
    for (const chat of chats) {
      const scope = resolveChatLtmScope(chat);
      // Callers drop out-of-scope chat rows anyway; skipping them here avoids reading every chat's messages.
      if (request.sourceScope && !matchesChatSummaryScope(scope, request.sourceScope)) continue;
      const chatMode = ltmModeForChatMode(chat.mode),
        chatDisplayName = getLtmChatDisplayName(chat) || "Chat",
        speaker = (message: TranscriptMessage) =>
          message.role === "user"
            ? text(object(object(message.extra).personaSnapshot).name) || "User"
            : message.role === "assistant"
              ? characterNames.get(message.characterId ?? "") || "Assistant"
              : message.role === "narrator"
                ? "Narrator"
                : "System";
      const starts = pieces?.starts.get(chat.id),
        cap = pieces?.sizes.get(chat.id) ?? pieces?.size ?? CHAT_PIECE_CHARS.standard;
      let previousPiece: Candidate["previousPiece"];
      for (const piece of transcriptPieces(
        await getPackagePersistence().listMessages(chat.id),
        speaker,
        (messageId) => starts?.has(boundedId(messageId, "message")) === true,
        cap,
        pieces?.owned.get(chat.id),
      )) {
        const entryId = boundedId(piece.entryId, "message"),
          provenance = { kind: "chat_transcript" as const, sourceId: chat.id, entryId },
          range = piece.first === piece.last ? `${piece.first}` : `${piece.first}-${piece.last}`,
          title = `${chatDisplayName}, ${piece.first === piece.last ? "message" : "messages"} ${range}`.slice(0, 240);
        result.push({
          sourceId: boundedId(`${chat.id}:messages:${entryId}`, `${chat.id.slice(0, 60)}:messages`),
          previewOrder: `${chat.id}\0${String(piece.first).padStart(8, "0")}\0${entryId}`,
          title,
          messageRange: { chatName: chatDisplayName.slice(0, 240), first: piece.first, last: piece.last },
          messageIds: piece.messageIds,
          sourceText: piece.content,
          sourceNoteId: sourceNoteIdForProvenance(provenance),
          legacySourceNoteIds: [],
          sourceTag: "imported_chat_messages",
          importTags: [],
          evidence: [
            `chat:${chat.id}`,
            `chat_name:${chatDisplayName}`,
            `message_entry:${entryId}`,
            `message_range:${range}`,
            // Standard pieces record nothing, so notes imported before sizes existed keep their fingerprints.
            ...(cap === CHAT_PIECE_CHARS.standard ? [] : [`${CHAT_PIECE_SIZE_EVIDENCE}${cap}`]),
          ],
          provenance,
          scope,
          modes: [chatMode],
          extractionMode: chatMode,
          mutationCount: 1,
          summary: `Import ${title}`,
          ...(previousPiece ? { previousPiece } : {}),
        });
        previousPiece = {
          sourceNoteId: sourceNoteIdForProvenance(provenance),
          tail: piece.content.slice(-CHAT_PIECE_TAIL_CHARS),
        };
      }
    }
  }
  const filtered = result.filter(
      (item) =>
        (request.includeOutOfScope || matchesScope(item, request.sourceScope)) &&
        (!request.mode || item.modes.includes(request.mode)) &&
        matchesQuery(item, request.query) &&
        (!selected || selected.has(item.sourceId)),
    ),
    ordered = selected ? [...selected].flatMap((id) => filtered.filter((item) => item.sourceId === id)) : filtered;
  return ordered.map((item) => mode(item, importedSourceMode(item.provenance.kind, request.mode), request.modes));
}

function normalizedSearchText(value: string) {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLocaleLowerCase();
}

function matchesQuery(
  candidate: Pick<Candidate, "sourceId" | "title" | "summary" | "sourceText" | "lorebookEntryName">,
  query?: string,
) {
  if (!query) return true;
  const needle = normalizedSearchText(query);
  if (!needle) return true;
  return [candidate.sourceId, candidate.title, candidate.summary, candidate.sourceText, candidate.lorebookEntryName]
    .filter((value): value is string => Boolean(value))
    .some((value) => normalizedSearchText(value).includes(needle));
}

function provenanceKey(provenance: LtmSourceProvenance) {
  return `${provenance.kind}\0${provenance.sourceId}\0${provenance.entryId ?? ""}`;
}

async function existingMatcher(storage: LongTermMemoryStorage) {
  const notes = await storage.listNotes(),
    byId = new Map(notes.map((note) => [note.id, note])),
    byProvenance = new Map<string, LtmNote>(),
    pieceStarts = new Map<string, Set<string>>(),
    // Piece size per chat, read from its imported pieces.
    pieceSizes = new Map<string, number>(),
    sourceNotes: Array<{ note: LtmNote; provenance: LtmSourceProvenance }> = [];
  for (const note of notes) {
    if (note.type !== "source") continue;
    const provenance = inferSourceProvenance(note);
    if (provenance) sourceNotes.push({ note, provenance });
    if (provenance && !byProvenance.has(provenanceKey(provenance))) byProvenance.set(provenanceKey(provenance), note);
    if (provenance?.kind === "chat_transcript" && provenance.entryId) {
      pieceStarts.set(provenance.sourceId, (pieceStarts.get(provenance.sourceId) ?? new Set()).add(provenance.entryId));
      if (!pieceSizes.has(provenance.sourceId))
        pieceSizes.set(
          provenance.sourceId,
          note.sections.source?.evidence?.includes(`${CHAT_PIECE_SIZE_EVIDENCE}${CHAT_PIECE_CHARS.detailed}`)
            ? CHAT_PIECE_CHARS.detailed
            : CHAT_PIECE_CHARS.standard,
        );
    }
  }
  const match = (row: Candidate) =>
    [row.sourceNoteId, ...row.legacySourceNoteIds]
      .map((id) => byId.get(id))
      .find((note): note is LtmNote => Boolean(note)) ?? byProvenance.get(provenanceKey(row.provenance));
  return Object.assign(match, { pieceStarts, pieceSizes, sourceNotes });
}

// Each chat's piece starts and size. A chat with imported pieces keeps their size. A branch copies its parent's messages
// under new ids, so one never imported takes its chat group's size and its shared pieces still match the parent's.
// Other chats cut at the Chat import detail setting's size. Only a messages source reads chats or the setting. owned
// holds each chat's messages this package hid, which still count toward their pieces.
async function chatPieces(
  source: LtmInteropPreviewRequest["source"],
  matchExisting: Awaited<ReturnType<typeof existingMatcher>>,
  root: string,
) {
  if (source !== "messages") return undefined;
  const sizes = new Map(matchExisting.pieceSizes);
  if (sizes.size) {
    const chats = await getPackagePersistence().listChats(),
      groupSizes = new Map<string, number>();
    // ponytail: a group whose chats were imported at different sizes takes the first listed chat's; a mixed group
    // only arises from chats imported before they were linked. Prefer the parent's size if that ever matters.
    for (const chat of chats)
      if (chat.groupId && sizes.has(chat.id) && !groupSizes.has(chat.groupId))
        groupSizes.set(chat.groupId, sizes.get(chat.id)!);
    for (const chat of chats)
      if (chat.groupId && !sizes.has(chat.id) && groupSizes.has(chat.groupId))
        sizes.set(chat.id, groupSizes.get(chat.groupId)!);
  }
  return {
    starts: matchExisting.pieceStarts,
    sizes,
    size: CHAT_PIECE_CHARS[(await getLtmExtractionConfig(root)).chatImportDetail],
    owned: new Map(
      Object.entries(await readLtmHiddenMessages(root)).map(([chatId, notes]) => [
        chatId,
        new Set(Object.values(notes).flat()),
      ]),
    ),
  };
}

// Mirrors the Engine's normalizeSummaryTailMessages: unset keeps 10, and anything invalid or negative keeps none.
function summaryTailMessages(value: unknown) {
  if (value === undefined || value === null) return 10;
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

/**
 * "Hide imported messages from the AI": hides the messages of each Chat Messages piece whose source note is active and
 * extracted from its current text, except the chat's last summaryTailMessages visible messages, the tail the Engine's
 * summary hiding keeps. Records under the source note only the ids the host changed, so a message hidden by someone
 * else is never shown by this package. A message the user hid or showed by hand leaves the record and stays theirs.
 * Runs for the given chats, or every chat with imported pieces.
 */
export async function hideImportedChatMessages(root: string, chatIds?: Iterable<string>) {
  const setHidden = ltmSetMessagesHiddenFromAI();
  if (!setHidden || !(await getLtmGlobalSettings(root)).longTermMemoryHideImportedMessages) return;
  await withLtmVaultLock(root, async () => {
    // A save that turned the setting off while this waited for the lock already showed everything.
    if (!(await getLtmGlobalSettings(root)).longTermMemoryHideImportedMessages) return;
    const persistence = getPackagePersistence(),
      matchExisting = await existingMatcher(new LongTermMemoryStorage(root)),
      pieces = await chatPieces("messages", matchExisting, root),
      noteIds = new Set(matchExisting.sourceNotes.map(({ note }) => note.id)),
      owned = await readLtmHiddenMessages(root),
      before = JSON.stringify(owned),
      wanted = new Set(chatIds ?? [...matchExisting.pieceStarts.keys(), ...Object.keys(owned)]);
    // Written even when a later chat fails, so every message the host already hid stays recorded.
    try {
      for (const chatId of wanted) {
        const chat = await persistence.getChat(chatId);
        // A deleted chat took its messages with it.
        if (!chat) {
          delete owned[chatId];
          continue;
        }
        const messages = await persistence.listMessages(chatId),
          extras = new Map(messages.map((message) => [message.id, object(message.extra)])),
          record = (owned[chatId] ??= {});
        // A note deleted while showing its messages failed gets them shown now; its record goes once they are.
        const orphaned: string[] = [];
        for (const [noteId, ids] of Object.entries(record)) {
          const kept = ids.filter((id) => extras.has(id) && extras.get(id)!.visibilityManual !== true);
          if (!noteIds.has(noteId)) orphaned.push(...kept);
          else if (kept.length) record[noteId] = kept;
          else delete record[noteId];
        }
        if (orphaned.length)
          for (const id of await setHidden(chatId, orphaned, false))
            extras.set(id, { ...extras.get(id)!, hiddenFromAI: false });
        for (const noteId of Object.keys(record)) if (!noteIds.has(noteId)) delete record[noteId];
        const tail = summaryTailMessages(parseLtmChatMetadata(chat.metadata).summaryTailMessages),
          visible = messages.filter((message) => extras.get(message.id)!.hiddenFromAI !== true),
          tailIds = new Set(tail ? visible.slice(-tail).map((message) => message.id) : []),
          noteFor = new Map<string, string>(),
          // A long message split over several pieces hides only once every one of them is extracted.
          pending = new Set<string>();
        for (const row of await candidates({ source: "messages", chatId }, undefined, pieces)) {
          if (row.provenance.sourceId !== chatId) continue;
          const note = matchExisting(row),
            current =
              note?.status === "active" &&
              note.extractionFingerprint?.sourceHash === candidateFingerprintForNote(row, note).sourceHash;
          for (const id of row.messageIds ?? [])
            if (!current) pending.add(id);
            else if (!noteFor.has(id)) noteFor.set(id, note.id);
        }
        const hide = [...noteFor.keys()].filter((id) => {
          const extra = extras.get(id)!;
          return !pending.has(id) && !tailIds.has(id) && extra.hiddenFromAI !== true && extra.visibilityManual !== true;
        });
        for (const id of hide.length ? await setHidden(chatId, hide, true) : []) {
          const noteId = noteFor.get(id);
          if (noteId && !record[noteId]?.includes(id)) (record[noteId] ??= []).push(id);
        }
        if (!Object.keys(record).length) delete owned[chatId];
      }
    } finally {
      if (JSON.stringify(owned) !== before) await writeLtmHiddenMessages(owned, root);
    }
  });
}

const OUTDATED_NOTE_LIMIT = 1_000;
const OUTDATED_PROVENANCE_KIND = {
  characters: "character",
  lorebooks: "lorebook",
  chats: "chat_summary",
  messages: "chat_transcript",
} as const;

/**
 * Source notes of this source kind that no current candidate matches. `rows` must be the whole source, before
 * mode, query and branch-sibling filters, so a note is only reported when its source is really gone. A lorebook or
 * chat note without an entry id cannot be tied to one entry, so it is never reported. A chat note is judged by its
 * chat's current scope, the one `candidates` walks by, and by its own scope once the chat itself is gone.
 * ponytail: lists at most OUTDATED_NOTE_LIMIT notes; a vault with more gone sources shows the rest after removals.
 */
function outdatedSourceNotes(
  source: keyof typeof OUTDATED_PROVENANCE_KIND,
  rows: Candidate[],
  matchExisting: Awaited<ReturnType<typeof existingMatcher>>,
  sourceScope: LtmScope | undefined,
  chatScopes: Map<string, LtmScope>,
): LtmInteropPreviewOutdated[] {
  const matchedIds = new Set<string>(),
    matchedKeys = new Set<string>();
  for (const row of rows) {
    const note = matchExisting(row);
    if (note) matchedIds.add(note.id);
    matchedKeys.add(provenanceKey(row.provenance));
  }
  return matchExisting.sourceNotes
    .filter(
      ({ note, provenance }) =>
        provenance.kind === OUTDATED_PROVENANCE_KIND[source] &&
        (provenance.kind === "character" || provenance.entryId) &&
        !matchedIds.has(note.id) &&
        !matchedKeys.has(provenanceKey(provenance)) &&
        (!isChatSource(provenance.kind) ||
          matchesChatSummaryScope(chatScopes.get(provenance.sourceId) ?? note.scope, sourceScope)),
    )
    .map(({ note, provenance }) => ({
      noteId: note.id,
      title: (note.title || provenance.sourceId).slice(0, 240),
      provenance,
    }))
    .sort((left, right) => (left.title < right.title ? -1 : left.title > right.title ? 1 : 0))
    .slice(0, OUTDATED_NOTE_LIMIT);
}

function previewFreshness(
  note: LtmNote,
  candidateFingerprint: ReturnType<typeof candidateFingerprintForNote>,
): Exclude<LtmInteropPreviewFreshness, "new"> {
  const existingFingerprint = note.extractionFingerprint;
  if (!existingFingerprint) return "extraction_incomplete";
  if (existingFingerprint.sourceHash !== candidateFingerprint.sourceHash) return "source_updated";
  const { sourceHash: _existingSourceHash, ...existingContext } = existingFingerprint,
    { sourceHash: _candidateSourceHash, ...candidateContext } = candidateFingerprint;
  return JSON.stringify(existingContext) === JSON.stringify(candidateContext) ? "current" : "context_updated";
}

function previewSample(row: Candidate, note: LtmNote | undefined) {
  const base = {
    sourceId: row.sourceId,
    title: row.title,
    importMode: row.extractionMode,
    mutationCount: row.mutationCount,
    summary: row.summary,
    snippet: row.sourceText.length > 200 ? `${row.sourceText.slice(0, 200)}...` : row.sourceText,
    ...(row.messageRange ? { messageRange: row.messageRange } : {}),
    ...(row.summaryRange ? { summaryRange: row.summaryRange } : {}),
  };
  return note
    ? {
        ...base,
        status: "imported" as const,
        freshness: previewFreshness(note, candidateFingerprintForNote(row, note)),
        existingNoteId: note.id,
        existingNoteTitle: note.title || row.title,
      }
    : { ...base, status: "pending" as const, freshness: "new" as const };
}
function previewPage<T>(
  rows: T[],
  request: LtmLorebookPreviewRequest & { branchChatId?: string },
  source: string,
  key: (row: T) => string,
) {
  const binding = hash(
    JSON.stringify([
      source,
      scopeKey(requestedSourceScope(request)),
      request.mode ?? null,
      normalizedSearchText(request.query ?? ""),
      request.branchChatId ?? null,
    ]),
    64,
  );
  let after = "";
  if (request.cursor) {
    try {
      const cursor = JSON.parse(Buffer.from(request.cursor, "base64url").toString("utf8"));
      if (cursor.v !== 1 || cursor.binding !== binding || typeof cursor.after !== "string" || cursor.after.length > 512)
        throw new Error();
      after = cursor.after;
    } catch {
      throw new LtmServiceError(
        "The source cursor is invalid for these filters. Refresh the preview.",
        400,
        "ltm_invalid_source_cursor",
      );
    }
  }
  const ordered = rows
    .filter((row) => key(row) > after)
    .sort((left, right) => (key(left) < key(right) ? -1 : key(left) > key(right) ? 1 : 0));
  const items = ordered.slice(0, request.limit);
  const hasMore = ordered.length > items.length;
  const nextCursor = hasMore
    ? Buffer.from(JSON.stringify({ v: 1, binding, after: key(items.at(-1)!) })).toString("base64url")
    : null;
  return { items, hasMore, nextCursor };
}

export async function previewPackageInterop(
  request: LtmInteropPreviewRequest,
  root: string,
): Promise<LtmInteropPreviewResponse> {
  const sourceScope = requestedSourceScope(request);
  const matchExisting = await existingMatcher(new LongTermMemoryStorage(root));
  const pieces = await chatPieces(request.source, matchExisting, root);
  const candidateRequest = { ...request, sourceScope, includeOutOfScope: sourceScope !== undefined },
    found = await candidates(candidateRequest, undefined, pieces),
    resolved = resolvePreviewCandidates(
      found.filter((row) => candidateVisibleInScope(row, sourceScope)),
      matchExisting,
    );
  // Identical branch pieces are already merged, so a branch keeps the pieces its chat contributed to.
  const { branchChatId } = request;
  const rows =
    request.source === "messages" && branchChatId
      ? resolved.filter((row) => row.branchChatIds?.includes(branchChatId))
      : resolved;
  // Only an unfiltered first page has seen the whole source, so only it can say which notes lost theirs.
  const outdated =
    request.cursor || request.query
      ? undefined
      : outdatedSourceNotes(
          request.source,
          // ponytail: a mode filter reads the source a second time; one unfiltered walk would halve a messages preview.
          request.mode ? await candidates({ ...candidateRequest, mode: undefined }, undefined, pieces) : found,
          matchExisting,
          sourceScope,
          isChatSource(OUTDATED_PROVENANCE_KIND[request.source]) ? await chatScopesById() : new Map(),
        );
  const page = previewPage(rows, request, request.source, (row) => row.previewOrder ?? row.sourceId);
  // ponytail: host resource APIs list complete source records; only this page gets
  // rendered previews and freshness hashes. Host-side cursors can replace the scan later.
  const samples = page.items.map((row) => previewSample(row, matchExisting(row)));
  const imported = rows.filter((row) => matchExisting(row)).length;
  return {
    source: request.source,
    scanned: samples.length,
    draftable: samples.filter((item) => item.status === "pending").length,
    importedCount: samples.filter((item) => item.status === "imported").length,
    samples,
    totals: { matches: rows.length, ready: rows.length - imported, imported },
    ...(outdated?.length ? { outdated } : {}),
    truncated: page.hasMore,
    hasMore: page.hasMore,
    nextCursor: page.nextCursor,
  };
}

export async function previewPackageLorebooks(
  request: LtmLorebookPreviewRequest,
  root: string,
): Promise<LtmLorebookPreviewResponse> {
  const sourceScope = requestedSourceScope(request);
  const matchExisting = await existingMatcher(new LongTermMemoryStorage(root));
  const allBooks = normalizeLorebooks(await getPackageResources().listLorebooks());
  const matchingBooks = allBooks
    .map((book) => {
      const bookMatches = matchesQuery(
        {
          sourceId: book.id,
          title: book.name,
          sourceText: [book.description, book.category, ...book.tags].join("\n"),
          summary: book.description,
        },
        request.query,
      );
      const rows = book.candidates
        .filter(
          (row) =>
            (!request.mode || row.modes.includes(request.mode)) &&
            candidateVisibleInScope(row, sourceScope) &&
            (bookMatches || matchesQuery(row, request.query)),
        )
        .map((row) => mode(row, importedSourceMode(row.provenance.kind, request.mode)));
      const imported = rows.filter((row) => matchExisting(row)).length;
      return {
        ...book,
        candidates: rows,
        totals: {
          entries: new Set(rows.map((row) => row.lorebookEntryId)).size,
          candidates: rows.length,
          pending: rows.length - imported,
          imported,
        },
      };
    })
    .filter((book) => !normalizedSearchText(request.query ?? "") || book.candidates.length > 0);
  // An empty book occupies one position, so it remains browsable without an
  // independent book cap. A large entry can continue in the next page.
  const positions = matchingBooks.flatMap((book) =>
    book.candidates.length
      ? book.candidates.map((candidate) => ({ book, candidate: candidate as Candidate | null }))
      : [{ book, candidate: null }],
  );
  const page = previewPage(
    positions,
    request,
    "lorebook-groups",
    ({ book, candidate }) => `${book.id}\0${candidate?.sourceId ?? ""}`,
  );
  const pageBooks = new Map<string, typeof page.items>();
  for (const position of page.items) {
    const rows = pageBooks.get(position.book.id) ?? [];
    rows.push(position);
    pageBooks.set(position.book.id, rows);
  }
  const books = [...pageBooks.values()].map((positions) => {
    const book = positions[0]!.book;
    const grouped = new Map<string, LtmLorebookPreviewResponse["books"][number]["entries"][number]>();
    for (const { candidate } of positions) {
      if (!candidate) continue;
      const id = candidate.lorebookEntryId!;
      const entry = grouped.get(id) ?? { id, name: candidate.lorebookEntryName!, candidates: [], candidateCount: 0 };
      entry.candidates.push(previewSample(candidate, matchExisting(candidate)));
      entry.candidateCount = entry.candidates.length;
      grouped.set(id, entry);
    }
    const entries = [...grouped.values()];
    const samples = entries.flatMap((entry) => entry.candidates);
    const imported = samples.filter((sample) => sample.status === "imported").length;
    return {
      id: book.id,
      name: book.name,
      description: book.description.length > 600 ? `${book.description.slice(0, 597)}...` : book.description,
      category: book.category,
      tags: book.tags,
      scope: book.scope,
      entries,
      counts: { entries: entries.length, candidates: samples.length, pending: samples.length - imported, imported },
      totals: book.totals,
    };
  });
  const counts = (values: typeof books) =>
    values.reduce(
      (result, book) => {
        const count = book.counts;
        return {
          entries: result.entries + count.entries,
          candidates: result.candidates + count.candidates,
          pending: result.pending + count.pending,
          imported: result.imported + count.imported,
        };
      },
      { entries: 0, candidates: 0, pending: 0, imported: 0 },
    );
  const totals = matchingBooks.reduce(
    (sum, book) => ({
      entries: sum.entries + book.totals.entries,
      candidates: sum.candidates + book.totals.candidates,
      pending: sum.pending + book.totals.pending,
      imported: sum.imported + book.totals.imported,
    }),
    { entries: 0, candidates: 0, pending: 0, imported: 0 },
  );
  const outdated =
    request.cursor || request.query
      ? undefined
      : outdatedSourceNotes(
          "lorebooks",
          allBooks.flatMap((book) => book.candidates),
          matchExisting,
          sourceScope,
          new Map(),
        );
  return {
    counts: { books: books.length, ...counts(books) },
    books,
    totals: { books: matchingBooks.length, ...totals },
    ...(outdated?.length ? { outdated } : {}),
    truncated: page.hasMore,
    hasMore: page.hasMore,
    nextCursor: page.nextCursor,
  };
}

export async function sourcePackageDetails(
  request: LtmSourceDetailsRequest,
  root: string,
): Promise<LtmSourceDetailsResponse> {
  const sourceScope = requestedSourceScope(request),
    matchExisting = await existingMatcher(new LongTermMemoryStorage(root)),
    rows = await candidates(
      {
        source: request.source,
        sourceScope,
        mode: request.mode,
        chatId: request.chatId,
        includeOutOfScope: sourceScope !== undefined,
      },
      new Set(request.sourceIds),
      await chatPieces(request.source, matchExisting, root),
    ),
    details = rows.flatMap((row) => {
      const existing = matchExisting(row);
      return candidateVisibleInScope(row, sourceScope)
        ? [{ ...previewSample(row, existing), content: row.sourceText.slice(0, 500_000) }]
        : [];
    }),
    resolvedIds = new Set(details.map((detail) => detail.sourceId));
  return {
    source: request.source,
    details,
    missingSourceIds: request.sourceIds.filter((sourceId) => !resolvedIds.has(sourceId)),
  };
}
export async function importPackageInterop(
  request: LtmImportSourceNotesRequest,
  root: string,
  signal: AbortSignal,
): Promise<LtmImportSourceNotesResponse> {
  const chat = request.chatId ? await getPackagePersistence().getChat(request.chatId) : null;
  if (request.chatId && !chat) throw new LtmServiceError("Chat not found", 404, "ltm_chat_not_found");
  if (request.destinationScope && isGlobalLtmScope(request.destinationScope))
    throw new LtmServiceError(
      "Choose at least one destination for imported memories.",
      400,
      "ltm_destination_scope_required",
    );
  const sourceScope = requestedSourceScope(request),
    legacyScopeRequest = request.sourceScope === undefined && request.scope !== undefined,
    legacyDestinationScope =
      legacyScopeRequest && request.scope && !isGlobalLtmScope(request.scope) ? request.scope : undefined,
    destinationScope =
      request.destinationScope ??
      (legacyScopeRequest ? legacyDestinationScope : chat ? resolveChatLtmWriteScope(chat) : undefined),
    operationId = randomUUID(),
    selected = new Set(request.sourceIds),
    storage = new LongTermMemoryStorage(root),
    matchExisting = await existingMatcher(storage),
    candidateRows = await candidates(
      { ...request, sourceScope, includeOutOfScope: sourceScope !== undefined },
      selected,
      await chatPieces(request.source, matchExisting, root),
    ),
    visibleRows = candidateRows.filter((row) => candidateVisibleInScope(row, sourceScope)),
    resolvedIds = new Set(visibleRows.map((item) => item.sourceId)),
    missingSourceIds = request.sourceIds.filter((id) => !resolvedIds.has(id)),
    candidateResolution = resolveImportCandidates(visibleRows),
    rows = candidateResolution.rows,
    writeFailures: LtmImportSourceNotesResponse["writeFailures"] = candidateResolution.conflicts.map((row) => {
      const title = row.title.slice(0, 240);
      return {
        sourceId: row.sourceId,
        title,
        sourceWriteStatus: "failed" as const,
        extractionStatus: "not_started" as const,
        retryable: false,
        error: {
          code: "ltm_source_identity_conflict" as const,
          message: `Source ${title} has multiple records with different content for the same source ID.`,
        },
      };
    }),
    conflictingSourceIds = new Set<string>();
  throwIfAborted(signal);
  if (!destinationScope && !chat && !legacyScopeRequest && rows.some((row) => !isGlobalLtmScope(row.scope)))
    throw new LtmServiceError(
      "Choose a destination before importing scoped memories.",
      400,
      "ltm_destination_scope_required",
    );
  const extractionConfig = await getLtmExtractionConfig(root, request.mode);
  const useExtractionAgent = rows.some(
    (row) =>
      row.extractionMode !== "game" ||
      !row.sourceId.includes(":game-session-") ||
      extractionConfig.useExtractionAgentOnGameMode,
  );
  let languageModel = null;
  if (request.extract && useExtractionAgent) {
    languageModel = await resolvePackageLanguageModel({
      connectionId: request.connectionId ?? extractionConfig.connectionId,
      chatConnectionId: chat?.connectionId ?? null,
      model: request.model,
    });
  }
  throwIfAborted(signal);
  const written: ImportedSourceItem[] = [];
  if (destinationScope) {
    for (const row of rows) {
      const existing = matchExisting(row);
      if (!existing) continue;
      const existingDestinationScope =
        existing.destinationScope ?? existing.extractionFingerprint?.scope ?? existing.scope;
      if (scopeKey(existingDestinationScope) !== scopeKey(destinationScope)) {
        conflictingSourceIds.add(row.sourceId);
        writeFailures.push({
          sourceId: row.sourceId,
          title: row.title,
          sourceWriteStatus: "failed",
          extractionStatus: "not_started",
          retryable: false,
          error: {
            code: "ltm_source_destination_conflict",
            message: `Source ${row.title} is already imported with a different destination. Manage its availability in Memory Vault.`,
          },
        });
      }
    }
  }
  for (const row of rows) {
    if (conflictingSourceIds.has(row.sourceId)) continue;
    try {
      const sourceNoteScope = isChatSource(row.provenance.kind) ? { chatIds: [row.provenance.sourceId] } : row.scope,
        scope = withMergedLtmScopeLinks(sourceNoteScope, destinationScope ?? row.scope),
        input = {
          id: row.sourceNoteId,
          title: row.title,
          type: "source" as const,
          status: "active" as const,
          modes: row.modes,
          scope,
          ...(destinationScope ? { destinationScope } : {}),
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
          found && found.id !== row.sourceNoteId ? await storage.renameNoteId(found.id, row.sourceNoteId) : found,
        note = existing
          ? await storage.updateNote(existing.id, {
              title: row.title,
              status: "active",
              modes: request.modes ?? (request.mode ? [request.mode] : undefined) ?? existing.modes ?? row.modes,
              scope,
              ...(destinationScope ? { destinationScope } : {}),
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
        extractionMode: row.extractionMode,
        ...(row.deterministicSourceText ? { deterministicSourceText: row.deterministicSourceText } : {}),
        ...(row.previousPiece ? { previousPiece: row.previousPiece } : {}),
      });
    } catch (error) {
      // An unexpected failure's message can carry file paths or library internals, so it stays in the server log.
      if (!(error instanceof LtmServiceError))
        logger.error(error, "[ltm] Failed to write imported source %s", row.sourceId);
      writeFailures.push({
        sourceId: row.sourceId,
        title: row.title,
        sourceWriteStatus: "failed",
        extractionStatus: "not_started",
        retryable: true,
        error: {
          code: "source_write_failed",
          message:
            error instanceof LtmServiceError
              ? error.message
              : "Failed to write imported source note. Details are in the server log.",
        },
      });
    }
  }
  const results = request.extract
      ? await processLongTermMemorySourceBatch({
          items: written,
          languageModel,
          mode: request.mode,
          modes: request.modes,
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
          sourceWriteStatus: item.created ? ("created" as const) : ("refreshed" as const),
          extractionMode: item.extractionMode,
          extractionStatus: "not_started" as const,
          extractionMethod: "none" as const,
          retryable: false as const,
          draft: null,
          diagnostics: [],
          outcome: {
            state: "no_suggestions_created" as const,
            incomplete: false,
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
    cancelled = results.filter((item) => item.extractionStatus === "cancelled").length,
    failed = results.filter((item) => item.extractionStatus === "failed").length,
    succeeded = results.filter((item) => item.extractionStatus === "succeeded").length,
    hasIncomplete = results.some((item) => item.extractionStatus === "incomplete");
  const counts = {
      requested: request.sourceIds.length,
      sourceNotesWritten: written.length,
      succeeded,
      failed,
      cancelled,
      missing: missingSourceIds.length,
      sourceWriteFailed: writeFailures.length,
    },
    incomplete = counts.failed + counts.cancelled + counts.missing + counts.sourceWriteFailed,
    batchStatus =
      incomplete === 0 && !hasIncomplete
        ? ("success" as const)
        : counts.succeeded || hasIncomplete
          ? ("partial_success" as const)
          : counts.cancelled && !counts.failed && !counts.missing && !counts.sourceWriteFailed
            ? ("cancelled" as const)
            : ("failed" as const);
  // The pass hides only pieces this or an earlier import extracted, so failed and cancelled pieces stay visible. The
  // notes are already written, so a failure here only leaves the messages visible until the next import.
  if (request.source === "messages" && written.length)
    await hideImportedChatMessages(root, new Set(rows.map((row) => row.provenance.sourceId))).catch((error) =>
      logger.warn(error, "[ltm] Could not hide imported chat messages from the AI"),
    );
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
