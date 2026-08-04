import { ltmModeSchema, type LtmMode, type LtmScope } from "./schema.js";
import { uniqueStrings } from "./utils.js";

export type LtmScopeMatcherInput = {
  scope?: LtmScope | null;
  characterIds?: string[];
  personaId?: string;
  includeGlobal?: boolean;
};

export function getLtmScopeChatIds(scope: Pick<LtmScope, "chatId" | "chatIds"> | null | undefined): string[] {
  return uniqueStrings([scope?.chatId, ...(scope?.chatIds ?? [])]);
}

export function ltmModeForChatMode(mode: unknown): LtmMode {
  return ltmModeSchema.catch("roleplay").parse(mode);
}

export function isGlobalLtmScope(scope: LtmScope | null | undefined): boolean {
  return !(
    getLtmScopeChatIds(scope).length ||
    scope?.groupId ||
    scope?.personaId ||
    scope?.characterIds?.length
  );
}

export function ltmScopesOverlap(
  noteScope: LtmScope | null | undefined,
  targetScope: LtmScope | null | undefined,
  options: { noteType?: string; noteId?: string; characterIds?: string[]; personaId?: string; includeGlobal?: boolean } = {},
): boolean {
  const includeGlobal = options.includeGlobal ?? true;
  const targetCharacterIds = uniqueStrings([...(targetScope?.characterIds ?? []), ...(options.characterIds ?? [])]);

  if (isGlobalLtmScope(noteScope) || isGlobalLtmScope(targetScope)) {
    return includeGlobal;
  }

  const noteChatIds = getLtmScopeChatIds(noteScope);
  const targetChatIds = getLtmScopeChatIds(targetScope);
  const noteCharacterIds = uniqueStrings(noteScope?.characterIds ?? []);
  const characterOverlap = noteCharacterIds.length > 0 && targetCharacterIds.length > 0 &&
    noteCharacterIds.some((id) => targetCharacterIds.includes(id));
  if (
    noteCharacterIds.length > 0 &&
    targetCharacterIds.length > 0 &&
    !characterOverlap
  )
    return false;

  if (noteChatIds.length > 0) {
    const noteChatIdSet = new Set(noteChatIds);
    const chatOverlap = targetChatIds.some((chatId) => noteChatIdSet.has(chatId));
    const targetPersonaId = targetScope?.personaId ?? options.personaId;
    if (noteScope?.groupId && !chatOverlap && noteScope.groupId !== targetScope?.groupId) return false;
    if (
      noteScope?.personaId &&
      ((!targetPersonaId && targetCharacterIds.length === 0) ||
        (!chatOverlap && noteScope.personaId !== targetPersonaId))
    ) return false;
    if (targetChatIds.length > 0 && !chatOverlap && !characterOverlap) return false;
    if (
      !targetChatIds.length &&
      (!targetCharacterIds.length || !noteCharacterIds.length)
    )
      return false;
    return chatOverlap || characterOverlap;
  }

  if (noteScope?.groupId) {
    if (noteScope.groupId !== targetScope?.groupId) return false;
    const targetPersonaId = targetScope?.personaId ?? options.personaId;
    return !noteScope.personaId || !targetPersonaId || noteScope.personaId === targetPersonaId;
  }

  if (noteScope?.personaId) {
    const targetPersonaId = targetScope?.personaId ?? options.personaId;
    return noteScope.personaId === targetPersonaId;
  }

  if (noteScope?.characterIds?.length) {
    const targetCharacters = new Set(targetCharacterIds);
    return noteScope.characterIds.some((characterId) => targetCharacters.has(characterId));
  }

  if (options.noteType === "character" && options.noteId && new Set(targetCharacterIds).has(options.noteId)) return true;

  return false;
}

export function matchesLtmScope(
  note: { id: string; type: string; scope: LtmScope },
  input: LtmScopeMatcherInput | null | undefined,
): boolean {
  if (!input?.scope && !input?.characterIds?.length && !input?.personaId) return input?.includeGlobal === false ? !isGlobalLtmScope(note.scope) : true;

  const targetScope = input?.scope ?? {};
  const targetCharacterIds = uniqueStrings([...(targetScope.characterIds ?? []), ...(input?.characterIds ?? [])]);
  const hasTargetScope = !isGlobalLtmScope(targetScope) || targetCharacterIds.length > 0 || Boolean(input?.personaId);
  const noteHasScope = !isGlobalLtmScope(note.scope);

  if (!hasTargetScope) {
    return noteHasScope ? false : input?.includeGlobal !== false;
  }

  if (!noteHasScope)
    return (
      (note.type === "character" && targetCharacterIds.includes(note.id)) ||
      input?.includeGlobal !== false
    );

  return ltmScopesOverlap(note.scope, targetScope, {
    noteId: note.id,
    noteType: note.type,
    characterIds: targetCharacterIds,
    personaId: input?.personaId,
    includeGlobal: input?.includeGlobal,
  });
}

export function withMergedLtmScopeLinks(
  scope: LtmScope | null | undefined,
  links: { chatIds?: string[]; characterIds?: string[]; personaId?: string },
): LtmScope {
  const next: LtmScope = { ...(scope ?? {}) };
  const chatIds = uniqueStrings([...getLtmScopeChatIds(next), ...(links.chatIds ?? [])]);
  const characterIds = uniqueStrings([...(next.characterIds ?? []), ...(links.characterIds ?? [])]);

  if (chatIds.length > 0) {
    next.chatIds = chatIds;
    next.chatId = chatIds[0];
  } else {
    delete next.chatIds;
    delete next.chatId;
  }

  if (characterIds.length > 0) {
    next.characterIds = characterIds;
  } else {
    delete next.characterIds;
  }

  if (links.personaId) next.personaId = links.personaId;

  return next;
}
