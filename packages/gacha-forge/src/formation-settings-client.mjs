/* global forgeFormationEnglish */
const forgeFormationSettingsStyle = `
.gf-combat-mode{margin-block:12px;color:var(--text)}
.gf-combat-mode h3{margin:0;font-size:var(--t-md)}
.gf-combat-mode p{max-inline-size:70ch;margin-block:8px;overflow-wrap:anywhere}
.gf-combat-mode-actions{display:flex;flex-wrap:wrap;gap:8px;margin-block:12px 0}
.gf-combat-mode button{min-block-size:44px;white-space:normal}
.gf-combat-mode ul{max-block-size:14rem;overflow:auto;padding-inline-start:20px;margin-block:8px}
.gf-combat-mode li{margin-block:4px;overflow-wrap:anywhere}
.gf-combat-mode-setup{min-inline-size:0;grid-column:1/-1;border:0;padding:0;margin-block:12px}
.gf-combat-mode-options{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr));gap:12px}
.gf-combat-mode-option{min-inline-size:0}
.gf-combat-mode-setup label{display:flex;align-items:center;gap:8px;min-block-size:44px;padding:4px 8px;cursor:pointer}
.gf-combat-mode-setup input{accent-color:var(--coral)}
.gf-combat-mode-hint{margin:0;padding-inline:8px;max-inline-size:70ch;color:var(--steel-faint);font:max(12px,var(--t-xs))/1.5 var(--body);overflow-wrap:anywhere}
`;

export function forgeFormationSettings() {
  return `<style>${forgeFormationSettingsStyle}</style><section class="st-plate gf-combat-mode" data-forge-combat-mode-settings></section>`;
}

export function forgeFormationSetup(values = {}) {
  const selected = values.combatMode || values.combat?.mode || "classic";
  const option = (mode) =>
    `<div class="gf-combat-mode-option"><label><input type="radio" name="forge-combat-mode" data-forge-combat-mode value="${mode}" aria-describedby="forge-combat-mode-${mode}-hint"${selected === mode ? " checked" : ""}>${forgeFormationEnglish[`combat.mode.${mode}`]}</label><p id="forge-combat-mode-${mode}-hint" class="gf-combat-mode-hint">${forgeFormationEnglish[`combat.mode.${mode}Hint`]}</p></div>`;
  return `<style>${forgeFormationSettingsStyle}</style><fieldset class="gf-combat-mode-setup"><legend>${forgeFormationEnglish["combat.mode.title"]}</legend><div class="gf-combat-mode-options">${option("classic")}${option("formation")}</div></fieldset>`;
}

export function readForgeFormationSetup(root) {
  return root?.querySelector("[data-forge-combat-mode]:checked")?.value === "formation" ? "formation" : "classic";
}

/** Why a character's kit is missing, in words the player can act on. */
export function forgeFormationReason(error) {
  if (error === "generation-output-capacity") return "combat.mode.reason.capacity";
  if (error === "invalid-kit" || error === "invalid-shape") return "combat.mode.reason.invalid";
  if (error === "truncated") return "combat.mode.reason.truncated";
  return "combat.mode.reason.failed";
}

export function disposeForgeFormationSettings(host) {
  host._forgeFormationSettingsView?.dispose();
  host._forgeFormationSettingsView = null;
}

export function wireForgeFormationSettings(host) {
  const section = host._root?.querySelector("[data-forge-combat-mode-settings]");
  const runId = host._run?.runId;
  if (!section || !runId) {
    disposeForgeFormationSettings(host);
    return;
  }
  if (host._forgeFormationSettingsView?.section === section) return;
  disposeForgeFormationSettings(host);
  const state = { pending: true, asking: false, error: "", conversion: null };
  let timer,
    disposed = false,
    sequence = 0;
  const current = () => !disposed && section.isConnected && host._run?.runId === runId;
  const mode = () => (host._run?.combat?.mode === "formation" ? "formation" : "classic");
  const text = (key) => forgeFormationEnglish[key];
  const failure = (error) =>
    text(
      error === "combat-in-progress"
        ? "combat.mode.battlePending"
        : error === "formation-team-too-large"
          ? "combat.mode.teamTooLarge"
          : error === "formation-front-required"
            ? "combat.mode.frontRequired"
            : error === "reset-drain-timeout"
              ? "combat.mode.drainTimeout"
              : "combat.mode.error",
    );
  function render() {
    if (!current()) return;
    section.replaceChildren();
    const append = (tag, content) => {
      const element = document.createElement(tag);
      element.textContent = content;
      section.append(element);
      return element;
    };
    append("h3", `${text("combat.mode.title")}: ${text(`combat.mode.${mode()}`)}`);
    append("p", text(`combat.mode.${mode()}Hint`));
    const actions = document.createElement("div");
    actions.className = "gf-combat-mode-actions";
    const button = (key, action) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = `st-compress${["combat.mode.keep", "combat.mode.cancel"].includes(key) ? " -ghost" : ""}`;
      item.textContent = text(key);
      item.disabled = state.pending;
      item.addEventListener("click", action);
      actions.append(item);
      return item;
    };
    if (state.pending) append("p", text("combat.mode.loading")).setAttribute("role", "status");
    if (state.error) append("p", state.error).setAttribute("role", "alert");
    const job = state.conversion;
    if (job && ["preparing", "committing", "failed"].includes(job.status)) {
      append("p", text(`combat.mode.${job.status}`)).setAttribute("role", job.status === "failed" ? "alert" : "status");
      if (job.error === "reset-drain-timeout") append("p", text("combat.mode.drainTimeout"));
      const units = job.units || [];
      append(
        "p",
        text("combat.mode.progress")
          .replace("{ready}", String(units.filter((unit) => unit.status === "ready").length))
          .replace("{total}", String(units.length)),
      );
      const list = document.createElement("ul");
      for (const unit of units) {
        const row = document.createElement("li");
        row.textContent = `${unit.name}: ${text(`combat.mode.unit.${unit.status}`) || text("combat.mode.unit.failed")}`;
        if (unit.error === "generation-interrupted") row.textContent += ` (${text("combat.mode.interrupted")})`;
        else if (unit.status === "failed" && unit.error)
          row.textContent += ` (${text(forgeFormationReason(unit.error))})`;
        list.append(row);
      }
      section.append(list);
      if (job.status === "failed")
        button("combat.mode.retry", () => request("/combat-mode/retry", { jobId: job.id, confirmed: true }));
      button("combat.mode.cancel", () => request("/combat-mode/cancel", { jobId: job.id }));
    } else if (state.asking) {
      append("h4", text("combat.mode.confirmTitle"));
      append("p", text(mode() === "classic" ? "combat.mode.warning" : "combat.mode.classicWarning"));
      append("p", text("combat.mode.preserved"));
      button("combat.mode.keep", () => {
        state.asking = false;
        render();
        section.querySelector("[data-forge-combat-switch]")?.focus();
      }).dataset.forgeCombatKeep = "";
      button("combat.mode.confirm", () => {
        state.asking = false;
        void request("/combat-mode/switch", {
          targetMode: mode() === "classic" ? "formation" : "classic",
          confirmed: true,
        });
      }).dataset.forgeCombatConfirm = "";
    } else {
      button(mode() === "classic" ? "combat.mode.switchFormation" : "combat.mode.switchClassic", () => {
        state.asking = true;
        state.error = "";
        render();
        section.querySelector("[data-forge-combat-keep]")?.focus();
      }).dataset.forgeCombatSwitch = "";
    }
    if (state.error === text("combat.mode.teamTooLarge") || state.error === text("combat.mode.frontRequired"))
      button("combat.mode.editTeam", () => host._openFormation?.());
    section.append(actions);
  }
  async function request(path, body = {}, poll = false) {
    if (!current() || (state.pending && !poll)) return;
    clearTimeout(timer);
    const requestSequence = ++sequence;
    if (!poll) {
      state.pending = true;
      state.error = "";
      render();
    }
    let response;
    try {
      response = await host._postJson(path, { runId, ...body });
    } catch {
      response = null;
    }
    if (!current() || requestSequence !== sequence) return;
    state.pending = false;
    if (!response?.ok) state.error = failure(response?.error);
    else {
      state.error = "";
      state.conversion = response.conversion;
      if (response.combat) host._run = { ...host._run, combat: response.combat };
    }
    render();
    if (state.conversion && ["preparing", "committing"].includes(state.conversion.status))
      timer = setTimeout(() => {
        void request("/combat-mode/status", {}, true);
      }, 1500);
  }
  host._forgeFormationSettingsView = {
    section,
    dispose() {
      disposed = true;
      clearTimeout(timer);
    },
  };
  render();
  void request("/combat-mode/status", {}, true);
}
