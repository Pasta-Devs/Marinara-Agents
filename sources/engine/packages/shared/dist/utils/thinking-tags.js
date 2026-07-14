// ──────────────────────────────────────────────
// Inline Thinking Tags
// ──────────────────────────────────────────────
export const BUILT_IN_THINKING_TAG_PAIRS = [
    { open: "<thinking>", close: "</thinking>" },
    { open: "<think>", close: "</think>" },
    { open: "<thought>", close: "</thought>" },
    { open: "<|think|>", close: "<|/think|>" },
    { open: "<|channel>thought", close: "<channel|>" },
    { open: "[thinking]", close: "[/thinking]" },
    { open: "[think]", close: "[/think]" },
    { open: "[thought]", close: "[/thought]" },
];
const MAX_CUSTOM_THINKING_TAGS = 20;
const MAX_THINKING_TAG_LENGTH = 120;
export function normalizeThinkingTagPairs(value) {
    if (!Array.isArray(value))
        return [];
    const out = [];
    const seen = new Set();
    for (const item of value) {
        if (!item || typeof item !== "object" || Array.isArray(item))
            continue;
        const raw = item;
        const open = typeof raw.open === "string" ? raw.open.trim() : "";
        const close = typeof raw.close === "string" ? raw.close.trim() : "";
        if (!open || !close)
            continue;
        if (open.length > MAX_THINKING_TAG_LENGTH || close.length > MAX_THINKING_TAG_LENGTH)
            continue;
        const key = `${open.toLocaleLowerCase()}\u0000${close.toLocaleLowerCase()}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push({ open, close });
        if (out.length >= MAX_CUSTOM_THINKING_TAGS)
            break;
    }
    return out;
}
function toInternalThinkingTagPairs(customTags) {
    const pairs = [...BUILT_IN_THINKING_TAG_PAIRS, ...normalizeThinkingTagPairs(customTags)];
    const seen = new Set();
    return pairs
        .map((pair) => ({
        ...pair,
        openLower: pair.open.toLocaleLowerCase(),
        closeLower: pair.close.toLocaleLowerCase(),
        boundaryAfterOpen: pair.open.toLocaleLowerCase() === "<|channel>thought",
    }))
        .filter((pair) => {
        const key = `${pair.openLower}\u0000${pair.closeLower}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    })
        .sort((a, b) => b.open.length - a.open.length);
}
function countLeadingWhitespace(value) {
    let index = 0;
    while (index < value.length && /\s/.test(value[index]))
        index++;
    return index;
}
function hasOpeningBoundary(value, endIndex) {
    const next = value[endIndex];
    return !next || !/[A-Za-z0-9_]/.test(next);
}
function findLeadingOpening(value, pairs) {
    const start = countLeadingWhitespace(value);
    const lower = value.toLocaleLowerCase();
    for (const pair of pairs) {
        if (!lower.startsWith(pair.openLower, start))
            continue;
        const end = start + pair.open.length;
        if (pair.boundaryAfterOpen && !hasOpeningBoundary(value, end))
            continue;
        return { pair, start, end };
    }
    return null;
}
function isPotentialLeadingOpening(value, pairs) {
    const start = countLeadingWhitespace(value);
    if (start >= value.length)
        return true;
    const lower = value.slice(start).toLocaleLowerCase();
    return pairs.some((pair) => pair.openLower.startsWith(lower));
}
function indexOfInsensitive(value, needleLower, fromIndex = 0) {
    return value.toLocaleLowerCase().indexOf(needleLower, fromIndex);
}
/**
 * Extract leading inline reasoning blocks that some models emit instead of
 * returning provider-native thinking channels.
 */
export function extractLeadingThinkingBlocks(text, customTags) {
    let remaining = text;
    let stripped = false;
    const chunks = [];
    const pairs = toInternalThinkingTagPairs(customTags);
    while (true) {
        const opening = findLeadingOpening(remaining, pairs);
        if (!opening)
            break;
        const closeIndex = indexOfInsensitive(remaining, opening.pair.closeLower, opening.end);
        if (closeIndex < 0)
            break;
        stripped = true;
        const thinking = remaining.slice(opening.end, closeIndex).trim();
        if (thinking)
            chunks.push(thinking);
        remaining = remaining.slice(closeIndex + opening.pair.close.length).trimStart();
    }
    return {
        content: remaining,
        thinking: chunks.join("\n\n"),
        stripped,
    };
}
export function createInlineThinkingStreamFilter(customTags) {
    const pairs = toInternalThinkingTagPairs(customTags);
    const maxDetectBuffer = Math.max(32, ...pairs.map((pair) => pair.open.length + 64));
    let state = "detect";
    let buffer = "";
    let activePair = null;
    const drain = () => {
        let visible = "";
        let thinking = "";
        while (true) {
            if (state === "done") {
                visible += buffer;
                buffer = "";
                break;
            }
            if (state === "detect") {
                const opening = findLeadingOpening(buffer, pairs);
                if (opening) {
                    activePair = opening.pair;
                    buffer = buffer.slice(opening.end);
                    state = "inside";
                    continue;
                }
                if (buffer.length <= maxDetectBuffer && isPotentialLeadingOpening(buffer, pairs))
                    break;
                state = "done";
                continue;
            }
            if (!activePair) {
                state = "done";
                continue;
            }
            const closeIndex = indexOfInsensitive(buffer, activePair.closeLower);
            if (closeIndex >= 0) {
                thinking += buffer.slice(0, closeIndex);
                buffer = buffer.slice(closeIndex + activePair.close.length).trimStart();
                activePair = null;
                state = "detect";
                continue;
            }
            const holdback = Math.max(0, activePair.close.length - 1);
            const emitLength = Math.max(0, buffer.length - holdback);
            if (emitLength > 0) {
                thinking += buffer.slice(0, emitLength);
                buffer = buffer.slice(emitLength);
            }
            break;
        }
        return { visible, thinking };
    };
    return {
        push(chunk) {
            if (!chunk)
                return { visible: "", thinking: "" };
            buffer += chunk;
            return drain();
        },
        flush() {
            if (state === "detect") {
                state = "done";
            }
            return drain();
        },
        reset() {
            state = "detect";
            buffer = "";
            activePair = null;
        },
    };
}
//# sourceMappingURL=thinking-tags.js.map