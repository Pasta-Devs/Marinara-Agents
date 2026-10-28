import { resolveSlurpPostGuidance } from "../../data/settings/slp-post-guidance-storage.js";
import { SLURP_SECONDARY_IMAGE_COUNT } from "../media/slp-media-contract.js";
import type { DB } from "../../../db/connection.js";
import { listSlurpContinuityFor } from "../../data/continuity/slp-continuity-storage.js";
import { slurpContinuityInstruction } from "../../modules/continuity/slp-continuity-prompt.js";
import type { SlpAccount } from "../../../../../shared/src/slp/slp-social.types.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { buildSlurpPostBlocks } from "./slp-post-prompt.js";
import {
  composeSlurpPromptBlocks,
  normalizeSlurpPromptBlockOverrides,
  resolveSlurpPromptBlocks,
  type SlurpReusablePromptInstruction,
} from "../../base/prompting/slp-prompt-blocks.js";
import { resolveCreatorCharacterCanon } from "../../data/creators/slp-source-resolve.js";
import { resolveSlurpCreatorFlavour } from "../../data/creators/slp-flavour-source.js";
import { slpCreatorPublicIdentityFor } from "./slp-public-identity.js";
import { slurpPostVariation, slurpPostVariationInstruction } from "../../modules/feed/slp-post-variation.js";
import { slurpCameraSourceInstruction, slurpPostCameraSource } from "../../modules/feed/slp-camera-source.js";
import { slurpContentAxesInstruction, slurpPostAxes } from "../../modules/feed/slp-content-axes.js";
import { slurpCreatorStrategy, slurpStrategyInstruction } from "../../modules/creators/slp-creator-strategy.js";
import type { SlurpPromptId } from "../../base/prompting/slp-prompt-blocks.js";

export type SlurpPromptBlockPreview = {
  id: string;
  /** Empty when this block contributes nothing for the chosen Creator, which is itself worth seeing. */
  text: string;
};

export type SlurpPromptPreviewInput = {
  promptId: SlurpPromptId;
  creatorAccountId: string;
  promptBlocks?: unknown;
  promptInstructions?: SlurpReusablePromptInstruction[];
};

/**
 * What a prompt's blocks actually contain, for one Creator.
 *
 * The block builder could reorder required blocks but never show them, so the text protecting
 * privacy and output shape was the one text a player could not read. This renders the real blocks
 * from the real builder rather than a second copy of the strings: a preview built from a copy is a
 * preview that silently stops matching the prompt.
 *
 * Read-only, and no model is called. The Creator's own values reach this, so it runs the same
 * identity protection the generator does — a Secret Creator's details must not leak into the
 * settings panel any more than into a post.
 *
 * ponytail: `post` only. Its blocks are the ones this overhaul changed and the ones players ask
 * about. Every other prompt still composes its blocks inline at its own call site; giving them
 * previews means extracting each builder the way `buildSlurpPostBlocks` was extracted.
 */
export async function previewSlurpPromptBlocks(
  db: DB,
  input: SlurpPromptPreviewInput,
): Promise<{ supported: boolean; blocks: SlurpPromptBlockPreview[]; compiledText: string }> {
  if (input.promptId !== "post") return { supported: false, blocks: [], compiledText: "" };
  const slurp = createSlurpStorage(db);
  const account = await slurp.getAccountById(input.creatorAccountId);
  if (!account) throw new Error("That Creator no longer exists.");
  const settings = await slurp.getSettings();
  const disclosureMode = account.settings.privacy.identityDisclosure ?? "open";
  const linkedPublicAccount = await slurp.resolveAccountSource(account as SlpAccount);
  const publicIdentity = await slpCreatorPublicIdentityFor(db, linkedPublicAccount);
  const sourceCharacterContext = await resolveCreatorCharacterCanon(db, linkedPublicAccount, disclosureMode);

  // The next post this Creator would make, so the preview shows the rotation they are actually on
  // rather than a fixed sample that never matches what they publish.
  const sequence = await slurp.countNoodlerPostsByAccount(account.id);
  const variation = slurpPostVariation(account.id, sequence, settings.storyRate);
  const strategy = slurpCreatorStrategy(account.id, account.settings.strategy);
  const production = strategy.production;
  const camera = slurpPostCameraSource(account.id, sequence, {
    companyCanHoldCamera: variation.companyCanHoldCamera,
    prefers: production.prefers,
  });
  const axes = slurpPostAxes(account.id, sequence, {
    story: variation.story,
    teaser: false,
    images: account.settings.scheduler.autoPosting?.imagesEnabled === true,
    intentWeights: strategy.intentWeights,
    textOnlyRate: strategy.textOnlyRate,
  });

  const postImages = account.settings.scheduler.autoPosting?.imagesEnabled === true && axes.delivery !== "text_only";
  const blocks = buildSlurpPostBlocks({
    account,
    stagePersonality: account.settings.privacy.stagePersonality ?? "",
    sourceCharacterContext,
    // The character block reads differently when the brief is there; the preview shows the real one.
    flavourBrief: await resolveSlurpCreatorFlavour(db, {
      account,
      source: linkedPublicAccount,
      disclosureMode,
      use: "post",
      sequence,
    }),
    disclosureMode,
    publicIdentity,
    recentPosts: [],
    request: { format: variation.format },
    // The same picture path the post call takes (R1-126): a Creator that draws gets a scene plan
    // (and a scene per extra picture of a set), never the old `enableImagePrompts` flag.
    // ponytail: the wardrobe block is left out of the preview; add it when players ask about it.
    allowImagePrompt: false,
    allowScenePlan: postImages,
    sceneShots: postImages && axes.delivery === "multi_image_set" ? SLURP_SECONDARY_IMAGE_COUNT : 0,
    accessInstruction: await resolveSlurpPostGuidance(db, account.id, "public").catch(() => ""),
    imageGenerationPrompt: settings.imageGenerationPrompt,
    generationGuidance: settings.generationGuidance,
    postMaxLength: settings.postMaxLength,
    variationInstruction: slurpPostVariationInstruction(variation, slurpCameraSourceInstruction(camera)),
    contentTypeInstruction: slurpContentAxesInstruction(axes),
    continuityInstruction: slurpContinuityInstruction(
      await listSlurpContinuityFor(db, account.id, "public_post", { at: new Date(), limit: 20 }).catch(() => ({
        facts: [],
        events: [],
      })),
    ),
    productionInstruction: slurpStrategyInstruction(strategy),
    promptBlocks: settings.promptBlocks,
    promptInstructions: settings.promptInstructions,
  });
  const promptBlocks =
    input.promptBlocks === undefined ? settings.promptBlocks : normalizeSlurpPromptBlockOverrides(input.promptBlocks);
  const promptInstructions = input.promptInstructions ?? settings.promptInstructions;
  const resolvedBlocks = resolveSlurpPromptBlocks(input.promptId, blocks, promptBlocks, promptInstructions);
  return {
    supported: true,
    blocks: resolvedBlocks.map((block) => ({ id: block.id, text: block.text.trim() })),
    compiledText: composeSlurpPromptBlocks(input.promptId, blocks, promptBlocks, promptInstructions),
  };
}
