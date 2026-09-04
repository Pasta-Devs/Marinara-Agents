import type { LtmMode, LtmScope, LtmSubject } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import {
  ltmModeForChatMode as sharedLtmModeForChatMode,
  withMergedLtmScopeLinks,
} from "../../../../shared/src/features/agents/long-term-memory/scope.js";
import { uniqueStrings } from "./ltm-utils.js";

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

export function resolveChatLtmWriteScope(chat: { id: string }) {
  return { chatId: chat.id, chatIds: [chat.id] } satisfies LtmScope;
}

export function ltmScopeFamilyId(scope: Pick<LtmScope, "chatId" | "chatIds" | "groupId" | "groupIds">) {
  const groupIds = getScopeIds(scope.groupId, scope.groupIds);
  if (groupIds.length === 1) return normalizeLocalIdentityComponent(groupIds[0]!, 48);
  if (groupIds.length > 1) return null;
  const chatIds = getScopeIds(scope.chatId, scope.chatIds);
  return chatIds.length === 1 ? normalizeLocalIdentityComponent(chatIds[0]!, 48) : null;
}

export function localCharacterSubjectForName(scope: LtmScope, name: string): LtmSubject | null {
  const familyId = ltmScopeFamilyId(scope);
  const nameSlug = normalizeLocalIdentityComponent(name, 48);
  if (!familyId || !nameSlug) return null;
  const id = `${familyId}:${nameSlug}`.slice(0, 120);
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

function getScopeIds(primary: string | null | undefined, values: string[] | undefined) {
  return uniqueStrings([primary, ...(values ?? [])]);
}

function normalizeLocalIdentityComponent(value: string, maxLength: number) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, maxLength)
    .replace(/_+$/g, "");
}
