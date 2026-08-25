// ── Simulation ────────────────────────────────────────────────────────────────
// Fixed-timestep world sim: player movement + collision, portals, NPC wander,
// package-local clock. Modes gate everything: "walk" is the only mode that
// consumes input; "dialogue" hands the keyboard back to the host narration
// input; "combat"/"replay" freeze the world under the host's own UI.
// When each daypart BEGINS, in package-local minutes — the same four thresholds
// daypart() reads from the other side. One table rather than a literal per
// caller: waitUntil jumps to one of these, the fishing verb's "until dusk" loops
// windows toward one, and a copy that drifted would be a rest action and a
// session disagreeing about when the evening starts.
PF.DAYPART_STARTS = { dawn: 5 * 60, day: 7 * 60, dusk: 18 * 60, night: 21 * 60 };

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
    // The named feature the player is standing at, or null (see step()). Derived
    // per frame from the zone's own register (20-world makeZone.features), which
    // is itself derived — nothing here is ever saved.
    this.nearFeature = null;
    this._npcTimers = new Map();
    this._rnd = PF.rng((world.seed ^ 0x9e3779b9) >>> 0);
    this.dirty = false; // save-worthy change happened
    // Envelope keys a NEWER build wrote that this one does not understand,
    // re-emitted verbatim by snapshot() (60-save ENVELOPE_KEYS). Initialized
    // here EXPLICITLY rather than lazily like `intro`: snapshot() reads it on
    // the wizard's throwaway sim too, and an undefined-shaped field is exactly
    // the trap `intro` already is.
    this._envelopeExtra = {};
    // The S5 player block, default-initialized HERE rather than lazily (plan
    // §Q5). snapshot() emits `player` unconditionally, so a sim that reached it
    // without one would either crash or teach the envelope to emit a key
    // conditionally — which is the exact registry failure ENVELOPE_KEYS exists
    // to stop. simFromSaved overwrites this with the restored block.
    this.player = PF.player.defaultPlayer();
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
    // Own-property, because this early return is the ONLY thing standing between
    // a caller-supplied word and the mount. `zones["constructor"]` is a truthy
    // function, so bare, the guard did not fire: `zoneId` was pinned to a word no
    // zone answers to and zone() handed Object's own constructor to the frame
    // loop, which throws on the first `z.w`. Nothing catches that — and because
    // the bare form also set `dirty` before the throw, the prototype-named id
    // reached `snap.zone` first: a corrupt save AND a dead frame loop. Both
    // shipped callers pre-validate today, but teleport is public on PF.Sim, and
    // 60-save already spells this same test out as `hasZone` for ids taken off a
    // save row — a refusal, cleanly, is the whole contract of the line.
    if (!PF.own(this.world.zones, zoneId)) return;
    this.zoneId = zoneId;
    this.x = (tx + 0.5) * PF.TILE;
    this.y = (ty + 0.5) * PF.TILE;
    this.dirty = true;
  }

  step(dt, input) {
    const z = this.zone();
    // A beat is WALK-ONLY and never survives the screen changing hands. Dialogue,
    // combat and replay each own the screen, and a beat left standing would keep
    // asking the host to fold its narration box away for the whole of it — over
    // exactly the narration the player changed modes to read. Cleared here for the
    // modes that still step, and at the mode chokepoint (core.setMode) for replay,
    // which never reaches this function at all. `_vistaArmed` deliberately stays
    // down: coming back to walk in the same corner must not restart the beat.
    if (this.mode !== "walk" && this.cutscene) this.cutscene = null;
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
      // THE NAMED FEATURE UNDER THE PLAYER'S HAND, the third proximity read
      // beside the two above and recomputed on the same terms: every walking
      // frame, off the feet tile, null the moment they step away.
      //
      // The test is deliberately TWO-SIDED — a neighbour tile IS water AND that
      // tile lies inside a registry rect. Neither half is the rule on its own.
      // Water alone would make any puddle a feature and could not say which one;
      // a rect alone would count tiles the feature never watered, and rects hold
      // those by design (the wilds ford lays path straight across its stream,
      // and a compiled pool's well stands inside the anchor rect beside it).
      //
      // Four neighbours, not eight: standing corner-on to a pond is standing
      // near the bank, not at it. Skipped whole on a zone with no register,
      // which is most of them.
      this.nearFeature = null;
      if (z.features.length) {
        for (const [nx, ny] of [
          [tx, ty - 1],
          [tx, ty + 1],
          [tx - 1, ty],
          [tx + 1, ty],
        ]) {
          if (nx < 0 || ny < 0 || nx >= z.w || ny >= z.h) continue;
          if (z.ground[ny * z.w + nx] !== "water") continue;
          const row = z.features.find(
            (f) => nx >= f.rect.x && nx < f.rect.x + f.rect.w && ny >= f.rect.y && ny < f.rect.y + f.rect.h,
          );
          if (row) {
            this.nearFeature = row;
            break;
          }
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
    // Own-property, now that the table is shared and reachable from more than one
    // button: `starts["constructor"]` answered with a FUNCTION, which is not
    // undefined, and the guard below would have waved it through onto clockMin.
    const at = Object.prototype.hasOwnProperty.call(PF.DAYPART_STARTS, target) ? PF.DAYPART_STARTS[target] : undefined;
    if (at === undefined || this.mode !== "walk") return false;
    if (at <= this.clockMin) this.day++;
    this.clockMin = at;
    this._clockAcc = 0;
    this.resolveSchedules();
    return true;
  }

  /** Stage what the clock has finished (plan §2.5, M2's ruled variant): every day
   *  BEFORE the one being lived is owed to the wrap-up. Called by the sleep verb
   *  after its advance, and by nothing else — waking hours pass without anybody
   *  sitting down to look back over them, which is the whole conceit.
   *
   *  THE RULED VARIANT IS THE SIMPLE ONE: `max(ledgerOwed, day - 1)`, read AFTER
   *  the clock moved, with no crossing detection and no captured day-before. So a
   *  sleep of any length at any hour owes every elapsed day, and the post-midnight
   *  fisher who beds at 00:30 flushes last night's catch — the session filed its
   *  pre-midnight half under the day it happened, this owes that day, and the
   *  hours since midnight belong to the day still underway.
   *
   *  `max` because sleeps ACCUMULATE and the marker only ever climbs: a rewind
   *  can take the clock backwards, and a marker that followed it down would
   *  quietly un-owe days the player was already promised. The invariant
   *  `ledgerOwed < sim.day` holds by construction — `waitUntil` cannot complete
   *  without moving the clock — and the burn's own guard re-checks it anyway. */
  stageLedgerOwed() {
    this.intro ??= { world: false, zones: {}, npcs: {} };
    this.intro.ledgerOwed = Math.max(PF.player.resolvedDay(this.intro.ledgerOwed), this.day - 1);
    return this.intro.ledgerOwed;
  }

  /** Advance the clock by exactly `n` minutes. The fishing cast's mover, where
   *  waitUntil is the rest action's, and the difference is what each one is FOR:
   *  a rest is over when it reaches a time of day, while a cast SPENDS a fixed
   *  window and lands wherever that leaves the clock. So this one takes minutes
   *  and not a daypart.
   *
   *  IT WRAPS MIDNIGHT, and it has to. A cast window is a multi-minute jump, so
   *  a session that starts at 23:50 crosses into the next day — a DESIGNED path,
   *  since "fish until dawn" is on the verb's own menu. The walking loop above
   *  can never be more than one day out because it ticks a minute at a time;
   *  this can, so the wrap is a loop rather than a test.
   *
   *  `resolveSchedules()` then runs UNCONDITIONALLY, unlike the walking loop's
   *  boundary test. A jump of any size can cross a daypart, and asking whether
   *  it did costs the same as re-placing everybody in a world where nothing
   *  moved — which is what waitUntil already concluded one method down.
   *
   *  NOT MODE-GATED, and waitUntil is: the guard belongs where the refusal is
   *  legible. Wait is a button whose only refusal is the mode, so its mover says
   *  no; fishing has five refusals of its own (59-economy `fish`), `wrong-mode`
   *  among them, and a second silent gate here would turn one of them into a
   *  no-op nobody could tell from a cast that caught nothing.
   *
   *  `_clockAcc` is deliberately left alone. waitUntil clears it because it
   *  JUMPS to a target and a leftover fraction would tick that target's minute
   *  early; an advance lays whole minutes on top of a fraction the player has
   *  genuinely already walked, and clearing it would quietly lose it.
   *
   *  Returns the minutes advanced — 0 for anything that is not a positive whole
   *  count, so a caller can tell a clock that moved from one that did not. */
  advanceMinutes(n) {
    if (!Number.isInteger(n) || n <= 0) return 0;
    this.clockMin += n;
    while (this.clockMin >= 24 * 60) {
      this.clockMin -= 24 * 60;
      this.day++;
    }
    this.resolveSchedules();
    return n;
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
    // TWO PASSES, and the split is the whole correctness argument. Placement
    // consults `taken` so nobody is stacked under anybody — but in a single pass
    // "taken" is read against wherever people happen to be standing from the
    // LAST daypart, and half of them are about to leave. An NPC whose own bed is
    // still warm under a housemate who has not been processed yet gets shunted
    // to the nearest free tile, the housemate then walks off, and the sleeper
    // spends the night on the floorboards beside an empty bed. It is purely an
    // ordering accident: the same world, resolved in a different NPC order, puts
    // a different person on the floor, and going straight to a daypart rather
    // than arriving from another one hides it entirely.
    //
    // So: move everybody between zones first, then place them, counting only the
    // people whose position is final — anyone not scheduled, anyone held, and
    // anyone already placed in this pass.
    const pending = [];
    const unplaced = new Set();
    for (const [fromId, npc] of all) {
      if (!npc._sched || npc._hold) continue; // _hold reserves a GM override seam
      const handle = PF.schedule.resolve(npc._sched, this._daypart);
      if (!handle) continue;
      const target = this.world.zones[handle.zoneId];
      if (!target) continue;
      const box = handle.wander;
      // Only snap when the NPC is OUTSIDE the new box — overlapping day/night
      // boxes should not pop. Read here, before anybody has moved, because that
      // is the position the question is about.
      const inside = npc.x >= box.x0 && npc.x <= box.x1 && npc.y >= box.y0 && npc.y <= box.y1;
      if (handle.zoneId !== fromId) {
        // Cross-zone: the renderer and talk-detection only walk the CURRENT
        // zone's array, so a spliced NPC simply leaves one zone and appears in
        // the other — no visibility flag needed.
        const from = this.world.zones[fromId];
        const index = from.npcs.indexOf(npc);
        if (index >= 0) from.npcs.splice(index, 1);
        target.npcs.push(npc);
      }
      npc.wander = box;
      // stepNpcs caches float fx/fy per id; a stale timer would drag the token
      // back toward the old box. Dropping it re-seeds at the new position, and
      // dropping it HERE also stops an in-flight destination from being read as
      // an occupied tile by somebody being placed below.
      this._npcTimers.delete(npc.id);
      // An in-zone NPC that is already inside its new box keeps its exact tile,
      // so its position is final and it must block others from now on.
      if (handle.zoneId === fromId && inside) continue;
      pending.push({ npc, target, box, spreadKey: handle.spread === false ? null : npc.id });
      unplaced.add(npc);
    }
    for (const move of pending) {
      unplaced.delete(move.npc);
      // spread:false keeps a private, meaningful placement (a merchant's own
      // stall counter); every other handle is SHARED geometry, so disperse by
      // id. `taken` then closes the gap the hash cannot: colliding ids, and the
      // NPCs already standing in the destination, would otherwise stack — and a
      // sprite underneath another one can never be selected by talk-targeting.
      const taken = (x, y) => this.npcOccupies(move.target, x, y, move.npc, unplaced);
      const at = PF.schedule.walkableIn(move.target, move.box, move.spreadKey, taken);
      move.npc.x = at.x;
      move.npc.y = at.y;
    }
  }

  /** Is another NPC standing on — or already walking onto — this tile? Terrain
   *  alone is not enough: two NPCs would pick the same free tile and slide
   *  through each other.
   *
   *  A LINEAR SCAN, and the reason it used to give for that is no longer true.
   *  It said casts are capped at ~10; the compiler now mints residents to fill a
   *  settlement, and a thriving city puts a hundred and thirteen of them on one
   *  exterior zone at midday. So this was re-measured rather than left on a stale
   *  assumption: `stepNpcs` over that zone costs 0.0039ms a frame, against 0.0019
   *  for a village of 25. Four thousandths of a millisecond is 0.02% of a 60fps
   *  budget, so an occupancy index would still be the more expensive of the two.
   *
   *  It stays a scan because it is cheap, NOT because the cast is small. If a
   *  zone ever holds several hundred, measure again before believing this. */
  npcOccupies(z, x, y, exclude, ignore) {
    for (const other of z.npcs) {
      if (other === exclude) continue;
      // Anyone still waiting to be placed this pass is standing on LAST
      // daypart's tile, which says nothing about where they will be. Counting
      // them would let a stale position evict somebody from their own bed.
      if (ignore && ignore.has(other)) continue;
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
    // THE WRAP-UP TELL, LAST IN THE JOIN — which puts it after the persona part
    // and before the sender's own action text, where the plan asks for it (§2.6).
    // It is also the ONLY part of any turn a fishing word can reach the GM
    // through (M10 as amended): the verb narrates nothing, files ledger lines,
    // and those lines are told here or not at all.
    const ledger = this._composeLedger();
    if (ledger) parts.push(ledger.text);
    // The ephemeral half of the flush, handed to the sender rather than stored:
    // which day the tell reached, and which notice ROWS rode with it. Compose
    // stays pure — nothing here burns, and a refused or failed send must lose
    // nothing, exactly as the one-shot flags above it must not.
    pending.ledger = ledger ? { throughDay: ledger.throughDay, notices: ledger.notices } : null;
    this._pendingIntro = pending;
    return parts.join(" ");
  }

  /** The wrap-up tell: the days a completed sleep made owed and has not told, and
   *  every notice still untold. Composed from the two live fields every time and
   *  persisted NOWHERE — there is no stored "what we said last time", so a re-tell
   *  after a lost burn simply reads the same live selection again and says the
   *  same thing (plan §2.5). Returns null when there is nothing owed and nothing
   *  untold, else { text, throughDay, notices }.
   *
   *  LINES: `flushedDay < day ≤ intro.ledgerOwed`, stubs included — an elided day
   *  that says "12 things happened" is still the truest account of it there is.
   *  NOTICES: every untold row, whatever day it carries. The band answers to its
   *  flag rather than to the gate, which is the whole reason it left the lines.
   *
   *  WHOLE DAYS, OLDEST FIRST, AND THE NEWEST DROPPED. The budget is
   *  `TUNING.ledgerTellChars`, measured in graphemes over the line TEXTS — not
   *  over this function's own framing, because the budget is floor-asserted at
   *  load against one maximum-shape day (`ledgerPerDay × ledgerChars`) and a
   *  measure that counted the word "Day" would put a legal day over the floor and
   *  stall the flush forever. Days are rendered oldest-first so the story arrives
   *  in order, and the burn advances only through the last day rendered WHOLE, so
   *  a truncated tell leaves `ledgerOwed` standing and the next turn continues
   *  from where this one stopped.
   *
   *  …AND THE OLDEST DAY ALWAYS RIDES, over budget or not. A day this build can
   *  WRITE cannot exceed the budget (that is what the floor assertion buys), but
   *  a hostile save can carry fifty lines on one day, and "tell nothing, advance
   *  nothing, forever" is a worse answer than one oversized part. */
  _composeLedger() {
    const player = this.player;
    if (!player || typeof player !== "object") return null;
    const owed = PF.player.resolvedDay(this.intro?.ledgerOwed);
    const gate = PF.player.resolvedDay(player.flushedDay);
    const lines = (Array.isArray(player.ledger?.lines) ? player.ledger.lines : []).filter((line) => {
      if (!Array.isArray(line) || line.length < 2) return false;
      const day = PF.player.resolvedDay(line[0]);
      return day > gate && day <= owed;
    });
    const budget = PF.economy?.TUNING?.ledgerTellChars ?? 0;
    const rendered = [];
    let spent = 0;
    let through = gate;
    for (const day of [...new Set(lines.map((line) => PF.player.resolvedDay(line[0])))].sort((a, b) => a - b)) {
      const texts = lines
        .filter((line) => PF.player.resolvedDay(line[0]) === day)
        .map((line) => (typeof line[1] === "string" ? line[1] : ""));
      const cost = texts.reduce((sum, text) => sum + PF.player.graphemes(text).length, 0);
      if (rendered.length && spent + cost > budget) break;
      rendered.push(`Day ${day}: ${texts.join(" ")}`);
      spent += cost;
      through = day;
    }
    const untold = (Array.isArray(player.ledger?.notices) ? player.ledger.notices : []).filter(
      (row) => Array.isArray(row) && row.length >= 2 && !row[2],
    );
    if (!rendered.length && !untold.length) return null;
    const sentences = [...rendered];
    // ONE framing sentence for the whole band, and it frames them as things that
    // happened TO the world rather than in the player's days — which is what they
    // are, and what the writer-site copy each of them carries will say in more
    // detail as the band grows an actor to name (M3, roadmap).
    if (untold.length) {
      const said = untold.map((row) => (typeof row[1] === "string" ? row[1] : "")).join(" ");
      sentences.push(`Also, about the world itself rather than the days in it: ${said}`);
    }
    return { text: `[Wrap-up — ${sentences.join(" ")}]`, throughDay: through, notices: untold };
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
