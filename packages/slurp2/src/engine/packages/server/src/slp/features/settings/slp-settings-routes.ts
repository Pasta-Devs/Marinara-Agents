import { slurpPromptDescriptions, slurpPromptEditableDefaults } from "../../base/prompting/slp-prompt-blocks.js";
import { SLURP_PROMPT_MODES, slurpPromptMode } from "../../base/prompting/slp-prompt-modes.js";
import { DEFAULT_SLURP_SETTINGS, slurpSettingsSchema } from "../../modules/settings/slp-settings.js";
import { getSlurpModelBudgetLedger } from "../../base/model/slp-model-worker.js";
import type { FastifyInstance } from "fastify";
import type { SlpRouteDeps } from "../viewer/slp-viewer-contract.js";

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
  // The shipped values, so Settings can show what differs and reset one section.
  app.get("/settings/defaults", async () => DEFAULT_SLURP_SETTINGS);
  app.patch("/settings", async (req, reply) => {
    const body = slurpSettingsSchema.partial().safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    return noodle.updateSlurpSettings(body.data);
  });
  app.get("/model-budget/usage", async () => getSlurpModelBudgetLedger(app.db));
}
