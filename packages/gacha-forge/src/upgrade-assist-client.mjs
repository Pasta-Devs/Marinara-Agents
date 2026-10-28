export const forgeUpgradeEnglish = Object.freeze({
  "upgrade.auto": "Auto-select",
  "upgrade.autoHint": "Select available resources for affordable upgrades, then review and confirm.",
  "upgrade.training": "Train to Lv {level}",
  "upgrade.funds": "Funds",
  "upgrade.preview": "Lv {from} → {to}. Cost: {cost}.",
  "gear.autoFree": "Auto-equip free gear",
  "gear.autoFreeHint":
    "Equip suitable unassigned gear that improves this unit's displayed BP. Never takes gear from another unit.",
  "gear.autoBusy": "Equipping…",
  "gear.autoUnavailable": "Equipment changed. Refresh the unit and try again.",
});

const forgeAssistWhole = (value) => (Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0);

export function forgeInsightAutoSelection(growth) {
  if (!growth) return {};
  let funds = forgeAssistWhole(growth.wallet?.funds);
  let capacity = 0;
  let level = Math.max(1, forgeAssistWhole(growth.level));
  for (const step of [...(growth.ladder || [])].sort((a, b) => Number(a.level) - Number(b.level))) {
    if (Number(step.level) < level) continue;
    if (Number(step.level) !== level || funds < forgeAssistWhole(step.funds)) break;
    capacity += forgeAssistWhole(step.xp);
    funds -= forgeAssistWhole(step.funds);
    level += 1;
  }
  let room = Math.max(0, capacity - forgeAssistWhole(growth.xp));
  const selected = {};
  // Matches the server's low-tier-first spending order and its final-item rounding.
  for (const tier of [...(growth.tiers || [])].sort((a, b) => Number(a.xp) - Number(b.xp))) {
    const xp = forgeAssistWhole(tier.xp);
    if (!room || !xp) continue;
    const count = Math.min(forgeAssistWhole(growth.wallet?.insight?.[tier.id]), Math.ceil(room / xp));
    if (count) selected[tier.id] = count;
    room = Math.max(0, room - count * xp);
  }
  return selected;
}

export function forgeAffordableRelicFood(relics, targetId) {
  const target = relics?.items?.find((item) => item.id === targetId);
  const cost = forgeAssistWhole(target?.feedCost);
  if (!target || !cost) return [];
  const available = new Map(relics.items.map((item) => [item.id, item]));
  const budget = Math.min(
    Math.max(0, target.levelCap - target.level),
    Math.floor(forgeAssistWhole(relics.wallet?.funds) / cost),
  );
  return [...new Set(relics.autoPick || [])]
    .filter((id) => {
      const item = available.get(id);
      return item && id !== targetId && !item.locked && !item.equipped && !item.wornBy && item.rarity < 5;
    })
    .slice(0, budget);
}

export function forgeBestFreeGear(gear, slotKey, unitId) {
  const slot = gear?.slots?.find((item) => item.key === slotKey);
  if (!slot || slot.locked) return null;
  const candidates = slot.kind === "weapon" ? gear.options : slot.options;
  return (
    [...(candidates || [])]
      .filter(
        (item) =>
          item?.id &&
          !item.equipped &&
          !item.wornElsewhere &&
          !item.heldByName &&
          (!item.heldBy || item.heldBy === unitId) &&
          Number.isFinite(Number(item.cpIf)) &&
          Number(item.cpIf) > Number(gear.cp || 0),
      )
      .sort((a, b) => Number(b.cpIf) - Number(a.cpIf) || String(a.id).localeCompare(String(b.id)))[0] || null
  );
}

export async function forgeEquipFreeGear(host) {
  const runId = host._run?.runId;
  const unitId = host._rosterUnitId;
  if (!runId || !unitId || host._equipBusy) return;
  host._equipBusy = true;
  host._forgeUpgradeError = null;
  host._renderBrowser();
  try {
    for (const slot of host._growth?.gear?.slots || []) {
      if (host._run?.runId !== runId || host._rosterUnitId !== unitId) break;
      const best = forgeBestFreeGear(host._growth.gear, slot.key, unitId);
      if (!best) continue;
      const result = await host._postJson("/equip", {
        runId,
        unitId,
        slot: slot.key,
        weaponId: slot.kind === "weapon" ? best.id : "",
        relicId: slot.kind === "weapon" ? "" : best.id,
        onlyFree: true,
      });
      if (host._run?.runId !== runId || host._rosterUnitId !== unitId) break;
      if (!result?.ok) {
        host._forgeUpgradeError = { runId, unitId, message: forgeUpgradeEnglish["gear.autoUnavailable"] };
        break;
      }
      host._growth = { ...host._growth, ...result };
      host._growthRev += 1;
    }
  } catch {
    if (host._run?.runId === runId && host._rosterUnitId === unitId) {
      host._forgeUpgradeError = { runId, unitId, message: forgeUpgradeEnglish["gear.autoUnavailable"] };
    }
  } finally {
    host._equipBusy = false;
    if (host._run?.runId && host._rosterUnitId) host._renderBrowser();
  }
}

export function forgeSelectedTrainingLevels(host, track) {
  const selected = host._forgeTrainingSelection;
  return selected &&
    selected.runId === host._run?.runId &&
    selected.unitId === host._rosterUnitId &&
    selected.track === track &&
    selected.revision === host._growthRev
    ? selected.plan.levels
    : 1;
}

function forgeAssistButton(text, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "gw-reset forge-upgrade-auto";
  button.textContent = text;
  button.onclick = (event) => {
    event.stopPropagation();
    action();
  };
  return button;
}

export function wireForgeUpgradeAssists(host) {
  const root = host._root;
  if (!root || !host._growth || !host._rosterUnitId) return;
  if (!root.querySelector("[data-forge-upgrade-style]")) {
    const style = document.createElement("style");
    style.dataset.forgeUpgradeStyle = "";
    style.textContent =
      ".forge-upgrade-auto{min-height:44px;white-space:normal}.forge-upgrade-preview{font:var(--t-sm)/1.5 var(--body);color:var(--text);overflow-wrap:anywhere}.forge-upgrade-actions{display:flex;flex-wrap:wrap;gap:8px;margin-block:8px}.gw-acts{flex-wrap:wrap}";
    root.append(style);
  }
  const actions = root.querySelector(".gw-acts");
  if (actions && !actions.querySelector("[data-forge-auto-insight]")) {
    const auto = forgeAssistButton(forgeUpgradeEnglish["upgrade.auto"], () => {
      const selected = forgeInsightAutoSelection(host._growth);
      host._feed = Object.keys(selected).length ? selected : null;
      host._paintGrowth();
    });
    auto.dataset.forgeAutoInsight = "";
    auto.title = forgeUpgradeEnglish["upgrade.autoHint"];
    actions.insertBefore(auto, actions.querySelector("[data-feed-reset]"));
  }
  for (const confirm of root.querySelectorAll("button[data-form-up]")) {
    const key = confirm.getAttribute("data-form-up");
    const track = host._growth.form?.tracks?.find((item) => item.key === key);
    if (!track?.auto?.ok || confirm.parentElement.querySelector("[data-forge-auto-training]")) continue;
    confirm.dataset.forgeTrainingLabel ||= confirm.textContent || "";
    const showPreview = () => {
      confirm.textContent = forgeUpgradeEnglish["upgrade.training"].replace("{level}", String(track.auto.levelTo));
      let preview = confirm.closest(".fm-track")?.querySelector("[data-forge-training-preview]");
      if (!preview) {
        preview = document.createElement("p");
        preview.dataset.forgeTrainingPreview = "";
        preview.className = "forge-upgrade-preview";
        preview.setAttribute("role", "status");
        confirm.closest(".fm-track")?.append(preview);
      }
      if (preview)
        preview.textContent = forgeUpgradeEnglish["upgrade.preview"]
          .replace("{from}", String(track.auto.levelFrom))
          .replace("{to}", String(track.auto.levelTo))
          .replace(
            "{cost}",
            [
              ...track.auto.items.map((item) => `${item.need} ${item.name}`),
              `${track.auto.funds} ${forgeUpgradeEnglish["upgrade.funds"]}`,
            ].join(", "),
          );
    };
    const auto = forgeAssistButton(forgeUpgradeEnglish["upgrade.auto"], () => {
      for (const previous of root.querySelectorAll("button[data-forge-training-label]")) {
        if (previous !== confirm) previous.textContent = previous.dataset.forgeTrainingLabel;
      }
      for (const previous of root.querySelectorAll("[data-forge-training-preview]")) previous.remove();
      host._forgeTrainingSelection = {
        runId: host._run?.runId,
        unitId: host._rosterUnitId,
        revision: host._growthRev,
        track: key,
        plan: track.auto,
      };
      showPreview();
    });
    auto.dataset.forgeAutoTraining = key;
    auto.title = forgeUpgradeEnglish["upgrade.autoHint"];
    confirm.before(auto);
    const selected = host._forgeTrainingSelection;
    if (selected?.track === key && forgeSelectedTrainingLevels(host, key) > 1) showPreview();
  }
  const gear = root.querySelector(".cp-panel .gr-root.gear");
  if (gear && !gear.querySelector("[data-forge-auto-equip]")) {
    const row = document.createElement("div");
    row.className = "forge-upgrade-actions";
    const button = forgeAssistButton(
      host._equipBusy ? forgeUpgradeEnglish["gear.autoBusy"] : forgeUpgradeEnglish["gear.autoFree"],
      () => void forgeEquipFreeGear(host),
    );
    button.dataset.forgeAutoEquip = "";
    button.title = forgeUpgradeEnglish["gear.autoFreeHint"];
    button.disabled = !!host._equipBusy;
    row.append(button);
    gear.prepend(row);
    const error = host._forgeUpgradeError;
    if (error && error.runId === host._run?.runId && error.unitId === host._rosterUnitId) {
      const note = document.createElement("p");
      note.className = "forge-upgrade-preview";
      note.setAttribute("role", "status");
      note.textContent = error.message;
      row.append(note);
    }
  }
}
