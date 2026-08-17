import { ltmModeSchema, type LtmMode, type LtmScope } from "./schema.js";
import { uniqueStrings } from "./utils.js";

export type LtmScopeMatcherInput = {
  scope?: LtmScope | null;
  characterIds?: string[];
  personaId?: string;
  personaIds?: string[];
  includeGlobal?: boolean;
};

export function getLtmScopeChatIds(scope: Pick<LtmScope, "chatId" | "chatIds"> | null | undefined): string[] {
  return uniqueStrings([scope?.chatId, ...(scope?.chatIds ?? [])]);
}

export function getLtmScopeGroupIds(scope: Pick<LtmScope, "groupId" | "groupIds"> | null | undefined): string[] {
  return uniqueStrings([scope?.groupId, ...(scope?.groupIds ?? [])]);
}

export function getLtmScopePersonaIds(scope: Pick<LtmScope, "personaId" | "personaIds"> | null | undefined): string[] {
  return uniqueStrings([scope?.personaId, ...(scope?.personaIds ?? [])]);
}

export function normalizeLtmScope(scope: LtmScope | null | undefined): LtmScope {
  const chatIds = scope?.chatIds !== undefined ? uniqueStrings(scope.chatIds) : uniqueStrings([scope?.chatId]);
  const groupIds = scope?.groupIds !== undefined ? uniqueStrings(scope.groupIds) : uniqueStrings([scope?.groupId]);
  const characterIds = uniqueStrings(scope?.characterIds ?? []);
  const personaIds =
    scope?.personaIds !== undefined ? uniqueStrings(scope.personaIds) : uniqueStrings([scope?.personaId]);
  return {
    ...(chatIds.length ? { chatId: chatIds[0], chatIds } : {}),
    ...(groupIds.length ? { groupId: groupIds[0], groupIds } : {}),
    ...(characterIds.length ? { characterIds } : {}),
    ...(personaIds.length ? { personaId: personaIds[0], personaIds } : {}),
  };
}

export function ltmModeForChatMode(mode: unknown): LtmMode {
  return ltmModeSchema.catch("roleplay").parse(mode);
}

export function isGlobalLtmScope(scope: LtmScope | null | undefined): boolean {
  return !(
    getLtmScopeChatIds(scope).length ||
    getLtmScopeGroupIds(scope).length ||
    getLtmScopePersonaIds(scope).length ||
    scope?.characterIds?.length
  );
}

export function hasExplicitLtmAvailability(scope: LtmScope | null | undefined): boolean {
  return !isGlobalLtmScope(scope);
}

export function validateLtmExplicitAvailability(scope: LtmScope | null | undefined, modes: readonly LtmMode[]) {
  if (!hasExplicitLtmAvailability(scope)) return "Choose at least one place where this memory is available.";
  if (modes.length === 0) return "Choose at least one chat mode.";
  return null;
}

function intersects(left: readonly string[], right: readonly string[]) {
  if (!left.length || !right.length) return false;
  const rightSet = new Set(right);
  return left.some((value) => rightSet.has(value));
}

export function ltmScopesOverlap(
  noteScope: LtmScope | null | undefined,
  targetScope: LtmScope | null | undefined,
  options: {
    noteType?: string;
    noteId?: string;
    characterIds?: string[];
    personaId?: string;
    personaIds?: string[];
    includeGlobal?: boolean;
  } = {},
): boolean {
  const includeGlobal = options.includeGlobal ?? true;
  const targetCharacterIds = uniqueStrings([...(targetScope?.characterIds ?? []), ...(options.characterIds ?? [])]);
  const targetPersonaIds = uniqueStrings([
    ...getLtmScopePersonaIds(targetScope),
    options.personaId,
    ...(options.personaIds ?? []),
  ]);

  const targetIsGlobal =
    isGlobalLtmScope(targetScope) && targetCharacterIds.length === 0 && targetPersonaIds.length === 0;
  if (isGlobalLtmScope(noteScope) || targetIsGlobal) {
    return includeGlobal;
  }

  const noteChatIds = getLtmScopeChatIds(noteScope);
  const targetChatIds = getLtmScopeChatIds(targetScope);
  const noteGroupIds = getLtmScopeGroupIds(noteScope);
  const targetGroupIds = getLtmScopeGroupIds(targetScope);
  const noteCharacterIds = uniqueStrings(noteScope?.characterIds ?? []);
  const notePersonaIds = getLtmScopePersonaIds(noteScope);

  return (
    intersects(noteChatIds, targetChatIds) ||
    intersects(noteGroupIds, targetGroupIds) ||
    intersects(noteCharacterIds, targetCharacterIds) ||
    intersects(notePersonaIds, targetPersonaIds) ||
    (options.noteType === "character" && options.noteId !== undefined && targetCharacterIds.includes(options.noteId))
  );
}

export function matchesLtmScope(
  note: { id: string; type: string; scope: LtmScope },
  input: LtmScopeMatcherInput | null | undefined,
): boolean {
  if (!input?.scope && !input?.characterIds?.length && !input?.personaId && !input?.personaIds?.length) {
    return input?.includeGlobal === false ? !isGlobalLtmScope(note.scope) : true;
  }

  const targetScope = input?.scope ?? {};
  const targetCharacterIds = uniqueStrings([...(targetScope.characterIds ?? []), ...(input.characterIds ?? [])]);
  const targetPersonaIds = uniqueStrings([
    ...getLtmScopePersonaIds(targetScope),
    input.personaId,
    ...(input.personaIds ?? []),
  ]);
  const hasTargetScope = !isGlobalLtmScope(targetScope) || targetCharacterIds.length > 0 || targetPersonaIds.length > 0;
  const noteHasScope = !isGlobalLtmScope(note.scope);

  if (!hasTargetScope) {
    return noteHasScope ? false : input?.includeGlobal !== false;
  }

  if (!noteHasScope) {
    return input?.includeGlobal !== false;
  }

  return ltmScopesOverlap(note.scope, targetScope, {
    noteId: note.id,
    noteType: note.type,
    characterIds: targetCharacterIds,
    personaIds: targetPersonaIds,
    includeGlobal: input?.includeGlobal,
  });
}

export function withMergedLtmScopeLinks(
  scope: LtmScope | null | undefined,
  links: {
    chatIds?: string[];
    groupIds?: string[];
    characterIds?: string[];
    personaIds?: string[];
    personaId?: string;
  },
): LtmScope {
  return normalizeLtmScope({
    ...normalizeLtmScope(scope),
    chatIds: uniqueStrings([...getLtmScopeChatIds(scope), ...(links.chatIds ?? [])]),
    groupIds: uniqueStrings([...getLtmScopeGroupIds(scope), ...(links.groupIds ?? [])]),
    characterIds: uniqueStrings([...(scope?.characterIds ?? []), ...(links.characterIds ?? [])]),
    personaIds: uniqueStrings([...getLtmScopePersonaIds(scope), links.personaId, ...(links.personaIds ?? [])]),
  });
}
