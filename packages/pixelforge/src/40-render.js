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
    this._zoneCache = new Map(); // `zoneId|weatherClass` → {base, overhead}
  }

  /** Drop a zone's composites. PREFIX DELETE, because a zone is cached under a
   *  composite CLASS now (`z1|base`, `z1|snow`): deleting the bare id would take
   *  nothing at all, and deleting one class would leave the other stale until
   *  the next world switch — a thaw that never arrives on the one zone that had
   *  just been repainted. */
  invalidateZone(zoneId) {
    const prefix = `${zoneId}|`;
    for (const key of this._zoneCache.keys()) if (key.startsWith(prefix)) this._zoneCache.delete(key);
  }

  /** Drop every zone composite (chat/world switch): the cache is keyed by zone
   *  id and weather class, neither of which is world-unique, so a new world's
   *  zones would otherwise reuse stale composites. */
  clearZones() {
    this._zoneCache.clear();
  }

  /** Is there anything in this zone the weather can lie on?
   *
   *  Scanned once and remembered ON THE ZONE. A settlement is a couple of
   *  thousand tiles and the answer cannot change, because the arrays are never
   *  written — so the alternative is that scan every frame of every snowy day.
   *  A zone with nothing snowable in it (an interior, a paved square) then never
   *  pays for a second composite either. */
  _snowable(z) {
    if (z._snowable === undefined) {
      const subs = PF.weather.SUBS.snow;
      const any = (layer) => layer.some((id) => id && PF.own(subs, id) !== undefined);
      z._snowable = any(z.ground) || any(z.overhead);
    }
    return z._snowable;
  }

  /** One zone, composited under a weather CLASS.
   *
   *  `cls` is either "base" or a weather word with a SUBS row. The substitution
   *  is a RENAME AT PAINT TIME and nothing else: the id the compiler wrote is
   *  read, a different painter answers it, and the zone array is never touched.
   *  That is the paint contract — a renderer that wrote the weather into the
   *  world would have the save carrying it a moment later, and the thaw would
   *  never come.
   *
   *  Both layers are covered: `canopy` lives in `z.overhead`, so a ground-only
   *  substitution would leave green treetops over a white field. */
  _composite(z, cls) {
    const key = `${z.id}|${cls}`;
    let c = this._zoneCache.get(key);
    if (c) return c;
    const T = PF.TILE;
    const subs = cls === "base" ? null : PF.own(PF.weather.SUBS, cls);
    const paint = (id) => PF.art.tile((subs && PF.own(subs, id)) || id);
    const base = PF.offscreen(z.w * T, z.h * T);
    const over = PF.offscreen(z.w * T, z.h * T);
    const bg = base.getContext("2d");
    const og = over.getContext("2d");
    bg.imageSmoothingEnabled = false;
    og.imageSmoothingEnabled = false;
    for (let y = 0; y < z.h; y++) {
      for (let x = 0; x < z.w; x++) {
        const i = y * z.w + x;
        bg.drawImage(paint(z.ground[i]), x * T, y * T);
        if (z.object[i]) bg.drawImage(PF.art.tile(z.object[i]), x * T, y * T);
        if (z.overhead[i]) og.drawImage(paint(z.overhead[i]), x * T, y * T);
      }
    }
    c = { base, overhead: over };
    this._zoneCache.set(key, c);
    return c;
  }

  draw(sim, opts) {
    const { ctx } = this;
    const T = PF.TILE;
    const z = sim.zone();
    // THE SKY, READ ONCE PER FRAME off the sim's day-keyed memo. All three
    // weather surfaces below — the ground class, the tint, the falling stuff —
    // spend this one pair, and the intensity reaches only the last two.
    const sky = sim.weather();
    // EXTERIOR ONLY, all of it, on the compiler's own word: a settlement and a
    // place are outdoors, a building is not. It does not rain in the inn.
    const outdoors = z.mapKind !== "building";
    const comp = this._composite(z, outdoors && sky.word === "snow" && this._snowable(z) ? "snow" : "base");
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

    // ── WEATHER TINT ─────────────────────────────────────────────────────────
    // BEFORE the day/night block, with its own composite-op save/restore, and
    // both halves of that placement are deliberate. `darkness()` returns exactly
    // 0 from 07:00 to 18:00, so a tint folded into the block below would be
    // invisible for eleven hours a day — most of the hours anyone plays. And the
    // ORDER is weather first, night second: a night storm tints the world and
    // then the dark falls over it, rather than greying out the window glow.
    //
    // Rain's tint is a PAIR, one alpha per intensity, which is the second of the
    // two axes heavy weather is allowed to move (the first is how much is
    // falling). Snow has no tint at all — the tiles carry it.
    const tint = outdoors ? PF.weather.WORD_META[sky.word]?.tint : null;
    const tintColor = typeof tint === "string" ? tint : tint ? (PF.own(tint, sky.intensity) ?? tint.light) : null;
    if (tintColor) {
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = tintColor;
      ctx.fillRect(offX, offY, viewW, viewH);
      ctx.globalCompositeOperation = "source-over";
    }

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

    // Falling weather goes on LAST, over the night as well as the day: rain the
    // dark had already multiplied down to nothing is rain nobody can see, and
    // the point of the pass is that something is visibly happening.
    if (outdoors) this._fall(ctx, sky, offX, offY, viewW, viewH);

    // letterbox frame line so the world reads as a deliberate viewport over the scene art
    if (opts?.frame !== false) {
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 2;
      ctx.strokeRect(offX + 1, offY + 1, viewW - 2, viewH - 2);
    }
  }

  /** WHAT IS FALLING OUT OF THE SKY: a lean screen-space pass over the finished
   *  frame. No emitter, no particle system, no state — N lanes, each one a fixed
   *  hash and a phase.
   *
   *  THE DETERMINISM EXCEPTION, DECLARED HERE BECAUSE IT IS THE ONLY ONE.
   *  Everything else in this package is a pure function of the saved clock — the
   *  sky at a day, a fish roll, where a villager stands at seven in the morning
   *  — and that is exactly what makes a rewind land on the world it left. This
   *  pass takes its phase from `performance.now()`, a wall clock, and NOTHING
   *  SIM-SIDE EVER READS IT. That is what makes the exemption legal rather than
   *  a hole: no draw here feeds a save field, a roll or a decision, so two
   *  machines showing the same save at the same moment may have their rain in
   *  different places and still agree about every fact the game keeps.
   *
   *  It is also load-bearing for the time stop. Under an open dialogue window
   *  `clockMin` and `darkness()` hold still, and this is the one surface left
   *  moving: rain and snow keep falling while you read, which is the whole of
   *  "the world stays alive while you talk to someone". A phase taken from the
   *  game clock would freeze the weather solid along with it.
   *
   *  The LANES are still deterministic — each streak's column, length and speed
   *  come off `hashStr`, so a downpour reads as consistent weather rather than
   *  as static. Only the phase moves.
   *
   *  INTENSITY IS THIS PASS'S LOUDEST AXIS: heavy runs ~2.7x the streaks at
   *  ~1.7x the fall speed, and storm rides the heavy row with a steeper wind
   *  angle. Light rain and heavy rain have to read as different weather at a
   *  glance, which is a promise about this function and not about the tint. */
  _fall(ctx, sky, offX, offY, viewW, viewH) {
    const snowing = sky.word === "snow";
    const storming = sky.word === "storm";
    if (!snowing && !storming && sky.word !== "rain") return;
    const row = PF.weather.TUNING.particles[sky.intensity === "light" ? "light" : "heavy"];
    const t = performance.now() / 1000;
    // Snow drifts; rain leans; a storm leans hard. Wind is x per y fallen.
    const slant = snowing ? 0 : storming ? 0.55 : 0.22;
    const span = viewH + 48; // the lane is taller than the view: streaks enter and leave
    const len = snowing ? 2 : Math.round(4 * row.fall) + 2;
    ctx.fillStyle = snowing ? "rgba(246,249,255,0.85)" : storming ? "rgba(188,203,224,0.6)" : "rgba(199,214,235,0.45)";
    // Clipped to the VIEWPORT, never the canvas: the letterbox bands are where
    // the host's own scene art shows through, and it is not raining on that.
    const bar = (x, y, w, h) => {
      const left = Math.max(x, offX);
      const right = Math.min(x + w, offX + viewW);
      const top = Math.max(y, offY);
      const bottom = Math.min(y + h, offY + viewH);
      if (right > left && bottom > top) ctx.fillRect(left, top, right - left, bottom - top);
    };
    for (let i = 0; i < row.n; i++) {
      const seed = PF.hashStr(`fall|${i}`);
      const speed = row.fall * (snowing ? 26 : 260) * (0.7 + ((seed >>> 12) % 64) / 96);
      const y = ((((seed >>> 6) % span) + t * speed) % span) - 24;
      const drift = snowing ? Math.sin(t * 0.8 + i) * 7 : -y * slant;
      const x = (((((seed % 4096) / 4096) * viewW + drift) % viewW) + viewW) % viewW;
      if (snowing) {
        bar(offX + Math.round(x), offY + Math.round(y), 2, 2);
        continue;
      }
      // A slanted streak in two or three stacked segments — cheaper than a
      // stroked line and it stays on the pixel grid, which is the house style.
      for (let s = 0; s < len; s += 3)
        bar(offX + Math.round(x - s * slant), offY + Math.round(y + s), 1, Math.min(3, len - s));
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
