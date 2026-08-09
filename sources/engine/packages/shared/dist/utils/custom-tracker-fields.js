export function formatCustomTrackerFieldForPrompt(field) {
    if (!field || typeof field !== "object" || Array.isArray(field))
        return "- Field: ";
    const trackerField = field;
    const name = typeof trackerField.name === "string" ? trackerField.name : "Field";
    const value = typeof trackerField.value === "string" ? trackerField.value : "";
    const lockLabel = trackerField.locked === true ? " (locked)" : "";
    return `- ${name}: ${value}${lockLabel}`;
}
export function normalizeCharacterTrackerCustomFieldDefaults(value) {
    if (!Array.isArray(value))
        return [];
    const fields = [];
    const seenNames = new Set();
    for (const raw of value) {
        if (!raw || typeof raw !== "object" || Array.isArray(raw))
            continue;
        const record = raw;
        const name = typeof record.name === "string" ? record.name.trim() : "";
        if (!name)
            continue;
        const comparableName = name.normalize("NFKC").toLocaleLowerCase("en-US").replace(/\s+/gu, " ");
        if (seenNames.has(comparableName))
            continue;
        seenNames.add(comparableName);
        fields.push({
            name,
            value: typeof record.value === "string" ? record.value : record.value == null ? "" : String(record.value),
        });
    }
    return fields;
}
export function characterTrackerCustomFieldDefaultsToRecord(value) {
    return Object.fromEntries(normalizeCharacterTrackerCustomFieldDefaults(value).map((field) => [field.name, field.value]));
}
//# sourceMappingURL=custom-tracker-fields.js.map