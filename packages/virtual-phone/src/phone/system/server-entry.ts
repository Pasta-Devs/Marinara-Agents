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
        listLorebooks?(ids?: string[]): Promise<Array<{ id: string; data: unknown }>>;
        listEligibleLorebookEntries?(selection: { lorebookIds: string[] }): Promise<Array<{
          name: string;
          content: string;
          description: string;
        }>>;
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
      .map(({ document }) => ({ phoneId: document.identity.phoneId, ownerId: document.identity.ownerId, ownerType: document.identity.ownerType, ownerName: document.identity.ownerName, deviceName: document.identity.deviceName }));
  };
  const chatForPhone = async (phoneId: string, chatId: string) => {
    const phone = await findPhone(phoneId);
    if (!phone.document.identity.chatScope.includes(chatId)) throw new Error("This phone is not part of this chat");
    return { phone, chatId };
  };
  /**
   * Which chat a request is about. A phone's chatScope is an array and every generation route used
   * to take `scope[0]` arbitrarily, so a phone spanning several chats generated content for
   * whichever chat it joined first. The client sends the chat it is open in; failing that we take
   * the most recently joined chat, since chatScope appends. Both beat an unexplained index.
   */
  const targetChat = (phone: Awaited<ReturnType<typeof findPhone>>, requested?: unknown) => {
    const scope = phone.document.identity.chatScope;
    const asked = typeof requested === "string" ? requested : "";
    if (asked && scope.includes(asked)) return asked;
    return scope[scope.length - 1];
  };

  const threadPayload = (threadId: string, document: ThreadDocument, phoneId: string, names: Map<string, string>) => {
    const otherPhoneId = document.participants.find((participant) => participant !== phoneId) ?? "";
    return {
      id: threadId,
      otherPhoneId,
      otherName: names.get(otherPhoneId) ?? "Unknown phone",
      unread: unreadCount(document, phoneId),
      messages: document.messages,
      reply: document.reply ?? null,
    };
  };

  const phoneGenSettings = (phone: Awaited<ReturnType<typeof findPhone>>) =>
    normalizeDeviceSettings(phone.document.namespaces.phone.settings, phone.document.provisioning.baselineTheme);
  const resolvePhoneModel = async (phone: Awaited<ReturnType<typeof findPhone>>, tier: "light" | "heavy") => {
    if (!api.runtime.languageModels) return null;
    const settings = phoneGenSettings(phone);
    const chosen = tier === "light" ? settings.lightConnectionId : settings.heavyConnectionId;
    if (chosen) {
      try {
        return await api.runtime.languageModels.resolve(chosen);
      } catch {
        // Chosen connection is gone; fall back to the agent default.
      }
    }
    try {
      return await api.runtime.languageModels.resolve();
    } catch {
      return null;
    }
  };
  /**
   * The user's own instructions plus the inferred owner profile, appended to everything this phone
   * generates. The profile is generated once on first use and stored on the phone — regenerating it
   * per request would put a model round trip in front of every search.
   */
  const customInstructions = async (phone: Awaited<ReturnType<typeof findPhone>>) => {
    const text = phoneGenSettings(phone).generationInstructions.trim();
    const instructions = text ? `\n\nAdditional instructions from the user (follow them):\n${text}` : "";
    return `${await ownerProfile(phone)}${instructions}`;
  };

  /**
   * Step 7.3 — infer how the owner relates to technology from their card, and let that shape what
   * their phone produces: result quality, scam and ad density, how the interface talks to them.
   * The fallback for the majority who will not author a lorebook entry. A lorebook entry attached
   * in Settings (Step 7.1) is the real mechanism and takes precedence by being far more specific.
   */
  const ownerProfile = async (phone: Awaited<ReturnType<typeof findPhone>>) => {
    const stored = phone.document.namespaces.phone.ownerProfile;
    if (typeof stored === "string") return stored ? `\n\nWhose phone this is:\n${stored}` : "";
    const card = await ownerCard(phone, "About");
    if (!card) {
      await phones.setOwnerProfile(phone.document.identity.phoneId, "").catch(() => undefined);
      return "";
    }
    const model = await resolvePhoneModel(phone, "light");
    if (!model) return "";
    try {
      const completion = await model.chatComplete([
        {
          role: "system",
          content: `Read this character and describe, in two or three sentences, how they relate to technology and what their phone is therefore like to use: how competent they are with it, how cluttered or locked-down or broken it is, how much spam and how many scams get through, and how the interface talks to them. Write it as instructions to whoever generates this phone's content. Respond with only JSON: {"profile":"..."}.${card}`,
        },
        { role: "user", content: "Describe the owner." },
      ], { temperature: 0.7, maxTokens: 300 });
      const { profile } = parseBoundedContent(completion.content, {
        fields: { profile: "string" },
        defaults: { profile: "" },
        limits: { maxString: 1200 },
      }) as { profile: string };
      await phones.setOwnerProfile(phone.document.identity.phoneId, profile.trim());
      return profile.trim() ? `\n\nWhose phone this is:\n${profile.trim()}` : "";
    } catch {
      // Leave it unstored so the next request retries rather than caching a failure forever.
      return "";
    }
  };

  const readCardText = (value: unknown): string => {
    const found: string[] = [];
    const visit = (candidate: unknown) => {
      if (typeof candidate === "string") {
        try { visit(JSON.parse(candidate)); } catch { /* plain string, not a card */ }
        return;
      }
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return;
      const record = candidate as Record<string, unknown>;
      for (const key of ["description", "personality", "scenario"]) {
        if (typeof record[key] === "string" && (record[key] as string).trim()) found.push((record[key] as string).trim());
      }
      if (record.data) visit(record.data);
    };
    visit(value);
    return [...new Set(found)].join("\n").slice(0, 700);
  };
  const ownerCard = async (phone: Awaited<ReturnType<typeof findPhone>>, label: string) => {
    try {
      const identity = phone.document.identity;
      const records = identity.ownerType === "character"
        ? await api.runtime.resources.listCharacters([identity.ownerId])
        : await api.runtime.resources.listPersonas([identity.ownerId]);
      const card = readCardText(records[0]?.data);
      return card ? `\n\n${label} ${identity.ownerName}:\n${card}` : "";
    } catch {
      return "";
    }
  };
  /**
   * Lore for one phone. It used to feed every lorebook in the installation to every phone, so two
   * unrelated stories bled into each other — wrong content, not merely too much. The phone's own
   * settings now choose; empty still means all, which keeps existing phones working unchanged.
   *
   * Note for whoever picks up Step 7.2: honouring an entry's own Characters filter is NOT possible
   * on this API. `listEligibleLorebookEntries` returns id, lorebookId, lorebookName, name, content
   * and description only, and `listEligibleEntriesByIds` behind it deliberately resolves attached
   * entries *without* character/persona scope. The filter fields never reach us. That is an Engine
   * change and belongs with the Stage 11 contract ask.
   */
  const loreContext = async (phone?: Awaited<ReturnType<typeof findPhone>>) => {
    try {
      if (!api.runtime.resources.listLorebooks || !api.runtime.resources.listEligibleLorebookEntries) return "";
      const attached = phone ? phoneGenSettings(phone).lorebookIds : [];
      const books = (await api.runtime.resources.listLorebooks())
        .filter((book) => attached.length === 0 || attached.includes(book.id));
      if (!books.length) return "";
      const entries = await api.runtime.resources.listEligibleLorebookEntries({ lorebookIds: books.map((book) => book.id) });
      return entries.slice(0, 8)
        .map((entry) => `${entry.name}: ${(entry.content || entry.description || "").slice(0, 200)}`)
        .filter((line) => !line.endsWith(": "))
        .join("\n")
        .slice(0, 1600);
    } catch {
      return "";
    }
  };
  // The phone's entire awareness of the story. It is stateless by decision (see
  // docs/app-plans/19-background-and-learning.md) — this window is re-read per request and never
  // accumulated, so it is the only thing standing between generation and generic content.
  // The per-message cap is the harsher of the two: it clips long story posts mid-sentence.
  const STORY_MESSAGES = 30;
  const STORY_MESSAGE_CHARS = 900;
  /** Total ceiling, keeping the most recent end. ~3k tokens, so a small-context model still fits. */
  const STORY_BUDGET_CHARS = 12_000;
  const worldContext = async (chatId: string | undefined, phone?: Awaited<ReturnType<typeof findPhone>>) => {
    const lore = await loreContext(phone);
    let story = "";
    if (chatId && api.runtime.persistence.listMessages) {
      story = (await api.runtime.persistence.listMessages(chatId)).slice(-STORY_MESSAGES)
        .map((message) => message.content.slice(0, STORY_MESSAGE_CHARS))
        .join("\n")
        .slice(-STORY_BUDGET_CHARS);
    }
    return `${lore ? `\n\nWorld lore to stay true to:\n${lore}` : ""}${story ? `\n\nRecent story events:\n${story}` : ""}`;
  };

  const generateCharacterReply = async (senderPhoneId: string, recipientPhoneId: string) => {
    {
      const recipient = await findPhone(recipientPhoneId);
      if (recipient.document.identity.ownerType !== "character" || !recipient.document.provisioning.enabled) return null;
      const model = await resolvePhoneModel(recipient, "light");
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
      const storyContext = await worldContext(sharedChatId, recipient);
      const completion = await model.chatComplete([
        {
          role: "system",
          content: `You are ${recipientName}, texting ${senderName} on your phone inside an ongoing roleplay. Write one short in-character text message reply. Respond with only JSON: {"reply":"your message"}. If ${recipientName} would leave the message on read, respond with {"reply":""}.${await ownerCard(recipient, "Who is texting — about")}${storyContext}${await customInstructions(recipient)}`,
        },
        { role: "user", content: history },
      ], { temperature: 0.9, maxTokens: 250 });
      const { reply } = parseBoundedContent(completion.content, { fields: { reply: "string" }, defaults: { reply: "" }, limits: { maxString: 400 } }) as { reply: string };
      if (!reply.trim()) return null;
      return await messaging.send(recipientPhoneId, senderPhoneId, reply);
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
  /**
   * Step 9.10 — who this phone holds details for, and how it got them. Nothing modelled whether a
   * character actually has another's address or number, so everyone could contact everyone. That is
   * invisible while you initiate every conversation and a visible continuity break the moment
   * characters initiate, which Step 8.3 and the mail work now both do.
   *
   * Deliberately permissive: sharing a scene is enough to know someone, and an unknown number
   * arriving is fine and often good. The bug is an unknown number arriving and the model not
   * knowing it is unknown, so this exists to tell the model which it is.
   *
   * Must be consulted before Step 11.4 (Calls) ships, or the first thing that app does is have a
   * stranger ring you having never been given your number.
   */
  const directoryFor = async (phone: Awaited<ReturnType<typeof findPhone>>) => {
    const phoneId = phone.document.identity.phoneId;
    const known = new Map<string, string>();
    for (const contact of await contactsFor(phoneId)) {
      known.set(contact.ownerName, "you share a scene with them");
    }
    for (const thread of await messaging.threadsFor(phoneId)) {
      const otherPhoneId = thread.document.participants.find((participant) => participant !== phoneId);
      if (!otherPhoneId) continue;
      const other = await findPhone(otherPhoneId).catch(() => null);
      if (other) known.set(other.document.identity.ownerName, "you have texted before");
    }
    for (const chatId of phone.document.identity.chatScope) {
      for (const { document } of await phones.listContacts(chatId)) {
        known.set(document.name, document.phoneLabel ? `you saved their details as ${document.phoneLabel}` : "you saved them in Contacts");
      }
    }
    return known;
  };
  const directoryContext = async (phone: Awaited<ReturnType<typeof findPhone>>) => {
    const known = await directoryFor(phone);
    if (known.size === 0) return "\n\nThis phone holds nobody's details. Anyone contacting it is a stranger who had to find the address some other way — say so in how they write.";
    const lines = [...known.entries()].slice(0, 30).map(([name, why]) => `${name} — ${why}`).join("\n");
    return `\n\nWhose details this phone holds:\n${lines}\nAnyone not on that list is a stranger to the owner. That is allowed, but it must read like a stranger: they explain how they got the address, or they clearly should not have it.`;
  };

  /**
   * Step 8.3 — a character texts because a thread has gone quiet, or because you left them on read.
   * Needs only the timestamp on the last message, which is what keeps it consistent with the
   * stateless decision in Step 3.2.
   *
   * Know what this is: with stateless generation and a time trigger, characters text *on a timer
   * with recent context* rather than reacting to a remembered event. That gap is acknowledged in
   * 19-background-and-learning.md — do not quietly expand scope to close it.
   *
   * Budgeted deliberately, because this runs off a poll: opt-in per phone, one candidate thread per
   * call, a probability gate, and a cooldown per phone on top of a cooldown per thread. Worst case
   * is roughly two generations an hour for a phone whose owner switched it on.
   */
  const QUIET_THREAD_MS = 30 * 60 * 1000;
  const UNPROMPTED_COOLDOWN_MS = 30 * 60 * 1000;
  const UNPROMPTED_CHANCE = 0.1;
  const maybeTextFirst = async (chatId: string) => {
    const inChat = (await phones.list()).filter(({ document }) =>
      document.provisioning.enabled
      && document.identity.ownerType === "character"
      && document.identity.chatScope.includes(chatId));
    const now = Date.now();
    for (const phone of inChat) {
      if (!phoneGenSettings(phone).unpromptedTexts) continue;
      if (Math.random() > UNPROMPTED_CHANCE) continue;
      const phoneId = phone.document.identity.phoneId;
      const lastAttempt = await phones.getAppStorageKey(phoneId, "messages", "lastUnpromptedAt").catch(() => null);
      if (typeof lastAttempt === "string" && now - Date.parse(lastAttempt) < UNPROMPTED_COOLDOWN_MS) continue;
      const candidates = (await messaging.threadsFor(phoneId)).filter(({ document }) => {
        const last = document.messages.at(-1);
        if (!last) return false;
        return now - Date.parse(last.at) > QUIET_THREAD_MS;
      });
      const chosen = candidates[Math.floor(Math.random() * candidates.length)];
      if (!chosen) continue;
      const otherPhoneId = chosen.document.participants.find((participant) => participant !== phoneId);
      if (!otherPhoneId) continue;
      // Marked before generating, so a failure still spends the cooldown rather than retrying hard.
      await phones.setAppStorageKey(phoneId, "messages", "lastUnpromptedAt", new Date().toISOString())
        .catch(() => undefined);
      const last = chosen.document.messages.at(-1)!;
      const leftOnRead = last.from === otherPhoneId;
      try {
        const model = await resolvePhoneModel(phone, "light");
        if (!model) continue;
        const other = await findPhone(otherPhoneId);
        const history = chosen.document.messages.slice(-20)
          .map((message) => `${message.from === phoneId ? phone.document.identity.ownerName : other.document.identity.ownerName}: ${message.text}`)
          .join("\n");
        const reason = leftOnRead
          ? `${other.document.identity.ownerName} never replied to your last exchange.`
          : "The conversation has gone quiet for a while.";
        const completion = await model.chatComplete([
          {
            role: "system",
            content: `You are ${phone.document.identity.ownerName}, texting ${other.document.identity.ownerName} on your phone inside an ongoing roleplay. ${reason} Send one short in-character text picking the thread back up, in your own voice. Respond with only JSON: {"reply":"your message"}. If you would not text them right now, respond with {"reply":""}.${await ownerCard(phone, "Who you are — about")}${await directoryContext(phone)}${await worldContext(chatId, phone)}${await customInstructions(phone)}`,
          },
          { role: "user", content: history || "No messages yet." },
        ], { temperature: 0.95, maxTokens: 250 });
        const { reply } = parseBoundedContent(completion.content, {
          fields: { reply: "string" },
          defaults: { reply: "" },
          limits: { maxString: 400 },
        }) as { reply: string };
        if (reply.trim()) await messaging.send(phoneId, otherPhoneId, reply);
      } catch {
        // A character failing to think of something to say is not an error worth surfacing.
      }
    }
  };

    /**
     * Stage 10 — picking up someone else's phone is a story event, not a dev shortcut.
     *
     * The model judges from the current scene whether you could plausibly be holding this
     * character's phone right now: you took it, they handed it over, they left it on the table. A
     * refusal comes back with the in-fiction reason, which is the interesting half.
     *
     * Access granted is recorded in the chat as quiet context, so anyone who can see you reacts to
     * you going through their phone — being caught is the point, and the reaction needs to know it
     * happened. Your own phone is never gated; nothing about opening your own phone is a story beat.
     */
    app.post<{ Params: { chatId: string; phoneId: string } }>("/chats/:chatId/phones/:phoneId/access", async (request, reply) => {
      try {
        const { phone, chatId } = await chatForPhone(request.params.phoneId, request.params.chatId);
        if (phone.document.identity.ownerType === "persona") return { allowed: true, reason: "" };
        const model = await resolvePhoneModel(phone, "light");
        if (!model) return { allowed: true, reason: "" };
        const ownerName = phone.document.identity.ownerName;
        const completion = await model.chatComplete([
          {
            role: "system",
            content: `In this roleplay, the user is trying to pick up and look through ${ownerName}'s phone right now. Judge only from the current scene whether they could plausibly get at it this moment — they took it, ${ownerName} handed it over, ${ownerName} left it behind or is asleep or out of the room. If ${ownerName} is holding it, or is watching, or is nowhere near, they cannot. Respond with only JSON: {"allowed":true or false,"reason":"one short in-fiction sentence"}. The reason is shown to the user on the lock screen, so write it as narration, not as a rule.${await worldContext(chatId, phone)}`,
          },
          { role: "user", content: `Can they get at ${ownerName}'s phone right now?` },
        ], { temperature: 0.6, maxTokens: 200 });
        const verdict = parseBoundedContent(completion.content, {
          fields: { allowed: "boolean", reason: "string" },
          defaults: { allowed: false, reason: `${ownerName}'s phone is not within reach.` },
          limits: { maxString: 300 },
        }) as { allowed: boolean; reason: string };

        if (verdict.allowed && api.runtime.persistence.createMessageWithSwipe) {
          await api.runtime.persistence.createMessageWithSwipe({
            id: randomUUID(),
            swipeId: randomUUID(),
            chatId,
            role: "user",
            characterId: null,
            content: `[picks up ${ownerName}'s phone and starts going through it]`,
            extra: { virtualPhone: "access" },
            createdAt: new Date().toISOString(),
          }).catch(() => undefined);
        }
        return verdict;
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "That phone is out of reach" });
      }
    });
    app.get<{ Params: { chatId: string } }>("/chats/:chatId/unread", async (request, reply) => {
      const chat = await api.runtime.persistence.getChat(request.params.chatId);
      if (!chat) return reply.status(404).send({ error: "Chat not found" });
      // This poll runs whether or not the phone is open, which is exactly when an unprompted text
      // should be able to arrive. It is fire-and-forget: the badge must never wait on a model.
      void maybeTextFirst(chat.id).catch(() => undefined);
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
  /**
   * Engine chats surfaced as threads. Read-only history plus a send box: unread counts and markRead
   * are sandbox-thread concepts and are deliberately not forced onto them. `listMessages` is
   * optional on the runtime, so a host without it simply sees no chat threads.
   */
  const CHAT_THREAD_PREFIX = "chat:";
  const engineThreadsFor = async (phone: Awaited<ReturnType<typeof findPhone>>) => {
    if (!api.runtime.persistence.listMessages) return [];
    const ownerId = phone.document.identity.ownerId;
    const isPersona = phone.document.identity.ownerType === "persona";
    const threads = [];
    for (const chatId of phone.document.identity.chatScope) {
      const chat = await api.runtime.persistence.getChat(chatId).catch(() => null);
      if (!chat) continue;
      const characters = await api.runtime.resources.listCharacters(chat.characterIds).catch(() => []);
      const otherName = characters
        .filter((character) => isPersona || character.id !== ownerId)
        .map((character) => readName(character.data, "Character"))
        .join(", ") || "The story";
      const messages = (await api.runtime.persistence.listMessages(chatId).catch(() => []))
        .slice(-STORY_MESSAGES)
        .map((message, index) => ({
          id: `${chatId}:${index}`,
          // "Self" is the phone's owner speaking: the user's turns on a persona phone, that
          // character's turns on a character phone.
          from: (isPersona ? message.role === "user" : message.characterId === ownerId)
            ? phone.document.identity.phoneId
            : `${CHAT_THREAD_PREFIX}${chatId}`,
          text: message.content,
          at: "",
        }));
      threads.push({
        id: `${CHAT_THREAD_PREFIX}${chatId}`,
        otherPhoneId: `${CHAT_THREAD_PREFIX}${chatId}`,
        otherName,
        unread: 0,
        messages,
        reply: null,
        kind: "chat" as const,
      });
    }
    return threads;
  };

    app.get<{ Params: { phoneId: string } }>("/phones/:phoneId/messaging", async (request, reply) => {
      try {
        const contacts = await Promise.all((await contactsFor(request.params.phoneId)).map(async (contact) => {
          try {
            const records = contact.ownerType === "character"
              ? await api.runtime.resources.listCharacters([contact.ownerId])
              : await api.runtime.resources.listPersonas([contact.ownerId]);
            const bio = readCardText(records[0]?.data).split("\n")[0]?.slice(0, 140) ?? "";
            return { ...contact, bio };
          } catch {
            return { ...contact, bio: "" };
          }
        }));
        const names = new Map(contacts.map((contact) => [contact.phoneId, contact.ownerName]));
        const phone = await findPhone(request.params.phoneId);
        const threads = [
          ...await engineThreadsFor(phone),
          ...(await messaging.threadsFor(request.params.phoneId))
            .map(({ record, document }) => ({
              ...threadPayload(record.id, document, request.params.phoneId, names),
              kind: "phone" as const,
            })),
        ];
        return { contacts, threads };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Invalid messaging request" });
      }
    });
    app.get<{ Params: { phoneId: string }; Querystring: { chatId?: string } }>("/phones/:phoneId/contacts", async (request, reply) => {
      try {
        const { phone, chatId } = await chatForPhone(request.params.phoneId, String(request.query.chatId ?? ""));
        const phoneContacts = await Promise.all((await contactsFor(phone.document.identity.phoneId)).map(async (contact) => {
          const records = contact.ownerType === "character"
            ? await api.runtime.resources.listCharacters([contact.ownerId])
            : await api.runtime.resources.listPersonas([contact.ownerId]);
          return {
            id: contact.phoneId,
            kind: "phone" as const,
            name: contact.ownerName,
            handle: "",
            bio: readCardText(records[0]?.data).split("\n")[0]?.slice(0, 140) ?? "",
            phoneLabel: contact.deviceName ?? "",
            phoneId: contact.phoneId,
            ownerId: contact.ownerId,
          };
        }));
        const manualContacts = (await phones.listContacts(chatId)).map(({ document }) => ({
          id: document.contactId,
          kind: "contact" as const,
          name: document.name,
          handle: document.handle,
          bio: document.bio,
          phoneLabel: document.phoneLabel,
          phoneId: null,
        }));
        const names = new Map(phoneContacts.map((contact) => [contact.phoneId, contact.name]));
        const threads = (await messaging.threadsFor(phone.document.identity.phoneId))
          .map(({ record, document }) => threadPayload(record.id, document, phone.document.identity.phoneId, names));
        return { contacts: [...phoneContacts, ...manualContacts], threads };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Contacts unavailable" });
      }
    });
    app.post<{ Params: { phoneId: string }; Querystring: { chatId?: string } }>("/phones/:phoneId/contacts", async (request, reply) => {
      try {
        const { chatId } = await chatForPhone(request.params.phoneId, String(request.query.chatId ?? ""));
        const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
          ? request.body as Record<string, unknown>
          : {};
        const contact = await phones.createContact({
          chatId,
          name: String(body.name ?? ""),
          handle: String(body.handle ?? ""),
          bio: String(body.bio ?? ""),
          phoneLabel: String(body.phoneLabel ?? ""),
        });
        return { contact: { id: contact.document.contactId, kind: "contact", ...contact.document, phoneId: null } };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Contact could not be added" });
      }
    });
    app.delete<{ Params: { phoneId: string; contactId: string }; Querystring: { chatId?: string } }>("/phones/:phoneId/contacts/:contactId", async (request, reply) => {
      try {
        const { chatId } = await chatForPhone(request.params.phoneId, String(request.query.chatId ?? ""));
        await phones.removeContact(request.params.contactId, chatId);
        return { removed: true };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Contact could not be removed" });
      }
    });
    app.post<{ Params: { phoneId: string }; Querystring: { chatId?: string } }>("/phones/:phoneId/goodle/search", async (request, reply) => {
      const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
        ? request.body as Record<string, unknown>
        : {};
      const query = String(body.query ?? "").trim().slice(0, 120);
      const fallback = fallbackSearchResults(query);
      if (!query) return { results: fallback };
      try {
        const phone = await findPhone(request.params.phoneId);
        const model = await resolvePhoneModel(phone, "heavy");
        if (!model) return { results: fallback };
        const storyContext = await worldContext(targetChat(phone, request.query.chatId), phone);
        const completion = await model.chatComplete([
          {
            role: "system",
            content: "You are Goodle, the in-story web search engine inside a roleplay world. Invent plausible, entertaining search results that fit a lived-in fictional world. Respond with only JSON: {\"title\":\"...\",\"summary\":\"...\",\"items\":[\"Page Title | site.web/path | one-line snippet\", ...]} with 3 to 6 items. Every item uses that exact three-part format with invented in-world domains." + storyContext + await customInstructions(phone),
          },
          { role: "user", content: `Search query: ${query}` },
        ], { temperature: 0.9, maxTokens: 800 });
        const results = parseBoundedContent(completion.content, {
          fields: { title: "string", summary: "string", items: "string[]" },
          defaults: fallback,
          limits: { maxString: 500, maxItems: 12 },
        });
        return { results };
      } catch (error) {
        if (error instanceof Error && error.message === "Phone not found") {
          return reply.status(400).send({ error: error.message });
        }
        return { results: fallback };
      }
    });
    app.post<{ Params: { phoneId: string }; Querystring: { chatId?: string } }>("/phones/:phoneId/goodle/page", async (request, reply) => {
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
        const phone = await findPhone(request.params.phoneId);
        const model = await resolvePhoneModel(phone, "heavy");
        if (!model) return { page: fallback };
        const storyContext = await worldContext(targetChat(phone, request.query.chatId), phone);
        const completion = await model.chatComplete([
          {
            role: "system",
            content: "You render fictional websites on the in-story internet of a roleplay world. Given a URL and page title, produce the full page as a template. Respond with only JSON: {\"site\":\"Site Name\",\"title\":\"page headline\",\"tagline\":\"short site tagline\",\"kind\":\"news, shop, blog, forum, or official\",\"links\":[\"nav label\", ...],\"sections\":[\"Section Heading :: section body text\", ...]} with 3 to 5 nav labels and 3 to 5 sections. Every section uses the exact format 'Heading :: body'. For a shop, each section is one product and its body states the price. For a forum, each section is one post and its heading is the poster's name. Inside section bodies, wrap two to four names, places, products or events in [[double square brackets]] — they become links to further pages, so choose things a reader would want to follow. If the URL resembles a real-world website, do not reproduce the real site: invent this world's equivalent at that address." + storyContext + await customInstructions(phone),
          },
          { role: "user", content: `URL: ${url}\nPage title: ${title}\nFound via search: ${query}${site ? `\nThis page belongs to the site "${site}" — keep its name, tagline, and nav consistent.` : ""}` },
        ], { temperature: 0.9, maxTokens: 1800 });
        const page = parseBoundedContent(completion.content, {
          fields: { site: "string", title: "string", tagline: "string", kind: "string", links: "string[]", sections: "string[]" },
          defaults: fallback,
          limits: { maxString: 1200, maxItems: 12, perField: { site: 80, tagline: 200, kind: 40 } },
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
    app.post<{ Params: { phoneId: string }; Querystring: { chatId?: string } }>("/phones/:phoneId/noodle/post", async (request, reply) => {
      try {
        const phone = await findPhone(request.params.phoneId);
        const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
          ? request.body as Record<string, unknown>
          : {};
        const text = String(body.text ?? "").trim();
        if (!text) return reply.status(400).send({ error: "Post text is required" });
        const chatId = targetChat(phone, request.query.chatId);
        if (!chatId) return reply.status(400).send({ error: "This phone has no chat to post in" });
        const ownerName = phone.document.identity.ownerName;
        const image = String(body.image ?? "").trim().slice(0, 1000);
        const parentPostId = String(body.parentPostId ?? "").trim().slice(0, 200);
        await noodle.addPosts(chatId, [{
          author: ownerName,
          handle: handleFor(ownerName),
          text,
          ...(image ? { image } : {}),
          ...(parentPostId ? { parentPostId } : {}),
        }]);
        return { posts: await noodle.feedFor(phone.document.identity.chatScope) };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Post failed" });
      }
    });
    app.post<{ Params: { phoneId: string }; Querystring: { chatId?: string } }>("/phones/:phoneId/noodler/feed", async (request, reply) => {
      try {
        const phone = await findPhone(request.params.phoneId);
        const scope = phone.document.identity.chatScope;
        const model = await resolvePhoneModel(phone, "heavy");
        if (!model) return { posts: await noodle.feedFor(scope) };
        const chatId = targetChat(phone, request.query.chatId);
        if (!chatId) return { posts: [] };
        const storyContext = await worldContext(chatId, phone);
        const timeline = (await noodle.feedFor([chatId])).slice(0, 10)
          .map((post) => `${post.author} ${post.handle} — ${post.text.slice(0, 160)}`)
          .join("\n");
        const cast = (await phones.list())
          .filter(({ document }) => document.provisioning.enabled && document.identity.chatScope.includes(chatId))
          .map(({ document }) => `${document.identity.ownerName} ${handleFor(document.identity.ownerName)}`)
          .concat((await phones.listContacts(chatId)).map(({ document }) => `${document.name} ${handleFor(document.name)}`))
          .join(", ");
        const completion = await model.chatComplete([
          {
            role: "system",
            content: `You are Noodle, the social network inside a fictional roleplay world. Invent 4 to 6 new short posts, mostly by fictional side characters reacting to life in this world. At most one post may come from the story cast${cast ? ` (${cast})` : ""}, staying true to their voice. They may reply to or riff on the existing timeline. Respond with only JSON: {"posts":["Display Name @handle — post text", ...]}.${timeline ? `\n\nThe timeline so far:\n${timeline}` : ""}${storyContext}${await customInstructions(phone)}`,
          },
          { role: "user", content: "Generate the next batch of posts." },
        ], { temperature: 1, maxTokens: 800 });
        const generated = parseBoundedContent(completion.content, { fields: { posts: "string[]" }, defaults: fallbackFeed(), limits: { maxString: 600, maxItems: 20 } }) as { posts: string[] };
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
    app.post<{ Params: { phoneId: string }; Querystring: { chatId?: string } }>("/phones/:phoneId/camera/shot", async (request, reply) => {
      try {
        const phone = await findPhone(request.params.phoneId);
        const model = await resolvePhoneModel(phone, "light");
        if (!model) return { photo: "" };
        const chatId = targetChat(phone, request.query.chatId);
        const storyContext = await worldContext(chatId, phone);
        const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
          ? request.body as Record<string, unknown>
          : {};
        const subject = String(body.subject ?? "").trim().slice(0, 300);
        const completion = await model.chatComplete([
          {
            role: "system",
            content: `${phone.document.identity.ownerName} just took a photo with their phone inside a roleplay story. Describe what the photo shows in one or two vivid sentences, present tense, like a caption. Respond with only JSON: {"photo":"description"}.${subject ? `\n\nThey aimed the camera at: ${subject}` : ""}${storyContext}${await customInstructions(phone)}`,
          },
          { role: "user", content: "Describe the photo." },
        ], { temperature: 0.9, maxTokens: 300 });
        const shot = parseBoundedContent(completion.content, { fields: { photo: "string" }, defaults: { photo: "" }, limits: { maxString: 800 } }) as { photo: string };
        return { photo: shot.photo };
      } catch (error) {
        if (error instanceof Error && error.message === "Phone not found") {
          return reply.status(400).send({ error: error.message });
        }
        return { photo: "" };
      }
    });
    app.post<{ Params: { phoneId: string } }>("/phones/:phoneId/noodler-r/page", async (request, reply) => {
      try {
        const phone = await findPhone(request.params.phoneId);
        const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
          ? request.body as Record<string, unknown>
          : {};
        const creatorPhoneId = String(body.creatorPhoneId ?? "");
        const requestedChatId = String(body.chatId ?? "");
        const refresh = body.refresh === true;
        if (!phone.document.identity.chatScope.includes(requestedChatId)) return reply.status(400).send({ error: "This phone is not part of this chat" });
        const phoneContact = (await contactsFor(request.params.phoneId)).find((candidate) => candidate.phoneId === creatorPhoneId);
        const manualContact = (await phones.listContacts(requestedChatId)).find(({ document }) => document.contactId === creatorPhoneId)?.document;
        if (!phoneContact && !manualContact) return reply.status(400).send({ error: "That creator is not in this chat" });
        const creator = phoneContact ? await findPhone(creatorPhoneId) : null;
        const chatId = requestedChatId;
        const creatorName = phoneContact?.ownerName ?? manualContact!.name;
        const pagePayload = (document: { creatorPhoneId: string; creatorName: string; tagline: string; price: string; posts: Array<{ id: string; text: string; locked: boolean }> }) => ({
          creatorPhoneId: document.creatorPhoneId,
          creatorName: document.creatorName,
          tagline: document.tagline,
          price: document.price,
          posts: document.posts,
        });
        const existing = await noodlerPages.pageFor(chatId, creatorPhoneId);
        if (existing && !refresh) return { page: pagePayload(existing.document) };
        const model = await resolvePhoneModel(phone, "heavy");
        if (!model) {
          if (existing) return { page: pagePayload(existing.document) };
           const empty = await noodlerPages.savePage({ chatId, creatorPhoneId, creatorName, tagline: "", price: "", posts: [] });
          return { page: pagePayload(empty.document) };
        }
        const storyContext = await worldContext(chatId, phone);
        const completion = await model.chatComplete([
          {
            role: "system",
             content: `You write ${creatorName}'s page on NoodleR, the creator platform inside a fictional roleplay world (all accounts are adults). Stay true to their character. Respond with only JSON: {"tagline":"short profile bio","price":"e.g. 5 coins/month","posts":["post text | free","teaser post text | locked", ...]} with 4 to 6 posts, mixing free posts and locked subscriber teasers.${creator ? await ownerCard(creator, "About the creator") : manualContact?.bio ? `\n\nAbout the creator:\n${manualContact.bio}` : ""}${storyContext}${await customInstructions(phone)}`,
          },
           { role: "user", content: `Generate ${creatorName}'s NoodleR page.` },
        ], { temperature: 1, maxTokens: 1200 });
        const generated = parseBoundedContent(completion.content, {
          fields: { tagline: "string", price: "string", posts: "string[]" },
          defaults: { tagline: "", price: "", posts: [] as string[] },
          limits: { maxString: 1200, maxItems: 12, perField: { price: 60 } },
        }) as { tagline: string; price: string; posts: string[] };
        const saved = await noodlerPages.savePage({
          chatId,
          creatorPhoneId,
           creatorName,
          tagline: generated.tagline,
          price: generated.price,
          posts: generated.posts.map(parsePagePost),
        });
        return { page: pagePayload(saved.document) };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "NoodleR unavailable" });
      }
    });
    app.post<{ Params: { phoneId: string }; Querystring: { chatId?: string } }>("/phones/:phoneId/noodler/trending", async (request, reply) => {
      try {
        const phone = await findPhone(request.params.phoneId);
        const model = await resolvePhoneModel(phone, "heavy");
        if (!model) return { topics: [] };
        const chatId = targetChat(phone, request.query.chatId);
        const storyContext = await worldContext(chatId, phone);
        const completion = await model.chatComplete([
          {
            role: "system",
            content: `You are Noodle, the social network inside a fictional roleplay world. List 5 trending topics in this world right now. Respond with only JSON: {"topics":["#HashtagName | one line on why it is trending", ...]}. Every topic uses that exact two-part format.${storyContext}${await customInstructions(phone)}`,
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
    app.post<{ Params: { phoneId: string }; Querystring: { chatId?: string } }>("/phones/:phoneId/tindler/deck", async (request, reply) => {
      try {
        const phone = await findPhone(request.params.phoneId);
        const model = await resolvePhoneModel(phone, "heavy");
        if (!model) return { profiles: [] };
        const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
          ? request.body as Record<string, unknown>
          : {};
        const preferences = String(body.preferences ?? "").trim().slice(0, 200);
        const chatId = targetChat(phone, request.query.chatId);
        const storyContext = await worldContext(chatId, phone);
        const completion = await model.chatComplete([
          {
            role: "system",
            content: `You write dating profiles for Tindler, the dating app inside a fictional roleplay world. Invent 5 single side characters who plausibly live in this world (never the story's protagonists). Respond with only JSON: {"profiles":["Name, Age | short tagline | two-sentence bio", ...]}. Every profile uses that exact three-part format.${preferences ? `\nThe user's stated preference: "${preferences}" — match it.` : ""}${storyContext}${await customInstructions(phone)}`,
          },
          { role: "user", content: "Generate the next deck of profiles." },
        ], { temperature: 1, maxTokens: 900 });
        const deck = parseBoundedContent(completion.content, { fields: { profiles: "string[]" }, defaults: { profiles: [] as string[] }, limits: { maxString: 600, maxItems: 15 } }) as { profiles: string[] };
        return { profiles: deck.profiles };
      } catch (error) {
        if (error instanceof Error && error.message === "Phone not found") {
          return reply.status(400).send({ error: error.message });
        }
        return { profiles: [] };
      }
    });
    app.post<{ Params: { phoneId: string }; Querystring: { chatId?: string } }>("/phones/:phoneId/mail/inbox", async (request, reply) => {
      try {
        const phone = await findPhone(request.params.phoneId);
        const model = await resolvePhoneModel(phone, "heavy");
        if (!model) return { emails: [] };
        const chatId = targetChat(phone, request.query.chatId);
        const storyContext = await worldContext(chatId, phone);
        const completion = await model.chatComplete([
          {
            role: "system",
            content: `You write the email inbox of ${phone.document.identity.ownerName}, a character in a roleplay world. Invent 4 to 6 emails that fit their life in this world: newsletters, spam, official notices, and the occasional personal message from minor side characters. Respond with only JSON: {"emails":["Sender Name | Subject line | short body text", ...]}. Every email uses that exact three-part format.${await ownerCard(phone, "About the inbox owner")}${await directoryContext(phone)}${storyContext}${await customInstructions(phone)}`,
          },
          { role: "user", content: "Generate the current inbox." },
        ], { temperature: 1, maxTokens: 1400 });
        const inbox = parseBoundedContent(completion.content, { fields: { emails: "string[]" }, defaults: { emails: [] as string[] }, limits: { maxString: 1200, maxItems: 25 } }) as { emails: string[] };
        return { emails: inbox.emails };
      } catch (error) {
        if (error instanceof Error && error.message === "Phone not found") {
          return reply.status(400).send({ error: error.message });
        }
        return { emails: [] };
      }
    });
    /**
     * Stage 8 — notifications collected per app rather than derived only from message threads. Five
     * apps declared `notify` and never fired one; a phone that only buzzes for texts is a quiet
     * phone.
     *
     * "New since you last looked" needs a marker, and each app writes its own into its phone
     * storage under `lastSeenAt` when it opens. No marker yet means nothing is reported as new,
     * so installing this build does not greet anyone with a wall of backdated notifications.
     *
     * NoodleR is NOT wired: "a creator you subscribe to posted" needs a subscription model that
     * does not exist yet — there is no record of which creators a phone follows. It belongs with
     * the NoodleR work, not here.
     */
    const lastSeen = async (phoneId: string, appId: string) => {
      const value = await phones.getAppStorageKey(phoneId, appId, "lastSeenAt").catch(() => null);
      return typeof value === "string" ? value : "";
    };
    app.get<{ Params: { phoneId: string }; Querystring: { chatId?: string } }>("/phones/:phoneId/notifications", async (request, reply) => {
      try {
        const phoneId = request.params.phoneId;
        const contacts = await contactsFor(phoneId);
        const names = new Map(contacts.map((contact) => [contact.phoneId, contact.ownerName]));
        const extra: Array<{ id: string; appId: string; title: string; body: string; count: number; at: string }> = [];

        const phone = await findPhone(phoneId);
        const installed = phoneGenSettings(phone).installedApps;

        if (installed.includes("mail")) {
          const stored = await phones.getAppStorageKey(phoneId, "mail", "inbox").catch(() => null);
          const unreadMail = Array.isArray(stored)
            ? stored.filter((item): item is { text: string; read: boolean } =>
              !!item && typeof (item as { text?: unknown }).text === "string" && (item as { read?: unknown }).read !== true)
            : [];
          const newest = unreadMail[0];
          if (newest) {
            const [from, subject] = newest.text.split(" | ");
            extra.push({
              id: `mail:${unreadMail.length}`,
              appId: "mail",
              title: from?.trim() || "New mail",
              body: subject?.trim() || "",
              count: unreadMail.length,
              at: "",
            });
          }
        }

        if (installed.includes("noodler")) {
          const since = await lastSeen(phoneId, "noodler");
          const fresh = since
            ? (await noodle.feedFor(phone.document.identity.chatScope)).filter((post) => post.at > since)
            : [];
          const newest = fresh[0];
          if (newest) {
            extra.push({
              id: `noodler:${newest.id}`,
              appId: "noodler",
              title: "Noodle",
              body: `${newest.author}: ${newest.text.slice(0, 120)}`,
              count: fresh.length,
              at: newest.at,
            });
          }
        }

        if (installed.includes("tindler")) {
          const stored = await phones.getAppStorageKey(phoneId, "tindler", "matches").catch(() => null);
          const seen = await phones.getAppStorageKey(phoneId, "tindler", "lastSeenMatches").catch(() => null);
          const matches = Array.isArray(stored) ? stored.length : 0;
          const unseen = matches - (typeof seen === "number" ? seen : matches);
          if (unseen > 0) {
            extra.push({
              id: `tindler:${matches}`,
              appId: "tindler",
              title: "Tindler",
              body: unseen === 1 ? "You have a new match" : `You have ${unseen} new matches`,
              count: unseen,
              at: "",
            });
          }
        }

        const notifications = (await messaging.threadsFor(phoneId)).flatMap(({ record, document }) => {
          const unread = unreadMessages(document, phoneId);
          const last = unread.at(-1);
          if (!last) return [];
          const otherPhoneId = document.participants.find((participant) => participant !== phoneId) ?? "";
          return [{
            id: record.id,
            appId: "messages",
            title: names.get(otherPhoneId) ?? "Unknown phone",
            body: last.text,
            count: unread.length,
            at: last.at,
          }];
        });
        return { notifications: [...notifications, ...extra] };
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
        if (toPhoneId.startsWith(CHAT_THREAD_PREFIX)) {
          const phone = await findPhone(request.params.phoneId);
          const chatId = toPhoneId.slice(CHAT_THREAD_PREFIX.length);
          if (!phone.document.identity.chatScope.includes(chatId)) {
            return reply.status(400).send({ error: "This phone is not part of this chat" });
          }
          if (!api.runtime.persistence.createMessageWithSwipe) {
            return reply.status(400).send({ error: "This Engine version cannot write to the story" });
          }
          const text = String(body.text ?? "").trim();
          if (!text) return reply.status(400).send({ error: "Message text is required" });
          // Marked as a text so the character answers like they are texting — shorter, no body
          // language. Always on; the phone is an input surface for the roleplay, not a side channel.
          await api.runtime.persistence.createMessageWithSwipe({
            id: randomUUID(),
            swipeId: randomUUID(),
            chatId,
            role: "user",
            characterId: null,
            content: `*${phone.document.identity.ownerName} texts:* ${text}`,
            extra: { virtualPhone: "text" },
            createdAt: new Date().toISOString(),
          });
          const [thread] = (await engineThreadsFor(phone)).filter((candidate) => candidate.id === toPhoneId);
          return { thread };
        }
        const contacts = await contactsFor(request.params.phoneId);
        if (!contacts.some((contact) => contact.phoneId === toPhoneId)) {
          return reply.status(400).send({ error: "That phone cannot be messaged from this chat" });
        }
        const thread = await messaging.send(request.params.phoneId, toPhoneId, String(body.text ?? ""));
        const names = new Map(contacts.map((contact) => [contact.phoneId, contact.ownerName]));
        // The send returns as soon as the message is stored. Waiting on the model here made the
        // send button hang for the length of a completion on a slow connection. The reply lands in
        // the thread asynchronously and the client's poll picks it up.
        const pending = await messaging.setReplyState(thread.record.id, { status: "pending", at: new Date().toISOString() })
          .catch(() => thread);
        void generateCharacterReply(request.params.phoneId, toPhoneId)
          .then(async (replied) => {
            // `send` clears the reply state, so only the left-on-read case needs clearing here.
            if (!replied) await messaging.setReplyState(thread.record.id, null);
          })
          .catch(async (cause: unknown) => {
            await messaging.setReplyState(thread.record.id, {
              status: "failed",
              at: new Date().toISOString(),
              error: cause instanceof Error ? cause.message : "The reply could not be generated.",
            }).catch(() => undefined);
          });
        return { thread: threadPayload(pending.record.id, pending.document, request.params.phoneId, names) };
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
    // Feeds the Lorebooks picker in phone Settings. Optional on the runtime, so an older Engine
    // simply reports none available and the picker says so.
    app.get("/lorebooks", async () => {
      if (!api.runtime.resources.listLorebooks) return { lorebooks: [], supported: false };
      const books = await api.runtime.resources.listLorebooks();
      return {
        supported: true,
        lorebooks: books.map((book) => ({ id: book.id, name: readName(book.data, "Lorebook") })),
      };
    });
    /**
     * Sending mail. The recipient may be a character in this chat, a contact the user invented, or
     * a bare address typed into the To field — free text is deliberate, since inventing an address
     * for a company or a stranger and letting the model decide who that is is most of the fun.
     * Characters answer mail sent to them; nobody is guaranteed to answer.
     */
    // Real, deduplicated interactions. A like is held against the phone that gave it, so pressing
    // twice takes it back rather than counting twice.
    app.post<{ Params: { phoneId: string }; Querystring: { chatId?: string } }>("/phones/:phoneId/noodle/interact", async (request, reply) => {
      try {
        const phone = await findPhone(request.params.phoneId);
        const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
          ? request.body as Record<string, unknown>
          : {};
        const postId = String(body.postId ?? "").trim();
        const kind = body.kind === "boost" ? "boost" : "like";
        const chatId = targetChat(phone, request.query.chatId);
        if (!chatId || !postId) return reply.status(400).send({ error: "That post cannot be reached from this phone" });
        await noodle.interact(chatId, postId, request.params.phoneId, kind);
        return { posts: await noodle.feedFor(phone.document.identity.chatScope) };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "That interaction failed" });
      }
    });
    app.post<{ Params: { phoneId: string }; Querystring: { chatId?: string } }>("/phones/:phoneId/mail/send", async (request, reply) => {
      try {
        const phone = await findPhone(request.params.phoneId);
        const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
          ? request.body as Record<string, unknown>
          : {};
        const to = String(body.to ?? "").trim().slice(0, 200);
        const subject = String(body.subject ?? "").trim().slice(0, 200);
        const text = String(body.body ?? "").trim().slice(0, 4000);
        if (!to) return reply.status(400).send({ error: "A recipient is required" });
        if (!text) return reply.status(400).send({ error: "The message is empty" });

        const chatId = targetChat(phone, request.query.chatId);
        const model = await resolvePhoneModel(phone, "heavy");
        if (!model) return { reply: null };

        // A recipient who has a phone in this chat answers in their own voice; anyone else is
        // whoever the model decides lives behind that address.
        const contact = (await contactsFor(request.params.phoneId))
          .find((candidate) => candidate.ownerName.toLowerCase() === to.toLowerCase()
            || to.toLowerCase().startsWith(`${candidate.ownerName.toLowerCase().replace(/\s+/gu, ".")}@`));
        const recipientPhone = contact ? await findPhone(contact.phoneId) : null;
        const storyContext = await worldContext(chatId, phone);
        const completion = await model.chatComplete([
          {
            role: "system",
            content: `You are ${recipientPhone ? recipientPhone.document.identity.ownerName : `whoever reads mail sent to "${to}" in this fictional world — a person, a company's support desk, or an automated system, whichever fits`}, replying to an email from ${phone.document.identity.ownerName} inside a roleplay story. Write the reply they would actually send: it may be warm, curt, boilerplate, an auto-responder, or a refusal. Respond with only JSON: {"from":"sender name","subject":"reply subject","body":"the reply"}. If nobody would reply to this, respond with {"from":"","subject":"","body":""}.${recipientPhone ? await ownerCard(recipientPhone, "About the recipient") : ""}${storyContext}${await customInstructions(phone)}`,
          },
          { role: "user", content: `To: ${to}\nSubject: ${subject}\n\n${text}` },
        ], { temperature: 0.9, maxTokens: 1200 });
        const answer = parseBoundedContent(completion.content, {
          fields: { from: "string", subject: "string", body: "string" },
          defaults: { from: "", subject: "", body: "" },
          limits: { maxString: 1600, perField: { from: 120, subject: 200 } },
        }) as { from: string; subject: string; body: string };
        if (!answer.body.trim()) return { reply: null };
        return {
          reply: {
            from: answer.from.trim() || to,
            to: phone.document.identity.ownerName,
            subject: answer.subject.trim() || `Re: ${subject}`,
            body: answer.body.trim(),
          },
        };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "The mail could not be sent" });
      }
    });
    /**
     * Step 7.6 — the model proposes what money moved in the story; nothing is written until the
     * user accepts it in the app. User-triggered rather than per-turn on purpose: a banking app
     * that polls the model forever is a banking app that quietly spends tokens forever.
     */
    app.post<{ Params: { phoneId: string }; Querystring: { chatId?: string } }>("/phones/:phoneId/banking/activity", async (request, reply) => {
      try {
        const phone = await findPhone(request.params.phoneId);
        const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
          ? request.body as Record<string, unknown>
          : {};
        const balance = Number.isFinite(Number(body.balance)) ? Number(body.balance) : 0;
        const currency = String(body.currency ?? "credits").slice(0, 40);
        const model = await resolvePhoneModel(phone, "light");
        if (!model) return { changes: [] };
        const chatId = targetChat(phone, request.query.chatId);
        const storyContext = await worldContext(chatId, phone);
        const completion = await model.chatComplete([
          {
            role: "system",
            content: `You keep the books for ${phone.document.identity.ownerName} inside a roleplay story. Their balance is ${balance} ${currency}. Read the recent story and list only money that plausibly moved because of what happened — wages, a purchase, a fare, a debt, a theft. Invent nothing that the story does not support, and return an empty list if nothing moved. Respond with only JSON: {"changes":["+120 :: sold the bike", "-40 :: taxi across town"]} with at most 4 entries. Every entry uses that exact 'amount :: reason' format and the amount is a whole number with a sign.${storyContext}${await customInstructions(phone)}`,
          },
          { role: "user", content: "What moved?" },
        ], { temperature: 0.6, maxTokens: 400 });
        const proposed = parseBoundedContent(completion.content, {
          fields: { changes: "string[]" },
          defaults: { changes: [] as string[] },
          limits: { maxString: 240, maxItems: 4 },
        }) as { changes: string[] };
        return { changes: proposed.changes };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "The bank could not be reached" });
      }
    });
    /**
     * Step 11.5 — classifieds scoped to the world. Goodle already has a `shop` page kind, so the
     * generation side largely existed; this is mostly a front end over content the phone can
     * already produce. Text-first by design: with no image connection the listing still carries its
     * title, price and seller, which is Step 11.2(b).
     */
    app.post<{ Params: { phoneId: string }; Querystring: { chatId?: string } }>("/phones/:phoneId/marketplace/listings", async (request, reply) => {
      try {
        const phone = await findPhone(request.params.phoneId);
        const model = await resolvePhoneModel(phone, "heavy");
        if (!model) return { listings: [] };
        const chatId = targetChat(phone, request.query.chatId);
        const storyContext = await worldContext(chatId, phone);
        const cast = (await contactsFor(request.params.phoneId)).map((contact) => contact.ownerName).join(", ");
        const completion = await model.chatComplete([
          {
            role: "system",
            content: `You write the local classifieds of a fictional roleplay world — the place people sell the odd, the desperate and the mundane. Invent 5 to 7 listings that fit this world. Most sellers are strangers; at most one may be from the story's cast${cast ? ` (${cast})` : ""}. Respond with only JSON: {"listings":["Seller Name | Price | Item title | description", ...]}. Every listing uses that exact four-part format and the description is one or two sentences in the seller's own voice.${storyContext}${await customInstructions(phone)}`,
          },
          { role: "user", content: "What is for sale right now?" },
        ], { temperature: 1, maxTokens: 1000 });
        const generated = parseBoundedContent(completion.content, {
          fields: { listings: "string[]" },
          defaults: { listings: [] as string[] },
          limits: { maxString: 700, maxItems: 12 },
        }) as { listings: string[] };
        return { listings: generated.listings };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "The marketplace could not be reached" });
      }
    });
    // "About this phone" — the facts Settings shows about the device itself.
    app.get<{ Params: { phoneId: string } }>("/phones/:phoneId/about", async (request, reply) => {
      try {
        const phone = await findPhone(request.params.phoneId);
        const settings = phoneGenSettings(phone);
        const storage = await Promise.all(settings.installedApps.map(async (appId) => {
          const entries = await phones.listAppStorage(request.params.phoneId, appId).catch(() => []);
          return new TextEncoder().encode(JSON.stringify(entries)).byteLength;
        }));
        return {
          ownerName: phone.document.identity.ownerName,
          ownerType: phone.document.identity.ownerType,
          deviceName: phone.document.identity.deviceName ?? "",
          chats: phone.document.identity.chatScope.length,
          installedApps: settings.installedApps.length,
          storageBytes: storage.reduce((total, bytes) => total + bytes, 0),
        };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Phone not found" });
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
