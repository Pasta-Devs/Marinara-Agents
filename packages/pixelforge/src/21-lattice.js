// ── The wilderness lattice ────────────────────────────────────────────────────
// What is past the settlement's edge, as a TOTAL FUNCTION over cells rather than
// a set of places somebody built. The settlement stands at cell (0,0); every
// other cell has a definition whether or not a zone for it has ever existed, and
// materializing one is a CACHE FILL, not a decision. Nothing here is saved: a
// chunk is recomputed byte-identically from (seed, theme, axes, surround, cell)
// on every load, exactly like the settlement it hangs off.
//
// THREE RULES HOLD THE WHOLE MODULE UP, and every one of them is a lane:
//
//  1. ONE CELL, ONE STREAM. Every chunk draws from `hash(seed,"wild",cx,cy)` and
//     from nothing else — never the compiler's main stream, never visit order,
//     never another system's side stream. So materializing the cell east of you
//     cannot move a tile in the cell north of you, cannot move a tile in the
//     town, and cannot depend on which one you walked into first.
//  2. GATES ARE ARITHMETIC, NEVER RECORDS. A lattice edge is `zone.gates`, a
//     list of border tiles with a direction, and where it LEADS is computed at
//     step time from the cell the zone stands in. Nothing is ever written into
//     `zone.portals`, so the shipped "every portal's target exists" contract
//     (43 harness sites) needs no relaxation, and there is nothing to dangle
//     when a neighbour is evicted.
//  3. GATES ARE PUNCHED IN TWO PHASES. Positions are computed BEFORE a zone's
//     tree scatter and reserved against it; the paint lands AFTER everything
//     else, and the pocket seal runs after the paint. Both halves are load-
//     bearing and neither is optional — see `reservationsFor` and `punchGates`.
//
// The lattice is COMPILED-WORLDS-ONLY. `buildLegacy` writes no gates, carries no
// cell and gets no wilderness: nobody should be playing on the fallback map, and
// a way out of it is the retry surface's business, not geometry's.
PF.lattice = (() => {
  /** PROVISIONAL — maintainer ruling 2026-09-05: playtest values, expected to
   *  change; one edit here changes code and lanes together.
   *
   *  Every number the wilderness invents lives in this one block, including the
   *  terrain table, because the ruling that approved the smaller calls approved
   *  them FOR PLAYTEST: "don't hardcode any of that as most if not all of that is
   *  likely to be changed later on". A literal chunk width, keep count or
   *  landmark rate anywhere else in this file is a defect by that ruling. The
   *  lanes read these values rather than restating them, so a retune is one edit
   *  and a green suite instead of a hunt. */
  const TUNE = {
    // ── Shape ────────────────────────────────────────────────────────────────
    CHUNK_W: 36, // the shipped wilds literal (20-world's wilds builder)
    CHUNK_H: 24,
    GATE_SPAN: 2, // gate tiles per edge — the shipped wilds portal pair's width
    GATE_APRON: 2, // how deep the cleared, path-laid apron reaches inward
    // The four corridors a chunk reserves against its own scatter meet at a
    // seeded hub inside this band of the zone, so the clearing is not the same
    // plus-sign in every cell. Fractions of the zone's own width/height.
    HUB_BAND: { lo: 0.34, hi: 0.66 },
    // ── Ids ──────────────────────────────────────────────────────────────────
    // Underscores, never dots: World Maps composes `pf.<hash>.<zoneId>` and the
    // harness splits those rows on ".". No chunk ever gets a row (CHUNK_MAP_EXPORT
    // below), but the separator costs nothing and removes the landmine.
    CHUNK_ID_PREFIX: "w",
    CHUNK_MAP_KIND: "wild", // deliberately not "settlement": the pocket sweep skips those
    /** THE ONE ENTRY IN THIS BLOCK THAT IS NOT A PLAYTEST KNOB. C10 is anti-scope
     *  and it is crash-safety rather than taste: the World Maps route is ADDITIVE
     *  WITH NO DELETE, and the export planner dereferences `world.zones[zoneId]`
     *  across its awaits while its staleness check never asks whether a zone
     *  survived — so a cell that exported and was then evicted is a crash, and a
     *  cell that exported at all is a permanent row on a real player's map, one
     *  per patch of wilderness they ever walked through, on a lattice with no
     *  edge. Lane 9 pins the LITERAL and then drives the shipped export, because
     *  reading this constant back is true for every value it could hold. */
    CHUNK_MAP_EXPORT: false,
    // ── Streams ──────────────────────────────────────────────────────────────
    STREAM_LABEL: "wild",
    NAME_STREAM_LABEL: "wild-name",
    // ── Terrain mix ──────────────────────────────────────────────────────────
    // How much a far ring runs wilder than a near one, and the ceiling on it.
    RING_WILDNESS: 0.16,
    RING_WILDNESS_CAP: 0.9,
    // How fast the settlement's own surround stops being felt, per ring out.
    SURROUND_FALLOFF: 0.45,
    WEIGHT_FLOOR: 0.01, // no class is ever weighted to exactly zero
    // The odds a class that only SOMETIMES carries a landmark carries one. The
    // classes that always do (`fen`, `oldwall`) say so in the table.
    LANDMARK_ODDS: 0.12,
    // What the weights add up to BEFORE the ring and the surround pull on them,
    // stated so the lane can check the design and not just the arithmetic: ~1
    // landmark in 7 cells (C12). The two pulls move it, and the band is how far
    // either is allowed to — a surround that doubled the ruins would be a knob
    // that had stopped being a bias.
    LANDMARK_RATE_TARGET: 1 / 7,
    LANDMARK_RATE_TOLERANCE: 0.01,
    LANDMARK_RATE_BAND: 2,
    FLAVOR_MAX_CHARS: 140,
    FEATURE_TRIES: 6, // anchors a landmark tries before the cell goes plain
    // The shipped placer footprints, restated here because `FEATURE_RECTS` is a
    // local of the settlement compiler's own placement pass and a chunk anchors
    // against its own reservations, not against a town's lots.
    FEATURE_RECTS: {
      ruin: { w: 6, h: 5 },
      lookout: { w: 4, h: 4 },
      "landmark-stone": { w: 3, h: 3 },
      "water-feature": { w: 8, h: 5 },
    },
    /** THE SIX TERRAIN CLASSES, composed from the shipped tile vocabulary — one
     *  table, not six scatterings (C7).
     *
     *  `ground`/`mottle` are the class's two ground ids; `dress` is the optional
     *  band or pool pass that gives a class its shape; `scatter` is the object
     *  the class strews; `feature` is the landmark it may carry, from the shipped
     *  FEATURE_TAGS vocabulary; `wildness` is how much a far ring wants more of
     *  it (negative = the ring nearest the town wants it most).
     *
     *  BOTH THEMES SHIP AND THE READING IS HONEST: the atlas is shared, so all
     *  six paint in a colony with zero new art — but 10-art re-skins trunk/canopy
     *  as mast and antenna and recolours the stone, so a colony `woods` is a mast
     *  thicket and a colony `oldwall` is a collapsed bulkhead. The word book says
     *  so in the colony's own words rather than pretending the picture is the
     *  same one. */
    CLASSES: {
      woods: {
        weight: 32,
        wildness: 0.25,
        ground: "grass",
        mottle: { tile: "grass2", rate: 0.34 },
        scatter: { tile: "trunk", overhead: "canopy", count: 54 },
        feature: null,
      },
      heath: {
        weight: 22,
        wildness: 0,
        ground: "grass2",
        mottle: { tile: "grass", rate: 0.3 },
        scatter: { tile: "trunk", overhead: "canopy", count: 12 },
        feature: { tag: "landmark-stone", always: false },
      },
      scree: {
        weight: 14,
        wildness: 0.5,
        ground: "stone",
        mottle: { tile: "dirt", rate: 0.32 },
        scatter: { tile: "wallStone", overhead: null, count: 16 },
        feature: { tag: "lookout", always: false },
      },
      fen: {
        weight: 5,
        wildness: 0,
        ground: "grass",
        mottle: { tile: "grass2", rate: 0.46 },
        dress: "pools",
        scatter: { tile: "trunk", overhead: "canopy", count: 18 },
        feature: { tag: "water-feature", always: true },
      },
      outfield: {
        weight: 22,
        wildness: -1,
        ground: "grass",
        mottle: { tile: "dirt", rate: 0.18 },
        dress: "furrows",
        scatter: { tile: "trunk", overhead: "canopy", count: 8 },
        feature: null,
      },
      oldwall: {
        weight: 5,
        wildness: 1,
        ground: "grass",
        mottle: { tile: "dirt", rate: 0.3 },
        scatter: { tile: "trunk", overhead: "canopy", count: 14 },
        feature: { tag: "ruin", always: true },
      },
    },
    // How much of a `fen` is standing water, and how wide a furrow band is on an
    // `outfield`. Both are drawn on the cell's own stream.
    POOLS: { count: 3, w: 5, h: 3 },
    FURROWS: { rows: 4, gap: 3, inset: 4 },
    // ── Climate and surround pull ────────────────────────────────────────────
    // Multipliers on a class's base weight. A band a table does not name pulls
    // nothing (×1), which is what a legacy or degraded world gets for free.
    LATITUDE_BIAS: {
      equatorial: { woods: 1.4, outfield: 1.2, scree: 0.7 },
      tropical: { woods: 1.35, fen: 1.3, scree: 0.75 },
      subpolar: { woods: 0.6, outfield: 0.5, scree: 1.6, heath: 1.3 },
      polar: { woods: 0.35, outfield: 0.25, scree: 2, heath: 1.2, fen: 0.5 },
    },
    PRECIP_BIAS: {
      arid: { fen: 0.2, woods: 0.5, scree: 2, heath: 1.4, outfield: 0.7 },
      wet: { fen: 3, woods: 1.4, scree: 0.5, heath: 0.8 },
    },
    SURROUND_BIAS: {
      woods: { woods: 2.2, heath: 0.7 },
      fields: { outfield: 2.4, woods: 0.7 },
      rocky: { scree: 2.6, woods: 0.6, outfield: 0.6 },
      water: { fen: 2.8, woods: 1.2, scree: 0.6 },
      barren: { scree: 1.8, heath: 1.8, woods: 0.4, outfield: 0.4, oldwall: 1.4 },
    },
    /** THE WORD BOOK. `<article> <adjective> <noun>` per theme per class, plus
     *  the one line of prose a LANDMARK cell carries and an ordinary one does
     *  not — flavor is bounded by RARITY, not banned (C12), so the injection
     *  budget is a function of how many landmarks exist to find and not of how
     *  far anybody walks. */
    WORDS: {
      "cozy-village": {
        woods: {
          adj: ["Whispering", "Tangled", "Elder", "Rook's"],
          noun: ["Wood", "Thicket", "Copse", "Hollow"],
          feature: "",
          flavor: "",
        },
        heath: {
          adj: ["Windward", "Bare", "Gorse", "Long"],
          noun: ["Heath", "Common", "Moor", "Reach"],
          feature: "The Leaning Stone",
          flavor: "A single stone leans out of the gorse, older than the road that forgot to pass it.",
        },
        scree: {
          adj: ["Broken", "Grey", "Falling", "Cold"],
          noun: ["Scree", "Screes", "Slip", "Shoulder"],
          feature: "The Watchpoint",
          flavor: "Loose rock the whole way up, and at the top a flat place somebody once kept watch from.",
        },
        fen: {
          adj: ["Sunken", "Still", "Green", "Mirefoot"],
          noun: ["Fen", "Marsh", "Sump", "Waters"],
          feature: "The Still Water",
          flavor: "The ground gives underfoot until it stops being ground, and the water lies there not moving.",
        },
        outfield: {
          adj: ["Far", "Fallow", "Old", "Low"],
          noun: ["Outfield", "Furlong", "Acres", "Strips"],
          feature: "",
          flavor: "",
        },
        oldwall: {
          adj: ["Fallen", "Nameless", "Mossed", "Last"],
          noun: ["Wall", "Ruin", "Steading", "Foundations"],
          feature: "The Fallen Steading",
          flavor: "Somebody built here once. Three courses of wall are left, and grass in the doorway.",
        },
      },
      "sci-fi-colony": {
        woods: {
          adj: ["Standing", "Dead", "Outer", "Rusted"],
          noun: ["Mast Field", "Antenna Farm", "Pylons", "Array"],
          feature: "",
          flavor: "",
        },
        heath: {
          adj: ["Windward", "Bare", "Sintered", "Long"],
          noun: ["Flats", "Scrub", "Pan", "Reach"],
          feature: "The Marker",
          flavor: "A survey marker stands alone on the pan, still numbered, its claim long since lapsed.",
        },
        scree: {
          adj: ["Broken", "Grey", "Sliding", "Cold"],
          noun: ["Talus", "Scarp", "Slip", "Shoulder"],
          feature: "The Relay Post",
          flavor: "Bad footing all the way up, and a relay post on the crest with its dish still aimed somewhere.",
        },
        fen: {
          adj: ["Sunken", "Still", "Cooling", "Seep"],
          noun: ["Basin", "Sump", "Catchment", "Pools"],
          feature: "The Catchment",
          flavor: "Runoff pools in the low ground and stays there, flat and unmoving, going nowhere.",
        },
        outfield: {
          adj: ["Far", "Fallow", "Old", "Low"],
          noun: ["Plots", "Terraces", "Beds", "Strips"],
          feature: "",
          flavor: "",
        },
        oldwall: {
          adj: ["Collapsed", "Unlisted", "Buried", "Last"],
          noun: ["Bulkhead", "Ruin", "Outstation", "Footings"],
          feature: "The Collapsed Outstation",
          flavor: "An outstation nobody logged. The bulkhead is down and the floor plates are under dust.",
        },
      },
    },
  };

  /** THE WORDS THE WILDERNESS SAYS OUT LOUD, in one place — the retry surface's
   *  `RETRY_COPY` idiom. A bearing, a signpost and a notice: the whole of what
   *  this feature ever writes on screen.
   *
   *  Plain words on purpose. "Cell", "chunk" and "lattice" are how the code
   *  talks about the country; what the player reads is which way it goes and
   *  what is over there. */
  const COPY = {
    BEARINGS: { N: "North", E: "East", S: "South", W: "West" },
    // A signpost, never a verb: a gate is crossed by walking into it, so there
    // is no button to label and nothing to press.
    gate: (bearing, place) => `${bearing} — ${place}`,
  };

  // ── Directions ──────────────────────────────────────────────────────────────
  // Cell arithmetic and nothing else: north is -y in tiles AND -1 in cells, so
  // east-then-north and north-then-east name the same cell, which is the whole
  // reason the lattice can be a graph with no geometry to reconcile.
  const DIRS = ["N", "E", "S", "W"];
  const DELTA = { N: { cx: 0, cy: -1 }, E: { cx: 1, cy: 0 }, S: { cx: 0, cy: 1 }, W: { cx: -1, cy: 0 } };
  const OPPOSITE = { N: "S", E: "W", S: "N", W: "E" };
  const opposite = (dir) => PF.own(OPPOSITE, dir) ?? null;
  const delta = (dir) => PF.own(DELTA, dir) ?? null;

  // ── Ids ─────────────────────────────────────────────────────────────────────
  const CHUNK_ID_RE = new RegExp(`^${TUNE.CHUNK_ID_PREFIX}_(-?\\d+)_(-?\\d+)$`);
  const idFor = (cx, cy) => `${TUNE.CHUNK_ID_PREFIX}_${cx}_${cy}`;

  /** A cell, or null — and the test is ROUND-TRIP CANONICALITY, not a specimen
   *  list. An id is a cell iff spelling that cell back gives the identical
   *  string, which refuses `w_007_0`, `w_-0_0`, `w_1e3_0`, `w_ 1_0` and every
   *  other aliasing spelling by construction rather than by whichever hostile
   *  form somebody thought to enumerate. Two ids that name one cell would be two
   *  zones for one place: a save row pointing at the twin, a gate that never
   *  comes home, and a residency policy that evicts one of them forever. */
  function parse(id) {
    if (typeof id !== "string") return null;
    const match = CHUNK_ID_RE.exec(id);
    if (!match) return null;
    const cx = Number(match[1]);
    const cy = Number(match[2]);
    // A 4 KB run of digits parses to a float, not an integer, and `w_1e21_0`
    // would spell back in exponent form. Both are refused here rather than at
    // the round trip, so the arithmetic below never sees a non-integer.
    if (!Number.isSafeInteger(cx) || !Number.isSafeInteger(cy)) return null;
    if (idFor(cx, cy) !== id) return null;
    return { cx, cy };
  }

  /** The cell a lattice-participating zone stands in, or null. Written by the
   *  compiler for `z1` and the brief's wilds, and by `compileChunk` for the rest;
   *  runtime-only, like every other derived field on a zone. */
  const cellOf = (zone) =>
    zone && zone.cell && Number.isSafeInteger(zone.cell.cx) && Number.isSafeInteger(zone.cell.cy) ? zone.cell : null;

  /** WHICH ZONE A CELL IS — and three cells are not chunks at all.
   *
   *  (0,0) is the settlement and (±1,0) are the brief's own wilds when it has
   *  them (east is `wildsPlaces[0]`, matching the shipped `index === 0`). None of
   *  those ids match the chunk pattern, which is exactly why `ensure` passes a
   *  resident id straight back before it parses anything: a canonical-parse-first
   *  ensure would refuse the single most-walked transition in the feature — the
   *  walk home — and leave every inward gate inert.
   *
   *  Null on a world with no compiled brief behind it. The fallback map gets no
   *  wilderness at all (maintainer ruling: "no one should play in the fallback
   *  map"), and this is where that refusal lives. */
  function cellZoneId(world, cx, cy) {
    if (!world || world.brieved !== true) return null;
    if (!Number.isSafeInteger(cx) || !Number.isSafeInteger(cy)) return null;
    if (cx === 0 && cy === 0) return typeof world.startZone === "string" ? world.startZone : null;
    const anchor = PF.own(world.latticeAnchors ?? null, `${cx},${cy}`);
    if (typeof anchor === "string") return anchor;
    return idFor(cx, cy);
  }

  // ── Gate geometry ───────────────────────────────────────────────────────────
  // A gate is a border TILE with a direction. The span is centred on the zone's
  // own middle, which puts a settlement's gates exactly on its spine terminals
  // and a wilds' east/west gates on its approach-road band — the two places the
  // shipped geometry already leads to. The N/S columns are two clear of a
  // `water-crossing` wilds' stream (laid at x = 20-21), so no apron ever lands
  // in guaranteed water.
  const spanStart = (extent) => ((extent / 2) | 0) - (TUNE.GATE_SPAN >> 1);

  /** The gate tiles for one direction. */
  function gateTiles(zone, dir) {
    const out = [];
    for (let i = 0; i < TUNE.GATE_SPAN; i++) {
      if (dir === "N") out.push({ x: spanStart(zone.w) + i, y: 0, dir });
      else if (dir === "S") out.push({ x: spanStart(zone.w) + i, y: zone.h - 1, dir });
      else if (dir === "E") out.push({ x: zone.w - 1, y: spanStart(zone.h) + i, dir });
      else out.push({ x: 0, y: spanStart(zone.h) + i, dir });
    }
    return out;
  }

  const gatesFor = (zone, dirs) => dirs.flatMap((dir) => gateTiles(zone, dir));

  /** The tiles one gate owns: itself and the apron reaching inward. Written as
   *  one list because the two phases consume the SAME list — phase one reserves
   *  it against the scatter, phase two paints it — and a reservation that did not
   *  match the paint is precisely the bug the two-phase rule exists to prevent. */
  function apronTiles(zone, gate) {
    const step = delta(gate.dir);
    if (!step) return [];
    const out = [];
    for (let i = 0; i < TUNE.GATE_APRON; i++) {
      const x = gate.x - step.cx * i;
      const y = gate.y - step.cy * i;
      if (x < 0 || y < 0 || x >= zone.w || y >= zone.h) break;
      out.push({ x, y });
    }
    return out;
  }

  /** The tile the player LANDS on coming through a gate: one step inside it. */
  function insetOf(zone, gate) {
    const step = delta(gate.dir);
    if (!step) return null;
    return { x: gate.x - step.cx, y: gate.y - step.cy };
  }

  /** Every tile a set of gates needs kept clear, as the POINT list the shipped
   *  `scatterTrees` reserve argument takes.
   *
   *  PHASE ONE OF THE TWO-PHASE RULE. The shipped wilds punch clears the object
   *  layer on the RING COLUMN only and `fillRect(…,"ground","path")` touches no
   *  trunk, so an apron nobody reserved keeps its standing tree with `solid =
   *  true` under fresh paint — a doorway with a tree in it. The shipped arrival
   *  tiles are reserved for exactly that reason, and their own comment names the
   *  failure: "the walk home arrived inside a tree".
   *
   *  MEASURED, so the claim is honest about what each half buys: `punchGates`
   *  below clears the whole apron rather than the ring alone, so removing this
   *  reservation on its own does NOT put a tree in a doorway — the punch would
   *  eat it. What the reservation uniquely buys is the ±1x/±2y shadow the shipped
   *  reserve test casts: the doorway is not hemmed in by the trunks standing
   *  beside it, and no neighbouring tree loses its crown to a punch that clears
   *  an overhead the tree below still owns. The lane asserts phase one directly,
   *  against a build with the punch rewritten out, rather than leaning on a
   *  consequence phase two happens to cover too. */
  const reservationsFor = (zone, gates) => gates.flatMap((gate) => apronTiles(zone, gate));

  /** PHASE TWO: open the ring and lay the apron. Runs LATE — after the scatter,
   *  after the features, where the shipped wilds punch already sits — because the
   *  compiler's `struggling` scuffing loop draws its MAIN stream once per painted
   *  path tile, so a terminal painted with the road block shifts every downstream
   *  main-stream consumer (measured at 73 changed settlement tiles plus a
   *  re-rolled wilds zone, against 8 when punched late).
   *
   *  Clears the object AND the overhead: a border trunk carries its canopy on its
   *  own tile, and a scattered one carries it a row above, so an apron tile that
   *  gave up a trunk gives up that trunk's crown too — otherwise a canopy hangs
   *  over nothing, which is a shipped paint-fault class with its own assertion. */
  function punchGates(zone, gates) {
    const prims = PF.world.prims;
    for (const gate of gates) {
      for (const tile of apronTiles(zone, gate)) {
        const at = tile.y * zone.w + tile.x;
        const hadTrunk = zone.object[at] === "trunk";
        prims.put(zone, tile.x, tile.y, "object", null, false);
        prims.put(zone, tile.x, tile.y, "overhead", null);
        if (hadTrunk && tile.y > 0 && zone.object[(tile.y - 1) * zone.w + tile.x] !== "trunk") {
          prims.put(zone, tile.x, tile.y - 1, "overhead", null);
        }
        prims.put(zone, tile.x, tile.y, "ground", "path");
      }
    }
  }

  /** The gate under a tile, if any. */
  const gateAt = (zone, x, y) => (zone?.gates ?? []).find((gate) => gate.x === x && gate.y === y) ?? null;

  /** WHERE A GATE LEADS — pure cell arithmetic, resolved at step time.
   *
   *  This is the whole of the edge contract. There is no portal record to write,
   *  none to dangle when a neighbour is evicted, and none to duplicate when it is
   *  materialized again; re-entering an evicted cell is the same branch as
   *  entering it the first time. Where a record and a gate could BOTH answer for
   *  one tile — the settlement's east terminal on a world whose brief hung a
   *  wilds there — the record wins and no gate is ever written, so the precedence
   *  never has to be arbitrated at runtime. */
  function gateTargetId(world, zone, gate) {
    const cell = cellOf(zone);
    const step = gate && delta(gate.dir);
    if (!cell || !step) return null;
    return cellZoneId(world, cell.cx + step.cx, cell.cy + step.cy);
  }

  /** Where a player coming through `dir` stands when they arrive: the inset of
   *  the destination's own gate facing back the way they came. Null when the
   *  destination holds no such gate, which the caller reads as "do not move". */
  function arrivalFor(dest, dir) {
    const back = opposite(dir);
    const gate = (dest?.gates ?? []).find((g) => g.dir === back);
    if (!gate) return null;
    const inset = insetOf(dest, gate);
    if (!inset) return null;
    if (dest.solid[inset.y * dest.w + inset.x]) return null;
    return inset;
  }

  // ── Terrain ─────────────────────────────────────────────────────────────────
  const ring = (cx, cy) => Math.max(Math.abs(cx), Math.abs(cy));
  const biasOf = (table, band, cls) => {
    const row = PF.own(table, band);
    const pull = row ? PF.own(row, cls) : undefined;
    return typeof pull === "number" ? pull : 1;
  };

  /** The class weights at a given ring, for this world's sky and its surround.
   *
   *  Pure and exported, because the "one landmark in seven cells" claim is a
   *  property of these numbers and the lane checks the numbers rather than
   *  counting a sample and hoping. The surround's pull FADES with distance — the
   *  ring the town can see is the ring the town's own country shows in — while
   *  the ring term itself runs the other way: the far cells thin out the
   *  outfields and thicken the ruins. */
  function classWeights(world, atRing) {
    const axes = PF.weather.axesOf(world);
    const surround = PF.own(TUNE.SURROUND_BIAS, world?.surround) ? world.surround : null;
    const nearness = 1 / (1 + Math.max(0, atRing - 1) * TUNE.SURROUND_FALLOFF);
    const wildness = Math.min(TUNE.RING_WILDNESS * atRing, TUNE.RING_WILDNESS_CAP);
    const out = {};
    for (const [cls, spec] of Object.entries(TUNE.CLASSES)) {
      let weight = spec.weight;
      weight *= biasOf(TUNE.LATITUDE_BIAS, axes.latitude, cls);
      weight *= biasOf(TUNE.PRECIP_BIAS, axes.precipitation, cls);
      if (surround) weight *= 1 + (biasOf(TUNE.SURROUND_BIAS, surround, cls) - 1) * nearness;
      weight *= Math.max(0, 1 + spec.wildness * wildness);
      out[cls] = Math.max(TUNE.WEIGHT_FLOOR, weight);
    }
    return out;
  }

  /** The share of cells at this ring that carry a landmark. The design's own
   *  arithmetic, exposed so it can be asserted rather than asserted about. */
  function landmarkRate(world, atRing) {
    const weights = classWeights(world, atRing);
    let total = 0;
    let landmarks = 0;
    for (const [cls, weight] of Object.entries(weights)) {
      total += weight;
      const feature = TUNE.CLASSES[cls].feature;
      if (feature) landmarks += weight * (feature.always ? 1 : TUNE.LANDMARK_ODDS);
    }
    return total > 0 ? landmarks / total : 0;
  }

  /** One weighted draw, in the table's own key order — which is insertion order
   *  for these words, so the pick is a function of the weights and the roll and
   *  never of how the object was built. */
  const pickWeighted = (weights, roll) => {
    let total = 0;
    for (const cls of Object.keys(weights)) total += weights[cls];
    let cursor = roll * total;
    let last = null;
    for (const cls of Object.keys(weights)) {
      last = cls;
      cursor -= weights[cls];
      if (cursor < 0) return cls;
    }
    return last;
  };

  const themeWords = (world) => PF.own(TUNE.WORDS, world?.theme) ?? TUNE.WORDS["cozy-village"];

  /** The class a cell is, without building it. Every consumer that wants to know
   *  what is out there without paying for tiles asks here. */
  function classFor(world, cx, cy) {
    const stream = PF.rng(PF.hashStr(`${(world?.seed ?? 0) >>> 0}|${TUNE.STREAM_LABEL}|${cx}|${cy}`));
    return pickWeighted(classWeights(world, ring(cx, cy)), stream());
  }

  /** A chunk's display name. Deduped against the names the BRIEF minted and
   *  never against resident chunks: the brief's zones are the same set for the
   *  whole session, and deduping against a set that changes as cells are evicted
   *  would make a name depend on where the player had been. */
  function nameFor(world, cx, cy, cls) {
    const book = PF.own(themeWords(world), cls);
    const stream = PF.rng(PF.hashStr(`${(world?.seed ?? 0) >>> 0}|${TUNE.NAME_STREAM_LABEL}|${cx}|${cy}`));
    const noun = book.noun[(stream() * book.noun.length) | 0];
    const taken = new Set(
      Object.values(world?.zones ?? {})
        .filter((zone) => !parse(zone.id))
        .map((zone) => zone.name),
    );
    const first = (stream() * book.adj.length) | 0;
    for (let i = 0; i < book.adj.length; i++) {
      const name = `The ${book.adj[(first + i) % book.adj.length]} ${noun}`;
      if (!taken.has(name)) return name;
    }
    return `The ${book.adj[first]} ${noun}`;
  }

  /** WHAT THE SIGNPOST SAYS — a bearing and the name of the place the gate
   *  leads to.
   *
   *  NAMED WITHOUT BUILDING. A cell's name is a total function of the same
   *  (seed, cell) the tiles are, so the country over the edge can be read for
   *  two hashes and no zone at all. That matters twice: the label costs nothing
   *  to compute for a neighbour nobody has walked into, and it says the SAME
   *  words whether or not that neighbour happens to be resident — a signpost
   *  that changed its mind when a cell was evicted would be worse than no
   *  signpost, and finding the way home from four rings out is exactly what
   *  these words are for.
   *
   *  The three anchor cells are named the other way round, off the zones the
   *  compiler built: the settlement and the brief's own wilds have names a brief
   *  wrote, and inventing wilderness words for them would tell the player the
   *  town was somewhere else. */
  function gateLabel(world, zone, gate) {
    const bearing = PF.own(COPY.BEARINGS, gate?.dir);
    const cell = cellOf(zone);
    const step = gate && delta(gate.dir);
    if (!bearing || !cell || !step) return "";
    const cx = cell.cx + step.cx;
    const cy = cell.cy + step.cy;
    const id = cellZoneId(world, cx, cy);
    if (!id) return "";
    const place = parse(id) ? nameFor(world, cx, cy, classFor(world, cx, cy)) : PF.own(world.zones, id)?.name;
    return place ? COPY.gate(bearing, place) : "";
  }

  // ── Building a chunk ────────────────────────────────────────────────────────
  const key = (zone, x, y) => y * zone.w + x;

  /** Strew one object across a cell, honouring the reservation.
   *
   *  A near-copy of the compiler's `scatterTrees` on purpose, with the one
   *  difference that matters: the shipped one only ever plants on `grass`,
   *  because a settlement's non-grass ground is road, plaza and crop and a tree
   *  in any of them is a fault. Out here the class table owns the ground — a
   *  heath is `grass2` and a scree is `stone` — and a heath with no gorse on it
   *  because the ground was the wrong word would be six classes that all look
   *  like an empty field. Reservation is by exact tile rather than the shipped
   *  ±1x/±2y box: the corridors this reserves are two tiles wide, so a trunk
   *  standing beside one narrows nothing. */
  function scatter(zone, rnd, spec, reserved) {
    const prims = PF.world.prims;
    for (let i = 0; i < spec.count; i++) {
      const x = 1 + ((rnd() * (zone.w - 2)) | 0);
      const y = 2 + ((rnd() * (zone.h - 3)) | 0);
      const at = key(zone, x, y);
      if (zone.solid[at] || zone.object[at] || reserved.has(at)) continue;
      prims.put(zone, x, y, "object", spec.tile, true);
      if (spec.overhead) prims.put(zone, x, y - 1, "overhead", spec.overhead);
    }
  }

  const rectFree = (zone, rect, reserved) => {
    if (rect.x < 1 || rect.y < 1 || rect.x + rect.w > zone.w - 1 || rect.y + rect.h > zone.h - 1) return false;
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) {
        if (reserved.has(key(zone, x, y)) || zone.solid[key(zone, x, y)]) return false;
      }
    }
    return true;
  };

  /** The class's own dressing: what makes a fen a fen and a furlong a furlong.
   *  Both spellings are the shipped vocabulary and the shipped idiom — the wilds
   *  builder lays its stream with exactly this `fillRect(…, "water", true)` — so
   *  no painter is added and no atlas slot is spent. */
  const DRESS = {
    pools(zone, rnd, reserved) {
      const prims = PF.world.prims;
      for (let i = 0; i < TUNE.POOLS.count; i++) {
        const rect = {
          x: 2 + ((rnd() * (zone.w - 4 - TUNE.POOLS.w)) | 0),
          y: 2 + ((rnd() * (zone.h - 4 - TUNE.POOLS.h)) | 0),
          w: TUNE.POOLS.w,
          h: TUNE.POOLS.h,
        };
        if (!rectFree(zone, rect, reserved)) continue;
        prims.fillRect(zone, rect.x, rect.y, rect.w, rect.h, "ground", "water", true);
      }
    },
    furrows(zone, rnd, reserved) {
      const prims = PF.world.prims;
      const top = TUNE.FURROWS.inset + ((rnd() * TUNE.FURROWS.gap) | 0);
      for (let row = 0; row < TUNE.FURROWS.rows; row++) {
        const y = top + row * TUNE.FURROWS.gap;
        if (y >= zone.h - 2) break;
        for (let x = 2; x < zone.w - 2; x++) {
          if (reserved.has(key(zone, x, y))) continue;
          prims.put(zone, x, y, "ground", "crop");
        }
      }
    },
  };

  /** The corridors a cell keeps clear between its four gates.
   *
   *  Reachability is a CONSTRUCTION here, not a measurement: every apron runs to
   *  a seeded hub, so the pocket seal can never wall a gate off from the spawn no
   *  matter how the scatter falls. The hub moves per cell, so the clearing is not
   *  the same plus-sign in every chunk — and nothing is PAINTED, so a corridor
   *  reads as a way through the trees rather than a road somebody laid. */
  function corridorTiles(zone, gates, rnd) {
    const band = (extent) =>
      Math.round(extent * TUNE.HUB_BAND.lo) + ((rnd() * (extent * (TUNE.HUB_BAND.hi - TUNE.HUB_BAND.lo))) | 0);
    const hub = { x: band(zone.w), y: band(zone.h) };
    const out = [];
    const line = (x0, y0, x1, y1) => {
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
          if (x >= 0 && y >= 0 && x < zone.w && y < zone.h) out.push({ x, y });
        }
      }
    };
    for (const gate of gates) {
      const inset = insetOf(zone, gate);
      if (!inset) continue;
      if (gate.dir === "N" || gate.dir === "S") {
        line(inset.x, inset.y, inset.x, hub.y);
        line(inset.x, hub.y, hub.x, hub.y);
      } else {
        line(inset.x, inset.y, hub.x, inset.y);
        line(hub.x, inset.y, hub.x, hub.y);
      }
    }
    return out;
  }

  /** Build the cell. A pure function of (seed, theme, axes, surround, cell), on
   *  the cell's own side stream and no other.
   *
   *  Order is the two-phase rule spelled out: ground and border first, the gate
   *  positions and their corridors computed and RESERVED second, the class's
   *  dressing and its landmark placed against that reservation, the scatter run
   *  against it too, the spawn CHOSEN out of the reserved arrival set rather than
   *  asserted, and only then the punch and the seal. `sealPockets` throws when a
   *  spawn is solid; choosing the spawn out of ground the reservation guarantees
   *  is clear is what makes that throw structurally unreachable instead of
   *  runtime-reachable. */
  function compileChunk(world, cx, cy) {
    const prims = PF.world.prims;
    const id = idFor(cx, cy);
    const seed = (world?.seed ?? 0) >>> 0;
    const rnd = PF.rng(PF.hashStr(`${seed}|${TUNE.STREAM_LABEL}|${cx}|${cy}`));
    const cls = pickWeighted(classWeights(world, ring(cx, cy)), rnd());
    const spec = TUNE.CLASSES[cls];
    const book = PF.own(themeWords(world), cls);

    const zone = prims.makeZone(id, nameFor(world, cx, cy, cls), TUNE.CHUNK_W, TUNE.CHUNK_H, spec.ground);
    zone.cell = { cx, cy };
    zone.terrain = cls; // the word the word book used, for the HUD and the lanes
    zone.mapKind = TUNE.CHUNK_MAP_KIND;
    zone.mapExport = TUNE.CHUNK_MAP_EXPORT;
    for (let i = 0; i < zone.ground.length; i++) if (rnd() < spec.mottle.rate) zone.ground[i] = spec.mottle.tile;
    prims.borderTrees(zone);

    // PHASE ONE. Every tile the seam will need, before anything can stand on it.
    const gates = gatesFor(zone, DIRS);
    const reserved = new Set(
      reservationsFor(zone, gates)
        .concat(corridorTiles(zone, gates, rnd))
        .map((tile) => key(zone, tile.x, tile.y)),
    );

    if (spec.dress) DRESS[spec.dress](zone, rnd, reserved);

    // The landmark, if this cell carries one. Anchored against the reservation
    // exactly as the wilds anchors against its road: a feature with nowhere safe
    // is dropped, which reads out here as a plainer wood.
    if (spec.feature && (spec.feature.always || rnd() < TUNE.LANDMARK_ODDS)) {
      const size = TUNE.FEATURE_RECTS[spec.feature.tag];
      for (let attempt = 0; attempt < TUNE.FEATURE_TRIES; attempt++) {
        const rect = {
          x: 2 + ((rnd() * (zone.w - 4 - size.w)) | 0),
          y: 2 + ((rnd() * (zone.h - 4 - size.h)) | 0),
          w: size.w,
          h: size.h,
        };
        if (!rectFree(zone, rect, reserved)) continue;
        prims.PLACERS[spec.feature.tag](zone, rect.x, rect.y);
        // A lit landmark is a landmark you can find after dark, and `zone.lights`
        // costs nothing to carry. The stone's own placer already lights itself;
        // the other two are lit on a stone the placer actually stood, never on
        // bare ground.
        if (zone.object[key(zone, rect.x, rect.y)] === "wallStone") zone.lights.push({ x: rect.x, y: rect.y });
        zone.features.push({
          // The reserved-id shape, on the quest board's precedent: an id that is
          // visibly not a brief ordinal, because no brief wrote this.
          id: `wild:${id}:${zone.features.length + 1}`,
          tag: spec.feature.tag,
          name: book.feature,
          rect,
        });
        break;
      }
    }

    scatter(zone, rnd, spec.scatter, reserved);

    // CHOSEN, never asserted: the west gate's own arrival tile, which the
    // reservation has kept clear and the punch is about to lay path on.
    const home = insetOf(
      zone,
      gates.find((gate) => gate.dir === "W"),
    );
    zone.spawn = { x: home.x, y: home.y };

    // PHASE TWO, and then the seal — in that order, because the punch opens ring
    // tiles that were solid when a seal running before it swept the zone, and
    // those tiles would ship walkable-but-unswept with a pocket behind them.
    punchGates(zone, gates);
    zone.gates = gates;
    // Flavor rides RARITY: a landmark cell injects one line on first entry and an
    // ordinary cell costs nothing at all, so the prose budget is a function of
    // how many landmarks exist to find rather than of how far anybody walks.
    if (zone.features.length && book.flavor) zone.flavor = book.flavor.slice(0, TUNE.FLAVOR_MAX_CHARS);
    prims.sealPockets(zone, zone.spawn);
    return zone;
  }

  // ── Materialization ─────────────────────────────────────────────────────────
  const warned = new Set();

  /** THE ZONE FOR AN ID, MATERIALIZING IT IF IT HAS TO — and the first arm is the
   *  walk home.
   *
   *  RESIDENT PASSTHROUGH COMES FIRST, for any id at all. A gate can name `z1`,
   *  it can name either of the brief's wilds, and it can name a chunk that is
   *  already standing; none of the first two match the chunk pattern, so an
   *  ensure that parsed before it looked would refuse the most-walked transition
   *  in the whole feature and leave every inward gate an inert tile. Parsing and
   *  building apply to ABSENT ids only.
   *
   *  Never throws. A builder bug degrades to a gate tile that does nothing — a
   *  quiet non-event the player can walk away from — rather than a throw inside
   *  the frame loop, which re-arms its own animation frame before the throw and
   *  would pump the fault sixty times a second, or inside a restore, which would
   *  cost the save. */
  function ensure(world, zoneId) {
    if (!world || typeof zoneId !== "string") return null;
    const resident = PF.own(world.zones, zoneId);
    if (resident) return resident;
    const cell = parse(zoneId);
    if (!cell) return null;
    // The id has to be the id this world would MINT for that cell. On a world
    // whose brief hung a wilds at (1,0) the string `w_1_0` names a cell that is
    // spoken for, and building a second zone for it would put a chunk nobody can
    // reach beside the wilds everybody can.
    if (cellZoneId(world, cell.cx, cell.cy) !== zoneId) return null;
    try {
      const zone = compileChunk(world, cell.cx, cell.cy);
      world.zones[zoneId] = zone;
      return zone;
    } catch (err) {
      if (!warned.has(zoneId)) {
        warned.add(zoneId);
        console.warn(`pixelforge: could not compile wilderness cell ${zoneId}`, err);
      }
      return null;
    }
  }

  // ── What the compiler asks for ──────────────────────────────────────────────
  /** The settlement's own gates: every spine terminal the brief's wilds did not
   *  already take. Where a wilds hangs, its shipped portal pair is the seam and
   *  no gate is written at all — so a record and a gate can never both answer for
   *  one tile, and the precedence is settled at build time. */
  const settlementGates = (v, wilds) =>
    gatesFor(
      v,
      DIRS.filter((dir) => !(dir === "E" && wilds.east) && !(dir === "W" && wilds.west)),
    );

  /** A brief wilds' gates: its three OUTWARD edges. The fourth is the portal pair
   *  home, which is a record and stays one. */
  const wildsGates = (zone, east) =>
    gatesFor(
      zone,
      DIRS.filter((dir) => dir !== (east ? "W" : "E")),
    );

  return {
    TUNE,
    DIRS,
    CHUNK_ID_RE,
    idFor,
    parse,
    cellOf,
    cellZoneId,
    opposite,
    delta,
    gateAt,
    gateTargetId,
    gateLabel,
    arrivalFor,
    insetOf,
    gatesFor,
    apronTiles,
    reservationsFor,
    punchGates,
    settlementGates,
    wildsGates,
    classWeights,
    classFor,
    landmarkRate,
    compileChunk,
    ensure,
    isLandmark: (zone) => !!zone && Array.isArray(zone.features) && zone.features.length > 0,
  };
})();
