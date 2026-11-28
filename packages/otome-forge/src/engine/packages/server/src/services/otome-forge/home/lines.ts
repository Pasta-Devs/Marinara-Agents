// ──────────────────────────────────────────────
// Otome Forge: a love interest's pre-written Home lines (plan M3 "Line packs", P15)
// ──────────────────────────────────────────────
// `unit.lines` holds one pack per stage (taps by zone and time of day, annoyed and cold lines) and one fixed pack
// written with his first stage pack (rough-day comfort and the Claw Machine's lines). Taps never wait: the client
// reads the pack once and plays lines from it, and until his own pack exists it plays the catalog's fallback lines.
//
// Packs are written as background "ensure" jobs (S/background-queue.ts): one job per love interest, keyed by his unit,
// queued whenever Home or his lines are read and the pack for his current stage (or the fixed pack) is missing. That
// covers the first Home visit (backfill for every LI), a stage change (the next visit finds the new stage's pack
// missing) and a pack that was lost. The job reads everything again when it runs, writes only what is still missing,
// and never replaces a pack written for the world's current settings, so two jobs never write the same pack twice.
//
// A job whose model call fails is dropped by the queue; this module then leaves that love interest alone for
// LINE_RETRY_MS, so a model that keeps declining is not asked again on every visit. A request in debug mode that finds
// his job already waiting folds its debugMode into it, as memory maintenance does, so the prompt is logged when it runs.
// ponytail: the cool-down lives in this process only; a restart forgets it, which costs at most one more attempt.
//
// Touch (#2152): a pack is stamped with the content it was written under (contentStamp). Under NSFW Heat it is written
// under the full contract and holds the crotch zone; anywhere else it is the SFW `home` pack. A pack counts as written
// for his stage only while its stamp matches the world's and it holds every zone the world opens, so a pack from
// before 0.14.0 (no cheek) and a pack whose NSFW settings changed are each written once more, on the next visit. Home
// never serves an NSFW pack under settings it was not written for: it falls back to an SFW pack, or the catalog's lines.
// The fixed pack carries the same stamp: its claw lines follow the rule (comfort keeps the care rule's warmth in any
// world, so it always serves), and a fixed pack Home may not serve is written again in the call that rewrites the stage.
//
// Kitty Cards (0.35.0): a new fixed pack holds his kitty lines too. A fixed pack written before them is kept, and a
// small job of its own (ensureKittyLines, queued by GET /play) writes only the kitty lines into it, under the content
// its stamp stands for, so the pack's one stamp stays true of every line in it. It never touches comfort or claw.
import { createHash } from "node:crypto";
import type {
  ArcStageKey,
  FixedLines,
  LiId,
  LiState,
  LinesView,
  StageLines,
  Unit,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { intimacyOpen, type ContentSettings } from "../../../../../client/src/features/otome-forge/shared/content.js";
import { isFace } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import {
  LINE_COUNTS,
  LINE_WORDS_MAX,
  TIMES_OF_DAY,
  tapZonesFor,
  wordCount,
} from "../../../../../client/src/features/otome-forge/shared/home.js";
import type { BackgroundQueue } from "../background-queue.js";
import { generateJson, resolveConnectionId, type GenerationDeps } from "../generation.js";
import { runDocTarget, unitId } from "../ids.js";
import { isRecord } from "../schemas/common.js";
import { readRun } from "../schemas/state.js";
import { normalizeUnit } from "../schemas/unit.js";
import type { OtomeStore } from "../store.js";
import { linePackMessages } from "../prompts.js";
import {
  KittyLinesReplySchema,
  LinePackReplySchema,
  QUESTION_MARK,
  mentionsAbsence,
  type LinePackReply,
} from "./replies.js";

/**
 * What the reply itself needs: up to about ninety-five lines of fourteen words (an NSFW first pack), and the faces.
 * The kitty-only job asks the same: generation.ts raises any need to its OUTPUT_FLOOR anyway.
 */
export const LINE_PACK_MAX_TOKENS = 4500;
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

/** Each kind's lines, `counts[kind]` of them (claw and kitty lines), or the first kind's problem. */
function pickKinds<K extends string>(
  raw: { readonly [P in K]?: readonly string[] } | null | undefined,
  counts: { readonly [P in K]: number },
  label: string,
): Record<K, string[]> | string {
  const picked = {} as Record<K, string[]>;
  for (const kind of Object.keys(counts) as K[]) {
    const lines = pick(raw?.[kind] ?? [], counts[kind], `${label}.${kind}`);
    if (typeof lines === "string") return lines;
    picked[kind] = lines;
  }
  return picked;
}

export interface NormalizedLinePack {
  stage: StageLines;
  fixed: FixedLines | null;
}

/**
 * The content a pack is written under (#2152): "home" for the SFW `home` contract (any world without NSFW Heat), else
 * "nsfw:" and a hash of the settings the full contract reads. Built from the settings, never from prompt text, so a
 * package update that rewords a contract never sends every pack back to the model.
 */
export function contentStamp(content: ContentSettings): string {
  if (!intimacyOpen(content)) return "home";
  const limits = Object.entries(content.limits).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const custom = content.custom.map((limit) => [limit.text, limit.level]);
  const settings = JSON.stringify([content.heat, content.darkness, limits, custom, content.mcRole ?? null]);
  return `nsfw:${createHash("sha1").update(settings).digest("hex").slice(0, 12)}`;
}

/** P15's reply as stored packs, or the first problem (which sends the repair turn). */
export function normalizeLinePack(
  reply: LinePackReply,
  { stage, withFixed, at, content }: { stage: number; withFixed: boolean; at: string; content: ContentSettings },
): NormalizedLinePack | string {
  // Every zone the world opens, and no other: an SFW pack never keeps a crotch line the model wrote.
  const tap = {} as StageLines["tap"];
  const faces: NonNullable<StageLines["faces"]> = {};
  const contract = contentStamp(content);
  for (const zone of tapZonesFor(content)) {
    const times = {} as Record<(typeof TIMES_OF_DAY)[number], string[]>;
    for (const time of TIMES_OF_DAY) {
      const lines = pick(reply.tap[zone]?.[time] ?? [], LINE_COUNTS.tap, `tap.${zone}.${time}`);
      if (typeof lines === "string") return lines;
      times[time] = lines;
    }
    tap[zone] = times;
    const face = isRecord(reply.faces) ? reply.faces[zone] : undefined;
    if (isFace(face)) faces[zone] = face;
  }
  const annoyed = pick(reply.annoyed, LINE_COUNTS.annoyed, "annoyed", { rhetorical: true });
  if (typeof annoyed === "string") return annoyed;
  const cold = pick(reply.cold, LINE_COUNTS.cold, "cold");
  if (typeof cold === "string") return cold;
  const pack: StageLines = {
    stage: Number(stageKey(stage)),
    tap,
    annoyed,
    cold,
    at,
    contract,
    ...(Object.keys(faces).length ? { faces } : {}),
  };
  if (!withFixed) return { stage: pack, fixed: null };

  const comfort = pick(reply.comfort ?? [], LINE_COUNTS.comfort, "comfort");
  if (typeof comfort === "string") return comfort;
  const claw = pickKinds(reply.claw, LINE_COUNTS.claw, "claw");
  if (typeof claw === "string") return claw;
  const kitty = pickKinds(reply.kitty, LINE_COUNTS.kitty, "kitty");
  if (typeof kitty === "string") return kitty;
  return { stage: pack, fixed: { comfort, claw, kitty, at, contract } };
}

/** An SFW stamp (or none, from before 0.14.0) serves in any world; an NSFW one only under its own settings (#2152). */
function servable(contract: string | undefined, content: ContentSettings): boolean {
  return (contract ?? "home") === "home" || contract === contentStamp(content);
}

/** His fixed pack while Home and the Claw Machine may serve its claw lines (#2152), else null (the catalog's lines). */
export function servableFixed(unit: Pick<Unit, "lines">, content: ContentSettings): FixedLines | null {
  const fixed = unit.lines?.fixed ?? null;
  return fixed && servable(fixed.contract, content) ? fixed : null;
}

/** True while the pack was written under these settings and holds every zone they open (#2152). */
function isCurrent(pack: StageLines | undefined, content: ContentSettings): boolean {
  return (
    !!pack &&
    (pack.contract ?? "home") === contentStamp(content) &&
    tapZonesFor(content).every((zone) => !!pack.tap[zone])
  );
}

/**
 * True while his current stage's pack is missing or was written for other settings, or the fixed pack is missing or
 * may not be served under them (#2152).
 */
export function needsLines(unit: Pick<Unit, "lines">, stage: number, content: ContentSettings): boolean {
  return !isCurrent(unit.lines?.stages[stageKey(stage)], content) || !servableFixed(unit, content);
}

/**
 * His current stage's pack, else the nearest earlier one, else the nearest later one, among those Home may serve: an
 * SFW pack anywhere (its lines are safe in any world), an NSFW one only under the settings it was written for.
 */
function nearestPack(unit: Pick<Unit, "lines">, stage: number, content: ContentSettings): StageLines | null {
  const stages = unit.lines?.stages ?? {};
  const at = STAGES.indexOf(stageKey(stage));
  const order = [...STAGES.slice(0, at + 1).reverse(), ...STAGES.slice(at + 1)];
  for (const key of order) if (stages[key] && servable(stages[key].contract, content)) return stages[key];
  return null;
}

/** GET .../lis/:li/lines: what Home may say. During a rupture only the cold lines (the plan's "Home shows the cold lines"). */
export function linesView(
  unit: Pick<Unit, "lines">,
  liState: Pick<LiState, "stage" | "rupture">,
  content: ContentSettings,
): LinesView {
  const pack = nearestPack(unit, liState.stage, content);
  const fixed = unit.lines?.fixed ?? null;
  const rupture = liState.rupture !== null;
  return {
    ready: !needsLines(unit, liState.stage, content),
    stage: liState.stage,
    rupture,
    tap: rupture ? null : (pack?.tap ?? null),
    faces: rupture ? {} : (pack?.faces ?? {}),
    annoyed: rupture ? [] : (pack?.annoyed ?? []),
    cold: pack?.cold ?? [],
    comfort: fixed?.comfort ?? [],
    claw: servableFixed(unit, content)?.claw ?? null,
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
const jobKey = (runId: string, li: LiId, job: "lines" | "kitty") => `${unitId(runId, li)}#${job}`;

/**
 * Queues one job on the background lane; true when it was queued now. Skipped within LINE_RETRY_MS of its failure; a
 * debug request that finds it already waiting folds its debugMode into it.
 */
function queueJob(
  background: Pick<BackgroundQueue, "ensure">,
  key: string,
  connectionId: string,
  debugMode: boolean,
  write: (debugMode: boolean) => Promise<void>,
): boolean {
  if (Date.now() - (failed.get(key) ?? -Infinity) < LINE_RETRY_MS) return false;
  const fresh = background.ensure({
    key,
    connectionId,
    run: async () => {
      const debug = debugMode || debugWanted.has(key);
      debugWanted.delete(key);
      try {
        await write(debug);
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
  if (!fresh && debugMode) debugWanted.add(key);
  return fresh;
}

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
  return lis.filter((li) => {
    const unit = run.units.find((entry) => entry.id === li);
    const liState = run.state.lis[li];
    if (!unit?.bible || !liState || !needsLines(unit, liState.stage, run.world.content)) return false;
    return queueJob(background, jobKey(runId, li, "lines"), connectionId, debugMode, (debug) =>
      writeLinePacks(deps, runId, li, { connectionId, debugMode: debug }),
    );
  });
}

/**
 * The job: reads the run again, writes his current stage's pack (with the fixed pack when that is needed too) in one
 * P15 call, and saves only what is still missing or was written for other settings (#2152). Does nothing when the run,
 * the love interest or his bible is gone, or the packs were written meanwhile. The fixed pack is replaced only when it
 * may not be served under the world's settings (an NSFW one after they changed).
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
  if (!run || !unit?.bible || !liState || !needsLines(unit, liState.stage, run.world.content)) return;
  const { content } = run.world;
  const stage = liState.stage;
  const key = stageKey(stage);
  const withFixed = !servableFixed(unit, content);
  const writeStage = !isCurrent(unit.lines?.stages[key], content);
  const at = new Date().toISOString();
  const { value } = await generateJson(deps, {
    runId,
    job: "structured",
    label: "line-pack",
    messages: linePackMessages({ world: run.world, player: run.player, unit, stage, withFixed }),
    schema: LinePackReplySchema,
    normalize: (reply) => {
      const pack = normalizeLinePack(reply, { stage, withFixed, at, content });
      return typeof pack === "string" ? pack : reply;
    },
    maxTokens: LINE_PACK_MAX_TOKENS,
    debugMode,
    lane: "background",
    connectionId,
  });
  const pack = normalizeLinePack(value, { stage, withFixed, at, content });
  if (typeof pack === "string") return;
  await deps.store.updateDoc(runDocTarget("unit", unitId(runId, li)), normalizeUnit, (current) => {
    const stages = { ...current.lines?.stages };
    const fixed = servableFixed(current, content) ?? pack.fixed ?? current.lines?.fixed ?? null;
    // Another job may have written this stage for these settings meanwhile: that pack stays.
    if (writeStage && !isCurrent(stages[key], content)) stages[key] = pack.stage;
    return { ...current, lines: { stages, fixed } };
  });
}

// ── Kitty Cards' lines for a fixed pack written before them (0.35.0) ──

/** True while his fixed pack may be served under these settings but holds no kitty lines (written before 0.35.0). */
function needsKittyLines(unit: Pick<Unit, "lines">, content: ContentSettings): boolean {
  const fixed = servableFixed(unit, content);
  return !!fixed && !fixed.kitty;
}

/**
 * Queues, as ensureLinePacks does and with the same cool-down, the write of each listed love interest's kitty lines
 * where his fixed pack lacks them; returns the ones queued. A love interest with no fixed pack Home may serve is left
 * to his line-pack job, which writes the kitty lines with the rest.
 */
export async function ensureKittyLines(
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
  return lis.filter((li) => {
    const unit = run.units.find((entry) => entry.id === li);
    if (!unit?.bible || !run.state.lis[li] || !needsKittyLines(unit, run.world.content)) return false;
    return queueJob(background, jobKey(runId, li, "kitty"), connectionId, debugMode, (debug) =>
      writeKittyLines(deps, runId, li, { connectionId, debugMode: debug }),
    );
  });
}

/**
 * The job: reads the run again and writes his kitty lines in one call, under the content his fixed pack's stamp
 * stands for (an SFW pack's are SFW in any world, #2152), then adds them to it, leaving comfort and claw as they are.
 * Does nothing when the run, the love interest or his bible is gone, or the pack has kitty lines or may not be served.
 */
export async function writeKittyLines(
  deps: LineDeps,
  runId: string,
  li: LiId,
  { connectionId, debugMode }: { connectionId: string; debugMode: boolean },
): Promise<void> {
  const run = await readRun(deps.store, runId);
  const unit = run?.units.find((entry) => entry.id === li);
  const liState = run?.state.lis[li];
  const fixed = unit && run ? servableFixed(unit, run.world.content) : null;
  if (!run || !unit?.bible || !liState || !fixed || fixed.kitty) return;
  // A pack that may be served is stamped "home" or for the world's own settings: "home" writes under the SFW contract.
  const content =
    (fixed.contract ?? "home") === "home" ? { ...run.world.content, heat: "sfw" as const } : run.world.content;
  const { value } = await generateJson(deps, {
    runId,
    job: "structured",
    label: "kitty-lines",
    messages: linePackMessages({
      world: { ...run.world, content },
      player: run.player,
      unit,
      stage: liState.stage,
      withFixed: false,
      kittyOnly: true,
    }),
    schema: KittyLinesReplySchema,
    normalize: (reply) => {
      const kitty = pickKinds(reply.kitty, LINE_COUNTS.kitty, "kitty");
      return typeof kitty === "string" ? kitty : reply;
    },
    maxTokens: LINE_PACK_MAX_TOKENS,
    debugMode,
    lane: "background",
    connectionId,
  });
  const kitty = pickKinds(value.kitty, LINE_COUNTS.kitty, "kitty");
  if (typeof kitty === "string") return;
  await deps.store.updateDoc(runDocTarget("unit", unitId(runId, li)), normalizeUnit, (current) => {
    const now = current.lines?.fixed;
    // A pack that has kitty lines by now (a new P15 pack holds them) keeps its own.
    if (!current.lines || !now || now.kitty) return current;
    return { ...current, lines: { ...current.lines, fixed: { ...now, kitty } } };
  });
}
