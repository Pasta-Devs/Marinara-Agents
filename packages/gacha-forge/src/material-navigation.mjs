// Maintained source inlined beside browser-presentation.mjs.
export const forgeMaterialEnglish = Object.freeze({
  "materials.find": "Find {material}",
  "materials.insight": "Find Insight",
  "materials.funds": "Funds",
});

export function forgeMaterialDestination(id) {
  const value = String(id || "");
  const [kind, key] = value.split(":");
  if (kind === "mandate") return { event: "login" };
  if (["sigil", "doctrine", "tenet"].includes(kind) && /^[a-z]+$/u.test(key || ""))
    return { stage: kind === "tenet" ? "form" : "asc", family: `${kind}:${key}` };
  if (["shard", "core", "prism", "insight"].includes(kind)) return { stage: "xp" };
  return kind === "funds" ? { stage: "funds" } : null;
}

export function openForgeMaterial(host, id) {
  const target = forgeMaterialDestination(id);
  if (!host._run || !target) return;
  if (target.event) {
    host._eventId = target.event;
    host._hudView = "events";
    host._renderBrowser();
    return;
  }
  host._forgeMaterialTarget = target;
  host._hudView = "farm";
  host._farmView = target.family && !host._farm?.locked?.includes(target.stage) ? target.stage : "root";
  host._farmDay = null;
  host._farmState = host._farm ? "ready" : "loading";
  host._farmRev += 1;
  host._renderBrowser();
  host._loadFarm();
}

export function revealForgeMaterialDomain(host) {
  const target = host._forgeMaterialTarget;
  if (!target || host._hudView !== "farm" || host._farmState !== "ready") return;
  if (target.family && host._farmView !== "root") {
    const families = target.stage === "form" ? host._farm?.formWheel : host._farm?.wheel;
    const family = families?.find((item) => item.id === target.family);
    const today = Number(host._farm?.today) || 0;
    const days = family?.days || [];
    const day = [...days].sort((a, b) => ((a - today + 7) % 7) - ((b - today + 7) % 7))[0];
    if (Number.isInteger(day) && day !== (host._farmDay ?? today)) {
      host._farmDay = day === today ? null : day;
      queueMicrotask(() => {
        if (host._forgeMaterialTarget === target && host._hudView === "farm") host._renderBrowser();
      });
      return;
    }
  }
  // Use the existing battle screen and availability rules. Opening a future rotation never starts a battle.
  const card =
    target.family && host._farmView !== "root"
      ? [...host._root.querySelectorAll(".plate.fam")].find(
          (item) =>
            [...item.querySelectorAll("[data-family]")].some(
              (row) => row.getAttribute("data-family") === target.family,
            ) ||
            item.querySelector(".name")?.textContent ===
              (target.stage === "form" ? host._farm?.formWheel : host._farm?.wheel)?.find(
                (item) => item.id === target.family,
              )?.name,
        )
      : host._root.querySelector(`[data-farm-run="${target.stage}"]`)?.closest(".plate") ||
        host._root.querySelector(`[data-farm-open="${target.stage}"]`);
  if (!card) return;
  host._forgeMaterialTarget = null;
  card.scrollIntoView({ block: "nearest", inline: "center", behavior: "instant" });
  card.setAttribute("tabindex", "-1");
  card.focus({ preventScroll: true });
}

export function wireForgeUnitMaterials(host) {
  if (host._hudView !== "roster" || !host._rosterUnitId || !host._growth) return;
  const root = host._root;
  const materials = new Map([[forgeMaterialEnglish["materials.funds"], "funds"]]);
  for (const cost of [host._growth.ascension?.next, ...(host._growth.form?.tracks || []).map((track) => track.next)])
    for (const item of cost?.items || []) if (forgeMaterialDestination(item.id)) materials.set(item.name, item.id);
  for (const label of root.querySelectorAll(".asc-cost .asc-item > .n")) {
    if (label.matches("button")) continue;
    const id = materials.get(label.textContent);
    if (!id) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `${label.className} forge-material`;
    button.textContent = label.textContent;
    button.title = forgeMaterialEnglish["materials.find"].replace("{material}", label.textContent);
    button.onclick = () => openForgeMaterial(host, id);
    label.replaceWith(button);
  }
  const actions = root.querySelector(".gw-acts");
  if (actions && !actions.querySelector("[data-forge-find-insight]")) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gw-reset";
    button.dataset.forgeFindInsight = "";
    button.textContent = forgeMaterialEnglish["materials.insight"];
    button.onclick = () => openForgeMaterial(host, "insight");
    actions.prepend(button);
  }
}
