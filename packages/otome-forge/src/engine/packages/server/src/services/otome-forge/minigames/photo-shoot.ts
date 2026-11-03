// ──────────────────────────────────────────────
// Otome Hearth: the Photo Shoot (#2087; design: Dates). The two of them pose for one photo, picked by the player.
// ──────────────────────────────────────────────
// With a love interest picked in Dates, the player chooses a place the story painted (world.places with ready art),
// what each of them wears (their everyday look or a look they own and painted, never worn by this), and an expression
// and a pose for each of them: a preset id (SH/photos.ts) or their own words. A shared pose is one pick for both
// (posesAgree), so a photo never has one kissing and the other waving. Take picture paints exactly one image and
// nothing else: no model call anywhere (the player picks his expression and pose too), no Starlight, no affection, no
// grant, no recall, memory or Love Timeline entry.
// - A photo is `${R}:photo:<id>`, kind "photo" (one of RUN_DOC_KINDS, so deleting the run sweeps it and its image). The
//   id is the client's (SH/photos.ts PHOTO_ID): a double tap, or a resend after a lost answer, waits for the same
//   paint and pays once (tapPaint), and a ready photo is answered as it is. Try again on a failed or stopped photo
//   resends its id and paints it again, once.
// - The record keeps only ids and names: the place's key and name, each look's id, the picks, the prompt as sent and
//   the photo's own art. Never a place's or a look's image reference, which deleting the photo would delete with it.
// - Painting follows the story's image settings: 503 `no-connection` without an image connection (checked first, on
//   the prompt route too, so nothing is saved or fetched), the image rating (photoPrompt is `clothed`, at most
//   Suggestive), and Ask before painting and prompt review, which the client applies to the tap as for a keepsake. It
//   goes through paintRecord: one paid image per connection in the high lane, the prompt built at the paid call, and a
//   result saved only onto the record still waiting for it.
// - The references are exactly the three the issue names, people first (a provider that keeps fewer still gets both
//   likenesses): his chosen look, hers, then the place's picture, each fetched as a data URL; a base look with no
//   portrait falls back to his card's or her persona's avatar, labelled as their face (it may wear something else).
//   Only the label `photo <id>` is ever logged.
// - The Album lists the ready photos (newest first) apart from `cgs`, which Home's back layer reads, and Home tapes the
//   newest with its love interest into his note. A photo can be deleted, except while it paints (409 `busy`).
import { forgeSubjectReference, type ImageIdentitySubject } from "@forge-kit/image-avatar-references.mjs";
import { z, type ZodType } from "zod";
import type { Paint, World } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import {
  PHOTO_CUSTOM,
  PHOTO_EXPRESSIONS,
  PHOTO_SHARED_POSES,
  PHOTO_SOLO_POSES,
  PHOTO_TEXT_MAX,
  posesAgree,
  type PhotoPick,
  type PhotoSetup,
  type PhotoView,
} from "../../../../../client/src/features/otome-forge/shared/photos.js";
import { BASE_LOOK, type AlbumImage } from "../../../../../client/src/features/otome-forge/shared/wardrobe.js";
import { galleryRefIds, worldStyle } from "../art/image-client.js";
import {
  imagesOf,
  paintIsLive,
  paintRecord,
  paintView,
  tapPaint,
  updateIfChanged,
  type PaintCheck,
  type PaintOwner,
} from "../art/paint.js";
import { OtomeForgeError, type RouteDeps } from "../http.js";
import { isLiId, runDocTarget, worldId } from "../ids.js";
import { STICKER_SIZE, photoPrompt, type CgPerson, type ImagePrompt, type PhotoInput } from "../prompts.js";
import { wearableLook } from "../routes/wardrobe.js";
import { PaintSchema } from "../schemas/common.js";
import { readRun } from "../schemas/state.js";
import { normalizeWorld } from "../schemas/world.js";
import { withPersonaImageAppearance } from "../setup/cast.js";
import type { OtomeStore } from "../store.js";

export type PhotoDeps = Pick<RouteDeps, "runtime" | "store" | "images" | "art">;

/** `${R}:photo:<id>`: one Photo Shoot photo. */
export const photoId = (runId: string, id: string) => `${runId}:photo:${id}`;
/** The `{id, kind, name}` a photo is saved with ("photo" is one of RUN_DOC_KINDS). */
export const photoTarget = (runId: string, id: string) => runDocTarget("photo", photoId(runId, id));
const photoOwner = (id: string): PaintOwner => `photo:${id}`;

/** A stored photo (the prompt it was sent with stays here; the client sees toPhotoView). */
export interface Photo extends Omit<PhotoSetup, "place"> {
  version: 1;
  id: string;
  /** The place's key, and its name in the world's language (the Album's caption). */
  place: { key: string; name: string };
  /** As sent at the paid call (the reviewed edit when there was one); unbounded, as the lines it is built from are. */
  prompt?: ImagePrompt;
  /** pending, ready, failed or stopped; a pending one with no live paint here reads as stopped (toPhotoView). */
  art: Paint;
  createdAt: string;
}

const TEXT = z.string().max(PHOTO_TEXT_MAX);
const PickSchema: ZodType<PhotoPick> = z.object({
  expression: z.enum([...PHOTO_EXPRESSIONS, PHOTO_CUSTOM] as const),
  expressionText: TEXT.optional(),
  pose: z.enum([...PHOTO_SOLO_POSES, ...PHOTO_SHARED_POSES, PHOTO_CUSTOM] as const),
  poseText: TEXT.optional(),
});
const LOOK_ID = z.string().min(1).max(80);
/** The setup as a request body: ids and the player's own words, never a translated label. */
export const PhotoSetupSchema = z.object({
  li: z.string().min(1).max(80),
  place: z.string().min(1).max(200),
  hisLook: LOOK_ID,
  herLook: LOOK_ID,
  his: PickSchema,
  her: PickSchema,
});
const PhotoSchema = z.object({
  id: z.string().min(1).max(40),
  li: z.string().min(1).max(80),
  place: z.object({ key: z.string().min(1).max(200), name: z.string().max(400) }),
  hisLook: LOOK_ID,
  herLook: LOOK_ID,
  his: PickSchema,
  her: PickSchema,
  // No cap: a long Appearance or identity line makes a long prompt, and a record that no longer read would lose its paid
  // image (a resend would pay again).
  prompt: z.object({ prompt: z.string(), negativePrompt: z.string() }).optional(),
  art: PaintSchema,
  createdAt: z.string(),
});

/** A stored photo, or null for none (missing or damaged: a damaged photo is never painted or listed). */
export function normalizePhoto(data: unknown): Photo | null {
  const parsed = PhotoSchema.safeParse(data);
  return parsed.success ? { version: 1, ...parsed.data } : null;
}

/** The photo as the client sees it: a pending paint this process is not painting reads as stopped. */
export function toPhotoView(runId: string, photo: Photo): PhotoView {
  const { version: _version, prompt: _prompt, art, ...rest } = photo;
  return { ...rest, art: paintView(runId, photoOwner(photo.id), art) ?? art };
}

/** Every readable photo of the run, newest first. */
export async function listPhotos(store: Pick<OtomeStore, "listRun">, runId: string): Promise<Photo[]> {
  return (await store.listRun("photo", runId))
    .map((record) => normalizePhoto(record.data))
    .filter((photo): photo is Photo => !!photo)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** The ready photos as the Album keeps them, newest first by when each was painted. */
export function albumPhotos(photos: readonly Photo[]): AlbumImage[] {
  return photos
    .flatMap((photo): AlbumImage[] =>
      photo.art.state === "ready" && photo.art.url
        ? [
            {
              key: `photo:${photo.id}`,
              url: photo.art.url,
              ...(photo.art.ref ? { ref: photo.art.ref } : {}),
              at: photo.art.at,
              li: photo.li,
              source: "photo",
              title: photo.place.name,
            },
          ]
        : [],
    )
    .sort((a, b) => b.at.localeCompare(a.at));
}

const runNotFound = () => new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
const liNotFound = () => new OtomeForgeError(404, "No such love interest.", "not-found");
const photoNotFound = () => new OtomeForgeError(404, "No such photo.", "not-found");
const badRequest = (message: string) => new OtomeForgeError(400, message, "bad-request");
const noConnection = () => new OtomeForgeError(503, "This world has no image connection.", "no-connection");

/**
 * A pick as the record keeps it: the player's own words (required) for "custom", as typed with only the spaces tidied
 * (the client checks the same), preset text dropped.
 */
function pickOf(pick: PhotoPick): PhotoPick {
  const words = (text: string | undefined, what: string) => {
    const value = (text ?? "").replace(/\s+/gu, " ").trim();
    if (!value) throw badRequest(`Invalid request: write the ${what}, or pick one.`);
    if (value.length > PHOTO_TEXT_MAX) throw badRequest(`Invalid request: the ${what} is too long.`);
    return value;
  };
  return {
    expression: pick.expression,
    ...(pick.expression === PHOTO_CUSTOM ? { expressionText: words(pick.expressionText, "expression") } : {}),
    pose: pick.pose,
    ...(pick.pose === PHOTO_CUSTOM ? { poseText: words(pick.poseText, "pose") } : {}),
  };
}

/** One look as the photo dresses its wearer: the look's outfit line, and where its likeness comes from. */
interface PhotoLook {
  outfitLine: string;
  likeness: ImageIdentitySubject;
  /** The likeness is his card's or her persona's avatar (a base look with no portrait): who they are, not this look. */
  face?: true;
}

/**
 * The setup checked against the run, before anything is saved or paid for: an image connection first (503), then the
 * love interest (404), a painted place (400), both picks (400) and each look, read without being worn (wardrobe.ts
 * wearableLook: 409 `locked`, 400, 409 `conflict`). Writes nothing.
 */
async function resolveSetup(deps: Pick<PhotoDeps, "store">, runId: string, setup: PhotoSetup) {
  const run = await readRun(deps.store, runId);
  if (!run) throw runNotFound();
  const connectionId = run.world.images.connectionId;
  if (!connectionId) throw noConnection();
  if (!isLiId(setup.li)) throw liNotFound();
  const unit = run.units.find((candidate) => candidate.id === setup.li && candidate.bible);
  if (!unit?.bible || !run.state.lis[setup.li]) throw liNotFound();
  const place = Object.hasOwn(run.world.places, setup.place) ? run.world.places[setup.place] : undefined;
  if (!place || place.art?.state !== "ready" || !place.art.url) throw badRequest("That place isn't painted yet.");
  const his = pickOf(setup.his);
  const her = pickOf(setup.her);
  if (!posesAgree(his, her)) throw badRequest("Both of you need the shared pose.");
  const hisLook: PhotoLook =
    setup.hisLook === BASE_LOOK
      ? {
          outfitLine: unit.outfitLine || unit.bible.look.outfitLine,
          ...(unit.portrait
            ? { likeness: { portrait: unit.portrait } }
            : { likeness: unit.cardId ? { cardId: unit.cardId } : {}, face: true as const }),
        }
      : await wearableLook(deps, runId, setup.hisLook, `li:${unit.id}`).then(({ outfit }) => ({
          outfitLine: outfit.outfitLine,
          likeness: { portrait: outfit.url },
        }));
  const herLook: PhotoLook =
    setup.herLook === BASE_LOOK
      ? {
          outfitLine: run.player.look.outfitLine,
          ...(run.player.portrait
            ? { likeness: { portrait: run.player.portrait } }
            : { likeness: { personaId: run.player.personaId }, face: true as const }),
        }
      : await wearableLook(deps, runId, setup.herLook, "player").then(({ outfit }) => ({
          outfitLine: outfit.outfitLine,
          likeness: { portrait: outfit.url },
        }));
  return {
    run,
    connectionId,
    unit,
    place: { key: setup.place, name: place.name, tags: place.tags, url: place.art.url },
    his,
    her,
    hisLook,
    herLook,
  };
}

/**
 * The photo's prompt and its references, built from the run as it is now (at the paid call, so the rating, the 18+
 * gate and the protagonist's current Appearance are the ones in force). Throws what resolveSetup throws.
 */
async function buildPhoto(
  deps: PhotoDeps,
  runId: string,
  setup: PhotoSetup,
  edited: Partial<ImagePrompt> = {},
): Promise<ImagePrompt & { name: string; references: string[] }> {
  const { run, unit, place, his, her, hisLook, herLook } = await resolveSetup(deps, runId, setup);
  const player = await withPersonaImageAppearance(deps.runtime, run.player);
  const images = imagesOf(deps);
  const sources: Array<[PhotoInput["references"][number], ImageIdentitySubject]> = [
    [hisLook.face ? "li-face" : "li", hisLook.likeness],
    [herLook.face ? "her-face" : "her", herLook.likeness],
    ["place", { portrait: place.url }],
  ];
  const resolved: Array<{ who: PhotoInput["references"][number]; image: string }> = [];
  for (const [who, likeness] of sources) {
    const image = await forgeSubjectReference(images, likeness).catch(() => null);
    if (image) resolved.push({ who, image });
  }
  const li: CgPerson = {
    name: unit.name,
    identityLine: unit.identityLine || unit.bible!.look.identityLine,
    outfitLine: hisLook.outfitLine,
    presentation: unit.bible!.look.presentation ?? "person",
  };
  const protagonist: CgPerson = {
    name: player.name || "Protagonist",
    identityLine: player.look.identityLine,
    outfitLine: herLook.outfitLine,
    presentation: "person",
  };
  const style = await worldStyle(images, run.world.images);
  const prompt = photoPrompt(
    {
      li,
      her: protagonist,
      his,
      herPick: her,
      placeTags: place.tags,
      references: resolved.map((entry) => entry.who),
      world: run.world,
      style,
    },
    edited,
  );
  const first = unit.name.trim().split(/\s+/)[0] || "Couple";
  return { ...prompt, name: `${first} photo`, references: resolved.map((entry) => entry.image) };
}

/** POST /runs/:run/photos/prompt: the prompt Take picture would send (the review dialog shows it). No write; 503 too. */
export async function photoPromptFor(deps: PhotoDeps, runId: string, setup: PhotoSetup): Promise<ImagePrompt> {
  const { prompt, negativePrompt } = await buildPhoto(deps, runId, setup);
  return { prompt, negativePrompt };
}

/** Paints the photo its caller has just marked pending at `at`; resolves its art as left. */
function paintPhoto(
  deps: PhotoDeps,
  runId: string,
  id: string,
  at: string,
  connectionId: string,
  { edited, debugMode }: { edited: Partial<ImagePrompt>; debugMode: boolean },
): Promise<Paint | null> {
  const target = photoTarget(runId, id);
  const ours = (photo: Photo | null): photo is Photo => photo?.art.state === "pending" && photo.art.at === at;
  const images = imagesOf(deps);
  /** The record as `check` read it right before the paid call, and the prompt the call sent. */
  let latest: Photo | null = null;
  let sent: ImagePrompt | undefined;
  return paintRecord(deps, {
    connectionId,
    label: `photo ${id}`,
    active: () => !deps.art || deps.art.active(),
    async check(): Promise<PaintCheck> {
      latest = await deps.store.readDoc(target.id, normalizePhoto);
      if (!ours(latest)) return "gone";
      const world: World | null = await deps.store.readDoc(worldId(runId), normalizeWorld);
      if (!world) return "gone";
      return world.images.connectionId === connectionId ? "paint" : "stopped";
    },
    async paint() {
      const photo = latest!;
      const built = await buildPhoto(deps, runId, { ...photo, place: photo.place.key }, edited);
      sent = { prompt: built.prompt, negativePrompt: built.negativePrompt };
      const image = await images.generateImage({
        connectionId,
        name: built.name,
        prompt: built.prompt,
        negativePrompt: built.negativePrompt,
        ...STICKER_SIZE,
        debugMode,
        referenceImages: built.references,
      });
      return images.uploadToGallery({ image, name: built.name, prompt: built.prompt });
    },
    async save(art) {
      const result = await updateIfChanged(deps.store, target, normalizePhoto, (current) =>
        ours(current) ? { ...current, art, ...(sent ? { prompt: sent } : {}) } : undefined,
      );
      return !!result?.changed;
    },
  });
}

/**
 * POST /runs/:run/photos {id, ...setup, prompt?, negativePrompt?}: paints the photo `id` once and answers it as left
 * (ready, failed or stopped). A ready photo is answered as it is, whatever the body says; a second request while it
 * paints waits for that paint; a failed, stopped or orphaned one is painted again (Try again). Refusals come before
 * anything is saved: 503 without an image connection, 404 for an unknown love interest, 400 for a place, pick or look
 * that cannot be used, 409 for a look not won or not painted.
 */
export async function takePhoto(
  deps: PhotoDeps,
  runId: string,
  input: PhotoSetup & { id: string } & Partial<ImagePrompt>,
  { debugMode }: { debugMode: boolean },
): Promise<PhotoView> {
  const { id } = input;
  const target = photoTarget(runId, id);
  const read = () => deps.store.readDoc(target.id, normalizePhoto);
  const edited = { prompt: input.prompt, negativePrompt: input.negativePrompt };
  const photo = await tapPaint(
    runId,
    async () => photoOwner(id),
    async () => {
      const left = await read();
      return { value: left, art: left?.art };
    },
    async () => {
      const current = await read();
      if (current?.art.state === "ready") return current;
      const { connectionId, place, his, her } = await resolveSetup(deps, runId, input);
      const at = new Date().toISOString();
      const saved = await deps.store.mutateDoc(target, normalizePhoto, (existing): Photo =>
        existing?.art.state === "ready"
          ? existing
          : {
              version: 1,
              id,
              li: input.li,
              place: { key: place.key, name: place.name },
              hisLook: input.hisLook,
              herLook: input.herLook,
              his,
              her,
              art: { state: "pending", at },
              createdAt: existing?.createdAt ?? at,
            },
      );
      // The run's delete sweeps its documents after it removes the world; a photo saved after the sweep goes too.
      if (!(await deps.store.readDoc(worldId(runId), normalizeWorld))) {
        await deps.store.removeDoc(target.id).catch(() => false);
        throw runNotFound();
      }
      if (saved?.art.state === "pending" && saved.art.at === at) {
        await paintPhoto(deps, runId, id, at, connectionId, { edited, debugMode });
      }
      return read();
    },
  );
  if (!photo) throw photoNotFound();
  return toPhotoView(runId, photo);
}

/**
 * POST /runs/:run/photos/:id/delete: removes the photo and its image. 409 `busy` while it paints, 404 for none. An
 * image the Engine refuses to delete is logged and left.
 */
export async function deletePhoto(deps: PhotoDeps, runId: string, id: string): Promise<{ deleted: true }> {
  if (paintIsLive(runId, photoOwner(id))) {
    throw new OtomeForgeError(409, "This photo is still being taken.", "busy");
  }
  const removed = await deps.store.takeDoc(photoId(runId, id), (data) => data);
  if (!removed) throw photoNotFound();
  const images = imagesOf(deps);
  let kept = 0;
  for (const ref of galleryRefIds(removed)) {
    if (!(await images.deleteGalleryImage(ref).catch(() => false))) kept += 1;
  }
  if (kept) deps.runtime.logger.warn("[otome-forge] deleted photo %s kept %d gallery image(s)", id, kept);
  return { deleted: true };
}
