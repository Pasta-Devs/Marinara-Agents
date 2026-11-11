// ──────────────────────────────────────────────
// Otome Hearth: his side (#2155). A scene beside one big moment that the protagonist never saw (just before it, or
// right after they left), from the love interest's point of view, in Routes, at most once per story arc for each love
// interest, once he has reached Wound (HIS_SIDE_MIN_STAGE)
// ──────────────────────────────────────────────
// - The moments (the maintainer's "big moments only"): a route gate that moves his stage, a climax that ends in the
//   truth, a walkout, Opened up or Shut out, and a rift a repair chapter mends. Each is noted at its first play, in the
//   read's own revision-checked write (S/story/beats.ts finishBeat), only when that read counted the beat now and no
//   Ease off cut it (a climax eased off after its ending keeps its canon, so it counts). A Standoff, Almost, a side-with,
//   a closing decision or a date never counts.
// - "Arc" is the story arc (breathing arcs too): a main chapter's own, else the arc being played; 0 before the first.
//   Each love interest keeps one note per arc (`LiState.hisSide`), and the newest moment replaces it until his side of
//   that arc is written: its chapter `side-<li>-<arc>` spends the arc, so nothing more is noted for it. An unread side
//   of an earlier arc stays on offer. Runs from before this get theirs from their next moment: nothing is back-filled.
// - Routes offers it once the chapter the moment happened in is finished (hisSideOffers), and Read writes its chapter
//   with no model call (ensureHisSide, the first save wins, so two taps make one): kind "story", his own, one node with
//   him and the other love interests who were there, opening in the place the scene played in, so nothing new is
//   painted. No key image. Its one call is its scene, written by P6 as his side (S/prompts.ts beatMessages): only he
//   thinks, no choice is offered, his card and what stands between them are as they were then (stateAtMoment, from what
//   the note kept), and the scene as the protagonist lived it goes in the uncached last turn. It pays as any story beat
//   (30 Starlight) and moves nothing else.
// - It is part of the chapter it follows (the maintainer's): once read, the next chapter built after that one is given
//   it in full right after it, and afterwards it is summarized as that chapter's other side (S/story/canon.ts). The
//   read that finishes that chapter says it waits (S/story/beats.ts finishBeat).
import type {
  Beat,
  Chapter,
  Grievance,
  HisSideNote,
  LiId,
  RunState,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import {
  hisSideKey,
  type HisSideEntry,
  type HisSideMoment,
  HIS_SIDE_MIN_STAGE,
} from "../../../../../client/src/features/otome-forge/shared/arcs.js";
import { bondStoryLevel } from "../../../../../client/src/features/otome-forge/shared/bond.js";
import { OtomeForgeError } from "../http.js";
import { chapterId, runDocTarget } from "../ids.js";
import { readRun } from "../schemas/state.js";
import { normalizeChapter } from "../schemas/story.js";
import type { StoryArc } from "../schemas/story-arc.js";
import type { OtomeStore } from "../store.js";
import { arcCovering } from "./arc.js";
import { canonicalSegments, readBeat, readChapter, renderSegments } from "./canon.js";

const CLIMAX_MOMENTS: ReadonlySet<string> = new Set<HisSideMoment>(["truth", "walkout", "opened", "shut"]);

/** True when an Ease off cut the beat's canon (S/story/beats.ts cutShort): a climax eased off after its ending keeps it. */
const cutShort = (beat: Pick<Beat, "easedOff" | "confrontation">) => !!beat.easedOff && !beat.confrontation?.ending;

/** The chapter key of a moment's `ref` (`${key}/${i}`), and its beat. */
export const momentChapterKey = (ref: string) => ref.slice(0, ref.lastIndexOf("/"));
const momentBeat = (ref: string) => Number(ref.slice(ref.lastIndexOf("/") + 1));

/**
 * The love interest a read of `beat` could give a moment to, before the read (finishBeat reads whether his side of the
 * arc is written already only then): his gate or his repair's resolving node, or a climax's opponent; else null.
 */
export function momentCandidate(
  chapter: Pick<Chapter, "kind" | "li" | "nodes">,
  beat: Pick<Beat, "i" | "confrontation">,
): LiId | null {
  const node = chapter.nodes[beat.i];
  if (chapter.kind === "route" && node?.gate && chapter.li) return chapter.li;
  if (chapter.kind === "repair") return node?.resolves?.length && chapter.li ? chapter.li : null;
  return chapter.kind === "main" || chapter.kind === "route" ? (beat.confrontation?.li ?? null) : null;
}

/** The moment a read just counted makes (see the header), from what passGate and healRupture reported, or null. */
export function hisSideMomentOf(
  chapter: Pick<Chapter, "kind">,
  beat: Pick<Beat, "easedOff" | "confrontation">,
  { stageUp, repaired }: { stageUp?: { li: LiId } | null; repaired?: LiId | null },
): { li: LiId; moment: HisSideMoment } | null {
  if (cutShort(beat) || !["main", "route", "repair"].includes(chapter.kind)) return null;
  if (stageUp) return { li: stageUp.li, moment: "stage" };
  if (repaired) return { li: repaired, moment: "repair" };
  const game = beat.confrontation;
  return game?.ending && CLIMAX_MOMENTS.has(game.ending) ? { li: game.li, moment: game.ending as HisSideMoment } : null;
}

/** The story arc a moment in `chapter` belongs to (see the header). */
export function hisSideArc(chapter: Pick<Chapter, "kind" | "arc" | "number">, arcs: readonly StoryArc[]): number {
  if (chapter.kind !== "main") return arcs.at(-1)?.number ?? 0;
  return chapter.arc ?? (chapter.number ? arcCovering(arcs, chapter.number)?.number : undefined) ?? 0;
}

const isOpen = (grievance: Grievance) => grievance.status === "open" || grievance.status === "festering";

/**
 * The state with this moment as his of its arc, in place of an earlier one of that arc, with how things stood between
 * them once it had landed (`state` is the read's new state): his stage, trust, tension, open grievances and rupture.
 */
export function noteHisSide(
  state: RunState,
  li: LiId,
  moment: Pick<HisSideNote, "arc" | "ref" | "moment" | "at">,
): RunState {
  const current = state.lis[li];
  if (!current) return state;
  const { stage, trust, tension, rupture } = current;
  const open = current.grievances.filter(isOpen).map((grievance) => grievance.id);
  const note: HisSideNote = { ...moment, stage, trust, tension, open, rupture };
  const hisSide = [...current.hisSide.filter((entry) => entry.arc !== note.arc), note];
  return { ...state, lis: { ...state.lis, [li]: { ...current, hisSide } } };
}

/**
 * The state P6 writes his side with: his card and what stands between them as they were at the moment, so nothing
 * later reaches it: his stage (his card and slow burn), trust and tension, the grievances open then (as open, though
 * since mended), the rupture standing then, and only what he had been told and had noted about the protagonist by then.
 */
export function stateAtMoment(state: RunState, li: LiId, note: HisSideNote): RunState {
  const current = state.lis[li];
  if (!current) return state;
  const then = ({ at }: { at: string }) => at <= note.at;
  const grievances = current.grievances
    .filter((grievance) => note.open.includes(grievance.id))
    .map((grievance): Grievance => (isOpen(grievance) ? grievance : { ...grievance, status: "open" }));
  const { stage, trust, tension, rupture } = note;
  const known = current.known.filter(then);
  const disclosures = current.disclosures.filter(then);
  // 0.23.0: a bond story played after the moment goes too, so his card counts only the ranks he had reached then
  // (Dottore, #2254). No bond story can have been played before it: they open past his finale.
  const chapters = Object.fromEntries(
    Object.entries(state.chapters).filter(
      ([key, progress]) => bondStoryLevel(key, li) === null || !progress?.completed || progress.completed <= note.at,
    ),
  );
  return {
    ...state,
    chapters,
    lis: { ...state.lis, [li]: { ...current, stage, trust, tension, rupture, grievances, disclosures, known } },
  };
}

/**
 * Each love interest's side on offer in Routes (GET /runs/:run/story `hisSides`), in cast order, once he has reached
 * Wound (HIS_SIDE_MIN_STAGE): a moment noted at Wound or beyond whose chapter is finished, waiting, or its side being read (with the moment it was
 * written for). A finished side is left out; it
 * stays in the chapter list to replay.
 */
export function hisSideOffers(chapters: readonly Chapter[], state: RunState, cast: readonly LiId[]): HisSideEntry[] {
  return cast.flatMap((li) =>
    (state.lis[li]?.hisSide ?? []).flatMap((note): HisSideEntry[] => {
      const key = hisSideKey(li, note.arc);
      const side = chapters.find((chapter) => chapter.key === key);
      if (state.chapters[key]?.completed) return [];
      const told = side?.hisSide ?? note;
      // A moment noted below Wound (a save from before 0.18.2) never counts, whatever his stage now.
      if (told.stage < HIS_SIDE_MIN_STAGE) return [];
      const source = chapters.find((chapter) => chapter.key === momentChapterKey(told.ref));
      if (!source || !state.chapters[source.key]?.completed) return [];
      return [{ li, arc: note.arc, key, moment: told.moment, stage: told.stage, title: source.title, reading: !!side }];
    }),
  );
}

/** The scene a side tells again, as the protagonist lived it (its canon), and the place it opened in; null without one. */
export async function hisSideSource(
  store: Pick<OtomeStore, "readDoc">,
  runId: string,
  note: Pick<HisSideNote, "ref">,
  protagonist: string,
): Promise<{ text: string; place?: string } | null> {
  const beat = await readBeat(store, runId, momentChapterKey(note.ref), momentBeat(note.ref));
  const segments = beat && canonicalSegments(beat, protagonist);
  const text = segments ? renderSegments(segments).trim() : "";
  if (!text) return null;
  const place = segments!.find((segment) => segment.place?.trim())?.place;
  return { text, ...(place ? { place } : {}) };
}

const notFound = (what: string) => new OtomeForgeError(404, `No such ${what}.`, "not-found");
const NOT_YET = "This side is not ready to read yet.";

/**
 * POST /runs/:run/sides/:li {arc}: his side of that arc, written now with no model call when it has no chapter yet (see
 * the header); one already written is returned as it is. A 404 for an unknown run or love interest, a 409 `conflict`
 * while the world is forged, a 409 `locked` without a moment for that arc or before its chapter is finished.
 */
export async function ensureHisSide(
  deps: { store: OtomeStore },
  runId: string,
  li: LiId,
  arc: number,
): Promise<Chapter> {
  const key = hisSideKey(li, arc);
  const stored = await readChapter(deps.store, runId, key);
  if (stored) return stored;
  const run = await readRun(deps.store, runId);
  if (!run) throw notFound("Otome Forge run");
  const unit = run.units.find((candidate) => candidate.id === li && candidate.bible);
  const his = run.state.lis[li];
  if (!unit || !his) throw notFound("love interest");
  if (run.world.forge.phase !== "ready") throw new OtomeForgeError(409, "The world is still being forged.", "conflict");
  const note = his.hisSide.find((entry) => entry.arc === arc);
  if (note && note.stage < HIS_SIDE_MIN_STAGE) throw new OtomeForgeError(409, NOT_YET, "locked");
  const source = note ? await readChapter(deps.store, runId, momentChapterKey(note.ref)) : null;
  const scene =
    note && source && run.state.chapters[source.key]?.completed
      ? await hisSideSource(deps.store, runId, note, run.player.name)
      : null;
  if (!note || !source || !scene) throw new OtomeForgeError(409, NOT_YET, "locked");
  const name = unit.name;
  const others = (source.nodes[momentBeat(note.ref)]?.cast ?? []).filter((id) => id !== li && !!run.state.lis[id]);
  const chapter: Chapter = {
    key,
    kind: "story",
    li,
    lead: li,
    // The scene's own title and content tags, so its content card and Ease off's veils follow the scene it retells.
    title: source.title,
    tags: source.tags,
    summary: "",
    nodes: [
      {
        i: 0,
        kind: "beat",
        guide: `${name}'s side of "${source.title}": just before it, or right after the protagonist left, what the protagonist never saw.`,
        cast: [li, ...others],
        ...(scene.place ? { place: scene.place } : {}),
      },
    ],
    ledger: { relationship: [], conflict: [], offscreen: [] },
    plannedAt: new Date().toISOString(),
    connectionId: "",
    hisSide: note,
  };
  return (
    (await deps.store.mutateDoc(
      runDocTarget("chapter", chapterId(runId, key)),
      normalizeChapter,
      (current) => current ?? chapter,
    )) ?? chapter
  );
}
