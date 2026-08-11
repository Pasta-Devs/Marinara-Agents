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
import { guessSiteKind, normalizeSiteKind, SITE_TEMPLATES } from "../apps/goodle/sites";
import { fallbackFeed } from "../apps/noodler/manifest";
import { extractImageUrls } from "../apps/gallery/manifest";
import { handleFor, NoodleFeedService, NoodlerPageService, parseGeneratedPost, parsePagePost } from "./noodle";
import { applyTransaction, parseProposal, readAccount } from "../apps/banking/manifest";
import {
  buildTurnContext,
  parseTrackedTime,
  sanitizeForPrompt,
  type TurnPhoneState,
  type TurnSceneState,
} from "./turn-context";
import { lorebookScope } from "./lorebook-scope";

interface CapabilityContext {
  api: {
    runtime: {
      persistence: {
        documents: ConstructorParameters<typeof PhoneIdentityService>[0];
        getChat(chatId: string): Promise<{
          id: string;
          mode?: "conversation" | "roleplay" | "game";
          personaId: string | null;
          characterIds: string[];
          metadata?: unknown;
          /** When the story last spoke. Lets the turn context tell news from standing state. */
          lastMessageAt?: string | null;
        } | null>;
        listMessages?(chatId: string): Promise<Array<{
          id: string;
          role: string;
          characterId: string | null;
          content: string;
          extra: string;
          createdAt: string;
        }>>;
        /**
         * The scene's own tracked state, when the Engine exposes it. World State already tracks the
         * date and time of the scene; the phone keeping a second clock by hand is a source of truth
         * too many. Optional and feature-detected, so the manual clock stays the fallback.
         */
        getGameState?(chatId: string): Promise<{
          snapshotId?: string;
          chatId?: string;
          messageId?: string;
          swipeIndex?: number;
          date?: string | null;
          time?: string | null;
          location?: string | null;
          weather?: string | null;
        } | null>;
        /** Engine 2.4.2. Read-only view of the images the Engine generated for a chat. */
        listChatImages?(chatId: string): Promise<Array<{
          id: string;
          url: string;
          prompt: string;
          createdAt: string;
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
        appendRoleplayEvent?(input: {
          id: string;
          chatId: string;
          messageId: string;
          swipeIndex: number;
          sourcePackageId: string;
          eventType: string;
          subjectCharacterIds: string[];
          audience: "public" | "user-only" | { characterIds: string[] };
          text: string;
          data: unknown;
          createdAt: string;
          idempotencyKey: string;
        }): Promise<unknown>;
      };
      resources: {
        listCharacters(ids?: string[]): Promise<Array<{ id: string; data: unknown }>>;
        listPersonas(ids?: string[]): Promise<Array<{ id: string; data: unknown }>>;
        listLorebooks?(ids?: string[]): Promise<Array<{ id: string; data: unknown }>>;
        listEligibleLorebookEntries?(selection: { lorebookIds: string[]; entryIds?: string[] }): Promise<Array<{
          name: string;
          content: string;
          description: string;
          /**
           * Engine 2.4.2. The entry's own character scope, which the Engine deliberately resolves
           * without applying so a package that cares can evaluate it. Optional here so the package
           * still runs against 2.4.1, where the fields are simply absent.
           */
          characterFilterMode?: "any" | "include" | "exclude";
          characterFilterIds?: string[];
          characterTagFilterMode?: "any" | "include" | "exclude";
          characterTagFilterIds?: string[];
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
      logger?: { error(error: unknown, message: string, ...args: unknown[]): void };
    };
    registerPrivilegedRoutes(routes: FastifyPluginAsync, options: { prefix: string }): Promise<() => void>;
    /**
     * Engine 2.4.2. Contribute text to each turn's system prompt; requires the `prompt-context`
     * permission in the manifest. Called once per generation with a read-only view of the turn,
     * under a deadline the Engine enforces, and a throw is swallowed by the collector.
     */
    registerPromptContext?(
      contributor: (request: {
        chatId: string;
        chatMeta: Record<string, unknown>;
        mode: string;
        targetCharacterIds?: string[];
        personaId?: string | null;
      }) =>
        Promise<string | null> | string | null,
    ): () => void;
    /**
     * Engine 2.4.2. Claims the in-scene tags that route to this package. The Engine gates the
     * command on the package being installed and gives it a per-chat toggle; the payload is ours.
     */
    registerConversationCommand?(registration: {
      commandType: string;
      tags: string[];
      maxPayloadChars?: number;
      description?: string;
      payloadExample?: string;
      validatePayload?: (payload: string | null) => boolean;
      handler?: (action: {
        payload: string | null;
        chatId: string;
        characterId: string | null;
        sourceMessageId: string;
        swipeIndex: number;
        branchChatId: string;
      }) => void | Promise<void>;
    }): () => void;
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
  /** The in-scene tag the Engine maps to this package (CONVERSATION_COMMAND_AGENT_IDS.phone). */
  const PHONE_COMMAND_TAG = "phone";
  const CONTACT_PHONE_PREFIX = "contact:";
  const contactPhoneId = (contactId: string) => `${CONTACT_PHONE_PREFIX}${contactId}`;
  const contactIdFromPhone = (phoneId: string) => {
    if (!phoneId.startsWith(CONTACT_PHONE_PREFIX)) return null;
    const value = phoneId.slice(CONTACT_PHONE_PREFIX.length);
    // 2.0.60-2.0.61 embedded encoded chat provenance before the contact id.
    const legacySeparator = value.indexOf(":");
    return legacySeparator >= 0 ? value.slice(legacySeparator + 1) : value;
  };
  const contactThreadIds = (document: { contactId: string; chatId: string }) => [
    contactPhoneId(document.contactId),
    `${CONTACT_PHONE_PREFIX}${encodeURIComponent(document.chatId)}:${document.contactId}`,
  ];

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
   * Step 7.2, closed: Engine 2.4.2 returns each entry's own character scope on
   * `listEligibleLorebookEntries`, which the Engine resolves but deliberately does not apply. An
   * entry written for one character no longer bleeds into another character's phone. The fields are
   * optional, so on 2.4.1 every entry still passes and behaviour is unchanged.
   */
  /** Names and scopes for this chat's lorebooks; the rule itself lives in lorebook-scope.ts. */
  const lorebooksForChat = async (chatId?: string) => {
    if (!api.runtime.resources.listLorebooks) return [];
    const chat = chatId ? await api.runtime.persistence.getChat(chatId).catch(() => null) : null;
    const metadata = chat?.metadata && typeof chat.metadata === "object" ? chat.metadata as Record<string, unknown> : {};
    const context = {
      chatId,
      characterIds: chat?.characterIds ?? [],
      personaId: chat?.personaId ?? null,
      activeLorebookIds: Array.isArray(metadata.activeLorebookIds)
        ? metadata.activeLorebookIds.filter((id): id is string => typeof id === "string")
        : [],
    };
    return (await api.runtime.resources.listLorebooks()).map((book) => ({
      id: book.id,
      name: readName(book.data, "Lorebook"),
      scope: lorebookScope(book, context),
    }));
  };

  const loreContext = async (phone?: Awaited<ReturnType<typeof findPhone>>, chatId?: string) => {
     try {
       if (!api.runtime.resources.listLorebooks || !api.runtime.resources.listEligibleLorebookEntries) return "";
        const settings = phone ? phoneGenSettings(phone) : null;
        if (settings?.lorebookMode === "none") return "";
        const selectedOnly = settings?.lorebookMode === "selected";
        const attached = selectedOnly ? settings.lorebookIds : [];
        const inChat = await lorebooksForChat(chatId);
        const books = selectedOnly
          ? inChat.filter((book) => attached.includes(book.id))
          : inChat.filter((book) => book.scope !== null);
       if (!books.length) return "";
       const entries = await api.runtime.resources.listEligibleLorebookEntries({ lorebookIds: books.map((book) => book.id), entryIds: [] });
      const owner = phone?.document.identity.ownerType === "character" ? phone.document.identity.ownerId : null;
      // The entry's tag filter names tags, not ids, so the owner's own tags have to be read off the
      // card. Cards store them as a comma-separated string.
      const ownerTags = new Set<string>();
      if (owner) {
        const [card] = await api.runtime.resources.listCharacters([owner]).catch(() => []);
        const data = card?.data && typeof card.data === "object" ? card.data as Record<string, unknown> : {};
        const raw = typeof data.tags === "string" ? data.tags : Array.isArray(data.tags) ? data.tags.join(",") : "";
        for (const tag of raw.split(",")) {
          const trimmed = tag.trim().toLocaleLowerCase();
          if (trimmed) ownerTags.add(trimmed);
        }
      }
      /**
       * An entry's own scope, which the Engine resolves but deliberately leaves for us to apply.
       * A persona's phone has no character to match, so an entry scoped to specific characters is
       * not for it; an exclude list, though, still lets it through.
       */
      const passesFilter = (mode: string | undefined, ids: string[] | undefined, matches: boolean) => {
        if (!mode || mode === "any") return true;
        if (!ids?.length) return true;
        return mode === "include" ? matches : !matches;
      };
      const scoped = entries.filter((entry) =>
        passesFilter(entry.characterFilterMode, entry.characterFilterIds, owner !== null && (entry.characterFilterIds ?? []).includes(owner))
        && passesFilter(
          entry.characterTagFilterMode,
          entry.characterTagFilterIds,
          (entry.characterTagFilterIds ?? []).some((tag) => ownerTags.has(tag.trim().toLocaleLowerCase())),
        ));
      return scoped.slice(0, 8)
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
  // A const arrow, not a function declaration: as the lone hoisted declaration among arrow helpers it
  // got minified to a name the earlier call site couldn't resolve, throwing "sharedPhoneContext is not
  // defined" and blanking every app that builds world context. Defined before worldContext, its caller.
  const sharedPhoneContext = async (phone: Awaited<ReturnType<typeof findPhone>>, chatId: string) => {
    const inChat = (await phones.list()).filter(({ document }) =>
      document.identity.phoneId !== phone.document.identity.phoneId &&
      document.provisioning.enabled && document.identity.chatScope.includes(chatId));
    const known = new Map<string, string>();
    for (const { document } of inChat) known.set(document.identity.ownerName, "you share this story with them");
    for (const { document } of await phones.listContacts(phone.document.identity.phoneId)) {
      known.set(document.name, document.source || "you saved them in Contacts");
    }
    const facts = await phones.worldFactsFor(phone.document.identity.phoneId);
    const people = [...known.entries()].slice(0, 20).map(([name, why]) => `${name} — ${why}`).join("\n");
    const remembered = facts.slice(0, 20).map((fact) => `${fact.text} (${fact.source})`).join("\n");
    return `${people ? `\n\nPeople this phone knows:\n${people}` : ""}${remembered ? `\n\nThings the owner deliberately kept or established on this phone:\n${remembered}` : ""}`;
  };
  /**
   * The phone's own clock, in words, for anything it generates. Without it a model writing an
   * inbox or a feed invents its own hour and produces breakfast newsletters during a midnight
   * scene — the screen said 03:00 and the content did not.
   */
  /**
   * The offset that puts this phone on the scene's clock.
   *
   * If another agent is already tracking what time it is in the story, that is the answer and the
   * phone should not ask the user to maintain a second one. The tracked time wins when it is there;
   * the per-phone manual offset is the fallback, which is also what every Engine without the read
   * gets. Nothing is written back — one owner for the value, and it is not us.
   */
  const storyClockOffset = async (phone: Awaited<ReturnType<typeof findPhone>>, chatId?: string) => {
    const manual = phoneGenSettings(phone).storyClockOffsetMinutes;
    if (!chatId || !api.runtime.persistence.getGameState) return manual;
    try {
      const tracked = await api.runtime.persistence.getGameState(chatId);
      const parsed = parseTrackedTime(tracked?.time);
      if (parsed === null) return manual;
      const now = new Date();
      const wanted = new Date(now);
      wanted.setHours(Math.floor(parsed / 60), parsed % 60, 0, 0);
      const minuteStart = Math.floor(now.getTime() / 60_000) * 60_000;
      return (wanted.getTime() - minuteStart) / 60_000;
    } catch {
      return manual;
    }
  };

  const storyTimeContext = async (phone?: Awaited<ReturnType<typeof findPhone>>, chatId?: string) => {
    if (!phone) return "";
    const offset = await storyClockOffset(phone, chatId);
    if (!offset) return "";
    const when = new Date(Date.now() + offset * 60_000);
    return `\n\nThe time on this phone right now is ${when.getHours().toString().padStart(2, "0")}:${when.getMinutes().toString().padStart(2, "0")}, ${when.toLocaleDateString("en-US", { weekday: "long" })}. Write what fits that hour.`;
  };

  /**
   * How a generated reply should read for the chat's mode. Written out three times with three
   * wordings, and the Mail reply route referenced a `modeInstruction` that only existed inside the
   * unprompted-texts loop — an out-of-scope read that throws at runtime, so every emailed reply
   * failed. One helper, one wording, no free variables.
   */
  const modeInstructionFor = async (chatId?: string | null) => {
    const chat = chatId ? await api.runtime.persistence.getChat(chatId).catch(() => null) : null;
    return chat?.mode === "conversation"
      ? "This is a conversation chat: answer naturally and directly, without roleplay narration."
      : chat?.mode === "game"
        ? "This is a game chat: keep the reply actionable and consistent with the current game state or turn."
        : "This is a roleplay chat: stay in character and keep the reply grounded in the scene.";
  };

  const worldContext = async (chatId: string | undefined, phone?: Awaited<ReturnType<typeof findPhone>>) => {
    const lore = await loreContext(phone, chatId);
    let story = "";
    if (chatId && api.runtime.persistence.listMessages) {
      story = (await api.runtime.persistence.listMessages(chatId)).slice(-STORY_MESSAGES)
        .map((message) => message.content.slice(0, STORY_MESSAGE_CHARS))
        .join("\n")
        .slice(-STORY_BUDGET_CHARS);
    }
    const shared = chatId && phone ? await sharedPhoneContext(phone, chatId) : "";
    return `${await storyTimeContext(phone, chatId)}${lore ? `\n\nWorld lore to stay true to:\n${lore}` : ""}${story ? `\n\nRecent story events:\n${story}` : ""}${shared}`;
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
       const modeInstruction = await modeInstructionFor(sharedChatId);
       const storyContext = await worldContext(sharedChatId, recipient);
      const completion = await model.chatComplete([
        {
          role: "system",
           content: `You are ${recipientName}, texting ${senderName} on your phone. ${modeInstruction} Write one short reply in your own voice. Respond with only JSON: {"reply":"your message"}. If ${recipientName} would leave the message on read, respond with {"reply":""}.${await ownerCard(recipient, "Who is texting — about")}${storyContext}${await customInstructions(recipient)}`,
        },
        { role: "user", content: history },
      ], { temperature: 0.9, maxTokens: 250 });
      const { reply } = parseBoundedContent(completion.content, { fields: { reply: "string" }, defaults: { reply: "" }, limits: { maxString: 400 } }) as { reply: string };
      if (!reply.trim()) return null;
      return await messaging.send(recipientPhoneId, senderPhoneId, reply);
    }
  };

  const generateContactReply = async (senderPhoneId: string, contactId: string, chatId: string) => {
    const sender = await findPhone(senderPhoneId);
    const contact = (await phones.listContacts(senderPhoneId)).find(({ document }) => document.contactId === contactId)?.document;
    if (!contact) throw new Error("Contact not found");
    const model = await resolvePhoneModel(sender, "light");
    if (!model) return null;
    const possiblePhoneIds = contactThreadIds(contact);
    const thread = (await messaging.threadsFor(senderPhoneId))
      .find(({ document }) => possiblePhoneIds.some((phoneId) => document.participants.includes(phoneId)));
    if (!thread) return null;
    const history = thread.document.messages.slice(-20)
      .map((message) => `${message.from === senderPhoneId ? sender.document.identity.ownerName : contact.name}: ${message.text}`)
      .join("\n");
    const completion = await model.chatComplete([
      {
        role: "system",
        content: `You are ${contact.name}, texting ${sender.document.identity.ownerName} inside an ongoing roleplay. Write one short reply in your own voice. Respond with only JSON: {"reply":"your message"}. If you would leave this on read, respond with {"reply":""}.${contact.bio ? `\n\nAbout you:\n${contact.bio}` : ""}\n\nHow you know them: ${contact.source || "saved in Contacts"}${await worldContext(chatId, sender)}${await customInstructions(sender)}`,
      },
      { role: "user", content: history },
    ], { temperature: 0.9, maxTokens: 250 });
    const { reply } = parseBoundedContent(completion.content, {
      fields: { reply: "string" }, defaults: { reply: "" }, limits: { maxString: 400 },
    }) as { reply: string };
    if (!reply.trim()) return null;
    const recipientPhoneId = thread.document.participants.find((participant) => participant !== senderPhoneId) ?? contactPhoneId(contact.contactId);
    return messaging.send(recipientPhoneId, senderPhoneId, reply);
  };

  /** Per-line and total caps for what Show/Reference copies into the story. */
  const SCREEN_LINE_CHARS = 160;
  const SCREEN_DETAIL_CHARS = 900;

  /**
   * What Show and Reference put in front of the character. This used to be a one-line précis —
   * "the Messages chat with Mara: two truncated quotes" — which is not what the user pressing Show
   * meant. They wanted the character to read the screen, so send the screen: the actual visible
   * lines, capped. The summary line survives as the stage direction above it.
   */
  const screenContent = async (
    phone: Awaited<ReturnType<typeof findPhone>>,
    app_: string | null,
    surface: "lock" | "home",
  ) => {
    const phoneId = phone.document.identity.phoneId;
    const clip = (value: string) => value.replace(/\s+/g, " ").trim().slice(0, SCREEN_LINE_CHARS);
    const block = (lines: string[]) => lines.filter(Boolean).join("\n").slice(0, SCREEN_DETAIL_CHARS);
    let summary = surface === "lock" ? "the lock screen" : "the home screen";
    let detail = "";

    if (app_ === "messages") {
      const [thread] = await messaging.threadsFor(phoneId);
      if (thread) {
        // Contact threads use synthetic `contact:` phone ids, so resolving names from real phones
        // alone left every saved-contact conversation reading as "someone".
        const names = new Map<string, string>([
          ...(await contactsFor(phoneId)).map((contact) => [contact.phoneId, contact.ownerName] as const),
          ...(await phones.listContacts(phoneId)).flatMap(({ document }) =>
            contactThreadIds(document).map((id) => [id, document.name] as const)),
        ]);
        const other = thread.document.participants.find((participant) => participant !== phoneId) ?? "";
        const otherName = names.get(other) ?? "someone";
        summary = `the Messages chat with ${otherName}`;
        detail = block(thread.document.messages.slice(-10).map((message) =>
          `${message.from === phoneId ? phone.document.identity.ownerName : otherName}: ${clip(message.text)}`));
      } else {
        summary = "the Messages app, no conversations yet";
      }
    } else if (app_ === "goodle") {
      const recents = await phones.getAppStorageKey(phoneId, "goodle", "recents").catch(() => null);
      const queries = Array.isArray(recents) ? recents.filter((item): item is string => typeof item === "string") : [];
      summary = queries[0] ? `Goodle, searching for "${clip(queries[0])}"` : "the Goodle search app";
      detail = block(queries.slice(0, 6).map((query, index) => `${index === 0 ? "Searching" : "Earlier"}: ${clip(query)}`));
    } else if (app_ === "notes") {
      const notes = await phones.getAppStorageKey(phoneId, "notes", "notes").catch(() => null);
      const first = Array.isArray(notes) ? (notes[0] as { text?: unknown } | undefined) : undefined;
      const text = typeof first?.text === "string" ? first.text.trim() : "";
      summary = text ? `a note that starts: "${clip(text.split("\n")[0]!)}"` : "the Notes app";
      detail = text.slice(0, SCREEN_DETAIL_CHARS);
    } else if (app_ === "mail") {
      const stored = await phones.getAppStorageKey(phoneId, "mail", "inbox").catch(() => null);
      const inbox = Array.isArray(stored)
        ? stored.filter((item): item is { text: string; read?: boolean } =>
          !!item && typeof (item as { text?: unknown }).text === "string")
        : [];
      summary = inbox.length ? "the Mail inbox" : "the Mail app, nothing in the inbox";
      detail = block(inbox.slice(0, 6).map((item) => {
        const [from, subject] = item.text.split(" | ");
        return `${item.read === true ? "" : "• "}${clip(from ?? "Unknown")} — ${clip(subject ?? "")}`;
      }));
    } else if (app_ === "noodler") {
      const posts = await noodle.feedFor(phone.document.identity.chatScope);
      summary = posts.length ? "the Noodle feed" : "the Noodle feed, nothing posted yet";
      detail = block(posts.slice(0, 5).map((post) => `${post.author} ${post.handle}: ${clip(post.text)}`));
    } else if (app_ === "contacts") {
      const saved = (await phones.listContacts(phoneId)).map(({ document }) => document.name);
      const scene = (await contactsFor(phoneId)).map((contact) => contact.ownerName);
      const all = [...new Set([...saved, ...scene])];
      summary = all.length ? "the Contacts list" : "the Contacts app, empty";
      detail = block(all.slice(0, 20).map((name) => `- ${name}`));
    } else if (app_ === "settings" || app_ === "app-store") {
      summary = `the ${app_ === "app-store" ? "App Store" : "Settings"} app`;
    } else if (app_) {
      summary = `the ${app_[0]!.toUpperCase()}${app_.slice(1)} app`;
    }
    return { summary, detail };
  };

  /**
   * The per-turn phone state handed to the story. Read-only, and deliberately cheap: it runs on
   * every generation, so it touches phone documents and threads and nothing else — no model calls,
   * no lorebook reads, no story history.
   */
  /**
   * The per-turn phone state handed to the story.
   *
   * Whose phone this may describe is the whole question. A phone is private until its owner shows
   * it — that is what the Show button and the access-denial screen exist for — so contributing
   * every phone in the chat would route around both: the character would learn what is on the
   * user's phone without being shown it, and what is on another character's phone as well.
   *
   * So: never a persona's phone, and a character's only when the chat has exactly one character,
   * because the Engine tells us the chat but not who is speaking. In a group scene there is no way
   * to know whose phone the block would be read by, and the safe answer is silence.
   *
   * It also has to be cheap. This runs before every generation in every chat, including chats with
   * no phone at all, under a deadline the Engine enforces — so it walks the phone list once and
   * returns before touching threads or app storage when there is nothing to say.
   */
  const turnPhoneStates = async (
    chatId: string,
    targetCharacterIds?: string[],
  ): Promise<{ phones: TurnPhoneState[]; scene?: TurnSceneState }> => {
    const owned = (await phones.list()).filter(({ document }) =>
      document.provisioning.enabled
      && document.identity.ownerType === "character"
      && document.identity.chatScope.includes(chatId));
    if (!owned.length) return { phones: [] };

    const chat = await api.runtime.persistence.getChat(chatId).catch(() => null);
    if (!chat) return { phones: [] };
    const targetIds = (targetCharacterIds ?? []).filter((id) => chat.characterIds.includes(id));
    if (targetIds.length !== 1) return { phones: [] };
    const speaker = targetIds[0];
    const phone = owned.find(({ document }) => document.identity.ownerId === speaker);
    if (!phone) return { phones: [] };

    const { document } = phone;
    const phoneId = document.identity.phoneId;
    const settings = normalizeDeviceSettings(document.namespaces.phone.settings, document.provisioning.baselineTheme);
    const names = new Map<string, string>([
      ...(await contactsFor(phoneId)).map((contact) => [contact.phoneId, contact.ownerName] as const),
      ...(await phones.listContacts(phoneId)).flatMap(({ document: contact }) =>
        contactThreadIds(contact).map((id) => [id, contact.name] as const)),
    ]);
    /**
     * Everything is measured against when the story last spoke. A text that landed after that is
     * news the scene has not had a chance to react to; anything older has already been offered.
     * A chat that has never had a message treats everything as new.
     */
    const storySpokeAt = chat.lastMessageAt ?? "";
    const unread: TurnPhoneState["unread"] = [];
    for (const thread of await messaging.threadsFor(phoneId)) {
      const pending = unreadMessages(thread.document, phoneId);
      if (!pending.length) continue;
      const other = thread.document.participants.find((participant) => participant !== phoneId) ?? "";
      const latest = pending.at(-1);
      unread.push({
        from: names.get(other) ?? "an unknown number",
        count: pending.length,
        latest: latest?.text ?? "",
        fresh: !storySpokeAt || (latest?.at ?? "") > storySpokeAt,
      });
    }
    const notes = await phones.getAppStorageKey(phoneId, "notes", "notes").catch(() => null);
    const firstNote = Array.isArray(notes) ? (notes[0] as { text?: unknown } | undefined) : undefined;
    const tracked = api.runtime.persistence.getGameState
      ? await api.runtime.persistence.getGameState(chatId).catch(() => null)
      : null;
    return { phones: [{
      ownerName: document.identity.ownerName,
      ownerType: document.identity.ownerType,
      clock: settings.storyClockOffsetMinutes
        ? new Date(Date.now() + settings.storyClockOffsetMinutes * 60_000)
          .toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
        : undefined,
      unread,
      note: typeof firstNote?.text === "string" && firstNote.text.trim()
        ? { text: firstNote.text, fresh: !storySpokeAt || String((firstNote as { updatedAt?: unknown }).updatedAt ?? "") > storySpokeAt }
        : undefined,
      batteryLevel: settings.batteryLevel,
    }], scene: tracked ? {
      time: tracked.time,
      location: tracked.location,
      weather: tracked.weather,
    } : undefined };
  };

  /**
   * A phone event, written into the story as a narrator line.
   *
   * There are two ways to tell the story something and they are not interchangeable.
   *
   * The per-turn prompt-context block is right for *state* — what is on the phone right now. It is
   * recomputed every generation, costs nothing when there is nothing to say, and leaves no trace.
   * But it is not history: a text that arrives, is reacted to, and is then read leaves no record of
   * why the character bolted for the door three turns later.
   *
   * A narrator message is right for *events*. The Engine hands narrator messages to the model as
   * system messages in transcript order, so it lands in the scene at the moment it happened, stays
   * in history, survives regeneration, and the user can see it and delete it if they disagree.
   *
   * The two compose without double-telling, and by accident of the right design rather than by
   * checking: writing this line moves the chat's lastMessageAt, so the same text stops counting as
   * fresh for the turn context and is demoted to a standing fact on the next generation.
   *
   * The line names who can perceive it, because a phone in a pocket is not a public event.
   */
  const storyEvent = async (chatId: string, ownerName: string, detail: string) => {
    if (!api.runtime.persistence.createMessageWithSwipe) return;
    const owner = sanitizeForPrompt(ownerName, 40) || "Someone";
    try {
      await api.runtime.persistence.createMessageWithSwipe({
        id: randomUUID(),
        swipeId: randomUUID(),
        chatId,
        role: "narrator",
        characterId: null,
        content: `[${owner}'s phone — only ${owner} notices this: ${sanitizeForPrompt(detail, 160)}]`,
        extra: { virtualPhone: "event" },
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      api.runtime.logger?.error(error, "[virtual-phone] a phone event could not be written to the story");
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
        const { summary, detail } = await screenContent(phone, app_, surface);
        /**
         * Showing a character's own phone was written as a user message, so the story read as the
         * user having done it. Attribute it to the character when the phone is theirs and they are
         * actually in this chat; anything else stays user-side.
         */
        const asCharacter = phone.document.identity.ownerType === "character"
          && chat.characterIds.includes(phone.document.identity.ownerId)
          ? phone.document.identity.ownerId
          : null;
        const mode = body.mode === "reference" ? "reference" : "show";
        const screen = detail ? `\n\nOn screen:\n${detail}` : "";
        const offset = await storyClockOffset(phone, chat.id);
        const shownAt = offset
          ? new Date(Date.now() + offset * 60_000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
          : "";
        const stamp = shownAt ? `, ${shownAt}` : "";
        const content = mode === "reference"
          ? `[${ownerName}'s phone right now${stamp} — ${summary}]${screen}`
          : `*${ownerName} shows their phone${stamp} — ${summary}*${screen}`;
        await api.runtime.persistence.createMessageWithSwipe({
          id: randomUUID(),
          swipeId: randomUUID(),
          chatId: chat.id,
          role: asCharacter ? "assistant" : "user",
          characterId: asCharacter,
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
    for (const { document } of await phones.listContacts(phoneId)) {
      known.set(document.name, document.source || (document.phoneLabel ? `you saved their details as ${document.phoneLabel}` : "you saved them in Contacts"));
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
   * Apps the model may choose from when tailoring a character's loadout. The standard apps —
   * Settings, the App Store and Goodle — are always installed and never listed here.
   */
  const LOADOUT_APPS: Array<{ id: string; blurb: string }> = [
    { id: "messages", blurb: "texting with people they know" },
    { id: "contacts", blurb: "saved people and numbers" },
    { id: "mail", blurb: "email inbox" },
    { id: "notes", blurb: "private notes" },
    { id: "gallery", blurb: "photos" },
    { id: "camera", blurb: "taking photos" },
    { id: "noodler", blurb: "public social feed (like Twitter)" },
    { id: "noodler-r", blurb: "adult creator subscriptions (like OnlyFans)" },
    { id: "tindler", blurb: "dating/hookups" },
    { id: "marketplace", blurb: "local classifieds buying/selling" },
    { id: "azmoron", blurb: "online shopping (like Amazon)" },
    { id: "banking", blurb: "money and payments" },
    { id: "maps", blurb: "navigation" },
    { id: "find", blurb: "locating people/devices" },
    { id: "pastasafari", blurb: "a casual match-three game" },
  ];

  /** Live apps that normally regenerate per open; pregen stores an in-character batch under these keys. */
  const SEED_APPS: Array<{ id: string; tier: "light" | "heavy"; field: string; maxItems: number; prompt: (phone: Awaited<ReturnType<typeof findPhone>>, ctx: string) => string }> = [
    { id: "mail", tier: "heavy", field: "emails", maxItems: 25, prompt: (phone, ctx) =>
      `You write the email inbox of ${phone.document.identity.ownerName}, a character in a roleplay world. Invent 4 to 6 emails that fit their life in this world: newsletters, spam, official notices, and the occasional personal message from minor side characters. Respond with only JSON: {"emails":["Sender Name | Subject line | short body text", ...]}. Every email uses that exact three-part format.${ctx}` },
    { id: "marketplace", tier: "heavy", field: "listings", maxItems: 12, prompt: (_phone, ctx) =>
      `You write the local classifieds of a fictional roleplay world — the place people sell the odd, the desperate and the mundane. Invent 5 to 7 listings that fit this world. Most sellers are strangers. Respond with only JSON: {"listings":["Seller Name | Price | Item title | description", ...]}. Every listing uses that exact four-part format and the description is one or two sentences in the seller's own voice.${ctx}` },
  ];

  /**
   * Make a freshly enabled phone already feel like the character's: infer the owner profile, let the
   * model pick a realistic app loadout, and pre-seed the live apps so their first open is in-character
   * rather than empty. Runs in the background — every step is best-effort and independently guarded so
   * one model hiccup never leaves the phone half-provisioned.
   */
  const pregeneratePhone = async (phoneId: string, requestedChatId?: string) => {
    let phone = await findPhone(phoneId).catch(() => null);
    if (!phone) return;
    const chatId = targetChat(phone, requestedChatId);
    // 1. Owner tech-profile — shapes every app's live and seeded output. Stores itself.
    await ownerProfile(phone).catch(() => undefined);
    phone = (await findPhone(phoneId).catch(() => null)) ?? phone;

    // 2. Model-picked app loadout.
    const model = await resolvePhoneModel(phone, "light");
    if (model) {
      try {
        const catalog = LOADOUT_APPS.map((app) => `${app.id}: ${app.blurb}`).join("\n");
        const completion = await model.chatComplete([
          { role: "system", content: `Decide which apps this character realistically has installed on their phone, given who they are. Choose from this list only:\n${catalog}\n\nReturn the app ids they would plausibly have — most people have the everyday ones, but omit what does not fit them and keep any that do. Respond with only JSON: {"apps":["id", ...]}.${await ownerCard(phone, "About the phone owner")}${await customInstructions(phone)}` },
          { role: "user", content: "Which apps does this character have?" },
        ], { temperature: 0.6, maxTokens: 200 });
        const picked = parseBoundedContent(completion.content, { fields: { apps: "string[]" }, defaults: { apps: [] as string[] }, limits: { maxString: 40, maxItems: 20 } }) as { apps: string[] };
        const valid = new Set(LOADOUT_APPS.map((app) => app.id));
        const chosen = picked.apps.filter((id) => valid.has(id));
        // Only override the default loadout when the model actually decided; keep Goodle standard.
        if (chosen.length) { await phones.updateSettings(phoneId, { installedApps: ["settings", "app-store", "goodle", ...chosen] }); phone = (await findPhone(phoneId).catch(() => null)) ?? phone; }
      } catch { /* keep the default loadout if the model cannot decide */ }
    }

    // 2b. Device look and status bar — the wallpaper, case, screen wear and battery/signal that fit them.
    if (model) {
      try {
        const completion = await model.chatComplete([
          { role: "system", content: `Set up this character's phone hardware to fit who they are. Respond with only JSON: {"deviceName":"what they'd name it, or empty","wallpaper":"gradient|midnight|paper","wallpaperTint":"#hex or colour name or empty","caseColor":"the phone case colour as #hex or a colour name","pattern":"none|dots|grid|noise|waves","patternIntensity":0-3,"screenEffect":"none|cracks|smudge|blood|scanlines","screenEffectIntensity":0-3,"batteryLevel":0-100,"cellularSignal":0-4}. A careless or rough character has a cracked or smudged screen and a low battery; a tidy one is clean and charged.${await ownerCard(phone, "About the phone owner")}${await customInstructions(phone)}` },
          { role: "user", content: "Describe their phone." },
        ], { temperature: 0.8, maxTokens: 300 });
        const look = parseBoundedContent(completion.content, {
          fields: { deviceName: "string", wallpaper: "string", wallpaperTint: "string", caseColor: "string", pattern: "string", patternIntensity: "number", screenEffect: "string", screenEffectIntensity: "number", batteryLevel: "number", cellularSignal: "number" },
          defaults: { deviceName: "", wallpaper: "", wallpaperTint: "", caseColor: "", pattern: "", patternIntensity: 0, screenEffect: "", screenEffectIntensity: 0, batteryLevel: -1, cellularSignal: -1 },
          limits: { maxString: 60 },
        }) as Record<string, string | number>;
        // Models answer colour prompts with hex, #rgb shorthand, or a plain name — accept all three.
        const NAMED_COLORS: Record<string, string> = {
          black: "#101216", white: "#f5f5f7", gray: "#8e8e93", grey: "#8e8e93", silver: "#c7c7cc",
          red: "#ff3b30", crimson: "#dc143c", orange: "#ff9500", gold: "#d4af37", yellow: "#ffcc00",
          green: "#34c759", teal: "#30b0c7", cyan: "#32ade6", blue: "#0a84ff", navy: "#1c2a5e",
          purple: "#af52de", violet: "#8f57d3", magenta: "#ff2d92", pink: "#ff6482", brown: "#8b5a2b",
          rose: "#e0607e", mint: "#63e6be", lime: "#a8e05f", beige: "#e8dfcc",
        };
        const hex = (value: unknown): string | undefined => {
          if (typeof value !== "string") return undefined;
          const raw = value.trim().toLowerCase();
          if (/^#[0-9a-f]{6}$/.test(raw)) return raw;
          if (/^#[0-9a-f]{3}$/.test(raw)) return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
          // Pick out a known colour word even inside "matte black" or "deep navy blue".
          for (const word of raw.split(/[^a-z]+/).reverse()) if (NAMED_COLORS[word]) return NAMED_COLORS[word];
          return undefined;
        };
        const oneOf = (value: unknown, allowed: string[]) => (typeof value === "string" && allowed.includes(value) ? value : undefined);
        const range = (value: unknown, min: number, max: number) => (typeof value === "number" && value >= min && value <= max ? Math.round(value) : undefined);
        const patch: Partial<DeviceSettings> = {};
        if (typeof look.deviceName === "string" && look.deviceName.trim()) patch.deviceName = look.deviceName.trim().slice(0, 40);
        const wallpaper = oneOf(look.wallpaper, ["gradient", "midnight", "paper"]); if (wallpaper) patch.wallpaper = wallpaper;
        const pattern = oneOf(look.pattern, ["none", "dots", "grid", "noise", "waves"]); if (pattern) patch.pattern = pattern as DeviceSettings["pattern"];
        const screenEffect = oneOf(look.screenEffect, ["none", "cracks", "smudge", "blood", "scanlines"]); if (screenEffect) patch.screenEffect = screenEffect as DeviceSettings["screenEffect"];
        const wallpaperTint = hex(look.wallpaperTint); if (wallpaperTint) patch.wallpaperTint = wallpaperTint;
        const caseColor = hex(look.caseColor); if (caseColor) patch.caseColor = caseColor;
        const patternIntensity = range(look.patternIntensity, 0, 3); if (patternIntensity !== undefined) patch.patternIntensity = patternIntensity as DeviceSettings["patternIntensity"];
        const screenEffectIntensity = range(look.screenEffectIntensity, 0, 3); if (screenEffectIntensity !== undefined) patch.screenEffectIntensity = screenEffectIntensity as DeviceSettings["screenEffectIntensity"];
        const batteryLevel = range(look.batteryLevel, 0, 100); if (batteryLevel !== undefined) patch.batteryLevel = batteryLevel;
        const cellularSignal = range(look.cellularSignal, 0, 4); if (cellularSignal !== undefined) patch.cellularSignal = cellularSignal as DeviceSettings["cellularSignal"];
        if (Object.keys(patch).length) { await phones.updateSettings(phoneId, patch); phone = (await findPhone(phoneId).catch(() => null)) ?? phone; }
      } catch { /* keep default hardware if the model cannot decide */ }
    }

    const installed = new Set(normalizeDeviceSettings(phone.document.namespaces.phone.settings, phone.document.provisioning.baselineTheme).installedApps);

    // 3. Seed the stateless live apps the character actually has.
    for (const spec of SEED_APPS) {
      if (!installed.has(spec.id)) continue;
      const tierModel = await resolvePhoneModel(phone, spec.tier);
      if (!tierModel) continue;
      try {
        const ctx = `${await worldContext(chatId, phone)}${await customInstructions(phone)}`;
        const completion = await tierModel.chatComplete([
          { role: "system", content: spec.prompt(phone, ctx) },
          { role: "user", content: "Generate the current content." },
        ], { temperature: 1, maxTokens: 1400 });
        const parsed = parseBoundedContent(completion.content, { fields: { [spec.field]: "string[]" }, defaults: { [spec.field]: [] as string[] }, limits: { maxString: 1200, maxItems: spec.maxItems } }) as Record<string, string[]>;
        if (parsed[spec.field]?.length) await phones.setAppContent(phoneId, spec.id, parsed[spec.field]);
      } catch { /* skip this app's seed, the live route still generates on open */ }
    }

    // 3b. Seed Goodle's own state — the search history and bookmarks a real owner would already have.
    if (installed.has("goodle")) {
      const light = await resolvePhoneModel(phone, "light");
      if (light) {
        try {
          const completion = await light.chatComplete([
            { role: "system", content: `Invent the web-search history and bookmarks this character already has on their phone — the things they'd have looked up and saved, in character. Respond with only JSON: {"recents":["search term", ...],"bookmarks":["Page title | site.domain | one sentence summary", ...]}. 5 to 8 recents, 2 to 4 bookmarks; every bookmark uses that exact three-part format.${await ownerCard(phone, "About the phone owner")}${await customInstructions(phone)}` },
            { role: "user", content: "What has this person searched and saved?" },
          ], { temperature: 1, maxTokens: 500 });
          const parsed = parseBoundedContent(completion.content, {
            fields: { recents: "string[]", bookmarks: "string[]" },
            defaults: { recents: [] as string[], bookmarks: [] as string[] },
            limits: { maxString: 400, maxItems: 12 },
          }) as { recents: string[]; bookmarks: string[] };
          if (parsed.recents.length) await phones.setAppStorageKey(phoneId, "goodle", "recents", parsed.recents.slice(0, 8));
          const pages = parsed.bookmarks
            .map((line) => line.split("|").map((part) => part.trim()))
            .filter(([title]) => title)
            .slice(0, 4)
            .map(([title, site, summary]) => {
              const domain = site || "goodle.web";
              return { site: domain, title, tagline: summary ?? "", kind: "official", links: [], sections: summary ? [summary] : [], url: `https://${domain}`, loading: false };
            });
          if (pages.length) await phones.setAppStorageKey(phoneId, "goodle", "bookmarks", pages);
        } catch { /* Goodle starts blank if this call fails */ }
      }
    }

    // 3c. Seed owner-state apps — the private stuff a real owner would already have on the device.
    const nowIso = new Date().toISOString();
    const seedList = async (appId: string, key: string, field: string, promptText: string, map: (line: string) => unknown | null) => {
      if (!installed.has(appId)) return;
      const m = await resolvePhoneModel(phone, "light");
      if (!m) return;
      try {
        const completion = await m.chatComplete([
          { role: "system", content: `${promptText}${await ownerCard(phone, "About the phone owner")}${await customInstructions(phone)}` },
          { role: "user", content: "Generate them." },
        ], { temperature: 1, maxTokens: 600 });
        const parsed = parseBoundedContent(completion.content, { fields: { [field]: "string[]" }, defaults: { [field]: [] as string[] }, limits: { maxString: 800, maxItems: 12 } }) as Record<string, string[]>;
        const items = (parsed[field] ?? []).map(map).filter((item): item is Record<string, unknown> => item !== null);
        if (items.length) await phones.setAppStorageKey(phoneId, appId, key, items);
      } catch { /* app starts blank if this call fails */ }
    };

    await seedList("notes", "notes", "notes",
      `Invent 2 to 4 private notes this character would already have written to themselves — reminders, lists, half-thoughts, in their own voice. In each note the first line is a short title, then a line break, then the body. Respond with only JSON: {"notes":["Title line\\nThe rest is the note body", ...]}.`,
      (text) => text.trim() ? { id: randomUUID(), text: text.trim(), updatedAt: nowIso } : null);

    await seedList("camera", "shots", "shots",
      `Describe 2 to 4 photos already in this character's camera roll — what they'd have taken, one vivid sentence each, in character. Respond with only JSON: {"shots":["photo description", ...]}.`,
      (text) => text.trim() ? { id: randomUUID(), text: text.trim(), at: nowIso } : null);

    await seedList("azmoron", "orders", "orders",
      `Invent 2 to 4 past online-shopping orders this character has waiting or delivered. Respond with only JSON: {"orders":["Item name | Seller | $price | short detail", ...]}. Every order uses that exact four-part format.`,
      (line) => {
        const [name, seller, price, detail] = line.split("|").map((part) => part.trim());
        return name ? { id: randomUUID(), name, seller: seller || "Azmoron", price: price || "", detail: detail || "", status: "Delivered", at: nowIso } : null;
      });

    // 3d. Seed the (fictional) bank account — a plausible balance built from real history so it audits.
    if (installed.has("banking")) {
      const m = await resolvePhoneModel(phone, "light");
      if (m) {
        try {
          const completion = await m.chatComplete([
            { role: "system", content: `Invent this character's recent money history in a fictional roleplay world — the movements that add up to what's in their account now. Respond with only JSON: {"currency":"one word, e.g. credits or dollars","transactions":["+amount :: what it was for", "-amount :: what it was for", ...]}. 4 to 7 movements; start with the larger income so the balance ends up positive and in character.${await ownerCard(phone, "About the account holder")}${await customInstructions(phone)}` },
            { role: "user", content: "What does their account look like?" },
          ], { temperature: 1, maxTokens: 500 });
          const parsed = parseBoundedContent(completion.content, { fields: { currency: "string", transactions: "string[]" }, defaults: { currency: "credits", transactions: [] as string[] }, limits: { maxString: 240, maxItems: 12 } }) as { currency: string; transactions: string[] };
          const transactions = parsed.transactions
            .map((line) => parseProposal(line))
            .filter((entry): entry is { amount: number; description: string } => entry !== null)
            .map((entry) => ({ id: randomUUID(), at: nowIso, amount: entry.amount, description: entry.description, source: "story" as const }));
          if (transactions.length) {
            const balance = transactions.reduce((total, entry) => total + entry.amount, 0);
            await phones.setAppStorageKey(phoneId, "banking", "account", { balance, currency: (parsed.currency || "credits").trim().slice(0, 24), transactions, pending: [] });
          }
        } catch { /* account starts empty if this call fails */ }
      }
    }

    // 4. Seed the public feed, which already persists its own posts.
    if (installed.has("noodler") && chatId) {
      const heavy = await resolvePhoneModel(phone, "heavy");
      if (heavy) {
        try {
          const storyContext = await worldContext(chatId, phone);
          const completion = await heavy.chatComplete([
            { role: "system", content: `You are Noodle, the social network inside a fictional roleplay world. Invent 4 to 6 short posts, mostly by fictional side characters reacting to life in this world. Respond with only JSON: {"posts":["Display Name @handle — post text", ...]}.${storyContext}${await customInstructions(phone)}` },
            { role: "user", content: "Generate the opening batch of posts." },
          ], { temperature: 1, maxTokens: 800 });
          const generated = parseBoundedContent(completion.content, { fields: { posts: "string[]" }, defaults: fallbackFeed(), limits: { maxString: 600, maxItems: 20 } }) as { posts: string[] };
          if (generated.posts.length) await noodle.addPosts(chatId, generated.posts.map(parseGeneratedPost));
        } catch { /* feed stays empty until first open */ }
      }
    }
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
        const modeInstruction = await modeInstructionFor(chatId);
        const completion = await model.chatComplete([
          {
            role: "system",
            content: `You are ${phone.document.identity.ownerName}, texting ${other.document.identity.ownerName} on your phone inside an ongoing roleplay. ${reason} ${modeInstruction} Send one short in-character text picking the thread back up, in your own voice. Respond with only JSON: {"reply":"your message"}. If you would not text them right now, respond with {"reply":""}.${await ownerCard(phone, "Who you are — about")}${await directoryContext(phone)}${await worldContext(chatId, phone)}${await customInstructions(phone)}`,
          },
          { role: "user", content: history || "No messages yet." },
        ], { temperature: 0.95, maxTokens: 250 });
        const { reply } = parseBoundedContent(completion.content, {
          fields: { reply: "string" },
          defaults: { reply: "" },
          limits: { maxString: 400 },
        }) as { reply: string };
        if (reply.trim()) {
          await messaging.send(phoneId, otherPhoneId, reply);
          /**
           * Only unprompted texts get a line. A reply the user asked for is already on the screen
           * they are looking at, and the turn context carries it; a text arriving out of nowhere is
           * the one phone event the scene genuinely cannot otherwise know about.
           */
          if (chatId && phoneGenSettings(other).storyNotices) {
            await storyEvent(chatId, other.document.identity.ownerName,
              `${phone.document.identity.ownerName} texts: "${reply.trim()}"`);
          }
        }
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
    /**
     * The phone half of the loop: what the owner did, recorded as it happens.
     * Cheap and silent — no model call, no chat write.
     */
    app.post<{ Params: { phoneId: string }; Querystring: { chatId?: string } }>("/phones/:phoneId/activity", async (request, reply) => {
      try {
        const phone = await findPhone(request.params.phoneId);
        const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
          ? request.body as Record<string, unknown>
          : {};
        const text = String(body.text ?? "").trim();
        const chatId = targetChat(phone, request.query.chatId);
        if (!text || !chatId) return { recorded: false };
        await phones.appendActivity(request.params.phoneId, chatId, text);
        return { recorded: true };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Activity not recorded" });
      }
    });
    app.post<{ Params: { phoneId: string }; Querystring: { chatId?: string } }>("/phones/:phoneId/world-facts", async (request, reply) => {
      try {
        const phone = await findPhone(request.params.phoneId);
        const chatId = targetChat(phone, request.query.chatId);
        if (!chatId) return reply.status(400).send({ error: "This phone has no story to remember this in" });
        const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
          ? request.body as Record<string, unknown>
          : {};
        const fact = await phones.rememberWorldFact(request.params.phoneId, chatId, String(body.text ?? ""), String(body.source ?? "Phone"));
        return { fact };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "The phone could not remember that" });
      }
    });

    /**
     * The story half: putting the phone down tells the scene what happened on it, as ONE line.
     *
     * This is what makes the phone part of the roleplay rather than a side panel — until now the
     * only path from phone to story was the manual Show button, so everything you did in here was
     * invisible and consequence-free. Batched per session on purpose: a message per action would
     * flood the chat, and the Engine renders these as ordinary messages.
     */
    app.post<{ Params: { chatId: string; phoneId: string } }>("/chats/:chatId/phones/:phoneId/session", async (request, reply) => {
      try {
        const { phone, chatId } = await chatForPhone(request.params.phoneId, request.params.chatId);
        if (!phoneGenSettings(phone).storyNotices) return { wrote: false };
        if (!api.runtime.persistence.createMessageWithSwipe) return { wrote: false };
        const entries = await phones.takeActivity(request.params.phoneId, chatId);
        if (entries.length === 0) return { wrote: false };
        const ownerName = phone.document.identity.ownerName;
        const summary = entries.map((entry) => entry.text).join("; ");
        await api.runtime.persistence.createMessageWithSwipe({
          id: randomUUID(),
          swipeId: randomUUID(),
          chatId,
          role: "user",
          characterId: null,
          content: `[${ownerName} was on their phone: ${summary}]`,
          extra: { virtualPhone: "session" },
          createdAt: new Date().toISOString(),
        });
        return { wrote: true, summary };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Session not recorded" });
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
          // First time a character phone is switched on: provision it in the background so it already
          // feels like theirs. `ownerProfile` is only set once pregen has run, so this fires once.
          if (body.enabled === true && ownerType === "character" && phone.document.namespaces.phone.ownerProfile === undefined) {
            void pregeneratePhone(phone.document.identity.phoneId, chat.id).catch((cause) =>
              api.runtime.logger?.error(cause, "[virtual-phone] pregeneration failed"));
          }
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
  const messageExtra = (value: unknown) => {
    if (typeof value !== "string") return value && typeof value === "object" ? value as Record<string, unknown> : {};
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  };
  /** A Conversation thread shows phone-text exchanges, not a second copy of the ordinary chat. */
  const conversationTexts = projectConversationTexts;
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
       const messages = conversationTexts(await api.runtime.persistence.listMessages(chatId).catch(() => []))
        .slice(-STORY_MESSAGES)
        .map((message) => ({
          id: message.id,
          // "Self" is the phone's owner speaking: the user's turns on a persona phone, that
          // character's turns on a character phone.
          from: (isPersona ? message.role === "user" : message.characterId === ownerId)
            ? phone.document.identity.phoneId
            : `${CHAT_THREAD_PREFIX}${chatId}`,
          text: String(messageExtra(message.extra).virtualPhoneText ?? message.content),
          at: message.createdAt,
        }));
      threads.push({
        id: `${CHAT_THREAD_PREFIX}${chatId}`,
        otherPhoneId: `${CHAT_THREAD_PREFIX}${chatId}`,
        otherName,
        unread: 0,
        messages,
         reply: null,
         kind: "chat" as const,
         mode: chat.mode ?? "roleplay",
       });
    }
    return threads;
  };

    app.get<{ Params: { phoneId: string }; Querystring: { chatId?: string } }>("/phones/:phoneId/messaging", async (request, reply) => {
      try {
        const phone = await findPhone(request.params.phoneId);
        const phoneContacts = await Promise.all((await contactsFor(request.params.phoneId)).map(async (contact) => {
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
        const chatId = targetChat(phone, request.query.chatId);
        const storedThreads = await messaging.threadsFor(request.params.phoneId);
        const manualContacts = (await phones.listContacts(request.params.phoneId)).map(({ document }) => ({
          phoneId: contactThreadIds(document).find((id) => storedThreads.some(({ document: thread }) => thread.participants.includes(id))) ?? contactPhoneId(document.contactId),
          ownerName: document.name,
          bio: document.bio,
          aliases: contactThreadIds(document),
        }));
        const contacts = [...phoneContacts, ...manualContacts];
        const names = new Map(contacts.flatMap((contact) => "aliases" in contact
          ? contact.aliases.map((id) => [id, contact.ownerName] as const)
          : [[contact.phoneId, contact.ownerName] as const]));
        const threads = [
          ...await engineThreadsFor(phone),
          ...storedThreads
            .filter(({ document }) => {
              const other = document.participants.find((participant) => participant !== request.params.phoneId) ?? "";
              return !other.startsWith(CONTACT_PHONE_PREFIX) || names.has(other);
            })
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
    // The whole saved library, so Contacts can import a character or persona instead of retyping them.
    app.get<{ Params: { phoneId: string } }>("/phones/:phoneId/library", async (request, reply) => {
      try {
        await findPhone(request.params.phoneId);
        const [characters, personas] = await Promise.all([
          api.runtime.resources.listCharacters().catch(() => []),
          api.runtime.resources.listPersonas().catch(() => []),
        ]);
        const map = (records: Array<{ id: string; data: unknown }>, type: "character" | "persona") => records.map((record) => ({
          id: record.id,
          type,
          name: readName(record.data, type === "persona" ? "Persona" : "Character"),
          bio: readCardText(record.data).split("\n")[0]?.slice(0, 200) ?? "",
        })).filter((entry) => entry.name.trim());
        return { people: [...map(personas, "persona"), ...map(characters, "character")] };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Library unavailable" });
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
        const storedThreads = await messaging.threadsFor(phone.document.identity.phoneId);
        const manualContacts = await Promise.all((await phones.listContacts(phone.document.identity.phoneId)).map(async ({ document }) => {
          // Contacts imported from the library stay live: resolve the current card's name, bio and avatar.
          let live: { name?: string; bio?: string } = {};
          if (document.linkedOwnerId) {
            const records = document.linkedOwnerType === "persona"
              ? await api.runtime.resources.listPersonas([document.linkedOwnerId]).catch(() => [])
              : await api.runtime.resources.listCharacters([document.linkedOwnerId]).catch(() => []);
            if (records[0]) live = { name: readName(records[0].data, document.name), bio: readCardText(records[0].data).split("\n")[0]?.slice(0, 200) || document.bio };
          }
          return {
            id: document.contactId,
            kind: "contact" as const,
            name: live.name ?? document.name,
            handle: document.handle,
            bio: live.bio ?? document.bio,
            phoneLabel: document.phoneLabel,
            source: document.source || "Added in Contacts",
            ...(document.linkedOwnerId ? { ownerId: document.linkedOwnerId } : {}),
            phoneId: contactThreadIds(document).find((id) => storedThreads.some(({ document: thread }) => thread.participants.includes(id))) ?? contactPhoneId(document.contactId),
            aliases: contactThreadIds(document),
          };
        }));
        const names = new Map([
          ...phoneContacts.map((contact) => [contact.phoneId, contact.name] as const),
          ...manualContacts.flatMap((contact) => contact.aliases.map((id) => [id, contact.name] as const)),
        ]);
        const threads = storedThreads
          .filter(({ document }) => {
            const other = document.participants.find((participant) => participant !== phone.document.identity.phoneId) ?? "";
            return !other.startsWith(CONTACT_PHONE_PREFIX) || names.has(other);
          })
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
        const linkedOwnerType = body.linkedOwnerType === "character" || body.linkedOwnerType === "persona" ? body.linkedOwnerType : undefined;
        const linkedOwnerId = linkedOwnerType && typeof body.linkedOwnerId === "string" && body.linkedOwnerId.trim() ? body.linkedOwnerId : undefined;
        const contact = await phones.createContact({
          phoneId: request.params.phoneId,
          chatId,
          name: String(body.name ?? ""),
          handle: String(body.handle ?? ""),
          bio: String(body.bio ?? ""),
          phoneLabel: String(body.phoneLabel ?? ""),
          source: String(body.source ?? (linkedOwnerId ? "Imported from your saved library" : "Added in Contacts")),
          ...(linkedOwnerId ? { linkedOwnerId, linkedOwnerType } : {}),
        });
        const firstMessage = String(body.firstMessage ?? "").trim().slice(0, 400);
        if (firstMessage) {
          const syntheticPhoneId = contactPhoneId(contact.document.contactId);
          const existing = (await messaging.threadsFor(request.params.phoneId))
            .some(({ document }) => contactThreadIds(contact.document).some((id) => document.participants.includes(id)));
          if (!existing) {
            try {
              await messaging.send(syntheticPhoneId, request.params.phoneId, firstMessage);
            } catch (cause) {
              return {
                contact: { id: contact.document.contactId, kind: "contact", ...contact.document, phoneId: syntheticPhoneId },
                warning: cause instanceof Error ? cause.message : "The first message could not be delivered",
              };
            }
          }
        }
        return { contact: { id: contact.document.contactId, kind: "contact", ...contact.document, phoneId: contactPhoneId(contact.document.contactId) } };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Contact could not be added" });
      }
    });
    app.delete<{ Params: { phoneId: string; contactId: string }; Querystring: { chatId?: string } }>("/phones/:phoneId/contacts/:contactId", async (request, reply) => {
      try {
        await chatForPhone(request.params.phoneId, String(request.query.chatId ?? ""));
        await phones.removeContact(request.params.contactId, request.params.phoneId);
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
        // Diagnostic: silently returning fallback hides why generation is empty. Log the cause once here.
        if (!model) { api.runtime.logger?.error(new Error("no model resolved"), "[virtual-phone] goodle search fell back: no generation connection resolved"); return { results: fallback }; }
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
        }) as { title: string; summary: string; items: string[] };
        if (!results.items.length) api.runtime.logger?.error(new Error("empty parse"), `[virtual-phone] goodle search produced no items; model returned: ${JSON.stringify(completion.content).slice(0, 500)}`);
        return { results };
      } catch (error) {
        if (error instanceof Error && error.message === "Phone not found") {
          return reply.status(400).send({ error: error.message });
        }
        api.runtime.logger?.error(error, "[virtual-phone] goodle search threw; returning fallback");
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
      /**
       * The template is chosen from the address before generation, so the same URL is the same kind
       * of place every time it is opened, and the renderer always has a layout it knows. The model
       * may correct it, but only to another kind in the registry.
       */
      const guess = guessSiteKind(url, title, query);
      const template = SITE_TEMPLATES[guess];
      const fallback = {
        site: site || url.split("/")[0] || "goodle.web",
        title: title || "Page unavailable",
        tagline: "",
        kind: guess as string,
        meta: "",
        links: [] as string[],
        sections: ["Offline :: Goodle can't reach this page right now."],
        media: [] as string[],
      };
      try {
        const phone = await findPhone(request.params.phoneId);
        const model = await resolvePhoneModel(phone, "heavy");
        if (!model) return { page: fallback };
        const storyContext = await worldContext(targetChat(phone, request.query.chatId), phone);
        const kinds = Object.keys(SITE_TEMPLATES).join(", ");
        const completion = await model.chatComplete([
          {
            role: "system",
            content: `You render fictional websites on the in-story internet of a roleplay world. Given a URL and page title, produce the full page. Respond with only JSON: {"site":"Site Name","title":"page headline","tagline":"short site tagline","kind":"${guess}","meta":"one short line of context for this kind of page — a byline and date for news, a price range for a shop, member count for a forum, last-updated for reference, a role for a profile","links":["nav label", ...],"sections":["...", ...],"media":["emoji | short caption", ...]} with 3 to 5 nav labels, ${template.sections[0]} to ${template.sections[1]} sections, and ${template.media[0]} to ${template.media[1]} media items.

This page looks like a "${guess}" (${template.label}) page, so each section is ${template.sectionFormat} Keep "kind" as "${guess}" unless the address plainly says otherwise, in which case use one of: ${kinds}.

Media are placeholders for pictures that are not generated yet: each is a single emoji that suits the picture, then " | ", then a caption of eight words or fewer describing what the picture shows — the caption is displayed under it as alt text. For this page they should be ${template.mediaHint}.${template.hero ? " The first media item is the lead image for the page." : ""} A page with no pictures reads as a wall of text, so always include them.

Inside section bodies, wrap two to four names, places, products or events in [[double square brackets]] — they become links to further pages, so choose things a reader would want to follow. If the URL resembles a real-world website, do not reproduce the real site: invent this world's equivalent at that address.${storyContext}${await customInstructions(phone)}`,
          },
          { role: "user", content: `URL: ${url}\nPage title: ${title}\nFound via search: ${query}${site ? `\nThis page belongs to the site "${site}" — keep its name, tagline, and nav consistent.` : ""}` },
        ], { temperature: 0.9, maxTokens: 1800 });
        const page = parseBoundedContent(completion.content, {
          fields: { site: "string", title: "string", tagline: "string", kind: "string", meta: "string", links: "string[]", sections: "string[]", media: "string[]" },
          defaults: fallback,
          limits: { maxString: 1200, maxItems: 12, perField: { site: 80, tagline: 200, kind: 40, meta: 160 } },
        }) as typeof fallback;
        return { page: { ...page, kind: normalizeSiteKind(page.kind, guess) } };
      } catch (error) {
        if (error instanceof Error && error.message === "Phone not found") {
          return reply.status(400).send({ error: error.message });
        }
        return { page: fallback };
      }
    });
    /**
     * Image search. Pictures are not generated yet, so a result is an emoji, a caption and the page
     * it came from — enough to browse and to open the source, which is what the tab is for.
     */
    app.post<{ Params: { phoneId: string }; Querystring: { chatId?: string } }>("/phones/:phoneId/goodle/images", async (request, reply) => {
      const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
        ? request.body as Record<string, unknown>
        : {};
      const query = String(body.query ?? "").trim().slice(0, 120);
      const fallback = { images: [] as string[] };
      if (!query) return fallback;
      try {
        const phone = await findPhone(request.params.phoneId);
        const model = await resolvePhoneModel(phone, "heavy");
        if (!model) return fallback;
        const storyContext = await worldContext(targetChat(phone, request.query.chatId), phone);
        const completion = await model.chatComplete([
          {
            role: "system",
            content: `You are Goodle Images, the picture search of an in-story search engine. Respond with only JSON: {"images":["emoji | what the picture shows | site.web/path", ...]} with 8 to 12 items. Each item is one emoji that suits the picture, a short caption of six words or fewer, and the invented in-world page the picture sits on. Vary the sources.${storyContext}${await customInstructions(phone)}`,
          },
          { role: "user", content: `Image search: ${query}` },
        ], { temperature: 0.9, maxTokens: 700 });
        return parseBoundedContent(completion.content, {
          fields: { images: "string[]" },
          defaults: fallback,
          limits: { maxString: 200, maxItems: 16 },
        }) as { images: string[] };
      } catch (error) {
        if (error instanceof Error && error.message === "Phone not found") {
          return reply.status(400).send({ error: error.message });
        }
        return fallback;
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
         const posted = await noodle.addPosts(chatId, [{
          author: ownerName,
          handle: handleFor(ownerName),
          text,
          ...(image ? { image } : {}),
           ...(parentPostId ? { parentPostId } : {}),
         }]);
         const post = posted.find((candidate) => candidate.author === ownerName && candidate.text === text);
         const generateReplies = async () => {
           // A post is a public action in this world. Give one or two known people a chance to answer
           // it, so Noodle changes the shared social graph rather than only changing local counters.
           if (!parentPostId && post) {
             const model = await resolvePhoneModel(phone, "light");
             if (model) {
               const candidates = (await phones.listContacts(request.params.phoneId)).map(({ document }) => document).slice(0, 4);
               if (candidates.length && !(await noodle.feedFor([chatId])).some((candidate) => candidate.parentPostId === post.id)) {
               const completion = await model.chatComplete([
                 { role: "system", content: `You are the people who know ${ownerName} in a fictional roleplay world. Choose zero, one, or two of these people to reply to their public Noodle post, in their own voice: ${candidates.map((candidate) => `${candidate.name}: ${candidate.bio}`).join("\n")}. Respond only JSON: {"replies":["Name | short reply", ...]}. Do not force a reply.${await worldContext(chatId, phone)}` },
                 { role: "user", content: `Post by ${ownerName}: ${text}` },
               ], { temperature: 0.9, maxTokens: 400 });
               const generated = parseBoundedContent(completion.content, {
                 fields: { replies: "string[]" }, defaults: { replies: [] as string[] }, limits: { maxString: 400, maxItems: 2 },
               }) as { replies: string[] };
               const allowed = new Map(candidates.map((candidate) => [candidate.name.toLocaleLowerCase(), candidate.name]));
               const replies = generated.replies.flatMap((line) => {
                 const [name, ...rest] = line.split(" | ");
                 const author = allowed.get((name ?? "").trim().toLocaleLowerCase());
                 const replyText = rest.join(" | ").trim();
                 return author && replyText ? [{ author, handle: handleFor(author), text: replyText, parentPostId: "pending" }] : [];
               });
               if (replies.length) await noodle.addPosts(chatId, replies.map((reply) => ({ ...reply, parentPostId: post.id })));
             }
           }
           }
         };
          void generateReplies().catch((cause: unknown) => {
            api.runtime.logger?.error(cause, "[virtual-phone] Noodle replies could not be generated");
          });
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
          .concat((await phones.listContacts(request.params.phoneId)).map(({ document }) => `${document.name} ${handleFor(document.name)}`))
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
        const images: string[] = [];
        const seen = new Set<string>();
        /**
         * Engine 2.4.2 hands packages the chat's real images. Before it existed the only way to
         * find a picture was to scrape URLs out of message text, which found whatever a character
         * happened to paste and nothing the Engine actually generated. That scrape stays as the
         * fallback for older Engines and for pasted links.
         */
        if (api.runtime.persistence.listChatImages) {
          for (const chatId of phone.document.identity.chatScope) {
            for (const image of await api.runtime.persistence.listChatImages(chatId).catch(() => [])) {
              if (image.url && !seen.has(image.url)) {
                seen.add(image.url);
                images.push(image.url);
              }
            }
          }
        }
        if (!api.runtime.persistence.listMessages) return { images: images.slice(0, 60) };
        // Scraped URLs come out of the transcript oldest-first, so they are reversed on their own
        // before being appended: listChatImages already arrives newest-first.
        const scraped: string[] = [];
        for (const chatId of phone.document.identity.chatScope) {
          for (const message of await api.runtime.persistence.listMessages(chatId)) {
            for (const url of extractImageUrls(message.content)) {
              if (!seen.has(url)) {
                seen.add(url);
                scraped.push(url);
              }
            }
          }
        }
        images.push(...scraped.reverse());
        return { images: images.slice(0, 60) };
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
        const manualContact = (await phones.listContacts(request.params.phoneId)).find(({ document }) => document.contactId === creatorPhoneId)?.document;
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
        // Pregen may have stored an in-character inbox; serve that instead of a fresh batch.
        const seeded = await phones.getAppContent<string[]>(request.params.phoneId, "mail").catch(() => null);
        if (seeded && seeded.length) return { emails: seeded };
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
        const phone = await findPhone(phoneId);
        const chatId = targetChat(phone, request.query.chatId);
        const manualContacts = await phones.listContacts(phoneId);
        const names = new Map([
          ...contacts.map((contact) => [contact.phoneId, contact.ownerName] as const),
          ...manualContacts.flatMap(({ document }) => contactThreadIds(document).map((id) => [id, document.name] as const)),
        ]);
        const extra: Array<{ id: string; appId: string; title: string; body: string; count: number; at: string }> = [];

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
          const otherPhoneId = document.participants.find((participant) => participant !== phoneId) ?? "";
          if (otherPhoneId.startsWith(CONTACT_PHONE_PREFIX) && !names.has(otherPhoneId)) return [];
          const unread = unreadMessages(document, phoneId);
          const last = unread.at(-1);
          if (!last) return [];
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
    app.post<{ Params: { phoneId: string }; Querystring: { chatId?: string } }>("/phones/:phoneId/messaging/send", async (request, reply) => {
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
            extra: { virtualPhone: "text", virtualPhoneText: text, virtualPhoneId: phone.document.identity.phoneId },
            createdAt: new Date().toISOString(),
          });
          const [thread] = (await engineThreadsFor(phone)).filter((candidate) => candidate.id === toPhoneId);
          return { thread };
        }
        const phone = await findPhone(request.params.phoneId);
        const chatId = targetChat(phone, request.query.chatId);
        const phoneContacts = await contactsFor(request.params.phoneId);
        const manualContacts = await phones.listContacts(request.params.phoneId);
        const manualContactId = contactIdFromPhone(toPhoneId);
        const manualContact = manualContactId
          ? manualContacts.find(({ document }) => document.contactId === manualContactId)
          : null;
        if (!phoneContacts.some((contact) => contact.phoneId === toPhoneId) && !manualContact) {
          return reply.status(400).send({ error: "That phone cannot be messaged from this chat" });
        }
        const thread = await messaging.send(request.params.phoneId, toPhoneId, String(body.text ?? ""));
        const names = new Map([
          ...phoneContacts.map((contact) => [contact.phoneId, contact.ownerName] as const),
          ...manualContacts.flatMap(({ document }) => contactThreadIds(document).map((id) => [id, document.name] as const)),
        ]);
        // The send returns as soon as the message is stored. Waiting on the model here made the
        // send button hang for the length of a completion on a slow connection. The reply lands in
        // the thread asynchronously and the client's poll picks it up.
        const pending = await messaging.setReplyState(thread.record.id, { status: "pending", at: new Date().toISOString() })
          .catch(() => thread);
        const generateReply = manualContact
          ? generateContactReply(request.params.phoneId, manualContact.document.contactId, chatId!)
          : generateCharacterReply(request.params.phoneId, toPhoneId);
        void generateReply
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
    app.post<{ Params: { phoneId: string }; Querystring: { chatId?: string } }>("/phones/:phoneId/messaging/read", async (request, reply) => {
      try {
        const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
          ? request.body as Record<string, unknown>
          : {};
        const phone = await findPhone(request.params.phoneId);
        const chatId = targetChat(phone, request.query.chatId);
        if (!chatId) return reply.status(400).send({ error: "This phone is not part of a chat" });
        const threadId = String(body.threadId ?? "");
        const candidate = (await messaging.threadsFor(request.params.phoneId)).find(({ record }) => record.id === threadId);
        const other = candidate?.document.participants.find((participant) => participant !== request.params.phoneId) ?? "";
        const manualContactId = contactIdFromPhone(other);
        if (manualContactId && !(await phones.listContacts(request.params.phoneId)).some(({ document }) => document.contactId === manualContactId)) {
          return reply.status(400).send({ error: "That contact is not on this phone" });
        }
        const thread = await messaging.markRead(threadId, request.params.phoneId);
        const names = new Map([
          ...(await contactsFor(request.params.phoneId)).map((contact) => [contact.phoneId, contact.ownerName] as const),
          ...(await phones.listContacts(request.params.phoneId)).flatMap(({ document }) => contactThreadIds(document).map((id) => [id, document.name] as const)),
        ]);
        return { thread: threadPayload(thread.record.id, thread.document, request.params.phoneId, names) };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Invalid messaging request" });
      }
    });
    // Feeds the Lorebooks picker in phone Settings. Optional on the runtime, so an older Engine
    // simply reports none available and the picker says so.
    /**
     * The lorebook picker. It used to list every lorebook in the installation with no indication of
     * which had anything to do with this story, which is a poor way to choose what grounds a phone.
     * Books in the chat come back first with the reason they qualify; everything else is still
     * offered, but separately, because attaching an unrelated world to one phone is a real use.
     */
    app.get<{ Querystring: { phoneId?: string } }>("/lorebooks", async (request) => {
      if (!api.runtime.resources.listLorebooks) return { lorebooks: [], others: [], supported: false };
      const phone = request.query.phoneId ? await findPhone(request.query.phoneId).catch(() => null) : null;
      const books = await lorebooksForChat(phone ? targetChat(phone) : undefined);
      return {
        supported: true,
        lorebooks: books.filter((book) => book.scope !== null),
        others: books.filter((book) => book.scope === null).map(({ id, name }) => ({ id, name, scope: null })),
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
        const manual = (await phones.listContacts(request.params.phoneId)).find(({ document }) =>
          document.name.toLowerCase() === to.toLowerCase());
        const recipientPhone = contact ? await findPhone(contact.phoneId) : null;
        const storyContext = await worldContext(chatId, phone);
        const modeInstruction = await modeInstructionFor(chatId);
        const completion = await model.chatComplete([
          {
            role: "system",
             content: `You are ${recipientPhone ? recipientPhone.document.identity.ownerName : manual ? manual.document.name : `whoever reads mail sent to "${to}" in this fictional world — a person, a company's support desk, or an automated system, whichever fits`}, replying to an email from ${phone.document.identity.ownerName} inside a roleplay story. ${modeInstruction} Write the reply they would actually send: it may be warm, curt, boilerplate, an auto-responder, or a refusal. Respond with only JSON: {"from":"sender name","subject":"reply subject","body":"the reply"}. If nobody would reply to this, respond with {"from":"","subject":"","body":""}.${recipientPhone ? await ownerCard(recipientPhone, "About the recipient") : manual?.document.bio ? `\n\nAbout the recipient:\n${manual.document.bio}` : ""}${storyContext}${await customInstructions(phone)}`,
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
    app.post<{ Params: { phoneId: string } }>("/phones/:phoneId/wallet/move", async (request, reply) => {
      try {
        const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
          ? request.body as Record<string, unknown>
          : {};
        const amount = Math.trunc(Number(body.amount));
        const description = String(body.description ?? "").trim().slice(0, 200);
        const transactionId = String(body.transactionId ?? "").trim().slice(0, 200);
        if (!Number.isFinite(amount) || amount === 0) return reply.status(400).send({ error: "A non-zero wallet amount is required" });
        if (!transactionId) return reply.status(400).send({ error: "A wallet transaction ID is required" });
        const priorResult = (value: unknown) => {
          const account = readAccount(value);
          return account.transactions.some((entry) => entry.id === transactionId)
            ? { account, insufficient: false }
            : null;
        };
        const result = await phones.mutateAppStorageKey(request.params.phoneId, "banking", "account", (value) => {
          const account = readAccount(value);
          if (account.transactions.length === 0 && account.balance === 0) {
            return { value, result: { account: null, insufficient: false } };
          }
          if (amount < 0 && account.balance < Math.abs(amount)) {
            return { value, result: { account, insufficient: true } };
          }
          const updated = applyTransaction(account, {
            id: transactionId, at: new Date().toISOString(), amount,
            description: description || "Phone purchase", source: "user",
          });
          return { value: updated, result: { account: updated, insufficient: false } };
        }, priorResult);
        return result;
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "The wallet could not be updated" });
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
        const seeded = await phones.getAppContent<string[]>(request.params.phoneId, "marketplace").catch(() => null);
        if (seeded && seeded.length) return { listings: seeded };
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
    /**
     * Messaging a seller. A marketplace you can only read is a classifieds column — the point is
     * that you can haggle, ask whether it still runs, and be told no. The seller may move on price;
     * whether the user accepts is theirs to decide.
     */
    app.post<{ Params: { phoneId: string }; Querystring: { chatId?: string } }>("/phones/:phoneId/marketplace/message", async (request, reply) => {
      try {
        const phone = await findPhone(request.params.phoneId);
        const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
          ? request.body as Record<string, unknown>
          : {};
        const seller = String(body.seller ?? "").slice(0, 120);
        const item = String(body.item ?? "").slice(0, 200);
        const price = String(body.price ?? "").slice(0, 60);
        const history = String(body.history ?? "").slice(0, 2000);
        const text = String(body.text ?? "").trim().slice(0, 800);
        if (!text) return reply.status(400).send({ error: "Say something first" });
        const model = await resolvePhoneModel(phone, "light");
        if (!model) return { reply: "", offer: 0 };
        const storyContext = await worldContext(targetChat(phone, request.query.chatId), phone);
        const completion = await model.chatComplete([
          {
            role: "system",
            content: `You are ${seller}, selling "${item}" for ${price} in the classifieds of a fictional roleplay world. ${phone.document.identity.ownerName} is messaging you about it. Reply in character and briefly, the way someone selling their own stuff replies — helpful, cagey, rude, or desperate, whichever fits. You may hold your price, drop it, or refuse to sell. Respond with only JSON: {"reply":"your message","offer":number} where offer is the price you would now accept as a plain number, or 0 if you are not moving or not selling.${storyContext}${await customInstructions(phone)}`,
          },
          { role: "user", content: `${history ? `${history}\n\n` : ""}${phone.document.identity.ownerName}: ${text}` },
        ], { temperature: 0.9, maxTokens: 400 });
        const answer = parseBoundedContent(completion.content, {
          fields: { reply: "string", offer: "number" },
          defaults: { reply: "", offer: 0 },
          limits: { maxString: 700 },
        }) as { reply: string; offer: number };
        return { reply: answer.reply, offer: Math.max(0, Math.round(answer.offer)) };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "The seller could not be reached" });
      }
    });

    /**
     * Selling your own thing. The world answers with an interested buyer and what they will pay —
     * accepting is what turns the phone into a way of earning money rather than only spending it.
     */
    app.post<{ Params: { phoneId: string }; Querystring: { chatId?: string } }>("/phones/:phoneId/marketplace/interest", async (request, reply) => {
      try {
        const phone = await findPhone(request.params.phoneId);
        const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
          ? request.body as Record<string, unknown>
          : {};
        const title = String(body.title ?? "").slice(0, 200);
        const price = String(body.price ?? "").slice(0, 60);
        const description = String(body.description ?? "").slice(0, 800);
        const model = await resolvePhoneModel(phone, "light");
        if (!model) return { buyer: "", amount: 0, message: "" };
        const storyContext = await worldContext(targetChat(phone, request.query.chatId), phone);
        const completion = await model.chatComplete([
          {
            role: "system",
            content: `${phone.document.identity.ownerName} has listed "${title}" for ${price} in the classifieds of a fictional roleplay world. Invent one person from this world who replies about it, and what they would actually pay — they may lowball, haggle, or offer the asking price. Respond with only JSON: {"buyer":"their name","amount":number,"message":"what they say"}. If nobody in this world would want it, respond with {"buyer":"","amount":0,"message":""}.${description ? `\n\nThe listing says: ${description}` : ""}${storyContext}${await customInstructions(phone)}`,
          },
          { role: "user", content: "Who is interested?" },
        ], { temperature: 1, maxTokens: 400 });
        const answer = parseBoundedContent(completion.content, {
          fields: { buyer: "string", amount: "number", message: "string" },
          defaults: { buyer: "", amount: 0, message: "" },
          limits: { maxString: 600, perField: { buyer: 120 } },
        }) as { buyer: string; amount: number; message: string };
        return { buyer: answer.buyer, amount: Math.max(0, Math.round(answer.amount)), message: answer.message };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Nobody answered the listing" });
      }
    });
    app.post<{ Params: { phoneId: string }; Querystring: { chatId?: string } }>("/phones/:phoneId/azmoron/search", async (request, reply) => {
      try {
        const phone = await findPhone(request.params.phoneId);
        const body = request.body && typeof request.body === "object" && !Array.isArray(request.body) ? request.body as Record<string, unknown> : {};
        const query = String(body.query ?? "").trim().slice(0, 160);
        const model = await resolvePhoneModel(phone, "heavy");
        if (!model) return { products: [] };
        const chatId = targetChat(phone, request.query.chatId);
        const completion = await model.chatComplete([
          { role: "system", content: `You are Azmoron, the in-world marketplace for a fictional roleplay setting. Generate 4 to 8 plausible products for the search "${query || "things worth buying"}". Make sellers distinct people or shops from this world, and make some products useful, suspicious, sentimental, or story-relevant. Respond only JSON: {"products":["Seller | price as a whole number | product name | one or two sentence detail", ...]}. Do not use real-world brands.${await worldContext(chatId, phone)}${await customInstructions(phone)}` },
          { role: "user", content: query || "Show me what is available." },
        ], { temperature: 1, maxTokens: 1100 });
        const result = parseBoundedContent(completion.content, { fields: { products: "string[]" }, defaults: { products: [] as string[] }, limits: { maxString: 700, maxItems: 12 } }) as { products: string[] };
        return { products: result.products };
      } catch (error) { return reply.status(400).send({ error: error instanceof Error ? error.message : "Azmoron could not be reached" }); }
    });
    app.post<{ Params: { phoneId: string }; Querystring: { chatId?: string } }>("/phones/:phoneId/maps/search", async (request, reply) => {
      try {
        const phone = await findPhone(request.params.phoneId);
        const body = request.body && typeof request.body === "object" && !Array.isArray(request.body) ? request.body as Record<string, unknown> : {};
        const query = String(body.query ?? "").trim().slice(0, 160);
        const model = await resolvePhoneModel(phone, "heavy");
        if (!model) return { places: [] };
        const chatId = targetChat(phone, request.query.chatId);
        const completion = await model.chatComplete([
          { role: "system", content: `You are the Maps app in a fictional roleplay world. For the search "${query || "what's nearby"}", list 4 to 7 real-feeling places that fit this world. Respond only JSON: {"places":["Place name | category | one short line on what it is or who runs it", ...]}. Category is a single word like cafe, harbour, shop, park, home, bar. Reuse places and people already established in this world where they fit.${await worldContext(chatId, phone)}${await customInstructions(phone)}` },
          { role: "user", content: query || "What is around here?" },
        ], { temperature: 0.9, maxTokens: 900 });
        const result = parseBoundedContent(completion.content, { fields: { places: "string[]" }, defaults: { places: [] as string[] }, limits: { maxString: 400, maxItems: 12 } }) as { places: string[] };
        return { places: result.places };
      } catch (error) { return reply.status(400).send({ error: error instanceof Error ? error.message : "Maps could not be reached" }); }
    });
    app.post<{ Params: { phoneId: string }; Querystring: { chatId?: string } }>("/phones/:phoneId/find/locate", async (request, reply) => {
      try {
        const phone = await findPhone(request.params.phoneId);
        const model = await resolvePhoneModel(phone, "heavy");
        const names = [...(await directoryFor(phone)).keys()].slice(0, 12);
        if (!model || names.length === 0) return { people: [] };
        const chatId = targetChat(phone, request.query.chatId);
        const completion = await model.chatComplete([
          { role: "system", content: `You are Find, the friend-locator app in a fictional roleplay world. For each named person, say where they plausibly are right now and what they are doing, consistent with this story. Respond only JSON: {"people":["Name | place | short status", ...]}, one entry per given name, using those exact names.${await worldContext(chatId, phone)}${await customInstructions(phone)}` },
          { role: "user", content: `People to locate: ${names.join(", ")}` },
        ], { temperature: 0.9, maxTokens: 900 });
        const result = parseBoundedContent(completion.content, { fields: { people: "string[]" }, defaults: { people: [] as string[] }, limits: { maxString: 300, maxItems: 14 } }) as { people: string[] };
        return { people: result.people };
      } catch (error) { return reply.status(400).send({ error: error instanceof Error ? error.message : "Find could not be reached" }); }
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
    // Wipe pregenerated content + cached profile and rebuild from scratch. Returns immediately; the
    // work runs in the background so the button doesn't hang on a batch of model calls.
    app.post<{ Params: { phoneId: string }; Querystring: { chatId?: string } }>("/phones/:phoneId/pregenerate", async (request, reply) => {
      try {
        await phones.clearGenerated(request.params.phoneId);
        void pregeneratePhone(request.params.phoneId, request.query.chatId).catch((cause) =>
          api.runtime.logger?.error(cause, "[virtual-phone] regeneration failed"));
        return { started: true };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Unable to regenerate phone" });
      }
    });
  };
  const releases: Array<() => void> = [];

  /**
   * The story finally hears about the phone. Registration is optional so the package still runs on
   * the Engine versions that predate the capability — it simply stays silent there, which is what
   * it did everywhere before 2.4.2.
   */
  if (api.registerPromptContext) {
    releases.push(api.registerPromptContext(async ({ chatId, targetCharacterIds }) => {
      try {
        const state = await turnPhoneStates(chatId, targetCharacterIds);
        return buildTurnContext(state.phones, state.scene);
      } catch (error) {
        api.runtime.logger?.error(error, "[virtual-phone] prompt context failed; the turn continues without it");
        return null;
      }
    }));
  }
  if (api.registerConversationCommand) {
    releases.push(api.registerConversationCommand({
      commandType: PHONE_COMMAND_TAG,
      tags: [PHONE_COMMAND_TAG],
      maxPayloadChars: 1_200,
      description: "Use when you want to send a message from your character's Phone to a known contact. Do not use it for ordinary spoken dialogue.",
      payloadExample: '{"action":"send_message","contactId":"CONTACT_PHONE_ID","body":"short message"}',
      validatePayload: (payload) => {
        if (!payload) return false;
        try {
          const value = JSON.parse(payload) as Record<string, unknown>;
          return value.action === "send_message" && typeof value.contactId === "string"
            && typeof value.body === "string" && value.body.trim().length > 0 && value.body.length <= 500;
        } catch {
          return false;
        }
      },
      handler: async ({ payload, chatId, characterId, sourceMessageId, swipeIndex, branchChatId }) => {
        if (!payload || !characterId) return;
        let action: { action?: unknown; contactId?: unknown; body?: unknown };
        try {
          const parsed = JSON.parse(payload) as unknown;
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
          action = parsed as typeof action;
        } catch {
          return;
        }
        if (action.action !== "send_message" || typeof action.contactId !== "string" || typeof action.body !== "string") return;
        const phone = (await phones.list()).find(({ document }) =>
          document.provisioning.enabled
          && document.identity.ownerType === "character"
          && document.identity.ownerId === characterId
          && document.identity.chatScope.includes(chatId));
        if (!phone) return;
        const contact = (await phones.listContacts(phone.document.identity.phoneId)).find(({ document }) =>
          document.phoneId === action.contactId || document.source === action.contactId);
        if (!contact) return;
        await messaging.send(phone.document.identity.phoneId, contact.document.phoneId, action.body);
        await api.runtime.persistence.appendRoleplayEvent?.({
          id: randomUUID(),
          chatId: branchChatId,
          messageId: sourceMessageId,
          swipeIndex,
          sourcePackageId: "virtual-phone",
          eventType: "phone.message.sent",
          subjectCharacterIds: [characterId],
          audience: { characterIds: [characterId] },
          text: `${phone.document.identity.ownerName}'s Phone sends a message to ${contact.document.name}.`,
          data: { contactId: contact.document.phoneId },
          createdAt: new Date().toISOString(),
          idempotencyKey: `${branchChatId}:${sourceMessageId}:${swipeIndex}:phone.message.sent`,
        });
      },
    }));
  }

  // If route registration fails the package is not active, so the contributor and the command must
  // not stay in the Engine's registries — a live contributor for a dead package would be called on
  // every turn forever.
  let releaseRoutes: () => Promise<void> | void;
  try {
    releaseRoutes = await api.registerPrivilegedRoutes(routes, { prefix: "/api/virtual-phone" });
  } catch (error) {
    for (const release of releases.reverse()) release();
    throw error;
  }
  return async () => {
    for (const release of releases.reverse()) release();
    await releaseRoutes();
  };
}

export function projectConversationTexts<T extends { role: string; extra: unknown }>(messages: T[]) {
  const projected: T[] = [];
  let awaitingReply = false;
  for (const message of messages) {
    const extra = typeof message.extra === "string" ? (() => {
      try {
        const parsed = JSON.parse(message.extra) as unknown;
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
      } catch {
        return {};
      }
    })() : message.extra && typeof message.extra === "object" ? message.extra as Record<string, unknown> : {};
    if (extra.virtualPhone === "text") {
      projected.push(message);
      awaitingReply = true;
      continue;
    }
    if (message.role === "user" || message.role === "system" || message.role === "narrator") {
      awaitingReply = false;
      continue;
    }
    if (awaitingReply && message.role === "assistant") projected.push(message);
  }
  return projected;
}

export async function selfCheck({ api }: CapabilityContext) {
  if (!api.runtime.persistence.documents) throw new Error("Virtual Phone persistence is unavailable");
}
