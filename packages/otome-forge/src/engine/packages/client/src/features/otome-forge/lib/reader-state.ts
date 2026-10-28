// ──────────────────────────────────────────────
// Otome Forge: the reader's pure logic. A beat's mainline with each picked option's selection and branch spliced in,
// the choice waiting at a line, which lines were read before (skip-read), who is on stage with which face, and how
// long Auto waits.
// ──────────────────────────────────────────────
// Choices follow the kit (player-choices-client.mjs): first play is canon. A big choice, once made, is kept on every
// read. A small choice picked on an earlier read is offered again on a replay, so its branches can be seen with no
// state change; on a resumed first read its canon pick is kept.
import type { BeatState, BeatView, ForgeChoice, Grant, RunLiView, Segment } from "../shared/api-types";
import { isFace, sameName, type Face } from "../shared/faces";

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
 * and the option's branch. An eased-off beat stops at its cut and ends on the aftermath line.
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
    if (beat.easedOff && main === cut) break;
    const choice = beat.choices.find((item) => item.at === main);
    if (!choice) continue;
    const option = selectedOption(beat, choice, picks);
    if (!option) {
      pending.set(lines.length - 1, choice);
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
 * plain portrait). Before anyone has, the first one who speaks later in the beat, with his plain portrait: the
 * narrator voices only the love interests present, so a beat where none speaks shows nobody.
 */
export function onStageAt(lines: readonly ReaderLine[], at: number, lis: readonly RunLiView[]): OnStage {
  for (let index = Math.min(at, lines.length - 1); index >= 0; index -= 1) {
    const segment = lines[index]!.segment;
    const li = speakerLi(segment, lis);
    if (li) return { li, face: isFace(segment.expression) ? segment.expression : "", speaking: index === at };
  }
  for (const line of lines.slice(Math.max(0, at + 1))) {
    const li = speakerLi(line.segment, lis);
    if (li) return { li, face: "", speaking: false };
  }
  return { li: null, face: "", speaking: false };
}

/** The node a chapter opens at: the first not read to its end, or its start when every node was read. */
export function openingNode(beats: readonly { i: number; state: BeatState }[]): number {
  return beats.find((beat) => beat.state !== "read")?.i ?? 0;
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
