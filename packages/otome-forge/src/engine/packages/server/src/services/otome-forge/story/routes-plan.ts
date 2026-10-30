// ──────────────────────────────────────────────
// Otome Forge: route chapters (P10) and repair chapters (P11), plan M2b "Arcs"
// ──────────────────────────────────────────────
// A route chapter `route-<li>-<s>` is his own story toward stage s: free, opened once his affection reaches the
// stage's level and no rupture stands (SH/arcs.ts routeStatus), planned on the player's tap (POST
// /runs/:run/routes/:li/next). Its plan has 4–6 nodes, him in every one, and its gate as the last node; the gate
// reveals every secret due at that stage (his stage-4 secret at stage 4), a stage-5 chapter holds one confrontation
// before the gate (whose beat ends on a big choice), and at most one confrontation is allowed otherwise, never as the
// gate. The planner is told only that the chapter MAY move him; the gate's read moves the stage
// (S/state/stages.ts).
// A repair chapter `repair-<li>-<n>` is offered while a rupture stands (POST /runs/:run/repairs/:li): 2–3 nodes of beats
// or moments, him in every one, its last node resolving the rupture's grievance.
// Both are idempotent: the chapter a key already has is returned as it is, and planning runs in the run's foreground
// queue, which reads again first, so two taps plan once. Both are private to him (memory audience [li]), pay as their
// kind (route 300 Starlight and 150 affection; repair as a main chapter) and have no Foil.
import type {
  ArcStageKey,
  Chapter,
  ChapterNode,
  LiId,
  RunState,
  Unit,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import {
  REPAIR_NODES_MAX,
  REPAIR_NODES_MIN,
  ROUTE_NODES_MAX,
  ROUTE_NODES_MIN,
  routeStatus,
  stageRow,
} from "../../../../../client/src/features/otome-forge/shared/arcs.js";
import { generateJson, readOrGenerate } from "../generation.js";
import { OtomeForgeError } from "../http.js";
import { chapterId, mainChapterNumber, runDocTarget, stateId } from "../ids.js";
import { defaultLiState, normalizeState, readRun, type RunDocuments } from "../schemas/state.js";
import { normalizeChapter } from "../schemas/story.js";
import { repairOffers } from "../state/stages.js";
import { withPersonaStoryAbout } from "../setup/prompts.js";
import { recallText } from "./canon.js";
import {
  clean,
  planLedger,
  planNodes,
  planTags,
  type ChapterDeps,
  type PlanContext,
  type PlannedChapter,
} from "./chapters.js";
import { ChapterPlanSchema, repairPlanMessages, routePlanMessages, type ChapterPlanReply } from "./prompts.js";

const notFound = (what: string) => new OtomeForgeError(404, `No such ${what}.`, "not-found");
const locked = (message: string) => new OtomeForgeError(409, message, "locked");

/** The newest main chapter number the state has finished (route and repair conflicts are dated by it), or 0. */
function latestMain(state: RunState): number {
  let latest = 0;
  for (const [key, progress] of Object.entries(state.chapters)) {
    const number = progress.completed ? (mainChapterNumber(key) ?? 0) : 0;
    if (number > latest) latest = number;
  }
  return latest;
}

export interface ArcPlanContext extends Omit<PlanContext, "lead"> {
  /** Whose chapter it is. */
  li: LiId;
}

/**
 * What both plans check: node count, no Closer (a main chapter's warm climax; a route keeps its Confrontation), him in
 * every node, at most two CGs, the tags and the ledger.
 */
function planArc(
  reply: ChapterPlanReply,
  context: ArcPlanContext,
  { min, max, idPrefix }: { min: number; max: number; idPrefix: string },
): { nodes: ChapterNode[]; tags: string[]; ledger: PlannedChapter["ledger"] } | string {
  if (reply.nodes.length < min || reply.nodes.length > max) {
    return `the chapter needs ${min} to ${max} nodes, not ${reply.nodes.length}`;
  }
  const nodes = planNodes(reply, context);
  if (nodes.some((node) => node.kind === "closer")) return "a route or repair chapter has no closer node";
  const away = nodes.find((node) => !node.cast.includes(context.li));
  if (away) return `${context.li} must be in every node; node ${away.i + 1} leaves them out`;
  if (nodes.filter((node) => node.cg).length > 2) return "at most 2 nodes may have cg";
  const tags = planTags(reply, context.world);
  if (typeof tags === "string") return tags;
  const present = new Set(nodes.flatMap((node) => node.cast));
  const ledger = planLedger(reply, context, present, { main: false, idPrefix, knows: [context.li] });
  if (typeof ledger === "string") return ledger;
  return { nodes, tags, ledger };
}

/**
 * P10's reply as a route chapter toward `stage`, or the first rule it breaks. The gate is the last node; it reveals
 * every secret of his due at that stage.
 */
export function normalizeRoutePlan(
  reply: ChapterPlanReply,
  context: ArcPlanContext & { stage: number; secrets: NonNullable<Unit["bible"]>["secrets"] },
): PlannedChapter | string {
  const { stage } = context;
  const arc = planArc(reply, context, {
    min: ROUTE_NODES_MIN,
    max: ROUTE_NODES_MAX,
    idPrefix: `c-route-${stage}-${context.li}`,
  });
  if (typeof arc === "string") return arc;
  const last = arc.nodes.length - 1;
  const confrontations = arc.nodes.filter((node) => node.kind === "confrontation");
  if (stageRow(stage).gate === "confrontation") {
    if (confrontations.length !== 1) {
      return `a stage ${stage} route chapter needs exactly one confrontation node before the gate, not ${confrontations.length}`;
    }
  } else if (confrontations.length > 1) {
    return "a route chapter has at most one confrontation node";
  }
  if (arc.nodes[last]!.kind === "confrontation") return "the gate (the last node) cannot be the confrontation";
  if (arc.nodes.filter((node) => node.kind === "moment").length > 2) return "at most 2 moment nodes";
  const reveals = context.secrets.filter((secret) => secret.revealAt.stage === stage).map((secret) => secret.id);
  const nodes = arc.nodes.map((node) =>
    node.i === last ? { ...node, gate: true, ...(reveals.length ? { reveals } : {}) } : node,
  );
  return {
    title: clean(reply.title, 200),
    tags: arc.tags,
    summary: clean(reply.summary, 1200),
    nodes,
    ledger: arc.ledger,
  };
}

/** P11's reply as a repair chapter, or the first rule it breaks. Its last node resolves the rupture's grievance. */
export function normalizeRepairPlan(
  reply: ChapterPlanReply,
  context: ArcPlanContext & { grievance: string; key: string },
): PlannedChapter | string {
  const arc = planArc(reply, context, { min: REPAIR_NODES_MIN, max: REPAIR_NODES_MAX, idPrefix: `c-${context.key}` });
  if (typeof arc === "string") return arc;
  if (arc.nodes.some((node) => node.kind === "confrontation")) return "a repair chapter has no confrontation node";
  const last = arc.nodes.length - 1;
  const nodes = arc.nodes.map((node) =>
    node.i === last ? { ...node, resolves: [...new Set([...(node.resolves ?? []), context.grievance])] } : node,
  );
  return {
    title: clean(reply.title, 200),
    tags: arc.tags,
    summary: clean(reply.summary, 1200),
    nodes,
    ledger: arc.ledger,
  };
}

// ── Planning ──

/** The run's love interests that have a bible, in cast order. */
function castOf(run: RunDocuments): Unit[] {
  return Object.keys(run.state.lis).flatMap((li) => run.units.filter((unit) => unit.id === li && unit.bible));
}

async function readyRun(deps: ChapterDeps, runId: string, li: LiId) {
  const run = await readRun(deps.store, runId);
  if (!run) throw notFound("Otome Forge run");
  if (run.world.forge.phase !== "ready") throw new OtomeForgeError(409, "The world is still being forged.", "conflict");
  const units = castOf(run);
  const unit = units.find((item) => item.id === li);
  if (!unit) throw notFound("love interest");
  return { run: { ...run, player: await withPersonaStoryAbout(deps.runtime, run.player) }, units, unit };
}

/** Saves the planned chapter (a chapter another request saved first wins) and starts its reading progress. */
async function saveChapter(deps: ChapterDeps, runId: string, chapter: Chapter): Promise<Chapter> {
  const saved = await deps.store.mutateDoc(
    runDocTarget("chapter", chapterId(runId, chapter.key)),
    normalizeChapter,
    (current) => current ?? chapter,
  );
  await deps.store.updateDoc(runDocTarget("state", stateId(runId)), normalizeState, (state) =>
    state.chapters[chapter.key]
      ? state
      : { ...state, chapters: { ...state.chapters, [chapter.key]: { beatsRead: 0, completed: null, applied: [] } } },
  );
  return saved ?? chapter;
}

/**
 * POST /runs/:run/routes/:li/next: his route chapter toward the next stage. The chapter the key already has is
 * returned as it is; otherwise 409 `locked` while his affection is too low, a rupture stands, or his route is complete.
 */
export async function planRouteChapter(
  deps: ChapterDeps,
  runId: string,
  li: LiId,
  { debugMode, signal }: { debugMode: boolean; signal?: AbortSignal },
): Promise<Chapter> {
  const { run, units, unit } = await readyRun(deps, runId, li);
  const status = routeStatus(li, run.state.lis[li] ?? defaultLiState());
  const next = status.next;
  if (!next) throw locked(`${unit.name}'s route is complete.`);
  const read = () => deps.store.readDoc(chapterId(runId, next.key), normalizeChapter);
  const stored = await read();
  if (stored) return stored;
  if (!next.unlocked) {
    throw locked(
      next.blockedBy === "rupture"
        ? `A rupture stands between you and ${unit.name}: repair it first.`
        : `${unit.name}'s next route chapter opens at affection level ${next.requires.level}.`,
    );
  }
  return readOrGenerate(runId, read, async () => {
    signal?.throwIfAborted();
    // Read again in the queue: a rupture may have opened, or the stage moved, while this waited.
    const state = (await deps.store.readDoc(stateId(runId), normalizeState)) ?? run.state;
    const now = routeStatus(li, state.lis[li] ?? defaultLiState()).next;
    if (!now || now.key !== next.key || !now.unlocked) throw locked(`${unit.name}'s route chapter is not open now.`);
    const memory = await recallText(deps, runId, {
      job: "structured",
      cast: [li],
      query: {
        plan: unit.bible?.arc[String(next.stage) as ArcStageKey]?.seed ?? unit.bible?.want ?? "",
        speakers: [unit.name],
      },
      signal,
      debugMode,
    });
    const context = {
      units,
      state,
      world: run.world,
      number: latestMain(state),
      li,
      stage: next.stage,
      secrets: unit.bible?.secrets ?? [],
    };
    const { value, connectionId } = await generateJson(deps, {
      runId,
      job: "structured",
      label: `route-plan/${next.key}`,
      messages: routePlanMessages({
        world: run.world,
        player: run.player,
        units,
        state,
        li,
        stage: next.stage,
        memory,
      }),
      schema: ChapterPlanSchema,
      normalize: (reply) => {
        const plan = normalizeRoutePlan(reply, context);
        return typeof plan === "string" ? plan : reply;
      },
      temperature: 0.8,
      maxTokens: 3500,
      debugMode,
      lane: "foreground",
      signal,
    });
    signal?.throwIfAborted();
    const { foil: _foil, ...plan } = normalizeRoutePlan(value, context) as PlannedChapter;
    return saveChapter(deps, runId, {
      key: next.key,
      kind: "route",
      li,
      stage: next.stage,
      lead: li,
      ...plan,
      plannedAt: new Date().toISOString(),
      connectionId,
    });
  });
}

/** Every repair chapter of the run, oldest first. */
async function repairChapters(deps: Pick<ChapterDeps, "store">, runId: string): Promise<Chapter[]> {
  return (await deps.store.listRun("chapter", runId))
    .map((record) => normalizeChapter(record.data))
    .filter((chapter): chapter is Chapter => !!chapter && chapter.kind === "repair")
    .sort((a, b) => a.plannedAt.localeCompare(b.plannedAt));
}

/**
 * POST /runs/:run/repairs/:li ("Make it right"): the repair for the rupture with him. The unfinished one already
 * planned for that grievance is returned as it is; 409 `conflict` when no rupture stands.
 */
export async function planRepairChapter(
  deps: ChapterDeps,
  runId: string,
  li: LiId,
  { debugMode, signal }: { debugMode: boolean; signal?: AbortSignal },
): Promise<Chapter> {
  const { run, units, unit } = await readyRun(deps, runId, li);
  const rupture = run.state.lis[li]?.rupture;
  if (!rupture) throw new OtomeForgeError(409, `Nothing stands between you and ${unit.name} to repair.`, "conflict");
  const offer = repairOffers(await repairChapters(deps, runId), run.state, [li])[0]!;
  const read = () => deps.store.readDoc(chapterId(runId, offer.key), normalizeChapter);
  const stored = await read();
  if (stored) return stored;
  return readOrGenerate(runId, read, async () => {
    signal?.throwIfAborted();
    const state = (await deps.store.readDoc(stateId(runId), normalizeState)) ?? run.state;
    const now = state.lis[li]?.rupture;
    if (!now || now.grievanceId !== rupture.grievanceId) {
      throw new OtomeForgeError(409, `The rupture with ${unit.name} changed. Open the story again.`, "conflict");
    }
    const grievance = state.lis[li]?.grievances.find((item) => item.id === rupture.grievanceId);
    if (!grievance) throw new OtomeForgeError(409, "That rupture has no grievance to repair.", "conflict");
    const memory = await recallText(deps, runId, {
      job: "structured",
      cast: [li],
      query: { plan: grievance.text, speakers: [unit.name] },
      signal,
      debugMode,
    });
    const context = {
      units,
      state,
      world: run.world,
      number: latestMain(state),
      li,
      grievance: grievance.id,
      key: offer.key,
    };
    const { value, connectionId } = await generateJson(deps, {
      runId,
      job: "structured",
      label: `repair-plan/${offer.key}`,
      messages: repairPlanMessages({ world: run.world, player: run.player, units, state, li, grievance, memory }),
      schema: ChapterPlanSchema,
      normalize: (reply) => {
        const plan = normalizeRepairPlan(reply, context);
        return typeof plan === "string" ? plan : reply;
      },
      temperature: 0.7,
      maxTokens: 2500,
      debugMode,
      lane: "foreground",
      signal,
    });
    signal?.throwIfAborted();
    const { foil: _foil, ...plan } = normalizeRepairPlan(value, context) as PlannedChapter;
    return saveChapter(deps, runId, {
      key: offer.key,
      kind: "repair",
      li,
      grievance: grievance.id,
      lead: li,
      ...plan,
      plannedAt: new Date().toISOString(),
      connectionId,
    });
  });
}
