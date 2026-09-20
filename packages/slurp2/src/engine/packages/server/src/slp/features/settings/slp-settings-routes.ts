import {
  normalizeSlurpPromptBlockOverrides,
  slurpPromptDescriptions,
  slurpPromptEditableDefaults,
} from "../../base/prompting/slp-prompt-blocks.js";
import { SLURP_PROMPT_MODES, slurpPromptMode } from "../../base/prompting/slp-prompt-modes.js";
import { DEFAULT_SLURP_SETTINGS, slurpSettingsSchema } from "../../modules/settings/slp-settings.js";
import { getSlurpModelBudgetLedger } from "../../base/model/slp-model-worker.js";
import { resolveSlurpTextConnection } from "../../base/identity/slp-connection.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import { isConnectionAdmissionFailure } from "../../../services/generation/connection-admission.js";
import type { FastifyInstance } from "fastify";
import type { SlpRouteDeps } from "../viewer/slp-viewer-contract.js";
import { z } from "zod";
import { getErrorMessage } from "../../modules/creators/slp-public-support.js";
import { generateCreatorPost, previewSlurpPromptBlocks } from "../feed/slp-feed-contract.js";
import { SLURP_PROMPT_IDS } from "../../base/prompting/slp-prompt-blocks.js";

const slurpPromptPreviewSchema = z.object({
  promptId: z.enum(SLURP_PROMPT_IDS),
  mode: z.enum(SLURP_PROMPT_MODES),
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

  // The inventory is per mode, so the builder must say which one it is editing. An unknown or
  // absent mode falls back to the shipped default rather than erroring: a stale client should get
  // a usable panel, not a broken one.
  app.get("/settings/prompt-blocks", async (req) => {
    const mode = slurpPromptMode((req.query as { mode?: unknown } | undefined)?.mode);
    const defaults = slurpPromptEditableDefaults(mode);
    return {
      mode,
      modes: SLURP_PROMPT_MODES,
      prompts: slurpPromptDescriptions(mode).map((prompt) => ({
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
      normalizeSlurpPromptBlockOverrides({
        produce: body.data.promptBlocks ?? settings.promptBlocks.produce,
      }).produce ?? {};
    try {
      const result = await generateCreatorPost(app.db, {
        account,
        connection,
        prepareOnly: true,
        previewOnly: true,
        promptMode: "produce",
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
      };
    } catch (error) {
      if (isConnectionAdmissionFailure(error)) return reply.code(409).send({ error: getErrorMessage(error) });
      return reply.code(500).send({ error: `Prompt preview failed: ${getErrorMessage(error)}` });
    }
  });
  // The shipped values, so Settings can show what differs and reset one section.
  app.get("/settings/defaults", async () => DEFAULT_SLURP_SETTINGS);
  app.patch("/settings", async (req, reply) => {
    const body = slurpSettingsSchema.partial().safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    return noodle.updateSlurpSettings(body.data);
  });
  app.get("/model-budget/usage", async () => getSlurpModelBudgetLedger(app.db));
}
