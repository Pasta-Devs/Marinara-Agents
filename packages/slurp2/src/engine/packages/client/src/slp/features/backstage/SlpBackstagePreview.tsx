import { ChevronDown, SlidersHorizontal, Sparkles } from "lucide-react";
import { useDeferredValue, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { SlurpPromotion } from "../ads/slp-ads-contract";
import type { SlurpSettings } from "../settings/slp-settings-contract";
import { SlurpInlineAd } from "../../../components/slurp/SlurpInlineAd";
import { ProfileInitial } from "../../../components/slurp/SlurpShell";

import { cn } from "../../../lib/utils";
import { humanize } from "./SlpBackstageNavigation";
import { estimateSlurpSimulation } from "../../../components/slurp/slurp-simulation-estimate";
import { slurpActivePlatformEvents } from "../../../../../shared/src/slp/slp-platform-events.js";
import { SLP_BACKSTAGE_SETTING_PLACEMENT } from "./slp-backstage-placement";
import { SLP_BACKSTAGE_TARGET_LABELS, type SlpBackstageTarget } from "../../base/navigation/slp-backstage-target";
import { SlpSettingScopeBadge, type SlpSettingScope } from "../../modules/settings/SlpSettingsKit";

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
export function outcomeSummary(
  t: Translate,
  target: SlpBackstageTarget,
  settings: SlurpSettings,
  creatorCount: number,
) {
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
    case "events":
      return t(key, {
        defaultValue: "{{count}} events · {{active}} running now",
        count: settings.platformEvents.length,
        active: slurpActivePlatformEvents(settings.platformEvents, new Date()).length,
      });
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

/** Sample copy for the preview card. Deterministic and local: a preview never spends a model call. */
function sampleAdPromotion(t: Translate, settings: SlurpSettings): SlurpPromotion {
  return {
    id: "slurp-backstage-sample",
    kind: "inline",
    contentRating: settings.inlineAdsContentCeiling,
    brand: t("ui.slurp.settings.backstage.preview.ads.sampleBrand", { defaultValue: "Bellweather Coffee" }),
    product: t("ui.slurp.settings.backstage.preview.ads.sampleProduct", { defaultValue: "Cold brew subscription" }),
    copy: t(`ui.slurp.settings.backstage.preview.ads.sampleCopy.${settings.inlineAdsTone}`, {
      defaultValue: "Two cups a day, delivered every Friday. Your first box is half price.",
    }),
    categories: settings.inlineAdsPreferredTags.slice(0, 2),
    contextTags: [],
  };
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
      {/* The real feed card, with sample copy: an ad setting is easier to judge as an ad. */}
      {proposed.inlineAdsEnabled && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-semibold text-[var(--slurp-muted)]">
            {t("ui.slurp.settings.backstage.preview.ads.sample", { defaultValue: "Sample ad" })}
          </p>
          <SlurpInlineAd
            promotion={sampleAdPromotion(t, proposed)}
            onAction={() => undefined}
            onHide={() => undefined}
            labels={{
              sponsored: t("ui.slurp.ads.sponsored"),
              hide: t("ui.slurp.ads.hide"),
              hideBrand: t("ui.slurp.ads.hideBrand"),
              actionFallback: t("ui.slurp.ads.view"),
            }}
          />
        </div>
      )}
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
  target: SlpBackstageTarget,
  pending: Partial<SlurpSettings>,
): SlpSettingScope {
  const scopes = new Set(
    (Object.keys(pending) as Array<keyof SlurpSettings>).map((key) => SLP_BACKSTAGE_SETTING_PLACEMENT[key].scope),
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
  creatorProfile,
}: {
  target: SlpBackstageTarget;
  current: SlurpSettings;
  proposed: SlurpSettings;
  pending: Partial<SlurpSettings>;
  creatorCount: number;
  creatorName?: string | null;
  creatorProfile?: {
    displayName: string;
    handle: string;
    bio?: string | null;
    avatarUrl?: string | null;
  } | null;
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
  const sampleCreator = creatorProfile ?? {
    displayName: t("ui.slurp.settings.backstage.preview.sampleCreator", { defaultValue: "Sample Creator" }),
    handle: "sample",
    bio: t("ui.slurp.settings.backstage.preview.sampleBio", {
      defaultValue: "A preview using sample data. Your saved Creator stays unchanged.",
    }),
    avatarUrl: null,
  };
  const visual =
    target === "creators" || target === "improve" ? (
      <article className="mt-3 rounded-xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset ring-[var(--slurp-outline)]">
        <div className="flex items-center gap-3">
          <ProfileInitial profile={sampleCreator} />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-black">{sampleCreator.displayName}</h3>
            <p className="truncate text-xs text-[var(--slurp-muted)]">@{sampleCreator.handle}</p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-[var(--slurp-muted)]">{sampleCreator.bio}</p>
      </article>
    ) : target === "general" ? (
      <article className="mt-3 overflow-hidden rounded-xl bg-[var(--slurp-surface-raised)] ring-1 ring-inset ring-[var(--slurp-outline)]">
        <div className="flex items-center gap-2 p-3">
          <ProfileInitial profile={sampleCreator} />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold">{sampleCreator.displayName}</h3>
            <p className="text-xs text-[var(--slurp-muted)]">@{sampleCreator.handle}</p>
          </div>
        </div>
        <div
          className="aspect-[16/9] bg-[linear-gradient(145deg,color-mix(in_srgb,var(--noodle-accent)_28%,var(--slurp-canvas)),color-mix(in_srgb,var(--slurp-violet)_24%,var(--slurp-canvas)))]"
          aria-hidden="true"
        />
        <p className="p-3 text-xs leading-5">
          {t("ui.slurp.settings.backstage.preview.samplePost", {
            defaultValue: "A representative feed post appears here before the schedule is applied.",
          })}
        </p>
      </article>
    ) : target === "images" ? (
      <figure className="mt-3 rounded-xl bg-[var(--slurp-surface-raised)] p-3 ring-1 ring-inset ring-[var(--slurp-outline)]">
        <div
          className="mx-auto max-h-56 w-full rounded-lg bg-[radial-gradient(circle_at_30%_25%,color-mix(in_srgb,var(--noodle-accent)_55%,transparent),transparent_38%),linear-gradient(145deg,var(--slurp-violet),var(--slurp-canvas))] outline outline-1 -outline-offset-1 outline-white/10"
          style={{ aspectRatio: `${proposed.imageWidth} / ${proposed.imageHeight}` }}
          role="img"
          aria-label={t("ui.slurp.settings.backstage.preview.imageShape", { defaultValue: "Proposed image shape" })}
        />
        <figcaption className="mt-2 text-center text-xs text-[var(--slurp-muted)] tabular-nums">
          {proposed.imageWidth} × {proposed.imageHeight}
        </figcaption>
      </figure>
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
          <SlpSettingScopeBadge scope={scope} creatorName={creatorName} />
        </div>
        <PreviewFrame>
          <div className="rounded-xl bg-[linear-gradient(135deg,color-mix(in_srgb,var(--noodle-accent)_18%,var(--slurp-surface-raised)),color-mix(in_srgb,var(--slurp-violet)_12%,var(--slurp-surface-raised)))] p-4 ring-1 ring-inset ring-[var(--slurp-outline)]">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--noodle-accent)] text-zinc-950 [&_svg]:!text-zinc-950">
                {target === "improve" ? (
                  <Sparkles size={18} aria-hidden="true" />
                ) : (
                  <SlidersHorizontal size={18} aria-hidden="true" />
                )}
              </span>
              <div className="min-w-0">
                <h3 className="truncate text-sm font-bold">{SLP_BACKSTAGE_TARGET_LABELS[target]}</h3>
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
          {visual}
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
