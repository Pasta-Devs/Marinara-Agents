import {
  SLURP_PROMPT_DESCRIPTIONS,
  SLURP_PROMPT_EDITABLE_DEFAULTS,
} from "../../../services/slurp/slurp-prompt-blocks.js";
import { DEFAULT_SLURP_SETTINGS, slurpSettingsSchema } from "../../../services/storage/slurp.storage.js";
import { getSlurpModelBudgetLedger } from "../../../services/slurp/slurp-model-worker.js";
import type { FastifyInstance } from "fastify";
import type { SlpRouteDeps } from "../host/slp-viewer-context.js";

export async function slpSettingsRoutes(app: FastifyInstance, deps: SlpRouteDeps) {
  const { noodle } = deps;
  app.get("/settings", async () => noodle.getSlurpSettings());

  app.get("/settings/prompt-blocks", async () => ({
    prompts: SLURP_PROMPT_DESCRIPTIONS.map((prompt) => ({
      ...prompt,
      blocks: prompt.blocks.map((block) => ({
        ...block,
        defaultText: SLURP_PROMPT_EDITABLE_DEFAULTS[prompt.id]?.[block.id] ?? "",
      })),
    })),
  }));
  // The shipped values, so Settings can show what differs and reset one section.
  app.get("/settings/defaults", async () => DEFAULT_SLURP_SETTINGS);
  app.patch("/settings", async (req, reply) => {
    const body = slurpSettingsSchema.partial().safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    return noodle.updateSlurpSettings(body.data);
  });
  app.get("/model-budget/usage", async () => getSlurpModelBudgetLedger(app.db));
}
