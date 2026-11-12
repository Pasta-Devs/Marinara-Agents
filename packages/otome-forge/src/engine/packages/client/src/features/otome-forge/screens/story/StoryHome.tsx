// ──────────────────────────────────────────────
// Otome Forge: the Story screen. A rupture's banner first ("{name} is keeping {their} distance", with Make it right,
// which plans or opens the repair chapter), the chapter being read (Continue), the next main chapter ("Who walks with
// you this chapter?": the server offers two Leads, the one least recently with her and the one with the ripest
// conflict; the planner adds a Foil), each love interest's route (his next free chapter, open from an affection level
// and shut while a rupture is open, with his side of a big moment waiting under it: #2155), each one's affection (past
// level 10, prestige and the extra story it unlocks: #2025), and every chapter so far as a path of its scenes.
// #2156: a rupture he holds is his grievance with her: the banner and his route say how much space he still needs
// before Make it right opens, the Lead dialog says why he can't lead, and his affection shows as paused. Beside each
// one's route, "I'm upset with them" (asked first, then POST /routes/:li/upset; tapping it again takes it back).
// Planning a chapter is one model call with Cancel while it runs, with something to do meanwhile: the story so far to
// read while an arc is planned (#2040), the personality quiz while any other chapter is (#2174). A chapter already
// planned opens with none, and so does his side, which is written with no model call.
// ──────────────────────────────────────────────
import { Fragment, useEffect, useId, useRef, useState, type CSSProperties, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookHeart,
  BookOpen,
  CalendarHeart,
  Check,
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
import { ChapterPaintCost, CostHint, usePaintsByItself } from "../../components/CostHint";
import { DeclinedPanel } from "../../components/DeclinedPanel";
import { Dialog } from "../../components/Dialog";
import { useCharacterOptions } from "../../hooks/use-engine-resources";
import { cancelStoryWork, runPath, storyQueryKey, useChapter, useStory } from "../../hooks/use-reader";
import { runQueryKey } from "../../hooks/use-run";
import { accentOf, nameAccent } from "../../lib/accent";
import { emptyPronouns, resolvePronouns, type PronounChoice } from "../setup/draft";
import { PronounPicker } from "../setup/parts";
import { ARCHETYPES, ARCHETYPE_IDS } from "../../shared/archetypes";
import type {
  ArcChoice,
  ChapterView,
  LeadReason,
  PrestigeEntry,
  RepairEntry,
  RouteEntry,
  RunLiView,
  RunView,
  BondEntry,
  StoryChapterEntry,
  StoryView,
} from "../../shared/api-types";
import { hisSideLiOf, stageRow, type HisSideEntry, type StageName } from "../../shared/arcs";
import {
  BOND_MAX_LEVEL,
  GRIEVANCE_CLEARED_AFFECTION,
  MAX_LEVEL,
  PRESTIGE_POINTS_PER_STORY,
} from "../../shared/economy";
import { BOND_RANKS, bondStepOf } from "../../shared/bond";
import { chapterEyebrowKey, chapterTitle } from "../reader/ReaderControls";
import { PersonalityQuiz } from "./PersonalityQuiz";

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
  // #2155: his side is written with no model call, so its Read shows the wait and the dialog opens only to say why it
  // did not open; once open it stays through a Retry (which then shows the wait in it), so focus never drops.
  const [sideDialog, setSideDialog] = useState<ArcTarget | null>(null);
  if (arcPlan?.kind === "side" && sideDialog !== arcPlan && (arcPlanning.failed || arcPlanning.stopped)) {
    setSideDialog(arcPlan);
  }

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
  const prestige = Array.isArray(story.data.prestige) ? story.data.prestige : [];
  // 0.23.0: each love interest's bond rank whose story is waiting (POST /runs/:run/bond/:li opens it).
  const bond = Array.isArray(story.data.bond) ? story.data.bond : [];
  // #2156: each love interest whose grievance with her stands (his repair carries the space it waits for).
  const held = new Set(repairs.flatMap((repair) => (repair.space ? [repair.li] : [])));
  const sides = Array.isArray(story.data.hisSides) ? story.data.hisSides : [];
  // A main chapter in progress is the one to continue; a route or repair chapter, and his side, has its own card.
  const reading =
    chapters.find((chapter) => chapter.state === "in-progress" && chapter.kind === "main") ??
    chapters.find(
      (chapter) =>
        chapter.state === "in-progress" &&
        !routes.some((route) => route.next?.key === chapter.key) &&
        !repairs.some((repair) => repair.key === chapter.key) &&
        !hisSideLiOf(chapter.key),
    ) ??
    null;
  /** Opens a route or repair chapter that is already planned; plans it (one model call) otherwise. */
  const planArc = (target: ArcTarget) =>
    void arcPlanning.plan(target.key, arcPath(target), target.kind === "side" ? { arc: target.arc } : {}, (key) => {
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
      {story.data.arc ? (
        <p className="of-eyebrow of-story-arc" title={story.data.arc.label}>
          {t("ui.otomeForge.story.arcLine", {
            chapter: Math.min(story.data.arc.read + 1, story.data.arc.endsAt - story.data.arc.from + 1),
            total: story.data.arc.endsAt - story.data.arc.from + 1,
            label: story.data.arc.label,
          })}
          {/* #1983 M4: a breathing arc says what it is. */}
          {story.data.arc.kind === "breathing" ? (
            <span className="of-badge of-badge--soft of-story-arc-kind">{t("ui.otomeForge.story.arcQuiet")}</span>
          ) : null}
        </p>
      ) : null}
      {reading ? <ContinueCard runKey={runKey} entry={reading} view={view} onOpen={onOpenChapter} /> : null}
      {story.data.arcChoice && !reading ? (
        <ArcChoiceCard runKey={runKey} options={story.data.arcChoice} images={view.world.images} />
      ) : null}
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
          runKey={runKey}
          routes={routes}
          repairs={repairs}
          view={view}
          chapters={chapters}
          onOpen={(route) => route.next && openArc({ kind: "route", li: route.li, key: route.next.key })}
          onMakeItRight={(li) => {
            const repair = repairs.find((item) => item.li === li);
            if (repair) openArc({ kind: "repair", li, key: repair.key });
          }}
          sides={sides}
          bondStories={bond}
          planning={arcPlanning.planning}
          onReadSide={(entry) => openArc({ kind: "side", li: entry.li, key: entry.key, arc: entry.arc })}
        />
      ) : null}
      <Affection
        lis={view.lis}
        held={held}
        images={view.world.images}
        prestige={prestige}
        onPrestige={(entry) => openArc({ kind: "prestige", li: entry.li, key: entry.key })}
        bondStories={bond}
        onBond={(entry) => openArc({ kind: "bond", li: entry.li, key: entry.key })}
      />
      {chapters.length ? <ChapterList chapters={chapters} view={view} onOpen={onOpenChapter} /> : null}
      {arcPlan && (arcPlan.kind !== "side" || sideDialog === arcPlan) ? (
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
          held={held}
          next={next}
          opensArc={!story.data.arc}
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
            {chapterTitle(t, entry, view.lis)}
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

/**
 * Each love interest's affection level (1–20, it only rises), as ten outer hearts for levels 1-10 and an inner heart in
 * each for a bond rank once his finale is read (0.23.0). At the last rank (#2025), prestige: three pips, progress toward
 * the next one, and a way to the extra story three of them unlock, while it waits to be written.
 */
function Affection({
  lis,
  held,
  images,
  prestige,
  onPrestige,
  bondStories,
  onBond,
}: {
  lis: RunLiView[];
  /** #2156: whose affection is paused while their grievance with her stands. */
  held: ReadonlySet<string>;
  images: RunView["world"]["images"];
  prestige: PrestigeEntry[];
  onPrestige: (entry: PrestigeEntry) => void;
  /** 0.23.0: each love interest's bond rank whose story waits. */
  bondStories: BondEntry[];
  onBond: (entry: BondEntry) => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="of-section of-glass" aria-labelledby="of-story-affection">
      <h2 id="of-story-affection" className="of-section-title">
        {t("ui.otomeForge.story.affectionTitle")}
      </h2>
      <ul className="of-affection-list">
        {lis.map((li) => {
          const accent = accentOf(li);
          // 0.23.0: ten outer hearts for levels 1-10, and an inner heart in each for a bond rank once his finale is
          // read (rank 11 is the first inner heart), so the row shows both ladders at a glance.
          const level = Math.max(1, Math.min(BOND_MAX_LEVEL, li.level));
          const outer = Math.min(MAX_LEVEL, level);
          const bond = li.bond;
          const inner = bond ? Math.max(0, Math.min(BOND_RANKS.length, bond.level - MAX_LEVEL)) : 0;
          return (
            <li key={li.id} className="of-affection" style={{ "--of-li-accent": accent } as CSSProperties}>
              <Avatar name={li.name} url={li.portrait} accent={accent} size={38} />
              <span className="of-affection-name">{li.name}</span>
              <span
                className="of-hearts"
                role="img"
                aria-label={
                  bond
                    ? t("ui.otomeForge.story.levelOfBond", {
                        name: li.name,
                        level: outer,
                        max: MAX_LEVEL,
                        bond: inner,
                        bondMax: BOND_RANKS.length,
                      })
                    : t("ui.otomeForge.story.levelOf", { name: li.name, level: outer, max: MAX_LEVEL })
                }
              >
                {Array.from({ length: MAX_LEVEL }, (_, index) => (
                  <span key={index} className="of-heart" data-on={index < outer} aria-hidden="true">
                    <Heart size={16} strokeWidth={1.8} fill={index < outer ? "currentColor" : "none"} />
                    {bond ? (
                      <Heart
                        className="of-heart-inner"
                        size={7}
                        strokeWidth={2.4}
                        fill={index < inner ? "currentColor" : "none"}
                        data-inner-on={index < inner}
                      />
                    ) : null}
                  </span>
                ))}
              </span>
              <span className="of-affection-level" aria-hidden="true">
                {bond
                  ? t("ui.otomeForge.story.levelBond", { level: outer, rank: bond.name })
                  : t("ui.otomeForge.story.level", { level: outer })}
              </span>
              {level === BOND_MAX_LEVEL && li.prestige ? (
                <span
                  className="of-affection-progress"
                  role="meter"
                  aria-label={t("ui.otomeForge.story.prestigeProgress", { name: li.name })}
                  aria-valuemin={0}
                  aria-valuemax={li.prestige.required}
                  aria-valuenow={li.prestige.current}
                  aria-valuetext={t("ui.otomeForge.story.prestigeProgressValue", {
                    current: li.prestige.current,
                    required: li.prestige.required,
                  })}
                >
                  {t("ui.otomeForge.story.affectionProgressCount", {
                    current: li.prestige.current,
                    required: li.prestige.required,
                  })}
                </span>
              ) : li.affectionProgress ? (
                <span
                  className="of-affection-progress"
                  role="meter"
                  aria-label={t("ui.otomeForge.story.affectionProgress", { name: li.name })}
                  aria-valuemin={0}
                  aria-valuemax={li.affectionProgress.required}
                  aria-valuenow={li.affectionProgress.current}
                  aria-valuetext={
                    // The server reports a finished ladder as a full meter (600 of 600 at level 10 with the gate shut,
                    // 1,100 of 1,100 at the last rank); level 10 with his finale read is 0 of 650 toward rank 11.
                    // A full bar with bond ranks open is not the end: the rank is reached and its story waits, so nine
                    // ranks can remain behind a meter that reads as finished (Dottore, #2254).
                    li.affectionProgress.current >= li.affectionProgress.required && !li.bond
                      ? t("ui.otomeForge.story.affectionProgressMax")
                      : t("ui.otomeForge.story.affectionProgressValue", li.affectionProgress)
                  }
                >
                  {t("ui.otomeForge.story.affectionProgressCount", li.affectionProgress)}
                </span>
              ) : null}
              {held.has(li.id) ? (
                <span className="of-affection-paused">{t("ui.otomeForge.story.affectionPaused")}</span>
              ) : null}
              {li.bond && bondStories.some((entry) => entry.li === li.id) ? (
                <button
                  type="button"
                  className="of-button of-button--primary of-button--small of-bond-open"
                  onClick={() => {
                    const entry = bondStories.find((candidate) => candidate.li === li.id);
                    if (entry) onBond(entry);
                  }}
                >
                  <BookHeart size={14} strokeWidth={2} aria-hidden="true" />
                  {t("ui.otomeForge.story.bondOpen", { rank: li.bond.name })}
                </button>
              ) : null}
              {level === BOND_MAX_LEVEL && li.prestige ? (
                <PrestigeRow
                  li={li}
                  images={images}
                  entry={prestige.find((entry) => entry.li === li.id)}
                  onOpen={onPrestige}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="of-hint">{t("ui.otomeForge.story.affectionHint")}</p>
      {lis.some((li) => li.prestige) ? <p className="of-hint">{t("ui.otomeForge.story.prestigeHint")}</p> : null}
    </section>
  );
}

/** "Prestige" and its pips, then "A new story with {{name}}" while an unlocked extra story waits to be written. */
function PrestigeRow({
  li,
  images,
  entry,
  onOpen,
}: {
  li: RunLiView;
  images: RunView["world"]["images"];
  entry: PrestigeEntry | undefined;
  onOpen: (entry: PrestigeEntry) => void;
}) {
  const { t } = useTranslation();
  const points = li.prestige?.points ?? 0;
  return (
    <div className="of-prestige">
      <span
        className="of-prestige-pips"
        role="img"
        aria-label={t("ui.otomeForge.story.prestigeOf", { name: li.name, points, max: PRESTIGE_POINTS_PER_STORY })}
      >
        <span aria-hidden="true">{t("ui.otomeForge.story.prestige")}</span>
        {Array.from({ length: PRESTIGE_POINTS_PER_STORY }, (_, index) => (
          <Star
            key={index}
            size={11}
            strokeWidth={2}
            fill={index < points ? "currentColor" : "none"}
            data-on={index < points}
            aria-hidden="true"
          />
        ))}
      </span>
      {entry ? (
        <>
          <button type="button" className="of-button of-button--primary of-button--small" onClick={() => onOpen(entry)}>
            <BookHeart size={14} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.story.prestigeNew", { name: li.name })}
          </button>
          <p className="of-cost">
            <Feather size={14} strokeWidth={2} aria-hidden="true" />
            <span>{t("ui.otomeForge.arcs.planCost")}</span>
          </p>
          <ChapterPaintCost images={images} />
        </>
      ) : null}
    </div>
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
        {chapters.map((entry, index) => {
          const lead = view.lis.find((li) => li.id === (entry.li ?? entry.lead)) ?? null;
          const title = chapterTitle(t, entry, view.lis);
          const action =
            entry.state === "done"
              ? { key: "ui.otomeForge.story.replay", Icon: Repeat, primary: false }
              : entry.state === "in-progress"
                ? { key: "ui.otomeForge.story.continue", Icon: BookOpen, primary: true }
                : null;
          // #1983 M4: a heading where a new arc's chapters begin, and where the ones from before arcs do. Only the
          // prologue and main chapters belong to an arc: route, repair and story chapters get no heading of their own
          // and never open a second "before the arcs" one (Dottore on #1991).
          const inArc = entry.kind === "prologue" || entry.kind === "main";
          const previous = chapters
            .slice(0, index)
            .reverse()
            .find((other) => other.kind === "prologue" || other.kind === "main");
          const startsArc = inArc && (index === 0 || previous?.arc !== entry.arc);
          const heading = startsArc ? (
            <li key={`arc-${entry.arc ?? "none"}`} className="of-chapter-arc" aria-hidden="true">
              {entry.arc
                ? t("ui.otomeForge.story.arcHeading", { number: entry.arc })
                : t("ui.otomeForge.story.arcHeadingBefore")}
            </li>
          ) : null;
          return (
            <Fragment key={entry.key}>
              {heading}
              <li
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
            </Fragment>
          );
        })}
      </ol>
    </section>
  );
}

interface LeadDialogProps {
  runKey: string;
  view: RunView;
  /** #2156: who can't lead while their grievance with her stands (the server leaves them out of the candidates). */
  held: ReadonlySet<string>;
  next: NonNullable<StoryView["next"]>;
  /** No arc covers the next chapter yet (the story's first): the server plans the arc before the chapter. */
  opensArc: boolean;
  onClose: () => void;
  onPlanned: (key: string) => void;
}

/**
 * "Who walks with you this chapter?": picking a Lead plans the chapter (one model call, two when its arc is planned
 * first), with Cancel while it runs.
 */
function LeadDialog({ runKey, view, held, next, opensArc, onClose, onPlanned }: LeadDialogProps) {
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
  const costNote = opensArc ? "ui.otomeForge.story.planArcCostNote" : "ui.otomeForge.story.planCostNote";
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
        <>
          <div className="of-planning" role="status">
            <Heart className="of-pulse" size={28} strokeWidth={1.6} fill="currentColor" aria-hidden="true" />
            <p className="of-body">
              {t("ui.otomeForge.story.planning", { number: next.number, name: planningLi?.name ?? "" })}
            </p>
            <p className="of-hint">{t("ui.otomeForge.story.planningHint")}</p>
          </div>
          {/* #2174: the story so far while an arc is planned too; otherwise the personality quiz. */}
          {opensArc ? <StorySoFar runKey={runKey} /> : <PersonalityQuiz runKey={runKey} lis={view.lis} />}
        </>
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
          {view.lis
            .filter((li) => held.has(li.id) && !candidates.some((candidate) => candidate.li.id === li.id))
            .map((li) => (
              <p key={li.id} className="of-hint of-lead-held">
                <HeartCrack size={13} strokeWidth={2.2} aria-hidden="true" />
                <span>{t("ui.otomeForge.story.leadHeld", pronounValues(li))}</span>
              </p>
            ))}
          <p className="of-cost">
            <Feather size={14} strokeWidth={2} aria-hidden="true" />
            <span>
              {t("ui.otomeForge.story.planCost")}
              <span className="of-cost-note"> · {t(costNote)}</span>
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
 * "What happened so far…" (#2040): the story's running summary (the memory's saved overview, as written) to read while
 * an arc is planned (#2174: the next arc, or a chapter that opens one; any other chapter's wait has the personality
 * quiz). Read afresh on each wait and never kept; nothing shows before the first summary, or when it
 * cannot be read. It scrolls on its own (a named, tabbable region, as the backlog's list is) under the planning status,
 * outside its live region, so the long text is never announced as status.
 */
function StorySoFar({ runKey }: { runKey: string }) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const titleId = useId();
  const { data: paragraphs } = useQuery({
    queryKey: ["otome-forge", "memory-overview", runKey],
    queryFn: async () => (await otome.get<{ paragraphs: string[] }>(`${runPath(runKey)}/memory/overview`)).paragraphs,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  if (!paragraphs?.length) return null;
  return (
    <div className="of-so-far">
      <h3 id={titleId} className="of-eyebrow">
        {t("ui.otomeForge.story.soFarTitle")}
      </h3>
      <div className="of-so-far-text" role="region" aria-labelledby={titleId} tabIndex={0}>
        {paragraphs.map((text, index) => (
          <p key={index}>{text}</p>
        ))}
      </div>
    </div>
  );
}

/**
 * Plans a chapter: one model call at a time, with Cancel (the server stops the write; the request is dropped). A
 * second press while one runs does nothing. The story list is refreshed once the plan lands.
 */
/**
 * The end of an arc (#1983 M2/M3): three ways on, each explained, and the cost before the tap. Breathing room and the
 * story going on plan the next arc; someone new first writes them, then the arc that brings them in.
 */
function ArcChoiceCard({
  runKey,
  options,
  images,
}: {
  runKey: string;
  options: { options: ArcChoice[]; castFull: boolean };
  images: RunView["world"]["images"];
}) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<ArcChoice | null>(null);
  const [failed, setFailed] = useState<unknown>(null);
  const [arriving, setArriving] = useState(false);
  const plan = async (choice: ArcChoice, newcomer?: Record<string, unknown>) => {
    if (busy) return;
    setBusy(choice);
    setFailed(null);
    try {
      await otome.post(`${runPath(runKey)}/arcs`, { choice, ...(newcomer ? { newcomer } : {}) });
      void queryClient.invalidateQueries({ queryKey: storyQueryKey(runKey) });
      // Someone new gets their paint step on the run's next read (S/setup/forge.ts forgeCast), painting by itself or
      // waiting in Your cast.
      if (newcomer) void queryClient.invalidateQueries({ queryKey: runQueryKey(runKey) });
      setArriving(false);
    } catch (error) {
      setFailed(error);
      void queryClient.invalidateQueries({ queryKey: storyQueryKey(runKey) });
    } finally {
      setBusy(null);
    }
  };
  const ways: Array<{ choice: ArcChoice; title: string; hint: string }> = [
    { choice: "breathe", title: t("ui.otomeForge.story.arcBreathe"), hint: t("ui.otomeForge.story.arcBreatheHint") },
    { choice: "continue", title: t("ui.otomeForge.story.arcContinue"), hint: t("ui.otomeForge.story.arcContinueHint") },
    ...(options.options.includes("newcomer")
      ? [
          {
            choice: "newcomer" as const,
            title: t("ui.otomeForge.story.arcNewcomer"),
            hint: t("ui.otomeForge.story.arcNewcomerHint"),
          },
        ]
      : []),
  ];
  // Someone new is written first, then the arc that brings them in (#1983 M3).
  const cost = options.options.includes("newcomer")
    ? "ui.otomeForge.story.arcChoiceNewcomerCost"
    : "ui.otomeForge.story.arcChoiceCost";
  return (
    <section className="of-section of-glass of-story-next" aria-labelledby="of-arc-choice">
      <p className="of-eyebrow">{t("ui.otomeForge.story.arcChoiceTitle")}</p>
      <h2 id="of-arc-choice" className="of-section-title">
        {t("ui.otomeForge.story.arcChoiceText")}
      </h2>
      <p className="of-hint">{t(cost)}</p>
      {failed ? <p className="of-notice of-notice--error">{otome.errorMessage(failed)}</p> : null}
      <div className="of-choices">
        {ways.map((way) => (
          <button
            key={way.choice}
            type="button"
            className="of-button of-button--quiet of-glass of-arc-way"
            disabled={busy !== null}
            onClick={() => (way.choice === "newcomer" ? setArriving(true) : void plan(way.choice))}
          >
            <strong>{way.title}</strong>
            <span className="of-hint">{way.hint}</span>
          </button>
        ))}
      </div>
      {/* Someone new's wait shows these in their dialog, never a second copy behind its scrim. */}
      {busy && busy !== "newcomer" ? (
        <>
          <p className="of-hint of-planning">{t("ui.otomeForge.story.arcPlanning")}</p>
          <StorySoFar runKey={runKey} />
        </>
      ) : null}
      {arriving ? (
        <NewcomerDialog
          runKey={runKey}
          images={images}
          busy={busy === "newcomer"}
          onClose={() => setArriving(false)}
          onArrive={(newcomer) => void plan("newcomer", newcomer)}
        />
      ) : null}
    </section>
  );
}

/**
 * Who arrives (#1983 M3): one of the player's cards, or someone invented. While they and their arc are written, the
 * dialog shows the arc's planning status and what happened so far (#2040) in place of the choices.
 */
function NewcomerDialog({
  runKey,
  images,
  busy,
  onClose,
  onArrive,
}: {
  runKey: string;
  images: RunView["world"]["images"];
  busy: boolean;
  onClose: () => void;
  onArrive: (newcomer: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation();
  const cards = useCharacterOptions();
  const [mode, setMode] = useState<"card" | "archetype">("card");
  const [cardId, setCardId] = useState("");
  const [name, setName] = useState("");
  const [archetype, setArchetype] = useState(ARCHETYPE_IDS[0]);
  // A card carries no pronouns of its own: the player picks them, as setup asks (#1985 review).
  const [pronouns, setPronouns] = useState<PronounChoice>(emptyPronouns());
  const resolved = resolvePronouns(pronouns);
  const byItself = usePaintsByItself(images);
  return (
    <Dialog
      title={t("ui.otomeForge.story.newcomerTitle")}
      onClose={busy ? undefined : onClose}
      actions={
        <>
          <button type="button" className="of-button of-button--quiet of-glass" onClick={onClose} disabled={busy}>
            {t("ui.otomeForge.home.close")}
          </button>
          <button
            type="button"
            className="of-button of-button--primary"
            disabled={busy || !resolved || (mode === "card" ? !cardId : !name.trim())}
            onClick={() =>
              onArrive(
                mode === "card"
                  ? { source: "card", cardId, pronouns: resolved }
                  : {
                      source: "archetype",
                      archetype,
                      name: name.trim(),
                      pronouns: resolved,
                    },
              )
            }
          >
            {t("ui.otomeForge.story.newcomerConfirm")}
          </button>
        </>
      }
    >
      {busy ? (
        <>
          <p className="of-hint of-planning" role="status">
            {t("ui.otomeForge.story.arcPlanning")}
          </p>
          <StorySoFar runKey={runKey} />
        </>
      ) : (
        <>
          <p className="of-hint">{t("ui.otomeForge.story.newcomerCost")}</p>
          {images.connectionId ? (
            <CostHint
              images={1}
              note={t(byItself ? "ui.otomeForge.story.newcomerLookAutoNote" : "ui.otomeForge.story.newcomerLookNote")}
            />
          ) : null}
          <fieldset className="of-field">
            <label>
              <input type="radio" checked={mode === "card"} onChange={() => setMode("card")} />{" "}
              {t("ui.otomeForge.story.newcomerCard")}
            </label>
            <label>
              <input type="radio" checked={mode === "archetype"} onChange={() => setMode("archetype")} />{" "}
              {t("ui.otomeForge.story.newcomerScratch")}
            </label>
          </fieldset>
          <PronounPicker legend={t("ui.otomeForge.story.newcomerPronouns")} value={pronouns} onChange={setPronouns} />
          {mode === "card" ? (
            // Setup's card tiles (CastStep): a grid with a check on the one chosen. The of-cast-pick classes this used
            // had no styles, so the list fell apart and a tap showed nothing.
            <ul className="of-tiles of-tiles--scroll" aria-label={t("ui.otomeForge.story.newcomerCard")}>
              {cards.items.map((card) => {
                const picked = cardId === card.id;
                return (
                  <li key={card.id}>
                    <button
                      type="button"
                      className="of-tile of-glass"
                      data-checked={picked}
                      aria-pressed={picked}
                      title={card.name}
                      onClick={() => setCardId(card.id)}
                    >
                      <Avatar
                        name={card.name}
                        url={card.avatarUrl}
                        crop={card.avatarCrop}
                        accent={nameAccent(card.name)}
                      />
                      <span className="of-tile-name">{card.name}</span>
                      {picked ? (
                        <span className="of-tile-check" aria-hidden="true">
                          <Check size={12} strokeWidth={3} />
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <>
              <label className="of-field">
                <span>{t("ui.otomeForge.story.newcomerName")}</span>
                <input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
                <span className="of-hint">{t("ui.otomeForge.story.newcomerNameHint")}</span>
              </label>
              <label className="of-field">
                <span>{t("ui.otomeForge.story.newcomerArchetype")}</span>
                <select value={archetype} onChange={(event) => setArchetype(event.target.value as typeof archetype)}>
                  {ARCHETYPE_IDS.map((id) => (
                    <option key={id} value={id}>
                      {ARCHETYPES[id].name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </>
      )}
    </Dialog>
  );
}

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

/**
 * A route or repair chapter, an extra story (#2025) or his side of story arc `arc` (#2155), to open, planning it first
 * when it has no plan yet.
 */
type ArcTarget =
  | { kind: "route" | "repair" | "prestige" | "bond"; li: string; key: string }
  /** His side of story arc `arc` (#2155): the route always needs the arc it belongs to. */
  | { kind: "side"; li: string; key: string; arc: number };

const ARC_PATHS = { repair: "repairs", prestige: "prestige", bond: "bond", side: "sides" } as const;

/** POST /runs/:run/routes/:li/next, /repairs/:li, /prestige/:li, /bond/:li or /sides/:li. */
const arcPath = (target: ArcTarget) =>
  target.kind === "route"
    ? `/routes/${encodeURIComponent(target.li)}/next`
    : `/${ARC_PATHS[target.kind]}/${encodeURIComponent(target.li)}`;

const ARC_DIALOG_KEYS: Record<ArcTarget["kind"], { title: string; planning: string; locked: string }> = {
  route: {
    title: "ui.otomeForge.arcs.routeDialogTitle",
    planning: "ui.otomeForge.arcs.planningRoute",
    locked: "ui.otomeForge.arcs.lockedNow",
  },
  repair: {
    title: "ui.otomeForge.arcs.repairDialogTitle",
    planning: "ui.otomeForge.arcs.planningRepair",
    locked: "ui.otomeForge.arcs.lockedNow",
  },
  prestige: {
    title: "ui.otomeForge.story.prestigeNew",
    planning: "ui.otomeForge.arcs.planningPrestige",
    locked: "ui.otomeForge.story.prestigeLocked",
  },
  // 0.23.0: a bond rank's story, planned on the tap like the others.
  bond: {
    title: "ui.otomeForge.story.bondNew",
    planning: "ui.otomeForge.arcs.planningBond",
    locked: "ui.otomeForge.arcs.bondLocked",
  },
  side: {
    title: "ui.otomeForge.arcs.sideTitle",
    planning: "ui.otomeForge.arcs.planningSide",
    locked: "ui.otomeForge.arcs.sideLocked",
  },
};

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
      <p className="of-body">
        {t(repair.space ? "ui.otomeForge.arcs.heldText" : "ui.otomeForge.arcs.ruptureText", pronounValues(li))}
      </p>
      {repair.space ? (
        <p className="of-hint">
          {t("ui.otomeForge.arcs.clearReward", { ...pronounValues(li), amount: GRIEVANCE_CLEARED_AFFECTION })}
        </p>
      ) : null}
      {needsSpace(repair) ? <SpaceMeter li={li} space={repair.space!} /> : null}
      {needsSpace(repair) ? null : (
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
      )}
      {entry || needsSpace(repair) ? null : (
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

/** #2156: his grievance with her has not had its space yet, so Make it right waits. */
const needsSpace = (repair: RepairEntry | undefined) => !!repair?.space && repair.space.had < repair.space.needed;

/** #2156: how much space his grievance still needs, in words and as a bar. */
function SpaceMeter({ li, space }: { li: RunLiView; space: NonNullable<RepairEntry["space"]> }) {
  const { t } = useTranslation();
  const left = Math.max(0, space.needed - space.had);
  const label = t("ui.otomeForge.arcs.spaceLeft", { ...pronounValues(li), count: left });
  return (
    <div className="of-meter of-space">
      <p className="of-route-lock">
        <HeartCrack size={13} strokeWidth={2.2} aria-hidden="true" />
        <span>{label}</span>
      </p>
      <div
        className="of-meter-bar"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={space.needed}
        aria-valuenow={Math.min(space.had, space.needed)}
      >
        <span style={{ inlineSize: `${(Math.min(space.had, space.needed) / space.needed) * 100}%` }} />
      </div>
    </div>
  );
}

function Routes({
  runKey,
  routes,
  repairs,
  view,
  chapters,
  onOpen,
  onMakeItRight,
  sides,
  bondStories,
  planning,
  onReadSide,
}: {
  runKey: string;
  routes: RouteEntry[];
  repairs: RepairEntry[];
  view: RunView;
  chapters: StoryChapterEntry[];
  onOpen: (route: RouteEntry) => void;
  onMakeItRight: (li: string) => void;
  sides: HisSideEntry[];
  /** 0.24.5: each love interest's bond rank whose story waits, so his card says so past his finale. */
  bondStories: BondEntry[];
  /** The key being opened (usePlanChapter's `planning`), so a side's Read shows the wait. */
  planning: string | null;
  onReadSide: (entry: HisSideEntry) => void;
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
              runKey={runKey}
              route={route}
              repair={repairs.find((repair) => repair.li === route.li)}
              li={li}
              entry={route.next ? (chapters.find((chapter) => chapter.key === route.next?.key) ?? null) : null}
              images={view.world.images}
              onOpen={() => onOpen(route)}
              onMakeItRight={() => onMakeItRight(route.li)}
              sides={sides.filter((entry) => entry.li === route.li)}
              bondWaits={bondStories.some((entry) => entry.li === route.li)}
              planning={planning}
              onReadSide={onReadSide}
            />
          );
        })}
      </ul>
    </section>
  );
}

function RouteCard({
  runKey,
  route,
  repair,
  li,
  entry,
  images,
  onOpen,
  onMakeItRight,
  sides,
  bondWaits,
  planning,
  onReadSide,
}: {
  runKey: string;
  route: RouteEntry;
  /** His repair on offer, while a rupture stands (#2156: with the space his own grievance still needs). */
  repair?: RepairEntry;
  li: RunLiView;
  entry: StoryChapterEntry | null;
  images: RunView["world"]["images"];
  onOpen: () => void;
  onMakeItRight: () => void;
  sides: HisSideEntry[];
  /** 0.24.5: his bond rank is reached and its story waits (GET /runs/:run/story `bond`). */
  bondWaits: boolean;
  planning: string | null;
  onReadSide: (entry: HisSideEntry) => void;
}) {
  const { t } = useTranslation();
  const accent = accentOf(li);
  const next = route.next;
  const values = pronounValues(li);
  // 0.24.5: past his finale (no next stage) the route goes on in the bond ranks, 11-20, so the card names the next one,
  // or the one whose story waits, and is complete only at the last rank (C/shared/bond.ts bondStepOf). It said
  // "complete" from the finale on, with ten ranks still ahead.
  const step = next ? null : bondStepOf(li.bond, bondWaits);
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
        ) : step && "next" in step ? (
          <span className="of-badge of-badge--soft">{t("ui.otomeForge.arcs.stageNext", { name: step.next.name })}</span>
        ) : null}
      </div>
      {next ? (
        <p className="of-route-line">
          <Heart size={12} strokeWidth={2} fill="currentColor" aria-hidden="true" />
          {t("ui.otomeForge.arcs.nextChapter", { ...values, level: next.requires.level })}
        </p>
      ) : step && "waiting" in step ? (
        <p className="of-route-line">
          <BookHeart size={12} strokeWidth={2} aria-hidden="true" />
          {t("ui.otomeForge.arcs.bondWaiting", { ...values, rank: step.waiting.name })}
        </p>
      ) : step ? (
        <p className="of-route-line">
          <Heart size={12} strokeWidth={2} fill="currentColor" aria-hidden="true" />
          {t("ui.otomeForge.arcs.bondNext", { ...values, level: step.next.level, rank: step.next.name })}
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
          {needsSpace(repair) ? (
            <span>
              {t("ui.otomeForge.arcs.spaceLeft", { ...values, count: repair!.space!.needed - repair!.space!.had })}
            </span>
          ) : (
            <button type="button" className="of-button of-button--text of-button--small" onClick={onMakeItRight}>
              {t("ui.otomeForge.arcs.makeItRight")}
            </button>
          )}
        </div>
      ) : null}
      {sides.map((side) => (
        <SideRow
          key={side.key}
          entry={side}
          li={li}
          images={images}
          opening={planning === side.key}
          onRead={() => onReadSide(side)}
        />
      ))}
      <UpsetToggle runKey={runKey} li={li} upset={!!route.upset} />
    </li>
  );
}

/** #2155: the moment his side tells again, in the words the reader's chapter end and climaxes already use. */
function sideMoment(t: ReturnType<typeof useTranslation>["t"], entry: HisSideEntry, li: RunLiView): string {
  const values = pronounValues(li);
  switch (entry.moment) {
    case "stage":
      return t("ui.otomeForge.arcs.stageUp", {
        ...values,
        stage: entry.stage,
        stageName: t(stageNameKey(entry.stage)),
      });
    case "truth":
      return t("ui.otomeForge.confrontation.truthTitle", values);
    case "walkout":
      return t("ui.otomeForge.confrontation.walkoutTitle", values);
    case "opened":
      return t("ui.otomeForge.closer.openedTitle", values);
    case "shut":
      return t("ui.otomeForge.closer.shutTitle", values);
    default:
      return t("ui.otomeForge.arcs.sideMomentRepair", values);
  }
}

/**
 * #2155: his side of a big moment, waiting under his route (or being read): the arc it belongs to, the moment and its
 * chapter, and Read, which writes its chapter with no model call; its one call is its scene. It paints only a place
 * with no picture yet. While it opens, Read is busy and the cost line (a status) says so.
 */
function SideRow({
  entry,
  li,
  images,
  opening,
  onRead,
}: {
  entry: HisSideEntry;
  li: RunLiView;
  images: RunView["world"]["images"];
  opening: boolean;
  onRead: () => void;
}) {
  const { t } = useTranslation();
  const values = pronounValues(li);
  const title = entry.title || t("ui.otomeForge.story.untitled");
  const titleId = `of-side-${entry.key}`;
  return (
    <div className="of-route-side" role="group" aria-labelledby={titleId}>
      <p className="of-route-side-head">
        <Eye size={15} strokeWidth={2} aria-hidden="true" />
        <span id={titleId}>{t("ui.otomeForge.arcs.sideTitle", values)}</span>
        <span className="of-badge of-badge--soft">
          {entry.arc
            ? t("ui.otomeForge.story.arcHeading", { number: entry.arc })
            : t("ui.otomeForge.story.arcHeadingBefore")}
        </span>
      </p>
      <p className="of-route-side-line">
        {t("ui.otomeForge.arcs.sideMoment", { moment: sideMoment(t, entry, li), title })}
      </p>
      <div className="of-inline-actions">
        <button
          type="button"
          className="of-button of-button--primary"
          aria-label={t(entry.reading ? "ui.otomeForge.arcs.sideContinueLabel" : "ui.otomeForge.arcs.sideReadLabel", {
            ...values,
            title,
          })}
          aria-disabled={opening || undefined}
          aria-busy={opening || undefined}
          onClick={opening ? undefined : onRead}
        >
          <BookOpen size={16} strokeWidth={2} aria-hidden="true" />
          {entry.reading ? t("ui.otomeForge.story.continue") : t("ui.otomeForge.arcs.sideRead")}
        </button>
        {entry.reading ? null : (
          <>
            <p className="of-cost" role="status">
              <Feather size={14} strokeWidth={2} aria-hidden="true" />
              <span>{opening ? t("ui.otomeForge.arcs.planningSide", values) : t("ui.otomeForge.arcs.sideCost")}</span>
            </p>
            <ChapterPaintCost images={images} cost="ui.otomeForge.arcs.sidePaintCost" />
          </>
        )}
      </div>
    </div>
  );
}

/**
 * #2156: "I'm upset with them", beside each one's route at every stage. Pressing it asks first, then tells them (they
 * answer in Messages: 1 call); pressing it again takes it back at once. A toggle: its name stays, aria-pressed says it.
 */
function UpsetToggle({ runKey, li, upset }: { runKey: string; li: RunLiView; upset: boolean }) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [said, setSaid] = useState("");
  const values = pronounValues(li);
  const send = async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await otome.post(`${runPath(runKey)}/routes/${encodeURIComponent(li.id)}/upset`, { upset: next });
      setAsking(false);
      setSaid(t(next ? "ui.otomeForge.arcs.upsetTold" : "ui.otomeForge.arcs.upsetLetGo", values));
      await queryClient.invalidateQueries({ queryKey: storyQueryKey(runKey) });
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="of-route-upset">
      <button
        type="button"
        className="of-button of-button--quiet of-glass of-button--small of-upset-toggle"
        aria-pressed={upset}
        aria-disabled={busy}
        onClick={() => (upset ? void send(false) : setAsking(true))}
      >
        <HeartCrack size={14} strokeWidth={2} aria-hidden="true" />
        {t("ui.otomeForge.arcs.upsetButton", values)}
      </button>
      {upset ? <p className="of-hint">{t("ui.otomeForge.arcs.upsetOn", values)}</p> : null}
      <p className="of-visually-hidden" role="status">
        {said}
      </p>
      {error && !asking ? (
        <p className="of-error" role="alert">
          {otome.errorMessage(error)}
        </p>
      ) : null}
      {asking ? (
        <Dialog
          title={t("ui.otomeForge.arcs.upsetTitle", values)}
          onClose={busy ? undefined : () => setAsking(false)}
          actions={
            <>
              <button
                type="button"
                className="of-button of-button--primary"
                aria-disabled={busy}
                onClick={() => void send(true)}
              >
                {t("ui.otomeForge.arcs.upsetConfirm", values)}
              </button>
              <button
                type="button"
                className="of-button of-button--quiet of-glass"
                aria-disabled={busy}
                onClick={() => !busy && setAsking(false)}
              >
                {t("ui.otomeForge.reader.notNow")}
              </button>
            </>
          }
        >
          <p className="of-body">{t("ui.otomeForge.arcs.upsetText", values)}</p>
          <p className="of-cost">
            <Feather size={14} strokeWidth={2} aria-hidden="true" />
            <span>{t("ui.otomeForge.arcs.upsetCost", values)}</span>
          </p>
          {error ? (
            <p className="of-error" role="alert">
              {otome.errorMessage(error)}
            </p>
          ) : null}
        </Dialog>
      ) : null}
    </div>
  );
}

/**
 * A route or repair chapter, or an extra story, being planned (one model call, with Cancel); then it opens. A locked one
 * says why.
 */
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
      title={t(ARC_DIALOG_KEYS[target.kind].title, values)}
      // Opened while it plans: focus starts on Cancel, never on the quiz under it (#2174).
      initialFocus={planning ? actionRef : undefined}
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
        <>
          <div className="of-planning" role="status">
            <Heart className="of-pulse" size={28} strokeWidth={1.6} fill="currentColor" aria-hidden="true" />
            <p className="of-body">{t(ARC_DIALOG_KEYS[target.kind].planning, values)}</p>
            <p className="of-hint">{t("ui.otomeForge.story.planningHint")}</p>
          </div>
          <PersonalityQuiz runKey={view.runKey} lis={view.lis} />
        </>
      ) : locked ? (
        <p className="of-notice" role="alert">
          <Lock size={15} strokeWidth={2} aria-hidden="true" />
          <span>{t(ARC_DIALOG_KEYS[target.kind].locked, values)}</span>
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
