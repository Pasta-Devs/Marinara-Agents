// ──────────────────────────────────────────────
// Otome Hearth: his selfie in his Messages thread (#2504), painted once, as a hangout's memento is
// ──────────────────────────────────────────────
// He sends one with [selfie] or [selfie: what it shows] in a message of his own thread (S/phone/replies.ts); it rides
// on that message (`selfie`, S/phone/chat.ts). A reply to her saved while his world paints by itself holds it pending,
// and the send route paints it right after it answers (paintSelfies); any other waits for the player's Paint:
// POST /runs/:run/phone/:li/messages/:id/selfie/prompt → the prompt its paint would send (the review dialog shows it).
// POST /runs/:run/phone/:li/messages/:id/selfie        → its paint (S/story/hangout-memento.ts paintOnce): a ready one
//      is returned as it is, one being painted is a 409 `busy`, and a failed or stopped one is painted again.
// The picture is him alone, by his likeness (S/art/cg.ts cgSubjects), from what the command said it shows
// (S/prompts.ts selfiePrompt), at LOOK_SIZE, rated as a keepsake is. A message with no selfie is a 404.
import type { LiId, Paint, PhoneMessage } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { cgReferences, cgSubjects, outfitCutouts } from "../art/cg.js";
import { worldStyle } from "../art/image-client.js";
import { imagesOf, type ArtDeps } from "../art/paint.js";
import { OtomeForgeError } from "../http.js";
import { LOOK_SIZE, selfiePrompt, type ImagePrompt } from "../prompts.js";
import { paintOnce, paintView, type PaintJob } from "../story/hangout-memento.js";
import { chatTarget, loadThreadRun, normalizeThread, readThread } from "./chat.js";

const notFound = () => new OtomeForgeError(404, "No such selfie.", "not-found");
const claimOf = (runId: string, li: LiId, id: string) => `${runId}|selfie:${li}:${id}`;

/** His messages as the client should see them: a selfie pending with no live paint here (a restart) reads stopped. */
export const selfieView =
  (runId: string, li: LiId) =>
  (message: PhoneMessage): PhoneMessage => {
    const art = paintView(claimOf(runId, li, message.id), message.selfie?.art);
    return art === message.selfie?.art ? message : { ...message, selfie: { ...message.selfie!, art } };
  };

/** His selfie on message `id` of his own thread, as paintOnce paints it (`edited`: the prompt review's words). */
async function selfieJob(
  deps: ArtDeps,
  runId: string,
  li: LiId,
  id: string,
  edited: Partial<ImagePrompt> = {},
): Promise<PaintJob> {
  const { run, unit, friend } = await loadThreadRun(deps, runId, li);
  const message = (await readThread(deps.store, runId, li))?.messages.find((entry) => entry.id === id);
  const selfie = message?.who === "li" ? message.selfie : undefined;
  if (friend || !selfie) throw notFound();
  const subjects = await outfitCutouts(deps, runId, cgSubjects([li], [unit], run.player));
  const { units, labels } = cgReferences(subjects);
  const people = subjects.map((subject) => subject.person);
  return {
    world: run.world,
    art: selfie.art,
    name: unit.name.split(/\s+/)[0] || "Selfie",
    units,
    prompt: (style) =>
      selfiePrompt({ shows: selfie.brief, people, world: run.world, style, references: labels }, edited),
    size: LOOK_SIZE,
    save: (art) =>
      deps.store.updateDoc(chatTarget(runId, li), normalizeThread, (current) => {
        if (!current.messages.some((entry) => entry.id === id && entry.selfie)) throw notFound();
        return {
          ...current,
          messages: current.messages.map((entry) =>
            entry.id === id && entry.selfie ? { ...entry, selfie: { ...entry.selfie, art } } : entry,
          ),
        };
      }),
    gone: notFound,
    label: `the selfie on ${id}`,
  };
}

/** POST /runs/:run/phone/:li/messages/:id/selfie/prompt */
export async function selfiePromptFor(
  deps: ArtDeps,
  runId: string,
  li: LiId,
  id: string,
  edited: Partial<ImagePrompt> = {},
): Promise<ImagePrompt> {
  const job = await selfieJob(deps, runId, li, id, edited);
  return job.prompt(await worldStyle(imagesOf(deps), job.world.images, "scene"));
}

/** POST /runs/:run/phone/:li/messages/:id/selfie (see the header). */
export function paintSelfie(
  deps: ArtDeps,
  runId: string,
  li: LiId,
  id: string,
  { prompt, negativePrompt, debugMode }: Partial<ImagePrompt> & { debugMode: boolean },
): Promise<Paint> {
  return paintOnce(
    deps,
    claimOf(runId, li, id),
    "This selfie is already being painted.",
    () => selfieJob(deps, runId, li, id, { prompt, negativePrompt }),
    debugMode,
  );
}

/**
 * Paints, in the background, each selfie of `messages` (a send's result in his thread) saved pending with no paint
 * of it live here; one that cannot be painted is logged. The claim is taken before this returns, so the thread's next
 * read already sees it painting.
 */
export function paintSelfies(
  deps: ArtDeps,
  runId: string,
  li: LiId,
  messages: readonly PhoneMessage[],
  debugMode: boolean,
): void {
  for (const message of messages) {
    const art = message.selfie?.art;
    // Saved pending, with no paint of it live here yet.
    if (art?.state !== "pending" || paintView(claimOf(runId, li, message.id), art)?.state !== "stopped") continue;
    paintSelfie(deps, runId, li, message.id, { debugMode }).catch((error: unknown) =>
      deps.runtime.logger.warn(
        "[otome-forge] The selfie on %s was not painted: %s",
        message.id,
        error instanceof Error ? error.message : String(error),
      ),
    );
  }
}
