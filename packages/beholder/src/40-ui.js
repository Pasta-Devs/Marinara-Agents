// ── Shared interface bits ────────────────────────────────────────────────────
// Toast, escaping, and the form controls the slot editor is built from. Markup and
// class names are the extension's, so style.css dresses them without changes.

const BH_DAMAGE_VALUES = ["pristine", "damaged", "broken"];
const BH_SEVERITY_VALUES = ["minor", "serious", "critical"];
const BH_COLOR_VALUES = [
  "",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "brown",
  "black",
  "white",
  "gray",
  "beige",
  "gold",
  "silver",
  "navy",
  "tan",
];
const BH_HAND_SLOTS = new Set(["left_hand", "right_hand"]);

let bhToastTimer = null;
/** Brief status line. The panel is a floating surface, so this anchors to the body. */
BH.toast = function toast(message, ms = 2600) {
  let el = document.querySelector(".bh-toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "bh-toast";
    document.body.appendChild(el);
  }
  el.textContent = String(message);
  // bh-toast-in, which is the class the ported stylesheet actually styles. This used to
  // add "bh-toast-show", a name of our own that no rule matches — and since .bh-toast
  // rests at opacity 0 and only .bh-toast-in raises it, every toast this package has
  // ever raised was invisible. Nothing failed and nothing was logged; the messages
  // simply never appeared.
  el.classList.add("bh-toast-in");
  clearTimeout(bhToastTimer);
  bhToastTimer = setTimeout(() => el.classList.remove("bh-toast-in"), ms);
};

BH.selectHtml = function selectHtml(cls, values, current) {
  const options = values
    .map(
      (value) =>
        `<option value="${BH.escapeHtml(value)}" ${value === (current ?? "") ? "selected" : ""}>` +
        `${BH.escapeHtml(value || "— color —")}</option>`,
    )
    .join("");
  return `<select class="bh-select ${cls}">${options}</select>`;
};

BH.wornRowHtml = function wornRowHtml(worn = {}) {
  return `<div class="bh-editor-row bh-editor-row-worn">
        <input class="bh-input bhe-item" type="text" placeholder="item" value="${BH.escapeHtml(worn.item || "")}">
        ${BH.selectHtml("bhe-damage", BH_DAMAGE_VALUES, worn.damage || "pristine")}
        ${BH.selectHtml("bhe-color", BH_COLOR_VALUES, (worn.color || "").toLowerCase())}
        <button class="bh-editor-remove fa-solid fa-xmark" title="Remove"></button>
    </div>`;
};

BH.woundRowHtml = function woundRowHtml(wound = {}) {
  const text = typeof wound === "string" ? wound : wound.text || "";
  const severity = typeof wound === "object" && wound.severity ? String(wound.severity) : "serious";
  const bleeding = typeof wound === "object" && wound.bleeding === true;
  return `<div class="bh-editor-row bh-editor-row-wound">
        <input class="bh-input bhe-wtext" type="text" placeholder="wound" value="${BH.escapeHtml(text)}">
        ${BH.selectHtml("bhe-wsev", BH_SEVERITY_VALUES, severity)}
        <label class="bh-bleed-check" title="bleeding"><input type="checkbox" class="bhe-wbleed" ${bleeding ? "checked" : ""}>🩸</label>
        <button class="bh-editor-remove fa-solid fa-xmark" title="Remove"></button>
    </div>`;
};

/** The worn / holding / wounds / flags form, identical to the extension's. */
BH.editorFormHtml = function editorFormHtml(slotState, isHand) {
  const holding = slotState.holding
    ? typeof slotState.holding === "string"
      ? { item: slotState.holding }
      : slotState.holding
    : null;
  return `
        <div class="bh-editor-group-label">worn <span style="opacity:.5; letter-spacing:0; text-transform:none;">(outer → inner)</span></div>
        <div class="bhe-worn-list">${(slotState.worn || []).map(BH.wornRowHtml).join("")}</div>
        <button class="bh-editor-add bhe-add-worn"><i class="fa-solid fa-plus"></i> add worn item</button>
        ${
          isHand
            ? `
        <div class="bh-editor-group-label">holding</div>
        <div class="bh-editor-row bhe-holding-row">
            <input class="bh-input bhe-hitem" type="text" placeholder="nothing held" value="${BH.escapeHtml(holding?.item || "")}">
            ${BH.selectHtml("bhe-hdamage", BH_DAMAGE_VALUES, holding?.damage || "pristine")}
            ${BH.selectHtml("bhe-hcolor", BH_COLOR_VALUES, (holding?.color || "").toLowerCase())}
            <button class="bh-editor-remove bhe-drop fa-solid fa-hand-holding" title="Drop item"></button>
        </div>`
            : ""
        }
        <div class="bh-editor-group-label">wounds</div>
        <div class="bhe-wound-list">${(slotState.wounds || []).map(BH.woundRowHtml).join("")}</div>
        <button class="bh-editor-add bhe-add-wound"><i class="fa-solid fa-plus"></i> add wound</button>
        <div class="bh-editor-group-label">flags</div>
        <div class="bh-row-actions">
            <label class="bh-check"><input type="checkbox" class="bhe-bare" ${slotState.bare ? "checked" : ""}>
                <span>bare <small>confirmed uncovered — clears worn on apply</small></span></label>
            <label class="bh-check"><input type="checkbox" class="bhe-missing" ${slotState.missing ? "checked" : ""}>
                <span>missing <small>lost limb / feature — overrides everything</small></span></label>
        </div>`;
};

/** Wire the form's own controls. Adding and removing rows only stages an edit; Apply commits. */
BH.wireEditorForm = function wireEditorForm(scope) {
  scope.querySelector(".bhe-add-worn")?.addEventListener("click", () => {
    scope.querySelector(".bhe-worn-list")?.insertAdjacentHTML("beforeend", BH.wornRowHtml());
  });
  scope.querySelector(".bhe-add-wound")?.addEventListener("click", () => {
    scope.querySelector(".bhe-wound-list")?.insertAdjacentHTML("beforeend", BH.woundRowHtml());
  });
  scope.addEventListener("click", (event) => {
    const remove = event.target.closest(".bh-editor-remove:not(.bhe-drop)");
    if (!remove || !scope.contains(remove)) return;
    // Removing the row detaches this button, and a detached target reads as an
    // outside click to the close-on-outside handler — which would shut the editor
    // and lose the staged removal. Stop it here.
    event.stopPropagation();
    remove.closest(".bh-editor-row")?.remove();
  });
  scope.querySelector(".bhe-drop")?.addEventListener("click", (event) => {
    event.stopPropagation();
    const held = scope.querySelector(".bhe-hitem");
    if (held) held.value = "";
    BH.toast("Item will be dropped on apply");
  });
  scope.querySelector(".bhe-missing")?.addEventListener("change", function onMissing() {
    scope.closest(".bh-editor-body")?.classList.toggle("bhe-missing-mode", this.checked);
    scope.classList.toggle("bhe-missing-mode", this.checked);
  });
};

/** Read the form back into a slot-state object — the apply payload. */
BH.collectEditorForm = function collectEditorForm(scope, isHand) {
  const next = {};
  if (scope.querySelector(".bhe-missing")?.checked) {
    next.missing = true;
    return next; // missing overrides everything on the slot
  }
  const worn = [];
  for (const row of scope.querySelectorAll(".bhe-worn-list .bh-editor-row")) {
    const item = row.querySelector(".bhe-item")?.value.trim();
    if (!item) continue;
    const entry = { item, damage: row.querySelector(".bhe-damage")?.value };
    const color = row.querySelector(".bhe-color")?.value;
    if (color) entry.color = color;
    worn.push(entry);
  }
  const bare = scope.querySelector(".bhe-bare")?.checked;
  if (bare) next.bare = true;
  else if (worn.length) next.worn = worn;

  if (isHand) {
    const item = scope.querySelector(".bhe-hitem")?.value.trim();
    if (item) {
      next.holding = { item, damage: scope.querySelector(".bhe-hdamage")?.value };
      const color = scope.querySelector(".bhe-hcolor")?.value;
      if (color) next.holding.color = color;
    }
  }

  const wounds = [];
  for (const row of scope.querySelectorAll(".bhe-wound-list .bh-editor-row")) {
    const text = row.querySelector(".bhe-wtext")?.value.trim();
    if (!text) continue;
    wounds.push({
      text,
      severity: row.querySelector(".bhe-wsev")?.value,
      bleeding: !!row.querySelector(".bhe-wbleed")?.checked,
    });
  }
  if (wounds.length) next.wounds = wounds;
  return next;
};
