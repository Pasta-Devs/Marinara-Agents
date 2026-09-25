import type { FastifyInstance } from "fastify";
import { resolveCreatorCharacterCanon } from "../../data/creators/slp-source-resolve.js";
import { normalizeSlurpCanonAnchors } from "../../modules/feed/slp-post-brief.js";
import type { SlpRouteDeps } from "../viewer/slp-viewer-contract.js";
import { clearSlurpCanonAnchors, readSlurpCanonAnchorState, saveSlurpCanonAnchors } from "./slp-post-beat-service.js";

/**
 * A Creator's canon anchors for the Beats planner: read, correct, or read the card again.
 *
 * Managed-only, like the Creator settings around it. The card text is resolved exactly as a post
 * resolves it, disclosure included, so an entry saved here matches what the next post checks.
 */
export async function slpCanonAnchorRoutes(app: FastifyInstance, deps: SlpRouteDeps) {
  const { noodle } = deps;
  const canonTextFor = async (id: string) => {
    const account = await noodle.getNoodlerAccountById(id);
    if (!account) return null;
    const source = await noodle.resolveAccountSource(account);
    return resolveCreatorCharacterCanon(app.db, source, account.settings.privacy.identityDisclosure ?? "open");
  };

  app.get("/slurp/accounts/:id/canon-anchors", async (req, reply) => {
    const { id } = req.params as { id: string };
    const canonText = await canonTextFor(id);
    if (canonText === null) return reply.code(404).send({ error: "Creator account not found" });
    return { ...(await readSlurpCanonAnchorState(app.db, id, canonText)), hasCard: Boolean(canonText.trim()) };
  });

  app.put("/slurp/accounts/:id/canon-anchors", async (req, reply) => {
    const { id } = req.params as { id: string };
    const canonText = await canonTextFor(id);
    if (canonText === null) return reply.code(404).send({ error: "Creator account not found" });
    if (!req.body || typeof req.body !== "object") return reply.code(400).send({ error: "Send the anchors." });
    // The same bounds as an extraction; empty lists mean "no anchors", and Beats stay classic.
    await saveSlurpCanonAnchors(app.db, id, canonText, normalizeSlurpCanonAnchors(req.body));
    return { ...(await readSlurpCanonAnchorState(app.db, id, canonText)), hasCard: Boolean(canonText.trim()) };
  });

  app.delete("/slurp/accounts/:id/canon-anchors", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await noodle.getNoodlerAccountById(id))) return reply.code(404).send({ error: "Creator account not found" });
    await clearSlurpCanonAnchors(app.db, id);
    return { cleared: true };
  });
}
