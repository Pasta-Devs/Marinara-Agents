import { useId, useState } from "react";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { Avatar, SLP_TYPE } from "../../base/chrome/SlpChrome";
import { slpCreatorChipList, type SlpChipCreator } from "../chrome/slp-creator-chips";

const SHOWN = 12;

/**
 * Find a person by name and tap them (the People map's "add someone"): a search field over a strip
 * of pictures with the name under each. Empty field: everyone, `picked` first.
 */
export function SlpPersonSearch({
  people,
  picked = [],
  onPick,
  label,
}: {
  people: readonly SlpChipCreator[];
  picked?: readonly string[];
  onPick: (id: string) => void;
  label: string;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const id = useId();
  const shown = slpCreatorChipList(people, picked, query).slice(0, SHOWN);
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="relative block">
        <span className="sr-only">{label}</span>
        <Search
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--slurp-muted)]"
        />
        <input
          id={id}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={label}
          className="min-h-11 w-full rounded-xl bg-[var(--slurp-canvas)] pe-3 ps-9 text-base ring-1 ring-inset ring-[var(--slurp-outline)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-sm"
        />
      </label>
      <div className="flex gap-1 overflow-x-auto pb-1" role="group" aria-label={label}>
        {shown.map((person) => {
          const on = picked.includes(person.id);
          return (
            <button
              key={person.id}
              type="button"
              aria-pressed={on}
              onClick={() => onPick(person.id)}
              className="flex min-h-11 w-16 shrink-0 flex-col items-center gap-1 rounded-xl py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
            >
              <span
                className="rounded-full"
                style={{ boxShadow: on ? "0 0 0 2px var(--noodle-accent)" : "0 0 0 1px var(--noodle-divider)" }}
              >
                <Avatar account={{ displayName: person.name, avatarUrl: person.avatarUrl }} size="md" />
              </span>
              <span
                className={cn(
                  "block w-full truncate text-center text-[11px] leading-4",
                  on ? "font-semibold text-[var(--slurp-text)]" : "text-[var(--slurp-muted)]",
                )}
              >
                {person.name}
              </span>
            </button>
          );
        })}
        {shown.length === 0 && (
          <p className={cn(SLP_TYPE.meta, "px-1 text-[var(--slurp-muted)]")}>{t("ui.slurp.stir.findCreatorNone")}</p>
        )}
      </div>
    </div>
  );
}
