// ── Which model is answering ────────────────────────────────────────────────
//
// The engine's local model slot silently outranks the agent's configured connection,
// and until now the only place that said so was inside the Prompt view. So an operator
// with a local model installed could not tell it was in use, and one without it had no
// idea the option existed — the feature was invisible to the person it was built for.
//
// This is the strip the reference extension uses for the same job: a line in the panel,
// under the build-progress bar, that always names what will answer and offers the one
// action that makes sense from where you are.

BH.banner = {
  ensure() {
    const panel = BH.dock.panel;
    if (!panel) return null;
    let strip = panel.querySelector(".bh-no-model-banner");
    if (strip) return strip;
    strip = document.createElement("div");
    strip.className = "bh-no-model-banner";
    strip.hidden = true;
    strip.setAttribute("role", "status");
    strip.setAttribute("aria-live", "polite");
    // Directly under the build-progress strip, sharing its header-adjacent placement.
    const after = panel.querySelector(".beholder-backfill-status");
    if (after) after.after(strip);
    else panel.querySelector(".beholder-panel-header")?.after(strip);
    return strip;
  },

  /** Work out what to say from the slot's status and this agent's routing. */
  async describe() {
    const [status, routing] = await Promise.all([BH.sidecar.status(), BH.sidecar.routing()]);
    // An engine without the local model slot: nothing to offer, so say nothing.
    if (!status) return null;
    const installed = status.models?.[BH.sidecar.MODEL_ID] ?? null;

    if (routing?.source === "utility-sidecar") {
      return {
        variant: "bh-banner-calm",
        copy: `Answering: local Beholder model · version ${BH.sidecar.versionLabel(installed)}`,
        actions: [{ id: "manage", label: "Manage" }],
      };
    }
    if (installed) {
      return {
        variant: "bh-banner-calm",
        copy: "The local Beholder model is installed but not in use — this agent's connection is answering.",
        actions: [
          { id: "enable", label: "Use local model" },
          { id: "manage", label: "Manage" },
        ],
      };
    }
    if (!status.runtimeInstalled) {
      // Offering a download that cannot start is worse than not offering it.
      return {
        variant: "bh-banner-calm",
        copy: "Beholder is answering through this agent's connection. A local model needs the engine's local runtime first.",
        actions: [{ id: "manage", label: "Details" }],
      };
    }
    return {
      variant: "bh-banner-warn",
      copy: "Beholder is answering through this agent's connection. A small model trained for this job can run locally instead.",
      actions: [
        { id: "install", label: "Get the local model" },
        { id: "manage", label: "Details" },
      ],
    };
  },

  async refresh() {
    const strip = this.ensure();
    if (!strip) return;
    let info = null;
    try {
      info = await this.describe();
    } catch {
      // Never let a status probe take the panel down; the strip just stays hidden.
      info = null;
    }
    if (!info) {
      strip.hidden = true;
      strip.innerHTML = "";
      return;
    }
    strip.classList.remove("bh-banner-warn", "bh-banner-calm", "bh-banner-loading");
    strip.classList.add(info.variant);
    strip.hidden = false;
    strip.innerHTML = `
      <span class="bh-banner-copy">${BH.escapeHtml(info.copy)}</span>
      <span class="bh-banner-actions">${info.actions
        .map(
          (action) =>
            `<button type="button" class="bh-btn bh-banner-btn ${action.id === "install" || action.id === "enable" ? "bh-btn-primary" : ""}" data-action="${BH.escapeHtml(action.id)}">${BH.escapeHtml(action.label)}</button>`,
        )
        .join("")}</span>`;
    for (const button of strip.querySelectorAll(".bh-banner-btn")) {
      button.addEventListener("click", () => void this.act(button.dataset.action, button));
    }
  },

  async act(action, button) {
    // "Details" and "Manage" both land in the Prompt view, which is where the model
    // and the prompt are chosen together — they are one decision.
    if (action === "manage") {
      void BH.views.promptView();
      return;
    }
    const original = button.textContent;
    button.disabled = true;
    try {
      if (action === "install") {
        button.textContent = "Downloading…";
        await BH.sidecar.install();
        await BH.sidecar.setActive(true);
        BH.toast("Local Beholder model installed and serving");
      } else if (action === "enable") {
        await BH.sidecar.setActive(true);
        BH.toast("Local Beholder model is now serving Beholder");
      }
    } catch (error) {
      BH.toast(`Could not complete: ${error.message}`);
    } finally {
      button.disabled = false;
      button.textContent = original;
      await this.refresh();
    }
  },
};
