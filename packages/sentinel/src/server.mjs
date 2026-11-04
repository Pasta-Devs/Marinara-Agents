// Sentinel — look at and act on places and people outside the scene.
// One model call per look or butler order. Results are stored per chat and
// handed to the narrator through prompt context, so later scenes agree with them.

const PACKAGE_ID = "sentinel";
const STATE_KIND = "chat-state";
const MAX_LOG = 200;
const MAX_FACTS_IN_PROMPT = 24;
const RECENT_CHAT_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 1200;
const MAX_NAME = 60;
const MAX_ORDER = 300;
const LLM_MAX_TOKENS = 600;

export const PLAY_STYLES = Object.freeze({
  parent: {
    butler: "House AI",
    senses: { look: "Peek in", listen: "Baby monitor", sensor: "Door sensor", locate: "Find phone" },
    suggestions: [
      { name: "Kid's room", kind: "place", privacy: "private" },
      { name: "Front door", kind: "place", privacy: "open" },
      { name: "Living room", kind: "place", privacy: "open" },
      { name: "Bathroom", kind: "place", privacy: "off-limits" },
    ],
  },
  business: {
    butler: "Shop system",
    senses: { look: "Camera", listen: "Intercom", sensor: "Till log", locate: "Staff phone" },
    suggestions: [
      { name: "Shop floor", kind: "place", privacy: "open" },
      { name: "Till", kind: "device", privacy: "open" },
      { name: "Back door", kind: "place", privacy: "open" },
      { name: "Staff toilet", kind: "place", privacy: "off-limits" },
    ],
  },
  generic: {
    butler: "Butler",
    senses: { look: "Camera", listen: "Microphone", sensor: "Sensor", locate: "Locate" },
    suggestions: [],
  },
});

const SENSES = ["look", "listen", "sensor", "locate"];
const KINDS = ["person", "place", "device"];
const PRIVACY = ["open", "private", "off-limits"];

// ponytail: word list only catches obvious slips; the prompt carries the real rule. Upgrade to a classifier call if users report leaks.
const PRIVATE_BLOCKLIST =
  /\b(naked|nude|undress\w*|underwear|lingerie|bra|panties|breasts?|nipples?|genitals?|sex\w*|aroused|masturbat\w*|shower\w*|bathing)\b/i;

export function emptyState() {
  return { style: "generic", butlerName: "", acting: true, storyLooks: true, subjects: [], log: [] };
}

function cleanText(value, max) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

export function effectivePrivacy(subject) {
  if (subject.privacy === "off-limits") return "off-limits";
  return subject.minor || subject.privacy === "private" ? "private" : "open";
}

export function normalizeSubject(input, id) {
  const name = cleanText(input?.name, MAX_NAME);
  if (!name) return null;
  return {
    id,
    name,
    kind: KINDS.includes(input.kind) ? input.kind : "place",
    privacy: PRIVACY.includes(input.privacy) ? input.privacy : "private",
    minor: input.minor === true,
  };
}

// Entries anchored to messages that no longer exist (rewind, delete) are dropped.
export function liveLog(log, messageIds) {
  if (!messageIds) return log;
  const ids = new Set(messageIds);
  return log.filter((entry) => !entry.messageId || ids.has(entry.messageId));
}

// Later entries override earlier values for the same thing.
export function currentFacts(log) {
  const facts = new Map();
  for (const entry of log) {
    for (const fact of entry.facts || []) facts.set(fact.thing.toLowerCase(), fact);
  }
  return [...facts.values()];
}

export function privacyFilter(text, privacy, subjectName) {
  if (privacy !== "private" || !PRIVATE_BLOCKLIST.test(text)) return text;
  return `${subjectName}: someone is there. You keep it to presence and activity.`;
}

export function parseResult(raw, parseJsonish, kind) {
  let data = null;
  try {
    data = parseJsonish ? parseJsonish(raw) : JSON.parse(raw);
  } catch {
    data = null;
  }
  if (!data || typeof data !== "object") return null;
  const text = cleanText(data.text, 600);
  if (!text) return null;
  const facts = (Array.isArray(data.facts) ? data.facts : [])
    .map((fact) => ({ thing: cleanText(fact?.thing, 60), value: cleanText(fact?.value, 120) }))
    .filter((fact) => fact.thing && fact.value)
    .slice(0, 6);
  const result = { text, facts };
  if (kind === "act") result.outcome = ["done", "partly", "no"].includes(data.outcome) ? data.outcome : "done";
  return result;
}

const RULES = [
  "You are Sentinel, a tool inside a fictional roleplay. You decide what is true outside the current scene.",
  "Fit the recent chat and the known facts. Never contradict a known fact unless the chat since then changed it.",
  "Write plain, concrete, short in-world text (1-3 sentences). No commentary about being an AI.",
  "Privacy 'private': presence and activity only. Never describe bodies, clothing, nudity or anything intimate.",
  'Answer only with JSON: {"text": string, "facts": [{"thing": string, "value": string}]}.',
].join("\n");

export function buildLookMessages({ style, subject, sense, chat, facts }) {
  const skin = PLAY_STYLES[style]?.senses[sense] || sense;
  const user = {
    task: `The user's character uses "${skin}" (${sense}) on ${subject.kind} "${subject.name}". Say what they notice right now.`,
    privacy: effectivePrivacy(subject),
    knownFacts: facts,
    recentChat: chat,
  };
  return [
    { role: "system", content: RULES },
    { role: "user", content: JSON.stringify(user) },
  ];
}

export function buildActMessages({ style, butlerName, order, subject, chat, facts }) {
  const name = butlerName || PLAY_STYLES[style]?.butler || "Butler";
  const user = {
    task: `The user's character tells ${name} (the in-world assistant): "${order}". Decide what happens in a way that fits the setting. If it is impossible, say why in-world. Add an "outcome" field: "done", "partly" or "no". List the facts that changed.`,
    target: subject ? { name: subject.name, kind: subject.kind, privacy: effectivePrivacy(subject) } : null,
    replyStyle: `${name} replies briefly, in-world.`,
    knownFacts: facts,
    recentChat: chat,
  };
  return [
    { role: "system", content: RULES },
    { role: "user", content: JSON.stringify(user) },
  ];
}

const LOOK_WORDS =
  /\b(look|looks|looking|peek|peeks|check|checks|checking|open|opens|watch|watches|listen|listens|glance|glances|camera|cam|monitor)\b/i;

// Subjects named in the user's newest message together with a looking word.
export function storyLookSubjects(text, subjects) {
  if (!text || !LOOK_WORDS.test(text)) return [];
  const lower = text.toLowerCase();
  return subjects.filter((subject) => effectivePrivacy(subject) !== "off-limits" && lower.includes(subject.name.toLowerCase()));
}

// Text for the narrator: new results since the last reply, story looks, and known facts.
export function buildPromptText(state, messages) {
  const list = Array.isArray(messages) ? messages : [];
  const log = liveLog(state.log, messages ? list.map((message) => message.id) : null);
  const index = new Map(list.map((message, i) => [message.id, i]));
  let lastAssistant = -1;
  list.forEach((message, i) => {
    if (message.role === "assistant") lastAssistant = i;
  });
  const fresh = log.filter((entry) => (index.has(entry.messageId) ? index.get(entry.messageId) : -1) >= lastAssistant);
  const lines = [];
  for (const entry of fresh) {
    lines.push(
      entry.kind === "act"
        ? `- The user's character ordered "${entry.order}". Result (${entry.outcome}): ${entry.text}`
        : `- The user's character checked ${entry.subjectName}: ${entry.text}`,
    );
  }
  const latestUser = list.slice(lastAssistant + 1).filter((message) => message.role === "user").pop();
  const looked = state.storyLooks ? storyLookSubjects(latestUser?.content, state.subjects) : [];
  for (const subject of looked) {
    const privacy = effectivePrivacy(subject);
    lines.push(
      `- In the story the user's character checks on ${subject.name}. Keep it consistent with the facts below.${privacy === "private" ? " Presence and activity only, nothing intimate." : ""}`,
    );
  }
  const facts = currentFacts(log).slice(-MAX_FACTS_IN_PROMPT);
  if (!lines.length && !facts.length) return "";
  const out = ["Sentinel: what the user's character knows about places and people outside the scene. Treat it as true."];
  if (lines.length) out.push("New:", ...lines);
  if (facts.length) out.push("Known facts:", ...facts.map((fact) => `- ${fact.thing}: ${fact.value}`));
  return out.join("\n");
}

function recentChat(messages) {
  return messages.slice(-RECENT_CHAT_MESSAGES).map((message) => ({
    role: message.role,
    text: String(message.content || "").slice(0, MAX_MESSAGE_CHARS),
  }));
}

function isAgentActive(chatMeta) {
  if (!chatMeta || chatMeta.enableAgents !== true) return false;
  return Array.isArray(chatMeta.activeAgentIds) && chatMeta.activeAgentIds.includes(PACKAGE_ID);
}

export async function activate(context) {
  const { api } = context;
  const runtime = api.runtime;
  const { persistence, logger } = runtime;
  const { documents } = persistence;

  const docId = (chatId) => `chat:${chatId}`;

  async function loadDoc(chatId) {
    const doc = await documents.getById(PACKAGE_ID, docId(chatId));
    return { doc, state: { ...emptyState(), ...(doc?.data || {}), chatId } };
  }

  async function saveState(chatId, doc, state) {
    const now = new Date().toISOString();
    const data = { ...state, chatId, log: state.log.slice(-MAX_LOG) };
    if (doc) {
      await documents.update({
        id: doc.id,
        packageId: PACKAGE_ID,
        expectedRevision: doc.revision,
        name: doc.name,
        description: doc.description,
        data,
        updatedAt: now,
      });
    } else {
      await documents.create({
        id: docId(chatId),
        packageId: PACKAGE_ID,
        kind: STATE_KIND,
        name: `Sentinel ${chatId}`,
        description: "Sentinel subjects and log for one chat",
        data,
        createdAt: now,
        updatedAt: now,
      });
    }
    return data;
  }

  async function update(chatId, change) {
    return persistence.withChatLock(chatId, async () => {
      const { doc, state } = await loadDoc(chatId);
      const result = await change(state);
      if (result?.error) return result;
      return { state: await saveState(chatId, doc, state), ...result };
    });
  }

  async function listMessages(chatId) {
    if (typeof persistence.listMessages !== "function") return null;
    return persistence.listMessages(chatId);
  }

  async function callModel(chatId, messages) {
    const chat = await persistence.getChat(chatId);
    const agentConfig = typeof runtime.getAgentConfig === "function" ? await runtime.getAgentConfig() : null;
    let model;
    try {
      model = await runtime.languageModels.resolveForRequest({
        connectionId: agentConfig?.connectionId ?? null,
        chatConnectionId: chat?.connectionId ?? null,
      });
    } catch (error) {
      logger?.warn?.("[sentinel] no model connection: %s", error instanceof Error ? error.message : String(error));
      return { error: "no-connection" };
    }
    try {
      const result = await model.chatComplete(messages, { temperature: 0.7, maxTokens: LLM_MAX_TOKENS });
      return { raw: typeof result.content === "string" ? result.content : "" };
    } catch (error) {
      logger?.warn?.("[sentinel] model call failed: %s", error instanceof Error ? error.message : String(error));
      return { error: "generation-failed" };
    }
  }

  async function runCall(chatId, buildMessages, kind, entryBase, privacy, subjectName) {
    const { state } = await loadDoc(chatId);
    const messages = (await listMessages(chatId)) || [];
    const log = liveLog(state.log, messages.map((message) => message.id));
    const call = await callModel(chatId, buildMessages(state, recentChat(messages), currentFacts(log)));
    if (call.error) return { error: call.error, status: 502 };
    const parsed = parseResult(call.raw, runtime.json?.parseJsonish, kind);
    if (!parsed) return { error: "bad-output", status: 502 };
    parsed.text = privacyFilter(parsed.text, privacy, subjectName);
    const entry = {
      id: `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      kind,
      ...entryBase,
      ...parsed,
      messageId: messages.length ? messages[messages.length - 1].id : null,
      at: new Date().toISOString(),
    };
    return update(chatId, (fresh) => {
      fresh.log = [...liveLog(fresh.log, messages.map((message) => message.id)), entry];
      return { entry };
    });
  }

  const releaseRoutes = await api.registerPrivilegedRoutes(
    async (routes) => {
      routes.get("/chats/:chatId/state", async (request) => {
        const { chatId } = request.params;
        const { state } = await loadDoc(chatId);
        const messages = await listMessages(chatId);
        const log = liveLog(state.log, messages ? messages.map((message) => message.id) : null);
        return { state: { ...state, log }, facts: currentFacts(log), styles: PLAY_STYLES };
      });

      routes.put("/chats/:chatId/settings", async (request) => {
        const body = request.body ?? {};
        return update(request.params.chatId, (state) => {
          if (PLAY_STYLES[body.style]) state.style = body.style;
          if (typeof body.butlerName === "string") state.butlerName = cleanText(body.butlerName, MAX_NAME);
          if (typeof body.acting === "boolean") state.acting = body.acting;
          if (typeof body.storyLooks === "boolean") state.storyLooks = body.storyLooks;
        });
      });

      routes.post("/chats/:chatId/subjects", async (request, reply) => {
        const body = request.body ?? {};
        const result = await update(request.params.chatId, (state) => {
          const id = typeof body.id === "string" && body.id ? body.id : `s${Date.now().toString(36)}`;
          const subject = normalizeSubject(body, id);
          if (!subject) return { error: "Name is required" };
          const at = state.subjects.findIndex((existing) => existing.id === id);
          if (at >= 0) state.subjects[at] = subject;
          else state.subjects.push(subject);
        });
        if (result.error) return reply.status(400).send({ error: result.error });
        return result;
      });

      routes.delete("/chats/:chatId/subjects/:subjectId", async (request) =>
        update(request.params.chatId, (state) => {
          state.subjects = state.subjects.filter((subject) => subject.id !== request.params.subjectId);
        }),
      );

      routes.post("/chats/:chatId/look", async (request, reply) => {
        const { chatId } = request.params;
        const body = request.body ?? {};
        const { state } = await loadDoc(chatId);
        const subject = state.subjects.find((item) => item.id === body.subjectId);
        if (!subject) return reply.status(404).send({ error: "Unknown subject" });
        if (!SENSES.includes(body.sense)) return reply.status(400).send({ error: "Unknown sense" });
        const privacy = effectivePrivacy(subject);
        if (privacy === "off-limits") return reply.status(403).send({ error: "This place is off-limits" });
        const result = await runCall(
          chatId,
          (current, chat, facts) => buildLookMessages({ style: current.style, subject, sense: body.sense, chat, facts }),
          "look",
          { subjectId: subject.id, subjectName: subject.name, sense: body.sense },
          privacy,
          subject.name,
        );
        if (result.error) return reply.status(result.status || 400).send({ error: result.error });
        return result;
      });

      routes.post("/chats/:chatId/act", async (request, reply) => {
        const { chatId } = request.params;
        const body = request.body ?? {};
        const order = cleanText(body.order, MAX_ORDER);
        if (!order) return reply.status(400).send({ error: "Order is required" });
        const { state } = await loadDoc(chatId);
        if (!state.acting) return reply.status(403).send({ error: "Acting is off" });
        const subject = body.subjectId ? state.subjects.find((item) => item.id === body.subjectId) : null;
        const privacy = subject ? effectivePrivacy(subject) : "open";
        if (privacy === "off-limits") return reply.status(403).send({ error: "This place is off-limits" });
        const result = await runCall(
          chatId,
          (current, chat, facts) =>
            buildActMessages({ style: current.style, butlerName: current.butlerName, order, subject, chat, facts }),
          "act",
          { order, subjectId: subject?.id ?? null, subjectName: subject?.name ?? null },
          privacy,
          subject?.name ?? "",
        );
        if (result.error) return reply.status(result.status || 400).send({ error: result.error });
        return result;
      });
    },
    { prefix: `/api/${PACKAGE_ID}` },
  );

  const releasePromptContext = api.registerPromptContext(async ({ chatId, mode, chatMeta }) => {
    if (mode !== "roleplay" || !chatId || !isAgentActive(chatMeta)) return null;
    try {
      const { state } = await loadDoc(chatId);
      if (!state.log.length && !state.subjects.length) return null;
      const text = buildPromptText(state, await listMessages(chatId));
      return text ? { text } : null;
    } catch (error) {
      logger?.warn?.("[sentinel] prompt context failed: %s", error instanceof Error ? error.message : String(error));
      return null;
    }
  });

  return () => {
    releaseRoutes?.();
    releasePromptContext?.();
  };
}
