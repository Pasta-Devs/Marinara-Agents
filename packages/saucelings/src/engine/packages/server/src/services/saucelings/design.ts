import {
  SAUCELING_EVOLVE_COLOURS,
  SAUCELING_EVOLVE_EXTRAS,
  SAUCELING_EVOLVE_MOVES,
  SAUCELING_EVOLVE_PATHS,
  SAUCELING_STAGES,
  type SaucelingDesign,
  type SaucelingEvolution,
  type SaucelingEvolveColour,
  type SaucelingFinder,
  type SaucelingOwnTemperament,
  type SaucelingPet,
  type SaucelingStage,
} from "../../../../shared/src/features/agents/saucelings/types.js";
import {
  isPasta,
  petKind,
  SPECIES_CATALOG,
  TEMPERAMENT_CATALOG,
  temperamentOf,
  withArticle,
} from "../../../../shared/src/features/agents/saucelings/vocabulary.js";
import { askJson, cardPersona, cleanText, extractReducedCard, parseRecord } from "./care-profile.js";
import { getSaucelingsRuntime } from "./package-runtime.js";

/** Past this the design call is abandoned and nothing is invented. */
export const DESIGN_TIMEOUT_MS = 30_000;
/** Room for the kind, the look and a picture description for each of five stages. */
const DESIGN_MAX_TOKENS = 800;
/** Room for one place described in a phrase. */
const SCENE_MAX_TOKENS = 200;
/** Room for a name and a temperament. */
const NATURE_MAX_TOKENS = 160;
/** Room for two evolutions, each a name, a sentence and a reason. */
const EVOLVE_MAX_TOKENS = 400;

/** Pasta, sauce and food words (with simple plural endings) that a creature's kind, look or stages may not use. */
const FOOD_WORDS = [
  "pasta",
  "noodle",
  "sauce",
  "saucy",
  "spaghetti",
  "macaroni",
  "rigatoni",
  "farfalle",
  "linguine",
  "tortellini",
  "ravioli",
  "penne",
  "lasagna",
  "lasagne",
  "fettuccine",
  "gnocchi",
  "dumpling",
  "food",
  "edible",
  "meal",
  "tomato",
  "pesto",
  "marinara",
  "alfredo",
  "carbonara",
  "semolina",
];
const FOOD_PATTERNS = FOOD_WORDS.map((word) => new RegExp(`\\b${word}(?:e?s)?\\b`, "iu"));

/** Matches `name` as a whole word, whatever characters it holds. */
const wordPattern = (name: string) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\b`, "iu");

/** The built-in species and sauce names, which a design must not borrow. */
const RESERVED_PATTERNS = [
  ...Object.values(SPECIES_CATALOG).map((species) => species.name),
  ...Object.values(TEMPERAMENT_CATALOG).map((temperament) => temperament.name),
].map(wordPattern);

function firstThree(value: unknown): [string, string, string] | null {
  if (!Array.isArray(value)) return null;
  const words = value.map((entry) => cleanText(entry, 24)).filter(Boolean);
  return words.length >= 3 ? [words[0]!, words[1]!, words[2]!] : null;
}

/** Checks a model's design and trims it to size; null when anything required is missing, or it is pasta, sauce,
 *  food or a built-in species. */
export function normalizeDesign(value: unknown, origin: SaucelingDesign["origin"]): SaucelingDesign | null {
  const obj = parseRecord(value);
  const kind = cleanText(obj.kind, 40);
  const look = cleanText(obj.look, 240);
  const quirk = cleanText(obj.quirk, 120);
  const colours = firstThree(obj.colours);
  const traits = firstThree(obj.traits);
  if (!kind || !look || !quirk || !colours || !traits) return null;

  const wanted: readonly SaucelingStage[] = origin === "found" ? SAUCELING_STAGES : ["adult", "elder"];
  const rawStages = parseRecord(obj.stages);
  const stages: Partial<Record<SaucelingStage, string>> = {};
  for (const stage of wanted) {
    const text = cleanText(rawStages[stage], 240);
    if (!text) return null;
    stages[stage] = text;
  }

  const described = [kind, look, ...Object.values(stages)];
  if (described.some((text) => FOOD_PATTERNS.some((pattern) => pattern.test(text)))) return null;
  const everything = [...described, ...colours, ...traits, quirk];
  if (everything.some((text) => RESERVED_PATTERNS.some((pattern) => pattern.test(text)))) return null;

  return { kind, look, colours, traits, quirk, stages, origin };
}

/** Asks the writing connection to invent a creature the caretaker found, from their card. Null when there is no
 *  card, no connection, the call fails or times out, or the answer does not pass normalizeDesign. Never throws. */
export async function generateDesign(options: {
  characterId: string;
  connectionId: string | null;
}): Promise<SaucelingDesign | null> {
  try {
    const runtime = getSaucelingsRuntime();
    const record = (await runtime.resources.listCharacters([options.characterId]))[0];
    if (!record) return null;
    const card = extractReducedCard(record);
    const stageExample =
      '"egg":"what its egg looks like","hatchling":"tiny and round","juvenile":"...","adult":"...","elder":"..."';
    const prompt = [
      {
        role: "system" as const,
        content: [
          "You invent a small creature that this character found while out and about or while talking with the player, as a pet for a pixel-art virtual-pet game. Everything about it comes from who they are (their personality, interests, job and world), turned into an animal's body and habits: a tidy character's pet might line its pebbles up in rows, a scientist's might sniff and poke at anything new. It is an animal, not a person: it cannot read, write, talk, work or hold opinions. Not a robot unless their world has them, and never pasta, sauce or food.",
          'kind: a short creature-kind name of 1 to 3 words, a made-up or descriptive kind (like "ink moth" or "lantern newt"), not a personal name.',
          "look: one or two sentences on its body shape, features and markings, in plain words a small game sprite can show. No art-style words such as low-poly, 3D, realistic or cartoon.",
          "colours: three colour words for its main colours.",
          'traits: three single-word or hyphenated traits of its body or how it behaves, like "sturdy", "curious" or "knot-tier".',
          'quirk: one short sentence on a habit that shows the character\'s ways in something its body does, like "Tucks stray breadcrumbs into its ridges for later."',
          "stages: a one-sentence picture description per life stage, the same creature growing up (egg: what its egg looks like; hatchling: tiny and round; juvenile; adult; elder: older, with a sign of age). Each describes only the creature, full body, no background, in plain words.",
          "Return ONLY JSON matching:",
          `{"kind":"ink moth","look":"one or two sentences","colours":["c1","c2","c3"],"traits":["t1","t2","t3"],"quirk":"one short sentence","stages":{${stageExample}}}`,
        ].join("\n"),
      },
      { role: "user" as const, content: card.summaryText },
    ];
    return normalizeDesign(
      await askJson(prompt, options.connectionId, {
        maxTokens: DESIGN_MAX_TOKENS,
        temperature: 0.8,
        timeoutMs: DESIGN_TIMEOUT_MS,
      }),
      "found",
    );
  } catch {
    // No connection, a failed or slow call, or an unreadable answer: nothing is invented.
    return null;
  }
}

/** What the caretaker's card says about who they are, cut to size; empty when the card is gone. */
async function caretakerWho(pet: SaucelingPet): Promise<string> {
  const [record] = await getSaucelingsRuntime().resources.listCharacters([pet.caretakerId]);
  return record ? cardPersona(record).who.slice(0, 600) : "";
}

/** Asks the writing connection for a place that suits the nook's sauceling, as the start of a prompt for a
 *  generated background. Null when there is no connection, the call fails or times out, or the answer is unusable,
 *  such as one that names what an egg will hatch into. Never throws. */
export async function suggestScene(pet: SaucelingPet, connectionId: string | null): Promise<string | null> {
  try {
    const kind = petKind(pet);
    const who = await caretakerWho(pet);
    const caretaker = `Its caretaker is ${pet.careProfile.characterName}.${who ? `\nWho they are:\n${who}` : ""}`;
    const facts =
      pet.stage === "egg"
        ? `An egg${pet.design?.stages.egg ? `: ${pet.design.stages.egg}` : "."} What hatches from it is a surprise, so do not guess or name it. ${caretaker}`
        : [
            `${pet.name}, ${withArticle(kind.name)} at its ${pet.lockedStage ?? pet.stage} stage.`,
            `Look: ${kind.look}`,
            pet.design ? `Colours: ${pet.design.colours.join(", ")}.` : "",
            `Traits: ${pet.traits.join(", ")}.`,
            `Quirk: ${pet.quirk}`,
            temperamentOf(pet) ? `Temperament: ${temperamentOf(pet)!.readsAs}.` : "",
            caretaker,
          ]
            .filter(Boolean)
            .join(" ");
    const prompt = [
      {
        role: "system" as const,
        content: [
          "You describe one place where a small pet in a pixel-art virtual-pet game would love to live. It becomes the background behind the pet: a wide, side-on room or outdoor spot like a stage set, with an empty floor along the bottom. Fit the pet's look, colours, traits and quirk, and its caretaker's world.",
          'scene: one phrase of at most 50 words that starts with "a" or "an" and names the place and four to six things in it. No creatures, characters, people or names in it.',
          "Return ONLY JSON matching:",
          '{"scene":"a ..."}',
        ].join("\n"),
      },
      { role: "user" as const, content: facts },
    ];
    const answer = await askJson(prompt, connectionId, {
      maxTokens: SCENE_MAX_TOKENS,
      temperature: 0.9,
      timeoutMs: DESIGN_TIMEOUT_MS,
    });
    const scene = cleanText(parseRecord(answer).scene, 400).replace(/[.\s]+$/u, "");
    return scene && !(pet.stage === "egg" && wordPattern(kind.name).test(scene)) ? scene : null;
  } catch {
    // No connection, a failed or slow call, or an unreadable answer: the client starts from its own prompt.
    return null;
  }
}

/** Each evolution colour's name, the words the fallback describes it and its aura with, and what the model is told
 *  they look like. */
const EVOLVE_COLOURS: Record<SaucelingEvolveColour, { name: string; words: string; aura: string }> = {
  ember: { name: "Ember", words: "warm reds and oranges", aura: "embers rise around it" },
  frost: { name: "Frost", words: "icy blues", aura: "snowflakes drift around it" },
  moss: { name: "Moss", words: "leafy greens", aura: "leaves fall around it" },
  dusk: { name: "Dusk", words: "violets", aura: "little stars twinkle around it" },
  gilded: { name: "Gilded", words: "golds", aura: "gold glints sparkle around it" },
  shade: { name: "Shade", words: "dark, muted shades", aura: "shadowy wisps curl around it" },
  bloom: { name: "Bloom", words: "soft pinks", aura: "petals fall around it" },
  storm: { name: "Storm", words: "storm-cloud greys and electric yellows", aura: "sparks crackle around it" },
  tide: { name: "Tide", words: "sea blues and greens", aura: "bubbles rise around it" },
};

const oneOf = <T extends string>(list: readonly T[], value: unknown): T | null =>
  list.includes(value as T) ? (value as T) : null;

/** A saved look, checked for shape only (the model's words were checked when it was written); null when malformed.
 *  A move that is missing or unknown becomes its colour's first; a saved "glow" is ignored. */
export function evolutionLookOf(value: unknown): SaucelingEvolution | null {
  const obj = parseRecord(value);
  const form = cleanText(obj.form, 48);
  const description = cleanText(obj.description, 240);
  const from = cleanText(obj.from, 160);
  const colour = oneOf(SAUCELING_EVOLVE_COLOURS, obj.colour);
  const extra = oneOf(SAUCELING_EVOLVE_EXTRAS, obj.extra);
  return form && description && from && colour && extra
    ? {
        form,
        description,
        from,
        colour,
        extra,
        move: oneOf(SAUCELING_EVOLVE_MOVES, obj.move) ?? SAUCELING_EVOLVE_PATHS[colour].moves[0]!,
      }
    : null;
}

/** Plain looks when no model answers: "Ember Lentino", its colours, aura and an extra from its path, and its
 *  caretaker's care. Each avoids the colours in `taken` and the ones before it. */
export function fallbackEvolutions(
  pet: SaucelingPet,
  count: number,
  taken: readonly SaucelingEvolveColour[] = [],
  random: () => number = Math.random,
): SaucelingEvolution[] {
  const pickFrom = <T>(list: readonly T[]) => list[Math.floor(random() * list.length) % list.length]!;
  const kind = petKind(pet).name;
  const temper = temperamentOf(pet);
  const ways = temper ? (temper.sauce ? temper.name : temper.name.toLowerCase()) : null;
  const caretaker = pet.careProfile.characterName;
  const used = [...taken];
  const looks: SaucelingEvolution[] = [];
  for (let i = 0; i < count; i++) {
    const colour = pickFrom(SAUCELING_EVOLVE_COLOURS.filter((id) => !used.includes(id)));
    used.push(colour);
    const { extras, moves } = SAUCELING_EVOLVE_PATHS[colour];
    const extra = pickFrom(extras);
    const { name, words, aura } = EVOLVE_COLOURS[colour];
    looks.push({
      form: `${name} ${kind}`,
      description: `Its colours have turned to ${words}, ${aura}, and a little ${extra} floats above its head.`,
      from: ways ? `${caretaker}'s care and its ${ways} ways.` : `${caretaker}'s care.`,
      colour,
      extra,
      move: pickFrom(moves),
    });
  }
  return looks;
}

/** Checks the model's evolutions: each needs every part, ids from the lists and a colour of its own, and no other
 *  species' or sauce's name (food words too, unless it is pasta). An extra or move off its colour's path becomes the
 *  path's first; the aura always follows the colour. At most two. */
export function normalizeEvolutions(value: unknown, pet: SaucelingPet): SaucelingEvolution[] {
  const list = parseRecord(value).evolutions;
  const own = [petKind(pet).name, temperamentOf(pet)?.name ?? ""].map((name) => name.toLowerCase());
  const reserved = RESERVED_PATTERNS.filter((pattern) => !own.some((name) => pattern.test(name)));
  const looks: SaucelingEvolution[] = [];
  for (const item of Array.isArray(list) ? list : []) {
    const raw = parseRecord(item);
    const path = SAUCELING_EVOLVE_PATHS[oneOf(SAUCELING_EVOLVE_COLOURS, raw.colour) ?? "ember"];
    const look = evolutionLookOf({
      ...raw,
      from: cleanText(raw.from, 160).replace(/^from:\s*/iu, ""),
      extra: oneOf(path.extras, raw.extra) ?? path.extras[0],
      move: oneOf(path.moves, raw.move) ?? path.moves[0],
    });
    if (!look || looks.length >= 2 || looks.some((other) => other.colour === look.colour)) continue;
    const words = [look.form, look.description, look.from];
    if (words.some((text) => reserved.some((pattern) => pattern.test(text)))) continue;
    if (!isPasta(pet) && words.some((text) => FOOD_PATTERNS.some((pattern) => pattern.test(text)))) continue;
    looks.push(look);
  }
  return looks;
}

/** The two looks a sauceling is offered: the writing connection's, made up from the plain fallback when it is missing,
 *  fails, times out or gives fewer than two good ones. Never throws. */
export async function generateEvolutions(
  pet: SaucelingPet,
  connectionId: string | null,
): Promise<[SaucelingEvolution, SaucelingEvolution]> {
  let looks: SaucelingEvolution[] = [];
  try {
    const kind = petKind(pet);
    const temper = temperamentOf(pet);
    const caretaker = pet.careProfile.characterName;
    const who = await caretakerWho(pet);
    const prompt = [
      {
        role: "system" as const,
        content: [
          `A small pet in a pixel-art virtual-pet game has been happy and close to its caretaker, ${caretaker}, and is ready to evolve. Its body and shape stay the same: an evolution recolours it, wraps it in its colour's aura, puts a small thing floating above its head and gives it a signature move. Offer two different evolutions, each shaped by its life with ${caretaker} and its own ways.`,
          `colour: one id of ${SAUCELING_EVOLVE_COLOURS.map((id) => `${id} (${EVOLVE_COLOURS[id].words}; ${EVOLVE_COLOURS[id].aura}; extras ${SAUCELING_EVOLVE_PATHS[id].extras.join(", ")}; moves ${SAUCELING_EVOLVE_PATHS[id].moves.join(", ")})`).join(", ")}. The two must differ.`,
          "extra: one id from its colour's extras. move: one id from its colour's moves.",
          `form: what it becomes, 2 or 3 words that keep its kind, like "Ember ${kind.name}". Not a personal name.`,
          "description: one sentence on how it looks now, in plain words that match its colour, aura and extra.",
          `from: one short sentence on what in its life led here, naming ${caretaker}, like "${caretaker}'s late-night stories and its restless ways."`,
          isPasta(pet) ? "" : "It is not pasta or food: no pasta, sauce or food words.",
          "Return ONLY JSON matching:",
          '{"evolutions":[{"form":"...","description":"...","from":"...","colour":"...","extra":"...","move":"..."},{...}]}',
        ]
          .filter(Boolean)
          .join("\n"),
      },
      {
        role: "user" as const,
        content: [
          `${pet.name}, ${withArticle(kind.name)}: ${kind.look}`,
          pet.design ? `Colours: ${pet.design.colours.join(", ")}.` : "",
          `Traits: ${pet.traits.join(", ")}. Quirk: ${pet.quirk}`,
          temper ? `Temperament: ${temper.name}, ${temper.readsAs}.` : "",
          who ? `Who ${caretaker} is:\n${who}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ];
    looks = normalizeEvolutions(
      await askJson(prompt, connectionId, {
        maxTokens: EVOLVE_MAX_TOKENS,
        temperature: 0.9,
        timeoutMs: DESIGN_TIMEOUT_MS,
      }),
      pet,
    );
  } catch {
    // No connection, a failed or slow call, or an unreadable answer: the plain looks stand in.
  }
  const [first, second] = [
    ...looks,
    ...fallbackEvolutions(
      pet,
      2 - looks.length,
      looks.map((look) => look.colour),
    ),
  ];
  return [first!, second!];
}

/** How far a step moves a temperament toward the caretaker it is taking after. */
const STEP_WORDS: Record<SaucelingOwnTemperament["steps"], string> = {
  1: "keep most of the old one and add a little of theirs",
  2: "make it about half the old one and half theirs",
  3: "it now takes after them fully, with only a trace of the old one left",
};

/** A temperament in the sauces' style: one plain word ("Cheeky"), then how it acts in at most 60 letters ("watchful,
 *  prickly, slow to trust"), in no pasta, sauce or food words; null otherwise. A saved one is checked too, so one
 *  written before these checks (a glued "ChaoticSarcastic", or its finder's card retold) is written again. */
export function temperamentWords(name: unknown, readsAs: unknown): { name: string; readsAs: string } | null {
  const word = cleanText(name, 24);
  const acts = cleanText(readsAs, 120)
    .replace(/[.\s]+$/u, "")
    .replace(/^\p{Lu}(?=\p{Ll})/u, (first) => first.toLowerCase());
  const clean = (text: string) =>
    !FOOD_PATTERNS.some((pattern) => pattern.test(text)) && !RESERVED_PATTERNS.some((pattern) => pattern.test(text));
  if (!/^\p{L}[\p{Ll}\p{M}'-]*$/u.test(word) || !acts || acts.length > 60 || !clean(word) || !clean(acts)) return null;
  return { name: word.charAt(0).toUpperCase() + word.slice(1), readsAs: acts };
}

/** Checks a name and a temperament from the model; each is null when it was not given or fails its checks: a name
 *  that is its kind's name, a built-in species or a sauce, or a temperament that fails temperamentWords. */
export function normalizeNature(
  value: unknown,
  kindName: string,
): { name: string | null; temperament: { name: string; readsAs: string } | null } {
  const obj = parseRecord(value);
  const reserved = (text: string) => RESERVED_PATTERNS.some((pattern) => pattern.test(text));
  const raw = cleanText(obj.name, 24);
  const name =
    raw && /^\p{L}[\p{L}\p{M}' .-]*$/u.test(raw) && raw.toLowerCase() !== kindName.toLowerCase() && !reserved(raw)
      ? raw
      : null;
  const temper = parseRecord(obj.temperament);
  return { name, temperament: temperamentWords(temper.name, temper.readsAs) };
}

/** Asks the writing connection for what a sauceling is given: a `name` when it hatches, and when it is not pasta, a
 *  `temperament` taking after `after`: its first, from their card, or a step (`previous` set) leaning its old one
 *  toward theirs. Null when the call fails or times out; a part that fails normalizeNature comes back null. Never
 *  throws. */
export async function generateNature(options: {
  pet: SaucelingPet;
  connectionId: string | null;
  name: boolean;
  temperament: { after: SaucelingFinder; previous: SaucelingOwnTemperament | null; steps: 1 | 2 | 3 } | null;
}): Promise<ReturnType<typeof normalizeNature> | null> {
  try {
    const runtime = getSaucelingsRuntime();
    const { pet, temperament } = options;
    const kind = petKind(pet);
    const record = temperament ? (await runtime.resources.listCharacters([temperament.after.id]))[0] : undefined;
    const after = temperament?.after.name ?? "";
    const previous = temperament?.previous;
    const shape = [
      'name: one plain word for it, like "Sunny", "Clinical" or "Clingy".',
      'readsAs: three short words or phrases in lowercase for how it acts, like "watchful, prickly, slow to trust" or "bouncy, clingy, always underfoot".',
      `Only what a small animal does: how it moves, plays, eats, sleeps and treats you. No jokes, words, opinions or skills. Use your own words, not ones from ${after}'s card, and leave out its quirk. No pasta, sauce or food words.`,
    ].join(" ");
    const prompt = [
      {
        role: "system" as const,
        content: [
          "You help with Saucelings, a pixel-art virtual-pet game. Here is one of its small creatures.",
          options.name
            ? "name: give it a short, fun and clever pet name of one or two words, at most 16 letters: a pun or a playful twist on what it is (its kind, look, colours or quirk). Not its kind's name, not a description of it, and not its temperament."
            : "",
          temperament && !previous
            ? `temperament: write its temperament. It takes after ${after}, who found its egg: turn how ${after} is into how a small pet behaves. ${shape}`
            : "",
          temperament && previous
            ? `temperament: its temperament has been "${previous.name}: ${previous.readsAs}". ${after} has looked after it for two weeks and it is picking up their ways: ${STEP_WORDS[temperament.steps]}. ${shape}`
            : "",
          "Return ONLY JSON matching:",
          JSON.stringify({
            ...(options.name ? { name: "..." } : {}),
            ...(temperament ? { temperament: { name: "...", readsAs: "..." } } : {}),
          }),
        ]
          .filter(Boolean)
          .join("\n"),
      },
      {
        role: "user" as const,
        content: [
          `It is ${withArticle(kind.name)}: ${kind.look}`,
          pet.design ? `Colours: ${pet.design.colours.join(", ")}.` : "",
          `Traits: ${pet.traits.join(", ")}. Quirk: ${pet.quirk}`,
          temperament ? `${after}:\n${record ? extractReducedCard(record).summaryText : after}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ];
    return normalizeNature(
      await askJson(prompt, options.connectionId, {
        maxTokens: NATURE_MAX_TOKENS,
        temperature: 0.9,
        timeoutMs: DESIGN_TIMEOUT_MS,
      }),
      kind.name,
    );
  } catch {
    // No connection, a failed or slow call, or an unreadable answer: nothing is given this time.
    return null;
  }
}
