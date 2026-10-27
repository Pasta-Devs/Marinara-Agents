import { TEMPERAMENT_CATALOG } from "./vocabulary.js";
import type {
  SaucelingAbsenceBucket,
  SaucelingCareProfile,
  SaucelingCaretakerOutcome,
  SaucelingPet,
  SaucelingPhraseMoment,
  SaucelingSignoffFeeling,
  SaucelingSpeciesId,
  SaucelingStage,
  SaucelingTemperamentId,
  SaucelingUserAction,
} from "./types.js";

// Lines written while the pet is an egg never name its species: what hatches is the surprise.
// The caretaker's lines are their own words, said to the player or to the pet; the player's own care
// (templateUserActionLine) is told to the player.

/** What Listen hears inside each egg: a hint, never the name. */
const EGG_SOUNDS: Record<SaucelingSpeciesId, string> = {
  rigamuffin: "a busy little scritch-scratch, like someone tidying crumbs",
  fluttino: "a soft, papery flutter",
  lentino: "a long, slow swish, like a ribbon being tied",
  shellbini: "a faint hum that echoed, as if from deep inside a shell",
  tortellump: "a heavy, contented roll from one side to the other",
  mossaboo: "almost nothing: a slow, sleepy creak, like an old tree settling",
  puddlepip: "a soft drip, then a tiny splash",
  snufflump: "a muffled snuffle, like someone breathing into a pillow",
  burrowl: "a busy scrabbling, as if something were digging its way out",
  prismite: "a clear, glassy chime whenever the light touched it",
  thundrake: "a low rumble, like thunder a long way off",
  clockrit: "a steady, tiny tick-tick-tick",
  wickwisp: "a faint crackle, like a match struck in another room",
  cauldrop: "a thick, slow blub-blub, like something simmering",
  webbit: "a careful tapping, like many small steps on paper",
};

/** What the caretaker calls an egg when they speak to it. */
const EGG_CALL = "little egg";

/** "1 meal", "3 meals". */
function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

/** "once", "twice", "3 times". */
function times(n: number): string {
  return n === 1 ? "once" : n === 2 ? "twice" : `${n} times`;
}

/** "a, b and c". */
function listed(parts: string[]): string {
  return parts.length < 2 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

const WRAPPED_IN_QUOTES = /^["“”„«»]\s*([^"“”„«»]*?)\s*["“”«»]$/u;

/**
 * Keeps only the words a model meant the caretaker to say: drops *actions*, a "Name:" label in front and
 * quotation marks around the whole line. A line with quotes inside it is narration and stays as it is.
 */
export function spokenLine(text: string, speaker: string): string {
  const names = [speaker, ...speaker.split(/\s+/u).filter((word) => word.length >= 3)]
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
    .join("|");
  const label = new RegExp(`^(?:${names})\\s*:\\s*`, "iu");
  const unquote = (line: string) => line.replace(WRAPPED_IN_QUOTES, "$1");
  const line = text
    .replace(/\*[^*]*\*/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return unquote(unquote(line).replace(label, "")).trim();
}

/** The house caretaker's phrasebook: what anyone says at a moment their own phrasebook does not cover, turned by `pick`.
 *  In egg moments {pet} is "little egg". */
export const HOUSE_PHRASES: Record<SaucelingPhraseMoment, string[]> = {
  feed: [
    "Dinner, {pet}. Nice and tidy, right on time.",
    "Here's your bowl, {nickname}. Eat it while it's warm.",
    "Dinner's served, {pet}. Mind the crumbs.",
    "Right on schedule. Tuck in, {pet}.",
  ],
  fedBadly: [
    "I rushed {pet}'s dinner and burnt it a bit. They ate around the black bits.",
    "Dinner came out a little lumpy today. {pet} was very polite about it.",
    "I left {pet}'s bowl on the heat too long. Not my finest work.",
    "Bit of a scorched dinner tonight. I'll do better tomorrow, {pet}.",
  ],
  overfed: [
    "I gave {pet} seconds again. And thirds. They're very round now.",
    "I lost count of {pet}'s helpings. That's not like me.",
    "{pet} asked so nicely that I filled the bowl twice.",
    "A bit too much dinner today. {pet} is having a long sit-down.",
  ],
  forgot: [
    "I completely forgot {pet}'s dinner. I'll make it up to them.",
    "The bowl stayed empty tonight. My mistake, {pet}.",
    "I lost track of the time and missed {pet}'s dinner. Sorry, {nickname}.",
    "Dinner slipped my mind today. {pet} has been giving me looks.",
  ],
  play: [
    "Catch, {pet}! Ha, that's the spirit.",
    "One more round, {pet}, then we tidy up.",
    "Off you go, {nickname}. Fetch it back now.",
    "Good game, {pet}. You're quicker than you look.",
  ],
  cuddle: [
    "Come here, {nickname}. A good long cuddle, that's what you need.",
    "There, {pet}. Settle in.",
    "A quiet cuddle before bed, {nickname}.",
    "Shh, {pet}. All nice and calm now.",
  ],
  milestone: [
    "I've been taking notes on {pet}. They're coming along nicely, have you noticed?",
    "{pet} has grown a little steadier lately. Good to see.",
    "I keep a little chart for {pet}. It's all going the right way.",
    "Have you seen {pet} lately? Coming along very well.",
  ],
  warmEgg: [
    "Back under the tea towel you go, {pet}.",
    "There, {pet}. Snug and warm.",
    "Let's keep you cosy, {pet}.",
    "Another fold of the towel, {pet}. Just right.",
  ],
  letCool: [
    "Oh dear, I let the egg go a little cool. I'll warm it back up.",
    "The egg got a bit chilly while I wasn't looking. Back under the towel.",
    "I let the egg cool off. Not like me at all.",
    "A cold egg on my watch. Let's fix that.",
  ],
  chatEgg: [
    "Let me tell you about my day, {pet}.",
    "I tidied the whole nook today, {pet}. You'd have liked it.",
    "Are you listening in there, {pet}? I'll keep it short.",
    "Quiet day today, {pet}. Just how I like it.",
  ],
  hatch: [
    "It's hatching! Come and look, it's a little {kind}!",
    "Crack, crack... there! A little {kind}, all in one piece.",
    "Well, look at that. Out comes a little {kind}.",
    "It's hatched! A {kind}, and a tidy hatch it was too.",
  ],
  stageUp: [
    "Look at {pet}! A proper {stage} now.",
    "{pet} is on to the {stage} stage now. Well done, {nickname}.",
    "Would you look at that. {pet}'s grown into a {stage}.",
    "Another stage done. {pet} is a {stage} now, and doing well.",
  ],
  checkInEgg: [
    "The egg's doing fine.",
    "Warm and snug. No cracks yet.",
    "The egg's resting nicely. Any day now, I'd say.",
    "All quiet in the basket.",
  ],
  checkInContent: [
    "{pet} seems content.",
    "{pet} is doing well. Fed, happy, no fuss.",
    "All in order with {pet}.",
    "{pet} is in good spirits today.",
  ],
  checkInHungry: [
    "{pet}'s bowl is empty.",
    "{pet} keeps looking at the bowl. Hungry, I think.",
    "Someone could use a meal. {pet} keeps sniffing the cupboard.",
    "{pet} is getting peckish. Dinner soon.",
  ],
  checkInSad: [
    "{pet}'s been moping in the corner.",
    "{pet} is a bit low today. Some play would help.",
    "{pet} has gone quiet. Not quite themselves.",
    "{pet} could use some cheering up.",
  ],
  hello: [
    "Hello, {pet}. I'm looking after you now.",
    "Right, {pet}. You're with me from now on.",
    "Hello there, {pet}. Let's get you settled.",
    "I'll be taking care of you now, {pet}. We'll keep things tidy.",
  ],
  farewell: [
    "Off you go to the Menagerie, {pet}. Find yourself a sunny corner.",
    "Time for the Menagerie, {pet}. Be good.",
    "The Menagerie's waiting, {pet}. Find a cosy spot.",
    "Off you go, {nickname}. I'll come and visit.",
  ],
  backSoon: ["You're back!", "Oh, hello again!", "Good to see you again."],
  backLong: [
    "You've been gone ages! Welcome back.",
    "It's been so long! Welcome back.",
    "Well, look who it is, after all this time.",
  ],
  eggFound: [
    "Look what I found by the nook: an egg, still warm.",
    "There was an egg tucked beside the nook. Still warm, too.",
    "Someone left an egg by the nook. I've wrapped it up.",
    "An egg, right by the nook! Warm as toast.",
  ],
  eggFoundTalking: [
    "I found this egg while we were talking, still warm.",
    "Funny thing: while we were talking, I found an egg.",
    "Before I forget, an egg turned up while we were chatting.",
    "Look what turned up while we were talking. An egg, still warm!",
  ],
  anotherEgg: [
    "We were talking and I found an egg. It's waiting in the Menagerie.",
    "I found another egg while we were chatting. It's in the Menagerie now.",
    "Another egg turned up while we talked. I've tucked it away in the Menagerie.",
  ],
  eggFoundByOther: [
    "{finder} found an egg while they were talking with you. It's waiting in the Menagerie.",
    "{finder} turned up an egg while you two were chatting. It's in the Menagerie.",
    "News from {finder}: they found an egg while talking with you. It's waiting in the Menagerie.",
  ],
  evolveOffer: [
    "{pet}'s been so happy lately. I think they're ready to become something new. Have a look when you're ready.",
    "{pet} has been glowing lately. I think a change is coming. Have a look when you can.",
    "Something's stirring in {pet}. They seem ready to become something new. Take a look when you're ready.",
  ],
  evolve: [
    "{pet}'s evolved! Look at them now, a real {form}.",
    "Would you look at that. {pet} is a {form} now!",
    "{pet} has changed! Say hello to the new {form}.",
    "Well I never. {pet}'s become a {form}.",
  ],
  temperamentShift: [
    "Have you noticed? {pet}'s gone all {readsAs} lately. A real {name} now.",
    "{pet} has been so {readsAs} lately. Quite the {name}, if you ask me.",
    "Something's changed in {pet}: all {readsAs} these days. Pure {name}.",
  ],
  takesAfter: [
    "Have you noticed? {pet} has been a bit more {temperament} lately. I think it's picking up my ways.",
    "{pet} gets a little more {temperament} every day. I wonder where they got that from.",
    "Is it me, or is {pet} turning {temperament}? They must get it from me.",
  ],
  eggFarewell: [
    "Into the Menagerie you go, {pet}. Stay warm.",
    "Off to the Menagerie, {pet}. Someone there will keep you cosy.",
    "The Menagerie will look after you, {pet}. See you soon.",
  ],
  eggReturn: [
    "The egg's back, and still warm. Into the basket with you.",
    "Welcome home, {pet}. Your basket's ready.",
    "The egg's back with us. Under the towel you go.",
  ],
  returnHome: [
    "Welcome back, {nickname}! Still a fine {stage}, I see.",
    "There you are, {nickname}. Back in the nook where you belong.",
    "Look who's home! Hello again, {nickname}.",
    "Welcome back, {nickname}! The nook missed its {stage}.",
  ],
};

/** The house caretaker's sign-offs. */
export const HOUSE_SIGNOFFS: Record<SaucelingSignoffFeeling, string[]> = {
  pleased: ["There we are, all sorted.", "Still holding up nicely.", "That's the way."],
  worried: ["We'll get back on track.", "Nothing a bit of care won't fix.", "Let's keep a closer eye, shall we?"],
  neutral: ["Steady now.", "Try not to make a mess of the nook.", "One thing at a time."],
};

/** The line `pick` turns to, with each `{key}` filled from `values` and "a {key}" made "an {key}" before a vowel. */
function filled(lines: readonly string[], pick: number, values: Record<string, string>): string {
  return lines[Math.abs(Math.trunc(pick)) % lines.length]!.replace(
    /\b([Aa]) (?=\{(\w+)\})/gu,
    (whole, a: string, key: string) => (/^[aeiou]/iu.test(values[key] ?? "") ? `${a}n ` : whole),
  ).replace(/\{(\w+)\}/gu, (whole, key: string) => values[key] ?? whole);
}

/** What the caretaker calls the pet when they speak of it: "little egg" while it is an egg. */
function called(pet: Pick<SaucelingPet, "name" | "stage">): string {
  return pet.stage === "egg" ? EGG_CALL : pet.name;
}

/** One of the caretaker's lines for a moment, turning in order as `pick` grows: their own, else the house's.
 *  `{pet}` and `{nickname}` are filled in, and whatever else `fill` names. */
function phrase(
  profile: SaucelingCareProfile,
  moment: SaucelingPhraseMoment,
  pet: string,
  pick: number,
  fill: Record<string, string> = {},
): string {
  const own = profile.voice.phrases?.[moment] ?? [];
  const lines = own.length > 0 ? own : HOUSE_PHRASES[moment];
  return filled(lines, pick, { pet, nickname: profile.voice.petNickname || pet, ...fill });
}

/** Spreads `pick`, so whether a sign-off comes and which one does not follow the line's turn. */
function mix(pick: number): number {
  const h = Math.imul(Math.trunc(pick) | 0, 0x9e3779b1);
  return (h ^ (h >>> 16)) >>> 0;
}

/** `line` with one of the caretaker's sign-offs for `feeling` after it about one time in four, the same for the same
 *  `pick`: theirs, else the house's. A voice the model wrote before sign-offs gets none, so its catchphrases are not
 *  worn out as tags. */
function signed(line: string, profile: SaucelingCareProfile, feeling: SaucelingSignoffFeeling, pick: number): string {
  const h = mix(pick);
  if ((h & 3) !== 3) return line;
  const { signoffs } = profile.voice;
  const pool = signoffs ? (signoffs[feeling] ?? []) : profile.generatedByModel ? [] : HOUSE_SIGNOFFS[feeling];
  return pool.length > 0 ? `${line} ${pool[(h >>> 2) % pool.length]}` : line;
}

/** `whileTalking`: the caretaker found it while chatting with the player, not by the nook. */
export function templateEggFoundScene(profile: SaucelingCareProfile, whileTalking = false, pick = 0): string {
  return signed(
    phrase(profile, whileTalking ? "eggFoundTalking" : "eggFound", EGG_CALL, pick),
    profile,
    "neutral",
    pick,
  );
}

/** Said beside `pet` in the nook when its caretaker finds another egg while chatting. */
export function templateEggFoundWhileTalking(
  profile: SaucelingCareProfile,
  pet: Pick<SaucelingPet, "name" | "stage">,
  pick = 0,
): string {
  return signed(phrase(profile, "anotherEgg", called(pet), pick), profile, "neutral", pick);
}

/** Said beside `pet` in the nook by its caretaker when another character finds an egg while chatting. */
export function templateEggFoundByOther(
  profile: SaucelingCareProfile,
  pet: Pick<SaucelingPet, "name" | "stage">,
  finderName: string,
  pick = 0,
): string {
  return signed(
    phrase(profile, "eggFoundByOther", called(pet), pick, { finder: finderName }),
    profile,
    "neutral",
    pick,
  );
}

/** `kindName` is what hatched: its species name, or the kind its caretaker invented; `name` is the name it was given,
 *  once it has one. */
export function templateHatchScene(profile: SaucelingCareProfile, kindName: string, name?: string, pick = 0): string {
  const line = phrase(profile, "hatch", name ?? kindName, pick, { kind: kindName });
  const greeting = name ? `I'll call you ${name}.` : `Hello there, ${profile.voice.petNickname || kindName}.`;
  return signed(`${line} ${greeting}`, profile, "pleased", pick);
}

/** Said once, when a happy sauceling is ready to evolve; the Nook then shows Evolve…. */
export function templateEvolveOfferScene(profile: SaucelingCareProfile, petName: string, pick = 0): string {
  return signed(phrase(profile, "evolveOffer", petName, pick), profile, "pleased", pick);
}

export function templateEvolveScene(profile: SaucelingCareProfile, petName: string, form: string, pick = 0): string {
  return signed(phrase(profile, "evolve", petName, pick, { form }), profile, "pleased", pick);
}

/** Which phrasebook moment each caretaker outcome is, how they feel about it, and whether it is said to the egg. */
export const OUTCOME_LINES: Record<
  SaucelingCaretakerOutcome,
  [SaucelingPhraseMoment, SaucelingSignoffFeeling, boolean]
> = {
  "fed-fine": ["feed", "pleased", false],
  "fed-badly": ["fedBadly", "worried", false],
  overfed: ["overfed", "worried", false],
  forgot: ["forgot", "worried", false],
  played: ["play", "pleased", false],
  cuddled: ["cuddle", "pleased", false],
  "milestone-noticed": ["milestone", "pleased", false],
  "kept-warm": ["warmEgg", "neutral", true],
  "let-cool": ["letCool", "worried", true],
  chatted: ["chatEgg", "neutral", true],
};

/** `pick` turns the caretaker's phrasebook lines in order; the care window's number keeps it steady without a roll. */
export function templateCaretakerCareLine(
  profile: SaucelingCareProfile,
  petName: string,
  outcome: SaucelingCaretakerOutcome,
  pick = 0,
): string {
  const [moment, feeling, toEgg] = OUTCOME_LINES[outcome];
  return signed(phrase(profile, moment, toEgg ? EGG_CALL : petName, pick), profile, feeling, pick);
}

export function templateUserActionLine(
  pet: Pick<SaucelingPet, "name" | "species">,
  action: SaucelingUserAction,
): string {
  switch (action) {
    case "feed":
      return `You fixed ${pet.name} a proper, warm meal to cover the gap.`;
    case "play":
      return `You played a bright game with ${pet.name} until its spirits lifted.`;
    case "rest":
      return `You dimmed the nook and let ${pet.name} settle into a cozy nap.`;
    case "pet":
      return `You gave ${pet.name} gentle pats until it hummed happily.`;
    case "warm":
      return "You wrapped the egg in a warm tea towel.";
    case "talk":
      return "You told the egg about your day. It rocked a little.";
    case "listen":
      return `You held the egg to your ear and heard ${EGG_SOUNDS[pet.species]}.`;
  }
}

/** The caretaker's line when you check in, until the model writes a better one. */
export function templateCheckInLine(
  profile: SaucelingCareProfile,
  pet: Pick<SaucelingPet, "name" | "stage" | "meters">,
  pick = 0,
): string {
  const moment = checkInMoment(pet);
  const feeling = moment === "checkInEgg" ? "neutral" : moment === "checkInContent" ? "pleased" : "worried";
  return signed(phrase(profile, moment, called(pet), pick), profile, feeling, pick);
}

/** How the pet is when the player checks in: an egg, hungry, low, else content. */
export function checkInMoment(pet: Pick<SaucelingPet, "stage" | "meters">): SaucelingPhraseMoment {
  if (pet.stage === "egg") return "checkInEgg";
  return pet.meters.hunger < 50 ? "checkInHungry" : pet.meters.mood < 50 ? "checkInSad" : "checkInContent";
}

export function templateStageUpScene(
  profile: SaucelingCareProfile,
  petName: string,
  stage: SaucelingStage,
  pick = 0,
): string {
  return signed(phrase(profile, "stageUp", petName, pick, { stage }), profile, "pleased", pick);
}

export function templateTemperamentShiftScene(
  profile: SaucelingCareProfile,
  petName: string,
  temperament: SaucelingTemperamentId,
  pick = 0,
): string {
  const sauce = TEMPERAMENT_CATALOG[temperament];
  return phrase(profile, "temperamentShift", petName, pick, { readsAs: sauce.readsAs, name: sauce.name });
}

/** Said by the caretaker it has started to take after (see `SaucelingOwnTemperament`). */
export function templateTakesAfterScene(
  profile: SaucelingCareProfile,
  petName: string,
  temperament: string,
  pick = 0,
): string {
  return phrase(profile, "takesAfter", petName, pick, { temperament: temperament.toLowerCase() });
}

/** The greeting before what the caretaker did while the player was away. */
export function absenceMoment(bucket: SaucelingAbsenceBucket): SaucelingPhraseMoment {
  return bucket === "day" || bucket === "days" ? "backSoon" : "backLong";
}

export function templateAbsenceScene(
  profile: SaucelingCareProfile,
  petName: string,
  bucket: SaucelingAbsenceBucket,
  tallies: Partial<Record<SaucelingCaretakerOutcome, number>>,
  isEgg: boolean,
  pick = 0,
): string {
  const n = (outcome: SaucelingCaretakerOutcome) => tallies[outcome] ?? 0;
  let parts: string[];
  if (isEgg) {
    parts = [
      n("kept-warm") ? `kept the egg warm ${times(n("kept-warm"))}` : "",
      n("let-cool") ? `let it go cool ${times(n("let-cool"))}` : "",
      n("chatted") ? `talked to it ${times(n("chatted"))}` : "",
    ];
  } else {
    const fed = n("fed-fine") + n("fed-badly") + n("overfed");
    const forgot = n("forgot");
    parts = [
      fed && forgot
        ? `fed ${petName} ${times(fed)} but forgot ${count(forgot, "meal")}`
        : fed
          ? `fed ${petName} ${times(fed)}`
          : forgot
            ? `forgot ${petName}'s dinner ${times(forgot)}`
            : "",
      n("played") ? `played with them ${times(n("played"))}` : "",
      n("cuddled") ? `gave ${count(n("cuddled"), "cuddle")}` : "",
    ];
  }
  const done = parts.filter(Boolean);
  const report = done.length ? `While you were away I ${listed(done)}.` : "It was quiet while you were away.";
  const greeting = phrase(profile, absenceMoment(bucket), isEgg ? EGG_CALL : petName, pick);
  return signed(`${greeting} ${report}`, profile, "neutral", pick);
}

export function templateFarewellScene(profile: SaucelingCareProfile, petName: string, pick = 0): string {
  return signed(phrase(profile, "farewell", petName, pick), profile, "neutral", pick);
}

export function templateEggFarewellScene(profile: SaucelingCareProfile, pick = 0): string {
  return phrase(profile, "eggFarewell", EGG_CALL, pick);
}

export function templateEggReturnScene(profile: SaucelingCareProfile, pick = 0): string {
  return phrase(profile, "eggReturn", EGG_CALL, pick);
}

/** A new caretaker's hello on taking over, until the model writes a better one. */
export function templateCaretakerHello(
  profile: SaucelingCareProfile,
  pet: Pick<SaucelingPet, "name" | "stage">,
  pick = 0,
): string {
  return signed(phrase(profile, "hello", called(pet), pick), profile, "neutral", pick);
}

export function templateReturnScene(
  profile: SaucelingCareProfile,
  petName: string,
  stage: SaucelingStage,
  pick = 0,
): string {
  return signed(phrase(profile, "returnHome", petName, pick, { stage }), profile, "pleased", pick);
}
