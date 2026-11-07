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
import { coreOf, fold, nameWords } from "../names.js";

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

/** Whom a cast entry names: a love interest, the protagonist, or someone only named (`ambiguous`: by several). */
export type CastMember = { li: Unit } | { player: true } | { name: string; ambiguous?: true };

/** Words a writer calls the protagonist by instead of her name. */
const PROTAGONIST_WORDS = new Set([
  "you",
  "yourself",
  "protagonist",
  "the protagonist",
  "heroine",
  "the heroine",
  "player",
  "the player",
  "mc",
  "main character",
  "the main character",
]);
/** Titles that never name someone of this subject pronoun ("Mrs. Ren" is not Kai Ren, who is "he"). */
const TITLES_NOT_FOR: Partial<Record<string, ReadonlySet<string>>> = {
  he: new Set("mrs ms miss lady dame mistress princess queen".split(" ")),
  she: new Set("mr lord sir master prince king".split(" ")),
};

const within = (words: readonly string[], of: readonly string[]) => words.every((word) => of.includes(word));
/** Running text's words, split on anything that is not a letter or digit, so "Kai's hand" says Kai. */
const textWords = (text: string) =>
  fold(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/**
 * Whom each entry of a cast names, in order, each person once. By id (`<id>` or `li:<id>`), a word for the protagonist
 * ("you", "the heroine"), or a name: an exact match of the core words (no titles, articles, honorifics or accents)
 * wins over a partial one (every core word is a word of the stored name, or the stored core is among the entry's
 * words; whole words only, so "Ann" never names Anna). A title of the other gender is someone else ("Mrs. Ren" is not
 * Kai Ren), and an entry with no letters ("???") names nobody known. Ids, role words and exact names are settled
 * first, so the cast's order never decides whom a partial name means. Someone already in the frame answers again only
 * to their exact core or their own words ("Ren" beside Kai Ren is him again). Several left: those `present` (the
 * node's love interest ids) and the protagonist; one love interest and the protagonist sharing a name are him first,
 * then her. Still several: only named, and `ambiguous`.
 */
export function resolveCast(
  cast: readonly string[],
  units: readonly Unit[],
  player: Player,
  present?: readonly string[],
): CastMember[] {
  const people = [
    ...units.map((unit) => ({ unit, name: unit.name, pronoun: unit.pronouns?.subject })),
    { unit: null, name: player.name, pronoun: player.pronouns?.subject },
  ]
    .map((person) => ({
      ...person,
      words: nameWords(person.name),
      notFor: TITLES_NOT_FOR[fold(person.pronoun ?? "").trim()],
    }))
    .map((person) => ({ ...person, core: coreOf(person.words) }))
    .filter((person) => person.words.length);
  const entries = cast.flatMap((entry, at) => {
    const text = entry.trim();
    if (!text) return [];
    const id = text.toLowerCase().replace(/^li:/u, "");
    const words = nameWords(text);
    // A love interest by id, the protagonist by a role word (null), else undefined: matched by name.
    const direct =
      units.find((unit) => unit.id.toLowerCase() === id) ?? (PROTAGONIST_WORDS.has(words.join(" ")) ? null : undefined);
    const core = coreOf(words);
    const matches =
      direct !== undefined || !words.length
        ? []
        : people.flatMap((person) => {
            if (words.some((word) => person.notFor?.has(word) && !person.words.includes(word))) return [];
            const exact = core.join(" ") === person.core.join(" ");
            return exact || within(core, person.words) || within(person.core, words) ? [{ ...person, exact }] : [];
          });
    return [{ at, text, words, direct, matches }];
  });
  type Entry = (typeof entries)[number];
  const firm = (entry: Entry) => entry.direct !== undefined || entry.matches.some((match) => match.exact);
  // Each entry's member (or none), in cast order. Who is in the frame already: a love interest, null for the
  // protagonist, or the words of someone only named.
  const slots: CastMember[][] = cast.map(() => []);
  const taken = new Set<Unit | null | string>();
  for (const { at, text, words, direct, matches } of [
    ...entries.filter(firm),
    ...entries.filter((entry) => !firm(entry)),
  ]) {
    const slot = slots[at]!;
    const add = (unit: Unit | null) => {
      if (taken.has(unit)) return;
      taken.add(unit);
      slot.push(unit ? { li: unit } : { player: true });
    };
    const named = (ambiguous?: true) => {
      const key = words.join(" ") || fold(text);
      if (taken.has(key)) return;
      taken.add(key);
      slot.push({ name: text, ...(ambiguous ? { ambiguous } : {}) });
    };
    if (direct !== undefined) {
      add(direct);
      continue;
    }
    const exact = matches.filter((match) => match.exact);
    let best = exact.length ? exact : matches;
    // The protagonist's own name that a love interest of this node starts with ("Kai" for her and Kai Ren): both
    // stay, so the namesake rule below gives him first, then her (Dottore, #2148).
    const nodeLis = present
      ? matches.filter((match) => !match.exact && match.unit && present.includes(match.unit.id))
      : [];
    if (exact.length && exact.every((match) => !match.unit) && nodeLis.length) best = [...exact, ...nodeLis];
    let fresh = best.filter((match) => !taken.has(match.unit));
    if (!fresh.length) {
      // Only people already in the frame: them again, or someone else who shares a word of their name.
      if (!best.some((match) => match.exact || within(words, match.words))) named();
      continue;
    }
    if (fresh.length > 1 && present) {
      const near = fresh.filter((match) => !match.unit || present.includes(match.unit.id));
      if (near.length) fresh = near;
    }
    const namesake = fresh.length === 2 && fresh.some((match) => !match.unit);
    if (fresh.length === 1 || namesake) add(fresh.find((match) => match.unit)?.unit ?? null);
    else named(true);
  }
  return slots.flat();
}

/**
 * A key image whose cast names nobody: the love interests of its node (one or two) whose name the brief says, and the
 * protagonist when it says "you", "your", "protagonist", "heroine" or her name, or someone's own pronoun no one else
 * here uses. Nobody pointed at is nobody: a picture of a letter stays empty.
 */
function briefCast(brief: string, units: readonly Unit[], player: Player, present: readonly string[]): CastMember[] {
  const lis = present.flatMap((id) => units.filter((unit) => unit.id === id));
  if (lis.length < 1 || lis.length > 2) return [];
  const said = new Set(textWords(brief));
  const forms = (pronouns: Partial<Unit["pronouns"]> | undefined) =>
    [pronouns?.subject, pronouns?.object, pronouns?.possessive].flatMap((form) => textWords(form ?? ""));
  const people = [
    ...lis.map((unit) => ({
      member: { li: unit } as CastMember,
      words: coreOf(textWords(unit.name)),
      pronouns: forms(unit.pronouns),
    })),
    {
      member: { player: true } as CastMember,
      words: [...coreOf(textWords(player.name)), "you", "your", "protagonist", "heroine"],
      pronouns: forms(player.pronouns),
    },
  ];
  const unshared = (form: string) => people.filter((person) => person.pronouns.includes(form)).length === 1;
  return people
    .filter(
      (person) =>
        person.words.some((word) => said.has(word)) || person.pronouns.some((form) => said.has(form) && unshared(form)),
    )
    .map((person) => person.member);
}

export interface CgSubject {
  person: CgPerson;
  /** Whose likeness the reference keeps; none for someone the story only names. */
  image?: ImageSubject;
  /** The painted look they wear, if any: their last-resort reference beside others (cgSubjects). */
  wornUrl?: string;
  /** Only named, by a name several people share (resolveCast). */
  ambiguous?: true;
}

/**
 * The CG's people, in the brief's order: a love interest, the protagonist, or someone only named (at most
 * CG_PEOPLE_MAX), each matched by resolveCast. A story key image (`scene`) whose cast names nobody takes them from its
 * brief (briefCast). Alone, a person is sent as who they are and the look they wear (two references). With others,
 * each person is ONE reference (two full-body pictures of each person in the same standing pose made the model merge
 * bodies and draw extra limbs, the maintainer's report, 2026-11-03): who they are (their card or persona avatar, else
 * their setup portrait), and only when none of that loads, the look they wear; the prompt dresses them in it
 * (`outfitInText`).
 */
export function cgSubjects(
  cast: readonly string[],
  units: readonly Unit[],
  player: Player,
  scene?: { present: readonly string[]; brief: string },
): CgSubject[] {
  const subjects = castSubjects(cast, units, player, scene);
  if (subjects.length < 2) return subjects;
  return subjects.map((subject) => {
    if (!subject.image?.wornOutfit) return subject;
    const { wornOutfit: _worn, outfits: _outfits, ...identity } = subject.image;
    return {
      ...subject,
      person: { ...subject.person, outfitInText: true },
      image: { ...identity, ...(subject.wornUrl ? { avatarPath: subject.wornUrl } : {}) },
    };
  });
}

/** Whether the kit can find a picture of this subject for sure (a card, a portrait or a look), or only maybe. */
const likenessOf = (image: ImageSubject): "sure" | "maybe" | "none" =>
  image.cardId || image.portrait || image.avatarPath ? "sure" : image.personaId || image.wornOutfit ? "maybe" : "none";

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

/** Logs, at a paid paint, each person the brief names whom no love interest or the protagonist answers to. */
export function warnUnmatched(
  logger: Pick<ArtDeps["runtime"]["logger"], "warn">,
  label: string,
  subjects: readonly CgSubject[],
): void {
  for (const { image, ambiguous, person } of subjects) {
    if (image) continue;
    logger.warn(
      ambiguous
        ? '[otome-forge] %s: "%s" could be more than one person; painted without a reference'
        : '[otome-forge] %s: "%s" is no love interest or protagonist; painted without a reference',
      label,
      person.name,
    );
  }
}

/** The CG's people as the brief names them, each with their likeness and the look they wear. */
function castSubjects(
  cast: readonly string[],
  units: readonly Unit[],
  player: Player,
  scene?: { present: readonly string[]; brief: string },
): CgSubject[] {
  const resolved = resolveCast(cast, units, player, scene?.present);
  const members = resolved.length || !scene ? resolved : briefCast(scene.brief, units, player, scene.present);
  return members.slice(0, CG_PEOPLE_MAX).map((member): CgSubject => {
    if ("li" in member) {
      const unit = member.li;
      // The look worn now dresses them in the CG: its outfit line in the prompt, its image after the faces.
      const worn = unit.wornOutfit ? unit.outfits.find((outfit) => outfit.id === unit.wornOutfit) : undefined;
      return {
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
          who: unit.name,
        },
        ...(worn?.url ? { wornUrl: worn.url } : {}),
      };
    }
    if ("player" in member) {
      const worn = player.wornOutfit ? player.outfits.find((outfit) => outfit.id === player.wornOutfit) : undefined;
      const name = player.name || "Protagonist";
      return {
        person: {
          name,
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
          who: name,
        },
        ...(worn?.url ? { wornUrl: worn.url } : {}),
      };
    }
    return {
      person: { name: member.name, identityLine: "", outfitLine: "", presentation: "person" },
      ...(member.ambiguous ? { ambiguous: true as const } : {}),
    };
  });
}

/** The CG prompt for the stored beat, and who is in it. */
async function buildCg(deps: ArtDeps, runId: string, beat: Beat, edited: Partial<ImagePrompt> = {}) {
  const run = await readRun(deps.store, runId);
  if (!run) throw runNotFound();
  run.player = await withPersonaImageAppearance(deps.runtime, run.player);
  const cg = beat.cg;
  if (!cg) throw noCg();
  // The node's love interests settle a name several share, and stand in for a cast that names nobody.
  const present = (await readChapter(deps.store, runId, beat.key))?.nodes[beat.i]?.cast ?? [];
  const subjects = cgSubjects(cg.cast, run.units, run.player, { present, brief: cg.brief });
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
      warnUnmatched(deps.runtime.logger, `cg ${albumKey(beat.key, beat.i)}`, built.subjects);
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
