// ──────────────────────────────────────────────
// Otome Forge: the story's queries (GET /story, GET /chapters/:key) and the reader's state. The reader asks for one
// beat at a time (POST .../beats/:i writes it if it is missing; the server then writes the next one ahead), plays it
// line by line, saves first-play choices, tells the server how far it was read (Starlight and affection come back),
// and handles Ease off, Rewrite beat and Cancel. A Confrontation node (M2b) is played as a beat whose choices are the
// four stances (lib/reader-state.ts confrontationBeat): each stance is sent once, and the server reveals the next round
// or, after the third, the ending, which closes on its own card. A key image is marked seen once it has been shown,
// after the server has heard the read reached it; a paint that waits for consent is painted on a tap.
// ──────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { otomeErrorCode, useOtomeApi } from "../api";
import type { ImagePrompt } from "../components/PromptReviewDialog";
import {
  autoDelay,
  buildTimeline,
  canonOption,
  confrontationBeat,
  initialPicks,
  lineRef,
  onStageAt,
  openingLine,
  openingNode,
  placeEntry,
  readerBeat,
  readyUrl,
  ruptureHold,
  skipTarget,
  speakerLi,
  worldPlaces,
  type BeatResponse,
  type Picks,
  type ReaderLine,
} from "../lib/reader-state";
import type {
  BeatView,
  ChapterDetail,
  ChoiceOption,
  ClimaxEnding,
  ConfrontationView,
  Favorite,
  ForgeChoice,
  Grant,
  LiId,
  Paint,
  ReadResult,
  RunView,
  SceneArt,
  StanceResult,
  StoryView,
  WorldView,
} from "../shared/api-types";
import { useOtomeProps } from "../props";
import { LIMIT_IDS, type LimitId } from "../shared/content";
import { placeKey } from "../shared/places";
import type { SpeakOutcome } from "./use-otome-audio";
import { patchRun, runQueryKey } from "./use-run";

export const storyQueryKey = (runKey: string) => ["otome-forge", "story", runKey] as const;
export const chapterQueryKey = (runKey: string, key: string) => ["otome-forge", "chapter", runKey, key] as const;

export const runPath = (runKey: string) => `/runs/${encodeURIComponent(runKey)}`;

/** GET /runs/:run/story: the chapters so far, and the next main chapter's two Lead candidates. */
export function useStory(runKey: string) {
  const otome = useOtomeApi();
  return useQuery({
    queryKey: storyQueryKey(runKey),
    queryFn: () => otome.get<StoryView>(`${runPath(runKey)}/story`),
  });
}

/** GET /runs/:run/chapters/:key: the plan as the client sees it, and each node's beat state. */
export function useChapter(runKey: string, key: string | null) {
  const otome = useOtomeApi();
  return useQuery({
    queryKey: chapterQueryKey(runKey, key ?? ""),
    enabled: !!key,
    queryFn: () => otome.get<ChapterDetail>(`${runPath(runKey)}/chapters/${encodeURIComponent(key ?? "")}`),
  });
}

/** Stops the run's story writing (a chapter plan or a beat). The write that was waiting rejects. */
export async function cancelStoryWork(post: ReturnType<typeof useOtomeApi>["post"], runKey: string) {
  try {
    await post<{ ok: boolean }>(`${runPath(runKey)}/cancel`);
  } catch (error) {
    console.warn("Otome Forge could not cancel the story's writing", error);
  }
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** True while the system asks for reduced motion: lines then appear whole instead of typing themselves out. */
export function useReducedMotion(): boolean {
  const query = () => {
    try {
      return typeof window.matchMedia === "function" ? window.matchMedia(REDUCED_MOTION) : null;
    } catch {
      return null;
    }
  };
  const [reduced, setReduced] = useState(() => query()?.matches ?? false);
  useEffect(() => {
    const media = query();
    if (!media) return;
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

export type BeatLoad =
  /** `writing`: the beat is being written (a model call), not just opened. */
  | { status: "loading"; node: number; writing: boolean }
  /** A Confrontation keeps its view beside the beat made from it. */
  | { status: "ready"; node: number; beat: BeatView; confrontation?: ConfrontationView }
  | { status: "failed"; node: number; error: unknown }
  | { status: "stopped"; node: number };

interface Position {
  /** `${node}:${rewrites}`: a new beat, or a rewrite, opens a new read. */
  id: string;
  /** Every node of the beat was read before: choices made then change nothing now. */
  replay: boolean;
  picks: Picks;
  line: number;
  /** The furthest mainline segment an earlier read reached (skip-read starts there). */
  readThrough: number;
  /** The furthest mainline segment the server has been told about. */
  reported: number;
  /** The server was told this read reached the beat's end. */
  ended: boolean;
}

type ToastInput =
  | { kind: "remember"; li: LiId | null }
  | { kind: "starlight"; amount: number }
  /** A key image unlocked in the Album. */
  | { kind: "cg" }
  /** Music or a voice could not play (the scene goes on without it). */
  | { kind: "audio"; text: string };
export type ReaderToast = ToastInput & { id: number };

export interface LogEntry {
  key: string;
  /**
   * The favourite's ref, one per line of each version of a beat: `${chapterKey}/${beatIndex}r${rewrites}/${segment}`,
   * then `:${optionId}+n` for a picked option's lines after its segment (its selection is +0), or `+aftermath`.
   */
  ref: string;
  line: ReaderLine;
}

const TOAST_MS = 3_200;
/** How often, and how long, a key image being painted is looked for again (3 minutes). */
const PAINT_POLL_MS = 5_000;
const PAINT_POLL_TRIES = 36;
/** Auto's pause after a voiced line ends. */
const AFTER_VOICE_MS = 900;

/** What a tap paints: a key image is held by its chapter and node, as the reader may move on before it is sent. */
type PaintTarget = { kind: "cg"; key: string; i: number } | { kind: "place"; place: string };

/** A paint whose prompt is shown for editing before it is sent. */
export interface PaintReview {
  target: PaintTarget;
  initial: ImagePrompt;
  busy: boolean;
  error: string | null;
}

const isLimitId = (tag: string): tag is LimitId => (LIMIT_IDS as readonly string[]).includes(tag);

function openPosition(beat: BeatView, node: number, replay: boolean, protagonist: string): Position {
  const picks = initialPicks(beat, replay);
  const timeline = buildTimeline(beat, picks, protagonist);
  return {
    id: `${node}:${beat.rewrites}`,
    replay,
    picks,
    line: openingLine(timeline, beat.readThrough, replay),
    readThrough: beat.readThrough,
    reported: beat.readThrough,
    ended: replay,
  };
}

interface ReaderOptions {
  runKey: string;
  chapterKey: string;
  view: RunView;
  /** Opens at this node; otherwise at the first node not read to its end. */
  startNode?: number | null;
  reducedMotion: boolean;
  /**
   * The voice of the line `key` (the reader's lineKey): `outcome` null while it is still to come or playing, so Auto
   * waits for it, then goes on soon after a spoken line ends.
   */
  voice?: { key: string; outcome: SpeakOutcome | null };
  /** Auto waits while this holds (a story CG's pan). */
  hold?: boolean;
}

export function useReader({ runKey, chapterKey, view, startNode, reducedMotion, voice, hold }: ReaderOptions) {
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const chapterQuery = useChapter(runKey, chapterKey);
  const detail = chapterQuery.data ?? null;
  const base = `${runPath(runKey)}/chapters/${encodeURIComponent(chapterKey)}`;
  const protagonist = view.player.name;
  const { reviewImagePromptsBeforeSend } = useOtomeProps();

  const [node, setNode] = useState<number | null>(startNode ?? null);
  const [tagsSeen, setTagsSeen] = useState(false);
  const [load, setLoad] = useState<BeatLoad | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [typedKey, setTypedKey] = useState<string | null>(null);
  const [instantKey, setInstantKey] = useState<string | null>(null);
  const [finishToken, setFinishToken] = useState(0);
  const [auto, setAuto] = useState(false);
  const [finished, setFinished] = useState(false);
  const [chapterGrants, setChapterGrants] = useState<Grant[]>([]);
  /** What this read changed in the arcs: a stage a route chapter's gate opened, a rupture a repair closed. */
  const [arcNews, setArcNews] = useState<{ stageUp?: { li: LiId; stage: number }; repaired?: LiId }>({});
  const [toasts, setToasts] = useState<ReaderToast[]>([]);
  const [choosing, setChoosing] = useState<string | null>(null);
  const [choiceError, setChoiceError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /**
   * The love interest whose rupture (opened elsewhere) made the server refuse this route chapter's scene: its gate's
   * end, a Rewrite or an Ease off (holdFor).
   */
  const [held, setHeld] = useState<LiId | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [starred, setStarred] = useState<ReadonlySet<string>>(() => new Set());
  /** The read (position id) whose Confrontation ending card is showing. */
  const [outcomeFor, setOutcomeFor] = useState<string | null>(null);
  const [painting, setPainting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const rewriteFrom = useRef<BeatLoad | null>(null);
  const toastId = useRef(0);
  /** The backlog's place in the read on screen (position id): the next line index it logs. */
  const logged = useRef<{ id: string; next: number }>({ id: "", next: 0 });

  // Opens where the chapter stands: its first node not read to the end.
  if (node === null && detail) setNode(openingNode(detail.beats));

  const tags = detail?.chapter.tags ?? [];
  // Dark chapters open with their content tags; the first beat waits until the player begins.
  const askTags = tags.length > 0 && node === 0 && !tagsSeen;
  const nodeCount = detail?.chapter.nodes.length ?? 0;
  const ready = load?.status === "ready" && load.node === node ? load : null;
  const beat = ready?.beat ?? null;
  const confrontation = ready?.confrontation ?? null;

  const timeline = useMemo(
    () => (beat && position ? buildTimeline(beat, position.picks, protagonist) : null),
    [beat, position, protagonist],
  );
  const lineIndex = timeline && position ? Math.min(position.line, timeline.lines.length - 1) : -1;
  const refBase = `${chapterKey}/${node ?? 0}r${beat?.rewrites ?? 0}`;
  const images = view.world.images;
  const sceneId = beat && node !== null ? `${runKey}:${refBase}` : "";
  const [scene, setScene] = useState<{ id: string; art: SceneArt } | null>(null);
  const [sceneTick, setSceneTick] = useState(0);
  const [sceneUnavailable, setSceneUnavailable] = useState<string | null>(null);
  const sceneArt = scene && scene.id === sceneId ? scene.art : null;
  const place = timeline?.lines
    .slice(0, lineIndex + 1)
    .reverse()
    .find((line) => line.segment.place)?.segment.place;
  const scenePlace = placeEntry(sceneArt?.places, place);
  const worldPlace = placeEntry(worldPlaces(view.world), place);
  const placeInfo = readyUrl(scenePlace?.art)
    ? scenePlace
    : readyUrl(worldPlace?.art)
      ? worldPlace
      : (scenePlace ?? worldPlace);
  const placeUrl = readyUrl(placeInfo?.art);
  const backgroundKey = sceneId && place ? `${sceneId}:${placeKey(place)}` : "";
  // Once a location has opened (or was bypassed), manual repaints cannot interrupt its read.
  const [openedBackgrounds, setOpenedBackgrounds] = useState<ReadonlySet<string>>(() => new Set());
  const paintablePlace = beat?.places.some(
    (entry) => place && placeKey(entry.name) === placeKey(place) && entry.tags.trim(),
  );
  const preparingBackground =
    !!backgroundKey &&
    !!images.connectionId &&
    !images.ask &&
    !reviewImagePromptsBeforeSend &&
    !openedBackgrounds.has(backgroundKey) &&
    sceneUnavailable !== sceneId &&
    (!!placeUrl || placeInfo?.art?.state === "pending" || (!sceneArt && !!paintablePlace));
  useEffect(() => {
    if (!backgroundKey || preparingBackground || openedBackgrounds.has(backgroundKey)) return;
    setOpenedBackgrounds((opened) => new Set(opened).add(backgroundKey));
  }, [backgroundKey, openedBackgrounds, preparingBackground]);
  const continueWithoutBackground = useCallback(() => {
    if (backgroundKey) setOpenedBackgrounds((opened) => new Set(opened).add(backgroundKey));
  }, [backgroundKey]);
  const backgroundTarget = useRef({ key: backgroundKey, url: placeUrl });
  backgroundTarget.current = { key: backgroundKey, url: placeUrl };
  const backgroundSettled = useCallback((key: string, url: string) => {
    if (backgroundTarget.current.key !== key || backgroundTarget.current.url !== url) return;
    setOpenedBackgrounds((opened) => (opened.has(key) ? opened : new Set(opened).add(key)));
  }, []);
  const current = preparingBackground ? null : (timeline?.lines[lineIndex] ?? null);
  const lineKey = position && current ? `${position.id}:${lineIndex}` : "";
  const typed = !!lineKey && typedKey === lineKey;
  const pendingChoice = preparingBackground ? null : (timeline?.pending.get(lineIndex) ?? null);
  const atEnd = !!timeline && lineIndex === timeline.lines.length - 1;
  const onStage = useMemo(
    () => onStageAt(timeline?.lines ?? [], preparingBackground ? -1 : lineIndex, view.lis),
    [timeline, lineIndex, preparingBackground, view.lis],
  );
  /** The current line's ref (favourites, and its voice's cache key). */
  const currentRef = timeline && lineIndex >= 0 ? lineRef(timeline, lineIndex, refBase) : "";
  // A climax game read to the end of its ending (not eased off) closes on the ending's card.
  const outcomeKind: ClimaxEnding | null =
    confrontation?.ending && current?.kind !== "aftermath" ? confrontation.ending.kind : null;
  const showOutcome = !!outcomeKind && atEnd && !!position && outcomeFor === position.id;
  const voiceHold = !!voice && !!lineKey && voice.key === lineKey && voice.outcome === null;
  const voiced = !!voice && !!lineKey && voice.key === lineKey && voice.outcome === "spoken";

  const pushToast = useCallback((toast: ToastInput) => {
    const id = (toastId.current += 1);
    setToasts((list) => [...list, { ...toast, id }]);
    window.setTimeout(() => setToasts((list) => list.filter((item) => item.id !== id)), TOAST_MS);
  }, []);

  const refreshStory = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: chapterQueryKey(runKey, chapterKey) });
    void queryClient.invalidateQueries({ queryKey: storyQueryKey(runKey) });
  }, [chapterKey, queryClient, runKey]);

  /**
   * True when a rupture that opened elsewhere made the server refuse this route chapter's scene (`locked`): the reader
   * then says with whom instead of a generic notice, and the story screen, whose banner offers Make it right, hears of
   * it. A held scene offers no Rewrite or Ease off (heldBy).
   */
  const holdFor = useCallback(
    (error: unknown) => {
      const li = ruptureHold(otomeErrorCode(error), detail?.chapter);
      if (!li) return false;
      setHeld(li);
      refreshStory();
      return true;
    },
    [detail?.chapter, refreshStory],
  );

  // ── Beats ──

  const fetchBeat = useCallback(
    async (index: number) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      rewriteFrom.current = null;
      const known = queryClient
        .getQueryData<ChapterDetail>(chapterQueryKey(runKey, chapterKey))
        ?.beats.find((item) => item.i === index)?.state;
      setLoad({ status: "loading", node: index, writing: known !== "ready" && known !== "read" });
      setNotice(null);
      setHeld(null);
      try {
        const response = await otome.post<BeatResponse>(
          `${base}/beats/${index}`,
          {},
          {
            signal: controller.signal,
          },
        );
        if (controller.signal.aborted) return;
        const { beat: next, confrontation: shown } = readerBeat(response);
        setLoad({ status: "ready", node: index, beat: next, confrontation: shown });
        setPosition(openPosition(next, index, known === "read", protagonist));
        // The beat is written now, and the server is writing the next one ahead.
        void queryClient.invalidateQueries({ queryKey: chapterQueryKey(runKey, chapterKey) });
      } catch (error) {
        if (!controller.signal.aborted) setLoad({ status: "failed", node: index, error });
      }
    },
    [base, chapterKey, otome, protagonist, queryClient, runKey],
  );

  useEffect(() => {
    if (node === null || !detail || askTags || finished) return;
    if (load && load.node === node) return;
    void fetchBeat(node);
  }, [askTags, detail, fetchBeat, finished, load, node]);

  // Leaving drops the request, never the write: the server finishes the beat and keeps it for the next visit (only
  // Cancel stops a write).
  useEffect(() => () => abortRef.current?.abort(), []);

  const retry = useCallback(() => {
    if (node !== null) void fetchBeat(node);
  }, [fetchBeat, node]);

  const cancel = useCallback(async () => {
    abortRef.current?.abort();
    const previous = rewriteFrom.current;
    rewriteFrom.current = null;
    setLoad((current) =>
      previous ? previous : current?.status === "loading" ? { status: "stopped", node: current.node } : current,
    );
    await cancelStoryWork(otome.post, runKey);
  }, [otome.post, runKey]);

  const rewrite = useCallback(async () => {
    if (!ready || node === null) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    rewriteFrom.current = ready;
    setAuto(false);
    setNotice(null);
    setLoad({ status: "loading", node, writing: true });
    try {
      const response = await otome.post<BeatResponse>(
        `${base}/beats/${node}`,
        { rewrite: true },
        {
          signal: controller.signal,
        },
      );
      if (controller.signal.aborted) return;
      rewriteFrom.current = null;
      const { beat: next, confrontation: shown } = readerBeat(response);
      setLoad({ status: "ready", node, beat: next, confrontation: shown });
      setPosition(openPosition(next, node, false, protagonist));
      refreshStory();
    } catch (error) {
      if (controller.signal.aborted) return;
      setLoad(rewriteFrom.current);
      rewriteFrom.current = null;
      if (!holdFor(error)) setNotice(otome.errorMessage(error));
    }
  }, [base, holdFor, node, otome, protagonist, ready, refreshStory]);

  // ── Reading progress ──

  const applyRead = useCallback(
    (result: ReadResult) => {
      const grants = Array.isArray(result.grants) ? result.grants : [];
      const beatStarlight = grants
        .filter((grant) => grant.source === "beat")
        .reduce((sum, grant) => sum + (grant.starlight ?? 0), 0);
      if (beatStarlight > 0) pushToast({ kind: "starlight", amount: beatStarlight });
      const chapterOnes = grants.filter((grant) => grant.source !== "beat");
      if (chapterOnes.length) setChapterGrants((list) => [...list, ...chapterOnes]);
      const { stageUp, repaired } = result;
      if (stageUp || repaired) {
        setArcNews((news) => ({ ...news, ...(stageUp ? { stageUp } : {}), ...(repaired ? { repaired } : {}) }));
        // The story screen's routes and repairs follow from it.
        void queryClient.invalidateQueries({ queryKey: storyQueryKey(runKey) });
      }
      if (typeof result.starlight === "number") {
        patchRun(queryClient, runKey, (current) => ({ ...current, starlight: result.starlight }));
      }
      // Affection changes each level; the run view carries the levels.
      if (grants.some((grant) => grant.affection))
        void queryClient.invalidateQueries({ queryKey: runQueryKey(runKey) });
    },
    [pushToast, queryClient, runKey],
  );

  /** The latest report of a beat's end: true once the server has it. */
  const endReport = useRef<Promise<boolean> | null>(null);
  /** The furthest read sent for the beat on screen, by its version (`reported` rises before the server has it). */
  const furthestReport = useRef<{ beat: string; segment: number; sent: Promise<boolean> } | null>(null);
  const report = useCallback(
    (segment: number, end: boolean): Promise<boolean> => {
      if (node === null) return Promise.resolve(false);
      setPosition((current) =>
        current ? { ...current, reported: Math.max(current.reported, segment), ended: current.ended || end } : current,
      );
      const sent = otome
        .post<ReadResult>(`${base}/beats/${node}/read`, { segment })
        .then((result) => {
          applyRead(result);
          if (end) setHeld(null);
          return true;
        })
        .catch((error: unknown) => {
          console.warn("Otome Forge could not save how far the beat was read", error);
          if (end) {
            // Next sends it again; nothing moves on until the server has it. A rupture that opened elsewhere holds
            // the gate (holdFor).
            setPosition((current) => (current ? { ...current, ended: false } : current));
            if (!holdFor(error)) setNotice(otome.errorMessage(error, "ui.otomeForge.reader.endNotSaved"));
          }
          return false;
        });
      if (end) endReport.current = sent;
      const furthest = furthestReport.current;
      if (!furthest || furthest.beat !== refBase || segment >= furthest.segment) {
        furthestReport.current = { beat: refBase, segment, sent };
      }
      return sent;
    },
    [applyRead, base, holdFor, node, otome, refBase],
  );

  // The server hears where the player is when the beat ends and before each choice (not every line). Once per line of
  // each read: a failed end report is sent again only when the player presses Next (endBeat), never in a loop.
  useEffect(() => {
    if (!position || !current || !timeline || position.replay) return;
    if (atEnd && !position.ended) void report(current.main, true);
    else if (timeline.pending.has(lineIndex) && current.main > position.reported) void report(current.main, false);
  }, [lineKey]);

  // Leaving mid-beat keeps the place: the furthest line reached is saved on the way out.
  const leaving = useRef({ position, current, node, base });
  if (!preparingBackground) leaving.current = { position, current, node, base };
  useEffect(
    () => () => {
      const { position: last, current: line, node: index, base: path } = leaving.current;
      if (!last || !line || index === null || last.replay || line.main <= last.reported) return;
      otome
        .post<ReadResult>(`${path}/beats/${index}/read`, { segment: line.main })
        .catch((error: unknown) => console.warn("Otome Forge could not save how far the beat was read", error));
    },
    // On unmount only; the ref holds the latest place.
    [],
  );

  // ── Art: the scene's places, its key image and the faces (paid paints, never repainted without a tap) ──

  // GET .../art/scene for the beat on screen: its places and key image with their paints, and the ready faces. Read
  // when the beat opens (with an image connection only), then again while something is still painting.
  const cg = sceneArt?.cg ?? beat?.cg ?? null;
  // The love interests who speak in this beat: their faces may still be on their way.
  const speakers = useMemo(() => {
    if (!beat) return [] as LiId[];
    const lines = [...beat.segments, ...beat.choices.flatMap((choice) => choice.options.flatMap((o) => o.segments))];
    return [...new Set(lines.flatMap((line) => speakerLi(line, view.lis)?.id ?? []))];
  }, [beat, view.lis]);
  const wantsFaces = !!images.connectionId && images.expressions;

  useEffect(() => {
    if (!sceneId || node === null || !images.connectionId) return;
    let live = true;
    let tries = 0;
    let timer = 0;
    let lastFaces = JSON.stringify(speakers.map(() => ({})));
    const waitingForFaces = (art: SceneArt) => wantsFaces && speakers.some((li) => art.facesComing?.includes(li));
    const waiting = (art: SceneArt) =>
      art.cg?.art?.state === "pending" ||
      (Array.isArray(art.places) && art.places.some((place) => place.art?.state === "pending")) ||
      // Painting and free cleanup both settle; failed or stopped work is never waited for.
      waitingForFaces(art);
    const look = async () => {
      tries += 1;
      try {
        const art = await otome.get<SceneArt>(`${runPath(runKey)}/art/scene`, { key: chapterKey, i: node });
        if (!live) return;
        setSceneUnavailable((unavailable) => (unavailable === sceneId ? null : unavailable));
        setScene({ id: sceneId, art });
        const nextFaces = JSON.stringify(speakers.map((li) => art.faces?.[li] ?? {}));
        if (wantsFaces && (waitingForFaces(art) || nextFaces !== lastFaces)) {
          // The run owns both the clean expression URLs and their cut/framing metadata.
          void queryClient.invalidateQueries({ queryKey: runQueryKey(runKey) }, { cancelRefetch: false });
        }
        lastFaces = nextFaces;
        if (waiting(art)) {
          if (tries < PAINT_POLL_TRIES) timer = window.setTimeout(look, PAINT_POLL_MS);
          else setSceneUnavailable(sceneId);
        }
      } catch {
        if (!live) return;
        setSceneUnavailable(sceneId);
        if (tries < PAINT_POLL_TRIES) timer = window.setTimeout(look, PAINT_POLL_MS);
      }
    };
    void look();
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
    // The speakers belong to the scene id; a tap (sceneTick) looks again.
  }, [chapterKey, images.connectionId, node, otome, queryClient, runKey, sceneId, sceneTick, wantsFaces]);

  const seenCgs = useRef(new Set<string>());

  /**
   * Marks the beat's key image seen, once per version of the beat: the server hears the read reached it first (it
   * unlocks only a ready image read past its line), then adds it to the Album; "New CG" shows only when that request
   * added it. A failed one is tried again when the beat ends.
   */
  const markCgSeen = useCallback(async () => {
    if (!cg || node === null || !position || !current) return;
    if (seenCgs.current.has(refBase)) return;
    seenCgs.current.add(refBase);
    try {
      const at = Math.max(current.main, cg.at);
      // The server unlocks only a CG read past its line: the read that got there may still be on its way, so it is
      // awaited (or sent now), and a read that was not saved sends nothing (endBeat tries again).
      if (!position.replay) {
        const furthest = furthestReport.current;
        const reached =
          at > position.reported
            ? report(at, false)
            : furthest?.beat === refBase && furthest.segment >= cg.at
              ? furthest.sent
              : Promise.resolve(true);
        if (!(await reached)) {
          seenCgs.current.delete(refBase);
          return;
        }
      }
      const result = await otome.post<{ unlocked?: boolean }>(`${runPath(runKey)}/art/cg/seen`, {
        key: chapterKey,
        i: node,
      });
      if (result?.unlocked === true) pushToast({ kind: "cg" });
    } catch (error) {
      seenCgs.current.delete(refBase);
      console.warn("Otome Forge could not mark a key image seen", error);
    }
  }, [cg, chapterKey, current, node, otome, position, pushToast, refBase, report, runKey]);

  // A paint on a tap: the key image, or a place. With "Review image prompts before sending" on, its prompt is shown
  // for editing first. The route waits for the paint and answers with its record; a second tap while one runs is
  // ignored here and on the server.
  const [review, setReview] = useState<PaintReview | null>(null);
  // One paint request at a time from this reader (the server also makes a second tap wait for the first).
  const paintBusy = useRef(false);

  const sendPaint = useCallback(
    async (target: PaintTarget, edited?: ImagePrompt) => {
      if (node === null || paintBusy.current) return;
      paintBusy.current = true;
      setPainting(true);
      setNotice(null);
      try {
        if (target.kind === "cg") {
          const result = await otome.post<{ art?: Paint | null }>(`${runPath(runKey)}/art/cg`, {
            key: target.key,
            i: target.i,
            ...edited,
          });
          const art = result?.art;
          // Patched only onto the scene it painted: the target names the scene the review was opened on, and the
          // update skips a scene shown since (shown.id against this render's sceneId).
          if (art && target.key === chapterKey && target.i === node)
            setScene((shown) =>
              shown && shown.id === sceneId && shown.art.cg
                ? { ...shown, art: { ...shown.art, cg: { ...shown.art.cg, art } } }
                : shown,
            );
        } else {
          const result = await otome.post<{ world?: WorldView }>(`${runPath(runKey)}/art/place`, {
            place: target.place,
            ...edited,
          });
          const world = result?.world;
          if (world) patchRun(queryClient, runKey, (shown) => ({ ...shown, world: { ...shown.world, ...world } }));
        }
        setReview(null);
      } catch (error) {
        const text = otome.errorMessage(error);
        if (edited) setReview((shown) => (shown ? { ...shown, busy: false, error: text } : shown));
        else setNotice(text);
      } finally {
        paintBusy.current = false;
        setPainting(false);
        setSceneTick((tick) => tick + 1);
      }
    },
    [chapterKey, node, otome, queryClient, runKey, sceneId],
  );

  const paint = useCallback(
    async (target: PaintTarget) => {
      if (paintBusy.current || node === null || review) return;
      if (!reviewImagePromptsBeforeSend) return sendPaint(target);
      // The review is a dialog: Auto stops, as it does for the Backlog and Ease off.
      setAuto(false);
      paintBusy.current = true;
      setPainting(true);
      setNotice(null);
      try {
        const initial =
          target.kind === "cg"
            ? await otome.post<ImagePrompt>(`${runPath(runKey)}/art/cg/prompt`, { key: target.key, i: target.i })
            : await otome.post<ImagePrompt>(`${runPath(runKey)}/art/place/prompt`, { place: target.place });
        setReview({ target, initial, busy: false, error: null });
      } catch (error) {
        setNotice(otome.errorMessage(error));
      } finally {
        paintBusy.current = false;
        setPainting(false);
      }
    },
    [node, otome, review, reviewImagePromptsBeforeSend, runKey, sendPaint],
  );

  const paintCg = useCallback(
    () => (node === null ? undefined : paint({ kind: "cg", key: chapterKey, i: node })),
    [chapterKey, node, paint],
  );
  const paintPlace = useCallback((place: string) => paint({ kind: "place", place }), [paint]);
  const sendReview = useCallback(
    (edited: ImagePrompt) => {
      if (!review || review.busy) return;
      setReview({ ...review, busy: true, error: null });
      void sendPaint(review.target, edited);
    },
    [review, sendPaint],
  );
  const skipReview = useCallback(() => setReview(null), []);

  // ── Moving through the beat ──

  const goTo = useCallback((index: number) => {
    setPosition((current) => (current ? { ...current, line: index } : current));
  }, []);

  const endBeat = useCallback(async () => {
    if (!position || !current || node === null) return;
    // The next beat or the chapter's end only once the server counts this one as read: otherwise its choices, grants
    // and the next node would all be refused.
    const saved = position.replay
      ? true
      : position.ended
        ? await (endReport.current ?? report(current.main, true))
        : await report(current.main, true);
    if (!saved) {
      setAuto(false);
      return;
    }
    // A key image shown in this beat whose unlock failed is tried once more now that the whole beat is read.
    if (cg?.art?.state === "ready" && current.main >= cg.at && !seenCgs.current.has(refBase)) void markCgSeen();
    refreshStory();
    void queryClient.invalidateQueries({ queryKey: runQueryKey(runKey) });
    if (node < nodeCount - 1) {
      setNode(node + 1);
    } else {
      setAuto(false);
      setFinished(true);
    }
  }, [cg, current, markCgSeen, node, nodeCount, position, queryClient, refBase, refreshStory, report, runKey]);

  const advance = useCallback(() => {
    if (!timeline || !current) return;
    if (!typed) {
      // The line shows whole now; counting it typed at once lets a quick second press go on.
      setFinishToken((value) => value + 1);
      setTypedKey(lineKey);
      return;
    }
    if (timeline.pending.has(lineIndex)) return;
    if (lineIndex < timeline.lines.length - 1) goTo(lineIndex + 1);
    else if (outcomeKind && position && outcomeFor !== position.id) {
      // The ending's card first; its Go on (this again) moves on.
      setAuto(false);
      setOutcomeFor(position.id);
    } else void endBeat();
  }, [current, endBeat, goTo, lineIndex, lineKey, outcomeFor, outcomeKind, position, timeline, typed]);

  const canSkip =
    !preparingBackground &&
    !!timeline &&
    !!position &&
    skipTarget(timeline, lineIndex, position.readThrough) !== lineIndex;
  const skip = useCallback(() => {
    if (preparingBackground || !timeline || !position) return;
    const target = skipTarget(timeline, lineIndex, position.readThrough);
    if (target === lineIndex) return;
    setAuto(false);
    setInstantKey(`${position.id}:${target}`);
    goTo(target);
  }, [goTo, lineIndex, position, preparingBackground, timeline]);

  // Auto: once a line has typed itself out, wait long enough to read it, then go on. It waits at a choice.
  const advanceRef = useRef(advance);
  advanceRef.current = advance;
  // A voiced line holds Auto until its voice has played, then goes on after a short pause.
  useEffect(() => {
    if (!auto || !typed || !current || pendingChoice || finished || voiceHold || showOutcome || hold) return;
    const timer = window.setTimeout(
      () => advanceRef.current(),
      voiced ? AFTER_VOICE_MS : autoDelay(current.segment.text),
    );
    return () => window.clearTimeout(timer);
  }, [auto, current, finished, hold, pendingChoice, showOutcome, typed, voiceHold, voiced]);

  // ── Choices ──

  // Two quick presses share the render's `choosing`: the ref lets only the first one through.
  const choosingRef = useRef(false);
  const choose = useCallback(
    async (choice: ForgeChoice, option: ChoiceOption) => {
      if (preparingBackground || !beat || !position || node === null || choosing || choosingRef.current) return;
      setChoiceError(null);
      // Picked on an earlier read: this read shows the other branch, and nothing changes.
      if (canonOption(beat, choice)) {
        setPosition({ ...position, picks: { ...position.picks, [choice.id]: option.id }, line: lineIndex + 1 });
        return;
      }
      setChoosing(choice.id);
      choosingRef.current = true;
      if (confrontation) {
        // A stance: sent once (the server keeps the first), and the round's answer comes back with the next round.
        try {
          const round = Number(choice.id.replace(/^round-/u, ""));
          const result = await otome.post<StanceResult>(`${base}/beats/${node}/stance`, { round, stance: option.id });
          const shown = result.confrontation;
          const next = confrontationBeat(shown);
          const picked = next.choiceCanon[choice.id] ?? option.id;
          setLoad({ status: "ready", node, beat: next, confrontation: shown });
          setPosition((current) =>
            current
              ? { ...current, picks: { ...current.picks, [choice.id]: picked }, line: lineIndex + 1, ended: false }
              : current,
          );
          const by = Array.isArray(result.rememberedBy) ? result.rememberedBy : [];
          if (result.remembered) pushToast({ kind: "remember", li: by.length === 1 ? by[0]! : null });
        } catch (error) {
          setChoiceError(otome.errorMessage(error));
        } finally {
          choosingRef.current = false;
          setChoosing(null);
        }
        return;
      }
      try {
        const result = await otome.post<{ beat: BeatView; remembered: boolean; rememberedBy?: LiId[] }>(
          `${base}/beats/${node}/choose`,
          { choice: choice.id, option: option.id },
        );
        const picked = result.beat.choiceCanon[choice.id] ?? option.id;
        setLoad({ status: "ready", node, beat: result.beat });
        // A big choice at the last line adds its selection after it: the new end is reported again.
        setPosition((current) =>
          current
            ? { ...current, picks: { ...current.picks, [choice.id]: picked }, line: lineIndex + 1, ended: false }
            : current,
        );
        // Named only when the pick touched one love interest; "They'll remember that." otherwise.
        const by = Array.isArray(result.rememberedBy) ? result.rememberedBy : [];
        if (result.remembered) pushToast({ kind: "remember", li: by.length === 1 ? by[0]! : null });
      } catch (error) {
        setChoiceError(otome.errorMessage(error));
      } finally {
        choosingRef.current = false;
        setChoosing(null);
      }
    },
    [base, beat, choosing, confrontation, lineIndex, node, otome, position, preparingBackground, pushToast],
  );

  // ── Ease off and veils ──

  /**
   * Ends the scene here with no model call; resolves the limits to offer veiling from now on (the chapter's tags that
   * are still allowed). On a first read the server cuts the canon and counts the beat as read; a replay changes no
   * canon, so it is cut here only.
   */
  const easeOff = useCallback(async (): Promise<LimitId[]> => {
    if (node === null) return [];
    // A scene still being written is cut before it exists: its write is stopped too (the server keeps the cut beat
    // either way, and drops a write that lands after it).
    const writing = load?.node === node && load.status === "loading" && load.writing;
    abortRef.current?.abort();
    rewriteFrom.current = null;
    setAuto(false);
    if (writing) void cancelStoryWork(otome.post, runKey);
    const segment = current?.main ?? 0;
    let cut: BeatView;
    let suggestions: LimitId[];
    if (beat && position?.replay) {
      cut = { ...beat, easedOff: { at: segment } };
      suggestions = tags.filter((tag): tag is LimitId => isLimitId(tag) && view.world.content.limits[tag] === "allow");
    } else {
      type Eased = BeatResponse & { veilSuggestions?: LimitId[] } & ReadResult;
      let result: Eased;
      try {
        result = await otome.post<Eased>(`${base}/beats/${node}/ease-off`, { segment });
      } catch (error) {
        // Held by a rupture: the dialog closes on nothing to veil, and the reader says with whom.
        if (holdFor(error)) return [];
        throw error;
      }
      applyRead(result);
      // A Confrontation's beat holds only its opening: the reader cuts the stance game it was showing instead.
      cut =
        confrontation && beat && !result.confrontation
          ? { ...beat, easedOff: result.beat?.easedOff ?? { at: segment } }
          : readerBeat(result).beat;
      suggestions = Array.isArray(result.veilSuggestions) ? result.veilSuggestions : [];
      refreshStory();
    }
    // The server counted the cut beat as read: Next moves on without reporting it again.
    endReport.current = Promise.resolve(true);
    const picks = position?.picks ?? {};
    const lines = buildTimeline(cut, picks, protagonist).lines;
    const id = `${node}:${cut.rewrites}`;
    // The jump to the aftermath skips what was never read (the rest of a branch, or a first-play pick spliced in at the
    // cut): the backlog goes on from the aftermath line, as everything before the line on screen is in it already.
    logged.current = { id, next: Math.max(0, lines.length - 1) };
    // A cut Confrontation has no rounds or ending to come: it is read as the beat it was cut to.
    setLoad({ status: "ready", node, beat: cut });
    setPosition({
      id,
      replay: position?.replay ?? false,
      picks,
      line: Math.max(0, lines.length - 1),
      readThrough: position?.readThrough ?? cut.readThrough,
      reported: Math.max(position?.reported ?? 0, cut.easedOff?.at ?? 0),
      // The server counted it as read when it cut it.
      ended: true,
    });
    return suggestions;
  }, [
    applyRead,
    base,
    beat,
    current,
    holdFor,
    load,
    node,
    otome,
    position,
    protagonist,
    refreshStory,
    runKey,
    tags,
    view.world.content,
  ]);

  const veil = useCallback(
    async (limits: LimitId[]) => {
      const { world } = await otome.post<{ world: WorldView }>(`${runPath(runKey)}/veil`, { limits });
      patchRun(queryClient, runKey, (currentView) => ({ ...currentView, world: { ...currentView.world, ...world } }));
    },
    [otome, queryClient, runKey],
  );

  // ── Backlog and favourites ──
  // ponytail: the backlog holds the lines read since the reader opened, and a star shows as kept once this session
  // starred it (no route lists favourites yet). A star sends whether to keep the line, so one kept before this session
  // shows unstarred and is kept again, never removed. Ceiling: a resumed chapter's earlier beats and older favourites
  // are not shown. Upgrade path: the chapter detail returns the canonical lines read so far and the chapter's
  // favourite refs.

  useEffect(() => {
    if (!current || !timeline || !position || node === null || lineIndex < 0) return;
    if (logged.current.id !== position.id) logged.current = { id: position.id, next: 0 };
    const from = logged.current.next;
    if (lineIndex < from) return;
    const added: LogEntry[] = [];
    for (let index = from; index <= lineIndex; index += 1) {
      added.push({
        key: `${position.id}:${index}`,
        ref: lineRef(timeline, index, refBase),
        line: timeline.lines[index]!,
      });
    }
    logged.current.next = lineIndex + 1;
    setLog((list) => [...list, ...added]);
  }, [current, lineIndex, node, position, refBase, timeline]);

  const star = useCallback(
    async (entry: LogEntry, text: string, li: LiId | null) => {
      const { favorites } = await otome.post<{ favorites: Favorite[] }>(`${runPath(runKey)}/favorites`, {
        text,
        ref: entry.ref,
        keep: !starred.has(entry.ref),
        ...(li ? { li } : {}),
      });
      setStarred(new Set((Array.isArray(favorites) ? favorites : []).map((favorite) => favorite.ref)));
    },
    [otome, runKey, starred],
  );

  // A rupture holds this route chapter: its gate's end report, a Rewrite, an Ease off or its next scene was refused as
  // `locked`.
  const heldBy = held ?? (load?.status === "failed" ? ruptureHold(otomeErrorCode(load.error), detail?.chapter) : null);

  const canRewrite =
    !preparingBackground &&
    !heldBy &&
    !!ready &&
    !!position &&
    !position.replay &&
    // Read to its end, the beat is canon (the server refuses); a choice still waiting at the last line keeps it open.
    !(position.ended && !pendingChoice) &&
    !ready.beat.easedOff &&
    !ready.beat.choices.some((choice) => canonOption(ready.beat, choice)) &&
    !(detail?.beats ?? []).some((item) => item.i > ready.node && item.state === "read");

  // Ease off is there for every node not yet finished, until its end is saved: while its scene is read, opened or
  // written, and after a Cancel or a failure (the server cuts a node with no beat before its first line). A node read
  // before eases off only once its beat is open, as a replay that changes no canon.
  const nodeRead = (detail?.beats ?? []).some((item) => item.i === node && item.state === "read");
  const canEaseOff =
    !preparingBackground &&
    !heldBy &&
    node !== null &&
    !finished &&
    !askTags &&
    load?.node === node &&
    (ready
      ? current?.kind !== "aftermath" &&
        // Read to its end, the server counts the beat as read and refuses a cut; a choice still waiting at the last
        // line keeps it open, and a failed end report brings it back.
        !(position?.ended && !position.replay && !pendingChoice)
      : !nodeRead);

  return {
    detail,
    chapterQuery,
    node,
    nodeCount,
    tags,
    askTags,
    beginChapter: () => setTagsSeen(true),
    load,
    beat,
    position,
    timeline,
    lineIndex,
    current,
    lineKey,
    typed,
    markTyped: setTypedKey,
    instant: reducedMotion || (!!lineKey && instantKey === lineKey),
    finishToken,
    pendingChoice,
    onStage,
    atEnd,
    advance,
    canSkip,
    skip,
    auto,
    setAuto,
    finished,
    chapterGrants,
    arcNews,
    toasts,
    choose,
    choosing,
    choiceError,
    easeOff,
    canEaseOff,
    veil,
    canRewrite,
    rewrite,
    cancel,
    retry,
    notice,
    heldBy,
    clearNotice: () => setNotice(null),
    log,
    starred,
    star,
    confrontation,
    outcomeKind,
    showOutcome,
    currentRef,
    cg,
    sceneArt,
    place,
    placeInfo,
    placeUrl,
    backgroundKey,
    preparingBackground,
    backgroundSettled,
    continueWithoutBackground,
    markCgSeen,
    paintCg,
    paintPlace,
    painting,
    review,
    sendReview,
    skipReview,
    notify: pushToast,
  };
}

export type ReaderState = ReturnType<typeof useReader>;
