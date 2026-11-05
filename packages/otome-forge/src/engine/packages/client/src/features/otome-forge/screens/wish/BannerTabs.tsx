// ──────────────────────────────────────────────
// Otome Forge: Wish's tabs. Memories · {name}'s Wardrobe · My Wardrobe · Echoes. The love interest's wardrobe is
// named after the one it features this fortnight (whoever they are), never "his". TabList is the tab row itself, which
// the Album shares: arrow keys move between the tabs and select them, Home and End jump to the ends, as Settings' do.
// ──────────────────────────────────────────────
import { useRef, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { BookHeart, History, Shirt, Sparkles, type LucideIcon } from "lucide-react";
import type { BannerKind } from "../../shared/wish";

interface TabListProps<T extends string> {
  /** Prefix for the tab and panel ids: tab `${id}-${tab}-tab` controls panel `${id}-${tab}-panel`. */
  id: string;
  tabs: readonly T[];
  tab: T;
  onChange: (tab: T) => void;
  label: string;
  labelOf: (tab: T) => string;
  iconOf: (tab: T) => LucideIcon;
  /** Tabs with something new, marked with a dot (and said to screen readers). */
  fresh?: ReadonlySet<T>;
  className?: string;
}

export function TabList<T extends string>({
  id,
  tabs,
  tab,
  onChange,
  label,
  labelOf,
  iconOf,
  fresh,
  className,
}: TabListProps<T>) {
  const { t } = useTranslation();
  const refs = useRef<Partial<Record<T, HTMLButtonElement | null>>>({});

  const onKeyDown = (event: KeyboardEvent) => {
    const index = tabs.indexOf(tab);
    const rtl = (event.currentTarget as HTMLElement).closest("[dir]")?.getAttribute("dir") === "rtl";
    const next =
      event.key === (rtl ? "ArrowLeft" : "ArrowRight")
        ? tabs[(index + 1) % tabs.length]
        : event.key === (rtl ? "ArrowRight" : "ArrowLeft")
          ? tabs[(index - 1 + tabs.length) % tabs.length]
          : event.key === "Home"
            ? tabs[0]
            : event.key === "End"
              ? tabs[tabs.length - 1]
              : undefined;
    if (next === undefined) return;
    event.preventDefault();
    onChange(next);
    refs.current[next]?.focus();
  };

  return (
    <div
      className={className ? `of-tabs of-glass ${className}` : "of-tabs of-glass"}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      {tabs.map((name) => {
        const Icon = iconOf(name);
        const selected = name === tab;
        return (
          <button
            key={name}
            ref={(element) => {
              refs.current[name] = element;
            }}
            type="button"
            role="tab"
            id={`${id}-${name}-tab`}
            className="of-tab"
            aria-selected={selected}
            aria-controls={`${id}-${name}-panel`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(name)}
          >
            <Icon size={16} strokeWidth={1.9} aria-hidden="true" />
            <span>{labelOf(name)}</span>
            {fresh?.has(name) ? (
              <span className="of-tab-dot">
                <span className="of-visually-hidden">{t("ui.otomeForge.wish.tabNew")}</span>
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export type WishTab = BannerKind | "echoes";
export const WISH_TABS: readonly WishTab[] = ["memories", "his-wardrobe", "my-wardrobe", "echoes"];

const TAB_ICONS: Record<WishTab, LucideIcon> = {
  memories: BookHeart,
  "his-wardrobe": Shirt,
  "my-wardrobe": Sparkles,
  echoes: History,
};

export function tabLabel(t: ReturnType<typeof useTranslation>["t"], tab: WishTab, name: string | null): string {
  return tab === "memories"
    ? t("ui.otomeForge.wish.tabMemories")
    : tab === "his-wardrobe"
      ? name
        ? t("ui.otomeForge.wish.tabTheirWardrobeNamed", { name })
        : t("ui.otomeForge.wish.tabTheirWardrobe")
      : tab === "my-wardrobe"
        ? t("ui.otomeForge.wish.tabMyWardrobe")
        : t("ui.otomeForge.wish.tabEchoes");
}

interface BannerTabsProps {
  id: string;
  tab: WishTab;
  onChange: (tab: WishTab) => void;
  /** The love interest the current wardrobe banner features, for its tab's name; null before it exists. */
  wardrobeName: string | null;
  /** Kinds whose banner for this fortnight is still to be written. */
  fresh?: ReadonlySet<WishTab>;
}

export function BannerTabs({ id, tab, onChange, wardrobeName, fresh }: BannerTabsProps) {
  const { t } = useTranslation();
  return (
    <TabList
      id={id}
      tabs={WISH_TABS}
      tab={tab}
      onChange={onChange}
      label={t("ui.otomeForge.wish.tabsLabel")}
      labelOf={(name) => tabLabel(t, name, wardrobeName)}
      iconOf={(name) => TAB_ICONS[name]}
      fresh={fresh}
      className="of-banner-tabs"
    />
  );
}
