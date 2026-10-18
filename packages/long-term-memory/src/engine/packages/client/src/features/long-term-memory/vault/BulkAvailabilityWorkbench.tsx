import { ChevronRight } from "lucide-react";
import type { LtmMode, LtmNote } from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import {
  getLtmScopeChatIds,
  getLtmScopeGroupIds,
  getLtmScopePersonaIds,
} from "../../../../../shared/src/features/agents/long-term-memory/scope.js";
import { uniqueStrings } from "../../../../../shared/src/features/agents/long-term-memory/utils.js";
import { Button, StatusSurface } from "../shared-controls";
import { type LtmTranslationFunction } from "../localization";
import { AvailabilityTabRail, type AvailabilityPlaceKind } from "../AvailabilityTabRail";
import type { PickerTarget } from "./TargetPicker";
import { availabilityEntries, modes, splitBulkAvailabilityTarget, withWholeChatBranches } from "./vault-shared";
import type { AvailabilityTargets } from "./vault-shared";
import { Pill } from "./Pill";

function bulkAvailabilityTargetMatchesEntry(target: string, entry: Pick<PickerTarget, "kind" | "id">) {
  const [kind, id] = splitBulkAvailabilityTarget(target);
  return id === entry.id && kind === entry.kind;
}

export function BulkAvailabilityWorkbench({
  notes,
  action,
  selectedTargets,
  modes: selectedModes,
  availabilityTargets,
  localizeUi,
  modeLabel,
  onActionChange,
  onModesChange,
  onTargetsChange,
  onApply,
  onCancel,
}: {
  notes: LtmNote[];
  action: "add" | "remove";
  selectedTargets: string[];
  modes: LtmMode[];
  availabilityTargets: AvailabilityTargets;
  localizeUi: LtmTranslationFunction;
  modeLabel: (mode: string) => string;
  onActionChange: (action: "add" | "remove") => void;
  onModesChange: (modes: LtmMode[]) => void;
  onTargetsChange: (targets: string[]) => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  const selectedIds = new Set(
    selectedTargets.map((target) => {
      const [kind, id] = splitBulkAvailabilityTarget(target);
      return `${kind === "group" ? "chat" : kind}:${id}`;
    }),
  );
  const hasChatRestriction = selectedTargets.some((target) => {
    const [kind] = splitBulkAvailabilityTarget(target);
    return kind === "group" || kind === "chat";
  });
  if (!hasChatRestriction) selectedIds.add("chat:all");
  const unavailableLabels = {
    chat: localizeUi("ui.longTermMemory.memoryvault.unavailableChat"),
    group: localizeUi("ui.longTermMemory.memoryvault.unavailableChat"),
    character: localizeUi("ui.longTermMemory.memoryvault.unavailableCharacter"),
    persona: localizeUi("ui.longTermMemory.memoryvault.unavailablePersona"),
  };
  const noteIds = (read: (note: LtmNote) => string[]) => uniqueStrings(notes.flatMap(read));
  const listed = (targets: ReadonlyArray<{ id: string }>, id: string) => targets.some((target) => target.id === id);
  // Branches are not places to add any more, but branch assignments the selected memories already have stay
  // removable: they are listed under Chats as plain `chat:<branchId>` selections. So do places that no longer
  // exist, with the single editor's fallback labels.
  const branchAssignments = availabilityTargets.branches.filter((branch) =>
    notes.some((note) => getLtmScopeChatIds(note.scope).includes(branch.id)),
  );
  const missingGroups = noteIds((note) => getLtmScopeGroupIds(note.scope))
    .filter((id) => !availabilityTargets.chats.some((target) => target.groupId === id))
    .map((id) => ({ id, label: unavailableLabels.group, groupId: id, chatIds: [] }));
  const missingChats = noteIds((note) => getLtmScopeChatIds(note.scope))
    .filter((id) => !listed(availabilityTargets.chats, id) && !listed(availabilityTargets.branches, id))
    .map((id) => ({ id, label: unavailableLabels.chat }));
  const missingCharacters = noteIds((note) => note.scope.characterIds ?? [])
    .filter((id) => !listed(availabilityTargets.characters, id))
    .map((id) => ({ id, label: unavailableLabels.character }));
  const missingPersonas = noteIds((note) => getLtmScopePersonaIds(note.scope))
    .filter((id) => !listed(availabilityTargets.personas, id))
    .map((id) => ({ id, label: unavailableLabels.persona }));
  const removeOnlyTargets = new Set([
    ...availabilityTargets.branches.map((branch) => `chat:${branch.id}`),
    ...missingGroups.map((target) => `group:${target.id}`),
    ...missingChats.map((target) => `chat:${target.id}`),
    ...missingCharacters.map((target) => `character:${target.id}`),
    ...missingPersonas.map((target) => `persona:${target.id}`),
  ]);
  const removing = action === "remove";
  const wholeChats = removing ? [...availabilityTargets.chats, ...missingGroups] : availabilityTargets.chats;
  const chats = removing ? [...wholeChats, ...branchAssignments, ...missingChats] : availabilityTargets.chats;
  const characters = removing
    ? [...availabilityTargets.characters, ...missingCharacters]
    : availabilityTargets.characters;
  const personas = removing ? [...availabilityTargets.personas, ...missingPersonas] : availabilityTargets.personas;
  const changeAction = (nextAction: "add" | "remove") => {
    if (nextAction === "add" && selectedTargets.some((target) => removeOnlyTargets.has(target)))
      onTargetsChange(selectedTargets.filter((target) => !removeOnlyTargets.has(target)));
    onActionChange(nextAction);
  };
  const selectTarget = (nextKind: AvailabilityPlaceKind, nextId: string) => {
    if (nextId === "all") {
      const next = new Set(selectedTargets);
      for (const selected of next) {
        const [kind] = splitBulkAvailabilityTarget(selected);
        if (nextKind === "chat" && (kind === "group" || kind === "chat")) next.delete(selected);
      }
      onTargetsChange([...next]);
      return;
    }
    const chatTarget = nextKind === "chat" ? wholeChats.find((candidate) => candidate.id === nextId) : undefined;
    const selection =
      nextKind === "chat" && chatTarget?.groupId ? `group:${chatTarget.groupId}` : `${nextKind}:${nextId}`;
    const next = new Set(selectedTargets);
    if (next.has(selection)) next.delete(selection);
    else next.add(selection);
    onTargetsChange([...next]);
  };
  const selectedPlaceLabels = selectedTargets.map((target) => {
    const [kind, id] = splitBulkAvailabilityTarget(target);
    const candidate =
      kind === "character"
        ? characters.find((item) => item.id === id)
        : kind === "persona"
          ? personas.find((item) => item.id === id)
          : chats.find((item) => item.id === id);
    return { target, label: candidate?.label ?? id };
  });
  const removedTargets = removing ? withWholeChatBranches(selectedTargets, availabilityTargets.chats) : selectedTargets;
  const outcomes = notes.map((note) => {
    const places = availabilityEntries(note.scope, [], unavailableLabels);
    const hasPlace = removedTargets.some((target) =>
      places.some((entry) => bulkAvailabilityTargetMatchesEntry(target, entry)),
    );
    const addsPlace = selectedTargets.some(
      (target) => !places.some((entry) => bulkAvailabilityTargetMatchesEntry(target, entry)),
    );
    const remainingPlaces = places.filter(
      (entry) => !removedTargets.some((target) => bulkAvailabilityTargetMatchesEntry(target, entry)),
    );
    const matchingModes = selectedModes.filter((mode) => note.modes.includes(mode));
    const changes =
      action === "add"
        ? Boolean(addsPlace || selectedModes.some((mode) => !note.modes.includes(mode)))
        : Boolean(hasPlace || matchingModes.length);
    const removesLastPlace = action === "remove" && hasPlace && remainingPlaces.length === 0;
    const removesLastMode = action === "remove" && matchingModes.length === note.modes.length;
    return {
      note,
      state: removesLastPlace || removesLastMode ? "invalid" : changes ? "ready" : "unchanged",
    };
  });
  const ready = outcomes.some((outcome) => outcome.state === "ready");
  return (
    <section className="mari-editor-panel min-w-0 space-y-4 p-4" data-ltm-bulk-availability-workbench>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div>
          <h2 className="text-base font-semibold">
            {localizeUi("ui.longTermMemory.memoryvault.bulkMemoryAvailability")}
          </h2>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            {localizeUi("ui.longTermMemory.memoryvault.bulkAvailabilitySelected", {
              count: notes.length,
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onCancel}>{localizeUi("ui.longTermMemory.memoryvault.cancel")}</Button>
          <Button primary disabled={!ready} onClick={onApply}>
            {localizeUi("ui.longTermMemory.memoryvault.apply")}
          </Button>
        </div>
      </header>
      <fieldset className="space-y-2 border-b border-[var(--border)] pb-4">
        <legend className="text-sm font-semibold">
          {localizeUi("ui.longTermMemory.memoryvault.availabilityChange")}
        </legend>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={localizeUi("ui.longTermMemory.memoryvault.availabilityChange")}
          data-ltm-bulk-availability-action
        >
          <Button
            aria-pressed={action === "add"}
            onClick={() => changeAction("add")}
            className={action === "add" ? "bg-[var(--accent)]" : ""}
          >
            {localizeUi("ui.longTermMemory.memoryvault.addAvailability")}
          </Button>
          <Button
            aria-pressed={action === "remove"}
            onClick={() => changeAction("remove")}
            className={action === "remove" ? "bg-[var(--accent)]" : ""}
          >
            {localizeUi("ui.longTermMemory.memoryvault.removeAvailability")}
          </Button>
        </div>
      </fieldset>
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
                onChange={() =>
                  onModesChange(
                    selectedModes.includes(mode)
                      ? selectedModes.filter((value) => value !== mode)
                      : [...selectedModes, mode],
                  )
                }
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
            {localizeUi("ui.longTermMemory.memoryvault.bulkAvailabilityHelp")}
          </p>
        </div>
        {selectedPlaceLabels.length ? (
          <div className="flex flex-wrap gap-1.5" data-ltm-availability-pills>
            {selectedPlaceLabels.map(({ target, label }) => (
              <Pill
                key={target}
                label={label}
                onRemove={() => onTargetsChange(selectedTargets.filter((item) => item !== target))}
              >
                {label}
              </Pill>
            ))}
          </div>
        ) : (
          <StatusSurface>
            {localizeUi(
              action === "add"
                ? "ui.longTermMemory.memoryvault.bulkImplicitAllPlaces"
                : "ui.longTermMemory.memoryvault.bulkNoPlacesSelected",
            )}
          </StatusSurface>
        )}
        <details data-ltm-availability-picker className="group">
          <summary
            data-ltm-tab-focus
            className="mari-editor-action inline-flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-[var(--marinara-editor-text)] [&::-webkit-details-marker]:hidden"
          >
            <span className="min-w-0 flex-1">
              {localizeUi(
                action === "add"
                  ? "ui.longTermMemory.memoryvault.bulkAddMemoriesTo"
                  : "ui.longTermMemory.memoryvault.bulkRemoveMemoriesFrom",
              )}
            </span>
            <ChevronRight
              aria-hidden="true"
              size="0.875rem"
              data-ltm-availability-chevron
              className="shrink-0 transition-transform"
            />
          </summary>
          <div className="border-t border-[var(--border)] p-3">
            <AvailabilityTabRail
              characters={characters}
              personas={personas}
              chats={chats}
              selectedIds={selectedIds}
              tablistLabel={localizeUi("ui.longTermMemory.memoryvault.bulkMemoryAvailability")}
              onToggle={selectTarget}
            />
          </div>
        </details>
      </section>
      <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {outcomes.map(({ note, state }) => (
          <div key={note.id} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm">
            <span className="min-w-0 truncate">{note.title}</span>
            <span
              className={
                state === "invalid" ? "text-xs text-[var(--destructive)]" : "text-xs text-[var(--muted-foreground)]"
              }
            >
              {state === "ready"
                ? localizeUi("ui.longTermMemory.memoryvault.ready")
                : state === "unchanged"
                  ? localizeUi("ui.longTermMemory.memoryvault.unchanged")
                  : localizeUi("ui.longTermMemory.memoryvault.wouldRemoveFinalAvailability")}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
