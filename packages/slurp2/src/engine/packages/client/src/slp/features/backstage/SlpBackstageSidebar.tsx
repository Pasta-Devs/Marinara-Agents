import {
  ArrowLeft,
  BookOpen,
  CalendarClock,
  ChevronRight,
  Coins,
  Globe2,
  LayoutDashboard,
  PenLine,
  Plug,
  UsersRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../../../lib/utils";

import { type SlurpNavigationState } from "../../base/navigation/slp-navigation.types";

import {
  SLP_BACKSTAGE_DEFAULT_TARGET,
  SLP_BACKSTAGE_SECTION_LABELS,
  type SlpBackstageSection,
} from "../../base/navigation/slp-backstage-target";

import { settingsSections, sectionTabClass } from "../../modules/settings/slp-backstage-format";

export const SLP_BACKSTAGE_SECTION_ICONS: Record<SlpBackstageSection, LucideIcon> = {
  overview: LayoutDashboard,
  models: Plug,
  creators: UsersRound,
  automation: CalendarClock,
  content: BookOpen,
  world: Globe2,
  fans: Coins,
  prompts: PenLine,
  maintenance: Wrench,
};

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
        {settingsSections.map((item) => {
          const Icon = SLP_BACKSTAGE_SECTION_ICONS[item];
          return (
            <button
              key={item}
              type="button"
              aria-current={section === item ? "page" : undefined}
              onClick={() => onNavigate({ ...navigation, section: item, target: SLP_BACKSTAGE_DEFAULT_TARGET[item] })}
              className={sectionTabClass(section === item)}
            >
              <Icon
                size={17}
                className={section === item ? "text-[var(--noodle-accent)]" : "text-[var(--slurp-muted)]"}
                aria-hidden="true"
              />
              {t(`ui.slurp.settings.backstage.sections.${item}`, {
                defaultValue: SLP_BACKSTAGE_SECTION_LABELS[item],
              })}
            </button>
          );
        })}
      </nav>
    </>
  );
}

/**
 * Phone settings home: every section as one row with an icon and what it holds, search on top.
 * A row opens the section; the page header then shows a way back here. Replaces the old
 * "Destination" dropdown, which hid 21 pages behind one native select.
 */
export function SlpBackstageHome({
  navigation,
  onNavigate,
  search,
  className,
}: {
  navigation: Extract<SlurpNavigationState, { mode: "creator-settings" }>;
  onNavigate: (navigation: SlurpNavigationState) => void;
  search: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className={cn("space-y-4 px-1", className)}>
      <h1 className="pt-1 text-3xl font-black tracking-tight">{t("ui.slurp.settings.title")}</h1>
      {search}
      <nav aria-label={t("ui.slurp.settings.title")}>
        <ul className="divide-y divide-[var(--slurp-outline)] overflow-hidden rounded-xl bg-[var(--slurp-surface)] ring-1 ring-inset ring-[var(--slurp-outline)]">
          {settingsSections.map((item) => {
            const Icon = SLP_BACKSTAGE_SECTION_ICONS[item];
            return (
              <li key={item}>
                <button
                  type="button"
                  onClick={() =>
                    onNavigate({ ...navigation, section: item, target: SLP_BACKSTAGE_DEFAULT_TARGET[item] })
                  }
                  className="flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-start transition-colors hover:bg-[var(--slurp-surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none"
                >
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--noodle-accent)_16%,var(--slurp-surface-raised))] text-[var(--noodle-accent)]"
                    aria-hidden="true"
                  >
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      {t(`ui.slurp.settings.backstage.sections.${item}`, {
                        defaultValue: SLP_BACKSTAGE_SECTION_LABELS[item],
                      })}
                    </span>
                    <span className="block truncate text-xs text-[var(--slurp-muted)]">
                      {t(`ui.slurp.settings.backstage.sectionHints.${item}`)}
                    </span>
                  </span>
                  <ChevronRight
                    size={18}
                    className="shrink-0 text-[var(--slurp-muted)] rtl:rotate-180"
                    aria-hidden="true"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
