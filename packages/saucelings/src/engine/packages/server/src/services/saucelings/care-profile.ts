import { createHash } from "node:crypto";
import type { CapabilityCharacterRecord } from "@marinara-engine/shared";
import { spokenLine } from "../../../../shared/src/features/agents/saucelings/templates.js";
import {
  SAUCELING_ROUTINE_MOMENTS,
  SAUCELING_SCENE_MOMENTS,
  SAUCELING_SCORED_TEMPERAMENTS,
  SAUCELING_SIGNOFF_FEELINGS,
  ORDINARY_SPECIES,
  type SaucelingCareProfile,
  type SaucelingCharacterSummary,
  type SaucelingPhraseMoment,
  type SaucelingScoredTemperamentId,
  type SaucelingSignoffFeeling,
  type SaucelingSpeciesId,
} from "../../../../shared/src/features/agents/saucelings/types.js";
import { neutralCareProfile } from "../../../../shared/src/features/agents/saucelings/vocabulary.js";
import { getSaucelingsRuntime } from "./package-runtime.js";

/** Past this the profile call is abandoned and the caretaker keeps the profile they had. */
const PROFILE_TIMEOUT_MS = 30_000;
/** Room for the speech style as well as the tendencies. */
const PROFILE_MAX_TOKENS = 900;
/** Each phrasebook call is about sixty lines (four for each routine moment and nine sign-offs, or three for each
 *  one-off moment): longer to write than the profile. */
const PHRASEBOOK_TIMEOUT_MS = 60_000;
const PHRASEBOOK_MAX_TOKENS = 2000;

export function parseRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return parseRecord(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function clampUnit(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Number(Math.max(0, Math.min(1, value)).toFixed(2));
}

export function cleanText(value: unknown, maxLen: number, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().replace(/\s+/g, " ").slice(0, maxLen);
  return trimmed || fallback;
}

/** A line the templates say as it is: spoken words only, and short enough to fit the message box; else "". */
function spoken(value: unknown, speaker: string, maxLen: number): string {
  const line = spokenLine(cleanText(value, 400), speaker);
  return line.length <= maxLen ? line : "";
}

/** Every card field that shows who the character is and how they talk, with {{char}} and {{user}} filled in. */
function readCard(record: CapabilityCharacterRecord) {
  const root = parseRecord(record.data);
  const nested = parseRecord(root.data);
  const extensions = parseRecord(nested.extensions ?? root.extensions);
  const name = cleanText(nested.name ?? root.name, 80, record.comment || "Caretaker");
  const fill = (value: unknown, maxLen: number) =>
    typeof value === "string"
      ? cleanText(value.replace(/\{\{char\}\}/giu, name).replace(/\{\{user\}\}/giu, "the player"), maxLen)
      : "";
  const field = (key: string, maxLen: number) => fill(nested[key] ?? root[key], maxLen);
  const greetings = nested.alternate_greetings ?? root.alternate_greetings;
  const rawTags = nested.tags ?? root.tags;
  return {
    name,
    description: field("description", 1200),
    personality: field("personality", 1200),
    // The Engine keeps the backstory in an extension; older cards had a top-level lore field.
    backstory: fill(extensions.backstory, 1200) || field("character_Lore", 1200),
    scenario: field("scenario", 600),
    systemPrompt: field("system_prompt", 600),
    postHistory: field("post_history_instructions", 400),
    depthPrompt: fill(parseRecord(extensions.depth_prompt).prompt, 400),
    // <START> only separates example chats; it tells the model nothing.
    dialogue: field("mes_example", 800)
      .replace(/<START>\s*/giu, "")
      .trim(),
    firstMessage: field("first_mes", 800) || fill(Array.isArray(greetings) ? greetings[0] : undefined, 800),
    appearance: fill(extensions.appearance ?? nested.appearance ?? root.appearance, 400),
    notes: field("creator_notes", 600) || cleanText(record.comment, 300),
    tags: Array.isArray(rawTags)
      ? rawTags
          .filter((t): t is string => typeof t === "string")
          .slice(0, 12)
          .join(", ")
      : cleanText(rawTags, 200),
  };
}

type CardFields = ReturnType<typeof readCard>;

function labelled(card: CardFields, labels: Array<[string, keyof CardFields]>): string {
  return labels
    .filter(([, key]) => card[key])
    .map(([label, key]) => `${label}: ${card[key]}`)
    .join("\n");
}

const WHO_LABELS: Array<[string, keyof CardFields]> = [
  ["Personality", "personality"],
  ["Description", "description"],
  ["Backstory", "backstory"],
  ["System prompt", "systemPrompt"],
  ["Post-history instructions", "postHistory"],
  ["Depth prompt", "depthPrompt"],
];
const TALK_LABELS: Array<[string, keyof CardFields]> = [
  ["Example dialogue", "dialogue"],
  ["First message", "firstMessage"],
];

export function extractReducedCard(record: CapabilityCharacterRecord): {
  id: string;
  name: string;
  summaryText: string;
  cardDigest: string;
  shortDescription: string;
} {
  const card = readCard(record);
  const summaryText = [
    `Name: ${card.name}`,
    labelled(card, [
      ["Description", "description"],
      ["Personality", "personality"],
      ["Backstory", "backstory"],
      ["Scenario", "scenario"],
      ["System prompt", "systemPrompt"],
      ["Post-history instructions", "postHistory"],
      ["Depth prompt", "depthPrompt"],
      ...TALK_LABELS,
      ["Appearance", "appearance"],
      ["Notes", "notes"],
      ["Tags", "tags"],
    ]),
  ]
    .filter(Boolean)
    .join("\n");
  const cardDigest = createHash("sha256").update(summaryText).digest("hex").slice(0, 16);

  return {
    id: record.id,
    name: card.name,
    summaryText,
    cardDigest,
    shortDescription: shortDescription(card),
  };
}

function shortDescription(card: CardFields): string {
  return cleanText(card.personality || card.description || card.notes, 140, "Ready to look after a sauceling.");
}

/** Who the caretaker is and how they talk, from their card, for the model that writes their lines. */
export function cardPersona(record: CapabilityCharacterRecord): { who: string; talk: string } {
  const card = readCard(record);
  return { who: labelled(card, WHO_LABELS).slice(0, 1500), talk: labelled(card, TALK_LABELS).slice(0, 600) };
}

export async function listCaretakerCandidates(): Promise<Omit<SaucelingCharacterSummary, "hasVoice">[]> {
  const records = await getSaucelingsRuntime().resources.listCharacters();
  return records
    .map((record) => {
      const card = readCard(record);
      return { id: record.id, name: card.name, description: shortDescription(card) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function heuristicTendenciesFromText(text: string) {
  const lower = text.toLowerCase();
  let feedReliability = 0.65;
  let overfeeding = 0.25;
  let playfulness = 0.55;
  let affection = 0.55;
  let attentiveness = 0.6;
  let consistency = 0.65;

  if (/doting|motherly|caring|cook|bake|warm|sweet|gentle|nurtur/u.test(lower)) {
    feedReliability += 0.2;
    overfeeding += 0.3;
    affection += 0.25;
  }
  if (/scatter|forget|chaotic|lazy|airhead|distract|messy|impuls/u.test(lower)) {
    feedReliability -= 0.28;
    consistency -= 0.3;
    playfulness += 0.2;
  }
  if (/cold|genius|doctor|scientist|aloof|strict|calculat|analytic|dottore/u.test(lower)) {
    attentiveness += 0.3;
    affection -= 0.35;
    playfulness -= 0.2;
    consistency += 0.2;
  }
  if (/playful|energetic|cheerful|bubbly|mischief|prank|adventur/u.test(lower)) {
    playfulness += 0.3;
  }

  return {
    feedReliability: clampUnit(feedReliability, 0.65),
    overfeeding: clampUnit(overfeeding, 0.25),
    playfulness: clampUnit(playfulness, 0.55),
    affection: clampUnit(affection, 0.55),
    attentiveness: clampUnit(attentiveness, 0.6),
    consistency: clampUnit(consistency, 0.65),
  };
}

/** A caretaker leans only to ordinary species: special and Halloween eggs come from milestones and the season. */
function normalizeSpeciesLean(raw: unknown, fallback: SaucelingSpeciesId[]): SaucelingSpeciesId[] {
  const valid = new Set<string>(ORDINARY_SPECIES);
  const picked = Array.isArray(raw)
    ? raw.filter((item): item is SaucelingSpeciesId => typeof item === "string" && valid.has(item))
    : [];
  return [...new Set([...picked, ...fallback.filter((id) => valid.has(id))])];
}

function normalizeTemperamentLean(
  raw: unknown,
  fallback: SaucelingScoredTemperamentId[],
): SaucelingScoredTemperamentId[] {
  const valid = new Set<string>(SAUCELING_SCORED_TEMPERAMENTS);
  const picked = Array.isArray(raw)
    ? raw.filter((item): item is SaucelingScoredTemperamentId => typeof item === "string" && valid.has(item))
    : [];
  return [...new Set([...picked, ...fallback])];
}

export function normalizeCareProfile(
  raw: unknown,
  characterId: string,
  characterName: string,
  cardDigest: string,
  generatedByModel: boolean,
): SaucelingCareProfile {
  const base = neutralCareProfile(characterId, characterName, cardDigest);
  const obj = parseRecord(raw);
  const tendenciesObj = parseRecord(obj.tendencies);
  const voiceObj = parseRecord(obj.voice);
  // Only their own words: the house's would read as theirs in every line the model writes.
  const catchphrases = Array.isArray(voiceObj.catchphrases)
    ? voiceObj.catchphrases
        .map((c) => spoken(c, characterName, 120))
        .filter(Boolean)
        .slice(0, 3)
    : [];
  const rawWorry = typeof voiceObj.worryLevel === "number" ? Math.round(voiceObj.worryLevel) : 1;
  const worryLevel = Math.max(0, Math.min(3, rawWorry)) as 0 | 1 | 2 | 3;

  return {
    characterId,
    characterName,
    cardDigest,
    generatedByModel,
    tendencies: {
      feedReliability: clampUnit(tendenciesObj.feedReliability, base.tendencies.feedReliability),
      overfeeding: clampUnit(tendenciesObj.overfeeding, base.tendencies.overfeeding),
      playfulness: clampUnit(tendenciesObj.playfulness, base.tendencies.playfulness),
      affection: clampUnit(tendenciesObj.affection, base.tendencies.affection),
      attentiveness: clampUnit(tendenciesObj.attentiveness, base.tendencies.attentiveness),
      consistency: clampUnit(tendenciesObj.consistency, base.tendencies.consistency),
    },
    voice: {
      petNickname: cleanText(voiceObj.petNickname, 40),
      feedingStyle: cleanText(voiceObj.feedingStyle, 90),
      catchphrases,
      voiceSample: spoken(voiceObj.voiceSample, characterName, 160),
      worryLevel,
      speechStyle: cleanText(voiceObj.speechStyle, 400),
      phrases: {},
    },
    speciesLean: normalizeSpeciesLean(obj.speciesLean, base.speciesLean),
    temperamentLean: normalizeTemperamentLean(obj.temperamentLean, base.temperamentLean),
    updatedAt: new Date().toISOString(),
  };
}

/** What each moment is, for the model writing the caretaker's lines. */
export const MOMENT_BRIEFS: Record<SaucelingPhraseMoment, string> = {
  feed: "serving the pet its dinner, said to the pet",
  fedBadly: "telling the player they made a poor dinner (burnt, lumpy) and the pet ate it anyway",
  overfed: "telling the player they gave the pet far too much",
  forgot: "telling the player they forgot the pet's dinner",
  play: "playing a game with the pet, said to the pet",
  cuddle: "cuddling the pet, said to the pet",
  milestone: "telling the player the pet is coming along well",
  warmEgg: "keeping the egg warm, said to the egg",
  letCool: "telling the player they let the egg get cold",
  chatEgg: "chatting to the egg about their day, said to the egg",
  hatch: "the egg is hatching, said to the player",
  stageUp: "the pet has grown into its next life stage, said to the player",
  hello: "taking over as the pet's caretaker from someone else, said to the pet",
  farewell: "sending the pet off to live in the Menagerie, said to the pet",
  checkInEgg: "the player asks how the egg is, and it is doing fine",
  checkInContent: "the player asks how the pet is, and it is fed and happy",
  checkInHungry: "the player asks how the pet is, and it is hungry",
  checkInSad: "the player asks how the pet is, and it is unhappy",
  backSoon: "greeting the player, back after a day or a few days away",
  backLong: "greeting the player, back after a week or more away",
  returnHome: "welcoming the pet back to the nook from the Menagerie, said to the pet",
  eggFound: "telling the player you found an egg by the nook",
  eggFoundTalking: "telling the player you found an egg while chatting with them",
  anotherEgg:
    "telling the player you found another egg while chatting with them; it is not the pet, it waits in the Menagerie",
  eggFoundByOther:
    "telling the player another character found an egg while chatting with them; it is not the pet, it waits in the Menagerie",
  evolveOffer: "telling the player the pet seems ready to become something new, and to have a look",
  evolve: "the pet has just evolved into something new, said to the player",
  temperamentShift: "telling the player the pet's temperament has changed",
  takesAfter: "telling the player the pet is picking up your own ways",
  eggFarewell: "sending the egg off to the Menagerie, said to the egg",
  eggReturn: "the egg is back in the nook from the Menagerie, said to the egg",
};

/** The {...} a moment fills in besides {pet} and {nickname}, and what each stands for; a line with any other is
 *  dropped. */
export const PHRASE_FILLS: Partial<Record<SaucelingPhraseMoment, Record<string, string>>> = {
  hatch: { kind: "what hatched" },
  stageUp: { stage: "the new stage" },
  returnHome: { stage: "its life stage" },
  eggFoundByOther: { finder: "who found it" },
  evolve: { form: "what it became" },
  temperamentShift: { readsAs: "how it behaves now, a few words such as bright, bouncy, chatty" },
  takesAfter: { temperament: "the way it is turning, a few words" },
};

/** The model's phrasebook for `moments`: up to four spoken lines per moment and three sign-offs per feeling, each short
 *  and using only the {...} the templates fill in. A moment with no line is left out. */
export function normalizePhrasebook(
  raw: unknown,
  characterName: string,
  moments: readonly SaucelingPhraseMoment[],
): Pick<SaucelingCareProfile["voice"], "phrases" | "signoffs"> {
  const obj = parseRecord(raw);
  const lines = (value: unknown, maxLen: number, fills: string[], max: number) =>
    Array.isArray(value)
      ? value
          .map((line) => spoken(line, characterName, maxLen))
          .filter((line) => line && [...line.matchAll(/\{(\w*)\}/gu)].every(([, key]) => fills.includes(key!)))
          .slice(0, max)
      : [];
  const phrasesObj = parseRecord(obj.phrases);
  const signoffsObj = parseRecord(obj.signoffs);
  return {
    phrases: Object.fromEntries(
      moments
        .map((moment) => [
          moment,
          lines(phrasesObj[moment], 120, ["pet", "nickname", ...Object.keys(PHRASE_FILLS[moment] ?? {})], 4),
        ])
        .filter(([, said]) => said.length > 0),
    ),
    signoffs: Object.fromEntries(
      SAUCELING_SIGNOFF_FEELINGS.map((feeling) => [feeling, lines(signoffsObj[feeling], 60, [], 3)]),
    ) as Record<SaucelingSignoffFeeling, string[]>,
  };
}

type CareCard = ReturnType<typeof extractReducedCard>;

async function readCareCard(characterId: string): Promise<CareCard | null> {
  const [record] = await getSaucelingsRuntime().resources.listCharacters([characterId]);
  return record ? extractReducedCard(record) : null;
}

/** A profile the writing connection made from the caretaker's card, with a speech style: their own voice. */
export function hasOwnVoice(profile: SaucelingCareProfile | null | undefined): profile is SaucelingCareProfile {
  return Boolean(profile?.generatedByModel && profile.voice.speechStyle);
}

/** A caretaker's profile without the model: their own voice when they have one (an edited card keeps it, under the
 *  card's current name, until Refresh remakes it), else one guessed from their card's words. A missing card gets
 *  the neutral profile. */
export async function careProfileNow(
  characterId: string,
  cached?: SaucelingCareProfile,
): Promise<SaucelingCareProfile> {
  const card = await readCareCard(characterId);
  if (!card) return neutralCareProfile(characterId, "Caretaker", "missing");
  if (hasOwnVoice(cached)) return { ...cached, characterName: card.name };
  const heuristic = heuristicTendenciesFromText(card.summaryText);
  return {
    ...neutralCareProfile(card.id, card.name, card.cardDigest),
    tendencies: heuristic,
    temperamentLean:
      heuristic.attentiveness > 0.7 && heuristic.affection < 0.35
        ? ["truffoddity", "seppy", "zesto", "alfredoze", "carbonuzzle", "rabbratty"]
        : heuristic.overfeeding > 0.45
          ? ["alfredoze", "carbonuzzle", "zesto", "rabbratty", "seppy", "truffoddity"]
          : heuristic.feedReliability < 0.45
            ? ["rabbratty", "seppy", "zesto", "carbonuzzle", "alfredoze", "truffoddity"]
            : [],
  };
}

/** The writing connection's parsed JSON answer to a prompt. Throws when there is no connection, the call fails or
 *  times out, or the answer cannot be parsed; callers decide what a failure means. */
export async function askJson(
  prompt: Array<{ role: "system" | "user"; content: string }>,
  connectionId: string | null,
  options: { maxTokens: number; temperature: number; timeoutMs: number },
): Promise<unknown> {
  const runtime = getSaucelingsRuntime();
  const agentConfig = await runtime.getAgentConfig();
  const model = await runtime.languageModels.resolveForRequest({
    connectionId: connectionId ?? agentConfig?.connectionId ?? null,
  });
  const fitted = model.fitContext(prompt, { maxTokens: options.maxTokens });
  const completion = await model.chatComplete(fitted.messages, {
    maxTokens: fitted.maxTokens ?? options.maxTokens,
    temperature: options.temperature,
    reasoningEffort: "none",
    debugMode: runtime.isDebugAgentsEnabled(),
    responseFormat: { type: "json_object" },
    signal: AbortSignal.timeout(options.timeoutMs),
  });
  return runtime.json.parseJsonish(completion.content ?? "");
}

/** The writing connection's JSON object answer to a system prompt about the card, or null when there is no
 *  connection, the call fails or the answer is not a JSON object. */
async function askCardJson(
  system: string,
  card: CareCard,
  connectionId: string | null,
  options: { maxTokens: number; temperature: number; timeoutMs: number },
): Promise<object | null> {
  try {
    const parsed = await askJson(
      [
        { role: "system", content: system },
        { role: "user", content: card.summaryText },
      ],
      connectionId,
      options,
    );
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // No model connection, or the call failed
  }
  return null;
}

/** The model's profile for a card, or null when there is no connection or the call fails. */
async function modelCareProfile(card: CareCard, connectionId: string | null): Promise<SaucelingCareProfile | null> {
  const system = [
    "You reduce a character card into a JSON care profile for a Tamagotchi-style pet called a sauceling.",
    "Read every field: the personality, description, backstory, instructions and example dialogue all show how this character behaves and talks.",
    "Species ids: rigamuffin (scruffy tube), fluttino (hovering bow-wings), lentino (long knot-tying noodle), shellbini (shy shell), tortellump (plump homebody dumpling), mossaboo (slow mossy stone tortoise), puddlepip (splashy raindrop frog), snufflump (sleepy dust bunny), burrowl (busy digging owl-mole).",
    "Temperament ids: zesto (bright/chatty), carbonuzzle (warm/clingy), rabbratty (feisty/spoiled), seppy (gloomy/neglected), alfredoze (sleepy/overfed), truffoddity (brilliant/coldly studied).",
    "tendencies: how this character would look after a pet, each from 0 to 1 and read from the card: feedReliability (feeds it on time), overfeeding (gives it too much), playfulness, affection, attentiveness (notices how it is) and consistency (keeps a routine). The numbers in the example below are placeholders, not answers.",
    "voice.worryLevel: how much they fret over the pet, from 0 (never) to 3 (constantly).",
    "voice.speechStyle: 2 to 3 sentences on how they talk: tone, word choice, sentence length, verbal habits, how they address people, and how they would speak to a tiny pet.",
    "voice.catchphrases and voice.voiceSample are spoken words only: no narration, no actions, no asterisks, no quotation marks.",
    "Return ONLY JSON matching:",
    '{"tendencies":{"feedReliability":0.5,"overfeeding":0.5,"playfulness":0.5,"affection":0.5,"attentiveness":0.5,"consistency":0.5},"voice":{"petNickname":"string","feedingStyle":"short verb phrase","catchphrases":["line1","line2","line3"],"voiceSample":"one sentence they would say out loud","worryLevel":1,"speechStyle":"2 to 3 sentences"},"speciesLean":["rigamuffin","fluttino","lentino","shellbini","tortellump","mossaboo","puddlepip","snufflump","burrowl"],"temperamentLean":["zesto","carbonuzzle","rabbratty","seppy","alfredoze","truffoddity"]}',
  ].join("\n");
  const parsed = await askCardJson(system, card, connectionId, {
    maxTokens: PROFILE_MAX_TOKENS,
    temperature: 0.4,
    timeoutMs: PROFILE_TIMEOUT_MS,
  });
  return parsed ? normalizeCareProfile(parsed, card.id, card.name, card.cardDigest, true) : null;
}

/** One of the caretaker's phrasebook calls, written once in the voice their profile found: the routine moments, with
 *  four lines each and sign-offs, or the one-off moments, with three. Null when the call fails. */
async function modelPhrasebook(
  card: CareCard,
  record: CapabilityCharacterRecord,
  profile: SaucelingCareProfile,
  connectionId: string | null,
  routine: boolean,
): Promise<Pick<SaucelingCareProfile["voice"], "phrases" | "signoffs"> | null> {
  const { characterName: name, voice } = profile;
  const persona = cardPersona(record);
  const moments = routine ? SAUCELING_ROUTINE_MOMENTS : SAUCELING_SCENE_MOMENTS;
  const count = routine ? 4 : 3;
  const system = [
    `You write a phrasebook for ${name}, who looks after a little pet in the virtual pet game Saucelings.`,
    routine
      ? `The lines are said out loud exactly as written at routine moments, so each must sound like ${name} and make sense on its own.`
      : `The lines are said out loud exactly as written at one-off moments, so each must sound like ${name} and make sense on its own.`,
    persona.who ? `Who ${name} is, from their character card:\n${persona.who}` : "",
    voice.speechStyle ? `How ${name} talks: ${voice.speechStyle}` : "",
    voice.petNickname ? `${name} calls the pet "${voice.petNickname}".` : "",
    voice.voiceSample ? `A line in ${name}'s voice: ${JSON.stringify(voice.voiceSample)}.` : "",
    voice.catchphrases.length > 0
      ? `These lines come round again and again, so keep ${name}'s catchphrases out of them: ${JSON.stringify(voice.catchphrases)}.`
      : "",
    `For each moment below, write ${count} different lines, each under 120 characters, in first person.`,
    "Spoken words only: no narration, no actions, no asterisks, no quotation marks.",
    `Make the ${count} lines different from each other: don't start two the same way.`,
    `Write {pet} where the pet's name goes and {nickname} where ${name} would use their pet name for it.`,
    "Egg moments are said to an unhatched egg or about a new one: never guess or name what is inside it.",
    "Moments:",
    ...moments.map((moment) =>
      [
        `- ${moment}: ${MOMENT_BRIEFS[moment]}`,
        ...Object.entries(PHRASE_FILLS[moment] ?? {}).map(([key, meaning]) => `write {${key}} for ${meaning}`),
        ...(moment === "backSoon" || moment === "backLong"
          ? ["only the greeting: what you did meanwhile is said after it"]
          : []),
      ].join("; "),
    ),
    routine
      ? `signoffs: short tags (under 60 characters) ${name} might add after any line: 3 pleased, 3 worried, 3 neutral, all different and none of them a catchphrase.`
      : "",
    routine
      ? 'Return ONLY JSON: {"phrases":{"feed":["..."],...},"signoffs":{"pleased":["..."],"worried":["..."],"neutral":["..."]}}'
      : 'Return ONLY JSON: {"phrases":{"hello":["..."],...}}',
  ]
    .filter(Boolean)
    .join("\n");
  const parsed = await askCardJson(system, card, connectionId, {
    maxTokens: PHRASEBOOK_MAX_TOKENS,
    temperature: 0.7,
    timeoutMs: PHRASEBOOK_TIMEOUT_MS,
  });
  return parsed ? normalizePhrasebook(parsed, name, moments) : null;
}

/** The caretaker's own voice, made once by the writing connection from their card: a profile, then the two parts of
 *  their phrasebook in that voice, side by side. Null when the card is missing, there is no connection, the profile
 *  call fails or its answer has no speech style; a part that fails keeps the profile, and the house phrasebook speaks
 *  for them at those moments. */
export async function makeCareVoice(
  characterId: string,
  connectionId: string | null,
): Promise<SaucelingCareProfile | null> {
  const [record] = await getSaucelingsRuntime().resources.listCharacters([characterId]);
  if (!record) return null;
  const card = extractReducedCard(record);
  const made = await modelCareProfile(card, connectionId);
  if (!hasOwnVoice(made)) return null;
  const [routine, scenes] = await Promise.all([
    modelPhrasebook(card, record, made, connectionId, true),
    modelPhrasebook(card, record, made, connectionId, false),
  ]);
  return {
    ...made,
    voice: {
      ...made.voice,
      phrases: { ...routine?.phrases, ...scenes?.phrases },
      ...(routine ? { signoffs: routine.signoffs } : {}),
    },
  };
}
