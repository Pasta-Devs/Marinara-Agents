import type { FastifyPluginAsync } from "fastify";
import {
  PhoneIdentityService,
  type EnsurePhoneInput,
  type PhoneBaselineTheme,
  type PhoneOwnerType,
} from "../device/identity";
import { normalizeDeviceSettings, type DeviceSettings } from "../device/settings";
import { PhoneMessagingService, unreadCount, unreadMessages, type ThreadDocument } from "./messaging";
import { parseBoundedContent } from "../platform/content";
import { fallbackSearchResults } from "../apps/goodle/manifest";

interface CapabilityContext {
  api: {
    runtime: {
      persistence: {
        documents: ConstructorParameters<typeof PhoneIdentityService>[0];
        getChat(chatId: string): Promise<{
          id: string;
          personaId: string | null;
          characterIds: string[];
        } | null>;
        listMessages?(chatId: string): Promise<Array<{
          role: string;
          characterId: string | null;
          content: string;
        }>>;
      };
      resources: {
        listCharacters(ids?: string[]): Promise<Array<{ id: string; data: unknown }>>;
        listPersonas(ids?: string[]): Promise<Array<{ id: string; data: unknown }>>;
      };
      languageModels?: {
        resolve(connectionId?: string | null): Promise<{
          chatComplete(
            messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
            options?: { temperature?: number; maxTokens?: number },
          ): Promise<{ content: string }>;
        }>;
      };
    };
    registerPrivilegedRoutes(routes: FastifyPluginAsync, options: { prefix: string }): Promise<() => void>;
  };
}

function readTheme(value: unknown): PhoneBaselineTheme {
  if (value === "system" || value === "light" || value === "dark") return value;
  throw new Error("baselineTheme must be system, light, or dark");
}

function readName(value: unknown, fallback: string) {
  if (typeof value === "string") {
    try {
      return readName(JSON.parse(value), fallback);
    } catch {
      return fallback;
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const data = value as Record<string, unknown>;
  if (typeof data.name === "string" && data.name.trim()) return data.name.trim();
  return readName(data.data, fallback);
}

function phoneResponse(phone: Awaited<ReturnType<PhoneIdentityService["ensure"]>>) {
  return {
    ...phone.document.identity,
    ...phone.document.provisioning,
    settings: normalizeDeviceSettings(phone.document.namespaces.phone.settings, phone.document.provisioning.baselineTheme),
  };
}

function readOwnerType(value: unknown): PhoneOwnerType {
  if (value === "persona" || value === "character") return value;
  throw new Error("ownerType must be persona or character");
}

function readEnsureInput(value: unknown): EnsurePhoneInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Request body is required");
  const body = value as Record<string, unknown>;
  return {
    ownerId: String(body.ownerId ?? ""),
    ownerType: readOwnerType(body.ownerType),
    ownerName: String(body.ownerName ?? ""),
    chatId: String(body.chatId ?? ""),
    ...(body.deviceName === undefined ? {} : { deviceName: body.deviceName === null ? null : String(body.deviceName) }),
    ...(body.enabled === undefined ? {} : { enabled: body.enabled === true }),
    ...(body.baselineTheme === undefined ? {} : { baselineTheme: readTheme(body.baselineTheme) }),
  };
}

export async function activate({ api }: CapabilityContext) {
  const phones = new PhoneIdentityService(api.runtime.persistence.documents);
  const messaging = new PhoneMessagingService(api.runtime.persistence.documents);
  await phones.migrateLegacyDocuments();

  const findPhone = async (phoneId: string) => {
    const phone = (await phones.list()).find(({ document }) => document.identity.phoneId === phoneId);
    if (!phone) throw new Error("Phone not found");
    return phone;
  };
  const contactsFor = async (phoneId: string) => {
    const self = await findPhone(phoneId);
    return (await phones.list())
      .filter(({ document }) =>
        document.identity.phoneId !== phoneId &&
        document.provisioning.enabled &&
        document.identity.chatScope.some((chatId) => self.document.identity.chatScope.includes(chatId)))
      .map(({ document }) => ({ phoneId: document.identity.phoneId, ownerName: document.identity.ownerName }));
  };
  const threadPayload = (threadId: string, document: ThreadDocument, phoneId: string, names: Map<string, string>) => {
    const otherPhoneId = document.participants.find((participant) => participant !== phoneId) ?? "";
    return {
      id: threadId,
      otherPhoneId,
      otherName: names.get(otherPhoneId) ?? "Unknown phone",
      unread: unreadCount(document, phoneId),
      messages: document.messages,
    };
  };

  // ponytail: reply generated inline with send; queue it if model latency hurts
  const generateCharacterReply = async (senderPhoneId: string, recipientPhoneId: string) => {
    try {
      const recipient = await findPhone(recipientPhoneId);
      if (recipient.document.identity.ownerType !== "character" || !recipient.document.provisioning.enabled) return null;
      const model = await api.runtime.languageModels?.resolve();
      if (!model) return null;
      const sender = await findPhone(senderPhoneId);
      const thread = (await messaging.threadsFor(recipientPhoneId))
        .find(({ document }) => document.participants.includes(senderPhoneId));
      if (!thread) return null;
      const recipientName = recipient.document.identity.ownerName;
      const senderName = sender.document.identity.ownerName;
      const history = thread.document.messages.slice(-20)
        .map((message) => `${message.from === recipientPhoneId ? recipientName : senderName}: ${message.text}`)
        .join("\n");
      const sharedChatId = recipient.document.identity.chatScope
        .find((chatId) => sender.document.identity.chatScope.includes(chatId));
      let storyContext = "";
      if (sharedChatId && api.runtime.persistence.listMessages) {
        const recent = (await api.runtime.persistence.listMessages(sharedChatId)).slice(-10);
        storyContext = recent
          .map((message) => `${message.role === "user" ? senderName : recipientName}: ${message.content.slice(0, 240)}`)
          .join("\n");
      }
      const completion = await model.chatComplete([
        {
          role: "system",
          content: `You are ${recipientName}, texting ${senderName} on your phone inside an ongoing roleplay. Write one short in-character text message reply. Respond with only JSON: {"reply":"your message"}. If ${recipientName} would leave the message on read, respond with {"reply":""}.${storyContext ? `\n\nRecent story events for context:\n${storyContext}` : ""}`,
        },
        { role: "user", content: history },
      ], { temperature: 0.9, maxTokens: 200 });
      const { reply } = parseBoundedContent(completion.content, { fields: { reply: "string" }, defaults: { reply: "" } }) as { reply: string };
      if (!reply.trim()) return null;
      return await messaging.send(recipientPhoneId, senderPhoneId, reply);
    } catch {
      return null;
    }
  };

  const routes: FastifyPluginAsync = async (app) => {
    app.get("/phones", async () => ({ phones: (await phones.list()).map(phoneResponse) }));
    app.get<{ Params: { ownerType: string; ownerId: string } }>("/phones/:ownerType/:ownerId", async (request, reply) => {
      try {
        const phone = await phones.get(readOwnerType(request.params.ownerType), request.params.ownerId);
        if (!phone) return reply.status(404).send({ error: "Phone not found" });
        return { phone: { ...phone.document.identity, ...phone.document.provisioning } };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Invalid phone request" });
      }
    });
    app.post("/phones", async (request, reply) => {
      try {
        const phone = await phones.ensure(readEnsureInput(request.body));
        return { phone: phoneResponse(phone) };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Invalid phone request" });
      }
    });
    app.get<{ Params: { chatId: string } }>("/chats/:chatId/unread", async (request, reply) => {
      const chat = await api.runtime.persistence.getChat(request.params.chatId);
      if (!chat) return reply.status(404).send({ error: "Chat not found" });
      const inChat = (await phones.list()).filter(({ document }) =>
        document.provisioning.enabled && document.identity.chatScope.includes(chat.id));
      let unread = 0;
      for (const { document } of inChat) {
        for (const thread of await messaging.threadsFor(document.identity.phoneId)) {
          unread += unreadCount(thread.document, document.identity.phoneId);
        }
      }
      return { unread };
    });
    app.get<{ Params: { chatId: string } }>("/chats/:chatId/phones", async (request, reply) => {
      const chat = await api.runtime.persistence.getChat(request.params.chatId);
      if (!chat) return reply.status(404).send({ error: "Chat not found" });
      const [personas, characters] = await Promise.all([
        chat.personaId ? api.runtime.resources.listPersonas([chat.personaId]) : Promise.resolve([]),
        api.runtime.resources.listCharacters(chat.characterIds),
      ]);
      const persona = personas[0];
      const personaPhone = persona
        ? await phones.ensure({
            ownerId: persona.id,
            ownerType: "persona",
            ownerName: readName(persona.data, "Persona"),
            chatId: chat.id,
            enabled: true,
          })
        : null;
      const existing = await phones.list();
      const existingByOwner = new Map(
        existing.map((phone) => [`${phone.document.identity.ownerType}:${phone.document.identity.ownerId}`, phone]),
      );
      return {
        persona: personaPhone ? phoneResponse(personaPhone) : null,
        characters: characters.map((character) => {
          const phone = existingByOwner.get(`character:${character.id}`);
          return {
            ownerId: character.id,
            ownerName: readName(character.data, "Character"),
            phone: phone ? phoneResponse(phone) : null,
          };
        }),
      };
    });
    app.put<{ Params: { chatId: string; ownerType: string; ownerId: string } }>(
      "/chats/:chatId/phones/:ownerType/:ownerId",
      async (request, reply) => {
        try {
          const ownerType = readOwnerType(request.params.ownerType);
          const chat = await api.runtime.persistence.getChat(request.params.chatId);
          if (!chat) return reply.status(404).send({ error: "Chat not found" });
          const allowed = ownerType === "persona"
            ? chat.personaId === request.params.ownerId
            : chat.characterIds.includes(request.params.ownerId);
          if (!allowed) return reply.status(404).send({ error: "Owner is not available in this chat" });
          const records = ownerType === "persona"
            ? await api.runtime.resources.listPersonas([request.params.ownerId])
            : await api.runtime.resources.listCharacters([request.params.ownerId]);
          const owner = records[0];
          if (!owner) return reply.status(404).send({ error: "Owner not found" });
          const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
            ? request.body as Record<string, unknown>
            : {};
          const phone = await phones.ensure({
            ownerId: owner.id,
            ownerType,
            ownerName: readName(owner.data, ownerType === "persona" ? "Persona" : "Character"),
            chatId: chat.id,
            ...(body.enabled === undefined ? {} : { enabled: body.enabled === true }),
            ...(body.baselineTheme === undefined ? {} : { baselineTheme: readTheme(body.baselineTheme) }),
          });
          return { phone: phoneResponse(phone) };
        } catch (error) {
          return reply.status(400).send({ error: error instanceof Error ? error.message : "Invalid phone request" });
        }
      },
    );
    app.patch<{ Params: { phoneId: string } }>("/phones/:phoneId/settings", async (request, reply) => {
      try {
        const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
          ? request.body as Partial<DeviceSettings>
          : {};
        const phone = await phones.updateSettings(request.params.phoneId, body);
        return { phone: phoneResponse(phone) };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Invalid device settings" });
      }
    });
    app.get<{ Params: { phoneId: string } }>("/phones/:phoneId/messaging", async (request, reply) => {
      try {
        const contacts = await contactsFor(request.params.phoneId);
        const names = new Map(contacts.map((contact) => [contact.phoneId, contact.ownerName]));
        const threads = (await messaging.threadsFor(request.params.phoneId))
          .map(({ record, document }) => threadPayload(record.id, document, request.params.phoneId, names));
        return { contacts, threads };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Invalid messaging request" });
      }
    });
    app.post<{ Params: { phoneId: string } }>("/phones/:phoneId/goodle/search", async (request, reply) => {
      const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
        ? request.body as Record<string, unknown>
        : {};
      const query = String(body.query ?? "").trim().slice(0, 120);
      const fallback = fallbackSearchResults(query);
      if (!query) return { results: fallback };
      try {
        await findPhone(request.params.phoneId);
        const model = await api.runtime.languageModels?.resolve();
        if (!model) return { results: fallback };
        const completion = await model.chatComplete([
          {
            role: "system",
            content: "You are Goodle, the in-story web search engine inside a roleplay world. Invent plausible, entertaining search results that fit a lived-in fictional world. Respond with only JSON: {\"title\":\"...\",\"summary\":\"...\",\"items\":[\"result one\",\"result two\",...]} with 3 to 6 items.",
          },
          { role: "user", content: `Search query: ${query}` },
        ], { temperature: 0.9, maxTokens: 400 });
        const results = parseBoundedContent(completion.content, {
          fields: { title: "string", summary: "string", items: "string[]" },
          defaults: fallback,
        });
        return { results };
      } catch (error) {
        if (error instanceof Error && error.message === "Phone not found") {
          return reply.status(400).send({ error: error.message });
        }
        return { results: fallback };
      }
    });
    app.get<{ Params: { phoneId: string } }>("/phones/:phoneId/notifications", async (request, reply) => {
      try {
        const contacts = await contactsFor(request.params.phoneId);
        const names = new Map(contacts.map((contact) => [contact.phoneId, contact.ownerName]));
        const notifications = (await messaging.threadsFor(request.params.phoneId)).flatMap(({ record, document }) => {
          const unread = unreadMessages(document, request.params.phoneId);
          const last = unread.at(-1);
          if (!last) return [];
          const otherPhoneId = document.participants.find((participant) => participant !== request.params.phoneId) ?? "";
          return [{
            id: record.id,
            appId: "messages",
            title: names.get(otherPhoneId) ?? "Unknown phone",
            body: last.text,
            count: unread.length,
            at: last.at,
          }];
        });
        return { notifications };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Invalid notifications request" });
      }
    });
    app.post<{ Params: { phoneId: string } }>("/phones/:phoneId/messaging/send", async (request, reply) => {
      try {
        const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
          ? request.body as Record<string, unknown>
          : {};
        const toPhoneId = String(body.toPhoneId ?? "");
        const contacts = await contactsFor(request.params.phoneId);
        if (!contacts.some((contact) => contact.phoneId === toPhoneId)) {
          return reply.status(400).send({ error: "That phone cannot be messaged from this chat" });
        }
        const thread = await messaging.send(request.params.phoneId, toPhoneId, String(body.text ?? ""));
        const withReply = (await generateCharacterReply(request.params.phoneId, toPhoneId)) ?? thread;
        const names = new Map(contacts.map((contact) => [contact.phoneId, contact.ownerName]));
        return { thread: threadPayload(withReply.record.id, withReply.document, request.params.phoneId, names) };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Invalid messaging request" });
      }
    });
    app.post<{ Params: { phoneId: string } }>("/phones/:phoneId/messaging/read", async (request, reply) => {
      try {
        const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
          ? request.body as Record<string, unknown>
          : {};
        const thread = await messaging.markRead(String(body.threadId ?? ""), request.params.phoneId);
        const names = new Map((await contactsFor(request.params.phoneId)).map((contact) => [contact.phoneId, contact.ownerName]));
        return { thread: threadPayload(thread.record.id, thread.document, request.params.phoneId, names) };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Invalid messaging request" });
      }
    });
    type StorageParams = { phoneId: string; appId: string; key: string };
    app.get<{ Params: Omit<StorageParams, "key"> }>("/phones/:phoneId/apps/:appId/storage", async (request, reply) => {
      try {
        return { entries: await phones.listAppStorage(request.params.phoneId, request.params.appId) };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Invalid storage request" });
      }
    });
    app.get<{ Params: StorageParams }>("/phones/:phoneId/apps/:appId/storage/:key", async (request, reply) => {
      try {
        return { value: await phones.getAppStorageKey(request.params.phoneId, request.params.appId, request.params.key) };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Invalid storage request" });
      }
    });
    app.put<{ Params: StorageParams }>("/phones/:phoneId/apps/:appId/storage/:key", async (request, reply) => {
      try {
        const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
          ? request.body as Record<string, unknown>
          : {};
        await phones.setAppStorageKey(request.params.phoneId, request.params.appId, request.params.key, body.value);
        return { value: body.value ?? null };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Invalid storage request" });
      }
    });
    app.delete<{ Params: StorageParams }>("/phones/:phoneId/apps/:appId/storage/:key", async (request, reply) => {
      try {
        await phones.removeAppStorageKey(request.params.phoneId, request.params.appId, request.params.key);
        return { removed: true };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Invalid storage request" });
      }
    });
    app.post<{ Params: { phoneId: string } }>("/phones/:phoneId/settings/reset", async (request, reply) => {
      try {
        return { phone: phoneResponse(await phones.resetSettings(request.params.phoneId)) };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Unable to reset device settings" });
      }
    });
  };
  return api.registerPrivilegedRoutes(routes, { prefix: "/api/virtual-phone" });
}

export async function selfCheck({ api }: CapabilityContext) {
  if (!api.runtime.persistence.documents) throw new Error("Virtual Phone persistence is unavailable");
}
