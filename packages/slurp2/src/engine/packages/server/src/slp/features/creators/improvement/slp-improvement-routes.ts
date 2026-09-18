import {
  SLURP_AVAILABLE_IMPROVEMENT_MODULES,
  slurpCreatorReadiness,
  planSlurpImprovementRetry,
  planSlurpImprovementApply,
  slurpStageProfileInput,
} from "../../../../services/slurp/slurp-improvement.js";
import { slurpImprovementJobs, slurpImprovementProposals } from "../../../../db/schema/slurp.js";
import { now, newId } from "../../../../utils/id-generator.js";
import { logger } from "../../../../lib/logger.js";
import { eq, inArray } from "../../../../db/file-query.js";
import { trySlurpWrite } from "../../../../services/slurp/slurp-operation-lock.js";
import type { FastifyInstance } from "fastify";
import type { SlpRouteDeps } from "../../../base/host/slp-viewer-context.js";
import { createSlpImprovementJobs } from "./slp-improvement-jobs.js";

export async function slpImprovementRoutes(app: FastifyInstance, deps: SlpRouteDeps) {
  const { noodle } = deps;
  const {
    publicImprovementJob,
    improvementJobSchema,
    processImprovementJob,
    readImprovementJob,
    readJobProposals,
    readStringArray,
    proposalIdsSchema,
    setProposalStatus,
  } = createSlpImprovementJobs(app, deps);
  // Deterministic checkup: reads stored profiles and settings only, never a model.
  app.get("/backstage/readiness", async () => {
    const [profiles, settings] = await Promise.all([noodle.listNoodlerStageProfiles(), noodle.getSlurpSettings()]);
    return {
      modelCalls: 0,
      availableModules: SLURP_AVAILABLE_IMPROVEMENT_MODULES,
      creators: profiles.map((profile) => ({ accountId: profile.id, issues: slurpCreatorReadiness(profile) })),
      global: {
        generationConnection: Boolean(settings.generationConnectionId),
        imageConnection: Boolean(settings.imageGenerationConnectionId),
        discoveryTags: settings.discoveryTags.length,
        fanTypes: settings.fanTypes.length,
        arcs: settings.arcLibrary.length,
      },
    };
  });

  app.get("/backstage/improvement-jobs", async () => {
    const rows = (await app.db.select().from(slurpImprovementJobs)).slice(-20).reverse();
    const proposals = rows.length
      ? await app.db
          .select()
          .from(slurpImprovementProposals)
          .where(
            inArray(
              slurpImprovementProposals.jobId,
              rows.map((row) => row.id),
            ),
          )
      : [];
    const proposalsByJobId = new Map<string, typeof proposals>();
    for (const proposal of proposals) {
      const existing = proposalsByJobId.get(proposal.jobId) ?? [];
      existing.push(proposal);
      proposalsByJobId.set(proposal.jobId, existing);
    }
    return {
      items: await Promise.all(rows.map((row) => publicImprovementJob(row.id, proposalsByJobId.get(row.id) ?? []))),
    };
  });
  app.get("/backstage/improvement-jobs/:id", async (req, reply) => {
    const job = await publicImprovementJob((req.params as { id: string }).id);
    return job ?? reply.code(404).send({ error: "Improvement job not found." });
  });
  app.post("/backstage/improvement-jobs", async (req, reply) => {
    const body = improvementJobSchema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const modules = [...new Set(body.data.modules)].filter((module) =>
      SLURP_AVAILABLE_IMPROVEMENT_MODULES.includes(module),
    );
    if (!modules.length) return reply.code(400).send({ error: "Those proposal lanes are not available yet." });
    const profiles = await noodle.listNoodlerStageProfiles();
    const available = new Set(profiles.map((profile) => profile.id));
    const accountIds = [...new Set(body.data.accountIds)].filter((id) => available.has(id));
    if (!accountIds.length) return reply.code(404).send({ error: "None of those Slurp Creators exist." });
    const timestamp = now();
    const id = newId();
    await app.db.insert(slurpImprovementJobs).values({
      id,
      status: "queued",
      mode: body.data.mode,
      rebrand: String(body.data.rebrand),
      accountIds: JSON.stringify(accountIds),
      modules: JSON.stringify(modules),
      connectionId: body.data.connectionId ?? null,
      completed: "0",
      total: String(accountIds.length),
      error: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    void processImprovementJob(id).catch((error) => logger.error(error, "[slurp] Improvement job failed"));
    return reply.code(202).send(await publicImprovementJob(id));
  });
  app.post("/backstage/improvement-jobs/:id/cancel", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const job = await readImprovementJob(id);
    if (!job) return reply.code(404).send({ error: "Improvement job not found." });
    if (!["queued", "running"].includes(job.status)) return reply.code(409).send({ error: "This job is not running." });
    await app.db
      .update(slurpImprovementJobs)
      .set({ status: "cancelled", updatedAt: now() })
      .where(eq(slurpImprovementJobs.id, id));
    return publicImprovementJob(id);
  });
  app.post("/backstage/improvement-jobs/:id/resume", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const job = await readImprovementJob(id);
    if (!job) return reply.code(404).send({ error: "Improvement job not found." });
    if (!["failed", "cancelled"].includes(job.status))
      return reply.code(409).send({ error: "This job is not paused." });
    await app.db
      .update(slurpImprovementJobs)
      .set({ status: "queued", error: null, updatedAt: now() })
      .where(eq(slurpImprovementJobs.id, id));
    void processImprovementJob(id).catch((error) => logger.error(error, "[slurp] Improvement job resume failed"));
    return reply.code(202).send(await publicImprovementJob(id));
  });
  // Per-Creator failures retry alone; successful proposals stay reviewable.
  app.post("/backstage/improvement-jobs/:id/retry", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const job = await readImprovementJob(id);
    if (!job) return reply.code(404).send({ error: "Improvement job not found." });
    if (["queued", "running"].includes(job.status))
      return reply.code(409).send({ error: "This job is still running." });
    const failed = (await readJobProposals(id)).filter((row) => row.status === "error" && row.field === "_creator");
    if (!failed.length) return reply.code(409).send({ error: "This job has no failed Creators." });
    const retry = planSlurpImprovementRetry(
      readStringArray(job.accountIds),
      failed.map((row) => row.accountId),
    );
    await app.db.delete(slurpImprovementProposals).where(
      inArray(
        slurpImprovementProposals.id,
        failed.map((row) => row.id),
      ),
    );
    await app.db
      .update(slurpImprovementJobs)
      .set({
        status: "queued",
        error: null,
        accountIds: JSON.stringify(retry.accountIds),
        completed: String(retry.completed),
        updatedAt: now(),
      })
      .where(eq(slurpImprovementJobs.id, id));
    void processImprovementJob(id).catch((error) => logger.error(error, "[slurp] Improvement job retry failed"));
    return reply.code(202).send(await publicImprovementJob(id));
  });
  app.post("/backstage/improvement-jobs/:id/dismiss", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const body = proposalIdsSchema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const requested = new Set(body.data.proposalIds);
    const rows = (await readJobProposals(id)).filter((row) => requested.has(row.id) && row.status === "pending");
    await setProposalStatus(
      rows.map((row) => row.id),
      "dismissed",
    );
    return { dismissed: rows.length };
  });

  app.post("/backstage/improvement-jobs/:id/apply", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const body = proposalIdsSchema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const job = await readImprovementJob(id);
    if (!job) return reply.code(404).send({ error: "Improvement job not found." });
    const requested = new Set(body.data.proposalIds);
    const outcome = await trySlurpWrite(async () => {
      // Recomputed under the write lock so a concurrent edit cannot slip between check and write.
      const proposals = (await readJobProposals(id)).filter(
        (proposal) => requested.has(proposal.id) && proposal.status === "pending",
      );
      if (!proposals.length) return { status: 404 as const, error: "No pending proposals were selected." };
      const [profiles, settings] = await Promise.all([noodle.listNoodlerStageProfiles(), noodle.getSlurpSettings()]);
      const plan = planSlurpImprovementApply({
        profiles,
        proposals,
        rebrand: job.rebrand === "true",
        discoveryTags: settings.discoveryTags,
      });
      if (plan.stale.length) {
        await setProposalStatus(plan.stale, "stale");
        return {
          status: 409 as const,
          error: "A Creator changed after these proposals were generated. Regenerate before applying.",
        };
      }
      const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
      const touched: typeof plan.updates = [];
      try {
        if (plan.createdTags.length) await noodle.updateSlurpSettings({ discoveryTags: plan.discoveryTags });
        for (const update of plan.updates) {
          touched.push(update);
          await noodle.updateNoodlerStageProfile(update.accountId, update.stageProfile);
          if (update.autoPosting !== undefined) {
            await noodle.bulkUpdateCreatorProfiles([update.accountId], { autoPosting: update.autoPosting });
          }
        }
      } catch (error) {
        // ponytail: compensating rollback across separate storage transactions; one shared tx if storage grows one.
        for (const update of touched) {
          const before = profileById.get(update.accountId)!;
          await noodle.updateNoodlerStageProfile(update.accountId, slurpStageProfileInput(before)).catch(() => null);
          if (update.autoPosting !== undefined) {
            await noodle
              .bulkUpdateCreatorProfiles([update.accountId], { autoPosting: before.autoPosting.enabled })
              .catch(() => null);
          }
        }
        if (plan.createdTags.length) {
          await noodle.updateSlurpSettings({ discoveryTags: settings.discoveryTags }).catch(() => null);
        }
        throw error;
      }
      const rejected = new Set(plan.rejected);
      await setProposalStatus(plan.rejected, "error", "This field is protected and was not applied.");
      await setProposalStatus(
        proposals.filter((proposal) => !rejected.has(proposal.id)).map((proposal) => proposal.id),
        "applied",
      );
      return {
        status: 200 as const,
        applied: proposals.length - rejected.size,
        rejected: rejected.size,
        creators: plan.updates.length,
        createdTags: plan.createdTags,
      };
    });
    if (!outcome.acquired) return reply.code(409).send({ error: "Another Slurp operation is running." });
    const { status, ...result } = outcome.value;
    return status === 200 ? result : reply.code(status).send(result);
  });
}
