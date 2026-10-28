// ──────────────────────────────────────────────
// Otome Forge: a love interest's pre-written Home lines (plan M3 "Line packs", P15)
// ──────────────────────────────────────────────
// `unit.lines` holds one pack per stage (taps by zone and time of day, annoyed and cold lines) and one fixed pack
// written once with his first stage pack (rough-day comfort and the Claw Machine's lines). Taps never wait: the client
// reads the pack once and plays lines from it, and until his own pack exists it plays the catalog's fallback lines.
//
// Packs are written as background "ensure" jobs (S/background-queue.ts): one job per love interest, keyed by his unit,
// queued whenever Home or his lines are read and the pack for his current stage (or the fixed pack) is missing. That
// covers the first Home visit (backfill for every LI), a stage change (the next visit finds the new stage's pack
// missing) and a pack that was lost. The job reads everything again when it runs, writes only what is still missing,
// and never replaces a pack that exists, so two jobs never write the same pack twice.
//
// A job whose model call fails is dropped by the queue; this module then leaves that love interest alone for
// LINE_RETRY_MS, so a model that keeps declining is not asked again on every visit. A request in debug mode that finds
// his job already waiting folds its debugMode into it, as memory maintenance does, so the prompt is logged when it runs.
// ponytail: the cool-down lives in this process only; a restart forgets it, which costs at most one more attempt.
import type {
  ArcStageKey,
  FixedLines,
  LiId,
  LiState,
  LinesView,
  StageLines,
  Unit,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import {
  CLAW_LINE_KINDS,
  LINE_COUNTS,
  LINE_WORDS_MAX,
  TAP_ZONES,
  TIMES_OF_DAY,
  wordCount,
} from "../../../../../client/src/features/otome-forge/shared/home.js";
import type { BackgroundQueue } from "../background-queue.js";
import { generateJson, resolveConnectionId, type GenerationDeps } from "../generation.js";
import { runDocTarget, unitId } from "../ids.js";
import { readRun } from "../schemas/state.js";
import { normalizeUnit } from "../schemas/unit.js";
import type { OtomeStore } from "../store.js";
import {
  LinePackReplySchema,
  QUESTION_MARK,
  linePackMessages,
  mentionsAbsence,
  type LinePackReply,
} from "./prompts.js";

export const LINE_PACK_TEMPERATURE = 0.9;
/** What the reply itself needs: about sixty lines of fourteen words. */
export const LINE_PACK_MAX_TOKENS = 3000;
/** How long a love interest whose pack failed is left alone before another attempt. */
export const LINE_RETRY_MS = 10 * 60_000;

const STAGES: readonly ArcStageKey[] = ["1", "2", "3", "4", "5", "6"];
const stageKey = (stage: number) => String(Math.min(6, Math.max(1, Math.trunc(stage) || 1))) as ArcStageKey;

/** One line as stored: trimmed, on one line, without the quotes a model may wrap it in. */
function cleanLine(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["“”'‘’「『]+|["“”'‘’」』]+$/gu, "")
    .trim();
}

/**
 * `count` distinct lines that keep the rules, or the problem for the repair turn. A line that asks a question is left
 * out (a stored line is replayed on every tap, with no way to answer it); only an annoyed line may be a rhetorical one.
 */
function pick(raw: readonly string[], count: number, label: string, { rhetorical = false } = {}): string[] | string {
  const kept: string[] = [];
  for (const value of raw) {
    const text = cleanLine(value);
    const words = wordCount(text);
    if (!text || words === 0 || words > LINE_WORDS_MAX || mentionsAbsence(text)) continue;
    if (!rhetorical && QUESTION_MARK.test(text)) continue;
    if (!kept.some((other) => other.toLocaleLowerCase() === text.toLocaleLowerCase())) kept.push(text);
  }
  return kept.length >= count
    ? kept.slice(0, count)
    : `${label} needs ${count} distinct lines of ${LINE_WORDS_MAX} words or fewer that never mention the protagonist being away${rhetorical ? "" : " and never ask a question"} (got ${kept.length})`;
}

export interface NormalizedLinePack {
  stage: StageLines;
  fixed: FixedLines | null;
}

/** P15's reply as stored packs, or the first problem (which sends the repair turn). */
export function normalizeLinePack(
  reply: LinePackReply,
  { stage, withFixed, at }: { stage: number; withFixed: boolean; at: string },
): NormalizedLinePack | string {
  const tap = {} as StageLines["tap"];
  for (const zone of TAP_ZONES) {
    tap[zone] = {} as StageLines["tap"][typeof zone];
    for (const time of TIMES_OF_DAY) {
      const lines = pick(reply.tap[zone][time], LINE_COUNTS.tap, `tap.${zone}.${time}`);
      if (typeof lines === "string") return lines;
      tap[zone][time] = lines;
    }
  }
  const annoyed = pick(reply.annoyed, LINE_COUNTS.annoyed, "annoyed", { rhetorical: true });
  if (typeof annoyed === "string") return annoyed;
  const cold = pick(reply.cold, LINE_COUNTS.cold, "cold");
  if (typeof cold === "string") return cold;
  const pack: StageLines = { stage: Number(stageKey(stage)), tap, annoyed, cold, at };
  if (!withFixed) return { stage: pack, fixed: null };

  const comfort = pick(reply.comfort ?? [], LINE_COUNTS.comfort, "comfort");
  if (typeof comfort === "string") return comfort;
  const claw = {} as FixedLines["claw"];
  for (const kind of CLAW_LINE_KINDS) {
    const lines = pick(reply.claw?.[kind] ?? [], LINE_COUNTS.claw[kind], `claw.${kind}`);
    if (typeof lines === "string") return lines;
    claw[kind] = lines;
  }
  return { stage: pack, fixed: { comfort, claw, at } };
}

/** True while his current stage's pack or the fixed pack is missing. */
export function needsLines(unit: Pick<Unit, "lines">, stage: number): boolean {
  return !unit.lines?.stages[stageKey(stage)] || !unit.lines.fixed;
}

/** His current stage's pack, else the nearest earlier one, else the nearest later one. */
function nearestPack(unit: Pick<Unit, "lines">, stage: number): StageLines | null {
  const stages = unit.lines?.stages ?? {};
  const at = STAGES.indexOf(stageKey(stage));
  const order = [...STAGES.slice(0, at + 1).reverse(), ...STAGES.slice(at + 1)];
  for (const key of order) if (stages[key]) return stages[key]!;
  return null;
}

/** GET .../lis/:li/lines: what Home may say. During a rupture only the cold lines (the plan's "Home shows the cold lines"). */
export function linesView(unit: Pick<Unit, "lines">, liState: Pick<LiState, "stage" | "rupture">): LinesView {
  const pack = nearestPack(unit, liState.stage);
  const fixed = unit.lines?.fixed ?? null;
  const rupture = liState.rupture !== null;
  return {
    ready: !needsLines(unit, liState.stage),
    stage: liState.stage,
    rupture,
    tap: rupture ? null : (pack?.tap ?? null),
    annoyed: rupture ? [] : (pack?.annoyed ?? []),
    cold: pack?.cold ?? [],
    comfort: fixed?.comfort ?? [],
    claw: fixed?.claw ?? null,
  };
}

export interface LineDeps extends GenerationDeps {
  store: Pick<OtomeStore, "readDoc" | "listRun" | "updateDoc">;
  background?: Pick<BackgroundQueue, "ensure">;
}

/** Love interests whose last job failed, and when (the cool-down). */
const failed = new Map<string, number>();
/** Jobs a debug-mode request asked for again while they waited: they log their prompt when they run. */
const debugWanted = new Set<string>();
const jobKey = (runId: string, li: LiId) => `${unitId(runId, li)}#lines`;

/**
 * Queues the write of each listed love interest's missing packs on the background lane; returns the ones queued. A
 * love interest with no bible, no connection to write with, a job already waiting or running, or a failure within
 * LINE_RETRY_MS is skipped.
 */
export async function ensureLinePacks(
  deps: LineDeps,
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
    const liState = run.state.lis[li];
    const key = jobKey(runId, li);
    if (!unit?.bible || !liState || !needsLines(unit, liState.stage)) continue;
    if (Date.now() - (failed.get(key) ?? -Infinity) < LINE_RETRY_MS) continue;
    const fresh = background.ensure({
      key,
      connectionId,
      run: async () => {
        const debug = debugMode || debugWanted.has(key);
        debugWanted.delete(key);
        try {
          await writeLinePacks(deps, runId, li, { connectionId, debugMode: debug });
          failed.delete(key);
        } catch (error) {
          failed.set(key, Date.now());
          throw error;
        } finally {
          // A request folded in after the prompt was sent has nothing left to log.
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
 * The job: reads the run again, writes his current stage's pack (with the fixed pack when that is missing too) in one
 * P15 call, and saves only what is still missing. Does nothing when the run, the love interest or his bible is gone,
 * or the packs were written meanwhile.
 */
export async function writeLinePacks(
  deps: LineDeps,
  runId: string,
  li: LiId,
  { connectionId, debugMode }: { connectionId: string; debugMode: boolean },
): Promise<void> {
  const run = await readRun(deps.store, runId);
  const unit = run?.units.find((entry) => entry.id === li);
  const liState = run?.state.lis[li];
  if (!run || !unit?.bible || !liState || !needsLines(unit, liState.stage)) return;
  const stage = liState.stage;
  const key = stageKey(stage);
  const withFixed = !unit.lines?.fixed;
  const writeStage = !unit.lines?.stages[key];
  const at = new Date().toISOString();
  const { value } = await generateJson(deps, {
    runId,
    job: "structured",
    label: "line-pack",
    messages: linePackMessages({ world: run.world, player: run.player, unit, stage, withFixed }),
    schema: LinePackReplySchema,
    normalize: (reply) => {
      const pack = normalizeLinePack(reply, { stage, withFixed, at });
      return typeof pack === "string" ? pack : reply;
    },
    temperature: LINE_PACK_TEMPERATURE,
    maxTokens: LINE_PACK_MAX_TOKENS,
    debugMode,
    lane: "background",
    connectionId,
  });
  const pack = normalizeLinePack(value, { stage, withFixed, at });
  if (typeof pack === "string") return;
  await deps.store.updateDoc(runDocTarget("unit", unitId(runId, li)), normalizeUnit, (current) => {
    const stages = { ...current.lines?.stages };
    const fixed = current.lines?.fixed ?? pack.fixed;
    if (writeStage && !stages[key]) stages[key] = pack.stage;
    return { ...current, lines: { stages, fixed } };
  });
}
