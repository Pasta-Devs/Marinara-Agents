import { useId, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { IconButton, inputClass } from "./shared-controls";

export type PickerTarget = {
  id: string;
  label: string;
  comment?: string;
  kind: "chat" | "group" | "character" | "persona";
};

export function TargetPicker({
  targets,
  selectedIds,
  allowedKinds,
  placeholder,
  emptyLabel,
  clearLabel,
  groupLabels,
  onSelect,
}: {
  targets: PickerTarget[];
  selectedIds: ReadonlySet<string>;
  allowedKinds: ReadonlySet<PickerTarget["kind"]>;
  placeholder: string;
  emptyLabel: string;
  clearLabel: string;
  groupLabels?: Partial<Record<PickerTarget["kind"], string>>;
  onSelect: (target: PickerTarget) => void;
}) {
  const inputId = useId();
  const listId = `${inputId}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const available = useMemo(
    () =>
      targets.filter(
        (target) =>
          allowedKinds.has(target.kind) &&
          !selectedIds.has(`${target.kind}:${target.id}`) &&
          !selectedIds.has(target.id),
      ),
    [allowedKinds, selectedIds, targets],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return available.filter((target) =>
      [target.label, target.comment].filter(Boolean).join(" ").toLocaleLowerCase().includes(needle),
    );
  }, [available, query]);
  const select = (target: PickerTarget) => {
    onSelect(target);
    setQuery("");
    inputRef.current?.focus();
  };

  return (
    <div className="relative space-y-1">
      <label className="relative block">
        <Search
          aria-hidden="true"
          size="0.875rem"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
        />
        <input
          ref={inputRef}
          id={inputId}
          className={`${inputClass} pl-9 pr-10`}
          value={query}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(event) => setQuery(event.target.value)}
        />
        {query ? (
          <IconButton
            icon={X}
            label={clearLabel}
            className="absolute right-1 top-1"
            onClick={() => setQuery("")}
          />
        ) : null}
      </label>
      <div id={listId} className="max-h-52 overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--background)]">
        {filtered.length ? (
          filtered.map((target, index) => (
            <div key={`${target.kind}:${target.id}`}>
              {groupLabels && (index === 0 || filtered[index - 1]?.kind !== target.kind) ? (
                <p className="border-b border-[var(--border)] bg-[var(--secondary)] px-3 py-1 text-xs font-semibold text-[var(--muted-foreground)]">
                  {groupLabels[target.kind]}
                </p>
              ) : null}
              <button
                id={`${listId}-${target.kind}-${target.id}`}
                type="button"
                className="block min-h-11 w-full border-b border-[var(--border)] px-3 py-2 text-left last:border-b-0 hover:bg-[var(--accent)]"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(target)}
              >
                <span className="block text-sm">{target.label}</span>
                {target.comment ? (
                  <span className="block text-xs text-[var(--muted-foreground)]">{target.comment}</span>
                ) : null}
              </button>
            </div>
          ))
        ) : (
          <p className="px-3 py-2 text-xs text-[var(--muted-foreground)]">{emptyLabel}</p>
        )}
      </div>
    </div>
  );
}
