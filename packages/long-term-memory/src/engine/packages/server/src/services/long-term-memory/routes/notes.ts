import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  ltmBulkNoteRequestSchema,
  ltmBulkNoteResultSchema,
  ltmConflictSchema,
  ltmExtractSourceNoteRequestSchema,
  ltmExtractSourceNoteResponseSchema,
  ltmIsoTimestampSchema,
  ltmLinkSchema,
  ltmModeSchema,
  ltmNoteIdSchema,
  ltmNoteTitleSchema,
  ltmNoteTypeSchema,
  ltmNoteTransferApplyResponseSchema,
  ltmNoteTransferApplyRequestSchema,
  ltmNoteTransferPreviewRequestSchema,
  ltmNoteTransferPreviewResponseSchema,
  ltmRenameNoteSectionRequestSchema,
  ltmRenameNoteSectionPreviewResponseSchema,
  ltmRenameNoteSectionResponseSchema,
  ltmWriteScopeSchema,
  ltmScopeSchema,
  type LtmScope,
  ltmSectionKeySchema,
  ltmSectionSchema,
  ltmStatusSchema,
  ltmSourceDerivedMemoriesResponseSchema,
  ltmSubjectsSchema,
} from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { getLtmExtractionConfig } from "../extraction/extraction-config.js";
import { branchInheritedNoteIds } from "../recall/generation-injection.js";
import { applyLtmNoteTransfer, previewLtmNoteTransfer } from "../maintenance/note-transfer.js";
import { getPackageLanguageModels, getPackagePersistence, getPackageResources, logger } from "../package-runtime.js";
import { retrieveLongTermMemory } from "../recall/retrieval.js";
import { applyLtmScopeLinksToDerivedNotes } from "../identity/scope-links.js";
import { getLtmGlobalSettings } from "../settings.js";
import {
  ltmModeForChatMode,
  normalizeLtmChatCharacterIds,
  parseLtmChatMetadata,
  resolveChatLtmScope,
  resolveChatLtmWriteScope,
  getLtmChatDisplayName,
} from "../identity/chat-scope.js";
import { estimateLongTermMemoryPromptOverhead } from "../recall/prompt.js";
import { resolveLongTermMemoryRecallSettings } from "../../../../../shared/src/features/agents/long-term-memory/runtime-settings.js";
import { isLtmSourceNote } from "../extraction/source-extraction.js";
import { processLongTermMemorySource } from "../extraction/source-processing.js";
import { PROFESSOR_MARI_CHARACTER_ID } from "../sources/interop.js";
import {
  getLtmScopeChatIds,
  getLtmScopeGroupIds,
  getLtmScopePersonaIds,
  isGlobalLtmScope,
} from "../../../../../shared/src/features/agents/long-term-memory/scope.js";
import { loadTrustedLtmSubjectCatalog } from "../identity/subject-identity.js";
import { LtmServiceError } from "../service-error.js";
import type { FastifyInstance } from "fastify";
import {
  NOTE_BODY_LIMIT_BYTES,
  DRAFT_BODY_LIMIT_BYTES,
  SEARCH_BODY_LIMIT_BYTES,
  MAINTENANCE_BODY_LIMIT_BYTES,
  queryBoolean,
  routeError,
  vaultNoteValidationError,
  rebuildAfterMutation,
  type LtmRouteRuntime,
} from "./shared.js";

const ltmIdentifierSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/);
const scopedIds = z.preprocess(
  (value) => {
    const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
    return values
      .map(String)
      .map((item) => item.trim())
      .filter(Boolean);
  },
  z.array(z.string().min(1).max(120)).max(100).optional(),
);
const noteIds = z.preprocess((value) => {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : value;
  return Array.isArray(values) ? [...new Set(values.map(String).map((item) => item.trim()))] : values;
}, z.array(ltmNoteIdSchema).min(1).max(100).optional());
const listNotesQuery = z
  .object({
    type: ltmNoteTypeSchema.optional(),
    status: ltmStatusSchema.optional(),
    tag: ltmIdentifierSchema.optional(),
    scopeChatIds: scopedIds,
    scopeGroupId: z.string().min(1).max(120).optional(),
    scopeGroupIds: scopedIds,
    scopeCharacterIds: scopedIds,
    scopePersonaId: z.string().min(1).max(120).optional(),
    scopePersonaIds: scopedIds,
    includeGlobal: queryBoolean,
    ids: noteIds,
    offset: z.coerce.number().int().min(0).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
  })
  .strict()
  .superRefine((query, context) => {
    if (!query.ids) return;
    const incompatibleKeys = [
      "type",
      "status",
      "tag",
      "scopeChatIds",
      "scopeGroupId",
      "scopeGroupIds",
      "scopeCharacterIds",
      "scopePersonaId",
      "scopePersonaIds",
      "includeGlobal",
      "offset",
      "limit",
    ] as const;
    for (const key of incompatibleKeys) {
      const value = query[key];
      if (Array.isArray(value) ? value.length > 0 : value !== undefined) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: `Cannot combine ${key} with ids.` });
      }
    }
  });
const scopeTargetsQuery = z
  .object({
    chatId: z.string().min(1).max(120).optional(),
    includeAllChats: queryBoolean,
  })
  .strict();
function numberDuplicateLabels<T extends { id: string; label: string; comment?: string }>(items: T[]) {
  const totals = new Map<string, number>();
  const seen = new Map<string, number>();
  for (const item of items) {
    const key = `${item.label}\u0000${item.comment ?? ""}`;
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }
  return items.map((item) => {
    const key = `${item.label}\u0000${item.comment ?? ""}`;
    if ((totals.get(key) ?? 0) < 2) return item;
    const number = seen.get(key) ?? 0;
    seen.set(key, number + 1);
    return {
      ...item,
      label: number ? `${item.label} (${number})` : item.label,
    };
  });
}

function resourceDisplay(resource: { id: string; data: unknown; comment?: unknown }) {
  const data =
    typeof resource.data === "string"
      ? (() => {
          try {
            const parsed: unknown = JSON.parse(resource.data);
            return parsed && typeof parsed === "object" && !Array.isArray(parsed)
              ? (parsed as Record<string, unknown>)
              : null;
          } catch {
            return null;
          }
        })()
      : resource.data && typeof resource.data === "object" && !Array.isArray(resource.data)
        ? (resource.data as Record<string, unknown>)
        : null;
  return {
    id: resource.id,
    label: typeof data?.name === "string" && data.name.trim() ? data.name.trim() : "",
    comment:
      typeof resource.comment === "string"
        ? resource.comment.trim()
        : typeof data?.comment === "string"
          ? data.comment.trim()
          : "",
  };
}
const createNoteBody = z
  .object({
    id: ltmNoteIdSchema,
    title: ltmNoteTitleSchema.optional(),
    type: ltmNoteTypeSchema.exclude(["source"]),
    status: ltmStatusSchema,
    modes: z.array(ltmModeSchema).min(1).max(8),
    scope: ltmWriteScopeSchema.default({}),
    tags: z.array(ltmIdentifierSchema).max(100).default([]),
    keywords: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    manualKeywords: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    suppressedKeywords: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    createdAt: ltmIsoTimestampSchema.optional(),
    updatedAt: ltmIsoTimestampSchema.optional(),
    links: z.array(ltmLinkSchema).max(250).default([]),
    sections: z.record(ltmSectionKeySchema, ltmSectionSchema),
    conflicts: z.array(ltmConflictSchema).max(250).optional(),
    subjects: ltmSubjectsSchema.optional(),
    version: z.number().int().min(1).optional(),
  })
  .strict()
  .superRefine((note, ctx) => {
    if (
      note.scope.chatId ||
      note.scope.chatIds?.length ||
      note.scope.groupId ||
      note.scope.groupIds?.length ||
      note.scope.characterIds?.length ||
      note.scope.personaId ||
      note.scope.personaIds?.length
    )
      return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["scope"],
      message: "Choose at least one place where this memory is available.",
    });
  });
const updateNoteBody = z
  .object({
    title: ltmNoteTitleSchema.optional(),
    status: ltmStatusSchema.optional(),
    modes: z.array(ltmModeSchema).min(1).max(8).optional(),
    scope: ltmWriteScopeSchema.optional(),
    tags: z.array(ltmIdentifierSchema).max(100).optional(),
    keywords: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
    manualKeywords: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
    suppressedKeywords: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
    links: z.array(ltmLinkSchema).max(250).optional(),
    sections: z.record(ltmSectionKeySchema, ltmSectionSchema).optional(),
    conflicts: z.array(ltmConflictSchema).max(250).optional(),
    subjects: ltmSubjectsSchema.optional(),
    removedSectionKeys: z
      .array(ltmSectionKeySchema)
      .max(100)
      .refine((keys) => new Set(keys).size === keys.length, "Removed section keys must be unique.")
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Patch body must include at least one updatable field.");
const removeScopeBody = z
  .object({
    chatIds: z.array(z.string().min(1).max(120)).max(100).optional(),
    groupId: z.string().min(1).max(120).optional(),
    groupIds: z.array(z.string().min(1).max(120)).max(100).optional(),
    characterIds: z.array(z.string().min(1).max(120)).max(100).optional(),
    personaIds: z.array(z.string().min(1).max(120)).max(100).optional(),
  })
  .strict()
  .refine(
    (value) =>
      Boolean(
        value.chatIds?.length ||
        value.groupId ||
        value.groupIds?.length ||
        value.characterIds?.length ||
        value.personaIds?.length,
      ),
    "At least one scope link is required.",
  );
const removeCurrentChatBody = z.object({ chatId: z.string().min(1).max(120) }).strict();
const applyDerivedBody = z
  .object({
    chatIds: z.array(z.string().min(1).max(120)).max(100).optional(),
    groupIds: z.array(z.string().min(1).max(120)).max(100).optional(),
    characterIds: z.array(z.string().min(1).max(120)).max(100).optional(),
    personaIds: z.array(z.string().min(1).max(120)).max(100).optional(),
  })
  .strict()
  .refine(
    (value) =>
      Boolean(
        value.chatIds?.length || value.groupIds?.length || value.characterIds?.length || value.personaIds?.length,
      ),
    "Provide at least one scope link to apply.",
  );
const searchBody = z
  .object({
    queryText: z.string().max(20_000),
    mode: ltmModeSchema.optional(),
    scope: ltmScopeSchema.optional(),
    characterIds: z.array(z.string().min(1).max(120)).max(100).optional(),
    includeResolved: z.boolean().optional(),
    maxChunks: z.number().int().min(1).max(100).optional(),
    maxTokens: z.number().int().min(128).max(16_384).optional(),
    minScore: z.number().finite().min(0).max(1).optional(),
    semanticWeight: z.number().finite().min(0).max(1).optional(),
    lexicalWeight: z.number().finite().min(0).max(1).optional(),
    graphWeight: z.number().finite().min(0).max(1).optional(),
    keywordWeight: z.number().finite().min(0).max(1).optional(),
    explain: z.boolean().optional(),
    rejectedLimit: z.number().int().min(0).max(80).optional(),
  })
  .strict();

export function registerNotesRoutes(app: FastifyInstance, runtime: LtmRouteRuntime) {
  const { root, storage } = runtime;
  app.get<{ Querystring: unknown }>("/notes", async (request, reply) => {
    try {
      const query = listNotesQuery.parse(request.query);
      if (query.ids) {
        const notesById = await storage.getNotesByIds(query.ids);
        return query.ids.flatMap((id) => {
          const note = notesById.get(id);
          return note ? [note] : [];
        });
      }
      const offset = query.offset ?? 0;
      const limit = query.limit ?? 100;
      const scope =
        query.scopeChatIds?.length ||
        query.scopeGroupId ||
        query.scopeGroupIds?.length ||
        query.scopeCharacterIds?.length ||
        query.scopePersonaId ||
        query.scopePersonaIds?.length
          ? {
              ...(query.scopeChatIds?.length ? { chatIds: query.scopeChatIds, chatId: query.scopeChatIds[0] } : {}),
              ...(query.scopeGroupId ? { groupId: query.scopeGroupId } : {}),
              ...(query.scopeGroupIds?.length ? { groupIds: query.scopeGroupIds } : {}),
              ...(query.scopeCharacterIds?.length ? { characterIds: query.scopeCharacterIds } : {}),
              ...(query.scopePersonaId ? { personaId: query.scopePersonaId } : {}),
              ...(query.scopePersonaIds?.length ? { personaIds: query.scopePersonaIds } : {}),
            }
          : undefined;
      const notes = await storage.listNotes({
        type: query.type,
        status: query.status,
        tag: query.tag,
        scope,
        characterIds: query.scopeCharacterIds,
        includeGlobal: query.includeGlobal,
        offset,
        limit: limit + 1,
      });
      const hasMore = notes.length > limit;
      reply.header("x-ltm-has-more", String(hasMore));
      if (hasMore) reply.header("x-ltm-next-offset", String(offset + limit));
      return notes.slice(0, limit);
    } catch (error) {
      const result = routeError(error, "Could not list long-term memory notes.");
      return reply.status(result.statusCode).send(result.body);
    }
  });
  app.get<{ Querystring: unknown }>("/scope-targets", async (request) => {
    const { chatId, includeAllChats } = scopeTargetsQuery.parse(request.query);
    const [notes, chats, resources, personas] = await Promise.all([
      storage.listNotes(),
      getPackagePersistence().listChats(),
      getPackageResources().listCharacters(),
      getPackageResources().listPersonas(),
    ]);
    const eligibleChats = chats.filter(
      (chat) => !normalizeLtmChatCharacterIds(chat.characterIds).includes(PROFESSOR_MARI_CHARACTER_ID),
    );
    const eligibleResources = resources.filter((resource) => resource.id !== PROFESSOR_MARI_CHARACTER_ID);
    const chatById = new Map(eligibleChats.map((chat) => [chat.id, chat]));
    const currentChat = chatId ? (chatById.get(chatId) ?? null) : null;
    const chatIds = new Set<string>();
    const groupIds = new Set<string>();
    const characterIds = new Set<string>();
    const personaIds = new Set<string>();
    if (currentChat?.personaId) personaIds.add(currentChat.personaId);
    if (currentChat) {
      chatIds.add(currentChat.id);
      if (currentChat.groupId) groupIds.add(currentChat.groupId);
      normalizeLtmChatCharacterIds(currentChat.characterIds).forEach((characterId) => characterIds.add(characterId));
    }
    if (includeAllChats) {
      for (const chat of eligibleChats) {
        chatIds.add(chat.id);
        if (chat.groupId) groupIds.add(chat.groupId);
        if (chat.personaId) personaIds.add(chat.personaId);
      }
    }
    for (const note of notes) {
      for (const id of getLtmScopeChatIds(note.scope)) {
        chatIds.add(id);
        const chat = chatById.get(id);
        if (chat?.groupId) groupIds.add(chat.groupId);
        normalizeLtmChatCharacterIds(chat?.characterIds).forEach((characterId) => characterIds.add(characterId));
      }
      for (const groupId of getLtmScopeGroupIds(note.scope)) {
        if (eligibleChats.some((chat) => chat.groupId === groupId)) groupIds.add(groupId);
      }
      note.scope.characterIds?.filter((id) => id !== PROFESSOR_MARI_CHARACTER_ID).forEach((id) => characterIds.add(id));
      for (const personaId of getLtmScopePersonaIds(note.scope)) personaIds.add(personaId);
      for (const subject of note.subjects ?? []) {
        if (subject.ref?.kind === "character") characterIds.add(subject.ref.id);
        if (subject.ref?.kind === "persona") personaIds.add(subject.ref.id);
      }
    }
    const namedChats = numberDuplicateLabels(
      [...chatIds]
        .map((id) => chatById.get(id))
        .filter((chat): chat is NonNullable<typeof chat> => Boolean(chat))
        .map((chat) => ({
          id: chat.id,
          label: getLtmChatDisplayName(chat) || "Untitled chat",
          chatName: chat.name?.trim() || "Untitled chat",
          mode: ltmModeForChatMode(chat.mode),
          groupId: chat.groupId,
          personaId: chat.personaId,
          characterIds: normalizeLtmChatCharacterIds(chat.characterIds),
        }))
        .sort((left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id)),
    );
    const memoryPresence: LtmScope[] = [];
    for (const note of notes) {
      if (note.type === "source") continue;
      memoryPresence.push(note.scope);
    }
    const resourceById = new Map(eligibleResources.map((resource) => [resource.id, resource]));
    const visibleCharacterIds = includeAllChats
      ? new Set(eligibleResources.map((resource) => resource.id))
      : characterIds;
    const namedCharacters = numberDuplicateLabels(
      [...visibleCharacterIds]
        .map((id) => {
          const display = resourceById.get(id)
            ? resourceDisplay(resourceById.get(id)!)
            : { id, label: "", comment: "" };
          return {
            id,
            label: display.label || "Untitled character",
            ...(display.comment ? { comment: display.comment } : {}),
          };
        })
        .sort((left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id)),
    );
    return {
      currentScope: currentChat ? resolveChatLtmScope(currentChat) : null,
      memoryPresence,
      chats: namedChats,
      groups: numberDuplicateLabels(
        [...groupIds]
          .map((id) => {
            const members = eligibleChats.filter(
              (chat) => chat.groupId === id && (includeAllChats || chatIds.has(chat.id)),
            );
            return {
              id,
              chatIds: members.map((chat) => chat.id),
              label: namedChats.find((chat) => chat.id === members[0]?.id)?.label?.trim() || "Untitled group",
            };
          })
          .sort((left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id)),
      ),
      characters: namedCharacters,
      localCharacters: [],
      personas: numberDuplicateLabels(
        [...(includeAllChats ? personas : personas.filter((persona) => personaIds.has(persona.id)))]
          .filter((persona) => persona.id !== PROFESSOR_MARI_CHARACTER_ID)
          .map((persona) => {
            const display = resourceDisplay(persona);
            return {
              id: persona.id,
              label: display.label || "Untitled persona",
              ...(display.comment ? { comment: display.comment } : {}),
            };
          })
          .sort((left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id)),
      ),
    };
  });
  app.get<{ Querystring: unknown }>("/local-characters", async (request) => {
    const { chatId, includeAllChats } = scopeTargetsQuery.parse(request.query);
    const [notes, chats] = await Promise.all([storage.listNotes(), getPackagePersistence().listChats()]);
    const eligibleChats = chats.filter(
      (chat) => !normalizeLtmChatCharacterIds(chat.characterIds).includes(PROFESSOR_MARI_CHARACTER_ID),
    );
    const currentChat = chatId ? eligibleChats.find((chat) => chat.id === chatId) : undefined;
    const catalogChats =
      chatId === undefined && includeAllChats
        ? eligibleChats.filter((chat) => chat.mode === "roleplay")
        : currentChat?.mode === "roleplay"
          ? includeAllChats
            ? eligibleChats.filter((chat) => chat.mode === "roleplay")
            : [currentChat]
          : [];
    if (!catalogChats.length) return [];
    const catalogScope = {
      chatIds: catalogChats.map((chat) => chat.id),
      groupIds: [...new Set(catalogChats.flatMap((chat) => (chat.groupId ? [chat.groupId] : [])))],
      characterIds: [...new Set(catalogChats.flatMap((chat) => normalizeLtmChatCharacterIds(chat.characterIds)))],
      personaIds: [...new Set(catalogChats.flatMap((chat) => (chat.personaId ? [chat.personaId] : [])))],
    };
    const catalog = await loadTrustedLtmSubjectCatalog(catalogScope, root, notes);
    return numberDuplicateLabels(
      catalog.entries
        .filter((entry) => entry.subject.ref?.kind === "local_character" && entry.familyId)
        .map((entry) => ({
          id: entry.subject.ref!.id,
          label: entry.name,
          comment: `Roleplay family ${entry.familyId}`,
          familyId: entry.familyId!,
        }))
        .sort((left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id)),
    );
  });
  app.get<{ Params: { id: string } }>("/notes/:id/derived", async (request, reply) => {
    const sourceNoteId = ltmNoteIdSchema.parse(request.params.id);
    const notes = await storage.listNotes();
    const source = notes.find((note) => note.id === sourceNoteId);
    if (!source || !isLtmSourceNote(source))
      return reply.status(404).send({ error: "Long-term memory source note not found" });
    const linkedIds = new Set([sourceNoteId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const note of notes) {
        if (
          linkedIds.has(note.id) ||
          !note.links.some((link) => link.relation === "extracted_from" && linkedIds.has(link.target))
        )
          continue;
        linkedIds.add(note.id);
        changed = true;
      }
    }
    const incomingLinkCounts = new Map<string, number>();
    const outgoingLinkCounts = new Map(notes.map((note) => [note.id, note.links.length]));
    for (const note of notes)
      for (const link of note.links)
        incomingLinkCounts.set(link.target, (incomingLinkCounts.get(link.target) ?? 0) + 1);
    const related = notes
      .filter((note) => note.id !== sourceNoteId && linkedIds.has(note.id))
      .sort((left, right) => (left.title ?? left.id).localeCompare(right.title ?? right.id))
      .map(({ id, title, type, status, scope, sections }) => ({
        id,
        ...(title ? { title } : {}),
        type,
        status,
        scope,
        previewText: Object.values(sections)[0]?.text.replace(/\s+/g, " ").trim().slice(0, 600) ?? "",
        incomingLinkCount: incomingLinkCounts.get(id) ?? 0,
        outgoingLinkCount: outgoingLinkCounts.get(id) ?? 0,
      }));
    return ltmSourceDerivedMemoriesResponseSchema.parse({
      sourceNoteId,
      sourceIncomingLinkCount: incomingLinkCounts.get(sourceNoteId) ?? 0,
      sourceOutgoingLinkCount: outgoingLinkCounts.get(sourceNoteId) ?? 0,
      memories: related,
    });
  });
  app.get<{ Params: { id: string } }>("/notes/:id", async (request, reply) => {
    const note = await storage.getNote(ltmNoteIdSchema.parse(request.params.id));
    return note ?? reply.status(404).send({ error: "Long-term memory note not found" });
  });
  app.post<{ Params: { id: string }; Body: unknown }>(
    "/notes/:id/extract",
    { bodyLimit: DRAFT_BODY_LIMIT_BYTES },
    async (request, reply) => {
      const id = ltmNoteIdSchema.parse(request.params.id);
      const body = ltmExtractSourceNoteRequestSchema.parse(request.body ?? {});
      let sourceNote = await storage.getNote(id);
      if (!sourceNote) return reply.status(404).send({ error: "Long-term memory note not found" });
      if (!isLtmSourceNote(sourceNote))
        return reply.status(400).send({ error: "Long-term memory note is not a source note" });
      const explicitChatId = body.chatId;
      const chatId =
        body.chatId ?? (sourceNote.provenance?.kind === "chat_summary" ? sourceNote.provenance.sourceId : undefined);
      const chat = chatId ? await getPackagePersistence().getChat(chatId) : null;
      if (explicitChatId && !chat) return reply.status(404).send({ error: "Chat not found" });
      const operationId = randomUUID();
      const controller = new AbortController();
      const abort = () => controller.abort();
      const close = () => {
        if (request.raw.aborted) abort();
      };
      request.raw.once("aborted", abort);
      request.raw.once("close", close);
      try {
        let languageModel;
        try {
          const extractionConfig = await getLtmExtractionConfig(root, body.mode);
          languageModel = await getPackageLanguageModels().resolveForRequest({
            connectionId: body.connectionId ?? extractionConfig.connectionId,
            chatConnectionId: chat?.connectionId ?? null,
            model: body.model,
          });
        } catch (error) {
          throw new LtmServiceError(
            error instanceof Error ? error.message : "Language model configuration is invalid",
            400,
            "ltm_model_configuration",
          );
        }
        // Re-extract applies the current availability selection, like a fresh import. An explicit mode
        // must still be enabled; otherwise the previous extraction mode is kept, as import keeps the chat's.
        if (body.modes && body.mode && !body.modes.includes(body.mode))
          throw new LtmServiceError(
            `Long-term memory extraction mode is not enabled for source note: ${body.mode}`,
            400,
            "ltm_mode_not_enabled",
          );
        const extractionMode =
          body.modes && !body.mode ? (sourceNote.extractionFingerprint?.extractionMode ?? body.modes[0]) : undefined;
        const savedModes = sourceNote.modes ?? [];
        if (
          body.modes &&
          (body.modes.length !== savedModes.length || body.modes.some((entry) => !savedModes.includes(entry)))
        )
          sourceNote = (await storage.updateNote(id, { modes: body.modes })) ?? sourceNote;
        return ltmExtractSourceNoteResponseSchema.parse(
          await processLongTermMemorySource({
            sourceNote,
            languageModel,
            scope: sourceNote.destinationScope ?? (chat ? resolveChatLtmWriteScope(chat) : sourceNote.scope),
            modes: sourceNote.modes?.length
              ? sourceNote.modes
              : chat
                ? [ltmModeForChatMode(chat.mode)]
                : body.mode
                  ? [body.mode]
                  : undefined,
            mode: body.mode,
            extractionMode,
            instruction: body.instruction,
            operationId,
            applyLowRisk: body.applyLowRisk,
            signal: controller.signal,
            root,
            chatId: chat?.id,
          }),
        );
      } catch (error) {
        logger.error(error, "[ltm] Source note extraction route failed");
        const result = routeError(error, "Failed to extract long-term memory from source note");
        return reply.status(result.statusCode).send(result.body);
      } finally {
        request.raw.off("aborted", abort);
        request.raw.off("close", close);
      }
    },
  );
  app.post<{ Body: unknown }>(
    "/notes/transfer-preview",
    { bodyLimit: MAINTENANCE_BODY_LIMIT_BYTES },
    async (request, reply) => {
      const body = ltmNoteTransferPreviewRequestSchema.parse(request.body ?? {});
      const chat = await getPackagePersistence().getChat(body.destinationChatId);
      if (!chat) return reply.status(404).send({ error: "Destination chat not found" });
      try {
        return ltmNoteTransferPreviewResponseSchema.parse(await previewLtmNoteTransfer(body, chat, { root, storage }));
      } catch (error) {
        const result = routeError(error, "Failed to preview long-term memory transfer");
        return reply.status(result.statusCode).send(result.body);
      }
    },
  );
  app.post<{ Body: unknown }>(
    "/notes/transfer",
    { bodyLimit: MAINTENANCE_BODY_LIMIT_BYTES },
    async (request, reply) => {
      const body = ltmNoteTransferApplyRequestSchema.parse(request.body ?? {});
      const chat = await getPackagePersistence().getChat(body.destinationChatId);
      if (!chat) return reply.status(404).send({ error: "Destination chat not found" });
      try {
        return ltmNoteTransferApplyResponseSchema.parse(
          await applyLtmNoteTransfer(body, chat, {
            root,
            storage,
            rebuild: async () => {
              const result = await rebuildAfterMutation(root);
              return result.status === "complete"
                ? {
                    generatedAt: result.generatedAt,
                    noteCount: result.noteCount,
                    chunkCount: result.chunkCount,
                    embeddedChunkCount: result.embeddedChunkCount,
                    embeddingsAvailable: result.embeddingsAvailable,
                  }
                : null;
            },
          }),
        );
      } catch (error) {
        const result = routeError(error, "Failed to transfer long-term memory notes");
        return reply.status(result.statusCode).send(result.body);
      }
    },
  );
  app.post<{ Body: unknown }>("/notes/batch", { bodyLimit: MAINTENANCE_BODY_LIMIT_BYTES }, async (request, reply) => {
    const parsed = ltmBulkNoteRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });
    try {
      const result = ltmBulkNoteResultSchema.parse(await storage.bulkMutateNotes(parsed.data));
      return {
        ...result,
        rebuild: result.affectedNoteIds.length ? await rebuildAfterMutation(root) : null,
      };
    } catch (error) {
      const result = routeError(error, "Could not update notes.");
      return reply.status(result.statusCode).send(result.body);
    }
  });
  app.post<{ Body: unknown }>("/notes", { bodyLimit: NOTE_BODY_LIMIT_BYTES }, async (request, reply) => {
    const parsed = createNoteBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });
    const validationError = vaultNoteValidationError(parsed.data);
    if (validationError) return reply.status(400).send({ error: validationError });
    try {
      const note = await storage.createNote(parsed.data);
      const rebuild = await rebuildAfterMutation(root, true);
      return reply.status(201).send({ note, rebuild });
    } catch (error) {
      const result = routeError(error, "Could not create note.");
      return reply.status(result.statusCode).send(result.body);
    }
  });
  app.patch<{ Params: { id: string }; Body: unknown }>(
    "/notes/:id",
    { bodyLimit: NOTE_BODY_LIMIT_BYTES },
    async (request, reply) => {
      const parsedId = ltmNoteIdSchema.safeParse(request.params.id);
      const parsedBody = updateNoteBody.safeParse(request.body);
      if (!parsedId.success || !parsedBody.success) {
        const result = routeError(!parsedId.success ? parsedId.error : parsedBody.error, "Invalid note update.");
        return reply.status(result.statusCode).send(result.body);
      }
      const id = parsedId.data;
      const existing = await storage.getNote(id);
      if (!existing) return reply.status(404).send({ error: "Long-term memory note not found" });
      const patch = parsedBody.data;
      const validationError = vaultNoteValidationError({ ...existing, ...patch });
      if (validationError) return reply.status(400).send({ error: validationError });
      if (existing.type === "source" && patch.sections !== undefined)
        return reply.status(400).send({
          error: "Imported source content can only be updated by refreshing its source.",
        });
      if (patch.scope !== undefined && !isGlobalLtmScope(existing.scope) && isGlobalLtmScope(patch.scope))
        return reply.status(400).send({
          error:
            "Clearing every scope would make this memory global. Remove scope links with the scope-removal action instead; it safely deletes the memory when no explicit scope remains.",
        });
      let note;
      try {
        note = await storage.updateNote(id, patch);
      } catch (error) {
        const result = routeError(error, "Could not update note.");
        return reply.status(result.statusCode).send(result.body);
      }
      const rebuild = await rebuildAfterMutation(root, true);
      return { note, rebuild };
    },
  );
  app.post<{ Params: { id: string }; Body: unknown }>(
    "/notes/:id/sections/rename-preview",
    { bodyLimit: MAINTENANCE_BODY_LIMIT_BYTES },
    async (request, reply) => {
      const parsedId = ltmNoteIdSchema.safeParse(request.params.id);
      const parsedBody = ltmRenameNoteSectionRequestSchema.safeParse(request.body);
      if (!parsedId.success || !parsedBody.success) {
        const result = routeError(!parsedId.success ? parsedId.error : parsedBody.error, "Invalid section rename.");
        return reply.status(result.statusCode).send(result.body);
      }
      try {
        return ltmRenameNoteSectionPreviewResponseSchema.parse(
          await storage.previewNoteSectionRename(
            parsedId.data,
            parsedBody.data.fromSectionKey,
            parsedBody.data.toSectionKey,
          ),
        );
      } catch (error) {
        const result = routeError(error, "Could not preview note section rename.");
        return reply.status(result.statusCode).send(result.body);
      }
    },
  );
  app.post<{ Params: { id: string }; Body: unknown }>(
    "/notes/:id/sections/rename",
    { bodyLimit: MAINTENANCE_BODY_LIMIT_BYTES },
    async (request, reply) => {
      const parsedId = ltmNoteIdSchema.safeParse(request.params.id);
      const parsedBody = ltmRenameNoteSectionRequestSchema.safeParse(request.body);
      if (!parsedId.success || !parsedBody.success) {
        const result = routeError(!parsedId.success ? parsedId.error : parsedBody.error, "Invalid section rename.");
        return reply.status(result.statusCode).send(result.body);
      }
      try {
        const renamed = await storage.renameNoteSection(
          parsedId.data,
          parsedBody.data.fromSectionKey,
          parsedBody.data.toSectionKey,
        );
        const rebuildResult = await rebuildAfterMutation(root, true);
        return ltmRenameNoteSectionResponseSchema.parse({
          ...renamed,
          rebuild:
            rebuildResult.status === "complete"
              ? {
                  status: rebuildResult.status,
                  generatedAt: rebuildResult.generatedAt,
                  noteCount: rebuildResult.noteCount,
                  chunkCount: rebuildResult.chunkCount,
                  embeddedChunkCount: rebuildResult.embeddedChunkCount,
                  embeddingsAvailable: rebuildResult.embeddingsAvailable,
                }
              : rebuildResult,
        });
      } catch (error) {
        const result = routeError(error, "Could not rename note section.");
        return reply.status(result.statusCode).send(result.body);
      }
    },
  );
  app.post<{ Params: { id: string }; Body: unknown }>("/notes/:id/scope/apply-to-derived", async (request, reply) => {
    const result = await applyLtmScopeLinksToDerivedNotes(
      ltmNoteIdSchema.parse(request.params.id),
      applyDerivedBody.parse(request.body ?? {}),
      { root },
    );
    return result ?? reply.status(404).send({ error: "Long-term memory note not found" });
  });
  app.delete<{ Params: { id: string } }>("/notes/:id", async (request, reply) => {
    const id = ltmNoteIdSchema.parse(request.params.id);
    if (!(await storage.getNote(id))) return reply.status(404).send({ error: "Long-term memory note not found" });
    const notes = await storage.archiveSourceNoteWithDerived(id);
    const rebuild = await rebuildAfterMutation(root);
    return { archived: true, note: notes[0], notes, rebuild };
  });
  app.post<{ Body: unknown }>("/notes/permanent-delete", async (request, reply) => {
    const body = z
      .object({
        ids: z.array(ltmNoteIdSchema).min(1).max(500),
        retractExtracted: z.boolean().optional().default(false),
        excludedNoteIds: z.array(ltmNoteIdSchema).max(500).optional(),
        lineageSourceNoteId: ltmNoteIdSchema.optional(),
        expectedLineageNoteIds: z.array(ltmNoteIdSchema).max(1_000).optional(),
      })
      .strict()
      .parse(request.body ?? {});
    try {
      const result = await storage.deleteNotesPermanently(body.ids, {
        retractExtracted: body.retractExtracted,
        excludedNoteIds: body.excludedNoteIds,
        lineageSourceNoteId: body.lineageSourceNoteId,
        expectedLineageNoteIds: body.expectedLineageNoteIds,
      });
      const rebuild = result.deletedIds.length ? await rebuildAfterMutation(root) : null;
      return {
        deletedIds: result.deletedIds,
        failedIds: result.failedIds,
        detachedNoteIds: result.detachedNoteIds,
        rebuild,
      };
    } catch (error) {
      const result = routeError(error, "Could not permanently delete memories.");
      return reply.status(result.statusCode).send(result.body);
    }
  });
  app.delete<{ Params: { id: string }; Body: unknown }>("/notes/:id/scope/current-chat", async (request, reply) => {
    const id = ltmNoteIdSchema.parse(request.params.id);
    const { chatId } = removeCurrentChatBody.parse(request.body ?? {});
    if (!(await getPackagePersistence().getChat(chatId))) return reply.status(404).send({ error: "Chat not found" });
    let result;
    try {
      result = await storage.removeNoteFromScope(id, {
        chatIds: [chatId],
      });
    } catch (error) {
      const result = routeError(error, "Could not remove memory from scope");
      return reply.status(result.statusCode).send(result.body);
    }
    const rebuild = result.changed ? await rebuildAfterMutation(root) : null;
    return result.deleted
      ? { deleted: true, unscoped: false, id, rebuild }
      : {
          deleted: false,
          unscoped: result.changed,
          id,
          note: result.note,
          rebuild,
        };
  });
  app.delete<{ Params: { id: string }; Body: unknown }>("/notes/:id/scope", async (request, reply) => {
    const id = ltmNoteIdSchema.parse(request.params.id);
    let result;
    try {
      result = await storage.removeNoteFromScope(id, removeScopeBody.parse(request.body ?? {}));
    } catch (error) {
      const result = routeError(error, "Could not remove memory from scope");
      return reply.status(result.statusCode).send(result.body);
    }
    const rebuild = result.changed ? await rebuildAfterMutation(root) : null;
    return result.deleted
      ? { deleted: true, unscoped: false, id, rebuild }
      : {
          deleted: false,
          unscoped: result.changed,
          id,
          note: result.note,
          rebuild,
        };
  });
  app.post<{ Body: unknown }>("/search", { bodyLimit: SEARCH_BODY_LIMIT_BYTES }, async (request) => {
    const body = searchBody.parse(request.body);
    const scopedChatIds = new Set([...(body.scope?.chatId ? [body.scope.chatId] : []), ...(body.scope?.chatIds ?? [])]);
    const chat =
      scopedChatIds.size === 1 ? await getPackagePersistence().getChat(scopedChatIds.values().next().value!) : null;
    const mode = body.mode ?? (chat ? ltmModeForChatMode(chat.mode) : undefined);
    const recall = resolveLongTermMemoryRecallSettings({
      chatMode: mode ?? "roleplay",
      chatMetadata: parseLtmChatMetadata(chat?.metadata),
      globalSettings: await getLtmGlobalSettings(root),
    });
    const promptBudgetTokens = body.maxTokens ?? recall.budgetTokens ?? 4096;
    const promptOverheadTokens = estimateLongTermMemoryPromptOverhead(recall.recallPreamble);
    const retrievalMaxTokens =
      promptBudgetTokens > promptOverheadTokens ? promptBudgetTokens - promptOverheadTokens : promptBudgetTokens;
    const maxChunks = body.maxChunks ?? recall.maxChunks ?? 20;
    const scoreThreshold = body.minScore ?? recall.scoreThreshold ?? 0;
    const includeResolved = body.includeResolved ?? recall.includeResolved;
    const weights = {
      semanticWeight: body.semanticWeight ?? recall.weights.semanticWeight,
      lexicalWeight: body.lexicalWeight ?? recall.weights.lexicalWeight,
      graphWeight: body.graphWeight ?? recall.weights.graphWeight,
      keywordWeight: body.keywordWeight ?? recall.weights.keywordWeight,
    };
    // A scope that only names the chat resolves like a turn, adding the chat's group and persona and the
    // memories a branch shares with the other branches of its conversation.
    const turnChat =
      chat && Object.keys(body.scope ?? {}).every((key) => key === "chatId" || key === "chatIds") ? chat : null;
    const result = await retrieveLongTermMemory({
      ...body,
      root,
      mode,
      scope: turnChat ? resolveChatLtmScope(turnChat) : body.scope,
      inheritedNoteIds: turnChat
        ? await branchInheritedNoteIds(root, turnChat, mode ?? ltmModeForChatMode(turnChat.mode))
        : undefined,
      characterIds:
        body.characterIds ??
        (body.scope?.characterIds !== undefined
          ? undefined
          : chat
            ? normalizeLtmChatCharacterIds(chat.characterIds)
            : undefined),
      includeResolved,
      maxChunks,
      maxTokens: retrievalMaxTokens,
      minScore: scoreThreshold,
      ...weights,
      explain: body.explain ?? recall.debugEnabled,
      promptNormalizedEstimate: true,
    });
    return {
      ...result,
      promptBudgetTokens,
      promptOverheadTokens,
      recallSettings: {
        mode,
        recallStyle: recall.recallStyle,
        maxChunks,
        maxTokens: promptBudgetTokens,
        scoreThreshold,
        includeResolved,
        weights,
      },
    };
  });
}
