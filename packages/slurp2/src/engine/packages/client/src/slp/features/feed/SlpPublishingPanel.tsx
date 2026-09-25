import { ChevronRight, FileText, Sparkles } from "lucide-react";

import {
  Field,
  GuidanceBox,
  NumberSetting,
  SectionTitle,
  SettingsGroup,
  Toggle,
} from "../../modules/settings/SlpSettingsControls";

import { BackstagePageHeader, BackstageWizard, SettingAnchor } from "../../modules/settings/SlpSettingsKit";

import type { SlurpSettings } from "../settings/slp-settings-contract";
import {
  SLURP_ACTIVITY_PRESETS,
  slurpActivityPresetPatch,
  slurpPostsPerDayForPreset,
} from "../../modules/creator/slp-activity-presets";
import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";

/** Publishing: how often posts go out, the schedule, carryover and post length. */
export function SlpPublishingPanel(page: SlpBackstagePageProps) {
  const {
    t,
    updateSettings,
    settings,
    customPaceOpen,
    setCustomPaceOpen,
    update,
    updatePatch,
    accountsQuery,
    connectionsQuery,
    activityPreset,
    openRefresh,
    paceWizardOpen,
    setPaceWizardOpen,
    paceDraft,
    setPaceDraft,
  } = page;
  // One patch, written only on Apply, so a half-finished wizard never leaves mixed settings behind.
  const pacePatch: Partial<SlurpSettings> = paceDraft
    ? {
        ...(paceDraft.preset ? slurpActivityPresetPatch(paceDraft.preset) : { postsPerDay: paceDraft.postsPerDay }),
        nightQuiet: paceDraft.nightQuiet,
        storyRate: paceDraft.storyRate,
      }
    : {};
  return (
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
      {/* Shown even when it has no effect, with the reason, so the setting is never a surprise. */}
      <Field
        settingKey="storyRate"
        label={t("ui.slurp.settings.storyRate")}
        detail={t("ui.slurp.settings.storyRateDetail")}
        disabledReason={
          !settings.autoPostingScheduleEnabled
            ? t("ui.slurp.settings.hints.autoPostingOnly")
            : !settings.autoPostingImagesEnabled
              ? t("ui.slurp.settings.hints.needsImages")
              : null
        }
      >
        <select
          value={settings.storyRate}
          disabled={
            updateSettings.isPending || !settings.autoPostingScheduleEnabled || !settings.autoPostingImagesEnabled
          }
          onChange={(event) => void update("storyRate", event.target.value as SlurpSettings["storyRate"])}
          className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
        >
          <option value="off">{t("ui.slurp.settings.storyRateOff")}</option>
          <option value="rare">{t("ui.slurp.settings.storyRateRare")}</option>
          <option value="regular">{t("ui.slurp.settings.storyRateRegular")}</option>
          <option value="often">{t("ui.slurp.settings.storyRateOften")}</option>
        </select>
      </Field>
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
        <SectionTitle title={t("ui.slurp.settings.carryover.title")} detail={t("ui.slurp.settings.carryover.detail")} />
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
      {/* What each automatic post is: where its idea comes from and whether it goes out free. */}
      <SettingsGroup title={t("ui.slurp.settings.publishing.whatGetsPosted")}>
        <Field
          settingKey="postPlanner"
          label={t("ui.slurp.settings.prompts.postPlanner")}
          detail={t("ui.slurp.settings.prompts.postPlannerDetail")}
        >
          <select
            value={settings.postPlanner}
            disabled={updateSettings.isPending}
            onChange={(event) => void update("postPlanner", event.target.value as SlurpSettings["postPlanner"])}
            className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
          >
            <option value="beats">{t("ui.slurp.settings.prompts.postPlannerBeats")}</option>
            <option value="classic">{t("ui.slurp.settings.prompts.postPlannerClassic")}</option>
          </select>
        </Field>
        <Field
          settingKey="teaserRate"
          label={t("ui.slurp.settings.wallet.teaserRate", { defaultValue: "Free teaser posts" })}
          detail={t("ui.slurp.settings.wallet.teaserRateDetail", {
            defaultValue:
              "How often an automatic post goes out free. Creators for whom it fits use it to win subscribers; the rest just post something free.",
          })}
        >
          <select
            value={settings.teaserRate}
            onChange={(event) => void update("teaserRate", event.target.value as SlurpSettings["teaserRate"])}
            className="min-h-11 w-full rounded-lg bg-[var(--slurp-canvas)] px-3 text-base ring-1 ring-inset ring-[var(--slurp-outline)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-sm"
          >
            <option value="off">{t("ui.slurp.settings.storyRateOff")}</option>
            <option value="rare">{t("ui.slurp.settings.storyRateRare")}</option>
            <option value="regular">{t("ui.slurp.settings.storyRateRegular")}</option>
            <option value="often">{t("ui.slurp.settings.storyRateOften")}</option>
          </select>
        </Field>
      </SettingsGroup>
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
          <Field
            settingKey="autoPostGenerationMode"
            label={t("ui.slurp.settings.generationMode")}
            detail={t("ui.slurp.settings.generationModeDetail")}
            disabledReason={settings.autoPostingScheduleEnabled ? null : t("ui.slurp.settings.hints.autoPostingOnly")}
          >
            <select
              value={settings.autoPostGenerationMode}
              disabled={updateSettings.isPending || !settings.autoPostingScheduleEnabled}
              onChange={(event) =>
                void update("autoPostGenerationMode", event.target.value as SlurpSettings["autoPostGenerationMode"])
              }
              className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
            >
              <option value="pre_generate">{t("ui.slurp.settings.generationModePreGenerate")}</option>
              <option value="on_demand">{t("ui.slurp.settings.generationModeOnDemand")}</option>
            </select>
          </Field>
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
  );
}
