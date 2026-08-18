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
