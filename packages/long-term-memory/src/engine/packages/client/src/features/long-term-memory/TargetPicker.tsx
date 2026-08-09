import { useEffect, useId, useMemo, useRef, useState } from "react";
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
  onSelect,
}: {
  targets: PickerTarget[];
  selectedIds: ReadonlySet<string>;
  allowedKinds: ReadonlySet<PickerTarget["kind"]>;
  placeholder: string;
  emptyLabel: string;
  clearLabel: string;
  onSelect: (target: PickerTarget) => void;
}) {
  const inputId = useId();
  const listId = `${inputId}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
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
  useEffect(() => setActiveIndex(0), [query]);

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
          aria-controls={listId}
          aria-expanded="true"
          aria-activedescendant={filtered[activeIndex] ? `${listId}-${filtered[activeIndex].kind}-${filtered[activeIndex].id}` : undefined}
          role="combobox"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((index) => Math.min(index + 1, Math.max(0, filtered.length - 1)));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => Math.max(0, index - 1));
            } else if (event.key === "Enter" && filtered[activeIndex]) {
              event.preventDefault();
              select(filtered[activeIndex]!);
            } else if (event.key === "Escape") {
              setQuery("");
            }
          }}
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
      <div id={listId} role="listbox" className="max-h-52 overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--background)]">
        {filtered.length ? (
          filtered.map((target, index) => (
            <button
              key={`${target.kind}:${target.id}`}
              id={`${listId}-${target.kind}-${target.id}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className="block min-h-11 w-full border-b border-[var(--border)] px-3 py-2 text-left last:border-b-0 hover:bg-[var(--accent)] aria-selected:bg-[var(--accent)]"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(target)}
            >
              <span className="block text-sm">{target.label}</span>
              {target.comment ? (
                <span className="block text-xs text-[var(--muted-foreground)]">{target.comment}</span>
              ) : null}
            </button>
          ))
        ) : (
          <p className="px-3 py-2 text-xs text-[var(--muted-foreground)]">{emptyLabel}</p>
        )}
      </div>
    </div>
  );
}
