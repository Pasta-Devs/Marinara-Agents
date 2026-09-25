import { useTranslation } from "react-i18next";

import {
  AdvancedGroup,
  Field,
  GuidanceBox,
  NumberSetting,
  SettingsGroup,
  Toggle,
} from "../../modules/settings/SlpSettingsControls";
import { BackstagePageHeader } from "../../modules/settings/SlpSettingsKit";
import type { SlurpSettings } from "../settings/slp-settings-contract";
import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";

const selectClass =
  "min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm";

/**
 * Everything that makes stories happen, in one place: whether events and storylines start by
 * themselves, how storylines behave, and the shared ideas post planning can draw on. These used to
 * sit in three panels (Publishing, Events, Prompts) with two differently worded start controls.
 */
export function SlpStorylinesPanel(page: SlpBackstagePageProps) {
  const { updateSettings, settings, update } = page;
  const { t } = useTranslation();
  const beats = settings.postPlanner === "beats";
  return (
    <div className="space-y-5">
      <BackstagePageHeader
        title={t("ui.slurp.settings.planAutomation.title", { defaultValue: "Storylines" })}
        detail={t("ui.slurp.settings.planAutomation.detail")}
        scope="all-slurp"
      />
      <GuidanceBox title={t("ui.slurp.settings.arcs.guideTitle")} detail={t("ui.slurp.settings.arcs.guideDetail")} />
      <SettingsGroup title={t("ui.slurp.settings.startByThemselves.title")}>
        <Field
          settingKey="storyAutomation"
          label={t("ui.slurp.settings.events.automationLabel")}
          detail={t("ui.slurp.settings.events.automationDetail")}
        >
          <select
            className={selectClass}
            disabled={updateSettings.isPending}
            value={settings.storyAutomation}
            onChange={(event) => void update("storyAutomation", event.target.value as SlurpSettings["storyAutomation"])}
          >
            <option value="manual">{t("ui.slurp.settings.events.automationManual")}</option>
            <option value="suggest">{t("ui.slurp.settings.events.automationSuggest")}</option>
            <option value="auto">{t("ui.slurp.settings.events.automationAuto")}</option>
          </select>
        </Field>
        <Field
          settingKey="arcAutoMode"
          label={t("ui.slurp.settings.arcAutoMode")}
          detail={t("ui.slurp.settings.arcAutoModeDetail")}
        >
          <select
            value={settings.arcAutoMode}
            disabled={updateSettings.isPending}
            onChange={(event) => void update("arcAutoMode", event.target.value as SlurpSettings["arcAutoMode"])}
            className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
          >
            <option value="off">{t("ui.slurp.settings.arcAutoModeOff")}</option>
            <option value="suggest">{t("ui.slurp.settings.arcAutoModeSuggest")}</option>
            <option value="auto">{t("ui.slurp.settings.arcAutoModeAuto")}</option>
          </select>
        </Field>
      </SettingsGroup>
      <SettingsGroup title={t("ui.slurp.settings.arcs.behaviorGroup")}>
        <Field
          settingKey="projectRate"
          label={t("ui.slurp.settings.projectRate")}
          detail={t("ui.slurp.settings.projectRateDetail")}
        >
          <select
            value={settings.projectRate}
            disabled={updateSettings.isPending}
            onChange={(event) => void update("projectRate", event.target.value as SlurpSettings["projectRate"])}
            className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
          >
            <option value="off">{t("ui.slurp.settings.projectRateOff")}</option>
            <option value="rare">{t("ui.slurp.settings.projectRateRare")}</option>
            <option value="regular">{t("ui.slurp.settings.projectRateRegular")}</option>
            <option value="often">{t("ui.slurp.settings.projectRateOften")}</option>
          </select>
        </Field>
        <Field
          settingKey="arcPace"
          label={t("ui.slurp.settings.arcPace")}
          detail={t("ui.slurp.settings.arcPaceDetail")}
        >
          <select
            value={settings.arcPace}
            disabled={updateSettings.isPending}
            onChange={(event) => void update("arcPace", event.target.value as SlurpSettings["arcPace"])}
            className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
          >
            <option value="slow">{t("ui.slurp.settings.arcPaceSlow")}</option>
            <option value="normal">{t("ui.slurp.settings.arcPaceNormal")}</option>
            <option value="fast">{t("ui.slurp.settings.arcPaceFast")}</option>
          </select>
        </Field>
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
        <Field
          disabledReason={settings.arcAutoMode === "off" ? t("ui.slurp.settings.hints.needsStorylineStart") : null}
          settingKey="arcSource"
          label={t("ui.slurp.settings.arcSource")}
          detail={t("ui.slurp.settings.arcSourceDetail")}
        >
          <select
            value={settings.arcSource}
            disabled={updateSettings.isPending || settings.arcAutoMode === "off"}
            onChange={(event) => void update("arcSource", event.target.value as SlurpSettings["arcSource"])}
            className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
          >
            <option value="library">{t("ui.slurp.projects.config.sourceLibrary")}</option>
            <option value="generated">{t("ui.slurp.projects.config.sourceGenerated")}</option>
            <option value="mixed">{t("ui.slurp.projects.config.sourceMixed")}</option>
          </select>
        </Field>
        <Field
          disabledReason={settings.arcAutoMode === "off" ? t("ui.slurp.settings.hints.needsStorylineStart") : null}
          settingKey="arcCooldownWeeks"
          label={t("ui.slurp.settings.arcCooldownWeeks")}
          detail={t("ui.slurp.settings.arcCooldownWeeksDetail")}
        >
          <NumberSetting
            disabled={settings.arcAutoMode === "off"}
            value={settings.arcCooldownWeeks}
            min={1}
            max={8}
            onSave={(value) => update("arcCooldownWeeks", value)}
          />
        </Field>
        <Field
          disabledReason={settings.arcAutoMode === "off" ? t("ui.slurp.settings.hints.needsStorylineStart") : null}
          settingKey="arcMaxConcurrentAuto"
          label={t("ui.slurp.settings.arcMaxConcurrentAuto")}
          detail={t("ui.slurp.settings.arcMaxConcurrentAutoDetail")}
        >
          <NumberSetting
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
            value={settings.arcPollHours}
            min={1}
            max={168}
            onSave={(value) => update("arcPollHours", value)}
          />
        </Field>
        <Field
          settingKey="arcStatEffects"
          label={t("ui.slurp.settings.arcStatEffects")}
          detail={t("ui.slurp.settings.arcStatEffectsDetail")}
        >
          <select
            value={settings.arcStatEffects}
            disabled={updateSettings.isPending}
            onChange={(event) => void update("arcStatEffects", event.target.value as SlurpSettings["arcStatEffects"])}
            className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
          >
            <option value="off">{t("ui.slurp.settings.arcStatEffectsOff")}</option>
            <option value="small">{t("ui.slurp.settings.arcStatEffectsSmall")}</option>
            <option value="big">{t("ui.slurp.settings.arcStatEffectsBig")}</option>
          </select>
        </Field>
      </AdvancedGroup>
    </div>
  );
}
