import { useState } from "react";
import { CircleAlert, Clock, Info, Pencil, X } from "lucide-react";
import { useSlurpUIStore } from "../../base/state/slp-package-store";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { Avatar, SLP_TYPE } from "../../base/chrome/SlpChrome";
import { SlpSparkleGlyph } from "../../base/chrome/SlpGlyphs";
import { SlpButton, SlpPrimaryButton, slpTagClass } from "../../modules/chrome/SlpButton";
import { SlpUsesAiMark, noteSlpAiUseOnce } from "../../modules/chrome/SlpAiMark";
import { SlpSheet } from "../../modules/chrome/SlpSheet";
import { playSlpBurst } from "../../modules/sparkle/SlpSparkle";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import {
  SLP_STIR_TEXT_MAX,
  type SlpActionPreview,
  type SlpStirOrigin,
  type SlpStirPlan,
  type SlpStirPlanRequest,
} from "../../../../../shared/src/slp/slp-stir.js";
import { SlpCoinText } from "../../modules/coin/SlpCoin";
import { useSlurpStirPlan, useSlurpStirPlay } from "./slp-stir-hooks";
import { SlpStirBrandLogo } from "./SlpStirBrandPick";
import { openSlpPulse, startSlpTask } from "../../base/state/slp-task-store";

type T = (key: string, options?: Record<string, unknown>) => string;

/** The card's "what" line, in the world's words, from the action and its few values. */
export function slpStirWhat(t: T, card: SlpActionPreview): string {
  const [a, b] = card.who;
  const names = { a: a?.name ?? "", b: b?.name ?? "", name: a?.name ?? "" };
  const d = card.detail;
  switch (card.action) {
    case "steer-creator": {
      const parts = [
        d.mood ? t("ui.slurp.stir.part.mood", { mood: t(`ui.slurp.steering.moods.${d.mood}`) }) : null,
        d.pace ? t("ui.slurp.stir.part.pace", { pace: t(`ui.slurp.steering.paces.${d.pace}`) }) : null,
        d.relationshipStyle
          ? t("ui.slurp.stir.part.style", {
              style: t(`ui.slurp.steering.relationshipStyles.${d.relationshipStyle}`),
            })
          : null,
        d.lifePhase ? t("ui.slurp.stir.part.life", { text: d.lifePhase }) : null,
        d.focus ? t("ui.slurp.stir.part.focus", { text: d.focus }) : null,
        d.push ? t("ui.slurp.stir.part.push", { text: d.push }) : null,
        d.avoid ? t("ui.slurp.stir.part.avoid", { text: d.avoid }) : null,
      ].filter(Boolean);
      return t("ui.slurp.stir.what.steer-creator", { ...names, parts: parts.join(" · ") });
    }
    case "set-spice":
      return t("ui.slurp.stir.what.set-spice", {
        ...names,
        level: d.level ? t(`ui.slurp.spice.levels.${d.level}`) : t("ui.slurp.stir.defaultLevel"),
      });
    case "steer-couple":
      return t(`ui.slurp.stir.what.steer-couple.${d.steer}`, names);
    case "steer-storyline":
      return t(`ui.slurp.stir.what.steer-storyline.${d.move}`, {
        ...names,
        title: d.title,
        chapter: d.chapter,
        next: d.next ?? "",
        text: d.text ?? "",
      });
    case "couple-page":
      return t(d.open ? "ui.slurp.stir.what.couple-page.open" : "ui.slurp.stir.what.couple-page.close", names);
    case "suggest-collab":
      return t(d.happen ? "ui.slurp.stir.what.suggest-collab.happen" : "ui.slurp.stir.what.suggest-collab.ask", {
        ...names,
        idea: d.idea ?? "",
      });
    case "set-up-couple":
      return t(
        d.stage === "together" ? "ui.slurp.stir.what.set-up-couple.together" : "ui.slurp.stir.what.set-up-couple",
        names,
      );
    case "add-idea":
      return t(d.story ? "ui.slurp.stir.what.add-idea.story" : "ui.slurp.stir.what.add-idea", {
        ...names,
        text: d.text,
      });
    case "write-post":
      return t(d.idea ? "ui.slurp.stir.what.write-post.idea" : "ui.slurp.stir.what.write-post", {
        ...names,
        idea: d.idea ?? "",
      });
    case "start-event":
      return t("ui.slurp.stir.what.start-event", { name: d.name, count: Number(d.days) || 1 });
    case "start-rivalry":
      return t("ui.slurp.stir.what.start-rivalry", { ...names, cause: d.cause ?? "" });
    case "start-storyline":
      return t(d.with ? "ui.slurp.stir.what.start-storyline.with" : "ui.slurp.stir.what.start-storyline", {
        ...names,
        title: d.title ?? "",
        others: d.with ?? "",
      });
    case "set-tip-goal":
      return t("ui.slurp.stir.what.set-tip-goal", { ...names, label: d.label ?? "", count: Number(d.target) || 0 });
    case "new-look":
      return t("ui.slurp.stir.what.new-look", { ...names, change: d.change ?? "" });
    case "invent-event":
      return t("ui.slurp.stir.what.invent-event", { name: d.name ?? "", count: Number(d.days) || 1 });
    case "offer-brand-deal":
      return t(
        card.input.happen ? "ui.slurp.stir.what.offer-brand-deal.happen" : "ui.slurp.stir.what.offer-brand-deal",
        { ...names, brand: d.brand ?? "", product: d.product ?? "", count: Number(d.fee) || 0 },
      );
    case "add-to-couple":
      return t("ui.slurp.stir.what.add-to-couple", { joiner: d.joiner ?? "", couple: d.couple ?? "" });
    case "set-bond":
      return t(`ui.slurp.stir.what.set-bond.${d.kind === "friend" ? `friend${Number(d.level ?? 1)}` : d.kind}`, names);
    case "end-bond":
      return t(`ui.slurp.stir.what.end-bond.${d.kind ?? "friend"}`, names);
    case "start-drama":
      return t(a ? "ui.slurp.stir.what.start-drama.lead" : "ui.slurp.stir.what.start-drama", {
        ...names,
        drama: d.name ?? "",
      });
    case "end-drama":
      return t("ui.slurp.stir.what.end-drama", { drama: d.name ?? "" });
    // The Support desk (0.3.5): the words carry the card's own values.
    case "grant-perk":
      return t(`ui.slurp.stir.what.grant-perk.${d.perk}`, {
        ...names,
        badge: d.badge ? t(`ui.slurp.desk.badge.${d.badge}`, { defaultValue: String(d.badge) }) : "",
        count: Number(d.coins ?? d.days) || 0,
        defaultValue: "Slurp gives {{name}} a perk",
      });
    case "set-challenge":
      return t(`ui.slurp.stir.what.set-challenge.${d.metric}`, {
        ...names,
        count: Number(d.count) || 0,
        days: Number(d.days) || 0,
        defaultValue: "{{name}} gets a Slurp challenge",
      });
    case "offer-contract":
    case "cash-favour":
    case "throttle-reach":
    case "plant-rumour":
    case "seed-trend":
    case "warn-creator":
      return t(`ui.slurp.stir.what.${card.action}`, {
        ...names,
        ...Object.fromEntries(Object.entries(d).map(([key, value]) => [key, value ?? ""])),
        name: names.name || (card.who.length > 1 ? card.who.map((entry) => entry.name).join(", ") : names.name),
      });
    default:
      return t(`ui.slurp.stir.what.${card.action}`, names);
  }
}

/** A "cannot" line: the planner's own words, or a code the server sends for the app to word (0.3.1). */
export function slpStirCantLine(t: T, line: string): string {
  if (line.startsWith("slp-stir:unknown:")) return t("ui.slurp.stir.cantLine.unknown");
  if (line === "slp-stir:invalid") return t("ui.slurp.stir.cantLine.invalid");
  return line;
}

/**
 * One Undo for a play, with its toast. `mutateAsync`, so the answer shows even after the sheet or
 * tab that played it is gone (a per-call callback would not run once it unmounted).
 */
export function useSlpStirUndo() {
  const { t } = useTranslation();
  const { undo } = useSlurpStirPlay();
  return {
    run: (id: string) =>
      undo.mutateAsync(id).then(
        ({ kept }) => void toast(kept ? t("ui.slurp.stir.undoneKept", { count: kept }) : t("ui.slurp.stir.undone")),
        (error: unknown) => void toast.error(errorMessage(error)),
      ),
    pending: undo.isPending,
  };
}

/**
 * The Burst, the toast, and one Undo for everything that can be taken back. Task B: the play is a
 * Pulse task, so the sheet closes at once (`onDone` runs on the tap) and the player keeps going; a
 * play that calls the AI says it started, every play says how it went, with Undo and "See in Pulse".
 */
export function useSlpStirDoIt() {
  const { t } = useTranslation();
  const { play } = useSlurpStirPlay();
  const undo = useSlpStirUndo();
  const run = (
    cards: SlpActionPreview[],
    origin: SlpStirOrigin,
    options: { from?: DOMRect; supportMessageId?: string; onDone?: () => void } = {},
  ) => {
    const steps = cards.filter((card) => !card.error).map((card) => ({ action: card.action, input: card.input }));
    if (!steps.length) return;
    const playable = cards.filter((card) => !card.error);
    const ai = cards.some((card) => card.cost === "ai");
    if (cards.some((card) => card.cost === "ai")) noteSlpAiUseOnce(t);
    if (options.from) playSlpBurst(options.from, 14);
    options.onDone?.();
    const label =
      playable.length > 1
        ? t("ui.slurp.stir.taskLabelMore", { what: slpStirWhat(t, playable[0]!), count: playable.length - 1 })
        : slpStirWhat(t, playable[0]!);
    void startSlpTask({
      t,
      kind: "stir-play",
      label,
      accountIds: [...new Set(playable.flatMap((card) => card.who.map((person) => person.id)))],
      startedToast: ai ? undefined : false,
      doneToast: false,
      run: async () => {
        const answer = await play.mutateAsync({ steps, origin, supportMessageId: options.supportMessageId });
        return { ...answer, failed: answer.results.filter((result) => !result.ok) };
      },
      done: ({ play: done, results, failed }) => {
        const serverId = `play:${done.id}`;
        // Nothing ran: the play is in the ledger anyway, so Pulse's own row says it failed and why.
        if (failed.length === results.length) {
          toast.error(t("ui.slurp.stir.failed"), {
            description: failed[0]?.error ?? undefined,
            action: { label: t("ui.slurp.pulse.seeInPulse", { defaultValue: "See in Pulse" }), onClick: openSlpPulse },
          });
          return { result: failed[0]?.error ?? t("ui.slurp.stir.failed"), serverId };
        }
        const undoAction = done.undoable
          ? {
              label: t("ui.slurp.wallet.undo", { defaultValue: "Undo" }),
              onClick: () => void undo.run(done.id),
            }
          : undefined;
        const detail = failed.length
          ? t("ui.slurp.stir.someFailed", { count: failed.length, reason: failed[0]?.error ?? "" })
          : t("ui.slurp.stir.doneDetail");
        toast.success(t("ui.slurp.stir.done", { count: results.length - failed.length }), {
          description: detail,
          action: undoAction,
          cancel: { label: t("ui.slurp.pulse.seeInPulse", { defaultValue: "See in Pulse" }), onClick: openSlpPulse },
          duration: undoAction ? 8000 : 4000,
        });
        const first = playable[0]?.who[0]?.id;
        return { result: detail, target: first ? { accountId: first } : undefined, serverId };
      },
    });
  };
  return { run, pending: play.isPending };
}

/** Two small avatars (who), or one; a brand deal shows the Creator and the brand's logo (R). */
function Who({ card }: { card: SlpActionPreview }) {
  if (card.action === "offer-brand-deal" && card.detail.brand)
    return (
      <span className="flex shrink-0 -space-x-2" aria-hidden="true">
        {card.who.slice(0, 1).map((person) => (
          <Avatar
            key={person.id}
            account={{ displayName: person.name, avatarUrl: person.avatarUrl }}
            size="sm"
            className="ring-2 ring-[var(--slurp-surface-raised)]"
          />
        ))}
        <span className="rounded-full ring-2 ring-[var(--slurp-surface-raised)]" data-slp-stir-brand-logo>
          <SlpStirBrandLogo name={String(card.detail.brand)} logoUrl={(card.detail.logoUrl as string | null) ?? null} />
        </span>
      </span>
    );
  if (!card.who.length)
    return <SlpSparkleGlyph size={22} aria-hidden="true" className="shrink-0 text-[var(--slurp-ink)]" />;
  return (
    <span className="flex shrink-0 -space-x-2" aria-hidden="true">
      {card.who.slice(0, 2).map((person) => (
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
 * One preview card (design: Here is the plan): who, what, when, the cost, the Creator's own answer
 * where they may say no, fit notes from their cards, and why it cannot happen. ✕ takes it out.
 */
export function SlpStirCard({ card, onRemove }: { card: SlpActionPreview; onRemove?: () => void }) {
  const { t } = useTranslation();
  const [a] = card.who;
  // A fit note that already says they may say no makes the chip a repeat.
  const refusalNoted = card.notes.some((note) => note.kind === "mayDecline" || note.kind === "noCollabs");
  return (
    <li
      data-slp-stir-card={card.action}
      className={cn(
        "relative flex flex-col gap-2 rounded-2xl bg-[var(--slurp-surface-raised)] p-3.5 shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)]",
        card.error && "opacity-70",
      )}
    >
      <div className="flex min-w-0 items-center gap-3 pe-9">
        <Who card={card} />
        {/* The "what" line names them already; the avatars carry the names for screen readers. */}
        <p className={cn(SLP_TYPE.body, "min-w-0 flex-1 font-semibold [overflow-wrap:anywhere]")}>
          {/* A brand deal's fee is "25 <coin/>" (the one coin rule). */}
          <SlpCoinText>{slpStirWhat(t, card)}</SlpCoinText>
        </p>
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("ui.slurp.stir.remove")}
          className="absolute end-1.5 top-1.5 flex size-11 items-center justify-center rounded-full text-[var(--slurp-muted)] hover:bg-[var(--accent)] hover:text-[var(--slurp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
      {card.action === "write-post" && card.error === "draftInComposer" && a ? (
        // Review for everyone (0.3.14): Stir hands the idea to the page's composer, which drafts it.
        <SlpButton
          variant="secondary"
          className="self-start text-xs"
          onClick={() => {
            const store = useSlurpUIStore.getState();
            store.setComposeGuide({ accountId: a.id, idea: String(card.detail.idea ?? "") });
            store.setNavigation({ mode: "creator", view: "profile", accountId: a.id });
          }}
        >
          <Pencil size={14} aria-hidden="true" />
          {t("ui.slurp.postGuide.draftInComposer")}
        </SlpButton>
      ) : card.error ? (
        <p className={cn(SLP_TYPE.meta, "flex items-start gap-1.5 text-[var(--slurp-danger)]")}>
          <CircleAlert size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
          {t(`ui.slurp.stir.cant.${card.error}`, {
            name: a?.name ?? "",
            defaultValue: t("ui.slurp.stir.cant.generic"),
          })}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={slpTagClass(false)}>
            <Clock size={11} aria-hidden="true" />
            {t(`ui.slurp.stir.when.${card.when}`)}
          </span>
          {card.cost === "ai" ? (
            <SlpUsesAiMark />
          ) : (
            <span className={slpTagClass(true)}>{t("ui.slurp.stir.free")}</span>
          )}
          {card.refusable && !refusalNoted && (
            <span className={slpTagClass(false)}>{t("ui.slurp.stir.mayRefuse")}</span>
          )}
        </div>
      )}
      {!card.error &&
        card.notes.map((note) => (
          <p
            key={`${note.kind}:${note.name ?? ""}`}
            className={cn(SLP_TYPE.meta, "flex items-start gap-1.5 text-[var(--slurp-muted)]")}
          >
            <Info size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
            {t(`ui.slurp.stir.note.${note.kind}`, { name: note.name ?? "" })}
          </p>
        ))}
    </li>
  );
}

/**
 * "Here is the plan": the preview cards, with ✕ to take one out, the lines Slurp cannot do, a
 * question when the words were unclear (answered right here, 0.3.1), and "Do it". Nothing runs
 * before the tap.
 */
export function SlpStirPlanSheet({
  open,
  onClose,
  cards: initial,
  cant: initialCant = [],
  question: initialQuestion = null,
  origin,
  onChangeWords,
  onPlayed,
  request,
  intro,
}: {
  open: boolean;
  onClose: () => void;
  cards: SlpActionPreview[];
  cant?: string[];
  question?: string | null;
  origin: SlpStirOrigin;
  /** Back to the words, kept (the box). */
  onChangeWords?: () => void;
  /** "Do it" ran (the box lets its words go). */
  onPlayed?: () => void;
  /** What was asked, so an answer to the planner's question can plan again. */
  request?: Omit<SlpStirPlanRequest, "followUp">;
  intro?: string;
}) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState<SlpStirPlan>({
    cards: initial,
    cant: initialCant,
    question: initialQuestion,
  });
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [answer, setAnswer] = useState("");
  const planner = useSlurpStirPlan();
  const cards = current.cards.filter((_, index) => !removed.has(index));
  const playable = cards.filter((card) => !card.error);
  const doIt = useSlpStirDoIt();
  const question = current.question;
  const close = () => {
    setRemoved(new Set());
    onClose();
  };
  const reply = () => {
    const words = answer.trim();
    if (!request || !question || !words || planner.isPending) return;
    noteSlpAiUseOnce(t);
    planner.mutate(
      { ...request, followUp: { question, answer: words } },
      {
        onSuccess: (next) => {
          setRemoved(new Set());
          setAnswer("");
          setCurrent(next);
        },
      },
    );
  };
  return (
    <SlpSheet
      open={open}
      onClose={close}
      back
      title={t("ui.slurp.stir.planTitle")}
      footer={
        <div className="flex gap-2 px-3 py-2">
          {onChangeWords && (
            <SlpButton variant="quiet" onClick={onChangeWords} disabled={doIt.pending} className="flex-1">
              {t("ui.slurp.stir.changeWords")}
            </SlpButton>
          )}
          <SlpPrimaryButton
            disabled={!playable.length || doIt.pending || planner.isPending}
            onClick={(event) =>
              doIt.run(cards, origin, {
                from: event.currentTarget.getBoundingClientRect(),
                onDone: () => {
                  onPlayed?.();
                  close();
                },
              })
            }
            className="flex-1"
          >
            <SlpSparkleGlyph size={16} aria-hidden="true" />
            {doIt.pending ? t("ui.slurp.stir.doing") : t("ui.slurp.stir.doIt")}
          </SlpPrimaryButton>
        </div>
      }
    >
      <div className="space-y-3 px-2 pb-2" data-slp-stir-plan>
        {intro && <p className={cn(SLP_TYPE.meta, "px-1 text-[var(--slurp-muted)]")}>{intro}</p>}
        {question && (
          <div className="space-y-2 rounded-2xl bg-[var(--slurp-tint)] p-3" data-slp-stir-question>
            <p id="slp-stir-question" className={cn(SLP_TYPE.body, "font-semibold")}>
              {question}
            </p>
            {request && (
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  reply();
                }}
              >
                <input
                  value={answer}
                  maxLength={SLP_STIR_TEXT_MAX}
                  aria-labelledby="slp-stir-question"
                  placeholder={t("ui.slurp.stir.answerPlaceholder")}
                  onChange={(event) => setAnswer(event.target.value)}
                  className="min-h-11 min-w-0 flex-1 rounded-xl bg-[var(--slurp-canvas)] px-3 text-base outline-none ring-1 ring-inset ring-[var(--slurp-outline)] focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] sm:text-sm"
                />
                <SlpPrimaryButton type="submit" disabled={!answer.trim() || planner.isPending} className="shrink-0">
                  {planner.isPending ? t("ui.slurp.stir.planning") : t("ui.slurp.stir.answer")}
                </SlpPrimaryButton>
              </form>
            )}
            {planner.error && !planner.isPending && (
              <p role="alert" className={cn(SLP_TYPE.meta, "text-[var(--slurp-danger)]")}>
                {errorMessage(planner.error)}
              </p>
            )}
          </div>
        )}
        {current.cards.length > 0 ? (
          <ul className="space-y-2">
            {current.cards.map((card, index) =>
              removed.has(index) ? null : (
                <SlpStirCard
                  key={`${card.action}:${index}`}
                  card={card}
                  onRemove={() => setRemoved((value) => new Set(value).add(index))}
                />
              ),
            )}
          </ul>
        ) : (
          !question && (
            <p className={cn(SLP_TYPE.body, "px-1 text-[var(--slurp-muted)]")}>{t("ui.slurp.stir.noCards")}</p>
          )
        )}
        {current.cant.map((line, index) => (
          <p
            key={`${index}:${line}`}
            className={cn(SLP_TYPE.meta, "flex items-start gap-1.5 px-1 text-[var(--slurp-muted)]")}
          >
            <CircleAlert size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
            {slpStirCantLine(t, line)}
          </p>
        ))}
        {playable.length > 0 && (
          <p className={cn(SLP_TYPE.caption, "px-1 text-[var(--slurp-muted)]")}>{t("ui.slurp.stir.nothingYet")}</p>
        )}
      </div>
    </SlpSheet>
  );
}
