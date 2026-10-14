import type { KeyboardEvent, ReactNode } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { SlurpStageProfileInput } from "../../base/state/slp-state-types";
import { textareaClass } from "../../modules/post/SlpPostHelpers";
import { SlpTextAssist } from "../assist/slp-assist-contract";
import type { SlpAssistField } from "../../../../../shared/src/slp/slp-actions.js";
import { SLP_CLOTHING_STYLES, slpWear, type SlpClothingStyle } from "../../../../../shared/src/slp/slp-gender.js";
import { cn } from "../../../lib/utils";

/** A field's label with the AI assist beside it. A div, not a label: the assist has buttons. */
export function SlpAssistedField({
  label,
  field,
  value,
  onApply,
  accountId,
  context,
  className = "space-y-1",
  children,
}: {
  label: string;
  field: SlpAssistField;
  value: string;
  onApply: (text: string) => void;
  accountId?: string;
  context?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-x-2">
        <span className="text-xs font-semibold">{label}</span>
        <SlpTextAssist field={field} value={value} onApply={onApply} accountId={accountId} context={context} />
      </div>
      {children}
    </div>
  );
}

/**
 * Lingerie or briefs. `auto` follows gender and names what that gives, so a male Creator who wears
 * lingerie is one tap away (user, 2026-10-14).
 */
function SlpClothingStylePicker({
  value,
  gender,
  disabled,
  onChange,
}: {
  value: SlpClothingStyle;
  gender: string | null;
  disabled: boolean;
  onChange: (value: SlpClothingStyle) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const label = (style: SlpClothingStyle) =>
    localizeUi(`ui.slurp.stageProfile.clothingStyle.${style}`, {
      defaultValue: { auto: "Auto", feminine: "Feminine", masculine: "Masculine", neutral: "Neutral" }[style],
    });
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const index = SLP_CLOTHING_STYLES.indexOf(value);
    const next = SLP_CLOTHING_STYLES[(index + step + SLP_CLOTHING_STYLES.length) % SLP_CLOTHING_STYLES.length]!;
    onChange(next);
    (event.currentTarget.querySelector(`[data-slp-clothing-style="${next}"]`) as HTMLButtonElement | null)?.focus();
  };
  return (
    <div className="space-y-1 sm:col-span-2">
      <span id="slp-clothing-style-label" className="text-xs font-semibold">
        {localizeUi("ui.slurp.stageProfile.clothingStyle", { defaultValue: "Clothing style" })}
      </span>
      <div
        role="radiogroup"
        aria-labelledby="slp-clothing-style-label"
        aria-describedby="slp-clothing-style-detail"
        onKeyDown={onKeyDown}
        className="flex flex-wrap gap-1.5"
      >
        {SLP_CLOTHING_STYLES.map((style) => {
          const on = value === style;
          return (
            <button
              key={style}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              disabled={disabled}
              data-slp-clothing-style={style}
              onClick={() => onChange(style)}
              className={cn(
                "min-h-11 rounded-full px-3.5 text-sm font-semibold ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none",
                on
                  ? "bg-[image:var(--slurp-nav-active)] ring-[var(--noodle-accent)]/45"
                  : "bg-[var(--slurp-canvas)] ring-[var(--slurp-outline)] hover:bg-[var(--accent)]",
              )}
            >
              {style === "auto" ? `${label("auto")} · ${label(slpWear(gender, "auto"))}` : label(style)}
            </button>
          );
        })}
      </div>
      <span id="slp-clothing-style-detail" className="block text-[0.7rem] leading-5 text-[var(--muted-foreground)]">
        {localizeUi("ui.slurp.stageProfile.clothingStyleDetail", {
          defaultValue: "What spicy posts put them in: lingerie, briefs, or either. Auto follows gender.",
        })}
      </span>
    </div>
  );
}

/**
 * What this Creator looks like and where her life happens.
 *
 * Its own component because the stage-profile form is at the size limit, and because these three
 * belong together: they are the facts that stay the same between posts, as opposed to the voice
 * and the bio, which are how she sounds.
 */
export function SlurpStageFactsFields({
  draft,
  disabled,
  onChange,
  accountId,
}: {
  draft: SlurpStageProfileInput;
  disabled: boolean;
  onChange: (patch: Partial<SlurpStageProfileInput>) => void;
  /** The Creator, when it exists already: the assist writes from who they are. */
  accountId?: string;
}) {
  const { t: localizeUi } = useUiTranslation();
  const who = draft.displayName.trim() ? `For ${draft.displayName.trim()}. ` : "";
  // "What she wears" for a woman, "he" for a man, "they" otherwise: i18next picks the `_female` /
  // `_male` key, the plain key is the neutral one.
  const context = draft.gender === "male" || draft.gender === "female" ? draft.gender : undefined;
  return (
    <>
      {/* What she looks like and where her life happens, stored on the Creator.
        Appearance is the one that stops her being a different person in every picture: it is
        sent with every image whether or not the source card is being used. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <SlpAssistedField
          className="space-y-1 sm:col-span-2"
          label={localizeUi("ui.slurp.stageProfile.appearance", { defaultValue: "Appearance" })}
          field="facts"
          value={draft.appearance ?? ""}
          accountId={accountId}
          context={`${who}This field is their appearance: body, face, hair, marks.`}
          onApply={(text) => onChange({ appearance: text })}
        >
          <textarea
            aria-label={localizeUi("ui.slurp.stageProfile.appearance", { defaultValue: "Appearance" })}
            rows={3}
            disabled={disabled}
            value={draft.appearance ?? ""}
            maxLength={2000}
            onChange={(event) => onChange({ appearance: event.target.value })}
            placeholder={localizeUi("ui.slurp.stageProfile.appearancePlaceholder", {
              defaultValue: "Body, face, hair, marks: the things that must look the same in every picture.",
            })}
            className={`${textareaClass} !min-h-0`}
          />
          <span className="block text-[0.7rem] leading-5 text-[var(--muted-foreground)]">
            {localizeUi("ui.slurp.stageProfile.appearanceDetail", {
              defaultValue: "Sent with every picture. Left empty, the image model invents somebody new each post.",
            })}
          </span>
        </SlpAssistedField>
        <SlpAssistedField
          label={localizeUi("ui.slurp.stageProfile.wardrobe", { defaultValue: "Usual wardrobe" })}
          field="facts"
          value={draft.wardrobe ?? ""}
          accountId={accountId}
          context={`${who}This field is what they usually wear, at home and out.`}
          onApply={(text) => onChange({ wardrobe: text })}
        >
          <textarea
            aria-label={localizeUi("ui.slurp.stageProfile.wardrobe", { defaultValue: "Usual wardrobe" })}
            rows={2}
            disabled={disabled}
            value={draft.wardrobe ?? ""}
            maxLength={2000}
            onChange={(event) => onChange({ wardrobe: event.target.value })}
            placeholder={localizeUi("ui.slurp.stageProfile.wardrobePlaceholder", {
              context,
              defaultValue: "What they actually wear, at home and out.",
            })}
            className={`${textareaClass} !min-h-0`}
          />
        </SlpAssistedField>
        <SlpAssistedField
          label={localizeUi("ui.slurp.stageProfile.locations", { context, defaultValue: "Where their life happens" })}
          field="facts"
          value={draft.locations ?? ""}
          accountId={accountId}
          context={`${who}This field is where their life happens: home, where they shoot, places they end up.`}
          onApply={(text) => onChange({ locations: text })}
        >
          <textarea
            aria-label={localizeUi("ui.slurp.stageProfile.locations", {
              context,
              defaultValue: "Where their life happens",
            })}
            rows={2}
            disabled={disabled}
            value={draft.locations ?? ""}
            maxLength={2000}
            onChange={(event) => onChange({ locations: event.target.value })}
            placeholder={localizeUi("ui.slurp.stageProfile.locationsPlaceholder", {
              context,
              defaultValue: "Their flat, where they shoot, the places they keep ending up.",
            })}
            className={`${textareaClass} !min-h-0`}
          />
        </SlpAssistedField>
        <SlpClothingStylePicker
          value={draft.clothingStyle ?? "auto"}
          gender={draft.gender}
          disabled={disabled}
          onChange={(clothingStyle) => onChange({ clothingStyle })}
        />
      </div>
    </>
  );
}
