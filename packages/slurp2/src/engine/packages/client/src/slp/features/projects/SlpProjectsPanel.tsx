import { BackstagePageHeader } from "../../modules/settings/SlpSettingsKit";

import { Field, GuidanceBox, NumberSetting, SettingsGroup, Toggle } from "../../modules/settings/SlpSettingsControls";

import { SettingAnchor } from "../../modules/settings/SlpSettingsKit";

import type { SlurpSettings } from "../settings/slp-settings-contract";

import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";
import { ArcLibraryEditor } from "../../../components/slurp/SlurpBackstageWorkflow";

/** Story arcs: pace, sourcing, crossovers and the arc library. */
export function SlpProjectsPanel(page: SlpBackstagePageProps) {
  const { viewerPersonaId, t, updateSettings, settings, selectedCreatorId, update } = page;

  return (
    <div className="space-y-6">
      <BackstagePageHeader title={t("ui.slurp.settings.arcs.title")} detail={t("ui.slurp.settings.arcs.detail")} />
      <GuidanceBox
        title={t("ui.slurp.settings.arcs.guideTitle", { defaultValue: "Set the story rules once" })}
        detail={t("ui.slurp.settings.arcs.guideDetail", {
          defaultValue:
            "These settings apply to every Creator. Use the Creator arc settings to make one profile different.",
        })}
      />
      <SettingsGroup title={t("ui.slurp.settings.arcs.behaviorGroup", { defaultValue: "Story behavior" })}>
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
        <Toggle
          settingKey="arcAffectsMood"
          label={t("ui.slurp.settings.arcAffectsMood")}
          detail={t("ui.slurp.settings.arcAffectsMoodDetail")}
          value={settings.arcAffectsMood}
          onChange={(value) => update("arcAffectsMood", value)}
        />
        <Toggle
          settingKey="arcDirectorMode"
          label={t("ui.slurp.settings.arcDirectorMode")}
          detail={t("ui.slurp.settings.arcDirectorModeDetail")}
          value={settings.arcDirectorMode}
          onChange={(value) => update("arcDirectorMode", value)}
        />
        <Toggle
          settingKey="arcFanReactions"
          label={t("ui.slurp.settings.arcFanReactions")}
          detail={t("ui.slurp.settings.arcFanReactionsDetail")}
          value={settings.arcFanReactions}
          onChange={(value) => update("arcFanReactions", value)}
        />
        <Toggle
          settingKey="arcCrossovers"
          label={t("ui.slurp.settings.arcCrossovers")}
          detail={t("ui.slurp.settings.arcCrossoversDetail")}
          value={settings.arcCrossovers}
          onChange={(value) => update("arcCrossovers", value)}
        />
      </SettingsGroup>
      <SettingsGroup title={t("ui.slurp.settings.arcs.automaticGroup", { defaultValue: "Automatic arcs" })}>
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
        {settings.arcAutoMode !== "off" && (
          <>
            <Field
              settingKey="arcSource"
              label={t("ui.slurp.settings.arcSource")}
              detail={t("ui.slurp.settings.arcSourceDetail")}
            >
              <select
                value={settings.arcSource}
                disabled={updateSettings.isPending}
                onChange={(event) => void update("arcSource", event.target.value as SlurpSettings["arcSource"])}
                className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
              >
                <option value="library">{t("ui.slurp.projects.config.sourceLibrary")}</option>
                <option value="generated">{t("ui.slurp.projects.config.sourceGenerated")}</option>
                <option value="mixed">{t("ui.slurp.projects.config.sourceMixed")}</option>
              </select>
            </Field>
            <Field
              settingKey="arcCooldownWeeks"
              label={t("ui.slurp.settings.arcCooldownWeeks")}
              detail={t("ui.slurp.settings.arcCooldownWeeksDetail")}
            >
              <NumberSetting
                value={settings.arcCooldownWeeks}
                min={1}
                max={8}
                onSave={(value) => update("arcCooldownWeeks", value)}
              />
            </Field>
            <Field
              settingKey="arcMaxConcurrentAuto"
              label={t("ui.slurp.settings.arcMaxConcurrentAuto")}
              detail={t("ui.slurp.settings.arcMaxConcurrentAutoDetail")}
            >
              <NumberSetting
                value={settings.arcMaxConcurrentAuto}
                min={1}
                max={20}
                onSave={(value) => update("arcMaxConcurrentAuto", value)}
              />
            </Field>
          </>
        )}
      </SettingsGroup>
      <div className="space-y-4 border-t border-[var(--slurp-outline)] pt-5">
        <div>
          <h3 className="text-base font-black">{t("ui.slurp.settings.arcLibrary", { defaultValue: "Arc library" })}</h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--muted-foreground)]">
            {t("ui.slurp.settings.arcLibraryDetail", {
              defaultValue: "Reusable story patterns for new arcs. Running arcs keep their current plan.",
            })}
          </p>
        </div>
        <SettingAnchor settingKey="arcLibrary">
          <ArcLibraryEditor
            library={settings.arcLibrary}
            tags={settings.discoveryTags.map((entry) => entry.tag)}
            busy={updateSettings.isPending}
            creatorAccountId={selectedCreatorId}
            personaId={viewerPersonaId}
            onChange={(arcLibrary) => update("arcLibrary", arcLibrary)}
          />
        </SettingAnchor>
      </div>
    </div>
  );
}
