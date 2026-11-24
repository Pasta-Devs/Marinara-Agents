// ──────────────────────────────────────────────
// Otome Hearth: a recurring side character's sprite (0.20.0)
// ──────────────────────────────────────────────
// One paid image per side character who qualifies (S/story/side-cast.ts), only while Settings → Images "Side character
// sprites" is on and the world has an image connection: their look painted full body on its chroma matte with
// lookPrompt, as a love interest's look is (S/art/paint.ts), then cut out of it by the free cut-out queue
// (S/art/cutout.ts, the record kept on that person). One neutral picture: no face is ever painted for it.
// - Whose look: theirs as the look call wrote it, or for an Engine card the card's own Appearance (read at the paid
//   call) in place of the look call, drawn as the card's likeness: the image client sends the card's Full Body →
//   Neutral sprite and its avatar as references (S/art/image-client.ts likeness), and a card whose pictures exist but
//   none loads stops before the paid call (MissingLikenessError), saved as failed with Retry.
// - Its record is `person.art`, with the item art's rules for paid work (S/art/outfits.ts, S/art/figurine.ts): claimed
//   once, `pending` (or `waiting-consent` under Ask before painting or the Engine's prompt review) in one
//   revision-checked write of `${R}:sides`; checked again right before the paid call (still the record this paint
//   claimed, the image connection unchanged, the toggle still on, consent still given); saved only onto that record. A
//   failure is kept and repainted only by a tap (POST /runs/:run/art/side: consent, a reviewed prompt or Retry, which
//   never pays twice); a `pending` record with no live paint in this process reads as `stopped`. A ready sprite is
//   painted again only by the reader's Repaint tap (`repaint`), which keeps the picture on screen until the new one is
//   saved, and keeps it if that paint fails (S/art/paint.ts repainting).
// - The reader gets it with the scene's art (GET /runs/:run/art/scene `sides`, S/story/side-cast.ts sceneSides): its
//   cut-out once ready, the painted image where cleanup failed, nothing while it is still being cut out.
import type {
  Paint,
  Presentation,
  SideSpriteView,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { OtomeForgeError } from "../http.js";
import { runDocTarget, sideCastId, worldId } from "../ids.js";
import { type ImagePrompt, LOOK_SIZE, lookPrompt } from "../prompts.js";
import { normalizeSideCast, qualifies, type SideCast, type SidePerson } from "../schemas/side-cast.js";
import { normalizeWorld } from "../schemas/world.js";
import { readCard } from "../setup/cast.js";
import { cutoutView, queueCutouts, type CutoutClient } from "./cutout.js";
import type { OtomeArt } from "./expressions.js";
import { worldStyle, type ImageSubject } from "./image-client.js";
import {
  imagesOf,
  paintRecord,
  paintView,
  releaseReplacedImage,
  repainting,
  startPaint,
  tapPaint,
  updateIfChanged,
  withKeptPicture,
  type ArtDeps,
  type PaintCheck,
  type PaintOwner,
} from "./paint.js";

export interface SideSpriteDeps extends ArtDeps {
  /** The loopback cut-out client by default (S/art/cutout.ts); tests pass a fake. */
  cutouts?: CutoutClient;
  /** The activation's art service: once torn down, nothing more is paid for. */
  art?: Pick<OtomeArt, "active">;
}

/** How the request paints: its debug mode, and whether the player reviews image prompts first (the paint then waits). */
export interface SideSpriteMode {
  debugMode: boolean;
  review?: boolean;
}

/** The live-paint owner of a side character's sprite. */
export const sideOwner = (key: string): PaintOwner => `side:${key}`;

const notFound = (what: string) => new OtomeForgeError(404, `No such ${what}.`, "not-found");
const sidesTarget = (runId: string) => runDocTarget("sides", sideCastId(runId));
const activeOf = (deps: SideSpriteDeps) => () => !deps.art || deps.art.active();
const readSides = (deps: Pick<SideSpriteDeps, "store">, runId: string) =>
  deps.store.readDoc(sideCastId(runId), normalizeSideCast);
/** The person as the cut-out queue keeps their sprite's derivatives (S/art/cutout.ts `side:<key>`). */
const cutoutOwner = (person: Pick<SidePerson, "key" | "cutouts">) => ({
  id: `side:${person.key}`,
  cutouts: person.cutouts ?? {},
});

/** `change` applied to one person's record, writing nothing when it returns undefined or they are gone. */
function withPerson(key: string, change: (person: SidePerson) => SidePerson | undefined) {
  return (current: SideCast): SideCast | undefined => {
    const person = current.people[key];
    const next = person && change(person);
    return next ? { ...current, people: { ...current.people, [key]: next } } : undefined;
  };
}

/** Their sprite as the reader shows it (see the header). */
export function sideSpriteView(runId: string, person: SidePerson): SideSpriteView {
  const art = paintView(runId, sideOwner(person.key), person.art) ?? null;
  // A repaint keeps the picture it replaces on the record (pending while it paints, or beside a failure), so that one
  // still shows; a first paint has no picture until it is ready.
  const painted = art?.url;
  const coming = art?.state === "pending" ? { coming: true as const } : {};
  if (!painted) return { key: person.key, art, ...coming };
  const { state, cutout } = cutoutView(runId, cutoutOwner(person), painted);
  if (state === "pending") {
    return { key: person.key, art, ...(cutout ? { url: cutout, cut: true as const } : {}), coming: true };
  }
  return state === "ready" && cutout
    ? { key: person.key, art, url: cutout, cut: true, ...coming }
    : { key: person.key, art, url: painted, ...coming };
}

/** Queues the free cut-out of each painted sprite without one; the people as shown meanwhile. */
export function queueSideCutouts(deps: SideSpriteDeps, runId: string, people: SidePerson[]): Promise<SidePerson[]> {
  return Promise.all(
    people.map(async (person) => {
      const url = person.art?.state === "ready" ? person.art.url : undefined;
      if (!url) return person;
      const queued = await queueCutouts(deps, runId, cutoutOwner(person), [url]);
      return { ...person, cutouts: queued.cutouts };
    }),
  );
}

const presentationOf = (voice: SidePerson["voice"]): Presentation =>
  voice === "male" ? "man" : voice === "female" ? "woman" : "person";

/** Whom the sprite shows: their written look, or a card's own Appearance with the card's likeness (see the header). */
async function spriteSubject(
  deps: SideSpriteDeps,
  person: SidePerson,
): Promise<{
  name: string;
  identityLine: string;
  outfitLine: string;
  presentation: Presentation;
  image: ImageSubject;
}> {
  if (person.cardId) {
    const card = await readCard(deps.runtime, person.cardId);
    return {
      name: person.name,
      identityLine: card?.appearance ?? "",
      outfitLine: "",
      presentation: presentationOf(person.voice),
      image: { kind: "character", cardId: person.cardId, who: person.name },
    };
  }
  if (!person.look) throw new OtomeForgeError(409, `${person.name}'s look is not written yet.`, "conflict");
  return {
    name: person.name,
    identityLine: person.look.identityLine,
    outfitLine: person.look.outfitLine,
    presentation: person.look.presentation,
    image: { kind: "character" },
  };
}

/** The prompt and the paid call for their sprite, from the documents as they are now. */
async function buildSprite(deps: SideSpriteDeps, runId: string, key: string, edited: Partial<ImagePrompt>) {
  const [world, sides] = await Promise.all([
    deps.store.readDoc(worldId(runId), normalizeWorld),
    readSides(deps, runId),
  ]);
  if (!world) throw notFound("Otome Hearth story");
  const person = sides?.people[key];
  if (!person) throw notFound("side character");
  const subject = await spriteSubject(deps, person);
  const images = imagesOf(deps);
  const style = await worldStyle(images, world.images);
  const prompt = lookPrompt({ ...subject, world, style, matte: true }, edited);
  return {
    ...prompt,
    paint: (connectionId: string, debugMode: boolean) =>
      images.generatePortrait({
        connectionId,
        name: subject.name,
        unit: subject.image,
        prompt: prompt.prompt,
        negativePrompt: prompt.negativePrompt,
        ...LOOK_SIZE,
        debugMode,
      }),
  };
}

/** The prompt their sprite's paint would send (the review dialog shows it). */
export async function sidePromptFor(deps: SideSpriteDeps, runId: string, key: string): Promise<ImagePrompt> {
  const { prompt, negativePrompt } = await buildSprite(deps, runId, key, {});
  return { prompt, negativePrompt };
}

/** Paints the sprite its caller marked pending at `at`, in the connection's lane, then queues its cut-out. */
async function paintSprite(
  deps: SideSpriteDeps,
  runId: string,
  key: string,
  at: string,
  connectionId: string,
  { debugMode, consent, edited = {} }: { debugMode: boolean; consent: boolean; edited?: Partial<ImagePrompt> },
): Promise<Paint | null> {
  const left = await paintRecord(deps, {
    connectionId,
    label: `side character ${key}`,
    active: activeOf(deps),
    async check(): Promise<PaintCheck> {
      const [world, sides] = await Promise.all([
        deps.store.readDoc(worldId(runId), normalizeWorld),
        readSides(deps, runId),
      ]);
      const art = sides?.people[key]?.art;
      if (!world || art?.state !== "pending" || art.at !== at) return "gone";
      if (world.images.connectionId !== connectionId || !world.images.sideSprites) return "stopped";
      if (!consent && world.images.ask) return "waiting-consent";
      return "paint";
    },
    // Built now, so their look and the rating are the ones in force at the paid call.
    paint: async () => (await buildSprite(deps, runId, key, edited)).paint(connectionId, debugMode),
    save: async (art) => {
      let replaced: Paint | undefined;
      const saved = await updateIfChanged(
        deps.store,
        sidesTarget(runId),
        normalizeSideCast,
        withPerson(key, (person) => {
          if (person.art?.state !== "pending" || person.art.at !== at) return undefined;
          replaced = person.art;
          return { ...person, art: withKeptPicture(art, replaced) };
        }),
      );
      if (saved?.changed && art.state === "ready") await releaseReplacedImage(deps, replaced, art);
      return !!saved?.changed;
    },
  });
  if (left?.state === "ready") {
    const person = (await readSides(deps, runId))?.people[key];
    if (person) await queueSideCutouts(deps, runId, [person]);
  }
  return left;
}

/**
 * The automatic paint of a qualifying person whose look is ready (or who is a card): claims their sprite once and paints
 * it in the background, or leaves it waiting for the tap (see the header). Resolves the person as the claim left them,
 * or null when nothing was claimed (the toggle off, no image connection, the art service stopped, a paint of it live
 * already); never waits for the paint.
 */
export async function queueSideSprite(
  deps: SideSpriteDeps,
  runId: string,
  key: string,
  { debugMode, review }: SideSpriteMode,
): Promise<SidePerson | null> {
  const world = await deps.store.readDoc(worldId(runId), normalizeWorld);
  const connectionId = world?.images.connectionId;
  if (!world?.images.sideSprites || !connectionId || !activeOf(deps)()) return null;
  const release = startPaint(runId, sideOwner(key));
  if (!release) return null;
  let handed = false;
  try {
    const wait = world.images.ask || review === true;
    const at = new Date().toISOString();
    const art: Paint = { state: wait ? "waiting-consent" : "pending", at };
    const claimed = await updateIfChanged(
      deps.store,
      sidesTarget(runId),
      normalizeSideCast,
      withPerson(key, (person) =>
        !person.art && qualifies(person) && (person.cardId || person.look) ? { ...person, art } : undefined,
      ),
    );
    const person = claimed?.value.people[key] ?? null;
    if (!claimed?.changed || wait) return person;
    handed = true;
    void paintSprite(deps, runId, key, at, connectionId, { debugMode, consent: false })
      .catch((error: unknown) =>
        deps.runtime.logger.warn(
          "[otome-forge] painting the sprite of side character %s stopped: %s",
          key,
          error instanceof Error ? error.message : String(error),
        ),
      )
      .finally(release);
    return person;
  } finally {
    if (!handed) release();
  }
}

/**
 * POST /runs/:run/art/side: the tap that paints a side character's sprite now (Ask's consent, a reviewed prompt, or
 * Retry). Waits for the paint and resolves the record as left; a ready one is returned as it is unless `repaint` (the
 * reader's Repaint tap) asks for a new picture, and a tap while it paints waits for that paint, so no tap pays twice.
 * 404 for no such qualifying person, 409 `locked` while the toggle is off, 409 `conflict` while their look is still
 * being written, 503 `no-connection` without an image connection.
 */
export async function paintSideNow(
  deps: SideSpriteDeps,
  runId: string,
  key: string,
  { debugMode, edited, repaint = false }: { debugMode: boolean; edited?: Partial<ImagePrompt>; repaint?: boolean },
): Promise<Paint | null> {
  const shown = async () => {
    const person = (await readSides(deps, runId))?.people[key];
    return person ? sideSpriteView(runId, person).art : null;
  };
  // The record as this tap found it, so a repaint can tell one another tap's refused paint left untouched.
  const first = (await readSides(deps, runId))?.people[key]?.art;
  return tapPaint(
    runId,
    async () => sideOwner(key),
    async ({ threw }) => {
      const art = await shown();
      // #2299: a paint that was refused (it threw) left the sprite as this repaint found it, which is no answer to it.
      const untouched = threw && repaint && art?.state === first?.state && art?.at === first?.at;
      return { value: art, ...(art && !untouched ? { art } : {}) };
    },
    async () => {
      const [world, sides] = await Promise.all([
        deps.store.readDoc(worldId(runId), normalizeWorld),
        readSides(deps, runId),
      ]);
      if (!world) throw notFound("Otome Hearth story");
      const person = sides?.people[key];
      if (!person || !qualifies(person)) throw notFound("side character");
      if (!world.images.sideSprites) {
        throw new OtomeForgeError(409, "Side character sprites are off in Settings → Images.", "locked");
      }
      if (person.art?.state === "ready" && !repaint) {
        await queueSideCutouts(deps, runId, [person]);
        return person.art;
      }
      if (!person.cardId && !person.look) {
        throw new OtomeForgeError(409, `${person.name}'s look is not written yet.`, "conflict");
      }
      const connectionId = world.images.connectionId;
      if (!connectionId) throw new OtomeForgeError(503, "This world has no image connection.", "no-connection");
      const at = new Date().toISOString();
      const claimed = await updateIfChanged(
        deps.store,
        sidesTarget(runId),
        normalizeSideCast,
        withPerson(key, (current) => {
          if (current.art?.state === "ready" && !repaint) return undefined;
          // A picture already there (a ready sprite, or one a failed repaint kept) stays on screen while this paints.
          return { ...current, art: current.art?.url ? repainting(current.art, at) : { state: "pending", at } };
        }),
      );
      if (!claimed) throw notFound("Otome Hearth story");
      if (claimed.changed) await paintSprite(deps, runId, key, at, connectionId, { debugMode, consent: true, edited });
      return shown();
    },
  );
}
