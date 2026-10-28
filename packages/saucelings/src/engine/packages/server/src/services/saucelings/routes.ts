import type { FastifyPluginAsync } from "fastify";
import {
  PAINT_INSTRUCTIONS_CHARS,
  SAUCELING_BACKGROUND_LIMIT,
  SAUCELING_PORTRAIT_LIMIT,
  SAUCELING_POST_EGG_STAGES,
  SAUCELING_STAGES,
  SAUCELING_TENDENCIES,
  SAUCELING_USER_ACTIONS,
  type SaucelingBackgroundsResponse,
  type SaucelingCareProfile,
  type SaucelingEvent,
  type SaucelingMenagerieEntry,
  type SaucelingMenagerieResponse,
  type SaucelingPaintKey,
  type SaucelingPet,
  type SaucelingPortraitsResponse,
  type SaucelingPostEggStage,
  type SaucelingStage,
  type SaucelingStateResponse,
  type SaucelingTendencyKey,
  type SaucelingUserAction,
  type SaucelingWorldDocument,
} from "../../../../shared/src/features/agents/saucelings/types.js";
import {
  templateCaretakerHello,
  templateEvolveScene,
} from "../../../../shared/src/features/agents/saucelings/templates.js";
import { careProfileNow, hasOwnVoice, listCaretakerCandidates, makeCareVoice } from "./care-profile.js";
import { generateEvolutions, suggestScene } from "./design.js";
import { createEggFromCaretaker } from "./discovery.js";
import { paintForms, swapForms } from "./repaint.js";
import { restorePetFromMenagerie, retirePetToMenagerie } from "./menagerie.js";
import {
  deleteSaucelingBackground,
  deleteSaucelingFigure,
  deleteSaucelingForm,
  deleteSaucelingPortrait,
  parseFigureImage,
  parseFormStrips,
  parsePortraitImage,
  readSaucelingBackground,
  readSaucelingFigure,
  readSaucelingForm,
  readSaucelingPortrait,
  removeAllSaucelingPortraits,
  saveSaucelingBackground,
  saveSaucelingFigure,
  saveSaucelingForm,
  saveSaucelingPortrait,
} from "./portrait.js";
import {
  advance,
  applyCaretakerNudge,
  checkIn,
  computeCareGaps,
  MAX_JOURNAL_ENTRIES,
  performUserAction,
} from "./simulation.js";
import { emptySaucelingWorld, normalizeSaucelingSettings, readSaucelingWorld, updateSaucelingWorld } from "./store.js";
import { availableSpecies, countCare, unlocksOf } from "./unlocks.js";
import { currentDayKey, linesBeingWritten, normalizeBudgetForDay, saveWithLines, settleTemperament } from "./words.js";

/** Refuses a request: throws an error that carries the response's status code. */
function refuse(statusCode: number, message: string): never {
  throw Object.assign(new Error(message), { statusCode });
}

const NO_ACTIVE_PET = "No active sauceling in the nook.";

/** The nook's sauceling; 400 when there is none. */
function requireActive(world: SaucelingWorldDocument): SaucelingPet {
  return world.activePet ?? refuse(400, NO_ACTIVE_PET);
}

function requestBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) refuse(400, "A JSON request body is required.");
  return value as Record<string, unknown>;
}

/** How server text names the pet: an egg's name would give away what hatches. */
function petLabel(pet: SaucelingPet): string {
  return pet.stage === "egg" ? "the egg" : pet.name;
}

function refuseWhenLibraryFull(world: SaucelingWorldDocument): void {
  if (world.backgrounds.length >= SAUCELING_BACKGROUND_LIMIT) {
    refuse(409, `The background library holds ${SAUCELING_BACKGROUND_LIMIT}. Delete one to save another.`);
  }
}

function refuseWhenAlbumFull(world: SaucelingWorldDocument): void {
  if (world.portraits.length >= SAUCELING_PORTRAIT_LIMIT) {
    refuse(409, `The Album holds ${SAUCELING_PORTRAIT_LIMIT} paintings. Delete one to paint another.`);
  }
}

/** Replacing the pet in the nook must be asked for, so a stale tab or a misclick never sends it to the Menagerie. */
function refuseUnlessSwap(world: SaucelingWorldDocument, swap: boolean): void {
  if (world.activePet && !swap) {
    const label = world.activePet.stage === "egg" ? "The egg" : world.activePet.name;
    refuse(409, `${label} is still in the nook. Swap it to bring another sauceling in.`);
  }
}

/** One new egg a UTC day, the same day as egg finds. Eggs found in chat and saucelings brought back from the Menagerie
 *  are not counted. */
function refuseSecondEggToday(world: SaucelingWorldDocument, nowIso: string): void {
  if (world.lastNewEggDay === currentDayKey(nowIso)) {
    refuse(409, "One new egg a day. The next one is ready at midnight UTC.");
  }
}

function requiredString(value: unknown, label: string, maxLen = 120): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLen) {
    refuse(400, `${label} is required.`);
  }
  return value.trim();
}

/** 400 unless `id` is one of the player's characters, the only ones that can be a caretaker, painted or flipped. */
async function requireCaretaker(id: string, what = "a caretaker"): Promise<void> {
  if (!(await listCaretakerCandidates()).some((character) => character.id === id)) {
    refuse(400, `Only one of your characters can be ${what}.`);
  }
}

const FORM_REFUSAL = "A form must be PNG strips 104 high and 104 or 312 wide, each at most 48 KB, 160 KB together.";

/** Where the player put the egg, as shares of its background picture (see `SaucelingEggSpot`); null puts it back. */
function eggSpotFrom(value: unknown): { x: number; y: number } | null {
  if (value === null) return null;
  const spot = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const share = (part: unknown) => (typeof part === "number" && part >= 0 && part <= 1 ? part : null);
  const x = share(spot.x);
  const y = share(spot.y);
  if (x === null || y === null) refuse(400, "Put the egg somewhere on its background.");
  return { x, y };
}

/** The sauceling a form is for: the one `petId` names in the nook or the Menagerie, or the one in the nook. */
function formTarget(world: SaucelingWorldDocument, petIdValue: unknown): SaucelingPet | SaucelingMenagerieEntry {
  if (!world.settings.portraitEnabled) refuse(400, "Portraits are turned off in Saucelings settings.");
  const petId = petIdValue === undefined ? null : requiredString(petIdValue, "Sauceling id", 200);
  const pet = petId ? [world.activePet, ...world.menagerie].find((each) => each?.id === petId) : world.activePet;
  if (!pet) refuse(400, petId ? "No such sauceling." : NO_ACTIVE_PET);
  return pet;
}

/** How long a page's claim on a painting holds: longer than any image call takes. */
const PAINT_CLAIM_MS = 3 * 60_000;
/** Painting by itself stops after this many tries of one thing since its last saved form; Paint still works. */
const AUTO_PAINT_TRIES = 2;
const PAINT_KEYS: readonly SaucelingPaintKey[] = [...SAUCELING_STAGES, "sheet"];

type AnyPet = SaucelingPet | SaucelingMenagerieEntry;

/** The world with the one sauceling `fits` picks, in the nook or the Menagerie, changed by `change`; 409 when it is
 *  in neither any more. */
function changePet(
  world: SaucelingWorldDocument,
  fits: (each: AnyPet | null) => boolean,
  change: <T extends AnyPet>(each: T) => T,
): SaucelingWorldDocument {
  if (fits(world.activePet)) return { ...world, activePet: change(world.activePet!) };
  if (!world.menagerie.some(fits)) refuse(409, "That sauceling changed. Try again.");
  return { ...world, menagerie: world.menagerie.map((entry) => (fits(entry) ? change(entry) : entry)) };
}

/** Lists saved form documents on a sauceling for their stages. The ones they replace are kept as the set Undo
 *  repaint goes back to, and the set kept before goes; its paintings in progress end and their tries start again.
 *  The forms follow the sauceling, so one that moved between the nook and the Menagerie meanwhile still gets them;
 *  one that is gone or no longer has those stages gets none (409), and the new documents are deleted. */
async function attachForms(petId: string, forms: Partial<Record<SaucelingStage, string>>) {
  const stages = Object.keys(forms) as SaucelingStage[];
  const replaced: string[] = [];
  const fits = (each: AnyPet | null) => each?.id === petId && stages.every((stage) => each.design?.stages[stage]);
  const world = await updateSaucelingWorld((latest) => {
    replaced.length = 0;
    const painting = Object.fromEntries(
      Object.entries(latest.painting).filter(([key]) => !key.startsWith(`${petId}:`)),
    );
    return changePet({ ...latest, painting }, fits, (each) => {
      const paintTries = { ...each.paintTries };
      for (const key of [...stages, "sheet"] as const) delete paintTries[key];
      const painted = paintForms(each.forms, each.savedForms, forms);
      replaced.push(...painted.dropped);
      return { ...each, forms: painted.forms, savedForms: painted.saved, paintTries };
    });
  }).catch(async (error: unknown) => {
    // Nothing lists the new documents, so they go.
    for (const id of Object.values(forms)) await deleteSaucelingForm(id).catch(() => undefined);
    throw error;
  });
  for (const id of replaced) await deleteSaucelingForm(id).catch(() => undefined);
  return world;
}

/** The nook's sauceling while it has an evolution on offer; 409 when there is none (declined, or it changed). */
function offeredPet(world: SaucelingWorldDocument): SaucelingPet {
  const pet = requireActive(world);
  if (pet.evolution.offer !== "offered") refuse(409, "It has no evolution on offer.");
  return pet;
}

async function buildStateResponse(
  world: SaucelingWorldDocument,
  nowIso = new Date().toISOString(),
): Promise<SaucelingStateResponse> {
  // Whether each character has their own voice yet, so the page can offer to make one.
  const characters = (await listCaretakerCandidates()).map((ch) => ({
    ...ch,
    hasVoice:
      hasOwnVoice(world.profileCache[ch.id]) ||
      (world.activePet?.caretakerId === ch.id && hasOwnVoice(world.activePet.careProfile)),
  }));
  const gaps = computeCareGaps(world.activePet, nowIso);
  const {
    menagerie,
    portraits,
    backgrounds: _backgrounds,
    profileCache: _profileCache,
    painting: _painting,
    ...view
  } = world;
  const latestRemark =
    world.activePet?.journal[0]?.text ??
    (world.activePet ? `I'm keeping an eye on ${petLabel(world.activePet)}.` : "No sauceling in the nook yet.");
  return {
    world: {
      ...view,
      budget: normalizeBudgetForDay(world.budget, nowIso),
    },
    menagerieCount: menagerie.length,
    portraitCount: portraits.length,
    unlocks: unlocksOf(world, nowIso),
    characters,
    gaps,
    latestRemark,
    writing: linesBeingWritten(),
  };
}

/** The profile cache with `profile` in it when it is the caretaker's own voice; a guessed profile is never cached. */
function cachingVoice(
  world: SaucelingWorldDocument,
  profile: SaucelingCareProfile,
): SaucelingWorldDocument["profileCache"] {
  return hasOwnVoice(profile) ? { ...world.profileCache, [profile.characterId]: profile } : world.profileCache;
}

export const saucelingsRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/saucelings/state — runs the lazy tick; writes only when it changed something
  app.get("/state", async () => {
    const nowIso = new Date().toISOString();
    let world = await readSaucelingWorld();
    const pet = world.activePet;
    const preview = pet ? advance(pet, nowIso, world.settings) : null;
    if (
      pet &&
      preview &&
      (preview.events.length > 0 ||
        preview.pet.retireReady !== pet.retireReady ||
        preview.pet.lastTickAt !== pet.lastTickAt)
    ) {
      world = await saveWithLines(nowIso, (current) => {
        if (!current.activePet) return { world: current, pet: null, events: [] };
        const ticked = advance(current.activePet, nowIso, current.settings);
        return { world: { ...current, activePet: ticked.pet }, pet: ticked.pet, events: ticked.events };
      });
    } else {
      // Nothing to save, but a sauceling that is not pasta may still need its own temperament written.
      settleTemperament(world);
      // Without a save the page still sees the meters as they are now.
      if (pet && preview) world = { ...world, activePet: preview.pet };
    }
    return buildStateResponse(world, nowIso);
  });

  // GET /api/saucelings/menagerie — retired saucelings, newest first
  app.get("/menagerie", async (): Promise<SaucelingMenagerieResponse> => ({
    menagerie: (await readSaucelingWorld()).menagerie,
  }));

  // POST /api/saucelings/adopt — pick caretaker and bring first/next egg; { swap: true } sends the current pet to the Menagerie.
  // The egg has no name yet: the player names it once it hatches.
  app.post("/adopt", async (request) => {
    const body = requestBody(request.body);
    const characterId = requiredString(body.characterId, "Caretaker character", 200);
    await requireCaretaker(characterId);
    const swap = body.swap === true;
    const nowIso = new Date().toISOString();
    const before = await readSaucelingWorld();
    refuseUnlessSwap(before, swap);
    refuseSecondEggToday(before, nowIso);
    // Their own voice if they have one (the page offers to make it first), else one guessed from their card.
    const profile = await careProfileNow(characterId, before.profileCache[characterId]);

    const world = await saveWithLines(nowIso, (current) => {
      refuseUnlessSwap(current, swap);
      refuseSecondEggToday(current, nowIso);
      let menagerie = [...current.menagerie];
      if (current.activePet) {
        const retired = retirePetToMenagerie(current.activePet, nowIso);
        menagerie = [retired.entry, ...menagerie];
      }
      const created = createEggFromCaretaker({ profile, nowIso, available: availableSpecies(current, nowIso) });
      return {
        world: {
          ...current,
          activePet: created.pet,
          menagerie,
          lastNewEggDay: currentDayKey(nowIso),
          profileCache: cachingVoice(current, profile),
        },
        pet: created.pet,
        events: [created.event],
      };
    });

    return buildStateResponse(world, nowIso);
  });

  // POST /api/saucelings/action — feed, play, rest, pet; an egg takes warm, talk, listen
  app.post("/action", async (request) => {
    const body = requestBody(request.body);
    const action = requiredString(body.action, "Care action") as SaucelingUserAction;
    if (!SAUCELING_USER_ACTIONS.includes(action)) refuse(400, "Invalid care action.");
    const nowIso = new Date().toISOString();

    const world = await saveWithLines(nowIso, (current) => {
      const ticked = advance(requireActive(current), nowIso, current.settings);
      const acted = performUserAction(ticked.pet, action, nowIso);
      // Only care the player gave counts towards special eggs; a refused action (too soon) counts nothing.
      const cared = acted.pet.careActionCount > ticked.pet.careActionCount;
      return {
        world: {
          ...current,
          activePet: acted.pet,
          milestones: cared ? countCare(current.milestones, currentDayKey(nowIso)) : current.milestones,
        },
        pet: acted.pet,
        events: [...ticked.events, ...acted.events],
      };
    });

    return buildStateResponse(world, nowIso);
  });

  // POST /api/saucelings/check-in — the caretaker writes a fresh line now; it does not count against the daily limit
  app.post("/check-in", async () => {
    const nowIso = new Date().toISOString();
    const world = await saveWithLines(
      nowIso,
      (current) => {
        const ticked = advance(requireActive(current), nowIso, current.settings);
        const checked = checkIn(ticked.pet, nowIso);
        return {
          world: { ...current, activePet: checked.pet },
          pet: checked.pet,
          events: [...ticked.events, checked.event],
        };
      },
      { wait: true },
    );

    return buildStateResponse(world, nowIso);
  });

  // POST /api/saucelings/nudge — nudge caretaker tendency for 48h
  app.post("/nudge", async (request) => {
    const body = requestBody(request.body);
    const tendency = requiredString(body.tendency, "Tendency") as SaucelingTendencyKey;
    if (!SAUCELING_TENDENCIES.includes(tendency)) refuse(400, "Invalid tendency key.");
    const nowIso = new Date().toISOString();

    const world = await updateSaucelingWorld(async (current) => {
      const nudged = applyCaretakerNudge(requireActive(current), tendency, nowIso);
      return {
        ...current,
        activePet: nudged.pet,
      };
    });

    return buildStateResponse(world, nowIso);
  });

  // PATCH /api/saucelings/pet — rename, move the egg, flip which way it walks or switch caretaker; a new caretaker says hello
  app.patch("/pet", async (request) => {
    const body = requestBody(request.body);
    const nowIso = new Date().toISOString();
    const before = await readSaucelingWorld();
    requireActive(before);
    const eggSpot = body.eggSpot === undefined ? undefined : eggSpotFrom(body.eggSpot);
    const caretakerId =
      typeof body.caretakerId === "string" && body.caretakerId.trim()
        ? requiredString(body.caretakerId, "Caretaker character", 200)
        : null;
    if (caretakerId && caretakerId !== before.activePet?.caretakerId) await requireCaretaker(caretakerId);
    // A switch never waits for the model: a caretaker with no voice of their own starts with one guessed from their
    // card, and the page offers to make theirs.
    const profile = caretakerId ? await careProfileNow(caretakerId, before.profileCache[caretakerId]) : null;

    const world = await saveWithLines(nowIso, (current) => {
      const nextPet = { ...requireActive(current) };
      if (typeof body.name === "string" && body.name.trim()) {
        if (nextPet.stage === "egg") refuse(400, "Name it once it hatches.");
        nextPet.name = body.name.trim().slice(0, 40);
      }
      if (eggSpot !== undefined) {
        if (nextPet.stage !== "egg") refuse(400, "Only an egg can be moved.");
        // It belongs to the background it was put on.
        nextPet.eggSpot = eggSpot && { ...eggSpot, backgroundId: nextPet.backgroundId };
      }
      if (typeof body.flipped === "boolean") nextPet.flipped = body.flipped;
      if (!profile || !caretakerId) {
        return { world: { ...current, activePet: nextPet }, pet: nextPet, events: [] };
      }
      // A new caretaker says hello; picking the one it has says nothing.
      const events: SaucelingEvent[] =
        nextPet.caretakerId !== caretakerId
          ? [
              {
                id: `hello-${Date.parse(nowIso)}`,
                kind: "caretaker-change",
                createdAt: nowIso,
                text: templateCaretakerHello(profile, nextPet, Date.parse(nowIso)),
                generated: false,
                speaker: profile.characterName,
              },
            ]
          : [];
      if (nextPet.caretakerId !== caretakerId) nextPet.caretakerSince = nowIso;
      nextPet.caretakerId = caretakerId;
      nextPet.careProfile = profile;
      nextPet.journal = [...events, ...nextPet.journal].slice(0, MAX_JOURNAL_ENTRIES);
      return {
        world: { ...current, activePet: nextPet, profileCache: cachingVoice(current, profile) },
        pet: nextPet,
        events,
      };
    });

    return buildStateResponse(world, nowIso);
  });

  // POST /api/saucelings/voice — the writing connection reads a caretaker's card once and makes their own voice: how
  // they talk, what they call the pet and what they say at mealtimes. The pet in the nook takes it if it is theirs.
  app.post("/voice", async (request) => {
    const body = requestBody(request.body);
    const characterId = requiredString(body.characterId, "Caretaker character");
    const nowIso = new Date().toISOString();
    const made = await makeCareVoice(characterId, (await readSaucelingWorld()).settings.connectionId);
    if (!made) refuse(502, "The writing connection didn't answer.");
    const world = await updateSaucelingWorld((current) => ({
      ...current,
      activePet:
        current.activePet?.caretakerId === characterId
          ? { ...current.activePet, careProfile: made }
          : current.activePet,
      profileCache: cachingVoice(current, made),
    }));
    return buildStateResponse(world, nowIso);
  });

  // POST /api/saucelings/evolve/options — the two looks its caretaker offered, written once by the writing connection
  // (or the plain fallback); the model call runs outside the save, and looks another request wrote first are kept.
  app.post("/evolve/options", async () => {
    const nowIso = new Date().toISOString();
    let world = await saveWithLines(nowIso, (current) => {
      const pet = offeredPet(current);
      const ticked = advance(pet, nowIso, current.settings);
      return { world: { ...current, activePet: ticked.pet }, pet: ticked.pet, events: ticked.events };
    });
    const pet = offeredPet(world);
    if (!pet.evolution.choices) {
      const choices = await generateEvolutions(pet, world.settings.connectionId);
      world = await updateSaucelingWorld((current) => {
        const now = offeredPet(current);
        if (now.id !== pet.id || now.evolution.choices) return current;
        return { ...current, activePet: { ...now, evolution: { ...now.evolution, choices } } };
      });
    }
    return buildStateResponse(world, nowIso);
  });

  // POST /api/saucelings/evolve/choose — it becomes one of the two offered looks, { index: 0 | 1 }
  app.post("/evolve/choose", async (request) => {
    const body = requestBody(request.body);
    const index = body.index;
    if (index !== 0 && index !== 1) refuse(400, "Pick one of the two looks.");
    const nowIso = new Date().toISOString();
    const world = await saveWithLines(nowIso, (current) => {
      const pet = offeredPet(current);
      const look = pet.evolution.choices?.[index];
      if (!look || pet.evolution.look) refuse(409, "That evolution changed. Try again.");
      const event: SaucelingEvent = {
        id: `evolve-${Date.parse(nowIso)}`,
        kind: "evolve",
        createdAt: nowIso,
        stage: pet.stage,
        text: templateEvolveScene(pet.careProfile, pet.name, look.form, Date.parse(nowIso)),
        generated: false,
        speaker: pet.careProfile.characterName,
      };
      const nextPet: SaucelingPet = {
        ...pet,
        evolution: { ...pet.evolution, look, at: nowIso },
        journal: [event, ...pet.journal].slice(0, MAX_JOURNAL_ENTRIES),
      };
      return { world: { ...current, activePet: nextPet }, pet: nextPet, events: [event] };
    });
    return buildStateResponse(world, nowIso);
  });

  // POST /api/saucelings/evolve/undo — back to how it looked; Evolve… comes back with the same two choices
  app.post("/evolve/undo", async () => {
    const world = await updateSaucelingWorld((current) => {
      const pet = current.activePet;
      if (!pet?.evolution.look) refuse(409, "It has no evolution to undo.");
      return { ...current, activePet: { ...pet, evolution: { ...pet.evolution, look: null, at: null } } };
    });
    return buildStateResponse(world);
  });

  // POST /api/saucelings/evolve/decline — Not interested: it is never offered an evolution again
  app.post("/evolve/decline", async () => {
    const world = await updateSaucelingWorld((current) => {
      const pet = offeredPet(current);
      if (pet.evolution.look) refuse(409, "It has already evolved.");
      return { ...current, activePet: { ...pet, evolution: { ...pet.evolution, offer: "declined" } } };
    });
    return buildStateResponse(world);
  });

  // POST /api/saucelings/retire — send current pet to the Menagerie
  app.post("/retire", async () => {
    const nowIso = new Date().toISOString();
    const world = await saveWithLines(nowIso, (current) => {
      if (!current.activePet) refuse(400, "No active sauceling to retire.");
      const retired = retirePetToMenagerie(current.activePet, nowIso);
      return {
        world: {
          ...current,
          activePet: null,
          menagerie: [retired.entry, ...current.menagerie.filter((e) => e.id !== retired.entry.id)],
        },
        pet: current.activePet,
        events: [retired.farewellEvent],
      };
    });

    return buildStateResponse(world, nowIso);
  });

  // POST /api/saucelings/menagerie/:id/restore — bring back a Menagerie pet; { swap: true } sends the current pet there,
  // and { caretakerId } hands it to another caretaker
  app.post<{ Params: { id: string } }>("/menagerie/:id/restore", async (request) => {
    const entryId = requiredString(request.params.id, "Menagerie pet ID");
    const body = request.body && typeof request.body === "object" ? (request.body as Record<string, unknown>) : {};
    const requestedStage =
      typeof body.stage === "string" && SAUCELING_POST_EGG_STAGES.includes(body.stage as SaucelingPostEggStage)
        ? (body.stage as SaucelingPostEggStage)
        : undefined;
    const swap = body.swap === true;
    const nowIso = new Date().toISOString();
    // A new caretaker starts at once, as on a switch: with their own voice, or one guessed from their card. A pet
    // that comes back to the caretaker it had takes their voice if they have been given one since.
    const before = await readSaucelingWorld();
    const caretakerId =
      typeof body.caretakerId === "string" && body.caretakerId.trim()
        ? requiredString(body.caretakerId, "Caretaker character", 200)
        : null;
    const had = before.menagerie.find((e) => e.id === entryId)?.caretakerId;
    const handover = caretakerId && caretakerId !== had ? caretakerId : null;
    if (handover) await requireCaretaker(handover);
    const keeper = handover ?? had;
    const profile = keeper ? await careProfileNow(keeper, before.profileCache[keeper]) : null;

    const world = await saveWithLines(nowIso, (current) => {
      const target = current.menagerie.find((e) => e.id === entryId);
      if (!target) refuse(404, "Sauceling not found in the Menagerie.");
      refuseUnlessSwap(current, swap);
      let remaining = current.menagerie.filter((e) => e.id !== entryId);
      if (current.activePet) {
        const swapped = retirePetToMenagerie(current.activePet, nowIso);
        remaining = [swapped.entry, ...remaining];
      }
      const restored = restorePetFromMenagerie(
        target,
        requestedStage,
        nowIso,
        handover && profile ? { id: handover, profile } : undefined,
      );
      const pet =
        !handover && profile && hasOwnVoice(profile) && target.caretakerId === profile.characterId
          ? { ...restored.pet, careProfile: profile }
          : restored.pet;
      return {
        world: {
          ...current,
          activePet: pet,
          menagerie: remaining,
          profileCache: profile ? cachingVoice(current, profile) : current.profileCache,
        },
        pet,
        events: [restored.returnEvent],
      };
    });

    return buildStateResponse(world, nowIso);
  });

  // POST /api/saucelings/menagerie/:id/release — let a Menagerie pet go for good; its paintings stay in the Album
  // and its background in the library, and its forms go with it
  app.post<{ Params: { id: string } }>("/menagerie/:id/release", async (request) => {
    const entryId = requiredString(request.params.id, "Menagerie pet ID");
    let forms: string[] = [];
    const world = await updateSaucelingWorld((current) => {
      const entry = current.menagerie.find((e) => e.id === entryId);
      if (!entry) refuse(404, "Sauceling not found in the Menagerie.");
      forms = [...Object.values(entry.forms), ...Object.values(entry.savedForms)];
      return { ...current, menagerie: current.menagerie.filter((e) => e.id !== entryId) };
    });
    for (const id of forms) await deleteSaucelingForm(id).catch(() => undefined);
    return buildStateResponse(world);
  });

  // POST /api/saucelings/background — the client's picture (uploaded, or made with the user's image connection) joins
  // the background library and becomes the nook's background; { label, source } describe it
  app.post("/background", async (request) => {
    const body = requestBody(request.body);
    const nowIso = new Date().toISOString();
    const before = await readSaucelingWorld();
    requireActive(before);
    refuseWhenLibraryFull(before);
    const image = parsePortraitImage(body.image);
    if (!image) refuse(400, "A background must be a PNG, JPEG or WebP image of at most 4 MB.");
    const label = typeof body.label === "string" ? body.label.trim().slice(0, 120) : "";
    const source = body.source === "generated" ? "generated" : "upload";
    // The image is saved first, so the library never lists a background that is not there.
    const id = await saveSaucelingBackground(image, nowIso);
    const world = await updateSaucelingWorld((latest) => {
      const pet = requireActive(latest);
      refuseWhenLibraryFull(latest);
      return {
        ...latest,
        backgrounds: [{ id, label, source, savedAt: nowIso }, ...latest.backgrounds],
        activePet: { ...pet, backgroundId: id },
      };
    }).catch(async (error: unknown) => {
      // Nothing lists the image, so it goes.
      await deleteSaucelingBackground(id).catch(() => undefined);
      throw error;
    });
    return buildStateResponse(world, nowIso);
  });

  // GET /api/saucelings/backgrounds — the background library, newest first
  app.get("/backgrounds", async (): Promise<SaucelingBackgroundsResponse> => ({
    backgrounds: (await readSaucelingWorld()).backgrounds,
  }));

  // GET /api/saucelings/background/:id — one background as a data URL; only ids the library lists
  app.get<{ Params: { id: string } }>("/background/:id", async (request, reply) => {
    const id = requiredString(request.params.id, "Background id", 200);
    const listed = (await readSaucelingWorld()).backgrounds.some((background) => background.id === id);
    const image = listed ? await readSaucelingBackground(id) : null;
    if (!image) return reply.status(404).send({ error: "That background is not in the library." });
    return { image };
  });

  // POST /api/saucelings/background/:id/select — the nook shows a background from the library
  app.post<{ Params: { id: string } }>("/background/:id/select", async (request) => {
    const id = requiredString(request.params.id, "Background id", 200);
    const world = await updateSaucelingWorld((current) => {
      const pet = requireActive(current);
      if (!current.backgrounds.some((background) => background.id === id)) {
        refuse(404, "That background is not in the library.");
      }
      return { ...current, activePet: { ...pet, backgroundId: id } };
    });
    return buildStateResponse(world);
  });

  // POST /api/saucelings/background/:id/delete — take a background out of the library for good; any sauceling
  // showing it goes back to its built-in one
  app.post<{ Params: { id: string } }>("/background/:id/delete", async (request) => {
    const id = requiredString(request.params.id, "Background id", 200);
    const unset = <T extends { backgroundId: string | null }>(item: T): T =>
      item.backgroundId === id ? { ...item, backgroundId: null } : item;
    const world = await updateSaucelingWorld((current) => {
      if (!current.backgrounds.some((background) => background.id === id)) {
        refuse(404, "That background is not in the library.");
      }
      return {
        ...current,
        backgrounds: current.backgrounds.filter((background) => background.id !== id),
        activePet: current.activePet ? unset(current.activePet) : null,
        menagerie: current.menagerie.map(unset),
      };
    });
    // The index goes first, so nothing points at a background whose image is gone.
    await deleteSaucelingBackground(id).catch(() => undefined);
    return buildStateResponse(world);
  });

  // POST /api/saucelings/background/clear — back to the built-in background; the library keeps the old one
  app.post("/background/clear", async () => {
    const world = await updateSaucelingWorld((current) => ({
      ...current,
      activePet: { ...requireActive(current), backgroundId: null },
    }));
    return buildStateResponse(world);
  });

  // POST /api/saucelings/background/suggest — the writing connection describes a place that suits the nook's
  // sauceling, as a starting prompt for a generated background; { scene: null } when it could not
  app.post("/background/suggest", async () => {
    const world = await readSaucelingWorld();
    return { scene: await suggestScene(requireActive(world), world.settings.connectionId) };
  });

  // POST /api/saucelings/portrait — add a painting the client generated with the user's image connection to the Album
  app.post("/portrait", async (request) => {
    const body = requestBody(request.body);
    const nowIso = new Date().toISOString();
    const current = await readSaucelingWorld();
    if (!current.settings.portraitEnabled) refuse(400, "Portraits are turned off in Saucelings settings.");
    const petId = requiredString(body.petId, "Sauceling", 200);
    const pet = requireActive(current);
    if (pet.stage === "egg") refuse(400, "Paint it once it hatches.");
    refuseWhenAlbumFull(current);
    const image = parsePortraitImage(body.image);
    if (!image) refuse(400, "A portrait must be a PNG, JPEG or WebP image of at most 4 MB.");
    // What the player asked the painting to show is only a caption, so a bad value is dropped, not refused.
    const instructions =
      typeof body.instructions === "string"
        ? body.instructions.replace(/\s+/gu, " ").trim().slice(0, PAINT_INSTRUCTIONS_CHARS).trim()
        : "";
    // The image is saved first, so the Album never lists a painting that is not there.
    const id = await saveSaucelingPortrait(pet.id, image, nowIso);
    const world = await updateSaucelingWorld((latest) => {
      // The painting was made for the sauceling the page showed; if the nook has swapped it out since, it is not added.
      if (latest.activePet?.id !== petId) refuse(409, "That sauceling changed. Try again.");
      refuseWhenAlbumFull(latest);
      return {
        ...latest,
        portraits: [
          {
            id,
            petId: pet.id,
            petName: pet.name,
            species: pet.species,
            stage: pet.lockedStage ?? pet.stage,
            savedAt: nowIso,
            ...(instructions ? { instructions } : {}),
          },
          ...latest.portraits,
        ],
      };
    }).catch(async (error: unknown) => {
      // Nothing lists the image, so it goes.
      await deleteSaucelingPortrait(id).catch(() => undefined);
      throw error;
    });
    return buildStateResponse(world, nowIso);
  });

  // GET /api/saucelings/portraits — the Album's paintings, newest first, named as their pets are now
  app.get("/portraits", async (): Promise<SaucelingPortraitsResponse> => {
    const world = await readSaucelingWorld();
    return {
      portraits: world.portraits.map((portrait) => {
        if (world.activePet?.id === portrait.petId) {
          return { ...portrait, petName: world.activePet.name, home: "nook" as const };
        }
        const entry = world.menagerie.find((e) => e.id === portrait.petId);
        return entry
          ? { ...portrait, petName: entry.name, home: "menagerie" as const }
          : { ...portrait, home: "released" as const };
      }),
    };
  });

  // GET /api/saucelings/portrait/:id — one painting as a data URL; only ids the Album lists
  app.get<{ Params: { id: string } }>("/portrait/:id", async (request, reply) => {
    const id = requiredString(request.params.id, "Painting id", 200);
    const listed = (await readSaucelingWorld()).portraits.some((portrait) => portrait.id === id);
    const image = listed ? await readSaucelingPortrait(id) : null;
    if (!image) return reply.status(404).send({ error: "That painting is not in the Album." });
    return { image };
  });

  // POST /api/saucelings/portrait/:id/delete — take a painting out of the Album for good
  app.post<{ Params: { id: string } }>("/portrait/:id/delete", async (request) => {
    const id = requiredString(request.params.id, "Painting id", 200);
    const world = await updateSaucelingWorld((current) => {
      if (!current.portraits.some((portrait) => portrait.id === id)) {
        refuse(404, "That painting is not in the Album.");
      }
      return { ...current, portraits: current.portraits.filter((portrait) => portrait.id !== id) };
    });
    // The index goes first, so the Album never lists a painting whose image is gone.
    await deleteSaucelingPortrait(id).catch(() => undefined);
    return buildStateResponse(world);
  });

  // POST /api/saucelings/form/start — a page is about to paint { key } (a stage, or "sheet" for every stage) of
  // { petId? } and claims it with its { token }, so another open page does not pay for the same picture (409 while
  // the claim holds); one it starts by itself ({ auto: true }) is refused after two tries since the last saved form
  // (400), so a painting that never cuts out is not paid for on every page load
  app.post("/form/start", async (request) => {
    const body = requestBody(request.body);
    const key = body.key as SaucelingPaintKey;
    if (!PAINT_KEYS.includes(key)) refuse(400, "Invalid painting.");
    const token = requiredString(body.token, "Page token", 100);
    const nowIso = new Date().toISOString();
    const pet = formTarget(await readSaucelingWorld(), body.petId);
    if (key === "sheet" ? !pet.design : !pet.design?.stages[key]) {
      refuse(400, "Only an invented sauceling has a form for that stage.");
    }
    const claimKey = `${pet.id}:${key}`;
    // ponytail: a painting that fails keeps its claim until it expires, so another page's Paint waits up to three
    // minutes. Upgrade path: let the page release its claim when its painting fails.
    await updateSaucelingWorld((latest) => {
      // A claim older than any painting takes is dropped, so a page closed mid-painting holds nothing.
      const now = Date.parse(nowIso);
      const painting = Object.fromEntries(
        Object.entries(latest.painting).filter(([, claim]) => now - Date.parse(claim.at) < PAINT_CLAIM_MS),
      );
      if (painting[claimKey] && painting[claimKey].token !== token) {
        refuse(409, "Another open page is painting this. It shows here when it is done.");
      }
      painting[claimKey] = { token, at: nowIso };
      return changePet(
        { ...latest, painting },
        (each) => each?.id === pet.id,
        (each) => {
          const tries = each.paintTries[key] ?? 0;
          if (body.auto === true && tries >= AUTO_PAINT_TRIES) refuse(400, "Painting it by itself failed twice.");
          return { ...each, paintTries: { ...each.paintTries, [key]: tries + 1 } };
        },
      );
    });
    return { ok: true };
  });

  // POST /api/saucelings/form — a stage picture of an invented sauceling, made by the client from a painting with
  // the user's image connection; { stage, image, side?, happy?, grumpy?, petId? } where each picture is a form
  // strip (see parseFormStrips) and petId, when given, names the sauceling in the nook or one in the Menagerie (a
  // found egg is painted where it waits). A picture it replaces is kept for Undo repaint.
  app.post("/form", async (request) => {
    const body = requestBody(request.body);
    const stage = body.stage as SaucelingStage;
    if (!SAUCELING_STAGES.includes(stage)) refuse(400, "Invalid stage.");
    const nowIso = new Date().toISOString();
    const pet = formTarget(await readSaucelingWorld(), body.petId);
    if (!pet.design?.stages[stage]) refuse(400, "Only an invented sauceling has a form for that stage.");
    const parsed = parseFormStrips(body);
    if (!parsed) refuse(400, FORM_REFUSAL);
    // The image is saved first, so a pet never lists a form that is not there.
    const id = await saveSaucelingForm(pet.id, parsed.strips, nowIso);
    return buildStateResponse(await attachForms(pet.id, { [stage]: id }), nowIso);
  });

  // POST /api/saucelings/form/sheet — every form cut from one life sheet at once; { petId?, forms: { [stage]: strips } }
  // with the strips as for /form. All of them are saved or none.
  app.post("/form/sheet", async (request) => {
    const body = requestBody(request.body);
    const nowIso = new Date().toISOString();
    const pet = formTarget(await readSaucelingWorld(), body.petId);
    const raw = body.forms && typeof body.forms === "object" && !Array.isArray(body.forms) ? body.forms : {};
    const entries = Object.entries(raw as Record<string, unknown>);
    if (entries.length === 0 || entries.some(([stage]) => !pet.design?.stages[stage as SaucelingStage])) {
      refuse(400, "Only an invented sauceling has a form for each of those stages.");
    }
    // ponytail: no total body cap of our own; five stages of at most 160 KB each bound it. Upgrade path: check
    // the content length here if a sheet ever carries more.
    const parsed = entries.map(([stage, strips]) => {
      const form = strips && typeof strips === "object" ? parseFormStrips(strips as Record<string, unknown>) : null;
      if (!form) refuse(400, FORM_REFUSAL);
      return [stage as SaucelingStage, form.strips] as const;
    });
    const forms: Partial<Record<SaucelingStage, string>> = {};
    try {
      for (const [stage, strips] of parsed) forms[stage] = await saveSaucelingForm(pet.id, strips, nowIso);
    } catch (error) {
      for (const id of Object.values(forms)) await deleteSaucelingForm(id).catch(() => undefined);
      throw error;
    }
    return buildStateResponse(await attachForms(pet.id, forms), nowIso);
  });

  // POST /api/saucelings/form/undo — { petId? } swaps the sauceling's pictures with the set its last repaint replaced,
  // so pressing it again brings the repaint back
  app.post("/form/undo", async (request) => {
    const body = requestBody(request.body);
    const pet = formTarget(await readSaucelingWorld(), body.petId);
    const world = await updateSaucelingWorld((latest) =>
      changePet(
        latest,
        (each) => each?.id === pet.id,
        (each) => {
          const swapped = swapForms(each.forms, each.savedForms);
          if (!swapped) refuse(400, "There is no repaint to undo.");
          return { ...each, forms: swapped.forms, savedForms: swapped.saved };
        },
      ),
    );
    return buildStateResponse(world);
  });

  // GET /api/saucelings/form/:id — one form's strips as data URLs, or with ?strips=front its front strip only (for
  // lists); only ids a sauceling in the nook or the Menagerie lists, saved for Undo repaint or not
  app.get<{ Params: { id: string }; Querystring: { strips?: string } }>("/form/:id", async (request, reply) => {
    const id = requiredString(request.params.id, "Form id", 200);
    const world = await readSaucelingWorld();
    const listed = [world.activePet, ...world.menagerie].some(
      (pet) => pet && [...Object.values(pet.forms), ...Object.values(pet.savedForms)].includes(id),
    );
    const form = listed ? await readSaucelingForm(id, request.query.strips === "front") : null;
    if (!form) return reply.status(404).send({ error: "That form is not listed." });
    return form;
  });

  // POST /api/saucelings/figure — a caretaker's painted pixel figure for the Nook, in place of any they had; the one
  // it replaces is kept for Undo repaint
  app.post("/figure", async (request) => {
    const body = requestBody(request.body);
    const nowIso = new Date().toISOString();
    const characterId = requiredString(body.characterId, "Caretaker character", 200);
    if (!(await readSaucelingWorld()).settings.portraitEnabled) {
      refuse(400, "Portraits are turned off in Saucelings settings.");
    }
    await requireCaretaker(characterId, "painted");
    const image = parseFigureImage(body.image);
    if (!image) refuse(400, "A caretaker figure must be a PNG strip 768 wide and 96 high, at most 128 KB.");
    const id = await saveSaucelingFigure(characterId, image, nowIso);
    const dropped: string[] = [];
    const world = await updateSaucelingWorld((current) => {
      dropped.length = 0;
      const replaced = current.caretakerFigures[characterId];
      const old = current.savedFigures[characterId];
      if (replaced && old) dropped.push(old);
      return {
        ...current,
        caretakerFigures: { ...current.caretakerFigures, [characterId]: id },
        savedFigures: replaced ? { ...current.savedFigures, [characterId]: replaced } : current.savedFigures,
      };
    }).catch(async (error) => {
      await deleteSaucelingFigure(id).catch(() => undefined);
      throw error;
    });
    for (const figure of dropped) await deleteSaucelingFigure(figure).catch(() => undefined);
    return buildStateResponse(world, nowIso);
  });

  // PATCH /api/saucelings/caretaker/flip — { characterId, flipped } shows that caretaker facing the other way in the
  // Nook, whatever their art
  app.patch("/caretaker/flip", async (request) => {
    const body = requestBody(request.body);
    const characterId = requiredString(body.characterId, "Caretaker character", 200);
    if (typeof body.flipped !== "boolean") refuse(400, "Say whether the caretaker faces the other way.");
    await requireCaretaker(characterId, "flipped");
    const world = await updateSaucelingWorld((current) => ({
      ...current,
      flippedCaretakers: [
        ...current.flippedCaretakers.filter((id) => id !== characterId),
        ...(body.flipped === true ? [characterId] : []),
      ],
    }));
    return buildStateResponse(world);
  });

  // POST /api/saucelings/figure/undo — { characterId } swaps their figure with the one their last repaint replaced
  app.post("/figure/undo", async (request) => {
    const characterId = requiredString(requestBody(request.body).characterId, "Caretaker character", 200);
    const world = await updateSaucelingWorld((current) => {
      const now = current.caretakerFigures[characterId];
      const saved = current.savedFigures[characterId];
      if (!now || !saved) refuse(400, "There is no repaint to undo.");
      return {
        ...current,
        caretakerFigures: { ...current.caretakerFigures, [characterId]: saved },
        savedFigures: { ...current.savedFigures, [characterId]: now },
      };
    });
    return buildStateResponse(world);
  });

  // GET /api/saucelings/figure/:id — one caretaker's figure strip and its frame count, when it is listed (saved for
  // Undo repaint or not)
  app.get<{ Params: { id: string } }>("/figure/:id", async (request, reply) => {
    const id = requiredString(request.params.id, "Figure id", 200);
    const world = await readSaucelingWorld();
    const listed = [...Object.values(world.caretakerFigures), ...Object.values(world.savedFigures)].includes(id);
    const figure = listed ? await readSaucelingFigure(id) : null;
    return figure ?? reply.status(404).send({ error: "That figure is not listed." });
  });

  app.patch("/settings", async (request) => {
    const body = requestBody(request.body);
    const world = await updateSaucelingWorld((current) => ({
      ...current,
      settings: normalizeSaucelingSettings({ ...current.settings, ...body }),
    }));
    return buildStateResponse(world);
  });

  // POST /api/saucelings/reset — clear the nook, the Menagerie, the Album and the background library
  app.post("/reset", async () => {
    const world = await updateSaucelingWorld((current) => ({
      ...emptySaucelingWorld(),
      settings: current.settings,
    }));
    await removeAllSaucelingPortraits();
    return buildStateResponse(world);
  });
};
