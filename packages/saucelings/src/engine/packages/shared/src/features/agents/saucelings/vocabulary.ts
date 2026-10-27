import {
  PASTA_SPECIES,
  SAUCELING_STAGES,
  type SaucelingBackground,
  type SaucelingCareProfile,
  type SaucelingDesign,
  type SaucelingEventKind,
  type SaucelingMood,
  type SaucelingOwnTemperament,
  type SaucelingPet,
  type SaucelingSpeciesId,
  type SaucelingStage,
  type SaucelingTemperamentId,
} from "./types.js";

export interface SpeciesInfo {
  id: SaucelingSpeciesId;
  name: string;
  origin: string;
  look: string;
  defaultTraits: string[];
}

export const SPECIES_CATALOG: Record<SaucelingSpeciesId, SpeciesInfo> = {
  rigamuffin: {
    id: "rigamuffin",
    name: "Rigamuffin",
    origin: "rigatoni + ragamuffin",
    look: "scruffy little tube with ridges, always slightly grubby",
    defaultTraits: ["ridged-hide", "crumb-collector", "sturdy", "curious"],
  },
  fluttino: {
    id: "fluttino",
    name: "Fluttino",
    origin: "farfalle + flutter",
    look: "bow-shaped wings, hovers, never quite lands",
    defaultTraits: ["hover-drift", "bow-winged", "breezy", "restless"],
  },
  lentino: {
    id: "lentino",
    name: "Lentino",
    origin: "linguine / lentil + -ino",
    look: "long, thin, loops itself into knots when happy",
    defaultTraits: ["knot-tier", "slender", "springy", "affectionate"],
  },
  shellbini: {
    id: "shellbini",
    name: "Shellbini",
    origin: "conchiglie + shell",
    look: "shelled, hides inside when sulky",
    defaultTraits: ["pocket-shell", "peeker", "shy-sweet", "echo-hum"],
  },
  tortellump: {
    id: "tortellump",
    name: "Tortellump",
    origin: "tortellini + lump",
    look: "plump folded dumpling with a pinched dimple on top, rolls instead of walking",
    defaultTraits: ["roly-poly", "stuffed-snug", "dimpled", "homebody"],
  },
  mossaboo: {
    id: "mossaboo",
    name: "Mossaboo",
    origin: "moss + peekaboo",
    look: "round mossy stone on stubby legs, a tiny mushroom on top, never in a hurry",
    defaultTraits: ["moss-backed", "slow", "patient", "cosy"],
  },
  puddlepip: {
    id: "puddlepip",
    name: "Puddlepip",
    origin: "puddle + pip",
    look: "clear-blue raindrop frog in a lily-pad hat, ripples when it giggles",
    defaultTraits: ["raindrop-headed", "splashy", "happy", "noisy"],
  },
  snufflump: {
    id: "snufflump",
    name: "Snufflump",
    origin: "snuffle + lump",
    look: "round ball of beige fluff with floppy ears, puffs up when startled",
    defaultTraits: ["fluff-ball", "sleepy", "cuddly", "nervous"],
  },
  burrowl: {
    id: "burrowl",
    name: "Burrowl",
    origin: "burrow + owl",
    look: "round brown owl with goggle eyes and big pink digging paws",
    defaultTraits: ["big-pawed", "busy", "wise", "messy"],
  },
  prismite: {
    id: "prismite",
    name: "Prismite",
    origin: "prism + -ite",
    look: "cluster of clear crystal spikes that splits light into rainbows",
    defaultTraits: ["faceted", "proud", "sparkly", "aloof"],
  },
  thundrake: {
    id: "thundrake",
    name: "Thundrake",
    origin: "thunder + drake",
    look: "little storm-cloud dragon with lightning horns and a rainy tail",
    defaultTraits: ["spark-horned", "stormy", "bold", "moody"],
  },
  clockrit: {
    id: "clockrit",
    name: "Clockrit",
    origin: "clock + critter",
    look: "brass wind-up critter with a clock-face belly and a pendulum tail",
    defaultTraits: ["wind-up", "punctual", "fussy", "kind"],
  },
  wickwisp: {
    id: "wickwisp",
    name: "Wickwisp",
    origin: "wick + will-o'-the-wisp",
    look: "stub of dripping candle wax with a little flame floating over its head",
    defaultTraits: ["flame-crowned", "flickery", "timid", "warm-hearted"],
  },
  cauldrop: {
    id: "cauldrop",
    name: "Cauldrop",
    origin: "cauldron + drop",
    look: "small iron cauldron on three legs, brim-full of bubbling purple potion",
    defaultTraits: ["brim-bubbler", "bubbly", "mischievous", "greedy"],
  },
  webbit: {
    id: "webbit",
    name: "Webbit",
    origin: "web + -bit",
    look: "fluffy cobweb spider whose round belly glows like a paper lantern",
    defaultTraits: ["lantern-bellied", "tidy", "patient", "clingy"],
  },
};

export interface TemperamentInfo {
  id: SaucelingTemperamentId;
  name: string;
  origin: string;
  readsAs: string;
  grownBy: string;
  accentColor: string;
  badgeBg: string;
}

export const TEMPERAMENT_CATALOG: Record<SaucelingTemperamentId, TemperamentInfo> = {
  marinara: {
    id: "marinara",
    name: "Marinara",
    origin: "house sauce",
    readsAs: "freshly hatched, open-hearted, still finding its flavor",
    grownBy: "hatching and balanced early days",
    accentColor: "#e05246",
    badgeBg: "rgba(224, 82, 70, 0.16)",
  },
  zesto: {
    id: "zesto",
    name: "Zesto",
    origin: "pesto + zest",
    readsAs: "bright, bouncy, chatty",
    grownBy: "steady feeding and play, good bond",
    accentColor: "#48b868",
    badgeBg: "rgba(72, 184, 104, 0.16)",
  },
  carbonuzzle: {
    id: "carbonuzzle",
    name: "Carbonuzzle",
    origin: "carbonara + nuzzle",
    readsAs: "warm, clingy, golden",
    grownBy: "lots of cuddles and affection",
    accentColor: "#f0b449",
    badgeBg: "rgba(240, 180, 73, 0.18)",
  },
  rabbratty: {
    id: "rabbratty",
    name: "Rabbratty",
    origin: "arrabbiata + bratty",
    readsAs: "feisty, demanding, quick-tempered",
    grownBy: "erratic care, missed meals then spoiling",
    accentColor: "#f25c3b",
    badgeBg: "rgba(242, 92, 59, 0.18)",
  },
  seppy: {
    id: "seppy",
    name: "Seppy",
    origin: "seppia + sulky",
    readsAs: "gloomy, brooding, dramatic",
    grownBy: "neglect, long absences, low mood",
    accentColor: "#7882a4",
    badgeBg: "rgba(120, 130, 164, 0.2)",
  },
  alfredoze: {
    id: "alfredoze",
    name: "Alfredoze",
    origin: "alfredo + doze",
    readsAs: "mellow, sleepy, content",
    grownBy: "over-feeding, little play",
    accentColor: "#d9ceb8",
    badgeBg: "rgba(217, 206, 184, 0.2)",
  },
  truffoddity: {
    id: "truffoddity",
    name: "Truffoddity",
    origin: "truffle + oddity",
    readsAs: "strange, brilliant, unsettling",
    grownBy: "milestones noticed, no affection",
    accentColor: "#a978e8",
    badgeBg: "rgba(169, 120, 232, 0.18)",
  },
};

export const FIXED_TRAIT_POOL = [
  "ridged-hide",
  "crumb-collector",
  "sturdy",
  "curious",
  "hover-drift",
  "bow-winged",
  "breezy",
  "restless",
  "knot-tier",
  "slender",
  "springy",
  "affectionate",
  "pocket-shell",
  "peeker",
  "shy-sweet",
  "echo-hum",
  "roly-poly",
  "stuffed-snug",
  "dimpled",
  "homebody",
  "sauce-stained",
  "night-hummer",
  "spoon-thief",
  "warm-bellied",
] as const;

export function selectTraitsForPet(species: SaucelingSpeciesId, profile: SaucelingCareProfile, seed: number): string[] {
  const base = SPECIES_CATALOG[species].defaultTraits.map((t) => t.toLowerCase());
  const extras = FIXED_TRAIT_POOL.filter((t) => !base.includes(t));
  const chosen = [...base.slice(0, 3)];
  if (profile.tendencies.overfeeding > 0.6) chosen.push("warm-bellied");
  else if (profile.tendencies.attentiveness > 0.65) chosen.push("night-hummer");
  else {
    const pick = extras[Math.abs(seed) % extras.length];
    if (pick) chosen.push(pick);
  }
  return [...new Set(chosen)].slice(0, 5);
}

export function moodFromMeters(hunger: number, mood: number): SaucelingMood {
  const effective = Math.min(hunger, mood);
  if (effective < 42) return "grumpy";
  if (hunger >= 68 && mood >= 68) return "happy";
  return "content";
}

/** The strips in a species sheet after the egg's, for each hatched stage in turn; side is the walking view. */
const SHEET_VIEWS = ["happy", "content", "grumpy", "side"] as const;
/** Rows in a species sheet: the egg (base | lean left | lean right), then each hatched stage's views (base |
 *  squash | stretch). One sheet a species keeps the package within the Engine's 256 declared assets. */
export const SHEET_ROWS = 1 + (SAUCELING_STAGES.length - 1) * SHEET_VIEWS.length;

/** A built-in strip: its species sheet and its row there, from the top. */
export interface SaucelingSpriteStrip {
  path: string;
  row: number;
}

/** Where a species' strip for this stage and mood is, or its side view (facing right); an egg has no side view. */
export function spriteStrip(
  species: SaucelingSpeciesId,
  stage: SaucelingStage,
  view: SaucelingMood,
): SaucelingSpriteStrip;
export function spriteStrip(
  species: SaucelingSpeciesId,
  stage: SaucelingStage,
  view: SaucelingMood | "side",
): SaucelingSpriteStrip | null;
export function spriteStrip(
  species: SaucelingSpeciesId,
  stage: SaucelingStage,
  view: SaucelingMood | "side",
): SaucelingSpriteStrip | null {
  const path = `sprites/${species}.webp`;
  if (stage === "egg") return view === "side" ? null : { path, row: 0 };
  return { path, row: 1 + (SAUCELING_STAGES.indexOf(stage) - 1) * SHEET_VIEWS.length + SHEET_VIEWS.indexOf(view) };
}

/** Copies of the sheet in a living sheet, stacked top to bottom, each with one part changed. */
export const LIVE_VARIANTS = 6;
/** How long each copy shows, for the species with a living sheet: Wickwisp's flame burns, Cauldrop's brew bubbles,
 *  Thundrake crackles, Clockrit ticks, Webbit's dewdrop slides, Prismite twinkles. */
const LIVE_MS: Partial<Record<SaucelingSpeciesId, number>> = {
  thundrake: 140,
  wickwisp: 140,
  cauldrop: 180,
  clockrit: 1000,
  webbit: 220,
  prismite: 180,
};

/** A species' living sheet (`sprites/<species>-live.webp`, the same rows as its sheet in each copy), or null. */
export function liveSheet(species: SaucelingSpeciesId): { path: string; ms: number } | null {
  const ms = LIVE_MS[species];
  return ms ? { path: `sprites/${species}-live.webp`, ms } : null;
}

/** Journal events that are the caretaker speaking; the rest are the player's own actions. */
export const CARETAKER_SPEECH_KINDS: readonly SaucelingEventKind[] = [
  "egg-found",
  "hatch",
  "caretaker-care",
  "absence",
  "stage-up",
  "temperament-shift",
  "farewell",
  "return-from-album",
  "check-in",
  "evolve",
  "evolve-offer",
  "caretaker-change",
];

/** "an ink moth", "a lantern newt". */
export function withArticle(noun: string): string {
  return `${/^[aeiou]/iu.test(noun) ? "an" : "a"} ${noun}`;
}

/** What kind of creature a pet is, and how it looks: its caretaker's design when it has one, else its species.
 *  Never show it for an egg: what hatches is a surprise. */
export function petKind(pet: { species: SaucelingSpeciesId; design: SaucelingDesign | null }): {
  name: string;
  look: string;
} {
  return pet.design
    ? { name: pet.design.kind, look: pet.design.look }
    : { name: SPECIES_CATALOG[pet.species].name, look: SPECIES_CATALOG[pet.species].look };
}

/** Whether a sauceling is pasta: one of the built-in pasta species, not invented by its caretaker or evolved. */
export function isPasta(pet: { species: SaucelingSpeciesId; design: SaucelingDesign | null }): boolean {
  return !pet.design && (PASTA_SPECIES as readonly SaucelingSpeciesId[]).includes(pet.species);
}

/** The temperament a sauceling shows: its sauce when it is pasta, with the sauce's colours; else its own, once it has
 *  been written (null before), in the house colours. */
export function temperamentOf(pet: {
  species: SaucelingSpeciesId;
  design: SaucelingDesign | null;
  temperament: SaucelingTemperamentId;
  ownTemperament: SaucelingOwnTemperament | null;
}): { name: string; readsAs: string; sauce: TemperamentInfo | null } | null {
  if (isPasta(pet)) {
    const sauce = TEMPERAMENT_CATALOG[pet.temperament];
    return { name: sauce.name, readsAs: sauce.readsAs, sauce };
  }
  return pet.ownTemperament
    ? { name: pet.ownTemperament.name, readsAs: pet.ownTemperament.readsAs, sauce: null }
    : null;
}

/** The Menagerie's sections, eldest first, each keeping the list's order (newest first); empty ones are left out.
 *  A pet that reached elder is an elder whatever stage it was locked at, since it can come back at any stage. */
export function menagerieSections<T extends { reachedElder: boolean; stageAtRetirement: SaucelingStage }>(
  entries: T[],
): { stage: SaucelingStage; entries: T[] }[] {
  return [...SAUCELING_STAGES]
    .reverse()
    .map((stage) => ({
      stage,
      entries: entries.filter((entry) => (entry.reachedElder ? "elder" : entry.stageAtRetirement) === stage),
    }))
    .filter((section) => section.entries.length > 0);
}

/** The built-in backgrounds as the prompts that drew them describe them: a new one's starting point, and the place
 *  a caretaker's lines are set in. */
export const SCENE_PROMPTS: Record<SaucelingSpeciesId, string> = {
  rigamuffin:
    "a cosy Italian kitchen counter: a tiled wall of cream and terracotta tiles, a bubbling red tomato-sauce pot on a small stove, a hanging ladle and a string of garlic, a wooden shelf with jars",
  fluttino:
    "a bright windowsill in the morning: an open window with white shutters, a soft sky-blue sky with a few clouds and distant green hills, pale pink curtains, a pot of basil and a small vase of flowers",
  lentino:
    "a pantry shelf: dark wooden shelves with glass jars of dried pasta, tins and bottles, long strands of linguine hanging to dry on a wooden rack, a small sack of flour, a green-and-white checked cloth",
  shellbini:
    "a sunny rock pool by the sea: blue-green water, a bright sky with a few clouds, rounded grey and purple rocks, small seashells, pebbles and a bit of seaweed, flat pale sand along the edge",
  tortellump:
    "a hearth in a cosy cottage: a stone fireplace with a warm crackling fire, a rounded brick arch, wooden beams, a copper pot hanging at the side, plump cushions, a woven red-and-cream rug",
  mossaboo:
    "a shady forest glade: tall mossy tree trunks, ferns and small red-capped mushrooms at the edges, soft green light through the leaves, a few round mossy stones, a flat mossy forest floor",
  puddlepip:
    "a rainy garden pond: lily pads and pink water lilies on calm blue water, tall reeds at the sides, gentle rain from a soft grey sky, a few smooth stepping stones, a flat muddy bank",
  snufflump:
    "a cosy corner under a bed: a soft patchwork quilt hanging down at the top, an old slipper, a lost button and a ball of yarn at the sides, warm lamplight from one side, a soft beige carpet",
  burrowl:
    "an underground burrow: warm brown earth walls with tree roots poking through, a small round tunnel opening, a lantern hanging from a root, a few pebbles and fallen leaves, a flat packed-earth floor",
  prismite:
    "a sparkling crystal cave: deep blue rock walls studded with clusters of clear and pale violet crystals, thin beams of light splitting into rainbow flecks, a few glowing stones, a smooth pale stone floor",
  thundrake:
    "a windy hilltop under a stormy sky: dark rolling storm clouds with a distant flash of lightning, a few slanting raindrops, wind-bent grass and a lone crooked tree at one side, a flat grassy ridge",
  clockrit:
    "a clockmaker's workshop: a wall of brass gears and ticking clock faces, a tall pendulum clock at one side, tiny tools on a rack, a small magnifying lamp, a polished wooden bench top",
  wickwisp:
    "a dim candlelit attic: sloping dark wooden beams, a small round window with a crescent moon, old trunks and a stack of books, candle stubs dripping wax on a shelf, soft violet shadows",
  cauldrop:
    "a witch's cottage corner: a stone wall with shelves of glass bottles of purple and green potion, bundles of dried herbs hanging from a beam, a small hearth with glowing embers, a broom leaning by the wall",
  webbit:
    "a quiet porch at dusk: weathered wooden planks and railing, big silvery cobwebs in the corners, a glowing paper lantern hanging from the eaves, a deep blue night sky with a few stars, dry autumn leaves",
};

/** An egg's species is a surprise, so what a new background for it describes is the nest every egg has. */
export const NEST_SCENE_PROMPT =
  "a warm, cosy nest corner: a pale wooden wall with a small round window, a folded checked tea towel, a wide shallow empty nest of golden straw and cream cloth in the centre, a soft straw-coloured mat";

/** What the Nook shows behind `pet`, for its caretaker's lines: a generated background's prompt, else the built-in
 *  one (also when its saved background is gone, as the stage shows it); null for an uploaded picture, which nothing
 *  describes. */
export function nookPlace(
  pet: Pick<SaucelingPet, "species" | "stage" | "backgroundId">,
  backgrounds: readonly SaucelingBackground[],
): string | null {
  const saved = pet.backgroundId ? backgrounds.find((background) => background.id === pet.backgroundId) : undefined;
  if (saved) return saved.source === "generated" && saved.label ? saved.label : null;
  return pet.stage === "egg" ? NEST_SCENE_PROMPT : SCENE_PROMPTS[pet.species];
}

/** The built-in Nook background: every egg shares the nest, so its species stays a surprise until it hatches. */
export function sceneAssetPath(pet: Pick<SaucelingPet, "species" | "stage">): string {
  return pet.stage === "egg" ? "sprites/scene-nest.webp" : `sprites/scene-${pet.species}.webp`;
}

/** The stage and mood a pet's sprite shows: a locked stage wins, and the meters pick the mood. */
export function spriteStateForPet(pet: Pick<SaucelingPet, "stage" | "lockedStage" | "meters">): {
  stage: SaucelingStage;
  mood: SaucelingMood;
} {
  return { stage: pet.lockedStage ?? pet.stage, mood: moodFromMeters(pet.meters.hunger, pet.meters.mood) };
}

export type SaucelingSpriteArt = { kind: "species" } | { kind: "form"; formId: string } | { kind: "silhouette" };

/** Which picture a sauceling shows at a stage: its painted form, else a silhouette for one it was found as,
 *  else its species sprite (an evolved one keeps its sprite until its form is painted). */
export function spriteArtFor(pet: Pick<SaucelingPet, "design" | "forms">, stage: SaucelingStage): SaucelingSpriteArt {
  const formId = pet.forms[stage];
  if (formId) return { kind: "form", formId };
  return pet.design?.origin === "found" ? { kind: "silhouette" } : { kind: "species" };
}

export function neutralCareProfile(
  characterId: string,
  characterName: string,
  cardDigest = "neutral",
): SaucelingCareProfile {
  return {
    characterId,
    characterName,
    cardDigest,
    generatedByModel: false,
    tendencies: {
      feedReliability: 0.65,
      overfeeding: 0.25,
      playfulness: 0.55,
      affection: 0.55,
      attentiveness: 0.6,
      consistency: 0.65,
    },
    voice: {
      petNickname: "little dumpling",
      feedingStyle: "sets out a tidy bowl on schedule",
      catchphrases: ["There we are, all sorted.", "Try not to make a mess of the nook.", "Still holding up nicely."],
      voiceSample: "Steady now. Let's see how you're getting on.",
      worryLevel: 1,
      speechStyle: "",
      phrases: {},
    },
    speciesLean: [],
    temperamentLean: [],
    updatedAt: new Date().toISOString(),
  };
}
