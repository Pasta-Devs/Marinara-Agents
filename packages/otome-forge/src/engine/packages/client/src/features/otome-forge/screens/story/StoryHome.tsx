// ──────────────────────────────────────────────
// Otome Forge: the Story screen. A rupture's banner first ("{name} is keeping {their} distance", with Make it right,
// which plans or opens the repair chapter), the chapter being read (Continue), the next main chapter ("Who walks with
// you this chapter?": the server offers two Leads, the one least recently with her and the one with the ripest
// conflict; the planner adds a Foil), each love interest's route (his next free chapter, open from an affection level
// and shut while a rupture is open), each one's affection, and every chapter so far as a path of its scenes.
// Planning a chapter is one model call with Cancel while it runs; a chapter already planned opens with none.
// ──────────────────────────────────────────────
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  BookHeart,
  BookOpen,
  CalendarHeart,
  Eye,
  Feather,
  Heart,
  HeartCrack,
  HeartHandshake,
  KeyRound,
  Lock,
  Phone,
  Repeat,
  RotateCcw,
  Sparkles,
  Star,
  Swords,
  X,
  type LucideIcon,
} from "lucide-react";
import { otomeErrorCode, useOtomeApi, type RequestBody } from "../../api";
import { Avatar } from "../../components/Avatar";
import { ChapterPaintCost } from "../../components/CostHint";
import { DeclinedPanel } from "../../components/DeclinedPanel";
import { Dialog } from "../../components/Dialog";
import { cancelStoryWork, runPath, storyQueryKey, useChapter, useStory } from "../../hooks/use-reader";
import { accentOf } from "../../lib/accent";
import type {
  ChapterView,
  LeadReason,
  RepairEntry,
  RouteEntry,
  RunLiView,
  RunView,
  StoryChapterEntry,
  StoryView,
} from "../../shared/api-types";
import { stageRow, type StageName } from "../../shared/arcs";
import { chapterEyebrowKey } from "../reader/ReaderControls";

const MAX_LEVEL = 10;

const STATE_KEYS: Record<StoryChapterEntry["state"], string> = {
  unplanned: "ui.otomeForge.story.stateUnplanned",
  "in-progress": "ui.otomeForge.story.stateInProgress",
  done: "ui.otomeForge.story.stateDone",
};

const REASON_KEYS: Record<LeadReason, string> = {
  "least-recent": "ui.otomeForge.story.reasonLeastRecent",
  "ripe-conflict": "ui.otomeForge.story.reasonRipeConflict",
};

/** Each stage's name (SH/arcs.ts STAGES): the mask a love interest wears gives way, stage by stage. */
const STAGE_NAME_KEYS: Record<StageName, string> = {
  mask: "ui.otomeForge.arcs.stageMask",
  crack: "ui.otomeForge.arcs.stageCrack",
  pull: "ui.otomeForge.arcs.stagePull",
  wound: "ui.otomeForge.arcs.stageWound",
  reckoning: "ui.otomeForge.arcs.stageReckoning",
  bond: "ui.otomeForge.arcs.stageBond",
};
export const stageNameKey = (stage: number) => STAGE_NAME_KEYS[stageRow(stage).name];

/** Main chapters are `main-<n>`; the list entry carries no number of its own. */
const mainNumber = (key: string) => Number(/^main-(\d+)$/u.exec(key)?.[1] ?? 0) || undefined;

interface StoryHomeProps {
  runKey: string;
  view: RunView;
  onOpenChapter: (key: string) => void;
}

export function StoryHome({ runKey, view, onOpenChapter }: StoryHomeProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const story = useStory(runKey);
  const [choosing, setChoosing] = useState(false);
  const [arcPlan, setArcPlan] = useState<ArcTarget | null>(null);
  const arcPlanning = usePlanChapter(runKey);

  const head = (
    <div className="of-page-head">
      <div className="of-emblem of-glass" aria-hidden="true">
        <BookHeart size={30} strokeWidth={1.6} />
      </div>
      <h1 className="of-title" tabIndex={-1}>
        {t("ui.otomeForge.common.screenStory")}
      </h1>
      {view.world.title ? <p className="of-subtitle">{view.world.title}</p> : null}
      <p className="of-hand">{t("ui.otomeForge.story.note")}</p>
    </div>
  );

  if (!story.data) {
    return (
      <div className="of-page">
        {head}
        {story.isError ? (
          <div className="of-panel of-panel--center of-card of-glass" role="alert">
            <p className="of-error">{otome.errorMessage(story.error)}</p>
            <button type="button" className="of-button of-button--quiet of-glass" onClick={() => void story.refetch()}>
              <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
              {t("ui.otomeForge.common.retry")}
            </button>
          </div>
        ) : (
          <div className="of-center" role="status">
            <Heart className="of-pulse" size={26} strokeWidth={1.6} fill="currentColor" aria-hidden="true" />
            <p className="of-body">{t("ui.otomeForge.story.loading")}</p>
          </div>
        )}
      </div>
    );
  }

  const { chapters, next } = story.data;
  const routes = Array.isArray(story.data.routes) ? story.data.routes : [];
  const repairs = Array.isArray(story.data.repairs) ? story.data.repairs : [];
  // A main chapter in progress is the one to continue; a route or repair chapter has its own card.
  const reading =
    chapters.find((chapter) => chapter.state === "in-progress" && chapter.kind === "main") ??
    chapters.find(
      (chapter) =>
        chapter.state === "in-progress" &&
        !routes.some((route) => route.next?.key === chapter.key) &&
        !repairs.some((repair) => repair.key === chapter.key),
    ) ??
    null;
  /** Opens a route or repair chapter that is already planned; plans it (one model call) otherwise. */
  const planArc = (target: ArcTarget) =>
    void arcPlanning.plan(target.key, arcPath(target), {}, (key) => {
      setArcPlan(null);
      onOpenChapter(key);
    });
  const openArc = (target: ArcTarget) => {
    const planned = chapters.find((chapter) => chapter.key === target.key);
    if (planned) onOpenChapter(planned.key);
    else {
      setArcPlan(target);
      planArc(target);
    }
  };
  return (
    <div className="of-page of-story">
      {head}
      {repairs.map((repair) => (
        <RuptureBanner
          key={repair.li}
          repair={repair}
          view={view}
          entry={chapters.find((chapter) => chapter.key === repair.key) ?? null}
          onMakeItRight={() => openArc({ kind: "repair", li: repair.li, key: repair.key })}
        />
      ))}
      {reading ? <ContinueCard runKey={runKey} entry={reading} view={view} onOpen={onOpenChapter} /> : null}
      {next ? (
        <section className="of-section of-glass of-story-next" aria-labelledby="of-story-next">
          <p className="of-eyebrow">{t("ui.otomeForge.story.chapterNumber", { number: next.number })}</p>
          <h2 id="of-story-next" className="of-section-title">
            {chapters.length ? t("ui.otomeForge.story.nextTitle") : t("ui.otomeForge.story.firstTitle")}
          </h2>
          <p className="of-body">{t("ui.otomeForge.story.nextText")}</p>
          <button type="button" className="of-button of-button--primary" onClick={() => setChoosing(true)}>
            <Sparkles size={16} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.story.chooseLead")}
          </button>
        </section>
      ) : null}
      {!reading && !next && !routes.length && !repairs.length ? (
        <p className="of-empty of-glass">{t("ui.otomeForge.story.nothingNext")}</p>
      ) : null}
      {routes.length ? (
        <Routes
          routes={routes}
          view={view}
          chapters={chapters}
          onOpen={(route) => route.next && openArc({ kind: "route", li: route.li, key: route.next.key })}
          onMakeItRight={(li) => {
            const repair = repairs.find((item) => item.li === li);
            if (repair) openArc({ kind: "repair", li, key: repair.key });
          }}
        />
      ) : null}
      <Affection lis={view.lis} />
      {chapters.length ? <ChapterList chapters={chapters} view={view} onOpen={onOpenChapter} /> : null}
      {arcPlan ? (
        <ArcPlanDialog
          view={view}
          target={arcPlan}
          planning={arcPlanning}
          onRetry={() => planArc(arcPlan)}
          onClose={() => setArcPlan(null)}
        />
      ) : null}
      {choosing && next ? (
        <LeadDialog
          runKey={runKey}
          view={view}
          next={next}
          onClose={() => setChoosing(false)}
          onPlanned={(key) => {
            setChoosing(false);
            onOpenChapter(key);
          }}
        />
      ) : null}
    </div>
  );
}

function ContinueCard({
  runKey,
  entry,
  view,
  onOpen,
}: {
  runKey: string;
  entry: StoryChapterEntry;
  view: RunView;
  onOpen: (key: string) => void;
}) {
  const { t } = useTranslation();
  // The chapter being read shows each scene's kind on its path.
  const detail = useChapter(runKey, entry.key);
  const lead = view.lis.find((li) => li.id === (entry.li ?? entry.lead)) ?? null;
  return (
    <section
      className="of-section of-glass of-story-continue"
      aria-labelledby="of-story-continue"
      style={lead ? ({ "--of-li-accent": accentOf(lead) } as CSSProperties) : undefined}
    >
      <p className="of-eyebrow">{t("ui.otomeForge.story.continueEyebrow")}</p>
      <div className="of-chapter-head">
        {lead ? <Avatar name={lead.name} url={lead.portrait} accent={accentOf(lead)} size={46} /> : null}
        <div className="of-chapter-heading">
          <p className="of-chapter-eyebrow">{eyebrow(t, entry, lead)}</p>
          <h2 id="of-story-continue" className="of-chapter-title">
            {entry.title || t("ui.otomeForge.story.untitled")}
          </h2>
        </div>
      </div>
      <NodePath count={entry.nodes} read={entry.beatsRead} nodes={detail.data?.chapter.nodes} current />
      <button type="button" className="of-button of-button--primary" onClick={() => onOpen(entry.key)}>
        <BookOpen size={16} strokeWidth={2} aria-hidden="true" />
        {t("ui.otomeForge.story.continue")}
      </button>
    </section>
  );
}

function eyebrow(t: ReturnType<typeof useTranslation>["t"], entry: StoryChapterEntry, lead: RunLiView | null): string {
  const [key, values] = chapterEyebrowKey({ kind: entry.kind, number: mainNumber(entry.key) });
  const kind = t(key, values);
  return lead ? t("ui.otomeForge.story.withLead", { chapter: kind, name: lead.name }) : kind;
}

const NODE_ICONS: Record<string, LucideIcon> = {
  call: Phone,
  "read-him": Eye,
  date: CalendarHeart,
  confrontation: Swords,
  closer: HeartHandshake,
  cg: Star,
  gate: KeyRound,
};

/** A chapter's scenes as a path of stars: read, the one being read, and those ahead. Kinds show when known. */
function NodePath({
  count,
  read,
  nodes,
  current = false,
}: {
  count: number;
  read: number;
  nodes?: ChapterView["nodes"];
  current?: boolean;
}) {
  const { t } = useTranslation();
  const total = Math.max(count, nodes?.length ?? 0);
  if (!total) return null;
  const done = Math.min(read, total);
  return (
    <div className="of-path" role="img" aria-label={t("ui.otomeForge.story.pathLabel", { read: done, total })}>
      {Array.from({ length: total }, (_, index) => {
        const node = nodes?.[index];
        const Icon =
          node?.kind === "confrontation" || node?.kind === "closer"
            ? NODE_ICONS[node.kind]
            : node?.kind === "moment" && node.moment
              ? NODE_ICONS[node.moment]
              : node?.gate
                ? NODE_ICONS.gate
                : node?.cg
                  ? NODE_ICONS.cg
                  : null;
        const state = index < done ? "read" : index === done && current ? "current" : "ahead";
        return (
          <span key={index} className="of-path-node" data-state={state} data-kind={node?.kind ?? "beat"}>
            {Icon ? <Icon size={11} strokeWidth={2.2} /> : null}
          </span>
        );
      })}
    </div>
  );
}

/** Each love interest's affection level (1–10, it only rises), as ten hearts. */
function Affection({ lis }: { lis: RunLiView[] }) {
  const { t } = useTranslation();
  return (
    <section className="of-section of-glass" aria-labelledby="of-story-affection">
      <h2 id="of-story-affection" className="of-section-title">
        {t("ui.otomeForge.story.affectionTitle")}
      </h2>
      <ul className="of-affection-list">
        {lis.map((li) => {
          const accent = accentOf(li);
          const level = Math.max(1, Math.min(MAX_LEVEL, li.level));
          return (
            <li key={li.id} className="of-affection" style={{ "--of-li-accent": accent } as CSSProperties}>
              <Avatar name={li.name} url={li.portrait} accent={accent} size={38} />
              <span className="of-affection-name">{li.name}</span>
              <span
                className="of-hearts"
                role="img"
                aria-label={t("ui.otomeForge.story.levelOf", { name: li.name, level, max: MAX_LEVEL })}
              >
                {Array.from({ length: MAX_LEVEL }, (_, index) => (
                  <Heart
                    key={index}
                    size={11}
                    strokeWidth={2}
                    fill={index < level ? "currentColor" : "none"}
                    data-on={index < level}
                    aria-hidden="true"
                  />
                ))}
              </span>
              <span className="of-affection-level" aria-hidden="true">
                {t("ui.otomeForge.story.level", { level })}
              </span>
              {li.affectionProgress ? (
                <span
                  className="of-affection-progress"
                  role="meter"
                  aria-label={t("ui.otomeForge.story.affectionProgress", { name: li.name })}
                  aria-valuemin={0}
                  aria-valuemax={li.affectionProgress.required}
                  aria-valuenow={li.affectionProgress.current}
                  aria-valuetext={
                    level === MAX_LEVEL
                      ? t("ui.otomeForge.story.affectionProgressMax")
                      : t("ui.otomeForge.story.affectionProgressValue", li.affectionProgress)
                  }
                >
                  {t("ui.otomeForge.story.affectionProgressCount", li.affectionProgress)}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="of-hint">{t("ui.otomeForge.story.affectionHint")}</p>
    </section>
  );
}

function ChapterList({
  chapters,
  view,
  onOpen,
}: {
  chapters: StoryChapterEntry[];
  view: RunView;
  onOpen: (key: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="of-section of-glass" aria-labelledby="of-story-chapters">
      <h2 id="of-story-chapters" className="of-section-title">
        {t("ui.otomeForge.story.chaptersTitle")}
      </h2>
      <ol className="of-chapters">
        {chapters.map((entry) => {
          const lead = view.lis.find((li) => li.id === (entry.li ?? entry.lead)) ?? null;
          const title = entry.title || t("ui.otomeForge.story.untitled");
          const action =
            entry.state === "done"
              ? { key: "ui.otomeForge.story.replay", Icon: Repeat, primary: false }
              : entry.state === "in-progress"
                ? { key: "ui.otomeForge.story.continue", Icon: BookOpen, primary: true }
                : null;
          return (
            <li
              key={entry.key}
              className="of-chapter"
              data-state={entry.state}
              style={lead ? ({ "--of-li-accent": accentOf(lead) } as CSSProperties) : undefined}
            >
              <div className="of-chapter-head">
                {lead ? <Avatar name={lead.name} url={lead.portrait} accent={accentOf(lead)} size={34} /> : null}
                <div className="of-chapter-heading">
                  <p className="of-chapter-eyebrow">{eyebrow(t, entry, lead)}</p>
                  <h3 className="of-chapter-title">{title}</h3>
                </div>
                <span className="of-badge of-badge--soft">{t(STATE_KEYS[entry.state])}</span>
              </div>
              <NodePath count={entry.nodes} read={entry.beatsRead} current={entry.state === "in-progress"} />
              {action ? (
                <button
                  type="button"
                  className={
                    action.primary
                      ? "of-button of-button--primary of-button--small"
                      : "of-button of-button--quiet of-glass of-button--small"
                  }
                  aria-label={`${t(action.key)}: ${title}`}
                  onClick={() => onOpen(entry.key)}
                >
                  <action.Icon size={14} strokeWidth={2} aria-hidden="true" />
                  {t(action.key)}
                </button>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

interface LeadDialogProps {
  runKey: string;
  view: RunView;
  next: NonNullable<StoryView["next"]>;
  onClose: () => void;
  onPlanned: (key: string) => void;
}

/** "Who walks with you this chapter?": picking a Lead plans the chapter (one model call), with Cancel while it runs. */
function LeadDialog({ runKey, view, next, onClose, onPlanned }: LeadDialogProps) {
  const { t } = useTranslation();
  const actionRef = useRef<HTMLButtonElement>(null);
  const { planning, failed, stopped, plan: planChapter, cancel } = usePlanChapter(runKey);
  useDialogFocus(actionRef, planning, failed);
  const candidates = next.candidates.flatMap((candidate) => {
    const li = view.lis.find((item) => item.id === candidate.li);
    return li ? [{ li, reason: candidate.reason }] : [];
  });

  const plan = (li: string) => planChapter(li, "/chapters/next", { lead: li }, onPlanned);

  const planningLi = candidates.find((candidate) => candidate.li.id === planning)?.li ?? null;
  return (
    <Dialog
      wide
      title={t("ui.otomeForge.story.leadTitle")}
      onClose={planning ? undefined : onClose}
      actions={
        planning ? (
          <button
            ref={actionRef}
            type="button"
            className="of-button of-button--quiet of-glass"
            onClick={() => void cancel()}
          >
            <X size={16} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.reader.cancel")}
          </button>
        ) : (
          <button ref={actionRef} type="button" className="of-button of-button--quiet of-glass" onClick={onClose}>
            {t("ui.otomeForge.reader.notNow")}
          </button>
        )
      }
    >
      {planning ? (
        <div className="of-planning" role="status">
          <Heart className="of-pulse" size={28} strokeWidth={1.6} fill="currentColor" aria-hidden="true" />
          <p className="of-body">
            {t("ui.otomeForge.story.planning", { number: next.number, name: planningLi?.name ?? "" })}
          </p>
          <p className="of-hint">{t("ui.otomeForge.story.planningHint")}</p>
        </div>
      ) : failed ? (
        <DeclinedPanel error={failed.error} run={view} job="structured" onRetry={() => void plan(failed.id)} />
      ) : (
        <>
          <p className="of-body">{t("ui.otomeForge.story.leadIntro", { number: next.number })}</p>
          <ul className="of-candidates">
            {candidates.map(({ li, reason }) => {
              const accent = accentOf(li);
              return (
                <li key={li.id}>
                  <button
                    type="button"
                    className="of-candidate of-glass"
                    style={{ "--of-li-accent": accent } as CSSProperties}
                    onClick={() => void plan(li.id)}
                  >
                    <Avatar name={li.name} url={li.portrait} accent={accent} size={58} className="of-avatar--hero" />
                    <span className="of-candidate-name">{li.name}</span>
                    <span className="of-candidate-level">
                      <Heart size={11} strokeWidth={2} fill="currentColor" aria-hidden="true" />
                      {t("ui.otomeForge.story.level", { level: li.level })}
                    </span>
                    <span className="of-candidate-reason">{t(REASON_KEYS[reason], { name: li.name })}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="of-cost">
            <Feather size={14} strokeWidth={2} aria-hidden="true" />
            <span>
              {t("ui.otomeForge.story.planCost")}
              <span className="of-cost-note"> · {t("ui.otomeForge.story.planCostNote")}</span>
            </span>
          </p>
          <ChapterPaintCost images={view.world.images} />
          {stopped ? (
            <p className="of-hint" role="status">
              {t("ui.otomeForge.story.planStopped")}
            </p>
          ) : null}
        </>
      )}
    </Dialog>
  );
}

// ── Planning a chapter (shared by the Lead dialog, routes and repairs) ──

/**
 * Plans a chapter: one model call at a time, with Cancel (the server stops the write; the request is dropped). A
 * second press while one runs does nothing. The story list is refreshed once the plan lands.
 */
function usePlanChapter(runKey: string) {
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const [planning, setPlanning] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ id: string; error: unknown } | null>(null);
  const [stopped, setStopped] = useState(false);

  // Leaving drops the request, never the write: a plan that lands later is kept for the next visit.
  useEffect(() => () => abortRef.current?.abort(), []);

  const plan = async (id: string, path: string, body: RequestBody, onPlanned: (key: string) => void) => {
    if (busy.current) return;
    busy.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    setPlanning(id);
    setFailed(null);
    setStopped(false);
    try {
      const { chapter } = await otome.post<{ chapter: ChapterView }>(`${runPath(runKey)}${path}`, body, {
        signal: controller.signal,
      });
      void queryClient.invalidateQueries({ queryKey: storyQueryKey(runKey) });
      onPlanned(chapter.key);
    } catch (error) {
      if (controller.signal.aborted) return;
      setFailed({ id, error });
      setPlanning(null);
      // A chapter that is locked (or no longer offered) means the screen is behind: it reads the story again.
      const code = otomeErrorCode(error);
      if (code === "locked" || code === "conflict")
        void queryClient.invalidateQueries({ queryKey: storyQueryKey(runKey) });
    } finally {
      if (abortRef.current === controller) busy.current = false;
    }
  };

  const cancel = async () => {
    abortRef.current?.abort();
    busy.current = false;
    setPlanning(null);
    setStopped(true);
    await cancelStoryWork(otome.post, runKey);
  };

  return { planning, failed, stopped, plan, cancel };
}

/**
 * The dialog's body is replaced under the focused control (a choice by the planning status, the status by the
 * failure): focus moves to what took its place, Cancel while it plans and Retry when it failed, so it never leaves.
 */
function useDialogFocus(
  actionRef: RefObject<HTMLButtonElement | null>,
  planning: string | null,
  failed: { id: string } | null,
) {
  useEffect(() => {
    const panel = actionRef.current?.closest<HTMLElement>('[role="dialog"]');
    if (!panel) return;
    const active = document.activeElement;
    const lost = !active || active === document.body || !panel.contains(active);
    if (failed) (panel.querySelector<HTMLElement>(".of-declined [data-autofocus]") ?? actionRef.current)?.focus();
    else if (planning && lost) actionRef.current?.focus();
  }, [actionRef, planning, failed]);
}

// ── Arcs: routes, ruptures and repairs ──

/** A route or repair chapter to open, planning it first when it has no plan yet. */
interface ArcTarget {
  kind: "route" | "repair";
  li: string;
  key: string;
}

/** POST /runs/:run/routes/:li/next, or /repairs/:li. */
const arcPath = (target: ArcTarget) =>
  target.kind === "route"
    ? `/routes/${encodeURIComponent(target.li)}/next`
    : `/repairs/${encodeURIComponent(target.li)}`;

/** Pronoun-safe text for a love interest: the name, and the pronouns stored in the bible (never assumed). */
const pronounValues = (li: RunLiView) => ({
  name: li.name,
  subject: li.pronouns.subject,
  object: li.pronouns.object,
  possessive: li.pronouns.possessive,
});

function RuptureBanner({
  repair,
  view,
  entry,
  onMakeItRight,
}: {
  repair: RepairEntry;
  view: RunView;
  entry: StoryChapterEntry | null;
  onMakeItRight: () => void;
}) {
  const { t } = useTranslation();
  const li = view.lis.find((item) => item.id === repair.li);
  if (!li) return null;
  const accent = accentOf(li);
  const titleId = `of-rupture-${li.id}`;
  return (
    <section
      className="of-section of-glass of-rupture"
      aria-labelledby={titleId}
      style={{ "--of-li-accent": accent } as CSSProperties}
    >
      <div className="of-rupture-head">
        <span className="of-rupture-mark" aria-hidden="true">
          <Avatar name={li.name} url={li.portrait} accent={accent} size={44} />
          <span className="of-rupture-crack">
            <HeartCrack size={14} strokeWidth={2.2} />
          </span>
        </span>
        <div className="of-chapter-heading">
          <p className="of-eyebrow">{t("ui.otomeForge.arcs.ruptureEyebrow")}</p>
          <h2 id={titleId} className="of-chapter-title">
            {t("ui.otomeForge.arcs.ruptureTitle", pronounValues(li))}
          </h2>
        </div>
      </div>
      <p className="of-body">{t("ui.otomeForge.arcs.ruptureText", pronounValues(li))}</p>
      <button
        type="button"
        className="of-button of-button--primary"
        aria-label={t("ui.otomeForge.arcs.makeItRightLabel", pronounValues(li))}
        onClick={onMakeItRight}
      >
        <HeartHandshake size={16} strokeWidth={2} aria-hidden="true" />
        {entry?.state === "in-progress"
          ? t("ui.otomeForge.arcs.makeItRightContinue")
          : t("ui.otomeForge.arcs.makeItRight")}
      </button>
      {entry ? null : (
        <>
          <p className="of-cost">
            <Feather size={14} strokeWidth={2} aria-hidden="true" />
            <span>{t("ui.otomeForge.arcs.planCost")}</span>
          </p>
          <ChapterPaintCost images={view.world.images} />
        </>
      )}
    </section>
  );
}

function Routes({
  routes,
  view,
  chapters,
  onOpen,
  onMakeItRight,
}: {
  routes: RouteEntry[];
  view: RunView;
  chapters: StoryChapterEntry[];
  onOpen: (route: RouteEntry) => void;
  onMakeItRight: (li: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="of-section of-glass" aria-labelledby="of-story-routes">
      <h2 id="of-story-routes" className="of-section-title">
        {t("ui.otomeForge.arcs.routesTitle")}
      </h2>
      <p className="of-hint">{t("ui.otomeForge.arcs.routesHint")}</p>
      <ul className="of-routes">
        {routes.map((route) => {
          const li = view.lis.find((item) => item.id === route.li);
          if (!li) return null;
          return (
            <RouteCard
              key={route.li}
              route={route}
              li={li}
              entry={route.next ? (chapters.find((chapter) => chapter.key === route.next?.key) ?? null) : null}
              images={view.world.images}
              onOpen={() => onOpen(route)}
              onMakeItRight={() => onMakeItRight(route.li)}
            />
          );
        })}
      </ul>
    </section>
  );
}

function RouteCard({
  route,
  li,
  entry,
  images,
  onOpen,
  onMakeItRight,
}: {
  route: RouteEntry;
  li: RunLiView;
  entry: StoryChapterEntry | null;
  images: RunView["world"]["images"];
  onOpen: () => void;
  onMakeItRight: () => void;
}) {
  const { t } = useTranslation();
  const accent = accentOf(li);
  const next = route.next;
  const values = pronounValues(li);
  const state = !next
    ? "complete"
    : next.blockedBy === "rupture"
      ? "rupture"
      : next.unlocked
        ? entry?.state === "in-progress"
          ? "reading"
          : "open"
        : "locked";
  const titleId = `of-route-${li.id}`;
  return (
    <li
      className="of-route"
      data-state={state}
      style={{ "--of-li-accent": accent } as CSSProperties}
      aria-labelledby={titleId}
    >
      <div className="of-chapter-head">
        <Avatar name={li.name} url={li.portrait} accent={accent} size={42} />
        <div className="of-chapter-heading">
          <p className="of-chapter-eyebrow">
            {t("ui.otomeForge.arcs.stageNow", { stage: route.stage, name: t(stageNameKey(route.stage)) })}
          </p>
          <h3 id={titleId} className="of-chapter-title">
            {li.name}
          </h3>
        </div>
        {next ? (
          <span className="of-badge of-badge--soft">
            {t("ui.otomeForge.arcs.stageNext", { name: t(stageNameKey(next.stage)) })}
          </span>
        ) : null}
      </div>
      {next ? (
        <p className="of-route-line">
          <Heart size={12} strokeWidth={2} fill="currentColor" aria-hidden="true" />
          {t("ui.otomeForge.arcs.nextChapter", { ...values, level: next.requires.level })}
        </p>
      ) : (
        <p className="of-route-line">{t("ui.otomeForge.arcs.complete", values)}</p>
      )}
      {state === "open" || state === "reading" ? (
        <div className="of-inline-actions">
          <button
            type="button"
            className="of-button of-button--primary of-button--small"
            aria-label={t(
              state === "reading" ? "ui.otomeForge.arcs.continueLabel" : "ui.otomeForge.arcs.beginLabel",
              values,
            )}
            onClick={onOpen}
          >
            <BookOpen size={14} strokeWidth={2} aria-hidden="true" />
            {state === "reading" ? t("ui.otomeForge.story.continue") : t("ui.otomeForge.arcs.begin")}
          </button>
          {entry ? null : (
            <>
              <p className="of-cost">
                <Feather size={14} strokeWidth={2} aria-hidden="true" />
                <span>{t("ui.otomeForge.arcs.planCost")}</span>
              </p>
              <ChapterPaintCost images={images} />
            </>
          )}
        </div>
      ) : state === "locked" && next ? (
        <p className="of-route-lock">
          <Lock size={13} strokeWidth={2.2} aria-hidden="true" />
          {t("ui.otomeForge.arcs.locked", { level: next.requires.level, current: li.level })}
        </p>
      ) : state === "rupture" ? (
        <div className="of-route-lock">
          <HeartCrack size={13} strokeWidth={2.2} aria-hidden="true" />
          <span>{t("ui.otomeForge.arcs.blocked", values)}</span>
          <button type="button" className="of-button of-button--text of-button--small" onClick={onMakeItRight}>
            {t("ui.otomeForge.arcs.makeItRight")}
          </button>
        </div>
      ) : null}
    </li>
  );
}

/** A route or repair chapter being planned (one model call, with Cancel); then it opens. A locked one says why. */
function ArcPlanDialog({
  view,
  target,
  planning: { planning, failed, stopped, cancel },
  onRetry,
  onClose,
}: {
  view: RunView;
  target: ArcTarget;
  planning: ReturnType<typeof usePlanChapter>;
  onRetry: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const actionRef = useRef<HTMLButtonElement>(null);
  useDialogFocus(actionRef, planning, failed);
  const li = view.lis.find((item) => item.id === target.li) ?? null;
  const values = li ? pronounValues(li) : { name: "", subject: "", object: "", possessive: "" };
  const locked = failed && otomeErrorCode(failed.error) === "locked";
  return (
    <Dialog
      wide
      title={
        target.kind === "route"
          ? t("ui.otomeForge.arcs.routeDialogTitle", values)
          : t("ui.otomeForge.arcs.repairDialogTitle", values)
      }
      onClose={planning ? undefined : onClose}
      actions={
        planning ? (
          <button
            ref={actionRef}
            type="button"
            className="of-button of-button--quiet of-glass"
            onClick={() => void cancel()}
          >
            <X size={16} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.reader.cancel")}
          </button>
        ) : (
          <>
            {stopped ? (
              <button type="button" className="of-button of-button--primary" onClick={onRetry}>
                <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
                {t("ui.otomeForge.common.retry")}
              </button>
            ) : null}
            <button ref={actionRef} type="button" className="of-button of-button--quiet of-glass" onClick={onClose}>
              {t("ui.otomeForge.reader.notNow")}
            </button>
          </>
        )
      }
    >
      {planning ? (
        <div className="of-planning" role="status">
          <Heart className="of-pulse" size={28} strokeWidth={1.6} fill="currentColor" aria-hidden="true" />
          <p className="of-body">
            {target.kind === "route"
              ? t("ui.otomeForge.arcs.planningRoute", values)
              : t("ui.otomeForge.arcs.planningRepair", values)}
          </p>
          <p className="of-hint">{t("ui.otomeForge.story.planningHint")}</p>
        </div>
      ) : locked ? (
        <p className="of-notice" role="alert">
          <Lock size={15} strokeWidth={2} aria-hidden="true" />
          <span>{t("ui.otomeForge.arcs.lockedNow", values)}</span>
        </p>
      ) : failed ? (
        <DeclinedPanel error={failed.error} run={view} job="structured" onRetry={onRetry} />
      ) : stopped ? (
        <p className="of-hint" role="status">
          {t("ui.otomeForge.story.planStopped")}
        </p>
      ) : null}
    </Dialog>
  );
}
