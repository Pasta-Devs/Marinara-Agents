/**
 * Signals: one shape for everything that happened around a Creator, whatever recorded it.
 *
 * Pure. The feature layer reads the records; this turns each into the envelope from
 * `docs/WORLD-SIMULATION.md` and orders them. It is not a store: every signal points back at the
 * record it came from, and scopes are the continuity scopes that record already carries.
 *
 * Private threads stay private here too: a DM becomes its event label, never its text.
 */
import type {
  SlurpAudienceScope,
  SlurpContinuityEvent,
  SlurpContinuityFact,
  SlurpContinuitySource,
  SlurpRealityScope,
} from "../../../../../shared/src/slp/slp-continuity.js";
import { SLURP_CONTINUITY_EVENT_LABELS, SLURP_CONTINUITY_FACT_LABELS } from "./slp-continuity-prompt.js";

export const SLURP_SIGNAL_SOURCES = [
  "post",
  "message",
  "promise",
  "schedule",
  "world",
  "creator",
  "engine-chat",
  "agent",
  "user",
  "system",
] as const;
export type SlurpSignalSource = (typeof SLURP_SIGNAL_SOURCES)[number];

export type SlurpSignal = {
  id: string;
  at: string;
  source: SlurpSignalSource;
  /** Empty for an install-wide signal. */
  creatorIds: string[];
  scope: "creator" | "world";
  audienceScope: SlurpAudienceScope;
  realityScope: SlurpRealityScope;
  /** Short and privacy-safe. */
  summary: string;
  /** The record ids this came from. */
  refs: string[];
};

const SUMMARY_MAX = 200;
const clip = (value: string) => value.replace(/\s+/gu, " ").trim().slice(0, SUMMARY_MAX);
const PRIVATE_SCOPES = new Set<SlurpAudienceScope>(["thread_private", "fan_private"]);

/** Where a continuity record came from, as a signal source. */
const CONTINUITY_SOURCE: Record<SlurpContinuitySource, SlurpSignalSource> = {
  slurp_message: "message",
  slurp_post: "post",
  shoot: "post",
  campaign: "post",
  payment: "message",
  commission: "message",
  creator_profile: "user",
  user: "user",
  noodle: "agent",
  chat: "engine-chat",
  roleplay: "engine-chat",
  game: "agent",
};

export function slurpSignalFromPost(post: {
  id: string;
  authorAccountId: string;
  title: string | null;
  content: string;
  access: string;
  createdAt: string;
}): SlurpSignal {
  return {
    id: `post:${post.id}`,
    at: post.createdAt,
    source: "post",
    creatorIds: [post.authorAccountId],
    scope: "creator",
    audienceScope: post.access === "locked" ? "creator_private" : "creator_public",
    realityScope: "slurp",
    summary: clip(`Posted${post.access === "locked" ? " (locked)" : ""}: ${post.title || post.content}`),
    refs: [post.id],
  };
}

export function slurpSignalFromFact(fact: SlurpContinuityFact): SlurpSignal {
  return {
    id: `fact:${fact.id}`,
    at: fact.updatedAt,
    source: CONTINUITY_SOURCE[fact.source] ?? "system",
    creatorIds: [fact.creatorAccountId],
    scope: "creator",
    audienceScope: fact.audienceScope,
    realityScope: fact.realityScope,
    // A fan's private note is summarised by its kind only.
    summary: clip(
      `${SLURP_CONTINUITY_FACT_LABELS[fact.factType] ?? fact.factType}${
        PRIVATE_SCOPES.has(fact.audienceScope) ? " (private thread)" : `: ${fact.text}`
      }`,
    ),
    refs: [fact.id],
  };
}

export function slurpSignalFromEvent(event: SlurpContinuityEvent): SlurpSignal {
  return {
    id: `event:${event.id}`,
    at: event.occurredAt,
    source: CONTINUITY_SOURCE[event.source] ?? "system",
    creatorIds: [event.creatorAccountId],
    scope: "creator",
    audienceScope: event.audienceScope,
    realityScope: event.realityScope,
    summary: clip(SLURP_CONTINUITY_EVENT_LABELS[event.eventType] ?? event.eventType.replace(/_/gu, " ")),
    refs: [event.id, ...event.relatedIds],
  };
}

export function slurpSignalFromPromise(
  creatorId: string,
  promise: { id: string; topic: string | null; workflow: string; plannedAt: string; dueAt: string | null },
): SlurpSignal {
  const open = promise.workflow === "planned";
  return {
    id: `promise:${promise.id}`,
    at: promise.plannedAt,
    source: "promise",
    creatorIds: [creatorId],
    scope: "creator",
    audienceScope: "creator_private",
    realityScope: "slurp",
    summary: clip(
      `${open ? "Open promise" : "Promise handled"}${promise.topic ? `: ${promise.topic}` : ""}${
        open && promise.dueAt ? ` (due ${promise.dueAt.slice(0, 16).replace("T", " ")})` : ""
      }`,
    ),
    refs: [promise.id],
  };
}

export function slurpSignalFromWorldEvent(event: { id: string; name: string }, at: Date): SlurpSignal {
  return {
    id: `world:${event.id}`,
    at: at.toISOString(),
    source: "world",
    creatorIds: [],
    scope: "world",
    audienceScope: "creator_public",
    realityScope: "slurp",
    summary: clip(`Platform event running: ${event.name}`),
    refs: [event.id],
  };
}

export function slurpSignalFromOtherCreator(title: string, index: number, at: Date): SlurpSignal {
  return {
    id: `creator:${index}:${title}`,
    at: at.toISOString(),
    source: "creator",
    creatorIds: [],
    scope: "world",
    audienceScope: "creator_public",
    realityScope: "slurp",
    summary: clip(`Another Creator posted: ${title}`),
    refs: [],
  };
}

export function slurpSignalFromSchedule(
  creatorId: string,
  moment: { current: string; previous: string | null },
  at: Date,
): SlurpSignal {
  return {
    id: `schedule:${creatorId}`,
    at: at.toISOString(),
    source: "schedule",
    creatorIds: [creatorId],
    scope: "creator",
    audienceScope: "creator_private",
    realityScope: "slurp",
    summary: clip(`Now: ${moment.current}${moment.previous ? ` (before: ${moment.previous})` : ""}`),
    refs: [],
  };
}

/** Newest first, one per id, within the window, at most `limit`. */
export function slurpOrderSignals(
  signals: readonly SlurpSignal[],
  input: { since: Date; limit: number },
): SlurpSignal[] {
  const seen = new Set<string>();
  return signals
    .filter((signal) => Date.parse(signal.at) >= input.since.getTime())
    .sort((left, right) => right.at.localeCompare(left.at))
    .filter((signal) => (seen.has(signal.id) ? false : (seen.add(signal.id), true)))
    .slice(0, input.limit);
}
