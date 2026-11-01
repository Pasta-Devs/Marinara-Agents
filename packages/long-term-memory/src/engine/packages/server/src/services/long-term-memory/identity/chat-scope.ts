import { createHash } from "node:crypto";
import type {
  LtmMode,
  LtmNote,
  LtmScope,
  LtmSubject,
} from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import {
  chatOnlyLtmScope,
  getLtmScopeChatIds,
  ltmModeForChatMode as sharedLtmModeForChatMode,
  withMergedLtmScopeLinks,
} from "../../../../../shared/src/features/agents/long-term-memory/scope.js";
import { uniqueStrings } from "../ltm-utils.js";

export function parseLtmChatMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function getLtmChatDisplayName(chat: { name?: string | null; metadata?: unknown } | null | undefined): string {
  if (!chat) return "";
  const metadataRecord = parseLtmChatMetadata(chat.metadata);
  if (typeof metadataRecord?.branchName === "string") {
    const branchName = metadataRecord.branchName.trim();
    if (branchName) return branchName;
  }
  return chat.name?.trim() || "";
}

export function normalizeLtmChatCharacterIds(value: unknown) {
  if (Array.isArray(value)) return uniqueStrings(value.filter((id): id is string => typeof id === "string"));
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? uniqueStrings(parsed.filter((id): id is string => typeof id === "string"))
      : value.trim()
        ? [value.trim()]
        : [];
  } catch {
    return value.trim() ? [value.trim()] : [];
  }
}

export function ltmModeForChatMode(mode: unknown): LtmMode {
  return sharedLtmModeForChatMode(mode);
}

export function resolveChatLtmScope(chat: {
  id: string;
  groupId?: string | null;
  personaId?: string | null;
  characterIds?: unknown;
}) {
  const characterIds = normalizeLtmChatCharacterIds(chat.characterIds);
  return withMergedLtmScopeLinks(
    {
      chatId: chat.id,
      ...(chat.groupId ? { groupId: chat.groupId } : {}),
      ...(chat.personaId ? { personaId: chat.personaId } : {}),
      ...(characterIds.length ? { characterIds } : {}),
    },
    { chatIds: [chat.id] },
  ) satisfies LtmScope;
}

export function resolveChatLtmWriteScope(chat: { id: string; groupId?: string | null }) {
  return chatOnlyLtmScope(chat.id);
}

/**
 * Issue #1433: Engine copies the summary entries a branch shares with its parent, ids included.
 * A branch therefore also recalls a memory saved to another branch of its conversation when every
 * chat summary the memory was extracted from is one of the branch's own. Recall only: the stored
 * scope, saving and editing are unchanged.
 */
export function inheritedBranchLtmNoteIds(input: {
  chatId: string;
  branchChatIds: readonly string[];
  summaryEntryIds: ReadonlySet<string>;
  notes: readonly LtmNote[];
}) {
  const branchChatIds = new Set(input.branchChatIds.filter((id) => id !== input.chatId));
  const conversationChatIds = new Set([input.chatId, ...branchChatIds]);
  const notesById = new Map(input.notes.map((note) => [note.id, note]));
  // A link to a missing note, or to a source that is not a shared chat summary, fails the test.
  const sharedSummary = (noteId: string) => {
    const provenance = notesById.get(noteId)?.provenance;
    return (
      provenance?.kind === "chat_summary" &&
      conversationChatIds.has(provenance.sourceId) &&
      provenance.entryId !== undefined &&
      input.summaryEntryIds.has(provenance.entryId)
    );
  };
  const inherited = new Set<string>();
  for (const note of input.notes) {
    if (!getLtmScopeChatIds(note.scope).some((id) => branchChatIds.has(id))) continue;
    const sources = note.links.filter((link) => link.relation === "extracted_from");
    if (sources.length && sources.every((link) => sharedSummary(link.target))) inherited.add(note.id);
  }
  return inherited;
}

export function ltmScopeFamilyId(scope: Pick<LtmScope, "chatId" | "chatIds" | "groupId" | "groupIds">) {
  const groupIds = getScopeIds(scope.groupId, scope.groupIds);
  if (groupIds.length === 1) return `group_${normalizeLocalIdentityComponent(groupIds[0]!, 48)}`;
  if (groupIds.length > 1) return null;
  const chatIds = getScopeIds(scope.chatId, scope.chatIds);
  return chatIds.length === 1 ? `chat_${normalizeLocalIdentityComponent(chatIds[0]!, 48)}` : null;
}

export function localCharacterSubjectForName(scope: LtmScope, name: string): LtmSubject | null {
  const familyId = ltmScopeFamilyId(scope);
  const nameSlug = normalizeLocalIdentityComponent(name, 48);
  if (!familyId || !nameSlug) return null;
  const id = `${familyId}:${nameSlug}`;
  return {
    key: `local_character:${id}`,
    ref: { kind: "local_character", id },
  };
}

export function localCharacterFamilyFromKey(key: string) {
  if (!key.startsWith("local_character:")) return null;
  const id = key.slice("local_character:".length);
  const separator = id.indexOf(":");
  return separator > 0 ? id.slice(0, separator) : null;
}

export function localCharacterSubjectFromKey(subject: Pick<LtmSubject, "key" | "ref">) {
  if (subject.ref?.kind === "local_character") return subject;
  if (!subject.key.startsWith("local_character:")) return null;
  const id = subject.key.slice("local_character:".length);
  return id.includes(":") ? { ...subject, ref: { kind: "local_character" as const, id } } : null;
}

export function isLocalCharacterSubject(subject: Pick<LtmSubject, "key" | "ref">) {
  return subject.ref?.kind === "local_character" || subject.key.startsWith("local_character:");
}

export function localCharacterScopeError(subjects: readonly LtmSubject[] | undefined, scope: LtmScope | undefined) {
  const localSubjects = (subjects ?? []).filter(isLocalCharacterSubject);
  if (!localSubjects.length) return null;
  const familyId = scope && ltmScopeFamilyId(scope);
  if (!familyId) return "Local character subjects require a single chat or group family.";
  for (const subject of localSubjects) {
    if (
      subject.ref?.kind !== "local_character" ||
      subject.key !== `local_character:${subject.ref.id}` ||
      localCharacterFamilyFromKey(subject.key) !== familyId
    )
      return "Local character subjects must belong to the note's single chat or group family.";
  }
  return null;
}

function getScopeIds(primary: string | null | undefined, values: string[] | undefined) {
  return uniqueStrings([primary, ...(values ?? [])]);
}

function normalizeLocalIdentityComponent(value: string, maxLength: number) {
  const raw = value.trim().toLowerCase();
  const normalized = raw
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+$/g, "");
  if (normalized && normalized.length <= maxLength && normalized === raw) return normalized;
  const digest = createHash("sha256").update(raw).digest("hex").slice(0, 12);
  const suffix = `_${digest}`;
  return `${(normalized || "x").slice(0, Math.max(1, maxLength - suffix.length))}${suffix}`;
}
