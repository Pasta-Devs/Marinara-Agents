import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  ltmDraftMutationSchema,
  ltmDraftLinkChoiceSchema,
  ltmDraftPreflightRequestSchema,
  ltmDraftPreflightResponseSchema,
  ltmDraftReviewResponseSchema,
  ltmDraftStatusSchema,
  ltmNoteIdSchema,
  ltmRejectedSuggestionsClearResponseSchema,
  ltmRejectedSuggestionsResponseSchema,
  ltmResolveSubjectIdentityResponseSchema,
} from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { projectLongTermMemoryDraftReview } from "../drafts/draft-review.js";
import { applyLongTermMemoryDraft, preflightLongTermMemoryDraft } from "../drafts/reconciliation.js";
import { resolveLtmSubjectIdentityReview } from "../identity/subject-choice-review.js";
import {
  deleteRejectedSuggestion,
  deleteRejectedSuggestionsForSource,
  listRejectedSuggestions,
} from "../drafts/rejected-suggestions.js";
import type { FastifyInstance } from "fastify";
import {
  DRAFT_BODY_LIMIT_BYTES,
  MAINTENANCE_BODY_LIMIT_BYTES,
  queryBoolean,
  routeError,
  type LtmRouteRuntime,
} from "./shared.js";

const draftQuery = z
  .object({
    status: ltmDraftStatusSchema.optional(),
    chatId: z.string().min(1).max(120).optional(),
  })
  .strict();
const draftReviewQuery = z
  .object({
    sourceNoteId: ltmNoteIdSchema.optional(),
    chatId: z.string().min(1).max(120).optional(),
    status: ltmDraftStatusSchema.optional(),
    includeInvalidated: queryBoolean,
  })
  .strict();
const rejectedSuggestionsQuery = z
  .object({
    sourceNoteId: ltmNoteIdSchema.optional(),
    chatId: z.string().min(1).max(120).optional(),
    includeResolved: queryBoolean,
  })
  .strict();
const rejectedSuggestionsDeleteQuery = z.object({ sourceNoteId: ltmNoteIdSchema }).strict();
const acceptDraftBody = z
  .object({
    mutationIds: z.array(z.string().uuid()).min(1).optional(),
    lowRiskOnly: z.boolean().optional(),
    editedMutations: z.array(ltmDraftMutationSchema).optional(),
    linkChoices: z.array(ltmDraftLinkChoiceSchema).max(1_000).optional(),
  })
  .strict()
  .default({});

export function registerDraftRoutes(app: FastifyInstance, runtime: LtmRouteRuntime) {
  const { root, draftStore } = runtime;
  app.get<{ Querystring: unknown }>("/drafts", async (request) =>
    draftStore.listDrafts(draftQuery.parse(request.query)),
  );
  app.get<{ Querystring: unknown }>("/drafts/pending-count", async (request) => ({
    count: (
      await draftStore.listDrafts({
        ...draftQuery.parse(request.query),
        status: "pending",
      })
    ).length,
  }));
  app.get<{ Querystring: unknown }>("/drafts/review", async (request) => {
    const query = draftReviewQuery.parse(request.query);
    return ltmDraftReviewResponseSchema.parse(
      await projectLongTermMemoryDraftReview({
        root,
        sourceNoteId: query.sourceNoteId,
        chatId: query.chatId,
        status: query.status,
        includeInvalidated: query.includeInvalidated,
      }),
    );
  });
  app.get<{ Querystring: unknown }>("/rejected-suggestions", async (request) => {
    const query = rejectedSuggestionsQuery.parse(request.query);
    const suggestions = await listRejectedSuggestions(query, root);
    return ltmRejectedSuggestionsResponseSchema.parse({ suggestions, total: suggestions.length });
  });
  app.delete<{ Querystring: unknown }>("/rejected-suggestions", async (request) => {
    const query = rejectedSuggestionsDeleteQuery.parse(request.query);
    return ltmRejectedSuggestionsClearResponseSchema.parse(
      await deleteRejectedSuggestionsForSource(query.sourceNoteId, root),
    );
  });
  app.delete<{ Params: { id: string } }>("/rejected-suggestions/:id", async (request, reply) => {
    const parsed = z.string().uuid().safeParse(request.params.id);
    if (!parsed.success)
      return reply.status(400).send({ error: "Invalid rejected-suggestion ID", code: "ltm_invalid_request" });
    return deleteRejectedSuggestion(parsed.data, root);
  });
  app.post<{ Params: { id: string }; Body: unknown }>(
    "/rejected-suggestions/:id/resolve-identity",
    { bodyLimit: MAINTENANCE_BODY_LIMIT_BYTES },
    async (request, reply) => {
      try {
        const id = z.string().uuid().parse(request.params.id);
        return ltmResolveSubjectIdentityResponseSchema.parse(
          await resolveLtmSubjectIdentityReview(id, request.body, root),
        );
      } catch (error) {
        const result = routeError(error, "Failed to save subject identity choices");
        return reply.status(result.statusCode).send(result.body);
      }
    },
  );
  app.post<{ Params: { id: string }; Body: unknown }>(
    "/drafts/:id/preflight",
    { bodyLimit: DRAFT_BODY_LIMIT_BYTES },
    async (request, reply) => {
      let result: Awaited<ReturnType<typeof preflightLongTermMemoryDraft>>;
      try {
        const id = z.string().uuid().parse(request.params.id);
        const body = ltmDraftPreflightRequestSchema.parse(request.body ?? {});
        result = await preflightLongTermMemoryDraft(id, {
          root,
          mutationIds: body.mutationIds,
          editedMutations: body.editedMutations,
          linkChoices: body.linkChoices,
          bulk: body.bulk,
        });
      } catch (error) {
        const result = routeError(error, "Failed to preflight long-term memory draft");
        return reply.status(result.statusCode).send(result.body);
      }
      return ltmDraftPreflightResponseSchema.parse(result);
    },
  );
  app.post<{ Params: { id: string }; Body: unknown }>(
    "/drafts/:id/accept",
    { bodyLimit: DRAFT_BODY_LIMIT_BYTES },
    async (request, reply) => {
      const id = z.string().uuid().parse(request.params.id);
      const body = acceptDraftBody.parse(request.body ?? {});
      try {
        return await applyLongTermMemoryDraft(id, {
          root,
          actor: "maintenance_api",
          mutationIds: body.mutationIds,
          editedMutations: body.editedMutations,
          linkChoices: body.linkChoices,
          autoApplyLowRiskOnly: body.lowRiskOnly,
          operationId: randomUUID(),
        });
      } catch (error) {
        const result = routeError(error, "Failed to apply long-term memory draft");
        return reply.status(result.statusCode).send(result.body);
      }
    },
  );
  app.post<{ Params: { id: string }; Body: unknown }>("/drafts/:id/skip", async (request, reply) => {
    const id = z.string().uuid().parse(request.params.id);
    const body = z
      .object({ mutationIds: z.array(z.string().uuid()).min(1) })
      .strict()
      .parse(request.body ?? {});
    const result = await draftStore.deleteDraftMutations(id, body.mutationIds);
    if (!result.deleted)
      return reply.status(result.reason === "not_pending" ? 409 : 404).send({
        error:
          result.reason === "not_pending"
            ? "Long-term memory draft is not pending"
            : "Long-term memory draft mutation not found",
      });
    return {
      deleted: true,
      draftId: id,
      mutationIds: result.mutationIds,
      draft: result.draft,
    };
  });
  app.delete<{ Params: { id: string } }>("/drafts/:id", async (request, reply) => {
    const id = z.string().uuid().parse(request.params.id);
    if (!(await draftStore.deleteDraft(id)))
      return reply.status(404).send({ error: "Long-term memory draft not found" });
    return { deleted: true, id };
  });
}
