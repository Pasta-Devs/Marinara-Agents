import {
  normalizeSlurpPromptBlockOverrides,
  slurpClassicPromptPreset,
  slurpPromptDescriptions,
  slurpPromptEditableDefaults,
} from "../../base/prompting/slp-prompt-blocks.js";
import { slpIsAdmissionFailure } from "../../base/host/slp-admission.js";
import { normalizeSlurpSettings, slurpSettingsPatchSchema } from "../../modules/settings/slp-settings.js";
import {
  countSlurpActiveCreators,
  getSlurpModelBudgetLedger,
  resolveSlurpModelBudget,
  SLURP_TOKENS_PER_CALL_ESTIMATE,
  slurpSizedPostsPerDay,
} from "../../base/model/slp-model-worker.js";
import { resolveSlurpTextConnection } from "../../base/identity/slp-connection.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import type { FastifyInstance } from "fastify";
import type { SlpRouteDeps } from "../viewer/slp-viewer-contract.js";
import { z } from "zod";
import { SLP_EXTRAS_OFFER_ORDER } from "../../../../../shared/src/slp/slp-extras-offer.js";
import { answerSlurpExtrasOffer, readSlurpExtrasOffer } from "../../data/settings/slp-extras-offer-storage.js";
import { getErrorMessage } from "../../modules/creators/slp-public-support.js";
import { generateCreatorPost, previewSlurpPromptBlocks } from "../feed/slp-feed-contract.js";
import { SLURP_PROMPT_IDS } from "../../base/prompting/slp-prompt-blocks.js";
import {
  countSlurpPendingText,
  slurpRewritingAllPending,
  startSlurpRewriteAllPending,
} from "../world/slp-world-contract.js";

const slurpPromptPreviewSchema = z.object({
  promptId: z.enum(SLURP_PROMPT_IDS),
  creatorAccountId: z.string().trim().min(1),
  promptBlocks: z.unknown().optional(),
  promptInstructions: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(80),
        name: z.string().trim().min(1).max(120),
        text: z.string().trim().max(20_000),
        builtin: z.boolean().optional(),
      }),
    )
    .max(100)
    .optional(),
});

const slurpPromptResultPreviewSchema = slurpPromptPreviewSchema.extend({
  promptId: z.literal("post"),
  access: z.enum(["public", "locked"]).default("public"),
  format: z.enum(["caption", "announcement", "long_form"]).default("caption"),
  direction: z.string().trim().max(2000).optional(),
});

export async function slpSettingsRoutes(app: FastifyInstance, deps: SlpRouteDeps) {
  const { noodle } = deps;
  app.get("/settings", async () => noodle.getSlurpSettings());

  // `classicPreset` is a layout the builder can load into its draft. Loading it changes prompt
  // text only; nothing is saved until the player saves.
  app.get("/settings/prompt-blocks", async () => {
    const defaults = slurpPromptEditableDefaults();
    const settings = await noodle.getSettings();
    return {
      classicPreset: slurpClassicPromptPreset(settings.classicPromptBlocks),
      prompts: slurpPromptDescriptions().map((prompt) => ({
        ...prompt,
        blocks: prompt.blocks.map((block) => ({
          ...block,
          defaultText: defaults[prompt.id]?.[block.id] ?? "",
        })),
      })),
    };
  });
  // The block builder could reorder required blocks but never show them, so the text protecting
  // privacy and output shape was the one text a player could not read. Read-only, no model call,
  // and it runs the generator's own identity protection: a Secret Creator's details must not leak
  // into the settings panel any more than into a post.
  app.post("/settings/prompt-blocks/preview", async (req, reply) => {
    const body = slurpPromptPreviewSchema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    try {
      return await previewSlurpPromptBlocks(app.db, body.data);
    } catch (error) {
      return reply.code(404).send({ error: getErrorMessage(error) });
    }
  });
  app.post("/settings/prompt-blocks/generate-preview", async (req, reply) => {
    const body = slurpPromptResultPreviewSchema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const account = await noodle.getNoodlerAccountById(body.data.creatorAccountId);
    if (!account) return reply.code(404).send({ error: "That Creator no longer exists." });
    const settings = await noodle.getSettings();
    const connection = await resolveSlurpTextConnection(
      createConnectionsStorage(app.db),
      settings.generationConnectionId,
    );
    if (!connection) return reply.code(400).send({ error: "Select a Slurp generation connection first." });
    const promptBlocks =
      body.data.promptBlocks === undefined
        ? settings.promptBlocks
        : normalizeSlurpPromptBlockOverrides(body.data.promptBlocks);
    try {
      const result = await generateCreatorPost(app.db, {
        account,
        connection,
        prepareOnly: true,
        previewOnly: true,
        promptBlocks,
        promptInstructions: body.data.promptInstructions,
        request: {
          mode: "noodler",
          targetAccountId: account.id,
          access: body.data.access,
          format: body.data.format,
          noodlerPostGuide: body.data.direction || undefined,
        },
      });
      return {
        title: result.title,
        content: result.content,
        imagePrompt: result.imagePrompt,
        compiledPrompt: result.compiledPrompt,
        scene: result.scene,
        wardrobeSelection: result.wardrobeSelection,
        visualBrief: result.visualBrief,
        imageBrief: result.imageBrief,
        providerPrompt: result.providerPrompt,
      };
    } catch (error) {
      if (slpIsAdmissionFailure(error)) return reply.code(409).send({ error: getErrorMessage(error) });
      return reply.code(500).send({ error: `Prompt preview failed: ${getErrorMessage(error)}` });
    }
  });
  // The shipped values, so Settings can show what differs and reset one section.
  // Normalized, like every stored value: the raw constant lacks the built-in instructions the
  // normalizer adds, so a fresh install read "1 setting differs" (R1-125).
  // "Posts per day" is shown sized for today's Creators, like the stored value an untouched one reads as.
  app.get("/settings/defaults", async () => ({
    ...normalizeSlurpSettings(null),
    postsPerDay: slurpSizedPostsPerDay(await countSlurpActiveCreators(app.db)),
  }));
  app.patch("/settings", async (req, reply) => {
    const body = slurpSettingsPatchSchema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    return noodle.updateSlurpSettings(body.data);
  });
  // The Creator count sizes every limit the player did not set; Settings shows the sized numbers.
  // Pulse (task C) shows today's use against the day's limit, so the sized limit and the mode come too.
  app.get("/model-budget/usage", async () => {
    const usage = {
      ...(await getSlurpModelBudgetLedger(app.db)),
      activeCreators: await countSlurpActiveCreators(app.db),
    };
    const settings = await createSlurpStorage(app.db).getSettings();
    const budget = resolveSlurpModelBudget(settings.modelBudget, usage.activeCreators);
    return {
      ...usage,
      mode: budget.mode,
      callsPerDayLimit: budget.callsPerDay,
      tokensPerCall: SLURP_TOKENS_PER_CALL_ESTIMATE,
      pendingRewrites: await countSlurpPendingText(app.db),
      rewritingAll: slurpRewritingAllPending(),
    };
  });
  // Support's offer of an extra that is still off; the client switches it on itself, then answers.
  app.get("/extras/offer", async () => ({ offer: await readSlurpExtrasOffer(app.db) }));
  app.post("/extras/offer/answer", async (req, reply) => {
    const body = z.object({ id: z.enum(SLP_EXTRAS_OFFER_ORDER), add: z.boolean() }).safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    return { ok: await answerSlurpExtrasOffer(app.db, body.data.id, body.data.add) };
  });
  // "Rewrite all pending" runs in the background; Settings polls the usage above for progress.
  app.post("/model-budget/rewrite-pending", async () => ({ started: startSlurpRewriteAllPending(app.db) }));
}
