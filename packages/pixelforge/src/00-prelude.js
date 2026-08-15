// ── Pixelforge prelude ────────────────────────────────────────────────────────
// Shared namespace + tiny utilities. Everything lives inside the build's IIFE;
// nothing leaks to the page except the custom element registration.
const PF = {
  TILE: 16, // world tile size in world pixels
  VW: 480, // internal viewport width  (integer-scaled up to the container)
  VH: 270, // internal viewport height
  WALK_SPEED: 70, // px/s
  CLOCK_SECONDS_PER_GAME_MINUTE: 1.2, // package-local clock (never /game/time/advance — issue #5076)
};

/** Deterministic 32-bit string hash (FNV-1a). */
PF.hashStr = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

/** mulberry32 — small deterministic PRNG. Returns () => [0,1). */
PF.rng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

PF.clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

PF.uid = () => {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `pf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

/** DOM helper: PF.el("div", {style: "...", onclick: fn, text: "..."}, [children]) */
PF.el = (tag, attrs, children) => {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      if (k === "text") node.textContent = String(v);
      else if (k === "style") node.style.cssText = String(v);
      else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, String(v));
    }
  }
  if (children) for (const c of children) if (c) node.appendChild(c);
  return node;
};

PF.offscreen = (w, h) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

// ── REST helpers (same-origin /api, cookie auth rides along) ─────────────────
PF.api = {
  async getJson(path) {
    const res = await fetch(`/api${path}`, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
    return res.json();
  },
  /** Merge-patch one key into chat metadata. `keepalive` for teardown flushes.
   *  x-marinara-csrf is required on every unsafe /api request (the same-origin
   *  escape hatch is off behind proxies/LAN hostnames — review finding). */
  async patchMetadata(chatId, patch, keepalive = false) {
    const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}/metadata`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-marinara-csrf": "1" },
      body: JSON.stringify(patch),
      keepalive,
    });
    if (!res.ok) throw new Error(`PATCH metadata → ${res.status}`);
  },
  async getSpatial(chatId) {
    const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}/spatial-context`, {
      headers: { Accept: "application/json" },
    });
    if (res.status === 404) return null; // hierarchical-maps absent → unbound mode
    if (!res.ok) throw new Error(`GET spatial-context → ${res.status}`);
    return res.json();
  },
};

/** Report a runtime failure through the host's error contract (per-element). */
PF.fail = (elOrNull, err) => {
  const message = err && err.message ? `Pixelforge: ${err.message}` : `Pixelforge: ${String(err)}`;
  try {
    // eslint-disable-next-line no-console
    console.error("[pixelforge]", err);
    elOrNull?.dispatchEvent(new CustomEvent("marinara-capability-runtime-error", { detail: { message } }));
  } catch {
    /* reporting must never throw */
  }
};
