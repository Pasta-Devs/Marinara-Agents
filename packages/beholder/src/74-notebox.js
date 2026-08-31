// ── Telling Beholder something directly ─────────────────────────────────────
//
// Everything else here waits for the story to say it. Sometimes you just want to state
// a fact — the sword broke, she is barefoot now — without writing a paragraph to carry
// it. The reference extension puts a small text box above the chat input for exactly
// that, and this is the same thing.
//
// What you type is read by the extractor as if it were a line of the story, with the
// current state as context, so an unnamed item still attaches to whoever is actually
// wearing it. That happens server-side, through the ordinary agent path with the typed
// text standing in for the narration.
//
// Which means it reads a directive the way it reads a story, and phrasing carries.
// Measured against the local model:
//
//   "Maggie takes off her belt."            → removed          ✓
//   "Maggie is now wearing black gloves."   → added            ✓
//   "Maggie has a deep cut on her left arm."→ wound added      ✓
//   "Maggie wears a belt with a tear in it."→ damage: damaged  ✓
//   "Maggie is wearing a torn belt."        → belt REMOVED     ✗
//
// The last one is why the placeholder shows a phrasing that works: an adjective
// attached to the garment reads as an event to a model trained on events. Saying what
// happened beats describing how a thing looks.
//
// The slots it touches are then locked. A directive that the next turn quietly
// overwrote would be worse than no directive at all: you would state a fact, watch it
// take, and find it gone two messages later with nothing to explain it.

BH.notebox = {
  /**
   * Mounted in Beholder's own panel, not above the host's message box.
   *
   * The reference extension puts it above SillyTavern's send form, and its own comment
   * admits that placement is unverified and version-dependent. Checked here against the
   * running engine: the composer has no stable hook at all — every ancestor is a
   * Tailwind utility class, so anchoring to one would break on the next restyle of a
   * product this package does not own.
   *
   * The panel is a floating window beside the chat, so a box in its footer is as
   * reachable as one above the message field, and it cannot be broken by anybody else.
   */
  /**
   * Does this engine understand a typed directive?
   *
   * It matters because an engine that does not will accept the request and ignore the
   * field, re-running the turn against the story instead — so the box would look like
   * it worked and quietly do something else. There is no way to tell that apart from
   * the response, so this asks after a route that shipped alongside the directive: if
   * the engine has one it has the other, and if it 404s it predates both.
   *
   * Asked once per chat and remembered, because the answer is a property of the engine
   * rather than of the moment.
   */
  async supported(chatId) {
    if (typeof this.support === "boolean") return this.support;
    if (!chatId) return true;
    try {
      const res = await fetch(`/api/agents/beholder-runs/${encodeURIComponent(chatId)}?limit=1`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      this.support = res.status !== 404;
    } catch {
      // A failed probe is not evidence of an old engine; assume support and let the
      // send report a real error if there is one.
      this.support = true;
    }
    return this.support;
  },

  mount() {
    if (document.querySelector(".beholder-notebox")) return true;
    const panel = BH.dock.panel;
    const anchor = panel?.querySelector(".beholder-resize-handle") ?? null;
    if (!panel) return false;

    const wrap = document.createElement("div");
    wrap.className = "beholder-notebox";
    wrap.innerHTML = `
      <input type="text" class="beholder-notebox-input"
        placeholder="Tell Beholder: e.g. &quot;Maggie takes off her boots&quot;"
        aria-label="Tell Beholder something about the scene">
      <button type="button" class="beholder-notebox-btn bh-btn" title="Apply now">
        <i class="fa-solid fa-paper-plane"></i>
      </button>`;
    // Above the resize handle when there is one, otherwise last in the panel.
    if (anchor) panel.insertBefore(wrap, anchor);
    else panel.appendChild(wrap);

    const input = wrap.querySelector(".beholder-notebox-input");
    const button = wrap.querySelector(".beholder-notebox-btn");
    const send = () => void this.apply(input, button);
    button.addEventListener("click", send);
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      // The host's composer listens for Enter too; this must not also send a message.
      event.preventDefault();
      event.stopPropagation();
      send();
    });

    // Shown, then disabled if the engine turns out to be too old. Hiding it outright
    // would leave someone reading about the box in Help and unable to find it.
    void this.supported(BH.dock.chatId).then((ok) => {
      if (ok) return;
      input.disabled = true;
      button.disabled = true;
      // Whatever was typed while the probe was in flight stays. Clearing it threw away
      // someone's sentence to tell them the feature is unavailable, which is a poor
      // trade for a message.
      input.placeholder = "Needs a newer version of Marinara";
      wrap.title =
        "This box asks Beholder to read a sentence you type. The version of Marinara you are running does not support that yet.";
    });
    return true;
  },

  unmount() {
    document.querySelector(".beholder-notebox")?.remove();
  },

  async apply(input, button) {
    const text = input.value.trim();
    if (!text) return;
    const chatId = BH.dock.chatId;
    if (!chatId) {
      BH.toast("Open a chat first");
      return;
    }

    input.disabled = true;
    button.disabled = true;
    const before = BH.dock.state ?? {};
    try {
      const res = await fetch("/api/generate/retry-agents", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, agentTypes: ["beholder"], beholderDirective: text }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      await res.text(); // the route streams; wait for the run to finish

      await BH.dock.refresh();
      const changed = this.changedSlots(before, BH.dock.state ?? {});
      // Locked so the next turn does not quietly undo what was just stated.
      for (const [character, slot] of changed) {
        BH.locks.set(character, slot, true);
        BH.locks.remember(character, slot, BH.dock.state?.[character]?.body?.[slot] ?? null);
      }
      BH.dock.render();
      input.value = "";
      BH.toast(
        changed.length
          ? `Applied to ${changed.length} slot${changed.length === 1 ? "" : "s"}, and locked so the story does not undo it`
          : "Nothing changed — try naming the person and the item",
      );
    } catch (error) {
      BH.toast(`Could not apply: ${error.message}`);
    } finally {
      input.disabled = false;
      button.disabled = false;
      input.focus();
    }
  },

  /** Which character/slot pairs differ between two states. */
  changedSlots(before, after) {
    const changed = [];
    for (const [character, entry] of Object.entries(after)) {
      for (const [slot, value] of Object.entries(entry?.body ?? {})) {
        const previous = before?.[character]?.body?.[slot];
        if (JSON.stringify(previous ?? null) !== JSON.stringify(value ?? null)) changed.push([character, slot]);
      }
    }
    return changed;
  },
};
