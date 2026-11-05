import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { SettingsGroup, Toggle } from "./SlpSettingsControls";
import type { SlpSettingKey } from "./SlpSettingsKit";

/**
 * An extension's switch at the top of its page (docs/CONFIGURATOR.md). Off, the page shows only
 * this and one sentence: none of it runs or shows, and its settings and data stay as they are.
 */
export function SlpExtensionSwitch({
  settingKey,
  label,
  detail,
  on,
  onChange,
  children,
}: {
  settingKey: SlpSettingKey;
  label: string;
  detail: string;
  on: boolean;
  onChange: (on: boolean) => void;
  /** The extension's own sub-switches, shown in the same group while it is on. */
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <>
      <SettingsGroup title={t("ui.slurp.settings.ext.title", { defaultValue: "Extension" })}>
        <Toggle settingKey={settingKey} label={label} detail={detail} value={on} onChange={onChange} />
        {on && children}
      </SettingsGroup>
      {!on && (
        <p className="text-sm text-[var(--slurp-muted)] text-pretty">
          {t("ui.slurp.settings.ext.offNote", {
            defaultValue: "Switched off: none of it runs or shows. Its settings and data stay as they are.",
          })}
        </p>
      )}
    </>
  );
}
