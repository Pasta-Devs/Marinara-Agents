// ── Pixelforge prelude ────────────────────────────────────────────────────────
// Shared namespace + tiny utilities. Everything lives inside the build's IIFE;
// nothing leaks to the page except the custom element registration.
const PF = {
  TILE: 16, // world tile size in world pixels
  VW: 480, // internal viewport width  (integer-scaled up to the container)
  VH: 270, // internal viewport height
  // Roof cutout: how far the see-through bubble reaches around the player when
  // they walk under an eave, and how much of the roof it removes at the centre.
  // Deliberately short of 1 so the building still reads as solid overhead.
  ROOF_PEEK: { inner: 12, outer: 40, max: 0.85 },
  WALK_SPEED: 70, // px/s
  // Package-local clock (never /game/time/advance — issue #5076). 5s per game
  // minute = 2 real hours of WALKING per in-game day; the clock also freezes
  // during dialogue, so a played day stretches well past that. Tune here.
  CLOCK_SECONDS_PER_GAME_MINUTE: 5,
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

/** The value a map holds AT `key` ITSELF, or undefined. The only safe way to
 *  read a table with a word this package did not write.
 *
 *  A bare `TABLE[key]` walks the prototype chain, and every object has one:
 *  `TABLE["constructor"]` is a function, `TABLE["toString"]` is a function,
 *  `TABLE["__proto__"]` is Object.prototype. All of them are truthy AND
 *  non-nullish, which is the whole bug class — a `TABLE[key] || fallback` or
 *  `TABLE[key] ?? fallback` written against a caller-, model- or save-supplied
 *  key has a fallback that CANNOT FIRE, and the caller is handed a builtin
 *  where it asked for a row. What happens next is never a clean refusal: the
 *  builtin reads as a real answer and pins state, or the first property access
 *  off it throws somewhere with a catch that degrades quietly.
 *
 *  Shared rather than re-argued per site because the S5 gates caught this same
 *  read three times before it got a helper — the zone lookups (slices 1-2), the
 *  player block's maps (slices 3-4), and the economy's skin and price tables
 *  (slices 5-6). Whack-a-mole is not a strategy; a fallback goes through here. */
PF.own = (map, key) =>
  map && typeof map === "object" && Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;

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

/** An HTTP failure that carries its status. The save path classifies write
 *  failures by it — transient (network, no status, 5xx) backs off and retries,
 *  413/422 is terminal and degrades the session, 409 means the chat lost its
 *  Experience stamp and routes mode has to fall back — and a status parsed back
 *  out of the message string would be a trap the first time a message changes. */
PF.httpError = (label, status) => {
  const err = new Error(`${label} → ${status}`);
  err.status = status;
  return err;
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
    if (!res.ok) throw PF.httpError("PATCH metadata", res.status);
  },
  /** Host-owned per-timeline save slot (engine #5102). 404 = route absent (older
   *  engine), 409 = chat not stamped for an Experience — both are mode signals,
   *  not errors, so this never throws on them. Everything else rejects through
   *  PF.httpError: adopt() has to tell a 5xx blip (worth re-probing every minute)
   *  from a 401/403 the route MEANT (re-asking is noise), and it can only do that
   *  off a status on the object. */
  async getExperienceState(chatId) {
    const res = await fetch(`/api/game/${encodeURIComponent(chatId)}/experience-state`, {
      headers: { Accept: "application/json" },
    });
    if (res.status === 404 || res.status === 409) return { available: false, status: res.status };
    if (!res.ok) throw PF.httpError("GET experience-state", res.status);
    return { available: true, status: res.status, body: await res.json() };
  },
  /** Returns the route's own `{ ok, id, anchor }` echo when it parses. The
   *  ANCHOR is the point: the row lands at whatever the visible anchor is when
   *  the write is served, which is not necessarily the one the last GET read —
   *  a turn can finish in between. The ladder compares the two and takes the
   *  rewind path next round when they differ (plan §Q2, the PUT-anchor echo).
   *  A body that will not parse is not an error: the write still landed.
   *
   *  `schemaVersion` is the row's OUT-OF-BAND wire era (S5 slice 8). The route
   *  has always taken it and defaulted it to 1, and the package sent none, so
   *  every row it has written so far claims era 1 whatever is inside it. Omitted
   *  when the caller names none, so a call that does not care sends exactly the
   *  bytes it always did — and omitted when the value is one the route's own
   *  schema (int 1..1,000,000) would 400 on, because a column nothing reads for
   *  correctness must never be able to take the save down with it. */
  async putExperienceState(chatId, state, keepalive = false, schemaVersion) {
    const body = { state };
    if (
      typeof schemaVersion === "number" &&
      Number.isSafeInteger(schemaVersion) &&
      schemaVersion >= 1 &&
      schemaVersion <= 1_000_000
    )
      body.schemaVersion = schemaVersion;
    const res = await fetch(`/api/game/${encodeURIComponent(chatId)}/experience-state`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-marinara-csrf": "1" },
      body: JSON.stringify(body),
      keepalive,
    });
    if (!res.ok) throw PF.httpError("PUT experience-state", res.status);
    try {
      return await res.json();
    } catch {
      return null;
    }
  },
  /** One host-run structured generation call (engine #5135). Returns
   *  {status, body} without throwing on the route's documented 4xx ladder —
   *  those are failure-ladder signals, not errors. */
  async postExperienceGeneration(chatId, body, signal) {
    const res = await fetch(`/api/game/${encodeURIComponent(chatId)}/experience-generation`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-marinara-csrf": "1" },
      body: JSON.stringify(body),
      signal,
    });
    let payload = null;
    try {
      payload = await res.json();
    } catch {
      // non-JSON error body (proxy page, empty 5xx) — the ladder treats it as failure
    }
    return { status: res.status, body: payload };
  },
  async getSpatial(chatId) {
    const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}/spatial-context`, {
      headers: { Accept: "application/json" },
    });
    if (res.status === 404) return null; // hierarchical-maps absent → unbound mode
    if (!res.ok) throw new Error(`GET spatial-context → ${res.status}`);
    return res.json();
  },
  /** Additive location registration (World Maps 1.4.0, engine #5144). Returns
   *  {ok, status, body} without throwing: 404 = older maps package without the
   *  route, 409 = revision/id race — both are flow signals for the caller. */
  async postSpatialLocations(chatId, body) {
    const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}/spatial-context/locations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-marinara-csrf": "1" },
      body: JSON.stringify(body),
      // A hung request must not wedge the exporter's in-flight slot for the tab's lifetime.
      signal: AbortSignal.timeout(30000),
    });
    let payload = null;
    try {
      payload = await res.json();
    } catch {
      // non-JSON error body — the caller treats it as an unclassified failure
    }
    return { ok: res.ok, status: res.status, body: payload };
  },
};

/** Report a runtime failure through the host's error contract (per-element). */
PF.fail = (elOrNull, err) => {
  const message = err && err.message ? `Pixelforge: ${err.message}` : `Pixelforge: ${String(err)}`;
  try {
    console.error("[pixelforge]", err);
    elOrNull?.dispatchEvent(new CustomEvent("marinara-capability-runtime-error", { detail: { message } }));
  } catch {
    /* reporting must never throw */
  }
};
