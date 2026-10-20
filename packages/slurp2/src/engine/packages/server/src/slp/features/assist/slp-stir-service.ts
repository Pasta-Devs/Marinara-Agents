/**
 * Stir (W): plans, plays and the Stir tab, over the one action layer.
 *
 * - `planSlpStir`: plain words → one model call (the AI budget's "Plans" row) → steps, each checked
 *   against the action schemas and previewed. Nothing runs.
 * - `playSlpStir`: runs exactly the steps the player saw, in order, and keeps them in the plays ledger
 *   with what one Undo needs. Plays are free (a sandbox); only an action that calls the AI costs a call.
 * - `undoSlpStirPlay`, `readSlpStirView`.
 */
import type { APIProvider } from "@marinara-engine/shared";
import { resolveStoredMaxTokens } from "../../../services/generation/generation-parameters.js";
import { clampGenerationMaxOutputTokens } from "../../../services/generation/output-token-limits.js";
import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import { resolveBaseUrl } from "../../../services/generation/connection-base-url.js";
import { createLLMProvider } from "../../../services/llm/provider-registry.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import { newId } from "../../../utils/id-generator.js";
import { resolveSlurpTextConnection } from "../../base/identity/slp-connection.js";
import { claimSlurpModelBudget, slurpModelWorkerAllows } from "../../base/model/slp-model-worker.js";
import { slpWithProviderRetry } from "../../base/model/slp-provider-retry.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { readSlurpCreatorSteering } from "../../data/creators/slp-steering-storage.js";
import {
  mutateSlurpStirPlays,
  readSlurpStirDismissed,
  readSlurpStirPlays,
  type SlurpStoredStirPlay,
} from "../../data/assist/slp-stir-plays-storage.js";
import { slurpCoupleActive, slurpCoupleMatches, type SlurpCouple } from "../../modules/projects/slp-creator-couples.js";
import { slurpPlayerCoupleView } from "../../modules/projects/slp-player-couple.js";
import { slurpPairKey } from "../../modules/projects/slp-creator-ties.js";
import { readSlurpCreatorTiesDocument } from "../../data/projects/slp-creator-ties-storage.js";
import { slurpDealOwesPost } from "../../modules/economy/slp-brand-deals.js";
import { buildSlpStirPlanMessages, readSlpStirPlanAnswer } from "../../modules/assist/slp-stir-plan.js";
import { slpStirLive, slpStirSuggestions } from "../../modules/assist/slp-stir-live.js";
import { SLP_STIR_CANT_INVALID, slpRunStirSteps, slpSortStirSteps } from "../../modules/assist/slp-stir-play.js";
import {
  listSlurpBrandCatalog,
  loadSlurpTieCreators,
  slurpIsCouplePage,
  slurpRunsItself,
} from "../projects/slp-projects-contract.js";
import { previewSlpAction } from "./slp-action-preview.js";
import { runSlpActionWithUndo } from "./slp-action-runner.js";
import { readSlpStirWorld, undoSlpAction, type SlpActionUndo } from "./slp-stir-levers.js";
import { readSlurpStirDramas } from "../world/slp-world-contract.js";
import type { SlpAssistOutcome } from "./slp-assist-service.js";
import type {
  SlpActionPreview,
  SlpStirOrigin,
  SlpStirPlan,
  SlpStirPlanRequest,
  SlpStirPlay,
  SlpStirStep,
  SlpStirView,
} from "../../../../../shared/src/slp/slp-stir.js";

type Account = {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl?: string | null;
  kind: string;
  sourceKind?: string | null;
  sourceEntityId?: string | null;
  settings?: { profile?: { stagePersonality?: string; bio?: string; tags?: string[] } };
};

/** One public line per Creator for the planner, so "someone who would hate him" can be picked. */
const slpStirCardLine = (account: Account) => {
  const profile = account.settings?.profile;
  const about = (profile?.stagePersonality || profile?.bio || "").trim();
  const tags = (profile?.tags ?? []).slice(0, 4).join(", ");
  return [about, tags && `tags: ${tags}`].filter(Boolean).join("; ") || undefined;
};

/** The Creator ids a step names, whatever the action calls them. */
const slpStirStepPeople = (input: Record<string, unknown>) =>
  ["accountId", "aId", "bId", "fromId", "toId", "leadId", "aboutId", "withIds", "accountIds"].flatMap((key) =>
    [input[key]].flat().filter((id): id is string => typeof id === "string"),
  );

/** What a step made or touched, from its result: the ids a ledger row can link to. */
const slpStirStepRef = (value: unknown): Record<string, string> | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const post = record.post as { id?: unknown } | undefined;
  const ref = Object.fromEntries(
    [
      ...["collabId", "rivalryId", "coupleId", "occurrenceId", "projectId", "dealId"].map(
        (key) => [key, record[key]] as const,
      ),
      ["postId", post?.id] as const,
    ].filter((entry): entry is readonly [string, string] => typeof entry[1] === "string"),
  );
  return Object.keys(ref).length ? ref : undefined;
};

/**
 * The pages the other personas run (0.3.11): one persona's Stir never lists, steers or undoes them, and
 * never shows a couple, collab or rivalry one of them is in. Empty without a persona (a Support plan).
 */
export async function readSlpStirHidden(db: DB, own?: (account: Account) => boolean): Promise<Set<string>> {
  if (!own) return new Set();
  const accounts = (await createSlurpStorage(db).listNoodlerAccounts()) as Account[];
  return new Set(accounts.filter((account) => !slurpRunsItself(account) && !own(account)).map((account) => account.id));
}

/** Every page a step names or reaches through a couple, collab or rivalry id. */
async function slpStirStepReach(db: DB, steps: readonly SlpStirStep[]): Promise<Set<string>> {
  const { ties, couples, bonds } = await readSlurpCreatorTiesDocument(db);
  const { runs } = await readSlurpStirDramas(db);
  const ids = new Set<string>();
  for (const step of steps) {
    const input = step.input as Record<string, unknown>;
    for (const id of slpStirStepPeople(input)) ids.add(id);
    const couple = couples.find((entry) => entry.id === input.coupleId);
    for (const id of couple ? [couple.aId, couple.bId, ...(couple.moreIds ?? [])] : []) ids.add(id);
    const collab = ties.collabs.find((entry) => entry.id === input.collabId);
    for (const id of collab ? [collab.hostId, collab.partnerId] : []) ids.add(id);
    const rivalry = ties.rivalries.find((entry) => entry.id === input.rivalryId);
    for (const id of rivalry ? [rivalry.fromId, rivalry.toId] : []) ids.add(id);
    const bond = bonds.find((entry) => entry.id === input.bondId);
    for (const id of bond ? [bond.aId, bond.bId] : []) ids.add(id);
    const run = runs?.find((entry) => entry.id === input.runId);
    for (const id of run ? Object.values(run.cast) : []) ids.add(id);
  }
  return ids;
}

/** Whether these steps reach one of another persona's pages. */
export async function slpStirReachesHidden(
  db: DB,
  steps: readonly SlpStirStep[],
  hidden: ReadonlySet<string>,
): Promise<boolean> {
  if (!hidden.size) return false;
  return [...(await slpStirStepReach(db, steps))].some((id) => hidden.has(id));
}

/**
 * Preview a list of steps (a plan, a card, a Support proposal). A step the layer does not know, or
 * with input its schema refuses, comes back in `cant` in plain words, never as a silent drop.
 */
export async function previewSlpStirSteps(
  db: DB,
  steps: readonly SlpStirStep[],
): Promise<{ cards: SlpActionPreview[]; cant: string[] }> {
  const { plays, cant } = slpSortStirSteps(steps);
  const cards: SlpActionPreview[] = [];
  for (const play of plays) {
    const preview = await previewSlpAction(db, play.action, play.input);
    if (preview.ok) cards.push(preview.value);
    else cant.push(SLP_STIR_CANT_INVALID);
  }
  return { cards, cant };
}

/**
 * Plain words → a previewed plan. One model call; nothing in the world changes. The player's own
 * request never spends the AI budget (0.3.6); a Creator's DM proposal (`world`) is on the "Plans" row.
 */
export async function planSlpStir(
  db: DB,
  request: Omit<SlpStirPlanRequest, "personaId">,
  /** The pages the playing persona runs; without one, every page the player runs is theirs. */
  own?: (account: Account) => boolean,
  origin: "player" | "world" = "world",
): Promise<SlpAssistOutcome<SlpStirPlan>> {
  const storage = createSlurpStorage(db);
  const settings = await storage.getSettings();
  if (origin === "world" && !slurpModelWorkerAllows(settings.modelBudget, "present"))
    return { ok: false, status: 409, error: "Plans need your AI connection. The cards still work." };
  const connection = await resolveSlurpTextConnection(
    createConnectionsStorage(db),
    settings.modelBudget.connectionId ?? settings.generationConnectionId,
  );
  if (!connection) return { ok: false, status: 409, error: "Select a text generation connection first." };
  const accounts = (await storage.listNoodlerAccounts()) as Account[];
  const about = request.creatorId ? accounts.find((account) => account.id === request.creatorId) : null;
  const post = request.postId ? await storage.getPostById(request.postId) : null;
  const [fullWorld, catalog, plays] = await Promise.all([
    readSlpStirWorld(db),
    listSlurpBrandCatalog(db),
    readSlurpStirPlays(db),
  ]);
  // Another persona's pages, and every tie and drama they are in, stay out of this plan (0.3.11).
  const hidden = new Set(
    own ? accounts.filter((account) => !slurpRunsItself(account) && !own(account)).map((account) => account.id) : [],
  );
  const seen = (...ids: string[]) => !ids.some((id) => hidden.has(id));
  const world = {
    ...fullWorld,
    couples: fullWorld.couples.filter((couple) => seen(couple.aId, couple.bId, ...(couple.moreIds ?? []))),
    collabs: fullWorld.collabs.filter((collab) => seen(collab.hostId, collab.partnerId)),
    rivalries: fullWorld.rivalries.filter((rivalry) => seen(rivalry.fromId, rivalry.toId)),
    bonds: (fullWorld.bonds ?? []).filter((bond) => seen(bond.aId, bond.bId)),
    runs: (fullWorld.runs ?? []).filter((run) => seen(...Object.values(run.cast))),
    storylines: fullWorld.storylines.filter((story) => seen(story.accountId)),
  };
  if (origin === "world" && !(await claimSlurpModelBudget(db, settings.modelBudget, "plan")))
    return { ok: false, status: 429, error: "Today's AI budget for plans is used up. The cards still work." };
  const provider = slpWithProviderRetry(
    createLLMProvider(
      connection.provider,
      resolveBaseUrl(connection),
      connection.apiKey,
      connection.maxContext,
      connection.openrouterProvider,
      connection.maxTokensOverride,
      connection.claudeFastMode === "true",
      connection.treatAsLocalEndpoint === "true",
      connection.defaultParameters,
      // The player's own plan is foreground work on the connection; a Creator's proposal runs inside its reply.
      origin === "player" ? connection.id : undefined,
    ),
  );
  const result = await provider.chatComplete(
    buildSlpStirPlanMessages({
      text: request.text,
      creators: accounts
        // Another persona's pages are not this persona's to plan with (0.3.11).
        .filter((account) => !slurpIsCouplePage(account) && (!own || slurpRunsItself(account) || own(account)))
        .map((account) => ({
          id: account.id,
          name: account.displayName,
          handle: account.handle,
          automatic: slurpRunsItself(account),
          own: own ? own(account) : undefined,
          card: slpStirCardLine(account),
        })),
      world,
      brands: catalog.brands,
      about: about ? { id: about.id, name: about.displayName } : null,
      post: post ? { id: post.id, caption: String((post as { content?: unknown }).content ?? "") } : null,
      recent: plays
        .filter((play) => play.steps.every((step) => seen(...slpStirStepPeople(step.input))))
        .slice(0, 5)
        .map((play) => ({
          action: play.steps.map((step) => step.action).join(" + "),
          who: [...new Set(play.steps.flatMap((step) => slpStirStepPeople(step.input)))],
          undone: play.undone,
        })),
      followUp: request.followUp ?? null,
    }),
    // Reasoning headroom, like the writing help: a plan is short, the thinking may not be.
    {
      model: connection.model,
      temperature: 0.3,
      maxTokens: clampGenerationMaxOutputTokens({
        provider: connection.provider as APIProvider,
        model: connection.model,
        maxTokens: Math.max(resolveStoredMaxTokens(connection.defaultParameters, 3072), 3072),
        maxTokensOverride: connection.maxTokensOverride,
      }),
    },
  );
  const answer = readSlpStirPlanAnswer(result.content);
  if (!answer) return { ok: false, status: 502, error: "That plan came back garbled. Try again, or play a card." };
  const { cards, cant } = await previewSlpStirSteps(db, answer.steps);
  return { ok: true, value: { cards, question: answer.question, cant: [...answer.cant, ...cant] } };
}

/**
 * Do it: run exactly these steps, in order, and keep the play. A step that fails does not stop the
 * others (each is its own beat); the answer says which ran. Undo is offered when anything that ran
 * can be taken back.
 */
export async function playSlpStir(
  db: DB,
  input: { steps: readonly SlpStirStep[]; origin: SlpStirOrigin; personaId?: string },
  at = new Date(),
): Promise<{ play: SlpStirPlay; results: { ok: boolean; value: unknown; error: string | null }[] }> {
  const { steps, results, undo } = await slpRunStirSteps<SlpActionUndo>(input.steps, (action, stepInput) =>
    runSlpActionWithUndo(db, action, stepInput),
  );
  const play = {
    id: newId(),
    at: at.toISOString(),
    origin: input.origin,
    steps: steps.map((step, index) => {
      const ref = results[index]?.ok ? slpStirStepRef(results[index]!.value) : undefined;
      return ref ? { ...step, ref } : step;
    }),
    undoable: undo.length > 0,
    undone: false,
    ...(input.personaId ? { personaId: input.personaId } : {}),
    undo,
  };
  await mutateSlurpStirPlays(db, (plays) => ({ plays: [play, ...plays], result: null }));
  const { undo: _undo, ...visible } = play;
  return { play: visible, results };
}

/**
 * One Undo for everything reversible in that play, newest step first. The play is marked taken back
 * before anything runs, so a second tap cannot run it twice. `kept` counts the steps the world has
 * moved past (a partner with someone new, an idea already posted): those stay as they are.
 */
export async function undoSlpStirPlay(
  db: DB,
  id: string,
  /** The persona asking: another persona's play is not theirs to take back (0.3.11). */
  personaId?: string,
): Promise<SlpAssistOutcome<{ play: SlpStirPlay; kept: number }>> {
  const claimed = await mutateSlurpStirPlays<SlurpStoredStirPlay | "gone" | "cant">(db, (plays) => {
    const play = plays.find((entry) => entry.id === id);
    if (!play || (personaId && play.personaId && play.personaId !== personaId))
      return { plays, result: "gone" as const };
    if (play.undone || !play.undoable) return { plays, result: "cant" as const };
    return {
      plays: plays.map((entry) => (entry.id === id ? { ...entry, undone: true, undo: [] } : entry)),
      result: play,
    };
  });
  if (claimed === "gone") return { ok: false, status: 404, error: "That play is gone." };
  if (claimed === "cant") return { ok: false, status: 409, error: "That one cannot be taken back." };
  let kept = 0;
  for (const entry of [...claimed.undo].reverse()) {
    const done = await undoSlpAction(db, entry as SlpActionUndo).catch((error: unknown) => {
      logger.warn(error, "[slurp] A Stir undo step failed");
      return false;
    });
    if (!done) kept += 1;
  }
  const { undo: _undo, ...visible } = claimed;
  if (kept && kept === claimed.undo.length) {
    // Nothing could go back: the play is not "taken back" in the ledger or to the planner.
    await mutateSlurpStirPlays(db, (plays) => ({
      plays: plays.map((entry) => (entry.id === id ? { ...entry, undone: false, undoable: false } : entry)),
      result: null,
    }));
    return { ok: false, status: 409, error: "Too much has happened since to take that back." };
  }
  return { ok: true, value: { play: { ...visible, undone: true }, kept } };
}

/**
 * Everything the Stir tab shows, in one read. `own` marks the pages this persona runs; another
 * persona's pages, their couples, collabs, rivalries and plays are left out (0.3.11).
 */
export async function readSlpStirView(
  db: DB,
  own: (account: Account) => boolean,
  at = new Date(),
  personaId?: string,
): Promise<SlpStirView> {
  const storage = createSlurpStorage(db);
  const [allAccounts, fullWorld, fullDocument, allPlays, occurrences, dismissed, allTieCreators] = await Promise.all([
    storage.listNoodlerAccounts() as Promise<Account[]>,
    readSlpStirWorld(db, at),
    readSlurpCreatorTiesDocument(db),
    readSlurpStirPlays(db),
    storage.listStoryOccurrences(),
    readSlurpStirDismissed(db, at),
    // ponytail: every Creator's fit text on each Stir visit, for "they would click"; cache it if a big cast feels slow.
    loadSlurpTieCreators(db, at),
  ]);
  const hidden = new Set(
    allAccounts.filter((account) => !slurpRunsItself(account) && !own(account)).map((account) => account.id),
  );
  const seen = (...ids: (string | undefined)[]) => !ids.some((id) => id && hidden.has(id));
  const accounts = allAccounts.filter((account) => seen(account.id));
  const tieCreators = allTieCreators.filter((creator) => seen(creator.id));
  const plays = allPlays.filter((play) => !personaId || !play.personaId || play.personaId === personaId);
  const world = {
    ...fullWorld,
    couples: fullWorld.couples.filter((couple) => seen(couple.aId, couple.bId, ...(couple.moreIds ?? []))),
    collabs: fullWorld.collabs.filter((collab) => seen(collab.hostId, collab.partnerId)),
    rivalries: fullWorld.rivalries.filter((rivalry) => seen(rivalry.fromId, rivalry.toId)),
    bonds: (fullWorld.bonds ?? []).filter((bond) => seen(bond.aId, bond.bId)),
    runs: (fullWorld.runs ?? []).filter((run) => seen(...Object.values(run.cast))),
  };
  const document = {
    ...fullDocument,
    couples: fullDocument.couples.filter((couple) => seen(couple.aId, couple.bId, ...(couple.moreIds ?? []))),
    ties: {
      ...fullDocument.ties,
      collabs: fullDocument.ties.collabs.filter((collab) => seen(collab.hostId, collab.partnerId)),
    },
  };
  const rivals = new Set(world.rivalries.map((rivalry) => slurpPairKey(rivalry.fromId, rivalry.toId)));
  const matches = slurpCoupleMatches(
    tieCreators,
    new Set(
      document.couples
        .filter(slurpCoupleActive)
        .flatMap((couple) => [couple.aId, couple.bId, ...(couple.moreIds ?? [])]),
    ),
    (a, b) => rivals.has(slurpPairKey(a, b)),
  )
    .sort((left, right) => right.fit.chemistry - left.fit.chemistry)
    .map(({ a, b }) => ({ aId: a.id, bId: b.id }));
  const creators = await Promise.all(
    accounts.map(async (account) => {
      const automatic = slurpRunsItself(account);
      const [steering, latest] = await Promise.all([
        readSlurpCreatorSteering(db, account.id),
        automatic ? storage.getNoodlerLatestPublishedPost(account.id) : Promise.resolve(null),
      ]);
      return {
        id: account.id,
        name: account.displayName,
        handle: account.handle,
        avatarUrl: account.avatarUrl ?? null,
        automatic,
        own: own(account),
        couplePage: slurpIsCouplePage(account),
        lastPostAt: (latest as { createdAt?: string } | null)?.createdAt ?? null,
        pace: steering.pace,
        ideas: steering.nudges.length,
      };
    }),
  );
  const endsAt = new Map<string, string>(
    occurrences
      .filter(
        (occurrence: { status: string; endsAt: string }) =>
          occurrence.status === "active" && occurrence.endsAt > at.toISOString(),
      )
      .map((occurrence: { blueprintId: string; endsAt: string }) => [occurrence.blueprintId, occurrence.endsAt]),
  );
  const ownIds = new Set(creators.filter((creator) => creator.own).map((creator) => creator.id));
  const liveInput = {
    at,
    creators,
    couples: document.couples,
    collabs: document.ties.collabs.filter((collab) => world.collabs.some((open) => open.id === collab.id)),
    rivalries: world.rivalries,
    events: world.events.map((event) => ({ ...event, endsAt: endsAt.get(event.id) ?? null })),
    owed: document.deals
      .filter((deal) => ownIds.has(deal.creatorId) && slurpDealOwesPost(deal, at))
      .map((deal) => ({ id: deal.id, creatorId: deal.creatorId, brand: deal.brand })),
    firstVisit: plays.length === 0,
    matches,
    dismissed,
  };
  const shownPlays = plays.slice(0, 12);
  // Step 1 (Stir follows through): the collabs the shown plays started or pushed, finished ones too,
  // so a row can say how it went and open the joint post while it exists.
  const playedIds = new Set(
    shownPlays.flatMap((play) =>
      play.steps.flatMap((step) => [step.ref?.collabId ?? step.input.collabId].filter((id) => typeof id === "string")),
    ),
  );
  const playedCollabs = await Promise.all(
    document.ties.collabs
      .filter((collab) => playedIds.has(collab.id))
      .map(async (collab) => ({
        id: collab.id,
        hostId: collab.hostId,
        partnerId: collab.partnerId,
        status: collab.status,
        decline: collab.decline,
        postId: collab.postId && (await storage.getPostById(collab.postId)) ? collab.postId : null,
      })),
  );
  return {
    live: slpStirLive(liveInput),
    suggestions: slpStirSuggestions(liveInput),
    plays: shownPlays.map(({ undo: _undo, ...play }) => play),
    playedCollabs,
    creators: creators.map(({ lastPostAt: _last, pace: _pace, ideas: _ideas, ...creator }) => creator),
    events: world.events,
    couples: world.couples,
    collabs: world.collabs,
    rivalries: world.rivalries,
    storylines: world.storylines,
    bonds: world.bonds,
    dramas: world.dramas ?? [],
    runs: world.runs,
    yourCouples: slpStirYourCouples(accounts, own, fullDocument.couples, at),
  };
}

/** The Creators this persona's own pages are with, or were lately (an ex for a month), newest first. */
function slpStirYourCouples(
  accounts: readonly Account[],
  own: (account: Account) => boolean,
  couples: readonly SlurpCouple[],
  at: Date,
): SlpStirView["yourCouples"] {
  const byId = new Map(accounts.map((account) => [account.id, account]));
  const pages = new Set(accounts.filter((account) => !slurpRunsItself(account) && own(account)).map((a) => a.id));
  const recent = (couple: SlurpCouple) =>
    slurpCoupleActive(couple) || at.getTime() - Date.parse(couple.stageAt) < 30 * 86_400_000;
  const seenPartners = new Set<string>();
  return [...couples]
    .reverse()
    .flatMap((couple) => {
      const members = [couple.aId, couple.bId, ...(couple.moreIds ?? [])];
      const page = members.find((id) => pages.has(id));
      const partner = members.map((id) => byId.get(id)).find((account) => account && slurpRunsItself(account));
      if (!page || !partner || !recent(couple) || seenPartners.has(partner.id)) return [];
      seenPartners.add(partner.id);
      return [
        {
          partner: { id: partner.id, name: partner.displayName, avatarUrl: partner.avatarUrl ?? null },
          couple: slurpPlayerCoupleView(couple, at),
        },
      ];
    })
    .sort((left, right) => Number(right.couple.stage !== "split") - Number(left.couple.stage !== "split"));
}
