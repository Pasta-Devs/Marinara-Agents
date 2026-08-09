import { normalizeIconNameFormat } from "../utils/icon-name-format.js";
export const DEFAULT_WORLD_CUSTOM_FIELD_ICON = "tag";
export const SUPPORTED_WORLD_CUSTOM_FIELD_ICONS = [
    "activity",
    "anchor",
    "backpack",
    "bed",
    "beer",
    "book-open",
    "building-2",
    "calendar-days",
    "car",
    "castle",
    "church",
    "clock",
    "cloud",
    "cloud-rain",
    "coffee",
    "coins",
    "compass",
    "crown",
    "drama",
    "eye",
    "factory",
    "flame",
    "gem",
    "heart",
    "home",
    "hospital",
    "key",
    "landmark",
    "lock",
    "map-pin",
    "moon",
    "mountain",
    "music",
    "package",
    "plane",
    "sailboat",
    "school",
    "scroll",
    "shield",
    "ship",
    "skull",
    "smile",
    "snowflake",
    "sparkles",
    "stars",
    "store",
    "sun",
    "sword",
    "swords",
    "tag",
    "tent",
    "thermometer",
    "train",
    "tree-pine",
    "trees",
    "umbrella",
    "user",
    "users",
    "utensils",
    "venetian-mask",
    "warehouse",
    "waves",
    "wind",
    "zap",
];
const SUPPORTED_WORLD_CUSTOM_FIELD_ICON_SET = new Set(SUPPORTED_WORLD_CUSTOM_FIELD_ICONS);
export function normalizeWorldCustomFieldIcon(value) {
    if (typeof value !== "string")
        return null;
    const normalized = normalizeIconNameFormat(value);
    return SUPPORTED_WORLD_CUSTOM_FIELD_ICON_SET.has(normalized) ? normalized : null;
}
export function normalizeWorldCustomFields(value) {
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
        const fieldValue = typeof record.value === "string" ? record.value : record.value == null ? "" : String(record.value);
        fields.push({
            name,
            value: fieldValue,
            icon: normalizeWorldCustomFieldIcon(record.icon) ?? DEFAULT_WORLD_CUSTOM_FIELD_ICON,
        });
    }
    return fields;
}
//# sourceMappingURL=tracker-custom-field-icons.js.map