// ──────────────────────────────────────────────
// Otome Forge: the reader. The scene is the painted place (or, without one, a gradient by the beat's music mood), the
// love interest on stage changes face line by line, and the dialogue box sits in the bottom third. A tap, Enter,
// Space, → or PageDown goes on; choices (in a Confrontation, the four stances) take the Next button's place. Panels
// replace the box while a beat is written (with Cancel), when it was stopped or could not be written, before a dark
// chapter (its content tags), at a Confrontation's ending (its card) and at the chapter's end (what it earned). Ease
// off stays at the top for every node not yet finished, written or not. A rupture that opens elsewhere holds a route
// chapter (its next scene, or its gate's end): the reader says with whom, and leads back to the story to make it right.
// M2b: a painted story CG takes over the stage when its line comes (components/CgTakeover.tsx); the beat's music cue
// plays and each spoken line is voiced (hooks/use-otome-audio.ts), and Auto waits for the voice. Everything works the
// same with no image, music or voice connection.
// ──────────────────────────────────────────────
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { useTranslation } from "react-i18next";
import { forgeStoryExpressionArt } from "@forge-kit/story-expressions.mjs";
import {
  BookHeart,
  Eye,
  Feather,
  HeartHandshake,
  House,
  Images,
  KeyRound,
  RotateCcw,
  Sparkle,
  Sparkles,
  VolumeX,
  X,
} from "lucide-react";
import { Avatar } from "../../components/Avatar";
import { CgTakeover } from "../../components/CgTakeover";
import { usePaintsByItself } from "../../components/CostHint";
import { DeclinedPanel } from "../../components/DeclinedPanel";
import { PromptReviewDialog } from "../../components/PromptReviewDialog";
import {
  OtomeAudioProvider,
  useAudioSnapshot,
  useMusicCue,
  useOtomeAudio,
  type SpeakOutcome,
} from "../../hooks/use-otome-audio";
import { useReader, useReducedMotion, type ReaderState } from "../../hooks/use-reader";
import { accentOf } from "../../lib/accent";
import { canonOption, readyUrl, sumGrants, voiceOf, type Voice } from "../../lib/reader-state";
import { useOtomeProps } from "../../props";
import type { Grant, RunView } from "../../shared/api-types";
import { FACES, MUSIC_MOODS, type MusicMood } from "../../shared/faces";
import { Backlog } from "./Backlog";
import { ChoicePills, RememberToast } from "./ChoicePills";
import { ConfrontationEnd, StancePills } from "./Confrontation";
import { ContentTagsCard } from "./ContentTagsCard";
import { DialogueBox } from "./DialogueBox";
import { EaseOffDialog } from "./EaseOffDialog";
import { FACE_LABEL_KEYS, FacePlate, QuietCg } from "./FacePlate";
import { ReaderControls } from "./ReaderControls";
import { SpeakerPlate, useSpeakerSprite } from "./SpeakerPlate";
import { stageNameKey } from "../story/StoryHome";

interface ReaderProps {
  runKey: string;
  chapterKey: string;
  view: RunView;
  /** Opens at this node instead of the first one not read to its end. */
  startNode?: number | null;
  onExit: () => void;
  /** The way out's label when it leads somewhere other than the Story screen (M4: Wish, the Wardrobe, the Album). */
  exitLabel?: string;
  onHome: () => void;
  /** Called once the last node is read, in place of the chapter's end card (a date shows its own ending, M5). */
  onFinished?: () => void;
}

const INTERACTIVE = "button, a, input, select, textarea, summary, [role='dialog']";
const ADVANCE_KEYS = new Set(["Enter", " ", "ArrowRight", "PageDown"]);

/** The reader, with the story's audio: OtomeForgeView's when it holds one, its own otherwise. */
export function Reader(props: ReaderProps) {
  return (
    <OtomeAudioProvider run={props.view}>
      <ReaderScene {...props} />
    </OtomeAudioProvider>
  );
}

const AUDIO_NOTICE_KEYS = {
  musicFailed: "ui.otomeForge.audio.musicFailed",
  chapterMusicFailed: "ui.otomeForge.audio.chapterMusicFailed",
  chapterMusicUnavailable: "ui.otomeForge.audio.chapterMusicUnavailable",
  musicFolderUnavailable: "ui.otomeForge.audio.musicFolderUnavailable",
  voiceFailed: "ui.otomeForge.audio.voiceFailed",
} as const;

function ReaderScene({ runKey, chapterKey, view, startNode, onExit, exitLabel, onHome, onFinished }: ReaderProps) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const audio = useOtomeAudio();
  const { notice: audioNotice, speaking } = useAudioSnapshot();
  // The current line's voice: `outcome` null while it is still to come or playing (Auto waits for it).
  const [voiceState, setVoiceState] = useState<{ key: string; outcome: SpeakOutcome | null }>({
    key: "",
    outcome: null,
  });
  // Auto waits while a story CG's pan plays (set below, once the CG is known; a render behind is soon enough).
  const [panning, setPanning] = useState(false);
  const reader = useReader({ runKey, chapterKey, view, startNode, reducedMotion, voice: voiceState, hold: panning });
  const [hidden, setHidden] = useState(false);
  // Story CGs whose pan has played in this visit (`${chapterKey}/${node}r${rewrites}`).
  const [cgShown, setCgShown] = useState<ReadonlySet<string>>(() => new Set());
  // Art that failed to load, by URL (sprites, the place, the key image): its description stands in for it.
  const [failedArt, setFailedArt] = useState<ReadonlySet<string>>(() => new Set());
  const artStatus = useCallback(
    (url: string, loaded: boolean) =>
      setFailedArt((failed) => {
        if (loaded ? !failed.has(url) : failed.has(url)) return failed;
        const next = new Set(failed);
        if (loaded) next.delete(url);
        else next.add(url);
        return next;
      }),
    [],
  );
  // The last beat's music, kept while the next beat opens; none until the first beat is ready.
  const lastMood = useRef<MusicMood | undefined>(undefined);
  const [dialog, setDialog] = useState<"log" | "ease" | null>(null);
  // Each love interest's level when the chapter opened, so the end card can say which one rose.
  const [levelsBefore] = useState(() => new Map(view.lis.map((li) => [li.id, li.level])));
  const rootRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const choiceRef = useRef<HTMLButtonElement>(null);
  const showRef = useRef<HTMLButtonElement>(null);
  const cgRef = useRef<HTMLElement>(null);
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
  // its place, so a keyboard or screen reader never falls out of the story. Only while focus was in the reader. A CG's
  // pan holds focus on the picture while the faded UI is inert, then hands it back to the story.
  useEffect(() => {
    const root = rootRef.current;
    if (!focusInside.current || dialog || !root) return;
    const active = document.activeElement;
    // Focus stays on a control in the reader, unless that control is faded (inert) or is the CG once its pan ended.
    const stays =
      !!active &&
      active !== document.body &&
      root.contains(active) &&
      !active.closest("[inert]") &&
      (cgIntro || active !== cgRef.current);
    if (stays) return;
    // One candidate at a time, in this order: a single selector list would take the first match in the document,
    // which is always the header's title.
    const target =
      (cgIntro ? cgRef.current : null) ??
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
    else if (cgIntro) endCgIntro();
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

  // The scene keeps the last beat's music while the next one is opened or written; before the first one, whatever was
  // playing (Home's cue) plays on, and a mood the player never hears is never generated.
  if (beat?.musicMood && !reader.preparingBackground) lastMood.current = beat.musicMood;
  const mood = (!reader.preparingBackground && beat?.musicMood) || lastMood.current;
  useMusicCue(
    chapter && mood && view.world.audio.generate && view.world.audio.chapterThemes
      ? { chapterKey: chapter.key, mood, track: chapter.music?.track }
      : mood,
  );
  // The target place stays mounted while its image decodes, before any of its lines are exposed.
  const { place, placeInfo, placeUrl } = reader;
  const canPaint = !!view.world.images.connectionId;
  const paintsByItself = usePaintsByItself(view.world.images);
  const placeState = placeInfo?.art?.state;
  const placePaint =
    canPaint &&
    placeInfo?.tags.trim() &&
    place &&
    (!placeState || placeState === "waiting-consent" || placeState === "failed" || placeState === "stopped")
      ? {
          retry: placeState === "failed" || placeState === "stopped",
          busy: reader.painting,
          onPaint: () => void reader.paintPlace(place),
        }
      : undefined;
  const cg = reader.cg && current && current.main >= reader.cg.at ? reader.cg : null;
  const cgUrl = readyUrl(cg?.art);
  const cgId = `${chapterKey}/${reader.node ?? 0}r${beat?.rewrites ?? 0}`;
  // The pan plays once per version of a beat in this visit, the first time its line comes.
  const cgIntro = !!cgUrl && reading && !cgShown.has(cgId);
  if (panning !== cgIntro) setPanning(cgIntro);
  const endCgIntro = () => {
    if (!cgIntro) return;
    setCgShown((shown) => new Set(shown).add(cgId));
    void reader.markCgSeen();
  };
  const firstChoice = pending && beat ? canonOption(beat, pending) : null;
  // Whom a Confrontation faces: the opponent the server set (not whoever spoke last), else the chapter's own.
  const facingId = reader.confrontation?.li ?? chapter?.li ?? chapter?.lead;
  const facing = view.lis.find((li) => li.id === facingId) ?? null;
  // Phone stickers may use uncut originals. The stage accepts only faces authorized by the run's cutout metadata.
  const stageLi = reader.onStage.li;
  const onStageLi = stageLi
    ? {
        ...stageLi,
        expressions: Object.fromEntries(
          Object.entries(stageLi.expressions ?? {}).filter(([, url]) => !!url && stageLi.cut?.includes(url)),
        ),
      }
    : null;
  const otherSpeaker = voice?.kind === "other" && !voice.thought ? voice.name : null;
  const speaker = useSpeakerSprite(cg ? null : otherSpeaker, reader.lineKey);
  const stageArt = forgeStoryExpressionArt(
    { art: onStageLi?.worn?.url ?? onStageLi?.portrait ?? "", expressions: onStageLi?.expressions ?? {} },
    { expression: reader.onStage.face },
    FACES,
  ).art;
  const usesCharacterSprite = !cg && (otherSpeaker ? !!speaker.url : !!stageArt && !failedArt.has(stageArt));
  const placeOnScreen = !!placeUrl && !failedArt.has(placeUrl);
  const cgOnScreen = !!cgUrl && !failedArt.has(cgUrl);

  // Each new line is voiced when the settings voice its speaker; leaving the line stops it. Narration, thoughts and
  // the aftermath line never are.
  const voiceable = !!audio && reading && !aftermath && !!current && audio.wouldSpeak(current.segment);
  const voicedKey = voiceable ? reader.lineKey : "";
  const currentRef = reader.currentRef;
  const segment = current?.segment ?? null;
  useEffect(() => {
    if (!audio || !voicedKey || !segment) return;
    let live = true;
    setVoiceState({ key: voicedKey, outcome: null });
    void audio.speak(segment, currentRef).then((outcome) => {
      if (live) setVoiceState({ key: voicedKey, outcome });
    });
    return () => {
      live = false;
      audio.stopVoice();
    };
    // Once per line: the segment and ref belong to the line key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio, voicedKey]);

  // Music or a voice that could not play says so once per kind in this visit, and the scene goes on. The story's audio
  // outlives the reader, so a notice it already held when this visit began (Home's music, an earlier chapter's voice)
  // is not this visit's news.
  const noticeId = audioNotice?.id ?? 0;
  const [noticesFrom] = useState(noticeId);
  const noticed = useRef(new Set<string>());
  const notify = reader.notify;
  useEffect(() => {
    if (!audioNotice || noticeId <= noticesFrom || noticed.current.has(audioNotice.kind)) return;
    noticed.current.add(audioNotice.kind);
    notify({ kind: "audio", text: t(AUDIO_NOTICE_KEYS[audioNotice.kind]) });
    // Once per notice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noticeId]);

  /** What the polite live region says for a new line: who, how he looks as he says it, and the line. */
  const announcement = (line: Voice): string => {
    if (cgIntro) {
      return cg?.cast.length
        ? t("ui.otomeForge.reader.cgLabel", { names: cg.cast.join(", ") })
        : t("ui.otomeForge.reader.cgLabelPlain");
    }
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
      // A click on the stage or the dialogue box focuses the reader itself, so the keys go on working after it.
      tabIndex={-1}
      data-hidden={!showUi}
      data-cg={cgUrl ? (cgIntro ? "intro" : "shown") : undefined}
      data-picture={!!(cgUrl || placeUrl)}
      onKeyDown={onKeyDown}
      onFocus={() => {
        focusInside.current = true;
      }}
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null;
        const left = event.target as Element;
        // A control that unmounts while focused leaves without a blur, or with its node already gone; one the CG's pan
        // made inert loses focus to it, not to the page.
        if ((!next || !rootRef.current?.contains(next)) && left.isConnected && !left.closest("[inert]"))
          focusInside.current = false;
      }}
    >
      <div className="of-reader-scene" aria-hidden="true">
        {MUSIC_MOODS.map((name) => (
          <div key={name} className="of-mood" data-mood={name} data-on={name === (mood ?? "tender")} />
        ))}
        <PlaceBackdrop
          id={reader.backgroundKey}
          url={placeUrl}
          onSettled={reader.backgroundSettled}
          onArtStatus={artStatus}
        />
        <div className="of-reader-motes" />
        <div className="of-reader-vignette" />
      </div>
      {cgUrl && cg ? (
        <CgTakeover
          key={cgId}
          ref={cgRef}
          url={cgUrl}
          names={cg.cast}
          intro={cgIntro}
          reducedMotion={reducedMotion}
          onIntroEnd={endCgIntro}
          onArtStatus={artStatus}
        />
      ) : null}

      {showUi ? (
        <ReaderControls
          chapter={chapter}
          node={reader.node}
          nodeCount={reader.nodeCount}
          replay={!!reader.position?.replay && reading}
          place={reading ? place : undefined}
          imageDescription={
            // It stands in for a picture that isn't there: the place's tags without a background on screen (a key image
            // on screen covers it too), a key image's brief until its picture shows. Art that failed to load is none.
            reading && !usesCharacterSprite
              ? [!placeOnScreen && !cgOnScreen ? placeInfo?.tags : "", cg && !cgOnScreen ? cg.brief : ""]
                  .filter(Boolean)
                  .join("\n")
              : undefined
          }
          placePaint={placePaint}
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
          rewritePaints={paintsByItself}
          onRewrite={() => void reader.rewrite()}
          canEaseOff={reader.canEaseOff}
          onEaseOff={() => openDialog("ease")}
          onExit={onExit}
          inert={cgIntro}
        />
      ) : null}

      <div className="of-reader-stage" onClick={advance}>
        {cgUrl ? null : cg ? (
          <QuietCg
            names={cg.cast}
            state={cg.art?.state}
            busy={reader.painting}
            onPaint={canPaint ? () => void reader.paintCg() : undefined}
          />
        ) : otherSpeaker ? (
          <SpeakerPlate key={reader.lineKey} name={otherSpeaker} url={speaker.url} onError={speaker.onError} />
        ) : (
          <FacePlate
            li={onStageLi}
            face={reader.onStage.face}
            speaking={reader.onStage.speaking}
            onArtStatus={artStatus}
          />
        )}
        <div className="of-toasts" aria-live="polite">
          {reader.toasts.map((toast) =>
            toast.kind === "remember" ? (
              <RememberToast key={toast.id} name={view.lis.find((li) => li.id === toast.li)?.name ?? null} />
            ) : toast.kind === "cg" ? (
              <p key={toast.id} className="of-toast of-toast--cg">
                <Images size={15} strokeWidth={1.8} aria-hidden="true" />
                <span>
                  {t("ui.otomeForge.reader.cgNew")}
                  <span className="of-toast-note"> · {t("ui.otomeForge.reader.cgNewNote")}</span>
                </span>
              </p>
            ) : toast.kind === "audio" ? (
              <p key={toast.id} className="of-toast of-toast--audio">
                <VolumeX size={14} strokeWidth={2} aria-hidden="true" />
                {toast.text}
              </p>
            ) : (
              <p key={toast.id} className="of-toast of-toast--starlight">
                <Sparkle size={14} strokeWidth={1.6} fill="currentColor" aria-hidden="true" />
                {t("ui.otomeForge.reader.starlightEarned", { amount: toast.amount })}
              </p>
            ),
          )}
        </div>
      </div>

      <div className="of-reader-bottom" inert={cgIntro}>
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
            facing={facing}
            onAdvance={advance}
            onExit={onExit}
            exitLabel={exitLabel}
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
          voice={
            audio
              ? {
                  can: (entry) => entry.line.kind !== "aftermath" && audio.wouldSpeak(entry.line.segment),
                  play: (entry) => audio.speak(entry.line.segment, entry.ref),
                  stop: () => audio.stopVoice(),
                  speaking,
                }
              : undefined
          }
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === "ease" ? (
        <EaseOffDialog onEaseOff={reader.easeOff} onVeil={reader.veil} onClose={() => setDialog(null)} />
      ) : null}
      {reader.review ? (
        <PromptReviewDialog
          subject={
            reader.review.target.kind === "place" ? reader.review.target.place : t("ui.otomeForge.reader.cgQuiet")
          }
          initial={reader.review.initial}
          busy={reader.review.busy}
          error={reader.review.error}
          onSend={reader.sendReview}
          onSkip={reader.skipReview}
        />
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
  /** The love interest a Confrontation faces (its opponent, as the server set it). */
  facing: RunView["lis"][number] | null;
  /** Goes on (ends a CG's pan first). */
  onAdvance: () => void;
  onExit: () => void;
  exitLabel?: string;
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
  const heldBy = view.lis.find((li) => li.id === reader.heldBy) ?? null;
  const holdText = heldBy ? t("ui.otomeForge.reader.ruptureHold", { name: heldBy.name }) : "";

  if (reader.chapterQuery.isError && !chapter) {
    return (
      <section className="of-reader-panel of-glass of-glass--strong" role="alert">
        <p className="of-body">{reader.chapterQuery.error ? t("ui.otomeForge.reader.chapterFailed") : ""}</p>
        <div className="of-inline-actions">
          <button type="button" className="of-button of-button--quiet of-glass of-button--small" onClick={props.onExit}>
            {props.exitLabel ?? t("ui.otomeForge.reader.toStory")}
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
        prologue={chapter.kind === "prologue"}
        grants={reader.chapterGrants}
        arcNews={reader.arcNews}
        view={view}
        levelsBefore={props.levelsBefore}
        onStory={props.onExit}
        storyLabel={props.exitLabel}
        onHome={props.onHome}
      />
    );
  }
  if (reader.askTags) {
    return <ContentTagsCard tags={reader.tags} onBegin={reader.beginChapter} onLeave={props.onExit} />;
  }
  if (reader.showOutcome && reader.outcomeKind) {
    return <ConfrontationEnd outcome={reader.outcomeKind} li={props.facing} onGoOn={props.onAdvance} />;
  }
  // A scene that never opened (it failed, or was stopped) and is held by a rupture: its only way on is the story.
  if (heldBy && (load?.status === "failed" || load?.status === "stopped")) {
    return (
      <section className="of-reader-panel of-glass of-glass--strong" role="alert">
        <p className="of-body">{holdText}</p>
        <div className="of-inline-actions">
          <button
            type="button"
            className="of-button of-button--primary of-button--small"
            onClick={props.onExit}
            data-autofocus=""
          >
            <BookHeart size={15} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.reader.toStory")}
          </button>
        </div>
      </section>
    );
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
  if (reader.preparingBackground) {
    return (
      <section className="of-reader-panel of-writing of-glass of-glass--strong" role="status">
        <span className="of-quill" aria-hidden="true">
          <Images size={22} strokeWidth={1.7} />
        </span>
        <p className="of-section-title">{t("ui.otomeForge.reader.preparingBackground")}</p>
        <button
          type="button"
          className="of-button of-button--quiet of-glass of-button--small"
          onClick={reader.continueWithoutBackground}
          data-autofocus=""
        >
          {t("ui.otomeForge.reader.continueWithoutBackground")}
        </button>
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
      {heldBy || reader.notice ? (
        <p className="of-notice of-notice--error of-reader-notice" role="alert">
          <span>{heldBy ? holdText : reader.notice}</span>
          {/* A rupture's hold stays until the scene can go on: its one way on is the story, to make it right. */}
          <button
            type="button"
            className="of-button of-button--text of-button--small"
            onClick={(event) => {
              event.stopPropagation();
              if (heldBy) props.onExit();
              else reader.clearNotice();
            }}
          >
            {heldBy ? t("ui.otomeForge.reader.toStory") : t("ui.otomeForge.reader.dismiss")}
          </button>
        </p>
      ) : null}
      {pending && reader.typed && reader.confrontation ? (
        <StancePills
          ref={props.choiceRef}
          choice={pending}
          li={props.facing}
          busy={reader.choosing === pending.id}
          error={reader.choiceError}
          onChoose={(option) => void reader.choose(pending, option)}
        />
      ) : pending && reader.typed ? (
        <ChoicePills
          ref={props.choiceRef}
          choice={pending}
          firstChoice={props.firstChoice}
          busy={reader.choosing === pending.id}
          error={reader.choiceError}
          onChoose={(option) => void reader.choose(pending, option)}
        />
      ) : null}
      <div className="of-dialogue-wrap" onClick={props.onAdvance}>
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
          onAdvance={props.onAdvance}
        />
      </div>
    </>
  );
}

interface ChapterEndProps {
  title: string;
  /** The prologue ends as itself, not as a chapter. */
  prologue?: boolean;
  grants: Grant[];
  arcNews: ReaderState["arcNews"];
  view: RunView;
  levelsBefore: ReadonlyMap<string, number>;
  onStory: () => void;
  storyLabel?: string;
  onHome: () => void;
}

/** The chapter's end: what it earned (Starlight, each love interest's affection, a level that rose). */
function ChapterEnd({
  title,
  prologue = false,
  grants,
  arcNews,
  view,
  levelsBefore,
  onStory,
  storyLabel,
  onHome,
}: ChapterEndProps) {
  const { t } = useTranslation();
  const { locale } = useOtomeProps().localization;
  const { starlight, affection } = sumGrants(grants);
  const raised = arcNews.stageUp ? view.lis.find((li) => li.id === arcNews.stageUp?.li) : undefined;
  const mended = arcNews.repaired ? view.lis.find((li) => li.id === arcNews.repaired) : undefined;
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  return (
    <section className="of-reader-panel of-chapter-end of-glass of-glass--strong" aria-labelledby="of-chapter-end">
      <span className="of-chapter-end-mark" aria-hidden="true">
        <Sparkles size={22} strokeWidth={1.6} />
      </span>
      <h2 id="of-chapter-end" className="of-chapter-end-title" tabIndex={-1} data-autofocus="">
        {prologue ? t("ui.otomeForge.reader.prologueDone") : t("ui.otomeForge.reader.chapterDone")}
      </h2>
      {title ? <p className="of-subtitle">{title}</p> : null}
      {raised && arcNews.stageUp ? (
        <p className="of-arc-news" style={{ "--of-li-accent": accentOf(raised) } as CSSProperties}>
          <KeyRound size={16} strokeWidth={2} aria-hidden="true" />
          <span>
            {t("ui.otomeForge.arcs.stageUp", {
              name: raised.name,
              stage: arcNews.stageUp.stage,
              stageName: t(stageNameKey(arcNews.stageUp.stage)),
            })}
          </span>
        </p>
      ) : null}
      {mended ? (
        <p className="of-arc-news" style={{ "--of-li-accent": accentOf(mended) } as CSSProperties}>
          <HeartHandshake size={16} strokeWidth={2} aria-hidden="true" />
          <span>{t("ui.otomeForge.arcs.repaired", { name: mended.name })}</span>
        </p>
      ) : null}
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
        <p className="of-hint">
          {prologue ? t("ui.otomeForge.reader.prologueDoneQuiet") : t("ui.otomeForge.reader.chapterDoneQuiet")}
        </p>
      )}
      <div className="of-inline-actions">
        <button type="button" className="of-button of-button--quiet of-glass of-button--small" onClick={onHome}>
          <House size={15} strokeWidth={2} aria-hidden="true" />
          {t("ui.otomeForge.common.screenHome")}
        </button>
        <button type="button" className="of-button of-button--primary of-button--small" onClick={onStory}>
          <BookHeart size={15} strokeWidth={2} aria-hidden="true" />
          {storyLabel ?? t("ui.otomeForge.reader.toStory")}
        </button>
      </div>
    </section>
  );
}

/** The painted place behind the scene: a new picture decodes, then crossfades over the last one. */
function PlaceBackdrop({
  id,
  url,
  onSettled,
  onArtStatus,
}: {
  id: string;
  url: string | null;
  onSettled: (id: string, url: string) => void;
  /** Whether the picture decoded (the reader shows the place's description in place of one that failed). */
  onArtStatus: (url: string, loaded: boolean) => void;
}) {
  const [layers, setLayers] = useState<{ a: string; b: string; front: "a" | "b" | null }>({
    a: "",
    b: "",
    front: null,
  });
  useEffect(() => {
    if (!url) {
      setLayers((current) => (current.front ? { ...current, front: null } : current));
      return;
    }
    let live = true;
    const image = new Image();
    image.src = url;
    image
      .decode()
      .then(() => {
        if (!live) return;
        onArtStatus(url, true);
        setLayers((current) => {
          if (current.front && current[current.front] === url) return current;
          const back = current.front === "a" ? "b" : "a";
          return { ...current, [back]: url, front: back };
        });
      })
      .catch(() => {
        if (!live) return;
        onArtStatus(url, false);
        setLayers((current) => (current.front ? { ...current, front: null } : current));
      })
      .finally(() => {
        if (live) onSettled(id, url);
      });
    return () => {
      live = false;
    };
  }, [id, onArtStatus, onSettled, url]);
  return (
    <>
      {(["a", "b"] as const).map((layer) =>
        layers[layer] ? (
          <div
            key={layer}
            className="of-place"
            data-on={layers.front === layer}
            style={{ backgroundImage: `url(${JSON.stringify(layers[layer])})` }}
          />
        ) : null,
      )}
    </>
  );
}
