// ──────────────────────────────────────────────
// Otome Forge: paid paints and their records (plan §1.8, "Paint records")
// ──────────────────────────────────────────────
// A look is painted only after an explicit tap (the forge's consent or the art route). Its record follows GF's rules
// for paid work: `pending` is saved before the paid call, a failure is saved as `failed` and is never repainted
// without another tap, and a `pending` record with no live owner in this process (the server restarted mid-paint) is
// shown as `stopped` (paintView, which every view of the run, its world, a beat and its scene applies). The previous
// portrait stays until a new one is saved, then its gallery image is deleted.
//
// M2b paints places, story CGs and expressions the same way, through one lane per image connection (paintSlot): one
// paid image at a time, taps and scene art ahead of background faces. paintRecord is the shared lifecycle of a scene
// paint: right before the paid call it checks the record is still the one this paint marked pending, and it saves the
// result only onto that record, so a rewritten beat, a deleted run or a setting turned off never receives (or pays for)
// an image meant for something else; an image nothing keeps is deleted from the gallery again.
import type { CapabilityRuntimeHost } from "@marinara-engine/shared";
import type {
  LiId,
  Paint,
  Player,
  Presentation,
  World,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { generateJson, readOrGenerate } from "../generation.js";
import { OtomeForgeError } from "../http.js";
import { isLiId, playerId, runDocTarget, unitId, worldId } from "../ids.js";
import { normalizePlayer } from "../schemas/player.js";
import { normalizeUnit } from "../schemas/unit.js";
import { normalizeWorld } from "../schemas/world.js";
import { normalizePlayerLook, PlayerLookSchema, playerLookMessages, readPersona } from "../setup/prompts.js";
import type { DocTarget, Normalize, OtomeStore } from "../store.js";
import {
  GALLERY_REF_PREFIX,
  galleryRef,
  imageClientFor,
  type ImageClient,
  type ImageSubject,
  type PaintedImage,
} from "./image-client.js";
import { LOOK_SIZE, lookPrompt, type ImagePrompt } from "./prompts.js";

/** Whose look: the protagonist, or `li:<li id>`. */
export type LookOwner = "player" | `li:${LiId}`;

export interface ArtDeps {
  runtime: Pick<
    CapabilityRuntimeHost,
    "languageModels" | "json" | "logger" | "isDebugAgentsEnabled" | "integrations" | "resources"
  >;
  store: OtomeStore;
  /** The loopback client by default; tests pass a fake. */
  images?: ImageClient;
}

const ERROR_MAX = 300;
const LOOK_LINE_MAX = 600;

export const imagesOf = (deps: ArtDeps) => deps.images ?? imageClientFor(deps.runtime);

export function parseLookOwner(value: unknown): LookOwner | null {
  if (value === "player") return "player";
  return typeof value === "string" && value.startsWith("li:") && isLiId(value.slice(3)) ? (value as LookOwner) : null;
}

const notFound = () => new OtomeForgeError(404, "No such Otome Forge run.", "not-found");

// ── Live paints in this process ──

/**
 * Whose paint: a look (`player`, `li:<id>`), a place (`place:<key>`), a story CG (`cg:<key>/<i>@<written at>`), or (M4,
 * S/art/outfits.ts) an item's art (`item:<item id>`) or a couple set's pair portrait (`item:<her look's id>/pair`).
 */
export type PaintOwner = LookOwner | `place:${string}` | `cg:${string}` | `item:${string}`;

const live = new Map<string, { settled: Promise<void>; settle: () => void }>();
const liveKey = (runId: string, owner: PaintOwner) => `${runId}|${owner}`;

export function paintIsLive(runId: string, owner: PaintOwner): boolean {
  return live.has(liveKey(runId, owner));
}

/** Marks the owner's paint live in this process and returns its release, or null while another one is. */
export function startPaint(runId: string, owner: PaintOwner): (() => void) | null {
  const key = liveKey(runId, owner);
  if (live.has(key)) return null;
  let settle = () => {};
  const settled = new Promise<void>((resolve) => (settle = resolve));
  const entry = { settled, settle };
  live.set(key, entry);
  return () => {
    if (live.get(key) === entry) live.delete(key);
    settle();
  };
}

/** Resolves once the owner's live paint, if there is one, has ended. */
export function paintSettled(runId: string, owner: PaintOwner): Promise<void> {
  return live.get(liveKey(runId, owner))?.settled ?? Promise.resolve();
}

/**
 * A tap's paint, as the owner's only live paint in this process. A tap that finds another paint live waits for it:
 * when that one left the record ready or failed, the tap answers with it, so no tap pays twice; when it painted
 * nothing (an automatic pass that only looked, or left it waiting), the tap goes ahead itself.
 */
export async function tapPaint<T>(
  runId: string,
  owner: () => Promise<PaintOwner>,
  after: () => Promise<{ value: T; art?: Paint }>,
  paint: () => Promise<T>,
): Promise<T> {
  for (;;) {
    const current = await owner();
    const release = startPaint(runId, current);
    if (release) {
      try {
        return await paint();
      } finally {
        release();
      }
    }
    await paintSettled(runId, current);
    const left = await after();
    if (left.art?.state === "ready" || left.art?.state === "failed") return left.value;
  }
}

/** Claims the owner's look for one paint (a 409 `busy` while another runs) and returns the release. */
export function claimPaint(runId: string, owner: PaintOwner): () => void {
  const release = startPaint(runId, owner);
  if (!release) throw new OtomeForgeError(409, "This look is already being painted.", "busy");
  return release;
}

/** The record as the client should see it: `pending` with no live owner here is `stopped`. */
export function paintView(runId: string, owner: PaintOwner, paint: Paint | undefined): Paint | undefined {
  return paint?.state === "pending" && !paintIsLive(runId, owner) ? { ...paint, state: "stopped" } : paint;
}

// ── One paid image at a time per image connection ──

/** `high`: taps and scene art (places, CGs); `low`: background faces, which wait for every `high` paint. */
export type PaintLane = "high" | "low";

interface Lanes {
  busy: boolean;
  high: Array<() => void>;
  low: Array<() => void>;
}

const lanes = new Map<string, Lanes>();

function nextPaint(connectionId: string, queue: Lanes) {
  if (queue.busy) return;
  const start = queue.high.shift() ?? queue.low.shift();
  if (!start) {
    if (lanes.get(connectionId) === queue) lanes.delete(connectionId);
    return;
  }
  queue.busy = true;
  start();
}

/**
 * Runs `task` once every earlier paint on the connection has finished: one paid image at a time, `high` before `low`.
 * A task must not wait on another paintSlot of the same connection, or both wait forever.
 */
export function paintSlot<T>(connectionId: string, task: () => Promise<T>, lane: PaintLane = "high"): Promise<T> {
  let queue = lanes.get(connectionId);
  if (!queue) {
    queue = { busy: false, high: [], low: [] };
    lanes.set(connectionId, queue);
  }
  const lanesOf = queue;
  return new Promise<T>((resolve, reject) => {
    lanesOf[lane].push(() => {
      void Promise.resolve()
        .then(task)
        .then(resolve, reject)
        .finally(() => {
          lanesOf.busy = false;
          nextPaint(connectionId, lanesOf);
        });
    });
    nextPaint(connectionId, lanesOf);
  });
}

// ── Writes that may change nothing ──

const UNCHANGED = Symbol("unchanged");

/**
 * updateDoc that writes nothing when `change` returns undefined. Resolves the document as saved (`changed`) or as it
 * stands, or null when it does not exist.
 */
export async function updateIfChanged<T>(
  store: Pick<OtomeStore, "updateDoc">,
  target: DocTarget,
  normalize: Normalize<T>,
  change: (current: T) => T | undefined,
): Promise<{ value: T; changed: boolean } | null> {
  let kept: T | undefined;
  try {
    const saved = await store.updateDoc(target, normalize, (current) => {
      const next = change(current);
      if (next !== undefined) return next;
      kept = current;
      throw UNCHANGED;
    });
    return saved === null ? null : { value: saved, changed: true };
  } catch (error) {
    if (error === UNCHANGED) return { value: kept as T, changed: false };
    throw error;
  }
}

// ── A scene paint's record ──

/** What the record says right before the paid call: paint now, or stop (and how to leave the record). */
export type PaintCheck = "paint" | "stopped" | "waiting-consent" | "gone";

export interface PaintRecordJob {
  connectionId: string;
  /** For the log: what is painted (a place key, a beat). Never the prompt. */
  label: string;
  /** Re-reads the record: still the one this paint marked pending, the run and connection unchanged, consent still given. */
  check: () => Promise<PaintCheck>;
  /** The paid call; it uploads to the gallery too. */
  paint: () => Promise<PaintedImage>;
  /** Writes `art` onto the record only while it is still the one this paint marked pending; true when it did. */
  save: (art: Paint) => Promise<boolean>;
  /** False once the art service is torn down: nothing more is paid for. */
  active?: () => boolean;
}

const failure = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, ERROR_MAX);

/**
 * One paid image for a record its caller has just marked pending, in the connection's `high` lane. Resolves the record
 * as left: `ready`, `failed` (never repainted without a tap), `stopped` or `waiting-consent` (nothing was paid for), or
 * null when the record is gone. An image that could not be saved onto its record is deleted from the gallery.
 */
export function paintRecord(deps: ArtDeps, job: PaintRecordJob): Promise<Paint | null> {
  const images = imagesOf(deps);
  return paintSlot(job.connectionId, async () => {
    const check = job.active && !job.active() ? "stopped" : await job.check();
    if (check !== "paint") {
      if (check === "gone") return null;
      const left: Paint = { state: check, at: new Date().toISOString() };
      return (await job.save(left)) ? left : null;
    }
    let image: PaintedImage;
    try {
      image = await job.paint();
    } catch (error) {
      const message = failure(error);
      deps.runtime.logger.warn("[otome-forge] painting %s failed: %s", job.label, message);
      const failed: Paint = { state: "failed", at: new Date().toISOString(), error: message };
      return (await job.save(failed)) ? failed : null;
    }
    const ref = image.id ? galleryRef(image.id) : undefined;
    const ready: Paint = { state: "ready", at: new Date().toISOString(), url: image.url, ...(ref ? { ref } : {}) };
    let kept = false;
    try {
      kept = await job.save(ready);
    } finally {
      // The record was replaced, its beat rewritten or its run deleted while this painted: nothing refers to it.
      if (!kept && image.id) await images.deleteGalleryImage(image.id);
    }
    return kept ? ready : null;
  });
}

// ── Whose look, and how it reads ──

export interface LookSubject {
  name: string;
  identityLine: string;
  outfitLine: string;
  presentation: Presentation;
  image: ImageSubject;
}

/**
 * The protagonist's look lines: saved ones, else the persona's (image) appearance, else P4 writes them. Runs in the
 * run's foreground queue and re-reads first, so two paints never write it twice.
 */
async function ensurePlayerLook(
  deps: ArtDeps,
  runId: string,
  world: World,
  player: Player,
  debugMode: boolean,
): Promise<Player["look"]> {
  if (player.look.identityLine.trim()) return player.look;
  const read = async () => {
    const saved = await deps.store.readDoc(playerId(runId), normalizePlayer);
    return saved?.look.identityLine.trim() ? saved.look : null;
  };
  return readOrGenerate(runId, read, async () => {
    const persona = await readPersona(deps.runtime, player.personaId);
    // ponytail: a persona appearance is used as written, even when it is not English; the upgrade path is GF's
    // English check (server.mjs `Da`) sending a non-English one through P4 as well.
    const look = persona?.appearance
      ? { identityLine: persona.appearance.slice(0, LOOK_LINE_MAX), outfitLine: "" }
      : (
          await generateJson(deps, {
            runId,
            job: "structured",
            label: "player-look",
            messages: playerLookMessages({ world, player, persona }),
            schema: PlayerLookSchema,
            normalize: normalizePlayerLook,
            temperature: 0.3,
            maxTokens: 400,
            debugMode,
            lane: "foreground",
          })
        ).value;
    const saved = await deps.store.updateDoc(runDocTarget("player", playerId(runId)), normalizePlayer, (current) => ({
      ...current,
      look,
    }));
    if (!saved) throw notFound();
    return look;
  });
}

/** Whose look `owner` names, as a look prompt draws them (the protagonist's lines are written first if missing). */
export async function readSubject(
  deps: ArtDeps,
  runId: string,
  world: World,
  owner: LookOwner,
  debugMode: boolean,
): Promise<LookSubject> {
  if (owner === "player") {
    const player = await deps.store.readDoc(playerId(runId), normalizePlayer);
    if (!player) throw notFound();
    const look = await ensurePlayerLook(deps, runId, world, player, debugMode);
    return {
      name: player.name || "Protagonist",
      ...look,
      presentation: "person",
      image: {
        kind: "character",
        personaId: player.personaId,
        ...(player.portrait ? { portrait: player.portrait } : {}),
      },
    };
  }
  const li = owner.slice(3);
  const unit = await deps.store.readDoc(unitId(runId, li), normalizeUnit);
  if (!unit) throw new OtomeForgeError(404, "No such love interest.", "not-found");
  if (!unit.bible) throw new OtomeForgeError(409, `${unit.name}'s bible is not written yet.`, "conflict");
  return {
    name: unit.name,
    identityLine: unit.identityLine || unit.bible.look.identityLine,
    outfitLine: unit.outfitLine || unit.bible.look.outfitLine,
    presentation: unit.bible.look.presentation,
    image: {
      kind: "character",
      ...(unit.cardId ? { cardId: unit.cardId } : {}),
      ...(unit.portrait ? { portrait: unit.portrait } : {}),
      outfits: unit.outfits,
    },
  };
}

/** The look prompt the paint would send (the review dialog shows it), with `edited` text kept and made safe. */
export async function lookPromptFor(
  deps: ArtDeps,
  runId: string,
  owner: LookOwner,
  edited: Partial<ImagePrompt>,
  debugMode: boolean,
): Promise<ImagePrompt & { world: World; subject: LookSubject }> {
  const world = await deps.store.readDoc(worldId(runId), normalizeWorld);
  if (!world) throw notFound();
  const subject = await readSubject(deps, runId, world, owner, debugMode);
  const style = await imagesOf(deps).styleProfile(world.images.styleProfileId);
  return { ...lookPrompt({ ...subject, world, style }, edited), world, subject };
}

// ── The record ──

/** Saves the owner's paint record (and, on success, the portrait); returns the portrait ref it replaced. */
async function savePaint(
  deps: ArtDeps,
  runId: string,
  owner: LookOwner,
  art: Paint,
  portrait?: { portrait: string; portraitRef?: string },
): Promise<string | undefined> {
  let replaced: string | undefined;
  const apply = <T extends { art?: Paint; portrait?: string; portraitRef?: string }>(current: T): T => {
    replaced = portrait ? current.portraitRef : undefined;
    if (!portrait) return { ...current, art };
    const { portraitRef: _old, ...rest } = current;
    return {
      ...rest,
      art,
      portrait: portrait.portrait,
      ...(portrait.portraitRef ? { portraitRef: portrait.portraitRef } : {}),
    } as T;
  };
  const saved =
    owner === "player"
      ? await deps.store.updateDoc(runDocTarget("player", playerId(runId)), normalizePlayer, apply)
      : await deps.store.updateDoc(runDocTarget("unit", unitId(runId, owner.slice(3))), normalizeUnit, apply);
  // The run was deleted meanwhile: nothing is brought back.
  if (!saved) throw notFound();
  return replaced;
}

/**
 * Paints the owner's look once, for a caller holding `claimPaint`. Problems found before the paid call (no image
 * connection, no such run, no bible yet) throw; a failed paint is saved and returned as `failed`.
 */
export async function paintClaimed(
  deps: ArtDeps,
  runId: string,
  owner: LookOwner,
  { prompt, negativePrompt, debugMode }: Partial<ImagePrompt> & { debugMode: boolean },
): Promise<Paint> {
  const built = await lookPromptFor(deps, runId, owner, { prompt, negativePrompt }, debugMode);
  const connectionId = built.world.images.connectionId;
  if (!connectionId) throw new OtomeForgeError(503, "This world has no image connection.", "no-connection");
  await savePaint(deps, runId, owner, { state: "pending", at: new Date().toISOString() });
  const images = imagesOf(deps);
  let image: PaintedImage;
  try {
    image = await images.generatePortrait({
      connectionId,
      name: built.subject.name,
      unit: built.subject.image,
      prompt: built.prompt,
      negativePrompt: built.negativePrompt,
      ...LOOK_SIZE,
      debugMode,
    });
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, ERROR_MAX);
    deps.runtime.logger.warn("[otome-forge] painting %s failed: %s", owner, message);
    const failed: Paint = { state: "failed", at: new Date().toISOString(), error: message };
    await savePaint(deps, runId, owner, failed);
    return failed;
  }
  const ref = image.id ? galleryRef(image.id) : undefined;
  const paint: Paint = { state: "ready", at: new Date().toISOString(), url: image.url, ...(ref ? { ref } : {}) };
  let replaced: string | undefined;
  try {
    replaced = await savePaint(deps, runId, owner, paint, { portrait: image.url, portraitRef: ref });
  } catch (error) {
    // Nothing refers to the new image: remove it rather than leave it in the gallery. The record stays pending,
    // which reads as stopped once this paint releases its claim.
    if (image.id) await images.deleteGalleryImage(image.id);
    throw error;
  }
  if (replaced?.startsWith(GALLERY_REF_PREFIX) && replaced !== ref) {
    await images.deleteGalleryImage(replaced.slice(GALLERY_REF_PREFIX.length));
  }
  return paint;
}
