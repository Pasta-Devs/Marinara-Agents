// Pixelforge 0.7.0 — Marinara Engine game-surface Experience (single-file client bundle)
// Built from packages/pixelforge/src (14 modules) by scripts/build-pixelforge-package.mjs. Do not edit; edit src/ and rebuild.
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
  /** Host-owned per-timeline save slot (engine #5102). 404 = route absent (older
   *  engine), 409 = chat not stamped for an Experience — both are mode signals,
   *  not errors, so this never throws on them. */
  async getExperienceState(chatId) {
    const res = await fetch(`/api/game/${encodeURIComponent(chatId)}/experience-state`, {
      headers: { Accept: "application/json" },
    });
    if (res.status === 404 || res.status === 409) return { available: false, status: res.status };
    if (!res.ok) throw new Error(`GET experience-state → ${res.status}`);
    return { available: true, status: res.status, body: await res.json() };
  },
  async putExperienceState(chatId, state, keepalive = false) {
    const res = await fetch(`/api/game/${encodeURIComponent(chatId)}/experience-state`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-marinara-csrf": "1" },
      body: JSON.stringify({ state }),
      keepalive,
    });
    if (!res.ok) throw new Error(`PUT experience-state → ${res.status}`);
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
    well(g) {
      px(g, 0, 0, T, T, PAL.grass1);
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
    table(g) {
      px(g, 0, 0, T, T, PAL.floor1);
      px(g, 2, 3, 12, 9, PAL.counter);
      px(g, 3, 4, 10, 7, PAL.path1);
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
        well(g) {
          px(g, 0, 0, T, T, PAL.grass1);
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
    const theme = THEMES[typeof id === "string" ? id : ""] ? id : "cozy-village";
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
  const SCALES = {
    outpost: { w: 28, h: 20, buildings: 4 },
    hamlet: { w: 34, h: 24, buildings: 6 },
    village: { w: 44, h: 30, buildings: 8 },
    town: { w: 56, h: 38, buildings: 12 },
  };
  const SURROUNDS = ["woods", "fields", "rocky", "water", "barren"];
  const PROSPERITY = ["struggling", "modest", "thriving"];
  const PLACE_KINDS = ["gathering", "workshop", "hall", "dwelling", "wilds"];
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

  const CAPS = { features: 4, places: 4, wilds: 2, hall: 1, gathering: 1, castMin: 4, castMax: 10, household: 6 };
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
      const bucket = value < 8 ? "outpost" : value < 20 ? "hamlet" : value < 60 ? "village" : "town";
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
    for (const item of asArray(src.features)) {
      if (brief.features.length >= CAPS.features) break;
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
    for (const item of asArray(src.places)) {
      if (brief.places.length >= CAPS.places) break;
      const kind = foldEnum(item?.kind, PLACE_KINDS, null);
      if (!kind) {
        repairs.push(`places: dropped item with kind ${JSON.stringify(item?.kind ?? null)}`);
        continue;
      }
      if (kind === "wilds" && wildsCount >= CAPS.wilds) continue;
      if (kind === "hall" && hallCount >= CAPS.hall) continue;
      if (kind === "gathering" && gatheringCount >= CAPS.gathering) continue;
      if (kind === "wilds") wildsCount++;
      if (kind === "hall") hallCount++;
      if (kind === "gathering") gatheringCount++;
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
    const rawCast = asArray(src.cast);
    const hasGathering = brief.places.some((p) => p.kind === "gathering");
    if (!hasGathering && brief.places.length < CAPS.places) {
      const host = rawCast.find((item) => foldEnum(item?.kind ?? item?.role, CAST_KINDS, null) === "host");
      const hostName = host ? capText(host.name, 20) : "";
      if (hostName) {
        brief.places.push({
          kind: "gathering",
          name: dedupeName(`${hostName}'s`, "places-host"),
          flavor: "",
        });
        repairs.push(`places: synthesized a gathering interior for host ${hostName}`);
      }
    }

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
    // Oversized households split (>6 members share a number).
    const byHousehold = new Map();
    for (const member of brief.cast) {
      const list = byHousehold.get(member.household) ?? [];
      list.push(member);
      byHousehold.set(member.household, list);
    }
    for (const [id, members] of byHousehold) {
      if (members.length <= CAPS.household) continue;
      // Seed-derived target (§3's single-entropy rule): scan from a seeded
      // offset for the first free household number.
      let next = 1 + ((det(seed, `household-split-${id}`)() * CAPS.household) | 0);
      while (byHousehold.has(next)) next = (next % (CAPS.household * 2)) + 1;
      for (const member of members.slice(CAPS.household)) member.household = next;
      byHousehold.set(next, members.slice(CAPS.household));
      repairs.push(`cast: household ${id} split (over ${CAPS.household} members)`);
    }
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

  // ── defaults(): the themed fallback brief (skip / failure — never a gate) ───
  function defaults(theme, seed) {
    return validate(DEFAULT_BRIEFS[theme] || DEFAULT_BRIEFS["cozy-village"], { theme, seed });
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
   *  Returns a SEALED brief only for outcomes worth sealing: success, salvage,
   *  or a deterministic/paid failure (400 contract, 422 provider/parse) →
   *  themed defaults. Transient outcomes — 404 route-absent, 409, 429, 5xx,
   *  network error, budget timeout — return NULL so the caller leaves the
   *  chat unsealed and the next boot simply tries again. */
  async function generate(
    chatId,
    { theme, seed, preferences, onProgress, budgetMs = 90_000, busyWaitMs = Math.min(15_000, budgetMs / 6) },
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
        return null;
      }
      console.warn(
        "[pixelforge] world generation failed; sealing the themed default",
        response.status,
        response.body?.error ?? null,
      );
    } catch (err) {
      // Network trouble and the budget timeout are both transient — leave the
      // chat unsealed rather than freezing the default world in forever.
      if (!controller.signal.aborted)
        console.warn("[pixelforge] world generation failed (network); retrying next visit", err);
      else console.warn("[pixelforge] world generation timed out; retrying next visit");
      return null;
    } finally {
      clearTimeout(timer);
    }
    return defaults(theme, seed);
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
      "  At most 2 wilds, 1 hall, 1 gathering. wilds may carry 0-3 features (water-crossing and",
      "  dense-growth are wilds-only). flavor: ONE sentence <=120 chars.",
      "- cast: 4-10 story-relevant people of {name, role, kind, tint, home, household, persona, standing}.",
      `  kind (machine field) from: ${CAST_KINDS.join(" | ")}. role: <=24 chars free text (their title).`,
      `  tint from: ${Object.keys(TINTS).join(" | ")}. home: the NAME of the zone they live in.`,
      "  household: 1-6 — people sharing a number share a roof; buildings are derived from",
      "  households, so do NOT list one household per person unless they truly live alone.",
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
              household: { type: "integer", minimum: 1, maximum: 6 },
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
  const PLACE_LABELS = {
    gathering: "The Hearth",
    workshop: "The Works",
    hall: "The Hall",
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

  return { VERSION, SCALES, TINTS, FEATURE_TAGS, CAPS, validate, defaults, guidance, schema, generate, salvageText };
})();

// ===== 20-world.js =====
// ── World generation ──────────────────────────────────────────────────────────
// Deterministic seed → zones. A zone is a tile grid with three layers (ground,
// object, overhead), a solidity map, portals, and NPCs. No host GameMap types
// are used — the world model is wholly package-owned (exploration R09/R10).
PF.world = (() => {
  const T = PF.TILE;

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
      lights: [], // {x, y} warm glow points at night
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

  /** A simple gabled building: stone footprint, plaster walls, roof overhead, one door. */
  function building(z, x0, y0, w, h, doorOffset, windows) {
    // walls occupy the bottom wall row; roof covers the rest as overhead
    const wallY = y0 + h - 1;
    fillRect(z, x0, y0, w, h, "ground", "stone", false);
    for (let x = x0; x < x0 + w; x++) {
      put(z, x, wallY, "object", "wall", true);
      for (let y = y0; y < wallY; y++) put(z, x, y, "object", "wallStone", true);
      for (let y = y0 - 2; y < y0; y++) put(z, x, y, "overhead", y === y0 - 2 ? "roof" : "roofEdge");
      for (let y = y0; y < wallY; y++) put(z, x, y, "overhead", "roof");
    }
    for (const wx of windows || []) {
      put(z, x0 + wx, wallY, "object", "window", true);
      z.lights.push({ x: x0 + wx, y: wallY });
    }
    const dx = x0 + doorOffset;
    put(z, dx, wallY, "object", "door", false);
    put(z, dx, wallY, "overhead", null);
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
  const PLACERS = {
    "water-feature"(z, x, y) {
      fillRect(z, x, y, 6, 4, "ground", "water", true);
      put(z, x + 6, y + 1, "object", "well", true);
    },
    "crop-plots"(z, x, y) {
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
      fillRect(z, x, y, 2, 2, "ground", "path", false);
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
  const ZONE_NAMES = {
    "cozy-village": { village: "Hearthvale", inn: "The Amber Hearth Inn", forest: "The Whisperwood" },
    "sci-fi-colony": { village: "Meridian Base", inn: "The Meridian Cantina", forest: "The Mast Field" },
  };

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
      try {
        return compile(sealedBrief, seed);
      } catch (err) {
        console.warn("[pixelforge] stored brief failed to compile; using the themed legacy world", err);
      }
    }
    return buildLegacy(seed, theme);
  }

  function buildLegacy(seed, theme) {
    const activeTheme = PF.art.setTheme ? PF.art.setTheme(theme) : "cozy-village";
    const names = ZONE_NAMES[activeTheme] || ZONE_NAMES["cozy-village"];
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
    fillRect(f, 20, 12, 2, 2, "ground", "path", false); // the ford
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
      { id: "tam", name: "Tam", role: "farmer", hue: 96, x: 8, y: 22, wander: { x0: 4, y0: 20, x1: 11, y1: 24 } },
      {
        id: "rook",
        name: "Rook",
        role: "village guard",
        hue: 210,
        x: 21,
        y: 10,
        wander: { x0: 17, y0: 8, x1: 24, y1: 18 },
      },
    );
    n.npcs.push({
      id: "mira",
      name: "Mira",
      role: "innkeeper",
      hue: 8,
      x: 5,
      y: 4,
      wander: { x0: 2, y0: 4, x1: 8, y1: 9 },
    });
    f.npcs.push({
      id: "fen",
      name: "Fen",
      role: "forager",
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
      bindings: {}, // spatialLocationId → zoneId
    };
  }

  // ── compile(sealedBrief, seed): the deterministic half of the hybrid ────────
  // The brief says WHAT exists; every position below is computed. Zone keys are
  // the brief's ordinal ids (z1 = settlement), so saves and World Maps bindings
  // never depend on model-written names. See docs/brief-schema.md §4.5:
  // buildings derive from households + cast kinds, over-subscription MERGES
  // households into shared blocks — a named NPC's home is never dropped.
  const SPECIAL_BUILDING_KINDS = {
    leader: "hall",
    host: "gathering",
    grower: "farm",
    guard: "post",
    merchant: "shop",
    maker: "shop",
  };
  const INTERIOR_DIMS = { gathering: [16, 12], workshop: [16, 12], hall: [18, 12], dwelling: [14, 10] };

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
    v.spawn = { x: midX, y: midY + 2 };
    // Injection-discipline prose (§7) rides the world so the runtime never
    // needs the brief: zone flavor injects once on first entry, the situation
    // once on the first outbound message.
    v.flavor = brief.flavor;

    // ── Building arithmetic (§4.5) ──
    // A settlement dwelling is minted only for a resident who actually lives at
    // the root (home === the settlement). A resident whose home is a place or the
    // wilds — a forager who lives in the woods, a smith who sleeps at the forge —
    // lives THERE and anchors to that zone in the cast loop, so a town house would
    // sit permanently empty. Transient/fringe/destitute NPCs get no house at all
    // (they anchor to a standing-specific rest spot). This mirrors the harness's
    // rootHouseholds, so compiler and invariant agree by construction.
    const households = [
      ...new Set(
        brief.cast
          .filter((m) => (m.standing ?? "resident") === "resident" && m.home === brief.name)
          .map((m) => m.household),
      ),
    ].sort((a, b) => a - b);
    const specials = [];
    const seenSpecial = new Set();
    for (const member of brief.cast) {
      // Only residents run a permanent special building (the hall, the shop, the
      // post…); a transient/fringe/destitute NPC never anchors one.
      if ((member.standing ?? "resident") !== "resident") continue;
      const special = SPECIAL_BUILDING_KINDS[member.kind];
      if (special && !seenSpecial.has(special)) {
        seenSpecial.add(special);
        specials.push({ special, owner: member });
      }
    }
    // Interior places claim a facade: gathering binds to the host's building,
    // hall to the leader's — their doors become the interior portals.
    const interiorPlaces = brief.places.filter((p) => p.kind !== "wilds");
    const wildsPlaces = brief.places.filter((p) => p.kind === "wilds");
    const budget = Math.max(scale.buildings, households.length ? 1 : 0);
    // Merge over-subscribed households into shared blocks: a merged household
    // keeps every member housed (never dropped), just under a shared roof.
    const dwellingSlots = Math.max(1, budget - specials.length - interiorPlaces.length);
    const householdGroups = [];
    for (const [index, household] of households.entries()) {
      const slot = index < dwellingSlots ? index : dwellingSlots - 1;
      (householdGroups[slot] ??= []).push(household);
    }

    // Row-placed buildings in the upper and lower thirds, straddling the plaza.
    const buildings = [];
    const slots = [];
    const rowYs = [Math.max(4, midY - 9), Math.min(v.h - 8, midY + 4)];
    for (const rowY of rowYs) {
      for (let x = 4; x + 8 < v.w - 4 && slots.length < budget + interiorPlaces.length; x += 9) {
        if (Math.abs(x + 3 - midX) < 4) continue; // keep the vertical road clear
        slots.push({ x, y: rowY });
      }
    }
    let slotIndex = 0;
    const takeSlot = () => slots[slotIndex++] ?? null;
    for (const place of interiorPlaces) {
      const slot = takeSlot();
      if (!slot) break;
      const width = place.kind === "hall" ? 8 : 7;
      const b = building(v, slot.x, slot.y, width, 5, 3, [1, 5]);
      buildings.push({ door: b, rect: { x: slot.x, y: slot.y, w: width, h: 5 }, boundPlace: place });
    }
    for (const { special, owner } of specials) {
      // A special whose interior already exists as a place shares that facade.
      const bound = buildings.find((b) => b.boundPlace && interiorKindForSpecial(special) === b.boundPlace.kind);
      if (bound) {
        bound.owner = owner;
        continue;
      }
      const slot = takeSlot();
      if (!slot) break;
      const b = building(v, slot.x, slot.y, 6, 4, 2, [4]);
      buildings.push({ door: b, rect: { x: slot.x, y: slot.y, w: 6, h: 4 }, special, owner });
    }
    for (const group of householdGroups) {
      const slot = takeSlot();
      if (!slot) break;
      const width = Math.min(8, 5 + group.length); // merged blocks read larger
      const b = building(v, slot.x, slot.y, width, 4, 2, [1]);
      buildings.push({ door: b, rect: { x: slot.x, y: slot.y, w: width, h: 4 }, households: group });
    }

    // ── Transient merchants set up a light market stall in a free lot (never a
    // permanent shop). They tend it; with no free lot they fall back to the
    // public rest spot in the cast loop. Other non-resident kinds build nothing.
    const stalls = [];
    for (const member of brief.cast) {
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
      .map((b) => ({ x: b.rect.x - 1, y: b.rect.y - 3, w: b.rect.w + 2, h: b.rect.h + 5 }))
      .concat(stalls.map((s) => ({ x: s.x - 1, y: s.y - 1, w: 7, h: 5 })));
    const intersects = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const featureAnchors = [
      { x: 4, y: 3 },
      { x: v.w - 12, y: 3 },
      { x: v.w - 12, y: v.h - 8 },
      { x: 4, y: v.h - 8 },
    ];
    const FEATURE_RECT = { w: 9, h: 6 };
    for (const feature of brief.features) {
      const anchor = featureAnchors.find((candidate) => {
        const rect = { x: candidate.x, y: candidate.y, ...FEATURE_RECT };
        return !claimed.some((busy) => intersects(rect, busy));
      });
      if (!anchor) continue; // dropped, not misplaced
      PLACERS[feature.tag]?.(v, anchor.x, anchor.y);
      claimed.push({ x: anchor.x, y: anchor.y, ...FEATURE_RECT });
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
    scatterTrees(
      v,
      rnd,
      { woods: 26, fields: 8, rocky: 10, water: 12, barren: 5 }[brief.surround] ?? 12,
      doorRects.concat(
        doorRects.map((d) => ({ x: d.x, y: d.y + 1 })),
        stallReserved,
        shopFrontReserved,
      ),
    );
    zones.z1 = v;

    // ── Interior zones ──
    for (const place of interiorPlaces) {
      const id = zoneIdForPlace(place);
      if (!id) continue;
      // An interior only exists if it claimed a facade: its door IS the portal.
      // The facade loop above stops when the building lots run dry (a small
      // outpost has fewer lots than CAPS.places allows), and compiling the zone
      // anyway produced a named, NPC-populated room with no door in either
      // direction — anyone homed there was stranded and un-talkable forever.
      // Same policy as an unanchorable feature: dropped, never sealed.
      if (!buildings.some((b) => b.boundPlace === place)) continue;
      const [w, h] = INTERIOR_DIMS[place.kind] || INTERIOR_DIMS.dwelling;
      const zone = makeZone(id, place.name, w, h, "floor");
      for (let x = 0; x < w; x++) {
        put(zone, x, 0, "object", "wallStone", true);
        put(zone, x, 1, "object", "wall", true);
        put(zone, x, h - 1, "object", "wallStone", true);
      }
      for (let y = 0; y < h; y++) {
        put(zone, 0, y, "object", "wallStone", true);
        put(zone, w - 1, y, "object", "wallStone", true);
      }
      if (place.kind === "gathering") {
        fillRect(zone, 3, 3, 5, 1, "object", "counter", true);
        put(zone, w - 6, 5, "object", "table", true);
        put(zone, w - 4, h - 4, "object", "table", true);
        fillRect(zone, 5, 6, 4, 3, "ground", "rug", false);
        zone.lights.push({ x: 4, y: 3 }, { x: w - 5, y: 5 });
      } else if (place.kind === "hall") {
        // Rug first: its ground fill clears solidity, so painting it after the
        // table silently made the table walk-through (review finding).
        fillRect(zone, 3, 3, w - 6, h - 6, "ground", "rug", false);
        fillRect(zone, 4, 5, w - 8, 1, "object", "table", true);
        zone.lights.push({ x: 3, y: 2 }, { x: w - 4, y: 2 });
      } else if (place.kind === "workshop") {
        fillRect(zone, 3, 3, 4, 1, "object", "counter", true);
        put(zone, w - 4, 5, "object", "table", true);
        zone.lights.push({ x: 3, y: 3 });
      } else {
        put(zone, 3, 4, "object", "table", true);
        fillRect(zone, 5, 5, 3, 2, "ground", "rug", false);
        zone.lights.push({ x: 3, y: 3 });
      }
      const doorX = (w / 2) | 0;
      put(zone, doorX, h - 1, "object", "door", false);
      zone.spawn = { x: doorX, y: h - 2 };
      zone.flavor = place.flavor;
      zone.mapKind = "building"; // World Maps export kind (spec §8)
      zones[id] = zone;
      const facade = buildings.find((b) => b.boundPlace === place);
      if (facade) {
        v.portals.push({
          x: facade.door.doorX,
          y: facade.door.doorY,
          toZone: id,
          toX: zone.spawn.x,
          toY: zone.spawn.y,
          label: `Enter ${place.name}`,
        });
        zone.portals.push({
          x: doorX,
          y: h - 1,
          toZone: "z1",
          toX: facade.door.doorX,
          toY: facade.door.doorY + 1,
          label: "Step outside",
        });
      }
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
      }
      let anchorX = 26;
      for (const feature of place.features ?? []) {
        if (feature.tag === "water-crossing") continue;
        PLACERS[feature.tag]?.(zone, anchorX, 8 + (((anchorX / 3) | 0) % 4));
        anchorX = Math.max(6, (anchorX + 9) % (zone.w - 10));
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
      zone.spawn = { x: 3, y: wMidY };
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
      if (!east) zone.spawn = { x: zone.w - 4, y: wMidY };
      zone.flavor = place.flavor;
      zone.mapKind = "place"; // World Maps export kind (spec §8)
      zones[id] = zone;
    });

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
    const fullZoneBox = (z) => ({ x0: 2, y0: 2, x1: z.w - 3, y1: z.h - 3 });
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
    const walkableSpawn = (zone, wander, key) => {
      let cx = ((wander.x0 + wander.x1) / 2) | 0;
      let cy = ((wander.y0 + wander.y1) / 2) | 0;
      if (key) {
        const hash = PF.hashStr(String(key));
        cx = wander.x0 + (hash % (wander.x1 - wander.x0 + 1));
        cy = wander.y0 + (((hash / 7) | 0) % (wander.y1 - wander.y0 + 1));
      }
      // Same rule as the runtime placer: never a door or portal tile, which are
      // walkable by design and look wrong (and block the way in) when occupied.
      const open = (x, y) => PF.schedule.standable(zone, x, y);
      if (open(cx, cy)) return { x: cx, y: cy };
      const maxR = wander.x1 - wander.x0 + (wander.y1 - wander.y0);
      for (let r = 1; r <= maxR; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const x = cx + dx;
            const y = cy + dy;
            if (x >= wander.x0 && x <= wander.x1 && y >= wander.y0 && y <= wander.y1 && open(x, y)) return { x, y };
          }
        }
      }
      return { x: zone.spawn.x, y: zone.spawn.y };
    };
    // A door apron box: the strip an NPC mills around in front of its building.
    const doorBox = (door, reach, depth) => ({
      x0: Math.max(2, door.doorX - reach),
      y0: Math.max(2, door.doorY),
      x1: Math.min(v.w - 3, door.doorX + reach),
      y1: Math.min(v.h - 3, door.doorY + depth),
    });
    brief.cast.forEach((member, index) => {
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
      if (standing === "resident") {
        // Wander near the owner's building when they have one, else around the
        // zone's spawn; interiors wander their walkable middle.
        const owned = buildings.find((b) => b.owner === member || (b.households ?? []).includes(member.household));
        const dwelling = buildings.find((b) => (b.households ?? []).includes(member.household));
        if (zone === v && owned) {
          wander = {
            x0: Math.max(2, owned.door.doorX - 4),
            y0: Math.max(2, owned.door.doorY),
            x1: Math.min(v.w - 3, owned.door.doorX + 4),
            y1: Math.min(v.h - 3, owned.door.doorY + 5),
          };
          // A special-building owner sleeps at their dwelling, not the workshop.
          // Dwellings have no interiors, so "turned in for the night" reads as
          // hugging their own door rather than roaming the apron — but keep it
          // wide enough for a whole household to stand at it without stacking.
          const bed = dwelling && dwelling !== owned ? dwelling : owned;
          home = { zoneId: v.id, wander: doorBox(bed.door, 1, 1) };
        } else if (zone === v) {
          wander = plazaBox();
        } else {
          wander = fullZoneBox(zone);
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
      // Transients bed down at the inn when the settlement has one.
      if (standing === "transient" && gatheringZoneId && zones[gatheringZoneId]) {
        home = { zoneId: gatheringZoneId, wander: fullZoneBox(zones[gatheringZoneId]) };
      }
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
          home,
          public: { zoneId: v.id, wander: plazaBox() },
        },
      });
    });

    return {
      seed,
      theme: activeTheme,
      brieved: true, // marks a compiled world (saves still carry only seed/theme/zone)
      situation: brief.situation,
      zones,
      startZone: "z1",
      bindings: {},
    };
  }

  function interiorKindForSpecial(special) {
    return special === "gathering" ? "gathering" : special === "hall" ? "hall" : special === "shop" ? "workshop" : null;
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
    // The innkeeper never leaves the inn — it is the fixed point the evening
    // crowd converges on, and it means the lit building is never empty.
    "host:resident": { dawn: "post", day: "post", dusk: "post", night: "post" },
    // The watch keeps the night, so the settlement never looks abandoned.
    "guard:resident": { dawn: "home", day: "post", dusk: "post", night: "post" },
    // Trades work their building through the day and sleep at their dwelling.
    "leader:resident": { dawn: "home", day: "post", dusk: "post", night: "home" },
    "grower:resident": { dawn: "home", day: "post", dusk: "post", night: "home" },
    "maker:resident": { dawn: "home", day: "post", dusk: "post", night: "home" },
    "merchant:resident": { dawn: "home", day: "post", dusk: "post", night: "home" },
    // A travelling trader sleeps at the inn and tends the stall by day.
    "merchant:transient": { dawn: "home", day: "post", dusk: "post", night: "home" },
    // Everyone else with a roof: at the door at dawn, the square by day (the
    // plaza should feel busiest in daylight and empty after dark), home at night.
    "*:resident": { dawn: "home", day: "public", dusk: "home", night: "home" },
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
    const template = TABLE[`${sched.kind}:${sched.standing}`] ?? TABLE[`*:${sched.standing}`] ?? DEFAULT;
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
   *  unreachable. A stable per-NPC hash picks each one its own starting tile. */
  function walkableIn(zone, box, key) {
    let cx = ((box.x0 + box.x1) / 2) | 0;
    let cy = ((box.y0 + box.y1) / 2) | 0;
    if (key) {
      const spanX = box.x1 - box.x0 + 1;
      const spanY = box.y1 - box.y0 + 1;
      const hash = PF.hashStr(String(key));
      cx = box.x0 + (hash % spanX);
      cy = box.y0 + (((hash / 7) | 0) % spanY);
    }
    const open = (x, y) => standable(zone, x, y);
    if (open(cx, cy)) return { x: cx, y: cy };
    // Sum, not max: an off-center hashed start still has to be able to reach
    // the far corner of the box.
    const maxR = box.x1 - box.x0 + (box.y1 - box.y0);
    for (let r = 1; r <= maxR; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = cx + dx;
          const y = cy + dy;
          if (x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1 && open(x, y)) return { x, y };
        }
      }
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
    this._npcTimers = new Map();
    this._rnd = PF.rng((world.seed ^ 0x9e3779b9) >>> 0);
    this.dirty = false; // save-worthy change happened
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
    if (!this.world.zones[zoneId]) return;
    this.zoneId = zoneId;
    this.x = (tx + 0.5) * PF.TILE;
    this.y = (ty + 0.5) * PF.TILE;
    this.dirty = true;
  }

  step(dt, input) {
    const z = this.zone();
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
    const starts = { dawn: 5 * 60, day: 7 * 60, dusk: 18 * 60, night: 21 * 60 };
    const at = starts[target];
    if (at === undefined || this.mode !== "walk") return false;
    if (at <= this.clockMin) this.day++;
    this.clockMin = at;
    this._clockAcc = 0;
    this.resolveSchedules();
    return true;
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
    for (const [fromId, npc] of all) {
      if (!npc._sched || npc._hold) continue; // _hold reserves a GM override seam
      const handle = PF.schedule.resolve(npc._sched, this._daypart);
      if (!handle) continue;
      const target = this.world.zones[handle.zoneId];
      if (!target) continue;
      const box = handle.wander;
      if (handle.zoneId === fromId) {
        // In-zone: swap the box, and only snap when the NPC is outside it —
        // overlapping day/night boxes should not pop.
        const inside = npc.x >= box.x0 && npc.x <= box.x1 && npc.y >= box.y0 && npc.y <= box.y1;
        npc.wander = box;
        if (!inside) {
          const at = PF.schedule.walkableIn(target, box, handle.spread === false ? null : npc.id);
          npc.x = at.x;
          npc.y = at.y;
        }
      } else {
        // Cross-zone: the renderer and talk-detection only walk the CURRENT
        // zone's array, so a spliced NPC simply leaves one zone and appears in
        // the other — no visibility flag needed.
        const from = this.world.zones[fromId];
        const index = from.npcs.indexOf(npc);
        if (index >= 0) from.npcs.splice(index, 1);
        target.npcs.push(npc);
        npc.wander = box;
        const at = PF.schedule.walkableIn(target, box);
        npc.x = at.x;
        npc.y = at.y;
      }
      // stepNpcs caches float fx/fy per id; a stale timer would drag the token
      // back toward the old box. Dropping it re-seeds at the new position.
      this._npcTimers.delete(npc.id);
    }
  }

  /** Is another NPC standing on — or already walking onto — this tile? Terrain
   *  alone is not enough: two NPCs would pick the same free tile and slide
   *  through each other. Casts are capped at ~10, so a scan is cheaper than
   *  maintaining an occupancy index. */
  npcOccupies(z, x, y, exclude) {
    for (const other of z.npcs) {
      if (other === exclude) continue;
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
    this._pendingIntro = pending;
    return parts.join(" ");
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

    ctx.drawImage(comp.overhead, camX, camY, viewW, viewH, offX, offY, viewW, viewH);

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
        core.hud?.toast(`Now at: ${this.locationName() ?? loc}`);
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
    try {
      const text = `${core.sim.composePrefix(null)} We travel to ${dest.name}.`;
      const ok = await core.host.sendMessage(text, undefined, transition);
      if (gen !== this._gen || core.chatId !== chatId) return;
      if (ok !== false) core.sim?.commitIntro?.();
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
    const zoneIds = Object.keys(world.zones).filter((zoneId) => zoneId !== world.startZone);
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
PF.save = {
  _timer: 0,
  _lastSerialized: null,
  _flushChain: null,
  /** null until adopt() probes; then "routes" | "metadata". */
  mode: null,
  /** Serialized last-known server-side route state (ours or adopted). */
  _serverSerialized: null,
  _rewindCheckInFlight: false,

  snapshot(core) {
    const sim = core.sim;
    if (!sim) return null;
    return {
      v: 1,
      chatId: core.chatId,
      seed: sim.world.seed,
      theme: sim.world.theme,
      zone: sim.zoneId,
      x: Math.round(sim.x),
      y: Math.round(sim.y),
      facing: sim.facing,
      clockMin: sim.clockMin,
      day: sim.day,
      bindings: sim.world.bindings,
      // §7 one-shot injection flags: persisted so a reload never re-taxes the
      // GM context with prose that already lives in chat history.
      intro: sim.intro ?? { world: false, zones: {}, npcs: {} },
    };
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

  /** Restore a saved state into a freshly built world. Returns the sim. */
  restore(meta, chatId) {
    const saved = meta && typeof meta.pixelforge === "object" && meta.pixelforge !== null ? meta.pixelforge : null;
    return this.simFromSaved(saved, meta, chatId);
  },

  /** The sealed world brief. Primary home: the TOP-LEVEL pixelforgeBrief
   *  metadata key (atomic under the queued shallow-merge PATCH — no
   *  read-modify-write of the whole setup config). The nested config location
   *  remains readable for chats sealed before the key moved. Absent on
   *  pre-0.4.0 games → legacy layout. */
  _configBrief(meta) {
    const top =
      meta && typeof meta.pixelforgeBrief === "object" && meta.pixelforgeBrief !== null ? meta.pixelforgeBrief : null;
    if (top && Array.isArray(top.cast)) return top;
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
      if (candidate && typeof candidate === "object" && Array.isArray(candidate.cast)) return candidate;
    }
    return null;
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

  /** Surface-side world generation (spec §5, amended): fully NON-BLOCKING.
   *  The chat boots on the themed legacy world immediately; the one #5135
   *  call runs behind a toast, the sealed brief stores atomically under
   *  pixelforgeBrief (3 retries), and the world rebuilds on arrival. Runs at
   *  most once per chat: the stored key (sealed brief or a skipped marker) is
   *  the one-shot guard, so old chats and completed chats never re-generate. */
  async maybeGenerateBrief(core) {
    if (!core.chatId || this._generating) return;
    const chatId = core.chatId;
    const meta =
      core.host && typeof core.host.chatMeta === "object" && core.host.chatMeta !== null ? core.host.chatMeta : {};
    if (meta.pixelforgeBrief !== undefined) return;
    if (this._configBrief(meta)) return;
    if (!this._configGenerate(meta)) return;
    this._generating = true;
    try {
      core.hud?.toast("Generating your world — keep exploring meanwhile…");
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
      const sealed = await PF.brief.generate(chatId, { theme, seed, preferences });
      if (!sealed) {
        // Transient failure (busy engine, network, timeout, route absent): do
        // NOT seal — the key stays absent and the next visit tries again. The
        // default world stays fully playable meanwhile.
        core.hud?.toast("World generation couldn't run — it will retry next visit.");
        return;
      }
      let stored = false;
      for (let attempt = 0; attempt < 3 && !stored; attempt++) {
        try {
          await PF.api.patchMetadata(chatId, { pixelforgeBrief: sealed });
          stored = true;
        } catch (err) {
          if (attempt === 2) console.warn("[pixelforge] brief storage failed; keeping the default world", err);
          else await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
        }
      }
      if (!stored || chatId !== core.chatId) return;
      // Rebuild onto the generated world (the default one has only seconds of
      // play on it). Fresh sim, fresh bindings; spatial re-seeds next turn.
      core.sim = new PF.Sim(PF.world.build(seed, theme, sealed));
      this._lastSerialized = null;
      core.render?.clearZones?.();
      void PF.assets.load(core);
      core.hud?.refreshChips();
      core.hud?.toast("The world takes shape.");
      this.markDirty(core);
    } finally {
      this._generating = false;
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
    const brief = this._configBrief(meta);
    const world = PF.world.build(seed, theme, brief);
    // The pre-brief boot world of a generation-enabled chat is a throwaway
    // that the sealed brief will replace — stamped so the World Maps export
    // (§8) never registers its zones on the user's map. A sealed brief or a
    // {skipped:true} marker makes the world final.
    if (!brief && meta?.pixelforgeBrief === undefined && this._configGenerate(meta)) world.interim = true;
    const sim = new PF.Sim(world);
    if (saved && saved.v === 1) {
      // A saved zone that no longer exists (world gen changed between versions,
      // or an interior that this build no longer compiles) falls back to the
      // start zone — but the saved x/y belonged to the OLD zone, and carrying
      // them over just clamps interior coordinates into a much larger map. The
      // solid-tile rescue below only fires if that lands in a wall, so the
      // player would silently reappear in a random corner. Land them at the
      // spawn instead, which is the one tile every zone guarantees is walkable.
      const zoneResolved = typeof saved.zone === "string" && !!world.zones[saved.zone];
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
        sim.intro = {
          world: saved.intro.world === true,
          zones: saved.intro.zones && typeof saved.intro.zones === "object" ? { ...saved.intro.zones } : {},
          npcs: saved.intro.npcs && typeof saved.intro.npcs === "object" ? { ...saved.intro.npcs } : {},
        };
      }
      if (saved.bindings && typeof saved.bindings === "object") {
        for (const [loc, zone] of Object.entries(saved.bindings)) {
          if (typeof zone === "string" && world.zones[zone]) {
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
    return sim;
  },

  /** Self-heal (review finding): ~40 engine call sites still use the unqueued
   *  whole-blob updateMetadata (issue #5076 class), any of which can silently
   *  erase our key between turns. If we have saved state but the incoming
   *  chatMeta lost the key, re-save from the in-memory authority. */
  ensurePresent(core, meta) {
    if (!this._lastSerialized || !core.sim || !core.chatId) return;
    if (meta && typeof meta === "object" && meta.pixelforge == null) {
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
    this._lastSerialized = null;
    this._metaSerialized = null;
    this.mode = null;
    this._serverSerialized = null;
    this._rewindCheckInFlight = false;
  },

  /** Probe the experience-state routes once per chat and pick the mode. In
   *  routes mode the server row is the authority: if it differs from the
   *  metadata-booted sim (e.g. the user swiped or loaded a checkpoint since the
   *  last visit), the world is rebuilt from it; if the server has no row yet,
   *  the current world (which may be a migrated legacy metadata save) is
   *  written up. Any probe failure degrades to metadata mode. */
  async adopt(core) {
    if (!core.chatId || this.mode !== null) return;
    const gen = this._gen ?? 0;
    const chatId = core.chatId;
    try {
      const probe = await PF.api.getExperienceState(chatId);
      // Switched mid-probe: fence on the CAPTURED generation and chat id — a
      // response for the old chat must never rebuild the new one.
      if (gen !== (this._gen ?? 0) || chatId !== core.chatId) return;
      if (!probe.available) {
        this.mode = "metadata";
        return;
      }
      this.mode = "routes";
      const body = probe.body || {};
      if (body.exists && body.state && typeof body.state === "object") {
        this._serverSerialized = JSON.stringify(body.state);
        const current = this.snapshot(core);
        if (current && JSON.stringify(current) !== this._serverSerialized) {
          this._rebuild(core, body.state);
        }
      } else {
        // No server row yet: adopt the in-memory world (implicitly migrating a
        // legacy metadata save into the timeline-anchored store).
        this._lastSerialized = null; // force the write even if metadata matched
        this.markDirty(core);
      }
    } catch (err) {
      this.mode = "metadata";
      console.warn("[pixelforge] experience-state probe failed; using metadata saves", err);
    }
  },

  /** Routes mode, on each finished turn: if the server state moved under us
   *  (swipe, branch, checkpoint load — all rewrite the visible anchor), rebuild
   *  the world from it. Our own writes keep _serverSerialized current, so this
   *  only fires on external timeline changes. */
  async checkRewind(core) {
    if (this.mode !== "routes" || !core.chatId || this._rewindCheckInFlight) return;
    this._rewindCheckInFlight = true;
    const gen = this._gen ?? 0;
    const chatId = core.chatId;
    try {
      const probe = await PF.api.getExperienceState(chatId);
      if (gen !== (this._gen ?? 0) || chatId !== core.chatId) return; // switched mid-probe
      if (!probe.available) return;
      const body = probe.body || {};
      if (!body.exists || !body.state || typeof body.state !== "object") {
        // The timeline rewound PAST the first persisted state: this anchor has
        // no row. Keeping the later local sim would leave the world ahead of
        // the story — fall back to the baseline build (config seed/theme) and
        // let the next save write this anchor's row.
        if (this._serverSerialized !== null) {
          this._serverSerialized = null;
          this._rebuild(core, null);
          core.hud?.toast("The world rewound with the story.");
        }
        return;
      }
      const serverSerialized = JSON.stringify(body.state);
      if (this._serverSerialized !== null && serverSerialized !== this._serverSerialized) {
        this._serverSerialized = serverSerialized;
        this._rebuild(core, body.state);
        core.hud?.toast("The world rewound with the story.");
      } else {
        this._serverSerialized = serverSerialized;
      }
    } catch {
      // Transient; the next turn edge retries.
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
    if (this._timer) return;
    this._timer = setTimeout(() => {
      this._timer = 0;
      void this.flush(core, false);
    }, 2500);
  },

  /** Serialize flushes: a teardown flush and a debounced flush can otherwise
   *  overlap and double-write (the dedupe check reads _lastSerialized, which is
   *  only written after the awaits). */
  flush(core, teardown) {
    this._flushChain = (this._flushChain ?? Promise.resolve()).then(() => this._flushNow(core, teardown));
    return this._flushChain;
  },

  async _flushNow(core, teardown) {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = 0;
    }
    const snap = this.snapshot(core);
    if (!snap || !core.chatId) return;
    const serialized = JSON.stringify(snap);
    // Route persistence and metadata-cache persistence dedupe SEPARATELY: a
    // failed cache write must keep retrying on later flushes even while the
    // route row is already current.
    const metaCurrent = this.mode !== "routes" || this._metaSerialized === serialized;
    if (serialized === this._lastSerialized && metaCurrent) return;
    try {
      if (this.mode === "routes") {
        // Route row first (the authority), metadata second as write-through
        // boot cache + old-engine fallback. A metadata failure is non-fatal
        // once the route write landed — but it stays pending and retries.
        if (serialized !== this._lastSerialized) {
          await PF.api.putExperienceState(core.chatId, snap, teardown);
          this._serverSerialized = serialized;
          this._lastSerialized = serialized;
          if (core.sim) core.sim.dirty = false;
        }
        if (this._metaSerialized !== serialized) {
          try {
            await PF.api.patchMetadata(core.chatId, { pixelforge: snap }, teardown);
            this._metaSerialized = serialized;
          } catch (err) {
            if (!teardown) this.markDirty(core); // schedule a cache repair pass
            console.warn("[pixelforge] metadata cache save failed (route save landed); will retry", err);
          }
        }
        return;
      }
      await PF.api.patchMetadata(core.chatId, { pixelforge: snap }, teardown);
      this._lastSerialized = serialized;
      this._metaSerialized = serialized;
      if (core.sim) core.sim.dirty = false;
    } catch (err) {
      // A failed save retries on the next dirty mark; never interrupts play.
      console.warn("[pixelforge] save failed", err);
    }
  },
};

// ===== 70-hud.js =====
// ── HUD (main mount) ──────────────────────────────────────────────────────────
// Everything interactive lives here, in the z-30 main mount: location/clock
// chips, touch D-pad, Talk / Travel / Keyboard controls, toasts. The root is
// pointer-events:none; each control opts back in — clicks in empty space fall
// through to the narration below (host contract).
// Collapsing the host's narration box is a CSS-only reach OUTSIDE our element,
// which the host sanctions through the manifest's contributions.gameSurface
// .surfaceClass ("pixelforge-surface") stamped on the shared game container,
// plus its inert `experience-dialogue-*` theming hooks. Scope every rule under
// that class so nothing leaks into the rest of the app, and collapse only the
// PROSE — the meta row (Retry, Next, Logs) and the turn input must stay usable.
const PF_NARRATION_STYLE_ID = "pixelforge-narration-collapse";
function installPixelforgeNarrationStyle(doc) {
  if (!doc || doc.getElementById(PF_NARRATION_STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = PF_NARRATION_STYLE_ID;
  // Collapse the WHOLE panel, not just the prose. Hiding the prose alone left
  // the speaker label, the failure banner and the button row floating in an
  // empty box, which is most of the height back. The label and banner carry no
  // hook of their own — only utility classes — so picking them off individually
  // would mean matching styling soup that breaks on any host restyle.
  //
  // Trade-off, deliberate: while collapsed the Retry/Next controls go with it,
  // so a failed generation is invisible until the player expands again. The
  // toggle sits right beside the panel and dialogue force-expands, so nothing
  // is ever unreachable — but this is exactly why the host should own a real
  // collapse control (Marinara-Engine#5209) instead of a package doing CSS.
  //
  // `data-tour` is a product-tour hook rather than a declared contract; it is
  // still far steadier than utility classes, and the theming hooks below are
  // contract, so keep both.
  style.textContent =
    '.pf-narration-collapsed .pixelforge-surface [data-tour="game-dialogue"],' +
    ".pf-narration-collapsed .pixelforge-surface .experience-dialogue-wrap," +
    ".pf-narration-collapsed .pixelforge-surface .game-narration-prose{" +
    "max-height:0;min-height:0;padding-top:0;padding-bottom:0;margin-top:0;margin-bottom:0;" +
    "border-width:0;overflow:hidden;opacity:0;pointer-events:none;}";
  doc.head.appendChild(style);
}

PF.Hud = class {
  constructor(rootEl, core) {
    this.core = core;
    const S = {
      chip:
        "pointer-events:auto;background:rgba(20,24,20,0.82);color:#f3efe2;border:1px solid rgba(243,239,226,0.25);" +
        "border-radius:6px;padding:3px 9px;font:600 11px/1.5 ui-monospace,Consolas,monospace;white-space:nowrap;",
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
    this.locChip = PF.el("span", { style: S.chip, text: "…" });
    this.clockChip = PF.el("span", { style: S.chip, text: "" });
    this.topbar = PF.el(
      "div",
      { style: "position:absolute;top:10px;left:50%;transform:translateX(-50%);display:flex;gap:6px;z-index:2;" },
      [this.locChip, this.clockChip],
    );

    this.talkBtn = this._btn("Talk (E)", () => core.interact());
    this.travelBtn = this._btn("Travel", () => this.toggleTravel());
    this.waitBtn = this._btn("⏩ Wait…", () => this.toggleWait());
    this.narrationBtn = this._btn("▤ Hide narration", () => this.toggleNarration());
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
      [this.talkBtn, this.travelBtn, this.waitMenu, this.waitBtn, this.narrationBtn, this.keyboardBtn, this.resumeBtn],
    );
    this._narrationCollapsed = false;
    installPixelforgeNarrationStyle(rootEl && rootEl.ownerDocument);

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

    this.root = PF.el(
      "div",
      { style: "position:absolute;inset:0;pointer-events:none;font-family:ui-monospace,Consolas,monospace;" },
      [this.topbar, this.actions, this.dpad, this.travelMenu, this.captionEl, this.toastEl],
    );
    rootEl.appendChild(this.root);
    this._toastTimer = 0;
    this._mode = null;
    this.refreshChips();
  }

  _btn(text, onclick) {
    return PF.el("button", { type: "button", style: this.S.btn, text, onclick });
  }

  destroy() {
    clearTimeout(this._toastTimer);
    this.root.remove();
  }

  toast(msg) {
    this.toastEl.textContent = msg;
    this.toastEl.style.opacity = "1";
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.toastEl.style.opacity = "0";
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

  /** Collapse the host's narration box so more of the world is visible. Only
   *  the prose collapses — the button row (Retry, Next, Logs) stays reachable,
   *  and it force-expands in dialogue because the turn input lives in there. */
  toggleNarration(force) {
    const collapsed = typeof force === "boolean" ? force : !this._narrationCollapsed;
    // Only a real click changes what the player WANTS; the dialogue-mode
    // force-open is temporary and must not overwrite that preference.
    if (typeof force !== "boolean") this._narrationPreference = collapsed;
    this._narrationCollapsed = collapsed;
    const root = this.root.ownerDocument.documentElement;
    root.classList.toggle("pf-narration-collapsed", collapsed);
    if (this.narrationBtn) this.narrationBtn.textContent = collapsed ? "▣ Show narration" : "▤ Hide narration";
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
  }

  /** Cheap per-frame sync — writes DOM only on change. */
  update() {
    const sim = this.core.sim;
    if (!sim) return;
    const mode = sim.mode;
    const spatialAvail = PF.spatial.available;
    if (mode !== this._mode || spatialAvail !== this._spatialAvail) {
      this._mode = mode;
      this._spatialAvail = spatialAvail;
      const inWorld = mode === "walk";
      // Replay: the host owns the whole screen. Combat: keep a minimal HUD —
      // the mode is inferred from the narrative gameActiveState, which can flip
      // without any combat UI mounting, so the player must NEVER be left with
      // zero controls (review finding). Resume is the guaranteed exit.
      this.root.style.display = mode === "replay" ? "none" : "";
      this.dpad.style.display = inWorld ? "" : "none";
      this.talkBtn.style.display = inWorld ? "" : "none";
      this.travelBtn.style.display = inWorld && spatialAvail ? "" : "none";
      this.waitBtn.style.display = inWorld ? "" : "none";
      this.narrationBtn.style.display = inWorld ? "" : "none";
      this.keyboardBtn.style.display = inWorld ? "" : "none";
      // In combat, Resume exists only for the NARRATIVE fallback signal (which
      // can flip without any combat UI). With the real Capability API 1.11
      // signal the combat UI owns the screen — no package controls at all.
      const combatResumeApplies = mode === "combat" && !this.core._combatSignalIsReal;
      this.resumeBtn.style.display = mode === "dialogue" || combatResumeApplies ? "" : "none";
      this.resumeBtn.textContent = combatResumeApplies ? "▶ Resume exploring" : "▶ Resume walking";
      this.travelMenu.style.display = "none";
      this.waitMenu.style.display = "none";
      // The turn input lives INSIDE the host's narration box, so a collapsed
      // box would leave a talking player with nowhere to type. Force it open
      // for the conversation and restore the player's choice afterwards.
      if (!inWorld) this.toggleNarration(false);
      else if (this._narrationPreference) this.toggleNarration(true);
      if (mode === "dialogue") this.toast("Type in the message box below — Resume to keep walking");
    }
    // Cutscene caption — writes DOM only when the beat starts or ends.
    const caption = sim.cutscene ? sim.cutscene.text : "";
    if (caption !== this._caption) {
      this._caption = caption;
      if (caption) this.captionEl.textContent = caption;
      this.captionEl.style.opacity = caption ? "1" : "0";
    }
    if (this._mode === "walk") {
      const canTalk = !!sim.nearNpc;
      if (canTalk !== this._canTalk) {
        this._canTalk = canTalk;
        this.talkBtn.style.opacity = canTalk ? "1" : "0.45";
        this.talkBtn.textContent = canTalk ? `Talk to ${sim.nearNpc.name} (E)` : "Talk (E)";
      }
      const clock = sim.clockLabel();
      if (clock !== this._clock) {
        this._clock = clock;
        this.refreshChips();
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
// stamps `generate: true` into the experience config; the surface picks it up
// after launch (PF.save.maybeGenerateBrief) so the whole 90s window runs
// behind a playable world instead of a torn-down setup UI.

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
    text: "Begin in Hearthvale",
  });
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
      experienceConfig: { seed, theme: themeSel.value, generate: true },
    };
    launchBtn.disabled = true;
    cancelBtn.disabled = true; // mirror the host's mid-launch freeze
    launchBtn.textContent = "Setting up…";
    try {
      const chatId = await el._pfProps.onLaunch(setupConfig, nameIn.value.trim() || preset.name, undefined, {
        gmConnectionId,
      });
      if (typeof chatId === "string") {
        // Seed the world state so the first surface load is deterministic. The
        // default themed world only — generation runs surface-side after
        // launch and rebuilds the world when the brief lands.
        const world = PF.world.build(seed, themeSel.value);
        const sim = new PF.Sim(world);
        const snap = PF.save.snapshot({ sim, chatId });
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await PF.api.patchMetadata(chatId, { pixelforge: snap }, false);
            break;
          } catch (err) {
            if (attempt === 2) console.warn("[pixelforge] world seeding failed; restore will use the config seed", err);
            else await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          }
        }
      }
    } catch (err) {
      errEl.textContent =
        err && err.message ? String(err.message) : "Launch failed — check the connection and try again.";
      errEl.style.display = "block";
      launchBtn.disabled = false;
      cancelBtn.disabled = false;
      cancelBtn.textContent = "Cancel";
      launchBtn.textContent = `Begin in ${nameIn.value.trim() || preset.name}`;
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
      // so the rebuild is seamless.
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
    if (this.chatId) void PF.save.flush(this, false);
    PF.spatial.reset();
    PF.save.reset();
    this.chatId = p.chatId;
    // Synchronous boot from the metadata cache (instant world), then adopt()
    // probes the experience-state routes (#5102) and, when available, promotes
    // the timeline-anchored server row to authority — rebuilding if it differs.
    this.sim = PF.save.restore(p.chatMeta ?? {}, p.chatId);
    this.host = p;
    void PF.save.adopt(this);
    // 0.4.0 chats without a sealed brief generate one here, non-blocking: the
    // default world is playable immediately and rebuilds when the brief lands.
    void PF.save.maybeGenerateBrief(this);
    // New chat, new world: drop every cached zone composite — the cache is
    // keyed by zone id alone, so a stale entry would show the previous game.
    this.render?.clearZones();
    this._resumeMode = "walk";
    this._combatOverride = false;
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
        providesPlayerInput: this.sim.mode === "walk",
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
  interact() {
    const sim = this.sim;
    if (!sim || sim.mode !== "walk" || !sim.nearNpc) return;
    if (!this.host?.sendMessage) return;
    if (this.host.isStreaming) {
      this.hud?.toast("The story is still being written…");
      return;
    }
    const npc = sim.nearNpc;
    this.setMode("dialogue");
    this.hud?.toast(`Talking to ${npc.name}`);
    void Promise.resolve(
      this.host.sendMessage(`${sim.composePrefix(npc)} I walk up to ${npc.name} the ${npc.role} and greet them.`),
    )
      .then((ok) => {
        if (ok === false) {
          this.setMode("walk");
          this.hud?.toast("The story isn't accepting turns right now.");
        } else {
          sim.commitIntro();
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
      window.addEventListener("pagehide", () => void PF.save.flush(PF.core, true));
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
          this.hud?.toast(sim.zone().name);
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
