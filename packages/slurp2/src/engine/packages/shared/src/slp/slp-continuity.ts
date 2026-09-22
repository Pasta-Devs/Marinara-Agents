/**
 * The Creator continuity ledger's vocabulary.
 *
 * The ledger stores what has to persist across Slurp operations — facts, boundaries, promises,
 * things that happened — once, with where it came from and who may see it. It is not a second
 * character card: identity stays on the Engine source record.
 *
 * Two scopes travel on every record, and they answer different questions:
 *
 * - Reality: is this literally true of the Creator? A roleplay scene or a game result can be
 *   stored without becoming public history.
 * - Audience: who may this ever be shown to? A fan's private detail stays in that fan's thread.
 */

export const SLURP_REALITY_SCOPES = ["canon", "slurp", "conversation", "roleplay", "game", "campaign"] as const;
export type SlurpRealityScope = (typeof SLURP_REALITY_SCOPES)[number];

export const SLURP_AUDIENCE_SCOPES = [
  "thread_private",
  "fan_private",
  "creator_private",
  "creator_public",
  "cross_platform",
  "canon_only",
] as const;
export type SlurpAudienceScope = (typeof SLURP_AUDIENCE_SCOPES)[number];

export const SLURP_CONTINUITY_STATUSES = [
  "proposed",
  "confirmed",
  "active",
  "expired",
  "disputed",
  "retracted",
  "rejected",
] as const;
export type SlurpContinuityStatus = (typeof SLURP_CONTINUITY_STATUSES)[number];

/** Where a record came from. Future adapters are named now so a label never has to be reused. */
export const SLURP_CONTINUITY_SOURCES = [
  "slurp_message",
  "slurp_post",
  "shoot",
  "campaign",
  "payment",
  "commission",
  "creator_profile",
  "user",
  "noodle",
  "chat",
  "roleplay",
  "game",
] as const;
export type SlurpContinuitySource = (typeof SLURP_CONTINUITY_SOURCES)[number];

export const SLURP_CONTINUITY_FACT_TYPES = [
  "boundary",
  "interest",
  "relationship",
  "plan",
  "promise",
  "preference",
  "circumstance",
  "business",
] as const;
export type SlurpContinuityFactType = (typeof SLURP_CONTINUITY_FACT_TYPES)[number];

export const SLURP_CONTINUITY_EVENT_TYPES = [
  "post_published",
  "chosen_skip",
  "shoot_opened",
  "campaign_stage",
  "request_received",
  "request_action",
  "promise_made",
  "promise_kept",
  "promise_broken",
  "payment",
  "commission",
  "disclosure",
  "boundary_stated",
  "demand_trend",
  "report_received",
] as const;
export type SlurpContinuityEventType = (typeof SLURP_CONTINUITY_EVENT_TYPES)[number];

/** Who wrote a record. A manual edit is never overwritten by a later extraction. */
export const SLURP_CONTINUITY_CONTRIBUTIONS = ["system", "generated", "manual"] as const;
export type SlurpContinuityContribution = (typeof SLURP_CONTINUITY_CONTRIBUTIONS)[number];

export const SLURP_PROPOSAL_RISKS = ["low", "medium", "high"] as const;
export type SlurpProposalRisk = (typeof SLURP_PROPOSAL_RISKS)[number];

export const SLURP_PROPOSAL_STATUSES = ["pending", "applied", "rejected", "superseded", "stale"] as const;
export type SlurpProposalStatus = (typeof SLURP_PROPOSAL_STATUSES)[number];

/** The surfaces that read continuity. Each reads a different audience slice; see the server rules. */
export const SLURP_CONTINUITY_SURFACES = ["public_post", "locked_post", "fan_thread", "creator_editor"] as const;
export type SlurpContinuitySurface = (typeof SLURP_CONTINUITY_SURFACES)[number];

export type SlurpContinuityIdentity = {
  sourceKind: string;
  sourceEntityId: string;
  creatorAccountId: string;
};

export type SlurpContinuityFact = SlurpContinuityIdentity & {
  id: string;
  factType: SlurpContinuityFactType;
  subject: string;
  text: string;
  audienceScope: SlurpAudienceScope;
  realityScope: SlurpRealityScope;
  /** The fan thread a thread- or fan-private fact belongs to. Null for every other audience. */
  threadId: string | null;
  confidence: number;
  salience: number;
  status: SlurpContinuityStatus;
  source: SlurpContinuitySource;
  evidence: string;
  sourceHash: string;
  contribution: SlurpContinuityContribution;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
};

export type SlurpContinuityEvent = SlurpContinuityIdentity & {
  id: string;
  eventType: SlurpContinuityEventType;
  source: SlurpContinuitySource;
  realityScope: SlurpRealityScope;
  audienceScope: SlurpAudienceScope;
  threadId: string | null;
  payload: Record<string, unknown>;
  status: SlurpContinuityStatus;
  confidence: number;
  evidence: string;
  /** Post, message, shoot, campaign, request, or promise ids this event is about. */
  relatedIds: string[];
  /** Deterministic key for system events, so the same thing is never recorded twice. */
  fingerprint: string;
  contribution: SlurpContinuityContribution;
  occurredAt: string;
  createdAt: string;
  expiresAt: string | null;
};
