import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  HardDrive,
  Image,
  Megaphone,
  MessageCircle,
  Play,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { nextSlurpAutopurgeRunAt } from "../../../../../shared/src/slp/slp-autopurge-time.js";
import { Toggle } from "../../modules/settings/SlpSettingsControls";
import { slurpAudiencePresetFor } from "../../../../../shared/src/slp/slp-tuning.js";
import type { SlpBackstagePageProps } from "./slp-backstage-contract";
import type { SlpBackstageSection, SlpBackstageTarget } from "../../base/navigation/slp-backstage-target";
import { formatDateTime } from "../../base/ui/slp-date-time";
import { formatBytes } from "../../modules/settings/slp-backstage-format";
import { OverviewCard, OverviewActivity } from "../../modules/settings/SlpBackstageKit";

type AttentionItem = { id: string; label: string; section: SlpBackstageSection; target: SlpBackstageTarget };

const panelClass =
  "min-w-0 rounded-xl bg-[var(--slurp-surface-raised)] p-3 sm:p-4 ring-1 ring-inset ring-[var(--slurp-outline)]";
const rowClass =
  "flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-start text-sm transition-colors hover:bg-[var(--slurp-canvas)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none";

/** Overview: status, what needs attention, and the quick switches that save at once. */
export function SlpBackstageOverviewPanel(page: SlpBackstagePageProps) {
  const {
    navigation,
    onNavigate,
    t,
    i18n,
    settings,
    update,
    updatePatch,
    accountsQuery,
    connectionsQuery,
    fanStatusQuery,
    reserveStatusQuery,
    maintenanceSummary,
    refreshFans,
    refreshCreators,
    imageConnections,
    automationCreators,
    creators,
    autoPostingCreators,
    automaticPublishingActive,
    imageEnabledCreators,
    imagesReady,
    imageConnectionLabel,
    paceLabel,
    openRefresh,
    refreshConversationSchedule,
    schedulesRefreshing,
    setSchedulesRefreshing,
  } = page;
  // One at a time: each refresh is a model call, and a second click must not start another round.
  const refreshSchedules = async () => {
    setSchedulesRefreshing(true);
    let failed = 0;
    try {
      for (const creator of automationCreators) {
        await refreshConversationSchedule
          .mutateAsync({ accountId: creator.id, quiet: true })
          .catch(() => (failed += 1));
      }
      (failed ? toast.error : toast.success)(
        t("ui.slurp.settings.manual.schedulesDone", {
          defaultValue: "Schedules refreshed for {{done}} of {{total}} Creators.",
          done: automationCreators.length - failed,
          total: automationCreators.length,
        }),
      );
    } finally {
      setSchedulesRefreshing(false);
    }
  };
  const heroSecondary =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-white ring-1 ring-inset ring-white/35 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50";

  const go = (nextSection: SlpBackstageSection, target: SlpBackstageTarget) =>
    onNavigate({ ...navigation, section: nextSection, target });

  const nextPost = (reserveStatusQuery.data?.creators ?? [])
    .map((creator) => creator.nextPreparedAt)
    .filter((value): value is string => Boolean(value))
    .sort()[0];

  const textConnections = (connectionsQuery.data ?? []).filter(
    (connection) => connection.provider !== "image_generation",
  );
  const attention: AttentionItem[] = [];
  if (connectionsQuery.isSuccess && textConnections.length === 0) {
    attention.push({
      id: "text",
      label: t("ui.slurp.settings.overview.attention.noText", { defaultValue: "No text connection is set up" }),
      section: "models",
      target: "connections",
    });
  }
  if (imageEnabledCreators.length > 0 && connectionsQuery.isSuccess && imageConnections.length === 0) {
    attention.push({
      id: "images",
      label: t("ui.slurp.settings.overview.attention.noImages", {
        defaultValue: "Images are on for {{count}} Creators, but no image connection exists",
        count: imageEnabledCreators.length,
      }),
      section: "models",
      target: "images",
    });
  }
  for (const creator of creators) {
    if (creator.appearanceState.source === "missing" || creator.appearanceState.needsReview) {
      attention.push({
        id: `appearance-${creator.id}`,
        label: `${creator.displayName}: ${t(creator.appearanceState.source === "missing" ? "ui.slurp.appearance.missing" : "ui.slurp.appearance.reviewNeeded")}`,
        section: "creators",
        target: "creators",
      });
    }
    if (creator.sourceStatus.state === "missing" || creator.sourceStatus.state === "changed") {
      attention.push({
        id: `source-${creator.id}`,
        label: `${creator.displayName}: ${t(`ui.slurp.settings.creators.sourceStatus.${creator.sourceStatus.state}`)}`,
        section: "creators",
        target: "creators",
      });
    }
  }

  return (
    <div className="space-y-4">
      <section className="relative isolate overflow-hidden rounded-xl bg-[var(--slurp-hero)] p-4 text-white shadow-[0_30px_70px_-38px_rgba(184,28,102,0.9)] sm:p-5">
        <span
          className="pointer-events-none absolute -end-12 -top-20 -z-10 h-64 w-64 rounded-full border-[2rem] border-white/10"
          aria-hidden="true"
        />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/75">
              {t("ui.slurp.settings.overview.eyebrow")}
            </p>
            <h1 className="mt-1 text-xl font-black tracking-tight text-balance sm:text-2xl">
              {automaticPublishingActive
                ? t("ui.slurp.settings.overview.live")
                : t("ui.slurp.settings.overview.paused")}
            </h1>
            <p className="mt-1 max-w-xl text-xs leading-5 text-white/85 text-pretty">
              {automaticPublishingActive
                ? t("ui.slurp.settings.overview.liveDetail", {
                    posts: settings.postsPerDay,
                    count: autoPostingCreators.length,
                  })
                : t("ui.slurp.settings.overview.pausedDetail")}
            </p>
            <p className="mt-2 text-xs font-semibold text-white">
              {nextPost
                ? t("ui.slurp.settings.overview.nextUp", {
                    defaultValue: "Next post: {{time}}",
                    time: formatDateTime(nextPost, i18n.language),
                  })
                : t("ui.slurp.settings.overview.nextUpNone", { defaultValue: "No post is prepared yet" })}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <button
              type="button"
              disabled={accountsQuery.isLoading || accountsQuery.isError || automationCreators.length === 0}
              onClick={openRefresh}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-[#791444] shadow-lg transition-[opacity,transform] hover:opacity-90 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#9f1f5c] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-50"
            >
              <Play size={15} fill="currentColor" aria-hidden="true" />
              {t("ui.slurp.settings.overview.runNow")}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={refreshFans.isPending}
                onClick={() => refreshFans.mutate()}
                className={heroSecondary}
              >
                <UsersRound size={15} aria-hidden="true" />
                {t("ui.slurp.settings.overview.runFans", { defaultValue: "Fans now" })}
              </button>
              <button
                type="button"
                disabled={schedulesRefreshing || automationCreators.length === 0}
                onClick={() => void refreshSchedules()}
                className={heroSecondary}
              >
                <MessageCircle size={15} aria-hidden="true" />
                {t("ui.slurp.settings.overview.runSchedules", { defaultValue: "Schedules" })}
              </button>
            </div>
          </div>
        </div>
        {attention.length === 0 && (
          <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-white/85">
            <CheckCircle2 size={14} aria-hidden="true" />
            {t("ui.slurp.settings.overview.attention.none", { defaultValue: "Nothing needs your attention." })}
          </p>
        )}
      </section>

      {attention.length > 0 && (
        <section className={`${panelClass} ring-[var(--slurp-warning)]/35`} aria-labelledby="slurp-overview-attention">
          <h2 id="slurp-overview-attention" className="flex items-center gap-2 text-sm font-black">
            <AlertTriangle size={16} className="text-[var(--slurp-warning)]" aria-hidden="true" />
            {t("ui.slurp.settings.overview.attention.title", { defaultValue: "Needs attention" })}
          </h2>
          <ul className="mt-2 space-y-0.5">
            {attention.slice(0, 6).map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => go(item.section, item.target)} className={rowClass}>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <ChevronRight size={16} className="shrink-0 rtl:rotate-180" aria-hidden="true" />
                </button>
              </li>
            ))}
            {attention.length > 6 && (
              <li className="px-3 pt-1 text-xs text-[var(--slurp-muted)]">
                {t("ui.slurp.settings.overview.attention.more", {
                  defaultValue: "{{count}} more",
                  count: attention.length - 6,
                })}
              </li>
            )}
          </ul>
        </section>
      )}

      <section className={panelClass} aria-labelledby="slurp-overview-quick">
        <h2 id="slurp-overview-quick" className="text-sm font-black">
          {t("ui.slurp.settings.overview.quick.title", { defaultValue: "Quick switches" })}
        </h2>
        <p className="mt-0.5 text-xs text-[var(--slurp-muted)]">
          {t("ui.slurp.settings.overview.quick.detail", { defaultValue: "These save at once. You can undo." })}
        </p>
        <div className="mt-2 grid gap-x-8 sm:grid-cols-2">
          <Toggle
            compact
            label={t("ui.slurp.settings.overview.quick.publishing", { defaultValue: "Automatic publishing" })}
            value={settings.autoPostingScheduleEnabled}
            onChange={(value) => void update("autoPostingScheduleEnabled", value)}
          />
          <Toggle
            compact
            label={t("ui.slurp.settings.overview.quick.fans", { defaultValue: "Fan activity" })}
            value={settings.fanActivityEnabled}
            onChange={(value) => void update("fanActivityEnabled", value)}
          />
          <Toggle
            compact
            label={t("ui.slurp.settings.inlinePromotions")}
            value={settings.inlineAdsEnabled}
            onChange={(value) => void update("inlineAdsEnabled", value)}
          />
          <Toggle
            compact
            label={t("ui.slurp.settings.backstage.landing.away", { defaultValue: "Replies while away" })}
            value={settings.messagesAwayRepliesEnabled}
            onChange={(value) => void update("messagesAwayRepliesEnabled", value)}
          />
          <Toggle
            compact
            label={t("ui.slurp.settings.overview.quick.cleanup", { defaultValue: "Automatic cleanup" })}
            value={settings.autopurgeEnabled}
            onChange={(enabled) => {
              const existing = settings.autopurgeNextRunAt;
              const nextRunAt =
                enabled && (!existing || Date.parse(existing) <= Date.now())
                  ? nextSlurpAutopurgeRunAt(settings)
                  : existing;
              void updatePatch({ autopurgeEnabled: enabled, autopurgeNextRunAt: enabled ? nextRunAt : null });
            }}
          />
        </div>
      </section>

      <OverviewActivity
        reserveStatus={reserveStatusQuery.data}
        reserveLoading={reserveStatusQuery.isLoading}
        reserveError={reserveStatusQuery.isError}
        fanStatus={fanStatusQuery.data}
        refreshPending={refreshCreators.isPending || refreshFans.isPending}
        onRetry={() => {
          void reserveStatusQuery.refetch();
          void fanStatusQuery.refetch();
        }}
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <OverviewCard
          icon={<Activity size={21} aria-hidden="true" />}
          title={t("ui.slurp.settings.overview.cards.publishing", { defaultValue: "Publishing" })}
          status={paceLabel}
          details={[
            settings.autoPostingScheduleEnabled
              ? t("ui.slurp.settings.overview.postsPerDay", { count: settings.postsPerDay })
              : t("ui.slurp.settings.overview.manualOnly"),
            settings.nightQuiet
              ? t("ui.slurp.settings.overview.quietHoursOn")
              : t("ui.slurp.settings.overview.quietHoursOff"),
          ]}
          onClick={() => go("automation", "general")}
          tone="pink"
        />
        <OverviewCard
          icon={<UsersRound size={21} aria-hidden="true" />}
          title={t("ui.slurp.settings.backstage.sections.creators")}
          status={t("ui.slurp.settings.overview.autoPostingCreators", { count: autoPostingCreators.length })}
          details={[t("ui.slurp.settings.overview.totalCreators", { count: creators.length })]}
          avatars={autoPostingCreators.slice(0, 4)}
          avatarTotal={autoPostingCreators.length}
          onClick={() => go("creators", "creators")}
          tone="violet"
        />
        <OverviewCard
          icon={<Image size={21} aria-hidden="true" />}
          title={t("ui.slurp.settings.overview.cards.images", { defaultValue: "Images" })}
          status={imagesReady ? t("ui.slurp.settings.overview.ready") : t("ui.slurp.settings.overview.needsSetup")}
          details={[
            t("ui.slurp.settings.overview.imageCreators", { count: imageEnabledCreators.length }),
            imageConnections.length > 0 ? imageConnectionLabel : t("ui.slurp.settings.overview.noImageConnection"),
          ]}
          onClick={() => go("models", "images")}
          tone="blue"
          healthy={imagesReady}
        />
        <OverviewCard
          icon={<Megaphone size={21} aria-hidden="true" />}
          title={t("ui.slurp.settings.overview.cards.audience", { defaultValue: "Audience" })}
          status={
            settings.fanActivityEnabled ? t("ui.slurp.settings.overview.on") : t("ui.slurp.settings.overview.off")
          }
          details={[
            t(`ui.slurp.settings.simulation.presets.${slurpAudiencePresetFor(settings)}`),
            t("ui.slurp.settings.overview.audienceActions"),
          ]}
          onClick={() => go("fans", "audience")}
          tone="coral"
          healthy={settings.fanActivityEnabled}
        />
        <OverviewCard
          icon={<BookOpen size={21} aria-hidden="true" />}
          title={t("ui.slurp.settings.backstage.landing.planAutomation", { defaultValue: "Storylines" })}
          status={t(
            `ui.slurp.settings.arcAutoMode${settings.arcAutoMode === "off" ? "Off" : settings.arcAutoMode === "suggest" ? "Suggest" : "Auto"}`,
          )}
          details={[
            t(
              `ui.slurp.settings.arcPace${settings.arcPace === "slow" ? "Slow" : settings.arcPace === "fast" ? "Fast" : "Normal"}`,
            ),
          ]}
          onClick={() => go("content", "storylines")}
          tone="violet"
        />
        <OverviewCard
          icon={<MessageCircle size={21} aria-hidden="true" />}
          title={t("ui.slurp.settings.backstage.landing.away", { defaultValue: "Replies while away" })}
          status={
            settings.messagesAwayRepliesEnabled
              ? t("ui.slurp.settings.overview.on")
              : t("ui.slurp.settings.overview.off")
          }
          details={[
            t("ui.slurp.settings.backstage.landing.awayValue", {
              defaultValue: "Longest wait {{minutes}} min",
              minutes: settings.messagesMaxReplyDelayMinutes,
            }),
          ]}
          onClick={() => go("fans", "messaging")}
          tone="pink"
        />
      </div>

      <button type="button" onClick={() => go("maintenance", "autopurge")} className={`${panelClass} ${rowClass}`}>
        <HardDrive size={18} className="shrink-0 text-[var(--slurp-violet)]" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block font-bold">
            {t("ui.slurp.settings.overview.storage.title", { defaultValue: "Storage" })}
          </span>
          <span className="block text-xs text-[var(--slurp-muted)]">
            {maintenanceSummary.data
              ? t("ui.slurp.settings.overview.storage.detail", {
                  defaultValue: "{{size}} of media in {{files}} files · automatic cleanup {{state}}",
                  size: formatBytes(maintenanceSummary.data.media.bytes),
                  files: maintenanceSummary.data.media.files,
                  state: settings.autopurgeEnabled
                    ? t("ui.slurp.settings.overview.on")
                    : t("ui.slurp.settings.overview.off"),
                })
              : maintenanceSummary.isError
                ? t("ui.slurp.settings.overview.activity.notAvailable")
                : "…"}
          </span>
        </span>
        <ChevronRight size={18} className="shrink-0 rtl:rotate-180" aria-hidden="true" />
      </button>
    </div>
  );
}
