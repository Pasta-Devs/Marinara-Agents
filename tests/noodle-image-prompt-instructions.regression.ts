import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import {
  compileImagePrompt,
  createDefaultImageStyleProfileSettings,
  resolveImageStyleGuidanceText,
} from "@marinara-engine/shared";
import { NOODLE_IMAGE_POST } from "../packages/noodle/src/engine/packages/server/src/services/prompt-overrides/registry/noodle.js";
import { compileNoodleImagePrompts } from "../packages/noodle/src/engine/packages/server/src/services/noodle/noodle-image-prompt.js";

// Pasta-Devs/Marinara-Agents#1278 (reported in Pasta-Devs/Marinara-Engine#7318): text written for the
// model that writes image prompts must not reach the image model word for word. That covers the
// poster's Personality and image habits, the image connection's Image Prompting Instructions, a
// style profile's Style text once the rewrite model gets it, and the built-in Auto instruction.

const autoInstruction = /Infer a consistent visual style/u;
const danbooruStyle = /Danbooru-tagged anime generation/u;
const personality = "precise, arrogant, impatient with staged sentimentality";
const imageHabits = "stark lab photography with cold lighting";
const connectionInstructions = "Write comma-separated Danbooru tags only. Never write sentences.";
const draft = "1boy, solo, blue hair, white mask, ruined lab bench, six minutes unsupervised";
const appearance = "Dottore's Appearance: blue hair and a white mask";

// ── The default template sends picture content only ─────────────────────────────────────────
const templated = NOODLE_IMAGE_POST.defaultBuilder({
  authorName: "Dottore",
  postContent: "I left one meeting unattended for six minutes.",
  draftPrompt: draft,
  userInstructions: "Create a social-media-ready character image.",
  characterDescription: appearance,
  characterPersonality: personality,
  characterImageInstructions: imageHabits,
});
assert.equal(templated, `${draft}\n\n${appearance}`);

// ── Style text goes to the rewrite model, never into its prompt; Auto's instruction goes nowhere ──
const styleProfiles = (defaultProfileId: string) => ({
  ...createDefaultImageStyleProfileSettings(),
  defaultProfileId,
});
const compileFor = (profiles: ReturnType<typeof styleProfiles>) =>
  compileNoodleImagePrompts({ kind: "illustration", prompt: draft, styleProfiles: profiles });

const auto = compileFor(styleProfiles("auto"));
assert.equal(auto.styleGuidance, "");
for (const prompt of [auto.literal.prompt, auto.forRewrite.prompt]) {
  assert.doesNotMatch(prompt, autoInstruction, prompt);
  assert.match(prompt, /ruined lab bench/u, prompt);
}
// The shared compiler alone still pastes it: Noodle's vendored copy predates Pasta-Devs/Marinara-Engine#7342.
assert.match(
  compileImagePrompt({ kind: "illustration", prompt: draft, styleProfiles: styleProfiles("auto") }).prompt,
  autoInstruction,
  "the vendored compiler changed; this override may no longer be needed",
);

const danbooru = compileFor(styleProfiles("danbooru"));
assert.match(danbooru.styleGuidance, danbooruStyle);
assert.doesNotMatch(danbooru.forRewrite.prompt, danbooruStyle, "the rewrite model gets it as guidance only");
assert.match(danbooru.literal.prompt, danbooruStyle, "without a prompt writer a profile's Style text applies");

// Style text a user writes into a copy of Auto is theirs: it still applies, as in the Engine.
const autoCopyProfiles = styleProfiles("auto-copy");
const autoProfile = autoCopyProfiles.profiles.find((profile) => profile.id === "auto")!;
autoCopyProfiles.profiles = [
  ...autoCopyProfiles.profiles,
  { ...autoProfile, id: "auto-copy", builtIn: false, styleText: "watercolor, soft pastel palette" },
];
const autoCopy = compileFor(autoCopyProfiles);
assert.equal(autoCopy.styleGuidance, "");
assert.match(autoCopy.literal.prompt, /watercolor, soft pastel palette/u);
assert.match(autoCopy.forRewrite.prompt, /watercolor, soft pastel palette/u);

// ── The real generateNoodlePostImage, with storage, providers and the rewrite model stubbed ──────
const servicePath = new URL(
  "../packages/noodle/src/engine/packages/server/src/services/noodle/noodle-public-images.service.ts",
  import.meta.url,
);
const service = readFileSync(servicePath, "utf8");
const start = service.indexOf("export function characterAppearanceFromRow");
const end = service.indexOf("export function createPublicNoodleImagesService");
assert.ok(start > 0 && end > start, "generateNoodlePostImage moved; update this regression");
const functions = stripTypeScriptTypes(service.slice(start, end).replace(/^export /gmu, ""));

type RewriteInput = {
  prompt: string;
  instructions?: string;
  characterContext?: string;
  styleGuidance?: string;
};

async function postImagePrompt(options: {
  profileId: string;
  interpret: boolean;
  rewrite?: string | null;
  promptOverride?: { prompt: string };
}) {
  const rewrites: RewriteInput[] = [];
  const warnings: string[] = [];
  const debugLines: string[] = [];
  const character = {
    id: "dottore",
    avatarPath: null,
    data: {
      name: "Dottore",
      personality,
      extensions: { applyConversationImageInstructionsToNoodle: true, conversationImageInstructions: imageHabits },
    },
  };
  const context = {
    input: {
      account: { kind: "character", entityId: "dottore", displayName: "Dottore" },
      referenceAccounts: [],
      postContent: "I left one meeting unattended for six minutes.",
      draftPrompt: draft,
      settings: {
        imageGenerationPrompt: "",
        imageGenerationIncludeDescriptions: true,
        imageGenerationUseAvatarReferences: false,
        enableImageInterpretation: options.interpret,
        imageWidth: 1024,
        imageHeight: 1024,
      },
      characters: { getById: async (id: string) => (id === "dottore" ? character : null) },
      characterGallery: {},
      promptOverrides: {},
      imageConnection: { id: "comfy", model: "", imagePromptInstructions: connectionInstructions },
      db: {},
      debugMode: true,
      previewOnly: true,
      promptOverride: options.promptOverride,
    },
    styleProfiles: styleProfiles(options.profileId),
    NOODLE_IMAGE_POST,
    compileImagePrompt,
    compileNoodleImagePrompts,
    resolveImageStyleGuidanceText,
    loadImageGenerationUserSettings: async () => ({ styleProfiles: context.styleProfiles }),
    resolveConnectionImageDefaults: () => undefined,
    resolveImageConnectionFallback: async () => null,
    createConnectionsStorage: () => ({}),
    loadPrompt: async (
      _storage: unknown,
      def: typeof NOODLE_IMAGE_POST,
      ctx: Parameters<typeof def.defaultBuilder>[0],
    ) => def.defaultBuilder(ctx),
    parseRecord: (value: unknown) => (value && typeof value === "object" ? value : {}),
    readIllustratorAppearance: () => null,
    normalizeIllustratorAppearance: () => null,
    characterNameFromRow: () => "Dottore",
    resolveIllustratorCharacterReferences: async () => ({ appearanceBlock: appearance, referenceImages: [] }),
    rewriteNoodleImagePrompt: async (rewriteInput: RewriteInput) => {
      rewrites.push(rewriteInput);
      return options.rewrite ?? null;
    },
    resolveImagePromptReviewSize: () => ({ width: 1024, height: 1024 }),
    logger: {
      warn: (message: string) => warnings.push(message),
      info: () => undefined,
      debug: () => undefined,
      error: () => undefined,
    },
    logDebugOverride: (_debug: boolean, message: string) => debugLines.push(message),
    result: undefined as unknown,
  };
  runInNewContext(`${functions}\nresult = generateNoodlePostImage(input);`, context);
  const generated = (await context.result) as { preview: { prompt: string } };
  return { prompt: generated.preview.prompt, rewrites, warnings, debugLines };
}

const leaks = [/User image instructions/u, /Danbooru tags only/u, /precise, arrogant/u, /stark lab photography/u];
const assertNoInstructionText = (prompt: string) => {
  for (const leak of leaks) assert.doesNotMatch(prompt, leak, prompt);
  assert.match(prompt, /ruined lab bench/u, prompt);
};

async function main() {
  // Interpret image prompts off: no prompt writer, so nothing written for one reaches the image model.
  const off = await postImagePrompt({ profileId: "danbooru", interpret: false });
  assertNoInstructionText(off.prompt);
  assert.match(off.prompt, danbooruStyle, "a profile's Style text still applies without a prompt writer");
  assert.equal(off.rewrites.length, 0);
  assert.ok(
    off.debugLines.some((line) => /instructions were not applied/u.test(line)),
    "the skipped instructions are logged",
  );

  // Rewrite on: the rewrite model gets the instructions, personality, image habits and Style text as
  // guidance, and a prompt without them.
  const rewritten = await postImagePrompt({ profileId: "danbooru", interpret: true, rewrite: "1boy, rewritten tags" });
  assert.equal(rewritten.prompt, "1boy, rewritten tags");
  assert.equal(rewritten.rewrites.length, 1);
  const [rewriteInput] = rewritten.rewrites;
  assertNoInstructionText(rewriteInput!.prompt);
  assert.doesNotMatch(rewriteInput!.prompt, danbooruStyle, "Style text goes to the rewrite model once, as guidance");
  assert.equal(rewriteInput!.instructions, connectionInstructions);
  assert.match(rewriteInput!.styleGuidance ?? "", danbooruStyle);
  assert.match(rewriteInput!.characterContext ?? "", /Personality:\nprecise, arrogant/u);
  assert.match(rewriteInput!.characterContext ?? "", /Character image preferences:\nstark lab photography/u);

  // Rewrite failed: the base prompt goes out, and the failure is logged.
  const failed = await postImagePrompt({ profileId: "danbooru", interpret: true, rewrite: null });
  assertNoInstructionText(failed.prompt);
  assert.equal(failed.prompt, off.prompt);
  assert.ok(
    failed.warnings.some((line) => /rewrite gave no prompt/u.test(line)),
    "the failed rewrite is logged",
  );

  // The built-in Auto profile: its instruction never reaches the image model, with or without a rewrite.
  for (const options of [
    { profileId: "auto", interpret: false },
    { profileId: "auto", interpret: true, rewrite: null },
  ]) {
    const { prompt, rewrites } = await postImagePrompt(options);
    assertNoInstructionText(prompt);
    assert.doesNotMatch(prompt, autoInstruction, prompt);
    for (const rewrite of rewrites) assert.doesNotMatch(rewrite.prompt, autoInstruction, rewrite.prompt);
  }

  // A prompt the user reviewed and edited is sent exactly as written.
  const reviewed = await postImagePrompt({
    profileId: "danbooru",
    interpret: true,
    rewrite: "unused",
    promptOverride: { prompt: "1boy, my own tags" },
  });
  assert.equal(reviewed.prompt, "1boy, my own tags");
  assert.equal(reviewed.rewrites.length, 0);

  console.log("noodle-image-prompt-instructions regression passed");
}

void main();
