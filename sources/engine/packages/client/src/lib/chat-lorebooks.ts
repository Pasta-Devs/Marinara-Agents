import type { Chat, Lorebook } from "@marinara-engine/shared";
import { getChatCharacterIds } from "./chat-macros";
import { isLorebookScopeActiveForChat } from "./lorebook-scope";

export type LorebookActiveReason = "Global" | "Character" | "Persona" | "Chat";

export type ActiveLorebookView = Lorebook & {
  activeReasons: LorebookActiveReason[];
  isPinned: boolean;
  /** User disabled this auto-activated book for the chat (in excludedLorebookIds). */
  isExcluded: boolean;
};

function parseChatMetadata(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

export function getChatActiveLorebookIds(chat: Pick<Chat, "metadata">): string[] {
  return readStringArray(parseChatMetadata(chat.metadata).activeLorebookIds);
}

export function getChatExcludedLorebookIds(chat: Pick<Chat, "metadata">): string[] {
  return readStringArray(parseChatMetadata(chat.metadata).excludedLorebookIds);
}

export function deriveActiveLorebookViews({
  activeLorebookIds,
  chat,
  dropExcluded = false,
  excludedLorebookIds,
  excludeGameLorebookKeeper = false,
  gameLorebookKeeperLorebookId = null,
  lorebooks,
}: {
  activeLorebookIds: string[];
  chat: Pick<Chat, "characterIds" | "id" | "personaId">;
  dropExcluded?: boolean;
  excludedLorebookIds: string[];
  excludeGameLorebookKeeper?: boolean;
  gameLorebookKeeperLorebookId?: string | null;
  lorebooks: Lorebook[];
}): ActiveLorebookView[] {
  const chatCharacterIds = getChatCharacterIds({ characterIds: chat.characterIds });
  const pinnedIds = new Set(activeLorebookIds);
  const excludedIds = new Set(excludedLorebookIds);

  return lorebooks.flatMap((lorebook) => {
    if (dropExcluded && excludedIds.has(lorebook.id)) return [];
    if (
      excludeGameLorebookKeeper &&
      (lorebook.id === gameLorebookKeeperLorebookId || lorebook.sourceAgentId === "game-lorebook-keeper")
    ) {
      return [];
    }

    const reasons: LorebookActiveReason[] = [];
    const isPinned = pinnedIds.has(lorebook.id);

    if (lorebook.enabled !== false && isLorebookScopeActiveForChat(lorebook.scope, chat.id)) {
      if (isPinned) reasons.push("Chat");
      if (lorebook.isGlobal) reasons.push("Global");
      if (
        (lorebook.characterIds ?? []).some((id) => chatCharacterIds.includes(id)) ||
        (!!lorebook.characterId && chatCharacterIds.includes(lorebook.characterId))
      ) {
        reasons.push("Character");
      }
      if (
        !!chat.personaId &&
        ((lorebook.personaIds ?? []).includes(chat.personaId) || lorebook.personaId === chat.personaId)
      ) {
        reasons.push("Persona");
      }
      if (lorebook.chatId === chat.id && !reasons.includes("Chat")) reasons.push("Chat");
    }

    return reasons.length > 0
      ? [{ ...lorebook, activeReasons: reasons, isPinned, isExcluded: excludedIds.has(lorebook.id) }]
      : [];
  });
}
