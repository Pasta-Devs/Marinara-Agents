import { useEffect } from "react";
import { CheckCircle2, ListChecks, Loader2, Search, Settings2, Sparkles, UsersRound } from "lucide-react";
import type { SlpCreatorManagedStageProfile } from "../../../../../shared/src/slp/slp-social.types.js";
import { SlurpCreatorBulkEdit } from "./SlpCreatorBulkEdit";
import { formatDateTime } from "../../base/ui/slp-date-time";
import { Avatar } from "../../base/chrome/SlpChrome";

import { accentButton, focusRing, quietButton } from "./slp-creator-classes";
import { CreatorMetricsRow, CreatorMetricsTotals } from "./SlpCreatorMetrics";
import type { SlpCreatorFilter } from "./slp-creators-backstage-contract";
import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";
import { BackstagePageHeader } from "../../modules/settings/SlpSettingsKit";
import { SlpContinuityOverview } from "./SlpContinuityOverview";
import { useSlurpCreatorMetrics } from "./slp-creators-hooks";
import { SLP_CREATOR_SETTING_TAB } from "./settings/slp-creator-settings-contract";
import { openSlpCreatorSettings } from "./settings/slp-creator-settings-store";

const CREATOR_FILTERS: readonly SlpCreatorFilter[] = ["all", "active", "paused", "attention"];

function needsAttention(creator: SlpCreatorManagedStageProfile) {
  return (
    creator.sourceStatus.state === "missing" ||
    creator.sourceStatus.state === "changed" ||
    creator.appearanceState.source === "missing" ||
    creator.appearanceState.needsReview
  );
}

function attentionReasons(creator: SlpCreatorManagedStageProfile, t: SlpBackstagePageProps["t"]) {
  const reasons = [];
  if (creator.sourceStatus.state === "missing") reasons.push(t("ui.slurp.settings.creators.sourceMissing"));
  else if (creator.sourceStatus.state === "changed") reasons.push(t("ui.slurp.settings.creators.sourceChanged"));
  if (creator.appearanceState.source === "missing") reasons.push(t("ui.slurp.appearance.missing"));
  else if (creator.appearanceState.needsReview) reasons.push(t("ui.slurp.appearance.reviewNeeded"));
  return reasons;
}

/**
 * Creators: a searchable directory, bulk edit, and the way in to one Creator's settings.
 *
 * The per-Creator detail used to expand under its row here, which put half of a Creator's settings
 * on this page and the other half behind two dialogs on their profile. Opening a row now opens the
 * one settings modal, so this page stays what it is good at: finding a Creator among many.
 */
export function SlpCreatorsPanel(page: SlpBackstagePageProps) {
  const {
    navigation,
    onNavigate,
    onAddCreators,
    t,
    i18n,
    settings,
    bulkCreatorIds,
    setBulkCreatorIds,
    accountsQuery,
    reserveStatusQuery,
    creators,
    creatorQuery: query,
    setCreatorQuery: setQuery,
    creatorFilter: filter,
    setCreatorFilter: setFilter,
  } = page;
  const metricsQuery = useSlurpCreatorMetrics(true);
  const metricsById = new Map((metricsQuery.data?.creators ?? []).map((entry) => [entry.id, entry]));

  const needle = query.trim().toLowerCase();
  const visibleCreators = creators.filter((creator) => {
    if (needle && !`${creator.displayName} ${creator.handle}`.toLowerCase().includes(needle)) return false;
    if (filter === "active") return creator.autoPosting.enabled;
    if (filter === "paused") return !creator.autoPosting.enabled;
    if (filter === "attention") return needsAttention(creator);
    return true;
  });
  const filterCount = (value: SlpCreatorFilter) =>
    value === "all"
      ? creators.length
      : value === "active"
        ? creators.filter((creator) => creator.autoPosting.enabled).length
        : value === "paused"
          ? creators.filter((creator) => !creator.autoPosting.enabled).length
          : creators.filter(needsAttention).length;
  const openImprove = () => onNavigate({ ...navigation, section: "creators", target: "improve" });

  // Two one-shot deep links: the continuity shortcut, and a settings search result whose setting
  // lives inside the modal. Both open it on the tab that owns what was asked for.
  const continuityCreatorId = navigation.continuityCreatorId;
  const settingKey = navigation.settingKey;
  useEffect(() => {
    if (continuityCreatorId) {
      openSlpCreatorSettings(continuityCreatorId, { tab: "continuity" });
      onNavigate({ ...navigation, continuityCreatorId: undefined });
      return;
    }
    const tab = settingKey ? SLP_CREATOR_SETTING_TAB[settingKey] : undefined;
    if (!tab) return;
    const first = creators[0];
    if (!first) return;
    openSlpCreatorSettings(first.id, { tab, settingKey });
    onNavigate({ ...navigation, settingKey: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot deep links
  }, [continuityCreatorId, settingKey, creators.length]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <BackstagePageHeader
          title={t("ui.slurp.settings.creators.title")}
          detail={t("ui.slurp.settings.creators.detail")}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={bulkCreatorIds !== null}
            onClick={() => setBulkCreatorIds((ids) => (ids ? null : new Set()))}
            className={quietButton}
          >
            <ListChecks size={14} aria-hidden="true" />
            {t(bulkCreatorIds ? "ui.slurp.settings.creators.selectDone" : "ui.slurp.settings.creators.select")}
          </button>
          <button type="button" onClick={onAddCreators} className={accentButton}>
            <UsersRound size={14} aria-hidden="true" />
            {t("ui.slurp.settings.creators.add")}
          </button>
          <button type="button" onClick={openImprove} className={quietButton}>
            <Sparkles size={14} className="text-[var(--noodle-accent)]" aria-hidden="true" />
            {t("ui.slurp.settings.creators.improve", { defaultValue: "Improve with AI" })}
          </button>
        </div>
      </div>

      {bulkCreatorIds && creators.length ? (
        <div className="space-y-3">
          <div
            className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--slurp-surface-raised)] p-3 text-xs ring-1 ring-inset ring-[var(--slurp-outline)]"
            aria-live="polite"
          >
            <span className="me-auto font-semibold">
              {t("ui.slurp.settings.creators.selectedCount", { count: bulkCreatorIds.size })}
            </span>
            <button
              type="button"
              onClick={() => setBulkCreatorIds(new Set(visibleCreators.map((creator) => creator.id)))}
              className={quietButton}
            >
              {t("ui.slurp.settings.creators.selectAll")}
            </button>
            <button
              type="button"
              disabled={bulkCreatorIds.size === 0}
              onClick={() => setBulkCreatorIds(new Set())}
              className={quietButton}
            >
              {t("ui.slurp.settings.creators.bulk.clear")}
            </button>
          </div>
          {bulkCreatorIds.size > 0 && (
            <SlurpCreatorBulkEdit
              creators={creators.filter((creator) => bulkCreatorIds.has(creator.id))}
              tagOptions={settings.discoveryTags.map((entry) => entry.tag)}
            />
          )}
        </div>
      ) : null}

      {accountsQuery.isLoading ? (
        <div className="flex justify-center py-10 text-[var(--slurp-muted)]" role="status">
          <Loader2 size={20} className="animate-spin motion-reduce:animate-none" />
        </div>
      ) : accountsQuery.isError ? (
        <div className="rounded-xl bg-[var(--slurp-danger)]/10 p-5 text-sm ring-1 ring-inset ring-[var(--slurp-danger)]/25">
          <p>{t("ui.slurp.settings.creators.loadError")}</p>
          <button type="button" onClick={() => void accountsQuery.refetch()} className={`mt-3 ${quietButton}`}>
            {t("capabilities.actions.tryAgain")}
          </button>
        </div>
      ) : creators.length ? (
        <div className="min-w-0 space-y-3">
          <CreatorMetricsTotals metrics={metricsQuery.data?.creators ?? []} t={t} />
          <label className="relative block">
            <span className="sr-only">
              {t("ui.slurp.settings.creators.search", { defaultValue: "Search Creators" })}
            </span>
            <Search
              size={16}
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--slurp-muted)]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("ui.slurp.settings.creators.search", { defaultValue: "Search Creators" })}
              className={`min-h-11 w-full rounded-lg bg-[var(--slurp-surface-raised)] ps-9 pe-3 text-base ring-1 ring-inset ring-[var(--slurp-outline)] sm:text-sm ${focusRing}`}
            />
          </label>
          <div
            className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]"
            role="group"
            aria-label={t("ui.slurp.settings.creators.filterLabel", { defaultValue: "Filter Creators" })}
          >
            {CREATOR_FILTERS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ring-1 ring-inset ${focusRing} ${filter === value ? "bg-[var(--noodle-accent)]/15 text-[var(--noodle-accent-foreground)] ring-[var(--noodle-accent)]/50" : "ring-[var(--slurp-outline)] hover:bg-[var(--slurp-surface-raised)]"}`}
              >
                {t(`ui.slurp.settings.creators.filters.${value}`)}
                <span className="tabular-nums text-[var(--slurp-muted)]">{filterCount(value)}</span>
              </button>
            ))}
          </div>
          <div className="rounded-xl bg-[var(--slurp-surface-raised)] ring-1 ring-inset ring-[var(--slurp-outline)]">
            {visibleCreators.length === 0 && (
              <p className="p-5 text-center text-xs text-[var(--slurp-muted)]">
                {t("ui.slurp.settings.creators.noMatches", { defaultValue: "No Creators match." })}
              </p>
            )}
            {visibleCreators.map((creator) => {
              const status = reserveStatusQuery.data?.creators.find((entry) => entry.accountId === creator.id);
              const selected = bulkCreatorIds ? bulkCreatorIds.has(creator.id) : false;
              const attention = needsAttention(creator);
              const reasons = attentionReasons(creator, t);
              return (
                <button
                  key={creator.id}
                  type="button"
                  aria-pressed={bulkCreatorIds ? selected : undefined}
                  onClick={() =>
                    bulkCreatorIds
                      ? setBulkCreatorIds((ids) => {
                          const next = new Set(ids ?? []);
                          if (next.has(creator.id)) next.delete(creator.id);
                          else next.add(creator.id);
                          return next;
                        })
                      : openSlpCreatorSettings(creator.id)
                  }
                  className={`flex min-h-16 w-full items-center gap-3 border-b border-[var(--slurp-outline)] px-3 py-2.5 text-start transition-colors last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none ${selected ? "bg-[var(--noodle-accent)]/10" : "hover:bg-[var(--slurp-canvas)]"}`}
                >
                  {bulkCreatorIds && (
                    <CheckCircle2
                      size={18}
                      aria-hidden="true"
                      className={selected ? "text-[var(--noodle-accent)]" : "text-[var(--slurp-muted)]/40"}
                    />
                  )}
                  <Avatar account={creator} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{creator.displayName}</span>
                    <span className="block truncate text-xs text-[var(--slurp-muted)]">
                      {status?.nextPreparedAt
                        ? t("ui.slurp.settings.creators.nextPost", {
                            date: formatDateTime(status.nextPreparedAt, i18n.language),
                          })
                        : `@${creator.handle}`}
                    </span>
                    {/* An older week keeps repeating, so this is a hint to refresh it, not a warning. */}
                    {creator.scheduleStatus?.state === "stale" && (
                      <span className="mt-0.5 block truncate text-[0.68rem] text-[var(--slurp-muted)]">
                        {t("ui.slurp.settings.creators.scheduleStale")}
                      </span>
                    )}
                    {reasons.length > 0 && (
                      <span className="mt-0.5 block truncate text-[0.68rem] font-semibold text-[var(--slurp-warning)]">
                        {reasons.join(" · ")}
                      </span>
                    )}
                  </span>
                  <CreatorMetricsRow metrics={metricsById.get(creator.id)} t={t} />
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[0.68rem] font-semibold ring-1 ring-inset ${attention ? "text-[var(--slurp-warning)] ring-[var(--slurp-warning)]/30" : creator.autoPosting.enabled ? "text-[var(--slurp-success)] ring-[var(--slurp-success)]/30" : "text-[var(--slurp-muted)] ring-[var(--slurp-outline)]"}`}
                  >
                    {attention
                      ? t("ui.slurp.settings.creators.filters.attention")
                      : creator.autoPosting.enabled
                        ? t("ui.slurp.settings.creators.filters.active")
                        : t("ui.slurp.settings.creators.filters.paused")}
                  </span>
                  {!bulkCreatorIds && (
                    <Settings2 size={16} aria-hidden="true" className="shrink-0 text-[var(--slurp-muted)]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-xl p-8 text-center text-sm text-[var(--slurp-muted)] ring-1 ring-inset ring-dashed ring-[var(--slurp-outline)]">
          {t("ui.slurp.settings.creators.none")}
        </div>
      )}
      {!bulkCreatorIds && creators.length > 0 && (
        <SlpContinuityOverview onOpen={(creatorId) => openSlpCreatorSettings(creatorId, { tab: "continuity" })} />
      )}
    </div>
  );
}
