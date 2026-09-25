import { createHash } from "node:crypto";
import type { APIProvider } from "@marinara-engine/shared";
import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import { parseGameJsonish } from "../../../services/game/jsonish.js";
import { resolveStoredChatOptions } from "../../../services/generation/generation-parameters.js";
import { clampGenerationMaxOutputTokens } from "../../../services/generation/output-token-limits.js";
import { createAppSettingsStorage } from "../../../services/storage/app-settings.storage.js";
import { completeSlurpWithHost, createSlurpPostProvider } from "../../base/host/slp-generation-integrations.js";
import { requireModelAnswer } from "../../base/model/slp-model-answer.js";
import { slpSamplingOptions } from "../../base/prompting/slp-sampling-options.js";
import { readSlurpBeatHistory } from "../../data/feed/slp-opportunity-storage.js";
import type { SlurpContentIntent } from "../../../../../shared/src/slp/slp-content-axes.js";
import { selectSlurpBeat, type SlurpBeat, type SlurpCanonAnchors } from "../../modules/feed/slp-post-beat.js";
import { slurpUsableSharedIdeas, type SlurpSharedIdea } from "../../modules/feed/slp-shared-preseed.js";
import {
  normalizeSlurpCanonAnchors,
  slurpBeatFactFromPost,
  slurpCanonAnchorsPrompt,
} from "../../modules/feed/slp-post-brief.js";
import { createSlurpContinuityFact, hasSlurpContinuityFact } from "../../data/continuity/slp-continuity-storage.js";
import { slurpContinuityIdentityOf } from "../../modules/continuity/slp-continuity-rules.js";
import {
  resolveSlurpCreatorScheduleBlocks,
  slurpTimelineMoment,
} from "../../modules/creators/slp-creator-schedule-context.js";
import type { SlpCreatorManagedPost } from "../../../../../shared/src/slp/slp-social.types.js";

type SlurpBeatConnection = Parameters<typeof createSlurpPostProvider>[0]["connection"] & { model: string };

/** What the beats planner needs from the post run. Absent in classic mode. */
export type SlurpBeatContext = {
  canonText: string;
  connection: SlurpBeatConnection;
  fallbackConnection: Parameters<typeof createSlurpPostProvider>[0]["fallbackConnection"];
  /** Level 1, when the shared-ideas setting is on: the Creator's tags and the Slurp-wide event toggle. */
  shared?: { tags: readonly string[]; worldEvents: boolean } | null;
  /** This post continues an active arc: its chapter is the beat. See `slurpArcBeat`. */
  arc?: SlurpBeat | null;
};

const ANCHORS_KEY = "slurp2.canon-anchors";
// Bumped when the extraction asks for more (v2 added the routine), so every cache refreshes once.
const ANCHORS_VERSION = "v2";
const anchorKey = (canonText: string) => createHash("sha256").update(`${ANCHORS_VERSION}:${canonText}`).digest("hex");
const FAILED_WAIT_MS = 30 * 60_000;

/** Keyed by a hash of the card text the post prompt sees, so a card edit re-extracts. */
type AnchorCache = Record<string, { key: string; anchors: SlurpCanonAnchors | null }>;

// ponytail: one JSON blob in app settings, rewritten per extraction, and in-memory in-flight and
// failure maps that reset on restart. A table per Creator if installs grow past a few hundred.
const inFlight = new Set<string>();
const failedUntil = new Map<string, number>();
let writeQueue: Promise<unknown> = Promise.resolve();

async function readAnchorCache(db: DB): Promise<AnchorCache> {
  try {
    const raw = await createAppSettingsStorage(db).get(ANCHORS_KEY);
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as AnchorCache) : {};
  } catch {
    return {};
  }
}

function writeAnchors(db: DB, accountId: string, entry: AnchorCache[string]): Promise<unknown> {
  writeQueue = writeQueue
    .then(async () => {
      const cache = await readAnchorCache(db);
      cache[accountId] = entry;
      await createAppSettingsStorage(db).set(ANCHORS_KEY, JSON.stringify(cache));
    })
    .catch((error: unknown) => logger.warn(error, "[slurp] Could not store canon anchors"));
  return writeQueue;
}

/**
 * One small JSON call for the beats planner (anchors, world tick, niche patterns). Not a slot of its
 * own: it runs beside the post that noticed the cache was stale, and nothing waits on it.
 */
export async function completeSlurpBeatJson(
  context: Pick<SlurpBeatContext, "connection" | "fallbackConnection">,
  prompt: { system: string; user: string },
  label: string,
  /** Extractions stay close to the card; idea generation needs more range. */
  temperature = 0.2,
): Promise<unknown> {
  const { connection } = context;
  const provider = createSlurpPostProvider({
    connection,
    fallbackConnection: context.fallbackConnection,
    admissionMode: { kind: "none" },
  });
  const response = await completeSlurpWithHost(
    provider,
    [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
    {
      model: connection.model,
      ...slpSamplingOptions(
        resolveStoredChatOptions(connection.defaultParameters, connection.provider, connection.model),
        { temperature, topP: 0.9 },
      ),
      maxTokens: clampGenerationMaxOutputTokens({
        provider: connection.provider as APIProvider,
        model: connection.model,
        // Reasoning headroom, as the continuity extraction uses.
        maxTokens: 2048,
        maxTokensOverride: connection.maxTokensOverride,
      }),
      stream: false,
    },
  );
  return parseGameJsonish(requireModelAnswer(response.content ?? "", label));
}

/** One extraction call. Never awaited by a post. */
async function extractAnchors(db: DB, accountId: string, key: string, context: SlurpBeatContext): Promise<void> {
  const anchors = normalizeSlurpCanonAnchors(
    await completeSlurpBeatJson(context, slurpCanonAnchorsPrompt(context.canonText), "canon anchors"),
  );
  // A card with nothing concrete is stored too, so it is not re-read before every post.
  await writeAnchors(db, accountId, { key, anchors });
}

/**
 * This Creator's canon anchors, or null. A missing or stale entry starts one background extraction
 * and returns null, so this post is planned the classic way and never waits on it.
 */
export async function slurpBeatAnchorsFor(
  db: DB,
  accountId: string,
  context: SlurpBeatContext,
  at: Date,
): Promise<SlurpCanonAnchors | null> {
  if (!context.canonText.trim()) return null;
  const key = anchorKey(context.canonText);
  const cached = (await readAnchorCache(db))[accountId];
  if (cached?.key === key) return cached.anchors;
  if (!inFlight.has(accountId) && (failedUntil.get(accountId) ?? 0) <= at.getTime()) {
    inFlight.add(accountId);
    void extractAnchors(db, accountId, key, context)
      .then(() => failedUntil.delete(accountId))
      .catch((error: unknown) => {
        failedUntil.set(accountId, at.getTime() + FAILED_WAIT_MS);
        logger.warn(error, "[slurp] Canon anchor extraction failed; posts stay on the classic planner for now");
      })
      .finally(() => inFlight.delete(accountId));
  }
  return null;
}

/**
 * The beat for an ordinary slot, or null (classic planning). Any failure here is a warning and a
 * classic post, never a failed one.
 */
export async function planSlurpBeat(
  db: DB,
  input: {
    accountId: string;
    sequence: number;
    context: SlurpBeatContext;
    intents: readonly SlurpContentIntent[];
    at: Date;
    /** Level 1 ideas before the daily cap. See `slurpSharedIdeasFor`. */
    shared?: { world: SlurpSharedIdea[]; niche: Record<string, SlurpSharedIdea[]>; topics: string[] } | null;
  },
): Promise<SlurpBeat | null> {
  try {
    const anchors = await slurpBeatAnchorsFor(db, input.accountId, input.context, input.at);
    if (!anchors) return null;
    const history = await readSlurpBeatHistory(db, input.accountId, input.at);
    const shared = input.shared
      ? slurpUsableSharedIdeas({ ...input.shared, usedToday: history.sharedToday ?? {} })
      : [];
    return selectSlurpBeat(input.accountId, input.sequence, anchors, history, input.intents, shared);
  } catch (error) {
    logger.warn(error, "[slurp] Beat planning failed; this post uses the classic planner");
    return null;
  }
}

/**
 * Write a fact for each recent published beat post that has none yet. Run before planning, so the
 * next post knows what the last ones were about without quoting them. Published posts are the only
 * rows in the post table, so this can never record a post that did not go out. Best effort.
 */
export async function recordSlurpBeatFacts(
  db: DB,
  account: Parameters<typeof slurpContinuityIdentityOf>[0],
  posts: readonly SlpCreatorManagedPost[],
  at: Date,
): Promise<void> {
  const identity = slurpContinuityIdentityOf(account);
  if (!identity) return;
  try {
    for (const post of posts) {
      const fact = slurpBeatFactFromPost(post);
      if (!fact || fact.expiresAt.getTime() <= at.getTime()) continue;
      if (await hasSlurpContinuityFact(db, account.id, { factType: "circumstance", text: fact.text })) continue;
      await createSlurpContinuityFact(
        db,
        {
          ...identity,
          factType: "circumstance",
          subject: fact.subject,
          text: fact.text,
          audienceScope: fact.audienceScope,
          realityScope: "slurp",
          source: "slurp_post",
          sourceHash: fact.key,
          contribution: "system",
          expiresAt: fact.expiresAt,
        },
        at,
      );
    }
  } catch (error) {
    logger.warn(error, "[slurp] Could not record facts from published beat posts");
  }
}

/**
 * Where the Creator's day stands when the post goes out: from their Conversation Schedule, or from
 * the routine the anchor extraction read out of the card. Null when neither exists; the brief then
 * says nothing about the day rather than inventing one.
 */
export async function resolveSlurpBeatDay(
  db: DB,
  input: {
    accountId: string;
    canonText: string;
    source: Parameters<typeof resolveSlurpCreatorScheduleBlocks>[1] | null;
    characters: Parameters<typeof resolveSlurpCreatorScheduleBlocks>[0];
    at: Date;
  },
): Promise<{ current: string; previous: string | null } | null> {
  try {
    const scheduled = input.source
      ? await resolveSlurpCreatorScheduleBlocks(input.characters, input.source, input.at)
      : null;
    if (scheduled) return slurpTimelineMoment(scheduled.blocks, scheduled.localNow);
    const cached = (await readAnchorCache(db))[input.accountId];
    const routine = cached?.key === anchorKey(input.canonText) ? cached.anchors?.routine : undefined;
    return routine?.length ? slurpTimelineMoment(routine, input.at) : null;
  } catch (error) {
    logger.warn(error, "[slurp] Could not place the post in the Creator's day");
    return null;
  }
}
