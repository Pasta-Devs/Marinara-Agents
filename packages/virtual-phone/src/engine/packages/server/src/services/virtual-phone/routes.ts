// Virtual Phone HTTP routes. Generation stays server-side so provider
// credentials never reach the package client.
import type { FastifyPluginAsync } from "fastify";
import { defaultInstalledApps, findApp, findAppByUrl, listApps } from "./apps.js";
import { buildFullPagePrompt, buildSlotFillPrompt, parseStructuredResponse, type PhonePageContext } from "./prompt.js";
import { getPackageRuntime, resolvePhoneModel } from "./package-runtime.js";
import { fillSlots, findTemplate } from "./templates.js";

const PAGE_CACHE_TTL_MS = 5 * 60 * 1000;
const PAGE_CACHE_MAX = 120;
const MAX_RECENT_MESSAGES = 12;

type CachedPage = { timestamp: number; value: PageResult };
type PageResult = {
  html: string;
  title: string;
  observerText: string;
  observerName: string;
  appId: string;
  url: string;
};

const pageCache = new Map<string, CachedPage>();

function cacheKey(input: {
  chatId: string;
  url: string;
  phoneIdentity?: string;
  owner?: { kind: "chat" | "character"; id: string };
  personaId?: string;
  characterIds?: string[];
}) {
  const owner = input.owner ? `${input.owner.kind}:${input.owner.id}` : `chat:${input.chatId}`;
  const persona = input.personaId || "none";
  const characters = [...(input.characterIds || [])].sort().join(",") || "none";
  return [input.chatId, input.phoneIdentity || "", owner, `persona:${persona}`, `characters:${characters}`, input.url].join("\0");
}

function readCache(key: string): PageResult | null {
  const hit = pageCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.timestamp > PAGE_CACHE_TTL_MS) {
    pageCache.delete(key);
    return null;
  }
  return hit.value;
}

function writeCache(key: string, value: PageResult) {
  pageCache.set(key, { timestamp: Date.now(), value });
  while (pageCache.size > PAGE_CACHE_MAX) {
    const oldest = pageCache.keys().next();
    if (oldest.done) break;
    pageCache.delete(oldest.value);
  }
}

export function clearPageCache() {
  pageCache.clear();
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalisePageHtml(html: string, title: string): string {
  const trimmed = html.trim();
  if (/^<!doctype html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) return trimmed;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title></head><body>${trimmed}</body></html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) =>
    character === "&" ? "&amp;"
      : character === "<" ? "&lt;"
      : character === ">" ? "&gt;"
      : character === '"' ? "&quot;"
      : "&#39;",
  );
}

async function readChat(chatId: string) {
  const runtime = getPackageRuntime();
  if (!chatId || !runtime.persistence?.getChat) return null;
  try {
    return await runtime.persistence.getChat(chatId);
  } catch (error) {
    runtime.logger.warn(
      "Virtual Phone could not read the chat: %s",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

async function buildPageContext(
  body: Record<string, unknown>,
  url: string,
  chat: Awaited<ReturnType<typeof readChat>>,
): Promise<PhonePageContext> {
  const runtime = getPackageRuntime();
  const supplied = asRecord(body.context);
  const context: PhonePageContext = {
    url,
    phoneOwner: (() => {
      const owner = asRecord(body.phoneOwner);
      const kind = owner.kind === "character" ? "character" : "chat";
      const id = asString(owner.id);
      return id ? { kind, id, name: asString(owner.name) || undefined } : undefined;
    })(),
    personaId: asString(supplied.personaId) || undefined,
    characterIds: chat?.characterIds?.length ? [...chat.characterIds].sort() : undefined,
    chatSummary: asString(supplied.chatSummary) || undefined,
    worldInfo: asString(supplied.worldInfo) || undefined,
    persona: asString(supplied.persona) || undefined,
    lastAction: asString(body.lastAction) || undefined,
    formData: Object.keys(asRecord(body.formData)).length ? asRecord(body.formData) : undefined,
    pageHistory: asString(body.pageHistory) || undefined,
  };

  const recent = Array.isArray(supplied.recentMessages) ? supplied.recentMessages : [];
  if (recent.length) {
    context.recentMessages = recent
      .slice(-MAX_RECENT_MESSAGES)
      .map((message) => asRecord(message))
      .filter((message) => typeof message.content === "string")
      .map((message) => ({ role: asString(message.role, "user"), content: String(message.content) }));
  }

  const navHistory = Array.isArray(body.navHistory) ? body.navHistory : [];
  if (navHistory.length) {
    context.navHistory = navHistory
      .map((entry) => asRecord(entry))
      .filter((entry) => typeof entry.url === "string")
      .slice(-3)
      .map((entry) => ({ url: String(entry.url), title: asString(entry.title) }));
  }

  if (chat?.characterIds?.length && runtime.resources?.listCharacters) {
    try {
      const characters = await runtime.resources.listCharacters(chat.characterIds);
      const names = characters
        .map((character) => asRecord(character.data).name)
        .filter((name): name is string => typeof name === "string" && name.length > 0);
      if (names.length) context.characters = names;
    } catch (error) {
      runtime.logger.warn(
        "Virtual Phone could not read chat characters: %s",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return context;
}

export function createVirtualPhoneRoutes(): FastifyPluginAsync {
  return async (app) => {
    app.get("/apps", async () => ({ apps: listApps(), defaults: defaultInstalledApps() }));

    app.post("/page", async (request, reply) => {
      const body = asRecord((request as { body?: unknown }).body);
      const runtime = getPackageRuntime();
      const requestedAppId = asString(body.appId);
      const rawUrl = asString(body.url);
      const phoneApp = findApp(requestedAppId) ?? (rawUrl ? findAppByUrl(rawUrl) : null);
      if (!phoneApp) return reply.code(400).send({ error: "Unknown phone app." });

      const url = rawUrl || `https://${phoneApp.domain}/`;
      const chatId = asString(body.chatId);
      if (!chatId) return reply.code(400).send({ error: "Open a supported chat before using the phone." });

      const chat = await readChat(chatId);
      if (!chat) return reply.code(404).send({ error: "The active chat could not be found." });

      const suppliedContext = asRecord(body.context);
      const ownerRecord = asRecord(body.phoneOwner);
      const ownerKind = ownerRecord.kind === "character" ? "character" : "chat";
      const ownerId = asString(ownerRecord.id) || chatId;
      const phoneIdentity = asString(body.phoneIdentity);
      const personaId = asString(suppliedContext.personaId);
      const key = cacheKey({
        chatId,
        url,
        phoneIdentity,
        owner: { kind: ownerKind, id: ownerId },
        personaId,
        characterIds: chat.characterIds,
      });
      if (body.refresh !== true) {
        const cached = readCache(key);
        if (cached) return { ...cached, fromCache: true };
      }

      const connectionId = asString(body.connectionId) || null;
      const chatConnectionId = asString(body.chatConnectionId) || chat.connectionId || null;
      let model;
      try {
        model = await resolvePhoneModel(connectionId, chatConnectionId);
      } catch (error) {
        return reply.code(400).send({
          error: error instanceof Error ? error.message : "Could not resolve a language-model connection.",
        });
      }

      const context = await buildPageContext(body, url, chat);
      const template = findTemplate(phoneApp.id, url);
      const messages = template
        ? buildSlotFillPrompt(phoneApp, template, context)
        : buildFullPagePrompt(phoneApp, context);

      let content: string | null = null;
      try {
        const fitted = model.fitContext(messages);
        const completion = await model.chatComplete(fitted.messages, {
          temperature: 0.9,
          maxTokens: fitted.maxTokens,
          responseFormat: { type: "json_object" },
        });
        content = completion.content;
      } catch (error) {
        runtime.logger.error(error, "Virtual Phone page generation failed");
        return reply.code(502).send({ error: "The model could not render that screen." });
      }

      const parsed = parseStructuredResponse(content);
      if (!parsed) return reply.code(502).send({ error: "The model returned no usable page." });

      const title = asString(parsed.title) || phoneApp.name;
      let html: string;
      if (template) {
        html = fillSlots(template.html, asRecord(parsed.slots));
      } else {
        const generated = asString(parsed.html);
        if (!generated) return reply.code(502).send({ error: "The model returned no page HTML." });
        html = normalisePageHtml(generated, title);
      }

      const result: PageResult = {
        html,
        title,
        observerText: asString(parsed.observerText),
        observerName: asString(parsed.observerName) || phoneApp.name,
        appId: phoneApp.id,
        url,
      };
      writeCache(key, result);
      return result;
    });
  };
}
