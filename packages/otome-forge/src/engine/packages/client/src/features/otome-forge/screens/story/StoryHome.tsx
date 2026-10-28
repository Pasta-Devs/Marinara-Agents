// ──────────────────────────────────────────────
// Otome Forge: the Story screen. The chapter being read (Continue), the next main chapter ("Who walks with you this
// chapter?": the server offers two Leads, the one least recently with her and the one with the ripest conflict; the
// planner adds a Foil), each love interest's affection, and every chapter so far as a path of its scenes.
// ──────────────────────────────────────────────
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  BookHeart,
  BookOpen,
  CalendarHeart,
  Eye,
  Feather,
  Heart,
  KeyRound,
  Phone,
  Repeat,
  RotateCcw,
  Sparkles,
  Star,
  Swords,
  X,
  type LucideIcon,
} from "lucide-react";
import { useOtomeApi } from "../../api";
import { Avatar } from "../../components/Avatar";
import { DeclinedPanel } from "../../components/DeclinedPanel";
import { Dialog } from "../../components/Dialog";
import { cancelStoryWork, runPath, storyQueryKey, useChapter, useStory } from "../../hooks/use-reader";
import { accentOf } from "../../lib/accent";
import type { ChapterView, LeadReason, RunLiView, RunView, StoryChapterEntry, StoryView } from "../../shared/api-types";
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
  const reading = chapters.find((chapter) => chapter.state === "in-progress") ?? null;
  return (
    <div className="of-page of-story">
      {head}
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
      {!reading && !next ? <p className="of-empty of-glass">{t("ui.otomeForge.story.nothingNext")}</p> : null}
      <Affection lis={view.lis} />
      {chapters.length ? <ChapterList chapters={chapters} view={view} onOpen={onOpenChapter} /> : null}
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
            {entry.title}
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
          node?.kind === "confrontation"
            ? NODE_ICONS.confrontation
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
                  <h3 className="of-chapter-title">{entry.title || t("ui.otomeForge.story.untitled")}</h3>
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
                  aria-label={`${t(action.key)}: ${entry.title}`}
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
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const [planning, setPlanning] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ li: string; error: unknown } | null>(null);
  const [stopped, setStopped] = useState(false);

  // The body is replaced under the focused control (a candidate by the planning status, the status by the failure):
  // focus moves to what took its place, Cancel while it plans and Retry when it failed, so it never leaves the modal.
  useEffect(() => {
    const panel = actionRef.current?.closest<HTMLElement>('[role="dialog"]');
    if (!panel) return;
    const active = document.activeElement;
    const lost = !active || active === document.body || !panel.contains(active);
    if (failed) (panel.querySelector<HTMLElement>(".of-declined [data-autofocus]") ?? actionRef.current)?.focus();
    else if (planning && lost) actionRef.current?.focus();
  }, [planning, failed]);
  const candidates = next.candidates.flatMap((candidate) => {
    const li = view.lis.find((item) => item.id === candidate.li);
    return li ? [{ li, reason: candidate.reason }] : [];
  });

  const plan = async (li: string) => {
    if (planning) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setPlanning(li);
    setFailed(null);
    setStopped(false);
    try {
      const { chapter } = await otome.post<{ chapter: ChapterView }>(
        `${runPath(runKey)}/chapters/next`,
        { lead: li },
        {
          signal: controller.signal,
        },
      );
      void queryClient.invalidateQueries({ queryKey: storyQueryKey(runKey) });
      onPlanned(chapter.key);
    } catch (error) {
      if (controller.signal.aborted) return;
      setFailed({ li, error });
      setPlanning(null);
    }
  };

  const cancel = async () => {
    abortRef.current?.abort();
    setPlanning(null);
    setStopped(true);
    await cancelStoryWork(otome.post, runKey);
  };

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
        <DeclinedPanel error={failed.error} run={view} job="structured" onRetry={() => void plan(failed.li)} />
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
