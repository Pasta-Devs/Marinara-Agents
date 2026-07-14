// ──────────────────────────────────────────────
// Poker — standard 52-card deck
// ──────────────────────────────────────────────
export const SUITS = ["c", "d", "h", "s"];
/** Ranks low to high: 2..10, then jack (11), queen (12), king (13), ace (14). */
export const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
/** Singular rank name, e.g. RANK_NAMES[14] === "ace". */
export const RANK_NAMES = {
    2: "two",
    3: "three",
    4: "four",
    5: "five",
    6: "six",
    7: "seven",
    8: "eight",
    9: "nine",
    10: "ten",
    11: "jack",
    12: "queen",
    13: "king",
    14: "ace",
};
/** Single-character rank code used in compact card codes, e.g. RANK_CODE[10] === "T". */
const RANK_CODE = {
    2: "2",
    3: "3",
    4: "4",
    5: "5",
    6: "6",
    7: "7",
    8: "8",
    9: "9",
    10: "T",
    11: "J",
    12: "Q",
    13: "K",
    14: "A",
};
const SUIT_NAMES = {
    c: "Clubs",
    d: "Diamonds",
    h: "Hearts",
    s: "Spades",
};
const SUIT_SYMBOLS = {
    c: "♣",
    d: "♦",
    h: "♥",
    s: "♠",
};
/** Plurals that don't just take a trailing "s" (e.g. "six" -> "sixes", not "sixs"). */
const IRREGULAR_PLURALS = {
    6: "sixes",
};
/** Build a fresh, ORDERED standard 52-card deck (caller shuffles). Deterministic order: suit-major, rank-minor. */
export function buildDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({ rank, suit });
        }
    }
    return deck;
}
/** Compact two-character code, e.g. "Ah", "Td", "9c". Rank is uppercase, suit is lowercase. */
export function cardCode(card) {
    return `${RANK_CODE[card.rank] ?? "?"}${card.suit}`;
}
/**
 * Parse a compact card code. Tolerant of case ("ah" === "AH") and accepts
 * "10" as an alternate spelling of "T" for ten (e.g. "10h"). Returns `null`
 * for anything that doesn't resolve to a real card.
 */
export function cardFromCode(code) {
    const trimmed = code.trim();
    if (trimmed.length < 2)
        return null;
    const suitChar = trimmed.slice(-1).toLowerCase();
    const suit = SUITS.find((s) => s === suitChar);
    if (!suit)
        return null;
    let rankPart = trimmed.slice(0, -1).toUpperCase();
    if (rankPart === "10")
        rankPart = "T";
    const rank = RANKS.find((r) => RANK_CODE[r] === rankPart);
    if (rank === undefined)
        return null;
    return { rank, suit };
}
/** Full English label, e.g. "Ace of Hearts", "Ten of Diamonds". */
export function cardLabel(card) {
    const name = RANK_NAMES[card.rank] ?? "unknown";
    const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
    return `${capitalized} of ${SUIT_NAMES[card.suit]}`;
}
/** Compact display with a unicode suit glyph, e.g. "A♥", "T♦". */
export function cardShort(card) {
    return `${RANK_CODE[card.rank] ?? "?"}${SUIT_SYMBOLS[card.suit]}`;
}
/** Plural rank name for hand labels, e.g. rankPluralName(13) === "kings", rankPluralName(6) === "sixes". */
export function rankPluralName(rank) {
    const irregular = IRREGULAR_PLURALS[rank];
    if (irregular)
        return irregular;
    const base = RANK_NAMES[rank] ?? "unknown";
    return `${base}s`;
}
//# sourceMappingURL=deck.js.map