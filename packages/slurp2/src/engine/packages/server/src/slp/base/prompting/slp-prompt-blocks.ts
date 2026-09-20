export const SLURP_PROMPT_IDS = [
  "post",
  "dmReply",
  "commentReply",
  "fanActivity",
  "stageProfile",
  "ambientProfile",
  "arc",
  "pendingCommission",
  "pendingQuestion",
  "pendingOpener",
  "pendingDelivery",
  "postGuidance",
  "conversationSchedule",
  "invitedPost",
  "reactionBank",
  "imageInterpretation",
  "imagePost",
  "garnishAds",
] as const;

export type SlurpPromptId = (typeof SLURP_PROMPT_IDS)[number];
export type SlurpPromptBlockKind = "editable" | "required" | "context";

export type SlurpPromptBlockOverride = {
  id: string;
  enabled?: boolean;
  text?: string;
  instructionId?: string;
};
export type SlurpReusablePromptInstruction = { id: string; name: string; text: string; builtin?: boolean };

/** The stored layout for every prompt. */
export type SlurpPromptBlockOverrides = Partial<Record<SlurpPromptId, SlurpPromptBlockOverride[]>>;

/** The stored layouts and reusable instructions, resolved together. */
export type SlurpPromptContext = {
  blocks: SlurpPromptBlockOverrides;
  instructions: SlurpReusablePromptInstruction[];
};

export type SlurpPromptBlock = {
  id: string;
  kind: SlurpPromptBlockKind;
  text: string;
  optional?: boolean;
};

export type SlurpPromptBlockDescription = {
  id: string;
  kind: SlurpPromptBlockKind;
  optional: boolean;
};

export type SlurpPromptDescription = {
  id: SlurpPromptId;
  group: "writing" | "messages" | "images" | "profiles" | "world" | "audience";
  blocks: SlurpPromptBlockDescription[];
};

const descriptions = (blocks: Array<[string, SlurpPromptBlockKind, boolean?]>): SlurpPromptBlockDescription[] =>
  blocks.map(([id, kind, optional = false]) => ({ id, kind, optional }));

/**
 * The prompt inventory before the posting-intent overhaul. The Classic prompt preset is this
 * inventory: the live inventory below adds only optional context blocks to it.
 */
const BASE_PROMPT_DESCRIPTIONS: SlurpPromptDescription[] = [
  {
    id: "post",
    group: "writing",
    blocks: descriptions([
      ["task", "editable"],
      ["platform", "required"],
      ["safety", "required"],
      ["creativeDirection", "context", true],
      ["identity", "required"],
      ["format", "required"],
      ["access", "context", true],
      ["continuity", "editable"],
      ["imageDirection", "context", true],
      ["output", "required"],
      ["character", "context"],
    ]),
  },
  {
    id: "dmReply",
    group: "messages",
    blocks: descriptions([
      ["task", "editable"],
      ["platform", "required"],
      ["safety", "required"],
      ["creativeDirection", "context", true],
      ["boundaries", "context", true],
      ["identity", "required"],
      ["canon", "context", true],
      ["state", "context", true],
      ["recentPosts", "context", true],
      ["memory", "context", true],
      ["creatorState", "context", true],
      ["relationshipState", "context", true],
      ["style", "editable"],
      ["outputContract", "required"],
      ["output", "required"],
    ]),
  },
  {
    id: "commentReply",
    group: "messages",
    blocks: descriptions([
      ["task", "editable"],
      ["platform", "required"],
      ["safety", "required"],
      ["creativeDirection", "context", true],
      ["boundaries", "context", true],
      ["identity", "required"],
      ["style", "editable"],
      ["outputContract", "required"],
      ["output", "required"],
    ]),
  },
  {
    id: "fanActivity",
    group: "audience",
    blocks: descriptions([
      ["task", "editable"],
      ["contentRules", "required"],
      ["voices", "editable"],
      ["limits", "required"],
      ["output", "required"],
      ["audience", "context"],
    ]),
  },
  {
    id: "stageProfile",
    group: "profiles",
    blocks: descriptions([
      ["task", "editable"],
      ["profileRules", "editable"],
      ["disclosure", "required"],
      ["output", "required"],
      ["source", "context"],
      ["guidance", "context"],
    ]),
  },
  {
    id: "ambientProfile",
    group: "profiles",
    blocks: descriptions([
      ["task", "editable"],
      ["profileRules", "editable"],
      ["output", "required"],
      ["profiles", "context"],
    ]),
  },
  {
    id: "arc",
    group: "world",
    blocks: descriptions([
      ["task", "editable"],
      ["arcRules", "editable"],
      ["output", "required"],
      ["creator", "context"],
      ["history", "context"],
    ]),
  },
  ...(["pendingCommission", "pendingQuestion", "pendingOpener", "pendingDelivery"] as const).map(
    (id): SlurpPromptDescription => ({
      id,
      group: "messages",
      blocks: descriptions([
        ["task", "editable"],
        ["safety", "required"],
        ["output", "required"],
        ["source", "context"],
      ]),
    }),
  ),
  {
    id: "postGuidance",
    group: "writing",
    blocks: descriptions([
      ["task", "editable"],
      ["accessRules", "context"],
      ["style", "editable"],
      ["output", "required"],
    ]),
  },
  {
    id: "conversationSchedule",
    group: "world",
    blocks: descriptions([
      ["task", "editable"],
      ["scheduleRules", "editable"],
      ["output", "required"],
      ["character", "context"],
    ]),
  },
  {
    id: "invitedPost",
    group: "writing",
    blocks: descriptions([
      ["task", "editable"],
      ["safety", "required"],
      ["style", "editable"],
      ["output", "required"],
      ["character", "context"],
    ]),
  },
  {
    id: "reactionBank",
    group: "audience",
    blocks: descriptions([
      ["task", "editable"],
      ["style", "editable"],
      ["tone", "context"],
      ["groups", "context"],
      ["output", "required"],
    ]),
  },
  {
    id: "imageInterpretation",
    group: "images",
    blocks: descriptions([
      ["task", "editable"],
      ["style", "editable"],
      ["safety", "required"],
      ["output", "required"],
    ]),
  },
  {
    id: "imagePost",
    group: "images",
    blocks: descriptions([
      ["styleProfile", "context", true],
      ["appearance", "context", true],
      ["scene", "context"],
      ["imageInstructions", "context", true],
    ]),
  },
  {
    id: "garnishAds",
    group: "audience",
    blocks: descriptions([
      ["task", "editable"],
      ["style", "context"],
      ["safety", "required"],
      ["output", "required"],
      ["world", "context", true],
      ["existingBrands", "context", true],
    ]),
  },
];

/** Where the live inventory inserts the "you are working" block, relative to each prompt's own blocks. */
const PERFORMANCE_AFTER: Partial<Record<SlurpPromptId, string>> = {
  dmReply: "identity",
  commentReply: "identity",
  invitedPost: "safety",
};

function withPerformanceBlock(prompt: SlurpPromptDescription): SlurpPromptDescription {
  const after = PERFORMANCE_AFTER[prompt.id];
  if (!after) return prompt;
  const blocks = prompt.blocks.flatMap((block) =>
    block.id === after ? [block, { id: "performance", kind: "context" as const, optional: true }] : [block],
  );
  return { ...prompt, blocks };
}

const PRODUCE_PROMPT_DESCRIPTIONS: SlurpPromptDescription[] = BASE_PROMPT_DESCRIPTIONS.map((prompt) =>
  prompt.id === "post"
    ? {
        ...prompt,
        // `contentType` is what this post is *for*: bait, throwaway, a planned set, a thank-you, a
        // boundary notice. The Classic preset turns it off.
        blocks: descriptions([
          ["task", "editable"],
          ["platform", "required"],
          ["safety", "required"],
          ["creativeDirection", "context", true],
          ["identity", "required"],
          ["format", "required"],
          ["access", "context", true],
          ["contentType", "context", true],
          ["production", "context", true],
          ["continuity", "editable"],
          ["imageDirection", "context", true],
          ["output", "required"],
          ["character", "context"],
        ]),
      }
    : withPerformanceBlock(prompt),
);

/** Public prompt inventory used by the settings UI and by regression checks. */
export function slurpPromptDescriptions(): SlurpPromptDescription[] {
  return PRODUCE_PROMPT_DESCRIPTIONS;
}

const DESCRIPTION_BY_ID = new Map(PRODUCE_PROMPT_DESCRIPTIONS.map((prompt) => [prompt.id, prompt]));

type SlurpPromptEditableDefaults = Partial<Record<SlurpPromptId, Record<string, string>>>;

const PROMPT_EDITABLE_DEFAULTS: SlurpPromptEditableDefaults = {
  post: {
    task: "You write exactly one post for one Slurp creator page in Marinara Engine.",
    continuity:
      "Recent posts provide continuity. Do not repeat a recent post's setting, activity, framing, wardrobe, or wording. If the last few posts happened in one place, this one happens somewhere else.\nEvery post needs a short, specific title that does not repeat the body text.",
  },
  dmReply: {
    task: "You write exactly one direct message from one Slurp creator to one fan, inside a private chat. Write only as the supplied creator and never write the fan's side.",
    style:
      "Write like a private chat. Lowercase, contractions, and emojis are fine when they fit the person. Keep it to one to four sentences unless the fan asked something that needs more.",
  },
  commentReply: {
    task: "You write exactly one direct reply from one Slurp creator to one real viewer comment on the creator's post. Address the comment naturally and never write for the viewer.",
    style:
      "Keep the reply direct and brief: one or two short sentences, normally under 240 characters. Let the relationship set the warmth and familiarity.",
  },
  fanActivity: {
    task: "Propose quiet synthetic audience activity for the supplied Slurp posts.",
    voices:
      "Write each reply as the supplied actor. Follow that actor's voice, traits, tone, and relationship. Keep replies short, natural, relevant, and varied.",
  },
  stageProfile: {
    task: "Create one editable Slurp creator profile draft.",
    profileRules:
      "Make the profile concise and useful for later post generation. Treat the source character as the person and stagePersonality as how that person performs on Slurp, not as a replacement personality.",
  },
  ambientProfile: {
    task: "Create replacement identities for fake ambient users on a fictional creator platform called Slurp.",
    profileRules:
      "Make every profile distinct and plausible as a recurring background user. Vary personalities, interests, and posting styles. Write concise profile metadata only.",
  },
  arc: {
    task: "Invent one life arc for a Slurp creator: something that happens in their own life over days or weeks and that they keep posting about.",
    arcRules:
      "Give the arc a clear direction and ordered beats. Do not repeat the creator's recent or past arcs. A crossover must work as one shared story in which each creator can post their own side.",
  },
  pendingCommission: {
    task: "Rewrite this commission request so it asks for something specific that suits this creator, in the fan's voice. Keep it concise and polite about price and timing.",
  },
  pendingQuestion: {
    task: "Rewrite this question so it is about the supplied post, in the fan's voice. Use one sentence, no greeting.",
  },
  pendingOpener: {
    task: "Rewrite this first message so it sounds like this person writing to this creator for the first time. Keep it short, a little awkward, and do not ask for anything.",
  },
  pendingDelivery: {
    task: "Rewrite this hand-over note as this creator giving a fan the piece they paid for. Use one or two warm sentences, no greeting, and do not describe the picture.",
  },
  postGuidance: {
    task: "Write one short instruction block for another AI that writes posts for a Slurp creator page.",
    style:
      'Address the post-writing AI as the creator, using "you". State what the post should do for the reader and what it must not do. Write two to five sentences of plain prose.',
  },
  conversationSchedule: {
    task: "Create a realistic weekly Conversation Schedule for this fictional character.",
    scheduleRules:
      "Include Monday through Sunday. Cover each full day with time ranges and realistic activities. Also choose talkativeness and an inactivity threshold that fit the character.",
  },
  invitedPost: {
    task: "Write exactly one public Slurp post as the supplied character.",
    style:
      "Write a real social post, usually 40 to 280 characters. Use longer text only when the player's direction asks for it.",
  },
  reactionBank: {
    task: "Write short throwaway comments each supplied audience group could leave under a post they liked.",
    style:
      "Use three or four lowercase words. Do not use trailing punctuation or emoji. Keep every line generic enough to reuse under many posts, but vary the wording.",
  },
  imageInterpretation: {
    task: "Rewrite the supplied draft into one provider-ready image prompt.",
    style:
      "Keep style instructions first, character appearance next, and the scene last. Preserve supplied appearance and style details without labels or duplication.",
  },
  garnishAds: {
    task: "Invent fictional advertisements for an in-world Slurp feed.",
  },
};

export function slurpPromptEditableDefaults(): SlurpPromptEditableDefaults {
  return PROMPT_EDITABLE_DEFAULTS;
}

export function slurpPromptEditableDefault(promptId: SlurpPromptId, blockId: string, fallback: string): string {
  return PROMPT_EDITABLE_DEFAULTS[promptId]?.[blockId] ?? fallback;
}

/** Remove stale ids and changes that target required or runtime-only blocks. */
function normalizeLayouts(value: unknown): SlurpPromptBlockOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const normalized: SlurpPromptBlockOverrides = {};
  for (const promptId of SLURP_PROMPT_IDS) {
    const description = DESCRIPTION_BY_ID.get(promptId)!;
    const known = new Map(description.blocks.map((block) => [block.id, block]));
    const rows = Array.isArray(source[promptId]) ? source[promptId] : [];
    const seen = new Set<string>();
    const next: SlurpPromptBlockOverride[] = [];
    for (const raw of rows) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const record = raw as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id : "";
      const block = known.get(id);
      if (!block || seen.has(id)) continue;
      seen.add(id);
      next.push({
        id,
        ...(block.optional && typeof record.enabled === "boolean" ? { enabled: record.enabled } : {}),
        ...(block.kind === "editable" && typeof record.text === "string"
          ? { text: record.text.trim().slice(0, 20_000) }
          : {}),
        ...(block.kind === "editable" && typeof record.instructionId === "string"
          ? { instructionId: record.instructionId.trim().slice(0, 80) }
          : {}),
      });
    }
    // A layout saved before a block existed gets it where the inventory puts it, not at the end.
    description.blocks.forEach((block, index) => {
      if (seen.has(block.id)) return;
      const before = description.blocks[index - 1]?.id;
      next.splice(next.findIndex((row) => row.id === before) + 1, 0, { id: block.id });
    });
    if (
      next.some(
        (row, index) =>
          row.id !== description.blocks[index]?.id || row.enabled !== undefined || row.text || row.instructionId,
      )
    ) {
      normalized[promptId] = next;
    }
  }
  return normalized;
}

/**
 * The two stored shapes before this one.
 *
 * Up to 0.1.3 the layouts were keyed by prompt id directly. Integration builds then keyed them by
 * a `classic` or `produce` runtime mode. Neither mode name is a prompt id, so the keys tell the
 * shapes apart.
 */
function modeKeyedLayouts(value: unknown): { classic?: unknown; produce?: unknown } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  return "classic" in source || "produce" in source ? source : null;
}

/**
 * Validate the stored layouts.
 *
 * A mode-keyed record keeps its produce layouts. Classic layouts fill in only when produce has
 * none, because the Classic inventory is a subset of this one and every Classic edit still lands
 * on the block it was written for.
 */
export function normalizeSlurpPromptBlockOverrides(value: unknown): SlurpPromptBlockOverrides {
  const keyed = modeKeyedLayouts(value);
  if (!keyed) return normalizeLayouts(value);
  const produce = normalizeLayouts(keyed.produce);
  return Object.keys(produce).length > 0 ? produce : normalizeLayouts(keyed.classic);
}

/**
 * The player's Classic-era edits, recovered from a stored layout that predates the Classic preset.
 * Flat 0.1.3 layouts were written against the Classic inventory, so all of them count.
 */
export function slurpLegacyClassicPromptBlocks(value: unknown): SlurpPromptBlockOverrides {
  const keyed = modeKeyedLayouts(value);
  return normalizeLayouts(keyed ? keyed.classic : value);
}

/** Blocks the posting-intent overhaul added. The Classic preset turns them off. */
const PRODUCE_ONLY_BLOCKS: Partial<Record<SlurpPromptId, readonly string[]>> = {
  post: ["contentType", "production"],
  dmReply: ["performance"],
  commentReply: ["performance"],
  invitedPost: ["performance"],
};

/**
 * The Classic prompt preset: the player's Classic-era edits with the overhaul's context blocks off.
 *
 * Prompt text only. Selecting it restores the old wording; it does not bring back the old
 * rotation, camera, or image algorithm.
 */
export function slurpClassicPromptPreset(classic: SlurpPromptBlockOverrides): SlurpPromptBlockOverrides {
  const preset: SlurpPromptBlockOverrides = { ...classic };
  for (const [promptId, off] of Object.entries(PRODUCE_ONLY_BLOCKS) as Array<[SlurpPromptId, readonly string[]]>) {
    const rows =
      normalizeLayouts({ [promptId]: classic[promptId] ?? [] })[promptId] ??
      DESCRIPTION_BY_ID.get(promptId)!.blocks.map((block) => ({ id: block.id }));
    preset[promptId] = rows.map((row) => (off.includes(row.id) ? { ...row, enabled: false } : row));
  }
  return preset;
}

/** The stored layouts and instructions. One place resolves both. */
export function slurpPromptContext(settings: {
  promptBlocks?: SlurpPromptBlockOverrides;
  promptInstructions?: SlurpReusablePromptInstruction[];
}): SlurpPromptContext {
  return { blocks: settings.promptBlocks ?? {}, instructions: settings.promptInstructions ?? [] };
}

/** Compose one prompt from current runtime blocks and a validated user layout. */
export function composeSlurpPromptBlocks(
  promptId: SlurpPromptId,
  blocks: readonly SlurpPromptBlock[],
  overrides: SlurpPromptBlockOverrides | undefined,
  instructions: readonly SlurpReusablePromptInstruction[] = [],
): string {
  return resolveSlurpPromptBlocks(promptId, blocks, overrides, instructions)
    .map((block) => block.text.trim())
    .filter(Boolean)
    .join("\n");
}

/** Resolve one prompt's active blocks with the stored order and editable text applied. */
export function resolveSlurpPromptBlocks(
  promptId: SlurpPromptId,
  blocks: readonly SlurpPromptBlock[],
  overrides: SlurpPromptBlockOverrides | undefined,
  instructions: readonly SlurpReusablePromptInstruction[] = [],
): SlurpPromptBlock[] {
  const byId = new Map(blocks.map((block) => [block.id, block]));
  const instructionById = new Map(instructions.map((instruction) => [instruction.id, instruction.text]));
  const configured = overrides?.[promptId] ?? blocks.map((block) => ({ id: block.id }));
  const ordered = [
    ...configured.flatMap((entry) => {
      const block = byId.get(entry.id);
      if (!block) return [];
      byId.delete(entry.id);
      return [{ block, entry }];
    }),
    ...byId.values().map((block) => ({ block, entry: { id: block.id } })),
  ];
  return ordered
    .filter(({ block, entry }) => !block.optional || entry.enabled !== false)
    .map(({ block, entry }) => ({
      ...block,
      text:
        block.kind === "editable" && entry.instructionId && instructionById.get(entry.instructionId)?.trim()
          ? instructionById.get(entry.instructionId)!.trim()
          : block.kind === "editable" && entry.text?.trim()
            ? entry.text.trim()
            : block.text.trim(),
    }));
}
