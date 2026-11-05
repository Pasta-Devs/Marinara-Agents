// ──────────────────────────────────────────────
// Story Writer sidebar: reading preferences (shared by every story)
// ──────────────────────────────────────────────
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";
import { useFontFamilies } from "../../../hooks/use-engine-resources";
import {
  LIMITS,
  type StoryColorMode,
  type StorySide,
  type StoryTheme,
  type StoryWriterPreferences,
} from "../../../lib/story-writer/model";
import { themeInkColor, type ResolvedColorMode } from "../../../lib/story-writer/styles-shell";
import { Segmented, Toggle } from "./fields";

const FONT_PRESETS = [
  { value: "", key: "fontDefault" },
  { value: "@serif", key: "fontSerif" },
  { value: "@sans", key: "fontSans" },
  { value: "@mono", key: "fontMono" },
  { value: "@app", key: "fontApp" },
] as const;

export function AppearanceSection(props: {
  preferences: StoryWriterPreferences;
  resolvedMode: ResolvedColorMode;
  onChange(patch: Partial<StoryWriterPreferences>): void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const families = useFontFamilies();
  const { preferences, onChange } = props;
  const isPreset = FONT_PRESETS.some((preset) => preset.value === preferences.fontFamily);
  // A saved family stays selectable even before the Engine's font list has loaded.
  const customFamilies =
    isPreset || families.includes(preferences.fontFamily) ? families : [preferences.fontFamily, ...families];
  const inkColor = preferences.fontColor || themeInkColor(preferences.theme, props.resolvedMode);
  const side = (value: StorySide) => ({ value, label: t(`appearance.${value}`) });
  return (
    <>
      <Segmented<StoryTheme>
        label={t("appearance.theme")}
        value={preferences.theme}
        options={[
          { value: "book", label: t("appearance.themeBook") },
          { value: "ebook", label: t("appearance.themeEbook") },
        ]}
        onChange={(theme) => onChange({ theme })}
      />
      <Segmented<StoryColorMode>
        label={t("appearance.mode")}
        value={preferences.colorMode}
        options={[
          { value: "app", label: t("appearance.modeApp") },
          { value: "light", label: t("appearance.modeLight") },
          { value: "dark", label: t("appearance.modeDark") },
        ]}
        onChange={(colorMode) => onChange({ colorMode })}
      />
      <div className="sw-field">
        <label className="sw-label" htmlFor={`${id}-font`}>
          {t("appearance.font")}
        </label>
        <select
          id={`${id}-font`}
          className="sw-select"
          value={preferences.fontFamily}
          onChange={(event) => onChange({ fontFamily: event.target.value })}
        >
          {FONT_PRESETS.map((preset) => (
            <option key={preset.key} value={preset.value}>
              {t(`appearance.${preset.key}`)}
            </option>
          ))}
          {customFamilies.length > 0 ? (
            <optgroup label={t("appearance.customFonts")}>
              {customFamilies.map((family) => (
                <option key={family} value={family}>
                  {family}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
      </div>
      <div className="sw-field">
        <div className="sw-label-row">
          <label className="sw-label" htmlFor={`${id}-color`}>
            {t("appearance.fontColor")}
          </label>
          <span className="sw-label-extra">{preferences.fontColor ? null : t("appearance.themeColor")}</span>
        </div>
        <div className="sw-color-row">
          <input
            id={`${id}-color`}
            type="color"
            className="sw-color"
            value={inkColor}
            onChange={(event) => onChange({ fontColor: event.target.value })}
          />
          <span className="sw-color-value">{inkColor}</span>
          <button
            type="button"
            className="sw-button"
            disabled={!preferences.fontColor}
            onClick={() => onChange({ fontColor: "" })}
          >
            <RotateCcw size={14} aria-hidden="true" />
            {t("appearance.resetColor")}
          </button>
        </div>
      </div>
      <div className="sw-field">
        <label className="sw-label" htmlFor={`${id}-size`}>
          {t("appearance.fontSize")}
        </label>
        <div className="sw-range-row">
          <input
            id={`${id}-size`}
            type="range"
            className="sw-range"
            min={LIMITS.fontSize.min}
            max={LIMITS.fontSize.max}
            step={1}
            value={preferences.fontSize}
            aria-valuetext={t("appearance.fontSizeValue", { size: preferences.fontSize })}
            onChange={(event) => onChange({ fontSize: Number(event.target.value) })}
          />
          <output className="sw-range-value" htmlFor={`${id}-size`}>
            {t("appearance.fontSizeValue", { size: preferences.fontSize })}
          </output>
        </div>
      </div>
      <Segmented<StorySide>
        label={t("appearance.sidebarSide")}
        value={preferences.sidebarSide}
        options={[side("left"), side("right")]}
        onChange={(sidebarSide) => onChange({ sidebarSide })}
      />
      <Segmented<StorySide>
        label={t("appearance.noteSide")}
        value={preferences.noteSide}
        options={[side("left"), side("right")]}
        onChange={(noteSide) => onChange({ noteSide })}
      />
      <Toggle
        label={t("appearance.pageAnimation")}
        hint={t("appearance.pageAnimationHint")}
        checked={preferences.pageAnimation}
        onChange={(pageAnimation) => onChange({ pageAnimation })}
      />
    </>
  );
}
