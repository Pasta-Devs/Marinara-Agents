// ──────────────────────────────────────────────
// Personal Extension Types
// ──────────────────────────────────────────────
export const PERSONAL_EXTENSION_FULL_PAGE_CAPABILITY = "full_page_access";
export const PERSONAL_EXTENSION_CAPABILITIES = [
    "read_active_characters",
    "read_active_persona",
    PERSONAL_EXTENSION_FULL_PAGE_CAPABILITY,
];
export function normalizePersonalExtensionCapabilities(value) {
    if (!Array.isArray(value))
        return [];
    const requested = new Set(value);
    return PERSONAL_EXTENSION_CAPABILITIES.filter((capability) => requested.has(capability));
}
export const PERSONAL_EXTENSION_CONTRIBUTION_KINDS = ["button", "menu-item", "panel"];
export const PERSONAL_EXTENSION_CONTRIBUTION_SURFACES = [
    "top-bar",
    "chats",
    "bots",
    "characters",
    "personas",
    "lorebooks",
    "presets",
    "connections",
    "agents",
    "settings",
];
export const PERSONAL_EXTENSION_CONTRIBUTION_POSITIONS = ["header", "before-content", "after-content"];
export const PERSONAL_EXTENSION_UI_ELEMENT_KINDS = [
    "heading",
    "text",
    "pre",
    "button",
    "input",
    "select",
    "toggle",
    "slider",
    "color",
    "spacer",
];
export const PERSONAL_EXTENSION_UI_LIMITS = {
    contributionsPerExtension: 24,
    panelElements: 60,
    idLength: 64,
    iconLength: 64,
    labelLength: 80,
    descriptionLength: 240,
    textLength: 8_000,
    totalPanelTextLength: 32_000,
    selectOptions: 100,
};
//# sourceMappingURL=personal-extension.js.map