import type { LtmMode, LtmScope } from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import {
  getLtmScopeChatIds,
  getLtmScopeGroupIds,
  getLtmScopePersonaIds,
} from "../../../../../shared/src/features/agents/long-term-memory/scope.js";
import { humanizeLabel } from "../display-labels";
import type { AvailabilityChatTarget, AvailabilityTarget } from "../AvailabilityTabRail";
import type { PickerTarget } from "./TargetPicker";

export const modes: readonly LtmMode[] = ["conversation", "roleplay", "game"];

export type Target = { id: string; label: string; scope?: LtmScope; comment?: string; chatName?: string | null };

export type AvailabilityTargets = {
  characters: AvailabilityTarget[];
  personas: AvailabilityTarget[];
  chats: AvailabilityChatTarget[];
  branches: AvailabilityChatTarget[];
};
type BulkAvailabilityTargetKind = "group" | "chat" | "character" | "persona";

export function splitBulkAvailabilityTarget(target: string): [BulkAvailabilityTargetKind, string] {
  const [kind, ...parts] = target.split(":");
  return [kind as BulkAvailabilityTargetKind, parts.join(":")];
}

export function hasExplicitScope(scope: LtmScope) {
  return Boolean(
    getLtmScopeChatIds(scope).length ||
    getLtmScopeGroupIds(scope).length ||
    scope.characterIds?.length ||
    getLtmScopePersonaIds(scope).length,
  );
}
export function sameScope(left: LtmScope, right: LtmScope) {
  const normalize = (scope: LtmScope) => ({
    chatIds: getLtmScopeChatIds(scope).sort(),
    groupIds: getLtmScopeGroupIds(scope).sort(),
    characterIds: [...(scope.characterIds ?? [])].sort(),
    personaIds: getLtmScopePersonaIds(scope).sort(),
  });
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}
export function sameModes(left: readonly LtmMode[], right: readonly LtmMode[]) {
  return left.length === right.length && left.every((mode) => right.includes(mode));
}

/**
 * The branch ids that selected whole chats cover. Sources' "All branches" saves them beside the chat's group id,
 * so while that chat is selected they count as part of it (#1442).
 */
export function wholeChatBranchIds(groupIds: readonly string[], chats: readonly AvailabilityChatTarget[]) {
  const selected = new Set(groupIds);
  return new Set(chats.flatMap((chat) => (chat.groupId && selected.has(chat.groupId) ? (chat.chatIds ?? []) : [])));
}

/** Bulk Remove of a whole chat also removes the branch ids it covers, as unticking it does in the single editor. */
export function withWholeChatBranches(targets: readonly string[], chats: readonly AvailabilityChatTarget[]) {
  const groupIds = targets.flatMap((target) => {
    const [kind, id] = splitBulkAvailabilityTarget(target);
    return kind === "group" ? [id] : [];
  });
  return [...new Set([...targets, ...[...wholeChatBranchIds(groupIds, chats)].map((id) => `chat:${id}`)])];
}

/** One entry per place. Given the whole chats, a selected chat's branch ids get no entries of their own. */
export function availabilityEntries(
  scope: LtmScope,
  targets: ReadonlyArray<PickerTarget>,
  fallbackLabels: Partial<Record<PickerTarget["kind"], string>> = {},
  wholeChats: readonly AvailabilityChatTarget[] = [],
) {
  const find = (kind: PickerTarget["kind"], id: string) =>
    targets.find((target) => target.kind === kind && target.id === id)?.label ??
    fallbackLabels[kind] ??
    humanizeLabel(kind);
  const groupIds = getLtmScopeGroupIds(scope);
  const coveredChatIds = wholeChatBranchIds(groupIds, wholeChats);
  const chatIds = getLtmScopeChatIds(scope).filter((id) => !coveredChatIds.has(id));
  const personaIds = getLtmScopePersonaIds(scope);
  return [
    ...chatIds.map((id) => ({ kind: "chat" as const, id, label: find("chat", id) })),
    ...groupIds.map((id) => ({ kind: "group" as const, id, label: find("group", id) })),
    ...(scope.characterIds ?? []).map((id) => ({ kind: "character" as const, id, label: find("character", id) })),
    ...personaIds.map((id) => ({ kind: "persona" as const, id, label: find("persona", id) })),
  ];
}
