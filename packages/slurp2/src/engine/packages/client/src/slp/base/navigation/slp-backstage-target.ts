/**
 * In order of use. Basic is the whole app; the extension sections after it each own one add-on
 * (docs/CONFIGURATOR.md). The sidebar puts a heading before the first extension.
 */
export const SLP_BACKSTAGE_SECTIONS = [
  "overview",
  "basic",
  "creators",
  "spice",
  "prompts",
  "ads",
  "content",
  "world",
  "stir",
  "live",
  "engine",
] as const;
export type SlpBackstageSection = (typeof SLP_BACKSTAGE_SECTIONS)[number];

/** The sections that hold one extension each, in sidebar order. */
export const SLP_BACKSTAGE_EXTENSION_SECTIONS: readonly SlpBackstageSection[] = [
  "ads",
  "content",
  "world",
  "stir",
  "live",
  "engine",
];

/**
 * Overview is the only hub. The Posting, Stories and World landing pages and the separate Backup
 * page were removed in 0.2.74; saved navigation that names one falls back to its section's page.
 */
export const SLP_BACKSTAGE_TARGETS = [
  "overview",
  "basic",
  "creators",
  "improve",
  "tags",
  "events",
  "storylines",
  "calendar",
  "arcs",
  "packs",
  "drama",
  "messaging",
  "audience",
  "ads",
  "wallet",
  "general",
  "images",
  "connections",
  "engine",
  "spice",
  "prompts",
  "autopurge",
  "stir",
  "live",
] as const;
export type SlpBackstageTarget = (typeof SLP_BACKSTAGE_TARGETS)[number];

/**
 * Basic's first page is the short one; the pages after it are its "More for …" depth and open
 * from that page, not from a row of tabs.
 */
export const SLP_BACKSTAGE_TARGETS_BY_SECTION: Record<SlpBackstageSection, readonly SlpBackstageTarget[]> = {
  overview: ["overview"],
  basic: ["basic", "connections", "general", "audience", "images", "messaging", "wallet", "autopurge"],
  creators: ["creators", "improve", "tags"],
  spice: ["spice"],
  prompts: ["prompts"],
  ads: ["ads"],
  content: ["storylines", "arcs", "packs", "drama"],
  world: ["events", "calendar"],
  stir: ["stir"],
  live: ["live"],
  engine: ["engine"],
};

export const SLP_BACKSTAGE_DEFAULT_TARGET: Record<SlpBackstageSection, SlpBackstageTarget> = {
  overview: "overview",
  basic: "basic",
  creators: "creators",
  spice: "spice",
  prompts: "prompts",
  ads: "ads",
  content: "storylines",
  world: "events",
  stir: "stir",
  live: "live",
  engine: "engine",
};

export const SLP_BACKSTAGE_SECTION_LABELS: Record<SlpBackstageSection, string> = {
  overview: "Overview",
  basic: "Basic",
  creators: "Creators",
  spice: "Spice",
  prompts: "Writing",
  ads: "Brands & ads",
  content: "Storylines",
  world: "Living world",
  stir: "Support desk",
  live: "Live shows",
  engine: "Engine link",
};

export const SLP_BACKSTAGE_TARGET_LABELS: Record<SlpBackstageTarget, string> = {
  overview: "Overview",
  basic: "Basic",
  creators: "All creators",
  improve: "Improve with AI",
  tags: "Tags",
  events: "Events",
  storylines: "Rules",
  calendar: "Calendar",
  arcs: "Types",
  packs: "Packs",
  drama: "Drama & love",
  messaging: "Messages",
  audience: "Crowd",
  ads: "Ads",
  wallet: "Coins",
  general: "How busy",
  images: "Pictures",
  connections: "Connections",
  engine: "Engine link",
  spice: "Spice",
  prompts: "Prompts",
  autopurge: "Storage and backup",
  stir: "Support desk",
  live: "Live shows",
};

export function destinationForTarget(target: SlpBackstageTarget): SlpBackstageSection {
  return (
    SLP_BACKSTAGE_SECTIONS.find(
      (section) =>
        SLP_BACKSTAGE_TARGETS_BY_SECTION[section].includes(target) || SLP_BACKSTAGE_DEFAULT_TARGET[section] === target,
    ) ?? "overview"
  );
}

/** Old section names, from saved navigation, and the page each one opens now. */
export const SLP_LEGACY_SETTINGS_DESTINATION = {
  overview: { section: "overview", target: "overview" },
  creators: { section: "creators", target: "creators" },
  tags: { section: "creators", target: "tags" },
  arcs: { section: "content", target: "storylines" },
  messaging: { section: "basic", target: "messaging" },
  audience: { section: "basic", target: "audience" },
  ads: { section: "ads", target: "ads" },
  wallet: { section: "basic", target: "wallet" },
  general: { section: "basic", target: "general" },
  images: { section: "basic", target: "images" },
  autopurge: { section: "basic", target: "autopurge" },
  advanced: { section: "basic", target: "autopurge" },
  models: { section: "basic", target: "connections" },
  automation: { section: "basic", target: "general" },
  fans: { section: "basic", target: "audience" },
  maintenance: { section: "basic", target: "autopurge" },
} as const satisfies Record<string, { section: SlpBackstageSection; target: SlpBackstageTarget }>;

export function isSlpBackstageSection(value: unknown): value is SlpBackstageSection {
  return typeof value === "string" && SLP_BACKSTAGE_SECTIONS.includes(value as SlpBackstageSection);
}

export function isSlpBackstageTarget(value: unknown): value is SlpBackstageTarget {
  return typeof value === "string" && SLP_BACKSTAGE_TARGETS.includes(value as SlpBackstageTarget);
}

export function targetBelongsToSection(section: SlpBackstageSection, target: SlpBackstageTarget): boolean {
  return SLP_BACKSTAGE_TARGETS_BY_SECTION[section].includes(target) || SLP_BACKSTAGE_DEFAULT_TARGET[section] === target;
}

/**
 * A page always shows under the section that holds it. Callers and saved state may name an older
 * section for a page (World for Audience, Posting for Connections); the page decides.
 */
export function slpBackstageSectionFor(
  section: SlpBackstageSection,
  target: SlpBackstageTarget | undefined,
): SlpBackstageSection {
  return target && !targetBelongsToSection(section, target) ? destinationForTarget(target) : section;
}
