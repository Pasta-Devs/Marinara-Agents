// ── The slot sheet: pick a slot, then edit it ───────────────────────────────
//
// Tapping a card works on a mouse. On a phone the cards are small, and — more to the
// point — a slot with nothing in it may not be drawn at all, so there is no card to
// tap. Setting a scene up by hand means reaching empty slots, and the doll cannot
// offer them.
//
// So this is the other way in, ported from the reference extension: one sheet listing
// every slot the character can have, grouped by region, each with a summary of what is
// in it and whether it is locked or hand-edited. Tapping one swaps the sheet to the
// editor for that slot and back again, so several slots can be corrected without
// reopening anything.

const BH_PICKER_REGIONS = [
  { label: "Head & Face", slots: ["head", "face", "left_eye", "right_eye", "left_ear", "right_ear", "mouth", "neck"] },
  { label: "Torso", slots: ["left_shoulder", "right_shoulder", "chest", "back", "waist"] },
  { label: "Arms & Hands", slots: ["left_arm", "right_arm", "left_hand", "right_hand"] },
  { label: "Legs & Feet", slots: ["left_leg", "right_leg", "left_foot", "right_foot"] },
  { label: "Species", slots: ["tail", "hind_left_leg", "hind_right_leg", "hind_left_foot", "hind_right_foot"] },
];

/** Slots only some bodies have; shown when the species implies them or something is in them. */
const BH_SPECIES_CONDITIONAL = new Set([
  "tail",
  "hind_left_leg",
  "hind_right_leg",
  "hind_left_foot",
  "hind_right_foot",
]);

const BH_FAMILY_EXTRA = {
  centauroid: new Set(["tail", "hind_left_leg", "hind_right_leg", "hind_left_foot", "hind_right_foot"]),
  serpentine: new Set(["tail"]),
  digitigrade: new Set(["tail"]),
};

const BH_SLOT_LABELS = {
  head: "head",
  face: "face",
  neck: "neck",
  chest: "chest",
  back: "back",
  waist: "waist",
  mouth: "mouth",
  tail: "tail",
  left_eye: "L. eye",
  right_eye: "R. eye",
  left_ear: "L. ear",
  right_ear: "R. ear",
  left_shoulder: "L. shoulder",
  right_shoulder: "R. shoulder",
  left_arm: "L. arm",
  right_arm: "R. arm",
  left_hand: "L. hand",
  right_hand: "R. hand",
  left_leg: "L. leg",
  right_leg: "R. leg",
  left_foot: "L. foot",
  right_foot: "R. foot",
  hind_left_leg: "L. hind leg",
  hind_right_leg: "R. hind leg",
  hind_left_foot: "L. hind foot",
  hind_right_foot: "R. hind foot",
};

BH.sheet = {
  /** One line describing what is in a slot, for the picker rows. */
  summary(slotState) {
    if (!slotState) return { text: "empty", cls: "bh-pick-empty" };
    if (slotState.missing) return { text: "missing", cls: "bh-pick-missing" };
    const parts = (slotState.worn ?? []).map((item) => item?.item).filter(Boolean);
    if (slotState.holding) {
      parts.push(`✦ ${typeof slotState.holding === "string" ? slotState.holding : slotState.holding.item}`);
    }
    const wounds = (slotState.wounds ?? []).length;
    let text = parts.join(", ");
    if (wounds) text += `${text ? " · " : ""}${wounds} wound${wounds > 1 ? "s" : ""}`;
    if (!text) return slotState.bare ? { text: "bare", cls: "bh-pick-bare" } : { text: "empty", cls: "bh-pick-empty" };
    return { text, cls: "" };
  },

  close() {
    for (const node of document.querySelectorAll(".bh-edit-sheet, .bh-sheet-backdrop")) node.remove();
    if (this.onKeydown) {
      document.removeEventListener("keydown", this.onKeydown, true);
      this.onKeydown = null;
    }
  },

  characterName() {
    return BH.dock.activeName || BH.dock.props?.personaInfo?.name || BH.dock.props?.personaInfo?.persona?.name || "You";
  },

  open() {
    BH.editor.close();
    this.close();
    const panel = BH.dock.panel;
    if (!panel) return;

    const backdrop = document.createElement("div");
    backdrop.className = "bh-sheet-backdrop";
    const sheet = document.createElement("div");
    sheet.className = "bh-edit-sheet";
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-label", "Edit slots");
    sheet.innerHTML = `
      <div class="bh-sheet-head">
        <button type="button" class="bh-sheet-back fa-solid fa-arrow-left" title="Back to slots" hidden></button>
        <span class="bh-sheet-title">Edit a slot</span>
        <button type="button" class="bh-sheet-close fa-solid fa-xmark" title="Close"></button>
      </div>
      <div class="bh-sheet-body"></div>`;
    panel.appendChild(backdrop);
    panel.appendChild(sheet);

    sheet.addEventListener("mousedown", (event) => event.stopPropagation());
    backdrop.addEventListener("click", () => this.close());
    sheet.querySelector(".bh-sheet-close").addEventListener("click", () => this.close());
    this.onKeydown = (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      this.close();
    };
    document.addEventListener("keydown", this.onKeydown, true);
    this.showPicker(sheet);
  },

  showPicker(sheet) {
    const character = this.characterName();
    const body = BH.dock.state?.[character]?.body ?? {};
    // familyOf / OFF_BODY_SLOTS come from the paperdoll module; every source file is
    // concatenated into one IIFE, so they are in scope here.
    const family = familyOf(BH.dock.state?.[character]?.species);
    const offBody = OFF_BODY_SLOTS[family] || OFF_BODY_SLOTS.humanoid || new Set();

    const groups = BH_PICKER_REGIONS.map((region) => {
      const slots = region.slots.filter((slot) => {
        if (offBody.has(slot)) return false;
        // A conditional slot is offered when the species implies it, or when something
        // is already in it — otherwise every human would be asked about their tail.
        if (BH_SPECIES_CONDITIONAL.has(slot)) return BH_FAMILY_EXTRA[family]?.has(slot) || body[slot] != null;
        return true;
      });
      if (!slots.length) return "";
      const rows = slots
        .map((slot) => {
          const summary = this.summary(body[slot]);
          const locked = BH.locks.has(character, slot);
          // Both marks, as the reference shows them. The lock and the pencil answer
          // different questions — "the story cannot change this" versus "this value is
          // mine" — and this list claimed to show both while only ever drawing the lock.
          const marks =
            (locked ? `<i class="fa-solid fa-lock bh-pick-mark bh-pick-lock"></i>` : "") +
            (BH.locks.wasEdited(character, slot)
              ? `<span class="bh-pick-mark bh-pick-edited" title="You set this by hand">✎</span>`
              : "");
          return `<button type="button" class="bh-pick-slot" data-slot="${BH.escapeHtml(slot)}">
            <span class="bh-pick-label">${BH.escapeHtml(BH_SLOT_LABELS[slot] || slot)}</span>
            <span class="bh-pick-summary ${summary.cls}">${BH.escapeHtml(summary.text)}</span>
            ${marks}
            <i class="fa-solid fa-chevron-right bh-pick-arrow"></i>
          </button>`;
        })
        .join("");
      return `<div class="bh-pick-region"><div class="bh-pick-region-head">${BH.escapeHtml(region.label)}</div>${rows}</div>`;
    }).join("");

    const back = sheet.querySelector(".bh-sheet-back");
    back.hidden = true;
    sheet.querySelector(".bh-sheet-title").textContent = `${character} — edit a slot`;
    const sheetBody = sheet.querySelector(".bh-sheet-body");
    sheetBody.scrollTop = 0;
    sheetBody.innerHTML = `<div class="bh-slot-picker">${groups}</div>`;
    for (const row of sheetBody.querySelectorAll(".bh-pick-slot")) {
      row.addEventListener("click", () => this.showEditor(sheet, row.dataset.slot));
    }
  },

  showEditor(sheet, slot) {
    const character = this.characterName();
    if (!character || !slot) return;
    const slotState = BH.dock.state?.[character]?.body?.[slot] ?? {};
    const isHand = slot === "left_hand" || slot === "right_hand";
    const label = BH_SLOT_LABELS[slot] || slot;
    const locked = BH.locks.has(character, slot);

    const back = sheet.querySelector(".bh-sheet-back");
    back.hidden = false;
    back.onclick = () => this.showPicker(sheet);
    sheet.querySelector(".bh-sheet-title").innerHTML =
      `${BH.escapeHtml(character)} <span style="opacity:.55">· ${BH.escapeHtml(label)}</span>`;

    const sheetBody = sheet.querySelector(".bh-sheet-body");
    sheetBody.scrollTop = 0;
    sheetBody.innerHTML = `
      <div class="bh-sheet-lockrow">
        <label class="bh-check bh-editor-lock" title="A locked slot is left alone when an edit is applied">
          <input type="checkbox" class="bhe-lock" ${locked ? "checked" : ""}><span>lock</span>
        </label>
      </div>
      <div class="bh-editor-body">${BH.editorFormHtml(slotState, isHand)}</div>
      <div class="bh-editor-foot">
        <button type="button" class="bh-btn bhe-back">Back</button>
        <button type="button" class="bh-btn bh-btn-primary bhe-apply"><i class="fa-solid fa-check"></i> Apply</button>
      </div>`;

    BH.wireEditorForm(sheetBody);
    if (slotState.missing) sheetBody.querySelector(".bh-editor-body")?.classList.add("bhe-missing-mode");

    sheetBody.querySelector(".bhe-lock").addEventListener("change", (event) => {
      BH.locks.set(character, slot, event.target.checked);
      const current = BH.dock.state?.[character]?.body?.[slot];
      BH.locks.remember(character, slot, event.target.checked ? (current ?? null) : undefined);
      BH.toast(event.target.checked ? "Slot locked" : "Slot unlocked");
      BH.dock.render();
    });
    sheetBody.querySelector(".bhe-back").addEventListener("click", () => this.showPicker(sheet));
    sheetBody.querySelector(".bhe-apply").addEventListener("click", async () => {
      const next = BH.collectEditorForm(sheetBody, isHand);
      const apply = sheetBody.querySelector(".bhe-apply");
      apply.disabled = true;
      try {
        await BH.editor.applySlotEdit(BH.dock.chatId, character, slot, next);
        if (BH.locks.has(character, slot)) {
          BH.locks.remember(character, slot, Object.keys(next).length ? next : null);
        }
        BH.toast(`${character} · ${label} updated`);
        // Back to the list rather than closing: correcting one slot usually means
        // correcting its neighbour too.
        this.showPicker(sheet);
      } catch (error) {
        BH.toast(`Could not save: ${error.message}`);
        apply.disabled = false;
      }
    });
  },
};
