import { createHash as forgeProactiveHash, randomUUID as forgeProactiveId } from "node:crypto";

export function normalizeForgeDailyUnitMessages(value) {
  const number = typeof value === "string" && /^(0|[1-9]\d*)$/u.test(value) ? Number(value) : value;
  return typeof number === "number" && Number.isSafeInteger(number) && number >= 0 ? number : 0;
}

/** Only numeric budget diagnostics cross the public failure boundary. */
export function forgeGenerationCapacityDetail(value) {
  let data;
  try {
    data = typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    data = null;
  }
  const detail = { minimumOutputTokens: 8192 };
  for (const key of ["requestedMaxTokens", "availableContextTokens", "configuredMaxOutputTokens"])
    if (Number.isSafeInteger(data?.[key]) && data[key] >= 0) detail[key] = data[key];
  return detail;
}

/** Reuse the normal chat prompt, adding an instruction rather than inventing a player's message. */
export function forgeProactiveChatMessages(buildChatMessages, context) {
  const unit = { ...context.unit };
  const fields = ["description", "personality", "backstory", "appearance"];
  const canon = unit.forgeCardCanon;
  if (canon && typeof canon === "object") for (const field of fields) unit[field] = "";
  const protagonist = context.protagonist
    ? Object.fromEntries(["name", ...fields].map((field) => [field, context.protagonist[field]]))
    : null;
  const messages = buildChatMessages({ ...context, unit, protagonist, photos: false, asked: false });
  const reference = canon
    ? "\nCANONICAL CHARACTER CARD — authoritative authored characterization and relationships:\n" +
      JSON.stringify(Object.fromEntries(fields.map((field) => [field, canon[field] || ""])))
    : unit.backstory
      ? "\nBackstory: " + unit.backstory
      : "";
  return [
    {
      ...messages[0],
      content:
        messages[0].content +
        reference +
        "\nYou are initiating a natural check-in, not answering an unseen player message. " +
        "Preserve authored relationships; do not replace an established friendship with invented hostility. " +
        "You may react to events in the supplied PLAYED history, ask how their day is going, " +
        "or share a small in-character thought. Do not spoil unplayed chapters, invent shared events, " +
        "claim knowledge of the real person's activities, or repeat a recent message. " +
        "Write only one brief message, with no scene, photo instructions, or player reply.",
    },
    ...messages.slice(1),
    {
      role: "user",
      content:
        "Out-of-world generation instruction, NOT a message sent by the player: " +
        "write the character's spontaneous message now, in the world's configured language.",
    },
  ];
}

const forgeProactiveFingerprint = (value) => forgeProactiveHash("sha256").update(JSON.stringify(value)).digest("hex");
const forgeProactiveContextKey = (snapshot) => {
  const session = snapshot.session.data;
  const played = {
    progress: session.progress,
    reading: session.reading,
    bondChapters: session.bondChapters,
    chatChannel: session.chatChannel,
    bondFights: session.roster?.[snapshot.unit?.id]?.bondFights,
  };
  return forgeProactiveFingerprint([
    snapshot.index.revision,
    snapshot.run,
    played,
    snapshot.choices,
    snapshot.unit,
    snapshot.chat?.revision ?? null,
  ]);
};
const forgeProactivePendingPlayer = (chat) => {
  const messages = Array.isArray(chat?.messages) ? chat.messages : [];
  const archived = (Array.isArray(chat?.sessions) ? chat.sessions : []).reduce(
    (total, session) => total + Math.max(0, Number(session?.count) || 0),
    0,
  );
  return messages.length > archived && messages.at(-1)?.who === "player";
};

/** Visible-world polling only. Reserve a budgeted attempt before any provider work. */
export function createForgeProactiveMessages({
  packageId,
  persistence,
  isUnlocked,
  readContext,
  generate,
  withChatSend,
  dayKey,
  resetIn,
  contextStillCurrent = async () => true,
  now = Date.now,
  random = Math.random,
}) {
  const documents = persistence.documents;
  const boot = forgeProactiveId();
  const running = new Map();
  let disposed = false;
  const chatId = (runId, unitId) => `${runId}:chat:${unitId.split(":unit:").pop()}`;
  const save = async (store, document, id, kind, data) => {
    const stamp = new Date(now()).toISOString();
    const value = {
      id,
      packageId,
      name: document?.name || kind,
      description: document?.description || "Gacha Forge character messages",
      data,
      updatedAt: stamp,
    };
    const saved = document
      ? await store.update({ ...value, expectedRevision: document.revision })
      : await store.create({ ...value, kind, createdAt: stamp });
    if (!saved) throw new Error("proactive-write-conflict");
    return saved;
  };
  const choices = async (store, runId) =>
    (await store.list(packageId, "beat"))
      .filter((row) => row?.id?.startsWith(`${runId}:beat:`) && Object.keys(row.data?.choiceCanon || {}).length)
      .map((row) => [row.id, row.data.choiceCanon])
      .sort(([left], [right]) => left.localeCompare(right));
  const read = async (store, runId, unitId, includeChoices = false) => {
    const index = await store.getById(packageId, "index");
    const run = (index?.data?.runs || []).find((item) => item?.runId === runId);
    const session = await store.getById(packageId, `${runId}:session`);
    if (!run || index.data.activeRunId !== runId || !session) return null;
    const unit = unitId ? await store.getById(packageId, unitId) : null;
    const chat = unitId ? await store.getById(packageId, chatId(runId, unitId)) : null;
    return { index, run, session, unit, chat, choices: includeChoices ? await choices(store, runId) : null };
  };
  const eligible = (snapshot, unitId) => {
    const unit = snapshot?.unit;
    const own = snapshot?.session.data?.roster?.[unitId];
    return (
      unit?.id === unitId &&
      unitId.startsWith(`${snapshot.run.runId}:unit:`) &&
      own &&
      isUnlocked(unit.data, own) &&
      !forgeProactivePendingPlayer(snapshot.chat?.data)
    );
  };
  const stateFor = (data, at) => {
    const source = data.proactiveMessages || {};
    const days = { ...source.days };
    const day = dayKey(at);
    const value = days[day] || {};
    days[day] = { ...value, attempts: normalizeForgeDailyUnitMessages(value.attempts) };
    // At most four neighboring local dates cover timezone changes without resetting today's count.
    for (const old of Object.keys(days)
      .filter((key) => key !== day)
      .sort()
      .slice(0, -3))
      delete days[old];
    return { state: { ...source, days }, day, quota: days[day] };
  };
  const settle = (runId, id, status) =>
    persistence.transaction(async ({ documents: store }) => {
      const session = await store.getById(packageId, `${runId}:session`);
      if (session?.data?.proactiveMessages?.pending?.id !== id) return;
      const data = structuredClone(session.data);
      data.proactiveMessages.pending.status = status;
      await save(store, session, session.id, "session", data);
    });

  async function attempt(runId, unitId, body, controller) {
    const reservation = await persistence.transaction(async ({ documents: store }) => {
      const snapshot = await read(store, runId, unitId);
      if (!snapshot) return { ok: true, status: "inactive" };
      const limit = normalizeForgeDailyUnitMessages(snapshot.run.story?.dailyUnitMessages);
      if (!limit) return { ok: true, status: "disabled" };
      if (!eligible(snapshot, unitId)) return { ok: true, status: "no-eligible" };
      const at = now();
      const { state, day, quota } = stateFor(snapshot.session.data, at);
      const interval = Math.max(60_000, 86_400_000 / limit);
      const pending = state.pending;
      if (pending?.status === "generating" && pending.boot === boot && running.get(runId)?.id === pending.id)
        return { ok: true, status: "busy" };
      // A previous process/failed write may have reached the provider. Never repeat that attempt.
      if (pending?.status === "generating") state.pending = { ...pending, status: "interrupted" };
      let status;
      if (quota.attempts >= limit) status = "quota";
      else if (
        !Number.isFinite(quota.nextAt) ||
        !Number.isFinite(state.lastSeenAt) ||
        state.sourceRevision !== snapshot.index.revision ||
        at < state.lastSeenAt ||
        at - state.lastSeenAt > 120_000
      ) {
        // Re-arming the visible-world delay must never shorten an already-paid interval.
        quota.nextAt = Math.max(at + 60_000, Number.isFinite(quota.nextAt) ? quota.nextAt : at);
        status = "scheduled";
      } else if (at < quota.nextAt) status = "waiting";
      state.lastSeenAt = at;
      state.sourceRevision = snapshot.index.revision;
      const data = structuredClone(snapshot.session.data);
      data.proactiveMessages = state;
      if (status) {
        await save(store, snapshot.session, snapshot.session.id, "session", data);
        return { ok: true, status, nextAt: quota.nextAt };
      }
      const id = forgeProactiveId();
      quota.attempts++;
      quota.nextAt = Math.min(at + interval, at + Math.max(1, resetIn(at)));
      state.pending = { id, unitId, day, at, boot, status: "generating" };
      snapshot.choices = await choices(store, runId);
      await save(store, snapshot.session, snapshot.session.id, "session", data);
      running.get(runId).id = id;
      return { snapshot, id, localDay: day, at, key: forgeProactiveContextKey(snapshot) };
    });
    if (!reservation.snapshot) return reservation;
    const { snapshot, id, localDay, at, key } = reservation;
    const signal = controller.signal;
    const input = {
      runId,
      unitId,
      run: snapshot.run,
      session: snapshot.session.data,
      unit: snapshot.unit.data,
      chat: snapshot.chat?.data || { messages: [], sessions: [] },
      signal,
      localDay,
      at,
      debugMode: body.debugMode === true,
    };
    try {
      signal.throwIfAborted();
      const context = await readContext(input);
      signal.throwIfAborted();
      // Context lookup may yield to a settings save, player send, reset or world activation.
      const before = await read(documents, runId, unitId, true);
      if (!before || key !== forgeProactiveContextKey(before)) throw new Error("context-changed");
      const answer = await generate({ ...input, context, messages: context.messages });
      signal.throwIfAborted();
      if (answer?.ok !== true && answer?.error === "generation-output-capacity")
        throw Object.assign(new Error("generation-output-capacity"), {
          capacity: forgeGenerationCapacityDetail(answer.detail),
        });
      const text = answer?.ok === true && typeof answer.value === "string" ? answer.value.trim() : "";
      if (!text) throw new Error("generation-failed");
      if (!(await contextStillCurrent({ ...input, context }))) throw new Error("context-changed");
      signal.throwIfAborted();
      return await persistence.transaction(async ({ documents: store }) => {
        signal.throwIfAborted();
        const current = await read(store, runId, unitId, true);
        if (
          !current ||
          key !== forgeProactiveContextKey(current) ||
          current.session.data.proactiveMessages?.pending?.id !== id ||
          !eligible(current, unitId)
        )
          throw new Error("context-changed");
        const said = { id: `proactive:${id}`, who: "unit", text, at: now(), proactive: true };
        const chat = structuredClone(current.chat?.data || { messages: [], sessions: [] });
        chat.unitId = unitId;
        chat.name = current.unit.data.name;
        chat.messages = Array.isArray(chat.messages) ? chat.messages : [];
        if (!chat.messages.some((message) => message?.id === said.id)) chat.messages.push(said);
        const data = structuredClone(current.session.data);
        data.proactiveMessages.pending.status = "sent";
        await save(store, current.chat, chatId(runId, unitId), "chat", chat);
        await save(store, current.session, current.session.id, "session", data);
        return {
          ok: true,
          status: "sent",
          unitId,
          unitName: current.unit.data.name,
          said,
          nextAt: data.proactiveMessages.days[localDay]?.nextAt,
        };
      });
    } catch (error) {
      await settle(runId, id, signal.aborted ? "cancelled" : "failed");
      return {
        ok: false,
        error: signal.aborted
          ? "cancelled"
          : error.message === "context-changed"
            ? "context-changed"
            : "generation-failed",
        ...(!signal.aborted && error.message === "generation-output-capacity"
          ? { detail: "generation-output-capacity", capacity: error.capacity }
          : {}),
        retry: false,
      };
    }
  }

  async function due(body = {}) {
    const runId = body.runId;
    if (typeof runId !== "string" || !runId || runId.length > 160) return { ok: false, error: "bad-request" };
    if (disposed) return { ok: false, error: "cancelled", retry: false };
    if (running.has(runId)) return { ok: true, status: "busy" };
    if (typeof persistence.transaction !== "function") return { ok: false, error: "persistence-unavailable" };
    const controller = new AbortController();
    running.set(runId, { controller, id: null });
    try {
      const snapshot = await read(documents, runId);
      if (!snapshot) return { ok: true, status: "inactive" };
      if (!normalizeForgeDailyUnitMessages(snapshot.run.story?.dailyUnitMessages))
        return { ok: true, status: "disabled" };
      const candidates = Object.keys(snapshot.session.data.roster || {});
      for (let index = candidates.length - 1; index > 0; index--) {
        const other = Math.floor(random() * (index + 1));
        [candidates[index], candidates[other]] = [candidates[other], candidates[index]];
      }
      for (const unitId of candidates) {
        const candidate = await read(documents, runId, unitId);
        controller.signal.throwIfAborted();
        if (!candidate || !eligible(candidate, unitId)) continue;
        const result = await withChatSend(runId, unitId, () => attempt(runId, unitId, body, controller));
        if (result?.busy) continue;
        return result;
      }
      return { ok: true, status: "no-eligible" };
    } catch {
      return { ok: false, error: controller.signal.aborted ? "cancelled" : "write-conflict", retry: false };
    } finally {
      if (running.get(runId)?.controller === controller) running.delete(runId);
    }
  }

  return {
    due,
    invalidate(runId) {
      running.get(runId)?.controller.abort();
    },
    dispose() {
      disposed = true;
      for (const { controller } of running.values()) controller.abort();
    },
  };
}
