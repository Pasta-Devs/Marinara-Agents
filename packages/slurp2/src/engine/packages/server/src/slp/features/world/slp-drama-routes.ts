import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { SlpRouteDeps } from "../viewer/slp-viewer-contract.js";
import { createSlurpMessagesStorage, createSlurpStorage } from "../../data/slp-storage.js";
import { SLP_STORYLINES_OFF, slpExtensionOn } from "../../../../../shared/src/slp/slp-extensions.js";
import { readSlurpDramaLibrary, readSlurpDramaState } from "../../data/world/slp-drama-storage.js";
import { slpDramaCatalog, slpStorylineStands } from "../../modules/world/events/slp-drama-library.js";
import { answerSlurpDramaChoice } from "./slp-drama-service.js";
import { SLURP_CONTENT_PACK_LIBRARY } from "../../modules/world/events/slp-content-pack-library.js";
import { slurpContentPackOn } from "../../modules/world/events/slp-content-packs.js";
import { runSlurpDramaLever } from "./slp-drama-levers.js";

const RECENT = 12;
/** A built-in pack's storyline: its pack switch turns it on, not the drama list. */
const packOf = (id: string, toggles: Readonly<Record<string, boolean>>) => {
  const pack = SLURP_CONTENT_PACK_LIBRARY.find((entry) => entry.storylines?.some((storyline) => storyline.id === id));
  return pack ? { name: pack.name, on: slurpContentPackOn(pack, toggles) } : null;
};

/**
 * Drama (`docs/DRAMA.md`) for Stir and the thread view: what can run and what runs now, with its
 * cast, stage and story so far; the player's answer to a drama's question; ending a drama.
 */
export async function slpDramaRoutes(app: FastifyInstance, { noodle, resolveViewerPersona }: SlpRouteDeps) {
  const personaSchema = z.object({ personaId: z.string().trim().min(1) }).passthrough();

  // Install-wide, like the settings it goes with: no persona needed to read it.
  app.get("/slurp/drama", async () => {
    const [settings, accounts] = await Promise.all([noodle.getSettings(), noodle.listNoodlerAccounts()]);
    const library = await readSlurpDramaLibrary(app.db);
    const { state } = await readSlurpDramaState(app.db);
    const catalog = slpDramaCatalog(library);
    const names = new Map(accounts.map((account) => [account.id, account.displayName]));
    const cast = (entry: Record<string, string>) =>
      Object.fromEntries(Object.entries(entry).map(([role, id]) => [role, { id, name: names.get(id) ?? null }]));
    const newest = <T extends { startedAt: string; endedAt: string | null }>(list: readonly T[]): T[] => [
      ...list.filter((entry) => !entry.endedAt),
      ...list
        .filter((entry) => entry.endedAt)
        .sort((a, b) => b.endedAt!.localeCompare(a.endedAt!))
        .slice(0, RECENT),
    ];
    return {
      settings: settings.drama,
      catalog: [
        ...catalog.situations.map((entry) => ({
          id: entry.id,
          kind: "situation" as const,
          name: entry.name,
          description: entry.description,
          builtin: entry.builtin,
          dials: entry.dials,
          requires: null,
        })),
        ...catalog.dramas.map((entry) => ({
          id: entry.id,
          kind: "drama" as const,
          name: entry.name,
          description: entry.description,
          builtin: entry.builtin,
          dials: [],
          requires: entry.requires?.situation ?? null,
        })),
        // v2 entries, listed by their shape.
        ...catalog.storylines.map((entry) => ({
          id: entry.id,
          kind: slpStorylineStands(entry) ? ("situation" as const) : ("drama" as const),
          name: entry.name,
          description: entry.description,
          builtin: false,
          dials: entry.dials,
          pack: packOf(entry.id, settings.contentPacks ?? {}),
          requires: entry.start.within?.replace(/^situation:/, "") ?? null,
        })),
      ],
      runs: newest(state.runs).map((run) => ({ ...run, cast: cast(run.cast) })),
      situations: newest(state.situations).map((run) => ({ ...run, cast: cast(run.cast) })),
    };
  });

  /** The player tapped an answer under a drama's question in a DM. */
  app.post("/slurp/drama/choice", async (req, reply) => {
    const parsed = personaSchema
      .extend({ messageId: z.string().trim().min(1), option: z.number().int().min(0).max(3) })
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (!(await resolveViewerPersona(parsed.data.personaId)))
      return reply.code(404).send({ error: "Slurp persona not found" });
    const messages = createSlurpMessagesStorage(app.db);
    const message = await messages.getMessageById(parsed.data.messageId);
    const thread = message ? await messages.getThreadById(message.threadId) : null;
    const choice = message?.metadata?.dramaChoice as
      { runId?: unknown; stage?: unknown; options?: unknown; chosen?: unknown } | undefined;
    if (!message || !thread || thread.viewerAccountId !== parsed.data.personaId || typeof choice?.runId !== "string")
      return reply.code(404).send({ error: "That question is gone." });
    const options = Array.isArray(choice.options) ? choice.options : [];
    if (choice.chosen !== null && choice.chosen !== undefined)
      return reply.code(409).send({ error: "You already answered." });
    if (parsed.data.option >= options.length) return reply.code(400).send({ error: "That is not one of the answers." });
    if (!slpExtensionOn(await createSlurpStorage(app.db).getSettings(), "storylines"))
      return reply.code(409).send({ error: SLP_STORYLINES_OFF });
    const answered = await answerSlurpDramaChoice(app.db, {
      runId: choice.runId,
      option: parsed.data.option,
      ...(typeof choice.stage === "string" ? { stage: choice.stage } : {}),
    });
    // A second quick tap ("taken") writes nothing, so it never turns the real answer into "late".
    if (answered === "taken") return reply.code(409).send({ error: "You already answered." });
    await messages.mergeMessageMetadata(message.id, {
      dramaChoice: { ...choice, chosen: answered === "answered" ? parsed.data.option : "late" },
    });
    return answered === "answered"
      ? { chosen: parsed.data.option }
      : reply.code(409).send({ error: "Too late: it already went the other way." });
  });

  /**
   * Start a switched-on drama now, or end one: the same levers as Stir's `start-drama` / `end-drama`
   * (0.3.11), for callers that do not keep a play in the ledger.
   */
  app.post("/slurp/drama/start", async (req, reply) => {
    const parsed = personaSchema.extend({ dramaId: z.string().trim().min(1).max(64) }).safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (!(await resolveViewerPersona(parsed.data.personaId)))
      return reply.code(404).send({ error: "Slurp persona not found" });
    const ran = await runSlurpDramaLever(app.db, "start-drama", { dramaId: parsed.data.dramaId });
    return ran.ok ? { started: true } : reply.code(ran.status).send({ error: ran.error });
  });

  /** End a running drama now: no goodbye post, nothing more goes out. */
  app.post("/slurp/drama/runs/:id/end", async (req, reply) => {
    const parsed = personaSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (!(await resolveViewerPersona(parsed.data.personaId)))
      return reply.code(404).send({ error: "Slurp persona not found" });
    const ran = await runSlurpDramaLever(app.db, "end-drama", { runId: (req.params as { id: string }).id });
    return ran.ok ? { ended: true } : reply.code(ran.status).send({ error: ran.error });
  });
}
