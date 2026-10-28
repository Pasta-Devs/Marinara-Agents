import { BackstagePageHeader, SettingAnchor } from "../../modules/settings/SlpSettingsKit";
import { Field, NumberSetting, SettingsGroup, Toggle } from "../../modules/settings/SlpSettingsControls";
import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";
import { useSlurpCarryoverReach } from "./slp-settings-hooks";

/**
 * Engine link: everything that crosses between Slurp and the rest of Marinara. Engine chats that
 * remember Slurp (carryover), and what Slurp reads from lorebooks and other agents.
 */
export function SlpEngineLinkPanel({ t, settings, update }: SlpBackstagePageProps) {
  const reach = useSlurpCarryoverReach(settings.carryoverModes.length > 0).data;
  return (
    <div className="space-y-4">
      <BackstagePageHeader
        detail={t("ui.slurp.settings.engineLink.detail", {
          defaultValue: "How Slurp and your other Marinara chats know about each other.",
        })}
      />
      <SettingsGroup title={t("ui.slurp.settings.carryover.title")}>
        <p className="text-xs leading-5 text-[var(--slurp-muted)]">{t("ui.slurp.settings.carryover.detail")}</p>
        <SettingAnchor settingKey="carryoverModes">
          <div className="grid gap-x-8 sm:grid-cols-3">
            {(["conversation", "roleplay", "game"] as const).map((mode) => (
              <Toggle
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
          </div>
        </SettingAnchor>
        {settings.carryoverModes.length > 0 && (
          <>
            {reach && (
              <p className="text-xs leading-5 text-[var(--slurp-muted)]">
                {reach.on + reach.off === 0
                  ? t("ui.slurp.settings.carryover.reachNone")
                  : t("ui.slurp.settings.carryover.reach", { on: reach.on, total: reach.on + reach.off })}
                {reach.off > 0 && ` ${t("ui.slurp.settings.carryover.reachOff")}`}
              </p>
            )}
            <Field
              settingKey="carryoverHours"
              label={t("ui.slurp.settings.carryover.hours")}
              detail={t("ui.slurp.settings.carryover.hoursDetail")}
            >
              <NumberSetting
                stepper
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
                stepper
                value={settings.carryoverMaxItems}
                min={1}
                max={100}
                onSave={(value) => update("carryoverMaxItems", value)}
              />
            </Field>
          </>
        )}
      </SettingsGroup>
      <SettingsGroup title={t("ui.slurp.settings.engineLink.contextTitle", { defaultValue: "What Slurp reads" })}>
        <Toggle
          settingKey="enableLorebookContext"
          label={t("ui.slurp.settings.prompts.lorebookContext")}
          detail={t("ui.slurp.settings.prompts.lorebookContextDetail")}
          value={settings.enableLorebookContext}
          onChange={(value) => update("enableLorebookContext", value)}
        />
        <Toggle
          settingKey="flavourFromAgents"
          label={t("ui.slurp.settings.prompts.flavourFromAgents")}
          detail={t("ui.slurp.settings.prompts.flavourFromAgentsDetail")}
          value={settings.flavourFromAgents}
          onChange={(value) => update("flavourFromAgents", value)}
        />
      </SettingsGroup>
    </div>
  );
}
