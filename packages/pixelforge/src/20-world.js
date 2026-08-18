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
      // World Maps export gate (spec §8). A building is ONE location and its
      // floors are rooms inside it, so a zone that is a room stamps this false
      // and never claims a map row. The locations route is additive with no
      // delete — a row written to a player's real map is permanent — so the
      // gate has to ship with the zone type, never a release later.
      mapExport: true,
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

  /** A simple gabled building: stone footprint, plaster walls, roof overhead, one door.
   *
   *  `options.facade` (0 = every existing call site) leaves the top N body rows
   *  UNROOFED. Every body row is already solid wall — it was just permanently hidden
   *  under roof overhead, so a building's height read as roofline and nothing else.
   *  Exposing rows turns that height into visible stonework, which is what makes a
   *  church or a keep stand over the houses beside it, and it costs no extra footprint.
   *  `options.facadeWindows` lights the topmost exposed row, so the storey reads as a
   *  storey rather than a blank slab. */
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
      for (let y = y0; y < wallY; y++) put(z, x, y, "object", "wallStone", true);
      for (let y = y0 - 2; y < y0; y++) put(z, x, y, "overhead", y === y0 - 2 ? "roof" : "roofEdge");
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
    elder: "sanctuary",
  };
  // A sanctuary is never minted on demand — it is the church the brief NAMED, and
  // a nameless one would be an extra house with a spire. So an elder in a
  // church-less settlement claims no lot and no dwelling slot, which is also what
  // keeps every brief sealed before 0.8.0 compiling to the same tiles.
  const PLACE_BOUND_SPECIALS = new Set(["sanctuary"]);
  const INTERIOR_DIMS = {
    gathering: [16, 12],
    workshop: [16, 12],
    hall: [18, 12],
    sanctuary: [16, 14], // the nave needs length: the aisle is the walk to the altar
    shop: [14, 10],
    dwelling: [14, 10],
  };
  // The sleeping wall: bed tiles run along the rows FARTHEST from the door, two
  // apart so a household reads as a bedroom rather than a barracks, and they fill
  // one row before starting the next. A room is only asked for as many beds as it
  // has sleepers, so the second row exists only for a merged household.
  const BED_ROWS = [2, 4];
  function bedSlots(w, h, count) {
    const slots = [];
    for (const y of BED_ROWS) {
      if (y > h - 3 || slots.length >= count) break;
      for (let x = 2; x <= w - 2 && slots.length < count; x += 2) slots.push({ x, y });
    }
    return slots;
  }
  // The inn's guest corner. Transients already bedded down at the inn, but at a
  // shared box covering the whole common room, so "took a bed" rendered as
  // standing among the tables. Four is the corner the 16x12 gathering has room
  // for; a fifth transient keeps the old shared box (see the cast loop).
  const innBeds = (w) => [
    { x: w - 5, y: 2 },
    { x: w - 3, y: 2 },
    { x: w - 5, y: 4 },
    { x: w - 3, y: 4 },
  ];

  // ── Interior rooms ──────────────────────────────────────────────────────────
  // Every interior is the same shell — four walls, one door centered on the south
  // wall, the spawn on the tile inside it — so the portal wiring, the spawn and
  // the map gate are written once and a new kind only says what furniture goes
  // in. FURNISH is keyed by the brief's own place-kind vocabulary plus the kinds
  // the compiler mints itself (shop); an unknown kind furnishes as a plain room.
  const FURNISH = {
    gathering(z, w, h) {
      fillRect(z, 3, 3, 5, 1, "object", "counter", true);
      put(z, w - 6, 5, "object", "table", true);
      put(z, w - 4, h - 4, "object", "table", true);
      fillRect(z, 5, 6, 4, 3, "ground", "rug", false);
      for (const bed of innBeds(w)) put(z, bed.x, bed.y, "object", "bed", false);
      z.lights.push({ x: 4, y: 3 }, { x: w - 5, y: 5 });
    },
    hall(z, w, h) {
      // Rug first: its ground fill clears solidity, so painting it after the
      // table silently made the table walk-through (review finding).
      fillRect(z, 3, 3, w - 6, h - 6, "ground", "rug", false);
      fillRect(z, 4, 5, w - 8, 1, "object", "table", true);
      z.lights.push({ x: 3, y: 2 }, { x: w - 4, y: 2 });
    },
    sanctuary(z, w, h) {
      // A nave the player walks the length of: a carpet aisle from the door to
      // the altar, benches in rows either side, candle plinths flanking the
      // altar. Aisle first — the hall's lesson: a ground fill clears solidity,
      // so painting it after the altar would make the altar walk-through.
      const aisleX = (w / 2) | 0;
      fillRect(z, aisleX, 3, 1, h - 4, "ground", "rug", false);
      fillRect(z, aisleX - 2, 3, 5, 1, "object", "altar", true);
      for (const candleX of [aisleX - 3, aisleX + 3]) {
        put(z, candleX, 3, "object", "wallStone", true);
        z.lights.push({ x: candleX, y: 3 });
      }
      for (let row = 6; row < h - 2; row += 2) {
        fillRect(z, 3, row, aisleX - 3, 1, "object", "counter", true);
        fillRect(z, aisleX + 1, row, aisleX - 3, 1, "object", "counter", true);
      }
      put(z, 2, 1, "object", "window", true);
      put(z, w - 3, 1, "object", "window", true);
      z.lights.push({ x: 2, y: 1 }, { x: w - 3, y: 1 });
    },
    workshop(z, w) {
      fillRect(z, 3, 3, 4, 1, "object", "counter", true);
      put(z, w - 4, 5, "object", "table", true);
      z.lights.push({ x: 3, y: 3 });
    },
    shop(z, w, h) {
      // Never a bare room with a door on it: a counter to be served over and a
      // wall of stock behind it. An empty shop reads worse than a locked one
      // (maintainer call), and the owner's `post` handle moves in here, so it is
      // staffed as well as stocked. The counter run stops short of the east wall
      // so the player can walk around its end — an unreachable pocket behind the
      // counter would strand the shopkeeper the room exists to show.
      for (let x = 2; x <= w - 3; x += 2) put(z, x, 2, "object", "shelf", true);
      fillRect(z, 3, 4, w - 7, 1, "object", "counter", true);
      fillRect(z, 3, h - 3, 3, 2, "ground", "rug", false);
      z.lights.push({ x: 3, y: 4 }, { x: w - 3, y: 2 });
    },
    dwelling(z, w, h, options) {
      // The beds ARE the feature: one per resident, 1x1 and non-solid, so a night
      // visit finds the household asleep in them instead of milling on a doorstep.
      for (const bed of options.beds ?? []) put(z, bed.x, bed.y, "object", "bed", false);
      // A living half under the sleeping wall, so the room is not only a dormitory
      // — and so a dwelling with no sleepers of its own is still a furnished room.
      put(z, 2, h - 3, "object", "table", true);
      fillRect(z, w - 6, h - 4, 3, 2, "ground", "rug", false);
      z.lights.push({ x: 2, y: h - 3 });
    },
  };

  function interiorRoom(id, name, kind, options) {
    const [w, h] = INTERIOR_DIMS[kind] || INTERIOR_DIMS.dwelling;
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
    (FURNISH[kind] || FURNISH.dwelling)(zone, w, h, options || {});
    const doorX = (w / 2) | 0;
    put(zone, doorX, h - 1, "object", "door", false);
    zone.spawn = { x: doorX, y: h - 2 };
    zone.mapKind = "building"; // World Maps export kind (spec §8)
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
      if (!special || seenSpecial.has(special)) continue;
      if (PLACE_BOUND_SPECIALS.has(special) && !brief.places.some((place) => place.kind === special)) continue;
      seenSpecial.add(special);
      specials.push({ special, owner: member });
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
    // Head-room over a lot. A tall building grows UPWARD so its door stays on the
    // row the rest of the lot geometry expects — the apron, the portal's outside
    // tile and the owner's wander box are all measured from the door. Upward it
    // stops two rows short of the border ring (whose canopies are overhead too, and
    // a roof would erase them) in the top row, and clear of the crossroad in the
    // bottom one: a roofed road reads as a tunnel. An outpost's rows sit tight
    // against both, so there the clamp is simply zero and the facade carries it.
    const headroom = (slotY) => Math.max(0, slotY - (slotY > midY ? midY + 3 : 4));
    for (const place of interiorPlaces) {
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
    for (const { special, owner } of specials) {
      // A special whose interior already exists as a place shares that facade.
      const bound = buildings.find((b) => b.boundPlace && interiorKindForSpecial(special) === b.boundPlace.kind);
      if (bound) {
        bound.owner = owner;
        continue;
      }
      // The place exists but never claimed a lot, so there is nothing to keep:
      // a place-bound special has no facade of its own to fall back on.
      if (PLACE_BOUND_SPECIALS.has(special)) continue;
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
      const facade = buildings.find((b) => b.boundPlace === place);
      if (!facade) continue;
      const zone = interiorRoom(id, place.name, place.kind);
      zone.flavor = place.flavor;
      zones[id] = zone;
      linkInterior(v, zone, facade.door, `Enter ${place.name}`);
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

    // ── Dwelling and shop interiors ──
    // Until now a dwelling was a facade with nothing behind it, so a resident the
    // schedule sent home at night had nowhere to BE and "turned in" rendered as
    // hugging their own doorstep. Every dwelling and every shop now opens, on the
    // building's existing door, and each resident gets a bed of their own inside.
    //
    // Neither claims a World Maps row (spec §8): a building is ONE location and
    // these are rooms inside one, not destinations. Only a NAMED brief place is a
    // destination — and the locations route is additive with NO delete, so a row
    // written to a player's real map is permanent and the gate has to be right
    // the first time.
    const bedFor = new Map(); // cast member -> {zoneId, x, y}, their own bed tile
    for (const b of buildings) {
      if (b.households) {
        // Everyone sleeping under this roof, in cast order — the same predicate
        // `households` was derived from, so the room's beds and the dwelling
        // arithmetic can never disagree about who lives here.
        const residents = brief.cast.filter(
          (m) =>
            (m.standing ?? "resident") === "resident" && m.home === brief.name && b.households.includes(m.household),
        );
        // Keyed on the LOWEST household number under this roof: sealed brief data,
        // so the id is stable across rebuilds and additive against saved zone ids
        // (60-save restores a zone by id). A loop counter would move the moment a
        // household merged differently.
        const id = `h${Math.min(...b.households)}`;
        const beds = bedSlots(INTERIOR_DIMS.dwelling[0], INTERIOR_DIMS.dwelling[1], residents.length);
        const zone = interiorRoom(id, `${residents[0]?.name ?? brief.name}'s home`, "dwelling", { beds });
        zone.mapExport = false;
        zones[id] = zone;
        linkInterior(v, zone, b.door, "Go inside");
        b.interior = { zoneId: id };
        // One bed each — never a shared tile: two sprites on one tile makes the
        // lower one un-talkable, which is precisely what a bedroom would cause.
        residents.forEach((member, index) => {
          const bed = beds[index];
          if (bed) bedFor.set(member, { zoneId: id, x: bed.x, y: bed.y });
        });
      } else if (b.special === "shop" && b.owner) {
        // Keyed on the owner's cast ordinal — the same number their NPC id carries.
        const id = `s${brief.cast.indexOf(b.owner) + 1}`;
        const [sw] = INTERIOR_DIMS.shop;
        const zone = interiorRoom(id, `${b.owner.name}'s shop`, "shop");
        zone.mapExport = false;
        zones[id] = zone;
        linkInterior(v, zone, b.door, "Go inside");
        // Behind the counter, between it and the stock: the one row that reads as
        // manning a shop rather than browsing it.
        b.interior = { zoneId: id, post: { x0: 3, y0: 3, x1: sw - 5, y1: 3 } };
      }
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
    // The inn's guest beds, claimed in cast order as transients are placed.
    const guestBeds = gatheringZoneId && zones[gatheringZoneId] ? innBeds(zones[gatheringZoneId].w) : [];
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
      // Holds a building the brief NAMED (a sanctuary today). It unlocks the keeper
      // schedule tier, so the same cast kind keeps its ordinary habits without one.
      let keeper = false;
      if (standing === "resident") {
        // Wander near the owner's building when they have one, else around the
        // zone's spawn; interiors wander their walkable middle.
        const owned = buildings.find((b) => b.owner === member || (b.households ?? []).includes(member.household));
        keeper = !!(owned && owned.boundPlace && PLACE_BOUND_SPECIALS.has(owned.boundPlace.kind));
        const dwelling = buildings.find((b) => (b.households ?? []).includes(member.household));
        const ownBed = bedFor.get(member);
        if (zone === v && owned) {
          if (owned.interior?.post && zones[owned.interior.zoneId]) {
            // A shopkeeper works INSIDE the shop now that there is a shop to be
            // inside. An owner loitering on the apron with a stocked room behind
            // them is the same "nobody is where they are scheduled to be" gap the
            // dwellings had, and it is the room's only occupant.
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
          // A special-building owner sleeps at their dwelling, not the workshop.
          // Their own bed when the household has a room with one in it; the old
          // door-apron box only where there is no bed to point at (a special
          // owner whose household never claimed a dwelling slot) — kept wide
          // enough for a whole household to stand at it without stacking.
          const roof = dwelling && dwelling !== owned ? dwelling : owned;
          home = ownBed
            ? { zoneId: ownBed.zoneId, wander: bedBox(ownBed), spread: false }
            : { zoneId: v.id, wander: doorBox(roof.door, 1, 1) };
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
      // Transients bed down at the inn when the settlement has one — in one of
      // its guest beds, handed out in cast order. Past the fourth they share the
      // common-room box as they always did: a fifth bed would have to go
      // somewhere the 16x12 gathering does not have, and standing in a busy inn
      // is a fair reading of "no room left".
      if (standing === "transient" && gatheringZoneId && zones[gatheringZoneId]) {
        const guest = guestBeds.shift();
        home = {
          zoneId: gatheringZoneId,
          wander: guest ? bedBox(guest) : fullZoneBox(zones[gatheringZoneId]),
          spread: !guest,
        };
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
          keeper,
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
    if (special === "gathering") return "gathering";
    if (special === "hall") return "hall";
    if (special === "sanctuary") return "sanctuary";
    if (special === "shop") return "workshop";
    return null;
  }

  return { build, idx };
})();
