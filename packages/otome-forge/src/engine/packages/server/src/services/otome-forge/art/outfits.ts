// ──────────────────────────────────────────────
// Otome Forge: the art of items won on Wish (plan M4 "First open", §1.8): a Memory's CG, every look, and a couple set's
// pair portrait
// ──────────────────────────────────────────────
// An item's art is painted once, on its first open (S/items/open.ts), and only under the player's image settings: with
// an image connection; waiting for the tap while Ask before painting is on or the player reviews image prompts (the
// Engine's reviewImagePromptsBeforeSend); with the world's image rating and an adult tag for every person (the rating
// itself is held to the 18+ gate where it is set). Its record is `item.art`, with GF's rules for paid work
// (art/paint.ts): claimed `pending` (or `waiting-consent`) in one revision-checked write of the item, so concurrent
// opens paint once; checked again right before the paid call; saved only onto the record that asked; a failure is
// kept and repainted only on a tap; a `pending` record with no live paint in this process reads as `stopped`.
// - memory5: the CG from the item's English brief (P20), with each person in it as a reference (the protagonist's
//   persona avatar when she is in it; art/cg.ts cgSubjects), 768×1344, through generateBannerArt.
// - his-look5, his-look4: his new look (generateOutfit, 832×1216 full body on grey), keeping his card or portrait as
//   the likeness reference. her-look5, her-look4: the protagonist's.
// A look's image, once ready, is added to its wearer's `outfits` (the kit's outfit shape), which is what makes it
// wearable; his faces for it are painted when he wears it (S/routes/wardrobe.ts, through M2b's expressions).
// Home cuts out his worn look and its ready faces lazily, on the next Home read (S/art/cutout.ts queueCutouts, plan M3
// "Cut-outs"), so a new look needs no cut-out call here.
// A banner's featured 5★ and the banner share one picture (S/wish/banners.ts): an open while the banner's art paints
// waits for it rather than paying again, and whichever of the two is painted first becomes the other's art too, in
// the same paint slot, so the other's paint queued behind it finds its record replaced and pays for nothing.
// A couple set's pair portrait is painted only by its tap ("Paint a pair portrait (1 image)"): both looks, both people,
// one paid image. It is kept in the Album (`state.album.cgs`, key `pair:<her look's id>`), so the state holds it once.
import type {
  AlbumCg,
  Outfit,
  Paint,
  Player,
  Unit,
  World,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { isLookKind, itemIdOf, type Item } from "../../../../../client/src/features/otome-forge/shared/wish.js";
import { OtomeForgeError } from "../http.js";
import { bannerId, itemId, playerId, runDocTarget, stateId, unitId, worldId } from "../ids.js";
import { normalizePlayer } from "../schemas/player.js";
import { STATE_LIMITS, keepNewest, normalizeState, readRun } from "../schemas/state.js";
import { normalizeUnit } from "../schemas/unit.js";
import { normalizeBanner, normalizeItem } from "../schemas/wish.js";
import { normalizeWorld } from "../schemas/world.js";
import type { OtomeArt } from "./expressions.js";
import { cgSubjects } from "./cg.js";
import { galleryRef, type ImageSubject, type PaintedImage } from "./image-client.js";
import {
  imagesOf,
  paintIsLive,
  paintRecord,
  paintSettled,
  paintSlot,
  paintView,
  readSubject,
  startPaint,
  tapPaint,
  updateIfChanged,
  type ArtDeps,
  type PaintCheck,
  type PaintOwner,
} from "./paint.js";
import { LOOK_SIZE, SCENE_SIZE, cgPrompt, lookPrompt, type CgPerson, type ImagePrompt } from "./prompts.js";

export interface ItemArtDeps extends ArtDeps {
  /** The activation's art service: once torn down, nothing more is paid for. */
  art?: Pick<OtomeArt, "active">;
}

export interface ItemPaintOptions {
  debugMode: boolean;
  /** The player reviews image prompts first: the first open's paint waits for the tap, as with Ask before painting. */
  review?: boolean;
}

const ERROR_MAX = 300;

const notFound = (what: string) => new OtomeForgeError(404, `No such ${what}.`, "not-found");
const noConnection = () => new OtomeForgeError(503, "This world has no image connection.", "no-connection");
const itemTarget = (runId: string, id: string) => runDocTarget("item", itemId(runId, id));
/** The live-paint owner of an item's art. */
export const itemArtOwner = (id: string): PaintOwner => `item:${id}`;
const pairOwner = (hers: string): PaintOwner => `item:${hers}/pair`;
/** The Album's key for a couple set's pair portrait. */
export const pairKey = (hers: string) => `pair:${hers}`;
const activeOf = (deps: ItemArtDeps) => () => !deps.art || deps.art.active();
/** The live-paint owner of a banner's art; banner art is a scene paint like a story CG. */
export const bannerArtOwner = (key: string): PaintOwner => `cg:banner/${key}`;
/** True for its banner's featured 5★, whose picture is also the banner's art. */
const isFeatured = (item: Pick<Item, "id" | "banner">) => item.id === itemIdOf(item.banner, "f");
const bannerPaints = (runId: string, item: Pick<Item, "id" | "banner">) =>
  isFeatured(item) && paintIsLive(runId, bannerArtOwner(item.banner));

/** True for an item that has art: a Memory with its brief, or a look. Moments and Snapshots are text. */
export const hasArt = (item: Pick<Item, "kind" | "cg" | "look">) =>
  (item.kind === "memory5" && !!item.cg?.brief.trim()) || (isLookKind(item.kind) && !!item.look);

/** Whose look an item is: the protagonist (her-look*) or the love interest who wears it (his-look*). */
export const lookWearer = (item: Pick<Item, "kind" | "li">): "player" | `li:${string}` | null =>
  item.kind.startsWith("her-") ? "player" : item.kind.startsWith("his-") && item.li ? `li:${item.li}` : null;

/**
 * The item's art as the client should see it: a pending paint this process is not painting reads as stopped, and a
 * featured 5★ with none reads as pending while its banner's art (the same picture) paints.
 */
export function itemArtView(runId: string, item: Pick<Item, "id" | "art" | "banner">): Paint | null {
  const art = paintView(runId, itemArtOwner(item.id), item.art ?? undefined) ?? null;
  return !art && bannerPaints(runId, item) ? { state: "pending", at: new Date().toISOString() } : art;
}

/**
 * A featured 5★'s painted picture becomes its banner's art too, so the banner never pays for it again. Never throws:
 * the item's own art is saved already, and its image must stay.
 */
async function shareWithBanner(deps: Pick<ArtDeps, "store" | "runtime">, runId: string, item: Item): Promise<void> {
  const art = item.art;
  if (!isFeatured(item) || art?.state !== "ready") return;
  try {
    await updateIfChanged(
      deps.store,
      runDocTarget("banner", bannerId(runId, item.banner)),
      normalizeBanner,
      (banner) => (banner.key === item.banner && banner.art?.state !== "ready" ? { ...banner, art } : undefined),
    );
  } catch (error) {
    deps.runtime.logger.warn(
      "[otome-forge] sharing item %s's art with its banner failed: %s",
      item.id,
      error instanceof Error ? error.message : String(error),
    );
  }
}

/** A painted look in the kit's outfit shape; null until its art is ready. */
export function outfitOf(item: Item): Outfit | null {
  const art = item.art;
  if (!isLookKind(item.kind) || !item.look || art?.state !== "ready" || !art.url) return null;
  return {
    id: item.id,
    name: item.look.name,
    outfitLine: item.look.outfitLine,
    url: art.url,
    ...(art.ref ? { ref: art.ref } : {}),
    at: art.at,
  };
}

/**
 * Adds a painted look to its wearer's `outfits` once (the wardrobe can wear it from then on). Resolves the wearer's
 * document as saved or as it stands, or null when the look is not painted or the run is gone.
 */
export async function addOutfit(
  deps: Pick<ArtDeps, "store">,
  runId: string,
  item: Item,
): Promise<Unit | Player | null> {
  const outfit = outfitOf(item);
  const wearer = lookWearer(item);
  if (!outfit || !wearer) return null;
  const add = <T extends { outfits: Outfit[] }>(current: T) =>
    current.outfits.some((entry) => entry.id === outfit.id)
      ? undefined
      : { ...current, outfits: [...current.outfits, outfit] };
  const saved =
    wearer === "player"
      ? await updateIfChanged(deps.store, runDocTarget("player", playerId(runId)), normalizePlayer, add)
      : await updateIfChanged(deps.store, runDocTarget("unit", unitId(runId, wearer.slice(3))), normalizeUnit, add);
  return saved?.value ?? null;
}

// ── Prompts ──

interface BuiltArt extends ImagePrompt {
  world: World;
  /** Paints the image with the built prompt (one paid call, uploaded to the gallery). */
  paint(connectionId: string, debugMode: boolean): Promise<PaintedImage>;
}

/** The prompt and the paid call for the item's art, built from the documents as they are now. */
async function buildItemArt(
  deps: ArtDeps,
  runId: string,
  item: Item,
  edited: Partial<ImagePrompt>,
  debugMode: boolean,
): Promise<BuiltArt> {
  if (!hasArt(item)) throw notFound("art for this item");
  const run = await readRun(deps.store, runId);
  if (!run) throw notFound("Otome Forge run");
  const images = imagesOf(deps);
  const style = await images.styleProfile(run.world.images.styleProfileId);
  if (item.kind === "memory5") {
    const subjects = cgSubjects(item.cg!.cast, run.units, run.player);
    // Memory art is painted before its Character Story exists, so it stays clothed (at most Suggestive).
    const prompt = cgPrompt(
      {
        brief: item.cg!.brief,
        people: subjects.map((subject) => subject.person),
        world: run.world,
        style,
        use: "clothed",
      },
      edited,
    );
    return {
      ...prompt,
      world: run.world,
      paint: (connectionId, debug) =>
        images.generateBannerArt({
          connectionId,
          // The Engine matches the override as `avatar:<slug of the first person's first name>`.
          name: subjects[0]?.person.name.split(/\s+/)[0] || "Memory",
          units: subjects.flatMap((subject) => (subject.image ? [subject.image] : [])),
          prompt: prompt.prompt,
          negativePrompt: prompt.negativePrompt,
          ...SCENE_SIZE,
          debugMode: debug,
        }),
    };
  }
  const wearer = lookWearer(item);
  if (!wearer) throw notFound("love interest");
  const subject = await readSubject(deps, runId, run.world, wearer, debugMode);
  const prompt = lookPrompt({ ...subject, outfitLine: item.look!.outfitLine, world: run.world, style }, edited);
  return {
    ...prompt,
    world: run.world,
    paint: (connectionId, debug) =>
      images.generateOutfit({
        connectionId,
        name: subject.name,
        // The likeness, never a look he wears: the card or persona avatar, else the base portrait.
        unit: { ...subject.image, outfits: [] },
        prompt: prompt.prompt,
        negativePrompt: prompt.negativePrompt,
        ...LOOK_SIZE,
        debugMode: debug,
      }),
  };
}

/** The prompt the item's paint would send (the review dialog shows it), with `edited` text kept and made safe. */
export async function itemArtPrompt(
  deps: ArtDeps,
  runId: string,
  item: Item,
  edited: Partial<ImagePrompt> = {},
  debugMode = false,
): Promise<ImagePrompt> {
  const { prompt, negativePrompt } = await buildItemArt(deps, runId, item, edited, debugMode);
  return { prompt, negativePrompt };
}

// ── Painting ──

const readItem = (deps: Pick<ArtDeps, "store">, runId: string, id: string) =>
  deps.store.readDoc(itemId(runId, id), normalizeItem).then((item) => (item?.id ? item : null));

/** Paints the item's art, which the caller has marked pending at `at`, in the connection's lane. */
async function paintItem(
  deps: ItemArtDeps,
  runId: string,
  item: Item,
  at: string,
  connectionId: string,
  { debugMode, consent, edited }: { debugMode: boolean; consent: boolean; edited?: Partial<ImagePrompt> },
): Promise<Paint | null> {
  const save = async (art: Paint) => {
    const saved = await updateIfChanged(deps.store, itemTarget(runId, item.id), normalizeItem, (current) =>
      current.id && current.art?.state === "pending" && current.art.at === at ? { ...current, art } : undefined,
    );
    if (!saved?.changed) return false;
    // Still in the slot: the banner's own paint, queued behind this one, then finds its record replaced.
    await shareWithBanner(deps, runId, saved.value);
    return true;
  };
  const left = await paintRecord(deps, {
    connectionId,
    label: `item ${item.id}`,
    active: activeOf(deps),
    async check(): Promise<PaintCheck> {
      const [current, world, banner] = await Promise.all([
        readItem(deps, runId, item.id),
        deps.store.readDoc(worldId(runId), normalizeWorld),
        isFeatured(item) ? deps.store.readDoc(bannerId(runId, item.banner), normalizeBanner) : null,
      ]);
      if (!current || !world || current.art?.state !== "pending" || current.art.at !== at) return "gone";
      // Its banner's art (the same picture) is painted: it is this item's art too, and nothing more is paid for.
      if (banner?.key === item.banner && banner.art?.state === "ready") {
        await save(banner.art);
        return "gone";
      }
      if (world.images.connectionId !== connectionId) return "stopped";
      if (!consent && world.images.ask) return "waiting-consent";
      return "paint";
    },
    // Built now, so the rating and everyone's looks are the ones in force at the paid call.
    paint: async () => (await buildItemArt(deps, runId, item, edited ?? {}, debugMode)).paint(connectionId, debugMode),
    save,
  });
  const saved = await readItem(deps, runId, item.id);
  if (saved?.art?.state === "ready") await addOutfit(deps, runId, saved);
  return left;
}

/**
 * The first open's paint: claims the item's art once (`pending`, or `waiting-consent` under Ask before painting or
 * prompt review) and paints it in the background. Without an image connection nothing is claimed: a later open with
 * one paints it then. Resolves the record as the open leaves it; never waits for the paint.
 */
export async function queueItemArt(
  deps: ItemArtDeps,
  runId: string,
  item: Item,
  { debugMode, review }: ItemPaintOptions,
): Promise<Paint | null> {
  // A featured 5★ whose banner's art is painting now waits for that picture (it becomes this item's art).
  if (!hasArt(item) || item.art || bannerPaints(runId, item)) return itemArtView(runId, item);
  const world = await deps.store.readDoc(worldId(runId), normalizeWorld);
  if (!world) throw notFound("Otome Forge run");
  const connectionId = world.images.connectionId;
  if (!connectionId || !activeOf(deps)()) return null;
  const owner = itemArtOwner(item.id);
  const release = startPaint(runId, owner);
  // Another paint of it is live in this process: the open shows that one.
  if (!release) return itemArtView(runId, (await readItem(deps, runId, item.id)) ?? item);
  let handed = false;
  try {
    const wait = world.images.ask || review === true;
    const at = new Date().toISOString();
    const art: Paint = { state: wait ? "waiting-consent" : "pending", at };
    const claimed = await updateIfChanged(deps.store, itemTarget(runId, item.id), normalizeItem, (current) =>
      current.id && !current.art ? { ...current, art } : undefined,
    );
    if (!claimed) throw notFound("item");
    if (!claimed.changed || wait) return itemArtView(runId, claimed.value);
    handed = true;
    void paintItem(deps, runId, claimed.value, at, connectionId, { debugMode, consent: false })
      .catch((error: unknown) =>
        deps.runtime.logger.warn(
          "[otome-forge] painting item %s stopped: %s",
          item.id,
          error instanceof Error ? error.message : String(error),
        ),
      )
      .finally(release);
    return claimed.value.art;
  } finally {
    if (!handed) release();
  }
}

/**
 * POST /runs/:run/items/:item/art: the tap that paints an owned item's art now (Ask's consent, a reviewed prompt, or
 * Retry). Waits for the paint and resolves the record as left; a ready one is returned as it is, and a tap while it
 * paints waits for that paint, so no tap pays twice.
 */
export async function paintItemNow(
  deps: ItemArtDeps,
  runId: string,
  id: string,
  { debugMode, edited }: { debugMode: boolean; edited?: Partial<ImagePrompt> },
): Promise<Paint | null> {
  const read = async () => {
    const item = await readItem(deps, runId, id);
    if (!item) throw notFound("item");
    if (!hasArt(item)) throw notFound("art for this item");
    return item;
  };
  // The banner's art is the same picture: a tap while it paints waits for it, and pays only if it did not land.
  const first = await read();
  if (isFeatured(first)) await paintSettled(runId, bannerArtOwner(first.banner));
  return tapPaint(
    runId,
    async () => itemArtOwner(id),
    async () => {
      const art = itemArtView(runId, await read());
      return { value: art, art: art ?? undefined };
    },
    async () => {
      const item = await read();
      if (item.art?.state === "ready") {
        await addOutfit(deps, runId, item);
        return item.art;
      }
      const world = await deps.store.readDoc(worldId(runId), normalizeWorld);
      if (!world) throw notFound("Otome Forge run");
      const connectionId = world.images.connectionId;
      if (!connectionId) throw noConnection();
      const at = new Date().toISOString();
      const pending: Paint = { state: "pending", at };
      const claimed = await updateIfChanged(deps.store, itemTarget(runId, id), normalizeItem, (current) =>
        current.art?.state === "ready" ? undefined : { ...current, art: pending },
      );
      if (!claimed) throw notFound("item");
      if (claimed.changed)
        await paintItem(deps, runId, claimed.value, at, connectionId, { debugMode, consent: true, edited });
      return itemArtView(runId, await read());
    },
  );
}

// ── A couple set's pair portrait ──

/** The last failed pair portrait per `${runId}|${hers}`, for the taps that waited on it (never stored). */
const pairFailures = new Map<string, Paint>();

/** The pair portrait of the set whose her-look is `hers`: ready once kept in the Album, pending while it paints. */
export function pairView(runId: string, cgs: readonly AlbumCg[], hers: string): Paint | null {
  const kept = cgs.find((entry) => entry.key === pairKey(hers));
  if (kept) return { state: "ready", at: kept.at, url: kept.url, ref: kept.ref };
  return paintIsLive(runId, pairOwner(hers)) ? { state: "pending", at: new Date().toISOString() } : null;
}

/** The couple set of `hers`: both items, owned and painted, or the reason the pair cannot be painted. */
async function readPair(deps: ArtDeps, runId: string, hers: string) {
  const run = await readRun(deps.store, runId);
  if (!run) throw notFound("Otome Forge run");
  const her = await readItem(deps, runId, hers);
  if (!her || her.kind !== "her-look5" || !her.coupleWith) throw notFound("couple set");
  const his = await readItem(deps, runId, her.coupleWith);
  if (!his) throw notFound("couple set");
  const owned = new Set(run.state.owned.items);
  if (!owned.has(her.id) || !owned.has(his.id)) {
    throw new OtomeForgeError(409, "Both looks of the couple set are needed first.", "locked");
  }
  const herOutfit = outfitOf(her);
  const hisOutfit = outfitOf(his);
  if (!herOutfit || !hisOutfit) throw new OtomeForgeError(409, "Both looks need painting first.", "conflict");
  const unit = run.units.find((candidate) => candidate.id === his.li);
  if (!unit) throw notFound("love interest");
  return { run, her, his, unit, herOutfit, hisOutfit };
}

/** The pair portrait's prompt and the paid call, from both painted looks (each look is its wearer's reference). */
async function buildPair(deps: ArtDeps, runId: string, hers: string, edited: Partial<ImagePrompt>) {
  const pair = await readPair(deps, runId, hers);
  const { run, unit, herOutfit, hisOutfit } = pair;
  const style = await imagesOf(deps).styleProfile(run.world.images.styleProfileId);
  const first = (name: string, fallback: string) => name.trim().split(/\s+/)[0] || fallback;
  const people: CgPerson[] = [
    {
      name: unit.name,
      identityLine: unit.identityLine || unit.bible?.look.identityLine || "",
      outfitLine: hisOutfit.outfitLine,
      presentation: unit.bible?.look.presentation ?? "person",
    },
    {
      name: run.player.name || "Protagonist",
      identityLine: run.player.look.identityLine,
      outfitLine: herOutfit.outfitLine,
      presentation: "person",
    },
  ];
  const brief = `A couple portrait of ${first(unit.name, "them")} and ${first(run.player.name, "the protagonist")} together, side by side and in full view, sharing a quiet moment, soft romantic light.`;
  const prompt = cgPrompt({ brief, people, world: run.world, style, use: "clothed" }, edited);
  // Each painted look is the reference, so the likeness and the clothes both carry over.
  const units: ImageSubject[] = [
    { kind: "character", portrait: hisOutfit.url },
    { kind: "character", portrait: herOutfit.url },
  ];
  return { ...pair, ...prompt, units, name: first(unit.name, "Couple") };
}

export async function pairPrompt(
  deps: ArtDeps,
  runId: string,
  hers: string,
  edited: Partial<ImagePrompt> = {},
): Promise<ImagePrompt> {
  const { prompt, negativePrompt } = await buildPair(deps, runId, hers, edited);
  return { prompt, negativePrompt };
}

/**
 * POST /runs/:run/wardrobe/pair: the tap that paints the set's pair portrait (one image). Waits for it; a set that has
 * one answers with it, and a second tap while it paints waits for that paint. A failure is answered, never kept: the
 * offer stays, and its next tap tries again.
 */
export async function paintPairNow(
  deps: ItemArtDeps,
  runId: string,
  hers: string,
  { debugMode, edited = {} }: { debugMode: boolean; edited?: Partial<ImagePrompt> },
): Promise<Paint> {
  const key = `${runId}|${hers}`;
  const asked = new Date().toISOString();
  const kept = async () =>
    pairView(runId, (await deps.store.readDoc(stateId(runId), normalizeState))?.album.cgs ?? [], hers);
  const art = await tapPaint(
    runId,
    async () => pairOwner(hers),
    async () => {
      // A tap that waited on a paint that failed answers with that failure, so a double tap never pays twice.
      const failure = pairFailures.get(key);
      const left = (await kept()) ?? (failure && failure.at >= asked ? failure : undefined);
      return { value: left ?? null, art: left };
    },
    async (): Promise<Paint | null> => {
      const already = await kept();
      if (already?.state === "ready") return already;
      // Refused before it waits in the lane: no set, a half not owned or not painted, no connection.
      const connectionId = (await readPair(deps, runId, hers)).run.world.images.connectionId;
      if (!connectionId) throw noConnection();
      const images = imagesOf(deps);
      let painted: { image: PaintedImage; built: Awaited<ReturnType<typeof buildPair>> };
      try {
        painted = await paintSlot(connectionId, async () => {
          if (!activeOf(deps)()) throw new Error("Otome Forge stopped before painting");
          // Built now, so the run, both looks, the rating (and its 18+ gate) and the connection are the ones in force
          // at the paid call, however long it waited behind other paints.
          const built = await buildPair(deps, runId, hers, edited);
          if (built.run.world.images.connectionId !== connectionId) {
            throw new OtomeForgeError(409, "The image connection changed before painting; try again.", "conflict");
          }
          const image = await images.generateBannerArt({
            connectionId,
            name: built.name,
            units: built.units,
            prompt: built.prompt,
            negativePrompt: built.negativePrompt,
            ...SCENE_SIZE,
            debugMode,
          });
          return { image, built };
        });
      } catch (error) {
        // A refusal (the run, a look or the connection gone meanwhile) is answered as it is; nothing was paid for.
        if (error instanceof OtomeForgeError) throw error;
        const message = (error instanceof Error ? error.message : String(error)).slice(0, ERROR_MAX);
        deps.runtime.logger.warn("[otome-forge] painting the pair portrait %s failed: %s", hers, message);
        const failed: Paint = { state: "failed", at: new Date().toISOString(), error: message };
        pairFailures.set(key, failed);
        return failed;
      }
      pairFailures.delete(key);
      const { image, built } = painted;
      const entry: AlbumCg = {
        key: pairKey(hers),
        url: image.url,
        ref: image.id ? galleryRef(image.id) : "",
        at: new Date().toISOString(),
        ...(built.his.li ? { li: built.his.li } : {}),
      };
      let saved = false;
      try {
        const result = await updateIfChanged(
          deps.store,
          runDocTarget("state", stateId(runId)),
          normalizeState,
          (current) =>
            current.album.cgs.some((item) => item.key === entry.key)
              ? undefined
              : {
                  ...current,
                  album: { ...current.album, cgs: keepNewest([...current.album.cgs, entry], STATE_LIMITS.album) },
                },
        );
        saved = !!result?.changed;
      } finally {
        // Kept already (another process) or the run was deleted: nothing refers to this image.
        if (!saved && image.id) await images.deleteGalleryImage(image.id);
      }
      return (await kept()) ?? { state: "ready", at: entry.at, url: entry.url, ref: entry.ref };
    },
  );
  return art ?? { state: "failed", at: new Date().toISOString(), error: "The pair portrait was not painted." };
}
