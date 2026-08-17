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
      this.stepNpcs(dt, z);
    }
    return { zoneChanged: false };
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
          const at = PF.schedule.walkableIn(target, box);
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

  stepNpcs(dt, z) {
    for (const npc of z.npcs) {
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
        if (nx >= w.x0 && nx <= w.x1 && ny >= w.y0 && ny <= w.y1 && !z.solid[ny * z.w + nx]) {
          t.dx = dx;
          t.dy = dy;
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
        if (Math.abs(t.fx - Math.round(t.fx)) < 0.05 && Math.abs(t.fy - Math.round(t.fy)) < 0.05) {
          t.fx = Math.round(t.fx);
          t.fy = Math.round(t.fy);
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
