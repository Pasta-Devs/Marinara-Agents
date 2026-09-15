// ── The local model slot ────────────────────────────────────────────────────
//
// Beholder can be answered by a purpose-trained model held in the engine's utility
// model slot, which is separate from the engine's own sidecar and never displaces it.
// When that slot is serving, it takes precedence over the agent's configured
// connection — so the operator needs to be told which one is actually answering,
// because the two need different prompts and the failure mode of getting it wrong
// looks like a bad model rather than a bad setting.
//
// Every call here degrades quietly: an engine without the utility slot returns 404,
// and the extension carries on as a normal agent-connection setup.

BH.sidecar = {
  /** The model this package installs, and the id the engine binds to this agent. */
  MODEL_ID: "beholder",
  REPO: "GetBeholder/Beholder-GGUF",
  FILE: "Beholder-Q8_0.gguf",

  available: true,

  async request(path, init) {
    if (!this.available) return null;
    try {
      const res = await fetch(`/api/utility-sidecar${path}`, {
        credentials: "same-origin",
        headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}) },
        ...init,
        // After the spread, not before it: every one of these answers is about right
        // now — is the model loaded, which connection is answering, is there a newer
        // build — so a cached copy is a wrong answer and no caller may opt back in.
        cache: "no-store",
      });
      // A 404 on status means this engine has no utility slot at all. Stop asking.
      if (res.status === 404 && path === "/status") {
        this.available = false;
        return null;
      }
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.error || `${res.status}`);
      }
      return await res.json();
    } catch (error) {
      if (init?.rethrow) throw error;
      return null;
    }
  },

  status() {
    return this.request("/status");
  },

  /** Which connection will answer for this agent, decided server-side. */
  routing() {
    return this.request(`/routing/${this.MODEL_ID}`);
  },

  updateCheck() {
    return this.request(`/models/${this.MODEL_ID}/update-check`);
  },

  install() {
    return this.request("/models/install", {
      method: "POST",
      body: JSON.stringify({ modelId: this.MODEL_ID, repo: this.REPO, file: this.FILE }),
      rethrow: true,
    });
  },

  setActive(active) {
    return this.request("/active", {
      method: "PATCH",
      body: JSON.stringify({ modelId: active ? this.MODEL_ID : null }),
      rethrow: true,
    });
  },

  updateSettings(patch) {
    return this.request("/settings", { method: "PATCH", body: JSON.stringify(patch), rethrow: true });
  },

  /** A short, honest version label. Never claims "current" when it cannot tell. */
  versionLabel(model) {
    if (!model) return "not installed";
    if (!model.oid) return "version unknown";
    return model.oid.slice(0, 12);
  },
};
