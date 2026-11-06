// ──────────────────────────────────────────────
// Otome Hearth: each love interest's own Claw Machine plush, the animal that fits them, drawn as SVG (#1954), and their
// Shop figurine, drawn the same way (#2128)
// ──────────────────────────────────────────────
// A love interest's plush is the animal that fits them best, in their colours (a cyan raven with red eyes, a black cat
// with violet eyes), drawn once as a small SVG by the Planning connection and kept on their unit (`plushArt`).
//
// It is written as a background "ensure" job, as Home's line packs are (S/home/lines.ts): queued when GET /play finds a
// love interest with a bible and no plush, one job per love interest keyed by their unit. The job reads everything
// again when it runs and never replaces a plush that exists. A failed job is dropped by the queue, and that love
// interest is left alone for PLUSH_RETRY_MS. Until a plush exists, and if it never does, theirs wears their look in a
// round frame, as before (C/components/PlushShelf.tsx). The model's SVG passes S/art/plush-svg.ts's allow-list before
// it is kept, and again on every read.
// A figurine (#2128) is the same kind of job, keyed `${unitId}#figurine` and kept as `figurineArt`: a chibi figure of
// them on a display base in a taller box (0 0 64 96), queued when GET /shop finds a love interest without one, so the
// Shop's shelf can show it before it is bought. Until it is drawn the shelf shows their plush frame.
// ponytail: a plush or figurine is drawn once and kept; a look or accent changed later keeps the drawing it had. The
// upgrade path is a Redraw on the shelf. The cool-down lives in this process only, as the line packs' does.
import { z, type ZodType } from "zod";
import type {
  FigurineArt,
  LiId,
  PlushArt,
  Unit,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { sanitizePlushSvg } from "../art/plush-svg.js";
import type { BackgroundQueue } from "../background-queue.js";
import { generateJson, resolveConnectionId, type GenerationDeps, type OtomeMessage } from "../generation.js";
import { runDocTarget, unitId } from "../ids.js";
import { readRun } from "../schemas/state.js";
import { PLUSH_ANIMAL_MAX, normalizeUnit } from "../schemas/unit.js";
import type { OtomeStore } from "../store.js";
import { figurineMessages, plushMessages } from "../prompts.js";

/** What the reply itself needs: an SVG of up to PLUSH_SVG_MAX characters in a JSON string. */
export const PLUSH_MAX_TOKENS = 5000;
/** How long a love interest whose plush failed is left alone before another attempt. */
export const PLUSH_RETRY_MS = 10 * 60_000;

export const PlushReplySchema = z.object({ animal: z.string(), svg: z.string() });
export type PlushReply = z.infer<typeof PlushReplySchema>;

/** The reply as a plush to keep, or why it is refused (the generation core's one repair turn sends it back). */
export function normalizePlushReply(reply: PlushReply, at: string): PlushArt | string {
  const animal = reply.animal.replace(/\s+/gu, " ").trim();
  if (!animal) return "animal is missing";
  if (animal.length > PLUSH_ANIMAL_MAX) return `animal must be at most ${PLUSH_ANIMAL_MAX} characters`;
  const clean = sanitizePlushSvg(reply.svg);
  return "svg" in clean ? { animal, svg: clean.svg, at } : clean.error;
}

export const FigurineReplySchema = z.object({ svg: z.string() });
export type FigurineReply = z.infer<typeof FigurineReplySchema>;

/**
 * The reply as a figurine to keep, or why it is refused. Its box is checked as the allow-list kept it: a box missing or
 * malformed there becomes the plush's square 0 0 64 64, which would cut a figure drawn on 0 0 64 96 off at the knees,
 * so only a tall 2:3 box is kept.
 */
export function normalizeFigurineReply(reply: FigurineReply, at: string): FigurineArt | string {
  const clean = sanitizePlushSvg(reply.svg);
  if (!("svg" in clean)) return clean.error;
  const box = /^<svg [^>]*\bviewBox="([^"]+)"/u.exec(clean.svg)?.[1]?.split(" ").map(Number) ?? [];
  const [width = 0, height = 0] = box.slice(2);
  if (!(width > 0 && height > 0 && Math.abs(width / height - 2 / 3) < 0.01))
    return 'svg needs its viewBox, "0 0 64 96"';
  return { svg: clean.svg, at };
}

export interface PlushDeps extends GenerationDeps {
  store: Pick<OtomeStore, "readDoc" | "listRun" | "updateDoc">;
  background?: Pick<BackgroundQueue, "ensure">;
}

/** One kind of love interest's drawing: where it is kept on their unit, and how it is asked for and checked. */
interface Drawing<Reply extends object, Art> {
  kind: "plush" | "figurine";
  kept: (unit: Unit) => boolean;
  messages: (unit: Unit) => OtomeMessage[];
  schema: ZodType<Reply>;
  keep: (reply: Reply, at: string) => Art | string;
  save: (unit: Unit, art: Art) => Unit;
}

const PLUSH: Drawing<PlushReply, PlushArt> = {
  kind: "plush",
  kept: (unit) => !!unit.plushArt,
  messages: (unit) => plushMessages({ unit }),
  schema: PlushReplySchema,
  keep: normalizePlushReply,
  save: (unit, plushArt) => ({ ...unit, plushArt }),
};

const FIGURINE: Drawing<FigurineReply, FigurineArt> = {
  kind: "figurine",
  kept: (unit) => !!unit.figurineArt,
  messages: (unit) => figurineMessages({ unit }),
  schema: FigurineReplySchema,
  keep: normalizeFigurineReply,
  save: (unit, figurineArt) => ({ ...unit, figurineArt }),
};

/** Love interests whose last job failed, and when (the cool-down), by job key. */
const failed = new Map<string, number>();
/** Jobs a debug-mode request asked for again while they waited: they log their prompt when they run. */
const debugWanted = new Set<string>();
const jobKey = (runId: string, li: LiId, kind: Drawing<object, unknown>["kind"]) => `${unitId(runId, li)}#${kind}`;

/**
 * Queues the drawing of each listed love interest's missing plush on the background lane; returns the ones whose
 * drawing now waits or runs. A love interest with no bible, a plush already, no connection to draw with, or a failure
 * within PLUSH_RETRY_MS is skipped.
 */
export function ensurePlushArt(
  deps: PlushDeps,
  runId: string,
  lis: readonly LiId[],
  options: { debugMode: boolean },
): Promise<LiId[]> {
  return ensureDrawn(deps, runId, lis, options, PLUSH);
}

/** ensurePlushArt for each listed love interest's missing Shop figurine (#2128). */
export function ensureFigurineArt(
  deps: PlushDeps,
  runId: string,
  lis: readonly LiId[],
  options: { debugMode: boolean },
): Promise<LiId[]> {
  return ensureDrawn(deps, runId, lis, options, FIGURINE);
}

async function ensureDrawn<Reply extends object, Art>(
  deps: PlushDeps,
  runId: string,
  lis: readonly LiId[],
  { debugMode }: { debugMode: boolean },
  drawing: Drawing<Reply, Art>,
): Promise<LiId[]> {
  const { background } = deps;
  if (!background || !lis.length) return [];
  const run = await readRun(deps.store, runId);
  const connectionId = resolveConnectionId(run?.world ?? null, "structured");
  if (!run || !connectionId) return [];
  const waiting: LiId[] = [];
  for (const li of lis) {
    const unit = run.units.find((entry) => entry.id === li);
    const key = jobKey(runId, li, drawing.kind);
    if (!unit?.bible || drawing.kept(unit)) continue;
    if (Date.now() - (failed.get(key) ?? -Infinity) < PLUSH_RETRY_MS) continue;
    const fresh = background.ensure({
      key,
      connectionId,
      run: async () => {
        const debug = debugMode || debugWanted.has(key);
        debugWanted.delete(key);
        try {
          await writeDrawing(deps, runId, li, { connectionId, debugMode: debug }, drawing);
          failed.delete(key);
        } catch (error) {
          failed.set(key, Date.now());
          throw error;
        } finally {
          debugWanted.delete(key);
        }
      },
    });
    waiting.push(li);
    if (!fresh && debugMode) debugWanted.add(key);
  }
  return waiting;
}

/**
 * The job: reads the run again, draws the plush in one call, and keeps it unless one was kept meanwhile. Does nothing
 * when the run, the love interest or their bible is gone, or the plush exists.
 */
export function writePlushArt(
  deps: PlushDeps,
  runId: string,
  li: LiId,
  options: { connectionId: string; debugMode: boolean },
): Promise<void> {
  return writeDrawing(deps, runId, li, options, PLUSH);
}

async function writeDrawing<Reply extends object, Art>(
  deps: PlushDeps,
  runId: string,
  li: LiId,
  { connectionId, debugMode }: { connectionId: string; debugMode: boolean },
  drawing: Drawing<Reply, Art>,
): Promise<void> {
  const run = await readRun(deps.store, runId);
  const unit = run?.units.find((entry) => entry.id === li);
  if (!run || !unit?.bible || drawing.kept(unit)) return;
  const at = new Date().toISOString();
  const { value } = await generateJson(deps, {
    runId,
    job: "structured",
    label: drawing.kind,
    messages: drawing.messages(unit),
    schema: drawing.schema,
    normalize: (reply) => {
      const art = drawing.keep(reply, at);
      return typeof art === "string" ? art : reply;
    },
    maxTokens: PLUSH_MAX_TOKENS,
    debugMode,
    lane: "background",
    connectionId,
  });
  const art = drawing.keep(value, at);
  if (typeof art === "string") return;
  await deps.store.updateDoc(runDocTarget("unit", unitId(runId, li)), normalizeUnit, (current) =>
    drawing.kept(current) ? current : drawing.save(current, art),
  );
}
