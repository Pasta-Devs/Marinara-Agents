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
    // Recorded only once the write succeeded, so a failed save never leaves a slot
    // claiming to hold the operator's value while it holds the extractor's.
    BH.locks.markEdited(characterName, slotName, chatId);
    return state;
  },

  close() {
    document.querySelector(".bh-editor")?.remove();
    if (this.dismissHandlers) {
      document.removeEventListener("click", this.dismissHandlers.click, true);
      document.removeEventListener("keydown", this.dismissHandlers.keydown, true);
      this.dismissHandlers = null;
    }
    this.open = null;
  },

  /**
   * Close on Escape or a click outside, the way the reference extension does.
   *
   * The detached-target guard matters: removing a worn row deletes the button that
   * was clicked, so by the time this runs the target has no ancestors and reads as
   * an outside click. Closing there would throw away the staged edit — the row would
   * come back and the operator would think the remove did not work.
   */
  wireDismiss(editor) {
    const onClick = (event) => {
      const target = event.target;
      if (!target || target.isConnected === false) return;
      if (target.closest?.(".bh-editor, .bh-slot-card")) return;
      this.close();
    };
    const onKeydown = (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      this.close();
    };
    this.dismissHandlers = { click: onClick, keydown: onKeydown };
    // Deferred: the click that opened the editor is still propagating.
    setTimeout(() => {
      if (!editor.isConnected) return;
      document.addEventListener("click", onClick, true);
      document.addEventListener("keydown", onKeydown, true);
    }, 0);
  },

  /** Open the editor over a slot card. */
  openFor(card) {
    const slotName = card.dataset.slot;
    if (!slotName) return;
    // Before the first extraction there is no character yet, and the panel is showing
    // its default-human placeholder. Editing a slot then is how someone sets a scene
    // up by hand, so fall back to the chat's persona rather than refusing the click.
    const characterName =
      BH.dock.activeName || BH.dock.props?.personaInfo?.name || BH.dock.props?.personaInfo?.persona?.name || "You";
    if (!characterName) return;
    const body = BH.dock.state?.[characterName]?.body ?? {};
    const slotState = body[slotName] && typeof body[slotName] === "object" ? body[slotName] : {};
    const isHand = BH_HAND_SLOTS.has(slotName);
    const locked = BH.locks.has(characterName, slotName);

    const slotLabel = card.querySelector(".bh-slot-name")?.textContent?.trim() || slotName.replace(/_/g, " ");

    this.close();
    const editor = document.createElement("div");
    editor.className = "bh-editor";
    editor.setAttribute("role", "dialog");
    editor.setAttribute("aria-label", `Edit ${slotLabel}`);
    editor.innerHTML = `
      <div class="bh-editor-head">
        <span class="bh-editor-title">${BH.escapeHtml(characterName)}</span>
        <span class="bh-editor-slot">· ${BH.escapeHtml(slotLabel)}</span>
        <span class="bh-lock-toggle bh-editor-lock ${locked ? "bh-locked-on" : ""}" role="switch"
          tabindex="0" aria-checked="${locked ? "true" : "false"}"
          title="Locked slots ignore what the model reads — your value stays until you unlock it.">
          <i class="fa-solid ${locked ? "fa-lock" : "fa-lock-open"}" aria-hidden="true"></i><span>${locked ? "locked" : "lock"}</span>
        </span>
        <button class="bh-editor-close fa-solid fa-xmark" title="Close"></button>
      </div>
      <div class="bh-editor-body">${BH.editorFormHtml(slotState, isHand)}</div>
      <div class="bh-editor-foot">
        <button class="bh-btn bhe-cancel">Cancel</button>
        <button class="bh-btn bh-btn-primary bh-editor-apply"><i class="fa-solid fa-check"></i> Apply</button>
      </div>`;

    // Appended to the panel, not the document: .bh-editor is position:absolute and is
    // designed to be placed against the panel's own box. On the body it was laid out
    // against the page instead, so it drifted the moment anything scrolled.
    const panel = BH.dock.panel;
    (panel ?? document.body).appendChild(editor);
    this.open = { character: characterName, slot: slotName, element: editor };

    if (panel) {
      const panelRect = panel.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const width = Math.min(330, panelRect.width - 16);
      editor.style.width = `${width}px`;
      const left = Math.max(8, Math.min(cardRect.left - panelRect.left, panelRect.width - width - 8));
      let top = cardRect.bottom - panelRect.top + 6;
      // Flip above the card when it would fall off the bottom, rather than being
      // clamped to the edge half-visible.
      const height = editor.offsetHeight || 320;
      if (top + height > panelRect.height - 8) {
        top = Math.max(44, cardRect.top - panelRect.top - height - 6);
      }
      editor.style.left = `${left}px`;
      editor.style.top = `${top}px`;
    }

    // The editor is its own surface: a click inside it is never an outside click.
    editor.addEventListener("mousedown", (event) => event.stopPropagation());

    BH.wireEditorForm(editor);
    this.wireDismiss(editor);
    for (const dismiss of editor.querySelectorAll(".bh-editor-close, .bhe-cancel")) {
      dismiss.addEventListener("click", () => this.close());
    }
    // A switch rather than a checkbox, matching the reference extension: the state is
    // legible at a glance from the padlock instead of from a tick, and the label says
    // which state it is currently in rather than what the control is called.
    const lockToggle = editor.querySelector(".bh-lock-toggle");
    const toggleLock = () => {
      const on = !BH.locks.has(characterName, slotName);
      BH.locks.set(characterName, slotName, on);
      // Pin what the slot holds right now; that is what enforcement restores to.
      const current = BH.dock.state?.[characterName]?.body?.[slotName];
      BH.locks.remember(characterName, slotName, on ? (current ?? null) : undefined);
      lockToggle.classList.toggle("bh-locked-on", on);
      lockToggle.setAttribute("aria-checked", on ? "true" : "false");
      lockToggle.querySelector("i").className = `fa-solid ${on ? "fa-lock" : "fa-lock-open"}`;
      lockToggle.querySelector("span").textContent = on ? "locked" : "lock";
      BH.toast(on ? `${characterName} · ${slotLabel} locked — the story will not change it` : "Slot unlocked");
      BH.dock.render();
    };
    lockToggle.addEventListener("click", toggleLock);
    lockToggle.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggleLock();
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
   * Slots the operator set by hand, as opposed to slots the story produced.
   *
   * Separate from locks on purpose: they answer different questions. A lock says "do
   * not change this"; an edit mark says "this value is mine". Most hand-set values are
   * not locked — the operator fixes one detail and lets the story carry on — and
   * without the mark there is nothing distinguishing their correction from the
   * extractor's own output when they come back to it later.
   */
  editedKey(chatId) {
    return `marinara.beholder.edited.${chatId}`;
  },
  edited(chatId = BH.dock.chatId) {
    if (!chatId) return {};
    try {
      return JSON.parse(window.localStorage.getItem(this.editedKey(chatId)) || "{}") || {};
    } catch {
      return {};
    }
  },
  wasEdited(character, slot, chatId = BH.dock.chatId) {
    return this.edited(chatId)[`${character}::${slot}`] === true;
  },
  /**
   * Forget every per-chat choice attached to a state that no longer exists.
   *
   * The roster goes too. Hiding, ordering and merging are choices about particular
   * people, and once those people are gone a leftover alias would quietly fold the next
   * character of that name into a merge the operator made for someone else.
   *
   * What survives is anything not about this chat — the dismissed model update, for
   * one, which has nothing to do with who was being tracked here.
   */
  clearAll(chatId = BH.dock.chatId) {
    if (!chatId) return;
    for (const key of [this.key(chatId), this.valueKey(chatId), this.editedKey(chatId), BH.roster.key(chatId)]) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Nothing to do; the state itself is already gone either way.
      }
    }
  },

  markEdited(character, slot, chatId = BH.dock.chatId) {
    if (!chatId) return;
    const map = this.edited(chatId);
    map[`${character}::${slot}`] = true;
    try {
      window.localStorage.setItem(this.editedKey(chatId), JSON.stringify(map));
    } catch {
      // Losing the mark costs a visual cue, never the edit itself.
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
      let entry = next.characters.find((candidate) => candidate.name === name);
      if (!entry) {
        // The locked character is not in this turn's state. Skipping silently dropped
        // the lock — reachable since the editor started falling back to the persona
        // name, where an edit can be made before the extractor has ever named them.
        // A pin that only holds while the extractor happens to mention you is not a
        // lock, so re-create the row and enforce it.
        if (want === undefined || want === null) continue;
        entry = { name, body: {} };
        next.characters.push(entry);
      }
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
      // The reference extension's glyph: a small gold padlock inline after the slot
      // name. This used to be a corner pin of our own invention, which the ported
      // stylesheet had no rule for and which collided with the damage bar on small
      // cards. Same class as the reference, so the same style applies.
      if (locked && !card.querySelector(".bh-slot-lock-glyph")) {
        const mark = document.createElement("span");
        mark.className = "bh-slot-lock-glyph fa-solid fa-lock";
        mark.title = "Locked — the story will not change this slot";
        const name = card.querySelector(".bh-slot-name");
        if (name) name.after(mark);
        else card.appendChild(mark);
      } else if (!locked) {
        card.querySelector(".bh-slot-lock-glyph")?.remove();
      }
    }
  },
};
