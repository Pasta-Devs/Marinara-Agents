export function normalizeTextForMatch(value) {
    return typeof value === "string" ? value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/gu, " ") : "";
}
export function includesTextForMatch(value, query) {
    const normalizedQuery = normalizeTextForMatch(query);
    if (!normalizedQuery)
        return true;
    return normalizeTextForMatch(value).includes(normalizedQuery);
}
export function startsWithTextForMatch(value, query) {
    const normalizedQuery = normalizeTextForMatch(query);
    if (!normalizedQuery)
        return true;
    return normalizeTextForMatch(value).startsWith(normalizedQuery);
}
//# sourceMappingURL=text-matching.js.map