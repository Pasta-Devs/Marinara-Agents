// ── Building state from the chat ────────────────────────────────────────────
//
// The panel can only show what the extractor has been run over. Turn Beholder on
// halfway through a chat and the doll is empty until the next message, which reads as
// broken. The reference extension answers that with a backfill control: walk the
// messages already in the chat and extract from each.
//
// Here the extraction itself runs server-side, so a walk is a sequence of agent runs
// scoped to one message at a time via `forMessageId`. That is the whole difference
// from the reference — the shapes and the wording are the same.
//
// Every mode costs real model calls, one per message, against whichever connection is
// answering. So: the count is stated before anything runs, progress is live, and
// cancel takes effect at the next message boundary rather than being decorative.

BH.backfill = {
  running: false,
  cancelled: false,

  /** The assistant messages in this chat, oldest first. */
  async messages(chatId) {
    // Messages have their own route; the chat record does not include them. Reading
    // them off the chat returned an empty list every time, so a build always reported
    // "nothing to build from" no matter how long the chat was.
    const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}/messages`, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`messages ${res.status}`);
    const payload = await res.json();
    const rows = Array.isArray(payload) ? payload : (payload?.messages ?? []);
    return rows.filter((row) => row && row.id && !row.isUser && row.role !== "user");
  },

  /** The message the stored state was last built from, or null. */
  async lastProcessed(chatId) {
    try {
      const res = await fetch(`/api/agents/beholder-state/${encodeURIComponent(chatId)}`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return null;
      return (await res.json())?.messageId ?? null;
    } catch {
      return null;
    }
  },

  /** Run the agent for one message. Without an id it runs the latest turn. */
  async runOne(chatId, messageId) {
    const res = await fetch("/api/generate/retry-agents", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId,
        agentTypes: ["beholder"],
        ...(messageId ? { forMessageId: messageId } : {}),
      }),
    });
    if (!res.ok) throw new Error(`extract ${res.status}`);
    // The route streams; drain it so the run is finished before the next one starts.
    // Overlapping runs on one chat would race each other's state writes.
    await res.text();
  },

  /** Wipe the tracked state so a rebuild starts from nothing. */
  async clearState(chatId) {
    const res = await fetch(`/api/agents/beholder-state/${encodeURIComponent(chatId)}`, {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: { characters: [] } }),
    });
    // fetch resolves for 4xx and 5xx, so this used to report success for a wipe that
    // never happened — and the rebuild then read every message on top of the state it
    // was supposed to have replaced, keeping exactly the characters the operator asked
    // to be rid of.
    if (!res.ok) throw new Error(`could not clear the existing state (${res.status})`);
  },

  // ── progress strip ────────────────────────────────────────────────────────
  status() {
    return BH.dock.panel?.querySelector(".beholder-backfill-status") ?? null;
  },

  setProgress({ done, total, inFlight }) {
    const status = this.status();
    if (!status) return;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const label = inFlight
      ? `<i class="fa-solid fa-spinner fa-spin"></i> Building history — extracting <b>${done + 1}</b> / ${total}…`
      : `Building history: <b>${done}</b> / ${total}`;
    status.innerHTML = `
      <div class="bh-bf-progress" role="status" aria-live="polite">
        <span class="bh-bf-text">${label}</span>
        <span class="bh-bf-bar"><span class="bh-bf-bar-fill" style="width:${pct}%"></span></span>
        <button type="button" class="bh-btn bh-bf-cancel">Cancel</button>
      </div>`;
    status.hidden = false;
    status.querySelector(".bh-bf-cancel")?.addEventListener("click", () => {
      this.cancelled = true;
      const text = status.querySelector(".bh-bf-text");
      if (text) text.textContent = "Stopping after this message…";
    });
  },

  clearStatus() {
    const status = this.status();
    if (!status) return;
    status.innerHTML = "";
    status.hidden = true;
  },

  // ── modes ─────────────────────────────────────────────────────────────────
  /**
   * @param mode "turn" re-runs the latest message, "build" walks what has not been
   *   processed yet, "rebuild" clears the state and walks everything.
   */
  async run(mode) {
    if (this.running) {
      BH.toast("Already building — cancel that first");
      return;
    }
    const chatId = BH.dock.chatId;
    if (!chatId) {
      BH.toast("No chat open");
      return;
    }

    this.running = true;
    this.cancelled = false;
    try {
      if (mode === "turn") {
        this.setProgress({ done: 0, total: 1, inFlight: true });
        await this.runOne(chatId, null);
        BH.toast("Re-extracted this turn");
        return;
      }

      const all = await this.messages(chatId);
      let todo = all;
      if (mode === "build") {
        const last = await this.lastProcessed(chatId);
        const index = last ? all.findIndex((row) => row.id === last) : -1;
        todo = index >= 0 ? all.slice(index + 1) : all;
      }

      if (todo.length === 0) {
        BH.toast(mode === "build" ? "Already up to date" : "Nothing to build from");
        return;
      }
      // One model call per message, so the operator is told the size of the bill
      // before it is run rather than after.
      const what = mode === "rebuild" ? "Rebuild from scratch" : "Build from history";
      if (!window.confirm(`${what}: extract from ${todo.length} message${todo.length === 1 ? "" : "s"}?`)) return;

      if (mode === "rebuild") await this.clearState(chatId);

      for (let index = 0; index < todo.length; index += 1) {
        if (this.cancelled) {
          BH.toast(`Stopped after ${index} of ${todo.length}`);
          break;
        }
        this.setProgress({ done: index, total: todo.length, inFlight: true });
        try {
          await this.runOne(chatId, todo[index].id);
        } catch (error) {
          // One bad message should not throw away the work already done.
          BH.toast(`Message ${index + 1} failed: ${error.message}`);
        }
        BH.dock.refresh?.();
      }
      if (!this.cancelled) BH.toast(`Built state from ${todo.length} message${todo.length === 1 ? "" : "s"}`);
    } catch (error) {
      BH.toast(`Could not build: ${error.message}`);
    } finally {
      this.running = false;
      this.clearStatus();
      BH.dock.refresh?.();
    }
  },

  // ── the "more build options" menu ─────────────────────────────────────────
  closeMenu() {
    document.querySelector(".beholder-bf-menu")?.remove();
    BH.dock.panel?.querySelector(".beholder-backfill-group")?.classList.remove("bh-menu-open");
    if (this.menuDismiss) {
      document.removeEventListener("click", this.menuDismiss, true);
      this.menuDismiss = null;
    }
  },

  toggleMenu() {
    if (document.querySelector(".beholder-bf-menu")) {
      this.closeMenu();
      return;
    }
    const group = BH.dock.panel?.querySelector(".beholder-backfill-group");
    if (!group) return;
    group.classList.add("bh-menu-open");

    const menu = document.createElement("div");
    menu.className = "beholder-bf-menu";
    menu.setAttribute("role", "menu");
    menu.innerHTML = `
      <button type="button" class="bh-bf-mode" data-mode="build" role="menuitem">
        <i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i>
        <span class="bh-bf-mode-text">
          <span class="bh-bf-mode-title">Build from history</span>
          <span class="bh-bf-mode-sub">walk the messages this chat has not extracted yet</span>
        </span>
      </button>
      <button type="button" class="bh-bf-mode" data-mode="turn" role="menuitem">
        <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>
        <span class="bh-bf-mode-text">
          <span class="bh-bf-mode-title">Re-extract this turn</span>
          <span class="bh-bf-mode-sub">run the latest message again — for when it read one turn wrong</span>
        </span>
      </button>
      <button type="button" class="bh-bf-mode bh-bf-mode-danger" data-mode="rebuild" role="menuitem">
        <i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i>
        <span class="bh-bf-mode-text">
          <span class="bh-bf-mode-title">Rebuild from scratch</span>
          <span class="bh-bf-mode-sub">clear the tracked state and re-extract every message</span>
        </span>
      </button>`;

    // Rendered to the document, not inside the panel: the panel clips its overflow
    // and would cut the menu off.
    document.body.appendChild(menu);
    const anchor = group.getBoundingClientRect();
    const width = menu.offsetWidth || 280;
    const height = menu.offsetHeight || 180;
    let left = anchor.left + anchor.width / 2 - width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    let top = anchor.bottom + 6;
    if (top + height > window.innerHeight - 8) top = Math.max(8, anchor.top - height - 6);
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;

    for (const option of menu.querySelectorAll(".bh-bf-mode")) {
      option.addEventListener("click", () => {
        const mode = option.dataset.mode;
        this.closeMenu();
        void this.run(mode);
      });
    }
    this.menuDismiss = (event) => {
      if (event.target?.closest?.(".beholder-bf-menu, .beholder-backfill-group")) return;
      this.closeMenu();
    };
    setTimeout(() => document.addEventListener("click", this.menuDismiss, true), 0);
  },
};
