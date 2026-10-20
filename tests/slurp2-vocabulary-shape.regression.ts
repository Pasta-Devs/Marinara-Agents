import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Slice 12 copied the Engine Noodle declarations into Slurp2's own `slp` shared root and renamed
// them. Every copied declaration, renamed back through the recorded map and stripped of comments
// and formatting, must match the Engine original. The only exceptions are the divergences listed in
// INTENDED_DELTAS: Slurp-only fields, validator changes and Slurp's own prompt wording. Each entry
// has a comment. Any other difference fails. Nothing may be removed from the map, and a new entry
// needs a comment.
const repoRoot = join(import.meta.dirname, "..");
const packageRoot = join(repoRoot, "packages/slurp2");
const slpShared = join(packageRoot, "src/engine/packages/shared/src/slp");
const engineRoot = process.env.MARINARA_ENGINE_ROOT;

if (!engineRoot || !existsSync(join(engineRoot, "packages/shared/src/types/noodle.ts"))) {
  console.log("slurp2 vocabulary-shape regression skipped: set MARINARA_ENGINE_ROOT to an Engine checkout to run it");
  process.exit(0);
}

const MAP: Record<string, string> = JSON.parse(
  readFileSync(join(packageRoot, "docs/architecture/slurp2-vocabulary-rename-map.json"), "utf8"),
);
const BACK = new Map(Object.entries(MAP).map(([engine, slp]) => [slp, engine]));

// The one deliberate value change in the copy: a user-visible validation message that said Noodle
// where Slurp is meant. Every other difference is a shape difference and must fail.
const INTENDED_DELTAS: Record<string, [string, string][]> = {
  slpAccountIdentityUpdateShape: [['"Enter a Slurp handle."', '"Enter a Noodle handle."']],
  // 0.2.0: per-Creator posting strategy is Slurp-only.
  // 0.3.2: Creator Pages add two Slurp-only profile fields.
  SlpAccountProfileSettings: [
    ["page?: SlpCreatorPage;", ""],
    ["pageWanted?: boolean;", ""],
  ],
  // Slurp-only account fields: the Creator stage facts and the cached appearance profile.
  SlpAccountSettings: [
    ["strategy?: SlpCreatorStrategySettings;", ""],
    ["stage?: SlpCreatorStageFacts;", ""],
    ["appearanceProfile?: SlpAppearanceProfile;", ""],
  ],
  // 0.2.0: ordered photo-set attachments; imageUrl/imagePrompt still mirror position zero.
  SlpPost: [
    [
      "/** Ordered media. Position zero mirrors imageUrl/imagePrompt for older clients. */\n  images: SlpPostMedia[];",
      "",
    ],
  ],
  // Slurp-only post fields: a paid partnership or collab shows while locked.
  SlpCreatorPostView: [
    ["/** Empty while locked unless the URL is an access-checked teaser. */\n  images: SlpPostMedia[];", ""],
    ["partnership?: SlpPostPartnership | null;", ""],
  ],
  // 0.3.27: a strategy save may carry `expect`, the values the editor last saw, to refuse a stale apply.
  slpAccountSettingsPatchSchema: [
    [
      ',\n  z\n    .object({\n      subtree: z.literal("strategy"),\n      patch: slpCreatorStrategyPatchSchema,\n      // What the editor last saw saved for the keys it changes (null: nothing saved). A key saved\n      // differently meanwhile refuses the whole save instead of overwriting it.\n      expect: slpCreatorStrategyPatchSchema.optional(),\n    })\n    .strict(),',
      ",",
    ],
  ],
  slpCreatorPostCreateShape: [["  format: slpCreatorContentFormatSchema.optional(),\n", ""]],
  slpCreatorGenerationRequestShape: [
    ["  format: slpCreatorContentFormatSchema.optional(),\n", ""],
    [
      "  /** A one-shot post purpose from the composer. Outranks the Creator's strategy for this post only. */\n  contentIntent: z.enum(SLURP_CONTENT_INTENTS).optional(),\n  /** One-shot delivery. It is paired with an intent so incompatible combinations fail early. */\n  contentDelivery: z.enum(SLURP_CONTENT_DELIVERIES).optional(),\n",
      "",
    ],
    ["unlockPrice: z.number().int().min(1).max(100_000).optional(),", ""],
  ],
  // 0.2.0: a one-shot delivery must come with a purpose it fits.
  slpCreatorGenerationRequestSchema: [
    [
      '\n  .superRefine((input, ctx) => {\n    if (input.contentIntent && !slurpIntentFitsAccess(input.contentIntent, input.access)) {\n      ctx.addIssue({\n        code: z.ZodIssueCode.custom,\n        path: ["contentIntent"],\n        message: "That purpose does not fit a locked post.",\n      });\n    }\n    if (input.contentDelivery && !input.contentIntent) {\n      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["contentDelivery"], message: "Choose a post purpose too." });\n    } else if (\n      input.contentDelivery &&\n      input.contentIntent &&\n      !slurpContentDeliveryFits(input.contentIntent, input.contentDelivery)\n    ) {\n      ctx.addIssue({\n        code: z.ZodIssueCode.custom,\n        path: ["contentDelivery"],\n        message: "That delivery does not fit this post purpose.",\n      });\n    }\n  });',
      ";",
    ],
  ],
  // Creator stage facts, source account and cached appearance state: Slurp-only fields.
  SlpCreatorManagedStageProfile: [
    [
      "strategy: {\n    saved: SlpCreatorStrategySettings | null;\n    effective: { style: string; skipRate: number; textOnlyRate: number };\n  };",
      "",
    ],
    ["sourceAccountId: string | null;", ""],
    [
      'appearanceState: {\n    source: "override" | "linked" | "derived" | "missing";\n    text: string;\n    needsReview: boolean;\n    linkedAppearance: string;\n    /** Image tags of the linked card while its Image Appearance Override is on; otherwise empty. */\n    imageAppearance: string;\n    profile: SlpAppearanceProfile | null;\n  };',
      "",
    ],
  ],
  // Creator stage profile: the appearance, wardrobe and locations fields and the Creator Page.
  SlpCreatorStageProfile: [
    ["appearance: string;", ""],
    ["wardrobe: string;", ""],
    ["locations: string;", ""],
    // 0.3.40: lingerie or briefs, from gender unless overridden.
    ["clothingStyle: SlpClothingStyle;", ""],
    ["page: SlpCreatorPage | null;", ""],
  ],
  // Stage and profile schemas: the same Slurp-only fields, plus the Creator Page.
  slpStageProfileShape: [
    ['appearance: z.string().trim().max(2000).default(""),', ""],
    ['wardrobe: z.string().trim().max(2000).default(""),', ""],
    ['locations: z.string().trim().max(2000).default(""),', ""],
    ['clothingStyle: z.enum(SLP_CLOTHING_STYLES).default("auto"),', ""],
  ],
  slpStageProfileDraftRequestSchema: [["z.object(noodleStageProfileShape)", "noodleStageProfileSchema"]],
  slpAccountProfileSettingsSchema: [
    ["page: slpCreatorPageSchema.optional(),", ""],
    ["pageWanted: z.boolean().optional(),", ""],
  ],
  // Slurp-only settings: the appearance profile mode and the image prompt (Slurp's own wording).
  DEFAULT_SLP_SETTINGS: [
    [
      "Create a provider-ready image prompt for the supplied post. Preserve the post's subject, action, setting, mood, clothing, and established appearance. Use the Creator's personality to shape expression and presentation, not to invent a new event or sexualize an ordinary moment. Add nudity, explicit anatomy, or sexual activity only when the post or an explicit trusted instruction already requires it. Keep the image coherent and believable. Use only the visual details needed for this scene.",
      "Create either a social-media-ready character image or an in-character meme for the post. For character images, mention build, clothing, visible appearance, pose, expression, setting, lighting, mood, and composition. For memes, mention meme format, visual gag, composition, and short readable caption/text when relevant.",
    ],
    ['appearanceProfileMode: "high_confidence",', ""],
  ],
  slpSettingsSchema: [
    [
      'appearanceProfileMode: z\n    .enum(["ask", "high_confidence", "always"])\n    .default(DEFAULT_NOODLE_SETTINGS.appearanceProfileMode),',
      "",
    ],
  ],
  // Creator post update and generation request: the picture position and the unlock price.
  slpCreatorPostUpdateSchema: [["imagePosition: z.number().int().min(0).max(64).optional(),", ""]],
  // Generated Creator post: Slurp keeps the scene, extra shots and teaser, and strips unknown keys.
  slpGeneratedCreatorPostSchema: [
    ["scene: slpWardrobeSceneSchema.nullable().optional(),", ""],
    ["shots: z.array(slpSceneShotSchema).max(3).nullable().optional().catch(null),", ""],
    ["teaser: z.string().trim().min(1).max(SLP_LOCKED_TEASER_MAX_LENGTH).nullable().optional().catch(null),", ""],
    [
      ".strip()\n  .transform(({ title, content, imagePrompt, scene, shots, teaser }) => ({\n    title,\n    content,\n    imagePrompt: imagePrompt ?? null,\n    scene: scene ?? null,\n    shots: shots ?? [],\n    teaser: teaser ?? null,\n  }));",
      ".strict().transform(({ title, content, imagePrompt }) => ({ title, content, imagePrompt: imagePrompt ?? null }));",
    ],
  ],
  // Generated Creator reply and interaction: Slurp strips unknown keys (strict in the Engine).
  slpGeneratedCreatorReplySchema: [[".strip();", ".strict();"]],
  slpGeneratedInteractionSchema: [[".strip()", ""]],
  // Generated fan, follow, digest, profile and refresh schemas: Slurp strips unknown keys.
  slpGeneratedFanActivitySchema: [[".strip();", ";"]],
  slpGeneratedFollowSchema: [[".strip();", ";"]],
  slpGeneratedDigestSchema: [[".strip();", ";"]],
  slpGeneratedProfileSchema: [[".strip();", ";"]],
  slpGeneratedRefreshSchema: [[".strip();", ";"]],
  slpGeneratedFanRefreshSchema: [[".strip();", ";"]],
  slpGeneratedProfilesSchema: [[".strip();", ";"]],
  // Reply management: a fan account (the persona's viewer actor) also counts as "me" (R1-020).
  SlpReplyManagementInput: [["fanActorAccountId?: string | null;", ""]],
  canManageSlpReply: [
    ["return (", "return "],
    [
      "(actorAccountId === personaAccountId || (Boolean(fanActorAccountId) && actorAccountId === fanActorAccountId))",
      "actorAccountId === personaAccountId",
    ],
    ["\n  );", ";"],
    ["  fanActorAccountId,\n", ""],
  ],
};

const PAIRS: [string, string[]][] = [
  ["packages/shared/src/types/noodle.ts", ["slp-social.types.ts"]],
  ["packages/shared/src/schemas/noodle.schema.ts", ["slp-social.schema.ts", "slp-social-generation.schema.ts"]],
  ["packages/shared/src/utils/noodle-mentions.ts", ["slp-mentions.ts"]],
  ["packages/shared/src/utils/noodle-polls.ts", ["slp-polls.ts"]],
  ["packages/shared/src/utils/noodle-post-images.ts", ["slp-post-images.ts"]],
  ["packages/shared/src/utils/noodler-onboarding.ts", ["slp-creator-onboarding.ts"]],
  ["packages/shared/src/utils/noodle-interactions.ts", ["slp-interactions.ts"]],
];

const DECL =
  /^(?:export\s+)?(?:declare\s+)?(?:const|let|var|function|type|interface|class|enum)\s+([A-Za-z0-9_$]+)[\s\S]*?(?=\n(?:export\s+|declare\s+)?(?:const|let|var|function|type|interface|class|enum)\s+[A-Za-z0-9_$]+|(?![\s\S]))/gmu;
const RENAMED = new RegExp(`\\b(${[...BACK.keys()].sort((a, b) => b.length - a.length).join("|")})\\b`, "gu");

// Comments and formatting are not shape. `export` is not shape either: the split across two files
// widened one declaration's visibility.
function normalize(source: string): string {
  let text = source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/(^|\s)\/\/[^\n]*/gu, "");
  text = text.replace(/\s+/gu, "");
  for (const [from, to] of [
    ["=|", "="],
    [",)", ")"],
    [",}", "}"],
    [",]", "]"],
    ["|}", "}"],
  ]) {
    text = text.split(from).join(to);
  }
  return text.replace(/^export/u, "");
}

function declarations(source: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const match of source.matchAll(DECL)) found.set(match[1], match[0]);
  return found;
}

let compared = 0;
for (const [enginePath, copies] of PAIRS) {
  const engine = declarations(readFileSync(join(engineRoot, enginePath), "utf8"));
  for (const copy of copies) {
    for (const [name, body] of declarations(readFileSync(join(slpShared, copy), "utf8"))) {
      const original = BACK.get(name);
      if (!original) continue;
      const engineBody = engine.get(original);
      assert.ok(engineBody, `${name} claims to come from ${original}, which ${enginePath} does not declare`);
      let renamedBack = body.replace(RENAMED, (match) => BACK.get(match) ?? match);
      for (const [after, before] of INTENDED_DELTAS[name] ?? []) renamedBack = renamedBack.split(after).join(before);
      assert.equal(
        normalize(renamedBack),
        normalize(engineBody),
        `${name} is not shape-identical to Engine ${original}; the copy changed more than the name`,
      );
      compared += 1;
    }
  }
}

assert.ok(compared >= 200, `expected the whole copied vocabulary to be compared, got ${compared}`);
console.log(`slurp2 vocabulary-shape regression passed (${compared} declarations shape-identical to the Engine)`);
