import { ArrowRight, Check, ChevronDown, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { SlurpSettings } from "../../hooks/use-slurp";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { cn } from "../../lib/utils";
import { estimateSlurpSimulation } from "./slurp-simulation-estimate";
import {
  destinationForTarget,
  SLURP_BACKSTAGE_SECTION_LABELS,
  SLURP_BACKSTAGE_SETTING_PLACEMENT,
  SLURP_BACKSTAGE_TARGET_LABELS,
  SLURP_BACKSTAGE_TARGETS_BY_SECTION,
  type SlurpBackstageScope,
  type SlurpBackstageSection,
  type SlurpBackstageTarget,
} from "./slurp-backstage";

const humanize = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("Id", "")
    .replace(/^./, (letter) => letter.toUpperCase());

const scopeLabels: Record<SlurpBackstageScope, string> = {
  "all-slurp": "All Slurp",
  "this-viewer": "This viewer",
  "new-creators": "New Creators",
  creator: "This Creator",
};

export function SlurpBackstageScopeBadge({
  scope,
  creatorName,
}: {
  scope: SlurpBackstageScope;
  creatorName?: string | null;
}) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex min-h-7 max-w-40 items-center truncate rounded-full bg-[color-mix(in_srgb,var(--slurp-violet)_12%,var(--slurp-surface-raised))] px-2.5 text-xs font-semibold text-[var(--slurp-violet)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--slurp-violet)_24%,transparent)]">
      {scope === "creator" && creatorName
        ? creatorName
        : t(`ui.slurp.settings.backstage.scope.${scope}`, { defaultValue: scopeLabels[scope] })}
    </span>
  );
}

export function SlurpBackstageSubnav({
  section,
  target,
  onSelect,
}: {
  section: SlurpBackstageSection;
  target: SlurpBackstageTarget;
  onSelect: (target: SlurpBackstageTarget) => void;
}) {
  const targets = SLURP_BACKSTAGE_TARGETS_BY_SECTION[section];
  if (targets.length < 2) return null;
  return (
    <nav aria-label={`${SLURP_BACKSTAGE_SECTION_LABELS[section]} areas`} className="flex flex-wrap gap-2">
      {targets.map((item) => (
        <button
          key={item}
          type="button"
          aria-current={item === target ? "page" : undefined}
          onClick={() => onSelect(item)}
          className={cn(
            "min-h-11 rounded-full px-4 text-sm font-semibold transition-[background-color,color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
            item === target
              ? "bg-[var(--slurp-text)] text-[var(--slurp-canvas)] shadow-sm"
              : "bg-[var(--slurp-surface-raised)] text-[var(--slurp-muted)] ring-1 ring-inset ring-[var(--slurp-outline)] hover:text-[var(--slurp-text)]",
          )}
        >
          {SLURP_BACKSTAGE_TARGET_LABELS[item]}
        </button>
      ))}
    </nav>
  );
}

export function SlurpBackstageSearch({
  onSelect,
}: {
  onSelect: (section: SlurpBackstageSection, target: SlurpBackstageTarget, setting: keyof SlurpSettings) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return [];
    return (
      Object.entries(SLURP_BACKSTAGE_SETTING_PLACEMENT) as Array<
        [keyof SlurpSettings, (typeof SLURP_BACKSTAGE_SETTING_PLACEMENT)[keyof SlurpSettings]]
      >
    )
      .filter(([key, placement]) =>
        [key, humanize(key), SLURP_BACKSTAGE_TARGET_LABELS[placement.target], ...placement.searchTerms]
          .join(" ")
          .toLocaleLowerCase()
          .includes(needle),
      )
      .slice(0, 8);
  }, [query]);
  return (
    <div className="relative z-20 w-full max-w-xl">
      <label className="sr-only" htmlFor="slurp-backstage-search">
        {t("ui.slurp.settings.backstage.search", { defaultValue: "Search every Slurp setting" })}
      </label>
      <Search
        size={17}
        className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--slurp-muted)]"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        id="slurp-backstage-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("ui.slurp.settings.backstage.search", { defaultValue: "Search every Slurp setting" })}
        className="min-h-12 w-full rounded-xl bg-[var(--slurp-surface-raised)] ps-10 pe-16 text-base text-[var(--slurp-text)] shadow-sm ring-1 ring-inset ring-[var(--slurp-outline)] placeholder:text-[var(--slurp-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-sm"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls="slurp-backstage-search-results"
      />
      <kbd className="pointer-events-none absolute end-3 top-1/2 hidden -translate-y-1/2 rounded-md bg-[var(--slurp-canvas)] px-2 py-1 text-[0.68rem] font-semibold text-[var(--slurp-muted)] ring-1 ring-inset ring-[var(--slurp-outline)] sm:block">
        Ctrl K
      </kbd>
      {query.trim() && (
        <div
          id="slurp-backstage-search-results"
          className="absolute inset-x-0 top-[calc(100%+0.5rem)] overflow-hidden rounded-xl bg-[var(--slurp-surface-raised)] shadow-[var(--slurp-shadow-floating)] ring-1 ring-inset ring-[var(--slurp-outline)]"
        >
          {results.length ? (
            <ul className="max-h-80 overflow-y-auto p-1.5">
              {results.map(([key, placement]) => (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(placement.section, placement.target, key);
                      setQuery("");
                    }}
                    className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-start hover:bg-[var(--slurp-canvas)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{humanize(key)}</span>
                      <span className="block truncate text-xs text-[var(--slurp-muted)]">
                        {SLURP_BACKSTAGE_SECTION_LABELS[placement.section]} ·{" "}
                        {SLURP_BACKSTAGE_TARGET_LABELS[placement.target]}
                      </span>
                    </span>
                    <SlurpBackstageScopeBadge scope={placement.scope} />
                    <ArrowRight size={15} className="shrink-0 rtl:rotate-180" aria-hidden="true" />
                  </button>
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

function PreviewFrame({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] bg-[var(--slurp-canvas)] shadow-[0_24px_70px_-35px_rgba(107,33,78,0.65)] ring-1 ring-inset ring-[var(--slurp-outline)]">
      <div className="flex h-8 items-center justify-center border-b border-[var(--slurp-outline)] bg-[var(--slurp-surface-raised)]">
        <span className="h-1.5 w-14 rounded-full bg-[var(--slurp-outline)]" />
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

type Translate = ReturnType<typeof useTranslation>["t"];

/** One line that says what this area of Slurp will do with the given settings. */
function outcomeSummary(t: Translate, target: SlurpBackstageTarget, settings: SlurpSettings, creatorCount: number) {
  const key = `ui.slurp.settings.backstage.preview.summary.${target}`;
  switch (target) {
    case "general":
      return t(key, {
        defaultValue: "{{posts}} posts/day · {{mode}}",
        posts: settings.postsPerDay,
        mode: settings.autoPostingScheduleEnabled
          ? t("ui.slurp.settings.backstage.preview.automatic", { defaultValue: "automatic" })
          : t("ui.slurp.settings.backstage.preview.manual", { defaultValue: "manual" }),
      });
    case "images":
      return t(key, {
        defaultValue: "{{width}} × {{height}} · automatic images {{state}}",
        width: settings.imageWidth,
        height: settings.imageHeight,
        state: onOff(t, settings.autoPostingImagesEnabled),
      });
    case "tags":
      return t(key, { defaultValue: "{{count}} discovery tags", count: settings.discoveryTags.length });
    case "arcs":
      return t(key, {
        defaultValue: "{{count}} story templates · {{mode}}",
        count: settings.arcLibrary.length,
        mode: settings.arcAutoMode,
      });
    case "audience":
      return t(key, {
        defaultValue: "{{scale}} crowd · {{activity}} activity",
        scale: settings.platformScale,
        activity: settings.worldActivity,
      });
    case "messaging":
      return t(key, {
        defaultValue: "{{policy}} messages · up to {{bubbles}} bubbles",
        policy: settings.messagesDefaultDmPolicy,
        bubbles: settings.messagesReplyBubbleLimit,
      });
    case "ads":
      return t(key, {
        defaultValue: "Ads {{state}} · {{frequency}}",
        state: onOff(t, settings.inlineAdsEnabled),
        frequency: settings.inlineAdsFrequency,
      });
    case "wallet":
      return t(key, {
        defaultValue: "Coins {{state}} · {{cost}}/week",
        state: onOff(t, settings.walletEnabled),
        cost: settings.walletSubscriptionCost,
      });
    case "autopurge":
      return t(key, {
        defaultValue: "Automatic cleanup {{state}} · {{value}} {{unit}}",
        state: onOff(t, settings.autopurgeEnabled),
        value: settings.autopurgeRetentionValue,
        unit: settings.autopurgeRetentionUnit,
      });
    case "creators":
    case "improve":
      return t("ui.slurp.settings.backstage.preview.summary.creators", {
        defaultValue: "{{count}} Creators in Backstage",
        count: creatorCount,
      });
    default:
      return t("ui.slurp.settings.backstage.preview.summary.overview", { defaultValue: "Your Slurp control room" });
  }
}

const onOff = (t: Translate, value: boolean) =>
  value
    ? t("ui.slurp.settings.backstage.preview.on", { defaultValue: "on" })
    : t("ui.slurp.settings.backstage.preview.off", { defaultValue: "off" });

/** Same cadence the feed uses when it slots ads between posts. */
export const slurpAdEveryPosts = (frequency: SlurpSettings["inlineAdsFrequency"]) =>
  frequency === "light" ? 8 : frequency === "frequent" ? 2 : 4;

function CompareRow({ label, current, proposed }: { label: string; current: ReactNode; proposed: ReactNode }) {
  const changed = String(current) !== String(proposed);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-1.5">
      <dt className="text-[var(--slurp-muted)]">{label}</dt>
      <dd className={cn("font-semibold tabular-nums", changed && "text-[var(--noodle-accent)]")}>
        {changed ? (
          <>
            {current} → {proposed}
          </>
        ) : (
          current
        )}
      </dd>
    </div>
  );
}

function PublishingWeek({ current, proposed }: { current: SlurpSettings; proposed: SlurpSettings }) {
  const { t } = useTranslation();
  const perDay = (settings: SlurpSettings) => (settings.autoPostingScheduleEnabled ? settings.postsPerDay : 0);
  const max = Math.max(1, perDay(current), perDay(proposed));
  const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
  return (
    <figure>
      <figcaption className="text-xs font-bold">
        {t("ui.slurp.settings.backstage.preview.week.title", { defaultValue: "Publishing week" })}
      </figcaption>
      <div className="mt-2 grid h-20 grid-cols-7 items-end gap-1.5" aria-hidden="true">
        {days.map((day) => (
          <div key={day} className="flex h-full items-end justify-center gap-0.5">
            <span
              className="w-1.5 rounded-t bg-[var(--slurp-outline)]"
              style={{ height: `${(perDay(current) / max) * 100}%` }}
            />
            <span
              className="w-1.5 rounded-t bg-[var(--noodle-accent)]"
              style={{ height: `${(perDay(proposed) / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <dl className="mt-2 text-xs">
        <CompareRow
          label={t("ui.slurp.settings.backstage.preview.week.posts", { defaultValue: "Automatic posts per week" })}
          current={perDay(current) * 7}
          proposed={perDay(proposed) * 7}
        />
        <CompareRow
          label={t("ui.slurp.settings.backstage.preview.week.quiet", { defaultValue: "Quiet at night" })}
          current={onOff(t, current.nightQuiet)}
          proposed={onOff(t, proposed.nightQuiet)}
        />
      </dl>
    </figure>
  );
}

function ReplyTimeline({ current, proposed }: { current: SlurpSettings; proposed: SlurpSettings }) {
  const { t } = useTranslation();
  const range = (min: number, max: number) => `${min}–${max} min`;
  const rows = [
    {
      label: t("ui.slurp.settings.backstage.preview.replies.close", { defaultValue: "Close fans" }),
      pick: (s: SlurpSettings) => range(s.messagesHighRapportDelayMinMinutes, s.messagesHighRapportDelayMaxMinutes),
    },
    {
      label: t("ui.slurp.settings.backstage.preview.replies.regular", { defaultValue: "Regular fans" }),
      pick: (s: SlurpSettings) => range(s.messagesMediumRapportDelayMinMinutes, s.messagesMediumRapportDelayMaxMinutes),
    },
    {
      label: t("ui.slurp.settings.backstage.preview.replies.unknown", { defaultValue: "New fans" }),
      pick: (s: SlurpSettings) => `${s.messagesUnknownReturnDelayMinutes} min`,
    },
    {
      label: t("ui.slurp.settings.backstage.preview.replies.cap", { defaultValue: "Longest wait" }),
      pick: (s: SlurpSettings) => `${s.messagesMaxReplyDelayMinutes} min`,
    },
    {
      label: t("ui.slurp.settings.backstage.preview.replies.away", { defaultValue: "Replies while you are away" }),
      pick: (s: SlurpSettings) => onOff(t, s.messagesAwayRepliesEnabled),
    },
  ];
  return (
    <figure>
      <figcaption className="text-xs font-bold">
        {t("ui.slurp.settings.backstage.preview.replies.title", { defaultValue: "Reply availability" })}
      </figcaption>
      <dl className="mt-1 text-xs">
        {rows.map((row) => (
          <CompareRow key={row.label} label={row.label} current={row.pick(current)} proposed={row.pick(proposed)} />
        ))}
      </dl>
    </figure>
  );
}

function AdCadence({ current, proposed }: { current: SlurpSettings; proposed: SlurpSettings }) {
  const { t } = useTranslation();
  const every = (settings: SlurpSettings) =>
    settings.inlineAdsEnabled ? slurpAdEveryPosts(settings.inlineAdsFrequency) : 0;
  const label = (settings: SlurpSettings) =>
    every(settings)
      ? t("ui.slurp.settings.backstage.preview.ads.every", {
          defaultValue: "1 ad every {{count}} posts",
          count: every(settings),
        })
      : t("ui.slurp.settings.backstage.preview.ads.none", { defaultValue: "No ads" });
  const slots = Array.from(
    { length: 16 },
    (_, index) => every(proposed) > 0 && (index + 1) % (every(proposed) + 1) === 0,
  );
  return (
    <figure>
      <figcaption className="text-xs font-bold">
        {t("ui.slurp.settings.backstage.preview.ads.title", { defaultValue: "Ad frequency" })}
      </figcaption>
      <div className="mt-2 flex gap-1" aria-hidden="true">
        {slots.map((ad, index) => (
          <span
            key={index}
            className={cn("h-6 flex-1 rounded", ad ? "bg-[var(--noodle-accent)]" : "bg-[var(--slurp-outline)]")}
          />
        ))}
      </div>
      <dl className="mt-2 text-xs">
        <CompareRow
          label={t("ui.slurp.settings.backstage.preview.ads.feed", { defaultValue: "In the feed" })}
          current={label(current)}
          proposed={label(proposed)}
        />
      </dl>
    </figure>
  );
}

function AudienceWeek({ current, proposed }: { current: SlurpSettings; proposed: SlurpSettings }) {
  const { t } = useTranslation();
  const deferredProposed = useDeferredValue(proposed.simulationTuning);
  const before = useMemo(() => estimateSlurpSimulation(current.simulationTuning), [current.simulationTuning]);
  const after = useMemo(() => estimateSlurpSimulation(deferredProposed), [deferredProposed]);
  const metrics = ["followers", "likes", "comments", "subscriptions", "messages"] as const;
  return (
    <figure>
      <figcaption className="text-xs font-bold">
        {t("ui.slurp.settings.backstage.preview.audience.title", {
          defaultValue: "7-day estimate for a sample Creator",
        })}
      </figcaption>
      <dl className="mt-1 text-xs">
        {metrics.map((metric) => (
          <CompareRow
            key={metric}
            label={t(`ui.slurp.settings.backstage.preview.audience.${metric}`, { defaultValue: humanize(metric) })}
            current={Math.round(before[metric])}
            proposed={Math.round(after[metric])}
          />
        ))}
      </dl>
    </figure>
  );
}

/** Scope of an edit: the placement of the staged fields, or what the page itself acts on. */
export function slurpBackstagePreviewScope(
  target: SlurpBackstageTarget,
  pending: Partial<SlurpSettings>,
): SlurpBackstageScope {
  const scopes = new Set(
    (Object.keys(pending) as Array<keyof SlurpSettings>).map((key) => SLURP_BACKSTAGE_SETTING_PLACEMENT[key].scope),
  );
  if (scopes.size === 1) return [...scopes][0]!;
  if (scopes.size > 1) return "all-slurp";
  if (target === "creators" || target === "improve") return "creator";
  return "all-slurp";
}

export function SlurpBackstagePreview({
  target,
  current,
  proposed,
  pending,
  creatorCount,
  creatorName,
}: {
  target: SlurpBackstageTarget;
  current: SlurpSettings;
  proposed: SlurpSettings;
  pending: Partial<SlurpSettings>;
  creatorCount: number;
  creatorName?: string | null;
}) {
  const { t } = useTranslation();
  const changed = Object.keys(pending) as Array<keyof SlurpSettings>;
  const scope = slurpBackstagePreviewScope(target, pending);
  const behavior =
    target === "general" ? (
      <PublishingWeek current={current} proposed={proposed} />
    ) : target === "messaging" ? (
      <ReplyTimeline current={current} proposed={proposed} />
    ) : target === "ads" ? (
      <AdCadence current={current} proposed={proposed} />
    ) : target === "audience" ? (
      <AudienceWeek current={current} proposed={proposed} />
    ) : null;
  return (
    <aside
      className="order-first min-w-0 xl:order-none"
      aria-label={t("ui.slurp.settings.backstage.preview.label", { defaultValue: "Live preview" })}
    >
      <div className="xl:sticky xl:top-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--noodle-accent)]">
              {t("ui.slurp.settings.backstage.preview.label", { defaultValue: "Live preview" })}
            </p>
            <h2 className="mt-1 text-base font-bold text-balance">
              {t("ui.slurp.settings.backstage.preview.title", { defaultValue: "Know what changes before it does" })}
            </h2>
          </div>
          <SlurpBackstageScopeBadge scope={scope} creatorName={creatorName} />
        </div>
        <PreviewFrame>
          <div className="rounded-xl bg-[linear-gradient(135deg,color-mix(in_srgb,var(--noodle-accent)_18%,var(--slurp-surface-raised)),color-mix(in_srgb,var(--slurp-violet)_12%,var(--slurp-surface-raised)))] p-4 ring-1 ring-inset ring-[var(--slurp-outline)]">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--noodle-accent)] text-zinc-950">
                {target === "improve" ? (
                  <Sparkles size={18} aria-hidden="true" />
                ) : (
                  <SlidersHorizontal size={18} aria-hidden="true" />
                )}
              </span>
              <div className="min-w-0">
                <h3 className="truncate text-sm font-bold">{SLURP_BACKSTAGE_TARGET_LABELS[target]}</h3>
                <p className="mt-0.5 text-xs leading-5 text-[var(--slurp-muted)] text-pretty" aria-live="polite">
                  {outcomeSummary(t, target, proposed, creatorCount)}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-[var(--slurp-surface-raised)] p-3 ring-1 ring-inset ring-[var(--slurp-outline)]">
              <p className="font-semibold text-[var(--slurp-muted)]">
                {t("ui.slurp.settings.backstage.preview.current", { defaultValue: "Current" })}
              </p>
              <p className="mt-1 font-bold text-pretty">{outcomeSummary(t, target, current, creatorCount)}</p>
            </div>
            <div className="rounded-lg bg-[color-mix(in_srgb,var(--noodle-accent)_9%,var(--slurp-surface-raised))] p-3 ring-1 ring-inset ring-[color-mix(in_srgb,var(--noodle-accent)_25%,transparent)]">
              <p className="font-semibold text-[var(--noodle-accent)]">
                {t("ui.slurp.settings.backstage.preview.proposed", { defaultValue: "Proposed" })}
              </p>
              <p className="mt-1 font-bold">
                {changed.length
                  ? t("ui.slurp.settings.backstage.preview.pending", {
                      defaultValue: "{{count}} pending",
                      count: changed.length,
                    })
                  : t("ui.slurp.settings.backstage.preview.noChanges", { defaultValue: "No changes" })}
              </p>
            </div>
          </div>
          {behavior && (
            <div className="mt-3 rounded-lg bg-[var(--slurp-surface-raised)] p-3 ring-1 ring-inset ring-[var(--slurp-outline)]">
              {behavior}
            </div>
          )}
          {changed.length > 0 && (
            <details className="mt-3 rounded-lg bg-[var(--slurp-surface-raised)] ring-1 ring-inset ring-[var(--slurp-outline)]">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]">
                {t("ui.slurp.settings.backstage.preview.exact", { defaultValue: "Exact field changes" })}
                <ChevronDown size={15} aria-hidden="true" />
              </summary>
              <dl className="border-t border-[var(--slurp-outline)] px-3 py-2 text-xs">
                {changed.map((key) => (
                  <div key={key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-1.5">
                    <dt className="truncate text-[var(--slurp-muted)]">{humanize(key)}</dt>
                    <dd
                      className="max-w-44 truncate font-semibold"
                      title={`${JSON.stringify(current[key])} → ${JSON.stringify(proposed[key])}`}
                    >
                      {typeof proposed[key] === "object"
                        ? t("ui.slurp.settings.backstage.preview.updated", { defaultValue: "Updated" })
                        : `${String(current[key])} → ${String(proposed[key])}`}
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
          <p className="mt-3 text-xs leading-5 text-[var(--slurp-muted)]">
            {t("ui.slurp.settings.backstage.preview.passive", {
              defaultValue: "Passive previews never call a model. Generated samples always ask first.",
            })}
          </p>
        </PreviewFrame>
      </div>
    </aside>
  );
}

export function SlurpBackstageApplyBar({
  count,
  pending,
  onDiscard,
  onApply,
}: {
  count: number;
  pending: boolean;
  onDiscard: () => void;
  onApply: () => void;
}) {
  const { t } = useTranslation();
  if (count === 0) return null;
  return (
    <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 mt-5 flex flex-wrap items-center gap-3 rounded-xl bg-[color-mix(in_srgb,var(--slurp-text)_94%,transparent)] p-3 text-[var(--slurp-canvas)] shadow-[var(--slurp-shadow-floating)] backdrop-blur-xl sm:bottom-3">
      <div className="me-auto min-w-0">
        <h2 className="text-sm font-bold">
          {t("ui.slurp.settings.backstage.apply.title", { defaultValue: "Review and apply" })}
        </h2>
        <p className="text-xs opacity-75" role="status" aria-live="polite">
          {t("ui.slurp.settings.backstage.apply.staged", {
            defaultValue: "{{count}} setting changes staged",
            count,
          })}
        </p>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={onDiscard}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50"
      >
        <X size={16} aria-hidden="true" /> {t("ui.slurp.settings.backstage.apply.discard", { defaultValue: "Discard" })}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={onApply}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-4 text-sm font-black text-zinc-950 shadow-sm hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50"
      >
        <Check size={16} aria-hidden="true" />{" "}
        {t("ui.slurp.settings.backstage.apply.apply", { defaultValue: "Apply changes" })}
      </button>
    </div>
  );
}

// ponytail: one module-level count, since only one Backstage is ever mounted.
let stagedBackstageChanges = 0;

/** Publish the staged-change count so exits outside Backstage can ask first, and guard a reload. */
export function useSlurpBackstageDraftGuard(count: number) {
  useEffect(() => {
    stagedBackstageChanges = count;
    if (count === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      stagedBackstageChanges = 0;
    };
  }, [count]);
}

/** Resolves true when there is nothing staged or the user chooses to discard it. */
export function confirmLeaveSlurpBackstage(
  t: (key: string, options: Record<string, unknown>) => string,
): Promise<boolean> {
  if (stagedBackstageChanges === 0) return Promise.resolve(true);
  return showConfirmDialog({
    title: t("ui.slurp.settings.backstage.leave.title", { defaultValue: "Discard staged changes?" }),
    message: t("ui.slurp.settings.backstage.leave.detail", {
      defaultValue: "You have {{count}} setting changes that are not applied yet.",
      count: stagedBackstageChanges,
    }),
    confirmLabel: t("ui.slurp.settings.backstage.leave.discard", { defaultValue: "Discard" }),
    cancelLabel: t("ui.slurp.settings.backstage.leave.stay", { defaultValue: "Stay" }),
    tone: "destructive",
  });
}

export function resolveBackstageSearchDestination(setting: keyof SlurpSettings) {
  const placement = SLURP_BACKSTAGE_SETTING_PLACEMENT[setting];
  return { section: destinationForTarget(placement.target), target: placement.target };
}
