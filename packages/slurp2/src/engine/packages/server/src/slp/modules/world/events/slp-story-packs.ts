import { createHash, randomUUID } from "node:crypto";

import {
  SLP_STORY_PACK_FORMAT,
  SLP_STORY_PACK_SCHEMA_VERSION,
  SLP_STORY_PACK_MAX_BYTES,
  slpArcBlueprintSchema,
  slpEventBlueprintSchema,
  slpStoryPackSchema,
  type SlpArcBlueprint,
  type SlpEventBlueprint,
  type SlpStoryPack,
  type SlpStoryProvenance,
} from "../../../../../../shared/src/slp/slp-story-engine.js";
import type { SlurpArcType } from "../../projects/slp-project.js";
import type { SlurpPlatformEvent } from "../../../../../../shared/src/slp/slp-platform-events.js";
import { SLURP_ARC_LIBRARY_SEED } from "../../projects/slp-arc-library.js";
import { slurpPlatformEventsDefault } from "../../../../../../shared/src/slp/slp-platform-events.js";

export type SlpStoryPackPreviewEntry = {
  kind: "arc" | "event";
  contentId: string;
  name: string;
  status: "new" | "update" | "local-edit" | "conflict" | "invalid";
  selected: boolean;
  warnings: string[];
  error?: string;
  value?: SlpArcBlueprint | SlpEventBlueprint;
};

export type SlpStoryPackPreview = {
  pack: Pick<SlpStoryPack, "id" | "version" | "name" | "description" | "author">;
  entries: SlpStoryPackPreviewEntry[];
  warnings: string[];
};

const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value as Record<string, unknown>)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, item]) => [key, canonical(item)]),
        )
      : value;
const hash = (value: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");

function stripLocal(value: SlpArcBlueprint | SlpEventBlueprint) {
  const clean = structuredClone(value) as SlpArcBlueprint | SlpEventBlueprint;
  delete clean.provenance;
  if ("target" in clean && clean.target.kind === "selected") {
    clean.target = { kind: "all" };
  }
  return clean;
}

/**
 * What the pack author wrote, without the parts the install owns. The local id, the on/off switch,
 * the automation choice and the built-in flags all change on import, so hashing them would mark
 * every freshly imported entry as locally edited and hide real updates behind a false conflict.
 */
function contentFingerprint(value: SlpArcBlueprint | SlpEventBlueprint): number {
  const clean = stripLocal(value) as Record<string, unknown>;
  delete clean.id;
  delete clean.enabled;
  delete clean.automation;
  delete clean.builtin;
  delete clean.hidden;
  return hash(clean);
}

function provenance(
  pack: Pick<SlpStoryPack, "id" | "version">,
  entry: SlpArcBlueprint | SlpEventBlueprint,
): SlpStoryProvenance {
  const contentId = entry.contentId ?? entry.id;
  return { packId: pack.id, contentId, packVersion: pack.version, contentHash: contentFingerprint(entry) };
}

function pack(
  id: string,
  name: string,
  description: string,
  arcs: SlpArcBlueprint[],
  events: SlpEventBlueprint[],
): SlpStoryPack {
  return slpStoryPackSchema.parse({
    format: SLP_STORY_PACK_FORMAT,
    schemaVersion: SLP_STORY_PACK_SCHEMA_VERSION,
    id,
    version: "1.0.0",
    name,
    description,
    author: "Slurp Remastered",
    arcs,
    events,
  });
}

function arc(
  contentId: string,
  name: string,
  description: string,
  storyTags: string[],
  chapters: string[],
): SlpArcBlueprint {
  return slpArcBlueprintSchema.parse({
    id: `pack-${contentId}`,
    contentId,
    name,
    description,
    storyTags,
    chapters: chapters.map((label) => ({ label, minDays: 2, maxDays: 7 })),
    tags: [],
    enabled: false,
  });
}

function campaign(contentId: string, name: string, guidance: string, storyTags: string[]): SlpEventBlueprint {
  return slpEventBlueprintSchema.parse({
    id: `pack-${contentId}`,
    contentId,
    name,
    guidance,
    storyTags,
    enabled: false,
    activation: { kind: "manual", durationDays: 7 },
    target: { kind: "all" },
  });
}

const CAREER = [
  arc(
    "project-launch",
    "Launching a project",
    "A public project moves from announcement through launch and aftermath.",
    ["career", "launch"],
    ["the announcement", "making it real", "launch day", "the response", "what comes next"],
  ),
  arc(
    "viral-hit",
    "A surprise viral hit",
    "One post suddenly reaches far beyond the usual audience.",
    ["career", "viral"],
    ["the post takes off", "everybody is looking", "the pressure", "settling into the new normal"],
  ),
  arc(
    "big-collaboration",
    "A big collaboration",
    "Two Creators plan, make, and release something together.",
    ["career", "collaboration"],
    ["the invitation", "planning together", "making it", "the release", "the callback"],
  ),
  arc(
    "convention-weekend",
    "Convention weekend",
    "Preparing for, attending, and recovering from a public convention.",
    ["career", "travel", "performance"],
    ["getting ready", "arrival", "the convention", "the last night", "home again"],
  ),
  arc(
    "creative-block",
    "Creative block",
    "Ideas stop coming easily and the Creator has to find a way through.",
    ["career", "pressure"],
    ["nothing lands", "trying too hard", "stepping back", "a small spark", "making again"],
  ),
  arc(
    "burnout-comeback",
    "Burnout and comeback",
    "A needed break becomes a deliberate return.",
    ["career", "recovery"],
    ["running empty", "going quiet", "life off-camera", "testing the waters", "the comeback"],
  ),
];

const RELATIONSHIPS = [
  arc(
    "new-friendship",
    "A new friendship",
    "A recurring acquaintance slowly becomes part of everyday life.",
    ["relationship", "community"],
    ["meeting properly", "an easy second time", "inside jokes", "showing up", "real friends"],
  ),
  arc(
    "relationship-soft-launch",
    "A relationship soft launch",
    "Hints become a careful public reveal.",
    ["relationship", "romance"],
    ["somebody keeps appearing", "fans notice", "the almost reveal", "saying it plainly", "life after the reveal"],
  ),
  arc(
    "falling-out",
    "A falling-out",
    "A disagreement changes a once-close connection.",
    ["relationship", "conflict"],
    ["something feels wrong", "the argument", "distance", "deciding what matters"],
  ),
  arc(
    "reunion",
    "A reunion",
    "Someone important returns after a long absence.",
    ["relationship", "reunion"],
    ["the message", "meeting again", "what changed", "making room for each other"],
  ),
  arc(
    "mentor-mentee",
    "Mentor and mentee",
    "A Creator begins teaching or learning from someone else.",
    ["relationship", "career"],
    ["the offer", "first lesson", "a hard correction", "independence", "equals"],
  ),
  arc(
    "community-fundraiser",
    "Community fundraiser",
    "The audience gathers around a cause and a shared goal.",
    ["community", "charity"],
    ["choosing the cause", "the announcement", "the hard middle", "the final push", "what it changed"],
  ),
];

const PLATFORM_PULSE = [
  campaign("collaboration-week", "Collaboration week", "Creators are pairing up and audiences expect crossovers.", [
    "collaboration",
    "community",
  ]),
  campaign("flash-sale", "Flash sale", "A short site-wide promotion is running.", ["sale", "career"]),
  campaign(
    "viral-challenge",
    "Viral challenge",
    "A platform challenge is spreading and Creators may put their own spin on it.",
    ["viral", "community"],
  ),
  campaign("awards-week", "Awards week", "Nominations, outfits, speculation, and celebrations fill the platform.", [
    "awards",
    "performance",
  ]),
  campaign("charity-drive", "Charity drive", "The platform is gathering around a shared cause.", [
    "charity",
    "community",
  ]),
  campaign("algorithm-shake-up", "Algorithm shake-up", "Reach feels unpredictable and Creators are comparing notes.", [
    "pressure",
    "career",
  ]),
];

const SEASONS = [
  campaign("heatwave", "Heatwave", "A spell of unusually hot weather changes plans and routines.", [
    "weather",
    "summer",
  ]),
  campaign("stormy-weekend", "Stormy weekend", "Bad weather keeps people inside and online.", ["weather", "cozy"]),
  campaign("first-snow", "First snow", "The first snow of the season changes the view outside.", ["weather", "winter"]),
  campaign("spring-cleaning", "Spring-cleaning week", "People are clearing rooms, wardrobes, and old habits.", [
    "home",
    "spring",
  ]),
  campaign("summer-escape", "Summer escape", "Travel plans and days outside are taking over feeds.", [
    "travel",
    "summer",
  ]),
  campaign("cozy-winter", "Cosy winter week", "Warm rooms, slow evenings, and staying close to home fit the week.", [
    "cozy",
    "winter",
  ]),
];

const FESTIVAL_ARCS = [
  arc(
    "festival-booking",
    "Getting booked",
    "An invitation turns into a real festival appearance.",
    ["festival", "career"],
    ["the invitation", "preparing the set", "travel day", "the performance", "afterwards"],
  ),
  arc(
    "festival-road",
    "Road to the festival",
    "The journey becomes part of the story.",
    ["festival", "travel"],
    ["making the plan", "on the road", "a setback", "arrival"],
  ),
  arc(
    "festival-collab",
    "Afterparty collaboration",
    "A chance meeting becomes a creative partnership.",
    ["festival", "collaboration"],
    ["meeting backstage", "the idea", "making it overnight", "the surprise release"],
  ),
  arc(
    "festival-recovery",
    "Post-festival recovery",
    "The noise ends and ordinary life has to restart.",
    ["festival", "recovery"],
    ["the journey home", "the quiet morning", "sorting the memories", "back to normal"],
  ),
];

export function slpBundledStoryPacks(): SlpStoryPack[] {
  return [
    pack(
      "slurp-everyday-life",
      "Everyday Life",
      "The original Slurp life arcs.",
      structuredClone(SLURP_ARC_LIBRARY_SEED),
      [],
    ),
    pack(
      "slurp-core-calendar",
      "Core Calendar",
      "The original Slurp yearly holidays.",
      [],
      structuredClone(slurpPlatformEventsDefault()),
    ),
    pack("slurp-creator-career", "Creator Career", "Launches, collaborations, pressure, and comebacks.", CAREER, []),
    pack(
      "slurp-relationships-community",
      "Relationships & Community",
      "Friendship, romance, conflict, reunion, and shared causes.",
      RELATIONSHIPS,
      [],
    ),
    pack(
      "slurp-platform-pulse",
      "Platform Pulse",
      "Manual campaigns that change the mood of the whole platform.",
      [],
      PLATFORM_PULSE,
    ),
    pack(
      "slurp-seasonal-atmospheres",
      "Seasonal Atmospheres",
      "Optional weather and seasonal campaigns for any locale.",
      [],
      SEASONS,
    ),
    pack(
      "slurp-festival-circuit",
      "Festival Circuit",
      "A mixed showcase connecting a festival campaign to matching personal arcs.",
      FESTIVAL_ARCS,
      [
        campaign(
          "festival-week",
          "Festival week",
          "The festival is underway: travel, performances, crowds, and unexpected meetings.",
          ["festival", "travel", "performance"],
        ),
      ],
    ),
  ];
}

function legacyArcPack(value: unknown): SlpStoryPack | null {
  const parsed = slpArcBlueprintSchema.safeParse(value);
  if (!parsed.success) return null;
  return pack(
    "imported-legacy-arc",
    `${parsed.data.name} import`,
    "Imported from a legacy single-arc file.",
    [parsed.data],
    [],
  );
}

export function parseSlpStoryPack(value: unknown): { pack: SlpStoryPack | null; errors: string[] } {
  const bytes = Buffer.byteLength(JSON.stringify(value));
  if (bytes > SLP_STORY_PACK_MAX_BYTES) return { pack: null, errors: ["This story pack is larger than 1 MiB."] };
  const legacy = legacyArcPack(value);
  if (legacy) return { pack: legacy, errors: [] };
  const parsed = slpStoryPackSchema.safeParse(value);
  return parsed.success
    ? { pack: parsed.data, errors: [] }
    : { pack: null, errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "pack"}: ${issue.message}`) };
}

export function previewSlpStoryPack(
  value: unknown,
  current: { arcs: readonly SlurpArcType[]; events: readonly SlurpPlatformEvent[] },
): SlpStoryPackPreview {
  const parsed = parseSlpStoryPack(value);
  if (!parsed.pack) throw new Error(parsed.errors.join(" ") || "This is not a valid Slurp story pack.");
  const pack = parsed.pack;
  const entries: SlpStoryPackPreviewEntry[] = [];
  const add = (kind: "arc" | "event", entry: SlpArcBlueprint | SlpEventBlueprint) => {
    const contentId = entry.contentId ?? entry.id;
    const list = kind === "arc" ? current.arcs : current.events;
    const installed = list.find(
      (item) => item.provenance?.packId === pack.id && item.provenance.contentId === contentId,
    );
    const idConflict = list.find((item) => item.id === entry.id && item !== installed);
    const incomingHash = contentFingerprint(entry);
    const hasCorePlaceholderHash = installed?.builtin === true && installed.provenance?.contentHash === "0".repeat(64);
    const locallyEdited = Boolean(
      installed &&
      installed.provenance?.contentHash !== contentFingerprint(installed) &&
      !(hasCorePlaceholderHash && contentFingerprint(installed) === incomingHash),
    );
    const status = locallyEdited ? "local-edit" : installed ? "update" : idConflict ? "conflict" : "new";
    entries.push({
      kind,
      contentId,
      name: entry.name,
      status,
      selected: status !== "local-edit",
      warnings: [],
      value: entry,
    });
    if ("target" in entry && entry.target.kind === "selected")
      entries.at(-1)!.warnings.push("Local Creator assignments will be removed.");
    if (installed?.provenance?.contentHash === incomingHash) entries.at(-1)!.selected = false;
  };
  pack.arcs.forEach((entry) => add("arc", entry));
  pack.events.forEach((entry) => add("event", entry));
  return {
    pack: { id: pack.id, version: pack.version, name: pack.name, description: pack.description, author: pack.author },
    entries,
    warnings: [],
  };
}

export type SlpStoryPackApplyChoice = {
  kind: "arc" | "event";
  contentId: string;
  action: "copy" | "replace" | "skip";
  enabled?: boolean;
  automation?: "inherit" | "manual" | "suggest" | "auto";
  value?: SlpArcBlueprint | SlpEventBlueprint;
};

export function applySlpStoryPack(
  preview: SlpStoryPackPreview,
  choices: readonly SlpStoryPackApplyChoice[],
  current: { arcs: SlurpArcType[]; events: SlurpPlatformEvent[] },
) {
  const arcs = [...current.arcs];
  const events = [...current.events];
  for (const choice of choices) {
    if (choice.action === "skip") continue;
    const item = preview.entries.find((entry) => entry.kind === choice.kind && entry.contentId === choice.contentId);
    if (!item?.value) continue;
    const source = stripLocal(choice.value ?? item.value);
    if ((source.contentId ?? source.id) !== choice.contentId) continue;
    const entry = {
      ...source,
      id: choice.action === "copy" ? `custom-${randomUUID()}` : source.id,
      enabled: choice.enabled ?? false,
      automation: choice.automation ?? "inherit",
      builtin: false,
      hidden: false,
      provenance: provenance(preview.pack, source),
    };
    const list = choice.kind === "arc" ? arcs : events;
    const match = list.findIndex(
      (existing) =>
        existing.provenance?.packId === preview.pack.id && existing.provenance.contentId === choice.contentId,
    );
    if (choice.action === "replace" && match >= 0) entry.id = list[match]!.id;
    if (match >= 0 && choice.action === "replace") list.splice(match, 1, entry as never);
    else list.push(entry as never);
  }
  return { arcs, events };
}

export function exportSlpStoryPack(input: {
  id: string;
  name: string;
  description?: string;
  arcs: SlurpArcType[];
  events: SlurpPlatformEvent[];
}): SlpStoryPack {
  return pack(
    input.id,
    input.name,
    input.description ?? "Exported from Slurp Remastered.",
    input.arcs.map((entry) => stripLocal(entry) as SlpArcBlueprint),
    input.events.map((entry) => stripLocal(entry) as SlpEventBlueprint),
  );
}
