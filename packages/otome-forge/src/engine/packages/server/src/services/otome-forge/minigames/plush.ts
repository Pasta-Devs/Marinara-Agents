// ──────────────────────────────────────────────
// Otome Hearth: each love interest's own Claw Machine plush, the animal that fits them, drawn as SVG (#1954)
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
// ponytail: a plush is drawn once and kept; a look or accent changed later keeps the plush it had. The upgrade path is a
// Redraw on the shelf. The cool-down lives in this process only, as the line packs' does.
import { z } from "zod";
import type { LiId, PlushArt, Unit } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { PLUSH_INK } from "../../../../../client/src/features/otome-forge/shared/claw.js";
import { PLUSH_ATTRIBUTES, PLUSH_ELEMENTS, PLUSH_SVG_MAX, sanitizePlushSvg } from "../art/plush-svg.js";
import type { BackgroundQueue } from "../background-queue.js";
import { generateJson, resolveConnectionId, type GenerationDeps, type OtomeMessage } from "../generation.js";
import { runDocTarget, unitId } from "../ids.js";
import { readRun } from "../schemas/state.js";
import { PLUSH_ANIMAL_MAX, normalizeUnit } from "../schemas/unit.js";
import type { OtomeStore } from "../store.js";

export const PLUSH_TEMPERATURE = 0.7;
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

/** The plush prompt: who they are and how they look, and the SVG the allow-list will take. */
export function plushMessages({ unit }: { unit: Unit }): OtomeMessage[] {
  const bible = unit.bible;
  const look = [unit.identityLine || bible?.look.identityLine, unit.outfitLine || bible?.look.outfitLine]
    .map((line) => line?.trim())
    .filter(Boolean)
    .join("; ");
  const who = bible
    ? [
        bible.role && `Role: ${bible.role}`,
        bible.publicFace && `How they come across: ${bible.publicFace}`,
        bible.archetype && `Archetype: ${bible.archetype}`,
        bible.mask.presents && `Manner: ${bible.mask.presents}`,
        bible.voice.register && `Voice: ${bible.voice.register}`,
      ].filter(Boolean)
    : [];
  const system = [
    "You design one plush toy for the Claw Machine of an otome game: the love interest below as the animal that fits them best, made as a soft toy in their colours.",
    'Reply with ONLY a JSON object: {"animal": "...", "svg": "<svg ...>...</svg>"}',
    "FIELDS",
    "- animal: the animal, in one or two English words (for example raven, black cat, red fox, snow leopard).",
    "- svg: the plush, as one small SVG image.",
    "RULES",
    "- Pick the animal from who they are: their personality, role and manner first, their look second. A fitting animal, never a pun on their name.",
    "- Colour it from their look: the main colours of their hair and clothes, eyes in their own eye colour, and their accent colour somewhere on it.",
    "- A plush, not a real animal: a seated chibi toy with a big round head on a small round body, stubby limbs, soft rounded shapes, simple eyes with a white glint, a little blush and dashed stitch seams. Cute, and still recognisably them.",
    `- The SVG: viewBox "0 0 64 64", the plush centred and filling most of it, with no background. Use only these elements: ${PLUSH_ELEMENTS.join(", ")}. Use only these attributes: ${Object.keys(PLUSH_ATTRIBUTES).join(", ")} (transform: translate, rotate or scale only). Colours as #rrggbb. No text, style, gradients, filters, ids, links, images or comments.`,
    `- Outline the shapes in ${PLUSH_INK} at a stroke-width of 1 to 1.5, as the machine's other plushies are. At most ${PLUSH_SVG_MAX} characters.`,
  ].join("\n");
  const user = [
    `LOVE INTEREST: ${unit.name} (${unit.pronouns.subject}/${unit.pronouns.object})`,
    `Accent colour: ${unit.accent}`,
    look ? `Look: ${look}` : "",
    ...who,
    "",
    `Design ${unit.name}'s plush now.`,
  ]
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export interface PlushDeps extends GenerationDeps {
  store: Pick<OtomeStore, "readDoc" | "listRun" | "updateDoc">;
  background?: Pick<BackgroundQueue, "ensure">;
}

/** Love interests whose last job failed, and when (the cool-down). */
const failed = new Map<string, number>();
/** Jobs a debug-mode request asked for again while they waited: they log their prompt when they run. */
const debugWanted = new Set<string>();
const jobKey = (runId: string, li: LiId) => `${unitId(runId, li)}#plush`;

/**
 * Queues the drawing of each listed love interest's missing plush on the background lane; returns the ones queued. A
 * love interest with no bible, a plush already, no connection to draw with, a job already waiting or running, or a
 * failure within PLUSH_RETRY_MS is skipped.
 */
export async function ensurePlushArt(
  deps: PlushDeps,
  runId: string,
  lis: readonly LiId[],
  { debugMode }: { debugMode: boolean },
): Promise<LiId[]> {
  const { background } = deps;
  if (!background || !lis.length) return [];
  const run = await readRun(deps.store, runId);
  const connectionId = resolveConnectionId(run?.world ?? null, "structured");
  if (!run || !connectionId) return [];
  const queued: LiId[] = [];
  for (const li of lis) {
    const unit = run.units.find((entry) => entry.id === li);
    const key = jobKey(runId, li);
    if (!unit?.bible || unit.plushArt) continue;
    if (Date.now() - (failed.get(key) ?? -Infinity) < PLUSH_RETRY_MS) continue;
    const fresh = background.ensure({
      key,
      connectionId,
      run: async () => {
        const debug = debugMode || debugWanted.has(key);
        debugWanted.delete(key);
        try {
          await writePlushArt(deps, runId, li, { connectionId, debugMode: debug });
          failed.delete(key);
        } catch (error) {
          failed.set(key, Date.now());
          throw error;
        } finally {
          debugWanted.delete(key);
        }
      },
    });
    if (fresh) queued.push(li);
    else if (debugMode) debugWanted.add(key);
  }
  return queued;
}

/**
 * The job: reads the run again, draws the plush in one call, and keeps it unless one was kept meanwhile. Does nothing
 * when the run, the love interest or their bible is gone, or the plush exists.
 */
export async function writePlushArt(
  deps: PlushDeps,
  runId: string,
  li: LiId,
  { connectionId, debugMode }: { connectionId: string; debugMode: boolean },
): Promise<void> {
  const run = await readRun(deps.store, runId);
  const unit = run?.units.find((entry) => entry.id === li);
  if (!run || !unit?.bible || unit.plushArt) return;
  const at = new Date().toISOString();
  const { value } = await generateJson(deps, {
    runId,
    job: "structured",
    label: "plush",
    messages: plushMessages({ unit }),
    schema: PlushReplySchema,
    normalize: (reply) => {
      const art = normalizePlushReply(reply, at);
      return typeof art === "string" ? art : reply;
    },
    temperature: PLUSH_TEMPERATURE,
    maxTokens: PLUSH_MAX_TOKENS,
    debugMode,
    lane: "background",
    connectionId,
  });
  const art = normalizePlushReply(value, at);
  if (typeof art === "string") return;
  await deps.store.updateDoc(runDocTarget("unit", unitId(runId, li)), normalizeUnit, (current) =>
    current.plushArt ? current : { ...current, plushArt: art },
  );
}
