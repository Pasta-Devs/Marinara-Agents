// The legacy bundle supplies its existing persistence/model wrappers. No Engine-internal
// memory service, new storage format, or transfer limit is introduced here.
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
    const ceiling = target
      ? Number.isInteger(target.chapter)
        ? target.chapter
        : (bondTarget?.after ?? 0) + 1
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
      const chapter = bondChapterId(row.unitId, row.part);
      const plan = await readPlan(runId, chapter);
      if (!plan) continue;
      const content = await canonical(chapter, storyNodes(plan).length);
      if (!content) continue;
      rows.push({
        id: chapter,
        kind: "character-story",
        title: text(plan.title) || `Character Story ${chapter}`,
        content,
        order: row.after * 10000 + 5000 + (Number(row.opened) || row.part) / 1e13,
      });
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
        rows.push({
          id,
          kind: "chat",
          // A later display-name edit does not rewrite an already archived conversation.
          title: previous?.title || `${text(entry.memoryName) || text(doc.data.name) || "Companion"} conversation`,
          content: [text(entry.memory), text(entry.quote)].filter(Boolean).join("\n"),
          order: (entry.memoryPosition?.chapter ?? chapter) * 10000 - 1000 + index / 1000,
        });
      }
    }
    return rows.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  };
  const partialBondHistory = async (runId, excludeChapter) => {
    const session = await readSession(runId);
    const result = [];
    for (const row of bondHistory(session)) {
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
    const reserve = Math.min(
      tokenBudget || 2000,
      2000,
      context.maxOutput || Infinity,
      Math.max(1, Math.floor(context.maxContext * 0.1)),
    );
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
    resolveContext,
    estimateTokens,
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
      .then(() => runStory(runId, () => background(() => memory.maintain({ runId, ...options }))))
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
    }) => {
      let previous = "",
        previousContent = "";
      const legacy = async () => {
        const history = await fallback();
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
        return renderContext(
          { overview: "", details: [], maxContext: context.maxContext },
          { prefix: required, fate: "" },
        );
      };
      try {
        // Lazy backfill also recovers interrupted background work after a restart.
        const useCurrent = current || (await currentTarget(runId, chapter, storyIndex));
        const target = useCurrent ? undefined : { chapter, storyIndex };
        const lastChapter = (await sourceRows(runId, target)).findLast((source) => source.kind === "chapter");
        if (lastChapter) {
          previousContent = lastChapter.content;
          previous = `# Previous chapter in full: ${lastChapter.title}\n${previousContent}`;
        }
        if (!useCurrent) await memory.maintain({ runId, job, connectionId, debugMode });
        const result = await memory.recall({
          runId,
          target,
          excludeChapterIds: lastChapter ? [lastChapter.id] : [],
          query,
          job,
          connectionId,
          debugMode,
        });
        if (result.status?.phase !== "ready") return legacy();
        const partial = useCurrent
          ? await partialBondHistory(runId, current || Number.isInteger(chapter) ? null : chapter)
          : "";
        return renderContext(result, { prefix: [previous, prefix, partial].filter(Boolean).join("\n\n"), fate });
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
