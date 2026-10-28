/**
 * Take a DM thread out of Slurp (docs/FEEDBACK-2026-10.md R10): the whole conversation as text, or a
 * short summary for a lorebook or the Long-Term Memory agent. Either side of the thread may ask; each
 * reads what their side may see. The summary is the player's own tap, so it never spends the world's
 * AI budget (like Write and Improve, 0.3.6).
 */
import type { FastifyInstance } from "fastify";
import { resolveBaseUrl } from "../../../services/generation/connection-base-url.js";
import { createLLMProvider } from "../../../services/llm/provider-registry.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import { resolveSlurpTextConnection } from "../../base/identity/slp-connection.js";
import { slpWithProviderRetry } from "../../base/model/slp-provider-retry.js";
import { personaQuerySchema } from "../../modules/messages/slp-messages-schemas.js";
import {
  SLURP_EXPORT_MAX_MESSAGES,
  slurpThreadSummaryMessages,
  slurpThreadTranscript,
} from "../../modules/messages/slp-thread-export.js";
import type { SlpMessagesContext } from "./slp-messages-context.js";

export async function slpThreadExportRoutes(app: FastifyInstance, messaging: SlpMessagesContext) {
  const { maskForViewer, messages, requireViewer, seatIn, slurp } = messaging;

  /** The transcript this persona may read, with both names, or null for a 404. */
  const transcriptFor = async (personaId: string, threadId: string) => {
    const viewer = await requireViewer(personaId);
    const thread = viewer ? await messages.getThreadById(threadId) : null;
    const side = thread && viewer ? await seatIn(viewer.id, thread) : null;
    if (!thread || !side) return null;
    const rows = (await messages.listMessages(threadId, SLURP_EXPORT_MAX_MESSAGES)).map((message) =>
      side === "viewer" ? maskForViewer(message) : message,
    );
    const creator = await slurp.getNoodlerAccountById(thread.creatorAccountId);
    const names = {
      viewer: side === "viewer" ? viewer!.displayName || "Fan" : "Fan",
      creator: creator?.displayName ?? "Creator",
    };
    return { names, text: slurpThreadTranscript(rows, names) };
  };

  app.get("/messages/threads/:threadId/export", async (req, reply) => {
    const parsed = personaQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const found = await transcriptFor(parsed.data.personaId, (req.params as { threadId: string }).threadId);
    if (!found) return reply.code(404).send({ error: "Thread not found" });
    return { text: found.text };
  });

  app.post("/messages/threads/:threadId/summary", async (req, reply) => {
    const parsed = personaQuerySchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const found = await transcriptFor(parsed.data.personaId, (req.params as { threadId: string }).threadId);
    if (!found) return reply.code(404).send({ error: "Thread not found" });
    if (!found.text) return reply.code(409).send({ error: "There is nothing to sum up yet." });
    const settings = await slurp.getSettings();
    const connection = await resolveSlurpTextConnection(
      createConnectionsStorage(app.db),
      settings.modelBudget.connectionId ?? settings.generationConnectionId,
    );
    if (!connection) return reply.code(409).send({ error: "Select a text generation connection first." });
    const provider = slpWithProviderRetry(
      createLLMProvider(
        connection.provider,
        resolveBaseUrl(connection),
        connection.apiKey,
        connection.maxContext,
        connection.openrouterProvider,
        connection.maxTokensOverride,
        connection.claudeFastMode === "true",
        connection.treatAsLocalEndpoint === "true",
        connection.defaultParameters,
      ),
    );
    let text: string;
    try {
      const result = await provider.chatComplete(slurpThreadSummaryMessages(found.text, found.names), {
        model: connection.model,
        temperature: 0.4,
        // Reasoning headroom: a 300-word answer still needs room to think first.
        maxTokens: 4096,
      });
      text = String(result.content ?? "").trim();
    } catch {
      return reply.code(502).send({ error: "The connection could not sum this up. Try again." });
    }
    if (!text) return reply.code(502).send({ error: "The connection returned nothing. Try again." });
    return { text };
  });
}
