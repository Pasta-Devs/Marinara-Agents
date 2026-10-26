import { createHash as forgeFormationHash, randomUUID as forgeFormationUuid } from "node:crypto";

const forgeFormationModes = new Set(["classic", "formation"]);
const forgeFormationJobActive = (job) => job && ["preparing", "committing"].includes(job.status);
const forgeFormationStoredMode = (run) => (run?.combat?.mode === "formation" ? "formation" : "classic");
const forgeFormationRevision = (run) => (Number.isSafeInteger(run?.combat?.revision) ? run.combat.revision : 0);
// Generation errors reach the job as short codes; anything else is reported generically.
const forgeFormationFailureCode = (failure) => {
  const code = String(failure?.message || "");
  return /^[a-z][a-z0-9-]{0,63}$/u.test(code) ? code : "generation-failed";
};
export const forgeFormationUnitFingerprint = (unit) =>
  forgeFormationHash("sha256")
    .update(JSON.stringify([unit?.name, unit?.cardId, unit?.affinity, unit?.description, unit?.personality]))
    .digest("hex");

/** Stage combat kits separately; the existing run remains authoritative until one final transaction. */
export function createForgeFormationMigration({
  packageId,
  persistence,
  cancellation,
  generateKit,
  normalizeKit,
  logger,
  concurrency = 3,
  retireInactiveFight = async () => {},
}) {
  const documents = persistence.documents;
  const boot = forgeFormationUuid();
  const running = new Map();
  let disposed = false;
  const jobId = (runId) => `${runId}:formation-conversion`;
  const validRunId = (value) => typeof value === "string" && value.length > 0 && value.length <= 160;
  const units = async (store, runId) =>
    (await store.list(packageId, "unit")).filter(
      (row) => row?.id?.startsWith(`${runId}:unit:`) && row.data?.kind === "character",
    );
  const currentKit = (unit) =>
    normalizeKit(unit?.formationKit) &&
    (!unit.formationKitSource || unit.formationKitSource === forgeFormationUnitFingerprint(unit));
  const summary = (job) =>
    job
      ? {
          id: job.id,
          targetMode: job.targetMode,
          sourceMode: job.sourceMode,
          status: job.status,
          error: job.error || "",
          units: Object.values(job.units || {}).map(({ unitId, name, status, error }) => ({
            unitId,
            name,
            status,
            error: error || "",
          })),
        }
      : null;
  const readWorld = async (store, runId) => {
    const index = await store.getById(packageId, "index");
    const run = (Array.isArray(index?.data?.runs) ? index.data.runs : []).find((row) => row?.runId === runId);
    const job = await store.getById(packageId, jobId(runId));
    const session = await store.getById(packageId, `${runId}:session`);
    return { index, run, job, session };
  };
  const save = async (store, doc, id, kind, data) => {
    const common = {
      id,
      packageId,
      name: doc?.name ?? kind,
      description: doc?.description ?? "Gacha Forge combat conversion",
      data,
    };
    const now = new Date().toISOString();
    const saved = doc
      ? await store.update({ ...common, expectedRevision: doc.revision, updatedAt: now })
      : await store.create({ ...common, kind, createdAt: now, updatedAt: now });
    if (!saved) throw new Error("formation-write-conflict");
    return saved;
  };
  const transaction = (work) => persistence.transaction(work);
  const result = (run, job) => ({
    ok: true,
    mode: forgeFormationStoredMode(run),
    combat: run?.combat,
    conversion: summary(job),
  });
  const pendingBattle = (session) => !!(session?.combatPending || session?.farmPending || session?.towerPending);
  const teamError = (session) => {
    const presets = session?.presets;
    const selected = presets?.[session?.activePreset || 0]?.board;
    if (!selected) return "";
    const front = (selected.front || []).filter(Boolean);
    const back = (selected.back || []).filter(Boolean);
    return front.length + back.length > 4 || front.length > 3 || back.length > 3
      ? "formation-team-too-large"
      : !front.length && back.length
        ? "formation-front-required"
        : "";
  };
  const entry = (row) => ({
    unitId: row.id,
    name: String(row.data.name || "").slice(0, 160),
    fingerprint: forgeFormationUnitFingerprint(row.data),
    status: currentKit(row.data) ? "ready" : "pending",
    ...(currentKit(row.data) ? { kit: normalizeKit(row.data.formationKit) } : {}),
  });
  // A ready kit for an unchanged character is kept, whether its job failed or was cancelled.
  const reuse = (previous, row) =>
    previous?.status === "ready" &&
    previous.fingerprint === forgeFormationUnitFingerprint(row.data) &&
    normalizeKit(previous.kit)
      ? previous
      : entry(row);
  async function updateJob(runId, id, mutate) {
    return transaction(async ({ documents: store }) => {
      const row = await store.getById(packageId, jobId(runId));
      if (!row || row.data.id !== id) return null;
      const next = structuredClone(row.data);
      const value = await mutate(next, store);
      if (value === false) return null;
      await save(store, row, row.id, "formation-conversion", next);
      return { job: next, value };
    });
  }
  async function commit(runId, id) {
    const eligibility = async () => {
      await retireInactiveFight(runId);
      const state = await readWorld(documents, runId);
      if (!state.run || state.job?.data?.id !== id || !forgeFormationJobActive(state.job.data))
        return { ok: false, error: "conversion-changed" };
      if (pendingBattle(state.session?.data)) return { ok: false, error: "combat-in-progress" };
      return { ok: true };
    };
    return cancellation.reset(
      runId,
      async () => {
        return transaction(async ({ documents: store }) => {
          const { index, run, job, session } = await readWorld(store, runId);
          if (!run || job?.data?.id !== id || !forgeFormationJobActive(job.data))
            return { ok: false, error: "conversion-changed" };
          const state = structuredClone(job.data);
          if (
            forgeFormationStoredMode(run) !== state.sourceMode ||
            forgeFormationRevision(run) !== state.sourceRevision
          )
            return { ok: false, error: "combat-mode-changed" };
          if (pendingBattle(session?.data)) return { ok: false, error: "combat-in-progress" };
          if (state.targetMode === "formation") {
            const error = teamError(session?.data);
            if (error) return { ok: false, error };
            const rows = await units(store, runId);
            for (const row of rows) {
              const staged = state.units[row.id];
              if (
                staged?.status !== "ready" ||
                staged.fingerprint !== forgeFormationUnitFingerprint(row.data) ||
                !normalizeKit(staged.kit)
              )
                return { ok: false, error: "units-changed" };
            }
            for (const row of rows) {
              const data = {
                ...row.data,
                formationKit: normalizeKit(state.units[row.id].kit),
                formationKitSource: state.units[row.id].fingerprint,
              };
              await save(store, row, row.id, row.kind, data);
            }
          }
          const data = structuredClone(index.data);
          const selected = data.runs.find((world) => world.runId === runId);
          selected.combat = { ...selected.combat, mode: state.targetMode, revision: state.sourceRevision + 1 };
          await save(store, index, "index", index.kind, data);
          state.status = "committed";
          state.error = "";
          await save(store, job, job.id, job.kind, state);
          return result(selected, state);
        });
      },
      eligibility,
    );
  }
  async function execute(runId, id, signal) {
    await updateJob(runId, id, (job) => {
      if (!forgeFormationJobActive(job)) return false;
      // A prior process may have paid for these attempts. Recovery requires an explicit retry.
      for (const unit of Object.values(job.units)) {
        if (unit.status === "generating" && unit.owner !== boot) {
          unit.status = "failed";
          unit.error = "generation-interrupted";
        }
      }
    });
    const worker = async () => {
      while (!signal.aborted && !disposed) {
        const claimed = await updateJob(runId, id, async (job, store) => {
          if (!forgeFormationJobActive(job)) return false;
          const item = Object.values(job.units).find((unit) => unit.status === "pending");
          if (!item) return false;
          const { run } = await readWorld(store, runId);
          const row = await store.getById(packageId, item.unitId);
          if (!run || !row || row.data?.kind !== "character") {
            item.status = "failed";
            item.error = "unit-missing";
            return {};
          }
          item.status = "generating";
          item.fingerprint = forgeFormationUnitFingerprint(row.data);
          item.name = String(row.data.name || "").slice(0, 160);
          item.owner = boot;
          item.attempt = forgeFormationUuid();
          return { item: structuredClone(item), unit: row.data, run };
        });
        if (!claimed) return;
        if (!claimed.value.item) continue;
        const { item, unit, run } = claimed.value;
        let kit, error;
        try {
          const generated = await generateKit({ runId, run, unit, signal });
          kit = normalizeKit(generated?.ok === true ? generated.value : generated);
          signal.throwIfAborted();
          if (!kit) {
            error = "invalid-kit";
            logger?.warn?.("[gacha-forge] Formation kit for %s did not fit the combat rules", item.name);
          }
        } catch (failure) {
          error = signal.aborted ? "generation-interrupted" : forgeFormationFailureCode(failure);
          if (!signal.aborted) logger?.warn?.(failure, "[gacha-forge] Formation kit for %s failed", item.name);
        }
        await updateJob(runId, id, (job) => {
          const latest = job.units[item.unitId];
          if (!forgeFormationJobActive(job) || latest?.attempt !== item.attempt || latest.status !== "generating")
            return false;
          latest.status = error ? "failed" : "ready";
          latest.error = error || "";
          if (kit && !error) latest.kit = kit;
        });
      }
    };
    // Every worker stops before a failure is reported, so none can keep claiming units afterwards.
    const workers = await Promise.allSettled(
      Array.from({ length: Math.max(1, Math.min(3, concurrency)) }, () => worker()),
    );
    const crashed = workers.find((outcome) => outcome.status === "rejected");
    if (crashed) throw crashed.reason;
    if (disposed || signal.aborted) return;
    const staged = await updateJob(runId, id, (job) => {
      if (!forgeFormationJobActive(job)) return false;
      if (Object.values(job.units).some((unit) => unit.status === "failed")) {
        job.status = "failed";
        job.error = "unit-conversion-failed";
      } else job.status = "committing";
    });
    if (!staged || staged.job.status !== "committing") return;
    const committed = await commit(runId, id);
    if (!committed.ok) {
      await updateJob(runId, id, (job) => {
        if (!forgeFormationJobActive(job)) return false;
        job.status = "failed";
        job.error = committed.error || "commit-failed";
      });
    }
  }
  function kick(runId, id) {
    if (disposed || running.has(runId)) return;
    const controller = new AbortController();
    const promise = Promise.resolve()
      .then(() => execute(runId, id, controller.signal))
      .catch(async (error) => {
        logger?.warn?.(error, "[gacha-forge] combat conversion stopped before commit");
        await updateJob(runId, id, (job) => {
          if (!forgeFormationJobActive(job)) return false;
          job.status = "failed";
          job.error = "conversion-failed";
        }).catch(() => {});
      })
      .finally(() => running.delete(runId));
    running.set(runId, { id, controller, promise });
  }
  async function status(body) {
    if (!validRunId(body?.runId)) return { ok: false, error: "bad-request" };
    const { run, job } = await readWorld(documents, body.runId);
    if (!run) return { ok: false, error: "not-found" };
    if (forgeFormationJobActive(job?.data)) kick(body.runId, job.data.id);
    return result(run, job?.data);
  }
  async function start(body) {
    const runId = body?.runId;
    if (!validRunId(runId) || !forgeFormationModes.has(body?.targetMode) || body.confirmed !== true)
      return { ok: false, error: "confirmation-required" };
    if (disposed) return { ok: false, error: "cancelled" };
    if (typeof persistence.transaction !== "function") return { ok: false, error: "host-feature-unavailable" };
    await retireInactiveFight(runId);
    const answer = await transaction(async ({ documents: store }) => {
      const { run, job, session } = await readWorld(store, runId);
      if (!run) return { ok: false, error: "not-found" };
      if (
        forgeFormationJobActive(job?.data) ||
        (job?.data?.status === "failed" && job.data.targetMode === body.targetMode)
      )
        return result(run, job.data);
      if (pendingBattle(session?.data)) return { ok: false, error: "combat-in-progress" };
      if (body.targetMode === "formation") {
        const error = teamError(session?.data);
        if (error) return { ok: false, error };
      }
      const roster = body.targetMode === "formation" ? await units(store, runId) : [];
      if (forgeFormationStoredMode(run) === body.targetMode && roster.every((row) => currentKit(row.data)))
        return result(run, null);
      const state = {
        id: forgeFormationUuid(),
        runId,
        sourceMode: forgeFormationStoredMode(run),
        sourceRevision: forgeFormationRevision(run),
        targetMode: body.targetMode,
        status: "preparing",
        units: Object.fromEntries(
          roster.map((row) => [
            row.id,
            job?.data?.targetMode === body.targetMode ? reuse(job.data.units?.[row.id], row) : entry(row),
          ]),
        ),
      };
      await save(store, job, jobId(runId), "formation-conversion", state);
      return result(run, state);
    });
    if (answer.ok && forgeFormationJobActive(answer.conversion)) kick(runId, answer.conversion.id);
    return answer;
  }
  async function retry(body) {
    const runId = body?.runId;
    if (!validRunId(runId) || !body.jobId || body.confirmed !== true)
      return { ok: false, error: "confirmation-required" };
    await retireInactiveFight(runId);
    const changed = await updateJob(runId, body.jobId, async (job, store) => {
      if (job.status !== "failed") return false;
      const { run } = await readWorld(store, runId);
      if (
        !run ||
        forgeFormationStoredMode(run) !== job.sourceMode ||
        forgeFormationRevision(run) !== job.sourceRevision
      )
        return false;
      const current = job.targetMode === "formation" ? await units(store, runId) : [];
      job.units = Object.fromEntries(current.map((row) => [row.id, reuse(job.units[row.id], row)]));
      job.status = "preparing";
      job.error = "";
    });
    if (!changed) return { ok: false, error: "conversion-changed" };
    kick(runId, body.jobId);
    return status(body);
  }
  async function cancel(body) {
    if (!validRunId(body?.runId) || !body.jobId) return { ok: false, error: "bad-request" };
    const changed = await updateJob(body.runId, body.jobId, (job) => {
      if (!forgeFormationJobActive(job) && job.status !== "failed") return false;
      job.status = "cancelled";
    });
    if (!changed) return { ok: false, error: "conversion-changed" };
    running.get(body.runId)?.controller.abort();
    return status(body);
  }
  async function guard(runId) {
    await retireInactiveFight(runId);
    const job = await documents.getById(packageId, jobId(runId));
    return forgeFormationJobActive(job?.data)
      ? { ok: false, error: "combat-conversion-in-progress", conversion: summary(job.data) }
      : { ok: true };
  }
  async function ensure(runId, run) {
    const available = await guard(runId);
    if (!available.ok || forgeFormationStoredMode(run) !== "formation") return available;
    if ((await units(documents, runId)).every((row) => currentKit(row.data))) return { ok: true };
    const started = await start({ runId, targetMode: "formation", confirmed: true });
    return { ...started, ok: false, error: "combat-conversion-in-progress" };
  }
  return {
    start,
    status,
    retry,
    cancel,
    ensure,
    guard,
    settled: async (runId) => running.get(runId)?.promise,
    async removeWorld(runId) {
      running.get(runId)?.controller.abort();
    },
    dispose() {
      disposed = true;
      for (const job of running.values()) job.controller.abort();
    },
  };
}
