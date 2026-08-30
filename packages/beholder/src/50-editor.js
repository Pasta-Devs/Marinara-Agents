// ── Slot editor + locks ──────────────────────────────────────────────────────
// Clicking a slot card opens the extension's editor over it. Apply writes the
// change back to the agent run that holds the chat's physical state, so the edit
// is not merely cosmetic: the next turn's prompt is built from that same record,
// which is what makes a hand-set value stick instead of being narrated away.
//
// Locks are stored per chat alongside the state. A locked slot is left alone when
// an edit is applied, and is marked in the panel so it is obvious why.

BH.editor = {
  open: null, // { character, slot, element }

  /**
   * Persist an edited slot.
   *
   * Writes through the agent's own state endpoint, which updates the record the next
   * prompt is built from — so a hand-set slot carries forward instead of being
   * narrated away on the following turn.
   */
  async applySlotEdit(chatId, characterName, slotName, nextSlot) {
    const read = await fetch(`/api/agents/beholder-state/${encodeURIComponent(chatId)}`, {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });
    if (!read.ok) throw new Error(`read ${read.status}`);
    const snapshot = await read.json();
    const state = { characters: [...(snapshot?.state?.characters ?? [])].map((c) => ({ ...c, body: { ...c.body } })) };

    let character = state.characters.find((entry) => entry?.name === characterName);
    if (!character) {
      character = { name: characterName, body: {} };
      state.characters.push(character);
    }
    if (Object.keys(nextSlot).length === 0) delete character.body[slotName];
    else character.body[slotName] = nextSlot;

    const write = await fetch(`/api/agents/beholder-state/${encodeURIComponent(chatId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ state }),
    });
    if (!write.ok) {
      const detail =
        write.status === 404 ? "no extraction to correct yet — let one turn run first" : `save ${write.status}`;
      throw new Error(detail);
    }
    return state;
  },

  close() {
    document.querySelector(".bh-editor")?.remove();
    this.open = null;
  },

  /** Open the editor over a slot card. */
  openFor(card) {
    const slotName = card.dataset.slot;
    if (!slotName) return;
    const characterName = BH.dock.activeName;
    if (!characterName) return;
    const body = BH.dock.state?.[characterName]?.body ?? {};
    const slotState = body[slotName] && typeof body[slotName] === "object" ? body[slotName] : {};
    const isHand = BH_HAND_SLOTS.has(slotName);
    const locked = BH.locks.has(characterName, slotName);

    this.close();
    const editor = document.createElement("div");
    editor.className = "bh-editor";
    editor.innerHTML = `
      <div class="bh-editor-head">
        <span class="bh-editor-title">${BH.escapeHtml(slotName.replace(/_/g, " "))}</span>
        <label class="bh-check bh-editor-lock" title="A locked slot is left alone when an edit is applied">
          <input type="checkbox" class="bhe-lock" ${locked ? "checked" : ""}><span>lock</span>
        </label>
        <button class="bh-editor-close fa-solid fa-xmark" title="Close"></button>
      </div>
      <div class="bh-editor-body">${BH.editorFormHtml(slotState, isHand)}</div>
      <div class="bh-editor-foot">
        <button class="bh-editor-apply">Apply</button>
      </div>`;
    document.body.appendChild(editor);
    this.open = { character: characterName, slot: slotName, element: editor };

    // Place it beside the card, kept inside the viewport.
    const rect = card.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 16);
    editor.style.width = `${width}px`;
    editor.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
    editor.style.top = `${Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 40))}px`;

    BH.wireEditorForm(editor);
    editor.querySelector(".bh-editor-close").addEventListener("click", () => this.close());
    editor.querySelector(".bhe-lock").addEventListener("change", (event) => {
      BH.locks.set(characterName, slotName, event.target.checked);
      // Pin what the slot holds right now; that is what enforcement restores to.
      const current = BH.dock.state?.[characterName]?.body?.[slotName];
      BH.locks.remember(characterName, slotName, event.target.checked ? (current ?? null) : undefined);
      BH.toast(event.target.checked ? "Slot locked" : "Slot unlocked");
      BH.dock.render();
    });
    editor.querySelector(".bh-editor-apply").addEventListener("click", async () => {
      const next = BH.collectEditorForm(editor, isHand);
      const apply = editor.querySelector(".bh-editor-apply");
      apply.disabled = true;
      try {
        await this.applySlotEdit(BH.dock.chatId, characterName, slotName, next);
        // Re-pin so a locked slot holds what was just applied rather than the value
        // it was locked at — otherwise enforcement would undo the operator's own edit.
        if (BH.locks.has(characterName, slotName)) {
          BH.locks.remember(characterName, slotName, Object.keys(next).length ? next : null);
        }
        BH.toast("Saved");
        this.close();
        await BH.dock.refresh();
      } catch (error) {
        apply.disabled = false;
        BH.toast(`Could not save: ${error.message}`);
        console.warn("[beholder] slot edit failed", error);
      }
    });

    // Close on an outside click, but not on the click that opened it.
    setTimeout(() => {
      const onOutside = (event) => {
        if (event.target.closest(".bh-editor") || event.target.closest(".bh-slot-card")) return;
        document.removeEventListener("click", onOutside);
        this.close();
      };
      document.addEventListener("click", onOutside);
    }, 0);
  },
};

// ── Locks ────────────────────────────────────────────────────────────────────
// Per chat, per character+slot. A lock is a promise that the slot keeps the value
// the operator set, so it has to be enforced rather than merely drawn: the extractor
// does not read locks, and would happily overwrite a locked slot on the next turn.
//
// Enforcement runs after each refresh. When the stored state disagrees with a locked
// value, the locked value is written back through the same endpoint the editor uses,
// which is the record the next prompt is built from — so the correction survives
// instead of being re-narrated away every turn.
BH.locks = {
  key(chatId) {
    return `marinara.beholder.locks.${chatId}`;
  },
  all(chatId = BH.dock.chatId) {
    if (!chatId) return {};
    try {
      return JSON.parse(window.localStorage.getItem(this.key(chatId)) || "{}") || {};
    } catch {
      return {};
    }
  },
  has(character, slot, chatId = BH.dock.chatId) {
    return this.all(chatId)[`${character}::${slot}`] === true;
  },
  set(character, slot, locked, chatId = BH.dock.chatId) {
    if (!chatId) return;
    const map = this.all(chatId);
    if (locked) map[`${character}::${slot}`] = true;
    else delete map[`${character}::${slot}`];
    try {
      window.localStorage.setItem(this.key(chatId), JSON.stringify(map));
    } catch {
      // A blocked storage write costs the lock, not the session.
    }
  },
  /** The value a locked slot is pinned to, captured when the lock is set. */
  valueKey(chatId) {
    return `marinara.beholder.lockvalues.${chatId}`;
  },
  values(chatId = BH.dock.chatId) {
    if (!chatId) return {};
    try {
      return JSON.parse(window.localStorage.getItem(this.valueKey(chatId)) || "{}") || {};
    } catch {
      return {};
    }
  },
  remember(character, slot, value, chatId = BH.dock.chatId) {
    if (!chatId) return;
    const map = this.values(chatId);
    if (value === undefined) delete map[`${character}::${slot}`];
    else map[`${character}::${slot}`] = value;
    try {
      window.localStorage.setItem(this.valueKey(chatId), JSON.stringify(map));
    } catch {
      // Without the pinned value the lock can only be advisory; it still marks the slot.
    }
  },

  /**
   * Put locked slots back the way the operator left them.
   *
   * Returns true when it had to write, so the caller can refresh again and show the
   * restored value rather than the extractor's version.
   */
  async enforce(state, chatId = BH.dock.chatId) {
    if (!chatId) return false;
    const locked = this.all(chatId);
    const pinned = this.values(chatId);
    const keys = Object.keys(locked);
    if (keys.length === 0) return false;

    const next = { characters: [] };
    let changed = false;
    for (const [name, character] of Object.entries(state ?? {})) {
      next.characters.push({
        name,
        ...(character.species ? { species: character.species } : {}),
        body: { ...(character.body ?? {}) },
      });
    }
    for (const key of keys) {
      const [name, slot] = key.split("::");
      const want = pinned[key];
      const entry = next.characters.find((candidate) => candidate.name === name);
      if (!entry) continue;
      const have = entry.body[slot];
      if (JSON.stringify(have ?? null) === JSON.stringify(want ?? null)) continue;
      if (want === undefined || want === null) delete entry.body[slot];
      else entry.body[slot] = want;
      changed = true;
    }
    if (!changed) return false;
    try {
      const res = await fetch(`/api/agents/beholder-state/${encodeURIComponent(chatId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ state: next }),
      });
      if (!res.ok) return false;
      BH.toast("Locked slots restored");
      return true;
    } catch {
      return false;
    }
  },

  /** Mark locked slots in the rendered panel so the state is visible, not hidden. */
  decorate(panel, character) {
    if (!panel || !character) return;
    const map = this.all();
    for (const card of panel.querySelectorAll(".bh-slot-card[data-slot]")) {
      const locked = map[`${character}::${card.dataset.slot}`] === true;
      card.classList.toggle("bh-slot-locked", locked);
      if (locked && !card.querySelector(".bh-lock-mark")) {
        const mark = document.createElement("span");
        mark.className = "bh-lock-mark fa-solid fa-lock";
        mark.title = "Locked — edits leave this slot alone";
        card.appendChild(mark);
      } else if (!locked) {
        card.querySelector(".bh-lock-mark")?.remove();
      }
    }
  },
};
