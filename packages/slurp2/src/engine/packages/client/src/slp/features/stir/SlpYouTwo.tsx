import { CalendarHeart, EyeOff, Eye, HeartCrack, HeartHandshake, HeartOff } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { cn } from "../../../lib/utils";
import { SLP_SPICE_LEVELS } from "../../../../../shared/src/slp/slp-spice.js";
import { SlpButton } from "../../modules/chrome/SlpButton";
import { SlpBreakupAftermathPick } from "../../modules/creator/SlpBreakupAftermath";
import { slpAftermathChoices } from "../../modules/creator/slp-breakup-aftermath";
import { SlpHeartGlyph, SlpSparkleGlyph } from "../../base/chrome/SlpGlyphs";
import { formatRelativeTime, formatUpcomingDay } from "../../base/ui/slp-date-time";
import { useSlpStirDoIt } from "./SlpStirCards";
import { useSlurpStirPreview } from "./slp-stir-hooks";
import type { SlpBreakupAftermath } from "../../../../../shared/src/slp/slp-actions.js";
import type { SlpPlayerCouple as SlurpPlayerCouple } from "../../../../../shared/src/slp/slp-stir.js";

type Steer = "date" | "official" | "patchUp" | "secret" | "public" | "breakUp" | "reunite" | "moveOn" | "forget";

const LADDER = ["sparks", "dating", "together"] as const;

/** An anniversary mark in words: a month, three months, half a year, then years. */
const markLabel = (t: (key: string, options?: Record<string, unknown>) => string, days: number) =>
  days === 30
    ? t("ui.slurp.youTwo.mark.month")
    : days === 90
      ? t("ui.slurp.youTwo.mark.threeMonths")
      : days === 180
        ? t("ui.slurp.youTwo.mark.halfYear")
        : t("ui.slurp.youTwo.mark.years", { count: Math.round(days / 365) });

/**
 * Details › You two (Drama, "your relationship"): in the player's thread with the Creator they are
 * with (or were), the two of them in place of a fan's standing: the stage, the dates that matter, and
 * the moves. Every move is a Stir play, so it is previewed, lands in Recent plays, and has Undo.
 */
export function SlpYouTwo({
  couple,
  name,
  creatorId,
}: {
  couple: SlurpPlayerCouple;
  name: string;
  /** Her account: "Show more" / "Show less" set how far her own posts go. */
  creatorId?: string;
}) {
  const { t, i18n } = useTranslation();
  const titleId = useId();
  const preview = useSlurpStirPreview();
  const doIt = useSlpStirDoIt();
  // #1293: breaking up (or, after it, moving on or forgetting) picks what it leaves behind first.
  const [ending, setEnding] = useState(false);
  const endingTrigger = useRef<HTMLButtonElement | null>(null);
  const [aftermath, setAftermath] = useState<SlpBreakupAftermath>("keep");
  const beginEnding = () => {
    setAftermath(slpAftermathChoices(couple)[0] ?? "keep");
    setEnding(true);
  };
  const over = couple.stage === "split";
  const rocky = couple.stage === "rocky";
  const reached = rocky ? 2 : LADDER.indexOf(couple.stage as (typeof LADDER)[number]);
  const stageWord = over
    ? t(couple.ending === "fizzled" ? "ui.slurp.youTwo.stage.faded" : "ui.slurp.youTwo.stage.ex")
    : t(`ui.slurp.youTwo.stage.${couple.stage}`);

  const play = (step: { action: string; input: Record<string, unknown> }) =>
    preview
      .mutateAsync([step])
      .then(({ cards }) => (cards[0]?.error ? void toast.error(t("ui.slurp.youTwo.cant")) : doIt.run(cards, "sheet")))
      .catch(() => void toast.error(t("ui.slurp.youTwo.cant")));
  const run = (steer: Steer, aftermath?: "moveOn" | "forget") =>
    play({ action: "steer-couple", input: { coupleId: couple.id, steer, ...(aftermath ? { aftermath } : {}) } });
  // Her public side: one step more or less in what her posts show (her spice level).
  const spiceAt = couple.herSpice ? SLP_SPICE_LEVELS.indexOf(couple.herSpice) : -1;
  const shift = (by: 1 | -1) =>
    creatorId && play({ action: "set-spice", input: { accountId: creatorId, level: SLP_SPICE_LEVELS[spiceAt + by] } });

  const moves: { steer: Steer; icon: ReactNode; show: boolean; quiet?: boolean }[] = [
    { steer: "reunite", icon: <SlpHeartGlyph size={15} aria-hidden="true" />, show: over },
    { steer: "patchUp", icon: <HeartHandshake size={15} aria-hidden="true" />, show: rocky },
    {
      steer: "official",
      icon: <SlpSparkleGlyph size={15} aria-hidden="true" />,
      show: couple.stage === "sparks" || couple.stage === "dating",
    },
    { steer: "date", icon: <CalendarHeart size={15} aria-hidden="true" />, show: !over && !rocky },
    { steer: "secret", icon: <EyeOff size={15} aria-hidden="true" />, show: !over && !couple.secret },
    { steer: "public", icon: <Eye size={15} aria-hidden="true" />, show: !over && couple.secret },
    { steer: "breakUp", icon: <HeartCrack size={15} aria-hidden="true" />, show: !over, quiet: true },
  ];

  const facts = [
    couple.togetherAt && !over
      ? t("ui.slurp.youTwo.since", { when: formatRelativeTime(couple.togetherAt, i18n.language) })
      : null,
    couple.nextAnniversary
      ? t("ui.slurp.youTwo.anniversary", {
          label: markLabel(t, couple.nextAnniversary.days),
          when: formatUpcomingDay(couple.nextAnniversary.at, i18n.language),
        })
      : null,
    couple.lastDate
      ? t("ui.slurp.youTwo.lastDate", {
          what: couple.lastDate.detail,
          when: formatRelativeTime(couple.lastDate.at, i18n.language),
        })
      : null,
    couple.lastFight && (rocky || over)
      ? t("ui.slurp.youTwo.lastFight", { what: couple.lastFight.detail || t("ui.slurp.youTwo.aFight") })
      : null,
  ].filter((fact): fact is string => Boolean(fact));

  return (
    <section aria-labelledby={titleId} data-slp-you-two className="border-b border-[var(--noodle-divider)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={titleId} className="text-xs font-semibold text-[var(--slurp-muted)]">
            {t("ui.slurp.youTwo.title", { name })}
          </h2>
          <p className="mt-0.5 text-xl font-extrabold leading-[26px]">{stageWord}</p>
          {rocky && <p className="mt-0.5 text-xs text-[var(--slurp-warning)]">{t("ui.slurp.youTwo.rocky")}</p>}
        </div>
        {couple.secret && !over && (
          <span className="inline-flex min-h-6 shrink-0 items-center gap-1 rounded-full bg-[var(--slurp-surface)] px-2 text-[11px] font-bold">
            <EyeOff size={12} aria-hidden="true" />
            {t("ui.slurp.youTwo.secretBadge")}
          </span>
        )}
      </div>

      {/* Crush → dating → together. After a breakup the ladder stays, faded: it is what you had. */}
      <ol className={cn("mt-4 grid grid-cols-3 gap-1.5", over && "opacity-50")}>
        {LADDER.map((stage, index) => (
          <li key={stage} className="min-w-0">
            <span
              aria-hidden="true"
              className={cn(
                "block h-1.5 rounded-full",
                index <= reached
                  ? rocky && index === 2
                    ? "bg-[var(--slurp-warning)]"
                    : "bg-[var(--noodle-accent)]"
                  : "bg-[var(--slurp-outline)]",
              )}
            />
            <span
              className={cn(
                "mt-1 block truncate text-[11px]",
                index === reached && !over ? "font-bold text-[var(--slurp-text)]" : "text-[var(--slurp-muted)]",
              )}
              aria-current={index === reached && !over ? "step" : undefined}
            >
              {t(`ui.slurp.youTwo.stage.${stage}`)}
            </span>
          </li>
        ))}
      </ol>

      {facts.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-[var(--slurp-muted)]">
          {facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      )}

      {couple.herWeek && !over && (
        // What everyone else sees of her: you are with a Creator, and her page is part of it.
        <div className="mt-4 rounded-2xl bg-[var(--slurp-surface)] p-3">
          <p className="text-xs font-semibold text-[var(--slurp-muted)]">
            {t("ui.slurp.youTwo.public.title", { name })}
          </p>
          <p className="mt-1 text-sm">
            {t("ui.slurp.youTwo.public.week", { posts: couple.herWeek.posts, paid: couple.herWeek.paid })}
          </p>
          {couple.herSpice && (
            <p className="text-xs text-[var(--slurp-muted)]">
              {t("ui.slurp.youTwo.public.level", { level: t(`ui.slurp.spice.levels.${couple.herSpice}`) })}
            </p>
          )}
          {creatorId && spiceAt >= 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {spiceAt < SLP_SPICE_LEVELS.length - 1 && (
                <SlpButton
                  variant="secondary"
                  disabled={preview.isPending || doIt.pending}
                  onClick={() => void shift(1)}
                  className="min-h-11 px-4 text-sm"
                >
                  <Eye size={15} aria-hidden="true" />
                  {t("ui.slurp.youTwo.public.more")}
                </SlpButton>
              )}
              {spiceAt > 0 && (
                <SlpButton
                  variant="tertiary"
                  disabled={preview.isPending || doIt.pending}
                  onClick={() => void shift(-1)}
                  className="min-h-11 px-4 text-sm"
                >
                  <EyeOff size={15} aria-hidden="true" />
                  {t("ui.slurp.youTwo.public.less")}
                </SlpButton>
              )}
            </div>
          )}
        </div>
      )}

      {!ending && (
        <div className="mt-3 flex flex-wrap gap-2">
          {moves
            .filter((move) => move.show)
            .map((move) => (
              <SlpButton
                key={move.steer}
                ref={move.steer === "breakUp" ? endingTrigger : undefined}
                variant={move.quiet ? "tertiary" : "secondary"}
                disabled={preview.isPending || doIt.pending}
                onClick={() => (move.steer === "breakUp" ? beginEnding() : void run(move.steer))}
                className="min-h-11 px-4 text-sm"
              >
                {move.icon}
                {t(`ui.slurp.youTwo.move.${move.steer}`)}
              </SlpButton>
            ))}
          {over && (
            <SlpButton
              variant="tertiary"
              disabled={preview.isPending || doIt.pending}
              ref={endingTrigger}
              onClick={beginEnding}
              className="min-h-11 px-4 text-sm"
            >
              <HeartOff size={15} aria-hidden="true" />
              {t("ui.slurp.breakup.afterwards")}
            </SlpButton>
          )}
        </div>
      )}
      {over && couple.aftermath && (
        <p className="mt-2 text-xs text-[var(--slurp-muted)]">{t(`ui.slurp.breakup.state.${couple.aftermath}`)}</p>
      )}
      {ending && (
        <div className="mt-3 space-y-3">
          <SlpBreakupAftermathPick
            label={t(over ? "ui.slurp.breakup.aftermath.labelEx" : "ui.slurp.breakup.aftermath.label")}
            options={slpAftermathChoices(couple)}
            value={aftermath}
            onChange={setAftermath}
          />
          {(over || !couple.pageOpen) && (
            <p className="text-xs text-[var(--slurp-muted)]">{t("ui.slurp.breakup.undoHint")}</p>
          )}
          <div className="flex gap-2">
            <SlpButton
              variant="quiet"
              className="flex-1"
              disabled={preview.isPending || doIt.pending}
              onClick={() => {
                setEnding(false);
                requestAnimationFrame(() => endingTrigger.current?.focus());
              }}
            >
              {t("ui.slurp.breakup.cancel")}
            </SlpButton>
            <SlpButton
              variant="danger"
              className="flex-1"
              disabled={preview.isPending || doIt.pending}
              onClick={() => {
                setEnding(false);
                void (over ? run(aftermath as Steer) : run("breakUp", aftermath === "keep" ? undefined : aftermath));
              }}
            >
              {t(over ? "ui.slurp.breakup.apply" : "ui.slurp.youTwo.move.breakUp")}
            </SlpButton>
          </div>
        </div>
      )}
    </section>
  );
}
