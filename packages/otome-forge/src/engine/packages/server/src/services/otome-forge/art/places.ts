// ──────────────────────────────────────────────
// Otome Forge: painted places (plan M2b "Places"). Each place a beat is set in is painted once, into world.places
// ──────────────────────────────────────────────
// A place is recorded the first time a written beat names it, under placeKey(name), with the beat's English tags. With
// an image connection it is painted then, in the background, unless Ask before painting is on (or the player reviews
// image prompts): then it waits for the tap (`waiting-consent`). A place with no tags is never painted; it takes the
// tags of a later beat that describes it. Only a tap paints a failed or stopped place again, and
// a ready one is never repainted. Without an image connection the place is kept with no art, and the reader shows its
// gradient. Painting goes through paintRecord (art/paint.ts): one paid image at a time per connection, the record
// re-checked right before the call, and the image saved only onto the record that asked for it.
import type { Paint, PlaceArt, World } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { placeKey } from "../../../../../client/src/features/otome-forge/shared/places.js";
import { runForeground } from "../generation.js";
import { OtomeForgeError } from "../http.js";
import { runDocTarget, worldId } from "../ids.js";
import { PLACES_MAX, normalizeWorld } from "../schemas/world.js";
import { worldStyle } from "./image-client.js";
import { SCENE_SIZE, placePrompt, type ImagePrompt } from "./prompts.js";
import {
  imagesOf,
  paintRecord,
  paintView,
  startPaint,
  tapPaint,
  updateIfChanged,
  type ArtDeps,
  type PaintCheck,
  type PaintOwner,
} from "./paint.js";

const NAME_MAX = 120;
const TAGS_MAX = 600;

export { placeKey };

const ownerOf = (key: string): PaintOwner => `place:${key}`;
const worldTarget = (runId: string) => runDocTarget("world", worldId(runId));
const notFound = () => new OtomeForgeError(404, "No such place in this story.", "not-found");
/** A tap holds to the rule automatic paints keep: a place with no tags is never painted. */
const untagged = () => new OtomeForgeError(409, "This place has no description to paint yet.", "conflict");

/** The place as the client should see it: a pending paint this process is not painting reads as stopped. */
export function placeView(runId: string, key: string, place: PlaceArt): PlaceArt {
  const art = paintView(runId, ownerOf(key), place.art);
  return art ? { ...place, art } : place;
}

/** The world as the client should see it (S/schemas/world.ts toWorldView takes it): every place through placeView. */
export function withPlaceViews<T extends Pick<World, "places">>(runId: string, world: T): T {
  const places = Object.fromEntries(
    Object.entries(world.places).map(([key, place]) => [key, placeView(runId, key, place)]),
  );
  return { ...world, places };
}

/** The world's place for `name` as the client should see it, or null. */
export function readPlace(world: Pick<World, "places">, runId: string, name: string): PlaceArt | null {
  const key = placeKey(name);
  const place = world.places[key];
  return place ? placeView(runId, key, place) : null;
}

export interface PaintOptions {
  debugMode: boolean;
  /** The player is reviewing image prompts: an automatic paint waits for the tap, as with Ask before painting. */
  review?: boolean;
  /** False once the art service is torn down (S/art/expressions.ts createOtomeArt). */
  active?: () => boolean;
  /** Await only saved registration; paid images continue outside the run's foreground queue. */
  registrationOnly?: boolean;
}

/** What an automatic paint does with a place's record: paint it, leave it waiting for the tap, or leave it be. */
function automatic(art: Paint | undefined, wait: boolean): "paint" | "wait" | "keep" {
  // Ready is never repainted; failed, stopped and a pending one left by a restart wait for a tap.
  if (art && art.state !== "waiting-consent") return "keep";
  return wait ? (art ? "keep" : "wait") : "paint";
}

/**
 * Records the beat's places and paints each new one in the background (or leaves it waiting for the tap). Never
 * throws: a failure is logged. Resolves once every paint it started has ended (tests wait on it).
 */
export async function paintBeatPlaces(
  deps: ArtDeps,
  runId: string,
  places: ReadonlyArray<{ name: string; tags: string }>,
  options: PaintOptions,
): Promise<void> {
  const wanted = new Map<string, { name: string; tags: string }>();
  for (const place of places) {
    const name = place.name.trim().slice(0, NAME_MAX);
    if (name && !wanted.has(placeKey(name))) wanted.set(placeKey(name), { name, tags: place.tags.slice(0, TAGS_MAX) });
  }
  if (!wanted.size) return;
  /** A place's record after this beat, and what an automatic paint does with it (`mine`: this pass holds its paint). */
  const step = (current: World, key: string, place: { name: string; tags: string }, mine: boolean) => {
    const existing = current.places[key];
    // A place first named with no description (the planned one the narrator did not list) takes the tags a later beat
    // gives it, until it is painted; with none it is never painted (an image of nothing in particular).
    const retag = !!existing && !existing.tags.trim() && !!place.tags.trim() && existing.art?.state !== "ready";
    const record: PlaceArt = existing ? (retag ? { ...existing, tags: place.tags } : existing) : place;
    const action =
      mine && current.images.connectionId && record.tags.trim()
        ? automatic(record.art, current.images.ask || options.review === true)
        : "keep";
    return { existing, retag, record, action };
  };
  // Only the places this pass paints or leaves waiting are claimed: a tap on any other (a failed place's Retry) goes
  // ahead at once. One another request is painting right now is only recorded here.
  const releases = new Map<string, () => void>();
  const at = new Date().toISOString();
  /** The places with their new records, and the keys this call paints; null when nothing changes. */
  const plan = (current: World) => {
    const next = { ...current.places };
    const paints: string[] = [];
    let changed = false;
    for (const [key, place] of wanted) {
      if (!next[key] && Object.keys(next).length >= PLACES_MAX) continue;
      const { existing, retag, record, action } = step(current, key, place, releases.has(key));
      if (action === "paint") paints.push(key);
      if (action === "keep" && existing && !retag) continue;
      changed = true;
      next[key] =
        action === "keep"
          ? record
          : { ...record, art: { state: action === "wait" ? "waiting-consent" : "pending", at } };
    }
    return changed ? { places: next, paints } : null;
  };
  let claimed: string[] = [];
  let connectionId = "";
  try {
    if (options.registrationOnly) {
      const world = await deps.store.readDoc(worldId(runId), normalizeWorld);
      if (
        world &&
        [...wanted].every(([key, place]) => {
          const { existing, retag, action } = step(world, key, place, true);
          return !!existing && !retag && action === "keep";
        })
      )
        return;
    }
    // The writer starts this without awaiting it inside its run queue. A served beat can then await registration
    // outside that queue, including an earlier pass, without waiting for either pass's paid image.
    await runForeground(runId, async () => {
      // Most beats revisit known places: then nothing is written.
      const world = await deps.store.readDoc(worldId(runId), normalizeWorld);
      for (const [key, place] of wanted) {
        if (!world || step(world, key, place, true).action === "keep") continue;
        const release = startPaint(runId, ownerOf(key));
        if (release) releases.set(key, release);
      }
      if (world && plan(world)) {
        const result = await updateIfChanged(deps.store, worldTarget(runId), normalizeWorld, (current) => {
          const planned = plan(current);
          claimed = planned?.paints ?? [];
          return planned ? { ...current, places: planned.places } : undefined;
        });
        connectionId = result?.value.images.connectionId ?? "";
        if (!result?.changed || !connectionId) claimed = [];
      }
    });
  } catch (error) {
    claimed = [];
    deps.runtime.logger.warn(
      "[otome-forge] places not recorded: %s",
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    for (const [key, release] of releases) if (!claimed.includes(key)) release();
  }
  const painting = Promise.all(
    claimed.map((key) =>
      paintPlace(deps, runId, key, at, connectionId, { ...options, consent: false })
        .catch((error: unknown) =>
          deps.runtime.logger.warn(
            "[otome-forge] painting place %s stopped: %s",
            key,
            error instanceof Error ? error.message : String(error),
          ),
        )
        .finally(() => releases.get(key)?.()),
    ),
  );
  if (!options.registrationOnly) await painting;
}

/** The prompt a place's paint sends (the review dialog shows it), with `edited` text kept and made safe. */
export async function placePromptFor(
  deps: ArtDeps,
  runId: string,
  name: string,
  edited: Partial<ImagePrompt> = {},
): Promise<ImagePrompt> {
  const world = await deps.store.readDoc(worldId(runId), normalizeWorld);
  if (!world) throw new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
  const place = world.places[placeKey(name)];
  if (!place) throw notFound();
  const style = await worldStyle(imagesOf(deps), world.images);
  return placePrompt({ name: place.name, tags: place.tags, world, style }, edited);
}

/** Paints a place the caller has marked pending at `at`; resolves its record as left. */
async function paintPlace(
  deps: ArtDeps,
  runId: string,
  key: string,
  at: string,
  connectionId: string,
  options: PaintOptions & { consent: boolean; edited?: Partial<ImagePrompt> },
): Promise<Paint | null> {
  const ours = (world: World | null) => {
    const art = world?.places[key]?.art;
    return art?.state === "pending" && art.at === at;
  };
  const images = imagesOf(deps);
  /** The world as `check` read it, right before the paid call: the prompt is built from it. */
  let latest: World | null = null;
  return paintRecord(deps, {
    connectionId,
    label: `place ${key}`,
    active: options.active,
    async check(): Promise<PaintCheck> {
      latest = await deps.store.readDoc(worldId(runId), normalizeWorld);
      if (!latest || !ours(latest)) return "gone";
      if (latest.images.connectionId !== connectionId) return "stopped";
      // An automatic paint waits for the tap once Ask before painting is turned on.
      if (!options.consent && latest.images.ask) return "waiting-consent";
      return "paint";
    },
    async paint() {
      // Built now, so the rating and the 18+ gate are the ones in force at the paid call.
      const world = latest!;
      const place = world.places[key]!;
      const style = await worldStyle(images, world.images);
      const { prompt, negativePrompt } = placePrompt(
        { name: place.name, tags: place.tags, world, style },
        options.edited,
      );
      const image = await images.generateImage({
        connectionId,
        name: place.name,
        prompt,
        negativePrompt,
        ...SCENE_SIZE,
        debugMode: options.debugMode,
      });
      return images.uploadToGallery({ image, name: place.name, prompt });
    },
    async save(art) {
      const result = await updateIfChanged(deps.store, worldTarget(runId), normalizeWorld, (current) =>
        ours(current)
          ? { ...current, places: { ...current.places, [key]: { ...current.places[key]!, art } } }
          : undefined,
      );
      return !!result?.changed;
    },
  });
}

/**
 * POST /runs/:run/art/place: the tap that paints a place now (its consent, or Retry). Waits for the paint and resolves
 * the place as left; a ready place is returned as it is, and a tap while it is painting waits for that same paint.
 */
export async function paintPlaceNow(
  deps: ArtDeps,
  runId: string,
  name: string,
  { debugMode, edited, active }: { debugMode: boolean; edited?: Partial<ImagePrompt>; active?: () => boolean },
): Promise<PlaceArt> {
  const key = placeKey(name);
  const read = async () => {
    const world = await deps.store.readDoc(worldId(runId), normalizeWorld);
    const place = world?.places[key];
    if (!place) throw notFound();
    return placeView(runId, key, place);
  };
  return tapPaint(
    runId,
    async () => ownerOf(key),
    async () => {
      const place = await read();
      return { value: place, art: place.art };
    },
    async () => {
      const world = await deps.store.readDoc(worldId(runId), normalizeWorld);
      if (!world) throw new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
      if (!world.places[key]) throw notFound();
      if (world.places[key].art?.state === "ready") return read();
      if (!world.places[key].tags.trim()) throw untagged();
      const connectionId = world.images.connectionId;
      if (!connectionId) throw new OtomeForgeError(503, "This world has no image connection.", "no-connection");
      const at = new Date().toISOString();
      const pending: Paint = { state: "pending", at };
      const claim = await updateIfChanged(deps.store, worldTarget(runId), normalizeWorld, (current) => {
        const place = current.places[key];
        if (!place) throw notFound();
        if (!place.tags.trim()) throw untagged();
        return place.art?.state !== "ready" && current.images.connectionId === connectionId
          ? { ...current, places: { ...current.places, [key]: { ...place, art: pending } } }
          : undefined;
      });
      if (!claim) throw new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
      if (claim.changed)
        await paintPlace(deps, runId, key, at, connectionId, { debugMode, consent: true, edited, active });
      return read();
    },
  );
}
