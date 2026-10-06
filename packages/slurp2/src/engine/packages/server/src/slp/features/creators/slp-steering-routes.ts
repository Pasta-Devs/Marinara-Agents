import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  SLP_STEERING_MOODS,
  SLP_STEERING_NUDGE_MAX,
  SLP_STEERING_PACES,
  SLP_STEERING_TEXT_MAX,
  SLP_STEERING_TOPIC_MAX,
  SLP_STEERING_TOPICS_MAX,
  SLP_RELATIONSHIP_STYLES,
  SLP_ROMANCE_ONLY_MAX,
} from "../../../../../shared/src/slp/slp-creator-steering.js";
import {
  addSlurpCreatorNudge,
  noteSlurpSupportChange,
  patchSlurpCreatorSteering,
  readSlurpCreatorSteering,
  removeSlurpCreatorNudge,
} from "../../data/creators/slp-steering-storage.js";
import type { SlpRouteDeps } from "../viewer/slp-viewer-contract.js";
import type { SlpAccount } from "../../../../../shared/src/slp/slp-social.types.js";
import {
  SLP_SPICE_CHIP_MAX,
  SLP_SPICE_CHIPS_MAX,
  SLP_SPICE_STEPS,
  slpExplicitOfStep,
  slpSpiceStepOf,
} from "../../../../../shared/src/slp/slp-spice.js";
import { resolveSlurpSpiceCreator } from "../../data/creators/slp-flavour-source.js";
import { getSlurpPostGuidance, updateSlurpPostGuidance } from "../../data/settings/slp-post-guidance-storage.js";
import { SLURP_BUILT_IN_EXPLICIT_LEVEL } from "../../modules/feed/slp-post-guidance.js";
import { slurpTasteFit } from "../../modules/creators/slp-spice.js";
import { slurpSteeringContentChanged } from "../../modules/feed/slp-prepared-rewrite.js";
import { slurpSupportUndoPatch } from "../../modules/messages/slp-support.js";
import {
  findSlurpContinuityFactBySourceHash,
  moveSlurpContinuityStatus,
} from "../../data/continuity/slp-continuity-storage.js";
import { countSlurpPreparedRewrite, rewriteSlurpPreparedPosts } from "../../data/feed/reserve/slp-reserve-rewrite.js";

const topics = z.array(z.string().trim().min(1).max(SLP_STEERING_TOPIC_MAX)).max(SLP_STEERING_TOPICS_MAX);
const spiceChips = z.array(z.string().trim().min(1).max(SLP_SPICE_CHIP_MAX)).max(SLP_SPICE_CHIPS_MAX);

/**
 * The Creator's spice beside the steering: their own level (or the Slurp-wide default), the limit
 * above it, and which of the player's tastes they lean into.
 */
async function creatorSpice(
  db: FastifyInstance["db"],
  account: Pick<SlpAccount, "id"> & { settings: { strategy?: unknown } },
  source: Pick<SlpAccount, "kind" | "entityId"> | null,
) {
  const { spice, creator } = await resolveSlurpSpiceCreator(db, {
    account,
    source,
    disclosureMode: "open",
  });
  const guidance = await getSlurpPostGuidance(db);
  const own = guidance.creators[account.id]?.level ?? "";
  return {
    level: slpSpiceStepOf(spice.level),
    own: Boolean(own),
    // The Slurp-wide level, for "Use Slurp-wide (…)" (0.3.17).
    inherited: slpSpiceStepOf(guidance.defaults.level || SLURP_BUILT_IN_EXPLICIT_LEVEL),
    max: spice.spice.max,
    leans: spice.spice.tastes
      .filter((taste) => slurpTasteFit(taste.text, creator, spice.spice.never) > 0)
      .map((taste) => taste.text),
  };
}

/**
 * The player's steering for one Creator: what is going on in their life, how often they post,
 * and one-off ideas for the next posts. Managed-only, like the Creator settings around it.
 */
export async function slpSteeringRoutes(app: FastifyInstance, deps: SlpRouteDeps) {
  const { noodle } = deps;
  const creatorId = async (req: { params: unknown }) => {
    const { id } = req.params as { id: string };
    return (await noodle.getNoodlerAccountById(id))?.id ?? null;
  };
  // Every answer carries the spice too, so the card's cached copy never loses it.
  const answer = async (id: string, steering: Awaited<ReturnType<typeof readSlurpCreatorSteering>>) => {
    const account = await noodle.getNoodlerAccountById(id);
    const spice = account
      ? await creatorSpice(app.db, account, await noodle.resolveAccountSource(account)).catch(() => null)
      : null;
    return { steering, spice };
  };

  app.get("/slurp/accounts/:id/steering", async (req, reply) => {
    const id = await creatorId(req);
    if (!id) return reply.code(404).send({ error: "Creator account not found" });
    const account = await noodle.getNoodlerAccountById(id);
    // Reading the spice moves the sign-up chat's likes and noes out of the strategy text first.
    const spice = account
      ? await creatorSpice(app.db, account, await noodle.resolveAccountSource(account)).catch(() => null)
      : null;
    return { steering: await readSlurpCreatorSteering(app.db, id), spice };
  });

  app.patch("/slurp/accounts/:id/steering", async (req, reply) => {
    const parsed = z
      .object({
        focus: z.string().trim().max(SLP_STEERING_TEXT_MAX).optional(),
        lifePhase: z.string().trim().max(SLP_STEERING_TEXT_MAX).optional(),
        mood: z.enum(SLP_STEERING_MOODS).nullable().optional(),
        push: topics.optional(),
        avoid: topics.optional(),
        pace: z.enum(SLP_STEERING_PACES).optional(),
        /** Polyamory (0.3.5): monogamous, polyamorous, or null = from their card. */
        relationshipStyle: z.enum(SLP_RELATIONSHIP_STYLES).nullable().optional(),
        /** Romance with other Creators (0.3.17): never, or only with these. */
        romance: z
          .object({ off: z.boolean(), only: z.array(z.string().trim().min(1).max(128)).max(SLP_ROMANCE_ONLY_MAX) })
          .optional(),
        turnOns: spiceChips.optional(),
        hardNoes: spiceChips.optional(),
        /** The Creator's own level; null goes back to the Slurp-wide default. */
        spiceLevel: z.enum(SLP_SPICE_STEPS).nullable().optional(),
      })
      .strict()
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const id = await creatorId(req);
    if (!id) return reply.code(404).send({ error: "Creator account not found" });
    const { spiceLevel, ...patch } = parsed.data;
    const before = await readSlurpCreatorSteering(app.db, id);
    const steering = await patchSlurpCreatorSteering(app.db, id, patch);
    let levelChanged = false;
    if (spiceLevel !== undefined) {
      const level = spiceLevel ? slpExplicitOfStep(spiceLevel) : "";
      await updateSlurpPostGuidance(app.db, (current) => {
        const entry = current.creators[id] ?? { public: "", locked: "", menu: "", level: "" };
        levelChanged = entry.level !== level;
        return { ...current, creators: { ...current.creators, [id]: { ...entry, level } } };
      });
    }
    // Posts already written keep the old steering. The app asks whether to rewrite them; the
    // count is only sent when what the posts say changed.
    const prepared =
      levelChanged || slurpSteeringContentChanged(before, steering)
        ? await countSlurpPreparedRewrite(app.db, id)
        : null;
    return { ...(await answer(id, steering)), prepared: prepared?.posts ? prepared : null };
  });

  /** The player's answer "Rewrite" to the question above. "Keep" sends nothing. */
  app.post("/slurp/accounts/:id/steering/rewrite-prepared", async (req, reply) => {
    const id = await creatorId(req);
    if (!id) return reply.code(404).send({ error: "Creator account not found" });
    return { rewritten: await rewriteSlurpPreparedPosts(app.db, id) };
  });

  app.post("/slurp/accounts/:id/steering/ideas", async (req, reply) => {
    const parsed = z
      .object({ text: z.string().trim().min(1).max(SLP_STEERING_NUDGE_MAX), story: z.boolean().default(false) })
      .strict()
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const id = await creatorId(req);
    if (!id) return reply.code(404).send({ error: "Creator account not found" });
    const steering = await addSlurpCreatorNudge(app.db, id, parsed.data);
    if (!steering) return reply.code(409).send({ error: "That is plenty of ideas for now. Let one go out first." });
    return answer(id, steering);
  });

  app.delete("/slurp/accounts/:id/steering/ideas/:ideaId", async (req, reply) => {
    const id = await creatorId(req);
    if (!id) return reply.code(404).send({ error: "Creator account not found" });
    const { ideaId } = req.params as { ideaId: string };
    return answer(id, await removeSlurpCreatorNudge(app.db, id, ideaId));
  });

  /** Undo what the last talk with Slurp Support changed: the fields, its waiting idea, its memory. */
  app.post("/slurp/accounts/:id/steering/support-undo", async (req, reply) => {
    const id = await creatorId(req);
    if (!id) return reply.code(404).send({ error: "Creator account not found" });
    const note = (await readSlurpCreatorSteering(app.db, id)).support;
    if (!note) return reply.code(409).send({ error: "There is nothing from Slurp Support to undo." });
    await patchSlurpCreatorSteering(app.db, id, slurpSupportUndoPatch(note));
    if (note.ideaId) await removeSlurpCreatorNudge(app.db, id, note.ideaId);
    const memory = note.memory ? await findSlurpContinuityFactBySourceHash(app.db, id, note.memory) : null;
    if (memory) await moveSlurpContinuityStatus(app.db, "fact", memory.id, "retracted").catch(() => false);
    return answer(id, await noteSlurpSupportChange(app.db, id, null));
  });

  /** Keep what Support changed and hide the note. */
  app.delete("/slurp/accounts/:id/steering/support-note", async (req, reply) => {
    const id = await creatorId(req);
    if (!id) return reply.code(404).send({ error: "Creator account not found" });
    return answer(id, await noteSlurpSupportChange(app.db, id, null));
  });
}
