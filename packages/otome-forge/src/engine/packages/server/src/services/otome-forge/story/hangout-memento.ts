// ──────────────────────────────────────────────
// Otome Hearth: a hangout's memento (#2458), painted once on the player's tap, as a date's keepsake is
// ──────────────────────────────────────────────
// POST /runs/:run/hangouts/:key/memento/prompt → the prompt its paint would send (the review dialog shows it).
// POST /runs/:run/hangouts/:key/memento        → its paint: a ready one is returned as it is, one already running is a
//      409 `busy`, and a failed or stopped one is painted again. Only once the hangout is read to its end.
// The picture is the plan's memento brief (S/prompts.ts keepsakePrompt) with the first two friends who came and the
// protagonist, each by their likeness (S/art/cg.ts cgSubjects), as a date's keepsake (S/minigames/date-night.ts). Its
// record is kept on the chapter (`friendStory.memento.art`); the Album's Hangouts tab shows it.
import type { Chapter, Paint } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { cgReferences, cgSubjects, outfitCutouts } from "../art/cg.js";
import { galleryRef, worldStyle } from "../art/image-client.js";
import { imagesOf, type ArtDeps } from "../art/paint.js";
import { OtomeForgeError } from "../http.js";
import { chapterId, runDocTarget } from "../ids.js";
import { SCENE_SIZE, keepsakePrompt, wornOutfitLine, type ImagePrompt } from "../prompts.js";
import { withPersonaImageAppearance } from "../setup/cast.js";
import { readRun } from "../schemas/state.js";
import { normalizeChapter } from "../schemas/story.js";
import type { OtomeStore } from "../store.js";
import { readChapter } from "./canon.js";

type MementoDeps = ArtDeps & { store: OtomeStore };

const notFound = () => new OtomeForgeError(404, "No such hangout.", "not-found");
/** Mementos being painted in this process, by run and chapter. */
const painting = new Set<string>();
const paintKey = (runId: string, key: string) => `${runId}|memento:${key}`;

/** The memento's record as the client should see it: pending with no live paint here (a restart) reads as stopped. */
export function mementoView(runId: string, key: string, art: Paint | undefined): Paint | undefined {
  return art?.state === "pending" && !painting.has(paintKey(runId, key)) ? { ...art, state: "stopped" } : art;
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
  run.player = await withPersonaImageAppearance(deps.runtime, run.player);
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
  const style = await worldStyle(imagesOf(deps), run.world.images);
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
export async function paintMemento(
  deps: MementoDeps,
  runId: string,
  key: string,
  { prompt, negativePrompt, debugMode }: Partial<ImagePrompt> & { debugMode: boolean },
): Promise<Paint> {
  const { run, brief, art, first, people, units, references } = await mementoSubject(deps, runId, key);
  if (art?.state === "ready") return art;
  const connectionId = run.world.images.connectionId;
  if (!connectionId) throw new OtomeForgeError(503, "This world has no image connection.", "no-connection");
  const claim = paintKey(runId, key);
  if (painting.has(claim)) throw new OtomeForgeError(409, "This memento is already being painted.", "busy");
  painting.add(claim);
  try {
    const latest = (await readChapter(deps.store, runId, key))?.friendStory?.memento?.art;
    if (latest?.state === "ready") return latest;
    const images = imagesOf(deps);
    const style = await worldStyle(images, run.world.images);
    const built = keepsakePrompt({ brief, people, world: run.world, style, references }, { prompt, negativePrompt });
    if (!(await saveMemento(deps, runId, key, { state: "pending", at: new Date().toISOString() }))) throw notFound();
    let painted: { url: string; id?: string };
    try {
      painted = await images.generateBannerArt({
        connectionId,
        // The Engine matches the override as `avatar:<slug of the first person's first name>`.
        name: first.name.split(/\s+/)[0] || "Memento",
        units,
        prompt: built.prompt,
        negativePrompt: built.negativePrompt,
        ...SCENE_SIZE,
        debugMode,
      });
    } catch (error) {
      const message = (error instanceof Error ? error.message : String(error)).slice(0, 300);
      deps.runtime.logger.warn("[otome-forge] painting the memento of %s failed: %s", key, message);
      const failed: Paint = { state: "failed", at: new Date().toISOString(), error: message };
      await saveMemento(deps, runId, key, failed);
      return failed;
    }
    const ref = painted.id ? galleryRef(painted.id) : undefined;
    const ready: Paint = { state: "ready", at: new Date().toISOString(), url: painted.url, ...(ref ? { ref } : {}) };
    let saved: Chapter | null = null;
    try {
      saved = await saveMemento(deps, runId, key, ready);
    } finally {
      // Nothing refers to the new image (the run or the hangout is gone): remove it rather than leave it in the gallery.
      if (!saved && painted.id) await images.deleteGalleryImage(painted.id);
    }
    if (!saved) throw notFound();
    return ready;
  } finally {
    painting.delete(claim);
  }
}
