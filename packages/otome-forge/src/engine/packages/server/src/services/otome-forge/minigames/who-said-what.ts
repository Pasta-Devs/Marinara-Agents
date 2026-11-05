// ──────────────────────────────────────────────
// Otome Forge: Who said what? (#2041). While a scene is written, the player may guess which love interest said a line
// from the story already read. No model call, no write, nothing rewarded or recorded: the client keeps the round's
// right or wrong on screen only.
// ──────────────────────────────────────────────
// Lines come only from what the player read along the path they played: the first-play canon (S/story/canon.ts
// canonicalSegments: picked options and their branches, the stances taken and the ending reached; never an option not
// taken) of every completed chapter (completedChapters: never the prologue, an extra story or a chapter still being
// read or written). A chapter whose canon is not settled is left out whole, as the memory leaves it out.
// A line counts when it is spoken (no thought, no narration), not by the protagonist, and by exactly one love interest
// under their current name or its first word (SH/faces.ts sameName, as the reader and the narrator's checks match
// speakers); a line under an old name or a first name two of them share is skipped, never guessed. Lines too short to
// recognize are skipped, long ones cut with an ellipsis, and each is asked once (one two of them both said, never).
// The choices are the love interests with a line, in cast order; with fewer than two, or too few lines, there is no
// game. The batch draws a random line from a random love interest each time, so a quiet one still comes up.
import { randomInt } from "node:crypto";
import type {
  LiId,
  Segment,
  Unit,
  WhoSaidWhatView,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { sameName } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import { OtomeForgeError } from "../http.js";
import { readRun } from "../schemas/state.js";
import type { OtomeStore } from "../store.js";
import { canonicalSegments, completedChapters, readBeat } from "../story/canon.js";

/** Lines served per wait: more than a scene's write usually allows. */
export const WHO_SAID_WHAT_BATCH = 24;
/** Letters or digits a line needs to be recognizable ("Say it, then." has 9); counted so CJK lines count too. */
const LETTERS_MIN = 12;
/** Characters (code points) a line keeps before it is cut with an ellipsis, so a speech still fits a phone's round. */
const TEXT_MAX = 160;
/** Lines the run needs before there is a game at all. */
const LINES_MIN = 6;

/**
 * The line cut at a word before TEXT_MAX with an ellipsis (a plain cut for a script without spaces), by code point so an
 * emoji or a rare CJK character is never split in half.
 * ponytail: a cluster of several code points (a joined emoji, a combining mark) may still lose its tail at the cut; the
 * upgrade path is cutting by Intl.Segmenter graphemes.
 */
function shortened(text: string): string {
  const characters = [...text];
  if (characters.length <= TEXT_MAX) return text;
  const cut = characters.slice(0, TEXT_MAX).join("");
  const atWord = cut.replace(/\s+\S*$/u, "");
  return `${atWord.length >= TEXT_MAX / 2 ? atWord : cut}…`;
}

/** The game for these segments (see the header); both lists empty when there is too little to play. */
export function pickWhoSaidWhat(
  segments: Iterable<Segment>,
  units: ReadonlyArray<Pick<Unit, "id" | "name">>,
  protagonist: string,
  random: (below: number) => number = randomInt,
): WhoSaidWhatView {
  // Each line once, by what it says; null once two love interests said it.
  const said = new Map<string, { li: LiId; text: string } | null>();
  for (const segment of segments) {
    const speaker = segment.speaker.trim();
    if (segment.thought || !speaker || sameName(speaker, protagonist)) continue;
    const owners = units.filter((unit) => sameName(speaker, unit.name));
    if (owners.length !== 1) continue;
    const text = segment.text.replace(/\s+/gu, " ").trim();
    if ((text.match(/[\p{L}\p{N}]/gu)?.length ?? 0) < LETTERS_MIN) continue;
    const li = owners[0]!.id;
    const key = text.normalize("NFKC").toLowerCase();
    const known = said.get(key);
    said.set(key, known === undefined ? { li, text: shortened(text) } : known?.li === li ? known : null);
  }
  const pools = new Map<LiId, string[]>();
  for (const line of said.values()) {
    if (line) pools.set(line.li, [...(pools.get(line.li) ?? []), line.text]);
  }
  const choices = units.map((unit) => unit.id).filter((id) => pools.has(id));
  const total = [...pools.values()].reduce((sum, pool) => sum + pool.length, 0);
  if (choices.length < 2 || total < LINES_MIN) return { choices: [], lines: [] };
  for (const pool of pools.values()) {
    for (let index = pool.length - 1; index > 0; index -= 1) {
      const other = random(index + 1);
      [pool[index], pool[other]] = [pool[other]!, pool[index]!];
    }
  }
  const lines: WhoSaidWhatView["lines"] = [];
  while (lines.length < WHO_SAID_WHAT_BATCH) {
    const open = choices.filter((id) => pools.get(id)!.length);
    if (!open.length) break;
    const li = open[random(open.length)]!;
    lines.push({ li, text: pools.get(li)!.pop()! });
  }
  return { choices, lines };
}

/**
 * GET /runs/:run/who-said-what: a fresh batch from the run's completed chapters; 404 for an unknown run.
 * ponytail: every completed beat is read again on each wait (about one document per node). The upgrade path is a cache
 * per store version, as S/memory/memory.ts keptSources keeps the memory's sources.
 */
export async function whoSaidWhat(
  deps: { store: Pick<OtomeStore, "readDoc"> },
  runId: string,
): Promise<WhoSaidWhatView> {
  const { store } = deps;
  const run = await readRun(store, runId);
  if (!run) throw new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
  const protagonist = run.player.name;
  const chapters = await completedChapters(store, runId, run.state);
  const canon = await Promise.all(
    chapters.map(async ({ chapter }) => {
      const beats = await Promise.all(chapter.nodes.map((_, i) => readBeat(store, runId, chapter.key, i)));
      const parts = beats.map((beat) => beat && canonicalSegments(beat, protagonist));
      return parts.every(Boolean) ? parts.flatMap((part) => part!) : [];
    }),
  );
  return pickWhoSaidWhat(canon.flat(), run.units, protagonist);
}
