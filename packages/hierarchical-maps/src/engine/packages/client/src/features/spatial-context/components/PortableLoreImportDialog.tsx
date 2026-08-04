import { AlertTriangle, BookOpen, Copy, Link2, Loader2, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type {
  PortableLoreBundle,
  PortableLoreImportPlan,
  PortableLoreImportStrategy,
} from "../portable-lore";
import { portableLoreImportOutcome } from "../portable-lore";
import { useModalKeyboardNavigation } from "./use-modal-keyboard-navigation";

interface PortableLoreImportDialogProps {
  bundle: PortableLoreBundle;
  plan: PortableLoreImportPlan;
  busy: boolean;
  onCancel: () => void;
  onImport: (
    strategy: PortableLoreImportStrategy,
    selections: ReadonlyMap<string, string | null>,
  ) => void;
}

export function PortableLoreImportDialog({
  bundle,
  plan,
  busy,
  onCancel,
  onImport,
}: PortableLoreImportDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useModalKeyboardNavigation({
    dialogRef,
    initialFocusRef: cancelRef,
    open: true,
    disabled: busy,
    onEscape: onCancel,
  });
  const ambiguousEntries = useMemo(
    () => plan.entries.filter((entry) => entry.candidates.length > 1),
    [plan.entries],
  );
  const [selections, setSelections] = useState<Record<string, string>>(() =>
    Object.fromEntries(ambiguousEntries.map((entry) => [entry.entryKey, ""])),
  );
  const [mappingOpen, setMappingOpen] = useState(false);
  const reuseReady = ambiguousEntries.every(
    (entry) => selections[entry.entryKey],
  );
  const selectionMap = () =>
    new Map(
      ambiguousEntries
        .filter((entry) => Boolean(selections[entry.entryKey]))
        .map((entry): [string, string | null] => [
          entry.entryKey,
          selections[entry.entryKey] === "__new__"
            ? null
            : selections[entry.entryKey]!,
        ]),
    );
  const separateOutcome = portableLoreImportOutcome(
    plan,
    "separate",
  );
  const reuseOutcome = portableLoreImportOutcome(
    plan,
    "reuse",
    selectionMap(),
  );

  return (
    <div
      ref={dialogRef}
      data-chat-floating-panel
      role="dialog"
      aria-modal="true"
      aria-label="Restore portable map lore"
      className="fixed inset-0 z-[110] flex items-center justify-center bg-[var(--background)]/90 p-3 sm:p-4"
    >
      <div className="flex max-h-[min(90vh,52rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] shadow-2xl">
        <div className="flex min-h-12 items-center gap-3 border-b border-[var(--marinara-chat-chrome-panel-divider)] px-4 py-3">
          <BookOpen
            size="0.9375rem"
            className="text-[var(--marinara-chat-chrome-accent)]"
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
              Restore portable map lore
            </h2>
            <p className="text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]">
              {bundle.books.length} lorebook
              {bundle.books.length === 1 ? "" : "s"} · {plan.entries.length}{" "}
              entr
              {plan.entries.length === 1 ? "y" : "ies"}
            </p>
          </div>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="mari-chrome-control h-11 w-11 shrink-0 justify-center p-0 disabled:opacity-45"
            aria-label="Cancel portable lore import"
          >
            <X size="0.875rem" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <div className="grid gap-2 sm:grid-cols-4">
            {[
              ["Exact IDs", plan.exactMatches],
              ["Unique content", plan.uniqueContentMatches],
              ["Need a choice", plan.ambiguousMatches],
              ["New entries", plan.newEntries],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] px-3 py-2"
              >
                <p className="text-lg font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                  {value}
                </p>
                <p className="text-[0.625rem] text-[var(--marinara-chat-chrome-panel-muted)]">
                  {label}
                </p>
              </div>
            ))}
          </div>

          <p className="text-xs leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
            Exact IDs are authoritative. A unique content match compares the
            complete portable entry settings, not its name. Duplicate names are
            never attached automatically.
          </p>

          {ambiguousEntries.length > 0 && (
            <section className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle
                  size="0.875rem"
                  className="mt-0.5 shrink-0 text-amber-400"
                />
                <div>
                  <h3 className="text-xs font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                    Choose every ambiguous match
                  </h3>
                  <p className="mt-0.5 text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]">
                    These entries have identical portable content in more than
                    one destination. Choose an exact row or import a new copy.
                  </p>
                </div>
              </div>
              {ambiguousEntries.map((entry) => (
                <label key={entry.entryKey} className="block space-y-1.5">
                  <span className="text-xs font-medium text-[var(--marinara-chat-chrome-panel-title)]">
                    {entry.originalLorebookName} → {entry.entryName}
                  </span>
                  <select
                    value={selections[entry.entryKey] ?? ""}
                    onChange={(event) =>
                      setSelections((current) => ({
                        ...current,
                        [entry.entryKey]: event.target.value,
                      }))
                    }
                    className="min-h-11 w-full rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] px-3 text-sm"
                  >
                    <option value="">Choose a destination…</option>
                    {entry.candidates.map((candidate) => (
                      <option key={candidate.entryId} value={candidate.entryId}>
                        {candidate.lorebookName} → {candidate.entryName} (
                        {candidate.entryId})
                      </option>
                    ))}
                    <option value="__new__">Import a new copy</option>
                  </select>
                </label>
              ))}
            </section>
          )}

          <details
            onToggle={(event) => setMappingOpen(event.currentTarget.open)}
            className="rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] p-3"
          >
            <summary className="cursor-pointer text-xs font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
              Inspect location-to-lore mapping ({bundle.references.length})
            </summary>
            {mappingOpen && (
              <div className="mt-3 max-h-56 space-y-1 overflow-y-auto font-mono text-[0.625rem] leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
                {bundle.references.map((reference, index) => (
                  <p
                    key={`${reference.locationId}-${reference.originalEntryId}-${index}`}
                  >
                    {reference.locationName} → {reference.originalLorebookName} →{" "}
                    {reference.originalEntryName} → {reference.originalEntryId}
                  </p>
                ))}
              </div>
            )}
          </details>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
              Expected outcome
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] p-3">
                <p className="text-xs font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                  Import separate copies
                </p>
                <p className="mt-1 text-[0.6875rem] leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
                  Reuse 0 entries. Import {separateOutcome.importedEntries} entr
                  {separateOutcome.importedEntries === 1 ? "y" : "ies"} into{" "}
                  {separateOutcome.createdLorebooks.length} new lorebook
                  {separateOutcome.createdLorebooks.length === 1 ? "" : "s"}.
                </p>
                <ul className="mt-2 space-y-1 text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-text)]">
                  {separateOutcome.createdLorebooks.map((book) => (
                    <li key={book.name}>Create “{book.name}”</li>
                  ))}
                </ul>
              </div>
              <div
                role="status"
                className="rounded-xl border border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)] p-3"
              >
                <p className="text-xs font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                  Reuse matches & import the rest
                </p>
                <p className="mt-1 text-[0.6875rem] leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
                  Reuse {reuseOutcome.reusedEntries} entr
                  {reuseOutcome.reusedEntries === 1 ? "y" : "ies"} from{" "}
                  {reuseOutcome.reusedLorebooks.length} existing lorebook
                  {reuseOutcome.reusedLorebooks.length === 1 ? "" : "s"}; import{" "}
                  {reuseOutcome.importedEntries} entr
                  {reuseOutcome.importedEntries === 1 ? "y" : "ies"} into{" "}
                  {reuseOutcome.createdLorebooks.length} new lorebook
                  {reuseOutcome.createdLorebooks.length === 1 ? "" : "s"}.
                </p>
                {reuseOutcome.unresolvedEntries > 0 && (
                  <p className="mt-2 text-[0.6875rem] text-amber-400">
                    Choose {reuseOutcome.unresolvedEntries} ambiguous entr
                    {reuseOutcome.unresolvedEntries === 1 ? "y" : "ies"} to finalize this outcome.
                  </p>
                )}
                <ul className="mt-2 space-y-1 text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-text)]">
                  {reuseOutcome.reusedLorebooks.map((book) => (
                    <li key={book.id}>Reuse “{book.name}”</li>
                  ))}
                  {reuseOutcome.createdLorebooks.map((book) => (
                    <li key={book.name}>Create “{book.name}”</li>
                  ))}
                  {reuseOutcome.reusedLorebooks.length === 0 &&
                    reuseOutcome.createdLorebooks.length === 0 &&
                    reuseOutcome.unresolvedEntries === 0 && <li>Create no lorebooks</li>}
                </ul>
              </div>
            </div>
          </section>
        </div>

        <div className="grid gap-2 border-t border-[var(--marinara-chat-chrome-panel-divider)] p-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onImport("separate", new Map())}
            className="mari-chrome-control min-h-11 justify-center px-3 text-xs disabled:opacity-45"
          >
            {busy ? (
              <Loader2 size="0.75rem" className="animate-spin" />
            ) : (
              <Copy size="0.75rem" />
            )}{" "}
            Import separate copies
          </button>
          <button
            type="button"
            disabled={busy || !reuseReady}
            onClick={() => onImport("reuse", selectionMap())}
            className="mari-chrome-control min-h-11 justify-center border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)] px-3 text-xs disabled:opacity-45"
          >
            {busy ? (
              <Loader2 size="0.75rem" className="animate-spin" />
            ) : (
              <Link2 size="0.75rem" />
            )}{" "}
            Reuse matches & import the rest
          </button>
        </div>
      </div>
    </div>
  );
}
