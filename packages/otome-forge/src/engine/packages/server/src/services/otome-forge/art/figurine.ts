// ──────────────────────────────────────────────
// Otome Hearth: a love interest's Shop figurine, painted once it is bought (#2138)
// ──────────────────────────────────────────────
// A figurine is one paid image (figurinePrompt): a small collectible figure of them in the look they wear now, on a
// round display base, full figure on a look's chroma matte and at a look's size, with their likeness as a look gets it
// (generateOutfit: their card or portrait, never a look they wear). Its record is `unit.figurine`, with the item art's
// rules for paid work (S/art/outfits.ts, S/art/paint.ts):
// - The purchase (S/routes/shop.ts) claims it once, `pending` (or `waiting-consent` under Ask before painting or the
//   Engine's prompt review) in one revision-checked write of the unit, and paints it in the background; it never
//   waits for the paint. Without an image connection nothing is claimed, and the shelf keeps their portrait frame.
// - Right before the paid call the record is checked again (still the one this paint marked pending, the image
//   connection unchanged, consent still given), and the image is saved only onto that record.
// - A failure is kept and repainted only by a tap (POST .../shop/figurines/:li/art: consent, a reviewed prompt or
//   Retry, which never pays twice); a `pending` record with no live paint in this process reads as `stopped`.
// - Once painted it is cut out of its backdrop by Home's free cut-out queue (S/art/cutout.ts, `unit.cutouts`), queued
//   right after the paint and again by a Shop or Home read that finds none; until then the client shows the painted
//   image only through its free display cleanup (C/components/LookImage.tsx), never with its chroma matte.
// Opening the Shop or Home never paints one.
import type { LiId, Paint, Unit } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import type { FigurinePicture } from "../../../../../client/src/features/otome-forge/shared/shop.js";
import { OtomeForgeError } from "../http.js";
import { runDocTarget, stateId, unitId, worldId } from "../ids.js";
import { type ImagePrompt, LOOK_SIZE, figurinePrompt } from "../prompts.js";
import { normalizeState } from "../schemas/state.js";
import { normalizeUnit } from "../schemas/unit.js";
import { normalizeWorld } from "../schemas/world.js";
import { cutoutView, queueCutouts, type CutoutClient } from "./cutout.js";
import { worldStyle } from "./image-client.js";
import type { ItemArtDeps, ItemPaintOptions } from "./outfits.js";
import {
  imagesOf,
  paintRecord,
  paintView,
  readSubject,
  startPaint,
  tapPaint,
  updateIfChanged,
  type PaintCheck,
  type PaintOwner,
} from "./paint.js";

export interface FigurineDeps extends ItemArtDeps {
  /** The loopback cut-out client by default (S/art/cutout.ts); tests pass a fake. */
  cutouts?: CutoutClient;
}

/** The live-paint owner of a love interest's figurine. */
export const figurineOwner = (li: LiId): PaintOwner => `figurine:${li}`;

const notFound = (what: string) => new OtomeForgeError(404, `No such ${what}.`, "not-found");
const unitTarget = (runId: string, li: LiId) => runDocTarget("unit", unitId(runId, li));
const activeOf = (deps: FigurineDeps) => () => !deps.art || deps.art.active();
const readUnit = (deps: Pick<FigurineDeps, "store">, runId: string, li: LiId) =>
  deps.store.readDoc(unitId(runId, li), normalizeUnit).then((unit) => (unit?.id ? unit : null));

/** The figurine as the client shows it: its paint (a pending one nothing paints here reads as stopped), its picture. */
export function figurinePicture(runId: string, unit: Pick<Unit, "id" | "figurine" | "cutouts">): FigurinePicture {
  const art = paintView(runId, figurineOwner(unit.id), unit.figurine) ?? null;
  const painted = art?.state === "ready" ? art.url : undefined;
  if (!painted) return { art, cutting: false };
  const { state, cutout } = cutoutView(runId, unit, painted);
  return { art, url: cutout ?? painted, cutting: state === "pending" };
}

/** Queues the cut-out of each painted figurine without one (no model or image call); the units as shown meanwhile. */
export function queueFigurineCutouts(deps: FigurineDeps, runId: string, units: Unit[]): Promise<Unit[]> {
  return Promise.all(
    units.map((unit) =>
      unit.figurine?.state === "ready" && unit.figurine.url
        ? queueCutouts(deps, runId, unit, [unit.figurine.url])
        : unit,
    ),
  );
}

/** A love interest whose figurine was bought, or why not: 404 for no such love interest, 409 `locked` before. */
async function readBought(deps: Pick<FigurineDeps, "store">, runId: string, li: LiId): Promise<Unit> {
  const [state, unit] = await Promise.all([
    deps.store.readDoc(stateId(runId), normalizeState),
    readUnit(deps, runId, li),
  ]);
  if (!state) throw notFound("Otome Forge run");
  if (!unit?.bible || !state.lis[li]) throw notFound("love interest");
  if (!state.owned.figurines[li]) {
    throw new OtomeForgeError(409, "This figurine has not been bought yet.", "locked");
  }
  return unit;
}

/** The prompt and the paid call for their figurine, from the documents as they are now. */
async function buildFigurine(deps: FigurineDeps, runId: string, li: LiId, edited: Partial<ImagePrompt>) {
  const [world, unit] = await Promise.all([
    deps.store.readDoc(worldId(runId), normalizeWorld),
    readUnit(deps, runId, li),
  ]);
  if (!world) throw notFound("Otome Forge run");
  if (!unit) throw notFound("love interest");
  const subject = await readSubject(deps, runId, world, `li:${li}`, false);
  const worn = unit.outfits.find((outfit) => outfit.id === unit.wornOutfit);
  const images = imagesOf(deps);
  const style = await worldStyle(images, world.images);
  const prompt = figurinePrompt(
    { ...subject, outfitLine: worn?.outfitLine || subject.outfitLine, world, style },
    edited,
  );
  return {
    ...prompt,
    paint: (connectionId: string, debugMode: boolean) =>
      images.generateOutfit({
        connectionId,
        name: subject.name,
        // Their likeness, as a look gets it: the card or the base portrait, never a look they wear.
        unit: { ...subject.image, outfits: [], who: subject.name },
        prompt: prompt.prompt,
        negativePrompt: prompt.negativePrompt,
        ...LOOK_SIZE,
        debugMode,
      }),
  };
}

/** The prompt the figurine's paint would send (the review dialog shows it). */
export async function figurineArtPrompt(deps: FigurineDeps, runId: string, li: LiId): Promise<ImagePrompt> {
  await readBought(deps, runId, li);
  const { prompt, negativePrompt } = await buildFigurine(deps, runId, li, {});
  return { prompt, negativePrompt };
}

/** Paints the figurine its caller marked pending at `at`, in the connection's lane, then queues its cut-out. */
async function paintFigurine(
  deps: FigurineDeps,
  runId: string,
  li: LiId,
  at: string,
  connectionId: string,
  { debugMode, consent, edited = {} }: { debugMode: boolean; consent: boolean; edited?: Partial<ImagePrompt> },
): Promise<Paint | null> {
  const left = await paintRecord(deps, {
    connectionId,
    label: `figurine ${li}`,
    active: activeOf(deps),
    async check(): Promise<PaintCheck> {
      const [unit, world] = await Promise.all([
        readUnit(deps, runId, li),
        deps.store.readDoc(worldId(runId), normalizeWorld),
      ]);
      if (!unit || !world || unit.figurine?.state !== "pending" || unit.figurine.at !== at) return "gone";
      if (world.images.connectionId !== connectionId) return "stopped";
      if (!consent && world.images.ask) return "waiting-consent";
      return "paint";
    },
    // Built now, so the look they wear and the rating are the ones in force at the paid call.
    paint: async () => (await buildFigurine(deps, runId, li, edited)).paint(connectionId, debugMode),
    save: async (art) =>
      !!(
        await updateIfChanged(deps.store, unitTarget(runId, li), normalizeUnit, (current) =>
          current.figurine?.state === "pending" && current.figurine.at === at
            ? { ...current, figurine: art }
            : undefined,
        )
      )?.changed,
  });
  if (left?.state === "ready") {
    const unit = await readUnit(deps, runId, li);
    if (unit) await queueFigurineCutouts(deps, runId, [unit]);
  }
  return left;
}

/**
 * The purchase's paint: claims the figurine once and paints it in the background (see the header). Resolves the unit
 * as the claim left it, or null when nothing was claimed (no image connection, the art service stopped, a paint of it
 * live already); never waits for the paint.
 */
export async function queueFigurineArt(
  deps: FigurineDeps,
  runId: string,
  li: LiId,
  { debugMode, review }: ItemPaintOptions,
): Promise<Unit | null> {
  const world = await deps.store.readDoc(worldId(runId), normalizeWorld);
  const connectionId = world?.images.connectionId;
  if (!world || !connectionId || !activeOf(deps)()) return null;
  const release = startPaint(runId, figurineOwner(li));
  if (!release) return null;
  let handed = false;
  try {
    const wait = world.images.ask || review === true;
    const at = new Date().toISOString();
    const art: Paint = { state: wait ? "waiting-consent" : "pending", at };
    const claimed = await updateIfChanged(deps.store, unitTarget(runId, li), normalizeUnit, (current) =>
      current.id && current.bible && !current.figurine ? { ...current, figurine: art } : undefined,
    );
    if (!claimed?.changed || wait) return claimed?.value ?? null;
    handed = true;
    void paintFigurine(deps, runId, li, at, connectionId, { debugMode, consent: false })
      .catch((error: unknown) =>
        deps.runtime.logger.warn(
          "[otome-forge] painting the figurine of %s stopped: %s",
          li,
          error instanceof Error ? error.message : String(error),
        ),
      )
      .finally(release);
    return claimed.value;
  } finally {
    if (!handed) release();
  }
}

/**
 * POST /runs/:run/shop/figurines/:li/art: the tap that paints a bought figurine now (Ask's consent, a reviewed prompt,
 * or Retry). Waits for the paint and resolves the record as left; a ready one is returned as it is, and a tap while it
 * paints waits for that paint, so no tap pays twice. 503 `no-connection` without an image connection.
 */
export async function paintFigurineNow(
  deps: FigurineDeps,
  runId: string,
  li: LiId,
  { debugMode, edited }: { debugMode: boolean; edited?: Partial<ImagePrompt> },
): Promise<Paint | null> {
  const shown = async () => figurinePicture(runId, await readBought(deps, runId, li)).art;
  return tapPaint(
    runId,
    async () => figurineOwner(li),
    async () => {
      const art = await shown();
      return { value: art, art: art ?? undefined };
    },
    async () => {
      const unit = await readBought(deps, runId, li);
      if (unit.figurine?.state === "ready") {
        await queueFigurineCutouts(deps, runId, [unit]);
        return unit.figurine;
      }
      const world = await deps.store.readDoc(worldId(runId), normalizeWorld);
      if (!world) throw notFound("Otome Forge run");
      const connectionId = world.images.connectionId;
      if (!connectionId) throw new OtomeForgeError(503, "This world has no image connection.", "no-connection");
      const at = new Date().toISOString();
      const pending: Paint = { state: "pending", at };
      const claimed = await updateIfChanged(deps.store, unitTarget(runId, li), normalizeUnit, (current) =>
        current.figurine?.state === "ready" ? undefined : { ...current, figurine: pending },
      );
      if (!claimed) throw notFound("love interest");
      if (claimed.changed) await paintFigurine(deps, runId, li, at, connectionId, { debugMode, consent: true, edited });
      return shown();
    },
  );
}
