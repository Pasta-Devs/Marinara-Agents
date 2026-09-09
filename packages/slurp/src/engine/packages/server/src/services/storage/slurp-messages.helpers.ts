import {
  SLURP_THREAD_STATE_DEFAULT,
  decaySlurpThreadState,
  type SlurpThreadState as SlurpConversationState,
} from "../slurp/slurp-creator-state.js";
import { readStoredNotes, type SlurpThreadNote } from "../slurp/slurp-thread-notes.js";
import type { SlurpRapport } from "../slurp/slurp-rapport.js";
import type { SlurpMessageKind, SlurpThreadState } from "../slurp/slurp-messaging.js";
import type { SlurpCommission, SlurpMessage, SlurpThread } from "./slurp-messages.types.js";

export const now = () => new Date().toISOString();
export const DAY = 86_400_000;

export const int = (value: string | null | undefined, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
};

export const json = (value: string | null | undefined): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(value ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

export function readThreadState(raw: unknown, fallbackUpdatedAt: string): SlurpConversationState {
  let parsed: Record<string, unknown> = {};
  if (typeof raw === "string") {
    try {
      const value = JSON.parse(raw);
      if (value && typeof value === "object" && !Array.isArray(value)) parsed = value as Record<string, unknown>;
    } catch {
      // Use the defaults for a malformed or pre-state row.
    }
  }
  const number = (key: keyof SlurpConversationState, fallback: number) =>
    typeof parsed[key] === "number" && Number.isFinite(parsed[key]) ? Number(parsed[key]) : fallback;
  const storedPosture = typeof parsed.posture === "string" ? parsed.posture : parsed.stance;
  const posture =
    typeof storedPosture === "string" &&
    ["open", "friendly", "playful", "teasing", "professional", "guarded", "distant", "defensive", "rejecting"].includes(
      storedPosture,
    )
      ? (storedPosture as SlurpConversationState["posture"])
      : SLURP_THREAD_STATE_DEFAULT.posture;
  const adultLevel =
    typeof parsed.adultLevel === "string" &&
    ["ordinary", "suggestive", "provocative", "intimate", "explicit"].includes(parsed.adultLevel)
      ? (parsed.adultLevel as SlurpConversationState["adultLevel"])
      : SLURP_THREAD_STATE_DEFAULT.adultLevel;
  const state: SlurpConversationState = {
    posture,
    familiarity: number("familiarity", SLURP_THREAD_STATE_DEFAULT.familiarity),
    sexualComfort: number("sexualComfort", SLURP_THREAD_STATE_DEFAULT.sexualComfort),
    emotionalTrust: number("emotionalTrust", SLURP_THREAD_STATE_DEFAULT.emotionalTrust),
    respect: number("respect", SLURP_THREAD_STATE_DEFAULT.respect),
    resentment: number("resentment", SLURP_THREAD_STATE_DEFAULT.resentment),
    threadDesire: number("threadDesire", SLURP_THREAD_STATE_DEFAULT.threadDesire),
    adultLevel,
    updatedAt:
      typeof parsed.updatedAt === "string" && Number.isFinite(Date.parse(parsed.updatedAt))
        ? parsed.updatedAt
        : fallbackUpdatedAt,
  };
  const parsedUpdatedAt = Date.parse(state.updatedAt);
  const elapsedHours = Number.isFinite(parsedUpdatedAt) ? Math.max(0, (Date.now() - parsedUpdatedAt) / 3_600_000) : 0;
  return elapsedHours > 0 ? decaySlurpThreadState(state, elapsedHours, new Date().toISOString()) : state;
}

export const mapMessage = (row: Record<string, unknown>): SlurpMessage => ({
  id: String(row.id),
  threadId: String(row.threadId),
  senderAccountId: String(row.senderAccountId),
  role: row.role === "creator" ? "creator" : "viewer",
  kind: String(row.kind) as SlurpMessageKind,
  content: String(row.content ?? ""),
  imageUrl: (row.imageUrl as string | null) ?? null,
  price: int(row.price as string),
  unlockedAt: (row.unlockedAt as string | null) ?? null,
  readAt: (row.readAt as string | null) ?? null,
  metadata: json(row.metadata as string),
  createdAt: String(row.createdAt),
});

export function readStoredRapport(raw: Record<string, unknown>): SlurpRapport {
  return {
    score: typeof raw.score === "number" ? raw.score : 0,
    tier: (typeof raw.tier === "string" ? raw.tier : "stranger") as SlurpRapport["tier"],
    contributions: Array.isArray(raw.contributions) ? (raw.contributions as SlurpRapport["contributions"]) : [],
  };
}

export const mapThread = (row: Record<string, unknown>): SlurpThread => ({
  id: String(row.id),
  viewerAccountId: String(row.viewerAccountId),
  creatorAccountId: String(row.creatorAccountId),
  state: String(row.state) as SlurpThreadState,
  openedBy: row.openedBy === "creator" ? "creator" : "viewer",
  requestFeePaid: int(row.requestFeePaid as string),
  lastMessageAt: String(row.lastMessageAt),
  lastMessagePreview: String(row.lastMessagePreview ?? ""),
  viewerUnread: int(row.viewerUnread as string),
  creatorUnread: int(row.creatorUnread as string),
  replyNotBeforeAt: (row.replyNotBeforeAt as string | null) ?? null,
  rapport: readStoredRapport(json(row.rapport as string)),
  mood: Number.isFinite(Number(row.mood)) ? Number(row.mood) : 0,
  moodUpdatedAt: (row.moodUpdatedAt as string | null) ?? null,
  coolUntil: (row.coolUntil as string | null) ?? null,
  extendedOnlineUntil: (row.extendedOnlineUntil as string | null) ?? null,
  scheduledFollowUps: (() => {
    try {
      const parsed = JSON.parse(String(row.scheduledFollowUps ?? "[]"));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })(),
  clearedAt: (row.clearedAt as string | null) ?? null,
  threadState: readThreadState(row.threadState, String(row.updatedAt)),
  strikes: int(row.strikes as string),
  lastStrikeAt: (row.lastStrikeAt as string | null) ?? null,
  notes: readStoredNotes(row.notes),
  createdAt: String(row.createdAt),
  updatedAt: String(row.updatedAt),
});

export const mapCommission = (row: Record<string, unknown>): SlurpCommission => ({
  id: String(row.id),
  threadId: String(row.threadId),
  viewerAccountId: String(row.viewerAccountId),
  creatorAccountId: String(row.creatorAccountId),
  state: String(row.state) as SlurpCommission["state"],
  brief: String(row.brief),
  price: int(row.price as string),
  deliveryMessageId: (row.deliveryMessageId as string | null) ?? null,
  deliverAt: (row.deliverAt as string | null) ?? null,
  createdAt: String(row.createdAt),
  updatedAt: String(row.updatedAt),
});

export type { SlurpThreadNote };
