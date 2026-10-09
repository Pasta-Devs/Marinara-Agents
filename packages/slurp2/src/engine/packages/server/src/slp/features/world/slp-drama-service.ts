/**
 * Drama on the world clock (`docs/DRAMA.md`): moves the runtime, applies its tie outcomes, and sends
 * what is due to its channel. No model calls of its own: a DM rides the follow-up writer as an
 * opener, a post line rides the ordinary post call (`planSlurpDramaBeat`), comments and
 * notifications are the pack's own words. Any failure drops one beat, never a tick or a post.
 */
import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import { newId } from "../../../utils/id-generator.js";
import { randomUUID } from "node:crypto";
import { createSlurpMessagesStorage, createSlurpStorage } from "../../data/slp-storage.js";
import { createSlurpEventsStorage } from "../../data/notifications/slp-notification-storage.js";
import { createSlurpPopulationStorage } from "../../data/audience/slp-audience-storage-funnel.js";
import { readSlurpSpice } from "../../data/creators/slp-spice-storage.js";
import { getSlurpPostGuidance } from "../../data/settings/slp-post-guidance-storage.js";
import { selectSlurpExplicitLevel } from "../../modules/feed/slp-post-guidance.js";
import { SLP_EXPLICIT_LEVELS, slpClampExplicitLevel } from "../../../../../shared/src/slp/slp-spice.js";
import { slurpWorldActivityMultiplier } from "../../../../../shared/src/slp/slp-scale.js";
import type { SlpRelationToPlayer } from "../../../../../shared/src/slp/slp-drama.js";
import {
  mutateSlurpDramaState,
  readSlurpDramaLibrary,
  readSlurpDramaState,
} from "../../data/world/slp-drama-storage.js";
import { slpDramaCatalog, slpEnabledDrama } from "../../modules/world/events/slp-drama-library.js";
import {
  slpAdvanceDrama,
  slpAnswerDramaChoice,
  slpDramaText,
  slpDueDramaJobs,
  slpMarkDramaJob,
  type SlpDramaJob,
  type SlpDramaTieEffect,
  type SlpDramaWorld,
} from "../../modules/world/events/slp-drama-runtime.js";
import type { SlurpBeat } from "../../modules/feed/slp-post-beat.js";
import { loadSlurpTieCreators } from "../projects/slp-projects-contract.js";
import { mutateSlurpCreatorTies, readSlurpCreatorTiesDocument } from "../../data/projects/slp-creator-ties-storage.js";
import { slurpApplyDramaTie } from "../../modules/projects/slp-drama-ties.js";
import type { SlurpTieCreator } from "../../modules/projects/slp-creator-ties.js";

/** The world is loaded at most this often; due beats go out on every tick. */
const ADVANCE_EVERY_MS = 20 * 60_000;
/** A comment goes on a post from the last few days, or waits for one. */
const COMMENT_POST_DAYS = 3;

const pairKey = (kind: string, a: string, b: string) => `${kind}:${[a, b].sort().join("|")}`;

/** The runtime's view of the world: live Creators and the player's pages, their spice, and the ties. */
export async function loadDramaWorld(
  db: DB,
  at: Date,
): Promise<SlpDramaWorld & { viewerOf: Map<string, string>; tieCreators: SlurpTieCreator[] }> {
  const storage = createSlurpStorage(db);
  const [tieCreators, accounts, spice, guidance, document] = await Promise.all([
    loadSlurpTieCreators(db, at),
    storage.listNoodlerAccounts(),
    readSlurpSpice(db),
    getSlurpPostGuidance(db),
    readSlurpCreatorTiesDocument(db),
  ]);
  const byId = new Map(accounts.map((account) => [account.id, account]));
  // A player's page acts for the persona behind it: DMs, coins and notifications go to that persona.
  const viewerOf = new Map(
    accounts.flatMap((account) =>
      account.kind === "persona" && account.sourceKind === "persona" && account.sourceEntityId
        ? [[account.id, account.sourceEntityId] as const]
        : [],
    ),
  );
  const creators = tieCreators.map((creator) => ({
    id: creator.id,
    name: creator.name,
    automatic: creator.automatic,
    gender: creator.gender ?? null,
    spice: SLP_EXPLICIT_LEVELS.indexOf(
      slpClampExplicitLevel(selectSlurpExplicitLevel(guidance, creator.id), spice.max),
    ),
    tags: creator.tags,
    joinedAt: byId.get(creator.id)?.createdAt ?? at.toISOString(),
    followers: creator.followers,
    romance: creator.romance,
  }));
  const automatic = new Set(creators.filter((creator) => creator.automatic).map((creator) => creator.id));
  const relations = new Map<string, { playerId: string; relation: SlpRelationToPlayer }[]>();
  const relate = (creatorId: string, playerId: string, relation: SlpRelationToPlayer) =>
    relations.set(creatorId, [...(relations.get(creatorId) ?? []), { playerId, relation }]);
  const ties = new Set<string>();
  for (const couple of document.couples) {
    if (couple.stage === "split") continue;
    const members = [couple.aId, couple.bId, ...(couple.moreIds ?? [])];
    for (const [index, a] of members.entries())
      for (const b of members.slice(index + 1)) {
        ties.add(pairKey("couple", a, b));
        for (const [creatorId, playerId] of [
          [a, b],
          [b, a],
        ] as const)
          if (automatic.has(creatorId) && viewerOf.has(playerId))
            relate(creatorId, playerId, couple.stage === "sparks" ? "crush" : "partner");
      }
  }
  for (const bond of document.bonds) {
    if (bond.endedAt) continue;
    ties.add(pairKey(bond.kind, bond.aId, bond.bId));
    const relation =
      bond.kind === "ex" ? "ex" : bond.kind === "roommate" ? "roommate" : bond.kind === "friend" ? "friend" : null;
    if (!relation) continue;
    for (const [creatorId, playerId] of [
      [bond.aId, bond.bId],
      [bond.bId, bond.aId],
    ] as const)
      if (automatic.has(creatorId) && viewerOf.has(playerId)) relate(creatorId, playerId, relation);
  }
  for (const rivalry of document.ties.rivalries)
    if (rivalry.stage !== "over") ties.add(pairKey("rival", rivalry.fromId, rivalry.toId));
  return { creators, relations, ties, viewerOf, tieCreators };
}

/** Tie outcomes of finished stages, through the ties document's own rules. */
async function applyDramaTies(
  db: DB,
  effects: readonly SlpDramaTieEffect[],
  input: { at: Date; creators: readonly SlurpTieCreator[]; polyamory: boolean },
): Promise<void> {
  if (!effects.length) return;
  await mutateSlurpCreatorTies(db, (document) => ({
    document: effects.reduce(
      (next, effect) => slurpApplyDramaTie(next, effect.outcome, effect.ids, { ...input, newId }),
      document,
    ),
    result: null,
  }));
}

/** Sends one due job. True: done. False: it cannot go out (yet); it stays queued until it expires. */
async function sendDramaJob(
  db: DB,
  job: SlpDramaJob,
  viewerOf: ReadonlyMap<string, string>,
  at: Date,
): Promise<boolean | "drop"> {
  const storage = createSlurpStorage(db);
  const text = (value: string) => slpDramaText(value, job.names);
  const pick = <T>(list: readonly T[]) => list[Math.abs(hashOf(job.id)) % list.length]!;
  if (job.channel === "dm" || job.channel === "choice") {
    const viewer = job.toId ? viewerOf.get(job.toId) : undefined;
    // v1: only DMs to the player's persona go out; a DM between two Creators is nobody's thread to read.
    if (!viewer || !job.actorId) return "drop";
    const messages = createSlurpMessagesStorage(db);
    if (job.channel === "choice") {
      // Not held back by a roleplay scene: the runtime answers by default at the choice's deadline, so a
      // held question would be lost unseen. It waits in the paused chat instead.
      const sent = await messages.sendCreatorMessage(job.actorId, viewer, {
        content: text(job.choice!.question),
        metadata: {
          // Nobody asked this question either; it is the drama runtime writing first. Settings ›
          // Messaging "Stop after one unanswered text" reads any `dramaChoice` message as unsolicited.
          dramaChoice: {
            runId: job.runId,
            stage: job.choice!.stage ?? null,
            options: job.choice!.options.map(text),
            chosen: null,
          },
        },
      });
      return sent ? true : "drop";
    }
    let thread = await messages.getThread(viewer, job.actorId);
    if (!thread) {
      const opened = await messages.openThread(viewer, job.actorId, "creator", "waive");
      thread = opened.status === "ok" ? opened.thread : null;
    }
    if (!thread) return "drop";
    await messages.addScheduledFollowUps(thread.id, [
      {
        id: `followup-${randomUUID()}`,
        scheduledAt: new Date(at.getTime() + 2 * 60_000).toISOString(),
        type: "opener",
        reason: text(job.seed ?? ""),
        context: "",
      },
    ]);
    return true;
  }
  if (job.channel === "comment") {
    const [post] = await storage.listNoodlerPostsByAccount(job.onId!, 1);
    if (!post || at.getTime() - Date.parse(post.createdAt) > COMMENT_POST_DAYS * 86_400_000) return false;
    const content = text(pick(job.lines ?? [""]));
    if (job.actorId) {
      const made = await storage.createInteraction(post.id, { actorAccountId: job.actorId, type: "reply", content });
      return made ? true : "drop";
    }
    // The crowd: one of the Creator's own audience says it.
    const fans = (await createSlurpPopulationStorage(db).listTiesForCreator(job.onId!)).filter(
      (tie) => !viewerOf.has(tie.memberId) && ![...viewerOf.values()].includes(tie.memberId),
    );
    if (!fans.length) return "drop";
    const made = await storage.createNoodlerWorldInteraction(post.id, {
      creatorAccountId: job.onId!,
      actorId: pick(fans).memberId,
      type: "reply",
      content,
    });
    return made ? true : "drop";
  }
  if (job.channel === "notification") {
    // To the player's pages in the cast, else to every persona that plays.
    const targets = (job.playerIds ?? []).flatMap((id) => (viewerOf.has(id) ? [viewerOf.get(id)!] : []));
    const viewers = [...new Set(targets.length ? targets : viewerOf.values())];
    const events = createSlurpEventsStorage(db);
    for (const viewer of viewers)
      await events.recordAndPrune({
        recipientPersonaId: viewer,
        kind: "drama",
        creatorAccountId: job.actorId,
        note: text(job.seed ?? ""),
        operationId: `drama:${job.id}:${viewer}`,
      });
    return true;
  }
  if (job.channel === "money") {
    const amount = job.amount ?? 0;
    const viewer = job.toId ? viewerOf.get(job.toId) : undefined;
    const from = job.actorId ? (await storage.getNoodlerAccountById(job.actorId))?.displayName : undefined;
    if (viewer) await storage.creditGift(viewer, amount, `gift from ${from ?? "a Creator"}`, `drama:${job.id}`);
    else if (job.toId)
      await storage.creditEarnings(job.toId, "tip", amount, `from ${from ?? "a Creator"} (drama ${job.id})`);
    return true;
  }
  return "drop";
}

function hashOf(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return hash;
}

/**
 * One world tick: every 20 minutes the runtime moves (the switched-on entries, the level, the ties),
 * and on every tick what is due goes out. Nothing switched on and nothing running: nothing happens.
 */
export async function advanceSlurpDrama(db: DB, at = new Date()): Promise<void> {
  const settings = await createSlurpStorage(db).getSettings();
  // "Pause all": no drama moves while Slurp is paused.
  if (settings.paused) return;
  const catalog = slpEnabledDrama(slpDramaCatalog(await readSlurpDramaLibrary(db)), settings.drama.enabled);
  const stored = await readSlurpDramaState(db);
  const idle =
    !catalog.dramas.length &&
    !catalog.situations.length &&
    !stored.state.runs.some((run) => !run.endedAt) &&
    !stored.state.situations.some((run) => !run.endedAt);
  if (idle && !stored.state.jobs.some((job) => job.status === "queued")) return;
  // The full world (every Creator's spice, card people, followers) only when the runtime moves.
  if (!stored.advancedAt || at.getTime() - Date.parse(stored.advancedAt) >= ADVANCE_EVERY_MS) {
    const world = await loadDramaWorld(db, at);
    const effects = await mutateSlurpDramaState(db, ({ state }) => {
      const result = slpAdvanceDrama(state, {
        at,
        level: settings.drama.level,
        situations: catalog.situations,
        dramas: catalog.dramas,
        dials: settings.drama.dials,
        world,
        activity: slurpWorldActivityMultiplier(settings.worldActivity),
        newId,
      });
      return { stored: { state: result.state, advancedAt: at.toISOString() }, result: result.ties };
    });
    const polyamory = settings.polyamory === true;
    await applyDramaTies(db, effects ?? [], { at, creators: world.tieCreators, polyamory }).catch((error: unknown) =>
      logger.warn(error, "[slurp-drama] Could not apply a drama's tie outcome"),
    );
  }
  // Everything due except post lines (the post planner takes those): questions and DMs first, so
  // comments that wait for a post never hold them up.
  const order = ["choice", "dm", "money", "notification", "comment"];
  const due = slpDueDramaJobs((await readSlurpDramaState(db)).state, at)
    .filter((job) => job.channel !== "post")
    .sort((left, right) => order.indexOf(left.channel) - order.indexOf(right.channel));
  if (!due.length) return;
  const viewerOf = await loadViewerPages(db);
  let sent = 0;
  for (const job of due) {
    if (sent >= 12) break;
    // Claimed before it goes out: a second tick running at the same time never sends it again.
    const claimed = await mutateSlurpDramaState(db, (current) =>
      current.state.jobs.some((entry) => entry.id === job.id && entry.status === "queued")
        ? { stored: { ...current, state: slpMarkDramaJob(current.state, job.id, "done") }, result: true }
        : null,
    );
    if (!claimed) continue;
    const outcome = await sendDramaJob(db, job, viewerOf, at).catch((error: unknown) => {
      logger.warn(error, "[slurp-drama] Could not send a drama beat; it is dropped");
      return "drop" as const;
    });
    if (outcome === true) sent += 1;
    // Not yet (a comment waiting for a post): back in the queue until it goes or expires.
    if (outcome !== true)
      await mutateSlurpDramaState(db, (current) => ({
        stored: {
          ...current,
          state: {
            ...current.state,
            jobs: current.state.jobs.map((entry) =>
              entry.id === job.id
                ? { ...entry, status: outcome === false ? ("queued" as const) : ("dropped" as const) }
                : entry,
            ),
          },
        },
        result: null,
      }));
  }
}

/** The player's pages and the persona behind each: DMs, coins and notifications go to that persona. */
async function loadViewerPages(db: DB): Promise<Map<string, string>> {
  const accounts = await createSlurpStorage(db).listNoodlerAccounts();
  return new Map(
    accounts.flatMap((account) =>
      account.kind === "persona" && account.sourceKind === "persona" && account.sourceEntityId
        ? [[account.id, account.sourceEntityId] as const]
        : [],
    ),
  );
}

/**
 * The drama line for this Creator's next ordinary post, when one is due: its *why*, who is in it,
 * who shot it, who it is for. One line, never the story so far. Marked done unless previewing.
 */
export async function planSlurpDramaBeat(
  db: DB,
  input: { creatorId: string; at: Date; previewOnly?: boolean },
): Promise<SlurpBeat | null> {
  try {
    const { state } = await readSlurpDramaState(db);
    const job = slpDueDramaJobs(state, input.at, "post").find((entry) => entry.actorId === input.creatorId);
    if (!job?.heat) return null;
    const storage = createSlurpStorage(db);
    const nameOf = async (id: string | undefined) =>
      id ? (await storage.getNoodlerAccountById(id))?.displayName : undefined;
    const [withName, shotName, forName] = await Promise.all([
      nameOf(job.heat.withId),
      nameOf(job.heat.shotById),
      nameOf(job.heat.forId),
    ]);
    const parts = [
      `Why this post: ${slpDramaText(job.heat.line, job.names)}`,
      withName ? `${withName} is in it with you.` : "",
      shotName ? `${shotName} took the pictures.` : "",
      forName ? `You made it for ${forName}.` : job.heat.forFans ? "You made it for your fans." : "",
    ].filter(Boolean);
    const cast = [withName, shotName].filter((name): name is string => Boolean(name));
    const castIds = [job.heat.withId, job.heat.shotById].filter((id): id is string => Boolean(id));
    if (!input.previewOnly)
      await mutateSlurpDramaState(db, (current) => ({
        stored: { ...current, state: slpMarkDramaJob(current.state, job.id, "done") },
        result: null,
      }));
    return {
      type: "showcase",
      anchorKind: "drama",
      anchor: withName ?? forName ?? "drama",
      line: parts.join(" "),
      cast: [...new Set(cast)],
      castIds: [...new Set(castIds)],
      place: null,
    };
  } catch (error) {
    logger.warn(error, "[slurp-drama] Could not plan a drama post; this one is ordinary");
    return null;
  }
}

/**
 * The player tapped an answer in a drama's DM. "answered": it counts. "taken": the player already
 * answered this question (a second tap). "late": the question is gone or went its own way.
 */
export async function answerSlurpDramaChoice(
  db: DB,
  input: { runId: string; option: number; stage?: string },
  at = new Date(),
): Promise<"answered" | "taken" | "late"> {
  const result = await mutateSlurpDramaState(db, (current) => {
    const next = slpAnswerDramaChoice(current.state, input.runId, input.option, at, input.stage);
    if (next) return { stored: { ...current, state: next }, result: "answered" as const };
    const run = current.state.runs.find((entry) => entry.id === input.runId && !entry.endedAt);
    const taken = run?.choice?.by === "player" && (input.stage === undefined || run.choice.stage === input.stage);
    return { stored: current, result: taken ? ("taken" as const) : ("late" as const) };
  });
  return result ?? "late";
}
