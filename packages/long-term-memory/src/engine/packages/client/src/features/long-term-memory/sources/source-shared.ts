import type { LtmMode, LtmScope } from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import type { SourceTab } from "../types";
import { labelKeys, localizedLabel } from "../display-labels";
import { type LtmTranslationFunction } from "../localization";
import {
  normalizeLtmScope,
  withMergedLtmScopeLinks,
} from "../../../../../shared/src/features/agents/long-term-memory/scope.js";

export type Source = SourceTab;

export type SourceOperation = "copy" | "move" | "archive" | "delete";

export type ScopeTargetKind = "all" | "chat" | "character" | "persona";
export type ScopeTarget = {
  id: string;
  label: string;
  comment?: string;
  destinationLabel?: string;
  kind: ScopeTargetKind;
  sourceScope?: LtmScope;
  destinationScope?: LtmScope;
  searchText?: string;
  pinned?: "current" | "all";
};

export function targetDisplayLabel(target: ScopeTarget, destination: boolean) {
  return destination ? (target.destinationLabel ?? target.label) : target.label;
}

export function mergedDestinationScope(targets: ScopeTarget[]) {
  const primary = targets[0]?.destinationScope;
  if (!primary) return undefined;
  return targets.slice(1).reduce((scope, target) => {
    return target.destinationScope ? withMergedLtmScopeLinks(scope, target.destinationScope) : scope;
  }, normalizeLtmScope(primary));
}

const MAX_DESTINATION_SCOPE_IDS = 100;

function destinationScopeIds(scope: LtmScope | undefined) {
  const normalized = normalizeLtmScope(scope);
  return {
    chatIds: normalized.chatIds ?? [],
    groupIds: normalized.groupIds ?? [],
    characterIds: normalized.characterIds ?? [],
    personaIds: normalized.personaIds ?? [],
  };
}

export function hasDestinationScopeCapacity(scope: LtmScope | undefined) {
  return Object.values(destinationScopeIds(scope)).every((ids) => !ids || ids.length <= MAX_DESTINATION_SCOPE_IDS);
}

export function targetFitsDestinationScope(scope: LtmScope | undefined, target: ScopeTarget) {
  const current = destinationScopeIds(scope);
  const candidate = destinationScopeIds(target.destinationScope);
  return (Object.keys(candidate) as Array<keyof typeof candidate>).every((key) => {
    const additionalIds = candidate[key].filter((id) => !current[key].includes(id));
    return additionalIds.length <= MAX_DESTINATION_SCOPE_IDS - current[key].length;
  });
}

export const ALL_LTM_MODES: LtmMode[] = ["conversation", "roleplay", "game"];

export const sourceCheckboxClass = "h-4 w-4 shrink-0 accent-[var(--primary)] [--primary:var(--marinara-editor-accent)]";

export function sourceModeLabel(mode: LtmMode, localizeUi: LtmTranslationFunction) {
  return localizeUi("ui.longTermMemory.sourcesworkspace.importsAsMode", {
    mode: localizedLabel(mode, localizeUi, labelKeys.mode),
  });
}
