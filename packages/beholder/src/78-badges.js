// ── What each message changed ───────────────────────────────────────────────
//
// The panel shows the state as it is now. The question it cannot answer is "which turn
// did that?" — and that is the question you have when something is wrong, because the
// turn that introduced it is the one you want to read again. The reference extension
// answers it with a small row of badges under each message, and this is that row.
//
// Two things make it possible here. The engine records every agent run against the
// message it read, and /api/agents/beholder-runs returns what each run CHANGED rather
// than everything it holds — a running total under every message would just be the same
// wall of text repeated down the page.
//
// About writing into the host's message list: this package does not own that DOM, and
// there is no per-message contribution slot in the host's contract, so these badges are
// appended to it from outside. That is only acceptable under strict rules, which the
// code below keeps:
//
//   - Append only. No host node is modified, moved or removed, so the host's own
//     reconciliation can never be handed a node that is not where it left it.
//   - Idempotent. Re-running is always safe; each pass replaces its own row and touches
//     nothing else.
//   - Self-healing. A re-render that drops the row puts it back on the next tick rather
//     than leaving a message permanently unlabelled.
//
// Measured before it was written: an appended node survives a chat switch, a scroll
// through the list and composer input, with no errors from the host.

BH.badges = {
  observer: null,
  timer: null,

  /** The newest run per message: a re-run supersedes what the earlier one reported. */
  async load(chatId) {
    if (!chatId) return new Map();
    try {
      const res = await fetch(`/api/agents/beholder-runs/${encodeURIComponent(chatId)}?limit=30`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      // Distinguished from "no runs": a transient failure must not be read as confirmed
      // absence, or a blip wipes every badge on screen.
      if (!res.ok) return null;
      const runs = await res.json();
      const byMessage = new Map();
      // Newest first, so the first one seen for a message is the one that counts.
      for (const run of Array.isArray(runs) ? runs : []) {
        if (!run?.messageId || byMessage.has(run.messageId)) continue;
        byMessage.set(run.messageId, run);
      }
      return byMessage;
    } catch {
      return null;
    }
  },

  /**
   * What kind of change a slot holds now, for the badge's colour.
   *
   * Read from the state on screen rather than from the run, because the run carries
   * which slots changed and not what they became. A slot that is now empty was cleared;
   * anything else is named by what is in it.
   */
  kindFor(character, slot) {
    const value = BH.dock.state?.[character]?.body?.[slot];
    if (!value || typeof value !== "object") return "clear";
    if ((value.wounds ?? []).length) return "wound";
    if (value.holding) return "hold";
    if ((value.worn ?? []).length) return "add";
    if (value.bare || value.missing) return "mod";
    return "clear";
  },

  row(run) {
    const row = document.createElement("div");
    row.className = "beholder-msg-badges";
    // `changes: null` means there was no earlier run to compare against. The first
    // extraction in a chat did not change a body, it established one, and badging every
    // slot on that message would bury it.
    const changes = run.changes;
    if (!changes) return null;
    if (!changes.length) {
      // Said out loud rather than left blank: silence looks like Beholder never ran,
      // which is the one thing this row exists to rule out.
      row.classList.add("beholder-msg-noop");
      row.textContent = "no change";
      return row;
    }
    for (const change of changes) {
      for (const slot of change.slots ?? []) {
        const badge = document.createElement("span");
        badge.className = `bh-msg-badge bh-msg-${this.kindFor(change.name, slot)}`;
        const who = document.createElement("span");
        who.className = "bh-msg-char";
        who.textContent = change.name;
        const what = document.createElement("span");
        what.className = "bh-msg-text";
        what.textContent = BH_SLOT_LABELS[slot] || slot.replace(/_/g, " ");
        badge.append(who, what);
        row.appendChild(badge);
      }
    }
    return row;
  },

  /** Put a row under every message that has a run, and leave everything else alone. */
  async refresh(chatId = BH.dock.chatId) {
    const byMessage = await this.load(chatId);
    // null means the read failed; leave whatever is on screen alone rather than treating
    // a blip as proof this chat has nothing.
    if (!byMessage) return 0;
    if (!byMessage.size) {
      // Cleared, not merely skipped. Host message nodes survive a chat switch, so
      // returning early left the previous chat's badges sitting under this chat's
      // messages, describing changes that happened somewhere else entirely.
      for (const row of document.querySelectorAll(".beholder-msg-badges")) row.remove();
      return 0;
    }
    let placed = 0;
    for (const message of document.querySelectorAll("[data-message-id]")) {
      const run = byMessage.get(message.dataset.messageId);
      if (!run) continue;
      const row = this.row(run);
      if (!row) continue;
      // Ours to replace; nothing else in the message is touched.
      message.querySelector(":scope .beholder-msg-badges")?.remove();
      (message.querySelector(".mari-message-body") ?? message).appendChild(row);
      placed += 1;
    }
    return placed;
  },

  /**
   * Keep the rows in place as the host re-renders.
   *
   * Debounced, and it never reacts to its own writes — appending a row is itself a
   * mutation, so an observer that did not filter them out would call itself forever.
   */
  watch() {
    if (this.observer) return;
    const list = document.querySelector(".mari-messages-scroll") ?? document.body;
    this.observer = new MutationObserver((records) => {
      const ours = records.every((record) =>
        [...record.addedNodes, ...record.removedNodes].every(
          (node) => node.nodeType === 1 && node.classList?.contains("beholder-msg-badges"),
        ),
      );
      if (ours) return;
      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => void this.refresh(), 400);
    });
    this.observer.observe(list, { childList: true, subtree: true });
  },

  stop() {
    this.observer?.disconnect();
    this.observer = null;
    window.clearTimeout(this.timer);
    for (const row of document.querySelectorAll(".beholder-msg-badges")) row.remove();
  },
};
