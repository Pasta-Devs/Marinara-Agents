import { ArrowRight, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { SlurpSettings } from "../settings/slp-settings-contract";

import { cn } from "../../../lib/utils";
import { SlpSettingScopeBadge } from "../../modules/settings/SlpSettingsKit";

import {
  destinationForTarget,
  SLP_BACKSTAGE_SECTION_LABELS,
  SLP_BACKSTAGE_TARGET_LABELS,
  SLP_BACKSTAGE_TARGETS_BY_SECTION,
  type SlpBackstageSection,
  type SlpBackstageTarget,
} from "../../base/navigation/slp-backstage-target";
import { SLP_BACKSTAGE_SETTING_PLACEMENT } from "./slp-backstage-placement";

export const humanize = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("Id", "")
    .replace(/^./, (letter) => letter.toUpperCase());

export function SlurpBackstageSubnav({
  section,
  target,
  onSelect,
  className,
}: {
  section: SlpBackstageSection;
  target: SlpBackstageTarget;
  onSelect: (target: SlpBackstageTarget) => void;
  className?: string;
}) {
  const targets = SLP_BACKSTAGE_TARGETS_BY_SECTION[section];
  if (targets.length < 2) return null;
  return (
    <nav
      aria-label={`${SLP_BACKSTAGE_SECTION_LABELS[section]} areas`}
      // A phone keeps the pages in one row that scrolls sideways, not two rows of big pills.
      className={cn(
        "-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] md:flex-wrap md:overflow-visible md:pb-0",
        className,
      )}
    >
      {targets.map((item) => (
        <button
          key={item}
          type="button"
          aria-current={item === target ? "page" : undefined}
          onClick={() => onSelect(item)}
          className={cn(
            "min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold transition-[background-color,color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
            item === target
              ? "bg-[var(--slurp-text)] text-[var(--slurp-canvas)] shadow-sm"
              : "bg-[var(--slurp-surface-raised)] text-[var(--slurp-muted)] ring-1 ring-inset ring-[var(--slurp-outline)] hover:text-[var(--slurp-text)]",
          )}
        >
          {SLP_BACKSTAGE_TARGET_LABELS[item]}
        </button>
      ))}
    </nav>
  );
}

export function SlurpBackstageSearch({
  onSelect,
  className,
}: {
  onSelect: (section: SlpBackstageSection, target: SlpBackstageTarget, setting: keyof SlurpSettings) => void;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // The phone settings home and the page header can both hold a search box.
  const inputId = useId();
  /** The setting's own translated label where one exists; otherwise the key made readable. */
  const labelFor = (key: keyof SlurpSettings) =>
    i18n.exists(`ui.slurp.settings.${key}`) ? t(`ui.slurp.settings.${key}`) : humanize(key);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        if (!inputRef.current?.offsetParent) return;
        event.preventDefault();
        inputRef.current.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return [];
    return (
      Object.entries(SLP_BACKSTAGE_SETTING_PLACEMENT) as Array<
        [keyof SlurpSettings, (typeof SLP_BACKSTAGE_SETTING_PLACEMENT)[keyof SlurpSettings]]
      >
    )
      .filter(
        ([key, placement]) =>
          !placement.internal &&
          [key, humanize(key), labelFor(key), SLP_BACKSTAGE_TARGET_LABELS[placement.target], ...placement.searchTerms]
            .join(" ")
            .toLocaleLowerCase()
            .includes(needle),
      )
      .slice(0, 8);
    // labelFor only reads i18n, which re-renders this component on a language change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);
  useEffect(() => setActive(0), [query]);
  const choose = (index: number) => {
    const result = results[index];
    if (!result) return;
    onSelect(result[1].section, result[1].target, result[0]);
    setQuery("");
  };
  const open = query.trim().length > 0;
  return (
    <div className={cn("relative z-20 w-full max-w-xl", className)}>
      <label className="sr-only" htmlFor={inputId}>
        {t("ui.slurp.settings.backstage.findSetting", { defaultValue: "Find a setting" })}
      </label>
      <Search
        size={17}
        className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--slurp-muted)]"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        id={inputId}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!results.length) return;
            const step = event.key === "ArrowDown" ? 1 : -1;
            setActive((index) => (index + step + results.length) % results.length);
          } else if (event.key === "Enter") {
            event.preventDefault();
            choose(active);
          } else if (event.key === "Escape" && open) {
            event.preventDefault();
            setQuery("");
          }
        }}
        placeholder={t("ui.slurp.settings.backstage.findSetting", { defaultValue: "Find a setting" })}
        className="min-h-14 w-full rounded-xl bg-[var(--slurp-surface-raised)] ps-10 pe-16 text-lg text-[var(--slurp-text)] shadow-sm ring-1 ring-inset ring-[var(--slurp-outline)] placeholder:text-[var(--slurp-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] md:min-h-12 md:text-sm"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open && results.length > 0}
        aria-controls={`${inputId}-results`}
        aria-activedescendant={open && results[active] ? `${inputId}-option-${results[active][0]}` : undefined}
      />
      <kbd className="pointer-events-none absolute end-3 top-1/2 hidden -translate-y-1/2 rounded-md bg-[var(--slurp-canvas)] px-2 py-1 text-[0.68rem] font-semibold text-[var(--slurp-muted)] ring-1 ring-inset ring-[var(--slurp-outline)] sm:block">
        Ctrl K
      </kbd>
      {open && (
        <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] overflow-hidden rounded-xl bg-[var(--slurp-surface-raised)] shadow-[var(--slurp-shadow-floating)] ring-1 ring-inset ring-[var(--slurp-outline)]">
          {results.length ? (
            <ul
              id={`${inputId}-results`}
              role="listbox"
              aria-label={t("ui.slurp.settings.backstage.findSetting", { defaultValue: "Find a setting" })}
              className="max-h-80 overflow-y-auto p-1.5"
            >
              {results.map(([key, placement], index) => (
                <li
                  key={key}
                  id={`${inputId}-option-${key}`}
                  role="option"
                  aria-selected={index === active}
                  // Keep focus in the input so typing and arrow keys keep working.
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(index)}
                  className={cn(
                    "flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-start",
                    index === active && "bg-[var(--slurp-canvas)] ring-2 ring-inset ring-[var(--slurp-focus)]",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{labelFor(key)}</span>
                    <span className="block truncate text-xs text-[var(--slurp-muted)]">
                      {t(`ui.slurp.settings.backstage.sections.${placement.section}`, {
                        defaultValue: SLP_BACKSTAGE_SECTION_LABELS[placement.section],
                      })}{" "}
                      · {SLP_BACKSTAGE_TARGET_LABELS[placement.target]}
                    </span>
                  </span>
                  <SlpSettingScopeBadge scope={placement.scope} />
                  <ArrowRight size={15} className="shrink-0 rtl:rotate-180" aria-hidden="true" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-4 text-sm text-[var(--slurp-muted)]">
              {t("ui.slurp.settings.backstage.noResults", { defaultValue: "No setting matches that search." })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function resolveBackstageSearchDestination(setting: keyof SlurpSettings) {
  const placement = SLP_BACKSTAGE_SETTING_PLACEMENT[setting];
  return { section: destinationForTarget(placement.target), target: placement.target };
}
