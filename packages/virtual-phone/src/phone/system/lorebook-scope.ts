/**
 * Which lorebooks belong to a chat, and why.
 *
 * "All" used to mean every lorebook in the installation that was marked global, whether or not the
 * chat had it switched on — so a phone in one story was grounded in the lore of every other, and
 * the picker in Settings listed the lot with no indication of which had anything to do with the
 * story in front of you.
 *
 * The chat's own `activeLorebookIds` is authoritative when the chat records one. Books bound to
 * this chat, or attached to a character or persona in it, always count.
 */

export type LorebookScope = "active" | "chat" | "character" | "persona" | "global" | null;

export interface ChatLorebookContext {
  chatId?: string;
  characterIds: string[];
  personaId: string | null;
  activeLorebookIds: string[];
}

/** Reads the id list a lorebook card stores, which may be plural, singular, or both. */
function idsFrom(data: Record<string, unknown>, plural: string, single: string) {
  return [
    ...(Array.isArray(data[plural]) ? (data[plural] as unknown[]).filter((id): id is string => typeof id === "string") : []),
    ...(typeof data[single] === "string" ? [data[single] as string] : []),
  ];
}

export function lorebookScope(
  book: { id: string; data: unknown },
  context: ChatLorebookContext,
): LorebookScope {
  const data = book.data && typeof book.data === "object" ? book.data as Record<string, unknown> : {};
  if (context.activeLorebookIds.includes(book.id)) return "active";
  const boundChatId = typeof data.chatId === "string" ? data.chatId : null;
  if (context.chatId && boundChatId === context.chatId) return "chat";
  if (idsFrom(data, "characterIds", "characterId").some((id) => context.characterIds.includes(id))) return "character";
  if (context.personaId && idsFrom(data, "personaIds", "personaId").includes(context.personaId)) return "persona";
  /**
   * A chat that has never recorded an active list predates the field. Falling back to the old
   * "global counts everywhere" rule keeps those chats working rather than silently dropping their
   * lore; once a chat tracks its active books, a global one has to actually be switched on.
   */
  if (!context.activeLorebookIds.length && data.isGlobal === true) return "global";
  return null;
}
