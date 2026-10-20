/**
 * The world levers of Stir (W) that are not ties: start an event now, move a storyline's chapter,
 * wake the fans, a Creator's spice level, and `list-world`. Each runs the code its old button ran
 * (Backstage "Start now", the chapter controls, Pulse "Run audience", the steering card's spice);
 * nothing new happens in the world. Also the one Undo for every reversible action.
 */
import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { getSlurpPostGuidance, updateSlurpPostGuidance } from "../../data/settings/slp-post-guidance-storage.js";
import {
  patchSlurpCreatorSteering,
  readSlurpCreatorSteering,
  removeSlurpCreatorNudge,
} from "../../data/creators/slp-steering-storage.js";
import { slpUndoPatch } from "../../modules/assist/slp-stir-play.js";
import {
  readSlurpStirTies,
  slurpRunsItself,
  undoSlurpTieLever,
  type SlurpTieUndo,
} from "../projects/slp-projects-contract.js";
import { runCreatorFanActivity } from "../audience/slp-audience-contract.js";
import { SLP_SPICE_TO_EXPLICIT } from "../../../../../shared/src/slp/slp-spice.js";
import {
  SLURP_PLATFORM_EVENTS_MAX,
  slurpPlatformEventSchema,
} from "../../../../../shared/src/slp/slp-platform-events.js";
import { newId } from "../../../utils/id-generator.js";
import { resolveCreatorSourceSnapshot } from "../../data/creators/slp-source-resolve.js";
import {
  appearanceEvidenceFromSource,
  appearanceSourceAccount,
  resolveSlpAppearanceProfile,
} from "../../modules/creators/slp-appearance-profile.js";
import type { SlpAccount } from "../../../../../shared/src/slp/slp-social.types.js";
import type { SlurpPostGuidanceEntry } from "../../modules/feed/slp-post-guidance.js";
import type { SlpActionParsed, SlpStirWorld } from "../../../../../shared/src/slp/slp-actions.js";
import type { SlpCreatorSteering } from "../../../../../shared/src/slp/slp-creator-steering.js";
import type { SlpAssistOutcome } from "./slp-assist-service.js";
import {
  listSlurpTrendViews,
  readSlurpTrendList,
  slurpMayStartTrend,
  startSlurpTrend,
  steerSlurpTrend,
  undoSlurpTrend,
} from "../discovery/slp-discovery-contract.js";
import type { SlpStirTrends } from "../../../../../shared/src/slp/slp-action-results.js";
import { SLP_TREND_LEAN_MAX } from "../../../../../shared/src/slp/slp-trend-actions.js";
import { slurpTrendClean } from "../../modules/discovery/slp-trends.js";
import { undoSlpDeskLever, type SlpDeskUndo } from "./slp-desk-levers.js";
import { readSlurpStirDramas, undoSlurpDramaLever, type SlurpDramaUndo } from "../world/slp-world-contract.js";

/** What one Undo takes back. Kept in the plays ledger; never sent to the app. */
type SteeringPatch = Partial<Omit<SlpCreatorSteering, "nudges" | "support">>;

/**
 * What one Undo takes back. Kept in the plays ledger; never sent to the app. `set` is what the play
 * wrote, so the Undo leaves a later change alone (entries from before 0.3.1 lack it).
 */
export type SlpActionUndo =
  | SlpDeskUndo
  | { kind: "tie"; undo: SlurpTieUndo }
  | { kind: "drama"; undo: SlurpDramaUndo }
  | { kind: "steering"; accountId: string; patch: SteeringPatch; set?: SteeringPatch }
  | { kind: "idea"; accountId: string; ideaId: string }
  | { kind: "occurrence"; id: string }
  | { kind: "spice"; accountId: string; level: SlurpPostGuidanceEntry["level"]; set?: SlurpPostGuidanceEntry["level"] }
  | { kind: "project"; accountId: string; projectId: string }
  | { kind: "goal"; accountId: string; before: unknown; set: unknown }
  | { kind: "look"; accountId: string; before: string | null; set: string }
  | { kind: "customEvent"; eventId: string; occurrenceId: string }
  | { kind: "trend"; id: string }
  | { kind: "trendLean"; id: string; before: string | null; set: string | null }
  | {
      kind: "storyline";
      accountId: string;
      projectId: string;
      move: SlpActionParsed<"steer-storyline">["move"];
      before: { chapters: string[]; chapter: number };
      after: { chapters: string[]; chapter: number };
    };

type LeverDone<T> = { ok: true; value: T; undo: SlpActionUndo | null };

const running = (occurrence: { status: string; endsAt: string }, at: Date) =>
  occurrence.status === "active" && occurrence.endsAt > at.toISOString();

/** The ids and names every world lever takes. Reads only. */
export async function readSlpStirWorld(db: DB, at = new Date()): Promise<SlpStirWorld & SlpStirTrends> {
  const storage = createSlurpStorage(db);
  const [ties, settings, occurrences, accounts] = await Promise.all([
    readSlurpStirTies(db),
    storage.getSettings(),
    storage.listStoryOccurrences(),
    storage.listNoodlerAccounts(),
  ]);
  const live = new Set(
    occurrences
      .filter((occurrence: { status: string; endsAt: string }) => running(occurrence, at))
      .map((occurrence: { blueprintId: string }) => occurrence.blueprintId),
  );
  const storylines = (
    await Promise.all(
      accounts.map(async (account: { id: string }) =>
        (await storage.listProjects(account.id))
          .filter(
            (project: { status: string; chapters: string[] }) =>
              (project.status === "active" || project.status === "paused") && project.chapters.length > 0,
          )
          .map((project: { id: string; title: string; chapters: string[]; chapter: number; held?: boolean }) => ({
            accountId: account.id,
            projectId: project.id,
            title: project.title,
            chapter: project.chapters[project.chapter] ?? "",
            held: project.held === true,
          })),
      ),
    )
  ).flat();
  return {
    ...ties,
    ...(await readSlurpStirDramas(db)),
    trends: (await listSlurpTrendViews(db, at)).map(({ id, label, lean, stage }) => ({ id, label, lean, stage })),
    events: settings.platformEvents
      .filter((event: { enabled: boolean }) => event.enabled)
      .map((event: { id: string; name: string }) => ({ id: event.id, name: event.name, running: live.has(event.id) })),
    storylines,
  };
}

/** Start an event now: the same start as Backstage's old "Start now" (every Creator it fits joins). */
export async function runSlpStartEvent(
  db: DB,
  input: SlpActionParsed<"start-event">,
): Promise<SlpAssistOutcome<{ occurrenceId: string }> | LeverDone<{ occurrenceId: string }>> {
  // A second start while it runs would double what it gives (a double tap, two tabs): one start at a
  // time per event, and none while one runs.
  // ponytail: in-process lock, the Engine is one process; a claim in storage if it ever runs as several.
  if (startingEvents.has(input.eventId)) return { ok: false, status: 409, error: "That event is already on." };
  startingEvents.add(input.eventId);
  try {
    return await startSlpEventOnce(db, input);
  } finally {
    startingEvents.delete(input.eventId);
  }
}

const startingEvents = new Set<string>();

async function startSlpEventOnce(
  db: DB,
  input: SlpActionParsed<"start-event">,
): Promise<SlpAssistOutcome<{ occurrenceId: string }> | LeverDone<{ occurrenceId: string }>> {
  const storage = createSlurpStorage(db);
  const at = new Date();
  if (
    (await storage.listStoryOccurrences()).some(
      (occurrence: { blueprintId: string; status: string; endsAt: string }) =>
        occurrence.blueprintId === input.eventId && running(occurrence, at),
    )
  )
    return { ok: false, status: 409, error: "That event is already on." };
  const occurrence = await storage.startStoryEvent(input.eventId, at);
  if (!occurrence) return { ok: false, status: 404, error: "Event not found." };
  return { ok: true, value: { occurrenceId: occurrence.id }, undo: { kind: "occurrence", id: occurrence.id } };
}

/** A chapter move, the same as the chapter controls (open without Director mode). */
export async function runSlpSteerStoryline(
  db: DB,
  input: SlpActionParsed<"steer-storyline">,
): Promise<SlpAssistOutcome<{ projectId: string }> | LeverDone<{ projectId: string }>> {
  if ((input.move === "insert" || input.move === "label") && !input.text)
    return { ok: false, status: 400, error: "Say what the chapter is." };
  const storage = createSlurpStorage(db);
  const before = await storage.getProject(input.accountId, input.projectId);
  if (!before) return { ok: false, status: 404, error: "Storyline not found." };
  const project = await storage.directProject(input.accountId, input.projectId, input.move, input.text);
  if (!project) return { ok: false, status: 409, error: "That does not apply to this storyline right now." };
  // hold and release undo each other. A skip, back, insert or label also moves day ranges, polls and
  // chapter choices, which a chapter list cannot put back, so those stay (0.3.1 review).
  if (input.move !== "hold" && input.move !== "release")
    return { ok: true, value: { projectId: input.projectId }, undo: null };
  return {
    ok: true,
    value: { projectId: input.projectId },
    undo: {
      kind: "storyline",
      accountId: input.accountId,
      projectId: input.projectId,
      move: input.move,
      before: { chapters: [...before.chapters], chapter: before.chapter },
      after: { chapters: [...project.chapters], chapter: project.chapter },
    },
  };
}

/**
 * Wake the fans: Pulse's old "Run audience". A long run, so it starts and the play answers at once
 * (B: long actions never lock the player); Pulse shows it running and what it did.
 */
export async function runSlpRunAudience(db: DB): Promise<SlpAssistOutcome<{ started: boolean }>> {
  // The player's tap: the AI budget's mode never blocks it (0.3.6).
  const settings = await createSlurpStorage(db).getSettings();
  if (!settings.fanActivityEnabled)
    return { ok: false, status: 409, error: "Fan activity is off. Turn it on under Audience." };
  void runCreatorFanActivity({ db, mode: "manual" }).catch((error: unknown) =>
    logger.warn(error, "[slurp] Audience run from Stir failed"),
  );
  return { ok: true, value: { started: true } };
}

/** A Creator's own spice level (the steering card's control); null goes back to the default. */
export async function runSlpSetSpice(
  db: DB,
  input: SlpActionParsed<"set-spice">,
): Promise<SlpAssistOutcome<{ level: string | null }> | LeverDone<{ level: string | null }>> {
  if (!(await createSlurpStorage(db).getNoodlerAccountById(input.accountId)))
    return { ok: false, status: 404, error: "Creator not found." };
  const before = (await getSlurpPostGuidance(db)).creators[input.accountId]?.level ?? "";
  const level = input.level ? SLP_SPICE_TO_EXPLICIT[input.level] : "";
  await setSlpSpiceLevel(db, input.accountId, level);
  return {
    ok: true,
    value: { level: input.level },
    undo: { kind: "spice", accountId: input.accountId, level: before, set: level },
  };
}

async function setSlpSpiceLevel(db: DB, accountId: string, level: SlurpPostGuidanceEntry["level"]) {
  await updateSlurpPostGuidance(db, (current) => {
    const entry = current.creators[accountId] ?? { public: "", locked: "", menu: "", level: "" };
    return { ...current, creators: { ...current.creators, [accountId]: { ...entry, level } } };
  });
}

/**
 * A new storyline for a Creator (0.3.1), the same as opening one in Creator settings; with `withIds`
 * a crossover the others share. Never "focus": that would quietly push their other arcs aside.
 */
export async function runSlpStartStoryline(
  db: DB,
  input: SlpActionParsed<"start-storyline">,
): Promise<SlpAssistOutcome<{ projectId: string }> | LeverDone<{ projectId: string }>> {
  const storage = createSlurpStorage(db);
  for (const id of [input.accountId, ...(input.withIds ?? [])]) {
    const account = await storage.getNoodlerAccountById(id);
    if (!account) return { ok: false, status: 404, error: "Creator not found." };
    // Slurp writes a storyline's posts; a page the player runs would never post a chapter.
    if (!slurpRunsItself(account)) return { ok: false, status: 409, error: "You post for this page yourself." };
  }
  const withIds = (input.withIds ?? []).filter((id) => id !== input.accountId);
  const project = await storage.createProject(input.accountId, {
    title: input.title,
    ...(input.direction ? { direction: input.direction } : {}),
    ...(withIds.length ? { crossoverWith: withIds } : {}),
  });
  if (!project) return { ok: false, status: 409, error: "They already have as many storylines as they can follow." };
  return {
    ok: true,
    value: { projectId: project.id },
    undo: { kind: "project", accountId: input.accountId, projectId: project.id },
  };
}

/** A tip goal (0.3.1), the same as setting one on the Creator's page; the old one comes back on Undo. */
export async function runSlpSetTipGoal(
  db: DB,
  input: SlpActionParsed<"set-tip-goal">,
): Promise<SlpAssistOutcome<{ accountId: string }> | LeverDone<{ accountId: string }>> {
  const storage = createSlurpStorage(db);
  if (!(await storage.getNoodlerAccountById(input.accountId)))
    return { ok: false, status: 404, error: "Creator not found." };
  const before = await storage.getGoal(input.accountId);
  const goal = await storage.setGoal(input.accountId, input.label, input.target);
  if (!goal) return { ok: false, status: 400, error: "That goal does not work. Give it a name and a number." };
  return {
    ok: true,
    value: { accountId: input.accountId },
    undo: { kind: "goal", accountId: input.accountId, before, set: goal },
  };
}

type LookAccount = SlpAccount & {
  settings: SlpAccount["settings"] & { stage?: { appearance?: string } };
};

/** The Creator's own look line, if the player or a play set one. */
const slpLookOverride = (account: LookAccount) => account.settings?.stage?.appearance?.trim() || null;

/**
 * How a Creator looks now, the way their pictures read it: their own look line, else the linked
 * card's Appearance, else the accepted profile. No AI call.
 */
async function slpCurrentLook(db: DB, account: LookAccount): Promise<string> {
  // The same source the picture pipeline reads: the linked card or persona behind the page.
  const linked = (await createSlurpStorage(db)
    .resolveAccountSource(account)
    .catch(() => null)) as SlpAccount | null;
  const sourceAccount = appearanceSourceAccount(account, linked);
  const source = await resolveCreatorSourceSnapshot(db, sourceAccount).catch(() => null);
  return (
    resolveSlpAppearanceProfile({
      stageAppearance: account.settings?.stage?.appearance,
      profile: account.settings?.appearanceProfile,
      evidence: source ? appearanceEvidenceFromSource(source, sourceAccount.entityId) : null,
    }).text ?? ""
  );
}

/**
 * A lasting change of look (0.3.1): the change comes first, then the rest of how they look, so the
 * rest stays and the change is never the part cut for length.
 * ponytail: a line, not merged by the model; "pink hair" over "blonde" leans on the picture model
 * reading "Now:" as the newer one.
 */
export async function runSlpNewLook(
  db: DB,
  input: SlpActionParsed<"new-look">,
): Promise<SlpAssistOutcome<{ accountId: string }> | LeverDone<{ accountId: string }>> {
  const storage = createSlurpStorage(db);
  const account = (await storage.getNoodlerAccountById(input.accountId)) as LookAccount | null;
  if (!account) return { ok: false, status: 404, error: "Creator not found." };
  const before = slpLookOverride(account);
  const next = [`Now: ${input.change.replace(/[.!]+$/u, "")}.`, await slpCurrentLook(db, account)]
    .filter(Boolean)
    .join("\n")
    .slice(0, 2000)
    .trim();
  if (!(await storage.updateNoodlerAppearanceChoice(input.accountId, "edit_override", next)))
    return { ok: false, status: 409, error: "Their look could not be changed." };
  return {
    ok: true,
    value: { accountId: input.accountId },
    undo: { kind: "look", accountId: input.accountId, before, set: next },
  };
}

/**
 * An event in the player's words (0.3.1): saved like any Backstage event, so it can run again or be
 * edited there, and started now. Undo stops it and takes the event away again.
 */
export async function runSlpInventEvent(
  db: DB,
  input: SlpActionParsed<"invent-event">,
): Promise<
  SlpAssistOutcome<{ eventId: string; occurrenceId: string }> | LeverDone<{ eventId: string; occurrenceId: string }>
> {
  const storage = createSlurpStorage(db);
  const settings = await storage.getSettings();
  if (settings.platformEvents.length >= SLURP_PLATFORM_EVENTS_MAX)
    return { ok: false, status: 409, error: "Slurp keeps no more events. Remove one in Backstage first." };
  const event = slurpPlatformEventSchema.parse({
    id: `stir-${newId()}`.slice(0, 64),
    name: input.name,
    guidance: input.guidance,
    enabled: true,
    activation: { kind: "manual", durationDays: input.days },
    target: { kind: "all" },
  });
  await storage.updateSettings({ platformEvents: [...settings.platformEvents, event] });
  const occurrence = await storage.startStoryEvent(event.id);
  if (!occurrence) return { ok: false, status: 409, error: "The event could not start." };
  return {
    ok: true,
    value: { eventId: event.id, occurrenceId: occurrence.id },
    undo: { kind: "customEvent", eventId: event.id, occurrenceId: occurrence.id },
  };
}

/** A trend the player starts (docs/TRENDS.md): the right Creators join over the next days. Undo works until one has. */
export async function runSlpStartTrend(
  db: DB,
  input: SlpActionParsed<"start-trend">,
): Promise<SlpAssistOutcome<{ trendId: string }> | LeverDone<{ trendId: string }>> {
  if (input.accountId && !(await slurpMayStartTrend(db, input.accountId)))
    return { ok: false, status: 404, error: "Creator not found." };
  const trend = await startSlurpTrend(
    db,
    { label: input.label, source: "stir", starterId: input.accountId ?? null, lean: input.lean },
    new Date(),
  );
  if (!trend) return { ok: false, status: 409, error: "Slurp has enough trends going, or that one already is." };
  return { ok: true, value: { trendId: trend.id }, undo: { kind: "trend", id: trend.id } };
}

/** What a running trend leans into. Undo puts the old words back while nobody changed them since. */
export async function runSlpSteerTrend(
  db: DB,
  input: SlpActionParsed<"steer-trend">,
): Promise<SlpAssistOutcome<{ trendId: string }> | LeverDone<{ trendId: string }>> {
  const lean = slurpTrendClean(input.lean, SLP_TREND_LEAN_MAX) || null;
  const done = await steerSlurpTrend(db, input.trendId, lean);
  if (!done) return { ok: false, status: 404, error: "That trend is not going any more." };
  return {
    ok: true,
    value: { trendId: input.trendId },
    undo: { kind: "trendLean", id: input.trendId, before: done.before, set: lean },
  };
}

/**
 * Take one play step back. The world may have moved on: what is gone stays gone, and a step that
 * would undo a later change answers false and stays as it is.
 */
export async function undoSlpAction(db: DB, undo: SlpActionUndo): Promise<boolean> {
  switch (undo.kind) {
    case "desk":
      return undoSlpDeskLever(db, undo);
    case "tie":
      return undoSlurpTieLever(db, undo.undo);
    case "drama":
      return undoSlurpDramaLever(db, undo.undo);
    case "steering": {
      const current = await readSlurpCreatorSteering(db, undo.accountId);
      const patch = slpUndoPatch(current, undo.patch, undo.set);
      if (!Object.keys(patch).length) return false;
      await patchSlurpCreatorSteering(db, undo.accountId, patch, { keepSupportNote: true });
      return true;
    }
    case "idea": {
      // An idea that already went out as a post stays posted.
      const { nudges } = await readSlurpCreatorSteering(db, undo.accountId);
      if (!nudges.some((nudge) => nudge.id === undo.ideaId)) return false;
      await removeSlurpCreatorNudge(db, undo.accountId, undo.ideaId);
      return true;
    }
    case "occurrence":
      return createSlurpStorage(db).cancelStartedStoryEvent(undo.id);
    case "spice": {
      const current = (await getSlurpPostGuidance(db)).creators[undo.accountId]?.level ?? "";
      if (undo.set !== undefined && current !== undo.set) return false;
      await setSlpSpiceLevel(db, undo.accountId, undo.level);
      return true;
    }
    case "project": {
      const storage = createSlurpStorage(db);
      const project = await storage.getProject(undo.accountId, undo.projectId);
      // Once a chapter went out it is part of their story: it stays.
      if (!project || project.chapter > 0 || project.posts > 0) return false;
      return storage.deleteProject(undo.accountId, undo.projectId);
    }
    case "goal": {
      const storage = createSlurpStorage(db);
      // A goal changed since (or met and closed) stays as it is.
      if (JSON.stringify(await storage.getGoal(undo.accountId)) !== JSON.stringify(undo.set)) return false;
      await storage.restoreGoal(undo.accountId, undo.before ?? null);
      return true;
    }
    case "look": {
      const storage = createSlurpStorage(db);
      const account = (await storage.getNoodlerAccountById(undo.accountId)) as LookAccount | null;
      if (!account || slpLookOverride(account) !== undo.set) return false;
      return Boolean(
        undo.before
          ? await storage.updateNoodlerAppearanceChoice(undo.accountId, "edit_override", undo.before)
          : await storage.updateNoodlerAppearanceChoice(undo.accountId, "clear_override"),
      );
    }
    case "trend":
      return undoSlurpTrend(db, undo.id);
    case "trendLean": {
      const current = (await readSlurpTrendList(db)).find((entry) => entry.id === undo.id);
      if (!current || current.lean !== undo.set) return false;
      return Boolean(await steerSlurpTrend(db, undo.id, undo.before));
    }
    case "customEvent": {
      const storage = createSlurpStorage(db);
      // Over already (or changed in Backstage since): it stays, event and all.
      const cancelled = await storage.cancelStartedStoryEvent(undo.occurrenceId);
      if (!cancelled) return false;
      const { platformEvents } = await storage.getSettings();
      if (platformEvents.some((event: { id: string }) => event.id === undo.eventId))
        await storage.updateSettings({
          platformEvents: platformEvents.filter((event: { id: string }) => event.id !== undo.eventId),
        });
      return cancelled;
    }
    case "storyline": {
      const storage = createSlurpStorage(db);
      const current = await storage.getProject(undo.accountId, undo.projectId);
      // Only hold and release are opposites; other moves are not offered for Undo (see the run).
      if (!current || (undo.move !== "hold" && undo.move !== "release")) return false;
      if (Boolean(current.held) !== (undo.move === "hold")) return false;
      return Boolean(
        await storage.directProject(undo.accountId, undo.projectId, undo.move === "hold" ? "release" : "hold"),
      );
    }
  }
}
