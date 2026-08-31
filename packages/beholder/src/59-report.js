// ── The diagnostic report ───────────────────────────────────────────────────
//
// When someone says "it isn't working", the useful reply is not a list of questions.
// It is one block of text they can paste, carrying everything that would otherwise
// take six exchanges to establish: which build, which model, which prompt, whether the
// agent is even on, what the panel is holding, and what the prose looks like.
//
// Two rules shape it. It is plain text, because it gets pasted into chat clients and
// issue trackers that mangle anything else. And it never includes the roleplay itself
// unless the person explicitly asks it to — the prose is theirs, and a support report
// is not a reason to hand it over. What goes in by default are shapes and counts.

BH.report = {
  /** Everything worth knowing, as plain text. */
  async build({ includeProse = false } = {}) {
    const lines = [];
    // Wide enough for the longest label, so the values line up when pasted into a
    // monospace box — which is where this always ends up.
    const add = (label, value) => lines.push(`${label.padEnd(24)} ${value}`);

    lines.push("BEHOLDER DIAGNOSTIC REPORT");
    lines.push("=".repeat(52));
    add("package", BH.dock.props?.packageVersion ?? BH_PACKAGE_VERSION ?? "unknown");
    add("generated", new Date().toISOString());

    // ── setup ────────────────────────────────────────────────────────────────
    const chatId = BH.dock.chatId ?? null;
    lines.push("", "SETUP");
    add("chat", chatId ? `${chatId.slice(0, 8)}…` : "none open");
    const agentOn = await BH.views.agentActive(chatId);
    add("agent active", agentOn === null ? "could not read" : agentOn ? "yes" : "NO — nothing will be extracted");

    let status = null;
    let routing = null;
    try {
      [status, routing] = await Promise.all([BH.sidecar.status(), BH.sidecar.routing()]);
    } catch {
      // Reported as unknown below rather than failing the whole report.
    }
    const servedLocally = routing?.source === "utility-sidecar";
    add("answering", servedLocally ? "local Beholder model" : "this agent's connection");
    if (status) {
      const installed = status.models?.[BH.sidecar.MODEL_ID] ?? null;
      add("local model", installed ? BH.sidecar.versionLabel(installed) : "not installed");
      add("local runtime", status.runtimeInstalled ? "installed" : "MISSING");
      if (status.error) add("local error", status.error);
      if (status.settings) {
        add(
          "hardware",
          `ctx ${status.settings.contextSize} · gpuLayers ${status.settings.gpuLayers} · slots ${status.settings.maxParallelJobs}`,
        );
      }
    } else {
      add("local model", "engine has no local model slot");
    }
    if (!servedLocally && routing?.reason) add("why not local", routing.reason);

    const live = await BH.views.liveTemplate(chatId, BH.dock.props ?? {});
    const fivePass = live.templateId === BH_FIVE_PASS_ID;
    add("prompt", fivePass ? "five per-lane passes" : "one prompt (SOTA)");
    add("prompt source", live.confirmed ? "read from the chat" : "snapshot — could not confirm");
    // The pairing is the single most common silent misconfiguration.
    if (servedLocally !== fivePass) {
      add(
        "PAIRING",
        servedLocally
          ? "MISMATCH — local model with the SOTA prompt"
          : "MISMATCH — general model with the five-pass prompt",
      );
    }

    // ── what the panel holds ─────────────────────────────────────────────────
    lines.push("", "STATE");
    const state = BH.dock.state ?? {};
    const names = Object.keys(state);
    add("characters", names.length ? `${names.length} (${names.join(", ")})` : "none");
    let slots = 0;
    let worn = 0;
    let wounds = 0;
    let held = 0;
    for (const character of Object.values(state)) {
      for (const slot of Object.values(character?.body ?? {})) {
        if (!slot || typeof slot !== "object") continue;
        slots += 1;
        worn += (slot.worn ?? []).length;
        wounds += (slot.wounds ?? []).length;
        if (slot.holding) held += 1;
      }
    }
    add("slots filled", String(slots));
    add("worn/wounds/held", `${worn} / ${wounds} / ${held}`);
    const locks = Object.keys(BH.locks.all()).length;
    add("locked slots", String(locks));

    // ── the prose ────────────────────────────────────────────────────────────
    lines.push("", "PROSE");
    const sample = await BH.prose.sample(chatId);
    add("turns examined", String(sample.length));
    add("describes clothing", `${sample.filter((t) => BH.prose.describesState(t)).length} of ${sample.length}`);
    add("script-shaped", `${sample.filter((t) => BH.prose.isScript(t)).length} of ${sample.length}`);
    const words = sample.map((t) => t.trim().split(/\s+/).length);
    add(
      "turn length (words)",
      words.length
        ? `min ${Math.min(...words)} · median ${words.sort((a, b) => a - b)[Math.floor(words.length / 2)]} · max ${Math.max(...words)}`
        : "—",
    );
    const verdict = await BH.prose.assess(chatId, state);
    add("verdict", verdict ? verdict.verdict : "nothing flagged");
    if (verdict) lines.push("", `  ${verdict.copy}`);

    if (includeProse) {
      lines.push("", "RECENT TURNS (included at your request)");
      sample.slice(-3).forEach((text, index) => {
        lines.push("", `--- turn ${index + 1} ---`, text.slice(0, 1200));
      });
    } else {
      lines.push("", "(roleplay text not included — tick the box to add the last few turns)");
    }

    lines.push("", "=".repeat(52));
    return lines.join("\n");
  },

  /** Put it on the clipboard, falling back to a selectable box. */
  async copy(text, button) {
    try {
      await navigator.clipboard.writeText(text);
      BH.toast("Report copied");
      return true;
    } catch {
      // A blocked clipboard is common in embedded contexts; select it instead so the
      // person can still copy by hand rather than being told it failed.
      const box = button?.closest(".bh-report-block")?.querySelector(".bh-report-text");
      if (box) {
        box.hidden = false;
        const range = document.createRange();
        range.selectNodeContents(box);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        BH.toast("Could not reach the clipboard — the report is selected, copy it");
      }
      return false;
    }
  },
};
