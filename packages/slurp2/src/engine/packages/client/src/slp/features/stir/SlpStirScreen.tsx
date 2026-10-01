import { useState } from "react";
import { ChevronRight, Clapperboard, RotateCcw, Users, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { Avatar, SLP_PAGE_SCROLL_CLASS, SLP_TOP_BAR_CLASS, SLP_TYPE } from "../../base/chrome/SlpChrome";
import { SlpHeartGlyph, SlpSparkleGlyph, SlpStirGlyph } from "../../base/chrome/SlpGlyphs";
import { formatRelativeTime, formatUpcomingDay } from "../../base/ui/slp-date-time";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import type { SlpPulseTarget } from "../../base/state/slp-task-store";
import { SlpButton, SlpChip, SlpSegment } from "../../modules/chrome/SlpButton";
import { SlpSheet } from "../../modules/chrome/SlpSheet";
import { SlpUsesAiMark } from "../../modules/chrome/SlpAiMark";
import { SlpErrorState, SlpSkeleton } from "../../modules/chrome/SlpStateKit";
import { SLP_CARD_STACK_CLASS } from "../../modules/post/SlpPostHelpers";
import {
  SLP_STIR_CATEGORIES,
  type SlpActionName,
  type SlpStirCategory,
} from "../../../../../shared/src/slp/slp-actions.js";
import type {
  SlpActionPreview,
  SlpStirLive,
  SlpStirPlay,
  SlpStirSuggestion,
  SlpStirView,
} from "../../../../../shared/src/slp/slp-stir.js";
import { SlpPeoplePanel } from "../projects/slp-projects-contract";
import { useSlurpStir, useSlurpStirDismiss, useSlurpStirPreview } from "./slp-stir-hooks";
import { SlpStirBox } from "./SlpStirBox";
import { SlpStirPlanSheet, useSlpStirDoIt, useSlpStirUndo } from "./SlpStirCards";
import { SlpYouTwo } from "./SlpYouTwo";
import { SlpStirPlaySheet } from "./SlpStirPlaySheet";
import { SlpStirDesk } from "./SlpStirDesk";
import { useSlurpSettings } from "../settings/slp-settings-contract";
import { SLP_STIR_DECK, SLP_STIR_DECK_ORDER } from "./slp-stir-deck";
import { slpStirDeckNeed, slpStirLiveLever, slpStirPlayTarget } from "./slp-stir-screen-model";

const HINT_KEY = "slurp2:stir-hint-seen";

/** First visit: one short card that says what this place is (dismissed for good). */
function StirHint() {
  const { t } = useTranslation();
  const [shown, setShown] = useState(() => {
    try {
      return !window.localStorage.getItem(HINT_KEY);
    } catch {
      return true;
    }
  });
  if (!shown) return null;
  const hide = () => {
    setShown(false);
    try {
      window.localStorage.setItem(HINT_KEY, "1");
    } catch {
      // Private mode: it shows again next time, which is fine.
    }
  };
  return (
    <section
      data-slp-stir-hint
      className="relative rounded-3xl bg-[image:var(--slurp-nav-active)] p-4 pe-12 ring-1 ring-inset ring-[var(--noodle-accent)]/35"
    >
      <p className={cn(SLP_TYPE.title, "flex items-center gap-2")}>
        <SlpStirGlyph size={16} aria-hidden="true" className="text-[var(--slurp-ink)]" />
        {t("ui.slurp.stir.hint.title")}
      </p>
      <p className={cn(SLP_TYPE.body, "mt-1 text-[var(--slurp-text)]")}>{t("ui.slurp.stir.hint.body")}</p>
      <p className={cn(SLP_TYPE.body, "mt-2 font-semibold text-[var(--slurp-text)]")}>{t("ui.slurp.stir.hint.more")}</p>
      <button
        type="button"
        onClick={hide}
        aria-label={t("ui.slurp.stir.hint.dismiss")}
        className="absolute end-1.5 top-1.5 flex size-11 items-center justify-center rounded-full text-[var(--slurp-muted)] hover:text-[var(--slurp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </section>
  );
}

function Faces({ who }: { who: { id: string; name: string; avatarUrl: string | null }[] }) {
  if (!who.length) return <SlpSparkleGlyph size={20} aria-hidden="true" className="shrink-0 text-[var(--slurp-ink)]" />;
  return (
    <span className="flex shrink-0 -space-x-2" aria-hidden="true">
      {who.slice(0, 2).map((person) => (
        <Avatar
          key={person.id}
          account={{ displayName: person.name, avatarUrl: person.avatarUrl }}
          size="sm"
          className="ring-2 ring-[var(--slurp-surface-raised)]"
        />
      ))}
    </span>
  );
}

/**
 * "Now showing" (0.3.11): everything running in the world, one row each, newest story first: drama
 * packs, couples, rivalries, collabs, events, storylines. A row with something to steer opens that
 * lever; a running drama can end here. The player's own couple is above, in "Your relationship".
 */
function NowShowing({
  view,
  onSeeAll,
  onOpen,
  onEndDrama,
}: {
  view: SlpStirView;
  onSeeAll?: () => void;
  onOpen: (lever: NonNullable<ReturnType<typeof slpStirLiveLever>>) => void;
  onEndDrama: (runId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const byId = new Map(view.creators.map((creator) => [creator.id, creator]));
  const yours = new Set(view.yourCouples.map((entry) => entry.couple.id));
  const live = view.live.filter(
    (entry) => !(entry.kind === "couple" && yours.has(entry.id.slice(entry.id.indexOf(":") + 1))),
  );
  const label = (entry: SlpStirLive) => {
    const [a, b] = entry.who;
    const who = b ? t("ui.slurp.stir.pair", { a: a!.name, b: b.name }) : (a?.name ?? entry.label ?? "");
    const state =
      entry.kind === "ideas"
        ? t("ui.slurp.stir.live.ideas", { count: Number(entry.label) || 0 })
        : t(`ui.slurp.stir.live.${entry.kind}.${entry.state}`);
    return { who, state };
  };
  const row =
    "flex min-h-14 w-full items-center gap-3 rounded-2xl bg-[var(--slurp-surface-raised)] px-3 py-2.5 text-start shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)]";
  const empty = !view.runs.length && !live.length;
  return (
    <section aria-labelledby="slp-stir-now" className="space-y-2" data-slp-stir-now>
      <div className="flex items-center justify-between px-1">
        <h2 id="slp-stir-now" className={SLP_TYPE.title}>
          {t("ui.slurp.stir.now.title")}
        </h2>
        {onSeeAll && (
          <SlpButton variant="tertiary" onClick={onSeeAll} className="min-h-11 text-xs">
            {t("ui.slurp.stir.seeAll")}
          </SlpButton>
        )}
      </div>
      {empty ? (
        <p className={cn(SLP_TYPE.meta, "px-1 text-[var(--slurp-muted)]")}>{t("ui.slurp.stir.inPlayEmpty")}</p>
      ) : (
        <ul className={SLP_CARD_STACK_CLASS}>
          {view.runs.map((run) => {
            const cast = Object.values(run.cast).flatMap((id) => {
              const creator = byId.get(id);
              return creator ? [{ id, name: creator.name, avatarUrl: creator.avatarUrl }] : [];
            });
            return (
              <li key={`drama:${run.id}`} className={row}>
                <span className="relative shrink-0">
                  <Faces who={cast} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn(SLP_TYPE.body, "flex items-center gap-1.5 truncate font-semibold")}>
                    <Clapperboard size={14} aria-hidden="true" className="shrink-0 text-[var(--slurp-ink)]" />
                    <span className="truncate">{run.name}</span>
                  </span>
                  <span className={cn(SLP_TYPE.meta, "block truncate text-[var(--slurp-muted)]")}>
                    {cast.map((person) => person.name).join(", ")}
                  </span>
                </span>
                <SlpButton
                  variant="quiet"
                  onClick={() => onEndDrama(run.id)}
                  className="min-h-11 shrink-0 px-3 text-xs"
                >
                  {t("ui.slurp.stir.now.end")}
                </SlpButton>
              </li>
            );
          })}
          {live.map((entry) => {
            const { who, state } = label(entry);
            const lever = slpStirLiveLever(entry);
            const body = (
              <>
                <Faces who={entry.who} />
                <span className="min-w-0 flex-1">
                  <span className={cn(SLP_TYPE.body, "block truncate font-semibold")}>{who}</span>
                  <span className={cn(SLP_TYPE.meta, "block truncate text-[var(--slurp-muted)]")}>
                    {entry.until
                      ? t("ui.slurp.stir.live.until", { state, day: formatUpcomingDay(entry.until, i18n.language) })
                      : state}
                  </span>
                </span>
                {lever && (
                  <ChevronRight
                    size={16}
                    aria-hidden="true"
                    className="shrink-0 text-[var(--slurp-muted)] rtl:rotate-180"
                  />
                )}
              </>
            );
            return (
              <li key={entry.id}>
                {lever ? (
                  <button
                    type="button"
                    onClick={() => onOpen(lever)}
                    aria-label={`${who}: ${state}. ${t(`ui.slurp.stir.card.${lever.action}.title`)}`}
                    className={cn(
                      row,
                      "transition-shadow hover:shadow-[var(--slurp-shadow-floating),var(--slurp-highlight)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none",
                    )}
                  >
                    {body}
                  </button>
                ) : (
                  <div className={row}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * "Your relationship" (0.3.11): one small row per Creator the player's own page is with, above the
 * world. It stays out of the way of the stories; a tap opens You two with every move.
 */
function YourRelationship({ view }: { view: SlpStirView }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<string | null>(null);
  if (!view.yourCouples.length) return null;
  const shown = view.yourCouples.find((entry) => entry.couple.id === open);
  return (
    <section aria-label={t("ui.slurp.stir.yours.title")} className="space-y-2" data-slp-stir-yours>
      {view.yourCouples.slice(0, 2).map(({ partner, couple }) => (
        <button
          key={couple.id}
          type="button"
          onClick={() => setOpen(couple.id)}
          aria-haspopup="dialog"
          className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-[var(--slurp-surface-raised)] px-3 py-2 text-start shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)] transition-shadow hover:shadow-[var(--slurp-shadow-floating),var(--slurp-highlight)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none"
        >
          <Avatar account={{ displayName: partner.name, avatarUrl: partner.avatarUrl }} size="sm" />
          <span className="min-w-0 flex-1">
            <span className={cn(SLP_TYPE.body, "block truncate font-semibold")}>{partner.name}</span>
            <span className={cn(SLP_TYPE.meta, "block truncate text-[var(--slurp-muted)]")}>
              {t("ui.slurp.stir.yours.title")} ·{" "}
              {couple.stage === "split"
                ? t(couple.ending === "fizzled" ? "ui.slurp.youTwo.stage.faded" : "ui.slurp.youTwo.stage.ex")
                : t(`ui.slurp.youTwo.stage.${couple.stage}`)}
            </span>
          </span>
          <SlpHeartGlyph
            size={16}
            filled={couple.stage !== "split"}
            aria-hidden="true"
            className="shrink-0 text-[var(--slurp-ink)]"
          />
          <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-[var(--slurp-muted)] rtl:rotate-180" />
        </button>
      ))}
      <SlpSheet
        open={Boolean(shown)}
        onClose={() => setOpen(null)}
        title={shown?.partner.name ?? ""}
        width="max-w-lg"
        back
      >
        {shown && <SlpYouTwo couple={shown.couple} name={shown.partner.name} creatorId={shown.partner.id} />}
      </SlpSheet>
    </section>
  );
}

/** Up to three plays that fit what is going on. A ready step previews at once; the rest opens its card. */
function Suggested({
  suggestions,
  onPlay,
  pending,
}: {
  suggestions: SlpStirSuggestion[];
  onPlay: (suggestion: SlpStirSuggestion) => void;
  pending: boolean;
}) {
  const { t } = useTranslation();
  const dismiss = useSlurpStirDismiss();
  if (!suggestions.length) return null;
  return (
    <section aria-labelledby="slp-stir-suggested" className="space-y-2">
      <h2 id="slp-stir-suggested" className={cn(SLP_TYPE.title, "px-1")}>
        {t("ui.slurp.stir.suggested")}
      </h2>
      <ul className={SLP_CARD_STACK_CLASS}>
        {suggestions.map((suggestion) => {
          const [a, b] = suggestion.who;
          return (
            <li
              key={suggestion.id}
              className="flex items-center gap-3 rounded-2xl bg-[var(--slurp-surface-raised)] p-3 shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)]"
            >
              <Faces who={suggestion.who} />
              <p className={cn(SLP_TYPE.body, "min-w-0 flex-1 [overflow-wrap:anywhere]")}>
                {t(`ui.slurp.stir.suggest.${suggestion.kind}`, {
                  a: a?.name ?? "",
                  b: b?.name ?? "",
                  name: a?.name ?? "",
                  label: suggestion.label ?? "",
                  count: Number(suggestion.label) || 0,
                })}
              </p>
              <SlpButton
                disabled={pending}
                onClick={() => onPlay(suggestion)}
                className="min-h-11 shrink-0 px-4 text-xs"
              >
                {t("ui.slurp.stir.play")}
              </SlpButton>
              <button
                type="button"
                disabled={dismiss.isPending}
                onClick={() =>
                  dismiss.mutate(suggestion.id, { onError: (error) => void toast.error(errorMessage(error)) })
                }
                aria-label={t("ui.slurp.stir.notNow")}
                title={t("ui.slurp.stir.notNow")}
                className="-me-1.5 flex size-11 shrink-0 items-center justify-center rounded-full text-[var(--slurp-muted)] hover:bg-[var(--accent)] hover:text-[var(--slurp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * "Recent plays" (0.3.1): what the player made happen, newest first, with Undo while it can still
 * be taken back and a way to what it touched. The ledger keeps a short memory, not history.
 */
function RecentPlays({
  plays,
  creators,
  onOpenTarget,
}: {
  plays: SlpStirPlay[];
  creators: SlpStirView["creators"];
  onOpenTarget?: (target: SlpPulseTarget) => void;
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
          const who = [
            ...new Set(
              play.steps.flatMap((step) =>
                ["accountId", "aId", "bId", "fromId", "toId", "withIds"]
                  .flatMap((key) => [step.input[key]].flat())
                  .flatMap((id) => (typeof id === "string" && names.has(id) ? [names.get(id)!] : [])),
              ),
            ),
          ];
          const failed = play.steps.filter((step) => !step.ok).length;
          const target = onOpenTarget ? slpStirPlayTarget(play) : null;
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
          return (
            <li
              key={play.id}
              className="flex items-center gap-2 rounded-2xl bg-[var(--slurp-surface-raised)] p-2 ps-3 shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)]"
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
              </button>
              {play.undoable && !play.undone && (
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
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * "Start a story" (0.3.11): the drama packs first, then every lever as a one-step story, by genre. A
 * card shows its icon, a name and one line; a card with nothing to act on yet says what it needs.
 * The genres are tabs (arrow keys move between them).
 */
function StartAStory({
  view,
  onPick,
  onStartDrama,
  onOpenSettings,
  onSurprise,
}: {
  view: SlpStirView | undefined;
  onPick: (action: SlpActionName) => void;
  onStartDrama: (dramaId: string) => void;
  onOpenSettings?: () => void;
  onSurprise?: () => void;
}) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<SlpStirCategory>(() => (view?.dramas.length ? "drama" : "love"));
  // Polyamory is a Settings › Stir choice (0.3.5): off, its card stays out of the deck.
  const polyamory = useSlurpSettings().data?.polyamory === true;
  // The packs are the drama cards; "start-drama" is how they play, not a card of its own.
  const cards = SLP_STIR_DECK_ORDER.filter(
    (action) =>
      SLP_STIR_DECK[action].category === category &&
      action !== "start-drama" &&
      (action !== "add-to-couple" || polyamory),
  );
  const running = new Set((view?.runs ?? []).map((run) => run.dramaId));
  const cardClass =
    "group flex h-full min-h-32 w-full flex-col items-start gap-2 rounded-2xl bg-[var(--slurp-surface-raised)] p-3.5 text-start shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)] transition-[transform,box-shadow] duration-[var(--slurp-motion-fast)] hover:shadow-[var(--slurp-shadow-floating),var(--slurp-highlight)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-60 disabled:shadow-none disabled:active:scale-100 motion-reduce:transition-none motion-reduce:active:scale-100";
  const iconClass =
    "flex size-10 items-center justify-center rounded-2xl bg-[image:var(--slurp-nav-active)] text-[var(--slurp-ink)] ring-1 ring-inset ring-[var(--noodle-accent)]/30 [&_svg]:!text-current";
  const move = (by: number) => {
    const index = SLP_STIR_CATEGORIES.indexOf(category);
    const next = SLP_STIR_CATEGORIES[(index + by + SLP_STIR_CATEGORIES.length) % SLP_STIR_CATEGORIES.length]!;
    setCategory(next);
    document.getElementById(`slp-stir-tab-${next}`)?.focus();
  };
  return (
    <section aria-labelledby="slp-stir-deck" className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 id="slp-stir-deck" className={SLP_TYPE.title}>
          {t("ui.slurp.stir.start.title")}
        </h2>
        {onSurprise && (
          <SlpButton variant="tertiary" onClick={onSurprise} className="min-h-11 text-xs" data-slp-stir-surprise>
            <SlpSparkleGlyph size={14} aria-hidden="true" />
            {t("ui.slurp.stir.surprise")}
          </SlpButton>
        )}
      </div>
      <div
        className="-mx-3 flex gap-1.5 overflow-x-auto px-3 [scrollbar-width:none] @min-[680px]:mx-0 @min-[680px]:px-0"
        role="tablist"
        aria-labelledby="slp-stir-deck"
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault();
            // Right is forward in a left-to-right page, back in a right-to-left one.
            const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
            move((event.key === "ArrowRight") !== rtl ? 1 : -1);
          }
        }}
      >
        {SLP_STIR_CATEGORIES.map((entry) => (
          <SlpChip
            key={entry}
            id={`slp-stir-tab-${entry}`}
            role="tab"
            aria-pressed={undefined}
            aria-selected={category === entry}
            aria-controls="slp-stir-deck-panel"
            tabIndex={category === entry ? 0 : -1}
            selected={category === entry}
            onClick={() => setCategory(entry)}
            className="shrink-0"
          >
            {t(`ui.slurp.stir.category.${entry}`)}
          </SlpChip>
        ))}
      </div>
      <ul
        id="slp-stir-deck-panel"
        role="tabpanel"
        aria-labelledby={`slp-stir-tab-${category}`}
        className="grid grid-cols-2 gap-2.5 @min-[680px]:grid-cols-3"
        data-slp-stir-deck={category}
      >
        {category === "drama" &&
          (view?.dramas.length ? (
            view.dramas.map((drama) => (
              <li key={`pack:${drama.id}`}>
                <button
                  type="button"
                  onClick={() => onStartDrama(drama.id)}
                  disabled={running.has(drama.id)}
                  data-slp-stir-pack={drama.id}
                  className={cardClass}
                >
                  <span className="flex w-full items-start justify-between gap-2">
                    <span className={iconClass}>
                      <Clapperboard size={20} aria-hidden="true" />
                    </span>
                    {running.has(drama.id) && (
                      <span className={cn(SLP_TYPE.meta, "font-semibold text-[var(--slurp-ink)]")}>
                        {t("ui.slurp.stir.start.onNow")}
                      </span>
                    )}
                  </span>
                  <span className={cn(SLP_TYPE.body, "font-bold")}>{drama.name}</span>
                  <span className={cn(SLP_TYPE.meta, "line-clamp-3 text-[var(--slurp-muted)]")}>
                    {drama.description}
                  </span>
                </button>
              </li>
            ))
          ) : (
            // Every pack is off by default: say so where they would be, with the way to switch them on.
            <li className="col-span-2 @min-[680px]:col-span-3">
              <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-[var(--slurp-surface-raised)] p-3.5 shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)]">
                <span className={iconClass}>
                  <Clapperboard size={20} aria-hidden="true" />
                </span>
                <p className={cn(SLP_TYPE.body, "min-w-0 flex-1")}>{t("ui.slurp.stir.start.packsOff")}</p>
                {onOpenSettings && (
                  <SlpButton onClick={onOpenSettings} className="min-h-11 shrink-0 px-4 text-xs">
                    {t("ui.slurp.stir.start.choosePacks")}
                  </SlpButton>
                )}
              </div>
            </li>
          ))}
        {cards.map((action) => {
          const card = SLP_STIR_DECK[action];
          const Icon = card.icon;
          const need = slpStirDeckNeed(action, view);
          return (
            <li key={action}>
              <button
                type="button"
                onClick={() => onPick(action)}
                disabled={Boolean(need)}
                data-slp-stir-need={need ?? undefined}
                className="group flex h-full min-h-32 w-full flex-col items-start gap-2 rounded-2xl bg-[var(--slurp-surface-raised)] p-3.5 text-start shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)] transition-[transform,box-shadow] duration-[var(--slurp-motion-fast)] hover:shadow-[var(--slurp-shadow-floating),var(--slurp-highlight)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-60 disabled:shadow-none disabled:active:scale-100 motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                <span className="flex w-full items-start justify-between gap-2">
                  <span className="flex size-10 items-center justify-center rounded-2xl bg-[image:var(--slurp-nav-active)] text-[var(--slurp-ink)] ring-1 ring-inset ring-[var(--noodle-accent)]/30 [&_svg]:!text-current">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  {card.ai && <SlpUsesAiMark />}
                </span>
                <span className={cn(SLP_TYPE.body, "font-bold")}>{t(`ui.slurp.stir.card.${action}.title`)}</span>
                <span className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>
                  {need ? t(`ui.slurp.stir.needs.${need}`) : t(`ui.slurp.stir.card.${action}.line`)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * The Stir tab (W): make things happen in the world. The box turns words into a plan, "In play"
 * shows what is going on, suggestions offer a next move, the deck holds every lever as a card, and
 * the full Business and Relationships lists sit at the end. Every play shows a preview first; plays
 * are free, only a card marked AI calls the AI connection.
 */
export function SlpStirScreen({
  personaId,
  onOpenPulse,
  onOpenDashboard,
  onOpenTarget,
  onOpenSupport,
  onOpenSettings,
  onRunSetupAgain,
}: {
  personaId: string | null;
  /** Support desk › Your file › Run setup again. */
  onRunSetupAgain?: () => void;
  /** Settings › Stir › Drama, where the packs are switched on (0.3.11). */
  onOpenSettings?: () => void;
  /** A Creator's Slurp Support chat, from the Support desk (docs/SUPPORT-DESK.md). */
  onOpenSupport?: (creatorId: string) => void;
  onOpenPulse?: () => void;
  /** An owed #ad post is your own page's business: its suggestion opens the Dashboard. */
  onOpenDashboard?: () => void;
  /** A recent play opens the post it wrote or the Creator it touched. */
  onOpenTarget?: (target: SlpPulseTarget) => void;
}) {
  const { t } = useTranslation();
  const query = useSlurpStir(personaId);
  const view: SlpStirView | undefined = query.data;
  const [playing, setPlaying] = useState<{ action: SlpActionName; who?: string[]; pick?: string } | null>(null);
  const [suggested, setSuggested] = useState<{ cards: SlpActionPreview[]; cant: string[]; key: number } | null>(null);
  const preview = useSlurpStirPreview();
  const doIt = useSlpStirDoIt();
  // Stir is the world's levers; the Support desk is Slurp's own staff work (0.3.11: its own mode).
  const [mode, setMode] = useState<"stir" | "desk">("stir");
  const [people, setPeople] = useState(false);
  // Ending a drama runs through the runner like any play: a preview, the ledger, a toast.
  const endDrama = (runId: string) =>
    preview.mutate([{ action: "end-drama", input: { runId } }], {
      onSuccess: ({ cards }) => (cards[0]?.error ? void toast.error(cards[0].summary) : doIt.run(cards, "deck")),
      onError: (error) => void toast.error(errorMessage(error)),
    });
  const names = (view?.creators ?? [])
    .filter((creator) => creator.automatic && !creator.couplePage)
    .map((creator) => creator.name);
  const showPreview = (steps: NonNullable<SlpStirSuggestion["step"]>[]) =>
    preview.mutate(steps, {
      onSuccess: (answer) => setSuggested({ ...answer, key: Date.now() }),
      onError: (error) => void toast.error(errorMessage(error)),
    });
  const playSuggestion = (suggestion: SlpStirSuggestion) => {
    if (suggestion.step) showPreview([suggestion.step]);
    else if (suggestion.kind === "quiet")
      setPlaying({ action: "add-idea", who: suggestion.who.map((entry) => entry.id) });
    else if (suggestion.kind === "owedAd") onOpenDashboard?.();
  };
  // "Surprise me" (0.3.1): a suggestion that is ready to play, else a random deck card that has
  // something to act on. Code only; the preview comes first as always.
  const surprise = () => {
    const ready = (view?.suggestions ?? []).filter((suggestion) => suggestion.step);
    const pick = ready[Math.floor(Math.random() * ready.length)];
    if (pick?.step) return showPreview([pick.step]);
    const open = SLP_STIR_DECK_ORDER.filter((action) => !slpStirDeckNeed(action, view));
    const action = open[Math.floor(Math.random() * open.length)];
    if (action) setPlaying({ action });
  };
  return (
    <div className="@container flex h-full min-h-0 flex-col" data-slp-stir>
      <header className={cn("flex h-14 shrink-0 items-center gap-2 px-4", SLP_TOP_BAR_CLASS)}>
        <SlpStirGlyph size={22} aria-hidden="true" className="text-[var(--slurp-ink)]" />
        <h1 className="slp-display min-w-0 flex-1 truncate text-xl leading-none">{t("ui.slurp.stir.title")}</h1>
        <SlpSegment
          label={t("ui.slurp.stir.mode.label")}
          value={mode}
          onChange={setMode}
          options={[
            { value: "stir", label: t("ui.slurp.stir.mode.stir") },
            { value: "desk", label: t("ui.slurp.stir.mode.desk") },
          ]}
          className="shrink-0"
        />
        {personaId && (
          <button
            type="button"
            onClick={() => setPeople(true)}
            aria-label={t("ui.slurp.people.title")}
            title={t("ui.slurp.people.title")}
            className="-me-2 flex size-11 shrink-0 items-center justify-center rounded-full text-[var(--slurp-ink)] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] [&_svg]:!text-current"
          >
            <Users size={20} aria-hidden="true" />
          </button>
        )}
      </header>
      <main className={cn("min-h-0 flex-1 overflow-y-auto", SLP_PAGE_SCROLL_CLASS)}>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-3 sm:p-5">
          {mode === "desk" ? (
            <SlpStirDesk
              personaId={personaId}
              onOpenThread={onOpenSupport}
              onPlay={(action, who) => setPlaying({ action, who })}
              onRunSetupAgain={onRunSetupAgain}
            />
          ) : (
            <>
              <StirHint />
              <SlpStirBox names={names} personaId={personaId} />
              {query.isPending ? (
                <SlpSkeleton shape="card" count={2} label={t("ui.slurp.state.loading")} />
              ) : query.isError && !view ? (
                <SlpErrorState title={t("ui.slurp.stir.loadError")} onRetry={() => void query.refetch()} />
              ) : view ? (
                <>
                  <YourRelationship view={view} />
                  <NowShowing view={view} onSeeAll={onOpenPulse} onOpen={setPlaying} onEndDrama={endDrama} />
                  <Suggested suggestions={view.suggestions} onPlay={playSuggestion} pending={preview.isPending} />
                  <StartAStory
                    key={view.dramas.length ? "packs" : "no-packs"}
                    view={view}
                    onPick={(action) => setPlaying({ action })}
                    onStartDrama={(dramaId) => setPlaying({ action: "start-drama", pick: dramaId })}
                    onOpenSettings={onOpenSettings}
                    onSurprise={surprise}
                  />
                  <RecentPlays plays={view.plays} creators={view.creators} onOpenTarget={onOpenTarget} />
                </>
              ) : null}
            </>
          )}
        </div>
      </main>
      {personaId && (
        <SlpSheet
          open={people}
          onClose={() => setPeople(false)}
          title={t("ui.slurp.people.title")}
          size="full"
          width="max-w-2xl"
          back
        >
          <div className="px-2 pb-2">{people && <SlpPeoplePanel personaId={personaId} />}</div>
        </SlpSheet>
      )}
      <SlpStirPlaySheet
        action={playing?.action ?? null}
        prefill={playing?.who || playing?.pick ? { who: playing.who, pick: playing.pick } : undefined}
        view={view}
        onClose={() => setPlaying(null)}
      />
      <SlpStirPlanSheet
        key={suggested?.key ?? 0}
        open={Boolean(suggested)}
        onClose={() => setSuggested(null)}
        cards={suggested?.cards ?? []}
        cant={suggested?.cant ?? []}
        origin="suggested"
      />
    </div>
  );
}
