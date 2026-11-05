import { useId } from "react";
import { Check, ChevronRight } from "lucide-react";
import type { LtmMode, LtmNote, LtmStatus } from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import {
  getLtmScopeChatIds,
  getLtmScopeGroupIds,
  getLtmScopePersonaIds,
} from "../../../../../shared/src/features/agents/long-term-memory/scope.js";
import { uniqueStrings } from "../../../../../shared/src/features/agents/long-term-memory/utils.js";
import { Button, inputClass, StatusSurface } from "../shared-controls";
import { selectLtmPluralForm, type LtmTranslationFunction } from "../localization";
import { AvailabilityTabRail, type AvailabilityPlaceKind } from "../AvailabilityTabRail";
import type { PickerTarget } from "./TargetPicker";
import { availabilityEntries, modes, splitBulkAvailabilityTarget, withWholeChatBranches } from "./vault-shared";
import type { AvailabilityTargets } from "./vault-shared";
import { Pill } from "./Pill";

function bulkAvailabilityTargetMatchesEntry(target: string, entry: Pick<PickerTarget, "kind" | "id">) {
  const [kind, id] = splitBulkAvailabilityTarget(target);
  return id === entry.id && kind === entry.kind;
}

// Backs the Vault's "Edit selected…" sheet: status, retrieval modes and availability for the checked memories,
// previewed per memory before one combined batch request.
export function BulkAvailabilityWorkbench({
  notes,
  action,
  selectedTargets,
  modes: selectedModes,
  status,
  statuses,
  availabilityTargets,
  locale,
  pending,
  localizeUi,
  modeLabel,
  statusLabel,
  onActionChange,
  onStatusChange,
  onModesChange,
  onTargetsChange,
  onApply,
  onCancel,
}: {
  notes: LtmNote[];
  action: "add" | "remove";
  selectedTargets: string[];
  modes: LtmMode[];
  status: LtmStatus | "";
  statuses: readonly LtmStatus[];
  availabilityTargets: AvailabilityTargets;
  locale: string;
  // Another batch is still running: Apply stays focusable but does nothing.
  pending: boolean;
  localizeUi: LtmTranslationFunction;
  modeLabel: (mode: string) => string;
  statusLabel: (status: LtmStatus) => string;
  onActionChange: (action: "add" | "remove") => void;
  onStatusChange: (status: LtmStatus | "") => void;
  onModesChange: (modes: LtmMode[]) => void;
  onTargetsChange: (targets: string[]) => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  const reasonId = useId();
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
  // Remove lists each kind's remove-only places first, so within a kind tab the rail's "Show more" limit never hides
  // them behind other places. The All tab keeps the chats, characters, personas order.
  const wholeChats = removing ? [...missingGroups, ...availabilityTargets.chats] : availabilityTargets.chats;
  const chats = removing ? [...branchAssignments, ...missingChats, ...wholeChats] : availabilityTargets.chats;
  const characters = removing
    ? [...missingCharacters, ...availabilityTargets.characters]
    : availabilityTargets.characters;
  const personas = removing ? [...missingPersonas, ...availabilityTargets.personas] : availabilityTargets.personas;
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
    const statusChanges = Boolean(status) && note.status !== status;
    const changes =
      statusChanges ||
      (action === "add"
        ? Boolean(addsPlace || selectedModes.some((mode) => !note.modes.includes(mode)))
        : Boolean(hasPlace || matchingModes.length));
    // The server skips the whole note, status and modes included, when removing places would leave it available
    // everywhere, so a note that is already global is blocked too, not ready.
    const removesLastPlace =
      action === "remove" && removedTargets.length > 0 && remainingPlaces.length === 0 && changes;
    const removesLastMode = action === "remove" && matchingModes.length === note.modes.length;
    return {
      note,
      state: removesLastPlace || removesLastMode ? "invalid" : changes ? "ready" : "unchanged",
      // A global note holds no place to lose: name that cause, not a last place it never had.
      alreadyEverywhere: removesLastPlace && !removesLastMode && places.length === 0,
    };
  });
  const countOf = (state: "ready" | "unchanged" | "invalid") =>
    outcomes.filter((outcome) => outcome.state === state).length;
  const readyCount = countOf("ready");
  const unchangedCount = countOf("unchanged");
  const blockedCount = countOf("invalid");
  const canApply = readyCount > 0 && !pending;
  // Apply keeps focus while it is off (UI.md: aria-disabled plus a guard) and says why. `batch()` applies the ready
  // memories and skips the rest, which stay selected.
  const applyReasonKey = pending
    ? "ui.longTermMemory.memoryvault.applyReasonBusy"
    : readyCount > 0
      ? ""
      : !status && !selectedModes.length && !selectedTargets.length
        ? "ui.longTermMemory.memoryvault.applyReasonNothingChosen"
        : "ui.longTermMemory.memoryvault.applyReasonNothingToChange";
  const applyIfReady = () => {
    if (canApply) onApply();
  };
  const renderApply = (placement: string) => {
    const id = `${reasonId}-${placement}`;
    return (
      <>
        {applyReasonKey ? (
          <p
            id={id}
            className={`text-xs text-[var(--muted-foreground)] ${placement === "top" ? "order-first basis-full text-right" : "max-w-xs"}`}
          >
            {localizeUi(applyReasonKey)}
          </p>
        ) : null}
        <Button
          primary
          aria-disabled={canApply ? undefined : true}
          aria-describedby={applyReasonKey ? id : undefined}
          className={canApply ? "" : "opacity-50"}
          onClick={applyIfReady}
          data-ltm-bulk-apply={placement}
        >
          {localizeUi("ui.longTermMemory.memoryvault.apply")}
        </Button>
      </>
    );
  };
  const pressedClass = "border-[var(--marinara-editor-border-strong)] bg-[var(--accent)] font-semibold";
  const pressedMark = <Check aria-hidden="true" size="0.875rem" className="mr-1.5 inline-block shrink-0" />;
  return (
    <section className="mari-editor-panel min-w-0 space-y-4 p-4" data-ltm-bulk-availability-workbench>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div>
          <h2 className="text-base font-semibold">{localizeUi("ui.longTermMemory.memoryvault.editSelectedTitle")}</h2>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            {localizeUi(
              selectLtmPluralForm(locale, notes.length) === "one"
                ? "ui.longTermMemory.memoryvault.bulkAvailabilitySelectedOne"
                : "ui.longTermMemory.memoryvault.bulkAvailabilitySelectedOther",
              { count: notes.length },
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button onClick={onCancel}>{localizeUi("ui.longTermMemory.memoryvault.cancel")}</Button>
          {renderApply("top")}
        </div>
      </header>
      <label className="block space-y-1 border-b border-[var(--border)] pb-4 text-sm font-semibold">
        <span className="block">{localizeUi("ui.longTermMemory.memoryvault.status")}</span>
        <select
          className={`${inputClass} font-normal`}
          value={status}
          onChange={(event) => onStatusChange(event.target.value as LtmStatus | "")}
          data-ltm-bulk-edit-status
        >
          <option value="">{localizeUi("ui.longTermMemory.memoryvault.statusNoChange")}</option>
          {statuses.map((value) => (
            <option key={value} value={value}>
              {statusLabel(value)}
            </option>
          ))}
        </select>
      </label>
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
            className={action === "add" ? pressedClass : ""}
          >
            {action === "add" ? pressedMark : null}
            {localizeUi("ui.longTermMemory.memoryvault.addAvailability")}
          </Button>
          <Button
            aria-pressed={action === "remove"}
            onClick={() => changeAction("remove")}
            className={action === "remove" ? pressedClass : ""}
          >
            {action === "remove" ? pressedMark : null}
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
      <section className="space-y-2" aria-labelledby={`${reasonId}-outcomes`} data-ltm-bulk-outcomes>
        <h3 id={`${reasonId}-outcomes`} className="text-sm font-semibold">
          {localizeUi("ui.longTermMemory.memoryvault.bulkOutcomesTitle")}
        </h3>
        <p role="status" className="text-sm" data-ltm-bulk-outcome-summary>
          {localizeUi("ui.longTermMemory.memoryvault.bulkOutcomeSummary", {
            ready: readyCount,
            unchanged: unchangedCount,
            blocked: blockedCount,
          })}
        </p>
        {readyCount > 0 && unchangedCount + blockedCount > 0 ? (
          <p className="text-xs text-[var(--muted-foreground)]">
            {localizeUi("ui.longTermMemory.memoryvault.bulkOutcomeSkipped")}
          </p>
        ) : null}
        <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {outcomes.map(({ note, state, alreadyEverywhere }) => (
            <div key={note.id} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 truncate" title={note.title}>
                {note.title}
              </span>
              <span
                className={
                  state === "invalid" ? "text-xs text-[var(--destructive)]" : "text-xs text-[var(--muted-foreground)]"
                }
              >
                {state === "ready"
                  ? localizeUi("ui.longTermMemory.memoryvault.ready")
                  : state === "unchanged"
                    ? localizeUi("ui.longTermMemory.memoryvault.unchanged")
                    : localizeUi(
                        alreadyEverywhere
                          ? "ui.longTermMemory.memoryvault.alreadyAvailableEverywhere"
                          : "ui.longTermMemory.memoryvault.wouldRemoveFinalAvailability",
                      )}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">{renderApply("bottom")}</div>
      </section>
    </section>
  );
}
