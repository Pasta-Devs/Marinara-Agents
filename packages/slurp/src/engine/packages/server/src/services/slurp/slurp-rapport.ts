/**
 * How well one viewer and one creator know each other, as a single 0-100 score.
 *
 * Pure by design, for the reason `slurp-wallet.ts` and `slurp-prices.ts` are: the rules can be
 * unit-tested without an Engine checkout, and the creator edit panel can render the exact same
 * breakdown the prompt was built from rather than a second approximation of it.
 *
 * The score is never shown in a thread. It reaches the model as prose and reaches the player
 * only through the per-creator edit panel, where every weight is editable.
 */

/** Everything the score is computed from. All counters are lifetime totals for one pair. */
export type SlurpRapportFacts = {
  subscribed: boolean;
  /** Days the current unbroken subscription has run. Zero when not subscribed. */
  subscribedDays: number;
  /** True when the viewer used to be subscribed and is not now. */
  lapsed: boolean;
  tippedCoins: number;
  unlockedCoins: number;
  commissionsDelivered: number;
  viewerMessages: number;
  creatorMessages: number;
  /** Mean characters per viewer message. Effort, not volume. */
  averageViewerMessageLength: number;
  /** Days since the viewer last wrote. `null` when they never have. */
  daysSinceViewerMessage: number | null;
};

export const emptySlurpRapportFacts = (): SlurpRapportFacts => ({
  subscribed: false,
  subscribedDays: 0,
  lapsed: false,
  tippedCoins: 0,
  unlockedCoins: 0,
  commissionsDelivered: 0,
  viewerMessages: 0,
  creatorMessages: 0,
  averageViewerMessageLength: 0,
  daysSinceViewerMessage: null,
});

/**
 * Per-signal weights, in score points. Each signal contributes between zero and its weight,
 * except `recencyDecay`, which only ever subtracts. The positive weights sum to 100, so a
 * viewer who maxes every signal scores exactly 100 and the numbers stay readable in the panel.
 */
export type SlurpRapportWeights = {
  subscription: number;
  loyalty: number;
  tips: number;
  unlocks: number;
  commissions: number;
  conversation: number;
  effort: number;
  reciprocity: number;
  recencyDecay: number;
  lapsedPenalty: number;
};

export const SLURP_DEFAULT_RAPPORT_WEIGHTS: SlurpRapportWeights = {
  subscription: 20,
  loyalty: 10,
  tips: 22,
  unlocks: 16,
  commissions: 10,
  conversation: 10,
  effort: 6,
  reciprocity: 6,
  recencyDecay: 25,
  lapsedPenalty: 10,
};

/** The point at which a signal counts as maxed. Everything below scales toward it. */
const SATURATION = {
  /** A subscription this old is as loyal as loyalty gets. */
  loyaltyDays: 90,
  tippedCoins: 120,
  unlockedCoins: 90,
  commissions: 3,
  viewerMessages: 60,
  /** Characters per message. Past this, longer is not more effort, it is a wall of text. */
  messageLength: 240,
  /** Silence this long costs the whole recency weight. */
  silenceDays: 21,
};

/**
 * Diminishing returns. The first tip moves the score far more than the fortieth, which is what
 * keeps a whale from pinning the number at 100 and flattening every creator into the same warmth.
 */
const curve = (value: number, saturation: number): number =>
  saturation <= 0 || value <= 0 ? 0 : Math.min(1, Math.sqrt(value / saturation));

const linear = (value: number, saturation: number): number =>
  saturation <= 0 || value <= 0 ? 0 : Math.min(1, value / saturation);

export type SlurpRapportContribution = {
  key: keyof SlurpRapportWeights;
  /** The raw fact behind this line, for the edit panel. */
  detail: string;
  weight: number;
  /** Signed points this signal added to or removed from the total. */
  points: number;
};

export type SlurpRapport = {
  score: number;
  tier: SlurpRapportTier;
  contributions: SlurpRapportContribution[];
};

export type SlurpRapportTier = "stranger" | "acquaintance" | "regular" | "favourite" | "whale";

/**
 * Tiers are presentation only: they name a score band for the panel and for the prompt. Nothing
 * is gated on them, so a band edge never silently removes a feature the viewer had a moment ago.
 */
export function slurpRapportTier(score: number): SlurpRapportTier {
  if (score >= 80) return "whale";
  if (score >= 60) return "favourite";
  if (score >= 35) return "regular";
  if (score >= 15) return "acquaintance";
  return "stranger";
}

export function scoreSlurpRapport(
  facts: SlurpRapportFacts,
  weights: SlurpRapportWeights = SLURP_DEFAULT_RAPPORT_WEIGHTS,
): SlurpRapport {
  const round = (value: number) => Math.round(value * 10) / 10;
  const contributions: SlurpRapportContribution[] = [
    {
      key: "subscription",
      detail: facts.subscribed ? "subscribed" : facts.lapsed ? "subscription lapsed" : "not subscribed",
      weight: weights.subscription,
      points: round(facts.subscribed ? weights.subscription : 0),
    },
    {
      key: "loyalty",
      detail: `${Math.max(0, Math.round(facts.subscribedDays))}d subscribed`,
      weight: weights.loyalty,
      points: round(weights.loyalty * curve(facts.subscribedDays, SATURATION.loyaltyDays)),
    },
    {
      key: "tips",
      detail: `${Math.max(0, Math.round(facts.tippedCoins))} coins tipped`,
      weight: weights.tips,
      points: round(weights.tips * curve(facts.tippedCoins, SATURATION.tippedCoins)),
    },
    {
      key: "unlocks",
      detail: `${Math.max(0, Math.round(facts.unlockedCoins))} coins unlocked`,
      weight: weights.unlocks,
      points: round(weights.unlocks * curve(facts.unlockedCoins, SATURATION.unlockedCoins)),
    },
    {
      key: "commissions",
      detail: `${Math.max(0, facts.commissionsDelivered)} delivered`,
      weight: weights.commissions,
      points: round(weights.commissions * curve(facts.commissionsDelivered, SATURATION.commissions)),
    },
    {
      key: "conversation",
      detail: `${Math.max(0, facts.viewerMessages)} messages sent`,
      weight: weights.conversation,
      points: round(weights.conversation * curve(facts.viewerMessages, SATURATION.viewerMessages)),
    },
    {
      key: "effort",
      detail: `${Math.max(0, Math.round(facts.averageViewerMessageLength))} chars per message`,
      weight: weights.effort,
      points: round(weights.effort * linear(facts.averageViewerMessageLength, SATURATION.messageLength)),
    },
    {
      key: "reciprocity",
      detail: reciprocityDetail(facts),
      weight: weights.reciprocity,
      points: round(weights.reciprocity * reciprocity(facts)),
    },
    {
      key: "recencyDecay",
      detail:
        facts.daysSinceViewerMessage === null
          ? "never written"
          : `${Math.max(0, Math.round(facts.daysSinceViewerMessage))}d since last message`,
      weight: weights.recencyDecay,
      points: -round(weights.recencyDecay * silence(facts)),
    },
    {
      key: "lapsedPenalty",
      detail: facts.lapsed ? "was subscribed, is not now" : "no lapse",
      weight: weights.lapsedPenalty,
      points: facts.lapsed ? -round(weights.lapsedPenalty) : 0,
    },
  ];
  const total = contributions.reduce((sum, entry) => sum + entry.points, 0);
  const score = Math.max(0, Math.min(100, Math.round(total)));
  return { score, tier: slurpRapportTier(score), contributions };
}

/**
 * Silence decays the score, but only once the viewer has actually said something. A brand-new
 * thread is not a cold one — charging it the full decay would open every first contact at zero
 * and make the creator's opening line read as a brush-off.
 */
function silence(facts: SlurpRapportFacts): number {
  if (facts.daysSinceViewerMessage === null) return 0;
  return linear(facts.daysSinceViewerMessage, SATURATION.silenceDays);
}

/**
 * Does the creator answer? A thread the viewer talks into and never hears back from is not a
 * relationship, and scoring it as one would let a wall of ignored messages buy warmth.
 */
function reciprocity(facts: SlurpRapportFacts): number {
  if (facts.viewerMessages <= 0) return 0;
  return Math.min(1, facts.creatorMessages / facts.viewerMessages);
}

function reciprocityDetail(facts: SlurpRapportFacts): string {
  return `${Math.max(0, facts.creatorMessages)} replies to ${Math.max(0, facts.viewerMessages)} messages`;
}

/** The rapport line the creator prompt reads. Prose, because that is what the model consumes. */
export function describeSlurpRapport(rapport: SlurpRapport, viewerName: string): string {
  const notable = rapport.contributions
    .filter((entry) => Math.abs(entry.points) >= 1)
    .sort((left, right) => Math.abs(right.points) - Math.abs(left.points))
    .slice(0, 4)
    .map((entry) => entry.detail);
  return `Your history with ${viewerName}: ${rapport.tier} (${rapport.score}/100).${
    notable.length > 0 ? ` What stands out: ${notable.join("; ")}.` : ""
  }`;
}

/** Read stored weights back, falling back per field so a hand-edited blob costs nothing. */
export function readSlurpRapportWeights(value: unknown): SlurpRapportWeights {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const out = { ...SLURP_DEFAULT_RAPPORT_WEIGHTS };
  for (const key of Object.keys(out) as (keyof SlurpRapportWeights)[]) {
    const stored = raw[key];
    if (typeof stored === "number" && Number.isFinite(stored) && stored >= 0 && stored <= 100) out[key] = stored;
  }
  return out;
}
