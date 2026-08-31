// ── Inspector: the round trip, exactly as it happened ───────────────────────
//
// When an extraction reads a turn wrong, "it got it wrong" is not actionable. What is
// actionable is the prompt the model was given, the prose it read, and the characters
// it sent back — which is what the reference extension's Inspector shows.
//
// The reference can show the last turn from memory because extraction runs in the
// browser. Here it runs server-side and nothing is kept client-side afterwards, so the
// round trip has to be captured while it happens: the engine's own agent-run stream
// emits the request and the response when asked for debug output. So Inspector re-runs
// the turn with capture on and shows what came back.
//
// That re-run is a real model call, which is why it is a button and not something the
// view does on open.

BH.inspector = {
  /** Run the agent for this chat with debug on, and pull the round trip out of the stream. */
  async capture(chatId, messageId) {
    const res = await fetch("/api/generate/retry-agents", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId,
        agentTypes: ["beholder"],
        debugMode: true,
        ...(messageId ? { forMessageId: messageId } : {}),
      }),
    });
    if (!res.ok) throw new Error(`run ${res.status}`);
    const body = await res.text();

    const passes = [];
    let warning = null;
    let current = null;
    for (const line of body.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      let event;
      try {
        event = JSON.parse(line.slice(6));
      } catch {
        continue;
      }
      const data = event?.data ?? {};
      if (event.type === "agent_warning" && !warning) warning = data.message ?? null;
      if (event.type !== "agent_debug" || data.agentType !== "beholder") continue;
      if (data.stage === "request") {
        // Each lane is its own request/response pair; the five arrive in order.
        current = {
          model: data.model ?? "",
          temperature: data.temperature,
          maxTokens: data.maxTokens,
          system: (data.messages ?? []).find((m) => m.role === "system")?.content ?? "",
          user: (data.messages ?? []).find((m) => m.role === "user")?.content ?? "",
          raw: "",
          durationMs: null,
          finishReason: null,
        };
        passes.push(current);
      } else if (data.stage === "response") {
        // Responses can arrive out of order against requests when lanes overlap, so
        // fill the first pass still waiting rather than assuming the last one.
        // Tracked explicitly rather than inferred from `raw`: a lane that legitimately
        // answered with nothing left `raw` empty, so the next response overwrote it and
        // the lane that response belonged to was left blank instead.
        const target = passes.find((pass) => !pass.filled) ?? current;
        if (target) {
          target.filled = true;
          target.raw = data.response ?? data.responsePreview ?? "";
          target.durationMs = data.durationMs ?? null;
          target.finishReason = data.finishReason ?? null;
        }
      }
    }
    return { passes, warning };
  },

  /** A short name for a lane, read from its own system prompt. */
  laneName(pass) {
    const system = pass.system || "";
    if (/ONLY worn/i.test(system)) return "worn";
    if (/ONLY wounds/i.test(system)) return "wounds";
    if (/ONLY items HELD/i.test(system)) return "holding";
    if (/ONLY species/i.test(system)) return "species";
    if (/ONLY bare and missing/i.test(system)) return "flags";
    return "extraction";
  },

  passHtml(pass, index) {
    const seconds = pass.durationMs != null ? `${(pass.durationMs / 1000).toFixed(1)} s` : "—";
    const changed = /"changed"\s*:\s*true/.test(pass.raw || "");
    return `
      <details class="bh-vsection" ${index === 0 ? "open" : ""}>
        <summary><i class="fa-solid fa-robot"></i> ${BH.escapeHtml(this.laneName(pass))}
          <span class="bh-pane-meta">${changed ? "changed" : "no change"} · ${BH.escapeHtml(seconds)}</span></summary>
        <div class="bh-vsection-body">
          <details class="bh-vsection">
            <summary><i class="fa-solid fa-scroll"></i> System prompt
              <span class="bh-pane-meta">${(pass.system || "").length.toLocaleString()} chars</span></summary>
            <div class="bh-vsection-body"><pre class="bh-code">${BH.escapeHtml(pass.system || "")}</pre></div>
          </details>
          <details class="bh-vsection" open>
            <summary><i class="fa-solid fa-feather-pointed"></i> What the model read
              <span class="bh-pane-meta">prose + previous state</span></summary>
            <div class="bh-vsection-body"><pre class="bh-code">${BH.escapeHtml(pass.user || "")}</pre></div>
          </details>
          <details class="bh-vsection" open>
            <summary><i class="fa-solid fa-reply"></i> What it answered
              <span class="bh-pane-meta">${BH.escapeHtml(pass.finishReason || "")}</span></summary>
            <div class="bh-vsection-body"><pre class="bh-code">${BH.escapeHtml(pass.raw || "(nothing)")}</pre></div>
          </details>
        </div>
      </details>`;
  },
};
