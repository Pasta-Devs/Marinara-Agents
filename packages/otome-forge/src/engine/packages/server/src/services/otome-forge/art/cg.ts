// ──────────────────────────────────────────────
// Otome Forge: story CGs (plan M2b "Story CGs"): painted onto the beat that holds them, unlocked once seen
// ──────────────────────────────────────────────
// A beat on a `cg` node may carry a brief (beat.cg: the segment it opens on, an English brief, the names of at most 3
// people in the frame). Once the beat is written (the lookahead's included, so it is ready when the reader gets there),
// its CG is painted in the background (beat.cg.art), unless Ask before painting is on or the player reviews image
// prompts; then it waits for the tap, as a failed or stopped one does. Serving the beat paints it when it has no record
// yet. A beat an Ease off or a Rewrite drops lets its CG go: a paint still waiting stops, a painted one is deleted. The
// prompt is the brief plus each person's identity and outfit lines, the rating and an adult tag for every
// person, sent as the prompt override, with each person's card, persona or portrait as a reference (at most 4). A brief
// that set `explicit` is painted explicit only while Heat and the rating are both Explicit at the paid call, and then
// without the outfit lines (S/prompts.ts cgPrompt).
// The paint belongs to the beat as it was written (`written.at`): a rewrite while it paints gets nothing, and the
// image is deleted again. The album gains a CG only through POST .../art/cg/seen, once the CG is ready and the beat has
// been read to the segment it opens on; a second report changes nothing. A beat eased off before the CG's segment never
// shows it, so it is not painted (a paint still waiting in the lane stops). The beat writer calls queueScenePaints with
// a beat once it is written, and startBeatCg (OtomeArt.prepareSceneCg) once it is served, awaiting only the CG's
// record so the reader's first art read sees it pending or waiting; the first to write the record paints (startPaint).
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
import { withPersonaImageAppearance } from "../setup/cast.js";
import { readBeat, readChapter } from "../story/canon.js";
import { GALLERY_REF_PREFIX, worldStyle, type ImageSubject } from "./image-client.js";
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
import { CG_PEOPLE_MAX, imageNames, type CgPerson, type ImagePrompt, SCENE_SIZE, cgPrompt } from "../prompts.js";

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
  /** The painted look they wear, if any: their one reference beside others (cgSubjects). */
  wornUrl?: string;
}

/**
 * The CG's people, in the brief's order: a love interest, the protagonist, or someone only named (at most
 * CG_PEOPLE_MAX). Alone, a person is sent as who they are and the look they wear (two references). With others, each
 * person is ONE reference, their worn look when they have one: two full-body pictures of each person in the same
 * standing pose made the model merge bodies and draw extra limbs (the maintainer's report, 2026-11-03).
 */
export function cgSubjects(cast: readonly string[], units: readonly Unit[], player: Player): CgSubject[] {
  const subjects = castSubjects(cast, units, player);
  if (subjects.length < 2) return subjects;
  return subjects.map((subject) =>
    subject.image && subject.wornUrl
      ? {
          ...subject,
          // Their setup portrait stands behind the look, should its file be gone.
          image: {
            kind: "character",
            portrait: subject.wornUrl,
            ...(subject.image.portrait ? { avatarPath: subject.image.portrait } : {}),
          },
        }
      : subject,
  );
}

/** Whether the kit can find a picture of this subject for sure (a card, a portrait or a look), or only maybe. */
const likenessOf = (image: ImageSubject): "sure" | "maybe" | "none" =>
  image.cardId || image.portrait ? "sure" : image.personaId ? "maybe" : "none";

/**
 * The references a CG of these subjects sends (`units`, for generateBannerArt) and whom each one shows (`labels`, for
 * cgPrompt), from one list so the two always agree: every person's likeness in turn, then a lone person's worn look,
 * as the kit sends them. Someone with nothing to send is neither sent nor named, and a protagonist known only by a
 * persona (whose avatar may be empty) goes last, so a missing picture of her never moves anyone else's label.
 * ponytail: a file that fails to load (a deleted card image) still shifts the labels after it; the kit logs it. The
 * upgrade path is the kit returning which references it sent.
 */
export function cgReferences(subjects: readonly CgSubject[]): { units: ImageSubject[]; labels: string[] } {
  // Named as cgPrompt's look lines name them: first names, whole names where two share one.
  const names = new Map(
    imageNames(subjects.map((subject) => subject.person.name)).map((name, index) => [subjects[index], name] as const),
  );
  const first = (subject: CgSubject) => names.get(subject) || subject.person.name;
  const shown = subjects.filter((subject) => subject.image && likenessOf(subject.image) !== "none");
  const ordered = [...shown].sort(
    (a, b) => Number(likenessOf(a.image!) === "maybe") - Number(likenessOf(b.image!) === "maybe"),
  );
  const labels = ordered.map(first);
  const alone = ordered.length === 1 ? ordered[0]! : undefined;
  // A lone person's look follows their likeness; when that likeness may be missing, the look is named as them.
  if (alone?.image?.wornOutfit && likenessOf(alone.image) === "sure") labels.push(`${first(alone)}'s outfit`);
  return { units: ordered.map((subject) => subject.image!), labels };
}

/** The CG's people as the brief names them, each with their likeness and the look they wear. */
function castSubjects(cast: readonly string[], units: readonly Unit[], player: Player): CgSubject[] {
  const subjects: CgSubject[] = [];
  const seen = new Set<string>();
  for (const name of cast) {
    if (subjects.length >= CG_PEOPLE_MAX) break;
    // A name a love interest already took that is also the protagonist's is her (a keepsake with a namesake persona).
    const named = units.find((candidate) => sameName(name, candidate.name));
    const playerToo = !!player.name && sameName(name, player.name);
    const unit = named && !(playerToo && seen.has(`li:${named.id}`)) ? named : undefined;
    const isPlayer = !unit && playerToo;
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
        ...(worn?.url ? { wornUrl: worn.url } : {}),
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
        ...(worn?.url ? { wornUrl: worn.url } : {}),
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
  run.player = await withPersonaImageAppearance(deps.runtime, run.player);
  const cg = beat.cg;
  if (!cg) throw noCg();
  const subjects = cgSubjects(cg.cast, run.units, run.player);
  const style = await worldStyle(imagesOf(deps), run.world.images);
  const prompt = cgPrompt(
    {
      brief: cg.brief,
      people: subjects.map((subject) => subject.person),
      world: run.world,
      style,
      use: "cg",
      explicit: cg.explicit === true,
      references: cgReferences(subjects).labels,
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
        units: cgReferences(built.subjects).units,
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

/** Each CG whose record a start is writing, by run and owner (see startBeatCg). */
const recording = new Map<string, Promise<void>>();

/**
 * Writes the record of a beat's CG: pending, or waiting for the tap (Ask before painting, or the player reviews image
 * prompts). Resolves once it is written, with the beat as it stands, while the paid paint goes on in `painting`. A CG
 * that already has a record is left as it is. A start while another holds the CG's paint (the scene served just as the
 * paint its writing started is under way) waits for that one's record and resolves the stored beat with it, so the
 * reader's first art read sees the CG pending, never missing. Never throws.
 */
export async function startBeatCg(
  deps: ArtDeps,
  runId: string,
  written: Beat,
  options: PaintOptions,
): Promise<{ beat: Beat; painting: Promise<void> }> {
  const idle = { beat: written, painting: Promise.resolve() };
  if (!written.cg || written.cg.art) return idle;
  const writtenAt = written.written.at;
  const owner = ownerOf(written.key, written.i, writtenAt);
  const key = `${runId}|${owner}`;
  const release = startPaint(runId, owner);
  if (!release) {
    await recording.get(key);
    const stored = await readBeat(deps.store, runId, written.key, written.i).catch(() => null);
    return { ...idle, beat: stored?.written.at === writtenAt ? stored : written };
  }
  let recorded = () => {};
  recording.set(key, new Promise<void>((resolve) => (recorded = resolve)));
  const stopped = (error: unknown) =>
    deps.runtime.logger.warn(
      "[otome-forge] painting cg %s stopped: %s",
      albumKey(written.key, written.i),
      error instanceof Error ? error.message : String(error),
    );
  let painting: Promise<void> | null = null;
  try {
    const run = await readRun(deps.store, runId);
    const connectionId = run?.world.images.connectionId;
    if (!run || !connectionId) return idle;
    const wait = run.world.images.ask || options.review === true;
    const at = new Date().toISOString();
    const saved = await updateCg(deps, runId, written, writtenAt, (cg) =>
      cg.art ? null : { ...cg, art: { state: wait ? "waiting-consent" : "pending", at } },
    );
    if (!saved?.changed || wait) return { ...idle, beat: saved?.beat ?? written };
    painting = paintCg(deps, runId, saved.beat, at, connectionId, { ...options, consent: false })
      .then(() => undefined, stopped)
      .finally(release);
    return { beat: saved.beat, painting };
  } catch (error) {
    stopped(error);
    return idle;
  } finally {
    recording.delete(key);
    recorded();
    if (!painting) release();
  }
}

/** startBeatCg, resolved once the paint it started has ended. Never throws. */
export async function paintBeatCg(deps: ArtDeps, runId: string, written: Beat, options: PaintOptions): Promise<void> {
  const { painting } = await startBeatCg(deps, runId, written, options);
  await painting;
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
 * The beat's places and its CG, painted in the background (or left waiting for the tap). The beat writer calls it once
 * per written beat, a rewrite included; it never throws. Resolves once every paint it started has ended (tests wait on
 * it; the writer does not).
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
  // An Ease off before the CG's segment keeps readThrough below it, and a beat written ahead (its CG painted with it,
  // its readThrough still 0) is not shown until it is the one being read: a CG never shown is never unlocked.
  const run = await readRun(deps.store, runId);
  const progress = run?.state.chapters[key];
  if (beat.readThrough < cg.at || (!progress?.completed && i > (progress?.beatsRead ?? 0))) {
    throw new OtomeForgeError(409, "This key image has not been shown yet.", "conflict");
  }
  const units = run?.units ?? [];
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
