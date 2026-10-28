export type SlpCreatorViewerWallets = Record<string, { coins: number }>;
/** One wallet's ledger line. `amount` is signed: negative spends, positive earns. */
export type SlurpWalletEntry = {
  kind:
    | "unlock"
    | "subscribe"
    | "renew"
    | "tip"
    | "topUp"
    | "stipend"
    | "ad"
    | "engagement"
    | "income"
    // Direct-message economy kinds. The server has emitted these since messaging landed; the
    // client union had not caught up, so a PPV or commission line was typed as impossible.
    | "messageRequest"
    | "ppv"
    | "commission";
  amount: number;
  at: string;
  note?: string;
  /** Spends name who was paid, so a profile can tell "you were subscribed here" from "never". */
  binding?: { viewerAccountId: string; creatorAccountId: string };
};
export type SlurpWallet = {
  coins: number;
  cheatsEnabled?: boolean;
  stipendOn?: string;
  refillFloor?: number;
  refillAvailable?: boolean;
  nextRefillAt?: string;
  ledger: SlurpWalletEntry[];
  earnedToday: { ad: number; engagement: number };
  /** `cancelled`: access runs to `paidThroughAt`, then it ends instead of renewing. */
  subscriptions: Record<string, { paidThroughAt: string; price: number; cancelled?: boolean }>;
};
export type SlurpTopFan = {
  id: string;
  displayName: string | null;
  handle: string | null;
  traits: string[];
  stage: string;
  audienceArc?: string;
  spent: number;
  interactions: number;
  firstSeenAt: string;
};
export type SlurpGoalProgress = {
  label: string;
  target: number;
  raised: number;
  progress: number;
  remaining: number;
  met: boolean;
  startedAt: string;
};
export type SlurpStudioPost = {
  id: string;
  title: string | null;
  createdAt: string;
  locked: boolean;
  hasImage: boolean;
  reach: number;
  likeCount: number;
  replyCount: number;
  unlockCount: number | null;
};
export type SlurpStudioCreator = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  followers: number;
  subscribers: number;
  earnings: {
    coins: number;
    lifetime: number;
    ledger: Array<{ kind: string; amount: number; at: string; note?: string }>;
  };
  milestone: { reached: number | null; next: number | null; progress: number; remaining: number };
  goal: SlurpGoalProgress | null;
  /** Earnings (platform dollars) this Creator may still withdraw today; always whole coins' worth. */
  payoutAllowance: number;
  /** The SlurpCoins that payout brings into the Wallet. */
  payoutCoins: number;
  topFans: SlurpTopFan[];
  /** Null on a first visit: "no change yet" and "measured no change" are different. */
  followersDelta: number | null;
  /** Null until a visit has recorded a subscriber count to compare with. */
  subscribersDelta: number | null;
  earningsDelta: number | null;
  /** Likes on posts put up this week and the week before (the "Likes this week" tile). */
  likes?: { thisWeek: number; lastWeek: number };
  milestonesCrossed: number[];
  posts: SlurpStudioPost[];
};

// The Messages per-creator group edits a Creator's message price, which Economy owns.
export { useSetSlurpCreatorPrice } from "./slp-economy-hooks.js";

// The Messages commissions submodule shows the viewer wallet balance.
export { useSlurpWallet } from "./slp-economy-hooks.js";
