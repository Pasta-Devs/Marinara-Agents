// Repair only progress still provable from owned items. Historical counters can
// include consumed items and remain authoritative when they are higher.
export function repairForgeAchievementProgress(session, runId, relics = {}) {
  if (!session || typeof session !== "object") return false;
  const whole = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
  };
  const lower = { "level-up": 0, "relic-feed": 0, facet: 0 };
  for (const [id, unit] of Object.entries(session.roster || {})) {
    if (!id.startsWith(`${runId}:unit:`) || !unit || typeof unit !== "object") continue;
    lower["level-up"] += Math.max(0, whole(unit.level) - 1);
    lower.facet += whole(unit.facet);
  }
  for (const relic of Object.values(relics || {})) {
    if (relic && typeof relic === "object") lower["relic-feed"] += whole(relic.level);
  }
  let changed = false;
  for (const [kind, count] of Object.entries(lower)) {
    if (!Number.isSafeInteger(count) || count <= whole(session.stats?.[kind])) continue;
    if (!changed) session.stats = { ...session.stats };
    session.stats[kind] = count;
    changed = true;
  }
  return changed;
}
