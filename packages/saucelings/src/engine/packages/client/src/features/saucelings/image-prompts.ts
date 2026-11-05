import {
  SAUCELING_STAGES,
  type SaucelingDesign,
  type SaucelingPet,
  type SaucelingSpeciesId,
  type SaucelingStage,
} from "../../../../shared/src/features/agents/saucelings/types.js";
import {
  NEST_SCENE_PROMPT,
  SCENE_PROMPTS,
  temperamentOf,
  withArticle,
} from "../../../../shared/src/features/agents/saucelings/vocabulary.js";

/** Each species as the prompts that drew its sprites describe it, so a painting shows the same creature. */
export const PORTRAIT_SUBJECTS: Record<SaucelingSpeciesId, string> = {
  rigamuffin:
    "a little living rigatoni pasta tube: a short, upright, ridged tube of golden-yellow semolina pasta with a face on the front, tiny stubby arms and little feet, scruffy, with a couple of small tomato-sauce smudges",
  fluttino:
    "a little living farfalle (bow-tie) pasta in soft pink: its two pinched bow halves are its wings, with ruffled edges, and the face sits on the pinched middle; it hovers and never quite lands",
  lentino:
    "a little living linguine ribbon: one long, flat, green ribbon of pasta with a face near the top, its tail looped into a knot like a bow",
  shellbini:
    "a little living conchiglie (shell) pasta: a round, ridged, indigo-blue pasta shell with a soft pale-blue creature peeking out of the opening",
  tortellump:
    "a plump little living tortellini dumpling in tomato red: a folded, rounded dumpling with a pinched top fold, a face on the front and tiny arms",
  mossaboo:
    "a little mossy stone tortoise: a round grey stone lump on four stubby legs, its back covered in soft green moss, with a tiny red-capped mushroom growing on top, and a sleepy stone face with small dark eyes; its colours are stone grey, moss green, mushroom red",
  puddlepip:
    "a little raindrop frog: a small round frog made of clear-blue water, with a shiny raindrop-shaped head that comes to a point on top, big black eyes, little webbed feet and a floppy lily-pad hat; its colours are rain blue, lily green, sky white",
  snufflump:
    "a little woolly dust bunny: a soft round ball of beige fluff with two long floppy ears, a small pink nose, two button eyes nearly hidden in the fluff, and tiny feet poking out underneath; its colours are dust beige, nose pink, shadow brown",
  burrowl:
    "a little digging owl-mole: a round brown owl with big round goggle-like eyes, a short beak, soft feather tufts, and oversized pink mole paws for digging, with a bit of earth on its head; its colours are earth brown, paw pink, feather cream",
  prismite:
    "a little living crystal prism: a creature cut from clear faceted gemstone, its body a cluster of sharp translucent crystal spikes through which light splits into rainbow slivers, with two small bright eyes set in the largest facet and tiny crystal feet; its colours are clear crystal white, rainbow slivers, deep gem blue",
  thundrake:
    "a little storm-cloud dragon: a small four-legged dragon standing on four short legs, whose body is a dark puffy storm cloud, with two jagged yellow lightning-bolt horns, a long cloud tail that drips rain, bright electric eyes, and a few detached sparks crackling around it; its colours are storm grey, lightning yellow, rain blue",
  clockrit:
    "a little clockwork critter: a small round brass clockwork animal, like a wind-up toy mouse, with a big round ivory clock-face on its belly with two hands, a wind-up key on its back, two small bead eyes and a thin pendulum tail; its colours are brass gold, clock-face ivory, gear copper",
  wickwisp:
    "a little candle ghost: a small stub of pale dripping candle wax with two hollow dark eyes and a tiny mouth, and a little flame floating just above its head in place of hair, trailing a wisp of smoke; its colours are candle cream, flame orange, shadow violet",
  cauldrop:
    "a little walking cauldron: a small black iron cauldron on three stubby legs, brim-full of bubbling bright-purple potion, with a slimy potion face peering over the rim and bubbles popping above it; its colours are iron black, potion purple, bubble green",
  webbit:
    "a little cobweb spider with a lantern belly: a fluffy grey spider spun from cobweb thread, with eight thin legs, several small shining eyes, and a round belly that glows like a paper lantern in amber light; its colours are cobweb grey, lantern amber, night black",
};

/** Opens every sprite prompt, in short common tags: weaker models weight the first words most, and cannot measure
 *  pixels or count colours. The client reduces the palette and redraws the outline after the painting comes back. */
const SPRITE_STYLE =
  "Pixel art, 16-bit game sprite, chunky square pixels, thick dark outline, flat colours, limited palette.";
/** The face a creature's picture asks for; an egg's form leaves it out. */
const FACE_STYLE = "Simple, bold, readable face with small eyes and a small mouth.";
const PLAIN_BACKGROUND = "Plain flat white background.";

/** What every painting is asked to leave out. A model with no negative prompt of its own gets it from the Engine as
 *  "Do not include: ...", so the prompts say what to draw and never what not to. */
const NEGATIVE =
  "text, letters, numbers, labels, watermark, signature, border, frame, grid lines, UI, photo, realistic, 3D render, painting, smooth vector art, blurry, soft shading, gradient, anti-aliasing, dithering";
export const PORTRAIT_NEGATIVE = `${NEGATIVE}, human, person, cropped`;
/** A painting with the player's own instructions may show their caretaker, so "human, person" are not left out. */
export const portraitNegative = (instructions: string): string =>
  instructions.trim() ? `${NEGATIVE}, cropped` : PORTRAIT_NEGATIVE;
export const FORM_NEGATIVE = `${NEGATIVE}, shadow, ground, floor, scenery, multiple creatures, human, person`;
export const EGG_FORM_NEGATIVE = `${FORM_NEGATIVE}, face, eyes, mouth, nest`;
export const SHEET_NEGATIVE = `${NEGATIVE}, shadow, ground, scenery, overlapping drawings, human, person`;
export const FIGURE_NEGATIVE = `${NEGATIVE}, animal, pet, creature, shadow, ground, scenery, extra people, cropped`;
export const SCENE_NEGATIVE = `${NEGATIVE}, characters, people, person, creatures, animals, pets`;

/** What a single creature form must leave out, which depends on its stage. */
export const formNegative = (stage: SaucelingStage): string => (stage === "egg" ? EGG_FORM_NEGATIVE : FORM_NEGATIVE);

/** Said when a picture of the pet goes with the request, so the painting shows that creature and not a new one. It
 *  says "reference image" because a model that ignores pictures would draw a framed picture from "attached". */
export const REFERENCE_NOTE = "Same creature as the reference image: keep its shape, colours and markings.";

/** What the user's image connection is asked to paint. `withReference` says a picture of the pet is attached. The
 *  temperament shows as how it looks, never by its name, which would pull a picture toward sauce. `instructions` is
 *  the user's own words for the scene: they stand in for the plain background, which an Album painting never needs. */
export function portraitAppearance(pet: SaucelingPet, withReference: boolean, instructions = ""): string {
  const temper = temperamentOf(pet);
  const wish = instructions.replace(/\s+/gu, " ").trim();
  const stage = pet.lockedStage ?? pet.stage;
  const design = pet.design;
  // An invented creature's stage description already shows its age; a built-in one is aged by the prompt.
  const subject = design
    ? `${withArticle(design.kind)}: ${(design.stages[stage] ?? design.look).replace(/[.\s]+$/u, "")}; its colours are ${design.colours.join(", ")}`
    : PORTRAIT_SUBJECTS[pet.species];
  const age = design
    ? ""
    : stage === "elder"
      ? ", wearing little round spectacles and a few white whiskers"
      : stage === "hatchling"
        ? ", small and round"
        : "";
  return [
    SPRITE_STYLE,
    `A little virtual pet creature: ${subject}.`,
    `${temper ? `Its face and pose look ${temper.readsAs}. ` : ""}Life stage: ${stage}${age}.`,
    withReference ? REFERENCE_NOTE : "",
    FACE_STYLE,
    ...(wish
      ? [`Full body. ${wish.charAt(0).toUpperCase()}${wish.slice(1)}${/[.!?]$/u.test(wish) ? "" : "."}`]
      : ["One single creature, full body, centred.", PLAIN_BACKGROUND]),
  ]
    .filter(Boolean)
    .join(" ");
}

/** The most of a card's appearance text a caretaker's figure request carries. */
const FIGURE_APPEARANCE_CHARS = 400;

/** The drawings of the caretaker that every figure request shares, after the layout `drawings` that differs: what
 *  they look like and the pictures of them sent along. The layout leaves a wide white gap around each drawing so
 *  `figureFromSheet` can find them apart. */
function caretakerRequest(name: string, appearance: string, references: number, drawings: string[]): string {
  const look = appearance
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, FIGURE_APPEARANCE_CHARS)
    .replace(/[.\s]+$/u, "");
  return [
    SPRITE_STYLE,
    ...drawings,
    "Each one full body, standing, in the same outfit, with chibi game-sprite proportions: a big head, about three heads tall.",
    look ? `What ${name} looks like: ${look}.` : "",
    references > 0
      ? `Keep ${name}'s hair, face, outfit and colours from the reference image${references > 1 ? "s" : ""}.`
      : "",
    PLAIN_BACKGROUND,
  ]
    .filter(Boolean)
    .join(" ");
}

/** The caretaker drawn to stand in the Nook in the pets' style: eight drawings of them in two rows, in the order
 *  `figureFromSheet` reads them (caretaker-look.ts's FIGURE_POSES). `references` is how many pictures of them go
 *  with it. */
export function caretakerFigureRequest(name: string, appearance: string, references: number): string {
  return caretakerRequest(name, appearance, references, [
    `Eight drawings of the same character, ${name}, in two rows, all the same size and evenly spaced, with a wide gap of white around each one so no hair, tail, hand or held thing touches the next drawing.`,
    "The top row has five, seen from the front: calm; happy and smiling; worried; talking, mouth open and one hand raised a little; waving hello.",
    "The bottom row has three, seen from the side, facing the left edge of the picture and looking down: holding out a small bowl; holding out a small toy; reaching down gently with both hands.",
  ]);
}

/** The first three of the figure's poses (calm, happy, worried) in one row, for a model that cannot lay out eight
 *  drawings; `figureFromSheet` reads a figure of three from it. */
export function caretakerRowRequest(name: string, appearance: string, references: number): string {
  return caretakerRequest(name, appearance, references, [
    `Three drawings of the same character, ${name}, in one row, seen from the front, all the same size and evenly spaced, with a wide gap of white around each one so nothing touches the next drawing: calm; happy and smiling; worried.`,
  ]);
}

/** The image requests that may paint a caretaker's figure, in order, until one comes back readable. Pictures of the
 *  caretaker go with the first only: on A1111 or Forge a reference becomes the starting picture of the painting,
 *  which spoils a layout of several drawings, so the second asks again without. A weak model may still not manage
 *  eight drawings, so the player may allow a last request for three in a row. */
export function figureAttempts(
  name: string,
  appearance: string,
  references: string[],
  threeDrawingFallback: boolean,
): { prompt: string; references: string[] }[] {
  const attempts = [{ prompt: caretakerFigureRequest(name, appearance, references.length), references }];
  if (references.length > 0) attempts.push({ prompt: caretakerFigureRequest(name, appearance, 0), references: [] });
  if (threeDrawingFallback) attempts.push({ prompt: caretakerRowRequest(name, appearance, 0), references: [] });
  return attempts;
}

/** What goes with a form request as a reference: the creature at an earlier stage, or what it was before it
 *  evolved. */
export type FormReference = "earlier" | "before" | null;

const FORM_REFERENCE_NOTES: Record<Exclude<FormReference, null>, string> = {
  earlier: "Same creature as the reference image, at an earlier stage: keep its colours and markings as it grows.",
  before: "The reference image shows what this creature was before it evolved: keep a hint of its colours.",
};

/** The full request for one stage's form of an invented sauceling, cut out of its plain background afterwards. */
export function formRequest(design: SaucelingDesign, stage: SaucelingStage, reference: FormReference): string {
  const subject = (design.stages[stage] ?? design.look).replace(/[.\s]+$/u, "");
  return [
    SPRITE_STYLE,
    stage === "egg"
      ? `The egg of a small creature, ${withArticle(design.kind)}: ${subject}.`
      : `A small creature, ${withArticle(design.kind)}, at its ${stage} stage: ${subject}.`,
    `Its colours are ${design.colours.join(", ")}.`,
    reference ? FORM_REFERENCE_NOTES[reference] : "",
    stage === "egg"
      ? "One single egg with no face, upright and centred, filling most of the picture."
      : `${FACE_STYLE} One single creature, full body, seen from the front and centred, filling most of the picture.`,
    PLAIN_BACKGROUND,
  ]
    .filter(Boolean)
    .join(" ");
}

/** The stages one life sheet draws, a row each in this order: every stage of a found sauceling, adult and elder
 *  of an evolved one. */
export function sheetStages(design: SaucelingDesign): SaucelingStage[] {
  return SAUCELING_STAGES.filter((stage) => design.stages[stage]);
}

const SHEET_STYLE =
  "The same pixel size, palette and line weight in every drawing. Simple, bold, readable faces with small eyes and a small mouth.";
const SHEET_BACKGROUND = "Plain flat white background everywhere.";

/** The full request for a life sheet: one square picture with a row per stage (see `sheetStages`), two eggs (whole
 *  and cracking) in the egg row and four drawings in each other row (happy, content and grumpy from the front,
 *  then calm in side profile), which `readSheet` cuts into every stage's forms. */
export function sheetRequest(design: SaucelingDesign, reference: FormReference): string {
  const stages = sheetStages(design);
  const text = (stage: SaucelingStage) => (design.stages[stage] ?? design.look).replace(/[.\s]+$/u, "");
  const withEgg = stages[0] === "egg";
  const total = stages.reduce((sum, stage) => sum + (stage === "egg" ? 2 : 4), 0);
  const rows = stages.map((stage, index) =>
    stage === "egg"
      ? `Row ${index + 1}, the egg, only two drawings. Left: the whole egg, ${text(stage)}. Next to it: the same egg beginning to crack, with one jagged crack and a small chip lifting off; nothing shows through. Both eggs have NO face: no eyes, no mouth, no expression, and they are the same size.`
      : `Row ${index + 1}, ${stage}, four drawings: ${text(stage)}.`,
  );
  const gaps =
    "and no more, never a repeat, evenly spaced, with wide empty white gaps between every drawing and between the rows, so nothing in one row touches the row above or below (flames, drips and tails included).";
  return [
    `${SPRITE_STYLE} A sprite sheet of one small creature, ${withArticle(design.kind)}: ${design.look} Its colours are ${design.colours.join(", ")}.${reference ? ` ${FORM_REFERENCE_NOTES[reference]}` : ""}`,
    "",
    withEgg
      ? `Lay out ${total} drawings in ${stages.length} rows: exactly two drawings in row 1 and exactly four drawings in each of rows 2 to ${stages.length}, ${gaps}`
      : `Lay out ${total} drawings in ${stages.length} rows: exactly four drawings in each row, ${gaps}`,
    ...rows,
    "",
    `${withEgg ? `In rows 2 to ${stages.length}` : "In every row"}, left to right: first the creature happy, seen from the front, with a big smile and its arms or limbs raised, feet on the ground; second the creature content, seen from the front, standing upright and calm with a small smile; third the creature grumpy, seen from the front, frowning and cross; fourth the same creature calm, seen in side profile facing right, like a walking game sprite, so one eye and one side show. Do not write these words or any label on the picture. All four drawings in a row are the same creature at the same stage, in the same colours, at the same size and with the same body shape; only the face and pose change. ${withEgg ? "Growth must read clearly: the hatchling is small and round and the elder is full size." : "The elder is as big as the adult and looks older."}`,
    "",
    SHEET_STYLE,
    "",
    SHEET_BACKGROUND,
  ].join("\n");
}

/** Where a new background's prompt starts: the nest for an egg, a room in an invented sauceling's own colours (its
 *  species is hidden, so its species' background would not fit), else its species' built-in background. */
export function startingScene(pet: Pick<SaucelingPet, "stage" | "species" | "design">): string {
  if (pet.stage === "egg") return NEST_SCENE_PROMPT;
  if (!pet.design) return SCENE_PROMPTS[pet.species];
  const [first, second, third] = pet.design.colours;
  return `a cosy little room in ${first}, ${second} and ${third} tones: a small round window, a low shelf of curious trinkets, soft cushions and a woven rug`;
}

/** Opens a background's prompt, in the same short tags as the sprites'. */
const SCENE_STYLE = "Pixel art, 16-bit game background, chunky square pixels, flat colours, limited palette.";

/** The full request for a background: the style, then the picture the user asked for laid out so it matches the
 *  sprites and leaves room to walk. */
export function sceneRequest(subject: string): string {
  return `${SCENE_STYLE} A wide side-on scene of ${subject.trim().replace(/[.\s]+$/u, "")}, seen like a stage set: the back wall and scenery across the top, and an empty, flat, evenly lit floor along the bottom from edge to edge.`;
}
