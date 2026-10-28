/**
 * Drama packs as Stir plays (0.3.11): start one now (Slurp casts it, or the player picks who leads),
 * end one, and take a start back. Through the action layer like every other lever, so a drama is
 * previewed, lands in the plays ledger and has Undo. See docs/DRAMA.md.
 */
import type { DB } from "../../../db/connection.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import {
  mutateSlurpDramaState,
  readSlurpDramaLibrary,
  readSlurpDramaState,
} from "../../data/world/slp-drama-storage.js";
import {
  slpDramaCatalog,
  slpDramaEnabledIds,
  slpDramaStorylines,
  slpEnabledDrama,
} from "../../modules/world/events/slp-drama-library.js";
import { slpDramaLeadFits } from "../../modules/world/events/slp-drama-cast.js";
import {
  slpDramaId,
  slpDramaStopOutcomes,
  slpEndDramaRun,
  slpRequestDrama,
  type SlpDramaRun,
} from "../../modules/world/events/slp-drama-runtime.js";
import type { SlpActionParsed, SlpStirWorld } from "../../../../../shared/src/slp/slp-actions.js";
import type { SlpActionPreview } from "../../../../../shared/src/slp/slp-stir.js";
import { advanceSlurpDrama, loadDramaWorld } from "./slp-drama-service.js";
import { slurpPausedNow } from "../../data/settings/slp-pause-storage.js";
import { SLP_STORYLINES_OFF, slpExtensionOn } from "../../../../../shared/src/slp/slp-extensions.js";

export const SLURP_DRAMA_LEVERS = ["start-drama", "end-drama"] as const;
export type SlurpDramaLever = (typeof SLURP_DRAMA_LEVERS)[number];
export const isSlurpDramaLever = (name: string): name is SlurpDramaLever =>
  (SLURP_DRAMA_LEVERS as readonly string[]).includes(name);

export type SlurpDramaUndo = { kind: "endDrama"; runId: string };
type Failure = { ok: false; status: 404 | 409; error: string };

const OFF = "Switch it on first in Settings › Stir › Drama (and its situation, if it needs one).";
const BROKEN = "This drama cannot run: a stage leads back, or one is never reached.";
const NOBODY = "Nobody fits the roles right now.";
const PAUSED = "Slurp is paused (Settings › Overview). Resume it to start a drama.";
const LEAD_NO = "They do not fit the first role of this drama right now.";

/** The dramas switched on, each with the storyline it runs as (null: a v1 entry that cannot run). */
async function enabledDramas(db: DB) {
  const settings = await createSlurpStorage(db).getSettings();
  const imported = await readSlurpDramaLibrary(db);
  const catalog = slpEnabledDrama(
    slpDramaCatalog(imported),
    slpDramaEnabledIds(imported, settings.drama.enabled, settings.contentPacks),
  );
  return [
    ...catalog.dramas.map((drama) => ({
      id: drama.id,
      name: drama.name,
      description: drama.description,
      leadRole: drama.roles[0]!.key,
      storyline: slpDramaStorylines({ situations: [], dramas: [drama] }).dramas[0] ?? null,
    })),
    ...slpDramaStorylines({ situations: [], dramas: [], storylines: catalog.storylines }).dramas.map((storyline) => ({
      id: storyline.id,
      name: storyline.name,
      description: storyline.description,
      leadRole: storyline.cast[0]!.key,
      storyline,
    })),
  ];
}

const busyOf = (runs: readonly { endedAt: string | null; cast: Record<string, string> }[]) =>
  new Set(runs.filter((run) => !run.endedAt).flatMap((run) => Object.values(run.cast)));

/** What Stir lists: the dramas switched on, and the ones running with who is in them. */
export async function readSlurpStirDramas(db: DB): Promise<Pick<SlpStirWorld, "dramas" | "runs">> {
  const [dramas, { state }] = await Promise.all([enabledDramas(db), readSlurpDramaState(db)]);
  const catalog = slpDramaCatalog(await readSlurpDramaLibrary(db));
  const all = [...catalog.dramas, ...catalog.storylines];
  return {
    dramas: dramas.map((drama) => ({
      id: drama.id,
      name: drama.name,
      description: drama.description,
      leadRole: drama.leadRole,
    })),
    runs: state.runs
      .filter((run) => !run.endedAt)
      .map((run) => ({
        id: run.id,
        dramaId: run.dramaId,
        name: all.find((drama) => drama.id === run.dramaId)?.name ?? run.dramaId,
        stage: run.stage,
        cast: run.cast,
      })),
  };
}

/** What a drama play would do, on the world as it is now. Reads only. */
export async function previewSlurpDramaLever(
  db: DB,
  name: SlurpDramaLever,
  input: unknown,
  at = new Date(),
): Promise<Pick<SlpActionPreview, "who" | "detail" | "when" | "notes" | "error" | "summary">> {
  const result = (fields: Partial<SlpActionPreview>) => ({
    who: [],
    detail: {},
    when: "now" as const,
    notes: [],
    error: null,
    summary: "",
    ...fields,
  });
  if (name === "end-drama") {
    const { runId } = input as SlpActionParsed<"end-drama">;
    const run = (await readSlurpStirDramas(db)).runs?.find((entry) => entry.id === runId);
    return run
      ? result({ detail: { name: run.name }, summary: `${run.name} ends now. Nothing more of it goes out.` })
      : result({ error: "notFound", summary: "That drama is not running." });
  }
  const { dramaId, leadId } = input as SlpActionParsed<"start-drama">;
  const drama = (await enabledDramas(db)).find((entry) => entry.id === dramaId);
  if (!drama) return result({ error: "off", summary: OFF });
  const { state } = await readSlurpDramaState(db);
  if (state.runs.some((run) => run.dramaId === dramaId && !run.endedAt))
    return result({ error: "busy", summary: `${drama.name} is already running.` });
  const world = leadId ? await loadDramaWorld(db, at, true) : null;
  const lead = world?.creators.find((creator) => creator.id === leadId);
  const storyline = drama.storyline;
  if (!storyline) return result({ error: "off", summary: BROKEN });
  if (world && leadId && !slpDramaLeadFits(storyline, leadId, { world, busy: busyOf(state.runs), at }))
    return result({ error: "lead", summary: LEAD_NO });
  const avatar = lead
    ? ((
        await createSlurpStorage(db)
          .getNoodlerAccountById(lead.id)
          .catch(() => null)
      )?.avatarUrl ?? null)
    : null;
  return result({
    who: lead ? [{ id: lead.id, name: lead.name, avatarUrl: avatar }] : [],
    detail: { name: drama.name, description: drama.description },
    when: "nextLook",
    summary: `${drama.name} starts${lead ? ` with ${lead.name}` : ""}. Slurp casts the rest.`,
  });
}

/** One drama play, for real. */
export async function runSlurpDramaLever(
  db: DB,
  name: SlurpDramaLever,
  input: unknown,
  at = new Date(),
): Promise<{ ok: true; value: { runId: string }; undo: SlurpDramaUndo | null } | Failure> {
  switch (name) {
    case "start-drama":
      return startDrama(db, input, at);
    case "end-drama":
      return endDrama(db, input, at);
  }
}

/** A drama the player ends leaves its stage: the lead's condition from it goes. */
async function leaveDramaStage(db: DB, run: SlpDramaRun, at: Date) {
  const storyline = slpDramaStorylines(slpDramaCatalog(await readSlurpDramaLibrary(db))).dramas.find(
    (entry) => slpDramaId(entry) === run.dramaId,
  );
  const creatorId = storyline && run.cast[storyline.cast[0]!.key];
  const outcomes = storyline ? slpDramaStopOutcomes(storyline, run.stage) : [];
  if (creatorId && outcomes.length)
    await createSlurpStorage(db).applyStoryOutcomes({
      outcomes,
      participants: [creatorId],
      sourceKind: "drama",
      sourceId: `${run.id}:${run.stage}:off`,
      at,
    });
}

async function endDrama(
  db: DB,
  input: unknown,
  at: Date,
): Promise<{ ok: true; value: { runId: string }; undo: SlurpDramaUndo | null } | Failure> {
  const { runId } = input as SlpActionParsed<"end-drama">;
  const run = (await readSlurpDramaState(db)).state.runs.find((entry) => entry.id === runId && !entry.endedAt);
  const ended = await mutateSlurpDramaState(db, (current) => {
    const next = slpEndDramaRun(current.state, runId, at);
    return next ? { stored: { ...current, state: next }, result: true } : null;
  });
  if (ended && run) await leaveDramaStage(db, run, at);
  return ended
    ? { ok: true, value: { runId }, undo: null }
    : { ok: false, status: 404, error: "That drama is not running." };
}

async function startDrama(
  db: DB,
  input: unknown,
  at: Date,
): Promise<{ ok: true; value: { runId: string }; undo: SlurpDramaUndo | null } | Failure> {
  const { dramaId, leadId } = input as SlpActionParsed<"start-drama">;
  if (!slpExtensionOn(await createSlurpStorage(db).getSettings(), "storylines"))
    return { ok: false, status: 409, error: SLP_STORYLINES_OFF };
  // Paused, nothing would start now, and the request would wait to start later with no Undo.
  if (await slurpPausedNow(db)) return { ok: false, status: 409, error: PAUSED };
  const preview = await previewSlurpDramaLever(db, "start-drama", input, at);
  if (preview.error) return { ok: false, status: 409, error: preview.summary };
  const before = new Set((await readSlurpDramaState(db)).state.runs.map((run) => run.id));
  // Asked for now, past the level's cap: the tick right after starts it (and moves the rest along).
  await mutateSlurpDramaState(db, (current) => ({
    stored: { state: slpRequestDrama(current.state, dramaId, leadId), advancedAt: null },
    result: null,
  }));
  await advanceSlurpDrama(db, at);
  const run = (await readSlurpDramaState(db)).state.runs.find(
    (entry) => entry.dramaId === dramaId && !entry.endedAt && !before.has(entry.id),
  );
  if (run) return { ok: true, value: { runId: run.id }, undo: { kind: "endDrama", runId: run.id } };
  // Not started now: the request goes, so it never starts later without a play to undo it.
  await mutateSlurpDramaState(db, (current) =>
    current.state.requested === dramaId
      ? { stored: { ...current, state: { ...current.state, requested: null, requestedLead: null } }, result: null }
      : null,
  );
  return { ok: false, status: 409, error: NOBODY };
}

/** Take a start back: the drama ends; what already went out stays. False when it ended already. */
export async function undoSlurpDramaLever(db: DB, undo: SlurpDramaUndo, at = new Date()): Promise<boolean> {
  const ended = await mutateSlurpDramaState(db, (current) => {
    const next = slpEndDramaRun(current.state, undo.runId, at);
    return next ? { stored: { ...current, state: next }, result: true } : null;
  });
  return ended === true;
}
