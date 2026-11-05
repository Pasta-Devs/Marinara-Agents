/* global FORGE_FORMATION_KIT_PROMPT */
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
  // The kit prompt the current engine generates with; a kit stamped with an older one is remade.
  kitPrompt = typeof FORGE_FORMATION_KIT_PROMPT === "number" ? FORGE_FORMATION_KIT_PROMPT : 1,
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
  // A playable kit can fight now; a current one was also written by the current kit prompt.
  const playableKit = (unit) =>
    !!normalizeKit(unit?.formationKit) &&
    (!unit.formationKitSource || unit.formationKitSource === forgeFormationUnitFingerprint(unit));
  const currentKit = (unit) => playableKit(unit) && unit.formationKitPrompt === kitPrompt;
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
    return front.length > 3 || back.length > 3
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
    ...(currentKit(row.data) ? { kit: normalizeKit(row.data.formationKit), kitPrompt } : {}),
  });
  // A paid, ready kit for an unchanged character, written by the current kit prompt, is never paid for again.
  const usable = (previous, row) =>
    previous?.status === "ready" &&
    previous.fingerprint === forgeFormationUnitFingerprint(row.data) &&
    previous.kitPrompt === kitPrompt &&
    !!normalizeKit(previous.kit);
  // A ready kit is kept, whether its job failed or was cancelled, and so is one an old kit stands in for.
  const reuse = (previous, row) =>
    usable(previous, row) ? previous : usable(previous?.staged, row) ? previous.staged : entry(row);
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
    let sameMode = false;
    const eligibility = async () => {
      await retireInactiveFight(runId);
      const state = await readWorld(documents, runId);
      if (!state.run || state.job?.data?.id !== id || !forgeFormationJobActive(state.job.data))
        return { ok: false, error: "conversion-changed" };
      sameMode = state.job.data.sourceMode === state.job.data.targetMode;
      if (!sameMode && pendingBattle(state.session?.data)) return { ok: false, error: "combat-in-progress" };
      return { ok: true };
    };
    // A remake within Formation changes no story and no saved fight (pending fights replay their own frozen
    // snapshot), so it commits without cancelling story work. Only a real mode switch resets the world.
    const gate = (await readWorld(documents, runId)).job?.data;
    const reset =
      gate?.sourceMode === gate?.targetMode
        ? async (_runId, work, beforeCancel) => {
            const permitted = await beforeCancel();
            return permitted?.ok === false ? permitted : work();
          }
        : (runId, work, beforeCancel) => cancellation.reset(runId, work, beforeCancel);
    return reset(
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
          if (state.sourceMode !== state.targetMode && pendingBattle(session?.data))
            return { ok: false, error: "combat-in-progress" };
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
                ...(state.units[row.id].kitPrompt != null ? { formationKitPrompt: state.units[row.id].kitPrompt } : {}),
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
          kit = normalizeKit(generated?.ok === true ? generated.value : generated, { rarity: unit.rarity });
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
          if (kit && !error) Object.assign(latest, { kit, kitPrompt });
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
    // Kits that still fight but were written for older Formation rules, so Settings can offer to remake them.
    const staleKits =
      forgeFormationStoredMode(run) === "formation"
        ? (await units(documents, body.runId)).filter((row) => playableKit(row.data) && !currentKit(row.data)).length
        : 0;
    return { ...result(run, job?.data), staleKits };
  }
  // A remake the player cancelled (or that failed) is not forced again. After a cancel, later jobs only add
  // missing kits and keep each old kit, and its old stamp, so Settings still offers the remake; a failed job
  // waits for its explicit retry.
  const declinedRemake = (job) =>
    job?.kitPrompt === kitPrompt && (["failed", "cancelled"].includes(job.status) || job.declined === true);
  // A kept old kit carries the paid kit it stands in for (`staged`, which commit ignores), so a later remake
  // or retry uses that one instead of paying again. A current kit needs none, and `staged` is always flat:
  // one entry deep however many jobs keep it.
  const keep = (row, previous) => {
    const paid = currentKit(row.data) ? null : [previous, previous?.staged].find((candidate) => usable(candidate, row));
    const { staged: _nested, ...staged } = paid || {};
    return {
      unitId: row.id,
      name: String(row.data.name || "").slice(0, 160),
      fingerprint: forgeFormationUnitFingerprint(row.data),
      status: "ready",
      kit: normalizeKit(row.data.formationKit),
      kitPrompt: row.data.formationKitPrompt ?? null,
      ...(paid ? { staged } : {}),
    };
  };
  async function start(body, { onlyMissing = false } = {}) {
    const runId = body?.runId;
    if (!validRunId(runId) || !forgeFormationModes.has(body?.targetMode) || body.confirmed !== true)
      return { ok: false, error: "confirmation-required" };
    if (disposed) return { ok: false, error: "cancelled" };
    if (typeof persistence.transaction !== "function") return { ok: false, error: "host-feature-unavailable" };
    await retireInactiveFight(runId);
    const answer = await transaction(async ({ documents: store }) => {
      const { run, job, session } = await readWorld(store, runId);
      if (!run) return { ok: false, error: "not-found" };
      // A failed job may have been paid for and waits for its explicit retry; only a cancelled one is followed
      // by a new job.
      if (
        forgeFormationJobActive(job?.data) ||
        (job?.data?.status === "failed" && job.data.targetMode === body.targetMode)
      )
        return result(run, job.data);
      // A kit refresh within Formation leaves pending fights alone: they replay their own frozen snapshot.
      const refresh = forgeFormationStoredMode(run) === "formation" && body.targetMode === "formation";
      if (!refresh && pendingBattle(session?.data)) return { ok: false, error: "combat-in-progress" };
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
        kitPrompt,
        status: "preparing",
        ...(onlyMissing ? { declined: true } : {}),
        units: Object.fromEntries(
          roster.map((row) => [
            row.id,
            onlyMissing && playableKit(row.data)
              ? keep(row, job?.data?.targetMode === body.targetMode ? job.data.units?.[row.id] : null)
              : job?.data?.targetMode === body.targetMode
                ? reuse(job.data.units?.[row.id], row)
                : entry(row),
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
      // Retrying a job that only adds missing kits keeps the old kits the player chose to keep.
      job.units = Object.fromEntries(
        current.map((row) => [
          row.id,
          job.declined === true && playableKit(row.data) ? keep(row, job.units[row.id]) : reuse(job.units[row.id], row),
        ]),
      );
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
    const rows = await units(documents, runId);
    if (rows.every((row) => currentKit(row.data))) return { ok: true };
    const playable = rows.every((row) => playableKit(row.data));
    // Once a remake under these rules was cancelled or failed, the old kits keep fighting; Settings offers the
    // remake (or its retry) again, and after a cancel only a character with no kit at all is still generated.
    const declined = declinedRemake((await documents.getById(packageId, jobId(runId)))?.data);
    if (playable && declined) return { ok: true };
    const started = await start({ runId, targetMode: "formation", confirmed: true }, { onlyMissing: declined });
    if (forgeFormationJobActive(started.conversion))
      return { ...started, ok: false, error: "combat-conversion-in-progress" };
    // Nothing could start (a failed job awaiting its retry, say): kits that can fight, fight.
    if (playable) return { ok: true };
    // A character with no kit waits for that retry in Story Continuity; the battle start never pays for it.
    if (started.conversion?.status === "failed") return { ...started, ok: false, error: "combat-conversion-failed" };
    return { ...started, ok: false, error: started.error || "combat-conversion-in-progress" };
  }
  // The elements a world's roster can bring, read the way guide generation reads them.
  async function elements(runId) {
    const roster = (await documents.getById(packageId, `${runId}:session`))?.data?.roster || {};
    return [
      ...new Set(
        (await units(documents, runId))
          .filter((row) => roster[row.id])
          .map((row) => String(row.data.affinity || "").toLowerCase())
          .filter(Boolean),
      ),
    ];
  }
  return {
    start,
    status,
    retry,
    cancel,
    ensure,
    guard,
    elements,
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
