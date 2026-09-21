import type { DB } from "../../../db/connection.js";
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
import { slpCreatorPublicIdentityFor } from "./slp-public-identity.js";
import { slurpPostVariation, slurpPostVariationInstruction } from "../../modules/feed/slp-post-variation.js";
import { slurpCameraSourceInstruction, slurpPostCameraSource } from "../../modules/feed/slp-camera-source.js";
import { slurpContentAxesInstruction, slurpPostAxes } from "../../modules/feed/slp-content-axes.js";
import { slurpProductionInstruction, slurpProductionProfile } from "../../modules/creators/slp-production-profile.js";
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
  const production = slurpProductionProfile(account.id);
  const camera = slurpPostCameraSource(account.id, sequence, {
    companyCanHoldCamera: variation.companyCanHoldCamera,
    prefers: production.prefers,
  });
  const axes = slurpPostAxes(account.id, sequence, {
    story: variation.story,
    teaser: false,
    images: account.settings.scheduler.autoPosting?.imagesEnabled === true,
  });

  const blocks = buildSlurpPostBlocks({
    account,
    stagePersonality: account.settings.privacy.stagePersonality ?? "",
    sourceCharacterContext,
    disclosureMode,
    publicIdentity,
    recentPosts: [],
    request: { format: variation.format },
    allowImagePrompt: settings.enableImagePrompts,
    imageGenerationPrompt: settings.imageGenerationPrompt,
    generationGuidance: settings.generationGuidance,
    postMaxLength: settings.postMaxLength,
    variationInstruction: slurpPostVariationInstruction(variation, slurpCameraSourceInstruction(camera)),
    contentTypeInstruction: slurpContentAxesInstruction(axes),
    productionInstruction: slurpProductionInstruction(production),
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
