// ── Overlay views: Prompt, Doctor, Help ──────────────────────────────────────
// The extension's model-management view does not come across — in Marinara the
// extraction runs server-side through the operator's own connection, so there is no
// engine to download or probe here. What replaces it is prompt management, which is
// the part that actually decides whether extraction works: the trained model and a
// general model need DIFFERENT prompts, and feeding one the other's prompt degrades
// it badly. So the active prompt is stated plainly and is switchable.

const BH_FIVE_PASS_ID = "beholder-local-five-pass";
/** The trained extractor answers to a model id carrying its own name. */
const BH_LOOKS_TRAINED = (value) => /beholder/i.test(String(value || ""));

BH.views = {
  close() {
    document.querySelector(".bh-view-overlay")?.remove();
    if (this.onKeydown) {
      document.removeEventListener("keydown", this.onKeydown, true);
      this.onKeydown = null;
    }
    // Put the caret back where it was, or the keyboard user is dropped at the top.
    this.returnFocusTo?.focus?.();
    this.returnFocusTo = null;
  },

  open(title, bodyHtml, onMount) {
    this.close();
    const overlay = document.createElement("div");
    overlay.className = "bh-view-overlay";
    overlay.innerHTML = `
      <div class="bh-view">
        <div class="bh-view-head">
          <span class="bh-view-title">${BH.escapeHtml(title)}</span>
          <button class="bh-view-close fa-solid fa-xmark" title="Close"></button>
        </div>
        <div class="bh-view-body">${bodyHtml}</div>
      </div>`;
    document.body.appendChild(overlay);
    const closeButton = overlay.querySelector(".bh-view-close");
    closeButton.addEventListener("click", () => this.close());
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) this.close();
    });
    // It behaves like a modal, so it has to be dismissable and reachable like one:
    // without this a keyboard user tabs through the whole page behind it to escape.
    this.onKeydown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        this.close();
      }
    };
    document.addEventListener("keydown", this.onKeydown, true);
    this.returnFocusTo = document.activeElement;
    closeButton.focus?.();
    onMount?.(overlay.querySelector(".bh-view-body"));
    return overlay;
  },

  // ── Prompt ────────────────────────────────────────────────────────────────
  /** Which template this chat has selected, or null for the agent's default. */
  selectedTemplate(props) {
    const map = props?.metadata?.agentPromptTemplateIds;
    const value = map && typeof map === "object" ? map.beholder : null;
    return typeof value === "string" && value.trim() ? value.trim() : null;
  },

  /**
   * The selection as the server has it.
   *
   * capabilityProps are a snapshot from the last time the host handed them over, so
   * a selection made since then would be reported stale — and reporting the wrong
   * prompt is precisely the mistake these views exist to prevent.
   */
  async liveTemplate(chatId, props) {
    if (!chatId) return this.selectedTemplate(props);
    try {
      const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return this.selectedTemplate(props);
      const chat = await res.json();
      return this.selectedTemplate({ metadata: chat?.metadata });
    } catch {
      return this.selectedTemplate(props);
    }
  },

  /**
   * Persist the selection, then update the props snapshot the views read.
   *
   * capabilityProps are handed over by the host and are not refreshed on our
   * schedule, so without this a reopened view could report the previous selection —
   * the exact wrong-prompt confusion these views exist to prevent.
   */
  async setTemplate(props, templateId) {
    const chatId = props?.chatId;
    if (!chatId) return;
    const existing = props?.metadata?.agentPromptTemplateIds;
    const next = { ...(existing && typeof existing === "object" ? existing : {}) };
    if (templateId) next.beholder = templateId;
    else delete next.beholder;
    const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}/metadata`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ agentPromptTemplateIds: next }),
    });
    if (!res.ok) throw new Error(`save ${res.status}`);
    // Keep the snapshot in step with what was just persisted.
    if (props?.metadata && typeof props.metadata === "object") props.metadata.agentPromptTemplateIds = next;
    if (BH.dock?.props?.metadata && typeof BH.dock.props.metadata === "object") {
      BH.dock.props.metadata.agentPromptTemplateIds = next;
    }
  },

  async promptView() {
    // Drawn before the network work so the dock button gives immediate feedback; the
    // body is filled in once the answers arrive.
    const loading =
      document.querySelector(".bh-view-overlay") ??
      this.open("Prompt", `<p class="bh-view-lead">Checking which model will answer…</p>`);
    const props = BH.dock.props ?? {};
    const selected = await this.liveTemplate(props?.chatId ?? BH.dock.chatId, props);
    const usingFivePass = selected === BH_FIVE_PASS_ID;
    // The model the agent will actually call, so a mismatch can be named rather
    // than left for the operator to discover through bad extractions.
    let model = "";
    try {
      const res = await fetch("/api/connections", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const rows = await res.json();
        const list = Array.isArray(rows) ? rows : (rows.connections ?? []);
        const forAgents = list.find((c) => c.defaultForAgents) ?? list.find((c) => c.isDefault) ?? list[0];
        model = forAgents?.model ?? "";
      }
    } catch {
      // Naming the model is a courtesy; the picker works without it.
    }
    // The requests are slower than a click. If the operator closed this view or opened
    // another one meanwhile, finishing would yank Prompt back over what they chose.
    if (!loading.isConnected) return;

    const trained = BH_LOOKS_TRAINED(model);
    const mismatch = model && trained !== usingFivePass;

    this.open(
      "Prompt",
      `
      <p class="bh-view-lead">These are not interchangeable. The trained Beholder model was taught five short
      per-lane prompts; a general model needs the single long prompt. Give either one the other's prompt and
      extraction degrades badly, so pick the one that matches the model you are pointing at.</p>
      ${
        model
          ? `<p class="bh-view-note">Agent connection model: <code>${BH.escapeHtml(model)}</code></p>`
          : `<p class="bh-view-note">No agent connection model detected.</p>`
      }
      ${
        mismatch
          ? `<p class="bh-view-warn"><i class="fa-solid fa-triangle-exclamation"></i> This looks like a mismatch:
             ${trained ? "the model looks like the trained Beholder model, but the single-prompt template is selected." : "the model does not look like the trained Beholder model, but the five-pass template is selected."}</p>`
          : ""
      }
      <div class="bh-prompt-options">
        <label class="bh-prompt-option ${usingFivePass ? "" : "bh-prompt-active"}">
          <input type="radio" name="bh-prompt" value="" ${usingFivePass ? "" : "checked"}>
          <span><b>SOTA model — one prompt</b><small>One call covering every field. For a strong general model
          (GPT-5.5+, Claude Opus 4.8+, Kimi K3+).</small></span>
        </label>
        <label class="bh-prompt-option ${usingFivePass ? "bh-prompt-active" : ""}">
          <input type="radio" name="bh-prompt" value="${BH_FIVE_PASS_ID}" ${usingFivePass ? "checked" : ""}>
          <span><b>Local Beholder model — five passes</b><small>Five short per-lane calls, the prompts the
          model was trained on. For GetBeholder/Beholder-GGUF served locally.</small></span>
        </label>
      </div>
      <p class="bh-view-note bh-prompt-current">Currently selected:
        <b>${usingFivePass ? "Local Beholder model — five passes" : "SOTA model — one prompt"}</b></p>`,
      (body) => {
        for (const input of body.querySelectorAll('input[name="bh-prompt"]')) {
          input.addEventListener("change", async (event) => {
            try {
              await this.setTemplate(props, event.target.value || null);
              BH.toast("Prompt selection saved");
              this.close();
            } catch (error) {
              BH.toast(`Could not save: ${error.message}`);
            }
          });
        }
      },
    );
  },

  // ── Doctor ────────────────────────────────────────────────────────────────
  /** The last extraction, end to end, so a bad turn can be looked at rather than guessed at. */
  async doctorView() {
    this.open("Doctor", `<p class="bh-view-lead">Reading the last extraction…</p>`, async (body) => {
      const chatId = BH.dock.chatId;
      const lines = [];
      try {
        const res = await fetch(`/api/agents/beholder-state/${encodeURIComponent(chatId)}`, {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });
        const snapshot = res.ok ? await res.json() : null;
        const characters = snapshot?.state?.characters ?? [];
        const slots = characters.reduce((n, c) => n + Object.keys(c.body ?? {}).length, 0);
        const selected = await this.liveTemplate(BH.dock.chatId, BH.dock.props ?? {});
        lines.push(
          `<dl class="bh-doctor-facts">
             <dt>Last extraction</dt><dd>${snapshot?.createdAt ? BH.escapeHtml(new Date(snapshot.createdAt).toLocaleString()) : "none yet"}</dd>
             <dt>From message</dt><dd><code>${BH.escapeHtml(snapshot?.messageId ?? "—")}</code></dd>
             <dt>Characters tracked</dt><dd>${characters.length}</dd>
             <dt>Slots filled</dt><dd>${slots}</dd>
             <dt>Prompt in use</dt><dd>${selected === BH_FIVE_PASS_ID ? "five passes (local model)" : "one prompt (SOTA model)"}</dd>
           </dl>`,
        );
        lines.push(
          `<div class="bh-editor-group-label">state as stored</div>
           <pre class="bh-doctor-json">${BH.escapeHtml(JSON.stringify(snapshot?.state ?? {}, null, 2))}</pre>`,
        );
        if (characters.length === 0) {
          lines.push(
            `<p class="bh-view-note">Nothing tracked yet. Beholder reads a turn after it is generated, so the
             first state appears once the scene describes what someone is wearing, holding, or hurt by.</p>`,
          );
        }
      } catch (error) {
        lines.push(`<p class="bh-view-warn">Could not read the state: ${BH.escapeHtml(error.message)}</p>`);
      }
      body.innerHTML = lines.join("");
    });
  },

  // ── Help ──────────────────────────────────────────────────────────────────
  helpView() {
    this.open(
      "Help",
      `
      <p class="bh-view-lead">Beholder reads each turn and keeps what the prose actually says about bodies:
      what is worn per slot, what is held, wounds, bare and missing parts, and species.</p>

      <div class="bh-editor-group-label">reading the doll</div>
      <ul class="bh-help-list">
        <li><b>Outline</b> on a body part — the worst damage among what is worn there.</li>
        <li><b>Fill</b> on a body part — a wound on the body itself, deepening with severity.</li>
        <li><b>✦</b> beside a hand — something is held.</li>
        <li>A struck-through slot with <b>MISSING</b> — an acquired loss; it also applies to everything below it.</li>
        <li><b>BARE</b> — the slot is explicitly uncovered, which is not the same as simply having nothing recorded.</li>
      </ul>

      <div class="bh-editor-group-label">layers</div>
      <p>The Color, Damage and Wounds toggles only change what is drawn. Turning one off hides that detail; it
      does not forget it.</p>

      <div class="bh-editor-group-label">editing</div>
      <ul class="bh-help-list">
        <li>Click any slot card to correct it. Apply writes to the stored state, so the next turn is built on
        your correction rather than the model's guess.</li>
        <li><b>Lock</b> a slot when you have set it deliberately and want it left alone.</li>
        <li><b>bare</b> clears what is worn on apply; <b>missing</b> overrides the whole slot.</li>
      </ul>

      <div class="bh-editor-group-label">writing for it</div>
      <ul class="bh-help-list">
        <li>Name the garment and the person: "she pulls off <i>her</i> gloves" is read; "they undress" is not.</li>
        <li>Say what comes off as its own clause. One sentence that removes and adds at once is the case it
        most often gets half right.</li>
        <li>Scenery is ignored on purpose — a cloak on a hook belongs to nobody.</li>
      </ul>`,
    );
  },
};
