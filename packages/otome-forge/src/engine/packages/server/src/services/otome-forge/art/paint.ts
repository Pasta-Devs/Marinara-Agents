// ──────────────────────────────────────────────
// Otome Forge: paid paints and their records (plan §1.8, "Paint records")
// ──────────────────────────────────────────────
// A look is painted only after an explicit tap (the forge's consent or the art route). Its record follows GF's rules
// for paid work: `pending` is saved before the paid call, a failure is saved as `failed` and is never repainted
// without another tap, and a `pending` record with no live owner in this process (the server restarted mid-paint) is
// shown as `stopped` (paintView, which the run view applies). The previous portrait stays until a new one is saved,
// then its gallery image is deleted.
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
import type { OtomeStore } from "../store.js";
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

const live = new Set<string>();
const liveKey = (runId: string, owner: LookOwner) => `${runId}|${owner}`;

export function paintIsLive(runId: string, owner: LookOwner): boolean {
  return live.has(liveKey(runId, owner));
}

/** Claims the owner's look for one paint (a 409 `busy` while another runs) and returns the release. */
export function claimPaint(runId: string, owner: LookOwner): () => void {
  const key = liveKey(runId, owner);
  if (live.has(key)) throw new OtomeForgeError(409, "This look is already being painted.", "busy");
  live.add(key);
  return () => live.delete(key);
}

/** The record as the client should see it: `pending` with no live owner here is `stopped`. */
export function paintView(runId: string, owner: LookOwner, paint: Paint | undefined): Paint | undefined {
  return paint?.state === "pending" && !paintIsLive(runId, owner) ? { ...paint, state: "stopped" } : paint;
}

// ── Whose look, and how it reads ──

interface LookSubject {
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

async function readSubject(
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
