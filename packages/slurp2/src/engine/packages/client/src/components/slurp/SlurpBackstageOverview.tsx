import { Activity, ChevronRight, FileText, Image, Megaphone, Play, UsersRound } from "lucide-react";
import { Toggle } from "./SlurpSettingsControls";
import { slurpAudiencePresetFor } from "../../../../server/src/services/slurp/slurp-tuning.js";
import type { SlurpBackstagePageProps } from "./SlurpSettings";
import { OverviewCard, OverviewActivity } from "./SlurpBackstageWorkflow";

/** Overview: the control room summary and the quick toggles that save immediately. */
export function SlurpBackstageOverview(page: SlurpBackstagePageProps) {
  const {
    navigation,
    onNavigate,
    t,
    section,
    target,
    settings,
    update,
    accountsQuery,
    fanStatusQuery,
    reserveStatusQuery,
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
  } = page;
  return (
    <>
      {section === "overview" && (
        <div className="space-y-4">
          <section className="relative isolate overflow-hidden rounded-xl bg-[var(--slurp-hero)] p-4 text-white shadow-[0_30px_70px_-38px_rgba(184,28,102,0.9)] sm:p-5">
            <span
              className="pointer-events-none absolute -end-12 -top-20 -z-10 h-64 w-64 rounded-full border-[2rem] border-white/10"
              aria-hidden="true"
            />
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/75">
                  {t("ui.slurp.settings.overview.eyebrow")}
                </p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-balance sm:text-2xl">
                  {automaticPublishingActive
                    ? t("ui.slurp.settings.overview.live")
                    : t("ui.slurp.settings.overview.paused")}
                </h2>
                <p className="mt-1 max-w-xl text-xs leading-5 text-white/85 text-pretty">
                  {automaticPublishingActive
                    ? t("ui.slurp.settings.overview.liveDetail", {
                        posts: settings.postsPerDay,
                        count: autoPostingCreators.length,
                      })
                    : t("ui.slurp.settings.overview.pausedDetail")}
                </p>
              </div>
              <button
                type="button"
                disabled={accountsQuery.isLoading || accountsQuery.isError || automationCreators.length === 0}
                onClick={openRefresh}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-[#791444] shadow-lg transition-[opacity,transform] hover:opacity-90 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#9f1f5c] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-50"
              >
                <Play size={15} fill="currentColor" aria-hidden="true" />
                {t("ui.slurp.settings.overview.runNow")}
              </button>
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

          <div className="grid gap-3 lg:grid-cols-2">
            <OverviewCard
              icon={<Activity size={21} aria-hidden="true" />}
              title={t("ui.slurp.settings.tabs.publishing")}
              status={paceLabel}
              details={[
                settings.autoPostingScheduleEnabled
                  ? t("ui.slurp.settings.overview.postsPerDay", { count: settings.postsPerDay })
                  : t("ui.slurp.settings.overview.manualOnly"),
                settings.nightQuiet
                  ? t("ui.slurp.settings.overview.quietHoursOn")
                  : t("ui.slurp.settings.overview.quietHoursOff"),
              ]}
              onClick={() => onNavigate({ ...navigation, section: "automation", target: "general" })}
              tone="pink"
            />
            <OverviewCard
              icon={<UsersRound size={21} aria-hidden="true" />}
              title={t("ui.slurp.settings.tabs.creators")}
              status={t("ui.slurp.settings.overview.autoPostingCreators", {
                count: autoPostingCreators.length,
              })}
              details={[t("ui.slurp.settings.overview.totalCreators", { count: creators.length })]}
              avatars={creators.slice(0, 4)}
              onClick={() => onNavigate({ ...navigation, section: "creators", target: "creators" })}
              tone="violet"
            />
            <OverviewCard
              icon={<Image size={21} aria-hidden="true" />}
              title={t("ui.slurp.settings.tabs.images")}
              status={imagesReady ? t("ui.slurp.settings.overview.ready") : t("ui.slurp.settings.overview.needsSetup")}
              details={[
                t("ui.slurp.settings.overview.imageCreators", { count: imageEnabledCreators.length }),
                imageConnections.length > 0 ? imageConnectionLabel : t("ui.slurp.settings.overview.noImageConnection"),
              ]}
              onClick={() => onNavigate({ ...navigation, section: "automation", target: "images" })}
              tone="blue"
              healthy={imagesReady}
            />
            <OverviewCard
              icon={<Megaphone size={21} aria-hidden="true" />}
              title={t("ui.slurp.settings.tabs.audience")}
              status={
                settings.fanActivityEnabled ? t("ui.slurp.settings.overview.on") : t("ui.slurp.settings.overview.off")
              }
              details={[
                t(`ui.slurp.settings.simulation.presets.${slurpAudiencePresetFor(settings)}`),
                t("ui.slurp.settings.overview.audienceActions"),
              ]}
              onClick={() => onNavigate({ ...navigation, section: "world", target: "audience" })}
              tone="coral"
              healthy={settings.fanActivityEnabled}
            />
          </div>

          <Toggle
            label={t("ui.slurp.settings.inlinePromotions")}
            detail={t("ui.slurp.settings.inlinePromotionsDetail")}
            value={settings.inlineAdsEnabled}
            onChange={(value) => update("inlineAdsEnabled", value)}
          />

          <button
            type="button"
            onClick={() => onNavigate({ ...navigation, section: "automation", target: "general" })}
            className="flex min-h-14 w-full items-center gap-3 rounded-xl bg-[var(--slurp-surface-raised)] px-4 text-start ring-1 ring-inset ring-[var(--slurp-outline)] transition-[background-color,transform] hover:bg-[color-mix(in_srgb,var(--noodle-accent)_8%,var(--slurp-surface-raised))] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            <FileText size={18} className="shrink-0 text-[var(--slurp-violet)]" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{t("ui.slurp.settings.overview.generation")}</span>
              <span className="block text-xs text-[var(--slurp-muted)]">
                {t("ui.slurp.settings.overview.generationDetail")}
              </span>
            </span>
            <ChevronRight size={18} className="shrink-0 rtl:rotate-180" aria-hidden="true" />
          </button>
        </div>
      )}
    </>
  );
}
