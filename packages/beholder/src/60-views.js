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
    document.querySelector(".bh-view")?.remove();
    if (this.onKeydown) {
      document.removeEventListener("keydown", this.onKeydown, true);
      this.onKeydown = null;
    }
    // Put the caret back where it was, or the keyboard user is dropped at the top.
    this.returnFocusTo?.focus?.();
    this.returnFocusTo = null;
  },

  /**
   * Open a view inside the panel.
   *
   * `.bh-view` is `position:absolute; inset:0` — it is built to fill the panel, the way
   * the reference extension does it, with a back arrow to the doll. This used to render
   * a full-viewport overlay instead, which dimmed the entire host app to show a legend:
   * heavier than the thing it was showing, and unlike every other surface here.
   */
  open(title, bodyHtml, onMount) {
    this.close();
    const panel = BH.dock.panel;
    const view = document.createElement("div");
    view.className = "bh-view";
    view.setAttribute("role", "dialog");
    view.setAttribute("aria-label", title);
    view.innerHTML = `
      <div class="bh-view-head">
        <button type="button" class="bh-view-back fa-solid fa-arrow-left" title="Back to the panel"
          aria-label="Back to the panel"></button>
        <span class="bh-view-title"><span class="bh-view-crumb">◉</span>${BH.escapeHtml(title)}</span>
        <button type="button" class="bh-view-close fa-solid fa-xmark" title="Close"></button>
      </div>
      <div class="bh-view-body">${bodyHtml}</div>`;
    (panel ?? document.body).appendChild(view);

    for (const dismiss of view.querySelectorAll(".bh-view-back, .bh-view-close")) {
      dismiss.addEventListener("click", () => this.close());
    }
    // The head doubles as the panel's drag grip while a view covers the header, so
    // only the scrollable body swallows mousedown.
    view.addEventListener("mousedown", (event) => {
      if (!event.target.closest(".bh-view-head")) event.stopPropagation();
    });
    this.onKeydown = (event) => {
      if (event.key !== "Escape") return;
      // A field can claim Escape for itself. This handler is on `document` with capture,
      // which means it runs before ANY listener on a descendant — capture travels from
      // the root down to the target — so a field cannot win this by listening harder.
      // It has to be decided here. Without it, pressing Escape to abandon a half-typed
      // name closed the whole view and lost the row being worked on.
      if (event.target?.closest?.("[data-bh-escape='self']")) return;
      event.stopPropagation();
      this.close();
    };
    document.addEventListener("keydown", this.onKeydown, true);
    this.returnFocusTo = document.activeElement;
    view.querySelector(".bh-view-back")?.focus?.();
    onMount?.(view.querySelector(".bh-view-body"));
    return view;
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
    // Reports whether the value came from the chat or from the snapshot fallback.
    // Callers that gate a lock on it need to know: locking on an unconfirmed snapshot
    // can pin the wrong prompt with no way to correct it.
    const fallback = { templateId: this.selectedTemplate(props), confirmed: false };
    if (!chatId) return fallback;
    try {
      const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return fallback;
      const chat = await res.json();
      return { templateId: this.selectedTemplate({ metadata: chat?.metadata }), confirmed: true };
    } catch {
      return fallback;
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
    // Only when the dock is still on the chat this save targeted. A save for chat A
    // completing after a switch to B would otherwise stamp A's selection onto B's live
    // snapshot, and later views would read the wrong prompt for B until a refresh.
    const dockChatId = BH.dock?.props?.chatId ?? BH.dock?.chatId;
    if (dockChatId === chatId && BH.dock?.props?.metadata && typeof BH.dock.props.metadata === "object") {
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
      document.querySelector(".bh-view") ??
      this.open("Prompt", `<p class="bh-view-lead">Checking which model will answer…</p>`);
    const props = BH.dock.props ?? {};
    // Resolved once, before anything is awaited, so every read and write below refers
    // to the chat this view is actually showing.
    const chatId = props?.chatId ?? BH.dock.chatId;
    const live = await this.liveTemplate(chatId, props);
    let usingFivePass = live.templateId === BH_FIVE_PASS_ID;
    // True once the value is known to match the saved chat, either because the read
    // succeeded or because we just wrote it.
    let confirmed = live.confirmed;

    // The local slot outranks the agent's connection, so ask the engine what will
    // actually answer rather than inferring it from the connection list.
    const routing = await BH.sidecar.routing();
    const sidecarStatus = await BH.sidecar.status();
    const servedLocally = routing?.source === "utility-sidecar";
    const installed = sidecarStatus?.models?.[BH.sidecar.MODEL_ID] ?? null;

    // When the trained model is answering, the five-pass prompt is the only correct
    // one. Select it rather than leaving the operator a way to break their own setup.
    let autoSelectFailed = false;
    if (servedLocally && !usingFivePass) {
      try {
        await this.setTemplate(props, BH_FIVE_PASS_ID, chatId);
        // Only after the save actually succeeded: claiming the switch happened when it
        // did not would show a locked picker over the wrong prompt.
        usingFivePass = true;
        confirmed = true;
      } catch {
        // The picker stays usable in this case. Locking it here would strand the
        // operator on the wrong prompt for a local model with no way to correct it.
        autoSelectFailed = true;
      }
    }
    // Locked only once the correct prompt is known to be the saved one. An unconfirmed
    // snapshot is not enough: it can disagree with the chat, and locking on it pins the
    // wrong prompt against a local model with no way to correct it.
    const lockPicker = servedLocally && usingFivePass && confirmed;
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
        autoSelectFailed
          ? `<p class="bh-view-warn"><i class="fa-solid fa-triangle-exclamation"></i> The local model is answering, but
             the five-pass prompt could not be saved. Select it below — the local model needs it.</p>`
          : ""
      }
      ${
        mismatch
          ? `<p class="bh-view-warn"><i class="fa-solid fa-triangle-exclamation"></i> This looks like a mismatch:
             ${trained ? "the model looks like the trained Beholder model, but the single-prompt template is selected." : "the model does not look like the trained Beholder model, but the five-pass template is selected."}</p>`
          : ""
      }
      <div class="bh-prompt-options">
        <label class="bh-prompt-option ${usingFivePass ? "" : "bh-prompt-active"}">
          <input type="radio" name="bh-prompt" value="" ${usingFivePass ? "" : "checked"}
            ${lockPicker ? "disabled" : ""}>
          <span><b>SOTA model — one prompt</b><small>One call covering every field. For a strong general model
          (GPT-5.5+, Claude Opus 4.8+, Kimi K3+).</small></span>
        </label>
        <label class="bh-prompt-option ${usingFivePass ? "bh-prompt-active" : ""}">
          <input type="radio" name="bh-prompt" value="${BH_FIVE_PASS_ID}" ${usingFivePass ? "checked" : ""}
            ${lockPicker ? "disabled" : ""}>
          <span><b>Local Beholder model — five passes</b><small>Five short per-lane calls, the prompts the
          model was trained on. For GetBeholder/Beholder-GGUF served locally.</small></span>
        </label>
      </div>
      <p class="bh-view-note bh-prompt-current">Currently selected:
        <b>${usingFivePass ? "Local Beholder model — five passes" : "SOTA model — one prompt"}</b>
        ${lockPicker ? `<span class="bh-prompt-locked">locked by the local model slot</span>` : ""}</p>
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
  /**
   * Health checks, in the reference extension's sense: is this set up correctly?
   *
   * Distinct from the Inspector, which shows one round trip. Doctor answers "why is
   * nothing appearing" without the operator having to know which of the four things
   * that could be wrong to go and look at.
   */
  checkRow(state, label, detail) {
    const icon = state === "ok" ? "fa-circle-check" : state === "warn" ? "fa-triangle-exclamation" : "fa-circle-xmark";
    return `<div class="bh-vlog-row bh-vlog-${state}">
      <b><i class="fa-solid ${icon}" aria-hidden="true"></i> ${BH.escapeHtml(label)}</b>
      <span>${detail}</span>
    </div>`;
  },

  /** Whether Beholder is switched on for this chat, read from the chat itself. */
  async agentActive(chatId) {
    // The props snapshot does not carry the chat's agent list, so reading it there
    // reported the agent inactive while it was plainly running — a check that is wrong
    // in the healthy case is worse than no check.
    if (!chatId) return null;
    try {
      const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return null;
      const meta = (await res.json())?.metadata ?? {};
      if (meta.enableAgents === false) return false;
      const active = meta.agentPromptTemplateIds ? Object.keys(meta.agentPromptTemplateIds) : [];
      const ids = Array.isArray(meta.activeAgentIds) ? meta.activeAgentIds : active;
      return ids.includes("beholder");
    } catch {
      return null;
    }
  },

  async healthChecks(chatId, chatProps, snapshot) {
    const rows = [];
    const agentOn = await this.agentActive(chatId);
    rows.push(
      agentOn === true
        ? this.checkRow("ok", "Agent", "Beholder is switched on for this chat.")
        : agentOn === false
          ? this.checkRow(
              "error",
              "Agent",
              "Beholder is turned off for this chat, so nothing will be read. Turn it on in the agents menu.",
            )
          : // Unknown is reported as unknown rather than guessed either way.
            this.checkRow("warn", "Agent", "Could not check whether Beholder is turned on for this chat."),
    );

    const routing = await BH.sidecar.routing();
    const status = await BH.sidecar.status();
    const servedLocally = routing?.source === "utility-sidecar";
    const installed = status?.models?.[BH.sidecar.MODEL_ID] ?? null;
    rows.push(
      servedLocally
        ? this.checkRow(
            "ok",
            "Model",
            `Reading with the local Beholder model · version <code>${BH.escapeHtml(BH.sidecar.versionLabel(installed))}</code>.`,
          )
        : this.checkRow(
            "warn",
            "Model",
            `Reading with this agent's own connection. ${BH.escapeHtml(routing?.reason ?? "")}`,
          ),
    );

    const selected = (await this.liveTemplate(chatId, chatProps)).templateId;
    const usingFivePass = selected === BH_FIVE_PASS_ID;
    // The pairing is the single most common way this ends up quietly broken.
    if (servedLocally) {
      rows.push(
        usingFivePass
          ? this.checkRow("ok", "Prompt", "Five short prompts — the ones the local model was trained with. Correct.")
          : this.checkRow(
              "error",
              "Prompt",
              "The local model is reading, but the single-prompt setting is chosen. These do not fit together, and results will be poor until you change it.",
            ),
      );
    } else {
      rows.push(
        usingFivePass
          ? this.checkRow(
              "warn",
              "Prompt",
              "The five-prompt setting is chosen, but a large model is reading. These do not fit together, and results will be poor.",
            )
          : this.checkRow("ok", "Prompt", "One prompt — what a large model needs. Correct."),
      );
    }

    // Prose last: it is the check that explains the others when they all look fine and
    // the doll is still empty.
    const prose = await BH.prose.assess(chatId, BH.dock.state);
    if (prose) {
      rows.push(
        this.checkRow(
          "warn",
          "Prose",
          `${BH.escapeHtml(prose.copy)}${prose.aside ? ` <small style="opacity:.75">${BH.escapeHtml(prose.aside)}</small>` : ""}`,
        ),
      );
    } else {
      rows.push(this.checkRow("ok", "Prose", "These turns look like writing Beholder can read."));
    }

    const characters = snapshot?.state?.characters ?? [];
    rows.push(
      characters.length
        ? this.checkRow("ok", "State", `${characters.length} character${characters.length === 1 ? "" : "s"} tracked.`)
        : this.checkRow(
            "warn",
            "State",
            "Nothing found yet. If this chat already has messages, use the clock button at the top to read them.",
          ),
    );
    return rows.join("");
  },

  /**
   * The setup facts as a scannable grid, above the prose of the checks.
   *
   * Same rows as the copyable report, from the same function, because a grid that says
   * one thing while the pasted report says another is worse than not having the grid.
   */
  async vitalsHtml() {
    let rows;
    try {
      rows = await BH.report.vitals();
    } catch {
      return "";
    }
    if (!rows.length) return "";
    return `<div class="bh-vitals">${rows
      .map(
        (row) => `<div class="bh-vital">
          <span class="bh-dot bh-dot-${BH.escapeHtml(row.dot)}"></span>
          <span class="bh-vital-label">${BH.escapeHtml(row.label)}</span>
          <span class="bh-vital-value">${BH.escapeHtml(String(row.value))}</span>
        </div>`,
      )
      .join("")}</div>`;
  },

  /**
   * What Beholder has actually been doing, most recent first.
   *
   * "It is not working" is usually one of three things — it never ran, it ran and
   * failed, or it ran fine and found nothing — and those look identical from the panel.
   * Timings and slot counts separate them without anyone having to describe symptoms.
   *
   * Failures are shown, not filtered: a run that errored is the most useful row here.
   */
  async recentRunsHtml(chatId) {
    if (!chatId) return "";
    let runs;
    try {
      const res = await fetch(`/api/agents/beholder-runs/${encodeURIComponent(chatId)}?limit=5`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return "";
      runs = await res.json();
    } catch {
      return "";
    }
    const body = runs.length
      ? runs
          .map((run) => {
            const when = run.createdAt ? new Date(run.createdAt).toLocaleTimeString() : "—";
            const took = typeof run.durationMs === "number" ? `${(run.durationMs / 1000).toFixed(1)} s` : "—";
            // A failed run applies nothing, so "no change" would be a lie — say so.
            const found = !run.success
              ? `<span class="bh-vlog-error">failed${run.error ? ` — ${BH.escapeHtml(String(run.error).slice(0, 80))}` : ""}</span>`
              : run.slots
                ? `${run.slots} slot${run.slots === 1 ? "" : "s"} · ${run.characters} character${run.characters === 1 ? "" : "s"}`
                : "nothing found";
            return `<tr><td>${BH.escapeHtml(when)}</td><td>${took}</td><td>${found}</td></tr>`;
          })
          .join("")
      : `<tr><td colspan="3" class="bh-turns-empty">Nothing read yet in this chat.</td></tr>`;
    return `<div class="bh-editor-group-label">recent reads</div>
      <table class="bh-turns">
        <thead><tr><th>when</th><th>took</th><th>found</th></tr></thead>
        <tbody>${body}</tbody>
      </table>`;
  },

  /** The last extraction, end to end, so a bad turn can be looked at rather than guessed at. */
  async doctorView() {
    this.open("Doctor", `<p class="bh-view-lead">Checking this chat's setup…</p>`, async (body) => {
      // Captured together, before the requests. Reading the chat again afterwards let
      // a chat switch pair one chat's extraction with another chat's prompt in the same
      // report — which is exactly the thing the operator opens Doctor to rule out.
      const chatId = BH.dock.chatId;
      const chatProps = BH.dock.props ?? {};
      const lines = [];
      try {
        const res = await fetch(`/api/agents/beholder-state/${encodeURIComponent(chatId)}`, {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });
        const snapshot = res.ok ? await res.json() : null;
        const characters = snapshot?.state?.characters ?? [];
        const slots = characters.reduce((n, c) => n + Object.keys(c.body ?? {}).length, 0);
        const selected = (await this.liveTemplate(chatId, chatProps)).templateId;
        lines.push(await this.vitalsHtml());
        lines.push(`<div class="bh-vlog">${await this.healthChecks(chatId, chatProps, snapshot)}</div>`);
        lines.push(await this.recentRunsHtml(chatId));
        lines.push(
          `<dl class="bh-doctor-facts">
             <dt>Last extraction</dt><dd>${snapshot?.createdAt ? BH.escapeHtml(new Date(snapshot.createdAt).toLocaleString()) : "none yet"}</dd>
             <dt>From message</dt><dd><code>${BH.escapeHtml(snapshot?.messageId ?? "—")}</code></dd>
             <dt>Characters tracked</dt><dd>${characters.length}</dd>
             <dt>Slots filled</dt><dd>${slots}</dd>
             <dt>Prompt in use</dt><dd>${selected === BH_FIVE_PASS_ID ? "five passes (local model)" : "one prompt (SOTA model)"}</dd>
           </dl>`,
        );
        // The report comes before the raw state: it is the thing to hand over when
        // something is wrong, and burying it under a JSON dump is how it goes unused.
        lines.push(
          `<div class="bh-editor-group-label">report</div>
           <div class="bh-report-block">
             <p class="bh-view-note">If something looks wrong, copy this and send it to us. It contains the version,
             the model, the prompt and what the panel found, so we do not have to ask.</p>
             <label class="bh-check bh-report-prose">
               <input type="checkbox" class="bh-report-include-prose">
               <span>also include the last few turns of your story
                 <small>off by default. Your story is not included unless you tick this box.</small></span>
             </label>
             <div class="bh-model-actions">
               <button type="button" class="bh-btn bh-btn-primary bh-report-copy"><i class="fa-solid fa-copy"></i>
                 Copy report</button>
               <button type="button" class="bh-btn bh-report-show">Show it</button>
             </div>
             <pre class="bh-doctor-json bh-report-text" hidden></pre>
           </div>`,
        );
        lines.push(
          `<div class="bh-editor-group-label">state as stored</div>
           <pre class="bh-doctor-json">${BH.escapeHtml(JSON.stringify(snapshot?.state ?? {}, null, 2))}</pre>`,
        );
        // Last, and marked as destructive. When the state has gone badly wrong there is
        // otherwise no way back except editing every slot by hand, but this throws away
        // work, so it asks first and says exactly what it will take.
        lines.push(
          `<div class="bh-editor-group-label">start over</div>
           <p class="bh-view-note">Clearing removes everyone Beholder is tracking in this chat, along with your
           locks, hand-set values, and the order and merges you set for this chat. Your story is not touched.
           The next turn starts again from nothing.</p>
           <div class="bh-model-actions">
             <button type="button" class="bh-btn bh-btn-danger bh-clear-state"><i class="fa-solid fa-eraser"></i>
               Clear what Beholder tracks</button>
           </div>`,
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

      const block = body.querySelector(".bh-report-block");
      if (block) {
        const includeProse = () => !!block.querySelector(".bh-report-include-prose")?.checked;
        const textBox = block.querySelector(".bh-report-text");
        block.querySelector(".bh-report-copy")?.addEventListener("click", async (event) => {
          const button = event.currentTarget;
          button.disabled = true;
          try {
            const text = await BH.report.build({ includeProse: includeProse() });
            textBox.textContent = text;
            await BH.report.copy(text, button);
          } catch (error) {
            BH.toast(`Could not build the report: ${error.message}`);
          } finally {
            button.disabled = false;
          }
        });
        block.querySelector(".bh-report-show")?.addEventListener("click", async () => {
          textBox.textContent = await BH.report.build({ includeProse: includeProse() });
          textBox.hidden = !textBox.hidden;
        });
      }

      // Two presses, not a dialog: the button becomes the confirmation, so the choice
      // is made where the consequence is written rather than in a box that covers it.
      const clear = body.querySelector(".bh-clear-state");
      let armed = false;
      clear?.addEventListener("click", async () => {
        if (!armed) {
          armed = true;
          clear.classList.add("bh-btn-armed");
          clear.innerHTML = `<i class="fa-solid fa-eraser"></i> Press again to clear`;
          // Disarms itself, so a stray click cannot sit there waiting to be completed.
          window.setTimeout(() => {
            armed = false;
            clear.classList.remove("bh-btn-armed");
            clear.innerHTML = `<i class="fa-solid fa-eraser"></i> Clear what Beholder tracks`;
          }, 5000);
          return;
        }
        clear.disabled = true;
        try {
          const res = await fetch(`/api/agents/beholder-state/${encodeURIComponent(chatId)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ state: { characters: [] } }),
          });
          if (!res.ok) throw new Error(`${res.status}`);
          // The locks and edit marks describe slots that no longer exist; leaving them
          // would restore the cleared values on the next turn.
          BH.locks.clearAll(chatId);
          await BH.dock.refresh();
          BH.dock.render();
          BH.toast("Cleared — Beholder starts again from the next turn");
          this.close();
        } catch (error) {
          BH.toast(`Could not clear: ${error.message}`);
          clear.disabled = false;
        }
      });
    });
  },

  // ── Characters ────────────────────────────────────────────────────────────
  /**
   * Who the panel shows, and in what order.
   *
   * Presentation only, and it says so: hiding someone does not stop the extractor
   * tracking them, and merging two names does not teach it they are the same person.
   * A control that looks like it changes extraction and does not would be worse than
   * having none.
   */
  charactersView() {
    const render = (body) => {
      const names = Object.keys(BH.dock.state ?? {});
      const data = BH.roster.all();
      const { visible, hidden } = BH.roster.arrange(names);
      const persona = BH.dock.props?.personaInfo?.name ?? null;

      const row = (name) => {
        const you = name === persona;
        const chips = BH.roster
          .variantsOf(name, data)
          .map(
            (variant) =>
              `<span class="bh-ch-alias" data-variant="${BH.escapeHtml(variant)}">${BH.escapeHtml(variant)}<i class="fa-solid fa-xmark" title="Unmerge"></i></span>`,
          )
          .join("");
        return `<li class="bh-ch${you ? " bh-ch-you" : ""}" draggable="true" data-name="${BH.escapeHtml(name)}">
          <i class="bh-ch-grip fa-solid fa-grip-vertical" title="Drag to reorder"></i>
          <span class="bh-ch-main">
            <span class="bh-ch-name">${you ? '<i class="fa-solid fa-star bh-ch-star" title="You"></i> ' : ""}${BH.escapeHtml(name)}</span>
            ${chips ? `<span class="bh-ch-aliases">${chips}</span>` : ""}
          </span>
          <span class="bh-ch-tools">
            <i class="bh-ch-merge fa-solid fa-link" title="Same person as another name"></i>
            <i class="bh-ch-hide fa-solid fa-eye" title="Hide from the panel"></i>
          </span>
        </li>`;
      };

      body.innerHTML = `
        <p class="bh-view-lead">Who this panel shows. This is display only — hiding someone does not stop
        Beholder tracking them, and merging two names does not tell it they are the same person.</p>
        <ul class="bh-ch-list">${visible.map(row).join("") || '<li class="bh-ch-empty">No one tracked yet.</li>'}</ul>
        ${
          hidden.length
            ? `<div class="bh-ch-tray"><span class="bh-ch-tray-cap">Hidden</span><ul class="bh-ch-list">${hidden
                .map(
                  (name) =>
                    `<li class="bh-ch bh-ch-hidden" data-name="${BH.escapeHtml(name)}">
                      <span class="bh-ch-main"><span class="bh-ch-name">${BH.escapeHtml(name)}</span></span>
                      <span class="bh-ch-tools"><i class="bh-ch-unhide fa-solid fa-eye-slash" title="Show"></i></span>
                    </li>`,
                )
                .join("")}</ul></div>`
            : ""
        }`;

      const again = () => {
        render(body);
        BH.dock.render();
      };

      for (const control of body.querySelectorAll(".bh-ch-hide")) {
        control.addEventListener("click", (event) => {
          event.stopPropagation();
          BH.roster.setHidden(control.closest(".bh-ch").dataset.name, true);
          again();
        });
      }
      for (const control of body.querySelectorAll(".bh-ch-unhide")) {
        control.addEventListener("click", (event) => {
          event.stopPropagation();
          BH.roster.setHidden(control.closest(".bh-ch").dataset.name, false);
          again();
        });
      }
      for (const chip of body.querySelectorAll(".bh-ch-alias .fa-xmark")) {
        chip.addEventListener("click", (event) => {
          event.stopPropagation();
          BH.roster.removeAlias(chip.closest(".bh-ch-alias").dataset.variant);
          again();
        });
      }
      for (const control of body.querySelectorAll(".bh-ch-merge")) {
        control.addEventListener("click", (event) => {
          event.stopPropagation();
          const rowElement = control.closest(".bh-ch");
          const existing = rowElement.querySelector(".bh-ch-pick");
          if (existing) {
            existing.remove();
            return;
          }
          const name = rowElement.dataset.name;
          const pick = document.createElement("div");
          pick.className = "bh-ch-pick";
          pick.innerHTML =
            `<span class="bh-ch-pick-lead">is</span>` +
            visible
              .filter((other) => other !== name)
              .map(
                (other) =>
                  `<button class="bh-ch-pill" type="button" data-target="${BH.escapeHtml(other)}">${BH.escapeHtml(other)}</button>`,
              )
              .join("") +
            // The pills only offer names currently on screen, and the name you want is
            // often not one of them: the extractor wrote "the guard" once and has since
            // settled on "Rhys", so the row to merge away has no partner to point at.
            `<input class="bh-ch-pick-input" type="text" placeholder="or type a name…"
               data-bh-escape="self"
               aria-label="Merge ${BH.escapeHtml(name)} into a name you type">`;
          rowElement.appendChild(pick);
          const mergeInto = (target) => {
            const clean = String(target ?? "").trim();
            if (!clean || clean.toLowerCase() === name.toLowerCase()) return;
            // This row's name becomes a variant of the one picked, so the panel stops
            // showing the same person twice.
            BH.roster.addAlias(name, clean);
            // Merging into a name nobody is being tracked under yet is allowed — it is
            // how you fix a name before the story settles on it — but there is no row to
            // fold into, so the panel does not visibly change. Without this the action
            // looks like it failed.
            if (!visible.some((other) => other.toLowerCase() === clean.toLowerCase())) {
              BH.toast(`Noted — ${name} will be shown as ${clean} once ${clean} appears`);
            }
            again();
          };
          for (const pill of pick.querySelectorAll(".bh-ch-pill")) {
            pill.addEventListener("click", () => mergeInto(pill.dataset.target));
          }
          const typed = pick.querySelector(".bh-ch-pick-input");
          // The field carries data-bh-escape="self", so the view leaves Escape alone
          // here and an ordinary listener is enough.
          typed.addEventListener("keydown", (keyEvent) => {
            if (keyEvent.key !== "Enter" && keyEvent.key !== "Escape") return;
            keyEvent.preventDefault();
            if (keyEvent.key === "Enter") mergeInto(typed.value);
            else pick.remove();
          });
          typed.focus();
        });
      }

      // Drag to reorder, persisted as the roster order.
      const list = body.querySelector(".bh-ch-list");
      let dragging = null;
      for (const item of body.querySelectorAll(".bh-ch[draggable]")) {
        item.addEventListener("dragstart", () => {
          dragging = item;
          item.classList.add("bh-ch-dragging");
        });
        item.addEventListener("dragend", () => {
          item.classList.remove("bh-ch-dragging");
          dragging = null;
          BH.roster.setOrder([...list.querySelectorAll(".bh-ch[draggable]")].map((row) => row.dataset.name));
          BH.dock.render();
        });
        item.addEventListener("dragover", (event) => {
          event.preventDefault();
          if (!dragging || dragging === item) return;
          const box = item.getBoundingClientRect();
          const after = event.clientY > box.top + box.height / 2;
          item.parentNode.insertBefore(dragging, after ? item.nextSibling : item);
        });
      }
    };

    this.open("Characters", `<p class="bh-view-lead">Reading the roster…</p>`, (body) => render(body));
  },

  // ── Inspector ─────────────────────────────────────────────────────────────
  /**
   * The most recent round trip, captured on demand.
   *
   * The engine does not keep the prompt and the reply after a run, so seeing them means
   * running the turn again with debug output on. That is a real model call, so it is a
   * button the operator presses rather than something that happens on open.
   */
  async inspectorView() {
    this.open(
      "Inspector",
      `<p class="bh-view-lead">The full round trip for a turn — the prompt each pass was given, the prose it
       read, and what it answered. Nothing is kept after a run, so this re-runs the turn with capture on.</p>
       <p class="bh-view-note">That is one model call per pass, against whichever model is answering.</p>
       <div class="bh-model-actions">
         <button type="button" class="bh-btn bh-btn-primary bh-inspect-run"><i class="fa-solid fa-play"></i>
           Capture this turn</button>
       </div>
       <div class="bh-inspect-out"></div>`,
      (body) => {
        const button = body.querySelector(".bh-inspect-run");
        const out = body.querySelector(".bh-inspect-out");
        button.addEventListener("click", async () => {
          const chatId = BH.dock.chatId;
          if (!chatId) {
            BH.toast("No chat open");
            return;
          }
          button.disabled = true;
          const original = button.innerHTML;
          button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Capturing…`;
          out.innerHTML = "";
          try {
            const { passes, warning } = await BH.inspector.capture(chatId, null);
            if (!passes.length) {
              out.innerHTML = `<p class="bh-view-warn">The run produced no debug output. If Beholder is not
                active in this chat there is nothing to capture.</p>`;
              return;
            }
            out.innerHTML =
              (warning ? `<p class="bh-view-note">${BH.escapeHtml(warning)}</p>` : "") +
              passes.map((pass, index) => BH.inspector.passHtml(pass, index)).join("");
          } catch (error) {
            out.innerHTML = `<p class="bh-view-warn">Could not capture: ${BH.escapeHtml(error.message)}</p>`;
          } finally {
            button.disabled = false;
            button.innerHTML = original;
          }
        });
      },
    );
  },

  // ── Help ──────────────────────────────────────────────────────────────────
  helpView() {
    this.open(
      "Help",
      `
      <p class="bh-view-lead">Beholder reads each turn of your story and remembers what it says about each
      character's body: what they are wearing on each part, what they are holding, their injuries, which parts
      are uncovered or lost, and their species.</p>

      <div class="bh-editor-group-label">reading the panel</div>
      <p class="bh-view-note">The colours on each body part mean this:</p>
      <div class="bh-legend-row"><span class="bh-legend-bar bh-tier-0"></span>in good condition</div>
      <div class="bh-legend-row"><span class="bh-legend-bar bh-tier-2"></span>damaged</div>
      <div class="bh-legend-row"><span class="bh-legend-bar bh-tier-4"></span>broken</div>
      <div class="bh-legend-row"><span class="bh-legend-bar bh-tier-holding"></span>something held in the hand</div>
      <div class="bh-legend-row"><span class="bh-legend-dot"></span>an injury to the body itself</div>
      <p class="bh-view-note">A ring <b>around</b> a body part is the state of what is worn on it. Colour
      <b>inside</b> the body part is the body itself. Click any part to change it, or to lock it so the story
      cannot change it back.</p>

      <div class="bh-editor-group-label">what it reads well</div>
      <p class="bh-view-note"><b>Scenes with several characters are fine.</b> This is what Beholder is made
      for. In testing it put the right item on the right person about <b>95% of the time</b>.</p>
      <p class="bh-view-note">It needs writing that <b>follows one person at a time</b>, so the reader can tell
      whose view the scene is told from. Both of these work:</p>
      <ul class="bh-help-list">
        <li>"I pulled off my coat."</li>
        <li>"She pulled off her coat."</li>
      </ul>
      <p class="bh-view-note">It was tested on five kinds of roleplay writing and works with all of them: chat
      roleplay, story fanfic, web serials, interactive fiction, and forum play-by-post.</p>

      <div class="bh-editor-group-label">what it does not read well</div>
      <ul class="bh-help-list">
        <li>Writing that moves between many people's thoughts in one paragraph, with no single person to
          follow.</li>
        <li>Film or play scripts — for example <code>INT. ROOM - NIGHT</code>, or names in capitals above
          their lines.</li>
      </ul>
      <p class="bh-view-note">This is not a bug. The model is very small on purpose, so it can run for free on
      your own computer and your story never leaves it.</p>
      <p class="bh-view-note">If that is how you write, a large model reads this kind of writing better. You
      can connect this agent to one in the Prompt view. We do not support that, and your story would then be
      sent to that model instead of staying on your computer.</p>
      <p class="bh-view-note">Doctor tells you when it sees writing it may not read well, so you do not have to
      guess from an empty panel.</p>

      <div class="bh-editor-group-label">how to read the picture</div>
      <ul class="bh-help-list">
        <li>A coloured <b>outline</b> on a body part — the worst damage of anything worn there.</li>
        <li>A <b>filled</b> body part — an injury to the body itself. The worse it is, the stronger the colour.</li>
        <li><b>✦</b> next to a hand — the character is holding something.</li>
        <li>A crossed-out part marked <b>MISSING</b> — the character has lost it. Everything below it counts as
        lost too.</li>
        <li><b>BARE</b> — the story said this part is uncovered. That is not the same as simply not knowing
        yet.</li>
      </ul>

      <div class="bh-editor-group-label">the three switches</div>
      <p>The Color, Damage and Wounds switches only change what you see. Turning one off hides that detail.
      Nothing is forgotten.</p>

      <div class="bh-editor-group-label">changing something</div>
      <ul class="bh-help-list">
        <li>Click any body part to correct it. <b>Apply</b> saves your change, so the next turn uses what you
        wrote instead of what the model guessed.</li>
        <li><b>Lock</b> a part when you have set it yourself and want Beholder to leave it alone.</li>
        <li>Ticking <b>bare</b> removes what is worn there. Ticking <b>missing</b> replaces everything for that
        part.</li>
      </ul>

      <div class="bh-editor-group-label">telling it something directly</div>
      <p class="bh-view-note">The box at the bottom of this panel sends a fact straight to Beholder, without
      writing it into the story. Say what <b>happened</b>, and name the person:</p>
      <ul class="bh-help-list">
        <li>"Maggie takes off her boots."</li>
        <li>"Maggie is now wearing black gloves."</li>
        <li>"Maggie has a deep cut on her left arm."</li>
      </ul>
      <p class="bh-view-note">For damage, say it as a thing the item has, not as a word in front of it.
      "Maggie wears a belt with a tear in it" works; "Maggie is wearing a torn belt" is read as the belt coming
      off. Slots you change this way are locked, so the next turn does not undo them.</p>

      <div class="bh-editor-group-label">writing so it reads well</div>
      <ul class="bh-tips">
        <li>Name the clothing and the person. "She pulls off <i>her</i> gloves" works. "They undress" does
        not.</li>
        <li>Put taking something off in its own sentence. When one sentence removes and adds clothing at the
        same time, Beholder often catches only half of it.</li>
        <li>Clothing that belongs to nobody is ignored on purpose, such as a cloak hanging on a hook.</li>
      </ul>

      <div class="bh-orn" aria-hidden="true"><span></span>◉<span></span></div>
      <p class="bh-help-sign">Out of sight, out of prompt. <span>Beholder doesn't blink.</span></p>`,
    );
  },
};
