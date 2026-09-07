import type { DB } from "../../db/connection.js";
import { and, asc, eq, lte } from "../../db/file-query.js";
import { noodlerFirstPostJobs } from "../../db/schema/slurp.js";
import { logger } from "../../lib/logger.js";
import { newId, now } from "../../utils/id-generator.js";
import { generateAndApplyNoodlerPost } from "./slurp-post.operation.js";

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [15_000, 60_000, 300_000] as const;
const POLL_MS = 2_000;
const queues = new WeakMap<object, ReturnType<typeof createSlurpFirstPostQueue>>();

type FirstPostJob = typeof noodlerFirstPostJobs.$inferSelect;

function attempts(value: unknown): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function mapJob(row: FirstPostJob) {
  return {
    id: row.id,
    executionId: row.executionId,
    accountId: row.creatorAccountId,
    status: row.status as "queued" | "running" | "generated" | "failed",
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
        .from(noodlerFirstPostJobs)
        .where(
          and(
            eq(noodlerFirstPostJobs.executionId, executionId),
            eq(noodlerFirstPostJobs.creatorAccountId, creatorAccountId),
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
      await db.insert(noodlerFirstPostJobs).values(row);
      jobs.push(row);
    }
    return jobs.map(mapJob);
  };

  const status = async (executionId: string) => {
    const rows = await db.select().from(noodlerFirstPostJobs).where(eq(noodlerFirstPostJobs.executionId, executionId));
    const jobs = rows.map(mapJob);
    return {
      jobs,
      complete: jobs.length > 0 && jobs.every((job) => job.status === "generated" || job.status === "failed"),
    };
  };

  const processOne = async () => {
    const rows = await db
      .select()
      .from(noodlerFirstPostJobs)
      .where(and(eq(noodlerFirstPostJobs.status, "queued"), lte(noodlerFirstPostJobs.nextAttemptAt, now())))
      .orderBy(asc(noodlerFirstPostJobs.createdAt))
      .limit(1);
    const job = rows[0];
    if (!job) return false;
    const attempt = attempts(job.attempts) + 1;
    await db
      .update(noodlerFirstPostJobs)
      .set({ status: "running", attempts: String(attempt), updatedAt: now() })
      .where(eq(noodlerFirstPostJobs.id, job.id));
    try {
      const result = await generateAndApplyNoodlerPost(db, {
        mode: "noodler",
        targetAccountId: job.creatorAccountId,
        format: "caption",
        access: "locked",
        executionId: job.executionId,
      });
      if (result.status === "generated") {
        await db
          .update(noodlerFirstPostJobs)
          .set({ status: "generated", postId: result.post.id, updatedAt: now() })
          .where(eq(noodlerFirstPostJobs.id, job.id));
      } else {
        await db
          .update(noodlerFirstPostJobs)
          .set({ status: "failed", error: result.status, updatedAt: now() })
          .where(eq(noodlerFirstPostJobs.id, job.id));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retry = attempt < MAX_ATTEMPTS;
      await db
        .update(noodlerFirstPostJobs)
        .set({
          status: retry ? "queued" : "failed",
          nextAttemptAt: new Date(
            Date.now() + RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)]!,
          ).toISOString(),
          error: message.slice(0, 500),
          updatedAt: now(),
        })
        .where(eq(noodlerFirstPostJobs.id, job.id));
      logger.warn(error, "[noodler] First-post job %s failed%s", job.id, retry ? "; retry queued" : "");
    }
    return true;
  };

  const poll = async () => {
    if (!active) return;
    try {
      await processOne();
    } catch (error) {
      logger.error(error, "[noodler] First-post queue poll failed");
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
      void poll();
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
