import type { DB } from "../../../db/connection.js";
import { and, eq } from "../../../db/file-query.js";
import { slurpContinuityEvents } from "../../../db/schema/slurp.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { recordSlurpContinuityEvent, recordSlurpContinuityLink } from "../../data/continuity/slp-continuity-storage.js";
import { planSlurpOpportunity } from "../../data/feed/slp-opportunity-storage.js";
import { bumpSlurpDemandTrend } from "../../data/feed/slp-demand-storage.js";
import { slurpContinuityIdentityOf } from "../../modules/continuity/slp-continuity-rules.js";
import { slurpRequestActionEffect, type SlurpRequestAction } from "../../modules/messages/slp-request-actions.js";

export type SlurpThreadRequest = {
  id: string;
  text: string;
  occurredAt: string;
  action: SlurpRequestAction | null;
};

/** The requests in one thread, each with the action already taken on it. Newest first. */
export async function listSlurpThreadRequests(db: DB, threadId: string): Promise<SlurpThreadRequest[]> {
  const rows = await db.select().from(slurpContinuityEvents).where(eq(slurpContinuityEvents.threadId, threadId));
  const actions = new Map<string, SlurpRequestAction>();
  for (const row of rows) {
    if (row.eventType !== "request_action") continue;
    const payload = JSON.parse(String(row.payload ?? "{}")) as { requestId?: string; action?: SlurpRequestAction };
    if (payload.requestId && payload.action) actions.set(payload.requestId, payload.action);
  }
  return rows
    .filter((row) => row.eventType === "request_received" && row.status !== "retracted")
    .map((row) => ({
      id: String(row.id),
      text: String((JSON.parse(String(row.payload ?? "{}")) as { text?: string }).text ?? ""),
      occurredAt: String(row.occurredAt),
      action: actions.get(String(row.id)) ?? null,
    }))
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
}

/**
 * Apply one action to one request. Each request takes one action: the answer is recorded once,
 * so a double click cannot promise the same content twice.
 */
export async function applySlurpRequestAction(
  db: DB,
  input: {
    threadId: string;
    creatorAccountId: string;
    requestId: string;
    action: SlurpRequestAction;
    topic?: string;
    dueInHours?: number;
  },
  at = new Date(),
): Promise<"applied" | "not_found" | "already_answered" | "topic_required"> {
  const [request] = await db
    .select()
    .from(slurpContinuityEvents)
    .where(and(eq(slurpContinuityEvents.id, input.requestId), eq(slurpContinuityEvents.threadId, input.threadId)));
  if (!request || request.eventType !== "request_received" || request.creatorAccountId !== input.creatorAccountId) {
    return "not_found";
  }
  const answered = (await listSlurpThreadRequests(db, input.threadId)).find((entry) => entry.id === input.requestId);
  if (answered?.action) return "already_answered";
  if (input.action === "aggregate" && !input.topic?.trim()) return "topic_required";
  const creator = await createSlurpStorage(db).getNoodlerAccountById(input.creatorAccountId);
  const identity = creator ? slurpContinuityIdentityOf(creator) : null;
  if (!identity) return "not_found";

  const effect = slurpRequestActionEffect(input.action, { dueInHours: input.dueInHours });
  const thread = {
    ...identity,
    source: "slurp_message" as const,
    realityScope: "slurp" as const,
    threadId: input.threadId,
  };
  const promise = effect.promise
    ? await planSlurpOpportunity(db, {
        creatorAccountId: input.creatorAccountId,
        sequence: 0,
        workflow: "planned",
        intent: effect.promise.intent,
        sourceEventId: input.requestId,
        at,
        dueAt: new Date(at.getTime() + effect.promise.dueInHours * 60 * 60_000),
      })
    : null;
  if (effect.promiseEvent && promise) {
    await recordSlurpContinuityEvent(
      db,
      {
        ...thread,
        eventType: "promise_made",
        audienceScope: "thread_private",
        payload: { requestId: input.requestId, action: input.action, dueAt: promise.dueAt },
        relatedIds: [input.requestId, promise.id],
        fingerprint: `promise:${input.requestId}`,
        contribution: "manual",
        occurredAt: at,
      },
      at,
    );
  }
  if (effect.boundary) {
    await recordSlurpContinuityEvent(
      db,
      {
        ...thread,
        eventType: "boundary_stated",
        audienceScope: "thread_private",
        payload: { requestId: input.requestId },
        relatedIds: [input.requestId],
        fingerprint: `decline:${input.requestId}`,
        contribution: "manual",
        occurredAt: at,
      },
      at,
    );
  }
  // The count goes up under a topic the Creator typed. The request text and the fan never do.
  if (effect.aggregate && input.topic) await bumpSlurpDemandTrend(db, input.creatorAccountId, input.topic, at);
  const actionEvent = await recordSlurpContinuityEvent(
    db,
    {
      ...thread,
      eventType: "request_action",
      audienceScope: "thread_private",
      payload: { requestId: input.requestId, action: input.action, ...(promise ? { opportunityId: promise.id } : {}) },
      relatedIds: [input.requestId, ...(promise ? [promise.id] : [])],
      fingerprint: `request-action:${input.requestId}`,
      contribution: "manual",
      occurredAt: at,
    },
    at,
  );
  await recordSlurpContinuityLink(db, {
    creatorAccountId: input.creatorAccountId,
    fromType: "request",
    fromId: input.requestId,
    toType: promise ? "opportunity" : "outcome",
    toId: promise?.id ?? actionEvent.id,
    relation: input.action,
  });
  return "applied";
}
