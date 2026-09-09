import type { SlurpMessageKind, SlurpThreadState } from "../slurp/slurp-messaging.js";
import type { SlurpRapport } from "../slurp/slurp-rapport.js";
import type { SlurpThreadNote } from "../slurp/slurp-thread-notes.js";
import type { SlurpThreadState as SlurpConversationState } from "../slurp/slurp-creator-state.js";

export type SlurpMessage = {
  id: string;
  threadId: string;
  senderAccountId: string;
  role: "viewer" | "creator";
  kind: SlurpMessageKind;
  content: string;
  imageUrl: string | null;
  price: number;
  unlockedAt: string | null;
  readAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type SlurpThread = {
  id: string;
  viewerAccountId: string;
  creatorAccountId: string;
  state: SlurpThreadState;
  openedBy: "viewer" | "creator";
  requestFeePaid: number;
  lastMessageAt: string;
  lastMessagePreview: string;
  viewerUnread: number;
  creatorUnread: number;
  replyNotBeforeAt: string | null;
  rapport: SlurpRapport;
  mood: number;
  moodUpdatedAt: string | null;
  coolUntil: string | null;
  extendedOnlineUntil: string | null;
  scheduledFollowUps: Array<{
    id: string;
    scheduledAt: string;
    type: string;
    reason: string;
    context: string;
    relatedNoteId?: string;
    sequenceNumber?: number;
    totalInSequence?: number;
    recurringPattern?: string;
  }>;
  clearedAt: string | null;
  threadState: SlurpConversationState;
  strikes: number;
  lastStrikeAt: string | null;
  notes: SlurpThreadNote[];
  createdAt: string;
  updatedAt: string;
};

export type SlurpThreadView = SlurpThread & {
  creatorHandle: string;
  creatorDisplayName: string;
  creatorAvatarUrl: string | null;
  subscribed: boolean;
};

export type SlurpCommission = {
  id: string;
  threadId: string;
  viewerAccountId: string;
  creatorAccountId: string;
  state: "brief" | "quoted" | "accepted" | "declined" | "delivered";
  brief: string;
  price: number;
  deliveryMessageId: string | null;
  deliverAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SlurpSendResult =
  | { status: "sent"; thread: SlurpThread; message: SlurpMessage }
  | { status: "closed" }
  | { status: "insufficient_funds"; required: number }
  | { status: "not_found" };
