// ──────────────────────────────────────────────
// Otome Forge: the forge job that turns a new world's setup into a playable world (plan M1 "Forge job")
// ──────────────────────────────────────────────
// Steps: `world-plan`, then `bible:<li>` for each love interest, then (with an image connection) `paint:<li>` and
// `paint:player`, which wait for the player's consent.
// - Text steps run on the foreground lane, in the run's serial queue (runForeground), while the player watches the
//   progress screen. Each re-reads its step inside the queue and runs only while it is still `pending`.
// - The phase is `ready` once the world plan and every bible are done; painting can still be running.
// - A failed step waits for its Retry and is never retried by itself. A failed world plan holds the bibles back.
// - Paints run one at a time in their own queue per run, so a slow image never holds up the story, and only once
//   their love interest's bible (or, for the protagonist, the world plan) is done.
// - A step that reads `running` with no live owner in this process (the server restarted), or `pending` with no job
//   left to run it, is shown and stored as `failed` (error "stopped"), with Retry.
// A step's `error` is an OtomeErrorCode when the failure has one, "stopped" after a restart, else "failed"; the
// English detail goes to the logs, and a failed paint keeps it on its paint record.
import type {
  ForgeStatus,
  ForgeStep,
  LiId,
  Paint,
  World,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { forgePrerequisite } from "../../../../../client/src/features/otome-forge/shared/forge.js";
import { claimPaint, paintClaimed, paintIsLive, type ArtDeps, type LookOwner } from "../art/paint.js";
import type { ImagePrompt } from "../art/prompts.js";
import { generateJson, runForeground } from "../generation.js";
import { OtomeForgeError } from "../http.js";
import { ID_PREFIX, INDEX_ID, INDEX_TARGET, runDocTarget, unitId, worldId } from "../ids.js";
import { normalizeIndex } from "../schemas/index.js";
import { readRun } from "../schemas/state.js";
import { BibleSchema, normalizeUnit } from "../schemas/unit.js";
import { normalizeWorld } from "../schemas/world.js";
import { checkBible } from "./bible.js";
import {
  bibleMessages,
  castOf,
  normalizeWorldPlan,
  withPersonaStoryAbout,
  worldPlanMessages,
  WorldPlanSchema,
  type WorldPlan,
} from "./prompts.js";
import { intimacyOpen } from "../../../../../client/src/features/otome-forge/shared/content.js";

export type ForgeDeps = ArtDeps;

export const WORLD_PLAN_STEP = "world-plan";
export const PLAYER_PAINT_STEP = "paint:player";
export const bibleStepId = (li: LiId) => `bible:${li}`;
export const paintStepId = (owner: LookOwner) => (owner === "player" ? PLAYER_PAINT_STEP : `paint:${owner.slice(3)}`);

const STOPPED = "stopped";
const FAILED = "failed";

const isTextStep = (id: string) => id === WORLD_PLAN_STEP || id.startsWith("bible:");
function paintOwner(stepId: string): LookOwner | null {
  if (stepId === PLAYER_PAINT_STEP) return "player";
  return stepId.startsWith("paint:") ? (`li:${stepId.slice("paint:".length)}` as LookOwner) : null;
}

/** One paint step per love interest and the protagonist's, each waiting for the player's tap. */
function paintSteps(liIds: readonly LiId[]): ForgeStep[] {
  return [...liIds.map((li) => `li:${li}` as LookOwner), "player" as const].map((owner): ForgeStep => ({
    id: paintStepId(owner),
    state: "waiting-consent",
    paid: true,
  }));
}

/** The steps a new world starts with; the paint steps only when it has an image connection. */
export function initialForge(liIds: readonly LiId[], withImages: boolean): ForgeStatus {
  return {
    phase: "forging",
    steps: [
      { id: WORLD_PLAN_STEP, state: "pending" },
      ...liIds.map((li): ForgeStep => ({ id: bibleStepId(li), state: "pending" })),
      ...(withImages ? paintSteps(liIds) : []),
    ],
  };
}

/**
 * The forge with each missing paint step added, waiting for consent: a world made without images that gains an image
 * connection in Settings. Existing steps are kept as they are, so nothing is repainted and nothing paints untapped.
 */
export function withPaintSteps(forge: ForgeStatus): ForgeStatus {
  const liIds = forge.steps.filter((step) => step.id.startsWith("bible:")).map((step) => step.id.slice(6));
  const have = new Set(forge.steps.map((step) => step.id));
  const missing = paintSteps(liIds).filter((step) => !have.has(step.id));
  return missing.length ? { ...forge, steps: [...forge.steps, ...missing] } : forge;
}

// ── Jobs and owners alive in this process ──

const textJobs = new Map<string, number>();
const paintJobs = new Map<string, number>();
const liveTextSteps = new Set<string>();
const paintLane = (runId: string) => `${runId}#paint`;

function schedule(
  deps: ForgeDeps,
  jobs: Map<string, number>,
  lane: string,
  runId: string,
  task: () => Promise<void>,
): void {
  jobs.set(runId, (jobs.get(runId) ?? 0) + 1);
  void runForeground(lane, task)
    .catch((error) =>
      // A run deleted mid-forge ends its job here: every write refuses to bring the run back.
      error instanceof OtomeForgeError && error.code === "not-found"
        ? deps.runtime.logger.info("[otome-forge] The forge job for %s ended: the run was deleted", runId)
        : deps.runtime.logger.error(error, "Otome Forge: the forge job for %s stopped", runId),
    )
    .finally(() => {
      const left = (jobs.get(runId) ?? 1) - 1;
      if (left > 0) jobs.set(runId, left);
      else jobs.delete(runId);
    });
}

/**
 * Counts a job for the run before its step is stored as pending, so a concurrent settleForge never takes that step
 * for one whose job stopped. Release it once the real job is scheduled (or the write failed).
 */
function holdJob(jobs: Map<string, number>, runId: string): () => void {
  jobs.set(runId, (jobs.get(runId) ?? 0) + 1);
  return () => {
    const left = (jobs.get(runId) ?? 1) - 1;
    if (left > 0) jobs.set(runId, left);
    else jobs.delete(runId);
  };
}

/** Resolves once every forge job queued for the run so far has finished (tests, and anything that must wait). */
export async function forgeSettled(runId: string): Promise<void> {
  await runForeground(runId, async () => undefined);
  await runForeground(paintLane(runId), async () => undefined);
}

// ── The world document ──

const stepOf = (world: World, id: string) => world.forge.steps.find((step) => step.id === id);

/** A paint step may run once its look exists: the love interest's bible, or (protagonist) the world plan. */
function paintReady(world: World, stepId: string): boolean {
  const prerequisite = paintOwner(stepId) && forgePrerequisite(stepId);
  return !!prerequisite && stepOf(world, prerequisite)?.state === "done";
}

function withStep(world: World, id: string, patch: Partial<ForgeStep>): World {
  return {
    ...world,
    forge: {
      ...world.forge,
      steps: world.forge.steps.map((step) => {
        if (step.id !== id) return step;
        const { error: _error, ...rest } = step;
        return { ...rest, ...patch };
      }),
    },
  };
}

const runNotFound = () => new OtomeForgeError(404, "No such Otome Forge run.", "not-found");

/** Changes the run's world and recomputes the phase; a deleted world stays deleted (404). */
async function updateWorld(deps: ForgeDeps, runId: string, change: (world: World) => World): Promise<World> {
  const world = await deps.store.updateDoc(runDocTarget("world", worldId(runId)), normalizeWorld, (current): World => {
    const next = change(current);
    const ready = next.forge.steps.filter((step) => isTextStep(step.id)).every((step) => step.state === "done");
    return { ...next, forge: { ...next.forge, phase: ready ? "ready" : "forging" } };
  });
  if (!world) throw runNotFound();
  return world;
}

const readWorld = (deps: ForgeDeps, runId: string) => deps.store.readDoc(worldId(runId), normalizeWorld);

const errorCode = (error: unknown) => (error instanceof OtomeForgeError && error.code) || FAILED;

/** The world with every stale step failed: running with no live owner, or pending with no job left to run it. */
function settled(world: World, runId: string): World {
  const textLive = textJobs.has(runId);
  const paintLive = paintJobs.has(runId);
  const planDone = stepOf(world, WORLD_PLAN_STEP)?.state === "done";
  let changed = false;
  const steps = world.forge.steps.map((step): ForgeStep => {
    const owner = paintOwner(step.id);
    const stale = isTextStep(step.id)
      ? (step.state === "running" && !liveTextSteps.has(`${runId}|${step.id}`)) ||
        (step.state === "pending" && !textLive && (step.id === WORLD_PLAN_STEP || planDone))
      : !!owner &&
        ((step.state === "running" && !paintIsLive(runId, owner)) ||
          (step.state === "pending" && !textLive && !paintLive && paintReady(world, step.id)));
    if (!stale) return step;
    changed = true;
    return { ...step, state: "failed", error: STOPPED };
  });
  return changed ? { ...world, forge: { ...world.forge, steps } } : world;
}

/**
 * The run's world with stale steps stored as failed (GET /runs/:run and the forge routes call this first), or null
 * when the run has no world.
 */
export async function settleForge(deps: ForgeDeps, runId: string): Promise<World | null> {
  const world = await readWorld(deps, runId);
  if (!world || settled(world, runId) === world) return world;
  return updateWorld(deps, runId, (current) => settled(current, runId));
}

// ── Text steps ──

/** Runs one text step if it is still pending: running, then `write` (which marks it done), or failed. */
async function runTextStep(deps: ForgeDeps, runId: string, stepId: string, write: () => Promise<void>) {
  const current = await readWorld(deps, runId);
  if (!current || stepOf(current, stepId)?.state !== "pending") return;
  const key = `${runId}|${stepId}`;
  liveTextSteps.add(key);
  try {
    let claimed = false;
    await updateWorld(deps, runId, (world) => {
      claimed = stepOf(world, stepId)?.state === "pending";
      return claimed ? withStep(world, stepId, { state: "running" }) : world;
    });
    if (!claimed) return;
    try {
      await write();
    } catch (error) {
      if (error instanceof OtomeForgeError) {
        deps.runtime.logger.warn("[otome-forge] forge step %s failed: %s", stepId, error.message);
      } else {
        deps.runtime.logger.error(error, "Otome Forge: forge step %s failed", stepId);
      }
      await updateWorld(deps, runId, (world) => withStep(world, stepId, { state: "failed", error: errorCode(error) }));
    }
  } finally {
    liveTextSteps.delete(key);
  }
}

/** The run's love interests in setup order (the order of their bible steps). */
async function readCast(deps: ForgeDeps, runId: string) {
  const run = await readRun(deps.store, runId);
  if (!run) throw runNotFound();
  const order = run.world.forge.steps.filter((step) => step.id.startsWith("bible:")).map((step) => step.id.slice(6));
  const units = order.flatMap((li) => run.units.filter((unit) => unit.id === li));
  return { ...run, player: await withPersonaStoryAbout(deps.runtime, run.player), units };
}

async function writeWorldPlan(deps: ForgeDeps, runId: string, debugMode: boolean): Promise<void> {
  const { world, player, units } = await readCast(deps, runId);
  const cast = await castOf(deps.runtime, units);
  const { value } = await generateJson(deps, {
    runId,
    job: "structured",
    label: "world-plan",
    messages: worldPlanMessages({ world, player, cast }),
    schema: WorldPlanSchema,
    normalize: (reply) => {
      const plan = normalizeWorldPlan(reply, cast);
      return typeof plan === "string" ? plan : reply;
    },
    temperature: 0.8,
    maxTokens: 3000,
    debugMode,
    lane: "foreground",
  });
  const plan = normalizeWorldPlan(value, cast) as WorldPlan;
  await updateWorld(deps, runId, (current) =>
    withStep(
      {
        ...current,
        title: current.title.trim() || plan.title,
        setting: plan.setting,
        mystery: plan.mystery,
        web: plan.web,
        openingSituation: plan.openingSituation,
      },
      WORLD_PLAN_STEP,
      { state: "done" },
    ),
  );
  // A world started without a title takes the plan's, in the run list too.
  const runKey = runId.slice(ID_PREFIX.length);
  const index = await deps.store.readDoc(INDEX_ID, normalizeIndex);
  if (plan.title && index?.runs.some((run) => run.runKey === runKey && !run.title.trim())) {
    await deps.store.updateDoc(INDEX_TARGET, normalizeIndex, (current) => ({
      ...current,
      runs: current.runs.map((run) =>
        run.runKey === runKey && !run.title.trim() ? { ...run, title: plan.title } : run,
      ),
    }));
  }
}

const VOICE_GENDER = { man: "male", woman: "female", person: "" } as const;

async function writeBible(deps: ForgeDeps, runId: string, li: LiId, debugMode: boolean): Promise<void> {
  const { world, player, units } = await readCast(deps, runId);
  const unit = units.find((candidate) => candidate.id === li);
  if (!unit) throw new OtomeForgeError(404, "No such love interest.", "not-found");
  const others = units.filter((candidate) => candidate.id !== li);
  const [member] = await castOf(deps.runtime, [unit]);
  const context = {
    pronouns: unit.pronouns,
    others: others.map(({ id, name }) => ({ id, name })),
    intimacy: intimacyOpen(world.content),
  };
  const { value } = await generateJson(deps, {
    runId,
    job: "structured",
    label: `bible/${li}`,
    messages: bibleMessages({ world, player, member, others: others.map((other) => ({ unit: other })) }),
    schema: BibleSchema,
    normalize: (bible) => checkBible(bible, context),
    temperature: 0.8,
    maxTokens: 5000,
    debugMode,
    lane: "foreground",
  });
  const saved = await deps.store.updateDoc(runDocTarget("unit", unitId(runId, li)), normalizeUnit, (current) => ({
    ...current,
    bible: value,
    bibleEdited: false,
    identityLine: value.look.identityLine,
    outfitLine: value.look.outfitLine,
    voiceGender: current.voiceGender || VOICE_GENDER[value.look.presentation],
  }));
  if (!saved) throw new OtomeForgeError(404, "No such love interest.", "not-found");
  await updateWorld(deps, runId, (current) => withStep(current, bibleStepId(li), { state: "done" }));
}

async function runTextSteps(deps: ForgeDeps, runId: string, debugMode: boolean): Promise<void> {
  if (!(await readWorld(deps, runId))) return;
  await runTextStep(deps, runId, WORLD_PLAN_STEP, () => writeWorldPlan(deps, runId, debugMode));
  const world = await readWorld(deps, runId);
  if (!world || stepOf(world, WORLD_PLAN_STEP)?.state !== "done") return;
  for (const step of world.forge.steps) {
    if (!step.id.startsWith("bible:") || step.state !== "pending") continue;
    const li = step.id.slice("bible:".length);
    await runTextStep(deps, runId, step.id, () => writeBible(deps, runId, li, debugMode));
  }
  // Paints the player consented to while the text was being written.
  const after = await readWorld(deps, runId);
  if (after?.forge.steps.some((step) => step.state === "pending" && paintReady(after, step.id))) {
    schedulePaints(deps, runId, debugMode);
  }
}

function scheduleText(deps: ForgeDeps, runId: string, debugMode: boolean): void {
  schedule(deps, textJobs, runId, runId, () => runTextSteps(deps, runId, debugMode));
}

/** Starts a new world's text steps in the background (POST /runs calls this once the run's documents exist). */
export function startForge(deps: ForgeDeps, runId: string, { debugMode }: { debugMode: boolean }): void {
  scheduleText(deps, runId, debugMode);
}

// ── Paint steps ──

/**
 * Paints the owner's look after an explicit tap, keeping its forge step (when the world has one) in step: running,
 * then done or failed. A 409 `busy` while that look is already being painted.
 */
export async function paintWithStep(
  deps: ForgeDeps,
  runId: string,
  owner: LookOwner,
  options: Partial<ImagePrompt> & { debugMode: boolean },
): Promise<Paint> {
  const release = claimPaint(runId, owner);
  const stepId = paintStepId(owner);
  try {
    const world = await readWorld(deps, runId);
    if (!world) throw runNotFound();
    const hasStep = !!stepOf(world, stepId);
    const mark = (patch: Partial<ForgeStep>) =>
      hasStep ? updateWorld(deps, runId, (current) => withStep(current, stepId, patch)) : Promise.resolve(world);
    await mark({ state: "running" });
    let paint: Paint;
    try {
      paint = await paintClaimed(deps, runId, owner, options);
    } catch (error) {
      await mark({ state: "failed", error: errorCode(error) });
      throw error;
    }
    await mark(paint.state === "ready" ? { state: "done" } : { state: "failed", error: FAILED });
    return paint;
  } finally {
    release();
  }
}

async function runPaintSteps(deps: ForgeDeps, runId: string, debugMode: boolean): Promise<void> {
  // Each step at most once per pass: one that could not even start stays pending for settleForge to fail.
  const tried = new Set<string>();
  for (;;) {
    const world = await readWorld(deps, runId);
    const next = world?.forge.steps.find(
      (step) => step.state === "pending" && !tried.has(step.id) && paintReady(world, step.id),
    );
    const owner = next && paintOwner(next.id);
    if (!next || !owner) return;
    tried.add(next.id);
    try {
      await paintWithStep(deps, runId, owner, { debugMode });
    } catch (error) {
      // `busy`: a tap on the art route is painting this look already, and that paint owns the step.
      if (!(error instanceof OtomeForgeError && error.code === "busy")) {
        deps.runtime.logger.warn("[otome-forge] forge paint %s failed: %s", next.id, String(error));
      }
    }
  }
}

function schedulePaints(deps: ForgeDeps, runId: string, debugMode: boolean): void {
  schedule(deps, paintJobs, paintLane(runId), runId, () => runPaintSteps(deps, runId, debugMode));
}

// ── Retry and consent (the forge routes) ──

/** Sends a failed step back to its queue. 404 for an unknown step, 409 `conflict` unless it failed. */
export async function retryForgeStep(
  deps: ForgeDeps,
  runId: string,
  stepId: string,
  { debugMode }: { debugMode: boolean },
): Promise<ForgeStatus> {
  const world = await settleForge(deps, runId);
  if (!world) throw runNotFound();
  const step = stepOf(world, stepId);
  if (!step) throw new OtomeForgeError(404, `No forge step ${stepId.slice(0, 80)}.`, "not-found");
  if (step.state !== "failed") throw new OtomeForgeError(409, "Only a failed step can be retried.", "conflict");
  const release = holdJob(isTextStep(stepId) ? textJobs : paintJobs, runId);
  try {
    const next = await updateWorld(deps, runId, (current) =>
      stepOf(current, stepId)?.state === "failed" ? withStep(current, stepId, { state: "pending" }) : current,
    );
    if (isTextStep(stepId)) scheduleText(deps, runId, debugMode);
    else schedulePaints(deps, runId, debugMode);
    return next.forge;
  } finally {
    release();
  }
}

/**
 * The player's consent to paint: each listed paint step that waits for it is queued, and paints once its look
 * exists. Steps in any other state are left alone, so a second tap never paints twice.
 */
export async function consentForge(
  deps: ForgeDeps,
  runId: string,
  stepIds: readonly string[],
  { debugMode }: { debugMode: boolean },
): Promise<ForgeStatus> {
  if (stepIds.some((id) => !paintOwner(id))) {
    throw new OtomeForgeError(400, "Only paint steps wait for consent.", "bad-request");
  }
  const world = await settleForge(deps, runId);
  if (!world) throw runNotFound();
  if (!world.images.connectionId) {
    throw new OtomeForgeError(503, "This world has no image connection.", "no-connection");
  }
  const wanted = new Set(stepIds);
  const release = holdJob(paintJobs, runId);
  try {
    const next = await updateWorld(deps, runId, (current) => ({
      ...current,
      forge: {
        ...current.forge,
        steps: current.forge.steps.map((step) =>
          wanted.has(step.id) && step.state === "waiting-consent" ? { ...step, state: "pending" } : step,
        ),
      },
    }));
    schedulePaints(deps, runId, debugMode);
    return next.forge;
  } finally {
    release();
  }
}
