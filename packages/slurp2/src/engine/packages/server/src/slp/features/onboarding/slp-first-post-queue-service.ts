import type { DB } from "../../../db/connection.js";
import { and, asc, eq, lte } from "../../../db/file-query.js";
import { slpCreatorFirstPostJobs, slpPosts } from "../../../db/schema/slurp.js";
import { logger } from "../../../lib/logger.js";
import { newId, now } from "../../../utils/id-generator.js";
import { generateAndApplyCreatorPost } from "../feed/slp-feed-contract.js";
import { slurpPausedNow } from "../../data/settings/slp-pause-storage.js";

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [15_000, 60_000, 300_000] as const;
const POLL_MS = 2_000;
const queues = new WeakMap<object, ReturnType<typeof createSlurpFirstPostQueue>>();

/** Transient outcomes: the run never reached the model, so the job is worth another pass. */
const RETRYABLE_STATUSES = new Set(["busy"]);
/**
 * How long a first post waits for its Creator. Right after a bulk add the artwork backfill and the
 * reserve poll take new Creators one by one, and a picture holds the Creator for minutes; three
 * quick "busy" attempts ran out inside that window and failed the first post of a busy Creator.
 * A busy pass never reached the model, so it does not use up an attempt.
 */
const FIRST_POST_BUSY_WAIT_MS = 20 * 60_000;
const FIRST_POST_BUSY_RETRY_MS = 15_000;

function retryAt(attempt: number): string {
  return new Date(Date.now() + RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)]!).toISOString();
}

type FirstPostJob = typeof slpCreatorFirstPostJobs.$inferSelect;

function attempts(value: unknown): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function mapJob(row: FirstPostJob) {
  return {
    id: row.id,
    executionId: row.executionId,
    accountId: row.creatorAccountId,
    status: row.status as "queued" | "running" | "generated" | "skipped" | "failed",
    attempts: attempts(row.attempts),
    postId: row.postId,
    error: row.error,
  };
}

export function createSlurpFirstPostQueue(db: DB) {
  const existingQueue = queues.get(db);
  if (existingQueue) return existingQueue;
  let active = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const enqueue = async (executionId: string, accountIds: string[]) => {
    const createdAt = now();
    const jobs = [];
    for (const creatorAccountId of [...new Set(accountIds)]) {
      const existing = await db
        .select()
        .from(slpCreatorFirstPostJobs)
        .where(
          and(
            eq(slpCreatorFirstPostJobs.executionId, executionId),
            eq(slpCreatorFirstPostJobs.creatorAccountId, creatorAccountId),
          ),
        );
      if (existing[0]) {
        jobs.push(existing[0]);
        continue;
      }
      const row = {
        id: newId(),
        executionId,
        creatorAccountId,
        status: "queued",
        attempts: "0",
        nextAttemptAt: createdAt,
        postId: null,
        error: null,
        createdAt,
        updatedAt: createdAt,
      } as const;
      await db.insert(slpCreatorFirstPostJobs).values(row);
      jobs.push(row);
    }
    return jobs.map(mapJob);
  };

  const status = async (executionId: string) => {
    const rows = await db
      .select()
      .from(slpCreatorFirstPostJobs)
      .where(eq(slpCreatorFirstPostJobs.executionId, executionId));
    const jobs = rows.map(mapJob);
    return {
      jobs,
      complete:
        jobs.length > 0 &&
        jobs.every((job) => job.status === "generated" || job.status === "skipped" || job.status === "failed"),
    };
  };

  const processOne = async () => {
    const rows = await db
      .select()
      .from(slpCreatorFirstPostJobs)
      .where(and(eq(slpCreatorFirstPostJobs.status, "queued"), lte(slpCreatorFirstPostJobs.nextAttemptAt, now())))
      .orderBy(asc(slpCreatorFirstPostJobs.createdAt))
      .limit(1);
    const job = rows[0];
    if (!job) return false;
    // The Creator already posted since this job was queued (a restart handed a finished job back, or
    // another path wrote the first post): that post is the first post. Writing another would double it.
    const already = await slpLatestPostSince(db, job.creatorAccountId, job.createdAt);
    if (already) {
      await db
        .update(slpCreatorFirstPostJobs)
        .set({ status: "generated", postId: already, error: null, updatedAt: now() })
        .where(eq(slpCreatorFirstPostJobs.id, job.id));
      return true;
    }
    const attempt = attempts(job.attempts) + 1;
    await db
      .update(slpCreatorFirstPostJobs)
      .set({ status: "running", attempts: String(attempt), updatedAt: now() })
      .where(eq(slpCreatorFirstPostJobs.id, job.id));
    try {
      const result = await generateAndApplyCreatorPost(db, {
        mode: "noodler",
        targetAccountId: job.creatorAccountId,
        format: "caption",
        access: "public",
        executionId: job.executionId,
      });
      if (result.status === "generated") {
        await db
          .update(slpCreatorFirstPostJobs)
          .set({ status: "generated", postId: result.post.id, updatedAt: now() })
          .where(eq(slpCreatorFirstPostJobs.id, job.id));
      } else if (
        RETRYABLE_STATUSES.has(result.status) &&
        Date.now() - Date.parse(job.createdAt) < FIRST_POST_BUSY_WAIT_MS
      ) {
        // "busy" only means another operation held this account's lock for a moment. Recording it
        // as a permanent failure threw away the creator's first post over a transient collision.
        await db
          .update(slpCreatorFirstPostJobs)
          .set({
            status: "queued",
            attempts: String(attempt - 1),
            nextAttemptAt: new Date(Date.now() + FIRST_POST_BUSY_RETRY_MS).toISOString(),
            error: result.status,
            updatedAt: now(),
          })
          .where(eq(slpCreatorFirstPostJobs.id, job.id));
      } else if (result.status === "disabled") {
        // A persona-backed Creator never auto-posts. That is the mode, not a failed job, so the
        // wizard must not report it as an error.
        await db
          .update(slpCreatorFirstPostJobs)
          .set({ status: "skipped", error: null, updatedAt: now() })
          .where(eq(slpCreatorFirstPostJobs.id, job.id));
      } else {
        await db
          .update(slpCreatorFirstPostJobs)
          .set({ status: "failed", error: result.status, updatedAt: now() })
          .where(eq(slpCreatorFirstPostJobs.id, job.id));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retry = attempt < MAX_ATTEMPTS;
      await db
        .update(slpCreatorFirstPostJobs)
        .set({
          status: retry ? "queued" : "failed",
          nextAttemptAt: retryAt(attempt),
          error: message.slice(0, 500),
          updatedAt: now(),
        })
        .where(eq(slpCreatorFirstPostJobs.id, job.id));
      logger.warn(error, "[slurp] First-post job %s failed%s", job.id, retry ? "; retry queued" : "");
    }
    return true;
  };

  const poll = async () => {
    if (!active) return;
    try {
      // "Pause all": the first posts wait until Slurp is switched back on.
      if (!(await slurpPausedNow(db))) await processOne();
    } catch (error) {
      logger.error(error, "[slurp] First-post queue poll failed");
    } finally {
      if (active) timer = setTimeout(poll, POLL_MS);
    }
  };

  const queue = {
    enqueue,
    status,
    start() {
      if (active) return;
      active = true;
      // A job is marked `running` before the model call and only leaves that state when the call
      // settles. A restart mid-call therefore stranded it forever: processOne only ever selects
      // `queued`, so the wizard polled a job that could never finish. Hand them back on startup.
      void (async () => {
        try {
          const stranded = await db
            .select()
            .from(slpCreatorFirstPostJobs)
            .where(eq(slpCreatorFirstPostJobs.status, "running"));
          for (const job of stranded) {
            await db
              .update(slpCreatorFirstPostJobs)
              .set({ status: "queued", nextAttemptAt: now(), updatedAt: now() })
              .where(eq(slpCreatorFirstPostJobs.id, job.id));
          }
          if (stranded.length > 0) {
            logger.warn("[slurp] Requeued %d first-post job(s) left running by a restart", stranded.length);
          }
        } catch (error) {
          logger.error(error, "[slurp] Failed to requeue stranded first-post jobs");
        }
        void poll();
      })();
    },
    async stop() {
      active = false;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
  queues.set(db, queue);
  return queue;
}

/** The newest top-level post the Creator published at or after `since`, or null. */
export async function slpLatestPostSince(db: DB, creatorAccountId: string, since: string): Promise<string | null> {
  const rows = await db.select().from(slpPosts).where(eq(slpPosts.authorAccountId, creatorAccountId));
  const after = rows
    .filter((row) => !row.parentPostId && String(row.createdAt) >= since)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return after[0] ? String(after[0].id) : null;
}
