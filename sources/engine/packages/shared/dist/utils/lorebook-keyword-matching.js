// Pure keyword-matching helpers for lorebook entries.
// Server scanning and the in-editor keyword-test preview share these so the
// preview cannot drift from the real activation rules.
import { isPatternSafe } from "./regex-safety.js";
const defaultRegexExecutor = (regex, text) => regex.test(text);
const unicodeWordCharacter = /[\p{L}\p{N}_]/u;
function literalMatch(keyword, text, options) {
    const trimmedKeyword = keyword.trim();
    if (!trimmedKeyword)
        return false;
    const needle = options.caseSensitive ? trimmedKeyword : trimmedKeyword.toLocaleLowerCase();
    const haystack = options.caseSensitive ? text : text.toLocaleLowerCase();
    return haystack.includes(needle);
}
function readPreviousCodePoint(text, index) {
    if (index <= 0)
        return "";
    const before = text.slice(0, index);
    return Array.from(before).pop() ?? "";
}
function readNextCodePoint(text, index) {
    if (index >= text.length)
        return "";
    return Array.from(text.slice(index))[0] ?? "";
}
function isUnicodeWordCharacter(value) {
    return value.length > 0 && unicodeWordCharacter.test(value);
}
/** Test whether a single keyword would match the given text under the given options. */
export function testKeyword(keyword, text, options) {
    const trimmedKeyword = keyword.trim();
    if (!trimmedKeyword)
        return false;
    try {
        if (options.useRegex) {
            // Static ReDoS guard: refuse to compile patterns with nested quantifiers,
            // pathological repetition counts, or oversized sources. Fall back to literal
            // substring match — same posture as the existing invalid-regex catch below.
            if (!isPatternSafe(trimmedKeyword)) {
                return literalMatch(trimmedKeyword, text, options);
            }
            const flags = options.caseSensitive ? "g" : "gi";
            const regex = new RegExp(trimmedKeyword, flags);
            const exec = options.regexExecutor ?? defaultRegexExecutor;
            return exec(regex, text);
        }
        if (options.matchWholeWords) {
            const needle = options.caseSensitive ? trimmedKeyword : trimmedKeyword.toLocaleLowerCase();
            const haystack = options.caseSensitive ? text : text.toLocaleLowerCase();
            const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regex = new RegExp(escaped, "gu");
            // No regexExecutor here — pattern is built from escaped-literal text, can't ReDoS.
            for (const match of haystack.matchAll(regex)) {
                const start = match.index ?? -1;
                if (start < 0)
                    continue;
                const end = start + match[0].length;
                if (!isUnicodeWordCharacter(readPreviousCodePoint(haystack, start)) &&
                    !isUnicodeWordCharacter(readNextCodePoint(haystack, end))) {
                    return true;
                }
            }
            return false;
        }
        return literalMatch(trimmedKeyword, text, options);
    }
    catch {
        // Invalid regex or executor failure — fall back to plain substring
        return literalMatch(trimmedKeyword, text, options);
    }
}
/** Primary key set: any single key matching counts as a match. */
export function testPrimaryKeys(keys, text, options) {
    const matchedKeys = [];
    for (const key of keys) {
        if (testKeyword(key, text, options)) {
            matchedKeys.push(key);
        }
    }
    return { matched: matchedKeys.length > 0, matchedKeys };
}
/** Secondary key set with selective logic. Empty list passes. */
export function testSecondaryKeys(secondaryKeys, text, logic, options) {
    if (secondaryKeys.length === 0)
        return true;
    const results = secondaryKeys.map((key) => testKeyword(key, text, options));
    switch (logic) {
        case "and":
        case "or":
            return results.some(Boolean);
        case "and_all":
            return results.every(Boolean);
        case "not":
            return !results.some(Boolean);
        case "not_all":
            return !results.every(Boolean);
        default:
            return true;
    }
}
//# sourceMappingURL=lorebook-keyword-matching.js.map