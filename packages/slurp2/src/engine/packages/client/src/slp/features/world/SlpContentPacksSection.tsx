import { CalendarHeart, Flame, Leaf, PackageOpen, PartyPopper, Trash2, Trophy, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Toggle } from "../../modules/settings/SlpSettingsControls";
import { useRemoveStoryPack, useSlpBundledStoryPacks, type SlpContentPackSummary } from "./slp-story-hooks.js";

const ICONS: Record<string, LucideIcon> = {
  "slurp-pack-slurpcon": PartyPopper,
  "slurp-pack-awards": Trophy,
  "slurp-pack-holidays": CalendarHeart,
  "slurp-pack-seasons": Leaf,
  "slurp-pack-spicy-firsts": Flame,
};

/**
 * Backstage › Packs: content packs with one switch each. A pack that is on adds its dates to the
 * Calendar and its storylines to Storylines; each Creator only joins what fits them.
 */
export function SlpContentPacksSection({
  toggles,
  onChange,
}: {
  toggles: Record<string, boolean>;
  /** Goes through the Backstage draft: the save bar shows, like every other setting on the page. */
  onChange: (next: Record<string, boolean>) => unknown;
}) {
  const { t, i18n } = useTranslation();
  const bundled = useSlpBundledStoryPacks().data;
  const packs = bundled?.contentPacks ?? [];
  // Imported packs share the list: the switch is a gate over their entries, Remove deletes them.
  const imported = bundled?.imported ?? [];
  const remove = useRemoveStoryPack();
  const date = (month: number, day: number) =>
    new Date(Date.UTC(2026, month - 1, day)).toLocaleDateString(i18n.language, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  const inside = (pack: SlpContentPackSummary) => [
    ...pack.dates.map((entry) =>
      entry.month && entry.day ? `${entry.name} · ${date(entry.month, entry.day)}` : entry.name,
    ),
    ...pack.arcs,
    ...pack.extras.map((extra) =>
      extra === "birthday" ? t("ui.slurp.packs.content.birthday") : t("ui.slurp.packs.content.firstSubs"),
    ),
  ];
  if (!packs.length && !imported.length) return null;
  return (
    <section aria-labelledby="slurp-content-packs-heading" className="space-y-4">
      <div>
        <h2 id="slurp-content-packs-heading" className="text-base font-black">
          {t("ui.slurp.packs.content.title")}
        </h2>
        <p className="mt-1 text-sm text-[var(--slurp-muted)]">{t("ui.slurp.packs.content.lead")}</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {packs.map((pack) => {
          const Icon = ICONS[pack.id] ?? PackageOpen;
          const on = toggles[pack.id] ?? pack.defaultOn;
          return (
            <li
              key={pack.id}
              className={`space-y-3 rounded-xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset ring-[var(--slurp-outline)] transition-opacity ${on ? "" : "opacity-75"}`}
            >
              <div className="flex items-start gap-3">
                <Icon
                  size={20}
                  aria-hidden="true"
                  className={`mt-3 shrink-0 ${on ? "text-[var(--noodle-accent-foreground)]" : "text-[var(--slurp-muted)]"}`}
                />
                <div className="min-w-0 flex-1">
                  <Toggle
                    label={pack.name}
                    detail={pack.adds}
                    value={on}
                    onChange={(next) => void onChange({ ...toggles, [pack.id]: next })}
                  />
                </div>
              </div>
              <div className="pl-8">
                <p className="text-xs font-semibold text-[var(--slurp-muted)]">{t("ui.slurp.packs.content.inside")}</p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {inside(pack).map((item) => (
                    <li
                      key={item}
                      className="rounded-full bg-[var(--slurp-canvas)] px-2.5 py-1 text-xs ring-1 ring-inset ring-[var(--slurp-outline)]"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          );
        })}
        {imported.map((pack) => {
          const on = toggles[pack.id] ?? true;
          return (
            <li
              key={pack.id}
              className={`space-y-3 rounded-xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset ring-[var(--slurp-outline)] transition-opacity ${on ? "" : "opacity-75"}`}
            >
              <div className="flex items-start gap-3">
                <PackageOpen
                  size={20}
                  aria-hidden="true"
                  className={`mt-3 shrink-0 ${on ? "text-[var(--noodle-accent-foreground)]" : "text-[var(--slurp-muted)]"}`}
                />
                <div className="min-w-0 flex-1">
                  <Toggle
                    label={pack.name}
                    detail={pack.description || t("ui.slurp.packs.content.imported")}
                    value={on}
                    onChange={(next) => void onChange({ ...toggles, [pack.id]: next })}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pl-8">
                {pack.topics.map((topic) => {
                  // A topic switched off is a "never" for this pack's entries (`slurpPackTopicsOff`).
                  const key = `${pack.id}:${topic}`;
                  const topicOn = toggles[key] !== false;
                  return (
                    <button
                      key={topic}
                      type="button"
                      aria-pressed={topicOn}
                      onClick={() => void onChange({ ...toggles, [key]: !topicOn })}
                      className={`min-h-11 rounded-full bg-[var(--slurp-canvas)] px-3 text-xs ring-1 ring-inset ring-[var(--slurp-outline)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] ${topicOn ? "" : "text-[var(--slurp-muted)] line-through"}`}
                    >
                      {topic}
                    </button>
                  );
                })}
                {pack.occasionCount ? (
                  <span className="rounded-full bg-[var(--slurp-canvas)] px-2.5 py-1 text-xs ring-1 ring-inset ring-[var(--slurp-outline)]">
                    {t("ui.slurp.packs.content.occasions", { count: pack.occasionCount })}
                  </span>
                ) : null}
                <button
                  type="button"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (!window.confirm(t("ui.slurp.packs.content.removeConfirm", { name: pack.name }))) return;
                    remove.mutate(pack.id);
                  }}
                  className="ml-auto inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-bold text-[var(--noodle-accent-foreground)] hover:bg-[var(--slurp-surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                >
                  <Trash2 size={14} aria-hidden="true" />
                  {t("ui.slurp.packs.content.remove")}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
