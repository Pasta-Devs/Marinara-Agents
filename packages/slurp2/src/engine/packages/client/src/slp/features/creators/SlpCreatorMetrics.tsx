import { useState } from "react";

import type { SlpCreatorManagedStageProfile } from "../../../../../shared/src/slp/slp-social.types.js";

import { Avatar } from "../../base/chrome/SlpChrome";

import { noteClass, selectClass } from "./slp-creator-classes";
import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";

import type { SlurpCreatorMetrics } from "./slp-creators-contract";

type Translate = SlpBackstagePageProps["t"];
const METRIC_KEYS = ["posts", "followers", "subscribers", "likes", "replies", "earnings", "unread", "arcs"] as const;
const metricLabel = (t: Translate, key: (typeof METRIC_KEYS)[number]) =>
  t(`ui.slurp.settings.creators.metrics.${key}`, {
    defaultValue: {
      posts: "Posts",
      followers: "Followers",
      subscribers: "Subs",
      likes: "Likes",
      replies: "Replies",
      earnings: "Earned",
      unread: "Unread",
      arcs: "Storylines",
    }[key],
  });
const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });

/** Totals across every Creator, so running many of them stays manageable. */
export function CreatorMetricsTotals({ metrics, t }: { metrics: SlurpCreatorMetrics[]; t: Translate }) {
  if (metrics.length === 0) return null;
  return (
    <dl className="grid grid-cols-4 gap-2 rounded-xl bg-[var(--slurp-surface-raised)] p-3 ring-1 ring-inset ring-[var(--slurp-outline)] sm:grid-cols-8">
      {METRIC_KEYS.map((key) => (
        <div key={key} className="min-w-0">
          <dt className="truncate text-[0.68rem] font-semibold text-[var(--slurp-muted)]">{metricLabel(t, key)}</dt>
          <dd className="text-sm font-bold tabular-nums">
            {compact.format(metrics.reduce((sum, entry) => sum + entry[key], 0))}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function CreatorMetricsRow({ metrics, t }: { metrics: SlurpCreatorMetrics | undefined; t: Translate }) {
  if (!metrics) return null;
  return (
    <span className="hidden shrink-0 text-end lg:block">
      <span className="block text-sm font-bold tabular-nums">{compact.format(metrics.posts)}</span>
      <span className="block text-[0.62rem] text-[var(--slurp-muted)]">{metricLabel(t, "posts")}</span>
    </span>
  );
}

type Collab = SlpBackstagePageProps["settings"]["creatorCollabs"][number];
const pairKey = (a: string, b: string) => [a, b].sort().join("|");

/**
 * Which other Creators this one may collab with, and what each pair makes. A collab happens as a
 * shared arc: automatic crossovers pick a listed partner first.
 */
export function CreatorCollabsEditor({
  creator,
  creators,
  collabs,
  onSave,
  t,
}: {
  creator: SlpCreatorManagedStageProfile;
  creators: SlpCreatorManagedStageProfile[];
  collabs: Collab[];
  onSave: (next: Collab[]) => unknown;
  t: Translate;
}) {
  const others = creators.filter((entry) => entry.id !== creator.id);
  const byPair = new Map(collabs.map((collab) => [pairKey(collab.creatorIds[0], collab.creatorIds[1]), collab]));
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const toggle = (partnerId: string) => {
    const key = pairKey(creator.id, partnerId);
    void onSave(
      byPair.has(key)
        ? collabs.filter((collab) => pairKey(collab.creatorIds[0], collab.creatorIds[1]) !== key)
        : [...collabs, { creatorIds: [creator.id, partnerId], content: "" }],
    );
  };
  const saveContent = (partnerId: string) => {
    const key = pairKey(creator.id, partnerId);
    const content = drafts[key];
    if (content === undefined || content === byPair.get(key)?.content) return;
    void onSave(
      collabs.map((collab) =>
        pairKey(collab.creatorIds[0], collab.creatorIds[1]) === key ? { ...collab, content } : collab,
      ),
    );
  };
  if (others.length === 0)
    return (
      <p className={noteClass}>
        {t("ui.slurp.settings.creators.collabsNone", { defaultValue: "Add another Creator to set up collabs." })}
      </p>
    );
  return (
    <div className="space-y-2">
      <p className={noteClass}>
        {t("ui.slurp.settings.creators.collabsDetail", {
          defaultValue:
            "Pick who this Creator may collab with and what they make together. Collabs happen as shared arcs; automatic crossovers choose a partner from this list first.",
        })}
      </p>
      {others.map((partner) => {
        const key = pairKey(creator.id, partner.id);
        const collab = byPair.get(key);
        return (
          <div key={partner.id} className="space-y-2 rounded-lg p-2 ring-1 ring-inset ring-[var(--slurp-outline)]">
            <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={Boolean(collab)}
                onChange={() => toggle(partner.id)}
                className="size-4 accent-[var(--noodle-accent)]"
              />
              <Avatar account={partner} size="sm" />
              <span className="min-w-0 flex-1 truncate">{partner.displayName}</span>
            </label>
            {collab && (
              <input
                value={drafts[key] ?? collab.content}
                maxLength={600}
                onChange={(event) => setDrafts((current) => ({ ...current, [key]: event.target.value }))}
                onBlur={() => saveContent(partner.id)}
                placeholder={t("ui.slurp.settings.creators.collabContent", {
                  defaultValue: "What they make together, e.g. joint photo sets, shoutouts, a cooking stream",
                })}
                aria-label={t("ui.slurp.settings.creators.collabContentLabel", {
                  defaultValue: "Collab content with {{name}}",
                  name: partner.displayName,
                })}
                className={selectClass}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
