// Maintained helpers used by the existing growth/equipment routes.
const forgeUpgradeWhole = (value) => (Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0);

export function forgeTrainingCost(level, affinity, nextCost, materialId, definitions) {
  const price = nextCost(level);
  if (!price) return null;
  const items = [{ id: materialId("tenet", affinity || "", price.tier), need: price.tenet }];
  if (price.mandate) items.push({ id: materialId("mandate", "any", 1), need: price.mandate });
  return {
    funds: price.funds,
    items: items.map((item) => ({ ...item, name: definitions.get(item.id)?.name || item.id })),
  };
}

/** Pure preview. Applying the returned costs remains the existing route's CAS write. */
export function forgeTrainingPlan({ level, cap, materials = {}, funds, costAtLevel, levels }) {
  const from = Math.max(1, forgeUpgradeWhole(level));
  const ceiling = Math.max(from, forgeUpgradeWhole(cap));
  if (levels !== undefined && (!Number.isInteger(levels) || levels < 1 || levels > ceiling - from))
    return { ok: false, error: "bad-levels" };
  const wanted = levels ?? ceiling - from;
  const purse = { ...materials };
  const spent = new Map();
  let cash = forgeUpgradeWhole(funds);
  let at = from;
  let reason = "at-cap";
  while (at < ceiling && at - from < wanted) {
    const cost = costAtLevel(at);
    if (!cost) break;
    if (cost.items.some((item) => forgeUpgradeWhole(purse[item.id]) < forgeUpgradeWhole(item.need))) {
      reason = "short-materials";
      break;
    }
    if (cash < forgeUpgradeWhole(cost.funds)) {
      reason = "short-funds";
      break;
    }
    cash -= forgeUpgradeWhole(cost.funds);
    for (const item of cost.items) {
      const need = forgeUpgradeWhole(item.need);
      purse[item.id] = forgeUpgradeWhole(purse[item.id]) - need;
      const prior = spent.get(item.id);
      spent.set(item.id, { id: item.id, name: item.name || item.id, need: (prior?.need || 0) + need });
    }
    at += 1;
  }
  if (at === from || (levels !== undefined && at - from !== levels)) return { ok: false, error: reason };
  return {
    ok: true,
    levelFrom: from,
    levelTo: at,
    levels: at - from,
    funds: forgeUpgradeWhole(funds) - cash,
    items: [...spent.values()],
  };
}

export function forgeTrainingPreviews(form, materials, funds, costAtLevel) {
  if (!form || !Array.isArray(form.tracks)) return form;
  return {
    ...form,
    tracks: form.tracks.map((track) => ({
      ...track,
      auto: track.live
        ? forgeTrainingPlan({ level: track.level, cap: Math.min(track.max, track.cap), materials, funds, costAtLevel })
        : null,
    })),
  };
}

export function forgeGearIsOccupied(roster, unitId, slot, itemId) {
  return Boolean(itemId && Object.entries(roster || {}).some(([id, unit]) => id !== unitId && unit?.[slot] === itemId));
}
