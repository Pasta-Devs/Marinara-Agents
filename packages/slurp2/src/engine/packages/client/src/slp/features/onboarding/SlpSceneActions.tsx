// The row above the scene's composer, kept short on purpose (onboarding pass 2): the best reply for
// this moment (highlighted, so the first tap is obvious), two more, "Next" once a moment is done,
// and one "More" sheet for everything else: let it play, direction, update page, other replies and
// the moments.
import { useState } from "react";
import { Check, Compass, MoreHorizontal, Play, Square } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { SlpSceneActionId } from "../../../../../shared/src/slp/slp-scene.js";
import { cn } from "../../../lib/utils";
import { SLP_TYPE } from "../../base/chrome/SlpChrome";
import { SlpSparkleGlyph } from "../../base/chrome/SlpGlyphs";
import { SlpUsesAiMark } from "../../modules/chrome/SlpAiMark";
import { SlpButton, SlpChip, SlpPrimaryButton } from "../../modules/chrome/SlpButton";
import { SlpSheet } from "../../modules/chrome/SlpSheet";
import { slpSceneSuggestions } from "./slp-scene-draft";
import type { SlpSceneModel } from "./slp-scene-model";

/** Turns one "Let it play" press runs. */
export const SLP_SCENE_AUTOPILOT_TURNS = 3;
/** Suggested replies in the row; the rest wait in "More". */
const SLP_SCENE_ROW_SUGGESTIONS = 3;

export function SlpSceneActions({ model }: { model: SlpSceneModel }) {
  const { t } = useUiTranslation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [directionOpen, setDirectionOpen] = useState(false);
  const [draft, setDraft] = useState(model.direction);
  const running = model.autoLeft > 0;
  const preset = model.setup.preset;
  const next = model.moments[model.moments.indexOf(model.moment) + 1];
  // The scene moves on by itself once a moment is done; "Next" is there when it waits (the photo
  // shoot before the photos) or has gone two exchanges without settling, so there is no dead end.
  const showNext = Boolean(next) && (model.doneMoments.includes(model.moment) || model.lingering);
  const suggestions = slpSceneSuggestions(preset, model.moment);
  // Outfit and place are picked: the shoot card's "Take the photos" is the move now, not a reply.
  const shootReady =
    model.moment === "shoot" &&
    !model.photos.avatarUrl &&
    Boolean(model.draft.wardrobe.trim() || model.draft.locations.trim());
  const inRow = suggestions.slice(0, SLP_SCENE_ROW_SUGGESTIONS - (showNext ? 1 : 0));
  const inMore = suggestions.filter((id) => !inRow.includes(id));
  const chip = "min-h-11 shrink-0 whitespace-nowrap px-3.5";
  const suggest = (id: SlpSceneActionId) => void model.send({ kind: "suggest", id });
  const openDirection = () => {
    setMoreOpen(false);
    setDraft(model.direction);
    setDirectionOpen(true);
  };
  return (
    <>
      {!model.acted && !model.busy && (
        <p className={cn(SLP_TYPE.meta, "px-1 pt-2 text-pretty text-[var(--slurp-muted)]")}>
          {t(`ui.slurp.scene.yourTurn.${preset === "seat" ? "seat" : "host"}`)}
        </p>
      )}
      <div role="toolbar" aria-label={t("ui.slurp.scene.actionsLabel")} className="flex items-center gap-1.5 pt-2">
        {/* Replies scroll; "More" stays put at the end so it is always one tap away. */}
        <div className="-ms-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto ps-1 [scrollbar-width:none]">
          {running ? (
            <SlpChip selected className={chip} onClick={model.stopAutopilot}>
              <Square size={12} aria-hidden="true" />
              {t("ui.slurp.scene.autopilotStop", { count: model.autoLeft })}
            </SlpChip>
          ) : (
            <>
              {showNext && next && (
                <SlpChip
                  selected
                  data-slp-scene-first=""
                  className={chip}
                  disabled={model.busy}
                  onClick={() => model.goTo(next)}
                >
                  {t("ui.slurp.scene.next", { moment: t(`ui.slurp.scene.moment.${next}`) })}
                </SlpChip>
              )}
              {inRow.map((id, index) => {
                // The best fit for this moment leads, lit up, unless "Next" already is the obvious tap.
                const lead = index === 0 && !showNext && !shootReady;
                return (
                  <SlpChip
                    key={id}
                    selected={lead}
                    data-slp-scene-first={lead ? "" : undefined}
                    className={chip}
                    disabled={model.busy}
                    onClick={() => suggest(id)}
                  >
                    {lead && <SlpSparkleGlyph size={12} aria-hidden="true" className="shrink-0" />}
                    {t(`ui.slurp.scene.action.${id}`)}
                  </SlpChip>
                );
              })}
            </>
          )}
        </div>
        <SlpChip
          className={cn(chip, "px-3")}
          selected={Boolean(model.direction) && !running}
          aria-haspopup="dialog"
          onClick={() => setMoreOpen(true)}
        >
          <MoreHorizontal size={14} aria-hidden="true" />
          {t("ui.slurp.scene.more")}
        </SlpChip>
      </div>
      <SlpSheet open={moreOpen} onClose={() => setMoreOpen(false)} title={t("ui.slurp.scene.moreTitle")}>
        <div className="space-y-4 px-1 pb-4">
          <div className="space-y-1">
            <MoreRow
              icon={<Play size={16} aria-hidden="true" />}
              label={t("ui.slurp.scene.autopilot")}
              detail={t("ui.slurp.scene.autopilotHint", { count: SLP_SCENE_AUTOPILOT_TURNS })}
              disabled={model.busy}
              onClick={() => {
                setMoreOpen(false);
                void model.autopilot(SLP_SCENE_AUTOPILOT_TURNS);
              }}
            />
            <MoreRow
              icon={<Compass size={16} aria-hidden="true" />}
              label={t("ui.slurp.scene.direction")}
              detail={model.direction || t("ui.slurp.scene.more.directionHelp")}
              onClick={openDirection}
            />
            <MoreRow
              icon={<SlpUsesAiMark />}
              label={t("ui.slurp.scene.page.update")}
              detail={t("ui.slurp.scene.more.updateHelp")}
              disabled={model.busy}
              onClick={() => {
                setMoreOpen(false);
                void model.updatePage();
              }}
            />
          </div>
          {inMore.length > 0 && (
            <div>
              <p className={cn(SLP_TYPE.meta, "mb-1.5 px-1 font-semibold text-[var(--slurp-muted)]")}>
                {t("ui.slurp.scene.more.replies")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {inMore.map((id) => (
                  <SlpChip
                    key={id}
                    className={chip}
                    disabled={model.busy}
                    onClick={() => {
                      setMoreOpen(false);
                      suggest(id);
                    }}
                  >
                    {t(`ui.slurp.scene.action.${id}`)}
                  </SlpChip>
                ))}
              </div>
            </div>
          )}
          {/* Support asks in order; the other roles can skip, go back or linger in any moment. */}
          {preset !== "support" && (
            <div>
              <p className={cn(SLP_TYPE.meta, "mb-1.5 px-1 font-semibold text-[var(--slurp-muted)]")}>
                {t("ui.slurp.scene.momentsLabel")}
              </p>
              <div role="toolbar" aria-label={t("ui.slurp.scene.momentsLabel")} className="flex flex-wrap gap-1.5">
                {model.moments.map((entry) => (
                  <SlpChip
                    key={entry}
                    selected={entry === model.moment}
                    aria-current={entry === model.moment ? "step" : undefined}
                    disabled={model.busy}
                    className={chip}
                    onClick={() => {
                      setMoreOpen(false);
                      model.goTo(entry);
                    }}
                  >
                    {model.doneMoments.includes(entry) && <Check size={12} aria-hidden="true" />}
                    {t(`ui.slurp.scene.moment.${entry}`)}
                  </SlpChip>
                ))}
              </div>
            </div>
          )}
        </div>
      </SlpSheet>
      <SlpSheet
        open={directionOpen}
        onClose={() => setDirectionOpen(false)}
        title={t("ui.slurp.scene.directionTitle")}
        footer={
          <div className="flex justify-end gap-2">
            {model.direction && (
              <SlpButton
                variant="tertiary"
                onClick={() => {
                  model.setDirection("");
                  setDirectionOpen(false);
                }}
              >
                {t("ui.slurp.scene.directionClear")}
              </SlpButton>
            )}
            <SlpPrimaryButton
              onClick={() => {
                model.setDirection(draft.trim());
                setDirectionOpen(false);
              }}
            >
              {t("ui.slurp.scene.directionSave")}
            </SlpPrimaryButton>
          </div>
        }
      >
        <div className="space-y-2 px-1 pb-2">
          <p className={cn(SLP_TYPE.body, "text-pretty text-[var(--slurp-muted)]")}>
            {t("ui.slurp.scene.directionHelp")}
          </p>
          <textarea
            aria-label={t("ui.slurp.scene.directionTitle")}
            value={draft}
            maxLength={300}
            rows={3}
            placeholder={t("ui.slurp.scene.directionPlaceholder")}
            onChange={(event) => setDraft(event.target.value)}
            className="w-full resize-y rounded-xl bg-[var(--slurp-canvas)] px-3 py-2 text-base text-[var(--slurp-text)] outline-none ring-1 ring-inset ring-[var(--noodle-divider)] placeholder:text-[var(--slurp-muted)] focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-[13px]"
          />
        </div>
      </SlpSheet>
    </>
  );
}

function MoreRow({
  icon,
  label,
  detail,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  detail: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2 text-start transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--slurp-tint)] text-[var(--slurp-ink)] [&_svg]:!text-current">
        {icon}
      </span>
      <span className="min-w-0">
        <span className={cn(SLP_TYPE.body, "block font-semibold")}>{label}</span>
        <span className={cn(SLP_TYPE.meta, "line-clamp-2 block text-pretty text-[var(--slurp-muted)]")}>{detail}</span>
      </span>
    </button>
  );
}
