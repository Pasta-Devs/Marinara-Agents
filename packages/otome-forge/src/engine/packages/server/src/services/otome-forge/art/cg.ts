// ──────────────────────────────────────────────
// Otome Forge: story CGs (plan M2b "Story CGs"): painted onto the beat that holds them, unlocked once seen
// ──────────────────────────────────────────────
// A beat on a `cg` node may carry a brief (beat.cg: the segment it opens on, an English brief, the names of at most 3
// people in the frame). When the beat is written, its CG is painted in the background (beat.cg.art), unless Ask
// before painting is on or the player reviews image prompts; then it waits for the tap, as a failed or stopped one
// does. The prompt is the brief plus each person's identity and outfit lines, the rating and an adult tag for every
// person, sent as the prompt override, with each person's card, persona or portrait as a reference (at most 4). A brief
// that set `explicit` is painted explicit only while Heat and the rating are both Explicit at the paid call, and then
// without the outfit lines (S/art/prompts.ts cgPrompt).
// The paint belongs to the beat as it was written (`written.at`): a rewrite while it paints gets nothing, and the
// image is deleted again. The album gains a CG only through POST .../art/cg/seen, once the CG is ready and the beat has
// been read to the segment it opens on; a second report changes nothing. A beat eased off before the CG's segment never
// shows it, so it is not painted (a paint still waiting in the lane stops). queueScenePaints is the one call the beat
// writer makes after a beat is written: its places, then its CG.
import type {
  AlbumCg,
  Beat,
  Paint,
  Player,
  Unit,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { sameName } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import { OtomeForgeError } from "../http.js";
import { beatId, runDocTarget, stateId } from "../ids.js";
import { STATE_LIMITS, keepNewest, normalizeState, readRun } from "../schemas/state.js";
import { normalizeBeat } from "../schemas/story.js";
import { readBeat, readChapter } from "../story/canon.js";
import { GALLERY_REF_PREFIX, type ImageSubject } from "./image-client.js";
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
import { paintBeatPlaces, type PaintOptions } from "./places.js";
import { CG_PEOPLE_MAX, SCENE_SIZE, cgPrompt, type CgPerson, type ImagePrompt } from "./prompts.js";

type BeatCg = NonNullable<Beat["cg"]>;

/** The paint of the CG of beat `key`/`i` as written at `writtenAt` (a rewrite is another paint). */
const ownerOf = (key: string, i: number, writtenAt: string): PaintOwner => `cg:${key}/${i}@${writtenAt}`;
/** The album entry's key. */
export const albumKey = (key: string, i: number) => `${key}/${i}`;

const beatNotFound = () => new OtomeForgeError(404, "No such beat.", "not-found");
const noCg = () => new OtomeForgeError(404, "This beat has no key image.", "not-found");
const runNotFound = () => new OtomeForgeError(404, "No such Otome Forge run.", "not-found");

/** The beat's CG as the client should see it: a pending paint this process is not painting reads as stopped. */
export function cgView(runId: string, beat: Pick<Beat, "key" | "i" | "cg" | "written">): BeatCg | null {
  if (!beat.cg) return null;
  const art = paintView(runId, ownerOf(beat.key, beat.i, beat.written.at), beat.cg.art);
  return art ? { ...beat.cg, art } : beat.cg;
}

/** True while `beat` is still the one written at `writtenAt` and its CG paint is the one marked pending at `at`. */
const paintsFor = (beat: Beat | null, writtenAt: string, at?: string) =>
  !!beat?.cg &&
  beat.written.at === writtenAt &&
  (at === undefined || (beat.cg.art?.state === "pending" && beat.cg.art.at === at));

/**
 * Applies `change` to the stored beat's CG while the beat is still the one written at `writtenAt`; a change that
 * returns null writes nothing. Resolves the beat as it stands, or null when it is gone or was rewritten.
 */
async function updateCg(
  deps: ArtDeps,
  runId: string,
  beat: Pick<Beat, "key" | "i">,
  writtenAt: string,
  change: (cg: BeatCg) => BeatCg | null,
): Promise<{ beat: Beat; changed: boolean } | null> {
  let stale = false;
  const result = await updateIfChanged(
    deps.store,
    runDocTarget("beat", beatId(runId, beat.key, beat.i)),
    normalizeBeat,
    (current) => {
      stale = !paintsFor(current, writtenAt);
      const next = stale ? null : change(current!.cg!);
      return next ? { ...current!, cg: next } : undefined;
    },
  );
  return result?.value && !stale ? { beat: result.value, changed: result.changed } : null;
}

// ── Who is in the frame ──

export interface CgSubject {
  person: CgPerson;
  /** Whose likeness the reference keeps; none for someone the story only names. */
  image?: ImageSubject;
}

/** The CG's people, in the brief's order: a love interest, the protagonist, or someone only named (at most 4). */
export function cgSubjects(cast: readonly string[], units: readonly Unit[], player: Player): CgSubject[] {
  const subjects: CgSubject[] = [];
  const seen = new Set<string>();
  for (const name of cast) {
    if (subjects.length >= CG_PEOPLE_MAX) break;
    const unit = units.find((candidate) => sameName(name, candidate.name));
    const isPlayer = !unit && !!player.name && sameName(name, player.name);
    const id = unit ? `li:${unit.id}` : isPlayer ? "player" : `name:${name.trim().toLowerCase()}`;
    if (!name.trim() || seen.has(id)) continue;
    seen.add(id);
    if (unit) {
      // The look worn now dresses them in the CG: its outfit line in the prompt, its image after the faces.
      const worn = unit.wornOutfit ? unit.outfits.find((outfit) => outfit.id === unit.wornOutfit) : undefined;
      subjects.push({
        person: {
          name: unit.name,
          identityLine: unit.identityLine || unit.bible?.look.identityLine || "",
          outfitLine: worn?.outfitLine || unit.outfitLine || unit.bible?.look.outfitLine || "",
          presentation: unit.bible?.look.presentation ?? "person",
        },
        image: {
          kind: "character",
          ...(unit.cardId ? { cardId: unit.cardId } : {}),
          ...(unit.portrait ? { portrait: unit.portrait } : {}),
          outfits: unit.outfits,
          ...(worn ? { wornOutfit: worn.id } : {}),
        },
      });
    } else if (isPlayer) {
      const worn = player.wornOutfit ? player.outfits.find((outfit) => outfit.id === player.wornOutfit) : undefined;
      subjects.push({
        person: {
          name: player.name,
          ...player.look,
          ...(worn?.outfitLine ? { outfitLine: worn.outfitLine } : {}),
          presentation: "person",
        },
        image: {
          kind: "character",
          personaId: player.personaId,
          ...(player.portrait ? { portrait: player.portrait } : {}),
          outfits: player.outfits,
          ...(worn ? { wornOutfit: worn.id } : {}),
        },
      });
    } else {
      subjects.push({ person: { name: name.trim(), identityLine: "", outfitLine: "", presentation: "person" } });
    }
  }
  return subjects;
}

/** The CG prompt for the stored beat, and who is in it. */
async function buildCg(deps: ArtDeps, runId: string, beat: Beat, edited: Partial<ImagePrompt> = {}) {
  const run = await readRun(deps.store, runId);
  if (!run) throw runNotFound();
  const cg = beat.cg;
  if (!cg) throw noCg();
  const subjects = cgSubjects(cg.cast, run.units, run.player);
  const style = await imagesOf(deps).styleProfile(run.world.images.styleProfileId);
  const prompt = cgPrompt(
    {
      brief: cg.brief,
      people: subjects.map((subject) => subject.person),
      world: run.world,
      style,
      use: "cg",
      explicit: cg.explicit === true,
    },
    edited,
  );
  return { ...prompt, world: run.world, subjects };
}

/** The prompt a CG's paint sends (the review dialog shows it), with `edited` text kept and made safe. */
export async function cgPromptFor(
  deps: ArtDeps,
  runId: string,
  key: string,
  i: number,
  edited: Partial<ImagePrompt> = {},
): Promise<ImagePrompt> {
  const beat = await readBeat(deps.store, runId, key, i);
  if (!beat) throw beatNotFound();
  const { prompt, negativePrompt } = await buildCg(deps, runId, beat, edited);
  return { prompt, negativePrompt };
}

// ── Painting ──

/** Paints the CG of `beat` (stored, as written at beat.written.at), which the caller has marked pending at `at`. */
async function paintCg(
  deps: ArtDeps,
  runId: string,
  beat: Beat,
  at: string,
  connectionId: string,
  options: PaintOptions & { consent: boolean; edited?: Partial<ImagePrompt> },
): Promise<Paint | null> {
  const writtenAt = beat.written.at;
  const images = imagesOf(deps);
  return paintRecord(deps, {
    connectionId,
    label: `cg ${albumKey(beat.key, beat.i)}`,
    active: options.active,
    async check(): Promise<PaintCheck> {
      const [current, run] = await Promise.all([
        readBeat(deps.store, runId, beat.key, beat.i),
        readRun(deps.store, runId),
      ]);
      if (!run || !paintsFor(current, writtenAt, at)) return "gone";
      // Eased off before its line: it can never be shown or unlocked, so nothing is paid for it.
      if (current!.easedOff && current!.easedOff.at < current!.cg!.at) return "stopped";
      if (run.world.images.connectionId !== connectionId) return "stopped";
      if (!options.consent && run.world.images.ask) return "waiting-consent";
      return "paint";
    },
    async paint() {
      // Built now, so the rating, the 18+ gate and everyone's looks are the ones in force at the paid call.
      const built = await buildCg(deps, runId, beat, options.edited);
      return images.generateBannerArt({
        connectionId,
        // The Engine matches the override as `avatar:<slug of the first person's first name>`.
        name: built.subjects[0]?.person.name.split(/\s+/)[0] || "Scene",
        units: built.subjects.flatMap((subject) => (subject.image ? [subject.image] : [])),
        prompt: built.prompt,
        negativePrompt: built.negativePrompt,
        ...SCENE_SIZE,
        debugMode: options.debugMode,
      });
    },
    async save(art) {
      const saved = await updateCg(deps, runId, beat, writtenAt, (cg) =>
        cg.art?.state === "pending" && cg.art.at === at ? { ...cg, art } : null,
      );
      return !!saved?.changed;
    },
  });
}

/**
 * Paints the CG of a beat just written, in the background, or leaves it waiting for the tap (Ask before painting, or
 * the player reviews image prompts). A CG that already has a record is left as it is. Never throws.
 */
export async function paintBeatCg(deps: ArtDeps, runId: string, written: Beat, options: PaintOptions): Promise<void> {
  if (!written.cg || written.cg.art) return;
  const writtenAt = written.written.at;
  const owner = ownerOf(written.key, written.i, writtenAt);
  const release = startPaint(runId, owner);
  if (!release) return;
  try {
    const run = await readRun(deps.store, runId);
    const connectionId = run?.world.images.connectionId;
    if (!run || !connectionId) return;
    const wait = run.world.images.ask || options.review === true;
    const at = new Date().toISOString();
    const saved = await updateCg(deps, runId, written, writtenAt, (cg) =>
      cg.art ? null : { ...cg, art: { state: wait ? "waiting-consent" : "pending", at } },
    );
    if (!saved?.changed || wait) return;
    await paintCg(deps, runId, saved.beat, at, connectionId, { ...options, consent: false });
  } catch (error) {
    deps.runtime.logger.warn(
      "[otome-forge] painting cg %s stopped: %s",
      albumKey(written.key, written.i),
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    release();
  }
}

/**
 * POST /runs/:run/art/cg: the tap that paints a beat's CG now (its consent, or Retry). Waits for the paint and resolves
 * the CG's record as left; a ready one is returned as it is, and a tap while it is painting waits for that paint.
 */
export async function paintCgNow(
  deps: ArtDeps,
  runId: string,
  key: string,
  i: number,
  { debugMode, edited, active }: { debugMode: boolean; edited?: Partial<ImagePrompt>; active?: () => boolean },
): Promise<Paint | undefined> {
  const read = async () => {
    const beat = await readBeat(deps.store, runId, key, i);
    if (!beat) throw beatNotFound();
    if (!beat.cg) throw noCg();
    return beat;
  };
  let beat = await read();
  return tapPaint(
    runId,
    async () => ownerOf(key, i, (beat = await read()).written.at),
    async () => {
      const art = cgView(runId, await read())?.art;
      return { value: art, art };
    },
    async () => {
      if (beat.cg!.art?.state === "ready") return beat.cg!.art;
      const run = await readRun(deps.store, runId);
      if (!run) throw runNotFound();
      const connectionId = run.world.images.connectionId;
      if (!connectionId) throw new OtomeForgeError(503, "This world has no image connection.", "no-connection");
      const at = new Date().toISOString();
      const saved = await updateCg(deps, runId, beat, beat.written.at, (cg) =>
        cg.art?.state === "ready" ? null : { ...cg, art: { state: "pending", at } },
      );
      if (!saved) throw new OtomeForgeError(409, "This scene changed. Open it again.", "conflict");
      if (saved.changed) {
        await paintCg(deps, runId, saved.beat, at, connectionId, { debugMode, consent: true, edited, active });
      }
      return cgView(runId, await read())?.art;
    },
  );
}

/**
 * The beat's places and its CG, painted in the background after the beat is written (or left waiting for the tap).
 * The beat writer calls it once per written beat, a rewrite included; it never throws. Resolves once every paint it
 * started has ended (tests wait on it; the writer does not).
 */
export function queueScenePaints(deps: ArtDeps, runId: string, beat: Beat, options: PaintOptions): Promise<void> {
  return Promise.all([
    paintBeatPlaces(deps, runId, beat.places, options),
    paintBeatCg(deps, runId, beat, options),
  ]).then(() => undefined);
}

// ── Unlocking ──

/**
 * POST /runs/:run/art/cg/seen: adds the beat's CG to the album once it is ready and the beat has been read to the
 * segment it opens on (POST .../read reports how far). `unlocked` is true only on the request that added it.
 */
export async function markCgSeen(
  deps: ArtDeps,
  runId: string,
  key: string,
  i: number,
): Promise<{ unlocked: boolean; album: AlbumCg[] }> {
  const [beat, chapter] = await Promise.all([readBeat(deps.store, runId, key, i), readChapter(deps.store, runId, key)]);
  if (!beat || !chapter) throw beatNotFound();
  const cg = beat.cg;
  if (!cg) throw noCg();
  const art = cg.art;
  if (art?.state !== "ready" || !art.url || !art.ref) {
    throw new OtomeForgeError(409, "This key image is not painted yet.", "conflict");
  }
  // An Ease off before the CG's segment keeps readThrough below it: a CG never shown is never unlocked.
  if (beat.readThrough < cg.at) throw new OtomeForgeError(409, "This key image has not been shown yet.", "conflict");
  const units = (await readRun(deps.store, runId))?.units ?? [];
  const li =
    cg.cast.map((name) => units.find((unit) => sameName(name, unit.name))?.id).find(Boolean) ??
    chapter.li ??
    chapter.lead;
  const entry: AlbumCg = {
    key: albumKey(key, i),
    url: art.url,
    ref: art.ref,
    at: new Date().toISOString(),
    ...(li ? { li } : {}),
  };
  const result = await updateIfChanged(deps.store, runDocTarget("state", stateId(runId)), normalizeState, (current) =>
    current.album.cgs.some((item) => item.key === entry.key)
      ? undefined
      : { ...current, album: { ...current.album, cgs: keepNewest([...current.album.cgs, entry], STATE_LIMITS.album) } },
  );
  if (!result) throw runNotFound();
  return { unlocked: result.changed, album: result.value.album.cgs };
}

/**
 * A beat replaced by a rewrite, or removed: deletes its CG's gallery image unless the album keeps it. Call it after
 * the beat document no longer refers to the image (the Engine refuses to delete an image a document still holds).
 */
export async function releaseBeatArt(deps: ArtDeps, runId: string, beat: Pick<Beat, "cg">): Promise<void> {
  const ref = beat.cg?.art?.ref;
  if (!ref?.startsWith(GALLERY_REF_PREFIX)) return;
  try {
    const state = await deps.store.readDoc(stateId(runId), normalizeState);
    if (state?.album.cgs.some((item) => item.ref === ref)) return;
    await imagesOf(deps).deleteGalleryImage(ref.slice(GALLERY_REF_PREFIX.length));
  } catch (error) {
    deps.runtime.logger.warn(
      "[otome-forge] could not release a replaced key image: %s",
      error instanceof Error ? error.message : String(error),
    );
  }
}
