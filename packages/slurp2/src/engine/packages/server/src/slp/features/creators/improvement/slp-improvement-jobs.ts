import { z } from "zod";
import {
  SLURP_IMPROVEMENT_MODULES,
  slurpImprovementModelCalls,
  slurpImprovementDraftFields,
  slurpImprovementSnapshot,
  slurpStageProfileInput,
  slurpImprovementDraftProposals,
} from "../../../modules/creators/improvement/slp-improvement.js";
import { slurpImprovementJobs, slurpImprovementProposals } from "../../../../db/schema/slurp.js";
import { eq } from "../../../../db/file-query.js";
import { now, newId } from "../../../../utils/id-generator.js";
import { resolveSlurpTextConnection } from "../../../base/identity/slp-connection.js";
import { generateCreatorStageProfileDraft } from "../slp-stage-profile-draft-service.js";
import { getErrorMessage } from "../../../modules/creators/slp-public-support.js";
import { logger } from "../../../../lib/logger.js";
import type { FastifyInstance } from "fastify";
import type { SlpRouteDeps } from "../../viewer/slp-viewer-contract.js";

/**
 * The Creator improvement-job runner. Created once; on creation it re-queues jobs a restart
 * interrupted.
 */
export function createSlpImprovementJobs(app: FastifyInstance, deps: SlpRouteDeps) {
  const { connections, noodle } = deps;
  // ── Backstage Creator improvement workshop ──────────────────────────────
  const improvementJobSchema = z.object({
    accountIds: z.array(z.string().trim().min(1)).min(1).max(50),
    mode: z.enum(["missing", "refresh", "prefill"]).default("missing"),
    rebrand: z.boolean().default(false),
    modules: z.array(z.enum(SLURP_IMPROVEMENT_MODULES)).min(1).default(["profile", "tags"]),
    connectionId: z.string().trim().min(1).optional(),
  });
  const proposalIdsSchema = z.object({ proposalIds: z.array(z.string().trim().min(1)).min(1).max(250) });
  const activeImprovementJobs = new Set<string>();
  const readStringArray = (value: string): string[] => {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  };
  const readImprovementJob = async (id: string) =>
    (await app.db.select().from(slurpImprovementJobs).where(eq(slurpImprovementJobs.id, id)))[0];
  const readJobProposals = async (id: string) =>
    (await app.db.select().from(slurpImprovementProposals)).filter((row) => row.jobId === id);
  const setProposalStatus = async (ids: readonly string[], status: string, error: string | null = null) => {
    for (const proposalId of ids) {
      await app.db
        .update(slurpImprovementProposals)
        .set({ status, error, updatedAt: now() })
        .where(eq(slurpImprovementProposals.id, proposalId));
    }
  };
  const publicImprovementJob = async (
    id: string,
    suppliedProposals?: readonly (typeof slurpImprovementProposals.$inferSelect)[],
  ) => {
    const job = await readImprovementJob(id);
    if (!job) return null;
    const proposals = suppliedProposals ?? (await readJobProposals(id));
    const modules = readStringArray(job.modules);
    return {
      id: job.id,
      status: job.status,
      mode: job.mode,
      rebrand: job.rebrand === "true",
      accountIds: readStringArray(job.accountIds),
      modules,
      completed: Number(job.completed) || 0,
      total: Number(job.total) || 0,
      expectedModelCalls: slurpImprovementModelCalls(Number(job.total) || 0, modules),
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      proposals: proposals.map((proposal) => ({
        id: proposal.id,
        accountId: proposal.accountId,
        field: proposal.field,
        before: JSON.parse(proposal.beforeValue) as unknown,
        after: JSON.parse(proposal.afterValue) as unknown,
        status: proposal.status,
        error: proposal.error,
      })),
    };
  };
  const insertProposal = (values: {
    jobId: string;
    accountId: string;
    field: string;
    before: unknown;
    after: unknown;
    sourceFingerprint: string;
    status: "pending" | "error";
    error?: string | null;
  }) =>
    app.db.insert(slurpImprovementProposals).values({
      id: newId(),
      jobId: values.jobId,
      accountId: values.accountId,
      field: values.field,
      beforeValue: JSON.stringify(values.before ?? null),
      afterValue: JSON.stringify(values.after ?? null),
      sourceFingerprint: values.sourceFingerprint,
      status: values.status,
      error: values.error ?? null,
      createdAt: now(),
      updatedAt: now(),
    });
  const processImprovementJob = async (id: string) => {
    if (activeImprovementJobs.has(id)) return;
    activeImprovementJobs.add(id);
    try {
      const job = await readImprovementJob(id);
      if (!job || !["queued", "running"].includes(job.status)) return;
      const accountIds = readStringArray(job.accountIds);
      const modules = readStringArray(job.modules);
      const rebrand = job.rebrand === "true";
      const needsModel = slurpImprovementDraftFields(modules, rebrand).length > 0;
      const settings = await noodle.getSlurpSettings();
      const connection = needsModel
        ? await resolveSlurpTextConnection(connections, job.connectionId ?? settings.generationConnectionId)
        : null;
      if (needsModel && !connection) {
        await app.db
          .update(slurpImprovementJobs)
          .set({ status: "failed", error: "Select a Slurp text generation connection first.", updatedAt: now() })
          .where(eq(slurpImprovementJobs.id, id));
        return;
      }
      await app.db
        .update(slurpImprovementJobs)
        .set({ status: "running", error: null, total: String(accountIds.length), updatedAt: now() })
        .where(eq(slurpImprovementJobs.id, id));
      let completed = Number(job.completed) || 0;
      let processed = 0;
      let failures = 0;
      for (const accountId of accountIds.slice(completed)) {
        const currentJob = await readImprovementJob(id);
        if (!currentJob || currentJob.status === "cancelled") return;
        processed += 1;
        const profile = (await noodle.listNoodlerStageProfiles()).find((item) => item.id === accountId);
        const snapshot = profile ? slurpImprovementSnapshot(profile) : "missing";
        try {
          if (!profile) throw new Error("Creator no longer exists.");
          const guidance = [
            job.mode === "missing"
              ? "Fill only weak or missing public Creator profile fields. Keep strong existing work unchanged."
              : job.mode === "prefill"
                ? "Create a complete, usable starting profile for this Slurp Creator."
                : "Refresh this Slurp Creator profile while preserving its recognizable voice.",
            modules.includes("tags") ? "Review and improve the discovery tags." : "Keep the current tags unchanged.",
            rebrand
              ? "A rebrand was explicitly requested, so a better display name or handle may be proposed."
              : "Do not change the display name or handle.",
            "Never change disclosure, pricing, ownership, or the Engine source identity.",
          ].join(" ");
          // Reuses the existing stage-profile generator; only allowed fields become proposals.
          const draft =
            needsModel && connection
              ? await generateCreatorStageProfileDraft(app.db, {
                  request: {
                    noodlerAccountId: profile.id,
                    disclosureMode: profile.disclosureMode ?? "hinted",
                    guidance,
                    currentDraft: slurpStageProfileInput(profile),
                    connectionId: job.connectionId ?? undefined,
                  },
                  connection,
                })
              : slurpStageProfileInput(profile);
          for (const proposal of slurpImprovementDraftProposals(profile, draft, modules, rebrand)) {
            await insertProposal({ jobId: id, accountId, ...proposal, sourceFingerprint: snapshot, status: "pending" });
          }
        } catch (error) {
          failures += 1;
          await insertProposal({
            jobId: id,
            accountId,
            field: "_creator",
            before: null,
            after: null,
            sourceFingerprint: snapshot,
            status: "error",
            error: getErrorMessage(error),
          });
        }
        completed += 1;
        await app.db
          .update(slurpImprovementJobs)
          .set({ completed: String(completed), updatedAt: now() })
          .where(eq(slurpImprovementJobs.id, id));
      }
      const finalJob = await readImprovementJob(id);
      if (!finalJob || finalJob.status === "cancelled") return;
      await app.db
        .update(slurpImprovementJobs)
        .set({
          status: processed > 0 && failures === processed ? "failed" : "completed",
          error: failures ? `${failures} Creator${failures === 1 ? "" : "s"} could not be drafted. Retry them.` : null,
          updatedAt: now(),
        })
        .where(eq(slurpImprovementJobs.id, id));
    } finally {
      activeImprovementJobs.delete(id);
    }
  };

  // A process restart turns interrupted work back into a resumable queue. Completed proposals
  // remain reviewable and are never applied automatically.
  void app.db
    .select()
    .from(slurpImprovementJobs)
    .then(async (jobs) => {
      for (const job of jobs.filter((item) => ["queued", "running"].includes(item.status))) {
        if (job.status === "running") {
          await app.db
            .update(slurpImprovementJobs)
            .set({ status: "queued", updatedAt: now() })
            .where(eq(slurpImprovementJobs.id, job.id));
        }
        void processImprovementJob(job.id).catch((error) =>
          logger.error(error, "[slurp] Recovered improvement job failed"),
        );
      }
    });

  return {
    improvementJobSchema,
    proposalIdsSchema,
    readStringArray,
    readImprovementJob,
    readJobProposals,
    setProposalStatus,
    publicImprovementJob,
    processImprovementJob,
  };
}

export type SlpImprovementJobs = ReturnType<typeof createSlpImprovementJobs>;
