import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { SLP_TYPE } from "../../base/chrome/SlpChrome";
import { formatRelativeTime } from "../../base/ui/slp-date-time";
import type { SlpPulseTarget } from "../../base/state/slp-task-store";
import { SlpButton } from "../../modules/chrome/SlpButton";
import { SLP_CARD_STACK_CLASS } from "../../modules/post/SlpPostHelpers";
import type { SlpActionName } from "../../../../../shared/src/slp/slp-actions.js";
import type { SlpStirPlay, SlpStirView } from "../../../../../shared/src/slp/slp-stir.js";
import { useSlpStirUndo } from "./SlpStirCards";
import { slpStirPlayCollab, slpStirPlayTarget } from "./slp-stir-screen-model";

/**
 * "Recent plays" (0.3.1): what the player made happen, newest first, with Undo while it can still
 * be taken back and a way to what it touched. The ledger keeps a short memory, not history.
 */
export function SlpStirRecentPlays({
  plays,
  collabs,
  creators,
  onOpenTarget,
  onOpen,
}: {
  plays: SlpStirPlay[];
  /** Step 1: a collab play says how it is going and opens its joint post. */
  collabs?: SlpStirView["playedCollabs"];
  creators: SlpStirView["creators"];
  onOpenTarget?: (target: SlpPulseTarget) => void;
  onOpen: (lever: { action: SlpActionName; pick: string }) => void;
}) {
  const { t, i18n } = useTranslation();
  const [all, setAll] = useState(false);
  const undo = useSlpStirUndo();
  const names = new Map(creators.map((creator) => [creator.id, creator.name]));
  if (!plays.length) return null;
  const shown = all ? plays : plays.slice(0, 4);
  return (
    <section aria-labelledby="slp-stir-recent" className="space-y-2" data-slp-stir-recent>
      <div className="flex items-center justify-between px-1">
        <h2 id="slp-stir-recent" className={SLP_TYPE.title}>
          {t("ui.slurp.stir.recent")}
        </h2>
        {plays.length > shown.length && (
          <SlpButton variant="tertiary" onClick={() => setAll(true)} className="min-h-11 text-xs">
            {t("ui.slurp.stir.recentAll")}
          </SlpButton>
        )}
      </div>
      <ul className={SLP_CARD_STACK_CLASS}>
        {shown.map((play) => {
          const first = play.steps[0];
          const collab = slpStirPlayCollab(play, collabs);
          // A push names only the collab id: its pair comes from the collab record.
          const who = [
            ...new Set(
              [
                ...play.steps.flatMap((step) =>
                  ["accountId", "aId", "bId", "fromId", "toId", "withIds"].flatMap((key) => [step.input[key]].flat()),
                ),
                collab?.hostId,
                collab?.partnerId,
              ].flatMap((id) => (typeof id === "string" && names.has(id) ? [names.get(id)!] : [])),
            ),
          ];
          const failed = play.steps.filter((step) => !step.ok).length;
          const target = onOpenTarget ? (collab?.target ?? slpStirPlayTarget(play)) : null;
          const title = first
            ? play.steps.length > 1
              ? t("ui.slurp.stir.taskLabelMore", {
                  what: t(`ui.slurp.stir.card.${first.action}.title`, { defaultValue: first.action }),
                  count: play.steps.length - 1,
                })
              : t(`ui.slurp.stir.card.${first.action}.title`, { defaultValue: first.action })
            : "";
          const status = play.undone
            ? t("ui.slurp.stir.recentUndone")
            : failed
              ? t("ui.slurp.stir.recentFailed", { count: failed })
              : null;
          const progress = collab
            ? t(collab.label, {
                host: names.get(collab.hostId ?? "") ?? t("ui.slurp.ties.someone"),
                partner: names.get(collab.partnerId ?? "") ?? t("ui.slurp.ties.someone"),
              })
            : null;
          const undoable = collab ? collab.undoable : play.undoable;
          return (
            <li
              key={play.id}
              className={cn(
                "flex items-center gap-2 rounded-2xl bg-[var(--slurp-surface-raised)] p-2 ps-3 shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)]",
                // With two buttons the status would not fit beside them on a phone: buttons go below.
                collab?.lever && "flex-wrap",
              )}
            >
              <button
                type="button"
                disabled={!target}
                onClick={() => target && onOpenTarget?.(target)}
                className="flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-xl text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:cursor-default"
              >
                <span
                  className={cn(
                    SLP_TYPE.body,
                    "block truncate font-semibold",
                    play.undone && "line-through opacity-70",
                  )}
                >
                  {title}
                </span>
                <span className={cn(SLP_TYPE.meta, "block truncate text-[var(--slurp-muted)]")}>
                  {[who.join(", "), formatRelativeTime(play.at, i18n.language), status].filter(Boolean).join(" · ")}
                </span>
                {progress && (
                  <span className={cn(SLP_TYPE.meta, "line-clamp-2 font-semibold")} data-slp-stir-follow>
                    {progress}
                  </span>
                )}
              </button>
              {(collab?.lever || (undoable && !play.undone)) && (
                <span className={cn("flex shrink-0 gap-1", collab?.lever && "basis-full justify-end")}>
                  {collab?.lever && (
                    <SlpButton
                      variant="quiet"
                      onClick={() => onOpen(collab.lever!)}
                      aria-label={`${t("ui.slurp.ties.push")}: ${t("ui.slurp.stir.pair", {
                        a: names.get(collab.hostId ?? "") ?? t("ui.slurp.ties.someone"),
                        b: names.get(collab.partnerId ?? "") ?? t("ui.slurp.ties.someone"),
                      })}`}
                      className="min-h-11 shrink-0 px-3 text-xs"
                    >
                      {t("ui.slurp.ties.push")}
                    </SlpButton>
                  )}
                  {undoable && !play.undone && (
                    <SlpButton
                      variant="quiet"
                      disabled={undo.pending}
                      onClick={() => void undo.run(play.id)}
                      aria-label={t("ui.slurp.stir.undoPlay", { title })}
                      className="min-h-11 shrink-0 px-3 text-xs"
                    >
                      <RotateCcw size={14} aria-hidden="true" />
                      {t("ui.slurp.wallet.undo", { defaultValue: "Undo" })}
                    </SlpButton>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
