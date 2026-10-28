// ──────────────────────────────────────────────
// Otome Forge: the reader. The scene is a gradient by the beat's music mood (a painted place arrives in M2b), the love
// interest on stage changes face line by line, and the dialogue box sits in the bottom third. A tap, Enter, Space, →
// or PageDown goes on; choices take the Next button's place. Panels replace the box while a beat is written (with
// Cancel), when it was stopped or could not be written, before a dark chapter (its content tags), and at the chapter's
// end (what it earned). Ease off stays at the top for every node not yet finished, written or not.
// ──────────────────────────────────────────────
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { BookHeart, Eye, Feather, House, RotateCcw, Sparkle, Sparkles, X } from "lucide-react";
import { Avatar } from "../../components/Avatar";
import { DeclinedPanel } from "../../components/DeclinedPanel";
import { useReader, useReducedMotion, type ReaderState } from "../../hooks/use-reader";
import { accentOf } from "../../lib/accent";
import { canonOption, sumGrants, voiceOf, type Voice } from "../../lib/reader-state";
import { useOtomeProps } from "../../props";
import type { Grant, RunView } from "../../shared/api-types";
import { MUSIC_MOODS } from "../../shared/faces";
import { Backlog } from "./Backlog";
import { ChoicePills, RememberToast } from "./ChoicePills";
import { ContentTagsCard } from "./ContentTagsCard";
import { DialogueBox } from "./DialogueBox";
import { EaseOffDialog } from "./EaseOffDialog";
import { FACE_LABEL_KEYS, FacePlate, QuietCg } from "./FacePlate";
import { ReaderControls } from "./ReaderControls";

interface ReaderProps {
  runKey: string;
  chapterKey: string;
  view: RunView;
  /** Opens at this node instead of the first one not read to its end. */
  startNode?: number | null;
  onExit: () => void;
  onHome: () => void;
  /** Called once the last node is read, in place of the chapter's end card (a date shows its own ending, M5). */
  onFinished?: () => void;
}

const INTERACTIVE = "button, a, input, select, textarea, summary, [role='dialog']";
const ADVANCE_KEYS = new Set(["Enter", " ", "ArrowRight", "PageDown"]);

export function Reader({ runKey, chapterKey, view, startNode, onExit, onHome, onFinished }: ReaderProps) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const reader = useReader({ runKey, chapterKey, view, startNode, reducedMotion });
  const [hidden, setHidden] = useState(false);
  const [dialog, setDialog] = useState<"log" | "ease" | null>(null);
  // Each love interest's level when the chapter opened, so the end card can say which one rose.
  const [levelsBefore] = useState(() => new Map(view.lis.map((li) => [li.id, li.level])));
  const rootRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const choiceRef = useRef<HTMLButtonElement>(null);
  const showRef = useRef<HTMLButtonElement>(null);
  const focusInside = useRef(false);

  const chapter = reader.detail?.chapter ?? null;
  const { beat, current } = reader;
  const finishedRef = useRef(onFinished);
  finishedRef.current = onFinished;
  useEffect(() => {
    if (reader.finished) finishedRef.current?.();
  }, [reader.finished]);
  const protagonist = view.player.name;
  const voice = current ? voiceOf(current.segment, view.lis, protagonist) : null;
  const aftermath = current?.kind === "aftermath";
  const text = aftermath ? t("ui.otomeForge.reader.aftermath") : (current?.segment.text ?? "");
  const reading = !!current && !!beat && !reader.finished && !reader.askTags;
  const showUi = !hidden || !reading;
  const pending = reader.pendingChoice;

  // When the focused control leaves (Next gives way to the choices, a panel is replaced), focus lands on what took
  // its place, so a keyboard or screen reader never falls out of the story. Only while focus was in the reader.
  useEffect(() => {
    const root = rootRef.current;
    if (!focusInside.current || dialog || !root) return;
    const active = document.activeElement;
    if (active && active !== document.body && root.contains(active)) return;
    // One candidate at a time, in this order: a single selector list would take the first match in the document,
    // which is always the header's title.
    const target =
      (!showUi ? showRef.current : null) ??
      (pending ? choiceRef.current : null) ??
      nextRef.current ??
      root.querySelector<HTMLElement>("[data-autofocus]") ??
      root.querySelector<HTMLElement>(".of-reader-panel button") ??
      root.querySelector<HTMLElement>("h1");
    target?.focus({ preventScroll: true });
  });

  const advance = () => {
    if (!showUi) setHidden(false);
    else if (reading) reader.advance();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || dialog) return;
    if (event.key === "Escape" && !showUi) {
      event.preventDefault();
      setHidden(false);
      return;
    }
    const target = event.target as HTMLElement;
    // → and PageDown go on from the Next button too; Enter and Space keep its own click, so nothing advances twice.
    const fromNext = !!target.closest(".of-next") && (event.key === "ArrowRight" || event.key === "PageDown");
    if (!ADVANCE_KEYS.has(event.key) || (target.closest(INTERACTIVE) && !fromNext)) return;
    event.preventDefault();
    advance();
  };

  const openDialog = (next: "log" | "ease") => {
    reader.setAuto(false);
    setDialog(next);
  };

  const mood = beat?.musicMood ?? "tender";
  const lines = reader.timeline?.lines ?? [];
  const place = lines
    .slice(0, reader.lineIndex + 1)
    .reverse()
    .find((line) => line.segment.place)?.segment.place;
  const cg = beat?.cg && current && current.main >= beat.cg.at ? beat.cg : null;
  const firstChoice = pending && beat ? canonOption(beat, pending) : null;

  /** What the polite live region says for a new line: who, how he looks as he says it, and the line. */
  const announcement = (line: Voice): string => {
    if (line.kind === "narration") return text;
    if (line.kind === "protagonist") {
      return line.thought
        ? t("ui.otomeForge.reader.announceThought", { text })
        : t("ui.otomeForge.reader.announceLine", { name: protagonist, text });
    }
    if (line.kind === "other") return t("ui.otomeForge.reader.announceLine", { name: line.name, text });
    if (line.thought) return t("ui.otomeForge.reader.announceHisThought", { name: line.li.name, text });
    const { face, speaking } = reader.onStage;
    return face && speaking
      ? t("ui.otomeForge.reader.announceLineFace", { name: line.li.name, face: t(FACE_LABEL_KEYS[face]), text })
      : t("ui.otomeForge.reader.announceLine", { name: line.li.name, text });
  };

  return (
    <div
      ref={rootRef}
      className="of-reader"
      data-hidden={!showUi}
      onKeyDown={onKeyDown}
      onFocus={() => {
        focusInside.current = true;
      }}
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null;
        // A control that unmounts while focused leaves without a blur, or with its node already gone.
        if ((!next || !rootRef.current?.contains(next)) && (event.target as Node).isConnected)
          focusInside.current = false;
      }}
    >
      <div className="of-reader-scene" aria-hidden="true">
        {MUSIC_MOODS.map((name) => (
          <div key={name} className="of-mood" data-mood={name} data-on={name === mood} />
        ))}
        <div className="of-reader-motes" />
        <div className="of-reader-vignette" />
      </div>

      {showUi ? (
        <ReaderControls
          chapter={chapter}
          node={reader.node}
          nodeCount={reader.nodeCount}
          replay={!!reader.position?.replay && reading}
          place={reading ? place : undefined}
          tags={reader.tags}
          reading={reading}
          auto={reader.auto}
          onAuto={() => reader.setAuto(!reader.auto)}
          canSkip={reader.canSkip}
          onSkip={reader.skip}
          onLog={() => openDialog("log")}
          onHide={() => {
            reader.setAuto(false);
            setHidden(true);
          }}
          canRewrite={reader.canRewrite}
          onRewrite={() => void reader.rewrite()}
          canEaseOff={reader.canEaseOff}
          onEaseOff={() => openDialog("ease")}
          onExit={onExit}
        />
      ) : null}

      <div className="of-reader-stage" onClick={advance}>
        {cg ? (
          <QuietCg names={cg.cast} />
        ) : (
          <FacePlate li={reader.onStage.li} face={reader.onStage.face} speaking={reader.onStage.speaking} />
        )}
        <div className="of-toasts" aria-live="polite">
          {reader.toasts.map((toast) =>
            toast.kind === "remember" ? (
              <RememberToast key={toast.id} name={view.lis.find((li) => li.id === toast.li)?.name ?? null} />
            ) : (
              <p key={toast.id} className="of-toast of-toast--starlight">
                <Sparkle size={14} strokeWidth={1.6} fill="currentColor" aria-hidden="true" />
                {t("ui.otomeForge.reader.starlightEarned", { amount: toast.amount })}
              </p>
            ),
          )}
        </div>
      </div>

      <div className="of-reader-bottom">
        {!showUi ? (
          <button
            ref={showRef}
            type="button"
            className="of-icon-button of-glass of-reader-show"
            aria-label={t("ui.otomeForge.reader.show")}
            title={t("ui.otomeForge.reader.show")}
            onClick={() => setHidden(false)}
          >
            <Eye size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        ) : (
          <BottomPanel
            reader={reader}
            view={view}
            text={text}
            voice={voice}
            aftermath={aftermath}
            nextRef={nextRef}
            choiceRef={choiceRef}
            firstChoice={firstChoice}
            levelsBefore={levelsBefore}
            onExit={onExit}
            onHome={onHome}
            ownEnding={!!onFinished}
            onEaseOff={() => openDialog("ease")}
          />
        )}
      </div>

      <p className="of-visually-hidden" aria-live="polite">
        {reading && voice ? announcement(voice) : ""}
      </p>

      {dialog === "log" ? (
        <Backlog
          entries={reader.log}
          lis={view.lis}
          protagonist={protagonist}
          starred={reader.starred}
          onStar={reader.star}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === "ease" ? (
        <EaseOffDialog onEaseOff={reader.easeOff} onVeil={reader.veil} onClose={() => setDialog(null)} />
      ) : null}
    </div>
  );
}

interface BottomPanelProps {
  reader: ReaderState;
  view: RunView;
  text: string;
  voice: Voice | null;
  aftermath: boolean;
  nextRef: RefObject<HTMLButtonElement | null>;
  choiceRef: RefObject<HTMLButtonElement | null>;
  firstChoice: ReturnType<typeof canonOption>;
  levelsBefore: ReadonlyMap<string, number>;
  onExit: () => void;
  onHome: () => void;
  /** The screen that opened the reader shows the ending itself. */
  ownEnding: boolean;
  onEaseOff: () => void;
}

/** The bottom third: the dialogue box and its choices, or the panel that stands in for them. */
function BottomPanel(props: BottomPanelProps) {
  const { t } = useTranslation();
  const { reader, view } = props;
  const { load, current, beat } = reader;
  const chapter = reader.detail?.chapter ?? null;

  if (reader.chapterQuery.isError && !chapter) {
    return (
      <section className="of-reader-panel of-glass of-glass--strong" role="alert">
        <p className="of-body">{reader.chapterQuery.error ? t("ui.otomeForge.reader.chapterFailed") : ""}</p>
        <div className="of-inline-actions">
          <button type="button" className="of-button of-button--quiet of-glass of-button--small" onClick={props.onExit}>
            {t("ui.otomeForge.reader.toStory")}
          </button>
          <button
            type="button"
            className="of-button of-button--primary of-button--small"
            onClick={() => void reader.chapterQuery.refetch()}
          >
            <RotateCcw size={15} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.common.retry")}
          </button>
        </div>
      </section>
    );
  }
  if (reader.finished && chapter && props.ownEnding) return null;
  if (reader.finished && chapter) {
    return (
      <ChapterEnd
        title={chapter.title}
        grants={reader.chapterGrants}
        view={view}
        levelsBefore={props.levelsBefore}
        onStory={props.onExit}
        onHome={props.onHome}
      />
    );
  }
  if (reader.askTags) {
    return <ContentTagsCard tags={reader.tags} onBegin={reader.beginChapter} onLeave={props.onExit} />;
  }
  if (load?.status === "failed") {
    return (
      <DeclinedPanel error={load.error} run={view} job="narration" onRetry={reader.retry} onEaseOff={props.onEaseOff} />
    );
  }
  if (load?.status === "stopped") {
    return (
      <section className="of-reader-panel of-glass of-glass--strong" role="status">
        <p className="of-body">{t("ui.otomeForge.reader.stopped")}</p>
        <div className="of-inline-actions">
          <button
            type="button"
            className="of-button of-button--quiet of-glass of-button--small"
            onClick={props.onEaseOff}
          >
            <Feather size={15} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.reader.easeOff")}
          </button>
          <button
            type="button"
            className="of-button of-button--primary of-button--small"
            onClick={reader.retry}
            data-autofocus=""
          >
            <RotateCcw size={15} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.common.retry")}
          </button>
        </div>
      </section>
    );
  }
  if (!beat || !current || !props.voice || load?.status !== "ready") {
    const writing = load?.status === "loading" && load.writing;
    return (
      <section className="of-reader-panel of-writing of-glass of-glass--strong" role="status">
        <span className="of-quill" aria-hidden="true">
          <Feather size={22} strokeWidth={1.7} />
        </span>
        <p className="of-section-title">
          {writing ? t("ui.otomeForge.reader.writing") : t("ui.otomeForge.reader.opening")}
        </p>
        {writing ? <p className="of-hint">{t("ui.otomeForge.reader.writingHint")}</p> : null}
        {writing ? (
          <button
            type="button"
            className="of-button of-button--quiet of-glass of-button--small"
            onClick={() => void reader.cancel()}
          >
            <X size={15} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.reader.cancel")}
          </button>
        ) : null}
      </section>
    );
  }

  const pending = reader.pendingChoice;
  return (
    <>
      {reader.notice ? (
        <p className="of-notice of-notice--error of-reader-notice" role="alert">
          <span>{reader.notice}</span>
          <button
            type="button"
            className="of-button of-button--text of-button--small"
            onClick={(event) => {
              event.stopPropagation();
              reader.clearNotice();
            }}
          >
            {t("ui.otomeForge.reader.dismiss")}
          </button>
        </p>
      ) : null}
      {pending && reader.typed ? (
        <ChoicePills
          ref={props.choiceRef}
          choice={pending}
          firstChoice={props.firstChoice}
          busy={reader.choosing === pending.id}
          error={reader.choiceError}
          onChoose={(option) => void reader.choose(pending, option)}
        />
      ) : null}
      <div className="of-dialogue-wrap" onClick={reader.advance}>
        <DialogueBox
          ref={props.nextRef}
          voice={props.voice}
          protagonist={view.player.name}
          text={props.text}
          lineKey={reader.lineKey}
          instant={reader.instant}
          finishToken={reader.finishToken}
          onTyped={reader.markTyped}
          aftermath={props.aftermath}
          canAdvance={!(pending && reader.typed)}
          onAdvance={reader.advance}
        />
      </div>
    </>
  );
}

interface ChapterEndProps {
  title: string;
  grants: Grant[];
  view: RunView;
  levelsBefore: ReadonlyMap<string, number>;
  onStory: () => void;
  onHome: () => void;
}

/** The chapter's end: what it earned (Starlight, each love interest's affection, a level that rose). */
function ChapterEnd({ title, grants, view, levelsBefore, onStory, onHome }: ChapterEndProps) {
  const { t } = useTranslation();
  const { locale } = useOtomeProps().localization;
  const { starlight, affection } = sumGrants(grants);
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  return (
    <section className="of-reader-panel of-chapter-end of-glass of-glass--strong" aria-labelledby="of-chapter-end">
      <span className="of-chapter-end-mark" aria-hidden="true">
        <Sparkles size={22} strokeWidth={1.6} />
      </span>
      <h2 id="of-chapter-end" className="of-chapter-end-title" tabIndex={-1} data-autofocus="">
        {t("ui.otomeForge.reader.chapterDone")}
      </h2>
      {title ? <p className="of-subtitle">{title}</p> : null}
      {starlight || affection.length ? (
        <ul className="of-grants">
          {starlight ? (
            <li className="of-grant of-grant--starlight">
              <Sparkle size={16} strokeWidth={1.6} fill="currentColor" aria-hidden="true" />
              <span>{t("ui.otomeForge.reader.grantStarlight", { amount: number(starlight) })}</span>
            </li>
          ) : null}
          {affection.map(({ li: id, amount }) => {
            const li = view.lis.find((item) => item.id === id);
            if (!li) return null;
            const rose = li.level > (levelsBefore.get(li.id) ?? li.level);
            return (
              <li
                key={id}
                className="of-grant"
                style={{ "--of-li-accent": accentOf(li) } as CSSProperties}
                data-rose={rose}
              >
                <Avatar name={li.name} url={li.portrait} accent={accentOf(li)} size={30} />
                <span>{t("ui.otomeForge.reader.grantAffection", { name: li.name, amount: number(amount) })}</span>
                <span className="of-badge of-badge--soft">
                  {rose
                    ? t("ui.otomeForge.reader.levelUp", { level: li.level })
                    : t("ui.otomeForge.story.level", { level: li.level })}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="of-hint">{t("ui.otomeForge.reader.chapterDoneQuiet")}</p>
      )}
      <div className="of-inline-actions">
        <button type="button" className="of-button of-button--quiet of-glass of-button--small" onClick={onHome}>
          <House size={15} strokeWidth={2} aria-hidden="true" />
          {t("ui.otomeForge.common.screenHome")}
        </button>
        <button type="button" className="of-button of-button--primary of-button--small" onClick={onStory}>
          <BookHeart size={15} strokeWidth={2} aria-hidden="true" />
          {t("ui.otomeForge.reader.toStory")}
        </button>
      </div>
    </section>
  );
}
