const forgeStoryCount = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
};
const forgeStoryShortMutations = new Set([
  "/story-event/complete",
  "/story-event/start",
  "/story-event/choice",
  "/story-event/beat/mark",
  "/story-event/battle/start",
  "/choice",
  "/complete",
  "/bond-chapter/complete",
  "/beat/mark",
  "/story/start",
  "/bond-chapter/start",
  "/preforge/cancel",
]);

export function forgeStoryVersion(session) {
  return forgeStoryCount(session?.storyRevision);
}

export function forgeStoryPaidThrough(session, chapter, progress, difficulty = "normal") {
  if (difficulty !== "normal") return forgeStoryCount(progress);
  return Math.max(forgeStoryCount(progress), forgeStoryCount(session?.storyRewardProgress?.[String(chapter)]));
}

// Use the public transaction session for every selected-document change. Provider work
// belongs to the existing plan route after commit, never inside this transaction.
export function createForgeChapterRegeneration({
  packageId,
  persistence,
  cancellation,
  allNodes,
  bondChapterId,
  bondLength,
  openBond,
  isCharacter,
  invalidateMemory,
}) {
  const sessionId = (runId) => `${runId}:session`;
  const planId = (runId, chapter) => `${runId}:chapter:${chapter}`;
  const text = (value) => (typeof value === "string" ? value : "");
  const target = (body) => {
    const runId = text(body?.runId),
      unitId = text(body?.unitId);
    if (!runId) return null;
    if (unitId) {
      const part = Number(body.part ?? 1);
      if (!unitId.startsWith(`${runId}:unit:`) || !Number.isInteger(part) || part < 1) return null;
      return { runId, unitId, part, chapter: bondChapterId(unitId, part) };
    }
    const chapter = Number(body?.chapter);
    return Number.isInteger(chapter) && chapter >= 1 ? { runId, chapter } : null;
  };
  const changed = (session, body) => {
    const version = forgeStoryVersion(session);
    return Number(body?.storyRevision ?? 0) !== version
      ? { ok: false, error: "story-changed", storyRevision: version }
      : null;
  };

  async function eligible(documents, selected, body) {
    const { runId, chapter, unitId, part } = selected;
    const index = await documents.getById(packageId, "index");
    if (!Array.isArray(index?.data?.runs) || !index.data.runs.some((run) => run?.runId === runId))
      return { ok: false, error: "not-found" };
    const session = await documents.getById(packageId, sessionId(runId));
    const data = structuredClone(session?.data || { progress: {} });
    const stale = changed(data, body);
    if (stale) return stale;
    const plan = await documents.getById(packageId, planId(runId, chapter));
    if (!plan?.data) return { ok: false, error: "plan-missing" };
    let progress;
    if (unitId) {
      const unit = await documents.getById(packageId, unitId);
      const current = openBond(data);
      const suffix = part > 1 ? String(part) : "";
      progress = forgeStoryCount(data.bondChapters?.[unitId]?.[`beats${suffix}`]);
      if (progress >= bondLength) return { ok: false, error: "chapter-completed" };
      if (
        !unit?.data ||
        !isCharacter(unit.data) ||
        !data.roster?.[unitId] ||
        current.id !== unitId ||
        current.part !== part
      )
        return { ok: false, error: "chapter-not-ongoing" };
      if (plan.data.bondUnitId !== unitId || Number(plan.data.bondPart || 1) !== part)
        return { ok: false, error: "chapter-not-ongoing" };
    } else {
      const count = allNodes(plan.data).length;
      progress = forgeStoryCount(data.progress?.[String(chapter)]?.normal);
      if (!count || progress >= count) return { ok: false, error: "chapter-completed" };
      if (
        forgeStoryCount(data.progress?.[String(chapter)]?.hard) ||
        forgeStoryCount(data.progress?.[String(chapter)]?.veryhard)
      )
        return { ok: false, error: "chapter-completed" };
      const current = openBond(data);
      if (current.id) {
        const unit = await documents.getById(packageId, current.id);
        return {
          ok: false,
          error: "bond-chapter-open",
          heldBy: text(unit?.data?.name),
          heldById: current.id,
          heldPart: current.part,
        };
      }
      const plans = (await documents.list(packageId, "chapter-plan")).filter((row) =>
        row.id.startsWith(`${runId}:chapter:`),
      );
      if (plans.some((row) => Number(row.id.slice(`${runId}:chapter:`.length)) > chapter))
        return { ok: false, error: "chapter-not-ongoing" };
      for (let previous = 1; previous < chapter; previous++) {
        const prior = plans.find((row) => row.id === planId(runId, previous));
        const required = allNodes(prior?.data).length;
        if (!required || forgeStoryCount(data.progress?.[String(previous)]?.normal) < required)
          return { ok: false, error: "chapter-not-ongoing" };
      }
    }
    return { ok: true, session, data, plan, progress };
  }

  async function reset(body) {
    const selected = target(body);
    if (!selected) return { ok: false, error: "bad-request" };
    if (typeof persistence.transaction !== "function") return { ok: false, error: "host-feature-unavailable" };
    const { runId, chapter, unitId, part } = selected;
    const preflight = await eligible(persistence.documents, selected, body);
    if (!preflight.ok) return preflight;
    return cancellation.reset(
      runId,
      async () => {
        return persistence.transaction(async ({ documents }) => {
          const current = await eligible(documents, selected, body);
          if (!current.ok) return current;
          const { session, data, plan, progress } = current;
          invalidateMemory(runId);

          const selectedRows = [plan];
          for (const kind of ["beat", "cg", "combat"]) {
            const prefix = `${runId}:${kind}:${chapter}:`;
            selectedRows.push(...(await documents.list(packageId, kind)).filter((row) => row.id.startsWith(prefix)));
          }
          const summaries = (await documents.list(packageId, "summary")).filter((row) =>
            row.id.startsWith(`${runId}:summary:`),
          );
          for (const row of summaries) {
            const summary = row.data || {};
            const from = Number(summary.from ?? summary.chapter),
              to = Number(summary.to ?? summary.chapter);
            if (
              row.id === `${runId}:summary:${chapter}` ||
              (!unitId && from <= chapter && to >= chapter) ||
              (Array.isArray(summary.bonds) && summary.bonds.some((bond) => String(bond) === String(chapter)))
            )
              selectedRows.push(row);
          }
          const aggregate = summaries.find((row) => row.id === `${runId}:summary:memory`);
          if (aggregate) {
            const memory = structuredClone(aggregate.data || {});
            const key = JSON.stringify([unitId ? "character-story" : "chapter", String(chapter)]);
            const relevant = (record) =>
              record?.key === key ||
              (record?.kind === (unitId ? "character-story" : "chapter") && String(record.id) === String(chapter));
            const records = Array.isArray(memory.records) ? memory.records : [];
            const covered = Array.isArray(memory.overview?.sources) ? memory.overview.sources : [];
            if (records.some(relevant) || covered.some((entry) => Array.isArray(entry) && entry[0] === key)) {
              memory.records = records.filter((record) => !relevant(record));
              memory.overview = null;
              memory.work = [];
              memory.status = { phase: "stale", retryable: true, reason: "source-changed" };
              if (
                !(await documents.update({
                  id: aggregate.id,
                  packageId,
                  expectedRevision: aggregate.revision,
                  name: aggregate.name,
                  description: aggregate.description,
                  data: memory,
                  updatedAt: new Date().toISOString(),
                }))
              )
                throw new Error("chapter-reset-write-conflict");
            }
          }
          data.storyRewardProgress = {
            ...data.storyRewardProgress,
            [String(chapter)]: forgeStoryPaidThrough(data, chapter, progress),
          };
          data.storyRevision = forgeStoryVersion(data) + 1;
          if (unitId) {
            const suffix = part > 1 ? String(part) : "";
            data.bondChapters[unitId][`beats${suffix}`] = 0;
          } else {
            data.progress = { ...data.progress, [String(chapter)]: { ...data.progress?.[String(chapter)], normal: 0 } };
          }
          if (String(data.reading?.chapter) === String(chapter)) delete data.reading;
          if (String(data.combatPending?.chapter) === String(chapter)) delete data.combatPending;
          if (data.preforge) delete data.preforge[String(chapter)];
          for (const row of new Map(selectedRows.map((row) => [row.id, row])).values()) {
            if (!(await documents.remove(packageId, row.id, row.revision)))
              throw new Error("chapter-reset-write-conflict");
          }
          const now = new Date().toISOString();
          const saved = session
            ? await documents.update({
                id: session.id,
                packageId,
                expectedRevision: session.revision,
                name: session.name,
                description: session.description,
                data,
                updatedAt: now,
              })
            : await documents.create({
                id: sessionId(runId),
                packageId,
                kind: "session",
                name: "session",
                description: "gacha run progress",
                data,
                createdAt: now,
                updatedAt: now,
              });
          if (!saved) throw new Error("chapter-reset-write-conflict");
          return {
            ok: true,
            chapter,
            storyRevision: data.storyRevision,
            progress: data.progress,
            ...(unitId ? { unitId, part, beats: 0 } : {}),
          };
        });
      },
      () => eligible(persistence.documents, selected, body),
    );
  }

  function post(router, path, handler) {
    return router.post(path, (request) => {
      const body = request?.body || {},
        runId = text(body.runId);
      const admit = forgeStoryShortMutations.has(path) ? cancellation.mutate : cancellation.run;
      return admit(runId, async () => {
        const session = await persistence.documents.getById(packageId, sessionId(runId));
        if (
          path !== "/chapter-plan" &&
          path !== "/bond-chapter/plan" &&
          path !== "/chapters" &&
          path !== "/continuity" &&
          path !== "/story-events" &&
          path !== "/story-event/plan"
        ) {
          const stale = changed(session?.data, body);
          if (stale) return stale;
        }
        const result = await handler(request);
        return result && typeof result === "object"
          ? { ...result, storyRevision: forgeStoryVersion(session?.data) }
          : result;
      });
    });
  }

  return { reset, post };
}
