import type { DB } from "../../../db/connection.js";
import { asc, eq } from "../../../db/file-query.js";
import { slurpMessages, slurpThreads } from "../../../db/schema/slurp.js";
import { logger } from "../../../lib/logger.js";
import type { APIProvider } from "@marinara-engine/shared";
import { createAppSettingsStorage } from "../../../services/storage/app-settings.storage.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
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
  claimSlurpModelBudget,
  slurpModelWorkerAllows,
  type SlurpModelWorkerContext,
} from "../../base/model/slp-model-worker.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import {
  createSlurpContinuityFact,
  hasSlurpContinuityFact,
  proposeSlurpContinuityChange,
  recordSlurpContinuityEvent,
} from "../../data/continuity/slp-continuity-storage.js";
import {
  normalizeSlurpExtraction,
  SLURP_EXTRACTION_BATCH,
  slurpExtractionAudience,
  slurpExtractionFactType,
  slurpExtractionPrompt,
  slurpExtractionRisk,
  slurpExtractionSourceHash,
  type SlurpExtractionMessage,
} from "../../modules/continuity/slp-continuity-extraction.js";
import { slurpContinuityIdentityOf } from "../../modules/continuity/slp-continuity-rules.js";

const CHECKPOINT_KEY = "slurp2.continuity-checkpoints";
/** Threads one drain reads. The rest wait for the next open; nothing here is urgent. */
const THREADS_PER_DRAIN = 3;

type Checkpoints = Record<string, string>;

async function readCheckpoints(db: DB): Promise<Checkpoints> {
  try {
    const raw = await createAppSettingsStorage(db).get(CHECKPOINT_KEY);
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Checkpoints) : {};
  } catch {
    return {};
  }
}

/**
 * Read new messages in a few threads and turn explicit statements into continuity.
 *
 * Runs with the player present, behind the shared model budget, like every other model call that
 * is not a direct answer. A checkpoint per thread means a message is read once; a thread whose
 * batch fails keeps its checkpoint and is tried again next time. Nothing here ever writes to a
 * thread, a post, or a Creator profile — only to the ledger.
 */
export async function drainSlurpContinuityExtraction(
  db: DB,
  context: SlurpModelWorkerContext = "present",
  at = new Date(),
): Promise<number> {
  const slurp = createSlurpStorage(db);
  const settings = await slurp.getSettings();
  if (!slurpModelWorkerAllows(settings.modelBudget, context)) return 0;
  const checkpoints = await readCheckpoints(db);
  const threads = (await db.select().from(slurpThreads))
    .filter((thread) => String(thread.lastMessageAt) > (checkpoints[String(thread.id)] ?? ""))
    .sort((left, right) => String(left.lastMessageAt).localeCompare(String(right.lastMessageAt)))
    .slice(0, THREADS_PER_DRAIN);
  if (threads.length === 0) return 0;

  const connection = await resolveSlurpTextConnection(
    createConnectionsStorage(db),
    settings.modelBudget.connectionId ?? settings.generationConnectionId,
  );
  if (!connection) return 0;
  const fallbackConnection = await createConnectionsStorage(db).getFallbackForMain();
  const provider = withConnectionFallbackProvider({
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
  });

  let recorded = 0;
  for (const thread of threads) {
    const threadId = String(thread.id);
    const creator = await slurp.getNoodlerAccountById(String(thread.creatorAccountId));
    const identity = creator ? slurpContinuityIdentityOf(creator) : null;
    const since = checkpoints[threadId] ?? "";
    const fresh = (
      await db
        .select()
        .from(slurpMessages)
        .where(eq(slurpMessages.threadId, threadId))
        .orderBy(asc(slurpMessages.createdAt))
    )
      .filter(
        (message) =>
          String(message.createdAt) > since && String(message.kind) === "text" && String(message.content).trim(),
      )
      .slice(0, SLURP_EXTRACTION_BATCH);
    const batch: SlurpExtractionMessage[] = fresh.map((message) => ({
      id: String(message.id),
      role: message.role === "creator" ? "creator" : "fan",
      content: String(message.content),
    }));
    const nextCheckpoint = fresh.at(-1) ? String(fresh.at(-1)!.createdAt) : String(thread.lastMessageAt);
    if (!creator || !identity || batch.length === 0) {
      checkpoints[threadId] = nextCheckpoint;
      continue;
    }
    if (!(await claimSlurpModelBudget(db, settings.modelBudget, "continuity", at))) break;
    try {
      const prompt = slurpExtractionPrompt(creator.displayName, batch);
      const response = await provider.chatComplete(
        [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
        {
          model: connection.model,
          ...slpSamplingOptions(
            resolveStoredChatOptions(connection.defaultParameters, connection.provider, connection.model),
            { temperature: 0.2, topP: 0.9 },
          ),
          maxTokens: clampGenerationMaxOutputTokens({
            provider: connection.provider as APIProvider,
            model: connection.model,
            maxTokens: 900,
            maxTokensOverride: connection.maxTokensOverride,
          }),
          stream: false,
        },
      );
      const candidates = normalizeSlurpExtraction(
        parseGameJsonish(requireModelAnswer(response.content ?? "", "continuity candidates")),
        batch,
      );
      const sourceHash = slurpExtractionSourceHash(batch);
      for (const candidate of candidates) {
        const risk = slurpExtractionRisk(candidate);
        const audienceScope = slurpExtractionAudience(candidate.kind);
        if (candidate.kind === "request") {
          // A request is an event in its own thread. It never names the fan anywhere else; the
          // aggregate demand the planner reads is a count, not the request.
          await recordSlurpContinuityEvent(
            db,
            {
              ...identity,
              eventType: "request_received",
              source: "slurp_message",
              realityScope: "slurp",
              audienceScope: "thread_private",
              threadId,
              payload: { text: candidate.text },
              confidence: candidate.confidence,
              evidence: candidate.evidence,
              relatedIds: [candidate.messageId],
              fingerprint: `request:${candidate.messageId}:${candidate.text.toLocaleLowerCase()}`,
              contribution: "generated",
              occurredAt: at,
            },
            at,
          );
          recorded += 1;
          continue;
        }
        const fact = {
          ...identity,
          factType: slurpExtractionFactType(candidate.kind),
          text: candidate.text,
          audienceScope,
          realityScope: "slurp" as const,
          threadId: audienceScope === "thread_private" ? threadId : null,
          confidence: candidate.confidence,
          source: "slurp_message" as const,
          evidence: candidate.evidence,
          sourceHash,
          contribution: "generated" as const,
        };
        if (await hasSlurpContinuityFact(db, creator.id, fact)) continue;
        if (risk === "low") {
          await createSlurpContinuityFact(db, fact, at);
        } else {
          await proposeSlurpContinuityChange(
            db,
            {
              creatorAccountId: creator.id,
              target: "fact",
              candidate: { ...fact, status: "proposed" },
              risk,
              confidence: candidate.confidence,
              sourceHash,
              sourceMessageIds: batch.map((message) => message.id),
              extractionFingerprint: `${threadId}:${sourceHash}`,
            },
            at,
          );
        }
        recorded += 1;
      }
      checkpoints[threadId] = nextCheckpoint;
    } catch (error) {
      // The checkpoint stays put, so the same batch is read again next time.
      logger.warn(error, "[slurp-continuity] Extraction failed for one thread; it is retried later");
    }
  }
  await createAppSettingsStorage(db).set(CHECKPOINT_KEY, JSON.stringify(checkpoints));
  return recorded;
}
