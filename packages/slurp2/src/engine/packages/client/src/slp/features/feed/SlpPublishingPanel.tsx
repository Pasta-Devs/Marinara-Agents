import { FileText } from "lucide-react";
import { SlpSparkleGlyph } from "../../base/chrome/SlpGlyphs";

import {
  AdvancedGroup,
  Field,
  GuidanceBox,
  NumberSetting,
  RangeSetting,
  SettingsGroup,
  Toggle,
} from "../../modules/settings/SlpSettingsControls";
import { ChoiceSetting, StatusStrip } from "../../modules/settings/SlpSettingsInputs";

import { BackstagePageHeader, SettingAnchor } from "../../modules/settings/SlpSettingsKit";

import type { SlurpSettings } from "../settings/slp-settings-contract";
import { useCreatorAccounts } from "../creators/slp-creators-contract";
import {
  SLURP_PUBLISHING_PRESETS,
  slurpActivityPresetPatch,
  slurpPostsPerDayForPreset,
} from "../../modules/creator/slp-activity-presets";
import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";
import { SLURP_STORY_JOB_DEFAULTS, type SlurpStoryJobWeights } from "../../../../../shared/src/slp/slp-post-purpose.js";
import { slurpSizedPostsPerDay } from "../../../../../shared/src/slp/slp-model-budget.js";

/** Publishing: how often posts go out, the schedule, carryover and post length. */
export function SlpPublishingPanel(page: SlpBackstagePageProps) {
  // Stories need a Creator that draws pictures. The "new creators" default says nothing about the
  // Creators that already post (R1-124); unknown while the list loads, so nothing locks early.
  const creatorList = useCreatorAccounts().data;
  const creatorsDrawPictures = !creatorList || creatorList.some((creator) => creator.autoPosting.imagesEnabled);
  const {
    t,
    updateSettings,
    settings,
    customPaceOpen,
    setCustomPaceOpen,
    update,
    updatePatch,
    accountsQuery,
    activityPreset,
    openRefresh,
  } = page;
  // F: an untouched "Posts per day" grows with the Creators that post on their own (the server sizes it).
  const recommendedPosts = slurpSizedPostsPerDay(
    (creatorList ?? []).filter((creator) => creator.autoPosting.enabled).length,
  );
  // The Story job sliders only matter when automatic Stories can go out at all.
  const storiesRun = settings.storyRate !== "off" && settings.autoPostingScheduleEnabled && creatorsDrawPictures;
  // A Story job's weight in words: how often it comes up when it fits.
  const storyJobWord = (value: number) =>
    t(
      value <= 0
        ? "ui.slurp.settings.storyJobNever"
        : value <= 2
          ? "ui.slurp.settings.lifeMomentRateRarely"
          : value <= 4
            ? "ui.slurp.settings.lifeMomentRateSometimes"
            : value <= 7
              ? "ui.slurp.settings.lifeMomentRateOften"
              : "ui.slurp.settings.storyJobMostly",
    );
  const onOff = (value: boolean) => t(value ? "ui.slurp.settings.overview.on" : "ui.slurp.settings.overview.off");
  const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
  return (
    <div className="space-y-4">
      <BackstagePageHeader
        detail={t("ui.slurp.settings.publishing.detail")}
        actions={
          <button
            type="button"
            disabled={accountsQuery.isLoading || accountsQuery.isError}
            onClick={openRefresh}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-4 text-sm font-bold text-[var(--slurp-on-accent)] [&_svg]:!text-[var(--slurp-on-accent)] shadow-sm transition-[opacity,transform] hover:opacity-90 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-50"
          >
            <SlpSparkleGlyph size={15} aria-hidden="true" />
            {t("ui.slurp.settings.refresh.title")}
          </button>
        }
      />
      <StatusStrip
        label={t("ui.slurp.settings.strip.label")}
        items={[
          {
            label: t("ui.slurp.settings.strip.perDay"),
            value: String(settings.postsPerDay),
            settingKey: "postsPerDay",
          },
          {
            label: t("ui.slurp.settings.strip.stories"),
            value: t(`ui.slurp.settings.storyRate${cap(settings.storyRate)}`),
            settingKey: "storyRate",
          },
          { label: t("ui.slurp.settings.strip.quiet"), value: onOff(settings.nightQuiet), settingKey: "nightQuiet" },
          {
            label: t("ui.slurp.settings.strip.ideas"),
            value: t(`ui.slurp.settings.prompts.postPlanner${cap(settings.postPlanner)}`),
            settingKey: "postPlanner",
          },
          {
            label: t("ui.slurp.settings.strip.teasers"),
            value: t(`ui.slurp.settings.storyRate${cap(settings.teaserRate)}`),
            settingKey: "teaserRate",
          },
        ]}
      />
      <SettingsGroup title={t("ui.slurp.settings.publishing.pace")}>
        <SettingAnchor settingKey="autoPostingScheduleEnabled">
          <p className="mb-3 max-w-prose text-xs leading-5 text-[var(--slurp-muted)]">
            {t("ui.slurp.settings.publishing.howDetail")}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SLURP_PUBLISHING_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={activityPreset === preset}
                disabled={updateSettings.isPending}
                onClick={() => {
                  setCustomPaceOpen(false);
                  void updatePatch(slurpActivityPresetPatch(preset));
                }}
                className={`min-h-16 rounded-xl p-3 text-start ring-1 ring-inset transition-[background-color,transform] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-50 ${!customPaceOpen && activityPreset === preset ? "bg-[image:var(--slurp-nav-active)] ring-[var(--noodle-accent)]/45" : "bg-[var(--slurp-surface-raised)] ring-[var(--slurp-outline)] hover:bg-[color-mix(in_srgb,var(--noodle-accent)_7%,var(--slurp-surface-raised))]"}`}
              >
                <span className="block text-sm font-semibold">{t(`ui.slurp.settings.presets.${preset}`)}</span>
                <span className="mt-1 block text-xs text-[var(--muted-foreground)]">
                  {preset === "manual"
                    ? t("ui.slurp.settings.presets.manualDetail")
                    : preset === "grows"
                      ? // F + orchestrator: the default; it replaced the "Grows with your Creators" line below.
                        t("ui.slurp.settings.presets.growsDetail", {
                          count: settings.postsPerDayCustom ? recommendedPosts : settings.postsPerDay,
                        })
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
              className={`min-h-16 rounded-xl p-3 text-start ring-1 ring-inset transition-[background-color,transform] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-50 ${customPaceOpen || activityPreset === null ? "bg-[image:var(--slurp-nav-active)] ring-[var(--noodle-accent)]/45" : "bg-[var(--slurp-surface-raised)] ring-[var(--slurp-outline)] hover:bg-[color-mix(in_srgb,var(--noodle-accent)_7%,var(--slurp-surface-raised))]"}`}
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
              stepper
              value={settings.postsPerDay}
              min={1}
              max={96}
              onSave={(value) => updatePatch({ autoPostingScheduleEnabled: true, postsPerDay: value })}
            />
          </Field>
        )}
        {!settings.autoPostingScheduleEnabled && (
          <GuidanceBox
            title={t("ui.slurp.settings.publishing.manualTitle")}
            detail={t("ui.slurp.settings.publishing.manualDetail")}
          />
        )}
        <Toggle
          settingKey="nightQuiet"
          label={t("ui.slurp.settings.quietHours")}
          detail={t("ui.slurp.settings.quietHoursDetail")}
          value={settings.nightQuiet}
          onChange={(value) => update("nightQuiet", value)}
          disabledReason={settings.autoPostingScheduleEnabled ? null : t("ui.slurp.settings.hints.autoPostingOnly")}
        />
      </SettingsGroup>
      <SettingsGroup title={t("ui.slurp.settings.strip.stories")}>
        {/* Shown even when it has no effect, with the reason, so the setting is never a surprise. */}
        <ChoiceSetting
          settingKey="storyRate"
          label={t("ui.slurp.settings.storyRate")}
          detail={t("ui.slurp.settings.storyRateDetail")}
          disabledReason={
            !settings.autoPostingScheduleEnabled
              ? t("ui.slurp.settings.hints.autoPostingOnly")
              : !creatorsDrawPictures
                ? t("ui.slurp.settings.hints.needsImages")
                : null
          }
          options={[
            { value: "off", label: t("ui.slurp.settings.storyRateOff") },
            { value: "rare", label: t("ui.slurp.settings.storyRateRare") },
            { value: "regular", label: t("ui.slurp.settings.storyRateRegular") },
            { value: "often", label: t("ui.slurp.settings.storyRateOften") },
          ]}
          value={settings.storyRate}
          disabled={updateSettings.isPending || !settings.autoPostingScheduleEnabled || !creatorsDrawPictures}
          onChange={(value: SlurpSettings["storyRate"]) => void update("storyRate", value)}
        />
        {/* Slice I (user): one slider per Story job, balanced by default. A job only comes up when it fits. */}
        <Field
          settingKey="storyJobs"
          label={t("ui.slurp.settings.storyJobs")}
          detail={t("ui.slurp.settings.storyJobsDetail")}
          disabledReason={settings.storyRate === "off" ? t("ui.slurp.settings.hints.storiesOff") : null}
          group
          wide
        >
          <span className="grid max-w-2xl gap-1">
            {(Object.keys(SLURP_STORY_JOB_DEFAULTS) as (keyof SlurpStoryJobWeights)[]).map((job) => (
              <span key={job} className="grid gap-0.5" data-slurp-story-job={job}>
                <span className="text-xs font-semibold text-[var(--slurp-muted,var(--muted-foreground))]">
                  {t(`ui.slurp.settings.storyJob.${job}`)}
                </span>
                <RangeSetting
                  label={t(`ui.slurp.settings.storyJob.${job}`)}
                  value={settings.storyJobs[job]}
                  min={0}
                  max={10}
                  format={storyJobWord}
                  disabled={updateSettings.isPending || !storiesRun}
                  onSave={(value) => update("storyJobs", { ...settings.storyJobs, [job]: value })}
                />
              </span>
            ))}
          </span>
        </Field>
        <Toggle
          settingKey="storyImagesEnabled"
          label={t("ui.slurp.settings.storyImagesEnabled")}
          detail={t("ui.slurp.settings.storyImagesEnabledDetail")}
          value={settings.storyImagesEnabled}
          onChange={(value) => update("storyImagesEnabled", value)}
        />
        <Field
          settingKey="storyLifetimeHours"
          label={t("ui.slurp.settings.storyLifetimeHours")}
          detail={t("ui.slurp.settings.storyLifetimeHoursDetail")}
        >
          <RangeSetting
            label={t("ui.slurp.settings.storyLifetimeHours")}
            value={settings.storyLifetimeHours}
            min={1}
            max={168}
            format={(hours) => (hours % 24 === 0 ? `${hours / 24} d` : `${hours} h`)}
            onSave={(value) => update("storyLifetimeHours", value)}
          />
        </Field>
      </SettingsGroup>
      {/* What each automatic post is: where its idea comes from and whether it goes out free. */}
      <SettingsGroup title={t("ui.slurp.settings.publishing.whatGetsPosted")}>
        <ChoiceSetting
          settingKey="postPlanner"
          label={t("ui.slurp.settings.prompts.postPlanner")}
          detail={t("ui.slurp.settings.prompts.postPlannerDetail")}
          options={[
            { value: "beats", label: t("ui.slurp.settings.prompts.postPlannerBeats") },
            { value: "classic", label: t("ui.slurp.settings.prompts.postPlannerClassic") },
          ]}
          value={settings.postPlanner}
          disabled={updateSettings.isPending}
          onChange={(value: SlurpSettings["postPlanner"]) => void update("postPlanner", value)}
        />
        {/* Life moments are a beat source: the model's-choice planner never picks one. */}
        <ChoiceSetting
          settingKey="lifeMomentRate"
          label={t("ui.slurp.settings.lifeMomentRate")}
          detail={t("ui.slurp.settings.lifeMomentRateDetail")}
          disabledReason={settings.postPlanner === "classic" ? t("ui.slurp.settings.hints.needsLifeIdeas") : null}
          options={[
            { value: "rarely", label: t("ui.slurp.settings.lifeMomentRateRarely") },
            { value: "sometimes", label: t("ui.slurp.settings.lifeMomentRateSometimes") },
            { value: "often", label: t("ui.slurp.settings.lifeMomentRateOften") },
          ]}
          value={settings.lifeMomentRate}
          disabled={updateSettings.isPending || settings.postPlanner === "classic"}
          onChange={(value: SlurpSettings["lifeMomentRate"]) => void update("lifeMomentRate", value)}
        />
        <ChoiceSetting
          settingKey="teaserRate"
          label={t("ui.slurp.settings.wallet.teaserRate", { defaultValue: "Free teaser posts" })}
          detail={t("ui.slurp.settings.wallet.teaserRateDetail", {
            defaultValue:
              "How often an automatic post goes out free. Creators for whom it fits use it to win subscribers; the rest just post something free.",
          })}
          options={[
            { value: "off", label: t("ui.slurp.settings.storyRateOff") },
            { value: "rare", label: t("ui.slurp.settings.storyRateRare") },
            { value: "regular", label: t("ui.slurp.settings.storyRateRegular") },
            { value: "often", label: t("ui.slurp.settings.storyRateOften") },
          ]}
          value={settings.teaserRate}
          onChange={(value: SlurpSettings["teaserRate"]) => void update("teaserRate", value)}
        />
        <ChoiceSetting
          settingKey="pictureReuse"
          label={t("ui.slurp.settings.pictureReuse")}
          detail={t("ui.slurp.settings.pictureReuseDetail")}
          options={[
            { value: "off", label: t("ui.slurp.settings.storyRateOff") },
            { value: "rare", label: t("ui.slurp.settings.storyRateRare") },
            { value: "regular", label: t("ui.slurp.settings.storyRateRegular") },
          ]}
          value={settings.pictureReuse}
          disabled={updateSettings.isPending}
          onChange={(value: SlurpSettings["pictureReuse"]) => void update("pictureReuse", value)}
        />
      </SettingsGroup>
      <AdvancedGroup
        icon={<FileText size={17} className="text-[var(--slurp-violet)]" aria-hidden="true" />}
        title={t("ui.slurp.settings.publishing.generationDetails")}
      >
        <ChoiceSetting
          settingKey="autoPostGenerationMode"
          label={t("ui.slurp.settings.generationMode")}
          detail={t("ui.slurp.settings.generationModeDetail")}
          disabledReason={settings.autoPostingScheduleEnabled ? null : t("ui.slurp.settings.hints.autoPostingOnly")}
          options={[
            { value: "pre_generate", label: t("ui.slurp.settings.generationModePreGenerate") },
            { value: "on_demand", label: t("ui.slurp.settings.generationModeOnDemand") },
          ]}
          value={settings.autoPostGenerationMode}
          disabled={updateSettings.isPending || !settings.autoPostingScheduleEnabled}
          onChange={(value: SlurpSettings["autoPostGenerationMode"]) => void update("autoPostGenerationMode", value)}
        />
        <>
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
        </>
        <Toggle
          settingKey="professorMariCreatorSource"
          label={t("ui.slurp.settings.prompts.professorMari")}
          detail={t("ui.slurp.settings.prompts.professorMariDetail")}
          value={settings.professorMariCreatorSource}
          onChange={(value) => update("professorMariCreatorSource", value)}
        />
      </AdvancedGroup>
    </div>
  );
}
