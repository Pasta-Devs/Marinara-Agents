// ──────────────────────────────────────────────
// Otome Forge: the prologue (maintainer request, 2026-10-29)
// ──────────────────────────────────────────────
// A one-scene chapter, key `prologue`, that Begin opens in the reader: the protagonist alone in their own life just
// before the forge's opening situation, ending as it begins. It is a scene like any other (places painted, music,
// voices, faces, choices whose first pick is canon), with three rules of its own:
//   - no love interest appears, speaks or is named (beatMessages frames it; prologueProblem sends a reply that names one
//     back for the repair turn), so it has no Lead, and pays its beat's Starlight but no affection (rewards.ts);
//   - no love interest may know it (canon.ts audienceOf gives it the empty Lead), as none of them was there;
//   - chapter 1's first scene is given its canon, the choices taken included, to pick up from (beats.ts).
// POST /runs/:run/prologue makes the chapter without a model call; its scene is written when the reader asks for it.
import type { Chapter, Segment, Unit } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { readOrGenerate } from "../generation.js";
import { OtomeForgeError } from "../http.js";
import { PROLOGUE_KEY, chapterId, runDocTarget, stateId } from "../ids.js";
import { normalizeState, readRun } from "../schemas/state.js";
import { normalizeChapter } from "../schemas/story.js";
import type { OtomeStore } from "../store.js";

/** How much of the prologue's canon chapter 1's first scene is given. */
const ENDING_CHARS = 1800;

const GUIDE =
  "The prologue: an ordinary stretch of the protagonist's own life in this world, just before the story opens. Show who they are through what they do and choose.";

/** The prologue chapter, made once; 409 `conflict` while the world is still being forged. */
export async function ensurePrologue(deps: { store: OtomeStore }, runId: string): Promise<Chapter> {
  const read = () => deps.store.readDoc(chapterId(runId, PROLOGUE_KEY), normalizeChapter);
  return readOrGenerate(runId, read, async () => {
    const run = await readRun(deps.store, runId);
    if (!run) throw new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
    if (run.world.forge.phase !== "ready") {
      throw new OtomeForgeError(409, "The world is still being forged.", "conflict");
    }
    const chapter: Chapter = {
      key: PROLOGUE_KEY,
      kind: "prologue",
      lead: "",
      title: run.world.title,
      tags: [],
      summary: "",
      nodes: [{ i: 0, kind: "beat", guide: GUIDE, cast: [] }],
      ledger: { relationship: [], conflict: [], offscreen: [] },
      plannedAt: new Date().toISOString(),
      connectionId: "",
    };
    const saved = await deps.store.mutateDoc(
      runDocTarget("chapter", chapterId(runId, PROLOGUE_KEY)),
      normalizeChapter,
      (current) => current ?? chapter,
    );
    await deps.store.updateDoc(runDocTarget("state", stateId(runId)), normalizeState, (state) =>
      state.chapters[PROLOGUE_KEY]
        ? state
        : {
            ...state,
            chapters: { ...state.chapters, [PROLOGUE_KEY]: { beatsRead: 0, completed: null, applied: [] } },
          },
    );
    return saved ?? chapter;
  });
}

/** A love interest's name as a whole word, any case. */
function namedIn(text: string, name: string): boolean {
  const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return !!escaped && new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "iu").test(text);
}

/** What to send back when the prologue's scene shows or names a love interest, or null. */
export function prologueProblem(
  segments: readonly Pick<Segment, "speaker" | "text">[],
  units: readonly Pick<Unit, "name">[],
): string | null {
  for (const unit of units) {
    if (segments.some((segment) => namedIn(segment.speaker, unit.name) || namedIn(segment.text, unit.name))) {
      return `${unit.name} is a love interest: the prologue is the protagonist's alone, so never show or name them`;
    }
  }
  return null;
}

/** The prologue's own framing in its scene's user turn (beatMessages). */
export function prologueFraming(openingSituation: string, units: readonly Pick<Unit, "name">[]): string[] {
  return [
    "This is the PROLOGUE: the protagonist is alone in their own life, before the story begins. Anyone else who speaks belongs to that life (a neighbour, a colleague, a stranger).",
    "Show who the protagonist is through what they do: what they are good at, what they want and what they lack. Their traits and goal show in action, never as a list.",
    "Offer choices about who the protagonist is (how they meet a small trouble, what they put first); what is picked is who they are from now on.",
    `No love interest appears, speaks, is named or is hinted at: the story meets them in chapter 1. Never name ${units.map((unit) => unit.name).join(", ")}.`,
    openingSituation.trim()
      ? `End where the story opens, right after the prologue, without playing it out: ${openingSituation.trim()}`
      : "End where the story is about to begin.",
  ];
}

/** The prologue's canon as chapter 1's first scene is given it, or "" without a written one. */
export function prologueEnding(canon: string | null): string {
  const text = (canon ?? "").trim();
  return text.length > ENDING_CHARS ? `…${text.slice(-ENDING_CHARS)}` : text;
}
