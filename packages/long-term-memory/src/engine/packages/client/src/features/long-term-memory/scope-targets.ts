import type { LtmMode, LtmScope } from "../../../../shared/src/features/agents/long-term-memory/schema.js";

export type ScopeTargetChat = {
  id: string;
  label: string;
  mode: LtmMode;
  groupId: string | null;
  personaId: string | null;
  characterIds: string[];
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
export type ScopeTargets = {
  currentScope: LtmScope | null;
  chats: ScopeTargetChat[];
  groups: ScopeTargetGroup[];
  characters: ScopeTargetCharacter[];
  personas: ScopeTargetPersona[];
};
export type ScopeIndexes = {
  chatsById: Map<string, ScopeTargetChat>;
  characterIdsByChatId: Map<string, Set<string>>;
  chatsByCharacterId: Map<string, ScopeTargetChat[]>;
};

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

export function deriveScopeConversations(
  chats: ScopeTargetChat[],
  groups: ScopeTargetGroup[],
  selectedCharacterId: string,
  indexes: ScopeIndexes,
  getGroupLabel: (group: ScopeTargetGroup) => string = (group) => group.label,
) {
  return [
    ...groups.map((group) => ({
      id: `group:${group.id}`,
      label: getGroupLabel(group),
      chatIds: group.chatIds,
    })),
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
    .filter((chat): chat is ScopeTargetChat => Boolean(chat));
}
