export function formatCustomTrackerFieldForPrompt(field) {
    if (!field || typeof field !== "object" || Array.isArray(field))
        return "- Field: ";
    const trackerField = field;
    const name = typeof trackerField.name === "string" ? trackerField.name : "Field";
    const value = typeof trackerField.value === "string" ? trackerField.value : "";
    const lockLabel = trackerField.locked === true ? " (locked)" : "";
    return `- ${name}: ${value}${lockLabel}`;
}
//# sourceMappingURL=custom-tracker-fields.js.map