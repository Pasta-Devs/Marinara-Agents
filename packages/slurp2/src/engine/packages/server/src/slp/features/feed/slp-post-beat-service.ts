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
import { normalizeSlurpCanonAnchors, slurpCanonAnchorsPrompt } from "../../modules/feed/slp-post-brief.js";

type SlurpBeatConnection = Parameters<typeof createSlurpPostProvider>[0]["connection"] & { model: string };

/** What the beats planner needs from the post run. Absent in classic mode. */
export type SlurpBeatContext = {
  canonText: string;
  connection: SlurpBeatConnection;
  fallbackConnection: Parameters<typeof createSlurpPostProvider>[0]["fallbackConnection"];
};

const ANCHORS_KEY = "slurp2.canon-anchors";
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

/** One extraction call. Never awaited by a post. */
async function extractAnchors(db: DB, accountId: string, key: string, context: SlurpBeatContext): Promise<void> {
  const { connection } = context;
  // Not a slot of its own: it runs beside the post that noticed the card changed.
  const provider = createSlurpPostProvider({
    connection,
    fallbackConnection: context.fallbackConnection,
    admissionMode: { kind: "none" },
  });
  const prompt = slurpCanonAnchorsPrompt(context.canonText);
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
        { temperature: 0.2, topP: 0.9 },
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
  const anchors = normalizeSlurpCanonAnchors(
    parseGameJsonish(requireModelAnswer(response.content ?? "", "canon anchors")),
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
  const key = createHash("sha256").update(context.canonText).digest("hex");
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
  },
): Promise<SlurpBeat | null> {
  try {
    const anchors = await slurpBeatAnchorsFor(db, input.accountId, input.context, input.at);
    if (!anchors) return null;
    const history = await readSlurpBeatHistory(db, input.accountId, input.at);
    return selectSlurpBeat(input.accountId, input.sequence, anchors, history, input.intents);
  } catch (error) {
    logger.warn(error, "[slurp] Beat planning failed; this post uses the classic planner");
    return null;
  }
}
