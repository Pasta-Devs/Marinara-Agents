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
