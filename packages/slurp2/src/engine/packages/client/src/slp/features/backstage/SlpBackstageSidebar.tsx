import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Flame,
  Gauge,
  Globe2,
  Headset,
  Radio,
  LayoutDashboard,
  Link2,
  Megaphone,
  PenLine,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../../../lib/utils";

import { type SlurpNavigationState } from "../../base/navigation/slp-navigation.types";

import {
  SLP_BACKSTAGE_DEFAULT_TARGET,
  SLP_BACKSTAGE_EXTENSION_SECTIONS,
  SLP_BACKSTAGE_SECTION_LABELS,
  type SlpBackstageSection,
} from "../../base/navigation/slp-backstage-target";

import { settingsSections, sectionTabClass } from "../../modules/settings/slp-backstage-format";

export const SLP_BACKSTAGE_SECTION_ICONS: Record<SlpBackstageSection, LucideIcon> = {
  overview: LayoutDashboard,
  basic: Gauge,
  creators: UsersRound,
  spice: Flame,
  prompts: PenLine,
  ads: Megaphone,
  content: BookOpen,
  world: Globe2,
  stir: Headset,
  live: Radio,
  engine: Link2,
};

/** The heading above the first extension section, in the side menu and the phone home list. */
function ExtensionsHeading({ className }: { className: string }) {
  const { t } = useTranslation();
  return (
    <p className={className}>{t("ui.slurp.settings.backstage.extensionsHeading", { defaultValue: "Extensions" })}</p>
  );
}

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
    // Its own scroll box: every settings section runs past a short window. The persona menu below
    // the side menu stays outside it (`SlpShell`), so its popover is never clipped.
    <div className="min-h-0 flex-1 overflow-y-auto">
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
            <Fragment key={item}>
              {item === SLP_BACKSTAGE_EXTENSION_SECTIONS[0] && (
                <ExtensionsHeading className="px-3 pb-2 pt-4 text-xs font-bold uppercase tracking-[0.14em] text-[var(--slurp-muted)]" />
              )}
              <button
                type="button"
                aria-current={section === item ? "page" : undefined}
                onClick={() => onNavigate({ ...navigation, section: item, target: SLP_BACKSTAGE_DEFAULT_TARGET[item] })}
                className={sectionTabClass(section === item)}
              >
                <Icon
                  size={17}
                  className={section === item ? "text-[var(--noodle-accent-foreground)]" : "text-[var(--slurp-muted)]"}
                  aria-hidden="true"
                />
                {t(`ui.slurp.settings.backstage.sections.${item}`, {
                  defaultValue: SLP_BACKSTAGE_SECTION_LABELS[item],
                })}
              </button>
            </Fragment>
          );
        })}
      </nav>
    </div>
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
      <nav aria-label={t("ui.slurp.settings.title")} className="space-y-4">
        {[
          settingsSections.filter((item) => !SLP_BACKSTAGE_EXTENSION_SECTIONS.includes(item)),
          SLP_BACKSTAGE_EXTENSION_SECTIONS,
        ].map((group, index) => (
          <div key={index}>
            {index === 1 && (
              <ExtensionsHeading className="px-1 pb-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--slurp-muted)]" />
            )}
            <ul className="divide-y divide-[var(--slurp-outline)] overflow-hidden rounded-xl bg-[var(--slurp-surface)] ring-1 ring-inset ring-[var(--slurp-outline)]">
              {group.map((item) => {
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
                        className="grid size-9 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--noodle-accent)_16%,var(--slurp-surface-raised))] text-[var(--noodle-accent-foreground)]"
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
          </div>
        ))}
      </nav>
    </div>
  );
}
