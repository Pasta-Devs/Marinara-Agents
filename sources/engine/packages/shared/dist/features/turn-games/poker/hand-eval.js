// ──────────────────────────────────────────────
// Poker — hand evaluator
// ──────────────────────────────────────────────
// Pure, dependency-free hand ranking. `evaluate5` scores an exact 5-card hand;
// `evaluateBest` enumerates all C(n,5) combinations out of a 5-7 card pool
// (hole cards + board) and keeps the maximum, which is how Texas Hold'em
// determines the best hand available to each seat at showdown. `HandRank` is
// a comparable, JSON-safe value: two hands compare by `category` first, then
// by `tiebreak` lexicographically — no hand-specific comparison logic lives
// outside `compareHands`.
import { RANK_NAMES, rankPluralName } from "./deck.js";
/** Hand categories, low to high. Mirrors standard poker hand ranking order. */
export const HAND_CATEGORY = {
    HIGH_CARD: 0,
    PAIR: 1,
    TWO_PAIR: 2,
    THREE_OF_A_KIND: 3,
    STRAIGHT: 4,
    FLUSH: 5,
    FULL_HOUSE: 6,
    FOUR_OF_A_KIND: 7,
    STRAIGHT_FLUSH: 8,
};
/** Ranks of a hand, descending, e.g. [14, 14, 9, 5, 2]. */
function descendingRanks(cards) {
    return cards.map((c) => c.rank).sort((a, b) => b - a);
}
/**
 * Top card of a straight formed by exactly 5 distinct, sorted-descending
 * ranks, or `null` if they aren't consecutive. The ace-low "wheel"
 * (A-2-3-4-5) plays as a 5-high straight, so its top card is 5, not 14 — this
 * is what keeps it (and the "steel wheel" straight flush) below every
 * higher-topped straight in `compareHands`.
 */
function straightHigh(uniqueDescRanks) {
    if (uniqueDescRanks.length !== 5)
        return null;
    const [r0, r1, r2, r3, r4] = uniqueDescRanks;
    if (r0 === 14 && r1 === 5 && r2 === 4 && r3 === 3 && r4 === 2)
        return 5;
    if (r0 - r4 === 4)
        return r0;
    return null;
}
/** Rank groups sorted by (count desc, rank desc) — e.g. [[13,3],[9,2]] for K-K-K-9-9. */
function rankGroups(ranks) {
    const counts = new Map();
    for (const r of ranks)
        counts.set(r, (counts.get(r) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
}
/** Score an exact 5-card hand. Throws if `cards.length !== 5`. */
export function evaluate5(cards) {
    if (cards.length !== 5) {
        throw new Error(`evaluate5 requires exactly 5 cards, got ${cards.length}`);
    }
    const ranks = descendingRanks(cards);
    const isFlush = cards.every((c) => c.suit === cards[0].suit);
    const straightTop = straightHigh([...new Set(ranks)].sort((a, b) => b - a));
    const groups = rankGroups(ranks);
    const g0 = groups[0];
    if (isFlush && straightTop !== null) {
        return { category: HAND_CATEGORY.STRAIGHT_FLUSH, tiebreak: [straightTop] };
    }
    if (g0[1] === 4) {
        const kicker = groups[1][0];
        return { category: HAND_CATEGORY.FOUR_OF_A_KIND, tiebreak: [g0[0], kicker] };
    }
    if (g0[1] === 3 && groups[1][1] === 2) {
        return { category: HAND_CATEGORY.FULL_HOUSE, tiebreak: [g0[0], groups[1][0]] };
    }
    if (isFlush) {
        return { category: HAND_CATEGORY.FLUSH, tiebreak: ranks };
    }
    if (straightTop !== null) {
        return { category: HAND_CATEGORY.STRAIGHT, tiebreak: [straightTop] };
    }
    if (g0[1] === 3) {
        const kickers = groups.slice(1).map(([r]) => r);
        return { category: HAND_CATEGORY.THREE_OF_A_KIND, tiebreak: [g0[0], ...kickers] };
    }
    if (g0[1] === 2 && groups[1][1] === 2) {
        const kicker = groups[2][0];
        return { category: HAND_CATEGORY.TWO_PAIR, tiebreak: [g0[0], groups[1][0], kicker] };
    }
    if (g0[1] === 2) {
        const kickers = groups.slice(1).map(([r]) => r);
        return { category: HAND_CATEGORY.PAIR, tiebreak: [g0[0], ...kickers] };
    }
    return { category: HAND_CATEGORY.HIGH_CARD, tiebreak: ranks };
}
/** Compare two hand ranks. Positive when `a` wins, negative when `b` wins, 0 on an exact tie. */
export function compareHands(a, b) {
    if (a.category !== b.category)
        return a.category - b.category;
    const len = Math.max(a.tiebreak.length, b.tiebreak.length);
    for (let i = 0; i < len; i++) {
        const diff = (a.tiebreak[i] ?? 0) - (b.tiebreak[i] ?? 0);
        if (diff !== 0)
            return diff;
    }
    return 0;
}
/** All 5-index combinations out of `n` items, in ascending lexicographic order (n choose 5). */
function combinations5Indices(n) {
    const out = [];
    for (let a = 0; a < n; a++) {
        for (let b = a + 1; b < n; b++) {
            for (let c = b + 1; c < n; c++) {
                for (let d = c + 1; d < n; d++) {
                    for (let e = d + 1; e < n; e++) {
                        out.push([a, b, c, d, e]);
                    }
                }
            }
        }
    }
    return out;
}
/**
 * Best 5-card hand out of a 5-7 card pool (hole cards + board). Enumerates
 * every 5-card combination and keeps the maximum by `compareHands`; on a tie
 * the FIRST combination reached wins (indices walked in ascending order over
 * the input array), so `bestFive` is a deterministic, reproducible function
 * of the input order — stable for UI highlighting across identical inputs.
 */
export function evaluateBest(cards) {
    if (cards.length < 5) {
        throw new Error(`evaluateBest requires at least 5 cards, got ${cards.length}`);
    }
    if (cards.length === 5) {
        return { rank: evaluate5(cards), bestFive: cards.slice() };
    }
    let bestRank = null;
    let bestFive = null;
    for (const [a, b, c, d, e] of combinations5Indices(cards.length)) {
        const five = [cards[a], cards[b], cards[c], cards[d], cards[e]];
        const rank = evaluate5(five);
        if (bestRank === null || compareHands(rank, bestRank) > 0) {
            bestRank = rank;
            bestFive = five;
        }
    }
    return { rank: bestRank, bestFive: bestFive };
}
/** Lowercase, comma-joined hand description body (everything after capitalization is applied by `handLabel`). */
function describe(category, top, second) {
    switch (category) {
        case HAND_CATEGORY.STRAIGHT_FLUSH:
            return top === 14 ? "royal flush" : `straight flush, ${RANK_NAMES[top] ?? "unknown"} high`;
        case HAND_CATEGORY.FOUR_OF_A_KIND:
            return `four of a kind, ${rankPluralName(top)}`;
        case HAND_CATEGORY.FULL_HOUSE:
            return `full house, ${rankPluralName(top)} over ${rankPluralName(second ?? 0)}`;
        case HAND_CATEGORY.FLUSH:
            return `flush, ${RANK_NAMES[top] ?? "unknown"} high`;
        case HAND_CATEGORY.STRAIGHT:
            return `straight, ${RANK_NAMES[top] ?? "unknown"} high`;
        case HAND_CATEGORY.THREE_OF_A_KIND:
            return `three of a kind, ${rankPluralName(top)}`;
        case HAND_CATEGORY.TWO_PAIR:
            return `two pair, ${rankPluralName(top)} and ${rankPluralName(second ?? 0)}`;
        case HAND_CATEGORY.PAIR:
            return `pair of ${rankPluralName(top)}`;
        default:
            return `${RANK_NAMES[top] ?? "unknown"} high`;
    }
}
/**
 * Natural-English showdown label, e.g. "Full house, kings over nines",
 * "Straight flush, nine high", "Ace high". Royal flush is the straight flush
 * whose tiebreak top is the ace (14) — the only same-suit ace-high straight.
 */
export function handLabel(rank) {
    const [top, second] = rank.tiebreak;
    const lower = describe(rank.category, top ?? 0, second);
    return lower.charAt(0).toUpperCase() + lower.slice(1);
}
//# sourceMappingURL=hand-eval.js.map