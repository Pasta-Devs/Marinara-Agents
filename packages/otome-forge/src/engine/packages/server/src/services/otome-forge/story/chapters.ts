// ──────────────────────────────────────────────
// Otome Forge: main chapters. Who may lead the next one, its plan (P5), and the story's chapter list
// ──────────────────────────────────────────────
// The server offers two Lead candidates (design: Lead and Foil): the love interest featured least recently (lowest
// lastLead; never led counts lowest; ties by cast order), and the one with the ripest open conflict (highest
// ripeness above 0: tension + 2 × unresolved grievances + 3 for a rupture; ties by cast order). When nobody's conflict
// is ripe, or the ripest is also the least recent, the second candidate is the next least recent. The player picks
// one; the planner picks the Foil.
// A plan is checked before it is saved (normalizeChapterPlan): 6–9 nodes, 1–2 moments, exactly one confrontation as
// the climax, at most two CG nodes, the Lead and the Foil each in at least one node, every love interest in chapter 1,
// an off-screen line for each absent one, no tag for a Line, and conflict seeds that never repeat that love interest's
// last two kinds of angst, counting the seeds planted earlier in the same plan (at most one open misunderstanding
// each, resolved within two chapters). A failed check is the generation core's one repair turn.
import type {
  Chapter,
  ChapterDetail,
  ChapterLedger,
  ChapterNode,
  LeadReason,
  LiId,
  LiState,
  RunState,
  StoryChapterEntry,
  StoryView,
  Unit,
  World,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { LIMIT_IDS, type LimitId } from "../../../../../client/src/features/otome-forge/shared/content.js";
import { generateJson, readOrGenerate, type GenerationDeps } from "../generation.js";
import { OtomeForgeError } from "../http.js";
import { beatId, chapterId, mainChapterKey, mainChapterNumber, runDocTarget, stateId } from "../ids.js";
import { defaultLiState, normalizeState, readRun } from "../schemas/state.js";
import { normalizeBeat, normalizeChapter, toChapterView } from "../schemas/story.js";
import type { OtomeStore } from "../store.js";
import { recallText, type StoryMemory } from "./canon.js";
import {
  ANGST_TYPES,
  CHAPTER_TAGS,
  ChapterPlanSchema,
  NODES_MAX,
  NODES_MIN,
  chapterPlanMessages,
  type ChapterPlanReply,
} from "./prompts.js";

export interface ChapterDeps extends GenerationDeps {
  store: OtomeStore;
  memory?: StoryMemory;
}

const notFound = (what: string) => new OtomeForgeError(404, `No such ${what}.`, "not-found");

// ── Lead candidates ──

/** His grievances still owed: open, or left to fester. */
const unresolved = (liState: LiState) =>
  liState.grievances.filter((item) => item.status === "open" || item.status === "festering");

/** How ripe his conflict is: tension + 2 × unresolved grievances, + 3 while a rupture stands. */
export function ripeness(liState: LiState): number {
  return liState.tension + 2 * unresolved(liState).length + (liState.rupture ? 3 : 0);
}

/** The two Lead candidates for the next main chapter, from `cast` (LI ids in cast order). */
export function leadCandidates(state: RunState, cast: readonly LiId[]): Array<{ li: LiId; reason: LeadReason }> {
  const lastLead = (li: LiId) => state.lis[li]?.lastLead ?? -1;
  const ripe = (li: LiId) => ripeness(state.lis[li] ?? defaultLiState());
  const byRecency = cast
    .map((li, order) => ({ li, order }))
    .sort((a, b) => lastLead(a.li) - lastLead(b.li) || a.order - b.order)
    .map(({ li }) => li);
  const leastRecent = byRecency[0];
  if (!leastRecent) return [];
  // Only a conflict that is there at all is ripe: with nothing between anyone, the next least recent leads instead.
  const ripest = cast.reduce<LiId | undefined>(
    (best, li) => (ripe(li) > (best ? ripe(best) : 0) ? li : best),
    undefined,
  );
  const ripeOther = ripest !== undefined && ripest !== leastRecent ? ripest : undefined;
  const second = ripeOther ?? byRecency[1];
  return [
    { li: leastRecent, reason: "least-recent" as const },
    ...(second ? [{ li: second, reason: ripeOther ? ("ripe-conflict" as const) : ("least-recent" as const) }] : []),
  ];
}

// ── P5 normalization ──

export interface PlanContext {
  /** Every love interest, in cast order. */
  units: ReadonlyArray<Pick<Unit, "id" | "name">>;
  state: RunState;
  world: Pick<World, "content">;
  number: number;
  lead: LiId;
}

/** A love interest named by id or, failing that, by exact name (case-insensitive). */
function resolveLi(units: PlanContext["units"], value: unknown): LiId | null {
  const key = typeof value === "string" ? value.trim() : "";
  if (!key) return null;
  const byId = units.find((unit) => unit.id === key);
  if (byId) return byId.id;
  const byName = units.filter((unit) => unit.name.trim().toLowerCase() === key.toLowerCase());
  return byName.length === 1 ? byName[0]!.id : null;
}

const clean = (value: unknown, max = 4000) => (typeof value === "string" ? value.trim().slice(0, max) : "");

export type PlannedChapter = Pick<Chapter, "title" | "tags" | "foil" | "summary" | "nodes" | "ledger">;

/** The plan in the chapter's shape, or the first rule it breaks (the repair turn names it). */
export function normalizeChapterPlan(reply: ChapterPlanReply, context: PlanContext): PlannedChapter | string {
  const { units, state, number, lead } = context;
  const ids = units.map((unit) => unit.id);
  const foil = resolveLi(units, reply.foil);
  if (!foil || foil === lead) return "foil must be the id of a love interest other than the Lead";
  if (reply.nodes.length < NODES_MIN || reply.nodes.length > NODES_MAX) {
    return `the chapter needs ${NODES_MIN} to ${NODES_MAX} nodes, not ${reply.nodes.length}`;
  }
  const grievanceIds = new Set(
    ids.flatMap((li) => unresolved(state.lis[li] ?? defaultLiState()).map((item) => item.id)),
  );
  const nodes: ChapterNode[] = reply.nodes.map((raw, i) => {
    const cast = [...new Set(raw.cast.map((value) => resolveLi(units, value)).filter((li): li is LiId => !!li))];
    const place = clean(raw.place, 120);
    const resolves = (raw.resolves ?? []).map((id) => clean(id, 80)).filter((id) => grievanceIds.has(id));
    return {
      i,
      kind: raw.kind,
      ...(raw.kind === "moment" ? { moment: raw.moment ?? "read-him" } : {}),
      guide: clean(raw.guide),
      cast,
      ...(place ? { place } : {}),
      ...(raw.cg ? { cg: true } : {}),
      ...(resolves.length ? { resolves } : {}),
    };
  });
  const moments = nodes.filter((node) => node.kind === "moment").length;
  if (moments < 1 || moments > 2) return `the chapter needs 1 or 2 moment nodes, not ${moments}`;
  const confrontations = nodes.flatMap((node) => (node.kind === "confrontation" ? [node.i] : []));
  if (confrontations.length !== 1)
    return `the chapter needs exactly one confrontation node, not ${confrontations.length}`;
  if (confrontations[0]! < nodes.length - 2) return "the confrontation must be the second-to-last or last node";
  if (nodes.filter((node) => node.cg).length > 2) return "at most 2 nodes may have cg";
  if (!nodes.some((node) => node.cast.includes(lead))) return "the Lead must appear in the chapter";
  if (!nodes.some((node) => node.cast.includes(foil))) return "the Foil must appear in at least one node";
  const present = new Set(nodes.flatMap((node) => node.cast));
  if (number === 1) {
    const missing = ids.filter((li) => !present.has(li));
    if (missing.length) return `chapter 1 must bring in every love interest; missing: ${missing.join(", ")}`;
  }

  const tags = [
    ...new Set(reply.tags.map((tag) => tag.trim().toLowerCase()).filter((tag) => CHAPTER_TAGS.includes(tag))),
  ];
  const lines = tags.filter(
    (tag): tag is LimitId =>
      (LIMIT_IDS as readonly string[]).includes(tag) && context.world.content.limits[tag as LimitId] === "line",
  );
  if (lines.length) return `the chapter reaches for a Line (${lines.join(", ")}); plan around it instead`;

  const ledger: ChapterLedger = { relationship: [], conflict: [], offscreen: [] };
  for (const row of reply.ledger.relationship) {
    const li = resolveLi(units, row.li);
    const line = clean(row.line, 600);
    if (li && line) ledger.relationship.push({ li, line });
  }
  const openConflicts = state.ledgers.conflicts.filter((row) => row.status === "open");
  const resolved = new Set<string>();
  // The kinds planted earlier in this plan, per love interest: they count as his newest angst and open conflicts.
  const plantedNow = new Map<LiId, string[]>();
  let planted = 0;
  for (const row of reply.ledger.conflict) {
    const li = resolveLi(units, row.li);
    const type = clean(row.type, 80).toLowerCase();
    if (!li) continue;
    if (row.action === "plant") {
      if (!(ANGST_TYPES as readonly string[]).includes(type))
        return `conflict type must be one of: ${ANGST_TYPES.join(", ")}`;
      const sofar = plantedNow.get(li) ?? [];
      const recent = [...(state.lis[li]?.angst ?? []), ...sofar].slice(-2);
      if (recent.includes(type)) {
        return `a new ${type} conflict for ${li} repeats one of their last two kinds of angst (${recent.join(", ")})`;
      }
      if (
        type === "misunderstanding" &&
        (sofar.includes("misunderstanding") ||
          openConflicts.some((open) => open.li === li && open.type === "misunderstanding" && !resolved.has(open.id)))
      ) {
        return `${li} already has an open misunderstanding; resolve it before planting another`;
      }
      plantedNow.set(li, [...sofar, type]);
      planted += 1;
      ledger.conflict.push({ id: `c${number}-${planted}`, li, type, action: "plant" });
      continue;
    }
    const open = openConflicts.find((item) => item.id === clean(row.id, 80));
    if (!open) continue;
    if (row.action === "resolve") resolved.add(open.id);
    ledger.conflict.push({ id: open.id, li: open.li, type: open.type, action: row.action });
  }
  const overdue = openConflicts.find(
    (open) => open.type === "misunderstanding" && number - open.chapter >= 2 && !resolved.has(open.id),
  );
  if (overdue) return `the misunderstanding ${overdue.id} must be resolved in this chapter`;
  for (const row of reply.ledger.offscreen) {
    const li = resolveLi(units, row.li);
    const line = clean(row.line, 600);
    if (li && line && !present.has(li) && !ledger.offscreen.some((entry) => entry.li === li)) {
      ledger.offscreen.push({ li, line });
    }
  }
  const absent = ids.filter((li) => !present.has(li) && !ledger.offscreen.some((entry) => entry.li === li));
  if (absent.length)
    return `ledger.offscreen needs a line for every love interest not in the chapter: ${absent.join(", ")}`;

  return { title: clean(reply.title, 200), tags, foil, summary: clean(reply.summary, 1200), nodes, ledger };
}

// ── Planning ──

/** The main chapters planned so far, by number. */
async function mainChapters(store: OtomeStore, runId: string): Promise<Chapter[]> {
  return (await store.listRun("chapter", runId))
    .map((record) => normalizeChapter(record.data))
    .filter((chapter): chapter is Chapter => !!chapter && chapter.kind === "main")
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
}

/** The number the next main chapter takes, and whether the player may start it (the latest one is done). */
function nextMain(chapters: readonly Chapter[], state: RunState): { number: number; open: boolean } {
  const latest = chapters.at(-1);
  if (!latest) return { number: 1, open: true };
  return { number: (latest.number ?? chapters.length) + 1, open: !!state.chapters[latest.key]?.completed };
}

/**
 * Plans the next main chapter with `lead` (POST /chapters/next). Idempotent: the chapter that number already has is
 * returned as it is. 409 `conflict` while the latest chapter is unfinished, 404 for a love interest not in the run.
 */
export async function planNextChapter(
  deps: ChapterDeps,
  runId: string,
  lead: LiId,
  { debugMode, signal }: { debugMode: boolean; signal?: AbortSignal },
): Promise<Chapter> {
  const run = await readRun(deps.store, runId);
  if (!run) throw notFound("Otome Forge run");
  if (run.world.forge.phase !== "ready") throw new OtomeForgeError(409, "The world is still being forged.", "conflict");
  const cast = Object.keys(run.state.lis).filter((li) => run.units.some((unit) => unit.id === li && unit.bible));
  if (!cast.includes(lead)) throw notFound("love interest");
  const { number, open } = nextMain(await mainChapters(deps.store, runId), run.state);
  const key = mainChapterKey(number);
  if (!open) {
    throw new OtomeForgeError(409, "Finish the current chapter before starting the next one.", "conflict");
  }
  const read = () => deps.store.readDoc(chapterId(runId, key), normalizeChapter);
  return readOrGenerate(runId, read, async () => {
    signal?.throwIfAborted();
    const units = cast.map((li) => run.units.find((unit) => unit.id === li)!);
    // ponytail: recalls for the Lead only, since the planner picks the Foil (plan M2a "Recall": cast [lead, foil]).
    // M2a's canon is all shared main chapters, so this changes nothing yet. Upgrade path, once dates are sources: a
    // second recall for the Foil after the plan names him, or keep [lead] so another man's private date never reaches
    // the node guides.
    const memory = await recallText(deps, runId, {
      job: "structured",
      cast: [lead],
      query: { plan: units.find((unit) => unit.id === lead)?.bible?.want ?? "", speakers: units.map((u) => u.name) },
      signal,
      debugMode,
    });
    const context: PlanContext = { units, state: run.state, world: run.world, number, lead };
    const { value, connectionId } = await generateJson(deps, {
      runId,
      job: "structured",
      label: `chapter-plan/${key}`,
      messages: chapterPlanMessages({
        world: run.world,
        player: run.player,
        units,
        state: run.state,
        number,
        lead,
        memory,
      }),
      schema: ChapterPlanSchema,
      normalize: (reply) => {
        const plan = normalizeChapterPlan(reply, context);
        return typeof plan === "string" ? plan : reply;
      },
      temperature: 0.8,
      maxTokens: 4000,
      debugMode,
      lane: "foreground",
      signal,
    });
    signal?.throwIfAborted();
    const plan = normalizeChapterPlan(value, context) as PlannedChapter;
    const chapter: Chapter = {
      key,
      kind: "main",
      number,
      lead,
      ...plan,
      plannedAt: new Date().toISOString(),
      connectionId,
    };
    const saved = await deps.store.mutateDoc(
      runDocTarget("chapter", chapterId(runId, key)),
      normalizeChapter,
      (current) => current ?? chapter,
    );
    await deps.store.updateDoc(runDocTarget("state", stateId(runId)), normalizeState, (state) =>
      state.chapters[key]
        ? state
        : { ...state, chapters: { ...state.chapters, [key]: { beatsRead: 0, completed: null, applied: [] } } },
    );
    return saved ?? chapter;
  });
}

// ── The story view ──

/**
 * GET /runs/:run/story: every chapter planned so far but dates, and the next main chapter's candidates when it may
 * start.
 */
export async function storyView(deps: { store: OtomeStore }, runId: string): Promise<StoryView> {
  const run = await readRun(deps.store, runId);
  if (!run) throw notFound("Otome Forge run");
  // Dates (M5) are played from Dates, not listed with the story.
  const chapters = (await deps.store.listRun("chapter", runId))
    .map((record) => normalizeChapter(record.data))
    .filter((chapter): chapter is Chapter => !!chapter && chapter.kind !== "date")
    .sort(
      (a, b) =>
        (mainChapterNumber(a.key) ?? Infinity) - (mainChapterNumber(b.key) ?? Infinity) ||
        a.plannedAt.localeCompare(b.plannedAt),
    );
  const entries: StoryChapterEntry[] = chapters.map((chapter) => {
    const progress = run.state.chapters[chapter.key];
    return {
      key: chapter.key,
      kind: chapter.kind,
      title: chapter.title,
      ...(chapter.li ? { li: chapter.li } : {}),
      lead: chapter.lead,
      state: progress?.completed ? "done" : "in-progress",
      beatsRead: progress?.beatsRead ?? 0,
      nodes: chapter.nodes.length,
    };
  });
  const ready = run.world.forge.phase === "ready";
  const cast = Object.keys(run.state.lis).filter((li) => run.units.some((unit) => unit.id === li && unit.bible));
  const { number, open } = nextMain(
    chapters.filter((chapter) => chapter.kind === "main"),
    run.state,
  );
  return {
    chapters: entries,
    next: ready && open && cast.length ? { kind: "main", number, candidates: leadCandidates(run.state, cast) } : null,
  };
}

/** GET /runs/:run/chapters/:key: the plan as the client sees it, and each node's beat state. */
export async function chapterDetail(deps: { store: OtomeStore }, runId: string, key: string): Promise<ChapterDetail> {
  const [chapter, state] = await Promise.all([
    deps.store.readDoc(chapterId(runId, key), normalizeChapter),
    deps.store.readDoc(stateId(runId), normalizeState),
  ]);
  if (!chapter) throw notFound("chapter");
  const read = state?.chapters[key]?.beatsRead ?? 0;
  const written = await Promise.all(
    chapter.nodes.map(async ({ i }) => i < read || !!(await deps.store.readDoc(beatId(runId, key, i), normalizeBeat))),
  );
  return {
    chapter: toChapterView(chapter),
    beats: chapter.nodes.map(({ i }) => ({ i, state: i < read ? "read" : written[i] ? "ready" : "unwritten" })),
  };
}
