const GAME_STATE_TEXT_OBJECT_KEYS = [
    "name",
    "label",
    "title",
    "value",
    "text",
    "description",
    "summary",
    "current",
    "location",
    "weather",
    "temperature",
    "date",
    "time",
    "timeOfDay",
    "condition",
    "type",
];
export const GAME_STATE_TEXT_FIELDS = ["date", "time", "location", "weather", "temperature"];
export function coerceGameStateTextValue(value) {
    return coerceGameStateTextValueInner(value, new WeakSet());
}
export function coerceGameStateTextFields(fields) {
    const coerced = {};
    for (const field of GAME_STATE_TEXT_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(fields, field)) {
            coerced[field] = coerceGameStateTextValue(fields[field]);
        }
    }
    return coerced;
}
function coerceGameStateTextValueInner(value, seen) {
    if (value === null || value === undefined)
        return null;
    if (typeof value === "string") {
        const text = value.trim();
        return text.length > 0 ? text : null;
    }
    if (typeof value === "number" || typeof value === "bigint")
        return String(value);
    if (typeof value === "boolean" || typeof value === "symbol" || typeof value === "function")
        return null;
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value.toISOString();
    }
    if (Array.isArray(value)) {
        const parts = value
            .map((entry) => coerceGameStateTextValueInner(entry, seen))
            .filter((entry) => entry !== null);
        return parts.length > 0 ? parts.join(", ") : null;
    }
    if (typeof value !== "object")
        return null;
    if (seen.has(value))
        return null;
    seen.add(value);
    const record = value;
    for (const key of GAME_STATE_TEXT_OBJECT_KEYS) {
        const text = coerceGameStateTextValueInner(record[key], seen);
        if (text)
            return text;
    }
    const scalarParts = Object.entries(record)
        .map(([key, entry]) => {
        if (entry === null || entry === undefined || typeof entry === "object")
            return null;
        const text = coerceGameStateTextValueInner(entry, seen);
        return text ? `${key}: ${text}` : null;
    })
        .filter((entry) => entry !== null);
    if (scalarParts.length === 1)
        return scalarParts[0];
    if (scalarParts.length > 1 && scalarParts.length <= 3)
        return scalarParts.join(", ");
    return null;
}
//# sourceMappingURL=game-state-text.js.map