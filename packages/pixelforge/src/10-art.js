// ── Tier-0 procedural art ─────────────────────────────────────────────────────
// The deterministic bottom rung: a fixed 32-colour ramp and canvas-painted
// tiles/sprites so the game is playable with zero assets and zero network.
// Later tiers (authored atlas, AI bake) resolve above this and fall back here.
PF.art = (() => {
  const PAL = {
    grass1: "#3e7a44", grass2: "#356b3c", grass3: "#4b8a4f",
    leaf: "#2c5a33", leafHi: "#5aa25e", trunk: "#5b4432",
    path1: "#b39764", path2: "#a3875a", pathFleck: "#c7ab74",
    dirt: "#7a5f43", crop: "#7fae52", cropRipe: "#d9a03c",
    water1: "#2e5f8a", water2: "#39719e", waterHi: "#6fa3c8",
    wall: "#8a7561", wallDark: "#6e5c4b", plaster: "#cfc3a8", beam: "#6b4f38",
    roof1: "#9e4a3f", roof2: "#8a3f36", roofHi: "#b85e4d",
    floor1: "#8a6a4a", floor2: "#7d5f41", rug: "#93404a",
    stone: "#8d8d94", stoneDark: "#73737a",
    fence: "#7d6142", door: "#5d4530", doorKnob: "#d9c07a",
    well: "#6f6f78", counter: "#725539",
    night: "#1a2340", windowGlow: "#ffd98a",
    ink: "#22261f", white: "#f3efe2",
  };

  const T = PF.TILE;

  /** One 16×16 tile canvas: Tier-1 (authored atlas) ?? Tier-0 (procedural). */
  const tileCache = new Map();
  function tile(id) {
    const authored = PF.assets?.tileCanvas(id);
    if (authored) return authored;
    let c = tileCache.get(id);
    if (c) return c;
    c = PF.offscreen(T, T);
    const g = c.getContext("2d");
    (PAINTERS[id] || PAINTERS.grass)(g, PF.rng(PF.hashStr(`tile:${id}`)));
    tileCache.set(id, c);
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
        for (let cx = 0; cx < 2; cx++)
          px(g, cx * 8 + ((r % 2) * 4), r * 4, 7, 3, rnd() > 0.5 ? PAL.wall : PAL.wallDark);
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

  return { PAL, tile, actor, drawActor };
})();
