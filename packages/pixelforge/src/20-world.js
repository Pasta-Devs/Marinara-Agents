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
