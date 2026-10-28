import { useId, useState } from "react";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { Avatar, SLP_TYPE } from "../../base/chrome/SlpChrome";

import { SLP_CREATOR_CHIPS_SEARCH_FROM, slpCreatorChipList, type SlpChipCreator } from "./slp-creator-chips";

/**
 * Creators as avatar chips to pick from (Stir's play sheet, Business). A long list gets a search
 * field and keeps the picked Creators in front, so it never turns into rows and rows of chips.
 */
export function SlpCreatorChips({
  creators,
  picked,
  onToggle,
  label,
}: {
  creators: readonly SlpChipCreator[];
  picked: readonly string[];
  onToggle: (id: string) => void;
  label: string;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const searchId = useId();
  const searchable = creators.length > SLP_CREATOR_CHIPS_SEARCH_FROM;
  const shown = searchable ? slpCreatorChipList(creators, picked, query) : creators;
  return (
    <div className="space-y-2">
      {searchable && (
        <label htmlFor={searchId} className="relative block">
          <span className="sr-only">{t("ui.slurp.stir.findCreator")}</span>
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--slurp-muted)]"
          />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("ui.slurp.stir.findCreator")}
            className="min-h-11 w-full rounded-xl bg-[var(--slurp-canvas)] pe-3 ps-9 text-base ring-1 ring-inset ring-[var(--slurp-outline)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-sm"
          />
        </label>
      )}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {shown.map((creator) => {
          const on = picked.includes(creator.id);
          return (
            <button
              key={creator.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(creator.id)}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-full py-1 pe-3.5 ps-1 text-sm font-semibold ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none",
                on
                  ? "bg-[image:var(--slurp-nav-active)] text-[var(--slurp-text)] ring-[var(--noodle-accent)]/45"
                  : "bg-[var(--slurp-canvas)] text-[var(--slurp-muted)] ring-[var(--slurp-outline)] hover:text-[var(--slurp-text)]",
              )}
            >
              <Avatar account={{ displayName: creator.name, avatarUrl: creator.avatarUrl }} size="xs" />
              <span className="max-w-[9rem] truncate">{creator.name}</span>
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
