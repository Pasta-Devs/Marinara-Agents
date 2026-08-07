import { randomUUID } from "node:crypto";
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
import { fallbackFeed } from "../apps/noodler/manifest";
import { extractImageUrls } from "../apps/gallery/manifest";
import { handleFor, NoodleFeedService, NoodlerPageService, parseGeneratedPost, parsePagePost } from "./noodle";

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
        createMessageWithSwipe?(input: {
          id: string;
          swipeId: string;
          chatId: string;
          role: string;
          characterId: string | null;
          content: string;
          extra: Record<string, unknown>;
          createdAt: string;
        }): Promise<unknown>;
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
  const noodle = new NoodleFeedService(api.runtime.persistence.documents);
  const noodlerPages = new NoodlerPageService(api.runtime.persistence.documents);
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
      .map(({ document }) => ({ phoneId: document.identity.phoneId, ownerName: document.identity.ownerName, deviceName: document.identity.deviceName }));
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
    app.post<{ Params: { chatId: string; phoneId: string } }>("/chats/:chatId/phones/:phoneId/show", async (request, reply) => {
      try {
        if (!api.runtime.persistence.createMessageWithSwipe) {
          return reply.status(400).send({ error: "This Engine version cannot write to the story" });
        }
        const chat = await api.runtime.persistence.getChat(request.params.chatId);
        if (!chat) return reply.status(404).send({ error: "Chat not found" });
        const phone = await findPhone(request.params.phoneId);
        if (!phone.document.identity.chatScope.includes(chat.id)) {
          return reply.status(400).send({ error: "This phone is not part of this chat" });
        }
        const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
          ? request.body as Record<string, unknown>
          : {};
        const app_ = typeof body.app === "string" ? body.app : null;
        const surface = body.surface === "lock" ? "lock" : "home";
        const ownerName = phone.document.identity.ownerName;
        const phoneId = phone.document.identity.phoneId;
        let summary = surface === "lock" ? "the lock screen" : "the home screen";
        if (app_ === "messages") {
          const [thread] = await messaging.threadsFor(phoneId);
          if (thread) {
            const other = thread.document.participants.find((participant) => participant !== phoneId) ?? "";
            const otherName = (await contactsFor(phoneId)).find((contact) => contact.phoneId === other)?.ownerName ?? "someone";
            const lastTwo = thread.document.messages.slice(-2)
              .map((message) => `"${message.text.slice(0, 120)}"`).join(" / ");
            summary = `the Messages chat with ${otherName}: ${lastTwo}`;
          } else {
            summary = "the Messages app, no conversations yet";
          }
        } else if (app_ === "goodle") {
          const recents = await phones.getAppStorageKey(phoneId, "goodle", "recents").catch(() => null);
          summary = Array.isArray(recents) && typeof recents[0] === "string"
            ? `Goodle, searching for "${recents[0].slice(0, 120)}"`
            : "the Goodle search app";
        } else if (app_ === "notes") {
          const notes = await phones.getAppStorageKey(phoneId, "notes", "notes").catch(() => null);
          const first = Array.isArray(notes) ? (notes[0] as { text?: unknown } | undefined) : undefined;
          summary = typeof first?.text === "string" && first.text.trim()
            ? `a note that starts: "${first.text.split("\n")[0]!.slice(0, 120)}"`
            : "the Notes app";
        } else if (app_ === "noodler") {
          summary = "the Noodle feed";
        } else if (app_ === "settings" || app_ === "app-store" || app_ === "contacts") {
          summary = `the ${app_ === "app-store" ? "App Store" : app_[0]!.toUpperCase() + app_.slice(1)} app`;
        }
        const mode = body.mode === "reference" ? "reference" : "show";
        const content = mode === "reference"
          ? `[${ownerName}'s phone right now — ${summary}]`
          : `*${ownerName} shows their phone — ${summary}*`;
        await api.runtime.persistence.createMessageWithSwipe({
          id: randomUUID(),
          swipeId: randomUUID(),
          chatId: chat.id,
          role: "user",
          characterId: null,
          content,
          extra: { virtualPhone: mode },
          createdAt: new Date().toISOString(),
        });
        return { content };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Unable to show the phone" });
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
            content: "You are Goodle, the in-story web search engine inside a roleplay world. Invent plausible, entertaining search results that fit a lived-in fictional world. Respond with only JSON: {\"title\":\"...\",\"summary\":\"...\",\"items\":[\"Page Title | site.web/path | one-line snippet\", ...]} with 3 to 6 items. Every item uses that exact three-part format with invented in-world domains.",
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
    app.post<{ Params: { phoneId: string } }>("/phones/:phoneId/goodle/page", async (request, reply) => {
      const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
        ? request.body as Record<string, unknown>
        : {};
      const title = String(body.title ?? "").trim().slice(0, 200);
      const url = String(body.url ?? "").trim().slice(0, 200);
      const query = String(body.query ?? "").trim().slice(0, 120);
      const site = String(body.site ?? "").trim().slice(0, 80);
      const fallback = {
        site: site || url.split("/")[0] || "goodle.web",
        title: title || "Page unavailable",
        tagline: "",
        kind: "official",
        links: [] as string[],
        sections: ["Offline :: Goodle can't reach this page right now."],
      };
      try {
        await findPhone(request.params.phoneId);
        const model = await api.runtime.languageModels?.resolve();
        if (!model) return { page: fallback };
        const completion = await model.chatComplete([
          {
            role: "system",
            content: "You render fictional websites on the in-story internet of a roleplay world. Given a URL and page title, produce the full page as a template. Respond with only JSON: {\"site\":\"Site Name\",\"title\":\"page headline\",\"tagline\":\"short site tagline\",\"kind\":\"news, shop, blog, forum, or official\",\"links\":[\"nav label\", ...],\"sections\":[\"Section Heading :: section body text\", ...]} with 3 to 5 nav labels and 3 to 5 sections. Every section uses the exact format 'Heading :: body'. For a shop, each section is one product and its body states the price. For a forum, each section is one post and its heading is the poster's name.",
          },
          { role: "user", content: `URL: ${url}\nPage title: ${title}\nFound via search: ${query}${site ? `\nThis page belongs to the site "${site}" — keep its name, tagline, and nav consistent.` : ""}` },
        ], { temperature: 0.9, maxTokens: 700 });
        const page = parseBoundedContent(completion.content, {
          fields: { site: "string", title: "string", tagline: "string", kind: "string", links: "string[]", sections: "string[]" },
          defaults: fallback,
        });
        return { page };
      } catch (error) {
        if (error instanceof Error && error.message === "Phone not found") {
          return reply.status(400).send({ error: error.message });
        }
        return { page: fallback };
      }
    });
    app.get<{ Params: { phoneId: string } }>("/phones/:phoneId/noodle/feed", async (request, reply) => {
      try {
        const phone = await findPhone(request.params.phoneId);
        return { posts: await noodle.feedFor(phone.document.identity.chatScope) };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Noodle unavailable" });
      }
    });
    app.post<{ Params: { phoneId: string } }>("/phones/:phoneId/noodle/post", async (request, reply) => {
      try {
        const phone = await findPhone(request.params.phoneId);
        const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
          ? request.body as Record<string, unknown>
          : {};
        const text = String(body.text ?? "").trim();
        if (!text) return reply.status(400).send({ error: "Post text is required" });
        const chatId = phone.document.identity.chatScope[0];
        if (!chatId) return reply.status(400).send({ error: "This phone has no chat to post in" });
        const ownerName = phone.document.identity.ownerName;
        await noodle.addPosts(chatId, [{ author: ownerName, handle: handleFor(ownerName), text }]);
        return { posts: await noodle.feedFor(phone.document.identity.chatScope) };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Post failed" });
      }
    });
    app.post<{ Params: { phoneId: string } }>("/phones/:phoneId/noodler/feed", async (request, reply) => {
      try {
        const phone = await findPhone(request.params.phoneId);
        const scope = phone.document.identity.chatScope;
        const model = await api.runtime.languageModels?.resolve();
        if (!model) return { posts: await noodle.feedFor(scope) };
        // ponytail: generation always lands in the phone's first chat; per-chat targeting when phones span many chats
        const chatId = scope[0];
        if (!chatId) return { posts: [] };
        let storyContext = "";
        if (api.runtime.persistence.listMessages) {
          storyContext = (await api.runtime.persistence.listMessages(chatId)).slice(-10)
            .map((message) => message.content.slice(0, 240))
            .join("\n");
        }
        const timeline = (await noodle.feedFor([chatId])).slice(0, 10)
          .map((post) => `${post.author} ${post.handle} — ${post.text.slice(0, 160)}`)
          .join("\n");
        const completion = await model.chatComplete([
          {
            role: "system",
            content: `You are Noodle, the social network inside a fictional roleplay world. Invent 4 to 6 new short posts by fictional side characters (never the protagonists) reacting to life in this world. They may reply to or riff on the existing timeline. Respond with only JSON: {"posts":["Display Name @handle — post text", ...]}.${timeline ? `\n\nThe timeline so far:\n${timeline}` : ""}${storyContext ? `\n\nRecent story events to riff on:\n${storyContext}` : ""}`,
          },
          { role: "user", content: "Generate the next batch of posts." },
        ], { temperature: 1, maxTokens: 500 });
        const generated = parseBoundedContent(completion.content, { fields: { posts: "string[]" }, defaults: fallbackFeed() }) as { posts: string[] };
        if (generated.posts.length) await noodle.addPosts(chatId, generated.posts.map(parseGeneratedPost));
        return { posts: await noodle.feedFor(scope) };
      } catch (error) {
        if (error instanceof Error && error.message === "Phone not found") {
          return reply.status(400).send({ error: error.message });
        }
        return { posts: [] };
      }
    });
    app.get<{ Params: { phoneId: string } }>("/phones/:phoneId/gallery", async (request, reply) => {
      try {
        const phone = await findPhone(request.params.phoneId);
        if (!api.runtime.persistence.listMessages) return { images: [] };
        const images: string[] = [];
        const seen = new Set<string>();
        for (const chatId of phone.document.identity.chatScope) {
          for (const message of await api.runtime.persistence.listMessages(chatId)) {
            for (const url of extractImageUrls(message.content)) {
              if (!seen.has(url)) {
                seen.add(url);
                images.push(url);
              }
            }
          }
        }
        return { images: images.reverse().slice(0, 60) };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Gallery unavailable" });
      }
    });
    app.post<{ Params: { phoneId: string } }>("/phones/:phoneId/noodler-r/page", async (request, reply) => {
      try {
        const phone = await findPhone(request.params.phoneId);
        const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
          ? request.body as Record<string, unknown>
          : {};
        const creatorPhoneId = String(body.creatorPhoneId ?? "");
        const refresh = body.refresh === true;
        const contact = (await contactsFor(request.params.phoneId)).find((candidate) => candidate.phoneId === creatorPhoneId);
        if (!contact) return reply.status(400).send({ error: "That creator is not in this chat" });
        const creator = await findPhone(creatorPhoneId);
        const chatId = phone.document.identity.chatScope
          .find((candidate) => creator.document.identity.chatScope.includes(candidate));
        if (!chatId) return reply.status(400).send({ error: "No shared chat with this creator" });
        const pagePayload = (document: { creatorPhoneId: string; creatorName: string; tagline: string; price: string; posts: Array<{ id: string; text: string; locked: boolean }> }) => ({
          creatorPhoneId: document.creatorPhoneId,
          creatorName: document.creatorName,
          tagline: document.tagline,
          price: document.price,
          posts: document.posts,
        });
        const existing = await noodlerPages.pageFor(chatId, creatorPhoneId);
        if (existing && !refresh) return { page: pagePayload(existing.document) };
        const model = await api.runtime.languageModels?.resolve();
        if (!model) {
          if (existing) return { page: pagePayload(existing.document) };
          const empty = await noodlerPages.savePage({ chatId, creatorPhoneId, creatorName: contact.ownerName, tagline: "", price: "", posts: [] });
          return { page: pagePayload(empty.document) };
        }
        let storyContext = "";
        if (api.runtime.persistence.listMessages) {
          storyContext = (await api.runtime.persistence.listMessages(chatId)).slice(-8)
            .map((message) => message.content.slice(0, 200))
            .join("\n");
        }
        const completion = await model.chatComplete([
          {
            role: "system",
            content: `You write ${contact.ownerName}'s page on NoodleR, the creator platform inside a fictional roleplay world (all accounts are adults). Stay true to their character. Respond with only JSON: {"tagline":"short profile bio","price":"e.g. 5 coins/month","posts":["post text | free","teaser post text | locked", ...]} with 4 to 6 posts, mixing free posts and locked subscriber teasers.${storyContext ? `\n\nThe character, from recent story events:\n${storyContext}` : ""}`,
          },
          { role: "user", content: `Generate ${contact.ownerName}'s NoodleR page.` },
        ], { temperature: 1, maxTokens: 600 });
        const generated = parseBoundedContent(completion.content, {
          fields: { tagline: "string", price: "string", posts: "string[]" },
          defaults: { tagline: "", price: "", posts: [] as string[] },
        }) as { tagline: string; price: string; posts: string[] };
        const saved = await noodlerPages.savePage({
          chatId,
          creatorPhoneId,
          creatorName: contact.ownerName,
          tagline: generated.tagline,
          price: generated.price,
          posts: generated.posts.map(parsePagePost),
        });
        return { page: pagePayload(saved.document) };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "NoodleR unavailable" });
      }
    });
    app.post<{ Params: { phoneId: string } }>("/phones/:phoneId/noodler/trending", async (request, reply) => {
      try {
        const phone = await findPhone(request.params.phoneId);
        const model = await api.runtime.languageModels?.resolve();
        if (!model) return { topics: [] };
        const chatId = phone.document.identity.chatScope[0];
        let storyContext = "";
        if (chatId && api.runtime.persistence.listMessages) {
          storyContext = (await api.runtime.persistence.listMessages(chatId)).slice(-10)
            .map((message) => message.content.slice(0, 240))
            .join("\n");
        }
        const completion = await model.chatComplete([
          {
            role: "system",
            content: `You are Noodle, the social network inside a fictional roleplay world. List 5 trending topics in this world right now. Respond with only JSON: {"topics":["#HashtagName | one line on why it is trending", ...]}. Every topic uses that exact two-part format.${storyContext ? `\n\nRecent story events to riff on:\n${storyContext}` : ""}`,
          },
          { role: "user", content: "Generate the trending list." },
        ], { temperature: 1, maxTokens: 400 });
        const trending = parseBoundedContent(completion.content, { fields: { topics: "string[]" }, defaults: { topics: [] as string[] } }) as { topics: string[] };
        return { topics: trending.topics };
      } catch (error) {
        if (error instanceof Error && error.message === "Phone not found") {
          return reply.status(400).send({ error: error.message });
        }
        return { topics: [] };
      }
    });
    app.post<{ Params: { phoneId: string } }>("/phones/:phoneId/tindler/deck", async (request, reply) => {
      try {
        const phone = await findPhone(request.params.phoneId);
        const model = await api.runtime.languageModels?.resolve();
        if (!model) return { profiles: [] };
        const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
          ? request.body as Record<string, unknown>
          : {};
        const preferences = String(body.preferences ?? "").trim().slice(0, 200);
        const chatId = phone.document.identity.chatScope[0];
        let storyContext = "";
        if (chatId && api.runtime.persistence.listMessages) {
          storyContext = (await api.runtime.persistence.listMessages(chatId)).slice(-8)
            .map((message) => message.content.slice(0, 200))
            .join("\n");
        }
        const completion = await model.chatComplete([
          {
            role: "system",
            content: `You write dating profiles for Tindler, the dating app inside a fictional roleplay world. Invent 5 single side characters who plausibly live in this world (never the story's protagonists). Respond with only JSON: {"profiles":["Name, Age | short tagline | two-sentence bio", ...]}. Every profile uses that exact three-part format.${preferences ? `\nThe user's stated preference: "${preferences}" — match it.` : ""}${storyContext ? `\n\nThe world, from recent story events:\n${storyContext}` : ""}`,
          },
          { role: "user", content: "Generate the next deck of profiles." },
        ], { temperature: 1, maxTokens: 500 });
        const deck = parseBoundedContent(completion.content, { fields: { profiles: "string[]" }, defaults: { profiles: [] as string[] } }) as { profiles: string[] };
        return { profiles: deck.profiles };
      } catch (error) {
        if (error instanceof Error && error.message === "Phone not found") {
          return reply.status(400).send({ error: error.message });
        }
        return { profiles: [] };
      }
    });
    app.post<{ Params: { phoneId: string } }>("/phones/:phoneId/mail/inbox", async (request, reply) => {
      try {
        const phone = await findPhone(request.params.phoneId);
        const model = await api.runtime.languageModels?.resolve();
        if (!model) return { emails: [] };
        const chatId = phone.document.identity.chatScope[0];
        let storyContext = "";
        if (chatId && api.runtime.persistence.listMessages) {
          storyContext = (await api.runtime.persistence.listMessages(chatId)).slice(-10)
            .map((message) => message.content.slice(0, 240))
            .join("\n");
        }
        const completion = await model.chatComplete([
          {
            role: "system",
            content: `You write the email inbox of ${phone.document.identity.ownerName}, a character in a roleplay world. Invent 4 to 6 emails that fit their life in this world: newsletters, spam, official notices, and the occasional personal message from minor side characters. Respond with only JSON: {"emails":["Sender Name | Subject line | short body text", ...]}. Every email uses that exact three-part format.${storyContext ? `\n\nRecent story events for context:\n${storyContext}` : ""}`,
          },
          { role: "user", content: "Generate the current inbox." },
        ], { temperature: 1, maxTokens: 600 });
        const inbox = parseBoundedContent(completion.content, { fields: { emails: "string[]" }, defaults: { emails: [] as string[] } }) as { emails: string[] };
        return { emails: inbox.emails };
      } catch (error) {
        if (error instanceof Error && error.message === "Phone not found") {
          return reply.status(400).send({ error: error.message });
        }
        return { emails: [] };
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
