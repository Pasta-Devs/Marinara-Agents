import { Activity, BookOpen, Image, MessageCircle, Sparkles, UsersRound, RefreshCw } from "lucide-react";

import { BackstagePageHeader, SummaryRow } from "../../modules/settings/SlpSettingsKit";
import { outcomeSummary } from "./SlpBackstagePreview";
import type { SlpBackstageTarget } from "../../base/navigation/slp-backstage-target";

import type { SlpBackstagePageProps } from "./slp-backstage-contract";

/** Automation landing page: what Slurp does by itself, with a pause switch for each. */
export function SlpBackstageAutomationPanel(page: SlpBackstagePageProps) {
  const {
    t,
    settings,
    guidanceLevel,
    update,
    connectionsQuery,
    imagesReady,
    openRefresh,
    refreshCreators,
    refreshFans,
    refreshConversationSchedule,
    schedulesRefreshing,
    setSchedulesRefreshing,
  } = page;
  const go = (section: "world" | "automation" | "prompts", next: SlpBackstageTarget) =>
    page.onNavigate({ ...page.navigation, section, target: next });
  const onOff = (value: boolean) => (value ? t("ui.slurp.settings.overview.on") : t("ui.slurp.settings.overview.off"));
  const pauseLabel = (value: boolean) =>
    value
      ? t("ui.slurp.settings.backstage.landing.pause", { defaultValue: "Pause" })
      : t("ui.slurp.settings.backstage.landing.resume", { defaultValue: "Turn on" });
  const textConnection = (connectionsQuery.data ?? []).find(
    (connection) => connection.id === settings.generationConnectionId,
  );
  return (
    <div className="space-y-4">
      <BackstagePageHeader
        title={t("ui.slurp.settings.backstage.sections.automation")}
        detail={t("ui.slurp.settings.backstage.landing.automationDetail", {
          defaultValue: "What Slurp does by itself. Pause anything here, or open it to change how it works.",
        })}
        scope="all-slurp"
      />
      <div className="rounded-xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset ring-[var(--slurp-outline)] sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">
              {t("ui.slurp.settings.manual.title", { defaultValue: "Manual actions" })}
            </h2>
            <p className="mt-1 text-xs text-[var(--slurp-muted)]">
              {t("ui.slurp.settings.manual.detail", { defaultValue: "Run Slurp actions only when you choose." })}
            </p>
          </div>
          <RefreshCw size={18} className="text-[var(--noodle-accent)]" aria-hidden="true" />
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={refreshCreators.isPending}
            onClick={openRefresh}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--slurp-outline)] px-3 text-xs font-semibold hover:bg-[var(--slurp-canvas)] disabled:opacity-50"
          >
            <Sparkles size={14} aria-hidden="true" />
            {t("ui.slurp.settings.manual.posts", { defaultValue: "Create posts now" })}
          </button>
          <button
            type="button"
            disabled={refreshFans.isPending}
            onClick={() => refreshFans.mutate()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--slurp-outline)] px-3 text-xs font-semibold hover:bg-[var(--slurp-canvas)] disabled:opacity-50"
          >
            <UsersRound size={14} aria-hidden="true" />
            {t("ui.slurp.settings.manual.audience", { defaultValue: "Run audience activity" })}
          </button>
          <button
            type="button"
            disabled={schedulesRefreshing || page.automationCreators.length === 0}
            onClick={async () => {
              // One at a time: each refresh is a model call, and a second click must not start another round.
              setSchedulesRefreshing(true);
              try {
                for (const creator of page.automationCreators) {
                  await refreshConversationSchedule.mutateAsync(creator.id).catch(() => undefined);
                }
              } finally {
                setSchedulesRefreshing(false);
              }
            }}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--slurp-outline)] px-3 text-xs font-semibold hover:bg-[var(--slurp-canvas)] disabled:opacity-50"
          >
            <MessageCircle size={14} aria-hidden="true" />
            {t("ui.slurp.settings.manual.schedules", { defaultValue: "Refresh schedules" })}
          </button>
          <button
            type="button"
            disabled={page.imageEnabledCreators.length === 0}
            onClick={() => go("automation", "images")}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--slurp-outline)] px-3 text-xs font-semibold hover:bg-[var(--slurp-canvas)] disabled:opacity-50"
          >
            <Image size={14} aria-hidden="true" />
            {t("ui.slurp.settings.manual.images", { defaultValue: "Manage image runs" })}
          </button>
        </div>
      </div>
      <SummaryRow
        icon={<Activity size={20} />}
        title={t("ui.slurp.settings.backstage.landing.publishing", { defaultValue: "Automatic publishing" })}
        status={onOff(settings.autoPostingScheduleEnabled)}
        tone={settings.autoPostingScheduleEnabled ? "ok" : "off"}
        value={`${outcomeSummary(t, "general", settings, page.creators.length)} · ${t(
          "ui.slurp.settings.overview.autoPostingCreators",
          { count: page.autoPostingCreators.length },
        )}`}
        action={pauseLabel(settings.autoPostingScheduleEnabled)}
        onAction={() => void update("autoPostingScheduleEnabled", !settings.autoPostingScheduleEnabled)}
        onOpen={() => go("automation", "general")}
      />
      <SummaryRow
        icon={<Image size={20} />}
        title={t("ui.slurp.settings.backstage.landing.images", { defaultValue: "Image generation" })}
        status={imagesReady ? t("ui.slurp.settings.overview.ready") : t("ui.slurp.settings.overview.needsSetup")}
        tone={imagesReady ? "ok" : "warning"}
        value={`${t("ui.slurp.settings.overview.imageCreators", { count: page.imageEnabledCreators.length })} · ${page.imageConnectionLabel}`}
        onOpen={() => go("automation", "images")}
      />
      <SummaryRow
        icon={<UsersRound size={20} />}
        title={t("ui.slurp.settings.backstage.landing.fans", { defaultValue: "Audience activity" })}
        status={onOff(settings.fanActivityEnabled)}
        tone={settings.fanActivityEnabled ? "ok" : "off"}
        value={t("ui.slurp.settings.overview.audienceRuns", { count: settings.fanActivityRunsPerDay })}
        action={pauseLabel(settings.fanActivityEnabled)}
        onAction={() => void update("fanActivityEnabled", !settings.fanActivityEnabled)}
        onOpen={() => go("world", "audience")}
      />
      <SummaryRow
        icon={<MessageCircle size={20} />}
        title={t("ui.slurp.settings.backstage.landing.away", { defaultValue: "Replies while away" })}
        status={onOff(settings.messagesAwayRepliesEnabled)}
        tone={settings.messagesAwayRepliesEnabled ? "ok" : "off"}
        value={t("ui.slurp.settings.backstage.landing.awayValue", {
          defaultValue: "Longest wait {{minutes}} min",
          minutes: settings.messagesMaxReplyDelayMinutes,
        })}
        action={pauseLabel(settings.messagesAwayRepliesEnabled)}
        onAction={() => void update("messagesAwayRepliesEnabled", !settings.messagesAwayRepliesEnabled)}
        onOpen={() => go("world", "messaging")}
      />
      <SummaryRow
        icon={<BookOpen size={20} />}
        title={t("ui.slurp.settings.backstage.landing.arcs", { defaultValue: "Automatic story arcs" })}
        status={t(
          `ui.slurp.settings.arcAutoMode${settings.arcAutoMode === "off" ? "Off" : settings.arcAutoMode === "suggest" ? "Suggest" : "Auto"}`,
        )}
        tone={settings.arcAutoMode === "auto" ? "ok" : settings.arcAutoMode === "suggest" ? "info" : "off"}
        value={t(
          `ui.slurp.settings.arcPace${settings.arcPace === "slow" ? "Slow" : settings.arcPace === "fast" ? "Fast" : "Normal"}`,
        )}
        onOpen={() => go("world", "arcs")}
      />
      <SummaryRow
        icon={<Sparkles size={20} />}
        title={t("ui.slurp.settings.backstage.landing.writing", { defaultValue: "AI writing" })}
        status={
          textConnection ? t("ui.slurp.settings.overview.ready") : t("ui.slurp.settings.connections.engineDefault")
        }
        tone={textConnection ? "ok" : "info"}
        value={`${textConnection ? (textConnection.name ?? textConnection.model ?? textConnection.id) : t("ui.slurp.settings.connections.engineDefault")} · ${
          guidanceLevel ? t(`ui.slurp.settings.prompts.spice.${guidanceLevel}`) : t("ui.slurp.settings.presets.custom")
        }`}
        onOpen={() => go("prompts", "prompts")}
      />
    </div>
  );
}
