// ──────────────────────────────────────────────
// Otome Forge: Dates. Pick who to spend time with, then one of the four activities: Read {{name}}, Read Me (#1945),
// Date Night (Make it right during a rupture) and the Claw Machine, each with what it pays and what it costs; today's
// capped rewards; and the plush shelf. Play is never limited, only the day's rewards are (plan M5, design: Mini-games).
// ──────────────────────────────────────────────
// GET /runs/:run/play → PlayView (S/routes/claw.ts). Each activity is a screen of its own that OtomeForgeView opens
// with ActivityScreenProps; one that has not arrived yet in this build shows its card without a Play button.
import { useEffect, useId, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarHeart,
  Eye,
  Feather,
  Heart,
  NotebookPen,
  RotateCcw,
  Sparkles,
  Star,
  Wine,
  type LucideIcon,
} from "lucide-react";
import { useOtomeApi } from "../../api";
import { Avatar } from "../../components/Avatar";
import { PlushShelf, withPlush } from "../../components/PlushShelf";
import { runPath } from "../../hooks/use-reader";
import { accentOf } from "../../lib/accent";
import type { RunLiView, RunView } from "../../shared/api-types";
import { PLUSH_SERIES, liPlushId, type PlayView } from "../../shared/claw";
import { AFFECTION_EARNINGS, STARLIGHT_EARNINGS } from "../../shared/economy";

export const DATE_ACTIVITIES = ["read-him", "read-me", "date-night", "claw"] as const;
export type DateActivity = (typeof DATE_ACTIVITIES)[number];

/** What OtomeForgeView gives each activity's screen: the run, the love interest it is played with, and the way back. */
export interface ActivityScreenProps {
  runKey: string;
  view: RunView;
  li: RunLiView;
  onExit: () => void;
}

export const playQueryKey = (runKey: string) => ["otome-forge", "play", runKey] as const;

/** GET /runs/:run/play: today's capped earnings, the shelf, and how each love interest plays. */
export function usePlay(runKey: string) {
  const otome = useOtomeApi();
  return useQuery({
    queryKey: playQueryKey(runKey),
    queryFn: () => otome.get<PlayView>(`${runPath(runKey)}/play`),
  });
}

interface ActivityCopy {
  Icon: LucideIcon;
  title: string;
  /** Date Night's title during a rupture. */
  repairTitle?: string;
  text: string;
  repairText?: string;
  cost: string;
  CostIcon: LucideIcon;
}

// Literal keys, so the locale validator sees each one.
const ACTIVITY_COPY: Record<DateActivity, ActivityCopy> = {
  "read-him": {
    Icon: Eye,
    title: "ui.otomeForge.dates.readTitle",
    text: "ui.otomeForge.dates.readText",
    cost: "ui.otomeForge.dates.readCost",
    CostIcon: Feather,
  },
  "read-me": {
    Icon: NotebookPen,
    title: "ui.otomeForge.dates.readMeTitle",
    text: "ui.otomeForge.dates.readMeText",
    cost: "ui.otomeForge.dates.readMeCost",
    CostIcon: Feather,
  },
  "date-night": {
    Icon: Wine,
    title: "ui.otomeForge.dates.dateTitle",
    repairTitle: "ui.otomeForge.dates.repairTitle",
    text: "ui.otomeForge.dates.dateText",
    repairText: "ui.otomeForge.dates.repairText",
    cost: "ui.otomeForge.dates.dateCost",
    CostIcon: Feather,
  },
  claw: {
    Icon: Heart,
    title: "ui.otomeForge.dates.clawTitle",
    text: "ui.otomeForge.dates.clawText",
    cost: "ui.otomeForge.dates.clawCost",
    CostIcon: Sparkles,
  },
};

/** What each activity pays (SH/economy.ts), within the day's caps. */
const REWARDS: Record<DateActivity, { key: string; values: Record<string, number> }> = {
  "read-him": {
    key: "ui.otomeForge.dates.rewardFlat",
    values: { starlight: STARLIGHT_EARNINGS.readHim, affection: AFFECTION_EARNINGS.readHim },
  },
  // A set's pay, and more affection for each guess spot on or close.
  "read-me": {
    key: "ui.otomeForge.dates.rewardReadMe",
    values: {
      starlight: STARLIGHT_EARNINGS.readMe,
      affection: AFFECTION_EARNINGS.readMe,
      right: AFFECTION_EARNINGS.readMeRight,
      close: AFFECTION_EARNINGS.readMeClose,
    },
  },
  "date-night": {
    key: "ui.otomeForge.dates.rewardFlat",
    values: { starlight: STARLIGHT_EARNINGS.date, affection: AFFECTION_EARNINGS.date },
  },
  claw: {
    key: "ui.otomeForge.dates.rewardClaw",
    values: {
      starlight: STARLIGHT_EARNINGS.clawRound,
      plush: STARLIGHT_EARNINGS.clawPlush,
      affection: AFFECTION_EARNINGS.clawRound,
    },
  },
};

interface DatesHubProps {
  runKey: string;
  view: RunView;
  /** The love interest picked here (kept by OtomeForgeView, so a game's Back returns to the same one). */
  li: string | null;
  onPickLi: (li: string) => void;
  /** The activities this build can open. */
  available: ReadonlySet<DateActivity>;
  onPlay: (activity: DateActivity, li: string) => void;
}

function Meter({ label, value, max }: { label: string; value: number; max: number }) {
  const shown = Math.min(value, max);
  return (
    <div className="of-meter">
      <div className="of-meter-head">
        <span>{label}</span>
        <span className="of-meter-value">
          {shown} / {max}
        </span>
      </div>
      <div
        className="of-meter-bar"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={shown}
      >
        <span style={{ inlineSize: `${max ? (shown / max) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

export function DatesHub({ runKey, view, li, onPickLi, available, onPlay }: DatesHubProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const play = usePlay(runKey);
  const shelfId = useId();
  const partner = view.lis.find((item) => item.id === li) ?? view.lis[0] ?? null;

  // A love interest the run no longer has, or none picked yet: the first of the cast.
  useEffect(() => {
    if (partner && partner.id !== li) onPickLi(partner.id);
  }, [li, onPickLi, partner]);

  const data = play.data ?? null;
  // Date Night is Make it right by the open date's own plan, else by a rupture (S/minigames/date-night.ts).
  const makeItRight = !!(partner && data?.lis[partner.id]?.makeItRight);
  const plush = data?.plush ?? {};
  const slots = [...PLUSH_SERIES, ...view.lis.map((item) => liPlushId(item.id))];
  const owned = slots.filter((prize) => (plush[prize] ?? 0) > 0).length;

  return (
    <div className="of-page of-dates">
      <div className="of-page-head">
        <div className="of-emblem of-glass" aria-hidden="true">
          <CalendarHeart size={30} strokeWidth={1.6} />
        </div>
        <h1 className="of-title" tabIndex={-1}>
          {t("ui.otomeForge.common.screenDates")}
        </h1>
        <p className="of-hand">{t("ui.otomeForge.dates.note")}</p>
      </div>

      {view.lis.length === 0 ? (
        <p className="of-empty">{t("ui.otomeForge.dates.noCast")}</p>
      ) : (
        <fieldset className="of-section of-glass of-partners">
          <legend className="of-section-title">{t("ui.otomeForge.dates.pickTitle")}</legend>
          <div className="of-partner-list">
            {view.lis.map((item) => {
              const accent = accentOf(item);
              const checked = item.id === partner?.id;
              return (
                <label
                  key={item.id}
                  className="of-partner"
                  data-checked={checked}
                  style={{ "--of-li-accent": accent } as CSSProperties}
                >
                  <input
                    type="radio"
                    className="of-visually-hidden"
                    name={`of-dates-partner-${runKey}`}
                    value={item.id}
                    checked={checked}
                    onChange={() => onPickLi(item.id)}
                  />
                  <Avatar name={item.name} url={item.portrait} accent={accent} size={46} />
                  <span className="of-partner-name">{item.name}</span>
                  <span className="of-partner-level">
                    <Heart size={10} strokeWidth={2} fill="currentColor" aria-hidden="true" />
                    {t("ui.otomeForge.story.level", { level: item.level })}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {partner ? (
        <>
          <section className="of-section of-glass" aria-labelledby={`${shelfId}-today`}>
            <h2 id={`${shelfId}-today`} className="of-section-title">
              {t("ui.otomeForge.dates.todayTitle")}
            </h2>
            {data ? (
              <>
                <Meter
                  label={t("ui.otomeForge.dates.todayStarlight")}
                  value={data.starlight.earned}
                  max={data.starlight.cap}
                />
                <Meter
                  label={t("ui.otomeForge.dates.todayAffection", { name: partner.name })}
                  value={data.affection.earned[partner.id] ?? 0}
                  max={data.affection.cap}
                />
                <p className="of-hint">{t("ui.otomeForge.dates.todayNote")}</p>
              </>
            ) : play.isError ? (
              <div className="of-inline-actions" role="alert">
                <p className="of-hint">{otome.errorMessage(play.error, "ui.otomeForge.dates.loadFailed")}</p>
                <button
                  type="button"
                  className="of-button of-button--quiet of-glass of-button--small"
                  onClick={() => void play.refetch()}
                >
                  <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
                  {t("ui.otomeForge.common.retry")}
                </button>
              </div>
            ) : (
              <p className="of-hint" role="status">
                {t("ui.otomeForge.common.loading")}
              </p>
            )}
          </section>

          <ul className="of-activities" aria-label={t("ui.otomeForge.dates.activitiesLabel", { name: partner.name })}>
            {DATE_ACTIVITIES.map((activity) => {
              const copy = ACTIVITY_COPY[activity];
              const repair = activity === "date-night" && makeItRight;
              const title = t(repair && copy.repairTitle ? copy.repairTitle : copy.title, { name: partner.name });
              const reward = REWARDS[activity];
              const ready = available.has(activity);
              return (
                <li
                  key={activity}
                  className="of-activity of-glass"
                  data-activity={activity}
                  data-repair={repair || undefined}
                  style={{ "--of-li-accent": accentOf(partner) } as CSSProperties}
                >
                  <span className="of-activity-icon" aria-hidden="true">
                    <copy.Icon size={22} strokeWidth={1.8} />
                  </span>
                  <div className="of-activity-body">
                    <h2 className="of-activity-title">{title}</h2>
                    <p className="of-activity-text">
                      {t(repair && copy.repairText ? copy.repairText : copy.text, { name: partner.name })}
                    </p>
                    <p className="of-activity-reward">
                      <Star size={12} strokeWidth={2} fill="currentColor" aria-hidden="true" />
                      <span>{t(reward.key, { ...reward.values, name: partner.name })}</span>
                    </p>
                    <p className="of-cost">
                      <copy.CostIcon size={13} strokeWidth={2} aria-hidden="true" />
                      <span>{t(copy.cost)}</span>
                    </p>
                  </div>
                  {ready ? (
                    <button
                      type="button"
                      className="of-button of-button--primary of-button--small of-activity-play"
                      aria-label={t("ui.otomeForge.dates.playLabel", { title })}
                      onClick={() => onPlay(activity, partner.id)}
                    >
                      {t("ui.otomeForge.dates.play")}
                    </button>
                  ) : (
                    <span className="of-badge of-badge--soft of-activity-play">{t("ui.otomeForge.dates.soon")}</span>
                  )}
                </li>
              );
            })}
          </ul>

          <section className="of-section of-glass" aria-labelledby={`${shelfId}-shelf`}>
            <div className="of-shelf-head">
              <h2 id={`${shelfId}-shelf`} className="of-section-title">
                {t("ui.otomeForge.claw.shelfTitle")}
              </h2>
              <span className="of-badge of-badge--soft">
                {t("ui.otomeForge.claw.shelfCount", { owned, total: slots.length })}
              </span>
            </div>
            <PlushShelf
              plush={plush}
              lis={view.lis.map((entry) => withPlush(entry, play.data))}
              labelledBy={`${shelfId}-shelf`}
            />
          </section>
        </>
      ) : null}
    </div>
  );
}
