// Pixelforge 0.12.0 — Marinara Engine game-surface Experience (single-file client bundle)
// Built from packages/pixelforge/src (16 modules) by scripts/build-pixelforge-package.mjs. Do not edit; edit src/ and rebuild.
(() => {
"use strict";
// ===== 00-prelude.js =====
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

// ===== 10-art.js =====
// ── Tier-0 procedural art ─────────────────────────────────────────────────────
// The deterministic bottom rung: a fixed 32-colour ramp and canvas-painted
// tiles/sprites so the game is playable with zero assets and zero network.
// Later tiers (authored atlas, AI bake) resolve above this and fall back here.
//
// THEMES (0.4.0): tile ids are SEMANTIC (grass/path/wall/roof/...), and a theme
// re-skins them — a palette override plus, where a recolour isn't enough, a
// painter override. The same zone grammar renders a cozy village or a sci-fi
// colony; the semantic layer is what the world compiler targets.
PF.art = (() => {
  const BASE_PAL = {
    grass1: "#3e7a44",
    grass2: "#356b3c",
    grass3: "#4b8a4f",
    leaf: "#2c5a33",
    leafHi: "#5aa25e",
    trunk: "#5b4432",
    path1: "#b39764",
    path2: "#a3875a",
    pathFleck: "#c7ab74",
    dirt: "#7a5f43",
    crop: "#7fae52",
    cropRipe: "#d9a03c",
    water1: "#2e5f8a",
    water2: "#39719e",
    waterHi: "#6fa3c8",
    wall: "#8a7561",
    wallDark: "#6e5c4b",
    plaster: "#cfc3a8",
    beam: "#6b4f38",
    roof1: "#9e4a3f",
    roof2: "#8a3f36",
    roofHi: "#b85e4d",
    floor1: "#8a6a4a",
    floor2: "#7d5f41",
    rug: "#93404a",
    stone: "#8d8d94",
    stoneDark: "#73737a",
    fence: "#7d6142",
    door: "#5d4530",
    doorKnob: "#d9c07a",
    well: "#6f6f78",
    counter: "#725539",
    night: "#1a2340",
    windowGlow: "#ffd98a",
    ink: "#22261f",
    white: "#f3efe2",
  };

  // Painters read PAL by reference, so themes swap colours by mutating this one
  // object in place (setTheme) — every painter and the renderer's tint code keep
  // working untouched. Tile caches are keyed by theme, so swaps never bleed.
  const PAL = { ...BASE_PAL };

  const T = PF.TILE;

  /** One 16×16 tile canvas: Tier-1 (authored atlas) ?? Tier-0 (procedural).
   *  Tier-1 only serves the theme it was authored for; other themes stay
   *  procedural until themed atlases ship. */
  const tileCache = new Map();
  function tile(id) {
    if (activeTheme === PF.assets?.atlasTheme) {
      const authored = PF.assets?.tileCanvas(id);
      if (authored) return authored;
    }
    const cacheKey = `${activeTheme}:${id}`;
    let c = tileCache.get(cacheKey);
    if (c) return c;
    c = PF.offscreen(T, T);
    const g = c.getContext("2d");
    const themePainters = THEMES[activeTheme]?.painters;
    ((themePainters && themePainters[id]) || PAINTERS[id] || PAINTERS.grass)(
      g,
      PF.rng(PF.hashStr(`tile:${activeTheme}:${id}`)),
    );
    tileCache.set(cacheKey, c);
    return c;
  }

  const px = (g, x, y, w, h, color) => {
    g.fillStyle = color;
    g.fillRect(x, y, w, h);
  };
  const dither = (g, rnd, color, n) => {
    for (let i = 0; i < n; i++) px(g, (rnd() * T) | 0, (rnd() * T) | 0, 1, 1, color);
  };

  const PAINTERS = {
    grass(g, rnd) {
      px(g, 0, 0, T, T, PAL.grass1);
      dither(g, rnd, PAL.grass2, 14);
      dither(g, rnd, PAL.grass3, 8);
    },
    grass2(g, rnd) {
      px(g, 0, 0, T, T, PAL.grass2);
      dither(g, rnd, PAL.grass1, 12);
      dither(g, rnd, PAL.leaf, 5);
    },
    path(g, rnd) {
      px(g, 0, 0, T, T, PAL.path1);
      dither(g, rnd, PAL.path2, 12);
      dither(g, rnd, PAL.pathFleck, 6);
    },
    dirt(g, rnd) {
      px(g, 0, 0, T, T, PAL.dirt);
      dither(g, rnd, PAL.path2, 8);
    },
    crop(g, rnd) {
      px(g, 0, 0, T, T, PAL.dirt);
      for (let r = 2; r < T; r += 5) px(g, 1, r, T - 2, 1, PAL.path2);
      dither(g, rnd, PAL.crop, 10);
      dither(g, rnd, PAL.cropRipe, 3);
    },
    water(g, rnd) {
      px(g, 0, 0, T, T, PAL.water1);
      dither(g, rnd, PAL.water2, 12);
      px(g, (rnd() * 10) | 0, (rnd() * 14) | 0, 4, 1, PAL.waterHi);
    },
    stone(g, rnd) {
      px(g, 0, 0, T, T, PAL.stone);
      dither(g, rnd, PAL.stoneDark, 10);
      px(g, 0, T - 1, T, 1, PAL.stoneDark);
    },
    wall(g) {
      px(g, 0, 0, T, T, PAL.plaster);
      px(g, 0, 0, T, 2, PAL.beam);
      px(g, 0, T - 2, T, 2, PAL.beam);
      px(g, 7, 2, 2, T - 4, PAL.beam);
    },
    wallStone(g, rnd) {
      px(g, 0, 0, T, T, PAL.wallDark);
      for (let r = 0; r < 4; r++)
        for (let cx = 0; cx < 2; cx++) px(g, cx * 8 + (r % 2) * 4, r * 4, 7, 3, rnd() > 0.5 ? PAL.wall : PAL.wallDark);
    },
    window(g) {
      PAINTERS.wall(g);
      px(g, 3, 4, 10, 8, PAL.beam);
      px(g, 4, 5, 8, 6, PAL.water2);
      px(g, 7, 5, 1, 6, PAL.beam);
    },
    door(g) {
      px(g, 0, 0, T, T, PAL.wallDark);
      px(g, 2, 1, 12, 15, PAL.door);
      px(g, 3, 2, 10, 13, PAL.beam);
      px(g, 11, 8, 2, 2, PAL.doorKnob);
    },
    roof(g, rnd) {
      px(g, 0, 0, T, T, PAL.roof1);
      for (let r = 0; r < T; r += 4) px(g, 0, r, T, 1, PAL.roof2);
      dither(g, rnd, PAL.roofHi, 4);
    },
    roofEdge(g, rnd) {
      PAINTERS.roof(g, rnd);
      px(g, 0, T - 3, T, 3, PAL.beam);
    },
    floor(g, rnd) {
      px(g, 0, 0, T, T, PAL.floor1);
      for (let r = 0; r < T; r += 4) px(g, 0, r, T, 1, PAL.floor2);
      dither(g, rnd, PAL.floor2, 5);
    },
    rug(g, rnd) {
      PAINTERS.floor(g, rnd);
      px(g, 1, 1, T - 2, T - 2, PAL.rug);
      px(g, 3, 3, T - 6, T - 6, PAL.roofHi);
    },
    counter(g) {
      px(g, 0, 0, T, T, PAL.counter);
      px(g, 0, 0, T, 3, PAL.path1);
      px(g, 0, 3, T, 1, PAL.beam);
    },
    fence(g) {
      px(g, 0, 0, T, T, PAL.grass1);
      px(g, 2, 4, 2, 10, PAL.fence);
      px(g, 12, 4, 2, 10, PAL.fence);
      px(g, 0, 6, T, 2, PAL.fence);
    },
    /** NO GROUND FILL. The renderer draws an object tile straight over the ground
     *  tile and the draw is opaque, so a painter that fills its own background is
     *  declaring what it stands on. A well does not get to: it is the middle of
     *  the plaza, where the ground is paving, and filling grass1 put a green
     *  square in the middle of every square in the game — including the four ward
     *  squares, which are stone by definition. Left transparent, the paving shows
     *  through and the same sprite works on grass, path and stone alike. */
    well(g) {
      px(g, 2, 4, 12, 10, PAL.well);
      px(g, 4, 6, 8, 6, PAL.ink);
      px(g, 2, 2, 12, 2, PAL.beam);
    },
    trunk(g) {
      px(g, 0, 0, T, T, PAL.grass1);
      px(g, 6, 2, 4, 14, PAL.trunk);
      px(g, 5, 12, 6, 2, PAL.leaf);
    },
    canopy(g, rnd) {
      // overhead layer tile — transparent corners so it reads as a treetop
      g.clearRect(0, 0, T, T);
      px(g, 2, 2, 12, 12, PAL.leaf);
      px(g, 1, 4, 14, 8, PAL.leaf);
      px(g, 4, 1, 8, 14, PAL.leaf);
      dither(g, rnd, PAL.leafHi, 9);
      dither(g, rnd, PAL.grass3, 4);
    },
    /** Also unfilled, and for the same reason plus one: `floor1` is an INTERIOR
     *  timber colour, so a market board on the square used to lay a plank of
     *  floorboard down outdoors. Transparent works indoors too — the floor tile
     *  it sits on is the one it was imitating. */
    table(g) {
      px(g, 2, 3, 12, 9, PAL.counter);
      px(g, 3, 4, 10, 7, PAL.path1);
    },
    // The sanctuary's focal block. Edge-to-edge on purpose: a run of them reads as
    // ONE long altar rather than a row of furniture, which is the whole point of a
    // focal object. The colony's palette turns the same silhouette into a lit
    // memorial slab, so no painter override is needed to make it coherent there.
    altar(g) {
      px(g, 0, 0, T, T, PAL.floor1);
      px(g, 0, 3, T, 10, PAL.stone);
      px(g, 0, 3, T, 2, PAL.white);
      px(g, 0, 6, T, 1, PAL.doorKnob);
      px(g, 0, 12, T, 1, PAL.stoneDark);
    },
    // A bed is laid NON-solid wherever the compiler puts one: the sleeper stands
    // ON the tile, which is what makes walking in at night read as finding
    // someone in bed rather than standing politely beside the furniture. So it is
    // painted floor-first and kept low-contrast — a sprite composites over it.
    bed(g, rnd) {
      PAINTERS.floor(g, rnd);
      px(g, 2, 1, 12, 14, PAL.beam);
      px(g, 3, 2, 10, 12, PAL.wall);
      px(g, 3, 2, 10, 4, PAL.white);
      px(g, 3, 8, 10, 6, PAL.rug);
      px(g, 3, 8, 10, 1, PAL.roofHi);
    },
    // The shop's stock: the tile that says there is something here to buy. Solid,
    // so it reads as furniture the shopkeeper stands in front of.
    /** The fire a household lives around, and the first thing in a dwelling that
     *  is neither a bed nor a surface to put something down on.
     *
     *  Painted as a stone surround with the opening cut into it rather than as a
     *  free-standing object, because a hearth is part of the WALL it is set in —
     *  a fireplace in the middle of a room reads as a barbecue. The glow uses
     *  `windowGlow`, which the colony palette turns from firelight to cold blue,
     *  so the same silhouette is a hab's heat exchanger over there without
     *  needing a painter override.
     *
     *  Laid solid: you warm yourself in front of a fire, not on top of one. */
    hearth(g) {
      px(g, 0, 0, T, T, PAL.floor1);
      px(g, 1, 1, 14, 14, PAL.stone);
      px(g, 1, 1, 14, 2, PAL.stoneDark);
      px(g, 3, 4, 10, 1, PAL.stoneDark);
      px(g, 4, 5, 8, 10, PAL.ink);
      px(g, 5, 9, 6, 5, PAL.windowGlow);
      px(g, 6, 11, 4, 3, PAL.white);
    },
    shelf(g) {
      px(g, 0, 0, T, T, PAL.counter);
      px(g, 0, 0, T, 1, PAL.beam);
      px(g, 0, T - 1, T, 1, PAL.beam);
      for (const shelfY of [1, 9]) {
        for (let cx = 2; cx < 14; cx += 4) {
          px(g, cx, shelfY + 1, 3, 4, PAL.path1);
          px(g, cx, shelfY + 1, 3, 1, PAL.doorKnob);
        }
        px(g, 1, shelfY + 5, 14, 1, PAL.beam);
      }
    },
    // One berth of a bunk — and the reason a bunk sleeps two without ever
    // putting two sprites on one tile: the compiler lays TWO of these one above
    // the other and stands a sleeper on each. So the frame runs edge to edge top
    // and bottom (the altar's trick), and a stacked pair reads as one two-berth
    // frame rather than two beds nose to tail. The ladder up the west rail is
    // what tells it apart from a bed at a glance. Non-solid like the bed: the
    // sleeper stands ON it.
    bunk(g, rnd) {
      PAINTERS.floor(g, rnd);
      px(g, 2, 0, 12, T, PAL.beam);
      px(g, 3, 0, 10, T, PAL.wall);
      px(g, 3, 1, 10, 4, PAL.white);
      px(g, 3, 7, 10, 8, PAL.rug);
      px(g, 3, 7, 10, 1, PAL.roofHi);
      px(g, 2, 0, 1, T, PAL.trunk);
      px(g, 13, 0, 1, T, PAL.trunk);
      for (let rung = 1; rung < T; rung += 4) px(g, 1, rung, 3, 1, PAL.doorKnob);
    },
    // A flight going UP, drawn receding north — up the screen is up the stairs,
    // so the tile needs no arrow to say which way it goes. Non-solid wherever the
    // compiler lays one: a stair is a PORTAL and the player has to be able to step
    // onto it, which is also why an NPC is never found standing here (standable()
    // refuses portal tiles).
    stairsUp(g, rnd) {
      PAINTERS.floor(g, rnd);
      for (let step = 0; step < 4; step++) {
        const inset = step;
        px(g, 1 + inset, T - 4 - step * 4, T - 2 - inset * 2, 4, PAL.beam);
        px(g, 1 + inset, T - 4 - step * 4, T - 2 - inset * 2, 1, PAL.plaster);
      }
    },
    // The way DOWN is a hole in the floor, not the same steps mirrored: the dark
    // mouth is what tells the two apart at a glance, standing over them.
    stairsDown(g, rnd) {
      PAINTERS.floor(g, rnd);
      px(g, 1, 2, T - 2, T - 3, PAL.ink);
      for (let step = 0; step < 3; step++) {
        const inset = step + 1;
        px(g, 1 + inset, 3 + step * 4, T - 2 - inset * 2, 3, PAL.beam);
        px(g, 1 + inset, 3 + step * 4, T - 2 - inset * 2, 1, PAL.wallDark);
      }
    },
    // The one thing in a belfry, hung on its headstock with floor all the way
    // round it. Solid: the bell is what the climb is FOR, so it reads as an
    // object the player walks up to rather than through. Like the altar it needs
    // no themed override — the colony palette turns the same silhouette into a
    // struck alarm plate, which is the same thing a bell is.
    bell(g) {
      px(g, 0, 0, T, T, PAL.floor1);
      px(g, 2, 1, 12, 2, PAL.beam);
      px(g, 5, 3, 6, 2, PAL.stoneDark);
      px(g, 4, 5, 8, 6, PAL.doorKnob);
      px(g, 5, 6, 2, 4, PAL.white);
      px(g, 3, 11, 10, 2, PAL.doorKnob);
      px(g, 3, 11, 10, 1, PAL.white);
      px(g, 7, 13, 2, 2, PAL.stoneDark);
    },
    /** WHERE THE ROAD CROSSES THE WATER. Painted water FIRST and decked over it,
     *  because that is literally what the tile is: the water underneath is still
     *  there, and a deck that did not show it would be a road tile with a wood
     *  grain. The one-pixel margin of open water on all four sides is what makes
     *  a run of them read as a boardwalk — the seam between two sections — and
     *  is also why the tile needs no orientation: a bridge laid north-south and
     *  one laid east-west are the same picture, which matters because the
     *  compiler has no way to tell a placer which way a crossing runs.
     *
     *  Non-solid wherever it is laid: the whole point of the ruling is that the
     *  road still crosses. No themed override, for the altar's reason — the
     *  colony palette turns timber planking into deck plating on the same
     *  silhouette, which is what a walkway over coolant is. */
    bridge(g, rnd) {
      PAINTERS.water(g, rnd);
      px(g, 1, 1, T - 2, T - 2, PAL.beam);
      px(g, 2, 2, T - 4, T - 4, PAL.path1);
      for (let plank = 4; plank < T - 3; plank += 4) px(g, 2, plank, T - 4, 1, PAL.path2);
      px(g, 2, 2, T - 4, 1, PAL.pathFleck);
    },
  };

  // ── Themes ──────────────────────────────────────────────────────────────────
  // A theme = palette overrides + painter overrides where a recolour can't carry
  // the meaning. Semantic ids keep their WORLD role (trunk blocks, canopy is
  // overhead, water is liquid/impassable); only the visual story changes.
  const THEMES = {
    "cozy-village": {
      label: "Cozy village",
      palette: {},
      painters: {},
    },
    "sci-fi-colony": {
      label: "Sci-fi colony",
      palette: {
        // regolith ground, steel decking, hull walls, glass domes, coolant water
        grass1: "#5a4a44",
        grass2: "#4e403b",
        grass3: "#6a5850",
        leaf: "#3e6d74",
        leafHi: "#7fd4d4",
        trunk: "#8e99a6",
        path1: "#7d8894",
        path2: "#6b7580",
        pathFleck: "#9aa5b1",
        dirt: "#4a3f3a",
        crop: "#59c08a",
        cropRipe: "#b6e86a",
        water1: "#1f8a8a",
        water2: "#2aa3a0",
        waterHi: "#8ff0e8",
        wall: "#8b95a3",
        wallDark: "#5d6672",
        plaster: "#aeb7c2",
        beam: "#3f4854",
        roof1: "#4a6a8a",
        roof2: "#3d5871",
        roofHi: "#7fb0d4",
        floor1: "#59616c",
        floor2: "#4d545e",
        rug: "#2a6a8a",
        stone: "#767e88",
        stoneDark: "#5a626c",
        fence: "#5d6672",
        door: "#3f4854",
        doorKnob: "#8ff0e8",
        well: "#4d545e",
        counter: "#3f4854",
        night: "#101726",
        windowGlow: "#8fd4ff",
      },
      painters: {
        // hab wall: smooth panel with a seam and rivets instead of timber framing
        wall(g) {
          px(g, 0, 0, T, T, PAL.plaster);
          px(g, 0, 0, T, 1, PAL.beam);
          px(g, 0, T - 1, T, 1, PAL.beam);
          px(g, 7, 1, 1, T - 2, PAL.wallDark);
          px(g, 2, 2, 1, 1, PAL.wallDark);
          px(g, 13, 2, 1, 1, PAL.wallDark);
          px(g, 2, 13, 1, 1, PAL.wallDark);
          px(g, 13, 13, 1, 1, PAL.wallDark);
        },
        // porthole window
        window(g) {
          px(g, 0, 0, T, T, PAL.plaster);
          px(g, 0, 0, T, 1, PAL.beam);
          px(g, 0, T - 1, T, 1, PAL.beam);
          px(g, 4, 3, 8, 10, PAL.beam);
          px(g, 5, 4, 6, 8, PAL.water2);
          px(g, 6, 5, 2, 2, PAL.waterHi);
        },
        // pressure door with a light strip instead of a knob
        door(g) {
          px(g, 0, 0, T, T, PAL.wallDark);
          px(g, 2, 1, 12, 15, PAL.door);
          px(g, 3, 2, 10, 13, PAL.beam);
          px(g, 7, 2, 2, 13, PAL.wallDark);
          px(g, 4, 7, 8, 2, PAL.doorKnob);
        },
        // solar-panel roof: cell grid with a bright specular row
        roof(g, rnd) {
          px(g, 0, 0, T, T, PAL.roof1);
          for (let r = 0; r < T; r += 4) px(g, 0, r, T, 1, PAL.roof2);
          for (let cx = 0; cx < T; cx += 4) px(g, cx, 0, 1, T, PAL.roof2);
          dither(g, rnd, PAL.roofHi, 3);
        },
        // comms mast: the "tree" of the colony — steel pylon on regolith
        trunk(g) {
          px(g, 0, 0, T, T, PAL.grass1);
          px(g, 7, 2, 2, 14, PAL.trunk);
          px(g, 5, 4, 6, 1, PAL.trunk);
          px(g, 6, 12, 4, 2, PAL.wallDark);
        },
        // antenna array / dome cap as the overhead layer
        canopy(g, rnd) {
          g.clearRect(0, 0, T, T);
          px(g, 5, 0, 6, 2, PAL.leafHi);
          px(g, 7, 2, 2, 3, PAL.trunk);
          px(g, 3, 4, 10, 2, PAL.trunk);
          px(g, 2, 5, 2, 1, PAL.leafHi);
          px(g, 12, 5, 2, 1, PAL.leafHi);
          dither(g, rnd, PAL.leaf, 3);
        },
        // hydroponics tray instead of a tilled crop row
        crop(g, rnd) {
          px(g, 0, 0, T, T, PAL.floor2);
          px(g, 1, 2, T - 2, 5, PAL.beam);
          px(g, 1, 9, T - 2, 5, PAL.beam);
          px(g, 2, 3, T - 4, 3, PAL.dirt);
          px(g, 2, 10, T - 4, 3, PAL.dirt);
          dither(g, rnd, PAL.crop, 9);
          dither(g, rnd, PAL.cropRipe, 3);
        },
        // atmosphere recycler where the village well stood
        // Unfilled, like the village well it replaces — a recycler stands on the
        // colony's paving, not on a patch of turf it brought with it.
        well(g) {
          px(g, 3, 3, 10, 11, PAL.well);
          px(g, 4, 4, 8, 2, PAL.leafHi);
          px(g, 4, 7, 8, 1, PAL.wallDark);
          px(g, 4, 9, 8, 1, PAL.wallDark);
          px(g, 4, 11, 8, 1, PAL.wallDark);
        },
        // guard rail instead of a wooden fence
        fence(g) {
          px(g, 0, 0, T, T, PAL.grass1);
          px(g, 2, 4, 2, 10, PAL.fence);
          px(g, 12, 4, 2, 10, PAL.fence);
          px(g, 0, 6, T, 1, PAL.trunk);
          px(g, 0, 9, T, 1, PAL.trunk);
        },
      },
    },
  };

  let activeTheme = "cozy-village";

  /** Swap the active theme: mutate PAL in place (painters and the renderer read
   *  it by reference) and drop this module's procedural caches. Callers that
   *  composite tiles (the zone renderer) must clear their own caches too —
   *  world builds already do. Unknown ids resolve to the fixed default, never
   *  whatever theme happens to be active (order-dependent worlds otherwise). */
  function setTheme(id) {
    // PF.own, because "unknown" has to include the words every object answers
    // to. The read was bare, so `THEMES["constructor"]` came back a truthy
    // FUNCTION, "constructor" was accepted as a theme id and PINNED here — the
    // one place the docstring above promises it cannot be — and from here it
    // reaches world.theme, the save row, and every theme table downstream.
    const theme = typeof id === "string" && PF.own(THEMES, id) ? id : "cozy-village";
    if (theme === activeTheme) return activeTheme;
    activeTheme = theme;
    for (const key of Object.keys(PAL)) delete PAL[key];
    Object.assign(PAL, BASE_PAL, THEMES[activeTheme].palette);
    tileCache.clear();
    actorCache.clear();
    return activeTheme;
  }

  const themeIds = () => Object.keys(THEMES);

  // ── Actor sprites: 12×16 humanoid, 4 facings × 3 frames (idle, stepA, stepB)
  const actorCache = new Map();
  function actor(hue) {
    let strip = actorCache.get(hue);
    if (strip) return strip;
    const shirt = `hsl(${hue} 45% 45%)`;
    const shirtDark = `hsl(${hue} 45% 32%)`;
    const pants = "#3b3b4a";
    const skin = "#e8b98a";
    const hair = `hsl(${(hue + 140) % 360} 30% 25%)`;
    strip = { frames: [] };
    for (let f = 0; f < 4; f++) {
      // facing: 0 down, 1 up, 2 left, 3 right
      const row = [];
      for (let fr = 0; fr < 3; fr++) {
        const c = PF.offscreen(12, 16);
        const g = c.getContext("2d");
        const legShift = fr === 0 ? 0 : fr === 1 ? 1 : -1;
        // legs
        px(g, 3, 12, 2, 4 - Math.max(0, legShift), pants);
        px(g, 7, 12, 2, 4 + Math.min(0, legShift), pants);
        // torso
        px(g, 2, 6, 8, 6, shirt);
        px(g, 2, 10, 8, 2, shirtDark);
        // arms
        px(g, 1, 7, 1, 4, shirt);
        px(g, 10, 7, 1, 4, shirt);
        // head
        px(g, 3, 1, 6, 5, skin);
        px(g, 2, 0, 8, 2, hair);
        if (f === 0) {
          px(g, 4, 3, 1, 1, "#222");
          px(g, 7, 3, 1, 1, "#222");
        } else if (f === 2) {
          px(g, 3, 3, 1, 1, "#222");
        } else if (f === 3) {
          px(g, 8, 3, 1, 1, "#222");
        } else {
          px(g, 2, 1, 8, 3, hair); // back of head
        }
        row.push(c);
      }
      strip.frames.push(row);
    }
    actorCache.set(hue, strip);
    return strip;
  }

  /** Draw an actor frame at (dx, dy): Tier-1 sheet (4-frame authored walk
   *  cycle, keyed by actor name) ?? Tier-0 strip (3-frame synthesized). */
  function drawActor(ctx, key, hue, facing, phase, moving, dx, dy) {
    if (PF.assets?.drawActor(ctx, key, facing, phase, moving, dx, dy)) return;
    const strip = actor(hue);
    const frame = moving ? 1 + (Math.floor(phase) % 2) : 0;
    ctx.drawImage(strip.frames[facing][frame], dx, dy);
  }

  return {
    PAL,
    /** Every object name this module can actually draw.
     *
     *  Exported for one reason: nothing anywhere checked that a tile the compiler
     *  PLACES has a painter to draw it with. A new object compiled, passed the
     *  whole harness, and would have rendered as bare floor in the browser — the
     *  one failure a headless test suite cannot see and the only one a player
     *  would notice immediately. The harness now compares the two sets. */
    painterNames: () => Object.keys(PAINTERS),
    tile,
    actor,
    drawActor,
    setTheme,
    themeIds,
    get theme() {
      return activeTheme;
    },
  };
})();

// ===== 15-assets.js =====
// ── Tier-1 asset loader ───────────────────────────────────────────────────────
// Loads the authored atlas + sprite sheets shipped as package assets
// (contributions.assets, Capability API 1.10). Every draw resolves
// Tier1 ?? Tier0, so a missing/failed load (older engine without the assets
// route, network trouble, corrupted file → 404) leaves the game fully playable
// on procedural art. Uses the packageId/packageVersion the host injects into
// capabilityProps; ?v= keys the browser cache per version (assets revalidate
// with ETags — never immutable).
PF.assets = {
  status: "idle", // idle | loading | ready | failed
  /** The theme the shipped atlas was authored for: Tier-1 art only serves this
   *  theme; every other theme renders procedurally until themed atlases ship. */
  atlasTheme: "cozy-village",
  atlas: null, // {tileSize, columns, tiles: {id: index}}
  sprites: null, // {frameWidth, frameHeight, frames, rows, actors: {name: path}}
  _atlasImg: null,
  _sheets: new Map(), // actor name → HTMLImageElement
  _tileCanvases: new Map(),

  _url(core, path) {
    const id = typeof core.host?.packageId === "string" ? core.host.packageId : "pixelforge";
    const version = typeof core.host?.packageVersion === "string" ? core.host.packageVersion : null;
    return `/api/capability-packages/${encodeURIComponent(id)}/assets/${path}${
      version ? `?v=${encodeURIComponent(version)}` : ""
    }`;
  },

  async _image(url) {
    const img = new Image();
    img.src = url;
    // Never await decode(): Chromium defers decode work indefinitely while the
    // page is hidden (background tab, restored session), which wedged the
    // loader in "loading" forever. The load event fires regardless; the actual
    // pixel decode then happens lazily at first drawImage.
    await new Promise((resolve, reject) => {
      if (img.complete && img.naturalWidth) return resolve();
      img.onload = resolve;
      img.onerror = () => reject(new Error(`image failed to load: ${url}`));
    });
    return img;
  },

  /** The atlas sheet for a theme: the cozy sheet keeps its legacy filename. */
  _atlasPath(theme) {
    return theme === "cozy-village" ? "tiles.png" : `tiles-${encodeURIComponent(theme)}.png`;
  },

  async load(core) {
    const theme = PF.art?.theme ?? "cozy-village";
    if (this.status === "loading") {
      // A theme change landing mid-load must not be dropped (the generation
      // rebuild can call load() while the boot load is still in flight):
      // remember the newest request and chase it once this load settles.
      this._queuedTheme = theme;
      return;
    }
    // The REQUESTED theme is tracked separately from the RESOLVED one: when a
    // theme has no shipped atlas the fallback sheet loads, and without this
    // distinction every props delivery would re-run a 404-fetch + full zone
    // recomposite storm (review finding).
    if (this.status === "ready" && this._requestedTheme === theme) return;
    // No packageId (pre-#5092 engine) is the one terminal state; network
    // failures retry, rate-limited, so a transient outage no longer disables
    // Tier-1 for the whole session (0.3.0 regression fix).
    if (this._noPackage) return;
    if (this.status === "failed" && Date.now() - (this._failedAt ?? 0) < 30_000) return;
    if (typeof core.host?.packageId !== "string") {
      this._noPackage = true;
      this.status = "failed";
      return;
    }
    this._requestedTheme = theme;
    const firstLoad = this.status !== "ready";
    this.status = "loading";
    try {
      if (firstLoad) {
        const [atlas, sprites] = await Promise.all([
          fetch(this._url(core, "atlas.json")).then((r) =>
            r.ok ? r.json() : Promise.reject(new Error(`atlas ${r.status}`)),
          ),
          fetch(this._url(core, "sprites.json")).then((r) =>
            r.ok ? r.json() : Promise.reject(new Error(`sprites ${r.status}`)),
          ),
        ]);
        const sheets = await Promise.all(
          Object.entries(sprites.actors ?? {}).map(async ([name, path]) => [
            name,
            await this._image(this._url(core, path)),
          ]),
        );
        this.atlas = atlas;
        this.sprites = sprites;
        for (const [name, img] of sheets) this._sheets.set(name, img);
      }
      // The themed atlas sheet, falling back to the cozy sheet when a theme has
      // no atlas yet (older installed version) — the tile() gate then simply
      // keeps that theme procedural, which is the deliberate resting state.
      let atlasTheme = theme;
      let atlasImg;
      try {
        atlasImg = await this._image(this._url(core, this._atlasPath(theme)));
      } catch {
        atlasTheme = "cozy-village";
        atlasImg = await this._image(this._url(core, "tiles.png"));
      }
      this._atlasImg = atlasImg;
      this.atlasTheme = atlasTheme;
      this._tileCanvases.clear();
      this.status = "ready";
      // Zone composites were painted with the previous tier/theme — rebuild.
      core.render?.clearZones?.();
      // Chase a theme change that was queued while this load was in flight.
      const queued = this._queuedTheme;
      this._queuedTheme = null;
      if (queued && queued !== theme) void this.load(core);
    } catch (err) {
      this.status = "failed";
      this._failedAt = Date.now();
      this._requestedTheme = null;
      this._queuedTheme = null; // the 30s retry re-reads the live theme anyway
      console.warn("[pixelforge] Tier-1 assets unavailable, staying on procedural art", err);
    }
  },

  /** Tier-1 tile as a canvas, or null → caller falls back to Tier-0. */
  tileCanvas(id) {
    if (this.status !== "ready") return null;
    const index = this.atlas.tiles[id];
    if (index === undefined) return null;
    let c = this._tileCanvases.get(id);
    if (c) return c;
    const size = this.atlas.tileSize;
    c = PF.offscreen(size, size);
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.drawImage(
      this._atlasImg,
      (index % this.atlas.columns) * size,
      Math.floor(index / this.atlas.columns) * size,
      size,
      size,
      0,
      0,
      size,
      size,
    );
    this._tileCanvases.set(id, c);
    return c;
  },

  /** Draw a Tier-1 actor frame; returns false → caller falls back to Tier-0. */
  drawActor(ctx, key, facing, phase, moving, dx, dy) {
    if (this.status !== "ready") return false;
    const sheet = this._sheets.get(key);
    if (!sheet || !this.sprites) return false;
    const { frameWidth, frameHeight, frames } = this.sprites;
    const frame = moving ? Math.floor(phase) % frames : 0;
    ctx.drawImage(
      sheet,
      frame * frameWidth,
      facing * frameHeight,
      frameWidth,
      frameHeight,
      dx,
      dy,
      frameWidth,
      frameHeight,
    );
    return true;
  },
};

// ===== 18-brief.js =====
// ── The World Brief (schema v1) ───────────────────────────────────────────────
// The contract between the one LLM call and the deterministic compiler — see
// docs/brief-schema.md (sealed spec). The LLM decides WHAT exists; the compiler
// decides where every tile goes. validate() runs the repair passes ONCE; the
// sealed brief (with compiler-assigned _ids and a _repairs log) is stored in the
// wizard config and never re-repaired. All entropy for repairs derives from
// hash(seed, fieldPath) — one source, deterministic forever.
PF.brief = (() => {
  const VERSION = 1;

  // ── Vocabularies (the form does the teaching) ───────────────────────────────
  // Sized so the STREET GRID has somewhere to put a street. The grid lays a lot
  // every 8 rows and every 9 columns, and a map only 30 tall has room for two
  // rows of them however wide it is — so a village used to lay six lots on 1320
  // tiles and read as a hamlet with a lot of grass. Lots per rank now run
  // 4 / 8 / 16 / 36 / 80, which is the first progression where each rank looks
  // like a bigger VERSION of the one below rather than the same place zoomed.
  //
  // `buildings` is the ceiling on how many of those lots get laid out, and it is
  // deliberately kept ABOVE what the population arithmetic asks for at each rank
  // (20-world's RESIDENT_HOUSEHOLDS). The ground should permit and the people
  // should decide; when this number binds first, every settlement of a rank comes
  // out the same size no matter who lives there, which is the bug that made a
  // city eighteen buildings wide whatever its brief said.
  const SCALES = {
    outpost: { w: 28, h: 20, buildings: 4 },
    hamlet: { w: 48, h: 28, buildings: 8 },
    village: { w: 60, h: 40, buildings: 16 },
    town: { w: 76, h: 52, buildings: 34 },
    // A CITY. Roomy on purpose: it is the rank where districts (roadmap W3) will
    // eventually carve the map into wards with their own gravity, and the ground
    // wants to be there before the machinery that divides it.
    city: { w: 104, h: 72, buildings: 76 },
  };
  const SURROUNDS = ["woods", "fields", "rocky", "water", "barren"];
  const PROSPERITY = ["struggling", "modest", "thriving"];
  const PLACE_KINDS = ["gathering", "workshop", "hall", "sanctuary", "dwelling", "wilds"];
  const CAST_KINDS = [
    "leader",
    "host",
    "grower",
    "maker",
    "merchant",
    "guard",
    "healer",
    "scholar",
    "elder",
    "child",
    "wanderer",
    "folk",
  ];
  // Rootedness/integration — orthogonal to kind. resident is the strong default;
  // non-residents get NO dwelling and a standing-specific rest anchor (the inn,
  // the wilds/edge, or the town's public center). See docs/brief-schema.md.
  const STANDING = ["resident", "transient", "fringe", "destitute"];
  // Nine buckets cannot cluster; sprite legibility is an invariant, not a repair.
  const TINTS = {
    red: 4,
    orange: 28,
    amber: 48,
    green: 110,
    teal: 168,
    blue: 214,
    violet: 268,
    rose: 330,
    grey: 210,
  };
  const FEATURE_TAGS = [
    "water-feature",
    "crop-plots",
    "market-stalls",
    "workyard",
    "landmark-stone",
    "shrine",
    "water-crossing",
    "dense-growth",
    "ruin",
    "lookout",
  ];
  // Which tags make sense per zone kind (invalid-for-zone drops at compile, not parse).
  const SETTLEMENT_TAGS = new Set(FEATURE_TAGS.filter((t) => t !== "water-crossing" && t !== "dense-growth"));

  const CAPS = {
    // The ceiling a brief may ASK for. What a settlement can actually hold is
    // per-scale (FEATURE_ROOM below) — an outpost is 560 tiles and four of its
    // lots are now houses, so four named features have nowhere to stand and the
    // last two are dropped in silence. Small settlements holding fewer features
    // is correct; asking for four and losing two without a word is not.
    features: 4,
    places: 4,
    wilds: 2,
    hall: 1,
    gathering: 1,
    sanctuary: 1,
    castMin: 4,
    castMax: 10,
    // AN ID SPACE, not an occupancy bound. The two were the same constant, and
    // that conflation is the same bug as `household` carrying both kinship and
    // address: `Math.min(CAPS.household, n)` clamps WHICH group you are in, while
    // the oversize-split pass used the identical number to bound HOW MANY share
    // one. Ten people must be able to be ten unrelated households — a convent, a
    // barracks, a boarding house — so the id space is the cast size, and nothing
    // caps the members of a group any more.
    household: 10,
  };
  // How many named features the GROUND of each rank can actually carry, measured
  // rather than guessed: with the street-grid allocator an outpost seats two, a
  // hamlet three, and everything from a village up seats the full ask.
  const FEATURE_ROOM = { outpost: 2, hamlet: 3, village: 4, town: 4, city: 4 };
  // Named places take LOTS, and an outpost lays four of them. Four places leave
  // nothing for the houses the cast still needs, so the drop guard fires and the
  // brief loses buildings it named. What the rank can seat, it seals; the rest
  // never gets promised.
  const PLACE_ROOM = { outpost: 2, hamlet: 3, village: 4, town: 4, city: 4 };
  const BRIEF_BYTE_BUDGET = 8_192;

  // ── Deterministic entropy: ONE source ───────────────────────────────────────
  const det = (seed, fieldPath) => PF.rng(PF.hashStr(`${seed >>> 0}|${fieldPath}`));
  const pick = (seed, fieldPath, list) => list[(det(seed, fieldPath)() * list.length) | 0];

  // ── Text hygiene: sanitize + grapheme-aware caps, Unicode-aware folding ─────
  function sanitize(value) {
    if (typeof value !== "string") return "";
    let text = value.replace(/[\x00-\x1f\x7f]/g, " ");
    // One-pass tag stripping can reassemble a tag from its own fragments
    // ("<scr<b>ipt>" → "<script>"), so strip to a fixpoint FIRST — before the
    // markdown pass eats the ">" characters the tag regex needs to match…
    let previous;
    do {
      previous = text;
      text = text.replace(/<[^>]*>/g, "");
    } while (text !== previous);
    // …then drop the markdown set and ANY surviving angle bracket. Brief prose
    // has no legitimate use for them, and zero brackets in the output means no
    // tag fragment can ever survive (CodeQL js/incomplete-multi-character-sanitization).
    return text
      .replace(/[`*_~#>|<]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  const segmenter =
    typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
  function graphemes(value) {
    if (segmenter) return [...segmenter.segment(value)].map((s) => s.segment);
    return [...value];
  }
  function capText(value, max, { wholeSentence = false } = {}) {
    const clean = sanitize(value);
    const parts = graphemes(clean);
    if (parts.length <= max) return clean;
    if (wholeSentence) return ""; // a clause-losing cut of a hook is worse than none
    const cut = parts.slice(0, max).join("");
    const lastSpace = cut.lastIndexOf(" ");
    return (lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut).trim();
  }
  const fold = (value) =>
    sanitize(value).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

  // ── Enum folding ────────────────────────────────────────────────────────────
  function foldEnum(value, list, fallback) {
    if (typeof value !== "string") return fallback;
    const folded = fold(value);
    return list.find((entry) => entry === folded) ?? fallback;
  }
  /** scale may arrive as a POPULATION NUMBER (the most-observed weak-model slip). */
  function foldScale(value, repairs) {
    if (typeof value === "number" && Number.isFinite(value)) {
      const bucket =
        value < 8 ? "outpost" : value < 20 ? "hamlet" : value < 60 ? "village" : value < 200 ? "town" : "city";
      repairs.push(`scale: bucketed number ${value} -> ${bucket}`);
      return bucket;
    }
    return foldEnum(value, Object.keys(SCALES), "village");
  }

  /** Arrays may arrive as objects keyed by id — a common shape without provider
   *  json_schema. Object.values() BEFORE the array check saves the whole list. */
  function asArray(value) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") return Object.values(value);
    return [];
  }

  // ── validate(): the repair passes; runs ONCE, seals the brief ───────────────
  function validate(raw, { theme: rawTheme, seed }) {
    const repairs = [];
    // Theme whitelist: lexicon lookups use bracket access, so a hostile theme
    // string (a prototype key) must never reach them. The wizard's theme is
    // still authoritative — an unknown one just resolves to the default.
    const theme = Object.prototype.hasOwnProperty.call(DEFAULT_BRIEFS, rawTheme) ? rawTheme : "cozy-village";
    const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    if (src !== raw) repairs.push("transport: non-object root replaced");

    // Pass 2 — scalars.
    const scale = foldScale(src.scale, repairs);
    const brief = {
      briefVersion: VERSION,
      theme, // ALWAYS the wizard's theme; the model's echo is discarded unconditionally.
      scale,
      surround: foldEnum(src.surround, SURROUNDS, pick(seed, "surround", SURROUNDS)),
      prosperity: foldEnum(src.prosperity, PROSPERITY, "modest"),
      name: capText(src.name, 24) || pick(seed, "name", DEFAULT_NAMES[theme] || DEFAULT_NAMES["cozy-village"]),
      flavor: capText(src.flavor, 140),
      // A clause-losing cut of the hook is worse than none (§4.2): over-length
      // degrades to empty rather than shipping half a sentence.
      situation: capText(src.situation, 240, { wholeSentence: true }),
      features: [],
      places: [],
      cast: [],
      backgroundPopulation: 0,
    };
    const population = Number(src.backgroundPopulation);
    brief.backgroundPopulation = Number.isFinite(population) ? Math.max(0, Math.min(500, Math.round(population))) : 0;

    // Pass 3 — zones. Item-level drop: an unknown tag drops the WHOLE feature.
    // The cap applies to KEPT items (a leading run of junk must not discard
    // the valid features behind it — the places loop's semantics).
    const featureRoom = Math.min(CAPS.features, FEATURE_ROOM[brief.scale] ?? CAPS.features);
    for (const item of asArray(src.features)) {
      if (brief.features.length >= featureRoom) {
        // SAID OUT LOUD. Everything else in this pass records what it dropped
        // and why; a rank running out of ground is a better reason than most,
        // and the whole point of the cap is that a settlement stops PROMISING
        // what it cannot hold. Losing the promise silently would just move the
        // silence one layer up.
        repairs.push(`features: ${brief.scale} has room for ${featureRoom}; dropped the rest`);
        break;
      }
      const tag = foldEnum(item?.tag, FEATURE_TAGS, null);
      if (!tag || !SETTLEMENT_TAGS.has(tag)) {
        repairs.push(`features: dropped item with tag ${JSON.stringify(item?.tag ?? null)}`);
        continue;
      }
      brief.features.push({ tag, name: capText(item?.name, 24) || FEATURE_LABELS[tag] });
    }
    // Diversity floor (§4.6): no tag may occupy more than two of the kept
    // slots; the surplus re-rolls from the remaining settlement vocabulary.
    {
      const byTag = new Map();
      for (const feature of brief.features) byTag.set(feature.tag, (byTag.get(feature.tag) ?? 0) + 1);
      let rerollIndex = 0;
      for (const feature of brief.features) {
        if ((byTag.get(feature.tag) ?? 0) <= 2) continue;
        const alternatives = [...SETTLEMENT_TAGS].filter((tag) => (byTag.get(tag) ?? 0) === 0);
        if (alternatives.length === 0) break;
        byTag.set(feature.tag, byTag.get(feature.tag) - 1);
        const replacement = pick(seed, `feature-dedupe-${rerollIndex++}`, alternatives);
        repairs.push(`features: tag ${feature.tag} over-represented -> ${replacement}`);
        feature.tag = replacement;
        feature.name = FEATURE_LABELS[replacement];
        byTag.set(replacement, 1);
      }
    }

    const usedNames = new Set(); // folded names, for label dedupe
    const dedupeName = (name, fieldPath) => {
      // The result must ITSELF be unique: a suffix can collide with a literal
      // later name, and a duplicate display name collapses two ordinal ids into
      // one at compile — the misbinding §1 forbids. Loop the suffixes, then
      // fall to ordinals, and always register the final label.
      let candidate = name;
      let attempt = 0;
      while (usedNames.has(fold(candidate))) {
        const suffix =
          attempt < DEDUPE_SUFFIXES.length
            ? pick(seed, `${fieldPath}-dedupe-${attempt}`, DEDUPE_SUFFIXES)
            : String(attempt - DEDUPE_SUFFIXES.length + 2);
        candidate = `${name} ${suffix}`;
        attempt++;
      }
      if (candidate !== name)
        repairs.push(`${fieldPath}: duplicate name ${JSON.stringify(name)} -> ${JSON.stringify(candidate)}`);
      usedNames.add(fold(candidate));
      return candidate;
    };
    usedNames.add(fold(brief.name));

    let wildsCount = 0;
    let hallCount = 0;
    let gatheringCount = 0;
    let sanctuaryCount = 0;
    const placeRoom = Math.min(CAPS.places, PLACE_ROOM[brief.scale] ?? CAPS.places);
    for (const item of asArray(src.places)) {
      if (brief.places.length >= placeRoom) {
        repairs.push(`places: ${brief.scale} has room for ${placeRoom}; dropped the rest`);
        break;
      }
      const kind = foldEnum(item?.kind, PLACE_KINDS, null);
      if (!kind) {
        repairs.push(`places: dropped item with kind ${JSON.stringify(item?.kind ?? null)}`);
        continue;
      }
      if (kind === "wilds" && wildsCount >= CAPS.wilds) continue;
      if (kind === "hall" && hallCount >= CAPS.hall) continue;
      if (kind === "gathering" && gatheringCount >= CAPS.gathering) continue;
      if (kind === "sanctuary" && sanctuaryCount >= CAPS.sanctuary) continue;
      if (kind === "wilds") wildsCount++;
      if (kind === "hall") hallCount++;
      if (kind === "gathering") gatheringCount++;
      if (kind === "sanctuary") sanctuaryCount++;
      const name = dedupeName(capText(item?.name, 24) || PLACE_LABELS[kind], `places[${brief.places.length}]`);
      const place = { kind, name, flavor: capText(item?.flavor, 120) };
      if (kind === "wilds") {
        place.features = [];
        // Same kept-items rule as the settlement loop: the cap counts what we
        // KEEP, so a leading run of junk cannot discard valid features behind it.
        for (const feature of asArray(item?.features)) {
          if (place.features.length >= 3) break;
          const tag = foldEnum(feature?.tag, FEATURE_TAGS, null);
          if (!tag) continue;
          place.features.push({ tag, name: capText(feature?.name, 24) || FEATURE_LABELS[tag] });
        }
      }
      brief.places.push(place);
    }

    // §4.3: a host with no gathering place synthesizes AT MOST ONE interior
    // named from the host — the player must be able to walk into the inn.
    //
    // Run TWICE, against two different casts, because §4.3 is a post-condition on
    // the SEALED cast and this call can only see the model's draft. The raw cast
    // is not the sealed one: pass 6's quality floor tops up from STOCK, and every
    // stock roster leads with a `host`. So the brief that needs the synthesis most
    // — one whose cast failed validation outright — was the one brief that never
    // got it, and the compiler builds the common room from the gathering PLACE (a
    // `host` in the cast alone binds to nothing). Measured on a live playtest: a
    // colony compiled fifteen zones of "X's home" plus a farm, with a keeper who
    // had nowhere to keep and a berth nobody could rent. This call stays where it
    // is anyway, one pass ahead of the cast, so a model that named a host CAN
    // still resolve a `home` at the interior it just earned.
    const gatheringForHost = (people) => {
      if (brief.places.some((p) => p.kind === "gathering")) return;
      if (brief.places.length >= placeRoom) return;
      const host = people.find((item) => foldEnum(item?.kind ?? item?.role, CAST_KINDS, null) === "host");
      // The theme's own word for its common room. `${hostName}'s` alone reads as
      // one more house on the row — it stood in a street of "Rook's home" and
      // "Fen's home" and the player could not tell which door was the inn. Both
      // default briefs already carry the idiom (the Amber Hearth INN, the Meridian
      // CANTINA); the host's name is budgeted so `${name}'s ${noun}` still fits the
      // 24 characters the schema asks a model for — "'s " is three of them.
      const noun = GATHERING_NOUNS[theme] || GATHERING_NOUNS["cozy-village"];
      const hostName = host ? capText(host.name, Math.max(6, 24 - 3 - noun.length)) : "";
      if (!hostName) return;
      brief.places.push({
        kind: "gathering",
        name: dedupeName(`${hostName}'s ${noun}`, "places-host"),
        flavor: "",
      });
      repairs.push(`places: synthesized a gathering interior for host ${hostName}`);
    };
    const rawCast = asArray(src.cast);
    gatheringForHost(rawCast);

    // Pass 4 — cast. Over the cap, the leader survives (§4.4): hoist the first
    // leader to the front before truncating by original order.
    const zoneNames = [brief.name, ...brief.places.map((p) => p.name)];
    const zoneFolds = new Map(zoneNames.map((n) => [fold(n), n]));
    const leaderIndex = rawCast.findIndex((item) => foldEnum(item?.kind ?? item?.role, CAST_KINDS, null) === "leader");
    if (leaderIndex >= CAPS.castMax) {
      rawCast.unshift(rawCast.splice(leaderIndex, 1)[0]);
      repairs.push("cast: leader hoisted ahead of the cap");
    }
    for (const item of rawCast) {
      if (brief.cast.length >= CAPS.castMax) {
        repairs.push(`cast: over ${CAPS.castMax}, dropped the rest`);
        break;
      }
      const name = capText(item?.name, 24);
      if (!name) continue;
      const kind = foldEnum(item?.kind ?? item?.role, CAST_KINDS, "folk");
      const homeRaw = capText(item?.home, 24);
      // Resolution: exact -> folded -> root. NO substring matching (a guessed
      // binding is forever).
      let home = zoneNames.includes(homeRaw) ? homeRaw : (zoneFolds.get(fold(homeRaw)) ?? null);
      if (!home) {
        if (homeRaw) repairs.push(`cast[${brief.cast.length}].home: unresolved ${JSON.stringify(homeRaw)} -> root`);
        home = brief.name;
      }
      // WORKPLACE — where the working day is spent, when OWNERSHIP cannot say.
      // Ownership answers it for a smith with a forge, but it is one building per
      // person and one person per building, so it can never place a school's second
      // teacher, a market's fourth seller, or a shop assistant.
      //
      // Same exact -> folded resolution as `home`, and no substring matching for the
      // same reason: a guessed binding is forever.
      //
      // Unresolved falls to NULL, not to the root the way `home` does. "Works at the
      // settlement" says nothing a wander box could be built from, and a null
      // workplace IS every brief that has ever compiled — so the derivation in
      // 20-world runs exactly as before for anyone who does not name one.
      const workplaceRaw = capText(item?.workplace, 24);
      const workplace = zoneNames.includes(workplaceRaw) ? workplaceRaw : (zoneFolds.get(fold(workplaceRaw)) ?? null);
      if (workplaceRaw && !workplace)
        repairs.push(`cast[${brief.cast.length}].workplace: unresolved ${JSON.stringify(workplaceRaw)} -> none`);
      const householdNumber = Number(item?.household);
      brief.cast.push({
        name: dedupeName(name, `cast[${brief.cast.length}]`),
        role: capText(item?.role, 24) || KIND_LABELS[kind],
        kind,
        tint: foldEnum(
          item?.tint,
          Object.keys(TINTS),
          pick(seed, `cast-tint-${brief.cast.length}`, Object.keys(TINTS)),
        ),
        home,
        ...(workplace ? { workplace } : {}),
        household: Number.isFinite(householdNumber)
          ? Math.max(1, Math.min(CAPS.household, Math.round(householdNumber)))
          : 1,
        persona: capText(item?.persona ?? item?.flavor, 100),
        standing: foldEnum(item?.standing, STANDING, "resident"),
      });
    }

    // Pass 5 for the schema layer is compile-time (building arithmetic lives in
    // the compiler; see docs/brief-schema.md §4.5). Pass 6 — quality floors for
    // valid-but-degenerate briefs. Every top-up derives from the seed.
    if (brief.cast.length < CAPS.castMin) {
      const roster = STOCK_CAST[theme] || STOCK_CAST["cozy-village"];
      const offset = (det(seed, "cast-topup")() * roster.length) | 0;
      while (brief.cast.length < CAPS.castMin) {
        const stock = roster[(offset + brief.cast.length) % roster.length];
        brief.cast.push({
          ...stock,
          name: dedupeName(stock.name, `cast-topup[${brief.cast.length}]`),
          home: brief.name,
          household: brief.cast.length + 1,
          standing: stock.standing ?? "resident",
        });
        repairs.push(`cast: floor top-up ${stock.name}`);
      }
    }
    const households = new Set(brief.cast.map((c) => c.household));
    if (households.size < 2 && brief.cast.length >= 2) {
      // All-in-one-roof is the classic weak-model shape: split by seed.
      const splitAt = 1 + ((det(seed, "household-split")() * (brief.cast.length - 1)) | 0);
      for (let i = splitAt; i < brief.cast.length; i++) brief.cast[i].household = 2;
      repairs.push("cast: single household split into two");
    }
    // The oversized-household split is GONE. It bounded how many people could
    // share one number, using the same constant that bounds which numbers exist —
    // and a group is no longer bounded at all, because ten unrelated lodgers under
    // one roof is a thing a brief has to be able to say.
    //
    // It also shipped a live contract violation. `next` escaped its own cap by
    // `(next % (CAPS.household * 2)) + 1`, so the pass sealed household numbers
    // ABOVE the schema's own maximum: measured at 263 members over 400 seeds with
    // seven kin and three singletons. And it wrote into `byHousehold` while
    // iterating that same Map. Deleting the pass retires both.
    const tints = new Set(brief.cast.map((c) => c.tint));
    if (tints.size < Math.min(3, brief.cast.length)) {
      const keys = Object.keys(TINTS);
      const start = (det(seed, "tint-rotate")() * keys.length) | 0;
      brief.cast.forEach((member, index) => {
        member.tint = keys[(start + index) % keys.length];
      });
      repairs.push("cast: tints rotated for legibility");
    }
    if (brief.places.length === 0) {
      brief.places.push({
        kind: "wilds",
        name: dedupeName(pick(seed, "wilds-topup", WILDS_NAMES[theme] || WILDS_NAMES["cozy-village"]), "places-topup"),
        flavor: "",
        features: [{ tag: "landmark-stone", name: FEATURE_LABELS["landmark-stone"] }],
      });
      repairs.push("places: floor top-up wilds zone");
    }
    // §4.3 again, against the cast that actually SEALED — see gatheringForHost.
    // Last of the floors on purpose: the wilds top-up answers "this settlement has
    // no named place at all", which is a different lack, and running ahead of it
    // would silently spend that floor and leave a colony with an inn and no
    // outside. So a TOP-UPPED host gets both floors. (The pass-3 call is the one
    // path that still spends the wilds floor: a model host with zero surviving
    // places seals [gathering] and no wilds — deliberate, because that model DID
    // name a place through its host, and the floor answers namelessness, not a
    // missing outdoors.)
    gatheringForHost(brief.cast);

    // Identity (§2): opaque ordinal ids assigned once, stored in the sealed brief.
    const ids = { zones: {}, cast: {}, features: {} };
    ids.zones["z1"] = brief.name;
    brief.places.forEach((place, index) => {
      ids.zones[`z${index + 2}`] = place.name;
    });
    brief.cast.forEach((member, index) => {
      ids.cast[`n${index + 1}`] = member.name;
    });
    let featureOrdinal = 1;
    for (const feature of brief.features) ids.features[`f${featureOrdinal++}`] = feature.name;
    for (const place of brief.places)
      for (const feature of place.features ?? []) ids.features[`f${featureOrdinal++}`] = feature.name;
    brief._ids = ids;

    // Global byte budget: truncate prose in reverse-leverage order. Measured
    // in UTF-8 BYTES — String.length counts UTF-16 code units, which
    // undercounts CJK threefold (emoji fourfold vs two) and would defeat the
    // ≤8KB contract for exactly the non-Latin briefs §2 promises to support.
    const encoder = new TextEncoder();
    const overBudget = () => encoder.encode(JSON.stringify(brief)).length > BRIEF_BYTE_BUDGET;
    if (overBudget()) for (const member of brief.cast) member.persona = "";
    if (overBudget()) for (const place of brief.places) place.flavor = "";
    if (overBudget()) brief.flavor = "";
    if (overBudget()) repairs.push("budget: still over after prose truncation");

    brief._repairs = repairs;
    return brief;
  }

  // ── foldStored(): the READ-side fold (#566) ─────────────────────────────────
  // validate() above is a SEAL-TIME guarantee, and it does not survive the round
  // trip through chat metadata. `PF.save._configBrief` hands the compiler whatever
  // the metadata holds, and ~14 reads inside 20-world's compile() index tables with
  // it: a stored `prosperity: "constructor"` resolved to a function on
  // Object.prototype and cost a town 38 of its 48 zones with nothing said, and a
  // stored `scale` or `place.kind` threw and left build()'s catch-all degrading a
  // compiled settlement to the 3-zone legacy layout behind one console.warn.
  //
  // THIS IS A FOLD, NOT A SECOND validate(), and that is the whole design. Running
  // validate() again on read would re-run the seal-time POLICY passes too — the
  // per-scale feature and place caps, the floors, the dedupe — against a brief
  // sealed under a table that may not be this build's. A newer build that seats
  // four places at hamlet rank writes a brief this one would strip to two on every
  // load, which is the same silent zone loss the seam was opened for, arriving
  // through the front door. Seal time may DROP; read time may only FOLD. Every
  // array length, every name and every id crosses this function untouched, and
  // what changes is only a value the compiler was about to use as a table key.
  //
  // AND IT NEVER TOUCHES THE CALLER'S OBJECT. The brief the save path holds is what
  // PF.player.briefHashOf() stamps a save against, so a byte of it moving under the
  // load path is a SPURIOUS SEVERANCE — rel rows, quests and home quarantined for a
  // world that did not change. Neither hazard is theoretical: validate() reorders
  // `src.cast` in place on the leader-hoist path, and it is not byte-idempotent
  // anyway (a brief that took repairs at seal time re-validates with an empty
  // `_repairs`, and a stock top-up member's key order is not the main path's). So
  // the fold works on a deep copy that lives and dies inside build(), the stored
  // object stays the identity source it has always been, and `_folds` — the
  // read-side counterpart of `_repairs` — rides the copy and is never written back.
  //
  // Where the compiler's readings all agree on a fallback, the fold changes
  // nothing observable: an unknown `tint` was already grey's hue (`?? 210`) and an
  // unknown `tag` was already a plain rect with no painter — measured, those two
  // compile identically folded or not. Everything else MOVES, deliberately.
  // `prosperity` moving is this function's headline (the silent 38-of-48-zone
  // loss above). `place.kind` moves because FURNISH's `|| dwelling` was never the
  // only reading — upperPlan refuses non-household kinds outright and cellarPlan
  // gives them no cellar, so an unfolded unknown compiled to a stunted dwelling,
  // not a dwelling. `surround` and `standing` move to validate's own defaults,
  // which beat a flat ground mix and a person with no rest anchor. In every case
  // the fold's answer is the one seal time would have given, and a value naming
  // something on Object.prototype can no longer pretend to be a table's entry.
  //
  // An ABSENT value stays absent. `?? "resident"` and `|| SCALES.village` are the
  // compiler's reading of a missing field, and folding one in would rewrite a brief
  // sealed before that field existed.
  function foldStored(stored, seed) {
    const brief = JSON.parse(JSON.stringify(stored));
    const folds = [];
    const foldAt = (owner, key, list, fallback, fieldPath) => {
      if (!owner || typeof owner !== "object") return;
      if (!Object.prototype.hasOwnProperty.call(owner, key)) return;
      const was = owner[key];
      if (was === null || was === undefined) return;
      const now = foldEnum(was, list, fallback);
      if (now === was) return;
      owner[key] = now;
      folds.push(`${fieldPath}: ${JSON.stringify(was)} -> ${JSON.stringify(now)}`);
    };
    const foldFeatures = (list, fieldPath) => {
      if (!Array.isArray(list)) return;
      // No default tag exists to fold to, and inventing one would put a feature on
      // the map the brief never asked for. null is what the placement loops already
      // read an unknown tag as (`FEATURE_RECTS[tag] ?? FEATURE_RECT`, `PLACERS[tag]?.`),
      // and the row keeps its name, so the registry can still say what stands there.
      list.forEach((feature, index) => foldAt(feature, "tag", FEATURE_TAGS, null, `${fieldPath}[${index}].tag`));
    };
    // Theme is the one fold whose vocabulary is not this module's to state.
    // compile() spends `brief.theme` on a single read — `PF.art.setTheme()`
    // (20-world) — so 10-art's table IS the whitelist, and it is asked for it at
    // fold time rather than copied at load time. A copy would drift the moment a
    // theme ships with art but no worked example here, and folding an art-only
    // theme to cozy-village would replace a VALID value one screen before
    // setTheme() would have accepted it: the future-theme divergence class the
    // roadmap's swamp-biome prerequisites already track. No art module, no
    // authority and so no fold — which is what 20-world's own `PF.art.setTheme ?`
    // guard does with the same absence.
    const themeIds = PF.art?.themeIds?.();
    if (themeIds) foldAt(brief, "theme", themeIds, "cozy-village", "theme");
    foldAt(brief, "scale", Object.keys(SCALES), "village", "scale");
    foldAt(brief, "surround", SURROUNDS, pick(seed, "surround", SURROUNDS), "surround");
    foldAt(brief, "prosperity", PROSPERITY, "modest", "prosperity");
    foldFeatures(brief.features, "features");
    if (Array.isArray(brief.places))
      brief.places.forEach((place, index) => {
        foldAt(place, "kind", PLACE_KINDS, "dwelling", `places[${index}].kind`);
        foldFeatures(place?.features, `places[${index}].features`);
      });
    if (Array.isArray(brief.cast))
      brief.cast.forEach((member, index) => {
        foldAt(member, "kind", CAST_KINDS, "folk", `cast[${index}].kind`);
        foldAt(member, "tint", Object.keys(TINTS), "grey", `cast[${index}].tint`);
        foldAt(member, "standing", STANDING, "resident", `cast[${index}].standing`);
      });
    brief._folds = folds;
    return brief;
  }

  // ── defaults(): the themed brief a world compiles to when nobody wrote one ──
  // NOT a failure path any more (see generate()'s design revision): no failure
  // seals anything. What it remains is the schema's own worked example per theme —
  // the fixture the compiler's invariants are driven through, and the answer for
  // any future caller that needs a brief without a generation call behind it.
  function defaults(theme, seed) {
    // PF.own, because this read happens BEFORE validate() applies the same guard
    // one screen up — and it is the parameter of an exported function, so the
    // word arrives from wherever the caller got it. Bare, `defaults("__proto__")`
    // handed Object.prototype to validate() as the worked example: an object, so
    // it survived the transport check, and every field then floored to nothing.
    // The theme came back cozy-village and the brief came back EMPTY, which is
    // the fallback on this line reading as if it had fired when it had not.
    return validate(PF.own(DEFAULT_BRIEFS, theme) || DEFAULT_BRIEFS["cozy-village"], { theme, seed });
  }

  /** Truncation salvage (§4.1/§5): strip fences, take the outermost balanced
   *  JSON object span, parse. Returns the parsed object or null — the caller's
   *  validate() then repairs and floors whatever survived the cut. */
  function salvageText(raw) {
    if (typeof raw !== "string" || !raw.trim()) return null;
    let text = raw.replace(/```[a-z]*\n?/gi, "").trim();
    const start = text.indexOf("{");
    if (start < 0) return null;
    let depth = 0;
    let end = -1;
    let inString = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (ch === "\\") i++;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    // A cut-off document has no balanced end: close whatever is open after
    // trimming a trailing partial element (back to the last , { [ or complete
    // value) so complete array elements survive the amputation.
    let candidate;
    if (end >= 0) {
      candidate = text.slice(start, end + 1);
    } else {
      let body = text.slice(start).replace(/,[^,{}[\]]*$/, "");
      const opens = [];
      inString = false;
      for (let i = 0; i < body.length; i++) {
        const ch = body[i];
        if (inString) {
          if (ch === "\\") i++;
          else if (ch === '"') inString = false;
          continue;
        }
        if (ch === '"') inString = true;
        else if (ch === "{" || ch === "[") opens.push(ch);
        else if (ch === "}" || ch === "]") opens.pop();
      }
      if (inString) body += '"';
      candidate =
        body +
        opens
          .reverse()
          .map((ch) => (ch === "{" ? "}" : "]"))
          .join("");
    }
    try {
      const parsed = JSON.parse(candidate);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  /** The route caps userContent at 8,000 chars and 400s past it — a hard
   *  contract, so an unbounded wizard Setting must be clamped here or the
   *  most detailed settings would silently forfeit generation (review). */
  const capPreferences = (text) =>
    typeof text === "string" && text.length > 7_800 ? `${text.slice(0, 7_800)}…` : text;

  /** The one #5135 generation call with the §5 failure ladder (amended):
   *  bounded wait; one wait-out on the server's documented-transient 409
   *  chat_busy; one plain re-roll on truncation (the route's maxTokens is
   *  min()-only — "never a raise" — so a numeric override could only shrink
   *  the budget); salvage of the LONGEST truncated raw seen across attempts.
   *
   *  Returns a SEALED brief for the two outcomes that produce a REAL one —
   *  success and salvage — and NULL for every failure, so the caller leaves the
   *  chat unsealed and the next visit simply tries again.
   *
   *  DESIGN REVISION (this release, maintainer ruling #7 / plan §Q3b). The 0.4.0
   *  ladder sealed THEMED DEFAULTS on a deterministic/paid failure — 400 contract,
   *  422 provider/parse — on the reasoning that a paid call per visit is worse
   *  than the default world. That decision predates the loading gate and does not
   *  survive it: back then a default world was what the player was already walking
   *  in, so sealing it changed nothing they could see. Now the gate holds play
   *  precisely so that nobody invests in a world that is going to be discarded,
   *  and the README states the contract plainly — "a generation failure is a retry
   *  screen; nothing is stored". Sealing defaults on a 400 makes that sentence
   *  false in the one case a player cannot undo: the key is written, the chat is
   *  permanently a themed default, and the three paragraphs of setting they wrote
   *  are gone with no way back. The paid-call worry is also nearly hypothetical
   *  now — capPreferences clamps to 7,800 against the route's 8,000 cap, so the
   *  reachable 400 is a contract bug rather than a long setting.
   *
   *  `onFailure(kind)` reports WHY, once, so the retry screen can say something
   *  truer than "something went wrong" — a deterministic refusal and a busy engine
   *  want different sentences from the player. Kinds: "unavailable" (404/409/429/
   *  5xx), "refused" (400/422 with nothing salvageable), "network", "timeout". */
  async function generate(
    chatId,
    { theme, seed, preferences, onProgress, onFailure, budgetMs = 90_000, busyWaitMs = Math.min(15_000, budgetMs / 6) },
  ) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), budgetMs);
    try {
      const base = { instructions: guidance(theme), userContent: capPreferences(preferences), schema: schema() };
      let response = await PF.api.postExperienceGeneration(chatId, base, controller.signal);
      if (response.status === 409) {
        // chat_busy ships Retry-After: 15 — wait it out once inside the budget
        // (busyWaitMs is a timer seam so the harness never sleeps for real).
        await new Promise((resolve) => setTimeout(resolve, busyWaitMs));
        if (!controller.signal.aborted)
          response = await PF.api.postExperienceGeneration(chatId, base, controller.signal);
      }
      const rawOf = (r) =>
        r.status === 422 && r.body?.truncated && typeof r.body.raw === "string" ? r.body.raw : null;
      let bestRaw = rawOf(response);
      if (response.status === 422 && response.body?.truncated) {
        onProgress?.("Generating your world… (one more try)");
        response = await PF.api.postExperienceGeneration(chatId, base, controller.signal);
        const retryRaw = rawOf(response);
        if (retryRaw && (!bestRaw || retryRaw.length > bestRaw.length)) bestRaw = retryRaw;
      }
      if (
        response.status === 200 &&
        response.body?.ok &&
        response.body.data &&
        typeof response.body.data === "object"
      ) {
        return validate(response.body.data, { theme, seed });
      }
      if (bestRaw) {
        const salvaged = salvageText(bestRaw);
        if (salvaged) {
          const sealed = validate(salvaged, { theme, seed });
          sealed._repairs.push("transport: salvaged from a truncated response");
          return sealed;
        }
      }
      if (response.status === 404 || response.status === 409 || response.status === 429 || response.status >= 500) {
        console.warn("[pixelforge] world generation unavailable (transient); retrying next visit", response.status);
        onFailure?.("unavailable");
        return null;
      }
      // 400 (contract) and 422 (provider/parse, nothing salvageable). Deterministic
      // — trying again probably gets the same answer — but STILL a retry screen and
      // still nothing stored, because the alternative is deciding a themed default
      // world on the player's behalf and writing it down where they cannot undo it.
      console.warn(
        "[pixelforge] world generation was refused; the chat stays unsealed",
        response.status,
        response.body?.error ?? null,
      );
      onFailure?.("refused");
      return null;
    } catch (err) {
      // Network trouble and the budget timeout are both transient — leave the
      // chat unsealed rather than freezing the default world in forever.
      if (!controller.signal.aborted) {
        console.warn("[pixelforge] world generation failed (network); retrying next visit", err);
        onFailure?.("network");
      } else {
        console.warn("[pixelforge] world generation timed out; retrying next visit");
        onFailure?.("timeout");
      }
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  // ── guidance(): the exact text that ships in the one call ───────────────────
  function guidance(theme) {
    return [
      "You are generating a WORLD BRIEF for a walkable pixel-art RPG. You decide WHAT exists;",
      "a deterministic generator decides where every tile goes. Reply with ONLY a JSON object.",
      "",
      `The visual theme is "${theme}" and it is AUTHORITATIVE: dress the player's setting text to fit it.`,
      "",
      "Fields (all limits are hard):",
      `- scale: one of ${Object.keys(SCALES).join(" | ")} — the settlement's size class. Never a number.`,
      `- surround: one of ${SURROUNDS.join(" | ")}.`,
      `- prosperity: one of ${PROSPERITY.join(" | ")}.`,
      "- name: the settlement's name, <=24 characters.",
      "- flavor: ONE sentence of arrival atmosphere, <=140 characters.",
      "- situation: ONE sentence, <=240 characters — the unresolved thing happening right now.",
      "  Name a cause and a person, not a mood.",
      `- features: 0-4 of {tag, name} placed in the settlement. tag from: ${[...SETTLEMENT_TAGS].join(", ")}.`,
      "  name <=24 chars — becomes a map location.",
      `- places: 0-4 additional zones of {kind, name, flavor}. kind from: ${PLACE_KINDS.join(" | ")}.`,
      "  At most 2 wilds, 1 hall, 1 gathering, 1 sanctuary. Home an elder at a sanctuary to give it a keeper. A sanctuary is the settlement's",
      "  church, temple or memorial hall — it is built taller than the houses. wilds may carry",
      "  0-3 features (water-crossing and dense-growth are wilds-only). flavor: ONE sentence <=120 chars.",
      "- cast: 4-10 story-relevant people of {name, role, kind, tint, home, household, persona, standing}.",
      `  kind (machine field) from: ${CAST_KINDS.join(" | ")}. role: <=24 chars free text (their title).`,
      `  tint from: ${Object.keys(TINTS).join(" | ")}. home: the NAME of the zone they live in.`,
      "  workplace (optional): the NAME of the zone they work in, when it is not the one they",
      "  live in and they do not run it themselves — a second teacher at the school, a shop",
      "  assistant, one of several sellers at a market. Omit it for anyone who works at home.",
      "  household: 1-10 — people sharing a number share a roof. Buildings are derived from",
      "  households, so do NOT give everyone their own number unless they truly live apart.",
      "  Unrelated people CAN share one: lodgers at a boarding house, sisters at a convent,",
      "  recruits in a barracks are all one number, and there is no limit on how many.",
      "  persona: <=100 chars — what they want, and what they are hiding.",
      `  standing (optional, default resident): one of ${STANDING.join(" | ")}. transient = passing`,
      "  through; fringe = lives apart at the edges (hermit, outcast, refugee); destitute = no home.",
      "  Keep most people resident; a crossroads or waystation may have many transients.",
      "- backgroundPopulation: total inhabitants including the cast (0-500). This is narrative",
      "  texture for the map description — it never creates buildings.",
      "",
      "Only the cast, features, and places you name will exist. Keep names in the player's language.",
    ].join("\n");
  }

  function schema() {
    const text = (maxLength) => ({ type: "string", maxLength });
    const featureItem = {
      type: "object",
      properties: { tag: { type: "string", enum: FEATURE_TAGS }, name: text(24) },
      required: ["tag", "name"],
    };
    return {
      type: "object",
      properties: {
        scale: { type: "string", enum: Object.keys(SCALES) },
        surround: { type: "string", enum: SURROUNDS },
        prosperity: { type: "string", enum: PROSPERITY },
        name: text(24),
        flavor: text(140),
        situation: text(240),
        features: { type: "array", maxItems: 4, items: featureItem },
        places: {
          type: "array",
          maxItems: 4,
          items: {
            type: "object",
            properties: {
              kind: { type: "string", enum: PLACE_KINDS },
              name: text(24),
              flavor: text(120),
              features: { type: "array", maxItems: 3, items: featureItem },
            },
            required: ["kind", "name"],
          },
        },
        cast: {
          type: "array",
          minItems: 4,
          maxItems: 10,
          items: {
            type: "object",
            properties: {
              name: text(24),
              role: text(24),
              kind: { type: "string", enum: CAST_KINDS },
              tint: { type: "string", enum: Object.keys(TINTS) },
              home: text(24),
              workplace: text(24),
              household: { type: "integer", minimum: 1, maximum: 10 },
              persona: text(100),
              standing: { type: "string", enum: STANDING },
            },
            required: ["name", "kind", "tint", "home", "household"],
          },
        },
        backgroundPopulation: { type: "integer", minimum: 0, maximum: 500 },
      },
      required: ["scale", "name", "cast"],
    };
  }

  // ── Theme lexicon (the repair layer's per-theme content — §weakness 6) ──────
  const FEATURE_LABELS = {
    "water-feature": "The Pool",
    "crop-plots": "The Plots",
    "market-stalls": "The Stalls",
    workyard: "The Yard",
    "landmark-stone": "The Old Marker",
    shrine: "The Shrine",
    "water-crossing": "The Crossing",
    "dense-growth": "The Thicket",
    ruin: "The Ruin",
    lookout: "The Lookout",
  };
  // What each theme calls its common room, for the §4.3 host synthesis. Read off
  // the default briefs, which name theirs in full: "The Amber Hearth Inn" and
  // "The Meridian Cantina". PLACE_LABELS is the generic fallback for a place the
  // model named nothing at all; this is the possessive a person's own house of
  // hospitality takes.
  const GATHERING_NOUNS = { "cozy-village": "Inn", "sci-fi-colony": "Cantina" };
  const PLACE_LABELS = {
    gathering: "The Hearth",
    workshop: "The Works",
    hall: "The Hall",
    sanctuary: "The Sanctuary",
    dwelling: "The House",
    wilds: "The Wilds",
  };
  const KIND_LABELS = {
    leader: "leader",
    host: "keeper",
    grower: "grower",
    maker: "artisan",
    merchant: "trader",
    guard: "watch",
    healer: "healer",
    scholar: "archivist",
    elder: "elder",
    child: "youngster",
    wanderer: "wanderer",
    folk: "resident",
  };
  const DEDUPE_SUFFIXES = ["Upper", "Lower", "Old", "New", "Far", "Near"];
  const DEFAULT_NAMES = {
    "cozy-village": ["Hearthvale", "Mossbrook", "Emberfield"],
    "sci-fi-colony": ["Meridian Base", "Anchorage Nine", "Halcyon Point"],
  };
  const WILDS_NAMES = {
    "cozy-village": ["The Whisperwood", "The Fallow Reach"],
    "sci-fi-colony": ["The Mast Field", "The Outer Flats"],
  };
  const STOCK_CAST = {
    "cozy-village": [
      { name: "Mira", role: "innkeeper", kind: "host", tint: "rose", persona: "" },
      { name: "Tam", role: "farmer", kind: "grower", tint: "green", persona: "" },
      { name: "Rook", role: "guard", kind: "guard", tint: "blue", persona: "" },
      { name: "Fen", role: "forager", kind: "wanderer", tint: "teal", persona: "" },
    ],
    "sci-fi-colony": [
      { name: "Mira", role: "cantina keeper", kind: "host", tint: "rose", persona: "" },
      { name: "Tam", role: "hydroponics lead", kind: "grower", tint: "green", persona: "" },
      { name: "Rook", role: "pad marshal", kind: "guard", tint: "blue", persona: "" },
      { name: "Fen", role: "salvage scout", kind: "wanderer", tint: "teal", persona: "" },
    ],
  };
  const DEFAULT_BRIEFS = {
    "cozy-village": {
      scale: "village",
      surround: "woods",
      prosperity: "modest",
      name: "Hearthvale",
      flavor: "A cozy closed valley where the roads all end at somebody's gate.",
      situation: "",
      features: [
        { tag: "water-feature", name: "The Village Pond" },
        { tag: "crop-plots", name: "Tam's Rows" },
      ],
      places: [
        { kind: "gathering", name: "The Amber Hearth Inn", flavor: "Low beams, warm bread, long memories." },
        {
          kind: "wilds",
          name: "The Whisperwood",
          flavor: "Dense trees, a shallow stream, an old stone.",
          features: [
            { tag: "water-crossing", name: "The Stepping Stones" },
            { tag: "landmark-stone", name: "The Old Marker" },
          ],
        },
      ],
      cast: [
        {
          name: "Mira",
          role: "innkeeper",
          kind: "host",
          tint: "rose",
          home: "The Amber Hearth Inn",
          household: 1,
          persona: "",
        },
        { name: "Tam", role: "farmer", kind: "grower", tint: "green", home: "Hearthvale", household: 2, persona: "" },
        { name: "Rook", role: "guard", kind: "guard", tint: "blue", home: "Hearthvale", household: 3, persona: "" },
        {
          name: "Fen",
          role: "forager",
          kind: "wanderer",
          tint: "teal",
          home: "The Whisperwood",
          household: 4,
          persona: "",
        },
      ],
      backgroundPopulation: 30,
    },
    "sci-fi-colony": {
      scale: "village",
      surround: "barren",
      prosperity: "modest",
      name: "Meridian Base",
      flavor: "A frontier colony under a sealed sky, humming at all hours.",
      situation: "",
      features: [
        { tag: "water-feature", name: "The Coolant Pool" },
        { tag: "crop-plots", name: "The Hydro Bay" },
      ],
      places: [
        { kind: "gathering", name: "The Meridian Cantina", flavor: "Recycled air, real coffee, questionable cards." },
        {
          kind: "wilds",
          name: "The Mast Field",
          flavor: "Antenna rows marching into the dust.",
          features: [
            { tag: "water-crossing", name: "The Conduit Bridge" },
            { tag: "landmark-stone", name: "The Beacon" },
          ],
        },
      ],
      cast: [
        {
          name: "Mira",
          role: "cantina keeper",
          kind: "host",
          tint: "rose",
          home: "The Meridian Cantina",
          household: 1,
          persona: "",
        },
        {
          name: "Tam",
          role: "hydroponics lead",
          kind: "grower",
          tint: "green",
          home: "Meridian Base",
          household: 2,
          persona: "",
        },
        {
          name: "Rook",
          role: "pad marshal",
          kind: "guard",
          tint: "blue",
          home: "Meridian Base",
          household: 3,
          persona: "",
        },
        {
          name: "Fen",
          role: "salvage scout",
          kind: "wanderer",
          tint: "teal",
          home: "The Mast Field",
          household: 4,
          persona: "",
        },
      ],
      backgroundPopulation: 24,
    },
  };

  return {
    VERSION,
    SCALES,
    TINTS,
    FEATURE_TAGS,
    CAPS,
    validate,
    foldStored,
    defaults,
    guidance,
    schema,
    generate,
    salvageText,
  };
})();

// ===== 20-world.js =====
// ── World generation ──────────────────────────────────────────────────────────
// Deterministic seed → zones. A zone is a tile grid with three layers (ground,
// object, overhead), a solidity map, portals, and NPCs. No host GameMap types
// are used — the world model is wholly package-owned (exploration R09/R10).
PF.world = (() => {
  const T = PF.TILE;

  /** The spatialLocationId → zoneId table, NULL-PROTOTYPE (#567).
   *
   *  Every key in it belongs to the HOST — a World Maps location id, authored by
   *  hand or by the wizard's map instructions, never written by this package —
   *  and on a plain `{}` the word "__proto__" is not a key at all. Writing a
   *  string there is a silent no-op (the prototype setter takes an object or
   *  null and drops the rest) and reading it back hands out Object.prototype.
   *  Both halves were reachable and neither failed loudly: 50-spatial's seeding
   *  write vanished, so its emptiness test re-fired and re-dirtied on every
   *  refresh forever while the world never gained a root to export under; and
   *  55-maps-export's adoption read came back Object.prototype, which is neither
   *  undefined nor the zone, so the export refused its own adoption and posted a
   *  TWIN of the location — through a route with no delete, onto a real map.
   *
   *  Fixed HERE rather than at the two sites because this is the one place the
   *  table is made: 60-save restores a save's bindings by copying entries INTO
   *  this object, so no plain map can arrive from stored state, and every read
   *  and write of it downstream (both files above, plus 70-hud's chip test) is
   *  covered by the one change. `Object.keys`, `delete` and `JSON.stringify` all
   *  behave identically, so an honest id is byte-identical either side of it. */
  const newBindings = () => Object.create(null);

  function makeZone(id, name, w, h, groundFill) {
    return {
      id,
      name,
      w,
      h,
      ground: new Array(w * h).fill(groundFill),
      object: new Array(w * h).fill(null), // drawn over ground, below actors
      overhead: new Array(w * h).fill(null), // drawn over actors (roofs, canopies)
      solid: new Uint8Array(w * h),
      portals: [], // {x, y, toZone, toX, toY, label}
      npcs: [],
      spawn: { x: 2, y: 2 },
      spatialLocationId: null, // bound World Maps location, when known
      // Rooms PARTITIONED inside this zone — wall runs with a door, never zones
      // of their own. Zone count is the flagged cost of the release and every
      // zone holds two full-size canvases in the render cache, so a bedroom is
      // walls and a FLOOR is a zone. {purpose, x0, y0, x1, y1, doorX, ...}
      rooms: [],
      // OPEN spans: the common floor, a corridor, the leftover east of a band.
      // Compiler output exactly like `rooms`, and deliberately a SEPARATE list —
      // an open span cannot ride in `rooms`, because three assertions require a
      // door per room record and the reachability sweep resolves one at
      // `(doorX, y1 + 1)`. A span with no door would read as `undefined,NaN`.
      // Also deliberately NOT read by fullZoneBox: an open area IS common floor,
      // and excluding it would move every NPC in every upstairs dwelling.
      areas: [],
      beds: [], // sleeping tiles this zone offers, in claim order
      // World Maps export gate (spec §8). A building is ONE location and its
      // floors are rooms inside it, so a zone that is a room stamps this false
      // and never claims a map row. The locations route is additive with no
      // delete — a row written to a player's real map is permanent — so the
      // gate has to ship with the zone type, never a release later.
      mapExport: true,
      lights: [], // {x, y} warm glow points at night
      // NAMED FEATURES STANDING IN THIS ZONE: {id, tag, name, rect}. The tiles
      // were the only record a feature had, and a tile cannot say which feature
      // it belongs to or what the brief called it — so a consumer asking "what
      // is the player standing beside" had nothing to read. Written by the three
      // sites that paint one: the compiler's placement loops, the wilds
      // builder's `water-crossing` branch (which paints its own stream, so the
      // feature loop skips that tag), and buildLegacy's fixed literals.
      //
      // DERIVED, and that is the whole contract: a world is rebuilt from
      // (seed, theme, brief) on every load, so this list is recomputed and never
      // stored. It appears in no snapshot() key and in no ENVELOPE_KEYS entry,
      // and putting it in either would turn a recomputable list into a save
      // format to migrate. Every zone carries the array, empty or not — an
      // absent one and an empty one read alike right up to the call site that
      // does not guard, and the consumer reads it every walking frame.
      features: [],
    };
  }
  const idx = (z, x, y) => y * z.w + x;
  const put = (z, x, y, layer, tileId, solid) => {
    if (x < 0 || y < 0 || x >= z.w || y >= z.h) return;
    z[layer][idx(z, x, y)] = tileId;
    if (solid !== undefined) z.solid[idx(z, x, y)] = solid ? 1 : 0;
  };
  const fillRect = (z, x0, y0, w, h, layer, tileId, solid) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(z, x, y, layer, tileId, solid);
  };

  // THE GROUND A ROAD IS LAID WITH. Two ids and not one, because a `struggling`
  // settlement scuffs 18% of its road to `dirt` before a single building goes up
  // and a scuffed road is no less a road for it. Deliberately NOT `stone`:
  // paving is also a building's footprint, a workyard, a clearing and a ward
  // square, and a plank decked across one of those is a bridge in the middle of
  // a yard.
  const ROAD_GROUND = new Set(["path", "dirt"]);

  /** Lay water, decking a BRIDGE over whatever road is already standing in it.
   *
   *  The 0.12 ruling, and the whole of it: where a road meets water the road
   *  wins the tiles it is on and the water takes the rest. A bridge is walkable
   *  and drawn over the water, so the crossing survives and the pool is still a
   *  pool — which is what let the water-feature placer stop refusing every
   *  anchor in the wilds that touched the road band (see the wilds loop).
   *
   *  Reads the ground a previous pass painted, so it is order-dependent by
   *  design: roads are laid before features everywhere this is called, and a
   *  caller that watered first and paved after would get plain water. Throw-free
   *  — the read is bounds-guarded, and it has to be for a reason beyond caution:
   *  `idx` wraps an x past the east edge into the NEXT ROW, so an unguarded read
   *  would test a tile on the wrong side of the map. This runs inside build()'s
   *  silent-degrade try/catch, where a throw ships as a legacy world. */
  const waterFill = (z, x0, y0, w, h) => {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const inside = x >= 0 && y >= 0 && x < z.w && y < z.h;
        const road = inside && ROAD_GROUND.has(z.ground[idx(z, x, y)]);
        put(z, x, y, "ground", road ? "bridge" : "water", !road);
      }
    }
  };

  /** A simple gabled building: stone footprint, plaster walls, roof overhead, one door.
   *
   *  `options.facade` (0 = every existing call site) leaves the top N body rows
   *  UNROOFED. Every body row is already solid wall — it was just permanently hidden
   *  under roof overhead, so a building's height read as roofline and nothing else.
   *  Exposing rows turns that height into visible stonework, which is what makes a
   *  church or a keep stand over the houses beside it, and it costs no extra footprint.
   *  `options.facadeWindows` lights the topmost exposed row, so the storey reads as a
   *  storey rather than a blank slab. */
  /** May a roofline be painted over this tile?
   *
   *  Public ground only — the roads and the plaza, recorded as rects when they
   *  are painted so that a prosperity recolour cannot disguise them. Everything
   *  else is verge, and verge is what an eave is for.
   *
   *  It is deliberately no wider than that. Tests for a neighbour's fabric and
   *  for its doorstep were written here first and then MEASURED as dead: a
   *  roofline and the building it would cover arrive in either order, and when
   *  the roof comes first — which is the case that actually happens, since lots
   *  are claimed nearest-the-crossroad first — there is nothing here yet to find.
   *  Both are handled where they work in either order instead, by the arriving
   *  building taking back the sky over its own frontage and its own doorstep.
   *  Removing those two tests changed nothing across 162 and 225 probe worlds. */
  function eaveMayCover(z, x, y) {
    if (x < 0 || y < 0 || x >= z.w || y >= z.h) return false;
    return !z.publicGround?.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  }

  function building(z, x0, y0, w, h, doorOffset, windows, options) {
    // walls occupy the bottom wall row; roof covers the rest as overhead
    const wallY = y0 + h - 1;
    // One roofed body row always survives: the eave is painted relative to the
    // footprint's top, and a facade that ate every row would hang it off nothing.
    const facade = PF.clamp((options?.facade ?? 0) | 0, 0, Math.max(0, h - 2));
    const facadeY = wallY - facade;
    fillRect(z, x0, y0, w, h, "ground", "stone", false);
    for (let x = x0; x < x0 + w; x++) {
      put(z, x, wallY, "object", "wall", true);
      // ...and takes back the sky over its own frontage. A neighbour's roofline
      // may already be lying here: lots are eight rows apart and a body is five
      // tall, so a sanctuary that rises two paints its eave onto `slotY - 4` —
      // exactly this row on the lot above it — before this building exists to
      // object. Measured at 24 wall tiles under a foreign roof across 225 worlds.
      // The building's own roof never covers its wall row (the facade loop stops
      // at `facadeY`), so this can only ever be somebody else's.
      put(z, x, wallY, "overhead", null);
      for (let y = y0; y < wallY; y++) put(z, x, y, "object", "wallStone", true);
      // THE EAVE OVERHANGS THE VERGE, AND NOTHING ELSE. A building's solid body
      // already clears the street, but its roofline is two overhead rows above
      // the footprint, and those rows belong to whatever is already standing in
      // them.
      //
      // Two faults in one line, and the first fix was too narrow to catch the
      // second. The south band starts one row under the crossroad, so a row of
      // houses painted its roofs straight across the main street and a town
      // rendered as one continuous roof with a lane at either end. Testing the
      // GROUND for `path` fixed the modest case and missed two more: a
      // `struggling` settlement scuffs 18% of its road to `dirt` before a single
      // building is laid, and a `thriving` one paves its plaza `stone` —
      // measured, 41 to 99 roofed road tiles per ten seeds at struggling and ten
      // at thriving. And a sanctuary that rises two rows reaches `slotY - 3`,
      // which is the NEXT lot row's door apron: eighteen doorsteps roofed over in
      // seventy-two probe worlds, with whoever lives there standing hidden
      // underneath.
      //
      // So the test is TERRITORY, not tile colour. Overhead composites over
      // actors, so every tile this skips is one a player would otherwise walk
      // under and vanish.
      for (let y = y0 - 2; y < y0; y++) {
        if (!eaveMayCover(z, x, y)) continue;
        put(z, x, y, "overhead", y === y0 - 2 ? "roof" : "roofEdge");
      }
      for (let y = y0; y < facadeY; y++) put(z, x, y, "overhead", "roof");
    }
    for (const wx of windows || []) {
      put(z, x0 + wx, wallY, "object", "window", true);
      z.lights.push({ x: x0 + wx, y: wallY });
    }
    if (facade) {
      for (const wx of options.facadeWindows || []) {
        put(z, x0 + wx, facadeY, "object", "window", true);
        z.lights.push({ x: x0 + wx, y: facadeY });
      }
    }
    const dx = x0 + doorOffset;
    put(z, dx, wallY, "object", "door", false);
    put(z, dx, wallY, "overhead", null);
    // A BUILDING OWNS ITS DOORSTEP. Lots are claimed nearest-the-crossroad first
    // and a named place is claimed before the houses, so a sanctuary rising two
    // rows paints its eave onto the lot row above it long before the dwelling
    // that will stand there exists to object. Clearing on arrival works whichever
    // order the two land in; refusing the paint only works in one, which is why
    // that version of the fix is not the one that survived.
    //
    // The door tile one row up has always been cleared. The step it opens onto —
    // where the household stands to be spoken to, and where overhead composites
    // over them — was not.
    put(z, dx, wallY + 1, "overhead", null);
    return { doorX: dx, doorY: wallY };
  }

  function scatterTrees(z, rnd, count, reserved) {
    for (let i = 0; i < count; i++) {
      const x = 1 + ((rnd() * (z.w - 2)) | 0);
      const y = 2 + ((rnd() * (z.h - 3)) | 0);
      if (z.solid[idx(z, x, y)] || z.object[idx(z, x, y)] || z.ground[idx(z, x, y)] !== "grass") continue;
      // never UNDER a building's roof overhang: the overhang rows are grass and
      // non-solid, so the checks above miss them, but the overhead roof composites
      // over the trunk (a tree that looks eaten by the wall) and the canopy at y-1
      // would punch through the roofline. Guard the overhead layer explicitly.
      const roofHere = z.overhead[idx(z, x, y)];
      const roofAbove = z.overhead[idx(z, x, y - 1)];
      if (roofHere === "roof" || roofHere === "roofEdge" || roofAbove === "roof" || roofAbove === "roofEdge") continue;
      // never near a door or portal exit — a tree there traps the player (review finding)
      if (reserved && reserved.some((r) => Math.abs(r.x - x) <= 1 && Math.abs(r.y - y) <= 2)) continue;
      put(z, x, y, "object", "trunk", true);
      put(z, x, y - 1, "overhead", "canopy");
    }
  }

  /** Close any walkable tile the player could never reach.
   *
   *  A random scatter can ring a square completely — four trunks around one tile
   *  of grass — and what is left is a hole in the map that reads as somewhere you
   *  can go and is not. It is cheaper to close the pockets than to constrain the
   *  scatter, and closing them is right for the pockets a BUILDING makes too.
   *
   *  Marked solid rather than planted: a pocket is by definition adjacent to no
   *  reachable tile, so the player can never walk up to one, and an invisible
   *  wall nobody can touch is safer than a tree that might land under a roofline
   *  or in the middle of a paved yard. */
  function sealPockets(z, from) {
    if (!from) return 0;
    // LOUD, and this is the line that matters most in the function.
    //
    // It used to return 0 here, which reads as caution and is the opposite. A
    // zone whose spawn is solid is never a legal world — the player stands in a
    // wall — and returning quietly meant that zone ALSO shipped with no pocket
    // sealing at all. Measured on a west-hung wilds with a crop plot over its
    // spawn: 711 walkable tiles, 0 of them reachable from the declared spawn,
    // and the reachability invariant silently switched off for the whole zone.
    // The one condition that guarantees a broken world was the one condition
    // that skipped the check for it.
    //
    // The compiler falls back to the legacy world on a throw, so the worst this
    // can do in a player's hands is give them a plain world instead of their
    // brief. In the harness it is a red line with a name.
    if (z.solid[idx(z, from.x, from.y)]) {
      throw new Error(`pixelforge: zone "${z.id}" spawns at ${from.x},${from.y}, which is solid`);
    }
    const seen = new Set([idx(z, from.x, from.y)]);
    const queue = [[from.x, from.y]];
    while (queue.length) {
      const [x, y] = queue.pop();
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= z.w || ny >= z.h) continue;
        const at = idx(z, nx, ny);
        if (seen.has(at) || z.solid[at]) continue;
        seen.add(at);
        queue.push([nx, ny]);
      }
    }
    let closed = 0;
    for (let y = 0; y < z.h; y++) {
      for (let x = 0; x < z.w; x++) {
        const at = idx(z, x, y);
        if (z.solid[at] || seen.has(at)) continue;
        z.solid[at] = true;
        closed++;
      }
    }
    return closed;
  }

  function borderTrees(z) {
    for (let x = 0; x < z.w; x++) {
      for (const y of [0, z.h - 1]) {
        put(z, x, y, "object", "trunk", true);
        put(z, x, y === 0 ? 0 : y, "overhead", "canopy");
      }
    }
    for (let y = 0; y < z.h; y++) {
      for (const x of [0, z.w - 1]) {
        put(z, x, y, "object", "trunk", true);
        put(z, x, y, "overhead", "canopy");
      }
    }
  }

  // ── Feature placers (docs/brief-schema.md §6) ───────────────────────────────
  // One NEUTRAL placer per tag, composed from SEMANTIC tiles — the theme layer
  // (10-art) is what makes crop-plots paint hydroponics trays in a colony, so
  // geometry needs no per-theme variants. Each placer claims a small rect the
  // zone builder has reserved on grass and returns nothing; positions are the
  // builder's, never the model's. The startup assertion below keeps the shipped
  // tag vocabulary and this registry in lockstep.
  /** Clear a rect of everything a previous pass left standing in it.
   *
   *  Anything laid on a LEFTOVER LOT runs after the tree scatter, and `put()`
   *  overwrites without asking. Two different corruptions came out of that, both
   *  measured: a crop fill sets `solid = false` under a standing trunk, so the
   *  tree is still drawn and the player walks through it (8 across 120 worlds);
   *  and a fence overwrites a trunk while its canopy, which lives one row ABOVE,
   *  survives — a crown hanging over nothing (21 over fences, 17 more over the
   *  parks' own clears, which stopped at their rect edge).
   *
   *  So the clear reaches one row above the rect. That row is not decoration: a
   *  trunk on the top row keeps its canopy there, and clearing the trunk without
   *  it is exactly the bug. */
  function clearFootprint(z, x, y, w, h) {
    for (let dy = -1; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const cx = x + dx;
        const cy = y + dy;
        if (cx < 0 || cy < 0 || cx >= z.w || cy >= z.h) continue;
        // The row above is cleared of CANOPY only — it is somebody else's ground
        // and may legitimately carry a roofline or a wall.
        if (dy === -1) {
          if (z.overhead[idx(z, cx, cy)] === "canopy") put(z, cx, cy, "overhead", null);
          continue;
        }
        put(z, cx, cy, "object", null, false);
        put(z, cx, cy, "overhead", null);
      }
    }
  }

  const PLACERS = {
    "water-feature"(z, x, y) {
      waterFill(z, x, y, 6, 4);
      put(z, x + 6, y + 1, "object", "well", true);
    },
    "crop-plots"(z, x, y) {
      // Cleared first: on a leftover lot this runs after the tree scatter, and
      // the crop fill would otherwise un-solid a standing trunk and the fence
      // would behead one.
      clearFootprint(z, x, y, 8, 5);
      fillRect(z, x + 1, y + 1, 6, 3, "ground", "crop", false);
      for (let cx = x; cx <= x + 7; cx++) {
        put(z, cx, y, "object", "fence", true);
        put(z, cx, y + 4, "object", "fence", true);
      }
      for (let cy = y; cy <= y + 4; cy++) {
        put(z, x, cy, "object", "fence", true);
        put(z, x + 7, cy, "object", "fence", true);
      }
      put(z, x + 3, y, "object", null, false); // gate
    },
    "market-stalls"(z, x, y) {
      for (let i = 0; i < 3; i++) put(z, x + i * 2, y, "object", "table", true);
    },
    workyard(z, x, y) {
      fillRect(z, x, y, 5, 4, "ground", "stone", false);
      put(z, x + 1, y + 1, "object", "table", true);
      put(z, x + 3, y + 2, "object", "well", true);
    },
    /** A WARD SQUARE: the district's own centre, for a city too big to have one.
     *
     *  A settlement has a plaza at its crossroad, and at 104x72 that plaza is a
     *  ten-minute walk from three quarters of the town — one square serving a
     *  city is a village in a coat. A ward square is the same idea at district
     *  grain: paving, a well, and light, so a quarter of the city has somewhere
     *  of its own to be. Sized to the lot it stands on, like a park. */
    "ward-square"(z, x, y) {
      clearFootprint(z, x, y, 8, 5);
      for (let dy = 0; dy < 5; dy++) for (let dx = 0; dx < 8; dx++) put(z, x + dx, y + dy, "ground", "stone");
      put(z, x + 3, y + 2, "object", "well", true);
      z.lights.push({ x: x + 3, y: y + 2 });
    },
    /** A PUBLIC park: the dense-settlement answer to a lawn.
     *
     *  A town or a city has no room for a garden around every house and would
     *  not have had one anyway — the ground between the terraces is public, not
     *  private. Eight by five, the same footprint as the lot it stands on, so it
     *  reads as a block somebody chose not to build on rather than a gap.
     *
     *  Cleared first, object AND overhead together: this runs after the tree
     *  scatter, and clearing a trunk while leaving its canopy hangs a crown in
     *  the air over nothing. */
    park(z, x, y) {
      clearFootprint(z, x, y, 8, 5);
      for (let dy = 0; dy < 5; dy++) for (let dx = 0; dx < 8; dx++) put(z, x + dx, y + dy, "ground", "grass");
      for (let dx = 0; dx < 8; dx++) put(z, x + dx, y + 2, "ground", "path");
      for (let dy = 0; dy < 5; dy++) put(z, x + 3, y + dy, "ground", "path");
      for (const [tx, ty] of [
        [1, 1],
        [6, 1],
        [1, 4],
        [6, 4],
      ]) {
        put(z, x + tx, y + ty, "object", "trunk", true);
        put(z, x + tx, y + ty - 1, "overhead", "canopy");
      }
      put(z, x + 5, y + 2, "object", "well", true);
      z.lights.push({ x: x + 5, y: y + 2 });
    },
    "landmark-stone"(z, x, y) {
      put(z, x + 1, y + 1, "object", "wallStone", true);
      z.lights.push({ x: x + 1, y: y + 1 });
    },
    shrine(z, x, y) {
      fillRect(z, x, y, 3, 3, "ground", "stone", false);
      put(z, x + 1, y + 1, "object", "wallStone", true);
      z.lights.push({ x: x + 1, y: y + 1 });
    },
    "water-crossing"(z, x, y) {
      // Placed by the wilds builder across its stream; here x,y is the ford column.
      // MIGRATED ONTO THE BRIDGE TILE (0.12). A hand-laid ford and a decked pool
      // are the same idea — a road carried over water — and the only thing that
      // made them different was shipping two pictures of it. Still non-solid,
      // still four tiles, still inside the stream's rect: the crossing's geometry
      // is untouched and only the word for what it is laid with has moved.
      fillRect(z, x, y, 2, 2, "ground", "bridge", false);
    },
    "dense-growth"(z, x, y) {
      for (let dy = 0; dy < 4; dy++)
        for (let dx = 0; dx < 4; dx++)
          if ((dx + dy) % 2 === 0) {
            put(z, x + dx, y + dy, "object", "trunk", true);
            put(z, x + dx, y + dy - 1, "overhead", "canopy");
          }
    },
    ruin(z, x, y) {
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [3, 0],
        [0, 1],
        [0, 3],
        [4, 1],
        [4, 2],
      ]) {
        put(z, x + dx, y + dy, "object", "wallStone", true);
      }
      fillRect(z, x + 1, y + 1, 3, 2, "ground", "stone", false);
    },
    lookout(z, x, y) {
      fillRect(z, x, y, 3, 3, "ground", "stone", false);
      put(z, x, y, "object", "wallStone", true);
      put(z, x + 2, y, "object", "wallStone", true);
    },
  };
  // Registry completeness: every shipped tag must place in every theme (the
  // theme layer handles the skin, so one neutral placer satisfies both — but a
  // vocabulary tag with NO placer would silently drop features, which is the
  // exact failure the spec forbids shipping).
  for (const tag of PF.brief?.FEATURE_TAGS ?? []) {
    if (!PLACERS[tag]) throw new Error(`pixelforge: feature tag "${tag}" has no placer`);
  }

  // Per-theme display names for the LEGACY fixed layout (pre-brief saves).
  // `pond` and `stream` name the two water features the fixed layout reserves
  // rows for. Both are the name that theme's OWN default brief gives the tag
  // (18-brief DEFAULT_BRIEFS), so a legacy world and a compiled one call the
  // same thing by the same word rather than inventing a second vocabulary.
  const ZONE_NAMES = {
    "cozy-village": {
      village: "Hearthvale",
      inn: "The Amber Hearth Inn",
      forest: "The Whisperwood",
      pond: "The Village Pond",
      stream: "The Stepping Stones",
    },
    "sci-fi-colony": {
      village: "Meridian Base",
      inn: "The Meridian Cantina",
      forest: "The Mast Field",
      pond: "The Coolant Pool",
      stream: "The Conduit Bridge",
    },
  };
  // …AND WHAT THE FOUR OF THEM DO. The same duplication one table along, and it
  // was the one nobody themed: the four legacy residents' roles were hardcoded
  // in buildLegacy — "innkeeper", "farmer", "village guard", "forager" — right
  // beside the themed name book above, so a sci-fi colony stood a farmer and a
  // village guard in it.
  //
  // Invisible while a role was only a token's label, and player-facing the
  // moment the no-rod refusal started interpolating `npc.role` (59-economy's
  // rodHint): a legacy colony told the player "You need an angling rig — the
  // innkeeper stocks one", pointing at an inn that does not exist in that world.
  //
  // Keyed by NAME because the name is the join: buildLegacy stands up Mira, Tam,
  // Rook and Fen, and every theme's DEFAULT_BRIEFS cast names the same four. The
  // assertion below holds this book to the brief exactly as it holds the name
  // book, from the same source of truth and for the same reason.
  const LEGACY_ROLES = {
    "cozy-village": { Mira: "innkeeper", Tam: "farmer", Rook: "guard", Fen: "forager" },
    "sci-fi-colony": {
      Mira: "cantina keeper",
      Tam: "hydroponics lead",
      Rook: "pad marshal",
      Fen: "salvage scout",
    },
  };
  // BOTH BOOKS ABOVE ARE DUPLICATES, AND THIS IS WHAT KEEPS THEM ONE. Every
  // string in them is also written in that theme's own DEFAULT_BRIEFS entry
  // (18-brief) — the comment says the two agree and nothing made it true. They
  // are tables in two files that get edited months apart, which is how a player
  // ends up standing at The Village Pond in a legacy save and somewhere else in
  // the compiled world beside it.
  //
  // The whole book, not only the water: the settlement, the inn, the wood and
  // the four residents' trades are the same duplication and fail the same way.
  // Read through `defaults()` rather than off the literal, because a repair pass
  // that quietly renamed something on its way through validate() is exactly the
  // drift worth catching.
  //
  // ASSERTED AT LOAD, deliberately not inside build(): that function degrades any
  // compile throw to the legacy world (see its try/catch), so an invariant raised
  // in there would be swallowed and would ship as a silently misnamed world
  // instead of a failed build.
  {
    const named = (features, tag) => (features ?? []).find((feature) => feature.tag === tag)?.name;
    for (const [theme, names] of Object.entries(ZONE_NAMES)) {
      const fallback = PF.brief?.defaults?.(theme, 1);
      if (!fallback) continue;
      const wilds = fallback.places.find((place) => place.kind === "wilds");
      const owed = {
        village: fallback.name,
        inn: fallback.places.find((place) => place.kind === "gathering")?.name,
        forest: wilds?.name,
        pond: named(fallback.features, "water-feature"),
        stream: named(wilds?.features, "water-crossing"),
      };
      for (const [key, name] of Object.entries(owed)) {
        if (names[key] !== name)
          throw new Error(
            `pixelforge: the legacy layout calls ${theme}'s ${key} "${names[key]}", its default brief calls it "${name}"`,
          );
      }
      // The role book, held to the same standard from the same source. Read off
      // the cast BY NAME, which is the join the two tables share.
      for (const [who, role] of Object.entries(LEGACY_ROLES[theme] ?? {})) {
        const owedRole = fallback.cast.find((member) => member.name === who)?.role;
        if (role !== owedRole)
          throw new Error(
            `pixelforge: the legacy layout makes ${theme}'s ${who} a "${role}", its default brief makes them a "${owedRole}"`,
          );
      }
    }
  }

  function build(seed, theme, sealedBrief) {
    // Tight gate + containment: only a fully-sealed brief compiles, and a
    // malformed stored one degrades to the legacy world instead of bricking
    // the surface on every load.
    if (
      sealedBrief &&
      typeof sealedBrief === "object" &&
      Array.isArray(sealedBrief.cast) &&
      Array.isArray(sealedBrief.places) &&
      Array.isArray(sealedBrief.features) &&
      sealedBrief._ids &&
      typeof sealedBrief._ids.zones === "object"
    ) {
      // Hoisted so the CATCH below can name the folds too. If a FOLDED brief fails
      // to compile anyway, the folded values are the only ones that moved between
      // what was stored and what the compiler read, which makes them the first
      // thing to look at — and null until the fold has actually run, because a
      // throw out of foldStored itself folded nothing.
      let folded = null;
      try {
        // #566: THE STORED BRIEF IS UNTRUSTED AT THIS DOOR. The gate above answers
        // for its SHAPE and nothing has ever answered for its VALUES, which are
        // table keys a dozen reads down inside compile(). The fold is here, on a
        // private copy, and deliberately NOT in PF.save._configBrief: the object
        // that reader hands back is the one PF.player.briefHashOf() stamps a save
        // against, and a load path that returned different bytes than it was given
        // would sever an honest save from its own unchanged world. Folded for the
        // compiler, stored for the identity — PF.brief.foldStored says why the two
        // cannot be the same object.
        folded = PF.brief.foldStored(sealedBrief, seed);
        const world = compile(folded, seed);
        if (folded._folds.length) {
          // SAID OUT LOUD, which is the half of #566 that made the zone loss a bug
          // rather than a degrade: a value this build has never heard of is either
          // a hostile save or a brief from a newer build, and both are worth a line.
          console.warn(
            `[pixelforge] the stored brief carried ${folded._folds.length} value(s) this build does not know`,
            folded._folds,
          );
          // Carried only when there ARE any, so a world compiled from an honest
          // brief is byte-identical to the one this build compiled before the fold.
          world.briefFolds = folded._folds;
        }
        return world;
      } catch (err) {
        console.warn(
          `[pixelforge] stored brief failed to compile after ${folded?._folds.length ?? 0} fold(s); using the themed legacy world`,
          err,
          folded?._folds ?? [],
        );
      }
    }
    return buildLegacy(seed, theme);
  }

  function buildLegacy(seed, theme) {
    const activeTheme = PF.art.setTheme ? PF.art.setTheme(theme) : "cozy-village";
    const names = ZONE_NAMES[activeTheme] || ZONE_NAMES["cozy-village"];
    const roles = LEGACY_ROLES[activeTheme] || LEGACY_ROLES["cozy-village"];
    const rnd = PF.rng(seed);

    // ── The settlement exterior ──
    const v = makeZone("village", names.village, 44, 30, "grass");
    for (let i = 0; i < v.ground.length; i++) if (rnd() < 0.25) v.ground[i] = "grass2";
    borderTrees(v);
    // paths: a crossroad through a small plaza
    fillRect(v, 2, 14, 40, 2, "ground", "path");
    fillRect(v, 20, 2, 2, 26, "ground", "path");
    fillRect(v, 17, 11, 8, 8, "ground", "path");
    put(v, 21, 14, "object", "well", true);
    // pond
    fillRect(v, 33, 21, 7, 5, "ground", "water", true);
    // The legacy layout has no brief behind it and so no ordinals to mint from,
    // which is why its two water features carry FIXED reserved ids instead. They
    // are TAGGED from the same closed vocabulary a brief uses (18-brief
    // FEATURE_TAGS) because the consumer resolves per (theme, tag): an untagged
    // legacy spot would be water that no table can answer for. Rect = the
    // literal directly above, so the two move together or not at all.
    v.features.push({ id: "legacy:pond", tag: "water-feature", name: names.pond, rect: { x: 33, y: 21, w: 7, h: 5 } });
    // crops with fence
    fillRect(v, 4, 20, 8, 5, "ground", "crop", false);
    for (let x = 3; x <= 12; x++) {
      put(v, x, 19, "object", "fence", true);
      put(v, x, 25, "object", "fence", true);
    }
    for (let y = 19; y <= 25; y++) {
      put(v, 3, y, "object", "fence", true);
      put(v, 12, y, "object", "fence", true);
    }
    put(v, 7, 19, "object", null, false); // gate
    // buildings
    const inn = building(v, 25, 6, 8, 5, 3, [1, 6]); // the Amber Hearth Inn
    const farm = building(v, 6, 6, 6, 4, 2, [4]); // Tam's farmhouse
    const cottage = building(v, 13, 6, 5, 4, 2, [1]); // Rook's cottage
    const doors = [inn, farm, cottage].map((b) => ({ x: b.doorX, y: b.doorY }));
    scatterTrees(v, rnd, 26, doors.concat(doors.map((d) => ({ x: d.x, y: d.y + 1 }))));
    v.spawn = { x: 21, y: 17 };

    // ── Inn interior ──
    const n = makeZone("inn", names.inn, 16, 12, "floor");
    for (let x = 0; x < n.w; x++) {
      put(n, x, 0, "object", "wallStone", true);
      put(n, x, 1, "object", "wall", true);
      put(n, x, n.h - 1, "object", "wallStone", true);
    }
    for (let y = 0; y < n.h; y++) {
      put(n, 0, y, "object", "wallStone", true);
      put(n, n.w - 1, y, "object", "wallStone", true);
    }
    fillRect(n, 3, 3, 5, 1, "object", "counter", true);
    put(n, 10, 5, "object", "table", true);
    put(n, 12, 8, "object", "table", true);
    fillRect(n, 6, 6, 4, 3, "ground", "rug", false);
    put(n, 8, n.h - 1, "object", "door", false);
    n.spawn = { x: 8, y: n.h - 2 };
    n.lights.push({ x: 4, y: 3 }, { x: 11, y: 5 });

    // ── The Whisperwood (forest, east of the village) ──
    // Composed entirely from existing tiles: dense trees, a 2-wide path to a
    // stone clearing with a standing stone, and a stream crossed by a ford.
    const f = makeZone("forest", names.forest, 36, 24, "grass");
    for (let i = 0; i < f.ground.length; i++) if (rnd() < 0.4) f.ground[i] = "grass2";
    borderTrees(f);
    fillRect(f, 1, 12, 19, 2, "ground", "path"); // west approach
    fillRect(f, 20, 1, 2, 22, "ground", "water", true); // the stream
    // The ford, MIGRATED onto the bridge tile alongside the compiled crossing's
    // (0.12): the legacy wood and a brief-built one now cross their water by the
    // same picture, which is the whole of the sub-decision. Non-solid as it
    // always was — the geometry has not moved, only the tile it is laid with.
    fillRect(f, 20, 12, 2, 2, "ground", "bridge", false); // the ford
    // The stream's rect is the stream's own literal, and the ford's four tiles
    // sit INSIDE it as bridge. That is deliberate and not a defect in the shape:
    // a rect says where a feature stands, and the consumer's test — the neighbour
    // tile IS water and lies in a rect — is what keeps the road out of the water.
    f.features.push({
      id: "legacy:stream",
      tag: "water-crossing",
      name: names.stream,
      rect: { x: 20, y: 1, w: 2, h: 22 },
    });
    fillRect(f, 22, 12, 4, 2, "ground", "path"); // east approach
    fillRect(f, 26, 9, 6, 5, "ground", "stone"); // the clearing
    put(f, 28, 11, "object", "wallStone", true); // the standing stone
    f.lights.push({ x: 28, y: 11 });
    scatterTrees(f, rnd, 60, [
      { x: 1, y: 12 },
      { x: 1, y: 13 },
      { x: 20, y: 12 },
      { x: 21, y: 13 },
    ]);
    f.spawn = { x: 3, y: 12 };

    // portals (two-way). The village's east road runs off the map into the wood:
    // extend the crossroad to the border and open a two-tile gap in the trees.
    fillRect(v, 42, 14, 2, 2, "ground", "path");
    for (const y of [14, 15]) {
      put(v, 43, y, "object", null, false);
      put(v, 43, y, "overhead", null);
      put(f, 0, y - 2, "object", null, false); // forest west gap at y=12/13
      put(f, 0, y - 2, "overhead", null);
    }
    v.portals.push({
      x: inn.doorX,
      y: inn.doorY,
      toZone: "inn",
      toX: n.spawn.x,
      toY: n.spawn.y,
      label: "Enter the inn",
    });
    n.portals.push({ x: 8, y: n.h - 1, toZone: "village", toX: inn.doorX, toY: inn.doorY + 1, label: "Step outside" });
    v.portals.push(
      { x: 43, y: 14, toZone: "forest", toX: 2, toY: 12, label: "Into the Whisperwood" },
      { x: 43, y: 15, toZone: "forest", toX: 2, toY: 13, label: "Into the Whisperwood" },
    );
    f.portals.push(
      { x: 0, y: 12, toZone: "village", toX: 42, toY: 14, label: "Back to Hearthvale" },
      { x: 0, y: 13, toZone: "village", toX: 42, toY: 15, label: "Back to Hearthvale" },
    );

    // NPCs — LLM characters in the story; sprites here are just their world tokens.
    v.npcs.push(
      { id: "tam", name: "Tam", role: roles.Tam, hue: 96, x: 8, y: 22, wander: { x0: 4, y0: 20, x1: 11, y1: 24 } },
      {
        id: "rook",
        name: "Rook",
        role: roles.Rook,
        hue: 210,
        x: 21,
        y: 10,
        wander: { x0: 17, y0: 8, x1: 24, y1: 18 },
      },
    );
    n.npcs.push({
      id: "mira",
      name: "Mira",
      role: roles.Mira,
      hue: 8,
      x: 5,
      y: 4,
      wander: { x0: 2, y0: 4, x1: 8, y1: 9 },
      // The legacy world's lodging, marked the same way the compiler marks the
      // gathering (see compile()). The legacy layout has no schedules, so the
      // keeper is named here rather than derived: it is the same three-zone
      // village it has always been and Mira has always kept the inn.
      lodging: "inn",
    });
    n.lodging = true;
    f.npcs.push({
      id: "fen",
      name: "Fen",
      role: roles.Fen,
      hue: 140,
      x: 29,
      y: 12,
      wander: { x0: 26, y0: 9, x1: 31, y1: 13 },
    });

    v.mapKind = "settlement";
    n.mapKind = "building";
    f.mapKind = "place";
    return {
      seed,
      theme: activeTheme,
      zones: { village: v, inn: n, forest: f },
      startZone: "village",
      // The exterior binds to the campaign's starting World Maps location once known.
      bindings: newBindings(), // spatialLocationId → zoneId
      // The legacy world mints nobody — its three neighbours are written out by
      // hand above. The stamp is still emitted (never absent, so the S5 read
      // never has to distinguish "no stamp" from "stamp zero") and moves only
      // when MINT_V does.
      minted: [],
      mintStamp: mintStampOf([]),
    };
  }

  // ── compile(sealedBrief, seed): the deterministic half of the hybrid ────────
  // The brief says WHAT exists; every position below is computed. Zone keys are
  // the brief's ordinal ids (z1 = settlement), so saves and World Maps bindings
  // never depend on model-written names. See docs/brief-schema.md §4.5:
  // buildings derive from households + cast kinds, over-subscription MERGES
  // households into shared blocks — a named NPC's home is never dropped.
  // Names for the residents the COMPILER mints. A brief may name ten people; a
  // city holds dozens of households, and everybody else still has to be called
  // something. Two books because a name is theme-bearing: "Maud Thatch" belongs
  // to a village and "Sona Rask" does not.
  const RESIDENT_NAMES = {
    "cozy-village": {
      given: [
        "Alwin",
        "Bryn",
        "Cassa",
        "Dermot",
        "Edda",
        "Fenn",
        "Gret",
        "Hallam",
        "Isolde",
        "Jarek",
        "Kestrel",
        "Linnet",
        "Maud",
        "Nyle",
        "Orla",
        "Pell",
        "Rowan",
        "Sable",
        "Thom",
        "Ursel",
        "Vane",
        "Wick",
        "Yarrow",
        "Zeb",
      ],
      family: [
        "Ash",
        "Barrow",
        "Cobb",
        "Dray",
        "Ember",
        "Fallow",
        "Garrick",
        "Holt",
        "Ives",
        "Kettle",
        "Marsh",
        "Oakes",
        "Pike",
        "Quarry",
        "Reed",
        "Stile",
        "Thatch",
        "Vale",
        "Wren",
        "Yale",
      ],
    },
    "sci-fi-colony": {
      given: [
        "Anj",
        "Bex",
        "Corva",
        "Dax",
        "Eno",
        "Fira",
        "Gita",
        "Hale",
        "Ilva",
        "Jex",
        "Kai",
        "Lume",
        "Mira",
        "Nox",
        "Oren",
        "Pax",
        "Quen",
        "Rho",
        "Sona",
        "Tev",
        "Ulla",
        "Vek",
        "Wen",
        "Zia",
      ],
      family: [
        "Ansari",
        "Brandt",
        "Chen",
        "Dovic",
        "Eskil",
        "Ferro",
        "Grath",
        "Haas",
        "Ibori",
        "Jansen",
        "Koba",
        "Lind",
        "Mwangi",
        "Nakai",
        "Osei",
        "Petrov",
        "Rask",
        "Solheim",
        "Tamm",
        "Vance",
      ],
    },
  };
  // Deliberately none of SPECIAL_BUILDING_KINDS' keys: a minted resident must
  // never mint a hall, a shop or a farm behind itself. Those belong to people
  // the brief NAMED, and a nameless leader is a building with nobody in it.
  const MINTED_KINDS = ["folk", "folk", "folk", "folk", "child", "healer", "scholar"];
  // Grey reads as "extra" and the named cast should keep the loud end of the
  // palette, so a minted resident draws from the quieter buckets.
  const MINT_TINTS = ["green", "teal", "blue", "grey", "amber", "rose"];
  const MINTED_ROLES = {
    folk: ["hand", "carter", "cooper", "weaver", "digger", "porter", "tanner", "miller", "drover", "thatcher"],
    child: ["child"],
    healer: ["herbalist"],
    scholar: ["copyist"],
  };
  // The mint's own version, folded into every mintStamp. Bump it when a change
  // here would hand the SAME seed and the SAME brief a different roster — a new
  // name book, a changed household size distribution, a reordered kind table.
  // The player block's world stamp (S5 §Q3a) is what turns that into a visible
  // severance instead of a silent one: relationship rows keyed by "Maud Thatch"
  // mean nothing once "Maud Thatch" is a different person or nobody at all.
  const MINT_V = 1;
  /** Stamp the residents the COMPILER minted, in mint order. Names + kinds +
   *  households only: tints and wander flags are cosmetic and a change to them
   *  must not sever a save. Zero save bytes — the stamp is derived on every
   *  build and only its comparison is persisted. */
  function mintStampOf(minted) {
    let text = `mint/v${MINT_V}`;
    for (const member of minted) text += `|${member.name}\u0000${member.kind}\u0000${member.household}`;
    return PF.hashStr(text);
  }

  const SPECIAL_BUILDING_KINDS = {
    leader: "hall",
    host: "gathering",
    grower: "farm",
    guard: "post",
    merchant: "shop",
    maker: "shop",
    elder: "sanctuary",
  };
  // A sanctuary is never minted on demand — it is the church the brief NAMED, and
  // a nameless one would be an extra house with a spire. So an elder in a
  // church-less settlement claims no lot and no dwelling slot, which is also what
  // keeps every brief sealed before 0.8.0 compiling to the same tiles.
  const PLACE_BOUND_SPECIALS = new Set(["sanctuary"]);
  // ── Live-work premises vs duty stations ─────────────────────────────────────
  // A workplace is a HOME only when the trade is carried on where the family
  // lives. The smith's household sleeps over the forge, a farming family lives on
  // the farm, an innkeeper lives at the inn and a sanctuary's keeper lives in it —
  // one household, one roof, one lot. Counting a tradesman's shop AND a separate
  // house for the same family spent two of a settlement's handful of lots on one
  // household, and at the small end the specials then ate every lot and nobody got
  // a dwelling at all.
  //
  // A DUTY STATION is somewhere people GO and come back from. Nobody lives in the
  // guard post; a reeve works at the hall and goes home to a house like anyone
  // else. Its owner is an ordinary household the housing arithmetic still owes a
  // roof. A future post-like workplace joins that side by staying OUT of this set
  // — no logic moves. And a brief that wants someone to live in a grand hall
  // already has the escape hatch: home that cast member at the place, which the
  // compiler honours without any of this.
  const LIVE_WORK_SPECIALS = new Set(["shop", "farm", "gathering", "sanctuary"]);
  // The interior a special opens into when the compiler mints it on its OWN lot,
  // and the word its zone is named for. A special with no entry here is a facade,
  // and the two tables are read TOGETHER: a live-work special only houses its
  // household when there is a room with beds behind the door. gathering and
  // sanctuary are live-work but never self-lot — they bind to the place the brief
  // named, where that brief's own `home` field says who lives there.
  const SELF_LOT_INTERIORS = {
    shop: { kind: "shop", label: "shop" },
    farm: { kind: "farm", label: "farm" },
  };
  const INTERIOR_DIMS = {
    gathering: [16, 12],
    workshop: [16, 12],
    hall: [18, 12],
    sanctuary: [16, 14], // the nave needs length: the aisle is the walk to the altar
    // A live-work shop carries a household's bedrooms in the same shell as the
    // shop floor, so it is two rows deeper than a plain dwelling: the sleeping
    // band, the corridor its bedroom doors open onto, and the counter run below.
    shop: [14, 12],
    farm: [14, 10],
    dwelling: [14, 10],
  };
  // ── Living quarters in a building the brief NAMED ───────────────────────────
  // `home` naming a place is the sanctioned way for a brief to say "this person
  // lives HERE" — it is how a sanctuary's keeper has always worked and it is the
  // escape hatch for a lord who lives in the keep. So a named place has to sleep
  // whoever is homed in it, by the same machinery as anywhere else.
  //
  // This is NOT the same question as LIVE_WORK_SPECIALS, and the two must not be
  // folded together: that table decides who the compiler houses ON ITS OWN
  // INITIATIVE (a smith gets a home over the forge without being asked; nobody is
  // given a bed in the guard post). An explicit `home` is the BRIEF OVERRIDING
  // that default, and a default that says "by convention nobody lives here" has
  // no business refusing it — a hall is a duty station until a brief homes the
  // lord in it, and then it is his house.
  //
  // `top` is the row the quarters band starts on and `floor0` is where the
  // building's own floor starts WITHOUT quarters; the difference is how many rows
  // the building grows. Everything but the gathering hangs its quarters under the
  // shell's own wall row. The gathering cannot: the guest wing is already there
  // and the berths a settlement was BUILT to offer must not move because somebody
  // lives in, so its quarters sit below the guest corridor — which is exactly why
  // the quarters plan holds a room's width open (see SLEEP_PLANS.quarters).
  const PLACE_QUARTERS = {
    gathering: { top: 8, floor0: 6 },
    hall: { top: 2, floor0: 2 },
    sanctuary: { top: 2, floor0: 2 },
    workshop: { top: 2, floor0: 2 },
    dwelling: { top: 2, floor0: 2 },
  };
  // ── Sleeping arrangements ───────────────────────────────────────────────────
  // A sleeping place is ONE TILE an NPC stands on — the bed is the placement, not
  // furniture beside it — so "a bunk sleeps two" cannot mean two sprites on one
  // tile: the lower one would be un-talkable (talk-targeting picks the nearest on
  // a strict <) and it would break the invariant that no two NPCs share a tile.
  //
  // A BUNK is therefore one frame across TWO tiles stacked NORTH-SOUTH — the
  // upper berth and the lower berth — with a sleeper standing on each. The `bunk`
  // tile is painted edge to edge vertically (the altar's trick), so a pair reads
  // as one two-berth frame rather than two beds end to end. The COLUMN pitch is
  // two either way, so a run still reads as separate pieces of furniture; bunking
  // doubles what a wall run holds without widening it, which is exactly the
  // density argument for putting them in.
  const BED_ROWS = [2, 4];
  /** Sleeping places along one wall run, plus the furniture that paints them.
   *  `paint` is every tile of every PIECE — a bunk with one berth spare is still
   *  a whole bunk — while `slots` is one tile per sleeper, in claim order. */
  function sleepRun(x0, x1, y, count, bunked) {
    const paint = [];
    const slots = [];
    for (let x = x0; x <= x1 && slots.length < count; x += 2) {
      paint.push({ x, y });
      slots.push({ x, y });
      if (bunked) {
        paint.push({ x, y: y + 1 });
        if (slots.length < count) slots.push({ x, y: y + 1 });
      }
    }
    return { tile: bunked ? "bunk" : "bed", paint, slots };
  }
  /** How many SINGLE beds fit along a run of `span` tiles, one apart. Bunking the
   *  same run doubles it — that is the whole of the density argument. */
  const bedsAlong = (span) => Math.max(0, Math.ceil(span / 2));
  const paintRun = (zone, run) => {
    for (const tile of run.paint) put(zone, tile.x, tile.y, "object", run.tile, false);
    return run.slots;
  };

  // ── Interior partitioning ───────────────────────────────────────────────────
  // One furnisher per room PURPOSE — the same table shape as FURNISH one level
  // up, and for the same reason: a new purpose is an entry, never a branch.
  const ROOM_FURNISH = {
    /** A bedroom is its sleeping wall: places along the row farthest from the
     *  door and nothing else, because a room this size has nothing else to say.
     *
     *  Bunks are decided HERE, from `room.sleepers` against what the wall run
     *  holds — how many bodies must fit this space, and nothing about whose they
     *  are. A guard barracks, an inn's crowded guest room and a house full of
     *  orphans all get the same answer, because they are the same question.
     *
     *  A room is therefore all singles or all bunks: the run rounds UP to whole
     *  furniture, so a third sleeper buys a second bunk and leaves a berth spare
     *  rather than wedging one single in beside one bunk. A spare berth reads as
     *  ordinary life; furniture picked to hit an exact headcount reads as a
     *  census. */
    bedroom(zone, rect, room) {
      const span = rect.x1 - rect.x0 + 1;
      const bunked = room.sleepers > bedsAlong(span);
      return { beds: paintRun(zone, sleepRun(rect.x0, rect.x1, rect.y0, room.sleepers, bunked)) };
    },
  };

  /** Subdivide an interior's floor into walled rooms, each with its own door.
   *
   *  Shaped as (zone, area, rooms) — a rect to carve up plus a LIST OF ROOM
   *  DESCRIPTORS — rather than as a "lay out the bedrooms" call, because
   *  bedrooms are only the first purpose to want it. Kitchens, dining, storage
   *  and crafting rooms are the obvious next ones, and they have to arrive as
   *  another descriptor plus another ROOM_FURNISH entry — DATA, never a second
   *  partitioner. So this function knows nothing but geometry: where each room
   *  lands, which walls it needs and where its door goes. What a room is FOR
   *  lives entirely in the descriptor and its furnisher.
   *
   *  Rooms pack west to east along `area`, divided by one-tile wall runs, each
   *  with a door in its south wall opening onto the floor the caller kept. Any
   *  of `area` left over east of the last room stays OPEN and joined to that
   *  floor: a walled-off pocket nobody can walk into is the one shape the
   *  reachability invariant forbids.
   *
   *  `capNorth` paints the matching wall run along the row ABOVE the band, for a
   *  band that does NOT sit against the shell's own wall row — living quarters
   *  slotted into the middle of a building. Every other caller's band is flush
   *  under the shell wall and needs nothing. The two runs are painted here rather
   *  than by the caller so they can never drift apart and leave a room open at
   *  the top.
   *
   *  Returns one record per room placed — {purpose, x0, y0, x1, y1, doorX}
   *  merged with whatever its furnisher returned. */
  function partitionRooms(zone, area, rooms, capNorth) {
    const placed = [];
    let x = area.x0;
    for (const room of rooms) {
      const x1 = x + room.span - 1;
      // LOUD, matching the unknown-purpose throw below and the PLACERS startup
      // check. A `break` here eats the ENTIRE TAIL: one oversized room silently
      // drops every room after it, and `share()` has already dealt sleepers into
      // the dropped ones — so those people get no bed, `bedFor` is never set for
      // them, and their night handle is null. The caller sizes the list, so a
      // disagreement is a bug in the sizer, not a floor to land on. Measured
      // across the whole harness corpus: 3003 calls, this has never fired.
      if (x1 > area.x1)
        throw new Error(
          `pixelforge: room "${room.purpose}" span ${room.span} overflows its band (x1 ${x1} > ${area.x1})`,
        );
      // South wall first, then the door back out of it. The run covers the
      // divider column too, so the wall reads as one run rather than a comb.
      for (let wx = x; wx <= Math.min(x1 + 1, area.x1); wx++) {
        put(zone, wx, area.y1 + 1, "object", "wall", true);
        if (capNorth) put(zone, wx, area.y0 - 1, "object", "wall", true);
      }
      const doorX = x + ((room.span - 1) >> 1);
      put(zone, doorX, area.y1 + 1, "object", "door", false);
      if (x1 < area.x1) for (let wy = area.y0; wy <= area.y1; wy++) put(zone, x1 + 1, wy, "object", "wall", true);
      const rect = { x0: x, y0: area.y0, x1, y1: area.y1 };
      // LOUD, the way an unknown feature tag already is. An optional call here
      // carved the walls and the door and then furnished nothing, so an unknown
      // purpose compiled a sealed empty box that looks deliberate — and the room
      // vocabulary is about to grow from one purpose to a dozen. A feature tag
      // with no placer throws at startup; a room purpose with no furnisher had
      // no check at all, which is precisely backwards.
      const furnish = ROOM_FURNISH[room.purpose];
      if (!furnish) throw new Error(`pixelforge: room purpose "${room.purpose}" has no furnisher`);
      const furnished = furnish(zone, rect, room) ?? {};
      placed.push({ purpose: room.purpose, ...(room.private ? { private: true } : {}), ...rect, doorX, ...furnished });
      x = x1 + 2;
    }
    // The leftover east of the last room is returned rather than merely left
    // unpainted, because it is load-bearing geometry: the wall runs above and
    // below a band are painted only across ROOM spans (see the Math.min on the
    // south run, and the divider's `x1 < area.x1` guard), so this span is the
    // vertical leg by which the rows above and below a mid-building band reach
    // each other. Naming it lets a caller record it and stops a later tidy-up
    // from "fixing" those runs into full-width ones and sealing the band.
    return { placed, open: x <= area.x1 ? { x0: x, y0: area.y0, x1: area.x1, y1: area.y1 } : null };
  }

  // How an interior that has to sleep people is arranged. `soft` is the
  // occupancy a room of this purpose is comfortable with (a household bedroom
  // sleeps a couple; an inn gives a guest a door of their own), `max` is what one
  // will take at a push — the wall run bunked, four either way. `spare` carves
  // the whole wing whatever count it is handed, because an inn with no guest room
  // is not an inn, while a house builds only the bedrooms it needs. That count is
  // now a CAPACITY and never zero, so `spare` sits dormant with the per-room floor
  // below it: both are what a wing widened past its berth budget would need.
  //
  // A BEDROOM TAKES A BUNK, for the same reason the dormitory always did: the
  // wall run is the constraint and bunking doubles it. Capped at two singles, a
  // bedroom could not hold a fifth body, so a household of five fell out of its
  // own walls into an open dormitory — a family of five compiled to a barracks,
  // which is the exact reading rooms were added to prevent.
  // `privateSpan` is the OWNER'S OWN ROOM — see layoutSleeping. Two columns wide,
  // which is one bed and no more: an innkeeper should not be lying in a room they
  // rent out, nor bunked in with their own staff. Small on purpose; a private room
  // is what a keeper has, and floor space is what the building needs for the rest.
  const SLEEP_PLANS = {
    dwelling: { band: 3, span: 4, soft: 2, max: 4, privateSpan: 2 },
    gathering: { band: 3, span: 4, soft: 1, max: 4, spare: true },
    // LIVING QUARTERS — the rooms a building the brief NAMED grows when the brief
    // homes somebody in it (the keeper's rooms behind the church, the alewife's
    // over the tap). Three to a room rather than the dwelling's two, and
    // `keepOpen` holds a room's width of the band in reserve, because a quarters
    // band is the only one that can land in the MIDDLE of a building: the columns
    // it leaves free are how the rest of the building is reached past it, and a
    // wing that took the whole width would seal off everything above it. The
    // reserve caps the wing at two rooms — eight bunked — and anything past that
    // falls to the open plan, which walls nothing. Eight used to be above
    // CAPS.household and so unreachable; the cap is an id space now, so it is not.
    quarters: { band: 3, span: 4, soft: 3, max: 4, keepOpen: true, privateSpan: 2 },
  };

  // ── What a communal building was BUILT for ──────────────────────────────────
  // A FORMAL HOUSEHOLD adapts its bedding to its inhabitants; a COMMUNAL or
  // INSTITUTIONAL building reflects what it was built FOR. Two different rules,
  // and the asymmetry is the whole of it: a household's bedding follows its
  // people, an institution's people follow its bedding.
  //
  // So the guest wing is not sized from however many drifters the brief happened
  // to name. Sized that way the inn was never quiet and never full — a berth per
  // guest and not one spare, every night, which is the one thing an inn is not
  // for. It is sized from the two sealed axes that already say how much road
  // passes the door and how much house was built to take it: `scale`, and
  // `prosperity` a step either side of it. Both are folded enums, so the table is
  // total by construction and every settlement of a size reads as that size.
  //
  // backgroundPopulation stays out of it deliberately. It is a free 0-500 the
  // guidance tells the model is narrative texture for the map description, and
  // letting it size real geometry would hang the building's shape on the least
  // constrained number in the brief.
  // A city is 11 and not 12 for the reason the docstring below states: the wing
  // holds TWELVE bunked, and `thriving` adds one on top of the table. Twelve
  // here made a thriving city 13 and the wing fell through to `dormitory()` --
  // the exact bunkhouse-with-a-bar this table exists to prevent. The bound is on
  // the table PLUS prosperity, never on the table alone.
  const GUEST_BERTHS = { outpost: 4, hamlet: 5, village: 6, town: 9, city: 11 };
  const BERTH_PROSPERITY = { struggling: -1, modest: 0, thriving: 1 };
  /** How many guests the settlement's gathering was built to sleep.
   *
   *  The table is written to stay inside what the wing can physically be: never
   *  under the rooms the band carves (three today — a guest room with no bed in
   *  it is a cupboard), never over what those rooms hold bunked (twelve), which
   *  is where the wing would fall through to `dormitory()` and the inn would
   *  become a bunkhouse with a bar. Both bounds are properties of THIS table,
   *  asserted in the harness rather than clamped here, so widening the gathering
   *  has to come back and re-read the numbers instead of quietly re-shaping
   *  them. */
  const guestBerths = (brief) =>
    (GUEST_BERTHS[brief.scale] ?? GUEST_BERTHS.village) + (BERTH_PROSPERITY[brief.prosperity] ?? 0);

  /** Split `sleepers` across `count` rooms as evenly as the room order allows. */
  const share = (sleepers, count) =>
    Array.from({ length: count }, (_, i) => Math.floor(sleepers / count) + (i < sleepers % count ? 1 : 0));

  /** Where an interior's sleepers sleep: private rooms carved out of the band
   *  along the north wall while they fit, an open dormitory when they do not.
   *
   *  COMMUNAL IS INFERRED, never declared. A brief says who lives somewhere, not
   *  that a house is a dormitory, so the arithmetic answers it: once the sleepers
   *  outrun what the band's rooms can hold at their `max`, partitioning them is a
   *  lie about the building and the whole interior becomes the sleeping room.
   *
   *  Bunked bedrooms put that line at NINE in a dwelling — two rooms of four —
   *  Bunked bedrooms put that line at NINE in a dwelling — two rooms of four.
   *  That used to be past CAPS.household, so only the compiler's own
   *  over-subscription merge could reach it and the open plan always meant an
   *  orphanage, a barracks or a doss-house. It no longer does: the household
   *  number is an ID SPACE the size of the cast, so a brief can put nine or ten
   *  people under one roof deliberately, and the open plan is what they get.
   *
   *  Which is right rather than a regression — nine people sharing a roof ARE a
   *  communal arrangement however they are related, and the brief said so. What
   *  it costs is the old inference "open plan implies no kinship", which was only
   *  ever true because the cap made a big family inexpressible. */
  function layoutSleeping(zone, w, h, kind, sleepers, top = 2, owned = false) {
    const plan = SLEEP_PLANS[kind];
    const area = { x0: 1, y0: top, x1: w - 2, y1: top - 1 + plan.band };
    // THE OWNER'S OWN ROOM, first in the run and one sleeper wide. A building that
    // houses the person who runs it owes them a door of their own: an innkeeper
    // in a let room reads as a lodger in their own inn, and an innkeeper bunked
    // in with the staff reads as a dormitory. The rest of the household fills the
    // rooms after it under the ordinary rules — bunks when dense, and so on —
    // because they are an ordinary household.
    //
    // NOT a double bed: the maintainer wants the owner's bed to become one when
    // they have a partner, and that waits on the relationship layer double beds
    // are already deferred behind (roadmap 14). The ROOM is the part that lands
    // today.
    const priv = owned && plan.privateSpan > 0 && sleepers > 0;
    const shareFrom = area.x0 + (priv ? plan.privateSpan + 1 : 0);
    // How many `span` rooms fit east of it. `keepOpen` stops the run two columns
    // short of the band's edge — one for the last divider and one walkable — which
    // is how the rows above and below a mid-band wing reach each other past it.
    const lastEnd = (n) => shareFrom + (n - 1) * (plan.span + 1) + plan.span - 1;
    const limit = area.x1 - (plan.keepOpen ? 2 : 0);
    let fits = 0;
    while (lastEnd(fits + 1) <= limit) fits++;
    const rest = sleepers - (priv ? 1 : 0);
    const count = plan.spare ? fits : Math.min(fits, Math.ceil(rest / plan.soft));
    // `max` is policy; the wall run is physics. Take the lower, or a plan that
    // over-promised would hand a room more sleepers than it has tiles for and
    // the surplus would quietly fall back to the door apron with no bed at all.
    const holds = Math.min(plan.max, 2 * bedsAlong(plan.span));
    // EVERYONE SLEEPS SOMEWHERE outranks the private room. If reserving it would
    // leave the rest of the household without a bed, give the room up and lay the
    // wing the ordinary way; the open plan below is the floor under that in turn.
    // (The household cap USED to make this unreachable — six, the owner plus five,
    // fits every wing the compiler builds. The cap is now an id space, so a brief
    // can seal a household of ten and this path is live; it stays correct because
    // the fallback below is a real floor and not a formality. This is the
    // path for a place several households are homed at, where it is a fallback and
    // not a silent drop.)
    if (priv && (rest > count * holds || (rest > 0 && count < 1)))
      return layoutSleeping(zone, w, h, kind, sleepers, top, false);
    if (!priv && (count < 1 || sleepers > count * holds)) return dormitory(zone, w, h, sleepers, top);
    const { placed: rooms, open } = partitionRooms(
      zone,
      area,
      (priv ? [{ purpose: "bedroom", span: plan.privateSpan, sleepers: 1, private: true }] : []).concat(
        share(rest, count).map((taken) => ({
          purpose: "bedroom",
          span: plan.span,
          // A spare room still gets its bed — a guest room with no bed in it is a
          // cupboard. The berth table sits at or above the room count, so this no
          // longer fires on any settlement; it is the floor that stops a wing
          // widened past its budget from carving furniture-less rooms.
          sleepers: plan.spare ? Math.max(1, taken) : taken,
        })),
      ),
      plan.keepOpen,
    );
    if (open) zone.areas.push({ purpose: "corridor", ...open });
    return { rooms, beds: rooms.flatMap((room) => room.beds ?? []) };
  }

  /** No partitions: the sleepers outnumber what private rooms hold, so the
   *  interior IS the sleeping room — places along the rows farthest from the
   *  door, out in the open, as they were before rooms existed. Getting here takes
   *  nine under one roof, which is an institution and not a household.
   *
   *  BUNKED, and for the same spatial reason the partition was refused: getting
   *  here means the bodies already outran the rooms. Nothing on this path asks
   *  who they are — a barracks of adults and a house full of children compile to
   *  the same tiles, because the only input is how many have to fit. */
  function dormitory(zone, w, h, sleepers, top = 2) {
    const beds = [];
    for (const y of BED_ROWS.map((row) => row - BED_ROWS[0] + top)) {
      if (y > h - 3 || beds.length >= sleepers) break;
      beds.push(...paintRun(zone, sleepRun(2, w - 2, y, sleepers - beds.length, true)));
    }
    return { rooms: [], beds };
  }

  // ── Interior rooms ──────────────────────────────────────────────────────────
  // Every interior is the same shell — four walls, one door centered on the south
  // wall, the spawn on the tile inside it — so the portal wiring, the spawn and
  // the map gate are written once and a new kind only says what furniture goes
  // in. FURNISH is keyed by the brief's own place-kind vocabulary plus the kinds
  // the compiler mints itself (shop); an unknown kind furnishes as a plain room.
  /** The band a sleeping wing vacated when it went upstairs is the room's own
   *  space now, not a hole in it. A long table down the middle of it is what a
   *  house big enough for a staircase does with the ground floor it just freed —
   *  and it keeps the north end of a big room from reading as unfinished.
   *
   *  Rows 2-4 exactly: the rows layoutSleeping would have partitioned. Nothing
   *  else in any furnisher reaches up there, which is why it can be one call
   *  shared by all of them rather than three near-copies. */
  function vacatedBand(zone, w) {
    // The band a sleeping wing vacated is an OPEN span, not a room: no walls, no
    // door, and the common floor runs straight through it. Recording it names
    // what the long table is standing in, which is what a dining purpose will
    // read when it stops being painted by hand.
    zone.areas.push({ purpose: "dining", x0: 1, y0: 2, x1: w - 2, y1: 4 });
    fillRect(zone, 3, 3, w - 6, 1, "object", "table", true);
    zone.lights.push({ x: 3, y: 3 }, { x: w - 4, y: 3 });
  }

  const FURNISH = {
    gathering(z, w, h, options) {
      // Guest ROOMS, not four beds in the corner of the common room. The band
      // along the north wall is partitioned into rooms with doors of their own
      // and the common room keeps everything south of them — which is also the
      // shape a travelling group or a player party needs, several beds behind
      // one door, long before there is anything but a lone drifter to put in it.
      //
      // The guest wing keeps the band under the shell wall whether or not the
      // building also has living quarters — the berths a settlement was BUILT to
      // offer do not move because somebody lives here. Quarters land below it
      // (see PLACE_QUARTERS), and the common room starts at `floor0` either way.
      // SKIPPED, not called with a count of zero, when the wing is upstairs: a
      // guest wing is sized to the BUILDING and carves its spare rooms whatever
      // the headcount (SLEEP_PLANS.gathering `spare`), so a zero would have laid
      // the whole wing again — over the keeper's quarters, which come up to these
      // very rows once the wing leaves them.
      const sleeping = options.upstairs ? null : layoutSleeping(z, w, h, "gathering", options.sleepers ?? 0);
      const floor = options.floor0;
      // Rug first: a ground fill clears solidity, so painting it after the
      // tables would silently make one of them walk-through (the hall's lesson).
      // Nothing solid on `floor` itself: it is the row the rooms above open onto.
      fillRect(z, 5, floor + 2, 4, 3, "ground", "rug", false);
      fillRect(z, 3, floor + 1, 5, 1, "object", "counter", true);
      // THE SERVING ROW — recorded, not merely left clear, exactly like the
      // dwelling's hearth: whoever KEEPS this room has to be sent to a spot
      // inside it, and the only thing that knows where the counter ended up is
      // the furnisher that painted it. The keeper's side is the row ABOVE the
      // counter run: the door is in the south wall and the rug and the tables
      // are south of the counter, so north of it is the side a patron does not
      // walk onto. Same arithmetic as a shop's work post (WORK_POSTS) — the
      // counter's own span, one row back from it — because it is the same fact.
      //
      // Walkable by contract: `floor` is the row the guest rooms open onto (see
      // above), and nothing in this furnisher or the sleeping layout may lay a
      // solid tile on it. Runtime-only like `hearth`: re-baked on every compile,
      // never serialized, zero save fields.
      z.post = { x0: 3, y0: floor, x1: 7, y1: floor };
      put(z, w - 6, floor + 2, "object", "table", true);
      put(z, w - 4, floor + 4, "object", "table", true);
      z.lights.push({ x: 4, y: floor + 1 }, { x: w - 6, y: floor + 2 });
      return sleeping;
    },
    hall(z, w, h, options) {
      // Rug first: its ground fill clears solidity, so painting it after the
      // table silently made the table walk-through (review finding). Everything
      // is measured from `floor0` — the first row of the hall's own floor, which
      // moves down when the brief homes somebody in living quarters above it.
      const floor = options.floor0;
      fillRect(z, 3, floor + 1, w - 6, h - floor - 4, "ground", "rug", false);
      fillRect(z, 4, floor + 3, w - 8, 1, "object", "table", true);
      z.lights.push({ x: 3, y: floor }, { x: w - 4, y: floor });
    },
    sanctuary(z, w, h, options) {
      // A nave the player walks the length of: a carpet aisle from the door to
      // the altar, benches in rows either side, candle plinths flanking the
      // altar. Aisle first — the hall's lesson: a ground fill clears solidity,
      // so painting it after the altar would make the altar walk-through.
      // Measured from `floor0`: a church whose keeper LIVES in it grows the
      // quarters above the nave, and the nave keeps its full length below them.
      const floor = options.floor0;
      const aisleX = (w / 2) | 0;
      fillRect(z, aisleX, floor + 1, 1, h - floor - 2, "ground", "rug", false);
      fillRect(z, aisleX - 2, floor + 1, 5, 1, "object", "altar", true);
      for (const candleX of [aisleX - 3, aisleX + 3]) {
        put(z, candleX, floor + 1, "object", "wallStone", true);
        z.lights.push({ x: candleX, y: floor + 1 });
      }
      // THE CHANCEL, recorded for the same reason the inn records its serving
      // row: a keeper the brief homed at the settlement root needs somewhere
      // inside their own building to stand, and only the furnisher knows where
      // the altar went. The row BEHIND the altar, spanning it — the head of the
      // aisle the player walks up, facing back down it.
      //
      // Not the altar row itself, and not the aisle: `altar` and both candle
      // plinths are solid, so a station laid across them would hold no standable
      // tile at all and the placer's ring scan would walk the keeper off it. The
      // row above is clear — nothing here paints on `floor`, the benches start at
      // `floor + 4` — and it is reached around either end of the altar run, which
      // is why standing there does not strand anybody. Runtime-only, like the
      // hearth and the inn's counter.
      z.post = { x0: aisleX - 2, y0: floor, x1: aisleX + 2, y1: floor };
      for (let row = floor + 4; row < h - 2; row += 2) {
        fillRect(z, 3, row, aisleX - 3, 1, "object", "counter", true);
        fillRect(z, aisleX + 1, row, aisleX - 3, 1, "object", "counter", true);
      }
      put(z, 2, 1, "object", "window", true);
      put(z, w - 3, 1, "object", "window", true);
      z.lights.push({ x: 2, y: 1 }, { x: w - 3, y: 1 });
    },
    workshop(z, w, h, options) {
      const floor = options.floor0;
      fillRect(z, 3, floor + 1, 4, 1, "object", "counter", true);
      put(z, w - 4, floor + 3, "object", "table", true);
      z.lights.push({ x: 3, y: floor + 1 });
    },
    shop(z, w, h, options) {
      // A LIVE-WORK premises: the trade is carried on where the family lives, so
      // the household's bedrooms take the north band exactly as a dwelling's do
      // and the shop floor is what is left south of them. Sleeping FIRST —
      // partitionRooms owns those rows, and a fitting painted into them would be
      // walled inside somebody's bedroom.
      // SKIPPED, not called with a count of zero, when the band is upstairs — and
      // the rows it would have taken become part of the room (vacatedBand).
      const sleeping = options.upstairs
        ? null
        : layoutSleeping(z, w, h, "dwelling", options.sleepers ?? 0, 2, options.owned);
      if (options.upstairs) vacatedBand(z, w);
      // Never a bare room with a door on it: a counter to be served over and a
      // wall of stock behind it. An empty shop reads worse than a locked one
      // (maintainer call), and the owner's `post` handle moves in here, so it is
      // staffed as well as stocked. The counter run stops short of the east wall
      // so the player can walk around its end — an unreachable pocket behind the
      // counter would strand the shopkeeper the room exists to show.
      //
      // Everything sits at least two rows off the sleeping band: the row directly
      // under the bedroom wall is the corridor every bedroom door opens onto, and
      // stock across it would seal the household into their own rooms.
      for (let x = 2; x <= w - 3; x += 2) put(z, x, h - 5, "object", "shelf", true);
      fillRect(z, 3, h - 3, w - 7, 1, "object", "counter", true);
      fillRect(z, 3, h - 2, 3, 1, "ground", "rug", false);
      z.lights.push({ x: 3, y: h - 3 }, { x: w - 3, y: h - 5 });
      return sleeping;
    },
    farm(z, w, h, options) {
      // The farmhouse half of a farm: the land is outside, what is in here is the
      // house a farming family sleeps in. Bedrooms along the north band like any
      // other household, and the working half under them — the long bench a day's
      // crop is sorted on and the table that day ends at.
      // SKIPPED, not called with a count of zero, when the band is upstairs — and
      // the rows it would have taken become part of the room (vacatedBand).
      const sleeping = options.upstairs
        ? null
        : layoutSleeping(z, w, h, "dwelling", options.sleepers ?? 0, 2, options.owned);
      if (options.upstairs) vacatedBand(z, w);
      // Rug first: a ground fill clears solidity, so painting it after the bench
      // would silently make the bench walk-through (the hall's lesson).
      fillRect(z, w - 6, h - 3, 3, 2, "ground", "rug", false);
      fillRect(z, 2, h - 3, 4, 1, "object", "counter", true);
      put(z, 2, h - 2, "object", "table", true);
      z.lights.push({ x: 2, y: h - 3 }, { x: w - 4, y: h - 3 });
      return sleeping;
    },
    dwelling(z, w, h, options) {
      // The beds ARE the feature: one per resident, 1x1 and non-solid, so a night
      // visit finds the household asleep in them instead of milling on a doorstep.
      // Behind BEDROOM DOORS, bunked once a room has to take more than two.
      //
      // This used to say a family kept its walls up to nine under one roof and
      // lost them at ten, and that stopped being true when the shell learned to
      // follow its household: a house grows to three bedrooms and the ROOM takes
      // the crowding after that, so the walls no longer run out at all.
      // Re-measured, one household with a second present to stop the validator's
      // split repair: seven sleepers → 3 rooms and 4 bunk tiles, eight → 3 and 8,
      // nine → 3 and 12. The open plan is now reached by the over-subscription
      // MERGE (several households on one lot), not by one family being large.
      // SKIPPED, not called with a count of zero, when the band is upstairs — and
      // the rows it would have taken become part of the room (vacatedBand).
      const sleeping = options.upstairs
        ? null
        : layoutSleeping(z, w, h, "dwelling", options.sleepers ?? 0, 2, options.owned);
      if (options.upstairs) vacatedBand(z, w);
      // A living half under the sleeping wall, so the room is not only a dormitory
      // — and so a dwelling with no sleepers of its own is still a furnished room.
      // Nothing solid on the row under the bedroom wall: that row is the corridor
      // every bedroom door opens onto.
      fillRect(z, w - 6, h - 4, 3, 2, "ground", "rug", false);
      // THE KITCHEN, as an open corner of the common floor rather than a room
      // behind a door. A cottage's kitchen IS the main room — walling it off
      // would need a second band, a second band needs a door row of its own, and
      // that row would eat the living half a dwelling this size barely has.
      // Recorded as an AREA for the same reason the vacated band is: open floor
      // with a purpose is still a purpose, and the vocabulary is about what a
      // space is FOR rather than how many walls stand around it.
      //
      // Row h-3, NOT h-4. Row h-4 is the corridor every bedroom door opens onto,
      // and a counter laid across it walls the household into its own bedrooms —
      // thirteen tiles sealed behind a door that opened onto a kitchen bench. The
      // comment four lines above says that row is untouchable and I put a counter
      // there anyway; the reachability sweep caught it on the first run.
      // Counter, never `shelf`: shelving is a SHOP's stock, and telling a home
      // from a workplace by whether it has any is a distinction the harness makes
      // and a player reads at a glance.
      fillRect(z, 1, h - 3, 3, 1, "object", "counter", true);
      put(z, 5, h - 3, "object", "table", true);
      z.areas.push({ purpose: "kitchen", x0: 1, y0: h - 3, x1: 3, y1: h - 3 });
      // THE HEARTH. Set into the east wall of the living half — a fire is part of
      // the wall it is built into, and one standing in the middle of the floor
      // reads as a barbecue. Not on row h-2: that row carries the zone's spawn and
      // both stair tiles, and it is walkable by contract.
      put(z, w - 2, h - 3, "object", "hearth", true);
      // Recorded, not just painted: the dawn and dusk schedule tiers point at it,
      // so it has to be findable from a zone rather than recomputed from `w` and
      // `h` by whoever wants it. Runtime-only, like the rest of the schedule
      // furniture — re-baked on every compile, never serialized.
      z.hearth = { x: w - 2, y: h - 3 };
      z.lights.push({ x: 5, y: h - 3 }, { x: w - 2, y: h - 3 });
      return sleeping;
    },
  };

  // ── Floors: the storey above and the cellar below ───────────────────────────
  // A ROOM is a partition inside a zone. A FLOOR **is** a zone, joined to the one
  // under it by a stair portal pair. That split is the design and not an accident
  // of it: a bedroom must never cost a zone — every zone holds two full-size
  // canvases in the render cache, and the count is the flagged cost of this
  // release — while a floor gets one and in exchange reuses machinery the world
  // already has. Portals, the reachability sweep, save-restore, the schedule
  // resolver's cross-zone splice and the World Maps gate all work on a floor the
  // day it compiles, because not one of them can tell it from any other zone. A
  // LEVEL system would have had to re-teach every one of them.
  //
  // Ids derive from the parent's: `{parent}u` above, `{parent}b` below. A parent
  // id is already sealed-brief data (`z{ordinal}`, `h{household}`, `s{ordinal}`),
  // so a floor id is stable across rebuilds and purely ADDITIVE against saved zone
  // ids — an old save naming `h1` still resolves, and 60-save already lands the
  // player at spawn for an id that does not. ZERO new save fields: a floor is
  // compiled from the seed like every other zone.
  //
  // Exactly one flight each way. `h1uu` is not turned away by a depth guard: it
  // cannot be spelled, because interiorRoom() is the only caller and the floors
  // it builds never call back into it.
  const BELFRY_DIMS = [9, 9];

  /** The column each flight takes: up to the WEST of the door, down to the EAST.
   *
   *  Fixed rather than searched, and claimed against the EMPTY shell before a
   *  stick of furniture is down. That ordering is load-bearing. A storey is
   *  decided before the ground floor is laid, because the sleeping band that
   *  moves up must not also be laid down here — so a flight that could fail to
   *  find a column AFTERWARDS would leave a household with beds nowhere at all.
   *  Beside the door there is nothing to fail against: the row inside the south
   *  wall is bare when the shell goes up, and the startup check below pins both
   *  neighbours inside every width the tables offer.
   *
   *  A flight also needs a LANDING — the tile the other end delivers the player
   *  onto, which must never be the step itself or the portal would fire again and
   *  bounce them straight back (linkInterior puts a player one tile inside a door
   *  for exactly this reason). The two ends pick theirs differently and subFloor
   *  says why. */
  const stairX = (w, dir) => ((w / 2) | 0) + (dir === "up" ? -1 : 1);
  // Both flights inside the shell at every width the tables offer, plus the
  // landing of the smallest floor there is. Same discipline as the PLACERS
  // registry check: a building that grew a storey with no way up to it would be
  // an unreachable zone, which the reachability invariant forbids outright.
  for (const [kind, [w]] of Object.entries({ ...INTERIOR_DIMS, belfry: BELFRY_DIMS })) {
    for (const x of [stairX(w, "up"), stairX(w, "down"), (w / 2) | 0]) {
      if (x < 1 || x > w - 2) throw new Error(`pixelforge: ${kind} interior is too narrow for stairs`);
    }
  }

  // One furnisher per floor PURPOSE — the same table shape as FURNISH and
  // ROOM_FURNISH below it, and for the same reason: another kind of floor is an
  // entry plus a furnisher, never a branch inside the builder.
  const FLOOR_FURNISH = {
    /** An upper storey IS its sleeping band. The band moves up here whole, laid
     *  by the same layoutSleeping call the ground floor would have made with the
     *  same plan — so a guest room upstairs and a guest room downstairs are the
     *  same room, down to the bunking rule and the owner's private door. The only
     *  thing that changed is which zone it is in. */
    storey(zone, w, h, plan) {
      return layoutSleeping(zone, w, h, plan.sleepPlan, plan.sleepers, 2, plan.owned);
    },
    /** A cellar: stock down the walls, a bench when the trade over it needs one.
     *  Largely scenery today and deliberately so — this is the room building and
     *  resource management will want a floor for, and an empty cellar now is
     *  cheaper than a wrong one later. The middle is left clear for whatever
     *  lands there. */
    cellar(zone, w, h, plan) {
      for (let x = 2; x <= w - 3; x += 2) put(zone, x, 2, "object", "shelf", true);
      for (const y of [4, h - 5]) {
        put(zone, 1, y, "object", "shelf", true);
        put(zone, w - 2, y, "object", "shelf", true);
      }
      if (plan.work) {
        fillRect(zone, 3, h - 4, 4, 1, "object", "counter", true);
        put(zone, w - 4, h - 4, "object", "table", true);
      }
      zone.lights.push({ x: 2, y: 2 }, { x: w - 3, y: 2 });
      return {};
    },
    /** The bell tower, and a deliberate REUSE rather than a special case. A
     *  belfry is a small room with one thing in it at the top of a flight of
     *  stairs, and every part of that except the furniture is what subFloor
     *  already does — id derivation, the stair pair, the map gate, reachability.
     *  Giving it its own path would have duplicated all four to change the
     *  contents of one room. `dims` is the single concession the mechanism
     *  needed, and it earns itself: a tower is narrower than the nave it stands
     *  over, and the two flights are placed independently at each end so the
     *  footprints never had to match. */
    belfry(zone, w) {
      const cx = (w / 2) | 0;
      // Hung in the middle with floor all the way round it: being up here WITH
      // the bell is the whole reward for the climb.
      put(zone, cx, 3, "object", "bell", true);
      zone.lights.push({ x: cx, y: 3 });
      // Louvres either side, on the shell's own wall row — the same trick the
      // nave downstairs uses for its clerestory. They are what makes the room
      // read as open air rather than an attic.
      for (const wx of [2, w - 3]) {
        put(zone, wx, 1, "object", "window", true);
        zone.lights.push({ x: wx, y: 1 });
      }
      return {};
    },
  };

  // ── Which buildings earn which floors ───────────────────────────────────────
  // GATED, never universal, and the gate is the whole reason zone count does not
  // double: a floor is a zone, and a zone is two full-size canvases. A building
  // earns a storey when its sleeping band is big enough that the ground floor is
  // mostly corridor past it.
  //
  //   - The GATHERING always. Guest rooms upstairs is the shape an inn has had
  //     for as long as there have been inns, its berth budget is the largest band
  //     the compiler lays (four to ten), and it is where a travelling group or a
  //     player party goes.
  //   - The SANCTUARY always, but a BELL TOWER rather than a storey.
  //   - A HOUSE only when it is LARGE OR MERGED: four or more sleeping under one
  //     roof, or a block the over-subscription merge put more than one household
  //     into. A cottage of one to three keeps its bedrooms on the ground floor,
  //     where they cost nothing and read perfectly well.
  //
  // Read off `sleepers` — the band the compiler lays ITSELF. A brief that homes
  // somebody at a named place gets `residents` and living QUARTERS instead, and
  // those stay downstairs: quarters are the room a keeper has behind their own
  // building, and putting a chaplain up a staircase to reach her own bed is not
  // what the escape hatch was for.
  const UPPER_STOREY_SLEEPERS = 4;
  // The kinds whose FURNISH lays a household band of its own — the compiler's
  // word for "a house", whether or not a trade is carried on in it.
  const HOUSEHOLD_KINDS = new Set(["dwelling", "shop", "farm"]);
  const upstairsName = (below) => `${below}, upstairs`;
  function upperPlan(kind, opts) {
    if (kind === "sanctuary") return { purpose: "belfry", dims: BELFRY_DIMS, name: (below) => `${below} bell tower` };
    const sleepers = opts.sleepers ?? 0;
    if (kind === "gathering") return { purpose: "storey", sleepPlan: "gathering", sleepers, name: upstairsName };
    if (!HOUSEHOLD_KINDS.has(kind)) return null;
    if (sleepers < UPPER_STOREY_SLEEPERS && !opts.merged) return null;
    return { purpose: "storey", sleepPlan: "dwelling", sleepers, owned: !!opts.owned, name: upstairsName };
  }

  // Cellars.
  //   - The WORKSHOP and the GATHERING always: the stock and the barrels have to
  //     go somewhere, and both are buildings the whole settlement uses.
  //   - A HOUSE on a draw seeded by PROSPERITY. A cellar is stored surplus, so a
  //     struggling settlement digs none and a thriving one digs most.
  //
  // The draw runs off its OWN hashed stream, keyed on the seed and the building's
  // id — both sealed-brief data, so a town has the same cellars every time it is
  // rebuilt. Not off the compile's shared `rnd`: the wilds are scattered from that
  // stream AFTER the interiors, and drawing from it here would move trees in a
  // zone this feature has no business touching.
  const CELLAR_ALWAYS = new Set(["workshop", "gathering"]);
  const CELLAR_ODDS = { struggling: 0, modest: 0.35, thriving: 0.7 };
  function cellarPlan(id, kind, opts) {
    const odds = HOUSEHOLD_KINDS.has(kind) ? (CELLAR_ODDS[opts.prosperity] ?? 0) : 0;
    const dug = CELLAR_ALWAYS.has(kind) || PF.rng(PF.hashStr(`${(opts.seed ?? 0) >>> 0}|cellar|${id}`))() < odds;
    if (!dug) return null;
    // Sometimes work rather than only storage: an undercroft under a building
    // whose trade wants the room, which is the one the brief actually named.
    return { purpose: "cellar", work: kind === "workshop", name: (below) => `${below} cellar` };
  }

  /** Beds carry the zone they are IN. A sleeping band can now sit on a different
   *  floor from the building's front door, so "the fourth bed in this building"
   *  is no longer enough to send anybody to — the schedule handle needs a zone id,
   *  and the only thing that knows it is the zone that painted the bed. */
  const bedsIn = (zone, beds) => (beds ?? []).map((bed) => ({ zoneId: zone.id, x: bed.x, y: bed.y }));

  /** Build one floor over or under `parent` and wire the stairs both ways.
   *
   *  Shaped like every other builder here: handed WHAT the floor is and owning
   *  WHERE everything in it goes. The parent's step is already painted (see
   *  stairX) — this raises the shell the other end of it opens into. */
  function subFloor(parent, dir, plan) {
    const up = dir === "up";
    const [w, h] = plan.dims ?? [parent.w, parent.h];
    const zone = makeZone(`${parent.id}${up ? "u" : "b"}`, plan.name(parent.name), w, h, "floor");
    for (let x = 0; x < w; x++) {
      put(zone, x, 0, "object", "wallStone", true);
      put(zone, x, 1, "object", "wall", true);
      put(zone, x, h - 1, "object", "wallStone", true);
    }
    for (let y = 0; y < h; y++) {
      put(zone, 0, y, "object", "wallStone", true);
      put(zone, w - 1, y, "object", "wallStone", true);
    }
    // The floor's own end of the staircase, where the ground floor's door would
    // be: the middle of the south wall row. Claimed before the furniture for the
    // same reason the parent's is, and independently of it — which is what lets
    // the bell tower be narrower than the church under it.
    const landingX = (w / 2) | 0;
    const stepX = stairX(parent.w, dir);
    put(zone, landingX, h - 2, "object", up ? "stairsDown" : "stairsUp", false);
    zone.spawn = { x: landingX, y: h - 3 };
    // A stair is a PORTAL, and that is what makes it nearly free: the player's
    // portal handling walks it with no new code, the reachability sweep counts
    // the floor as reached, and standable() already refuses to park an NPC on a
    // portal tile — so nobody is ever found standing in the stairwell.
    parent.portals.push({
      x: stepX,
      y: parent.h - 2,
      toZone: zone.id,
      toX: landingX,
      toY: h - 3,
      label: `${up ? "Up" : "Down"} to ${zone.name}`,
    });
    zone.portals.push({
      x: landingX,
      y: h - 2,
      toZone: parent.id,
      // Back onto the tile just inside the front door — the room's own spawn,
      // which is the one tile every interior guarantees is walkable. The step's
      // north neighbour would have been the natural landing and is not safe: it
      // is ordinary floor the furnisher owns, and a shop's counter run is laid
      // straight across it. Coming down beside the door also reads right, and it
      // is the same bargain the door itself takes — step back onto the stair and
      // you go up again, exactly as stepping back onto the door puts you out.
      toX: parent.spawn.x,
      toY: parent.spawn.y,
      label: `${up ? "Down" : "Up"} to ${parent.name}`,
    });
    // A building is ONE World Maps location and its floors are rooms inside it
    // (spec §8). The locations route is additive with NO delete, so a row written
    // to a player's real map can never be taken back — the gate is stamped HERE,
    // on the one function that can mint a floor, and not left to call sites where
    // the next one to be added would forget it.
    zone.mapExport = false;
    zone.mapKind = "building";
    const furnished = FLOOR_FURNISH[plan.purpose](zone, w, h, plan) ?? {};
    zone.rooms = furnished.rooms ?? [];
    zone.beds = bedsIn(zone, furnished.beds);
    return zone;
  }

  /** How many bedrooms one household may grow before the roof stops following it.
   *
   *  Three, and the number is load-bearing in both directions. Below it the house
   *  grows and the family gets doors; at it the house stops and the ROOM absorbs
   *  the next body instead — which is what `bunk` is for. Set high enough to hold
   *  a household of ten in rooms of two, nothing would ever bunk again and the
   *  density rule would be dead code that still passes its own tests. Three
   *  bedrooms is a large house; past that a household is crowded, and crowded is
   *  a thing the tiles are supposed to be able to say. */
  const DWELLING_ROOMS_MAX = 3;

  /** A shell wide enough for the rooms the household actually needs.
   *
   *  INTERIOR_DIMS handed every dwelling the same fourteen columns, and fourteen
   *  fits two bedrooms. So a household of six fell straight past the partitioner
   *  into the open plan — not because six people cannot have bedrooms, but
   *  because the shell they were given had two, and `dormitory()` is what happens
   *  when the bodies outrun the rooms. The building was answering a question
   *  about its own width and reporting it as a fact about the family.
   *
   *  Size follows PROGRAM: count the rooms the sleep plan asks for, then put the
   *  east wall far enough out to hold them. The arithmetic is `layoutSleeping`'s
   *  own, deliberately — if the two ever disagree the partitioner throws rather
   *  than dropping a room, so they are kept as one formula in two places rather
   *  than two formulas.
   *
   *  ONE household only. A block the over-subscription merge put several
   *  households into is a tenement, and it SHOULD run out of rooms and fall to
   *  the open plan — a building holding five families is a bunkhouse, and that is
   *  a fact about the building rather than a shortfall in it. */
  const widthForProgram = (kind, base, opts) => {
    const plan = SLEEP_PLANS[kind];
    const sleepers = opts.sleepers ?? 0;
    if (!plan || kind !== "dwelling" || opts.merged || sleepers <= 0) return base;
    const priv = !!opts.owned && plan.privateSpan > 0;
    const rest = sleepers - (priv ? 1 : 0);
    const rooms = PF.clamp(Math.ceil(rest / plan.soft), 1, DWELLING_ROOMS_MAX);
    const shareFrom = 1 + (priv ? plan.privateSpan + 1 : 0);
    const lastEnd = shareFrom + (rooms - 1) * (plan.span + 1) + plan.span - 1;
    // +1 for the divider east of the last room, +1 for the shell's own wall.
    return Math.max(base, lastEnd + 2);
  };

  function interiorRoom(id, name, kind, options) {
    const [baseW, baseH] = INTERIOR_DIMS[kind] || INTERIOR_DIMS.dwelling;
    const opts = options || {};
    const w = widthForProgram(kind, baseW, opts);
    // The floor ABOVE, decided before a single tile is laid. A sleeping band that
    // is going upstairs must not also be laid down here — the household would get
    // two beds each and the ground floor would carve rooms nobody sleeps in — so
    // the decision has to come before the furnisher, not after it.
    const upper = upperPlan(kind, opts);
    const upstairs = upper?.purpose === "storey";
    // LIVING QUARTERS. `residents` is the household the brief HOMED in this
    // building; when there is one, the building grows the rows to sleep them and
    // its own floor starts below the quarters. Nobody homed here => not one tile
    // moves, so every brief that names a place and houses nobody in it compiles
    // exactly what it always did.
    //
    // The gathering is the one building whose quarters do NOT sit flush under the
    // shell's wall row: its guest wing is already there, and the berths a
    // settlement was BUILT to offer must not move because somebody lives in. With
    // that wing upstairs there is nothing left on this floor to make room for, so
    // the quarters come back up to the ordinary rows and the building stops
    // carrying four rows of nothing where the wing used to be.
    const quarters = upstairs && PLACE_QUARTERS[kind] ? { top: 2, floor0: 2 } : PLACE_QUARTERS[kind];
    const sleepingIn = quarters && (opts.residents ?? 0) > 0 ? quarters : null;
    const floor0 = sleepingIn ? sleepingIn.top + SLEEP_PLANS.quarters.band + 1 : (quarters?.floor0 ?? 2);
    const h = baseH + (sleepingIn ? floor0 - quarters.floor0 : 0);
    const zone = makeZone(id, name, w, h, "floor");
    for (let x = 0; x < w; x++) {
      put(zone, x, 0, "object", "wallStone", true);
      put(zone, x, 1, "object", "wall", true);
      put(zone, x, h - 1, "object", "wallStone", true);
    }
    for (let y = 0; y < h; y++) {
      put(zone, 0, y, "object", "wallStone", true);
      put(zone, w - 1, y, "object", "wallStone", true);
    }
    // Quarters BEFORE the furnisher: partitionRooms owns those rows, and a
    // fitting painted into them would end up walled inside somebody's bedroom.
    // Same call, same plan machinery and the same ROOM_FURNISH.bedroom as a
    // household anywhere else gets — so a keeper's family gets bedrooms and bunks
    // by the density rule, not a bed each regardless of size.
    const living = sleepingIn
      ? layoutSleeping(zone, w, h, "quarters", opts.residents, sleepingIn.top, opts.owned)
      : null;
    const doorX = (w / 2) | 0;
    put(zone, doorX, h - 1, "object", "door", false);
    zone.spawn = { x: doorX, y: h - 2 };
    // THE FLIGHTS, claimed against the bare shell (see stairX) and before the
    // furnisher runs, so a step can never fail to be placed and never be laid
    // over. What they open onto is raised further down, once the room they leave
    // is finished.
    const flights = [];
    for (const [dir, plan] of [
      ["up", upper],
      ["down", cellarPlan(id, kind, opts)],
    ]) {
      if (!plan) continue;
      put(zone, stairX(w, dir), h - 2, "object", dir === "up" ? "stairsUp" : "stairsDown", false);
      flights.push([dir, plan]);
    }
    const furnished =
      (FURNISH[kind] || FURNISH.dwelling)(zone, w, h, {
        ...opts,
        floor0,
        upstairs,
      }) ?? {};
    // What the furnisher carved and where it put the sleepers. Compiler output,
    // not save data: a zone is rebuilt from the seed on every load, so rooms and
    // beds cost ZERO save fields — the same deal schedules took.
    //
    // `beds` and `homeBeds` are kept APART on purpose. `beds` is what the building
    // OFFERS, in claim order — an inn's guest berths — and `homeBeds` belongs to
    // the people who live here. A keeper bedded down in a rented room is wrong and
    // a traveller handed the keeper's bed is worse, so the two lists never
    // intersect: they are carved from different bands of the building.
    // Quarters rooms are marked so anything counting what the building OFFERS can
    // tell them from what it keeps for itself; they are in `rooms` all the same,
    // because `rooms` is what the wander boxes avoid and what the reachability
    // sweep walks, and a private room is both whoever it belongs to.
    zone.rooms = (furnished.rooms ?? []).concat((living?.rooms ?? []).map((room) => ({ ...room, quarters: true })));
    zone.homeBeds = bedsIn(zone, living?.beds);
    zone.mapKind = "building"; // World Maps export kind (spec §8)
    // The floors, LAST: their stairs land against furniture that is already down,
    // and a storey's own rooms are carved into a shell of its own.
    // G2 — THE SERVICE ROW. Row h-2 is not merely "the stair row": it carries
    // `zone.spawn`, both stair steps, the tile linkInterior delivers a player
    // onto, the tile a sub-floor's return portal delivers onto, and the tile the
    // save's restore rescue teleports to WITHOUT testing it. `put()` is
    // bounds-checked and nothing else, so a furnisher that lays a wall across
    // this row makes a storey unreachable and nothing anywhere says so.
    //
    // Three columns, not the whole row, on purpose: the farm already paints a
    // solid table at (2, h-2) and that is fine — it is nowhere near a stair.
    // This fires in a PLAYER'S world, where no harness runs.
    const apronC = (w / 2) | 0;
    for (const gx of [apronC - 1, apronC, apronC + 1]) {
      if (zone.solid[(h - 2) * w + gx])
        throw new Error(`pixelforge: ${kind} paints solid over the service row at ${gx},${h - 2}`);
    }
    zone.floors = flights.map(([dir, plan]) => subFloor(zone, dir, plan));
    // A building's bed list SPANS its floors. Whoever deals beds out asks the
    // building, not the storey — "the fourth berth at the inn" has to mean the
    // same thing whether the guest wing is up the stairs or along the back wall —
    // so every record carries the zone it is really in and the ground floor
    // publishes the concatenation. `rooms` deliberately does NOT do this: it is
    // what wander boxes avoid and what the room sweeps walk, and both of those are
    // questions about ONE zone's tiles.
    zone.beds = bedsIn(zone, furnished.beds).concat(...zone.floors.map((floor) => floor.beds));
    return zone;
  }

  /** Wire a building's door to its interior, both ways. A room with no door is
   *  the one shape the reachability invariant forbids — whoever is homed there is
   *  stranded and un-talkable forever — so the portal pair ships with the room
   *  rather than at whichever call site remembers to add it. */
  function linkInterior(v, zone, door, label) {
    v.portals.push({ x: door.doorX, y: door.doorY, toZone: zone.id, toX: zone.spawn.x, toY: zone.spawn.y, label });
    zone.portals.push({
      x: zone.spawn.x,
      y: zone.h - 1,
      toZone: v.id,
      toX: door.doorX,
      toY: door.doorY + 1,
      label: "Step outside",
    });
  }

  /** Where a live-work owner WORKS inside a building the COMPILER minted, keyed
   *  by special. Only a shop has a station to be manned — the row between the
   *  stock and the counter — so it is the only entry: a farmer works the land and
   *  comes back in.
   *
   *  ONE OF TWO WAYS a station reaches an owner, and the split is by who built
   *  the room. A minted building has no brief place behind it, so its station is
   *  looked up here by `special`. A building the brief NAMED is furnished by
   *  FURNISH, and its furnisher records its own station on the zone (`z.post` —
   *  the inn's serving row, the sanctuary's chancel) for the places pass to hand
   *  to the same `interior` handle. Both ends feed the one gate in the cast loop,
   *  and a kind with a station on neither path keeps the door apron it has always
   *  used. */
  const WORK_POSTS = {
    shop: (w, h) => ({ x0: 3, y0: h - 4, x1: w - 5, y1: h - 4 }),
  };

  function compile(brief, seed) {
    const activeTheme = PF.art.setTheme ? PF.art.setTheme(brief.theme) : brief.theme;
    const rnd = PF.rng(seed);
    const scale = PF.brief.SCALES[brief.scale] || PF.brief.SCALES.village;
    const zones = {};
    // Zones key by the brief's ordinal ids POSITIONALLY (z1 = settlement,
    // z{n+2} = places[n]) — never by name round-trips, so a display-name
    // collision can never collapse two ids into one zone.
    const zoneIdForPlace = (place) => `z${brief.places.indexOf(place) + 2}`;
    const zoneIdByName = new Map(Object.entries(brief._ids.zones).map(([id, name]) => [name, id]));

    // ── Feature ids: the BRIEF's ordinals, tracked apart from placement ────────
    // `_ids.features` is minted once at seal (18-brief), walking the settlement's
    // own features first and then each place's IN BRIEF ORDER. Mirrored here by
    // POSITION rather than looked up by name, because two features may
    // legitimately share one and a name lookup would collapse them.
    //
    // The discipline that matters: an ordinal belongs to the feature the BRIEF
    // wrote, not to the one the map found room for. A feature the placer skips
    // ("a plainer settlement, never a sealed one") still SPENDS its ordinal, so
    // every feature after it keeps the id the sealed brief already promised.
    // Ids that shuffled whenever a village happened to be full would make the
    // registry unquotable across two builds of the same world.
    const featureIds = new Map();
    {
      let ordinal = 1;
      for (const feature of brief.features) featureIds.set(feature, `f${ordinal++}`);
      for (const place of brief.places)
        for (const feature of place.features ?? []) featureIds.set(feature, `f${ordinal++}`);
    }
    /** Put a PLACED feature on the register of the zone that holds it.
     *
     *  `rect` is the extent the placement pass reserved — the placer's true
     *  footprint plus the one-tile margin FEATURE_RECTS carries — and is
     *  deliberately NOT carved down to the tiles the placer watered. A rect may
     *  hold tiles the feature never painted water on (a `water-feature`'s well
     *  stands at x+6; the wilds ford lays path straight across its stream), and
     *  the consumer's own two-sided test is what excludes them. The exclusion
     *  lives in the test, not in the shape. */
    const recordFeature = (zone, feature, rect) => {
      zone.features.push({ id: featureIds.get(feature), tag: feature.tag, name: feature.name, rect });
    };

    // ── The settlement exterior (z1) ──
    const v = makeZone("z1", brief.name, scale.w, scale.h, "grass");
    v.mapKind = "settlement";
    const groundMix = { woods: 0.3, fields: 0.22, rocky: 0.2, water: 0.25, barren: 0.35 }[brief.surround] ?? 0.25;
    for (let i = 0; i < v.ground.length; i++) if (rnd() < groundMix) v.ground[i] = "grass2";
    borderTrees(v);
    // Paths: a crossroad through a central plaza, scaled to the grid.
    const midY = (v.h / 2) | 0;
    const midX = (v.w / 2) | 0;
    fillRect(v, 2, midY - 1, v.w - 4, 2, "ground", "path");
    fillRect(v, midX - 1, 2, 2, v.h - 4, "ground", "path");
    fillRect(v, midX - 4, midY - 4, 8, 8, "ground", "path");
    if (brief.prosperity === "thriving") fillRect(v, midX - 2, midY - 2, 4, 4, "ground", "stone");
    if (brief.prosperity === "struggling") {
      for (let i = 0; i < v.ground.length; i++) if (v.ground[i] === "path" && rnd() < 0.18) v.ground[i] = "dirt";
    }
    // PUBLIC GROUND, recorded as rects the moment it is laid. The roofline test
    // used to read the ground id, which the two lines above and the `thriving`
    // paving both defeat — a scuffed road is `dirt` and a paved plaza is `stone`,
    // and neither is any less a street for it. Rects cannot be recoloured.
    v.publicGround = [
      { x: 2, y: midY - 1, w: v.w - 4, h: 2 },
      { x: midX - 1, y: 2, w: 2, h: v.h - 4 },
      { x: midX - 4, y: midY - 4, w: 8, h: 8 },
    ];
    v.spawn = { x: midX, y: midY + 2 };
    // Injection-discipline prose (§7) rides the world so the runtime never
    // needs the brief: zone flavor injects once on first entry, the situation
    // once on the first outbound message.
    v.flavor = brief.flavor;

    // ── Building arithmetic (§4.5) ──
    // A settlement dwelling is minted only for a resident who actually lives at
    // the root (home === the settlement). A resident whose home is a place or the
    // wilds — a forager who lives in the woods, a chaplain who lives in her own
    // church — lives THERE and anchors to that zone in the cast loop, so a town
    // house would sit permanently empty. Transient/fringe/destitute NPCs get no
    // house at all (they anchor to a standing-specific rest spot).
    //
    // …with ONE exception, and it is the drop guard's other half: a named place
    // that never claimed a lot compiles no zone, so the building that resident
    // "lives in" does not exist. They live in the settlement like anybody else
    // and the town owes them a roof. `built` is the list of places that got one.
    const strandedFrom = (member, built) =>
      interiorPlaces.some((place) => place.name === member.home) && !built.some((place) => place.name === member.home);
    const townHouseholds = (built) =>
      [
        ...new Set(
          roster
            .filter(
              (m) => (m.standing ?? "resident") === "resident" && (m.home === brief.name || strandedFrom(m, built)),
            )
            .map((m) => m.household),
        ),
      ].sort((a, b) => a - b);
    const specials = [];
    const seenSpecial = new Set();
    // brief.cast, not the roster: a special is the building a NAMED person runs,
    // and MINTED_KINDS holds none of SPECIAL_BUILDING_KINDS' keys anyway, so the
    // minted residents could only ever iterate past this. Reading the sealed cast
    // says so out loud, and keeps the mint below free to move.
    for (const member of brief.cast) {
      // Only residents run a permanent special building (the hall, the shop, the
      // post…); a transient/fringe/destitute NPC never anchors one.
      if ((member.standing ?? "resident") !== "resident") continue;
      const special = SPECIAL_BUILDING_KINDS[member.kind];
      if (!special || seenSpecial.has(special)) continue;
      if (PLACE_BOUND_SPECIALS.has(special) && !brief.places.some((place) => place.kind === special)) continue;
      seenSpecial.add(special);
      specials.push({ special, owner: member });
    }
    // Interior places claim a facade: gathering binds to the host's building,
    // hall to the leader's — their doors become the interior portals.
    const interiorPlaces = brief.places.filter((p) => p.kind !== "wilds");
    const wildsPlaces = brief.places.filter((p) => p.kind === "wilds");
    // How many lots the row placer may keep. It is a ceiling, and from `village`
    // up it is the binding one — the grid offers more ground than the budget
    // allows — so the arithmetic below counts the lots that survive the cap,
    // neither this number nor the raw grid.
    const budget = scale.buildings;

    // Row-placed buildings in the upper and lower thirds, straddling the plaza.
    // Laid BEFORE the arithmetic below, because the lots are the arithmetic's
    // input: `scale.buildings` caps how many lots the placer keeps, and the map's
    // own width decides how many it had to offer — four on an outpost, eight in a
    // hamlet, twenty in a village, thirty-six in a town, eighty in a city. So the
    // budget is met exactly at the two smallest ranks and bites at the other
    // three; it is never left unspent. Fewer lots still become door-bearing
    // buildings — the rest go to places, trades and the market.
    // Sizing the dwellings off the budget instead was half of the housing bug:
    // the sum promised slots the ground did not have, so `Math.max(1, …)` handed
    // out a dwelling slot that no lot ever backed.
    const buildings = [];
    const slots = [];
    // ── The street grid ────────────────────────────────────────────────────────
    // Lots are laid in ROWS along the horizontal road and in COLUMNS either side
    // of the vertical one. Both used to be one hard-coded pair: exactly two rows
    // whatever the map's height, and a single column grid marching from x=4 that
    // the road then punched a hole through.
    //
    // The hole was the worse half. On a narrow map only two columns fit at all,
    // and the road ate one of them, so an outpost and a hamlet laid ONE lot per
    // row — measured: two buildings total, with nine of ten people sharing the
    // single cottage. Laying each side of the road independently costs nothing
    // and gives the small ranks their second column back.
    //
    // The two rows were the other half: every door in a 96x72 city landed in
    // rows 25-43, leaving 65% of the map as lawn nobody had a reason to cross.
    // Rows now come from the height the map actually has.
    const BUILDING_H = 5; // the tallest a lot is ever painted (a named place)
    const LOT_PITCH_Y = BUILDING_H + 3; // overhang above, apron below, one to breathe // overhang above, apron below, one to breathe
    const LOT_PITCH_X = 9;
    const MAX_LOT_W = 8; // the widest building() ever draws
    // A row must clear the border and its own overhang above, and the horizontal
    // road plus its apron below. Bands are computed from those, not guessed.
    /** A run of lot origins inside [lo, hi], CENTRED on that span.
     *
     *  A fixed pitch marching from one end leaves whatever does not divide
     *  evenly in one lump at the other end, and the lump is always on the same
     *  side, so a town came out with its lots hard against the western trees and
     *  eleven empty columns down the east. Splitting the remainder puts the same
     *  number of lots on the same pitch with a margin at both ends, which is
     *  what a laid-out settlement looks like instead of a shunted one.
     *
     *  `lo` and `hi` are the first and last tile the lot may OCCUPY, so a lot at
     *  `start` ends at `start + size - 1` and that must not pass `hi`. */
    const runOf = (lo, hi, size, pitch) => {
      const span = hi - lo + 1;
      if (span < size) return [];
      const count = 1 + (((span - size) / pitch) | 0);
      const used = size + (count - 1) * pitch;
      const start = lo + (((span - used) / 2) | 0);
      return Array.from({ length: count }, (_, index) => start + index * pitch);
    };
    // Row 4, not 3: a sanctuary lifts its facade by up to two rows above the lot,
    // so the top band needs headroom for the eave above THAT or it paints into
    // the border ring. The old two-row allocator carried the same floor as a
    // Math.max, and it was load-bearing rather than decorative.
    //
    // The band's last usable row is midY - 2: a body starting at y ends at
    // y + BUILDING_H - 1, and it clears a road at midY - 1. One too strict and an
    // outpost loses its whole northern band — which is most of what "an outpost
    // is two buildings" turned out to be.
    //
    // The band below starts one row under the road, not three: a building's SOLID
    // body must clear the street, but its overhang is an overhead tile and may
    // hang over it exactly as a real eave does. Requiring three cost the outpost
    // its entire southern row.
    const rowYs = [
      ...runOf(4, midY - 2, BUILDING_H, LOT_PITCH_Y),
      ...runOf(midY + 1, v.h - 4, BUILDING_H, LOT_PITCH_Y),
    ];
    // Columns, per side. West stops before the road; east starts after it. The
    // road is never tested against a lot because a lot is never laid across it.
    // The east band may reach v.w - 4: the border ring is the last column and the
    // two inside it are verge.
    const colXs = [...runOf(4, midX - 2, MAX_LOT_W, LOT_PITCH_X), ...runOf(midX + 1, v.w - 4, MAX_LOT_W, LOT_PITCH_X)];
    for (const rowY of rowYs) for (const x of colXs) slots.push({ x, y: rowY });
    // ── Claim order: OUTWARD FROM THE PLAZA ───────────────────────────────────
    // Row-major order filled the northernmost row first, which put a small
    // settlement's entire building stock against the top border with its own
    // square left bare — and handed the first lots the row with the least
    // head-room, so a church could never build tall on a map that had the space
    // for one two rows down.
    //
    // Distance from the crossroad instead. A hamlet now grows around its square
    // the way a settlement actually does, the lots that fill first are the ones a
    // player stands nearest, and depth into a band comes free with it. Ties break
    // on y then x so the order stays deterministic.
    slots.sort((a, b) => {
      const da = (a.x + 3 - midX) ** 2 + (a.y + 2 - midY) ** 2;
      const db = (b.x + 3 - midX) ** 2 + (b.y + 2 - midY) ** 2;
      return da - db || a.y - b.y || a.x - b.x;
    });
    // `budget` alone. Adding the places on top made `scale.buildings` mean
    // "buildings, plus however many places the brief happened to name", so a
    // city with four of them could claim all 80 lots against a declared capacity
    // of 76. The allocation below already reserves lots for places, trades and
    // the market out of this number.
    slots.length = Math.min(slots.length, budget);

    // ── The residents the brief never named (§4.5) ─────────────────────────────
    // A brief may name ten people. Until now those ten WERE the population: the
    // street grid lays sixty-four lots in a city and the arithmetic below had
    // demand for eighteen, so a city compiled to a village with long walks
    // between the houses. Everybody else in town lives here.
    //
    // Sized from the two FOLDED axes — scale and prosperity — for the same reason
    // the guest-berth table is: both are enums, so the table is total by
    // construction and every settlement of a size reads as that size.
    // `backgroundPopulation` is the brief's least-constrained number, a free
    // 0-500 the guidance calls narrative texture. It moves the settlement WITHIN
    // its rank's band and is never allowed to set the band: a hamlet whose brief
    // claims five hundred souls is still a hamlet, and a model that leaves the
    // field at zero still gets a full town.
    const RESIDENT_HOUSEHOLDS = { outpost: 3, hamlet: 6, village: 12, town: 24, city: 45 };
    const HOUSEHOLD_LEAN = { struggling: 0.75, modest: 1, thriving: 1.15 };
    const householdBand = Math.max(
      1,
      Math.round(
        (RESIDENT_HOUSEHOLDS[brief.scale] ?? RESIDENT_HOUSEHOLDS.village) * (HOUSEHOLD_LEAN[brief.prosperity] ?? 1),
      ),
    );
    // Three to a household is the average the mint below actually produces
    // (sizes one to four, uniform), so a brief's own headcount reads as a
    // household count on the same scale the band is written in.
    const impliedHouseholds = brief.backgroundPopulation > 0 ? brief.backgroundPopulation / 3 : householdBand;
    // Households that actually want a house on the ROOT map, which is the only
    // demand the lots below answer. Two exclusions, and both were bugs when they
    // were missing: a transient at the inn or a beggar on the steps occupies no
    // dwelling, and neither does a resident whose home is the fen or her own
    // church — she lives THERE. Counting either against the target builds the
    // town one house smaller for every person in it who needs no house.
    const namedHouseholds = new Set(
      brief.cast
        .filter((m) => (m.standing ?? "resident") === "resident" && m.home === brief.name)
        .map((m) => m.household),
    );
    // A transient merchant's stall takes a LOT, and the mint runs before the lots
    // are laid, so the houses have to leave room for the market on their way in.
    // Without this the town fills to the last lot and a visiting trader finds
    // nowhere to set up — silently, because the stall loop simply stops.
    const stallDemand = brief.cast.filter(
      (m) => (m.standing ?? "resident") === "transient" && m.kind === "merchant",
    ).length;
    // The band says how big the town WANTS to be; the lots say how big it can
    // be. Minting past the lots is not a bigger town, it is the same town with
    // more people merged under each roof — and it silently eats the ground a
    // market stall or a named place still needed. So the ask is clamped to the
    // ground that is actually left after the places, the trades and the market
    // have taken theirs.
    //
    // "The trades" means the trades that BUY GROUND. A special bound to a named
    // place — the host's inn IS the gathering, the maker's shop IS the workshop
    // — shares that place's facade and never reaches takeSlot() (see the
    // boundPlace branch below), so charging it a lot here starved the mint on
    // exactly the briefs rich enough to bind: measured across 9,600 worlds, one
    // hamlet/village/town in three with a bound special compiled households
    // short while the lots they were owed sat bare. This prediction can still
    // run high when a special is later SKIPPED for want of ground, but that
    // only happens once the ground is already gone — conservative there, exact
    // everywhere else.
    const lotHungrySpecials = specials.filter(
      (entry) => !interiorPlaces.some((place) => interiorKindForSpecial(entry.special) === place.kind),
    ).length;
    const lotsForHouses = Math.max(0, slots.length - interiorPlaces.length - lotHungrySpecials - stallDemand);
    const bandTarget = Math.max(
      Math.round(householdBand * 0.75),
      Math.min(Math.round(householdBand * 1.25), Math.round(impliedHouseholds)),
    );
    const householdTarget = Math.max(namedHouseholds.size, Math.min(bandTarget, lotsForHouses));
    // A side stream, so minting residents does not shift the tile RNG under the
    // ground cover and every world that had no minting still lays the same grass.
    const mintRnd = PF.rng(PF.hashStr(`${seed >>> 0}|residents|${brief.name}`));
    // Through PF.own so the fallback on the right is REACHABLE. Bare, a theme
    // named "constructor" answered with a function, `??` saw something
    // non-nullish and kept it, and the first `nameBook.family[…]` below threw —
    // into build()'s catch, which degrades to the legacy three-zone world. A
    // brief that compiles fine is not a thing to lose over a word.
    const nameBook = PF.own(RESIDENT_NAMES, activeTheme) ?? RESIDENT_NAMES["cozy-village"];
    const takenNames = new Set(brief.cast.map((m) => m.name));
    const minted = [];
    // Off EVERY sealed household, resident or not: the target ignores the
    // non-residents but their household numbers are still taken.
    let nextHousehold = Math.max(0, ...brief.cast.map((m) => m.household)) + 1;
    for (let i = namedHouseholds.size; i < householdTarget; i++) {
      const household = nextHousehold++;
      const family = nameBook.family[(mintRnd() * nameBook.family.length) | 0];
      const size = 1 + ((mintRnd() * 4) | 0);
      for (let k = 0; k < size; k++) {
        const kind = MINTED_KINDS[(mintRnd() * MINTED_KINDS.length) | 0];
        // Bounded, then suffixed. Two dozen given names against twenty families
        // is a lot of room, but "room" is not "proof", and a name collision must
        // never be able to spin here.
        let name = "";
        for (let tries = 0; tries < 8 && (!name || takenNames.has(name)); tries++) {
          name = `${nameBook.given[(mintRnd() * nameBook.given.length) | 0]} ${family}`;
        }
        if (takenNames.has(name)) name = `${name} the ${MINTED_ROLES[kind][0]}`;
        // Counted off a fixed BASE rather than re-suffixing the last candidate:
        // appending to the running name would give "Maud Thatch 2 3 4" on a
        // third collision. The loop terminates because each candidate is
        // distinct and takenNames is finite.
        const base = takenNames.has(name) ? `${name} ${household}` : name;
        name = base;
        for (let suffix = 2; takenNames.has(name); suffix++) name = `${base} ${suffix}`;
        takenNames.add(name);
        const roles = MINTED_ROLES[kind] ?? MINTED_ROLES.folk;
        minted.push({
          name,
          role: roles[(mintRnd() * roles.length) | 0],
          kind,
          tint: MINT_TINTS[(mintRnd() * MINT_TINTS.length) | 0],
          home: brief.name,
          household,
          standing: "resident",
          persona: "",
          // Runtime-only, like _sched: the mint is re-run on every compile from
          // the seed, so this never reaches a save.
          _minted: true,
          // A quarter of the town has business in the square. Without this the
          // streets fill and the PLAZA empties, which is the same failure the
          // other way round — a market town whose market nobody attends.
          _square: mintRnd() < 0.25,
          // Of the rest, half keep their WARD's square rather than the stretch of
          // street outside their own door — where there are wards at all. Three
          // grains of public life instead of one: the town's centre, the
          // quarter's centre, and your own doorstep.
          _ward: mintRnd() < 0.5,
        });
      }
    }
    // Appended, never spliced: `roster.indexOf(owner)` names the special zones
    // below, so a minted resident must not renumber anybody the brief named.
    const roster = minted.length ? [...brief.cast, ...minted] : brief.cast;
    let slotIndex = 0;
    const takeSlot = () => slots[slotIndex++] ?? null;

    // ── Who still owes a roof ───────────────────────────────────────────────────
    // Every household needs somewhere to sleep, and a LIVE-WORK special IS that
    // somewhere for the family that runs it — so the lots are handed out against
    // one demand ("how many households still need a house"), never against a
    // house-per-household PLUS a workshop-per-trade that counted the same family
    // twice. `owed` is who has nowhere yet; it shrinks as the lots are claimed.
    //
    // The LAST free lot belongs to whoever is still in it. A workshop or a named
    // place that would leave a family with no bed does not take the final lot;
    // the house does, and the merge below puts every remaining household under
    // that one roof rather than dropping any of them. That is a floor, not a
    // priority: while there is more than one lot left, places and specials claim
    // theirs in the order they always have.
    /** Lots to hold back: one, whenever `stillOwed` people would otherwise be
     *  left with nowhere to sleep. ONE rule, read by both claimants below. */
    const reserve = (stillOwed) => (stillOwed > 0 ? 1 : 0);
    let free = slots.length;
    // Which places get lots, and only THEN who is left needing a house — the two
    // define each other, and this is the order that unties them. Holding a lot
    // back can only ever strand MORE people (one fewer place is built), so a
    // reservation judged against the most generous split is still right after it
    // is applied: no fixed point to iterate.
    const generous = interiorPlaces.slice(0, Math.min(interiorPlaces.length, free));
    const placeLots = Math.max(0, free - reserve(townHouseholds(generous).length));
    const placesBuilt = interiorPlaces.slice(0, Math.min(interiorPlaces.length, placeLots));
    free -= placesBuilt.length;
    const households = townHouseholds(placesBuilt);
    const owed = new Set(households);
    /** The household a special HOUSES: only a live-work premises the compiler
     *  mints itself, and only when its owner actually lives at the settlement
     *  root. An owner homed at a named place lives there already, so their
     *  building is a pure workplace and houses nobody. */
    const liveWorkHousehold = (entry) =>
      LIVE_WORK_SPECIALS.has(entry.special) && SELF_LOT_INTERIORS[entry.special] && entry.owner.home === brief.name
        ? entry.owner.household
        : null;

    // {special, owner, boundPlace} — boundPlace set when it shares a named
    // place's facade (and so claims no lot of its own).
    const specialsBuilt = [];
    for (const entry of specials) {
      const boundPlace = placesBuilt.find((place) => interiorKindForSpecial(entry.special) === place.kind) ?? null;
      if (boundPlace) {
        specialsBuilt.push({ ...entry, boundPlace, household: null });
        continue;
      }
      // The place exists but never claimed a lot, so there is nothing to keep:
      // a place-bound special has no facade of its own to fall back on.
      if (PLACE_BOUND_SPECIALS.has(entry.special)) continue;
      const household = liveWorkHousehold(entry);
      const houses = household !== null && owed.has(household);
      // Skipped rather than broken out of: a later special that houses the last
      // owed household needs no reservation and can still take the lot.
      if (free < 1 + reserve(owed.size - (houses ? 1 : 0))) continue;
      free--;
      if (houses) owed.delete(household);
      specialsBuilt.push({ ...entry, boundPlace: null, household: houses ? household : null });
    }
    // Merge over-subscribed households into shared blocks: a merged household
    // keeps every member housed (never dropped), just under a shared roof. The
    // reservation above guarantees at least one lot here whenever anyone is owed
    // one, so the merge always has somewhere to merge INTO.
    const dwellingHouseholds = households.filter((household) => owed.has(household));

    const dwellingSlots = Math.min(free, dwellingHouseholds.length);
    const householdGroups = [];
    // Round-robin, so over-subscription SHARES rather than stacks. This used to
    // pile every household past the last lot onto that lot — twelve families in
    // one house and eleven houses holding one each — which is a dormitory
    // wherever it happens rather than only where the ground is genuinely that
    // tight. Spread evenly it is an address holding more than one household,
    // which is what a dense settlement is made of.
    //
    // Identical when there is only one lot to merge into: `index % 1` is always
    // zero, so a settlement squeezed down to its last lot still builds the
    // bunkhouse it always did.
    for (const [index, household] of dwellingHouseholds.entries()) {
      const slot = dwellingSlots > 0 ? index % dwellingSlots : 0;
      (householdGroups[slot] ??= []).push(household);
    }
    // Head-room over a lot. A tall building grows UPWARD so its door stays on the
    // row the rest of the lot geometry expects — the apron, the portal's outside
    // tile and the owner's wander box are all measured from the door. Upward it
    // stops two rows short of the border ring (whose canopies are overhead too, and
    // a roof would erase them) in the top row, and clear of the crossroad in the
    // bottom one: a roofed road reads as a tunnel. An outpost's rows sit tight
    // against both, so there the clamp is simply zero and the facade carries it.
    // How many rows a facade may rise before its eave hits something. The floors
    // look conservative and are not: above the road the eave must leave a CLEAR
    // row under the border ring, because the ring is overhead tiles too and a
    // roof laid against it reads as one continuous mass. Relaxing 4 to 3 on the
    // reasoning that "the eave only has to stay off row 0" put a hamlet church's
    // eave on row 1 and merged it into the trees.
    const headroom = (slotY) => Math.max(0, slotY - (slotY > midY ? midY + 3 : 4));
    for (const place of placesBuilt) {
      const slot = takeSlot();
      if (!slot) break;
      const tall = place.kind === "sanctuary";
      const width = place.kind === "hall" || tall ? 8 : 7;
      // Every row a sanctuary wins goes to the facade, never the roof: the
      // roofline stays two rows deep and the extra height is all stonework.
      const rise = tall ? Math.min(2, headroom(slot.y)) : 0;
      const height = 5 + rise;
      const top = slot.y - rise;
      const b = building(
        v,
        slot.x,
        top,
        width,
        height,
        3,
        [1, 5],
        tall ? { facade: 2 + rise, facadeWindows: [3, 4] } : undefined,
      );
      buildings.push({ door: b, rect: { x: slot.x, y: top, w: width, h: height }, boundPlace: place });
    }
    // A trade's premises is sized by the trade, for the same reason a house is
    // sized by its household: every workplace at 6x4 made the working half of a
    // settlement as uniform as the sleeping half. A farm has a yard's worth of
    // frontage, a smith needs floor for the work, and a duty station is a hut with
    // a door — the smallest thing anybody builds on purpose. Beside the loop
    // rather than inside it, where `FEATURE_RECTS` and the other layout tables
    // live.
    const SPECIAL_FOOTPRINT = {
      farm: { w: 8, h: 5 },
      shop: { w: 7, h: 5 },
      post: { w: 5, h: 4 },
    };
    for (const { special, owner, boundPlace, household } of specialsBuilt) {
      // A special whose interior already exists as a place shares that facade.
      if (boundPlace) {
        const bound = buildings.find((b) => b.boundPlace === boundPlace);
        if (bound) bound.owner = owner;
        continue;
      }
      const slot = takeSlot();
      if (!slot) break;
      // ...but not on ground that cannot spare it. An outpost is 28x20, and a
      // farm with a full frontage there takes the room its named features were
      // going to stand on — measured: two of two refused. A frontier smithy is a
      // shed, which is the truthful answer as well as the one that fits.
      const roomy = brief.scale !== "outpost" && brief.scale !== "hamlet";
      const foot = (roomy && SPECIAL_FOOTPRINT[special]) || { w: 6, h: 4 };
      const b = building(v, slot.x, slot.y, foot.w, foot.h, 2, foot.h > 4 ? [1, 4] : [4]);
      buildings.push({
        door: b,
        rect: { x: slot.x, y: slot.y, w: foot.w, h: foot.h },
        special,
        owner,
        // A live-work premises carries its owner's household: the same field a
        // dwelling uses, so one interior pass sleeps both and the "who lives
        // here" lookups in the cast loop need to know nothing about specials.
        ...(household === null ? {} : { households: [household] }),
      });
    }
    for (const group of householdGroups) {
      const slot = takeSlot();
      if (!slot) break;
      // SIZE FOLLOWS PROGRAM. A house used to be 6x4 unless the merge widened it,
      // so a town was thirty identical boxes on a grid and read as one building
      // stamped out — which is most of what "it looks like a game from 1996"
      // actually is. A roof is now sized by what has to fit under it: the people
      // who sleep there, and how many households share the address.
      //
      // Width 5..8 is the lot (MAX_LOT_W), and the height is the honest half —
      // a fourth row is a second band of rooms, so a big household reads taller
      // as well as wider from across the square. Five still fits BUILDING_H, so
      // the eave clears the lot above exactly as a four-row body does.
      const souls = roster.filter(
        (m) => (m.standing ?? "resident") === "resident" && group.includes(m.household),
      ).length;
      const width = PF.clamp(5 + Math.ceil(souls / 2) + (group.length > 1 ? 1 : 0), 5, MAX_LOT_W);
      const height = souls >= 4 || group.length > 1 ? 5 : 4;
      const b = building(v, slot.x, slot.y, width, height, 2, height > 4 ? [1, 4] : [1]);
      buildings.push({ door: b, rect: { x: slot.x, y: slot.y, w: width, h: height }, households: group });
    }

    // ── Transient merchants set up a light market stall in a free lot (never a
    // permanent shop). They tend it; with no free lot they fall back to the
    // public rest spot in the cast loop. Other non-resident kinds build nothing.
    const stalls = [];
    for (const member of roster) {
      if ((member.standing ?? "resident") !== "transient" || member.kind !== "merchant") continue;
      const slot = takeSlot();
      if (!slot) break;
      PLACERS["market-stalls"](v, slot.x, slot.y);
      stalls.push({ owner: member, x: slot.x, y: slot.y });
    }

    // ── Features: corner anchors, but NEVER over a building or another
    // feature. Buildings claim their footprint plus the roof overhang above and
    // a door apron below — a placer that fenced over a hall's only door
    // orphaned the zone and the NPC inside it (review blocker). A feature with
    // no clear anchor is dropped: a plainer settlement, never a sealed one.
    const claimed = buildings
      // What a building ACTUALLY occupies: its overhang two rows above, its solid
      // body, and the door apron one row below — y-2 through y+h. The old rect
      // padded a further row top and bottom and a column each side, which is
      // breathing room rather than footprint, and on a small map that padding is
      // the difference between a feature fitting and being dropped. Measured at
      // hamlet: two of four features placed with the padding, four without it.
      .map((b) => ({ x: b.rect.x, y: b.rect.y - 2, w: b.rect.w, h: b.rect.h + 3 }))
      .concat(stalls.map((s) => ({ x: s.x - 1, y: s.y - 1, w: 7, h: 5 })));
    const intersects = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const featureAnchors = [
      { x: 4, y: 3 },
      { x: v.w - 12, y: 3 },
      { x: v.w - 12, y: v.h - 8 },
      { x: 4, y: v.h - 8 },
    ];
    // WHAT EACH FEATURE ACTUALLY PAINTS. One 9x6 rect used to stand for all of
    // them, and it was a fiction: `market-stalls` paints three tables on a
    // single row and `landmark-stone` paints ONE tile. Both were being refused
    // for want of fifty times the ground they use, which is most of why a
    // village placed nothing — its lot claims leave gaps, just not 9x6 ones.
    //
    // Each rect is the placer's true extent plus a one-tile margin, so a feature
    // still never abuts a wall. Keyed by tag with a conservative default, so a
    // new tag is safe before anyone measures it.
    const FEATURE_RECTS = {
      "water-feature": { w: 8, h: 5 }, // 6x4 pool + the well at x+6
      "crop-plots": { w: 9, h: 6 }, // the fenced plot is the big one: 8x5
      "market-stalls": { w: 6, h: 2 }, // three tables on one row
      workyard: { w: 6, h: 5 },
      "landmark-stone": { w: 3, h: 3 }, // a single stone
      shrine: { w: 4, h: 4 },
      ruin: { w: 6, h: 5 },
      lookout: { w: 4, h: 4 },
    };
    const FEATURE_RECT = { w: 9, h: 6 };
    // The four corners are the PREFERRED anchors — they are what gives a
    // settlement its recognisable shape — but there are only four of them and a
    // row of lots sits directly under two. Once the buildings claim their
    // footprints the corners go with them, and every named feature the model
    // authored vanished with no error and no trace. Measured, with all four
    // declared together: 0 of 4 placed at a village, 2 of 4 at an outpost, a
    // hamlet and a town. Only a city had room, which is exactly the wrong way
    // round — and the brief tells the model its features WILL exist.
    //
    // So a SCAN is the floor under the corners: the first free 9x6 anywhere on
    // the map. Rows are walked from the outside in — top edge, bottom edge, then
    // inward — so a displaced feature still rings the settlement the way a
    // corner one does instead of clumping in the middle of the green.
    //
    // A small settlement still places fewer than a large one, because there is
    // genuinely less ground; what it no longer does is place none.
    // The two ARTERIES only. The plaza is deliberately NOT excluded: a market or
    // a well standing in the square is right rather than wrong, and on a small
    // map an 8x8 plaza reaches every corner rect, so excluding it took an
    // outpost from two features to none.
    const roads = [
      { x: 2, y: midY - 1, w: v.w - 4, h: 2 },
      { x: midX - 1, y: 2, w: 2, h: v.h - 4 },
    ];
    const anchorFree = (x, y, size) => {
      const rect = { x, y, ...size };
      return !claimed.some((busy) => intersects(rect, busy)) && !roads.some((busy) => intersects(rect, busy));
    };
    // Outside-in row order, computed once. The corners already avoid the roads
    // at every scale the tables offer, so adding that test to them changes no
    // placement that works today — it only stops the scan paving the crossroad.
    // Outside-in row order: top edge, bottom edge, then inward, so a displaced
    // feature still rings the settlement the way a corner one does rather than
    // landing in the middle of the green. Bounded by the tallest footprint, and
    // the per-feature test below is what actually decides a fit.
    // Outside-in, and sized PER FEATURE. This bound used to be a fixed `v.h - 9`
    // — the row a 6-tall crop plot must start above — applied to every tag
    // regardless of height, so a 2-tall market stall was refused every row a
    // crop plot could not use. On a short map that is most of the south half:
    // measured at hamlet, one feature of four placed until this was per-size.
    const scanRowsFor = (size) => {
      const rows = [];
      // The last row a rect may START on: it occupies y .. y + h - 1, and the
      // last usable row is v.h - 3 (the apron and the border ring take the two
      // below it). So the bound is v.h - 2 - h, not v.h - 3 - h — one row short
      // cost a hamlet the entire strip south of its buildings, which is the only
      // open ground a short feature had left.
      for (let top = 3, bottom = v.h - 2 - size.h; top <= bottom; top++, bottom--) {
        rows.push(top);
        if (bottom !== top) rows.push(bottom);
      }
      return rows;
    };
    for (const feature of brief.features) {
      const size = FEATURE_RECTS[feature.tag] ?? FEATURE_RECT;
      let anchor = featureAnchors.find((candidate) => anchorFree(candidate.x, candidate.y, size));
      if (!anchor) {
        for (const y of scanRowsFor(size)) {
          for (let x = 4; x + size.w <= v.w - 3; x++) {
            if (!anchorFree(x, y, size)) continue;
            anchor = { x, y };
            break;
          }
          if (anchor) break;
        }
      }
      if (!anchor) continue; // genuinely nowhere left: a plainer settlement, never a sealed one
      PLACERS[feature.tag]?.(v, anchor.x, anchor.y);
      claimed.push({ x: anchor.x, y: anchor.y, ...size });
      // The register gets its own rect object rather than the one `claimed`
      // holds: the two lists have different lifetimes and aliasing them would
      // make a future edit to either quietly reach into the other.
      recordFeature(v, feature, { x: anchor.x, y: anchor.y, ...size });
    }
    const doorRects = buildings.map((b) => ({ x: b.door.doorX, y: b.door.doorY }));
    const stallReserved = stalls.flatMap((s) => [
      { x: s.x, y: s.y + 1 },
      { x: s.x + 2, y: s.y + 1 },
      { x: s.x + 4, y: s.y + 1 },
    ]);
    // Keep the strip beside each shop door clear so an outside loiterer has ground.
    const shopFrontReserved = buildings
      .filter((b) => b.special === "shop" || b.boundPlace?.kind === "workshop")
      .map((b) => ({ x: b.door.doorX + 2, y: b.door.doorY + 1 }));
    // The approach road each wilds comes back onto. The wilds pass runs AFTER
    // this scatter and opens the border ring at the map edge, but the tile the
    // portal actually delivers the player to is the ROAD tile one column inside
    // it — which nothing reserved, so a scattered trunk could land exactly there
    // and the walk home arrived inside a tree. East for the first wilds, west for
    // the second, mirroring the portal wiring below.
    const wildsArrivals = wildsPlaces.flatMap((_, index) =>
      [midY - 1, midY].map((y) => ({ x: index === 0 ? v.w - 2 : 1, y })),
    );
    scatterTrees(
      v,
      rnd,
      { woods: 26, fields: 8, rocky: 10, water: 12, barren: 5 }[brief.surround] ?? 12,
      doorRects.concat(
        doorRects.map((d) => ({ x: d.x, y: d.y + 1 })),
        stallReserved,
        shopFrontReserved,
        wildsArrivals,
      ),
    );
    // ── Open ground ────────────────────────────────────────────────────────────
    // What a settlement does with a lot it did not build on, and it is not the
    // same answer everywhere. A village leaves kitchen gardens between its
    // houses; a town does not have a lawn around every door, because the ground
    // between terraces is PUBLIC. So the loose ranks get fenced gardens and the
    // dense ones get parks, on the lots the buildings never claimed.
    //
    // Every third leftover and no more than six, deliberately: a settlement that
    // turned every spare lot into a park would be a park with houses in it, and
    // the empty ground between buildings is doing work of its own.
    // LEFTOVER IS NOT THE SAME AS EMPTY, and the difference is a named feature.
    //
    // The greens and the wards are handed the lots no BUILDING took and trust
    // that to mean nothing is there. It is true of buildings — they are disjoint
    // from these lots by construction — and false of features, which are anchored
    // by a different pass that tests `claimed` and the roads but NOT the lot grid,
    // so a ruin or a shrine legitimately stands on a lot nobody built on.
    // `clearFootprint` then nulls it. Measured: 40 of 108 worlds lost feature
    // tiles, 168 tiles in all — a named ruin coming out half-eaten, with its name
    // still in the sealed brief and its id still in `_ids.features`.
    //
    // `claimed` already carries the feature rects (they are pushed as each one
    // lands), so respecting it is the whole fix. `y - 1` and `h: 6` because
    // `clearFootprint` reaches one row above its rect.
    const leftoverLots = slots
      .slice(slotIndex)
      .filter((lot) => !claimed.some((busy) => intersects({ x: lot.x, y: lot.y - 1, w: 8, h: 6 }, busy)));
    const denseRank = brief.scale === "town" || brief.scale === "city";

    // ── WARDS ──────────────────────────────────────────────────────────────────
    // A city is 104x72, and its one plaza sits at the crossroad — which is a long
    // walk from three quarters of the map. So a city carves WARDS: one square per
    // quadrant, each with its own well, and the residents of that quarter keep it
    // rather than all walking to the middle of town.
    //
    // Only where it is a real problem. A village has one centre because a village
    // IS one centre, and giving it four would be four empty squares.
    const wards = [];
    if (brief.scale === "city") {
      const taken = new Set();
      for (const [qx, qy] of [
        [0.25, 0.25],
        [0.75, 0.25],
        [0.25, 0.75],
        [0.75, 0.75],
      ]) {
        const cx = v.w * qx;
        const cy = v.h * qy;
        let best = -1;
        let bestD = Infinity;
        leftoverLots.forEach((lot, index) => {
          if (taken.has(index)) return;
          const d = (lot.x + 4 - cx) ** 2 + (lot.y + 2 - cy) ** 2;
          if (d < bestD) {
            bestD = d;
            best = index;
          }
        });
        if (best < 0) continue;
        taken.add(best);
        const lot = leftoverLots[best];
        PLACERS["ward-square"](v, lot.x, lot.y);
        wards.push({
          x: lot.x + 3,
          y: lot.y + 2,
          wander: {
            x0: Math.max(2, lot.x),
            y0: Math.max(2, lot.y),
            x1: Math.min(v.w - 3, lot.x + 7),
            y1: Math.min(v.h - 3, lot.y + 4),
          },
        });
      }
      // The greens take what the wards did not.
      for (let i = leftoverLots.length - 1; i >= 0; i--) if (taken.has(i)) leftoverLots.splice(i, 1);
    }

    let greens = 0;
    for (let i = 0; i < leftoverLots.length && greens < 6; i += 3) {
      const lot = leftoverLots[i];
      PLACERS[denseRank ? "park" : "crop-plots"](v, lot.x, lot.y);
      greens++;
    }
    // ── THE SQUARE ─────────────────────────────────────────────────────────────
    // A plaza was eight by eight tiles of paving and nothing else — the one place
    // in a settlement everybody walks through, and the only one with nothing in
    // it. Every settlement gets its well: it is the oldest reason for a village
    // to have a centre at all, and it gives the square something to be the middle
    // OF. A thriving one lays market boards beside it.
    //
    // AFTER the buildings, not before. Laid before them, an outpost — whose lots
    // sit tight against the crossroad on a 28x20 map — simply built a house over
    // the well and the square came out empty on exactly the settlements that
    // could least afford to lose it. So each piece checks the ground is still
    // free, and a square with no room for a well honestly has none.
    const squareTile = (x, y, what) => {
      if (x < 1 || y < 1 || x >= v.w - 1 || y >= v.h - 1) return false;
      const at = idx(v, x, y);
      if (v.solid[at] || v.object[at] || v.overhead[at]) return false;
      put(v, x, y, "object", what, true);
      return true;
    };
    // All four quadrants tried in turn, not just the north-east one. An outpost's
    // lots sit tight against the crossroad, so its first choice is often inside
    // somebody's front room, and one refusal used to leave the smallest
    // settlements — the ones that can least afford a bare square — with no well
    // at all.
    const QUADRANTS = [
      [midX + 2, midY - 3],
      [midX - 3, midY - 3],
      [midX + 2, midY + 2],
      [midX - 3, midY + 2],
    ];
    const well = QUADRANTS.find(([x, y]) => squareTile(x, y, "well"));
    if (well) v.lights.push({ x: well[0], y: well[1] });
    if (brief.prosperity === "thriving") {
      let boards = 0;
      for (const [x, y] of QUADRANTS) {
        if (boards >= 2) break;
        if (well && x === well[0] && y === well[1]) continue;
        if (squareTile(x, y, "table")) boards++;
      }
    }
    // Last thing done to the settlement's tiles, so it sees the trees, the
    // buildings, the stalls, the features and the greens together — a pocket is
    // usually made by two of them meeting, not by either alone.
    sealPockets(v, v.spawn);
    zones.z1 = v;

    // ── Interior zones ──
    const bedFor = new Map(); // cast member -> {zoneId, x, y}, their own bed tile
    /** Everyone sleeping under one roof, THE OWNER FIRST. The owner is the cast
     *  member who runs the building — the one the specials pass bound to it — and
     *  never merely whoever happens to come first in the cast, so a building that
     *  houses a household with no owner among them lays no private room and the
     *  ordinary rules apply. Order matters twice over: the private room is first
     *  in the run, and beds are dealt to this list in order. */
    const ownerFirst = (residents, owner) =>
      owner && residents.includes(owner) ? [owner, ...residents.filter((m) => m !== owner)] : residents;
    for (const place of interiorPlaces) {
      const id = zoneIdForPlace(place);
      if (!id) continue;
      // An interior only exists if it claimed a facade: its door IS the portal.
      // The facade loop above stops when the building lots run dry (a small
      // outpost has fewer lots than CAPS.places allows), and compiling the zone
      // anyway produced a named, NPC-populated room with no door in either
      // direction — anyone homed there was stranded and un-talkable forever.
      // Same policy as an unanchorable feature: dropped, never sealed.
      const facade = buildings.find((b) => b.boundPlace === place);
      if (!facade) continue;
      // Guest rooms are sized to what the house was BUILT for and not to
      // tonight's guest list (see GUEST_BERTHS), so the wing is the same wing on
      // a quiet night as on a full one and the transients the brief did bring
      // compete for berths that were already there.
      //
      // Who the BRIEF homed in this building. `home` naming a place is the
      // sanctioned way to say "this person lives here" — the chaplain in her own
      // church, the alewife over her own tap room — so the building has to sleep
      // them. Without this they stood on the bare floor of the building they live
      // in at midnight, which is the exact opposite of what the rooms were for.
      const residents = roster.filter(
        (member) => (member.standing ?? "resident") === "resident" && zoneIdByName.get(member.home) === id,
      );
      const living = ownerFirst(residents, facade.owner);
      const zone = interiorRoom(id, place.name, place.kind, {
        // Guest berths are the GATHERING's alone — what a settlement of this size
        // and means was built to offer travellers. Nothing else rents rooms, so
        // nothing else lays them; a house or a church sleeps only its own people.
        sleepers: place.kind === "gathering" ? guestBerths(brief) : 0,
        residents: living.length,
        owned: living[0] === facade.owner && !!facade.owner,
        seed,
        prosperity: brief.prosperity,
      });
      zone.flavor = place.flavor;
      zones[id] = zone;
      // WHERE THE OWNER OF THIS ROOM WORKS. A place-bound facade never goes
      // through the minted-building loop below (it has no `special` and no
      // `households`), so its `interior` handle was never set at all — and the
      // cast loop's promotion gates on `owned.interior?.post`. An innkeeper the
      // brief homed at the SETTLEMENT rather than at the inn therefore stood on
      // the door apron of the building they run for the whole of daylight, with
      // the lit common room and the counter behind them; a sanctuary's keeper did
      // the same on the church step, and the keeper schedule tier holds them
      // there dawn to dusk. Both default briefs home their host at the root, so
      // this was every default world.
      //
      // The station comes off the ZONE because the furnisher is what knows it.
      // Same handle shape the minted loop builds, so the promotion needs no
      // second branch — and kinds whose furnisher laid no station leave `post`
      // undefined, which the promotion's optional chain reads as "keep the door
      // apron": a hall or a workshop has no counter to be manned and gains
      // nothing by pretending to.
      facade.interior = { zoneId: id, post: zone.post };
      // A floor is a zone like any other from here on — it is only ever reached
      // through its stairs, and it carries its own mapExport = false.
      for (const floor of zone.floors) zones[floor.id] = floor;
      linkInterior(v, zone, facade.door, `Enter ${place.name}`);
      // Their own bed each, out of the quarters and never out of the guest
      // berths — the two lists are carved from different bands (interiorRoom).
      // The record names its own zone, because a band can be a floor away.
      living.forEach((member, index) => {
        const bed = zone.homeBeds[index];
        if (bed) bedFor.set(member, bed);
      });
    }

    // ── Wilds zones, hung off alternating map edges ──
    wildsPlaces.forEach((place, index) => {
      const id = zoneIdForPlace(place);
      if (!id) return;
      const zone = makeZone(id, place.name, 36, 24, "grass");
      for (let i = 0; i < zone.ground.length; i++) if (rnd() < 0.4) zone.ground[i] = "grass2";
      borderTrees(zone);
      const wMidY = 12;
      const east = index === 0;
      // The road home runs from the portal side: west-hung wilds mirror the
      // approach so arrival never lands in scatter (review finding).
      if (east) fillRect(zone, 1, wMidY, 19, 2, "ground", "path");
      else fillRect(zone, zone.w - 20, wMidY, 19, 2, "ground", "path");
      const tags = new Set((place.features ?? []).map((f) => f.tag));
      if (tags.has("water-crossing")) {
        fillRect(zone, 20, 1, 2, 22, "ground", "water", true);
        PLACERS["water-crossing"](zone, 20, wMidY);
        fillRect(zone, 22, wMidY, 4, 2, "ground", "path");
        // THE SITE THAT OWES THE CROSSING ITS ROW. The stream is painted HERE,
        // by the builder, and the feature loop below skips `water-crossing`
        // outright — the placer's whole job on that tag is the 2x2 ford. So no
        // placement loop ever sees this feature, and without this line a
        // brief-built stream would be water nothing knows the name of while a
        // legacy one fishes. Rect = the stream literal three lines up.
        const crossing = place.features.find((feature) => feature.tag === "water-crossing");
        recordFeature(zone, crossing, { x: 20, y: 1, w: 2, h: 22 });
      }
      // GROUND THE WILDS CANNOT GIVE AWAY. A feature here used to be dropped at a
      // hard-coded anchor with no test of anything — not the road it had just
      // laid, not the stream, not the spawn, not the tile the portal delivers the
      // player onto. The settlement pass has tested its anchors against the roads
      // and the claimed lots for a long time; this one never did, and it is the
      // only builder that pass missed.
      //
      // What that cost: `crop-plots` is a fenced 8x5, and at anchor 26 its fence
      // lands on x 26..33, which is exactly where a WEST-hung wilds puts its
      // spawn (w-4) and one of its two arrival tiles (w-3). The player walks west
      // out of town, arrives inside a solid fence, and every direction is refused
      // — measured on the real Sim, four directions x two seconds of held input,
      // zero pixels. Reloading does not help: the save falls back to `zone.spawn`,
      // which is the other fence tile. 24 of 48 wilds zones on staging, so this
      // ships today and is not something this branch introduced.
      // The APPROACH ROAD is held separately from the rest of the reservation
      // because it is the one rect the bridge ruling can negotiate away (below).
      // The other two are the tiles the portal delivers the player onto and the
      // spawn beside them, and no ruling makes those negotiable: a pool that
      // swallowed an arrival tile would be a decked-over doorstep at best.
      const wildsRoad = east ? { x: 1, y: wMidY, w: 19, h: 2 } : { x: zone.w - 20, y: wMidY, w: 19, h: 2 };
      const wildsReserved = [wildsRoad, { x: 1, y: wMidY, w: 4, h: 2 }, { x: zone.w - 5, y: wMidY, w: 4, h: 2 }];
      if (tags.has("water-crossing")) {
        wildsReserved.push({ x: 20, y: 1, w: 2, h: 22 }, { x: 20, y: wMidY, w: 6, h: 2 });
      }
      let anchorX = 26;
      for (const feature of place.features ?? []) {
        if (feature.tag === "water-crossing") continue;
        const size = FEATURE_RECTS[feature.tag] ?? FEATURE_RECT;
        // The anchor SEQUENCE is unchanged, so a wilds whose features already fit
        // compiles exactly what it did. Only an anchor that would block the way
        // is stepped over, and a feature with nowhere safe is dropped — the same
        // policy the settlement states as "a plainer settlement, never a sealed
        // one", which reads here as a plainer wood.
        //
        // …EXCEPT THAT WATER COULD NEVER FIT, which is what the bridge ruling
        // answers. The scan offers rows 8..11 and nothing else, an 8x5 rect
        // starting on any of them reaches the road band at y12..13, and the road
        // was reserved outright — so a wilds `water-feature` was refused on every
        // seed and the brief's pool simply never existed. Under the ruling the
        // road is decked rather than blocked, so it stops being a reason to
        // refuse the anchor.
        //
        // A SECOND PASS, not a widened first one, and that distinction is the
        // whole of the byte-stability story: the strict eight run first and
        // unchanged, so a pool that already found dry ground still finds the same
        // ground. Only after they are spent does the road come off the table, and
        // only for water — every other tag keeps its eight attempts exactly.
        const attempts = feature.tag === "water-feature" ? 16 : 8;
        for (let attempt = 0; attempt < attempts; attempt++) {
          const ax = anchorX;
          const ay = 8 + (((ax / 3) | 0) % 4);
          anchorX = Math.max(6, (anchorX + 9) % (zone.w - 10));
          if (ax < 1 || ay < 1 || ax + size.w > zone.w - 1 || ay + size.h > zone.h - 1) continue;
          const busy = attempt < 8 ? wildsReserved : wildsReserved.filter((rect) => rect !== wildsRoad);
          if (busy.some((r) => intersects({ x: ax, y: ay, ...size }, r))) continue;
          PLACERS[feature.tag]?.(zone, ax, ay);
          recordFeature(zone, feature, { x: ax, y: ay, ...size });
          break;
        }
      }
      // Reserve BOTH sides' arrival tiles and spawns — the west-hung wilds'
      // arrival used to land inside scattered trunks on some seeds.
      scatterTrees(zone, rnd, tags.has("dense-growth") ? 70 : 45, [
        { x: 1, y: wMidY },
        { x: 1, y: wMidY + 1 },
        { x: 2, y: wMidY },
        { x: 3, y: wMidY },
        { x: 20, y: wMidY },
        { x: 21, y: wMidY + 1 },
        { x: zone.w - 2, y: wMidY },
        { x: zone.w - 2, y: wMidY + 1 },
        { x: zone.w - 3, y: wMidY },
        { x: zone.w - 4, y: wMidY },
      ]);
      // Set BEFORE the pockets are closed, not after. The west wilds moves its
      // spawn to the far side further down, and sealing from the east side first
      // would mark the west half — the future spawn and the tile the portal
      // actually delivers the player onto — solid whenever the scatter happens to
      // separate the two.
      zone.spawn = east ? { x: 3, y: wMidY } : { x: zone.w - 4, y: wMidY };
      sealPockets(zone, zone.spawn);
      // Two-tile edge portals: east edge of the settlement for the first wilds,
      // west edge for the second.
      const vx = east ? v.w - 1 : 0;
      const vroadX = east ? v.w - 2 : 1;
      fillRect(v, east ? v.w - 2 : 0, midY - 1, 2, 2, "ground", "path");
      for (const dy of [0, 1]) {
        put(v, vx, midY - 1 + dy, "object", null, false);
        put(v, vx, midY - 1 + dy, "overhead", null);
        put(zone, east ? 0 : zone.w - 1, wMidY + dy, "object", null, false);
        put(zone, east ? 0 : zone.w - 1, wMidY + dy, "overhead", null);
        v.portals.push({
          x: vx,
          y: midY - 1 + dy,
          toZone: id,
          toX: east ? 2 : zone.w - 3,
          toY: wMidY + dy,
          label: `Into ${place.name}`,
        });
        zone.portals.push({
          x: east ? 0 : zone.w - 1,
          y: wMidY + dy,
          toZone: "z1",
          toX: vroadX,
          toY: midY - 1 + dy,
          label: `Back to ${brief.name}`,
        });
      }
      // (the west spawn is set above, before sealPockets reads it)
      zone.flavor = place.flavor;
      zone.mapKind = "place"; // World Maps export kind (spec §8)
      zones[id] = zone;
    });

    // ── Dwelling and workplace interiors ──
    // Until now a dwelling was a facade with nothing behind it, so a resident the
    // schedule sent home at night had nowhere to BE and "turned in" rendered as
    // hugging their own doorstep. Every dwelling and every live-work premises now
    // opens, on the building's existing door, and each resident gets a bed of
    // their own inside — the smith's child sleeps in the smithy by exactly the
    // same rules as any other family, because it is the same call.
    //
    // None claims a World Maps row (spec §8): a building is ONE location and
    // these are rooms inside one, not destinations. Only a NAMED brief place is a
    // destination — and the locations route is additive with NO delete, so a row
    // written to a player's real map is permanent and the gate has to be right
    // the first time.
    for (const b of buildings) {
      // A special is its own lot (a bound one hangs off the place's facade and is
      // built by the places pass), so its interior is whatever SELF_LOT_INTERIORS
      // gives it; everything else with people under it is a dwelling.
      const interior = b.special ? SELF_LOT_INTERIORS[b.special] : b.households ? { kind: "dwelling" } : null;
      if (!interior) continue;
      // Everyone sleeping under this roof, in cast order — the same predicate
      // `households` was derived from, so the room's beds and the lot arithmetic
      // can never disagree about who lives here.
      const residents = roster.filter(
        (m) =>
          (m.standing ?? "resident") === "resident" &&
          (m.home === brief.name || strandedFrom(m, placesBuilt)) &&
          (b.households ?? []).includes(m.household),
      );
      // A dwelling keys on the LOWEST household number under its roof and a
      // workplace on its owner's cast ordinal (the number their NPC id carries):
      // sealed brief data either way, so the id is stable across rebuilds and
      // additive against saved zone ids (60-save restores a zone by id). A loop
      // counter would move the moment a household merged differently.
      const id = b.special ? `s${roster.indexOf(b.owner) + 1}` : `h${Math.min(...b.households)}`;
      const name = b.special ? `${b.owner.name}'s ${interior.label}` : `${residents[0]?.name ?? brief.name}'s home`;
      // A live-work premises houses the tradesman who runs it, so they get the
      // private room too — the same rule as a keeper's, for the same reason.
      const sleepers = ownerFirst(residents, b.owner);
      const zone = interiorRoom(id, name, interior.kind, {
        sleepers: sleepers.length,
        owned: sleepers[0] === b.owner && !!b.owner,
        // A block the over-subscription merge put more than one household under
        // is a big house whatever tonight's headcount is, so it earns its stairs
        // on the same footing as a large one (see upperPlan).
        merged: (b.households ?? []).length > 1,
        seed,
        prosperity: brief.prosperity,
      });
      zone.mapExport = false;
      zones[id] = zone;
      for (const floor of zone.floors) zones[floor.id] = floor;
      linkInterior(v, zone, b.door, "Go inside");
      // Behind the counter, between it and the stock: the one row that reads as
      // manning a shop rather than browsing it. Only the kinds with a station to
      // man have one (WORK_POSTS).
      b.interior = { zoneId: id, post: WORK_POSTS[b.special]?.(zone.w, zone.h) };
      // One bed each — never a shared tile: two sprites on one tile makes the
      // lower one un-talkable, which is precisely what a bedroom would cause.
      sleepers.forEach((member, index) => {
        const bed = zone.beds[index];
        if (bed) bedFor.set(member, bed);
      });
    }

    // ── The cast ──
    // Residents wander near their building (or the plaza if house-less).
    // Non-residents never bind to a dwelling; they anchor by standing to a
    // predictable rest spot: transient -> the inn (gathering interior), fringe ->
    // the wilds (else the settlement's outer margin), destitute -> the town's
    // public center. See docs/brief-schema.md § Standing.
    const gatheringPlace = interiorPlaces.find((p) => p.kind === "gathering");
    const gatheringZoneId = gatheringPlace ? zoneIdForPlace(gatheringPlace) : null;
    const wildsZoneId = wildsPlaces.length ? zoneIdForPlace(wildsPlaces[0]) : null;
    const plazaBox = () => ({ x0: midX - 6, y0: midY - 5, x1: midX + 6, y1: midY + 5 });
    /** The stretch of street outside one door. The plaza is thirteen tiles by
     *  eleven; a thriving city now holds a hundred people, and sending all of
     *  them to the same square at noon builds a crush in the middle of an empty
     *  map rather than a city. The brief's OWN cast still keeps the square —
     *  they are the people a player came to meet — while everybody the compiler
     *  minted holds their own street, so the whole town reads as lived in. */
    const streetBox = (rect) => ({
      x0: Math.max(2, rect.x - 3),
      y0: Math.max(2, rect.y - 2),
      x1: Math.min(v.w - 3, rect.x + rect.w + 2),
      y1: Math.min(v.h - 3, rect.y + rect.h + 3),
    });
    // The walkable middle of a zone — but only the COMMON half of one that has
    // rooms partitioned into it. A private room is somewhere an NPC is SENT (a
    // bed, at night), never somewhere they drift: standable() rules out door
    // tiles, so anyone who wandered into a bedroom could not walk back out of it
    // and would hold the room until the next daypart moved them.
    // The common floor south of every walled band. A SINGLE y-floor, which is
    // why a second band can invert it: `walkableIn` normalises the corners and
    // plants the NPC on the entry apron, while the sim's `inside` test reads the
    // RAW box — so the snap re-fires every daypart and every candidate step is
    // rejected. The NPC is not drifting; it is frozen on its own doormat. Today
    // the minimum slack across every compiled zone is ONE row.
    const fullZoneBox = (z) => {
      const y1 = z.h - 3;
      const y0 = z.rooms.reduce((floor, room) => Math.max(floor, room.y1 + 2), 2);
      if (y0 > y1) throw new Error(`pixelforge: ${z.id} has no common floor left for a wander box (${y0} > ${y1})`);
      return { x0: 2, y0, x1: z.w - 3, y1 };
    };
    // Transients loiter at a public spot — the inn, an existing resident shop's
    // front, or the plaza — spread across whatever the settlement has (seeded).
    const shopSpots = buildings
      .filter((b) => b.special === "shop" || b.boundPlace?.kind === "workshop")
      .map((b) => ({ door: b.door, interiorZoneId: b.boundPlace ? zoneIdForPlace(b.boundPlace) : null }));
    const loiterSpots = [];
    if (gatheringZoneId && zones[gatheringZoneId]) loiterSpots.push({ kind: "inn" });
    for (const shop of shopSpots)
      loiterSpots.push({ kind: "shop", door: shop.door, interiorZoneId: shop.interiorZoneId });
    loiterSpots.push({ kind: "plaza" });
    // The inn's guest beds, claimed in cast order as transients are placed —
    // a copy, because claiming shifts the list and the zone keeps its own.
    const guestBeds = gatheringZoneId && zones[gatheringZoneId] ? [...zones[gatheringZoneId].beds] : [];
    const loiterStart = PF.hashStr(`${seed >>> 0}|loiter`) % loiterSpots.length;
    let loiterN = 0;
    const loiterAnchor = () => {
      const spot = loiterSpots[(loiterStart + loiterN++) % loiterSpots.length];
      if (spot.kind === "inn") return { zone: zones[gatheringZoneId], wander: fullZoneBox(zones[gatheringZoneId]) };
      if (spot.kind === "shop") {
        // A shop with an interior (a workshop) — browse inside, like the inn.
        if (spot.interiorZoneId && zones[spot.interiorZoneId]) {
          const z = zones[spot.interiorZoneId];
          return { zone: z, wander: fullZoneBox(z) };
        }
        // A facade shop — loiter just BESIDE the door, never in the doorway.
        return {
          zone: v,
          wander: {
            x0: Math.min(v.w - 3, spot.door.doorX + 1),
            y0: Math.min(v.h - 3, spot.door.doorY + 1),
            x1: Math.min(v.w - 3, spot.door.doorX + 3),
            y1: Math.min(v.h - 3, spot.door.doorY + 1),
          },
        };
      }
      return { zone: v, wander: plazaBox() };
    };
    // Spawn at the wander box's center — but never ON a solid tile. A wilds
    // trunk can land exactly at the zone center (scatterTrees reserves only the
    // arrival tiles), and stepNpcs vets only the tile it moves TO, so a solid
    // spawn renders the NPC inside the trunk until it happens to step off
    // (review finding — seed 6 pins it). Deterministic outward ring scan over
    // the wander box; the zone's own spawn tile is the last resort.
    // `key` spreads NPCs that share a box (a household, the plaza) instead of
    // stacking them all on its center where only the top sprite is talkable.
    // This IS the runtime placer (25-schedule): a compiled spawn and a schedule
    // relocation have to obey exactly the same rules — never a door or portal
    // tile, which are walkable by design but look wrong (and block the way in)
    // when occupied — so share the one implementation instead of keeping a twin
    // that can drift. The occupancy test rules out a tile another cast member
    // already holds: the hash only spreads, and two ids colliding in a small
    // box (a door apron is six tiles) is exactly the un-talkable stack the key
    // was added to prevent. `npcs` only holds members placed BEFORE this one,
    // so the pass stays deterministic.
    const walkableSpawn = (zone, wander, key) =>
      PF.schedule.walkableIn(zone, wander, key, (x, y) => zone.npcs.some((n) => n.x === x && n.y === y));
    // A bed box is one tile wide: the sleeper does not mill, they lie down. It
    // rides `spread: false` for the same reason the stall counter does — the tile
    // IS the placement, and a hash nudge would put them beside their own bed.
    const bedBox = (bed) => ({ x0: bed.x, y0: bed.y, x1: bed.x, y1: bed.y });
    // A door apron box: the strip an NPC mills around in front of its building.
    const doorBox = (door, reach, depth) => ({
      x0: Math.max(2, door.doorX - reach),
      y0: Math.max(2, door.doorY),
      x1: Math.min(v.w - 3, door.doorX + reach),
      y1: Math.min(v.h - 3, door.doorY + depth),
    });
    // THE HEAD OF A NAMED BUILDING: the first resident homed there in cast
    // order. Cast order is already a statement of importance — pass 4 of the
    // validator hoists a leader ahead of the cap — and a cast list is written
    // head-first by every model that has ever written one.
    //
    // This exists because KEEPING a building and SLEEPING in it are different
    // facts, and conflating them breaks the moment a brief homes a crowd
    // somewhere. Ten residents at one address are a dormitory, a barracks or a
    // boarding house, and the defining thing about all three is that the people
    // in them LEAVE during the day. Marking every one of them a keeper held the
    // whole roll indoors around the clock — and on the open plan, which walls
    // nothing, the wander box covers the bed rows and beds are non-solid, so
    // they spent the afternoon standing on their own bunks.
    //
    // One head each. Everyone else falls to the ordinary resident row, or to the
    // worker tier when the brief said where they work — which is the right
    // answer for the eight sisters who live at the convent and work at the church.
    const headOfBuilding = new Map();
    roster.forEach((member) => {
      if ((member.standing ?? "resident") !== "resident") return;
      const id = zoneIdByName.get(member.home);
      if (id && !headOfBuilding.has(id)) headOfBuilding.set(id, member);
    });
    /** The fireside handle for whoever sleeps in this zone.
     *
     *  Resolved from the BED's zone rather than the building's, because a big
     *  household sleeps upstairs and the fire is on the ground floor — the floor
     *  suffix is stripped to find the room the hearth is actually in. Null when
     *  there is no hearth to stand at (a named place's quarters, a wilds
     *  resident, anybody sleeping rough), and `resolve` falls back to `post` on
     *  its own, so a missing handle is a quiet no-op rather than an NPC standing
     *  in a wall.
     *
     *  The box stops one column short of the fire itself. It is solid: you warm
     *  yourself in front of one, not on top of it. */
    const hearthHandle = (zoneId) => {
      if (!zoneId) return null;
      const ground = zones[String(zoneId).replace(/[ub]$/, "")];
      if (!ground?.hearth) return null;
      const { x, y } = ground.hearth;
      return {
        zoneId: ground.id,
        wander: { x0: Math.max(1, x - 3), y0: Math.max(2, y - 1), x1: Math.max(1, x - 1), y1: y },
      };
    };
    roster.forEach((member, index) => {
      const npcId = `n${index + 1}`;
      const standing = member.standing ?? "resident";
      let zone = zones[zoneIdByName.get(member.home) ?? "z1"] ?? v;
      let wander;
      // The sleep/off-duty node, when it differs from the working one (a shop
      // owner's dwelling, a transient's inn bed). Left null when an NPC simply
      // stays put — 30-sim's schedule resolver falls back to `post`.
      let home = null;
      // Households, the plaza and the inn are SHARED boxes, so spawn each NPC
      // at its own hashed tile inside the box; anyone stacked under another
      // sprite can never be selected by talk-targeting (review finding).
      let spread = true;
      // Null until the resident branch finds the door they live behind; the
      // plaza is the fallback and stays the named cast's day box.
      let publicBox = null;
      // Holds a building the brief NAMED (a sanctuary today). It unlocks the keeper
      // schedule tier, so the same cast kind keeps its ordinary habits without one.
      let keeper = false;
      if (standing === "resident") {
        // Wander near the owner's building when they have one, else around the
        // zone's spawn; interiors wander their walkable middle.
        // The building they RUN first, and only then the roof they live under —
        // a live-work premises now carries its owner's household, so a plain
        // membership test would hand a second trade in the same family the first
        // one's building to work in.
        const owned =
          buildings.find((b) => b.owner === member) ??
          buildings.find((b) => (b.households ?? []).includes(member.household));
        keeper = !!(owned && owned.boundPlace && PLACE_BOUND_SPECIALS.has(owned.boundPlace.kind));
        const dwelling = buildings.find((b) => (b.households ?? []).includes(member.household));
        if (member._minted && !member._square && dwelling?.rect) {
          // Nearest ward, measured from the door they actually live behind — a
          // resident belongs to the quarter they live in, not to whichever
          // quadrant of the arithmetic their household id fell into.
          // From the DOOR, which is what the sentence above claims and what the
          // code did not do: it measured from `rect.x/y`, the lot's north-west
          // corner. The two differ by a few tiles and it is not cosmetic —
          // measured, 5 of 30 city worlds put somebody in a different quarter.
          const home = dwelling.door;
          const ward =
            member._ward && wards.length && home
              ? wards.reduce((best, w) =>
                  (w.x - home.doorX) ** 2 + (w.y - home.doorY) ** 2 <
                  (best.x - home.doorX) ** 2 + (best.y - home.doorY) ** 2
                    ? w
                    : best,
                )
              : null;
          publicBox = ward ? ward.wander : streetBox(dwelling.rect);
        }
        const ownBed = bedFor.get(member);
        if (zone === v && owned) {
          if (owned.owner === member && owned.interior?.post && zones[owned.interior.zoneId]) {
            // AN OWNER WORKS INSIDE THE BUILDING THEY RUN, now that there is a
            // room to be inside it: the shopkeeper between their stock and their
            // counter, the innkeeper on the serving row, the keeper at the
            // chancel. An owner loitering on the apron with a stocked or a lit
            // room behind them is the same "nobody is where they are scheduled to
            // be" gap the dwellings had. Scoped to the OWNER: a live-work
            // building is their household's home too, and a smith's child does
            // not man the counter.
            //
            // The station itself comes from whoever built the room — WORK_POSTS
            // for a minted building, the furnisher's own `z.post` for one the
            // brief named — and this gate cares only that there is one.
            zone = zones[owned.interior.zoneId];
            wander = owned.interior.post;
          } else {
            wander = {
              x0: Math.max(2, owned.door.doorX - 4),
              y0: Math.max(2, owned.door.doorY),
              x1: Math.min(v.w - 3, owned.door.doorX + 4),
              y1: Math.min(v.h - 3, owned.door.doorY + 5),
            };
          }
          // A DUTY-STATION owner sleeps at their dwelling, not at the post they
          // stand; a LIVE-WORK owner's dwelling IS the building they run, and the
          // same expression covers both — whichever roof carries their household.
          // Their own bed when that roof has a room with one in it; the old
          // door-apron box only where there is no bed to point at (an owner whose
          // household never claimed a lot at all) — kept wide enough for a whole
          // household to stand at it without stacking.
          const roof = dwelling && dwelling !== owned ? dwelling : owned;
          home = ownBed
            ? { zoneId: ownBed.zoneId, wander: bedBox(ownBed), spread: false }
            : { zoneId: v.id, wander: doorBox(roof.door, 1, 1) };
        } else if (zone === v) {
          wander = plazaBox();
        } else {
          wander = fullZoneBox(zone);
          // Homed at a building the brief NAMED: their bed is in that building's
          // living quarters, so their night handle is that one tile exactly like
          // a householder's. Left null when the place laid them none — a resident
          // homed at a WILDS sleeps rough, which is what living in the woods is.
          if (ownBed) home = { zoneId: ownBed.zoneId, wander: bedBox(ownBed), spread: false };
          // KEEPING A NAMED BUILDING. The tier used to be reachable only by OWNING
          // a sanctuary, and ownership is one building per person, so exactly one
          // keeper was possible in a whole world. Everyone else the brief housed in
          // a named building — a healer at an infirmary, a scholar at a school, an
          // elder at the moot house — fell to "*:resident", whose DAY entry is the
          // plaza. They lived in the building and then walked out of it for the
          // whole of daylight.
          //
          // The HEAD of the building, not everyone under its roof: see
          // headOfBuilding above for why sleeping somewhere is not keeping it.
          //
          // `mapKind` is the right question because it is the compiler's own word
          // for "this place has a room you can stand in": every named place that
          // grows an interior is stamped "building", and a WILDS is stamped
          // "place". So a forager homed in the woods is untouched — they have no
          // building to keep, which is the point of living out there.
          if (zone.mapKind === "building" && headOfBuilding.get(zone.id) === member) keeper = true;
        }
      } else if (standing === "transient" && stalls.some((s) => s.owner === member)) {
        const stall = stalls.find((s) => s.owner === member);
        zone = v; // tend the stall in the settlement
        // A stall is one merchant's own pitch, not shared geometry, and the
        // center of the box IS the counter — so keep the exact placement.
        spread = false;
        // Behind the counter only — the single row south of the three tables.
        // A deeper box let them drift into the street, which read as abandoning
        // the stall rather than manning it.
        wander = {
          x0: Math.max(2, stall.x),
          y0: Math.min(v.h - 3, stall.y + 1),
          x1: Math.min(v.w - 3, stall.x + 4),
          y1: Math.min(v.h - 3, stall.y + 1),
        };
      } else if (standing === "transient") {
        const spot = loiterAnchor();
        zone = spot.zone;
        wander = spot.wander;
      } else if (standing === "fringe" && wildsZoneId && zones[wildsZoneId]) {
        zone = zones[wildsZoneId];
        wander = fullZoneBox(zone);
      } else if (standing === "fringe") {
        zone = v; // no wilds to retreat to — the settlement's outer margin
        wander = { x0: 3, y0: v.h - 6, x1: v.w - 4, y1: v.h - 3 };
      } else {
        zone = v; // destitute: the town's public center
        wander = plazaBox();
      }
      // Transients bed down at the inn when the settlement has one — in one of
      // its guest beds, handed out in cast order. The wing is sized to the
      // settlement, not to them, so a quiet night leaves berths standing empty
      // and a busy one runs the inn out: whoever arrives after the last berth
      // shares the common-room box, which is what "no room left" has always meant.
      if (standing === "transient" && gatheringZoneId && zones[gatheringZoneId]) {
        const guest = guestBeds.shift();
        home = {
          // The berth's OWN zone: an inn keeps its guest rooms upstairs, so the
          // handle that sends a guest to bed sends them up the stairs. Whoever
          // arrives after the last berth still shares the common room, which is
          // on the ground floor where the rest of the evening is.
          zoneId: guest ? guest.zoneId : gatheringZoneId,
          wander: guest ? bedBox(guest) : fullZoneBox(zones[gatheringZoneId]),
          spread: !guest,
        };
      }
      // A NAMED WORKPLACE OUTRANKS THE DERIVED ONE. Ownership is the only guess
      // the compiler can make about where somebody spends the day, and it is a
      // good one — but it is strictly one building per person and one person per
      // building, so it can never place a school's second teacher, a market's
      // fourth seller or a shop assistant. The moment a brief says outright where
      // someone works, that statement beats the inference.
      //
      // Only the WORKING anchor moves. `home` was resolved above and is left
      // exactly as it was: naming a workplace must never take anybody out of
      // their own bed, and the night handle is the one thing a day job cannot
      // have an opinion about.
      //
      // Unset for everyone the brief does not speak for (18-brief only emits the
      // field when it RESOLVES), so this whole block is inert for every brief that
      // compiled before it existed.
      const workZone = member.workplace ? zones[zoneIdByName.get(member.workplace) ?? ""] : null;
      if (workZone) {
        zone = workZone;
        // The room's walkable middle — the SAME box a resident owner of that place
        // already gets, so a named worker stands where the owner would rather
        // than in some third place invented for them.
        //
        // There is deliberately no "behind the counter" branch, and the reason is
        // no longer that a lookup could not match. WORK_POSTS is still out of
        // reach from here: a workplace can only ever name a zone the BRIEF
        // declared (`workplace` resolves against brief._ids.zones, so always
        // `z*`), and that table is keyed by `special` on a COMPILER-MINTED
        // building (`s*`/`h*`). Those two id spaces are disjoint by construction
        // — see the harness case that pins it.
        //
        // What is new is that a brief-declared room CAN now carry a station: the
        // places pass hands an inn's serving row and a sanctuary's chancel to
        // that building's OWNER (see `facade.interior`). It stays the owner's.
        // `workplace` is the one binding that puts SEVERAL people in one building
        // — an acolyte, a market's fourth seller, a shop assistant — and a
        // station is a single row five tiles long, so sending them all to it
        // would stack them or have the occupancy scan push them straight back
        // off. The room's walkable middle is the honest box for anybody the brief
        // merely rostered here, and the same box the owner would get.
        wander = workZone === v ? plazaBox() : fullZoneBox(workZone);
        // Always dispersed: a workplace is a SHARED box by definition — it exists
        // precisely for the cases with more than one person in it — and two sprites
        // on one tile makes the lower one impossible to talk to.
        spread = true;
      }
      const worker = !!workZone;
      const spawnAt = walkableSpawn(zone, wander, spread ? npcId : null);
      zone.npcs.push({
        id: npcId,
        name: member.name,
        role: member.role,
        hue: PF.brief.TINTS[member.tint] ?? 210,
        persona: member.persona,
        x: spawnAt.x,
        y: spawnAt.y,
        wander,
        // Daypart schedule handles, resolved at runtime by 30-sim. Runtime-only
        // (like facing/stepPhase): never serialized, re-baked on every compile,
        // so schedules add ZERO save fields. `post` is the working/day anchor
        // computed above; `home` is the sleep node when it differs.
        _sched: {
          kind: member.kind,
          standing,
          // spread:false keeps a private, meaningful placement (a merchant's own
          // stall counter); shared boxes disperse by NPC id.
          post: { zoneId: zone.id, wander, spread },
          keeper,
          worker,
          home,
          // Where a household is at first light and at last light: in, around the
          // fire. Before this a resident's dawn and dusk were both `post`, so the
          // whole settlement stood at its work anchors from waking to sleeping and
          // the only thing a day did was empty the houses at noon.
          hearth: hearthHandle(home?.zoneId ?? (zone !== v ? zone.id : null)),
          public: { zoneId: v.id, wander: publicBox ?? plazaBox() },
        },
      });
    });

    // ── LODGING (S3/P1): who rents a bed, and where ──────────────────────────
    // The settlement's gathering is the one building that OFFERS beds rather than
    // keeping them for its own people (interiorRoom carves `beds` and `homeBeds`
    // from different bands), so it is the one place a player with no home of their
    // own can rent a berth. Marked here rather than resolved at the call site
    // because "which zone is the inn" is a fact about the compile, and the keeper
    // is stamped on the NPC so the offer follows the PERSON: an innkeeper standing
    // in the square at noon can still let you a room.
    //
    // Runtime-only, exactly like the schedule handles beside it — re-derived on
    // every compile, costing zero save fields. What the RENTAL persists is the
    // zone id, and only through PF.player.setHome, which refuses a minted `h{n}`.
    if (gatheringZoneId && zones[gatheringZoneId]) {
      // WHO LETS THE ROOMS: the cast member the specials pass bound to the
      // gathering's building — the `host` kind, the innkeeper — and only if the
      // brief named nobody, whoever the brief homed there. Deliberately NOT the
      // `_sched.keeper` tier: that tier is PLACE_BOUND_SPECIALS, which is the
      // sanctuary alone, so a gathering's owner never carries it and reading it
      // here would leave every inn in the game with nobody behind the counter.
      const facade = buildings.find((b) => b.boundPlace === gatheringPlace);
      const host = facade?.owner ?? headOfBuilding.get(gatheringZoneId) ?? null;
      // BOTH MARKS OR NEITHER. A brief can name a gathering and home nobody in it
      // (no `host` kind, nobody in that building), and the zone mark used to go up
      // unconditionally — a room the world calls lodging with nobody behind the
      // counter, which is a promise the offer can never keep. The lodging fact is
      // the KEEPER's, so the room is only lodging when somebody is letting it.
      //
      // The zone mark waits for the keeper's rather than being paired with it by
      // inspection. Resolving a host is not the same fact as STAMPING one: the
      // resolution hands back a roster entry and the stamp goes on by NAME, and
      // "every roster entry is placed as an NPC under its own name" is true of
      // this compiler and is not something this block can see. Now the offer's
      // room path reads the zone mark to find a keeper (59-economy
      // `_keeperInRoom`), the gap between the two would be exactly the counter
      // with nobody behind it, so the mark is a CONSEQUENCE of the stamp landing.
      if (host) {
        let stamped = false;
        for (const zone of Object.values(zones)) {
          for (const npc of zone.npcs) {
            if (npc.name !== host.name) continue;
            npc.lodging = gatheringZoneId;
            stamped = true;
          }
        }
        if (stamped) zones[gatheringZoneId].lodging = true;
      }
    }

    return {
      seed,
      theme: activeTheme,
      brieved: true, // marks a compiled world (saves still carry only seed/theme/zone)
      situation: brief.situation,
      zones,
      startZone: "z1",
      bindings: newBindings(),
      // Derived, never saved (S5 §Q3a). `minted` names the residents the brief
      // did NOT. The severance itself keys off the complement of the brief's
      // cast rather than this list — a resident the OLD mint produced is in
      // neither — but the list is what a brief-less world falls back to, and it
      // is the honest way to say who the compiler invented.
      minted: minted.map((member) => member.name),
      mintStamp: mintStampOf(minted),
    };
  }

  function interiorKindForSpecial(special) {
    if (special === "gathering") return "gathering";
    if (special === "hall") return "hall";
    if (special === "sanctuary") return "sanctuary";
    if (special === "shop") return "workshop";
    return null;
  }

  return { build, idx };
})();

// ===== 25-schedule.js =====
// ── NPC daypart schedules ────────────────────────────────────────────────────
// Who is where, when. The compiler (20-world) bakes a `_sched` onto every NPC
// holding pre-computed location HANDLES — geometry can only be built while the
// buildings/stalls/zones are still in scope. This module owns the POLICY: a
// small table of kind×standing -> daypart -> handle name, resolved at runtime
// by the Sim as the clock crosses a daypart boundary.
//
// Deliberately sparse. A combo with nothing interesting to do names only
// "post", so it behaves exactly as it did before schedules existed — standing
// at its anchor around the clock. Any handle a template names that an NPC does
// not have (no dwelling, no inn) falls back to `post`, so a template can never
// strand an NPC nowhere.
//
// Schedules add ZERO save fields: they are a pure function of the clock, which
// is already saved, so a restored chat re-resolves to the right daypart and a
// timeline rewind rewinds the town with it.
PF.schedule = (() => {
  // Handle names: post = the working/day anchor, home = the sleep node,
  // public = the settlement's plaza. See 20-world's cast loop for the geometry.
  const TABLE = {
    // The innkeeper holds the inn all day — it is the fixed point the evening
    // crowd converges on, and it means the lit building is never empty. At night
    // they turn in like anybody else: a brief that homes them AT the inn (the
    // usual shape) puts their bed in the inn's own living quarters, so the
    // building is still occupied and they are simply in it asleep rather than
    // standing among the tables at 3am. One homed at a house down the road walks
    // to it — their guests are still upstairs. With no bed anywhere the handle
    // falls back to `post` and this row behaves exactly as it always did.
    "host:resident": { dawn: "post", day: "post", dusk: "post", night: "home" },
    // The watch keeps the night, so the settlement never looks abandoned.
    "guard:resident": { dawn: "home", day: "post", dusk: "post", night: "post" },
    // Trades work their building through the day and sleep at their dwelling.
    "leader:resident": { dawn: "home", day: "post", dusk: "post", night: "home" },
    "grower:resident": { dawn: "home", day: "post", dusk: "post", night: "home" },
    "maker:resident": { dawn: "home", day: "post", dusk: "post", night: "home" },
    "merchant:resident": { dawn: "home", day: "post", dusk: "post", night: "home" },
    // A travelling trader sleeps at the inn and tends the stall by day.
    "merchant:transient": { dawn: "home", day: "post", dusk: "post", night: "home" },
    // A KEEPER — anyone who holds a building the brief NAMED, whatever their kind.
    // (see the `keeper` flag). Without a row like this the keeper falls to
    // "*:resident" and spends the daylight hours in the plaza, which is exactly
    // when a player opens the church door, so the room built around them would
    // always be empty. Scoped to keepers on purpose: an elder in a settlement with
    // no sanctuary keeps the plaza habits they have always had. Keyed on holding
    // the building rather than on being an elder: which KIND ends up keeping a
    // sanctuary is a question about the kind vocabulary, not about schedules.
    "*:resident:keeper": { dawn: "post", day: "post", dusk: "post", night: "home" },
    // SOMEBODY THE BRIEF PLACED BY NAME (see the `worker` flag — a resolved
    // `workplace`). Without a row like this the binding inverts itself exactly
    // where it was supposed to help: half the cast kinds have no row of their own,
    // so an acolyte or a shop assistant falls to "*:resident", whose DAY entry is
    // the plaza — they would hold the building they were assigned to at dawn and
    // dusk and then leave it for the eleven hours of daylight a player is most
    // likely to open the door.
    //
    // Keyed on being named rather than on a kind, for the same reason the keeper
    // tier is keyed on holding a building: it says nothing about WHO someone is,
    // only that the brief already answered where they are. Night is still `home`,
    // because a day job has no opinion about a bed.
    //
    // BELOW the per-kind rows, deliberately. This tier exists for the SIX kinds
    // that have no row at all; a kind that has one already spends its day at
    // `post`, and `post` is the named workplace by the time this resolves — so
    // the kind row and the workplace agree without this row's help. Placing it
    // above them broke exactly the one row that disagrees on purpose: a guard
    // given a workplace stopped keeping the night watch, because this row sends
    // everybody home at night and "the watch keeps the night, so the settlement
    // never looks abandoned" is the whole point of `guard:resident`.
    "*:resident:worker": { dawn: "post", day: "post", dusk: "post", night: "home" },
    // Everyone else with a roof: on their own doorstep at dawn and again at dusk,
    // the square by day, and in bed at night.
    //
    // dawn/dusk are `post` — the apron OUTSIDE their door — not `home`. They used to
    // be `home` and that read correctly while `home` was a one-tile spot at the door.
    // It stopped being true the moment dwellings gained interiors and `home` became a
    // bed inside: residents then vanished indoors from 18:00 to 07:00, which is over
    // half the clock and most of the hours with interesting light. Bed is for night.
    // DAWN AND DUSK BELONG TO THE HEARTH. Both used to be `post`, so an ordinary
    // resident stood at their work anchor from waking until sleeping and the only
    // thing a whole day did was empty the houses at noon. A household is in and
    // around the fire at first light and again at last light, which is also what
    // makes a lit window at dusk mean somebody is behind it.
    //
    // `resolve` falls back to `post` when an NPC has no `hearth` handle, so
    // anyone with no fire to stand at — a wilds resident, a lodger in a named
    // place's quarters — keeps exactly the day they had.
    "*:resident": { dawn: "hearth", day: "public", dusk: "hearth", night: "home" },
    // Loiterers hold their public spot all day and take a bed at night.
    "*:transient": { dawn: "post", day: "post", dusk: "post", night: "home" },
    // Fringe NPCs stay out at the margins — meeting one means going to them.
    "*:fringe": { dawn: "post", day: "post", dusk: "post", night: "post" },
    // No bed to go to: the square, day and night.
    "*:destitute": { dawn: "post", day: "post", dusk: "post", night: "post" },
  };
  const DEFAULT = { dawn: "post", day: "post", dusk: "post", night: "post" };

  /** The handle an NPC should occupy at this daypart, or null when unscheduled. */
  function resolve(sched, daypart) {
    if (!sched) return null;
    // Most specific first. The `:keeper` tier exists so a template can describe
    // someone who actually holds a building without changing how that same cast
    // kind behaves when they do not.
    const template =
      (sched.keeper ? TABLE[`${sched.kind}:${sched.standing}:keeper`] : null) ??
      (sched.keeper ? TABLE[`*:${sched.standing}:keeper`] : null) ??
      (sched.worker ? TABLE[`${sched.kind}:${sched.standing}:worker`] : null) ??
      TABLE[`${sched.kind}:${sched.standing}`] ??
      (sched.worker ? TABLE[`*:${sched.standing}:worker`] : null) ??
      TABLE[`*:${sched.standing}`] ??
      DEFAULT;
    return sched[template[daypart] ?? "post"] ?? sched.post ?? null;
  }

  /** Can an NPC STAND here? Open ground is not enough: a door tile is
   *  deliberately non-solid (the player walks through it) and a portal tile is
   *  the zone's exit, so an NPC parked on either looks wrong and blocks the way
   *  in. Player movement is unaffected — this gates NPCs only. */
  function standable(zone, x, y) {
    if (x < 0 || x >= zone.w || y < 0 || y >= zone.h) return false;
    const index = y * zone.w + x;
    if (zone.solid[index]) return false;
    if (zone.object[index] === "door") return false;
    for (const portal of zone.portals) if (portal.x === x && portal.y === y) return false;
    return true;
  }

  /** An open tile inside the box, nudged off anything solid — the runtime twin
   *  of the compiler's walkableSpawn, so a relocation can never drop an NPC
   *  inside a wall or a tree. Deterministic: consumes no randomness.
   *
   *  `key` spreads a SHARED box. Most residents resolve to the same `public`
   *  handle by day and a household shares one `home`, so a plain box-center
   *  placement stacked the cast onto a single tile — and because talk-targeting
   *  picks the nearest with a strict <, everyone under the top sprite became
   *  unreachable. A stable per-NPC hash picks each one its own starting tile.
   *
   *  `taken` is the caller's occupancy test. The hash alone only SPREADS: two
   *  ids can still land on the same tile in a small box (a household door
   *  apron is six tiles), which puts us right back on the unreachable sprite.
   *  Treating an occupied tile as closed makes the ring scan walk to the next
   *  free one, so "no two NPCs on a tile" is an invariant rather than a
   *  probability. Still deterministic: occupancy is a function of the order
   *  the caller places its NPCs in, which is itself fixed. */
  function walkableIn(zone, box, key, taken) {
    // Normalize the corners rather than trusting them. An inverted box makes a
    // span of zero, `hash % 0` is NaN, and standable()'s bounds test is false
    // for every NaN comparison — so a NaN tile would sail out as a valid
    // placement instead of throwing anywhere near the mistake. Nothing produces
    // one today; this is input validation, not a live bug.
    const x0 = Math.min(box.x0, box.x1);
    const x1 = Math.max(box.x0, box.x1);
    const y0 = Math.min(box.y0, box.y1);
    const y1 = Math.max(box.y0, box.y1);
    let cx = ((x0 + x1) / 2) | 0;
    let cy = ((y0 + y1) / 2) | 0;
    const spanX = x1 - x0 + 1;
    const spanY = y1 - y0 + 1;
    // `> 0` is also the non-finite guard: it is false for NaN, which leaves the
    // `| 0`-ed center in place, so no NaN ever reaches standable().
    if (key && spanX > 0 && spanY > 0) {
      const hash = PF.hashStr(String(key));
      cx = x0 + (hash % spanX);
      cy = y0 + (((hash / 7) | 0) % spanY);
    }
    const open = (x, y) => standable(zone, x, y) && !(taken && taken(x, y));
    if (open(cx, cy)) return { x: cx, y: cy };
    /** Deterministic outward ring scan from the start tile, clipped to a rect. */
    const ring = (maxR, lox, hix, loy, hiy) => {
      for (let r = 1; r <= maxR; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const x = cx + dx;
            const y = cy + dy;
            if (x >= lox && x <= hix && y >= loy && y <= hiy && open(x, y)) return { x, y };
          }
        }
      }
      return null;
    };
    // Sum, not max: an off-center hashed start still has to be able to reach
    // the far corner of the box.
    const inBox = ring(x1 - x0 + (y1 - y0), x0, x1, y0, y1);
    if (inBox) return inBox;
    // The box is FULL. Widen to the zone before giving up. The old fallback
    // dropped straight onto zone.spawn — ONE fixed tile that honours neither
    // `taken` nor standable() — so every NPC overflowing the same box in a
    // single pass landed on top of the last. A household of six shares a 3x2 door
    // apron whose door tile standable() excludes, so
    // it overflowed on every seed tried, and the losers were both un-talkable
    // (nearest wins on a strict <) and frozen: their wander box is the very box
    // they could not fit in, so every candidate step fails its bounds test.
    // Standing just outside it is the honest outcome — spare, but reachable.
    //
    // Clamp the scan origin into the zone first, or a box sitting outside the
    // map would need a radius bigger than w+h just to reach tile 0 and the
    // "whole zone" pass would quietly cover none of it.
    cx = PF.clamp(cx, 0, zone.w - 1) | 0;
    cy = PF.clamp(cy, 0, zone.h - 1) | 0;
    const inZone = ring(zone.w + zone.h, 0, zone.w - 1, 0, zone.h - 1);
    if (inZone) return inZone;
    // Every standable tile in the zone is occupied. Nothing can satisfy both
    // predicates now, so drop the one that is merely undesirable and keep the
    // one that is structural: sharing a tile looks wrong, standing inside a wall
    // or in a doorway IS wrong, and a doorway blocks the way in. Returning the
    // spawn unchecked (as this did) could do exactly that, so check it — it is
    // the tile every zone guarantees walkable, and was standable in all 480
    // compiled zones tried, but the guarantee should live in the code.
    //
    // Unreachable in practice, and deliberately not escalated to a null return:
    // the smallest zone measured holds 119 standable tiles, comfortably more
    // than any one zone's occupants even now that the mint fills a city (see
    // npcOccupies in 30-sim.js for the measured population numbers), so this is
    // a floor under a contract, not a live path.
    if (standable(zone, zone.spawn.x, zone.spawn.y)) return { x: zone.spawn.x, y: zone.spawn.y };
    for (let y = 0; y < zone.h; y++) {
      for (let x = 0; x < zone.w; x++) if (standable(zone, x, y)) return { x, y };
    }
    return { x: zone.spawn.x, y: zone.spawn.y };
  }

  return { TABLE, resolve, walkableIn, standable };
})();

// ===== 30-sim.js =====
// ── Simulation ────────────────────────────────────────────────────────────────
// Fixed-timestep world sim: player movement + collision, portals, NPC wander,
// package-local clock. Modes gate everything: "walk" is the only mode that
// consumes input; "dialogue" hands the keyboard back to the host narration
// input; "combat"/"replay" freeze the world under the host's own UI.
// When each daypart BEGINS, in package-local minutes — the same four thresholds
// daypart() reads from the other side. One table rather than a literal per
// caller: waitUntil jumps to one of these, the fishing verb's "until dusk" loops
// windows toward one, and a copy that drifted would be a rest action and a
// session disagreeing about when the evening starts.
PF.DAYPART_STARTS = { dawn: 5 * 60, day: 7 * 60, dusk: 18 * 60, night: 21 * 60 };

PF.Sim = class {
  constructor(world) {
    this.world = world;
    this.zoneId = world.startZone;
    const z = this.zone();
    this.x = (z.spawn.x + 0.5) * PF.TILE;
    this.y = (z.spawn.y + 0.5) * PF.TILE;
    this.facing = 0; // 0 down, 1 up, 2 left, 3 right
    this.moving = false;
    this.phase = 0; // walk animation accumulator
    this.mode = "walk";
    this.clockMin = 8 * 60; // 08:00, day 1
    this.day = 1;
    this._clockAcc = 0;
    this.nearNpc = null;
    this.nearPortal = null;
    // The named feature the player is standing at, or null (see step()). Derived
    // per frame from the zone's own register (20-world makeZone.features), which
    // is itself derived — nothing here is ever saved.
    this.nearFeature = null;
    this._npcTimers = new Map();
    this._rnd = PF.rng((world.seed ^ 0x9e3779b9) >>> 0);
    this.dirty = false; // save-worthy change happened
    // Envelope keys a NEWER build wrote that this one does not understand,
    // re-emitted verbatim by snapshot() (60-save ENVELOPE_KEYS). Initialized
    // here EXPLICITLY rather than lazily like `intro`: snapshot() reads it on
    // the wizard's throwaway sim too, and an undefined-shaped field is exactly
    // the trap `intro` already is.
    this._envelopeExtra = {};
    // The S5 player block, default-initialized HERE rather than lazily (plan
    // §Q5). snapshot() emits `player` unconditionally, so a sim that reached it
    // without one would either crash or teach the envelope to emit a key
    // conditionally — which is the exact registry failure ENVELOPE_KEYS exists
    // to stop. simFromSaved overwrites this with the restored block.
    this.player = PF.player.defaultPlayer();
    this._daypart = null;
    // Cutscene beat (see stepCutscene): while set, the package asks the host to
    // fold its narration box away so the world has the screen to itself.
    this.cutscene = null;
    this._vistaArmed = true;
    // Place everyone for the starting clock. A restore overwrites clockMin
    // AFTER construction and calls this again (see 60-save simFromSaved).
    this.resolveSchedules();
  }

  zone() {
    return this.world.zones[this.zoneId];
  }

  /** Solid test for a feet-box in world pixels. */
  blocked(z, x, y) {
    const HW = 5,
      HT = 3,
      HB = 7; // feet box: 10 wide, 10 tall biased low
    for (const [px, py] of [
      [x - HW, y - HT],
      [x + HW, y - HT],
      [x - HW, y + HB],
      [x + HW, y + HB],
    ]) {
      const tx = Math.floor(px / PF.TILE);
      const ty = Math.floor(py / PF.TILE);
      if (tx < 0 || ty < 0 || tx >= z.w || ty >= z.h) return true;
      if (z.solid[ty * z.w + tx]) return true;
    }
    return false;
  }

  teleport(zoneId, tx, ty) {
    // Own-property, because this early return is the ONLY thing standing between
    // a caller-supplied word and the mount. `zones["constructor"]` is a truthy
    // function, so bare, the guard did not fire: `zoneId` was pinned to a word no
    // zone answers to and zone() handed Object's own constructor to the frame
    // loop, which throws on the first `z.w`. Nothing catches that — and because
    // the bare form also set `dirty` before the throw, the prototype-named id
    // reached `snap.zone` first: a corrupt save AND a dead frame loop. Both
    // shipped callers pre-validate today, but teleport is public on PF.Sim, and
    // 60-save already spells this same test out as `hasZone` for ids taken off a
    // save row — a refusal, cleanly, is the whole contract of the line.
    if (!PF.own(this.world.zones, zoneId)) return;
    this.zoneId = zoneId;
    this.x = (tx + 0.5) * PF.TILE;
    this.y = (ty + 0.5) * PF.TILE;
    this.dirty = true;
  }

  step(dt, input) {
    const z = this.zone();
    // A beat is WALK-ONLY and never survives the screen changing hands. Dialogue,
    // combat and replay each own the screen, and a beat left standing would keep
    // asking the host to fold its narration box away for the whole of it — over
    // exactly the narration the player changed modes to read. Cleared here for the
    // modes that still step, and at the mode chokepoint (core.setMode) for replay,
    // which never reaches this function at all. `_vistaArmed` deliberately stays
    // down: coming back to walk in the same corner must not restart the beat.
    if (this.mode !== "walk" && this.cutscene) this.cutscene = null;
    if (this.mode === "walk") {
      let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      if (dx && dy) {
        dx *= Math.SQRT1_2;
        dy *= Math.SQRT1_2;
      }
      this.moving = !!(dx || dy);
      if (this.moving) {
        if (Math.abs(dx) >= Math.abs(dy)) this.facing = dx < 0 ? 2 : 3;
        else this.facing = dy < 0 ? 1 : 0;
        const nx = this.x + dx * PF.WALK_SPEED * dt;
        const ny = this.y + dy * PF.WALK_SPEED * dt;
        if (!this.blocked(z, nx, this.y)) this.x = nx;
        if (!this.blocked(z, this.x, ny)) this.y = ny;
        this.phase += dt * 8;
        this.dirty = true;
      } else {
        this.phase = 0;
      }
      // portal under feet?
      const tx = Math.floor(this.x / PF.TILE);
      const ty = Math.floor(this.y / PF.TILE);
      this.nearPortal = null;
      for (const p of z.portals) {
        if (p.x === tx && p.y === ty) {
          this.teleport(p.toZone, p.toX, p.toY);
          return { zoneChanged: true };
        }
        if (Math.abs(p.x - tx) + Math.abs(p.y - ty) <= 1) this.nearPortal = p;
      }
      // nearest interactable NPC within reach
      this.nearNpc = null;
      let best = 26; // px
      for (const npc of z.npcs) {
        const d = Math.hypot(npc.x * PF.TILE + 8 - this.x, npc.y * PF.TILE + 8 - this.y);
        if (d < best) {
          best = d;
          this.nearNpc = npc;
        }
      }
      // THE NAMED FEATURE UNDER THE PLAYER'S HAND, the third proximity read
      // beside the two above and recomputed on the same terms: every walking
      // frame, off the feet tile, null the moment they step away.
      //
      // The test is deliberately TWO-SIDED — a neighbour tile IS water AND that
      // tile lies inside a registry rect. Neither half is the rule on its own.
      // Water alone would make any puddle a feature and could not say which one;
      // a rect alone would count tiles the feature never watered, and rects hold
      // those by design (the wilds ford lays path straight across its stream,
      // and a compiled pool's well stands inside the anchor rect beside it).
      //
      // Four neighbours, not eight: standing corner-on to a pond is standing
      // near the bank, not at it. Skipped whole on a zone with no register,
      // which is most of them.
      this.nearFeature = null;
      if (z.features.length) {
        for (const [nx, ny] of [
          [tx, ty - 1],
          [tx, ty + 1],
          [tx - 1, ty],
          [tx + 1, ty],
        ]) {
          if (nx < 0 || ny < 0 || nx >= z.w || ny >= z.h) continue;
          if (z.ground[ny * z.w + nx] !== "water") continue;
          const row = z.features.find(
            (f) => nx >= f.rect.x && nx < f.rect.x + f.rect.w && ny >= f.rect.y && ny < f.rect.y + f.rect.h,
          );
          if (row) {
            this.nearFeature = row;
            break;
          }
        }
      }
    }
    // NPCs keep wandering in walk AND dialogue (the world stays alive while you
    // read), but the CLOCK only advances while walking: a conversation should
    // never burn the afternoon, and a daypart boundary crossing mid-dialogue
    // would relocate the very NPC you are talking to. Package-local clock only —
    // never the host time endpoints (issue #5076).
    if (this.mode === "walk" || this.mode === "dialogue") {
      if (this.mode === "walk") {
        let advanced = false;
        this._clockAcc += dt;
        while (this._clockAcc >= PF.CLOCK_SECONDS_PER_GAME_MINUTE) {
          this._clockAcc -= PF.CLOCK_SECONDS_PER_GAME_MINUTE;
          this.clockMin++;
          advanced = true;
          if (this.clockMin >= 24 * 60) {
            this.clockMin = 0;
            this.day++;
          }
        }
        // A fixed 1/60s step advances at most one game minute per ~300 frames,
        // so a boundary can never be skipped between checks.
        if (advanced && this.daypart() !== this._daypart) this.resolveSchedules();
      }
      if (this.mode === "walk") this.stepCutscene(dt, z);
      this.stepNpcs(dt, z);
    }
    return { zoneChanged: false };
  }

  /** A scripted beat that hands the screen to the world for a few seconds.
   *  Demonstrates the host's transient narration-collapse request (capability
   *  API 1.13): the package asks while the beat runs and simply stops asking
   *  when it ends, and the host restores the player's own preference.
   *
   *  The trigger is the settlement's far corner — a quiet spot to look out
   *  from, easy to find deliberately and hard to blunder into mid-errand.
   *  Walking away ends it early, so a beat can never hold the box hostage,
   *  and it re-arms only once the player has left, so loitering cannot loop it. */
  stepCutscene(dt, z) {
    const inVista = z.id === this.world.startZone && this.x < 6 * PF.TILE && this.y < 6 * PF.TILE;
    if (!inVista) {
      this.cutscene = null;
      this._vistaArmed = true;
      return;
    }
    if (this.cutscene) {
      this.cutscene.t += dt;
      if (this.cutscene.t >= this.cutscene.hold) this.cutscene = null;
      return;
    }
    if (!this._vistaArmed) return;
    this._vistaArmed = false;
    this.cutscene = { t: 0, hold: 7, text: "You stop at the edge of " + z.name + " and look out over it." };
  }

  /** The four dayparts, aligned to the same thresholds darkness() tints by, so
   *  NPCs move exactly as the light changes. */
  daypart(min = this.clockMin) {
    const h = min / 60;
    if (h >= 7 && h < 18) return "day";
    if (h >= 18 && h < 21) return "dusk";
    if (h >= 5 && h < 7) return "dawn";
    return "night";
  }

  /** Jump the clock to the next occurrence of a daypart's start (the "wait
   *  until dusk" rest action). A JUMP, not an advance: NPCs re-place in one
   *  shot. Walk mode only, so it can never collide with the dialogue freeze. */
  waitUntil(target) {
    // Own-property, now that the table is shared and reachable from more than one
    // button: `starts["constructor"]` answered with a FUNCTION, which is not
    // undefined, and the guard below would have waved it through onto clockMin.
    const at = Object.prototype.hasOwnProperty.call(PF.DAYPART_STARTS, target) ? PF.DAYPART_STARTS[target] : undefined;
    if (at === undefined || this.mode !== "walk") return false;
    if (at <= this.clockMin) this.day++;
    this.clockMin = at;
    this._clockAcc = 0;
    this.resolveSchedules();
    return true;
  }

  /** Stage what the clock has finished (plan §2.5, M2's ruled variant): every day
   *  BEFORE the one being lived is owed to the wrap-up. Called by the sleep verb
   *  after its advance, and by nothing else — waking hours pass without anybody
   *  sitting down to look back over them, which is the whole conceit.
   *
   *  THE RULED VARIANT IS THE SIMPLE ONE: `max(ledgerOwed, day - 1)`, read AFTER
   *  the clock moved, with no crossing detection and no captured day-before. So a
   *  sleep of any length at any hour owes every elapsed day, and the post-midnight
   *  fisher who beds at 00:30 flushes last night's catch — the session filed its
   *  pre-midnight half under the day it happened, this owes that day, and the
   *  hours since midnight belong to the day still underway.
   *
   *  `max` because sleeps ACCUMULATE and the marker only ever climbs: a rewind
   *  can take the clock backwards, and a marker that followed it down would
   *  quietly un-owe days the player was already promised. The invariant
   *  `ledgerOwed < sim.day` holds by construction — `waitUntil` cannot complete
   *  without moving the clock — and the burn's own guard re-checks it anyway. */
  stageLedgerOwed() {
    this.intro ??= { world: false, zones: {}, npcs: {} };
    this.intro.ledgerOwed = Math.max(PF.player.resolvedDay(this.intro.ledgerOwed), this.day - 1);
    return this.intro.ledgerOwed;
  }

  /** Advance the clock by exactly `n` minutes. The fishing cast's mover, where
   *  waitUntil is the rest action's, and the difference is what each one is FOR:
   *  a rest is over when it reaches a time of day, while a cast SPENDS a fixed
   *  window and lands wherever that leaves the clock. So this one takes minutes
   *  and not a daypart.
   *
   *  IT WRAPS MIDNIGHT, and it has to. A cast window is a multi-minute jump, so
   *  a session that starts at 23:50 crosses into the next day — a DESIGNED path,
   *  since "fish until dawn" is on the verb's own menu. The walking loop above
   *  can never be more than one day out because it ticks a minute at a time;
   *  this can, so the wrap is a loop rather than a test.
   *
   *  `resolveSchedules()` then runs UNCONDITIONALLY, unlike the walking loop's
   *  boundary test. A jump of any size can cross a daypart, and asking whether
   *  it did costs the same as re-placing everybody in a world where nothing
   *  moved — which is what waitUntil already concluded one method down.
   *
   *  NOT MODE-GATED, and waitUntil is: the guard belongs where the refusal is
   *  legible. Wait is a button whose only refusal is the mode, so its mover says
   *  no; fishing has five refusals of its own (59-economy `fish`), `wrong-mode`
   *  among them, and a second silent gate here would turn one of them into a
   *  no-op nobody could tell from a cast that caught nothing.
   *
   *  `_clockAcc` is deliberately left alone. waitUntil clears it because it
   *  JUMPS to a target and a leftover fraction would tick that target's minute
   *  early; an advance lays whole minutes on top of a fraction the player has
   *  genuinely already walked, and clearing it would quietly lose it.
   *
   *  Returns the minutes advanced — 0 for anything that is not a positive whole
   *  count, so a caller can tell a clock that moved from one that did not. */
  advanceMinutes(n) {
    if (!Number.isInteger(n) || n <= 0) return 0;
    this.clockMin += n;
    while (this.clockMin >= 24 * 60) {
      this.clockMin -= 24 * 60;
      this.day++;
    }
    this.resolveSchedules();
    return n;
  }

  /** Re-place every scheduled NPC for the current daypart. Idempotent, O(cast),
   *  and fires only on a boundary crossing (~4x/day) plus once per rebuild. */
  resolveSchedules() {
    this._daypart = this.daypart();
    // Flatten first: splicing between zone arrays while iterating them would
    // skip or double-process an NPC.
    const all = [];
    for (const zoneId in this.world.zones) {
      for (const npc of this.world.zones[zoneId].npcs) all.push([zoneId, npc]);
    }
    // TWO PASSES, and the split is the whole correctness argument. Placement
    // consults `taken` so nobody is stacked under anybody — but in a single pass
    // "taken" is read against wherever people happen to be standing from the
    // LAST daypart, and half of them are about to leave. An NPC whose own bed is
    // still warm under a housemate who has not been processed yet gets shunted
    // to the nearest free tile, the housemate then walks off, and the sleeper
    // spends the night on the floorboards beside an empty bed. It is purely an
    // ordering accident: the same world, resolved in a different NPC order, puts
    // a different person on the floor, and going straight to a daypart rather
    // than arriving from another one hides it entirely.
    //
    // So: move everybody between zones first, then place them, counting only the
    // people whose position is final — anyone not scheduled, anyone held, and
    // anyone already placed in this pass.
    const pending = [];
    const unplaced = new Set();
    for (const [fromId, npc] of all) {
      if (!npc._sched || npc._hold) continue; // _hold reserves a GM override seam
      const handle = PF.schedule.resolve(npc._sched, this._daypart);
      if (!handle) continue;
      const target = this.world.zones[handle.zoneId];
      if (!target) continue;
      const box = handle.wander;
      // Only snap when the NPC is OUTSIDE the new box — overlapping day/night
      // boxes should not pop. Read here, before anybody has moved, because that
      // is the position the question is about.
      const inside = npc.x >= box.x0 && npc.x <= box.x1 && npc.y >= box.y0 && npc.y <= box.y1;
      if (handle.zoneId !== fromId) {
        // Cross-zone: the renderer and talk-detection only walk the CURRENT
        // zone's array, so a spliced NPC simply leaves one zone and appears in
        // the other — no visibility flag needed.
        const from = this.world.zones[fromId];
        const index = from.npcs.indexOf(npc);
        if (index >= 0) from.npcs.splice(index, 1);
        target.npcs.push(npc);
      }
      npc.wander = box;
      // stepNpcs caches float fx/fy per id; a stale timer would drag the token
      // back toward the old box. Dropping it re-seeds at the new position, and
      // dropping it HERE also stops an in-flight destination from being read as
      // an occupied tile by somebody being placed below.
      this._npcTimers.delete(npc.id);
      // An in-zone NPC that is already inside its new box keeps its exact tile,
      // so its position is final and it must block others from now on.
      if (handle.zoneId === fromId && inside) continue;
      pending.push({ npc, target, box, spreadKey: handle.spread === false ? null : npc.id });
      unplaced.add(npc);
    }
    for (const move of pending) {
      unplaced.delete(move.npc);
      // spread:false keeps a private, meaningful placement (a merchant's own
      // stall counter); every other handle is SHARED geometry, so disperse by
      // id. `taken` then closes the gap the hash cannot: colliding ids, and the
      // NPCs already standing in the destination, would otherwise stack — and a
      // sprite underneath another one can never be selected by talk-targeting.
      const taken = (x, y) => this.npcOccupies(move.target, x, y, move.npc, unplaced);
      const at = PF.schedule.walkableIn(move.target, move.box, move.spreadKey, taken);
      move.npc.x = at.x;
      move.npc.y = at.y;
    }
  }

  /** Is another NPC standing on — or already walking onto — this tile? Terrain
   *  alone is not enough: two NPCs would pick the same free tile and slide
   *  through each other.
   *
   *  A LINEAR SCAN, and the reason it used to give for that is no longer true.
   *  It said casts are capped at ~10; the compiler now mints residents to fill a
   *  settlement, and a thriving city puts a hundred and thirteen of them on one
   *  exterior zone at midday. So this was re-measured rather than left on a stale
   *  assumption: `stepNpcs` over that zone costs 0.0039ms a frame, against 0.0019
   *  for a village of 25. Four thousandths of a millisecond is 0.02% of a 60fps
   *  budget, so an occupancy index would still be the more expensive of the two.
   *
   *  It stays a scan because it is cheap, NOT because the cast is small. If a
   *  zone ever holds several hundred, measure again before believing this. */
  npcOccupies(z, x, y, exclude, ignore) {
    for (const other of z.npcs) {
      if (other === exclude) continue;
      // Anyone still waiting to be placed this pass is standing on LAST
      // daypart's tile, which says nothing about where they will be. Counting
      // them would let a stale position evict somebody from their own bed.
      if (ignore && ignore.has(other)) continue;
      if (Math.round(other.x) === x && Math.round(other.y) === y) return true;
      const timer = this._npcTimers.get(other.id);
      if (timer && (timer.dx || timer.dy) && timer.tx === x && timer.ty === y) return true;
    }
    return false;
  }

  stepNpcs(dt, z) {
    for (const npc of z.npcs) {
      // The person you are talking TO stands still. nearNpc stops updating the
      // moment dialogue starts, so it still points at whoever was greeted —
      // drifting away mid-sentence read as if they had stopped listening.
      if (this.mode === "dialogue" && this.nearNpc && npc.id === this.nearNpc.id) {
        npc.stepPhase = 0;
        continue;
      }
      let t = this._npcTimers.get(npc.id);
      if (!t) {
        t = { wait: 1 + this._rnd() * 3, dx: 0, dy: 0, fx: npc.x, fy: npc.y };
        this._npcTimers.set(npc.id, t);
      }
      t.wait -= dt;
      if (t.wait <= 0) {
        const dirs = [
          [0, 0],
          [0, 0],
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ];
        const [dx, dy] = dirs[(this._rnd() * dirs.length) | 0];
        const nx = Math.round(t.fx) + dx;
        const ny = Math.round(t.fy) + dy;
        const w = npc.wander;
        if (
          nx >= w.x0 &&
          nx <= w.x1 &&
          ny >= w.y0 &&
          ny <= w.y1 &&
          PF.schedule.standable(z, nx, ny) &&
          !this.npcOccupies(z, nx, ny, npc)
        ) {
          t.dx = dx;
          t.dy = dy;
          t.tx = nx; // remember the DESTINATION — see the arrival test below
          t.ty = ny;
        } else {
          t.dx = 0;
          t.dy = 0;
        }
        t.wait = 1.2 + this._rnd() * 2.6;
      }
      if (t.dx || t.dy) {
        const speed = 1.6 * dt; // tiles/s
        t.fx += t.dx * speed;
        t.fy += t.dy * speed;
        npc.facing = t.dx < 0 ? 2 : t.dx > 0 ? 3 : t.dy < 0 ? 1 : 0;
        npc.stepPhase = (npc.stepPhase || 0) + dt * 6;
        // Arrival is reaching the DESTINATION tile, not merely being near an
        // integer: NPCs always start on an exact tile, and at the fixed 1/60s
        // step one move covers 1.6/60 = 0.027 tiles, so a "near any integer"
        // test matched the tile they were still standing on and cancelled every
        // move on its first frame — the wander has never actually moved anyone.
        if ((t.dx > 0 && t.fx >= t.tx) || (t.dx < 0 && t.fx <= t.tx)) {
          t.fx = t.tx;
          t.dx = 0;
          t.dy = 0;
        } else if ((t.dy > 0 && t.fy >= t.ty) || (t.dy < 0 && t.fy <= t.ty)) {
          t.fy = t.ty;
          t.dx = 0;
          t.dy = 0;
        }
        npc.x = t.fx;
        npc.y = t.fy;
      } else {
        npc.stepPhase = 0;
      }
    }
  }

  clockLabel() {
    const h = Math.floor(this.clockMin / 60);
    const m = this.clockMin % 60;
    return `Day ${this.day} · ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  /** 0..1 darkness for the tint pass. */
  darkness() {
    const h = this.clockMin / 60;
    if (h >= 7 && h < 18) return 0;
    if (h >= 18 && h < 21) return ((h - 18) / 3) * 0.55;
    if (h >= 21 || h < 5) return 0.55;
    return (1 - (h - 5) / 2) * 0.55; // 5..7 dawn
  }

  /** Compact world header prefixed onto turns so the GM narrates the world we show. */
  header() {
    const z = this.zone();
    const near = this.nearNpc ? `; near: ${this.nearNpc.name} (${this.nearNpc.role})` : "";
    // The daypart word is one token and keeps the GM's light and "who is about"
    // narration consistent with what we render and where NPCs actually are.
    return `[World: ${z.name}; ${this.clockLabel()} (${this.daypart()})${near}]`;
  }

  /** The metered turn prefix (docs/brief-schema.md §7): name+role ride the
   *  header ALWAYS; the settlement situation injects once on the first
   *  outbound message; a zone's flavor once on first entry; an NPC's persona
   *  once per NPC. The one-shot flags persist in saves, so a reload never
   *  re-taxes the context — chat history is the durable channel. Legacy
   *  worlds carry no prose, so this degrades to header() exactly. */
  composePrefix(npc) {
    this.intro ??= { world: false, zones: {}, npcs: {} };
    const parts = [this.header()];
    // Compose is pure; the one-shot flags burn only on commitIntro(), which the
    // senders call once the host ACCEPTS the turn — a refused or failed send
    // must not lose the prose forever (review finding).
    const pending = { world: false, zone: null, npc: null };
    if (!this.intro.world && this.world.situation) {
      parts.push(`[Setting: ${this.world.situation}]`);
      pending.world = true;
    }
    const z = this.zone();
    if (!this.intro.zones[this.zoneId] && z.flavor) {
      parts.push(`[${z.name}: ${z.flavor}]`);
      pending.zone = this.zoneId;
    }
    if (npc && npc.id && npc.persona && !this.intro.npcs[npc.id]) {
      parts.push(`[${npc.name}: ${npc.persona}]`);
      pending.npc = npc.id;
    }
    // THE WRAP-UP TELL, LAST IN THE JOIN — which puts it after the persona part
    // and before the sender's own action text, where the plan asks for it (§2.6).
    // It is also the ONLY part of any turn a fishing word can reach the GM
    // through (M10 as amended): the verb narrates nothing, files ledger lines,
    // and those lines are told here or not at all.
    const ledger = this._composeLedger();
    if (ledger) parts.push(ledger.text);
    // The ephemeral half of the flush, handed to the sender rather than stored:
    // which day the tell reached, and which notice ROWS rode with it. Compose
    // stays pure — nothing here burns, and a refused or failed send must lose
    // nothing, exactly as the one-shot flags above it must not.
    pending.ledger = ledger ? { throughDay: ledger.throughDay, notices: ledger.notices } : null;
    this._pendingIntro = pending;
    return parts.join(" ");
  }

  /** The wrap-up tell: the days a completed sleep made owed and has not told, and
   *  every notice still untold. Composed from the two live fields every time and
   *  persisted NOWHERE — there is no stored "what we said last time", so a re-tell
   *  after a lost burn simply reads the same live selection again and says the
   *  same thing (plan §2.5). Returns null when there is nothing owed and nothing
   *  untold, else { text, throughDay, notices }.
   *
   *  LINES: `flushedDay < day ≤ intro.ledgerOwed`, stubs included — an elided day
   *  that says "12 things happened" is still the truest account of it there is.
   *  NOTICES: every untold row, whatever day it carries. The band answers to its
   *  flag rather than to the gate, which is the whole reason it left the lines.
   *
   *  WHOLE DAYS, OLDEST FIRST, AND THE NEWEST DROPPED. The budget is
   *  `TUNING.ledgerTellChars`, measured in graphemes over the line TEXTS — not
   *  over this function's own framing, because the budget is floor-asserted at
   *  load against one maximum-shape day (`ledgerPerDay × ledgerChars`) and a
   *  measure that counted the word "Day" would put a legal day over the floor and
   *  stall the flush forever. Days are rendered oldest-first so the story arrives
   *  in order, and the burn advances only through the last day rendered WHOLE, so
   *  a truncated tell leaves `ledgerOwed` standing and the next turn continues
   *  from where this one stopped.
   *
   *  …AND THE OLDEST DAY ALWAYS RIDES, over budget or not. A day this build can
   *  WRITE cannot exceed the budget (that is what the floor assertion buys), but
   *  a hostile save can carry fifty lines on one day, and "tell nothing, advance
   *  nothing, forever" is a worse answer than one oversized part. */
  _composeLedger() {
    const player = this.player;
    if (!player || typeof player !== "object") return null;
    const owed = PF.player.resolvedDay(this.intro?.ledgerOwed);
    const gate = PF.player.resolvedDay(player.flushedDay);
    const lines = (Array.isArray(player.ledger?.lines) ? player.ledger.lines : []).filter((line) => {
      if (!Array.isArray(line) || line.length < 2) return false;
      const day = PF.player.resolvedDay(line[0]);
      return day > gate && day <= owed;
    });
    const budget = PF.economy?.TUNING?.ledgerTellChars ?? 0;
    const rendered = [];
    let spent = 0;
    let through = gate;
    for (const day of [...new Set(lines.map((line) => PF.player.resolvedDay(line[0])))].sort((a, b) => a - b)) {
      const texts = lines
        .filter((line) => PF.player.resolvedDay(line[0]) === day)
        .map((line) => (typeof line[1] === "string" ? line[1] : ""));
      const cost = texts.reduce((sum, text) => sum + PF.player.graphemes(text).length, 0);
      if (rendered.length && spent + cost > budget) break;
      rendered.push(`Day ${day}: ${texts.join(" ")}`);
      spent += cost;
      through = day;
    }
    const untold = (Array.isArray(player.ledger?.notices) ? player.ledger.notices : []).filter(
      (row) => Array.isArray(row) && row.length >= 2 && !row[2],
    );
    if (!rendered.length && !untold.length) return null;
    const sentences = [...rendered];
    // ONE framing sentence for the whole band, and it frames them as things that
    // happened TO the world rather than in the player's days — which is what they
    // are, and what the writer-site copy each of them carries will say in more
    // detail as the band grows an actor to name (M3, roadmap).
    if (untold.length) {
      const said = untold.map((row) => (typeof row[1] === "string" ? row[1] : "")).join(" ");
      sentences.push(`Also, about the world itself rather than the days in it: ${said}`);
    }
    return { text: `[Wrap-up — ${sentences.join(" ")}]`, throughDay: through, notices: untold };
  }

  /** Burn the one-shot flags for the last composed prefix (accepted turn). */
  commitIntro() {
    const pending = this._pendingIntro;
    if (!pending) return;
    this._pendingIntro = null;
    if (!pending.world && !pending.zone && !pending.npc) return;
    this.intro ??= { world: false, zones: {}, npcs: {} };
    if (pending.world) this.intro.world = true;
    if (pending.zone) this.intro.zones[pending.zone] = true;
    if (pending.npc) this.intro.npcs[pending.npc] = true;
    this.dirty = true;
  }
};

// ===== 40-render.js =====
// ── Renderer ──────────────────────────────────────────────────────────────────
// Canvas2D, 480×270 internal, integer-scaled by the underlay wrapper. Zone base
// and overhead layers are pre-composited once per zone (chunking is overkill at
// this zone size; the seam is here when zones grow). Actors y-sort between the
// two composites. The canvas only covers the centered viewport, so the host's
// scene background stays visible in the letterbox bands (verified trap #3).
PF.Render = class {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
    this._zoneCache = new Map(); // zoneId → {base, overhead}
  }

  invalidateZone(zoneId) {
    this._zoneCache.delete(zoneId);
  }

  /** Drop every zone composite (chat/world switch): the cache is keyed by zone
   *  id alone, so a new world's zones would otherwise reuse stale composites. */
  clearZones() {
    this._zoneCache.clear();
  }

  _composite(z) {
    let c = this._zoneCache.get(z.id);
    if (c) return c;
    const T = PF.TILE;
    const base = PF.offscreen(z.w * T, z.h * T);
    const over = PF.offscreen(z.w * T, z.h * T);
    const bg = base.getContext("2d");
    const og = over.getContext("2d");
    bg.imageSmoothingEnabled = false;
    og.imageSmoothingEnabled = false;
    for (let y = 0; y < z.h; y++) {
      for (let x = 0; x < z.w; x++) {
        const i = y * z.w + x;
        bg.drawImage(PF.art.tile(z.ground[i]), x * T, y * T);
        if (z.object[i]) bg.drawImage(PF.art.tile(z.object[i]), x * T, y * T);
        if (z.overhead[i]) og.drawImage(PF.art.tile(z.overhead[i]), x * T, y * T);
      }
    }
    c = { base, overhead: over };
    this._zoneCache.set(z.id, c);
    return c;
  }

  draw(sim, opts) {
    const { ctx } = this;
    const T = PF.TILE;
    const z = sim.zone();
    const comp = this._composite(z);
    ctx.clearRect(0, 0, PF.VW, PF.VH);

    // camera: center player, clamp to zone, snap to whole pixels (pixel-art rule)
    const worldW = z.w * T;
    const worldH = z.h * T;
    const camX = Math.round(PF.clamp(sim.x - PF.VW / 2, 0, Math.max(0, worldW - PF.VW)));
    const camY = Math.round(PF.clamp(sim.y - PF.VH / 2, 0, Math.max(0, worldH - PF.VH)));
    const viewW = Math.min(PF.VW, worldW);
    const viewH = Math.min(PF.VH, worldH);
    const offX = Math.floor((PF.VW - viewW) / 2);
    const offY = Math.floor((PF.VH - viewH) / 2);

    ctx.drawImage(comp.base, camX, camY, viewW, viewH, offX, offY, viewW, viewH);

    // actors, y-sorted (player + NPC tokens); Tier-1 sheets ?? Tier-0 strips
    const actors = z.npcs
      .map((npc) => ({
        y: npc.y * T + 8,
        draw: () => {
          PF.art.drawActor(
            ctx,
            npc.id,
            npc.hue,
            npc.facing || 0,
            npc.stepPhase || 0,
            !!npc.stepPhase,
            Math.round(npc.x * T + 2 - camX + offX),
            Math.round(npc.y * T - 6 - camY + offY),
          );
          if (sim.nearNpc === npc && sim.mode === "walk") {
            ctx.fillStyle = "#f3efe2";
            ctx.fillRect(Math.round(npc.x * T + 7 - camX + offX), Math.round(npc.y * T - 12 - camY + offY), 2, 5);
            ctx.fillRect(Math.round(npc.x * T + 7 - camX + offX), Math.round(npc.y * T - 5 - camY + offY), 2, 2);
          }
        },
      }))
      .concat([
        {
          y: sim.y,
          draw: () => {
            PF.art.drawActor(
              ctx,
              "player",
              158, // teal fallback hue
              sim.facing,
              sim.phase,
              sim.moving,
              Math.round(sim.x - 6 - camX + offX),
              Math.round(sim.y - 14 - camY + offY),
            );
          },
        },
      ])
      .sort((a, b) => a.y - b.y);
    for (const a of actors) a.draw();

    this._blitOverhead(ctx, comp.overhead, z, sim, camX, camY, viewW, viewH, offX, offY);

    // day/night multiply tint + warm window glow
    const dark = sim.darkness();
    if (dark > 0.01) {
      ctx.globalCompositeOperation = "multiply";
      const nightBlue = `rgba(26,35,64,${dark})`;
      ctx.fillStyle = nightBlue;
      ctx.fillRect(offX, offY, viewW, viewH);
      ctx.globalCompositeOperation = "lighter";
      for (const l of z.lights) {
        const lx = l.x * T + 8 - camX + offX;
        const ly = l.y * T + 8 - camY + offY;
        if (lx < -24 || ly < -24 || lx > PF.VW + 24 || ly > PF.VH + 24) continue;
        const grad = ctx.createRadialGradient(lx, ly, 2, lx, ly, 22);
        grad.addColorStop(0, `rgba(255,217,138,${0.5 * dark})`);
        grad.addColorStop(1, "rgba(255,217,138,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(lx - 22, ly - 22, 44, 44);
      }
      ctx.globalCompositeOperation = "source-over";
    }

    // letterbox frame line so the world reads as a deliberate viewport over the scene art
    if (opts?.frame !== false) {
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 2;
      ctx.strokeRect(offX + 1, offY + 1, viewW - 2, viewH - 2);
    }
  }

  /** Overhead blit with a soft cutout around the player.
   *
   *  A building's eave is painted two rows ABOVE its footprint, and those rows are
   *  ordinary walkable grass — so the player can stand there, and since the overhead
   *  layer composites after the actors, the roof simply swallows them. Roughly 62
   *  tiles per settlement are walkable-but-roofed, and tall buildings make it worse.
   *
   *  The zone composites are cached and player-independent, so the hole cannot live
   *  in them: it is punched into a view-sized scratch each frame instead. Only while
   *  the player is actually covered — indoors and in the open this costs nothing and
   *  takes the original single-blit path. */
  _blitOverhead(ctx, overhead, z, sim, camX, camY, viewW, viewH, offX, offY) {
    const T = PF.TILE;
    const tx = Math.floor(sim.x / T);
    const ty = Math.floor(sim.y / T);
    // The sprite stands taller than its tile, so test the feet tile and the one
    // above it — checking only the feet leaves the head swallowed.
    const roofed = (x, y) => x >= 0 && x < z.w && y >= 0 && y < z.h && !!z.overhead[y * z.w + x];
    if (!roofed(tx, ty) && !roofed(tx, ty - 1)) {
      ctx.drawImage(overhead, camX, camY, viewW, viewH, offX, offY, viewW, viewH);
      return;
    }
    if (!this._peek) {
      this._peek = PF.offscreen(PF.VW, PF.VH);
      this._peek.getContext("2d").imageSmoothingEnabled = false;
    }
    const g = this._peek.getContext("2d");
    g.globalCompositeOperation = "source-over";
    g.clearRect(0, 0, PF.VW, PF.VH);
    g.drawImage(overhead, camX, camY, viewW, viewH, 0, 0, viewW, viewH);
    const px = Math.round(sim.x - camX);
    const py = Math.round(sim.y - camY - 8);
    const { inner, outer, max } = PF.ROOF_PEEK;
    // destination-out subtracts alpha, so the gradient's alpha IS the transparency.
    // Banded stops rather than a smooth ramp: three flat steps read as deliberate
    // pixel-art shading instead of a photographic vignette.
    const grad = g.createRadialGradient(px, py, inner, px, py, outer);
    grad.addColorStop(0, `rgba(0,0,0,${max})`);
    grad.addColorStop(0.55, `rgba(0,0,0,${max})`);
    grad.addColorStop(0.56, `rgba(0,0,0,${max * 0.6})`);
    grad.addColorStop(0.8, `rgba(0,0,0,${max * 0.6})`);
    grad.addColorStop(0.81, `rgba(0,0,0,${max * 0.25})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.globalCompositeOperation = "destination-out";
    g.fillStyle = grad;
    g.fillRect(px - outer, py - outer, outer * 2, outer * 2);
    g.globalCompositeOperation = "source-over"; // never leave the op set on the scratch
    ctx.drawImage(this._peek, 0, 0, viewW, viewH, offX, offY, viewW, viewH);
  }
};

// ===== 50-spatial.js =====
// ── World Maps (spatial context) client ───────────────────────────────────────
// Authority rule (exploration §02): spatial context owns where the party is;
// the tile world is a view of it. Reads go through the same REST endpoint the
// host uses; writes ride sendMessage's third argument with optimistic
// concurrency. A location change with no in-flight command is narrated drift:
// teleport to the bound zone (or toast), never queue a compensating transition.
//
// Review-hardened: a generation counter guards cross-chat races (a refresh
// started for chat A must never write into chat B's world). Transition
// outcomes arrive two ways: engines with capability API 1.12 address the
// commit/reject events to this package (onHostEvent — immediate), and on
// older engines `pending` still self-clears after two refreshes with no
// movement (the stale-count fallback; events simply never arrive there).
PF.spatial = {
  data: null, // last SpatialContextResponse (or null: unbound / not fetched)
  available: false,
  pending: null, // {commandId, destinationId, name, staleCount, stepwise?}
  _lastLocationId: null,
  _gen: 0,
  _seq: 0, // per-call refresh sequence: only the latest-started response applies

  reset() {
    this._gen++;
    this._seq = 0;
    this.data = null;
    this.available = false;
    this.pending = null;
    this._lastLocationId = null;
  },

  locationName() {
    const b = this.data?.breadcrumb;
    return b && b.length ? b[b.length - 1].name : null;
  },

  destinations() {
    const d = this.data?.destinations;
    if (!Array.isArray(d)) return [];
    return d
      .map((entry) => ({
        id: typeof entry.id === "string" ? entry.id : typeof entry.locationId === "string" ? entry.locationId : null,
        name: typeof entry.name === "string" ? entry.name : "(unnamed)",
      }))
      .filter((entry) => entry.id);
  },

  async refresh(core, { countStale = true } = {}) {
    if (!core.chatId) return;
    const gen = this._gen;
    const chatId = core.chatId;
    // Latest-started wins: 1.12 event refreshes overlap the per-turn ones, and
    // a slow pre-commit response landing AFTER a post-commit refresh would
    // otherwise roll the world back to the departed zone (review finding).
    const seq = ++this._seq;
    try {
      const data = await PF.api.getSpatial(chatId);
      // Chat switched (or reset) or superseded while in flight — drop it.
      if (gen !== this._gen || core.chatId !== chatId || seq !== this._seq) return;
      // Both degraded modes (verified trap #6): endpoint absent (package not
      // installed) OR a game that fell back to standard mode (definition null /
      // disabled). Either way the world runs on package state alone.
      this.available = !!(data && data.definition && data.currentLocationId);
      this.data = this.available ? data : null;
      if (!this.available) return;

      const loc = data.currentLocationId;
      // Seed the starting binding: first location we ever see maps to the
      // exterior — the world's OWN start zone, never a hardcoded id (compiled
      // worlds key zones z1..; the legacy literal poisoned their bindings
      // forever and broke drift-following — review blocker).
      const world = core.sim?.world;
      const rootZone = world ? world.zones[world.startZone] : null;
      if (world && rootZone && Object.keys(world.bindings).length === 0) {
        world.bindings[loc] = world.startZone;
        rootZone.spatialLocationId = loc;
        core.markDirty();
      }
      if (this.pending) {
        if (loc === this.pending.destinationId) {
          this.pending = null; // journey landed
        } else if (loc !== this._lastLocationId) {
          if (this.pending.stepwise) {
            // An intermediate hop of a step_by_step route: progress, not
            // supersession — the completing event clears it (review finding:
            // the old rule dropped a kept stepwise pending one GET later).
            this.pending.staleCount = 0;
          } else {
            this.pending = null; // superseded server-side
          }
        } else if (countStale && ++this.pending.staleCount >= 2) {
          // Two turns with no movement → the transition was rejected somewhere
          // we can't observe. Let go so drift-following resumes. Event-driven
          // refreshes pass countStale:false so 1.12 engines don't halve this
          // fallback budget (review finding).
          this.pending = null;
          core.hud?.toast("Travel didn't happen — the story stayed put.");
        }
      } else if (this._lastLocationId && loc !== this._lastLocationId) {
        // Narrated drift — the GM moved the party. Follow it; never compensate.
        // Guarded on the zone existing: a stale binding must degrade, not throw.
        const zoneId = world?.bindings[loc];
        const target = zoneId ? world?.zones[zoneId] : null;
        if (target && core.sim && core.sim.zoneId !== zoneId) {
          core.sim.teleport(zoneId, target.spawn.x, target.spawn.y);
        }
        // Same class as a walked zone entry, so the same top surface: a narrated
        // arrival is the one notice most likely to print while the player is
        // mid-paragraph (70-hud `toast`).
        core.hud?.toast(`Now at: ${this.locationName() ?? loc}`, "location");
      }
      this._lastLocationId = loc;
      core.hud?.refreshChips();
      // Spec §8: once the exterior is bound, generated zones register as map
      // locations. Fire-and-forget — every guard (done-key, in-flight, backoff,
      // chat-switch generation) lives inside the export module.
      void PF.mapsExport?.maybeSync(core);
    } catch (err) {
      // Network/parse trouble is not fatal to the world — stay on package state.
      console.warn("[pixelforge] spatial refresh failed", err);
    }
  },

  /** Capability API 1.12 events, addressed to this package by the host. The
   *  element's window listener has already matched packageId and chatId. */
  onHostEvent(core, detail) {
    // Event-driven refreshes never count toward the stale-count fallback —
    // delivery is live, and double-counting would halve the two-turn budget.
    if (detail.type === "spatial_context_refresh") {
      void this.refresh(core, { countStale: false });
      return;
    }
    const data = detail.data && typeof detail.data === "object" ? detail.data : {};
    if (detail.type === "spatial_transition_committed") {
      if (this.pending && data.commandId === this.pending.commandId) {
        // A step_by_step journey keeps its pending entry until the completing
        // event (the host's own keep-pending rule for stepwise routes); mark
        // it so refresh() treats intermediate hops as progress.
        const travel = data.travel;
        if (travel && travel.mode === "step_by_step" && travel.complete === false) this.pending.stepwise = true;
        else this.pending = null;
      }
      // With pending cleared, refresh() runs its normal drift-following: the
      // world teleports to the destination's bound zone (when one exists) and
      // announces the arrival — the feedback the polling path never gave.
      void this.refresh(core, { countStale: false });
      return;
    }
    if (detail.type === "spatial_transition_rejected") {
      if (this.pending && data.commandId === this.pending.commandId) {
        this.pending = null;
        core.hud?.toast("Travel didn't happen — the story stayed put.");
      }
      void this.refresh(core, { countStale: false });
    }
  },

  /** Travel via the host generation pipeline. Refusals and 409s surface as toasts. */
  async travel(core, dest) {
    if (!this.available || !core.host?.sendMessage || core.sim?.mode !== "walk") return;
    // One journey at a time: a second command would overwrite the first pending
    // entry and orphan its stale-count recovery.
    if (this.pending) {
      core.hud?.toast("A journey is already underway.");
      return;
    }
    const transition = {
      destinationId: dest.id,
      expectedDefinitionRevision: this.data.definition.revision,
      expectedCurrentLocationId: this.data.currentLocationId,
      commandId: PF.uid(),
    };
    this.pending = { commandId: transition.commandId, destinationId: dest.id, name: dest.name, staleCount: 0 };
    core.hud?.toast(`Traveling to ${dest.name}…`);
    // A chat switch during the await runs reset(); the post-await branches must
    // then leave the NEW chat's state alone (same guard refresh() uses).
    const gen = this._gen;
    const chatId = core.chatId;
    // A THIRD CAPTURE, and it is a DIFFERENT counter from the two above. Those
    // are spatial's own generation and the chat id, which fence this journey's
    // post-await branches; the player mutators fence on PF.save._gen, which moves
    // on a chat switch and is what stops this turn's wrap-up burn landing on the
    // arriving chat's block. Read pre-await, like everything else here.
    const saveGen = PF.save._gen ?? 0;
    try {
      const text = `${core.sim.composePrefix(null)} We travel to ${dest.name}.`;
      // The composed turn's own pending, closure-local — never re-read after the
      // await, where commitIntro's wholesale null waits (see 90-element interact
      // for the two ways this goes wrong).
      const pend = core.sim._pendingIntro;
      const ok = await core.host.sendMessage(text, undefined, transition);
      if (gen !== this._gen || core.chatId !== chatId) return;
      if (ok !== false) {
        core.sim?.commitIntro?.();
        // The burn, on the accepted turn. Guarded inside the mutator and its
        // refusal deliberately swallowed (plan §2.6). The captured pending hands
        // back BOTH halves of what was told — the day and the notice ROWS — so
        // the burn marks the band this turn carried and not whatever a rebuild
        // has written into the live one since (plan §2.5).
        if (pend?.ledger) PF.player.flush(core, pend.ledger.throughDay, pend.ledger.notices, saveGen);
      }
      // Both post-await branches act only on THIS journey's pending entry: a
      // 1.12 reject event may already have cleared it mid-await (a second,
      // contradictory toast would follow), and the player may already have
      // started journey B, which an unconditional clear would wipe (review).
      if (ok === false && this.pending?.commandId === transition.commandId) {
        // The host refused the turn (e.g. session concluded) — nothing is in flight.
        this.pending = null;
        core.hud?.toast("The story isn't accepting turns right now.");
      }
    } catch (err) {
      console.warn("[pixelforge] travel failed", err);
      if (gen !== this._gen || core.chatId !== chatId) return;
      if (this.pending?.commandId === transition.commandId) {
        this.pending = null;
        core.hud?.toast("Travel could not start — the map may have changed. Try again.");
        await this.refresh(core);
      }
    }
  },
};

// ===== 55-maps-export.js =====
// ── World Maps export (spec §8): register generated zones as locations ────────
// The compiled world's zones become children of the location the exterior is
// bound to, through the additive locations route (World Maps 1.4.0). The map
// definition itself is the idempotency ledger: location ids are seed-stable
// (pf.<hash(seed)>.<zoneId>), diffed against definition.locations before
// posting, and a root child already carrying a zone's name is ADOPTED rather
// than twinned. All completion state is keyed by WORLD OBJECT IDENTITY, not
// chat+seed: the generation flow boots a throwaway default world and swaps in
// the compiled one under the same chat and seed (60-save), rewinds rebuild the
// sim mid-session, and a string key survived all of those — suppressing the
// real world's export while the throwaway's zones polluted the map (review
// findings). A rebuilt world is a new object, so it re-syncs, and the
// definition diff makes that re-sync a cheap re-bind.
// Everything degrades quietly: no hierarchical map, an older maps package
// without the route, a shared-world-linked chat (posting would silently stage
// unpublished draft edits to a communal world), an interim pre-brief world,
// or a terminally refused batch all mean "the world runs on package state
// alone", never a nag and never a hot retry loop.
PF.mapsExport = {
  _done: new WeakSet(), // worlds fully synced or terminally skipped this session
  _inFlightWorld: null, // the world object a _sync is currently running for
  _failed: null, // {world, at} — 60s transient backoff, world-scoped

  _hash(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(36);
  },

  /** Seed-stable location id for a zone. Matches the route's id charset. */
  idFor(world, zoneId) {
    return `pf.${this._hash(String(world.seed))}.${zoneId}`;
  },

  /** Fire-and-forget from spatial refresh; every guard is internal. */
  async maybeSync(core) {
    const world = core.sim?.world;
    if (!world || !PF.spatial.available || !PF.spatial.data) return;
    // The pre-brief boot world of a generation-enabled chat is a throwaway —
    // registering its zones would pollute the map forever (additive route).
    if (world.interim) return;
    // A shared-world-linked chat cannot take additive writes directly: the
    // service stages them as unpublished draft edits to the communal world,
    // which the user never asked for. Skip without marking done so unlinking
    // re-enables the export.
    if (PF.spatial.data.sharedWorld?.mode === "linked") return;
    // Without a visible location list there is nothing to diff against —
    // acting blind would prune live bindings or post duplicates.
    if (!Array.isArray(PF.spatial.data.definition?.locations)) return;
    if (this._inFlightWorld === world || this._done.has(world)) return;
    if (this._failed?.world === world && Date.now() - this._failed.at < 60000) return;
    // The exterior must already be bound (refresh seeds that on first sight);
    // its location is the parent every exported zone hangs under — and it must
    // still exist, unarchived, in the CURRENT definition: a map replacement or
    // start-over leaves persisted bindings pointing at nothing, and posting
    // under a dead parent 400s forever.
    const rootLoc = Object.keys(world.bindings).find((loc) => world.bindings[loc] === world.startZone);
    if (!rootLoc) return;
    if (!this._locationIsActive(rootLoc)) {
      this._pruneDeadBindings(core, world);
      return; // an emptied table re-seeds on the next refresh, then re-exports
    }
    this._inFlightWorld = world;
    try {
      await this._sync(core, world, rootLoc);
    } catch (err) {
      this._failed = { world, at: Date.now() };
      console.warn("[pixelforge] World Maps export failed", err);
    } finally {
      if (this._inFlightWorld === world) this._inFlightWorld = null;
    }
  },

  _locationIsActive(locId) {
    const locations = PF.spatial.data?.definition?.locations;
    const row = Array.isArray(locations) ? locations.find((location) => location.id === locId) : undefined;
    return !!row && row.status !== "archived";
  },

  /** Drop bindings whose locations no longer exist (map replaced/started
   *  over). An emptied table lets 50-spatial's first-sight seeding re-bind
   *  the exterior to wherever the party now is. */
  _pruneDeadBindings(core, world) {
    let changed = false;
    for (const locId of Object.keys(world.bindings)) {
      if (this._locationIsActive(locId)) continue;
      const zone = world.zones[world.bindings[locId]];
      if (zone && zone.spatialLocationId === locId) zone.spatialLocationId = null;
      delete world.bindings[locId];
      changed = true;
    }
    if (changed) core.markDirty();
  },

  _existingIds() {
    const locations = PF.spatial.data?.definition?.locations;
    return new Set(Array.isArray(locations) ? locations.map((location) => location.id) : []);
  },

  /** Map of trimmed lowercase name → location id for the root's children,
   *  first occurrence wins. Lets a zone ADOPT a same-named location the user
   *  (or the wizard's map instructions) already authored instead of creating
   *  a twin — the additive route could never merge them afterwards. */
  _adoptableByName(rootLoc) {
    const locations = PF.spatial.data?.definition?.locations;
    const byName = new Map();
    for (const location of Array.isArray(locations) ? locations : []) {
      if (location.parentId !== rootLoc || typeof location.name !== "string") continue;
      const nameKey = location.name.trim().toLowerCase();
      if (nameKey && !byName.has(nameKey)) byName.set(nameKey, location.id);
    }
    return byName;
  },

  /** locId per zone: its own seed-stable id when present, an adopted
   *  same-named root child, else the seed-stable id (to be created). */
  _plan(world, zoneIds, rootLoc) {
    const existing = this._existingIds();
    const adoptable = this._adoptableByName(rootLoc);
    const claimed = new Set();
    return zoneIds.map((zoneId) => {
      const pfId = this.idFor(world, zoneId);
      if (existing.has(pfId)) return { zoneId, locId: pfId, create: false };
      const nameKey = String(world.zones[zoneId].name || "")
        .trim()
        .toLowerCase();
      const adopted = nameKey ? adoptable.get(nameKey) : undefined;
      // Adopt when the location is unclaimed OR already bound to THIS zone —
      // a restored save carries prior adoptions, and refusing our own binding
      // would flip the plan back to creation (live-found regression). Never
      // steal a location bound to a different zone.
      const boundTo = adopted !== undefined ? world.bindings[adopted] : undefined;
      if (adopted && (boundTo === undefined || boundTo === zoneId) && !claimed.has(adopted)) {
        claimed.add(adopted);
        return { zoneId, locId: adopted, create: false };
      }
      return { zoneId, locId: pfId, create: true };
    });
  },

  _rowFor(world, zoneId, rootLoc) {
    const zone = world.zones[zoneId];
    const row = {
      id: this.idFor(world, zoneId),
      parentId: rootLoc,
      name: String(zone.name || zoneId).slice(0, 200),
      kind: zone.mapKind === "building" ? "building" : "place",
    };
    if (typeof zone.flavor === "string" && zone.flavor.trim()) row.description = zone.flavor.slice(0, 4000);
    return row;
  },

  /** Abort when the run's ground truth moved: chat switched, spatial reset,
   *  or the sim was REBUILT under the same chat (brief arrival, rewind) —
   *  writing into the captured world object would bind an orphan. */
  _stale(core, world, gen, chatId) {
    return gen !== PF.spatial._gen || core.chatId !== chatId || core.sim?.world !== world;
  },

  async _sync(core, world, rootLoc) {
    const gen = PF.spatial._gen;
    const chatId = core.chatId;
    // A building is ONE location; its floors are rooms inside it. A zone that is
    // a room stamps mapExport = false (20-world) and is skipped here — it gets no
    // row and no binding. This route is additive with NO delete, so a row posted
    // to a player's real map can never be taken back: the gate belongs on the
    // same side of the release as the zone type that needs it.
    const zoneIds = Object.keys(world.zones).filter(
      (zoneId) => zoneId !== world.startZone && world.zones[zoneId].mapExport !== false,
    );
    let plan = this._plan(world, zoneIds, rootLoc);
    let missing = plan.filter((entry) => entry.create).map((entry) => entry.zoneId);
    let retriesWithoutProgress = 0;
    let attempts = 0;

    // The route caps a batch at 50; worlds are far smaller, but never assume.
    while (missing.length) {
      // Absolute budget: the no-progress counters below compare consecutive
      // iterations, and a live editor can make `missing` OSCILLATE (archiving
      // an adoptable flips a zone back to creation, restoring it flips it
      // again) so consecutive comparisons alone never fire. Every response
      // sequence must terminate.
      if (++attempts > 8) throw new Error("too many export attempts; the map keeps changing");
      const batch = missing.slice(0, 50);
      const res = await PF.api.postSpatialLocations(chatId, {
        expectedRevision: PF.spatial.data.definition.revision,
        locations: batch.map((zoneId) => this._rowFor(world, zoneId, rootLoc)),
      });
      if (this._stale(core, world, gen, chatId)) return;
      if (res.ok) {
        await PF.spatial.refresh(core, { countStale: false });
        if (this._stale(core, world, gen, chatId) || !PF.spatial.available) return;
        const before = missing.length;
        plan = this._plan(world, zoneIds, rootLoc);
        missing = plan.filter((entry) => entry.create).map((entry) => entry.zoneId);
        // An accepted batch whose rows never appear in the re-read (a proxy
        // eating writes, a stale read replica) must not loop forever posting.
        if (missing.length >= before && ++retriesWithoutProgress > 2) {
          throw new Error("accepted locations never appeared in the definition");
        }
        continue;
      }
      const code = res.body?.code;
      if (res.status === 409 && (code === "spatial_definition_stale" || code === "spatial_location_conflict")) {
        // Someone else moved the map (or raced an id in). Re-read and let the
        // diff decide what is still missing; the additive route means nothing
        // of theirs can be harmed by retrying ours. A live editing session can
        // keep moving the revision forever — two no-progress retries and we
        // back off to a later session instead of dueling.
        await PF.spatial.refresh(core, { countStale: false });
        if (this._stale(core, world, gen, chatId) || !PF.spatial.available) return;
        const before = missing.length;
        plan = this._plan(world, zoneIds, rootLoc);
        missing = plan.filter((entry) => entry.create).map((entry) => entry.zoneId);
        // >= not ===: a GROWN missing list (someone archived an adoptable out
        // from under the plan) is regression, not progress.
        if (missing.length >= before && ++retriesWithoutProgress > 2) {
          throw new Error("definition kept moving during export");
        }
        continue;
      }
      if (res.status >= 400 && res.status < 500 && res.status !== 409) {
        // Deliberate refusals — route absent (404), archived/vanished parent,
        // the 500-location cap, disabled maps. These do not heal inside a
        // session, so the world is done here: no bindings to absent locations,
        // no 60-second drumbeat. A rebuild or reload starts fresh.
        this._done.add(world);
        if (res.status !== 404) {
          console.warn(
            `[pixelforge] World Maps export refused (${res.status}${code ? ` ${code}` : ""}); skipping this session`,
          );
        }
        return;
      }
      // 5xx / unclassified: transient — back off and retry within the session.
      throw new Error(`locations route → ${res.status}${code ? ` (${code})` : ""}`);
    }

    // Bind every planned zone — created, adopted, or already present from an
    // earlier session (which self-heals bindings a save may have lost).
    // Bindings are what make travel and drift teleport into these zones.
    let changed = false;
    for (const { zoneId, locId } of plan) {
      if (world.bindings[locId] !== zoneId) {
        world.bindings[locId] = zoneId;
        changed = true;
      }
      const zone = world.zones[zoneId];
      if (zone && zone.spatialLocationId !== locId) {
        zone.spatialLocationId = locId;
        changed = true;
      }
    }
    if (changed) core.markDirty();
    this._failed = null;
    this._done.add(world);
  },
};

// ===== 58-player.js =====
// ── The player state block (S5) ───────────────────────────────────────────────
// One namespaced, versioned `player` block inside the save snapshot: inventory
// and money, skills and equipped tools, the relationship ledger, quest state,
// the day-ledger buffer, discovery state, and the home anchor. Everything else
// in the world stays a pure function of (seed, theme, brief, clock) — that is
// what keeps a rebuild byte-identical and a rewind safe.
//
// THREE PROPERTIES, declared per field (plan §0):
//   • world-free  — means the same thing in any world (pouch, skills, board-done)
//   • world-bound — meaningless once the world changed under it (rel, quests,
//                   found, home, ledger lines)
//   • coupled     — `flushedDay`, which is only interpretable against the lines
//                   it gates, so it is quarantined WITH them and clamped when
//                   they go (plan §0, §Q3a)
//
// The block carries its OWN version (`player.v`), not the envelope's: an
// envelope bump would force a player migration that changes nothing, and a
// player bump would invalidate envelopes that were fine (ROADMAP §S5).

// The player block's schema version is DERIVED from the migration table, never
// written twice: `MIGRATIONS[i]` takes v(i+1) to v(i+2), so an empty table is
// exactly "v1, and v1 is the identity". A step and a version constant that can
// disagree is a bug waiting for its first migration.
const PLAYER_MIGRATIONS = [];
const currentPlayerV = () => PLAYER_MIGRATIONS.length + 1;

// Size caps (plan §4), and they do not all bite the same way. Stated honestly
// because a consumer in slice 6 has to know which calls can come back empty:
//
//   EVICT (the cap makes room and the call succeeds) — relLines evicts the
//     oldest line and leaves its row standing; boardDone / packDone evict the
//     least-earned counter; ledgerDays / ledgerPerDay / ledgerStubs compact the
//     buffer; found evicts the oldest discovery; `notices` evicts the oldest
//     TOLD row, and an untold one only when every row is untold.
//   TRUNCATE (the value is cut, the call succeeds) — lineChars, ledgerChars,
//     skillLevel (the level stops climbing and xp is zeroed at the ceiling).
//   REFUSE (the call does nothing and says so, which is the part the old header
//     denied) — `items`: grant() returns 0 when the pouch is full and the item
//     is a new (t,k) row; `activeQuests`: quest("accept") returns false;
//     `relRows`: bump() returns null when the cap is reached and there is no
//     STRANGER-tier row left to evict for the newcomer.
//
// THESE ARE GAMEPLAY AND HYGIENE BOUNDS, NOT A SIZE BUDGET (maintainer ruling,
// round 2). A previous pass shrank every one of them to hold a saturated town
// inside a 24 KB "design budget" carried over from a mobile-payload worry, and
// what that bought was settlements that feel tiny. The budget is abolished. The
// only real walls are the Engine's per-row cap (MAX_SNAPSHOT_CHARS, 262,144 —
// the server 422s above it) and the browser keepalive quota on the pagehide
// teardown path specifically; a saturated world sits far under both, and
// test-brief case (ah) MEASURES the shape and asserts against those walls rather
// than a budget. Size optimization is explicitly deferred: nothing below is
// chosen for bytes. The numbers are the plan's own.
const CAPS = {
  items: 60, // pouch rows, keyed (t,k)
  relRows: 150, // relationship rows per SAVE, across zones
  relLines: 30, // rows allowed to hold an `s` line at once
  lineChars: 80, // graphemes in one `s` line
  activeQuests: 10,
  boardDone: 40,
  packDone: 40,
  bought: 30,
  ledgerDays: 3, // days kept in FULL
  ledgerPerDay: 15,
  ledgerStubs: 30, // elided days, one stub line each
  ledgerChars: 200,
  // The notice band's own rows (plan §2.5). Notices are explanations for
  // something that already happened to the save — a severance, a loss, a
  // restore — and a block carrying a dozen unread ones has bigger news than the
  // thirteenth. Small on purpose, and it evicts TOLD rows first: an untold
  // notice is one nobody has been given yet, so it is the last thing to lose.
  notices: 12,
  found: 80,
  skillLevel: 20,
};

// Placeholder curve, exported so slice 6 can retune it without touching the
// mutator: experience needed to leave level `l`.
const xpPerLevel = (l) => 10 * Math.max(1, l);

// The quality axis of a pouch row's `(t, k)` key, worst to best. It is a LADDER
// and not a label set: the INDEX is the tier every multiplier reads, so the
// order is load-bearing and an insertion in the middle would re-tier every save
// in the wild. Frozen for that reason — a retune belongs in the multipliers the
// index feeds, never in the ladder itself.
//
// IT GRADES TOOLS ONLY, and the rest of the field is not junk it is being
// lenient about. Every other `k` in the pouch is a SEMANTIC SLUG — a catch row's
// variant ("carp", "kelp"), a bait's kind — and a slug is not a worse "crude":
// the two vocabularies share one field and must not share one validator. So the
// grading rule is scoped by TYPE. TOOL_TYPES is the named set that says which
// rows are graded; grant() and equip() refuse a graded row whose `k` is off the
// ladder and leave every other row's `k` free.
//
// `rod` is 0.12's only tool, and it is named HERE while its item vocabulary and
// its skins land with the verb that uses it: what the pouch needs at this layer
// is the grading rule, which is a property of the key and belongs beside the
// caps the mutators enforce.
const QUALITY = Object.freeze(["crude", "decent", "fine", "masterwork"]);
const TOOL_TYPES = new Set(["rod"]);

// The quarantine bag's own ceiling, independent of the snapshot's (plan §4).
// It lives in its own metadata key, so it competes with nothing — which is why
// this is a TRIPWIRE against a pathological blob bloating the chat's metadata
// and not a size allowance to fit inside (maintainer ruling, round 2). At any
// realistic severance size the overflow logic below should never fire; it stays
// because it is the tripwire's mechanism, and because "held" has to mean held.
const QUARANTINE_MAX_CHARS = 131_072;
// Least-recoverable first (plan §Q1a). `setAside` goes before anything else:
// nothing else in the bag is waiting on a machine to hand it back.
const QUARANTINE_DROP_ORDER = ["setAside", "stamp", "migration", "version"];
const QUARANTINE_SLOTS = ["migration", "stamp", "setAside", "version"];
const QUARANTINE_KEY = "pixelforgeQuarantine";
// `setAside` is the one HUMAN-resolved slot, so it is the one slot that is a
// LIST: a second displaced live block is a second thing to offer the player,
// not a repeat of the first. Bounded by count as well as by the bag's ceiling,
// and its overflow sheds the OLDEST entries first — the newest displacement is
// the one they are most likely to still want back.
const SETASIDE_MAX = 4;
// The size past which PF.quarantine's `_unsettled` map sheds the records DISK IS
// KNOWN TO HOLD. It is not a hard cap and deliberately not one: every other entry
// in that map is a write nobody has managed to store, which is the whole reason
// the map exists, so past the settled records the map CARRIES THE OVERFLOW rather
// than the loss.
//
// That is the same trade PF.save._cacheBrief makes for the sealed-brief cache,
// and the alignment is deliberate (O-2): the two are the same shape of thing — a
// per-session map of small byte strings where each entry is the sole record of
// something a later visit needs — and they were shipped answering the same fork
// two different ways. A session visits a handful of chats, and only a chat that
// both quarantined something AND failed to store it leaves an entry behind at
// all, so what this is really bounded by is how rare that pair is.
const UNSETTLED_MAX = 8;

const isFiniteInt = (v) => typeof v === "number" && Number.isFinite(v) && Math.floor(v) === v;
const posInt = (v, fallback) => (isFiniteInt(v) && v >= 0 ? v : fallback);
const str = (v) => (typeof v === "string" ? v : "");
// JSON.parse hands "__proto__" back as an own property; assigning it onto a
// plain object sets the PROTOTYPE instead of a key. Every map read below goes
// through this (the same discipline 60-save's binding read already uses).
const ownEntries = (obj) => {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return [];
  const out = [];
  for (const key of Object.keys(obj)) {
    if (key === "__proto__") continue;
    out.push([key, obj[key]]);
  }
  return out;
};
// The player-block keys THIS build understands, in wire order. Anything else on
// a restored block was written by a NEWER build at the same `player.v`, and
// serialize() re-emits it rather than dropping it — the same additive-only
// contract ENVELOPE_KEYS gives the envelope one level up (ROADMAP §S5: "unknown
// keys preserved rather than dropped so a downgrade does not silently destroy
// data a newer build wrote"; plan §Q1 "unknown-key retention both levels").
// Additions to serialize()'s literal MUST be added here too.
const PLAYER_KEYS = new Set([
  "v",
  "game",
  "world",
  "flushedDay",
  "pouch",
  "skills",
  "quests_done_board",
  "rel",
  "quests",
  "bought",
  "ledger",
  "found",
  "home",
]);
// Sorted-key rebuild. JS enumerates integer-like keys first whatever the
// insertion order, so this is deterministic rather than literally sorted for
// such a key — determinism is the property the dedupe needs, not the ordering.
const sortedMap = (pairs) => {
  const out = {};
  for (const [key, value] of pairs.slice().sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
    if (value !== undefined) out[key] = value;
  }
  return out;
};

/** The grapheme units of a string, best-effort. Exported (see PF.player), because
 *  the caps below are stated in graphemes and so is the ONE consumer that has to
 *  agree with them from another file: the wrap-up tell measures whole ledger days
 *  against `TUNING.ledgerTellChars` (30-sim `_composeLedger`), and that budget is
 *  floor-asserted at load against `ledgerPerDay × ledgerChars`.
 *
 *  Measure the tell in code points while the caps count graphemes and the floor
 *  assertion stops being a promise about the same quantity: one family emoji in a
 *  zone name is seven code points wide, so a day the caps call legal can be four
 *  times its own measured size and the budget drops it. What that costs is
 *  OVER-EAGER TRUNCATION rather than a stall — the oldest owed day always rides,
 *  fitting or not, so the flush still advances one day at a time — but a
 *  multi-day tell would be cut short every turn on a save whose prose is not
 *  ASCII, which is a real player writing real names. One measure, both sides. */
const graphemes = (text) => {
  const s = str(text);
  try {
    return globalThis.Intl?.Segmenter
      ? Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s), (part) => part.segment)
      : Array.from(s);
  } catch {
    return Array.from(s);
  }
};

/** Grapheme-aware truncation: an `s` line is player-visible prose and a cut
 *  through a surrogate pair or a combining mark renders as a broken glyph. */
const clip = (text, max) => {
  const s = str(text).replace(/\s+/g, " ").trim();
  const units = graphemes(s);
  return units.length <= max ? s : units.slice(0, max).join("");
};

/** The notice band's cap, applied wherever the array is normalized — the writer
 *  below, `_enforceCaps`, and serialize() — so the wire, a restored block and a
 *  live one cannot disagree about which twelve survived.
 *
 *  TOLD-OLDEST FIRST. A told notice has already reached the GM through the flush
 *  and is only still here so the panel can show it; an untold one is a sentence
 *  nobody has been given. When every row is untold the OLDEST goes, because a cap
 *  that cannot bite is not a cap. */
const evictNotices = (rows) => {
  if (!Array.isArray(rows) || rows.length <= CAPS.notices) return Array.isArray(rows) ? rows : [];
  const out = rows.slice();
  while (out.length > CAPS.notices) {
    const told = out.findIndex((row) => Array.isArray(row) && row[2]);
    out.splice(told >= 0 ? told : 0, 1);
  }
  return out;
};

PF.player = {
  CAPS,
  QUALITY,
  TOOL_TYPES,
  MIGRATIONS: PLAYER_MIGRATIONS,
  xpPerLevel,
  graphemes,
  /** The schema version THIS build writes. Derived — see PLAYER_MIGRATIONS. */
  currentV: currentPlayerV,

  /** A brand-new block. The key order here is the wire order (plan §2) and the
   *  serializer reproduces it exactly; `bought` boots ABSENT (it is an optional
   *  seam that activates with the stock-table model) and is only emitted once
   *  something is in it. */
  defaultPlayer() {
    return {
      v: currentPlayerV(),
      game: 1,
      world: { seed: 0, briefHash: 0, mintStamp: 0 },
      flushedDay: 0,
      pouch: { money: 0, items: [] },
      skills: { verbs: {}, equipped: {} },
      quests_done_board: {},
      rel: {},
      quests: { done_pack: {}, active: [] },
      bought: null,
      ledger: { lines: [] },
      found: { zones: [] },
      home: null,
    };
  },

  // ── World identity (plan §Q3, §Q3a) ────────────────────────────────────────

  /** FNV over the SEALED brief, which is the artifact the world was compiled
   *  from. Absent brief → 0, which is also what a legacy world stamps, so the
   *  two are deliberately indistinguishable: neither has a brief to change. */
  briefHashOf(brief) {
    if (!brief || typeof brief !== "object") return 0;
    try {
      return PF.hashStr(JSON.stringify(brief));
    } catch {
      return 0;
    }
  },

  /** The three stamps a world answers for. `mintStamp` is derived by the
   *  compiler (20-world `mintStampOf`) and costs zero save bytes. */
  stampsFor(world, brief) {
    return {
      seed: (world?.seed ?? 0) >>> 0,
      briefHash: this.briefHashOf(brief),
      mintStamp: (world?.mintStamp ?? 0) >>> 0,
    };
  },

  // ── Serialization (plan §2) ────────────────────────────────────────────────

  /** By value, deterministic, byte-stable under JSON.stringify. Every dedupe in
   *  the save path is string equality over the serialized snapshot, so an order
   *  that drifted with the source would forge both spurious saves and spurious
   *  "The world rewound with the story." toasts (60-save snapshot()). */
  serialize(player, dropCarry) {
    const p = player && typeof player === "object" ? player : this.defaultPlayer();
    const out = {};
    // UNKNOWN KEYS FIRST, ours assigned over them — the envelope's own order and
    // for the envelope's own reason (60-save snapshot()). A newer build's field
    // at the SAME player.v rides through this build untouched instead of being
    // deleted by the next flush; the too-new version gate only covers a block
    // whose `v` moved, and bumping `v` to ship one additive field costs every
    // older build a defaults boot until re-adoption. Sorted so the bytes cannot
    // drift with the source, emitted only when there are any, so a block this
    // build wrote is byte-identical to one written before the carry existed.
    // `dropCarry` is the pre-flight fallback, threaded down from snapshot().
    if (!dropCarry) {
      for (const key of Object.keys(p).sort()) {
        if (PLAYER_KEYS.has(key) || key === "__proto__") continue;
        if (p[key] === undefined) continue;
        out[key] = p[key];
      }
    }
    out.v = posInt(p.v, currentPlayerV());
    out.game = Math.max(1, posInt(p.game, 1));
    out.world = {
      seed: posInt(p.world?.seed, 0) >>> 0,
      briefHash: posInt(p.world?.briefHash, 0) >>> 0,
      mintStamp: posInt(p.world?.mintStamp, 0) >>> 0,
    };
    // The INTERIM mark (plan §Q3a): a save flushed while standing in the
    // throwaway pre-brief world has all-zero stamps, which is also exactly what
    // a pre-S5 save looks like — and `unstamped` adopts one of those WHOLESALE.
    // The key says which is which. Emitted only when set, so nothing else moves.
    if (p.world?.interim) out.world.interim = 1;
    out.flushedDay = posInt(p.flushedDay, 0);
    out.pouch = {
      money: posInt(p.pouch?.money, 0),
      // Sorted by (t,k): the bag is a SET keyed that way, so insertion order is
      // an accident of play and would make two identical inventories serialize
      // to different bytes.
      items: (Array.isArray(p.pouch?.items) ? p.pouch.items : [])
        .filter((it) => it && typeof it === "object" && str(it.t))
        .map((it) => ({ t: str(it.t), q: posInt(it.q, 0), k: str(it.k) }))
        .sort((a, b) => (a.t === b.t ? (a.k < b.k ? -1 : a.k > b.k ? 1 : 0) : a.t < b.t ? -1 : 1)),
    };
    out.skills = {
      verbs: sortedMap(
        ownEntries(p.skills?.verbs).map(([verb, row]) => [
          verb,
          { l: Math.max(1, posInt(row?.l, 1)), x: posInt(row?.x, 0) },
        ]),
      ),
      equipped: sortedMap(
        ownEntries(p.skills?.equipped).map(([verb, slots]) => [
          verb,
          sortedMap(
            ownEntries(slots)
              .filter(([, pair]) => Array.isArray(pair) && str(pair[0]))
              .map(([slot, pair]) => [slot, [str(pair[0]), str(pair[1])]]),
          ),
        ]),
      ),
    };
    out.quests_done_board = sortedMap(ownEntries(p.quests_done_board).map(([id, n]) => [id, posInt(n, 0)]));
    out.rel = sortedMap(
      ownEntries(p.rel).map(([zoneId, rows]) => [
        zoneId,
        sortedMap(
          ownEntries(rows).map(([name, row]) => {
            const cell = { d: PF.clamp(posInt(row?.d, 0), 0, 3), t: posInt(row?.t, 0) };
            // `h` and `s` are emitted ONLY when set: a hostile flag on every row
            // and an empty string on every row would be pure size for nothing.
            if (row?.h) cell.h = 1;
            const line = clip(row?.s, CAPS.lineChars);
            if (line) {
              cell.s = line;
              // …and `a` is the line's RECENCY, which has to survive the wire or
              // "the oldest line is evicted" degrades after a reload into "the
              // alphabetically-first restored row's line is evicted" — the
              // eviction inverts and drops the NEWEST. Emitted only alongside an
              // `s`, so a block with no lines gains no bytes, and only when it is
              // actually SET: a parent build wrote s-lines with no mark at all,
              // and a flat `"a":0` on every one of them would move bytes this
              // change never declared. Absent reads back as 0 through posInt,
              // which is exactly what the ordering already treats it as.
              const seq = posInt(row?.a, 0);
              if (seq) cell.a = seq;
            }
            return [name, cell];
          }),
        ),
      ]),
    );
    out.quests = {
      done_pack: sortedMap(ownEntries(p.quests?.done_pack).map(([id, n]) => [id, posInt(n, 0)])),
      active: (Array.isArray(p.quests?.active) ? p.quests.active : [])
        .filter((q) => q && typeof q === "object" && str(q.id))
        .map((q) => ({
          id: str(q.id),
          g: str(q.g),
          verb: str(q.verb),
          target: str(q.target),
          n: posInt(q.n, 0),
          have: posInt(q.have, 0),
          r: { money: posInt(q.r?.money, 0), xp: posInt(q.r?.xp, 0) },
          day: posInt(q.day, 0),
        }))
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    };
    // The optional shop-depletion seam. Absent unless something bought
    // something — an empty object every save would be four bytes of nothing.
    const bought = sortedMap(
      ownEntries(p.bought).map(([shop, rows]) => [
        shop,
        sortedMap(ownEntries(rows).map(([t, n]) => [t, posInt(n, 0)])),
      ]),
    );
    if (Object.keys(bought).length) out.bought = bought;
    out.ledger = {
      // CHRONOLOGICAL, never sorted: the buffer is a transcript and its order is
      // its meaning. A JSON round-trip preserves array order, so it is stable.
      lines: (Array.isArray(p.ledger?.lines) ? p.ledger.lines : [])
        .filter((line) => Array.isArray(line) && line.length >= 2)
        .map((line) => {
          const out = [posInt(line[0], 0), clip(line[1], CAPS.ledgerChars)];
          // A STUB carries the number of lines it stands for as an optional
          // THIRD element, so re-compacting an already-stubbed day preserves
          // the count instead of collapsing "12 things" to "1 thing" on the
          // next append. Plain lines stay two-element and gain no bytes.
          const n = posInt(line[2], 0);
          if (n > 0) out.push(n);
          return out;
        }),
    };
    // THE NOTICE BAND, which is a subtree and not a line class (plan §2.5,
    // round-5 BLOCKER-1). A notice explains something that happened TO the save
    // rather than something the player did in the world, so it is not part of
    // the day transcript and does not belong in a day group: rows are
    // `[day, text]` untold and `[day, text, 1]` told, and the TOLD FLAG is what
    // the wrap-up tell reads instead of the day gate the lines answer to.
    //
    // EMITTED ONLY WHEN NON-EMPTY, which is `bought`'s precedent one level up:
    // every save in the wild would otherwise gain four bytes of empty array for
    // a band it has nothing to put in.
    const notices = evictNotices(
      (Array.isArray(p.ledger?.notices) ? p.ledger.notices : [])
        .filter((row) => Array.isArray(row) && row.length >= 2)
        .map((row) => {
          const out = [posInt(row[0], 0), clip(row[1], CAPS.ledgerChars)];
          if (row[2]) out.push(1);
          return out;
        })
        // A ROW WITH NOTHING TO SAY IS NOT A ROW. `notice()` already refuses text
        // that clips to nothing, so no row this build writes reaches here empty;
        // a hostile save carrying `[3, "   "]` or a number where the sentence goes
        // used to survive as `[3, ""]` — bytes on the wire, a slot against the
        // cap, and a blank line in the panel no writer could account for. Dropped
        // at the one place the wire is built, which is where `lines`' own
        // shape-filter lives.
        .filter((row) => row[1]),
    );
    if (notices.length) out.ledger.notices = notices;
    out.found = {
      zones: (Array.isArray(p.found?.zones) ? p.found.zones : [])
        .filter((z) => z && typeof z === "object" && str(z.p))
        .map((z) => ({
          p: str(z.p),
          e: posInt(z.e, 0),
          d: posInt(z.d, 0),
          day: posInt(z.day, 0),
          seen: z.seen === true,
        }))
        .sort((a, b) => {
          const ka = `${a.p}|${a.e}|${a.d}`;
          const kb = `${b.p}|${b.e}|${b.d}`;
          return ka < kb ? -1 : ka > kb ? 1 : 0;
        }),
    };
    // A sealed anchor ("z3") or { minted: true } — never a bare h{n} (§2).
    out.home =
      typeof p.home === "string" && p.home ? p.home : p.home && p.home.minted === true ? { minted: true } : null;
    return out;
  },

  // ── Parse / migrate (plan §Q1) ─────────────────────────────────────────────

  /** Read a saved `player` block. NEVER throws: every failure boots defaults and
   *  says why, because a save path that can brick the surface is worse than one
   *  that loses a block. Returns
   *    { player, source, quarantine: null | { slot, entry } }
   *  where `source` is "saved" | "defaults" and the caller owns the bag write. */
  parse(raw) {
    const fresh = () => this.defaultPlayer();
    if (raw === undefined || raw === null) return { player: fresh(), source: "defaults", quarantine: null };
    if (typeof raw !== "object" || Array.isArray(raw)) {
      // Not even the right kind of thing. There is no corrupt slot (plan §Q1a:
      // unimplementable client-side), and a scalar carries nothing to recover.
      return { player: fresh(), source: "defaults", quarantine: null };
    }
    const v = raw.v;
    if (!isFiniteInt(v) || v < 1) {
      // A block that will not declare its version cannot be migrated and cannot
      // be trusted. Parked in `migration` rather than dropped: a later build
      // whose reader is looser is exactly the thing that could still read it.
      return {
        player: fresh(),
        source: "defaults",
        quarantine: { slot: "migration", entry: { reason: "shape", fromV: null, block: raw } },
      };
    }
    const current = currentPlayerV();
    if (v > current) {
      // TOO NEW. Never parsed, never overwritten — quarantined VERBATIM so the
      // build that wrote it can take it back (plan §Q1). `adoptable` is written
      // at creation and is what a later build looks for.
      return {
        player: fresh(),
        source: "defaults",
        quarantine: { slot: "version", entry: { reason: "too-new", fromV: v, adoptable: true, block: raw } },
      };
    }
    let block = raw;
    try {
      for (let step = v; step < current; step++) block = PLAYER_MIGRATIONS[step - 1](block);
    } catch (err) {
      // A THROWING step keeps its input, not its half-migrated output: the
      // input is the thing a fixed step will be run against.
      return {
        player: fresh(),
        source: "defaults",
        quarantine: {
          slot: "migration",
          entry: {
            reason: "throw",
            fromV: v,
            message: err && err.message ? String(err.message) : String(err),
            block: raw,
          },
        },
      };
    }
    if (!block || typeof block !== "object" || Array.isArray(block)) {
      return {
        player: fresh(),
        source: "defaults",
        quarantine: { slot: "migration", entry: { reason: "shape", fromV: v, block: raw } },
      };
    }
    // Shape-validate by NORMALIZING: serialize() already coerces every field to
    // its declared shape and drops what will not coerce, so one pass through it
    // is the validator AND guarantees the parsed block round-trips byte-stably.
    const player = this.serialize(block);
    player.v = current;
    // serialize() omits an empty `bought`; the live block wants the null seam
    // back so a mutator has somewhere to write.
    if (player.bought === undefined) player.bought = null;
    return { player, source: "saved", quarantine: null };
  },

  // ── Stamps, severance, restoration (plan §Q3a) ─────────────────────────────

  /** Are the stamps comparable at all? Never against an absent-or-EXPECTED
   *  brief: an interim world is a throwaway the sealed brief will replace, and
   *  severing against it would quarantine a save for a world that never was. */
  stampsEvaluable(world, brief, briefExpected) {
    if (!world || world.interim) return false;
    if (!brief && briefExpected) return false;
    return true;
  },

  /** Compare, sever, and hand back what to quarantine. Mutates `player` in
   *  place (it is the freshly-parsed block, not yet anybody's live state).
   *  Returns { severed: null | { slot:"stamp", entry }, notices: string[] }. */
  applyStamps(player, world, brief, briefExpected) {
    const now = this.stampsFor(world, brief);
    const notices = [];
    if (!this.stampsEvaluable(world, brief, briefExpected)) {
      // Nothing to compare against — but an INTERIM world still leaves a mark.
      // A save flushed while standing in the throwaway pre-brief world is
      // all-zero, and all-zero is also what a pre-S5 save looks like, so the
      // next boot's `unstamped` branch would adopt it WHOLESALE into the
      // compiled world: relationship rows, quests and discoveries belonging to
      // people the sealed brief never named. Marked, the same boot takes the
      // severance path instead, which is the transplant's split by another
      // name. Only a block that is bare or already interim is marked; a block
      // carrying real stamps is evidence about a real world and keeps them.
      const held = player.world;
      const bare = !held || held.interim === 1 || (!held.seed && !held.briefHash && !held.mintStamp);
      if (world && world.interim && bare) {
        player.world = { seed: (world.seed ?? 0) >>> 0, briefHash: 0, mintStamp: 0, interim: 1 };
      }
      return { severed: null, notices, evaluated: false };
    }
    const was = player.world;
    // A block with no stamps of its own (a pre-S5 save, or a fresh default) has
    // nothing to disagree with: stamp it and move on. An INTERIM-marked block is
    // not one of those — it is a save that knows which world it came from, and
    // that world is not this one.
    const unstamped = !was || (!was.interim && !was.seed && !was.briefHash && !was.mintStamp);
    if (unstamped) {
      player.world = { ...now };
      return { severed: null, notices, evaluated: true };
    }
    const briefMoved = was.briefHash !== now.briefHash || was.seed !== now.seed;
    const mintMoved = was.mintStamp !== now.mintStamp;
    if (!briefMoved && !mintMoved) {
      player.world = { ...now };
      return { severed: null, notices, evaluated: true };
    }
    const entry = {
      reason: briefMoved ? "brief" : "mint",
      fromV: player.v,
      stamps: { ...was },
      fields: {},
    };
    if (briefMoved) {
      // EVERY world-bound field goes. The world this save was played in is not
      // the world about to be compiled, and a relationship row, a quest, a
      // discovery or a ledger line means nothing across that line.
      entry.fields.rel = player.rel;
      entry.fields.questsActive = player.quests.active;
      entry.fields.questsDonePack = player.quests.done_pack;
      entry.fields.found = player.found.zones;
      entry.fields.home = player.home;
      entry.fields.ledgerLines = player.ledger.lines;
      entry.fields.flushedDayWas = player.flushedDay;
      // `bought` is world-BOUND (plan §2 puts it under the world-bound banner):
      // it counts what a NAMED shop's stock has lost, and both the shop and its
      // stock table are compiled from the brief. Carried across a brief change
      // it depletes a stranger's shelves.
      entry.fields.bought = player.bought;
      player.rel = {};
      player.quests = { done_pack: {}, active: [] };
      player.found = { zones: [] };
      player.home = null;
      player.bought = null;
      const lines = player.ledger.lines;
      // THE BAND GOES WITH THE TRANSCRIPT, AND IT IS A REAL LOSS — accepted, and
      // stated rather than dressed up as the status quo (plan §5). A notice used
      // to BE a ledger line, so a brief severance always took the pending ones;
      // but a severed line was PARKED in the quarantine entry above and came home
      // with the rest of the world-bound set, and the band is not parked and
      // cannot be. So the format change that made a notice re-readable also made
      // this loss permanent: what a brief severance drops here, nothing restores.
      // What survives the window is the notice this severance is about to write,
      // which 60-save appends after the strip. (`intro.ledgerOwed` is not touched
      // and correctly is not: it is world-unbound, and the days it owes are days
      // the player lived whatever world they lived them in.)
      player.ledger = { lines: [] };
      // COUPLED, and only when lines were ACTUALLY severed (plan §0): an empty
      // buffer must leave the gate exactly where it was, or a save with nothing
      // to lose still loses its day boundary.
      if (lines.length) {
        const minDay = lines.reduce((low, line) => Math.min(low, posInt(line[0], 0)), Infinity);
        player.flushedDay = Math.max(0, Math.min(posInt(player.flushedDay, 0), minDay - 1));
      }
      entry.fields.flushedDay = player.flushedDay;
      notices.push("Some of what you had done here belonged to another world. It has been set aside.");
    } else {
      // MINT-ONLY: the brief is the same, so everybody the brief NAMED is the
      // same person and their rows are safe. Everybody else was MINTED, and the
      // mint just changed under them.
      //
      // The test is the COMPLEMENT of the brief's named cast, not membership of
      // the new world's `minted` list, and the difference is the whole point: a
      // resident the OLD mint produced and the new one does not is exactly the
      // row that has to go, and she is in neither list. The `minted` list only
      // stands in when there is no brief to name anybody — a legacy world, whose
      // mint is empty and whose stamp moves only when MINT_V does.
      const named = new Set(
        brief && Array.isArray(brief.cast) ? brief.cast.map((member) => str(member?.name)).filter(Boolean) : null,
      );
      const isMinted = (name) =>
        brief && Array.isArray(brief.cast)
          ? !named.has(name)
          : (Array.isArray(world.minted) ? world.minted : []).includes(name);
      const minted = { has: isMinted };
      const severedRel = {};
      let touched = false;
      for (const [zoneId, rows] of ownEntries(player.rel)) {
        const keep = {};
        const gone = {};
        for (const [name, row] of ownEntries(rows)) {
          if (minted.has(name)) gone[name] = row;
          else keep[name] = row;
        }
        if (Object.keys(gone).length) {
          severedRel[zoneId] = gone;
          touched = true;
        }
        if (Object.keys(keep).length) player.rel[zoneId] = keep;
        else delete player.rel[zoneId];
      }
      const giverName = (g) => {
        const text = str(g);
        const bar = text.indexOf("|");
        return bar >= 0 ? text.slice(bar + 1) : text;
      };
      const severedQuests = player.quests.active.filter((q) => minted.has(giverName(q.g)));
      if (severedQuests.length) {
        player.quests.active = player.quests.active.filter((q) => !minted.has(giverName(q.g)));
        touched = true;
      }
      if (!touched) {
        // The mint moved but nothing of the player's hung off it. Re-stamp and
        // quarantine nothing — an empty entry would only cost a slot.
        player.world = { ...now };
        return { severed: null, notices, evaluated: true };
      }
      entry.fields.rel = severedRel;
      entry.fields.questsActive = severedQuests;
      notices.push("Some of the people you knew here are not the people who live here now.");
    }
    player.world = { ...now };
    return { severed: { slot: "stamp", entry }, notices, evaluated: true };
  },

  /** The other direction: a stamp slot whose stamps match the world we just
   *  built is a save coming HOME. Restoration DISCARDS whatever world-bound
   *  fields were written during the quarantine window (plan §Q3a) — the point
   *  of the window is that everything in it belonged to the wrong world. */
  restoreStamped(player, entry, world, brief) {
    if (!entry || typeof entry !== "object") return false;
    const now = this.stampsFor(world, brief);
    const was = entry.stamps || {};
    if (was.seed !== now.seed || was.briefHash !== now.briefHash || was.mintStamp !== now.mintStamp) return false;
    const fields = entry.fields || {};
    // How many of the active quests were LIVE before the merge: the dedupe below
    // has to prefer the row the player is currently playing over the parked copy
    // of the same quest.
    const liveQuests = Array.isArray(player.quests?.active) ? player.quests.active.length : 0;
    if (entry.reason === "mint") {
      for (const [zoneId, rows] of ownEntries(fields.rel)) {
        const target = ownEntries(player.rel[zoneId]).length ? player.rel[zoneId] : {};
        for (const [name, row] of ownEntries(rows)) target[name] = row;
        player.rel[zoneId] = target;
      }
      if (Array.isArray(fields.questsActive)) player.quests.active = [...player.quests.active, ...fields.questsActive];
    } else {
      if (fields.rel !== undefined) player.rel = fields.rel && typeof fields.rel === "object" ? fields.rel : {};
      if (Array.isArray(fields.questsActive)) player.quests.active = fields.questsActive;
      if (fields.questsDonePack !== undefined)
        player.quests.done_pack =
          fields.questsDonePack && typeof fields.questsDonePack === "object" ? fields.questsDonePack : {};
      if (Array.isArray(fields.found)) player.found = { zones: fields.found };
      if (fields.home !== undefined) player.home = fields.home;
      if (Array.isArray(fields.ledgerLines)) {
        // THE BAND IS NOT THE TRANSCRIPT, and a whole-object reassignment is how
        // that gets forgotten. `ledgerLines` is the only thing the entry parked —
        // the band was never quarantined and never could be, because it rode in
        // on the LIVE block's own disk state and its rows are sentences nobody has
        // been told yet. Reassigning `ledger` wholesale takes them with it, while
        // the mint branch above (which touches the ledger not at all) keeps them,
        // and two branches of one restore cannot disagree about that.
        const band = Array.isArray(player.ledger?.notices) ? player.ledger.notices : null;
        player.ledger = { lines: fields.ledgerLines };
        if (band && band.length) player.ledger.notices = band;
      }
      if (fields.flushedDay !== undefined) player.flushedDay = posInt(fields.flushedDay, player.flushedDay);
      // `bought` was severed with the rest of the world-bound set, so it comes
      // home with them.
      if (fields.bought !== undefined)
        player.bought = fields.bought && typeof fields.bought === "object" ? fields.bought : null;
    }
    // THE GUARD, re-applied rather than trusted. A restored line at or below the
    // gate would never be told: the flush skips everything the gate covers.
    const lines = Array.isArray(player.ledger?.lines) ? player.ledger.lines : [];
    if (lines.length) {
      const minDay = lines.reduce((low, line) => Math.min(low, posInt(line[0], 0)), Infinity);
      player.flushedDay = Math.max(0, Math.min(posInt(player.flushedDay, 0), minDay - 1));
    }
    // EVERY OTHER INVARIANT, re-applied for the same reason. Restoration is the
    // one path that puts state back WITHOUT going through a mutator, so the caps
    // and the dedupes the mutators enforce have to be re-run here or the block
    // lands at twice the row cap with two copies of the same quest id in it.
    this._enforceCaps(player, entry.reason === "mint" ? liveQuests : 0);
    // Normalize back through the serializer: the entry came off the wire and its
    // rows have to satisfy the same shape contract everything else does.
    const normalized = this.serialize(player);
    normalized.v = player.v;
    if (normalized.bought === undefined) normalized.bought = null;
    return normalized;
  },

  // ── Quest-dangling repair (plan §Q5) ───────────────────────────────────────

  /** Drop active quests whose giver is not in this world. GATED, because the
   *  four ways to be wrong all look the same from here: an interim world has
   *  not been compiled yet, an unevaluated stamp means we do not know whether
   *  this is even the right world, a world with no NPCs at all cannot vouch for
   *  anyone, and EVERY giver dangling says the world is wrong rather than the
   *  quests. Returns { dropped, notices }. */
  repairQuests(player, world, evaluated) {
    const notices = [];
    const active = Array.isArray(player.quests?.active) ? player.quests.active : [];
    if (!active.length || !world || world.interim || !evaluated) return { dropped: [], notices };
    const known = new Set();
    for (const zoneId of Object.keys(world.zones ?? {})) {
      for (const npc of world.zones[zoneId].npcs ?? []) if (npc && npc.name) known.add(npc.name);
    }
    if (!known.size) return { dropped: [], notices };
    const giverName = (g) => {
      const text = str(g);
      const bar = text.indexOf("|");
      return bar >= 0 ? text.slice(bar + 1) : text;
    };
    const dangling = active.filter((q) => !known.has(giverName(q.g)));
    if (!dangling.length) return { dropped: [], notices };
    if (dangling.length === active.length) {
      // ALL of them. That is a statement about the world, not the quests.
      return { dropped: [], notices };
    }
    player.quests.active = active.filter((q) => known.has(giverName(q.g)));
    // A LOSS, and the sentence has to say so. The rows above are PARKED — set
    // aside, recoverable, and their copy says as much — while this quest is
    // dropped and nothing brings it back. "No one left to hand it back to" is
    // true and stops one clause short of the outcome, which is the difference
    // between a notice and an explanation now that the band is re-readable
    // (plan §2.5, M3's writer-site kind copy).
    notices.push("A task you had taken on has no one left to hand it back to, so you have let it go.");
    return { dropped: dangling, notices };
  },

  // ── The brief-arrival transplant (plan §Q5, one release of compat) ─────────

  /** A chat created BEFORE the loading gate boots on a throwaway world and
   *  rebuilds when its generated brief seals. World-free fields cross; every
   *  world-bound field goes to the stamp slot with the stamps it belonged to;
   *  the block is re-stamped for the world that just arrived.
   *  Returns { player, severed }. */
  transplant(oldPlayer, world, brief) {
    const source = oldPlayer && typeof oldPlayer === "object" ? oldPlayer : this.defaultPlayer();
    const next = this.defaultPlayer();
    next.game = Math.max(1, posInt(source.game, 1));
    next.pouch = source.pouch ?? next.pouch;
    next.skills = source.skills ?? next.skills;
    next.quests_done_board = source.quests_done_board ?? next.quests_done_board;
    // `bought` does NOT cross: it is world-bound (plan §2), and the shops it
    // counts against were compiled from a brief that did not exist yet. It goes
    // to the stamp slot with the rest of the world-bound set below.
    // A newer build's unknown player-level keys DO cross, exactly as the
    // envelope's carry does across this same seam (60-save maybeGenerateBrief):
    // they are not this build's play state to reinterpret or to throw away.
    for (const key of Object.keys(source)) {
      if (PLAYER_KEYS.has(key) || key === "__proto__") continue;
      if (source[key] === undefined) continue;
      next[key] = source[key];
    }
    const wasStamps =
      source.world && typeof source.world === "object" ? { ...source.world } : { seed: 0, briefHash: 0, mintStamp: 0 };
    const lines = Array.isArray(source.ledger?.lines) ? source.ledger.lines : [];
    let flushedDay = posInt(source.flushedDay, 0);
    if (lines.length) {
      const minDay = lines.reduce((low, line) => Math.min(low, posInt(line[0], 0)), Infinity);
      flushedDay = Math.max(0, Math.min(flushedDay, minDay - 1));
    }
    next.flushedDay = flushedDay;
    const hadWorldBound =
      ownEntries(source.rel).length ||
      (Array.isArray(source.quests?.active) && source.quests.active.length) ||
      ownEntries(source.quests?.done_pack).length ||
      (Array.isArray(source.found?.zones) && source.found.zones.length) ||
      ownEntries(source.bought).length ||
      source.home != null ||
      lines.length;
    const severed = hadWorldBound
      ? {
          slot: "stamp",
          entry: {
            reason: "brief",
            fromV: posInt(source.v, currentPlayerV()),
            stamps: wasStamps,
            fields: {
              rel: source.rel ?? {},
              questsActive: source.quests?.active ?? [],
              questsDonePack: source.quests?.done_pack ?? {},
              found: source.found?.zones ?? [],
              bought: source.bought ?? null,
              home: source.home ?? null,
              ledgerLines: lines,
              flushedDayWas: posInt(source.flushedDay, 0),
              flushedDay,
            },
          },
        }
      : null;
    next.world = this.stampsFor(world, brief);
    // The world-free half crossed without a mutator too, so it gets the same
    // re-enforcement restoreStamped gets.
    this._enforceCaps(next, 0);
    const normalized = this.serialize(next);
    normalized.v = currentPlayerV();
    if (normalized.bought === undefined) normalized.bought = null;
    return { player: normalized, severed };
  },

  // ── Re-entry invariants (plan §3, §4) ──────────────────────────────────────

  /** Dedupe active quests by id. `liveCount` is how many of the leading rows
   *  came from the LIVE block: the row the player is playing wins outright, and
   *  two parked copies of one quest fall back to whichever got further. */
  _dedupeActive(active, liveCount) {
    const held = new Map();
    active.forEach((q, index) => {
      const id = str(q?.id);
      if (!id) return;
      const live = index < liveCount;
      const prior = held.get(id);
      if (!prior) {
        held.set(id, { q, live });
        return;
      }
      if (prior.live) return;
      if (live || posInt(q?.have, 0) > posInt(prior.q?.have, 0)) held.set(id, { q, live });
    });
    return [...held.values()].map((row) => row.q);
  },

  /** Every cap and every dedupe the MUTATORS enforce, re-applied to a block that
   *  did not come through one. Restoration and the transplant both put whole
   *  fields back by assignment, so this is the only thing between a quarantine
   *  entry and a block at twice the row cap with duplicate quest ids in it —
   *  and it runs BEFORE the normalizing serialize, so what it trims never
   *  reaches the wire. */
  _enforceCaps(p, liveQuests) {
    if (!p || typeof p !== "object") return p;
    // Pouch. Deterministic by (t,k) so the survivors do not depend on merge
    // order; serialize() sorts the same way.
    if (Array.isArray(p.pouch?.items) && p.pouch.items.length > CAPS.items) {
      p.pouch.items = p.pouch.items
        .slice()
        .sort((a, b) =>
          str(a?.t) === str(b?.t)
            ? str(a?.k) < str(b?.k)
              ? -1
              : str(a?.k) > str(b?.k)
                ? 1
                : 0
            : str(a?.t) < str(b?.t)
              ? -1
              : 1,
        )
        .slice(0, CAPS.items);
    }
    // Skills: the level ladder has a ceiling and xp is zeroed at it.
    for (const [, row] of ownEntries(p.skills?.verbs)) {
      if (row && typeof row === "object" && posInt(row.l, 1) >= CAPS.skillLevel) {
        row.l = CAPS.skillLevel;
        row.x = 0;
      }
    }
    // Completion counters: the LEAST-earned one is the cheaper loss, exactly as
    // quest() decides it at the live cap.
    this._trimCounters(p.quests_done_board, CAPS.boardDone);
    if (p.quests && typeof p.quests === "object") this._trimCounters(p.quests.done_pack, CAPS.packDone);
    this._trimNested(p.bought, CAPS.bought);
    // Active quests: dedupe first (a merge is where duplicate ids come from),
    // then the cap.
    if (p.quests && Array.isArray(p.quests.active)) {
      p.quests.active = this._dedupeActive(p.quests.active, posInt(liveQuests, 0));
      if (p.quests.active.length > CAPS.activeQuests) p.quests.active = p.quests.active.slice(0, CAPS.activeQuests);
    }
    // Relationships: the row cap evicts STRANGERS, the line cap evicts lines.
    // The loop stops when there is no stranger left rather than eating rows the
    // player built something with — the same trade bump() makes.
    let guard = CAPS.relRows * 2 + 8;
    while (this._relRowCount(p) > CAPS.relRows && guard-- > 0 && this._evictStranger(p));
    // …and then the cap holds WHATEVER is left (round-2 fix). The stranger pass
    // can run out of strangers with the block still over: hostile rows are not
    // strangers, so a hostile-on-hostile restore arrives at twice the cap and
    // the pass has nothing it is willing to take. A cap that a restore can walk
    // through is not a cap.
    this._evictToRowCap(p);
    this._evictLines(p);
    // Discoveries: the OLDEST by day goes, which is what the cap has always
    // claimed and what the array order stopped meaning after a reload.
    if (Array.isArray(p.found?.zones) && p.found.zones.length > CAPS.found) {
      p.found.zones = p.found.zones
        .map((zone, index) => ({ zone, index }))
        .sort((a, b) => posInt(b.zone?.day, 0) - posInt(a.zone?.day, 0) || a.index - b.index)
        .slice(0, CAPS.found)
        .sort((a, b) => a.index - b.index)
        .map((row) => row.zone);
    }
    if (p.ledger && Array.isArray(p.ledger.lines)) this._compactLedger(p);
    // The band answers to its own cap here too — BELT ONLY, and the reason is
    // worth writing down because the line looks like it is catching something.
    // Nothing can arrive over the cap: no quarantine entry carries notices (a
    // severance parks `ledgerLines` and the band is not parked at all — see
    // applyStamps), so there is no second band anywhere to concatenate a first
    // one with, and every path that can put a row in one — `notice()`,
    // `serialize()`, and `parse()` through it — has already run `evictNotices`.
    // It stays because the cap is applied wherever the array is normalized and
    // this is one of those places, and because the day an entry DOES bring a band
    // home is the day this line is the only thing standing between two capped
    // bands and one that is twice the cap.
    if (p.ledger && Array.isArray(p.ledger.notices)) p.ledger.notices = evictNotices(p.ledger.notices);
    return p;
  },

  /** Trim a `{key: count}` map to `cap`, dropping the least-earned keys first
   *  (sorted-key tiebreak, so two equal counts resolve the same way twice). */
  _trimCounters(map, cap) {
    const rows = ownEntries(map);
    if (rows.length <= cap) return;
    const doomed = rows
      .slice()
      .sort((a, b) => posInt(a[1], 0) - posInt(b[1], 0) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .slice(0, rows.length - cap);
    for (const [key] of doomed) delete map[key];
  },

  /** …and the same for `bought`, which is a map OF maps: the cap counts leaf
   *  rows, and a shop left with nothing in it goes with its last row. */
  _trimNested(map, cap) {
    const leaves = [];
    for (const [shop, rows] of ownEntries(map)) for (const [t, n] of ownEntries(rows)) leaves.push({ shop, t, n });
    if (leaves.length <= cap) return;
    const doomed = leaves
      .slice()
      .sort(
        (a, b) =>
          posInt(a.n, 0) - posInt(b.n, 0) ||
          (a.shop < b.shop ? -1 : a.shop > b.shop ? 1 : 0) ||
          (a.t < b.t ? -1 : a.t > b.t ? 1 : 0),
      )
      .slice(0, leaves.length - cap);
    for (const leaf of doomed) {
      delete map[leaf.shop][leaf.t];
      if (!ownEntries(map[leaf.shop]).length) delete map[leaf.shop];
    }
  },

  /** Own-property bucket access, shared by every map-write site. Two hazards in
   *  one helper: JSON.parse hands "__proto__" back as an own property and
   *  assigning it onto a plain object sets the PROTOTYPE instead of a key, and a
   *  bare `map[key]` READ walks the prototype chain — `map.constructor` is a
   *  function, `map.toString` is a function, and either one read as "the row
   *  that is already there" corrupts the block or bricks the next Sim build.
   *  Returns null for a key no bucket may exist at. */
  _ownRead(map, key) {
    if (!map || typeof map !== "object" || key === "__proto__") return undefined;
    return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;
  },

  /** Read-or-create an object bucket at `key`. Null when the key is one no
   *  bucket may exist at, so every caller has one refusal to handle. */
  _bucket(map, key) {
    if (!map || typeof map !== "object" || key === "__proto__") return null;
    const held = this._ownRead(map, key);
    if (held && typeof held === "object" && !Array.isArray(held)) return held;
    const fresh = {};
    map[key] = fresh;
    return fresh;
  },

  // ── Resolve-at-read (plan §2.1) ────────────────────────────────────────────
  // A SAVED STRING IS EVIDENCE, NEVER A VALUE. Each of these takes what the
  // block happens to hold and answers with a number inside a stated range, so a
  // row written by a hostile hand, an older build or a newer one can move the
  // answer but can never leave the range. That is what makes them safe as
  // determinism inputs: the fishing roll is seeded from the RESOLVED numbers, so
  // two clients that disagree about what "legendary" means still roll the same
  // fish out of the same water on the same minute.
  //
  // Pure, and deliberately so — they take values rather than the core, so the
  // hash and the display can resolve the same row without either one reaching
  // for live state the other cannot see.

  /** A graded tool's tier: its place on the QUALITY ladder, with everything the
   *  ladder does not name clamping to 0. A `k` that is off the ladder — a newer
   *  build's "legendary", a bait slug, an empty string, a number — is CRUDE.
   *  Never a throw, and never a bonus. */
  resolvedToolTier(k) {
    const at = QUALITY.indexOf(typeof k === "string" ? k : "");
    return at < 0 ? 0 : at;
  },

  /** A modifier's tier, and it reads PRESENCE rather than grade. Bait `k` are
   *  semantic slugs, so an index resolver would map a slotted bait and an EMPTY
   *  slot to the same 0 and make the modifier inert — which is the whole reason
   *  this one does not read QUALITY at all. 1 iff the slot holds a pair AND the
   *  pouch still has a stack behind it; 0 for everything else.
   *
   *  `stack` is the pouch row the caller looked that pair up by, or a bare
   *  count for a caller that already has one. A ROW IS CHECKED TO BE THE RIGHT
   *  ROW: "backed by" is the claim being made, and a stack of something else
   *  backs nothing.
   *
   *  What it does NOT check is the pair's TYPE. The mod slot is filled by the
   *  verb's own per-session act and by nothing else, so a pair in it is a pair
   *  the verb put there; a hostile save that slots something odd and carries a
   *  real stack for it has spent a real stack, which is the thing the multiplier
   *  is paid for. Graded modifiers are L2 content (§5) and arrive as a second
   *  tier here, never as a QUALITY read. */
  resolvedModTier(slot, stack) {
    if (!Array.isArray(slot) || !str(slot[0])) return 0;
    if (typeof stack === "number") return isFiniteInt(stack) && stack > 0 ? 1 : 0;
    if (!stack || typeof stack !== "object") return 0;
    if (str(stack.t) !== str(slot[0]) || str(stack.k) !== str(slot[1])) return 0;
    return posInt(stack.q, 0) > 0 ? 1 : 0;
  },

  /** A DAY ORDINAL off untrusted state: a whole number at or above zero, and
   *  zero for everything else. Small, and it exists because three files needed
   *  the same read and a near-copy in each of them is how two of them come to
   *  disagree — the restore that carries `intro.ledgerOwed` across a reload
   *  (60-save), the sleep that stages it, and the wrap-up that composes against
   *  it and the day gate (30-sim). Zero is the safe answer everywhere: it owes
   *  nothing, tells nothing, and cannot lift a gate.
   *
   *  Beside the resolvers because it is one of them — a saved number is evidence
   *  and not a value, and a `ledgerOwed` of "12", -3 or 1e9 has to come back as
   *  a day this build can reason about rather than as a fact it inherited. */
  resolvedDay(value) {
    return posInt(value, 0);
  },

  /** A verb's level, clamped to the ladder the block can actually hold. `row` is
   *  a `skills.verbs` entry or a bare number, and either one comes off save JSON
   *  where `l` can be 0, 9,000, or the string "12". The floor is 1 rather than 0
   *  because level 1 is where a verb starts: a player who has never fished still
   *  rolls, they just roll at the bottom of the curve. */
  resolvedLevel(row) {
    const l = typeof row === "number" ? row : row?.l;
    return PF.clamp(posInt(l, 1), 1, CAPS.skillLevel);
  },

  // ── Mutation API (plan §3) ─────────────────────────────────────────────────
  // Every mutator RE-RESOLVES core.sim (never a captured sim — a chat switch
  // reassigns it under any caller holding one), is generation-FENCED on the
  // optional trailing `gen`, and is SELF-DIRTYING: markDirty lives inside the
  // mutator so a consumer cannot forget it. Consumers land in slice 6.

  /** The live block, minted on demand. Returns null when the fence says this
   *  call belongs to a chat we already left. */
  _live(core, gen) {
    if (!core || typeof core !== "object") return null;
    if (gen !== undefined && gen !== (PF.save?._gen ?? 0)) return null;
    // THE LOADING GATE (plan §Q3b): a world nobody has entered has no player in
    // it. Refused HERE rather than at nine call sites, which is what makes "no
    // mutator is reachable while the gate holds" true of every verb at once —
    // including the ones written after the gate. Each verb's documented refusal
    // value is what a caller gets, so nothing has to learn a new failure shape.
    if (PF.save?.gateHolds?.(core)) return null;
    const sim = core.sim;
    if (!sim) return null;
    if (!sim.player || typeof sim.player !== "object" || Array.isArray(sim.player)) sim.player = this.defaultPlayer();
    return sim.player;
  },

  /** Read-only accessor for consumers that only want to render. */
  get(core) {
    return core && core.sim && core.sim.player ? core.sim.player : null;
  },

  _touch(core) {
    if (core.sim) core.sim.dirty = true;
    PF.save?.markDirty?.(core);
  },

  _itemKey(item) {
    if (typeof item === "string") return { t: item, k: "" };
    return { t: str(item?.t), k: str(item?.k) };
  },

  /** Add to the pouch. Merges by (t,k) — the bag has no uuids by design. */
  grant(core, item, qty, gen) {
    const p = this._live(core, gen);
    if (!p) return 0;
    const { t, k } = this._itemKey(item);
    if (!t) return 0;
    // A GRADED type's `k` has to be a rung. Refused rather than coerced down to
    // "crude": coercion would still mint the row, the pouch would carry a
    // quality nothing can name, and every resolver from then on would read a
    // lie as a floor. An UNGRADED type keeps its free `k` — that field is where
    // a catch row keeps its variant, and a variant is not a bad tier.
    if (TOOL_TYPES.has(t) && !QUALITY.includes(k)) return 0;
    const n = Math.max(1, posInt(qty, 1));
    let row = p.pouch.items.find((it) => it.t === t && str(it.k) === k);
    if (!row) {
      if (p.pouch.items.length >= CAPS.items) return 0;
      row = { t, q: 0, k };
      p.pouch.items.push(row);
    }
    row.q = posInt(row.q, 0) + n;
    this._touch(core);
    return row.q;
  },

  /** Remove from the pouch. All-or-nothing: a partial take would leave a
   *  consumer believing it paid a price it only half paid. */
  take(core, item, qty, gen) {
    const p = this._live(core, gen);
    if (!p) return false;
    const { t, k } = this._itemKey(item);
    const n = Math.max(1, posInt(qty, 1));
    const index = p.pouch.items.findIndex((it) => it.t === t && str(it.k) === k);
    if (index < 0 || posInt(p.pouch.items[index].q, 0) < n) return false;
    const row = p.pouch.items[index];
    row.q -= n;
    if (row.q <= 0) p.pouch.items.splice(index, 1);
    this._touch(core);
    return true;
  },

  /** Apply a reward: money and/or experience in one verb. Money floors at zero
   *  — a negative purse is a bug that would then price everything wrong. */
  award(core, reward, gen) {
    const p = this._live(core, gen);
    if (!p) return null;
    const money = isFiniteInt(reward?.money) ? reward.money : 0;
    const xp = Math.max(0, posInt(reward?.xp, 0));
    const verb = str(reward?.verb);
    if (money) p.pouch.money = Math.max(0, posInt(p.pouch.money, 0) + money);
    let row = null;
    // `verb` reaches here from quest payloads, which are untrusted save data:
    // a bare `p.skills.verbs[verb]` read resolves "constructor" to a function
    // and "__proto__" assignment repoints the map's prototype.
    if (xp && verb && verb !== "__proto__") {
      row = this._ownRead(p.skills.verbs, verb);
      if (!row || typeof row !== "object") {
        row = { l: 1, x: 0 };
        p.skills.verbs[verb] = row;
      }
      row.x = posInt(row.x, 0) + xp;
      while (row.l < CAPS.skillLevel && row.x >= xpPerLevel(row.l)) {
        row.x -= xpPerLevel(row.l);
        row.l += 1;
      }
      if (row.l >= CAPS.skillLevel) row.x = 0;
    }
    this._touch(core);
    return { money: p.pouch.money, level: row ? row.l : null };
  },

  /** Bind a tool or a modifier to a verb. `item` null clears the slot. Slots are
   *  a CLOSED vocabulary so the block cannot grow a new dimension by accident. */
  equip(core, verb, slot, item, gen) {
    const p = this._live(core, gen);
    if (!p) return false;
    const name = str(verb);
    if (!name || (slot !== "tool" && slot !== "mod")) return false;
    // VALIDATE BEFORE ALLOCATING. The old order minted the verb's bucket first
    // and only then refused a nameless item, leaving `{"fishing":{}}` in the
    // saved block — junk written by a call that reported doing nothing, and
    // written without _touch, so nothing even knew it was there.
    let pair = null;
    if (item != null) {
      const { t, k } = this._itemKey(item);
      if (!t) return false;
      // The same grading rule grant() applies, for the same reason and at the
      // same point — before anything is allocated. A slot is a pointer at a
      // pouch row, so a pair the pouch would refuse to hold is a pair nothing
      // can be pointing at.
      if (TOOL_TYPES.has(t) && !QUALITY.includes(k)) return false;
      pair = [t, k];
    }
    const slots = this._bucket(p.skills.equipped, name);
    if (!slots) return false;
    if (pair) slots[slot] = pair;
    else delete slots[slot];
    if (!Object.keys(slots).length) delete p.skills.equipped[name];
    this._touch(core);
    return true;
  },

  /** Move a relationship. `patch` is { d, t, h, s }: d is the 0-3 ladder, t
   *  counts encounters, h flags hostility, s is the last line worth remembering.
   *  Two caps bite here and they bite DIFFERENTLY (plan §4): the row cap evicts
   *  whole STRANGER rows, and the line cap evicts the oldest LINE and leaves the
   *  row standing. */
  bump(core, zoneId, name, patch, gen) {
    const p = this._live(core, gen);
    if (!p) return null;
    const zone = str(zoneId);
    const who = str(name);
    if (!zone || !who || zone === "__proto__" || who === "__proto__") return null;
    const heldRows = this._ownRead(p.rel, zone);
    const held = heldRows && typeof heldRows === "object" ? this._ownRead(heldRows, who) : undefined;
    let row = held && typeof held === "object" ? held : null;
    if (!row) {
      // VALIDATE BEFORE ALLOCATING, same reason as equip(): the old order minted
      // the ZONE bucket, then refused at the row cap, and left an empty zone in
      // the block that no _touch ever announced. The eviction can delete the
      // zone bucket, so the bucket is resolved after it, never before.
      if (this._relRowCount(p) >= CAPS.relRows && !this._evictStranger(p)) return null;
      const rows = this._bucket(p.rel, zone);
      if (!rows) return null;
      row = { d: 0, t: 0 };
      rows[who] = row;
    }
    if (patch && typeof patch === "object") {
      if (patch.d !== undefined) row.d = PF.clamp(posInt(patch.d, 0), 0, 3);
      row.t = posInt(row.t, 0) + Math.max(0, posInt(patch.t, patch.t === undefined ? 1 : 0));
      if (patch.h !== undefined) {
        if (patch.h) row.h = 1;
        else delete row.h;
      }
      if (patch.s !== undefined) {
        const line = clip(patch.s, CAPS.lineChars);
        if (line) {
          row.s = line;
          // Recency, derived from the BLOCK rather than a module counter: the
          // counter restarted at zero on every reload while restored rows kept
          // their old marks, so the first line written after a reload sorted as
          // the oldest and was the first one evicted.
          row.a = this._nextLineSeq(p);
          this._evictLines(p);
        } else {
          delete row.s;
          delete row.a;
        }
      }
    } else {
      row.t = posInt(row.t, 0) + 1;
    }
    this._touch(core);
    return row;
  },

  _relRowCount(p) {
    let n = 0;
    for (const [, rows] of ownEntries(p.rel)) n += ownEntries(rows).length;
    return n;
  },

  /** The next `s`-line recency mark, one past the highest the block holds. Read
   *  off the block so it survives a reload; at most CAPS.relRows rows, and only
   *  on a patch that actually carries a line. */
  _nextLineSeq(p) {
    let top = 0;
    for (const [, rows] of ownEntries(p.rel)) {
      for (const [, row] of ownEntries(rows)) top = Math.max(top, posInt(row?.a, 0));
    }
    return top + 1;
  },

  /** Evict one STRANGER-tier row (d === 0, fewest encounters, no line, NOT
   *  hostile). A row the player has actually built something with is never the
   *  one that goes — and an enemy is something built. Forgetting the person the
   *  player made hostile is the one eviction they would notice. */
  _evictStranger(p) {
    let worst = null;
    for (const [zoneId, rows] of ownEntries(p.rel)) {
      for (const [name, row] of ownEntries(rows)) {
        if (posInt(row?.d, 0) !== 0 || row?.s || row?.h) continue;
        if (!worst || posInt(row?.t, 0) < worst.t) worst = { zoneId, name, t: posInt(row?.t, 0) };
      }
    }
    if (!worst) return false;
    delete p.rel[worst.zoneId][worst.name];
    if (!ownEntries(p.rel[worst.zoneId]).length) delete p.rel[worst.zoneId];
    return true;
  },

  /** The row cap's LAST RESORT, for the paths that put whole fields back by
   *  assignment (restoration, the transplant) rather than one bump() at a time.
   *  `_evictStranger` is a preference — it refuses to take a row the player
   *  built something with — and a preference cannot be the only thing holding an
   *  invariant. Here the rows are ordered cheapest-loss-first (the ladder tier,
   *  then whether a remembered line hangs off it, then hostility — an enemy is
   *  something built — then encounters, then the COMPOSITE zone id and name for
   *  a tie that resolves the same way twice) and the head of that order goes
   *  until the count fits.
   *  A row the player built something with is still never the FIRST to go; it is
   *  just no longer exempt once nothing cheaper is left. */
  _evictToRowCap(p) {
    const over = this._relRowCount(p) - CAPS.relRows;
    if (over <= 0) return;
    const rows = [];
    for (const [zoneId, cells] of ownEntries(p.rel)) {
      for (const [name, row] of ownEntries(cells)) {
        rows.push({
          zoneId,
          name,
          d: PF.clamp(posInt(row?.d, 0), 0, 3),
          line: row?.s ? 1 : 0,
          h: row?.h ? 1 : 0,
          t: posInt(row?.t, 0),
        });
      }
    }
    rows.sort(
      (a, b) =>
        a.d - b.d ||
        a.line - b.line ||
        a.h - b.h ||
        a.t - b.t ||
        (a.zoneId < b.zoneId ? -1 : a.zoneId > b.zoneId ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
    );
    for (const victim of rows.slice(0, over)) {
      delete p.rel[victim.zoneId][victim.name];
      if (!ownEntries(p.rel[victim.zoneId]).length) delete p.rel[victim.zoneId];
    }
  },

  /** The LINE cap, which is not the row cap: past thirty lines the OLDEST line
   *  is dropped and its row stays exactly where it was, with its ladder and its
   *  encounter count intact. Losing the row instead would lose the relationship
   *  to make room for a sentence. */
  _evictLines(p) {
    const held = [];
    for (const [zoneId, rows] of ownEntries(p.rel)) {
      for (const [name, row] of ownEntries(rows)) if (row?.s) held.push({ zoneId, name, row, at: posInt(row.a, 0) });
    }
    if (held.length <= CAPS.relLines) return;
    // `a` is serialized, so this ordering means the same thing on the boot after
    // a reload as it did in the session that wrote it.
    held.sort((a, b) => a.at - b.at);
    for (const victim of held.slice(0, held.length - CAPS.relLines)) {
      delete victim.row.s;
      delete victim.row.a;
    }
  },

  /** Quest state. `action` is accept | progress | complete | abandon. Board
   *  completions ("b:") are world-FREE (the board is a generated template); pack
   *  completions ("p:") are world-bound and live under quests. */
  quest(core, action, payload, gen) {
    const p = this._live(core, gen);
    if (!p) return false;
    const active = p.quests.active;
    const id = str(payload?.id ?? payload);
    if (action === "accept") {
      if (!id || active.length >= CAPS.activeQuests || active.some((q) => q.id === id)) return false;
      active.push({
        id,
        g: str(payload.g),
        verb: str(payload.verb),
        target: str(payload.target),
        n: Math.max(1, posInt(payload.n, 1)),
        have: 0,
        r: { money: posInt(payload.r?.money, 0), xp: posInt(payload.r?.xp, 0) },
        day: posInt(payload.day, core.sim?.day ?? 0),
      });
      this._touch(core);
      return true;
    }
    const index = active.findIndex((q) => q.id === id);
    if (index < 0) return false;
    const row = active[index];
    if (action === "progress") {
      row.have = PF.clamp(posInt(row.have, 0) + Math.max(1, posInt(payload?.by, 1)), 0, posInt(row.n, 0));
      this._touch(core);
      return row.have >= posInt(row.n, 0);
    }
    if (action === "abandon") {
      active.splice(index, 1);
      this._touch(core);
      return true;
    }
    if (action !== "complete") return false;
    active.splice(index, 1);
    // The completion counter is keyed by the quest's TEMPLATE, not its instance:
    // "b1.d37.2" is the third delivery this world generated, and what the board
    // needs to know is how many deliveries the player has run.
    const template = str(payload?.template ?? row.id);
    const board = template.startsWith("p:") ? p.quests.done_pack : p.quests_done_board;
    const cap = board === p.quests.done_pack ? CAPS.packDone : CAPS.boardDone;
    // Own-property read: `board["constructor"]` is a function, not undefined, so
    // a bare read skips the cap check entirely on a template named after one.
    const standing = this._ownRead(board, template);
    if (standing === undefined && ownEntries(board).length >= cap) {
      // Full, so one counter goes rather than the new completion being dropped.
      // The LEAST-EARNED one: "oldest key" was alphabetical order dressed up as
      // recency (a completion counter carries no day to sort by), and a counter
      // at 1 is the cheaper loss than one the player earned nine times.
      this._trimCounters(board, cap - 1);
    }
    if (template && template !== "__proto__") board[template] = posInt(standing, 0) + 1;
    this.award(core, { money: row.r?.money, xp: row.r?.xp, verb: row.verb }, gen);
    this._touch(core);
    return true;
  },

  /** Append a day-ledger line. Refuses a day the gate already covers: those
   *  lines were told and re-telling them is the flaw the gate exists to stop. */
  log(core, text, day, gen) {
    const p = this._live(core, gen);
    if (!p) return false;
    const line = clip(text, CAPS.ledgerChars);
    if (!line) return false;
    const at = posInt(day, core.sim?.day ?? 0);
    if (at <= posInt(p.flushedDay, 0)) return false;
    p.ledger.lines.push([at, line]);
    this._compactLedger(p);
    this._touch(core);
    return true;
  },

  /** Append a notice to the band. Takes the BLOCK and not the core, which is the
   *  one thing about it that breaks the shape of every mutator above: its only
   *  caller is 60-save's rehydration, which runs before there is a live sim to
   *  dirty and is deliberately a NON-MUTATION (the next real save carries it),
   *  and which is also the one moment `_live`'s loading gate would refuse.
   *
   *  THE DAY IS THE DAY IT HAPPENED. The band is told-flagged rather than
   *  day-gated, so nothing here has to lift a notice above the flush gate to keep
   *  it tellable — which is what the old lines back-door had to do, and what put
   *  a day header from the FUTURE into the wrap-up (plan §2.5).
   *
   *  Returns true when a row was appended, false for text that clips to nothing. */
  notice(player, text, day) {
    if (!player || typeof player !== "object") return false;
    const line = clip(text, CAPS.ledgerChars);
    if (!line) return false;
    if (!player.ledger || typeof player.ledger !== "object") player.ledger = { lines: [] };
    const rows = Array.isArray(player.ledger.notices) ? player.ledger.notices : [];
    rows.push([posInt(day, 0), line]);
    player.ledger.notices = evictNotices(rows);
    return true;
  },

  /** THE WRAP-UP BURN (plan §2.5), and the other half of the two-field flush.
   *  The compose selected `flushedDay < day ≤ intro.ledgerOwed` and the host has
   *  ACCEPTED the turn carrying it; this is what makes that telling permanent —
   *  the day gate rises to `throughDay`, and every notice that rode the same tell
   *  is marked told.
   *
   *  IT GUARDS ITSELF, which is the one thing about it that is not ordinary. The
   *  invariant is `flushedDay ≤ ledgerOwed < sim.day` and this is the only writer
   *  that can RAISE the gate, so a burn that would raise one refuses unless
   *      flushedDay < throughDay ≤ intro.ledgerOwed  and  throughDay < sim.day
   *  with all three read from the LIVE sim at write time and not from whatever
   *  the sender was looking at when it composed. A burn AT the gate raises
   *  nothing, so it is held to `throughDay ≥ flushedDay` and no more: its whole
   *  job is marking a notice-only tell, and a PARTIAL RESTORE can leave the gate
   *  standing over a marker that owes nothing — a state the burn did not write
   *  and cannot repair, but must not be starved by (see the guard body). That is what closes the seam the
   *  generation fence cannot see: `_gen` moves only on a chat switch, while
   *  `_rebuild` replaces `core.sim` wholesale WITHOUT touching it (a rewind, a
   *  swipe, a checkpoint load), so a send resolving over a rewound sim passes the
   *  fence and would otherwise write a future gate onto the rewound block.
   *
   *  `notices` IS THE ROWS THE COMPOSE CAPTURED — `pending.ledger.notices`,
   *  handed back through the sender's closure-local pending — and not the live
   *  band read again here. The guard is NOT enough to make those two the same
   *  set, and that is the whole reason for the parameter. The guard reads three
   *  numbers, and three of the five notice writers move none of them: the
   *  dangling-quest repair, the mint severance and a restore landing on a gate
   *  already where it was all append to the band while leaving `flushedDay`,
   *  `ledgerOwed` and `day` untouched. Every one of them runs inside
   *  `_rehydratePlayer` ← `simFromSaved` ← `_rebuild`, which is UNFENCED on the
   *  same chat — so a rebuild landing mid-send hands the burn a live band with a
   *  row NOBODY COMPOSED in it, and a re-read would mark it told. The band
   *  answers to that flag and to nothing else, so a told row nobody was told is a
   *  sentence destroyed in silence: no gate to re-open, no day to re-select.
   *
   *  Marking the CAPTURED rows is safe in the same interleaving for the opposite
   *  reason: under a rebuild they are orphans of the sim that was replaced, and
   *  writing a flag onto an object nothing reads any more is a no-op. The fresh
   *  notice stays untold and rides the next compose, which is the only turn that
   *  can honestly carry it.
   *
   *  Returns true when it wrote and false for every refusal — the fence, the
   *  loading gate, a day that is not a day, the backwards gate, and (for a burn
   *  that would raise the gate) either of the two day inequalities.
   *  The senders SWALLOW the refusal (no toast, no retry): a guard refusal after
   *  an accepted send leaves the tell in history un-burned and the next compose
   *  re-tells it, which is a §5 lost-flush cause and not something to interrupt
   *  the player about. The value is for the tests. */
  flush(core, throughDay, notices, gen) {
    const p = this._live(core, gen);
    if (!p) return false;
    const sim = core.sim;
    if (!isFiniteInt(throughDay) || throughDay < 0) return false;
    const gate = posInt(p.flushedDay, 0);
    // Backwards: a tell composed against an older gate, resolving after a newer
    // one already rose. Nothing to do, and lowering the gate would re-tell.
    if (throughDay < gate) return false;
    // THE TWO DAY CHECKS GUARD THE GATE'S ADVANCE, so they are asked only when
    // there is one to guard. A burn AT the gate writes `max(gate, gate)` and
    // moves it nowhere; the band it carried answers to its told-flag and not to
    // a day, which is the whole reason the notices left the lines. A PARTIAL
    // RESTORE is what makes the difference matter: the player block rehydrates
    // outside the envelope's `v` gate, so a row this build cannot read the
    // envelope of — or a newer build's row that moved `intro.ledgerOwed` — comes
    // back with `flushedDay` standing over a marker that owes nothing. Asking
    // these of a gate that cannot rise refused the notice-only tell FOREVER: no
    // later day can lift `ledgerOwed` back over a `flushedDay` already above it,
    // so the same notice rode every compose for the rest of the save's life.
    if (throughDay > gate) {
      // Past what any sleep has made owed: the days beyond it are days the player
      // has not finished living, or a rewound sim that never staged them.
      if (throughDay > this.resolvedDay(sim.intro?.ledgerOwed)) return false;
      // …and never the day underway, whatever the marker says.
      if (throughDay >= this.resolvedDay(sim.day)) return false;
    }
    p.flushedDay = Math.max(gate, throughDay);
    for (const row of Array.isArray(notices) ? notices : []) {
      if (Array.isArray(row) && row.length >= 2 && !row[2]) row[2] = 1;
    }
    this._touch(core);
    return true;
  },

  /** Three days in full, one stub per elided day beyond them (plan §4). The
   *  stub is what keeps an unslept week from silently vanishing. */
  _compactLedger(p) {
    const lines = p.ledger.lines;
    const days = [...new Set(lines.map((l) => posInt(l[0], 0)))].sort((a, b) => a - b);
    const full = new Set(days.slice(-CAPS.ledgerDays));
    const out = [];
    const stubbed = new Set();
    for (const day of days) {
      const forDay = lines.filter((l) => posInt(l[0], 0) === day);
      if (full.has(day)) {
        // Newest within the day: an over-long day loses its EARLIEST lines, which
        // are the ones the player is furthest from remembering.
        for (const line of forDay.slice(-CAPS.ledgerPerDay)) out.push(line);
      } else if (!stubbed.has(day)) {
        stubbed.add(day);
        // IDEMPOTENT. A stub carries the count it stands for as a third element,
        // so re-stubbing an already-stubbed day adds its count back instead of
        // counting the one stub LINE — which is how an elided day that held
        // twelve things became "1 thing happened." on the next append.
        const n = forDay.reduce((sum, line) => sum + Math.max(1, posInt(line[2], 0)), 0);
        out.push([day, `Day ${day}: ${n} thing${n === 1 ? "" : "s"} happened.`, n]);
      }
    }
    // Bounded stubs, oldest first: an unslept month is a §5 limitation, not a
    // licence to grow the block without end.
    const stubDays = [...stubbed].sort((a, b) => a - b);
    const dropped = new Set(stubDays.slice(0, Math.max(0, stubDays.length - CAPS.ledgerStubs)));
    p.ledger.lines = dropped.size ? out.filter((line) => !dropped.has(posInt(line[0], 0))) : out;
  },

  /** Record a discovery. Composite id (p,e,d) so a sub-zone never collides with
   *  its parent; upserts, because seeing a place twice is not two discoveries. */
  discover(core, entry, gen) {
    const p = this._live(core, gen);
    if (!p) return false;
    const place = str(entry?.p);
    if (!place) return false;
    const row = {
      p: place,
      e: posInt(entry?.e, 0),
      d: posInt(entry?.d, 0),
      day: posInt(entry?.day, core.sim?.day ?? 0),
      seen: entry?.seen !== false,
    };
    const zones = p.found.zones;
    const index = zones.findIndex((z) => z.p === row.p && posInt(z.e, 0) === row.e && posInt(z.d, 0) === row.d);
    if (index >= 0) zones[index] = { ...zones[index], ...row };
    else {
      if (zones.length >= CAPS.found) {
        // The oldest by DAY, not the array-first row: serialize() re-orders the
        // array by (p,e,d), so after any reload `shift()` drops whatever sorts
        // first alphabetically and calls it the oldest discovery. Ties break on
        // the insertion index, which is what array-first meant when it worked.
        let victim = 0;
        for (let i = 1; i < zones.length; i++) {
          if (posInt(zones[i]?.day, 0) < posInt(zones[victim]?.day, 0)) victim = i;
        }
        zones.splice(victim, 1);
      }
      zones.push(row);
    }
    this._touch(core);
    return true;
  },

  /** Set the home anchor. A SEALED anchor ("z3") or { minted: true } — never a
   *  bare h{n}, which is a compiler-minted building id that moves with the mint
   *  and would silently rehome the player on the next world change (§2). */
  setHome(core, anchor, gen) {
    const p = this._live(core, gen);
    if (!p) return false;
    if (anchor == null) p.home = null;
    else if (typeof anchor === "string") {
      if (!anchor || /^h\d+$/.test(anchor)) return false;
      p.home = anchor;
    } else if (anchor && anchor.minted === true) p.home = { minted: true };
    else return false;
    this._touch(core);
    return true;
  },
};

/** The `setAside` slot's list view, tolerant of the pre-list single-entry shape
 *  a build before this one wrote (and of a hand-edited key). */
const asideEntries = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  if (Array.isArray(value.entries)) {
    return value.entries.filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry));
  }
  return [value];
};

/** Union two severance entries into one. The HELD entry is the anchor: its
 *  stamps and its reason are what a returning world is matched against, and the
 *  first loss is the one that has been waiting longest for that match. Only the
 *  FIELDS merge, and each one merges the way its own shape means:
 *    rel        union per person, the higher-tier cell winning a collision and
 *               the HELD row standing on an exact (d,t) tie
 *    quests     concatenated and deduped by id
 *    found      union by the composite (p,e,d) key
 *    counters   union, the higher count winning
 *    ledger     concatenated, newest kept, bounded by the live buffer's caps
 *    home       the held one — two homes are not a home
 *  A field only one side carries crosses untouched. */
const mergeStampEntries = (held, incoming) => {
  const a = held.fields && typeof held.fields === "object" ? held.fields : {};
  const b = incoming.fields && typeof incoming.fields === "object" ? incoming.fields : {};
  const fields = { ...b, ...a };
  // rel: {zone: {name: cell}}. Higher `d` wins, then more encounters, then the
  // HELD row — which is why the held side is offered FIRST and the incoming one
  // has to beat it STRICTLY to displace it. The order used to be the other way
  // round, so an exact (d,t) tie fell to the incoming row and took the held
  // row's remembered line with it — against the one principle this merge keeps
  // everywhere else, that the held entry is the anchor (its stamps, its reason,
  // its `at`, its home).
  if (a.rel || b.rel) {
    const merged = {};
    for (const source of [a.rel, b.rel]) {
      for (const [zoneId, rows] of ownEntries(source)) {
        // Through _bucket, not `merged[zoneId] ?? …`: a zone named "constructor"
        // or "toString" resolves to the INHERITED member on a bare read, and a
        // truthy one is adopted as the bucket — so the rows land on the builtin
        // and the merged map never grows an own key for that zone.
        const target = PF.player._bucket(merged, zoneId);
        if (!target) continue;
        for (const [name, row] of ownEntries(rows)) {
          const standing = Object.prototype.hasOwnProperty.call(target, name) ? target[name] : undefined;
          if (
            !standing ||
            posInt(row?.d, 0) > posInt(standing?.d, 0) ||
            (posInt(row?.d, 0) === posInt(standing?.d, 0) && posInt(row?.t, 0) > posInt(standing?.t, 0))
          ) {
            target[name] = row;
          }
        }
      }
    }
    fields.rel = merged;
  }
  if (Array.isArray(a.questsActive) || Array.isArray(b.questsActive)) {
    const byId = new Map();
    for (const quest of [
      ...(Array.isArray(b.questsActive) ? b.questsActive : []),
      ...(Array.isArray(a.questsActive) ? a.questsActive : []),
    ]) {
      const id = str(quest?.id);
      if (!id) continue;
      const standing = byId.get(id);
      if (!standing || posInt(quest?.have, 0) > posInt(standing?.have, 0)) byId.set(id, quest);
    }
    fields.questsActive = [...byId.values()];
  }
  for (const key of ["questsDonePack", "bought"]) {
    if (!a[key] && !b[key]) continue;
    const merged = {};
    for (const source of [b[key], a[key]]) {
      for (const [outer, value] of ownEntries(source)) {
        if (value && typeof value === "object" && !Array.isArray(value)) {
          // Same inherited-name refusal as the rel merge above.
          const target = PF.player._bucket(merged, outer);
          if (!target) continue;
          for (const [inner, n] of ownEntries(value)) target[inner] = Math.max(posInt(target[inner], 0), posInt(n, 0));
        } else {
          // The scalar side reads OWN-only for the same reason; an inherited
          // member is not a count this merge has already seen.
          merged[outer] = Math.max(posInt(PF.player._ownRead(merged, outer), 0), posInt(value, 0));
        }
      }
    }
    fields[key] = merged;
  }
  if (Array.isArray(a.found) || Array.isArray(b.found)) {
    const byKey = new Map();
    for (const zone of [...(Array.isArray(b.found) ? b.found : []), ...(Array.isArray(a.found) ? a.found : [])]) {
      if (!zone || typeof zone !== "object") continue;
      byKey.set(`${str(zone.p)}|${posInt(zone.e, 0)}|${posInt(zone.d, 0)}`, zone);
    }
    fields.found = [...byKey.values()].slice(-CAPS.found);
  }
  if (Array.isArray(a.ledgerLines) || Array.isArray(b.ledgerLines)) {
    const lines = [
      ...(Array.isArray(a.ledgerLines) ? a.ledgerLines : []),
      ...(Array.isArray(b.ledgerLines) ? b.ledgerLines : []),
    ].filter((line) => Array.isArray(line) && line.length >= 2);
    const cap = CAPS.ledgerDays * CAPS.ledgerPerDay + CAPS.ledgerStubs;
    fields.ledgerLines = lines.length > cap ? lines.slice(-cap) : lines;
  }
  if (a.home !== undefined || b.home !== undefined) fields.home = a.home !== undefined ? a.home : b.home;
  for (const key of ["flushedDay", "flushedDayWas"]) {
    if (a[key] === undefined && b[key] === undefined) continue;
    // The LOWER gate: whatever comes home must not land at or below it.
    fields[key] = Math.min(posInt(a[key], Infinity), posInt(b[key], Infinity));
    if (!Number.isFinite(fields[key])) fields[key] = 0;
  }
  return { ...held, fields, mergedCount: posInt(held.mergedCount, 1) + 1 };
};

// ── The quarantine store (plan §Q1a) ─────────────────────────────────────────
// Its OWN chat-metadata key, never the snapshot and never the route row: the
// whole point of a quarantine is that it survives the write that replaces the
// thing it is holding. Written immediately at creation with the brief path's
// three-attempts-total backoff, and the in-memory bag is the authority — the same discipline
// PF.save.ensurePresent already applies to the save key, for the same reason
// (~40 engine call sites still use the unqueued whole-blob updateMetadata).
PF.quarantine = {
  MAX_CHARS: QUARANTINE_MAX_CHARS,
  SLOTS: QUARANTINE_SLOTS,
  DROP_ORDER: QUARANTINE_DROP_ORDER,
  _bag: {},
  /** Dedupe for the PATCH, entirely separate from the save path's caches. */
  _bagSerialized: null,
  _chatId: null,
  /** THE SINGLE WRITER (slice-4 fix). Every bag write goes down one promise
   *  chain, the same arrangement PF.save._flushChain makes for the snapshot and
   *  for the same reason: the writes used to be `void this._write(...)`, each
   *  with its own retry loop, and the version re-adoption fires THREE of them in
   *  one synchronous stretch. Nothing ordered them, so a retried snapshot could
   *  land last and put an invalidated slot back on disk — or erase a park that
   *  memory still held. Serialized, the last bag state is the only thing that
   *  reaches the wire and disk converges on newest memory. */
  _writeChain: null,
  /** `{ id, holder }` for the write already queued but not yet running: the chat
   *  it belongs to, and the box it will read its payload out of. A second
   *  request for the same chat refreshes the holder rather than adding a round
   *  trip that sends the same bytes twice.
   *
   *  THE HOLDER IS BOUND TO THE TASK, not to this object, and that is the whole
   *  point (round-2 fix). The payload used to live in a field the queued task
   *  read at RUN time, so reset() — which must clear it, or task A writes chat
   *  B's bytes — left the queued task reading null and _writeNow dropped it on
   *  the floor. The severance parked at the moment of leaving a chat never
   *  reached that chat's disk. Now reset() clears the POINTER and the departing
   *  chat's task still holds the box it was given. */
  _pending: null,
  /** chatId → the bag bytes a write for that chat produced that are NOT known to
   *  have reached disk: queued, in flight, or failed out. Bounded by chat count.
   *
   *  THE HOLDER ALONE IS NOT ENOUGH, and the case that proves it is a two-chat
   *  round trip inside one un-drained chain. Park something on chat A, glance at
   *  B, and come back to A before A's queued write has run: hydrate() rebuilds
   *  the bag from DISK — which does not have the park, because the write never
   *  landed — and sets the dedupe cache to those bytes. The queued task then
   *  wakes, sees `_chatId === "A"`, re-serializes the live bag it now finds (the
   *  disk bag), and the dedupe says "already stored". The write is dropped and
   *  the park is gone from disk AND from memory, on the one path most likely to
   *  have produced a park in the first place.
   *
   *  So an unsettled write is remembered BY CHAT, and hydrate() prefers it over
   *  the disk read for that chat. That is the module's stated invariant being
   *  served rather than broken: the in-memory bag is the authority, and a disk
   *  read that silently demotes it to a stale copy is the bug. `_bagSerialized`
   *  keeps meaning exactly what it always meant — what we believe DISK holds — so
   *  the next write correctly sees the adopted bag as something disk still needs.
   *
   *  Kept across reset() on purpose, and deliberately NOT cleared when a write
   *  fails out: an entry nobody managed to store is precisely the one worth
   *  re-trying on the next visit, which is the self-heal ensurePresent already
   *  performs for the key as a whole. For the same reason it is never evicted to
   *  meet a ceiling — see UNSETTLED_MAX and _settledRecord. */
  _unsettled: new Map(),

  /** Per-chat: the bag belongs to the chat it was read from. `_writeChain` is
   *  deliberately NOT cleared, exactly as PF.save._flushChain is not: the
   *  departing chat's queued write rides it and must land before the arriving
   *  chat's first one. */
  reset() {
    this._bag = {};
    this._bagSerialized = null;
    this._chatId = null;
    this._pending = null;
  },

  /** Boot: read the key into the bag. Called once per chat from PF.save.restore
   *  — deliberately NOT from simFromSaved, which also runs on every rebuild and
   *  would resurrect a slot a re-adoption just consumed. */
  hydrate(meta, chatId) {
    this._chatId = chatId ?? null;
    const raw = meta && typeof meta === "object" ? meta[QUARANTINE_KEY] : null;
    const readBag = (value) => {
      const bag = {};
      if (!value || typeof value !== "object" || Array.isArray(value)) return bag;
      for (const slot of QUARANTINE_SLOTS) {
        const entry = value[slot];
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
        // `setAside` is a list on the wire now. Tolerant in both directions: a
        // key written before it was one is read as its single entry, and a bag
        // holding one entry writes the same shape a reader of either build
        // understands.
        bag[slot] = slot === "setAside" ? { entries: asideEntries(entry) } : entry;
      }
      if (bag.setAside && !bag.setAside.entries.length) delete bag.setAside;
      return bag;
    };
    const bag = readBag(raw);
    // WHAT DISK HOLDS, recorded before anything is preferred over it. That is the
    // dedupe's whole meaning and it has to keep describing DISK even when the bag
    // below does not — otherwise the very next write believes disk already has
    // what only memory has (see _unsettled).
    this._bagSerialized = Object.keys(bag).length ? JSON.stringify(bag) : null;
    // An unsettled write for THIS chat is newer than the disk read by
    // construction: it was produced from this session's own bag and never reached
    // the wire. Adopt it, so the bag stays the authority and the next write still
    // owes disk the difference.
    const held = chatId ? this._unsettled.get(chatId) : null;
    if (held) {
      let parked;
      try {
        parked = JSON.parse(held);
      } catch {
        parked = null; // unparseable is not recoverable; the disk read stands
      }
      if (parked) {
        this._bag = readBag(parked);
        // …AND ASK FOR THE WIRE AGAIN, which is the half the docstring above
        // promised and nothing performed. Adopting the bytes restored the entry to
        // MEMORY only: the write that never landed was still not re-tried, and a
        // park could sit in this map for the rest of the session and die with the
        // tab. "Re-trying on the next visit" is now a thing that happens on the
        // next visit. Free when there is nothing owed — `_write` collapses onto
        // anything already queued for this chat and `_writeNow` dedupes against
        // `_bagSerialized`, which is why the comparison is against DISK's bytes
        // rather than against what we adopted.
        const adopted = this._serialize();
        if (adopted !== this._bagSerialized) void this._write(chatId);
        return this._bag;
      }
    }
    this._bag = bag;
    return bag;
  },

  /** The slot's entry — for `setAside`, the OLDEST of its list, which is the
   *  displaced block a single-entry caller means. `peekAll` is the list view. */
  peek(slot) {
    if (slot === "setAside") return asideEntries(this._bag.setAside)[0] ?? null;
    return this._bag[slot] ?? null;
  },

  peekAll(slot) {
    if (slot === "setAside") return asideEntries(this._bag.setAside);
    return this._bag[slot] ? [this._bag[slot]] : [];
  },

  slots() {
    return Object.keys(this._bag).sort();
  },

  /** Per slot, and the three kinds do NOT behave the same way.
   *
   *  `migration` / `version` — FIRST-LOSS-WINS, unchanged. The first thing
   *    either slot lost is the one furthest from being recoverable any other
   *    way, and a later loss of the same kind is a repeat of the same cause.
   *
   *  `stamp` — MERGES. This slot was one-shot too, and that was a data-loss bug
   *    with a lie on top: applyStamps STRIPS the live block before offering the
   *    entry, so a second severance found the slot full, got `false` back, and
   *    deleted everything it had just stripped — while still telling the player
   *    it had been set aside. Severance parking is lossless while the bag has
   *    room. The HELD entry stays the anchor (its stamps, its reason, its `at`
   *    — the first loss is the one a returning world is matched against) and the
   *    incoming fields are unioned into it.
   *
   *  `setAside` — APPENDS, bounded. It is human-resolved, so a second displaced
   *    live block is a second thing to offer them, not a duplicate.
   *
   *  Slots stay independent: a full `version` slot must not silence a
   *  `migration` loss. Returns false when nothing was stored, and NO CALLER may
   *  drop that on the floor — the whole bug class above is one unread return. */
  put(chatId, slot, entry) {
    if (!QUARANTINE_SLOTS.includes(slot) || !entry || typeof entry !== "object") return false;
    const stamped = { at: new Date().toISOString(), ...entry };
    let next;
    if (slot === "setAside") {
      const held = asideEntries(this._bag.setAside);
      const entries = [...held, stamped];
      while (entries.length > SETASIDE_MAX) entries.shift(); // oldest first, as overflow drops
      next = { entries };
    } else if (slot === "stamp" && this._bag.stamp) {
      next = mergeStampEntries(this._bag.stamp, stamped);
    } else if (this._bag[slot]) {
      return false;
    } else {
      next = stamped;
    }
    // FIT-CHECK BEFORE MUTATING (slice-4 fix). The drop loop used to run after
    // the fact, so an entry too large to store spent every OTHER slot on its way
    // to being dropped itself — while `put` had already returned true. An entry
    // that cannot be held even alone is refused here, with the bag untouched.
    if (JSON.stringify({ [slot]: next }).length > QUARANTINE_MAX_CHARS) return false;
    this._bag[slot] = next;
    void this._write(chatId ?? this._chatId);
    return true;
  },

  /** THE CONTRACT: `consume` is `peek` that also takes. It returns exactly what
   *  `peek(slot)` would have returned and removes exactly that — for `setAside`,
   *  the OLDEST entry, leaving the rest of the list in the bag for the next
   *  caller. `consumeAll` is the bulk verb and pairs with `peekAll`.
   *
   *  Stated because it was not true (round-2 fix): consume returned `setAside`'s
   *  LIST WRAPPER while peek returned an entry, so the one slot a human resolves
   *  one item at a time was also the one slot whose two readers disagreed about
   *  what they were handing back. Slice 6's resolution UI is the first live
   *  caller and would have found it the hard way.
   *
   *  The version slot's re-adoption consumes it, which is what makes a third
   *  boot a no-op. */
  consume(chatId, slot) {
    if (slot === "setAside") {
      const entries = asideEntries(this._bag.setAside);
      const oldest = entries.shift();
      if (!oldest) return null;
      if (entries.length) this._bag.setAside = { entries };
      else delete this._bag.setAside;
      void this._write(chatId ?? this._chatId);
      return oldest;
    }
    const entry = this._bag[slot];
    if (!entry) return null;
    delete this._bag[slot];
    void this._write(chatId ?? this._chatId);
    return entry;
  },

  /** Take the WHOLE slot: the list for `setAside`, a one-element list for the
   *  others, `[]` when it is empty. The bulk mirror of `peekAll`. */
  consumeAll(chatId, slot) {
    const held = this.peekAll(slot);
    if (!held.length) return [];
    delete this._bag[slot];
    void this._write(chatId ?? this._chatId);
    return held;
  },

  /** Drop a slot without reading it (explicit discard, or invalidation). */
  discard(chatId, slot) {
    if (!this._bag[slot]) return false;
    delete this._bag[slot];
    void this._write(chatId ?? this._chatId);
    return true;
  },

  /** Same self-heal as the save key, and it needs its own branch: the two keys
   *  are written by different code paths and an engine whole-blob write erases
   *  whichever it erases. */
  ensurePresent(core, meta) {
    if (!Object.keys(this._bag).length || !core?.chatId) return;
    if (meta && typeof meta === "object" && meta[QUARANTINE_KEY] == null) {
      this._bagSerialized = null;
      void this._write(core.chatId);
    }
  },

  /** Serialize the bag, dropping least-recoverable first until it fits its own
   *  QUARANTINE_MAX_CHARS ceiling — which a realistic severance is nowhere near,
   *  so this is the tripwire firing rather than routine housekeeping. Mutates
   *  the bag: a slot that cannot be stored is not being held, and pretending
   *  otherwise would report a recovery that cannot happen. */
  _serialize() {
    let text = JSON.stringify(this._bag);
    if (text.length <= QUARANTINE_MAX_CHARS) return text;
    // An entry that cannot be stored EVEN ALONE goes first, whatever the drop
    // order says. Keeping it costs every other slot and buys nothing: the old
    // loop worked down the order, emptied the bag, and then dropped the
    // oversized entry too. `put`'s fit-check keeps one out of the bag in the
    // first place; this catches one that grew there through a stamp merge or
    // arrived oversized straight off disk (hydrate's readBag checks shape, not
    // size).
    for (const slot of QUARANTINE_SLOTS) {
      if (text.length <= QUARANTINE_MAX_CHARS) break;
      if (!this._bag[slot]) continue;
      if (JSON.stringify({ [slot]: this._bag[slot] }).length <= QUARANTINE_MAX_CHARS) continue;
      console.warn(`[pixelforge] the quarantine ${slot} entry does not fit the bag even alone; dropping it`);
      delete this._bag[slot];
      text = JSON.stringify(this._bag);
    }
    for (const slot of QUARANTINE_DROP_ORDER) {
      if (text.length <= QUARANTINE_MAX_CHARS) break;
      if (!this._bag[slot]) continue;
      if (slot === "setAside") {
        // The one LIST sheds its oldest entries one at a time before the slot
        // itself goes: the newest displaced block is the one the player is most
        // likely to still want back.
        const entries = asideEntries(this._bag.setAside);
        while (entries.length > 1 && text.length > QUARANTINE_MAX_CHARS) {
          entries.shift();
          this._bag.setAside = { entries: [...entries] };
          text = JSON.stringify(this._bag);
        }
        if (text.length <= QUARANTINE_MAX_CHARS) break;
      }
      console.warn(`[pixelforge] quarantine over ${QUARANTINE_MAX_CHARS} chars; dropping the ${slot} entry`);
      delete this._bag[slot];
      text = JSON.stringify(this._bag);
    }
    return text;
  },

  /** The one `_unsettled` record that is free to drop: a chat whose bytes DISK IS
   *  KNOWN TO HOLD, excluding the chat the caller is writing for.
   *
   *  THE BRANCH IS NARROWER THAN IT SOUNDS, and the comment that used to stand in
   *  for it read as though it ranged over the whole map (O-4). `_bagSerialized`
   *  records what we believe disk holds for the LIVE chat and for no other chat
   *  at all, so "known to hold" is a question that can only be asked about
   *  `_chatId`'s own record — a record for any other chat has nothing to compare
   *  against and is never a candidate, whatever its bytes say. What that leaves
   *  is one real case: a write asked for on a DIFFERENT chat while the live
   *  chat's record is already stale, which is exactly the state `_writeNow`
   *  leaves behind when it returns early on bytes that match the dedupe cache.
   *  Everything else in the map is a real loss and is never taken. */
  _settledRecord(exceptId) {
    if (this._bagSerialized === null) return null;
    for (const [key, bytes] of this._unsettled) {
      if (key !== exceptId && key === this._chatId && bytes === this._bagSerialized) return key;
    }
    return null;
  },

  /** Enqueue a bag write. Collapses onto the queued one for the same chat and
   *  serializes behind everything already on the chain. */
  _write(chatId) {
    const id = chatId ?? this._chatId;
    if (!id) return Promise.resolve(false);
    if (this._chatId === null) this._chatId = id;
    const captured = this._serialize();
    // Remembered per chat from the moment the write is ASKED FOR, not from the
    // moment it runs: everything between here and a landed PATCH is a window in
    // which a chat round trip can lose it (see _unsettled).
    this._unsettled.delete(id);
    this._unsettled.set(id, captured);
    // THE LEAK GUARD MUST NOT BECOME THE LEAK, and the only way to keep that true
    // is to CARRY THE OVERFLOW rather than the loss (O-2 — see UNSETTLED_MAX, and
    // PF.save._cacheBrief, which answers the identical fork the identical way).
    // Every entry in this map is by construction a write that has NOT been shown
    // to reach disk — queued, in flight, or failed out — so evicting one silently
    // re-opens the park loss for that chat, which is the entire bug this map
    // exists to close. Only the records disk is known to hold are shed; when
    // there are none left to shed, the map is simply larger than UNSETTLED_MAX
    // and nothing is lost by that.
    while (this._unsettled.size > UNSETTLED_MAX) {
      const victim = this._settledRecord(id);
      if (victim === null) break;
      this._unsettled.delete(victim);
    }
    if (this._pending?.id === id) {
      // Already queued for this chat: refresh the holder the queued task will
      // read and let it carry the newest bytes. Two PATCHes of the same bytes
      // are exactly the reordering hazard this chain exists to remove.
      this._pending.holder.text = captured;
      return this._writeChain;
    }
    const holder = { text: captured };
    this._pending = { id, holder };
    const task = () => {
      // Only clear the pointer if it is still OURS. After a chat switch it
      // belongs to the arriving chat, and clearing that would make the next
      // write for it queue a second task instead of collapsing into the first.
      if (this._pending?.holder === holder) this._pending = null;
      return this._writeNow(id, holder.text);
    };
    this._writeChain = (this._writeChain ?? Promise.resolve()).then(task, task);
    return this._writeChain;
  },

  async _writeNow(chatId, captured) {
    const gen = PF.save?._gen ?? 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      // RE-READ THE BAG EVERY ATTEMPT. A retry that lands 500 ms later must
      // carry what the bag holds NOW, not the snapshot the first attempt froze
      // — that snapshot is how a retried write resurrected a slot a later
      // consume() had already cleared. Once the chat has moved on the live bag
      // is somebody else's and the captured bytes are what this id is owed.
      const live = this._chatId === chatId;
      const text = live ? this._serialize() : captured;
      if (live && text === this._bagSerialized) return true;
      if (!text) return false;
      const payload = text === "{}" ? null : JSON.parse(text);
      try {
        await PF.api.patchMetadata(chatId, { [QUARANTINE_KEY]: payload });
        if (live && gen === (PF.save?._gen ?? 0)) this._bagSerialized = text;
        // Settled — but only for the bytes we actually wrote. A put() that landed
        // while this PATCH was in flight has already put NEWER bytes in the map
        // and queued its own write to clear them; deleting unconditionally here
        // would drop the record of a write that has not happened yet.
        if (this._unsettled.get(chatId) === text) this._unsettled.delete(chatId);
        return true;
      } catch (err) {
        if (attempt === 2) {
          // The bag is still the authority in memory, and ensurePresent re-tries
          // it on the next props delivery. Losing the WRITE is not losing the
          // entry until the tab does.
          console.warn("[pixelforge] quarantine storage failed; holding it in memory", err);
          return false;
        }
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
    return false;
  },
};

// Registry completeness, in 20-world's startup-assertion idiom and exactly the
// pairing 60-save makes for ENVELOPE_KEYS one level up: PLAYER_KEYS and
// serialize()'s literal have to agree in BOTH directions, and neither direction
// fails loudly on its own.
//   • a key emitted but NOT listed → the carry loop copies the restored value in
//     ahead of everything as an unknown key, so our own field lands out of wire
//     order and every dedupe in the save path drifts with it (§2.1);
//   • a key listed but NOT emitted → the list makes the read skip it, so it
//     never reaches the carry either, and the write silently deletes a newer
//     build's field. That is the slice-1 bug, one level down.
// Probed on a MAX-SHAPE block: `bought` is an optional seam and an empty one is
// deliberately not emitted (§2.3), so a default block alone would not exercise
// the second direction at all. Cheap enough to run at load.
{
  const probe = PF.player.serialize({ ...PF.player.defaultPlayer(), bought: { shop: { "lodging-key": 1 } } });
  for (const key of Object.keys(probe)) {
    if (!PLAYER_KEYS.has(key))
      throw new Error(`pixelforge: the player block emits "${key}", which PLAYER_KEYS does not list`);
  }
  for (const key of PLAYER_KEYS) {
    if (!(key in probe))
      throw new Error(`pixelforge: PLAYER_KEYS lists "${key}", which the player block does not emit`);
  }
}

// ===== 59-economy.js =====
// ── Things and money (S3), and the first thing to spend money ON (P1) ─────────
// The player block has held a pouch, a purse and a `home` field since S5 slice 3
// and nothing has ever put anything in them. This is the layer that does: the
// item VOCABULARY (what a `{t,k}` row is called and how it reads in this theme),
// the fixed PRICE list, and the one live transaction 0.11 ships — renting a berth
// at the settlement's inn, which is simultaneously S3's first money sink and the
// bed P5's day-ledger boundary will need (plan §2, Decisions #2).
//
// WHY A BERTH AND NOT A HOUSE. Maintainer ruling #2: there is NO automatic home.
// A modern setting probably houses its protagonist and a fantasy adventurer
// probably sleeps where they can, and only the setup/GM knows which — so the
// block ships the FIELD (booting null) and the player-driven path is renting a
// room. Home ASSIGNMENT channels (a setup flag, P6 building) are enumerated in
// the plan and deliberately not here.
//
// Everything below is CONTENT plus the game-facing entry points: the OFFERS
// (berthOffer, rodOffer) describe and never charge, so the HUD can call them
// every frame; the VERBS (rentBerth, buyRod, grantStartingPurse) mutate. The
// rest — _skin, currency, money, describe, price, the catch tables — is the
// vocabulary those read through. It holds no state of its own: what persists
// goes through the shipped mutators (award/grant/setHome/log/bump) and lives in
// the player block, which is what makes it rewind-safe.

// The catch table's TYPE vocabulary — the fixed shared roles a table entry can
// be, and the one non-catch yield water gives up. A table row carries a role and
// a VARIANT slug ("carp", "kelp", "vat-strain"), and the role is the half that
// means the same thing in every theme, which is why the xp table below is keyed
// by it.
const CATCH_ROLES = ["catch-common", "catch-uncommon", "catch-rare", "catch-prize"];
// Bait is a real water yield and not a catch (fishing is bait's own finder), so
// it sits outside the roles and still earns through the same table: the award
// keys on `role ?? BAIT_TYPE`, which is what stops a bait-first session from
// minting no skill row at all on a player who has plainly been fishing. A table
// entry with no `role` IS a bait entry — one field, read one way.
const BAIT_TYPE = "bait";
// The types whose `k` is a VARIANT SLUG rather than a tier or nothing. describe()
// keys their display name on `k`; PF.player.TOOL_TYPES is the other half of the
// same split and keys on the type's own name with `k` as an adjective in front.
const VARIANT_TYPES = new Set([...CATCH_ROLES, BAIT_TYPE]);

// The closed item vocabulary. A pouch row is keyed `(t, k)` — type and quality —
// and `t` has to mean the same thing in every theme or a save crossing a theme
// change would be renaming the player's belongings. So the TYPES are shared and
// only the SKIN (what it is called, and the glyph the purse shows) is per theme.
const ITEM_TYPES = ["lodging-key", "rod", BAIT_TYPE, ...CATCH_ROLES];

// The skill verbs this build ships a row for. A `skills.verbs` key is world-FREE
// and means the same thing everywhere, exactly as an item type does — so the
// verb is shared and only the SKIN is per theme, and the boot assertion below
// demands every theme name each of these and the two slots it equips.
const SKILL_VERBS = ["fishing"];

// The four daypart words, which is the axis a catch table's multipliers are keyed
// on. They mirror PF.Sim.daypart()'s own four and are written here because the sim
// exports no list; the boot assertion below refuses a table entry keyed on
// anything else, which is what stops a plausible-looking "evening" column from
// shipping as a multiplier that never applies.
const DAYPARTS = ["dawn", "day", "dusk", "night"];

// The two feature tags that hold fishable water — the closed brief vocabulary's
// own words (18-brief FEATURE_TAGS), and the second half of a catch table's key.
// A spot's kind is where it stands in the world's shape, not what it is called:
// still water and running water fish differently in any theme, so the table set
// is (theme × kind) and both halves are asserted complete at boot.
const SPOT_TAGS = ["water-feature", "water-crossing"];

// ── What comes out of the water (plan §2.2) ──────────────────────────────────
// One table per (theme, spot kind). An ENTRY is `{role, variant, weight,
// minLevel, daypart}`:
//   • `role`   — the shared TYPE, one of CATCH_ROLES. ABSENT means bait, which is
//                a yield in its own right and the only one that is also an input.
//   • `variant`— the entry's slug, and the pouch row's `k`. Row identity is
//                `(role, variant)`, so kelp never merges into carp and a stack of
//                one thing is a stack of one thing.
//   • `weight` — relative share of the successful casts this table answers for.
//   • `minLevel` — the level the entry becomes REACHABLE at; below it the entry
//                is not in the draw at all, which is what makes the ladder feel
//                like it opens water up rather than merely raising a percentage.
//   • `daypart`— per-daypart multipliers over `weight`, absent meaning 1. This is
//                0.12's ONLY live modifier (weather is L2, M9) and it is where a
//                night spot stops being the same spot as a noon one.
// NO PER-ENTRY XP: TUNING.catchXp is the single authority, keyed by TYPE, so a
// rebalance happens in one place and cannot half-happen.
//
// SCI-FI IS NOT FISH-FREE (M6 RULED). A colony that stocks a coolant pool eats
// carp out of it; what the theme adds is flavored variants beside the real fish
// and non-fish yields — kelp cultures, filter salvage — that are legitimate
// entries and not consolation prizes.
const CATCH_TABLES = {
  "cozy-village": {
    "water-feature": [
      { variant: "worms", weight: 24, minLevel: 1, daypart: { dawn: 1.2, night: 0.7 } },
      { role: "catch-common", variant: "carp", weight: 34, minLevel: 1, daypart: { night: 0.7 } },
      { role: "catch-uncommon", variant: "bream", weight: 18, minLevel: 3, daypart: { dusk: 1.3 } },
      { role: "catch-rare", variant: "mirror-pike", weight: 6, minLevel: 7, daypart: { day: 0.6, night: 1.6 } },
      { role: "catch-prize", variant: "old-tench", weight: 2, minLevel: 12, daypart: { dawn: 2, day: 0.5 } },
    ],
    "water-crossing": [
      { variant: "grubs", weight: 22, minLevel: 1 },
      { role: "catch-common", variant: "minnow", weight: 32, minLevel: 1 },
      { role: "catch-uncommon", variant: "trout", weight: 17, minLevel: 4, daypart: { dawn: 1.4, dusk: 1.3 } },
      { role: "catch-rare", variant: "silver-eel", weight: 6, minLevel: 8, daypart: { day: 0.5, night: 1.8 } },
      { role: "catch-prize", variant: "crown-salmon", weight: 2, minLevel: 13, daypart: { dawn: 1.6 } },
    ],
  },
  "sci-fi-colony": {
    "water-feature": [
      { variant: "chum", weight: 24, minLevel: 1 },
      { role: "catch-common", variant: "carp", weight: 28, minLevel: 1, daypart: { night: 0.7 } },
      { role: "catch-common", variant: "culture-kelp", weight: 14, minLevel: 1 },
      { role: "catch-uncommon", variant: "vat-strain", weight: 16, minLevel: 3, daypart: { dusk: 1.3 } },
      { role: "catch-rare", variant: "pressure-eel", weight: 6, minLevel: 7, daypart: { night: 1.6 } },
      { role: "catch-prize", variant: "heritage-koi", weight: 2, minLevel: 12, daypart: { dawn: 1.8, day: 0.5 } },
    ],
    "water-crossing": [
      { variant: "larvae", weight: 22, minLevel: 1 },
      { role: "catch-common", variant: "minnow", weight: 30, minLevel: 1 },
      { role: "catch-uncommon", variant: "filter-salvage", weight: 12, minLevel: 2 },
      { role: "catch-uncommon", variant: "trout", weight: 16, minLevel: 4, daypart: { dawn: 1.4 } },
      { role: "catch-rare", variant: "deepline-eel", weight: 6, minLevel: 8, daypart: { night: 1.8 } },
      { role: "catch-prize", variant: "ice-run-char", weight: 2, minLevel: 13, daypart: { dawn: 1.6 } },
    ],
  },
};

const ITEM_SKINS = {
  "cozy-village": {
    currency: { one: "coin", many: "coins", glyph: "◍" },
    items: {
      "lodging-key": { name: "room key", glyph: "🔑" },
      rod: { name: "fishing rod", glyph: "🎣" },
      [BAIT_TYPE]: { name: "hook bait", glyph: "🪱" },
      "catch-common": { name: "catch", glyph: "🐟" },
      "catch-uncommon": { name: "good catch", glyph: "🐟" },
      "catch-rare": { name: "rare catch", glyph: "🐠" },
      "catch-prize": { name: "prize catch", glyph: "🏆" },
    },
    // EVERY VARIANT ANY SHIPPED TABLE NAMES, in every theme — asserted at boot.
    // The pouch is world-free, so a carp caught in a valley is still in the bag
    // when the same chat's next world is a colony, and the row has to have a word
    // there too. Which is also why the shared ones read the same in both maps: a
    // carp is a carp in any world, and the entries that earn their keep are the
    // ones a theme only ever sees in a traveller's pouch — this map's rendering
    // of the colony's kelp and vat stock, and the colony's of a mirror pike.
    variants: {
      worms: "worms",
      grubs: "grubs",
      chum: "chum",
      larvae: "wrigglers",
      carp: "carp",
      bream: "bream",
      minnow: "minnow",
      trout: "trout",
      "mirror-pike": "mirror pike",
      "silver-eel": "silver eel",
      "old-tench": "old tench",
      "crown-salmon": "crown salmon",
      "culture-kelp": "strange kelp",
      "vat-strain": "pale fish",
      "pressure-eel": "deep eel",
      "heritage-koi": "painted carp",
      "filter-salvage": "odd scrap",
      "deepline-eel": "black eel",
      "ice-run-char": "ice char",
    },
    // The seeded flourish's word pools, keyed by the row's TYPE. A pool is a
    // DISPLAY override and nothing else — no row, no byte and no roll depends on
    // it — so a theme that ships none simply reads its plain names.
    flourishes: {
      "catch-common": ["plump", "muddy", "silver-sided"],
      "catch-uncommon": ["bright-finned", "deep-water", "speckled"],
      "catch-rare": ["scarred", "moon-pale", "grandfather"],
      "catch-prize": ["storied", "long-hunted", "river-king's"],
    },
    // The refusals a player is meant to ACT on, in this theme's words. `{role}`
    // is filled from the keeper's COMPILED role and never hardcoded: a sci-fi
    // colony has no innkeeper, and only the brief knows what it does have.
    hints: { noRod: "You need a rod — the {role} sells one." },
    // WHAT THIS WORLD CALLS THE PERSON PLAYING IT. The package has no player
    // name and the host props expose none, so the character sheet says what KIND
    // of person is standing there rather than inventing a name for them (plan
    // §2.8). An engine persona name + avatar is an enumerated Engine FR.
    player: "Traveler",
    // A VERB'S OWN WORD BOOK: what the skill is called here, and what its two
    // equipment slots hold. The slot names are the closed `tool`/`mod` pair the
    // block stores; a player should never be shown either of those words.
    verbs: { fishing: { name: "Fishing", tool: "rod", mod: "bait" } },
  },
  "sci-fi-colony": {
    currency: { one: "credit", many: "credits", glyph: "◈" },
    items: {
      "lodging-key": { name: "berth chit", glyph: "🔑" },
      rod: { name: "angling rig", glyph: "🎣" },
      [BAIT_TYPE]: { name: "lure stock", glyph: "🪱" },
      "catch-common": { name: "haul", glyph: "🐟" },
      "catch-uncommon": { name: "good haul", glyph: "🐟" },
      "catch-rare": { name: "rare haul", glyph: "🐠" },
      "catch-prize": { name: "record haul", glyph: "🏆" },
    },
    variants: {
      worms: "worms",
      grubs: "grubs",
      chum: "chum",
      larvae: "tank larvae",
      carp: "carp",
      bream: "bream",
      minnow: "minnow",
      trout: "trout",
      "mirror-pike": "mirror pike",
      "silver-eel": "silver eel",
      "old-tench": "old tench",
      "crown-salmon": "crown salmon",
      "culture-kelp": "culture kelp",
      "vat-strain": "vat strain",
      "pressure-eel": "pressure eel",
      "heritage-koi": "heritage koi",
      "filter-salvage": "filter salvage",
      "deepline-eel": "deepline eel",
      "ice-run-char": "ice-run char",
    },
    flourishes: {
      "catch-common": ["tank-bred", "pale", "filter-fed"],
      "catch-uncommon": ["odd-scaled", "cold-run", "gene-drifted"],
      "catch-rare": ["unlogged", "pressure-marked", "off-manifest"],
      "catch-prize": ["record", "founder-stock", "hand-listed"],
    },
    hints: { noRod: "You need an angling rig — the {role} stocks one." },
    player: "Drifter",
    verbs: { fishing: { name: "Angling", tool: "rig", mod: "lure" } },
  },
};

// The rungs the rod ladder can quote (plan §2.4). 0.12 sells two: a rodless
// player is offered `crude`, a crude owner is offered `decent`, and a
// decent-or-better owner is offered nothing at all. The upper QUALITY tiers are
// content for a later release and are deliberately absent — the boot assertion
// at the foot of this file demands a price row for every rung this list names,
// in every theme, so adding one here is what makes the build insist on pricing
// it rather than letting a keeper refuse the sale at play as "not for sale".
const ROD_TIERS = ["crude", "decent"];

/** The price key a rod tier is quoted under. One helper rather than two format
 *  strings in two files, so the assertion and the offer cannot drift apart. */
const rodPriceKey = (tier) => `rod:${tier}`;

// Fixed price lists, per theme (plan §2: "0.11 can ship fixed price lists first").
// The weekly deterministic stock tables the plan describes need L2's calendar and
// arrive with it; nothing here blocks that and nothing here has to be unpicked for
// it — a table lookup replaces the constant and the verbs do not move.
//
// THE ROD ROWS ARE PER (THEME, TIER) BECAUSE ACQUISITION IS PER THEME, which is
// the whole of the maintainer's amended ruling: no rod is ever free, and what
// differs between worlds is what buying one COSTS you. Fantasy fishing is a
// common thing to do, so its entry rod is cheap — half a night's berth, which is
// "easily obtainable" made concrete. A sci-fi colony fishes as a niche hobby, so
// its keeper quotes the same entry rod at FOUR TIMES the fantasy price (24
// against 6 — the stated multiple), standing in until the hobby-store and
// online-shopping mechanic lands and takes sci-fi rod acquisition off the keeper
// entirely. The premium sits on the ENTRY rung because acquisition is what the
// ruling is about; `decent` is a deliberate upgrade in either world and is
// priced the same in both.
//
// Every number here is retunable DATA and nothing asserts a relationship between
// them — see TUNING's price-interplay note for what a tuner should watch while
// moving them.
const PRICES = {
  "cozy-village": { berth: 12, "rod:crude": 6, "rod:decent": 40 },
  "sci-fi-colony": { berth: 12, "rod:crude": 24, "rod:decent": 40 },
};

// What a new game starts with. It exists because a sink with no source is not a
// feature: the real income is the quest layer (P4, roadmap 0.13), so without this
// the one transaction 0.11 ships would be unreachable in a shipped game and only
// ever exercised by a test that minted its own money. Granted ONCE, on the first
// sealed world to come up on a block nothing has touched — see grantStartingPurse
// for why that condition and not a default value.
const STARTING_PURSE = 40;

// "Line and tackle included" — the stack of bait that rides the FIRST rod
// purchase. Its slug is the theme's own first bait variant (see starterBait), so
// it merges with the bait the player then fishes up rather than orphaning a
// second row beside it. A purchase quantity and not a fishing number, which is
// why it sits beside the starting purse and not in TUNING.
const STARTER_BAIT = 8;

// ── Fishing's tuning table (plan §2.2, §2.4) ─────────────────────────────────
// Exported and retunable, and it is the ONLY place a number the fishing verb
// uses is written: a tuner changes how fishing plays by editing this object and
// touching nothing else. Every field carries its own comment because "no
// unstated numbers" is the rule the plan set for this table specifically.
//
// PACING, stated so a retune can be checked against an intent instead of a
// feeling. The FIXED side is the ladder: leaving level `l` costs 10l xp
// (PF.player.xpPerLevel) against a ceiling of CAPS.skillLevel 20, so the cap is
// Σ 10l for l = 1…19 = 1,900 xp and nothing below can move it. The target is
// that a player who fishes as their day's work gets there in a few dozen of
// those days. At `castMinutes` 15 a ten-hour day is 40 windows; mid-curve
// (decent rod, BAITLESS, halfway up the ladder) lands p = 0.48 × 1.15 ≈ 0.55, so
// ≈ 22 of them yield; a common-heavy table pays ≈ 1.8 xp a yield. Call it 40 xp
// a day, and the cap is ≈ 48 days of nothing but fishing. A day fished BAITED
// throughout is the same chain times `baitMult`: p ≈ 0.69, ≈ 50 xp, ≈ 38 days —
// which is the honest range, since no real session stays on one side of it.
//
// THE CATCH TABLE MOVES THAT AS MUCH AS THIS OBJECT DOES, and the BAIT SHARE is
// the sharpest lever in it: bait pays `catchXp[BAIT_TYPE]`, the floor, and it
// also refills the stack the bait multiplier rides on — so a high bait weight is
// a self-sustaining, slow-earning table, and a low one drains toward baitless
// casting at the lower multiplier. Recompose the table and the arithmetic above
// has to be redone.
//
// PRICE INTERPLAY — A NOTE FOR TUNERS, NOT AN INVARIANT (maintainer override,
// 2026-08-24). Nothing in this build asserts that a starting purse can afford a
// rod, a berth, or both, and that is deliberate: 0.12 ships no income mechanic,
// nobody is required to sleep in a rented berth, and income arrives in later
// releases. The rod-against-berth fork is a PLAYER's choice and the build
// declines to have an opinion about it. What a tuner should know while moving
// numbers: STARTING_PURSE 40 against a 12-coin berth and the 6-coin fantasy
// entry rod leaves room for both several times over, while the 24-credit sci-fi
// rod turns the same purse into a real decision — and a player who spends the
// purse down before buying is priced out of fishing until income lands, which is
// an accepted limitation and not a bug.
const TUNING = {
  // THE SUCCESS CURVE, one family for every cast:
  //     p = base(level) * toolMult[toolTier] * modMult[modTier]
  // where base(level) = min(baseCeil, baseAt1 + basePerLevel * (level - 1)) and
  // every tier is a RESOLVED index (PF.player.resolvedToolTier /
  // resolvedModTier), never a string off the save.
  baseAt1: 0.3, // chance at level 1 with a crude rod and no bait: a third of casts
  basePerLevel: 0.02, // added per level climbed, so level 20 sits at 0.68
  baseCeil: 0.8, // the curve's own ceiling, so no retune of the two above can promise every cast
  // One multiplier per QUALITY rung, in ladder order — crude is 1.0 because a
  // rod is the price of ENTRY and not a bonus, and the two upper rungs are live
  // numbers waiting on the content that sells them. Its length is asserted
  // against QUALITY's at boot: a ladder and a multiplier list that can disagree
  // is a silently mis-tiered curve.
  toolMult: [1, 1.15, 1.3, 1.45],
  // The modifier list is `[1, baitMult]` and only the second entry is tunable:
  // tier 0 is a BAITLESS cast, which is the baseline by definition rather than a
  // number anybody chose. Presence-based, so this is what bait is worth — not
  // what a grade of bait is worth (graded mods are L2 content).
  baitMult: 1.25,
  castMinutes: 15, // one cast = one window = this many minutes of clock, and 1440 divides by it
  // XP per successful window, keyed by the yield's TYPE — the four roles and
  // bait — and this table is the single xp authority: table entries carry no xp
  // of their own, so a rebalance happens in one place. Asserted complete at boot.
  catchXp: { "catch-common": 1, "catch-uncommon": 2, "catch-rare": 5, "catch-prize": 10, [BAIT_TYPE]: 1 },
  // The wrap-up tell's size budget, in graphemes. It renders WHOLE DAYS or none,
  // so this is floor-asserted at boot against one maximum-shape day
  // (CAPS.ledgerPerDay × CAPS.ledgerChars = 3,000) — under that floor the tell
  // renders zero days, the burn advances through nothing, and the flush stalls
  // forever. It is set AT the floor on purpose: one max-shape day is guaranteed
  // to render, an ordinary day is a small fraction of it so several fit, and a
  // prompt part is not a place to spend more than it has to.
  ledgerTellChars: 3000,
};

PF.economy = {
  ITEM_TYPES,
  PRICES,
  STARTING_PURSE,
  STARTER_BAIT,
  ROD_TIERS,
  CATCH_ROLES,
  BAIT_TYPE,
  SKILL_VERBS,
  CATCH_TABLES,
  SPOT_TAGS,
  DAYPARTS,
  TUNING,
  rodPriceKey,

  /** The theme's skin table, falling back to the default theme rather than
   *  throwing: a save can name a theme this build no longer ships.
   *
   *  OWN-PROPERTY ONLY, exactly as price() reads its own table and simFromSaved
   *  reads `world.zones`. `world.theme` comes off untrusted save JSON, and a
   *  nullish-coalescing lookup never reaches its fallback for "constructor" or
   *  "toString": the prototype answers with something non-nullish, and then every
   *  economy call for that save TypeErrors on `.currency` instead of quietly
   *  rendering in the default theme's words. */
  _skin(world) {
    const theme = typeof world?.theme === "string" ? world.theme : "cozy-village";
    return Object.prototype.hasOwnProperty.call(ITEM_SKINS, theme) ? ITEM_SKINS[theme] : ITEM_SKINS["cozy-village"];
  },

  /** What this world calls its money. */
  currency(world) {
    return this._skin(world).currency;
  },

  /** What this world calls the person playing it — the character sheet's themed
   *  generic label (plan §2.8), standing in until the engine exposes a persona
   *  name and avatar. */
  playerLabel(world) {
    return this._skin(world).player;
  },

  /** A verb's word book: its display name and the words for its two equipment
   *  slots. An UNKNOWN verb still renders, slug-derived, exactly as describe()'s
   *  unknown type does one method down — a save can carry a skill row written by
   *  a newer build, and the sheet showing it as "flying" is a display fact
   *  rather than a hole. */
  verbSkin(world, verb) {
    const name = typeof verb === "string" ? verb : "";
    const book = this._skin(world).verbs;
    if (Object.prototype.hasOwnProperty.call(book, name)) return book[name];
    return { name: name.replace(/[-_]/g, " "), tool: "tool", mod: "modifier" };
  },

  /** `12 coins`, `1 coin`. The purse chip and every price string go through this
   *  so a sci-fi colony never charges anybody "coins". */
  money(world, amount) {
    const n = Number.isFinite(amount) ? Math.max(0, Math.trunc(amount)) : 0;
    const { one, many } = this.currency(world);
    return `${n} ${n === 1 ? one : many}`;
  },

  /** A pouch row's display name. An UNKNOWN type still renders — a newer build's
   *  item, or one a GM channel grants later, reads as its own tag rather than
   *  vanishing from the purse. The completeness assertion below is what keeps
   *  every type this build can actually produce out of that fallback.
   *
   *  `k` IS TWO VOCABULARIES AND THIS IS WHERE THAT SHOWS (plan §2.2). On a
   *  TOOL it is a tier and reads as an adjective — "crude rod". On a catch or a
   *  bait it is a VARIANT SLUG and it is the name: the type is "catch-common"
   *  and the thing in the bag is a carp, so the lookup keys on `k` and the
   *  type's own word is only the fallback for a row that carries none. The old
   *  path put the two together and would have rendered "worms bait", which is
   *  why it is now scoped rather than general — and why a row whose type is
   *  neither takes no prefix at all, `k` there being a slug nobody has claimed. */
  describe(world, item) {
    const t = typeof item === "string" ? item : typeof item?.t === "string" ? item.t : "";
    if (!t) return "";
    const skin = this._skin(world);
    // The items map takes an own-property read for the same reason the skin table
    // does one line up: `t` is a pouch row's type off untrusted save JSON, and
    // `items["constructor"]` resolves to a function whose `.name` is "Object".
    const typeSkin = Object.prototype.hasOwnProperty.call(skin.items, t) ? skin.items[t] : null;
    const typeName = typeSkin ? typeSkin.name : t.replace(/[-_]/g, " ");
    const k = typeof item === "object" && typeof item?.k === "string" ? item.k : "";
    let base = typeName;
    if (PF.player.TOOL_TYPES.has(t)) base = k ? `${k} ${typeName}` : typeName;
    else if (VARIANT_TYPES.has(t) && k) {
      // A VARIANT NO SKIN KNOWS still renders, slug-derived, exactly as an
      // unknown TYPE does one line up — a hostile save row or a newer build's
      // table is a display problem and never a throw.
      base = Object.prototype.hasOwnProperty.call(skin.variants, k) ? skin.variants[k] : k.replace(/[-_]/g, " ");
    }
    const flourish = this._flourish(world, t, k);
    return flourish ? `${flourish} ${base}` : base;
  },

  /** The seeded display override, keyed `(seed, t, k)` uniformly (plan §2.2).
   *
   *  Keyed on the WORLD's seed and not on the moment, because pouch rows MERGE:
   *  there is one carp row holding nine carp, so a per-catch epithet would have
   *  nothing to live on. Per world per variant is the shape the data can carry —
   *  this valley's carp are the muddy ones and the next world's are not — and it
   *  is computable wherever describe() runs, so the purse chip, the ledger and
   *  the sheet all say the same thing without anybody storing it.
   *
   *  Returns "" when the theme ships no pool for that type, which is the
   *  skin-name fallback: rods, bait and keys read plainly, and a pool added later
   *  is a content change and not a mechanism one. */
  _flourish(world, t, k) {
    const pools = this._skin(world).flourishes;
    if (!Object.prototype.hasOwnProperty.call(pools, t)) return "";
    const pool = pools[t];
    if (!Array.isArray(pool) || !pool.length) return "";
    const seed = Number.isFinite(world?.seed) ? world.seed >>> 0 : 0;
    return pool[PF.hashStr(`${seed}:${t}:${k}`) % pool.length];
  },

  /** The catch table for a world's theme and a spot's tag, or null when the tag
   *  is not one that holds water. Own-property both ways: `world.theme` and a
   *  registry row's `tag` are both strings this file did not write. */
  catchTable(world, tag) {
    const theme = typeof world?.theme === "string" ? world.theme : "cozy-village";
    const byTheme = Object.prototype.hasOwnProperty.call(CATCH_TABLES, theme)
      ? CATCH_TABLES[theme]
      : CATCH_TABLES["cozy-village"];
    if (typeof tag !== "string" || !Object.prototype.hasOwnProperty.call(byTheme, tag)) return null;
    return byTheme[tag];
  },

  /** A table entry's pouch TYPE. `role ?? BAIT_TYPE` in one place, so the xp
   *  award, the row identity and the ledger line cannot disagree about what a
   *  roleless entry is. */
  entryType(entry) {
    return typeof entry?.role === "string" && entry.role ? entry.role : BAIT_TYPE;
  },

  /** The bait variant a theme's first rod purchase throws in. THE THEME'S FIRST
   *  bait entry, scanned in SPOT_TAGS order — so the starter stack merges with
   *  the bait the player then fishes out of that same water instead of sitting
   *  beside it as a second row of a thing they already have. Null for a theme
   *  whose tables carry no bait at all, which the boot assertion refuses. */
  starterBait(world) {
    for (const tag of SPOT_TAGS) {
      for (const entry of this.catchTable(world, tag) ?? []) {
        if (this.entryType(entry) === BAIT_TYPE) return entry.variant;
      }
    }
    return null;
  },

  /** The price of a named thing in this world, or null when it is not for sale
   *  here. Null rather than a default number: a caller that cannot find a price
   *  must refuse the sale, not invent one. */
  price(world, what) {
    const theme = typeof world?.theme === "string" ? world.theme : "cozy-village";
    // Own-property BOTH ways. The inner read always was; the table read was not,
    // and `PRICES["constructor"]` resolving to a function meant a save naming a
    // prototype key priced nothing at all — every sale refused, with no way for
    // the player to tell that from a world that simply sells no rooms.
    const table = Object.prototype.hasOwnProperty.call(PRICES, theme) ? PRICES[theme] : PRICES["cozy-village"];
    const value = Object.prototype.hasOwnProperty.call(table, what) ? table[what] : null;
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
  },

  // ── The berth (S3's money sink, P1's bed) ──────────────────────────────────

  /** The keeper standing in the room the player is in, or null.
   *
   *  The offer's SECOND path, and the one the second live playtest was missing.
   *  `sim.nearNpc` is the single NEAREST NPC within 26px — a tile and a half — so
   *  keying the whole offer on it meant the room could be the settlement's only
   *  inn, the keeper could be standing in it, and the button was still hidden
   *  because the player was closer to the guard by the door. The maintainer stood
   *  inside The Amber Hearth with Mira a few tiles off and had Talk, Wait and
   *  Keyboard and nothing else.
   *
   *  ONLY EVER THROUGH THE ZONE MARK, which is what keeps this honest: the
   *  compiler puts that mark up only when somebody took the keeper's mark that
   *  pairs with it (20-world, both-marks-or-neither), so a hostless gathering has
   *  no mark and this path can never find one. And the keeper has to actually BE
   *  here — `zone.npcs` is where 30-sim's schedules splice people, so an inn the
   *  daypart emptied is an empty inn and quotes nothing.
   *
   *  Own-property, like every other read in this file: `sim.zoneId` comes off
   *  untrusted save JSON and `zones["constructor"]` is not a room. */
  _keeperInRoom(sim) {
    const zoneId = sim?.zoneId;
    const zones = sim?.world?.zones;
    if (typeof zoneId !== "string" || !zones || !Object.prototype.hasOwnProperty.call(zones, zoneId)) return null;
    const zone = zones[zoneId];
    if (zone?.lodging !== true) return null;
    for (const npc of zone.npcs ?? []) if (npc?.lodging === zoneId) return npc;
    return null;
  },

  /** THE KEEPER, whichever way you found them: reach first, then the room. Both
   *  halves of the rule, in one place, because the keeper now sells two things.
   *
   *  Reach first, so a keeper you are standing next to always answers for their
   *  own room even when you are both inside somebody else's; the room second,
   *  because being inside the inn is the other half of the same fact and it is
   *  the half a player actually discovers (see _keeperInRoom for the playtest
   *  that found it).
   *
   *  EXTRACTED RATHER THAN COPIED (plan §2.4). The berth and the rod are quoted
   *  by the same person and their resolutions must not drift: a second copy of
   *  this line would be a build where the innkeeper lets you a room from across
   *  the counter and refuses to sell you a rod from the same spot. */
  _keeper(sim) {
    const inReach = sim?.nearNpc;
    return typeof inReach?.lodging === "string" && inReach.lodging ? inReach : this._keeperInRoom(sim);
  },

  /** Is there a berth on offer where the player is standing, and what would it
   *  cost? Describes only — it never charges anything, so the HUD can call it
   *  every frame and a caller can render the refusal instead of hiding the
   *  button. Returns { available, reason, keeper, zoneId, price, home }.
   *
   *  The offer follows the PERSON: `npc.lodging` is stamped on the keeper of the
   *  settlement's gathering (20-world), so an innkeeper standing in the square at
   *  noon can still let you a room, which is what a keeper is.
   *
   *  …and it follows the ROOM as well (see _keeperInRoom). Being inside the inn
   *  is the other half of the same fact, and it is the half a player actually
   *  discovers: you walk in, and the room is offering. Reach first, so a keeper
   *  you are standing next to always answers for their own room even when you are
   *  both inside somebody else's. */
  berthOffer(core) {
    const sim = core?.sim;
    const world = sim?.world;
    const no = (reason) => ({ available: false, reason, keeper: null, zoneId: null, price: null, home: null });
    const npc = this._keeper(sim);
    if (!sim || !npc) return no("no-keeper");
    if (!world?.zones || !Object.prototype.hasOwnProperty.call(world.zones, npc.lodging)) return no("no-lodging");
    const price = this.price(world, "berth");
    if (price === null) return no("not-for-sale");
    const player = PF.player.get(core);
    if (!player) return no("no-player");
    const offer = { available: true, reason: null, keeper: npc, zoneId: npc.lodging, price, home: player.home };
    // Already the player's room: refused rather than sold again. Renting the same
    // berth twice is not a second room, it is the same room and a lighter purse.
    if (player.home === npc.lodging) return { ...offer, available: false, reason: "already-yours" };
    if ((player.pouch?.money ?? 0) < price) return { ...offer, available: false, reason: "cannot-afford" };
    return offer;
  },

  /** Take the room. Every effect goes through a SHIPPED mutator, in an order that
   *  cannot half-charge anybody:
   *    1. re-read the offer (the HUD's copy is a frame old and the player may
   *       have walked away, or spent the money on something else since);
   *    2. `award({ money: -price })` — the purse pays. It is deliberately NOT
   *       `take()`, which is the ITEM verb; money has one mutator and this is it.
   *       award() FLOORS at zero rather than refusing, which is exactly why the
   *       affordability test is the caller's job and is made above, before a
   *       single field moves;
   *    3. `setHome(zoneId)` — the anchor. A sealed zone id ("z4") or the legacy
   *       "inn", never a minted `h{n}`, which setHome refuses on its own;
   *    4. `grant("lodging-key")` — the receipt, and the pouch's first real row;
   *    5. `log()` — the day-ledger line P5 will summarise;
   *    6. `bump()` — the keeper remembers. SETTLEMENT-scoped (plan §2: rel keys
   *       are per settlement, not per room), so renting twice does not create two
   *       people with one name.
   *  Returns { ok, reason, price, zoneId }. */
  rentBerth(core, gen) {
    const offer = this.berthOffer(core);
    if (!offer.available) return { ok: false, reason: offer.reason, price: offer.price, zoneId: offer.zoneId };
    const sim = core.sim;
    const world = sim.world;
    const paid = PF.player.award(core, { money: -offer.price }, gen);
    // The fence, the gate, or a chat switch under us: award() is the first verb
    // that could refuse, and nothing after it has run.
    if (!paid) return { ok: false, reason: "refused", price: offer.price, zoneId: offer.zoneId };
    PF.player.setHome(core, offer.zoneId, gen);
    PF.player.grant(core, { t: "lodging-key", k: "" }, 1, gen);
    const place = world.zones[offer.zoneId]?.name ?? "the inn";
    PF.player.log(core, `Took a berth at ${place} for ${this.money(world, offer.price)}.`, sim.day, gen);
    PF.player.bump(core, world.startZone, offer.keeper.name, { t: 1, s: `Let you a berth at ${place}.` }, gen);
    return { ok: true, reason: null, price: offer.price, zoneId: offer.zoneId };
  },

  // ── Sleep (what the berth is FOR) ──────────────────────────────────────────

  /** Is there a bed where the player is standing? Describes only, so the HUD can
   *  call it every frame. Returns { available, reason, bed, zoneId }.
   *
   *  BED-GATED ON THE HOME ANCHOR, which is the same fact rentBerth wrote: the
   *  anchor IS the lodging zone the player holds a berth in (`setHome(zoneId)`),
   *  so "in your home zone" and "in a lodging zone you have paid for" are one
   *  test and not two. A homeless player has nowhere to sleep — the §5
   *  never-flush class, accepted and stated — and a minted `{minted:true}` anchor
   *  names no zone to stand in, so it is not one either.
   *
   *  `bed` is the render test the button gates on, exactly as `spot` is the fish
   *  button's and `price !== null` is the berth's: a refusal that still says
   *  there is a bed here is about the MOMENT (mid-conversation, mid-stream) and
   *  belongs on screen saying so; one that says there is no bed is about the
   *  place, and there is nothing to show. */
  sleepOffer(core) {
    const sim = core?.sim;
    const no = (reason) => ({ available: false, reason, bed: false, zoneId: null });
    if (!sim) return no("no-sim");
    if (PF.save?.gateHolds?.(core)) return no("gate-held");
    const player = PF.player.get(core);
    if (!player) return no("no-player");
    const home = typeof player.home === "string" ? player.home : "";
    if (!home || home !== sim.zoneId) return no("no-bed");
    const offer = { available: true, reason: null, bed: true, zoneId: home };
    // Walk only, like every other clock mover: sleeping through a conversation
    // would move the person being talked to.
    if (sim.mode !== "walk") return { ...offer, available: false, reason: "wrong-mode" };
    // …and never under a turn that is still being written. Sleep sends nothing,
    // so this is not about the pipeline: it is that the hours would pass under
    // narration the player has not read yet (the Talk verb's own rule).
    if (core.host?.isStreaming) return { ...offer, available: false, reason: "streaming" };
    return offer;
  },

  /** Sleep until the next occurrence of a daypart, and stage what that finished.
   *
   *  SENDS NOTHING, which is the whole shape of it: no turn, no narration, no
   *  await. What it leaves behind is `intro.ledgerOwed`, and the next turn the
   *  player sends for their OWN reasons carries the wrap-up (plan §2.6, ruling 1).
   *  That is why there is no `!PF.spatial.pending` guard here: sleeping under an
   *  in-flight send is safe, because staging only ever RAISES the marker and the
   *  in-flight burn's guard reads live and still passes for its smaller day.
   *
   *  The mover is `waitUntil` — the rest action's jump, which pre-rolls the day
   *  when the target is behind the clock and re-places everybody on arrival — and
   *  not `advanceMinutes`, which takes minutes rather than a time of day.
   *
   *  Staging reads the clock AFTER the advance and takes the max (30-sim
   *  `stageLedgerOwed`). Returns { ok, reason, day, clockMin, owed }.
   *
   *  EVERY REFUSAL IS THE SAME SHAPE, and it is the NOTHING-HAPPENED one that
   *  `fish()` uses beside it: `reason` carries which refusal it was and the
   *  numbers carry zero, because nothing moved. The reasons are distinct on
   *  purpose; the numbers must not be, or a caller reading `day` learns the KIND
   *  of refusal by accident and reads a live clock off a call that spent no
   *  minutes. */
  sleep(core, target) {
    const no = (reason) => ({ ok: false, reason, day: 0, clockMin: 0, owed: 0 });
    const offer = this.sleepOffer(core);
    if (!offer.available) return no(offer.reason);
    const sim = core.sim;
    if (!sim.waitUntil(target)) return no("unknown-target");
    const owed = sim.stageLedgerOwed();
    // The Wait precedent (70-hud): a clock mover that does not flag the save
    // loses its hours on reload, and this one also has a marker to lose.
    core.markDirty?.();
    return { ok: true, reason: null, day: sim.day, clockMin: sim.clockMin, owed };
  },

  // ── The rod (the keeper's second trade) ────────────────────────────────────

  /** The rung the player has already climbed: the MAX over pouch rows typed
   *  `rod` of `resolvedToolTier(k)`, or null when there is no rod row at all.
   *
   *  POUCH-ONLY, and derived — nothing anywhere writes a "rods bought" field
   *  (plan §2.4). Auto-equip guarantees an equipped rod has a pouch row behind
   *  it, and the pouch is world-free while rods are unremovable in 0.12, so a
   *  severance can never resurrect a rung already climbed.
   *
   *  Through the resolver and not `indexOf`: a hostile `k` ("legendary") clamps
   *  to 0 and the ladder goes on quoting `decent`, which is benign and is what
   *  the whole resolve-at-read discipline is for. NULL is a different answer from
   *  0 — no rod at all against a crude one — and the no-rod refusal is exactly
   *  that absence. */
  rodTier(player) {
    let best = null;
    for (const row of player?.pouch?.items ?? []) {
      if (row?.t !== "rod") continue;
      const tier = PF.player.resolvedToolTier(row.k);
      if (best === null || tier > best) best = tier;
    }
    return best;
  },

  /** What the keeper would sell you next, and what it costs. Describes only, so
   *  the HUD can call it every frame. Returns { available, reason, keeper, tier,
   *  price }.
   *
   *  ONE BUTTON, ONE LADDER: the offer quotes the next rung the player LACKS —
   *  no rod quotes `crude`, a crude owner quotes `decent`, and a decent-or-better
   *  owner is quoted nothing and the button VANISHES. That last part is a stated
   *  divergence from the berth button's never-vanish rule: a berth is a thing you
   *  can want again tomorrow, while rod ownership is global and permanent, and a
   *  forever-dimmed chip saying "you already have one" is dead chrome.
   *
   *  Cannot-afford is the berth's own idiom instead — shown, dimmed, still
   *  quoting the price, because a control that disappears when the purse runs
   *  short teaches the player nothing about what to save for.
   *
   *  POUCH HEADROOM IS CHECKED HERE, with the arity the purchase actually needs:
   *  a crude rod arrives with a starter bait stack, so it is TWO new rows unless
   *  the player somehow already holds bait, and a decent rod is one. This
   *  pre-check is what makes buyRod's no-rollback shape sound — grant() cannot be
   *  allowed to refuse after award() has already charged. */
  rodOffer(core) {
    const sim = core?.sim;
    const world = sim?.world;
    const no = (reason) => ({ available: false, reason, keeper: null, tier: null, price: null });
    const npc = this._keeper(sim);
    if (!sim || !npc) return no("no-keeper");
    const player = PF.player.get(core);
    if (!player) return no("no-player");
    const owned = this.rodTier(player);
    const tier = owned === null ? ROD_TIERS[0] : ROD_TIERS[owned + 1];
    if (!tier) return no("top-of-ladder");
    const price = this.price(world, rodPriceKey(tier));
    if (price === null) return no("not-for-sale");
    const offer = { available: true, reason: null, keeper: npc, tier, price };
    const items = player.pouch?.items ?? [];
    const rows = owned === null ? (items.some((row) => row?.t === BAIT_TYPE) ? 1 : 2) : 1;
    if (items.length + rows > PF.player.CAPS.items) return { ...offer, available: false, reason: "pouch-full" };
    if ((player.pouch?.money ?? 0) < price) return { ...offer, available: false, reason: "cannot-afford" };
    return offer;
  },

  /** Bind the best tool of a type to a verb after an acquisition (plan §2.4).
   *  Best = the highest QUALITY index the pouch holds. Bait NEVER auto-equips —
   *  the mod slot is the fishing verb's own per-session act, not a standing
   *  preference — and a catch never equips at all.
   *
   *  THE SCOPING IS ENFORCED HERE AND NOT BY THE MUTATOR. equip() validates by
   *  item TYPE and not by slot: it refuses a graded row whose `k` is off the
   *  ladder and is otherwise perfectly willing to put bait in a `tool` slot. So
   *  the call site is what keeps tools in tool slots, and this one refuses
   *  outright any type QUALITY does not grade rather than trusting a check that
   *  is not being made. A pouch holding only an ungradable rod equips nothing and
   *  fishes at the floor, which is the same answer from either end. */
  _autoEquipTool(core, verb, type, gen) {
    if (!PF.player.TOOL_TYPES.has(type)) return false;
    const player = PF.player.get(core);
    let best = null;
    for (const row of player?.pouch?.items ?? []) {
      if (row?.t !== type || !PF.player.QUALITY.includes(row.k)) continue;
      if (best === null || PF.player.resolvedToolTier(row.k) > PF.player.resolvedToolTier(best)) best = row.k;
    }
    if (best === null) return false;
    return PF.player.equip(core, verb, "tool", { t: type, k: best }, gen);
  },

  /** Buy the rod the button is offering. rentBerth's shape, for rentBerth's
   *  reason — every effect goes through a shipped mutator in an order that cannot
   *  half-charge anybody:
   *    1. re-read the offer (the HUD's copy is a frame old);
   *    2. `award({ money: -price })` — the purse pays, and it is the ONLY thing
   *       that can refuse after the pre-checks, with nothing after it having run;
   *    3. `grant` the rod, plus the starter bait stack on the FIRST purchase
   *       ("line and tackle included"), at the theme's own first bait slug so it
   *       merges with what the player then fishes up;
   *    4. auto-equip, scoped to tools;
   *    5. `log()` — the day-ledger line the wrap-up will tell;
   *    6. `bump()` — the keeper remembers, settlement-scoped like every other.
   *  Nothing is written to `bought`: that map is world-bound shop DEPLETION and
   *  0.12 ships no shop stock, exactly as rentBerth writes none.
   *
   *  NEVER FORCED. This is a proximity button and nothing else — no modal, no
   *  quest gate, and nothing in the package depends on rod ownership. Skipping
   *  the first settlement's offer costs nothing: the ladder is a stateless
   *  derived read, so any keeper anywhere sells the same next rung later.
   *
   *  Returns { ok, reason, price, tier, bait }. */
  buyRod(core, gen) {
    const offer = this.rodOffer(core);
    // ONE SHAPE ON EVERY RETURN, `bait` included: this branch and the refusal
    // after award() below are the same verb refusing the same purchase, and a
    // caller asking what came with the rod should not get `undefined` from one
    // of them and `null` from the other.
    if (!offer.available) return { ok: false, reason: offer.reason, price: offer.price, tier: offer.tier, bait: null };
    const sim = core.sim;
    const world = sim.world;
    const paid = PF.player.award(core, { money: -offer.price }, gen);
    if (!paid) return { ok: false, reason: "refused", price: offer.price, tier: offer.tier, bait: null };
    PF.player.grant(core, { t: "rod", k: offer.tier }, 1, gen);
    let bait = null;
    if (offer.tier === ROD_TIERS[0]) {
      bait = this.starterBait(world);
      if (bait) PF.player.grant(core, { t: BAIT_TYPE, k: bait }, STARTER_BAIT, gen);
    }
    this._autoEquipTool(core, "fishing", "rod", gen);
    const named = this.describe(world, { t: "rod", k: offer.tier });
    PF.player.log(
      core,
      `Bought a ${named} from ${offer.keeper.name} for ${this.money(world, offer.price)}.`,
      sim.day,
      gen,
    );
    PF.player.bump(core, world.startZone, offer.keeper.name, { t: 1, s: `Sold you a ${named}.` }, gen);
    return { ok: true, reason: null, price: offer.price, tier: offer.tier, bait };
  },

  // ── Fishing (plan §2.1) ────────────────────────────────────────────────────
  // WHY THE VERB LIVES IN THIS FILE. It is the same shape as rentBerth: content
  // (the tables, TUNING, the words) plus an OFFER that describes and a VERB that
  // mutates, holding no state of its own and putting everything durable through
  // a shipped mutator. 58-player is the state BLOCK and deliberately ships no
  // verbs; 30-sim loads before both and could not see either. So it goes beside
  // the other transaction, and the file header names it.
  //
  // A CAST IS ONE WINDOW. `castWindow = floor(clockMin / castMinutes)`, and the
  // window's identity — its day and its index — is read BEFORE the clock moves,
  // so the roll belongs to the slice of time it was spent in.
  //
  // SYNCHRONOUS AND ATOMIC. Advance, roll, grant, award, accumulate, in one pass:
  // no await, no cutscene, nothing that can be interleaved with a chat switch
  // half-way through a cast. The GM hears about none of it here — outcomes reach
  // the prompt only through the sleep-recap flush (Ruling 1, M10).
  //
  // REFUSAL VALUES, each distinct, all of them read before a single minute is
  // spent:
  //   gate-held      — a world nobody has entered has no water in it yet.
  //   wrong-mode     — walk only, like every other clock mover.
  //   not-near-water — no registry row under the player's hand, or one whose tag
  //                    is not a kind that holds water.
  //   no-rod         — REACHABLE and deliberately so (M8's amendment): the
  //                    button stays visible for a rodless player and answers with
  //                    a themed hint pointing at the keeper who sells one, which
  //                    is what makes the mechanic discoverable instead of
  //                    invisible.
  //   pouch-full     — at the row cap only MERGES can land, so a session would
  //                    spend real hours to be told nothing new. Refused up front
  //                    rather than half-working. (Conservative on purpose: a
  //                    merge would still succeed. The mid-loop refusal below is
  //                    the other end of the same cap and does not refuse the
  //                    session.)
  //   unknown-target — a CALLER error and not a player-facing one; the menu can
  //                    only produce the four daypart words or none at all.
  //   no-player      — the same class, and listed rather than folded into one of
  //                    the five above: there is no player block on this sim at
  //                    all, which Sim's constructor and every restore path make
  //                    unreachable in play. Like unknown-target it is answered by
  //                    the HUD's GENERIC line (70-hud fishRefusal) instead of
  //                    copy of its own, because a control that spoke its own
  //                    sentence here would be writing player-facing words about a
  //                    state no player can be in.

  /** The bait stack a session would slot: the first live bait row in the pouch.
   *  The mod slot is a per-session SELECTION and not a standing preference, so
   *  there is nothing stored to consult and this is the whole of the choice. */
  _baitRow(player) {
    for (const row of player?.pouch?.items ?? []) {
      if (row?.t === BAIT_TYPE && (row.q ?? 0) > 0) return row;
    }
    return null;
  },

  /** Anybody in this world who lets rooms, near or not. The no-rod hint points at
   *  the vendor, and the vendor is worth naming even when the player is standing
   *  at a pond three zones away from them. */
  _anyKeeper(sim) {
    const near = this._keeper(sim);
    if (near) return near;
    for (const zoneId of Object.keys(sim?.world?.zones ?? {})) {
      for (const npc of sim.world.zones[zoneId].npcs ?? []) {
        if (typeof npc?.lodging === "string" && npc.lodging) return npc;
      }
    }
    return null;
  },

  /** "You need a rod — the innkeeper sells one." THEMED, and interpolating the
   *  keeper's COMPILED role rather than a hardcoded word, because a sci-fi colony
   *  has no innkeeper and the brief is what decides what it does have (the Talk
   *  sender's `npc.role` idiom, 90-element). A world with nobody letting rooms
   *  drops the clause rather than inventing a vendor. */
  rodHint(core) {
    const sim = core?.sim;
    const template = this._skin(sim?.world).hints.noRod;
    const role = this._anyKeeper(sim)?.role;
    if (typeof role !== "string" || !role) return template.replace(/ — .*$/, ".");
    return template.replace("{role}", role);
  },

  /** Is there water to fish where the player is standing, what would a session
   *  spend, and what is stopping it? Describes only — no clock moves, nothing is
   *  taken — so the HUD can call it every frame.
   *
   *  Returns { available, reason, spot, tag, bait, hint }. `spot` is the render
   *  test the button gates on, exactly as `price !== null` is the berth's: a
   *  refusal that still names a spot is one the player should SEE, because it is
   *  a refusal about them rather than about the place. */
  fishOffer(core) {
    const sim = core?.sim;
    const no = (reason) => ({ available: false, reason, spot: null, tag: null, bait: null, hint: "" });
    if (PF.save?.gateHolds?.(core)) return no("gate-held");
    if (!sim || sim.mode !== "walk") return no("wrong-mode");
    const spot = sim.nearFeature;
    if (!spot || !SPOT_TAGS.includes(spot.tag)) return no("not-near-water");
    const player = PF.player.get(core);
    if (!player) return no("no-player");
    const at = { available: true, reason: null, spot, tag: spot.tag, bait: this._baitRow(player), hint: "" };
    if (this.rodTier(player) === null) return { ...at, available: false, reason: "no-rod", hint: this.rodHint(core) };
    if ((player.pouch?.items ?? []).length >= PF.player.CAPS.items)
      return { ...at, available: false, reason: "pouch-full" };
    return at;
  },

  /** Slot the session's bait, or clear the slot. The verb's own per-session act
   *  (plan §2.4): there is no standing preference and no extra UI, so this is
   *  where the slot and the pouch are reconciled — a slot pointing at a stack
   *  that is gone is cleared, and a live stack with no slot is taken up.
   *
   *  ONLY EVER BAIT INTO THE MOD SLOT. equip() validates by item type and not by
   *  slot, so the scoping is this call site's job exactly as it is the auto-equip
   *  helper's. */
  _slotBait(core, gen) {
    const player = PF.player.get(core);
    if (!player) return null;
    const slot = player.skills?.equipped?.fishing?.mod;
    if (Array.isArray(slot) && slot[0] === BAIT_TYPE) {
      const held = player.pouch.items.find((row) => row.t === BAIT_TYPE && row.k === slot[1]);
      if (held && (held.q ?? 0) > 0) return held;
    }
    const row = this._baitRow(player);
    if (!row) {
      if (slot) PF.player.equip(core, "fishing", "mod", null, gen);
      return null;
    }
    PF.player.equip(core, "fishing", "mod", { t: BAIT_TYPE, k: row.k }, gen);
    return row;
  },

  /** Draw one entry: weight × this daypart's multiplier, over the entries the
   *  player's level has opened up. Null when the level has opened nothing, which
   *  a shipped table never does (every one of them holds a level-1 entry) and a
   *  hostile one might. */
  _draw(rnd, table, level, part) {
    let total = 0;
    for (const entry of table) {
      if (level < entry.minLevel) continue;
      total += entry.weight * (entry.daypart?.[part] ?? 1);
    }
    if (!(total > 0)) return null;
    let roll = rnd() * total;
    for (const entry of table) {
      if (level < entry.minLevel) continue;
      roll -= entry.weight * (entry.daypart?.[part] ?? 1);
      if (roll < 0) return entry;
    }
    return null;
  },

  /** One batched ledger line for one DAY of a session (plan §2.1). Written for
   *  the day that just ended once the window that ended it has fully resolved,
   *  and again after the loop for the day the session's last cast began in — so a
   *  post-midnight fisher's pre-midnight catch is filed under the day it happened
   *  and the 00:30 sleep can flush it.
   *
   *  THE ACCUMULATOR CARRIES ITS OWN DAY and this reads it rather than taking one
   *  from the caller. A tally is a day's tally: filing it under a day somebody
   *  else worked out is how the crossing window's cast came to be recorded on one
   *  day and the fish it landed on the next.
   *
   *  GATE-SAFE by construction: `log()` refuses a day the flush already covers,
   *  and mid-session `flushedDay ≤ D−1` always — telling day D would need
   *  `ledgerOwed ≥ D`, which needs a completed sleep after D's midnight, which
   *  cannot have happened while the player is still standing at the water. */
  _logDay(core, world, spot, tally, gen) {
    if (!tally.windows) return false;
    const day = tally.day;
    const counts = new Map();
    for (const entry of tally.caught) {
      const key = `${this.entryType(entry)}:${entry.variant}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const casts = `${tally.windows} cast${tally.windows === 1 ? "" : "s"}`;
    if (!counts.size) return PF.player.log(core, `Fished ${spot.name} — ${casts}, nothing biting.`, day, gen);
    const named = [...counts].map(([key, n]) => {
      const [t, k] = key.split(":");
      const name = this.describe(world, { t, k });
      return n > 1 ? `${name} ×${n}` : name;
    });
    return PF.player.log(core, `Fished ${spot.name} — ${casts}: ${named.join(", ")}.`, day, gen);
  },

  /** Fish. `target` is null for one cast, or a daypart word for a session that
   *  loops windows until the clock reaches that daypart's start (overshooting by
   *  at most one window, because a cast is a whole window and not a fraction).
   *
   *  DETERMINISM. Each window seeds its own stream from
   *  `hash(seed, day, castWindow, spotId, level, toolTier, modTier)` — every one
   *  of them RESOLVED (58-player's resolvers), never a raw string off the save,
   *  so two clients that disagree about what "legendary" means still pull the
   *  same fish out of the same water on the same minute. A failed window is a
   *  fixed point escaped only by spending different time, which IS the
   *  anti-save-scum property and is stated rather than discovered.
   *
   *  BAIT PRESENCE IS READ BEFORE IT IS SPENT. The window a bait was consumed on
   *  rolls BAITED; the slot-clear that follows the last one affects the NEXT
   *  window, which then re-keys the hash at tier 0 and goes on fishing at the
   *  lower rate. Exhaustion is a continuation, never a stop.
   *
   *  MID-LOOP GRANT REFUSAL. grant() refuses only a NEW `(t,k)` row at the pouch
   *  cap — merges never refuse — so a session can meet the cap on a variant it
   *  has not caught before. That window's grant AND its award are skipped and it
   *  logs nothing; the loop continues, because the cap bounds species DIVERSITY
   *  and not the session.
   *
   *  Returns { ok, reason, hint, windows, caught, leveled, days }. */
  fish(core, target, gen) {
    const opening = this.fishOffer(core);
    if (!opening.available)
      return { ok: false, reason: opening.reason, hint: opening.hint, windows: 0, caught: [], leveled: 0, days: [] };
    const sim = core.sim;
    const world = sim.world;
    const spot = opening.spot;
    const table = this.catchTable(world, spot.tag) ?? [];
    const W = TUNING.castMinutes;
    const modMult = [1, TUNING.baitMult];

    let windows = 1;
    if (target != null) {
      const at = Object.prototype.hasOwnProperty.call(PF.DAYPART_STARTS, target)
        ? PF.DAYPART_STARTS[target]
        : undefined;
      if (at === undefined)
        return { ok: false, reason: "unknown-target", hint: "", windows: 0, caught: [], leveled: 0, days: [] };
      // The NEXT occurrence, exactly as waitUntil reads the same table: asking to
      // fish until dusk from inside dusk is asking for a day of it.
      const delta = at > sim.clockMin ? at - sim.clockMin : at + 24 * 60 - sim.clockMin;
      windows = Math.max(1, Math.ceil(delta / W));
    }

    this._slotBait(core, gen);
    const caught = [];
    const days = [];
    let leveled = 0;
    let spent = 0;
    // THE ACCUMULATOR KNOWS WHICH DAY IT IS, and that is the whole of the
    // ordering: it belongs to the day the casts in it BEGAN, which stops being
    // `sim.day` the moment one of them crosses midnight.
    let tally = { day: sim.day, windows: 0, caught: [] };

    for (let i = 0; i < windows; i++) {
      // THE WRAP, FILED AT THE TOP OF THE WINDOW AFTER IT. The previous window
      // crossed midnight, so its day is over and everything that window resolved
      // — its cast AND its fish — is already in the accumulator. Filed here and
      // not between an advance and the roll that follows it: a flush taken inside
      // a window files that window's cast under the day it began and its catch
      // under the day after, and a session of ONE such window loses the catch
      // line altogether.
      if (tally.windows && sim.day !== tally.day) {
        if (this._logDay(core, world, spot, tally, gen)) days.push(tally.day);
        tally = { day: sim.day, windows: 0, caught: [] };
      }
      const live = PF.player.get(core);
      if (!live) break; // a chat switch landed under us; the mutators would refuse anyway
      const slots = live.skills?.equipped?.fishing ?? null;
      const modSlot = Array.isArray(slots?.mod) ? slots.mod : null;
      const stack = modSlot ? live.pouch.items.find((row) => row.t === modSlot[0] && row.k === modSlot[1]) : null;
      // READ BEFORE TAKE. This is the window the bait is being spent on.
      const modTier = PF.player.resolvedModTier(modSlot, stack);
      const toolTier = PF.player.resolvedToolTier(Array.isArray(slots?.tool) ? slots.tool[1] : "");
      const level = PF.player.resolvedLevel(live.skills?.verbs?.fishing);
      const day = sim.day;
      const castWindow = Math.floor(sim.clockMin / W);
      const part = sim.daypart();

      sim.advanceMinutes(W);
      spent += W;
      tally.windows += 1;
      // THE BAIT IS SPENT for the window that was read as holding it, and the
      // slot follows the stack out rather than being left pointing at a row the
      // pouch no longer has.
      if (modTier === 1) {
        PF.player.take(core, { t: modSlot[0], k: modSlot[1] }, 1, gen);
        if (!live.pouch.items.some((row) => row.t === modSlot[0] && row.k === modSlot[1]))
          PF.player.equip(core, "fishing", "mod", null, gen);
      }

      const rnd = PF.rng(PF.hashStr(`${world.seed}:${day}:${castWindow}:${spot.id}:${level}:${toolTier}:${modTier}`));
      const base = Math.min(TUNING.baseCeil, TUNING.baseAt1 + TUNING.basePerLevel * (level - 1));
      // Unclamped on purpose: the roll is `rnd() < p` and rnd() never reaches 1,
      // so a p at or over 1 simply always lands — which is what the top of a
      // fully-equipped ladder is supposed to feel like, and is unreachable in
      // 0.12 anyway (fine and masterwork are not sold).
      const p = base * TUNING.toolMult[toolTier] * modMult[modTier];
      if (rnd() >= p) continue;
      const entry = this._draw(rnd, table, level, part);
      if (!entry) continue;
      const type = this.entryType(entry);
      // The PRIOR level, read before the award, because award() returns the new
      // one and carries no "leveled" flag of its own.
      const before = PF.player.resolvedLevel(live.skills?.verbs?.fishing);
      if (!PF.player.grant(core, { t: type, k: entry.variant }, 1, gen)) continue;
      const paid = PF.player.award(core, { xp: TUNING.catchXp[type] ?? 0, verb: "fishing" }, gen);
      if (paid?.level > before) leveled = paid.level;
      tally.caught.push(entry);
      caught.push({ t: type, k: entry.variant });
    }

    // THE LAST DAY THE SESSION TOUCHED, which is the day its last cast began in
    // and not necessarily the one the clock is showing: a session whose final
    // window crossed midnight files that window under the day before.
    if (tally.windows && this._logDay(core, world, spot, tally, gen)) days.push(tally.day);
    // EVERY PATH THAT MOVED THE CLOCK, refusals-after-advance included (the Wait
    // precedent, 70-hud): the mutators self-dirty, but a session of failed casts
    // runs no mutator at all and would otherwise lose its hours on reload.
    if (spent) core.markDirty?.();
    return { ok: true, reason: null, hint: "", windows: spent / W, caught, leveled, days };
  },

  /** The starting purse, paid when a SEALED world comes up on a block nothing has
   *  ever been written into. That is the condition, not a moment — and the
   *  difference is the whole slice-6 correction. It used to be one instant (the
   *  tail of the generation that sealed the brief), and every ordinary way of not
   *  being there for that instant cost the purse permanently: leaving the chat
   *  while generation ran, reloading between the seal and the lift, or a throw
   *  that turned the lift into a retry screen. The predicate below is idempotent,
   *  so the callers can simply ask on every path a sealed world arrives by
   *  (60-save `_installSealedWorld` and `armGate`) and let it answer.
   *
   *  NOT a default on the block, and the reason is the wire: PF.player.serialize
   *  emits every field unconditionally, so a non-zero default money would move
   *  the bytes of every save in the wild and re-write every open chat on first
   *  load. NOT a rehydration step either — restore's repairs are deliberately
   *  non-mutations.
   *
   *  UNTOUCHED MEANS THE WHOLE BLOCK, not the purse. Four tests would do while
   *  the grant was a one-shot instant; as a condition asked on every arrival it
   *  has to tell a new game apart from a VETERAN who happens to be broke, and a
   *  player who has spent down to nothing still carries their skills, the boards
   *  they finished, the people they met, the places they found and the day
   *  boundary they flushed. This is also what keeps the pre-gate interim shim from
   *  being paid, which is the case the original four were written for: a block
   *  with a real session in it crosses that seam holding exactly these fields. */
  grantStartingPurse(core) {
    const player = PF.player.get(core);
    if (!player) return false;
    const empty = (value) => !Object.keys(value ?? {}).length;
    const untouched =
      (player.pouch?.money ?? 0) === 0 &&
      !(player.pouch?.items ?? []).length &&
      !(player.ledger?.lines ?? []).length &&
      player.home === null &&
      empty(player.skills?.verbs) &&
      empty(player.skills?.equipped) &&
      empty(player.quests_done_board) &&
      empty(player.rel) &&
      empty(player.quests?.done_pack) &&
      !(player.quests?.active ?? []).length &&
      !(player.found?.zones ?? []).length &&
      empty(player.bought) &&
      (player.flushedDay ?? 0) === 0 &&
      (player.game ?? 1) === 1;
    if (!untouched) return false;
    if (!PF.player.award(core, { money: STARTING_PURSE })) return false;
    PF.player.log(core, `Arrived with ${this.money(core.sim?.world, STARTING_PURSE)} to your name.`, core.sim?.day);
    return true;
  },
};

// Registry completeness, in the placers' idiom (20-world PLACERS): every theme
// this build ships must skin every item type this build can produce, and must
// name its own money. A theme added without a skin table would otherwise ship
// silently — the fallbacks in describe()/money() are there for a SAVE naming a
// theme this build dropped, not as a licence to leave a live theme unnamed, and
// a sci-fi colony charging "coins" is exactly the out-of-place-"Maud Thatch"
// failure the maintainer called out for name books.
{
  // EVERY VARIANT ANY SHIPPED TABLE NAMES, gathered across ALL themes before any
  // one theme is checked. The pouch is world-free: a carp caught in a valley is
  // still in the bag when the same chat's next world is a colony, and a row with
  // no word there would fall to the slug fallback that exists for a HOSTILE save,
  // not for content this build ships. So the demand is on the union, not on each
  // theme's own list.
  const shippedVariants = new Set();
  for (const byTag of Object.values(CATCH_TABLES))
    for (const table of Object.values(byTag)) for (const entry of table) shippedVariants.add(entry.variant);

  for (const theme of PF.art?.themeIds?.() ?? []) {
    const skin = ITEM_SKINS[theme];
    if (!skin) throw new Error(`pixelforge: theme "${theme}" ships no item vocabulary`);
    const currency = skin.currency;
    if (!currency?.one || !currency?.many) throw new Error(`pixelforge: theme "${theme}" does not name its money`);
    for (const type of ITEM_TYPES) {
      if (!skin.items?.[type]?.name) throw new Error(`pixelforge: theme "${theme}" has no name for item "${type}"`);
    }
    for (const variant of shippedVariants) {
      if (!skin.variants?.[variant]) throw new Error(`pixelforge: theme "${theme}" has no name for "${variant}"`);
    }
    // THE REFUSAL A PLAYER IS MEANT TO ACT ON. A theme without it answers a
    // pressed button with an empty toast, which reads as a broken control rather
    // than as a mechanic with a vendor behind it — and the `{role}` slot is what
    // keeps it out of hardcoding an innkeeper into a colony.
    if (!skin.hints?.noRod?.includes("{role}"))
      throw new Error(`pixelforge: theme "${theme}" has no no-rod hint naming a vendor`);
    // THE PERSON AND THEIR VERBS, which the character sheet renders and nothing
    // else does. A theme missing either would show an empty label under the
    // portrait, or the raw block key ("fishing") where the skill's name goes —
    // the same silently-unnamed failure the item vocabulary is asserted against.
    if (!skin.player) throw new Error(`pixelforge: theme "${theme}" has no word for the person playing it`);
    for (const verb of SKILL_VERBS) {
      const book = skin.verbs?.[verb];
      if (!book?.name || !book.tool || !book.mod)
        throw new Error(`pixelforge: theme "${theme}" does not name the "${verb}" skill and both of its slots`);
    }
    // THE 2×2, both halves. A theme with no table for a spot kind is water the
    // player can stand at and the verb cannot answer for; an EMPTY table is the
    // same hole with a shape, and it would divide by a zero weight rather than
    // refuse. The wilds `water-feature` never places today (slice-1 verify F1)
    // and its tables are still required — settlements and the legacy world reach
    // that kind, and the drop is a placement fact, not a vocabulary one.
    const byTag = CATCH_TABLES[theme];
    if (!byTag) throw new Error(`pixelforge: theme "${theme}" ships no catch tables`);
    for (const tag of SPOT_TAGS) {
      const table = byTag[tag];
      if (!Array.isArray(table) || !table.length)
        throw new Error(`pixelforge: theme "${theme}" has no catch table for "${tag}"`);
      for (const entry of table) {
        // A role has to be a ROLE. A typo mints a pouch row of a type nothing
        // skins, nothing prices and the xp table cannot pay for — and it would
        // look exactly like the deliberate roleless entry that means bait.
        if (entry.role !== undefined && !CATCH_ROLES.includes(entry.role))
          throw new Error(`pixelforge: ${theme}/${tag} has an entry with the role "${entry.role}"`);
        if (!entry.variant || typeof entry.variant !== "string")
          throw new Error(`pixelforge: ${theme}/${tag} has an entry with no variant slug`);
        // …AND NOT THE LEDGER'S OWN SEPARATOR IN IT. _logDay counts a session's
        // yields in a Map keyed `${type}:${variant}` and splits that key apart
        // again to name them, so a slug carrying a colon is truncated at it: a
        // "sea:bass" is rendered as "sea" and the wrap-up tells the player about
        // a thing that does not exist. Closed here rather than by escaping the
        // key, because a slug with punctuation in it is content nobody needs and
        // an encoding that never has to survive one is a line shorter.
        if (entry.variant.includes(":"))
          throw new Error(
            `pixelforge: ${theme}/${tag}'s "${entry.variant}" has a ":" in its slug, which is the ledger's own separator`,
          );
        if (!(typeof entry.weight === "number" && entry.weight > 0))
          throw new Error(`pixelforge: ${theme}/${tag}'s "${entry.variant}" has no positive weight`);
        // A minLevel above the ceiling is an entry NOBODY can ever draw: the draw
        // is a level test and the level stops climbing at the cap, so the row is
        // written content that no save can reach.
        if (!Number.isInteger(entry.minLevel) || entry.minLevel < 1 || entry.minLevel > PF.player.CAPS.skillLevel)
          throw new Error(
            `pixelforge: ${theme}/${tag}'s "${entry.variant}" needs level ${entry.minLevel}, outside 1..${PF.player.CAPS.skillLevel}`,
          );
        for (const [part, mult] of Object.entries(entry.daypart ?? {})) {
          // A plausible word that is not one of the four is a column that never
          // applies — silently, forever, and looking exactly like a tuned one.
          if (!DAYPARTS.includes(part))
            throw new Error(`pixelforge: ${theme}/${tag}'s "${entry.variant}" is tuned for a daypart "${part}"`);
          if (!(typeof mult === "number" && Number.isFinite(mult) && mult >= 0))
            throw new Error(`pixelforge: ${theme}/${tag}'s "${entry.variant}" has a ${part} multiplier of ${mult}`);
        }
      }
    }
    // …AND A BAIT ENTRY SOMEWHERE IN THE THEME, because the crude rod's purchase
    // throws in a starter stack whose slug is exactly this (see starterBait). A
    // theme with none would sell a rod and hand over an empty tin.
    if (!PF.economy.starterBait({ theme }))
      throw new Error(`pixelforge: theme "${theme}" ships no bait entry for a first rod to come with`);
    if (typeof PRICES[theme]?.berth !== "number")
      throw new Error(`pixelforge: theme "${theme}" has no price for a berth`);
    // EVERY RUNG THE LADDER CAN QUOTE, in every theme. A missing rod price would
    // otherwise reach the player as the keeper refusing the sale — price()
    // answers null for "not for sale here", and a rod the build means to sell
    // and forgot to price is indistinguishable from one it deliberately does
    // not stock. KEY EXISTENCE ONLY: no assertion couples these numbers to the
    // purse or to the berth (maintainer override, 2026-08-24 — income arrives
    // in later releases and berth-sleeping is optional), so what the build
    // insists on is that a quotable rung is quotable, never that it is cheap.
    for (const tier of ROD_TIERS) {
      // …and a rung has to be a rung. A tier that is not on the QUALITY ladder
      // resolves to crude at every read, so the ladder would quote a rod nobody
      // can be recorded as owning and would keep quoting it forever.
      if (!PF.player.QUALITY.includes(tier))
        throw new Error(`pixelforge: the rod ladder quotes "${tier}", which is not a quality tier`);
      if (typeof PRICES[theme]?.[rodPriceKey(tier)] !== "number")
        throw new Error(`pixelforge: theme "${theme}" has no price for a ${tier} rod`);
    }
  }
  // THE TELL'S FLOOR. The wrap-up tell renders whole days or none, so a budget
  // under one maximum-shape day renders zero days — the burn then advances
  // through nothing, `ledgerOwed` never falls, and every sleep for the rest of
  // the save tells the player the same nothing. Asserted here rather than
  // discovered there.
  const maxShapeDay = PF.player.CAPS.ledgerPerDay * PF.player.CAPS.ledgerChars;
  if (!(TUNING.ledgerTellChars >= maxShapeDay))
    throw new Error(
      `pixelforge: TUNING.ledgerTellChars (${TUNING.ledgerTellChars}) is under one max-shape ledger day (${maxShapeDay})`,
    );
  // The xp table is the single authority, so a type missing from it is a yield
  // that awards nothing — a silent hole rather than a loud one, and the one it
  // would most likely be is `bait`, which is the yield a fresh player meets
  // first.
  for (const type of [...CATCH_ROLES, BAIT_TYPE]) {
    if (typeof TUNING.catchXp[type] !== "number") throw new Error(`pixelforge: TUNING.catchXp has no xp for "${type}"`);
  }
  // The ladder and its multipliers, pinned to the same length. They are two
  // lists in two files indexed by the same resolved number, and a short one
  // hands `undefined` to the curve — NaN chance, on the best rod in the game.
  if (TUNING.toolMult.length !== PF.player.QUALITY.length)
    throw new Error(
      `pixelforge: TUNING.toolMult has ${TUNING.toolMult.length} multipliers for ${PF.player.QUALITY.length} quality tiers`,
    );
}

// ===== 60-save.js =====
// ── Persistence ───────────────────────────────────────────────────────────────
// Two-tier, engine-version adaptive:
//   routes mode (engine #5102+) — GET/PUT /api/game/:chatId/experience-state is
//     the AUTHORITY: rows anchor to the visible message, so swipes, branches,
//     and checkpoint loads rewind the world with the story. checkRewind() polls
//     on each finished turn and rebuilds the sim when the server state moved
//     under us. Metadata stays a write-through cache (instant synchronous boot
//     + fallback if the chat later opens on an older engine).
//   metadata mode (older engines) — the Phase-1 behavior: one small `pixelforge`
//     key via the queued PATCH route, with the documented limitation that
//     timeline seams do not rewind it.
// Both: debounced, event-driven, flushed with keepalive on teardown — never
// per-frame (Android whole-blob-rewrite shape, exploration R11/R28).

// The envelope keys THIS build understands. Anything else on a restored save
// was written by a NEWER build: simFromSaved parks it on sim._envelopeExtra and
// snapshot() re-emits it. Without that, round-tripping a chat through an older
// client is data-destructive — the older read drops the fields on the floor and
// the very next flush overwrites the row without them (plan §Q1, additive-only
// by policy). Additions to the snapshot literal below MUST be added here too.
const ENVELOPE_KEYS = new Set([
  "v",
  "chatId",
  "seed",
  "theme",
  "zone",
  "x",
  "y",
  "facing",
  "clockMin",
  "day",
  "bindings",
  "intro",
  "player",
]);

// The chat-metadata key a corrupt route row's raw text is parked in before the
// repairing write replaces it (plan §Q2 row 1, Engine #5407). Bounded hard: this
// is evidence for a bug report, not a backup — the row it came from is already
// unreadable by every means the client has.
const CORRUPT_EXCERPT_KEY = "pixelforgeCorruptExcerpt";
const CORRUPT_EXCERPT_CHARS = 4_096;
// How long a successful ladder check stays authoritative. One debounce window:
// the pre-check exists so a PUT never lands on a row it has not looked at, and
// a check taken inside the window the write was scheduled in has looked at it.
const CHECK_FRESH_MS = 2500;

// OUR top-level chat-metadata key. Named rather than spelled out at each site
// because #5406 keys its write-ordinal mirror by it: the engine stamps
// `metadata[ORDINAL_MIRROR_KEY][SAVE_META_KEY]` with the ordinal of the last write
// that actually MOVED this cache, and that number is what orders the two stores.
// A drifting literal here would silently read an ordinal for a key nobody writes.
const SAVE_META_KEY = "pixelforge";
const ORDINAL_MIRROR_KEY = "metadataWriteOrdinals";

/** A USABLE write ordinal (#5406). The engine allocates positive safe integers and
 *  reports `null` for rows written before the feature, so everything else — null,
 *  absent, zero, a float, a string — is "unorderable" and every consumer below
 *  falls back to the byte ladder. Deliberately the same validation the server's own
 *  mirror reader applies: a client that accepted a value the server ignores would
 *  order its writes against a number nothing else agrees with. */
const ordinalOf = (value) => (typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null);

/** The row's `schemaVersion` column (#5102), validated exactly the way the route's
 *  own schema validates it: an integer in [1, 1,000,000]. Everything else —
 *  absent (a pre-slice-8 reader's body), `null` (the GET's no-row shape), a float,
 *  a string — is "the row does not say", and every reader treats that as no
 *  corroboration rather than as a claim. */
const schemaVersionOf = (value) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= 1_000_000 ? value : null;

// Sealed briefs this session stored, by chat id (plan §Q3, "sealed-brief in-memory
// cache on read and write sides"). Bounded: a brief is a few KB and a long session
// can visit many chats, so the oldest entry goes rather than the map growing.
const BRIEF_CACHE_MAX = 8;

// The ladder's rows and what each one MEANS at each site (plan §Q2). A table
// rather than a switch in three places: the whole finding behind slice 4 is that
// the sites disagreed about rows nobody had written down.
//   adopt  — boot-time probe:  metadata | repair | ignore | first-write | rebuild | reread | none
//   rewind — turn-edge check:  ignore | latch | rewind | reread | none
//   flush  — the write site:   proceed | block | fresh (proceed only while the
//                              last successful check is inside the window)
// `anchorCache` says whether the row may become _serverSerialized. Rows 1 and 2
// must never: a damaged row and a retired game's row are both things we are
// about to overwrite, and treating either as "what the server holds" would make
// the next honest difference look like a rewind.
const LADDER = Object.freeze({
  0: { name: "unavailable", adopt: "metadata", rewind: "none", flush: "proceed", anchorCache: false, toast: null },
  1: {
    name: "unparseable",
    adopt: "repair",
    rewind: "ignore",
    flush: "proceed",
    anchorCache: false,
    toast: "This world's saved row was damaged. It is being written fresh.",
  },
  2: { name: "foreign-game", adopt: "ignore", rewind: "ignore", flush: "proceed", anchorCache: false, toast: null },
  3: { name: "first-write", adopt: "first-write", rewind: "none", flush: "proceed", anchorCache: false, toast: null },
  4: {
    name: "lost-row",
    adopt: "first-write",
    rewind: "reread",
    flush: "block",
    anchorCache: false,
    toast: "The world rewound with the story.",
  },
  5: { name: "own-commit", adopt: "ignore", rewind: "ignore", flush: "proceed", anchorCache: false, toast: null },
  6: {
    name: "differs-unanchored",
    adopt: "rebuild",
    rewind: "latch",
    flush: "proceed",
    anchorCache: true,
    toast: null,
    // `toast` is what a REWIND CHECK says; `adoptToast` is what BOOT says, and
    // they differ on exactly this row (plan §Q2a: "the route row always wins at
    // adopt, and the player is told"). A row-6 difference found mid-session is
    // latched in silence — nothing visibly changed. The same row at boot means
    // the world the metadata just built is being replaced under them, which is
    // the one time they need the sentence.
    adoptToast: "The world rewound with the story.",
  },
  7: {
    name: "differs-anchored",
    adopt: "rebuild",
    rewind: "rewind",
    flush: "block",
    anchorCache: true,
    toast: "The world rewound with the story.",
    adoptToast: "The world rewound with the story.",
  },
  8: { name: "same", adopt: "none", rewind: "latch", flush: "proceed", anchorCache: true, toast: null },
  9: { name: "get-failed", adopt: "none", rewind: "none", flush: "fresh", anchorCache: false, toast: null },
});

// Process-monotonic write sequence, deliberately NOT reset per chat. Every one
// of OUR completed PUTs bumps it; a GET records the value it was issued at. A
// response still in flight across our own write read a row that predates the
// one we just wrote, so adopting it as authority would rewind the world to a
// state we ourselves superseded. Infrastructure for the decision ladder
// (plan §Q2) — checkRewind is its one consumer today, more arrive with it.
let _writeSeq = 0;

// Retry backoff for a transient write failure. Today a failed PUT waits for
// some UNRELATED future dirty event (a turn edge, a zone change, 30s of
// walking) — and in a quiet moment there is no such event, so the write is
// simply lost with a console warning. The ladder is bounded: after the last
// rung the session falls back to exactly that trigger-driven behavior rather
// than polling a dead server forever.
const FLUSH_BACKOFF_MS = [2500, 5000, 10_000, 30_000, 60_000];
const FLUSH_BACKOFF_GIVEUP = 8;
// WALL 1, and it is the ORDINARY path's only one: the Engine's per-row ceiling.
// The route 422s above 262,144 chars, so this mirrors it exactly — the local
// pre-flight exists to keep that 422's retry loop unreachable and for no other
// reason. It was 32,768 (maintainer ruling, round 2: inherited caution from a
// mobile-payload worry, the same one that shrank the player caps), which refused
// perfectly savable worlds and degraded the session permanently for doing it.
const MAX_SNAPSHOT_CHARS = 262_144;
// WALL 2, and it is REAL but narrow: it binds the pagehide TEARDOWN path only.
// Teardown sends a PAIR of keepalive requests in routes mode, and the Fetch
// standard caps TOTAL in-flight keepalive body bytes at 64 KiB (65,536) per
// origin — the whole pair against one quota, not one allowance each. So the
// teardown wall is 2 × the UTF-8 byte length of the snapshot, plus the two JSON
// wrappers (`{"state":…}` and `{"pixelforge":…}`, ~26 bytes together) and
// whatever else the page has in flight at unload. 57,000 leaves ~8.5 KB of that
// headroom. This is a browser constraint, not a policy, and it is why an
// ordinary flush and a teardown flush are bounded by different numbers: an
// ordinary flush is bounded by the server cap alone.
const KEEPALIVE_PAIR_BUDGET_BYTES = 57_000;
// Re-probe cadence while a probe FAILURE pinned the session to metadata mode
// (plan §Q2a): a transient 500 at boot otherwise costs timeline rewind for the
// entire session, because adopt() short-circuits on mode !== null forever.
const REPROBE_INTERVAL_MS = 60_000;
// …and the cadence is bounded for the same reason the write ladder is: a route
// that has answered wrong eight times running is not coming back inside this
// session, and a minute-timer asking forever is a background request leak.
const REPROBE_GIVEUP = 8;

PF.save = {
  _timer: 0,
  /** The debounce and the retry ladder share _timer (a busy player must not be
   *  able to reset a backoff to 2.5s on every zone change). This says which of
   *  the two the live timer is, so a flush from any other trigger can decline to
   *  cancel a rung: the ladder has to measure ELAPSED time, not requested time. */
  _timerIsBackoff: false,
  _lastSerialized: null,
  _flushChain: null,
  /** The next write goes up whatever the dedupe caches say, and only the write
   *  that CONSUMES it clears it. Promotion out of a pinned metadata session sets
   *  it: `_lastSerialized = null` alone is undone by any flush already parked in
   *  an await, which then reassigns the cache and cancels the promotion's first
   *  write with no trace. */
  _forceWrite: false,
  /** null until adopt() probes; then "routes" | "metadata". */
  mode: null,
  /** Serialized last-known server-side route state (ours or adopted). */
  _serverSerialized: null,
  _rewindCheckInFlight: false,
  /** Consecutive transient write failures; any success resets it. */
  _flushFailures: 0,
  /** A terminal write refusal (too large): mutations continue in memory, but
   *  nothing re-arms. Cleared by the next write that actually lands. */
  degraded: false,
  _degradeToasted: false,
  /** Metadata mode was forced by a FAILURE, not by a 404/409 mode signal —
   *  so it is worth re-probing. A genuine "no routes here" never pins. */
  _probePinned: false,
  _reprobeTimer: 0,
  _reprobeInFlight: false,
  _reprobedAfterFlush: false,
  /** Consecutive failed re-probes; bounded by REPROBE_GIVEUP. */
  _reprobeFailures: 0,
  /** The envelope-key registry, exposed so the completeness assertion below and
   *  the harness can check the list against what snapshot() actually emits. */
  _envelopeKeys: ENVELOPE_KEYS,
  /** #5406: the ordinal the engine gave OUR last successful route write on this
   *  chat, straight off the PUT echo. Per-chat, so reset() clears it. */
  _putOrdinal: null,
  /** One-shot per chat: whether a row has already been seen whose out-of-band
   *  `schemaVersion` disagreed with the block inside it (S5 slice 8). Said once,
   *  because it is a fact about how the row was WRITTEN and repeating it every
   *  turn edge would be noise. */
  _schemaVersionNoted: false,
  /** THE LOADING GATE (plan §Q3b, maintainer ruling #7). null while the chat plays;
   *  otherwise `{ chatId, state: "generating" | "failed", attempts }`.
   *
   *  A generate-configured chat does NOT enter play until its brief is sealed. The
   *  ruling that produced this is worth restating where the flag lives, because the
   *  alternative it replaced looked cheaper: a player must never invest in a world
   *  that is going to be discarded, so there is no interim playable world any more
   *  and a long loading screen is the accepted cost. While the gate holds, the sim
   *  does not step, no mutator resolves, and nothing — debounce, chat-switch
   *  capture, detach, pagehide — writes a save.
   *
   *  Chat-scoped by construction (reset() clears it) AND by the id it carries, so a
   *  stale async completion cannot lift or fail the gate of the chat you arrived at. */
  gate: null,
  /** Chat ids with a generation call in flight. A SET, not a flag: leaving a chat
   *  mid-generation must neither abandon that call (it still seals, and the cache
   *  below carries it) nor block the chat you arrive at from starting its own. */
  _generating: new Set(),
  /** chatId → sealed brief, for the gate's escape-safety. A generation that lands
   *  while the player is in ANOTHER chat cannot patch that chat's host.chatMeta, so
   *  without this, coming back reads a meta that still looks unsealed and generates
   *  the world a SECOND time — a wasted host call and a different world. */
  _briefCache: new Map(),
  /** The subset of `_briefCache` whose chat metadata has SINCE been observed to
   *  carry the sealed brief itself. Those entries are the only ones the cache may
   *  evict: past that point the metadata knows, and the cache is a convenience.
   *  An entry that is NOT in here is the only witness there is (see _cacheBrief). */
  _briefSeenInMeta: new Set(),

  /** Reads core.sim and core.chatId and NOTHING else: 80-setup calls this with
   *  a synthetic two-key core, and reaching for core.host/hud/render there
   *  throws inside the wizard's launch handler.
   *
   *  `dropCarry` is the pre-flight fallback (see _snapshotWithoutCarry): the
   *  same snapshot with a newer build's unreadable block left out. */
  snapshot(core, dropCarry) {
    const sim = core.sim;
    if (!sim) return null;
    // Unknown keys FIRST, known keys assigned over them: a newer build's field
    // rides through untouched but can never shadow one of ours. The property
    // that matters is DETERMINISM, not alphabetical order — the flush dedupe,
    // the adopt comparison, and the rewind comparison are all string equality
    // over JSON.stringify, so any order that drifted with the source would forge
    // both spurious saves and spurious "The world rewound with the story."
    // toasts. Sorting is simply the cheapest order that cannot drift.
    const snap = {};
    const extra = dropCarry ? null : sim._envelopeExtra;
    if (extra) {
      for (const key of Object.keys(extra).sort()) {
        if (extra[key] === undefined) continue; // JSON.stringify would drop it anyway
        snap[key] = extra[key];
      }
    }
    snap.v = 1;
    snap.chatId = core.chatId;
    snap.seed = sim.world.seed;
    snap.theme = sim.world.theme;
    snap.zone = sim.zoneId;
    snap.x = Math.round(sim.x);
    snap.y = Math.round(sim.y);
    snap.facing = sim.facing;
    snap.clockMin = sim.clockMin;
    snap.day = sim.day;
    snap.bindings = sim.world.bindings;
    // §7 one-shot injection flags: persisted so a reload never re-taxes the
    // GM context with prose that already lives in chat history.
    snap.intro = sim.intro ?? { world: false, zones: {}, npcs: {} };
    // The S5 player block, and it is emitted UNCONDITIONALLY like every line
    // above it — no `if (sim.player)`, no "only when it has something in it".
    // A key that is listed in ENVELOPE_KEYS but only SOMETIMES emitted is worse
    // than one missing from the list: the list makes simFromSaved skip it on the
    // way in, so it never reaches _envelopeExtra either, and the write silently
    // deletes a newer build's field. That is the exact slice-1 failure, rebuilt
    // one branch at a time. serialize() takes an absent block and hands back the
    // default one, which is what makes the unconditional emission possible on
    // the synthetic cores 80-setup and the load-time assertion build.
    // `dropCarry` is threaded DOWN into the block serializer as well: since the
    // block keeps a newer build's unknown player-level keys too (58-player
    // PLAYER_KEYS), a pre-flight that shed only the envelope's carry would leave
    // an arbitrarily large foreign field inside `player` with no escape hatch.
    snap.player = PF.player.serialize(sim.player, dropCarry);
    return snap;
  },

  /** Where /game/create actually stores the wizard config (review finding):
   *  the chooser wraps our cfg as setupConfig.experienceConfig = cfg, and the
   *  server persists the whole setupConfig under meta.gameSetupConfig — so our
   *  own `experienceConfig.seed` lands two levels deep. Read every plausible
   *  depth so a future un-nesting doesn't strand old games. */
  _configSeed(meta) {
    const setup =
      meta && typeof meta.gameSetupConfig === "object" && meta.gameSetupConfig !== null ? meta.gameSetupConfig : null;
    const outer =
      setup && typeof setup.experienceConfig === "object" && setup.experienceConfig !== null
        ? setup.experienceConfig
        : null;
    const inner =
      outer && typeof outer.experienceConfig === "object" && outer.experienceConfig !== null
        ? outer.experienceConfig
        : null;
    for (const candidate of [inner?.seed, outer?.seed]) {
      if (typeof candidate === "number") return candidate >>> 0;
    }
    return null;
  },

  /** Restore a saved state into a freshly built world. Returns the sim.
   *
   *  The one place the quarantine bag is hydrated (plan §Q1a). Deliberately not
   *  simFromSaved, which also runs on every _rebuild: re-reading the key there
   *  would resurrect a slot a version re-adoption had just consumed, and the
   *  re-adoption would then run again on the same boot. */
  restore(meta, chatId) {
    const saved =
      meta && typeof meta[SAVE_META_KEY] === "object" && meta[SAVE_META_KEY] !== null ? meta[SAVE_META_KEY] : null;
    PF.quarantine.hydrate(meta, chatId);
    return this.simFromSaved(saved, meta, chatId);
  },

  /** The sealed world brief. Primary home: the TOP-LEVEL pixelforgeBrief
   *  metadata key (atomic under the queued shallow-merge PATCH — no
   *  read-modify-write of the whole setup config). The nested config location
   *  remains readable for chats sealed before the key moved. Absent on
   *  pre-0.4.0 games → legacy layout. */
  _configBrief(meta, chatId) {
    const top =
      meta && typeof meta.pixelforgeBrief === "object" && meta.pixelforgeBrief !== null ? meta.pixelforgeBrief : null;
    if (top && Array.isArray(top.cast)) return this._metaKnows(chatId, top);
    if (top) return null; // a {skipped:true} marker: generation declined, stay legacy
    const setup =
      meta && typeof meta.gameSetupConfig === "object" && meta.gameSetupConfig !== null ? meta.gameSetupConfig : null;
    const outer =
      setup && typeof setup.experienceConfig === "object" && setup.experienceConfig !== null
        ? setup.experienceConfig
        : null;
    const inner =
      outer && typeof outer.experienceConfig === "object" && outer.experienceConfig !== null
        ? outer.experienceConfig
        : null;
    for (const candidate of [inner?.brief, outer?.brief]) {
      if (candidate && typeof candidate === "object" && Array.isArray(candidate.cast))
        return this._metaKnows(chatId, candidate);
    }
    // …and LAST, this session's own cache (see _briefCache). Only when the metadata
    // carries nothing at all about a brief: anything the host actually delivered —
    // a sealed brief or a `{skipped:true}` marker — is the newer truth and both
    // return above, so the cache can never shadow the stored answer.
    const cached = chatId ? this._briefCache.get(chatId) : null;
    return cached && Array.isArray(cached.cast) ? cached : null;
  },

  /** The metadata was just read carrying this chat's sealed brief, so the cache
   *  entry for it (if any) has stopped being the only witness. Recorded so the
   *  eviction below has something safe to drop. Returns the brief, so the reader
   *  above stays one expression. */
  _metaKnows(chatId, brief) {
    if (chatId && this._briefCache.has(chatId)) this._briefSeenInMeta.add(chatId);
    return brief;
  },

  /** Remember a brief we just sealed, newest last, bounded.
   *
   *  EVICTION IS NOT FREE HERE, which is why this is not a plain drop-the-oldest.
   *  Until the host's chatMeta comes back carrying the sealed key, this cache is
   *  the ONLY thing that knows the chat is sealed — case (as): a generation that
   *  lands while the player is in another chat cannot patch the metadata blob they
   *  are holding, so the next visit reads a chat that still looks unsealed. Drop
   *  that entry and the gate re-arms, a second host call runs, and the player gets
   *  a DIFFERENT world than the one already stored. So only entries the metadata
   *  has been observed to carry are droppable; when none of them is, the cache
   *  carries the overflow rather than the loss. What it is really bounded by is
   *  how many chats one session can have sealed-but-not-yet-acknowledged at once,
   *  which is a handful of a few KB each.
   *
   *  PF.quarantine's `_unsettled` map answers the identical fork identically, and
   *  the two are deliberately aligned (O-2): both are per-session maps of small
   *  byte strings in which each entry is the sole record of something a later
   *  visit needs, so a ceiling that can only be met by dropping one of those is
   *  not a ceiling either of them meets. */
  _cacheBrief(chatId, sealed) {
    if (!chatId || !sealed || !Array.isArray(sealed.cast)) return;
    this._briefCache.delete(chatId);
    this._briefSeenInMeta.delete(chatId);
    this._briefCache.set(chatId, sealed);
    while (this._briefCache.size > BRIEF_CACHE_MAX) {
      let dropped = null;
      for (const key of this._briefCache.keys()) {
        if (this._briefSeenInMeta.has(key)) {
          dropped = key;
          break;
        }
      }
      if (dropped === null) break;
      this._briefCache.delete(dropped);
      this._briefSeenInMeta.delete(dropped);
    }
  },

  /** "This chat was configured to generate a world and has not sealed one yet."
   *  ONE predicate with FOUR consumers that used to be copies of the same
   *  expression: the interim world mark, the stamp-evaluability gate, the
   *  loading gate, and maybeGenerateBrief's nothing-to-generate branch. Separate
   *  copies of a predicate this load-bearing is how the gate and the interim mark
   *  come to disagree about which chats are which. */
  briefExpected(meta, chatId) {
    return !this._configBrief(meta, chatId) && meta?.pixelforgeBrief === undefined && this._configGenerate(meta);
  },

  /** The wizard's opt-in for surface-side world generation (0.4.0 chats). */
  _configGenerate(meta) {
    const setup =
      meta && typeof meta.gameSetupConfig === "object" && meta.gameSetupConfig !== null ? meta.gameSetupConfig : null;
    const outer =
      setup && typeof setup.experienceConfig === "object" && setup.experienceConfig !== null
        ? setup.experienceConfig
        : null;
    const inner =
      outer && typeof outer.experienceConfig === "object" && outer.experienceConfig !== null
        ? outer.experienceConfig
        : null;
    return inner?.generate === true || outer?.generate === true;
  },

  /** Arm the loading gate for a chat whose brief is not sealed yet, and answer
   *  whether it holds. Called ONCE per chat switch and BEFORE adopt(), because
   *  adopt's row-3 branch is "first-write" — a probe of a gated chat would write
   *  the un-entered world up as if it were somebody's play.
   *
   *  Legacy and non-generate chats (default worlds by design) never arm it and
   *  play immediately; so does a chat whose generation was declined, whose
   *  `{skipped:true}` marker briefExpected() reads as "sealed enough". */
  armGate(core, meta) {
    if (!core?.chatId || !this.briefExpected(meta, core.chatId)) {
      this.gate = null;
      // THE STARTING PURSE IS A PROPERTY OF STATE, NOT OF AN INSTANT (slice 6).
      // It used to be paid at exactly ONE moment — the tail of the generation
      // that sealed the brief — and every ordinary way of not being there for
      // that moment cost it permanently: leaving the chat while generation ran
      // (the seal lands with the player elsewhere and the chat fence returns
      // before the grant), a reload between the seal and the lift, or a throw
      // that turned the lift into a retry screen. Sealed worlds are also the only
      // ones that get one, which is what keeps this off every legacy save in the
      // wild: a default world is not a world beginning, it is the world that has
      // always been there. grantStartingPurse is idempotent by its own predicate,
      // so a chat that has already been paid is untouched by this second call.
      if (core?.chatId && core.sim?.world && !core.sim.world.interim && this._configBrief(meta, core.chatId))
        PF.economy.grantStartingPurse(core);
      return false;
    }
    this.gate = { chatId: core.chatId, state: "generating", attempts: 0 };
    return true;
  },

  /** Does the gate hold for THIS core's chat? Every refusal below asks this and
   *  not `gate !== null`: a gate armed for the chat we left must not silence the
   *  chat we arrived at, and reset() is not the only ordering that can leave the
   *  two out of step (an async completion can land between the two). */
  gateHolds(core) {
    return this.gate !== null && !!core && this.gate.chatId === core.chatId;
  },

  /** The brief sealed: play begins. adopt() runs HERE rather than at the chat
   *  switch, because it is the first thing allowed to write.
   *
   *  AND IT REFUSES TO LIFT ONTO AN INTERIM WORLD. The gate's whole promise is
   *  that nobody plays a world that is going to be discarded, and the placeholder
   *  is exactly that world: everything done in it stamps {briefHash:0, interim:1}
   *  and is severed unrecoverably the moment the real world compiles. Every
   *  caller's job is therefore to REBUILD first and lift second; this is the
   *  assertion that keeps a future caller from quietly re-opening the hole. */
  _liftGate(core) {
    if (!this.gateHolds(core)) return;
    if (core.sim?.world?.interim) {
      console.warn("[pixelforge] refusing to start play in the placeholder world; the gate stays up");
      return;
    }
    this.gate = null;
    core.hud?.update?.();
    void this.adopt(core);
  },

  /** Everything that happens once a sealed brief is IN HAND: compile the world it
   *  describes, carry across what crosses this seam, lift the gate, pay the purse.
   *
   *  Factored out of maybeGenerateBrief's success tail because it has a SECOND
   *  caller, and the absence of that second caller was the bug. Every throw the
   *  generation guard was written for lands AFTER the brief is stored and cached —
   *  the compile, the transplant, the park are all downstream — so by the time the
   *  player presses "Try again", briefExpected() is already false and the retry
   *  takes the nothing-to-generate branch. That branch used to lift the gate bare,
   *  which started play IN THE PLACEHOLDER: adopt's first-write wrote it up, and
   *  everything played there was severed the next time the real world compiled.
   *  A retry recompiles from the brief that is already sealed instead. */
  _installSealedWorld(core, chatId, sealed, seed, theme) {
    // Under the gate the sim standing here is a placeholder nobody walked in, so
    // this is a plain replacement — but the envelope carry is NOT play state (it
    // is a newer build's fields) and rides across regardless, exactly as it does
    // through _rebuild.
    const carriedExtra = core.sim?._envelopeExtra;
    // The player block crosses the same seam, and it crosses SPLIT (plan §Q5).
    // THE GATE MAKES THIS PATH A COMPAT SHIM, NOT THE NORMAL ONE, and it stays
    // for two reasons the gate cannot cover: a chat CREATED BEFORE the gate
    // shipped has a real interim save with real play in it, and a legacy save
    // can arrive stamped for a world that never sealed. For those, world-free
    // fields — the purse, the skills, the board's completion counts — mean the
    // same thing in the compiled world, and everything world-bound belonged to
    // the throwaway one and goes to the stamp slot instead of being silently
    // reinterpreted against people who do not exist here. For a gated chat the
    // block is a fresh default and the split moves nothing, which is the point:
    // the safety net costs nothing when the gate has already done its job.
    const carriedPlayer = core.sim?.player;
    core.sim = new PF.Sim(PF.world.build(seed, theme, sealed));
    if (carriedExtra) core.sim._envelopeExtra = carriedExtra;
    const moved = PF.player.transplant(carriedPlayer, core.sim.world, sealed);
    core.sim.player = moved.player;
    if (moved.severed) this._park(chatId, moved.severed.slot, moved.severed.entry);
    this._lastSerialized = null;
    core.render?.clearZones?.();
    void PF.assets.load(core);
    // The gate lifts BEFORE the first dirty flag, and the order is load-bearing:
    // markDirty refuses while the gate holds, so arming the save first would
    // arm nothing and the freshly compiled world would wait for some unrelated
    // later event to be written at all.
    this._liftGate(core);
    // S3's starting purse, at the one moment that is unambiguously "this world
    // begins now" and after the lift, because it goes through the mutators the
    // gate was refusing a line ago (PF.economy.grantStartingPurse says why this
    // moment and not a default on the block). armGate pays the same debt on every
    // boot path that never reaches here — and applies the same test: SEALED
    // worlds only. A skipped marker reaches this tail with `sealed` null and a
    // themed default under it, and a default world is not a world beginning — it
    // is the world that has always been there, which is what keeps the purse off
    // every declined and legacy chat alike (armGate's own guard already pays
    // those nothing; two chats on the identical default world must hold the
    // same money).
    if (sealed) PF.economy.grantStartingPurse(core);
    core.hud?.refreshChips();
    core.hud?.toast("The world takes shape.");
    this.markDirty(core);
  },

  /** Generation did not seal. The chat stays UNSEALED — which is the whole
   *  no-bricked-chat argument: nothing was written, so the next visit arms the
   *  gate again and tries again on its own, and no default world was ever sealed
   *  on a detail-heavy player's behalf. NO failure seals one now, deterministic
   *  ones included (18-brief `generate`'s design revision).
   *
   *  `kind` is the ladder's own verdict, carried onto the gate so the retry screen
   *  can say something truer than "something went wrong": a busy engine and a
   *  refused request are the same screen but not the same sentence, and a
   *  deterministic 400 that reads as a mystery is a player pressing a button that
   *  will never work. Absent for the throw path, which has no verdict to report. */
  _failGate(core, kind) {
    if (!this.gateHolds(core)) return;
    this.gate = {
      ...this.gate,
      state: "failed",
      attempts: this.gate.attempts + 1,
      failure: typeof kind === "string" && kind ? kind : null,
    };
    core.hud?.update?.();
  },

  /** ONE SENTENCE FOR THE RETRY SCREEN, per failure kind, and it lives here
   *  rather than in 70-hud for the reason every other decision in this module
   *  does: the HUD needs a DOM and the harness has none, so a string the player
   *  reads would be the one part of the screen nothing could pin.
   *
   *  The kinds are the ladder's own (18-brief `generate`'s `onFailure`) plus
   *  "storage", which is this module's — the brief generated fine and the PATCH
   *  that would have stored it did not. "refused" is the one that earns its own
   *  sentence: a deterministic 400/422 gives the same answer every time, and a
   *  player pressing a button that will never work deserves to be told so.
   *  Unknown or absent kinds fall back to the honest generic — a throw has no
   *  verdict to report, and a kind a newer ladder invents must not blank the
   *  panel. */
  gateReason(kind) {
    switch (kind) {
      case "refused":
        return "The request was turned down rather than delayed, so another attempt may well get the same answer; a shorter, plainer setting description is the likeliest thing to change it.";
      case "unavailable":
        return "The engine could not take the request just now — it may be busy with something else.";
      case "network":
        return "The request did not get through.";
      case "timeout":
        return "It was taking longer than the time set aside for it.";
      case "storage":
        return "The world was written, but saving it to this chat did not go through.";
      default:
        return "Something went wrong partway through.";
    }
  },

  /** The retry the gate's failure state offers, and the only caller is that
   *  button: everything else re-arms by revisiting the chat. */
  retryGeneration(core) {
    if (!this.gateHolds(core) || this.gate.state !== "failed") return false;
    this.gate = { ...this.gate, state: "generating", failure: null };
    core.hud?.update?.();
    void this.maybeGenerateBrief(core);
    return true;
  },

  /** Surface-side world generation (spec §5, amended by plan §Q3b): BLOCKING now,
   *  behind the loading gate. The old contract booted the chat on a throwaway
   *  themed world and generated behind a toast; the maintainer rejected that
   *  outright (ruling #7) — a player must never invest in a world that is going to
   *  be discarded. So the gate holds play, this runs the one #5135 call behind it
   *  with the retry/salvage ladder 0.4.0 already shipped, the sealed brief stores
   *  atomically under pixelforgeBrief (3 retries), the world compiles, and the gate
   *  lifts. On failure the gate offers retry and the chat stays unsealed.
   *
   *  Runs at most once per chat AT A TIME, and the set is keyed by chat id rather
   *  than being one flag: with a flag, leaving a chat mid-generation left the flag
   *  up, and the chat you arrived at returned here immediately and sat behind a
   *  gate with nothing running behind it. The stored key (sealed brief or a skipped
   *  marker) remains the one-shot guard ACROSS visits, so completed chats and
   *  pre-0.4.0 chats never re-generate. */
  async maybeGenerateBrief(core) {
    const chatId = core.chatId;
    if (!chatId || this._generating.has(chatId)) return;
    const meta =
      core.host && typeof core.host.chatMeta === "object" && core.host.chatMeta !== null ? core.host.chatMeta : {};
    if (!this.briefExpected(meta, chatId)) {
      // Nothing to generate. A gate armed against a metadata blob that has since
      // caught up (or against this session's own cache) lifts here rather than
      // waiting for a generation call that would find nothing to do.
      //
      // …but the world standing under that gate is the PLACEHOLDER, built when
      // the brief was still expected, and lifting onto it is what turned a
      // post-seal throw into a chat whose play was severed the next time the real
      // world compiled. THIS IS ALSO THE RETRY PATH: every throw the guard below
      // catches lands after the brief is stored and cached, so "Try again" always
      // arrives here rather than at a second generation call. Recompile from the
      // brief that is already sealed, then lift onto THAT. `_configBrief` is null
      // only when the chat stopped expecting one for a reason other than a seal (a
      // `{skipped:true}` marker landing mid-gate), and build() answers that with
      // the themed default world the marker asked for.
      if (this.gateHolds(core) && core.sim?.world?.interim) {
        const theme = this._configTheme(meta) ?? "cozy-village";
        let seed = this._configSeed(meta);
        if (seed === null) seed = PF.hashStr(String(chatId));
        this._installSealedWorld(core, chatId, this._configBrief(meta, chatId), seed, theme);
        return;
      }
      this._liftGate(core);
      return;
    }
    this._generating.add(chatId);
    try {
      const theme = this._configTheme(meta) ?? "cozy-village";
      let seed = this._configSeed(meta);
      if (seed === null) seed = PF.hashStr(String(chatId));
      const setup = meta.gameSetupConfig && typeof meta.gameSetupConfig === "object" ? meta.gameSetupConfig : {};
      const preferences = [
        setup.setting ? `Setting: ${setup.setting}` : "",
        setup.tone ? `Tone: ${setup.tone}` : "",
        setup.difficulty ? `Difficulty: ${setup.difficulty}` : "",
        setup.rating ? `Rating: ${setup.rating}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      let failure = null;
      const sealed = await PF.brief.generate(chatId, {
        theme,
        seed,
        preferences,
        onFailure: (kind) => {
          failure = kind;
        },
      });
      if (!sealed) {
        // EVERY failure — a busy engine, the network, the budget timeout, a route
        // that is not there, and now a deterministic 400 or 422 as well: do NOT
        // seal. The key stays absent, this visit offers retry, and the next visit
        // arms the gate again. There is deliberately no "play the default world"
        // escape on any branch: sealing a default world for a player who wrote
        // three paragraphs of setting is the outcome ruling #7 exists to forbid,
        // and a deterministic failure is the one case they could never undo.
        if (chatId === core.chatId) this._failGate(core, failure);
        return;
      }
      let stored = false;
      for (let attempt = 0; attempt < 3 && !stored; attempt++) {
        try {
          await PF.api.patchMetadata(chatId, { pixelforgeBrief: sealed });
          stored = true;
        } catch (err) {
          if (attempt === 2) console.warn("[pixelforge] brief storage failed; the chat stays unsealed", err);
          else await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
        }
      }
      if (!stored) {
        if (chatId === core.chatId) this._failGate(core, "storage");
        return;
      }
      // Cached BEFORE the chat fence below, and that ordering is the gate's
      // escape-safety: a generation that lands while the player is in another chat
      // returns here, and the cache is the only thing that will tell the next visit
      // this world is already sealed rather than generating it a second time.
      this._cacheBrief(chatId, sealed);
      if (chatId !== core.chatId) return;
      // Build the world the brief describes, lift onto it, pay the purse. Shared
      // with the retry path above, which is how a throw out of any of it stays
      // recoverable instead of stranding the player in the placeholder.
      this._installSealedWorld(core, chatId, sealed, seed, theme);
    } catch (err) {
      // NEVER A SPINNER WITH NOTHING BEHIND IT. Every failure the generation
      // ladder KNOWS about is already a `null` seal handled above; this is the
      // one it does not — a throw out of the compile, the transplant or the
      // park, which before this left the gate reading "writing your world…"
      // forever with no call running and no button to press. A retry screen is
      // the right answer to an unexpected throw for the same reason it is the
      // right answer to a refused generation: nothing was sealed, so the chat is
      // untouched and trying again is free.
      console.warn("[pixelforge] world generation failed unexpectedly; the chat stays unsealed", err);
      if (chatId === core.chatId) this._failGate(core);
    } finally {
      this._generating.delete(chatId);
    }
  },

  /** The wizard's theme, from the same double-nested config home as the seed. */
  _configTheme(meta) {
    const setup =
      meta && typeof meta.gameSetupConfig === "object" && meta.gameSetupConfig !== null ? meta.gameSetupConfig : null;
    const outer =
      setup && typeof setup.experienceConfig === "object" && setup.experienceConfig !== null
        ? setup.experienceConfig
        : null;
    const inner =
      outer && typeof outer.experienceConfig === "object" && outer.experienceConfig !== null
        ? outer.experienceConfig
        : null;
    for (const candidate of [inner?.theme, outer?.theme]) {
      if (typeof candidate === "string" && candidate) return candidate;
    }
    return null;
  },

  /** Build a sim from a save object (route state or the metadata key). */
  simFromSaved(saved, meta, chatId) {
    // Explicit null checks: 0 is a legitimate seed, so truthiness chaining would
    // silently rebuild a zero-seeded world from the wrong source.
    let seed = saved && typeof saved.seed === "number" ? saved.seed >>> 0 : null;
    if (seed === null) seed = this._configSeed(meta);
    if (seed === null) seed = PF.hashStr(String(chatId));
    // Saved theme wins (it is what the world was built with), then the wizard
    // config; build() validates the id and falls back to the default theme.
    // The sealed brief (when present) makes build() compile the generated
    // world; the brief lives ONLY in chat metadata (pixelforgeBrief, or the
    // legacy nested config spot), never in save rows.
    const theme = (saved && typeof saved.theme === "string" ? saved.theme : null) ?? this._configTheme(meta);
    const brief = this._configBrief(meta, chatId);
    const world = PF.world.build(seed, theme, brief);
    // The pre-brief world of a generation-enabled chat is a placeholder the sealed
    // brief will replace — stamped so the World Maps export (§8) never registers
    // its zones on the user's map. A sealed brief or a {skipped:true} marker makes
    // the world final. The LOADING GATE (plan §Q3b) now keeps the player out of
    // this world entirely, so on the normal path nothing is ever played here; the
    // mark stays as the safety net it also always was — for chats created before
    // the gate shipped (whose interim saves are real), and for the window between
    // a brief sealing and the rebuild landing.
    if (this.briefExpected(meta, chatId)) world.interim = true;
    // A save row is untrusted JSON and `world.zones` is a plain object, so a
    // bare `zones[id]` truthiness test reads straight through Object.prototype.
    // Two demonstrated outcomes: `zone: "constructor"` resolves to a FUNCTION,
    // which crashes the mount the first time anything reads z.w; and a binding
    // naming "constructor" writes `spatialLocationId` onto the global Object
    // itself. Own-property only, both places.
    const hasZone = (id) => typeof id === "string" && Object.prototype.hasOwnProperty.call(world.zones, id);
    const sim = new PF.Sim(world);
    // Additive-only by policy (plan §Q1): keys a NEWER build added ride through
    // this one instead of being erased by the next flush. Collected OUTSIDE the
    // version gate deliberately — a build that cannot even parse `v` is exactly
    // the build most likely to be destroying data it does not understand.
    if (saved && typeof saved === "object") {
      const extra = {};
      for (const key of Object.keys(saved)) {
        // "__proto__" arrives as an own property from JSON.parse; assigning it
        // onto a plain object would set the prototype instead of a key.
        if (ENVELOPE_KEYS.has(key) || key === "__proto__") continue;
        if (saved[key] === undefined) continue;
        extra[key] = saved[key];
      }
      sim._envelopeExtra = extra;
    }
    // Tolerant read (plan §Q1): the old strict `saved.v === 1` half-applied a
    // forward-version save — right world (seed/theme resolve above the gate),
    // but spawn/08:00/day-1, no intro flags, no bindings. Every field below
    // carries its own type check, so a higher envelope version restores exactly
    // the fields it still shares with us.
    if (saved && typeof saved.v === "number" && saved.v >= 1) {
      // A saved zone that no longer exists (world gen changed between versions,
      // or an interior that this build no longer compiles) falls back to the
      // start zone — but the saved x/y belonged to the OLD zone, and carrying
      // them over just clamps interior coordinates into a much larger map. The
      // solid-tile rescue below only fires if that lands in a wall, so the
      // player would silently reappear in a random corner. Land them at the
      // spawn instead, which is the one tile every zone guarantees is walkable.
      const zoneResolved = hasZone(saved.zone);
      if (zoneResolved) sim.zoneId = saved.zone;
      const z = sim.zone();
      if (zoneResolved) {
        if (typeof saved.x === "number") sim.x = PF.clamp(saved.x, PF.TILE, (z.w - 1) * PF.TILE);
        if (typeof saved.y === "number") sim.y = PF.clamp(saved.y, PF.TILE, (z.h - 1) * PF.TILE);
      } else {
        sim.x = (z.spawn.x + 0.5) * PF.TILE;
        sim.y = (z.spawn.y + 0.5) * PF.TILE;
      }
      if (typeof saved.facing === "number") sim.facing = saved.facing & 3;
      if (typeof saved.clockMin === "number") sim.clockMin = PF.clamp(saved.clockMin | 0, 0, 24 * 60 - 1);
      if (typeof saved.day === "number") sim.day = Math.max(1, saved.day | 0);
      // The world was built (and everyone placed at their compiled anchor) by
      // the constructor above, which ran against the DEFAULT 08:00 clock. Now
      // that the saved time is restored, re-place for the real daypart — else a
      // chat reopened at midnight would show a town going about its morning.
      sim.resolveSchedules();
      if (saved.intro && typeof saved.intro === "object") {
        // A CLOSED LITERAL, and that is the fact this line exists to answer.
        // Every subkey not named here is stripped on every restore AND on every
        // `_rebuild`, and the envelope carry cannot cover for it: `_envelopeExtra`
        // holds unknown TOP-LEVEL keys, so a known key's unknown SUBKEY rides
        // nothing at all. Adding a field under `intro` therefore means adding it
        // HERE, in the same change, or it is write-only state.
        sim.intro = {
          world: saved.intro.world === true,
          zones: saved.intro.zones && typeof saved.intro.zones === "object" ? { ...saved.intro.zones } : {},
          npcs: saved.intro.npcs && typeof saved.intro.npcs === "object" ? { ...saved.intro.npcs } : {},
          // THE DURABLE HALF OF THE TWO-FIELD FLUSH (plan §2.5): the last day a
          // completed sleep made owed. It lives under `intro` because that key is
          // already in the envelope and a wrap-up marker is not worth an
          // ENVELOPE_KEYS entry of its own — and the whole design is void without
          // this line, since a marker that does not survive a reload can never
          // outlive the session that staged it. Read through the resolver: it
          // comes off save JSON and it is about to be compared against `sim.day`.
          ledgerOwed: PF.player.resolvedDay(saved.intro.ledgerOwed),
        };
      }
      if (saved.bindings && typeof saved.bindings === "object") {
        for (const [loc, zone] of Object.entries(saved.bindings)) {
          if (hasZone(zone)) {
            world.bindings[loc] = zone;
            world.zones[zone].spatialLocationId = loc;
          }
        }
      }
      // Unblock a save restored into a solid tile (world gen changed between versions).
      if (sim.blocked(sim.zone(), sim.x, sim.y)) {
        const spawn = sim.zone().spawn;
        sim.x = (spawn.x + 0.5) * PF.TILE;
        sim.y = (spawn.y + 0.5) * PF.TILE;
      }
    }
    // ── The player block, rehydrated in the order §Q5 fixes ───────────────────
    // parse/migrate → stamps/severance → gated dangling repair → notices. The
    // order is the whole correctness argument: a repair run before severance
    // would drop quests the severance was about to quarantine intact, and a
    // notice appended before severance would be severed along with the lines it
    // is explaining. Deliberately OUTSIDE the `saved.v` gate, like the carry
    // above it and for the same reason — `player` carries its own version and a
    // build that cannot read the envelope's is the one most likely to be
    // destroying what it does not understand.
    sim.player = this._rehydratePlayer(saved, world, brief, meta, chatId, sim);
    return sim;
  },

  /** Every quarantine write goes through here, and the point of the wrapper is
   *  the RETURN VALUE. `put` refuses — first-loss-wins on the one-shot slots, or
   *  an entry too large for the bag's own ceiling — and every caller used to
   *  discard that silently, which is how a second severance came to delete the
   *  fields it had just stripped. A refusal is now either handled by the caller
   *  or said out loud here, and never both ignored and unlogged. */
  _park(chatId, slot, entry) {
    if (PF.quarantine.put(chatId, slot, entry)) return true;
    const occupied = PF.quarantine.peek(slot) !== null;
    console.warn(
      `[pixelforge] the ${slot} quarantine slot did not take this entry: ` +
        (occupied
          ? "it already holds an earlier loss of the same kind (first-loss-wins)"
          : "the entry is larger than the bag's own ceiling"),
    );
    return false;
  },

  /** The §Q5 rehydration, factored out so the ordering is one readable list
   *  rather than a tail on a 90-line function. Never throws: every branch has a
   *  defaults boot behind it. */
  _rehydratePlayer(saved, world, brief, meta, chatId, sim) {
    const briefExpected = this.briefExpected(meta, chatId);
    // 1. PARSE / MIGRATE.
    const parsed = PF.player.parse(saved && typeof saved === "object" ? saved.player : null);
    const player = parsed.player;
    if (parsed.quarantine) this._park(chatId, parsed.quarantine.slot, parsed.quarantine.entry);

    // 1b. VERSION RE-ADOPTION. A block this build could not read last time is
    // readable now. It CONSUMES the slot — that is what makes a third boot a
    // no-op — and the block it displaces is parked in setAside, which no machine
    // ever restores: two live blocks cannot both be the player's state, and only
    // the player can say which one they meant.
    const held = PF.quarantine.peek("version");
    const heldV = held && typeof held.fromV === "number" && Number.isFinite(held.fromV) ? held.fromV : null;
    if (held && held.adoptable === true && heldV !== null && heldV <= PF.player.currentV()) {
      const readopted = PF.player.parse(held.block);
      if (readopted.source === "saved") {
        PF.quarantine.consume(chatId, "version");
        // A stamp entry from a DIFFERENT lineage is not evidence about this one.
        const stamp = PF.quarantine.peek("stamp");
        if (stamp && stamp.fromV !== held.fromV) PF.quarantine.discard(chatId, "stamp");
        // setAside is a LIST, so a SECOND re-adoption on a later boot parks its
        // displaced block beside the first instead of finding the slot full and
        // dropping a live block on the floor. Nobody but the player resolves
        // this slot, and two displacements are two things to offer them.
        this._park(chatId, "setAside", {
          reason: "displaced",
          fromV: player.v,
          block: PF.player.serialize(player),
        });
        Object.assign(player, readopted.player);
      }
    }

    // 2. STAMPS / SEVERANCE, then the other direction: a stamp slot whose world
    // is the world we just built is a save coming home.
    const applied = PF.player.applyStamps(player, world, brief, briefExpected);
    const notices = [...applied.notices];
    if (applied.severed && !this._park(chatId, applied.severed.slot, applied.severed.entry)) {
      // applyStamps has ALREADY stripped the live block by the time it hands the
      // entry over, so a refusal here is a real loss — and the notice it wrote
      // promises the opposite. The bag merges a second severance now, so this
      // only fires when the entry will not fit at all; when it does fire, the
      // player gets the true sentence instead of the comforting one.
      notices.length = 0;
      // THE SAME EVENT AS THE SENTENCE IT REPLACES, with the other outcome — so
      // it takes that sentence's own subject. applyStamps says "what you had
      // done here"; this one used to say "what belonged to the world that
      // changed", which is true, abstract, and reads like a different incident
      // when the two sit a scroll apart in the band (plan §2.5, M3's
      // writer-site kind copy).
      notices.push("What you had done in the world that changed could not be kept, and is gone.");
    }
    if (applied.evaluated && !applied.severed) {
      const stamp = PF.quarantine.peek("stamp");
      if (stamp) {
        const restored = PF.player.restoreStamped(player, stamp, world, brief);
        if (restored) {
          Object.assign(player, restored);
          PF.quarantine.consume(chatId, "stamp");
          notices.push("What was set aside when this world changed is back.");
        }
      }
    }

    // 3. GATED DANGLING REPAIR. A repair is a NON-MUTATION: it does not dirty
    // the sim and does not arm a write of its own. The next real save carries it.
    const repaired = PF.player.repairQuests(player, world, applied.evaluated);
    notices.push(...repaired.notices);

    // 4. NOTICES, appended to the band's own array — after the severance that
    // emptied the ledger, so the one thing that survives the window is the
    // explanation for it.
    //
    // AT THE DAY IT HAPPENED, which took a format change to be able to say
    // (plan §2.5). These used to be ledger LINES, and a line at or below the
    // flush gate is one the wrap-up skips — so the day was shifted up to
    // `max(sim.day, flushedDay + 1)` to keep the notice tellable, which printed
    // a day header from the FUTURE into the tell whenever the gate had run
    // ahead of the clock. The band is told-flagged instead of day-gated, so the
    // shift is deleted along with the back-door it existed for.
    for (const text of notices) PF.player.notice(player, text, sim.day);
    return player;
  },

  /** Self-heal (review finding): ~40 engine call sites still use the unqueued
   *  whole-blob updateMetadata (issue #5076 class), any of which can silently
   *  erase our key between turns. If we have saved state but the incoming
   *  chatMeta lost the key, re-save from the in-memory authority. */
  ensurePresent(core, meta) {
    // The quarantine key has its OWN branch, and it needs one: it is written by
    // a different code path on a different cadence, and the save key being
    // intact says nothing about whether the quarantine key survived the same
    // whole-blob write. It is also not gated on _lastSerialized — a bag can be
    // the only thing this chat has written.
    PF.quarantine.ensurePresent(core, meta);
    if (!this._lastSerialized || !core.sim || !core.chatId) return;
    if (meta && typeof meta === "object" && meta[SAVE_META_KEY] == null) {
      this._lastSerialized = null; // force the next flush to actually write
      this._metaSerialized = null; // the cache PATCH dedupes separately in routes mode
      this.markDirty(core);
    }
  },

  /** Reset per-chat persistence state (chat switch). The generation counter
   *  fences every async read started before the switch: a stale response
   *  cannot be detected by comparing "current" ids (both moved to the new
   *  chat together), only by what the request captured when it started. */
  reset() {
    this._gen = (this._gen ?? 0) + 1;
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = 0;
    }
    this._timerIsBackoff = false;
    this._stopReprobe();
    this._lastSerialized = null;
    this._metaSerialized = null;
    this._forceWrite = false;
    this.mode = null;
    this._serverSerialized = null;
    this._rewindCheckInFlight = false;
    this._flushFailures = 0;
    this.degraded = false;
    this._degradeToasted = false;
    this._probePinned = false;
    this._reprobedAfterFlush = false;
    this._reprobeFailures = 0;
    // Ladder state (slice 4). _lastCheck is what teardown's clean-gate derives
    // from, so it must not survive into a chat whose row it never looked at.
    this._lastCheck = null;
    this._lastCheckAt = 0;
    this._lastOkCheckAt = 0;
    this._lastCheckedAnchor = null;
    this._anchorMoved = false;
    this._row9Failures = 0;
    this._corruptToasted = false;
    this._corruptParked = false;
    // #5406's own per-chat cache: the ordinal OUR last route write was given.
    this._putOrdinal = null;
    this._schemaVersionNoted = false;
    // The loading gate belongs to the chat it was armed for; the arriving chat
    // arms its own (90-element _switchChat) once its metadata has been read.
    // _generating and _briefCache are deliberately NOT cleared — a generation
    // in flight for the chat we are leaving must still seal, and the brief it
    // seals is what stops the next visit generating that world all over again.
    // (_briefSeenInMeta rides with the cache it describes, for the same reason.)
    this.gate = null;
    // The in-memory quarantine bag is per-chat, exactly like the caches above:
    // restore() hydrates the arriving chat's key into it a few lines later.
    PF.quarantine.reset();
    // _flushChain is deliberately NOT cleared: the chat-switch flush of the
    // chat we are LEAVING rides it, and it must still land before the new
    // chat's first write. _writeSeq is process-monotonic and never resets.
  },

  /** Probe the experience-state routes once per chat and pick the mode. In
   *  routes mode the server row is the authority: if it differs from the
   *  metadata-booted sim (e.g. the user swiped or loaded a checkpoint since the
   *  last visit), the world is rebuilt from it; if the server has no row yet,
   *  the current world (which may be a migrated legacy metadata save) is
   *  written up. Any probe failure degrades to metadata mode.
   *
   *  On the flush chain, for the same reason checkRewind is: _switchChat
   *  captures the LEAVING chat's pending write and queues it, and the probe of
   *  the chat we arrive at (or arrive BACK at) must not run beside it. Off the
   *  chain, that probe can read the row the queued write is about to replace,
   *  latch it as _serverSerialized, and rebuild the sim onto a state we
   *  ourselves superseded a moment later. */
  /** THE DECISION LADDER (plan §Q2) — ONE implementation, three consumers, and
   *  a fourth that derives from it. Every site used to ask its own version of
   *  "is this row mine, and is it newer than what I hold?", and they disagreed:
   *  adopt compared against the local snapshot, checkRewind against the last
   *  known row, the flush against nothing at all, and teardown against a byte
   *  cache. The rows below are evaluated IN ORDER and the first match wins.
   *
   *  `get` is { failed, error } or { failed:false, probe }, exactly as PF.api
   *  hands it back. `ctx` is:
   *    serverSerialized  the last row we know the server held, or null
   *    localSerialized   our current snapshot's bytes, or null
   *    seqAtIssue        _writeSeq at the moment the GET was issued
   *    game              our "New game" ordinal
   *    anchorMoved       a PUT of ours echoed an anchor we had not checked
   *    lastOkCheckAt     epoch ms of the last SUCCESSFUL check (row 9 only)
   *    now               epoch ms
   *    putOrdinal        #5406: the ordinal our last route write was given, or null
   *    mirrorOrdinal     #5406: the ordinal of the last write that moved OUR
   *                      metadata key, off the engine's mirror, or null
   *
   *  The result carries the row, the parsed state, and a PER-SITE action map —
   *  `adopt`, `rewind`, `flush` — because the same row means different things at
   *  different sites: row 6 is "the row wins" at adopt and "latch it, do not
   *  rebuild" at a rewind check.
   *
   *  ── #5406, THE WRITE ORDINAL, CONSUMED ────────────────────────────────────
   *  The engine now stamps every experience row and every metadata key from ONE
   *  per-chat monotonic counter (GET and PUT both report `writeOrdinal`; the
   *  metadata side is mirrored at `metadataWriteOrdinals[<key>]`). It is BETTER
   *  EVIDENCE INSIDE THE ROWS BELOW and never a row of its own — the rows and
   *  their per-site actions are exactly what they were — and it is read in two
   *  places:
   *
   *   • ROW 5. The own-commit GATE is unchanged: "a PUT of ours completed while
   *     this GET was in flight". `_writeSeq` cannot say WHICH row that PUT landed
   *     on, so the suspicion was unfalsifiable and a perfectly current row was
   *     discarded whenever a write happened to overlap the read. With both
   *     ordinals present, a row at or past our own last PUT's ordinal already
   *     CARRIES that write — there is nothing for it to predate — so the
   *     classification falls through to the byte comparison instead.
   *
   *   • ROWS 6/7/8. The byte comparison still picks the row. The ordinal answers
   *     the one question bytes cannot (plan §Q2a): when the row differs from a
   *     baseline that is our own metadata-booted snapshot — row 6's precondition,
   *     no anchor of ours — is the row AHEAD of that cache or BEHIND it? A row
   *     strictly behind the mirror's entry for our key is provably older than the
   *     world we are standing in, and adopting it would throw away a degraded
   *     session's entire play. That is the §5 row #5406 was filed to close, and it
   *     classifies ROW 5, whose meaning it already is: this row predates a write
   *     of ours, so ignore it and let our write proceed over it.
   *
   *  THE ANCHOR OUTRANKS THE ORDINAL, and that half is load-bearing. The ordinal
   *  orders the two STORES; only the anchor orders the TIMELINE. So the mirror
   *  test fires only when the engine says the row is NOT the reader's own anchor's
   *  save (`anchorMatched !== true`, i.e. the row came back as the namespace's
   *  latest fallback and makes no claim about where the reader is). Without that
   *  guard a swipe-back taken while the tab was closed would stop rewinding the
   *  world — because a healthy flush ALWAYS leaves the mirror one ordinal ahead of
   *  the row it paired with, the row being written first.
   *
   *  A TIE IS THE SAME WRITE, not a newer one, so both tests compare strictly.
   *  Either side unorderable — a pre-#5406 engine, a row cloned from before the
   *  feature, a mirror clobbered by a whole-blob metadata write — and every branch
   *  falls back to exactly the byte ladder that shipped without it. */
  classify(get, ctx) {
    const c = ctx || {};
    // The row's out-of-band wire era (S5 slice 8), read once and carried on every
    // decision below. It is CORROBORATION and never a row of its own: the block's
    // own `player.v` travels with the bytes it describes, and this travels with
    // the row, so nothing here may branch on it. Rows 0 and 9 return before it is
    // read, which is correct — neither has a row to describe.
    let rowSchemaVersion = null;
    const decide = (row, extra) => ({
      row,
      ...LADDER[row],
      state: null,
      serialized: null,
      rawState: null,
      anchor: null,
      writeOrdinal: null,
      rowSchemaVersion,
      ...extra,
    });

    // Row 9 is CLASSIFIED SEPARATELY and never consumes the PUT ladder's
    // ceiling: a probe that did not answer is not a write that failed, and
    // spending a backoff rung on it would take the session's saves down with
    // the network's bad minute.
    if (!get || get.failed) {
      // Fresh means "we looked at THIS row recently and it was writable". An
      // echoed anchor MOVE cancels that outright: the write landed somewhere
      // nobody has looked at, so the freshness we hold is about a different row
      // and spending it here is a blind overwrite at an unexamined anchor.
      const fresh =
        c.anchorMoved !== true &&
        typeof c.lastOkCheckAt === "number" &&
        c.lastOkCheckAt > 0 &&
        (c.now ?? 0) - c.lastOkCheckAt < CHECK_FRESH_MS;
      return decide(9, { fresh, error: get?.error ?? null });
    }
    const probe = get.probe || {};
    // Not a row at all: 404/409 are the route saying it is not here, which is a
    // MODE signal the caller acts on, not a state of the row.
    if (!probe.available) return decide(0, { status: probe.status ?? 0 });
    const body = probe.body || {};
    rowSchemaVersion = schemaVersionOf(body.schemaVersion);
    const anchor = body.anchor && typeof body.anchor === "object" ? body.anchor : null;
    const exists = body.exists === true;
    const state = body.state;
    const shaped = !!state && typeof state === "object" && !Array.isArray(state);

    // ── 1. UNPARSEABLE ────────────────────────────────────────────────────────
    // Engine #5407 hands the raw stored text back on the failure path only, so
    // the PRESENCE of the key is the corruption signal — that is what keeps a
    // damaged row distinguishable from a legitimately stored null. Older engines
    // ship neither, so the legacy inference stands in: we only ever PUT a shaped
    // object, so exists-with-nothing-shaped can only be damage.
    // NEVER rebuild from this row. At the flush site the PUT proceeds, because
    // the write IS the repair.
    if (exists) {
      const rawState = typeof body.rawState === "string" ? body.rawState : null;
      if (body.stateUnparseable === true || rawState !== null || !shaped) {
        return decide(1, { anchor, rawState, rawStateTruncated: body.rawStateTruncated === true });
      }
      // ── 2. FOREIGN GAME ORDINAL ─────────────────────────────────────────────
      // TOTAL by construction: a row with no player block, or one whose ordinal
      // is not a finite number, reads as game 1 — which is what every row
      // written before S5 is. Unshaped rows never reach here; they are row 1.
      // The row is IGNORED outright: no rebuild, no toast, and _serverSerialized
      // is NOT updated, because a row from a game the player retired is not
      // evidence about the game they are in.
      const ordinal = state.player;
      const g =
        ordinal && typeof ordinal === "object" && typeof ordinal.game === "number" && Number.isFinite(ordinal.game)
          ? ordinal.game
          : 1;
      const ours = typeof c.game === "number" && Number.isFinite(c.game) ? c.game : 1;
      if (g !== ours) return decide(2, { anchor, state, foreignGame: g });
    }

    // ── 3 / 4. NO ROW AT THIS ANCHOR, split by whether we ever had one ────────
    if (!exists) {
      if (c.serverSerialized === null || c.serverSerialized === undefined) return decide(3, { anchor });
      // We held an anchor and the row is gone: the timeline rewound PAST our
      // first save. Re-read once — a GET that lands inside the PUT route's
      // delete-then-insert window finds no row at all — and only then rewind.
      return decide(4, { anchor });
    }

    const serialized = JSON.stringify(state);
    // #5406, read defensively at every hop — see ordinalOf and the docstring.
    const rowOrdinal = ordinalOf(body.writeOrdinal);
    const putOrdinal = ordinalOf(c.putOrdinal);
    const mirrorOrdinal = ordinalOf(c.mirrorOrdinal);

    // ── 5. OWN-COMMIT SUSPECT ─────────────────────────────────────────────────
    // A PUT of ours completed while this GET was in flight, so the row it read
    // predates the one we just wrote. Adopting it would rewind the world onto a
    // state we superseded ourselves; the cure at a write site is to re-PUT.
    //
    // #5406 DISPROVES it where it can: a row whose ordinal is at or past the one
    // our own last PUT was given already carries that write, so the overlap the
    // gate detected was with a write this row has. The gate itself is unchanged —
    // without an overlap the question is not asked at all, and asking it on the
    // ordinal alone would turn every swipe-back onto an older row into a row 5
    // and kill the rewind.
    if (typeof c.seqAtIssue === "number" && c.seqAtIssue !== _writeSeq) {
      const carriesOurWrite = rowOrdinal !== null && putOrdinal !== null && rowOrdinal >= putOrdinal;
      if (!carriesOurWrite) return decide(5, { anchor, state, serialized, writeOrdinal: rowOrdinal });
    }

    // ── 6 / 7 / 8. THE BYTE COMPARISON ────────────────────────────────────────
    // The baseline is the last row we know the server held; with none, it is our
    // own snapshot, which is what makes adopt's "the row wins" and a rewind
    // check's "latch it" the same comparison with different actions.
    //
    // An echoed anchor MOVE forces the ANCHORED branch on even without a
    // baseline of our own: the write landed somewhere nobody looked, so a
    // difference there is a genuine external state and takes the rewind path
    // rather than being latched in silence. It deliberately does NOT change the
    // baseline itself — comparing against the local snapshot instead would make
    // every step the player took since the write look like an external move and
    // rewind their own walking away.
    const anchored = (c.serverSerialized !== null && c.serverSerialized !== undefined) || c.anchorMoved === true;
    const baseline =
      c.serverSerialized !== null && c.serverSerialized !== undefined
        ? c.serverSerialized
        : (c.localSerialized ?? null);
    if (serialized !== baseline) {
      // #5406 — WHICH STORE IS LATER? Only where the baseline is our own
      // metadata-booted snapshot (no anchor of ours), and only where the engine
      // says this row is not the reader's own anchor's save. Both conditions
      // matter: with an anchor of our own the row store is already this session's
      // authority, and a row that IS the visible anchor's save is a timeline claim
      // that outranks any ordinal. What is left is exactly the case the ordinal
      // was filed for — a boot whose metadata cache was written by a session that
      // never reached the row store — and there the row is the stale one.
      if (
        !anchored &&
        body.anchorMatched !== true &&
        rowOrdinal !== null &&
        mirrorOrdinal !== null &&
        rowOrdinal < mirrorOrdinal
      ) {
        return decide(5, { anchor, state, serialized, writeOrdinal: rowOrdinal, staleByOrdinal: true });
      }
      return decide(anchored ? 7 : 6, { anchor, state, serialized, writeOrdinal: rowOrdinal });
    }
    return decide(8, { anchor, state, serialized, writeOrdinal: rowOrdinal });
  },

  /** Bookkeeping every site shares: what the last completed check decided, when
   *  the last ANSWERED one was, when the last one that found a WRITABLE row was,
   *  and the anchor it read. The two clocks are not the same clock and conflating
   *  them was a bug: a row-4 check answers (so it moves `_lastCheckAt`, which is
   *  what the pre-check's skip window measures) but it found the row GONE, so it
   *  must not move `_lastOkCheckAt` — the thing row 9's freshness means. With one
   *  clock, an unresolved lost-row check made the very next teardown look fresh
   *  and ship a full-snapshot overwrite on the strength of it. */
  _recordCheck(decided) {
    this._lastCheck = decided;
    this._noteSchemaVersion(decided);
    if (decided.row !== 9) {
      this._lastCheckAt = Date.now();
      if (decided.flush === "proceed") this._lastOkCheckAt = this._lastCheckAt;
      this._anchorMoved = false; // consumed by the check it forced
      this._row9Failures = 0; // the route answered; its own ladder starts over
      if (decided.anchor) this._lastCheckedAnchor = decided.anchor;
    }
    return decided;
  },

  /** THE PRECEDENCE, stated where it is enforced (S5 slice 8). A row carries its
   *  wire era twice over: **in band** as `state.player.v`, and **out of band** as
   *  the route's own `schemaVersion` column. The in-band value is the AUTHORITY
   *  and the column is corroboration, and the reason is which one travels with
   *  the bytes: `player.v` is inside the block it describes, so a row cloned to
   *  another anchor, restored from a checkpoint, hand-edited, or written by a
   *  tool that never paired the two still reads at the version it honestly
   *  declares. The column exists so a reader that has NOT parsed the state — a
   *  future build triaging rows, an external tool reading an export — can tell
   *  the era anyway.
   *
   *  So nothing here branches on the column. The one thing worth doing when the
   *  two disagree is saying so, once per chat: it means the row was written by
   *  something that did not keep them in step, which is a fact a bug report
   *  wants and a fact no other signal carries. */
  _noteSchemaVersion(decided) {
    if (this._schemaVersionNoted) return;
    const row = decided.rowSchemaVersion;
    if (row === null || row === undefined) return;
    const block = decided.state && typeof decided.state === "object" ? decided.state.player : null;
    const inBand = block && typeof block === "object" && Number.isSafeInteger(block.v) && block.v >= 1 ? block.v : null;
    if (inBand === null || inBand === row) return;
    this._schemaVersionNoted = true;
    console.warn(
      `[pixelforge] this row is stamped schemaVersion ${row} and the player block inside it declares v ${inBand}; ` +
        "the block's own version is the authority and is what the read used",
    );
  },

  /** One GET, classified. Returns null when the generation fence closed under
   *  it — a response for the chat we left decides nothing about this one. */
  async _check(core, chatId, gen, seqAtIssue, localSerialized) {
    let get;
    try {
      get = { failed: false, probe: await PF.api.getExperienceState(chatId) };
    } catch (err) {
      get = { failed: true, error: err };
    }
    if (gen !== (this._gen ?? 0) || chatId !== core.chatId) return null;
    return this._recordCheck(
      this.classify(get, {
        serverSerialized: this._serverSerialized,
        localSerialized: localSerialized ?? this._localSerialized(core),
        seqAtIssue,
        game: this._gameOrdinal(core),
        anchorMoved: this._anchorMoved,
        lastOkCheckAt: this._lastOkCheckAt,
        now: Date.now(),
        putOrdinal: this._putOrdinal,
        mirrorOrdinal: this._mirrorOrdinal(core),
      }),
    );
  },

  /** The wire era this build stamps on a row it writes (S5 slice 8): the player
   *  block's own derived version, which is the only versioned thing in the
   *  envelope that moves. Both write paths send it, so a row's column and the
   *  `player.v` inside it agree on every row this build produces — and _check's
   *  _noteSchemaVersion is what notices when a row was written by something that
   *  did not keep them in step. Never read back as authority (see the precedence
   *  note there); it is what a reader that has not parsed the state gets. */
  _rowSchemaVersion() {
    const v = PF.player?.currentV?.();
    return typeof v === "number" && Number.isSafeInteger(v) && v >= 1 ? v : 1;
  },

  /** #5406's mirror entry for OUR metadata key: the ordinal of the last write that
   *  actually MOVED `pixelforge`. Read off the host's chatMeta, which can lag a
   *  write of our own — and lagging only ever makes the number SMALLER, so the one
   *  comparison it feeds errs toward the byte ladder rather than toward silence.
   *  Every hop is checked: the key can be absent (pre-#5406 engine), a non-object
   *  (a whole-blob metadata write clobbered it), or hold something that is not a
   *  usable ordinal. */
  _mirrorOrdinal(core) {
    const meta = core && core.host && typeof core.host.chatMeta === "object" ? core.host.chatMeta : null;
    const mirror = meta && meta[ORDINAL_MIRROR_KEY];
    if (!mirror || typeof mirror !== "object" || Array.isArray(mirror)) return null;
    return ordinalOf(Object.prototype.hasOwnProperty.call(mirror, SAVE_META_KEY) ? mirror[SAVE_META_KEY] : null);
  },

  _localSerialized(core) {
    try {
      const snap = this.snapshot(core);
      return snap ? JSON.stringify(snap) : null;
    } catch {
      return null;
    }
  },

  /** The "New game" ordinal this session is playing. Older-game rows are inert
   *  at every ladder site and are RETAINED — deletion is the player's explicit
   *  choice through the engine's management verbs (plan §8 #5). */
  _gameOrdinal(core) {
    const g = core?.sim?.player?.game;
    return typeof g === "number" && Number.isFinite(g) ? g : 1;
  },

  /** Apply a classification at a REWIND-shaped site (the turn-edge check and the
   *  flush pre-check both land here). `reread` marks the second pass row 4 asks
   *  for. Returns { acted, settled }: `acted` is whether the world changed under
   *  it, `settled` is the row the call actually ENDED on — which is not the row
   *  it was handed when a row-4 re-read resolves to something else, and the
   *  pre-check has to decide on the row that is really there. */
  async _applyRewind(core, decided, chatId, gen, seqAtIssue, reread) {
    if (decided.row === 1) {
      // A row-1 classification at ANY site means the next write repairs the row
      // and destroys the only copy of its bytes. Park them wherever that is
      // about to happen, not only at boot.
      await this._noteCorruptRow(core, chatId, decided, false);
      return { acted: false, settled: decided };
    }
    if (decided.rewind === "latch") {
      this._serverSerialized = decided.serialized;
      return { acted: false, settled: decided };
    }
    if (decided.row === 4) {
      if (!reread) {
        // ONE re-read. A GET landing inside the PUT route's delete-then-insert
        // window sees no row and would otherwise rewind a perfectly live world
        // back to its baseline, toast and all.
        const again = await this._check(core, chatId, gen, seqAtIssue);
        if (!again) return { acted: false, settled: null };
        return this._applyRewind(core, again, chatId, gen, seqAtIssue, true);
      }
      this._serverSerialized = null;
      this._rebuild(core, null);
      core.hud?.toast(decided.toast);
      // _rebuild primes _lastSerialized with the bytes it just built, so this
      // markDirty would dedupe to nothing and the row the rewind just found
      // MISSING would never be re-created. The force flag exists for exactly
      // this: the next write goes up whatever the caches say.
      this._forceWrite = true;
      this.markDirty(core);
      this._lastCheck = null; // acted on; it no longer gates teardown
      return { acted: true, settled: decided };
    }
    if (decided.row === 7) {
      this._serverSerialized = decided.serialized;
      this._rebuild(core, decided.state);
      core.hud?.toast(decided.toast);
      // The rebuilt snapshot need not serialize to the row's own bytes (a pre-S5
      // row rebuilds with a default player block on it), so the world we now
      // show still owes the server a write — and _rebuild just primed the cache
      // with those very bytes, so it owes it through the force flag.
      this._forceWrite = true;
      this.markDirty(core);
      this._lastCheck = null;
      return { acted: true, settled: decided };
    }
    return { acted: false, settled: decided };
  },

  adopt(core) {
    const task = () => this._adoptNow(core);
    this._flushChain = (this._flushChain ?? Promise.resolve()).then(task, task);
    return this._flushChain;
  },

  async _adoptNow(core) {
    if (!core.chatId || this.mode !== null) return;
    // THE LOADING GATE holds the PROBE too, not just the write: row 3's adopt
    // action is "first-write", so probing a gated chat would write the world
    // nobody has entered up as if it were play. _liftGate is what calls adopt.
    if (this.gateHolds(core)) return;
    const gen = this._gen ?? 0;
    const chatId = core.chatId;
    const seqAtIssue = _writeSeq;
    const decided = await this._check(core, chatId, gen, seqAtIssue);
    // Switched mid-probe: _check fences on the CAPTURED generation and chat id —
    // a response for the old chat must never rebuild the new one, and its
    // REJECTION must never demote the new one either (adopt() short-circuits on
    // mode !== null, so the demotion would stick for the session).
    if (!decided) return;
    if (decided.row === 9) {
      const err = decided.error;
      // A transient 500 or a network blip at boot used to cost timeline rewind
      // for the WHOLE session. Pin it instead — a pin is re-probed. …but only
      // when re-asking could plausibly get a different answer: no status at all
      // is a transport failure and 5xx is the server having a bad minute, while
      // 401/403 and every other status the route MEANT is an answer, and a
      // minute-timer re-asking it is noise the player pays for.
      this.mode = "metadata";
      const status = err && typeof err.status === "number" ? err.status : 0;
      if (status === 0 || status >= 500) this._pinMetadataMode(core);
      console.warn("[pixelforge] experience-state probe failed; using metadata saves", err);
      return;
    }
    if (decided.adopt === "metadata") {
      this.mode = "metadata";
      return;
    }
    this.mode = "routes";
    if (decided.adopt === "repair") {
      // CORRUPT ROW. Boot from metadata (which is exactly what already happened
      // — restore() ran before the probe), tell the player once, and park a
      // bounded excerpt of the damaged bytes BEFORE the repairing write goes
      // out. The row's own contents are recoverable by no other client-side
      // means, and the repair destroys them.
      await this._noteCorruptRow(core, chatId, decided, true);
      this._lastSerialized = null;
      this.markDirty(core);
      return;
    }
    void this._clearCorruptExcerpt(core, chatId);
    if (decided.adopt === "rebuild") {
      // THE ROW WINS (plan §Q2a). No client-visible datum orders the two stores
      // across a timeline move, so the anchored row is authority and the
      // metadata-booted world yields to it — and §Q2a's other half is that the
      // player is TOLD, which shipped missing. The message is the LADDER's
      // (`adoptToast`) rather than the site's, because row 6 says a different
      // thing here than it says at a rewind check.
      this._serverSerialized = decided.serialized;
      this._rebuild(core, decided.state);
      if (decided.adoptToast) core.hud?.toast(decided.adoptToast);
      return;
    }
    if (decided.anchorCache && decided.serialized !== null) this._serverSerialized = decided.serialized;
    if (decided.adopt === "first-write" || decided.adopt === "ignore") {
      // No row of ours yet — or one belonging to a game the player retired,
      // which is the same thing for our purposes. Adopt the in-memory world
      // (implicitly migrating a legacy metadata save into the anchored store).
      this._lastSerialized = null; // force the write even if metadata matched
      this.markDirty(core);
    }
  },

  /** A row-1 row will be REPAIRED by the next write, and that write destroys the
   *  only copy of the damaged bytes there is. So the park is hoisted here and
   *  called from every site that sees the classification — boot adopt, the
   *  turn-edge check, and the flush pre-check — instead of only the first of the
   *  three. First-loss-wins on the excerpt, so three sightings cost one park.
   *
   *  `tell` is separate, and deliberately not every site: the turn edge does not
   *  repair anything and nothing visible changed for the player there, so it
   *  stays silent (pinned by harness case (ad)). Boot and the pre-check both
   *  have the repairing write immediately behind them, and they say it once. */
  async _noteCorruptRow(core, chatId, decided, tell) {
    if (!decided || decided.row !== 1) return;
    if (tell && !this._corruptToasted) {
      this._corruptToasted = true;
      core.hud?.toast(decided.toast);
    }
    await this._parkCorruptExcerpt(core, chatId, decided);
  },

  /** Park the raw text of a damaged row under its own metadata key, bounded.
   *  Evidence for a bug report, not a backup: nothing client-side can turn it
   *  back into a world, and the write that repairs the row destroys it. */
  async _parkCorruptExcerpt(core, chatId, decided) {
    if (this._corruptParked || typeof decided.rawState !== "string" || !decided.rawState) return;
    this._corruptParked = true;
    const excerpt = {
      at: new Date().toISOString(),
      truncated: decided.rawStateTruncated === true || decided.rawState.length > CORRUPT_EXCERPT_CHARS,
      text: decided.rawState.slice(0, CORRUPT_EXCERPT_CHARS),
    };
    try {
      await PF.api.patchMetadata(chatId, { [CORRUPT_EXCERPT_KEY]: excerpt });
    } catch (err) {
      // The repair still proceeds. Holding the world hostage to a diagnostic
      // would be the wrong trade.
      console.warn("[pixelforge] could not park the damaged row's text; repairing anyway", err);
    }
  },

  /** …and the next healthy adopt takes it away again. The metadata PATCH has no
   *  delete-by-null convention (it is a shallow merge), so the key is nulled
   *  rather than removed. */
  async _clearCorruptExcerpt(core, chatId) {
    const meta =
      core.host && typeof core.host.chatMeta === "object" && core.host.chatMeta !== null ? core.host.chatMeta : null;
    if (!meta || meta[CORRUPT_EXCERPT_KEY] == null) return;
    try {
      await PF.api.patchMetadata(chatId, { [CORRUPT_EXCERPT_KEY]: null });
      meta[CORRUPT_EXCERPT_KEY] = null;
    } catch (err) {
      console.warn("[pixelforge] could not clear the parked damaged-row text", err);
    }
  },

  /** Metadata mode entered by FAILURE rather than by a 404/409 mode signal
   *  (plan §Q2a). Re-probed once after the first metadata write that lands and
   *  on a ~60s timer until it clears, which shrinks the window in which a
   *  pinned session's play is stranded outside the timeline-anchored store. */
  _pinMetadataMode(core) {
    this._probePinned = true;
    this._reprobedAfterFlush = false;
    if (this._reprobeTimer) return;
    this._reprobeFailures = 0; // a fresh pin gets a fresh rung count, not the last one's
    const gen = this._gen ?? 0;
    this._reprobeTimer = setInterval(() => {
      if (gen !== (this._gen ?? 0)) return; // reset() clears the timer; belt and braces
      void this._reprobe(core);
    }, REPROBE_INTERVAL_MS);
  },

  _stopReprobe() {
    if (this._reprobeTimer) {
      clearInterval(this._reprobeTimer);
      this._reprobeTimer = 0;
    }
    this._reprobeInFlight = false;
  },

  /** Retry the routes probe for a pinned session. On success this is a FIRST
   *  WRITE, never the rewind path: the pinned session has been playing against
   *  metadata, so its in-memory world is the live one and the route store has
   *  nothing of ours to compare against. _lastSerialized = null forces the
   *  write; _serverSerialized stays null so checkRewind's own null guards keep
   *  it inert until that write establishes the anchor. */
  async _reprobe(core) {
    if (!this._probePinned || this.mode !== "metadata" || !core.chatId || this._reprobeInFlight) return;
    this._reprobeInFlight = true;
    const gen = this._gen ?? 0;
    const chatId = core.chatId;
    try {
      const probe = await PF.api.getExperienceState(chatId);
      if (gen !== (this._gen ?? 0) || chatId !== core.chatId) return;
      if (!probe.available) {
        // Not a failure after all — this engine or chat genuinely has no
        // Experience row. Stop asking.
        this._probePinned = false;
        this._stopReprobe();
        return;
      }
      this.mode = "routes";
      this._probePinned = false;
      this._stopReprobe();
      this._serverSerialized = null;
      this._lastSerialized = null;
      // …and the LADDER state the pinned session accumulated goes with it. The
      // pin was created by a row-9 boot probe, so _lastCheck is that row 9 with
      // _lastOkCheckAt still at 0 — carried into routes mode it makes
      // _teardownAllowed() refuse the very first pagehide after the promotion,
      // on the strength of a check that decided the mode and nothing else. A
      // freshly promoted session has never looked at its row, which is exactly
      // the "never checked at all" case the gate treats as a proceed.
      this._lastCheck = null;
      this._lastCheckAt = 0;
      this._lastOkCheckAt = 0;
      this._lastCheckedAnchor = null;
      this._anchorMoved = false;
      this._row9Failures = 0;
      // …and a flush already parked in an await would put _lastSerialized
      // straight back when it lands, cancelling the promotion's first write
      // with nothing to show for it. The force flag outlives that: only the
      // write that consumes it clears it.
      this._forceWrite = true;
      this.markDirty(core);
    } catch {
      // Still pinned, but not forever: eight failed rungs and the timer stops.
      // The pin itself stays set, so a metadata write that lands later still
      // earns its one-shot re-probe on real evidence the network came back.
      this._reprobeFailures += 1;
      if (this._reprobeFailures >= REPROBE_GIVEUP) this._stopReprobe();
    } finally {
      if (gen === (this._gen ?? 0)) this._reprobeInFlight = false;
    }
  },

  /** Routes mode, on each finished turn: if the server state moved under us
   *  (swipe, branch, checkpoint load — all rewrite the visible anchor), rebuild
   *  the world from it. Our own writes keep _serverSerialized current, so this
   *  only fires on external timeline changes. */
  checkRewind(core) {
    // On the flush chain, not beside it. The "our own writes keep
    // _serverSerialized current" invariant that makes this safe lived entirely
    // in a comment: a rewind check interleaving with a flush's awaits could
    // read the row we were halfway through replacing and rebuild the sim onto
    // it, discarding the pending local mutation. Serializing them makes the
    // arrangement structural instead of accidental.
    const task = () => this._checkRewindNow(core);
    this._flushChain = (this._flushChain ?? Promise.resolve()).then(task, task);
    return this._flushChain;
  },

  async _checkRewindNow(core) {
    if (this.mode !== "routes" || !core.chatId || this._rewindCheckInFlight) return;
    // Belt and braces behind the gate: a gated chat never reaches routes mode
    // (adopt is held), but the turn edge fires on host props and the invariant
    // "nothing touches the world while the gate holds" should not depend on that.
    if (this.gateHolds(core)) return;
    this._rewindCheckInFlight = true;
    const gen = this._gen ?? 0;
    const chatId = core.chatId;
    const seqAtIssue = _writeSeq;
    try {
      const decided = await this._check(core, chatId, gen, seqAtIssue);
      if (!decided) return; // switched mid-probe, or the chat moved under it
      // Row 9 is transient and the next turn edge retries; rows 2 and 5 both
      // resolve to "ignore" and touch nothing — a retired game's row and a row
      // our own write overtook are neither of them evidence that the timeline
      // moved. Row 1 also touches the world not at all, but it does park the
      // damaged row's bytes: the next flush's PUT is the repair, and it is the
      // last moment anything can read them.
      await this._applyRewind(core, decided, chatId, gen, seqAtIssue, false);
    } finally {
      // A stale completion must not clear the NEW chat's in-flight flag.
      if (gen === (this._gen ?? 0)) this._rewindCheckInFlight = false;
    }
  },

  _rebuild(core, saved) {
    const meta =
      core.host && typeof core.host.chatMeta === "object" && core.host.chatMeta !== null ? core.host.chatMeta : {};
    core.sim = this.simFromSaved(saved, meta, core.chatId);
    this._lastSerialized = JSON.stringify(this.snapshot(core));
    core.render?.clearZones();
    // A rebuild can change the theme; the asset loader is theme-aware and
    // no-ops when nothing changed.
    void PF.assets.load(core);
    core.hud?.refreshChips();
  },

  markDirty(core) {
    // THE LOADING GATE (plan §Q3b): a chat that has not entered play emits
    // nothing. Refused HERE and not merely at the write, so a gated chat arms no
    // timer either — a world nobody is playing should cost no wakeups.
    if (this.gateHolds(core)) return;
    if (this._timer) return; // a live timer already covers it — a backoff rung included
    this._timerIsBackoff = false;
    this._timer = setTimeout(() => {
      this._timer = 0;
      this._timerIsBackoff = false;
      void this.flush(core, false);
    }, 2500);
  },

  /** What a flush would write, decided against the caches AS THEY STAND NOW.
   *  Route persistence and metadata-cache persistence dedupe SEPARATELY: a
   *  failed cache write must keep retrying on later flushes even while the
   *  route row is already current. Returns null when there is nothing pending.
   *  Throws whatever snapshot/stringify throws — every caller is inside a
   *  guard, and swallowing it here would hide a real serialization bug. */
  _pendingWrite(core) {
    // THE LOADING GATE, at the one chokepoint every write path passes through:
    // the debounce, the retry ladder, the chat-switch capture and the last-detach
    // flush all resolve their payload here, so one refusal covers all four. The
    // pagehide path builds its own snapshot and carries its own (flushTeardown).
    if (this.gateHolds(core)) return null;
    const snap = this.snapshot(core);
    if (!snap || !core.chatId) return null;
    const serialized = JSON.stringify(snap);
    // _forceWrite outranks both caches: it exists precisely because a cache can
    // be reassigned by a flush that was already in flight when the force was set.
    const forced = this._forceWrite;
    const routeNeeded = forced || serialized !== this._lastSerialized;
    const metaNeeded = forced || this._metaSerialized !== serialized;
    if (!routeNeeded && (this.mode !== "routes" || !metaNeeded)) return null;
    return {
      chatId: core.chatId,
      sim: core.sim,
      snap,
      serialized,
      routeNeeded,
      metaNeeded,
      forced,
      mode: this.mode,
      gen: this._gen ?? 0,
    };
  },

  /** Pre-flight fallback. When the snapshot will not fit, the FIRST thing to
   *  drop is a newer build's block: our own state is what this session is
   *  playing, and a build older than slice 1 wrote rows without any carry at
   *  all — so dropping it is a return to the previous contract, not new loss.
   *  Returns null when there is no carry to drop; the caller decides whether
   *  what comes back actually fits.
   *
   *  A slim write leaves the caches holding the SLIM bytes, so the next flush
   *  re-snapshots with the carry and trips the pre-flight again. That is the
   *  point: the moment the newer build's block shrinks back under the wall we
   *  start carrying it again, and the cost meanwhile is one repeat write of
   *  bytes the server already has, on save events the player generates anyway. */
  _snapshotWithoutCarry(sim, chatId) {
    const extra = sim && sim._envelopeExtra;
    const envelopeCarry = extra && Object.keys(extra).length > 0;
    // The block carries unknown keys of its own now, and either carry alone is
    // reason enough to try the slim snapshot: a foreign field that only exists
    // INSIDE `player` used to leave this returning null and the session
    // degrading with a shed still available.
    let blockCarry;
    try {
      const full = PF.player.serialize(sim?.player);
      const slim = PF.player.serialize(sim?.player, true);
      blockCarry = JSON.stringify(full) !== JSON.stringify(slim);
    } catch {
      blockCarry = false;
    }
    if (!envelopeCarry && !blockCarry) return null;
    const snap = this.snapshot({ sim, chatId }, true);
    if (!snap) return null;
    return { snap, serialized: JSON.stringify(snap) };
  },

  /** Chat switch: the pending write belongs to the chat being LEFT, so it has
   *  to be captured SYNCHRONOUSLY. The chained flush that used to serve this
   *  seam snapshotted when the chain got round to it — by which time reset()
   *  had cleared the dedupe caches and core.chatId/core.sim had been
   *  reassigned, so it wrote the NEW chat's world under the new id and the
   *  mutation still sitting in the old chat's 2.5s debounce window was gone. */
  captureFlush(core) {
    try {
      return this._pendingWrite(core);
    } catch (err) {
      console.warn("[pixelforge] chat-switch snapshot failed", err);
      return null;
    }
  },

  /** Serialize flushes: a teardown flush and a debounced flush can otherwise
   *  overlap and double-write (the dedupe check reads _lastSerialized, which is
   *  only written after the awaits). `.then(task, task)` and not `.then(task)`:
   *  a rejected link used to skip every task queued behind it and leave the
   *  chain permanently rejected, so one bad flush killed all later saves.
   *  `capture` is a pre-taken _pendingWrite for the chat-switch seam. */
  flush(core, teardown, capture) {
    const task = () => this._flushNow(core, teardown, capture);
    this._flushChain = (this._flushChain ?? Promise.resolve()).then(task, task);
    return this._flushChain;
  },

  async _flushNow(core, teardown, capture) {
    // A backoff rung is NOT cancellable by an unrelated flush. Cancelling it
    // and letting _rearm re-arm from here would make the ladder measure the
    // time since the last TRIGGER instead of the time since the outage began —
    // and a teardown flush, which never re-arms at all, would silently delete
    // the pending retry outright.
    if (!capture && this._timer && !this._timerIsBackoff) {
      clearTimeout(this._timer);
      this._timer = 0;
    }
    let job = null;
    try {
      // Snapshot and stringify INSIDE the try: outside it, a throwing
      // serialization rejected the chain rather than costing one flush.
      job = capture ?? this._pendingWrite(core);
      if (!job) return;
      // Every post-await assignment is fenced on the generation the job was
      // built at. A chat-switch capture is stale by construction (reset()
      // bumped the counter before this ran), so its write lands but touches
      // none of the new chat's caches, dirty flag, or retry state.
      const fresh = () => job.gen === (this._gen ?? 0);
      if (job.serialized.length > MAX_SNAPSHOT_CHARS) {
        // Before giving up on the session, drop the one part of the payload
        // that is not ours. A newer build's block is unreadable here and can be
        // arbitrarily large; the world the player is standing in outranks it.
        const slim = this._snapshotWithoutCarry(job.sim, job.chatId);
        if (!slim || slim.serialized.length > MAX_SNAPSHOT_CHARS) {
          if (fresh()) {
            this._degrade(
              core,
              slim
                ? `this world's own save is ${slim.serialized.length} chars, over the limit even with a newer build's block dropped`
                : `this world's own save is ${job.serialized.length} chars`,
            );
          }
          return;
        }
        console.warn(
          `[pixelforge] a newer build's data does not fit (${job.serialized.length} chars); saving this world's own state without it`,
        );
        job = { ...job, snap: slim.snap, serialized: slim.serialized };
      }
      // Did anything reach the server? A flush where the route row landed and
      // the write-through cache did NOT is a partial write, and counting it as
      // landed resets the failure counter — which pins the ladder at its bottom
      // rung and retries a broken metadata route every 2.5s for the session.
      let landed = false;
      if (job.mode === "routes") {
        // CHECK, THEN WRITE (plan §Q2). A PUT is a full-snapshot overwrite of
        // whatever stands at the visible anchor, so writing without looking is
        // how a swipe-back gets clobbered by a debounce timer that fired half a
        // second later. Rows 4 and 7 are the two that block; everything else
        // proceeds, including the damaged row (the write is the repair) and the
        // retired game's row (ours outranks it).
        //
        // `teardown` here is the LAST-DETACH flush (90-element:91) and nothing
        // else — pagehide takes flushTeardown, which never reaches this
        // function. The page is alive on a detach, so it gets the ordinary
        // checked write its own comment already claims for it; skipping the
        // check meant the one write most likely to be racing a swipe was the
        // one write that never looked.
        if (job.routeNeeded) {
          const gate = await this._precheck(core, job);
          if (gate === "block") return;
          if (gate === "cache-only") {
            // Row 9: the route did not answer. That forbids the PUT — a
            // full-snapshot overwrite of a row we have not seen — and forbids
            // nothing else. The write-through metadata cache is ours outright
            // and is exactly what an old-engine or cold boot reads next, so
            // abandoning the whole flush over an unanswered GET was three
            // persistence paths stopped by one.
            job = { ...job, routeNeeded: false };
          }
          // …and the derived clean-gate on top, for the detach path: the
          // pre-check may have been skipped as fresh, in which case this is the
          // last completed check's verdict rather than a new one.
          //
          // SCOPED TO THE ROUTE WRITE (round-2 fix), and the order is why: the
          // gate protects the PUT, the one write nobody takes back, and row 9
          // above has already withdrawn it. Unscoped, the gate then re-blocked
          // on that same row 9 — the cache-only downgrade sets _lastCheck
          // unconditionally — and killed the metadata PATCH as well, so a detach
          // during a GET outage wrote NOTHING. There is no route write left here
          // to gate.
          if (teardown && job.routeNeeded && !this._teardownAllowed()) return;
        }
        // Route row first (the authority), metadata second as write-through
        // boot cache + old-engine fallback. A metadata failure is non-fatal
        // once the route write landed — but it stays pending and retries.
        if (job.routeNeeded) {
          const echo = await PF.api.putExperienceState(job.chatId, job.snap, teardown, this._rowSchemaVersion());
          // Bumped OUTSIDE the fence: _writeSeq is process-global, not per-chat.
          // A captured chat-switch PUT is stale for every cache on this object
          // and still completed on the wire, so a GET issued before it must not
          // be adopted as authority. A spurious bump costs one discarded rewind
          // check; a missed one costs a rewind onto a superseded row.
          _writeSeq += 1;
          landed = true;
          if (fresh()) {
            // INSIDE the fence, unlike _writeSeq: the echoed anchor and the
            // moved flag are per-chat caches, and a captured chat-switch write
            // says nothing about the anchor the chat we are now on is sitting on.
            this._noteAnchorEcho(echo);
            this._serverSerialized = job.serialized;
            this._lastSerialized = job.serialized;
            if (job.forced) this._forceWrite = false;
            if (job.sim) job.sim.dirty = false;
          }
        }
        let cacheError = null;
        if (job.metaNeeded) {
          try {
            await PF.api.patchMetadata(job.chatId, { [SAVE_META_KEY]: job.snap }, teardown);
            landed = true;
            if (fresh()) this._metaSerialized = job.serialized;
          } catch (err) {
            cacheError = err;
          }
        }
        if (cacheError) {
          // Through the classifier, not a bare markDirty: that re-armed a flat
          // 2.5s retry forever against a route that had already refused. The
          // 409 branch is suppressed — a 409 HERE is the metadata route
          // talking, and dropping route authority on it would be a non sequitur.
          this._onWriteFailed(core, cacheError, teardown, job, true);
        } else if (landed && fresh()) {
          this._onWriteLanded(core);
        }
        return;
      }
      await PF.api.patchMetadata(job.chatId, { [SAVE_META_KEY]: job.snap }, teardown);
      if (fresh()) {
        this._lastSerialized = job.serialized;
        this._metaSerialized = job.serialized;
        if (job.forced) this._forceWrite = false;
        if (job.sim) job.sim.dirty = false;
        this._onWriteLanded(core);
      }
    } catch (err) {
      this._onWriteFailed(core, err, teardown, job);
    }
  },

  /** A write landed. Clears the backoff and the degraded flag — claiming a
   *  session is still degraded after a successful write would be a lie — but
   *  NOT _degradeToasted, so the player is told once per chat, not once per
   *  flap. Also the moment a pinned session earns its first re-probe. */
  _onWriteLanded(core) {
    this._flushFailures = 0;
    this.degraded = false;
    if (this._probePinned && !this._reprobedAfterFlush) {
      this._reprobedAfterFlush = true;
      void this._reprobe(core);
    }
  },

  /** Classify a failed write. Silence was the old policy — one console.warn
   *  and the hope that some unrelated future dirty event would retry.
   *
   *  `cacheOnly` marks the routes-mode write-through PATCH: same ladder, same
   *  terminal statuses, but never the 409 fallback. A 409 from the metadata
   *  route says nothing about whether this chat still holds its Experience
   *  stamp, and dropping route authority on it would be a non sequitur. */
  _onWriteFailed(core, err, teardown, job, cacheOnly) {
    console.warn(cacheOnly ? "[pixelforge] metadata cache save failed; will retry" : "[pixelforge] save failed", err);
    // No job means snapshot/stringify itself threw: a code fault, not a write
    // failure. It costs this one flush and nothing else — backing off would
    // just re-run the same throw on a timer.
    if (!job) return;
    if (job.gen !== (this._gen ?? 0)) return; // a stale capture owns none of this state
    const status = err && typeof err.status === "number" ? err.status : 0;
    if (status === 413 || status === 422) {
      // Terminal: the payload is refused at this size and will be refused at
      // this size again. Retrying is a loop, so stop, say so, and keep
      // mutating in memory.
      this._degrade(core, `server refused the save (${status})`);
      return;
    }
    if (status === 409 && job.mode === "routes" && !cacheOnly) {
      // The chat lost its Experience stamp after adopt() committed to routes
      // mode. Every later PUT would fail exactly this way forever, so fall
      // back and let the re-probe machinery promote it again if it returns.
      this.mode = "metadata";
      this._serverSerialized = null;
      this._pinMetadataMode(core);
      console.warn("[pixelforge] experience-state route rejected the chat (409); falling back to metadata saves");
      if (!teardown) this.markDirty(core);
      return;
    }
    // Everything else — network, no status, 5xx, and any other 4xx — takes the
    // bounded ladder. An unretryable 4xx costs eight quiet attempts and then
    // stops, which is cheaper than enumerating statuses we have never seen.
    this._rearm(core, teardown);
  },

  /** The flush site's rung of the ladder. Returns "proceed", "block", or
   *  "cache-only" — the last meaning "not the route row, but the write-through
   *  metadata cache is still fine to take it".
   *
   *  The GET is SKIPPED while the last successful check is inside one debounce
   *  window: the pre-check exists so a PUT never lands on a row nobody looked
   *  at, and the turn-edge check that ran a moment ago looked at it. Without
   *  that skip every save would cost two requests instead of one, on a route
   *  that re-serializes the chat's whole shard.
   *
   *  A blocking row is NOT a write failure and must not touch the backoff
   *  ladder: the server is fine, the timeline moved. The rewind is applied and
   *  the rebuilt world re-arms an ordinary debounce of its own. */
  async _precheck(core, job) {
    const gen = job.gen;
    if (gen !== (this._gen ?? 0)) return "proceed"; // a chat-switch capture owns none of this
    const now = Date.now();
    if (
      this._lastCheck &&
      this._lastCheck.row !== 9 &&
      now - this._lastCheckAt < CHECK_FRESH_MS &&
      !this._anchorMoved
    ) {
      return this._lastCheck.flush === "block" ? "block" : "proceed";
    }
    const seqAtIssue = _writeSeq;
    const decided = await this._check(core, job.chatId, gen, seqAtIssue, job.serialized);
    if (!decided) return "proceed"; // fenced out: the capture's write still belongs on the wire
    if (decided.flush === "fresh") {
      // The probe did not answer. That is not a reason to spend a backoff rung —
      // but it is a reason not to overwrite a row we have not seen in a while.
      const fresh = decided.fresh === true;
      if (!fresh) {
        this._rearmRow9(core);
        return "cache-only";
      }
      return "proceed";
    }
    if (decided.flush === "block") {
      const applied = await this._applyRewind(core, decided, job.chatId, gen, seqAtIssue, false);
      // Decide on the row that is ACTUALLY there, not the one we were handed.
      // Row 4's re-read exists because a GET can land inside the PUT route's
      // delete-then-insert window; when it comes back row 8 the row is alive and
      // byte-identical, the world is not stale, and blocking anyway dropped a
      // whole debounce cycle with nothing re-armed to carry it. Only a row that
      // still blocks after the re-read blocks the write.
      const settled = applied.settled;
      if (applied.acted || !settled) return "block";
      if (settled.flush === "block") return "block";
      if (settled.flush === "fresh") {
        if (settled.fresh !== true) {
          this._rearmRow9(core);
          return "cache-only";
        }
        return "proceed";
      }
      await this._noteCorruptRow(core, job.chatId, settled, true);
      return "proceed";
    }
    await this._noteCorruptRow(core, job.chatId, decided, true);
    if (decided.anchorCache && decided.serialized !== null && this._serverSerialized !== null) {
      // Latch a row we agree with, so the next check has a current baseline.
      this._serverSerialized = decided.serialized;
    }
    return "proceed";
  },

  /** Row 9's OWN ladder. A GET route that will not answer is not a write that
   *  failed, so it must not spend a rung of the write backoff — but the old cure
   *  was a bare markDirty, which re-armed a flat 2.5 s poll for as long as the
   *  outage lasted and put no ceiling on it at all. Same shape as _rearm, same
   *  give-up point, same landing place: after the last rung the session falls
   *  back to trigger-driven saves rather than polling a dead route forever. Any
   *  answered check resets it (_recordCheck). */
  _rearmRow9(core) {
    this._row9Failures = (this._row9Failures ?? 0) + 1;
    if (this._row9Failures > FLUSH_BACKOFF_GIVEUP) return;
    if (this._timer) return; // a live timer already covers it, and sooner
    const delay = FLUSH_BACKOFF_MS[Math.min(this._row9Failures - 1, FLUSH_BACKOFF_MS.length - 1)];
    this._timerIsBackoff = true;
    this._timer = setTimeout(() => {
      this._timer = 0;
      this._timerIsBackoff = false;
      void this.flush(core, false);
    }, delay);
  },

  /** THE PUT-ANCHOR ECHO (plan §Q2). The row lands at whatever the visible
   *  anchor is when the write is SERVED, and a turn can finish between the check
   *  and the write. When the echoed anchor is not the one we checked, two things
   *  follow and both are load-bearing: the next flush may NOT skip its pre-check
   *  as fresh (that freshness was about a different anchor), and a difference
   *  found there takes the rewind path instead of being latched in silence. */
  _noteAnchorEcho(echo) {
    // #5406 rides the same echo, and it is recorded BEFORE the anchor guard: the
    // ordinal is the only thing that can tell a row carrying our own last write
    // from one that predates it, and a route that answered without an anchor
    // still told us which ordinal our row was given.
    const ordinal = ordinalOf(echo && typeof echo === "object" ? echo.writeOrdinal : null);
    if (ordinal !== null) this._putOrdinal = ordinal;
    const anchor =
      echo && typeof echo === "object" && echo.anchor && typeof echo.anchor === "object" ? echo.anchor : null;
    if (!anchor) return;
    const last = this._lastCheckedAnchor;
    if (last && (anchor.messageId !== last.messageId || anchor.swipeIndex !== last.swipeIndex))
      this._anchorMoved = true;
    this._lastCheckedAnchor = anchor;
  },

  /** Teardown's clean-gate, DERIVED from the ladder rather than guessed at.
   *  Only rows 4 and 7 block — the two that say the timeline moved and our
   *  snapshot is the stale one. Row 9 blocks only once its freshness lapses: a
   *  probe that failed thirty seconds ago says nothing useful about the row, and
   *  a keepalive PUT is the one write nobody gets to take back. Never having
   *  checked at all is a PROCEED: that is a fresh chat, and its first write is
   *  the row's creation. */
  _teardownAllowed() {
    // The clean-set is DERIVED FROM THE ROUTE LADDER, and metadata mode has no
    // row in it. A boot probe that failed both picked the mode and left a row-9
    // _lastCheck behind, and that row-9 with no successful check to measure
    // against then refused every teardown write for the rest of the session —
    // in a mode where the only store is a metadata key the PATCH owns outright
    // and no anchor can move under.
    if (this.mode !== "routes") return true;
    const last = this._lastCheck;
    if (!last) return true;
    if (last.flush === "block") return false;
    // Row 9. Measured against the last check that found the row WRITABLE, not
    // the last one that merely answered: an unresolved row 4 answers, moves the
    // answered-clock, and means the opposite of fresh. And an echoed anchor move
    // cancels freshness outright, because whatever we last saw, we did not see
    // it at the anchor this write would land on.
    if (last.flush === "fresh") return !this._anchorMoved && Date.now() - this._lastOkCheckAt < CHECK_FRESH_MS;
    return true;
  },

  _rearm(core, teardown) {
    if (teardown || this.degraded) return;
    this._flushFailures += 1;
    if (this._flushFailures > FLUSH_BACKOFF_GIVEUP) return; // fall back to trigger-driven saves
    if (this._timer) return; // a live timer already covers it, and sooner
    const delay = FLUSH_BACKOFF_MS[Math.min(this._flushFailures - 1, FLUSH_BACKOFF_MS.length - 1)];
    // Shares markDirty's timer on purpose: while a server is failing, a busy
    // player must not be able to reset the backoff to 2.5s on every zone change.
    // _timerIsBackoff is what makes that hold in the other direction too — see
    // _flushNow, which declines to cancel a rung it did not arm.
    this._timerIsBackoff = true;
    this._timer = setTimeout(() => {
      this._timer = 0;
      this._timerIsBackoff = false;
      void this.flush(core, false);
    }, delay);
  },

  /** Stop retrying, tell the player once, keep playing. Mutations continue in
   *  memory; they are simply not reaching the server. */
  _degrade(core, reason) {
    this.degraded = true;
    console.warn(`[pixelforge] save degraded: ${reason}; progress stays in this session`);
    if (this._degradeToasted) return;
    this._degradeToasted = true;
    core.hud?.toast("This world is too large to save — progress stays in this session only.");
  },

  /** The page is going away (pagehide). This must NOT queue behind _flushChain:
   *  an ordinary flush sitting mid-await would swallow the last write of the
   *  session entirely. So it snapshots synchronously off the live sim and fires
   *  BOTH keepalive requests without awaiting between them — awaiting the PUT
   *  first lets the unload land before the PATCH is even dispatched.
   *
   *  Sized against the KEEPALIVE wall, which is this path's own and nobody
   *  else's: the Fetch standard caps TOTAL in-flight keepalive body bytes at
   *  64 KiB (65,536) per origin, and routes mode sends two bodies against that
   *  one quota. MAX_SNAPSHOT_CHARS does not imply it and is not meant to — the
   *  server cap bounds an ORDINARY flush, this bounds the pair a dying page
   *  fires. So the gate here is 2 × TextEncoder-encoded bytes ≤
   *  KEEPALIVE_PAIR_BUDGET_BYTES, and when the pair does not fit the PUT goes
   *  alone — losing the write-through cache is a repairable inconvenience,
   *  losing both is the session.
   *
   *  Remount-detach keeps the ordinary chained path (90-element) — the page is
   *  alive there and a re-arm is still worth something. */
  flushTeardown(core) {
    if (!core || !core.chatId || !core.sim) return;
    // THE LOADING GATE. This path does not go through _pendingWrite, so it needs
    // its own refusal — and it is the path that would matter most: closing the tab
    // while the world is still generating must not stamp the placeholder world
    // into the row store on the way out.
    if (this.gateHolds(core)) return;
    let snap;
    let serialized = "";
    try {
      snap = this.snapshot(core);
      if (!snap) return;
      serialized = JSON.stringify(snap);
    } catch (err) {
      console.warn("[pixelforge] teardown snapshot failed", err);
      return;
    }
    // THE CLEAN-GATE, derived from the decision ladder (plan §3.4): the write
    // goes out iff the bytes actually changed AND the last completed check
    // resolved to a proceed row. Teardown cannot afford a GET of its own — the
    // page is going away and an await would spend the unload window — so it
    // spends the last check's verdict instead. Only rows 4 and 7 block.
    if (serialized === this._lastSerialized) return;
    if (!this._teardownAllowed()) {
      console.warn("[pixelforge] teardown declined: the last check said the timeline moved under this world");
      return;
    }
    if (serialized.length > MAX_SNAPSHOT_CHARS) {
      // Same order as the ordinary flush: a newer build's block is the first
      // thing to drop, and this world's own state is the last.
      const slim = this._snapshotWithoutCarry(core.sim, core.chatId);
      if (!slim || slim.serialized.length > MAX_SNAPSHOT_CHARS) {
        this._degrade(
          core,
          slim
            ? `this world's own save is ${slim.serialized.length} chars, over the limit even with a newer build's block dropped`
            : `this world's own save is ${serialized.length} chars`,
        );
        return;
      }
      console.warn(
        `[pixelforge] a newer build's data does not fit (${serialized.length} chars); saving this world's own state without it`,
      );
      snap = slim.snap;
      serialized = slim.serialized;
    }
    const chatId = core.chatId;
    const routes = this.mode === "routes";
    // The keepalive quota is shared by the pair; see the docstring.
    const pairFits = 2 * new TextEncoder().encode(serialized).length <= KEEPALIVE_PAIR_BUDGET_BYTES;
    if (routes && !pairFits) {
      console.warn(
        "[pixelforge] teardown pair exceeds the keepalive quota; sending the route save alone (the metadata cache repairs on the next load)",
      );
    }
    // A pagehide is not always a death: bfcache restores the page and play
    // carries on against this very singleton. Leaving the caches holding the
    // PRE-teardown bytes then makes the next checkRewind read the row we just
    // wrote, find it different from _serverSerialized, and "rewind" the world
    // onto our own write — discarding whatever happened after the restore, with
    // a toast to announce it. So each request updates the cache it owns WHEN IT
    // LANDS, fenced on the generation the teardown was taken at. If the page
    // really does die, none of these handlers ever run, which is the point.
    const gen = this._gen ?? 0;
    const fresh = () => gen === (this._gen ?? 0);
    // `unfenced` runs on ANY success, `onLanded` only while the generation the
    // teardown was taken at is still current. The split is the same one
    // _flushNow makes and states as an invariant at :1231-1236: per-chat caches
    // are fenced, _writeSeq is not, because it is process-global and a write
    // that completed on the wire superseded every row a GET could still be
    // holding — whichever chat we happen to be on when it lands.
    const settle = (promise, what, onLanded, unfenced) => {
      if (!promise || typeof promise.then !== "function") return;
      promise.then(
        (value) => {
          if (unfenced) unfenced(value);
          if (fresh()) onLanded(value);
        },
        (err) => console.warn(`[pixelforge] teardown ${what} failed`, err),
      );
    };
    // Both started before either is awaited.
    const put = routes ? PF.api.putExperienceState(chatId, snap, true, this._rowSchemaVersion()) : null;
    const patch = routes && !pairFits ? null : PF.api.patchMetadata(chatId, { [SAVE_META_KEY]: snap }, true);
    settle(
      put,
      "route save",
      (echo) => {
        // A pagehide is not always a death: if the page comes back, the anchor
        // the teardown write actually landed on is what the next check has to
        // reason against.
        this._noteAnchorEcho(echo);
        this._serverSerialized = serialized;
        this._lastSerialized = serialized;
      },
      () => {
        _writeSeq += 1; // any GET issued before this point read a superseded row
      },
    );
    settle(patch, "metadata save", () => {
      this._metaSerialized = serialized;
      // In metadata mode the PATCH is the authority, not a cache, so it owns
      // the route-side dedupe too — exactly as _flushNow assigns them together.
      if (!routes) this._lastSerialized = serialized;
    });
  },
};

// Registry completeness, in 20-world's startup-assertion idiom: ENVELOPE_KEYS
// and the snapshot literal have to agree in BOTH directions, and neither
// direction fails loudly on its own.
//   • a key emitted but NOT listed → simFromSaved treats it as foreign on the
//     way in and parks a stale copy of our own field on _envelopeExtra;
//   • a key listed but NOT emitted → the read skips it and the write omits it,
//     so a newer build's field is silently deleted. That is the slice-1 bug.
// Cheap enough to run at load: one snapshot off a synthetic sim.
{
  const probe = PF.save.snapshot({
    chatId: "",
    sim: {
      world: { seed: 0, theme: "", bindings: {} },
      zoneId: "",
      x: 0,
      y: 0,
      facing: 0,
      clockMin: 0,
      day: 1,
      intro: null,
      _envelopeExtra: null,
    },
  });
  for (const key of Object.keys(probe)) {
    if (!ENVELOPE_KEYS.has(key))
      throw new Error(`pixelforge: snapshot emits "${key}", which ENVELOPE_KEYS does not list`);
  }
  for (const key of ENVELOPE_KEYS) {
    if (!(key in probe)) throw new Error(`pixelforge: ENVELOPE_KEYS lists "${key}", which snapshot does not emit`);
  }
}

// ===== 70-hud.js =====
// ── HUD (main mount) ──────────────────────────────────────────────────────────
// Everything interactive lives here, in the z-30 main mount: location/clock
// chips, touch D-pad, Talk / Travel / Keyboard controls, toasts. The root is
// pointer-events:none; each control opts back in — clicks in empty space fall
// through to the narration below (host contract).
PF.Hud = class {
  constructor(rootEl, core) {
    this.core = core;
    const chip =
      "pointer-events:auto;background:rgba(20,24,20,0.82);color:#f3efe2;border:1px solid rgba(243,239,226,0.25);" +
      "border-radius:6px;padding:3px 9px;font:600 11px/1.5 ui-monospace,Consolas,monospace;white-space:nowrap;";
    const S = {
      chip,
      // THE PANEL OPENERS' clothes (plan §2.8). The topbar has NO width machinery
      // — centred flex, nowrap chips, unbounded location prose, no overflow
      // handling — so the openers are GLYPH-WIDTH by construction: one emoji plus
      // an aria-label, never a word that grows with a translation. That IS the
      // width argument, and it is what keeps the bar to the single row the
      // location toast is pinned 42px under. They are BUTTONS rather than the
      // spans beside them, because a control has to be pressable and focusable;
      // `pointer-events:auto` is already on the chip they wear.
      chipBtn: `${chip}cursor:pointer;padding:3px 8px;`,
      btn:
        "pointer-events:auto;background:rgba(20,24,20,0.88);color:#f3efe2;border:1px solid rgba(243,239,226,0.35);" +
        "border-radius:8px;padding:9px 13px;font:700 12px/1 ui-monospace,Consolas,monospace;cursor:pointer;min-height:40px;",
    };
    this.S = S;

    // Cutscene caption: centred, non-interactive, only while a beat runs.
    this.captionEl = PF.el("div", {
      style:
        "position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);max-width:70%;text-align:center;" +
        "pointer-events:none;opacity:0;transition:opacity .5s;background:rgba(12,14,12,0.72);color:#f3efe2;" +
        "border-radius:10px;padding:10px 16px;font:600 13px/1.55 ui-monospace,Consolas,monospace;z-index:3;",
    });
    // A beat appears and clears on its own, so the caption has to announce itself:
    // opacity is invisible to a screen reader, which would neither read a new beat
    // out nor stop offering the last one long after it faded. `aria-hidden` tracks
    // the fade so exactly one state is ever in the tree.
    this.captionEl.setAttribute("role", "status");
    this.captionEl.setAttribute("aria-live", "polite");
    this.captionEl.setAttribute("aria-atomic", "true");
    this.captionEl.setAttribute("aria-hidden", "true");
    this.locChip = PF.el("span", { style: S.chip, text: "…" });
    this.clockChip = PF.el("span", { style: S.chip, text: "" });
    // The purse (S3). Hidden until there is something in it: a legacy world with
    // no economy in it should not carry a permanent "0 coins" telling the player
    // about a system they are not playing.
    this.purseChip = PF.el("span", { style: `${S.chip}display:none;`, text: "" });
    // THE TWO PANEL OPENERS (plan §2.8), beside the chips that already say where
    // you are rather than in the action column — the thumb zone belongs to the
    // verbs. Boot HIDDEN on the berth button's discipline: the gate hides the
    // whole topbar for free, but the topbar STAYS UP in dialogue mode, so
    // `!inWorld` hiding is a toggle these two have to own (see update()).
    this.journalChip = this._chip("📖", "open the journal", () => this.toggleJournal());
    this.sheetChip = this._chip("👤", "open the character sheet", () => this.toggleSheet());
    this.topbar = PF.el(
      "div",
      { style: "position:absolute;top:10px;left:50%;transform:translateX(-50%);display:flex;gap:6px;z-index:2;" },
      [this.locChip, this.clockChip, this.purseChip, this.journalChip, this.sheetChip],
    );

    this.talkBtn = this._btn("Talk (E)", () => core.interact());
    // S3's one live transaction (P1's bed). Shown whenever there is a berth to be
    // had where the player is standing — a keeper within reach, or the room they
    // keep with them in it (59-economy berthOffer) — and shown REFUSING rather
    // than hidden when the offer stands but the purse is short, because a button
    // that vanishes teaches the player nothing about why.
    //
    // Booted HIDDEN, unlike Talk beside it. Talk is up for the whole of walk mode
    // and only dims; this one is display-gated, and update() is what decides. A
    // button that ships visible is on screen for every frame before the first
    // update — and for the whole of a mount that never reaches one (no sim yet),
    // quoting a room in a world that has not compiled.
    this.berthBtn = this._btn("Rent a berth", () => this.rentBerth());
    this.berthBtn.style.display = "none";
    // The keeper's SECOND trade (M8's amendment: no rod is ever free). Same
    // discipline as the berth beside it — boot hidden, offer-gated per frame,
    // dimmed rather than hidden when the purse is short — with one deliberate
    // divergence: it VANISHES once the ladder is topped out, because rod
    // ownership is global and permanent and a forever-dimmed chip is dead chrome.
    this.buyRodBtn = this._btn("Buy a rod", () => this.buyRod());
    this.buyRodBtn.style.display = "none";
    this.travelBtn = this._btn("Travel", () => this.toggleTravel());
    // 0.12's headline verb, on the same gating as the berth: shown whenever the
    // player is standing at a registry spot that holds water — INCLUDING when
    // they have no rod, because the refusal is what points them at the vendor and
    // a button that hides itself teaches nobody the mechanic exists.
    this.fishBtn = this._btn("🎣 Fish…", () => this.toggleFish());
    this.fishBtn.style.display = "none";
    this.fishMenu = PF.el("div", {
      style:
        "display:none;flex-direction:column;gap:6px;align-items:flex-end;max-height:40vh;overflow:auto;pointer-events:auto;",
    });
    // P5's bed, beside the other clock mover because that is what it is — a Wait
    // you can only do where you have a bed, and the only one that leaves a
    // wrap-up behind. Boot hidden and offer-gated per frame, like the berth that
    // sells the bed in the first place.
    this.sleepBtn = this._btn("🛏 Sleep…", () => this.toggleSleep());
    this.sleepBtn.style.display = "none";
    this.sleepMenu = PF.el("div", {
      style:
        "display:none;flex-direction:column;gap:6px;align-items:flex-end;max-height:40vh;overflow:auto;pointer-events:auto;",
    });
    this.waitBtn = this._btn("⏩ Wait…", () => this.toggleWait());
    this.keyboardBtn = this._btn("Keyboard", () => core.setMode("dialogue"));
    this.resumeBtn = this._btn("▶ Resume walking", () => core.resume());
    this.waitMenu = PF.el("div", {
      style:
        "display:none;flex-direction:column;gap:6px;align-items:flex-end;max-height:40vh;overflow:auto;pointer-events:auto;",
    });
    this.actions = PF.el(
      "div",
      {
        style:
          "position:absolute;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:8px;align-items:flex-end;z-index:2;",
      },
      [
        this.talkBtn,
        this.berthBtn,
        this.buyRodBtn,
        this.travelBtn,
        this.fishMenu,
        this.fishBtn,
        this.sleepMenu,
        this.sleepBtn,
        this.waitMenu,
        this.waitBtn,
        this.keyboardBtn,
        this.resumeBtn,
      ],
    );

    // Touch D-pad. touch-action:none so the browser doesn't claim the gesture
    // (same requirement the host documents on its own drag surfaces).
    this.dpad = PF.el("div", {
      style:
        "position:absolute;left:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));width:132px;height:132px;z-index:2;" +
        "pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none;",
    });
    const pads = [
      ["up", "▲", 44, 0],
      ["left", "◀", 0, 44],
      ["right", "▶", 88, 44],
      ["down", "▼", 44, 88],
    ];
    for (const [dir, label, x, y] of pads) {
      const pad = PF.el("button", {
        type: "button",
        "aria-label": `move ${dir}`,
        // Pointer/touch affordance only: out of the tab order so the keyboard
        // path stays the WASD/arrow bindings (a focused pad would swallow them).
        tabindex: "-1",
        style:
          `position:absolute;left:${x}px;top:${y}px;width:44px;height:44px;border-radius:10px;` +
          "background:rgba(20,24,20,0.75);color:#f3efe2;border:1px solid rgba(243,239,226,0.3);font-size:15px;touch-action:none;",
        text: label,
      });
      const press = (on) => (ev) => {
        ev.preventDefault();
        this.core.input[dir] = on;
      };
      pad.addEventListener("pointerdown", press(true));
      pad.addEventListener("pointerup", press(false));
      pad.addEventListener("pointercancel", press(false));
      pad.addEventListener("pointerleave", press(false));
      this.dpad.appendChild(pad);
    }

    this.travelMenu = PF.el("div", {
      style:
        "position:absolute;right:12px;bottom:calc(64px + env(safe-area-inset-bottom,0px));display:none;flex-direction:column;gap:5px;" +
        "background:rgba(20,24,20,0.94);border:1px solid rgba(243,239,226,0.3);border-radius:10px;padding:8px;max-height:45%;overflow:auto;z-index:3;pointer-events:auto;",
    });

    this.toastEl = PF.el("div", {
      style:
        "position:absolute;bottom:calc(156px + env(safe-area-inset-bottom,0px));left:50%;transform:translateX(-50%);" +
        `${S.chip}opacity:0;transition:opacity 0.25s;z-index:3;pointer-events:none;`,
    });
    // LOCATION NOTICES RIDE THE TOP. Everything used to share the bottom surface
    // above, which is where the host's narration panel is: crossing into a zone
    // printed its name across the middle of the GM's sentence ("Tam's farm" over a
    // line of NARRATION, playtest). Where you have just arrived belongs beside the
    // chip that already says where you are, and it is the one toast class that
    // fires while the player is reading rather than because they pressed
    // something. Sits under the topbar so the two never stack.
    this.locToastEl = PF.el("div", {
      style:
        "position:absolute;top:42px;left:50%;transform:translateX(-50%);" +
        `${S.chip}opacity:0;transition:opacity 0.25s;z-index:3;pointer-events:none;`,
    });

    // THE LOADING GATE's face (plan §Q3b). Full-surface and pointer-events:auto,
    // so nothing behind it is clickable while it holds — a chat whose world has
    // not been generated yet has no world to talk about, no clock worth reading
    // and nowhere to walk, and every other control is hidden under it. Announced
    // to a screen reader, because the whole state is "wait, then something
    // changes" and a silent one is a hung app.
    this.gateTitle = PF.el("div", {
      style: "font:700 14px/1.5 inherit;margin-bottom:6px;",
    });
    this.gateBody = PF.el("div", {
      style: "font:12px/1.65 inherit;opacity:0.85;max-width:34ch;margin-bottom:12px;",
    });
    this.gateRetry = this._btn("Try again", () => PF.save.retryGeneration(this.core));
    this.gateEl = PF.el(
      "div",
      {
        style:
          "position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;" +
          "text-align:center;padding:24px;box-sizing:border-box;gap:0;pointer-events:auto;z-index:4;" +
          "background:rgba(12,14,12,0.9);color:#f3efe2;",
      },
      [this.gateTitle, this.gateBody, this.gateRetry],
    );
    this.gateEl.setAttribute("role", "status");
    this.gateEl.setAttribute("aria-live", "polite");

    // ── The two panels (plan §2.5, §2.8) ────────────────────────────────────
    // Both are full-surface, on the gate's own shape one block up, and both are
    // children of `this.root` — which is their WHOLE teardown story. The gate is
    // the precedent: it is built here, appended to the root below, and
    // `destroy()`'s `this.root.remove()` takes it away with everything else. A
    // panel with a teardown of its own would be a second thing to forget.
    //
    // Under the gate in z as well as in the list: a world still being written has
    // no journal to read and nobody to be a sheet about.
    //
    // AND NEITHER IS AN `aria-modal` DIALOG, deliberately. `_hostOwnsKeyboard`
    // (90-element) treats any visible `[role="dialog"][aria-modal="true"]` as the
    // host owning the keyboard — so marking our own panel one would make the very
    // keys that close it inert the moment it opened.
    const panelStyle =
      "position:absolute;inset:0;flex-direction:column;gap:8px;pointer-events:auto;z-index:3;" +
      "padding:12px;box-sizing:border-box;background:rgba(12,14,12,0.94);color:#f3efe2;" +
      "font:12px/1.6 ui-monospace,Consolas,monospace;";
    const panelHead = "display:flex;align-items:center;justify-content:space-between;gap:8px;flex:0 0 auto;";
    const panelTitle = "font:700 13px/1.5 inherit;";
    this.journalBody = PF.el("div", {
      style: "flex:1 1 auto;overflow:auto;display:flex;flex-direction:column;gap:10px;",
    });
    this.journalEl = PF.el("div", { style: panelStyle, "aria-label": "journal" }, [
      PF.el("div", { style: panelHead }, [
        PF.el("div", { style: panelTitle, text: "Journal" }),
        this._btn("✕ Close", () => this.closeJournal()),
      ]),
      this.journalBody,
    ]);
    // The sheet's two columns: the sprite on the left with the themed generic
    // label under it, the sections on the right (plan §2.8).
    this.sheetArt = PF.el("div", {
      style: "flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:6px;",
    });
    this.sheetStats = PF.el("div", {
      style: "flex:1 1 auto;overflow:auto;display:flex;flex-direction:column;gap:2px;",
    });
    this.sheetEl = PF.el("div", { style: panelStyle, "aria-label": "character sheet" }, [
      PF.el("div", { style: panelHead }, [
        PF.el("div", { style: panelTitle, text: "Character" }),
        this._btn("✕ Close", () => this.closeSheet()),
      ]),
      PF.el("div", { style: "flex:1 1 auto;display:flex;gap:14px;overflow:hidden;" }, [this.sheetArt, this.sheetStats]),
    ]);
    // Both boot DOWN, as a property rather than inside the style string: the
    // toggles and update() write this same property, and a boot state expressed
    // only in `cssText` is one nothing can read back (the berth button's own
    // discipline).
    this.journalEl.style.display = "none";
    this.sheetEl.style.display = "none";

    this.root = PF.el(
      "div",
      { style: "position:absolute;inset:0;pointer-events:none;font-family:ui-monospace,Consolas,monospace;" },
      [
        this.topbar,
        this.actions,
        this.dpad,
        this.travelMenu,
        this.captionEl,
        this.toastEl,
        this.locToastEl,
        this.journalEl,
        this.sheetEl,
        this.gateEl,
      ],
    );
    rootEl.appendChild(this.root);
    this._toastTimer = 0;
    this._locToastTimer = 0;
    this._mode = null;
    // The panels' open flags and their memos. Both memos are CLEARED rather than
    // compared against a sentinel when a panel opens, so opening always paints.
    this._journal = false;
    this._journalMemo = null;
    this._sheet = false;
    this._sheetKey = null;
    this.refreshChips();
  }

  _btn(text, onclick) {
    return PF.el("button", { type: "button", style: this.S.btn, text, onclick });
  }

  /** A glyph-width topbar opener: a button wearing the chip's styling, boot
   *  hidden, and carrying the words the glyph does not say. */
  _chip(glyph, label, onclick) {
    const node = PF.el("button", { type: "button", "aria-label": label, style: this.S.chipBtn, text: glyph, onclick });
    // Hidden as a PROPERTY rather than inside the style string, exactly as the
    // berth button beside it is: update() writes this same property, and a
    // boot state expressed only in `cssText` is one nothing can read back.
    node.style.display = "none";
    return node;
  }

  destroy() {
    clearTimeout(this._toastTimer);
    clearTimeout(this._locToastTimer);
    this.root.remove();
  }

  /** `kind` picks the SURFACE, not the styling: "location" goes to the top strip
   *  (see locToastEl), everything else keeps the bottom one. Two nodes and two
   *  timers, so an arrival and a refusal can be on screen together instead of
   *  overwriting each other — they answer different questions. An unknown kind
   *  falls to the bottom, which is where every caller that names none already
   *  wanted to be. */
  toast(msg, kind) {
    const atTop = kind === "location";
    const node = atTop ? this.locToastEl : this.toastEl;
    node.textContent = msg;
    node.style.opacity = "1";
    const timer = atTop ? "_locToastTimer" : "_toastTimer";
    clearTimeout(this[timer]);
    this[timer] = setTimeout(() => {
      node.style.opacity = "0";
    }, 2600);
  }

  /** Skip ahead to the next dawn / midday / dusk / night. The clock is
   *  otherwise only moved by walking, so without this a player who wants to see
   *  the town after dark has to walk in circles for an hour. */
  toggleWait() {
    const open = this.waitMenu.style.display !== "flex";
    if (!open) {
      this.waitMenu.style.display = "none";
      return;
    }
    this.waitMenu.replaceChildren();
    for (const [part, label] of [
      ["dawn", "Wait for dawn"],
      ["day", "Wait for morning"],
      ["dusk", "Wait for dusk"],
      ["night", "Wait for night"],
    ]) {
      this.waitMenu.appendChild(
        this._btn(label, () => {
          this.waitMenu.style.display = "none";
          if (!this.core.sim.waitUntil(part)) {
            this.toast("Not while you're talking — resume walking first");
            return;
          }
          // waitUntil moves clockMin/day but does not flag the save itself, and
          // the autosave only fires on a dirty sim — without this the skipped
          // hours are lost on reload.
          this.core.markDirty();
          this.refreshChips();
          this.toast(`Time passes — ${this.core.sim.clockLabel()}`);
        }),
      );
    }
    this.waitMenu.style.display = "flex";
  }

  /** The bed's menu, mirroring the Wait menu one method up — the same four
   *  dayparts, because a sleep is a rest that happens to be somewhere. It SENDS
   *  NOTHING: the hours pass, the wrap-up is staged, and the next turn the player
   *  sends for their own reasons carries it (plan §2.6). */
  toggleSleep() {
    const open = this.sleepMenu.style.display !== "flex";
    if (!open) {
      this.sleepMenu.style.display = "none";
      return;
    }
    const offer = PF.economy.sleepOffer(this.core);
    if (!offer.available) {
      // Answered where it was pressed, rather than behind a menu whose every
      // entry then refuses — the fishing verb's own idiom.
      this.sleepMenu.style.display = "none";
      this.toast(this.sleepRefusal(offer.reason));
      return;
    }
    this.sleepMenu.replaceChildren();
    for (const [part, label] of [
      ["dawn", "Sleep until dawn"],
      ["day", "Sleep until morning"],
      ["dusk", "Sleep until dusk"],
      ["night", "Sleep until night"],
    ]) {
      this.sleepMenu.appendChild(
        this._btn(label, () => {
          this.sleepMenu.style.display = "none";
          this.sleep(part);
        }),
      );
    }
    this.sleepMenu.style.display = "flex";
  }

  /** The bed's refusals, turned into sentences. `no-bed` is absent on purpose:
   *  the button is not on screen where there is no bed, so a line for it would be
   *  copy nobody can reach. */
  sleepRefusal(reason) {
    if (reason === "wrong-mode") return "Not while you're talking — resume walking first";
    if (reason === "streaming") return "The story is still being written…";
    if (reason === "gate-held") return "Not yet — your world is still being written.";
    return "You can't sleep just now.";
  }

  /** Spend the night (or the morning). `sleep` moves the clock, stages the
   *  wrap-up and flags the save itself, so this only says what happened — and
   *  re-reads the chips, because the clock is one of them. */
  sleep(target) {
    const result = PF.economy.sleep(this.core, target);
    if (!result.ok) {
      this.toast(this.sleepRefusal(result.reason));
      return;
    }
    this.refreshChips();
    this.toast(`You sleep — ${this.core.sim.clockLabel()}`);
  }

  /** The session menu, mirroring the Wait menu one method up: a single cast, or
   *  a session that runs until one of the four dayparts. The BAIT LINE at the top
   *  is not a control — it is what the session is about to spend, shown before it
   *  spends it, because the slotting is automatic and the player would otherwise
   *  watch a stack drain without ever having been told it was in play. */
  toggleFish() {
    const open = this.fishMenu.style.display !== "flex";
    if (!open) {
      this.fishMenu.style.display = "none";
      return;
    }
    const offer = PF.economy.fishOffer(this.core);
    if (!offer.available) {
      // A refusal is answered where it is pressed, not behind a menu that then
      // refuses every entry in it.
      this.fishMenu.style.display = "none";
      this.toast(offer.hint || this.fishRefusal(offer.reason));
      return;
    }
    this.fishMenu.replaceChildren();
    const world = this.core.sim.world;
    this.fishMenu.appendChild(
      PF.el("span", {
        style: this.S.chip,
        text: offer.bait
          ? `Bait: ${offer.bait.q} × ${PF.economy.describe(world, offer.bait)}`
          : "No bait — casting bare",
      }),
    );
    for (const [target, label] of [
      [null, "Cast once"],
      ["dawn", "Fish until dawn"],
      ["day", "Fish until morning"],
      ["dusk", "Fish until dusk"],
      ["night", "Fish until night"],
    ]) {
      this.fishMenu.appendChild(
        this._btn(label, () => {
          this.fishMenu.style.display = "none";
          this.fish(target);
        }),
      );
    }
    this.fishMenu.style.display = "flex";
  }

  /** The verb's refusal values, turned into sentences. `no-rod` is absent on
   *  purpose: it carries its own themed hint naming the keeper who sells one, and
   *  a generic line here would throw that away.
   *
   *  `unknown-target` and `no-player` are absent on purpose too, for the opposite
   *  reason: neither is a refusal about the PLAYER. One is a caller handing the
   *  verb a daypart word that does not exist and the other is a sim with no
   *  player block on it, so both take the fall-through rather than copy written
   *  about a state nobody can be in — which is exactly why that fall-through has
   *  to be a real sentence. Both callers toast `hint || fishRefusal(reason)`, and
   *  an empty line there is a pressed button that does nothing at all. */
  fishRefusal(reason) {
    if (reason === "wrong-mode") return "Not while you're talking — resume walking first";
    if (reason === "not-near-water") return "There is no water to fish here.";
    if (reason === "pouch-full") return "Your bag is full — there is nowhere to put a catch.";
    if (reason === "gate-held") return "Not yet — your world is still being written.";
    return "You can't fish just now.";
  }

  /** Spend the session. `fish` moves the clock and flags the save itself, so this
   *  only turns what came back into a sentence — and re-reads the chips, because
   *  the purse chip counts what is in the bag. */
  fish(target) {
    const result = PF.economy.fish(this.core, target);
    if (!result.ok) {
      this.toast(result.hint || this.fishRefusal(result.reason));
      return;
    }
    const world = this.core.sim.world;
    const clock = this.core.sim.clockLabel();
    this.refreshChips();
    if (result.leveled) {
      // THEMED, out of the same word book the sheet reads (`verbSkin`): a colony
      // levels "Angling", and this line was the one place the raw verb reached a
      // player at all.
      this.toast(`${PF.economy.verbSkin(world, "fishing").name} is level ${result.leveled} now — ${clock}`);
      return;
    }
    if (!result.caught.length) {
      this.toast(`Nothing biting — ${clock}`);
      return;
    }
    const last = PF.economy.describe(world, result.caught[result.caught.length - 1]);
    this.toast(
      result.caught.length === 1
        ? `You land a ${last} — ${clock}`
        : `${result.caught.length} landed, the last a ${last} — ${clock}`,
    );
  }

  /** Take the rod the button is offering. The offer is re-read inside buyRod, so
   *  a frame-old button cannot overcharge anybody; this turns the refusals into
   *  sentences, exactly as rentBerth's caller does. */
  buyRod() {
    const world = this.core.sim?.world;
    const result = PF.economy.buyRod(this.core);
    if (result.ok) {
      const named = PF.economy.describe(world, { t: "rod", k: result.tier });
      this.toast(
        result.bait
          ? `A ${named} is yours, line and tackle included — ${PF.economy.money(world, result.price)}.`
          : `A ${named} is yours — ${PF.economy.money(world, result.price)}.`,
      );
      this.refreshChips();
      return;
    }
    if (result.reason === "cannot-afford")
      this.toast(`Not enough on you — that rod is ${PF.economy.money(world, result.price)}.`);
    else if (result.reason === "pouch-full") this.toast("Your bag is too full to carry it.");
    else this.toast("There is no rod to be had here.");
  }

  toggleTravel() {
    const open = this.travelMenu.style.display !== "flex";
    if (!open) {
      this.travelMenu.style.display = "none";
      return;
    }
    this.travelMenu.replaceChildren();
    const dests = PF.spatial.destinations();
    if (!dests.length) {
      this.travelMenu.appendChild(PF.el("span", { style: this.S.chip, text: "No known destinations yet" }));
    }
    for (const dest of dests.slice(0, 12)) {
      this.travelMenu.appendChild(
        this._btn(dest.name, () => {
          this.travelMenu.style.display = "none";
          void PF.spatial.travel(this.core, dest);
        }),
      );
    }
    this.travelMenu.style.display = "flex";
  }

  /** Take the berth the button is offering. The offer is re-read inside
   *  rentBerth, so what the button was rendering a frame ago cannot overcharge
   *  anybody; this only turns the verb's refusal reasons into sentences. */
  rentBerth() {
    const world = this.core.sim?.world;
    const result = PF.economy.rentBerth(this.core);
    if (result.ok) {
      this.toast(`A berth is yours — ${PF.economy.money(world, result.price)} the night.`);
      this.refreshChips();
      return;
    }
    if (result.reason === "already-yours") this.toast("You already keep a berth here.");
    else if (result.reason === "cannot-afford")
      this.toast(`Not enough on you — a berth is ${PF.economy.money(world, result.price)}.`);
    else this.toast("There is no room to be had here.");
  }

  // ── The panels (plan §2.5, §2.8) ───────────────────────────────────────────
  // Two surfaces, one rule each. The JOURNAL is a list that changes when the
  // arrays under it change, so its memo is the arrays themselves. The SHEET is a
  // portrait of live state that no array identity tracks — every player mutator
  // mutates IN PLACE — so its memo is a VALUE key, on the purse chip's idiom
  // further down. Neither writes DOM at rest.

  /** Is the surface in a state where a panel may be open at all? Both openers
   *  answer to this: the chips are hidden outside walk mode and under the gate,
   *  and the key branches (90-element) inherit the same guards, but a click can
   *  still land on a frame-old chip. */
  _panelsAllowed() {
    return this.core.sim?.mode === "walk" && !PF.save.gateHolds(this.core);
  }

  /** Close whatever panel is open, and say whether anything was open to close.
   *
   *  The Escape branch (90-element) DISCARDS that answer on purpose: it declines
   *  `preventDefault` either way, because the host's own Escape handling is not
   *  ours to cancel, so "the key meant something here" is not a question it has
   *  to ask. The return is the honest answer for a caller that does — today that
   *  is the harness, which pins it. */
  closePanels() {
    const open = this._journal || this._sheet;
    this.closeJournal();
    this.closeSheet();
    return open;
  }

  toggleJournal() {
    if (!this._panelsAllowed()) return;
    if (this._journal) {
      this.closeJournal();
      return;
    }
    // One surface at a time: both are full-screen, so a second one opening over
    // the first would be a panel nobody can see under a panel nobody closed.
    this.closeSheet();
    this._journal = true;
    this._journalMemo = null;
    this._journalSync();
    this.journalEl.style.display = "flex";
  }

  closeJournal() {
    this._journal = false;
    this._journalMemo = null;
    this.journalEl.style.display = "none";
  }

  /** The journal's memo: the two ARRAYS and their two lengths (plan §2.5). The
   *  identities catch a wholesale replacement — `_compactLedger` rebuilds
   *  `ledger.lines` on every append, and a restore assigns a fresh band — and
   *  the lengths catch an append that kept the array it pushed onto, which is
   *  exactly what `notice()` does while the band is under its cap.
   *
   *  What it deliberately does NOT track is the told flag: the band shows told
   *  and untold rows alike, so a burn changes nothing the panel draws. */
  _journalSync() {
    const player = PF.player.get(this.core);
    const lines = Array.isArray(player?.ledger?.lines) ? player.ledger.lines : null;
    const notices = Array.isArray(player?.ledger?.notices) ? player.ledger.notices : null;
    const memo = this._journalMemo;
    if (
      memo &&
      memo.lines === lines &&
      memo.notices === notices &&
      memo.lineCount === (lines?.length ?? 0) &&
      memo.noticeCount === (notices?.length ?? 0)
    )
      return;
    this._journalMemo = { lines, notices, lineCount: lines?.length ?? 0, noticeCount: notices?.length ?? 0 };
    this._renderJournal(lines ?? [], notices ?? []);
  }

  /** ONE LIST, day-grouped from each line's own day, newest day first — and the
   *  NOTICE BAND outside the grouping entirely, because it reads a DIFFERENT
   *  array (plan §2.5). A notice explains something that happened to the SAVE
   *  rather than something the player did in a day, so it has no day group to
   *  belong to; the band is history and shows told and untold rows alike.
   *
   *  Lines inside a day keep the order they were logged in, which is the order
   *  the wrap-up tells them in. A STUB renders as its stub text and nothing else
   *  — the sentence the ledger holds ("Day 4: 12 things happened.") is the same
   *  sentence the GM was given, and rewriting it here would be the panel telling
   *  a different story from the tell. */
  _renderJournal(lines, notices) {
    const body = this.journalBody;
    body.replaceChildren();
    const dim = "opacity:0.7;";
    if (notices.length) {
      // The band's framing echoes the tell's own framing sentence (30-sim
      // `_composeLedger`) so the player reads here the words they were told
      // there — and it is written to receive an ACTOR when the autonomous-change
      // mechanism arrives and a notice can say who did it (M3, roadmap).
      const band = PF.el("div", {
        style:
          "display:flex;flex-direction:column;gap:2px;padding-left:8px;border-left:2px solid rgba(243,239,226,0.35);",
      });
      band.appendChild(
        PF.el("div", { style: `font:700 12px/1.6 inherit;${dim}`, text: "About the world itself, not the days in it" }),
      );
      // NEWEST FIRST — and newest here means most recently WRITTEN, not the
      // highest day. The two agree everywhere except after a rewind, where a
      // restore's notice carries a day BELOW the severance notice it is the
      // sequel to, so the descending day sort the groups below use would print
      // the sentence saying the world went above the notice of it coming back.
      // Reverse insertion order is what puts the sequel on top. These rows are
      // events about the save and the day on them is a stamp, not the order
      // they happened in; the day groups below sort, because a line really does
      // belong to its day.
      for (const row of notices.slice().reverse()) {
        const said = typeof row?.[1] === "string" ? row[1] : "";
        band.appendChild(PF.el("div", { text: `Day ${PF.player.resolvedDay(row?.[0])} — ${said}` }));
      }
      body.appendChild(band);
    }
    const days = [...new Set(lines.map((line) => PF.player.resolvedDay(line?.[0])))].sort((a, b) => b - a);
    for (const day of days) {
      const group = PF.el("div", { style: "display:flex;flex-direction:column;gap:2px;" }, [
        PF.el("div", { style: `font:700 12px/1.6 inherit;${dim}`, text: `Day ${day}` }),
      ]);
      for (const line of lines) {
        if (PF.player.resolvedDay(line?.[0]) !== day) continue;
        const stub = PF.player.resolvedDay(line?.[2]) > 0;
        group.appendChild(PF.el("div", { style: stub ? dim : "", text: typeof line?.[1] === "string" ? line[1] : "" }));
      }
      body.appendChild(group);
    }
    if (!days.length && !notices.length)
      body.appendChild(PF.el("div", { style: dim, text: "Nothing written down yet." }));
  }

  toggleSheet() {
    if (!this._panelsAllowed()) return;
    if (this._sheet) {
      this.closeSheet();
      return;
    }
    this.closeJournal();
    this._sheet = true;
    this._sheetKey = this._sheetValueKey();
    this._renderSheet();
    this.sheetEl.style.display = "flex";
  }

  /** CLOSED, not hidden (plan §2.8). A hidden sheet resurfacing after a mode
   *  change is the stale path — it comes back drawn against whoever the player
   *  was before the combat or the replay — so the flag and the memo both go and
   *  the next open rebuilds from scratch. */
  closeSheet() {
    this._sheet = false;
    this._sheetKey = null;
    this.sheetEl.style.display = "none";
  }

  /** A whole number off untrusted block state. The sheet renders save JSON, so
   *  an `x` can be "12", -3 or a NaN; ONE reader for the key and the render,
   *  which is what makes "the key is the projection of what the sheet draws"
   *  true rather than nearly true. */
  _num(value) {
    const n = Math.trunc(Number(value));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  _carried(pouch) {
    return (Array.isArray(pouch?.items) ? pouch.items : []).reduce((n, item) => n + this._num(item?.q), 0);
  }

  /** Standing as the sheet shows it: how many people sit on each rung of the
   *  disposition ladder across every zone, and how many are hostile. The
   *  hostile flag is COUNTED SEPARATELY because it is a flag and not a rung —
   *  and because an `h` flipping with `d` unmoved has to move the key. */
  _standing(player) {
    const tiers = [0, 0, 0, 0];
    let hostile = 0;
    for (const [, rows] of Object.entries(player?.rel ?? {})) {
      for (const [, row] of Object.entries(rows ?? {})) {
        if (!row || typeof row !== "object") continue;
        tiers[PF.clamp(this._num(row.d), 0, 3)] += 1;
        if (row.h) hostile += 1;
      }
    }
    return { tiers, hostile };
  }

  /** THE LIVE VALUE KEY (plan §2.8), on the purse chip's idiom: cheap enough to
   *  compute every frame the sheet is open, and it moves exactly when something
   *  the sheet draws moves. The player block carries no identity signal to watch
   *  — every mutator mutates in place — so a built-at-open sheet would go stale
   *  the moment a Talk bumped somebody or a cast paid xp.
   *
   *  THE INVARIANT: this key is the projection of PRECISELY what the sheet
   *  renders. Widening the sheet — per-NPC rows, names, a new section — widens
   *  the key in the same change, or the new half never re-renders. */
  _sheetValueKey() {
    const player = PF.player.get(this.core);
    const world = this.core.sim?.world;
    const byKey = (a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
    const verbs = Object.entries(player?.skills?.verbs ?? {})
      .sort(byKey)
      .map(([verb, row]) => `${verb}:${PF.player.resolvedLevel(row)}:${this._num(row?.x)}`)
      .join(",");
    // The pairs BY VALUE, which covers the fresh-pair equip and the `delete`
    // unequip alike: a slot that lost its pair renders as an empty half.
    const gear = Object.entries(player?.skills?.equipped ?? {})
      .sort(byKey)
      .map(
        ([verb, slots]) =>
          `${verb}:${["tool", "mod"]
            .map((slot) => (Array.isArray(slots?.[slot]) ? `${slots[slot][0]}/${slots[slot][1]}` : ""))
            .join("+")}`,
      )
      .join(",");
    const { tiers, hostile } = this._standing(player);
    return [
      this._num(player?.pouch?.money),
      this._carried(player?.pouch),
      verbs,
      gear,
      tiers.join("/"),
      hostile,
      // FOUR ROWS AT ONCE: the skill names, `describe()`'s prose, the money
      // heading and the label under the portrait all come out of the WORLD's
      // word book, so a rebuild that lands a different theme has moved what the
      // sheet draws without moving one player field. The loader usually carries
      // it (a theme change moves `assets.status` below), but a PARKED loader —
      // no packageId, or inside the failed backoff — never moves at all.
      world?.theme ?? "",
      // The portrait's own input: the pre-ready Tier-0 window is accepted, and
      // this is what upgrades it the frame the authored sheets arrive.
      PF.assets?.status ?? "",
    ].join("|");
  }

  /** The sheet as DATA (plan §2.8): `[{section, rows: [{label, value, kind,
   *  detail?, source?}]}]`. `detail` and `source` ship in the shape and empty —
   *  they are the seam the extended journal fills when perks, boons and
   *  enchanted equipment land, and a shape grown later is a shape every consumer
   *  has to be re-taught. */
  _sheetDescriptor() {
    const world = this.core.sim?.world;
    const player = PF.player.get(this.core);
    const byKey = (a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
    const out = [];

    const skills = Object.entries(player?.skills?.verbs ?? {})
      .sort(byKey)
      .map(([verb, row]) => {
        const level = PF.player.resolvedLevel(row);
        // A CAPPED SKILL READS "MAX", never "0 xp to go": award() zeroes `x` at
        // the ceiling, so the ordinary arithmetic would draw a bar that is
        // permanently empty and permanently full at once (plan §2.8).
        const value =
          level >= PF.player.CAPS.skillLevel
            ? `Level ${level} — MAX`
            : `Level ${level} — ${Math.max(0, PF.player.xpPerLevel(level) - this._num(row?.x))} xp to go`;
        return { label: PF.economy.verbSkin(world, verb).name, value, kind: "skill" };
      });
    out.push({
      section: "Skills",
      rows: skills.length ? skills : [{ label: "Nothing practised yet", value: "", kind: "skill" }],
    });

    const gear = [];
    for (const [verb, slots] of Object.entries(player?.skills?.equipped ?? {}).sort(byKey)) {
      const skin = PF.economy.verbSkin(world, verb);
      for (const slot of ["tool", "mod"]) {
        const pair = slots?.[slot];
        if (!Array.isArray(pair) || typeof pair[0] !== "string" || !pair[0]) continue;
        gear.push({
          label: `${skin.name} ${skin[slot]}`,
          value: PF.economy.describe(world, { t: pair[0], k: typeof pair[1] === "string" ? pair[1] : "" }),
          kind: "equipment",
        });
      }
    }
    out.push({
      section: "Equipment",
      rows: gear.length ? gear : [{ label: "Nothing to hand", value: "", kind: "equipment" }],
    });

    const carried = this._carried(player?.pouch);
    const { one } = PF.economy.currency(world);
    out.push({
      // Named for what this world calls its money, so a colony's sheet carries no
      // "Coin" heading over a purse full of credits.
      section: `${one.charAt(0).toUpperCase()}${one.slice(1)}`,
      rows: [
        { label: "Purse", value: PF.economy.money(world, this._num(player?.pouch?.money)), kind: "money" },
        { label: "Carried", value: `${carried} ${carried === 1 ? "thing" : "things"}`, kind: "count" },
      ],
    });

    // THE AGGREGATE, not a roll-call: how many people stand on each rung, across
    // every zone. Per-NPC rows belong to the extended surface the journal becomes
    // (plan §2.8). The rung words are theme-BLIND on purpose — a stranger is a
    // stranger in any world, and the ladder is the same four steps everywhere.
    const { tiers, hostile } = this._standing(player);
    const standing = ["Strangers", "Acquainted", "Friendly", "Close"].map((label, rung) => ({
      label,
      value: String(tiers[rung]),
      kind: "standing",
    }));
    if (hostile) standing.push({ label: "Hostile", value: String(hostile), kind: "standing" });
    out.push({ section: "Standing", rows: standing });
    return out;
  }

  /** The portrait: the player's own walk sprite, facing the reader, drawn onto a
   *  frame-sized offscreen canvas and integer-scaled up with
   *  `image-rendering: pixelated` — which is what the underlay does with the
   *  world canvas (90-element `attachUnderlay`), and the only way pixel art
   *  survives being made bigger.
   *
   *  Hue 158 is the world draw's own fallback constant for the player
   *  (40-render), so the Tier-0 portrait is the same person the map shows. A
   *  refused 2d context draws nothing and is not a reason to fail: the sheet is
   *  a panel of text with a picture on it. */
  _portrait() {
    const sprites = PF.assets?.status === "ready" ? PF.assets.sprites : null;
    const fw = this._num(sprites?.frameWidth) || 12;
    const fh = this._num(sprites?.frameHeight) || 16;
    const canvas = PF.offscreen(fw, fh);
    const pctx = canvas.getContext?.("2d");
    if (pctx) {
      pctx.imageSmoothingEnabled = false;
      PF.art.drawActor(pctx, "player", 158, 0, 0, false, 0, 0);
    }
    const scale = 6;
    canvas.style.cssText =
      `width:${fw * scale}px;height:${fh * scale}px;` +
      "image-rendering:pixelated;image-rendering:crisp-edges;display:block;";
    return canvas;
  }

  _renderSheet() {
    const world = this.core.sim?.world;
    // THE THEMED GENERIC LABEL. The package has no player name and the host props
    // expose none, so the sheet says what KIND of person is standing there rather
    // than inventing one (plan §2.8; engine persona name + avatar is an
    // enumerated Engine FR).
    this.sheetArt.replaceChildren(
      this._portrait(),
      PF.el("div", { style: "font:700 12px/1.5 inherit;", text: PF.economy.playerLabel(world) }),
    );
    const stats = this.sheetStats;
    stats.replaceChildren();
    for (const { section, rows } of this._sheetDescriptor()) {
      stats.appendChild(
        PF.el("div", { style: "font:700 12px/1.6 inherit;opacity:0.7;margin-top:6px;", text: section }),
      );
      for (const row of rows) {
        stats.appendChild(
          PF.el("div", { style: "display:flex;justify-content:space-between;gap:12px;" }, [
            PF.el("span", { style: "opacity:0.8;", text: row.label }),
            PF.el("span", { text: row.value }),
          ]),
        );
      }
    }
  }

  refreshChips() {
    const sim = this.core.sim;
    if (!sim) return;
    // The spatial name is the ENGINE's committed party location, which only
    // moves on a narrated transition or a Travel — walking is package-local, so
    // it does not follow the player between zones. Showing it unconditionally
    // pinned a stale name to every zone ("The Tailings — The Slag Bar"), and on
    // the start zone it could even show a leftover location from a DIFFERENT
    // world in the same chat. Annotate only when it really is this zone's
    // binding, and never annotate the exterior, whose binding is seeded from
    // whatever the map already said.
    const zoneName = sim.zone().name;
    const locationId = PF.spatial.data && PF.spatial.data.currentLocationId;
    const bound =
      locationId && sim.zoneId !== sim.world.startZone && sim.world.bindings[locationId] === sim.zoneId
        ? PF.spatial.locationName()
        : null;
    this.locChip.textContent = bound && bound !== zoneName ? `${zoneName} — ${bound}` : zoneName;
    this.clockChip.textContent = sim.clockLabel();
    // The purse. Money and the pouch's row count, in this theme's own words —
    // and nothing at all until one of them exists, so a legacy world carries no
    // chip about an economy it does not have.
    const pouch = PF.player.get(this.core)?.pouch;
    const money = pouch?.money ?? 0;
    const carried = (pouch?.items ?? []).reduce((n, item) => n + Math.max(0, item?.q ?? 0), 0);
    const { glyph } = PF.economy.currency(sim.world);
    this.purseChip.style.display = money || carried ? "" : "none";
    this.purseChip.textContent = carried
      ? `${glyph} ${PF.economy.money(sim.world, money)} · ${carried} carried`
      : `${glyph} ${PF.economy.money(sim.world, money)}`;
  }

  /** Cheap per-frame sync — writes DOM only on change. */
  update() {
    const sim = this.core.sim;
    if (!sim) return;
    const mode = sim.mode;
    const spatialAvail = PF.spatial.available;
    // The gate's STATE, not merely whether it holds: "generating" and "failed" are
    // two different screens, and folding them into a boolean would leave the retry
    // button hidden behind a change the memo below never saw.
    const gate = PF.save.gateHolds(this.core) ? PF.save.gate.state : null;
    // WHY it failed is part of the screen, not only THAT it failed. The ladder
    // refuses to seal a default world on any failure now (18-brief `generate`),
    // deterministic ones included — which is right, and which also means a
    // player can be looking at a retry button that will keep giving the same
    // answer. It has to be in the memo key or the sentence never changes.
    const gateWhy = gate === "failed" ? (PF.save.gate.failure ?? null) : null;
    if (
      mode !== this._mode ||
      spatialAvail !== this._spatialAvail ||
      gate !== this._gate ||
      gateWhy !== this._gateWhy
    ) {
      this._mode = mode;
      this._spatialAvail = spatialAvail;
      this._gate = gate;
      this._gateWhy = gateWhy;
      const inWorld = mode === "walk" && !gate;
      this.gateEl.style.display = gate ? "flex" : "none";
      this.gateRetry.style.display = gate === "failed" ? "" : "none";
      this.gateTitle.textContent = gate === "failed" ? "The world didn't finish being written." : "Writing your world…";
      this.gateBody.textContent =
        gate === "failed"
          ? `${PF.save.gateReason(gateWhy)} Nothing was lost and nothing was decided for you — this chat is exactly as you left it. Try again whenever you like.`
          : "One generation call is shaping the settlement, its people and the places in it. This can take a minute.";
      this.topbar.style.display = gate ? "none" : "";
      // Replay: the host owns the whole screen. Combat: keep a minimal HUD —
      // the mode is inferred from the narrative gameActiveState, which can flip
      // without any combat UI mounting, so the player must NEVER be left with
      // zero controls (review finding). Resume is the guaranteed exit.
      this.root.style.display = mode === "replay" ? "none" : "";
      this.dpad.style.display = inWorld ? "" : "none";
      this.talkBtn.style.display = inWorld ? "" : "none";
      // The berth button is proximity-driven as well as mode-driven, so leaving
      // walk mode hides it here and the walk block below decides when it is back.
      if (!inWorld) {
        this.berthBtn.style.display = "none";
        this._berth = null;
        this.buyRodBtn.style.display = "none";
        this._rod = null;
        this.fishBtn.style.display = "none";
        this._fish = null;
        this.sleepBtn.style.display = "none";
        this._sleep = null;
      }
      // THE PANEL OPENERS, on the berth button's cadence and for a reason of
      // their own: the gate hides the whole topbar, but the topbar STAYS UP in
      // dialogue mode, so `!inWorld` hiding is a toggle these two have to own.
      this.journalChip.style.display = inWorld ? "" : "none";
      this.sheetChip.style.display = inWorld ? "" : "none";
      // …AND THE PANELS THEMSELVES. The sheet CLOSES (plan §2.8): `e`, a cutscene
      // beat, and the props-driven replay/combat modes can all fire under an open
      // one, and a sheet that merely hid would resurface drawn against whoever
      // the player was before. The journal only hides — it is a list of what is
      // written down, with no live descriptor to go stale, and losing a scroll
      // position to a passing combat state would be its own small rudeness.
      if (!inWorld) {
        this.closeSheet();
        this.journalEl.style.display = "none";
      } else if (this._journal) {
        this.journalEl.style.display = "flex";
      }
      this.travelBtn.style.display = inWorld && spatialAvail ? "" : "none";
      this.waitBtn.style.display = inWorld ? "" : "none";
      this.keyboardBtn.style.display = inWorld ? "" : "none";
      // In combat, Resume exists only for the NARRATIVE fallback signal (which
      // can flip without any combat UI). With the real Capability API 1.11
      // signal the combat UI owns the screen — no package controls at all.
      const combatResumeApplies = mode === "combat" && !this.core._combatSignalIsReal && !gate;
      this.resumeBtn.style.display = (mode === "dialogue" && !gate) || combatResumeApplies ? "" : "none";
      this.resumeBtn.textContent = combatResumeApplies ? "▶ Resume exploring" : "▶ Resume walking";
      this.travelMenu.style.display = "none";
      this.waitMenu.style.display = "none";
      this.fishMenu.style.display = "none";
      this.sleepMenu.style.display = "none";
      if (mode === "dialogue" && !gate) this.toast("Type in the message box below — Resume to keep walking");
    }
    // Nothing below the gate means anything: there is no beat to caption, nobody
    // to be standing next to, and the clock is not running.
    if (gate) return;
    // Cutscene caption — writes DOM only when the beat starts or ends.
    const caption = sim.cutscene ? sim.cutscene.text : "";
    if (caption !== this._caption) {
      this._caption = caption;
      if (caption) this.captionEl.textContent = caption;
      this.captionEl.setAttribute("aria-hidden", caption ? "false" : "true");
      this.captionEl.style.opacity = caption ? "1" : "0";
    }
    if (this._mode === "walk") {
      const canTalk = !!sim.nearNpc;
      // The Talk button is ALSO where a skip is confirmed (90-element `interact`):
      // while the latest GM turn still holds narration the player has not been
      // shown, the first press asks instead of sending. It has to be part of the
      // memo key or the question would be asked and never drawn — the old key was
      // the bare `canTalk` boolean, which does not move when only the label does.
      const asking = canTalk && this.core.talkConfirmArmed?.() === true;
      const talkKey = canTalk ? `${asking ? "skip" : "talk"}:${sim.nearNpc.name}` : "";
      if (talkKey !== this._talkKey) {
        this._talkKey = talkKey;
        this.talkBtn.style.opacity = canTalk ? "1" : "0.45";
        this.talkBtn.textContent = asking
          ? "Skip story & talk?"
          : canTalk
            ? `Talk to ${sim.nearNpc.name} (E)`
            : "Talk (E)";
      }
      // The berth offer, on the same cadence as Talk and memoised the same way:
      // both answer to who is within reach, and both would otherwise write DOM
      // sixty times a second. `already-yours` and `cannot-afford` still SHOW the
      // button — dimmed and saying why — because a control that disappears when
      // the purse runs short teaches the player nothing about the price.
      const offer = PF.economy.berthOffer(this.core);
      // A price is only ever quoted when a real keeper with a real room is within
      // reach — every other refusal comes back with a null price — so this one
      // test covers "is there anything to show at all".
      const shown = offer.price !== null;
      const berthKey = shown ? `${offer.reason ?? "ok"}:${offer.price}` : "";
      if (berthKey !== this._berth) {
        this._berth = berthKey;
        this.berthBtn.style.display = shown ? "" : "none";
        if (shown) {
          this.berthBtn.style.opacity = offer.available ? "1" : "0.45";
          this.berthBtn.textContent =
            offer.reason === "already-yours"
              ? "Your berth"
              : `Rent a berth (${PF.economy.money(sim.world, offer.price)})`;
        }
      }
      // The rod ladder, on the berth's cadence and memoised the same way. The
      // key carries the TIER as well as the reason, so the button re-labels when
      // the ladder moves up a rung under it.
      const rod = PF.economy.rodOffer(this.core);
      // A price is quoted only when a real keeper is within reach and there is a
      // rung left to sell, so — exactly as with the berth — one test covers "is
      // there anything to show at all". This is also where the button VANISHES at
      // the top of the ladder: no rung, no price, no button.
      const rodShown = rod.price !== null;
      const rodKey = rodShown ? `${rod.reason ?? "ok"}:${rod.tier}:${rod.price}` : "";
      if (rodKey !== this._rod) {
        this._rod = rodKey;
        this.buyRodBtn.style.display = rodShown ? "" : "none";
        if (rodShown) {
          this.buyRodBtn.style.opacity = rod.available ? "1" : "0.45";
          const named = PF.economy.describe(sim.world, { t: "rod", k: rod.tier });
          this.buyRodBtn.textContent = `Buy a ${named} (${PF.economy.money(sim.world, rod.price)})`;
        }
      }
      // The spot. `offer.spot` is the render test here — a refusal that still
      // names a spot is one about the PLAYER (no rod, full bag) and belongs on
      // screen saying so; one that names none is about the place, and there is
      // nothing to say. The bait count rides the memo key so the menu's line is
      // never a stack ago.
      const water = PF.economy.fishOffer(this.core);
      const fishKey = water.spot ? `${water.reason ?? "ok"}:${water.spot.id}:${water.bait?.q ?? 0}` : "";
      if (fishKey !== this._fish) {
        this._fish = fishKey;
        this.fishBtn.style.display = water.spot ? "" : "none";
        if (water.spot) {
          this.fishBtn.style.opacity = water.available ? "1" : "0.45";
          this.fishBtn.textContent = `🎣 Fish ${water.spot.name}`;
        } else {
          // Walking away from the bank closes the menu with the button: a list of
          // casts for water nobody is standing at is a list that refuses.
          this.fishMenu.style.display = "none";
        }
      }
      // The bed, on the same cadence: `bed` is the render test, the reason rides
      // the key so a refusal re-labels nothing but re-dims correctly, and walking
      // out of the room takes the menu with the button.
      const bed = PF.economy.sleepOffer(this.core);
      const sleepKey = bed.bed ? `${bed.reason ?? "ok"}` : "";
      if (sleepKey !== this._sleep) {
        this._sleep = sleepKey;
        this.sleepBtn.style.display = bed.bed ? "" : "none";
        if (bed.bed) this.sleepBtn.style.opacity = bed.available ? "1" : "0.45";
        else this.sleepMenu.style.display = "none";
      }
      const clock = sim.clockLabel();
      if (clock !== this._clock) {
        this._clock = clock;
        this.refreshChips();
      }
      // THE OPEN PANELS, each on its own memo. Both run only while their panel is
      // up, and both write DOM only on a change — a journal nobody has opened
      // costs nothing, and an open sheet at rest costs one string compare beside
      // an update() already running berthOffer's zone scan.
      if (this._journal) this._journalSync();
      if (this._sheet) {
        const key = this._sheetValueKey();
        if (key !== this._sheetKey) {
          this._sheetKey = key;
          this._renderSheet();
        }
      }
    }
  }
};

// ===== 80-setup.js =====
// ── Setup view (view="setup") ─────────────────────────────────────────────────
// Replaces the classic wizard body. Must emit the full classic required set
// (genre/setting/tone/difficulty/gmMode/partyCharacterIds — game.routes.ts
// gameSetupConfigSchema) plus gmConnectionId, or the host refuses the launch.
// World Maps: requests hierarchical mode + agents; if the World Maps agent
// isn't active the host falls back to standard mode and the surface runs
// unbound — both are handled (verified trap #6).
// World generation does NOT happen here (spec §5, amended): the wizard only
// stamps the player's `generate` answer into the experience config; the surface
// picks it up after launch (PF.save.maybeGenerateBrief) so the whole 90s window
// runs behind a loading gate instead of a torn-down setup UI. Answering NO is a
// supported outcome, not a failure — the chat plays the themed default world
// immediately, with no gate and no generation call ever made for it.

PF.mountSetup = (el, props) => {
  // The host delivers a FRESH props object on every render, and its onCancel
  // closes over the current `launching` state — capturing the first one would
  // let "Back" defeat the host's mid-launch freeze (review finding). Keep the
  // latest props on the element and read them at click time.
  el._pfProps = props;
  if (el._pfSetupMounted) return;
  el._pfSetupMounted = true;
  el.style.display = "block";

  const S = {
    label: "display:block;font:600 11px/1.6 ui-monospace,Consolas,monospace;opacity:0.75;margin:10px 0 3px;",
    input:
      "width:100%;box-sizing:border-box;background:var(--background,#1b201b);color:var(--foreground,#e6e8e0);" +
      "border:1px solid var(--border,#444);border-radius:8px;padding:8px 10px;font:13px/1.4 inherit;",
    row: "display:flex;gap:10px;",
    btn: "min-height:44px;border-radius:8px;padding:0 16px;font:700 13px/1 inherit;cursor:pointer;border:1px solid var(--border,#444);",
  };
  const field = (labelText, node) => PF.el("div", null, [PF.el("label", { style: S.label, text: labelText }), node]);
  const input = (value) => PF.el("input", { style: S.input, value });
  const select = (options) =>
    PF.el(
      "select",
      { style: S.input },
      options.map(([v, t]) => PF.el("option", { value: v, text: t })),
    );

  // Per-theme wizard defaults: picking a theme re-skins the whole run — genre
  // text for the GM, default name/setting/goals, spatial seed, and the tile
  // theme the world builder paints with (PF.art themes). Fields the player has
  // already edited are never overwritten by a theme change.
  const THEME_PRESETS = {
    "cozy-village": {
      genre: "Cozy pixel-art village RPG (Stardew/Harvest-Moon-like), slice of life with gentle adventure",
      name: "Hearthvale",
      setting:
        "The pixel village of Hearthvale: a cozy closed valley with an inn (The Amber Hearth, kept by Mira), " +
        "Tam's farm, and a small guard post watched by Rook. Slice-of-life with gentle mystery; danger exists but is rare.",
      goals: "Settle into Hearthvale, get to know its people, and follow whatever quiet mysteries surface.",
      spatial:
        "A small closed valley. Root location: the village of Hearthvale. Children: The Amber Hearth Inn, " +
        "Tam's Farm, the Guard Post, the Village Pond. Keep the world compact and walkable.",
    },
    "sci-fi-colony": {
      genre: "Pixel-art sci-fi frontier-colony RPG, slice of life with gentle mystery among the stars",
      name: "Meridian Base",
      setting:
        "Meridian Base, a small frontier colony under a sealed sky: a hab ring with a cantina (kept by Mira), " +
        "Tam's hydroponics bay, and a landing pad watched by Rook. Slice-of-life with gentle mystery; danger exists but is rare.",
      goals: "Settle into the colony, get to know its crew, and follow whatever quiet mysteries surface.",
      spatial:
        "A compact pressurised colony. Root location: Meridian Base. Children: the Cantina, the Hydroponics Bay, " +
        "the Landing Pad, the Coolant Pool. Keep the world compact and walkable.",
    },
  };

  const themeSel = select(
    (PF.art.themeIds ? PF.art.themeIds() : ["cozy-village"])
      .filter((id) => THEME_PRESETS[id])
      .map((id) => [id, id === "cozy-village" ? "Cozy village" : "Sci-fi colony"]),
  );

  const nameIn = input(THEME_PRESETS["cozy-village"].name);
  const seedIn = input(String((Math.random() * 0xffffffff) >>> 0));
  const settingIn = PF.el("textarea", { style: `${S.input}min-height:64px;`, rows: "3" });
  settingIn.value = THEME_PRESETS["cozy-village"].setting;

  // Swap theme-derived defaults on selection, but only for fields still holding
  // the previous theme's default — a player's own text always wins.
  let appliedTheme = "cozy-village";
  themeSel.addEventListener("change", () => {
    const previous = THEME_PRESETS[appliedTheme];
    const next = THEME_PRESETS[themeSel.value];
    if (!next || !previous) return;
    if (nameIn.value === previous.name) nameIn.value = next.name;
    if (settingIn.value === previous.setting) settingIn.value = next.setting;
    appliedTheme = themeSel.value;
  });
  const toneSel = select([
    ["cozy, warm, gently comedic", "Cozy & warm"],
    ["wistful, quiet, bittersweet", "Wistful & quiet"],
    ["adventurous with cozy downtime", "Adventurous"],
  ]);
  const diffSel = select([
    ["easy", "Easy"],
    ["normal", "Normal"],
    ["hard", "Hard"],
  ]);
  const ratingSel = select([
    ["sfw", "SFW"],
    ["nsfw", "NSFW"],
  ]);
  // DECLINING IS A CHOICE AGAIN. The wizard stamped `generate: true`
  // unconditionally, which quietly retired the skip affordance: the themed-default
  // immediate-play path — no loading gate, no starting purse, walk in and play —
  // became unreachable for every new chat, even though the save path never stopped
  // supporting it (`briefExpected` is exactly this flag, and the `{skipped:true}`
  // marker is a second, post-hoc route it also still reads). Checked by default,
  // because a generated world IS the package; unchecked is somebody who wants the
  // village they already know, or does not want to spend the call.
  const generateIn = PF.el("input", { type: "checkbox" });
  generateIn.checked = true;
  const generateRow = PF.el(
    "label",
    { style: "display:flex;gap:8px;align-items:center;font:12px/1.5 inherit;cursor:pointer;margin-top:10px;" },
    [generateIn, PF.el("span", { text: "Generate a unique world with your GM connection (one call)" })],
  );
  const connSel = select([["", "Loading connections…"]]);
  const partyBox = PF.el("div", {
    style: "display:flex;flex-direction:column;gap:4px;max-height:130px;overflow:auto;" + S.input,
  });
  partyBox.textContent = "Loading characters…";

  const errEl = PF.el("div", {
    style: "color:#e0837f;font:600 12px/1.5 inherit;margin-top:10px;white-space:pre-wrap;display:none;",
  });
  const launchBtn = PF.el("button", {
    type: "button",
    style: `${S.btn}background:var(--primary,#2f6b4f);color:var(--primary-foreground,#fff);border:none;`,
  });
  // The button names the world you are about to walk into, so it answers to the
  // name field and the theme rather than to a literal. It shipped as the constant
  // "Begin in Hearthvale" and only the RETRY path below ever rewrote it, so a
  // sci-fi colony called Meridian Base offered to begin in a cozy village that was
  // not in the game. One function, called at every site that can change the answer.
  const syncLaunchLabel = () => {
    const preset = THEME_PRESETS[themeSel.value] || THEME_PRESETS["cozy-village"];
    launchBtn.textContent = `Begin in ${nameIn.value.trim() || preset.name}`;
  };
  syncLaunchLabel();
  nameIn.addEventListener("input", syncLaunchLabel);
  // Registered AFTER the defaults-swap listener above, so it reads the name that
  // listener may have just re-skinned rather than the one it replaced.
  themeSel.addEventListener("change", syncLaunchLabel);
  const cancelBtn = PF.el("button", {
    type: "button",
    style: `${S.btn}background:transparent;color:inherit;`,
    text: "Back",
    onclick: () => el._pfProps?.onCancel?.(),
  });

  const root = PF.el("div", { style: "font-family:inherit;color:inherit;" }, [
    PF.el("p", {
      style: "font:12px/1.6 inherit;opacity:0.8;margin:0 0 4px;",
      text:
        "A walkable pixel village. Talk to villagers to drive the story; the GM narrates in the panel below the world. " +
        "Uses the engine's own combat, and follows the World Map when its agent is active.",
    }),
    field("Game name", nameIn),
    PF.el("div", { style: S.row }, [
      PF.el("div", { style: "flex:1;" }, [field("Theme", themeSel)]),
      PF.el("div", { style: "flex:1;" }, [field("World seed", seedIn)]),
    ]),
    field("Setting", settingIn),
    generateRow,
    PF.el("div", { style: S.row }, [
      PF.el("div", { style: "flex:1;" }, [field("Tone", toneSel)]),
      PF.el("div", { style: "flex:1;" }, [field("Difficulty", diffSel)]),
      PF.el("div", { style: "flex:1;" }, [field("Rating", ratingSel)]),
    ]),
    field("GM connection", connSel),
    field("Party characters (the villagers are NPCs; pick your party or none)", partyBox),
    errEl,
    PF.el("div", { style: `${S.row}margin-top:14px;justify-content:flex-end;` }, [cancelBtn, launchBtn]),
  ]);
  el.replaceChildren(root);

  const partyChecks = [];
  void (async () => {
    try {
      const conns = await PF.api.getJson("/connections");
      // Text-capable connections only — the host doesn't re-check eligibility,
      // and an image/video connection here fails at first generation (review finding).
      const list = (Array.isArray(conns) ? conns : []).filter(
        (c) => c?.provider !== "image_generation" && c?.provider !== "video_generation",
      );
      connSel.replaceChildren(
        ...list.map((c) =>
          PF.el("option", {
            value: typeof c?.id === "string" ? c.id : "",
            text: typeof c?.name === "string" ? c.name : typeof c?.label === "string" ? c.label : String(c?.id ?? "?"),
          }),
        ),
      );
      const preferred = list.find((c) => c?.isDefault) ?? list.find((c) => c?.fallbackForMain);
      if (preferred && typeof preferred.id === "string") connSel.value = preferred.id;
      if (!list.length) connSel.replaceChildren(PF.el("option", { value: "", text: "No text connections configured" }));
    } catch {
      connSel.replaceChildren(PF.el("option", { value: "", text: "Could not load connections" }));
    }
    try {
      const chars = await PF.api.getJson("/characters");
      partyBox.replaceChildren();
      for (const c of Array.isArray(chars) ? chars : []) {
        const id = typeof c?.id === "string" ? c.id : null;
        if (!id) continue;
        const name =
          typeof c?.name === "string" && c.name ? c.name : typeof c?.data?.name === "string" ? c.data.name : id;
        const cb = PF.el("input", { type: "checkbox", value: id });
        partyChecks.push(cb);
        partyBox.appendChild(
          PF.el("label", { style: "display:flex;gap:8px;align-items:center;font:12px/1.5 inherit;cursor:pointer;" }, [
            cb,
            PF.el("span", { text: name }),
          ]),
        );
      }
      if (!partyBox.children.length)
        partyBox.textContent = "No characters yet — that's fine, the GM plays the villagers.";
    } catch {
      partyBox.textContent = "Could not load characters (the GM will play the villagers).";
    }
  })();

  launchBtn.addEventListener("click", async () => {
    errEl.style.display = "none";
    const gmConnectionId = connSel.value || null;
    if (!gmConnectionId) {
      errEl.textContent = "Pick a GM connection first — the game cannot run without one.";
      errEl.style.display = "block";
      return;
    }
    // Strict parse: a purely-numeric entry (including 0) is used verbatim;
    // anything else — "42abc" included — hashes as a text seed instead of
    // silently truncating at the first non-digit.
    const seedText = seedIn.value.trim();
    const seed = (/^\d+$/.test(seedText) ? Number.parseInt(seedText, 10) : PF.hashStr(seedText || nameIn.value)) >>> 0;
    const preset = THEME_PRESETS[themeSel.value] || THEME_PRESETS["cozy-village"];
    const setupConfig = {
      genre: preset.genre,
      setting: settingIn.value.trim() || preset.setting,
      tone: toneSel.value,
      difficulty: diffSel.value,
      rating: ratingSel.value,
      gmMode: "standalone",
      playerGoals: preset.goals,
      partyCharacterIds: partyChecks.filter((cb) => cb.checked).map((cb) => cb.value),
      gameWorldMapMode: "hierarchical",
      enableAgents: true,
      spatialMapInstructions: preset.spatial,
      combatStyle: "classic",
      experienceConfig: { seed, theme: themeSel.value, generate: generateIn.checked },
    };
    launchBtn.disabled = true;
    cancelBtn.disabled = true; // mirror the host's mid-launch freeze
    launchBtn.textContent = "Setting up…";
    try {
      await el._pfProps.onLaunch(setupConfig, nameIn.value.trim() || preset.name, undefined, {
        gmConnectionId,
      });
      // NO WORLD IS SEEDED HERE ANY MORE (plan §Q3b, maintainer ruling #7). The
      // wizard used to write a default themed snapshot into chat metadata so the
      // first surface load had something to show while generation ran behind a
      // toast — and that snapshot WAS the throwaway world the ruling abolished:
      // the first thing a brand-new chat stored was a save for a world nobody
      // meant to keep. The surface now holds a loading gate until the brief seals,
      // so there is nothing to show and nothing to seed, and determinism is
      // unaffected because simFromSaved re-derives the seed and theme from
      // `experienceConfig` (PF.save._configSeed/_configTheme) exactly as this
      // snapshot did. The `generate` flag above is the whole handoff — and when it
      // is false there is nothing to hand off: no gate arms, no call is made, and
      // the themed default world is what the player walks into.
    } catch (err) {
      errEl.textContent =
        err && err.message ? String(err.message) : "Launch failed — check the connection and try again.";
      errEl.style.display = "block";
      launchBtn.disabled = false;
      cancelBtn.disabled = false;
      syncLaunchLabel();
    }
  });
};

// ===== 90-element.js =====
// ── Core singleton + custom element (double-mount adapter) ────────────────────
// The host instantiates the SAME element twice with view="surface": an underlay
// (props: {layer:"underlay", backgroundUrl}) that must render the world, and a
// z-30 main mount (full engine props, no `layer` key) that must render only the
// HUD. `layer` is UNKNOWN at connectedCallback — props land afterwards — so all
// role wiring happens on props arrival. Both instances couple through this
// module-scope singleton with a one-canvas-ever invariant; a version bump or
// error-retry remounts BOTH elements and the singleton must survive it.
PF.core = {
  chatId: null,
  sim: null,
  render: null,
  hud: null,
  host: null, // latest main-mount props
  input: { up: false, down: false, left: false, right: false },
  canvas: null,
  _underlayEl: null,
  _underlayWrap: null,
  _mainEl: null,
  _raf: 0,
  _lastT: 0,
  _acc: 0,
  _narrationDoneWas: true,
  // The person the Talk button is currently asking to skip unread story for AND
  // the GM turn it is asking about, or null. See interact() — it is one press of
  // state and nothing persists it.
  _talkConfirm: null,
  _keysBound: false,
  _resizeObs: null,
  _resumeMode: "walk", // mode to restore when combat/replay ends
  _combatOverride: false, // player chose to keep exploring during a narrative "combat" state
  _lastPosSave: 0,

  // ── attachment ──────────────────────────────────────────────────────────────
  attachUnderlay(el, props) {
    if (this._underlayEl === el) return;
    this._underlayEl = el;
    el.style.display = "block";
    if (!this.canvas) {
      this.canvas = PF.offscreen(PF.VW, PF.VH);
      this.canvas.style.cssText = "image-rendering:pixelated;image-rendering:crisp-edges;display:block;";
      this.render = new PF.Render(this.canvas);
    }
    if (!this._underlayWrap) {
      this._underlayWrap = PF.el("div", {
        style: "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;",
      });
      this._underlayWrap.appendChild(this.canvas);
    }
    el.replaceChildren(this._underlayWrap);
    this._resizeObs?.disconnect();
    this._resizeObs = new ResizeObserver(() => this._rescale());
    this._resizeObs.observe(el);
    this._rescale();
    this._ensureLoop();
    void props; // backgroundUrl is painted by the host behind us; nothing to do yet
  },

  attachMain(el, props) {
    if (this._mainEl !== el) {
      this._mainEl = el;
      el.style.display = "block";
      this.hud?.destroy();
      this.hud = new PF.Hud(el, this);
      this._bindKeys();
    }
    this.onMainProps(props);
    this._ensureLoop();
  },

  detach(el) {
    if (el === this._underlayEl) {
      this._underlayEl = null;
      this._resizeObs?.disconnect();
      this._resizeObs = null;
    }
    if (el === this._mainEl) {
      this._mainEl = null;
      this.hud?.destroy();
      this.hud = null;
      this._unbindKeys();
      // Hand classic chrome back so an error/unmount can never strand the
      // player with no turn input (review blocker): the host clears its seam
      // state only on chat switch, not on element unmount.
      this._releaseChrome();
    }
    if (!this._underlayEl && !this._mainEl) {
      // Last detach: stop the loop and flush. Element remounts (version bump,
      // retry) recreate both instances momentarily; state stays in the module
      // so the rebuild is seamless. The page is still alive here — a real exit
      // fires pagehide, which takes the out-of-band teardown path — so this
      // keeps the ordinary checked flush and may still re-arm on failure.
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = 0;
      void PF.save.flush(this, true);
    }
  },

  _rescale() {
    if (!this._underlayEl || !this.canvas) return;
    const w = this._underlayEl.clientWidth || PF.VW;
    const h = this._underlayEl.clientHeight || PF.VH;
    let scale = Math.min(w / PF.VW, h / PF.VH);
    if (scale >= 1) scale = Math.floor(scale); // integer scale = real pixel art
    this.canvas.style.width = `${Math.round(PF.VW * scale)}px`;
    this.canvas.style.height = `${Math.round(PF.VH * scale)}px`;
  },

  // ── props / state ───────────────────────────────────────────────────────────
  onMainProps(p) {
    if (!p || typeof p.chatId !== "string") return;
    if (p.chatId !== this.chatId) this._switchChat(p);
    this.host = p;
    // Tier-1 art rides the packageId/packageVersion the host injects (engine
    // #5092); load() is idempotent and Tier-0 remains the fallback throughout.
    void PF.assets.load(this);

    // Self-heal an erased save key (engine's unqueued updateMetadata writers —
    // issue #5076 class; review finding).
    const meta = p.chatMeta && typeof p.chatMeta === "object" ? p.chatMeta : {};
    PF.save.ensurePresent(this, meta);

    // Mode arbitration: replay > combat > (walk|dialogue kept as-is).
    // Prefer the real combat signal (Capability API 1.11, #5094): true the
    // instant the combat UI actually mounts. Fallback for older engines is the
    // GM's NARRATIVE gameActiveState — which can say "combat" without any
    // combat UI mounting, so it pauses the world but the HUD always keeps a
    // Resume exit, and the player's override wins until the state clears.
    this._combatSignalIsReal = typeof p.combatActive === "boolean";
    const combatState = this._combatSignalIsReal ? p.combatActive : meta.gameActiveState === "combat";
    if (!combatState) this._combatOverride = false;
    // A failed encounter generation would otherwise leave the player watching
    // for a combat that never comes — surface it once per distinct error.
    if (p.combatError && p.combatError !== this._lastCombatError) {
      this._lastCombatError = p.combatError;
      this.hud?.toast("The encounter fizzled — try again.");
    }
    if (p.replayActive) this.setMode("replay");
    else if (combatState && !this._combatOverride) this.setMode("combat");
    else if (this.sim && (this.sim.mode === "replay" || this.sim.mode === "combat")) this.setMode(this._resumeMode);

    // Turn finished → the GM may have moved the party or changed the world —
    // and the timeline may have moved under us (swipe/branch/checkpoint load):
    // in routes mode the anchored server row is the authority, so check it.
    const narrationDone = p.narrationDone !== false;
    if (narrationDone && !this._narrationDoneWas) {
      void PF.spatial.refresh(this);
      void PF.save.checkRewind(this);
      PF.save.markDirty(this);
    }
    this._narrationDoneWas = narrationDone;
    // Declared every props delivery: the host wipes its seam state on scope
    // changes the package can't see, and it dedupes identical declarations
    // by value itself — a package-side cache only causes lost declarations.
    this._declareChrome();
  },

  _switchChat(p) {
    // The pending write belongs to the chat we are LEAVING, so capture it
    // SYNCHRONOUSLY — reset() clears the dedupe caches and the lines below
    // reassign chatId/sim, and a chained flush that snapshotted later wrote
    // the NEW chat's world under the new id while the old chat's last
    // mutation went in the bin.
    const pending = this.chatId ? PF.save.captureFlush(this) : null;
    PF.spatial.reset();
    PF.save.reset();
    if (pending) void PF.save.flush(this, false, pending);
    this.chatId = p.chatId;
    // Synchronous boot from the metadata cache (instant world), then adopt()
    // probes the experience-state routes (#5102) and, when available, promotes
    // the timeline-anchored server row to authority — rebuilding if it differs.
    this.sim = PF.save.restore(p.chatMeta ?? {}, p.chatId);
    this.host = p;
    // THE LOADING GATE (plan §Q3b, maintainer ruling #7). A generate-configured
    // chat whose brief is not sealed yet does not enter play: the surface shows a
    // loading state, the sim does not step, no mutator resolves and no save is
    // emitted, until the brief seals and the world compiles. Armed BEFORE adopt
    // because adopt's row-3 branch is a write, and a chat that has not been
    // entered must not have its placeholder world written up as somebody's play.
    // Legacy and non-generate chats never arm it and play immediately.
    if (!PF.save.armGate(this, p.chatMeta ?? {})) void PF.save.adopt(this);
    // Generation runs behind the gate; on success it compiles the world, lifts the
    // gate and calls adopt itself. On failure the gate offers retry and the chat
    // stays unsealed, so the next visit arms it again.
    void PF.save.maybeGenerateBrief(this);
    // New chat, new world: drop every cached zone composite — the cache is
    // keyed by zone id alone, so a stale entry would show the previous game.
    this.render?.clearZones();
    this._resumeMode = "walk";
    this._combatOverride = false;
    // A pending skip-confirm belongs to the chat that armed it: the NPC it names
    // is an id in the OLD world, and the arriving chat's narration is its own
    // question. (talkConfirmArmed drops it on its own too — this is the seam
    // where "the same id in a different world" could otherwise match.)
    this._talkConfirm = null;
    this._lastPosSave = 0;
    this.hud?.refreshChips();
    void PF.spatial.refresh(this);
  },

  setMode(mode) {
    if (!this.sim || this.sim.mode === mode) return;
    const prev = this.sim.mode;
    if ((mode === "combat" || mode === "replay") && (prev === "walk" || prev === "dialogue")) {
      this._resumeMode = prev; // don't collapse dialogue into walk on exit (review finding)
    }
    this.sim.mode = mode;
    // A pending skip-confirm does not survive the mode changing under it. The
    // question is asked in walk mode standing next to somebody, and every way out
    // of that frame — the Keyboard button handing the turn to the host, a cutscene
    // beat, combat, the send path itself — is the player doing something else with
    // the narration than the question was about. Cheapest honest rule: switching
    // modes drops it, so coming back to walk asks again. (Named as a clear
    // condition by the fix that introduced the confirm; this is where it is true.)
    this._talkConfirm = null;
    // Replay returns out of the frame loop before sim.step(), so the sim's own
    // walk-only guard can never fire for it — the one function that changes mode
    // drops the beat instead, and the declaration below is honest immediately.
    if (mode !== "walk") {
      this.sim.cutscene = null;
      // The frame loop re-declares only when the beat state DIFFERS from the
      // memo of what we last asked for, so dropping the beat has to move the
      // memo too. Left stale at true, the next beat matches it and is never
      // declared — the host is never asked to collapse that one (review finding).
      this._cutsceneDeclared = false;
    }
    this.input.up = this.input.down = this.input.left = this.input.right = false;
    this._declareChrome();
    this.hud?.update();
  },

  /** Resume button: exits dialogue, or overrides a narrative-only combat state.
   *  When the engine provides the REAL combat signal (Capability API 1.11) the
   *  combat UI actually owns the screen, so there is nothing to override —
   *  the HUD simply stays hidden until combat ends. */
  resume() {
    if (!this.sim) return;
    if (this.sim.mode === "combat") {
      if (this._combatSignalIsReal) return;
      this._combatOverride = true;
    }
    this._resumeMode = "walk";
    this.setMode("walk");
  },

  _declareChrome() {
    const fn = this.host?.setExperienceChrome;
    if (typeof fn !== "function" || !this.sim) return;
    try {
      fn({
        // The gate takes the input claim with it: while it holds there is nothing
        // to walk in, and leaving the claim up would strand the player with the
        // classic turn chrome hidden behind a loading panel.
        providesPlayerInput: this.sim.mode === "walk" && !PF.save.gateHolds(this),
        // Transient: asked only while a cutscene beat runs. The host restores
        // the player's own setting the moment we stop asking, and its own
        // safety rules still outrank us, so this can never trap a player.
        requestsCollapsedNarration: !!this.sim.cutscene,
        providesChoices: false,
        providesInventory: false,
        providesCombat: false,
      });
    } catch (err) {
      // Recoverable — never escalate to the runtime-error contract (it unmounts
      // the surface and its retry card is pointer-events-none; review blocker).
      console.warn("[pixelforge] chrome declaration failed", err);
    }
  },

  _releaseChrome() {
    const fn = this.host?.setExperienceChrome;
    if (typeof fn !== "function") return;
    try {
      fn(null);
    } catch {
      /* releasing must never throw */
    }
  },

  // ── interaction ─────────────────────────────────────────────────────────────

  /** Does the latest GM turn still hold narration the player has not been shown?
   *
   *  `narrationDone` is the host's per-turn presentation flag: it goes true when
   *  the player reaches the last segment of the latest assistant message, and it
   *  is the ONLY narration-presentation signal on the surface props — there is no
   *  segment count, no cursor, and no way to advance the presentation from here.
   *  So this is a question the package can ask and not one it can answer.
   *
   *  `latestAssistant` is the second half and not a belt-and-braces check: with
   *  no assistant turn on the chat at all the host has no message to compare its
   *  done-marker against, so `narrationDone` is false for a chat that has no
   *  story in it yet — and a greeting in an empty chat skips nothing. */
  _storyPending() {
    return this.host?.narrationDone === false && !!this.host?.latestAssistant;
  },

  /** Is the Talk button asking to skip unread story right now?
   *
   *  ALSO where the question goes stale, so the button and the verb can never
   *  disagree about what a press means: the narration finishing, walking away,
   *  and walking to somebody else all drop it. Read every frame by the HUD.
   *
   *  THE TURN IS PART OF THE QUESTION, not just the person. `narrationDone` is
   *  per-turn and goes false again for every new GM turn, so "still pending" is
   *  not the same fact from one turn to the next: the player can arm the confirm
   *  against turn A, type into the host's own message box instead of pressing
   *  again, and have turn B arrive unread — and a confirm that only remembered
   *  the NPC would let ONE press spend B on the permission they gave for A. The
   *  permission was for the narration they had decided to skip; a different one
   *  is asked about in its own right. */
  talkConfirmArmed() {
    if (!this._talkConfirm) return false;
    const npc = this.sim?.nearNpc;
    const turn = this.host?.latestAssistant?.id ?? null;
    if (!this._storyPending() || !npc || npc.id !== this._talkConfirm.id || turn !== this._talkConfirm.turn) {
      this._talkConfirm = null;
      return false;
    }
    return true;
  },

  interact() {
    const sim = this.sim;
    if (!sim || sim.mode !== "walk" || !sim.nearNpc) return;
    if (PF.save.gateHolds(this)) return; // nobody to talk to in a world still being written
    if (!this.host?.sendMessage) return;
    if (this.host.isStreaming) {
      this.hud?.toast("The story is still being written…");
      return;
    }
    const npc = sim.nearNpc;
    // UNREAD STORY IS NOT SOMETHING A GREETING GETS TO SPEND (playtest 2).
    // The maintainer wandered off mid-narration, pressed E on the nearest NPC,
    // and lost everything from the arrival narration onward: the turn this sends
    // ends the one being presented, so the segments they had not reached simply
    // never appeared — survived only in Logs — and they never said to skip them.
    //
    // WALKING IS NOT BLOCKED and never should be; the world staying live under
    // the narration is the point of it. What is gated is the TURN, and the
    // smallest honest gate is an affirmative press: the first one turns the
    // button into the question and sends nothing, the second sends. The keyboard
    // path is the same button, so `e` asks once too.
    //
    // A CONFIRM AND NOT A FAST-FORWARD, deliberately. Fast-forwarding is the
    // better affordance and the package cannot do it: presentation is advanced by
    // host-private state (there is no such call on the surface props), so a
    // package-side "skip" could only ever mean sending anyway and calling it
    // skipping. The dialogue model that would make this moot is a roadmap item.
    if (this._storyPending() && !this.talkConfirmArmed()) {
      // Keyed on the TURN as well as the person: _storyPending() has already
      // established there is a latest assistant turn, and the permission the
      // second press gives is permission to spend THAT one.
      this._talkConfirm = { id: npc.id, turn: this.host?.latestAssistant?.id ?? null };
      this.hud?.toast("Story still to read — press again to skip ahead and talk.");
      this.hud?.update();
      return;
    }
    this._talkConfirm = null;
    // The generation this turn belongs to. The .then() below runs after an await,
    // so a chat switch can land under it — and every mutator RE-RESOLVES core.sim,
    // which means an unfenced bump would credit the arriving chat's block with the
    // departing chat's conversation.
    const gen = PF.save._gen ?? 0;
    this.setMode("dialogue");
    this.hud?.toast(`Talking to ${npc.name}`);
    const text = `${sim.composePrefix(npc)} I walk up to ${npc.name} the ${npc.role} and greet them.`;
    // THE COMPOSED TURN'S OWN PENDING, captured HERE and closure-local. Two
    // readings of this would be wrong and both are easy: re-reading
    // `sim._pendingIntro` after the await finds the null commitIntro left behind
    // and burns nothing FOREVER (the wrap-up would then be re-told on every turn
    // for the rest of the save), and re-reading it before the burn finds whatever
    // a sender that interleaved with this one composed instead. The object
    // reference survives the wholesale null, so the turn that was sent is the
    // turn that gets burned.
    const pend = sim._pendingIntro;
    void Promise.resolve(this.host.sendMessage(text))
      .then((ok) => {
        if (ok === false) {
          this.setMode("walk");
          this.hud?.toast("The story isn't accepting turns right now.");
        } else {
          sim.commitIntro();
          // THE WRAP-UP BURN, on the same accepted-turn signal the one-shot flags
          // burn on and for the same reason: a refused or failed send is not a
          // telling. The mutator guards itself against the sim having moved under
          // the await, and a refusal is SWALLOWED — no toast, no retry. The tell
          // stays in history un-burned and the next compose says it again, which
          // is a §5 lost-flush and not something to interrupt anybody about.
          // The pending carries the notice ROWS as well as the day, so the burn
          // marks the band THIS turn told rather than the live one, which a
          // rebuild can have appended to under the await (plan §2.5).
          if (pend?.ledger) PF.player.flush(this, pend.ledger.throughDay, pend.ledger.notices, gen);
          // P2's ledger goes live on the cheapest honest signal there is: the
          // encounter count moves when the host ACCEPTS the turn, exactly where
          // the one-shot intro flags burn, and for the same reason — a refused
          // or failed send is not a conversation. SETTLEMENT-scoped (plan §2:
          // rel keys are per settlement), so one person is one row wherever in
          // the world you happen to meet them. Surfacing the disposition in the
          // turn header is P2's own item and deliberately not here.
          PF.player.bump(this, sim.world.startZone, npc.name, { t: 1 }, gen);
        }
      })
      .catch((err) => {
        // Recoverable per-turn failure: stay mounted, tell the player, move on.
        this.setMode("walk");
        this.hud?.toast("That didn't go through — try again.");
        console.warn("[pixelforge] interact send failed", err);
      });
    PF.save.markDirty(this);
  },

  markDirty() {
    if (this.sim) PF.save.markDirty(this);
  },

  // ── input ───────────────────────────────────────────────────────────────────
  _hostOwnsKeyboard() {
    // Never fight the host for keys. Two checks, deliberately narrow (the
    // first live playtest showed broad ones misfire — the toast container is
    // a permanently-mounted [data-chat-floating-panel]):
    // 1) focus is inside a host control (covers inputs, selects, menus,
    //    floating panels — focus follows interaction);
    // 2) a visible MODAL dialog is open (aria-modal, e.g. the setup wizard).
    const ae = document.activeElement;
    if (ae && ae !== document.body && ae !== document.documentElement && !(this._mainEl && this._mainEl.contains(ae)))
      return true;
    for (const node of document.querySelectorAll('[role="dialog"][aria-modal="true"]')) {
      const rect = node.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return true;
    }
    return false;
  },

  _bindKeys() {
    if (this._keysBound) return;
    this._keysBound = true;
    const DIRS = {
      w: "up",
      arrowup: "up",
      s: "down",
      arrowdown: "down",
      a: "left",
      arrowleft: "left",
      d: "right",
      arrowright: "right",
    };
    this._keyDown = (ev) => {
      if (!this.sim || !this._mainEl) return;
      if (PF.save.gateHolds(this)) return; // nothing to walk in yet
      const t = ev.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const k = ev.key.toLowerCase();
      if (this.sim.mode === "dialogue" && k === "escape") {
        this.setMode("walk");
        return;
      }
      if (this.sim.mode !== "walk" || this._hostOwnsKeyboard()) return;
      if (DIRS[k]) {
        this.input[DIRS[k]] = true;
        ev.preventDefault();
      } else if (k === "e") {
        // "e" only — Enter belongs to host buttons/menus (review finding)
        this.interact();
      } else if (k === "c") {
        // THE CHARACTER SHEET, and it is HERE rather than up beside the
        // dialogue-Escape branch on purpose (plan §2.8): everything above this
        // line is a guard the sheet needs — the loading gate, focus inside a
        // host control, a visible host modal, and walk mode — and a branch at
        // :451's level would skip every one of them.
        this.hud?.toggleSheet();
      } else if (k === "escape") {
        // …and Escape closes whichever panel is open. It cannot race the
        // dialogue-Escape branch above: that one returns, and a panel cannot be
        // open in dialogue mode at all, because leaving walk closes the sheet
        // and hides the journal (70-hud update()). No preventDefault, exactly as
        // the branch above and `e` beside it decline it — the host's own Escape
        // handling is not ours to cancel.
        this.hud?.closePanels();
      }
    };
    // keyup ALWAYS clears, whatever the target or open panels — otherwise a
    // keyup landing on an input leaves the avatar walking forever.
    this._keyUp = (ev) => {
      const dir = DIRS[ev.key.toLowerCase()];
      if (dir) this.input[dir] = false;
    };
    this._onBlur = () => {
      this.input.up = this.input.down = this.input.left = this.input.right = false;
    };
    window.addEventListener("keydown", this._keyDown);
    window.addEventListener("keyup", this._keyUp);
    window.addEventListener("blur", this._onBlur);
    if (!PF.core._pagehideBound) {
      PF.core._pagehideBound = true;
      // Out-of-band, NOT on the flush chain: the page is going away, and an
      // ordinary flush sitting mid-await would swallow the last write of the
      // session. Last-detach below keeps the chained path — that one is a
      // remount on a live page as often as it is a real exit.
      window.addEventListener("pagehide", () => PF.save.flushTeardown(PF.core));
    }
    if (!PF.core._capEventsBound) {
      PF.core._capEventsBound = true;
      // Capability API 1.12: the host addresses spatial transition events to
      // the game-owning package. One always-on listener, guarded by the live
      // chat id, so chat switches never leak or misroute a stale event.
      window.addEventListener("marinara-capability-server-event", (ev) => {
        const detail = ev?.detail;
        const core = PF.core;
        if (!detail || !core.chatId) return;
        if (detail.packageId !== (typeof core.host?.packageId === "string" ? core.host.packageId : "pixelforge"))
          return;
        if (detail.chatId !== core.chatId) return;
        PF.spatial.onHostEvent(core, detail);
      });
    }
  },

  _unbindKeys() {
    if (!this._keysBound) return;
    this._keysBound = false;
    window.removeEventListener("keydown", this._keyDown);
    window.removeEventListener("keyup", this._keyUp);
    window.removeEventListener("blur", this._onBlur);
  },

  // ── loop ────────────────────────────────────────────────────────────────────
  _ensureLoop() {
    if (this._raf) return;
    this._lastT = performance.now();
    const tick = (t) => {
      this._raf = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (t - this._lastT) / 1000);
      this._lastT = t;
      const sim = this.sim;
      if (!sim) return;
      if (PF.save.gateHolds(this)) {
        // THE LOADING GATE, ahead of every mode: no step, no clock, no draw. A sim
        // that stepped behind the loading panel would age a world nobody is in,
        // dirty itself against a save path that refuses to write, and burn the
        // cutscene beat before the player ever saw the place.
        this.render?.ctx.clearRect(0, 0, PF.VW, PF.VH);
        this.hud?.update();
        return;
      }
      if (sim.mode === "replay") {
        // Replay owns the screen: clear so the host visuals show through.
        this.render?.ctx.clearRect(0, 0, PF.VW, PF.VH);
        this.hud?.update();
        return;
      }
      this._acc = Math.min(this._acc + dt, 0.25);
      const STEP = 1 / 60;
      while (this._acc >= STEP) {
        this._acc -= STEP;
        const res = sim.step(STEP, this.input);
        // A beat starting or ending changes what chrome we are asking for.
        if (!!sim.cutscene !== this._cutsceneDeclared) {
          this._cutsceneDeclared = !!sim.cutscene;
          this._declareChrome();
        }
        if (res.zoneChanged) {
          this.hud?.refreshChips();
          // "location": the top strip, clear of the narration panel the bottom
          // toast surface sits over (70-hud `toast`).
          this.hud?.toast(sim.zone().name, "location");
          PF.save.markDirty(this);
        }
      }
      if (this._underlayEl) this.render?.draw(sim);
      // Positional autosave: at most one save per 30s of movement — the real
      // save triggers are events (zone change, dialogue, travel, turn end).
      // Never per-frame, never every debounce window (review finding).
      if (sim.dirty && t - this._lastPosSave > 30_000) {
        this._lastPosSave = t;
        PF.save.markDirty(this);
      }
      this.hud?.update();
    };
    this._raf = requestAnimationFrame(tick);
  },
};

// ── Custom element ────────────────────────────────────────────────────────────
class PixelforgeElement extends HTMLElement {
  constructor() {
    super();
    this._props = null;
    this._onPropsEvent = () => this._sync();
  }
  // The host assigns node.capabilityProps then dispatches marinara-capability-props;
  // support both the accessor and the event so either ordering works.
  set capabilityProps(value) {
    this._props = value;
    this._sync();
  }
  get capabilityProps() {
    return this._props;
  }
  connectedCallback() {
    this.addEventListener("marinara-capability-props", this._onPropsEvent);
    this._sync();
  }
  disconnectedCallback() {
    this.removeEventListener("marinara-capability-props", this._onPropsEvent);
    PF.core.detach(this);
  }
  _sync() {
    try {
      const view = this.getAttribute("view");
      const p = this._props;
      if (view === "setup") {
        if (p && typeof p.onLaunch === "function") PF.mountSetup(this, p);
        return;
      }
      if (view !== "surface" || !p) return;
      if (p.layer === "underlay") PF.core.attachUnderlay(this, p);
      else if (typeof p.chatId === "string") PF.core.attachMain(this, p);
    } catch (err) {
      // Unrecoverable wiring failure: hand classic chrome back FIRST so the
      // host's error card never strands the player without turn input.
      PF.core._releaseChrome();
      PF.fail(this, err);
    }
  }
}

const PF_TAG = "marinara-capability-pixelforge";
if (!customElements.get(PF_TAG)) customElements.define(PF_TAG, PixelforgeElement);

// Debug/testing handle: lets automated playtests (and future Playwright smoke
// lanes) inspect and step the world without relying on requestAnimationFrame,
// which browsers pause for non-composited tabs. The package runs full-trust in
// the main realm anyway, so this exposes nothing that wasn't already reachable.
// Gated behind an explicit opt-in so a shipped install doesn't hand other page
// scripts a ready-made driving handle (capability-equivalent to what any
// same-document script already has, but no reason to pre-assemble it).
try {
  if (globalThis.localStorage?.getItem("pixelforge-debug") === "1") globalThis.__pixelforge = PF;
} catch {
  // Storage access can throw in exotic embeddings; the handle just stays off.
}

})();
