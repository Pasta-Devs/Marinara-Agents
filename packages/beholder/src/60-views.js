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
  /**
   * Persist the selection for a named chat.
   *
   * The chat is passed in rather than resolved here. Resolving it at save time read
   * whichever chat was current *then*, so a view left open across a chat switch could
   * write the selection to the wrong one; and reading it from `props` alone missed the
   * `BH.dock.chatId` fallback and silently saved nothing. The caller resolves it once,
   * before it awaits anything, and the save is bound to that.
   */
  async setTemplate(props, templateId, chatId) {
    if (!chatId) throw new Error("no chat to save to");
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

  /**
   * Which connection is answering, stated plainly.
   *
   * The local slot silently outranks the agent's connection server-side, so without
   * this the operator has no way to know which model produced a bad extraction.
   */
  connectionBanner({ routing, servedLocally, model, installed }) {
    if (servedLocally) {
      const version = BH.sidecar.versionLabel(installed);
      return `<p class="bh-view-note bh-conn bh-conn-local">
        <i class="fa-solid fa-microchip"></i> Answering: <b>local Beholder model</b>
        <small>${BH.escapeHtml(installed?.file || BH.sidecar.FILE)} · version <code>${BH.escapeHtml(version)}</code></small>
        <small>The engine's model slot takes precedence over this agent's connection.</small></p>`;
    }
    if (routing && installed) {
      return `<p class="bh-view-note bh-conn">
        <i class="fa-solid fa-plug"></i> Answering: <b>agent connection</b>
        ${model ? `<code>${BH.escapeHtml(model)}</code>` : ""}
        <small>${BH.escapeHtml(routing.reason || "The local model slot is not serving this agent.")}</small></p>`;
    }
    return model
      ? `<p class="bh-view-note bh-conn"><i class="fa-solid fa-plug"></i> Answering:
         <b>agent connection</b> <code>${BH.escapeHtml(model)}</code></p>`
      : `<p class="bh-view-note bh-conn">No agent connection model detected.</p>`;
  },

  /**
   * Install, version and update for the local model — deliberately in the prompt view,
   * because choosing the model and choosing the prompt are the same decision.
   */
  modelSection({ sidecarStatus, installed, servedLocally }) {
    if (!sidecarStatus) return "";
    if (!installed) {
      return `<div class="bh-model-block">
        <p class="bh-view-note"><b>Local Beholder model</b> — not installed.</p>
        <p class="bh-view-note">Downloads ${BH.escapeHtml(BH.sidecar.FILE)} from
          <code>${BH.escapeHtml(BH.sidecar.REPO)}</code> into the engine's own model slot. This does not
          touch or replace the model your engine's sidecar is already running.</p>
        ${
          sidecarStatus.runtimeInstalled
            ? ""
            : `<p class="bh-view-warn"><i class="fa-solid fa-triangle-exclamation"></i>
               The local runtime is not installed yet. Set up the engine's sidecar first; this slot reuses
               that runtime and will not install it for you.</p>`
        }
        <button type="button" class="bh-btn" data-model-action="install">Download model</button>
      </div>`;
    }
    return `<div class="bh-model-block">
      <p class="bh-view-note"><b>Local Beholder model</b> installed —
        version <code>${BH.escapeHtml(BH.sidecar.versionLabel(installed))}</code>
        ${servedLocally ? `<span class="bh-pill-on">serving</span>` : `<span class="bh-pill-off">off</span>`}</p>
      <div class="bh-model-actions">
        <button type="button" class="bh-btn" data-model-action="${servedLocally ? "disable" : "enable"}">
          ${servedLocally ? "Stop using local model" : "Use local model"}</button>
        <button type="button" class="bh-btn" data-model-action="update-check">Check for updates</button>
      </div>
      <p class="bh-view-note bh-model-update"></p>
      ${this.hardwareSection(sidecarStatus.settings)}
    </div>`;
  },

  /**
   * The hardware choices, and only those.
   *
   * Sampling is not offered: the extractor is graded against a schema and was tuned
   * with fixed sampling, so a temperature dial here would only let someone quietly
   * break their own setup. How much of the machine to spend on it is genuinely theirs
   * to decide.
   */
  hardwareSection(settings) {
    if (!settings) return "";
    const offload = settings.gpuLayers === 0 ? "cpu" : settings.gpuLayers === -1 ? "gpu" : "custom";
    return `<details class="bh-hw">
      <summary>Hardware</summary>
      <p class="bh-view-note">How much of this machine the local model may use. Sampling is fixed to what the
        model was trained with and is not adjustable.</p>
      <label class="bh-hw-row"><span>Offload</span>
        <select data-hw="offload">
          <option value="cpu" ${offload === "cpu" ? "selected" : ""}>CPU only</option>
          <option value="gpu" ${offload === "gpu" ? "selected" : ""}>Maximum GPU</option>
          <option value="custom" ${offload === "custom" ? "selected" : ""}>Set GPU layers…</option>
        </select></label>
      <label class="bh-hw-row ${offload === "custom" ? "" : "bh-hw-hidden"}" data-hw-row="layers"><span>GPU layers</span>
        <input type="number" data-hw="gpuLayers" min="0" max="999"
          value="${offload === "custom" ? String(settings.gpuLayers) : "20"}"></label>
      <label class="bh-hw-row"><span>Context</span>
        <input type="number" data-hw="contextSize" min="512" max="131072" step="512"
          value="${String(settings.contextSize)}"></label>
      <label class="bh-hw-row"><span>Parallel slots</span>
        <input type="number" data-hw="maxParallelJobs" min="1" max="8" value="${String(settings.maxParallelJobs)}"></label>
      <button type="button" class="bh-btn" data-model-action="save-hardware">Save hardware settings</button>
      <p class="bh-view-note">Saving restarts the local model so the change takes effect. The engine's own
        sidecar is not affected.</p>
    </details>`;
  },

  wireModelSection(body, { installed }) {
    const note = body.querySelector(".bh-model-update");
    const say = (text, warn) => {
      if (!note) return;
      note.textContent = text;
      note.classList.toggle("bh-view-warn", !!warn);
    };
    const offloadSelect = body.querySelector('[data-hw="offload"]');
    if (offloadSelect) {
      offloadSelect.addEventListener("change", () => {
        const row = body.querySelector('[data-hw-row="layers"]');
        if (row) row.classList.toggle("bh-hw-hidden", offloadSelect.value !== "custom");
      });
    }
    for (const button of body.querySelectorAll("[data-model-action]")) {
      button.addEventListener("click", async () => {
        const action = button.getAttribute("data-model-action");
        const original = button.textContent;
        button.disabled = true;
        try {
          if (action === "install") {
            button.textContent = "Downloading…";
            await BH.sidecar.install();
            BH.toast("Model downloaded");
            await this.promptView();
            return;
          }
          if (action === "enable" || action === "disable") {
            await BH.sidecar.setActive(action === "enable");
            BH.toast(action === "enable" ? "Local model is now serving Beholder" : "Local model stopped");
            await this.promptView();
            return;
          }
          if (action === "save-hardware") {
            const read = (name) => Number(body.querySelector(`[data-hw="${name}"]`)?.value);
            const offload = body.querySelector('[data-hw="offload"]')?.value;
            const gpuLayers = offload === "cpu" ? 0 : offload === "gpu" ? -1 : read("gpuLayers");
            button.textContent = "Restarting…";
            await BH.sidecar.updateSettings({
              gpuLayers,
              contextSize: read("contextSize"),
              maxParallelJobs: read("maxParallelJobs"),
            });
            BH.toast("Hardware settings saved");
            await this.promptView();
            return;
          }
          if (action === "update-check") {
            button.textContent = "Checking…";
            const check = await BH.sidecar.updateCheck();
            if (!check) say("Could not reach the model repository.", true);
            else if (check.indeterminate) {
              // Never imply "current" when the comparison could not be made.
              say(
                "Could not tell whether a newer build exists. Re-downloading is safe but not confirmed needed.",
                true,
              );
            } else if (check.updateAvailable) {
              say(
                `A newer build is available (${String(check.availableOid || "").slice(0, 12)}). ` +
                  `Re-download to update; the extractor's accuracy depends on matching prompts and weights.`,
                true,
              );
            } else {
              say(`Up to date (version ${BH.sidecar.versionLabel(installed)}).`, false);
            }
          }
        } catch (error) {
          BH.toast(`Could not complete: ${error.message}`);
          say(error.message, true);
        } finally {
          button.disabled = false;
          button.textContent = original;
        }
      });
    }
  },

  async promptView() {
    // Drawn before the network work so the dock button gives immediate feedback; the
    // body is filled in once the answers arrive.
    const loading =
      document.querySelector(".bh-view-overlay") ??
      this.open("Prompt", `<p class="bh-view-lead">Checking which model will answer…</p>`);
    const props = BH.dock.props ?? {};
    // Resolved once, before anything is awaited, so every read and write below refers
    // to the chat this view is actually showing.
    const chatId = props?.chatId ?? BH.dock.chatId;
    const selected = await this.liveTemplate(chatId, props);
    let usingFivePass = selected === BH_FIVE_PASS_ID;

    // The local slot outranks the agent's connection, so ask the engine what will
    // actually answer rather than inferring it from the connection list.
    const routing = await BH.sidecar.routing();
    const sidecarStatus = await BH.sidecar.status();
    const servedLocally = routing?.source === "utility-sidecar";
    const installed = sidecarStatus?.models?.[BH.sidecar.MODEL_ID] ?? null;

    // When the trained model is answering, the five-pass prompt is the only correct
    // one. Select it rather than leaving the operator a way to break their own setup.
    if (servedLocally && !usingFivePass) {
      try {
        await this.setTemplate(props, BH_FIVE_PASS_ID, chatId);
        // Only after the save actually succeeded: claiming the switch happened when it
        // did not would show a locked picker over the wrong prompt.
        usingFivePass = true;
      } catch {
        // Fall through: the banner below still says which prompt is required.
      }
    }
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
    // Only meaningful when the agent connection is what answers; the local slot's
    // prompt is decided for the operator.
    const mismatch = !servedLocally && model && trained !== usingFivePass;

    this.open(
      "Prompt",
      `
      <p class="bh-view-lead">These are not interchangeable. The trained Beholder model was taught five short
      per-lane prompts; a general model needs the single long prompt. Give either one the other's prompt and
      extraction degrades badly, so pick the one that matches the model you are pointing at.</p>
      ${BH.views.connectionBanner({ routing, servedLocally, model, installed })}
      ${
        mismatch
          ? `<p class="bh-view-warn"><i class="fa-solid fa-triangle-exclamation"></i> This looks like a mismatch:
             ${trained ? "the model looks like the trained Beholder model, but the single-prompt template is selected." : "the model does not look like the trained Beholder model, but the five-pass template is selected."}</p>`
          : ""
      }
      <div class="bh-prompt-options">
        <label class="bh-prompt-option ${usingFivePass ? "" : "bh-prompt-active"}">
          <input type="radio" name="bh-prompt" value="" ${usingFivePass ? "" : "checked"}
            ${servedLocally ? "disabled" : ""}>
          <span><b>SOTA model — one prompt</b><small>One call covering every field. For a strong general model
          (GPT-5.5+, Claude Opus 4.8+, Kimi K3+).</small></span>
        </label>
        <label class="bh-prompt-option ${usingFivePass ? "bh-prompt-active" : ""}">
          <input type="radio" name="bh-prompt" value="${BH_FIVE_PASS_ID}" ${usingFivePass ? "checked" : ""}
            ${servedLocally ? "disabled" : ""}>
          <span><b>Local Beholder model — five passes</b><small>Five short per-lane calls, the prompts the
          model was trained on. For GetBeholder/Beholder-GGUF served locally.</small></span>
        </label>
      </div>
      <p class="bh-view-note bh-prompt-current">Currently selected:
        <b>${usingFivePass ? "Local Beholder model — five passes" : "SOTA model — one prompt"}</b>
        ${servedLocally ? `<span class="bh-prompt-locked">locked by the local model slot</span>` : ""}</p>
      ${BH.views.modelSection({ sidecarStatus, installed, servedLocally })}`,
      (body) => {
        BH.views.wireModelSection(body, { installed, servedLocally });
        for (const input of body.querySelectorAll('input[name="bh-prompt"]')) {
          input.addEventListener("change", async (event) => {
            try {
              await this.setTemplate(props, event.target.value || null, chatId);
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
