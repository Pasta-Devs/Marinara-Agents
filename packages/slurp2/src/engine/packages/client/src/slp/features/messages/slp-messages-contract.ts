export type SlurpDmPolicy = "open" | "subscribers" | "paid" | "closed";
export type SlurpRapportContribution = {
  key: string;
  detail: string;
  weight: number;
  points: number;
};
export type SlurpRapport = {
  score: number;
  tier: "stranger" | "acquaintance" | "regular" | "favourite" | "whale";
  contributions: SlurpRapportContribution[];
};
export type SlurpCreatorMessaging = {
  dmPolicy: SlurpDmPolicy;
  requestFee: number;
  ppvPrice: number;
  rapportWeights: Record<string, number>;
  proactiveMessages: boolean;
  unlockPrice: number | null;
  commissionBase: number;
  commissionMin: number;
  commissionMax: number;
  autoQuote: boolean;
  pricedAt: string | null;
};
export type SlurpMessage = {
  id: string;
  threadId: string;
  senderAccountId: string;
  role: "viewer" | "creator";
  kind:
    | "text"
    | "tip"
    | "ppv"
    | "system"
    | "broadcast"
    | "post_preview"
    | "commission_brief"
    | "commission_quote"
    | "commission_delivery";
  content: string;
  imageUrl: string | null;
  price: number;
  unlockedAt: string | null;
  readAt: string | null;
  metadata: Record<string, unknown>;
  senderSnapshot: Record<string, unknown>;
  createdAt: string;
};
export type SlurpThread = {
  id: string;
  viewerAccountId: string;
  creatorAccountId: string;
  state: "request" | "active" | "declined";
  openedBy: "viewer" | "creator";
  requestFeePaid: number;
  /** When this conversation was last emptied. Anything older is hidden from the chat. */
  clearedAt?: string | null;
  lastMessageAt: string;
  lastMessagePreview: string;
  viewerUnread: number;
  creatorUnread: number;
  needsReply: boolean;
  generationEpoch: number;
  rapport: SlurpRapport;
  createdAt: string;
  updatedAt: string;
  creatorHandle: string;
  creatorDisplayName: string;
  creatorAvatarUrl: string | null;
  counterpartName?: string | null;
  counterpartHandle?: string | null;
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
  /** When a character Creator's finished piece is due to arrive. Null when a person delivers it. */
  deliverAt?: string | null;
  /** A fan's pending counter-offer, waiting for the Creator. */
  counterPrice?: number | null;
  haggleRounds?: number;
  /** What the Creator's own pricing would quote for this brief. */
  suggestedPrice?: number;
  createdAt: string;
  updatedAt: string;
};
export type SlurpSendResponse = {
  thread: SlurpThread;
  message: SlurpMessage;
  reply: SlurpMessage | null;
  replyStatus: string;
  typingMs?: number;
  tipError?: string | null;
};
/**
 * What the info panel shows, and it is not the same on both sides.
 *
 * The fan gets words. `slurp-rapport.ts` is explicit that the score never reaches a thread,
 * because a meter invites the player to farm it. The Creator's operator gets every number,
 * because that side is a business rather than a relationship.
 */
export type SlurpThreadRelationship = {
  side: "viewer" | "creator";
  tier: string;
  score: number;
  contributions: { key: string; detail: string; weight: number; points: number }[];
  mood: number;
  strikes: number;
  notes: { id: string; text: string; tier: "working" | "longterm" }[];
  spentCoins: number;
  coolUntil: string | null;
  dayVibe: string | null;
  availability: {
    online: boolean;
    activity: string | null;
    minutesUntilOnline: number | null;
    estimated?: boolean;
  };
  audienceTone: "warm" | "mixed" | "unfiltered";
  imageMode: "friendly" | "hostile" | "none";
  creatorState: {
    emotion: string;
    emotionIntensity: number;
    energy: number;
    arousal: number;
    exposure: number;
    intent: string;
    modifiers: Array<{ kind: string; until: string; source: string }>;
    updatedAt: string;
  };
  threadState: {
    posture: string;
    familiarity: number;
    sexualComfort: number;
    emotionalTrust: number;
    respect: number;
    resentment: number;
    threadDesire: number;
    adultLevel: string;
    updatedAt: string;
  };
  scheduledFollowUps: Array<{
    id: string;
    scheduledAt: string;
    type: string;
    reason: string;
    context: string;
    sequenceNumber?: number;
    totalInSequence?: number;
  }>;
};
export type SlurpPromptDebug = {
  stance: Record<string, unknown>;
  thread: Record<string, unknown>;
  audienceTone: string;
  prompt: Array<{ role: string; content: string }>;
};
export type SlurpPromptErrorKind = "disabled" | "connection" | "unauthorized" | "not-found" | "generic";
export type SlurpComposeTarget = {
  id: string;
  kind: "creator" | "character";
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  threadId: string | null;
  creatorAccountId: string | null;
};

// The Creators Backstage panel renders a Creator's message policy inline, so this group is part of
// the Messages contract rather than an internal component.
export { CreatorMessagingGroup } from "./SlpCreatorMessagingGroup.js";
