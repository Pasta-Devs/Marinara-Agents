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
  /**
   * The setup facts, structured, with a severity for each.
   *
   * Doctor shows these as a grid and the report prints them as text. They are computed
   * here once because two renderings of "is this set up correctly" that disagree is
   * worse than either alone — the operator would paste one and be looking at the other.
   *
   * The reference extension's vitals also cover WebGPU, browser RAM and the in-browser
   * model. None of that is ported: this package does not run the model in the browser,
   * so those rows would be answering a question nobody here can ask.
   */
  async vitals() {
    const rows = [];
    const chatId = BH.dock.chatId ?? null;

    const agentOn = await BH.views.agentActive(chatId);
    rows.push({
      dot: agentOn === true ? "ok" : agentOn === false ? "bad" : "warn",
      label: "Agent",
      value: agentOn === null ? "could not read" : agentOn ? "on for this chat" : "OFF — nothing will be read",
    });

    let status = null;
    let routing = null;
    try {
      [status, routing] = await Promise.all([BH.sidecar.status(), BH.sidecar.routing()]);
    } catch {
      // Reported as unknown below rather than failing the whole panel.
    }
    const servedLocally = routing?.source === "utility-sidecar";
    rows.push({
      dot: "ok",
      label: "Reading with",
      value: servedLocally ? "local Beholder model" : "this agent's own connection",
    });

    if (status) {
      const installed = status.models?.[BH.sidecar.MODEL_ID] ?? null;
      rows.push({
        dot: installed ? "ok" : "warn",
        label: "Local model",
        value: installed ? BH.sidecar.versionLabel(installed) : "not installed",
      });
      if (!status.runtimeInstalled) rows.push({ dot: "bad", label: "Local runtime", value: "MISSING" });
      if (status.error) rows.push({ dot: "bad", label: "Local error", value: status.error });
      if (status.settings) {
        rows.push({
          dot: "ok",
          label: "Hardware",
          value: `ctx ${status.settings.contextSize} · gpuLayers ${status.settings.gpuLayers} · slots ${status.settings.maxParallelJobs}`,
        });
      }
    } else {
      rows.push({ dot: "warn", label: "Local model", value: "engine has no local model slot" });
    }
    if (!servedLocally && routing?.reason) rows.push({ dot: "warn", label: "Why not local", value: routing.reason });

    const live = await BH.views.liveTemplate(chatId, BH.dock.props ?? {});
    const fivePass = live.templateId === BH_FIVE_PASS_ID;
    rows.push({
      dot: "ok",
      label: "Prompt",
      value: fivePass ? "five short prompts (local model)" : "one prompt (large model)",
    });
    rows.push({
      dot: live.confirmed ? "ok" : "warn",
      label: "Prompt source",
      value: live.confirmed ? "read from the chat" : "could not confirm — using a cached copy",
    });
    // The pairing is the single most common silent misconfiguration: each half looks
    // fine on its own, and only the combination is wrong.
    if (servedLocally !== fivePass) {
      rows.push({
        dot: "bad",
        label: "Pairing",
        value: servedLocally
          ? "WRONG PAIR — local model with the single-prompt setting"
          : "WRONG PAIR — large model with the five-prompt setting",
      });
    }
    return rows;
  },

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
    // The same rows Doctor shows as a grid, so what gets pasted and what was on screen
    // are the same facts rather than two implementations of them.
    const chatId = BH.dock.chatId ?? null;
    lines.push("", "SETUP");
    add("chat", chatId ? `${chatId.slice(0, 8)}…` : "none open");
    for (const row of await this.vitals()) {
      add(row.label.toLowerCase(), row.value);
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
