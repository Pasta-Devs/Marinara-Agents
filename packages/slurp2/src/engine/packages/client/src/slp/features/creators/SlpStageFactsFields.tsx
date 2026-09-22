import { useTranslation as useUiTranslation } from "react-i18next";
import type { SlurpStageProfileInput } from "../../base/state/slp-state-types";
import { textareaClass } from "../../modules/post/SlpPostHelpers";

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
}: {
  draft: SlurpStageProfileInput;
  disabled: boolean;
  onChange: (patch: Partial<SlurpStageProfileInput>) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <>
      {/* What she looks like and where her life happens, stored on the Creator.
        Appearance is the one that stops her being a different person in every picture: it is
        sent with every image whether or not the source card is being used. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-xs font-semibold">
            {localizeUi("ui.slurp.stageProfile.appearance", { defaultValue: "Appearance" })}
          </span>
          <textarea
            rows={3}
            disabled={disabled}
            value={draft.appearance ?? ""}
            maxLength={2000}
            onChange={(event) => onChange({ appearance: event.target.value })}
            placeholder={localizeUi("ui.slurp.stageProfile.appearancePlaceholder", {
              defaultValue: "Body, face, hair, marks — the things that must look the same in every picture.",
            })}
            className={`${textareaClass} !min-h-0`}
          />
          <span className="block text-[0.7rem] leading-5 text-[var(--muted-foreground)]">
            {localizeUi("ui.slurp.stageProfile.appearanceDetail", {
              defaultValue: "Sent with every picture. Left empty, the image model invents somebody new each post.",
            })}
          </span>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold">
            {localizeUi("ui.slurp.stageProfile.wardrobe", { defaultValue: "Usual wardrobe" })}
          </span>
          <textarea
            rows={2}
            disabled={disabled}
            value={draft.wardrobe ?? ""}
            maxLength={2000}
            onChange={(event) => onChange({ wardrobe: event.target.value })}
            placeholder={localizeUi("ui.slurp.stageProfile.wardrobePlaceholder", {
              defaultValue: "What she actually wears, at home and out.",
            })}
            className={`${textareaClass} !min-h-0`}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold">
            {localizeUi("ui.slurp.stageProfile.locations", { defaultValue: "Where her life happens" })}
          </span>
          <textarea
            rows={2}
            disabled={disabled}
            value={draft.locations ?? ""}
            maxLength={2000}
            onChange={(event) => onChange({ locations: event.target.value })}
            placeholder={localizeUi("ui.slurp.stageProfile.locationsPlaceholder", {
              defaultValue: "Her flat, where she shoots, the places she keeps ending up.",
            })}
            className={`${textareaClass} !min-h-0`}
          />
        </label>
      </div>
    </>
  );
}
