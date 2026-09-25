import { Moon, Sparkles, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  AdvancedGroup,
  Field,
  GuidanceBox,
  NumberSetting,
  SettingsGroup,
  Toggle,
  RangeSetting,
} from "../../modules/settings/SlpSettingsControls";
import { BackstagePageHeader } from "../../modules/settings/SlpSettingsKit";
import { ChoiceSetting } from "../../modules/settings/SlpSettingsInputs";
import type { SlurpSettings } from "../settings/slp-settings-contract";
import {
  SLURP_STORY_ACTIVITY_PRESET_ORDER,
  SLURP_STORY_ACTIVITY_PRESETS,
  slurpStoryActivityPresetFor,
} from "../../modules/creator/slp-story-activity-presets";
import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";

const PRESET_ICONS = { calm: Moon, lively: Sparkles, handsOff: Zap } as const;

/**
 * Everything that makes stories happen, in one place: whether events and storylines start by
 * themselves, how storylines behave, and the shared ideas post planning can draw on. These used to
 * sit in three panels (Publishing, Events, Prompts) with two differently worded start controls.
 */
export function SlpStorylinesPanel(page: SlpBackstagePageProps) {
  const { updateSettings, settings, update, updatePatch } = page;
  const { t } = useTranslation();
  const beats = settings.postPlanner === "beats";
  const activity = slurpStoryActivityPresetFor(settings);
  return (
    <div className="space-y-5">
      <BackstagePageHeader
        title={t("ui.slurp.settings.planAutomation.title", { defaultValue: "Storylines" })}
        detail={t("ui.slurp.settings.planAutomation.detail")}
        scope="all-slurp"
      />
      <GuidanceBox title={t("ui.slurp.settings.arcs.guideTitle")} detail={t("ui.slurp.settings.arcs.guideDetail")} />
      <ChoiceSetting
        variant="cards"
        label={t("ui.slurp.settings.storyActivity.title")}
        detail={activity ? undefined : t("ui.slurp.settings.storyActivity.custom")}
        options={SLURP_STORY_ACTIVITY_PRESET_ORDER.map((preset) => ({
          value: preset,
          label: t(`ui.slurp.settings.storyActivity.${preset}`),
          detail: t(`ui.slurp.settings.storyActivity.${preset}Detail`),
          icon: PRESET_ICONS[preset],
        }))}
        value={activity}
        disabled={updateSettings.isPending}
        onChange={(preset) => void updatePatch(SLURP_STORY_ACTIVITY_PRESETS[preset])}
      />
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <SettingsGroup title={t("ui.slurp.settings.startByThemselves.title")}>
          <ChoiceSetting
            settingKey="storyAutomation"
            label={t("ui.slurp.settings.events.automationLabel")}
            detail={t("ui.slurp.settings.events.automationDetail")}
            options={[
              { value: "manual", label: t("ui.slurp.settings.events.automationManual") },
              { value: "suggest", label: t("ui.slurp.settings.events.automationSuggest") },
              { value: "auto", label: t("ui.slurp.settings.events.automationAuto") },
            ]}
            value={settings.storyAutomation}
            disabled={updateSettings.isPending}
            onChange={(value: SlurpSettings["storyAutomation"]) => void update("storyAutomation", value)}
          />
          <ChoiceSetting
            settingKey="arcAutoMode"
            label={t("ui.slurp.settings.arcAutoMode")}
            detail={t("ui.slurp.settings.arcAutoModeDetail")}
            options={[
              { value: "off", label: t("ui.slurp.settings.arcAutoModeOff") },
              { value: "suggest", label: t("ui.slurp.settings.arcAutoModeSuggest") },
              { value: "auto", label: t("ui.slurp.settings.arcAutoModeAuto") },
            ]}
            value={settings.arcAutoMode}
            disabled={updateSettings.isPending}
            onChange={(value: SlurpSettings["arcAutoMode"]) => void update("arcAutoMode", value)}
          />
        </SettingsGroup>
        <SettingsGroup title={t("ui.slurp.settings.arcs.behaviorGroup")}>
          <ChoiceSetting
            settingKey="projectRate"
            label={t("ui.slurp.settings.projectRate")}
            detail={t("ui.slurp.settings.projectRateDetail")}
            options={[
              { value: "off", label: t("ui.slurp.settings.projectRateOff") },
              { value: "rare", label: t("ui.slurp.settings.projectRateRare") },
              { value: "regular", label: t("ui.slurp.settings.projectRateRegular") },
              { value: "often", label: t("ui.slurp.settings.projectRateOften") },
            ]}
            value={settings.projectRate}
            disabled={updateSettings.isPending}
            onChange={(value: SlurpSettings["projectRate"]) => void update("projectRate", value)}
          />
          <ChoiceSetting
            settingKey="arcPace"
            label={t("ui.slurp.settings.arcPace")}
            detail={t("ui.slurp.settings.arcPaceDetail")}
            options={[
              { value: "slow", label: t("ui.slurp.settings.arcPaceSlow") },
              { value: "normal", label: t("ui.slurp.settings.arcPaceNormal") },
              { value: "fast", label: t("ui.slurp.settings.arcPaceFast") },
            ]}
            value={settings.arcPace}
            disabled={updateSettings.isPending}
            onChange={(value: SlurpSettings["arcPace"]) => void update("arcPace", value)}
          />
          <Toggle
            settingKey="arcAffectsMood"
            label={t("ui.slurp.settings.arcAffectsMood")}
            detail={t("ui.slurp.settings.arcAffectsMoodDetail")}
            value={settings.arcAffectsMood}
            onChange={(value) => update("arcAffectsMood", value)}
          />
          <Toggle
            settingKey="arcFanReactions"
            label={t("ui.slurp.settings.arcFanReactions")}
            detail={t("ui.slurp.settings.arcFanReactionsDetail")}
            value={settings.arcFanReactions}
            onChange={(value) => update("arcFanReactions", value)}
          />
        </SettingsGroup>
      </div>
      <SettingsGroup title={t("ui.slurp.settings.prompts.sharedPreseed")}>
        <Toggle
          settingKey="sharedPreseed"
          label={t("ui.slurp.settings.prompts.sharedPreseed")}
          detail={t("ui.slurp.settings.prompts.sharedPreseedDetail")}
          value={settings.sharedPreseed}
          onChange={(value) => update("sharedPreseed", value)}
          disabledReason={beats ? null : t("ui.slurp.settings.hints.needsLifeIdeas")}
        />
        <Toggle
          settingKey="sharedWorldEvents"
          label={t("ui.slurp.settings.prompts.sharedWorldEvents")}
          detail={t("ui.slurp.settings.prompts.sharedWorldEventsDetail")}
          value={settings.sharedWorldEvents}
          onChange={(value) => update("sharedWorldEvents", value)}
          disabledReason={
            !beats
              ? t("ui.slurp.settings.hints.needsLifeIdeas")
              : !settings.sharedPreseed
                ? t("ui.slurp.settings.hints.needsSharedIdeas")
                : null
          }
        />
      </SettingsGroup>
      <AdvancedGroup title={t("ui.slurp.settings.advanced.group")}>
        <ChoiceSetting
          settingKey="arcSource"
          label={t("ui.slurp.settings.arcSource")}
          detail={t("ui.slurp.settings.arcSourceDetail")}
          disabledReason={settings.arcAutoMode === "off" ? t("ui.slurp.settings.hints.needsStorylineStart") : null}
          options={[
            { value: "library", label: t("ui.slurp.projects.config.sourceLibrary") },
            { value: "generated", label: t("ui.slurp.projects.config.sourceGenerated") },
            { value: "mixed", label: t("ui.slurp.projects.config.sourceMixed") },
          ]}
          value={settings.arcSource}
          disabled={updateSettings.isPending}
          onChange={(value: SlurpSettings["arcSource"]) => void update("arcSource", value)}
        />
        <Field
          disabledReason={settings.arcAutoMode === "off" ? t("ui.slurp.settings.hints.needsStorylineStart") : null}
          settingKey="arcCooldownWeeks"
          label={t("ui.slurp.settings.arcCooldownWeeks")}
          detail={t("ui.slurp.settings.arcCooldownWeeksDetail")}
        >
          <RangeSetting
            disabled={settings.arcAutoMode === "off"}
            value={settings.arcCooldownWeeks}
            min={1}
            max={8}
            onSave={(value) => update("arcCooldownWeeks", value)}
            format={(weeks) => t("ui.slurp.settings.units.weeks", { count: weeks })}
          />
        </Field>
        <Field
          disabledReason={settings.arcAutoMode === "off" ? t("ui.slurp.settings.hints.needsStorylineStart") : null}
          settingKey="arcMaxConcurrentAuto"
          label={t("ui.slurp.settings.arcMaxConcurrentAuto")}
          detail={t("ui.slurp.settings.arcMaxConcurrentAutoDetail")}
        >
          <RangeSetting
            disabled={settings.arcAutoMode === "off"}
            value={settings.arcMaxConcurrentAuto}
            min={1}
            max={20}
            onSave={(value) => update("arcMaxConcurrentAuto", value)}
          />
        </Field>
        <Toggle
          settingKey="arcDirectorMode"
          label={t("ui.slurp.settings.arcDirectorMode")}
          detail={t("ui.slurp.settings.arcDirectorModeDetail")}
          value={settings.arcDirectorMode}
          onChange={(value) => update("arcDirectorMode", value)}
        />
        <Toggle
          settingKey="arcCrossovers"
          label={t("ui.slurp.settings.arcCrossovers")}
          detail={t("ui.slurp.settings.arcCrossoversDetail")}
          value={settings.arcCrossovers}
          onChange={(value) => update("arcCrossovers", value)}
        />
        <Field
          settingKey="arcPollHours"
          label={t("ui.slurp.settings.arcPollHours")}
          detail={t("ui.slurp.settings.arcPollHoursDetail")}
        >
          <NumberSetting
            stepper
            value={settings.arcPollHours}
            min={1}
            max={168}
            onSave={(value) => update("arcPollHours", value)}
          />
        </Field>
        <ChoiceSetting
          settingKey="arcStatEffects"
          label={t("ui.slurp.settings.arcStatEffects")}
          detail={t("ui.slurp.settings.arcStatEffectsDetail")}
          options={[
            { value: "off", label: t("ui.slurp.settings.arcStatEffectsOff") },
            { value: "small", label: t("ui.slurp.settings.arcStatEffectsSmall") },
            { value: "big", label: t("ui.slurp.settings.arcStatEffectsBig") },
          ]}
          value={settings.arcStatEffects}
          disabled={updateSettings.isPending}
          onChange={(value: SlurpSettings["arcStatEffects"]) => void update("arcStatEffects", value)}
        />
      </AdvancedGroup>
    </div>
  );
}
