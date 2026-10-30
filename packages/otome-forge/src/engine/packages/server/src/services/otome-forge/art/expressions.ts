// ──────────────────────────────────────────────
// Otome Forge: the five faces (plan M2b "Expressions"), and the art service the beat writer calls
// ──────────────────────────────────────────────
// The kit's createForgeStoryExpressions paints, for each love interest who speaks in a beat, his five faces (SH/faces.ts:
// tender, flustered, cold, hurt, angry) as edits of his look, in the background and in the image connection's low
// lane, so places, CGs and taps go first. Its rules hold as they are: a set is marked pending before its first paid
// image and each face is filed as it lands; a failed set, or one a restart left pending, is never repainted until
// expressions are turned on again after it (images.expressionsSince), and then only its missing faces; turning
// expressions off parks the set as stopped before the next paid call. Only love interests get faces in R1, so the
// cast holds no protagonist. Every face carries the world's image rating and an adult tag (art/prompts.ts).
//
// The kit builds one paint per unit; its client is made per run here, so each face's prompt reads that run's world
// (rating, style) right before the call. createOtomeArt is created once per activation: queueExpressions after each
// beat is served, queueScenePaints after each beat is written (art/cg.ts), dispose on teardown, after which nothing
// more is paid for.
import { forgeLocalAvatarPath } from "@forge-kit/image-avatar-references.mjs";
import { createForgeStoryExpressions, type ForgeStoryExpressions } from "@forge-kit/story-expressions-server.mjs";
import type { Beat, Paint, Unit, World } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { FACE_LOOKS, FACES, type Face } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import { OTOME_FORGE_PACKAGE_ID, runDocTarget, unitId, worldId } from "../ids.js";
import { OtomeForgeError } from "../http.js";
import { wornLookUrl } from "../schemas/common.js";
import { normalizeUnit } from "../schemas/unit.js";
import { normalizeWorld } from "../schemas/world.js";
import { queueScenePaints, releaseBeatArt } from "./cg.js";
import { galleryRef, worldStyle, type GeneratedImage } from "./image-client.js";
import { imagesOf, paintSlot, updateIfChanged, type ArtDeps } from "./paint.js";
import { paintBeatPlaces, type PaintOptions } from "./places.js";
import { LOOK_SIZE, expressionPrompt, type ImagePrompt } from "./prompts.js";

export type ExpressionPrompts = Partial<Record<Face, ImagePrompt>>;

/** Read-only preview and validation shared by explicit repaint and its prompt review. */
export async function expressionPromptsFor(deps: ArtDeps, runId: string, li: string) {
  const [world, unit] = await Promise.all([
    deps.store.readDoc(worldId(runId), normalizeWorld),
    deps.store.readDoc(unitId(runId, li), normalizeUnit),
  ]);
  if (!world || !unit) throw new OtomeForgeError(404, "No such love interest.", "not-found");
  if (!world.images.connectionId) throw new OtomeForgeError(503, "Choose an image connection first.", "no-connection");
  if (!world.images.expressions) throw new OtomeForgeError(409, "Turn expressions on first.", "conflict");
  const base = baseOf(unit);
  if (!base || !forgeLocalAvatarPath(base)) throw new OtomeForgeError(409, "Paint this look first.", "conflict");
  const style = await worldStyle(imagesOf(deps), world.images);
  return {
    base,
    prompts: Object.fromEntries(
      FACES.map((face) => [face, expressionPrompt({ unit, base, face, world, style })]),
    ) as Record<Face, ImagePrompt>,
  };
}

/** What the kit reads of a beat to find who speaks: its lines, its choices' branches and spoken selections. */
export type ExpressionBeat = Pick<Beat, "segments" | "choices">;

export interface OtomeArt {
  /** Explicitly replaces the current look's five faces, preserving its usable set until completion. */
  repaintExpressions(
    runId: string,
    li: string,
    options: { debugMode: boolean; base?: string; prompts?: ExpressionPrompts },
  ): Promise<Paint>;
  /**
   * Queues the five faces of every love interest who speaks in `beat` whose current look has no ready set. Returns at
   * once; painting happens in the background. Call it each time a beat is served (written or read from the store).
   */
  queueExpressions(runId: string, beat: ExpressionBeat, options: { debugMode: boolean }): void;
  /**
   * Paints the beat's new places and its CG in the background, or leaves them waiting for the tap (Ask before
   * painting, or `review`). Call it once after a beat is written or rewritten; do not await it. It never rejects.
   */
  queueScenePaints(runId: string, beat: Beat, options: Omit<PaintOptions, "active">): Promise<void>;
  /** Called outside the run queue before a fresh scene answers; only registration is awaited, never paid images. */
  prepareScenePlaces?(runId: string, beat: Beat, options: Omit<PaintOptions, "active">): Promise<void>;
  /** A beat replaced by a rewrite or removed: deletes its CG's gallery image unless the album keeps it. */
  releaseBeatArt(runId: string, beat: Pick<Beat, "cg">): Promise<void>;
  /** False once torn down: an item's paint (M4, S/art/outfits.ts) still waiting in its lane stops before its paid call. */
  active(): boolean;
  /** Package teardown: queued faces and scene paints stop before their paid call. */
  dispose(): void;
}

interface ExpressionRun {
  world: World;
}

/** The base a love interest's faces are painted on: the look he wears (M4), else his portrait. */
const baseOf = (unit: Pick<Unit, "portrait" | "outfits" | "wornOutfit"> | null | undefined) =>
  unit ? wornLookUrl(unit) : "";

/** The kit's view of a world's images: on only with a connection, at the look's size. */
const imagesOfRun = (run: ExpressionRun) => ({
  ...run.world.images,
  off: !run.world.images.connectionId,
  portraitWidth: LOOK_SIZE.width,
  portraitHeight: LOOK_SIZE.height,
});

export function createOtomeArt(deps: ArtDeps): OtomeArt {
  const { runtime, store } = deps;
  const runs = new Map<string, ForgeStoryExpressions>();
  /** The debugMode of each run's latest request: the faces it queued log their prompts in debug mode. */
  const debugMode = new Map<string, boolean>();
  const running = new Map<string, Promise<unknown>>();
  let disposed = false;
  const active = () => !disposed;
  const images = imagesOf(deps);

  const readRun = async (runId: string): Promise<ExpressionRun | null> => {
    const world = await store.readDoc(worldId(runId), normalizeWorld);
    return world ? { world } : null;
  };

  /** The kit's expressions for one run: its client builds each face's prompt from that run's world. */
  function expressionsOf(runId: string): ForgeStoryExpressions {
    let expressions = runs.get(runId);
    if (expressions) return expressions;
    const client = {
      async generateExpression(request: Record<string, unknown>) {
        const world = await store.readDoc(worldId(runId), normalizeWorld);
        if (!world) throw new Error("the story was deleted");
        const style = await worldStyle(images, world.images);
        const unit = normalizeUnit(request.unit);
        const { prompt, negativePrompt } = expressionPrompt({
          unit,
          base: String(request.base ?? ""),
          face: request.expression as Face,
          world,
          style,
          edited: request.edited as Partial<ImagePrompt> | undefined,
        });
        const image: GeneratedImage = await images.generateImage({
          connectionId: String(request.connectionId),
          name: unit.name || "Character",
          prompt,
          negativePrompt,
          width: Number(request.width) || LOOK_SIZE.width,
          height: Number(request.height) || LOOK_SIZE.height,
          debugMode: request.debugMode === true,
          referenceImages: [String(request.referenceImage)],
        });
        return { ...image };
      },
      uploadToGallery: (request: Record<string, unknown>) =>
        images.uploadToGallery(request as unknown as Parameters<typeof images.uploadToGallery>[0]),
      deleteGalleryImage: (id: string) => images.deleteGalleryImage(id),
      cardAvatarImage: (path: string) => images.cardAvatarImage(path),
      personaAvatar: (personaId: string) => images.personaAvatar(personaId),
    };
    expressions = createForgeStoryExpressions({
      documents: {
        async getById(_packageId, id) {
          const unit = await store.readDoc(id, normalizeUnit);
          return unit ? { id, data: unit } : null;
        },
        async list() {
          return (await store.listRun("unit", runId)).map((record) => ({
            id: record.id,
            data: normalizeUnit(record.data),
          }));
        },
      },
      packageId: OTOME_FORGE_PACKAGE_ID,
      logger: runtime.logger,
      readRun,
      images: (run) => imagesOfRun(run as ExpressionRun),
      async connection(run) {
        const id = (run as ExpressionRun).world.images.connectionId;
        return id ? { id, provider: "image_generation", model: "" } : null;
      },
      client: () => client,
      slot: (target, task) => paintSlot(target.id, task, "low"),
      dedupe(key, task) {
        const current = running.get(key) as ReturnType<typeof task> | undefined;
        if (current) return current;
        const started = task().finally(() => running.delete(key));
        running.set(key, started);
        return started;
      },
      background: (task) => task(),
      // The kit's change edits a copy, and often leaves it as it was (a set it no longer owns): then nothing is written.
      update: async (unitId, change) =>
        (
          await updateIfChanged(store, runDocTarget("unit", unitId), normalizeUnit, (current) => {
            const next = structuredClone(current);
            change(next);
            return JSON.stringify(next) === JSON.stringify(current) ? undefined : next;
          })
        )?.value ?? null,
      base: baseOf,
      galleryRef,
      debug: () => debugMode.get(runId) === true || runtime.isDebugAgentsEnabled(),
      names: FACES,
      looks: FACE_LOOKS,
      localAvatarPath: forgeLocalAvatarPath,
      logPrefix: "[otome-forge]",
      scopeName: "otome-forge-expressions",
    });
    runs.set(runId, expressions);
    return expressions;
  }

  return {
    async repaintExpressions(runId, li, options) {
      if (disposed) throw new OtomeForgeError(409, "The art service has stopped.", "conflict");
      const preview = await expressionPromptsFor(deps, runId, li);
      if (options.base !== undefined && options.base !== preview.base)
        throw new OtomeForgeError(409, "The current look changed. Review its expressions again.", "conflict");
      debugMode.set(runId, options.debugMode);
      const pending = expressionsOf(runId).repaint(runId, unitId(runId, li), preview.base, options.prompts);
      if (!pending)
        throw new OtomeForgeError(409, "This character's expressions are already being painted.", "conflict");
      return (await pending) ?? { state: "stopped", at: new Date().toISOString() };
    },
    queueExpressions(runId, beat, options) {
      if (disposed) return;
      debugMode.set(runId, options.debugMode);
      void (async () => {
        const run = await readRun(runId);
        if (!run || disposed) return;
        // Love interests only: the kit matches each line's speaker to these names.
        const cast = (await store.listRun("unit", runId)).map((record) => ({ name: normalizeUnit(record.data).name }));
        expressionsOf(runId).queue(runId, run, cast, beat);
      })().catch((error: unknown) =>
        runtime.logger.warn(
          "[otome-forge] expression portraits not queued: %s",
          error instanceof Error ? error.message : String(error),
        ),
      );
    },
    queueScenePaints: (runId, beat, options) =>
      disposed ? Promise.resolve() : queueScenePaints(deps, runId, beat, { ...options, active }),
    prepareScenePlaces: (runId, beat, options) =>
      disposed
        ? Promise.resolve()
        : paintBeatPlaces(deps, runId, beat.places, { ...options, active, registrationOnly: true }),
    releaseBeatArt: (runId, beat) => releaseBeatArt(deps, runId, beat),
    active,
    dispose() {
      disposed = true;
      for (const expressions of runs.values()) expressions.dispose();
      runs.clear();
    },
  };
}
