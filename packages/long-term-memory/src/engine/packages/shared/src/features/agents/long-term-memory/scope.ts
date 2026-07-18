import { ltmModeSchema, type LtmMode, type LtmScope } from "./schema.js";

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

export type LtmScopeMatcherInput = {
  scope?: LtmScope | null;
  characterIds?: string[];
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
    scope?.characterIds?.length
  );
}

export function ltmScopesOverlap(
  noteScope: LtmScope | null | undefined,
  targetScope: LtmScope | null | undefined,
  options: { noteType?: string; noteId?: string; characterIds?: string[]; includeGlobal?: boolean } = {},
): boolean {
  const includeGlobal = options.includeGlobal ?? true;
  const targetCharacterIds = uniqueStrings([...(targetScope?.characterIds ?? []), ...(options.characterIds ?? [])]);

  if (isGlobalLtmScope(noteScope) || isGlobalLtmScope(targetScope)) {
    return includeGlobal;
  }

  const noteChatIds = new Set(getLtmScopeChatIds(noteScope));
  const targetChatIds = getLtmScopeChatIds(targetScope);
  if (targetChatIds.some((chatId) => noteChatIds.has(chatId))) return true;

  if (noteScope?.groupId && noteScope.groupId === targetScope?.groupId) return true;

  const targetCharacters = new Set(targetCharacterIds);
  if (noteScope?.characterIds?.some((characterId) => targetCharacters.has(characterId))) return true;

  if (options.noteType === "character" && options.noteId && targetCharacters.has(options.noteId)) return true;

  return false;
}

export function matchesLtmScope(
  note: { id: string; type: string; scope: LtmScope },
  input: LtmScopeMatcherInput | null | undefined,
): boolean {
  if (!input?.scope && !input?.characterIds?.length) return input?.includeGlobal === false ? !isGlobalLtmScope(note.scope) : true;

  const targetScope = input.scope ?? {};
  const targetCharacterIds = uniqueStrings([...(targetScope.characterIds ?? []), ...(input.characterIds ?? [])]);
  const hasTargetScope = !isGlobalLtmScope(targetScope) || targetCharacterIds.length > 0;
  const noteHasScope = !isGlobalLtmScope(note.scope);

  if (!hasTargetScope) {
    return noteHasScope ? false : input.includeGlobal !== false;
  }

  if (!noteHasScope) return input.includeGlobal !== false;

  return ltmScopesOverlap(note.scope, targetScope, {
    noteId: note.id,
    noteType: note.type,
    characterIds: targetCharacterIds,
    includeGlobal: input.includeGlobal,
  });
}

export function withMergedLtmScopeLinks(
  scope: LtmScope | null | undefined,
  links: { chatIds?: string[]; characterIds?: string[] },
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

  return next;
}
