import {
  absenceMoment,
  checkInMoment,
  OUTCOME_LINES,
  spokenLine,
  templateHatchScene,
  templateTakesAfterScene,
} from "../../../../shared/src/features/agents/saucelings/templates.js";
import {
  isPasta,
  nookPlace,
  petKind,
  temperamentOf,
} from "../../../../shared/src/features/agents/saucelings/vocabulary.js";
import type {
  SaucelingBudgetUsage,
  SaucelingCareProfile,
  SaucelingEvent,
  SaucelingPet,
  SaucelingPhraseMoment,
  SaucelingSettings,
  SaucelingWorldDocument,
} from "../../../../shared/src/features/agents/saucelings/types.js";
import { askJson, cardPersona, MOMENT_BRIEFS } from "./care-profile.js";
import { generateNature } from "./design.js";
import { getSaucelingsRuntime } from "./package-runtime.js";
import { MAX_JOURNAL_ENTRIES } from "./simulation.js";
import { readSaucelingWorld, updateSaucelingWorld } from "./store.js";
import { ownTemperamentDue } from "./temperament.js";

/** Past this a model line is abandoned and the template line stays. */
const LINE_TIMEOUT_MS = 20_000;
/** At most this many model lines per save, so a tick stays quick. */
const MAX_LINES_PER_SAVE = 2;
/** With "every line from the model" on, at most this many lines per save, so a tick that makes many still ends. */
const EVERY_LINE_MAX_PER_SAVE = 6;

/** Starts the id of a caretaker's "I found an egg while we were talking" line, which sits in another pet's journal. */
export const FOUND_LINE_PREFIX = "found-";
/** Starts the id of a caretaker's "it is picking up my ways" line. */
const TAKES_AFTER_PREFIX = "takes-after-";

export function currentDayKey(nowIso: string): string {
  return nowIso.slice(0, 10);
}

export function normalizeBudgetForDay(budget: SaucelingBudgetUsage, nowIso: string): SaucelingBudgetUsage {
  const day = currentDayKey(nowIso);
  if (budget.day !== day) return { day, used: 0 };
  return { day, used: Math.max(0, Math.trunc(budget.used || 0)) };
}

function eventPriority(ev: SaucelingEvent): number {
  switch (ev.kind) {
    case "check-in":
      return 110; // the player asked for this one
    case "farewell":
    case "egg-found":
    case "hatch":
    case "return-from-album":
    case "evolve":
    case "evolve-offer":
    case "caretaker-change":
      return 100;
    case "temperament-shift":
      return 90;
    case "stage-up":
      return 85;
    case "absence":
      return 80;
    case "caretaker-care":
      if (ev.outcome === "forgot" || ev.outcome === "overfed" || ev.outcome === "fed-badly") return 60;
      if (ev.outcome === "milestone-noticed") return 55;
      return 20;
    default:
      return 0;
  }
}

/** Lines the player asked for with a click (Check in, a new caretaker's hello, a welcome back, a farewell): always
 *  written when picked, and never counted against the daily limit. */
function isClickLine(ev: SaucelingEvent): boolean {
  return (
    ev.kind === "check-in" ||
    ev.kind === "caretaker-change" ||
    ev.kind === "return-from-album" ||
    ev.kind === "farewell"
  );
}

function isSceneEvent(ev: SaucelingEvent): boolean {
  return (
    ev.kind === "egg-found" ||
    ev.kind === "hatch" ||
    ev.kind === "stage-up" ||
    ev.kind === "absence" ||
    ev.kind === "farewell" ||
    ev.kind === "return-from-album" ||
    ev.kind === "evolve" ||
    ev.kind === "evolve-offer"
  );
}

/** Which phrasebook moment a caretaker's line is, or null for a line that is not theirs. */
function lineMoment(
  ev: SaucelingEvent,
  pet: Pick<SaucelingPet, "stage" | "meters" | "foundBy">,
): SaucelingPhraseMoment | null {
  const egg = pet.stage === "egg";
  switch (ev.kind) {
    case "caretaker-care":
      return ev.outcome ? OUTCOME_LINES[ev.outcome][0] : null;
    case "check-in":
      return checkInMoment(pet);
    case "caretaker-change":
      return "hello";
    case "farewell":
      return egg ? "eggFarewell" : "farewell";
    case "return-from-album":
      return egg ? "eggReturn" : "returnHome";
    case "absence":
      return ev.absenceBucket ? absenceMoment(ev.absenceBucket) : null;
    case "egg-found":
      if (ev.id.startsWith(FOUND_LINE_PREFIX)) return ev.finder ? "eggFoundByOther" : "anotherEgg";
      return pet.foundBy ? "eggFoundTalking" : "eggFound";
    case "hatch":
      return "hatch";
    case "stage-up":
      return "stageUp";
    case "evolve-offer":
      return "evolveOffer";
    case "evolve":
      return "evolve";
    case "temperament-shift":
      return ev.id.startsWith(TAKES_AFTER_PREFIX) ? "takesAfter" : "temperamentShift";
    default:
      return null;
  }
}

export async function generateLineWithModel(options: {
  profile: SaucelingCareProfile;
  pet: Pick<
    SaucelingPet,
    | "name"
    | "species"
    | "design"
    | "stage"
    | "temperament"
    | "ownTemperament"
    | "quirk"
    | "traits"
    | "meters"
    | "journal"
    | "foundBy"
    | "evolution"
  >;
  event: SaucelingEvent;
  settings: SaucelingSettings;
  /** What the Nook's background shows (see nookPlace), or null when nothing describes it. */
  place?: string | null;
}): Promise<string | null> {
  const runtime = getSaucelingsRuntime();
  try {
    const sp = petKind(options.pet);
    const temper = temperamentOf(options.pet);
    const scene = isSceneEvent(options.event);
    const egg = options.pet.stage === "egg";
    const checkIn = options.event.kind === "check-in";
    const hello = options.event.kind === "caretaker-change";
    const { meters } = options.pet;
    const { characterName: name, voice, generatedByModel: voiced } = options.profile;
    const moment = lineMoment(options.event, options.pet);
    const foundElsewhere = options.event.kind === "egg-found" && options.event.id.startsWith(FOUND_LINE_PREFIX);
    // Only a voice read from their card: the house's nickname and sayings would make every caretaker sound alike.
    const own = (text: string) => (voiced ? text : "");
    // A catchphrase now and then, not in every line, so it stays theirs instead of a tic.
    const catchphrase =
      voiced && voice.catchphrases.length > 0 && Math.random() < 0.25
        ? voice.catchphrases[Math.floor(Math.random() * voice.catchphrases.length)]
        : undefined;
    // The card is read fresh, so an edit to it shows in the next line; the house caretaker has none.
    const [record] = await runtime.resources.listCharacters([options.profile.characterId]);
    const persona = record ? cardPersona(record) : { who: "", talk: "" };
    const prompt = [
      {
        role: "system" as const,
        content: [
          `You are ${name}, looking after a little pet in the virtual pet game Saucelings.`,
          `Write what ${name} says out loud right now, in first person: tell the player (you) what happened or how the pet is, or speak to the pet directly.`,
          "Spoken words only: no narration, no actions or stage directions, no asterisks, no quotation marks, and no name label in front.",
          scene
            ? "Say 2 to 3 spoken sentences."
            : checkIn || hello
              ? "Say 1 or 2 spoken sentences."
              : "Say one short spoken line.",
          persona.who ? `Who ${name} is, from their character card:\n${persona.who}` : "",
          persona.talk ? `How ${name} talks in their card (match the voice, not the situation):\n${persona.talk}` : "",
          voice.speechStyle ? `How ${name} talks: ${voice.speechStyle}` : "",
          voice.petNickname && own(`${name} calls the pet "${voice.petNickname}".`),
          voice.feedingStyle && own(`At mealtimes ${name} ${voice.feedingStyle}.`),
          voice.voiceSample && own(`A line in ${name}'s voice: ${JSON.stringify(voice.voiceSample)}.`),
          catchphrase ? `One of ${name}'s catchphrases, to use only if it fits: ${JSON.stringify(catchphrase)}.` : "",
          options.place
            ? `Where ${name} and the pet are right now, the Nook's background: ${options.place}. Mention it only when it fits.`
            : "",
          ...(egg
            ? [
                "Pet: an unhatched egg. What will hatch is a secret: never name it, guess its kind or describe what is inside.",
              ]
            : [
                // A pet carries its kind's name until it is named (see nameHatchling), as a found one may for good.
                options.pet.name === sp.name
                  ? "The pet has no name yet; do not make one up."
                  : options.event.kind === "hatch"
                    ? `${name} has just named it ${options.pet.name}: say its new name. Call it ${options.pet.name}.`
                    : `Pet's name: ${options.pet.name}. Call it ${options.pet.name}.`,
                `Kind: ${sp.name} (${sp.look}). Life stage: ${options.pet.stage}.`,
                `Its traits: ${options.pet.traits.join(", ")}. Its habit: ${options.pet.quirk}`,
                isPasta(options.pet) ? "" : "It is not pasta or food: no pasta or sauce jokes about it.",
                temper
                  ? `Its temperament: ${temper.name}, ${temper.readsAs}. That is how it behaves, not its name: never call it that or put it before its name or kind. Let it show in what you say: how it is acting, what it wants, and how you handle a pet like that.`
                  : "",
              ]),
          foundElsewhere
            ? `A new egg was just found by ${options.event.finder ?? name} while talking with the player. It is not this pet: it waits in the Menagerie. Say so, and never name or describe what is inside it.`
            : "",
          hello
            ? `${name} has just become this pet's caretaker, taking over from someone else: say hello to the pet and the player.`
            : "",
          checkIn
            ? `The player just asked how the pet is doing: tell them how it is right now. Go by its meters (0 to 100, higher is better) but say it in words, never the numbers${egg ? "" : ", and let its temperament, traits and habit show in what it is up to"}. The recent journal says what happened lately.`
            : "",
          options.event.kind === "absence"
            ? "Greet the player, then tell them what you did while they were away, going by the tallies: say it in words, never as a list."
            : "",
          "The JSON below is what just happened: its moment says what this line is for.",
          "Make it sound fresh: don't open or close with a catchphrase or stock tag, and don't reuse wording from the recent journal.",
          'Return ONLY JSON: {"text":"..."}',
        ]
          .filter(Boolean)
          .join("\n"),
      },
      {
        role: "user" as const,
        content: JSON.stringify({
          eventKind: options.event.kind,
          outcome: options.event.outcome,
          absenceBucket: options.event.absenceBucket,
          tallies: options.event.tallies,
          ...(moment ? { moment: MOMENT_BRIEFS[moment] } : {}),
          ...(moment === "stageUp" || moment === "returnHome"
            ? { stage: options.event.stage ?? options.pet.stage }
            : {}),
          ...(moment === "evolve" && options.pet.evolution?.look ? { form: options.pet.evolution.look.form } : {}),
          ...(options.event.finder ? { finder: options.event.finder } : {}),
          ...(checkIn
            ? {
                meters: egg
                  ? { warmth: meters.warmth, bond: meters.bond }
                  : { fullness: meters.hunger, mood: meters.mood, bond: meters.bond },
              }
            : {}),
          recentJournal: options.pet.journal
            .filter((ev) => ev.id !== options.event.id)
            .slice(0, 3)
            .map((ev) => recalled(ev, options.pet)),
        }),
      },
    ];
    const parsed = (await askJson(prompt, options.settings.connectionId, {
      maxTokens: scene ? 220 : 110,
      temperature: 0.7,
      timeoutMs: LINE_TIMEOUT_MS,
    })) as { text?: unknown } | null;
    if (parsed && typeof parsed === "object" && typeof parsed.text === "string") {
      const line = spokenLine(parsed.text, name).slice(0, 420);
      if (line) return line;
    }
  } catch {
    // Model unavailable or failed: keep template line
  }
  return null;
}

/** A journal entry as the model is shown it: a line the model wrote as it is, and a template line as what it was
 *  about, so the house's wording never finds its way into the caretaker's mouth. */
function recalled(ev: SaucelingEvent, pet: Pick<SaucelingPet, "stage" | "meters" | "foundBy">): string {
  if (ev.generated) return ev.text;
  if (ev.kind === "user-care" && ev.action) return `The player: ${ev.action}.`;
  // How the pet was then is in the line, not in the pet now.
  if (ev.kind === "check-in")
    return `The player asked how the pet was, and ${ev.speaker ?? "the caretaker"} told them.`;
  const moment = ev.speaker ? lineMoment(ev, pet) : null;
  return moment ? `${ev.speaker}, ${MOMENT_BRIEFS[moment]}.` : ev.text;
}

/** Words the model is asked for after a save, and the budget day the charged ones came out of. */
export interface SaucelingLineRequest {
  pet: SaucelingPet;
  events: SaucelingEvent[];
  day: string;
  /** Ids of the events charged to the daily limit, given back when their line is not written. */
  charged: string[];
}

/**
 * Picks the events worth a model line and sets their budget aside: lines from a click are free, the rest come out of
 * what is left of the daily limit. With every line from the model, every caretaker line is picked and none is charged.
 * Runs inside the save queue, so it never waits on the model.
 */
export function reserveLines(options: {
  pet: SaucelingPet | null;
  events: SaucelingEvent[];
  budget: SaucelingBudgetUsage;
  settings: SaucelingSettings;
  nowIso: string;
}): { request: SaucelingLineRequest | null; budget: SaucelingBudgetUsage } {
  const budget = normalizeBudgetForDay(options.budget, options.nowIso);
  let remaining = Math.max(0, options.settings.dailyGenerationBudget - budget.used);
  if (!options.pet || options.events.length === 0) {
    return { request: null, budget };
  }
  if (options.settings.writeEveryLine) {
    const spoken = options.events.filter((ev) => ev.speaker).slice(0, EVERY_LINE_MAX_PER_SAVE);
    return {
      request: spoken.length > 0 ? { pet: options.pet, events: spoken, day: budget.day, charged: [] } : null,
      budget,
    };
  }

  // Pick top interesting events (first miss of a kind, shifts, stage-ups, scenes)
  const seenMissOutcomes = new Set<string>();
  const picks = options.events
    .filter((ev) => {
      const prio = eventPriority(ev);
      if (prio < 50) return false;
      if (ev.kind === "caretaker-care" && ev.outcome) {
        if (seenMissOutcomes.has(ev.outcome)) return false;
        seenMissOutcomes.add(ev.outcome);
      }
      return true;
    })
    .sort((a, b) => eventPriority(b) - eventPriority(a))
    .filter((ev) => {
      if (isClickLine(ev)) return true;
      if (remaining <= 0) return false;
      remaining -= 1;
      return true;
    })
    .slice(0, MAX_LINES_PER_SAVE);

  if (picks.length === 0) {
    return { request: null, budget };
  }
  const charged = picks.filter((ev) => !isClickLine(ev)).map((ev) => ev.id);
  return {
    request: { pet: options.pet, events: picks, day: budget.day, charged },
    budget: { day: budget.day, used: budget.used + charged.length },
  };
}

/** Asks the model for each reserved line, set in `place`. Runs outside the save queue, so a slow model holds up only
 *  this request. */
export async function writeLines(
  request: SaucelingLineRequest,
  settings: SaucelingSettings,
  place: string | null,
): Promise<Map<string, string>> {
  const lines = new Map<string, string>();
  for (const event of request.events) {
    const line = await generateLineWithModel({
      profile: request.pet.careProfile,
      pet: request.pet,
      event,
      settings,
      place,
    });
    if (line) lines.set(event.id, line);
  }
  return lines;
}

/** Puts written lines on the pet's journal, wherever the pet is now, and gives back the budget a charged line did
 *  not use. */
export function applyLines(
  world: SaucelingWorldDocument,
  request: SaucelingLineRequest,
  lines: Map<string, string>,
): SaucelingWorldDocument {
  const withLines = (journal: SaucelingEvent[]) =>
    journal.map((ev) => {
      const text = lines.get(ev.id);
      return text ? { ...ev, text, generated: true } : ev;
    });
  const farewell = request.events.find((ev) => ev.kind === "farewell" && lines.has(ev.id));
  const unused = request.charged.filter((id) => !lines.has(id)).length;
  return {
    ...world,
    activePet:
      world.activePet?.id === request.pet.id
        ? { ...world.activePet, journal: withLines(world.activePet.journal) }
        : world.activePet,
    menagerie: world.menagerie.map((entry) =>
      entry.id === request.pet.id
        ? {
            ...entry,
            journal: withLines(entry.journal),
            farewellScene: farewell ? lines.get(farewell.id)! : entry.farewellScene,
          }
        : entry,
    ),
    budget:
      unused > 0 && world.budget.day === request.day
        ? { day: world.budget.day, used: Math.max(0, world.budget.used - unused) }
        : world.budget,
  };
}

/** When each pet's name or temperament was last asked for, so a failing connection is asked again only after a while. */
const natureAsked = new Map<string, number>();
const NATURE_RETRY_MS = 30 * 60 * 1000;
/** Pets whose temperament is being written now. */
const settling = new Set<string>();

/** Gives a sauceling that has just hatched its name, while it still carries its kind's name, and says the name in its
 *  hatch line unless the model has written that line; one that is not pasta also gets its first temperament, taking
 *  after its finder. Returns the pet as it is afterwards, or null when it has left the nook. */
async function nameHatchling(pet: SaucelingPet, settings: SaucelingSettings): Promise<SaucelingPet | null> {
  const first = ownTemperamentDue(pet, Date.now()) === "first";
  natureAsked.set(pet.id, Date.now());
  const nature = await generateNature({
    pet,
    connectionId: settings.connectionId,
    name: true,
    temperament: first ? { after: pet.finder, previous: null, steps: 3 } : null,
  });
  const nowIso = new Date().toISOString();
  const world = await updateSaucelingWorld((current) => {
    const live = current.activePet;
    if (!live || live.id !== pet.id || !nature) return current;
    const kind = petKind(live).name;
    const next = { ...live };
    if (nature.name && live.name === kind) {
      next.name = nature.name;
      next.journal = live.journal.map((ev) =>
        ev.kind === "hatch" && !ev.generated
          ? { ...ev, text: templateHatchScene(live.careProfile, kind, nature.name!, Date.parse(ev.createdAt)) }
          : ev,
      );
    }
    if (nature.temperament && ownTemperamentDue(live, Date.parse(nowIso)) === "first") {
      next.ownTemperament = { ...nature.temperament, takesAfter: live.finder, steps: 3, at: nowIso };
    }
    return { ...current, activePet: next };
  });
  return world.activePet?.id === pet.id ? world.activePet : null;
}

/**
 * Starts writing the nook sauceling's own temperament when it needs one (see ownTemperamentDue): its first, taking
 * after its finder, for one that is not pasta but has none yet (it hatched before temperaments of its own, or its first
 * call failed); or a step toward a caretaker who has had it two weeks in a row, which they then say they have noticed.
 * It reads only `world`, saved or just read, and writes outside the save queue; a failed call is tried again after
 * NATURE_RETRY_MS.
 */
export function settleTemperament(world: SaucelingWorldDocument): void {
  const pet = world.activePet;
  const nowMs = Date.now();
  const due = pet ? ownTemperamentDue(pet, nowMs) : null;
  if (!pet || !due || settling.has(pet.id) || nowMs - (natureAsked.get(pet.id) ?? 0) < NATURE_RETRY_MS) return;
  settling.add(pet.id);
  natureAsked.set(pet.id, nowMs);
  void writeTemperament(pet, due, world.settings, nowMs)
    .catch(() => undefined)
    .finally(() => settling.delete(pet.id));
}

async function writeTemperament(
  pet: SaucelingPet,
  due: "first" | "step",
  settings: SaucelingSettings,
  nowMs: number,
): Promise<void> {
  const own = pet.ownTemperament;
  const toward = { id: pet.caretakerId, name: pet.careProfile.characterName };
  const steps: 1 | 2 | 3 = !own ? 3 : own.takesAfter.id === toward.id ? (Math.min(3, own.steps + 1) as 2 | 3) : 1;
  const nature = await generateNature({
    pet,
    connectionId: settings.connectionId,
    name: false,
    temperament: own ? { after: toward, previous: own, steps } : { after: pet.finder, previous: null, steps },
  });
  const temperament = nature?.temperament;
  if (!temperament) return;
  const nowIso = new Date().toISOString();
  await saveWithLines(nowIso, (current) => {
    const live = current.activePet;
    // Only what was asked for: a caretaker switch or a step written meanwhile drops it.
    if (!live || live.id !== pet.id || live.caretakerId !== pet.caretakerId || ownTemperamentDue(live, nowMs) !== due) {
      return { world: current, pet: null, events: [] };
    }
    const takesAfter = own ? toward : live.finder;
    const next: SaucelingPet = { ...live, ownTemperament: { ...temperament, takesAfter, steps, at: nowIso } };
    const events: SaucelingEvent[] = own
      ? [
          {
            id: `${TAKES_AFTER_PREFIX}${Date.parse(nowIso)}`,
            kind: "temperament-shift",
            createdAt: nowIso,
            text: templateTakesAfterScene(live.careProfile, live.name, temperament.name, Date.parse(nowIso)),
            generated: false,
            speaker: live.careProfile.characterName,
          },
        ]
      : [];
    next.journal = [...events, ...live.journal].slice(0, MAX_JOURNAL_ENTRIES);
    return { world: { ...current, activePet: next }, pet: next, events };
  });
}

/** Ids of the events whose model lines are still being written; the state lists them so the page can wait. */
const writing = new Set<string>();

export function linesBeingWritten(): string[] {
  return [...writing];
}

/**
 * Saves a change with its template lines, then asks the model for better lines outside the save queue
 * and writes them on afterwards, so a slow model never holds up other saves and a save retry never
 * repeats a model call. It answers with the saved change straight away and the lines land later, unless
 * `wait` asks for them first (Check in, where the line is the point).
 */
export async function saveWithLines(
  nowIso: string,
  change: (current: SaucelingWorldDocument) => {
    world: SaucelingWorldDocument;
    pet: SaucelingPet | null;
    events: SaucelingEvent[];
  },
  options: { wait?: boolean } = {},
): Promise<SaucelingWorldDocument> {
  let request = null as SaucelingLineRequest | null;
  let hatched = null as string | null;
  const saved = await updateSaucelingWorld((current) => {
    const changed = change(current);
    hatched = changed.pet && changed.events.some((ev) => ev.kind === "hatch") ? changed.pet.id : null;
    const reserved = reserveLines({
      pet: changed.pet,
      events: changed.events,
      budget: changed.world.budget,
      settings: changed.world.settings,
      nowIso,
    });
    request = reserved.request;
    return { ...changed.world, budget: reserved.budget };
  });
  const hatchling = hatched && saved.activePet?.id === hatched ? saved.activePet : null;
  // A temperament is written after the save that needs it, and never while a hatchling is still being named.
  if (!request && !hatchling) {
    settleTemperament(saved);
    return saved;
  }
  const reservedRequest = request as SaucelingLineRequest | null;
  // A hatchling is named before its hatch line is written, so the line can say its name.
  const written = (hatchling ? nameHatchling(hatchling, saved.settings) : Promise.resolve(null)).then(async (named) => {
    if (!reservedRequest) return readSaucelingWorld();
    const pet = named ?? reservedRequest.pet;
    const lines = await writeLines({ ...reservedRequest, pet }, saved.settings, nookPlace(pet, saved.backgrounds));
    return updateSaucelingWorld((current) => applyLines(current, reservedRequest, lines));
  });
  const settled = written.then((world) => (settleTemperament(world), world));
  if (options.wait) return settled;
  const hatchLine = hatchling?.journal.find((ev) => ev.kind === "hatch")?.id;
  const ids = [...(reservedRequest?.events.map((ev) => ev.id) ?? []), ...(hatchLine ? [hatchLine] : [])];
  for (const id of ids) writing.add(id);
  // A line that cannot be saved keeps its template; nothing waits on this.
  void settled
    .catch(() => undefined)
    .finally(() => {
      for (const id of ids) writing.delete(id);
    });
  return saved;
}
