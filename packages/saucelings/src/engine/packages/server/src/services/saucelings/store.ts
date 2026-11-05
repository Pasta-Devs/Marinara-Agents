import { createHash } from "node:crypto";
import type { CapabilityDocumentRecord } from "@marinara-engine/shared";
import {
  SAUCELING_STAGES,
  SPECIAL_SPECIES,
  type SaucelingBackground,
  type SaucelingCareProfile,
  type SaucelingDesign,
  type SaucelingEggSpot,
  type SaucelingEvolveState,
  type SaucelingFinder,
  type SaucelingMealDay,
  type SaucelingMenagerieEntry,
  type SaucelingOwnTemperament,
  type SaucelingPet,
  type SaucelingPortrait,
  type SaucelingSettings,
  type SaucelingStage,
  type SaucelingWorldDocument,
} from "../../../../shared/src/features/agents/saucelings/types.js";
import { evolutionLookOf, normalizeDesign, temperamentWords } from "./design.js";
import { getSaucelingsRuntime } from "./package-runtime.js";
import { latchUnlocks } from "./unlocks.js";

const PACKAGE_ID = "saucelings";
const DOCUMENT_KIND = "saucelings-world";
const WORLD_KEY = "default";

function worldDocumentId(): string {
  return createHash("sha256").update(`${PACKAGE_ID}\0${DOCUMENT_KIND}\0${WORLD_KEY}`).digest("hex");
}

export function defaultSaucelingSettings(): SaucelingSettings {
  return {
    careWindowHours: 6,
    dailyGenerationBudget: 6,
    portraitEnabled: false,
    connectionId: null,
    portraitConnectionId: null,
    eggHunting: true,
    writeEveryLine: false,
    threeDrawingFallback: false,
  };
}

function optionalId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 200) : null;
}

export function normalizeSaucelingSettings(value: unknown): SaucelingSettings {
  const defaults = defaultSaucelingSettings();
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  const src = value as Record<string, unknown>;
  const careWindowHours =
    typeof src.careWindowHours === "number" && Number.isFinite(src.careWindowHours)
      ? Math.max(1, Math.min(24, Math.round(src.careWindowHours)))
      : defaults.careWindowHours;
  const dailyGenerationBudget =
    typeof src.dailyGenerationBudget === "number" && Number.isFinite(src.dailyGenerationBudget)
      ? Math.max(0, Math.min(30, Math.round(src.dailyGenerationBudget)))
      : defaults.dailyGenerationBudget;
  return {
    careWindowHours,
    dailyGenerationBudget,
    portraitEnabled: src.portraitEnabled === true,
    connectionId: optionalId(src.connectionId),
    portraitConnectionId: optionalId(src.portraitConnectionId),
    eggHunting: src.eggHunting !== false,
    writeEveryLine: src.writeEveryLine === true,
    threeDrawingFallback: src.threeDrawingFallback === true,
  };
}

export function emptySaucelingWorld(): SaucelingWorldDocument {
  return {
    schemaVersion: 1,
    settings: defaultSaucelingSettings(),
    budget: {
      day: new Date().toISOString().slice(0, 10),
      used: 0,
    },
    activePet: null,
    menagerie: [],
    portraits: [],
    backgrounds: [],
    lastEggFindDay: null,
    lastNewEggDay: null,
    profileCache: {},
    caretakerFigures: {},
    savedFigures: {},
    flippedCaretakers: [],
    painting: {},
    milestones: { careActions: 0, careDays: 0, lastCareDay: null },
    unlocked: [],
  };
}

/** Caretaker figures by character id; an entry that is not an id is dropped. */
function normalizeFigures(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((pair): pair is [string, string] => optionalId(pair[1]) !== null),
  );
}

/** A list of ids, each once; anything that is not an id is dropped. */
function normalizeIds(value: unknown): string[] {
  const ids = (Array.isArray(value) ? value : []).map(optionalId);
  return [...new Set(ids.filter((id): id is string => id !== null))];
}

/** The saved backgrounds, each listed once; an entry without an id or a date is dropped. */
function normalizeBackgrounds(value: unknown): SaucelingBackground[] {
  const list: SaucelingBackground[] = [];
  for (const item of Array.isArray(value) ? value : []) {
    if (!item || typeof item !== "object") continue;
    const src = item as Record<string, unknown>;
    const id = optionalId(src.id);
    if (!id || typeof src.savedAt !== "string" || list.some((background) => background.id === id)) continue;
    list.push({
      id,
      label: typeof src.label === "string" ? src.label.trim().slice(0, 120) : "",
      source: src.source === "generated" ? "generated" : "upload",
      savedAt: src.savedAt,
    });
  }
  return list;
}

/** A whole count of at least 0. */
const countOf = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;

/** The milestones towards special eggs. A world saved before them starts from the nook pet's care actions. */
function normalizeMilestones(value: unknown, pet: SaucelingPet | null): SaucelingWorldDocument["milestones"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { careActions: pet?.careActionCount ?? 0, careDays: 0, lastCareDay: null };
  }
  const src = value as Record<string, unknown>;
  return {
    careActions: countOf(src.careActions),
    careDays: countOf(src.careDays),
    lastCareDay: typeof src.lastCareDay === "string" ? src.lastCareDay : null,
  };
}

/** The paintings in progress; an entry without a token or a date is dropped. */
function normalizePainting(value: unknown): SaucelingWorldDocument["painting"] {
  const painting: SaucelingWorldDocument["painting"] = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return painting;
  for (const [key, claim] of Object.entries(value as Record<string, unknown>)) {
    const { token, at } = (claim && typeof claim === "object" ? claim : {}) as Record<string, unknown>;
    if (typeof token === "string" && typeof at === "string") painting[key] = { token, at };
  }
  return painting;
}

/** A stored design, its painted forms and its painting tries; a pet saved before designs is a built-in species
 *  with none. */
function withDesign<T extends object>(
  item: T,
): T & Pick<SaucelingPet, "design" | "forms" | "savedForms" | "flipped" | "paintTries" | "foundBy" | "foundAt"> {
  const src = item as Record<string, unknown>;
  const design = src.design && typeof src.design === "object" ? (src.design as Partial<SaucelingDesign>) : null;
  const formsOf = (value: unknown) => {
    const found: Partial<Record<SaucelingStage, string>> = {};
    const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    for (const stage of SAUCELING_STAGES) {
      const id = optionalId(raw[stage]);
      if (id) found[stage] = id;
    }
    return found;
  };
  const paintTries: SaucelingPet["paintTries"] = {};
  const rawTries =
    src.paintTries && typeof src.paintTries === "object" ? (src.paintTries as Record<string, unknown>) : {};
  for (const key of [...SAUCELING_STAGES, "sheet"] as const) {
    const tries = rawTries[key];
    if (typeof tries === "number" && Number.isFinite(tries) && tries > 0) paintTries[key] = Math.trunc(tries);
  }
  const foundBy = optionalId(src.foundBy);
  return {
    ...item,
    design: design ? normalizeDesign(design, design.origin === "evolved" ? "evolved" : "found") : null,
    forms: formsOf(src.forms),
    savedForms: formsOf(src.savedForms),
    flipped: src.flipped === true,
    paintTries,
    foundBy,
    foundAt: foundBy && typeof src.foundAt === "string" ? src.foundAt : null,
  };
}

const recordOf = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const textOf = (value: unknown, max: number): string | null =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

function finderOf(value: unknown): SaucelingFinder | null {
  const src = recordOf(value);
  const id = optionalId(src.id);
  const name = textOf(src.name, 80);
  return id && name ? { id, name } : null;
}

function ownTemperamentOf(value: unknown): SaucelingOwnTemperament | null {
  const src = recordOf(value);
  const words = temperamentWords(src.name, src.readsAs);
  const takesAfter = finderOf(src.takesAfter);
  const at = textOf(src.at, 40);
  if (!words || !takesAfter || !at) return null;
  return { ...words, takesAfter, steps: src.steps === 1 || src.steps === 2 ? src.steps : 3, at };
}

/** Its finder and its own temperament. One saved before finders were kept takes whoever said its egg's first line
 *  (its id from their saved voice), else whoever found it while chatting, else its caretaker. */
function withFinder<T extends SaucelingPet | SaucelingMenagerieEntry>(
  item: T,
  profiles: Record<string, SaucelingCareProfile>,
): T {
  const src = item as unknown as Record<string, unknown>;
  const saved = finderOf(src.finder);
  const journal = Array.isArray(item.journal) ? item.journal : [];
  const speaker = journal.find((ev) => ev.kind === "egg-found" && ev.id.startsWith("egg-"))?.speaker;
  const spoke = speaker ? Object.values(profiles).find((profile) => profile.characterName === speaker) : undefined;
  const finder = saved ?? {
    id: spoke?.characterId ?? item.foundBy ?? item.caretakerId,
    name: speaker ?? item.careProfile.characterName,
  };
  return { ...item, finder, ownTemperament: ownTemperamentOf(src.ownTemperament) };
}

function eggSpotOf(value: unknown): SaucelingEggSpot | null {
  const src = recordOf(value);
  const share = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null);
  const x = share(src.x);
  const y = share(src.y);
  return x === null || y === null ? null : { x, y, backgroundId: optionalId(src.backgroundId) };
}

/** When its caretaker took it on: one saved before this was kept counts from its newest hello or welcome back. */
function withCaretakerSince(pet: SaucelingPet): SaucelingPet {
  const src = pet as unknown as Record<string, unknown>;
  const since =
    textOf(src.caretakerSince, 40) ??
    pet.journal.find((ev) => ev.kind === "caretaker-change" || ev.kind === "return-from-album")?.createdAt ??
    pet.createdAt;
  return { ...pet, caretakerSince: since, eggSpot: eggSpotOf(src.eggSpot) };
}

/** The caretaker's meal record: one saved before it was kept starts empty, and a malformed day is dropped. */
function withMealRecord(pet: SaucelingPet): SaucelingPet {
  const src = (pet as unknown as Record<string, unknown>).mealRecord;
  const count = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null);
  const mealRecord = (Array.isArray(src) ? src : []).flatMap((item): SaucelingMealDay[] => {
    const day = recordOf(item);
    const [d, given, total] = [count(day.day), count(day.given), count(day.total)];
    return d === null || given === null || total === null ? [] : [{ day: d, given, total }];
  });
  return { ...pet, mealRecord };
}

/** Time spent growing: one saved before it was kept counts its whole age so far, so nobody shrinks back a stage. */
function withGrowth<T extends SaucelingPet | SaucelingMenagerieEntry>(item: T): T {
  const saved = (item as unknown as Record<string, unknown>).growthMs;
  if (typeof saved === "number" && Number.isFinite(saved) && saved >= 0) return item;
  const stage = "stageAtRetirement" in item ? item.stageAtRetirement : item.stage;
  const until = Date.parse("retiredAt" in item ? item.retiredAt : item.lastTickAt);
  const age = Number.isFinite(until) ? until - Date.parse(item.createdAt) : 0;
  return { ...item, growthMs: stage === "egg" || !(age > 0) ? 0 : age };
}

/** Its evolution. One saved before evolutions were offered counts as evolved when it evolved the old way (a new
 *  design), from when it hatched; with no look it has nothing to undo. Malformed parts are dropped. */
function withEvolution<T extends SaucelingPet | SaucelingMenagerieEntry>(item: T): T {
  const src = recordOf((item as unknown as Record<string, unknown>).evolution);
  const count = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null);
  const choices = Array.isArray(src.choices) ? src.choices.map(evolutionLookOf) : [];
  const legacyAt = item.design?.origin === "evolved" ? (item.hatchedAt ?? item.createdAt) : null;
  const evolution: SaucelingEvolveState = {
    offer: src.offer === "offered" || src.offer === "declined" ? src.offer : null,
    choices: choices.length === 2 && choices[0] && choices[1] ? [choices[0], choices[1]] : null,
    look: evolutionLookOf(src.look),
    at: "evolution" in item ? textOf(src.at, 40) : legacyAt,
    goodHours: (Array.isArray(src.goodHours) ? src.goodHours : []).flatMap((entry) => {
      const [day, good] = [count(recordOf(entry).day), count(recordOf(entry).good)];
      return day === null || good === null ? [] : [{ day, good }];
    }),
    chatDays: (Array.isArray(src.chatDays) ? src.chatDays : []).flatMap((day) => (count(day) === null ? [] : [day])),
  };
  return { ...item, evolution };
}

export function normalizeSaucelingWorld(value: unknown): SaucelingWorldDocument {
  const empty = emptySaucelingWorld();
  if (!value || typeof value !== "object" || Array.isArray(value)) return empty;
  const src = value as Record<string, unknown>;
  const budgetObj =
    src.budget && typeof src.budget === "object" && !Array.isArray(src.budget)
      ? (src.budget as Record<string, unknown>)
      : {};
  // A painting's caption is only kept when it is text.
  const portraits: SaucelingPortrait[] = Array.isArray(src.portraits)
    ? (src.portraits as SaucelingPortrait[]).map(({ instructions, ...rest }) =>
        typeof instructions === "string" ? { ...rest, instructions } : rest,
      )
    : [];
  const pet =
    src.activePet && typeof src.activePet === "object" ? (src.activePet as SaucelingWorldDocument["activePet"]) : null;
  const menagerie = (Array.isArray(src.menagerie) ? src.menagerie : []) as SaucelingMenagerieEntry[];
  // A pet saved before custom backgrounds shows its species' built-in one.
  const withBackground = <T extends { backgroundId?: unknown }>(item: T): T & { backgroundId: string | null } => ({
    ...item,
    backgroundId: typeof item.backgroundId === "string" && item.backgroundId ? item.backgroundId : null,
  });
  const profiles = recordOf(src.profileCache) as Record<string, SaucelingCareProfile>;
  const activePet = pet
    ? withEvolution(
        withMealRecord(withCaretakerSince(withGrowth(withFinder(withDesign(withBackground(pet)), profiles)))),
      )
    : null;
  const entries = menagerie.map((entry) =>
    withEvolution(withGrowth(withFinder(withDesign(withBackground(entry)), profiles))),
  );
  const backgrounds = normalizeBackgrounds(src.backgrounds);
  const world: SaucelingWorldDocument = {
    schemaVersion: 1,
    settings: normalizeSaucelingSettings(src.settings),
    budget: {
      day: typeof budgetObj.day === "string" ? budgetObj.day : empty.budget.day,
      used:
        typeof budgetObj.used === "number" && Number.isFinite(budgetObj.used)
          ? Math.max(0, Math.trunc(budgetObj.used))
          : 0,
    },
    activePet,
    menagerie: entries,
    portraits: portraits.sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
    backgrounds: backgrounds.sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
    lastEggFindDay: typeof src.lastEggFindDay === "string" ? src.lastEggFindDay : null,
    lastNewEggDay: typeof src.lastNewEggDay === "string" ? src.lastNewEggDay : null,
    profileCache: profiles,
    caretakerFigures: normalizeFigures(src.caretakerFigures),
    savedFigures: normalizeFigures(src.savedFigures),
    flippedCaretakers: normalizeIds(src.flippedCaretakers),
    painting: normalizePainting(src.painting),
    milestones: normalizeMilestones(src.milestones, activePet),
    unlocked: Array.isArray(src.unlocked)
      ? SPECIAL_SPECIES.filter((id) => (src.unlocked as unknown[]).includes(id))
      : [],
  };
  // Every save checks the milestones, so a special egg unlocks as soon as one is met and stays unlocked.
  return { ...world, unlocked: latchUnlocks(world) };
}

export function isCreateConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const conflict = error as { code?: unknown; table?: unknown; keys?: unknown };
  return (
    conflict.code === "FILE_UNIQUE_CONSTRAINT" &&
    conflict.table === "capability_documents" &&
    Array.isArray(conflict.keys) &&
    conflict.keys.length === 1 &&
    conflict.keys[0] === "id"
  );
}

let writeQueue: Promise<void> = Promise.resolve();

function withWorldQueue<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.catch(() => undefined).then(task);
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function findWorldDocument(): Promise<CapabilityDocumentRecord | null> {
  return getSaucelingsRuntime().persistence.documents.getById(PACKAGE_ID, worldDocumentId());
}

export async function readSaucelingWorld(): Promise<SaucelingWorldDocument> {
  const doc = await findWorldDocument();
  return normalizeSaucelingWorld(doc?.data);
}

export async function updateSaucelingWorld(
  updater: (current: SaucelingWorldDocument) => SaucelingWorldDocument | Promise<SaucelingWorldDocument>,
): Promise<SaucelingWorldDocument> {
  return withWorldQueue(async () => {
    const runtime = getSaucelingsRuntime();
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      const doc = await findWorldDocument();
      const current = normalizeSaucelingWorld(doc?.data);
      const next = normalizeSaucelingWorld(await updater(current));
      const now = new Date().toISOString();
      if (!doc) {
        try {
          await runtime.persistence.documents.create({
            id: worldDocumentId(),
            packageId: PACKAGE_ID,
            kind: DOCUMENT_KIND,
            name: "Saucelings Nook",
            description: "Saucelings active companion, Menagerie, Album index, and care settings",
            data: next,
            createdAt: now,
            updatedAt: now,
          });
          return next;
        } catch (error) {
          lastError = error;
          if (!isCreateConflict(error)) throw error;
          continue;
        }
      }
      const saved = await runtime.persistence.documents.update({
        id: doc.id,
        packageId: PACKAGE_ID,
        expectedRevision: doc.revision,
        name: "Saucelings Nook",
        description: doc.description,
        data: next,
        updatedAt: now,
      });
      if (saved) return next;
    }
    if (lastError instanceof Error) throw lastError;
    throw new Error("Saucelings state changed while saving. Please try again.");
  });
}
