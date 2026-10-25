/* global forgeFormationCombatEnglish, forgeFormationElements, forgeFormationPayment, normalizeForgeFormationKit */
const forgeFormationEscape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/gu,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
  );
const forgeFormationLabel = (key) => forgeFormationCombatEnglish[`combat.formation.${key}`] || key;
export function forgeFormationStartRequest(host, path, body) {
  if (!["/battle/start", "/farm/start", "/tower/start", "/story-event/battle/start"].includes(path)) return body;
  return { ...body, expectedCombatMode: host._combat?.combatMode || "classic" };
}
export const forgeFormationCombatStyles = `
.gf-formation-turn{display:flex;flex-wrap:wrap;gap:.45rem;align-items:end;max-height:min(45dvh,22rem);overflow:auto;padding:.5rem;width:100%;box-sizing:border-box;background:var(--ink-2);color:var(--text);border-top:1px solid var(--steel-dark)}
.gf-formation-turn label{display:flex;flex-direction:column;gap:.2rem;font:500 max(12px,var(--t-xs))/1.3 var(--body);min-width:7rem;flex:1}.gf-formation-turn [hidden]{display:none}.gf-formation-turn select,.gf-formation-turn input,.gf-formation-turn button{font:500 max(14px,var(--t-sm))/1.3 var(--body);background:var(--ink);color:var(--text);border:1px solid var(--steel);border-radius:var(--radius-sm);padding:.4rem;min-height:36px;box-sizing:border-box;max-width:100%}.gf-formation-turn button{cursor:pointer;background:var(--gold);color:var(--ink)}
.gf-formation-turn details{flex-basis:100%;font:500 max(12px,var(--t-xs))/1.4 var(--body)}.gf-formation-payment{display:flex;gap:.35rem;flex-wrap:wrap}.gf-formation-payment label{min-width:3.3rem;flex:1}.gf-formation-payment input{width:100%;color:var(--text)}
.gf-formation-bank{display:flex;flex-wrap:wrap;align-items:center;flex:0 0 100%;gap:.35rem;font:600 max(12px,var(--t-xs))/1.4 var(--body);padding:.15rem 0;color:var(--text);box-sizing:border-box}.gf-formation-bank span{white-space:nowrap;padding:.1rem .35rem;border:1px solid var(--steel-dark);border-radius:var(--radius-sm)}.gf-formation-kit{padding:.7rem;margin:.5rem 0;border:1px solid var(--steel-dark);border-radius:var(--radius-sm);font:400 max(12px,var(--t-sm))/1.45 var(--body);color:var(--text)}.gf-formation-kit h3,.gf-formation-kit p{margin:.35rem 0}.gf-formation-error{color:var(--coral);flex-basis:100%}.gf-formation-encounter{margin:.5rem;padding:.5rem;border:1px solid var(--gold);font:400 max(12px,var(--t-sm))/1.4 var(--body);color:var(--text)}
@media(pointer:coarse){.gf-formation-turn select,.gf-formation-turn input{font-size:16px}}@media(max-height:500px){.gf-formation-turn{max-height:45dvh}.gf-formation-turn label{min-width:5rem}}
`;
const forgeFormationBankHtml = (bank) =>
  `<b>${forgeFormationLabel("energy")}</b>` +
  forgeFormationElements
    .map(
      (element) =>
        `<span data-formation-energy="${element}" style="border-color:var(--${element})">${forgeFormationEscape(element)} ${bank?.[element] || 0}</span>`,
    )
    .join("");

export function forgeRenderFormationTurn({ root, container, choice, payload, onChoice }) {
  if (!container) return;
  const actorIds = choice.formationActors || [],
    actors = [...(payload.allies || []), ...(payload.enemies || [])];
  let actorId = actorIds.some((actor) => actor.id === choice.actor) ? choice.actor : actorIds[0]?.id;
  const options = () => actorIds.find((actor) => actor.id === actorId)?.options || choice.options;
  const actor = () => actors.find((unit) => unit.id === actorId) || {};
  const optionHtml = (value, text) =>
    `<option value="${forgeFormationEscape(value)}">${forgeFormationEscape(text)}</option>`;
  container.innerHTML = `<style>${forgeFormationCombatStyles}</style><form class="gf-formation-turn" data-formation-turn><div class="gf-formation-bank" data-formation-bank aria-label="${forgeFormationLabel("energy")}"></div><label>${forgeFormationLabel("actor")}<select name="actor">${actorIds.map((unit) => optionHtml(unit.id, unit.name)).join("")}</select></label><label>${forgeFormationLabel("action")}<select name="action"></select></label><label data-formation-target-label>${forgeFormationLabel("target")}<select name="target"></select></label><label data-formation-mover-label hidden>${forgeFormationLabel("mover")}<select name="mover"></select></label><label data-formation-swap-label hidden>${forgeFormationLabel("swap")}<select name="swap"></select></label><details data-formation-payment><summary>${forgeFormationLabel("payment")}</summary><p>${forgeFormationLabel("paymentHint")}</p><div class="gf-formation-payment">${forgeFormationElements.map((element) => `<label>${forgeFormationEscape(element)}<input name="pay-${element}" type="number" min="0" step="1" inputmode="numeric"></label>`).join("")}</div><label>${forgeFormationLabel("bonus")}<select name="bonus"></select></label></details><span data-formation-cost></span><p class="gf-formation-error" role="status" data-formation-error></p><button type="submit">${forgeFormationLabel("confirm")}</button></form>`;
  const form = container.querySelector("form"),
    field = (name) => form.elements.namedItem(name),
    error = form.querySelector("[data-formation-error]");
  const updateBonuses = () => {
    const select = field("bonus");
    for (const option of select.options)
      option.disabled = !!option.value && !(Number(field(`pay-${option.value}`).value) > 0);
    if (select.selectedOptions[0]?.disabled) select.value = "";
  };
  for (const element of forgeFormationElements) field(`pay-${element}`).oninput = updateBonuses;
  const setTargets = () => {
    const data = options().formation,
      action = field("action").value,
      skill = action === "ultimate" ? data.ultimate : action === "weapon" ? data.standard : null;
    const isMove = action === "row",
      helpful =
        skill &&
        ["heal", "shield", "buff", "cleanse", "revive", "energy", "regen", "immune", "taunt", "summon"].includes(
          skill.effect,
        );
    form.querySelector("[data-formation-target-label]").hidden = isMove || action === "defend";
    form.querySelector("[data-formation-mover-label]").hidden = !isMove;
    form.querySelector("[data-formation-swap-label]").hidden = !isMove;
    field("target").innerHTML = (helpful ? data.allies : data.foes.filter((foe) => foe.targetable))
      .map((unit) => optionHtml(unit.id, unit.name))
      .join("");
    field("mover").innerHTML = data.allies
      .filter((unit) => !unit.token)
      .map((unit) => optionHtml(unit.id, unit.name))
      .join("");
    field("mover").value = actorId;
    const updateSwap = () => {
      const mover = data.allies.find((unit) => unit.id === field("mover").value);
      field("swap").innerHTML =
        optionHtml("", forgeFormationLabel("empty")) +
        data.allies
          .filter((unit) => !unit.token && unit.position !== mover?.position)
          .map((unit) => optionHtml(unit.id, unit.name))
          .join("");
    };
    field("mover").onchange = updateSwap;
    updateSwap();
    const payment = skill && forgeFormationPayment(data.bank, skill, actor().affinity);
    for (const element of forgeFormationElements) {
      field(`pay-${element}`).value = payment?.[element] || 0;
      field(`pay-${element}`).max = data.bank[element] || 0;
    }
    form.querySelector("[data-formation-payment]").hidden = !skill;
    form.querySelector("[data-formation-cost]").textContent = skill
      ? `${forgeFormationLabel("cost")}: ${skill.cost}${skill.elementCost ? ` · ${skill.elementCost} ${forgeFormationLabel("native")}` : ""}`
      : "";
    field("bonus").innerHTML =
      optionHtml("", forgeFormationLabel("none")) +
      forgeFormationElements.map((element) => optionHtml(element, forgeFormationLabel(element))).join("");
    field("bonus").value = forgeFormationElements.find((element) => payment?.[element] > 0) || "";
    updateBonuses();
    error.textContent = "";
  };
  const render = () => {
    const data = options();
    form.querySelector("[data-formation-bank]").innerHTML = forgeFormationBankHtml(data.formation.bank);
    field("action").innerHTML = [
      ["attack", forgeFormationLabel("attack")],
      ["weapon", data.formation.standard?.name || forgeFormationLabel("standard")],
      ["ultimate", data.formation.ultimate?.name || forgeFormationLabel("ultimate")],
      ["defend", forgeFormationLabel("guard")],
      ["row", forgeFormationLabel("move")],
    ]
      .map(
        ([key, name]) => `<option value="${key}"${data[key] ? "" : " disabled"}>${forgeFormationEscape(name)}</option>`,
      )
      .join("");
    for (const card of root.querySelectorAll(".cbt.is-actor")) card.classList.remove("is-actor");
    [...root.querySelectorAll(".cbt")].find((card) => card.dataset.id === actorId)?.classList.add("is-actor");
    setTargets();
  };
  field("actor").value = actorId;
  field("actor").onchange = () => {
    actorId = field("actor").value;
    render();
  };
  field("action").onchange = setTargets;
  form.onsubmit = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const data = options().formation,
      action = field("action").value,
      skill = action === "ultimate" ? data.ultimate : action === "weapon" ? data.standard : null;
    const payment = Object.fromEntries(
      forgeFormationElements.map((element) => [element, Number(field(`pay-${element}`).value)]),
    );
    if (skill && !forgeFormationPayment(data.bank, skill, actor().affinity, payment)) {
      error.textContent = forgeFormationLabel("invalidPayment");
      return;
    }
    onChoice({
      actorId,
      action,
      targetId: field("target").value,
      ...(skill ? { payment, bonus: field("bonus").value } : {}),
      ...(action === "row" ? { moveId: field("mover").value, swapId: field("swap").value } : {}),
    });
  };
  render();
}

export function createForgeFormationPresentation(root, payload) {
  if (payload?.combatMode !== "formation") return { event() {}, dispose() {} };
  const style = document.createElement("style");
  style.textContent = forgeFormationCombatStyles;
  root.append(style);
  const rules = document.createElement("div");
  rules.className = "gf-formation-encounter";
  rules.innerHTML = `<b>${forgeFormationLabel("rules")}</b> ${(payload.formationRules || []).map((rule) => forgeFormationEscape(rule.description)).join(" · ")}`;
  if (payload.formationRules?.length) root.querySelector(".screen")?.append(rules);
  return {
    event(event) {
      if (event.op === "formation-bank" && event.side === "ally")
        for (const bank of root.querySelectorAll("[data-formation-bank]"))
          bank.innerHTML = forgeFormationBankHtml(event.bank);
    },
    dispose() {
      style.remove();
      rules.remove();
    },
  };
}

export function wireForgeFormationUnit(host) {
  if (host._run?.combat?.mode !== "formation" || !host._unit) return;
  const unit = host._unit.unit || host._unit,
    kit = normalizeForgeFormationKit(unit.formationKit);
  const panel = host._root.querySelector('[data-screen="unit"] .cp-panel');
  if (!kit || !panel || panel.querySelector("[data-formation-kit]")) return;
  const element = document.createElement("section");
  element.className = "gf-formation-kit";
  element.dataset.formationKit = "";
  element.innerHTML =
    `<style>${forgeFormationCombatStyles}</style><h3>${forgeFormationLabel("title")}</h3>` +
    [
      ["standard", kit.standard],
      ["ultimate", kit.ultimate],
      ["passive", kit.passive],
    ]
      .map(
        ([key, ability]) =>
          `<p><b>${forgeFormationLabel(key)} · ${forgeFormationEscape(ability.name)}</b><br>${forgeFormationEscape(ability.description)}${ability.cost != null ? `<br>${forgeFormationLabel("cost")}: ${ability.cost}` : ""}</p>`,
      )
      .join("") +
    kit.traits.map((trait) => `<p>${forgeFormationLabel(trait.kind)}</p>`).join("");
  panel.prepend(element);
}

export function forgeFormationErrorLabel(error) {
  if (error === "formation-team-size" || error === "formation-team-duplicate") return forgeFormationLabel("teamSize");
  if (error === "formation-rows") return forgeFormationLabel("rows");
  if (error === "formation-element-required") return forgeFormationLabel("unavailable");
  if (["conversion-in-progress", "formation-conversion-required", "combat-conversion-in-progress"].includes(error))
    return forgeFormationLabel("kitPending");
  return "";
}

export function wireForgeFormationPreview(host) {
  wireForgeFormationUnit(host);
  if (host._run?.combat?.mode !== "formation") return;
  const root = host._root;
  if (host._formation?.combatMode === "formation") {
    const target = root.querySelector("[data-formation], .fm-root, .fm-main, [data-presets]")?.parentElement;
    if (target && !root.querySelector("[data-formation-guidance]")) {
      const note = document.createElement("p");
      note.className = "gf-formation-encounter";
      note.dataset.formationGuidance = "";
      note.textContent = forgeFormationLabel("team");
      target.prepend(note);
    }
  }
  if (host._combat?.formationRules?.length && host._combatPhase === "prebattle") {
    const target = root.querySelector(".screen");
    if (target && !target.querySelector("[data-formation-rule-preview]")) {
      const note = document.createElement("div");
      note.className = "gf-formation-encounter";
      note.dataset.formationRulePreview = "";
      note.innerHTML = `<style>${forgeFormationCombatStyles}</style><b>${forgeFormationLabel("rules")}</b> ${host._combat.formationRules.map((rule) => forgeFormationEscape(rule.description)).join(" · ")}`;
      target.prepend(note);
    }
  }
}
