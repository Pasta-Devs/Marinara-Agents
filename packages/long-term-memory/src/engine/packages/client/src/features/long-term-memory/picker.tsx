import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  BookOpen,
  Brain,
  Check,
  Globe,
  MessageSquare,
  MessagesSquare,
  Search,
  User,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useLtmTranslation } from "./localization";
import { placeListLimit } from "./scope-targets";
import { IconButton, inputClass } from "./shared-controls";

/** The one picture per kind of thing a picker row or source row can name. The host passes no avatars to packages. */
export const kindIcons = {
  all: Globe,
  chat: MessageSquare,
  group: MessagesSquare,
  character: User,
  local_character: User,
  persona: UserRound,
  lorebook: BookOpen,
  memory: Brain,
} as const satisfies Record<string, LucideIcon>;
export type IconKind = keyof typeof kindIcons;

/** The one row look of every picker: a check, the kind's icon, the name and an optional one-line comment. */
export function pickerRowClass(state: { selected?: boolean; highlighted?: boolean } = {}) {
  return `mari-editor-action mari-editor-action--compact flex min-h-11 w-full items-center gap-2 rounded-none border-t-0 px-3 py-2 text-left last:border-b-0 ${
    state.highlighted ? "bg-[var(--secondary)]" : state.selected ? "bg-[var(--primary)]/10" : ""
  }`;
}

export function PickerRowBody({
  kind,
  label,
  comment,
  selected = false,
}: {
  kind: IconKind;
  label: ReactNode;
  comment?: ReactNode;
  selected?: boolean;
}) {
  const Icon = kindIcons[kind];
  return (
    <>
      <Check
        aria-hidden="true"
        size="0.875rem"
        className={selected ? "shrink-0 text-[var(--marinara-editor-accent)]" : "shrink-0 opacity-0"}
      />
      <Icon aria-hidden="true" size="0.875rem" className="shrink-0 text-[var(--marinara-editor-muted)]" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-normal text-[var(--marinara-editor-text)]">{label}</span>
        {comment ? <span className="block truncate text-xs text-[var(--marinara-editor-muted)]">{comment}</span> : null}
      </span>
    </>
  );
}

export type PickerItem = { id: string; kind: IconKind; label: string; comment?: string; searchText?: string };

/**
 * The always-open picker for one thing at a time (a subject, a linked memory): a search box over a list of
 * picker rows. Arrow keys move the highlight, Enter chooses it, Esc clears the search; the list shows
 * `placeListLimit` rows at a time with a Show more row.
 */
export function SearchPicker({
  items,
  placeholder,
  emptyLabel,
  clearLabel,
  testId,
  onSelect,
}: {
  items: readonly PickerItem[];
  placeholder: string;
  emptyLabel: string;
  clearLabel: string;
  testId: string;
  onSelect: (item: PickerItem) => void;
}) {
  const { locale, t: localizeUi } = useLtmTranslation();
  const inputId = useId();
  const listId = `${inputId}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState("");
  const [shown, setShown] = useState({ key: "", count: placeListLimit });
  const needle = query.trim().toLocaleLowerCase();
  const filtered = useMemo(
    () =>
      items.filter((item) =>
        [item.label, item.comment, item.searchText].filter(Boolean).join(" ").toLocaleLowerCase().includes(needle),
      ),
    [items, needle],
  );
  const shownCount = shown.key === needle ? shown.count : placeListLimit;
  const visible = filtered.slice(0, shownCount);
  const hidden = filtered.length - visible.length;
  const showMoreId = "show-more";
  const optionIds = [...visible.map((item) => item.id), ...(hidden ? [showMoreId] : [])];
  const activeId = optionIds.includes(highlighted) ? highlighted : "";
  const optionDomId = (id: string) => `${listId}-${id}`;
  const choose = (id: string) => {
    if (id === showMoreId) {
      setShown({ key: needle, count: shownCount + placeListLimit });
      setHighlighted(filtered[shownCount]?.id ?? "");
      return;
    }
    const item = filtered.find((candidate) => candidate.id === id);
    if (!item) return;
    onSelect(item);
    setQuery("");
    setHighlighted("");
    inputRef.current?.focus();
  };
  const move = (direction: 1 | -1) => {
    if (!optionIds.length) return;
    const current = optionIds.indexOf(activeId);
    const next =
      current < 0
        ? direction === 1
          ? 0
          : optionIds.length - 1
        : (current + direction + optionIds.length) % optionIds.length;
    setHighlighted(optionIds[next]!);
    document.getElementById(optionDomId(optionIds[next]!))?.scrollIntoView({ block: "nearest" });
  };
  const handleKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      move(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter" && activeId) {
      event.preventDefault();
      choose(activeId);
    } else if (event.key === "Escape" && query) {
      event.preventDefault();
      event.stopPropagation();
      setQuery("");
    }
  };

  return (
    <div className="relative space-y-1" data-ltm-picker={testId}>
      <label className="relative block">
        <Search
          aria-hidden="true"
          size="0.875rem"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
        />
        <input
          ref={inputRef}
          id={inputId}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId ? optionDomId(activeId) : undefined}
          className={`${inputClass} pl-9 pr-10`}
          value={query}
          placeholder={placeholder}
          aria-label={placeholder}
          data-ltm-picker-search={testId}
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlighted("");
          }}
          onKeyDown={handleKey}
        />
        {query ? (
          <IconButton icon={X} label={clearLabel} className="absolute right-1 top-1" onClick={() => setQuery("")} />
        ) : null}
      </label>
      {visible.length ? (
        <div
          id={listId}
          role="listbox"
          aria-label={placeholder}
          className="max-h-52 overflow-y-auto rounded-md border border-[var(--marinara-editor-divider)]"
          style={{ backgroundColor: "var(--marinara-editor-control-bg)" }}
        >
          {visible.map((item) => (
            <button
              key={item.id}
              id={optionDomId(item.id)}
              type="button"
              role="option"
              aria-selected={false}
              tabIndex={-1}
              data-ltm-picker-option={item.id}
              data-highlighted={item.id === activeId}
              className={pickerRowClass({ highlighted: item.id === activeId })}
              onMouseDown={(event) => event.preventDefault()}
              onMouseMove={() => setHighlighted(item.id)}
              onClick={() => choose(item.id)}
            >
              <PickerRowBody kind={item.kind} label={item.label} comment={item.comment} />
            </button>
          ))}
          {hidden ? (
            <button
              id={optionDomId(showMoreId)}
              type="button"
              role="option"
              aria-selected={false}
              tabIndex={-1}
              data-ltm-picker-show-more
              data-highlighted={activeId === showMoreId}
              className={`${pickerRowClass({ highlighted: activeId === showMoreId })} text-xs font-semibold text-[var(--marinara-editor-muted)]`}
              onMouseDown={(event) => event.preventDefault()}
              onMouseMove={() => setHighlighted(showMoreId)}
              onClick={() => choose(showMoreId)}
            >
              {localizeUi("ui.longTermMemory.memoryvault.showMoreMemories", {
                value1: Math.min(placeListLimit, hidden).toLocaleString(locale),
              })}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="px-3 py-2 text-xs text-[var(--marinara-editor-muted)]">{emptyLabel}</p>
      )}
    </div>
  );
}
