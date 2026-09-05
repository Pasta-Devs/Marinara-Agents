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
import type { DB } from "../../db/connection.js";
import { desc, eq } from "../../db/file-query.js";
import { logger } from "../../lib/logger.js";
import { slurpPendingText } from "../../db/schema/slurp.js";
import { newId, now } from "../../utils/id-generator.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createSlurpStorage } from "../storage/slurp.storage.js";
import { createSlurpMessagesStorage } from "../storage/slurp-messages.storage.js";
import { createSlurpPopulationStorage } from "../storage/slurp-population.storage.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { resolveBaseUrl } from "../generation/connection-base-url.js";
import { resolveStoredChatOptions } from "../generation/generation-parameters.js";
import { clampGenerationMaxOutputTokens } from "../generation/output-token-limits.js";
import { parseGameJsonish } from "../game/jsonish.js";
import { requireModelAnswer } from "./slurp-model-answer.js";
import { noodleSamplingOptions } from "./slurp-sampling-options.js";
import { resolveSlurpTextConnection } from "./slurp-connection.js";
import { NOODLER_UNTRUSTED_CONTENT_INSTRUCTION } from "./slurp-generation.service.js";
import type { APIProvider } from "@marinara-engine/shared";

export type SlurpPendingKind = "commission" | "question" | "opener";

/** Rewritten per drain. Small: a long absence must not stall the first read behind a queue. */
const DRAIN_LIMIT = 2;

/** Longest a rewrite may be. These are one-liners; a paragraph would not fit where they render. */
const MAX_LENGTH: Record<SlurpPendingKind, number> = { commission: 400, question: 180, opener: 240 };

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
      createdAt: now(),
    });
  } catch (error) {
    // A placeholder that never gets rewritten is still a usable placeholder. Never let the queue
    // break the action that produced the text.
    logger.warn(error, "[slurp-pending] Could not enqueue a %s rewrite", input.kind);
  }
}

function buildMessages(input: {
  kind: SlurpPendingKind;
  creator: { displayName: string; handle: string; bio: string };
  speaker: string;
  placeholder: string;
  post?: { title: string | null; content: string | null } | null;
}) {
  const shared = [
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
        : "Rewrite this first message so it sounds like this particular person writing to this particular creator for the first time. Keep it short and a little awkward. Do not ask for anything.";

  const data = {
    creator: input.creator,
    fan: input.speaker,
    ...(input.post ? { post: input.post } : {}),
    placeholderToReplace: input.placeholder,
  };
  return [
    { role: "system" as const, content: [...shared, instruction].join("\n") },
    { role: "user" as const, content: `# Untrusted Slurp data\n${JSON.stringify(data, null, 2)}` },
  ];
}

/**
 * Rewrite the newest few placeholders.
 *
 * Called from a read, so the player is present and the spend is against text they are about to
 * see. Returns how many were rewritten.
 */
export async function drainSlurpPendingText(db: DB, limit = DRAIN_LIMIT): Promise<number> {
  const rows = await db.select().from(slurpPendingText).orderBy(desc(slurpPendingText.createdAt)).limit(limit);
  if (rows.length === 0) return 0;

  const noodle = createSlurpStorage(db);
  const settings = await noodle.getSettings();
  const connection = await resolveSlurpTextConnection(createConnectionsStorage(db), settings.generationConnectionId);
  // No connection is not a failure. The placeholders stay, and stay usable.
  if (!connection) return 0;

  const provider = createLLMProvider(
    connection.provider,
    resolveBaseUrl(connection),
    connection.apiKey,
    connection.maxContext,
    connection.openrouterProvider,
    connection.maxTokensOverride,
    connection.claudeFastMode === "true",
    connection.treatAsLocalEndpoint === "true",
    connection.defaultParameters,
  );
  const messages = createSlurpMessagesStorage(db);
  const population = createSlurpPopulationStorage(db);
  let rewritten = 0;

  for (const row of rows) {
    const id = String(row.id);
    try {
      const kind = String(row.kind) as SlurpPendingKind;
      const creator = await noodle.getNoodlerAccountById(String(row.creatorAccountId));
      if (!creator) {
        await db.delete(slurpPendingText).where(eq(slurpPendingText.id, id));
        continue;
      }
      const placeholder = await readPlaceholder(db, kind, String(row.subjectId));
      if (!placeholder) {
        await db.delete(slurpPendingText).where(eq(slurpPendingText.id, id));
        continue;
      }
      const actorId = row.actorLabel ? String(row.actorLabel) : null;
      const speaker =
        (actorId ? (await population.get(actorId))?.displayName : null) ??
        (actorId ? (await noodle.getNoodlerAccountById(actorId))?.displayName : null) ??
        "a reader";
      const post = row.postId ? await noodle.getNoodlerPostById(String(row.postId)) : null;

      const response = await provider.chatComplete(
        buildMessages({
          kind,
          creator: { displayName: creator.displayName, handle: creator.handle, bio: creator.bio },
          speaker,
          placeholder,
          post: post ? { title: post.title, content: post.content } : null,
        }),
        {
          model: connection.model,
          ...noodleSamplingOptions(
            resolveStoredChatOptions(connection.defaultParameters, connection.provider, connection.model),
            { temperature: 0.95, topP: 0.95 },
          ),
          maxTokens: clampGenerationMaxOutputTokens({
            provider: connection.provider as APIProvider,
            model: connection.model,
            maxTokens: 320,
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
      // Drop the row rather than retrying forever: a rewrite that keeps failing would block the
      // queue behind it on every single read.
      logger.warn(error, "[slurp-pending] Could not rewrite %s", id);
      await db
        .delete(slurpPendingText)
        .where(eq(slurpPendingText.id, id))
        .catch(() => undefined);
    }
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
