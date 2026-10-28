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
    let info;
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

  /**
   * A newer build of the local model exists — offered once, dismissible.
   *
   * Only shown when the engine can actually tell. The update check compares the
   * installed file's object id against the published one and reports `indeterminate`
   * when it could not reach the repository; a banner that says "new model" because a
   * request failed would train people to ignore it.
   *
   * Dismissal is remembered per published version, not per session, so declining one
   * update does not silence the next one and accepting a nag every launch is not the
   * price of staying on an older build.
   */
  async refreshUpdate() {
    if (!BH.dock.panel) return;
    // Started without being awaited on every dock refresh, so two can be in flight at
    // once. Without this the older answer could land last and re-insert a strip the
    // newer one had just removed.
    const ticket = (this.updateTicket = (this.updateTicket ?? 0) + 1);
    let info;
    try {
      info = await BH.sidecar.updateCheck();
    } catch {
      return;
    }
    if (ticket !== this.updateTicket) return;
    // Re-read the panel AFTER the round trip rather than holding a reference across it.
    // If the dock replaces its panel while the check is in flight, a held reference
    // points at a detached element and the strip is inserted somewhere nobody can see,
    // with no error to show for it.
    const panel = BH.dock.panel;
    if (!panel || !panel.isConnected) return;
    const existing = panel.querySelector(".bh-update-banner");
    if (!info || info.indeterminate || !info.updateAvailable) {
      existing?.remove();
      return;
    }
    const target = String(info.availableOid ?? "");
    let dismissed = null;
    try {
      dismissed = localStorage.getItem("marinara.beholder.updateDismissed");
    } catch {
      // A blocked storage just means the banner is offered again; not worth failing.
    }
    if (dismissed === target) {
      existing?.remove();
      return;
    }
    if (existing) return;

    const short = (oid) => (oid ? String(oid).slice(0, 12) : "?");
    const strip = document.createElement("div");
    strip.className = "bh-update-banner";
    strip.setAttribute("role", "status");
    strip.setAttribute("aria-live", "polite");
    strip.innerHTML = `
      <span class="bh-update-banner-copy"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
        A newer Beholder model is available — <b>${BH.escapeHtml(short(info.installedOid))}</b> →
        <b>${BH.escapeHtml(short(info.availableOid))}</b>.</span>
      <span class="bh-update-banner-actions">
        <button type="button" class="bh-btn bh-btn-primary bh-update-now"><i class="fa-solid fa-download"></i>
          Update</button>
        <!-- Written out in full rather than built from the repository the engine reports.
             An interpolated host is a link the server can point anywhere, and this
             package is meant to reach exactly one place. -->
        <a class="bh-btn bh-update-gguf" href="https://huggingface.co/GetBeholder/Beholder-GGUF"
          target="_blank" rel="noopener noreferrer" title="Download the file yourself">
          <i class="fa-solid fa-arrow-up-right-from-square"></i> File</a>
        <button type="button" class="bh-btn bh-update-later" title="Not now" aria-label="Not now">
          <i class="fa-solid fa-xmark"></i></button>
      </span>`;
    const after = panel.querySelector(".beholder-backfill-status") ?? panel.querySelector(".bh-no-model-banner");
    if (after) after.after(strip);
    else panel.querySelector(".beholder-panel-header")?.after(strip);

    strip.querySelector(".bh-update-later").addEventListener("click", () => {
      try {
        localStorage.setItem("marinara.beholder.updateDismissed", target);
      } catch {
        // Dismissal that cannot be remembered still closes the strip for now.
      }
      strip.remove();
    });
    strip.querySelector(".bh-update-now").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      button.innerHTML = `<i class="fa-solid fa-spinner bh-banner-spin"></i> Downloading…`;
      try {
        await BH.sidecar.install();
        strip.remove();
        // install() downloads the file; it does not decide which connection answers.
        // Routing is read back before saying anything about what is in use, because
        // "the new model is in use" was being claimed without checking.
        await this.refresh();
        let serving = false;
        try {
          serving = (await BH.sidecar.routing())?.source === "utility-sidecar";
        } catch {
          // Left as false: report the part that is certain rather than guess.
        }
        BH.toast(serving ? "Updated — the new model is answering" : "Updated — the new model is downloaded");
      } catch (error) {
        BH.toast(`Update failed: ${error.message}`);
        button.disabled = false;
        button.innerHTML = `<i class="fa-solid fa-download"></i> Update`;
      }
    });
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
