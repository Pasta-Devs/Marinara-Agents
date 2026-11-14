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
 * The last message number of a chat transcript piece or numbered summary range source note
 * (`message_range:<first>-<last>` or `message_range:<n>` evidence), or undefined for any other source.
 */
export function ltmSourceLastMessageNumber(note: LtmNote | undefined) {
  if (note?.provenance?.kind !== "chat_transcript" && note?.provenance?.kind !== "chat_summary") return undefined;
  const range = note.sections.source?.evidence
    ?.find((entry) => entry.startsWith("message_range:"))
    ?.slice("message_range:".length)
    .trim()
    .match(/^(\d+)(?:-(\d+))?$/);
  const first = Number(range?.[1]),
    last = Number(range?.[2] ?? range?.[1]);
  return range && first > 0 && first <= last ? last : undefined;
}

type LtmBranchChat = { id: string; metadata: unknown };

/**
 * How many messages, counted from the start, `chatId` shares with each of `otherChatIds` in its
 * conversation. Engine copies a branch's first messages from its parent in order under new ids and
 * records `branchParentChatId` and `branchMessageId` (its copy of the fork message), so a branch's
 * copied count is that message's position in its own messages; a branch made before the first message
 * records both message ids as null and copied none. Siblings and grandchildren share the smallest
 * copied count on the way to their common ancestor. Older branches without the fork message, an unknown
 * fork message and chats with no recorded link compare the messages' `createdAt`, which the copy keeps.
 * `listMessages` is called at most once per chat, and only where those need it.
 * ponytail: positions are fork-time positions and the copies are trusted as copied. A parent message
 * deleted before the fork point after branching shifts later numbers by one, and a copied message the
 * branch later edits, rerolls or deletes still shares the parent's memories of the original.
 * Upgrade path: map pieces by the Engine's copied message ids and compare their content.
 */
export async function sharedLtmMessageCounts(input: {
  chatId: string;
  chats: readonly LtmBranchChat[];
  otherChatIds: Iterable<string>;
  listMessages: (chatId: string) => Promise<ReadonlyArray<{ id: string; createdAt: string }>>;
}) {
  const metadataById = new Map(input.chats.map((chat) => [chat.id, parseLtmChatMetadata(chat.metadata)]));
  const parentOf = (chatId: string) => {
    const parentId = metadataById.get(chatId)?.branchParentChatId;
    return typeof parentId === "string" && parentId !== chatId && metadataById.has(parentId) ? parentId : undefined;
  };
  const chainOf = (chatId: string) => {
    const chain = [chatId];
    for (let parentId = parentOf(chatId); parentId && !chain.includes(parentId); parentId = parentOf(parentId))
      chain.push(parentId);
    return chain;
  };
  const listed = new Map<string, ReturnType<typeof input.listMessages>>();
  const messagesOf = (chatId: string) => {
    if (!listed.has(chatId)) listed.set(chatId, input.listMessages(chatId));
    return listed.get(chatId)!;
  };
  const createdAtPrefix = async (leftId: string, rightId: string) => {
    const [left, right] = await Promise.all([messagesOf(leftId), messagesOf(rightId)]);
    let count = 0;
    while (count < left.length && count < right.length && left[count]!.createdAt === right[count]!.createdAt) count++;
    return count;
  };
  const copied = new Map<string, Promise<number>>();
  const copiedCount = (chatId: string) => {
    if (!copied.has(chatId))
      copied.set(
        chatId,
        (async () => {
          const metadata = metadataById.get(chatId)!;
          if (metadata.branchMessageId === null && metadata.branchParentMessageId === null) return 0;
          const forkMessageId = metadata.branchMessageId;
          const index =
            typeof forkMessageId === "string" && forkMessageId
              ? (await messagesOf(chatId)).findIndex((message) => message.id === forkMessageId)
              : -1;
          return index >= 0 ? index + 1 : createdAtPrefix(chatId, parentOf(chatId)!);
        })(),
      );
    return copied.get(chatId)!;
  };
  const ownChain = chainOf(input.chatId);
  const counts = new Map<string, number>();
  for (const otherId of new Set(input.otherChatIds)) {
    if (otherId === input.chatId) continue;
    const otherChain = chainOf(otherId);
    const ancestor = ownChain.find((id) => otherChain.includes(id));
    if (!ancestor) {
      counts.set(otherId, await createdAtPrefix(input.chatId, otherId));
      continue;
    }
    const below = [
      ...ownChain.slice(0, ownChain.indexOf(ancestor)),
      ...otherChain.slice(0, otherChain.indexOf(ancestor)),
    ];
    counts.set(otherId, Math.min(...(await Promise.all(below.map(copiedCount)))));
  }
  return counts;
}

/**
 * Whether `chatId` shares a source note of its own conversation: one of its own sources, a chat
 * summary whose entry is one of `chatId`'s (`summaryEntryIds`), or a chat transcript piece or numbered
 * summary range that ends within the messages `chatId` shares with the source's chat
 * (`sharedMessageCounts`, from `sharedLtmMessageCounts`; a chat missing from it shares none).
 */
export function isLtmSourceSharedWithChat(
  source: LtmNote | undefined,
  input: { chatId: string; summaryEntryIds?: ReadonlySet<string>; sharedMessageCounts?: ReadonlyMap<string, number> },
) {
  const provenance = source?.provenance;
  if (!provenance) return false;
  if (
    provenance.kind === "chat_summary" &&
    provenance.entryId !== undefined &&
    input.summaryEntryIds?.has(provenance.entryId)
  )
    return true;
  const last = ltmSourceLastMessageNumber(source);
  const shared =
    provenance.sourceId === input.chatId ? Infinity : (input.sharedMessageCounts?.get(provenance.sourceId) ?? 0);
  return last !== undefined && last <= shared;
}

/**
 * Issue #1433: Engine copies the summary entries a branch shares with its parent, ids included.
 * A branch therefore also recalls a memory saved to another branch of its conversation when every
 * source the memory was extracted from is shared: a chat summary that is one of the branch's own,
 * or a chat transcript piece or numbered summary range that ends within the messages the two chats
 * share (`sharedMessageCounts`, from `sharedLtmMessageCounts`). Recall only: the stored scope,
 * saving and editing are unchanged.
 */
export function inheritedBranchLtmNoteIds(input: {
  chatId: string;
  branchChatIds: readonly string[];
  summaryEntryIds: ReadonlySet<string>;
  notes: readonly LtmNote[];
  sharedMessageCounts?: ReadonlyMap<string, number>;
}) {
  const branchChatIds = new Set(input.branchChatIds.filter((id) => id !== input.chatId));
  const conversationChatIds = new Set([input.chatId, ...branchChatIds]);
  const notesById = new Map(input.notes.map((note) => [note.id, note]));
  // A link to a missing note, or to a source that is neither a shared chat summary nor a piece of
  // the shared messages, fails the test.
  const sharedSource = (noteId: string) => {
    const source = notesById.get(noteId);
    return (
      source?.provenance !== undefined &&
      conversationChatIds.has(source.provenance.sourceId) &&
      isLtmSourceSharedWithChat(source, input)
    );
  };
  const inherited = new Set<string>();
  for (const note of input.notes) {
    if (!getLtmScopeChatIds(note.scope).some((id) => branchChatIds.has(id))) continue;
    const sources = note.links.filter((link) => link.relation === "extracted_from");
    if (sources.length && sources.every((link) => sharedSource(link.target))) inherited.add(note.id);
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
