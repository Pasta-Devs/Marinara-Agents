export function normalizeIconNameFormat(value) {
    return value
        .trim()
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/[\s_]+/g, "-")
        .replace(/-+/g, "-")
        .toLowerCase();
}
//# sourceMappingURL=icon-name-format.js.map