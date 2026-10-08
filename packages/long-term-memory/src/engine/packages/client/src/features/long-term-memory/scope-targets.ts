import type { LtmMode, LtmScope } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import {
  getLtmScopeChatIds,
  getLtmScopeGroupIds,
  getLtmScopePersonaIds,
} from "../../../../shared/src/features/agents/long-term-memory/scope.js";
import { uniqueStrings } from "../../../../shared/src/features/agents/long-term-memory/utils.js";

export type ScopeTargetChat = {
  id: string;
  label: string;
  mode: LtmMode;
  groupId: string | null;
  personaId: string | null;
  characterIds: string[];
  chatName?: string | null;
};
export type ScopeTargetGroup = { id: string; label: string; chatIds: string[] };
export type ScopeTargetCharacter = {
  id: string;
  label: string;
  comment?: string;
};
export type ScopeTargetPersona = {
  id: string;
  label: string;
  comment?: string;
};
export type ScopeTargetLocalCharacter = {
  id: string;
  label: string;
  comment?: string;
  familyId: string;
};
export type ScopeTargets = {
  currentScope: LtmScope | null;
  chats: ScopeTargetChat[];
  groups: ScopeTargetGroup[];
  characters: ScopeTargetCharacter[];
  personas: ScopeTargetPersona[];
  localCharacters: ScopeTargetLocalCharacter[];
  memoryPresence?: LtmScope[] | null;
};
export type ScopeIndexes = {
  chatsById: Map<string, ScopeTargetChat>;
  characterIdsByChatId: Map<string, Set<string>>;
  chatsByCharacterId: Map<string, ScopeTargetChat[]>;
};

/** Keeps the first item for each id, in order, without the quadratic `findIndex` scan. */
export function uniqueById<T extends { id: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

/**
 * Answers `memoryPresence.some((scope) => ltmScopesOverlap(scope, place, { includeGlobal: false }))`
 * from one id index. Without globals, two scopes overlap only by sharing a chat, group,
 * character or persona id, so pickers no longer rescan every memory for every place.
 */
export function buildScopeMemoryPresence(memoryPresence: readonly LtmScope[]) {
  const chatIds = new Set(memoryPresence.flatMap((scope) => getLtmScopeChatIds(scope)));
  const groupIds = new Set(memoryPresence.flatMap((scope) => getLtmScopeGroupIds(scope)));
  const characterIds = new Set(memoryPresence.flatMap((scope) => uniqueStrings(scope.characterIds ?? [])));
  const personaIds = new Set(memoryPresence.flatMap((scope) => getLtmScopePersonaIds(scope)));
  return (scope: LtmScope | null | undefined) =>
    getLtmScopeChatIds(scope).some((id) => chatIds.has(id)) ||
    getLtmScopeGroupIds(scope).some((id) => groupIds.has(id)) ||
    uniqueStrings(scope?.characterIds ?? []).some((id) => characterIds.has(id)) ||
    getLtmScopePersonaIds(scope).some((id) => personaIds.has(id));
}

export function buildScopeIndexes(chats: ScopeTargetChat[]): ScopeIndexes {
  const chatsById = new Map(chats.map((chat) => [chat.id, chat]));
  const characterIdsByChatId = new Map(chats.map((chat) => [chat.id, new Set(chat.characterIds)]));
  const chatsByCharacterId = new Map<string, ScopeTargetChat[]>();
  for (const chat of chats) {
    for (const characterId of chat.characterIds) {
      const characterChats = chatsByCharacterId.get(characterId) ?? [];
      characterChats.push(chat);
      chatsByCharacterId.set(characterId, characterChats);
    }
  }
  return { chatsById, characterIdsByChatId, chatsByCharacterId };
}

export function deriveScopeBranchChats(chats: ScopeTargetChat[]) {
  return chats.filter((chat) => Boolean(chat.groupId));
}

export function deriveScopeConversations(
  chats: ScopeTargetChat[],
  groups: ScopeTargetGroup[],
  selectedCharacterId: string,
  indexes: ScopeIndexes,
  getGroupLabel: (group: ScopeTargetGroup) => string = (group) => group.label,
) {
  const visibleChatIds = new Set(chats.map((chat) => chat.id));
  return [
    ...groups
      .map((group) => ({
        id: `group:${group.id}`,
        label: getGroupLabel(group),
        chatIds: group.chatIds.filter((id) => visibleChatIds.has(id)),
      }))
      .filter((group) => group.chatIds.length),
    ...chats
      .filter((chat) => !chat.groupId)
      .map((chat) => ({
        id: `chat:${chat.id}`,
        label: chat.label,
        chatIds: [chat.id],
      })),
  ].filter(
    (conversation) =>
      !selectedCharacterId ||
      conversation.chatIds.some((id) => indexes.characterIdsByChatId.get(id)?.has(selectedCharacterId)),
  );
}

export function deriveScopeBranches(conversation: { chatIds: string[] } | undefined, indexes: ScopeIndexes) {
  return (conversation?.chatIds ?? [])
    .map((id) => indexes.chatsById.get(id))
    .filter((chat): chat is ScopeTargetChat => Boolean(chat?.groupId));
}
