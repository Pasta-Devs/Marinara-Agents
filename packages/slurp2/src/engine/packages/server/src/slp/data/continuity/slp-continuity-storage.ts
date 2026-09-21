import type { DB } from "../../../db/connection.js";
import { and, desc, eq } from "../../../db/file-query.js";
import {
  slurpContentCampaigns,
  slurpContentCampaignStages,
  slurpContentOpportunities,
  slurpContinuityEvents,
  slurpContinuityFacts,
  slurpContinuityProposals,
  slurpDemandTrends,
  slurpShootSessions,
} from "../../../db/schema/slurp.js";
import { newId } from "../../../utils/id-generator.js";
import type {
  SlurpAudienceScope,
  SlurpContinuityContribution,
  SlurpContinuityEvent,
  SlurpContinuityEventType,
  SlurpContinuityFact,
  SlurpContinuityFactType,
  SlurpContinuityIdentity,
  SlurpProposalRisk,
  SlurpContinuitySource,
  SlurpContinuityStatus,
  SlurpContinuitySurface,
  SlurpRealityScope,
} from "../../../../../shared/src/slp/slp-continuity.js";
import {
  SLURP_CONTINUITY_EVIDENCE_MAX,
  SLURP_CONTINUITY_TEXT_MAX,
  slurpContinuityCanMove,
  slurpContinuityPrunable,
  slurpContinuityReadable,
} from "../../modules/continuity/slp-continuity-rules.js";

function parseJson<T>(value: unknown, fallback: T): T {
  try {
    return typeof value === "string" ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function number(value: unknown, fallback: number): number {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : fallback;
}

function mapFact(row: Record<string, unknown>): SlurpContinuityFact {
  return {
    id: String(row.id),
    sourceKind: String(row.sourceKind),
    sourceEntityId: String(row.sourceEntityId),
    creatorAccountId: String(row.creatorAccountId),
    factType: String(row.factType) as SlurpContinuityFactType,
    subject: String(row.subject ?? ""),
    text: String(row.text ?? ""),
    audienceScope: String(row.audienceScope) as SlurpAudienceScope,
    realityScope: String(row.realityScope) as SlurpRealityScope,
    threadId: row.threadId ? String(row.threadId) : null,
    confidence: number(row.confidence, 1),
    salience: number(row.salience, 0.5),
    status: String(row.status) as SlurpContinuityStatus,
    source: String(row.source) as SlurpContinuitySource,
    evidence: String(row.evidence ?? ""),
    sourceHash: String(row.sourceHash ?? ""),
    contribution: String(row.contribution) as SlurpContinuityContribution,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
    expiresAt: row.expiresAt ? String(row.expiresAt) : null,
  };
}

function mapEvent(row: Record<string, unknown>): SlurpContinuityEvent {
  return {
    id: String(row.id),
    sourceKind: String(row.sourceKind),
    sourceEntityId: String(row.sourceEntityId),
    creatorAccountId: String(row.creatorAccountId),
    eventType: String(row.eventType) as SlurpContinuityEventType,
    source: String(row.source) as SlurpContinuitySource,
    realityScope: String(row.realityScope) as SlurpRealityScope,
    audienceScope: String(row.audienceScope) as SlurpAudienceScope,
    threadId: row.threadId ? String(row.threadId) : null,
    payload: parseJson<Record<string, unknown>>(row.payload, {}),
    status: String(row.status) as SlurpContinuityStatus,
    confidence: number(row.confidence, 1),
    evidence: String(row.evidence ?? ""),
    relatedIds: parseJson<string[]>(row.relatedIds, []).filter((value) => typeof value === "string"),
    fingerprint: String(row.fingerprint),
    contribution: String(row.contribution) as SlurpContinuityContribution,
    occurredAt: String(row.occurredAt),
    createdAt: String(row.createdAt),
    expiresAt: row.expiresAt ? String(row.expiresAt) : null,
  };
}

export type SlurpContinuityEventInput = SlurpContinuityIdentity & {
  eventType: SlurpContinuityEventType;
  source: SlurpContinuitySource;
  realityScope: SlurpRealityScope;
  audienceScope: SlurpAudienceScope;
  threadId?: string | null;
  payload?: Record<string, unknown>;
  status?: SlurpContinuityStatus;
  confidence?: number;
  evidence?: string;
  relatedIds?: string[];
  fingerprint: string;
  contribution: SlurpContinuityContribution;
  occurredAt: Date;
  expiresAt?: Date | null;
};

/**
 * Record one event. The fingerprint makes it idempotent: recording the same thing twice returns
 * the first record, so a retried run or a replayed job never duplicates history.
 */
export async function recordSlurpContinuityEvent(
  db: DB,
  input: SlurpContinuityEventInput,
  at = new Date(),
): Promise<SlurpContinuityEvent> {
  const existing = await db
    .select()
    .from(slurpContinuityEvents)
    .where(
      and(
        eq(slurpContinuityEvents.creatorAccountId, input.creatorAccountId),
        eq(slurpContinuityEvents.fingerprint, input.fingerprint),
      ),
    );
  if (existing[0]) return mapEvent(existing[0] as Record<string, unknown>);
  const row = {
    id: newId(),
    sourceKind: input.sourceKind,
    sourceEntityId: input.sourceEntityId,
    creatorAccountId: input.creatorAccountId,
    eventType: input.eventType,
    source: input.source,
    realityScope: input.realityScope,
    audienceScope: input.audienceScope,
    threadId: input.threadId ?? null,
    payload: JSON.stringify(input.payload ?? {}),
    status: input.status ?? "active",
    confidence: String(input.confidence ?? 1),
    evidence: (input.evidence ?? "").slice(0, SLURP_CONTINUITY_EVIDENCE_MAX),
    relatedIds: JSON.stringify(input.relatedIds ?? []),
    fingerprint: input.fingerprint,
    contribution: input.contribution,
    occurredAt: input.occurredAt.toISOString(),
    createdAt: at.toISOString(),
    expiresAt: input.expiresAt ? input.expiresAt.toISOString() : null,
  };
  await db.insert(slurpContinuityEvents).values(row);
  await pruneSlurpContinuity(db, input.creatorAccountId, at);
  return mapEvent(row);
}

export type SlurpContinuityFactInput = SlurpContinuityIdentity & {
  factType: SlurpContinuityFactType;
  subject?: string;
  text: string;
  audienceScope: SlurpAudienceScope;
  realityScope: SlurpRealityScope;
  threadId?: string | null;
  confidence?: number;
  salience?: number;
  status?: SlurpContinuityStatus;
  source: SlurpContinuitySource;
  evidence?: string;
  sourceHash?: string;
  contribution: SlurpContinuityContribution;
  expiresAt?: Date | null;
};

/** Write one fact. Text is bounded; an empty fact is refused rather than stored. */
export async function createSlurpContinuityFact(
  db: DB,
  input: SlurpContinuityFactInput,
  at = new Date(),
): Promise<SlurpContinuityFact | null> {
  const text = input.text.trim().slice(0, SLURP_CONTINUITY_TEXT_MAX);
  if (!text) return null;
  const row = {
    id: newId(),
    sourceKind: input.sourceKind,
    sourceEntityId: input.sourceEntityId,
    creatorAccountId: input.creatorAccountId,
    factType: input.factType,
    subject: (input.subject ?? "").trim().slice(0, 120),
    text,
    audienceScope: input.audienceScope,
    realityScope: input.realityScope,
    threadId: input.threadId ?? null,
    confidence: String(input.confidence ?? 1),
    salience: String(input.salience ?? 0.5),
    status: input.status ?? "active",
    source: input.source,
    evidence: (input.evidence ?? "").slice(0, SLURP_CONTINUITY_EVIDENCE_MAX),
    sourceHash: input.sourceHash ?? "",
    contribution: input.contribution,
    createdAt: at.toISOString(),
    updatedAt: at.toISOString(),
    expiresAt: input.expiresAt ? input.expiresAt.toISOString() : null,
  };
  await db.insert(slurpContinuityFacts).values(row);
  return mapFact(row);
}

/**
 * Edit a fact by hand. The edit becomes a manual contribution, so no later extraction of the same
 * source can overwrite or retract it.
 */
export async function editSlurpContinuityFact(
  db: DB,
  id: string,
  patch: Partial<Pick<SlurpContinuityFact, "text" | "subject" | "audienceScope" | "factType" | "expiresAt">>,
  at = new Date(),
): Promise<SlurpContinuityFact | null> {
  const [row] = await db.select().from(slurpContinuityFacts).where(eq(slurpContinuityFacts.id, id));
  if (!row) return null;
  const text = patch.text === undefined ? undefined : patch.text.trim().slice(0, SLURP_CONTINUITY_TEXT_MAX);
  if (text === "") return null;
  await db
    .update(slurpContinuityFacts)
    .set({
      ...(text !== undefined ? { text } : {}),
      ...(patch.subject !== undefined ? { subject: patch.subject.trim().slice(0, 120) } : {}),
      ...(patch.audienceScope ? { audienceScope: patch.audienceScope } : {}),
      ...(patch.factType ? { factType: patch.factType } : {}),
      ...(patch.expiresAt !== undefined ? { expiresAt: patch.expiresAt } : {}),
      contribution: "manual",
      updatedAt: at.toISOString(),
    })
    .where(eq(slurpContinuityFacts.id, id));
  const [updated] = await db.select().from(slurpContinuityFacts).where(eq(slurpContinuityFacts.id, id));
  return updated ? mapFact(updated as Record<string, unknown>) : null;
}

/** Move a fact's or event's status. Refused when the rules do not allow the move. */
export async function moveSlurpContinuityStatus(
  db: DB,
  target: "fact" | "event",
  id: string,
  to: SlurpContinuityStatus,
  at = new Date(),
): Promise<boolean> {
  const table = target === "fact" ? slurpContinuityFacts : slurpContinuityEvents;
  const [row] = await db.select().from(table).where(eq(table.id, id));
  if (!row || !slurpContinuityCanMove(String(row.status) as SlurpContinuityStatus, to)) return false;
  await db
    .update(table)
    .set({ status: to, ...(target === "fact" ? { updatedAt: at.toISOString() } : {}) })
    .where(eq(table.id, id));
  return true;
}

/**
 * Retract everything generated from one source, for example a deleted message. Manual edits are
 * left alone: a person wrote them, and deleting the source does not unsay them.
 */
export async function retractSlurpContinuitySource(
  db: DB,
  creatorAccountId: string,
  sourceHash: string,
  at = new Date(),
): Promise<number> {
  if (!sourceHash) return 0;
  const rows = await db
    .select()
    .from(slurpContinuityFacts)
    .where(
      and(eq(slurpContinuityFacts.creatorAccountId, creatorAccountId), eq(slurpContinuityFacts.sourceHash, sourceHash)),
    );
  let retracted = 0;
  for (const row of rows.map((entry) => mapFact(entry as Record<string, unknown>))) {
    if (row.contribution === "manual") continue;
    if (await moveSlurpContinuityStatus(db, "fact", row.id, "retracted", at)) retracted += 1;
  }
  return retracted;
}

/** What one surface may read for this Creator, filtered by the audience and reality rules. */
export async function listSlurpContinuityFor(
  db: DB,
  creatorAccountId: string,
  surface: SlurpContinuitySurface,
  context: { at: Date; threadId?: string | null; limit?: number },
): Promise<{ facts: SlurpContinuityFact[]; events: SlurpContinuityEvent[] }> {
  const factRows = await db
    .select()
    .from(slurpContinuityFacts)
    .where(eq(slurpContinuityFacts.creatorAccountId, creatorAccountId))
    .orderBy(desc(slurpContinuityFacts.updatedAt));
  const eventRows = await db
    .select()
    .from(slurpContinuityEvents)
    .where(eq(slurpContinuityEvents.creatorAccountId, creatorAccountId))
    .orderBy(desc(slurpContinuityEvents.occurredAt));
  const limit = context.limit ?? 50;
  return {
    facts: factRows
      .map((row) => mapFact(row as Record<string, unknown>))
      .filter((fact) => slurpContinuityReadable(fact, surface, context))
      .slice(0, limit),
    events: eventRows
      .map((row) => mapEvent(row as Record<string, unknown>))
      .filter((event) => slurpContinuityReadable(event, surface, context))
      .slice(0, limit),
  };
}

/** Retention for one Creator: finished events past their window, then the oldest over the cap. */
export async function pruneSlurpContinuity(db: DB, creatorAccountId: string, at = new Date()): Promise<number> {
  const rows = await db
    .select()
    .from(slurpContinuityEvents)
    .where(eq(slurpContinuityEvents.creatorAccountId, creatorAccountId))
    .orderBy(desc(slurpContinuityEvents.createdAt));
  const doomed = slurpContinuityPrunable(
    rows.map((row) => mapEvent(row as Record<string, unknown>)),
    at,
  );
  for (const id of doomed) await db.delete(slurpContinuityEvents).where(eq(slurpContinuityEvents.id, id));
  return doomed.length;
}

/**
 * Everything the planner and the ledger keep for one Creator, removed with the account. Called
 * inside the account-delete transaction, so a deleted Creator leaves no plans, shoots, campaigns,
 * facts, events, or proposals behind to travel in every backup.
 */
export async function deleteSlurpCreatorPlanningRows(tx: Pick<DB, "delete">, creatorAccountId: string): Promise<void> {
  await tx.delete(slurpContinuityFacts).where(eq(slurpContinuityFacts.creatorAccountId, creatorAccountId));
  await tx.delete(slurpContinuityEvents).where(eq(slurpContinuityEvents.creatorAccountId, creatorAccountId));
  await tx.delete(slurpContinuityProposals).where(eq(slurpContinuityProposals.creatorAccountId, creatorAccountId));
  await tx.delete(slurpContentCampaignStages).where(eq(slurpContentCampaignStages.creatorAccountId, creatorAccountId));
  await tx.delete(slurpContentCampaigns).where(eq(slurpContentCampaigns.creatorAccountId, creatorAccountId));
  await tx.delete(slurpContentOpportunities).where(eq(slurpContentOpportunities.creatorAccountId, creatorAccountId));
  await tx.delete(slurpShootSessions).where(eq(slurpShootSessions.creatorAccountId, creatorAccountId));
  await tx.delete(slurpDemandTrends).where(eq(slurpDemandTrends.creatorAccountId, creatorAccountId));
}

/**
 * Park an extracted change for review. Nothing reads a proposal; it becomes a record only when
 * someone applies it. A newer proposal from the same source replaces an older pending one, so a
 * re-read thread never piles up duplicates.
 */
export async function proposeSlurpContinuityChange(
  db: DB,
  input: {
    creatorAccountId: string;
    target: "fact" | "event";
    candidate: SlurpContinuityFactInput | SlurpContinuityEventInput;
    risk: SlurpProposalRisk;
    confidence: number;
    sourceHash: string;
  },
  at = new Date(),
): Promise<string> {
  const pending = await db
    .select()
    .from(slurpContinuityProposals)
    .where(
      and(
        eq(slurpContinuityProposals.creatorAccountId, input.creatorAccountId),
        eq(slurpContinuityProposals.sourceHash, input.sourceHash),
      ),
    );
  const text = "text" in input.candidate ? input.candidate.text : "";
  for (const row of pending) {
    const previous = parseJson<{ text?: string }>(row.candidate, {});
    if (row.status === "pending" && previous.text === text) {
      await db
        .update(slurpContinuityProposals)
        .set({ status: "superseded" })
        .where(eq(slurpContinuityProposals.id, String(row.id)));
    }
  }
  const id = newId();
  await db.insert(slurpContinuityProposals).values({
    id,
    creatorAccountId: input.creatorAccountId,
    target: input.target,
    candidate: JSON.stringify(input.candidate),
    risk: input.risk,
    confidence: String(input.confidence),
    sourceHash: input.sourceHash,
    status: "pending",
    reviewer: null,
    revision: "1",
    createdAt: at.toISOString(),
    reviewedAt: null,
  });
  return id;
}

/** Whether an equivalent fact already exists, so a re-read batch does not record it twice. */
export async function hasSlurpContinuityFact(
  db: DB,
  creatorAccountId: string,
  match: { factType: SlurpContinuityFactType; text: string; threadId?: string | null },
): Promise<boolean> {
  const rows = await db
    .select()
    .from(slurpContinuityFacts)
    .where(eq(slurpContinuityFacts.creatorAccountId, creatorAccountId));
  const wanted = match.text.trim().toLocaleLowerCase();
  return rows.some(
    (row) =>
      row.factType === match.factType &&
      String(row.text ?? "")
        .trim()
        .toLocaleLowerCase() === wanted &&
      (row.threadId ?? null) === (match.threadId ?? null),
  );
}

/** Audiences a fact may be promoted into. Promotion only ever widens toward the Creator's own. */
export const SLURP_PROMOTION_TARGETS = ["creator_private", "creator_public", "cross_platform"] as const;
export type SlurpPromotionTarget = (typeof SLURP_PROMOTION_TARGETS)[number];

/**
 * Promote a fact to a wider audience by writing a new, derived fact. The private source is never
 * changed, so it keeps its own audience and can still be retracted on its own. The derived record
 * is a manual contribution: a person chose to publish it.
 */
export async function promoteSlurpContinuityFact(
  db: DB,
  id: string,
  audienceScope: SlurpPromotionTarget,
  at = new Date(),
): Promise<SlurpContinuityFact | "not_found" | "not_promotable"> {
  const [row] = await db.select().from(slurpContinuityFacts).where(eq(slurpContinuityFacts.id, id));
  if (!row) return "not_found";
  const source = mapFact(row as Record<string, unknown>);
  if (source.audienceScope === audienceScope || source.status === "retracted" || source.status === "rejected") {
    return "not_promotable";
  }
  const derived = await createSlurpContinuityFact(
    db,
    {
      sourceKind: source.sourceKind,
      sourceEntityId: source.sourceEntityId,
      creatorAccountId: source.creatorAccountId,
      factType: source.factType,
      subject: source.subject,
      text: source.text,
      audienceScope,
      realityScope: source.realityScope,
      threadId: null,
      confidence: source.confidence,
      salience: source.salience,
      status: "active",
      source: "user",
      evidence: `Promoted from ${source.id}`,
      contribution: "manual",
    },
    at,
  );
  return derived ?? "not_promotable";
}

/** Everything the editor shows for one Creator: facts, recent events, and pending proposals. */
export async function listSlurpContinuityForEditor(
  db: DB,
  creatorAccountId: string,
  at = new Date(),
): Promise<{
  facts: SlurpContinuityFact[];
  events: SlurpContinuityEvent[];
  proposals: {
    id: string;
    target: "fact" | "event";
    candidate: Record<string, unknown>;
    risk: string;
    confidence: number;
    createdAt: string;
  }[];
}> {
  const { facts, events } = await listSlurpContinuityFor(db, creatorAccountId, "creator_editor", { at, limit: 200 });
  const rows = await db
    .select()
    .from(slurpContinuityProposals)
    .where(
      and(
        eq(slurpContinuityProposals.creatorAccountId, creatorAccountId),
        eq(slurpContinuityProposals.status, "pending"),
      ),
    );
  return {
    facts,
    events,
    proposals: rows
      .map((row) => ({
        id: String(row.id),
        target: String(row.target) === "event" ? ("event" as const) : ("fact" as const),
        candidate: parseJson<Record<string, unknown>>(row.candidate, {}),
        risk: String(row.risk),
        confidence: number(row.confidence, 0),
        createdAt: String(row.createdAt),
      }))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
  };
}

/**
 * Approve or reject one proposal. Approving writes the record the extractor proposed, as a manual
 * contribution: a person decided it. Rejecting closes it so the same batch cannot re-raise it.
 */
export async function reviewSlurpContinuityProposal(
  db: DB,
  id: string,
  decision: "approve" | "reject",
  at = new Date(),
): Promise<SlurpContinuityFact | "not_found" | "rejected" | "not_pending"> {
  const [row] = await db.select().from(slurpContinuityProposals).where(eq(slurpContinuityProposals.id, id));
  if (!row) return "not_found";
  if (String(row.status) !== "pending") return "not_pending";
  await db
    .update(slurpContinuityProposals)
    .set({ status: decision === "approve" ? "applied" : "rejected", reviewedAt: at.toISOString(), reviewer: "user" })
    .where(eq(slurpContinuityProposals.id, id));
  if (decision === "reject") return "rejected";
  const candidate = parseJson<SlurpContinuityFactInput & { status?: SlurpContinuityStatus }>(
    row.candidate,
    null as never,
  );
  if (!candidate?.text) return "not_found";
  return (
    (await createSlurpContinuityFact(db, { ...candidate, status: "active", contribution: "manual" }, at)) ?? "not_found"
  );
}
