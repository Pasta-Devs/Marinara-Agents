import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  SLP_SPICE_LANGUAGES,
  SLP_SPICE_LEVELS,
  SLP_TASTE_NEVER_MAX,
  SLP_TASTE_STRENGTHS,
  SLP_TASTE_TEXT_MAX,
  SLP_TASTES_MAX,
  type SlpSpiceState,
} from "../../../../../shared/src/slp/slp-spice.js";
import { readSlurpSpice, updateSlurpSpice } from "../../data/creators/slp-spice-storage.js";
import { slurpAnswerNoticed, slurpNoticedTastes } from "../../modules/creators/slp-spice.js";
import { newId } from "../../../utils/id-generator.js";

const chip = z.string().trim().min(1).max(SLP_TASTE_TEXT_MAX);

/** What the Spice page shows. What Slurp learned stays on the server; the page gets the noticed chips. */
function view(state: SlpSpiceState) {
  return {
    spice: { max: state.max, tastes: state.tastes, never: state.never, language: state.language ?? "dirty" },
    noticed: slurpNoticedTastes(state, new Date()),
  };
}

/**
 * Backstage › Spice: the Slurp-wide limit, the player's taste with a strength per chip, the never
 * list, and the "Slurp noticed you like …" answers. No AI calls.
 */
export async function slpSpiceRoutes(app: FastifyInstance) {
  app.get("/slurp/spice", async () => view(await readSlurpSpice(app.db)));

  app.patch("/slurp/spice", async (req, reply) => {
    const parsed = z
      .object({
        max: z.enum(SLP_SPICE_LEVELS).optional(),
        tastes: z
          .array(
            z
              .object({
                id: z.string().trim().min(1).max(64).optional(),
                text: chip,
                strength: z.enum(SLP_TASTE_STRENGTHS),
              })
              .strict(),
          )
          .max(SLP_TASTES_MAX)
          .optional(),
        never: z.array(chip).max(SLP_TASTE_NEVER_MAX).optional(),
        /** Which words once it gets naked (0.3.17). */
        language: z.enum(SLP_SPICE_LANGUAGES).optional(),
      })
      .strict()
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { tastes, ...rest } = parsed.data;
    return view(
      await updateSlurpSpice(app.db, (current) => ({
        ...current,
        ...rest,
        ...(tastes ? { tastes: tastes.map((taste) => ({ ...taste, id: taste.id ?? newId() })) } : {}),
      })),
    );
  });

  /** "Slurp noticed you like …": add it, add it stronger (or strengthen it), or never suggest it again. */
  app.post("/slurp/spice/noticed", async (req, reply) => {
    const parsed = z
      .object({ label: chip, answer: z.enum(["accept", "stronger", "remove"]) })
      .strict()
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return view(
      await updateSlurpSpice(app.db, (current) =>
        slurpAnswerNoticed(current, parsed.data.label, parsed.data.answer, newId),
      ),
    );
  });
}
