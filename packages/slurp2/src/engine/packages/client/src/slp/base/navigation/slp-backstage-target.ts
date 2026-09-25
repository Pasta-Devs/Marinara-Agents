/** In order of use; Connections sits right under Overview so a model is one click away. */
export const SLP_BACKSTAGE_SECTIONS = [
  "overview",
  "models",
  "creators",
  "automation",
  "content",
  "world",
  "fans",
  "prompts",
  "maintenance",
] as const;
export type SlpBackstageSection = (typeof SLP_BACKSTAGE_SECTIONS)[number];

/**
 * Overview is the only hub. The Posting, Stories and World landing pages and the separate Backup
 * page were removed in 0.2.74; saved navigation that names one falls back to its section's page.
 */
export const SLP_BACKSTAGE_TARGETS = [
  "overview",
  "creators",
  "improve",
  "tags",
  "events",
  "storylines",
  "calendar",
  "arcs",
  "packs",
  "messaging",
  "audience",
  "ads",
  "wallet",
  "general",
  "images",
  "connections",
  "prompts",
  "autopurge",
] as const;
export type SlpBackstageTarget = (typeof SLP_BACKSTAGE_TARGETS)[number];

export const SLP_BACKSTAGE_TARGETS_BY_SECTION: Record<SlpBackstageSection, readonly SlpBackstageTarget[]> = {
  overview: ["overview"],
  models: ["connections", "images"],
  creators: ["creators", "improve"],
  automation: ["general"],
  content: ["storylines", "arcs", "packs"],
  world: ["events", "calendar"],
  fans: ["audience", "messaging", "wallet", "ads", "tags"],
  prompts: ["prompts"],
  maintenance: ["autopurge"],
};

export const SLP_BACKSTAGE_DEFAULT_TARGET: Record<SlpBackstageSection, SlpBackstageTarget> = {
  overview: "overview",
  models: "connections",
  creators: "creators",
  world: "events",
  fans: "audience",
  content: "storylines",
  automation: "general",
  prompts: "prompts",
  maintenance: "autopurge",
};

export const SLP_BACKSTAGE_SECTION_LABELS: Record<SlpBackstageSection, string> = {
  overview: "Overview",
  models: "Connections",
  creators: "Creators",
  world: "World",
  fans: "Fans & money",
  content: "Storylines",
  automation: "Posting",
  prompts: "Writing",
  maintenance: "Maintenance",
};

export const SLP_BACKSTAGE_TARGET_LABELS: Record<SlpBackstageTarget, string> = {
  overview: "Overview",
  creators: "All creators",
  improve: "Improve with AI",
  tags: "Tags",
  events: "Events",
  storylines: "Rules",
  calendar: "Calendar",
  arcs: "Types",
  packs: "Packs",
  messaging: "Messages",
  audience: "Audience",
  ads: "Ads",
  wallet: "Coins",
  general: "Publishing",
  images: "Images",
  connections: "Text & chats",
  prompts: "Prompts",
  autopurge: "Storage and backup",
};

export function destinationForTarget(target: SlpBackstageTarget): SlpBackstageSection {
  return (
    SLP_BACKSTAGE_SECTIONS.find(
      (section) =>
        SLP_BACKSTAGE_TARGETS_BY_SECTION[section].includes(target) || SLP_BACKSTAGE_DEFAULT_TARGET[section] === target,
    ) ?? "overview"
  );
}

export const SLP_LEGACY_SETTINGS_DESTINATION = {
  overview: { section: "overview", target: "overview" },
  creators: { section: "creators", target: "creators" },
  tags: { section: "fans", target: "tags" },
  arcs: { section: "content", target: "storylines" },
  messaging: { section: "fans", target: "messaging" },
  audience: { section: "fans", target: "audience" },
  ads: { section: "fans", target: "ads" },
  wallet: { section: "fans", target: "wallet" },
  general: { section: "automation", target: "general" },
  images: { section: "models", target: "images" },
  autopurge: { section: "maintenance", target: "autopurge" },
  advanced: { section: "maintenance", target: "autopurge" },
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
