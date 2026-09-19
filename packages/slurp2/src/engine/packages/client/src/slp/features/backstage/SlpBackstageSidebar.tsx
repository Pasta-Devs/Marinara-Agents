import { ArrowLeft } from "lucide-react";

import { useTranslation } from "react-i18next";

import { type SlurpNavigationState } from "../../base/navigation/slp-navigation.types";

import {
  SLP_BACKSTAGE_DEFAULT_TARGET,
  SLP_BACKSTAGE_SECTION_LABELS,
  SLP_BACKSTAGE_TARGET_LABELS,
  SLP_BACKSTAGE_TARGETS_BY_SECTION,
  type SlpBackstageTarget,
} from "../../base/navigation/slp-backstage-target";

import { settingsSections, sectionTabClass } from "../../../components/slurp/SlurpBackstageWorkflow";

export function SlpBackstageSidebar({
  navigation,
  onNavigate,
  onExit,
}: {
  navigation: Extract<SlurpNavigationState, { mode: "creator-settings" }>;
  onNavigate: (navigation: SlurpNavigationState) => void;
  onExit: () => void;
}) {
  const { t } = useTranslation();
  const section = navigation.section ?? "overview";
  return (
    <>
      {/* The way out is the one control that must never be hunted for, so it is the loudest
          thing in the column. */}
      <button
        type="button"
        onClick={onExit}
        className="mb-4 flex min-h-11 w-full items-center gap-2 rounded-lg bg-[var(--noodle-accent)]/15 px-3 text-start text-sm font-bold text-[var(--noodle-accent-foreground)] ring-1 ring-inset ring-[var(--noodle-accent)]/40 transition-colors hover:bg-[var(--noodle-accent)]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
      >
        <ArrowLeft size={18} />
        {t("ui.slurp.settings.exit", { defaultValue: "Exit settings" })}
      </button>
      <p className="px-3 pb-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--slurp-muted)]">
        {t("ui.slurp.settings.title")}
      </p>
      <nav className="flex flex-col" aria-label={t("ui.slurp.settings.sectionsLabel")}>
        {settingsSections.map((item) => (
          <button
            key={item}
            type="button"
            aria-current={section === item ? "page" : undefined}
            onClick={() => onNavigate({ ...navigation, section: item, target: SLP_BACKSTAGE_DEFAULT_TARGET[item] })}
            className={sectionTabClass(section === item)}
          >
            {t(`ui.slurp.settings.backstage.sections.${item}`, {
              defaultValue: SLP_BACKSTAGE_SECTION_LABELS[item],
            })}
          </button>
        ))}
      </nav>
    </>
  );
}

/**
 * Mobile section row. It keeps the active section in view and fades whichever edge still has
 * sections behind it, so a row that scrolls does not look like a row that ends.
 */
export function SlpBackstageSectionRow({
  navigation,
  onNavigate,
}: {
  navigation: Extract<SlurpNavigationState, { mode: "creator-settings" }>;
  onNavigate: (navigation: SlurpNavigationState) => void;
}) {
  const { t } = useTranslation();
  const section = navigation.section ?? "overview";
  return (
    <label className="sticky top-0 z-20 -mb-4 flex min-h-14 items-center gap-3 rounded-t-xl bg-[var(--slurp-surface)] px-3 py-2 ring-1 ring-inset ring-[var(--slurp-outline)] md:hidden">
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--slurp-muted)]">
        {t("ui.slurp.settings.backstage.destination", { defaultValue: "Destination" })}
      </span>
      {/* Grouped so the picker reaches a page directly, instead of only its section. */}
      <select
        value={`${section}:${navigation.target ?? SLP_BACKSTAGE_DEFAULT_TARGET[section]}`}
        onChange={(event) => {
          const [next, nextTarget] = event.target.value.split(":") as [
            (typeof settingsSections)[number],
            SlpBackstageTarget,
          ];
          onNavigate({ ...navigation, section: next, target: nextTarget });
        }}
        className="ms-auto min-h-11 min-w-0 flex-1 rounded-lg bg-[var(--slurp-surface-raised)] px-3 text-base font-semibold text-[var(--slurp-text)] ring-1 ring-inset ring-[var(--slurp-outline)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
      >
        {settingsSections.map((item) => (
          <optgroup
            key={item}
            label={t(`ui.slurp.settings.backstage.sections.${item}`, {
              defaultValue: SLP_BACKSTAGE_SECTION_LABELS[item],
            })}
          >
            {SLP_BACKSTAGE_TARGETS_BY_SECTION[item].map((entry) => (
              <option key={entry} value={`${item}:${entry}`}>
                {SLP_BACKSTAGE_TARGET_LABELS[entry]}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
