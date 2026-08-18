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
      // Rooms PARTITIONED inside this zone — wall runs with a door, never zones
      // of their own. Zone count is the flagged cost of the release and every
      // zone holds two full-size canvases in the render cache, so a bedroom is
      // walls and a FLOOR is a zone. {purpose, x0, y0, x1, y1, doorX, ...}
      rooms: [],
      beds: [], // sleeping tiles this zone offers, in claim order
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
      if (x1 > area.x1) break; // the caller sized the list; this is the floor under it
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
      const furnished = ROOM_FURNISH[room.purpose]?.(zone, rect, room) ?? {};
      placed.push({ purpose: room.purpose, ...(room.private ? { private: true } : {}), ...rect, doorX, ...furnished });
      x = x1 + 2;
    }
    return placed;
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
    // reserve caps the wing at two rooms — eight bunked, above CAPS.household —
    // and anything past that falls to the open plan, which walls nothing.
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
  const GUEST_BERTHS = { outpost: 4, hamlet: 5, village: 6, town: 9 };
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
   *  and nine is past CAPS.household, so no single household can reach it. Only
   *  the compiler's own over-subscription merge does, and a roof carrying two or
   *  three whole households IS a bunkhouse. Which is the point: the open plan has
   *  to mean an orphanage, a barracks or a doss-house, never a big family. */
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
    // (No band is wide enough to grow into here: a household is capped at six, and
    // six — the owner plus five — fits every wing the compiler builds. This is the
    // path for a place several households are homed at, where it is a fallback and
    // not a silent drop.)
    if (priv && (rest > count * holds || (rest > 0 && count < 1)))
      return layoutSleeping(zone, w, h, kind, sleepers, top, false);
    if (!priv && (count < 1 || sleepers > count * holds)) return dormitory(zone, w, h, sleepers, top);
    const rooms = partitionRooms(
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
      // Behind BEDROOM DOORS, bunked once a room has to take more than two — a
      // household at CAPS.household is a big family and keeps its walls, and the
      // open plan is reserved for the roofs that are genuinely institutional.
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
      put(z, 2, h - 3, "object", "table", true);
      fillRect(z, w - 6, h - 4, 3, 2, "ground", "rug", false);
      z.lights.push({ x: 2, y: h - 3 });
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

  function interiorRoom(id, name, kind, options) {
    const [w, baseH] = INTERIOR_DIMS[kind] || INTERIOR_DIMS.dwelling;
    const opts = options || {};
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

  /** Where a live-work owner WORKS inside their own building, keyed by special.
   *  Only a shop has a station to be manned — the row between the stock and the
   *  counter — so it is the only entry: a farmer works the land and comes back
   *  in, and everyone else keeps the door apron they have always used. */
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
          brief.cast
            .filter(
              (m) => (m.standing ?? "resident") === "resident" && (m.home === brief.name || strandedFrom(m, built)),
            )
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
    // How many lots the row placer bothers to lay out. It is a ceiling and never
    // the binding one — the map's own width runs out first at every scale — so
    // the arithmetic below counts the lots that actually exist, not this.
    const budget = scale.buildings;

    // Row-placed buildings in the upper and lower thirds, straddling the plaza.
    // Laid BEFORE the arithmetic below, because the lots are the arithmetic's
    // input: `scale.buildings` only caps how many the placer bothers to lay, and
    // the map's own width is what actually decides (two on an outpost or a
    // hamlet, six in a village, eight in a town — all well under the budget).
    // Sizing the dwellings off the budget instead was half of the housing bug:
    // the sum promised slots the ground did not have, so `Math.max(1, …)` handed
    // out a dwelling slot that no lot ever backed.
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
    for (const [index, household] of dwellingHouseholds.entries()) {
      const slot = index < dwellingSlots ? index : dwellingSlots - 1;
      (householdGroups[slot] ??= []).push(household);
    }
    // Head-room over a lot. A tall building grows UPWARD so its door stays on the
    // row the rest of the lot geometry expects — the apron, the portal's outside
    // tile and the owner's wander box are all measured from the door. Upward it
    // stops two rows short of the border ring (whose canopies are overhead too, and
    // a roof would erase them) in the top row, and clear of the crossroad in the
    // bottom one: a roofed road reads as a tunnel. An outpost's rows sit tight
    // against both, so there the clamp is simply zero and the facade carries it.
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
    for (const { special, owner, boundPlace, household } of specialsBuilt) {
      // A special whose interior already exists as a place shares that facade.
      if (boundPlace) {
        const bound = buildings.find((b) => b.boundPlace === boundPlace);
        if (bound) bound.owner = owner;
        continue;
      }
      const slot = takeSlot();
      if (!slot) break;
      const b = building(v, slot.x, slot.y, 6, 4, 2, [4]);
      buildings.push({
        door: b,
        rect: { x: slot.x, y: slot.y, w: 6, h: 4 },
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
      const residents = brief.cast.filter(
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
      const residents = brief.cast.filter(
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
      const id = b.special ? `s${brief.cast.indexOf(b.owner) + 1}` : `h${Math.min(...b.households)}`;
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
    // The walkable middle of a zone — but only the COMMON half of one that has
    // rooms partitioned into it. A private room is somewhere an NPC is SENT (a
    // bed, at night), never somewhere they drift: standable() rules out door
    // tiles, so anyone who wandered into a bedroom could not walk back out of it
    // and would hold the room until the next daypart moved them.
    const fullZoneBox = (z) => ({
      x0: 2,
      y0: z.rooms.reduce((floor, room) => Math.max(floor, room.y1 + 2), 2),
      x1: z.w - 3,
      y1: z.h - 3,
    });
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
        // The building they RUN first, and only then the roof they live under —
        // a live-work premises now carries its owner's household, so a plain
        // membership test would hand a second trade in the same family the first
        // one's building to work in.
        const owned =
          buildings.find((b) => b.owner === member) ??
          buildings.find((b) => (b.households ?? []).includes(member.household));
        keeper = !!(owned && owned.boundPlace && PLACE_BOUND_SPECIALS.has(owned.boundPlace.kind));
        const dwelling = buildings.find((b) => (b.households ?? []).includes(member.household));
        const ownBed = bedFor.get(member);
        if (zone === v && owned) {
          if (owned.owner === member && owned.interior?.post && zones[owned.interior.zoneId]) {
            // A shopkeeper works INSIDE the shop now that there is a shop to be
            // inside. An owner loitering on the apron with a stocked room behind
            // them is the same "nobody is where they are scheduled to be" gap the
            // dwellings had. Scoped to the OWNER: the shop is their household's
            // home too now, and a smith's child does not man the counter.
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
