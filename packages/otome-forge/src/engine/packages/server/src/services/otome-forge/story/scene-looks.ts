// ──────────────────────────────────────────────
// Otome Hearth: the looks people wear in a chapter's scenes (#2509)
// ──────────────────────────────────────────────
// Wear at home dresses someone on Home only. In the story, a chapter's first scene picks, for the protagonist and every
// love interest in it, the looks its scenes may put them in (`Chapter.wardrobe.offered`): the everyday look, the look
// they start in, and, at random among the painted looks they own, up to SCENE_LOOKS of each rarity. The pick is saved
// on the chapter, as its small memories are, so every scene of it sends the same lists (the prompt cache holds).
// They start in what they wore as the chapter the story memory sends in full ended (its saved start and its scenes'
// changes), with no record kept per person. A date or a hangout dresses her in the look picked for it and its love
// interests in their everyday looks (they choose their own in its first scene); a 5★ look's first-wear scene dresses its
// wearer in that look; his side dresses everyone as in the scene it retells. A chapter already under way when its lists
// were first picked starts in what everyone wore at home, which its earlier scenes were written with. A scene's `wear`
// (P6) changes someone's look for that scene and the ones after it. Each offered look is added to its wearer's outfits
// (as Wear at home adds it), so it can stand on stage, be cut out and get its faces.
// The story's helpers read the look someone wears from `wornOutfit` (appearanceLine, cgSubjects, wornLookUrl): `dressed`
// hands them the person with the scene's look there instead, and nothing is written.
import type { Beat, Chapter, LiId, Outfit } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import {
  BASE_LOOK,
  SCENE_LOOKS,
  type ChapterWardrobe,
  type WardrobeOwner,
} from "../../../../../client/src/features/otome-forge/shared/wardrobe.js";
import { ITEM_RARITY, type Item, type Rarity } from "../../../../../client/src/features/otome-forge/shared/wish.js";
import { addOutfit, lookWearer, outfitOf } from "../art/outfits.js";
import { chapterId, isItemStoryKey, runDocTarget } from "../ids.js";
import { readItems } from "../items/open.js";
import type { RunDocuments } from "../schemas/state.js";
import { normalizeChapter } from "../schemas/story.js";
import type { OtomeStore } from "../store.js";
import { readBeat, readChapter } from "./canon.js";
import { momentBeat, momentChapterKey } from "./his-side.js";

/** The protagonist's key in a wardrobe (WardrobeOwner), beside the love interests' ids. */
export const ME: WardrobeOwner = "me";

type Looks = Record<string, string>;

/** The look `who` wears in `looks`: their everyday one when it names none. */
export const lookOf = (looks: Readonly<Looks>, who: string) => looks[who] ?? BASE_LOOK;

/**
 * `person` as the story sees them in `look`: their worn outfit is that look, or none for the everyday look (or a look
 * not among their outfits). Nothing is written; Home still shows what they wear there.
 */
export function dressed<T extends { outfits: readonly Outfit[]; wornOutfit?: string }>(person: T, look: string): T {
  if (look !== BASE_LOOK && person.outfits.some((outfit) => outfit.id === look)) {
    return person.wornOutfit === look ? person : { ...person, wornOutfit: look };
  }
  if (!person.wornOutfit) return person;
  const { wornOutfit: _worn, ...rest } = person;
  return rest as T;
}

/** The run's love interests and protagonist dressed in `looks` (null: as they are, for a chapter with no wardrobe). */
export function dressRun<T extends Pick<RunDocuments, "units" | "player">>(run: T, looks: Readonly<Looks> | null): T {
  if (!looks) return run;
  return {
    ...run,
    units: run.units.map((unit) => dressed(unit, lookOf(looks, unit.id))),
    player: dressed(run.player, lookOf(looks, ME)),
  };
}

/** `run` with the outfits of `fresh`, the same run read again after a wardrobe added its looks to them. */
export function withOutfits<T extends Pick<RunDocuments, "units" | "player">>(
  run: T,
  fresh: Pick<RunDocuments, "units" | "player"> | null,
): T {
  if (!fresh) return run;
  return {
    ...run,
    player: { ...run.player, outfits: fresh.player.outfits },
    units: run.units.map((unit) => ({
      ...unit,
      outfits: fresh.units.find((entry) => entry.id === unit.id)?.outfits ?? unit.outfits,
    })),
  };
}

/** `start` with each beat's changes in order: who wears what after them. */
export function foldLooks(start: Readonly<Looks>, beats: ReadonlyArray<Pick<Beat, "wear"> | null>): Looks {
  const looks: Looks = { ...start };
  for (const beat of beats) Object.assign(looks, beat?.wear ?? {});
  return looks;
}

/** Who wears what during beat `i` (its own change included), or null for a chapter with no wardrobe. */
export async function beatLooks(
  store: Pick<OtomeStore, "readDoc">,
  runId: string,
  chapter: Pick<Chapter, "key" | "wardrobe">,
  i: number,
): Promise<Looks | null> {
  if (!chapter.wardrobe) return null;
  const beats = await Promise.all(Array.from({ length: i + 1 }, (_, n) => readBeat(store, runId, chapter.key, n)));
  return foldLooks(chapter.wardrobe.start, beats);
}

/** Who wears what as `chapter` ended (its last beat's looks), or null for one with no wardrobe. */
export const chapterEndLooks = (
  store: Pick<OtomeStore, "readDoc">,
  runId: string,
  chapter: Pick<Chapter, "key" | "wardrobe" | "nodes">,
) => beatLooks(store, runId, chapter, chapter.nodes.length - 1);

/** Who wears what as chapter `key` ended, or {} for one with no wardrobe or none at all. */
async function endLooks(store: Pick<OtomeStore, "readDoc">, runId: string, key: string): Promise<Looks> {
  const chapter = await readChapter(store, runId, key);
  return (chapter && (await chapterEndLooks(store, runId, chapter))) ?? {};
}

/** The painted looks `who` owns, from the items, with their rarity. */
function ownedLooks(
  items: readonly Item[],
  owned: readonly string[],
  who: string,
): Array<{ id: string; rarity: Rarity }> {
  const wearer = who === ME ? "player" : `li:${who}`;
  return items.flatMap((item) =>
    owned.includes(item.id) && lookWearer(item) === wearer && outfitOf(item)
      ? [{ id: item.id, rarity: ITEM_RARITY[item.kind] }]
      : [],
  );
}

/**
 * The looks a chapter offers someone: the everyday look, the one they start in, and at random up to SCENE_LOOKS of each
 * rarity among the rest of `looks` (the start look counts towards its own rarity).
 */
export function pickOffered(
  looks: ReadonlyArray<{ id: string; rarity: Rarity }>,
  start: string,
  random: () => number = Math.random,
): string[] {
  const begun = looks.find((look) => look.id === start);
  const picked = [BASE_LOOK, ...(begun ? [begun.id] : [])];
  for (const rarity of [3, 4, 5] as const) {
    const pool = looks.filter((look) => look.rarity === rarity && look.id !== start).map((look) => look.id);
    for (let index = pool.length - 1; index > 0; index -= 1) {
      const other = Math.floor(random() * (index + 1));
      [pool[index], pool[other]] = [pool[other]!, pool[index]!];
    }
    picked.push(...pool.slice(0, SCENE_LOOKS[rarity] - (begun?.rarity === rarity ? 1 : 0)));
  }
  return picked;
}

/** What everyone wears as the chapter opens (see the header). */
async function startLooks(
  store: Pick<OtomeStore, "readDoc">,
  runId: string,
  chapter: Chapter,
  run: Pick<RunDocuments, "units" | "player">,
  items: readonly Item[],
  { previous, underway }: { previous?: string; underway: boolean },
): Promise<Looks> {
  if (underway) {
    return Object.fromEntries([
      [ME, run.player.wornOutfit ?? BASE_LOOK],
      ...run.units.map((unit) => [unit.id, unit.wornOutfit ?? BASE_LOOK]),
    ]);
  }
  if (chapter.date) {
    // A date's love interests choose their own look in its first scene; an older Date Night evening keeps his pick.
    const his =
      chapter.date.hisLook && chapter.date.hisLook !== BASE_LOOK ? { [chapter.date.li]: chapter.date.hisLook } : {};
    return { [ME]: chapter.date.herLook || BASE_LOOK, ...his };
  }
  if (chapter.friendStory?.herLook) return { [ME]: chapter.friendStory.herLook };
  if (chapter.hisSide) {
    const key = momentChapterKey(chapter.hisSide.ref);
    const told = await readChapter(store, runId, key);
    return (told && (await beatLooks(store, runId, told, momentBeat(chapter.hisSide.ref)))) ?? {};
  }
  const carried = previous ? await endLooks(store, runId, previous) : {};
  // A 5★ look's first-wear scene is about that look: its wearer stands in it.
  const item = isItemStoryKey(chapter.key) ? items.find((entry) => `story-${entry.id}` === chapter.key) : undefined;
  const wearer = item && (item.kind === "his-look5" || item.kind === "her-look5") ? lookWearer(item) : null;
  if (item && wearer) return { ...carried, [wearer === "player" ? ME : wearer.slice(3)]: item.id };
  return carried;
}

/**
 * The chapter's wardrobe (see the header): the saved one, or picked now and saved (the first save wins, so every scene
 * sends the same). `previous` is the chapter its story memory sends in full; `underway`, that scenes of it were written
 * before it had one.
 */
export async function chapterWardrobe(
  deps: { store: OtomeStore },
  runId: string,
  chapter: Chapter,
  run: Pick<RunDocuments, "units" | "player" | "state">,
  options: { previous?: string; underway: boolean },
): Promise<ChapterWardrobe> {
  if (chapter.wardrobe) return chapter.wardrobe;
  const items = await readItems(deps.store, runId);
  const people: WardrobeOwner[] = [ME, ...new Set(chapter.nodes.flatMap((node) => node.cast as LiId[]))];
  const begun = await startLooks(deps.store, runId, chapter, run, items, options);
  const offered: Record<string, string[]> = {};
  const start: Record<string, string> = {};
  for (const who of people) {
    const looks = ownedLooks(items, run.state.owned.items, who);
    const first = lookOf(begun, who);
    start[who] = looks.some((look) => look.id === first) ? first : BASE_LOOK;
    offered[who] = pickOffered(looks, start[who]!);
  }
  // Each offered look among its wearer's outfits, as Wear at home adds it: it stands on stage and gets its faces.
  const used = new Set(Object.values(offered).flat());
  for (const item of items) if (used.has(item.id)) await addOutfit(deps, runId, item);
  const saved = await deps.store.updateDoc(
    runDocTarget("chapter", chapterId(runId, chapter.key)),
    normalizeChapter,
    (current) => (!current || current.wardrobe ? current : { ...current, wardrobe: { offered, start } }),
  );
  return saved?.wardrobe ?? { offered, start };
}

/** Whether anyone in the wardrobe may change into another look: else the scene writer is told nothing of it. */
export const anyChange = (wardrobe: ChapterWardrobe | undefined) =>
  !!wardrobe && Object.values(wardrobe.offered).some((looks) => looks.length > 1);

/** The names of `who`'s offered looks as the scene writer sees them, by look id ("everyday" for the everyday one). */
export function offeredNames(
  wardrobe: ChapterWardrobe,
  who: string,
  person: { outfits: readonly Outfit[] },
): Array<{ id: string; name: string }> {
  return (wardrobe.offered[who] ?? [BASE_LOOK]).flatMap((id) => {
    if (id === BASE_LOOK) return [{ id, name: EVERYDAY }];
    const outfit = person.outfits.find((entry) => entry.id === id);
    return outfit?.name.trim() ? [{ id, name: outfit.name.trim() }] : [];
  });
}

/** The everyday look's name in the scene writer's lists. */
export const EVERYDAY = "everyday";
