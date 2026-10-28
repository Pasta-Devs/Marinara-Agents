/**
 * Tier 2: rewriting what the world wrote from a template.
 *
 * The maintainer's rule is that unattended work never calls the model. So a commission brief, a
 * question, or an opening message created by a background tick comes from the combinatorial bank
 * in `slurp-world-copy.ts`, deliberately vague — a template that fakes specificity about a post it
 * never read is worse than one that does not try.
 *
 * That vagueness is the cost of the rule, and this is where the cost is paid back. When the player
 * is present, each placeholder is rewritten against the thing it is actually about: the post, the
 * Creator, and who is speaking. Nothing is generated for text nobody will read, because the drain
 * only runs on a read.
 *
 * Bounded per drain. Opening Slurp after a week away must not stall behind a queue, and the few
 * most recent items are the ones anybody will actually look at.
 */
import type { DB } from "../../../db/connection.js";
import { isUnsupportedTableError } from "../../base/host/slp-host-tables.js";
import { desc, eq } from "../../../db/file-query.js";
import { logger } from "../../../lib/logger.js";
import { slurpPendingText } from "../../../db/schema/slurp.js";
import { newId, now } from "../../../utils/id-generator.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { createSlurpMessagesStorage } from "../../data/slp-storage.js";
import { createSlurpPopulationStorage } from "../../data/audience/slp-audience-storage-funnel.js";
import { createLLMProvider } from "../../../services/llm/provider-registry.js";
import { withConnectionFallbackProvider } from "../../../services/llm/connection-fallback-provider.js";
import { resolveBaseUrl } from "../../../services/generation/connection-base-url.js";
import { resolveStoredChatOptions } from "../../../services/generation/generation-parameters.js";
import { clampGenerationMaxOutputTokens } from "../../../services/generation/output-token-limits.js";
import { parseGameJsonish } from "../../../services/game/jsonish.js";
import { requireModelAnswer } from "../../base/model/slp-model-answer.js";
import { slpSamplingOptions } from "../../base/prompting/slp-sampling-options.js";
import { resolveSlurpTextConnection } from "../../base/identity/slp-connection.js";
import {
  SLURP_FAN_VOICE_PROMPT_MAX,
  slurpFanMemoryForPrompt,
  slurpFanVoiceForPrompt,
  slurpResolveFanType,
} from "../../../../../shared/src/slp/slp-fan-types.js";
import { resolveSlurpCharacterFanVoice } from "../../data/creators/slp-source-resolve.js";
import { NOODLER_UNTRUSTED_CONTENT_INSTRUCTION } from "../feed/slp-feed-contract.js";
import type { APIProvider } from "@marinara-engine/shared";
import { resolveSlurpCreatorFlavour } from "../../data/creators/slp-flavour-source.js";
import { slurpRotationHash } from "../../modules/feed/slp-post-variation.js";
import {
  claimSlurpModelBudget,
  slurpModelWorkerAllows,
  type SlurpModelJobKind,
  type SlurpModelWorkerContext,
} from "../../base/model/slp-model-worker.js";
import { composeSlurpPromptBlocks, type SlurpPromptBlockOverrides } from "../../base/prompting/slp-prompt-blocks.js";
import { slurpPromptContext } from "../../base/prompting/slp-prompt-blocks.js";
import { slpWithProviderRetry } from "../../base/model/slp-provider-retry.js";
import { slurpPausedNow } from "../../data/settings/slp-pause-storage.js";

export type SlurpPendingKind = "commission" | "question" | "opener" | "delivery" | "desk";

/** Rewritten per drain. Small: a long absence must not stall the first read behind a queue. */
const DRAIN_LIMIT = 2;
const JOB_MAX_ATTEMPTS = 3;
const JOB_TTL_MS = 7 * 86_400_000;

/** Longest a rewrite may be. These are one-liners; a paragraph would not fit where they render. */
const MAX_LENGTH: Record<SlurpPendingKind, number> = {
  commission: 400,
  question: 180,
  opener: 240,
  delivery: 240,
  desk: 400,
};
/** The kinds the Creator speaks: a delivery note, and a line to Slurp Support (docs/SUPPORT-DESK.md). */
const creatorSpeaks = (kind: SlurpPendingKind) => kind === "delivery" || kind === "desk";

export async function enqueueSlurpPendingText(
  db: DB,
  input: {
    kind: SlurpPendingKind;
    subjectId: string;
    creatorAccountId: string;
    postId?: string | null;
    actorLabel?: string | null;
  },
): Promise<void> {
  try {
    await db.insert(slurpPendingText).values({
      id: newId(),
      kind: input.kind,
      subjectId: input.subjectId,
      creatorAccountId: input.creatorAccountId,
      postId: input.postId ?? null,
      actorLabel: input.actorLabel ?? null,
      jobKind: input.kind === "commission" ? "brief" : "rewrite",
      priority: input.kind === "commission" ? "4" : "2",
      status: "pending",
      attempts: "0",
      expiresAt: new Date(Date.now() + JOB_TTL_MS).toISOString(),
      createdAt: now(),
    });
  } catch (error) {
    // A placeholder that never gets rewritten is still a usable placeholder. Never let the queue
    // break the action that produced the text.
    // A host that cannot hold the table says so once at activation; repeating it per write is noise.
    if (!isUnsupportedTableError(error)) {
      logger.warn(error, "[slurp-pending] Could not enqueue a %s rewrite", input.kind);
    }
  }
}

function buildMessages(input: {
  kind: SlurpPendingKind;
  creator: { displayName: string; handle: string; bio: string };
  speaker: string;
  /** How this fan's Fan Type writes. Short; a rewrite is one or two sentences. */
  speakerVoice?: string;
  /** Short shared history derived from the audience tie. */
  speakerMemory?: string;
  placeholder: string;
  post?: { title: string | null; content: string | null } | null;
  /** A delivery note's flavour brief: how this Creator sounds. See `slp-creator-flavour.ts`. */
  flavourBrief?: string;
  promptBlocks?: SlurpPromptBlockOverrides;
}) {
  // A delivery note is the only kind the creator speaks, so it gets the opposite framing. Handing
  // it the fan-voice preamble produced deliveries written as if the fan had drawn the picture.
  const shared =
    input.kind === "desk"
      ? [
          NOODLER_UNTRUSTED_CONTENT_INSTRUCTION,
          "You are rewriting one short message a Slurp creator sends to Slurp Support, the staff who run the platform. Write only the creator's words.",
          "Never write as Slurp Support, and never answer on their behalf.",
          'Return exactly one JSON object with one string field named "content". Return JSON only.',
        ]
      : input.kind === "delivery"
        ? [
            NOODLER_UNTRUSTED_CONTENT_INSTRUCTION,
            "You are rewriting one short note a Slurp creator sends with a finished commission. Write only the creator's words.",
            "Never write as the fan, and never speak for them.",
            'Return exactly one JSON object with one string field named "content". Return JSON only.',
          ]
        : [
            NOODLER_UNTRUSTED_CONTENT_INSTRUCTION,
            "You are rewriting one short piece of text a fan sent to a Slurp creator. Write only the fan's words.",
            "Never write as the creator, and never answer on their behalf.",
            'Return exactly one JSON object with one string field named "content". Return JSON only.',
          ];
  const instruction =
    input.kind === "commission"
      ? "Rewrite this commission request so it asks for something specific that suits this particular creator, in the fan's own voice. Keep it to a few sentences and stay polite about price and timing."
      : input.kind === "question"
        ? "Rewrite this question so it is about the actual post below, in the fan's own voice. One sentence, lowercase is fine, no greeting."
        : input.kind === "desk"
          ? "Rewrite this message to Slurp Support so it sounds like this particular creator writing to the platform's staff: the same point, in their own voice and mood. One to three sentences. Keep the message's language."
          : input.kind === "delivery"
            ? "Rewrite this hand-over note so it sounds like this particular creator giving a fan the piece they paid for. One or two sentences, warm, no greeting, never describe the picture, and keep the note's language."
            : "Rewrite this first message so it sounds like this particular person writing to this particular creator for the first time. Keep it short and a little awkward. Do not ask for anything.";

  const data = {
    creator: input.creator,
    fan:
      input.speakerVoice || input.speakerMemory
        ? {
            name: input.speaker,
            ...(input.speakerVoice ? { voice: input.speakerVoice } : {}),
            ...(input.speakerMemory ? { memory: input.speakerMemory } : {}),
          }
        : input.speaker,
    ...(input.post ? { post: input.post } : {}),
    placeholderToReplace: input.placeholder,
  };
  return [
    {
      role: "system" as const,
      content: composeSlurpPromptBlocks(
        `pending${input.kind[0].toUpperCase()}${input.kind.slice(1)}` as "pendingCommission",
        [
          { id: "task", kind: "editable", text: instruction },
          { id: "safety", kind: "required", text: shared.slice(0, -1).join("\n") },
          { id: "output", kind: "required", text: shared.at(-1) ?? "Return JSON only." },
          { id: "source", kind: "context", text: "The supplied Slurp data follows." },
        ],
        input.promptBlocks,
      ),
    },
    {
      role: "user" as const,
      content: `# Untrusted Slurp data\n${JSON.stringify(data, null, 2)}${
        input.flavourBrief?.trim() ? `\n\n# How the creator sounds\n${input.flavourBrief}` : ""
      }`,
    },
  ];
}

/** The line was answered as it stands (an AI fan's opener, task E), so a later rewrite must not change it. */
export async function dropSlurpPendingText(db: DB, subjectId: string): Promise<void> {
  await db
    .delete(slurpPendingText)
    .where(eq(slurpPendingText.subjectId, subjectId))
    .catch(() => undefined);
}

/** Placeholders still waiting for a rewrite, for the count in AI budget settings. */
export async function countSlurpPendingText(db: DB): Promise<number> {
  try {
    return (
      await db.select({ id: slurpPendingText.id }).from(slurpPendingText).where(eq(slurpPendingText.status, "pending"))
    ).length;
  } catch (error) {
    if (isUnsupportedTableError(error)) return 0;
    throw error;
  }
}

let rewritingAll: Promise<unknown> | null = null;

/** Pending rows a drain in this process is working on. ponytail: one process; a conditional row claim if Slurp ever runs in several. */
const inFlightPendingText = new Set<string>();

/** Whether a "Rewrite all pending" run is still going. */
export const slurpRewritingAllPending = () => rewritingAll !== null;

/**
 * "Rewrite all pending": the player asked for it, so no per-read limit and no day pace. The day's
 * caps still hold, so the run stops where the budget does. Not awaited by the route: a long queue
 * is many sequential model calls. Returns false while a run is already going.
 */
export function startSlurpRewriteAllPending(db: DB): boolean {
  if (rewritingAll) return false;
  rewritingAll = drainSlurpPendingText(db, Number.POSITIVE_INFINITY, "present", false)
    .catch((error: unknown) => logger.warn(error, "[slurp-pending] Rewrite all failed"))
    .finally(() => {
      rewritingAll = null;
    });
  return true;
}

/**
 * Rewrite the newest few placeholders.
 *
 * Called from a read, so the player is present and the spend is against text they are about to
 * see, and from the world scheduler with a larger limit. Returns how many were rewritten.
 */
export async function drainSlurpPendingText(
  db: DB,
  limit = DRAIN_LIMIT,
  context: SlurpModelWorkerContext = "present",
  /** False only for a player's "Rewrite all pending". */
  paced = true,
): Promise<number> {
  // "Pause all": nothing is written while Slurp is paused; the queue waits.
  if (await slurpPausedNow(db)) return 0;
  const noodle = createSlurpStorage(db);
  const settings = await noodle.getSettings();
  if (!slurpModelWorkerAllows(settings.modelBudget, context)) return 0;
  // Nothing was ever queued on a host that cannot hold the table, so there is nothing to drain.
  // Without this the catch-up on open warns on every page load about a queue that cannot exist.
  // An unsupported table throws while the query is being built, not when it is awaited, so this
  // has to be a try rather than a rejection handler.
  let rows;
  try {
    const staleClaimBefore = Date.now() - 10 * 60_000;
    for (const claimed of await db.select().from(slurpPendingText).where(eq(slurpPendingText.status, "running"))) {
      const claimedAt = claimed.claimedAt ? Date.parse(String(claimed.claimedAt)) : Number.NaN;
      if (!Number.isFinite(claimedAt) || claimedAt <= staleClaimBefore) {
        await db
          .update(slurpPendingText)
          .set({ status: "pending", claimedAt: null })
          .where(eq(slurpPendingText.id, String(claimed.id)));
      }
    }
    // A row that failed for good never reaches the expiry check below, so expire those here.
    for (const failed of await db.select().from(slurpPendingText).where(eq(slurpPendingText.status, "failed"))) {
      const failedExpiry = failed.expiresAt ? Date.parse(String(failed.expiresAt)) : Number.NaN;
      if (Number.isFinite(failedExpiry) && failedExpiry <= Date.now()) {
        await db.delete(slurpPendingText).where(eq(slurpPendingText.id, String(failed.id)));
      }
    }
    const pendingRows = await db
      .select()
      .from(slurpPendingText)
      .where(eq(slurpPendingText.status, "pending"))
      .orderBy(desc(slurpPendingText.createdAt));
    rows = pendingRows
      .sort((left, right) => {
        const leftPolicy =
          settings.modelBudget.jobs[(left.jobKind === "brief" ? "brief" : "rewrite") as SlurpModelJobKind];
        const rightPolicy =
          settings.modelBudget.jobs[(right.jobKind === "brief" ? "brief" : "rewrite") as SlurpModelJobKind];
        return (
          (leftPolicy?.priority ?? Number(left.priority)) - (rightPolicy?.priority ?? Number(right.priority)) ||
          String(right.createdAt).localeCompare(String(left.createdAt))
        );
      })
      .slice(0, limit);
  } catch (error) {
    // Nothing was ever queued on a host that cannot hold the table, so there is nothing to drain.
    if (isUnsupportedTableError(error)) return 0;
    throw error;
  }
  if (rows.length === 0) return 0;

  const connection = await resolveSlurpTextConnection(
    createConnectionsStorage(db),
    settings.modelBudget.connectionId ?? settings.generationConnectionId,
  );
  // No connection is not a failure. The placeholders stay, and stay usable.
  if (!connection) return 0;

  // Every other Slurp text path runs behind the fallback connection. This one called the provider
  // bare, so a primary outage left placeholders unrewritten while the rest of Slurp carried on.
  const connections = createConnectionsStorage(db);
  const fallbackConnection = await connections.getFallbackForMain();
  const provider = slpWithProviderRetry(
    withConnectionFallbackProvider({
      primary: createLLMProvider(
        connection.provider,
        resolveBaseUrl(connection),
        connection.apiKey,
        connection.maxContext,
        connection.openrouterProvider,
        connection.maxTokensOverride,
        connection.claudeFastMode === "true",
        connection.treatAsLocalEndpoint === "true",
        connection.defaultParameters,
      ),
      primaryConnectionId: connection.id,
      fallbackConnection,
      fallbackBaseUrl: fallbackConnection ? resolveBaseUrl(fallbackConnection) : "",
      category: "main",
    }),
  );
  const messages = createSlurpMessagesStorage(db);
  const population = createSlurpPopulationStorage(db);
  let rewritten = 0;

  // Rows this drain claimed. A scheduled drain, a read and "Rewrite all now" can overlap; the stored
  // claim is read-then-write, so the in-process set is what stops two of them paying for one row.
  const claimedHere: string[] = [];
  try {
    for (const row of rows) {
      const id = String(row.id);
      const expiresAt = row.expiresAt ? Date.parse(String(row.expiresAt)) : Number.POSITIVE_INFINITY;
      if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
        await db.delete(slurpPendingText).where(eq(slurpPendingText.id, id));
        continue;
      }
      const jobKind = (row.jobKind === "brief" ? "brief" : "rewrite") as SlurpModelJobKind;
      // Everything that needs no model is checked first, so a stale row never spends budget.
      const kind = String(row.kind) as SlurpPendingKind;
      const creator = await noodle.getNoodlerAccountById(String(row.creatorAccountId));
      const placeholder = creator ? await readPlaceholder(db, kind, String(row.subjectId)) : null;
      if (!creator || !placeholder) {
        await db.delete(slurpPendingText).where(eq(slurpPendingText.id, id));
        continue;
      }
      // Claim the row before the budget, so a concurrent drain that got here first is skipped.
      // ponytail: read-then-write claim, not atomic across processes; a conditional update if that race shows up.
      const [current] = await db.select().from(slurpPendingText).where(eq(slurpPendingText.id, id));
      if (!current || current.status !== "pending" || inFlightPendingText.has(id)) continue;
      inFlightPendingText.add(id);
      claimedHere.push(id);
      const attempts = Math.max(0, Number.parseInt(String(row.attempts ?? "0"), 10) || 0) + 1;
      await db
        .update(slurpPendingText)
        .set({ status: "running", attempts: String(attempts), claimedAt: now() })
        .where(eq(slurpPendingText.id, id));
      if (!(await claimSlurpModelBudget(db, settings.modelBudget, jobKind, undefined, paced ? undefined : false))) {
        await db
          .update(slurpPendingText)
          .set({ status: "pending", attempts: String(attempts - 1), claimedAt: null })
          .where(eq(slurpPendingText.id, id));
        break;
      }
      try {
        const actorId = row.actorLabel ? String(row.actorLabel) : null;
        const member = actorId ? await population.get(actorId).catch(() => null) : null;
        const tie = actorId
          ? (await population.listTiesForCreator(creator.id).catch(() => [])).find(
              (entry) => entry.memberId === actorId,
            )
          : undefined;
        // Read once: the account supplies both the fallback display name and, for an invited
        // character, the entity id that leads back to its card.
        const actorAccount = actorId && !member ? await noodle.getNoodlerAccountById(actorId) : null;
        const speaker = member?.displayName ?? actorAccount?.displayName ?? "a reader";
        // An invited character speaks in its own words here too, so a rewritten placeholder matches
        // the voice the same character uses in comments and direct messages.
        const characterFanVoice = await resolveSlurpCharacterFanVoice(
          db,
          actorAccount?.entityId,
          SLURP_FAN_VOICE_PROMPT_MAX,
        ).catch(() => undefined);
        const post = row.postId ? await noodle.getNoodlerPostById(String(row.postId)) : null;

        const response = await provider.chatComplete(
          buildMessages({
            kind,
            creator: { displayName: creator.displayName, handle: creator.handle, bio: creator.bio },
            speaker,
            // A placeholder rewritten in the fan's own voice is the whole point of the upgrade.
            speakerVoice: creatorSpeaks(kind)
              ? undefined
              : (characterFanVoice ??
                slurpFanVoiceForPrompt(slurpResolveFanType(settings.fanTypes, member ?? {}).voice)),
            speakerMemory:
              creatorSpeaks(kind) || !(member || characterFanVoice) ? undefined : slurpFanMemoryForPrompt(tie),
            placeholder,
            post: post ? { title: post.title, content: post.content } : null,
            // Only the Creator speaks in a delivery note. A concealed Creator's card stays out of this
            // prompt, which has no identity protection of its own.
            flavourBrief:
              creatorSpeaks(kind) && (creator.settings.privacy.identityDisclosure ?? "open") === "open"
                ? await resolveSlurpCreatorFlavour(db, {
                    account: creator,
                    source: await noodle.resolveAccountSource(creator),
                    disclosureMode: "open",
                    use: "delivery",
                    sequence: slurpRotationHash(String(row.subjectId)),
                  })
                : undefined,
            promptBlocks: slurpPromptContext(settings).blocks,
          }),
          {
            model: connection.model,
            ...slpSamplingOptions(
              resolveStoredChatOptions(connection.defaultParameters, connection.provider, connection.model),
              { temperature: 0.95, topP: 0.95 },
            ),
            maxTokens: clampGenerationMaxOutputTokens({
              provider: connection.provider as APIProvider,
              model: connection.model,
              // Reasoning headroom: 320 was spent on thinking and the answer came back empty.
              maxTokens: 2048,
              maxTokensOverride: connection.maxTokensOverride,
            }),
            stream: false,
          },
        );
        const parsed = parseGameJsonish(requireModelAnswer(response.content ?? "", "a rewritten fan message"));
        const unwrapped = Array.isArray(parsed) && parsed.length === 1 ? parsed[0] : parsed;
        const content = String((unwrapped as { content?: unknown })?.content ?? "")
          .trim()
          .slice(0, MAX_LENGTH[kind]);
        // An empty or unusable rewrite leaves the placeholder alone. It was always meant to stand on
        // its own, so a failed upgrade costs nothing.
        if (content) {
          await writePlaceholder(db, messages, kind, String(row.subjectId), content);
          rewritten += 1;
        }
        await db.delete(slurpPendingText).where(eq(slurpPendingText.id, id));
      } catch (error) {
        logger.warn(error, "[slurp-pending] Could not rewrite %s", id);
        await db
          .update(slurpPendingText)
          .set({ status: attempts >= JOB_MAX_ATTEMPTS ? "failed" : "pending", claimedAt: null })
          .where(eq(slurpPendingText.id, id))
          .catch(() => undefined);
      }
    }
  } finally {
    for (const id of claimedHere) inFlightPendingText.delete(id);
  }
  return rewritten;
}

async function readPlaceholder(db: DB, kind: SlurpPendingKind, subjectId: string): Promise<string | null> {
  const messages = createSlurpMessagesStorage(db);
  if (kind === "commission") return (await messages.getCommission(subjectId))?.brief ?? null;
  if (kind === "question") {
    const interaction = await createSlurpStorage(db).getNoodlerInteractionById(subjectId);
    return interaction?.content ?? null;
  }
  // Openers and delivery notes are both plain message rows.
  return (await messages.getMessageById(subjectId))?.content ?? null;
}

async function writePlaceholder(
  db: DB,
  messages: ReturnType<typeof createSlurpMessagesStorage>,
  kind: SlurpPendingKind,
  subjectId: string,
  content: string,
): Promise<void> {
  if (kind === "commission") {
    await messages.rewriteCommissionBrief(subjectId, content);
    return;
  }
  if (kind === "question") {
    await createSlurpStorage(db).rewriteNoodlerInteractionContent(subjectId, content);
    return;
  }
  await messages.rewriteMessageContent(subjectId, content);
}
