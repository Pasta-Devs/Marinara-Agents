// ──────────────────────────────────────────────
// Otome Forge: Home. The love interest the player chose (or the player, in her own look) stands in a layered scene
// tinted by the time of day, breathing, with a handwritten message of the day, his mood, tap zones that answer at once
// from lines written in advance, the phone, Rough day? and Him / Me. Everything works without images or audio.
// ──────────────────────────────────────────────
// Routes (S/routes/home.ts): GET /runs/:run/home → HomeView; POST .../home/set {li?, show?} → {home};
// POST .../home/note {li} → {note} (written by the local day's first call, the same note after); GET
// .../lis/:li/lines → LinesView. The note is asked for once per love interest, local day and rupture state from this
// page (a rupture that opens or is repaired makes the day's note stale, and Home's answer then has none): one request
// in flight, and a failure waits for Try again instead of asking the model again on every visit.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HeartHandshake, RotateCcw, Smartphone, UsersRound } from "lucide-react";
import { useOtomeApi } from "../../api";
import { runPath, useReducedMotion } from "../../hooks/use-reader";
import { accentOf } from "../../lib/accent";
import {
  fallbackTapKeys,
  localDay,
  localHour,
  pickLine,
  recordTap,
  skyPhase,
  tapMode,
  tapPool,
  type TapMode,
} from "../../lib/tap-mood";
import { useOtomeProps } from "../../props";
import type {
  HomeLook,
  HomeShow,
  HomeState,
  HomeView,
  LiId,
  LinesView,
  NoteView,
  RunLiView,
  RunView,
} from "../../shared/api-types";
import { timeOfDayOf, type TapZone } from "../../shared/home";
import { PALETTE } from "../../theme/tokens";
import type { PhoneOpen } from "../phone/PhoneScreen";
import { faceArt } from "../phone/StickerPicker";
import { FACE_LABEL_KEYS } from "../reader/FacePlate";
import { CutoutFigure, useParallax, type FigureArt } from "./CutoutFigure";
import { HimMeToggle } from "./HimMeToggle";
import { HomeLayers } from "./HomeLayers";
import { HomeLiPicker } from "./HomeLiPicker";
import { MoodChip } from "./MoodChip";
import { NoteCard, type NoteStatus } from "./NoteCard";
import { RoughDaySheet } from "./RoughDaySheet";

export const homeQueryKey = (runKey: string) => ["otome-forge", "home", runKey] as const;
export const linesQueryKey = (runKey: string, li: LiId) => ["otome-forge", "lines", runKey, li] as const;

const fetchHome = (otome: ReturnType<typeof useOtomeApi>, runKey: string) =>
  otome.get<HomeView>(`${runPath(runKey)}/home`);

/** While a cut-out is on its way, Home asks again this often (the server never waits for one). */
const CUTOUT_POLL_MS = 10_000;

export function useHome(runKey: string) {
  const otome = useOtomeApi();
  return useQuery({
    queryKey: homeQueryKey(runKey),
    queryFn: () => fetchHome(otome, runKey),
    refetchInterval: (query) => (query.state.data?.look?.cutoutState === "pending" ? CUTOUT_POLL_MS : false),
  });
}

/**
 * The love interest Home is about (the player's pick, else the first of the cast), for the top bar's chip. Reads
 * Home's cached answer without asking for it.
 */
export function useHomeLi(runKey: string | null, view: RunView | null): RunLiView | null {
  const otome = useOtomeApi();
  const { data } = useQuery({
    queryKey: homeQueryKey(runKey ?? ""),
    queryFn: () => fetchHome(otome, runKey ?? ""),
    enabled: false,
  });
  return view?.lis.find((li) => li.id === data?.li) ?? view?.lis[0] ?? null;
}

// One note request per run, love interest, local day and rupture state on this page, kept once it lands (a read of
// Home that started before it finished may still answer "no note yet"), and the failures that wait for Try again.
const noteRequests = new Map<string, Promise<NoteView>>();
const noteFailures = new Map<string, unknown>();

const BUBBLE_MS = 4_600;
const MINUTE_MS = 60_000;

/** The time, once a minute: the tint, the part of the day and the local day follow it. */
function useMinute(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), MINUTE_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}

const uncut = (url: string): HomeLook => ({ url, source: "look", cutoutState: "uncut" });

/**
 * The figure's art with what to show if it fails to load: a cut-out steps down to its uncut image (the slow pan), and
 * that to `then` (a painted face to his plain look), before the figure falls back to initials.
 */
function toFigureArt(
  art: { url: string; cutout?: string; source?: HomeLook["source"] } | null,
  then: FigureArt | null = null,
): FigureArt | null {
  if (!art?.url) return then;
  const uncut: FigureArt = {
    url: art.url,
    cut: false,
    kind: art.source === "avatar" ? "avatar" : "look",
    ...(then ? { fallback: then } : {}),
  };
  return art.cutout ? { url: art.cutout, cut: true, kind: "look", fallback: uncut } : uncut;
}

interface HomeScreenProps {
  runKey: string;
  view: RunView;
  /** Opens the phone: a thread (Reply quotes the note), or null for the thread list. */
  onOpenPhone: (open: PhoneOpen | null) => void;
  onOpenCast: () => void;
  onOpenStories: () => void;
}

export function HomeScreen({ runKey, view, onOpenPhone, onOpenCast, onOpenStories }: HomeScreenProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const { timeZone } = useOtomeProps();
  const reduced = useReducedMotion();
  const parallax = useParallax(!reduced);
  const home = useHome(runKey);
  const now = new Date(useMinute());
  const hour = localHour(timeZone, now);
  const part = timeOfDayOf(hour);
  const sky = skyPhase(hour);
  const day = localDay(timeZone, now);

  const data = home.data ?? null;
  const li = view.lis.find((item) => item.id === data?.li) ?? view.lis[0] ?? null;
  // The home view answers for its own `li` (null only without a cast).
  const about = data && li && (data.li ?? li.id) === li.id ? data : null;
  const show: HomeShow = data?.show ?? "him";
  const note = about?.note ?? null;
  const accent = li ? accentOf(li) : PALETTE.rose;

  // His lines: the pack for his stage once it exists, the nearest one until then (else the catalog's lines).
  const lines = useQuery({
    queryKey: linesQueryKey(runKey, li?.id ?? ""),
    enabled: !!li,
    queryFn: () => otome.get<LinesView>(`${runPath(runKey)}/lis/${encodeURIComponent(li?.id ?? "")}/lines`),
  });
  const ownLines = lines.data ?? null;
  const rupture = about?.rupture ?? ownLines?.rupture ?? false;

  // ── The message of the day ──
  const noteKey = li ? `${runKey} ${li.id} ${day} ${about?.rupture ? "curt" : "warm"}` : "";
  const [noteState, setNoteState] = useState<{ key: string; error: unknown } | null>(null);
  /** Home's polite live region: a tap's line, and the day's note when it arrives. */
  const [announce, setAnnounce] = useState("");

  const writeNote = (key: string, liId: LiId, name: string) => {
    setNoteState(null);
    let request = noteRequests.get(key);
    if (!request) {
      request = otome
        .post<{ note: NoteView }>(`${runPath(runKey)}/home/note`, { li: liId })
        .then((answer) => answer.note);
      noteRequests.set(key, request);
      request.catch(() => noteRequests.delete(key));
    }
    request.then(
      (written) => {
        noteFailures.delete(key);
        queryClient.setQueryData<HomeView>(homeQueryKey(runKey), (current) =>
          current && current.li === liId ? { ...current, note: written } : current,
        );
        // The writing status gives way to the note itself, which no live region holds: say it once.
        setAnnounce(t("ui.otomeForge.home.noteArrived", { name, text: written.text }));
      },
      (error: unknown) => {
        noteFailures.set(key, error);
        setNoteState({ key, error });
      },
    );
  };

  useEffect(() => {
    if (!about || !li || about.note || home.isFetching) return;
    const failure = noteFailures.get(noteKey);
    if (failure !== undefined) setNoteState({ key: noteKey, error: failure });
    else writeNote(noteKey, li.id, li.name);
    // Asked for when Home's answer for this love interest and day has none.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [about, home.isFetching, noteKey]);

  // A new local day while Home is open brings a new note.
  const shownDay = useRef(day);
  useEffect(() => {
    if (shownDay.current === day) return;
    shownDay.current = day;
    void queryClient.invalidateQueries({ queryKey: homeQueryKey(runKey) });
  }, [day, queryClient, runKey]);

  const noteStatus: NoteStatus | null = note
    ? { kind: "ready", note }
    : noteState?.key === noteKey
      ? {
          kind: "failed",
          message: otome.errorMessage(noteState.error),
          onRetry: () => {
            if (!li) return;
            noteFailures.delete(noteKey);
            writeNote(noteKey, li.id, li.name);
          },
        }
      : about
        ? { kind: "writing" }
        : null;

  // ── Who is on Home: applied at once, saved, then read back (the look and note follow the choice) ──
  const saving = useRef(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const save = async (patch: Partial<HomeState>) => {
    const mine = ++saving.current;
    setSaveError(null);
    const key = homeQueryKey(runKey);
    await queryClient.cancelQueries({ queryKey: key });
    queryClient.setQueryData<HomeView>(key, (current) =>
      current
        ? {
            ...current,
            ...patch,
            // Another love interest: his note, faces and lines arrive with the next answer.
            ...(patch.li && patch.li !== current.li
              ? { note: null, faces: {}, lines: { ready: false }, rupture: false }
              : {}),
          }
        : current,
    );
    try {
      const { home: saved } = await otome.post<{ home: HomeState }>(`${runPath(runKey)}/home/set`, patch);
      if (mine !== saving.current) return;
      queryClient.setQueryData<HomeView>(key, (current) => (current ? { ...current, ...saved } : current));
    } catch (failure) {
      if (mine !== saving.current) return;
      setSaveError(otome.errorMessage(failure, "ui.otomeForge.home.saveFailed"));
    }
    if (mine === saving.current) void queryClient.invalidateQueries({ queryKey: key });
  };

  // ── Taps: a line written in advance, at once, with no request. Each love interest's own: picking another starts his
  // taps afresh, and a bubble shows only beside the one who said it. ──
  const taps = useRef<number[]>([]);
  const lastLine = useRef<string | null>(null);
  const [bubble, setBubble] = useState<{ id: number; li: LiId; text: string; mode: TapMode } | null>(null);
  const tapsFor = li?.id;
  useEffect(() => {
    taps.current = [];
    lastLine.current = null;
    setBubble(null);
  }, [tapsFor]);
  useEffect(() => {
    if (!bubble) return;
    const timer = setTimeout(() => setBubble((current) => (current?.id === bubble.id ? null : current)), BUBBLE_MS);
    return () => clearTimeout(timer);
  }, [bubble]);
  const onTap = (zone: TapZone) => {
    if (!li) return;
    const at = Date.now();
    taps.current = recordTap(taps.current, at);
    const mode = tapMode(taps.current, at, rupture);
    const own = tapPool(ownLines, zone, part, mode);
    const pool = own.length ? own : fallbackTapKeys(zone, mode).map((key) => t(key));
    const line = pickLine(pool, lastLine.current);
    if (!line) return;
    lastLine.current = line;
    setBubble((current) => ({ id: (current?.id ?? 0) + 1, li: li.id, text: line, mode }));
    setAnnounce(t("ui.otomeForge.home.said", { name: li.name, line }));
  };

  const [sheet, setSheet] = useState<"rough" | "pick" | null>(null);

  if (!li) return null;
  const said = bubble?.li === li.id ? bubble : null;

  // ── The figure. The cached look belongs to whoever it pictures: right after Him / Me flips, the other one's look is
  // still cached, so each side checks the URL before using it. His face from the note when painted (cut-out first). ──
  const cached = data?.look ?? null;
  const pictures = (url: string | undefined) => !!url && cached?.url === url;
  const face = note?.face ?? "";
  const painted = face ? faceArt(li, face) : null;
  const faceImage = face ? (about?.faces[face] ?? (painted ? { url: painted } : null)) : null;
  const himLook = li.portrait ? (pictures(li.portrait) ? cached : uncut(li.portrait)) : null;
  const herLook =
    cached && !pictures(li.portrait) && (cached.source === "avatar" || pictures(view.player.portrait))
      ? cached
      : view.player.portrait
        ? uncut(view.player.portrait)
        : null;
  const playerName = view.player.name || t("ui.otomeForge.home.me");
  const figureLabel = face
    ? t("ui.otomeForge.reader.faceOf", { name: li.name, face: t(FACE_LABEL_KEYS[face]) })
    : li.name;
  const unread = data?.unread ?? 0;
  const plainArt = toFigureArt(himLook);
  const himArt = faceImage ? toFigureArt(faceImage, plainArt) : plainArt;

  return (
    <div
      ref={parallax.ref}
      className="of-home"
      data-show={show}
      data-sky={sky}
      data-rupture={rupture ? "true" : undefined}
      data-figure={show === "him" && himArt?.kind === "look" ? "look" : "medallion"}
      style={{ "--of-li-accent": accent } as CSSProperties}
      onPointerMove={parallax.onPointerMove}
      onPointerLeave={parallax.onPointerLeave}
    >
      <HomeLayers sky={sky}>
        {show === "him" ? (
          <CutoutFigure
            key={`him-${li.id}`}
            who="him"
            name={li.name}
            accent={accent}
            art={himArt}
            label={figureLabel}
            face={face}
            mood={rupture ? "cold" : (said?.mode ?? "fond")}
            onTap={onTap}
          />
        ) : (
          // "He noticed: …" under her look arrives with the Wardrobe's Show him (M4).
          <CutoutFigure
            key="me"
            who="me"
            name={playerName}
            accent={PALETTE.rose}
            art={toFigureArt(herLook)}
            label={t("ui.otomeForge.home.figureMe", { name: playerName })}
          />
        )}
      </HomeLayers>

      <div className="of-home-top">
        {home.isError && !data ? (
          <div className="of-note of-note--alert" role="alert">
            <p className="of-note-quiet">{otome.errorMessage(home.error, "ui.otomeForge.home.loadFailed")}</p>
            <button type="button" className="of-note-button" onClick={() => void home.refetch()}>
              <RotateCcw size={14} strokeWidth={2.2} aria-hidden="true" />
              {t("ui.otomeForge.common.retry")}
            </button>
          </div>
        ) : noteStatus ? (
          <NoteCard
            key={li.id}
            runKey={runKey}
            liId={li.id}
            name={li.name}
            accent={accent}
            status={noteStatus}
            onReply={(quote) => onOpenPhone({ li: li.id, quote })}
          />
        ) : null}
      </div>

      <div className="of-home-middle">
        <div className="of-home-rail">
          <button type="button" className="of-home-action of-glass" onClick={() => onOpenPhone(null)}>
            <Smartphone size={17} strokeWidth={1.9} aria-hidden="true" />
            <span>{t("ui.otomeForge.common.screenPhone")}</span>
            {unread > 0 ? (
              <span className="of-home-badge">
                <span aria-hidden="true">{unread}</span>
                <span className="of-visually-hidden">{t("ui.otomeForge.home.unread", { count: unread })}</span>
              </span>
            ) : null}
          </button>
          <HimMeToggle name={li.name} show={show} onChange={(next) => void save({ show: next })} />
          <button type="button" className="of-home-action of-glass" onClick={() => setSheet("rough")}>
            <HeartHandshake size={17} strokeWidth={1.9} aria-hidden="true" />
            <span>{t("ui.otomeForge.home.roughDay")}</span>
          </button>
          <button type="button" className="of-home-action of-glass" onClick={() => setSheet("pick")}>
            <UsersRound size={17} strokeWidth={1.9} aria-hidden="true" />
            <span>{t("ui.otomeForge.home.whoIsHome")}</span>
          </button>
        </div>
        {said && show === "him" ? (
          <p
            key={said.id}
            className="of-home-bubble of-glass of-glass--strong"
            data-mode={said.mode}
            aria-hidden="true"
          >
            {said.text}
          </p>
        ) : null}
      </div>

      <div className="of-home-foot">
        {saveError ? (
          <p className="of-notice of-notice--error" role="alert">
            {saveError}
          </p>
        ) : null}
        <div className="of-home-plate of-glass">
          <h1 className="of-home-name" tabIndex={-1}>
            {show === "me" ? playerName : li.name}
          </h1>
          {show === "him" && note ? <MoodChip mood={note.mood} /> : null}
        </div>
      </div>

      <p className="of-visually-hidden" aria-live="polite">
        {announce}
      </p>

      {sheet === "rough" ? (
        <RoughDaySheet runKey={runKey} li={li} lines={ownLines} onClose={() => setSheet(null)} />
      ) : sheet === "pick" ? (
        <HomeLiPicker
          lis={view.lis}
          current={li.id}
          onClose={() => setSheet(null)}
          onOpenCast={onOpenCast}
          onOpenStories={onOpenStories}
          onPick={(picked) => {
            setSheet(null);
            if (picked !== li.id) void save({ li: picked });
          }}
        />
      ) : null}
    </div>
  );
}
