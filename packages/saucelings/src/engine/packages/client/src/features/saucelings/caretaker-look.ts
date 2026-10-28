import type {
  SaucelingCaretakerOutcome,
  SaucelingEvent,
  SaucelingStateResponse,
  SaucelingUserAction,
} from "../../../../shared/src/features/agents/saucelings/types.js";

/** How a caretaker's Engine sprite looks: worried when a gap is open, happy after good news. */
export type CaretakerMoment = "worried" | "happy" | "neutral";

/** What a painted caretaker figure is doing, in the order of its frames: five facing the viewer, then three side
 *  views facing the pet on their left. A figure painted before 0.6.0 has only the first three. */
export const FIGURE_POSES = ["calm", "happy", "worried", "talking", "waving", "feeding", "playing", "tending"] as const;
export type CaretakerPose = (typeof FIGURE_POSES)[number];

/** Words in an expression's file name that mean each moment, best match first. */
const MOMENT_WORDS: Record<CaretakerMoment, readonly string[]> = {
  worried: ["worried", "concerned", "sad", "anxious"],
  happy: ["happy", "smile", "laugh", "joy"],
  neutral: ["neutral", "idle", "default", "calm"],
};

/** The Engine names its full-body sprites full_<pose>; the rest are expression sprites. */
const FULL_BODY = /^full[_-]/iu;

type Sprite = { expression: string; url: string };

/** The first sprite whose file name has one of the moment's words; a worried or happy look the character lacks
 *  falls back to neutral. */
function matchMoment(sprites: ReadonlyArray<Sprite>, moment: CaretakerMoment): string | null {
  for (const wanted of moment === "neutral" ? (["neutral"] as const) : ([moment, "neutral"] as const)) {
    for (const word of MOMENT_WORDS[wanted]) {
      const hit = sprites.find((sprite) => sprite.expression.toLowerCase().includes(word));
      if (hit) return hit.url;
    }
  }
  return null;
}

/** The sprite the caretaker stands in the scene as: an expression sprite, or a full-body one when they have only
 *  those, that fits the moment, else their neutral one, else any. Null only for a character with no sprites (the
 *  message box then shows their avatar), so a caretaker who stands keeps standing and only their look changes. */
export function pickStandingSprite(sprites: ReadonlyArray<Sprite>, moment: CaretakerMoment): string | null {
  const expressions = sprites.filter((sprite) => !FULL_BODY.test(sprite.expression));
  const pool = expressions.length > 0 ? expressions : sprites;
  return matchMoment(pool, moment) ?? pool[0]?.url ?? null;
}

/** The pose for care of the pet, theirs or yours. */
const CARE_POSES: Partial<Record<SaucelingUserAction, CaretakerPose>> = {
  feed: "feeding",
  play: "playing",
  rest: "tending",
  pet: "tending",
  warm: "tending",
  talk: "talking",
};

/** What the caretaker is doing now: their care, or yours, while it plays on the stage; waving through a hello, as it is
 *  written and typed out; happy for a moment after good news or a gap you fill; talking through any other line;
 *  worried while a gap is open or the line is about time away; else calm. Only those moments last, so a line
 *  never holds a look once it is said. */
export function caretakerPose({
  gaps,
  line,
  speaking,
  cheering,
  caring,
}: {
  gaps: Pick<SaucelingStateResponse["gaps"], "hunger" | "mood" | "warmth">;
  /** Their newest line. */
  line: Pick<SaucelingEvent, "kind"> | null;
  /** That line is being written or typing out. */
  speaking: boolean;
  cheering: boolean;
  /** The care that plays on the stage now: theirs, or yours from a care button. */
  caring: SaucelingUserAction | null;
}): CaretakerPose {
  const care = caring && CARE_POSES[caring];
  if (care) return care;
  if (speaking && (line?.kind === "caretaker-change" || line?.kind === "return-from-album")) return "waving";
  if (cheering) return "happy";
  if (speaking) return "talking";
  if (gaps.hunger || gaps.mood || gaps.warmth || line?.kind === "absence") return "worried";
  return "calm";
}

/** Who stands on the stage for a pose: their painted figure at the pose's frame, breathing with the blink drawn
 *  over it once `motion` is made (see useCaretakerMotion; `rows` says the picture has its squashed row), else the
 *  Engine sprite with its look. Nobody while the figure loads (`figure` undefined), so a sprite never flashes
 *  before it, or when they have neither. */
export function standingCaretaker(
  figure: { image: string; frames: number } | null | undefined,
  sprites: ReadonlyArray<Sprite>,
  pose: CaretakerPose,
  motion: { body: string; blink: string | null } | null = null,
): { figure: string; rows: 1 | 2; frames: number; frame: number; blink: string | null } | { src: string } | null {
  if (figure) {
    return {
      figure: motion?.body ?? figure.image,
      rows: motion ? 2 : 1,
      frames: figure.frames,
      frame: figureFrame(pose, figure.frames),
      blink: motion?.blink ?? null,
    };
  }
  const src = figure === null ? pickStandingSprite(sprites, poseMoment(pose)) : null;
  return src ? { src } : null;
}

/** The look an Engine sprite has for a pose: a caretaker without a figure keeps their sprites. */
export function poseMoment(pose: CaretakerPose): CaretakerMoment {
  if (pose === "worried") return "worried";
  return pose === "calm" || pose === "talking" ? "neutral" : "happy";
}

/** The frame of a figure with `frames` frames for a pose; a figure painted before 0.6.0 shows the look of its
 *  three. */
export function figureFrame(pose: CaretakerPose, frames: number): number {
  const index = FIGURE_POSES.indexOf(pose);
  return index < frames ? index : ["neutral", "happy", "worried"].indexOf(poseMoment(pose));
}

/** The care effect the stage plays for the caretaker's own care; a meal they forgot, an egg they let cool and a
 *  milestone they noticed have none. */
const CARE_EFFECTS: Partial<Record<SaucelingCaretakerOutcome, SaucelingUserAction>> = {
  "fed-fine": "feed",
  "fed-badly": "feed",
  overfed: "feed",
  played: "play",
  cuddled: "pet",
  "kept-warm": "warm",
  chatted: "talk",
};

export function caretakerCareAction(outcome: SaucelingCaretakerOutcome | undefined): SaucelingUserAction | null {
  return (outcome && CARE_EFFECTS[outcome]) ?? null;
}
