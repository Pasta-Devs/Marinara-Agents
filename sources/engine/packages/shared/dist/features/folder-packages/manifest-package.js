// ──────────────────────────────────────────────
// Folder-shaped import/export packages
// ──────────────────────────────────────────────
export function isJsonRecord(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
export function sanitizeFolderSegment(value, fallback) {
    const safe = value
        .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/[^a-zA-Z0-9._ -]+/g, "")
        .replace(/\s+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
    return safe || fallback;
}
export function createFolderEntry({ folderName, itemName, itemKind, config, fallbackName, }) {
    const segment = sanitizeFolderSegment(itemName, fallbackName);
    return {
        path: `${folderName}/${segment}/manifest.json`,
        manifest: {
            kind: itemKind,
            version: 1,
            config,
        },
    };
}
export function getFolderManifestConfig(entry) {
    if (!isJsonRecord(entry))
        return null;
    const manifest = isJsonRecord(entry.manifest) ? entry.manifest : entry;
    if (typeof manifest.type === "string" && manifest.version === 1)
        return manifest;
    if (isJsonRecord(manifest.config))
        return manifest.config;
    if (typeof manifest.kind === "string" && isJsonRecord(manifest.data))
        return manifest.data;
    return manifest;
}
export function getFolderImportEntries(parsed, keys) {
    if (Array.isArray(parsed))
        return parsed;
    if (!isJsonRecord(parsed))
        return [];
    for (const key of keys) {
        const value = parsed[key];
        if (Array.isArray(value))
            return value;
    }
    return [parsed];
}
//# sourceMappingURL=manifest-package.js.map