// ──────────────────────────────────────────────
// Otome Forge: the five faces (plan M2b "Expressions"), and the art service the beat writer calls
// ──────────────────────────────────────────────
// The kit's createForgeStoryExpressions paints, for each love interest who speaks in a beat, his five faces (SH/faces.ts:
// tender, flustered, cold, hurt, angry) as edits of his look, in the background and in the image connection's low
// lane, so places, CGs and taps go first; a new story's (the forge's, #2448) take the high lane, so each love interest's
// faces come right after his portrait instead of behind the prologue's scene art. Its rules hold as they are: a set is
// marked pending before its first paid image and each face is filed as it lands; a failed set, or one a restart left
// pending, is never repainted until expressions are turned on again after it (images.expressionsSince), and then only
// its missing faces; turning expressions off parks the set as stopped before the next paid call. Only love interests
// get faces in R1, so the cast holds no protagonist. Every face carries the world's image rating and an adult tag (S/prompts.ts expressionPrompt).
//
// The kit builds one paint per unit; its client is made per run here, so each face's prompt reads that run's world
// (rating, style) right before the call. createOtomeArt is created once per activation: queueExpressions after each
// beat is served, queueScenePaints for a beat's places and CG once written and prepareSceneCg for a CG still without
// a record once served (art/cg.ts), dispose on teardown, after which nothing more is paid for. queueStickers (#2044, art/stickers.ts) runs
// each run's sticker chain from GET /runs/:run.
// 0.46.3: Repaint expressions is told once its set is scheduled (`started`), so its route answers then and the five
// faces paint on in the background; the set is live as `faces:<li>` (S/art/paint.ts startPaint) until it settles, and
// facesView shows Your cast its replacement painting, stopped by a restart, or failed.
import { AsyncLocalStorage } from "node:async_hooks";
import { createForgeStoryExpressions, type ForgeStoryExpressions } from "@forge-kit/story-expressions-server.mjs";
import type { Beat, Paint, Unit, World } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { FACE_LOOKS, FACES, type Face } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import { OTOME_FORGE_PACKAGE_ID, runDocTarget, stateId, unitId, worldId } from "../ids.js";
import { OtomeForgeError } from "../http.js";
import { isRecord, wornLookUrl } from "../schemas/common.js";
import { normalizeUnit } from "../schemas/unit.js";
import { normalizeState, readCastUnits, readFriendUnits } from "../schemas/state.js";
import { normalizeWorld } from "../schemas/world.js";
import { queueScenePaints, releaseBeatArt, startBeatCg } from "./cg.js";
import { engineArtPath } from "./engine-art.js";
import { galleryRef, worldStyle, type GeneratedImage } from "./image-client.js";
import {
  imagesOf,
  paintIsLive,
  paintSlot,
  startPaint,
  updateIfChanged,
  type ArtDeps,
  type PaintLane,
} from "./paint.js";
import { paintBeatPlaces, type PaintOptions } from "./places.js";
import { type ImagePrompt, LOOK_SIZE, expressionPrompt } from "../prompts.js";
import { queueStickers, type StickerQueueOptions } from "./stickers.js";

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
  if (!base || !engineArtPath(base)) throw new OtomeForgeError(409, "Paint this look first.", "conflict");
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
  /**
   * Explicitly replaces the current look's five faces, preserving its usable set until completion. `started` (0.46.3)
   * is told once the set is scheduled, before any paid image.
   */
  repaintExpressions(
    runId: string,
    li: string,
    options: { debugMode: boolean; base?: string; prompts?: ExpressionPrompts; started?: (record: Paint) => void },
  ): Promise<Paint>;
  /**
   * Queues the five faces of every love interest who speaks in `beat` whose current look has no ready set. Returns at
   * once; painting happens in the background. Call it each time a beat is served (written or read from the store).
   * Faces wait in the `low` lane behind places and CGs; #2448: the forge asks for `high`, so a new story's love
   * interests get their faces right after their portraits.
   */
  queueExpressions(runId: string, beat: ExpressionBeat, options: { debugMode: boolean; lane?: PaintLane }): void;
  /**
   * Paints the beat's new places and its CG in the background, or leaves them waiting for the tap (Ask before
   * painting, or `review`). The beat writer calls it with the places once a beat is written or rewritten; do not await
   * it. It never rejects.
   */
  queueScenePaints(runId: string, beat: Beat, options: Omit<PaintOptions, "active">): Promise<void>;
  /** Called outside the run queue before a fresh scene answers; only registration is awaited, never paid images. */
  prepareScenePlaces?(runId: string, beat: Beat, options: Omit<PaintOptions, "active">): Promise<void>;
  /**
   * Called as a beat being read is served: writes its CG's record (pending, or waiting for the tap) and resolves the
   * beat with it, the paid paint going on in the background. A CG with a record is left as it is; it never rejects.
   */
  prepareSceneCg?(runId: string, beat: Beat, options: Omit<PaintOptions, "active">): Promise<Beat>;
  /**
   * #2044: paints the run's owed stickers one at a time in the background (or leaves them waiting for the tap). Call
   * it on each read of the run; it never rejects, and resolves once the chain ends.
   */
  queueStickers?(runId: string, options: Omit<StickerQueueOptions, "active">): Promise<void>;
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

/**
 * 0.46.3: Repaint expressions for his current look as Your cast shows it: pending while it is live here (from before
 * the kit writes its replacement set), `stopped` once a restart left that set pending, `stopped` or `failed` with the
 * reason once it did not land, or undefined when none was asked or it landed (the kit's record keeps the replacement
 * only until then).
 */
export function facesView(
  runId: string,
  unit: Pick<Unit, "id" | "portrait" | "outfits" | "wornOutfit" | "expressions">,
): Paint | undefined {
  if (paintIsLive(runId, `faces:${unit.id}`)) return { state: "pending", at: "" };
  const record = unit.expressions[baseOf(unit)];
  const replacement = isRecord(record) && isRecord(record.replacement) ? record.replacement : null;
  const state = replacement?.state;
  if (!replacement || (state !== "pending" && state !== "stopped" && state !== "failed")) return undefined;
  return {
    state: state === "failed" ? "failed" : "stopped",
    at: typeof replacement.at === "string" ? replacement.at : "",
    ...(typeof replacement.error === "string" ? { error: replacement.error.slice(0, 300) } : {}),
  };
}

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
  /**
   * The sets (by the kit's dedupe key) queued in the `high` lane, until their job starts. ponytail: a set the kit then
   * declines to paint (already ready, or failed) keeps its mark, so that unit's next set paints high once; a mark per
   * look is the upgrade if that ever matters.
   */
  const urgent = new Set<string>();
  /** The lane of the set being painted, read by each of its faces' slots. */
  const lane = new AsyncLocalStorage<PaintLane>();
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
        // #2458: her friends' faces are painted as the love interests' are.
        async list() {
          const state = await store.readDoc(stateId(runId), normalizeState);
          const [cast, friends] = await Promise.all([
            readCastUnits(store, runId, state),
            readFriendUnits(store, runId, state),
          ]);
          return [...cast, ...friends].map((unit) => ({ id: unitId(runId, unit.id), data: unit }));
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
      slot: (target, task) => paintSlot(target.id, task, lane.getStore() ?? "low"),
      dedupe(key, task) {
        const high = urgent.delete(key);
        const current = running.get(key) as ReturnType<typeof task> | undefined;
        if (current) return current;
        const started = lane.run(high ? "high" : "low", task).finally(() => running.delete(key));
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
      // #2147: an Engine sprite base too, so only its missing faces are painted (S/art/engine-art.ts).
      localAvatarPath: engineArtPath,
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
      // The same set asked for again shares the one paint (the kit's schedule), and is live once.
      const release = startPaint(runId, `faces:${li}`);
      if (release) void Promise.resolve(pending).finally(release);
      options.started?.({ state: "pending", at: new Date().toISOString() });
      return (await pending) ?? { state: "stopped", at: new Date().toISOString() };
    },
    queueExpressions(runId, beat, options) {
      if (disposed) return;
      debugMode.set(runId, options.debugMode);
      void (async () => {
        const run = await readRun(runId);
        if (!run || disposed) return;
        // The love interests and (#2458) her friends: the kit matches each line's speaker to these names.
        const units = [...(await readCastUnits(store, runId)), ...(await readFriendUnits(store, runId))];
        if (options.lane === "high" && run.world.images.expressions) {
          const speakers = new Set(beat.segments.map((segment) => segment.speaker));
          // The kit's dedupe key for a unit's set (createForgeStoryExpressions schedule).
          for (const unit of units) if (speakers.has(unit.name)) urgent.add(`${unitId(runId, unit.id)}:expressions`);
        }
        expressionsOf(runId).queue(
          runId,
          run,
          units.map((unit) => ({ name: unit.name })),
          beat,
        );
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
    prepareSceneCg: async (runId, beat, options) =>
      disposed ? beat : (await startBeatCg(deps, runId, beat, { ...options, active })).beat,
    releaseBeatArt: (runId, beat) => releaseBeatArt(deps, runId, beat),
    queueStickers: (runId, options) =>
      disposed ? Promise.resolve() : queueStickers(deps, runId, { ...options, active }),
    active,
    dispose() {
      disposed = true;
      for (const expressions of runs.values()) expressions.dispose();
      runs.clear();
    },
  };
}
