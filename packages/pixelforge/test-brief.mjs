// Standalone harness for the brief validator (node test-brief.mjs): shims the
// PF prelude globals, loads the non-DOM modules, and drives the repair passes,
// compiler invariants, injection metering, and spatial-binding regressions
// through the spec's degenerate cases (docs/brief-schema.md §4-5, §7).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// Mirror the real bundle: concatenate the modules into one scope (the prelude
// declares `const PF` itself) and return PF. The DOM helpers stay unused.
const source = [
  "00-prelude.js",
  "10-art.js",
  "15-assets.js",
  "18-brief.js",
  "20-world.js",
  "25-schedule.js",
  "30-sim.js",
  "50-spatial.js",
  "55-maps-export.js",
  "60-save.js",
]
  .map((file) => readFileSync(join(here, "src", file), "utf8"))
  .join("\n");
const loadedPF = new Function(`"use strict";\n${source}\nreturn PF;`)();
// refresh() fire-and-forgets the maps export; without a stub every earlier
// spatial case would hit undefined fetch and warn. 404 = "route absent" is the
// quiet-skip mode, exactly right as a default. Export cases override it.
loadedPF.api.postSpatialLocations = async () => ({ ok: false, status: 404, body: null });
const { brief, world } = loadedPF;
const ctx = { theme: "cozy-village", seed: 424242 };

// 1. The farm-village conversation case: 30 people, structured as households.
{
  const sealed = brief.validate(
    {
      scale: "village",
      name: "Mossbrook",
      backgroundPopulation: 30,
      situation: "Mayor Alder is hiding the survey that says the north field is sinking.",
      cast: [
        { name: "Alder Vance", role: "mayor", kind: "leader", tint: "blue", home: "Mossbrook", household: 1 },
        { name: "Nessa Vance", role: "daughter", kind: "folk", tint: "violet", home: "Mossbrook", household: 1 },
        { name: "Perrin Quill", role: "innkeep", kind: "host", tint: "amber", home: "Mossbrook", household: 2 },
        { name: "Old Sera", role: "weaver", kind: "elder", tint: "rose", home: "Mossbrook", household: 3 },
        { name: "Brint", role: "farmhand", kind: "grower", tint: "green", home: "Mossbrook", household: 4 },
        { name: "Marla", role: "farmhand", kind: "grower", tint: "teal", home: "Mossbrook", household: 4 },
      ],
    },
    ctx,
  );
  const households = new Set(sealed.cast.map((c) => c.household));
  assert.equal(households.size, 4, "six people in four households — never thirty houses");
  assert.equal(sealed.backgroundPopulation, 30, "population is texture, preserved");
  assert.ok(sealed.situation.includes("Alder"), "the hook survives");
  assert.ok(sealed._ids.zones.z1 === "Mossbrook" && sealed._ids.cast.n1 === "Alder Vance", "ids assigned");
}

// 2. scale as a population number (the observed weak-model slip).
{
  const sealed = brief.validate({ scale: 30, name: "Testton", cast: [] }, ctx);
  assert.equal(sealed.scale, "village", "numeric scale bucketed");
  assert.ok(
    sealed._repairs.some((r) => r.includes("bucketed")),
    "repair logged",
  );
}

// 3. Degenerate-but-valid: one household, one zone, all-grey tints, tiny cast.
{
  const sealed = brief.validate(
    {
      scale: "hamlet",
      name: "Greyfold",
      cast: [
        { name: "A", kind: "folk", tint: "grey", home: "Greyfold", household: 1 },
        { name: "B", kind: "folk", tint: "grey", home: "Greyfold", household: 1 },
      ],
    },
    ctx,
  );
  assert.ok(sealed.cast.length >= 4, "cast floored to minimum");
  assert.ok(new Set(sealed.cast.map((c) => c.household)).size >= 2, "single household split");
  assert.ok(new Set(sealed.cast.map((c) => c.tint)).size >= 3, "tints rotated for legibility");
  assert.ok(sealed.places.length >= 1, "zone floor synthesized a wilds");
}

// 4. Transport: object-keyed cast, markdown junk, oversized household ids.
{
  const sealed = brief.validate(
    {
      scale: "village",
      name: "**Objton**",
      cast: {
        a: { name: "`One`", kind: "folk", tint: "red", home: "Objton", household: 99 },
        b: { name: "<b>Two</b>", kind: "folk", tint: "blue", home: "nowhere", household: 0 },
        c: { name: "Three", kind: "definitely-not-a-kind", tint: "chartreuse", home: "Objton", household: 2 },
        d: { name: "Four", kind: "guard", tint: "teal", home: "OBJTON", household: 3 },
      },
    },
    ctx,
  );
  assert.equal(sealed.name, "Objton", "markdown stripped from names");
  assert.equal(sealed.cast[0].name, "One", "backticks stripped");
  // 99 over-supplies whatever the cap is, so this keeps asserting "clamped to
  // the cap" even when CAPS.household moves.
  assert.equal(sealed.cast[0].household, brief.CAPS.household, "household clamped to cap");
  assert.equal(sealed.cast[1].home, "Objton", "unresolved home falls to root");
  assert.equal(sealed.cast[2].kind, "folk", "unknown kind folds to folk");
  assert.ok(Object.keys(brief.TINTS).includes(sealed.cast[2].tint), "unknown tint replaced from the enum");
  assert.equal(sealed.cast[3].home, "Objton", "folded home resolution (case)");
}

// 5. Caps: too many places, duplicate names, unknown feature tags drop whole items.
{
  const sealed = brief.validate(
    {
      scale: "town",
      name: "Capston",
      features: [
        { tag: "crop-plots", name: "Plots" },
        { tag: "not-a-tag", name: "Ghost" },
        { tag: "dense-growth", name: "WrongZone" }, // wilds-only tag in the settlement
      ],
      places: [
        { kind: "wilds", name: "Wood" },
        { kind: "wilds", name: "Wood" },
        { kind: "wilds", name: "Wood3" },
        { kind: "hall", name: "Hall A" },
        { kind: "hall", name: "Hall B" },
        { kind: "gathering", name: "Inn" },
      ],
      cast: [
        { name: "X", kind: "folk", tint: "red", home: "Wood", household: 1 },
        { name: "Y", kind: "folk", tint: "blue", home: "Capston", household: 2 },
        { name: "Z", kind: "folk", tint: "green", home: "Capston", household: 3 },
        { name: "W", kind: "folk", tint: "amber", home: "Capston", household: 4 },
      ],
    },
    ctx,
  );
  assert.equal(sealed.features.length, 1, "unknown and wrong-zone feature items dropped whole");
  // Asserted against CAPS so a raised cap moves the claim instead of failing it.
  // The fixture supplies one MORE of each kind than today's caps (3 wilds, 2
  // halls) — if a cap ever rises past that, grow the fixture's over-supply too
  // or the clamp under test never fires.
  assert.equal(sealed.places.filter((p) => p.kind === "wilds").length, brief.CAPS.wilds, "wilds clamped to cap");
  assert.equal(sealed.places.filter((p) => p.kind === "hall").length, brief.CAPS.hall, "hall clamped to cap");
  const names = sealed.places.map((p) => p.name);
  assert.equal(new Set(names.map((n) => n.toLowerCase())).size, names.length, "duplicate zone names deduped");
}

// 6. Determinism: same input + seed -> byte-identical sealed brief; different seed -> different repairs.
{
  const degenerate = { scale: "hamlet", name: "Detton", cast: [] };
  const a = JSON.stringify(brief.validate(degenerate, ctx));
  const b = JSON.stringify(brief.validate(degenerate, ctx));
  assert.equal(a, b, "validate is deterministic for a given seed");
  // Bounded-enum picks can collide between two PARTICULAR seeds, so require
  // only that some nearby seed diverges — non-probabilistic across the set.
  const variants = [7, 8, 9, 10, 11].map((seed) => JSON.stringify(brief.validate(degenerate, { ...ctx, seed })));
  assert.ok(
    variants.some((v) => v !== a),
    "top-ups derive from the seed",
  );
}

// 7. Defaults: both themes produce valid sealed briefs with the known casts.
{
  for (const theme of ["cozy-village", "sci-fi-colony"]) {
    const sealed = brief.defaults(theme, 424242);
    assert.equal(sealed.theme, theme);
    assert.ok(sealed.cast.length >= 4);
    assert.ok(
      sealed.places.some((p) => p.kind === "gathering"),
      `${theme} default has a gathering place`,
    );
    assert.ok(JSON.stringify(sealed).length <= 8_192, "default brief inside the byte budget");
  }
}

// 8. Non-Latin names survive: caps are grapheme-based, folding resolves homes, ids carry identity.
{
  const sealed = brief.validate(
    {
      scale: "village",
      name: "囲炉裏の村",
      places: [{ kind: "gathering", name: "琥珀の炉亭" }],
      cast: [
        { name: "ミラ", kind: "host", tint: "rose", home: "琥珀の炉亭", household: 1 },
        { name: "タム", kind: "grower", tint: "green", home: "囲炉裏の村", household: 2 },
        { name: "ルーク", kind: "guard", tint: "blue", home: "囲炉裏の村", household: 3 },
        { name: "フェン", kind: "wanderer", tint: "teal", home: "囲炉裏の村", household: 4 },
      ],
    },
    ctx,
  );
  assert.equal(sealed.name, "囲炉裏の村", "non-Latin settlement name intact");
  assert.equal(sealed.cast[0].home, "琥珀の炉亭", "non-Latin home resolution works");
  assert.equal(sealed._ids.zones.z2, "琥珀の炉亭", "identity is ordinal ids, never slugs");
}

// 9. Guidance and schema stay within their budgets.
{
  const text = brief.guidance("sci-fi-colony");
  assert.ok(text.length < 4_000, `guidance stays compact (${text.length} chars)`);
  assert.ok(text.includes("AUTHORITATIVE"), "theme-authority line present");
  assert.ok(text.includes("do NOT give everyone their own number"), "household teaching line present");
  assert.ok(
    text.includes("lodgers") && text.includes("no limit on how many"),
    "and the guidance says unrelated people may share one, without a cap",
  );
  assert.ok(text.includes("standing"), "standing teaching line present");
  const schemaStr = JSON.stringify(brief.schema());
  assert.ok(schemaStr.length <= 8_000, "schema fits the route's cap");
  assert.ok(schemaStr.includes("destitute"), "schema exposes the standing enum");
}

// ── Compiler invariants (compile(sealedBrief, seed)) ─────────────────────────
// The tiles an NPC can be asleep on. A bunk is a bed TYPE, not a second kind of
// furniture with its own rules, so anything asserting "in bed" names both.
const SLEEPS_ON = new Set(["bed", "bunk"]);
// A BUILDING is its ground floor plus whatever floors it grew (0.8.0). Floor ids
// derive from the parent's — `{id}u` above, `{id}b` below — so "everywhere under
// this roof" is a question about ids and needs no bookkeeping to answer.
const floorIds = (w, zoneId) => [zoneId, `${zoneId}u`, `${zoneId}b`].filter((id) => w.zones[id]);
const floorsOf = (w, zoneId) => floorIds(w, zoneId).map((id) => w.zones[id]);
/** Everyone anywhere in a building, tagged with the floor they are standing on. */
const underRoof = (w, zoneId) => floorsOf(w, zoneId).flatMap((zone) => zone.npcs.map((npc) => ({ zone, npc })));
/** The floor a building's sleeping rooms are on: the storey when it grew one,
 *  the ground floor when it did not (0.8.0 floors). Cases about BEDROOMS ask
 *  this rather than naming a floor, so one assertion covers both sides of the
 *  upper-storey gate. */
const bedFloor = (w, zone) => {
  const up = w.zones[`${zone.id}u`];
  return up && up.beds.length ? up : zone;
};
/** The ground floor of whatever floor an id names. Every ground zone id ends in a
 *  digit (`z2`, `h1`, `s4`), so a trailing `u`/`b` can only be a floor suffix. */
const groundFloorId = (zoneId) => (/[ub]$/.test(zoneId) ? zoneId.slice(0, -1) : zoneId);
/** The tile an NPC is standing on, wherever in the building they are. */
const standingOn = (zone, npc) => zone.object[zone.w * Math.round(npc.y) + Math.round(npc.x)];

function checkWorld(w, sealed, label) {
  assert.equal(w.startZone, "z1", `${label}: settlement is z1`);
  assert.ok(w.zones.z1, `${label}: z1 exists`);
  // Every named zone in the brief exists under its ordinal id — except an
  // INTERIOR place the settlement had no lot to stand on, which is dropped
  // rather than sealed (20-world's facade guard; a named room with no door in
  // either direction strands whoever is homed there). A wilds hangs off a map
  // edge and needs no lot, so it is never allowed to go missing.
  for (const [id, name] of Object.entries(sealed._ids.zones)) {
    if (!w.zones[id]) {
      const place = sealed.places[Number(id.slice(1)) - 2];
      assert.ok(place && place.kind !== "wilds", `${label}: zone ${id} (${name}) compiled`);
      continue;
    }
    assert.equal(w.zones[id].name, name, `${label}: ${id} keeps its display name`);
  }
  // ── I1: no sealed pocket, anywhere ────────────────────────────────────────
  // The reachability invariant is STRUCTURAL by construction — rooms open onto
  // a floor that touches the entry — but nothing asserted it whole-zone, so a
  // partitioner that walls a pocket off would compile silently. Measured: an
  // inverted wander box passes the entire suite without this.
  for (const zone of Object.values(w.zones)) {
    // INTERIORS ONLY. Measured on staging: 0 of 133 interiors and floors have a
    // sealed pocket, while 2 of 20 settlement exteriors do (worst 19 tiles) —
    // scenery fenced in by trees or buildings, which costs nothing because
    // nobody is ever placed there. An interior pocket strands whoever is in it,
    // and the partitioner is about to start cutting interiors up.
    if (!zone.spawn || zone.mapKind === "settlement") continue;
    const reached = floodFill(zone, zone.spawn);
    let walkable = 0;
    for (let i = 0; i < zone.solid.length; i++) if (!zone.solid[i]) walkable++;
    assert.equal(
      reached.size,
      walkable,
      `${label}: ${zone.id} (${zone.name}) has ${walkable - reached.size} walkable tiles sealed off from its own spawn`,
    );
  }
  // Every OPEN span is a legal rect inside its zone. `areas` carries no door and
  // is never walled, so nothing else would notice a malformed one.
  for (const zone of Object.values(w.zones)) {
    for (const area of zone.areas ?? []) {
      assert.ok(
        area.x0 <= area.x1 &&
          area.y0 <= area.y1 &&
          area.x0 >= 0 &&
          area.y0 >= 0 &&
          area.x1 < zone.w &&
          area.y1 < zone.h,
        `${label}: ${zone.id} has a malformed open area ${JSON.stringify(area)}`,
      );
    }
  }
  // ── I3b: every door a portal promises is still a door ─────────────────────
  // The passes that lay parks, ward squares and kitchen gardens CLEAR the ground
  // they take, and none of them checks what is standing there first — they are
  // handed leftover lots and trust that leftover means empty. Measured across 360
  // worlds it always has been. But `clearFootprint` nulls objects, so the day one
  // of them lands on a building it will erase that building's shell and its door
  // while leaving the interior zone and its portal intact: a house you can see
  // the inside of and can no longer enter, and NOTHING else here would notice —
  // the exterior stays reachable, the interior stays reachable, and every NPC
  // still has a bed.
  //
  // So the promise is checked directly, which costs one pass over the portals.
  // From the SETTLEMENT only: a portal between two floors of one building stands
  // on a stair, which is the correct thing for it to stand on.
  for (const zone of Object.values(w.zones)) {
    if (zone.mapKind !== "settlement") continue;
    for (const portal of zone.portals) {
      if (w.zones[portal.toZone]?.mapKind !== "building") continue;
      const at = zone.w * portal.y + portal.x;
      assert.equal(
        zone.object[at],
        "door",
        `${label}: the way into ${portal.toZone} stands on ${zone.object[at] ?? "bare ground"}, not a door`,
      );
    }
  }

  // ── I3c: OUTDOORS, a light stands on the thing that is lit ────────────────
  // Out of doors every `z.lights.push` sits beside the `put()` that placed a
  // window, a well, a stall or a shrine. So a light over bare ground means
  // somebody deleted the object and left the glow behind: the renderer draws a
  // warm radial on empty grass, every night, forever, for that seed. That is
  // exactly what the greens pass did when it cleared a named feature — 32 of 108
  // worlds carried one.
  //
  // INDOORS IT IS NOT A RULE, and this was measured rather than assumed before
  // the exclusion was written: a cellar is lit at (11,2) with nothing under it
  // and a farmhouse lights its rug, on this branch and on staging alike. Those
  // are lanterns, and a room may be lit without something standing in the middle
  // of it. Rate per building is 0.23 here against 0.31 on staging, so nothing has
  // regressed; extending this check indoors would fail 55 honest buildings.
  for (const zone of Object.values(w.zones)) {
    if (zone.mapKind !== "settlement" && zone.mapKind !== "place") continue;
    for (const light of zone.lights ?? []) {
      const at = zone.w * light.y + light.x;
      assert.ok(zone.object[at], `${label}: ${zone.id} lights ${light.x},${light.y}, where nothing stands`);
    }
  }

  // ── I4: the paint contract ────────────────────────────────────────────────
  // Three passes paint across ground another pass already owns, and `put()`
  // overwrites without asking. Every one of these was live in a shipped build and
  // NONE of them failed an assertion — they are invisible to geometry,
  // reachability and occupancy alike, and visible immediately to a player.
  //
  // Checked on the settlement itself rather than in one fixture, because the
  // faults appear at particular ranks, prosperities and place orders, and a case
  // that names its own inputs is exactly the case that misses them.
  {
    const v = w.zones.z1;
    if (v && v.mapKind === "settlement") {
      const midX = (v.w / 2) | 0;
      const midY = (v.h / 2) | 0;
      for (let y = 0; y < v.h; y++) {
        for (let x = 0; x < v.w; x++) {
          const at = v.w * y + x;
          const roof = v.overhead[at] === "roof" || v.overhead[at] === "roofEdge";
          // (a) A ROOFLINE OVER PUBLIC GROUND. Overhead composites over actors, so
          // a roofed street is one a player walks down invisibly. Tested by
          // POSITION: a `struggling` settlement scuffs its road to `dirt` and a
          // `thriving` one paves its plaza `stone`, so the ground id lies.
          // A building's own body may stand on the plaza's outer ring — that is
          // the allocator's business and not a paint fault — so solid tiles are
          // excluded and only the OVERHANG is asserted.
          const onRoad =
            (y >= midY - 1 && y <= midY && x >= 2 && x < v.w - 2) ||
            (x >= midX - 1 && x <= midX && y >= 2 && y < v.h - 2);
          if (roof && onRoad && !v.solid[at]) {
            assert.fail(`${label}: a roofline overhangs the road at ${x},${y}`);
          }
          // (b) A ROOFLINE OVER SOMEBODY'S DOORSTEP. The tile under a door is
          // where that household stands to be spoken to.
          if (roof && y > 0 && v.object[v.w * (y - 1) + x] === "door" && !v.solid[at]) {
            assert.fail(`${label}: a roofline covers the doorstep at ${x},${y}`);
          }
          // (b2) A ROOFLINE ON SOMEBODY'S FRONT WALL. Lots are eight rows apart
          // and a body is five tall, so a sanctuary that rises two paints its
          // eave onto `slotY - 4` — the wall row of the lot above it — and that
          // building's whole frontage is drawn under a neighbour's roof.
          if (roof && v.object[at] === "wall") {
            assert.fail(`${label}: a roofline lies on a front wall at ${x},${y}`);
          }
          // (c) A TREE YOU CAN WALK THROUGH. A ground fill clears solidity; a
          // trunk painted before it is still drawn and no longer there.
          if (v.object[at] === "trunk" && !v.solid[at]) {
            assert.fail(`${label}: a trunk at ${x},${y} is drawn but walk-through`);
          }
          // (d) A CANOPY OVER NOTHING. A canopy sits on its trunk's tile (the
          // border ring) or one row above it; anything else is a crown hanging in
          // the air where something overwrote the trunk and left the crown.
          if (v.overhead[at] === "canopy") {
            const onTrunk = v.object[at] === "trunk";
            const overTrunk = y + 1 < v.h && v.object[v.w * (y + 1) + x] === "trunk";
            if (!onTrunk && !overTrunk) assert.fail(`${label}: a canopy floats at ${x},${y}`);
          }
        }
      }
    }
  }

  // ── I2: the apron row is walkable at the door columns ─────────────────────
  // Row h-2 carries zone.spawn AND both stair tiles, and put() overwrites
  // unconditionally, so a wall laid across it makes a storey unreachable.
  for (const zone of Object.values(w.zones)) {
    // By mapKind, not by the SHAPE of the id. `z\d+` also matches the wilds,
    // whose row h-2 is forest floor and carries no spawn and no stairs — one
    // scattered trunk landing there read as a paved-over service row and failed
    // a case about building interiors. Only a building has a service row.
    if (zone.mapKind !== "building") continue;
    const c = (zone.w / 2) | 0;
    for (const x of [c - 1, c, c + 1]) {
      assert.ok(
        !zone.solid[zone.w * (zone.h - 2) + x],
        `${label}: ${zone.id} paved its apron row at ${x},${zone.h - 2} — that row carries the spawn and both stairs`,
      );
    }
  }
  // Every cast member is placed in a real zone, with a legal wander rect.
  const placed = Object.values(w.zones).flatMap((z) => z.npcs.map((n) => n.name));
  for (const member of sealed.cast) assert.ok(placed.includes(member.name), `${label}: ${member.name} placed`);
  for (const zone of Object.values(w.zones)) {
    for (const npc of zone.npcs) {
      assert.ok(
        npc.wander.x0 >= 0 && npc.wander.x1 < zone.w && npc.wander.y0 >= 0 && npc.wander.y1 < zone.h,
        `${label}: ${npc.name} wander inside ${zone.id}`,
      );
      // I3: and not INVERTED. fullZoneBox is a single y-floor over zone.rooms,
      // so a second band can push y0 past y1; walkableIn normalises the corners
      // and the NPC silently ends up on the entry apron instead of in the room.
      assert.ok(
        npc.wander.y0 <= npc.wander.y1 && npc.wander.x0 <= npc.wander.x1,
        `${label}: ${npc.name} has an inverted wander box in ${zone.id} (${JSON.stringify(npc.wander)})`,
      );
      // Never spawned ON a solid tile — a scattered wilds trunk on the zone
      // center used to swallow the NPC anchored there (stepNpcs vets only the
      // tiles it moves TO, so the overlap persists until a lucky step). Bounds
      // first: an out-of-zone index reads undefined from the Uint8Array, and
      // a negated undefined would wave the invalid spawn through (review
      // finding); walkable is exactly 0 — put() only ever writes 0 or 1.
      assert.ok(
        Number.isInteger(npc.x) &&
          npc.x >= 0 &&
          npc.x < zone.w &&
          Number.isInteger(npc.y) &&
          npc.y >= 0 &&
          npc.y < zone.h,
        `${label}: ${npc.name} spawn inside ${zone.id}`,
      );
      assert.equal(zone.solid[zone.w * npc.y + npc.x], 0, `${label}: ${npc.name} spawns walkable in ${zone.id}`);
    }
    // Portals land on walkable tiles in their destination — and the portal's
    // OWN tile must be walkable too, or the player can never step onto it.
    for (const portal of zone.portals) {
      const dest = w.zones[portal.toZone];
      assert.ok(dest, `${label}: portal target ${portal.toZone} exists`);
      assert.ok(!dest.solid[dest.w * portal.toY + portal.toX], `${label}: portal to ${portal.toZone} lands walkable`);
      assert.ok(!zone.solid[zone.w * portal.y + portal.x], `${label}: portal source in ${zone.id} is reachable`);
    }
  }
  // Housing honors the arithmetic (§4.5): every resident the settlement is
  // RESPONSIBLE for has a sleeping place of their own — their household's
  // dwelling, or the live-work premises their family runs.
  //
  // Counted in the SCHEDULE HANDLES, not in doors. A door used to mean a roof
  // and it no longer does: a merged block is one door for several households,
  // and a smithy is a door that is also a home, so a door count can be smaller
  // than the household count and still house everyone. The handles are also the
  // thing that actually has to be right — a bed nobody is sent to is scenery.
  //
  // Every non-resident lives by their standing and is not the settlement's to
  // house; which RESIDENTS it owes a roof is spelled out below the sweep.
  const v = w.zones.z1;
  const bedded = new Map(); // npc id -> the sleeping tile its `home` handle names
  for (const zone of Object.values(w.zones)) {
    for (const npc of zone.npcs) {
      const handle = npc._sched?.home;
      const target = handle && w.zones[handle.zoneId];
      if (!target) continue;
      const { x0, y0 } = handle.wander;
      if (SLEEPS_ON.has(target.object[target.w * y0 + x0])) bedded.set(npc.id, `${handle.zoneId}:${x0},${y0}`);
    }
  }
  // Who the settlement owes a bed: every RESIDENT who lives in one of its
  // BUILDINGS — at the root (a dwelling, or the family trade they live over) and
  // equally one the brief homed at a named place, because `home` naming a place
  // is how a brief says "this person lives here". Scoping this to root-homed
  // residents is what let a chaplain sleep on the floor of her own church.
  //
  // A resident whose named home never claimed a lot is NOT exempt: the building
  // they live in does not exist in this world, so they live in the settlement
  // like anybody else and the town owes them a roof. The one exemption left is a
  // resident homed at a WILDS — they live outdoors and sleep rough, which is what
  // living in the woods is.
  const zoneIdForName = new Map(Object.entries(sealed._ids.zones).map(([id, zoneName]) => [zoneName, id]));
  sealed.cast.forEach((member, index) => {
    if ((member.standing ?? "resident") !== "resident") return;
    if (w.zones[zoneIdForName.get(member.home) ?? "z1"]?.mapKind === "place") return;
    assert.ok(bedded.has(`n${index + 1}`), `${label}: ${member.name} has a sleeping place of their own`);
  });
  // Never the same berth twice: two sprites on one tile makes the lower one
  // un-talkable, which is the whole reason a bed is one tile per sleeper.
  const berths = [...bedded.values()];
  assert.equal(new Set(berths).size, berths.length, `${label}: no berth is dealt to two sleepers`);
  assert.ok(!v.solid[v.w * v.spawn.y + v.spawn.x], `${label}: spawn walkable`);
}

// 10. Both themed default briefs compile with all invariants holding.
for (const theme of ["cozy-village", "sci-fi-colony"]) {
  const sealed = brief.defaults(theme, 424242);
  checkWorld(world.build(424242, theme, sealed), sealed, `defaults(${theme})`);
}

// 11. The farm-village case compiles: thirty souls -> a village's worth of roofs,
// never thirty of them. The bound used to be "four-ish", because the four named
// households were the entire population; a brief that said thirty people lived
// here built four houses and the number was decoration. The compiler now mints
// the rest of the village, so the honest claim is about the RATIO — people live
// several to a household, and a door per soul would be a suburb of bedsits.
{
  const sealed = brief.validate(
    {
      scale: "village",
      name: "Mossbrook",
      backgroundPopulation: 30,
      places: [
        { kind: "hall", name: "The Grange Hall" },
        { kind: "gathering", name: "The Wet Boot" },
      ],
      cast: [
        { name: "Alder", role: "mayor", kind: "leader", tint: "blue", home: "Mossbrook", household: 1 },
        { name: "Nessa", role: "daughter", kind: "folk", tint: "violet", home: "Mossbrook", household: 1 },
        { name: "Perrin", role: "innkeep", kind: "host", tint: "amber", home: "The Wet Boot", household: 2 },
        { name: "Sera", role: "weaver", kind: "elder", tint: "rose", home: "Mossbrook", household: 3 },
        { name: "Brint", role: "farmhand", kind: "grower", tint: "green", home: "Mossbrook", household: 4 },
        { name: "Marla", role: "farmhand", kind: "grower", tint: "teal", home: "Mossbrook", household: 4 },
      ],
    },
    ctx,
  );
  const w = world.build(424242, "cozy-village", sealed);
  checkWorld(w, sealed, "mossbrook");
  const v = w.zones.z1;
  const doorCount = v.object.filter((t) => t === "door").length;
  assert.ok(doorCount >= 4, `every named household got a roof (${doorCount} doors)`);
  assert.ok(
    doorCount <= Math.ceil(sealed.backgroundPopulation / 2),
    `thirty souls are not thirty households (${doorCount} doors for ${sealed.backgroundPopulation} people)`,
  );
  assert.ok(w.zones.z2 && w.zones.z3, "hall and gathering interiors compiled");
  // The only fixture that proves home-to-zone binding for a NON-root home:
  // resolve the gathering's ordinal id and assert membership in THAT zone.
  const gatheringId = Object.entries(sealed._ids.zones).find(([, zoneName]) => zoneName === "The Wet Boot")?.[0];
  assert.ok(gatheringId, "the gathering has an ordinal id");
  const innkeeper = w.zones[gatheringId].npcs.find((n) => n.name === "Perrin");
  assert.ok(innkeeper, "the innkeeper lives in the gathering interior");
}

// 11b. Standing: non-residents get no dwelling and anchor to a rest spot —
// transient → a public loiter spot, fringe → the wilds, destitute → the plaza.
{
  const sealed = brief.validate(
    {
      scale: "village",
      name: "Crossford",
      places: [
        { kind: "gathering", name: "The Ford Inn" },
        { kind: "wilds", name: "The Reach" },
      ],
      cast: [
        { name: "Alder", role: "reeve", kind: "leader", tint: "blue", home: "Crossford", household: 1 },
        { name: "Bram", role: "smith", kind: "maker", tint: "amber", home: "Crossford", household: 2 },
        {
          name: "Sil",
          role: "wayfarer",
          kind: "wanderer",
          tint: "green",
          home: "Crossford",
          household: 3,
          standing: "transient",
        },
        {
          name: "Wyn",
          role: "hermit",
          kind: "wanderer",
          tint: "teal",
          home: "Crossford",
          household: 4,
          standing: "fringe",
        },
        {
          name: "Gad",
          role: "beggar",
          kind: "folk",
          tint: "rose",
          home: "Crossford",
          household: 5,
          standing: "destitute",
        },
        {
          name: "Rue",
          role: "weaver",
          kind: "elder",
          tint: "violet",
          home: "Crossford",
          household: 2,
          standing: "nonsense",
        },
      ],
    },
    ctx,
  );
  // Fold: omitted → resident, unknown → resident, valid values preserved.
  const by = (name) => sealed.cast.find((c) => c.name === name);
  assert.equal(by("Alder").standing, "resident", "omitted standing defaults to resident");
  assert.equal(by("Rue").standing, "resident", "unknown standing folds to resident");
  assert.equal(by("Sil").standing, "transient", "valid standing preserved");
  assert.equal(by("Wyn").standing, "fringe", "valid standing preserved");
  assert.equal(by("Gad").standing, "destitute", "valid standing preserved");

  const w = world.build(424242, "cozy-village", sealed);
  checkWorld(w, sealed, "standing");
  const v = w.zones.z1;
  const innId = Object.entries(sealed._ids.zones).find(([, n]) => n === "The Ford Inn")?.[0];
  const woodsId = Object.entries(sealed._ids.zones).find(([, n]) => n === "The Reach")?.[0];
  assert.ok(innId && woodsId, "the inn and the wilds have ordinal ids");
  assert.ok(
    w.zones[woodsId].npcs.some((n) => n.name === "Wyn"),
    "fringe retreats to the wilds",
  );
  const gad = v.npcs.find((n) => n.name === "Gad");
  assert.ok(gad, "destitute stays in the settlement");
  const mX = (v.w / 2) | 0;
  const mY = (v.h / 2) | 0;
  assert.deepEqual(
    gad.wander,
    { x0: mX - 6, y0: mY - 5, x1: mX + 6, y1: mY + 5 },
    "destitute anchors to the public center, never a house",
  );
  assert.ok(!v.npcs.some((n) => n.name === "Wyn"), "the fringe NPC leaves the settlement for the wilds");

  // Walkable-spawn regression: seed 6 scatters a trunk exactly on the wilds
  // center tile (17,11), where the fringe hermit anchors — before the spawn
  // nudge Wyn spawned INSIDE it (checkWorld's walkable-spawn assert catches
  // the overlap; ~7% of seeds reproduced it on this fixture).
  checkWorld(world.build(6, "cozy-village", sealed), sealed, "standing-solid-center");
}

// 11c. Standing SUPPRESSION + the no-inn / no-wilds fallbacks. A non-resident
// holding a special-kind that no resident claims builds nothing; non-resident
// households add no roof; and with no gathering/wilds present, transient falls
// back to the plaza and fringe to the settlement's outer margin.
//
// The roof half used to pin an exact door count, which stopped being a statement
// about non-residents the moment the compiler began minting residents of its own
// — the number moved for a reason the fixture was not about. It now measures the
// DIFFERENCE the non-residents make, which is what "adds no roof" always meant
// and is a tighter assertion besides: it fails if they add a door OR take one.
const wayrestCast = [
  { name: "Ada", role: "elder", kind: "folk", tint: "blue", home: "Wayrest", household: 1 },
  { name: "Ben", role: "cooper", kind: "folk", tint: "amber", home: "Wayrest", household: 2 },
  { name: "Cal", role: "digger", kind: "folk", tint: "green", home: "Wayrest", household: 3 },
];
{
  const sealed = brief.validate(
    {
      scale: "village",
      name: "Wayrest",
      places: [{ kind: "hall", name: "The Moot Hall" }],
      cast: [
        { name: "Ada", role: "elder", kind: "folk", tint: "blue", home: "Wayrest", household: 1 },
        { name: "Ben", role: "cooper", kind: "folk", tint: "amber", home: "Wayrest", household: 2 },
        { name: "Cal", role: "digger", kind: "folk", tint: "green", home: "Wayrest", household: 3 },
        {
          name: "Dov",
          role: "sellsword",
          kind: "guard",
          tint: "red",
          home: "Wayrest",
          household: 4,
          standing: "transient",
        },
        {
          name: "Esk",
          role: "hermit",
          kind: "wanderer",
          tint: "teal",
          home: "Wayrest",
          household: 5,
          standing: "fringe",
        },
        {
          name: "Fyn",
          role: "beggar",
          kind: "folk",
          tint: "rose",
          home: "Wayrest",
          household: 6,
          standing: "destitute",
        },
      ],
    },
    ctx,
  );
  const w = world.build(4242, "cozy-village", sealed);
  checkWorld(w, sealed, "standing-suppression");
  const v = w.zones.z1;
  // The same settlement with the non-residents struck out. The transient guard's
  // "post" is suppressed and no non-resident household adds a dwelling, so the
  // two towns must have exactly the same doors in them; deleting either the
  // specials gate or the households filter separates the counts.
  const residentsOnly = brief.validate(
    { scale: "village", name: "Wayrest", places: [{ kind: "hall", name: "The Moot Hall" }], cast: wayrestCast },
    ctx,
  );
  const doorCount = v.object.filter((t) => t === "door").length;
  const controlDoors = world
    .build(4242, "cozy-village", residentsOnly)
    .zones.z1.object.filter((t) => t === "door").length;
  assert.equal(
    doorCount,
    controlDoors,
    `only residents build (${doorCount} doors with the non-residents, ${controlDoors} without)`,
  );
  assert.equal(v.object.filter((t) => t === "table").length, 0, "a transient non-merchant lays no stall");
  assert.ok(!Object.values(w.zones).some((z) => z.mapKind === "place"), "no wilds synthesized (places is non-empty)");
  const mX = (v.w / 2) | 0;
  const mY = (v.h / 2) | 0;
  const plaza = { x0: mX - 6, y0: mY - 5, x1: mX + 6, y1: mY + 5 };
  const wander = (name) => v.npcs.find((n) => n.name === name).wander;
  assert.deepEqual(wander("Dov"), plaza, "transient with no inn falls back to the plaza");
  assert.deepEqual(
    wander("Esk"),
    { x0: 3, y0: v.h - 6, x1: v.w - 4, y1: v.h - 3 },
    "fringe with no wilds falls back to the outer margin",
  );
  assert.deepEqual(wander("Fyn"), plaza, "destitute anchors to the public center");
}

// 11d. Transient merchants set up a light market stall (a 3-table structure,
// never a permanent shop) and tend it. A transient non-merchant, or a merchant
// with no free lot, does not.
{
  const sealed = brief.validate(
    {
      scale: "village",
      name: "Fairmarket",
      cast: [
        { name: "Ona", role: "elder", kind: "folk", tint: "blue", home: "Fairmarket", household: 1 },
        { name: "Pel", role: "cooper", kind: "folk", tint: "green", home: "Fairmarket", household: 2 },
        { name: "Rin", role: "weaver", kind: "folk", tint: "amber", home: "Fairmarket", household: 3 },
        {
          name: "Sol",
          role: "spice trader",
          kind: "merchant",
          tint: "rose",
          home: "Fairmarket",
          household: 4,
          standing: "transient",
        },
      ],
    },
    ctx,
  );
  const w = world.build(4242, "cozy-village", sealed);
  checkWorld(w, sealed, "merchant-stall");
  const v = w.zones.z1;
  // One transient merchant -> exactly one 3-table stall in the settlement.
  const tables = v.object.filter((t) => t === "table").length;
  assert.equal(tables, 3, `the transient merchant set up a 3-table stall (got ${tables})`);
  const sol = v.npcs.find((n) => n.name === "Sol");
  assert.ok(sol, "the transient merchant tends the stall in the settlement");
  // Tending it: the tile directly above the merchant's counter is a stall table.
  assert.equal(v.object[v.w * (sol.y - 1) + sol.x], "table", "the merchant stands at their stall counter");
}

// 11e. Transients loiter at PUBLIC spots and spread across them. With an inn, a
// resident shop, and three transients (three spots), the seeded round-robin puts
// one inside the inn, one at the shop front, and one in the plaza.
{
  const sealed = brief.validate(
    {
      scale: "village",
      name: "Tradeholm",
      places: [{ kind: "gathering", name: "The Rest" }],
      cast: [
        { name: "Ada", role: "elder", kind: "folk", tint: "blue", home: "Tradeholm", household: 1 },
        { name: "Ben", role: "farmer", kind: "folk", tint: "green", home: "Tradeholm", household: 2 },
        { name: "Cor", role: "shopkeep", kind: "merchant", tint: "amber", home: "Tradeholm", household: 3 },
        {
          name: "Vye",
          role: "pilgrim",
          kind: "scholar",
          tint: "teal",
          home: "Tradeholm",
          household: 4,
          standing: "transient",
        },
        {
          name: "Wil",
          role: "drifter",
          kind: "wanderer",
          tint: "rose",
          home: "Tradeholm",
          household: 5,
          standing: "transient",
        },
        {
          name: "Xio",
          role: "envoy",
          kind: "elder",
          tint: "violet",
          home: "Tradeholm",
          household: 6,
          standing: "transient",
        },
      ],
    },
    ctx,
  );
  const w = world.build(99, "cozy-village", sealed);
  checkWorld(w, sealed, "loiter-spread");
  const v = w.zones.z1;
  const innId = Object.entries(sealed._ids.zones).find(([, n]) => n === "The Rest")?.[0];
  const mX = (v.w / 2) | 0;
  const mY = (v.h / 2) | 0;
  const plaza = JSON.stringify({ x0: mX - 6, y0: mY - 5, x1: mX + 6, y1: mY + 5 });
  const names = ["Vye", "Wil", "Xio"];
  const inInn = names.filter((n) => w.zones[innId].npcs.some((x) => x.name === n));
  assert.equal(inInn.length, 1, "one transient loiters inside the inn");
  const inV = names.filter((n) => v.npcs.some((x) => x.name === n)).map((n) => v.npcs.find((x) => x.name === n));
  assert.equal(inV.length, 2, "the other two loiter out in the settlement");
  assert.equal(inV.filter((t) => JSON.stringify(t.wander) === plaza).length, 1, "one loiters in the plaza");
  const atShop = inV.filter((t) => JSON.stringify(t.wander) !== plaza);
  assert.equal(atShop.length, 1, "one loiters at the shop front");
  const s = atShop[0];
  // Beside the door, not in it: the shop door sits up-and-left of the loiter box.
  assert.equal(
    v.object[v.w * (s.wander.y0 - 1) + (s.wander.x0 - 1)],
    "door",
    "the shop-loiterer stands beside a shop door, not in the doorway",
  );
}

// 11f. A transient merchant with NO free lot lays no stall and still loiters at
// a public spot.
//
// RE-SHAPED. This used to starve a VILLAGE, whose rows fit six lots, with six
// claimants. A village now lays sixteen and the housing arithmetic holds a lot
// back for the market besides, so the old shape stopped reaching the fallback —
// it asserted an outcome the compiler was no longer capable of producing. An
// OUTPOST is the small ground now: four lots against a hall, a gathering, the
// farm, the watch post and six households is a settlement that is genuinely
// full, which is the only honest way to ask what happens when a trader arrives
// and there is nowhere to stand.
{
  const sealed = brief.validate(
    {
      scale: "outpost",
      name: "Fullford",
      // A hall and NO gathering: the second half of this fixture is that the
      // stall-less trader still stands somewhere public, and an inn would give
      // him somewhere else to be — the transient fallback prefers a bed over a
      // square, so adding one quietly stops testing the plaza.
      places: [{ kind: "hall", name: "The Moot" }],
      cast: [
        { name: "Ona", role: "reeve", kind: "leader", tint: "blue", home: "Fullford", household: 1 },
        { name: "Pel", role: "farmer", kind: "grower", tint: "green", home: "Fullford", household: 2 },
        { name: "Gar", role: "watch", kind: "guard", tint: "red", home: "Fullford", household: 3 },
        { name: "Tam", role: "cooper", kind: "folk", tint: "amber", home: "Fullford", household: 5 },
        { name: "Ivy", role: "weaver", kind: "folk", tint: "teal", home: "Fullford", household: 6 },
        { name: "Rue", role: "digger", kind: "folk", tint: "violet", home: "Fullford", household: 7 },
        {
          name: "Sol",
          role: "peddler",
          kind: "merchant",
          tint: "rose",
          home: "Fullford",
          household: 4,
          standing: "transient",
        },
      ],
    },
    ctx,
  );
  const w = world.build(4242, "cozy-village", sealed);
  checkWorld(w, sealed, "stall-no-lot");
  const v = w.zones.z1;
  assert.equal(v.object.filter((t) => t === "table").length, 0, "no free lot -> the transient merchant lays no stall");
  const sol = v.npcs.find((n) => n.name === "Sol");
  assert.ok(sol, "the merchant still loiters at a public spot");
  const mX = (v.w / 2) | 0;
  const mY = (v.h / 2) | 0;
  assert.deepEqual(sol.wander, { x0: mX - 6, y0: mY - 5, x1: mX + 6, y1: mY + 5 }, "falls back to the plaza");
}

// 11g. A shop with an interior (a workshop) — a loitering transient browses
// INSIDE it (the mechanism the inn already uses); facade shops keep them outside.
{
  const sealed = brief.validate(
    {
      scale: "village",
      name: "Forgeton",
      places: [{ kind: "workshop", name: "The Forge" }],
      cast: [
        { name: "Ada", role: "elder", kind: "folk", tint: "blue", home: "Forgeton", household: 1 },
        { name: "Ben", role: "cooper", kind: "folk", tint: "green", home: "Forgeton", household: 2 },
        { name: "Cor", role: "smith", kind: "maker", tint: "amber", home: "The Forge", household: 3 },
        {
          name: "Vye",
          role: "pilgrim",
          kind: "scholar",
          tint: "teal",
          home: "Forgeton",
          household: 4,
          standing: "transient",
        },
        {
          name: "Wil",
          role: "drifter",
          kind: "wanderer",
          tint: "rose",
          home: "Forgeton",
          household: 5,
          standing: "transient",
        },
      ],
    },
    ctx,
  );
  const w = world.build(99, "cozy-village", sealed);
  checkWorld(w, sealed, "shop-interior");
  const forgeId = Object.entries(sealed._ids.zones).find(([, n]) => n === "The Forge")?.[0];
  assert.ok(forgeId, "the workshop shop has an ordinal id");
  const inForge = ["Vye", "Wil"].filter((n) => w.zones[forgeId].npcs.some((x) => x.name === n));
  assert.equal(inForge.length, 1, "one transient browses inside the workshop shop; the other loiters elsewhere");
}

// 11h. The dwelling gate is home-aware: a resident who lives at the root gets a town
// house, but a resident whose home is the wilds (a forager who lives in the woods)
// sleeps THERE and mints NO phantom settlement dwelling. With an all-folk cast (no
// special buildings) at/above castMin (no stock top-up) and only a wilds place (no
// interior facades), every z1 door is a dwelling — so the door count equals the
// DISTINCT ROOT-resident households exactly; the wilds resident adds none. (checkWorld
// only asserts >=; this pins the equality that a gate regression would break.)
{
  const sealed = brief.validate(
    {
      scale: "village",
      name: "Wold",
      places: [{ kind: "wilds", name: "The Fen" }],
      cast: [
        { name: "Ana", role: "reeve", kind: "folk", tint: "blue", home: "Wold", household: 1 },
        { name: "Bo", role: "cooper", kind: "folk", tint: "green", home: "Wold", household: 2 },
        { name: "Cy", role: "weaver", kind: "folk", tint: "amber", home: "Wold", household: 3 },
        { name: "Del", role: "carter", kind: "folk", tint: "rose", home: "Wold", household: 4 },
        { name: "Fenn", role: "forager", kind: "folk", tint: "teal", home: "The Fen", household: 5 },
      ],
    },
    ctx,
  );
  const w = world.build(7, "cozy-village", sealed);
  checkWorld(w, sealed, "dwelling-gate");
  const v = w.zones.z1;
  const rootName = sealed._ids.zones.z1;
  const rootHouseholds = new Set(
    sealed.cast.filter((c) => c.home === rootName && (c.standing ?? "resident") === "resident").map((c) => c.household),
  );
  // The forager adds no door. Measured as a difference rather than against
  // `rootHouseholds.size` directly, because the sealed cast stopped being the
  // whole population when the compiler began minting residents of its own — the
  // count moved for a reason this fixture is not about. The claim under test is
  // that a resident who lives in the fen costs the settlement no roof, and a
  // difference says exactly that.
  const doorCount = v.object.filter((t) => t === "door").length;
  const withoutForager = brief.validate(
    {
      scale: "village",
      name: "Wold",
      places: [{ kind: "wilds", name: "The Fen" }],
      cast: sealed.cast.filter((c) => c.home !== "The Fen"),
    },
    ctx,
  );
  const controlDoors = world
    .build(7, "cozy-village", withoutForager)
    .zones.z1.object.filter((t) => t === "door").length;
  assert.equal(
    doorCount,
    controlDoors,
    `a door per root household, none for the wilds resident (${doorCount} doors with the forager, ${controlDoors} without)`,
  );
  assert.equal(rootHouseholds.size, 4, "the fixture still names four root households");
  const fenId = Object.entries(sealed._ids.zones).find(([, n]) => n === "The Fen")[0];
  assert.ok(
    w.zones[fenId].npcs.some((n) => n.name === "Fenn"),
    "the wilds resident lives (and sleeps) out in the wilds zone, not in an empty town house",
  );
}

// 11i. Scattered trees never land under a building's roof overhang — the overhang
// rows are grass and non-solid, so only an explicit overhead-layer guard keeps a
// trunk from being drawn under (and visually eaten by) a roof. Swept across seeds.
{
  for (let seed = 1; seed <= 60; seed++) {
    const sealed = brief.validate(
      {
        scale: "village",
        name: "Timbrel",
        surround: "woods",
        cast: [
          { name: "Ada", role: "reeve", kind: "leader", tint: "blue", home: "Timbrel", household: 1 },
          { name: "Ben", role: "smith", kind: "maker", tint: "green", home: "Timbrel", household: 2 },
          { name: "Ces", role: "farmer", kind: "grower", tint: "amber", home: "Timbrel", household: 3 },
          { name: "Dan", role: "carter", kind: "folk", tint: "rose", home: "Timbrel", household: 4 },
        ],
      },
      ctx,
    );
    const v = world.build(seed, "cozy-village", sealed).zones.z1;
    // Guard against a trivially-passing check: the world must actually have roofs.
    assert.ok(
      v.overhead.some((t) => t === "roof" || t === "roofEdge"),
      `seed ${seed}: has roofs to test against`,
    );
    for (let i = 0; i < v.object.length; i++) {
      if (v.object[i] !== "trunk") continue;
      const oh = v.overhead[i];
      assert.ok(oh !== "roof" && oh !== "roofEdge", `seed ${seed}: no trunk under a roof (tile ${i} overhead ${oh})`);
    }
  }
}

// 11j. The stall pass handles MORE than one transient merchant: given free lots for
// both, each lays its own 3-table stall and tends it — the loop does not stop at one.
{
  const sealed = brief.validate(
    {
      scale: "town",
      name: "Twomarket",
      cast: [
        { name: "Ona", role: "elder", kind: "folk", tint: "blue", home: "Twomarket", household: 1 },
        {
          name: "Sol",
          role: "spice trader",
          kind: "merchant",
          tint: "rose",
          home: "Twomarket",
          household: 2,
          standing: "transient",
        },
        {
          name: "Tam",
          role: "silk trader",
          kind: "merchant",
          tint: "teal",
          home: "Twomarket",
          household: 3,
          standing: "transient",
        },
      ],
    },
    ctx,
  );
  const w = world.build(4242, "cozy-village", sealed);
  checkWorld(w, sealed, "two-merchants");
  const v = w.zones.z1;
  assert.equal(v.object.filter((t) => t === "table").length, 6, "two transient merchants -> two 3-table stalls");
  for (const name of ["Sol", "Tam"]) {
    const m = v.npcs.find((n) => n.name === name);
    assert.ok(m, `${name} is placed`);
    assert.equal(v.object[v.w * (m.y - 1) + m.x], "table", `${name} stands at their own stall counter`);
  }
}

// 12. Determinism: same brief + seed → structurally identical world.
{
  const sealed = brief.defaults("cozy-village", 7);
  const a = world.build(7, "cozy-village", sealed);
  const b = world.build(7, "cozy-village", sealed);
  assert.equal(JSON.stringify(a.zones.z1.ground), JSON.stringify(b.zones.z1.ground), "compile is deterministic");
}

// 13. Legacy path untouched: no brief → the fixed three-zone world.
{
  const w = world.build(424242, "cozy-village");
  assert.deepEqual(Object.keys(w.zones).sort(), ["forest", "inn", "village"], "legacy zones for pre-brief saves");
}

// 14. §7 injection discipline: prose rides the world; the prefix meters it once.
{
  const sealed = brief.validate(
    {
      scale: "village",
      name: "Meterton",
      flavor: "Dust and patience.",
      situation: "Foreman Vex is hiding the cracked dome report from surveyor Yun.",
      places: [{ kind: "gathering", name: "The Bar", flavor: "Low lights, long tabs." }],
      cast: [
        {
          name: "Vex",
          role: "foreman",
          kind: "leader",
          tint: "red",
          home: "Meterton",
          household: 1,
          persona: "Wants quota; hiding the report.",
        },
        {
          name: "Yun",
          role: "surveyor",
          kind: "scholar",
          tint: "teal",
          home: "Meterton",
          household: 2,
          persona: "Wants truth; hiding the source.",
        },
        { name: "Bel", role: "barkeep", kind: "host", tint: "amber", home: "The Bar", household: 3, persona: "" },
        { name: "Six", role: "runner", kind: "wanderer", tint: "violet", home: "Meterton", household: 4, persona: "" },
      ],
    },
    ctx,
  );
  const w = world.build(424242, "sci-fi-colony", sealed);
  assert.equal(w.situation, sealed.situation, "situation rides the world");
  assert.equal(w.zones.z2.flavor, "Low lights, long tabs.", "zone flavor rides the zone");
  // A minimal sim stub exercising composePrefix without the full Sim class.
  const sim = {
    world: w,
    zoneId: "z1",
    nearNpc: null,
    dirty: false,
    zone() {
      return this.world.zones[this.zoneId];
    },
    clockLabel: () => "Day 1 · 08:00",
    daypart: () => "day",
  };
  // Borrow the real methods off the shipped Sim prototype.
  sim.header = loadedPF.Sim.prototype.header.bind(sim);
  sim.composePrefix = loadedPF.Sim.prototype.composePrefix.bind(sim);
  sim.commitIntro = loadedPF.Sim.prototype.commitIntro.bind(sim);
  const npcVex = Object.values(w.zones)
    .flatMap((z) => z.npcs)
    .find((n) => n.name === "Vex");
  const first = sim.composePrefix(npcVex);
  assert.ok(first.includes("[Setting: Foreman Vex is hiding"), "situation injected on the first message");
  assert.ok(first.includes("[Vex: Wants quota"), "persona injected on first talk");
  // Compose is PURE: a refused/failed send must not burn the prose (review
  // finding) — only commitIntro(), called when the host accepts, does.
  assert.equal(sim.dirty, false, "compose alone never dirties the save");
  const retry = sim.composePrefix(npcVex);
  assert.ok(retry.includes("[Setting:") && retry.includes("Wants quota"), "uncommitted prose survives for a retry");
  sim.commitIntro();
  assert.ok(sim.dirty, "the accepted turn burns the flags and dirties the save");
  const second = sim.composePrefix(npcVex);
  assert.ok(!second.includes("[Setting:"), "situation never re-injected");
  assert.ok(!second.includes("Wants quota"), "persona never re-injected for the same NPC");
  sim.commitIntro(); // a prose-free prefix commits as a no-op
  sim.zoneId = "z2";
  const barEntry = sim.composePrefix(null);
  assert.ok(barEntry.includes("[The Bar: Low lights"), "zone flavor injected once on first entry");
  sim.commitIntro();
  assert.ok(!sim.composePrefix(null).includes("Low lights"), "zone flavor not repeated");
}

// 15. salvageText: fences, chatter, string-aware spans, truncated tails.
{
  const fenced = brief.salvageText('```json\n{"scale":"village","name":"Salv"}\n```');
  assert.equal(fenced?.name, "Salv", "fences stripped, object parsed");
  const wrapped = brief.salvageText('Sure! Here is the world: {"name":"Wrap","cast":[]} Hope you like it.');
  assert.equal(wrapped?.name, "Wrap", "outermost balanced span extracted from chatter");
  const braces = brief.salvageText('{"name":"Brace {not a block}","cast":[]}');
  assert.equal(braces?.name, "Brace {not a block}", "braces inside strings don't derail the scanner");
  const truncated = brief.salvageText('{"name":"Cut","cast":[{"name":"A","kind":"folk"},{"name":"B","ki');
  assert.equal(truncated?.name, "Cut", "truncated document closed and parsed");
  assert.deepEqual(truncated.cast[0], { name: "A", kind: "folk" }, "complete array elements survive the cut");
  assert.ok(
    truncated.cast.every((c) => !("ki" in c)),
    "the partial trailing field is dropped",
  );
  assert.equal(brief.salvageText("no json here"), null, "no object → null");
  assert.equal(brief.salvageText(""), null, "empty → null");
}

// 16. Leader hoist: a leader past the cast cap is kept, not silently dropped.
{
  const rawCast = [];
  for (let i = 0; i < 11; i++) {
    rawCast.push({ name: `Villager ${i}`, kind: "folk", tint: "green", home: "Hoistton", household: (i % 6) + 1 });
  }
  rawCast.push({ name: "Mayor Last", kind: "leader", tint: "blue", home: "Hoistton", household: 1 });
  const sealed = brief.validate({ scale: "village", name: "Hoistton", cast: rawCast }, ctx);
  assert.ok(sealed.cast.length <= brief.CAPS.castMax, "cast capped");
  assert.ok(
    sealed.cast.some((c) => c.name === "Mayor Last" && c.kind === "leader"),
    "the leader is hoisted into the kept set",
  );
}

// 17. Host synthesis: a host with no gathering place gets an interior to keep.
{
  const sealed = brief.validate(
    {
      scale: "village",
      name: "Hostville",
      places: [{ kind: "wilds", name: "The Briar" }],
      cast: [
        { name: "Perrin", kind: "host", tint: "amber", home: "Hostville", household: 1 },
        { name: "A", kind: "folk", tint: "green", home: "Hostville", household: 2 },
        { name: "B", kind: "folk", tint: "blue", home: "Hostville", household: 3 },
        { name: "C", kind: "folk", tint: "rose", home: "Hostville", household: 4 },
      ],
    },
    ctx,
  );
  const gathering = sealed.places.find((p) => p.kind === "gathering");
  assert.ok(gathering, "a gathering interior is synthesized for the host");
  assert.ok(gathering.name.includes("Perrin"), "the synthesized place is named from the host");
}

// 18. Name dedupe holds even when the same name floods several place kinds.
{
  const sealed = brief.validate(
    {
      scale: "village",
      name: "Sameton",
      places: [
        { kind: "gathering", name: "The Same" },
        { kind: "hall", name: "The Same" },
        { kind: "wilds", name: "The Same" },
        { kind: "wilds", name: "the same" },
      ],
      cast: [
        { name: "A", kind: "folk", tint: "green", home: "Sameton", household: 1 },
        { name: "B", kind: "folk", tint: "blue", home: "Sameton", household: 2 },
        { name: "C", kind: "folk", tint: "rose", home: "Sameton", household: 3 },
        { name: "D", kind: "folk", tint: "teal", home: "Sameton", household: 4 },
      ],
    },
    ctx,
  );
  const folded = sealed.places.map((p) => p.name.toLowerCase());
  assert.equal(new Set(folded).size, folded.length, "every collision resolved to a unique name");
  assert.ok(!folded.includes(sealed.name.toLowerCase()), "no place shadows the settlement itself");
}

// 19. A situation with no sentence boundary inside the cap degrades to EMPTY —
// a cut hook is worse than none (§4.2).
{
  const endless = `The foreman is hiding ${"a very long secret about the dome and the survey and the quota ".repeat(6)}forever`;
  const sealed = brief.validate({ scale: "village", name: "Runon", situation: endless, cast: [] }, ctx);
  assert.equal(sealed.situation, "", "clause-losing truncation degrades to empty");
}

// 20. Two wilds: both compile, both are reachable from the settlement and lead
// back (the west-hung wilds mirrors the approach road — review finding).
{
  const sealed = brief.validate(
    {
      scale: "village",
      name: "Twinwood",
      places: [
        { kind: "wilds", name: "East Reach" },
        { kind: "wilds", name: "West Reach" },
        { kind: "gathering", name: "The Hearth" },
      ],
      cast: [
        { name: "A", kind: "host", tint: "amber", home: "The Hearth", household: 1 },
        { name: "B", kind: "folk", tint: "green", home: "Twinwood", household: 2 },
        { name: "C", kind: "folk", tint: "blue", home: "Twinwood", household: 3 },
        { name: "D", kind: "folk", tint: "rose", home: "Twinwood", household: 4 },
      ],
    },
    ctx,
  );
  const w = world.build(424242, "cozy-village", sealed);
  checkWorld(w, sealed, "twinwood");
  const wildsIds = Object.values(w.zones)
    .filter((z) => sealed.places.some((p, i) => p.kind === "wilds" && `z${i + 2}` === z.id))
    .map((z) => z.id);
  assert.equal(wildsIds.length, 2, "both wilds compiled");
  for (const id of wildsIds) {
    assert.ok(
      w.zones.z1.portals.some((p) => p.toZone === id),
      `settlement has a portal to ${id}`,
    );
    assert.ok(
      w.zones[id].portals.some((p) => p.toZone === "z1"),
      `${id} leads back to the settlement`,
    );
  }
}

// 21. Review blocker regression: the spatial seed binding uses the world's OWN
// start zone (compiled worlds key z1..), and a stale binding degrades safely.
{
  const sealed = brief.defaults("cozy-village", 99);
  const w = world.build(99, "cozy-village", sealed);
  const sim = {
    world: w,
    zoneId: w.startZone,
    mode: "walk",
    zone() {
      return this.world.zones[this.zoneId];
    },
    teleport(zoneId) {
      this.zoneId = zoneId;
    },
  };
  let dirtied = false;
  const core = {
    chatId: "chat-spatial",
    sim,
    markDirty: () => {
      dirtied = true;
    },
    hud: { toast() {}, refreshChips() {} },
  };
  loadedPF.api = loadedPF.api ?? {};
  const prevGetSpatial = loadedPF.api.getSpatial;
  loadedPF.api.getSpatial = async () => ({
    definition: { revision: 1 },
    currentLocationId: "loc-root",
    breadcrumb: [{ name: "Rootville" }],
    destinations: [],
  });
  loadedPF.spatial.reset();
  await loadedPF.spatial.refresh(core);
  assert.equal(
    w.bindings["loc-root"],
    "z1",
    "first-seen location binds the compiled start zone, never a legacy literal",
  );
  assert.equal(w.zones.z1.spatialLocationId, "loc-root", "the zone records its location id");
  assert.ok(dirtied, "the seeded binding persists via a save");
  // Narrated drift onto a STALE binding (zone gone) must not throw or teleport.
  w.bindings["loc-ghost"] = "no-such-zone";
  loadedPF.api.getSpatial = async () => ({
    definition: { revision: 1 },
    currentLocationId: "loc-ghost",
    breadcrumb: [{ name: "Ghost" }],
    destinations: [],
  });
  await loadedPF.spatial.refresh(core);
  assert.equal(sim.zoneId, "z1", "a stale binding degrades to staying put");
  // Leave no stub behind: later cases must not inherit this case's spatial state.
  loadedPF.api.getSpatial = prevGetSpatial;
  loadedPF.spatial.reset();
}

// 22-25. The §5 failure ladder (amended): transients leave the chat UNSEALED,
// truncation re-rolls plainly and salvages the longest raw across attempts,
// and only deterministic/paid failures seal the themed default.
{
  loadedPF.api = loadedPF.api ?? {};
  const prevPost = loadedPF.api.postExperienceGeneration;
  const calls = [];
  const stub = (script) => {
    let i = 0;
    loadedPF.api.postExperienceGeneration = async (chatId, body) => {
      calls.push(body);
      return script[Math.min(i++, script.length - 1)];
    };
  };

  // 22. Route absent (old engine) → null: unsealed, the next visit retries.
  calls.length = 0;
  stub([{ status: 404, body: null }]);
  assert.equal(await brief.generate("c", { theme: "cozy-village", seed: 1, preferences: "" }), null, "404 → unsealed");

  // 23. Truncated twice → plain re-roll (NO maxTokens override — the route
  // treats it as min()-only) + longest-raw salvage across both attempts.
  calls.length = 0;
  const longRaw =
    '{"scale":"village","name":"Longton","cast":[{"name":"A","kind":"folk","tint":"red","home":"Longton","household":1},{"name":"B","ki';
  const shortRaw = '{"scale":"village","name":"Shor';
  stub([
    { status: 422, body: { truncated: true, raw: longRaw } },
    { status: 422, body: { truncated: true, raw: shortRaw } },
  ]);
  const salvagedSeal = await brief.generate("c", { theme: "cozy-village", seed: 1, preferences: "p" });
  assert.equal(calls.length, 2, "exactly one re-roll");
  assert.ok(!("maxTokens" in calls[1]), "the re-roll carries no maxTokens override");
  assert.equal(salvagedSeal.name, "Longton", "the LONGEST raw wins the salvage even when the retry's is shorter");
  assert.ok(
    salvagedSeal._repairs.some((r) => r.includes("salvaged")),
    "salvage recorded in _repairs",
  );

  // 24. Deterministic provider failure → sealed themed default (a paid call
  // per visit would be worse than the default world).
  stub([{ status: 422, body: { code: "provider_error", truncated: false } }]);
  const sealedDefault = await brief.generate("c", { theme: "sci-fi-colony", seed: 2, preferences: "" });
  assert.ok(sealedDefault && Array.isArray(sealedDefault.cast), "provider_error seals a full brief");
  assert.equal(sealedDefault.theme, "sci-fi-colony", "the sealed default keeps the theme");

  // 25. 409 chat_busy waits out Retry-After once inside the budget, then
  // succeeds; oversized preferences clamp under the route's 8,000-char cap.
  // busyWaitMs: 0 is the timer seam — the harness never sleeps for real.
  calls.length = 0;
  stub([
    { status: 409, body: { code: "chat_busy" } },
    { status: 200, body: { ok: true, data: { scale: "hamlet", name: "Busyville", cast: [] } } },
  ]);
  const busySeal = await brief.generate("c", {
    theme: "cozy-village",
    seed: 3,
    preferences: "x".repeat(9000),
    busyWaitMs: 0,
  });
  assert.equal(calls.length, 2, "busy → one wait-out retry");
  assert.ok(calls[0].userContent.length <= 7_801, "userContent clamped under the route cap");
  assert.equal(busySeal.name, "Busyville", "the wait-out retry seals the real brief");

  // Leave no stub behind for later cases.
  loadedPF.api.postExperienceGeneration = prevPost;
}

// 26. Sanitizer defeats tag reassembly and never leaks an angle bracket
// (CodeQL js/incomplete-multi-character-sanitization): one-pass stripping
// turns "<scr<b>ipt>" into "<script>", and the old order removed every ">"
// before the tag regex could match anything at all.
{
  const sealed = brief.validate(
    {
      scale: "village",
      name: "<scr<b>ipt>Safeton",
      flavor: "A <script src=//evil.example/x.js quiet place.",
      cast: [],
    },
    ctx,
  );
  for (const text of [sealed.name, sealed.flavor]) {
    assert.ok(!text.includes("<") && !text.includes(">"), `no angle bracket survives sanitize: ${text}`);
    assert.ok(!/<script/i.test(text), "no reassembled script tag");
  }
  assert.ok(sealed.name.includes("Safeton"), "legitimate text survives");
}

// 27. Asset loader chases a theme change that lands mid-load (review finding):
// the loading guard used to drop it, leaving the new theme procedural until an
// unrelated reload.
{
  const prevFetch = globalThis.fetch;
  const prevImage = globalThis.Image;
  const requested = [];
  globalThis.fetch = async (url) => ({
    ok: true,
    json: async () =>
      String(url).includes("sprites.json")
        ? { frameWidth: 12, frameHeight: 16, frames: 4, rows: ["down", "up", "left", "right"], actors: {} }
        : { tileSize: 16, columns: 8, tiles: {} },
  });
  globalThis.Image = class {
    set src(value) {
      requested.push(String(value));
      queueMicrotask(() => {
        this.complete = true;
        this.naturalWidth = 128;
        this.onload?.();
      });
    }
  };
  try {
    const core = { host: { packageId: "pixelforge", packageVersion: "0.4.0" } };
    loadedPF.art.setTheme("cozy-village");
    const first = loadedPF.assets.load(core); // in flight
    loadedPF.art.setTheme("sci-fi-colony");
    void loadedPF.assets.load(core); // hits the loading guard — must be QUEUED, not dropped
    await first;
    for (
      let i = 0;
      i < 40 && !(loadedPF.assets.status === "ready" && loadedPF.assets._requestedTheme === "sci-fi-colony");
      i++
    ) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    assert.equal(loadedPF.assets.status, "ready", "chase load settles");
    assert.equal(loadedPF.assets.atlasTheme, "sci-fi-colony", "the mid-load theme change is chased, not dropped");
    assert.ok(
      requested.some((u) => u.includes("tiles-sci-fi-colony.png")),
      "the themed atlas sheet was requested",
    );
  } finally {
    globalThis.fetch = prevFetch;
    globalThis.Image = prevImage;
    loadedPF.art.setTheme("cozy-village");
  }
}

// 28-30. Capability API 1.12 event consumption (onHostEvent) + the travel
// post-await gating: outcomes resolve instantly, stepwise journeys survive
// intermediate hops, and the event path never double-toasts.
{
  const prevGetSpatial = loadedPF.api.getSpatial;
  const spatialState = { loc: "root", revision: 1 };
  loadedPF.api.getSpatial = async () => ({
    definition: { revision: spatialState.revision },
    currentLocationId: spatialState.loc,
    breadcrumb: [{ name: spatialState.loc }],
    destinations: [],
  });
  const toasts = [];
  const core = {
    chatId: "chat-events",
    sim: {
      world: { zones: {}, bindings: { seeded: true }, startZone: "z1" },
      zoneId: "z1",
      mode: "walk",
      zone() {
        return { name: "z1" };
      },
    },
    markDirty() {},
    hud: { toast: (t) => toasts.push(t), refreshChips() {} },
  };
  const spatial = loadedPF.spatial;
  spatial.reset();
  await spatial.refresh(core); // seed availability + _lastLocationId ("root")

  // 28. committed with a matching commandId resolves the journey instantly.
  spatial.pending = { commandId: "cmd-1", destinationId: "bar", name: "Bar", staleCount: 0 };
  spatialState.loc = "bar";
  spatial.onHostEvent(core, {
    type: "spatial_transition_committed",
    chatId: core.chatId,
    data: { commandId: "cmd-1" },
  });
  assert.equal(spatial.pending, null, "committed event clears the pending journey");
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(spatial._lastLocationId, "bar", "the event-driven refresh applied the new location");

  // 29. stepwise journeys survive intermediate hops; the completing event ends them.
  spatial.pending = { commandId: "cmd-2", destinationId: "far", name: "Far", staleCount: 0 };
  spatial.onHostEvent(core, {
    type: "spatial_transition_committed",
    chatId: core.chatId,
    data: { commandId: "cmd-2", travel: { mode: "step_by_step", complete: false } },
  });
  assert.ok(
    spatial.pending && spatial.pending.stepwise,
    "incomplete stepwise leg keeps (and marks) the pending journey",
  );
  spatialState.loc = "midway";
  await spatial.refresh(core);
  assert.ok(spatial.pending, "an intermediate hop is progress, not supersession");
  spatial.onHostEvent(core, {
    type: "spatial_transition_committed",
    chatId: core.chatId,
    data: { commandId: "cmd-2", travel: { mode: "step_by_step", complete: true } },
  });
  assert.equal(spatial.pending, null, "the completing event ends the stepwise journey");

  // Rejected event: instant clear + toast; stale-count untouched by event refreshes.
  spatial.pending = { commandId: "cmd-3", destinationId: "nope", name: "Nope", staleCount: 0 };
  spatial.onHostEvent(core, {
    type: "spatial_transition_rejected",
    chatId: core.chatId,
    data: { commandId: "cmd-3", code: "spatial_transition_stale_definition" },
  });
  assert.equal(spatial.pending, null, "rejected event clears the journey immediately");
  assert.ok(
    toasts.some((t) => t.includes("stayed put")),
    "rejection toasts immediately",
  );

  // countStale:false refreshes never burn the two-turn fallback budget.
  spatial.pending = { commandId: "cmd-4", destinationId: "slow", name: "Slow", staleCount: 0 };
  await spatial.refresh(core, { countStale: false });
  await spatial.refresh(core, { countStale: false });
  assert.ok(spatial.pending, "event-driven refreshes don't count toward stale-count");
  await spatial.refresh(core);
  await spatial.refresh(core);
  assert.equal(spatial.pending, null, "turn-driven refreshes still clear a dead journey after two");

  // 30. travel()'s post-await branches act only on their OWN journey: a reject
  // event that already cleared pending must not produce a second toast.
  toasts.length = 0;
  const host = {
    packageId: "pixelforge",
    sendMessage: async () => {
      // Simulate the engine's synthesized reject arriving mid-await.
      spatial.onHostEvent(core, {
        type: "spatial_transition_rejected",
        chatId: core.chatId,
        data: { commandId: spatial.pending.commandId, code: "spatial_transition_stale_definition" },
      });
      return false;
    },
  };
  core.host = host;
  core.sim.composePrefix = () => "[World]";
  core.sim.commitIntro = () => {};
  await spatial.travel(core, { id: "bar", name: "Bar" });
  assert.ok(
    toasts.some((t) => t.includes("stayed put")),
    "the event toast fired",
  );
  assert.ok(
    !toasts.some((t) => t.includes("isn't accepting")),
    "no contradictory second toast after the event handled it",
  );

  loadedPF.api.getSpatial = prevGetSpatial;
  spatial.reset();
}

// 31-36. World Maps export (spec §8): seed-stable ids, the definition as the
// idempotency ledger, additive-route retry discipline, and quiet degradation.
{
  const exportScaffold = (seed, chatId, prebuilt) => {
    const w = prebuilt ?? world.build(seed, "cozy-village", brief.defaults("cozy-village", seed));
    const sim = {
      world: w,
      zoneId: w.startZone,
      mode: "walk",
      zone() {
        return this.world.zones[this.zoneId];
      },
      teleport() {},
    };
    const core = { chatId, sim, dirty: 0, hud: { toast() {}, refreshChips() {} } };
    core.markDirty = () => {
      core.dirty++;
    };
    return { w, core };
  };
  // The zones the export is allowed to touch. The exterior IS the root, and a
  // room inside a building (a dwelling, a shop) stamps mapExport = false, so a
  // case that diffs "every zone" against what was posted has to ask the same
  // question 55-maps-export asks. Case 45 is where the gate itself is pinned.
  const exportableZones = (w) =>
    Object.keys(w.zones).filter((id) => id !== w.startZone && w.zones[id].mapExport !== false);
  const mapsExport = loadedPF.mapsExport;
  const prevGetSpatial = loadedPF.api.getSpatial;
  const prevPostLocations = loadedPF.api.postSpatialLocations;
  const resetExportState = () => {
    mapsExport._done = new WeakSet();
    mapsExport._inFlightWorld = null;
    mapsExport._failed = null;
  };
  /** Bind the root deterministically, then drive the export by hand: the
   *  refresh-triggered fire-and-forget would race the assertions. */
  const bindRoot = async (core) => {
    loadedPF.spatial.reset();
    mapsExport._inFlightWorld = core.sim.world;
    await loadedPF.spatial.refresh(core);
    mapsExport._inFlightWorld = null;
  };

  // 31. Happy path: only missing zones post, as children of the bound root,
  // buildings and wilds keep their kinds, and pre-existing ids re-bind
  // (self-heal) without re-posting. A second run is a no-op.
  {
    const { w, core } = exportScaffold(4242, "chat-export-31");
    const zoneIds = exportableZones(w);
    assert.ok(zoneIds.length >= 2, "the default brief compiles interior and wilds zones");
    const preSeeded = mapsExport.idFor(w, zoneIds[0]);
    let revision = 5;
    let serverLocs = [
      { id: "loc-root", kind: "settlement" },
      { id: preSeeded, kind: "building" },
    ];
    const posts = [];
    loadedPF.api.getSpatial = async () => ({
      definition: { revision, locations: serverLocs.slice() },
      currentLocationId: "loc-root",
      breadcrumb: [{ name: "Rootville" }],
      destinations: [],
    });
    loadedPF.api.postSpatialLocations = async (chatId, body) => {
      posts.push(body);
      assert.equal(body.expectedRevision, revision, "CAS rides the freshest revision");
      serverLocs = serverLocs.concat(body.locations.map((row) => ({ id: row.id, kind: row.kind })));
      revision++;
      return { ok: true, status: 200, body: {} };
    };
    resetExportState();
    await bindRoot(core);
    await mapsExport.maybeSync(core);
    assert.equal(posts.length, 1, "one batch for the missing zones");
    assert.equal(posts[0].locations.length, zoneIds.length - 1, "the pre-seeded id is diffed out");
    for (const row of posts[0].locations) {
      assert.equal(row.parentId, "loc-root", "zones hang under the exterior's bound location");
      const zoneId = row.id.split(".").pop();
      assert.equal(row.kind, w.zones[zoneId].mapKind === "building" ? "building" : "place", "kind follows the zone");
    }
    for (const zoneId of zoneIds) {
      assert.equal(
        w.bindings[mapsExport.idFor(w, zoneId)],
        zoneId,
        `zone ${zoneId} is bound (including the pre-seeded one)`,
      );
      assert.equal(w.zones[zoneId].spatialLocationId, mapsExport.idFor(w, zoneId), "the zone records its location id");
    }
    assert.ok(core.dirty > 0, "bindings persist via a save");
    await mapsExport.maybeSync(core);
    assert.equal(posts.length, 1, "a completed export never re-posts");
  }

  // 32. A stale 409 re-reads and retries with the fresh revision — user edits
  // between our read and write cost one round trip, nothing else.
  {
    const { w, core } = exportScaffold(555, "chat-export-32");
    let revision = 7;
    let serverLocs = [{ id: "loc-root" }];
    const posts = [];
    loadedPF.api.getSpatial = async () => ({
      definition: { revision, locations: serverLocs.slice() },
      currentLocationId: "loc-root",
      breadcrumb: [{ name: "Rootville" }],
      destinations: [],
    });
    loadedPF.api.postSpatialLocations = async (chatId, body) => {
      posts.push(body);
      if (posts.length === 1) {
        revision = 9; // someone edited the map mid-flight
        return { ok: false, status: 409, body: { code: "spatial_definition_stale" } };
      }
      serverLocs = serverLocs.concat(body.locations.map((row) => ({ id: row.id })));
      revision++;
      return { ok: true, status: 200, body: {} };
    };
    resetExportState();
    await bindRoot(core);
    await mapsExport.maybeSync(core);
    assert.equal(posts.length, 2, "stale CAS retries once after a re-read");
    assert.equal(posts[1].expectedRevision, 9, "the retry carries the re-read revision");
    assert.ok(Object.keys(w.bindings).length > 1, "the retry completed the bindings");
  }

  // 33. An id conflict means another actor already registered our rows: the
  // re-read diff empties the batch and bindings still land.
  {
    const { w, core } = exportScaffold(777, "chat-export-33");
    const zoneIds = exportableZones(w);
    let raced = false;
    const posts = [];
    loadedPF.api.getSpatial = async () => ({
      definition: {
        revision: 3,
        locations: [{ id: "loc-root" }].concat(
          raced ? zoneIds.map((zoneId) => ({ id: mapsExport.idFor(w, zoneId) })) : [],
        ),
      },
      currentLocationId: "loc-root",
      breadcrumb: [{ name: "Rootville" }],
      destinations: [],
    });
    loadedPF.api.postSpatialLocations = async () => {
      posts.push(1);
      raced = true; // a second tab beat us to every id
      return { ok: false, status: 409, body: { code: "spatial_location_conflict" } };
    };
    resetExportState();
    await bindRoot(core);
    await mapsExport.maybeSync(core);
    assert.equal(posts.length, 1, "the conflict is not retried blindly");
    assert.equal(w.bindings[mapsExport.idFor(w, zoneIds[0])], zoneIds[0], "already-registered ids still bind");
    assert.ok(mapsExport._done.has(w), "the run completes");
  }

  // 34. Older maps package (route absent): quiet skip, no bindings to
  // locations that do not exist, and no per-turn retry hammering.
  {
    const { w, core } = exportScaffold(888, "chat-export-34");
    const posts = [];
    loadedPF.api.getSpatial = async () => ({
      definition: { revision: 1, locations: [{ id: "loc-root" }] },
      currentLocationId: "loc-root",
      breadcrumb: [{ name: "Rootville" }],
      destinations: [],
    });
    loadedPF.api.postSpatialLocations = async () => {
      posts.push(1);
      return { ok: false, status: 404, body: null };
    };
    resetExportState();
    await bindRoot(core);
    await mapsExport.maybeSync(core);
    await mapsExport.maybeSync(core);
    assert.equal(posts.length, 1, "404 marks the world done for this session");
    assert.equal(Object.keys(w.bindings).length, 1, "only the root binding exists — nothing binds to absent locations");
  }

  // 35. A live editor moving the revision forever: two no-progress retries,
  // then back off — never a duel, and the backoff holds within the window.
  {
    const { core } = exportScaffold(999, "chat-export-35");
    let revision = 1;
    const posts = [];
    loadedPF.api.getSpatial = async () => ({
      definition: { revision: ++revision, locations: [{ id: "loc-root" }] },
      currentLocationId: "loc-root",
      breadcrumb: [{ name: "Rootville" }],
      destinations: [],
    });
    loadedPF.api.postSpatialLocations = async () => {
      posts.push(1);
      return { ok: false, status: 409, body: { code: "spatial_definition_stale" } };
    };
    resetExportState();
    await bindRoot(core);
    await mapsExport.maybeSync(core);
    assert.equal(posts.length, 3, "three attempts, then surrender");
    assert.ok(mapsExport._failed, "the failure is recorded for backoff");
    await mapsExport.maybeSync(core);
    assert.equal(posts.length, 3, "the backoff window suppresses immediate retries");
  }

  // 36. A chat switch mid-flight must not write into the new chat's world:
  // same generation discipline refresh() and travel() use.
  {
    const { w, core } = exportScaffold(1234, "chat-export-36");
    loadedPF.api.getSpatial = async () => ({
      definition: { revision: 2, locations: [{ id: "loc-root" }] },
      currentLocationId: "loc-root",
      breadcrumb: [{ name: "Rootville" }],
      destinations: [],
    });
    loadedPF.api.postSpatialLocations = async () => {
      core.chatId = "some-other-chat"; // the user switched chats mid-await
      return { ok: true, status: 200, body: {} };
    };
    resetExportState();
    await bindRoot(core);
    await mapsExport.maybeSync(core);
    assert.equal(Object.keys(w.bindings).length, 1, "no export bindings written after a chat switch");
    assert.ok(!mapsExport._done.has(w), "the run does not mark itself complete");
  }

  // 37. Adoption: a same-named root child authored before the export (hand
  // edits, wizard map instructions) is bound instead of twinned; only truly
  // new zones post. A location already bound to another zone never adopts.
  {
    const { w, core } = exportScaffold(2468, "chat-export-37");
    const zoneIds = exportableZones(w);
    const adoptedZone = zoneIds[0];
    const adoptedName = w.zones[adoptedZone].name;
    const posts = [];
    let serverLocs = [
      { id: "loc-root" },
      { id: "authored-1", parentId: "loc-root", name: `  ${adoptedName.toUpperCase()}  ` },
    ];
    loadedPF.api.getSpatial = async () => ({
      definition: { revision: 4, locations: serverLocs.slice() },
      currentLocationId: "loc-root",
      breadcrumb: [{ name: "Rootville" }],
      destinations: [],
    });
    loadedPF.api.postSpatialLocations = async (chatId, body) => {
      posts.push(body);
      serverLocs = serverLocs.concat(body.locations.map((row) => ({ id: row.id })));
      return { ok: true, status: 200, body: {} };
    };
    resetExportState();
    await bindRoot(core);
    await mapsExport.maybeSync(core);
    assert.ok(
      !posts.flatMap((p) => p.locations).some((row) => row.name === adoptedName),
      "the adopted zone is never posted as a twin",
    );
    assert.equal(
      w.bindings["authored-1"],
      adoptedZone,
      "the authored location is bound (name match is trim+case-insensitive)",
    );
    assert.equal(w.zones[adoptedZone].spatialLocationId, "authored-1", "the zone records the adopted id");
    for (const zoneId of zoneIds.slice(1)) {
      assert.equal(w.bindings[mapsExport.idFor(w, zoneId)], zoneId, "non-adopted zones still create and bind pf ids");
    }
  }

  // 37b. A restored save already carries a prior adoption: re-planning must
  // KEEP adopting the location bound to the same zone, never flip back to
  // creating a twin (live-found regression on the Kepler playtest).
  {
    const { w, core } = exportScaffold(2468, "chat-export-37b");
    const zoneIds = exportableZones(w);
    const adoptedZone = zoneIds[0];
    const adoptedName = w.zones[adoptedZone].name;
    const posts = [];
    let serverLocs = [{ id: "loc-root" }, { id: "authored-1", parentId: "loc-root", name: adoptedName }];
    loadedPF.api.getSpatial = async () => ({
      definition: { revision: 4, locations: serverLocs.slice() },
      currentLocationId: "loc-root",
      breadcrumb: [{ name: "Rootville" }],
      destinations: [],
    });
    loadedPF.api.postSpatialLocations = async (chatId, body) => {
      posts.push(body);
      serverLocs = serverLocs.concat(body.locations.map((row) => ({ id: row.id })));
      return { ok: true, status: 200, body: {} };
    };
    resetExportState();
    await bindRoot(core);
    w.bindings["authored-1"] = adoptedZone; // the save restored last session's adoption
    await mapsExport.maybeSync(core);
    assert.ok(
      !posts.flatMap((p) => p.locations).some((row) => row.name === adoptedName),
      "an already-bound adoption never flips back to creating a twin",
    );
    assert.equal(w.bindings["authored-1"], adoptedZone, "the adoption binding survives");
    // A location bound to a DIFFERENT zone is never stolen: it creates instead.
    const otherZone = zoneIds[1];
    if (otherZone) {
      resetExportState();
      w.bindings["authored-1"] = otherZone; // user rebound it (or a conflicting save)
      delete w.bindings[mapsExport.idFor(w, adoptedZone)];
      await mapsExport.maybeSync(core);
      assert.equal(w.bindings["authored-1"], otherZone, "a foreign binding is never stolen");
      assert.equal(
        w.bindings[mapsExport.idFor(w, adoptedZone)],
        adoptedZone,
        "the shadowed zone creates its own id instead",
      );
    }
  }

  // 38. An accepted batch whose rows never appear in the re-read (a proxy
  // eating writes, a stale read replica) surrenders instead of posting
  // forever — the regression that OOM'd the harness when first written.
  {
    const { core } = exportScaffold(3690, "chat-export-38");
    const posts = [];
    loadedPF.api.getSpatial = async () => ({
      definition: { revision: 1, locations: [{ id: "loc-root" }] },
      currentLocationId: "loc-root",
      breadcrumb: [{ name: "Rootville" }],
      destinations: [],
    });
    loadedPF.api.postSpatialLocations = async () => {
      posts.push(1);
      return { ok: true, status: 200, body: {} }; // accepted, but the GET never reflects it
    };
    resetExportState();
    await bindRoot(core);
    await mapsExport.maybeSync(core);
    assert.equal(posts.length, 3, "three attempts with no visible progress, then surrender");
    assert.ok(mapsExport._failed, "the failure is recorded for backoff");
  }

  // 39. A same-chat, same-seed REBUILD (brief arrival, rewind) is a new world
  // object: completion state must not carry over — the rebuilt world re-syncs,
  // the diff makes it a re-bind, and the self-heal actually runs (the string
  // done-key suppressed all of this: review finding).
  {
    const { w, core } = exportScaffold(1357, "chat-export-39");
    const zoneIds = exportableZones(w);
    let serverLocs = [{ id: "loc-root" }];
    const posts = [];
    loadedPF.api.getSpatial = async () => ({
      definition: { revision: 2, locations: serverLocs.slice() },
      currentLocationId: "loc-root",
      breadcrumb: [{ name: "Rootville" }],
      destinations: [],
    });
    loadedPF.api.postSpatialLocations = async (chatId, body) => {
      posts.push(body);
      serverLocs = serverLocs.concat(body.locations.map((row) => ({ id: row.id })));
      return { ok: true, status: 200, body: {} };
    };
    resetExportState();
    await bindRoot(core);
    await mapsExport.maybeSync(core);
    assert.ok(mapsExport._done.has(w), "first world completes");
    // The rebuild: same chat, same seed, fresh world object with empty bindings.
    const sealed = brief.defaults("cozy-village", 1357);
    const w2 = world.build(1357, "cozy-village", sealed);
    core.sim = {
      world: w2,
      zoneId: w2.startZone,
      mode: "walk",
      zone() {
        return this.world.zones[this.zoneId];
      },
      teleport() {},
    };
    w2.bindings["loc-root"] = w2.startZone;
    await mapsExport.maybeSync(core);
    assert.ok(mapsExport._done.has(w2), "the rebuilt world syncs despite identical chat+seed");
    assert.equal(posts.length, 1, "nothing re-posts — the definition diff turns the re-sync into a re-bind");
    for (const zoneId of zoneIds) {
      assert.equal(w2.bindings[mapsExport.idFor(w2, zoneId)], zoneId, "the rebuilt world's bindings self-heal");
    }
  }

  // 40. The pre-brief boot world of a generation-enabled chat (world.interim,
  // stamped by 60-save) never exports — its throwaway zones would pollute the
  // map forever on an additive route.
  {
    const { w, core } = exportScaffold(8642, "chat-export-40");
    w.interim = true;
    const posts = [];
    loadedPF.api.getSpatial = async () => ({
      definition: { revision: 1, locations: [{ id: "loc-root" }] },
      currentLocationId: "loc-root",
      breadcrumb: [{ name: "Rootville" }],
      destinations: [],
    });
    loadedPF.api.postSpatialLocations = async () => {
      posts.push(1);
      return { ok: true, status: 200, body: {} };
    };
    resetExportState();
    await bindRoot(core);
    await mapsExport.maybeSync(core);
    assert.equal(posts.length, 0, "an interim world never posts");
    assert.ok(!mapsExport._done.has(w), "and is not marked done — the final world will sync");
  }

  // 41. A shared-world-linked chat skips: posting would silently stage
  // unpublished draft edits to a communal world. Not marked done, so
  // unlinking re-enables the export.
  {
    const { w, core } = exportScaffold(9753, "chat-export-41");
    const posts = [];
    loadedPF.api.getSpatial = async () => ({
      definition: { revision: 1, locations: [{ id: "loc-root" }] },
      currentLocationId: "loc-root",
      breadcrumb: [{ name: "Rootville" }],
      destinations: [],
      sharedWorld: { mode: "linked", worldId: "world-1", pendingChanges: false },
    });
    loadedPF.api.postSpatialLocations = async () => {
      posts.push(1);
      return { ok: true, status: 200, body: {} };
    };
    resetExportState();
    await bindRoot(core);
    await mapsExport.maybeSync(core);
    assert.equal(posts.length, 0, "a linked chat never posts");
    assert.ok(!mapsExport._done.has(w), "and is not marked done");
  }

  // 42. A stale root binding (map replaced or root archived) prunes the dead
  // bindings instead of 400-looping forever; the emptied table re-seeds on
  // the next refresh.
  {
    const { w, core } = exportScaffold(1122, "chat-export-42");
    const posts = [];
    loadedPF.api.getSpatial = async () => ({
      definition: { revision: 5, locations: [{ id: "loc-new-root" }] },
      currentLocationId: "loc-new-root",
      breadcrumb: [{ name: "New Root" }],
      destinations: [],
    });
    loadedPF.api.postSpatialLocations = async () => {
      posts.push(1);
      return { ok: false, status: 400, body: { code: "spatial_replacement_invalid" } };
    };
    resetExportState();
    loadedPF.spatial.reset();
    mapsExport._inFlightWorld = core.sim.world;
    await loadedPF.spatial.refresh(core);
    mapsExport._inFlightWorld = null;
    // The save restored bindings from BEFORE the map was replaced.
    delete w.bindings["loc-new-root"];
    w.bindings["loc-dead-root"] = w.startZone;
    w.bindings[
      mapsExport.idFor(
        w,
        Object.keys(w.zones).find((id) => id !== w.startZone),
      )
    ] = "z2";
    core.dirty = 0;
    await mapsExport.maybeSync(core);
    assert.equal(posts.length, 0, "nothing posts under a dead root");
    assert.equal(Object.keys(w.bindings).length, 0, "every dead binding is pruned so re-seeding can run");
    assert.ok(core.dirty > 0, "the prune persists");
    assert.ok(!mapsExport._done.has(w), "the world is not done — it re-syncs under the new root");
  }

  // 43. A deliberate refusal (archived parent raced in, the 500-location cap)
  // marks the world done for the session — no 60-second retry drumbeat.
  {
    const { w, core } = exportScaffold(3344, "chat-export-43");
    const posts = [];
    loadedPF.api.getSpatial = async () => ({
      definition: { revision: 3, locations: [{ id: "loc-root" }] },
      currentLocationId: "loc-root",
      breadcrumb: [{ name: "Rootville" }],
      destinations: [],
    });
    loadedPF.api.postSpatialLocations = async () => {
      posts.push(1);
      return { ok: false, status: 400, body: { code: "spatial_replacement_invalid" } };
    };
    resetExportState();
    await bindRoot(core);
    await mapsExport.maybeSync(core);
    mapsExport._failed = null; // isolate the done-marking from the backoff window
    await mapsExport.maybeSync(core);
    assert.equal(posts.length, 1, "a 4xx refusal is terminal for the session, not retried");
    assert.ok(mapsExport._done.has(w), "the world is marked done");
  }

  // 44. An oscillating map (an editor archiving/restoring an adoptable
  // between every CAS attempt flips a zone between adoption and creation, so
  // consecutive no-progress comparisons never fire) still terminates via the
  // absolute attempt budget — CodeRabbit finding on #389.
  {
    const { w, core } = exportScaffold(5566, "chat-export-44");
    const zoneIds = exportableZones(w);
    const flipName = w.zones[zoneIds[0]].name;
    let reads = 0;
    const posts = [];
    loadedPF.api.getSpatial = async () => ({
      definition: {
        revision: 10 + reads,
        locations: [
          { id: "loc-root" },
          // Present on every OTHER read: adoption flips to creation and back,
          // so missing.length oscillates and never repeats consecutively.
          ...(reads++ % 2 === 0 ? [{ id: "flippy", parentId: "loc-root", name: flipName }] : []),
        ],
      },
      currentLocationId: "loc-root",
      breadcrumb: [{ name: "Rootville" }],
      destinations: [],
    });
    loadedPF.api.postSpatialLocations = async () => {
      posts.push(1);
      return { ok: false, status: 409, body: { code: "spatial_definition_stale" } };
    };
    resetExportState();
    await bindRoot(core);
    await mapsExport.maybeSync(core);
    assert.ok(posts.length <= 8, `the absolute budget bounds the loop (posted ${posts.length} times)`);
    assert.ok(mapsExport._failed, "the surrender is recorded for backoff");
  }

  // 45. The export gate: a building is ONE location and its floors are rooms
  // inside it, so a zone stamped mapExport = false gets no row and no binding,
  // while a NAMED brief place — the sanctuary here — still exports its single
  // row. This route is additive with NO delete: a row posted to a player's real
  // map is permanent, which is why the gate ships with the zone type and not a
  // release later.
  {
    const sealed = brief.validate(
      {
        scale: "village",
        name: "Bellford",
        places: [
          { kind: "sanctuary", name: "St. Ilde's", flavor: "Cold stone, warm candles." },
          { kind: "gathering", name: "The Bell" },
          { kind: "wilds", name: "The Reach" },
        ],
        cast: [
          { name: "Sera", role: "chaplain", kind: "elder", tint: "rose", home: "Bellford", household: 1 },
          { name: "Perrin", role: "innkeep", kind: "host", tint: "amber", home: "The Bell", household: 2 },
          { name: "Alder", role: "reeve", kind: "leader", tint: "blue", home: "Bellford", household: 3 },
          { name: "Tam", role: "farmer", kind: "grower", tint: "green", home: "Bellford", household: 4 },
          { name: "Cor", role: "shopkeep", kind: "merchant", tint: "teal", home: "Bellford", household: 5 },
        ],
      },
      { theme: "cozy-village", seed: 3131 },
    );
    const built = world.build(3131, "cozy-village", sealed);
    const churchId = Object.keys(built.zones).find((id) => built.zones[id].name === "St. Ilde's");
    const innId = Object.keys(built.zones).find((id) => built.zones[id].name === "The Bell");
    assert.ok(churchId && innId, "the sanctuary and the gathering both compiled");
    assert.equal(built.zones[churchId].mapExport, true, "a named place exports by default");
    // The compiled rooms — the dwelling and the shop — stamp the gate themselves.
    // (Five specials against a village's eight lots leave one dwelling slot, so
    // the four root households share a roof; one dwelling is what this fixture
    // is expected to build.)
    const roomIds = Object.keys(built.zones).filter((id) => built.zones[id].mapExport === false);
    assert.ok(
      roomIds.some((id) => built.zones[id].name.endsWith("'s home")) &&
        roomIds.some((id) => built.zones[id].name.endsWith("'s shop")),
      `the fixture compiled a dwelling and a shop (${roomIds.map((id) => built.zones[id].name).join(", ")})`,
    );
    // …and FLOORS (0.8.0). "One building, one location — never a row per floor"
    // below is a claim about zones that have to exist for it to mean anything:
    // the church carries a bell tower and the inn a cellar in this fixture.
    assert.ok(
      roomIds.includes(`${churchId}u`) && roomIds.includes(`${innId}b`),
      `the fixture compiled sub-floors (${roomIds.join(", ")})`,
    );
    // The gathering is stamped by HAND as well, so the gate is proven for a zone
    // type that does not set it itself: it is a property of the flag, not of
    // which zone kinds happen to carry it today.
    built.zones[innId].mapExport = false;
    const { w, core } = exportScaffold(3131, "chat-export-45", built);
    let serverLocs = [{ id: "loc-root" }];
    const posted = [];
    loadedPF.api.getSpatial = async () => ({
      definition: { revision: 2, locations: serverLocs.slice() },
      currentLocationId: "loc-root",
      breadcrumb: [{ name: "Rootville" }],
      destinations: [],
    });
    loadedPF.api.postSpatialLocations = async (chatId, body) => {
      posted.push(...body.locations);
      serverLocs = serverLocs.concat(body.locations.map((row) => ({ id: row.id })));
      return { ok: true, status: 200, body: {} };
    };
    resetExportState();
    await bindRoot(core);
    await mapsExport.maybeSync(core);
    assert.ok(
      posted.some((row) => row.name === "St. Ilde's" && row.kind === "building"),
      "the church exports its single row",
    );
    assert.equal(
      posted.filter((row) => row.name === "St. Ilde's").length,
      1,
      "one building, one location — never a row per floor",
    );
    assert.ok(!posted.some((row) => row.name === "The Bell"), "a zone stamped mapExport = false never posts");
    assert.equal(w.bindings[mapsExport.idFor(w, innId)], undefined, "and never binds a location it did not create");
    assert.equal(w.zones[innId].spatialLocationId, null, "the excluded zone records no location");
    // The compiled rooms take the same path: a dwelling and a shop are a floor
    // inside a building the settlement already contains, never a destination of
    // their own — and this route can never take a wrong row back.
    for (const roomId of roomIds) {
      const room = w.zones[roomId];
      assert.ok(!posted.some((row) => row.name === room.name), `${room.name} is a room, so it never posts`);
      assert.equal(w.bindings[mapsExport.idFor(w, roomId)], undefined, `${room.name} binds no location`);
      assert.equal(room.spatialLocationId, null, `${room.name} records no location`);
    }
    assert.equal(w.bindings[mapsExport.idFor(w, churchId)], churchId, "the church binds");
    // Non-vacuous: the wilds zone proves the run really did export its peers.
    const wildsId = Object.keys(w.zones).find((id) => w.zones[id].name === "The Reach");
    assert.equal(w.bindings[mapsExport.idFor(w, wildsId)], wildsId, "the other named places still export");
  }

  loadedPF.api.getSpatial = prevGetSpatial;
  loadedPF.api.postSpatialLocations = prevPostLocations;
  resetExportState();
  loadedPF.spatial.reset();
}

// 14. NPC daypart schedules. The compiler bakes location handles onto each NPC
// and the Sim re-places them as the clock crosses a daypart boundary.
{
  const sealed = brief.validate(
    {
      scale: "village",
      name: "Dayhold",
      places: [{ kind: "gathering", name: "The Lantern" }],
      cast: [
        { name: "Mira", role: "innkeep", kind: "host", tint: "amber", home: "The Lantern", household: 1 },
        { name: "Tolm", role: "smith", kind: "maker", tint: "green", home: "Dayhold", household: 2 },
        { name: "Gart", role: "watch", kind: "guard", tint: "red", home: "Dayhold", household: 3 },
        { name: "Peb", role: "cooper", kind: "folk", tint: "blue", home: "Dayhold", household: 4 },
        {
          name: "Wisp",
          role: "drifter",
          kind: "wanderer",
          tint: "rose",
          home: "Dayhold",
          household: 5,
          standing: "transient",
        },
      ],
    },
    ctx,
  );
  const w = world.build(31, "cozy-village", sealed);
  checkWorld(w, sealed, "schedules");
  const innId = Object.entries(sealed._ids.zones).find(([, n]) => n === "The Lantern")[0];
  const findNpc = (name) => {
    for (const zoneId in w.zones) {
      const npc = w.zones[zoneId].npcs.find((n) => n.name === name);
      if (npc) return { zoneId, npc };
    }
    return null;
  };

  // Every NPC carries a schedule, and every handle points at a real zone.
  for (const zoneId in w.zones) {
    for (const npc of w.zones[zoneId].npcs) {
      assert.ok(npc._sched, `${npc.name} carries a schedule`);
      assert.ok(npc._sched.post && w.zones[npc._sched.post.zoneId], `${npc.name} post handle resolves to a zone`);
      if (npc._sched.home) assert.ok(w.zones[npc._sched.home.zoneId], `${npc.name} home handle resolves to a zone`);
    }
  }

  const sim = new loadedPF.Sim(w);
  const dayOf = (min) => {
    sim.clockMin = min;
    sim.resolveSchedules();
  };

  // Daypart thresholds line up with the darkness() bands.
  assert.equal(sim.daypart(8 * 60), "day", "08:00 is day");
  assert.equal(sim.daypart(19 * 60), "dusk", "19:00 is dusk");
  assert.equal(sim.daypart(23 * 60), "night", "23:00 is night");
  assert.equal(sim.daypart(6 * 60), "dawn", "06:00 is dawn");

  // Midday: the smith works the shop; at night he is at his dwelling door.
  dayOf(12 * 60);
  const smithDay = JSON.stringify(findNpc("Tolm").npc.wander);
  dayOf(23 * 60);
  const smithNight = JSON.stringify(findNpc("Tolm").npc.wander);
  assert.notEqual(smithDay, smithNight, "the smith's night box differs from the working one");

  // The watch keeps the night: same box by day and after dark.
  dayOf(12 * 60);
  const guardDay = JSON.stringify(findNpc("Gart").npc.wander);
  dayOf(23 * 60);
  assert.equal(JSON.stringify(findNpc("Gart").npc.wander), guardDay, "the guard keeps the night watch at their post");

  // The innkeeper never leaves the inn, day or night.
  for (const min of [8 * 60, 23 * 60]) {
    dayOf(min);
    assert.equal(findNpc("Mira").zoneId, innId, "the innkeeper stays in the inn");
  }

  // Cross-zone relocation: the drifter loiters in the settlement by day and
  // takes a bed at the inn at night — spliced between zone arrays, exactly once.
  // The berth is UP THE STAIRS (0.8.0 floors), which is the same splice: a floor
  // is a zone, so a guest going to bed crosses one exactly as they always did.
  dayOf(12 * 60);
  const drifterDay = findNpc("Wisp");
  dayOf(23 * 60);
  const drifterNight = findNpc("Wisp");
  assert.equal(drifterNight.zoneId, `${innId}u`, "the drifter sleeps in the inn's guest rooms");
  assert.notEqual(drifterDay.zoneId, drifterNight.zoneId, "the drifter actually changed zone");
  let copies = 0;
  for (const zoneId in w.zones) copies += w.zones[zoneId].npcs.filter((n) => n.name === "Wisp").length;
  assert.equal(copies, 1, "a relocated NPC exists in exactly one zone (no splice duplication)");

  // Relocation never drops an NPC on a solid tile, at any daypart.
  for (const min of [6 * 60, 12 * 60, 19 * 60, 23 * 60]) {
    dayOf(min);
    for (const zoneId in w.zones) {
      const z = w.zones[zoneId];
      for (const npc of z.npcs) {
        const x = Math.round(npc.x);
        const y = Math.round(npc.y);
        assert.ok(x >= 0 && x < z.w && y >= 0 && y < z.h, `${npc.name} in bounds at ${min}`);
        assert.equal(z.solid[z.w * y + x], 0, `${npc.name} stands on open ground at ${min} in ${zoneId}`);
      }
    }
  }

  // Resolution is deterministic and idempotent: same clock, same placement.
  dayOf(19 * 60);
  const dusk = JSON.stringify(Object.keys(w.zones).map((id) => w.zones[id].npcs.map((n) => `${n.name}@${n.x},${n.y}`)));
  sim.resolveSchedules();
  const duskAgain = JSON.stringify(
    Object.keys(w.zones).map((id) => w.zones[id].npcs.map((n) => `${n.name}@${n.x},${n.y}`)),
  );
  assert.equal(dusk, duskAgain, "re-resolving the same daypart changes nothing");

  // A GM-held NPC is not yanked home by a boundary crossing.
  dayOf(12 * 60);
  const held = findNpc("Peb").npc;
  held._hold = true;
  const heldBox = JSON.stringify(held.wander);
  dayOf(23 * 60);
  assert.equal(JSON.stringify(held.wander), heldBox, "an NPC on GM hold ignores the schedule");
  delete held._hold;

  // The header carries the daypart so the GM narrates the light we render.
  dayOf(19 * 60);
  assert.ok(sim.header().includes("(dusk)"), `the header names the daypart (${sim.header()})`);

  // NPCs sharing a destination box must not stack: talk-targeting picks the
  // nearest with a strict <, so anyone underneath the top sprite would be
  // permanently unreachable. Review finding — a plain box-center placement put
  // most of the cast on one plaza tile at midday.
  for (const min of [12 * 60, 23 * 60]) {
    dayOf(min);
    for (const zoneId in w.zones) {
      const seen = new Map();
      for (const npc of w.zones[zoneId].npcs) {
        const tile = `${Math.round(npc.x)},${Math.round(npc.y)}`;
        assert.ok(!seen.has(tile), `${npc.name} and ${seen.get(tile)} share tile ${tile} in ${zoneId} at ${min}`);
        seen.set(tile, npc.name);
      }
    }
  }

  // Schedules are runtime-only state: `_sched` hangs off the live NPC object,
  // which the snapshot never walks (60-save stores a fixed scalar field list and
  // no NPC data at all), so schedules add zero save fields. What this harness
  // can prove is the property that makes that safe — placement is a pure
  // function of the clock, so a rebuild at a restored time reproduces it.
  dayOf(23 * 60);
  const nightPlacement = JSON.stringify(
    Object.keys(w.zones).map((id) => w.zones[id].npcs.map((n) => `${n.name}@${n.x},${n.y}`)),
  );
  const rebuilt = world.build(31, "cozy-village", sealed);
  const rebuiltSim = new loadedPF.Sim(rebuilt);
  rebuiltSim.clockMin = 23 * 60;
  rebuiltSim.resolveSchedules();
  assert.equal(
    JSON.stringify(
      Object.keys(rebuilt.zones).map((id) => rebuilt.zones[id].npcs.map((n) => `${n.name}@${n.x},${n.y}`)),
    ),
    nightPlacement,
    "a rebuild at the same clock reproduces placement exactly (no save fields needed)",
  );
}

// 14b. The clock advances while walking and FREEZES during dialogue, so a
// conversation never burns the afternoon or relocates the NPC being talked to.
{
  const sealed = brief.defaults("cozy-village", 12345);
  const sim = new loadedPF.Sim(world.build(12345, "cozy-village", sealed));
  sim.clockMin = 12 * 60;
  sim.mode = "walk";
  const before = sim.clockMin;
  for (let i = 0; i < 600; i++) sim.step(1 / 60, {});
  assert.ok(sim.clockMin > before, `walking advances the clock (${before} -> ${sim.clockMin})`);

  sim.mode = "dialogue";
  const frozen = sim.clockMin;
  for (let i = 0; i < 600; i++) sim.step(1 / 60, {});
  assert.equal(sim.clockMin, frozen, "dialogue freezes the clock");

  // wait-until jumps to the next daypart boundary and re-places everyone.
  sim.mode = "walk";
  sim.clockMin = 12 * 60;
  assert.ok(sim.waitUntil("night"), "wait-until succeeds in walk mode");
  assert.equal(sim.clockMin, 21 * 60, "wait-until lands on the daypart boundary");
  assert.equal(sim.daypart(), "night", "and the daypart follows");
  sim.mode = "dialogue";
  assert.equal(sim.waitUntil("dawn"), false, "wait-until refuses mid-conversation");
}

// 14c. NPCs actually WALK. The arrival snap used to test "near any integer",
// which matched the tile an NPC was still standing on — at the shipped fixed
// 1/60s step one move covers 0.027 tiles, so every move was cancelled on its
// first frame and the wander had never moved anyone. Drive the real fixed step.
{
  const sealed = brief.defaults("cozy-village", 909);
  const w = world.build(909, "cozy-village", sealed);
  const sim = new loadedPF.Sim(w);
  sim.mode = "walk";
  const z = sim.zone();
  assert.ok(z.npcs.length > 0, "the settlement has NPCs to move");
  // Key the start tiles BY NAME. A substring test over one joined string lets a
  // name that is a suffix of another ("Ada" inside "Wanda") match the wrong
  // entry when both stand on the same tile, so a genuinely frozen NPC would
  // read as unmoved-but-accounted-for and a movement regression could pass.
  const start = new Map(z.npcs.map((n) => [n.name, `${Math.round(n.x)},${Math.round(n.y)}`]));
  // Two in-game hours at the shipped 1/60s timestep.
  for (let i = 0; i < 60 * 60 * 2; i++) sim.step(1 / 60, {});
  const moved = z.npcs.filter((n) => start.get(n.name) !== `${Math.round(n.x)},${Math.round(n.y)}`);
  assert.ok(
    moved.length > 0,
    `at least one NPC wandered to a new tile (start ${[...start].map(([n, at]) => `${n}@${at}`).join("|")})`,
  );
  // And wandering never walks anyone through a wall or out of their box.
  for (const npc of z.npcs) {
    const x = Math.round(npc.x);
    const y = Math.round(npc.y);
    assert.equal(z.solid[z.w * y + x], 0, `${npc.name} never wanders onto a solid tile`);
    assert.ok(
      x >= npc.wander.x0 - 1 && x <= npc.wander.x1 + 1 && y >= npc.wander.y0 - 1 && y <= npc.wander.y1 + 1,
      `${npc.name} stays in its wander box`,
    );
  }
}

// 14e. Playtest findings: the NPC you are talking to holds still, nobody stands
// in a doorway or on a portal, and a stall merchant stays behind their counter.
{
  const sealed = brief.validate(
    {
      scale: "village",
      name: "Standfast",
      places: [{ kind: "gathering", name: "The Lamp" }],
      cast: [
        { name: "Ada", role: "reeve", kind: "leader", tint: "blue", home: "Standfast", household: 1 },
        { name: "Ben", role: "cooper", kind: "folk", tint: "green", home: "Standfast", household: 2 },
        { name: "Cyd", role: "innkeep", kind: "host", tint: "amber", home: "The Lamp", household: 3 },
        {
          name: "Sol",
          role: "trader",
          kind: "merchant",
          tint: "rose",
          home: "Standfast",
          household: 4,
          standing: "transient",
        },
      ],
    },
    ctx,
  );
  const w = world.build(11, "cozy-village", sealed);
  checkWorld(w, sealed, "playtest-fixes");
  const sim = new loadedPF.Sim(w);
  const v = w.zones.z1;

  // A stall merchant tends the counter: a single row, never the open street.
  // ASSERT the preconditions rather than guarding on them — skipping when the
  // merchant stops getting a stall (or stops being spread:false) would make the
  // case pass while checking nothing at all.
  const sol = v.npcs.find((n) => n.name === "Sol");
  assert.ok(sol, "the transient merchant tends their stall in the settlement");
  assert.equal(sol._sched.post.spread, false, "a stall is private geometry, so its placement is not hashed");
  assert.equal(sol.wander.y0, sol.wander.y1, "the stall merchant's box is the counter row only");

  // Nobody is placed in a doorway or on a portal, at any daypart.
  for (const min of [6 * 60, 12 * 60, 19 * 60, 23 * 60]) {
    sim.clockMin = min;
    sim.resolveSchedules();
    for (const zoneId in w.zones) {
      const z = w.zones[zoneId];
      for (const npc of z.npcs) {
        const x = Math.round(npc.x);
        const y = Math.round(npc.y);
        assert.notEqual(z.object[z.w * y + x], "door", `${npc.name} does not stand in a doorway at ${min}`);
        assert.ok(!z.portals.some((p) => p.x === x && p.y === y), `${npc.name} does not stand on a portal at ${min}`);
      }
    }
  }

  // Wandering never walks anyone into a doorway either.
  sim.mode = "walk";
  sim.clockMin = 12 * 60;
  sim.resolveSchedules();
  for (let i = 0; i < 60 * 60 * 2; i++) sim.step(1 / 60, {});
  for (const zoneId in w.zones) {
    const z = w.zones[zoneId];
    for (const npc of z.npcs) {
      const x = Math.round(npc.x);
      const y = Math.round(npc.y);
      assert.notEqual(z.object[z.w * y + x], "door", `${npc.name} never wanders into a doorway`);
    }
  }

  // The NPC being talked to stands still while the player is in dialogue.
  const partner = v.npcs[0];
  sim.mode = "dialogue";
  sim.nearNpc = partner;
  const held = `${partner.x},${partner.y}`;
  for (let i = 0; i < 60 * 60; i++) sim.step(1 / 60, {});
  assert.equal(`${partner.x},${partner.y}`, held, "the conversation partner holds still during dialogue");
}

// 14g. NPCs never share a tile WHILE WANDERING. Placement alone was not enough:
// the wander step only checked terrain, so two NPCs could pick the same free
// tile and slide through each other (playtest finding). Needs a CROWDED zone to
// reproduce — a full cast of folk all converge on the plaza at midday.
{
  const cast = [];
  for (let i = 0; i < 8; i++) {
    cast.push({
      name: `Folk${i}`,
      role: "villager",
      kind: "folk",
      tint: ["blue", "green", "amber", "rose", "teal", "violet", "orange", "grey"][i],
      home: "Crowdham",
      household: i + 1,
    });
  }
  const sealed = brief.validate({ scale: "village", name: "Crowdham", cast }, ctx);
  const w = world.build(21, "cozy-village", sealed);
  const sim = new loadedPF.Sim(w);
  sim.mode = "walk";
  sim.clockMin = 12 * 60; // folk -> the plaza, all sharing one box
  sim.resolveSchedules();
  const v = w.zones.z1;
  // Guard against a vacuous pass: one NPC can never collide with itself.
  assert.ok(v.npcs.length >= 5, `the plaza is genuinely crowded (${v.npcs.length} NPCs)`);
  let collisions = 0;
  for (let i = 0; i < 60 * 60 * 3; i++) {
    sim.step(1 / 60, {});
    const seen = new Set();
    for (const npc of v.npcs) {
      const tile = `${Math.round(npc.x)},${Math.round(npc.y)}`;
      if (seen.has(tile)) collisions++;
      seen.add(tile);
    }
  }
  assert.equal(collisions, 0, `no two NPCs share a tile while wandering (${collisions} colliding samples)`);
}

// 14i. Relocation must spread too. 14g pins the WANDER step; this pins the
// PLACEMENT. The cross-zone branch resolved its tile without the spread key, so
// every transient bedding down at the same inn arrived on the box's center —
// and a sprite under another sprite can never be selected by talk-targeting,
// which picks the nearest with a strict <. Needs several NPCs converging on ONE
// box from ANOTHER zone, which the default briefs never produce: the loiter
// rotation posts some transients at the inn already, and those take the in-zone
// path. Six of them guarantees at least two arrive from outside.
{
  const cast = [{ name: "Mira", role: "innkeep", kind: "host", tint: "amber", home: "The Lantern", household: 1 }];
  for (let i = 0; i < 6; i++) {
    cast.push({
      name: `Drifter${i}`,
      role: "drifter",
      kind: "wanderer",
      tint: ["blue", "green", "rose", "teal", "violet", "orange"][i],
      home: "Bedhold",
      household: 10 + i,
      standing: "transient",
    });
  }
  const sealed = brief.validate(
    { scale: "village", name: "Bedhold", places: [{ kind: "gathering", name: "The Lantern" }], cast },
    ctx,
  );
  const w = world.build(31, "cozy-village", sealed);
  const sim = new loadedPF.Sim(w);
  const innId = Object.entries(sealed._ids.zones).find(([, n]) => n === "The Lantern")[0];
  sim.clockMin = 23 * 60;
  sim.resolveSchedules();
  // Guard against a vacuous pass: the bug needs arrivals from another zone. The
  // inn is the whole building — its guest rooms are up the stairs (0.8.0 floors)
  // and a tile clash between two guests is the same clash on either floor.
  const beds = underRoof(w, innId);
  assert.ok(beds.length >= 4, `the inn genuinely fills up at night (${beds.length} NPCs)`);
  const seen = new Map();
  for (const { zone, npc } of beds) {
    const tile = `${zone.id}:${Math.round(npc.x)},${Math.round(npc.y)}`;
    assert.ok(!seen.has(tile), `${npc.name} and ${seen.get(tile)} both bedded down on tile ${tile}`);
    seen.set(tile, npc.name);
  }

  // And the invariant holds for a mixed cast across every daypart — a hash can
  // collide inside a box as small as a household's door apron, so the placer
  // has to treat an occupied tile as closed rather than merely spread by id.
  const kinds = ["host", "guard", "leader", "grower", "maker", "merchant", "folk", "wanderer"];
  const standings = ["resident", "resident", "transient", "transient", "fringe", "destitute"];
  for (let seed = 1; seed <= 12; seed++) {
    const rnd = loadedPF.rng(seed >>> 0);
    const mixed = [];
    for (let i = 0; i < 5 + ((seed * 7) % 6); i++) {
      mixed.push({
        name: `M${i}`,
        role: "villager",
        kind: kinds[(rnd() * kinds.length) | 0],
        tint: "amber",
        home: i % 3 === 0 ? "The Lantern" : "Mixford",
        household: 1 + ((i / 2) | 0),
        standing: standings[(rnd() * standings.length) | 0],
      });
    }
    const mixedSealed = brief.validate(
      {
        scale: "village",
        name: "Mixford",
        places: [
          { kind: "gathering", name: "The Lantern" },
          { kind: "workshop", name: "The Forge" },
        ],
        cast: mixed,
      },
      ctx,
    );
    const mw = world.build(seed, "cozy-village", mixedSealed);
    const msim = new loadedPF.Sim(mw);
    for (const min of [6 * 60, 12 * 60, 19 * 60, 23 * 60]) {
      msim.clockMin = min;
      msim.resolveSchedules();
      for (const zoneId in mw.zones) {
        const tiles = new Map();
        for (const npc of mw.zones[zoneId].npcs) {
          const tile = `${Math.round(npc.x)},${Math.round(npc.y)}`;
          assert.ok(
            !tiles.has(tile),
            `seed ${seed} at ${min / 60}h: ${npc.name} stacked on ${tiles.get(tile)} at ${tile} in ${zoneId}`,
          );
          tiles.set(tile, npc.name);
        }
      }
    }
  }
}

// 14j. A box that OVERFLOWS must not dump the remainder on one tile. The ring
// scan honoured occupancy, but when it exhausted the box the fallback returned
// zone.spawn — a single fixed tile that checks neither occupancy nor standable.
// The suite had no household-at-the-cap fixture, which is exactly where this
// lives: CAPS.household is 6, and a resident's night `home` handle was a 3x2 door
// apron whose door tile standable() excludes, leaving ~3 usable tiles. Three
// members overflowed onto the spawn on EVERY seed tried, and stacked NPCs are
// both un-talkable and frozen — their wander box is the one they failed to fit
// in, so every candidate step fails its bounds test.
//
// 0.8.0: the compiler no longer BUILDS that shape — a household sleeps in a
// dwelling interior, one bed each (case 52). The placer's guarantee outlives the
// fixture that found it, so the pre-0.8.0 handle is forced by hand below rather
// than the case being deleted along with the bug that motivated it.
{
  const cast = [];
  for (let i = 0; i < 6; i++) {
    cast.push({
      name: `Hearth${i}`,
      role: "weaver",
      kind: "maker",
      tint: ["blue", "green", "amber", "rose", "teal", "violet"][i],
      home: "Fullhouse",
      household: 1, // one roof, at the CAPS.household cap
    });
  }
  cast.push({ name: "Lamplight", role: "innkeep", kind: "host", tint: "orange", home: "The Lamp", household: 2 });
  const sealed = brief.validate(
    { scale: "village", name: "Fullhouse", places: [{ kind: "gathering", name: "The Lamp" }], cast },
    ctx,
  );
  // Guard against a vacuous pass: the repair passes must have KEPT one roof.
  const roof = sealed.cast.filter((c) => c.household === sealed.cast[0].household);
  assert.equal(roof.length, 6, `the household survives validation at the cap (${roof.length})`);
  for (const seed of [1, 2, 3, 7, 11]) {
    const w = world.build(seed, "cozy-village", sealed);
    const sim = new loadedPF.Sim(w);

    // ASSERT THE TRIGGER, not just the outcome. A tile scan alone would still
    // pass if schedule compilation stopped putting the household on one
    // undersized box — the overflow path simply would not run, and the case
    // would go quietly green while testing nothing.
    const hearths = [];
    for (const zoneId in w.zones)
      for (const npc of w.zones[zoneId].npcs) if (npc.name.startsWith("Hearth")) hearths.push(npc);
    assert.equal(hearths.length, 6, `seed ${seed}: the whole household compiles`);
    // Force the pre-0.8.0 shape: the whole household onto the ONE door apron in
    // front of their dwelling. The apron is still real geometry — it is the tile
    // strip the portal into the house sits on — so this is the shipped placer
    // being handed a genuinely undersized shared box, not a synthetic one.
    // A household this size sleeps UPSTAIRS (0.8.0 floors), and the front door
    // opens onto the ground floor — so the apron this case needs is the building's,
    // not the storey's.
    const dwellingId = groundFloorId(hearths[0]._sched.home.zoneId);
    const doorPortal = w.zones.z1.portals.find((p) => p.toZone === dwellingId);
    assert.ok(doorPortal, `seed ${seed}: the household's dwelling opens off the settlement`);
    const apron = {
      x0: Math.max(2, doorPortal.x - 1),
      y0: Math.max(2, doorPortal.y),
      x1: Math.min(w.zones.z1.w - 3, doorPortal.x + 1),
      y1: Math.min(w.zones.z1.h - 3, doorPortal.y + 1),
    };
    for (const npc of hearths) npc._sched.home = { zoneId: "z1", wander: apron };
    const homes = new Set(hearths.map((n) => `${n._sched.home.zoneId}:${JSON.stringify(n._sched.home.wander)}`));
    assert.equal(homes.size, 1, `seed ${seed}: the household shares ONE night home box (${homes.size} distinct)`);
    const home = hearths[0]._sched.home;
    const homeZone = w.zones[home.zoneId];
    let capacity = 0;
    for (let y = home.wander.y0; y <= home.wander.y1; y++) {
      for (let x = home.wander.x0; x <= home.wander.x1; x++) {
        if (loadedPF.schedule.standable(homeZone, x, y)) capacity++;
      }
    }
    assert.ok(capacity < hearths.length, `seed ${seed}: the home box genuinely overflows (${capacity} tiles for 6)`);

    sim.clockMin = 23 * 60; // night: the whole household resolves to one door apron
    sim.resolveSchedules();

    // The handle was actually selected, and the overflow path actually ran.
    let outside = 0;
    for (const npc of hearths) {
      const at = Object.keys(w.zones).find((id) => w.zones[id].npcs.includes(npc));
      assert.equal(at, home.zoneId, `seed ${seed}: ${npc.name} spends the night in its home zone`);
      const b = home.wander;
      if (!(npc.x >= b.x0 && npc.x <= b.x1 && npc.y >= b.y0 && npc.y <= b.y1)) outside++;
    }
    assert.equal(
      outside,
      hearths.length - capacity,
      `seed ${seed}: exactly the overflow stands outside the box (${outside} out, ${capacity} tiles)`,
    );

    for (const zoneId in w.zones) {
      const z = w.zones[zoneId];
      const seen = new Map();
      for (const npc of z.npcs) {
        const x = Math.round(npc.x);
        const y = Math.round(npc.y);
        const tile = `${x},${y}`;
        assert.ok(
          !seen.has(tile),
          `seed ${seed}: ${npc.name} overflowed onto ${seen.get(tile)} at ${tile} in ${zoneId}`,
        );
        seen.set(tile, npc.name);
        // The overflow tile still has to be somewhere an NPC may legally stand.
        assert.ok(loadedPF.schedule.standable(z, x, y), `seed ${seed}: ${npc.name} overflows onto a standable tile`);
      }
    }
  }

  // A SATURATED zone still yields a LEGAL tile. When nothing can satisfy both
  // predicates the placer drops occupancy, never standability: sharing a tile
  // looks wrong, but standing in a wall or a doorway is wrong, and a doorway
  // blocks the way in. The old code returned zone.spawn unchecked.
  //
  // This needs a hand-built zone to be worth anything. Every compiled zone's
  // spawn happens to be standable (480 of 480 tried), so a saturated compiled
  // zone would land on a legal tile by luck and the case would pass against the
  // unchecked return it is meant to catch. Putting the spawn ON a door tile is
  // the one shape that tells the two apart.
  {
    const w = 8;
    const h = 8;
    const fake = {
      w,
      h,
      solid: new Uint8Array(w * h),
      object: new Array(w * h).fill(null),
      portals: [],
      spawn: { x: 3, y: 3 },
    };
    fake.object[3 * w + 3] = "door";
    assert.ok(!loadedPF.schedule.standable(fake, fake.spawn.x, fake.spawn.y), "the fixture's spawn is a doorway");
    const at = loadedPF.schedule.walkableIn(fake, { x0: 2, y0: 2, x1: 4, y1: 4 }, "n1", () => true);
    assert.ok(
      loadedPF.schedule.standable(fake, at.x, at.y),
      `a saturated zone never falls back to an unstandable spawn (${at.x},${at.y})`,
    );
  }

  // And a degenerate box never escapes as a NaN placement. `hash % 0` is NaN and
  // standable()'s bounds test is false for every NaN comparison, so an inverted
  // box would return {x: NaN} as if it were a real tile. Nothing builds one
  // today — this pins the guard, not a live path.
  const z = world.build(5, "cozy-village", sealed).zones.z1;
  for (const box of [
    { x0: 9, y0: 9, x1: 4, y1: 4 }, // inverted on both axes
    { x0: 9, y0: 4, x1: 4, y1: 9 }, // inverted on one
  ]) {
    const at = loadedPF.schedule.walkableIn(z, box, "n1");
    assert.ok(Number.isInteger(at.x) && Number.isInteger(at.y), `an inverted box yields real tiles (${at.x},${at.y})`);
    assert.ok(loadedPF.schedule.standable(z, at.x, at.y), "an inverted box yields a standable tile");
  }
}

// 14k. The floor invariant that lets walkableIn stay TOTAL, enforced instead of
// assumed (review finding). The placer always returns a tile because none of its
// callers has a better answer: a compile-time spawn has to put the cast member
// somewhere, and by the time a cross-zone move needs a tile the NPC has already
// left its old zone. Its last resort is zone.spawn, which is only a legal answer
// while every compiled zone has somewhere legal to stand — so pin that here
// rather than trusting the generator to keep it true. If a future generator can
// emit a zone with no standable tile, this fails first and loudly, and the
// fallback needs a real policy instead of a tile.
{
  let minFree = Infinity;
  let zones = 0;
  for (const theme of ["cozy-village", "sci-fi-colony"]) {
    for (let seed = 1; seed <= 30; seed++) {
      const w = world.build(seed, theme, brief.defaults(theme, seed));
      for (const zoneId in w.zones) {
        const z = w.zones[zoneId];
        zones++;
        assert.ok(
          loadedPF.schedule.standable(z, z.spawn.x, z.spawn.y),
          `${theme} seed ${seed}: ${zoneId} (${z.name}) spawn ${z.spawn.x},${z.spawn.y} is itself standable`,
        );
        let free = 0;
        for (let y = 0; y < z.h; y++) {
          for (let x = 0; x < z.w; x++) if (loadedPF.schedule.standable(z, x, y)) free++;
        }
        assert.ok(free > 0, `${theme} seed ${seed}: ${zoneId} (${z.name}) has somewhere to stand`);
        minFree = Math.min(minFree, free);
      }
    }
  }
  // Guard against a vacuous pass, and pin the headroom the rest of the argument
  // rests on: the cast is capped at 10, so saturating a zone is out of reach too
  // — which is why the branch below the saturation fallback cannot be hit.
  assert.ok(zones > 100, `the sweep actually compiled zones (${zones})`);
  assert.ok(minFree > 10, `every zone has room for a whole cast (smallest ${minFree})`);
}

// 14h. A save whose zone no longer exists lands the player at the start zone's
// SPAWN, not at the old interior coordinates clamped into a much bigger map.
// The solid-tile rescue only fires if those coordinates hit a wall, so without
// this the player silently reappeared in a random corner (design-review find,
// and a guaranteed failure once interiors come and go between versions).
{
  const sealed = brief.defaults("cozy-village", 808);
  const w = world.build(808, "cozy-village", sealed);
  const meta = { pixelforgeBrief: sealed };
  // A WALKABLE tile that is not the spawn, found rather than assumed. This used
  // to be the literal (5, 4), which quietly stopped being floor the moment the
  // lot allocator changed — and the restore path's solid-tile rescue then did
  // exactly its job and bounced the player to spawn, so the case failed while
  // testing nothing about saving. The intent is "a resolvable zone honours its
  // saved position", and that intent must not depend on where a house lands.
  const start = w.zones[w.startZone];
  let savedX = -1;
  let savedY = -1;
  for (let y = 2; y < start.h - 2 && savedY < 0; y++) {
    for (let x = 2; x < start.w - 2; x++) {
      if (start.solid[start.w * y + x]) continue;
      if (x === start.spawn.x && y === start.spawn.y) continue;
      savedX = x;
      savedY = y;
      break;
    }
  }
  assert.ok(savedY >= 0, "the settlement has a walkable tile that is not the spawn");
  const restore = (savedZone) =>
    loadedPF.save.simFromSaved(
      {
        v: 1,
        seed: 808,
        theme: "cozy-village",
        zone: savedZone,
        x: savedX * loadedPF.TILE,
        y: savedY * loadedPF.TILE,
        facing: 0,
      },
      meta,
      "chat-test",
    );

  const gone = restore("zDoesNotExist");
  const spawn = w.zones[w.startZone].spawn;
  assert.equal(gone.zoneId, w.startZone, "an unresolvable zone falls back to the start zone");
  assert.equal(
    gone.x,
    (spawn.x + 0.5) * loadedPF.TILE,
    "and the player lands on the spawn tile, not stale coordinates",
  );
  assert.equal(gone.y, (spawn.y + 0.5) * loadedPF.TILE, "on both axes");

  // A zone that DOES resolve still restores its exact saved position.
  const kept = restore(w.startZone);
  assert.equal(kept.zoneId, w.startZone, "a resolvable zone is honored");
  assert.equal(kept.x, savedX * loadedPF.TILE, "and its saved coordinates survive");
  assert.equal(kept.y, savedY * loadedPF.TILE, "on both axes");
}

// 14f. wait-until is reachable as a player action and lands on the boundary.
{
  const sealed = brief.defaults("cozy-village", 5150);
  const sim = new loadedPF.Sim(world.build(5150, "cozy-village", sealed));
  sim.mode = "walk";
  sim.clockMin = 10 * 60;
  assert.equal(sim.waitUntil("dusk"), true, "waiting for dusk succeeds while walking");
  assert.equal(sim.clockMin, 18 * 60, "the clock lands exactly on the dusk boundary");
  // Waiting for a daypart already past rolls into the next day.
  const dayBefore = sim.day;
  assert.equal(sim.waitUntil("dawn"), true, "waiting for a passed daypart still succeeds");
  assert.equal(sim.day, dayBefore + 1, "and rolls over to the next day");
  assert.equal(sim.clockMin, 5 * 60, "landing on dawn");
}

// The 0.8.0 rooms fixture, shared by 14d and cases 51-53: a settlement with a
// leader's hall, a smith (a shop), a two-person household (two beds under one
// roof), an inn, and a transient who takes a bed in it.
const bedsBrief = (overrides = {}) => ({
  scale: "village",
  name: "Hearthwick",
  places: [{ kind: "gathering", name: "The Kettle" }],
  cast: [
    { name: "Ada", role: "reeve", kind: "leader", tint: "blue", home: "Hearthwick", household: 1 },
    { name: "Ben", role: "smith", kind: "maker", tint: "green", home: "Hearthwick", household: 2 },
    { name: "Cass", role: "cooper", kind: "folk", tint: "amber", home: "Hearthwick", household: 3 },
    { name: "Dell", role: "carter", kind: "folk", tint: "rose", home: "Hearthwick", household: 3 },
    { name: "Perrin", role: "innkeep", kind: "host", tint: "orange", home: "The Kettle", household: 4 },
    { name: "Wisp", kind: "wanderer", tint: "teal", home: "Hearthwick", household: 5, standing: "transient" },
  ],
  ...overrides,
});

// A partition has to show in the TILES, not just in the compiler's bookkeeping.
// An interior shell is wallStone around the edge with one `wall` row at y=1 and
// one door in the south wall — so any `wall` below that row, or any door that is
// not the front door, is a room divider and nothing else can be.
function partitionTiles(z) {
  const walls = [];
  const doors = [];
  for (let y = 2; y < z.h - 1; y++) {
    for (let x = 1; x < z.w - 1; x++) {
      const tile = z.object[z.w * y + x];
      if (tile === "wall") walls.push(`${x},${y}`);
      if (tile === "door") doors.push(`${x},${y}`);
    }
  }
  return { walls, doors };
}

/** Every tile a player can walk to from `start`, four-way, blocked by solids —
 *  and by `closed`, a set of "x,y" the caller wants treated as wall. Closing a
 *  room's door and re-flooding is how a case proves the room really is a ROOM:
 *  enclosed, with that door as its only way in. Loose wall stubs pass every
 *  other check here and fail this one. */
function floodFill(z, start, closed) {
  const seen = new Set([`${start.x},${start.y}`]);
  const queue = [start];
  while (queue.length) {
    const { x, y } = queue.pop();
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= z.w || ny >= z.h) continue;
      if (z.solid[z.w * ny + nx] || seen.has(`${nx},${ny}`) || closed?.has(`${nx},${ny}`)) continue;
      seen.add(`${nx},${ny}`);
      queue.push({ x: nx, y: ny });
    }
  }
  return seen;
}

// 14d. Every compiled zone is reachable from the start zone. An interior place
// that never claimed a building lot used to compile a named, NPC-populated room
// with no portal in either direction — whoever was homed there was stranded and
// un-talkable forever (review finding: 200/200 outposts on the pinned brief).
{
  const sealedOutpost = brief.validate(
    {
      scale: "outpost",
      name: "Stonewatch",
      places: [
        { kind: "gathering", name: "The Kettle" },
        { kind: "hall", name: "The Moot" },
        { kind: "workshop", name: "The Forge" },
      ],
      cast: [
        { name: "Alder", role: "reeve", kind: "leader", tint: "blue", home: "Stonewatch", household: 1 },
        { name: "Perrin", role: "innkeep", kind: "host", tint: "amber", home: "The Kettle", household: 2 },
        { name: "Bram", role: "smith", kind: "maker", tint: "green", home: "The Forge", household: 3 },
        { name: "Sera", role: "elder", kind: "elder", tint: "rose", home: "Stonewatch", household: 4 },
      ],
    },
    ctx,
  );
  // A sanctuary is a named place like any other: the tallest building in the
  // settlement is scenery if the player cannot walk into it, and its keeper is
  // un-talkable if the door never opens.
  const sealedSanctuary = brief.validate(
    {
      scale: "village",
      name: "Bellford",
      places: [
        { kind: "sanctuary", name: "St. Ilde's" },
        { kind: "gathering", name: "The Bell" },
      ],
      cast: [
        { name: "Sera", role: "chaplain", kind: "elder", tint: "rose", home: "St. Ilde's", household: 1 },
        { name: "Perrin", role: "innkeep", kind: "host", tint: "amber", home: "The Bell", household: 2 },
        { name: "Alder", role: "reeve", kind: "leader", tint: "blue", home: "Bellford", household: 3 },
        { name: "Tam", role: "farmer", kind: "grower", tint: "green", home: "Bellford", household: 4 },
      ],
    },
    ctx,
  );
  // 0.8.0 fixture: dwellings and shops compile rooms of their own, so the graph
  // this floods is several times the size it used to be — and a dwelling whose
  // portal pair was forgotten is exactly the "room with no door" this case
  // exists to refuse.
  const sealedRooms = brief.validate(bedsBrief(), ctx);
  // The outpost fixture exists to prove the DROP guard, so it demands no zone by
  // name; the sanctuary fixture would pass trivially if its church were one of
  // the dropped ones, so that one names what has to be there.
  for (const [sealed, required, minRooms] of [
    [sealedOutpost, [], 0],
    [sealedSanctuary, ["St. Ilde's", "The Bell"], 2],
    // Three interior rooms, not four: the smith's household lives over the shop,
    // so "Ben's home" is the shop and no second roof is minted for him.
    [sealedRooms, ["The Kettle", "Ben's shop", "Cass's home"], 3],
  ]) {
    for (const seed of [1, 2, 3, 4, 5]) {
      const w = world.build(seed, "cozy-village", sealed);
      // Non-vacuous: the sweep below is only interesting if the build actually
      // produced the interior rooms whose doors it is checking.
      const rooms = Object.values(w.zones).filter((zone) => zone.mapExport === false);
      assert.ok(rooms.length >= minRooms, `seed ${seed}: ${rooms.length} interior rooms compiled (want ${minRooms})`);
      // Flood the portal graph from the start zone.
      const reached = new Set([w.startZone]);
      const queue = [w.startZone];
      while (queue.length) {
        for (const portal of w.zones[queue.pop()].portals) {
          if (!reached.has(portal.toZone)) {
            reached.add(portal.toZone);
            queue.push(portal.toZone);
          }
        }
      }
      for (const zoneId in w.zones) {
        assert.ok(reached.has(zoneId), `seed ${seed}: zone ${zoneId} (${w.zones[zoneId].name}) is reachable`);
      }
      // And nobody can be SENT somewhere stranded either. Re-asserting
      // reached.has(zoneId) per NPC only repeats the sweep above; what the zone
      // sweep cannot see is a baked schedule handle pointing at an interior this
      // build no longer compiles (the drop guard in 20-world), which would move
      // an NPC out of the world on the next daypart — or into a room with no door.
      for (const zoneId in w.zones) {
        for (const npc of w.zones[zoneId].npcs) {
          for (const name of ["post", "home", "public"]) {
            const handle = npc._sched[name];
            if (!handle) continue;
            assert.ok(w.zones[handle.zoneId], `seed ${seed}: ${npc.name}'s ${name} handle names a live zone`);
            assert.ok(reached.has(handle.zoneId), `seed ${seed}: ${npc.name}'s ${name} handle is reachable`);
          }
        }
      }
      for (const name of required) {
        assert.ok(
          Object.values(w.zones).some((zone) => zone.name === name),
          `seed ${seed}: ${name} compiled`,
        );
      }
    }
  }
}

// 14l. The vista cutscene beat. It exists to exercise the host's transient
// narration-collapse request (capability API 1.13): the package asks only while
// the beat runs. The contract that matters is that it always STOPS asking —
// on its own timer, and immediately if the player walks away.
{
  const sealed = brief.defaults("cozy-village", 4242);
  const w = world.build(4242, "cozy-village", sealed);
  const sim = new loadedPF.Sim(w);
  sim.mode = "walk";
  const z = sim.zone();

  // Standing anywhere else, nothing is ever requested.
  sim.x = 20 * loadedPF.TILE;
  sim.y = 20 * loadedPF.TILE;
  sim.step(1 / 60, {});
  assert.equal(sim.cutscene, null, "no beat away from the corner");

  // Stepping into the corner starts it.
  sim.x = 2 * loadedPF.TILE;
  sim.y = 2 * loadedPF.TILE;
  sim.step(1 / 60, {});
  assert.ok(sim.cutscene, "the corner starts a beat");
  assert.ok(sim.cutscene.text.includes(z.name), "the caption names the settlement");

  // It ends on its own, without the player doing anything.
  for (let i = 0; i < 60 * 10; i++) sim.step(1 / 60, {});
  assert.equal(sim.cutscene, null, "the beat releases itself on its timer");

  // Loitering does not loop it — it re-arms only after leaving.
  for (let i = 0; i < 60 * 10; i++) sim.step(1 / 60, {});
  assert.equal(sim.cutscene, null, "loitering in the corner does not retrigger");
  sim.x = 20 * loadedPF.TILE;
  sim.y = 20 * loadedPF.TILE;
  sim.step(1 / 60, {});
  sim.x = 2 * loadedPF.TILE;
  sim.y = 2 * loadedPF.TILE;
  sim.step(1 / 60, {});
  assert.ok(sim.cutscene, "leaving and returning arms it again");

  // Walking away releases it immediately — a beat can never hold the box hostage.
  sim.x = 20 * loadedPF.TILE;
  sim.y = 20 * loadedPF.TILE;
  sim.step(1 / 60, {});
  assert.equal(sim.cutscene, null, "walking away releases the beat at once");

  // And it never survives the screen changing hands. A beat is walk-only, so a
  // player who opens the message box (dialogue) or is pulled into combat while
  // standing in the corner would otherwise leave the request standing over the
  // whole of it — asking the host to fold away the very narration they switched
  // modes to read, with the timer frozen so it could not even time out. Replay is
  // the third case and is cut at core.setMode: it returns before sim.step() runs.
  for (const mode of ["dialogue", "combat"]) {
    sim.x = 20 * loadedPF.TILE;
    sim.y = 20 * loadedPF.TILE;
    sim.step(1 / 60, {});
    sim.x = 2 * loadedPF.TILE;
    sim.y = 2 * loadedPF.TILE;
    sim.step(1 / 60, {});
    assert.ok(sim.cutscene, `the corner starts a beat before ${mode}`);
    sim.mode = mode;
    sim.step(1 / 60, {});
    assert.equal(sim.cutscene, null, `a beat does not survive ${mode}`);
    sim.mode = "walk";
  }
}

// 14m. The chrome memo across a change of hands. setMode drops the beat when the
// screen changes owner (14l), but the frame loop asks for chrome again only when
// the beat state DIFFERS from the memo of what was last asked for. So dropping a
// beat has to move that memo too: left saying "cutscene" while that same setMode
// declared otherwise, the NEXT beat matches the stale memo, the diff never fires,
// and the host is never asked to collapse narration for it. 90-element is a DOM
// module the bundle above leaves out, so it is evaluated here on its own against
// the two globals it touches at load time.
{
  globalThis.HTMLElement ??= class {};
  globalThis.customElements ??= { get: () => undefined, define: () => {} };
  new Function("PF", `"use strict";\n${readFileSync(join(here, "src", "90-element.js"), "utf8")}`)(loadedPF);

  const core = loadedPF.core;
  const asked = [];
  core.host = { setExperienceChrome: (c) => asked.push(!!c?.requestsCollapsedNarration) };
  core.sim = { mode: "walk", cutscene: null };
  core.input = {};
  core.hud = null;
  core._cutsceneDeclared = false;
  // The frame loop's own diff, which is the thing the memo exists to serve.
  const frame = () => {
    if (!!core.sim.cutscene !== core._cutsceneDeclared) {
      core._cutsceneDeclared = !!core.sim.cutscene;
      core._declareChrome();
    }
  };

  core.sim.cutscene = { text: "the valley opens up" };
  frame();
  assert.equal(asked.at(-1), true, "the first beat asks the host to collapse narration");

  core.setMode("replay");
  assert.equal(core.sim.cutscene, null, "the beat does not survive replay");
  assert.equal(asked.at(-1), false, "and the ask is withdrawn with it");
  assert.equal(core._cutsceneDeclared, false, "the memo tracks the withdrawal, not the dropped beat");

  core.setMode("walk");
  core.sim.cutscene = { text: "the valley again, later" };
  frame();
  assert.equal(asked.at(-1), true, "a later beat is declared once the screen comes back");
}

// ── The sanctuary (0.8.0): a tall facade outside, a room worth entering inside ──
// A church is the first place kind whose exterior is not a house wearing a
// different roof: building()'s facade option turns its already-solid body rows
// into visible stonework, and the compiler spends whatever head-room the lot has
// on more of the same.
const sanctuaryBrief = (overrides = {}) => ({
  scale: "village",
  name: "Bellford",
  places: [
    { kind: "sanctuary", name: "St. Ilde's", flavor: "Cold stone, warm candles." },
    { kind: "gathering", name: "The Bell" },
  ],
  cast: [
    { name: "Sera", role: "chaplain", kind: "elder", tint: "rose", home: "St. Ilde's", household: 1 },
    { name: "Perrin", role: "innkeep", kind: "host", tint: "amber", home: "The Bell", household: 2 },
    { name: "Alder", role: "reeve", kind: "leader", tint: "blue", home: "Bellford", household: 3 },
    { name: "Tam", role: "farmer", kind: "grower", tint: "green", home: "Bellford", household: 4 },
  ],
  ...overrides,
});
const zoneNamed = (w, name) => Object.values(w.zones).find((zone) => zone.name === name);

// 46. The interior is a nave, not a room with a label: an altar the aisle walks
// up to, benches in rows either side, candles at the altar, and a carpet the
// player can follow from the door without squeezing past the furniture.
{
  const sealed = brief.validate(sanctuaryBrief(), ctx);
  const w = world.build(424242, "cozy-village", sealed);
  checkWorld(w, sealed, "sanctuary");
  const z = zoneNamed(w, "St. Ilde's");
  assert.ok(z, "the sanctuary compiled");
  assert.equal(z.mapKind, "building", "a church is a building on the map");
  const at = (x, y) => z.object[z.w * y + x];
  const solidAt = (x, y) => z.solid[z.w * y + x];

  // The altar: a run of at least three tiles, every one of them solid. The rug
  // aisle is painted FIRST for exactly this reason — a ground fill clears
  // solidity, so reversing the order would leave a walk-through altar (the
  // hall's shipped bug, and the reason its comment exists).
  const altars = [];
  for (let y = 0; y < z.h; y++) for (let x = 0; x < z.w; x++) if (at(x, y) === "altar") altars.push({ x, y });
  assert.ok(altars.length >= 3, `the altar is a real focal block (${altars.length} tiles)`);
  assert.equal(new Set(altars.map((tile) => tile.y)).size, 1, "the altar is one run, not scattered furniture");
  for (const tile of altars) assert.equal(solidAt(tile.x, tile.y), 1, "the altar blocks — the aisle stops at it");

  // Pews: at least three rows, on BOTH sides of the aisle.
  const benchRows = [];
  for (let y = 0; y < z.h; y++) {
    const row = [];
    for (let x = 0; x < z.w; x++) if (at(x, y) === "counter") row.push(x);
    if (row.length) benchRows.push({ y, xs: row });
  }
  assert.ok(benchRows.length >= 3, `pews in rows (${benchRows.length} rows)`);
  const aisleX = (z.w / 2) | 0;
  for (const row of benchRows) {
    assert.ok(
      row.xs.some((x) => x < aisleX),
      `row ${row.y} seats the left of the aisle`,
    );
    assert.ok(
      row.xs.some((x) => x > aisleX),
      `row ${row.y} seats the right of the aisle`,
    );
    assert.ok(!row.xs.includes(aisleX), `row ${row.y} leaves the aisle open`);
  }

  // Candles: the altar row is lit from both sides, so the room reads at night.
  const altarY = altars[0].y;
  const altarLights = z.lights.filter((light) => light.y === altarY);
  assert.ok(altarLights.length >= 2, "the altar is lit from both sides");
  assert.ok(
    altarLights.some((light) => light.x < aisleX) && altarLights.some((light) => light.x > aisleX),
    "a candle each side, not two on one",
  );

  // And the walk itself: from the spawn inside the door, up the carpet, to the
  // tile below the altar. A pew row closing over the aisle would pass every
  // assertion above and still make the room pointless.
  const seen = new Set([`${z.spawn.x},${z.spawn.y}`]);
  const queue = [z.spawn];
  while (queue.length) {
    const { x, y } = queue.pop();
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= z.w || ny >= z.h || solidAt(nx, ny) || seen.has(`${nx},${ny}`)) continue;
      seen.add(`${nx},${ny}`);
      queue.push({ x: nx, y: ny });
    }
  }
  assert.ok(seen.has(`${aisleX},${altarY + 1}`), "the aisle reaches the altar rail from the door");
  assert.equal(z.ground[z.w * (altarY + 1) + aisleX], "rug", "and the walk up is carpeted");
  // Non-vacuous: the altar is the sanctuary's own furniture, not something every
  // interior gained.
  assert.ok(!zoneNamed(w, "The Bell").object.includes("altar"), "the gathering interior grew no altar");
}

// 47. The exterior is TALLER, on tiles rather than on vibes: a sanctuary shows
// rows of bare wall where an ordinary building shows only roof, and it spends
// the lot's head-room going UP — clamped so it never reaches the border ring
// above the top row of lots, and never roofs the crossroad below the bottom one.
{
  // Facade tiles: solid wall standing in the open, with no roof over it. Roofed
  // body rows and the eave both carry overhead, so this counts exactly the rows
  // the facade option exposes.
  const facadeTiles = (v, x0, x1) => {
    let count = 0;
    for (let y = 0; y < v.h; y++) {
      for (let x = Math.max(0, x0); x <= Math.min(v.w - 1, x1); x++) {
        const i = v.w * y + x;
        if (v.object[i] === "wallStone" && !v.overhead[i] && v.ground[i] === "stone") count++;
      }
    }
    return count;
  };
  // The topmost row this lot paints anything on — the eave, two rows above the
  // footprint's top.
  const topRow = (v, doorX, doorY) => {
    let top = doorY;
    while (top > 0 && (v.object[v.w * (top - 1) + doorX] || v.overhead[v.w * (top - 1) + doorX])) top--;
    return top;
  };
  // The same lot, built as a church and as an ordinary interior facade: same
  // brief, same slot, so every difference measured below is the facade option's.
  const lotOf = (sealed, seed, kind) => {
    const swapped = {
      ...sealed,
      places: sealed.places.map((place) => (place.kind === "sanctuary" ? { ...place, kind } : place)),
    };
    const w = world.build(seed, "cozy-village", swapped);
    const v = w.zones.z1;
    const z = zoneNamed(w, "St. Ilde's");
    const portal = z ? v.portals.find((p) => p.toZone === z.id) : null;
    if (!portal) return null;
    return {
      doorY: portal.y,
      top: topRow(v, portal.x, portal.y),
      facade: facadeTiles(v, portal.x - 3, portal.x + 4),
      midY: (v.h / 2) | 0,
    };
  };

  let sawRise = false;
  for (const scale of ["outpost", "hamlet", "village", "town"]) {
    // Padding pushes the church down the lot list, so both rows of lots — the one
    // under the border ring and the one under the crossroad — get exercised.
    for (const pad of [0, 1, 2, 3]) {
      const places = ["gathering", "workshop", "hall"]
        .slice(0, pad)
        .map((kind, index) => ({ kind, name: `Pad ${index}` }));
      places.push({ kind: "sanctuary", name: "St. Ilde's" });
      const sealed = brief.validate(sanctuaryBrief({ scale, places }), ctx);
      const church = lotOf(sealed, 7, "sanctuary");
      const plain = lotOf(sealed, 7, "workshop");
      if (!church || !plain) continue; // the lots ran dry — the drop guard's case
      const label = `${scale}/pad${pad}`;

      assert.ok(church.facade >= 2, `${label}: the church shows bare wall (${church.facade} tiles)`);
      assert.equal(plain.facade, 0, `${label}: an ordinary building shows none — it is all roof`);
      assert.equal(church.doorY, plain.doorY, `${label}: the door stays on the row the lot puts it on`);
      assert.ok(church.top <= plain.top, `${label}: the church never sits lower than an ordinary building`);
      assert.ok(church.top >= 2, `${label}: the eave stays clear of the border ring (top row ${church.top})`);
      // The clamp only has to protect a lot that was clear to begin with: an
      // outpost's lower row already eaves over its crossroad with any building.
      // Asked of the CHURCH's own lot, not of the plain building's. Inferring one
      // building's band from another's position held only while every row carried
      // two lots and the pair therefore landed together; once lots are claimed
      // outward from the plaza the two can sit in different bands entirely, and
      // the check then demanded a top-band church stay below the crossroad.
      if (church.doorY > church.midY && church.top > church.midY) {
        assert.ok(church.top > church.midY, `${label}: the extra height never roofs the crossroad`);
      }
      if (church.top < plain.top) {
        sawRise = true;
        // The height went into the facade, not the roof: every row won is a row
        // of visible wall, so the roofline stays as deep as anyone else's.
        assert.ok(church.facade >= plain.facade + 2, `${label}: every row it wins is a row of wall`);
      }
    }
  }
  assert.ok(sawRise, "at least one lot had the head-room to build up — the clamp is not simply always zero");
}

// 48. A brief sealed before 0.8.0 compiles to exactly the tiles it always did.
// The elder → sanctuary wiring is the risk: it has to stay dormant when the
// brief names no church, or every existing world would quietly rearrange itself
// on the next load (worlds are rebuilt from seed + brief, never from tiles).
{
  const older = {
    scale: "village",
    name: "Mossbrook",
    places: [
      { kind: "gathering", name: "The Wet Boot" },
      { kind: "wilds", name: "The Fallow" },
    ],
    features: [{ tag: "crop-plots", name: "The Rows" }],
    cast: [
      { name: "Sera", role: "weaver", kind: "elder", tint: "rose", home: "Mossbrook", household: 1 },
      { name: "Perrin", role: "innkeep", kind: "host", tint: "amber", home: "The Wet Boot", household: 2 },
      { name: "Alder", role: "mayor", kind: "leader", tint: "blue", home: "Mossbrook", household: 3 },
      { name: "Tam", role: "farmer", kind: "grower", tint: "green", home: "Mossbrook", household: 4 },
      { name: "Brin", role: "carter", kind: "folk", tint: "teal", home: "Mossbrook", household: 5 },
    ],
  };
  const sealed = brief.validate(older, ctx);
  assert.ok(
    sealed.cast.some((member) => member.kind === "elder"),
    "the fixture really does carry an elder — the dormancy claim needs one",
  );
  const tiles = (w) =>
    JSON.stringify(
      Object.keys(w.zones).map((id) => {
        const z = w.zones[id];
        return [id, z.w, z.h, z.ground, z.object, z.overhead, [...z.solid], z.portals, z.lights, z.spawn];
      }),
    );
  // The same brief with the elder demoted to plain folk: identical tiles is what
  // "dormant" MEANS. A lot it claimed, or a dwelling slot it displaced, shows up
  // here as a diff.
  const demoted = brief.validate(
    { ...older, cast: older.cast.map((member) => (member.kind === "elder" ? { ...member, kind: "folk" } : member)) },
    ctx,
  );
  for (const seed of [1, 7, 424242]) {
    const w = world.build(seed, "cozy-village", sealed);
    checkWorld(w, sealed, `older-brief seed ${seed}`);
    assert.equal(tiles(w), tiles(world.build(seed, "cozy-village", demoted)), `seed ${seed}: an elder mints nothing`);
    for (const id in w.zones) {
      const z = w.zones[id];
      assert.ok(!z.object.includes("altar"), `seed ${seed}: no altar anywhere in ${id}`);
      // Facade rows are the other half of the new machinery, and equally opt-in.
      for (let i = 0; i < z.object.length; i++) {
        if (z.object[i] !== "wallStone" || z.overhead[i] || z.ground[i] !== "stone") continue;
        assert.fail(`seed ${seed}: ${id} grew a facade row at ${i % z.w},${(i / z.w) | 0}`);
      }
    }
  }
}

// 49. The church world holds every NPC invariant the settlement does, around the
// clock: nobody stands in a wall, a doorway or a portal tile, and nobody shares
// a tile — including inside the sanctuary, whose keeper is the one cast member
// the schedule table now posts there all day.
{
  const sealed = brief.validate(sanctuaryBrief(), ctx);
  for (const seed of [1, 7, 424242]) {
    const w = world.build(seed, "cozy-village", sealed);
    const sim = new loadedPF.Sim(w);
    for (const min of [6 * 60, 12 * 60, 19 * 60, 23 * 60]) {
      sim.clockMin = min;
      sim.resolveSchedules();
      for (const zoneId in w.zones) {
        const z = w.zones[zoneId];
        const taken = new Set();
        for (const npc of z.npcs) {
          const x = Math.round(npc.x);
          const y = Math.round(npc.y);
          assert.ok(
            loadedPF.schedule.standable(z, x, y),
            `seed ${seed} @${min}: ${npc.name} stands somewhere legal in ${zoneId}`,
          );
          assert.ok(!taken.has(`${x},${y}`), `seed ${seed} @${min}: ${npc.name} shares nobody's tile`);
          taken.add(`${x},${y}`);
        }
      }
    }
    // Non-vacuous: the keeper really is in the church at the hour a player is
    // most likely to open its door.
    sim.clockMin = 12 * 60;
    sim.resolveSchedules();
    assert.ok(
      zoneNamed(w, "St. Ilde's").npcs.some((npc) => npc.name === "Sera"),
      `seed ${seed}: the chaplain keeps the sanctuary through the day`,
    );
  }
}

// 50. The keeper schedule tier is scoped to elders who actually hold a sanctuary.
// Adding a church must not change how elders behave in the settlements that have
// none — those still keep the plaza habits they have always had.
{
  const cast = (elderHome) => [
    { name: "Ana", role: "reeve", kind: "leader", tint: "blue", home: "Oldtown", household: 1 },
    { name: "Gran", role: "chaplain", kind: "elder", tint: "rose", home: elderHome, household: 2 },
    { name: "Bo", role: "farmer", kind: "folk", tint: "green", home: "Oldtown", household: 3 },
    { name: "Cy", role: "cooper", kind: "folk", tint: "amber", home: "Oldtown", household: 4 },
  ];
  const noChurch = brief.validate({ scale: "village", name: "Oldtown", cast: cast("Oldtown") }, ctx);
  const withChurch = brief.validate(
    { scale: "village", name: "Oldtown", places: [{ kind: "sanctuary", name: "St Ives" }], cast: cast("St Ives") },
    ctx,
  );
  const midday = (sealed) => {
    const w = world.build(5, "cozy-village", sealed);
    const sim = new loadedPF.Sim(w);
    sim.clockMin = 12 * 60;
    sim.resolveSchedules();
    for (const id in w.zones) {
      const npc = w.zones[id].npcs.find((n) => n.name === "Gran");
      if (npc) return { world: w, zoneId: id, npc };
    }
    throw new Error("the elder vanished");
  };

  // Without a sanctuary: no keeper flag, and the plaza by day exactly as before.
  const plain = midday(noChurch);
  assert.equal(plain.npc._sched.keeper, false, "an elder with no sanctuary is not a keeper");
  assert.equal(plain.zoneId, "z1", "and stays in the settlement");
  const v = plain.world.zones.z1;
  const mx = (v.w / 2) | 0;
  const my = (v.h / 2) | 0;
  assert.ok(
    Math.abs(Math.round(plain.npc.x) - mx) <= 6 && Math.abs(Math.round(plain.npc.y) - my) <= 5,
    "an elder with no sanctuary still spends midday in the plaza",
  );

  // Holding one: keeper, and inside it rather than out in the square.
  const keeping = midday(withChurch);
  assert.equal(keeping.npc._sched.keeper, true, "an elder homed at a sanctuary keeps it");
  assert.equal(keeping.world.zones[keeping.zoneId].name, "St Ives", "and is inside it at midday");
}

// ── Dwellings, shops and beds (0.8.0): the rooms behind the doors ────────────
// The complaint this answers: NPCs were scheduled somewhere to rest and the
// player never saw it, because a dwelling was a facade with no room behind it —
// "turned in for the night" resolved to a box on the door apron OUTSIDE.

// 51. A resident spends the night in their dwelling, ON their own bed, and is
// back out in the settlement by day. The transient's inn bed is the same
// promise for someone with no roof of their own.
{
  const sealed = brief.validate(bedsBrief(), ctx);
  const findNpc = (w, name) => {
    for (const id in w.zones) {
      const npc = w.zones[id].npcs.find((n) => n.name === name);
      if (npc) return { id, npc, zone: w.zones[id] };
    }
    return null;
  };
  for (const seed of [1, 7, 31, 424242]) {
    const w = world.build(seed, "cozy-village", sealed);
    checkWorld(w, sealed, `beds seed ${seed}`);
    const sim = new loadedPF.Sim(w);

    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    const night = findNpc(w, "Cass");
    assert.notEqual(night.id, "z1", `seed ${seed}: Cass is indoors at night, not on the street`);
    assert.equal(night.zone.mapKind, "building", `seed ${seed}: and the room is a building interior`);
    assert.equal(
      night.zone.object[night.zone.w * night.npc.y + night.npc.x],
      "bed",
      `seed ${seed}: Cass stands on a bed at 23:00 (${night.npc.x},${night.npc.y} in ${night.id})`,
    );
    // The handle really is a bed, not a box that happens to overlap one.
    const handle = night.npc._sched.home;
    assert.equal(handle.zoneId, night.id, `seed ${seed}: the night handle names the dwelling`);
    assert.equal(handle.spread, false, `seed ${seed}: a bed is a placement, never a box to disperse in`);
    assert.ok(
      handle.wander.x0 === handle.wander.x1 && handle.wander.y0 === handle.wander.y1,
      `seed ${seed}: the night handle is one tile wide`,
    );

    // The transient takes a real bed at the inn rather than standing among the
    // tables — and the inn keeps its guest rooms UPSTAIRS (0.8.0 floors), so the
    // bed is a floor above the tap room and the walk there is a stair portal.
    const guest = findNpc(w, "Wisp");
    assert.equal(
      guest.zone.name,
      "The Kettle, upstairs",
      `seed ${seed}: the drifter beds down in the inn's guest rooms`,
    );
    assert.equal(guest.zone.mapExport, false, `seed ${seed}: and a guest storey is never a map destination`);
    assert.equal(
      guest.zone.object[guest.zone.w * guest.npc.y + guest.npc.x],
      "bed",
      `seed ${seed}: and in one of its guest beds`,
    );

    sim.clockMin = 12 * 60;
    sim.resolveSchedules();
    const day = findNpc(w, "Cass");
    assert.equal(day.id, "z1", `seed ${seed}: Cass is back out in the settlement by day`);
    assert.equal(
      w.zones.z1.object[w.zones.z1.w * day.npc.y + day.npc.x],
      null,
      `seed ${seed}: and standing on open ground, not furniture`,
    );
  }
}

// 52. Every resident under one roof gets their OWN SLEEPING TILE. Six is
// CAPS.household, the largest a single household ever has to sleep — and two
// sprites on one tile makes the lower one un-talkable, so "a place each" is an
// invariant rather than a nicety. Six fills both bedrooms to their bunks, which
// is exactly why the tile assertion names bed AND bunk: a bunk is a sleeping
// place, and the invariant under test is one tile per sleeper, not which
// furniture it is.
// (The pre-0.8.0 shape put the whole household on one door apron; case 14j
// keeps that overflow path under test by forcing the old handle by hand.)
{
  const cast = [];
  for (let i = 0; i < 6; i++) {
    cast.push({
      name: `Kin${i}`,
      role: "weaver",
      kind: "folk",
      tint: ["blue", "green", "amber", "rose", "teal", "violet"][i],
      home: "Sixfold",
      household: 1,
    });
  }
  cast.push({ name: "Lamp", role: "innkeep", kind: "host", tint: "orange", home: "The Lamp", household: 2 });
  const sealed = brief.validate(
    { scale: "village", name: "Sixfold", places: [{ kind: "gathering", name: "The Lamp" }], cast },
    ctx,
  );
  assert.equal(
    sealed.cast.filter((c) => c.household === sealed.cast[0].household).length,
    6,
    "the household survives validation at the cap — a split would make this vacuous",
  );
  for (const seed of [1, 3, 11]) {
    const w = world.build(seed, "cozy-village", sealed);
    const kin = [];
    for (const id in w.zones) for (const npc of w.zones[id].npcs) if (npc.name.startsWith("Kin")) kin.push(npc);
    assert.equal(kin.length, 6, `seed ${seed}: the whole household compiles`);
    const zoneIds = new Set(kin.map((n) => n._sched.home.zoneId));
    assert.equal(zoneIds.size, 1, `seed ${seed}: one household, one roof (${[...zoneIds].join(",")})`);
    const homeZone = w.zones[[...zoneIds][0]];
    const tiles = new Set(kin.map((n) => `${n._sched.home.wander.x0},${n._sched.home.wander.y0}`));
    assert.equal(tiles.size, 6, `seed ${seed}: six sleepers, six places (${tiles.size} distinct)`);
    for (const tile of tiles) {
      const [x, y] = tile.split(",").map(Number);
      assert.ok(
        SLEEPS_ON.has(homeZone.object[homeZone.w * y + x]),
        `seed ${seed}: ${tile} is an actual sleeping tile (${homeZone.object[homeZone.w * y + x]})`,
      );
    }

    // And it holds once the Sim has placed them: same room, one tile each.
    const sim = new loadedPF.Sim(w);
    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    const taken = new Set();
    for (const npc of kin) {
      assert.ok(homeZone.npcs.includes(npc), `seed ${seed}: ${npc.name} sleeps at home`);
      const tile = `${npc.x},${npc.y}`;
      assert.ok(!taken.has(tile), `seed ${seed}: ${npc.name} shares tile ${tile} with a housemate`);
      taken.add(tile);
      assert.ok(SLEEPS_ON.has(homeZone.object[homeZone.w * npc.y + npc.x]), `seed ${seed}: ${npc.name} is in a bed`);
    }
  }
}

// 53. A shop opens, and it is not an empty room: a counter to be served over,
// stock behind it, and the owner working there through the day. The maintainer
// call was that an empty shop reads worse than a locked door, so the room ships
// furnished and staffed in the same change.
{
  const sealed = brief.validate(bedsBrief(), ctx);
  for (const seed of [1, 31, 424242]) {
    const w = world.build(seed, "cozy-village", sealed);
    const shop = Object.values(w.zones).find((zone) => zone.name === "Ben's shop");
    assert.ok(shop, `seed ${seed}: the smith's shop compiled a room`);
    assert.equal(shop.mapExport, false, `seed ${seed}: a shop is a room inside a building, not a destination`);
    assert.ok(shop.object.includes("counter"), `seed ${seed}: there is a counter`);
    const stock = shop.object.filter((tile) => tile === "shelf").length;
    assert.ok(stock >= 3, `seed ${seed}: and stock behind it (${stock} tiles)`);
    // Non-vacuous the other way: stock is the shop's own furniture, not something
    // every interior grew. A CELLAR is the one other room shelving belongs in —
    // stores are what a cellar IS — so it is named here rather than waved through.
    for (const zone of Object.values(w.zones)) {
      if (zone === shop || !zone.object.includes("shelf")) continue;
      assert.ok(zone.id.endsWith("b"), `seed ${seed}: ${zone.name} sprouted shelving and is not a cellar`);
    }

    const sim = new loadedPF.Sim(w);
    sim.clockMin = 12 * 60;
    sim.resolveSchedules();
    const ben = shop.npcs.find((npc) => npc.name === "Ben");
    assert.ok(ben, `seed ${seed}: the owner is inside their own shop at midday`);
    assert.equal(
      shop.object[shop.w * (ben.y + 1) + ben.x],
      "counter",
      `seed ${seed}: standing behind the counter, not out in front of it`,
    );

    // The counter must not wall the shopkeeper off: a pocket the player cannot
    // walk into would strand the very person the room exists to show. Flood the
    // room from the tile inside its door.
    const seen = new Set([`${shop.spawn.x},${shop.spawn.y}`]);
    const queue = [shop.spawn];
    while (queue.length) {
      const { x, y } = queue.pop();
      for (const [dx, dy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= shop.w || ny >= shop.h) continue;
        if (shop.solid[shop.w * ny + nx] || seen.has(`${nx},${ny}`)) continue;
        seen.add(`${nx},${ny}`);
        queue.push({ x: nx, y: ny });
      }
    }
    assert.ok(seen.has(`${ben.x},${ben.y}`), `seed ${seed}: the player can reach the shopkeeper from the door`);

    // Off duty he goes to bed — and the bed is UPSTAIRS, in the same building.
    // A shop is a live-work premises: the trade is carried on where the family
    // lives, so the smith sleeps over the forge rather than in a second house
    // that used to cost the settlement a whole second lot.
    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    const home = Object.values(w.zones).find((zone) => zone.npcs.some((npc) => npc.name === "Ben"));
    assert.equal(home, shop, `seed ${seed}: the smith sleeps in the shop he works`);
    const asleep = home.npcs.find((npc) => npc.name === "Ben");
    assert.ok(
      SLEEPS_ON.has(home.object[home.w * asleep.y + asleep.x]),
      `seed ${seed}: a shop owner sleeps in their own bed, behind the shop floor`,
    );
    assert.ok(
      !Object.values(w.zones).some((zone) => zone.name === "Ben's home"),
      `seed ${seed}: and no second roof is minted for the same household`,
    );
  }
}

// ── Rooms, bedrooms and bunks (0.8.0) ────────────────────────────────────────
// The complaint this answers: every bed in a dwelling sat in ONE open room, laid
// along two rows in the same 14x10 space as the table, so a six-person household
// read as a dormitory whether or not it was one — and the inn's guest beds were
// four tiles in the corner of the common room rather than rooms with doors.

/** A settlement whose only household is `size` people of one cast kind, plus the
 *  fixed pair (a reeve and an innkeep) that keeps the lot arithmetic identical
 *  between two calls that differ ONLY in `kind`. */
const houseBrief = (name, size, kind) => ({
  scale: "village",
  name,
  places: [{ kind: "gathering", name: `The ${name} Lamp` }],
  cast: [
    ...Array.from({ length: size }, (_, i) => ({
      name: `Kin${i}`,
      role: "ward",
      kind,
      tint: ["blue", "green", "amber", "rose", "teal", "violet"][i % 6],
      home: name,
      household: 1,
    })),
    { name: "Ada", role: "reeve", kind: "leader", tint: "grey", home: name, household: 2 },
    { name: "Perrin", role: "innkeep", kind: "host", tint: "orange", home: `The ${name} Lamp`, household: 3 },
  ],
});
const findZone = (w, name) => Object.values(w.zones).find((zone) => zone.name === name);

/** A village whose every lot is spoken for — three named places, a live-work
 *  farm and a duty-station post — so the compiler's over-subscription merge folds
 *  every household still owed a roof onto the ONE dwelling slot left. `hands`
 *  sets how many bodies end up under it: the only way to put more than
 *  CAPS.household of them there, which is exactly the shape a dormitory is for.
 *
 *  The trades are deliberately the ones that do NOT take their household with
 *  them: the reeve and the innkeep hold named places, the merchant's shop binds
 *  to the named workshop, and the watch keeps a post nobody lives in — so only
 *  the farmer leaves the merged block. */
const bunkhouseBrief = (hands) => ({
  scale: "village",
  name: "Cramp",
  places: [
    { kind: "gathering", name: "The Kettle" },
    { kind: "hall", name: "The Moot" },
    { kind: "workshop", name: "The Forge" },
  ],
  cast: [
    { name: "Ada", role: "reeve", kind: "leader", tint: "blue", home: "Cramp", household: 1 },
    { name: "Perrin", role: "innkeep", kind: "host", tint: "orange", home: "Cramp", household: 2 },
    { name: "Tam", role: "farmer", kind: "grower", tint: "green", home: "Cramp", household: 3 },
    { name: "Gil", role: "warden", kind: "guard", tint: "grey", home: "Cramp", household: 4 },
    { name: "Ben", role: "trader", kind: "merchant", tint: "amber", home: "Cramp", household: 5 },
    ...Array.from({ length: hands }, (_, i) => ({
      name: `Kin${i}`,
      role: "hand",
      kind: "folk",
      tint: ["rose", "teal", "violet", "red", "blue"][i % 5],
      home: "Cramp",
      household: 6,
    })),
  ],
});

/** Sealed as a VILLAGE — where six households and three places seal clean with
 *  no repairs — and then handed the ground of an outpost.
 *
 *  This brief exists to reach the over-subscription MERGE: several whole
 *  households squeezed onto the last free lot, which is the only way a dormitory
 *  can still happen now that no single household may exceed its cap. A village
 *  used to lay six lots, so six households over-subscribed it by simply
 *  existing. A village now lays sixteen and every household can have its own
 *  door, so the merge stopped firing and five fixtures quietly stopped testing
 *  what they were written for. Shrinking the ground restores the pressure
 *  without changing what the brief SAYS — the same trick, and the same reason,
 *  as case 65b. */
const bunkhouseSealed = (hands) => {
  const sealed = brief.validate(bunkhouseBrief(hands), ctx);
  sealed.scale = "outpost";
  return sealed;
};

// 54. A small household sleeps behind a bedroom DOOR, and both sleepers are
// inside that room at night on tiles of their own. The partition is asserted in
// the TILES — a wall run below the shell's own wall row with a door in it —
// because a room that exists only in the compiler's bookkeeping is not a room.
{
  const sealed = brief.validate(bedsBrief(), ctx);
  for (const seed of [1, 3, 11, 424242]) {
    const w = world.build(seed, "cozy-village", sealed);
    checkWorld(w, sealed, `bedrooms seed ${seed}`);
    const home = findZone(w, "Cass's home");
    assert.ok(home, `seed ${seed}: the two-person household compiled a dwelling`);
    const { walls, doors } = partitionTiles(home);
    assert.ok(walls.length > 0, `seed ${seed}: the dwelling has an interior wall run`);
    assert.equal(home.rooms.length, 1, `seed ${seed}: two sleepers want one bedroom (${home.rooms.length})`);
    assert.equal(doors.length, home.rooms.length, `seed ${seed}: one door per room, so none is sealed in`);
    // Zone count is the point of doing this with walls: a bedroom must NOT mint
    // a zone (each one costs two full-size canvases in the render cache).
    assert.ok(
      !Object.values(w.zones).some((zone) => zone !== home && zone.name === home.name),
      `seed ${seed}: the bedroom is a partition, never a zone of its own`,
    );

    const sim = new loadedPF.Sim(w);
    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    const room = home.rooms[0];
    const taken = new Set();
    for (const name of ["Cass", "Dell"]) {
      const npc = home.npcs.find((n) => n.name === name);
      assert.ok(npc, `seed ${seed}: ${name} is home at 23:00`);
      assert.ok(
        npc.x >= room.x0 && npc.x <= room.x1 && npc.y >= room.y0 && npc.y <= room.y1,
        `seed ${seed}: ${name} sleeps INSIDE the bedroom (${npc.x},${npc.y} vs ${room.x0}..${room.x1})`,
      );
      const tile = `${npc.x},${npc.y}`;
      assert.ok(!taken.has(tile), `seed ${seed}: ${name} shares tile ${tile} with the other sleeper`);
      taken.add(tile);
      assert.equal(
        home.object[home.w * npc.y + npc.x],
        "bed",
        `seed ${seed}: two in a room this size is not dense, so a single bed each`,
      );
    }
    assert.equal(taken.size, 2, `seed ${seed}: two sleepers, two tiles`);

    // And it is ENCLOSED: shut the bedroom door and the beds fall off the map.
    // Every other assertion above passes on a partition of loose wall stubs;
    // this is the one that says the walls actually join up.
    const shut = floodFill(home, home.spawn, new Set([`${room.doorX},${room.y1 + 1}`]));
    for (const bed of home.beds) {
      assert.ok(
        !shut.has(`${bed.x},${bed.y}`),
        `seed ${seed}: closing the bedroom door leaves ${bed.x},${bed.y} open — the room has no walls`,
      );
    }
    assert.ok(shut.has(`${home.spawn.x},${home.spawn.y}`), `seed ${seed}: the flood ran at all`);
  }
}

// 55. A BIG FAMILY KEEPS ITS BEDROOMS. Five and six under one roof used to fall
// straight out of the partition into an open dormitory, because a bedroom held
// two single beds and nothing else — so a household at CAPS.household lost its
// walls and compiled to a barracks, the one reading rooms were added to prevent.
// A bedroom takes a BUNK now, so the ROOM absorbs the density instead. Asserted
// as the PRESENCE of the partition in the tiles plus the furniture the density
// bought; four is the other side of the line and never touches a bunk, so
// neither half can go vacuous.
{
  for (const seed of [1, 3, 11]) {
    // Five and six GROW the house (the sleep plan wants two to a room, so three
    // rooms); seven and eight meet the three-room cap and the ROOM takes the
    // extra body instead. Both halves are here so neither can go vacuous: drop
    // the growth and 5 fails, drop the bunk and 7 fails.
    const SOFT = 2;
    const ROOM_CAP = 3;
    for (const size of [5, 6, 7, 8]) {
      const sealed = brief.validate(houseBrief("Kinfold", size, "folk"), ctx);
      assert.equal(
        sealed.cast.filter((c) => c.household === sealed.cast[0].household).length,
        size,
        `the ${size}-person household survives validation — a split would make this vacuous`,
      );
      const w = world.build(seed, "cozy-village", sealed);
      const home = findZone(w, "Kin0's home");
      assert.ok(home, `seed ${seed}: the ${size}-person household compiled a dwelling`);
      // A household this size is LARGE, so its bedrooms are up the stairs (0.8.0
      // floors). Which floor they are on is not what this case is about — that a
      // big family keeps WALLS instead of falling into a dormitory is — so it
      // asks where the bedrooms are rather than assuming.
      const sleeping = bedFloor(w, home);
      const { walls, doors } = partitionTiles(sleeping);
      assert.ok(walls.length > 0, `seed ${seed}: ${size} sleepers keep an interior wall run`);
      const wantRooms = Math.min(ROOM_CAP, Math.ceil(size / SOFT));
      assert.equal(
        sleeping.rooms.length,
        wantRooms,
        `seed ${seed}: ${size} sleepers want ${wantRooms} bedrooms (${sleeping.rooms.length})`,
      );
      assert.equal(doors.length, sleeping.rooms.length, `seed ${seed}: one door per bedroom, so nobody is sealed in`);
      assert.ok(home.beds.length >= size, `seed ${seed}: ${size} sleepers, ${home.beds.length} places`);
      // Only once the cap BINDS. Below it the house answers density by growing a
      // room, which is the better answer and the one the sizer exists to give;
      // demanding a bunk at five would be demanding the old shortage back.
      const crowded = size > ROOM_CAP * SOFT;
      const bunked = sleeping.rooms.some((room) =>
        room.beds.every((bed) => sleeping.object[sleeping.w * bed.y + bed.x] === "bunk"),
      );
      assert.equal(
        bunked,
        crowded,
        crowded
          ? `seed ${seed}: ${size} sleepers past ${ROOM_CAP} rooms bunk rather than the house losing its walls`
          : `seed ${seed}: ${size} sleepers fit in rooms of ${SOFT} and should not be bunked`,
      );
      // And every bedroom is a ROOM: shut its door and its beds leave the map.
      // Without this the case passes on a partition of loose wall stubs.
      for (const room of sleeping.rooms) {
        const shut = floodFill(sleeping, sleeping.spawn, new Set([`${room.doorX},${room.y1 + 1}`]));
        for (const bed of room.beds) {
          assert.ok(
            !shut.has(`${bed.x},${bed.y}`),
            `seed ${seed}: closing the bedroom door leaves ${bed.x},${bed.y} open — the room has no walls`,
          );
        }
      }
      // A partition is still not a zone. Two bedrooms cost ONE storey between
      // them, not one zone each — which is the whole reason a bedroom is walls
      // and a floor is a zone.
      //
      // Matched EXACTLY rather than by prefix. `startsWith("h1")` also catches
      // h10 and h11, which cost nothing while a settlement could only hold nine
      // households and turned into a false failure the moment one could hold
      // forty. Ids are a set, not a string space.
      const underThisRoof = Object.values(w.zones).filter(
        (z) => /^(.*?)(u|b)?$/.test(z.id) && floorIds(w, home.id).includes(z.id),
      );
      assert.equal(underThisRoof.length, floorIds(w, home.id).length, `seed ${seed}: every floor is a zone`);
      // Non-vacuous, and the half that actually catches a bedroom-as-zone: the
      // rooms outnumber the storeys they are carved into, so if a partition ever
      // did mint a zone the count above could not still match.
      const bedrooms = floorsOf(w, home.id).reduce(
        (n, z) => n + (z.rooms ?? []).filter((r) => (r.beds ?? []).length).length,
        0,
      );
      assert.ok(
        bedrooms >= floorIds(w, home.id).length,
        `seed ${seed}: the bedrooms mint no zones of their own (${bedrooms} bedrooms, ${floorIds(w, home.id).length} floors)`,
      );
      assert.ok(floorIds(w, home.id).length <= 3, `seed ${seed}: a building is a ground floor and at most two floors`);
    }

    // Four fits the two rooms on singles: density decides, and there is none.
    const roomy = brief.validate(houseBrief("Fourfold", 4, "folk"), ctx);
    const fourW = world.build(seed, "cozy-village", roomy);
    const four = findZone(fourW, "Kin0's home");
    assert.ok(four, `seed ${seed}: the smaller household compiled a dwelling`);
    const fourBeds = bedFloor(fourW, four);
    assert.ok(partitionTiles(fourBeds).walls.length > 0, `seed ${seed}: four sleepers still get bedrooms`);
    assert.equal(fourBeds.rooms.length, 2, `seed ${seed}: four sleepers, two bedrooms of two`);
    assert.ok(
      fourBeds.beds.every((bed) => fourBeds.object[fourBeds.w * bed.y + bed.x] === "bed"),
      `seed ${seed}: two to a room is not dense, so no bunk appears`,
    );
  }
}

// 55b. The worked example the shape exists for: one adult and three children
// read as a HOME. Bedrooms, a place each, and no dormitory anywhere near it —
// which is precisely what four sleepers used to be one person away from. The
// cast kinds are mixed on purpose and the assertions never mention them: the
// arrangement has to come out of the arithmetic, not out of who is in the house.
{
  const family = {
    scale: "village",
    name: "Ashfold",
    places: [{ kind: "gathering", name: "The Ashfold Lamp" }],
    cast: [
      { name: "Mera", role: "weaver", kind: "folk", tint: "blue", home: "Ashfold", household: 1 },
      { name: "Pip", role: "ward", kind: "child", tint: "green", home: "Ashfold", household: 1 },
      { name: "Nel", role: "ward", kind: "child", tint: "amber", home: "Ashfold", household: 1 },
      { name: "Rill", role: "ward", kind: "child", tint: "rose", home: "Ashfold", household: 1 },
      { name: "Perrin", role: "innkeep", kind: "host", tint: "orange", home: "The Ashfold Lamp", household: 2 },
    ],
  };
  const sealed = brief.validate(family, ctx);
  assert.equal(
    sealed.cast.filter((c) => c.household === 1).length,
    4,
    "all four stay one household — a split would test a different house",
  );
  for (const seed of [1, 3, 11, 424242]) {
    const w = world.build(seed, "cozy-village", sealed);
    checkWorld(w, sealed, `family seed ${seed}`);
    const home = findZone(w, "Mera's home");
    assert.ok(home, `seed ${seed}: the family compiled a dwelling`);
    // Four under one roof is a LARGE household, so the bedrooms are up the
    // stairs. That they are BEDROOMS rather than four beds in a row is what this
    // case is about, and it reads the same on either floor.
    const sleeping = bedFloor(w, home);
    assert.ok(sleeping.rooms.length >= 2, `seed ${seed}: it is a home with bedrooms (${sleeping.rooms.length})`);
    assert.ok(partitionTiles(sleeping).walls.length > 0, `seed ${seed}: and the walls are in the tiles`);
    assert.ok(home.beds.length >= 4, `seed ${seed}: a sleeping place each (${home.beds.length})`);
    // Nobody is left in the open: every sleeping place is inside a bedroom.
    for (const bed of home.beds) {
      assert.ok(
        sleeping.rooms.some((room) => bed.x >= room.x0 && bed.x <= room.x1 && bed.y >= room.y0 && bed.y <= room.y1),
        `seed ${seed}: ${bed.x},${bed.y} is a bed in a room, not four in a row across the floor`,
      );
    }
    const sim = new loadedPF.Sim(w);
    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    const taken = new Set();
    for (const name of ["Mera", "Pip", "Nel", "Rill"]) {
      const npc = sleeping.npcs.find((n) => n.name === name);
      assert.ok(npc, `seed ${seed}: ${name} is home at 23:00`);
      assert.ok(SLEEPS_ON.has(standingOn(sleeping, npc)), `seed ${seed}: ${name} is in a bed`);
      assert.ok(
        sleeping.rooms.some((room) => npc.x >= room.x0 && npc.x <= room.x1 && npc.y >= room.y0 && npc.y <= room.y1),
        `seed ${seed}: ${name} sleeps inside a bedroom (${npc.x},${npc.y})`,
      );
      assert.ok(!taken.has(`${npc.x},${npc.y}`), `seed ${seed}: ${name} shares a tile with a housemate`);
      taken.add(`${npc.x},${npc.y}`);
    }
  }
}

// 56. The inn's guests get ROOMS. One drifter sleeps behind a door of their own;
// a crowded inn packs the rooms that need it with bunks and leaves the room that
// does not with single beds — same building, same seed, only the density differs.
{
  const sealed = brief.validate(bedsBrief(), ctx);
  for (const seed of [1, 31, 424242]) {
    const w = world.build(seed, "cozy-village", sealed);
    const inn = findZone(w, "The Kettle");
    assert.ok(inn, `seed ${seed}: the gathering compiled`);
    // GUEST ROOMS UPSTAIRS (0.8.0 floors) — the classic inn. The wing is the same
    // wing it always was, laid by the same plan; only the zone it sits in moved,
    // so every assertion below reads the storey instead of the tap room.
    const wing = w.zones[`${inn.id}u`];
    assert.ok(wing, `seed ${seed}: the inn grew a guest storey`);
    assert.ok(wing.rooms.length >= 1, `seed ${seed}: the inn has guest rooms (${wing.rooms.length})`);
    assert.equal(
      partitionTiles(wing).doors.length,
      wing.rooms.length,
      `seed ${seed}: every guest room has a door — a guest walled in is un-talkable forever`,
    );
    for (const room of wing.rooms) {
      assert.ok(room.beds.length >= 1, `seed ${seed}: a guest room with no bed in it is a cupboard`);
      // A guest room is a room: its door is the only way in. Otherwise "guest
      // room" is a label on a corner of the common floor, which is what 0.7.x
      // already had.
      const shut = floodFill(wing, wing.spawn, new Set([`${room.doorX},${room.y1 + 1}`]));
      for (const bed of room.beds) {
        assert.ok(
          !shut.has(`${bed.x},${bed.y}`),
          `seed ${seed}: closing the guest room door leaves ${bed.x},${bed.y} open to the landing`,
        );
      }
    }
    const sim = new loadedPF.Sim(w);
    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    const wisp = wing.npcs.find((npc) => npc.name === "Wisp");
    assert.ok(wisp, `seed ${seed}: the drifter beds down in the inn's guest rooms`);
    const host = wing.rooms.find(
      (room) => wisp.x >= room.x0 && wisp.x <= room.x1 && wisp.y >= room.y0 && wisp.y <= room.y1,
    );
    assert.ok(host, `seed ${seed}: and inside one of them (${wisp.x},${wisp.y})`);
    assert.equal(standingOn(wing, wisp), "bed", `seed ${seed}: a solo guest gets a bed, not a bunk`);
  }

  // A thriving village builds seven berths over its three rooms → 3, 2, 2. The
  // three outruns what single beds fit along that room's wall and bunks; the twos
  // do not and do not. Same building, same seed — only the density differs.
  const cast = [{ name: "Host", role: "innkeep", kind: "host", tint: "orange", home: "The Long Rest", household: 1 }];
  for (let i = 0; i < 8; i++) {
    cast.push({
      name: `T${i}`,
      role: "drover",
      kind: "folk",
      tint: ["blue", "green", "amber", "rose", "teal", "violet", "grey", "red"][i],
      home: "Waystop",
      household: 2 + ((i / 3) | 0),
      standing: "transient",
    });
  }
  const busy = brief.validate(
    {
      scale: "village",
      prosperity: "thriving",
      name: "Waystop",
      places: [{ kind: "gathering", name: "The Long Rest" }],
      cast,
    },
    ctx,
  );
  assert.equal(busy.cast.filter((c) => c.standing === "transient").length, 8, "eight guests survive validation");
  for (const seed of [1, 5, 31]) {
    const w = world.build(seed, "cozy-village", busy);
    const inn = findZone(w, "The Long Rest");
    assert.ok(inn, `seed ${seed}: the busy inn compiled`);
    const wing = w.zones[`${inn.id}u`];
    assert.ok(wing, `seed ${seed}: with its guest storey over it`);
    const types = wing.rooms.map((room) => new Set(room.beds.map((bed) => wing.object[wing.w * bed.y + bed.x])));
    assert.ok(
      types.some((set) => set.has("bunk")),
      `seed ${seed}: the crowded guest rooms are bunked`,
    );
    assert.ok(
      types.some((set) => set.size === 1 && set.has("bed")),
      `seed ${seed}: and the room that is NOT crowded keeps single beds — density decides, not the building`,
    );
    // Everyone still lands on a tile of their own, wherever in the building they
    // ended up — the overflow stays in the tap room while the berths fill upstairs.
    const sim = new loadedPF.Sim(w);
    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    const taken = new Set();
    for (const { zone, npc } of underRoof(w, inn.id)) {
      const tile = `${zone.id}:${Math.round(npc.x)},${Math.round(npc.y)}`;
      assert.ok(!taken.has(tile), `seed ${seed}: ${npc.name} stacked on tile ${tile} in the inn`);
      taken.add(tile);
    }
    const guests = underRoof(w, inn.id).filter(({ npc }) => npc.name.startsWith("T"));
    assert.ok(guests.length >= 6, `seed ${seed}: the inn genuinely fills up (${guests.length} guests)`);
  }
}

// 57. Bunks come from the ROOM, never from who is sleeping in it. Two fixtures
// identical but for the cast kind — six children, six adults — must compile to
// the same sleeping tiles, so no rule of the form `kind === "child"` (or its
// mirror, "adults only") can survive here. And a lone child gets a plain single
// bed: one sleeper is not dense, whatever their age.
{
  for (const seed of [1, 3, 11]) {
    // NINE, not six. This case is about whether AGE changes the bedding, so it
    // has to be run at a density that bunks at all — and six stopped bunking when
    // the house learned to grow a third bedroom rather than crowd two. Nine is
    // past the three-room cap, so the room takes the extra bodies and the question
    // this fixture asks is live again.
    //
    // A household this size sleeps up the stairs (0.8.0 floors). Which floor is
    // not what this is about, so both sides are compared on the floor their
    // bedrooms are actually on. Nine rather than eight because nine divides evenly
    // across three rooms — eight leaves one room of two, which does not bunk, and
    // the assertion below is about EVERY bed.
    const built = (kind) => {
      const w = world.build(seed, "cozy-village", brief.validate(houseBrief("Wardhome", 9, kind), ctx));
      const home = findZone(w, "Kin0's home");
      assert.ok(home, `seed ${seed}: the ${kind} household compiled a dwelling`);
      return bedFloor(w, home);
    };
    const wards = built("child");
    const adults = built("folk");
    // Non-vacuous: both really are dense, and dense really does mean bunks.
    assert.equal(wards.beds.length, 9, `seed ${seed}: nine wards, nine places`);
    assert.ok(
      wards.beds.every((bed) => wards.object[wards.w * bed.y + bed.x] === "bunk"),
      `seed ${seed}: a house full of children at that density gets bunks`,
    );
    assert.ok(
      adults.beds.every((bed) => adults.object[adults.w * bed.y + bed.x] === "bunk"),
      `seed ${seed}: and so does a barracks of adults at the same density`,
    );
    assert.deepEqual(
      adults.object,
      wards.object,
      `seed ${seed}: the two interiors are tile-for-tile identical — the rule never read the cast`,
    );

    // The other direction: one child, alone in a bedroom, sleeps in a bed — and
    // on the GROUND floor, because one sleeper is a cottage and a cottage earns
    // no staircase (the upper-storey gate).
    const loneW = world.build(seed, "cozy-village", brief.validate(houseBrief("Onefold", 1, "child"), ctx));
    const lone = findZone(loneW, "Kin0's home");
    assert.ok(lone, `seed ${seed}: the one-child household compiled a dwelling`);
    assert.equal(loneW.zones[`${lone.id}u`], undefined, `seed ${seed}: and no storey over it`);
    assert.equal(lone.beds.length, 1, `seed ${seed}: one sleeper, one place`);
    assert.equal(
      lone.object[lone.w * lone.beds[0].y + lone.beds[0].x],
      "bed",
      `seed ${seed}: a lone child does not force a bunk — density does, and there is none`,
    );
    assert.ok(partitionTiles(lone).walls.length > 0, `seed ${seed}: and they still get a bedroom of their own`);
  }
}

// 58. Every sleeping tile is reachable on foot from the interior's entrance. A
// bedroom whose door gap was forgotten walls its sleeper off: the player can
// never reach them, and 25-schedule's placer would ring-scan them out of the
// room the compiler put them in. Flooded from the tile inside the front door,
// across every fixture in this file that sleeps anyone.
{
  const fixtures = [
    ["hearthwick", brief.validate(bedsBrief(), ctx)],
    ["bunked-bedrooms", brief.validate(houseBrief("Sixfold", 6, "folk"), ctx)],
    ["four", brief.validate(houseBrief("Fourfold", 4, "child"), ctx)],
    ["lone", brief.validate(houseBrief("Onefold", 1, "folk"), ctx)],
    ["dormitory", bunkhouseSealed(5)],
    ["town-inn", brief.validate({ ...bedsBrief(), scale: "town", prosperity: "thriving" }, ctx)],
    ["defaults", brief.defaults("cozy-village", 424242)],
    ["colony", brief.defaults("sci-fi-colony", 424242)],
  ];
  let checked = 0;
  let roomsChecked = 0;
  for (const [label, sealed] of fixtures) {
    for (const seed of [1, 3, 11, 424242]) {
      const w = world.build(seed, "cozy-village", sealed);
      for (const zone of Object.values(w.zones)) {
        // A building's `beds` list SPANS its floors (0.8.0), so ask each zone
        // about the sleeping tiles that are actually in it: flooding a ground
        // floor for a tile up the stairs would prove nothing either way. Quarters
        // ride along, which is free and strictly more coverage than before.
        const sleeping = [...(zone.beds ?? []), ...(zone.homeBeds ?? [])].filter((bed) => bed.zoneId === zone.id);
        // The BED loop is gated on there being beds. The ROOM loop is NOT — it
        // used to be, because both sat under one `continue`, and that skipped
        // the whole zone whenever it had rooms but no sleeping tiles of its own:
        // cellars, named-place ground floors, the ground floor of any house
        // whose band went upstairs. Measured at 89 of 225 interior zones over
        // this case's own fixtures. Rooms that are not bedrooms are the entire
        // premise of the room vocabulary, so the one loop that checks them has
        // to run on exactly the zones that have no beds.
        if (!sleeping.length && !zone.rooms.length) continue;
        const reached = floodFill(zone, zone.spawn);
        for (const bed of sleeping) {
          assert.ok(
            reached.has(`${bed.x},${bed.y}`),
            `${label} seed ${seed}: ${zone.name} walls off the sleeping tile ${bed.x},${bed.y}`,
          );
          checked++;
        }
        for (const room of zone.rooms) {
          // The door's OUTSIDE face — you can reach the doorway.
          assert.ok(
            reached.has(`${room.doorX},${room.y1 + 1}`),
            `${label} seed ${seed}: ${zone.name} has an unreachable room door at ${room.doorX},${room.y1 + 1}`,
          );
          // And its INSIDE face, and every walkable tile of the room. A
          // furnisher that lays a solid run along the row below the door leaves
          // the doorway reachable and the room sealed behind it — which is
          // precisely what a per-purpose furnisher is now able to do.
          assert.ok(
            reached.has(`${room.doorX},${room.y1}`),
            `${label} seed ${seed}: ${zone.name} room ${room.purpose} is sealed behind its own door`,
          );
          for (let ry = room.y0; ry <= room.y1; ry++) {
            for (let rx = room.x0; rx <= room.x1; rx++) {
              if (zone.solid[zone.w * ry + rx]) continue;
              assert.ok(
                reached.has(`${rx},${ry}`),
                `${label} seed ${seed}: ${zone.name} room ${room.purpose} walls off its own tile ${rx},${ry}`,
              );
            }
          }
          roomsChecked++;
        }
      }
    }
  }
  assert.ok(checked > 100, `the sweep actually visited sleeping tiles (${checked})`);
  // Counted separately, because `checked` counts BEDS: emptying zone.rooms
  // across the whole compiler would leave this case green on the bed count
  // alone. The room vocabulary needs its own non-vacuity floor.
  assert.ok(roomsChecked > 200, `the sweep actually visited rooms (${roomsChecked})`);
}

// 59. The open plan survives, for the roof that has genuinely earned it. Bunked
// bedrooms moved the line to NINE under one roof, which is past CAPS.household —
// no family can reach it, so a dormitory is no longer something a household can
// accidentally become. The compiler's own over-subscription merge reaches it:
// six households squeezed onto the last free lot is a bunkhouse, and a bunkhouse
// is what `dormitory()` was always for. Eight is the other side of the line and
// keeps its bedrooms, so neither half is vacuous.
{
  for (const seed of [1, 3, 11]) {
    const roofs = {};
    // hands + the FIVE named households, all of which the merge now sweeps onto
    // the one free lot an outpost has left after its three places. It used to be
    // four of them — the trader kept his own shop when there was a lot spare for
    // it — so the same sleeper counts need one fewer hand apiece.
    for (const [label, hands] of [
      ["eight", 3],
      ["nine", 4],
    ]) {
      const sealed = bunkhouseSealed(hands);
      assert.equal(sealed._repairs.length, 0, `${label}: the fixture seals untouched (${sealed._repairs.join("; ")})`);
      const w = world.build(seed, "cozy-village", sealed);
      const roof = findZone(w, "Ada's home");
      assert.ok(roof, `seed ${seed}: the ${label}-sleeper roof compiled`);
      // Non-vacuous in the way that matters: this is a MERGED block — several
      // whole households under one roof — not one household over its cap, which
      // the validator would have split before the compiler ever saw it.
      const households = new Set(sealed.cast.map((member) => member.household));
      assert.ok(households.size > 1, `seed ${seed}: ${households.size} households share the roof, so the merge fired`);
      // A MERGED block sleeps upstairs (0.8.0 floors), so the handle that sends
      // somebody to bed names the storey. Whether it is one floor or two, the
      // question is the same one: everybody who lives here sleeps here.
      const under = new Set(floorIds(w, roof.id));
      const sleepers = Object.values(w.zones)
        .flatMap((zone) => zone.npcs)
        .filter((npc) => under.has(npc._sched.home?.zoneId));
      assert.equal(sleepers.length, 5 + hands, `seed ${seed}: everyone in the ${label} fixture sleeps under it`);
      roofs[label] = bedFloor(w, roof);
    }
    // Eight is a crowded house and keeps its walls; nine is an institution.
    assert.ok(partitionTiles(roofs.eight).walls.length > 0, `seed ${seed}: eight under one roof still get bedrooms`);
    assert.equal(roofs.eight.rooms.length, 2, `seed ${seed}: two bedrooms, four to a room, all of them bunked`);
    assert.ok(
      roofs.eight.beds.every((bed) => roofs.eight.object[roofs.eight.w * bed.y + bed.x] === "bunk"),
      `seed ${seed}: four to a bedroom is the wall run bunked`,
    );
    const open = partitionTiles(roofs.nine);
    assert.equal(open.walls.length, 0, `seed ${seed}: nine goes open (${open.walls.join(" ")})`);
    assert.equal(open.doors.length, 0, `seed ${seed}: and has no interior doors (${open.doors.join(" ")})`);
    assert.equal(roofs.nine.rooms.length, 0, `seed ${seed}: and the compiler agrees it partitioned nothing`);
    assert.equal(roofs.nine.beds.length, 9, `seed ${seed}: nine sleepers, nine places`);
    for (const bed of roofs.nine.beds) {
      assert.equal(
        roofs.nine.object[roofs.nine.w * bed.y + bed.x],
        "bunk",
        `seed ${seed}: a bunkhouse sleeps its people in bunks (${bed.x},${bed.y})`,
      );
    }
  }

  // And the bunkhouse world holds every NPC invariant the others do, around the
  // clock: nine people resolving to one interior is the densest night the
  // compiler can produce, which is exactly where stacking would show up first.
  const sealed = bunkhouseSealed(5);
  for (const seed of [1, 3, 11]) {
    const w = world.build(seed, "cozy-village", sealed);
    const sim = new loadedPF.Sim(w);
    for (const min of [6 * 60, 12 * 60, 19 * 60, 23 * 60]) {
      sim.clockMin = min;
      sim.resolveSchedules();
      for (const zoneId in w.zones) {
        const z = w.zones[zoneId];
        const taken = new Set();
        for (const npc of z.npcs) {
          const x = Math.round(npc.x);
          const y = Math.round(npc.y);
          assert.ok(
            loadedPF.schedule.standable(z, x, y),
            `seed ${seed} @${min}: ${npc.name} stands somewhere legal in ${zoneId}`,
          );
          assert.ok(!taken.has(`${x},${y}`), `seed ${seed} @${min}: ${npc.name} shares a tile in ${zoneId}`);
          taken.add(`${x},${y}`);
        }
      }
    }
  }
}

// 60. THE INN IS BUILT TO A CAPACITY, never counted out of the guest list. Sized
// from however many transients the brief happened to name, the guest wing had a
// berth per drifter and not one spare — the inn was never quiet and never full,
// which is the one thing an inn is not for. It is sized from `scale` and
// `prosperity` now, so the same settlement builds the same wing whether nobody
// turns up or more people do than it holds.
const innBrief = (overrides, guests) => ({
  scale: "village",
  name: "Waystop",
  places: [{ kind: "gathering", name: "The Long Rest" }],
  cast: [
    { name: "Ada", role: "reeve", kind: "leader", tint: "blue", home: "Waystop", household: 1 },
    { name: "Perrin", role: "innkeep", kind: "host", tint: "orange", home: "The Long Rest", household: 2 },
    { name: "Cass", role: "cooper", kind: "folk", tint: "amber", home: "Waystop", household: 3 },
    { name: "Dell", role: "carter", kind: "folk", tint: "rose", home: "Waystop", household: 3 },
    ...Array.from({ length: guests }, (_, i) => ({
      name: `T${i}`,
      role: "drover",
      kind: "folk",
      tint: ["green", "teal", "violet", "grey", "red", "blue"][i % 6],
      home: "Waystop",
      household: 4,
      standing: "transient",
    })),
  ],
  ...overrides,
});
{
  const innOf = (w) => findZone(w, "The Long Rest");
  // The wing is UPSTAIRS (0.8.0 floors): the inn is one building with a tap room
  // and a landing of let rooms over it. `beds` is still asked of the building,
  // because "the fourth berth at the inn" cannot depend on which floor it is on.
  const wingOf = (w) => w.zones[`${innOf(w).id}u`];
  // The headline: an empty road and a crowded one build the SAME wing, tile for
  // tile. Anything that read the cast to size the guest rooms shows up here.
  for (const seed of [1, 5, 31, 424242]) {
    const quietW = world.build(seed, "cozy-village", brief.validate(innBrief({}, 0), ctx));
    const crowdedW = world.build(seed, "cozy-village", brief.validate(innBrief({}, 6), ctx));
    const quiet = innOf(quietW);
    const crowded = innOf(crowdedW);
    assert.ok(quiet && crowded, `seed ${seed}: both inns compiled`);
    // GUEST rooms are the storey's; the keeper's own quarters (Perrin is homed at
    // The Long Rest) stay downstairs behind the tap room, which is where a keeper
    // lives — the two lists were always carved from different bands.
    const guestRooms = (w) => wingOf(w).rooms.filter((room) => !room.quarters);
    assert.ok(guestRooms(quietW).length >= 3, `seed ${seed}: a village inn with no guests still has its wing`);
    assert.ok(quiet.beds.length >= guestRooms(quietW).length, `seed ${seed}: and a berth in every room of it`);
    assert.deepEqual(
      wingOf(crowdedW).object,
      wingOf(quietW).object,
      `seed ${seed}: the guest wing is the same wing either way`,
    );
    assert.deepEqual(crowded.object, quiet.object, `seed ${seed}: and the tap room under it is the same room`);
    assert.equal(
      JSON.stringify(crowded.beds),
      JSON.stringify(quiet.beds),
      `seed ${seed}: and the same berths, in the same claim order`,
    );
  }

  // Both axes move it, and only the table decides: zero transients throughout,
  // so nothing here can be reading the cast. `scale` is the size axis…
  const berths = (overrides) =>
    innOf(world.build(424242, "cozy-village", brief.validate(innBrief(overrides, 0), ctx))).beds.length;
  const bySize = ["outpost", "hamlet", "village", "town", "city"].map((scale) => berths({ scale }));
  assert.deepEqual(bySize, [4, 5, 6, 9, 11], `a bigger settlement builds a bigger inn (${bySize.join(",")})`);
  // …and `prosperity` is the means axis, a step either side of it.
  const byMeans = ["struggling", "modest", "thriving"].map((prosperity) => berths({ prosperity }));
  assert.deepEqual(byMeans, [5, 6, 7], `a richer village builds a roomier inn (${byMeans.join(",")})`);
  assert.equal(byMeans[1], bySize[2], "modest is the neutral step, so the two axes agree on a modest village");

  // The whole table, pinned. It is written to stay inside what the wing can
  // physically be — never under the rooms the band carves, never over what those
  // rooms hold bunked — and that is a property of the NUMBERS rather than of a
  // clamp, so it is checked here rather than defended in the compiler. Every
  // combination, zero transients throughout.
  // EVERY scale, city included. It was omitted when `city` shipped in 0.9, and
  // the assertion below -- already written, already correct -- then sat
  // unreached while a thriving city compiled a bunkhouse.
  const built = {};
  for (const scale of ["outpost", "hamlet", "village", "town", "city"]) {
    for (const prosperity of ["struggling", "modest", "thriving"]) {
      const w = world.build(424242, "cozy-village", brief.validate(innBrief({ scale, prosperity }, 0), ctx));
      const inn = innOf(w);
      const label = `${scale}/${prosperity}`;
      built[label] = inn.beds.length;
      // Over the top of the range the wing stops being a wing: it falls through
      // to the open plan and the inn is a bunkhouse with a bar.
      const wing = w.zones[`${inn.id}u`];
      const guests = wing.rooms.filter((room) => !room.quarters);
      assert.ok(guests.length > 0, `${label}: the inn keeps guest ROOMS`);
      // The bound itself, as arithmetic rather than inferred from the collapse
      // it causes: a new scale added to the table is caught HERE, with a number,
      // instead of downstream as a missing room.
      assert.ok(
        inn.beds.length <= 12,
        `${label}: ${inn.beds.length} berths exceeds what the wing holds bunked (12) — the table must bound scale PLUS prosperity`,
      );
      for (const floor of [inn, wing]) {
        assert.equal(partitionTiles(floor).doors.length, floor.rooms.length, `${label}: a door on every room`);
      }
      // Under the bottom of it, rooms outnumber berths and one is a cupboard.
      assert.ok(inn.beds.length >= guests.length, `${label}: ${guests.length} guest rooms, ${inn.beds.length} berths`);
      assert.equal(
        inn.beds.length,
        new Set(inn.beds.map((bed) => `${bed.zoneId}:${bed.x},${bed.y}`)).size,
        `${label}: no berth is dealt twice`,
      );
    }
  }
  assert.deepEqual(
    built,
    {
      "outpost/struggling": 3,
      "outpost/modest": 4,
      "outpost/thriving": 5,
      "hamlet/struggling": 4,
      "hamlet/modest": 5,
      "hamlet/thriving": 6,
      "village/struggling": 5,
      "village/modest": 6,
      "village/thriving": 7,
      "town/struggling": 8,
      "town/modest": 9,
      "town/thriving": 10,
      // A city tops out AT the wing's capacity, never over it. 12 is the bound,
      // so thriving lands on it exactly and there is no room left for a table
      // entry of 12 -- which is the mistake this row is pinned to prevent.
      "city/struggling": 10,
      "city/modest": 11,
      "city/thriving": 12,
    },
    `every settlement builds the inn its size and means say (${JSON.stringify(built)})`,
  );

  // Over-subscription: more guests than berths still puts everyone somewhere.
  // The berths go in cast order and whoever arrives after the last one takes the
  // common room, which is the fallback that has always been there.
  const packed = brief.validate(innBrief({ prosperity: "struggling" }, 6), ctx);
  assert.equal(packed.cast.filter((c) => (c.standing ?? "resident") === "transient").length, 6, "six guests sealed");
  for (const seed of [1, 5, 31]) {
    const w = world.build(seed, "cozy-village", packed);
    const inn = innOf(w);
    assert.ok(inn.beds.length < 6, `seed ${seed}: the fixture really does over-subscribe (${inn.beds.length} berths)`);
    const sim = new loadedPF.Sim(w);
    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    // The building, both floors: the berths fill upstairs and whoever arrives
    // after the last one is still down in the common room, which is what "no room
    // left" has always meant.
    const guests = underRoof(w, inn.id).filter(({ npc }) => npc.name.startsWith("T"));
    assert.equal(guests.length, 6, `seed ${seed}: every guest beds down at the inn (${guests.length})`);
    const taken = new Set();
    let inBed = 0;
    for (const { zone, npc } of guests) {
      const tile = `${zone.id}:${npc.x},${npc.y}`;
      assert.ok(!taken.has(tile), `seed ${seed}: ${npc.name} stacked on tile ${tile}`);
      taken.add(tile);
      assert.ok(loadedPF.schedule.standable(zone, npc.x, npc.y), `seed ${seed}: ${npc.name} stands somewhere legal`);
      if (SLEEPS_ON.has(standingOn(zone, npc))) inBed++;
    }
    assert.equal(inBed, inn.beds.length, `seed ${seed}: every berth is claimed (${inBed} of ${inn.beds.length})`);
    assert.ok(inBed < guests.length, `seed ${seed}: and the overflow is genuinely bedless, in the common room`);
  }
}

// ── Live-work premises: a workplace is a home (0.8.0) ────────────────────────
// The complaint this answers: a tradesman consumed TWO of a settlement's lots —
// the shop they worked AND a separate house — for ONE household. Lot supply is
// tiny at the small end (an outpost's rows fit two buildings), so the specials
// ate every lot and NO household got a dwelling: nobody was in a bed at night at
// the two smallest scales, which is the whole of what 0.8.0 was for.

/** A settlement with one of each side of the split: a smith who lives over the
 *  forge with their child (LIVE-WORK), a farming family (LIVE-WORK), a watchman
 *  who keeps a post nobody lives in (DUTY STATION), and an innkeep homed at the
 *  inn the brief named. */
const liveWorkBrief = (overrides = {}) => ({
  scale: "village",
  name: "Anvilrest",
  places: [{ kind: "gathering", name: "The Anvil" }],
  cast: [
    { name: "Sten", role: "smith", kind: "maker", tint: "amber", home: "Anvilrest", household: 1 },
    { name: "Wren", role: "apprentice", kind: "child", tint: "green", home: "Anvilrest", household: 1 },
    { name: "Tam", role: "farmer", kind: "grower", tint: "teal", home: "Anvilrest", household: 2 },
    { name: "Gil", role: "watch", kind: "guard", tint: "blue", home: "Anvilrest", household: 3 },
    { name: "Perrin", role: "innkeep", kind: "host", tint: "orange", home: "The Anvil", household: 4 },
  ],
  ...overrides,
});

// 61. A TRADE HOUSEHOLD SLEEPS IN ITS WORKPLACE. The smith and their child are
// both inside the smithy at 23:00, on sleeping tiles of their own, behind a
// bedroom door laid by the same machinery any other family gets — and no second
// "Sten's home" roof exists anywhere, which is the lot the old shape wasted.
{
  const sealed = brief.validate(liveWorkBrief(), ctx);
  assert.equal(
    sealed.cast.filter((c) => c.household === 1).length,
    2,
    "the smith and the child stay ONE household — a split would test a different building",
  );
  for (const seed of [1, 3, 11, 424242]) {
    const w = world.build(seed, "cozy-village", sealed);
    checkWorld(w, sealed, `live-work seed ${seed}`);
    const forge = findZone(w, "Sten's shop");
    assert.ok(forge, `seed ${seed}: the smithy compiled a room`);
    assert.equal(forge.mapExport, false, `seed ${seed}: it is a building, not a second map destination`);
    assert.ok(
      !Object.values(w.zones).some((zone) => zone.name === "Sten's home"),
      `seed ${seed}: and no separate house is minted for the same household`,
    );
    // The same rooms-and-beds machinery, not a special case — and the smith who
    // RUNS the forge gets a room of his own, so the child gets the other.
    assert.equal(forge.rooms.length, 2, `seed ${seed}: the smith's room and the child's (${forge.rooms.length})`);
    assert.equal(partitionTiles(forge).doors.length, 2, `seed ${seed}: a door on each`);
    const own = forge.rooms.find((room) => room.private);
    assert.ok(own, `seed ${seed}: one of them is the owner's own`);
    assert.equal(own.beds.length, 1, `seed ${seed}: single occupancy (${own.beds.length} beds)`);
    assert.ok(forge.object.includes("counter"), `seed ${seed}: it is still a shop — a counter to be served over`);

    const sim = new loadedPF.Sim(w);
    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    const taken = new Set();
    for (const name of ["Sten", "Wren"]) {
      const npc = forge.npcs.find((n) => n.name === name);
      assert.ok(npc, `seed ${seed}: ${name} is inside the smithy at 23:00`);
      assert.ok(SLEEPS_ON.has(forge.object[forge.w * npc.y + npc.x]), `seed ${seed}: ${name} is in a bed`);
      assert.ok(
        forge.rooms.some((room) => npc.x >= room.x0 && npc.x <= room.x1 && npc.y >= room.y0 && npc.y <= room.y1),
        `seed ${seed}: ${name} sleeps inside the bedroom (${npc.x},${npc.y})`,
      );
      assert.ok(!taken.has(`${npc.x},${npc.y}`), `seed ${seed}: ${name} shares a tile with the other sleeper`);
      taken.add(`${npc.x},${npc.y}`);
    }
    // By day the shop is a shop: the owner mans the counter, the child does not.
    sim.clockMin = 12 * 60;
    sim.resolveSchedules();
    const sten = forge.npcs.find((n) => n.name === "Sten");
    assert.ok(sten, `seed ${seed}: the smith works the shop by day`);
    assert.equal(
      forge.object[forge.w * (sten.y + 1) + sten.x],
      "counter",
      `seed ${seed}: standing behind the counter, not out in front of it`,
    );
    assert.ok(
      !forge.npcs.some((n) => n.name === "Wren"),
      `seed ${seed}: the smith's child is not put to work behind the counter`,
    );
    // The counter is the OWNER's station, not the household's. Living over the
    // shop moved the whole family into the building's records, and a plain
    // "lives here" test would have put the child on the shop's work post too.
    const wrenSched = Object.values(w.zones)
      .flatMap((zone) => zone.npcs)
      .find((npc) => npc.name === "Wren")._sched;
    assert.equal(
      wrenSched.post.zoneId,
      "z1",
      `seed ${seed}: the child's day anchor is the settlement, not the counter`,
    );
    sim.clockMin = 19 * 60;
    sim.resolveSchedules();
    assert.ok(
      !forge.npcs.some((n) => n.name === "Wren"),
      `seed ${seed}: and at dusk they are out on the apron, not behind the counter`,
    );
    assert.ok(
      forge.npcs.some((n) => n.name === "Sten"),
      `seed ${seed}: while the smith is still working the shop`,
    );
  }
}

// 62. A farm is a farmHOUSE, and a guard post is not. `grower -> farm` gained an
// interior because a farming family lives on the farm; `guard -> post` stays a
// facade on purpose (maintainer call) — nobody lives in a duty station, so the
// watchman keeps an ordinary household dwelling and the post mints no zone at
// all. Both halves are asserted, so neither can quietly flip.
{
  const sealed = brief.validate(liveWorkBrief(), ctx);
  for (const seed of [1, 3, 11, 424242]) {
    const w = world.build(seed, "cozy-village", sealed);
    const farm = findZone(w, "Tam's farm");
    assert.ok(farm, `seed ${seed}: the farm compiled an interior`);
    assert.equal(farm.mapExport, false, `seed ${seed}: a farmhouse is a building, not a map destination`);
    assert.ok(farm.beds.length >= 1, `seed ${seed}: with a bed in it (${farm.beds.length})`);
    // Reachable on foot from the settlement, both ways.
    assert.ok(
      w.zones.z1.portals.some((portal) => portal.toZone === farm.id),
      `seed ${seed}: the settlement has a door into the farm`,
    );
    assert.ok(
      farm.portals.some((portal) => portal.toZone === "z1"),
      `seed ${seed}: and the farm has one back out`,
    );
    for (const bed of farm.beds) {
      assert.ok(
        floodFill(farm, farm.spawn).has(`${bed.x},${bed.y}`),
        `seed ${seed}: the farm's bed at ${bed.x},${bed.y} is walled off`,
      );
    }

    // The post: no interior anywhere, and its door opens onto nothing. Counted
    // against the doors so the claim cannot go vacuous by the post vanishing.
    assert.ok(
      !Object.values(w.zones).some((zone) => zone.name === "Gil's post"),
      `seed ${seed}: a duty station mints no zone to sleep in`,
    );
    const v = w.zones.z1;
    const doorTiles = new Set();
    v.object.forEach((tile, index) => {
      if (tile === "door") doorTiles.add(`${index % v.w},${(index / v.w) | 0}`);
    });
    const opened = new Set(v.portals.filter((p) => doorTiles.has(`${p.x},${p.y}`)).map((p) => p.toZone));
    // Exactly ONE door in the settlement opens onto nothing, and it is the post's.
    // This used to be spelled "five doors, four of them open", which stopped being
    // a statement about the post the moment the compiler began minting houses of
    // its own — the total moved, the claim did not. A difference of one says the
    // same thing and keeps saying it however big the town gets.
    assert.ok(
      doorTiles.size >= 5,
      `seed ${seed}: inn, smithy, farm, post and the watchman's house all stand (${doorTiles.size} doors)`,
    );
    assert.equal(
      doorTiles.size - opened.size,
      1,
      `seed ${seed}: exactly one facade — the post (${doorTiles.size} doors, ${opened.size} open)`,
    );

    const sim = new loadedPF.Sim(w);
    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    const tam = farm.npcs.find((npc) => npc.name === "Tam");
    assert.ok(tam, `seed ${seed}: the farmer sleeps on the farm`);
    assert.ok(SLEEPS_ON.has(farm.object[farm.w * tam.y + tam.x]), `seed ${seed}: in a bed of their own`);
    // The watchman keeps the night — that is the schedule, not a housing gap —
    // and comes off watch to a real bed in a real house of their own.
    const house = findZone(w, "Gil's home");
    assert.ok(house, `seed ${seed}: the watchman keeps an ordinary dwelling`);
    assert.ok(
      w.zones.z1.npcs.some((npc) => npc.name === "Gil"),
      `seed ${seed}: and is out on watch at 23:00`,
    );
    sim.clockMin = 6 * 60;
    sim.resolveSchedules();
    const abed = house.npcs.find((npc) => npc.name === "Gil");
    assert.ok(abed, `seed ${seed}: off watch he goes home`);
    assert.ok(SLEEPS_ON.has(house.object[house.w * abed.y + abed.x]), `seed ${seed}: to his own bed`);
  }
}

// 63. HOUSING COMPLETENESS, AT EVERY SCALE. The case the original bug would have
// tripped: at 23:00 on an outpost, with three trades in a five-person cast, not
// one resident was in a bed — the specials had eaten both of the outpost's two
// lots and no dwelling was ever built.
//
// "Everyone" here is every RESIDENT homed at the settlement root: the population
// the settlement's own housing arithmetic owes a roof. A resident the brief homed
// at a named place lives there by the brief's own instruction, and a non-resident
// (fringe, transient, destitute) is housed by their standing — case 64 pins that
// those are not counted as failures.
//
// Asserted at the daypart each NPC's own schedule sends them home, not blindly at
// 23:00: the watch keeps the night by design, so a guard is in bed at dawn. Both
// halves are checked — sent home implies in bed, and everyone reaches a bed at
// some daypart — so neither can excuse a real gap.
const DAYPART_CLOCK = { dawn: 6 * 60, day: 12 * 60, dusk: 19 * 60, night: 23 * 60 };
const SPECIAL_KINDS = ["leader", "host", "grower", "guard", "merchant", "maker", "elder"];
function assertEveryoneHoused(sealed, label, seeds = [1, 3, 11, 424242], minOwed = 3) {
  const rootName = sealed._ids.zones.z1;
  const owed = sealed.cast.filter((c) => (c.standing ?? "resident") === "resident" && c.home === rootName);
  // Non-vacuous: a cast that is empty, or that carries no trade, cannot fail the
  // way the original bug failed. `minOwed` is per-fixture because the stock
  // briefs really do only root TWO of their four (the keeper lives at the inn
  // and the forager in the woods), and a floor written for the hand-built
  // shapes would just be wrong about them rather than stricter.
  assert.ok(owed.length >= minOwed, `${label}: the fixture actually houses people (${owed.length})`);
  assert.ok(
    owed.some((member) => SPECIAL_KINDS.includes(member.kind)),
    `${label}: and at least one of them runs a special building`,
  );
  for (const seed of seeds) {
    const w = world.build(seed, "cozy-village", sealed);
    checkWorld(w, sealed, `${label} seed ${seed}`);
    const sim = new loadedPF.Sim(w);
    const slept = new Set();
    for (const [daypart, clock] of Object.entries(DAYPART_CLOCK)) {
      sim.clockMin = clock;
      sim.resolveSchedules();
      for (const member of owed) {
        const found = Object.values(w.zones)
          .map((zone) => ({ zone, npc: zone.npcs.find((n) => n.name === member.name) }))
          .find((hit) => hit.npc);
        assert.ok(found, `${label} seed ${seed} @${daypart}: ${member.name} is somewhere in the world`);
        const { zone, npc } = found;
        const sleeping = SLEEPS_ON.has(zone.object[zone.w * npc.y + npc.x]);
        // Sent to bed => IN bed. This is the assertion the bug would have fired.
        if (loadedPF.schedule.resolve(npc._sched, daypart) === npc._sched.home) {
          assert.ok(
            sleeping,
            `${label} seed ${seed} @${daypart}: ${member.name} was sent home and is not on a bed (${zone.id} ${npc.x},${npc.y})`,
          );
        }
        if (sleeping) slept.add(member.name);
      }
    }
    // And every one of them sleeps SOMEWHERE in the day — a resident whose
    // schedule never sends them to a bed is exactly the hole this case is for.
    for (const member of owed) {
      assert.ok(slept.has(member.name), `${label} seed ${seed}: ${member.name} never reaches a bed at any daypart`);
    }
  }
}
{
  // The shape from the bug report: five people, three trades, no named places.
  const tradeCast = (name) => [
    { name: "Sten", role: "smith", kind: "maker", tint: "amber", home: name, household: 1 },
    { name: "Tam", role: "farmer", kind: "grower", tint: "green", home: name, household: 2 },
    { name: "Ada", role: "reeve", kind: "leader", tint: "blue", home: name, household: 3 },
    { name: "Cass", role: "cooper", kind: "folk", tint: "rose", home: name, household: 4 },
    { name: "Dell", role: "carter", kind: "folk", tint: "teal", home: name, household: 5 },
  ];
  // A duty-heavy shape: a watch and a hall, neither of which houses anybody, so
  // every household still needs a dwelling of its own.
  const dutyCast = (name) => [
    { name: "Ada", role: "reeve", kind: "leader", tint: "blue", home: name, household: 1 },
    { name: "Gil", role: "watch", kind: "guard", tint: "red", home: name, household: 2 },
    { name: "Rin", role: "sentry", kind: "guard", tint: "grey", home: name, household: 3 },
    { name: "Cass", role: "cooper", kind: "folk", tint: "rose", home: name, household: 4 },
  ];
  // A big family plus the trades that used to displace it.
  const familyCast = (name) => [
    ...Array.from({ length: 6 }, (_, i) => ({
      name: `Kin${i}`,
      role: "hand",
      kind: i ? "child" : "folk",
      tint: ["blue", "green", "amber", "rose", "teal", "violet"][i],
      home: name,
      household: 1,
    })),
    { name: "Sten", role: "smith", kind: "maker", tint: "red", home: name, household: 2 },
    { name: "Tam", role: "farmer", kind: "grower", tint: "grey", home: name, household: 3 },
  ];
  for (const scale of ["outpost", "hamlet", "village", "town"]) {
    for (const [shape, cast, places] of [
      ["trades", tradeCast, []],
      ["duties", dutyCast, []],
      ["family", familyCast, []],
      // Named places take lots first — but never the LAST one while anybody is
      // still owed a roof, which is the reservation that makes the small scales
      // work at all.
      [
        "places",
        tradeCast,
        [
          { kind: "gathering", name: "The Kettle" },
          { kind: "hall", name: "The Moot" },
        ],
      ],
    ]) {
      const name = `${shape}-${scale}`;
      assertEveryoneHoused(brief.validate({ scale, name, places, cast: cast(name) }, ctx), `${shape}/${scale}`);
    }
  }
  // Both stock briefs, at every scale, for the same promise.
  for (const theme of ["cozy-village", "sci-fi-colony"]) {
    for (const scale of ["outpost", "hamlet", "village", "town"]) {
      assertEveryoneHoused(
        brief.validate({ ...brief.defaults(theme, 424242), scale }, ctx),
        `defaults(${theme})/${scale}`,
        [1, 424242],
        2,
      );
    }
  }
}

// 64. A FRINGE RESIDENT IS NOT HOUSED IN THE SETTLEMENT, and that is not a gap.
// They live in the wilds — no dwelling, no bed, no lot — so the completeness
// invariant above has to be scoped to who the settlement actually owes a roof,
// and this is the case that says so out loud.
{
  const sealed = brief.validate(
    {
      scale: "hamlet",
      name: "Edgewood",
      places: [{ kind: "wilds", name: "The Reach" }],
      cast: [
        { name: "Sten", role: "smith", kind: "maker", tint: "amber", home: "Edgewood", household: 1 },
        { name: "Tam", role: "farmer", kind: "grower", tint: "green", home: "Edgewood", household: 2 },
        { name: "Cass", role: "cooper", kind: "folk", tint: "rose", home: "Edgewood", household: 3 },
        {
          name: "Wyn",
          role: "hermit",
          kind: "wanderer",
          tint: "teal",
          home: "Edgewood",
          household: 4,
          standing: "fringe",
        },
      ],
    },
    ctx,
  );
  assert.equal(sealed.cast.find((c) => c.name === "Wyn").standing, "fringe", "the outsider seals as fringe");
  // The settlement's own people are all housed — so the fringe exemption below
  // is an exemption, not the reason the case passes.
  assertEveryoneHoused(sealed, "fringe-hamlet");
  const woodsId = Object.entries(sealed._ids.zones).find(([, n]) => n === "The Reach")?.[0];
  for (const seed of [1, 3, 11]) {
    const w = world.build(seed, "cozy-village", sealed);
    const sim = new loadedPF.Sim(w);
    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    const wyn = w.zones[woodsId].npcs.find((npc) => npc.name === "Wyn");
    assert.ok(wyn, `seed ${seed}: the fringe hermit spends the night out in the wilds`);
    assert.equal(wyn._sched.home, null, `seed ${seed}: with no dwelling handle at all`);
    assert.ok(
      !Object.values(w.zones).some((zone) => zone.name === "Wyn's home"),
      `seed ${seed}: and no house is built for someone who does not live in the settlement`,
    );
  }
}

// ── Living quarters in a building the brief NAMED (0.8.0) ────────────────────
// The complaint this answers: `home` naming a place is the sanctioned way for a
// brief to say "this person lives here" — it is how a sanctuary's keeper has
// always worked and it is the escape hatch for a lord living in a keep — but the
// compiler laid sleeping only in the buildings it minted ITSELF. So the chaplain
// stood on the bare floor of her own church at midnight and the alewife on the
// floor of her own tap room, in the maintainer's own playtest seed.

/** The reported world: Bellwether, village, seed 80021. A chaplain homed at the
 *  sanctuary, an alewife homed at the inn, a smith and a weaver at the root. */
const bellwetherBrief = (overrides = {}) => ({
  scale: "village",
  name: "Bellwether",
  places: [
    { kind: "sanctuary", name: "St Brannock's" },
    { kind: "gathering", name: "The Ploughshare" },
  ],
  cast: [
    { name: "Ivy", role: "chaplain", kind: "elder", tint: "rose", home: "St Brannock's", household: 1 },
    { name: "Bett", role: "alewife", kind: "host", tint: "amber", home: "The Ploughshare", household: 2 },
    { name: "Tam", role: "smith", kind: "maker", tint: "green", home: "Bellwether", household: 3 },
    { name: "Nan", role: "weaver", kind: "folk", tint: "blue", home: "Bellwether", household: 4 },
  ],
  ...overrides,
});

// 65. A RESIDENT HOMED AT A NAMED PLACE SLEEPS IN IT. The keeper in her own
// church and the alewife over her own tap room, both on a bed at 23:00, in the
// seed the report named and in others.
{
  const sealed = brief.validate(bellwetherBrief(), ctx);
  // Non-vacuous: the two of them really are homed at places and not at the root,
  // which is the whole shape under test.
  const homeOf = (name) => sealed.cast.find((c) => c.name === name).home;
  assert.equal(homeOf("Ivy"), "St Brannock's", "the chaplain is homed at the church");
  assert.equal(homeOf("Bett"), "The Ploughshare", "the alewife is homed at the inn");
  for (const seed of [80021, 1, 3, 424242]) {
    const w = world.build(seed, "cozy-village", sealed);
    checkWorld(w, sealed, `bellwether seed ${seed}`);
    const church = findZone(w, "St Brannock's");
    const inn = findZone(w, "The Ploughshare");
    assert.ok(church && inn, `seed ${seed}: both named buildings compiled`);
    // They keep their World Maps row: a named place is a destination, and living
    // quarters inside it change nothing about that.
    assert.equal(church.mapExport, true, `seed ${seed}: the church is still a map destination`);
    assert.equal(inn.mapExport, true, `seed ${seed}: and so is the inn`);

    const sim = new loadedPF.Sim(w);
    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    for (const [name, zone] of [
      ["Ivy", church],
      ["Bett", inn],
    ]) {
      const npc = zone.npcs.find((n) => n.name === name);
      assert.ok(npc, `seed ${seed}: ${name} is inside ${zone.name} at 23:00`);
      assert.ok(
        SLEEPS_ON.has(zone.object[zone.w * npc.y + npc.x]),
        `seed ${seed}: ${name} is on a bed in ${zone.name}, not its bare floor (${npc.x},${npc.y})`,
      );
      assert.ok(
        zone.rooms.some(
          (room) => room.quarters && npc.x >= room.x0 && npc.x <= room.x1 && npc.y >= room.y0 && npc.y <= room.y1,
        ),
        `seed ${seed}: ${name} sleeps in the building's own quarters, behind a door`,
      );
    }
    // And the two at the root are housed exactly as before.
    for (const [name, zoneName] of [
      ["Tam", "Tam's shop"],
      ["Nan", "Nan's home"],
    ]) {
      const zone = findZone(w, zoneName);
      const npc = zone?.npcs.find((n) => n.name === name);
      assert.ok(npc, `seed ${seed}: ${name} is home in ${zoneName}`);
      assert.ok(SLEEPS_ON.has(zone.object[zone.w * npc.y + npc.x]), `seed ${seed}: ${name} is in a bed`);
    }
  }
  // A building the brief homes NOBODY in grows nothing: the quarters are opt-in,
  // so every world that never used this compiles exactly the tiles it always did.
  const empty = brief.validate(
    bellwetherBrief({
      cast: bellwetherBrief().cast.map((member) => ({ ...member, home: "Bellwether" })),
    }),
    ctx,
  );
  for (const seed of [80021, 1]) {
    const w = world.build(seed, "cozy-village", empty);
    const church = findZone(w, "St Brannock's");
    assert.equal(church.h, 14, `seed ${seed}: a church nobody lives in keeps its own height (${church.h})`);
    assert.equal(church.rooms.length, 0, `seed ${seed}: and partitions nothing`);
  }
}

// 65b. A NAMED HOME THE SETTLEMENT HAD NO ROOM FOR. An outpost's rows fit two
// buildings; this brief names two places AND has two root households, so one
// place is dropped (the facade guard — a named room with no door strands whoever
// lives in it). The resident homed at the dropped one lives in a building that
// does not exist, so the town owes them a roof like anyone else. Before this they
// spent the night on the plaza in a settlement they are a resident of.
{
  // RE-SHAPED TWICE, exactly as the note below instructed. The outpost used to
  // lay two lots, so two places plus two root households over-subscribed it on
  // their own. The street-grid allocator lays four, and then the validator
  // learned to seal only as many places as a rank can actually seat — so no
  // brief that survives validation can over-subscribe the ground any more, and
  // the drop guard became unreachable through the front door.
  //
  // That is the RIGHT end state and it is worth keeping proven: the guard is the
  // floor under a promise the validator now keeps, not dead code. To reach it we
  // seal at a rank that permits four places and then hand the compiler the
  // smaller ground, which is precisely the shape a future scale change would
  // produce by accident.
  const sealed = brief.validate(
    bellwetherBrief({
      scale: "village",
      places: [
        { kind: "sanctuary", name: "St Brannock's" },
        { kind: "gathering", name: "The Ploughshare" },
        { kind: "hall", name: "The Moot" },
        { kind: "workshop", name: "The Forge Yard" },
      ],
      // Somebody has to LIVE at the place that gets dropped, or the fallback
      // under test is never entered. Places claim lots in claim order, so the
      // resident goes at the end of the list where the ground runs out.
      cast: [
        ...bellwetherBrief().cast,
        { name: "Orrin", role: "yardman", kind: "folk", tint: "teal", home: "The Forge Yard", household: 5 },
      ],
    }),
    ctx,
  );
  sealed.scale = "outpost";
  const NAMED = ["St Brannock's", "The Ploughshare", "The Moot", "The Forge Yard"];
  for (const seed of [80021, 1, 3, 424242]) {
    const w = world.build(seed, "cozy-village", sealed);
    checkWorld(w, sealed, `dropped-home seed ${seed}`);
    // Non-vacuous: the ground really did run out, so the fallback really is the
    // path under test rather than a branch nothing reaches.
    const built = NAMED.filter((name) => findZone(w, name));
    assert.ok(
      built.length < NAMED.length,
      `seed ${seed}: the outpost cannot hold all four named places (built ${built.join()})`,
    );
    // And whoever was homed at a dropped one is not left standing in the square.
    const stranded = sealed.cast.filter((c) => NAMED.includes(c.home) && !built.includes(c.home));
    assert.ok(stranded.length > 0, `seed ${seed}: somebody really is homed at a dropped place`);
    const sim = new loadedPF.Sim(w);
    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    for (const name of ["Ivy", "Bett", "Tam", "Nan", "Orrin"]) {
      const hit = Object.values(w.zones)
        .map((zone) => ({ zone, npc: zone.npcs.find((n) => n.name === name) }))
        .find((entry) => entry.npc);
      assert.ok(hit, `seed ${seed}: ${name} is somewhere in the world`);
      assert.ok(
        SLEEPS_ON.has(hit.zone.object[hit.zone.w * hit.npc.y + hit.npc.x]),
        `seed ${seed}: ${name} is on a bed at 23:00, not the plaza (${hit.zone.id} ${hit.npc.x},${hit.npc.y})`,
      );
    }
  }
}

// 66. THE KEEPER'S BED IS NOT A GUEST BERTH. An inn rents rooms; the woman who
// runs it is not a lodger. The two lists are carved from different bands of the
// building and never intersect — a keeper bedded down in a rented room is wrong,
// and a traveller handed the keeper's bed is worse.
{
  const innkeepBrief = (guests) => ({
    scale: "village",
    name: "Waymeet",
    places: [{ kind: "gathering", name: "The Ploughshare" }],
    cast: [
      { name: "Bett", role: "alewife", kind: "host", tint: "amber", home: "The Ploughshare", household: 1 },
      { name: "Pip", role: "pot-boy", kind: "child", tint: "green", home: "The Ploughshare", household: 1 },
      { name: "Nan", role: "weaver", kind: "folk", tint: "blue", home: "Waymeet", household: 2 },
      { name: "Tam", role: "smith", kind: "maker", tint: "teal", home: "Waymeet", household: 3 },
      ...Array.from({ length: guests }, (_, i) => ({
        name: `T${i}`,
        role: "drover",
        kind: "folk",
        tint: ["rose", "violet", "grey", "red"][i % 4],
        home: "Waymeet",
        household: 4,
        standing: "transient",
      })),
    ],
  });
  for (const guests of [1, 4]) {
    const sealed = brief.validate(innkeepBrief(guests), ctx);
    assert.equal(
      sealed.cast.filter((c) => (c.standing ?? "resident") === "transient").length,
      guests,
      `${guests} guests sealed — a fixture with none would make the overlap check vacuous`,
    );
    for (const seed of [1, 3, 11, 424242]) {
      const w = world.build(seed, "cozy-village", sealed);
      checkWorld(w, sealed, `innkeep(${guests}) seed ${seed}`);
      const inn = findZone(w, "The Ploughshare");
      assert.ok(inn, `seed ${seed}: the inn compiled`);
      // Non-vacuous both ways: there are berths AND there are quarters. The two
      // lists were always carved from different bands; with the wing upstairs
      // (0.8.0 floors) they are on different FLOORS, so every key here carries
      // the zone — a tile number alone would now match across a staircase.
      assert.ok(inn.beds.length >= 3, `seed ${seed}: the guest wing has berths (${inn.beds.length})`);
      assert.equal(inn.homeBeds.length, 2, `seed ${seed}: and the keeper's household has beds of its own`);
      const key = (bed) => `${bed.zoneId}:${bed.x},${bed.y}`;
      const berth = new Set(inn.beds.map(key));
      for (const bed of inn.homeBeds) {
        assert.ok(!berth.has(key(bed)), `seed ${seed}: the keeper's bed at ${key(bed)} is also being rented out`);
      }
      // And in the handles: the keeper sleeps in the quarters, every guest in the
      // wing, nobody in anybody else's.
      const sim = new loadedPF.Sim(w);
      sim.clockMin = 23 * 60;
      sim.resolveSchedules();
      const home = new Set(inn.homeBeds.map(key));
      for (const name of ["Bett", "Pip"]) {
        const npc = inn.npcs.find((n) => n.name === name);
        assert.ok(npc, `seed ${seed}: ${name} sleeps at the inn they live in — downstairs, behind the tap room`);
        assert.ok(home.has(`${inn.id}:${npc.x},${npc.y}`), `seed ${seed}: ${name} is in their OWN bed, not a let room`);
      }
      const lodgers = underRoof(w, inn.id).filter(({ npc }) => npc.name.startsWith("T"));
      assert.equal(lodgers.length, guests, `seed ${seed}: all ${guests} guests are somewhere in the inn`);
      for (const { zone, npc } of lodgers) {
        assert.ok(
          !home.has(`${zone.id}:${npc.x},${npc.y}`),
          `seed ${seed}: guest ${npc.name} was put in the keeper's bed (${npc.x},${npc.y})`,
        );
        const handle = npc._sched.home;
        if (handle && handle.wander.x0 === handle.wander.x1 && handle.wander.y0 === handle.wander.y1) {
          assert.ok(
            berth.has(`${handle.zoneId}:${handle.wander.x0},${handle.wander.y0}`),
            `seed ${seed}: guest ${npc.name} was dealt a bed that is not a guest berth`,
          );
        }
      }
      // Guest berths are still sized by the settlement, not by who lives in it.
      assert.equal(inn.beds.length, 6, `seed ${seed}: a modest village inn still offers six berths`);
    }
  }

  // The other half of the same rule: an INN rents rooms, a HOUSE does not. Only
  // a gathering lays berths, so a `dwelling` place the brief names sleeps its own
  // people and offers nothing — otherwise it would lay a whole inn's worth of
  // beds across the very rows its household's quarters are carved from.
  const housed = brief.validate(
    {
      scale: "village",
      name: "Oldgate",
      places: [{ kind: "dwelling", name: "The Old House" }],
      cast: [
        { name: "Gran", role: "elder", kind: "folk", tint: "rose", home: "The Old House", household: 1 },
        { name: "Pip", role: "ward", kind: "child", tint: "green", home: "The Old House", household: 1 },
        { name: "Nel", role: "ward", kind: "child", tint: "amber", home: "The Old House", household: 1 },
        { name: "Nan", role: "weaver", kind: "folk", tint: "blue", home: "Oldgate", household: 2 },
      ],
    },
    ctx,
  );
  assert.equal(
    housed.places.find((place) => place.kind === "dwelling")?.name,
    "The Old House",
    "the named house survives validation — a dropped place would make this vacuous",
  );
  for (const seed of [1, 3, 424242]) {
    const w = world.build(seed, "cozy-village", housed);
    checkWorld(w, housed, `named-house seed ${seed}`);
    const house = findZone(w, "The Old House");
    assert.ok(house, `seed ${seed}: the named house compiled`);
    assert.equal(house.beds.length, 0, `seed ${seed}: a house lets no rooms (${house.beds.length} berths)`);
    assert.equal(house.homeBeds.length, 3, `seed ${seed}: and sleeps its own three`);
    assert.ok(
      house.rooms.every((room) => room.quarters),
      `seed ${seed}: every room in it belongs to the household`,
    );
    const sim = new loadedPF.Sim(w);
    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    const taken = new Set();
    for (const name of ["Gran", "Pip", "Nel"]) {
      const npc = house.npcs.find((n) => n.name === name);
      assert.ok(npc, `seed ${seed}: ${name} is home at 23:00`);
      assert.ok(SLEEPS_ON.has(house.object[house.w * npc.y + npc.x]), `seed ${seed}: ${name} is in a bed`);
      assert.ok(!taken.has(`${npc.x},${npc.y}`), `seed ${seed}: ${name} shares a tile with a housemate`);
      taken.add(`${npc.x},${npc.y}`);
    }
  }
}

// 67. A HOUSEHOLD HOMED AT A PLACE GETS THE USUAL ROOMS. Not one bed each in a
// row: bedrooms, and bunks once a room has to take more than two — the same
// density rule a family in a house gets, because it is the same call — except
// for the LORD, who gets a room of his own first (case 68). Six and three are the
// two sides of the density line for the rooms after his, so neither half can go
// vacuous.
{
  const keepBrief = (size, kind = "leader") => ({
    scale: "village",
    name: "Marchward",
    places: [{ kind: "hall", name: "The Keep" }],
    cast: [
      ...Array.from({ length: size }, (_, i) => ({
        name: `Kin${i}`,
        role: i ? "ward" : "lord",
        kind: i ? "child" : kind,
        tint: ["blue", "green", "amber", "rose", "teal", "violet"][i % 6],
        home: "The Keep",
        household: 1,
      })),
      { name: "Nan", role: "weaver", kind: "folk", tint: "grey", home: "Marchward", household: 2 },
      { name: "Tam", role: "carter", kind: "folk", tint: "red", home: "Marchward", household: 3 },
    ],
  });
  for (const seed of [1, 3, 11]) {
    const built = (size, kind) => {
      const sealed = brief.validate(keepBrief(size, kind), ctx);
      assert.equal(
        sealed.cast.filter((c) => c.home === "The Keep").length,
        size,
        `all ${size} stay homed at the keep — a split would test a different building`,
      );
      const w = world.build(seed, "cozy-village", sealed);
      checkWorld(w, sealed, `keep(${size}) seed ${seed}`);
      const keep = findZone(w, "The Keep");
      assert.ok(keep, `seed ${seed}: the keep compiled`);
      return { w, keep, sealed };
    };

    const big = built(6);
    const quarters = big.keep.rooms.filter((room) => room.quarters);
    const shared = quarters.filter((room) => !room.private);
    assert.equal(quarters.length, 3, `seed ${seed}: the lord's room and two more (${quarters.length})`);
    assert.equal(shared.length, 2, `seed ${seed}: five wards want two rooms between them (${shared.length})`);
    assert.equal(big.keep.homeBeds.length, 6, `seed ${seed}: six sleepers, six places`);
    const tileAt = (zone, bed) => zone.object[zone.w * bed.y + bed.x];
    assert.ok(
      shared.some((room) => room.beds.every((bed) => tileAt(big.keep, bed) === "bunk")),
      `seed ${seed}: three to a room is dense, so that room bunks`,
    );
    // Real rooms, in the tiles: shut a quarters door and its beds leave the map.
    for (const room of quarters) {
      const shut = floodFill(big.keep, big.keep.spawn, new Set([`${room.doorX},${room.y1 + 1}`]));
      for (const bed of room.beds) {
        assert.ok(
          !shut.has(`${bed.x},${bed.y}`),
          `seed ${seed}: closing the quarters door leaves ${bed.x},${bed.y} open — the room has no walls`,
        );
      }
    }
    // And the hall is still a hall underneath them.
    assert.ok(big.keep.object.includes("table"), `seed ${seed}: the great table survives the quarters above it`);

    // Three is the other side of the density line: the lord's room plus one that
    // sleeps two, and nothing in the building bunks.
    const small = built(3);
    assert.equal(small.keep.homeBeds.length, 3, `seed ${seed}: three sleepers, three places`);
    assert.equal(
      small.keep.rooms.filter((room) => room.quarters).length,
      2,
      `seed ${seed}: the lord's room and one for the pair`,
    );
    assert.ok(
      small.keep.homeBeds.every((bed) => small.keep.object[small.keep.w * bed.y + bed.x] === "bed"),
      `seed ${seed}: two to a room is not dense, so no bunk appears`,
    );

    // NO OWNER, no private room: six folk homed at a hall nobody runs sleep by the
    // ordinary rules, exactly as they did before. The counterpart that keeps the
    // private room from being "whoever is listed first".
    const unowned = built(6, "folk");
    const unownedQuarters = unowned.keep.rooms.filter((room) => room.quarters);
    assert.ok(
      unownedQuarters.every((room) => !room.private),
      `seed ${seed}: a building nobody runs reserves nothing`,
    );
    assert.equal(unownedQuarters.length, 2, `seed ${seed}: six share two rooms (${unownedQuarters.length})`);
    assert.equal(unowned.keep.homeBeds.length, 6, `seed ${seed}: and everyone still has a place`);
    assert.ok(
      unowned.keep.homeBeds.every((bed) => unowned.keep.object[unowned.keep.w * bed.y + bed.x] === "bunk"),
      `seed ${seed}: three to a room, both rooms bunked, as before`,
    );

    // Everybody is actually in them at 23:00, one tile each.
    const sim = new loadedPF.Sim(big.w);
    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    const taken = new Set();
    for (let i = 0; i < 6; i++) {
      const npc = big.keep.npcs.find((n) => n.name === `Kin${i}`);
      assert.ok(npc, `seed ${seed}: Kin${i} is home in the keep at 23:00`);
      assert.ok(SLEEPS_ON.has(big.keep.object[big.keep.w * npc.y + npc.x]), `seed ${seed}: Kin${i} is in a bed`);
      assert.ok(!taken.has(`${npc.x},${npc.y}`), `seed ${seed}: Kin${i} shares a tile with a housemate`);
      taken.add(`${npc.x},${npc.y}`);
    }
  }
}

// 68. THE OWNER GETS A ROOM OF THEIR OWN. A building that houses the person who
// runs it owes them a door of their own: an innkeeper asleep in a room she rents
// out reads as a lodger in her own inn, and an innkeeper bunked in with her staff
// reads as a dormitory. Six was the shape that failed — the keeper was simply the
// first bed in a shared bunked room — and two only ever looked right by luck.
//
// Single occupancy is asserted at EVERY daypart, not just at 23:00: a room that
// is private at midnight and shared at noon is not private.
{
  const anchorBrief = (size, guests) => ({
    scale: "town",
    prosperity: "thriving",
    name: "Harbour",
    places: [{ kind: "gathering", name: "The Anchor" }],
    cast: [
      { name: "Keep", role: "innkeep", kind: "host", tint: "amber", home: "The Anchor", household: 1 },
      ...Array.from({ length: size - 1 }, (_, i) => ({
        name: `K${i}`,
        role: "hand",
        kind: "folk",
        tint: ["green", "blue", "rose", "teal", "violet"][i % 5],
        home: "The Anchor",
        household: 1,
      })),
      ...Array.from({ length: guests }, (_, i) => ({
        name: `T${i}`,
        role: "drover",
        kind: "folk",
        tint: ["grey", "red"][i % 2],
        home: "Harbour",
        household: 2,
        standing: "transient",
      })),
      { name: "Nan", role: "weaver", kind: "folk", tint: "grey", home: "Harbour", household: 3 },
      { name: "Tam", role: "carter", kind: "folk", tint: "red", home: "Harbour", household: 4 },
    ],
  });
  for (const size of [1, 2, 3, 4, 5, 6]) {
    const guests = size <= 4 ? 2 : 0; // castMax is 10; keep the fixture sealed untouched
    const sealed = brief.validate(anchorBrief(size, guests), ctx);
    // Non-vacuous: the household really is `size` people under one roof, and the
    // owner really is the one who runs the building rather than a lodger.
    assert.equal(
      sealed.cast.filter((c) => c.home === "The Anchor").length,
      size,
      `${size}: the whole household stays homed at the inn`,
    );
    assert.equal(sealed.cast.find((c) => c.name === "Keep").kind, "host", `${size}: the keeper keeps the inn`);
    for (const seed of [1, 11, 424242]) {
      const w = world.build(seed, "cozy-village", sealed);
      checkWorld(w, sealed, `anchor(${size}) seed ${seed}`);
      const inn = findZone(w, "The Anchor");
      assert.ok(inn, `${size} seed ${seed}: the inn compiled`);
      const own = inn.rooms.find((room) => room.private);
      assert.ok(own, `${size} seed ${seed}: the keeper has a room of her own`);
      assert.equal(own.beds.length, 1, `${size} seed ${seed}: single occupancy (${own.beds.length} beds in it)`);
      assert.equal(
        inn.object[inn.w * own.beds[0].y + own.beds[0].x],
        "bed",
        `${size} seed ${seed}: a bed, never a bunk — a private room is not a berth in a stack`,
      );
      // Everyone still has a sleeping place, private room and all.
      assert.equal(inn.homeBeds.length, size, `${size} seed ${seed}: ${size} sleepers, ${inn.homeBeds.length} places`);
      assert.equal(
        new Set(inn.homeBeds.map((bed) => `${bed.x},${bed.y}`)).size,
        size,
        `${size} seed ${seed}: no place is dealt twice`,
      );
      // It is HERS: the owner's night handle is that bed, and it is not a berth.
      // The quarters are downstairs and the let rooms are up (0.8.0 floors), so
      // the keys carry a zone — bare tile numbers would now collide across the
      // staircase and this case would read as a clash that is not one.
      const berth = new Set(inn.beds.map((bed) => `${bed.zoneId}:${bed.x},${bed.y}`));
      const ownTile = `${own.beds[0].x},${own.beds[0].y}`;
      assert.ok(!berth.has(`${inn.id}:${ownTile}`), `${size} seed ${seed}: the keeper's own bed is also being let out`);
      const keeper = Object.values(w.zones)
        .flatMap((zone) => zone.npcs)
        .find((npc) => npc.name === "Keep");
      assert.equal(
        `${keeper._sched.home.zoneId}:${keeper._sched.home.wander.x0},${keeper._sched.home.wander.y0}`,
        `${inn.id}:${ownTile}`,
        `${size} seed ${seed}: the keeper is sent to her own room, not to a let one`,
      );

      // Single occupancy, all day: nobody else is ever inside that room.
      const sim = new loadedPF.Sim(w);
      const inside = (npc) => npc.x >= own.x0 && npc.x <= own.x1 && npc.y >= own.y0 && npc.y <= own.y1;
      let sleptThere = 0;
      for (const clock of [6 * 60, 12 * 60, 19 * 60, 23 * 60]) {
        sim.clockMin = clock;
        sim.resolveSchedules();
        const occupants = Object.values(w.zones)
          .flatMap((zone) => (zone === inn ? zone.npcs : []))
          .filter(inside);
        assert.ok(
          occupants.length <= 1,
          `${size} seed ${seed} @${clock / 60}: ${occupants.length} people in the keeper's room (${occupants.map((n) => n.name).join()})`,
        );
        for (const npc of occupants) {
          assert.equal(npc.name, "Keep", `${size} seed ${seed} @${clock / 60}: ${npc.name} is in the keeper's room`);
        }
        if (occupants.length === 1) sleptThere++;
      }
      // Non-vacuous: "nobody else is ever in there" would pass on a room the
      // keeper never enters either.
      assert.ok(sleptThere > 0, `${size} seed ${seed}: the keeper actually uses the room she was given`);

      // The rest of the household sleep in the rooms after hers, one tile each.
      sim.clockMin = 23 * 60;
      sim.resolveSchedules();
      const taken = new Set();
      for (let i = 0; i < size - 1; i++) {
        const npc = inn.npcs.find((n) => n.name === `K${i}`);
        assert.ok(npc, `${size} seed ${seed}: K${i} sleeps at the inn they live in`);
        assert.ok(SLEEPS_ON.has(inn.object[inn.w * npc.y + npc.x]), `${size} seed ${seed}: K${i} is in a bed`);
        assert.ok(!inside(npc), `${size} seed ${seed}: K${i} is bunked in the keeper's own room`);
        assert.ok(!taken.has(`${npc.x},${npc.y}`), `${size} seed ${seed}: K${i} shares a tile`);
        taken.add(`${npc.x},${npc.y}`);
      }
      // And no traveller is ever put in it.
      for (const npc of inn.npcs.filter((n) => n.name.startsWith("T"))) {
        assert.ok(!inside(npc), `${size} seed ${seed}: guest ${npc.name} was put in the keeper's own room`);
      }
    }
  }

  // The room is the OWNER'S, not the first-listed resident's. Same household,
  // same size, the keeper written LAST in the cast — without this the rule could
  // be "whoever comes first in the array" and nothing here would notice.
  {
    const late = anchorBrief(4, 0);
    const keeper = late.cast.find((member) => member.name === "Keep");
    late.cast = [...late.cast.filter((member) => member !== keeper), keeper];
    const sealed = brief.validate(late, ctx);
    assert.notEqual(
      sealed.cast.filter((c) => c.home === "The Anchor")[0].name,
      "Keep",
      "the keeper really is not the first of her household in the cast",
    );
    for (const seed of [1, 11, 424242]) {
      const w = world.build(seed, "cozy-village", sealed);
      checkWorld(w, sealed, `anchor-late seed ${seed}`);
      const inn = findZone(w, "The Anchor");
      const own = inn.rooms.find((room) => room.private);
      assert.ok(own, `seed ${seed}: the keeper still gets a room of her own`);
      const sim = new loadedPF.Sim(w);
      sim.clockMin = 23 * 60;
      sim.resolveSchedules();
      const inRoom = inn.npcs.filter((n) => n.x >= own.x0 && n.x <= own.x1 && n.y >= own.y0 && n.y <= own.y1);
      assert.deepEqual(
        inRoom.map((n) => n.name),
        ["Keep"],
        `seed ${seed}: the private room belongs to whoever RUNS the inn (${inRoom.map((n) => n.name).join()})`,
      );
    }
  }

  // The documented fallback, exercised rather than asserted from the comment:
  // ten people homed at one inn cannot have both a private room and a bed each,
  // so the private room is the thing that gives way — never a sleeper.
  {
    const crowd = {
      scale: "town",
      prosperity: "thriving",
      name: "Harbour",
      places: [{ kind: "gathering", name: "The Anchor" }],
      cast: [
        { name: "Keep", role: "innkeep", kind: "host", tint: "amber", home: "The Anchor", household: 1 },
        ...Array.from({ length: 9 }, (_, i) => ({
          name: `K${i}`,
          role: "hand",
          kind: "folk",
          tint: ["green", "blue", "rose", "teal", "violet", "grey"][i % 6],
          home: "The Anchor",
          household: i < 5 ? 1 : 2,
        })),
      ],
    };
    const sealed = brief.validate(crowd, ctx);
    const living = sealed.cast.filter((c) => c.home === "The Anchor");
    assert.equal(living.length, 10, `all ten are homed at the inn (${living.length})`);
    for (const seed of [1, 11, 424242]) {
      const w = world.build(seed, "cozy-village", sealed);
      checkWorld(w, sealed, `anchor-crowd seed ${seed}`);
      const inn = findZone(w, "The Anchor");
      assert.equal(inn.homeBeds.length, 10, `seed ${seed}: ten sleepers, ten places (${inn.homeBeds.length})`);
      assert.equal(
        new Set(inn.homeBeds.map((bed) => `${bed.x},${bed.y}`)).size,
        10,
        `seed ${seed}: and no place dealt twice`,
      );
      assert.ok(
        !inn.rooms.some((room) => room.private),
        `seed ${seed}: the private room gives way rather than a sleeper going without`,
      );
      const sim = new loadedPF.Sim(w);
      sim.clockMin = 23 * 60;
      sim.resolveSchedules();
      for (const member of living) {
        const npc = inn.npcs.find((n) => n.name === member.name);
        assert.ok(npc, `seed ${seed}: ${member.name} sleeps at the inn`);
        assert.ok(SLEEPS_ON.has(inn.object[inn.w * npc.y + npc.x]), `seed ${seed}: ${member.name} is in a bed`);
      }
    }
  }
}

// ── Floors: storeys, cellars and the bell tower (0.8.0) ──────────────────────
// A ROOM is a partition inside a zone; a FLOOR is a zone of its own, joined by a
// stair portal pair. The split is the whole design — a bedroom must never cost a
// zone, and a floor buys one in exchange for reusing the portal, reachability,
// save-restore and schedule machinery unchanged — so these cases test the two
// halves separately: that a floor really is geometry the player can walk into and
// out of, and that the GATE keeps the number of them down.

const STAIR_TILES = new Set(["stairsUp", "stairsDown"]);
/** Every stair tile in a zone, with the portal it fires. */
const stairsIn = (zone) => {
  const out = [];
  for (let y = 0; y < zone.h; y++) {
    for (let x = 0; x < zone.w; x++) {
      if (!STAIR_TILES.has(zone.object[zone.w * y + x])) continue;
      out.push({ x, y, tile: zone.object[zone.w * y + x], portal: zone.portals.find((p) => p.x === x && p.y === y) });
    }
  }
  return out;
};
/** Walk the player until a portal fires, or give up. Driven through the real Sim
 *  on purpose: a portal pair that never fires is exactly the bug a table read
 *  cannot see. */
const walkUntilCross = (sim, input) => {
  for (let tick = 0; tick < 200; tick++) {
    if (sim.step(1 / 60, input)?.zoneChanged) return sim.zoneId;
  }
  return null;
};
const playerTile = (sim) => `${Math.floor(sim.x / loadedPF.TILE)},${Math.floor(sim.y / loadedPF.TILE)}`;

// 69. A BUILDING WITH AN UPPER FLOOR. The floor exists, it is a zone, it is
// stamped out of the World Maps export, and the player can walk up the stairs and
// back down them.
{
  const sealed = brief.validate(bedsBrief(), ctx);
  for (const seed of [1, 3, 11, 424242]) {
    const w = world.build(seed, "cozy-village", sealed);
    checkWorld(w, sealed, `upper-floor seed ${seed}`);
    const inn = findZone(w, "The Kettle");
    assert.ok(inn, `seed ${seed}: the inn compiled`);
    const up = w.zones[`${inn.id}u`];
    assert.ok(up, `seed ${seed}: and grew a storey (${inn.id}u)`);
    assert.equal(up.name, "The Kettle, upstairs", `seed ${seed}: named for the building under it`);
    assert.equal(up.mapExport, false, `seed ${seed}: a floor is a room inside one location, never a row of its own`);
    // Non-vacuous: the storey is where the guest rooms actually went.
    assert.ok(up.beds.length >= 3, `seed ${seed}: the guest wing is up here (${up.beds.length} berths)`);
    assert.ok(
      inn.beds.length > 0 && inn.beds.every((bed) => bed.zoneId === up.id),
      `seed ${seed}: and every berth the building offers names that floor`,
    );

    // The stairs are a MATCHED PAIR, in the tiles as well as in the portal table.
    // A portal with no tile under it is an invisible trapdoor; a tile with no
    // portal is a painted step that goes nowhere.
    const below = stairsIn(inn).filter((step) => step.tile === "stairsUp");
    assert.equal(below.length, 1, `seed ${seed}: one flight up out of the tap room (${below.length})`);
    assert.equal(below[0].portal?.toZone, up.id, `seed ${seed}: and it is a portal to the storey`);
    const above = stairsIn(up).filter((step) => step.tile === "stairsDown");
    assert.equal(above.length, 1, `seed ${seed}: one flight back down (${above.length})`);
    assert.equal(above[0].portal?.toZone, inn.id, `seed ${seed}: which lands in the building it came from`);
    for (const zone of [inn, up]) {
      for (const step of stairsIn(zone)) {
        assert.ok(step.portal, `seed ${seed}: the step at ${zone.id} ${step.x},${step.y} fires nothing`);
        assert.equal(zone.solid[zone.w * step.y + step.x], 0, `seed ${seed}: a step the player cannot stand on`);
      }
    }

    // CLIMB IT. Stand on the tile inside the front door, walk west onto the step,
    // and the Sim's own portal handling does the rest.
    const sim = new loadedPF.Sim(w);
    sim.teleport(inn.id, inn.spawn.x, inn.spawn.y);
    assert.equal(walkUntilCross(sim, { left: true }), up.id, `seed ${seed}: walking west of the door goes upstairs`);
    // The landing is not the stairhead: arriving on it would fire the portal
    // again and bounce the player straight back down.
    assert.notEqual(playerTile(sim), `${above[0].x},${above[0].y}`, `seed ${seed}: the player lands beside the step`);
    assert.equal(playerTile(sim), `${up.spawn.x},${up.spawn.y}`, `seed ${seed}: on the storey's own landing`);
    // Back down: the storey's step is directly south of the landing.
    assert.equal(walkUntilCross(sim, { down: true }), inn.id, `seed ${seed}: and walking south comes back down`);
    assert.equal(playerTile(sim), `${inn.spawn.x},${inn.spawn.y}`, `seed ${seed}: landing back beside the front door`);
  }
}

// 70. A SLEEPER WHOSE BED IS UPSTAIRS IS UPSTAIRS AT NIGHT. Five under one roof
// is a large household, so the bedrooms are a flight up — and the schedule
// resolver needed no new code for it, because a floor is a zone and going to bed
// is the cross-zone splice it always was. (NPCs TELEPORT across a daypart
// boundary; pathing is deferred to roadmap 12, so a sleeper simply appears in
// their room rather than climbing the stairs.)
{
  const sealed = brief.validate(houseBrief("Upfold", 5, "folk"), ctx);
  for (const seed of [1, 3, 11, 424242]) {
    const w = world.build(seed, "cozy-village", sealed);
    checkWorld(w, sealed, `upstairs-sleeper seed ${seed}`);
    const home = findZone(w, "Kin0's home");
    const up = w.zones[`${home.id}u`];
    assert.ok(up, `seed ${seed}: a five-person household sleeps upstairs`);
    // Non-vacuous both ways: nothing to sleep on downstairs, everything up.
    assert.equal(
      home.object.filter((tile) => SLEEPS_ON.has(tile)).length,
      0,
      `seed ${seed}: there is nothing to sleep on downstairs`,
    );
    assert.ok(up.object.filter((tile) => SLEEPS_ON.has(tile)).length >= 5, `seed ${seed}: the beds are up here`);
    // And the rows the bedrooms left behind are part of the room now rather than
    // a hole in it: a house with a staircase has a bigger ground floor, not a
    // blank slab where the wing used to be. Rows 2-4 are exactly the band
    // layoutSleeping would have partitioned.
    const bandFittings = [];
    for (let y = 2; y <= 4; y++) {
      // The shell's own side columns live in `object` too, so the scan stops
      // inside them — a slice of whole rows would find the walls and pass on an
      // empty room.
      for (let x = 1; x <= home.w - 2; x++) if (home.object[home.w * y + x]) bandFittings.push(`${x},${y}`);
    }
    assert.ok(
      bandFittings.length >= 4,
      `seed ${seed}: the band the bedrooms vacated is furnished, not left empty (${bandFittings.length} tiles)`,
    );

    const sim = new loadedPF.Sim(w);
    const names = ["Kin0", "Kin1", "Kin2", "Kin3", "Kin4"];
    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    const taken = new Set();
    for (const name of names) {
      const npc = up.npcs.find((n) => n.name === name);
      assert.ok(npc, `seed ${seed}: ${name} is upstairs at 23:00`);
      assert.ok(SLEEPS_ON.has(standingOn(up, npc)), `seed ${seed}: ${name} is in a bed up there (${npc.x},${npc.y})`);
      assert.ok(!taken.has(`${npc.x},${npc.y}`), `seed ${seed}: ${name} shares a berth`);
      taken.add(`${npc.x},${npc.y}`);
    }
    // …and out of the bedrooms by day. Not merely "not upstairs": they are out in
    // the settlement, which is where a resident's day handle has always sent them.
    sim.clockMin = 12 * 60;
    sim.resolveSchedules();
    assert.equal(up.npcs.length, 0, `seed ${seed}: the bedrooms are empty by day (${up.npcs.length} still up)`);
    for (const name of names) {
      const found = Object.values(w.zones).find((zone) => zone.npcs.some((n) => n.name === name));
      assert.ok(found, `seed ${seed}: ${name} is somewhere in the world by day`);
      assert.notEqual(found.id, up.id, `seed ${seed}: ${name} is not still in bed at noon`);
    }
    // The round trip is repeatable: nobody is lost or duplicated by the splice.
    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    for (const name of names) {
      const copies = Object.values(w.zones).reduce((n, zone) => n + zone.npcs.filter((x) => x.name === name).length, 0);
      assert.equal(copies, 1, `seed ${seed}: ${name} exists in exactly one zone after two crossings`);
    }
  }
}

// 70b. THE OTHER SIDE OF THE GATE. A cottage keeps its bedrooms on the ground
// floor — which is the whole reason zone count does not run away, so it is
// asserted rather than assumed.
{
  for (const size of [1, 2, 3]) {
    const sealed = brief.validate(houseBrief(`Small${size}`, size, "folk"), ctx);
    for (const seed of [1, 11, 424242]) {
      const w = world.build(seed, "cozy-village", sealed);
      const home = findZone(w, "Kin0's home");
      assert.ok(home, `${size} seed ${seed}: the cottage compiled`);
      assert.equal(w.zones[`${home.id}u`], undefined, `${size} seed ${seed}: a cottage of ${size} grows no storey`);
      assert.equal(home.beds.length, size, `${size} seed ${seed}: and sleeps its people downstairs`);
      assert.ok(
        home.beds.every((bed) => bed.zoneId === home.id),
        `${size} seed ${seed}: on this floor, in this zone`,
      );
    }
  }
  // FOUR is the line: two full bedrooms is where the band takes the whole north
  // wall and the ground floor is corridor past it.
  for (const seed of [1, 11, 424242]) {
    const under = world.build(seed, "cozy-village", brief.validate(houseBrief("Threefold", 3, "folk"), ctx));
    const over = world.build(seed, "cozy-village", brief.validate(houseBrief("Fourfold", 4, "folk"), ctx));
    assert.equal(
      under.zones[`${findZone(under, "Kin0's home").id}u`],
      undefined,
      `seed ${seed}: three keeps the ground floor`,
    );
    assert.ok(over.zones[`${findZone(over, "Kin0's home").id}u`], `seed ${seed}: four takes the stairs`);
  }
}

// 71. CELLARS, where the rule says and nowhere else. The workshop and the
// gathering always — both are buildings the whole settlement uses and the stock
// has to go somewhere. A house on a draw seeded by PROSPERITY: a cellar is stored
// surplus, so a struggling settlement digs none.
const cellarBrief = (prosperity) => ({
  scale: "town",
  prosperity,
  name: "Delve",
  places: [
    { kind: "workshop", name: "The Forge" },
    { kind: "gathering", name: "The Kettle" },
    { kind: "hall", name: "The Moot" },
  ],
  cast: [
    { name: "Ada", role: "reeve", kind: "leader", tint: "blue", home: "Delve", household: 1 },
    { name: "Perrin", role: "innkeep", kind: "host", tint: "orange", home: "The Kettle", household: 2 },
    { name: "Bram", role: "smith", kind: "maker", tint: "green", home: "The Forge", household: 3 },
    { name: "Cass", role: "cooper", kind: "folk", tint: "amber", home: "Delve", household: 4 },
    { name: "Dell", role: "carter", kind: "folk", tint: "rose", home: "Delve", household: 5 },
    { name: "Enna", role: "wright", kind: "folk", tint: "teal", home: "Delve", household: 6 },
  ],
});
{
  let thrivingHouseCellars = 0;
  for (const prosperity of ["struggling", "modest", "thriving"]) {
    const sealed = brief.validate(cellarBrief(prosperity), ctx);
    for (const seed of [1, 3, 11, 424242]) {
      const w = world.build(seed, "cozy-village", sealed);
      checkWorld(w, sealed, `cellars(${prosperity}) seed ${seed}`);
      const label = `${prosperity} seed ${seed}`;
      const dug = (name) => {
        const zone = findZone(w, name);
        return zone ? !!w.zones[`${zone.id}b`] : null;
      };
      // ALWAYS, at every prosperity — including struggling, where no house has one.
      assert.equal(dug("The Forge"), true, `${label}: the workshop always has an undercroft`);
      assert.equal(dug("The Kettle"), true, `${label}: and the gathering always has a cellar`);
      // Current design, not doctrine: a hall is a duty station and nobody has
      // asked for a cellar under it YET. An archive or records vault under the
      // hall would be a legitimate future — update this pin with that feature.
      assert.equal(dug("The Moot"), false, `${label}: the hall digs nothing`);
      // Houses, by prosperity. Counted over the whole world so the case does not
      // depend on which household won which lot.
      const houses = Object.values(w.zones).filter((zone) => /^[hs]\d+$/.test(zone.id));
      assert.ok(houses.length >= 2, `${label}: the fixture built houses to ask about (${houses.length})`);
      const cellars = houses.filter((house) => w.zones[`${house.id}b`]).length;
      if (prosperity === "struggling") {
        assert.equal(cellars, 0, `${label}: a struggling settlement has no surplus to keep (${cellars} cellars)`);
      }
      if (prosperity === "thriving") thrivingHouseCellars += cellars;
      // Whatever was dug came from the SEED and not from the clock: a rebuild of
      // the same brief digs exactly the same cellars.
      const again = world.build(seed, "cozy-village", sealed);
      assert.deepEqual(
        Object.keys(again.zones)
          .filter((id) => id.endsWith("b"))
          .sort(),
        Object.keys(w.zones)
          .filter((id) => id.endsWith("b"))
          .sort(),
        `${label}: the same cellars every rebuild`,
      );
    }
  }
  // Non-vacuous the other way: the prosperity draw really does fire somewhere, or
  // "struggling digs none" would pass on a rule that never digs at all.
  assert.ok(thrivingHouseCellars > 0, `a thriving town digs house cellars too (${thrivingHouseCellars})`);

  // A cellar is STORES, and a room the player can walk about in rather than a
  // named void: the floor exists today mostly for what building and resource
  // management will put in it, but it has to be somewhere to put anything.
  const w = world.build(424242, "cozy-village", brief.validate(cellarBrief("thriving"), ctx));
  const forge = findZone(w, "The Forge");
  const under = w.zones[`${forge.id}b`];
  assert.equal(under.name, "The Forge cellar", "a cellar is named for the building over it");
  assert.equal(under.mapExport, false, "and is never a map destination");
  assert.ok(under.object.filter((tile) => tile === "shelf").length >= 4, "with stock down its walls");
  assert.ok(under.object.includes("counter"), "and a bench, because a forge's undercroft is worked in");
  const reached = floodFill(under, under.spawn);
  assert.ok(reached.size > 20, `the cellar is a room, not a corridor (${reached.size} tiles from the stairhead)`);
}

// 72. THE BELL TOWER. The showcase: the player climbs the church. It is built by
// the SAME sub-floor mechanism as a guest storey — same id derivation, same stair
// pair, same export gate — and differs only in its footprint and what is in it,
// which is exactly what the floor-furnisher table is for.
{
  const sealed = brief.validate(sanctuaryBrief(), ctx);
  for (const seed of [1, 3, 424242]) {
    const w = world.build(seed, "cozy-village", sealed);
    checkWorld(w, sealed, `belfry seed ${seed}`);
    const church = zoneNamed(w, "St. Ilde's");
    assert.ok(church, `seed ${seed}: the church compiled`);
    const tower = w.zones[`${church.id}u`];
    assert.ok(tower, `seed ${seed}: with a bell tower over it`);
    assert.equal(tower.name, "St. Ilde's bell tower", `seed ${seed}: named for the church`);
    assert.equal(tower.mapExport, false, `seed ${seed}: a tower is part of the church, not a second destination`);
    // Smaller than the nave — the one concession the mechanism made for it, and
    // the reason the two flights are placed independently at either end.
    assert.ok(tower.w < church.w && tower.h < church.h, `seed ${seed}: a tower is narrower than the church under it`);
    // THE BELL, and it is solid: the climb is to stand with it, not walk through it.
    const bells = [];
    for (let y = 0; y < tower.h; y++) {
      for (let x = 0; x < tower.w; x++) if (tower.object[tower.w * y + x] === "bell") bells.push({ x, y });
    }
    assert.equal(bells.length, 1, `seed ${seed}: one bell in the belfry (${bells.length})`);
    assert.equal(tower.solid[tower.w * bells[0].y + bells[0].x], 1, `seed ${seed}: and it blocks`);
    // CLIMBABLE, through the Sim: from the tile inside the church door, west onto
    // the step, up the tower.
    const sim = new loadedPF.Sim(w);
    sim.teleport(church.id, church.spawn.x, church.spawn.y);
    assert.equal(walkUntilCross(sim, { left: true }), tower.id, `seed ${seed}: the player can climb the tower`);
    // And walk right round the bell once up there: it is a room, not a niche.
    const round = floodFill(tower, tower.spawn);
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ]) {
      assert.ok(
        round.has(`${bells[0].x + dx},${bells[0].y + dy}`),
        `seed ${seed}: the bell is walled in on the ${dx},${dy} side`,
      );
    }
    assert.equal(walkUntilCross(sim, { down: true }), church.id, `seed ${seed}: and climb back down into the nave`);
    // The church keeps its nave: the tower took nothing from the floor below it.
    assert.ok(church.object.includes("altar"), `seed ${seed}: the altar is still there`);
    assert.equal(w.zones[`${church.id}b`], undefined, `seed ${seed}: and no crypt was dug — that is not the rule`);
  }
}

// 73. DEPTH IS CAPPED AT ONE EACH WAY, and not by a guard that could be forgotten
// — `h1uu` cannot be spelled, because only interiorRoom() mints floors and the
// floors it mints never mint their own. Swept across the file's fixtures.
{
  const fixtures = [
    ["hearthwick", brief.validate(bedsBrief(), ctx)],
    ["inn", brief.validate(innBrief({ scale: "town", prosperity: "thriving" }, 6), ctx)],
    ["sanctuary", brief.validate(sanctuaryBrief(), ctx)],
    ["cellars", brief.validate(cellarBrief("thriving"), ctx)],
    ["bunkhouse", bunkhouseSealed(5)],
    ["six", brief.validate(houseBrief("Sixfold", 6, "folk"), ctx)],
    ["bellwether", brief.validate(bellwetherBrief(), ctx)],
    ["defaults", brief.defaults("cozy-village", 424242)],
    ["colony", brief.defaults("sci-fi-colony", 424242)],
  ];
  let floorsSeen = 0;
  let stairsSeen = 0;
  for (const [label, sealed] of fixtures) {
    for (const seed of [1, 3, 11, 424242]) {
      const w = world.build(seed, "cozy-village", sealed);
      for (const id of Object.keys(w.zones)) {
        assert.ok(/^(z|h|s)\d+[ub]?$/.test(id), `${label} seed ${seed}: zone id "${id}" is more than one flight off`);
        if (!/[ub]$/.test(id)) continue;
        floorsSeen++;
        assert.ok(w.zones[groundFloorId(id)], `${label} seed ${seed}: floor ${id} has no building under it`);
        assert.equal(w.zones[id].mapExport, false, `${label} seed ${seed}: floor ${id} would claim a map row`);
      }
      // Every stair tile is a portal and every stair portal has a stair tile under
      // it. This is the guard against a furnisher one day being laid over a step
      // the shell claimed before it ran: the step would still teleport, invisibly,
      // from under a table.
      for (const zone of Object.values(w.zones)) {
        for (const step of stairsIn(zone)) {
          assert.ok(step.portal, `${label} seed ${seed}: ${zone.id} has a step at ${step.x},${step.y} firing nothing`);
          stairsSeen++;
        }
        for (const portal of zone.portals) {
          // The portals BETWEEN floors of one building — the stairs, and nothing
          // else: a front door leads to another building's id entirely.
          if (portal.toZone === zone.id || groundFloorId(portal.toZone) !== groundFloorId(zone.id)) continue;
          assert.ok(
            STAIR_TILES.has(zone.object[zone.w * portal.y + portal.x]),
            `${label} seed ${seed}: ${zone.id} → ${portal.toZone} is a portal with no step painted on it`,
          );
        }
      }
    }
  }
  assert.ok(floorsSeen > 40, `the sweep actually visited floors (${floorsSeen})`);
  assert.ok(stairsSeen > 80, `and steps (${stairsSeen})`);
}

// 74. NOBODY STANDS IN THE STAIRWELL. A stair is a portal, and standable()
// already refuses portal tiles — the claim this release leans on rather than a
// rule of its own, so it is checked against real casts at every daypart instead
// of taken on trust.
{
  const fixtures = [
    ["hearthwick", brief.validate(bedsBrief(), ctx)],
    ["packed-inn", brief.validate(innBrief({ prosperity: "struggling" }, 6), ctx)],
    ["cellars", brief.validate(cellarBrief("thriving"), ctx)],
    ["bunkhouse", bunkhouseSealed(5)],
    ["six", brief.validate(houseBrief("Sixfold", 6, "folk"), ctx)],
  ];
  let stood = 0;
  let steppedOn = 0;
  for (const [label, sealed] of fixtures) {
    for (const seed of [1, 3, 11]) {
      const w = world.build(seed, "cozy-village", sealed);
      const sim = new loadedPF.Sim(w);
      // Non-vacuous: the world being swept really does have stairs in it.
      assert.ok(
        Object.values(w.zones).some((zone) => stairsIn(zone).length),
        `${label} seed ${seed}: the world has stairs to stand on`,
      );
      // THE MECHANISM, asked directly. A sweep of where the cast ended up passes
      // whether the rule holds or the dice were merely kind — a stair is one tile
      // in a room of a hundred and forty. So put the question to standable()
      // itself, on every step in the world: it must refuse, because a step is a
      // portal and that is the only thing keeping anybody off it.
      for (const zone of Object.values(w.zones)) {
        for (const step of stairsIn(zone)) {
          assert.equal(
            loadedPF.schedule.standable(zone, step.x, step.y),
            false,
            `${label} seed ${seed}: standable() would park an NPC on the step at ${zone.id} ${step.x},${step.y}`,
          );
          steppedOn++;
        }
      }
      for (const min of [6 * 60, 12 * 60, 19 * 60, 23 * 60]) {
        sim.clockMin = min;
        sim.resolveSchedules();
        for (const zone of Object.values(w.zones)) {
          const steps = new Set(stairsIn(zone).map((step) => `${step.x},${step.y}`));
          for (const npc of zone.npcs) {
            const x = Math.round(npc.x);
            const y = Math.round(npc.y);
            assert.ok(!steps.has(`${x},${y}`), `${label} seed ${seed} @${min}: ${npc.name} stands on the stairs`);
            assert.ok(
              loadedPF.schedule.standable(zone, x, y),
              `${label} seed ${seed} @${min}: ${npc.name} stands somewhere illegal in ${zone.id}`,
            );
            stood++;
          }
        }
      }
    }
  }
  assert.ok(stood > 400, `the sweep actually placed NPCs (${stood})`);
  assert.ok(steppedOn > 60, `and actually asked about steps (${steppedOn})`);
}

// ── A NAMED WORKPLACE (0.9.0) ───────────────────────────────────────────────
// Ownership is the compiler's only guess at where somebody spends the day, and
// it is structurally one building per person and one person per building
// (`seenSpecial` dedupes the special, and `b.owner` is a single reference). So
// every building the brief names has room for exactly ONE working adult and no
// staff: a sanctuary with two acolytes, a market with four sellers, a shop with
// an assistant are all inexpressible at any price.
//
// `workplace` is the brief saying it outright. This case pins the three things
// that make it worth a sealed field: the named zone WINS over the derived post,
// it moves ONLY the working anchor and never the bed, and — the whole point —
// SEVERAL people can name the SAME building and each get their own tile in it.
{
  const sealed = brief.validate(
    {
      name: "Cadenhall",
      scale: "village",
      prosperity: "modest",
      places: [{ kind: "sanctuary", name: "St Aldwin's", flavor: "A cold stone nave." }],
      cast: [
        { name: "Prior Wen", role: "prior", kind: "elder", tint: "violet", home: "St Aldwin's", household: 1 },
        // Two acolytes who LIVE in the village and WORK at the sanctuary. Neither
        // owns it — the prior does — so without the field both would spend the
        // day in the plaza and the church would be a room with one person in it.
        {
          name: "Bel",
          role: "acolyte",
          kind: "folk",
          tint: "rose",
          home: "Cadenhall",
          workplace: "St Aldwin's",
          household: 2,
        },
        {
          name: "Corin",
          role: "acolyte",
          kind: "folk",
          tint: "teal",
          home: "Cadenhall",
          workplace: "St Aldwin's",
          household: 2,
        },
        { name: "Halla", role: "farmer", kind: "grower", tint: "green", home: "Cadenhall", household: 3 },
      ],
    },
    ctx,
  );
  const w = world.build(31337, "cozy-village", sealed);
  checkWorld(w, sealed, "workplace");

  const sanctuaryId = Object.entries(sealed._ids.zones).find(([, name]) => name === "St Aldwin's")?.[0];
  assert.ok(sanctuaryId, "the sanctuary has an ordinal id");
  const everyNpc = Object.values(w.zones).flatMap((zone) => zone.npcs.map((npc) => ({ zone, npc })));
  const at = (name) => everyNpc.find((entry) => entry.npc.name === name);

  // 1. The field survived validate() and resolved to the zone NAME.
  assert.equal(sealed.cast[1].workplace, "St Aldwin's", "a resolved workplace is sealed onto the cast member");
  assert.equal(sealed.cast[3].workplace, undefined, "and is absent for anyone who did not name one");

  // 2. The named zone wins: both acolytes work in the sanctuary, not the plaza.
  for (const name of ["Bel", "Corin"]) {
    const entry = at(name);
    assert.ok(entry, `${name} was placed`);
    assert.equal(entry.npc._sched.post.zoneId, sanctuaryId, `${name} works in the sanctuary they were assigned to`);
  }

  // 3. THE REASON THE FIELD EXISTS. Ownership cannot express two workers in one
  //    building; this must. Distinct tiles, because two sprites on one tile make
  //    the lower one impossible to talk to.
  const bel = at("Bel").npc;
  const corin = at("Corin").npc;
  assert.notEqual(`${bel.x},${bel.y}`, `${corin.x},${corin.y}`, "two people working in one building do not stack");
  assert.equal(at("Bel").zone.id, sanctuaryId, "and they are compiled INTO that zone, not merely pointed at it");

  // 4. A day job has no opinion about a bed. Their home handle still points at
  //    the village they live in — naming a workplace must never rehouse anybody.
  for (const name of ["Bel", "Corin"]) {
    const home = at(name).npc._sched.home;
    if (home) assert.notEqual(home.zoneId, sanctuaryId, `${name} does not sleep at work`);
  }

  // 5. Nobody who did not name one is moved: the farmer keeps the derived post.
  assert.equal(at("Halla").npc._sched.post.zoneId, "z1", "an unnamed workplace leaves the derivation alone");
}

// An unresolvable workplace is RECORDED and dropped, never guessed at and never
// promoted to the root the way `home` is — "works at the settlement" is not a
// box anything can stand in, and a wrong binding is forever.
{
  const sealed = brief.validate(
    {
      name: "Cadenhall",
      scale: "hamlet",
      cast: [
        {
          name: "Bel",
          role: "acolyte",
          kind: "folk",
          tint: "rose",
          home: "Cadenhall",
          workplace: "A Church That Is Not There",
          household: 1,
        },
        { name: "Halla", role: "farmer", kind: "grower", tint: "green", home: "Cadenhall", household: 2 },
      ],
    },
    ctx,
  );
  assert.equal(sealed.cast[0].workplace, undefined, "an unresolved workplace is dropped, not guessed");
  assert.ok(
    sealed._repairs.some((line) => line.includes("workplace") && line.includes("unresolved")),
    "and the drop is recorded in _repairs rather than being silent",
  );
  const w = world.build(31337, "cozy-village", sealed);
  const bel = Object.values(w.zones)
    .flatMap((zone) => zone.npcs)
    .find((npc) => npc.name === "Bel");
  assert.ok(bel && bel._sched.post, "and they still compile with an ordinary derived post");
}

// ── A NAMED WORKER HOLDS THEIR POST THROUGH THE DAY (0.9.0) ────────────────
// The binding is only worth having if it survives the hours anybody is looking.
// Six of the twelve cast kinds — healer, scholar, elder, child, wanderer, folk —
// have no row in the schedule table at all and fall to "*:resident", whose DAY
// entry is `public`: the plaza. So a named acolyte would hold the sanctuary at
// dawn and at dusk and then walk out of it for 07:00-18:00, which is both the
// longest daypart and the one a player is most likely to open a door in. The
// `worker` tier exists to close exactly that, and it is keyed on having been
// PLACED BY NAME rather than on a kind, the same way the keeper tier is keyed on
// holding a building.
{
  const sealed = brief.validate(
    {
      name: "Cadenhall",
      scale: "village",
      prosperity: "modest",
      places: [{ kind: "sanctuary", name: "St Aldwin's", flavor: "A cold stone nave." }],
      cast: [
        { name: "Prior Wen", role: "prior", kind: "elder", tint: "violet", home: "St Aldwin's", household: 1 },
        {
          name: "Bel",
          role: "acolyte",
          kind: "folk",
          tint: "rose",
          home: "Cadenhall",
          workplace: "St Aldwin's",
          household: 2,
        },
        {
          name: "Corin",
          role: "acolyte",
          kind: "folk",
          tint: "teal",
          home: "Cadenhall",
          workplace: "St Aldwin's",
          household: 2,
        },
        { name: "Halla", role: "farmhand", kind: "folk", tint: "green", home: "Cadenhall", household: 3 },
      ],
    },
    ctx,
  );
  const w = world.build(31337, "cozy-village", sealed);
  const sim = new loadedPF.Sim(w);
  const sanctuaryId = Object.entries(sealed._ids.zones).find(([, n]) => n === "St Aldwin's")[0];
  const whereIs = (name) => {
    for (const zoneId in w.zones) if (w.zones[zoneId].npcs.some((n) => n.name === name)) return zoneId;
    return null;
  };
  const at = (min) => {
    sim.clockMin = min;
    sim.resolveSchedules();
  };

  // The `worker` flag is baked, and ONLY for the people the brief named.
  const flagOf = (name) => {
    for (const zoneId in w.zones) {
      const npc = w.zones[zoneId].npcs.find((n) => n.name === name);
      if (npc) return npc._sched.worker;
    }
    return null;
  };
  assert.equal(flagOf("Bel"), true, "a named worker is flagged as one");
  assert.equal(flagOf("Halla"), false, "and nobody else is");

  // MIDDAY IS THE POINT. Both acolytes are inside the sanctuary at noon; Halla,
  // who was never assigned anywhere, keeps the plaza the generic row sends her to.
  at(12 * 60);
  assert.equal(whereIs("Bel"), sanctuaryId, "a named worker is at work at midday, not in the square");
  assert.equal(whereIs("Corin"), sanctuaryId, "and so is the second one — the cap ownership imposed is gone");
  assert.equal(whereIs("Halla"), "z1", "someone with no named workplace still spends the day in the settlement");

  // And they are STILL two people, not one sprite on top of another.
  const inNave = w.zones[sanctuaryId].npcs.filter((n) => n.name === "Bel" || n.name === "Corin");
  assert.equal(inNave.length, 2, "both acolytes are in the nave at once");
  assert.notEqual(
    `${inNave[0].x},${inNave[0].y}`,
    `${inNave[1].x},${inNave[1].y}`,
    "on their own tiles, so both can be talked to",
  );

  // Night still belongs to the bed: a day job has no opinion about where you sleep.
  at(23 * 60);
  const npcOf = (name) => {
    for (const zoneId in w.zones) {
      const npc = w.zones[zoneId].npcs.find((n) => n.name === name);
      if (npc) return npc;
    }
    return null;
  };
  for (const name of ["Bel", "Corin"]) {
    const npc = npcOf(name);
    const bed = npc._sched.home;
    // Not the workplace, and NOT THE SQUARE EITHER. A bare notEqual against the
    // sanctuary also passed for an acolyte who drifted to the plaza at 23:00 —
    // the same "nobody is where they are scheduled to be" gap the night handle
    // exists to close, so the negative case has to name the square too.
    assert.notEqual(whereIs(name), sanctuaryId, `${name} goes home to sleep like anybody else`);
    assert.notEqual(whereIs(name), "z1", `${name} sleeps under a roof, not out in the square`);
    // The night handle is only worth asserting against once the two lines above
    // have pinned the destination independently: `_sched.home` is the very field
    // a broken binding would have rewritten.
    assert.equal(whereIs(name), bed.zoneId, `${name} is in the zone their night handle names`);
    assert.equal(
      `${npc.x},${npc.y}`,
      `${bed.wander.x0},${bed.wander.y0}`,
      `${name} is ON their berth, not loose in the room`,
    );
  }
}

// ── NOBODY LOSES THEIR BED TO SOMEBODY WHO IS ALSO LEAVING (0.9.0) ─────────
// Placement consults `taken` so no sprite is stacked under another — a buried
// one can never be talk-targeted. But "taken" used to be read against wherever
// people were standing from the LAST daypart, in a single pass, while half of
// them were on their way out. So an NPC whose own bed was still warm under a
// housemate not yet processed got shunted to the nearest free tile; the
// housemate then walked off; and the sleeper spent the night on the
// floorboards beside an empty bed.
//
// A pure ORDERING accident, which is why it hid: the same world resolved in a
// different NPC order strands a different person, and going straight to a
// daypart instead of arriving from one never triggers it at all.
//
// So this case manufactures the worst legal instance rather than waiting for a
// seed to produce one — everybody stood on the NEXT sleeper's bed, every single
// destination occupied by somebody who is themselves about to move.
{
  const sealed = brief.validate(
    {
      scale: "hamlet",
      prosperity: "thriving",
      name: "Harbour",
      places: [{ kind: "gathering", name: "The Anchor" }],
      cast: [
        { name: "Keep", role: "innkeep", kind: "host", tint: "amber", home: "The Anchor", household: 1 },
        ...Array.from({ length: 9 }, (_, i) => ({
          name: `K${i}`,
          role: "hand",
          kind: "folk",
          tint: ["green", "blue", "rose", "teal", "violet", "grey"][i % 6],
          home: "The Anchor",
          household: i < 5 ? 1 : 2,
        })),
      ],
    },
    ctx,
  );
  for (const seed of [1, 11, 424242]) {
    const w = world.build(seed, "cozy-village", sealed);
    const inn = findZone(w, "The Anchor");
    const sim = new loadedPF.Sim(w);

    // Night once, the ordinary way: everybody arrives and takes their own bed.
    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    const sleepers = inn.npcs.filter((npc) => npc._sched?.home?.zoneId === inn.id);
    assert.ok(sleepers.length >= 8, `seed ${seed}: the crowd sleeps at the inn (${sleepers.length})`);
    const beds = sleepers.map((npc) => ({ x: npc._sched.home.wander.x0, y: npc._sched.home.wander.y0 }));

    // ROTATE: stand each of them on the NEXT one's bed. Every position is legal
    // and every destination is now held by another mover.
    sleepers.forEach((npc, i) => {
      const squat = beds[(i + 1) % beds.length];
      npc.x = squat.x;
      npc.y = squat.y;
    });
    sim.resolveSchedules();

    for (let i = 0; i < sleepers.length; i++) {
      const npc = sleepers[i];
      assert.equal(
        `${Math.round(npc.x)},${Math.round(npc.y)}`,
        `${beds[i].x},${beds[i].y}`,
        `seed ${seed}: ${npc.name} reached their own bed rather than yielding it to a housemate who was leaving anyway`,
      );
      assert.ok(
        SLEEPS_ON.has(inn.object[inn.w * Math.round(npc.y) + Math.round(npc.x)]),
        `seed ${seed}: ${npc.name} is on a sleeping tile`,
      );
    }
    // And still one each — the fix must not trade displacement for stacking.
    const tiles = new Set(sleepers.map((npc) => `${Math.round(npc.x)},${Math.round(npc.y)}`));
    assert.equal(tiles.size, sleepers.length, `seed ${seed}: one sleeper per tile`);
  }
}

// ── LIVING IN A NAMED BUILDING IS KEEPING IT (0.9.0) ───────────────────────
// The keeper tier — the row that holds somebody in their building through the
// DAY instead of sending them to the plaza — used to be reachable only by
// OWNING a sanctuary, and ownership is one building per person. So exactly one
// keeper was possible in an entire world. Everyone else the brief deliberately
// housed in a named building fell to "*:resident", whose day entry is `public`:
// they lived in the moot house and walked out of it for the whole of daylight,
// which is precisely when a player opens the door.
//
// `mapKind` is the gate because it is the compiler's own word for "this place
// has a room you can stand in". A wilds is stamped "place", so a forager homed
// in the woods keeps their old habits — they have no building to keep, which is
// rather the point of living out there.
{
  const sealed = brief.validate(
    {
      name: "Cadenhall",
      scale: "village",
      prosperity: "modest",
      places: [
        { kind: "hall", name: "The Moot House", flavor: "Where the parish argues." },
        { kind: "wilds", name: "The Long Coppice", flavor: "Hazel and quiet." },
      ],
      cast: [
        // An ELDER has no row of its own in the schedule table, so without the
        // keeper tier this is the exact case that leaks to the square.
        { name: "Reeve Ott", role: "reeve", kind: "elder", tint: "grey", home: "The Moot House", household: 1 },
        {
          name: "Wick",
          role: "forager",
          kind: "folk",
          tint: "green",
          home: "The Long Coppice",
          household: 2,
          standing: "fringe",
        },
        { name: "Halla", role: "farmer", kind: "grower", tint: "green", home: "Cadenhall", household: 3 },
      ],
    },
    ctx,
  );
  const w = world.build(9090, "cozy-village", sealed);
  checkWorld(w, sealed, "keeper-widening");
  const hallId = Object.entries(sealed._ids.zones).find(([, n]) => n === "The Moot House")[0];
  const coppiceId = Object.entries(sealed._ids.zones).find(([, n]) => n === "The Long Coppice")[0];
  assert.equal(w.zones[hallId].mapKind, "building", "a named hall is a building you can stand in");
  assert.equal(w.zones[coppiceId].mapKind, "place", "a wilds is not");

  const find = (name) => {
    for (const id in w.zones) {
      const npc = w.zones[id].npcs.find((n) => n.name === name);
      if (npc) return { id, npc };
    }
    return null;
  };
  assert.equal(find("Reeve Ott").npc._sched.keeper, true, "living in the moot house makes you its keeper");
  assert.equal(find("Wick").npc._sched.keeper, false, "living in the woods does not make you a keeper of anything");

  // MIDDAY IS THE POINT: the reeve is in the hall, not in the square.
  const sim = new loadedPF.Sim(w);
  sim.clockMin = 12 * 60;
  sim.resolveSchedules();
  assert.equal(find("Reeve Ott").id, hallId, "the reeve keeps the moot house through the day");
  assert.equal(find("Halla").id, "z1", "somebody with no named building still has the settlement to be in");

  // And the night handle is untouched — keeping a building is not sleeping rough.
  sim.clockMin = 23 * 60;
  sim.resolveSchedules();
  assert.equal(find("Reeve Ott").id, hallId, "and sleeps in the quarters the hall grew for her");
}

// ONE HEAD PER BUILDING, not everyone under its roof. Keeping a building and
// sleeping in it are different facts, and conflating them breaks the moment a
// brief homes a CROWD somewhere: ten residents at one address are a dormitory, a
// barracks or a boarding house, and the defining thing about all three is that
// the people in them LEAVE during the day. Marking the whole roll as keepers
// held them indoors around the clock — and on the open plan, which walls
// nothing, the wander box covers the bed rows and beds are non-solid, so they
// spent the afternoon standing on their own bunks.
{
  const sealed = brief.validate(
    {
      scale: "hamlet",
      prosperity: "thriving",
      name: "Harbour",
      places: [{ kind: "gathering", name: "The Anchor" }],
      cast: [
        { name: "Keep", role: "innkeep", kind: "host", tint: "amber", home: "The Anchor", household: 1 },
        ...Array.from({ length: 9 }, (_, i) => ({
          name: `K${i}`,
          role: "lodger",
          kind: "folk",
          tint: ["green", "blue", "rose", "teal", "violet", "grey"][i % 6],
          home: "The Anchor",
          household: i < 5 ? 1 : 2,
        })),
      ],
    },
    ctx,
  );
  const w = world.build(1, "cozy-village", sealed);
  const inn = findZone(w, "The Anchor");
  const everyone = Object.values(w.zones).flatMap((zone) => zone.npcs);
  const keepers = everyone.filter((npc) => npc._sched.keeper);
  assert.equal(keepers.length, 1, `one head, not a roll call (${keepers.map((n) => n.name).join()})`);
  assert.equal(keepers[0].name, "Keep", "and it is the first resident in cast order");

  // Midday: the head holds the building, the lodgers are out of it.
  const sim = new loadedPF.Sim(w);
  sim.clockMin = 12 * 60;
  sim.resolveSchedules();
  assert.equal(inn.npcs.length, 1, `at midday only the head is inside (${inn.npcs.map((n) => n.name).join()})`);
  // Non-vacuous: they went somewhere real rather than being dropped. By name
  // rather than by headcount — the world now also holds residents the compiler
  // minted, so a total is no longer a statement about THESE ten.
  const standing = new Set(everyone.map((npc) => npc.name));
  for (const member of sealed.cast) {
    assert.ok(standing.has(member.name), `${member.name} is somewhere in the world, not lost moving out of the inn`);
  }
  // Nobody loiters on a bed by day — the open plan walls nothing, so this is
  // the assertion that catches a resident being held indoors by mistake.
  for (const npc of inn.npcs) {
    assert.ok(
      !SLEEPS_ON.has(inn.object[inn.w * Math.round(npc.y) + Math.round(npc.x)]),
      `${npc.name} is standing on a bed in the middle of the day`,
    );
  }
}

// ── A HOUSEHOLD NUMBER IS AN ID SPACE, NOT AN OCCUPANCY BOUND (0.9.0) ──────
// One constant used to answer two unrelated questions: WHICH group you are in,
// and HOW MANY may share it. That is the same conflation as `household` itself
// carrying both kinship and address, one level down, and it made a convent, a
// barracks and a boarding house inexpressible — ten unrelated lodgers under one
// roof is ten people sharing a number, and the split pass tore them apart.
//
// The pass also shipped a live contract violation: its replacement number
// escaped its own cap by `(next % (CAPS.household * 2)) + 1`, so the SEALED
// brief carried household numbers above the schema's own maximum.
{
  // 1. Ten unrelated people, ten households. Nothing is merged.
  const solo = brief.validate(
    {
      scale: "village",
      name: "Solitude",
      cast: Array.from({ length: 10 }, (_, i) => ({
        name: `S${i}`,
        role: "lodger",
        kind: "folk",
        tint: ["green", "blue", "rose", "teal", "violet", "grey"][i % 6],
        home: "Solitude",
        household: i + 1,
      })),
    },
    ctx,
  );
  assert.equal(new Set(solo.cast.map((c) => c.household)).size, 10, "ten unrelated people can be ten households");

  // 2. A big family STAYS a big family. Seven under one number used to be torn
  //    into two by a repair pass; a brief that says seven kin means seven kin.
  const clan = brief.validate(
    {
      scale: "village",
      name: "Clanhome",
      cast: [
        ...Array.from({ length: 7 }, (_, i) => ({
          name: `C${i}`,
          role: "kin",
          kind: "folk",
          tint: "green",
          home: "Clanhome",
          household: 3,
        })),
        { name: "D0", role: "kin", kind: "folk", tint: "blue", home: "Clanhome", household: 4 },
        { name: "D1", role: "kin", kind: "folk", tint: "rose", home: "Clanhome", household: 5 },
        { name: "D2", role: "kin", kind: "folk", tint: "teal", home: "Clanhome", household: 6 },
      ],
    },
    ctx,
  );
  assert.equal(
    clan.cast.filter((c) => c.household === 3).length,
    7,
    "a household of seven is not torn in half by a repair pass",
  );
  assert.ok(
    !clan._repairs.some((line) => line.includes("split")),
    `and no split is recorded (${clan._repairs.filter((l) => l.includes("split")).join()})`,
  );

  // 3. THE CONTRACT VIOLATION. Nothing the validator seals may exceed the bound
  //    the validator itself publishes — the old pass minted numbers above it on
  //    most seeds, which no schema check downstream would have caught.
  const bound = brief.schema().properties.cast.items.properties.household.maximum;
  for (const seed of [1, 2, 3, 7, 11, 23, 424242]) {
    const sealed = brief.validate(
      {
        scale: "village",
        name: "Clanhome",
        cast: [
          ...Array.from({ length: 7 }, (_, i) => ({
            name: `C${i}`,
            role: "kin",
            kind: "folk",
            tint: "green",
            home: "Clanhome",
            household: 3,
          })),
          { name: "D0", role: "kin", kind: "folk", tint: "blue", home: "Clanhome", household: 4 },
          { name: "D1", role: "kin", kind: "folk", tint: "rose", home: "Clanhome", household: 5 },
          { name: "D2", role: "kin", kind: "folk", tint: "teal", home: "Clanhome", household: 6 },
        ],
      },
      { theme: "cozy-village", seed },
    );
    for (const member of sealed.cast) {
      assert.ok(
        member.household >= 1 && member.household <= bound,
        `seed ${seed}: ${member.name} sealed household ${member.household}, outside the published bound 1..${bound}`,
      );
    }
  }

  // 4. And it still COMPILES: ten under one roof is a communal arrangement, not
  //    a crash. Everyone gets a sleeping place, which is the 0.8 invariant.
  const commune = brief.validate(
    {
      scale: "village",
      prosperity: "modest",
      name: "Commonhold",
      cast: Array.from({ length: 9 }, (_, i) => ({
        name: `M${i}`,
        role: "member",
        kind: "folk",
        tint: "green",
        home: "Commonhold",
        household: 1,
      })),
    },
    ctx,
  );
  const w = world.build(77, "cozy-village", commune);
  checkWorld(w, commune, "commune");
  const beds = Object.values(w.zones).flatMap((z) => z.beds ?? []);
  assert.ok(beds.length >= 9, `nine under one roof still get nine sleeping places (${beds.length})`);
}

// ── A SETTLEMENT PLACES THE FEATURES IT WAS GIVEN (0.9.0) ──────────────────
// Features anchor at four fixed corners and are dropped when every corner is
// claimed — "a plainer settlement, never a sealed one". The trouble was that a
// row of lots sits directly under two corners, so the drop was not the rare
// fallback the comment describes: with four features declared together, a
// VILLAGE placed NONE of them, and an outpost, a hamlet and a town placed two.
// Silently, while the brief goes on telling the model its features will exist.
//
// Two things were wrong. The corners were the only candidates, and the 9x6
// footprint they were tested against was a fiction — `market-stalls` paints
// three tables on ONE ROW and `landmark-stone` paints a single tile, and both
// were refused for want of fifty times the ground they use.
//
// Measured before: outpost 2, hamlet 2, village 0, town 2, city 4 (of 4).
// Measured after:  outpost 3, hamlet 4, village 3, town 4, city 4.
{
  const FEATURES = [
    { tag: "market-stalls", name: "The Shambles" },
    { tag: "water-feature", name: "The Millpond" },
    { tag: "ruin", name: "The Old Gate" },
    { tag: "landmark-stone", name: "The Reckoning Stone" },
  ];
  const PLACES = [
    { kind: "gathering", name: "The Kettle" },
    { kind: "hall", name: "The Guildhall" },
    { kind: "sanctuary", name: "St Ivel's" },
    { kind: "workshop", name: "The Yards" },
  ];
  const CAST = [
    { name: "A", role: "provost", kind: "leader", tint: "blue", home: "Probe", household: 1 },
    { name: "B", role: "innkeep", kind: "host", tint: "amber", home: "Probe", household: 2 },
    { name: "C", role: "smith", kind: "maker", tint: "red", home: "Probe", household: 3 },
    { name: "D", role: "hand", kind: "folk", tint: "green", home: "Probe", household: 4 },
  ];
  const build = (scale, featureCount, placeCount, seed) =>
    world.build(
      seed,
      "cozy-village",
      brief.validate(
        {
          scale,
          prosperity: "thriving",
          name: "Probe",
          features: FEATURES.slice(0, featureCount),
          places: PLACES.slice(0, placeCount),
          cast: CAST,
        },
        { theme: "cozy-village", seed },
      ),
    );
  // A feature PLACED is one that paints tiles: adding it to the brief changes
  // z1. Counted cumulatively, because four features compete for the same
  // ground — asking whether each can place ALONE is a different, easier
  // question, and it is the one that hid this bug.
  const placedCount = (scale, placeCount, seed) => {
    let placed = 0;
    for (let k = 1; k <= FEATURES.length; k++) {
      const withIt = build(scale, k, placeCount, seed).zones.z1;
      const without = build(scale, k - 1, placeCount, seed).zones.z1;
      for (let i = 0; i < withIt.object.length; i++) {
        if (withIt.object[i] !== without.object[i] || withIt.ground[i] !== without.ground[i]) {
          placed++;
          break;
        }
      }
    }
    return placed;
  };

  for (const scale of ["outpost", "hamlet", "village", "town", "city"]) {
    for (const placeCount of [0, 4]) {
      for (const seed of [1, 8080]) {
        // Against what the rank actually SEALS, not a flat four: a settlement
        // that can only carry two features is not failing when it places two.
        const asked = brief.validate(
          { scale, prosperity: "thriving", name: "Probe", features: FEATURES, places: [], cast: CAST },
          { theme: "cozy-village", seed },
        ).features.length;
        const placed = placedCount(scale, placeCount, seed);
        // At most ONE of four may be refused. A settlement genuinely runs out
        // of ground — that is honest — but it does not lose the lot.
        assert.ok(
          placed >= asked - 1,
          `${scale} seed ${seed} (${placeCount} places): placed ${placed} of the ${asked} features the rank sealed`,
        );
      }
    }
  }

  // And the ground features take is not taken from the people: the sleeping
  // places are the same with four features as with none.
  for (const scale of ["outpost", "hamlet", "village", "town", "city"]) {
    const bedsWith = new Set();
    const bedsWithout = new Set();
    for (const [count, into] of [
      [4, bedsWith],
      [0, bedsWithout],
    ]) {
      const w = build(scale, count, 4, 8080);
      for (const zone of Object.values(w.zones))
        for (const bed of zone.beds ?? []) into.add(`${bed.zoneId ?? zone.id}:${bed.x},${bed.y}`);
    }
    assert.equal(
      bedsWith.size,
      bedsWithout.size,
      `${scale}: features cost somebody a bed (${bedsWithout.size} without, ${bedsWith.size} with)`,
    );
  }
}

// ── A NAMED WORKPLACE DOES NOT OVERRULE A KIND THAT DISAGREES ON PURPOSE ────
// The `worker` tier exists for the SIX cast kinds with no row of their own,
// which otherwise fall to "*:resident" and spend the day in the plaza. Placed
// ABOVE the per-kind rows it also shadowed the kinds that DO have one — and it
// broke the single row that disagrees deliberately: `guard:resident` keeps the
// night at `post` so the settlement never looks abandoned, and the generic
// worker row sends everybody home at night. Naming a guard's workplace
// therefore switched off the watch, silently.
//
// A kind that has a row already spends its day at `post`, and `post` IS the
// named workplace by the time this resolves, so the two agree without the
// generic row's help. It belongs below them.
{
  const handles = (kind, worker) => {
    const sched = { kind, standing: "resident", worker, post: "POST", home: "HOME", public: "PLAZA" };
    return ["dawn", "day", "dusk", "night"].map((part) => loadedPF.schedule.resolve(sched, part)).join(" ");
  };
  // THE REGRESSION: the watch survives being given a workplace.
  assert.equal(
    handles("guard", true),
    handles("guard", false),
    "a guard with a named workplace keeps the kind's own hours",
  );
  assert.ok(
    handles("guard", true).includes("night=POST".replace("night=", "")),
    "sanity: the guard row is post-at-night",
  );
  assert.equal(
    handles("guard", true).split(" ")[3],
    "POST",
    "a named guard still keeps the night watch — the settlement never looks abandoned",
  );
  // And the tier still does the job it was added for: the row-less kinds hold
  // their post through the day instead of leaking to the plaza.
  for (const kind of ["folk", "healer", "scholar", "elder", "child", "wanderer"]) {
    assert.equal(
      handles(kind, false).split(" ")[1],
      "PLAZA",
      `${kind} has no row of its own, so it defaults to the square`,
    );
    assert.equal(handles(kind, true).split(" ")[1], "POST", `${kind} with a named workplace is AT it at midday`);
  }
}

// ── A WORKPLACE AND A WORK POST LIVE IN DIFFERENT ID SPACES ────────────────
// `workplace` resolves against the BRIEF's declared zones, so it always names a
// `z*`. A work post (the strip behind a shop counter) belongs to a building the
// COMPILER minted, which is `s*` or `h*` and has no brief name to be named by.
// The two can never meet, which is why the cast loop has no counter branch —
// review flagged the lookup that used to sit there as unreachable, and it was.
//
// Pinned because the removal RELIES on it: if a future change ever gives a
// brief-declared place a compiler work post, or lets a workplace name a minted
// building, this fails and whoever did it learns that the box a named worker
// stands in needs revisiting.
{
  const sealed = brief.validate(
    {
      scale: "town",
      prosperity: "thriving",
      name: "Probe",
      places: [
        { kind: "workshop", name: "The Yards" },
        { kind: "gathering", name: "The Kettle" },
      ],
      cast: [
        { name: "A", role: "smith", kind: "maker", tint: "red", home: "Probe", household: 1 },
        { name: "B", role: "innkeep", kind: "host", tint: "amber", home: "The Kettle", household: 2 },
        { name: "C", role: "hand", kind: "folk", tint: "green", home: "Probe", workplace: "The Yards", household: 3 },
        { name: "D", role: "trader", kind: "merchant", tint: "violet", home: "Probe", household: 4 },
      ],
    },
    ctx,
  );
  const w = world.build(7, "cozy-village", sealed);
  const briefZoneIds = new Set(Object.keys(sealed._ids.zones));
  assert.ok(briefZoneIds.size >= 3, "the brief declared zones to check against");
  for (const id of briefZoneIds) {
    assert.ok(/^z\d+$/.test(id), `a brief-declared zone id is always z*, got ${id}`);
  }
  // No compiled zone that a workplace could name carries a work post.
  for (const id of briefZoneIds) {
    const zone = w.zones[id];
    if (!zone) continue;
    assert.ok(!zone.workPost, `${id} is nameable as a workplace, so it must not carry a work post`);
  }
  // And the named worker really is inside the zone they were assigned.
  const at = (name) => {
    for (const id in w.zones) if (w.zones[id].npcs.some((n) => n.name === name)) return id;
    return null;
  };
  const yardsId = Object.entries(sealed._ids.zones).find(([, n]) => n === "The Yards")[0];
  const sim = new loadedPF.Sim(w);
  sim.clockMin = 12 * 60;
  sim.resolveSchedules();
  assert.equal(at("C"), yardsId, "a named worker is in the workshop at midday");
}

// ── OPEN SPANS ARE RECORDED, NOT MERELY UNPAINTED (0.10) ───────────────────
// `zone.areas` is the second half of the geometry: a room is a walled partition
// with a door, an area is open floor the common room runs through. They cannot
// be one list — three assertions require a door per `zone.rooms` record, and the
// reachability sweep resolves one at `(doorX, y1 + 1)`, so a doorless span would
// read as `undefined,NaN`.
//
// Pinned because an empty `areas` is indistinguishable from a working one until
// something reads it: this is the assertion that catches the list quietly never
// being filled.
{
  const sealed = brief.validate(
    {
      scale: "village",
      prosperity: "thriving",
      name: "Bandwick",
      cast: [
        // Four under one roof sends the sleeping band UPSTAIRS, which is what
        // vacates the band the long table stands in.
        ...Array.from({ length: 4 }, (_, i) => ({
          name: `K${i}`,
          role: "kin",
          kind: "folk",
          tint: "green",
          home: "Bandwick",
          household: 1,
        })),
        { name: "Solo", role: "hand", kind: "folk", tint: "blue", home: "Bandwick", household: 2 },
      ],
    },
    ctx,
  );
  const w = world.build(31, "cozy-village", sealed);
  checkWorld(w, sealed, "areas");

  const withDining = Object.values(w.zones).filter((z) => (z.areas ?? []).some((a) => a.purpose === "dining"));
  assert.ok(withDining.length > 0, "a household that sent its beds upstairs records the vacated band as an open area");
  for (const zone of withDining) {
    const dining = zone.areas.find((a) => a.purpose === "dining");
    // It is the band layoutSleeping would have partitioned, and it is OPEN —
    // no record of it may appear in `rooms`, which is what carries doors.
    assert.equal(dining.y0, 2, `${zone.id}: the vacated band starts where the sleeping band did`);
    assert.ok(
      !zone.rooms.some((r) => r.y0 === dining.y0),
      `${zone.id}: the vacated band is an AREA, never a room — rooms carry doors and this has none`,
    );
    // And it is walkable: the long table is solid, the band around it is not.
    let open = 0;
    for (let x = dining.x0; x <= dining.x1; x++)
      for (let y = dining.y0; y <= dining.y1; y++) if (!zone.solid[zone.w * y + x]) open++;
    assert.ok(open > 0, `${zone.id}: the recorded open area has walkable floor in it`);
  }
}

// ── A SETTLEMENT IS AS POPULOUS AS ITS RANK, NOT AS ITS CAST (0.10.0) ──────
// A brief may name ten people, and for a long time those ten WERE the town: the
// compiler built a house per named household and stopped. A city compiled to
// eighteen buildings on a 96x72 map whatever the brief said, which is a village
// with a long walk between the houses, and no amount of population in the brief
// changed it. The compiler now mints the rest of the town itself.
//
// Three axes, asserted separately because they fail separately.
{
  const CAST = [
    { name: "Ivy", role: "warden", kind: "leader", tint: "blue", home: "Probe", household: 1 },
    { name: "Bett", role: "innkeep", kind: "host", tint: "amber", home: "Probe", household: 2 },
    { name: "Tam", role: "smith", kind: "maker", tint: "red", home: "Probe", household: 3 },
  ];
  const build = (over, seed = 7) =>
    world.build(
      seed,
      "cozy-village",
      brief.validate(
        { scale: "village", prosperity: "modest", name: "Probe", places: [], cast: CAST, ...over },
        { theme: "cozy-village", seed },
      ),
    );
  const souls = (w) => Object.values(w.zones).reduce((n, z) => n + z.npcs.length, 0);
  const roofs = (w) => Object.values(w.zones).filter((z) => z.mapKind === "building").length;

  // AXIS 1 — size. Each rank holds more people than the one below it. Strictly:
  // a city that merely ties a town is the bug this whole slice exists to fix.
  const ranks = ["outpost", "hamlet", "village", "town", "city"].map((scale) => ({
    scale,
    souls: souls(build({ scale, prosperity: "thriving" })),
  }));
  const shown = () => ranks.map((r) => `${r.scale}:${r.souls}`).join(" ");
  for (let i = 1; i < ranks.length; i++) {
    assert.ok(
      ranks[i].souls >= ranks[i - 1].souls,
      `a ${ranks[i].scale} is never smaller than a ${ranks[i - 1].scale} (${shown()})`,
    );
  }
  // Strict from the village up, and NOT below it — measured, not conceded. An
  // outpost and a hamlet with a four-person cast come out the same size because
  // at those ranks the named cast IS the town: a hamlet's eight lots are a
  // gathering, three trades and four households, which is full. The ground stops
  // being the constraint at village, and from there each rank must genuinely
  // outgrow the one below or the whole exercise failed.
  for (let i = ranks.findIndex((r) => r.scale === "village"); i < ranks.length; i++) {
    assert.ok(
      ranks[i].souls > ranks[i - 1].souls,
      `a ${ranks[i].scale} holds more than a ${ranks[i - 1].scale} (${shown()})`,
    );
  }
  // And the top of the range is a CITY and not a hamlet with ambition.
  assert.ok(
    ranks[4].souls >= 60,
    `a thriving city is populous in absolute terms, not just relatively (${ranks[4].souls} souls)`,
  );

  // AXIS 2 — prosperity. Same ground, fewer people, and the houses that do stand
  // are fewer: a struggling town is emptier, not merely poorer-looking.
  for (const scale of ["village", "town", "city"]) {
    const poor = build({ scale, prosperity: "struggling" });
    const rich = build({ scale, prosperity: "thriving" });
    assert.ok(
      souls(rich) > souls(poor),
      `a thriving ${scale} outnumbers a struggling one (${souls(rich)} vs ${souls(poor)})`,
    );
    assert.ok(roofs(rich) >= roofs(poor), `and never has fewer roofs (${roofs(rich)} vs ${roofs(poor)})`);
  }

  // AXIS 3 — population, and the LIMIT on it. backgroundPopulation is the
  // brief's least-constrained number: a free 0-500 the guidance calls narrative
  // texture. It may move a settlement within its rank's band; it may never make
  // a hamlet into a city, or a model's typo re-founds the town.
  const quiet = souls(build({ scale: "town", backgroundPopulation: 12 }));
  const busy = souls(build({ scale: "town", backgroundPopulation: 400 }));
  assert.ok(busy > quiet, `population moves the town within its band (${busy} vs ${quiet})`);
  const hugeHamlet = souls(build({ scale: "hamlet", prosperity: "thriving", backgroundPopulation: 500 }));
  const smallTown = souls(build({ scale: "town", prosperity: "struggling", backgroundPopulation: 0 }));
  assert.ok(
    hugeHamlet < smallTown,
    `a hamlet claiming five hundred souls is still smaller than a struggling town (${hugeHamlet} vs ${smallTown})`,
  );

  // The minted residents are RESIDENTS, not scenery: every one of them has a bed
  // and is in it at 23:00. This is the assertion that catches a mint which
  // outruns the housing arithmetic and leaves people on the plaza all night.
  for (const scale of ["village", "town", "city"]) {
    const w = build({ scale, prosperity: "thriving" });
    const sim = new loadedPF.Sim(w);
    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    const outdoors = w.zones.z1.npcs.filter((npc) => (npc._sched.standing ?? "resident") === "resident");
    assert.equal(
      outdoors.length,
      0,
      `${scale}: no resident sleeps outdoors (${outdoors.map((n) => n.name).join() || "-"})`,
    );
  }

  // A minted resident never anchors a special building — the hall, the shop and
  // the farm belong to people the brief NAMED, and a nameless leader would be a
  // building with nobody worth meeting in it.
  {
    const w = build({ scale: "city", prosperity: "thriving" });
    const named = new Set(CAST.map((c) => c.name));
    for (const zone of Object.values(w.zones)) {
      if (zone.mapKind !== "building") continue;
      const owner = zone.name.includes("'s ") ? zone.name.split("'s ")[0] : null;
      // "X's home", and also "X's home, upstairs" and "X's home cellar" — a
      // dwelling's floors are named off the dwelling, so an endsWith test misses
      // two of the three and asks a question about houses that only makes sense
      // about workplaces.
      if (!owner || zone.name.includes("'s home")) continue;
      assert.ok(owner && named.has(owner), `${zone.name} is run by somebody the brief named`);
    }
  }

  // Determinism: the mint is a pure function of the seed and the sealed brief,
  // so two builds agree down to the name of every last resident. Without this
  // the roster would drift between the compile that saved and the compile that
  // restored, and a save would come back to a different town.
  const roster = (w) =>
    Object.values(w.zones)
      .flatMap((z) => z.npcs.map((n) => `${n.name}@${z.id}:${Math.round(n.x)},${Math.round(n.y)}`))
      .sort()
      .join("|");
  assert.equal(
    roster(build({ scale: "city", prosperity: "thriving" })),
    roster(build({ scale: "city", prosperity: "thriving" })),
    "the same brief mints the same city twice",
  );
  assert.notEqual(
    roster(build({ scale: "city", prosperity: "thriving" }, 7)),
    roster(build({ scale: "city", prosperity: "thriving" }, 8)),
    "and a different seed mints a different one",
  );
}

// ── A BOUND SPECIAL SHARES A FACADE, AND THE MINT MUST KNOW IT (0.10.0) ────
// lotsForHouses is a forward prediction made before a single lot is claimed,
// and it used to charge every special a lot — but a special bound to a named
// place (the host's inn IS the gathering, the maker's shop IS the workshop)
// shares that place's facade and never takes one. Charging it anyway starved
// the mint on exactly the briefs rich enough to bind: one hamlet in three with
// a bound special compiled households short while the lots they were owed sat
// bare. This fixture binds three of its four specials, so the old arithmetic
// predicted ONE house lot where the ground held four.
{
  const CAST = [
    { name: "Bram", role: "innkeep", kind: "host", tint: "amber", home: "Bindstead", household: 1 },
    { name: "Wren", role: "reeve", kind: "leader", tint: "blue", home: "Bindstead", household: 1 },
    { name: "Osk", role: "smith", kind: "maker", tint: "red", home: "Bindstead", household: 1 },
    { name: "Pell", role: "farmer", kind: "grower", tint: "green", home: "Bindstead", household: 1 },
  ];
  const PLACES = [
    { kind: "gathering", name: "The Kettle" },
    { kind: "hall", name: "The Moot" },
    { kind: "workshop", name: "The Forge" },
  ];
  for (const seed of [7, 11]) {
    const sealed = brief.validate(
      { scale: "hamlet", prosperity: "modest", name: "Bindstead", places: PLACES, cast: CAST },
      { theme: "cozy-village", seed },
    );
    const w = world.build(seed, "cozy-village", sealed);
    checkWorld(w, sealed, `bound-special mint seed ${seed}`);
    // Eight lots, three places, and only the farm buys its own ground — the
    // inn, the hall and the shop ride the facades the places already paid for.
    // Four lots remain, so four households resolve: three street houses and
    // one family housed over its trade. Under the old arithmetic the target
    // was ONE, the named household took it, and the mint added nobody — the
    // hamlet compiled with four souls and three lots of bare grass.
    const houses = Object.keys(w.zones).filter((id) => /^h\d+$/.test(id)).length;
    assert.equal(houses, 3, `seed ${seed}: the mint fills the ground the bound specials never took (${houses})`);
    const soulCount = Object.values(w.zones).reduce((n, z) => n + z.npcs.length, 0);
    assert.ok(
      soulCount > CAST.length,
      `seed ${seed}: minted residents exist beyond the named cast (${soulCount} souls)`,
    );
  }

  // And the geometry half of the backgroundPopulation contract the schema doc
  // states: the dial builds HOUSES within the band — not just walkers — while
  // the map stays its size and the guest wing never reads it. The doc quotes
  // seed-7 figures as illustration; this is the claim those figures illustrate.
  const dial = (backgroundPopulation) => {
    const sealed = brief.validate(
      {
        scale: "town",
        prosperity: "modest",
        name: "Dialton",
        places: [{ kind: "gathering", name: "The Ladle" }],
        cast: [{ name: "Mip", role: "cook", kind: "folk", tint: "teal", home: "Dialton", household: 1 }],
        backgroundPopulation,
      },
      { theme: "cozy-village", seed: 7 },
    );
    return world.build(7, "cozy-village", sealed);
  };
  const quietTown = dial(12);
  const busyTown = dial(400);
  const roofCount = (w) => Object.keys(w.zones).filter((id) => /^h\d+$/.test(id)).length;
  assert.ok(
    roofCount(busyTown) > roofCount(quietTown),
    `population builds houses within the band (${roofCount(busyTown)} vs ${roofCount(quietTown)})`,
  );
  assert.equal(busyTown.zones.z1.w, quietTown.zones.z1.w, "and never resizes the map");
  assert.equal(busyTown.zones.z1.h, quietTown.zones.z1.h, "in either direction");
  assert.equal(
    findZone(busyTown, "The Ladle").beds.length,
    findZone(quietTown, "The Ladle").beds.length,
    "and the guest wing never reads it",
  );
}

// ── A TOWN IS NOT ONE BUILDING STAMPED OUT (0.10.0) ────────────────────────
// Every dwelling was 6x4 unless the over-subscription merge widened it, and every
// workplace was 6x4 full stop, so a town was thirty identical boxes on a grid.
// Nothing failed: the houses were the right count, in the right places, with the
// right people asleep in them. It just read as one building repeated, which is a
// large part of what "it looks like a game from 1996" actually means.
//
// Size follows PROGRAM now — a roof is sized by what has to fit under it — so
// this asserts on the SPREAD of footprints rather than on any particular one.
{
  const cast = [
    { name: "Ivy", role: "warden", kind: "leader", tint: "blue", home: "Bigg", household: 1 },
    { name: "Bett", role: "innkeep", kind: "host", tint: "amber", home: "Bigg", household: 2 },
    { name: "Tam", role: "smith", kind: "maker", tint: "red", home: "Bigg", household: 3 },
    { name: "Pel", role: "farmer", kind: "grower", tint: "green", home: "Bigg", household: 4 },
    { name: "Gar", role: "watch", kind: "guard", tint: "grey", home: "Bigg", household: 5 },
  ];
  const sealed = brief.validate(
    { scale: "town", prosperity: "thriving", name: "Bigg", places: [], cast },
    { theme: "cozy-village", seed: 7 },
  );
  const w = world.build(7, "cozy-village", sealed);
  // Footprints are read off the TILES, not off the compiler's bookkeeping: a
  // roof somebody widened in a variable but never painted is not a wider house.
  // A door's building is the run of wall it sits in, and its height the stack of
  // stone above that run.
  const v = w.zones.z1;
  const solidAt = (x, y) => x >= 0 && y >= 0 && x < v.w && y < v.h && !!v.solid[v.w * y + x];
  const shapes = new Set();
  v.object.forEach((tile, index) => {
    if (tile !== "door") return;
    const dx = index % v.w;
    const dy = (index / v.w) | 0;
    let x0 = dx;
    while (solidAt(x0 - 1, dy)) x0--;
    let x1 = dx;
    while (solidAt(x1 + 1, dy)) x1++;
    let y0 = dy;
    while (solidAt(dx, y0 - 1) || v.object[v.w * (y0 - 1) + dx] === "wallStone") y0--;
    shapes.add(`${x1 - x0 + 1}x${dy - y0 + 1}`);
  });
  assert.ok(shapes.size >= 3, `a town is built of more than one shape (${[...shapes].sort().join(" ") || "none"})`);
  // Non-vacuous: it really did find buildings, and enough of them that a spread
  // of three is a spread rather than an accident of a tiny sample.
  const doors = v.object.filter((tile) => tile === "door").length;
  assert.ok(doors >= 12, `and there are enough of them for that to mean anything (${doors} doors)`);
}

// ── A HOUSE IS AS BIG AS ITS HOUSEHOLD (0.10.0) ────────────────────────────
// INTERIOR_DIMS handed every dwelling the same fourteen columns, and fourteen
// fits two bedrooms. So a household of six fell straight past the partitioner
// into the open plan — not because six people cannot have bedrooms, but because
// the shell they were given had two. The building was answering a question about
// its own width and reporting the answer as a fact about the family.
{
  const dwelling = (size, seed = 1) => {
    const w = world.build(seed, "cozy-village", brief.validate(houseBrief("Growhome", size, "folk"), ctx));
    const home = findZone(w, "Kin0's home");
    assert.ok(home, `the ${size}-person household compiled a dwelling`);
    return { home, sleeping: bedFloor(w, home) };
  };
  const small = dwelling(2);
  const large = dwelling(6);
  assert.ok(
    large.home.w > small.home.w,
    `six under a roof get a wider roof than two (${small.home.w} vs ${large.home.w})`,
  );
  assert.ok(
    large.sleeping.rooms.length > small.sleeping.rooms.length,
    `and more rooms with it (${small.sleeping.rooms.length} vs ${large.sleeping.rooms.length})`,
  );
  // The shell grew for a REASON, so the rooms it grew for are really in it: every
  // one walled, doored, and holding somebody. A wider box with the same two rooms
  // rattling about in it would pass the width assertion above and be worthless.
  for (const room of large.sleeping.rooms) {
    assert.ok(room.beds.length > 0, `every room the house grew has somebody in it`);
    assert.ok(Number.isInteger(room.doorX), `and a door of its own`);
  }
  assert.ok(large.home.beds.length + (large.sleeping.beds?.length ?? 0) > 0, "the large house has beds at all");

  // ...but a TENEMENT does not grow. A block the over-subscription merge put
  // several households into should run out of rooms and fall to the open plan:
  // a building holding five families is a bunkhouse, and that is a fact about the
  // building rather than a shortfall in it. Same total headcount, different
  // answer, which is the whole distinction.
  const merged = world.build(1, "cozy-village", bunkhouseSealed(4));
  const block = findZone(merged, "Ada's home");
  assert.ok(block, "the merged block compiled");
  assert.equal(
    block.w,
    small.home.w,
    `a tenement keeps the plain shell (${block.w} vs ${small.home.w}) — it is a bunkhouse, not a big family`,
  );
}

// ── EVERY TILE THE COMPILER PLACES HAS ART (0.10.0) ────────────────────────
// Found by walking into it: `hearth` was added to the dwelling furnisher and the
// painter patch silently missed its anchor, so the compiler placed an object no
// renderer could draw. The entire harness passed — every assertion here is about
// geometry, occupancy and schedule, and none of them look at whether a tile can
// be SEEN. In the browser it would have been a solid square of bare floor in the
// corner of every house in the world.
{
  const drawable = new Set(loadedPF.art.painterNames());
  assert.ok(drawable.size > 10, `the art module reported its painters (${drawable.size})`);
  const missing = new Map();
  const look = (w, label) => {
    for (const zone of Object.values(w.zones)) {
      for (const layer of ["object", "overhead"]) {
        for (const tile of zone[layer]) {
          if (!tile || drawable.has(tile)) continue;
          if (!missing.has(tile)) missing.set(tile, `${label} ${zone.id}`);
        }
      }
    }
  };
  for (const theme of ["cozy-village", "sci-fi-colony"]) {
    for (const seed of [1, 7, 424242]) look(world.build(seed, theme, brief.defaults(theme, seed)), `${theme}/${seed}`);
    for (const scale of ["outpost", "hamlet", "village", "town", "city"]) {
      for (const prosperity of ["struggling", "thriving"]) {
        const sealed = brief.validate(
          {
            scale,
            prosperity,
            name: "Artcheck",
            features: [
              { tag: "market-stalls", name: "F0" },
              { tag: "water-feature", name: "F1" },
              { tag: "ruin", name: "F2" },
              { tag: "landmark-stone", name: "F3" },
            ],
            places: [
              { kind: "gathering", name: "P0" },
              { kind: "hall", name: "P1" },
              { kind: "sanctuary", name: "P2" },
              { kind: "wilds", name: "P3" },
            ],
            cast: [
              { name: "A", role: "reeve", kind: "leader", tint: "blue", home: "Artcheck", household: 1 },
              { name: "B", role: "innkeep", kind: "host", tint: "amber", home: "P0", household: 2 },
              { name: "C", role: "smith", kind: "maker", tint: "red", home: "Artcheck", household: 3 },
              { name: "D", role: "farmer", kind: "grower", tint: "green", home: "Artcheck", household: 4 },
              { name: "E", role: "watch", kind: "guard", tint: "grey", home: "Artcheck", household: 5 },
              { name: "F", role: "elder", kind: "elder", tint: "violet", home: "P2", household: 6 },
            ],
          },
          { theme, seed: 11 },
        );
        look(world.build(11, theme, sealed), `${theme}/${scale}/${prosperity}`);
      }
    }
  }
  assert.equal(
    missing.size,
    0,
    `every placed tile can be drawn (${[...missing].map(([tile, where]) => `${tile} in ${where}`).join(", ")})`,
  );
}

// ── A DAY HAS A SHAPE (0.10.0) ─────────────────────────────────────────────
// An ordinary resident's dawn and dusk were both `post`, so a settlement stood
// at its work anchors from waking until sleeping and the only thing a whole day
// did was empty the houses at noon. Dawn and dusk belong to the HEARTH: the
// household is in and around the fire at first light and again at last, which is
// also what makes a lit window at dusk mean somebody is behind it.
{
  const cast = [
    { name: "Ivy", role: "warden", kind: "leader", tint: "blue", home: "Dayshape", household: 1 },
    { name: "Bett", role: "innkeep", kind: "host", tint: "amber", home: "Dayshape", household: 2 },
    { name: "Tam", role: "smith", kind: "maker", tint: "red", home: "Dayshape", household: 3 },
  ];
  const sealed = brief.validate(
    { scale: "village", prosperity: "thriving", name: "Dayshape", places: [], cast },
    { theme: "cozy-village", seed: 7 },
  );
  const w = world.build(7, "cozy-village", sealed);
  const fireside = () =>
    Object.values(w.zones)
      .filter((z) => z.hearth)
      .reduce((n, z) => n + z.npcs.length, 0);
  const at = (hour) => {
    const sim = new loadedPF.Sim(w);
    sim.clockMin = hour * 60;
    sim.resolveSchedules();
    return { outdoors: w.zones.z1.npcs.length, indoors: fireside() };
  };
  const dawn = at(6);
  const noon = at(12);
  const dusk = at(19);
  const souls = Object.values(w.zones).reduce((n, z) => n + z.npcs.length, 0);
  assert.ok(souls >= 12, `the fixture has a settlement in it (${souls} souls)`);
  // The shape itself: in at first light, out at noon, in again at last light.
  assert.ok(dawn.indoors > dawn.outdoors, `at dawn a village is indoors (${dawn.indoors} in, ${dawn.outdoors} out)`);
  assert.ok(noon.outdoors > noon.indoors, `at noon it is out (${noon.outdoors} out, ${noon.indoors} in)`);
  assert.ok(dusk.indoors > dusk.outdoors, `at dusk it is back in (${dusk.indoors} in, ${dusk.outdoors} out)`);
  // Non-vacuous: they are at the FIRE, not merely somewhere indoors. Every one of
  // them is within reach of a hearth tile on the floor they are standing on.
  const sim = new loadedPF.Sim(w);
  sim.clockMin = 6 * 60;
  sim.resolveSchedules();
  let besideAFire = 0;
  for (const zone of Object.values(w.zones)) {
    if (!zone.hearth) continue;
    for (const npc of zone.npcs) {
      if (Math.abs(npc.x - zone.hearth.x) <= 4 && Math.abs(npc.y - zone.hearth.y) <= 2) besideAFire++;
    }
  }
  assert.ok(
    besideAFire >= dawn.indoors / 2,
    `and they are AT the fire rather than merely under the roof (${besideAFire} of ${dawn.indoors})`,
  );
}

// ── A DWELLING HAS A KITCHEN AND A FIRE (0.10.0) ───────────────────────────
// The room vocabulary, in the dimension a cottage actually has one: a kitchen is
// not a room behind a door in a house this size, it is the corner of the main
// room with the counter in it. Recorded as an AREA, the same way the vacated
// band records itself, because open floor with a purpose is still a purpose.
{
  const w = world.build(1, "cozy-village", brief.defaults("cozy-village", 1));
  const homes = Object.values(w.zones).filter((z) => z.mapKind === "building" && /'s home$/.test(z.name));
  assert.ok(homes.length >= 2, `the default world has houses in it (${homes.length})`);
  for (const home of homes) {
    const kitchen = (home.areas ?? []).find((a) => a.purpose === "kitchen");
    assert.ok(kitchen, `${home.name} has a kitchen recorded`);
    // The counter is really THERE, not merely declared — an area record with no
    // furniture in it is a comment, not a kitchen.
    let counters = 0;
    for (let x = kitchen.x0; x <= kitchen.x1; x++) {
      if (home.object[home.w * kitchen.y0 + x] === "counter") counters++;
    }
    assert.ok(counters > 0, `${home.name}'s kitchen has a counter in it`);
    assert.ok(home.hearth, `${home.name} has a hearth`);
    assert.equal(
      home.object[home.w * home.hearth.y + home.hearth.x],
      "hearth",
      `${home.name}'s hearth is painted where it is recorded`,
    );
    // And the corridor stays clear. Row h-4 is what every bedroom door opens
    // onto; the kitchen was laid across it once and sealed a household into its
    // own bedrooms, so this is the specific row that must never carry furniture.
    for (let x = 1; x < home.w - 1; x++) {
      assert.ok(
        !home.solid[home.w * (home.h - 4) + x],
        `${home.name} left the corridor row clear at ${x},${home.h - 4}`,
      );
    }
  }
}

// ── THE SQUARE HAS A WELL IN IT (0.10.0) ───────────────────────────────────
// A plaza was eight by eight tiles of paving and nothing else: the one place in
// a settlement everybody walks through, and the only one with nothing in it. The
// well is the oldest reason for a village to have a centre at all.
//
// Laid AFTER the buildings and only onto free ground — placed before them, an
// outpost simply built a house over it, and the settlements that can least
// afford a bare square were exactly the ones that got one. All four quadrants
// are tried, which is what makes this hold at every rank rather than only where
// the ground is loose.
{
  const cast = [
    { name: "Ivy", role: "warden", kind: "leader", tint: "blue", home: "Wellsq", household: 1 },
    { name: "Bett", role: "innkeep", kind: "host", tint: "amber", home: "Wellsq", household: 2 },
  ];
  let checked = 0;
  for (const scale of ["outpost", "hamlet", "village", "town", "city"]) {
    for (const prosperity of ["struggling", "modest", "thriving"]) {
      for (const seed of [1, 7, 424242]) {
        const sealed = brief.validate(
          { scale, prosperity, name: "Wellsq", places: [], cast },
          { theme: "cozy-village", seed },
        );
        const v = world.build(seed, "cozy-village", sealed).zones.z1;
        assert.ok(v.object.includes("well"), `${scale}/${prosperity} seed ${seed}: the square has a well`);
        // Never on the crossroad or the arrival tile. Those two rows and two
        // columns are the settlement's through-traffic, and the spawn sits on
        // one of them — a well there blocks the way in on the first frame.
        const midX = (v.w / 2) | 0;
        const midY = (v.h / 2) | 0;
        for (const [x, y] of [
          [midX, midY],
          [midX - 1, midY],
          [midX, midY - 1],
          [v.spawn.x, v.spawn.y],
        ]) {
          assert.ok(!v.solid[v.w * y + x], `${scale}/${prosperity} seed ${seed}: ${x},${y} stays walkable`);
        }
        checked++;
      }
    }
  }
  assert.equal(checked, 45, `the sweep ran (${checked})`);
}

// ── A CITY HAS QUARTERS (0.10.0) ───────────────────────────────────────────
// One plaza at the crossroad is a ten-minute walk from three quarters of a
// 104x72 map — a city served by a single square is a village in a coat. A city
// carves WARDS: one square per quadrant, each with its own well, and the people
// of that quarter keep it instead of all walking to the middle of town.
//
// Only where it is a real problem: a village has one centre because a village IS
// one centre, and four would be four empty squares.
{
  const cast = [
    { name: "Ivy", role: "provost", kind: "leader", tint: "blue", home: "Wardsby", household: 1 },
    { name: "Bett", role: "innkeep", kind: "host", tint: "amber", home: "Wardsby", household: 2 },
  ];
  const built = (scale) => {
    const sealed = brief.validate(
      { scale, prosperity: "thriving", name: "Wardsby", places: [], cast },
      { theme: "cozy-village", seed: 7 },
    );
    return world.build(7, "cozy-village", sealed).zones.z1;
  };
  // A ward is paving with a well in it, away from the crossroad. Counted off the
  // TILES rather than a bookkeeping array, so a ward recorded but never painted
  // does not pass.
  const wardWells = (v) => {
    const midX = (v.w / 2) | 0;
    const midY = (v.h / 2) | 0;
    let found = 0;
    v.object.forEach((tile, index) => {
      if (tile !== "well") return;
      const x = index % v.w;
      const y = (index / v.w) | 0;
      if (Math.abs(x - midX) <= 8 && Math.abs(y - midY) <= 7) return; // the town's own well
      if (v.ground[index] !== "stone") return; // a park's well stands on grass
      found++;
    });
    return found;
  };
  // CURRENT TUNING, pinned on purpose: four wards per city, none below city
  // (wards are cities-only today — a village IS one centre). If a rank ever
  // earns more wards or a town earns its first, move these numbers with the
  // change; red here after such a change is the pin aging, not a regression.
  const city = built("city");
  assert.equal(wardWells(city), 4, `a city carves four ward squares (${wardWells(city)})`);
  for (const scale of ["village", "town"]) {
    assert.equal(wardWells(built(scale)), 0, `a ${scale} has one centre, not four`);
  }

  // And they are USED. Three grains of public life at midday — the town's centre,
  // the quarter's centre, and the street outside your own door — with nobody
  // grain holding everybody, which is the failure this replaced in both
  // directions (a hundred in one plaza, or a plaza nobody attends).
  const sim = new loadedPF.Sim({ zones: { z1: city }, startZone: "z1" });
  sim.clockMin = 12 * 60;
  sim.resolveSchedules();
  const midX = (city.w / 2) | 0;
  const midY = (city.h / 2) | 0;
  const outdoors = city.npcs.length;
  const plaza = city.npcs.filter((n) => Math.abs(n.x - midX) <= 6 && Math.abs(n.y - midY) <= 5).length;
  const onWard = city.npcs.filter((n) => {
    const at = city.w * Math.round(n.y) + Math.round(n.x);
    return city.ground[at] === "stone" && (Math.abs(n.x - midX) > 8 || Math.abs(n.y - midY) > 7);
  }).length;
  assert.ok(outdoors > 60, `the city is out of doors at noon (${outdoors})`);
  assert.ok(plaza > 5, `the town's own square is still busy (${plaza})`);
  assert.ok(onWard > 5, `and the wards are used (${onWard})`);
  assert.ok(
    plaza < outdoors / 2 && onWard < outdoors / 2,
    `no single square holds the city (plaza ${plaza}, wards ${onWard}, of ${outdoors})`,
  );
}

// ── A RISEN SANCTUARY DOES NOT ROOF ITS NEIGHBOUR (0.10.0) ─────────────────
// A sanctuary lifts its facade by up to two rows, and `headroom()` checks the
// border ring and the road — but not the LOT ROW eight tiles above it. Rows are
// laid on a pitch of 8 and a body is 5 tall, so a sanctuary that rises two puts
// its eave on `slotY - 3`: the next row's door apron, the tile that household
// stands on to be spoken to. Overhead composites over actors, so they stand
// there invisible.
//
// It needs a specific shape to reproduce — a village or larger, with the place
// order handing the sanctuary a slot that HAS a neighbour above it — which is
// why it survived a harness with two hundred cases in it and was caught by
// sweeping place orders instead. Both directions of the fix are exercised here:
// the sanctuary is built before the dwelling above it (the dwelling clears its
// own step) and other pairs land the other way round (the roofline is refused).
{
  const cast = [
    { name: "Ivy", role: "reeve", kind: "leader", tint: "blue", home: "Spire", household: 1 },
    { name: "Bett", role: "innkeep", kind: "host", tint: "amber", home: "Spire", household: 2 },
    { name: "Nel", role: "chaplain", kind: "elder", tint: "violet", home: "Spire", household: 3 },
    { name: "Tam", role: "smith", kind: "maker", tint: "red", home: "Spire", household: 4 },
  ];
  // ORDER IS THE POINT, and one order is not enough. The sanctuary must not be
  // first, so that it claims a slot with a lot row still above it — and WHICH
  // slot decides which row its eave lands on. Third in the list puts the eave on
  // the neighbour's DOORSTEP; fourth puts it on their FRONT WALL. Sweeping one
  // order proves half the fix and leaves the other half a comment.
  const ORDERS = [
    [
      { kind: "hall", name: "The Moot" },
      { kind: "sanctuary", name: "St Brannock's" },
      { kind: "gathering", name: "The Kettle" },
    ],
    [
      { kind: "hall", name: "The Moot" },
      { kind: "gathering", name: "The Kettle" },
      { kind: "workshop", name: "The Yards" },
      { kind: "sanctuary", name: "St Brannock's" },
    ],
  ];
  let checked = 0;
  for (const PLACES of ORDERS) {
    for (const scale of ["village", "town", "city"]) {
      for (const prosperity of ["struggling", "modest", "thriving"]) {
        // Seeds chosen because they REPRODUCE, not because they are round. Seed 1
        // lands the eave on a doorstep; 9 and 13 land it on a front wall. Swept
        // for: with the fix removed, seeds 1/2/3 pass and the case is decoration.
        for (const seed of [1, 9, 13]) {
          const sealed = brief.validate(
            { scale, prosperity, name: "Spire", places: PLACES, cast },
            { theme: "cozy-village", seed },
          );
          const w = world.build(seed, "cozy-village", sealed);
          // checkWorld carries the paint contract, so this case is mostly about
          // REACHING the shape; the assertions below keep the intent local.
          checkWorld(w, sealed, `spire/${scale}/${prosperity} seed ${seed}`);
          const v = w.zones.z1;
          assert.ok(findZone(w, "St Brannock's"), `${scale}/${prosperity} seed ${seed}: the sanctuary compiled`);
          for (let y = 1; y < v.h; y++) {
            for (let x = 0; x < v.w; x++) {
              const at = v.w * y + x;
              const over = v.overhead[at];
              if (over !== "roof" && over !== "roofEdge") continue;
              assert.notEqual(
                v.object[at],
                "wall",
                `${scale}/${prosperity} seed ${seed}: a front wall at ${x},${y} is under ${over}`,
              );
              if (v.object[v.w * (y - 1) + x] === "door" && !v.solid[at]) {
                assert.fail(`${scale}/${prosperity} seed ${seed}: a doorstep at ${x},${y} is under ${over}`);
              }
            }
          }
          checked++;
        }
      }
    }
  }
  assert.equal(checked, 54, `the sweep ran (${checked})`);
}

// ── A WILDS NEVER SWALLOWS THE WAY IN (pre-existing, fixed 0.10.0) ─────────
// `place.features` — up to three features on a named place — was an entirely
// untested path. All sixteen `kind: "wilds"` fixtures in this file are
// featureless, and every `features:` here is on the top-level brief.
//
// What lived in it: the wilds builder dropped features at a hard-coded anchor
// with no test of the road, the stream, the spawn, or the tile the portal
// delivers the player onto. `crop-plots` is a fenced 8x5 whose fence at anchor
// 26 covers x 26..33 — exactly where a WEST-hung wilds puts its spawn (w-4) and
// one of its two arrival tiles (w-3). The player walked west out of town, landed
// inside a solid fence, and could not move in any direction; reloading returned
// them to the other fence tile. Measured on staging: 24 of 48 wilds zones.
//
// Swept over every feature tag rather than the one that bit, because the fault
// was the missing test, not the crop plot.
{
  const cast = [
    { name: "Ivy", role: "warden", kind: "leader", tint: "blue", home: "Wildway", household: 1 },
    { name: "Bett", role: "innkeep", kind: "host", tint: "amber", home: "Wildway", household: 2 },
  ];
  const TAGS = [
    "crop-plots",
    "water-feature",
    "ruin",
    "lookout",
    "shrine",
    "workyard",
    "landmark-stone",
    "market-stalls",
  ];
  let wilds = 0;
  for (const theme of ["cozy-village", "sci-fi-colony"]) {
    for (const scale of ["outpost", "village", "city"]) {
      for (const tag of TAGS) {
        for (const seed of [1, 7]) {
          const sealed = brief.validate(
            {
              scale,
              prosperity: "modest",
              name: "Wildway",
              surround: "woods",
              // BOTH sides: the east-hung wilds keeps its spawn at x=3 and the
              // west-hung one moves it across, and only the second was ever hit.
              places: [
                { kind: "wilds", name: "East Wood", features: [{ tag, name: "F" }] },
                { kind: "wilds", name: "West Fen", features: [{ tag, name: "G" }] },
              ],
              cast,
            },
            { theme, seed },
          );
          const w = world.build(seed, theme, sealed);
          const where = `${theme}/${scale}/${tag}/seed ${seed}`;
          for (const zone of Object.values(w.zones)) {
            if (zone.mapKind !== "place") continue;
            wilds++;
            const spawnAt = zone.w * zone.spawn.y + zone.spawn.x;
            assert.ok(
              !zone.solid[spawnAt],
              `${where}: ${zone.id} spawns at ${zone.spawn.x},${zone.spawn.y}, which is solid`,
            );
            // The tile the SETTLEMENT hands the player, which is not the spawn.
            for (const portal of w.zones.z1.portals) {
              if (portal.toZone !== zone.id) continue;
              assert.ok(
                !zone.solid[zone.w * portal.toY + portal.toX],
                `${where}: arriving in ${zone.id} at ${portal.toX},${portal.toY} lands in something solid`,
              );
            }
            // And they can actually walk once they are there — the assertion the
            // tile checks above only imply. Driven through the real Sim, because
            // the feet box spans more than the tile underfoot.
            const sim = new loadedPF.Sim(w);
            sim.zoneId = zone.id;
            sim.x = zone.spawn.x * loadedPF.TILE + loadedPF.TILE / 2;
            sim.y = zone.spawn.y * loadedPF.TILE + loadedPF.TILE / 2;
            const free = ["right", "left", "down", "up"].filter((dir) => {
              const probe = new loadedPF.Sim(w);
              probe.zoneId = zone.id;
              probe.x = sim.x;
              probe.y = sim.y;
              const x0 = probe.x;
              const y0 = probe.y;
              for (let i = 0; i < 30; i++) probe.step(1 / 60, { [dir]: true });
              return Math.hypot(probe.x - x0, probe.y - y0) > 1;
            });
            assert.ok(free.length > 0, `${where}: ${zone.id} spawns the player somewhere they cannot move from`);
          }
        }
      }
    }
  }
  assert.ok(wilds >= 90, `the sweep visited the wilds (${wilds} zones)`);
}

// ── A GREEN NEVER EATS A NAMED FEATURE (0.10.0) ────────────────────────────
// The greens and the wards take the lots no BUILDING claimed, and `clearFootprint`
// nulls whatever is on them. "Leftover" means empty for buildings — they are
// disjoint from those lots by construction — and NOT for features, which are
// anchored by a pass that tests `claimed` and the roads but not the lot grid. So
// a ruin or a shrine legitimately stands on a lot nobody built on, and a park
// would quietly delete it: 40 of 108 worlds, 168 tiles, with the feature's name
// still in the sealed brief and its id still in `_ids.features`.
//
// Measured as a DIFFERENCE, three builds deep, because there is no other way to
// know which tiles a feature owns: bare, features-without-greens, and both.
{
  const cast = [
    { name: "Ivy", role: "warden", kind: "leader", tint: "blue", home: "Greenwood", household: 1 },
    { name: "Bett", role: "innkeep", kind: "host", tint: "amber", home: "Greenwood", household: 2 },
  ];
  const FEATURES = [
    { tag: "ruin", name: "The Old Gate" },
    { tag: "shrine", name: "The Shrine" },
    { tag: "landmark-stone", name: "The Reckoning Stone" },
    { tag: "water-feature", name: "The Millpond" },
  ];
  const build = (features, scale, prosperity, surround, seed) =>
    world.build(
      seed,
      "cozy-village",
      brief.validate(
        { scale, prosperity, name: "Greenwood", surround, features, places: [], cast },
        { theme: "cozy-village", seed },
      ),
    ).zones.z1;

  let checked = 0;
  let featureTiles = 0;
  let ponds = 0;
  for (const scale of ["village", "town", "city"]) {
    for (const prosperity of ["struggling", "thriving"]) {
      for (const surround of ["woods", "fields"]) {
        for (const seed of [1, 3, 6]) {
          const bare = build([], scale, prosperity, surround, seed);
          const withFeatures = build(FEATURES, scale, prosperity, surround, seed);
          const painted = [];
          for (let i = 0; i < bare.object.length; i++) {
            if (withFeatures.object[i] !== bare.object[i] || withFeatures.ground[i] !== bare.ground[i]) painted.push(i);
          }
          featureTiles += painted.length;
          const where = `${scale}/${prosperity}/${surround} seed ${seed}`;
          // THE POND IS THE INSTRUMENT. `water-feature` paints a 6x4 pool and a
          // well beside it, `surround` is never "water" here, so open water on the
          // map can only be the millpond — a signature nothing else forges.
          //
          // A feature that found no room is DROPPED, which is deliberate and
          // documented ("a plainer settlement, never a sealed one"), so a pond
          // that is not there at all proves nothing and is skipped. A pond that IS
          // there must be WHOLE: twenty-four tiles and its well. Something eating
          // a corner of it is the fault, and it shows as 22.
          //
          // Two detectors were written before this one and both were useless. A
          // count of differing tiles is tautological — `painted` is defined as the
          // tiles that differ, so filtering it for tiles that match is empty by
          // construction. A floor on that count then failed honest worlds, because
          // a legitimately dropped feature and an eaten one look identical from a
          // total. Only "placed, therefore whole" separates them.
          const water = withFeatures.ground.filter((g) => g === "water").length;
          if (water > 0) {
            ponds++;
            assert.equal(water, 24, `${where}: the millpond holds ${water} tiles, not 24 — something painted over it`);
            assert.ok(withFeatures.object.includes("well"), `${where}: the millpond kept its well`);
          }
          checked++;
        }
      }
    }
  }
  assert.equal(checked, 36, `the sweep ran (${checked})`);
  assert.ok(featureTiles > 1000, `and it saw real ground (${featureTiles} feature tiles across the sweep)`);
  // Non-vacuous: the instrument was actually present most of the time, so the
  // skip-if-dropped branch is not quietly swallowing the whole case.
  assert.ok(ponds >= 24, `and the pond was built in most of them (${ponds} of ${checked})`);
}

// ── A FORWARD-VERSION SAVE IS READ, NOT HALF-APPLIED (S5 slice 1) ──────────
// `saved.v === 1` was a STRICT equality gate, and seed/theme resolve ABOVE it.
// A save written by a newer build therefore produced the right world with a
// reset player — start-zone spawn, 08:00, day 1, no intro flags, no World Maps
// bindings — and the very next flush overwrote that newer row with a `v:1`
// blob carrying none of the newer build's fields. Round-tripping one chat
// through an older client was silently, permanently data-destructive.
//
// Two halves and both are load-bearing: the gate becomes a FLOOR (`v >= 1`,
// every field inside keeping the type check it already had), and the top-level
// keys this build does not recognize are parked on the sim and re-emitted by
// snapshot() so no flush of ours can strip them.
//
// The blob is built with JSON.parse rather than a literal, because that is what
// a real row is — and because it is the only way to get a `"__proto__"` key,
// which JSON.parse hands over as an own property and a naive copy loop would
// assign straight onto Object.prototype.
{
  const sealed = brief.defaults("cozy-village", 1107);
  const w = world.build(1107, "cozy-village", sealed);
  const meta = { pixelforgeBrief: sealed };
  // A resolvable zone that is NOT the start zone: restoring it proves the gate
  // ran, rather than proving the Sim constructor's own default.
  const otherZone = Object.keys(w.zones).find((id) => id !== w.startZone);
  assert.ok(otherZone, "the compiled world has a second zone to restore into");
  const z = w.zones[otherZone];
  const savedX = Math.round((z.spawn.x + 0.5) * loadedPF.TILE);
  const savedY = Math.round((z.spawn.y + 0.5) * loadedPF.TILE);
  const body = JSON.stringify({
    v: 7, // a build seven envelope versions ahead of this one
    chatId: "chat-forward",
    seed: 1107,
    theme: "cozy-village",
    zone: otherZone,
    x: savedX,
    y: savedY,
    facing: 3,
    clockMin: 21 * 60 + 7,
    day: 12,
    bindings: { "pf.1.kept": w.startZone, "pf.2.dead": "zNoSuchZone" },
    intro: { world: true, zones: { [w.startZone]: true }, npcs: { n1: true } },
    // Three unknown keys, deliberately out of alphabetical order.
    zzTop: "kept verbatim",
    player: { v: 1, pouch: { money: 7 } },
    aaFirst: [1, 2, 3],
  });
  const row = JSON.parse(`{"__proto__":{"polluted":true},${body.slice(1)}`);
  assert.equal(row.zzTop, "kept verbatim", "the fixture really carries its unknown keys");

  const sim = loadedPF.save.simFromSaved(row, meta, "chat-forward");
  assert.equal(sim.zoneId, otherZone, "a v:7 save still restores its zone");
  assert.equal(
    sim.x,
    loadedPF.clamp(savedX, loadedPF.TILE, (z.w - 1) * loadedPF.TILE),
    "and its x, through the same clamp v:1 gets",
  );
  assert.equal(sim.y, loadedPF.clamp(savedY, loadedPF.TILE, (z.h - 1) * loadedPF.TILE), "and its y");
  assert.equal(sim.facing, 3, "and its facing");
  assert.equal(sim.clockMin, 21 * 60 + 7, "and its clock — not 08:00");
  assert.equal(sim.day, 12, "and its day — not day 1");
  assert.equal(sim.intro.world, true, "and the one-shot world intro stays burned");
  assert.equal(sim.intro.zones[w.startZone], true, "and the zone flags survive");
  assert.equal(sim.world.bindings["pf.1.kept"], w.startZone, "and a live World Maps binding is re-hung");
  assert.equal(sim.world.bindings["pf.2.dead"], undefined, "while one naming a dead zone is still dropped");

  // The unknown keys landed on the sim, and only the unknown ones.
  assert.ok(sim._envelopeExtra, "the restore parked the unrecognized keys on the sim");
  assert.deepEqual(
    Object.keys(sim._envelopeExtra).sort(),
    ["aaFirst", "player", "zzTop"],
    "exactly the unrecognized top-level keys are retained",
  );
  assert.equal(sim._envelopeExtra.player.pouch.money, 7, "retained by value, not by name");
  assert.equal({}.polluted, undefined, "and a __proto__ key never reached Object.prototype");

  // snapshot() re-emits them FIRST, in sorted order, with our own keys written
  // over the top — and it does it off a synthetic two-key core.
  const snap = loadedPF.save.snapshot({ sim, chatId: "chat-forward" });
  assert.deepEqual(
    Object.keys(snap).slice(0, 3),
    ["aaFirst", "player", "zzTop"],
    "the carried keys are emitted first and sorted, whatever order they arrived in",
  );
  assert.equal(snap.v, 1, "this build still stamps its own envelope version");
  assert.equal(snap.zone, otherZone, "and the known keys are ours, not the row's");
  assert.deepEqual(snap.player, { v: 1, pouch: { money: 7 } }, "the newer build's block survives the flush");
  assert.equal(
    JSON.stringify(snap),
    JSON.stringify(loadedPF.save.snapshot({ sim, chatId: "chat-forward" })),
    "and the serialization is byte-stable — the dedupe and the rewind compare are string equality",
  );
  assert.ok(!JSON.stringify(snap).includes("undefined"), "no undefined values reach the wire");

  // The whole point: it round-trips. Feed the flushed blob back in and nothing
  // has been shaved off.
  const again = loadedPF.save.simFromSaved(JSON.parse(JSON.stringify(snap)), meta, "chat-forward");
  assert.deepEqual(again._envelopeExtra, sim._envelopeExtra, "a second pass through the save path keeps them all");

  // A genuinely unreadable row still restores nothing but the world: the gate
  // is a floor, not an "anything goes".
  const junk = loadedPF.save.simFromSaved({ v: "1", seed: 1107, theme: "cozy-village", zone: otherZone }, meta, "c");
  assert.equal(junk.zoneId, w.startZone, "a non-numeric v is still refused");
}

// ── SNAPSHOT() STILL SURVIVES A TWO-KEY CORE (S5 slice 1) ──────────────────
// 80-setup seeds a brand-new chat by calling PF.save.snapshot({ sim, chatId })
// — literally two keys, no host, no hud, no render — inside the wizard's launch
// handler, whose catch renders as a generic "Launch failed". Anything the
// snapshot grows that reaches past core.sim/core.chatId breaks chat creation
// itself, and it breaks it in the one place the player cannot work around.
// Pinned as its own case because the envelope carry made snapshot() read a
// second thing off the sim, and every later slice adds more.
{
  const w = world.build(4242, "cozy-village");
  const wizardSim = new loadedPF.Sim(w); // exactly what 80-setup builds
  const seeded = loadedPF.save.snapshot({ sim: wizardSim, chatId: "chat-wizard" });
  assert.equal(seeded.chatId, "chat-wizard", "the wizard's seed snapshot still builds");
  assert.equal(seeded.v, 1, "with the envelope version");
  assert.equal(seeded.zone, w.startZone, "and the start-zone world it just compiled");
  assert.deepEqual(wizardSim._envelopeExtra, {}, "a fresh sim carries an EMPTY carry, never undefined");

  // And a restored sim's carry rides the same two-key call — this is the path
  // the seeding snapshot and the flush snapshot share.
  const carried = loadedPF.save.simFromSaved({ v: 1, seed: 4242, theme: "cozy-village", mystery: 9 }, {}, "chat-2key");
  const snap = loadedPF.save.snapshot({ sim: carried, chatId: "chat-2key" });
  assert.equal(snap.mystery, 9, "an unknown key round-trips through the synthetic core too");
}

// ── THE CARRY SURVIVES THE WHOLESALE SIM REPLACEMENT (S5 slice 1) ──────────
// maybeGenerateBrief throws the whole sim away when the generated brief lands
// ("Fresh sim, fresh bindings", 60-save) and carries nothing over. That is fine
// for play state on a throwaway world; it is NOT fine for a newer build's
// envelope keys, which are not play state at all and would be erased by the
// markDirty at the end of that very function. _rebuild gets the carry back for
// free through simFromSaved; this seam has to transplant it by hand.
{
  const savedAssets = { status: loadedPF.assets.status, noPackage: loadedPF.assets._noPackage };
  const realGenerate = brief.generate;
  const realPatch = loadedPF.api.patchMetadata;
  const patched = [];
  loadedPF.api.patchMetadata = async (chatId, patch) => void patched.push({ chatId, patch });
  brief.generate = async () => brief.defaults("cozy-village", 2211);
  try {
    const meta = { gameSetupConfig: { experienceConfig: { seed: 2211, theme: "cozy-village", generate: true } } };
    const core = { chatId: "chat-generate", host: { chatMeta: meta }, sim: null };
    core.sim = loadedPF.save.simFromSaved(
      { v: 1, seed: 2211, theme: "cozy-village", ministry: { of: "silly walks" } },
      meta,
      core.chatId,
    );
    const before = core.sim;
    assert.deepEqual(before._envelopeExtra, { ministry: { of: "silly walks" } }, "the interim sim holds the carry");

    await loadedPF.save.maybeGenerateBrief(core);

    assert.notEqual(core.sim, before, "the generated brief did replace the sim wholesale");
    assert.ok(core.sim.world.brieved, "and the new world is the compiled one");
    assert.deepEqual(
      core.sim._envelopeExtra,
      { ministry: { of: "silly walks" } },
      "and the newer build's keys came across with it",
    );
    assert.equal(
      loadedPF.save.snapshot(core).ministry.of,
      "silly walks",
      "so the markDirty at the end of generation cannot flush them away",
    );
  } finally {
    brief.generate = realGenerate;
    loadedPF.api.patchMetadata = realPatch;
    loadedPF.save.reset(); // maybeGenerateBrief arms the 2.5s debounce
    loadedPF.assets.status = savedAssets.status;
    loadedPF.assets._noPackage = savedAssets.noPackage;
  }
}

// ── THE SAVE PATH UNDER FAILURE (S5 slice 2) ───────────────────────────────
// Shared fixture for the flush-machinery cases. PF.save is a module singleton
// with a mode, two dedupe caches, a debounce timer and a retry counter on it,
// so every case runs inside a scope that stubs the four things it touches —
// the three PF.api writes/reads, and the timers — and puts all of them back.
//
// Timers are stubbed to RECORD rather than fire: the point of a backoff ladder
// is the delay it asks for, and waiting 60 real seconds to read it back would
// be a worse test as well as a slower one.
const withSavePath = async (run) => {
  const realApi = {
    put: loadedPF.api.putExperienceState,
    patch: loadedPF.api.patchMetadata,
    get: loadedPF.api.getExperienceState,
  };
  const realTimers = {
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
  };
  const calls = [];
  const armed = [];
  const behavior = {
    put: async () => {},
    patch: async () => {},
    get: async () => ({ available: false, status: 404 }),
  };
  loadedPF.api.putExperienceState = (chatId, state, keepalive) => {
    calls.push({ kind: "put", chatId, state, keepalive });
    return behavior.put(chatId, state, keepalive);
  };
  loadedPF.api.patchMetadata = (chatId, patch, keepalive) => {
    calls.push({ kind: "patch", chatId, patch, keepalive });
    return behavior.patch(chatId, patch, keepalive);
  };
  loadedPF.api.getExperienceState = (chatId) => {
    calls.push({ kind: "get", chatId });
    return behavior.get(chatId);
  };
  let timerId = 1;
  globalThis.setTimeout = (fn, ms) => {
    armed.push({ ms, fn });
    return timerId++;
  };
  globalThis.clearTimeout = () => {};
  globalThis.setInterval = (fn, ms) => {
    armed.push({ ms, fn, interval: true });
    return timerId++;
  };
  globalThis.clearInterval = () => {};
  // Let a parked async flush actually reach its await before we look at it.
  const tick = async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
  };
  const makeCore = (chatId, seed) => {
    const toasts = [];
    return {
      chatId,
      sim: new loadedPF.Sim(world.build(seed, "cozy-village")),
      host: { chatMeta: {} },
      hud: { toast: (t) => toasts.push(t), refreshChips() {} },
      toasts,
    };
  };
  loadedPF.save.reset();
  try {
    await run({ calls, armed, behavior, tick, makeCore });
  } finally {
    loadedPF.save.reset();
    loadedPF.api.putExperienceState = realApi.put;
    loadedPF.api.patchMetadata = realApi.patch;
    loadedPF.api.getExperienceState = realApi.get;
    Object.assign(globalThis, realTimers);
  }
};

// (d) ONE BAD FLUSH MUST NOT KILL THE CHAIN.
// flush() chained with `.then(task)` and _flushNow took its snapshot OUTSIDE
// the try. A snapshot or a stringify that threw therefore rejected the chain
// link — and `.then(task)` with no rejection handler SKIPS every task queued
// behind a rejected link and stays rejected forever. One throw silenced saving
// for the rest of the session, from a code fault that has nothing to do with
// the network. `.then(task, task)` plus the snapshot inside the try.
await withSavePath(async ({ calls, makeCore }) => {
  assert.equal(typeof loadedPF.save.captureFlush, "function", "the flush machinery exposes a synchronous capture");
  loadedPF.save.mode = "metadata";
  const core = makeCore("chat-throw", 606);
  const realSnapshot = loadedPF.save.snapshot;
  let armThrow = true;
  loadedPF.save.snapshot = function snapshot(c) {
    if (armThrow) {
      armThrow = false;
      throw new TypeError("Converting circular structure to JSON");
    }
    return realSnapshot.call(this, c);
  };
  try {
    let rejected = false;
    await loadedPF.save.flush(core, false).catch(() => {
      rejected = true;
    });
    assert.equal(calls.length, 0, "the throwing flush wrote nothing");

    await loadedPF.save.flush(core, false).catch(() => {});
    assert.deepEqual(
      calls.map((c) => c.kind),
      ["patch"],
      "the NEXT flush still runs — one bad flush costs one flush",
    );
    assert.equal(rejected, false, "and the throw was caught inside the flush, never handed to the chain");
  } finally {
    loadedPF.save.snapshot = realSnapshot;
  }
});

// The classifier needs a status to classify with. PF.api threw a bare Error
// whose only record of the status was the text inside its message — parsing a
// status back out of a message string is a trap the first time a message
// changes, so the status now rides the error object.
{
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 413 });
  try {
    await assert.rejects(
      () => loadedPF.api.putExperienceState("chat-status", { v: 1 }, false),
      (err) => err.status === 413 && err.message === "PUT experience-state → 413",
      "a rejected PUT carries its status, and keeps the message it always had",
    );
    await assert.rejects(
      () => loadedPF.api.patchMetadata("chat-status", { pixelforge: {} }, false),
      (err) => err.status === 413 && err.message === "PATCH metadata → 413",
      "and so does a rejected metadata PATCH",
    );
  } finally {
    globalThis.fetch = realFetch;
  }
}

// (e) A FAILED WRITE IS CLASSIFIED, NOT SHRUGGED AT.
// The whole failure policy was one console.warn and the hope that some
// UNRELATED future dirty event (a turn edge, a zone change, 30s of walking)
// would retry. In a quiet moment there is no such event and the write is
// simply lost. Three classes now: terminal, transient, and "this chat is no
// longer an Experience".
await withSavePath(async ({ calls, armed, behavior, makeCore }) => {
  // Built here rather than through PF.httpError so this case tests the
  // CLASSIFIER, not the helper the block above already pins.
  const httpError = (status) => Object.assign(new Error(`PUT experience-state → ${status}`), { status });
  // TERMINAL — a payload refused at this size is refused at this size again,
  // so retrying is a loop. Stop, degrade, and say so exactly once.
  loadedPF.save.mode = "routes";
  const core = makeCore("chat-too-big", 707);
  behavior.put = async () => {
    throw httpError(422);
  };
  await loadedPF.save.flush(core, false);
  assert.equal(loadedPF.save.degraded, true, "a 422 degrades the session");
  assert.equal(armed.length, 0, "and re-arms nothing");
  assert.equal(core.toasts.length, 1, "and tells the player");
  await loadedPF.save.flush(core, false);
  assert.equal(core.toasts.length, 1, "once — not once per flush");
  assert.equal(loadedPF.save.degraded, true, "and it stays degraded while the condition holds");

  // TRANSIENT — a network error has no status at all. Walk the ladder, then
  // stop and fall back to today's trigger-driven behavior.
  loadedPF.save.reset();
  armed.length = 0;
  loadedPF.save.mode = "routes";
  let networkDown = true;
  behavior.put = async () => {
    if (networkDown) throw new TypeError("NetworkError when attempting to fetch resource");
  };
  for (let i = 0; i < 9; i++) await loadedPF.save.flush(core, false);
  assert.deepEqual(
    armed.map((a) => a.ms),
    [2500, 5000, 10_000, 30_000, 60_000, 60_000, 60_000, 60_000],
    "the backoff ladder walks and gives up after eight",
  );

  networkDown = false;
  await loadedPF.save.flush(core, false);
  assert.equal(loadedPF.save._flushFailures, 0, "a landed write clears the counter");
  armed.length = 0;
  core.sim.day += 1;
  networkDown = true;
  await loadedPF.save.flush(core, false);
  assert.deepEqual(
    armed.map((a) => a.ms),
    [2500],
    "so the next outage starts at the bottom rung, not where the last one stopped",
  );

  // 409 — the chat lost its Experience stamp AFTER adopt() committed to routes
  // mode. putExperienceState has no 409 handling today, so every later PUT
  // would fail this way forever with no fallback and no retry.
  loadedPF.save.reset();
  calls.length = 0;
  loadedPF.save.mode = "routes";
  loadedPF.save._serverSerialized = "{}";
  behavior.put = async () => {
    throw httpError(409);
  };
  core.sim.day += 1;
  await loadedPF.save.flush(core, false);
  assert.equal(loadedPF.save.mode, "metadata", "a 409 after adoption falls back instead of failing forever");
  assert.equal(loadedPF.save._serverSerialized, null, "dropping a route authority it no longer has");
  assert.equal(loadedPF.save._probePinned, true, "and pinning, so the re-probe can promote it back");
});

// (f) THE MUTATION IN THE DEBOUNCE WINDOW SURVIVES A CHAT SWITCH.
// _switchChat fired `flush(this, false)` and then, on the very next lines,
// reset() the dedupe caches and reassigned chatId and sim. The chained flush
// snapshots when the chain gets round to it — so it wrote the NEW chat's world
// under the NEW chat's id, and whatever the player did in the last 2.5s of the
// old chat was never written anywhere. Capture synchronously, and fence every
// post-await assignment on the generation the capture was taken at.
await withSavePath(async ({ calls, armed, makeCore }) => {
  loadedPF.save.mode = "metadata";
  const core = makeCore("chat-old", 11);
  await loadedPF.save.flush(core, false); // the chat has been played and saved
  const settledDay = core.sim.day;
  calls.length = 0;

  // A mutation lands inside the debounce window, and the player switches chats.
  core.sim.day = settledDay + 3;
  loadedPF.save.markDirty(core);
  assert.equal(armed.length, 1, "the 2.5s debounce is armed and has NOT fired");

  // 90-element._switchChat, in its exact order.
  const pending = loadedPF.save.captureFlush(core);
  loadedPF.save.reset();
  if (pending) void loadedPF.save.flush(core, false, pending);
  core.chatId = "chat-new";
  core.sim = new loadedPF.Sim(world.build(77, "cozy-village"));
  await loadedPF.save._flushChain;

  const written = calls.filter((c) => c.kind === "patch");
  assert.equal(written.length, 1, "the pending write went out");
  assert.equal(written[0].chatId, "chat-old", "addressed to the chat we LEFT");
  assert.equal(written[0].patch.pixelforge.day, settledDay + 3, "carrying the mutation from the debounce window");
  assert.equal(loadedPF.save._lastSerialized, null, "and it touched none of the NEW chat's dedupe caches");
  assert.equal(loadedPF.save._metaSerialized, null, "either of them");
});

// (g) THE LAST WRITE OF THE SESSION DOES NOT QUEUE BEHIND ANYTHING.
// pagehide went through the same _flushChain as everything else, so an ordinary
// flush parked mid-await swallowed it: the chained teardown ran after the page
// was already gone. It also awaited the route PUT before even dispatching the
// metadata PATCH, which spends the unload window on the first of two requests.
// Out of band, synchronous snapshot, both keepalive requests in flight at once.
await withSavePath(async ({ calls, behavior, tick, makeCore }) => {
  assert.equal(typeof loadedPF.save.flushTeardown, "function", "teardown has its own path");
  loadedPF.save.mode = "routes";
  const core = makeCore("chat-exit", 99);

  // Clean: a world with nothing new in it does not spend the session's last
  // two requests saying so.
  loadedPF.save._lastSerialized = JSON.stringify(loadedPF.save.snapshot(core));
  loadedPF.save.flushTeardown(core);
  assert.equal(calls.length, 0, "a clean world writes nothing at teardown");

  // Dirty: both go out, and flushTeardown is synchronous — so the fact that
  // both are recorded by the time it returns IS the concurrency proof. Every
  // request is parked until the case releases it, so nothing can settle early
  // and make the ordering look concurrent when it was sequential.
  const parked = [];
  const park = () => new Promise((resolve) => parked.push(resolve));
  behavior.put = park;
  behavior.patch = park;
  core.sim.day += 1;
  loadedPF.save.flushTeardown(core);
  assert.deepEqual(
    calls.map((c) => c.kind),
    ["put", "patch"],
    "route row and metadata cache are both in flight before either resolves",
  );
  assert.equal(calls[0].keepalive, true, "the PUT rides keepalive");
  assert.equal(calls[1].keepalive, true, "and so does the PATCH");
  calls.length = 0;

  // And it does not queue behind an ordinary flush that is parked mid-await.
  behavior.put = async () => {};
  core.sim.day += 1;
  void loadedPF.save.flush(core, false);
  await tick();
  assert.deepEqual(
    calls.map((c) => c.kind),
    ["put", "patch"],
    "the ordinary flush is genuinely parked inside its metadata await",
  );
  calls.length = 0;
  core.sim.day += 1;
  loadedPF.save.flushTeardown(core);
  assert.deepEqual(
    calls.map((c) => c.kind),
    ["put", "patch"],
    "the teardown pair goes out anyway — the chain does not get to swallow it",
  );
  for (const release of parked) release();
  await loadedPF.save._flushChain.catch(() => {});
});

// (h) A PROBE THAT FAILED IS RE-PROBED; A PROBE THAT ANSWERED IS NOT.
// adopt() short-circuits on `mode !== null` and only reset() clears it, so a
// transient 500 or a network blip during boot cost the player timeline rewind
// for the ENTIRE session — swipes, branches and checkpoint loads silently stop
// moving the world — with nothing but a console.warn to show for it. A 404/409
// is a different animal: it is the route honestly saying it is not here, and
// re-asking every minute would be noise.
await withSavePath(async ({ behavior, tick, makeCore }) => {
  const core = makeCore("chat-pinned", 33);
  behavior.get = async () => {
    throw new TypeError("NetworkError when attempting to fetch resource");
  };
  await loadedPF.save.adopt(core);
  assert.equal(loadedPF.save.mode, "metadata", "a probe that THREW degrades to metadata, as before");
  assert.equal(loadedPF.save._probePinned, true, "but pins — a failure is not an answer");

  behavior.get = async () => ({ available: true, status: 200, body: { exists: false } });
  core.sim.day += 1;
  await loadedPF.save.flush(core, false);
  await tick();
  assert.equal(loadedPF.save.mode, "routes", "and the first metadata write that LANDS earns the promotion");
  assert.equal(loadedPF.save._probePinned, false, "which clears the pin");
  assert.equal(loadedPF.save._lastSerialized, null, "promoting with FIRST-WRITE semantics");
  assert.equal(loadedPF.save._serverSerialized, null, "never the rewind path — there is no row of ours to compare");

  loadedPF.save.reset();
  behavior.get = async () => ({ available: false, status: 404 });
  await loadedPF.save.adopt(makeCore("chat-old-engine", 34));
  assert.equal(loadedPF.save.mode, "metadata", "an older engine still lands in metadata mode");
  assert.equal(loadedPF.save._probePinned, false, "and is never pinned — that answer is not going to change");
});

console.log("brief validator + compiler: all cases passed");
