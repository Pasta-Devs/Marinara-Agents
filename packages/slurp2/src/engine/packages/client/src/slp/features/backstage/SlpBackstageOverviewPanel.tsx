import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Gauge,
  Globe2,
  HardDrive,
  Headset,
  Image,
  Link2,
  Megaphone,
  MessageCircle,
  Pause,
  Play,
  Radio,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SlpStirGlyph } from "../../base/chrome/SlpGlyphs";
import { SettingAnchor } from "../../modules/settings/SlpSettingsKit";
import { slurpAudiencePresetFor } from "../../../../../shared/src/slp/slp-tuning.js";
import type { SlpBackstagePageProps } from "./slp-backstage-contract";
import type { SlpBackstageSection, SlpBackstageTarget } from "../../base/navigation/slp-backstage-target";
import { formatDateTime } from "../../base/ui/slp-date-time";
import { formatBytes } from "../../modules/settings/slp-backstage-format";
import { OverviewCard, OverviewActivity } from "../../modules/settings/SlpBackstageKit";
import { CompactSwitch } from "../../modules/settings/SlpSettingsControls";
import { slpExtensionOn } from "../../../../../shared/src/slp/slp-extensions.js";
import { markSlpSwitchedOnNoteSeen, slpSwitchedOnNoteSeen } from "../../base/state/slp-switched-on-note";

type AttentionItem = { id: string; label: string; section: SlpBackstageSection; target: SlpBackstageTarget };

const panelClass =
  "min-w-0 rounded-xl bg-[var(--slurp-surface-raised)] p-3 sm:p-4 ring-1 ring-inset ring-[var(--slurp-outline)]";
const rowClass =
  "flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-start text-sm transition-colors hover:bg-[var(--slurp-canvas)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none";

/** Overview: status, what needs attention, and what Basic and each extension do right now. */
export function SlpBackstageOverviewPanel(page: SlpBackstagePageProps) {
  const [switchedOnNote, setSwitchedOnNote] = useState(() => !slpSwitchedOnNoteSeen());
  const {
    navigation,
    onNavigate,
    t,
    i18n,
    settings,
    update,
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
      section: "basic",
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
      section: "basic",
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

  const onOff = (value: boolean) => t(value ? "ui.slurp.settings.overview.on" : "ui.slurp.settings.overview.off");
  const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
  const tx = (key: string, defaultValue: string, values?: Record<string, unknown>) =>
    t(`ui.slurp.settings.overview.yours.${key}`, { defaultValue, ...values });
  const extensions: {
    id: string;
    title: string;
    status: string;
    Icon: LucideIcon | typeof SlpStirGlyph;
    open: () => void;
    /** The extension's switch; only an extension whose gate is built has one (CONFIGURATOR.md). */
    toggle?: { on: boolean; set: (on: boolean) => void };
  }[] = [
    {
      id: "basic",
      title: tx("basic", "Basic"),
      status: tx("basicStatus", "Always on: Creators, feed, pictures, Stories, fans, messages, coins"),
      Icon: Gauge,
      open: () => go("basic", "basic"),
    },
    {
      id: "ads",
      title: tx("ads", "Brands & ads"),
      status: slpExtensionOn(settings, "ads")
        ? tx("adsStatus", "Ads: {{ads}} · Brand deals: {{deals}}", {
            ads: settings.inlineAdsEnabled
              ? t(`ui.slurp.settings.ads.frequency${cap(settings.inlineAdsFrequency)}`)
              : onOff(false),
            deals: t(`ui.slurp.settings.ads.dealsPace${cap(settings.brandDealsPace ?? "normal")}`),
          })
        : onOff(false),
      Icon: Megaphone,
      open: () => go("ads", "ads"),
      toggle: { on: slpExtensionOn(settings, "ads"), set: (on) => void update("extAds", on) },
    },
    {
      id: "storylines",
      title: tx("storylines", "Storylines"),
      status: slpExtensionOn(settings, "storylines")
        ? tx("storylinesStatus", "New storylines: {{mode}} · {{count}} dramas on", {
            mode: t(`ui.slurp.settings.arcAutoMode${cap(settings.arcAutoMode)}`),
            count: settings.drama.enabled.length,
          })
        : onOff(false),
      Icon: BookOpen,
      open: () => go("content", "storylines"),
      toggle: { on: slpExtensionOn(settings, "storylines"), set: (on) => void update("extStorylines", on) },
    },
    {
      id: "world",
      title: tx("world", "Living world"),
      status: slpExtensionOn(settings, "world")
        ? tx("worldStatus", "{{count}} occasions on the calendar", { count: settings.platformEvents.length })
        : onOff(false),
      Icon: Globe2,
      open: () => go("world", "events"),
      toggle: { on: slpExtensionOn(settings, "world"), set: (on) => void update("extWorld", on) },
    },
    {
      id: "stir",
      title: tx("stir", "Stir"),
      status: slpExtensionOn(settings, "stir")
        ? tx("stirOnStatus", "The lever deck and the planner in the Stir tab")
        : onOff(false),
      Icon: SlpStirGlyph,
      // Off, the tab is gone: the row opens the Backstage page with the switch.
      open: () =>
        slpExtensionOn(settings, "stir") ? onNavigate({ mode: "creator", view: "stir" }) : go("stir", "stir"),
      toggle: { on: slpExtensionOn(settings, "stir"), set: (on) => void update("extStir", on) },
    },
    {
      id: "desk",
      title: tx("desk", "Support desk"),
      status: slpExtensionOn(settings, "supportDesk")
        ? tx("deskStatus", "Creators write in: {{pace}}", {
            pace: t(`ui.slurp.stir.settings.ticketPace.${settings.supportDesk.tickets}`),
          })
        : onOff(false),
      Icon: Headset,
      open: () => go("stir", "stir"),
      toggle: { on: slpExtensionOn(settings, "supportDesk"), set: (on) => void update("extSupportDesk", on) },
    },
    {
      id: "live",
      title: tx("live", "Live shows"),
      status: slpExtensionOn(settings, "live") ? tx("liveOnStatus", "Creators go live, and you can too") : onOff(false),
      Icon: Radio,
      open: () => go("live", "live"),
      toggle: { on: slpExtensionOn(settings, "live"), set: (on) => void update("extLive", on) },
    },
    {
      id: "engine",
      title: tx("engine", "Engine link"),
      status:
        settings.carryoverModes.length > 0
          ? tx("engineOn", "Your chats remember Slurp in {{count}} chat modes", {
              count: settings.carryoverModes.length,
            })
          : tx("engineOff", "Your chats do not hear about Slurp"),
      Icon: Link2,
      open: () => go("engine", "engine"),
    },
  ];

  return (
    <div className="space-y-4">
      <section className="relative isolate overflow-hidden rounded-xl bg-[image:var(--slurp-hero)] p-4 text-white shadow-[0_30px_70px_-38px_rgba(184,28,102,0.9)] sm:p-5">
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
              {settings.paused
                ? t("ui.slurp.settings.overview.pause.title", { defaultValue: "Slurp is paused" })
                : automaticPublishingActive
                  ? t("ui.slurp.settings.overview.live")
                  : t("ui.slurp.settings.overview.paused")}
            </h1>
            <p className="mt-1 max-w-xl text-xs leading-5 text-white/85 text-pretty">
              {settings.paused
                ? t("ui.slurp.settings.overview.pause.detail", {
                    defaultValue:
                      "No AI calls, no posts, no fans and no messages. Everything waits here until you resume.",
                  })
                : automaticPublishingActive
                  ? t("ui.slurp.settings.overview.liveDetail", {
                      posts: settings.postsPerDay,
                      count: autoPostingCreators.length,
                    })
                  : t("ui.slurp.settings.overview.pausedDetail")}
            </p>
            <p className={settings.paused ? "hidden" : "mt-2 text-xs font-semibold text-white"}>
              {nextPost
                ? t("ui.slurp.settings.overview.nextUp", {
                    defaultValue: "Next post: {{time}}",
                    time: formatDateTime(nextPost, i18n.language),
                  })
                : t("ui.slurp.settings.overview.nextUpNone", { defaultValue: "No post is prepared yet" })}
            </p>
          </div>
          <SettingAnchor settingKey="paused">
            {settings.paused ? (
              // Paused: the one thing to do here is to switch it back on. The run buttons all call the AI.
              <button
                type="button"
                onClick={() => void update("paused", false)}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-[#791444] shadow-lg transition-[opacity,transform] hover:opacity-90 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#9f1f5c] motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                <Play size={15} fill="currentColor" aria-hidden="true" />
                {t("ui.slurp.settings.overview.pause.resume", { defaultValue: "Resume Slurp" })}
              </button>
            ) : (
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
                <button type="button" onClick={() => void update("paused", true)} className={heroSecondary}>
                  <Pause size={15} aria-hidden="true" />
                  {t("ui.slurp.settings.overview.pause.label", { defaultValue: "Pause all" })}
                </button>
              </div>
            )}
          </SettingAnchor>
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
          onClick={() => go("basic", "general")}
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
          onClick={() => go("basic", "images")}
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
          onClick={() => go("basic", "audience")}
          tone="coral"
          healthy={settings.fanActivityEnabled}
        />
      </div>

      {/* Your Slurp: Basic plus each extension, with what it does right now and its switch. Installs from
          before the switches see "What's switched on" once (docs/CONFIGURATOR.md, Existing installs). */}
      <section className={panelClass} aria-labelledby="slurp-overview-yours">
        <h2 id="slurp-overview-yours" className="text-sm font-black">
          {t("ui.slurp.settings.overview.yours.title", { defaultValue: "Your Slurp" })}
        </h2>
        {switchedOnNote && settings.onboarding === "completed" && (
          <div
            role="note"
            className="mt-2 flex flex-col gap-2 rounded-lg bg-[var(--slurp-canvas)] p-3 text-xs leading-5 sm:flex-row sm:items-center"
          >
            <p className="min-w-0 flex-1 text-pretty">
              <span className="block font-bold">{t("ui.slurp.settings.overview.switchedOn.title")}</span>
              {t("ui.slurp.settings.overview.switchedOn.detail")}
            </p>
            <button
              type="button"
              onClick={() => {
                markSlpSwitchedOnNoteSeen();
                setSwitchedOnNote(false);
              }}
              className="min-h-11 shrink-0 rounded-full px-4 text-sm font-bold text-[var(--slurp-violet)] ring-1 ring-inset ring-[var(--slurp-outline)] hover:bg-[var(--slurp-surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
            >
              {t("ui.slurp.settings.overview.switchedOn.gotIt")}
            </button>
          </div>
        )}
        <ul className="mt-2 space-y-0.5">
          {extensions.map((item) => (
            <li key={item.id} className="flex items-center gap-1">
              <button type="button" onClick={item.open} className={`${rowClass} min-w-0 flex-1`}>
                <item.Icon size={18} className="shrink-0 text-[var(--slurp-violet)]" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{item.title}</span>
                  <span className="block truncate text-xs text-[var(--slurp-muted)]">{item.status}</span>
                </span>
                <ChevronRight size={16} className="shrink-0 rtl:rotate-180" aria-hidden="true" />
              </button>
              {item.toggle && <CompactSwitch label={item.title} value={item.toggle.on} onChange={item.toggle.set} />}
            </li>
          ))}
        </ul>
      </section>

      <button type="button" onClick={() => go("basic", "autopurge")} className={`${panelClass} ${rowClass}`}>
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
