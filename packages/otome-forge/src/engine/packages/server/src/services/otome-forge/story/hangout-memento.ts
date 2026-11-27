// ──────────────────────────────────────────────
// Otome Hearth: a hangout's memento (#2458), painted once on the player's tap, as a date's keepsake is
// ──────────────────────────────────────────────
// POST /runs/:run/hangouts/:key/memento/prompt → the prompt its paint would send (the review dialog shows it).
// POST /runs/:run/hangouts/:key/memento        → its paint: a ready one is returned as it is, one already running is a
//      409 `busy`, and a failed or stopped one is painted again. Only once the hangout is read to its end.
// The picture is the plan's memento brief (S/prompts.ts keepsakePrompt) with the first two friends who came and the
// protagonist, each by their likeness (S/art/cg.ts cgSubjects), as a date's keepsake (S/minigames/date-night.ts). Its
// record is kept on the chapter (`friendStory.memento.art`); the Album's Hangouts tab shows it.
// #2504: his selfie in Messages (S/phone/selfie.ts) is painted by the same paintOnce, with paintView.
import type { Chapter, Paint, World } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { cgReferences, cgSubjects, outfitCutouts } from "../art/cg.js";
import {
  galleryRef,
  imageConnectionFor,
  worldStyle,
  type ImageSubject,
  type StyleProfile,
} from "../art/image-client.js";
import { imagesOf, type ArtDeps } from "../art/paint.js";
import { OtomeForgeError } from "../http.js";
import { chapterId, runDocTarget } from "../ids.js";
import { SCENE_SIZE, keepsakePrompt, wornOutfitLine, type ImagePrompt } from "../prompts.js";
import { withPersonaImageAppearance } from "../setup/cast.js";
import { readRun } from "../schemas/state.js";
import { normalizeChapter } from "../schemas/story.js";
import type { OtomeStore } from "../store.js";
import { readChapter } from "./canon.js";
import { ME, chapterEndLooks, dressed, lookOf } from "./scene-looks.js";

type MementoDeps = ArtDeps & { store: OtomeStore };

const notFound = () => new OtomeForgeError(404, "No such hangout.", "not-found");
/** The pictures paintOnce is painting in this process, by their claim (`${runId}|memento:${key}` and the like). */
const painting = new Set<string>();
const paintKey = (runId: string, key: string) => `${runId}|memento:${key}`;

/** A record as the client should see it: pending with no live paint of `claim` here (a restart) reads as stopped. */
export function paintView(claim: string, art: Paint | undefined): Paint | undefined {
  return art?.state === "pending" && !painting.has(claim) ? { ...art, state: "stopped" } : art;
}

/** The memento's record as the client should see it (paintView). */
export const mementoView = (runId: string, key: string, art: Paint | undefined) => paintView(paintKey(runId, key), art);

/** What paintOnce paints, read once it holds the claim. */
export interface PaintJob {
  world: Pick<World, "images">;
  /** The record as stored now. */
  art: Paint | undefined;
  /** For the Engine's override, matched as `avatar:<slug of the first person's first name>`. */
  name: string;
  units: ImageSubject[];
  prompt: (style: StyleProfile) => ImagePrompt;
  size: { width: number; height: number };
  /** Saves the record; null when what keeps it is gone (the run was deleted), then `gone()` is thrown. */
  save: (art: Paint) => Promise<unknown>;
  gone: () => OtomeForgeError;
  /** What is painted, for the log. */
  label: string;
}

/**
 * One picture painted once, as `claim` in this process (another while it is held is a 409 `busy`): what `load` reads,
 * on the Scene art connection (#2465). A ready one is returned as it is, and a failed or stopped one is painted again:
 * pending, then ready, or failed with the provider's words. An image nothing refers to once it is painted (the run is
 * gone) is deleted from the gallery again.
 */
export async function paintOnce(
  deps: ArtDeps,
  claim: string,
  busy: string,
  load: () => Promise<PaintJob>,
  debugMode: boolean,
): Promise<Paint> {
  if (painting.has(claim)) throw new OtomeForgeError(409, busy, "busy");
  painting.add(claim);
  try {
    const job = await load();
    if (job.art?.state === "ready") return job.art;
    const connectionId = imageConnectionFor(job.world.images, "scene");
    if (!connectionId) throw new OtomeForgeError(503, "This world has no image connection.", "no-connection");
    const images = imagesOf(deps);
    const built = job.prompt(await worldStyle(images, job.world.images, "scene"));
    if (!(await job.save({ state: "pending", at: new Date().toISOString() }))) throw job.gone();
    let painted: { url: string; id?: string };
    try {
      painted = await images.generateBannerArt({
        connectionId,
        name: job.name,
        units: job.units,
        prompt: built.prompt,
        negativePrompt: built.negativePrompt,
        ...job.size,
        debugMode,
      });
    } catch (error) {
      const message = (error instanceof Error ? error.message : String(error)).slice(0, 300);
      deps.runtime.logger.warn("[otome-forge] painting %s failed: %s", job.label, message);
      const failed: Paint = { state: "failed", at: new Date().toISOString(), error: message };
      await job.save(failed);
      return failed;
    }
    const ref = painted.id ? galleryRef(painted.id) : undefined;
    const ready: Paint = { state: "ready", at: new Date().toISOString(), url: painted.url, ...(ref ? { ref } : {}) };
    let saved: unknown = null;
    try {
      saved = await job.save(ready);
    } finally {
      // Nothing refers to the new image (the run or what keeps it is gone): remove it rather than leave it in the gallery.
      if (!saved && painted.id) await images.deleteGalleryImage(painted.id);
    }
    if (!saved) throw job.gone();
    return ready;
  } finally {
    painting.delete(claim);
  }
}

/** Who the memento shows and how: the hangout, its first two friends and the protagonist (three people at most). */
async function mementoSubject(deps: MementoDeps, runId: string, key: string) {
  const [run, chapter] = await Promise.all([readRun(deps.store, runId), readChapter(deps.store, runId, key)]);
  if (!run) throw new OtomeForgeError(404, "No such Otome Hearth story.", "not-found");
  const story = chapter?.friendStory;
  if (!chapter || story?.kind !== "hangout" || !story.memento) throw notFound();
  if (!run.state.chapters[key]?.completed) {
    throw new OtomeForgeError(409, "A memento is painted once the hangout is over.", "conflict");
  }
  // #2509: she wears the look the hangout ended in (S/story/scene-looks.ts), its picture her reference.
  const ended = await chapterEndLooks(deps.store, runId, chapter);
  run.player = await withPersonaImageAppearance(
    deps.runtime,
    ended ? dressed(run.player, lookOf(ended, ME)) : run.player,
  );
  const company = story.friends
    .slice(0, 2)
    .flatMap((id) => (run.friends ?? []).filter((unit) => unit.id === id && unit.friend));
  if (!company.length) throw notFound();
  const people = [
    ...company.map((member) => ({
      name: member.name,
      identityLine: member.identityLine || member.friend!.look.identityLine,
      outfitLine: wornOutfitLine(member) || member.outfitLine || member.friend!.look.outfitLine,
      presentation: member.friend!.look.presentation,
    })),
    {
      name: run.player.name || "Protagonist",
      identityLine: run.player.look.identityLine,
      outfitLine: wornOutfitLine(run.player) || run.player.look.outfitLine,
      presentation: run.player.look.presentation,
    },
  ];
  const subjects = await outfitCutouts(
    deps,
    runId,
    cgSubjects([...company.map((member) => member.id), "protagonist"], company, run.player),
  );
  const { units, labels } = cgReferences(subjects);
  return {
    run,
    chapter,
    brief: story.memento.brief,
    art: story.memento.art,
    first: company[0]!,
    people: people.map((person, index) =>
      subjects[index]?.person.outfitPictured ? { ...person, outfitPictured: true } : person,
    ),
    units,
    references: labels,
  };
}

/** POST /runs/:run/hangouts/:key/memento/prompt */
export async function mementoPromptFor(
  deps: MementoDeps,
  runId: string,
  key: string,
  edited: Partial<ImagePrompt> = {},
): Promise<ImagePrompt> {
  const { run, brief, people, references } = await mementoSubject(deps, runId, key);
  const style = await worldStyle(imagesOf(deps), run.world.images, "scene");
  return keepsakePrompt({ brief, people, world: run.world, style, references }, edited);
}

/** Saves the memento's record on the hangout's chapter; null when the chapter is gone (the run was deleted). */
function saveMemento(deps: MementoDeps, runId: string, key: string, art: Paint): Promise<Chapter | null> {
  return deps.store.updateDoc(runDocTarget("chapter", chapterId(runId, key)), normalizeChapter, (current) => {
    const story = current?.friendStory;
    if (!current || !story?.memento) throw notFound();
    return { ...current, friendStory: { ...story, memento: { ...story.memento, art } } };
  });
}

/** POST /runs/:run/hangouts/:key/memento (see the header). */
export function paintMemento(
  deps: MementoDeps,
  runId: string,
  key: string,
  { prompt, negativePrompt, debugMode }: Partial<ImagePrompt> & { debugMode: boolean },
): Promise<Paint> {
  return paintOnce(
    deps,
    paintKey(runId, key),
    "This memento is already being painted.",
    async () => {
      const { run, brief, art, first, people, units, references } = await mementoSubject(deps, runId, key);
      return {
        world: run.world,
        art,
        name: first.name.split(/\s+/)[0] || "Memento",
        units,
        prompt: (style) =>
          keepsakePrompt({ brief, people, world: run.world, style, references }, { prompt, negativePrompt }),
        size: SCENE_SIZE,
        save: (paint) => saveMemento(deps, runId, key, paint),
        gone: notFound,
        label: `the memento of ${key}`,
      };
    },
    debugMode,
  );
}
