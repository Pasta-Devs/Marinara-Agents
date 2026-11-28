import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import {
  compileImagePrompt,
  createDefaultImageStyleProfileSettings,
  noodleTextMentionsHandle,
  resolveImageStyleGuidanceText,
  stripMacroComments,
} from "@marinara-engine/shared";
import { NOODLE_IMAGE_POST } from "../packages/noodle/src/engine/packages/server/src/services/prompt-overrides/registry/noodle.js";
import {
  compileNoodleImagePrompts,
  removeCopiedPromptGuidance,
} from "../packages/noodle/src/engine/packages/server/src/services/noodle/noodle-image-prompt.js";

// Pasta-Devs/Marinara-Agents#1278 (reported in Pasta-Devs/Marinara-Engine#7318): text written for the
// model that writes image prompts must not reach the image model word for word. That covers the
// poster's Personality and image habits, the image connection's Image Prompting Instructions, a
// style profile's Style text once the rewrite model gets it, and the built-in Auto instruction.
// The exception is an Image Generation Appearance Override, which is written for image prompts: with Include
// descriptions on it reaches the image model as written, the user's persona's too when a post depicts it
// (Pasta-Devs/Marinara-Agents#2182, reported in Pasta-Devs/Marinara-Engine#8975).

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

// Style text a user writes into a copy of Auto is theirs: it still applies, and the rewrite model gets it
// as guidance like any other Style text, as in the Engine since Pasta-Devs/Marinara-Engine#7357
// (Pasta-Devs/Marinara-Agents#1282). Before, it sat in the prompt that model edits.
const autoCopyProfiles = styleProfiles("auto-copy");
const autoProfile = autoCopyProfiles.profiles.find((profile) => profile.id === "auto")!;
autoCopyProfiles.profiles = [
  ...autoCopyProfiles.profiles,
  { ...autoProfile, id: "auto-copy", builtIn: false, styleText: "watercolor, soft pastel palette" },
];
const autoCopy = compileFor(autoCopyProfiles);
assert.equal(autoCopy.styleGuidance, "watercolor, soft pastel palette");
assert.match(autoCopy.literal.prompt, /watercolor, soft pastel palette/u);
assert.doesNotMatch(autoCopy.forRewrite.prompt, /watercolor/u, "the rewrite model gets it as guidance only");
// The vendored shared helper still drops it: it predates Pasta-Devs/Marinara-Engine#7357.
assert.equal(
  resolveImageStyleGuidanceText(autoCopyProfiles, "auto-copy"),
  "",
  "the vendored resolveImageStyleGuidanceText changed; Noodle's own style guidance may no longer be needed",
);

// ── The real generateNoodlePostImage, with storage, providers and the rewrite model stubbed ──────
const servicePath = new URL(
  "../packages/noodle/src/engine/packages/server/src/services/noodle/noodle-public-images.service.ts",
  import.meta.url,
);
const service = readFileSync(servicePath, "utf8");
const start = service.indexOf("export function imageAppearanceOverride");
const end = service.indexOf("export function createPublicNoodleImagesService");
assert.ok(start > 0 && end > start, "generateNoodlePostImage moved; update this regression");
const functions = stripTypeScriptTypes(service.slice(start, end).replace(/^export /gmu, ""));

// The illustrator references Noodle bundles: the vendored copy in sources/engine, with picture files stubbed.
const referencesSource = readFileSync(
  new URL("../sources/engine/packages/server/src/services/image/illustrator-references.ts", import.meta.url),
  "utf8",
);
const references: Record<string, unknown> = {
  stripMacroComments,
  readAvatarBase64: (avatarPath: string | null | undefined) => (avatarPath ? `avatar:${avatarPath}` : undefined),
  readPreferredFullBodySpriteBase64: () => undefined,
};
runInNewContext(
  stripTypeScriptTypes(referencesSource.replace(/^import .*$/gmu, "").replace(/^export /gmu, "")),
  references,
);
assert.equal(typeof references.resolveIllustratorCharacterReferences, "function", "update this regression");

// Image Generation Appearance Overrides: Dottore's, a card outside the refresh, and the user's persona's.
const dottoreOverride = "tall, white plague mask, lab coat, crimson eyes";
const dottoreOverrideLine = `Dottore's Appearance: ${dottoreOverride}`;
const columbinaOverrideLine = "Columbina's Appearance: 1girl, white dress, eye mask";
const personaOverrideLine = "Kasia's Appearance: 1girl, red hair, green eyes, freckles";
const columbina = {
  id: "columbina",
  avatarPath: "columbina.png",
  data: {
    name: "Columbina",
    extensions: {
      appearance: "a pale woman in a white dress",
      imageAppearanceEnabled: true,
      imageAppearance: "1girl, white dress, eye mask",
    },
  },
};
const personaRow = {
  id: "kasia",
  name: "Kasia",
  appearance: "long red hair and freckles",
  avatarPath: "kasia.png",
  // Persona rows store the switch as text.
  imageAppearanceEnabled: "true",
  imageAppearance: "1girl, red hair, green eyes, freckles",
};
// Its handle does not contain its name, so only an @mention finds it by handle.
const personaAccount = { kind: "persona", entityId: "kasia", displayName: "Kasia", handle: "moonlit" };

type RewriteInput = {
  prompt: string;
  instructions?: string;
  characterContext?: string;
  styleGuidance?: string;
  noodleConnectionId?: string | null;
  extraGuidance?: ReadonlyArray<string | null | undefined>;
};

async function postImagePrompt(options: {
  profileId: string;
  interpret: boolean;
  rewrite?: string | null;
  promptOverride?: { prompt: string };
  characterConnectionId?: string;
  /** Dottore's Image Generation Appearance Override is on. */
  override?: boolean;
  postContent?: string;
  /** The refresh has the user's persona. */
  persona?: boolean;
  includeDescriptions?: boolean;
  avatarReferences?: boolean;
  /** Generate the image instead of previewing its prompt; the prompt is then the one sent. */
  send?: boolean;
}) {
  const rewrites: RewriteInput[] = [];
  const warnings: string[] = [];
  const debugLines: string[] = [];
  const sent: Array<{ prompt: string; referenceImages?: string[] }> = [];
  const character = {
    id: "dottore",
    avatarPath: "dottore.png",
    data: {
      name: "Dottore",
      personality,
      extensions: {
        appearance: "blue hair and a white mask",
        ...(options.override ? { imageAppearanceEnabled: true, imageAppearance: dottoreOverride } : {}),
        applyConversationImageInstructionsToNoodle: true,
        conversationImageInstructions: imageHabits,
        noodleImageConnectionId: options.characterConnectionId,
      },
    },
  };
  const context = {
    input: {
      account: { kind: "character", entityId: "dottore", displayName: "Dottore", handle: "dottore" },
      referenceAccounts: [],
      personaAccount: options.persona ? personaAccount : null,
      postContent: options.postContent ?? "I left one meeting unattended for six minutes.",
      draftPrompt: draft,
      settings: {
        imageGenerationPrompt: "",
        imageGenerationIncludeDescriptions: options.includeDescriptions ?? true,
        imageGenerationUseAvatarReferences: options.avatarReferences ?? false,
        enableImageInterpretation: options.interpret,
        generationConnectionId: "noodle-writer",
        imageWidth: 1024,
        imageHeight: 1024,
      },
      characters: {
        getById: async (id: string) => (id === "dottore" ? character : null),
        list: async () => [character, columbina],
        getPersona: async (id: string) => (id === personaRow.id ? personaRow : null),
      },
      characterGallery: {},
      promptOverrides: {},
      imageConnection: { id: "comfy", model: "", imagePromptInstructions: connectionInstructions },
      db: {},
      debugMode: true,
      previewOnly: !options.send,
      promptOverride: options.promptOverride,
    },
    styleProfiles: styleProfiles(options.profileId),
    NOODLE_IMAGE_POST,
    PROFESSOR_MARI_ID: "professor-mari",
    compileImagePrompt,
    compileNoodleImagePrompts,
    resolveImageStyleGuidanceText,
    noodleTextMentionsHandle,
    stripMacroComments,
    loadImageGenerationUserSettings: async () => ({ styleProfiles: context.styleProfiles }),
    resolveConnectionImageDefaults: () => undefined,
    resolveImageConnectionFallback: async () => null,
    createConnectionsStorage: () => ({
      getWithKey: async (id: string) =>
        ({
          "dottore-comfy": { id, provider: "image_generation", model: "", imagePromptInstructions: "Lab photo tags." },
          "dottore-text": { id, provider: "openai", model: "", imagePromptInstructions: "Not an image connection." },
        })[id] ?? null,
    }),
    loadPrompt: async (
      _storage: unknown,
      def: typeof NOODLE_IMAGE_POST,
      ctx: Parameters<typeof def.defaultBuilder>[0],
    ) => def.defaultBuilder(ctx),
    parseRecord: (value: unknown) => (value && typeof value === "object" ? value : {}),
    readIllustratorAppearance: references.readIllustratorAppearance,
    normalizeIllustratorAppearance: references.normalizeIllustratorAppearance,
    resolveIllustratorCharacterReferences: references.resolveIllustratorCharacterReferences,
    characterNameFromRow: (row: { data: { name: string } }) => row.data.name,
    rewriteNoodleImagePrompt: async (rewriteInput: RewriteInput) => {
      rewrites.push(rewriteInput);
      return options.rewrite ?? null;
    },
    resolveImagePromptReviewSize: () => ({ width: 1024, height: 1024 }),
    generateNoodleImageWithRetry: (run: () => Promise<unknown>) => run(),
    generateImage: async (...args: unknown[]) => {
      sent.push(args[4] as (typeof sent)[number]);
      return { base64: "AAAA", ext: "png" };
    },
    stageImageToDisk: () => ({ filePath: "dottore/post.png" }),
    noodleImageExtension: () => "png",
    characterGalleryImageUrl: () => "/gallery/dottore/post.png",
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
  const generated = (await context.result) as { preview: { prompt: string } | null };
  return {
    prompt: options.send ? sent[0]!.prompt : generated.preview!.prompt,
    // Copied out of the vm context, whose arrays never deep-equal this one's.
    referenceImages: [...(sent[0]?.referenceImages ?? [])],
    rewrites,
    warnings,
    debugLines,
  };
}

const leaks = [/User image instructions/u, /Danbooru tags only/u, /precise, arrogant/u, /stark lab photography/u];
const assertNoInstructionText = (prompt: string) => {
  for (const leak of leaks) assert.doesNotMatch(prompt, leak, prompt);
  assert.match(prompt, /ruined lab bench/u, prompt);
};

// ── The real rewriteNoodleImagePrompt, with storage and the text model stubbed ──────────────────
const rewritePath = new URL(
  "../packages/noodle/src/engine/packages/server/src/services/noodle/noodle-image-prompt-rewrite.ts",
  import.meta.url,
);
const rewriteSource = readFileSync(rewritePath, "utf8");
const rewriteStart = rewriteSource.indexOf("const MAX_REWRITTEN_PROMPT_LENGTH");
assert.ok(rewriteStart > 0, "rewriteNoodleImagePrompt moved; update this regression");
const rewriteFunctions = stripTypeScriptTypes(rewriteSource.slice(rewriteStart).replace(/^export /gmu, ""));

async function runRewrite(options: { agentsDefault: boolean; answer: string; noodleConnectionId?: string }) {
  const used: string[] = [];
  const sent: string[] = [];
  const connection = (id: string) => ({ id, provider: "openai", model: "m" });
  const context = {
    input: {
      db: {},
      prompt: draft,
      instructions: connectionInstructions,
      characterContext: `Appearance:\n${appearance}`,
      styleGuidance: "Danbooru-tagged anime generation for SDXL, Illustrious, Pony, NovelAI, and similar checkpoints.",
      noodleConnectionId: options.noodleConnectionId,
      extraGuidance: ["Shares stark lab photography with cold lighting and clinical framing."],
    },
    createConnectionsStorage: () => ({
      getDefaultForAgents: async () => (options.agentsDefault ? connection("agents-default") : null),
      getWithKey: async (id: string) => connection(id),
      getFallbackForAgents: async () => null,
    }),
    createPromptOverridesStorage: () => ({}),
    loadPrompt: async () => "Interpret the style.",
    NOODLE_IMAGE_INTERPRET: {},
    resolveBaseUrl: () => "",
    resolveIllustratorPromptRuntime: async (args: { defaultConnectionId: string }) => {
      used.push(args.defaultConnectionId);
      return {
        model: "m",
        suppressModelParameters: false,
        enableCaching: false,
        anthropicExtendedCacheTtl: false,
        provider: {
          chatComplete: async (messages: Array<{ content: string }>) => {
            sent.push(messages.map((message) => message.content).join("\n"));
            return { content: JSON.stringify({ prompt: options.answer }) };
          },
        },
      };
    },
    removeCopiedPromptGuidance,
    logger: { warn: () => undefined },
    result: undefined as unknown,
  };
  runInNewContext(`${rewriteFunctions}\nresult = rewriteNoodleImagePrompt(input);`, context);
  return { prompt: (await context.result) as string | null, used, sent };
}

async function rewriteChecks() {
  // Before 1.5.3 no Agents default meant no rewrite, so the image settings were silently dropped.
  const noodleOnly = await runRewrite({ agentsDefault: false, noodleConnectionId: "noodle-writer", answer: "1BOY" });
  assert.deepEqual(noodleOnly.used, ["noodle-writer"]);
  assert.equal(noodleOnly.prompt, "1BOY");
  assert.match(noodleOnly.sent[0]!, /<image_prompting_instructions>/u);
  const agentsFirst = await runRewrite({ agentsDefault: true, noodleConnectionId: "noodle-writer", answer: "1BOY" });
  assert.deepEqual(agentsFirst.used, ["agents-default"], "an Agents default still wins");

  // A rewrite that copies the guidance word for word has those sentences removed; its tags stay.
  const copied = await runRewrite({
    agentsDefault: true,
    answer:
      "Danbooru-tagged anime generation for SDXL, Illustrious, Pony, NovelAI, and similar checkpoints, 1boy, solo, " +
      "white mask. Write comma-separated Danbooru tags only. Shares stark lab photography with cold lighting and clinical framing.",
  });
  assert.equal(copied.prompt, "1boy, solo, white mask.");
  // A rewrite that is nothing but copied guidance counts as no rewrite: the caller sends the base prompt.
  const onlyCopied = await runRewrite({ agentsDefault: true, answer: "Write comma-separated Danbooru tags only." });
  assert.equal(onlyCopied.prompt, null);
  assert.equal(
    removeCopiedPromptGuidance("masterpiece, best quality, 1boy", ["masterpiece, best quality"]),
    "masterpiece, best quality, 1boy",
    "tag lists are never removed",
  );
  assert.equal(
    removeCopiedPromptGuidance("1boy, cold lighting with deep shadows", ["cold lighting with deep shadows"]),
    "1boy, cold lighting with deep shadows",
    "a tag phrase that isn't written as a sentence stays",
  );
  assert.equal(
    removeCopiedPromptGuidance("1boy, Use moody lighting and show long shadows in rain., solo", [
      "Use moody lighting\nand show long shadows in rain.",
    ]),
    "1boy, solo",
    "a sentence wrapped over two lines is still one sentence",
  );
}

async function main() {
  // Interpret image prompts off: no prompt writer, so nothing written for one reaches the image model.
  const off = await postImagePrompt({ profileId: "danbooru", interpret: false });
  assertNoInstructionText(off.prompt);
  assert.match(off.prompt, /Dottore's Appearance: blue hair/u, "Include descriptions adds the notes as written");
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
  // Include descriptions (Pasta-Devs/Marinara-Agents#1282): the appearance notes reach the rewrite model
  // as context, not inside the prompt it edits, where they came back as plain text.
  assert.match(rewriteInput!.characterContext ?? "", /Appearance:\nDottore's Appearance: blue hair/u);
  assert.doesNotMatch(rewriteInput!.prompt, /Dottore's Appearance/u, rewriteInput!.prompt);
  // Without an Agents default, Noodle's own text connection does the rewrite, and the card's image
  // habits count as guidance it must not copy.
  assert.equal(rewriteInput!.noodleConnectionId, "noodle-writer");
  assert.deepEqual([...(rewriteInput!.extraGuidance ?? [])], [imageHabits]);

  // A character's own image connection (Edit profile) replaces the Noodle one; a connection that is not
  // an image connection is ignored.
  const ownConnection = await postImagePrompt({
    profileId: "danbooru",
    interpret: true,
    rewrite: "1boy",
    characterConnectionId: "dottore-comfy",
  });
  assert.equal(ownConnection.rewrites[0]!.instructions, "Lab photo tags.");
  const wrongProvider = await postImagePrompt({
    profileId: "danbooru",
    interpret: true,
    rewrite: "1boy",
    characterConnectionId: "dottore-text",
  });
  assert.equal(wrongProvider.rewrites[0]!.instructions, connectionInstructions);

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

  for (const [name, check] of appearanceOverrideChecks) {
    try {
      await check();
    } catch (error) {
      throw new Error(`Image Generation Appearance Override check failed: ${name}`, { cause: error });
    }
  }
  await rewriteChecks();
  console.log("noodle-image-prompt-instructions regression passed");
}

const occurrences = (text: string, part: string) => text.split(part).length - 1;
const plainAppearance = /blue hair and a white mask|long red hair and freckles|a pale woman/u;

// Pasta-Devs/Marinara-Agents#2182: with Include descriptions on, a depicted card's Image Generation Appearance
// Override reaches the image model as written, the user's persona's too.
const appearanceOverrideChecks: Array<[string, () => Promise<void>]> = [
  [
    "a rewrite keeps the override word for word, and only the override",
    async () => {
      const options = { profileId: "danbooru", interpret: true, rewrite: "1boy, rewritten tags", override: true };
      const preview = await postImagePrompt(options);
      const sent = await postImagePrompt({ ...options, send: true });
      assert.equal(sent.prompt, `1boy, rewritten tags\n\n${dottoreOverrideLine}`);
      assert.equal(preview.prompt, sent.prompt, "the review shows the prompt that is sent");
      assert.doesNotMatch(sent.prompt, plainAppearance, "plain Appearance stays rewrite-model context (#1282)");
      assert.match(sent.rewrites[0]!.characterContext ?? "", new RegExp(`Appearance:\\n${dottoreOverrideLine}`, "u"));
      assert.doesNotMatch(sent.rewrites[0]!.prompt, /Appearance/u, "the prompt it edits still leaves it out");
      assert.ok(sent.debugLines.some((line) => /Appearance Override added as written/u.test(line)));
    },
  ],
  [
    "without an override a rewrite adds nothing (#1282)",
    async () => {
      const sent = await postImagePrompt({ profileId: "danbooru", interpret: true, rewrite: "1boy", send: true });
      assert.equal(sent.prompt, "1boy");
    },
  ],
  [
    "without a rewrite the appearance notes carry the override once",
    async () => {
      for (const options of [
        { profileId: "danbooru", interpret: false, override: true },
        { profileId: "danbooru", interpret: true, rewrite: null, override: true },
      ]) {
        const { prompt } = await postImagePrompt({ ...options, send: true });
        assert.equal(occurrences(prompt, dottoreOverrideLine), 1, prompt);
        assert.doesNotMatch(prompt, plainAppearance, prompt);
      }
    },
  ],
  [
    "a reviewed prompt is sent as the player left it",
    async () => {
      const reviewed = await postImagePrompt({
        profileId: "danbooru",
        interpret: true,
        rewrite: "unused",
        override: true,
        persona: true,
        postContent: "Dinner with Kasia tonight.",
        promptOverride: { prompt: "1boy, my own tags" },
        send: true,
      });
      assert.equal(reviewed.prompt, "1boy, my own tags");
    },
  ],
  [
    "a card outside the refresh that the post names gets its override too",
    async () => {
      const postContent = "Columbina borrowed my lab coat.";
      const rewritten = await postImagePrompt({
        profileId: "danbooru",
        interpret: true,
        rewrite: "2people",
        postContent,
      });
      assert.equal(rewritten.prompt, `2people\n\n${columbinaOverrideLine}`);
      const off = await postImagePrompt({ profileId: "danbooru", interpret: false, postContent });
      assert.equal(occurrences(off.prompt, columbinaOverrideLine), 1, off.prompt);
    },
  ],
  [
    "a post that names the persona depicts it",
    async () => {
      for (const postContent of ["Dinner with Kasia tonight.", "@moonlit you missed the demo."]) {
        const options = { profileId: "danbooru", persona: true, avatarReferences: true, postContent, send: true };
        const rewritten = await postImagePrompt({ ...options, interpret: true, rewrite: "1boy, 1girl" });
        assert.equal(rewritten.prompt, `1boy, 1girl\n\n${personaOverrideLine}`, postContent);
        assert.match(rewritten.rewrites[0]!.characterContext ?? "", new RegExp(personaOverrideLine, "u"));
        assert.deepEqual(rewritten.referenceImages, ["avatar:dottore.png", "avatar:kasia.png"]);
        const off = await postImagePrompt({ ...options, interpret: false });
        assert.equal(occurrences(off.prompt, personaOverrideLine), 1, off.prompt);
        assert.doesNotMatch(
          off.prompt,
          /long red hair and freckles/u,
          "the override wins over the persona's Appearance",
        );
      }
    },
  ],
  [
    "a post that does not name the persona leaves it out",
    async () => {
      const sent = await postImagePrompt({
        profileId: "danbooru",
        interpret: true,
        rewrite: "1boy",
        persona: true,
        avatarReferences: true,
        send: true,
      });
      assert.equal(sent.prompt, "1boy");
      assert.doesNotMatch(sent.rewrites[0]!.characterContext ?? "", /Kasia/u);
      assert.deepEqual(sent.referenceImages, ["avatar:dottore.png"]);
    },
  ],
  [
    "Include descriptions off adds no appearance; Use avatar references still sends the persona's picture",
    async () => {
      for (const interpret of [true, false]) {
        const sent = await postImagePrompt({
          profileId: "danbooru",
          interpret,
          rewrite: "1boy, 1girl",
          override: true,
          persona: true,
          includeDescriptions: false,
          avatarReferences: true,
          postContent: "Dinner with Kasia tonight.",
          send: true,
        });
        assert.doesNotMatch(sent.prompt, /Appearance/u, sent.prompt);
        for (const rewrite of sent.rewrites) assert.doesNotMatch(rewrite.characterContext ?? "", /Appearance/u);
        assert.deepEqual(sent.referenceImages, ["avatar:dottore.png", "avatar:kasia.png"]);
      }
    },
  ],
];

void main();
