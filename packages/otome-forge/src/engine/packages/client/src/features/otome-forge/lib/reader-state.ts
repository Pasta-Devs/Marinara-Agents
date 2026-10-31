// ──────────────────────────────────────────────
// Otome Forge: the reader's pure logic. A beat's mainline with each picked option's selection and branch spliced in,
// the choice waiting at a line, which lines were read before (skip-read), who is on stage with which face, how long
// Auto waits, and whose rupture holds a route chapter.
// ──────────────────────────────────────────────
// Choices follow the kit (player-choices-client.mjs): first play is canon. A big choice, once made, is kept on every
// read. A small choice picked on an earlier read is offered again on a replay, so its branches can be seen with no
// state change; on a resumed first read its canon pick is kept. An eased-off beat shows what the server's canon keeps:
// up to its cut, with a pick made at the cut, and nothing offered there.
import type {
  BeatState,
  BeatView,
  ChapterView,
  ChoiceOption,
  ConfrontationView,
  ForgeChoice,
  Grant,
  LiId,
  OtomeErrorCode,
  Paint,
  PlaceArt,
  RunLiView,
  Segment,
  WorldView,
} from "../shared/api-types";
import { CLIMAX_MOVES } from "../shared/arcs";
import { isFace, sameName, type Face } from "../shared/faces";
import { placeKey } from "../shared/places";

/** Milliseconds per character while a line types itself out (none under reduced motion). */
export const TYPE_MS = 22;

/** How long Auto waits after a line has finished typing: time to read it, within 1.6–9 s. */
export function autoDelay(text: string): number {
  return Math.min(9_000, 1_600 + 48 * Array.from(text).length);
}

/** The server's marker on an eased-off beat's canon; the reader shows its own aftermath line instead. */
const EASE_OFF_MARKER = "[The scene was cut short by the player.";

export type Picks = Record<string, string>;

export interface ReaderLine {
  /** The mainline segment the line belongs to (a selection and its branch share their choice's `at`). */
  main: number;
  /** The line's place in the reader (selection, branch and aftermath lines included). */
  kind: "segment" | "selection" | "branch" | "aftermath";
  segment: Segment;
  /** The choice and option a selection or branch line came from. */
  choiceId?: string;
  optionId?: string;
}

export interface Timeline {
  lines: ReaderLine[];
  /** Line index → the choice whose options follow that line, while it has no pick. */
  pending: Map<number, ForgeChoice>;
}

/** The option a choice shows as picked: a big choice's canon, a small choice's pick on this read. */
export function selectedOption(beat: Pick<BeatView, "choiceCanon">, choice: ForgeChoice, picks: Picks) {
  const id = choice.kind === "big" ? beat.choiceCanon[choice.id] : picks[choice.id];
  return choice.options.find((option) => option.id === id) ?? null;
}

/** The option first play made canon, if any (a replay marks it "Your first choice"). */
export function canonOption(beat: Pick<BeatView, "choiceCanon">, choice: ForgeChoice) {
  return choice.options.find((option) => option.id === beat.choiceCanon[choice.id]) ?? null;
}

/** The small-choice picks a beat opens with: its canon on a first read (resumed), none on a replay. */
export function initialPicks(beat: Pick<BeatView, "choiceCanon">, replay: boolean): Picks {
  return replay ? {} : { ...beat.choiceCanon };
}

/**
 * The lines in reading order: each mainline segment, then (when its choice has a pick) the protagonist's selection
 * and the option's branch. An eased-off beat stops at its cut and ends on the aftermath line. A choice at the cut
 * keeps the pick made before the Ease off (this read's, or else first play's), as the server's canon does
 * (S/story/canon.ts canonicalSegments), and offers nothing.
 */
export function buildTimeline(beat: BeatView, picks: Picks, protagonist: string): Timeline {
  const lines: ReaderLine[] = [];
  const pending = new Map<number, ForgeChoice>();
  const last = beat.segments.length - 1;
  const cut = beat.easedOff ? Math.min(Math.max(0, beat.easedOff.at), last) : last;
  for (let main = 0; main <= cut; main += 1) {
    const segment = beat.segments[main]!;
    if (segment.text.startsWith(EASE_OFF_MARKER)) continue;
    lines.push({ main, kind: "segment", segment });
    const choice = beat.choices.find((item) => item.at === main);
    if (!choice) continue;
    const atCut = !!beat.easedOff && main === cut;
    const option = selectedOption(beat, choice, picks) ?? (atCut ? canonOption(beat, choice) : null);
    if (!option) {
      if (!atCut) pending.set(lines.length - 1, choice);
      continue;
    }
    lines.push({
      main,
      kind: "selection",
      choiceId: choice.id,
      optionId: option.id,
      segment: {
        speaker: option.selection.kind === "dialogue" ? protagonist : "",
        text: option.selection.text,
        ...(segment.place ? { place: segment.place } : {}),
      },
    });
    for (const branch of option.segments) {
      lines.push({ main, kind: "branch", choiceId: choice.id, optionId: option.id, segment: branch });
    }
  }
  // A scene eased off from the declined panel has no lines: its aftermath stands at segment 0.
  if (beat.easedOff) lines.push({ main: Math.max(0, cut), kind: "aftermath", segment: { speaker: "", text: "" } });
  return { lines, pending };
}

/**
 * A line's ref, one per line of each version of a beat: `${base}/${segment}`, then `:${optionId}+n` for a picked
 * option's lines after its segment (its selection is +0), or `+aftermath`. `base` is `${chapterKey}/${node}r${rewrites}`.
 * The backlog's favourites and the voice cache key both use it.
 */
export function lineRef(timeline: Timeline, index: number, base: string): string {
  const line = timeline.lines[index];
  if (!line) return `${base}/0`;
  const first = timeline.lines.findIndex((item) => item.main === line.main && item.kind !== "segment");
  const own = line.kind === "segment" ? "" : line.optionId ? `:${line.optionId}+${index - first}` : `+${line.kind}`;
  return `${base}/${line.main}${own}`;
}

/** The choice id a Confrontation round's stances are offered under. */
export const stanceChoiceId = (round: number) => `round-${round}`;

/**
 * A climax game (a Confrontation, or a Closer: its view's `kind`) as a beat the reader plays like any other: its
 * mainline is the opening, each revealed round's lines, then the ending; each round ends on a choice of the game's four
 * moves, kept on every read once picked (first play is canon), so its line and the answer follow it. Rounds and the
 * ending are added as the server reveals them.
 */
export function confrontationBeat(view: ConfrontationView): BeatView {
  const moves = CLIMAX_MOVES[view.kind === "closer" ? "closer" : "confrontation"];
  const { li: _li, opening, rounds, ending, ...beat } = view;
  const segments: Segment[] = [...(Array.isArray(opening) ? opening : [])];
  const choices: ForgeChoice[] = [];
  const choiceCanon: Record<string, string> = {};
  for (const round of Array.isArray(rounds) ? rounds : []) {
    segments.push(...(Array.isArray(round.his) ? round.his : []));
    // A round with no lines of its own still needs a line for its stances to follow.
    if (!segments.length || choices.some((choice) => choice.at === segments.length - 1)) {
      segments.push({ speaker: "", text: "…" });
    }
    const id = stanceChoiceId(round.round);
    const options: ChoiceOption[] = moves.flatMap((stance) => {
      const option = round.options?.[stance];
      return option
        ? [{ id: stance, text: option.label, selection: option.selection, segments: option.segments ?? [] }]
        : [];
    });
    choices.push({ id, kind: "big", at: segments.length - 1, options });
    if (round.picked) choiceCanon[id] = round.picked;
  }
  if (ending) segments.push(...ending.segments);
  return { ...beat, segments, choices, choiceCanon };
}

/** What the beat route answers: the beat, and a Confrontation node's stance game beside it (M2b). */
export type BeatResponse = { beat?: BeatView; confrontation?: ConfrontationView };

/** The reader's beat for a route's answer; a Confrontation becomes a beat of stances, its view kept beside it. */
export function readerBeat(response: BeatResponse): { beat: BeatView; confrontation?: ConfrontationView } {
  const view = response?.confrontation;
  if (view && Array.isArray(view.rounds)) return { beat: confrontationBeat(view), confrontation: view };
  if (response?.beat) return { beat: response.beat };
  throw new Error("The beat route answered without a beat");
}

/** The record for a beat's place among `places`, matched by name (the server keys them by its own slug). */
export function placeEntry(places: Iterable<PlaceArt> | null | undefined, name: string | undefined): PlaceArt | null {
  if (!name || !places) return null;
  const key = placeKey(name);
  for (const entry of places) if (typeof entry?.name === "string" && placeKey(entry.name) === key) return entry;
  return null;
}

/** The world's places, as a list. */
export const worldPlaces = (world: WorldView): PlaceArt[] => Object.values(world.places ?? {});

/** A paint's image URL once it is ready. */
export const readyUrl = (paint: Paint | undefined | null): string | null =>
  paint?.state === "ready" && typeof paint.url === "string" && paint.url ? paint.url : null;

/** True when an earlier read already passed the line (the beat's `readThrough` is the furthest mainline read). */
export function lineRead(line: ReaderLine, readThrough: number): boolean {
  return line.main < readThrough;
}

/**
 * Where Skip-read lands from line `from`: the first line not read before, or the next line a choice waits at, or the
 * last line when everything ahead was read. `from` itself when nothing can be skipped.
 */
export function skipTarget(timeline: Timeline, from: number, readThrough: number): number {
  if (timeline.pending.has(from)) return from;
  let target = from;
  for (let index = from + 1; index < timeline.lines.length; index += 1) {
    target = index;
    if (!lineRead(timeline.lines[index]!, readThrough) || timeline.pending.has(index)) break;
  }
  return target > from && lineRead(timeline.lines[from + 1]!, readThrough) ? target : from;
}

/** Where a beat opens: at its start, or (resuming a first read) at the first line not read before. */
export function openingLine(timeline: Timeline, readThrough: number, replay: boolean): number {
  if (replay || readThrough <= 0 || !timeline.lines.length) return 0;
  return skipTarget(timeline, 0, readThrough);
}

/** The love interest a line's speaker names, if any. */
export function speakerLi<L extends Pick<RunLiView, "name">>(segment: Segment, lis: readonly L[]): L | null {
  return segment.speaker ? (lis.find((li) => sameName(segment.speaker, li.name)) ?? null) : null;
}

export type Voice =
  | { kind: "narration" }
  /** The protagonist speaking, or (thought) her thoughts. */
  | { kind: "protagonist"; thought: boolean }
  /** A love interest speaking, or (thought) his rare inner line. */
  | { kind: "li"; li: RunLiView; thought: boolean }
  | { kind: "other"; name: string; thought: boolean };

/** Who a line belongs to. A thought with no speaker is the protagonist's. */
export function voiceOf(segment: Segment, lis: readonly RunLiView[], protagonist: string): Voice {
  const thought = segment.thought === true;
  if (!segment.speaker.trim()) return thought ? { kind: "protagonist", thought } : { kind: "narration" };
  if (sameName(segment.speaker, protagonist)) return { kind: "protagonist", thought };
  const li = speakerLi(segment, lis);
  return li ? { kind: "li", li, thought } : { kind: "other", name: segment.speaker.trim(), thought };
}

export interface OnStage {
  /** The love interest the face plate shows, or null when the story has none to show yet. */
  li: RunLiView | null;
  /** His face on his latest line; "" for his plain portrait. */
  face: Face | "";
  /** True while the current line is his. */
  speaking: boolean;
}

/**
 * Who is on stage at line `at`: the love interest who spoke last (his face from that line; an untagged line shows his
 * plain portrait). Before a love interest's turn has been reached, show nobody: looking ahead would reveal a later
 * arrival during the opening narration.
 */
export function onStageAt(lines: readonly ReaderLine[], at: number, lis: readonly RunLiView[]): OnStage {
  for (let index = Math.min(at, lines.length - 1); index >= 0; index -= 1) {
    const segment = lines[index]!.segment;
    const li = speakerLi(segment, lis);
    if (li) return { li, face: isFace(segment.expression) ? segment.expression : "", speaking: index === at };
  }
  return { li: null, face: "", speaking: false };
}

/** The node a chapter opens at: the first not read to its end, or its start when every node was read. */
export function openingNode(beats: readonly { i: number; state: BeatState }[]): number {
  return beats.find((beat) => beat.state !== "read")?.i ?? 0;
}

/**
 * The love interest whose rupture holds this route chapter, when the server refused one of its scenes as `locked`: a
 * rupture keeps the next scene shut and the gate scene from being counted read until it is made right
 * (S/story/beats.ts ruptureHolds). Null for any other failure or chapter.
 */
export function ruptureHold(
  code: OtomeErrorCode | null,
  chapter: Pick<ChapterView, "kind" | "li"> | null | undefined,
): LiId | null {
  return code === "locked" && chapter?.kind === "route" && chapter.li ? chapter.li : null;
}

/** A read's grants, summed: Starlight, and each love interest's affection. */
export function sumGrants(grants: readonly Grant[]) {
  const affection = new Map<string, number>();
  let starlight = 0;
  for (const grant of grants) {
    starlight += grant.starlight ?? 0;
    if (grant.li && grant.affection) affection.set(grant.li, (affection.get(grant.li) ?? 0) + grant.affection);
  }
  return { starlight, affection: [...affection].map(([li, amount]) => ({ li, amount })) };
}
