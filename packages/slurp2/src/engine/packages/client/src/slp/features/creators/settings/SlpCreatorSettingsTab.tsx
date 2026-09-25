import { useTranslation } from "react-i18next";

import { SettingAnchor } from "../../../modules/settings/SlpSettingsKit";
import { StatusStrip } from "../../../modules/settings/SlpSettingsInputs";
import type { SlpCreatorSettingsSectionProps } from "./slp-creator-settings-contract";
import type { SlpCreatorSettingsSection } from "./slp-creator-settings-sections";

/**
 * One tab of the Creator settings modal: its blocks in order, each under its own heading when the
 * tab holds more than one. Only the Identity block reports unsaved changes; the other blocks save
 * on their own, so they never mark the profile form dirty.
 */
export function SlpCreatorSettingsTab({
  section,
  ...props
}: SlpCreatorSettingsSectionProps & { section: SlpCreatorSettingsSection }) {
  const { t } = useTranslation();
  const visible = section.blocks.filter((block) => !block.available || block.available(props.creator));
  const headed = visible.length > 1;
  return (
    <div className="space-y-8">
      {headed && (
        <StatusStrip
          label={t("ui.slurp.settings.strip.jump")}
          items={visible.map((block) => ({
            label: t(block.labelKey, { defaultValue: block.defaultLabel }),
            settingKey: `block:${block.id}`,
          }))}
        />
      )}
      {visible.map((block) => {
        const Block = block.Component;
        const content = (
          <Block
            {...props}
            onDirtyChange={block.id === "identity" ? props.onDirtyChange : undefined}
            onSaveStateChange={block.id === "identity" ? props.onSaveStateChange : undefined}
          />
        );
        if (!headed) return <div key={block.id}>{content}</div>;
        const Icon = block.icon;
        return (
          <SettingAnchor key={block.id} settingKey={`block:${block.id}`}>
            <section aria-labelledby={`slp-creator-block-${block.id}`} className="space-y-3">
              <h2
                id={`slp-creator-block-${block.id}`}
                className="flex items-center gap-2 text-base font-bold tracking-tight"
              >
                <Icon size={17} aria-hidden="true" className="text-[var(--noodle-accent)]" />
                {t(block.labelKey, { defaultValue: block.defaultLabel })}
              </h2>
              {content}
            </section>
          </SettingAnchor>
        );
      })}
    </div>
  );
}
