import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import { createAppSettingsStorage } from "../../../services/storage/app-settings.storage.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import type { SlurpPlatformEvent } from "../../../../../shared/src/slp/slp-platform-events.js";
import {
  normalizeSlurpSharedIdeas,
  normalizeSlurpSharedWorldEvent,
  SLURP_NICHE_REFRESH_MS,
  slurpNichePatternsPrompt,
  slurpTopicalTags,
  slurpWorldTickPrompt,
  type SlurpSharedIdea,
  type SlurpSharedWorldEvent,
} from "../../modules/feed/slp-shared-preseed.js";
import { completeSlurpBeatJson, type SlurpBeatContext } from "./slp-post-beat-service.js";

const SHARED_KEY = "slurp2.shared-preseed";
const FAILED_WAIT_MS = 30 * 60_000;
const EVENT_PACK_ID = "slurp-shared-preseed";
const DAY_MS = 24 * 60 * 60 * 1000;

type SharedCache = {
  world?: { date: string; ideas: SlurpSharedIdea[] };
  niche: Record<string, { at: string; ideas: SlurpSharedIdea[] }>;
};

// ponytail: one JSON blob in app settings and in-memory in-flight/failure maps, like the anchor
// cache. A table if tags per install grow past a few dozen.
const inFlight = new Set<string>();
const failedUntil = new Map<string, number>();
let writeQueue: Promise<unknown> = Promise.resolve();

async function readShared(db: DB): Promise<SharedCache> {
  try {
    const raw = await createAppSettingsStorage(db).get(SHARED_KEY);
    const parsed = (typeof raw === "string" ? JSON.parse(raw) : raw) as Partial<SharedCache> | null;
    return { world: parsed?.world, niche: parsed?.niche ?? {} };
  } catch {
    return { niche: {} };
  }
}

function writeShared(db: DB, change: (cache: SharedCache) => void): Promise<unknown> {
  writeQueue = writeQueue
    .then(async () => {
      const cache = await readShared(db);
      change(cache);
      await createAppSettingsStorage(db).set(SHARED_KEY, JSON.stringify(cache));
    })
    .catch((error: unknown) => logger.warn(error, "[slurp] Could not store shared ideas"));
  return writeQueue;
}

/** Start one background refresh under `key`, at most once at a time and not right after a failure. */
function refresh(key: string, at: Date, run: () => Promise<void>): void {
  if (inFlight.has(key) || (failedUntil.get(key) ?? 0) > at.getTime()) return;
  inFlight.add(key);
  void run()
    .then(() => failedUntil.delete(key))
    .catch((error: unknown) => {
      failedUntil.set(key, at.getTime() + FAILED_WAIT_MS);
      logger.warn(error, "[slurp] Shared idea refresh failed (%s); beats use the Creator's own decks", key);
    })
    .finally(() => inFlight.delete(key));
}

/**
 * Start a Slurp-wide platform event from the world tick. Only one generated event runs at a time,
 * and ended ones are removed, so the list never fills up with them.
 */
async function startSlurpWideEvent(db: DB, event: SlurpSharedWorldEvent, at: Date): Promise<void> {
  const storage = createSlurpStorage(db);
  const events = (await storage.getSettings()).platformEvents;
  const generated = (item: SlurpPlatformEvent) => item.provenance?.packId === EVENT_PACK_ID;
  const running = (item: SlurpPlatformEvent) =>
    item.activation.kind === "window" && Date.parse(item.activation.endsAt) > at.getTime();
  if (events.some((item) => generated(item) && running(item))) return;
  const id = `shared-${at.toISOString().slice(0, 10)}`;
  const next: SlurpPlatformEvent = {
    id,
    contentId: id,
    name: event.name,
    enabled: true,
    guidance: event.guidance,
    storyTags: [],
    activation: {
      kind: "window",
      startsAt: at.toISOString(),
      endsAt: new Date(at.getTime() + event.days * DAY_MS).toISOString(),
    },
    target: { kind: "all" },
    influences: [],
    arcOpportunities: [],
    outcomes: [],
    automation: "inherit",
    builtin: false,
    hidden: false,
    provenance: { packId: EVENT_PACK_ID, contentId: id, packVersion: "1.0.0", contentHash: "0".repeat(64) },
  };
  await storage.updateSettings({
    platformEvents: [...events.filter((item) => !generated(item) || running(item)), next],
  });
}

/**
 * The shared ideas this Creator could draw from, before the daily cap. A stale world tick or niche
 * pattern starts a background refresh and this post uses what is already cached, never waiting.
 */
export async function slurpSharedIdeasFor(
  db: DB,
  input: { tags: readonly string[]; context: SlurpBeatContext; at: Date; worldEvents: boolean },
): Promise<{ world: SlurpSharedIdea[]; niche: Record<string, SlurpSharedIdea[]>; topics: string[] }> {
  try {
    const [cache, settings] = await Promise.all([readShared(db), createSlurpStorage(db).getSettings()]);
    const topics = slurpTopicalTags(input.tags, settings.discoveryTags);
    const date = input.at.toISOString().slice(0, 10);
    if (cache.world?.date !== date) {
      refresh("world", input.at, async () => {
        const answer = await completeSlurpBeatJson(
          input.context,
          slurpWorldTickPrompt({ date, withEvent: input.worldEvents }),
          "world tick",
          0.9,
        );
        await writeShared(db, (next) => {
          next.world = { date, ideas: normalizeSlurpSharedIdeas(answer, "world", `world:${date}`) };
        });
        const event = input.worldEvents ? normalizeSlurpSharedWorldEvent(answer) : null;
        if (event) await startSlurpWideEvent(db, event, input.at);
      });
    }
    for (const topic of topics) {
      const cached = cache.niche[topic];
      if (cached && input.at.getTime() - Date.parse(cached.at) < SLURP_NICHE_REFRESH_MS) continue;
      refresh(`niche:${topic}`, input.at, async () => {
        const answer = await completeSlurpBeatJson(
          input.context,
          slurpNichePatternsPrompt(topic),
          "niche patterns",
          0.9,
        );
        await writeShared(db, (next) => {
          next.niche[topic] = {
            at: input.at.toISOString(),
            ideas: normalizeSlurpSharedIdeas(answer, "niche", `niche:${topic}:${date}`),
          };
        });
      });
    }
    return {
      world: cache.world?.date === date ? cache.world.ideas : [],
      niche: Object.fromEntries(Object.entries(cache.niche).map(([tag, entry]) => [tag, entry.ideas])),
      topics,
    };
  } catch (error) {
    logger.warn(error, "[slurp] Could not read shared ideas");
    return { world: [], niche: {}, topics: [] };
  }
}
