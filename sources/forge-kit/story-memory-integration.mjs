const forgeStoryOpenedTime = (row) => {
  const value = Number(row?.opened);
  return Number.isFinite(value) && value > 0 ? value : 0;
};
export function forgeStoryOpenedBefore(row, other) {
  return (
    forgeStoryOpenedTime(row) > 0 &&
    forgeStoryOpenedTime(other) > 0 &&
    forgeStoryOpenedTime(row) < forgeStoryOpenedTime(other)
  );
}

// Replace only known side-story slots; unknown openings and every other source keep their legacy position.
export function orderForgeStorySources(rows) {
  const result = [...rows],
    groups = new Map();
  result.forEach((row, index) => {
    const opening = row.opening;
    if (
      !["character-story", "story-event"].includes(row.kind) ||
      !Number.isSafeInteger(opening?.after) ||
      opening.after < 0 ||
      !Number.isSafeInteger(opening?.opened) ||
      opening.opened <= 0
    )
      return;
    if (!groups.has(opening.after)) groups.set(opening.after, { positions: [], entries: [], kinds: new Set() });
    const group = groups.get(opening.after);
    group.positions.push(index);
    group.entries.push(row);
    group.kinds.add(row.kind);
  });
  for (const group of groups.values()) {
    if (group.kinds.size < 2) continue;
    group.entries.sort((left, right) => left.opening.opened - right.opening.opened || left.id.localeCompare(right.id));
    group.positions.forEach((position, index) => {
      result[position] = group.entries[index];
    });
  }
  return result;
}

// The legacy bundle supplies its existing persistence/model wrappers. No Engine-internal
// memory service, new storage format, or transfer limit is introduced here.
// Every story writer keeps what a character can know inside the world, and the fiction's own boundary.
export const forgeKnowledgeBoundary =
  "KNOWLEDGE BOUNDARY: a character knows only what they saw or took part in, or what they learned inside the story from the protagonist or another in-world source. They never know another character's private conversations, or a Character Story they were not part of, unless they learned it that way, and they know nothing outside the fiction: no player, game, prompt, instructions or memory notes.";

// The last characters of a text, starting at a line break when one falls early in the cut.
function forgeRecallTail(value, size) {
  const characters = [...(typeof value === "string" ? value.trim() : "")];
  if (characters.length <= size) return characters.join("");
  const cut = characters.slice(-size).join("");
  const line = cut.indexOf("\n");
  return line >= 0 && line < cut.length / 2 ? cut.slice(line + 1) : cut;
}

// A chat's recall query, as the Engine's: the player's messages since the companion last spoke (or the latest one),
// and the last four messages for word overlap. Who is talking is passed apart, so a name never stands for a topic.
export function forgeChatRecallQuery(messages, { speakers = [] } = {}) {
  const said = (Array.isArray(messages) ? messages : []).filter((m) => typeof m?.text === "string" && m.text.trim());
  const replied = said.findLastIndex((m) => m.who !== "player");
  const span = said.slice(replied + 1).filter((m) => m.who === "player");
  const latest = said.findLast((m) => m.who === "player");
  return {
    cues: (span.length ? span.slice(-6) : latest ? [latest] : []).map((m) => m.text),
    window: said
      .slice(-4)
      .map((m) => m.text)
      .join("\n")
      .slice(-6000),
    speakers: speakers.filter(Boolean),
  };
}

export function createForgeStoryMemoryIntegration({
  createMemory,
  documents,
  packageId,
  readRun,
  readSession,
  readPlan,
  listPlans,
  listChats,
  allNodes,
  storyNodes,
  readSegments,
  renderSegments,
  bondHistory,
  bondChapterId,
  bondLength,
  generate,
  readConnections,
  resolveModelMetadata,
  findKnownModel,
  estimateTokens,
  resolveEmbeddings,
  background,
  runStory = (_runId, operation) => operation(),
  prepareMessages = async (messages) => messages,
  renderContext = (result, { prefix, fate }) => [result.text, prefix, fate].filter(Boolean).join("\n\n"),
  logger,
}) {
  const text = (value) => (typeof value === "string" ? value : "");
  const normal = (session, chapter) => Math.max(0, Number(session?.progress?.[String(chapter)]?.normal) || 0);
  const memoryId = (runId) => `${runId}:summary:memory`;
  const validRun = async (runId) => !!(await readRun(runId));
  const frontier = async (runId) => {
    const session = await readSession(runId);
    const plans = await listPlans(runId);
    let result = { chapter: 1, nodeIndex: 0 };
    for (const [key, progress] of Object.entries(session?.progress || {})) {
      const chapter = Number(key),
        nodeIndex = Math.max(0, Number(progress?.normal) || 0);
      if (!Number.isInteger(chapter) || chapter < 1 || !nodeIndex) continue;
      const plan = plans.find((doc) => doc?.id === `${runId}:chapter:${chapter}`)?.data;
      const count = allNodes(plan).length;
      const position = count && nodeIndex >= count ? { chapter: chapter + 1, nodeIndex: 0 } : { chapter, nodeIndex };
      if (
        position.chapter > result.chapter ||
        (position.chapter === result.chapter && position.nodeIndex > result.nodeIndex)
      )
        result = position;
    }
    return result;
  };
  const currentTarget = async (runId, chapter, storyIndex) => {
    if (!Number.isInteger(chapter)) {
      const session = await readSession(runId);
      const eventPlan = await readPlan(runId, chapter);
      if (eventPlan?.eventId) {
        const node = allNodes(eventPlan).filter((entry) => entry.type === "story")[storyIndex];
        return !node || allNodes(eventPlan).indexOf(node) >= normal(session, chapter);
      }
      const row = bondHistory(session).find((entry) => bondChapterId(entry.unitId, entry.part) === chapter);
      if (!row) return false;
      const suffix = row.part > 1 ? String(row.part) : "";
      return storyIndex >= Math.max(0, Number(session?.bondChapters?.[row.unitId]?.[`beats${suffix}`]) || 0);
    }
    const position = await frontier(runId);
    if (chapter !== position.chapter) return chapter > position.chapter;
    const plan = await readPlan(runId, chapter);
    const node = allNodes(plan)
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.type === "story")[storyIndex];
    return (node?.index ?? 0) >= position.nodeIndex;
  };
  const sourceRows = async (runId, target) => {
    if (!(await validRun(runId))) return [];
    const session = await readSession(runId);
    const plans = (await listPlans(runId)).filter((doc) => doc?.data);
    const numeric = plans
      .map((doc) => ({ ...doc.data, chapter: Number(doc.id.slice(`${runId}:chapter:`.length)) }))
      .filter((plan) => Number.isInteger(plan.chapter) && plan.chapter > 0)
      .sort((a, b) => a.chapter - b.chapter);
    const history = bondHistory(session);
    const bondTarget =
      target && !Number.isInteger(target.chapter)
        ? history.find((row) => bondChapterId(row.unitId, row.part) === target.chapter)
        : null;
    const eventTarget = target && plans.find((doc) => doc.id === `${runId}:chapter:${target.chapter}`)?.data;
    const ceiling = target
      ? Number.isInteger(target.chapter)
        ? target.chapter
        : (eventTarget?.eventId ? eventTarget.after : (bondTarget?.after ?? 0)) + 1
      : Infinity;
    const rows = [];
    const canonical = async (chapter, count) => {
      const beats = [];
      for (let index = 0; index < count; index += 1) {
        const segments = await readSegments(runId, chapter, index);
        // An unresolved first-play choice is never eligible canonical history.
        if (!Array.isArray(segments)) return null;
        beats.push(renderSegments(segments));
      }
      return beats.join("\n\n");
    };
    for (const plan of numeric) {
      const nodes = allNodes(plan);
      if (!nodes.length || normal(session, plan.chapter) < nodes.length || plan.chapter >= ceiling) continue;
      const content = await canonical(plan.chapter, storyNodes(plan).length);
      if (!content) continue;
      rows.push({
        id: String(plan.chapter),
        kind: "chapter",
        title: text(plan.title) || `Chapter ${plan.chapter}`,
        content,
        order: plan.chapter * 10000,
      });
    }
    for (const [index, row] of history.entries()) {
      const suffix = row.part > 1 ? String(row.part) : "";
      if (!(Number(session?.bondChapters?.[row.unitId]?.[`beats${suffix}`]) >= bondLength)) continue;
      if (target && (row.after >= ceiling || (bondTarget && index >= history.indexOf(bondTarget)))) continue;
      if (
        eventTarget?.eventId &&
        Number(row.after) === Number(eventTarget.after) &&
        !forgeStoryOpenedBefore(row, eventTarget)
      )
        continue;
      const chapter = bondChapterId(row.unitId, row.part);
      const plan = await readPlan(runId, chapter);
      if (!plan) continue;
      const content = await canonical(chapter, storyNodes(plan).length);
      if (!content) continue;
      rows.push(
        Object.defineProperties(
          {
            id: chapter,
            kind: "character-story",
            title: text(plan.title) || `Character Story ${chapter}`,
            content,
            order: row.after * 10000 + 5000 + (Number(row.opened) || row.part) / 1e13,
          },
          {
            opening: { value: { after: Number(row.after), opened: forgeStoryOpenedTime(row) } },
            // The unit whose story it is; other units' chats know it only through the shared overview.
            audience: { value: [row.unitId] },
          },
        ),
      );
    }
    for (const doc of plans.filter((row) => row.data.eventId)) {
      const plan = doc.data,
        chapter = doc.id.slice(`${runId}:chapter:`.length);
      if (normal(session, chapter) < allNodes(plan).length || plan.after >= ceiling || chapter === target?.chapter)
        continue;
      const sideTarget = eventTarget?.eventId ? eventTarget : bondTarget;
      if (sideTarget && Number(plan.after) === Number(sideTarget.after) && !forgeStoryOpenedBefore(plan, sideTarget))
        continue;
      const content = await canonical(chapter, storyNodes(plan).length);
      if (content)
        rows.push(
          Object.defineProperty(
            {
              id: chapter,
              kind: "story-event",
              title: `Story event: ${text(plan.title)}`,
              content,
              order: Number(plan.after) * 10000 + 6000 + (Number(plan.opened) || 0) / 1e13,
            },
            "opening",
            { value: { after: Number(plan.after), opened: forgeStoryOpenedTime(plan) } },
          ),
        );
    }
    const targetPlan = target && Number.isInteger(target.chapter) ? await readPlan(runId, target.chapter) : null;
    const targetNodes = targetPlan ? allNodes(targetPlan) : [];
    const targetNode =
      targetNodes.map((node, index) => ({ node, index })).filter(({ node }) => node.type === "story")[
        target?.storyIndex
      ]?.index ?? 0;
    const archived = (await documents.getById(packageId, memoryId(runId)))?.data?.records || [];
    for (const doc of await listChats(runId)) {
      for (const [index, entry] of (Array.isArray(doc?.data?.sessions) ? doc.data.sessions : []).entries()) {
        if (!text(entry?.memory).trim()) continue;
        const chapter = Number(entry.chapter) || 0;
        if (target) {
          const position = entry.memoryPosition;
          // Old chat memories have only a coarse chapter. Same-chapter history is
          // ambiguous, so keep it in current canon but never leak it into a replay.
          if (position && Number.isInteger(position.chapter)) {
            if (
              position.chapter > ceiling ||
              (position.chapter === ceiling &&
                (!Number.isInteger(target.chapter) || Number(position.nodeIndex) > targetNode))
            )
              continue;
          } else if (chapter < 1 || chapter >= ceiling) continue;
          if (bondTarget && chapter >= ceiling) continue;
        }
        const id = `${doc.id}:${index}:${Number(entry.at) || 0}:${Number(entry.count) || 0}`;
        const previous = archived.find((record) => record.kind === "chat" && record.id === id);
        rows.push(
          Object.defineProperties(
            {
              id,
              kind: "chat",
              // A later display-name edit does not rewrite an already archived conversation.
              title: previous?.title || `${text(entry.memoryName) || text(doc.data.name) || "Companion"} conversation`,
              content: [text(entry.memory), text(entry.quote)].filter(Boolean).join("\n"),
              order: (entry.memoryPosition?.chapter ?? chapter) * 10000 - 1000 + index / 1000,
            },
            {
              // A private conversation belongs to its unit: only that unit's chat, and scenes it is in, recall it.
              audience: { value: [`${runId}:unit:${doc.id.slice(`${runId}:chat:`.length)}`] },
              // The session as a writer's own list of recent conversations names it, to keep it out of recall there.
              listedAs: {
                value: [text(doc.data.name).trim(), Number(entry.at) || 0, text(entry.memory).trim()].join("\n"),
              },
            },
          ),
        );
      }
    }
    return orderForgeStorySources(rows.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)));
  };
  const partialBondHistory = async (runId, excludeChapter, reader) => {
    const session = await readSession(runId);
    const result = [];
    for (const row of bondHistory(session)) {
      if (reader && row.unitId !== reader) continue;
      const suffix = row.part > 1 ? String(row.part) : "";
      const count = Math.max(0, Math.floor(Number(session?.bondChapters?.[row.unitId]?.[`beats${suffix}`]) || 0));
      if (!count || count >= bondLength) continue;
      const chapter = bondChapterId(row.unitId, row.part);
      if (chapter === excludeChapter) continue;
      const plan = await readPlan(runId, chapter);
      const beats = [];
      for (let index = 0; index < count; index += 1) {
        const segments = await readSegments(runId, chapter, index);
        if (Array.isArray(segments)) beats.push(renderSegments(segments));
      }
      if (beats.length) result.push(`# Character Story so far: ${text(plan?.title) || chapter}\n${beats.join("\n\n")}`);
    }
    for (const doc of await listPlans(runId)) {
      const plan = doc.data,
        chapter = doc.id.slice(`${runId}:chapter:`.length);
      if (!plan?.eventId || chapter === excludeChapter) continue;
      const count = normal(session, chapter),
        nodes = allNodes(plan);
      if (!count || count >= nodes.length) continue;
      const beats = [];
      let index = 0;
      for (const [nodeIndex, node] of nodes.entries()) {
        if (node.type !== "story") continue;
        if (nodeIndex < count) {
          const segments = await readSegments(runId, chapter, index);
          if (Array.isArray(segments)) beats.push(renderSegments(segments));
        }
        index += 1;
      }
      if (beats.length) result.push(`# Story event so far: ${text(plan.title)}\n${beats.join("\n\n")}`);
    }
    return result.join("\n\n");
  };
  const resolveContext = async (runId, { job = "structured", connectionId } = {}) => {
    const run = await readRun(runId);
    if (!run) return { maxContext: null };
    const field = { narration: "narrationConnectionId", chat: "chatConnectionId", compress: "compressConnectionId" }[
      job
    ];
    const mainId = text(run.connectionId);
    const selected = text(connectionId) || text(field && run[field]) || mainId;
    let connections = [];
    try {
      const rows = await readConnections();
      if (Array.isArray(rows)) connections = rows;
    } catch {
      /* Public facade below also works when loopback HTTP requires local authentication. */
    }
    for (const id of new Set([selected, mainId])) {
      if (connections.some((row) => row?.id === id) || !resolveModelMetadata) continue;
      try {
        const model = await resolveModelMetadata(id);
        if (model)
          connections.push({
            id,
            model: model.model,
            maxContext: model.maxContext,
            maxOutputTokens: model.maxOutputTokens,
          });
      } catch {
        /* Unknown capacity stays explicit; never read local authentication secrets. */
      }
    }
    const ceilings = [...new Set([selected, mainId])].map((id) => {
      const row = connections.find((entry) => entry?.id === id);
      if (!row) return null;
      const configured = Number(row.maxContext);
      const known = Number(findKnownModel(row.provider || "custom", row.model)?.context);
      const limits = [configured, known].filter((limit) => Number.isFinite(limit) && limit > 0);
      return limits.length ? Math.min(...limits) : null;
    });
    // _t can fall back to main, so both actual consumers must have a known ceiling.
    return {
      maxContext: ceilings.every((value) => value != null) ? Math.min(...ceilings) : null,
      maxOutput: (() => {
        const values = [...new Set([selected, mainId])]
          .map((id) => {
            const row = connections.find((entry) => entry?.id === id);
            if (!row) return 0;
            const limits = [
              Number(row.maxOutputTokens),
              Number(findKnownModel(row.provider || "custom", row.model)?.maxOutput),
            ].filter((value) => Number.isFinite(value) && value > 0);
            return limits.length ? Math.min(...limits) : 0;
          })
          .filter((value) => Number.isFinite(value) && value > 0);
        return values.length ? Math.min(...values) : null;
      })(),
      model: connections.find((row) => row?.id === selected)?.model || "",
      connectionId: selected,
    };
  };
  const summaryBudget = async ({ runId, messages, tokenBudget }) => {
    const context = await resolveContext(runId, { job: "compress" });
    if (!context.maxContext) throw new Error("compress-context-unknown");
    messages = await prepareMessages(messages, runId);
    // Thinking models reason before they write, so every summary leaves at least 10k tokens of output room.
    // Never below the 8192 every generation needs: a model with less fails at no cost and the fallback has room.
    const reserve = Math.max(8192, Math.min(Math.max(10240, tokenBudget || 0), context.maxOutput || Infinity));
    const available = (input) =>
      context.maxContext -
      input.reduce(
        (sum, message) =>
          sum +
          estimateTokens(
            typeof message?.content === "string" ? message.content : JSON.stringify(message?.content || ""),
          ) +
          4,
        0,
      ) -
      512;
    if (available(messages) < reserve) return null;
    return {
      maxContext: context.maxContext,
      messages,
      maxTokens: available(messages),
      requestBudget: (input) => (available(input) >= reserve ? available(input) : 0),
    };
  };
  const memory = createMemory({
    readMemory: async (runId) => {
      const doc = await documents.getById(packageId, memoryId(runId));
      return { data: doc?.data ?? null, revision: doc?.revision ?? null };
    },
    updateMemory: async (runId, { expectedRevision, data }) => {
      if (!(await validRun(runId))) return false;
      const id = memoryId(runId),
        now = new Date().toISOString();
      let saved;
      try {
        saved =
          expectedRevision != null
            ? !!(await documents.update({
                id,
                packageId,
                expectedRevision,
                name: "Story memory",
                description: "Automatic canonical story memory",
                data,
                updatedAt: now,
              }))
            : !!(await documents.create({
                id,
                packageId,
                kind: "summary",
                name: "Story memory",
                description: "Automatic canonical story memory",
                data,
                createdAt: now,
                updatedAt: now,
              }));
      } catch {
        return false;
      }
      // Deletion removes the run index before sweeping documents. Close the race
      // where a create already in flight lands just after that sweep.
      if (saved && !(await validRun(runId))) {
        const stale = await documents.getById(packageId, id);
        if (stale) await documents.remove(packageId, id, stale.revision);
        return false;
      }
      return saved;
    },
    readSources: sourceRows,
    orderSources: orderForgeStorySources,
    resolveContext,
    estimateTokens,
    resolveEmbeddings,
    fitsSummary: async (options) => !!(await summaryBudget(options)),
    summarize: async ({ runId, kind, messages, tokenBudget, debugMode, signal }) => {
      if (signal?.aborted || !(await validRun(runId))) throw new Error("memory-cancelled");
      const result = await generate({ runId, kind, messages, tokenBudget, debugMode, signal });
      if (!result?.ok || typeof result.value !== "string" || !result.value.trim()) {
        throw new Error(result?.error || "memory-summary-failed");
      }
      return result.value;
    },
    log: (message) => logger?.warn?.("[gacha-forge] story memory: %s", message),
  });
  const scheduled = new Map();
  const resumed = new Set();
  const schedule = (runId, options = {}) => {
    const previous = scheduled.get(runId);
    if (previous) {
      previous.again = true;
      return previous.promise;
    }
    const entry = { again: false, promise: null };
    entry.promise = Promise.resolve()
      // The story's signal stops summaries and vector upkeep alike on Cancel or a reset.
      .then(() => runStory(runId, (signal) => background(() => memory.maintain({ runId, ...options, signal }))))
      .catch((error) => logger?.warn?.("[gacha-forge] automatic story memory failed: %s", error?.message || "failed"))
      .finally(() => {
        if (scheduled.get(runId) !== entry) return;
        scheduled.delete(runId);
        // A second completion while the first job was running needs one fresh
        // snapshot, rather than silently losing the newer canonical event.
        if (entry.again) schedule(runId, options);
      });
    scheduled.set(runId, entry);
    return entry.promise;
  };
  return {
    ...memory,
    status: async (runId) => {
      const saved = await memory.status(runId);
      return scheduled.has(runId) ? { ...saved, phase: "pending", retryable: false } : saved;
    },
    readSources: sourceRows,
    resolveContext,
    summaryBudget,
    schedule,
    resume: (runId) => {
      // Completion schedules new work. Opening an existing world also catches up
      // chapters finished before this version, or interrupted by a server restart.
      if (!runId || resumed.has(runId)) return;
      resumed.add(runId);
      return schedule(runId);
    },
    frontier,
    context: async ({
      runId,
      chapter,
      storyIndex,
      query,
      job,
      connectionId,
      debugMode,
      prefix = "",
      fate = "",
      fallback,
      current = false,
      reader,
      cast,
      listed = [],
    }) => {
      let previous = "",
        previousContent = "",
        previousTurn = Infinity;
      const legacy = async () => {
        let eventRows = [];
        try {
          eventRows = (await sourceRows(runId, { chapter, storyIndex })).filter((row) => row.kind === "story-event");
        } catch (error) {
          logger?.warn?.(
            "[gacha-forge] event memory unavailable; using legacy history: %s",
            error?.message || "failed",
          );
        }
        // The bundle's history comes as its blocks and where each chapter's turn starts; a plain string is one block.
        const fallen = await fallback();
        const { blocks, starts = [] } = Array.isArray(fallen?.blocks) ? fallen : { blocks: [fallen] };
        const events = eventRows.map((row) => ({ text: `# ${row.title}\n${row.content}`, after: row.opening?.after }));
        const history = [...blocks, ...events.map((event) => event.text)].filter(Boolean).join("\n\n");
        const currentBody = prefix.replace(/^# Current chapter so far\n/u, "");
        const missingCurrent = current && currentBody && !history.includes(currentBody);
        if (!previous && !missingCurrent) return history;
        // Manual summaries may include the previous chapter. Keep its complete
        // canonical text even when automatic memory needs recovery. Legacy
        // history already includes the current scene and locked decisions.
        const required = [
          history,
          previous && !history.includes(previousContent) ? previous : "",
          missingCurrent ? prefix : "",
        ]
          .filter(Boolean)
          .join("\n\n");
        const context = await resolveContext(runId, { job, connectionId });
        if (!context.maxContext) return required;
        // Canon before the previous chapter's turn, and events opened before it, may be left out by the prompt
        // fitter only while the reply would otherwise get less than its floor: older chapters first, then Character
        // Stories and events, each oldest first. The previous chapter, everything after it, the scene so far and
        // locked decisions always stay.
        const turns = starts.flatMap((at, turn) => [{ at, turn }]).slice(0, -1);
        const keep = turns.findLast((entry) => entry.turn <= previousTurn) || { at: 0, turn: 0 };
        const optional = [];
        let taken = 0;
        for (const event of events.filter((entry) => entry.after < keep.turn)) {
          const until = Math.max(taken, turns.find((entry) => entry.turn > event.after).at);
          optional.push(...blocks.slice(taken, until), event.text);
          taken = until;
        }
        optional.push(...blocks.slice(taken, keep.at));
        // Older chapters go before any Character Story or event, as with the summaries the overview misses.
        const main = new Set(turns.map(({ at }) => blocks[at]).filter((block) => /^# Chapters? \d/u.test(block ?? "")));
        optional.sort((left, right) => main.has(right) - main.has(left));
        return renderContext(
          { overview: "", details: [], maxContext: context.maxContext },
          { prefix: required, fate: "", optional },
        );
      };
      try {
        // Lazy backfill also recovers interrupted background work after a restart.
        const useCurrent = current || (await currentTarget(runId, chapter, storyIndex));
        const target = useCurrent ? undefined : { chapter, storyIndex };
        const rows = await sourceRows(runId, target);
        const lastChapter = rows.findLast((source) => source.kind === "chapter");
        // Conversations the writer already lists in full are not recalled again, so they never take a side slot.
        const shown = new Set(((await listed) || []).map((item) => [item.name, item.at, item.memory].join("\n")));
        if (lastChapter) {
          previousContent = lastChapter.content;
          previousTurn = Number(lastChapter.id);
          previous = `# Previous chapter in full: ${lastChapter.title}\n${previousContent}`;
        }
        // Recall searches with what was just played: the end of the current chapter so far (or of the previous
        // chapter), then the call site's own cues, the latest last. Plan text stays a secondary cue.
        // ponytail: unwraps the choice label forgeCanonicalSegments writes; a structured choice field is the upgrade.
        const played = (prefix.replace(/^# Current chapter so far\n/u, "") || previousContent).replace(
          /^\[Canonical player choice(?: by [^\]:]*)?: (.*)\]$/gmu,
          "$1",
        );
        const site = typeof query === "string" ? { cues: [query] } : query || {};
        const result = await memory.recall({
          runId,
          target,
          excludeChapterIds: lastChapter ? [lastChapter.id] : [],
          listed: rows.filter((row) => shown.has(row.listedAs)).map((row) => row.id),
          query: {
            cues: [forgeRecallTail(played, 1500), ...(site.cues || [])].filter(Boolean),
            window: site.window || forgeRecallTail(played, 6000),
            plan: site.plan || "",
            speakers: site.speakers || [],
          },
          job,
          connectionId,
          debugMode,
          reader,
          cast,
        });
        // Memory that fell behind catches up in the background; a failed summary waits for Retry. Generation adds
        // no canon, so it never re-arms a job that is already running.
        const lagging =
          result.status?.phase === "ready" ? result.lagging : ["stale", "pending"].includes(result.status?.phase);
        if (useCurrent && lagging && !scheduled.has(runId)) schedule(runId);
        if (result.status?.phase !== "ready") return legacy();
        const partial = useCurrent
          ? await partialBondHistory(runId, current || Number.isInteger(chapter) ? null : chapter, reader)
          : "";
        // Required recent canon in story order: the previous chapter in full, and around it whatever the overview
        // does not cover yet, as its saved summary or, for side canon not summarized yet, as written.
        const recent = (result.recent || []).map((source) =>
          source.latest
            ? previous
            : `# ${source.summary ? "Recent canon summary" : "Recent canon in full"}: ${source.title}\n${source.content}`,
        );
        if (previous && !result.recent?.some((source) => source.latest)) recent.push(previous);
        // Older chapter summaries the overview misses may be left out by the prompt fitter, oldest first; the newest
        // stays, and so does every Character Story and story event.
        const summaries = (result.recent || []).flatMap((source, index) =>
          source.summary && source.kind === "chapter" ? [recent[index]] : [],
        );
        return renderContext(result, {
          prefix: [...recent, prefix, partial].filter(Boolean).join("\n\n"),
          fate,
          optional: summaries.slice(0, -1),
        });
      } catch (error) {
        logger?.warn?.(
          "[gacha-forge] story memory unavailable; using canonical history: %s",
          error?.message || "failed",
        );
        return legacy();
      }
    },
  };
}
