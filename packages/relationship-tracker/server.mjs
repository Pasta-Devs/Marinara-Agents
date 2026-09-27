import {
  PACKAGE_ID,
  READ_API_VERSION,
  STATE_SCHEMA_VERSION,
  RelationshipStateError,
  createRelationshipStateRepository,
} from "./state.mjs";
import {
  selectPromptPersonaPerceptions,
  selectPromptRelationships,
  serializePersonaPerceptionPrompt,
  serializeRelationshipPrompt,
} from "./prompt.mjs";
import { RelationshipTrackingError, createAutomaticTrackingRuntime } from "./tracking.mjs";
import { createProcessingStatusManager } from "./activity.mjs";
import { RelationshipHistoryError, createHistoryUpdateService } from "./history.mjs";
import { createPersonaStateRepository } from "./persona-state.mjs";

export { PACKAGE_ID, READ_API_VERSION, STATE_SCHEMA_VERSION };
export const READ_API_PATH = "/api/relationship-tracker/v1/chats/:chatId/relationships";
export const SETTINGS_API_PATH = "/api/relationship-tracker/v1/chats/:chatId/settings";
export const PANEL_API_PATH = "/api/relationship-tracker/v1/chats/:chatId/panel";
export const STATUS_API_PATH = "/api/relationship-tracker/v1/chats/:chatId/status";
export const MANUAL_RELATIONSHIP_API_PATH = "/api/relationship-tracker/v1/chats/:chatId/relationships/manual";
export const RESUME_RELATIONSHIP_API_PATH = "/api/relationship-tracker/v1/chats/:chatId/relationships/resume";
export const HISTORY_UPDATE_API_PATH = "/api/relationship-tracker/v1/chats/:chatId/history-update";
export const PERSONA_VISIBILITY_API_PATH = "/api/relationship-tracker/v1/chats/:chatId/persona/visibility";
export const MANUAL_PERSONA_API_PATH = "/api/relationship-tracker/v1/chats/:chatId/persona/manual";
export const RESUME_PERSONA_API_PATH = "/api/relationship-tracker/v1/chats/:chatId/persona/resume";

let active = false;
let activeService = null;
let activePromptContributor = null;

function assertActivationContext(context) {
  if (context?.package?.id !== PACKAGE_ID) throw new Error(`Relationship Tracker received the wrong package identity: ${String(context?.package?.id)}.`);
  if (typeof context?.api?.registerService !== "function") throw new Error("Relationship Tracker requires the package service registration API.");
  if (typeof context?.api?.registerPromptContext !== "function") throw new Error("Relationship Tracker requires the package prompt-context registration API.");
  if (typeof context?.api?.registerPrivilegedRoutes !== "function") throw new Error("Relationship Tracker requires the package route registration API.");
  if (typeof context?.api?.runtime?.persistence?.listMessages !== "function") throw new Error("Relationship Tracker requires read-only package chat messages for scene presence and history updates.");
  if (typeof context?.api?.runtime?.getAgentConfig !== "function" ||
      typeof context?.api?.runtime?.languageModels?.resolve !== "function" ||
      typeof context?.api?.runtime?.json?.parseJsonish !== "function") {
    throw new Error("Relationship Tracker requires package agent configuration and language-model runtime APIs.");
  }
}

function errorResponse(error) {
  if (error instanceof RelationshipStateError || error instanceof RelationshipHistoryError) {
    return { statusCode: error.statusCode, body: { error: error.message, code: error.code } };
  }
  if (error instanceof RelationshipTrackingError) {
    return { statusCode: 502, body: { error: error.message, code: "invalid_relationship_snapshot" } };
  }
  return { statusCode: 500, body: { error: "Relationship Tracker request failed.", code: "internal_error" } };
}

function isEnabledForRequest(request) {
  const metadata = request?.chatMeta;
  return request?.mode === "roleplay" && metadata?.enableAgents === true &&
    Array.isArray(metadata.activeAgentIds) && metadata.activeAgentIds.includes(PACKAGE_ID);
}

export function createPromptContributor(repository, personaRepository, runtime) {
  return async (request) => {
    if (!isEnabledForRequest(request)) return null;
    const [snapshot, personaSnapshot] = await Promise.all([
      repository.getTrackingSnapshot(request.chatId),
      personaRepository.getSnapshot(request.chatId),
    ]);
    const state = snapshot.state;
    if (!state) return null;
    const messages = await runtime.persistence.listMessages(request.chatId);
    const relationships = selectPromptRelationships(state, messages, snapshot.characters);
    const perceptions = selectPromptPersonaPerceptions(personaSnapshot, state, messages, snapshot.characters);
    const parts = [
      serializeRelationshipPrompt(relationships, snapshot.characters),
      serializePersonaPerceptionPrompt(perceptions, personaSnapshot.persona, snapshot.characters),
    ].filter(Boolean);
    return parts.length ? parts.join("\n") : null;
  };
}

async function getPrivatePanelResponse(repository, personaRepository, chatId) {
  const [panel, personaSnapshot] = await Promise.all([
    repository.getPanelResponse(chatId),
    personaRepository.getSnapshot(chatId),
  ]);
  return { ...panel, persona: personaSnapshot.persona, showPersona: personaSnapshot.showPersona, personaPerceptions: personaSnapshot.perceptions };
}

function sendFailure(context, reply, label, error) {
  context.api.runtime.logger?.warn?.(`Relationship Tracker ${label} failed`, error);
  const failure = errorResponse(error);
  return reply.status(failure.statusCode).send(failure.body);
}

export async function activate(context) {
  assertActivationContext(context);
  const repository = createRelationshipStateRepository(context.api.runtime);
  const personaRepository = createPersonaStateRepository(context.api.runtime);
  const activity = createProcessingStatusManager();
  const promptContributor = createPromptContributor(repository, personaRepository, context.api.runtime);
  const trackingRuntime = createAutomaticTrackingRuntime(repository, activity, {
    parseJsonish: context.api.runtime.json.parseJsonish,
    personaRepository,
  });
  const historyUpdates = createHistoryUpdateService(repository, context.api.runtime, activity, { personaRepository });
  const service = Object.freeze({
    prepareContext: trackingRuntime.prepareContext,
    finalizeResult: trackingRuntime.finalizeResult,
    schemaVersion: STATE_SCHEMA_VERSION,
    readApiVersion: READ_API_VERSION,
    getState: repository.getState,
    saveState: repository.saveState,
    getSettings: repository.getSettings,
    updateSettings: repository.updateSettings,
    getReadResponse: repository.getReadResponse,
    getPanelResponse: (chatId) => getPrivatePanelResponse(repository, personaRepository, chatId),
    getPersonaSnapshot: personaRepository.getSnapshot,
    updatePersonaVisibility: personaRepository.updateVisibility,
    updateManualPersonaPerception: personaRepository.updateManualPerception,
    resumeAutomaticPersonaPerception: personaRepository.resumeAutomaticPerception,
    updateManualRelationship: repository.updateManualRelationship,
    resumeAutomaticRelationship: repository.resumeAutomaticRelationship,
    getProcessingStatus: activity.getStatus,
    updateFromHistory: historyUpdates.updateFromHistory,
  });
  const releases = [];
  try {
    releases.push(context.api.registerService(`agent-runtime:${PACKAGE_ID}`, service));
    releases.push(context.api.registerPromptContext(promptContributor));
    releases.push(await context.api.registerPrivilegedRoutes(async (routes) => {
      routes.get("/chats/:chatId/relationships", async (request, reply) => {
        try { return reply.send(await repository.getReadResponse(request?.params?.chatId)); }
        catch (error) { return sendFailure(context, reply, "relationship read request", error); }
      });
      routes.get("/chats/:chatId/panel", async (request, reply) => {
        try { return reply.send(await getPrivatePanelResponse(repository, personaRepository, request?.params?.chatId)); }
        catch (error) { return sendFailure(context, reply, "panel read request", error); }
      });
      routes.get("/chats/:chatId/status", async (request, reply) => {
        try { return reply.send(activity.getStatus(request?.params?.chatId)); }
        catch (error) { return sendFailure(context, reply, "processing-status request", error); }
      });
      routes.get("/chats/:chatId/settings", async (request, reply) => {
        try { return reply.send(await repository.getSettings(request?.params?.chatId)); }
        catch (error) { return sendFailure(context, reply, "settings read request", error); }
      });
      routes.patch("/chats/:chatId/settings", async (request, reply) => {
        try { return reply.send(await repository.updateSettings(request?.params?.chatId, request?.body)); }
        catch (error) { return sendFailure(context, reply, "settings update request", error); }
      });
      routes.post("/chats/:chatId/relationships/manual", async (request, reply) => {
        try {
          await repository.updateManualRelationship(request?.params?.chatId, request?.body);
          return reply.send(await getPrivatePanelResponse(repository, personaRepository, request?.params?.chatId));
        } catch (error) { return sendFailure(context, reply, "manual relationship update", error); }
      });
      routes.post("/chats/:chatId/relationships/resume", async (request, reply) => {
        try {
          await repository.resumeAutomaticRelationship(request?.params?.chatId, request?.body);
          return reply.send(await getPrivatePanelResponse(repository, personaRepository, request?.params?.chatId));
        } catch (error) { return sendFailure(context, reply, "resume automatic relationship update", error); }
      });
      routes.patch("/chats/:chatId/persona/visibility", async (request, reply) => {
        try {
          await personaRepository.updateVisibility(request?.params?.chatId, request?.body?.showPersona);
          return reply.send(await getPrivatePanelResponse(repository, personaRepository, request?.params?.chatId));
        } catch (error) { return sendFailure(context, reply, "persona visibility update", error); }
      });
      routes.post("/chats/:chatId/persona/manual", async (request, reply) => {
        try {
          await personaRepository.updateManualPerception(request?.params?.chatId, request?.body);
          return reply.send(await getPrivatePanelResponse(repository, personaRepository, request?.params?.chatId));
        } catch (error) { return sendFailure(context, reply, "manual persona perception update", error); }
      });
      routes.post("/chats/:chatId/persona/resume", async (request, reply) => {
        try {
          await personaRepository.resumeAutomaticPerception(request?.params?.chatId, request?.body);
          return reply.send(await getPrivatePanelResponse(repository, personaRepository, request?.params?.chatId));
        } catch (error) { return sendFailure(context, reply, "resume automatic persona perception", error); }
      });
      routes.post("/chats/:chatId/history-update", async (request, reply) => {
        try { return reply.send(await historyUpdates.updateFromHistory(request?.params?.chatId, request?.body)); }
        catch (error) { return sendFailure(context, reply, "history update", error); }
      });
    }, { prefix: `/api/${PACKAGE_ID}/v1` }));
    activeService = service;
    activePromptContributor = promptContributor;
    active = true;
  } catch (error) {
    for (const release of releases.reverse()) await release();
    throw error;
  }
  return async () => {
    active = false;
    activeService = null;
    activePromptContributor = null;
    activity.clear();
    for (const release of releases.reverse()) await release();
  };
}

export async function selfCheck(context) {
  assertActivationContext(context);
  if (!active || !activeService || !activePromptContributor) throw new Error("Relationship Tracker did not activate.");
  if (activeService.schemaVersion !== STATE_SCHEMA_VERSION || activeService.readApiVersion !== READ_API_VERSION ||
      typeof activeService.prepareContext !== "function" || typeof activeService.finalizeResult !== "function") {
    throw new Error("Relationship Tracker registered an incompatible runtime service.");
  }
}
