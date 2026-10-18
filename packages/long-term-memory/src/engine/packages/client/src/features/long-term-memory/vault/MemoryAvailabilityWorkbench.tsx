import { useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import type { LtmMode, LtmNote, LtmScope } from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import {
  getLtmScopeChatIds,
  getLtmScopeGroupIds,
  getLtmScopePersonaIds,
  normalizeLtmScope,
} from "../../../../../shared/src/features/agents/long-term-memory/scope.js";
import { errorMessage } from "../api";
import { Button, StatusSurface } from "../shared-controls";
import { type LtmTranslationFunction } from "../localization";
import { AvailabilityTabRail, type AvailabilityPlaceKind } from "../AvailabilityTabRail";
import type { PickerTarget } from "./TargetPicker";
import { availabilityEntries, hasExplicitScope, modes, sameModes, sameScope, wholeChatBranchIds } from "./vault-shared";
import type { AvailabilityTargets } from "./vault-shared";
import { Pill } from "./Pill";

export function MemoryAvailabilityWorkbench({
  note,
  originalNote,
  isNew,
  targets,
  availabilityTargets,
  localizeUi,
  modeLabel,
  onSave,
  onCancel,
}: {
  note: LtmNote;
  originalNote: LtmNote | null;
  isNew: boolean;
  targets: PickerTarget[];
  availabilityTargets: AvailabilityTargets;
  localizeUi: LtmTranslationFunction;
  modeLabel: (mode: string) => string;
  onSave: (scope: LtmScope, modes: LtmMode[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [scope, setScope] = useState<LtmScope>(() => structuredClone(note.scope));
  const [selectedModes, setSelectedModes] = useState<LtmMode[]>(() => [...note.modes]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectedCharacterIds = scope.characterIds ?? [];
  const selectedPersonaIds = getLtmScopePersonaIds(scope);
  const selectedGroupIds = getLtmScopeGroupIds(scope);
  const selectedChatIds = getLtmScopeChatIds(scope);
  const unavailableLabels = {
    chat: localizeUi("ui.longTermMemory.memoryvault.unavailableChat"),
    group: localizeUi("ui.longTermMemory.memoryvault.unavailableChat"),
    character: localizeUi("ui.longTermMemory.memoryvault.unavailableCharacter"),
    persona: localizeUi("ui.longTermMemory.memoryvault.unavailablePersona"),
  };
  const visibleAvailabilityTargets: AvailabilityTargets = {
    characters: [
      ...availabilityTargets.characters,
      ...selectedCharacterIds
        .filter((id) => !availabilityTargets.characters.some((target) => target.id === id))
        .map((id) => ({ id, label: unavailableLabels.character })),
    ],
    personas: [
      ...availabilityTargets.personas,
      ...selectedPersonaIds
        .filter((id) => !availabilityTargets.personas.some((target) => target.id === id))
        .map((id) => ({ id, label: unavailableLabels.persona })),
    ],
    chats: [
      ...availabilityTargets.chats,
      ...selectedGroupIds
        .filter((id) => !availabilityTargets.chats.some((target) => target.groupId === id))
        .map((id) => ({ id, label: unavailableLabels.chat, groupId: id, chatIds: [] })),
      ...selectedChatIds
        .filter(
          (id) =>
            !availabilityTargets.chats.some((target) => target.id === id) &&
            !availabilityTargets.branches.some((target) => target.id === id),
        )
        .map((id) => ({ id, label: unavailableLabels.chat })),
    ],
    branches: [...availabilityTargets.branches],
  };
  const entries = availabilityEntries(scope, targets, unavailableLabels, availabilityTargets.chats);
  const baseline = originalNote ?? note;
  const scopeChanged = !sameScope(scope, baseline.scope);
  const modesChanged = !sameModes(selectedModes, baseline.modes);
  const legacyGlobalModeOnly = Boolean(
    !isNew &&
    originalNote &&
    !hasExplicitScope(originalNote.scope) &&
    !scopeChanged &&
    !hasExplicitScope(scope) &&
    modesChanged,
  );
  const selectedIds = new Set([
    ...getLtmScopePersonaIds(scope).map((id) => `persona:${id}`),
    ...(scope.characterIds ?? []).map((id) => `character:${id}`),
    ...getLtmScopeGroupIds(scope).map((id) => `chat:${id}`),
    ...selectedChatIds.map((id) => `chat:${id}`),
  ]);
  if (!selectedGroupIds.length && !selectedChatIds.length) selectedIds.add("chat:all");
  const remove = (kind: PickerTarget["kind"], id: string) => {
    if (entries.length <= 1) {
      setError(localizeUi("ui.longTermMemory.memoryvault.lastPlaceRequired"));
      return;
    }
    if (kind === "chat" || kind === "group") {
      const coveredChatIds = kind === "group" ? wholeChatBranchIds([id], availabilityTargets.chats) : new Set<string>();
      const groupIds = getLtmScopeGroupIds(scope).filter((value) => value !== id);
      const chatIds = getLtmScopeChatIds(scope).filter((value) => value !== id && !coveredChatIds.has(value));
      setScope(normalizeLtmScope({ ...scope, groupIds, chatIds }));
    } else if (kind === "character") {
      const characterIds = (scope.characterIds ?? []).filter((value) => value !== id);
      setScope(normalizeLtmScope({ ...scope, characterIds }));
    } else {
      setScope(
        normalizeLtmScope({
          ...scope,
          personaIds: getLtmScopePersonaIds(scope).filter((value) => value !== id),
        }),
      );
    }
    setError("");
  };
  // An existing branch assignment has no row here. It stays a chip until that chip is removed or All chats is chosen,
  // unless its whole chat is selected: then it is part of that chat and is removed with it.
  const toggle = (kind: AvailabilityPlaceKind, id: string) => {
    const next = normalizeLtmScope(scope);
    if (kind === "character") {
      const values = new Set(next.characterIds ?? []);
      if (values.has(id)) values.delete(id);
      else values.add(id);
      next.characterIds = [...values];
    } else if (kind === "persona") {
      const values = new Set(getLtmScopePersonaIds(next));
      if (values.has(id)) values.delete(id);
      else values.add(id);
      next.personaIds = [...values];
    } else if (id === "all") {
      next.chatIds = [];
      next.groupIds = [];
    } else {
      const target = visibleAvailabilityTargets.chats.find((item) => item.id === id);
      if (target?.groupId) {
        const groupIds = new Set(getLtmScopeGroupIds(next));
        if (groupIds.has(target.groupId)) {
          groupIds.delete(target.groupId);
          next.chatIds = getLtmScopeChatIds(next).filter((chatId) => !target.chatIds?.includes(chatId));
        } else groupIds.add(target.groupId);
        next.groupIds = [...groupIds];
      } else {
        const chatIds = new Set(getLtmScopeChatIds(next));
        if (chatIds.has(id)) chatIds.delete(id);
        else chatIds.add(id);
        next.chatIds = [...chatIds];
      }
    }
    setScope(normalizeLtmScope(next));
    setError("");
  };
  const toggleMode = (mode: LtmMode) => {
    if (selectedModes.includes(mode)) {
      if (selectedModes.length === 1) {
        setError(localizeUi("ui.longTermMemory.memoryvault.lastModeRequired"));
        return;
      }
      setSelectedModes(selectedModes.filter((value) => value !== mode));
    } else setSelectedModes([...selectedModes, mode]);
    setError("");
  };
  const save = async () => {
    if (!entries.length && !legacyGlobalModeOnly) {
      setError(localizeUi("ui.longTermMemory.memoryvault.availabilityPlaceRequired"));
      return;
    }
    if (!selectedModes.length) {
      setError(localizeUi("ui.longTermMemory.memoryvault.availabilityModeRequired"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave(scope, selectedModes);
    } catch (cause) {
      setError(errorMessage(cause, localizeUi("ui.longTermMemory.memoryvault.couldNotSaveAvailability")));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mari-editor-panel min-w-0 space-y-4 p-4" data-ltm-availability-workbench>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div>
          <h2 className="text-base font-semibold">{localizeUi("ui.longTermMemory.memoryvault.memoryAvailability")}</h2>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">{note.title}</p>
        </div>
        <div className="flex gap-2">
          <Button disabled={busy} onClick={onCancel}>
            {localizeUi("ui.longTermMemory.memoryvault.cancel")}
          </Button>
          <Button primary disabled={busy} onClick={() => void save()}>
            <Check aria-hidden="true" size="1rem" className="shrink-0" />
            {busy
              ? localizeUi("ui.longTermMemory.memoryvault.saving")
              : localizeUi("ui.longTermMemory.memoryvault.saveAvailability")}
          </Button>
        </div>
      </header>
      {error ? <StatusSurface tone="danger">{error}</StatusSurface> : null}
      <fieldset className="space-y-2 border-b border-[var(--border)] pb-4">
        <legend className="text-sm font-semibold">{localizeUi("ui.longTermMemory.memoryvault.chatModes")}</legend>
        <p className="text-xs text-[var(--muted-foreground)]">
          {localizeUi("ui.longTermMemory.memoryvault.modesEligibilityHelp")}
        </p>
        <div className="flex flex-wrap gap-3">
          {modes.map((mode) => (
            <label key={mode} className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={selectedModes.includes(mode)}
                onChange={() => toggleMode(mode)}
              />
              {modeLabel(mode)}
            </label>
          ))}
        </div>
      </fieldset>
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">{localizeUi("ui.longTermMemory.memoryvault.availableIn")}</h3>
          <p className="text-xs text-[var(--muted-foreground)]">
            {isNew
              ? localizeUi("ui.longTermMemory.memoryvault.newMemoryAvailabilityHelp")
              : localizeUi("ui.longTermMemory.memoryvault.availabilityScopeHelp")}
          </p>
        </div>
        {!entries.length ? (
          <StatusSurface>
            {isNew
              ? localizeUi("ui.longTermMemory.memoryvault.availabilityPlaceRequired")
              : localizeUi("ui.longTermMemory.memoryvault.availableEverywhere")}
          </StatusSurface>
        ) : (
          <div className="flex flex-wrap gap-1.5" data-ltm-availability-pills>
            {entries.map((entry) => (
              <Pill key={`${entry.kind}:${entry.id}`} label={entry.label} onRemove={() => remove(entry.kind, entry.id)}>
                {entry.label}
              </Pill>
            ))}
          </div>
        )}
        <details data-ltm-availability-picker className="group">
          <summary
            data-ltm-tab-focus
            className="mari-editor-action inline-flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-[var(--marinara-editor-text)] [&::-webkit-details-marker]:hidden"
          >
            <span className="min-w-0 flex-1">{localizeUi("ui.longTermMemory.memoryvault.addMemoryTo")}</span>
            <ChevronRight
              aria-hidden="true"
              size="0.875rem"
              data-ltm-availability-chevron
              className="shrink-0 transition-transform"
            />
          </summary>
          <div className="border-t border-[var(--border)] p-3">
            <AvailabilityTabRail
              characters={visibleAvailabilityTargets.characters}
              personas={visibleAvailabilityTargets.personas}
              chats={visibleAvailabilityTargets.chats}
              selectedIds={selectedIds}
              tablistLabel={localizeUi("ui.longTermMemory.memoryvault.memoryAvailability")}
              onToggle={toggle}
            />
          </div>
        </details>
      </section>
    </section>
  );
}
