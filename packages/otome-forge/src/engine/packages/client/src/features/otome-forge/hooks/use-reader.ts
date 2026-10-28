// ──────────────────────────────────────────────
// Otome Forge: the story's queries (GET /story, GET /chapters/:key) and the reader's state. The reader asks for one
// beat at a time (POST .../beats/:i writes it if it is missing; the server then writes the next one ahead), plays it
// line by line, saves first-play choices, tells the server how far it was read (Starlight and affection come back),
// and handles Ease off, Rewrite beat and Cancel.
// ──────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOtomeApi } from "../api";
import {
  autoDelay,
  buildTimeline,
  canonOption,
  initialPicks,
  onStageAt,
  openingLine,
  openingNode,
  skipTarget,
  type Picks,
  type ReaderLine,
} from "../lib/reader-state";
import type {
  BeatView,
  ChapterDetail,
  ChoiceOption,
  Favorite,
  ForgeChoice,
  Grant,
  LiId,
  ReadResult,
  RunView,
  StoryView,
  WorldView,
} from "../shared/api-types";
import { LIMIT_IDS, type LimitId } from "../shared/content";
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
  | { status: "ready"; node: number; beat: BeatView }
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

type ToastInput = { kind: "remember"; li: LiId | null } | { kind: "starlight"; amount: number };
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
}

export function useReader({ runKey, chapterKey, view, startNode, reducedMotion }: ReaderOptions) {
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const chapterQuery = useChapter(runKey, chapterKey);
  const detail = chapterQuery.data ?? null;
  const base = `${runPath(runKey)}/chapters/${encodeURIComponent(chapterKey)}`;
  const protagonist = view.player.name;

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
  const [toasts, setToasts] = useState<ReaderToast[]>([]);
  const [choosing, setChoosing] = useState<string | null>(null);
  const [choiceError, setChoiceError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [starred, setStarred] = useState<ReadonlySet<string>>(() => new Set());
  const abortRef = useRef<AbortController | null>(null);
  const rewriteFrom = useRef<BeatLoad | null>(null);
  const toastId = useRef(0);

  // Opens where the chapter stands: its first node not read to the end.
  if (node === null && detail) setNode(openingNode(detail.beats));

  const tags = detail?.chapter.tags ?? [];
  // Dark chapters open with their content tags; the first beat waits until the player begins.
  const askTags = tags.length > 0 && node === 0 && !tagsSeen;
  const nodeCount = detail?.chapter.nodes.length ?? 0;
  const ready = load?.status === "ready" && load.node === node ? load : null;
  const beat = ready?.beat ?? null;

  const timeline = useMemo(
    () => (beat && position ? buildTimeline(beat, position.picks, protagonist) : null),
    [beat, position, protagonist],
  );
  const lineIndex = timeline && position ? Math.min(position.line, timeline.lines.length - 1) : -1;
  const current = timeline?.lines[lineIndex] ?? null;
  const lineKey = position && current ? `${position.id}:${lineIndex}` : "";
  const typed = !!lineKey && typedKey === lineKey;
  const pendingChoice = timeline?.pending.get(lineIndex) ?? null;
  const atEnd = !!timeline && lineIndex === timeline.lines.length - 1;
  const onStage = useMemo(() => onStageAt(timeline?.lines ?? [], lineIndex, view.lis), [timeline, lineIndex, view.lis]);

  const pushToast = useCallback((toast: ToastInput) => {
    const id = (toastId.current += 1);
    setToasts((list) => [...list, { ...toast, id }]);
    window.setTimeout(() => setToasts((list) => list.filter((item) => item.id !== id)), TOAST_MS);
  }, []);

  const refreshStory = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: chapterQueryKey(runKey, chapterKey) });
    void queryClient.invalidateQueries({ queryKey: storyQueryKey(runKey) });
  }, [chapterKey, queryClient, runKey]);

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
      try {
        const { beat: next } = await otome.post<{ beat: BeatView }>(
          `${base}/beats/${index}`,
          {},
          {
            signal: controller.signal,
          },
        );
        if (controller.signal.aborted) return;
        setLoad({ status: "ready", node: index, beat: next });
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
      const { beat: next } = await otome.post<{ beat: BeatView }>(
        `${base}/beats/${node}`,
        { rewrite: true },
        {
          signal: controller.signal,
        },
      );
      if (controller.signal.aborted) return;
      rewriteFrom.current = null;
      setLoad({ status: "ready", node, beat: next });
      setPosition(openPosition(next, node, false, protagonist));
      refreshStory();
    } catch (error) {
      if (controller.signal.aborted) return;
      setLoad(rewriteFrom.current);
      rewriteFrom.current = null;
      setNotice(otome.errorMessage(error));
    }
  }, [base, node, otome, protagonist, ready, refreshStory]);

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
          return true;
        })
        .catch((error: unknown) => {
          console.warn("Otome Forge could not save how far the beat was read", error);
          if (end) {
            // Next sends it again; nothing moves on until the server has it.
            setPosition((current) => (current ? { ...current, ended: false } : current));
            setNotice(otome.errorMessage(error, "ui.otomeForge.reader.endNotSaved"));
          }
          return false;
        });
      if (end) endReport.current = sent;
      return sent;
    },
    [applyRead, base, node, otome],
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
  leaving.current = { position, current, node, base };
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
    refreshStory();
    void queryClient.invalidateQueries({ queryKey: runQueryKey(runKey) });
    if (node < nodeCount - 1) {
      setNode(node + 1);
    } else {
      setAuto(false);
      setFinished(true);
    }
  }, [current, node, nodeCount, position, queryClient, refreshStory, report, runKey]);

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
    else void endBeat();
  }, [current, endBeat, goTo, lineIndex, lineKey, timeline, typed]);

  const canSkip = !!timeline && !!position && skipTarget(timeline, lineIndex, position.readThrough) !== lineIndex;
  const skip = useCallback(() => {
    if (!timeline || !position) return;
    const target = skipTarget(timeline, lineIndex, position.readThrough);
    if (target === lineIndex) return;
    setAuto(false);
    setInstantKey(`${position.id}:${target}`);
    goTo(target);
  }, [goTo, lineIndex, position, timeline]);

  // Auto: once a line has typed itself out, wait long enough to read it, then go on. It waits at a choice.
  const advanceRef = useRef(advance);
  advanceRef.current = advance;
  useEffect(() => {
    if (!auto || !typed || !current || pendingChoice || finished) return;
    const timer = window.setTimeout(() => advanceRef.current(), autoDelay(current.segment.text));
    return () => window.clearTimeout(timer);
  }, [auto, current, finished, pendingChoice, typed]);

  // ── Choices ──

  const choose = useCallback(
    async (choice: ForgeChoice, option: ChoiceOption) => {
      if (!beat || !position || node === null || choosing) return;
      setChoiceError(null);
      // Picked on an earlier read: this read shows the other branch, and nothing changes.
      if (canonOption(beat, choice)) {
        setPosition({ ...position, picks: { ...position.picks, [choice.id]: option.id }, line: lineIndex + 1 });
        return;
      }
      setChoosing(choice.id);
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
        setChoosing(null);
      }
    },
    [base, beat, choosing, lineIndex, node, otome, position, pushToast],
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
      const result = await otome.post<{ beat: BeatView; veilSuggestions?: LimitId[] } & ReadResult>(
        `${base}/beats/${node}/ease-off`,
        { segment },
      );
      applyRead(result);
      cut = result.beat;
      suggestions = Array.isArray(result.veilSuggestions) ? result.veilSuggestions : [];
      refreshStory();
    }
    // The server counted the cut beat as read: Next moves on without reporting it again.
    endReport.current = Promise.resolve(true);
    const picks = position?.picks ?? {};
    const lines = buildTimeline(cut, picks, protagonist).lines;
    setLoad({ status: "ready", node, beat: cut });
    setPosition({
      id: `${node}:${cut.rewrites}`,
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

  const logged = useRef<{ id: string; next: number }>({ id: "", next: 0 });
  useEffect(() => {
    if (!timeline || !position || node === null || lineIndex < 0) return;
    if (logged.current.id !== position.id) logged.current = { id: position.id, next: 0 };
    const from = logged.current.next;
    if (lineIndex < from) return;
    const added: LogEntry[] = [];
    for (let index = from; index <= lineIndex; index += 1) {
      const line = timeline.lines[index]!;
      const offset = index - timeline.lines.findIndex((item) => item.main === line.main && item.kind !== "segment");
      const own = line.kind === "segment" ? "" : line.optionId ? `:${line.optionId}+${offset}` : `+${line.kind}`;
      const ref = `${chapterKey}/${node}r${beat?.rewrites ?? 0}/${line.main}${own}`;
      added.push({ key: `${position.id}:${index}`, ref, line });
    }
    logged.current.next = lineIndex + 1;
    setLog((list) => [...list, ...added]);
  }, [beat, chapterKey, lineIndex, node, position, timeline]);

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

  const canRewrite =
    !!ready &&
    !!position &&
    !position.replay &&
    // Read to its end, the beat is canon (the server refuses); a choice still waiting at the last line keeps it open.
    !(position.ended && !pendingChoice) &&
    !ready.beat.easedOff &&
    !ready.beat.choices.some((choice) => canonOption(ready.beat, choice)) &&
    !(detail?.beats ?? []).some((item) => item.i > ready.node && item.state === "read");

  // Ease off is there for every node not yet finished: while its scene is read, opened or written, and after a Cancel
  // or a failure (the server cuts a node with no beat before its first line). A node read before eases off only once
  // its beat is open, as a replay that changes no canon.
  const nodeRead = (detail?.beats ?? []).some((item) => item.i === node && item.state === "read");
  const canEaseOff =
    node !== null &&
    !finished &&
    !askTags &&
    load?.node === node &&
    (ready ? current?.kind !== "aftermath" : !nodeRead);

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
    clearNotice: () => setNotice(null),
    log,
    starred,
    star,
  };
}

export type ReaderState = ReturnType<typeof useReader>;
