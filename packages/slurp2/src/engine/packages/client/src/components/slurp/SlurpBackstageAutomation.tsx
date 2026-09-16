import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  FileText,
  Image,
  MessageCircle,
  Sparkles,
  UsersRound,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { Field, GuidanceBox, NumberSetting, SectionTitle, Toggle } from "./SlurpSettingsControls";
import { toast } from "sonner";
import { BackstagePageHeader, BackstageWizard, SettingAnchor, SummaryRow } from "./SlurpBackstageKit";
import { outcomeSummary } from "./SlurpBackstageChrome";
import type { SlurpBackstageTarget } from "./slurp-backstage";
import { type SlurpSettings } from "../../hooks/use-slurp";
import { SLURP_ACTIVITY_PRESETS, slurpActivityPresetPatch, slurpPostsPerDayForPreset } from "./slurp-activity-presets";
import type { SlurpBackstagePageProps } from "./SlurpSettings";
import { errorMessage } from "./SlurpBackstageWorkflow";

/** Automation: publishing, writing guidance, and image generation. */
export function SlurpBackstageAutomation(page: SlurpBackstagePageProps) {
  const {
    t,
    updateSettings,
    target,
    settings,
    guidanceLevel,
    customPaceOpen,
    setCustomPaceOpen,
    update,
    updatePatch,
    accountsQuery,
    imageSettingsQuery,
    updateImages,
    connectionsQuery,
    imageConnections,
    imageSettings,
    activityPreset,
    imagesReady,
    openRefresh,
    refreshCreators,
    refreshFans,
    refreshConversationSchedule,
  } = page;
  const [paceWizardOpen, setPaceWizardOpen] = useState(false);
  const [imageWizardOpen, setImageWizardOpen] = useState(false);
  const [imageDraft, setImageDraft] = useState<Pick<
    SlurpSettings,
    "imageContextMode" | "autoPostingImagesEnabled" | "allowGalleryImageAttachments" | "imageWidth" | "imageHeight"
  > | null>(null);
  const [paceDraft, setPaceDraft] = useState<{
    preset: (typeof SLURP_ACTIVITY_PRESETS)[number] | null;
    postsPerDay: number;
    nightQuiet: boolean;
    storyRate: SlurpSettings["storyRate"];
  } | null>(null);
  // One patch, written only on Apply, so a half-finished wizard never leaves mixed settings behind.
  const pacePatch: Partial<SlurpSettings> = paceDraft
    ? {
        ...(paceDraft.preset ? slurpActivityPresetPatch(paceDraft.preset) : { postsPerDay: paceDraft.postsPerDay }),
        nightQuiet: paceDraft.nightQuiet,
        storyRate: paceDraft.storyRate,
      }
    : {};
  const go = (section: "world" | "automation" | "prompts", next: SlurpBackstageTarget) =>
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
    <>
      {target === "automation" && (
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
                disabled={refreshConversationSchedule.isPending || page.automationCreators.length === 0}
                onClick={() =>
                  page.automationCreators.forEach((creator) => refreshConversationSchedule.mutate(creator.id))
                }
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
              guidanceLevel
                ? t(`ui.slurp.settings.prompts.spice.${guidanceLevel}`)
                : t("ui.slurp.settings.presets.custom")
            }`}
            onOpen={() => go("prompts", "prompts")}
          />
        </div>
      )}

      {target === "general" && (
        <div className="space-y-4">
          <BackstagePageHeader
            title={t("ui.slurp.settings.publishing.title")}
            detail={t("ui.slurp.settings.publishing.detail")}
            scope="all-slurp"
          />
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[var(--slurp-surface-raised,var(--background))] p-4 shadow-sm ring-1 ring-inset ring-[var(--border)] sm:p-5">
            <div>
              <h2 className="text-sm font-semibold">{t("ui.slurp.settings.refresh.title")}</h2>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">{t("ui.slurp.settings.refresh.detail")}</p>
            </div>
            <button
              type="button"
              disabled={accountsQuery.isLoading || accountsQuery.isError}
              onClick={openRefresh}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 shadow-sm transition-[opacity,transform] hover:opacity-90 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-50"
            >
              <Sparkles size={14} />
              {t("ui.slurp.settings.refresh.title")}
            </button>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold">{t("ui.slurp.settings.publishing.pace")}</h2>
              <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted)]">
                {t("ui.slurp.settings.publishing.howDetail")}
              </p>
            </div>
            <button
              type="button"
              aria-expanded={paceWizardOpen}
              onClick={() => {
                setPaceDraft({
                  preset: activityPreset,
                  postsPerDay: settings.postsPerDay,
                  nightQuiet: settings.nightQuiet,
                  storyRate: settings.storyRate,
                });
                setPaceWizardOpen((open) => !open);
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-semibold ring-1 ring-inset ring-[var(--slurp-outline)] hover:bg-[var(--slurp-canvas)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
            >
              <Sparkles size={14} className="text-[var(--noodle-accent)]" aria-hidden="true" />
              {t("ui.slurp.settings.backstage.wizard.paceTitle", { defaultValue: "Set Slurp’s pace" })}
            </button>
          </div>
          {paceWizardOpen && paceDraft && (
            <BackstageWizard
              title={t("ui.slurp.settings.backstage.wizard.paceTitle", { defaultValue: "Set Slurp’s pace" })}
              preset={paceDraft.preset}
              presetLabel={(preset) => t(`ui.slurp.settings.presets.${preset}`)}
              current={settings}
              proposed={{ ...settings, ...pacePatch }}
              patch={pacePatch}
              pending={updateSettings.isPending}
              onCancel={() => setPaceWizardOpen(false)}
              onApply={(patch) => {
                void updatePatch(patch);
                setPaceWizardOpen(false);
              }}
              steps={[
                {
                  id: "pace",
                  title: t("ui.slurp.settings.backstage.wizard.paceStep", {
                    defaultValue: "How often does Slurp post?",
                  }),
                  content: (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {SLURP_ACTIVITY_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          aria-pressed={paceDraft.preset === preset}
                          onClick={() =>
                            setPaceDraft({
                              ...paceDraft,
                              preset,
                              postsPerDay: slurpPostsPerDayForPreset(preset) || paceDraft.postsPerDay,
                            })
                          }
                          className={`min-h-16 rounded-lg p-3 text-start text-sm ring-1 ring-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] ${paceDraft.preset === preset ? "bg-[var(--slurp-nav-active)] ring-[var(--noodle-accent)]/45" : "bg-[var(--slurp-surface-raised)] ring-[var(--slurp-outline)]"}`}
                        >
                          <span className="block font-semibold">{t(`ui.slurp.settings.presets.${preset}`)}</span>
                          <span className="mt-0.5 block text-xs text-[var(--slurp-muted)]">
                            {preset === "manual"
                              ? t("ui.slurp.settings.presets.manualDetail")
                              : t("ui.slurp.settings.presets.postsDetail", {
                                  count: slurpPostsPerDayForPreset(preset),
                                })}
                          </span>
                        </button>
                      ))}
                    </div>
                  ),
                },
                {
                  id: "quiet",
                  title: t("ui.slurp.settings.backstage.wizard.quietStep", { defaultValue: "Quiet hours and Stories" }),
                  content: (
                    <div className="space-y-3">
                      <Toggle
                        label={t("ui.slurp.settings.quietHours")}
                        detail={t("ui.slurp.settings.quietHoursDetail")}
                        value={paceDraft.nightQuiet}
                        onChange={(value) => setPaceDraft({ ...paceDraft, nightQuiet: value })}
                      />
                      <Field label={t("ui.slurp.settings.storyRate")} detail={t("ui.slurp.settings.storyRateDetail")}>
                        <select
                          value={paceDraft.storyRate}
                          onChange={(event) =>
                            setPaceDraft({
                              ...paceDraft,
                              storyRate: event.target.value as SlurpSettings["storyRate"],
                            })
                          }
                          className="min-h-11 w-full rounded-lg bg-[var(--slurp-canvas)] px-3 text-base ring-1 ring-inset ring-[var(--slurp-outline)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-sm"
                        >
                          <option value="off">{t("ui.slurp.settings.storyRateOff")}</option>
                          <option value="rare">{t("ui.slurp.settings.storyRateRare")}</option>
                          <option value="regular">{t("ui.slurp.settings.storyRateRegular")}</option>
                          <option value="often">{t("ui.slurp.settings.storyRateOften")}</option>
                        </select>
                      </Field>
                    </div>
                  ),
                },
              ]}
            />
          )}
          <SettingAnchor settingKey="autoPostingScheduleEnabled">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {SLURP_ACTIVITY_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={activityPreset === preset}
                  disabled={updateSettings.isPending}
                  onClick={() => {
                    setCustomPaceOpen(false);
                    void updatePatch(slurpActivityPresetPatch(preset));
                  }}
                  className={`min-h-20 rounded-xl p-4 text-start ring-1 ring-inset transition-[background-color,transform] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-50 ${!customPaceOpen && activityPreset === preset ? "bg-[var(--slurp-nav-active)] ring-[var(--noodle-accent)]/45" : "bg-[var(--slurp-surface-raised)] ring-[var(--slurp-outline)] hover:bg-[color-mix(in_srgb,var(--noodle-accent)_7%,var(--slurp-surface-raised))]"}`}
                >
                  <span className="block text-sm font-semibold">{t(`ui.slurp.settings.presets.${preset}`)}</span>
                  <span className="mt-1 block text-xs text-[var(--muted-foreground)]">
                    {preset === "manual"
                      ? t("ui.slurp.settings.presets.manualDetail")
                      : t("ui.slurp.settings.presets.postsDetail", {
                          count: slurpPostsPerDayForPreset(preset),
                        })}
                  </span>
                </button>
              ))}
              <button
                type="button"
                aria-pressed={customPaceOpen || activityPreset === null}
                disabled={updateSettings.isPending}
                onClick={() => setCustomPaceOpen(true)}
                className={`min-h-20 rounded-xl p-4 text-start ring-1 ring-inset transition-[background-color,transform] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-50 ${customPaceOpen || activityPreset === null ? "bg-[var(--slurp-nav-active)] ring-[var(--noodle-accent)]/45" : "bg-[var(--slurp-surface-raised)] ring-[var(--slurp-outline)] hover:bg-[color-mix(in_srgb,var(--noodle-accent)_7%,var(--slurp-surface-raised))]"}`}
              >
                <span className="block text-sm font-semibold">{t("ui.slurp.settings.presets.custom")}</span>
                <span className="mt-1 block text-xs text-[var(--slurp-muted)]">
                  {t("ui.slurp.settings.presets.customDetail")}
                </span>
              </button>
            </div>
          </SettingAnchor>
          {(customPaceOpen || activityPreset === null) && (
            <Field
              settingKey="postsPerDay"
              label={t("ui.slurp.settings.postsPerDay")}
              detail={t("ui.slurp.settings.postsPerDayDetail")}
            >
              <NumberSetting
                value={settings.postsPerDay}
                min={1}
                max={96}
                onSave={(value) => updatePatch({ autoPostingScheduleEnabled: true, postsPerDay: value })}
              />
            </Field>
          )}
          {settings.autoPostingScheduleEnabled && (
            <Field
              settingKey="storyRate"
              label={t("ui.slurp.settings.storyRate")}
              detail={t("ui.slurp.settings.storyRateDetail")}
            >
              <select
                value={settings.storyRate}
                disabled={updateSettings.isPending}
                onChange={(event) => void update("storyRate", event.target.value as SlurpSettings["storyRate"])}
                className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
              >
                <option value="off">{t("ui.slurp.settings.storyRateOff")}</option>
                <option value="rare">{t("ui.slurp.settings.storyRateRare")}</option>
                <option value="regular">{t("ui.slurp.settings.storyRateRegular")}</option>
                <option value="often">{t("ui.slurp.settings.storyRateOften")}</option>
              </select>
            </Field>
          )}
          {settings.autoPostingScheduleEnabled ? (
            <Toggle
              settingKey="nightQuiet"
              label={t("ui.slurp.settings.quietHours")}
              detail={t("ui.slurp.settings.quietHoursDetail")}
              value={settings.nightQuiet}
              onChange={(value) => update("nightQuiet", value)}
            />
          ) : (
            <GuidanceBox
              title={t("ui.slurp.settings.publishing.manualTitle")}
              detail={t("ui.slurp.settings.publishing.manualDetail")}
            />
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              settingKey="postMaxLength"
              label={t("ui.slurp.settings.postMaxLength")}
              detail={t("ui.slurp.settings.postMaxLengthDetail")}
            >
              <NumberSetting
                value={settings.postMaxLength}
                min={300}
                max={4000}
                onSave={(value) => update("postMaxLength", value)}
              />
            </Field>
            <Field
              settingKey="postShowMoreLength"
              label={t("ui.slurp.settings.postShowMoreLength")}
              detail={t("ui.slurp.settings.postShowMoreLengthDetail")}
            >
              <NumberSetting
                value={settings.postShowMoreLength}
                min={100}
                max={4000}
                onSave={(value) => update("postShowMoreLength", value)}
              />
            </Field>
          </div>
          <div className="space-y-3">
            <SectionTitle
              title={t("ui.slurp.settings.carryover.title")}
              detail={t("ui.slurp.settings.carryover.detail")}
            />
            {(["conversation", "roleplay", "game"] as const).map((mode) => (
              <Toggle
                settingKey="carryoverModes"
                key={mode}
                compact
                label={t(`ui.slurp.settings.carryover.${mode}`)}
                value={settings.carryoverModes.includes(mode)}
                onChange={(value) =>
                  update(
                    "carryoverModes",
                    value
                      ? [...settings.carryoverModes.filter((entry) => entry !== mode), mode]
                      : settings.carryoverModes.filter((entry) => entry !== mode),
                  )
                }
              />
            ))}
            {settings.carryoverModes.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  settingKey="carryoverHours"
                  label={t("ui.slurp.settings.carryover.hours")}
                  detail={t("ui.slurp.settings.carryover.hoursDetail")}
                >
                  <NumberSetting
                    value={settings.carryoverHours}
                    min={1}
                    max={24 * 365}
                    onSave={(value) => update("carryoverHours", value)}
                  />
                </Field>
                <Field
                  settingKey="carryoverMaxItems"
                  label={t("ui.slurp.settings.carryover.maxItems")}
                  detail={t("ui.slurp.settings.carryover.maxItemsDetail")}
                >
                  <NumberSetting
                    value={settings.carryoverMaxItems}
                    min={1}
                    max={100}
                    onSave={(value) => update("carryoverMaxItems", value)}
                  />
                </Field>
              </div>
            )}
          </div>
          <details className="group rounded-xl bg-[var(--slurp-surface-raised)] ring-1 ring-inset ring-[var(--slurp-outline)]">
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] [&::-webkit-details-marker]:hidden">
              <FileText size={17} className="text-[var(--slurp-violet)]" aria-hidden="true" />
              <span className="flex-1">{t("ui.slurp.settings.publishing.generationDetails")}</span>
              <ChevronRight
                size={17}
                className="transition-transform group-open:rotate-90 rtl:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="space-y-5 border-t border-[var(--slurp-outline)] p-4 sm:p-5">
              {settings.autoPostingScheduleEnabled && (
                <Field
                  settingKey="autoPostGenerationMode"
                  label={t("ui.slurp.settings.generationMode")}
                  detail={t("ui.slurp.settings.generationModeDetail")}
                >
                  <select
                    value={settings.autoPostGenerationMode}
                    disabled={updateSettings.isPending}
                    onChange={(event) =>
                      void update(
                        "autoPostGenerationMode",
                        event.target.value as SlurpSettings["autoPostGenerationMode"],
                      )
                    }
                    className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
                  >
                    <option value="pre_generate">{t("ui.slurp.settings.generationModePreGenerate")}</option>
                    <option value="on_demand">{t("ui.slurp.settings.generationModeOnDemand")}</option>
                  </select>
                </Field>
              )}
              <Field
                settingKey="generationConnectionId"
                label={t("ui.slurp.settings.connections.creatorText")}
                detail={t("ui.slurp.settings.connections.creatorTextDetail")}
              >
                <select
                  value={settings.generationConnectionId ?? ""}
                  disabled={connectionsQuery.isLoading || connectionsQuery.isError || updateSettings.isPending}
                  onChange={(event) => void update("generationConnectionId", event.target.value || null)}
                  className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
                >
                  <option value="">{t("ui.slurp.settings.connections.engineDefault")}</option>
                  {(connectionsQuery.data ?? [])
                    .filter((connection) => connection.provider !== "image_generation")
                    .map((connection) => (
                      <option key={connection.id} value={connection.id}>
                        {connection.name ?? connection.model ?? connection.id}
                      </option>
                    ))}
                </select>
              </Field>
              <Toggle
                settingKey="professorMariCreatorSource"
                label={t("ui.slurp.settings.prompts.professorMari")}
                detail={t("ui.slurp.settings.prompts.professorMariDetail")}
                value={settings.professorMariCreatorSource}
                onChange={(value) => update("professorMariCreatorSource", value)}
              />
            </div>
          </details>
        </div>
      )}

      {target === "images" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <BackstagePageHeader
              title={t("ui.slurp.settings.images.title")}
              detail={t("ui.slurp.settings.images.detail")}
              scope="all-slurp"
            />
            <button
              type="button"
              aria-expanded={imageWizardOpen}
              onClick={() => {
                setImageDraft({
                  imageContextMode: settings.imageContextMode,
                  autoPostingImagesEnabled: settings.autoPostingImagesEnabled,
                  allowGalleryImageAttachments: settings.allowGalleryImageAttachments,
                  imageWidth: settings.imageWidth,
                  imageHeight: settings.imageHeight,
                });
                setImageWizardOpen((open) => !open);
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-semibold ring-1 ring-inset ring-[var(--slurp-outline)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
            >
              <Sparkles size={14} aria-hidden="true" />
              {t("ui.slurp.settings.backstage.wizard.imagesTitle", { defaultValue: "Set up images" })}
            </button>
          </div>
          {imageWizardOpen && imageDraft && (
            <BackstageWizard
              title={t("ui.slurp.settings.backstage.wizard.imagesTitle", { defaultValue: "Set up images" })}
              preset={null}
              current={settings}
              proposed={{ ...settings, ...imageDraft }}
              patch={imageDraft}
              pending={updateSettings.isPending}
              onCancel={() => setImageWizardOpen(false)}
              onApply={(patch) => {
                void updatePatch(patch);
                setImageWizardOpen(false);
              }}
              steps={[
                {
                  id: "source",
                  title: t("ui.slurp.settings.backstage.wizard.imagesSource", { defaultValue: "Choose image context" }),
                  content: (
                    <Field
                      label={t("ui.slurp.settings.images.contextMode")}
                      detail={t("ui.slurp.settings.images.contextModeDetail")}
                    >
                      <select
                        value={imageDraft.imageContextMode}
                        onChange={(event) =>
                          setImageDraft({
                            ...imageDraft,
                            imageContextMode: event.target.value as SlurpSettings["imageContextMode"],
                          })
                        }
                        className="min-h-11 w-full rounded-lg bg-[var(--slurp-canvas)] px-3 text-base ring-1 ring-inset ring-[var(--slurp-outline)] sm:text-sm"
                      >
                        <option value="auto">{t("ui.slurp.settings.images.contextAuto")}</option>
                        <option value="imagePrompt">{t("ui.slurp.settings.images.contextPrompt")}</option>
                        <option value="vision">{t("ui.slurp.settings.images.contextVision")}</option>
                      </select>
                    </Field>
                  ),
                },
                {
                  id: "delivery",
                  title: t("ui.slurp.settings.backstage.wizard.imagesDelivery", {
                    defaultValue: "Choose when images appear",
                  }),
                  content: (
                    <div className="space-y-3">
                      <Toggle
                        label={t("ui.slurp.settings.images.enableForNew")}
                        detail={t("ui.slurp.settings.images.enableForNewDetail")}
                        value={imageDraft.autoPostingImagesEnabled}
                        onChange={(value) => setImageDraft({ ...imageDraft, autoPostingImagesEnabled: value })}
                      />
                      <Toggle
                        label={t("ui.slurp.settings.images.galleryFallback")}
                        detail={t("ui.slurp.settings.images.galleryFallbackDetail")}
                        value={imageDraft.allowGalleryImageAttachments}
                        onChange={(value) => setImageDraft({ ...imageDraft, allowGalleryImageAttachments: value })}
                      />
                    </div>
                  ),
                },
                {
                  id: "shape",
                  title: t("ui.slurp.settings.backstage.wizard.imagesShape", {
                    defaultValue: "Choose the image shape",
                  }),
                  content: (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label={t("ui.slurp.settings.images.width")}>
                        <NumberSetting
                          value={imageDraft.imageWidth}
                          min={64}
                          max={4096}
                          onSave={(value) => setImageDraft({ ...imageDraft, imageWidth: value })}
                        />
                      </Field>
                      <Field label={t("ui.slurp.settings.images.height")}>
                        <NumberSetting
                          value={imageDraft.imageHeight}
                          min={64}
                          max={4096}
                          onSave={(value) => setImageDraft({ ...imageDraft, imageHeight: value })}
                        />
                      </Field>
                    </div>
                  ),
                },
              ]}
            />
          )}
          <Field
            settingKey="imageContextMode"
            label={t("ui.slurp.settings.images.contextMode")}
            detail={t("ui.slurp.settings.images.contextModeDetail")}
          >
            <select
              value={settings.imageContextMode}
              disabled={updateSettings.isPending}
              onChange={(event) =>
                void update("imageContextMode", event.target.value as SlurpSettings["imageContextMode"])
              }
              className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
            >
              <option value="auto">{t("ui.slurp.settings.images.contextAuto")}</option>
              <option value="imagePrompt">{t("ui.slurp.settings.images.contextPrompt")}</option>
              <option value="vision">{t("ui.slurp.settings.images.contextVision")}</option>
            </select>
          </Field>
          {settings.imageContextMode !== "imagePrompt" && (
            <Field
              settingKey="imageContextConnectionId"
              label={t("ui.slurp.settings.images.contextConnection")}
              detail={t("ui.slurp.settings.images.contextConnectionDetail")}
            >
              <select
                value={settings.imageContextConnectionId ?? ""}
                disabled={connectionsQuery.isLoading || connectionsQuery.isError || updateSettings.isPending}
                onChange={(event) => void update("imageContextConnectionId", event.target.value || null)}
                className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
              >
                <option value="">{t("ui.slurp.settings.images.contextConnectionText")}</option>
                {(connectionsQuery.data ?? [])
                  .filter((connection) => connection.provider !== "image_generation")
                  .map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {connection.name ?? connection.model ?? connection.id}
                    </option>
                  ))}
              </select>
            </Field>
          )}
          <Toggle
            settingKey="allowGalleryImageAttachments"
            label={t("ui.slurp.settings.images.galleryFallback")}
            detail={t("ui.slurp.settings.images.galleryFallbackDetail")}
            value={settings.allowGalleryImageAttachments}
            onChange={(value) => update("allowGalleryImageAttachments", value)}
          />
          <div
            className={`flex items-start gap-3 rounded-xl p-4 ring-1 ring-inset ${imagesReady ? "bg-[color-mix(in_srgb,var(--slurp-success)_8%,var(--slurp-surface-raised))] ring-[var(--slurp-success)]/25" : "bg-[color-mix(in_srgb,var(--slurp-warning)_8%,var(--slurp-surface-raised))] ring-[var(--slurp-warning)]/25"}`}
          >
            {imagesReady ? (
              <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-[var(--slurp-success)]" aria-hidden="true" />
            ) : (
              <AlertTriangle size={19} className="mt-0.5 shrink-0 text-[var(--slurp-warning)]" aria-hidden="true" />
            )}
            <div>
              <h2 className="text-sm font-bold">
                {imagesReady ? t("ui.slurp.settings.images.readyTitle") : t("ui.slurp.settings.images.needsSetupTitle")}
              </h2>
              <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted)]">
                {t("ui.slurp.settings.images.howDetail")}
              </p>
            </div>
          </div>
          <Field
            label={t("ui.slurp.settings.images.globalConnection")}
            detail={t("ui.slurp.settings.images.globalConnectionDetail")}
          >
            <select
              value={imageSettings?.defaultConnectionId ?? ""}
              disabled={
                imageSettingsQuery.isLoading ||
                imageSettingsQuery.isError ||
                connectionsQuery.isLoading ||
                connectionsQuery.isError ||
                updateImages.isPending
              }
              onChange={(event) =>
                updateImages.mutate(
                  { defaultConnectionId: event.target.value || null },
                  { onError: (error) => toast.error(errorMessage(error)) },
                )
              }
              className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--slurp-canvas,var(--background))] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:opacity-50 sm:text-sm"
            >
              <option value="">{t("ui.slurp.settings.images.engineDefault")}</option>
              {imageConnections.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {connection.name ?? connection.model ?? connection.id}
                </option>
              ))}
            </select>
            {(imageSettingsQuery.isLoading || connectionsQuery.isLoading) && (
              <p className="text-xs font-normal text-[var(--muted-foreground)]">
                {t("ui.slurp.settings.images.loading")}
              </p>
            )}
            {(imageSettingsQuery.isError || connectionsQuery.isError) && (
              <p className="text-xs font-normal text-red-400">{t("ui.slurp.settings.images.loadError")}</p>
            )}
          </Field>
          <Toggle
            settingKey="autoPostingImagesEnabled"
            label={t("ui.slurp.settings.images.enableForNew")}
            detail={t("ui.slurp.settings.images.enableForNewDetail")}
            value={settings.autoPostingImagesEnabled}
            onChange={(value) => update("autoPostingImagesEnabled", value)}
          />
          {/* Output size, from staging's package image settings. */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              settingKey="imageWidth"
              label={t("ui.slurp.settings.images.width")}
              detail={t("ui.slurp.settings.images.widthDetail")}
            >
              <NumberSetting
                value={settings.imageWidth}
                min={64}
                max={4096}
                onSave={(value) => update("imageWidth", value)}
              />
            </Field>
            <Field
              settingKey="imageHeight"
              label={t("ui.slurp.settings.images.height")}
              detail={t("ui.slurp.settings.images.heightDetail")}
            >
              <NumberSetting
                value={settings.imageHeight}
                min={64}
                max={4096}
                onSave={(value) => update("imageHeight", value)}
              />
            </Field>
          </div>
          {/* A Story is shown in its own tall frame, so it carries its own size. The
                      composer crops an uploaded Story to this ratio too. */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              settingKey="storyImageWidth"
              label={t("ui.slurp.settings.images.storyWidth")}
              detail={t("ui.slurp.settings.images.storyWidthDetail")}
            >
              <NumberSetting
                value={settings.storyImageWidth}
                min={64}
                max={4096}
                onSave={(value) => update("storyImageWidth", value)}
              />
            </Field>
            <Field
              settingKey="storyImageHeight"
              label={t("ui.slurp.settings.images.storyHeight")}
              detail={t("ui.slurp.settings.images.storyHeightDetail")}
            >
              <NumberSetting
                value={settings.storyImageHeight}
                min={64}
                max={4096}
                onSave={(value) => update("storyImageHeight", value)}
              />
            </Field>
          </div>
          <details className="group rounded-xl bg-[var(--slurp-surface-raised)] ring-1 ring-inset ring-[var(--slurp-outline)]">
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] [&::-webkit-details-marker]:hidden">
              <Image size={17} className="text-[var(--slurp-violet)]" aria-hidden="true" />
              <span className="flex-1">{t("ui.slurp.settings.images.detailsTitle")}</span>
              <ChevronRight
                size={17}
                className="transition-transform group-open:rotate-90 rtl:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="space-y-5 border-t border-[var(--slurp-outline)] p-4 sm:p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Toggle
                  settingKey="imageGenerationUseAvatarReferences"
                  label={t("ui.slurp.settings.images.useAvatarReferences")}
                  detail={t("ui.slurp.settings.images.useAvatarReferencesDetail")}
                  value={settings.imageGenerationUseAvatarReferences}
                  onChange={(value) => update("imageGenerationUseAvatarReferences", value)}
                />
                <Toggle
                  settingKey="imageGenerationIncludeDescriptions"
                  label={t("ui.slurp.settings.images.includeDescriptions")}
                  detail={t("ui.slurp.settings.images.includeDescriptionsDetail")}
                  value={settings.imageGenerationIncludeDescriptions}
                  onChange={(value) => update("imageGenerationIncludeDescriptions", value)}
                />
              </div>
            </div>
          </details>
        </div>
      )}
    </>
  );
}
