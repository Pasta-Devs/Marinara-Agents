export const SLP_BACKSTAGE_SECTIONS = [
  "overview",
  "creators",
  "world",
  "content",
  "automation",
  "prompts",
  "maintenance",
] as const;
export type SlpBackstageSection = (typeof SLP_BACKSTAGE_SECTIONS)[number];

export const SLP_BACKSTAGE_TARGETS = [
  "overview",
  "creators",
  "improve",
  "world",
  "content",
  "tags",
  "events",
  "calendar",
  "arcs",
  "packs",
  "messaging",
  "audience",
  "ads",
  "wallet",
  "automation",
  "general",
  "images",
  "prompts",
  "autopurge",
  "advanced",
] as const;
export type SlpBackstageTarget = (typeof SLP_BACKSTAGE_TARGETS)[number];

export const SLP_BACKSTAGE_TARGETS_BY_SECTION: Record<SlpBackstageSection, readonly SlpBackstageTarget[]> = {
  overview: ["overview"],
  creators: ["creators", "improve"],
  world: ["world", "tags", "audience", "messaging", "ads", "wallet"],
  content: ["calendar", "events", "arcs", "packs"],
  automation: ["automation", "general", "images"],
  prompts: ["prompts"],
  maintenance: ["autopurge", "advanced"],
};

export const SLP_BACKSTAGE_DEFAULT_TARGET: Record<SlpBackstageSection, SlpBackstageTarget> = {
  overview: "overview",
  creators: "creators",
  world: "world",
  content: "content",
  automation: "automation",
  prompts: "prompts",
  maintenance: "autopurge",
};

export const SLP_BACKSTAGE_SECTION_LABELS: Record<SlpBackstageSection, string> = {
  overview: "Overview",
  creators: "Creators",
  world: "Features",
  content: "Content library",
  automation: "Publishing and automation",
  prompts: "Prompts",
  maintenance: "Maintenance",
};

export const SLP_BACKSTAGE_TARGET_LABELS: Record<SlpBackstageTarget, string> = {
  overview: "Overview",
  creators: "Creator management",
  improve: "Improve with AI",
  world: "All areas",
  automation: "Automation overview",
  tags: "Discovery",
  events: "Occasions",
  calendar: "Calendar",
  arcs: "Plan templates",
  packs: "Packs",
  messaging: "Messaging rules",
  audience: "Audience",
  ads: "Ads",
  wallet: "Coins and access",
  general: "Publishing",
  images: "Image generation",
  prompts: "Prompts",
  autopurge: "Storage and cleanup",
  advanced: "Backup and data",
};

export function destinationForTarget(target: SlpBackstageTarget): SlpBackstageSection {
  return (
    SLP_BACKSTAGE_SECTIONS.find((section) => SLP_BACKSTAGE_TARGETS_BY_SECTION[section].includes(target)) ?? "overview"
  );
}

export const SLP_LEGACY_SETTINGS_DESTINATION = {
  overview: { section: "overview", target: "overview" },
  creators: { section: "creators", target: "creators" },
  tags: { section: "world", target: "tags" },
  arcs: { section: "automation", target: "general" },
  messaging: { section: "world", target: "messaging" },
  audience: { section: "world", target: "audience" },
  ads: { section: "world", target: "ads" },
  wallet: { section: "world", target: "wallet" },
  general: { section: "automation", target: "general" },
  images: { section: "automation", target: "images" },
  autopurge: { section: "maintenance", target: "autopurge" },
  advanced: { section: "maintenance", target: "advanced" },
} as const satisfies Record<string, { section: SlpBackstageSection; target: SlpBackstageTarget }>;

export function isSlpBackstageSection(value: unknown): value is SlpBackstageSection {
  return typeof value === "string" && SLP_BACKSTAGE_SECTIONS.includes(value as SlpBackstageSection);
}

export function isSlpBackstageTarget(value: unknown): value is SlpBackstageTarget {
  return typeof value === "string" && SLP_BACKSTAGE_TARGETS.includes(value as SlpBackstageTarget);
}

export function targetBelongsToSection(section: SlpBackstageSection, target: SlpBackstageTarget): boolean {
  return SLP_BACKSTAGE_TARGETS_BY_SECTION[section].includes(target);
}
